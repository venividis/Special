// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactBase} from "./IntactBase.sol";
import {IntactStorage} from "./IntactStorage.sol";
import {Core, Status} from "../interfaces/IIntact.sol";
import {IReach} from "../interfaces/IReach.sol";
import {ERC721Minimal} from "../vendor/ERC721Minimal.sol";
import {Ratchet} from "../lib/Ratchet.sol";
import {AccountBinding} from "../lib/AccountBinding.sol";
import {
    IERC165, IERC721, IERC721Metadata, IERC721Enumerable, IERC2981, IERC4907, IERC5169,
    IERC5192, IERC5646, IERC6454, IERC721MultiMetadata, IERC7496, IERC7572
} from "../interfaces/Standards.sol";

/*───────────────────────────────────────────────────────────────────────────
  CoreLogic — the ERC-721 face, the approval store, custody and locks

  DESIGN.md §3 row 2. Origin: IPSEITY src/Ipseity.sol (ownership and the
  per-owner index, `isTransferable` in terms of one flag) and ANIMA
  contracts/diamond/AnimaCoreFacet.sol (timed operators, `revokeAllApprovals`
  in O(1), counted module locks), adapted for INTACT U1 with three things
  that are new: the guardian hold and its `release`, `panic`, and the two
  module-only transfer entries (`stewardTransfer`, `moduleTransfer`) that
  go through the sealed `_update` like any other move.

  Everything a marketplace, wallet or indexer touches lives here; what makes
  it INTACT-shaped is `IntactBase._update`, which no entry point below can
  avoid. Locking is enforced there, not here, so a token cannot be moved
  through some other facet's door while a module holds it.
───────────────────────────────────────────────────────────────────────────*/
abstract contract CoreLogic is IntactBase {
    using ERC721Minimal for ERC721Minimal.Store;

    /*═══════════════════ ERC-721 / Metadata / Enumerable-lite ═══════════════════*/

    function name() external pure returns (string memory) { return "INTACT"; }
    function symbol() external pure returns (string memory) { return "INTACT"; }

    function balanceOf(address owner_) external view returns (uint256) {
        return _s().nft.balanceOf(owner_);
    }

    function ownerOf(uint256 id) external view returns (address) {
        return _s().nft.ownerOf(id);
    }

    function getApproved(uint256 id) external view returns (address) {
        IntactStorage.Layout storage $ = _s();
        $.nft.ownerOf(id);
        return $.nft.approved[id];
    }

    function approve(address to, uint256 id) external {
        IntactStorage.Layout storage $ = _s();
        address owner_ = $.nft.ownerOf(id);
        if (msg.sender != owner_ && !isApprovedForAll(owner_, msg.sender)) revert NotAuthorized();
        $.nft.approved[id] = to;
        emit Approval(owner_, to, id);
    }

    /// @dev Routed through the timed store so `revokeAllApprovals` reaches
    ///      it. An unbounded grant is recorded as `type(uint64).max`.
    function setApprovalForAll(address operator, bool approved) external {
        _setTimedApproval(msg.sender, operator, approved ? type(uint64).max : 0);
    }

    function transferFrom(address from, address to, uint256 id) public {
        if (_s().nft.owner[id] != from) revert NotHolder();
        _update(to, id, msg.sender);
    }

    function safeTransferFrom(address from, address to, uint256 id) external {
        safeTransferFrom(from, to, id, "");
    }

    /// @dev The receiver check runs LAST, after every write, so a contract
    ///      that re-enters from the callback sees a complete token.
    function safeTransferFrom(address from, address to, uint256 id, bytes memory data) public {
        transferFrom(from, to, id);
        ERC721Minimal.checkOnERC721Received(msg.sender, from, to, id, data);
    }

    function totalSupply() external view returns (uint256) {
        return _s().minted;
    }

    function tokenOfOwnerByIndex(address owner_, uint256 index) external view returns (uint256) {
        return _s().nft.tokenOfOwnerByIndex(owner_, index);
    }

    /// @dev Ids are contiguous from _BAND_LO and never reused, so the global
    ///      index is arithmetic — the "lite" reading of ERC-721Enumerable.
    function tokenByIndex(uint256 index) external view returns (uint256) {
        if (index >= _s().minted) revert ERC721Minimal.BadIndex();
        return _BAND_LO + index;
    }

    /*═══════════════════ epoch-keyed approvals (DESIGN §2) ═══════════════════*/

    /*  ERC-721's `setApprovalForAll` is unbounded in time, unbounded in
        scope, and not enumerable on chain: a grant made to a marketplace in
        2021 is still live in 2026 and nobody can list what they have
        outstanding. ICRC-37 and CW-721 arrived independently at the fix —
        an expiry on every approval and a batch revoke. `setApprovalForAll`
        keeps its signature and semantics because breaking it would break
        every marketplace; what is added is a timed form and an O(1)
        revoke-all. Enumeration is left to the events.                   */

    function approvalEpoch(address owner_) external view returns (uint64) {
        return _s().approvalEpoch[owner_];
    }

    /// @notice Approve an operator only until `expiresAt`; zero revokes.
    function setApprovalForAllUntil(address operator, uint64 expiresAt) external {
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert Expired();
        _setTimedApproval(msg.sender, operator, expiresAt);
    }

    /// @notice Revoke every operator approval this caller ever granted, in one write.
    function revokeAllApprovals() external {
        uint64 next = ++_s().approvalEpoch[msg.sender];
        emit AllApprovalsRevoked(msg.sender, next);
    }

    /// @notice When an operator's approval lapses: zero means none,
    ///         `type(uint64).max` an unbounded ERC-721 grant.
    function approvalExpiryOf(address owner_, address operator) external view returns (uint64) {
        return _s().operatorUntil[_approvalKey(owner_, operator)];
    }

    /*═══════════════════ custody, locks, seals (DESIGN §2, §4.4) ═══════════════════*/

    function custodyEpoch(uint256 id) external view returns (uint64) {
        return _s().core[id].custodyEpoch;
    }

    /// @notice ERC-5192. Temporary and purposeful, never soulbinding: a
    ///         token is immovable exactly while a pinned module holds it
    ///         or a guardian has it under hold.
    function locked(uint256 id) external view returns (bool) {
        _s().nft.ownerOf(id);
        return _locked(id);
    }

    /// @notice ERC-6454: the question a marketplace asks before offering a
    ///         fill it would otherwise watch revert. Written in terms of the
    ///         same rules `_update` enforces, so the two never disagree.
    function isTransferable(uint256 id, address from, address to) external view returns (bool) {
        if (to == address(0)) return false;               // nothing is burned here
        if (from == address(0)) return true;              // minting is always allowed
        address owner_ = _s().nft.owner[id];
        if (owner_ == address(0) || owner_ != from) return false;
        if (_locked(id)) return false;
        if (_s().core[id].transferSealUntil > block.timestamp) return false;
        return !_isCanonicalRecipient(id, to);
    }

    /// @notice Hold the token on behalf of a module. Counted, not boolean: a
    ///         token can owe two modules at once and the first release must
    ///         not free it from the second.
    function moduleLock(uint256 id) external {
        if (!_isModule(msg.sender)) revert NotModule();
        IntactStorage.Layout storage $ = _s();
        $.nft.ownerOf(id);
        Core storage c = $.core[id];
        bool was = _locked(id);
        c.lockCount += 1;
        emit ModuleLocked(id, msg.sender, c.lockCount);
        if (!was) emit Locked(id);
    }

    /// @dev Unlocking at zero reverts rather than returning: a module that
    ///      believes it holds a lock it does not hold has a bug, and a
    ///      silent return would let that bug ship (ANIMA's returned).
    function moduleUnlock(uint256 id) external {
        if (!_isModule(msg.sender)) revert NotModule();
        Core storage c = _s().core[id];
        if (c.lockCount == 0) revert NotLocked();
        c.lockCount -= 1;
        emit ModuleUnlocked(id, msg.sender, c.lockCount);
        if (!_locked(id)) emit Unlocked(id);
    }

    /// @notice The holder's own ratchet: the token will not move before
    ///         `until`, by anyone, including the steward and the market.
    function sealTransfer(uint256 id, uint64 until) external {
        _requireHolds(id);
        Core storage c = _s().core[id];
        c.transferSealUntil = Ratchet.raise(c.transferSealUntil, until, Ratchet.SEAL_CAP);
        emit TransferSealed(id, until);
        emit MetadataUpdate(id);
        emit ClearPathCache(_paths(id));
    }

    function transferSealUntil(uint256 id) external view returns (uint64) {
        return _s().core[id].transferSealUntil;
    }

    /// @notice The steward's one power: move a token whose plan matured.
    ///         Through the sealed path, so an heir waits out a seal and a
    ///         lock held by another module.
    function stewardTransfer(uint256 id, address to) external {
        if (msg.sender != _STEWARD) revert NotSteward();
        _update(to, id, address(0));
    }

    /// @notice The market's settlement move, likewise.
    function moduleTransfer(uint256 id, address to) external {
        if (msg.sender != _MARKET) revert NotMarket();
        _update(to, id, address(0));
    }

    /*═══════════════════ panic (DESIGN §2) ═══════════════════*/

    /// @notice One call kills every delegated right. By the holder: both
    ///         epochs move — their own choice to drop every operator on
    ///         every token they hold. By the guardian: the custody epoch
    ///         moves and the token goes under hold, so that a per-token
    ///         guardian never revokes the owner's operators on unrelated
    ///         tokens; under hold only the holder in person may move it,
    ///         until `release`. Both forms seal the Reach to its maximum,
    ///         revoke its sessions, pause the token and clear the single
    ///         approval, the user and the agent wallet. The guardian stays:
    ///         a safety role is appointed, not delegated.
    function panic(uint256 id) external {
        IntactStorage.Layout storage $ = _s();
        address owner_ = $.nft.ownerOf(id);
        Core storage c = $.core[id];
        bool byHolder = msg.sender == owner_;
        if (!byHolder && (c.guardian == address(0) || msg.sender != c.guardian)) revert NotAuthorized();

        c.custodyEpoch += 1;
        if (byHolder) {
            uint64 next = ++$.approvalEpoch[msg.sender];
            emit AllApprovalsRevoked(msg.sender, next);
        } else if (!c.guardianHold) {
            bool was = _locked(id);
            c.guardianHold = true;
            emit GuardianHoldSet(id, true);
            if (!was) emit Locked(id);
        }
        _strip(id, c);
        emit Panicked(id, c.custodyEpoch, msg.sender);

        // Our own code, called after every write. `sealMax` must be
        // idempotent at the cap, or a second panic could never run.
        IReach reach = IReach(_account(id));
        reach.sealMax();
        reach.revokeAllSessions();
    }

    /// @notice Lift a guardian's hold. The holder's, in person.
    function release(uint256 id) external {
        _requireHolds(id);
        Core storage c = _s().core[id];
        if (!c.guardianHold) revert NotLocked();
        c.guardianHold = false;
        emit GuardianHoldSet(id, false);
        if (!_locked(id)) emit Unlocked(id);
    }

    /*═══════════════════ ERC-2981 ═══════════════════*/

    function royaltyInfo(uint256, uint256 salePrice) external view returns (address receiver, uint256 amount) {
        IntactStorage.Layout storage $ = _s();
        return ($.royaltyReceiver, salePrice * $.royaltyBps / 10_000);
    }

    /*═══════════════════ the pinned world, read ═══════════════════*/

    /*  Declared here rather than in IntactBase so that only the base facet
        carries them: a getter in the base would be compiled into all four
        facets and routed from one. Internal reads use the immutables. */

    function REGISTRY() external pure returns (address) { return AccountBinding.REGISTRY; }
    function REACH_SALT() external pure returns (bytes32) { return AccountBinding.REACH_SALT; }
    function GRIP_SALT() external pure returns (bytes32) { return AccountBinding.GRIP_SALT; }
    function REACH_IMPL() external view returns (address) { return _REACH_IMPL; }
    function GRIP_IMPL() external view returns (address) { return _GRIP_IMPL; }
    function BAND() external view returns (uint8) { return _BAND; }
    function BAND_LO() external view returns (uint256) { return _BAND_LO; }
    function BAND_HI() external view returns (uint256) { return _BAND_HI; }
    function STEWARD() external view returns (address) { return _STEWARD; }
    function MARKET() external view returns (address) { return _MARKET; }
    function ROLES() external view returns (address) { return _ROLES; }
    function POOL() external view returns (address) { return _POOL; }
    function PARLEY() external view returns (address) { return _PARLEY; }
    function LAUNCHPAD() external view returns (address) { return _LAUNCHPAD; }
    function LOCKS() external view returns (address) { return _LOCKS; }
    function RENDERER() external view returns (address) { return _RENDERER; }
    function CATALOG() external view returns (address) { return _CATALOG; }
    function PREMISES() external view returns (address) { return _PREMISES; }
    function TIMELOCK() external view returns (address) { return _TIMELOCK; }

    /*═══════════════════ ERC-165 ═══════════════════*/

    /// @dev Every id recomputed from Standards.sol by the compiler; ERC-4906
    ///      is events only and fixes its value by fiat. Not claimed: 7857,
    ///      721C, 7631 (Standards.sol says why).
    function supportsInterface(bytes4 i) public pure returns (bool) {
        return i == type(IERC165).interfaceId
            || i == type(IERC721).interfaceId
            || i == type(IERC721Metadata).interfaceId
            || i == type(IERC721Enumerable).interfaceId
            || i == type(IERC2981).interfaceId
            || i == 0x49064906
            || i == type(IERC4907).interfaceId
            || i == type(IERC5169).interfaceId
            || i == type(IERC5192).interfaceId
            || i == type(IERC5646).interfaceId
            || i == type(IERC6454).interfaceId
            || i == type(IERC721MultiMetadata).interfaceId
            || i == type(IERC7496).interfaceId
            || i == type(IERC7572).interfaceId;
    }
}
