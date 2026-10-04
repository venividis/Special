// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  ExactERC20 — value-conserving ERC-20 transfers

  Origin: ANIMA contracts/libraries/ExactERC20.sol, verbatim in behaviour.
  ANIMA's copy imported OpenZeppelin's SafeERC20; INTACT has no import from
  outside src/, so the two safe-transfer primitives are reproduced below:
  a low-level call that tolerates a token returning nothing (USDT) and
  refuses one returning `false`, with the EXTCODESIZE guard Solidity's
  typed call would otherwise skip on a `bytes memory` return.

  Rejects tokens whose transfer mechanics deliver a different amount than
  the protocol accounted for. This prevents fee-on-transfer tokens from
  creating unbacked escrow balances, underfunded curve purchases, or
  short-paid sellers. The Pool measures its own arrivals (a fee-on-transfer
  base is legal there, because the reserve is whatever arrived); Postage,
  Launchpad, Locks and the Router use this and are exact by construction.
───────────────────────────────────────────────────────────────────────────*/

interface IERC20Exact {
    function balanceOf(address who) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

library ExactERC20 {
    error InexactERC20Transfer(address token, uint256 expected, uint256 received);
    error ERC20CallFailed(address token);
    error ApproveFailed(address token, address spender, uint256 amount);

    function transferFromExact(address token, address from, address to, uint256 amount) internal {
        if (amount == 0 || from == to) return;
        uint256 beforeBalance = IERC20Exact(token).balanceOf(to);
        _call(token, abi.encodeCall(IERC20Exact.transferFrom, (from, to, amount)));
        uint256 afterBalance = IERC20Exact(token).balanceOf(to);
        uint256 received = afterBalance >= beforeBalance ? afterBalance - beforeBalance : 0;
        if (received != amount) revert InexactERC20Transfer(token, amount, received);
    }

    function transferExact(address token, address to, uint256 amount) internal {
        if (amount == 0 || to == address(this)) return;
        uint256 beforeBalance = IERC20Exact(token).balanceOf(to);
        _call(token, abi.encodeCall(IERC20Exact.transfer, (to, amount)));
        uint256 afterBalance = IERC20Exact(token).balanceOf(to);
        uint256 received = afterBalance >= beforeBalance ? afterBalance - beforeBalance : 0;
        if (received != amount) revert InexactERC20Transfer(token, amount, received);
    }

    /// @notice Set an allowance to exactly `amount`, and verify it landed.
    /// @dev    The Router's exact-approve-then-zero and the Reach's
    ///         `executeTyped` both need "approve exactly this, then prove
    ///         the allowance is what I said". Tokens that refuse a non-zero
    ///         to non-zero change (USDT) are handled by callers approving
    ///         zero first; this does not hide that behind a retry.
    function approveExact(address token, address spender, uint256 amount) internal {
        _call(token, abi.encodeCall(IERC20Exact.approve, (spender, amount)));
        if (IERC20Exact(token).allowance(address(this), spender) != amount) {
            revert ApproveFailed(token, spender, amount);
        }
    }

    /// @dev SafeERC20's rule: the call must succeed, and if it returned
    ///      anything it must have returned `true`.
    function _call(address token, bytes memory data) private {
        if (token.code.length == 0) revert ERC20CallFailed(token);
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert ERC20CallFailed(token);
    }
}
