// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILocks, Lock} from "./interfaces/ILocks.sol";
import {IIntact} from "./interfaces/IIntact.sol";
import {Ratchet} from "./lib/Ratchet.sol";
import {Transient} from "./lib/Transient.sol";
import {ExactERC20} from "./lib/ExactERC20.sol";
import {AccountBinding} from "./lib/AccountBinding.sol";

/*───────────────────────────────────────────────────────────────────────────
  Locks — the vault where a promise is kept by the clock

  Origin: MASTER contracts/src/protocol/TimeVault.sol, ADAPTED (BUILD-PLAN.md
  U5; DESIGN.md §3 row 25, §9.3): custom errors in place of the `Unauthorized`
  catch-all, the `ledger.record` world-ledger dropped with its `identity`
  field, `ProtocolAssets` replaced by INTACT's `ExactERC20`, the storage
  re-entrancy flag replaced by the registered transient slot, the ten-year
  cap routed through the one `Ratchet` rule, and `give` from IPSEITY
  src/Locker.sol:126 added so a lock can be handed INTO a token's Reach.

  "The team's tokens are locked for two years" is the most broken promise in
  this industry, because it is usually kept by a multisig, a spreadsheet, or
  nothing. This contract keeps it the only way a contract can: the assets
  sit here, the schedule is written once, and there is no function that
  ends a lock early — not for the depositor, not for the beneficiary, not
  for a curator, because no such function exists to call.

  ── the beneficiary is fixed, and that is the feature ──

  MASTER's insight, kept whole: a lock whose beneficiary is an NFT's account
  makes the right follow the NFT. Selling the token sells the claim; it
  cannot accelerate the schedule. The page defaults `beneficiary` to
  `account(id)` so a locked treasury travels with the token, and the
  fingerprint reads `commitmentOf(account(id))` so a buyer's order pins
  exactly which locks they are buying. `release` is permissionless and pays
  ONLY the committed beneficiary: a claim that needs the beneficiary alive,
  watching and holding gas on the right day is a claim that rots.

  ── what arrives is what is recorded ──

  Pulls are exact (`ExactERC20`): a fee-on-transfer token that delivers
  less than asked is refused outright rather than recorded short, so this
  vault never promises more than it holds. Rebasing tokens are not
  accounted for and the page says so. Native value is accepted by exact
  `msg.value` and nothing else.

  ── one direction for every clock ──

  `extend` only lengthens, through `Ratchet.raise` with the 10-year cap —
  the same rule as every seal in INTACT, so the page prints one sentence.
  A lock whose end has passed cannot be extended: that would be a new
  promise wearing an old id, and a new promise is a new lock. `give` moves
  the claim only into a canonical Reach of this collection, verified by
  CREATE2 and codehash through the hub, never by a contract's own word.
───────────────────────────────────────────────────────────────────────────*/
contract Locks is ILocks {
    /// @notice The hub whose Reaches are the only destinations `give` admits.
    address public immutable HUB;
    /// @notice Ten years, the ceiling on every lock (`Ratchet.LOCK_CAP`).
    uint64 public constant MAX_TERM = Ratchet.LOCK_CAP;

    uint256 public lockCount;
    mapping(uint256 => Lock) private _locks;
    /// @notice What this vault owes per asset — the number a page cites when
    ///         it says "locked", and the floor its balance must never dip under.
    mapping(address => uint256) public liability;
    mapping(address => bytes32) private _commitment;
    mapping(address => uint256[]) private _of;

    constructor(address hub) {
        if (hub == address(0)) revert ZeroAddress();
        HUB = hub;
    }

    modifier nonReentrant() {
        Transient.enter(Transient.LOCKS_LOCK);
        _;
        Transient.exit(Transient.LOCKS_LOCK);
    }

    /*═══════════════════ locking ═══════════════════*/

    /// @notice Lock `amount` of `asset` (address(0) = native) for
    ///         `beneficiary`, releasable from `cliff` and fully by `end`;
    ///         `linear` vests between `start` and `end`, otherwise the whole
    ///         amount unlocks at `cliff == end`.
    function lock(
        address asset, uint112 amount, address beneficiary,
        uint64 start, uint64 cliff, uint64 end, bool linear
    ) external payable nonReentrant returns (uint256 id) {
        if (beneficiary == address(0) || beneficiary == address(this)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (start == 0) start = uint64(block.timestamp);
        if (cliff == 0) cliff = start;
        /*  `end` is the time promise, so it goes through the one rule: in
            the future, and no further than the cap. The relations between
            the three dates are a schedule question, not a ratchet one.  */
        end = Ratchet.raise(0, end, MAX_TERM);
        if (start < block.timestamp || cliff < start || end <= start || end < cliff || (!linear && cliff != end)) {
            revert UnsupportedSchedule();
        }
        if (asset == address(0)) {
            if (msg.value != amount) revert WrongValue();
        } else {
            if (msg.value != 0) revert WrongValue();
            ExactERC20.transferFromExact(asset, msg.sender, address(this), amount);
        }

        id = ++lockCount;
        _locks[id] = Lock(msg.sender, beneficiary, asset, amount, 0, start, cliff, end, linear);
        _of[beneficiary].push(id);
        liability[asset] += amount;
        _touch(id, beneficiary);
        emit Locked(id, beneficiary, asset, msg.sender, amount, start, cliff, end, linear);
    }

    /// @notice How much the schedule has vested that has not yet been paid.
    function releasable(uint256 id) public view returns (uint256) {
        Lock storage l = _locks[id];
        if (l.amount == 0 || block.timestamp < l.cliff) return 0;
        uint256 vested = block.timestamp >= l.end
            ? l.amount
            : l.linear ? uint256(l.amount) * (block.timestamp - l.start) / (l.end - l.start) : 0;
        return vested > l.released ? vested - l.released : 0;
    }

    /// @notice Anyone may trigger a release; the recipient is ALWAYS the
    ///         committed beneficiary.
    function release(uint256 id) external nonReentrant returns (uint256 amount) {
        amount = releasable(id);
        if (amount == 0) revert NothingReleasable();
        Lock storage l = _locks[id];
        l.released += uint112(amount);
        liability[l.asset] -= amount;
        address to = l.beneficiary;
        address asset = l.asset;
        _touch(id, to);
        if (asset == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            ExactERC20.transferExact(asset, to, amount);
        }
        emit Released(id, to, amount);
    }

    /// @notice Push the end further out. Never nearer — lengthening a
    ///         promise breaks faith with nobody, and only lengthening. A
    ///         cliff lock's cliff moves with its end; a linear lock keeps
    ///         its start, so the slope flattens and nothing already released
    ///         is clawed back (releasable simply pauses until the new line
    ///         catches up).
    function extend(uint256 id, uint64 newEnd) external {
        Lock storage l = _locks[id];
        if (msg.sender != l.beneficiary) revert NotBeneficiary();
        /*  A kept promise cannot be lengthened: once `end` has passed the
            amount is vested in full and re-locking it would be a new lock
            under an old id, which is what `lock` is for.                 */
        if (block.timestamp >= l.end) revert UnsupportedSchedule();
        uint64 previous = l.end;
        l.end = Ratchet.raise(previous, newEnd, MAX_TERM);
        if (!l.linear) l.cliff = l.end;
        _touch(id, l.beneficiary);
        emit Extended(id, previous, l.end);
    }

    /// @notice A lock is a position, and a position can change hands — only
    ///         into a token's own Reach, so a locked treasury travels with
    ///         the token when the token is sold. The dates do not move; only
    ///         the name on the claim does.
    /// @dev    The old beneficiary's index keeps its entry; `lockIdOf` is a
    ///         finding aid, the `beneficiary` field is the truth and the
    ///         page filters by reading the lock itself (IPSEITY Locker).
    ///         Both commitments move, since both estates changed.
    function give(uint256 id, address newBeneficiary) external {
        Lock storage l = _locks[id];
        address from = l.beneficiary;
        if (msg.sender != from) revert NotBeneficiary();
        if (!_isCanonicalReach(newBeneficiary)) revert NotCanonicalReach(newBeneficiary);
        _touch(id, from);
        l.beneficiary = newBeneficiary;
        _of[newBeneficiary].push(id);
        _touch(id, newBeneficiary);
        emit Given(id, from, newBeneficiary);
    }

    /*═══════════════════ reading ═══════════════════*/

    /// @notice The rolling hash of every change to every lock this
    ///         beneficiary holds — what `getStateFingerprint` reads for
    ///         `account(id)`, so a buyer's pinned fingerprint covers the
    ///         vault that travels with the token.
    function commitmentOf(address beneficiary) external view returns (bytes32) {
        return _commitment[beneficiary];
    }

    function lockOf(uint256 id) external view returns (Lock memory) { return _locks[id]; }
    function lockCountOf(address beneficiary) external view returns (uint256) { return _of[beneficiary].length; }
    function lockIdOf(address beneficiary, uint256 index) external view returns (uint256) { return _of[beneficiary][index]; }

    /*═══════════════════ internals ═══════════════════*/

    function _touch(uint256 id, address beneficiary) private {
        _commitment[beneficiary] = keccak256(abi.encode(_commitment[beneficiary], id, _locks[id]));
    }

    /// @dev A Reach is whatever CREATE2 says it is: the 173-byte forwarder
    ///      footer names a chain, a collection and an id, and the hub then
    ///      recomputes the address and checks the codehash. A contract that
    ///      merely answers `token()` is never believed.
    function _isCanonicalReach(address candidate) private view returns (bool) {
        (uint256 chain, address collection, uint256 id) = AccountBinding.token(candidate);
        if (chain != block.chainid || collection != HUB) return false;
        return IIntact(HUB).isCanonicalAccount(candidate, id, false);
    }
}
