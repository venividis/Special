// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Parley} from "../../src/Parley.sol";
import {Postage} from "../../src/Postage.sol";

/*───────────────────────────────────────────────────────────────────────────
  SocialHub — the hub as the social contracts see it (INTACT U4, NEW)

  Parley, Postage and Roster read seven things from the hub: `ownerOf`,
  `account`, `grip`, `feeSink`, `custodyEpoch`, `BAND_LO` and `minted`. This
  is exactly those, with a mint that gives every token a real contract as
  its account (so a Reach can hold ERC-20 allowances and receive native
  refunds), a `transferFrom` that bumps the custody epoch and clears the
  ERC-4907 user the way `_update` does, and a `feesToGrip` bit. Nothing is
  authorised beyond what the suites need; it is a fixture, not the hub.

  The wave-1 hub (U1) is built in parallel; the suites here are re-pointed
  at it when the deploy helper lands.
───────────────────────────────────────────────────────────────────────────*/

/// @dev A stand-in account: receives, and relays one call for a test that
///      needs the Reach to approve a fee token or speak for itself. `refuse`
///      makes `receive` revert, for the pull-settlement proofs.
contract StubReach {
    bool public refuse;
    error Refused();
    function setRefuse(bool r) external { refuse = r; }
    receive() external payable { if (refuse) revert Refused(); }
    function call(address to, uint256 value, bytes calldata data) external returns (bytes memory ret) {
        bool ok;
        (ok, ret) = to.call{value: value}(data);
        if (!ok) assembly ("memory-safe") { revert(add(ret, 32), mload(ret)) }
    }
}

contract SocialHub {
    uint256 public constant BAND_LO = 1;
    uint256 public constant BAND_HI = 4096;
    uint256 public minted;

    mapping(uint256 => address) private _owner;
    mapping(uint256 => uint64) public custodyEpoch;
    mapping(uint256 => address) private _account;
    mapping(uint256 => address) private _grip;
    mapping(uint256 => bool) public feesToGrip;
    mapping(uint256 => address) private _user;
    mapping(uint256 => uint64) private _userExpires;

    error NoSuchToken();
    error NotHolder();
    error BandExhausted();

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function mint(address to) external returns (uint256 id) {
        id = BAND_LO + minted;
        if (id > BAND_HI) revert BandExhausted();
        minted += 1;
        _owner[id] = to;
        custodyEpoch[id] = 1;
        _account[id] = address(new StubReach());
        _grip[id] = address(new StubReach());
        emit Transfer(address(0), to, id);
    }

    function ownerOf(uint256 id) public view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function totalSupply() external view returns (uint256) { return minted; }
    function account(uint256 id) external view returns (address) { return _account[id]; }
    function grip(uint256 id) external view returns (address) { return _grip[id]; }
    function feeSink(uint256 id) external view returns (address) { return feesToGrip[id] ? _grip[id] : _account[id]; }

    function holds(uint256 id, address who) public view returns (bool) { return who != address(0) && _owner[id] == who; }
    function acts(uint256 id, address who) external view returns (bool) { return holds(id, who) || (who != address(0) && who == _account[id]); }

    function userOf(uint256 id) external view returns (address) {
        return _userExpires[id] >= block.timestamp ? _user[id] : address(0);
    }
    function setUser(uint256 id, address user, uint64 expires) external {
        if (ownerOf(id) != msg.sender) revert NotHolder();
        _user[id] = user; _userExpires[id] = expires;
    }
    function setFeesToGrip(uint256 id, bool toGrip) external {
        if (ownerOf(id) != msg.sender) revert NotHolder();
        feesToGrip[id] = toGrip;
    }

    /// @dev What `_update` does to the parts these suites can see: the
    ///      custody epoch moves, the user is cleared. Only the holder
    ///      transfers here; operators are out of this fixture's scope.
    function transferFrom(address from, address to, uint256 id) external {
        if (ownerOf(id) != from || msg.sender != from) revert NotHolder();
        _owner[id] = to;
        custodyEpoch[id] += 1;
        delete _user[id]; delete _userExpires[id];
        emit Transfer(from, to, id);
    }
}

/// @dev Postage's PARLEY and Parley's POSTAGE are mutual immutables. On a
///      live chain CREATE3 fixes both addresses before either constructor
///      runs; here the same thing is done with CREATE: a fresh contract's
///      first creation lands at nonce 1 and its second at nonce 2, so Parley's
///      address is known before Postage is built with it, and asserted after.
contract SocialDeploy {
    Postage public immutable postage;
    Parley public immutable parley;
    error Mispredicted(address predicted, address actual);

    constructor(address hub, address keys) {
        address predicted = address(uint160(uint256(keccak256(
            abi.encodePacked(bytes1(0xd6), bytes1(0x94), address(this), bytes1(0x02))))));
        postage = new Postage(hub, predicted);
        parley = new Parley(hub, keys, address(postage));
        if (address(parley) != predicted) revert Mispredicted(predicted, address(parley));
    }
}
