// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIntact, Status} from "../../src/interfaces/IIntact.sol";
import {Market} from "../../src/interfaces/IPool.sol";
import {AccountBinding} from "../../src/lib/AccountBinding.sol";
import {LibNum} from "../../src/lib/LibNum.sol";

/*───────────────────────────────────────────────────────────────────────────
  Stand-ins for everything the hub reads or calls that another unit owns
  (INTACT U1, NEW). Each answers exactly the frozen signature the hub uses
  and nothing it does not, and each is settable so a test can move one
  input of the fingerprint at a time. The Reach and Grip stand-ins are
  ERC-6551 IMPLEMENTATIONS: the hub creates the real forwarders through
  the canonical registry at mint and delegatecalls into these, so storage
  is per account and `address(this)` is the forwarder.
───────────────────────────────────────────────────────────────────────────*/

/// @dev Enough of IReach for the hub: state, seal, ledger root, sessions
///      that die by reading the custody epoch, and the two panic entries.
contract MockReachImpl {
    uint256 public state;
    uint64 public sealedUntil;
    bytes32 public openApprovalsRoot;
    uint256 internal _generation;                    // revokeAllSessions bumps it
    mapping(address => uint64) internal _grantEpoch;
    mapping(address => uint256) internal _grantGen;

    function token() public view returns (uint256 chain, address collection, uint256 id) {
        return AccountBinding.token(address(this));
    }

    function owner() external view returns (address) {
        (, address c, uint256 id) = token();
        return IIntact(c).ownerOf(id);
    }

    /// @notice Test helper: a session for `key`, stamped with the custody epoch now.
    function grant(address key) external {
        (, address c, uint256 id) = token();
        _grantEpoch[key] = IIntact(c).custodyEpoch(id);
        _grantGen[key] = _generation + 1;
        state++;
    }

    /// @notice Live only under the epoch it was granted in and until revoked.
    function sessionCurrent(address key) external view returns (bool) {
        (, address c, uint256 id) = token();
        return _grantGen[key] == _generation + 1 && _grantEpoch[key] == IIntact(c).custodyEpoch(id);
    }

    /// @dev Idempotent at the cap, as the hub's `panic` requires.
    function sealMax() external {
        uint64 m = uint64(block.timestamp + 365 days);
        if (m > sealedUntil) sealedUntil = m;
        state++;
    }

    function revokeAllSessions() external { _generation++; state++; }
    function bump() external { state++; }
    function setRoot(bytes32 r) external { openApprovalsRoot = r; state++; }

    /// @notice Test helper: the Reach acting (`acts`). Anyone may drive it here.
    function act(address to, bytes calldata data) external payable returns (bytes memory ret) {
        bool ok;
        (ok, ret) = to.call{value: msg.value}(data);
        if (!ok) assembly { revert(add(ret, 32), mload(ret)) }
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}

/// @dev The receive-only hand: no function moves anything out.
contract MockGripImpl {
    function token() public view returns (uint256, address, uint256) {
        return AccountBinding.token(address(this));
    }
    function state() external pure returns (uint256) { return 0; }
    function isOneWay() external pure returns (bool) { return true; }
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
    receive() external payable {}
}

contract MockRenderer {
    function tokenURIAt(uint256 id, uint8 face) external pure returns (string memory) {
        return string.concat("face", LibNum.str(face), ":", LibNum.str(id));
    }
    function faceCount() external pure returns (uint256) { return 3; }
    function collectionURI() external pure returns (string memory) { return "collection"; }
    function traitMetadataURI() external pure returns (string memory) { return "traits"; }
}

contract MockPool {
    mapping(uint256 => bytes32) public marketHash;
    mapping(uint256 => uint64) internal _seal;
    function set(uint256 key, bytes32 h, uint64 sealUntil) external { marketHash[key] = h; _seal[key] = sealUntil; }
    /// @dev The frozen sixteen-word `Market`; only `sealUntil` means anything here.
    function marketOf(uint256 key) external view returns (Market memory m) {
        m.sealUntil = _seal[key];
        m.open = _seal[key] != 0;
    }
}

contract MockLocks {
    mapping(address => bytes32) public commitmentOf;
    function set(address beneficiary, bytes32 h) external { commitmentOf[beneficiary] = h; }
}

contract MockLaunchpad {
    mapping(uint256 => bytes32) public launchRoot;
    function set(uint256 id, bytes32 h) external { launchRoot[id] = h; }
}

contract MockSteward {
    mapping(uint256 => bytes32) public planHash;
    function set(uint256 id, bytes32 h) external { planHash[id] = h; }
}

/// @dev The ERC-7432 reads the hub makes, for the USER role only.
contract MockRoles {
    bytes32 internal constant USER_ROLE = keccak256("USER");
    mapping(uint256 => address) internal _user;
    mapping(uint256 => uint64) internal _exp;
    function set(uint256 id, address who, uint64 exp) external { _user[id] = who; _exp[id] = exp; }
    function USER() external pure returns (bytes32) { return USER_ROLE; }
    function hasRole(uint256 id, bytes32 roleId, address a) external view returns (bool) {
        return roleId == USER_ROLE && a != address(0) && _user[id] == a && _exp[id] >= block.timestamp;
    }
    function recipientOf(address, uint256 id, bytes32 roleId) external view returns (address) {
        return (roleId == USER_ROLE && _exp[id] >= block.timestamp) ? _user[id] : address(0);
    }
    function roleExpirationDate(address, uint256 id, bytes32 roleId) external view returns (uint64) {
        return roleId == USER_ROLE ? _exp[id] : 0;
    }
}

/// @dev Etched at delegate.xyz v2's address when a test wants the bit.
contract MockDelegateRegistry {
    mapping(bytes32 => bool) internal _ok;
    function set(address to, address from, address c, uint256 id, bool ok) external {
        _ok[keccak256(abi.encode(to, from, c, id))] = ok;
    }
    function checkDelegateForERC721(address to, address from, address c, uint256 id, bytes32) external view returns (bool) {
        return _ok[keccak256(abi.encode(to, from, c, id))];
    }
}

/// @dev A contract minter that reads its token from inside the receiver
///      callback — the only moment a half-made token could ever be seen —
///      and tries to mint again from there.
contract ReentrantMinter {
    IIntact public hub;
    uint256 public seenId;
    bool public complete;
    bool public reentered;
    bytes4 public reentryError;

    constructor(IIntact h) { hub = h; }

    function mint() external payable returns (uint256) {
        return hub.mint{value: msg.value}(address(this));
    }

    function onERC721Received(address, address, uint256 id, bytes calldata) external returns (bytes4) {
        seenId = id;
        complete = hub.ownerOf(id) == address(this)
            && hub.balanceOf(address(this)) == 1
            && hub.account(id).code.length == 173
            && hub.grip(id).code.length == 173
            && hub.isCanonicalAccount(hub.account(id), id, false)
            && hub.custodyEpoch(id) == 1
            && hub.statusOf(id) == Status.Active
            && hub.minted() == id - hub.BAND_LO() + 1;
        (bool ok, bytes memory err) = address(hub).call{value: hub.price()}(abi.encodeCall(IIntact.mint, (address(this))));
        reentered = ok;
        if (!ok && err.length >= 4) reentryError = bytes4(err);
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}

/// @dev A holder with code: what a smart-account or EIP-7702-delegated EOA
///      looks like to the hub. It can receive and it can call.
contract CodeHolder {
    function call(address to, bytes calldata data) external payable returns (bytes memory ret) {
        bool ok;
        (ok, ret) = to.call{value: msg.value}(data);
        if (!ok) assembly { revert(add(ret, 32), mload(ret)) }
    }
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
    receive() external payable {}
}

/// @dev A facet that reads any storage slot of whatever delegatecalls it.
///      Wired into a TEST diamond beside the real four (it answers the same
///      config hash, so the constructor admits it) to prove slots 0–2 are
///      empty and the two namespaces are where IntactStorage says.
contract SlotReader {
    bytes32 internal immutable _HASH;
    constructor(bytes32 h) { _HASH = h; }
    function intactConfigHash() external view returns (bytes32) { return _HASH; }
    function readSlot(uint256 slot) external view returns (bytes32 v) { assembly { v := sload(slot) } }
}
