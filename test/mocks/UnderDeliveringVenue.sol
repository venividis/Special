// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  UnderDeliveringVenue — a venue that returns the number it was asked for
  and pays less (INTACT U8, NEW; a fixture)

  The failure the Router's balance-delta `minOut` exists for. Posing as
  SwapRouter02, it pulls the whole input, delivers `amountOutMinimum − 1`
  — one wei under the floor it was handed — and RETURNS `amountOutMinimum`
  as if it had honoured it. An integration that trusts a venue's return
  value passes; one that measures its own balance does not.
───────────────────────────────────────────────────────────────────────────*/
interface IERC20U {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract UnderDeliveringVenue {
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }

    function exactInput(ExactInputParams calldata p) external payable returns (uint256) {
        bytes calldata path = p.path;
        address input;
        address output;
        assembly ("memory-safe") {
            input := shr(96, calldataload(path.offset))
            output := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
        IERC20U(input).transferFrom(msg.sender, address(this), p.amountIn);
        IERC20U(output).transfer(p.recipient, p.amountOutMinimum - 1);
        return p.amountOutMinimum;
    }
}
