// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Status} from "../../src/interfaces/IIntact.sol";
import {AccountBinding, IAccountRegistry} from "../../src/lib/AccountBinding.sol";

interface IReachPanic {
    function sealMax() external;
    function revokeAllSessions() external;
}

interface IReceiver721 {
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4);
}

/*───────────────────────────────────────────────────────────────────────────
  AccountsHub — the four words the Reach reads from the hub, and nothing
  more (INTACT U2, NEW; a fixture, never deployed)

  The accounts unit runs in the same wave as the hub unit, so the real
  `Intact` is not on this branch yet. The Reach only ever asks its hub four
  questions — `ownerOf`, `custodyEpoch`, `statusOf`, `guardianOf` — and
  derives its two accounts the way the real hub does (DESIGN.md §4.3:
  through the canonical registry, verified by `AccountBinding.canonical`).
  This stub answers those four exactly as `IIntact` specifies and moves
  custody the way `_update` does: every transfer bumps the epoch, pauses
  the token and clears the guardian; `panic` does what the hub's does to
  the Reach. `breakEpoch` makes `custodyEpoch` revert, so the suites can
  prove the Reach fails CLOSED when its hub stops answering.
───────────────────────────────────────────────────────────────────────────*/
contract AccountsHub {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Minted(uint256 indexed id, address indexed reach, address indexed grip, uint8 band);
    event CustodyEpoch(uint256 indexed id, uint64 epoch);

    error NoSuchToken();
    error NotHolder();
    error NotAuthorized();
    error NotCanonical();
    error WrongReceiver();
    error EpochUnreadable();

    address public immutable REACH_IMPL;
    address public immutable GRIP_IMPL;

    uint256 public minted;
    bool public epochBroken;

    mapping(uint256 => address) private _owner;
    mapping(uint256 => uint64) private _epoch;
    mapping(uint256 => Status) private _status;
    mapping(uint256 => address) private _guardian;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    constructor(address reachImpl, address gripImpl) {
        REACH_IMPL = reachImpl;
        GRIP_IMPL = gripImpl;
    }

    /*──────────────── the four reads ────────────────*/

    function ownerOf(uint256 id) public view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function custodyEpoch(uint256 id) external view returns (uint64) {
        if (epochBroken) revert EpochUnreadable();
        ownerOf(id);
        return _epoch[id];
    }

    function statusOf(uint256 id) external view returns (Status) {
        ownerOf(id);
        return _status[id];
    }

    function guardianOf(uint256 id) external view returns (address) {
        return _guardian[id];
    }

    /*──────────────── accounts ────────────────*/

    function account(uint256 id) public view returns (address) {
        return AccountBinding.predict(REACH_IMPL, AccountBinding.REACH_SALT, block.chainid, address(this), id);
    }

    function grip(uint256 id) public view returns (address) {
        return AccountBinding.predict(GRIP_IMPL, AccountBinding.GRIP_SALT, block.chainid, address(this), id);
    }

    function isCanonicalAccount(address candidate, uint256 id, bool gripRole) public view returns (bool) {
        return gripRole
            ? AccountBinding.canonical(candidate, GRIP_IMPL, AccountBinding.GRIP_SALT, block.chainid, address(this), id)
            : AccountBinding.canonical(candidate, REACH_IMPL, AccountBinding.REACH_SALT, block.chainid, address(this), id);
    }

    /// @notice DESIGN §4.3's order: counters, ownership, both accounts
    ///         through the registry and verified, events, the receiver
    ///         callback LAST.
    function mint(address to) external payable returns (uint256 id) {
        id = ++minted;
        _owner[id] = to;
        _epoch[id] = 1;
        _status[id] = Status.Active;
        IAccountRegistry reg = IAccountRegistry(AccountBinding.REGISTRY);
        address reach = reg.createAccount(REACH_IMPL, AccountBinding.REACH_SALT, block.chainid, address(this), id);
        address g = reg.createAccount(GRIP_IMPL, AccountBinding.GRIP_SALT, block.chainid, address(this), id);
        if (!isCanonicalAccount(reach, id, false) || !isCanonicalAccount(g, id, true)) revert NotCanonical();
        emit Transfer(address(0), to, id);
        emit Minted(id, reach, g, 1);
        emit CustodyEpoch(id, 1);
        if (to.code.length != 0 &&
            IReceiver721(to).onERC721Received(msg.sender, address(0), id, "") != IReceiver721.onERC721Received.selector)
        {
            revert WrongReceiver();
        }
    }

    /*──────────────── custody, the way _update moves it ────────────────*/

    function setApprovalForAll(address operator, bool ok) external {
        isApprovedForAll[msg.sender][operator] = ok;
    }

    function transferFrom(address from, address to, uint256 id) external {
        if (ownerOf(id) != from) revert NotHolder();
        if (msg.sender != from && !isApprovedForAll[from][msg.sender]) revert NotAuthorized();
        _owner[id] = to;
        _epoch[id] += 1;
        _status[id] = Status.Paused;
        delete _guardian[id];
        emit Transfer(from, to, id);
        emit CustodyEpoch(id, _epoch[id]);
    }

    function setGuardian(uint256 id, address g) external {
        if (ownerOf(id) != msg.sender) revert NotHolder();
        _guardian[id] = g;
    }

    function setStatus(uint256 id, Status s) external {
        if (ownerOf(id) != msg.sender && msg.sender != account(id)) revert NotHolder();
        _status[id] = s;
    }

    function pause(uint256 id) external {
        if (ownerOf(id) != msg.sender && _guardian[id] != msg.sender) revert NotAuthorized();
        _status[id] = Status.Paused;
    }

    /// @notice What the hub's `panic` does to the Reach (DESIGN §2): a new
    ///         epoch, Paused, the seal to its maximum, every session gone.
    function panic(uint256 id) external {
        if (ownerOf(id) != msg.sender && _guardian[id] != msg.sender) revert NotAuthorized();
        _epoch[id] += 1;
        _status[id] = Status.Paused;
        IReachPanic(account(id)).sealMax();
        IReachPanic(account(id)).revokeAllSessions();
        emit CustodyEpoch(id, _epoch[id]);
    }

    function breakEpoch(bool broken) external {
        epochBroken = broken;
    }
}
