// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Steward} from "../src/Steward.sol";
import {ISteward, IStewardEvents, Will} from "../src/interfaces/ISteward.sol";
import {AccountBinding} from "../src/lib/AccountBinding.sol";
import {MockHubForVault, StubAccountImpl} from "./mocks/MockHubForVault.sol";
import {MockRegistry6551} from "./mocks/MockRegistry6551.sol";

/*  DESIGN.md §9.4 and §14 B7: `stewardTransfer` only; void on transfer;
    ≥ 2 guardians; one count per guardian per nonce; a stranger is not
    life; an heir waits out a seal.                                      */
contract StewardTest is Test {
    uint64 constant T0 = 1_733_000_000;
    uint64 constant QUIET = 60 days;
    uint64 constant NOTICE = 30 days;
    bytes32 constant SALT = keccak256("a secret the heir keeps");

    MockHubForVault hub;
    Steward steward;
    address reach;
    address heir = address(0xE1);
    address buyer = address(0xB0);
    address stranger = address(0x5712);
    address market = address(0xAA);
    address g1 = address(0x61);
    address g2 = address(0x62);
    address g3 = address(0x63);

    function setUp() public {
        vm.warp(T0);
        vm.etch(AccountBinding.REGISTRY, type(MockRegistry6551).runtimeCode);
        StubAccountImpl impl = new StubAccountImpl();
        hub = new MockHubForVault(address(impl), address(impl));
        steward = new Steward(address(hub));
        hub.wire(address(steward), market, address(0));
        hub.mint(address(this));
        hub.mint(address(this));
        hub.mint(address(this));
        reach = hub.createReach(1);
    }

    function _arrange(uint256 id) internal {
        address[] memory none;
        steward.arrange(id, steward.heirHashOf(heir, SALT), QUIET, NOTICE, none, 0);
    }

    function _guardians() internal view returns (address[] memory g) {
        g = new address[](3);
        g[0] = g1; g[1] = g2; g[2] = g3;
    }

    function test_aStrangerCannotResetSilence() public {
        _arrange(1);
        assertEq(steward.wouldPass(1), steward.SPEAKING());
        vm.warp(T0 + QUIET + 1);
        assertEq(steward.wouldPass(1), steward.SUMMONABLE());

        // a stranger's call against the token is not life (the `embody` lesson)
        vm.prank(stranger);
        hub.touch(1);
        assertEq(steward.wouldPass(1), steward.SUMMONABLE(), "a stranger touching the token does not reset the silence");

        // nor is a stranger's, an operator's or the Reach's word
        vm.prank(stranger);
        vm.expectRevert(IStewardEvents.NotHolder.selector);
        steward.stillHere(1);

        hub.approve(stranger, 1);
        vm.prank(stranger);
        vm.expectRevert(IStewardEvents.NotHolder.selector);
        steward.stillHere(1);
        vm.prank(stranger);
        vm.expectRevert(IStewardEvents.NotHolder.selector);
        steward.stillHereUnderDuress(1);
        address[] memory none;
        bytes32 hs = steward.heirHashOf(stranger, SALT);   // hoisted: an inline call would eat the prank
        vm.prank(stranger);
        vm.expectRevert(IStewardEvents.NotHolder.selector);
        steward.arrange(1, hs, QUIET, NOTICE, none, 0);

        vm.prank(reach);
        vm.expectRevert(IStewardEvents.NotHolder.selector);
        steward.stillHere(1);
        assertEq(steward.wouldPass(1), steward.SUMMONABLE(), "every refused word left it summonable");

        // only the holder's own word
        uint32 nonce = steward.getWill(1).nonce;
        steward.stillHere(1);
        Will memory w = steward.getWill(1);
        assertEq(steward.wouldPass(1), steward.SPEAKING());
        assertEq(w.lastLife, T0 + QUIET + 1);
        assertEq(w.nonce, nonce + 1, "a sign of life invalidates every attestation");
    }

    function test_summonTwiceReverts() public {
        _arrange(1);
        vm.expectRevert(abi.encodeWithSelector(IStewardEvents.StillSpeaking.selector, T0 + QUIET));
        steward.summon(1, heir, SALT);

        vm.warp(T0 + QUIET);
        vm.expectRevert(IStewardEvents.WrongHeir.selector);
        steward.summon(1, stranger, SALT);
        vm.expectRevert(IStewardEvents.WrongHeir.selector);
        steward.summon(1, heir, keccak256("wrong"));

        vm.prank(stranger);
        steward.summon(1, heir, SALT);
        uint64 due = steward.getWill(1).due;
        assertEq(due, T0 + QUIET + NOTICE);
        assertEq(steward.wouldPass(1), steward.WAITING());
        assertTrue(hub.locked(1), "the notice holds the module lock");

        // the first knock stands: nobody can move the heir's deadline
        vm.warp(T0 + QUIET + NOTICE - 1);
        vm.prank(heir);
        vm.expectRevert(IStewardEvents.AlreadyCalled.selector);
        steward.summon(1, heir, SALT);
        assertEq(steward.getWill(1).due, due, "the deadline did not move");
        vm.expectRevert(abi.encodeWithSelector(IStewardEvents.NotYet.selector, due));
        steward.execute(1);

        vm.warp(due);
        assertEq(steward.wouldPass(1), steward.OK());
        vm.expectRevert(IStewardEvents.AlreadyCalled.selector);
        steward.summon(1, heir, SALT);

        // anybody may press the button; only the named party receives
        vm.prank(stranger);
        steward.execute(1);
        assertEq(hub.ownerOf(1), heir);
        assertFalse(hub.locked(1), "the lock was consumed");
        assertEq(hub.custodyEpoch(1), 2, "a steward move is a custody change");
        assertEq(steward.wouldPass(1), steward.NO_PLAN(), "and the plan is spent");
        assertEq(steward.planHash(1), bytes32(0));
    }

    function test_aPlanIsVoidAfterSale() public {
        _arrange(1);
        assertTrue(steward.planHash(1) != bytes32(0));
        hub.transferFrom(address(this), buyer, 1);
        assertEq(steward.wouldPass(1), steward.SOLD());
        assertEq(steward.planHash(1), bytes32(0), "a void plan hashes like no plan");

        vm.warp(T0 + QUIET + 1);
        vm.expectRevert(IStewardEvents.Void.selector);
        steward.summon(1, heir, SALT);
        vm.prank(buyer);
        vm.expectRevert(IStewardEvents.Void.selector);
        steward.stillHere(1);

        // buying it back revives nothing: the epoch moved twice
        vm.prank(buyer);
        hub.transferFrom(buyer, address(this), 1);
        assertEq(steward.wouldPass(1), steward.SOLD());
        vm.expectRevert(IStewardEvents.Void.selector);
        steward.summon(1, heir, SALT);

        // the holder arranges afresh, and the old notice terms do not bind them
        address[] memory none;
        steward.arrange(1, steward.heirHashOf(buyer, SALT), QUIET, 14 days, none, 0);
        assertEq(steward.wouldPass(1), steward.SPEAKING());
        assertEq(steward.getWill(1).epoch, 3);

        // a panic voids a plan without a transfer — even one mid-notice,
        // and then anyone may clear the lock it left behind
        _arrange(2);
        vm.warp(T0 + 2 * QUIET + 2);
        steward.summon(2, heir, SALT);
        assertTrue(hub.locked(2));
        hub.panic(2);
        assertEq(steward.wouldPass(2), steward.SOLD());
        vm.warp(T0 + 2 * QUIET + 2 + NOTICE);
        vm.expectRevert(IStewardEvents.Void.selector);
        steward.execute(2);
        vm.prank(stranger);
        steward.cancel(2);
        assertFalse(hub.locked(2), "a void notice's lock is anyone's to release");
        _arrange(2);
        assertEq(steward.wouldPass(2), steward.SPEAKING());
    }

    function test_oneGuardianCannotRecoverAlone() public {
        address[] memory one = new address[](1);
        one[0] = g1;
        bytes32 h = steward.heirHashOf(heir, SALT);
        vm.expectRevert(IStewardEvents.BadGuardians.selector);
        steward.arrange(1, h, QUIET, NOTICE, one, 1);

        address[] memory twins = new address[](2);
        twins[0] = g1; twins[1] = g1;
        vm.expectRevert(IStewardEvents.BadGuardians.selector);
        steward.arrange(1, h, QUIET, NOTICE, twins, 2);
        twins[1] = address(0);
        vm.expectRevert(IStewardEvents.BadGuardians.selector);
        steward.arrange(1, h, QUIET, NOTICE, twins, 2);

        address[] memory six = new address[](6);
        for (uint160 i; i < 6; ++i) six[i] = address(0x100 + i);
        vm.expectRevert(IStewardEvents.BadGuardians.selector);
        steward.arrange(1, h, QUIET, NOTICE, six, 2);

        address[] memory three = _guardians();
        vm.expectRevert(IStewardEvents.BadThreshold.selector);
        steward.arrange(1, h, QUIET, NOTICE, three, 1);
        vm.expectRevert(IStewardEvents.BadThreshold.selector);
        steward.arrange(1, h, QUIET, NOTICE, three, 4);
        address[] memory none;
        vm.expectRevert(IStewardEvents.BadThreshold.selector);
        steward.arrange(1, h, QUIET, NOTICE, none, 1);

        steward.arrange(1, h, QUIET, NOTICE, three, 2);
        uint32 nonce = steward.getWill(1).nonce;

        // who may speak, and about what
        vm.prank(stranger);
        vm.expectRevert(IStewardEvents.NotGuardian.selector);
        steward.attest(1, buyer, nonce);
        vm.prank(g1);
        vm.expectRevert(IStewardEvents.StaleNonce.selector);
        steward.attest(1, buyer, nonce - 1);
        vm.prank(g1);
        vm.expectRevert(IStewardEvents.BadDestination.selector);
        steward.attest(1, address(0), nonce);
        vm.prank(g1);
        vm.expectRevert(ISteward.BadHands.selector);
        steward.attest(1, address(this), nonce);
        vm.prank(g1);
        vm.expectRevert(ISteward.BadHands.selector);
        steward.attest(1, reach, nonce);

        // one guardian is one count, and one count opens nothing
        vm.prank(g1);
        steward.attest(1, buyer, nonce);
        assertEq(steward.getWill(1).due, 0, "no notice on one word");
        assertFalse(hub.locked(1));
        (, , , , uint8 spoken) = steward.getObit(1);
        assertEq(spoken, 1);
        vm.prank(g1);
        vm.expectRevert(IStewardEvents.AlreadyAttested.selector);
        steward.attest(1, buyer, nonce);
        vm.prank(g1);
        vm.expectRevert(IStewardEvents.AlreadyAttested.selector);
        steward.attest(1, stranger, nonce);

        // a second guardian naming a different door opens nothing either
        vm.prank(g2);
        steward.attest(1, stranger, nonce);
        assertEq(steward.getWill(1).due, 0, "two words for two doors is no threshold");

        // the holder speaking up discards every count
        steward.stillHere(1);
        uint32 fresh = steward.getWill(1).nonce;
        assertEq(fresh, nonce + 1);
        vm.prank(g3);
        vm.expectRevert(IStewardEvents.StaleNonce.selector);
        steward.attest(1, buyer, nonce);
        vm.prank(g1);
        steward.attest(1, buyer, fresh);
        assertEq(steward.getWill(1).due, 0, "the old count did not carry over");

        // the threshold, agreed on one door, starts the notice — no silence needed
        vm.prank(g2);
        steward.attest(1, buyer, fresh);
        Will memory w = steward.getWill(1);
        assertEq(w.due, uint64(block.timestamp) + NOTICE);
        assertEq(w.dest, buyer);
        assertTrue(hub.locked(1));
        assertEq(steward.wouldPass(1), steward.WAITING());
        vm.prank(g3);
        vm.expectRevert(IStewardEvents.AlreadyCalled.selector);
        steward.attest(1, buyer, fresh);

        vm.warp(block.timestamp + NOTICE);
        assertEq(steward.wouldPass(1), steward.OK());
        vm.prank(stranger);
        steward.execute(1);
        assertEq(hub.ownerOf(1), buyer, "recovered to where the guardians agreed");
    }

    function test_theOwnerCancelsDuringNotice() public {
        vm.expectRevert(IStewardEvents.NoPlan.selector);
        steward.cancel(3);
        _arrange(1);
        vm.expectRevert(IStewardEvents.NotCalled.selector);
        steward.cancel(1);

        vm.warp(T0 + QUIET);
        steward.summon(1, heir, SALT);
        assertEq(steward.wouldPass(1), steward.WAITING());

        vm.prank(stranger);
        vm.expectRevert(IStewardEvents.NotHolder.selector);
        steward.cancel(1);
        vm.prank(heir);
        vm.expectRevert(IStewardEvents.NotHolder.selector);
        steward.cancel(1);
        assertTrue(hub.locked(1), "the notice still runs");

        uint32 nonce = steward.getWill(1).nonce;
        vm.warp(T0 + QUIET + NOTICE - 1);
        steward.cancel(1);
        Will memory w = steward.getWill(1);
        assertEq(w.due, 0);
        assertEq(w.dest, address(0));
        assertFalse(hub.locked(1), "the lock is released with the notice");
        assertEq(w.lastLife, T0 + QUIET + NOTICE - 1, "cancelling is a sign of life");
        assertEq(w.nonce, nonce + 1);
        assertEq(steward.wouldPass(1), steward.SPEAKING());

        vm.warp(T0 + QUIET + NOTICE);
        vm.expectRevert(IStewardEvents.NotCalled.selector);
        steward.execute(1);
        assertEq(hub.ownerOf(1), address(this), "the heir who was mid-notice gets nothing");
        vm.expectRevert(IStewardEvents.NotCalled.selector);
        steward.cancel(1);
    }

    function test_duressSilentlyMaxesTheNotice() public {
        _arrange(1);
        vm.warp(T0 + 1 days);
        steward.stillHereUnderDuress(1);
        Will memory w = steward.getWill(1);
        assertEq(w.notice, steward.MAX_NOTICE(), "the notice became a year");
        assertTrue(w.duress, "flagged for the heir's page");
        assertEq(w.lastLife, T0 + 1 days, "and it counted as life");
        assertEq(w.quiet, QUIET, "the silence is unchanged");

        // whoever holds the key now cannot shorten what duress bought
        address[] memory none;
        bytes32 hs = steward.heirHashOf(stranger, SALT);
        vm.expectRevert(IStewardEvents.TooShort.selector);
        steward.arrange(1, hs, QUIET, NOTICE, none, 0);
        steward.arrange(1, hs, QUIET, steward.MAX_NOTICE(), none, 0);
        assertTrue(steward.getWill(1).duress, "the flag survives a re-arrangement");

        vm.warp(T0 + 1 days + QUIET);
        steward.summon(1, stranger, SALT);
        assertEq(steward.getWill(1).due, T0 + 1 days + QUIET + 365 days, "the knock waits a year");

        // an ordinary heartbeat keeps the year too; only a new custody starts over
        steward.stillHere(1);
        assertEq(steward.getWill(1).notice, 365 days);
        hub.transferFrom(address(this), buyer, 1);
        bytes32 hh = steward.heirHashOf(heir, SALT);
        vm.prank(buyer);
        steward.arrange(1, hh, QUIET, NOTICE, none, 0);
        w = steward.getWill(1);
        assertEq(w.notice, NOTICE);
        assertFalse(w.duress, "a buyer starts clean");
    }

    function test_anHeirWaitsOutASeal() public {
        _arrange(1);
        hub.sealTransfer(1, T0 + 200 days);
        vm.warp(T0 + QUIET);
        steward.summon(1, heir, SALT);
        vm.warp(T0 + QUIET + NOTICE);
        assertEq(steward.wouldPass(1), steward.LOCKED(), "the seal is named before anyone presses");
        vm.expectRevert(abi.encodeWithSelector(MockHubForVault.IsTransferSealed.selector, 1));
        steward.execute(1);
        assertEq(hub.ownerOf(1), address(this));
        assertTrue(hub.locked(1), "the refused move left the notice standing");
        assertEq(steward.getWill(1).due, T0 + QUIET + NOTICE, "and its deadline");

        vm.warp(T0 + 200 days);
        assertEq(steward.wouldPass(1), steward.OK());
        steward.execute(1);
        assertEq(hub.ownerOf(1), heir, "once the seal has run, the heir receives");

        // another module's lock is waited out the same way
        _arrange(2);
        vm.warp(T0 + 200 days + QUIET);
        steward.summon(2, heir, SALT);
        vm.prank(market);
        hub.moduleLock(2);
        vm.warp(T0 + 200 days + QUIET + NOTICE);
        assertEq(steward.wouldPass(2), steward.LOCKED());
        vm.expectRevert(abi.encodeWithSelector(MockHubForVault.IsLocked.selector, 2));
        steward.execute(2);
        vm.prank(market);
        hub.moduleUnlock(2);
        assertEq(steward.wouldPass(2), steward.OK());

        // and so is a guardian hold
        hub.setGuardianHold(2, true);
        assertEq(steward.wouldPass(2), steward.LOCKED());
        vm.expectRevert(abi.encodeWithSelector(MockHubForVault.IsLocked.selector, 2));
        steward.execute(2);
        hub.setGuardianHold(2, false);
        steward.execute(2);
        assertEq(hub.ownerOf(2), heir);
    }

    function test_theHeirMayBeWhoeverHoldsTokenN() public {
        address[] memory none;
        steward.arrange(1, steward.heirHashOfToken(2, SALT), QUIET, NOTICE, none, 0);
        hub.transferFrom(address(this), heir, 2);
        vm.warp(T0 + QUIET);

        // the address shape of the same preimage is not the token shape
        vm.expectRevert(IStewardEvents.WrongHeir.selector);
        steward.summon(1, heir, SALT);
        steward.summon(1, address(uint160(2)), SALT);
        (, , address dest, , ) = steward.getObit(1);
        assertEq(dest, heir, "resolved to whoever holds token 2");

        // the instrument changes hands during the notice; the estate follows it
        vm.prank(heir);
        hub.transferFrom(heir, buyer, 2);
        (, , dest, , ) = steward.getObit(1);
        assertEq(dest, buyer, "resolved live, not frozen at the knock");
        vm.warp(T0 + QUIET + NOTICE);
        assertEq(steward.wouldPass(1), steward.OK());
        steward.execute(1);
        assertEq(hub.ownerOf(1), buyer);

        // an instrument nobody holds is no heir
        steward.arrange(3, steward.heirHashOfToken(99, SALT), QUIET, NOTICE, none, 0);
        vm.warp(T0 + 2 * QUIET + NOTICE);
        vm.expectRevert(IStewardEvents.BadDestination.selector);
        steward.summon(3, address(uint160(99)), SALT);

        // naming the token's own holder is bad hands, caught at the knock
        steward.arrange(3, steward.heirHashOfToken(3, SALT), QUIET, NOTICE, none, 0);
        vm.warp(T0 + 3 * QUIET + NOTICE);
        vm.expectRevert(ISteward.BadHands.selector);
        steward.summon(3, address(uint160(3)), SALT);
    }

    function test_wouldPassCoversEveryStatus() public {
        assertEq(steward.NO_PLAN(), 0);
        assertEq(steward.SOLD(), 1);
        assertEq(steward.SPEAKING(), 2);
        assertEq(steward.SUMMONABLE(), 3);
        assertEq(steward.WAITING(), 4);
        assertEq(steward.LOCKED(), 5);
        assertEq(steward.BAD_HANDS(), 6);
        assertEq(steward.OK(), 7);

        assertEq(steward.wouldPass(1), 0, "NO_PLAN");
        _arrange(1);
        assertEq(steward.wouldPass(1), 2, "SPEAKING");
        vm.warp(T0 + QUIET);
        assertEq(steward.wouldPass(1), 3, "SUMMONABLE");
        steward.summon(1, heir, SALT);
        assertEq(steward.wouldPass(1), 4, "WAITING");
        vm.warp(T0 + QUIET + NOTICE);
        assertEq(steward.wouldPass(1), 7, "OK");
        hub.sealTransfer(1, T0 + QUIET + NOTICE + 1 days);
        assertEq(steward.wouldPass(1), 5, "LOCKED");
        (uint8 status, uint64 due, address dest, , ) = steward.getObit(1);
        assertEq(status, 5, "the obit carries the same status");
        assertEq(due, T0 + QUIET + NOTICE);
        assertEq(dest, heir);

        // BAD_HANDS: an instrument heir whose holder became the token's own
        address[] memory none;
        steward.arrange(2, steward.heirHashOfToken(3, SALT), QUIET, NOTICE, none, 0);
        hub.transferFrom(address(this), heir, 3);
        vm.warp(T0 + 2 * QUIET + NOTICE);
        steward.summon(2, address(uint160(3)), SALT);
        vm.warp(T0 + 2 * QUIET + 2 * NOTICE);
        assertEq(steward.wouldPass(2), 7);
        vm.prank(heir);
        hub.transferFrom(heir, address(this), 3);
        assertEq(steward.wouldPass(2), 6, "BAD_HANDS");
        vm.expectRevert(ISteward.BadHands.selector);
        steward.execute(2);

        // SOLD
        _arrange(3);
        hub.panic(3);
        assertEq(steward.wouldPass(3), 1, "SOLD");
    }
}
