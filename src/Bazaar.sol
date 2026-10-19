// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBazaar} from "./interfaces/IBazaar.sol";
import {Floor} from "./interfaces/IMarket.sol";
import {
    ISeaport, ISeaportZone, Order, OrderParameters, OrderComponents, ZoneParameters, SpentItem,
    ReceivedItem, Schema, ItemType, OrderType, Side
} from "./interfaces/ISeaport.sol";
import {IIntact} from "./interfaces/IIntact.sol";
import {IReach} from "./interfaces/IReach.sol";
import {IPool, Market as OwnedMarket} from "./interfaces/IPool.sol";
import {IERC20, IERC165} from "./interfaces/Standards.sol";
import {Transient} from "./lib/Transient.sol";

/// @dev Seaport 1.6's own `ZoneInterface` (seaport-types, src/interfaces/
///      ZoneInterface.sol) re-declares `supportsInterface` inside the
///      interface, so the id a Seaport integrator computes from it is
///      ISeaportZone's XOR 0x01ffc9a7. Declared here only so the compiler
///      computes that id rather than a document stating it.
interface ISeaportZoneInterface is IERC165 {
    function authorizeOrder(ZoneParameters calldata zoneParameters) external returns (bytes4);
    function validateOrder(ZoneParameters calldata zoneParameters) external returns (bytes4);
    function getSeaportMetadata() external view returns (string memory name, Schema[] memory schemas);
    function supportsInterface(bytes4 interfaceId) external view override returns (bool);
}

/// @dev SIP-5's interface is the one view; its id is the selector, 0x2e778efc.
interface ISIP5 {
    function getSeaportMetadata() external view returns (string memory name, Schema[] memory schemas);
}

