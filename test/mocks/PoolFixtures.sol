// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Curve} from "../../src/lib/Curve.sol";

/*───────────────────────────────────────────────────────────────────────────
  PoolFixtures — what the Pool's suites need that is not the Pool

  INTACT U3, NEW. The Pool consults the hub for three things only:
  `ownerOf(id)` and `account(id)` through Rights.acts, and `feeSink(id)`
  for a sealed market's collect. PoolHub answers those three with the
  hub's semantics (ownerOf reverts for a token that does not exist; the
  Reach is a pure derivation unless a test pins one; feeSink is the Reach
  or the Grip by the feesToGrip bit) and nothing else, so test/Pool.t.sol,
  tools/verify-pool.mjs and tools/fuzz.mjs run against the Pool alone and
  not against whatever state the hub happens to be in. U12's battery
  re-runs them against the real Intact.

  CurveProbe is a window onto the library, so the fuzzers can price any
  reserves directly — 1 wei, 2^64, 2^112 — instead of inferring the
  arithmetic from a pool they would have to fill first.
───────────────────────────────────────────────────────────────────────────*/
contract PoolHub {
    error NoSuchToken();
    error NotHolder();

    event Transfer(address indexed from, address indexed to, uint256 indexed id);

    uint256 public minted;
    mapping(uint256 => address) private _owner;
    mapping(uint256 => address) private _account;
    mapping(uint256 => bool) public feesToGrip;
    mapping(uint256 => uint64) public custodyEpoch;

    function mint(address to) external returns (uint256 id) {
        id = ++minted;
        _owner[id] = to;
        custodyEpoch[id] = 1;
        emit Transfer(address(0), to, id);
    }

    function ownerOf(uint256 id) external view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function transferFrom(address from, address to, uint256 id) external {
        if (_owner[id] != from || msg.sender != from) revert NotHolder();
        _owner[id] = to;
        custodyEpoch[id] += 1;
        emit Transfer(from, to, id);
    }

    /// @dev The Reach: derived, unless a test pins a contract there to act
    ///      as the token's account.
    function account(uint256 id) public view returns (address) {
        address a = _account[id];
        if (a != address(0)) return a;
        return address(uint160(uint256(keccak256(abi.encode("intact.reach.v1", id)))));
    }

    function grip(uint256 id) public pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encode("intact.grip.v1", id)))));
    }

    function feeSink(uint256 id) external view returns (address) {
        if (_owner[id] == address(0)) revert NoSuchToken();
        return feesToGrip[id] ? grip(id) : account(id);
    }

    function setFeesToGrip(uint256 id, bool v) external { feesToGrip[id] = v; }
    function setAccount(uint256 id, address a) external { _account[id] = a; }

    function holds(uint256 id, address who) external view returns (bool) { return _owner[id] == who; }
    function acts(uint256 id, address who) external view returns (bool) {
        return _owner[id] == who || account(id) == who;
    }
}

contract CurveProbe {
    function MAX_CONCENTRATION() external pure returns (uint256) { return Curve.MAX_CONCENTRATION; }
    function MAX_RESERVE() external pure returns (uint256) { return Curve.MAX_RESERVE; }
    function anchor(uint256 bps, uint256 rb, uint256 rq) external pure returns (uint256, uint256) {
        return Curve.anchor(bps, rb, rq);
    }
    function amountOut(uint256 a, uint256 ri, uint256 ro, uint256 vi, uint256 vo, uint256 fee)
        external pure returns (uint256)
    {
        return Curve.amountOut(a, ri, ro, vi, vo, fee);
    }
    function amountIn(uint256 o, uint256 ri, uint256 ro, uint256 vi, uint256 vo, uint256 fee)
        external pure returns (uint256)
    {
        return Curve.amountIn(o, ri, ro, vi, vo, fee);
    }
    function spot(uint256 ri, uint256 ro, uint256 vi, uint256 vo) external pure returns (uint256) {
        return Curve.spot(ri, ro, vi, vo);
    }
    function invariant(uint256 ri, uint256 ro, uint256 vi, uint256 vo) external pure returns (uint256) {
        return Curve.invariant(ri, ro, vi, vo);
    }
}
