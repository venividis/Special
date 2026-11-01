// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Floor} from "./IMarket.sol";
import {Order, Side, ItemType, ISeaportZone} from "./ISeaport.sol";

/*───────────────────────────────────────────────────────────────────────────
  IBazaar — Seaport orders published on chain, and the zone INTACT tokens
  trade under on any Seaport venue (V2, unit W3)

  docs/V2.md §3.3. Two jobs in one contract, so the zone an INTACT order
  names is the contract that pinned it.

  Publishing. `publish(order, floors)` calls `Seaport.validate([order])`
  (the offerer's signature travels in `order.signature`; an order the
  offerer already validated from its own address needs none) and emits
  one `Published` per ERC-721/ERC-1155 item the order offers (a listing)
  or asks for (a bid), indexed by token and identifier, so a page finds
  every listing of one NFT with one filtered `eth_getLogs`. Seaport's own
  `OrderValidated` carries the whole order beside it.

  The zone. An order of an INTACT token keeps the Market's guarantees on
  any Seaport venue, OpenSea's included, when it names this contract as
  its zone, is FULL_RESTRICTED, and carries
      zoneHash = pinHash(id, getStateFingerprint(id), floors)
  computed at `publish`, which stores the pin. `authorizeOrder` (Seaport
  only, before any transfer) then refuses the fill unless:
    - the order offers or asks for exactly the pinned token;
    - the token's fingerprint is still the pinned one (holder, Core,
      traits, the Reach's state and seal, the owned market, the locks,
      the launches, the steward's plan; V2 adds the memories and the
      keepsakes);
    - the Reach is sealed until at least the order's endTime, and the
      owned market is closed or sealed until at least then;
    - every floor holds on the Reach (`balanceOf`, or the native balance
      for address(0));
    - the consideration pays the hub's ERC-2981 receiver at least the
      royalty on the order's price (skipped when the receiver is zero).
  `validateOrder` (after the transfers) admits what `authorizeOrder`
  admitted: every floor again, and the hub's `residueOf(id)` — every
  fingerprint term a sale does not move — as it was at `publish` (V2 wave
  2, W6). An INTACT order that names no zone trades like any NFT, with
  none of these guarantees, and the viewer says so.

  Frozen after V2 wave 0: additive changes only, recorded in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

interface IBazaarEvents {
    /// @notice `side` OFFER: the order offers the NFT (a listing). CONSIDERATION:
    ///         it asks for it (a bid). `price` is the first consideration
    ///         item's currency summed over the consideration (a listing), or
    ///         the first offer item's amount (a bid), at startAmount; 0 when
    ///         the order mixes currencies.
    event Published(address indexed token, uint256 indexed identifier, bytes32 indexed orderHash, address offerer, Side side, ItemType itemType, address currency, uint256 price, uint256 endTime);
    event Pinned(bytes32 indexed zoneHash, uint256 indexed id, bytes32 fingerprint, uint256 floors);
    /// @notice SIP-5: emitted once, when a Seaport-compatible contract is
    ///         deployed. V2 wave 2 (W6), additive: the Bazaar's own copy moved here.
    event SeaportCompatibleContractDeployed();

    error NotSeaport();
    error NotValidated(bytes32 orderHash);
    error NoNFT();
    error NotRestricted();
    error NotIntact();
    error BadPin(bytes32 expected, bytes32 zoneHash);
    error FloorsWithoutZone();
    error TooManyFloors();
    error NotPinned(bytes32 zoneHash);
    error WrongToken(uint256 pinned, uint256 id);
    error FingerprintMoved(bytes32 expected, bytes32 actual);
    error ReachSealShort(uint64 sealedUntil, uint256 endTime);
    error MarketSealShort(uint64 sealUntil, uint256 endTime);
    error FloorBroken(address asset, uint256 balance, uint256 min);
    error RoyaltyShort(address receiver, uint256 paid, uint256 owed);
    error Reentrancy();
    /// @notice An INTACT order's priced side is not one currency: two
    ///         currencies, or an item that is not a currency. V2 wave 2 (W6),
    ///         additive: the Bazaar's own copy moved here.
    error Unpriced();
}

interface IBazaar is IBazaarEvents, ISeaportZone {
    /// @notice Validate `order` on Seaport and index it. `floors` must be
    ///         empty unless the order names this contract as its zone.
    function publish(Order calldata order, Floor[] calldata floors) external returns (bytes32 orderHash);
    /// @notice keccak256(abi.encode(address(this), id, fingerprint, floors)).
    function pinHash(uint256 id, bytes32 fingerprint, Floor[] calldata floors) external view returns (bytes32);
    function pinOf(bytes32 zoneHash) external view returns (uint256 id, bytes32 fingerprint, Floor[] memory floors);
    /// @notice What `authorizeOrder` would refuse an order carrying
    ///         `zoneHash` and ending at `endTime` with now — the error's
    ///         selector, or zero — leaving out the royalty, which needs the
    ///         order's consideration. For a page's "still good" line.
    function check(bytes32 zoneHash, uint256 endTime) external view returns (bytes4 refusal);
    function MAX_FLOORS() external view returns (uint256);   // 16
    function SEAPORT() external view returns (address);
    function HUB() external view returns (address);
    function POOL() external view returns (address);
}
