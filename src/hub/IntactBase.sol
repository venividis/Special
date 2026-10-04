// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIntactEvents, Core, Status} from "../interfaces/IIntact.sol";
import {IntactStorage} from "./IntactStorage.sol";
import {ERC721Minimal} from "../vendor/ERC721Minimal.sol";
import {AccountBinding} from "../lib/AccountBinding.sol";
import {LibNum} from "../lib/LibNum.sol";

/*───────────────────────────────────────────────────────────────────────────
  IntactBase — the invariants every build of the hub shares

  Origin: ANIMA contracts/diamond/AnimaBase.sol (the sealed transfer hook,
  the epoch-keyed approval store, per-facet immutables checked by a config
  hash) and IPSEITY src/Ipseity.sol (the two-salt account derivation, the
  refusal of the token's own hands as a recipient), adapted for INTACT U1
  with Pixel-Garden's canonical-account refusal (PixelGardenKernel.sol
  281-299, 773-797) widened from "this token's accounts" to "any account of
  this collection".

  The failure mode of a diamond is not storage collision — ERC-7201 settles
  that. It is semantic drift: two facets that each implement "may this
  caller move this token" and slowly stop agreeing. So the rules live here
  exactly once, every override is non-virtual, and the four logic mixins
  are thin surfaces over them. `_update` in particular — where a sale
  strips every authority the seller delegated — is the only way a token
  moves, in either build, and no facet can opt out of it even by accident:
  the compiler refuses the attempt rather than a reviewer having to notice.

  The sixteen pinned addresses are `immutable`, per facet, rather than
  storage: under delegatecall an immutable is inlined into the facet's own
  code, so `account(id)` — called by every satellite on every settlement
  path — reads no storage at all. The hazard of per-facet immutables is
  facets deployed disagreeing; `IntactDiamond` refuses to construct unless
  every facet reports the same `intactConfigHash()`.
───────────────────────────────────────────────────────────────────────────*/

/// @notice Everything a facet is pinned to for its whole life, as one
///         struct so sixteen values cannot be passed in the wrong order.
///         The ERC-6551 registry and the two salts are not here: they are
///         constants of the collection (AccountBinding), the same on every
///         band, and the registry's runtime hash is checked at construction.
struct IntactConfig {
    address reachImpl;
    address gripImpl;
    uint8   band;
    uint256 bandLo;
    uint256 bandHi;
    address steward;
    address market;
    address roles;
    address pool;
    address parley;
    address launchpad;
    address locks;
    address renderer;
    address catalog;
    address premises;
    address timelock;
}

