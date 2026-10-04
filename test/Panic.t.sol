// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {MockReachImpl} from "./helpers/HubMocks.sol";
import {IIntact, IIntactEvents, Status} from "../src/interfaces/IIntact.sol";
import {Rights} from "../src/lib/Rights.sol";

/*  DESIGN.md §14 A10 and §2 "Panic — the per-owner/per-token flaw, fixed":
    the holder's panic bumps both epochs; the guardian's bumps the custody
    epoch and holds the token, and never touches the owner's operators on
    unrelated tokens. Both leave no delegated right alive. */
contract PanicTest is IntactFixture {
    address op = address(0x0A);
    address op2 = address(0x0A2);
    address renter = address(0x2E);
    address key = address(0x5E55);
    address wallet = address(0x3A11E7);

    function setUp() public { setUpWorld(); }

    function test_guardianPanicLeavesOtherTokensOperatorsAlone() public {
        uint256 a = mintTo(alice);
        uint256 b = mintTo(alice);
        vm.startPrank(alice);
        hub.setApprovalForAll(op, true);
        hub.setGuardian(a, guardian);
        hub.approve(carol, a);
        hub.setUser(a, renter, uint64(T0 + 30 days));
        vm.stopPrank();
        reachOf(a).grant(key);
        assertEq(bitsOf(a, key), Rights.R_SESSION);
        assertEq(bitsOf(a, op), Rights.R_CUSTODY);

        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.panic(a);                                             // a stranger
        vm.prank(guardian);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.panic(b);                                             // a's guardian is nobody to b

        vm.prank(guardian);
        hub.panic(a);

        // a: every delegated right is dead
        assertEq(hub.custodyEpoch(a), 2);
        assertTrue(hub.statusOf(a) == Status.Paused);
        assertEq(hub.getApproved(a), address(0));
        assertEq(hub.userOf(a), address(0));
        assertFalse(reachOf(a).sessionCurrent(key));
        assertEq(reachOf(a).sealedUntil(), T0 + 365 days, "the Reach is sealed to its maximum");
        assertTrue(hub.locked(a));
        assertTrue(hub.coreOf(a).guardianHold);
        assertEq(bitsOf(a, carol), 0);
        assertEq(bitsOf(a, renter), 0);
        assertEq(bitsOf(a, key), 0);
        assertEq(bitsOf(a, op), 0, "under the hold an operator may not move it, and the bit says so");
        assertEq(bitsOf(a, guardian), Rights.R_GUARDIAN, "the guardian stays: appointed, not delegated");
        vm.prank(op);
        vm.expectRevert(IIntactEvents.GuardianHeld.selector);
        hub.transferFrom(alice, bob, a);
        vm.prank(address(steward));
        vm.expectRevert(IIntactEvents.GuardianHeld.selector);
        hub.stewardTransfer(a, bob);
        assertFalse(hub.isTransferable(a, alice, bob));

        // b: untouched — the owner's operator grant was not the guardian's to revoke
        assertTrue(hub.isApprovedForAll(alice, op));
        assertEq(hub.approvalEpoch(alice), 0);
        assertEq(hub.custodyEpoch(b), 1);
        assertTrue(hub.statusOf(b) == Status.Active);
        assertEq(bitsOf(b, op), Rights.R_CUSTODY);
        vm.prank(op);
        hub.transferFrom(alice, bob, b);
        assertEq(hub.ownerOf(b), bob);

        // release is the holder's, in person
        vm.prank(guardian);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.release(a);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.release(a);
        vm.prank(alice);
        hub.release(a);
        assertFalse(hub.locked(a));
        assertEq(bitsOf(a, op), Rights.R_CUSTODY, "the operator's grant was never cleared; the hold was");
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotLocked.selector);
        hub.release(a);

        // a second guardian panic runs (the seal is idempotent at its cap) and holds again
        vm.prank(guardian);
        hub.panic(a);
        assertTrue(hub.locked(a));
        assertEq(hub.custodyEpoch(a), 3);
        assertEq(reachOf(a).sealedUntil(), T0 + 365 days);

        // the holder in person moves it through the hold, and the sale takes the hold with the guardian
        vm.prank(alice);
        hub.transferFrom(alice, bob, a);
        assertEq(hub.ownerOf(a), bob);
        assertFalse(hub.locked(a));
        assertFalse(hub.coreOf(a).guardianHold);
        assertEq(hub.guardianOf(a), address(0));
    }

    function test_holderPanicKillsEveryDelegatedRight() public {
        uint256 a = mintTo(alice);
        uint256 b = mintTo(alice);
        vm.startPrank(alice);
        hub.setApprovalForAll(op, true);
        hub.setApprovalForAllUntil(op2, uint64(T0 + 1 days));
        hub.approve(carol, a);
        hub.setUser(a, renter, uint64(T0 + 30 days));
        hub.setGuardian(a, guardian);
        hub.proposeAgentWallet(a, wallet);
        vm.stopPrank();
        vm.prank(wallet);
        hub.acceptAgentWallet(a);
        reachOf(a).grant(key);
        reachOf(b).grant(key);

        // live before
        assertEq(bitsOf(a, carol), Rights.R_CUSTODY);
        assertEq(bitsOf(a, op), Rights.R_CUSTODY);
        assertEq(bitsOf(a, op2), Rights.R_CUSTODY);
        assertEq(bitsOf(a, renter), Rights.R_USE);
        assertEq(bitsOf(a, key), Rights.R_SESSION);
        assertEq(bitsOf(b, op), Rights.R_CUSTODY);
        assertEq(hub.agentWalletOf(a), wallet);
        assertEq(reachOf(a).sealedUntil(), 0);

        vm.prank(alice);
        hub.panic(a);

        assertEq(hub.custodyEpoch(a), 2);
        assertEq(hub.approvalEpoch(alice), 1, "the holder's own choice: every operator on every token");
        assertTrue(hub.statusOf(a) == Status.Paused);
        assertEq(hub.getApproved(a), address(0));
        assertEq(hub.userOf(a), address(0));
        assertEq(hub.agentWalletOf(a), hub.account(a));
        assertFalse(reachOf(a).sessionCurrent(key));
        assertEq(reachOf(a).sealedUntil(), T0 + 365 days);
        assertFalse(hub.isApprovedForAll(alice, op));
        assertFalse(hub.isApprovedForAll(alice, op2));
        assertEq(bitsOf(a, carol), 0);
        assertEq(bitsOf(a, op), 0);
        assertEq(bitsOf(a, op2), 0);
        assertEq(bitsOf(a, renter), 0);
        assertEq(bitsOf(a, key), 0);
        assertEq(bitsOf(a, wallet), 0);
        assertEq(bitsOf(a, guardian), Rights.R_GUARDIAN);
        assertEq(bitsOf(a, alice), Rights.R_HOLD);

        // b's operators went with the holder's approval epoch; b's own epoch and session stand
        assertEq(bitsOf(b, op), 0);
        assertEq(hub.custodyEpoch(b), 1);
        assertTrue(reachOf(b).sessionCurrent(key));
        assertEq(bitsOf(b, key), Rights.R_SESSION);
        assertTrue(hub.statusOf(b) == Status.Active);

        // no hold: the holder panicked in person and may sell at once
        assertFalse(hub.locked(a));
        vm.prank(alice);
        hub.transferFrom(alice, bob, a);
        assertEq(hub.ownerOf(a), bob);

        // neither a stranger nor the token's own Reach may panic: only the holder or the guardian
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.panic(b);
        MockReachImpl reachB = reachOf(b);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        reachB.act(address(hub), abi.encodeCall(IIntact.panic, (b)));
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        hub.panic(b + 1);
    }
}
