// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  MockSwapRouter02 — an honest Uniswap v3 SwapRouter02, by selector
  (INTACT U8, NEW; a fixture)

  `exactInput((bytes,address,uint256,uint256))` is the one entry the
  Router builds calldata for. This stand-in reads both ends of the path the
  way the periphery does (first 20 bytes, last 20 bytes), pulls exactly
  `amountIn` of the first through the allowance the caller set, and pays
  `amountIn × rateBps / 10,000` of the last to `recipient` from its own
  stock — honouring `amountOutMinimum`, which the two hostile venues
  beside it deliberately do not.
───────────────────────────────────────────────────────────────────────────*/
interface IERC20S {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MockSwapRouter02 {
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }

    error TooLittle(uint256 out, uint256 minimum);

    uint256 public rateBps = 10_000;

    function setRate(uint256 bps) external { rateBps = bps; }

    function ends(bytes calldata path) public pure returns (address first, address last) {
        assembly ("memory-safe") {
            first := shr(96, calldataload(path.offset))
            last := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
    }

    function exactInput(ExactInputParams calldata p) external payable returns (uint256 out) {
        (address input, address output) = ends(p.path);
        IERC20S(input).transferFrom(msg.sender, address(this), p.amountIn);
        out = p.amountIn * rateBps / 10_000;
        if (out < p.amountOutMinimum) revert TooLittle(out, p.amountOutMinimum);
        IERC20S(output).transfer(p.recipient, out);
    }
}
