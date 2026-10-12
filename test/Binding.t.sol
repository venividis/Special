// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccountBinding} from "../src/lib/AccountBinding.sol";

/*───────────────────────────────────────────────────────────────────────────
  The shell derives the Reach and the Grip itself (ERC-6551 CREATE2 over the
  canonical registry) and checks the hub's answer against the derivation;
  tools/selftest.mjs holds the shell's JavaScript to one hard vector. This
  suite pins the SAME vector against the contract's own arithmetic, so the
  three derivations — the library below, the shell's `account6551()`, and
  the registry on chain — are held equal through one number.

  The vector (U9, D12): token 7 of a collection at
  0x1234567890AbcdEF1234567890aBcdef12345678 on chain 1 with a zero
  implementation. It was computed two independent ways before this file
  existed (the reader report, by hand from the spec, and by a Node script
  over ethereum-cryptography's keccak) and a third time here, by the
  library that mints the real accounts. All three say
  0x6aFB0ef97eB85b6742326c7372421a166C5dac1a.
───────────────────────────────────────────────────────────────────────────*/
contract BindingTest is Test {
    address constant COLLECTION = 0x1234567890AbcdEF1234567890aBcdef12345678;

    function test_theShellsSixFiveFiveOneDerivationIsTheContracts() public pure {
        assertEq(
            AccountBinding.predict(address(0), AccountBinding.REACH_SALT, 1, COLLECTION, 7),
            0x6aFB0ef97eB85b6742326c7372421a166C5dac1a,
            "the Reach of token 7 on chain 1 with a zero implementation"
        );
        assertEq(
            AccountBinding.predict(address(0), AccountBinding.GRIP_SALT, 1, COLLECTION, 7),
            0xc4392998811A83E714e2E443D5C1f3EC72C55E0A,
            "the Grip of the same token"
        );
    }

    /// @dev The two salt words the shell carries as hex constants
    ///      (`khex("intact.reach.v1")`, `khex("intact.grip.v1")`), pinned
    ///      so a renamed salt on either side is a failed test, not a
    ///      derivation that quietly disagrees with the registry.
    function test_theSaltsAreTheKeccaksTheShellHardcodes() public pure {
        assertEq(AccountBinding.REACH_SALT, keccak256("intact.reach.v1"));
        assertEq(AccountBinding.REACH_SALT, 0x1d97c6e8ecf40bc45561209243f476bcf68c575ec575f9c181d13e8b8a5847ec);
        assertEq(AccountBinding.GRIP_SALT, keccak256("intact.grip.v1"));
        assertEq(AccountBinding.GRIP_SALT, 0xfd337a35301ee4404b1253abd358da8011894832b313d6c3ab3f648f26da6be0);
        assertEq(AccountBinding.runtime(address(0), AccountBinding.REACH_SALT, 1, COLLECTION, 7).length, AccountBinding.FORWARDER_LENGTH);
    }
}
