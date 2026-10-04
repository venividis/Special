// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ReachFixture} from "./Reach.t.sol";
import {Reach} from "../src/Reach.sol";
import {
    IReachEvents, Session, SessionKind, AssetCap, AssetLimit, TypedCall, Call
} from "../src/interfaces/IReach.sol";
import {Status} from "../src/interfaces/IIntact.sol";
import {Drainer} from "./mocks/Drainer.sol";
import {Permit2ish} from "./mocks/Permit2ish.sol";
import {MockVenue} from "./mocks/MockVenue.sol";

/*  DESIGN.md §9.2 — sessions, one system. Every bound is checked on every
    call; every key is stamped with the custody epoch; nothing revives.   */
contract SessionsTest is ReachFixture {
    function test_aSessionDiesOnSale() public {
        (uint256 id, Reach r) = _mint(alice);
        _grantTransfer(r, alice, agent);
        assertTrue(r.sessionCurrent(agent));
        assertTrue(r.sessionAllows(agent, address(gold), XFER));
        vm.prank(agent);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
        assertEq(gold.balanceOf(agent), WAD, "the key spends while the granter holds");

        // nothing is called on the account; the hub does not know it exists
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertFalse(r.sessionCurrent(agent), "sessionCurrent names the reason");
        assertFalse(r.sessionAllows(agent, address(gold), XFER));
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReachEvents.SoldOn.selector, uint64(1), uint64(2)));
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
        assertEq(gold.balanceOf(agent), WAD, "not one wei more");
    }

    function test_aSessionDoesNotReviveOnBuyBack() public {
        (uint256 id, Reach r) = _mint(alice);
        _grantTransfer(r, alice, agent);
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        vm.prank(bob);
        hub.transferFrom(bob, alice, id);
        assertEq(hub.ownerOf(id), alice, "back with the one who granted it");
        assertEq(hub.custodyEpoch(id), 3);
        vm.prank(agent);
        vm.expectRevert(IReachEvents.SoldOn.selector);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
        assertFalse(r.sessionCurrent(agent), "a counter only goes forward");

        // the fix retires keys, it does not disable the feature — but a
        // sale paused the token, so the holder re-arms before a new key acts
        _grantTransfer(r, alice, agent);
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NotActive.selector);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
        vm.prank(alice);
        hub.setStatus(id, Status.Active);
        vm.prank(agent);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
        assertEq(gold.balanceOf(agent), WAD);
    }

    function test_aPausedTokenFreezesItsKeys() public {
        (uint256 id, Reach r) = _mint(alice);
        _grantTransfer(r, alice, agent);
        vm.prank(alice);
        hub.setGuardian(id, guardian);
        vm.prank(guardian);
        hub.pause(id);
        assertTrue(r.sessionCurrent(agent), "the grant stands");
        assertFalse(r.sessionAllows(agent, address(gold), XFER), "but nothing is allowed while paused");
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NotActive.selector);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
        // the holder is never on a leash
        _exec(r, alice, address(gold), 0, _xfer(bob, WAD));
        vm.prank(alice);
        hub.setStatus(id, Status.Active);
        vm.prank(agent);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
        assertEq(gold.balanceOf(agent), WAD);
    }

    function test_aSessionCannotGrantASession() public {
        (, Reach r) = _mint(alice);
        _grantTransfer(r, alice, agent);
        bytes memory grant = abi.encodeWithSelector(
            r.grantSession.selector, agent, uint64(block.timestamp + 1 days), uint128(0), _noCaps(),
            _addrs(address(gold)), _sels(XFER), uint32(0), uint32(0));
        // calling the account itself
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NoPrivilegeEscalation.selector);
        r.executeAsSession(address(r), 0, grant);
        // calling the grant word on any target
        vm.prank(alice);
        r.grantSession(agent, uint64(block.timestamp + 1 days), 0, _noCaps(), _addrs(address(gold)),
            _sels(r.grantSession.selector), 0, 0);
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NoPrivilegeEscalation.selector);
        r.executeAsSession(address(gold), 0, grant);
        assertFalse(r.sessionAllows(agent, address(gold), r.grantSession.selector));
        // granting directly, as the key
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.grantSession(agent, uint64(block.timestamp + 1 days), 0, _noCaps(), _addrs(address(gold)), _sels(XFER), 0, 0);
        // or being handed the account as a target, or as a recipe
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NoPrivilegeEscalation.selector);
        r.grantSession(agent, uint64(block.timestamp + 1 days), 0, _noCaps(), _addrs(address(r)), _sels(XFER), 0, 0);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NoPrivilegeEscalation.selector);
        r.grantRecipe(agent, uint64(block.timestamp + 1 days), address(r), keccak256(grant), 0, 1, 0);
        // sealing, revoking: not the key's words either
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.seal(uint64(block.timestamp + 1 days));
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NotSignerOrGuardian.selector);
        r.revokeAllSessions();
    }

    /// @dev Measured, not decoded: the cap is charged by what actually left,
    ///      through any word. Drainer.take names no amount of gold anywhere a
    ///      decoder would look.
    function test_anErc20CapIsMeasuredByDelta() public {
        (, Reach r) = _mint(alice);
        _exec(r, alice, address(gold), 0, _approve(address(drainer), type(uint256).max));
        vm.prank(alice);
        r.grantSession(agent, uint64(block.timestamp + 1 days), 0, _cap(address(gold), uint128(10 * WAD)),
            _addrs(address(gold), address(drainer)), _sels(XFER, Drainer.take.selector), 0, 0);

        vm.prank(agent);
        r.executeAsSession(address(gold), 0, _xfer(agent, 6 * WAD));
        (, AssetCap[] memory left) = r.sessionExposure(agent);
        assertEq(left[0].cap, 4 * WAD, "exposure counts down");

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReachEvents.AssetCapExceeded.selector, address(gold), 10 * WAD, 11 * WAD));
        r.executeAsSession(address(drainer), 0, abi.encodeWithSelector(Drainer.take.selector, address(gold), 5 * WAD));

        vm.prank(agent);
        r.executeAsSession(address(drainer), 0, abi.encodeWithSelector(Drainer.take.selector, address(gold), 4 * WAD));
        assertEq(gold.balanceOf(address(drainer)), 4 * WAD, "a word with no amount in it was still charged");
        vm.prank(agent);
        vm.expectRevert(IReachEvents.AssetCapExceeded.selector);
        r.executeAsSession(address(gold), 0, _xfer(agent, 1));
        // silver has no cap and is not a target: bounded by the allowlist
        vm.prank(agent);
        vm.expectRevert(IReachEvents.TargetNotAllowed.selector);
        r.executeAsSession(address(silver), 0, _xfer(agent, 1));
        // a re-grant resets what was spent, which is the only reading of new terms
        vm.prank(alice);
        r.grantSession(agent, uint64(block.timestamp + 1 days), 0, _cap(address(gold), uint128(WAD)),
            _addrs(address(gold)), _sels(XFER), 0, 0);
        AssetCap[] memory caps = r.sessionCaps(agent);
        assertEq(caps.length, 1);
        assertEq(caps[0].cap, WAD);
    }

    function test_executeTypedRefusesAShortfall() public {
        (, Reach r) = _mint(alice);
        MockVenue venue = new MockVenue();
        silver.mint(address(venue), 100 * WAD);
        bytes memory swap9 = abi.encodeWithSelector(MockVenue.swap.selector, address(gold), 10 * WAD, address(silver), 9 * WAD);
        TypedCall memory c = TypedCall({
            to: address(venue), value: 0, data: swap9,
            spend: _limit(address(gold), 10 * WAD), receiveMin: _limit(address(silver), 10 * WAD),
            deadline: uint64(block.timestamp + 60)
        });
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IReachEvents.Shortfall.selector, address(silver), 10 * WAD, 9 * WAD));
        r.executeTyped(c);
        assertEq(gold.balanceOf(address(r)), 1000 * WAD, "nothing left when the floor was missed");
        assertEq(gold.allowance(address(r), address(venue)), 0, "and no allowance stands");

        c.receiveMin = _limit(address(silver), 9 * WAD);
        vm.prank(alice);
        r.executeTyped(c);
        assertEq(silver.balanceOf(address(r)), 1009 * WAD, "exactly this for at least that");
        assertEq(gold.allowance(address(r), address(venue)), 0, "the exact approval was reset and proved zero");

        // a venue that takes without giving is caught by the floor; one that
        // would take more than declared cannot, because the allowance is exact
        c.data = abi.encodeWithSelector(MockVenue.pull.selector, address(gold), 10 * WAD);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.Shortfall.selector);
        r.executeTyped(c);
        c.data = abi.encodeWithSelector(MockVenue.swap.selector, address(gold), 11 * WAD, address(silver), 9 * WAD);
        vm.prank(alice);
        vm.expectRevert();
        r.executeTyped(c);

        // a standing allowance is refused, so the exact one is the only one
        _exec(r, alice, address(gold), 0, _approve(address(venue), 1));
        c.data = swap9;
        vm.prank(alice);
        vm.expectRevert(IReachEvents.AllowanceNotZero.selector);
        r.executeTyped(c);
        _exec(r, alice, address(gold), 0, _approve(address(venue), 0));

        c.deadline = uint64(block.timestamp - 1);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.Expired.selector);
        r.executeTyped(c);
        c.deadline = uint64(block.timestamp + 60);

        // and a session drives the same shape under its own bounds
        vm.prank(alice);
        r.grantSession(agent, uint64(block.timestamp + 1 days), 0, _cap(address(gold), uint128(10 * WAD)),
            _addrs(address(venue)), _sels(MockVenue.swap.selector), 0, 0);
        vm.prank(agent);
        r.executeTyped(c);
        assertEq(silver.balanceOf(address(r)), 1018 * WAD);
        (, AssetCap[] memory left) = r.sessionExposure(agent);
        assertEq(left[0].cap, 0, "the session's cap was charged by the swap");
        vm.prank(agent);
        vm.expectRevert(IReachEvents.AssetCapExceeded.selector);
        r.executeTyped(c);
    }

    function test_aRecipeRunsExactlyItsUses() public {
        (, Reach r) = _mint(alice);
        bytes memory step = _xfer(bob, WAD);
        vm.prank(alice);
        r.grantRecipe(agent, uint64(block.timestamp + 1 days), address(gold), keccak256(step), 0, 2, 0);
        Session memory s = r.sessionOf(agent);
        assertTrue(s.kind == SessionKind.Recipe);
        assertEq(s.targetCodeHash, address(gold).codehash);
        assertTrue(r.sessionAllows(agent, address(gold), XFER));
        assertFalse(r.sessionAllows(agent, address(silver), XFER));

        vm.prank(agent);
        r.executeAsSession(address(gold), 0, step);
        vm.prank(agent);
        vm.expectRevert(IReachEvents.RecipeMismatch.selector);
        r.executeAsSession(address(gold), 0, _xfer(bob, WAD + 1));
        vm.prank(agent);
        vm.expectRevert(IReachEvents.RecipeMismatch.selector);
        r.executeAsSession(address(gold), 1, step);
        vm.prank(agent);
        vm.expectRevert(IReachEvents.RecipeMismatch.selector);
        r.executeAsSession(address(silver), 0, step);
        vm.prank(agent);
        r.executeAsSession(address(gold), 0, step);
        assertEq(gold.balanceOf(bob), 2 * WAD, "exactly its uses");
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NoUsesLeft.selector);
        r.executeAsSession(address(gold), 0, step);
        assertFalse(r.sessionCurrent(agent), "spent is not current");

        // uses are bounded, and never zero
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NoUsesLeft.selector);
        r.grantRecipe(agent, uint64(block.timestamp + 1 days), address(gold), keccak256(step), 0, 0, 0);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.ListTooLong.selector);
        r.grantRecipe(agent, uint64(block.timestamp + 1 days), address(gold), keccak256(step), 0, 1025, 0);

        // the interval is a wall, and the exposure is value × uses
        vm.prank(alice);
        r.grantRecipe(agent, uint64(block.timestamp + 1 days), address(gold), keccak256(step), 0, 3, 60);
        (uint256 nativeWorst, ) = r.sessionExposure(agent);
        assertEq(nativeWorst, 0);
        vm.prank(agent);
        r.executeAsSession(address(gold), 0, step);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReachEvents.TooSoon.selector, uint64(block.timestamp + 60)));
        r.executeAsSession(address(gold), 0, step);
        vm.warp(block.timestamp + 60);
        vm.prank(agent);
        r.executeAsSession(address(gold), 0, step);
        assertEq(gold.balanceOf(bob), 4 * WAD);

        // a recipe with value: exact, and counted as exposure
        vm.deal(address(r), 10 ether);
        vm.prank(alice);
        r.grantRecipe(agent, uint64(block.timestamp + 1 days), address(hub), keccak256(abi.encodeWithSignature("minted()")), 0, 1, 0);
        vm.prank(alice);
        r.grantRecipe(agent, uint64(block.timestamp + 1 days), address(drainer), keccak256(""), 1 ether, 2, 0);
        (nativeWorst, ) = r.sessionExposure(agent);
        assertEq(nativeWorst, 2 ether, "worst case printed before the holder signs");
    }

    function test_theGuardianMayRevokeEverySession() public {
        (uint256 id, Reach r) = _mint(alice);
        _grantTransfer(r, alice, agent);
        _grantTransfer(r, alice, bob);
        vm.prank(alice);
        hub.setGuardian(id, guardian);

        vm.prank(address(0xDEAD));
        vm.expectRevert(IReachEvents.NotSignerOrGuardian.selector);
        r.revokeAllSessions();
        vm.prank(address(0xDEAD));
        vm.expectRevert(IReachEvents.NotSignerOrGuardian.selector);
        r.revokeSession(agent);

        vm.prank(guardian);
        r.revokeSession(bob);
        assertFalse(r.sessionCurrent(bob));
        assertTrue(r.sessionCurrent(agent), "one key, not every key");

        vm.prank(guardian);
        r.revokeAllSessions();
        assertFalse(r.sessionCurrent(agent));
        vm.prank(agent);
        vm.expectRevert(IReachEvents.NoSession.selector);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));

        // a grant after the wholesale revoke is alive: the serial moved past it
        _grantTransfer(r, alice, agent);
        assertTrue(r.sessionCurrent(agent));

        // and the hub's panic does both: seal to the maximum, kill every key
        vm.prank(guardian);
        hub.panic(id);
        assertEq(r.sealedUntil(), uint64(block.timestamp) + 365 days);
        assertFalse(r.sessionCurrent(agent));
        assertEq(hub.custodyEpoch(id), 2);
    }

    function test_stateBumpsOnEveryGrant() public {
        (, Reach r) = _mint(alice);
        uint256 s = r.state();
        _grantTransfer(r, alice, agent);
        assertEq(r.state(), ++s, "grantSession");
        vm.prank(alice);
        r.grantRecipe(bob, uint64(block.timestamp + 1 days), address(gold), keccak256(_xfer(bob, 1)), 0, 1, 0);
        assertEq(r.state(), ++s, "grantRecipe");
        vm.prank(alice);
        r.revokeSession(bob);
        assertEq(r.state(), ++s, "revokeSession");
        vm.prank(alice);
        r.revokeAllSessions();
        assertEq(r.state(), ++s, "revokeAllSessions");
        _seal(r, alice, T0 + 1 days);
        assertEq(r.state(), ++s, "seal");
        _guard(r, alice, address(gold));
        assertEq(r.state(), ++s, "guard");
        vm.prank(alice);
        r.retireAttestations();
        assertEq(r.state(), ++s, "retireAttestations");
        vm.prank(alice);
        r.revokeOpenApprovals();
        assertEq(r.state(), ++s, "revokeOpenApprovals");
        _exec(r, alice, address(silver), 0, _xfer(bob, 1));
        assertEq(r.state(), ++s, "execute");
    }

    function test_theNativeCapIsCumulative() public {
        (, Reach r) = _mint(alice);
        vm.prank(alice);
        r.grantSession(agent, uint64(block.timestamp + 1 days), uint128(2 ether), _noCaps(), _addrs(agent), _sels(bytes4(0)), 0, 0);
        vm.prank(agent);
        r.executeAsSession(agent, 1 ether, "");
        vm.prank(agent);
        r.executeAsSession(agent, 1 ether, "");
        assertEq(agent.balance, 2 ether);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReachEvents.SpendCapExceeded.selector, 2 ether, 2 ether + 1));
        r.executeAsSession(agent, 1, "");
        (uint256 nativeWorst, ) = r.sessionExposure(agent);
        assertEq(nativeWorst, 0);
    }

    function test_anApprovalNamesItsSpenderInTheArgument() public {
        (, Reach r) = _mint(alice);
        Permit2ish permit2 = new Permit2ish();
        bytes4 approve4 = bytes4(keccak256("approve(address,address,uint160,uint48)"));
        vm.prank(alice);
        r.grantSession(agent, uint64(block.timestamp + 1 days), 0, _noCaps(),
            _addrs(address(permit2), address(gold)), _sels(approve4, APPROVE), 0, 0);
        // Permit2 names the spender SECOND; the first argument is the token
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReachEvents.SpenderNotAllowed.selector, bob));
        r.executeAsSession(address(permit2), 0, abi.encodeWithSelector(approve4, address(gold), bob, uint160(1), uint48(0)));
        vm.prank(agent);
        r.executeAsSession(address(permit2), 0, abi.encodeWithSelector(approve4, address(gold), address(gold), uint160(1), uint48(0)));
        // a plain approve to a stranger is refused; to a named target it passes
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(IReachEvents.SpenderNotAllowed.selector, bob));
        r.executeAsSession(address(gold), 0, _approve(bob, 1));
        vm.prank(agent);
        r.executeAsSession(address(gold), 0, _approve(address(permit2), 1));
        assertEq(gold.allowance(address(r), address(permit2)), 1);
    }

    function test_theHubUnreadableFailsClosed() public {
        (, Reach r) = _mint(alice);
        _grantTransfer(r, alice, agent);
        hub.breakEpoch(true);
        assertFalse(r.sessionCurrent(agent), "a view says no");
        vm.prank(agent);
        vm.expectRevert(Reach.HubUnreadable.selector);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
        vm.prank(alice);
        vm.expectRevert(Reach.HubUnreadable.selector);
        r.grantSession(bob, uint64(block.timestamp + 1 days), 0, _noCaps(), _addrs(address(gold)), _sels(XFER), 0, 0);
        assertSel(r.isValidSignature(bytes32(uint256(1)), ""), bytes4(0xffffffff));
        hub.breakEpoch(false);
        assertTrue(r.sessionCurrent(agent));
    }

    function test_anExpiredOrOverlongSessionIsRefused() public {
        (, Reach r) = _mint(alice);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.SessionTooLong.selector);
        r.grantSession(agent, uint64(block.timestamp + 366 days), 0, _noCaps(), _addrs(address(gold)), _sels(XFER), 0, 0);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.SessionExpired.selector);
        r.grantSession(agent, uint64(block.timestamp), 0, _noCaps(), _addrs(address(gold)), _sels(XFER), 0, 0);
        _grantTransfer(r, alice, agent);
        vm.warp(block.timestamp + 1 days + 1);
        assertFalse(r.sessionCurrent(agent));
        vm.prank(agent);
        vm.expectRevert(IReachEvents.SessionExpired.selector);
        r.executeAsSession(address(gold), 0, _xfer(agent, WAD));
    }
}
