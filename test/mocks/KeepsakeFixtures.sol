// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Market} from "../../src/interfaces/IPool.sol";

/*───────────────────────────────────────────────────────────────────────────
  KeepsakeFixtures — what test/Keepsake.t.sol needs that is not the Pool

  INTACT V2 W1, NEW. Two stand-ins, each for one refusal the suite has to
  reach and cannot reach through honest parts:

    KeepsakeHolder     a contract that holds keepsakes: it can refuse ETH
                       (a claim to it must revert TransferFailed), re-enter
                       the Keepsake from inside the ETH it is paid (the lock
                       must refuse the nested call, and the refusal is kept
                       here byte for byte), and act as itself, so "the
                       holder" in a test is genuinely a contract.
    KeepsakeShortPool  a Pool that ignores `minOut` and pays what it is told
                       to. The real Pool refuses a short fill with its own
                       Slippage before the Keepsake ever sees one, so the
                       Keepsake's own floor check — the defence in depth —
                       is reachable only through a venue that lies.
───────────────────────────────────────────────────────────────────────────*/

interface IKeepsakeFixtureToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract KeepsakeHolder {
    error KeepsakeHolderRefusesEth();

    bool public refuseEth;
    address public target;
    bytes public payload;
    bool public tried;
    bool public nestedOk;
    bytes public nestedData;

    function setRefuseEth(bool v) external { refuseEth = v; }

    /// @notice On the next ETH it receives, call `t` with `p` once and keep
    ///         the answer.
    function arm(address t, bytes calldata p) external {
        target = t;
        payload = p;
        tried = false;
    }

    /// @notice Call anything as this contract; a refusal is passed up whole.
    function act(address to, bytes calldata data) external payable returns (bytes memory ret) {
        bool ok;
        (ok, ret) = to.call{value: msg.value}(data);
        if (!ok) assembly { revert(add(ret, 32), mload(ret)) }
    }

    receive() external payable {
        if (refuseEth) revert KeepsakeHolderRefusesEth();
        if (target != address(0) && !tried) {
            tried = true;
            (nestedOk, nestedData) = target.call(payload);
        }
    }
}

contract KeepsakeShortPool {
    error KeepsakeShortPoolPayFailed();

    Market internal _m;
    uint256 public deliver;

    function setMarket(address base, address quote) external {
        _m.base = base;
        _m.quote = quote;
        _m.open = true;
    }

    function setDeliver(uint256 d) external { deliver = d; }

    function marketOf(uint256) external view returns (Market memory) { return _m; }

    /// @dev Takes the input like the Pool and pays `deliver`, whatever
    ///      `minOut` says.
    function swapExactIn(uint256, bool baseIn, uint256 amountIn, uint256, address to, uint64)
        external payable returns (uint256)
    {
        (address tin, address tout) = baseIn ? (_m.base, _m.quote) : (_m.quote, _m.base);
        if (tin != address(0)) IKeepsakeFixtureToken(tin).transferFrom(msg.sender, address(this), amountIn);
        if (tout == address(0)) {
            (bool ok, ) = to.call{value: deliver}("");
            if (!ok) revert KeepsakeShortPoolPayFailed();
        } else {
            IKeepsakeFixtureToken(tout).transfer(to, deliver);
        }
        return deliver;
    }

    receive() external payable {}
}