/*───────────────────────────────────────────────────────────────────────────
  Bazaar — Seaport orders published on chain, and the zone INTACT tokens
  trade under on any Seaport venue (V2, unit W3; docs/V2.md §3.3)

  The owner wants every NFT bought and sold from the viewer, OpenSea's
  listings included, and OpenSea's listings are Seaport orders. So the
  Bazaar invents no order book. It does two things beside Seaport 1.6,
  and they are one contract so that the zone an INTACT order names is the
  contract that pinned it.

  ── publishing ──

  `publish(order, floors)` calls `Seaport.validate([order])` (the offerer's
  signature travels in the order; an order the offerer validated from its
  own address needs none), asks Seaport whether the order now stands
  validated and uncancelled, and emits one `Published` per non-fungible
  item, indexed by token and identifier, so a page finds every order of
  one NFT with one filtered `eth_getLogs` and no API. Seaport's own
  `OrderValidated`, emitted beside it, carries the whole order, so any
  reader can fill it without the signature. Publishing moves nothing and
  is anyone's: the offerer's signature is the authority, as on Seaport.

  ── the zone, and why an INTACT token needs one ──

  An Intact is not a picture. Between a buyer deciding and the fill
  landing, a seller can empty the Reach, grant an approval that outlives
  the sale, re-price the owned market or rewrite a trait — and a venue that
  checks only `ownerOf` fills anyway. The Market (src/Market.sol) answers
  with a fingerprint pin, both seals, balance floors and the royalty first.
  An INTACT order on Seaport keeps those guarantees when it names this
  contract as its zone, is FULL_RESTRICTED and carries

      zoneHash = pinHash(id, getStateFingerprint(id), floors)

  computed at `publish` against the live fingerprint and stored, since the
  zone is shown only the hash. Seaport then asks `authorizeOrder` before
  any item moves, and it refuses, in this order, a fill whose
    - zone hash pins nothing                                   NotPinned
    - items do not name exactly one INTACT token, a plain
      ERC-721, or name another than the pinned one              NotIntact, WrongToken
    - token's fingerprint is no longer the pinned one           FingerprintMoved
    - Reach is not sealed until at least the order's end        ReachSealShort
    - owned market is open and not sealed until then            MarketSealShort
    - Reach breaks a floor (an ERC-20's `balanceOf`, or
      ether for address(0); an asset that does not answer
      reads as zero — no answer is not a balance)               FloorBroken
    - price is not one currency (two currencies, or an item
      that is not a currency, on the priced side)               Unpriced
    - consideration does not pay the hub's ERC-2981 receiver
      at least the royalty on the price, in that currency       RoyaltyShort
  The price is the consideration summed (a listing: the INTACT token is
  offered) or the offer summed (a bid: it is asked for), at the amounts
  Seaport is about to move. "Unpriced" exists because a royalty on part of
  a price is not the royalty, and an NFT is not a price: without it an
  order priced 1 wei plus a thousand USDC would owe a royalty on 1 wei.

  A pin is a statement about a token, not about one order: any order that
  carries a pinned zone hash is held to the same state, so a seller who
  publishes once may sign further orders under the same pin (a price
  drop, an OpenSea copy) without another transaction. A pin is made only
  by `publish`, against the fingerprint live at that block, and an order
  can name a pin and still be refused at the fill for its own end time,
  its own token or its own price.

  ── after the transfers ──

  `validateOrder` runs after every item has moved, and it re-reads two
  things, because Seaport hands the seller a moment inside the fill in
  which it still holds the token. Seaport 1.6's standard and combined
  paths (`fulfillOrder`, `fulfillAdvancedOrder`, the `fulfillAvailable*`
  family, `matchOrders`) push native currency to each recipient at once
  but ACCUMULATE every conduit transfer and run them at the end
  (seaport-core 1.6 Executor.sol `_transfer`, OrderFulfiller.sol
  `_transferEach`). An INTACT listing paid in ether through a conduit —
  OpenSea's ordinary shape — therefore calls the seller's `receive` while
  the seller is still the holder, after `authorizeOrder` has passed. A
  sealed Reach polices only what it promised; an asset off its manifest
  can be moved or approved in that moment, and an approval outlives the
  sale. So, after the transfers:
    - every floor is measured again (the Market's rule: before the
      payment and again after the token has moved);
    - the pin's residue — the Reach's `state()` counter and the owned
      market's `marketHash` — must be unchanged. Both are terms of the
      fingerprint the sale itself does not move, and the Reach bumps its
      counter on every act it performs (each call, seal, guard, grant,
      revocation), so a Reach that acted, or a market that traded, during
      the fill refuses it with FingerprintMoved. The residue is stored at
      `publish`: the fingerprint matched at `authorizeOrder`, and it hashes
      both terms, so the residue stored is the residue `authorizeOrder` saw.
  What this does not re-read: the terms a sale leaves standing that move
  no value — the traits, the launches, the locks, the steward's plan (and
  V2's journal root). A seller acting inside the fill can still rewrite a
  name. Closing that needs the hub to expose its own "residue" view, which
  is the hub's file (docs/v2/W3-bazaar.md, requests). Basic orders paid in
  ether move the token first and have no such moment.

  ── what this contract has no function to do ──

  There is no owner, no fee, no pause, no setter and no upgrade. It holds
  no ether (no `receive`) and moves no token: the zone's two calls are
  `view`, so nothing they read can change and they write nothing. It
  calls Seaport's `getCounter`, `getOrderHash`, `validate` and
  `getOrderStatus` and nothing else — in particular no fulfilment, because
  Seaport skips the zone when the zone itself is the caller, and a zone
  that could fill would be a zone that could skip its own checks.

  ── SIP-5 ──

  `getSeaportMetadata` names the contract and lists no schema: the Bazaar
  implements no SIP beyond SIP-5 itself. SIP-15 (dynamic traits) is the
  nearest, and is not claimed: its commitment rides in fulfiller-supplied
  `extraData` and it has no assigned id, while the Bazaar's rides in the
  signed `zoneHash`. `SeaportCompatibleContractDeployed` is emitted at
  construction, and `supportsInterface` answers ERC-165, SIP-5 (0x2e778efc),
  ISeaportZone as frozen (0x3822a094), Seaport 1.6's own ZoneInterface
  (0x39dd6933) and IBazaar.
───────────────────────────────────────────────────────────────────────────*/
contract Bazaar is IBazaar {
    /// @notice A pin was zero at construction.
    error ZeroAddress();
    /// @notice An INTACT order's priced side is not one currency.
    error Unpriced();

    /// @notice SIP-5: emitted once, when a Seaport-compatible contract is deployed.
    event SeaportCompatibleContractDeployed();

    address public immutable SEAPORT;
    address public immutable HUB;
    /// @dev The hub's own POOL: the owned market the fingerprint hashes.
    address public immutable POOL;

    /// @dev Enough for a Reach's real holdings, few enough that the zone's
    ///      two passes over them cannot be made to run a fill out of gas.
    uint256 public constant MAX_FLOORS = 16;

    struct Pin {
        uint256 id;
        bytes32 fingerprint;
        bytes32 residue;       // keccak(Reach.state(), Pool.marketHash(id)) at publish
        Floor[] floors;
    }

    mapping(bytes32 => Pin) private _pins;

    constructor(address seaport, address hub, address pool) {
        if (seaport == address(0) || hub == address(0) || pool == address(0)) revert ZeroAddress();
        SEAPORT = seaport;
        HUB = hub;
        POOL = pool;
        emit SeaportCompatibleContractDeployed();
    }

    modifier locked() {
        Transient.enter(Transient.BAZAAR_LOCK);
        _;
        Transient.exit(Transient.BAZAAR_LOCK);
    }

    /*═══════════════════ publishing ═══════════════════*/

    /// @notice Validate `order` on Seaport and index it. `floors` must be
    ///         empty unless the order names this contract as its zone.
    /// @dev    The order hash is Seaport's own (`getOrderHash` at the
    ///         offerer's live counter) over the consideration as given, so
    ///         an order carrying more consideration than it signed is
    ///         refused as NotValidated rather than indexed under a hash
    ///         Seaport never validated.
    function publish(Order calldata order, Floor[] calldata floors) external locked returns (bytes32 orderHash) {
        OrderParameters calldata p = order.parameters;
        ISeaport seaport = ISeaport(SEAPORT);
        orderHash = seaport.getOrderHash(_components(p, seaport.getCounter(p.offerer)));

        if (p.zone == address(this)) {
            if (p.orderType != OrderType.FULL_RESTRICTED) revert NotRestricted();
            (bool listing, uint256 id) = _intactInOrder(p);
            _requireOneCurrencyInOrder(p, listing);
            if (floors.length > MAX_FLOORS) revert TooManyFloors();
            IIntact hub = IIntact(HUB);
            bytes32 fingerprint = hub.getStateFingerprint(id);
            bytes32 expected = pinHash(id, fingerprint, floors);
            if (p.zoneHash != expected) revert BadPin(expected, p.zoneHash);
            Pin storage pin = _pins[expected];
            if (pin.fingerprint == bytes32(0)) {
                pin.id = id;
                pin.fingerprint = fingerprint;
                pin.residue = _residue(id, hub.account(id));
                for (uint256 i; i < floors.length; ++i) pin.floors.push(floors[i]);
            }
            emit Pinned(expected, id, fingerprint, floors.length);
        } else if (floors.length != 0) {
            revert FloorsWithoutZone();
        }
        if (!_hasNFT(p)) revert NoNFT();

        Order[] memory batch = new Order[](1);
        batch[0] = order;
        seaport.validate(batch);
        (bool validated, bool cancelled, , ) = seaport.getOrderStatus(orderHash);
        if (!validated || cancelled) revert NotValidated(orderHash);

        _announce(p, orderHash);
    }

    /// @notice keccak256(abi.encode(address(this), id, fingerprint, floors)).
    function pinHash(uint256 id, bytes32 fingerprint, Floor[] calldata floors) public view returns (bytes32) {
        return keccak256(abi.encode(address(this), id, fingerprint, floors));
    }

    function pinOf(bytes32 zoneHash) external view returns (uint256 id, bytes32 fingerprint, Floor[] memory floors) {
        Pin storage pin = _pins[zoneHash];
        return (pin.id, pin.fingerprint, pin.floors);
    }

    /// @notice What `authorizeOrder` would refuse an order carrying
    ///         `zoneHash` and ending at `endTime`, now — the error's
    ///         selector, or zero — leaving out what needs the order itself:
    ///         its token and its price. For a page's "still good" line.
    function check(bytes32 zoneHash, uint256 endTime) external view returns (bytes4 refusal) {
        Pin storage pin = _pins[zoneHash];
        if (pin.fingerprint == bytes32(0)) return NotPinned.selector;
        bytes memory why = _stateRefusal(pin, endTime);
        return why.length == 0 ? bytes4(0) : bytes4(why);
    }

    /*═══════════════════ the zone ═══════════════════*/

    /// @notice Before any transfer: the pin, the token, the state, the
    ///         seals, the floors, the price and the royalty.
    function authorizeOrder(ZoneParameters calldata zp) external view returns (bytes4) {
        if (msg.sender != SEAPORT) revert NotSeaport();
        Pin storage pin = _pins[zp.zoneHash];
        if (pin.fingerprint == bytes32(0)) revert NotPinned(zp.zoneHash);
        (bool listing, uint256 id) = _intactInFill(zp);
        if (id != pin.id) revert WrongToken(pin.id, id);
        bytes memory why = _stateRefusal(pin, zp.endTime);
        if (why.length != 0) _raise(why);
        _requireRoyalty(zp, listing, id);
        return ISeaportZone.authorizeOrder.selector;
    }

    /// @notice After every transfer: the residue and the floors, measured
    ///         again (the box above says why).
    function validateOrder(ZoneParameters calldata zp) external view returns (bytes4) {
        if (msg.sender != SEAPORT) revert NotSeaport();
        Pin storage pin = _pins[zp.zoneHash];
        if (pin.fingerprint == bytes32(0)) revert NotPinned(zp.zoneHash);
        IIntact hub = IIntact(HUB);
        uint256 id = pin.id;
        address reach = hub.account(id);
        if (_residue(id, reach) != pin.residue) revert FingerprintMoved(pin.fingerprint, hub.getStateFingerprint(id));
        Floor[] storage floors = pin.floors;
        for (uint256 i; i < floors.length; ++i) {
            (address asset, uint256 min) = (floors[i].asset, floors[i].min);
            uint256 balance = _holding(asset, reach);
            if (balance < min) revert FloorBroken(asset, balance, min);
        }
        return ISeaportZone.validateOrder.selector;
    }

    function getSeaportMetadata() external pure returns (string memory name, Schema[] memory schemas) {
        return ("INTACT Bazaar", new Schema[](0));
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(ISIP5).interfaceId
            || interfaceId == type(ISeaportZone).interfaceId
            || interfaceId == type(ISeaportZoneInterface).interfaceId
            || interfaceId == type(IBazaar).interfaceId;
    }

    /*═══════════════════ the state a pin holds a token to ═══════════════════*/

    /// @dev The refusal, as revert data, or empty: one path for the zone
    ///      (which reverts with it) and for `check` (which returns its
    ///      selector), so the page's line and the fill cannot disagree.
    function _stateRefusal(Pin storage pin, uint256 endTime) private view returns (bytes memory) {
        IIntact hub = IIntact(HUB);
        uint256 id = pin.id;
        bytes32 live = hub.getStateFingerprint(id);
        if (live != pin.fingerprint) return abi.encodeWithSelector(FingerprintMoved.selector, pin.fingerprint, live);
        address reach = hub.account(id);
        uint64 reachUntil = _reachSeal(reach);
        if (reachUntil < endTime) return abi.encodeWithSelector(ReachSealShort.selector, reachUntil, endTime);
        (bool open, uint64 marketUntil) = _marketSeal(id);
        if (open && marketUntil < endTime) return abi.encodeWithSelector(MarketSealShort.selector, marketUntil, endTime);
        Floor[] storage floors = pin.floors;
        for (uint256 i; i < floors.length; ++i) {
            (address asset, uint256 min) = (floors[i].asset, floors[i].min);
            uint256 balance = _holding(asset, reach);
            if (balance < min) return abi.encodeWithSelector(FloorBroken.selector, asset, balance, min);
        }
        return "";
    }

    /// @dev The two fingerprint terms a sale does not move and a seller
    ///      inside the fill could. "No answer" reads as zero, as it does in
    ///      the hub's own guarded reads, so the two sides compare alike.
    function _residue(uint256 id, address reach) private view returns (bytes32) {
        (, uint256 state) = _word(reach, abi.encodeCall(IReach.state, ()));
        (, uint256 market) = _word(POOL, abi.encodeCall(IPool.marketHash, (id)));
        return keccak256(abi.encode(state, market));
    }

    /// @dev A Reach that does not answer is not sealed, and a word wider than
    ///      a uint64 is not a seal either: it is refused, never truncated.
    function _reachSeal(address reach) private view returns (uint64) {
        (, uint256 w) = _word(reach, abi.encodeCall(IReach.sealedUntil, ()));
        return w > type(uint64).max ? 0 : uint64(w);
    }

    /// @dev A Pool that does not answer reads as an open market with no
    ///      seal: no answer is not a seal, and not a closed market either.
    ///      (A staticcall to an address with no code returns no data, so
    ///      the length test is also the codeless test.)
    function _marketSeal(uint256 id) private view returns (bool open, uint64 sealUntil) {
        (bool ok, bytes memory ret) = POOL.staticcall(abi.encodeCall(IPool.marketOf, (id)));
        if (!ok || ret.length < 32 * 16) return (true, 0);
        OwnedMarket memory m = abi.decode(ret, (OwnedMarket));
        return (m.open, m.sealUntil);
    }

    /// @dev Ether for address(0), else `balanceOf` through a guarded
    ///      staticcall: a codeless or reverting asset reads as zero and
    ///      fails its floor instead of reverting the fill with a foreign
    ///      error, and a staticcall so no asset can re-enter.
    function _holding(address asset, address reach) private view returns (uint256 v) {
        if (asset == address(0)) return reach.balance;
        (, v) = _word(asset, abi.encodeCall(IERC20.balanceOf, (reach)));
    }

    /// @dev `extcodesize` AND a low-level staticcall, one word back or none.
    function _word(address target, bytes memory data) private view returns (bool ok, uint256 w) {
        if (target.code.length == 0) return (false, 0);
        bytes memory ret;
        (ok, ret) = target.staticcall(data);
        if (ok && ret.length == 32) w = abi.decode(ret, (uint256));
        else ok = false;
    }

    function _raise(bytes memory why) private pure {
        assembly ("memory-safe") { revert(add(why, 0x20), mload(why)) }
    }

    /*═══════════════════ the INTACT item, the price, the royalty ═══════════════════*/

    /// @dev Exactly one item names the hub, and it is a plain ERC-721: not
    ///      a criteria item (a pin covers one id, not "any"), not two
    ///      tokens (the second would be unguarded).
    function _intactInOrder(OrderParameters calldata p) private view returns (bool listing, uint256 id) {
        uint256 n;
        for (uint256 i; i < p.offer.length; ++i) {
            if (p.offer[i].token != HUB) continue;
            if (p.offer[i].itemType != ItemType.ERC721) revert NotIntact();
            (listing, id) = (true, p.offer[i].identifierOrCriteria);
            ++n;
        }
        for (uint256 i; i < p.consideration.length; ++i) {
            if (p.consideration[i].token != HUB) continue;
            if (p.consideration[i].itemType != ItemType.ERC721) revert NotIntact();
            id = p.consideration[i].identifierOrCriteria;
            ++n;
        }
        if (n != 1) revert NotIntact();
    }

    function _intactInFill(ZoneParameters calldata zp) private view returns (bool listing, uint256 id) {
        uint256 n;
        for (uint256 i; i < zp.offer.length; ++i) {
            if (zp.offer[i].token != HUB) continue;
            if (zp.offer[i].itemType != ItemType.ERC721) revert NotIntact();
            (listing, id) = (true, zp.offer[i].identifier);
            ++n;
        }
        for (uint256 i; i < zp.consideration.length; ++i) {
            if (zp.consideration[i].token != HUB) continue;
            if (zp.consideration[i].itemType != ItemType.ERC721) revert NotIntact();
            id = zp.consideration[i].identifier;
            ++n;
        }
        if (n != 1) revert NotIntact();
    }

    /// @dev The priced side — the consideration of a listing, the offer of a
    ///      bid — holds one currency: native or one ERC-20, every item alike.
    function _requireOneCurrencyInOrder(OrderParameters calldata p, bool listing) private pure {
        if (listing) {
            uint256 n = p.consideration.length;
            for (uint256 i; i < n; ++i) {
                _sameCurrency(p.consideration[i].itemType, p.consideration[i].token,
                              p.consideration[0].itemType, p.consideration[0].token);
            }
        } else {
            uint256 n = p.offer.length;
            for (uint256 i; i < n; ++i) {
                _sameCurrency(p.offer[i].itemType, p.offer[i].token, p.offer[0].itemType, p.offer[0].token);
            }
        }
    }

    function _sameCurrency(ItemType kind, address token, ItemType currency, address coin) private pure {
        if ((kind != ItemType.NATIVE && kind != ItemType.ERC20) || kind != currency || token != coin) revert Unpriced();
    }

    /// @dev The royalty on the price, at the amounts Seaport is about to
    ///      move, paid to the hub's receiver in the price's currency. A
    ///      receiver of zero, or a royalty that rounds to zero, owes nothing.
    function _requireRoyalty(ZoneParameters calldata zp, bool listing, uint256 id) private view {
        ItemType currency;
        address coin;
        uint256 price;
        if (listing) {
            ReceivedItem[] calldata c = zp.consideration;
            if (c.length != 0) (currency, coin) = (c[0].itemType, c[0].token);
            for (uint256 i; i < c.length; ++i) {
                _sameCurrency(c[i].itemType, c[i].token, currency, coin);
                price += c[i].amount;
            }
        } else {
            SpentItem[] calldata o = zp.offer;
            if (o.length != 0) (currency, coin) = (o[0].itemType, o[0].token);
            for (uint256 i; i < o.length; ++i) {
                _sameCurrency(o[i].itemType, o[i].token, currency, coin);
                price += o[i].amount;
            }
        }
        (address receiver, uint256 owed) = IIntact(HUB).royaltyInfo(id, price);
        if (receiver == address(0) || owed == 0) return;
        uint256 paid;
        ReceivedItem[] calldata k = zp.consideration;
        for (uint256 i; i < k.length; ++i) {
            if (k[i].recipient == receiver && k[i].itemType == currency && k[i].token == coin) paid += k[i].amount;
        }
        if (paid < owed) revert RoyaltyShort(receiver, paid, owed);
    }

    /*═══════════════════ the index ═══════════════════*/

    function _components(OrderParameters calldata p, uint256 counter) private pure returns (OrderComponents memory) {
        return OrderComponents({
            offerer: p.offerer, zone: p.zone, offer: p.offer, consideration: p.consideration,
            orderType: p.orderType, startTime: p.startTime, endTime: p.endTime, zoneHash: p.zoneHash,
            salt: p.salt, conduitKey: p.conduitKey, counter: counter
        });
    }

    function _isNFT(ItemType kind) private pure returns (bool) {
        return kind != ItemType.NATIVE && kind != ItemType.ERC20;
    }

    function _hasNFT(OrderParameters calldata p) private pure returns (bool) {
        for (uint256 i; i < p.offer.length; ++i) if (_isNFT(p.offer[i].itemType)) return true;
        for (uint256 i; i < p.consideration.length; ++i) if (_isNFT(p.consideration[i].itemType)) return true;
        return false;
    }

    /// @dev One `Published` per non-fungible item. A listing's price is the
    ///      first consideration item's currency summed over the
    ///      consideration; a bid's is the first offer item's amount; both at
    ///      startAmount, and zero when that side is not one currency
    ///      (IBazaar's event comment, binding).
    function _announce(OrderParameters calldata p, bytes32 orderHash) private {
        (address askIn, uint256 ask) = (address(0), 0);
        if (p.consideration.length != 0) {
            askIn = p.consideration[0].token;
            ItemType kind = p.consideration[0].itemType;
            bool one = !_isNFT(kind);
            for (uint256 i; i < p.consideration.length && one; ++i) {
                if (p.consideration[i].itemType != kind || p.consideration[i].token != askIn) one = false;
                else ask += p.consideration[i].startAmount;
            }
            if (!one) ask = 0;
        }
        (address bidIn, uint256 bid) = (address(0), 0);
        if (p.offer.length != 0) {
            bidIn = p.offer[0].token;
            ItemType kind = p.offer[0].itemType;
            bool one = !_isNFT(kind);
            for (uint256 i; i < p.offer.length && one; ++i) {
                if (p.offer[i].itemType != kind || p.offer[i].token != bidIn) one = false;
            }
            if (one) bid = p.offer[0].startAmount;
        }
        for (uint256 i; i < p.offer.length; ++i) {
            ItemType kind = p.offer[i].itemType;
            if (!_isNFT(kind)) continue;
            emit Published(p.offer[i].token, p.offer[i].identifierOrCriteria, orderHash, p.offerer,
                           Side.OFFER, kind, askIn, ask, p.endTime);
        }
        for (uint256 i; i < p.consideration.length; ++i) {
            ItemType kind = p.consideration[i].itemType;
            if (!_isNFT(kind)) continue;
            emit Published(p.consideration[i].token, p.consideration[i].identifierOrCriteria, orderHash, p.offerer,
                           Side.CONSIDERATION, kind, bidIn, bid, p.endTime);
        }
    }
}