abstract contract IntactBase is IIntactEvents {
    using ERC721Minimal for ERC721Minimal.Store;

    /// @notice The chain has no canonical ERC-6551 registry; it cannot host a band.
    error WrongRegistry();
    /// @notice An empty or inverted band, or one starting at the reserved id 0.
    error BadBand();
    /// @notice A native-value push was refused by its recipient.
    error TransferFailed();

    /*═══════════════════ the pinned world ═══════════════════*/

    address internal immutable _REACH_IMPL;
    address internal immutable _GRIP_IMPL;
    uint8   internal immutable _BAND;
    uint256 internal immutable _BAND_LO;
    uint256 internal immutable _BAND_HI;
    address internal immutable _STEWARD;
    address internal immutable _MARKET;
    address internal immutable _ROLES;
    address internal immutable _POOL;
    address internal immutable _PARLEY;
    address internal immutable _LAUNCHPAD;
    address internal immutable _LOCKS;
    address internal immutable _RENDERER;
    address internal immutable _CATALOG;
    address internal immutable _PREMISES;
    address internal immutable _TIMELOCK;
    /// @dev keccak256 of every pinned value, computed once at construction
    ///      so the diamond's check reads one word per facet rather than
    ///      re-encoding nineteen (measured: ~650 bytes per facet).
    bytes32 internal immutable _CONFIG_HASH;

    constructor(IntactConfig memory c) {
        if (AccountBinding.REGISTRY.codehash != AccountBinding.REGISTRY_HASH) revert WrongRegistry();
        // The implementations are deployed before any build of the hub
        // (DESIGN §12 order); the satellites may still be predictions.
        if (c.reachImpl.code.length == 0 || c.gripImpl.code.length == 0 || c.reachImpl == c.gripImpl) {
            revert ZeroAddress();
        }
        if (c.bandLo == 0 || c.bandLo > c.bandHi) revert BadBand();
        _REACH_IMPL = c.reachImpl;
        _GRIP_IMPL = c.gripImpl;
        _BAND = c.band;
        _BAND_LO = c.bandLo;
        _BAND_HI = c.bandHi;
        _STEWARD = c.steward;
        _MARKET = c.market;
        _ROLES = c.roles;
        _POOL = c.pool;
        _PARLEY = c.parley;
        _LAUNCHPAD = c.launchpad;
        _LOCKS = c.locks;
        _RENDERER = c.renderer;
        _CATALOG = c.catalog;
        _PREMISES = c.premises;
        _TIMELOCK = c.timelock;
        _CONFIG_HASH = keccak256(abi.encode(
            AccountBinding.REGISTRY, AccountBinding.REACH_SALT, AccountBinding.GRIP_SALT,
            c.reachImpl, c.gripImpl, c.band, c.bandLo, c.bandHi,
            c.steward, c.market, c.roles, c.pool, c.parley, c.launchpad, c.locks,
            c.renderer, c.catalog, c.premises, c.timelock
        ));
    }

    /// @notice keccak256 of every pinned value. Read by staticcall on each
    ///         facet at the diamond's construction; every facet must agree.
    ///         The only external function the base itself declares — every
    ///         other shared getter lives in CoreLogic, so the three
    ///         specialised facets do not each carry sixteen getters.
    function intactConfigHash() external view returns (bytes32) {
        return _CONFIG_HASH;
    }

    /*═══════════════════ storage and derivations ═══════════════════*/

    function _s() internal pure returns (IntactStorage.Layout storage) {
        return IntactStorage.layout();
    }

    /// @dev The Reach, derived not stored: the same address before the mint
    ///      that creates it, after it, and from every facet.
    function _account(uint256 id) internal view returns (address) {
        return AccountBinding.predict(_REACH_IMPL, AccountBinding.REACH_SALT, block.chainid, address(this), id);
    }

    function _grip(uint256 id) internal view returns (address) {
        return AccountBinding.predict(_GRIP_IMPL, AccountBinding.GRIP_SALT, block.chainid, address(this), id);
    }

    /// @dev CREATE2 recomputation AND the 173-byte forwarder's codehash. A
    ///      reported `token()` is never trusted: a Reach is whatever CREATE2
    ///      says it is, and an address with no code is not one.
    function _canonical(address candidate, uint256 id, bool gripRole) internal view returns (bool) {
        return AccountBinding.canonical(
            candidate,
            gripRole ? _GRIP_IMPL : _REACH_IMPL,
            gripRole ? AccountBinding.GRIP_SALT : AccountBinding.REACH_SALT,
            block.chainid, address(this), id
        );
    }

    /*═══════════════════ the two words (DESIGN §2) ═══════════════════*/

    function _holds(uint256 id, address who) internal view returns (bool) {
        return who != address(0) && _s().nft.owner[id] == who;
    }

    /// @dev The holder or the token's own Reach — never a renter, operator,
    ///      approvee or session key directly.
    function _acts(uint256 id, address who) internal view returns (bool) {
        return _holds(id, who) || (who != address(0) && who == _account(id));
    }

    /// @dev Reverts `NoSuchToken` before `NotHolder`, so a page asking about
    ///      an unminted id learns which of the two it is.
    function _requireHolds(uint256 id) internal view {
        if (_s().nft.ownerOf(id) != msg.sender) revert NotHolder();
    }

    function _requireActs(uint256 id) internal view {
        if (!_acts(id, msg.sender)) revert NotActor();
    }

    function _isModule(address who) internal view returns (bool) {
        return who != address(0) && (who == _STEWARD || who == _MARKET || who == _ROLES);
    }

    /*═══════════════════ locks and status ═══════════════════*/

    /// @dev One flag, two standards: ERC-5192 `locked` and ERC-6454
    ///      `isTransferable` are both written in terms of this.
    function _locked(uint256 id) internal view returns (bool) {
        Core storage c = _s().core[id];
        return c.lockCount != 0 || c.guardianHold;
    }

    function _setStatus(uint256 id, Status status) internal {
        Core storage c = _s().core[id];
        Status previous = c.status;
        if (previous == status) return;
        c.status = status;
        emit StatusChanged(id, previous, status);
    }

    /*═══════════════════ the approval store ═══════════════════*/

    /// @dev Operators are keyed `keccak256(owner, approvalEpoch[owner], operator)`
    ///      (ANIMA AnimaAgent.sol:841) so `revokeAllApprovals` is one write.
    ///      `isApprovedForAll` MUST read this store: `_checkAuthorized`, and
    ///      so every transfer, depends on it.
    function _approvalKey(address owner_, address operator) internal view returns (bytes32) {
        return keccak256(abi.encode(owner_, _s().approvalEpoch[owner_], operator));
    }

    function isApprovedForAll(address owner_, address operator) public view returns (bool) {
        uint64 until = _s().operatorUntil[_approvalKey(owner_, operator)];
        return until != 0 && until >= block.timestamp;
    }

    function _setTimedApproval(address owner_, address operator, uint64 until) internal {
        if (operator == address(0)) revert ZeroAddress();
        _s().operatorUntil[_approvalKey(owner_, operator)] = until;
        emit ApprovalForAll(owner_, operator, until != 0);
        emit OperatorApprovalTimed(owner_, operator, until);
    }

    function _checkAuthorized(address owner_, address auth, uint256 id) internal view {
        if (auth != owner_ && _s().nft.approved[id] != auth && !isApprovedForAll(owner_, auth)) {
            revert NotAuthorized();
        }
    }

    /*═══════════════════ the transfer rule (DESIGN §2) ═══════════════════*/

    /// @dev `to` may not be the hub, either implementation, either of this
    ///      token's hands, or ANY canonical Reach or Grip of this collection.
    ///      The footer is parsed only when the code is exactly 173 bytes and
    ///      the claim is then recomputed, so a contract that merely says
    ///      `token()` is never believed. No Intact can sit inside another
    ///      Intact's accounts, so there is no ownership cycle at any depth,
    ///      no token stranded in a Grip, and no nested-epoch leak. Other
    ///      collections' accounts are ordinary recipients.
    function _isCanonicalRecipient(uint256 id, address to) internal view returns (bool) {
        if (to == address(this) || to == _REACH_IMPL || to == _GRIP_IMPL) return true;
        if (to == _account(id) || to == _grip(id)) return true;
        (uint256 chain, address collection, uint256 bound) = AccountBinding.token(to);
        if (collection != address(this) || chain != block.chainid) return false;
        return _canonical(to, bound, false) || _canonical(to, bound, true);
    }

    function _refuseCanonical(uint256 id, address to) internal view {
        if (_isCanonicalRecipient(id, to)) revert CanonicalAccount(to);
    }

    /// @notice The only way a token moves. Sealed: not virtual, in either build.
    /// @dev    DESIGN §4.4. `auth == address(0)` is the steward's and the
    ///         market's path: no caller check, but every other rule — the
    ///         counted locks, the guardian hold, the transfer seal, the
    ///         canonical refusal — still applies. An heir waits out a seal;
    ///         nothing bypasses a ratchet. There is no burn.
    function _update(address to, uint256 id, address auth) internal returns (address prev) {
        IntactStorage.Layout storage $ = _s();
        prev = $.nft.owner[id];
        if (prev == address(0)) revert NoSuchToken();
        Core storage c = $.core[id];
        if (c.lockCount != 0) revert IsLocked(id);
        // Under a guardian's hold only the holder in person may move the
        // token: no operator, no approvee, no module (DESIGN §2 "Panic").
        if (c.guardianHold && msg.sender != prev) revert GuardianHeld(id);
        if (c.transferSealUntil > block.timestamp) revert IsTransferSealed(id);
        if (to == address(0)) revert NoBurn();
        _refuseCanonical(id, to);
        if (auth != address(0)) _checkAuthorized(prev, auth, id);

        $.nft.move(prev, to, id);                        // clears the single approval

        // What a sale revokes. Everything else delegated dies by reading the
        // epoch (sessions, roles, key bindings, inbox prices, plans, listings).
        c.custodyEpoch += 1;                             // checked: never wraps, never saturates
        delete c.guardian;
        c.feesToGrip = false;
        c.pinnedFace = 0;
        if (c.guardianHold) {
            // The hold was the guardian's instrument and the guardian is gone.
            c.guardianHold = false;
            emit GuardianHoldSet(id, false);
            emit Unlocked(id);
        }
        emit GuardianSet(id, address(0));
        _strip(id, c);
        emit Transfer(prev, to, id);
    }

    /// @dev What a sale and a panic have in common, once: the single
    ///      approval, the user, the agent wallet (bound and proposed), and
    ///      the status — autonomy does not survive a change of ownership;
    ///      the buyer re-arms the token having read what its keys are about
    ///      to be allowed to do. The caller has already moved the epoch.
    function _strip(uint256 id, Core storage c) internal {
        delete _s().nft.approved[id];
        delete c.user;
        delete c.userExpires;
        delete c.agentWallet;
        delete c.proposedWallet;
        _setStatus(id, Status.Paused);
        emit UpdateUser(id, address(0), 0);
        emit AgentWalletSet(id, address(0));
        emit CustodyEpoch(id, c.custodyEpoch);
        emit MetadataUpdate(id);
        emit ClearPathCache(_paths(id));
    }

    /*═══════════════════ guarded reads ═══════════════════*/

    /// @dev `extcodesize` AND a low-level staticcall: `try` alone reverts on
    ///      a codeless address, and an absent satellite must read as "no
    ///      answer", never as a revert. One 32-byte word comes back raw, so
    ///      a bool, an address, a uint64 and a bytes32 all go through the
    ///      same helper; anything else is zero.
    function _guarded32(address target, bytes memory data) internal view returns (bytes32 v) {
        if (target.code.length == 0) return 0;
        (bool ok, bytes memory ret) = target.staticcall(data);
        if (ok && ret.length == 32) v = abi.decode(ret, (bytes32));
    }

    /*═══════════════════ ERC-7774 ═══════════════════*/

    /// @dev The resources a gateway caches for this token, for ClearPathCache.
    function _paths(uint256 id) internal pure returns (string[] memory p) {
        string memory base = string.concat("/token/", LibNum.str(id), "/");
        p = new string[](5);
        p[0] = string.concat(base, "live");
        p[1] = string.concat(base, "raw");
        p[2] = string.concat(base, "state.json");
        p[3] = string.concat(base, "hash");
        p[4] = string.concat(base, "crest.svg");
    }
}
