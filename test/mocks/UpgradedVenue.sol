// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  UpgradedVenue — what a pinned venue's address answers with after the
  code behind it changed (INTACT U8, NEW; a fixture)

  The Router pins each venue's `extcodehash` at construction and re-reads
  it on every call. This contract's runtime is `vm.etch`ed over the pinned
  SwapRouter02 address in test/Router.t.sol — the shape of a metamorphic
  redeploy, a CREATE2 resurrection, or a chain that replaced a predeploy.
  The "upgrade" keeps the input and pays nothing, returning `amountIn` as
  its output so a return-value reader would be satisfied. The Router never
  reaches that line: `VenueDrifted` fires before the approval.

  (A proxy whose implementation moves keeps its codehash; that class is
  what the `upgradeable` column of `venues()` is for, and why no venue in
  the table is one.)
───────────────────────────────────────────────────────────────────────────*/
interface IERC20Up {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract UpgradedVenue {
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }

    function exactInput(ExactInputParams calldata p) external payable returns (uint256) {
        bytes calldata path = p.path;
        address input;
        assembly ("memory-safe") { input := shr(96, calldataload(path.offset)) }
        IERC20Up(input).transferFrom(msg.sender, address(this), p.amountIn);
        return p.amountIn;
    }
}
