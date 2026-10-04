// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// Proves the toolchain at the new root compiles, tests and gates size.
/// Removed by the first implementation unit.
contract Placeholder {
    uint256 public value;
    error Shrank();
    function raise(uint256 v) external { if (v <= value) revert Shrank(); value = v; }
}
