// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMarket, Floor, Listing} from "./interfaces/IMarket.sol";
import {IIntact} from "./interfaces/IIntact.sol";
import {IReach} from "./interfaces/IReach.sol";
import {IPool, Market as OwnedMarket} from "./interfaces/IPool.sol";
import {IERC20} from "./interfaces/Standards.sol";
import {Transient} from "./lib/Transient.sol";

/*───────────────────────────────────────────────────────────────────────────
  Market — listing is a seal

  Origin (BUILD-PLAN.md U15; DESIGN.md §3 row 28, §11.3, §15.28): ANIMA
  contracts/market/AgentMarket.sol:238-274, the fingerprint pin and the
  deliver-before-pay order its MaliciousSeller regression forced; IPSEITY
  src/Consign.sol, the `owed` ledger that is credited and never pushed;
  Pixel-Garden EstateCartridge.inventoryDigest, up to sixty-four balance
  floors read from the chain and read again after the token has moved. NEW
  for INTACT: a listing exists only under both seals, holds the hub's
  module lock for its whole life, and dies by the custody epoch.

  An Intact is not a picture. Between the moment a buyer decides and the
  moment the fill lands, the seller can empty the Reach, grant a key that
  outlives the sale, or pull the owned market's reserves — and on a venue
  that checks only `ownerOf` the fill still succeeds. So nothing here is
  promised by the venue; everything is read from the chain at the fill:

    the seals      `list` is refused unless the Reach's seal and, when the
                   owned market is open, the market's seal both reach
                   `expiresAt`. A seal is a ratchet that survives the
                   sale (B4, C3), so what the buyer saw cannot leave
                   before the listing ends — not by the seller, not by a
                   session key, not by an operator.
    the fingerprint `hub.getStateFingerprint(id)` (ERC-5646 over the
                   Core, the traits, the Reach's state, seal and
                   approval ledger, the market, the locks, the launches
                   and the plan) is pinned when the order is posted and
                   recomputed at the fill. Anything that moved refuses
                   the sale; the buyer re-reads and decides again.
    the floors     a seller commits to what the Reach will hold — ether,
                   or an ERC-20 the seal does not cover — and the Market
                   measures each floor before the payment is credited and
                   again after the token has moved. An asset that does
                   not answer reads as zero: no answer is not a balance.
    the epoch      the listing stores the custody epoch it was posted
                   under and compares it live, so a panic, a steward move
                   or any other custody change makes it `Stale` without
                   anyone having to clear it.

  Deliver, then pay — and pay by ledger. The donor's seller was paid by a
  push while still `ownerOf`, and used the callback to hollow the agent
  out. Here the seller is paid nothing during the fill: the royalty and the
  proceeds are credited to `owed`, the token moves through the hub's own
  `moduleTransfer` (whose `_update` bumps the epoch and strips every
  seller authority), and the seller pulls later, as whoever they are by
  then. A seller whose wallet reverts on receipt wedges nobody's sale.

  ── the cost, stated plainly ──

  A listed token is locked. The holder cannot move it, approve it away or
  have the steward move it until `delist`; that is what offering it means.
  And the fingerprint is strict: a trade on the owned market, a seal
  lengthened, a trait set — any of them refuses the fill until the seller
  relists and the buyer reads again. That is the price of a promise the
  chain keeps instead of the venue.

  ── what this contract has no function to do ──

  There is no owner, no fee, no pause, no setter and no upgrade: two
  immutables and two constants. No function here reaches the Reach, the
  Grip or any asset except to read a balance. The only call that moves a
  token is the hub's `moduleTransfer`, which the hub accepts from this
  address alone and routes through the same sealed `_update` as every
  other transfer: a transfer seal, a guardian hold or another module's
  lock stops a sale exactly as it stops a transfer. Money leaves only
  through `claim`, to the caller, for what the ledger says.
───────────────────────────────────────────────────────────────────────────*/
contract Market is IMarket {
    /// @notice A pin was zero at construction.
    error ZeroAddress();

    address public immutable HUB;
    address public immutable POOL;

    /// @dev Pixel-Garden's bound on an inventory: enough for any real
    ///      manifest, few enough that a fill cannot be made to run out of gas.
    uint256 public constant MAX_FLOORS = 64;
    /// @dev The seal cap (Ratchet.SEAL_CAP): a listing can never outlast
    ///      the longest seal that could cover it.
    uint64 public constant MAX_LISTING = 365 days;

    mapping(uint256 => Listing) private _listing;
    /// @notice What a sale left for a payee. Pull, never push.
    mapping(address => uint256) public owed;

    constructor(address hub, address pool) {
        if (hub == address(0) || pool == address(0)) revert ZeroAddress();
        HUB = hub;
        POOL = pool;
    }

    /*═══════════════════ the one lock ═══════════════════*/

    /// @dev Every door, including the ones that move no ether (the Pool's
    ///      discipline, C2). A revert anywhere under it releases it through
    ///      the transient journal; `exit` is for the success path.
    modifier locked() {
        Transient.enter(Transient.MARKET_LOCK);
        _;
        Transient.exit(Transient.MARKET_LOCK);
    }

    /*═══════════════════ listing ═══════════════════*/

    /// @notice Offer the token at `price` until `expiresAt`, pinned to the
    ///         fingerprint the seller read and to what the Reach will hold.
    /// @dev    Strict `holds` (DESIGN.md §2): never the Reach, never an
    ///         operator, never a renter. The fingerprint presented is checked
    ///         against the chain BEFORE the lock, so a seller lists what they
    ///         saw; the fingerprint pinned for the buyer is read AFTER the
    ///         lock, because the lock count is part of the Core the
    ///         fingerprint covers. `OrderPosted` carries the pinned one.
    function list(uint256 id, uint256 price, uint64 expiresAt, bytes32 fingerprint, Floor[] calldata floors)
        external locked
    {
        IIntact hub = IIntact(HUB);
        if (hub.ownerOf(id) != msg.sender) revert NotHolder();
        if (expiresAt <= block.timestamp || expiresAt > block.timestamp + MAX_LISTING) revert BadExpiry();
        if (floors.length > MAX_FLOORS) revert TooManyFloors();
        Listing storage l = _listing[id];
        if (l.seller != address(0)) revert AlreadyListed(id);

        /*  Both seals, or no listing. The Reach's seal is the buyer's
            guarantee over the manifest; the market's seal is the guarantee
            over the reserves and terms, and is required only while there is
            an owned market to guarantee. Each must outlast the listing.  */
        address reach = hub.account(id);
        uint64 reachUntil = IReach(reach).sealedUntil();
        OwnedMarket memory m = IPool(POOL).marketOf(id);
        if (reachUntil < expiresAt || (m.open && m.sealUntil < expiresAt)) {
            revert SealsTooShort(reachUntil, m.sealUntil, expiresAt);
        }

        bytes32 live = hub.getStateFingerprint(id);
        if (fingerprint != live) revert FingerprintMoved(fingerprint, live);
        // a floor the Reach does not meet today is not a promise, it is a typo
        for (uint256 i; i < floors.length; ++i) _requireFloor(reach, floors[i]);

        l.seller = msg.sender;
        l.price = price;
        l.expiresAt = expiresAt;
        l.epoch = hub.custodyEpoch(id);
        for (uint256 i; i < floors.length; ++i) l.floors.push(floors[i]);

        hub.moduleLock(id);
        bytes32 pinned = hub.getStateFingerprint(id);
        l.fingerprint = pinned;
        emit OrderPosted(id, msg.sender, price, expiresAt, pinned);
    }

    /// @notice Take the offer down and release the lock.
    /// @dev    A live listing is the holder's to end. A dead one — expired,
    ///         or stale because the custody epoch moved under it — anyone
    ///         may clear: nothing can ever buy it, and its lock only hurts
    ///         whoever holds the token now (the Steward's rule for a void
    ///         plan, DESIGN.md §9.4). An heir, in particular, must not wait
    ///         for ever on a listing a lost key posted.
    function delist(uint256 id) external locked {
        Listing storage l = _listing[id];
        if (l.seller == address(0)) revert NotListed(id);
        IIntact hub = IIntact(HUB);
        bool live = block.timestamp < l.expiresAt && l.epoch == hub.custodyEpoch(id);
        if (live && hub.ownerOf(id) != msg.sender) revert NotHolder();
        delete _listing[id];
        hub.moduleUnlock(id);
        emit Delisted(id);
    }

    /*═══════════════════ the fill ═══════════════════*/

    /// @notice Buy the token at the price you agreed to, against the
    ///         fingerprint you read. Exact value, exact price, exact state.
    /// @dev    The order of the refusals is the order a page should check
    ///         them in: listed, in time, same custody, same price, same
    ///         fingerprint, every floor standing. Then the ledger, the
    ///         unlock, the move, and the floors once more — Pixel-Garden's
    ///         lesson, kept although no callback runs between the two reads
    ///         here: a rule that costs one loop is cheaper than the day a
    ///         hub grows a hook.
    function buy(uint256 id, uint256 agreed, bytes32 fingerprint) external payable locked {
        Listing storage l = _listing[id];
        address seller = l.seller;
        if (seller == address(0)) revert NotListed(id);
        uint64 expiresAt = l.expiresAt;
        if (block.timestamp >= expiresAt) revert Expired(expiresAt);
        IIntact hub = IIntact(HUB);
        if (l.epoch != hub.custodyEpoch(id)) revert Stale(id);
        uint256 price = l.price;
        if (agreed != price) revert WrongPrice(price, agreed);
        if (msg.value != price) revert WrongPrice(price, msg.value);
        bytes32 pinned = l.fingerprint;
        if (fingerprint != pinned) revert FingerprintMoved(pinned, fingerprint);
        bytes32 live = hub.getStateFingerprint(id);
        if (live != pinned) revert FingerprintMoved(pinned, live);
        address reach = hub.account(id);
        Floor[] memory floors = l.floors;
        _requireFloors(reach, floors);

        /*  The collection's royalty comes out of the price first, before the
            seller's share is computed — a venue that quietly skips it is why
            on-chain royalties stopped meaning anything. The hub bounds it at
            5 %; were it ever larger than the price the subtraction would
            revert and the sale fail closed rather than the ledger overdraw. */
        (address receiver, uint256 royalty) = hub.royaltyInfo(id, price);
        if (receiver == address(0)) royalty = 0;
        if (royalty != 0) owed[receiver] += royalty;
        owed[seller] += price - royalty;

        delete _listing[id];
        hub.moduleUnlock(id);
        hub.moduleTransfer(id, msg.sender);          // the epoch moves; every seller authority dies
        _requireFloors(reach, floors);
        emit Sold(id, seller, msg.sender, price, royalty);
    }

    /// @notice Pull what the ledger owes the caller. Zeroed before the send.
    function claim() external locked {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();
        owed[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Claimed(msg.sender, amount);
    }

    /*═══════════════════ reading ═══════════════════*/

    function listingOf(uint256 id) external view returns (Listing memory) {
        return _listing[id];
    }

    /*═══════════════════ the floors ═══════════════════*/

    function _requireFloors(address reach, Floor[] memory floors) private view {
        for (uint256 i; i < floors.length; ++i) _requireFloor(reach, floors[i]);
    }

    /// @dev `address(0)` is ether: the Reach's own balance. Anything else is
    ///      asked `balanceOf` through a guarded staticcall — `extcodesize`
    ///      and a low-level call, so a codeless or reverting asset reads as
    ///      zero and fails the floor instead of reverting the fill with a
    ///      foreign error, and a staticcall so no asset can re-enter.
    function _requireFloor(address reach, Floor memory f) private view {
        uint256 actual = f.asset == address(0) ? reach.balance : _balanceOf(f.asset, reach);
        if (actual < f.min) revert FloorBroken(f.asset, f.min, actual);
    }

    function _balanceOf(address asset, address who) private view returns (uint256 v) {
        if (asset.code.length == 0) return 0;
        (bool ok, bytes memory ret) = asset.staticcall(abi.encodeCall(IERC20.balanceOf, (who)));
        if (ok && ret.length == 32) v = abi.decode(ret, (uint256));
    }
}
