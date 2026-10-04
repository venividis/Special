// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactBase} from "./IntactBase.sol";
import {IntactStorage} from "./IntactStorage.sol";
import {Core, Status} from "../interfaces/IIntact.sol";
import {IReach} from "../interfaces/IReach.sol";
import {IRoles} from "../interfaces/IRoles.sol";
import {IERC7432, IDelegateRegistryV2} from "../interfaces/Standards.sol";
import {Rights} from "../lib/Rights.sol";
import {ERC721Minimal} from "../vendor/ERC721Minimal.sol";

/*───────────────────────────────────────────────────────────────────────────
  RightsLogic — who may do what with a token, answered from one place

  DESIGN.md §2 and §3 row 3. `rightsOf` is NEW for INTACT: the one
  predicate every satellite and the page consume and none re-derive. The
  rest is ANIMA contracts/diamond/AnimaAgentFacet.sol adapted — guardian,
  status, the ERC-4907 user — with the EIP-712 wallet-binding verifier
  replaced by a two-step propose/accept (proof of control by sending is
  equivalent and costs no verifier bytes in the hub), and `feesToGrip`.

  Every satellite read here goes through `_guarded32`: `extcodesize` and a
  staticcall whose failure is "no answer". An absent Roles contract, an
  absent delegate.xyz, a Reach that has not been asked — each clears its
  bit and never reverts, so a page can ask about any address on any band.
───────────────────────────────────────────────────────────────────────────*/
abstract contract RightsLogic is IntactBase {
    using ERC721Minimal for ERC721Minimal.Store;

    /// @dev delegate.xyz v2, the same address on every chain it is on. A
    ///      viewing right only: nothing in this protocol writes on its word.
    address internal constant DELEGATE_REGISTRY = 0x00000000000000447e69651d841bD8D104Bed493;
    /// @dev The ERC-7432 role the 4907 shim reads (IRoles: keccak256("USER")).
    bytes32 internal constant USER_ROLE = keccak256("USER");

    /*═══════════════════ the predicate ═══════════════════*/

    /// @notice What `actor` may do with `id`, as bits (Rights.sol), with the
    ///         custody epoch every delegated right is stamped with and the
    ///         holder, so one call tells a page everything the gate needs.
    /// @dev    R_ROLE is read for the USER role, the only role id the hub
    ///         knows; IRoles has no per-actor any-role query. R_SESSION is a
    ///         hint — the Reach is the enforcer.
    function rightsOf(uint256 id, address actor)
        external view returns (uint16 bits, uint64 epoch, address holder)
    {
        IntactStorage.Layout storage $ = _s();
        holder = $.nft.ownerOf(id);
        Core storage c = $.core[id];
        epoch = c.custodyEpoch;
        if (actor == address(0)) return (0, epoch, holder);

        address reach = _account(id);
        if (actor == holder) bits |= Rights.R_HOLD;
        if (actor == reach) bits |= Rights.R_ACCOUNT;
        if (_userOf(id, c) == actor) bits |= Rights.R_USE;
        // A custody right is a right to move the token; under a guardian's
        // hold no operator or approvee may, so the bit says so (the store
        // is untouched and the bit returns with `release`).
        if (!c.guardianHold && ($.nft.approved[id] == actor || isApprovedForAll(holder, actor))) {
            bits |= Rights.R_CUSTODY;
        }
        if (_guarded32(_ROLES, abi.encodeCall(IRoles.hasRole, (id, USER_ROLE, actor))) != 0) bits |= Rights.R_ROLE;
        if (_guarded32(DELEGATE_REGISTRY, abi.encodeCall(
                IDelegateRegistryV2.checkDelegateForERC721, (actor, holder, address(this), id, bytes32(0)))) != 0)
        {
            bits |= Rights.R_DELEGATE;
        }
        if (c.guardian == actor) bits |= Rights.R_GUARDIAN;
        if (_guarded32(reach, abi.encodeCall(IReach.sessionCurrent, (actor))) != 0) bits |= Rights.R_SESSION;
    }

    function holds(uint256 id, address who) external view returns (bool) {
        return _holds(id, who);
    }

    function acts(uint256 id, address who) external view returns (bool) {
        return _acts(id, who);
    }

    /*═══════════════════ ERC-4907 ═══════════════════*/

    /// @notice Name a user. Strict holder: a renter renders a sentence and
    ///         nothing else (no money, no speech, no traits).
    function setUser(uint256 id, address user, uint64 expires) external {
        _requireHolds(id);
        Core storage c = _s().core[id];
        c.user = user;
        c.userExpires = expires;
        emit UpdateUser(id, user, expires);
    }

    /// @dev The hub's own field first; when it is empty or lapsed, the
    ///      Roles satellite's USER recipient, guarded. One read, never a revert.
    function _userOf(uint256 id, Core storage c) internal view returns (address) {
        if (c.user != address(0) && c.userExpires >= block.timestamp) return c.user;
        return address(uint160(uint256(
            _guarded32(_ROLES, abi.encodeCall(IERC7432.recipientOf, (address(this), id, USER_ROLE))))));
    }

    function userOf(uint256 id) external view returns (address) {
        return _userOf(id, _s().core[id]);
    }

    function userExpires(uint256 id) external view returns (uint256) {
        Core storage c = _s().core[id];
        if (c.user != address(0) && c.userExpires >= block.timestamp) return c.userExpires;
        return uint256(_guarded32(_ROLES, abi.encodeCall(IERC7432.roleExpirationDate, (address(this), id, USER_ROLE))));
    }

    /*═══════════════════ guardian and status ═══════════════════*/

    function setGuardian(uint256 id, address guardian) external {
        _requireHolds(id);
        _s().core[id].guardian = guardian;
        emit GuardianSet(id, guardian);
    }

    function guardianOf(uint256 id) external view returns (address) {
        return _s().core[id].guardian;
    }

    /// @notice Arm or pause. The holder or the token's own Reach; sessions
    ///         and recipes act only while Active, so a paused token's keys
    ///         cannot re-arm it through the Reach.
    function setStatus(uint256 id, Status status) external {
        _requireActs(id);
        _setStatus(id, status);
    }

    /// @notice A guardian may only ever pause. It cannot transfer, cannot
    ///         spend, and cannot un-pause: a kill switch that can also steal
    ///         is not a safety feature.
    function pause(uint256 id) external {
        IntactStorage.Layout storage $ = _s();
        address owner_ = $.nft.ownerOf(id);
        Core storage c = $.core[id];
        if (msg.sender != owner_ && (c.guardian == address(0) || msg.sender != c.guardian)) revert NotGuardian();
        _setStatus(id, Status.Paused);
    }

    function statusOf(uint256 id) external view returns (Status) {
        return _s().core[id].status;
    }

    /*═══════════════════ the agent wallet, in two steps ═══════════════════*/

    /// @notice Name the address this agent transacts from. Nothing is bound
    ///         until that address accepts, in its own transaction — proof of
    ///         control by sending, the cheapest proof there is. Proposing
    ///         address(0) withdraws a proposal and unbinds a bound wallet.
    function proposeAgentWallet(uint256 id, address wallet) external {
        _requireHolds(id);
        Core storage c = _s().core[id];
        c.proposedWallet = wallet;
        emit AgentWalletProposed(id, wallet);
        if (wallet == address(0) && c.agentWallet != address(0)) {
            delete c.agentWallet;
            emit AgentWalletSet(id, address(0));
        }
    }

    function acceptAgentWallet(uint256 id) external {
        Core storage c = _s().core[id];
        if (c.proposedWallet == address(0) || msg.sender != c.proposedWallet) revert NotWallet();
        c.agentWallet = msg.sender;
        delete c.proposedWallet;
        emit AgentWalletSet(id, msg.sender);
        emit MetadataUpdate(id);
    }

    /// @notice The bound wallet, or the Reach when none is bound (ERC-8004's
    ///         `agentWallet = account(id)`).
    function agentWalletOf(uint256 id) external view returns (address) {
        IntactStorage.Layout storage $ = _s();
        $.nft.ownerOf(id);
        address bound = $.core[id].agentWallet;
        return bound == address(0) ? _account(id) : bound;
    }

    /*═══════════════════ where income goes ═══════════════════*/

    /// @notice Route every fee stream into the Grip, the hand that cannot
    ///         spend. The page says "permanently unspendable" before this
    ///         bit is set; it is cleared on sale.
    function setFeesToGrip(uint256 id, bool toGrip) external {
        _requireHolds(id);
        _s().core[id].feesToGrip = toGrip;
        emit FeesToGripSet(id, toGrip);
    }

    /// @notice Whom the Pool, Postage and the custodian pay for this token.
    function feeSink(uint256 id) external view returns (address) {
        IntactStorage.Layout storage $ = _s();
        $.nft.ownerOf(id);
        return $.core[id].feesToGrip ? _grip(id) : _account(id);
    }
}
