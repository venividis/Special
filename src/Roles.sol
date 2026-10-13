// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRoles} from "./interfaces/IRoles.sol";
import {IERC7432, IERC165} from "./interfaces/Standards.sol";
import {IIntact} from "./interfaces/IIntact.sol";

/*───────────────────────────────────────────────────────────────────────────
  Roles — ERC-7432 roles that lock the token instead of escrowing it

  Origin: ANIMA contracts/registry/AnimaRoles.sol, ADAPTED (BUILD-PLAN.md
  U16; DESIGN.md §2 "Role holder", §3 row 29). Kept from the donor: one
  registry for one collection (`UnsupportedCollection` for any other), the
  lock-not-escrow posture (the owner keeps the token in their own wallet,
  visible to every marketplace, and it cannot move while a role is live),
  a grantee who may always walk away, a dead record anyone may clear, and
  the permissionless `unlockToken` once nothing is live. Changed for INTACT:

  · Grants are strict `holds`: only `hub.ownerOf(tokenId)` grants. DESIGN
    §2 makes the holder the only one who grants and an operator someone who
    "may transfer only; never acts", so the donor's `setRoleApprovalForAll`
    path is closed: it reverts `ApprovalsUnsupported`, `isRoleApprovedForAll`
    is always false, and the frozen error name `NotOwnerOrApproved` is kept
    although only the owner ever passes it. The token's Reach does not
    either (`holds`, not `acts`): a role is a grant, like a session.
  · Revocable only. `revocable == false` reverts `IrrevocableUnsupported`:
    the donor's capped irrevocable term, its `lockedUntil` clock and its
    overwrite guard go with it, because a role the owner cannot end is a
    lock the owner cannot lift.
  · Every grant is stamped with the hub's custody epoch (`roleEpoch`), and
    a role is LIVE iff it has not expired AND its stamp equals the live
    epoch. Every view answers for live roles only: a stale or an expired
    role reads as absent (zero, empty, false) and never reverts. A sale
    cannot happen under a live role (the token is locked), so the epoch
    moves under a role only by `panic`, which therefore makes every role
    stale at once and leaves `unlockToken` to anyone (DESIGN §2).
  · The lock is ONE module lock on the hub, taken by the first grant on a
    token and released when the last live role goes, by `revokeRole` or by
    `unlockToken`, and never a second time: the role table is non-empty
    exactly while the lock is held, so `moduleUnlock` is called once per
    lock taken and the hub's `NotLocked` is never met.
  · `liveRoleCount` counts honestly, by walking the token's role ids and
    reading each one's expiry and stamp: expiry is a clock, not an event,
    so no counter can know it. The walk is bounded by MAX_ROLES distinct
    ids per token (`TooManyRoles` beyond); a revoke frees the slot and a
    release empties the table.
  · `hasAnyRole(tokenId, account)` (additive to IRoles) is the hub's
    `R_ROLE` read; `recipientOf(USER)` feeds its ERC-4907 shim.

  No admin, no owner, one immutable: the hub.
───────────────────────────────────────────────────────────────────────────*/
contract Roles is IRoles {
    /// @notice The role id the hub's ERC-4907 shim reads (IRoles, U0 choice).
    bytes32 public constant USER = keccak256("USER");
    /// @notice Distinct role ids a token may carry at once; bounds every walk.
    uint256 public constant MAX_ROLES = 16;
    /// @notice The one collection this registry speaks for.
    address public immutable HUB;

    struct Record {
        address recipient;        // slot 0, with the expiry
        uint64  expirationDate;
        uint64  epoch;            // slot 1: the custody epoch at grant
        bytes   data;             // slot 2
    }

    mapping(uint256 tokenId => mapping(bytes32 roleId => Record)) private _roles;
    /// @dev The role ids with a record, per token: non-empty exactly while
    ///      this module holds the hub's lock on that token.
    mapping(uint256 tokenId => bytes32[]) private _ids;

    constructor(address hub) {
        HUB = hub;
    }

    /*═══════════════════ writes ═══════════════════*/

    /// @inheritdoc IERC7432
    /// @dev The holder, and only the holder (DESIGN §2). One recipient per
    ///      (tokenId, roleId), as the standard keys it: a second grant of
    ///      the same id replaces the first. The first grant on a token
    ///      takes the hub's lock.
    function grantRole(Role calldata r) external {
        if (r.tokenAddress != HUB) revert UnsupportedCollection(r.tokenAddress);
        if (!r.revocable) revert IrrevocableUnsupported();
        if (r.recipient == address(0)) revert ZeroRecipient();
        if (r.expirationDate <= block.timestamp) revert ExpirationInThePast(r.expirationDate);
        address owner_ = IIntact(HUB).ownerOf(r.tokenId);            // NoSuchToken for an unminted id
        if (msg.sender != owner_) revert NotOwnerOrApproved(r.tokenId, msg.sender);

        bytes32[] storage ids = _ids[r.tokenId];
        Record storage rec = _roles[r.tokenId][r.roleId];
        if (rec.recipient == address(0)) {
            if (ids.length == MAX_ROLES) revert TooManyRoles(r.tokenId);
            if (ids.length == 0) {
                IIntact(HUB).moduleLock(r.tokenId);
                emit TokenLocked(owner_, HUB, r.tokenId);
            }
            ids.push(r.roleId);
        }
        rec.recipient = r.recipient;
        rec.expirationDate = r.expirationDate;
        rec.epoch = IIntact(HUB).custodyEpoch(r.tokenId);
        rec.data = r.data;
        emit RoleGranted(HUB, r.tokenId, r.roleId, owner_, r.recipient, r.expirationDate, true, r.data);
    }

    /// @inheritdoc IERC7432
    /// @dev A live role ends by its owner or its recipient; a dead record
    ///      (expired or stale) is anyone's to clear, as `unlockToken` is
    ///      anyone's to call. Revoking the last live role releases the lock.
    function revokeRole(address tokenAddress, uint256 tokenId, bytes32 roleId) external {
        if (tokenAddress != HUB) revert UnsupportedCollection(tokenAddress);
        Record storage rec = _roles[tokenId][roleId];
        if (rec.recipient == address(0)) return;
        if (_live(rec, tokenId) && msg.sender != rec.recipient && msg.sender != IIntact(HUB).ownerOf(tokenId)) {
            revert NotOwnerOrApproved(tokenId, msg.sender);
        }
        delete _roles[tokenId][roleId];
        bytes32[] storage ids = _ids[tokenId];
        uint256 last = ids.length - 1;
        for (uint256 i; i <= last; ++i) {
            if (ids[i] == roleId) {
                ids[i] = ids[last];
                ids.pop();
                break;
            }
        }
        emit RoleRevoked(HUB, tokenId, roleId);
        (uint256 live, ) = _liveCount(tokenId);
        if (live == 0) _release(tokenId);
    }

    /// @inheritdoc IERC7432
    /// @dev Permissionless. `StillLocked(tokenId, until)` names the latest
    ///      expiry among the live roles: the token frees itself then, or
    ///      sooner if they are revoked. `NotLocked` when this module holds
    ///      no lock on the token, so the hub is never asked to unlock at zero.
    function unlockToken(address tokenAddress, uint256 tokenId) external {
        if (tokenAddress != HUB) revert UnsupportedCollection(tokenAddress);
        if (_ids[tokenId].length == 0) revert NotLocked(tokenId);
        (uint256 live, uint64 until) = _liveCount(tokenId);
        if (live != 0) revert StillLocked(tokenId, until);
        _release(tokenId);
    }

    /// @inheritdoc IERC7432
    /// @dev DESIGN §2: an operator "may transfer only; never acts". There
    ///      is no role operator in v1, so nothing is recorded and nobody
    ///      but the owner ever grants.
    function setRoleApprovalForAll(address, address, bool) external pure {
        revert ApprovalsUnsupported();
    }

    /// @dev Everything in the token's table goes with the lock: the live
    ///      roles are gone already, and a dead record has nothing to say.
    function _release(uint256 tokenId) private {
        bytes32[] storage ids = _ids[tokenId];
        for (uint256 i = ids.length; i != 0; --i) delete _roles[tokenId][ids[i - 1]];
        delete _ids[tokenId];
        IIntact(HUB).moduleUnlock(tokenId);
        emit TokenUnlocked(IIntact(HUB).ownerOf(tokenId), HUB, tokenId);
    }

    /*═══════════════════ reads ═══════════════════*/

    /// @dev Not expired, and stamped with the epoch given. An empty record
    ///      has expiry zero and is never live.
    function _liveAt(Record storage r, uint64 epoch) private view returns (bool) {
        return r.expirationDate > block.timestamp && r.epoch == epoch;
    }

    function _live(Record storage r, uint256 tokenId) private view returns (bool) {
        return _liveAt(r, IIntact(HUB).custodyEpoch(tokenId));
    }

    /// @dev The live roles on a token and the latest of their expiries; the
    ///      epoch is read once for the walk.
    function _liveCount(uint256 tokenId) private view returns (uint256 live, uint64 until) {
        bytes32[] storage ids = _ids[tokenId];
        uint64 epoch = IIntact(HUB).custodyEpoch(tokenId);
        for (uint256 i; i < ids.length; ++i) {
            Record storage r = _roles[tokenId][ids[i]];
            if (_liveAt(r, epoch)) {
                ++live;
                if (r.expirationDate > until) until = r.expirationDate;
            }
        }
    }

    /// @dev One lookup for the ERC-7432 views: the record, and whether it
    ///      is ours and live. A foreign collection, a stale role and an
    ///      expired role all read as absent.
    function _lookup(address tokenAddress, uint256 tokenId, bytes32 roleId)
        private view returns (Record storage r, bool live)
    {
        r = _roles[tokenId][roleId];
        live = tokenAddress == HUB && _live(r, tokenId);
    }

    /// @dev No record ever names address(0) and an empty record is never live,
    ///      so a zero account reads false without a guard of its own.
    function hasRole(uint256 tokenId, bytes32 roleId, address account) external view returns (bool) {
        Record storage r = _roles[tokenId][roleId];
        return r.recipient == account && _live(r, tokenId);
    }

    /// @notice Any live role for `account` on `tokenId`: the hub's `R_ROLE`.
    function hasAnyRole(uint256 tokenId, address account) external view returns (bool) {
        bytes32[] storage ids = _ids[tokenId];
        uint64 epoch = IIntact(HUB).custodyEpoch(tokenId);
        for (uint256 i; i < ids.length; ++i) {
            Record storage r = _roles[tokenId][ids[i]];
            if (r.recipient == account && _liveAt(r, epoch)) return true;
        }
        return false;
    }

    function liveRoleCount(uint256 tokenId) external view returns (uint256 live) {
        (live, ) = _liveCount(tokenId);
    }

    /// @notice The custody epoch a grant was stamped with, live or not (zero
    ///         when there is no record): a page compares it with the hub's.
    function roleEpoch(uint256 tokenId, bytes32 roleId) external view returns (uint64) {
        return _roles[tokenId][roleId].epoch;
    }

    /// @inheritdoc IERC7432
    /// @dev Lock, not escrow: the owner is the hub's owner, always.
    function ownerOf(address tokenAddress, uint256 tokenId) external view returns (address) {
        if (tokenAddress != HUB) revert UnsupportedCollection(tokenAddress);
        return IIntact(HUB).ownerOf(tokenId);
    }

    /// @inheritdoc IERC7432
    function recipientOf(address tokenAddress, uint256 tokenId, bytes32 roleId) external view returns (address) {
        (Record storage r, bool live) = _lookup(tokenAddress, tokenId, roleId);
        return live ? r.recipient : address(0);
    }

    /// @inheritdoc IERC7432
    function roleData(address tokenAddress, uint256 tokenId, bytes32 roleId) external view returns (bytes memory) {
        (Record storage r, bool live) = _lookup(tokenAddress, tokenId, roleId);
        if (!live) return "";
        return r.data;
    }

    /// @inheritdoc IERC7432
    function roleExpirationDate(address tokenAddress, uint256 tokenId, bytes32 roleId) external view returns (uint64) {
        (Record storage r, bool live) = _lookup(tokenAddress, tokenId, roleId);
        return live ? r.expirationDate : 0;
    }

    /// @inheritdoc IERC7432
    /// @dev Every role here is revocable, so this is "is there a live role".
    function isRoleRevocable(address tokenAddress, uint256 tokenId, bytes32 roleId) external view returns (bool) {
        (, bool live) = _lookup(tokenAddress, tokenId, roleId);
        return live;
    }

    /// @inheritdoc IERC7432
    function isRoleApprovedForAll(address, address, address) external pure returns (bool) {
        return false;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC7432).interfaceId
            || interfaceId == type(IRoles).interfaceId
            || interfaceId == type(IERC165).interfaceId;
    }
}
