// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {IIntact, IIntactEvents, Traits} from "../src/interfaces/IIntact.sol";
import {Rights} from "../src/lib/Rights.sol";

/*  DESIGN.md §14 A3: operators are keyed by an epoch the owner can bump in
    one write, and a timed approval lapses on its own. */
contract ApprovalsTest is IntactFixture {
    address op1 = address(0x0A1);
    address op2 = address(0x0A2);
    address op3 = address(0x0A3);

    function setUp() public { setUpWorld(); }

    function _revokeGas(address who) internal returns (uint256 used) {
        vm.prank(who);
        uint256 g0 = gasleft();
        hub.revokeAllApprovals();
        used = g0 - gasleft();
    }

    function test_revokeAllApprovalsIsOneWrite() public {
        uint256 id = mintTo(alice);
        address[3] memory ops = [op1, op2, op3];
        vm.startPrank(alice);
        hub.setApprovalForAll(op1, true);
        hub.setApprovalForAllUntil(op2, T0 + 1 days);
        hub.setApprovalForAll(op3, true);
        vm.stopPrank();
        for (uint256 i; i < 3; ++i) assertTrue(hub.isApprovedForAll(alice, ops[i]));
        assertEq(bitsOf(id, op1), Rights.R_CUSTODY);

        // O(1): revoking three costs what revoking none costs. Bob's call
        // warms the code path; the two measured calls go through one helper
        // so the test's own code is identical, and differ only in how many
        // operators they revoke. A second write would cost 20,000 more.
        vm.prank(bob);
        hub.revokeAllApprovals();
        // alice's epoch slot is warm (her approvals read it); warm carol's the same way
        hub.approvalEpoch(carol);
        hub.approvalEpoch(alice);
        uint256 none = _revokeGas(carol);
        uint256 three = _revokeGas(alice);
        uint256 diff = three > none ? three - none : none - three;
        assertLe(diff, 64, "one write, whatever the count");

        assertEq(hub.approvalEpoch(alice), 1);
        for (uint256 i; i < 3; ++i) {
            assertFalse(hub.isApprovedForAll(alice, ops[i]));
            assertEq(hub.approvalExpiryOf(alice, ops[i]), 0, "the new epoch's key is empty");
        }
        assertEq(bitsOf(id, op1), 0);
        vm.prank(op1);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.transferFrom(alice, bob, id);

        // a new grant under the new epoch works
        vm.prank(alice);
        hub.setApprovalForAll(op1, true);
        assertTrue(hub.isApprovedForAll(alice, op1));
        vm.prank(op1);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.ownerOf(id), bob);
    }

    function test_aTimedApprovalExpires() public {
        uint256 id = mintTo(alice);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.Expired.selector);
        hub.setApprovalForAllUntil(op1, T0);                 // not in the future
        vm.prank(alice);
        hub.setApprovalForAllUntil(op1, T0 + 1 days);
        assertTrue(hub.isApprovedForAll(alice, op1));
        assertEq(hub.approvalExpiryOf(alice, op1), T0 + 1 days);
        assertEq(bitsOf(id, op1), Rights.R_CUSTODY);

        vm.warp(T0 + 1 days + 1);
        assertFalse(hub.isApprovedForAll(alice, op1), "lapsed on its own");
        assertEq(bitsOf(id, op1), 0);
        vm.prank(op1);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.transferFrom(alice, bob, id);

        // the unbounded form reads as forever; zero revokes
        vm.prank(alice);
        hub.setApprovalForAll(op2, true);
        assertEq(hub.approvalExpiryOf(alice, op2), type(uint64).max);
        vm.prank(alice);
        hub.setApprovalForAllUntil(op2, 0);
        assertFalse(hub.isApprovedForAll(alice, op2));
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.ZeroAddress.selector);
        hub.setApprovalForAll(address(0), true);

        // the single approval is custody only, and any move clears it
        vm.prank(alice);
        hub.approve(carol, id);
        assertEq(hub.getApproved(id), carol);
        assertEq(bitsOf(id, carol), Rights.R_CUSTODY);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(1)));
        vm.prank(carol);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.getApproved(id), address(0));
        assertEq(hub.ownerOf(id), bob);
    }

    function test_approveNeedsTheHolderOrALiveOperator() public {
        uint256 id = mintTo(alice);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.approve(carol, id);
        vm.prank(alice);
        hub.setApprovalForAllUntil(op1, T0 + 1 days);
        vm.prank(op1);
        hub.approve(carol, id);
        assertEq(hub.getApproved(id), carol);
        vm.warp(T0 + 2 days);
        vm.prank(op1);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.approve(op1, id);
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        hub.getApproved(id + 1);
    }
}
