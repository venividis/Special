// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

/// @dev A slot this suite zeroes and sets again, around a call that reverts.
contract HarnessSlot {
    error No();
    uint256 public x;
    function set(uint256 v) external { x = v; }
    function boom() external pure { revert No(); }
}

/// @notice The runner itself, held to forge's semantics where a test's
///         gas accounting crosses an `expectRevert`.
contract HarnessTest is Test {
    HarnessSlot internal slot;

    function setUp() public {
        slot = new HarnessSlot();
        slot.set(1);                  // nonzero before the test's transaction
    }

    /// Zeroing the slot earns a refund; setting it again spends it. A
    /// swallowed revert in between must leave the caller's refund alone,
    /// as forge does, or the second store finds nothing to spend.
    function test_aSwallowedRevertKeepsTheCallersGasRefund() public {
        slot.set(0);
        vm.expectRevert(HarnessSlot.No.selector);
        slot.boom();
        slot.set(1);
        assertEq(slot.x(), 1, "the store after a swallowed revert lands");
    }
}
