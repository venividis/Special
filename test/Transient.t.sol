// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Transient} from "../src/lib/Transient.sol";

/// @dev A contract that takes a registered lock around a call it may be
///      asked to fail, and one that re-enters it while it is held.
contract TransientProbe {
    error Boom();

    function held(bytes32 s) external view returns (bool) { return Transient.held(s); }
    function peek(bytes32 s) external view returns (bytes32) { return Transient.peek(s); }

    /// @notice enter → (maybe revert) → exit, all in one frame.
    function locked(bytes32 s, bool fail) external {
        Transient.enter(s);
        if (fail) revert Boom();
        Transient.exit(s);
    }

    /// @notice enter, then call back into `locked` on the same slot: the
    ///         inner call must revert `Reentrancy` and the outer must then
    ///         exit cleanly.
    function reenter(bytes32 s) external returns (bool innerOk) {
        Transient.enter(s);
        (innerOk, ) = address(this).call(abi.encodeCall(this.locked, (s, false)));
        Transient.exit(s);
    }

    function commit(bytes32 s, bytes32 v) external { Transient.commit(s, v); }
    function consume(bytes32 s, bytes32 v) external { Transient.consume(s, v); }
}

/*  DESIGN.md §13 "transient-registry test (every transient slot hashed,
    single-purpose, cleared on every exit)" and §14 H1. */
contract TransientTest is Test {
    TransientProbe p;

    function setUp() public { p = new TransientProbe(); }

    function test_everySlotIsRegisteredAndClearedOnRevert() public {
        (bytes32[] memory slots, string[] memory names) = Transient.registry();
        assertGt(slots.length, 0, "the registry is not empty");
        assertEq(slots.length, names.length);

        for (uint256 i; i < slots.length; ++i) {
            bytes32 s = slots[i];
            // registered: derived from its name by the one formula
            assertEq(s, Transient.slot(names[i]), "a slot equals keccak(name) - 1");
            assertEq(uint256(s), uint256(keccak256(bytes(names[i]))) - 1);

            // clear before, clear after a success
            assertFalse(p.held(s));
            p.locked(s, false);
            assertFalse(p.held(s), "released on the success path");

            // held during: a re-entry is refused, and the outer still exits
            bool innerOk = p.reenter(s);
            assertFalse(innerOk, "a call under the lock cannot take it again");
            assertFalse(p.held(s), "released after the re-entry attempt");

            // and cleared by a revert, which the EVM's journal does — but
            // asserted here, because a lock that survived its own failure
            // would brick every later call in the same transaction
            vm.expectRevert(TransientProbe.Boom.selector);
            p.locked(s, true);
            assertFalse(p.held(s), "released by the revert");

            // once more, to prove the slot is usable after the revert
            p.locked(s, false);
            assertFalse(p.held(s));
        }

        // the commitment shape: written, consumed exactly once, with the value
        bytes32 c = Transient.ROUTER_COMMIT;
        p.commit(c, keccak256("data"));
        assertEq(p.peek(c), keccak256("data"));
        vm.expectRevert(Transient.NoCommitment.selector);
        p.consume(c, keccak256("other"));
        p.consume(c, keccak256("data"));
        assertEq(p.peek(c), bytes32(0), "consumed means cleared");
        vm.expectRevert(Transient.NoCommitment.selector);
        p.consume(c, keccak256("data"));
    }

    function test_twoPurposesNeverShareASlot() public pure {
        (bytes32[] memory slots, string[] memory names) = Transient.registry();
        for (uint256 i; i < slots.length; ++i) {
            for (uint256 j = i + 1; j < slots.length; ++j) {
                assertTrue(slots[i] != slots[j], "two registered purposes share a slot");
                assertTrue(keccak256(bytes(names[i])) != keccak256(bytes(names[j])), "two purposes share a name");
            }
        }
        // the formula separates any two names, and lands on no Solidity slot
        assertTrue(Transient.slot("a") != Transient.slot("b"));
        assertTrue(Transient.slot("intact.pool.lock") == Transient.POOL_LOCK);
        assertTrue(uint256(Transient.slot("intact.pool.lock")) != uint256(keccak256("intact.pool.lock")));
    }
}
