// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  UnderDeliveringVenue — a venue that returns the number it was asked for
  and pays less (INTACT U8, NEW; a fixture)

  The failure the Router's balance-delta `minOut` exists for. Posing as
  SwapRouter02 at one-for-one, it pulls the whole input, delivers
  `amountIn − 1` — one wei under what an honest venue at that rate pays —
  and RETURNS `amountIn` as if it had paid it. An integration that trusts
  a venue's return value passes; one that measures its own balance does
  not.

  It never reads `amountOutMinimum`. The first version paid
  `amountOutMinimum − 1`, which was one wei under the floor only while
  there was a floor: the Router hands the venue the request's own
  `minOut`, and the sentence this venue serves goes on to set that floor
  to zero so that the Reach's own floor is the last line — at which point
  `0 − 1` was a Panic(0x11) inside the venue, bubbled through the Router
  and the Reach as the test's answer. The suite's helper decoding a
  swallowed revert hid it until the wave-1 integration.
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
        IERC20U(output).transfer(p.recipient, p.amountIn - 1);
        return p.amountIn;
    }
}
