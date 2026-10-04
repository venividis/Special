// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Ratchet} from "../src/lib/Ratchet.sol";

/// @dev The library reverts inside the caller's frame; a probe gives the
///      revert a call boundary for `expectRevert` to catch it at, and keeps
///      the test alive to make its next assertion.
contract RatchetProbe {
    uint64 public sealedUntil;
    uint64 public lockedUntil;

    function seal(uint64 until) external { sealedUntil = Ratchet.raise(sealedUntil, until, Ratchet.SEAL_CAP); }
    function lock(uint64 until) external { lockedUntil = Ratchet.raise(lockedUntil, until, Ratchet.LOCK_CAP); }
    function raise(uint64 current, uint64 proposed, uint64 cap) external view returns (uint64) {
        return Ratchet.raise(current, proposed, cap);
    }
}

/*  One rule for every time promise (DESIGN.md §9.3): the Reach seal, the
    market seal, the transfer seal (365 d) and the locks (10 y) all move
    through `Ratchet.raise`, so one file proves the property for all. */
contract RatchetTest is Test {
    RatchetProbe p;
    uint64 constant T0 = 1_733_000_000;

    function setUp() public {
        vm.warp(T0);
        p = new RatchetProbe();
    }

    function test_everyRatchetOnlyLengthens() public {
        uint64[2] memory caps = [Ratchet.SEAL_CAP, Ratchet.LOCK_CAP];
        for (uint256 i; i < caps.length; ++i) {
            uint64 cap = caps[i];
            uint64 first = T0 + 10 days;
            assertEq(p.raise(0, first, cap), first, "a first promise is accepted as given");

            // the same moment again is not longer
            vm.expectRevert(Ratchet.RatchetOnly.selector);
            p.raise(first, first, cap);

            // and any earlier moment is shorter
            vm.expectRevert(Ratchet.RatchetOnly.selector);
            p.raise(first, first - 1, cap);

            // longer is the only direction
            assertEq(p.raise(first, first + 1, cap), first + 1, "one second longer passes");
        }

        // the stateful shape every caller uses: x = raise(x, until, cap)
        p.seal(T0 + 30 days);
        assertEq(p.sealedUntil(), T0 + 30 days);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        p.seal(T0 + 29 days);
        assertEq(p.sealedUntil(), T0 + 30 days, "a refused shortening leaves the promise standing");
        p.seal(T0 + 31 days);
        assertEq(p.sealedUntil(), T0 + 31 days);

        p.lock(T0 + 3000 days);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        p.lock(T0 + 3000 days);
        p.lock(T0 + 3001 days);
        assertEq(p.lockedUntil(), T0 + 3001 days);
    }

    function testFuzz_everyRatchetOnlyLengthens(uint64 current, uint64 proposed, bool lockCap) public {
        uint64 cap = lockCap ? Ratchet.LOCK_CAP : Ratchet.SEAL_CAP;
        current = uint64(bound(current, 0, T0 + cap));
        proposed = uint64(bound(proposed, 0, T0 + cap + 1 days));
        bool lengthens = proposed > current && proposed > T0;
        bool inCap = proposed <= T0 + cap;
        if (lengthens && inCap) {
            assertEq(p.raise(current, proposed, cap), proposed);
        } else if (!lengthens) {
            vm.expectRevert(Ratchet.RatchetOnly.selector);
            p.raise(current, proposed, cap);
        } else {
            vm.expectRevert(Ratchet.TooLong.selector);
            p.raise(current, proposed, cap);
        }
    }

    function test_aRatchetRefusesThePastAndTheCap() public {
        // now is not a promise, and neither is any moment before it
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        p.raise(0, T0, Ratchet.SEAL_CAP);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        p.raise(0, T0 - 1, Ratchet.SEAL_CAP);

        // exactly the cap is the longest promise there is
        assertEq(p.raise(0, T0 + Ratchet.SEAL_CAP, Ratchet.SEAL_CAP), T0 + Ratchet.SEAL_CAP);
        assertEq(p.raise(0, T0 + Ratchet.LOCK_CAP, Ratchet.LOCK_CAP), T0 + Ratchet.LOCK_CAP);

        // one second past it is not
        vm.expectRevert(Ratchet.TooLong.selector);
        p.raise(0, T0 + Ratchet.SEAL_CAP + 1, Ratchet.SEAL_CAP);
        vm.expectRevert(Ratchet.TooLong.selector);
        p.raise(0, T0 + Ratchet.LOCK_CAP + 1, Ratchet.LOCK_CAP);

        // the cap is measured from now, not from the standing promise: a
        // promise made long ago can still be raised to a full cap from today
        p.seal(T0 + 1 days);
        vm.warp(T0 + 200 days);
        p.seal(T0 + 200 days + Ratchet.SEAL_CAP);
        assertEq(p.sealedUntil(), T0 + 200 days + Ratchet.SEAL_CAP);
        vm.expectRevert(Ratchet.TooLong.selector);
        p.seal(T0 + 200 days + Ratchet.SEAL_CAP + 1);

        // and 2^64-1, the value IPSEITY's session once accepted, is TooLong
        vm.expectRevert(Ratchet.TooLong.selector);
        p.raise(0, type(uint64).max, Ratchet.LOCK_CAP);

        assertTrue(Ratchet.live(uint64(block.timestamp + 1)));
        assertFalse(Ratchet.live(uint64(block.timestamp)));
    }
}
