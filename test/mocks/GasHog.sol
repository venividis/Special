// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  GasHog — a view nobody's node will run (INTACT U0, NEW)

  The fixture for `tools/gas.mjs --selftest`: `hog(rounds)` hashes the
  same 64 bytes of scratch space `rounds` times — no memory growth, so the
  cost is linear, about 114 gas a round — and `hog(400000)` measured 45.6 M:
  over the 2^24 (16,777,216) EIP-7825 cap every view in this protocol is
  gated at, and under the 50 M node default, so it fails for exactly the
  reason the gate exists. (A first version built the hash input with
  `abi.encode` in the loop and measured 2.9 G — the quadratic memory
  charge, not the work — which proved the gate and taught nothing.)

  The gas tool must report it over the cap and exit non-zero; if it ever
  reports this green, the gate is not a gate.
───────────────────────────────────────────────────────────────────────────*/
contract GasHog {
    function hog(uint256 rounds) external pure returns (bytes32 x) {
        assembly ("memory-safe") {
            for { let i := 0 } lt(i, rounds) { i := add(i, 1) } {
                mstore(0x00, x)
                mstore(0x20, i)
                x := keccak256(0x00, 0x40)
            }
        }
    }
    function cheap() external pure returns (uint256) { return 1; }
}
