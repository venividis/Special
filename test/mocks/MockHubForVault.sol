// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Core, Status} from "../../src/interfaces/IIntact.sol";
import {AccountBinding, IAccountRegistry} from "../../src/lib/AccountBinding.sol";
import {Ratchet} from "../../src/lib/Ratchet.sol";

/*───────────────────────────────────────────────────────────────────────────
  MockHubForVault — the slice of the hub that Locks, Steward and Timelock
  can see (INTACT U5, NEW; the real hub is U1's, built in parallel)

  It answers exactly the IIntact selectors those three contracts and their
  verifiers call, with the hub's documented rules for each:

    · `ownerOf`, `custodyEpoch`, `coreOf`, `locked`, `transferSealUntil`,
      `holds`, `account`, `grip`, `isCanonicalAccount` — reads, derived the
      way the hub derives them (AccountBinding, salts `intact.reach.v1` /
      `intact.grip.v1`);
    · `moduleLock` / `moduleUnlock` — pinned modules only, `NotLocked` at
      zero, never a silent return (DESIGN.md §2 "Locks");
    · `stewardTransfer` — `STEWARD` only, through the same `_update` as a
      sale: refuses a locked token, a running transfer seal and any
      canonical account, bumps the epoch, forces Paused (§4.4);
    · `sealTransfer` — the holder's ratchet (365 d);
    · `panic` — bumps the epoch WITHOUT a transfer, the case that voids a
      plan while the Steward still holds its lock;
    · `setPrice` — `TIMELOCK` only, so verify-timelock can show that a
      change to the collection takes seven days and announces itself;
    · `touch` — a stranger's call that must never count as a sign of life
      (IPSEITY's `embody`, kept as the attack it was).

  Modules are set by `wire` after deployment because a mock has no CREATE3
  prediction to pin them with; the real hub's are immutables.
───────────────────────────────────────────────────────────────────────────*/
contract MockHubForVault {
    address public immutable REACH_IMPL;
    address public immutable GRIP_IMPL;
    bytes32 public constant REACH_SALT = AccountBinding.REACH_SALT;
    bytes32 public constant GRIP_SALT = AccountBinding.GRIP_SALT;

    address public STEWARD;
    address public MARKET;
    address public TIMELOCK;

    uint256 public minted;
    uint256 public price;
    mapping(uint256 => address) private _owner;
    mapping(uint256 => Core) private _core;
    mapping(uint256 => address) public getApproved;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event PriceSet(uint256 price);
    event Touched(uint256 indexed id, address indexed by);

    error NoSuchToken();
    error NotHolder();
    error NotSteward();
    error NotModule();
    error NotLocked();
    error NotTimelock();
    error NotAuthorized();
    error ZeroAddress();
    error IsLocked(uint256 id);
    error IsTransferSealed(uint256 id);
    error CanonicalAccount(address to);

    constructor(address reachImpl, address gripImpl) {
        REACH_IMPL = reachImpl;
        GRIP_IMPL = gripImpl;
    }

    function wire(address steward, address market, address timelock) external {
        STEWARD = steward; MARKET = market; TIMELOCK = timelock;
    }

    /*═══════════════════ mint and accounts ═══════════════════*/

    function mint(address to) external returns (uint256 id) {
        id = ++minted;
        _owner[id] = to;
        Core storage c = _core[id];
        c.status = Status.Active;
        c.custodyEpoch = 1;
        c.createdAt = uint64(block.timestamp);
        emit Transfer(address(0), to, id);
    }

    /// @dev Materialise the token's Reach through the canonical registry, as
    ///      the real mint does; tests etch the registry first.
    function createReach(uint256 id) external returns (address) {
        return IAccountRegistry(AccountBinding.REGISTRY)
            .createAccount(REACH_IMPL, REACH_SALT, block.chainid, address(this), id);
    }

    function account(uint256 id) public view returns (address) {
        return AccountBinding.predict(REACH_IMPL, REACH_SALT, block.chainid, address(this), id);
    }

    function grip(uint256 id) public view returns (address) {
        return AccountBinding.predict(GRIP_IMPL, GRIP_SALT, block.chainid, address(this), id);
    }

    function isCanonicalAccount(address candidate, uint256 id, bool gripRole) public view returns (bool) {
        return gripRole
            ? AccountBinding.canonical(candidate, GRIP_IMPL, GRIP_SALT, block.chainid, address(this), id)
            : AccountBinding.canonical(candidate, REACH_IMPL, REACH_SALT, block.chainid, address(this), id);
    }

    /*═══════════════════ reads ═══════════════════*/

    function ownerOf(uint256 id) public view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function holds(uint256 id, address who) external view returns (bool) { return _owner[id] == who; }
    function custodyEpoch(uint256 id) external view returns (uint64) { return _core[id].custodyEpoch; }
    function coreOf(uint256 id) external view returns (Core memory) { return _core[id]; }
    function locked(uint256 id) public view returns (bool) {
        return _core[id].lockCount != 0 || _core[id].guardianHold;
    }
    function transferSealUntil(uint256 id) external view returns (uint64) { return _core[id].transferSealUntil; }
    function statusOf(uint256 id) external view returns (Status) { return _core[id].status; }

    /*═══════════════════ locks, seals, modules ═══════════════════*/

    function moduleLock(uint256 id) external {
        if (msg.sender != STEWARD && msg.sender != MARKET) revert NotModule();
        _core[id].lockCount += 1;
    }

    function moduleUnlock(uint256 id) external {
        if (msg.sender != STEWARD && msg.sender != MARKET) revert NotModule();
        if (_core[id].lockCount == 0) revert NotLocked();
        _core[id].lockCount -= 1;
    }

    function sealTransfer(uint256 id, uint64 until) external {
        if (msg.sender != ownerOf(id)) revert NotHolder();
        _core[id].transferSealUntil = Ratchet.raise(_core[id].transferSealUntil, until, Ratchet.SEAL_CAP);
    }

    function setGuardianHold(uint256 id, bool held) external {
        if (msg.sender != ownerOf(id)) revert NotHolder();
        _core[id].guardianHold = held;
    }

    function stewardTransfer(uint256 id, address to) external {
        if (msg.sender != STEWARD) revert NotSteward();
        _update(to, id);
    }

    function approve(address to, uint256 id) external {
        if (msg.sender != ownerOf(id)) revert NotHolder();
        getApproved[id] = to;
    }

    function transferFrom(address from, address to, uint256 id) external {
        if (ownerOf(id) != from) revert NotHolder();
        if (msg.sender != from && getApproved[id] != msg.sender) revert NotAuthorized();
        _update(to, id);
    }

    /// @dev The holder's panic: the epoch moves, nothing transfers.
    function panic(uint256 id) external {
        if (msg.sender != ownerOf(id)) revert NotHolder();
        _core[id].custodyEpoch += 1;
        _core[id].status = Status.Paused;
    }

    /// @dev Anybody may call this against anybody's token. It must not
    ///      count as life anywhere.
    function touch(uint256 id) external {
        ownerOf(id);
        emit Touched(id, msg.sender);
    }

    /*═══════════════════ the curated surface ═══════════════════*/

    function setPrice(uint256 p) external {
        if (msg.sender != TIMELOCK) revert NotTimelock();
        price = p;
        emit PriceSet(p);
    }

    /*═══════════════════ the sealed path ═══════════════════*/

    function _update(address to, uint256 id) private {
        address from = ownerOf(id);
        if (to == address(0)) revert ZeroAddress();
        if (locked(id)) revert IsLocked(id);
        if (_core[id].transferSealUntil > block.timestamp) revert IsTransferSealed(id);
        if (to == address(this) || to == REACH_IMPL || to == GRIP_IMPL) revert CanonicalAccount(to);
        (uint256 chain, address collection, uint256 k) = AccountBinding.token(to);
        if (chain == block.chainid && collection == address(this) &&
            (isCanonicalAccount(to, k, false) || isCanonicalAccount(to, k, true))) revert CanonicalAccount(to);
        _owner[id] = to;
        Core storage c = _core[id];
        c.custodyEpoch += 1;
        c.status = Status.Paused;
        c.transferSealUntil = 0;
        delete getApproved[id];
        emit Transfer(from, to, id);
    }
}

/// @dev The smallest implementation a forwarder can point at: accepts
///      value and any call, so a Reach built on it can receive a release.
contract StubAccountImpl {
    receive() external payable {}
    fallback() external payable {}
}
