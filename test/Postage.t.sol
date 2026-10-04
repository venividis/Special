// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Parley} from "../src/Parley.sol";
import {Postage} from "../src/Postage.sol";
import {KeyRegistry} from "../src/KeyRegistry.sol";
import {IParleyEvents} from "../src/interfaces/IParley.sol";
import {IPostageEvents, Inbox, Stamp} from "../src/interfaces/IPostage.sol";
import {Transient} from "../src/lib/Transient.sol";
import {SocialHub, SocialDeploy, StubReach} from "./mocks/SocialHub.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {HostileToken} from "./mocks/HostileToken.sol";

/*───────────────────────────────────────────────────────────────────────────
  Priced attention, with the money always on one side of a line.

  Origin: ANIMA test/Comms.test.ts (12), rewritten for the pull ledger and
  the Parley-only entry points (INTACT U4), plus DESIGN.md §14 E3's
  sentences. The failures worth finding: a recipient who reprices a pending
  send, a reply that collects after the window, a stamp that is both
  settled and refunded, a push inside a whisper that hands control to a
  stranger's token, and a price list that survives the sale of the inbox.
───────────────────────────────────────────────────────────────────────────*/
contract PostageTest is Test {
    SocialHub   hub;
    KeyRegistry keys;
    Postage     postage;
    Parley      parley;
    MockERC20   usdc;

    address holder = address(this);     // holds #1, the priced inbox
    address other  = address(0x0777);   // holds #2, the sender
    address carol  = address(0xCA501);  // holds #3, a bystander
    StubReach reach1;
    StubReach reach2;
    uint256 room;

    uint128 constant POSTAGE = 5_000_000;   // 5 USDC
    uint64  constant WINDOW = 1 hours;

    function setUp() public {
        hub = new SocialHub();
        keys = new KeyRegistry();
        SocialDeploy d = new SocialDeploy(address(hub), address(keys));
        postage = d.postage();
        parley = d.parley();
        usdc = new MockERC20("USD Coin", "USDC", 6, 0, false);

        vm.roll(1000);
        vm.warp(1_733_000_000);
        vm.deal(holder, 10 ether);
        vm.deal(other, 10 ether);

        hub.mint(holder);                       // #1
        hub.mint(other);                        // #2
        hub.mint(carol);                        // #3
        reach1 = StubReach(payable(hub.account(1)));
        reach2 = StubReach(payable(hub.account(2)));
        vm.deal(address(reach2), 1 ether);
        room = parley.pairKey(1, 2);

        // the sender's token funds its own postage, from its own account
        usdc.mint(address(reach2), 100_000_000);
        reach2.call(address(usdc), 0, abi.encodeCall(usdc.approve, (address(postage), 100_000_000)));
    }

    function priceInbox(address feeToken, uint128 amount, bool open) internal {
        postage.configureInbox(1, feeToken, amount, WINDOW, open);
    }

    function stampFrom2(uint128 maxPostage) internal returns (uint256 id) {
        vm.prank(other);
        parley.whisperStamped(2, 1, 0, bytes32(0), "may I have a moment", address(usdc), maxPostage);
        id = postage.pendingOf(room);
    }

    function replyFrom1() internal {
        parley.whisper(1, 2, 0, bytes32(0), "you may");
    }

    /*═══════════════ the escrow ═══════════════*/

    function test_escrowsPostageOnStampAndCreditsTheSinkOnReply() public {
        priceInbox(address(usdc), POSTAGE, true);
        uint256 id = stampFrom2(1_000_000_000);
        assertEq(id, 1, "the first stamp is not number one");
        assertEq(usdc.balanceOf(address(postage)), POSTAGE, "the postage was not escrowed");
        assertEq(usdc.balanceOf(address(reach2)), 100_000_000 - POSTAGE, "the token's account did not pay");
        assertEq(usdc.balanceOf(address(reach1)), 0);
        assertEq(postage.owed(address(reach1), address(usdc)), 0, "credited before any reply");

        Stamp memory s = postage.stampOf(id);
        assertEq(s.from, 2); assertEq(s.to, 1); assertEq(s.sender, address(reach2));
        assertEq(s.feeToken, address(usdc)); assertEq(uint256(s.postage), POSTAGE);
        assertEq(uint256(s.replyBy), block.timestamp + WINDOW);
        assertFalse(s.settled); assertFalse(s.refunded);

        replyFrom1();
        // collected only by answering — and only as a credit, until it is pulled
        assertEq(postage.owed(address(reach1), address(usdc)), POSTAGE, "the reply did not credit the sink");
        assertEq(usdc.balanceOf(address(reach1)), 0, "money moved inside a whisper");
        assertEq(postage.pendingOf(room), 0, "the stamp is still pending");
        assertTrue(postage.stampOf(id).settled);

        vm.prank(carol);                        // anyone may pull it to where it belongs
        postage.claimSettled(1, address(usdc));
        assertEq(usdc.balanceOf(address(reach1)), POSTAGE, "the sink was not paid");
        assertEq(postage.owed(address(reach1), address(usdc)), 0);
        vm.expectRevert(IPostageEvents.NothingOwed.selector);
        postage.claimSettled(1, address(usdc));
    }

    function test_refundsTheSenderWhenTheRecipientIgnoresTheMail() public {
        priceInbox(address(usdc), POSTAGE, true);
        uint256 id = stampFrom2(POSTAGE);

        vm.expectRevert(IPostageEvents.ReplyWindowOpen.selector);
        postage.expire(id);
        vm.expectRevert(IPostageEvents.StampPending.selector);
        postage.claimRefund(id);

        vm.warp(block.timestamp + WINDOW + 1);
        vm.prank(carol);                        // permissionless: nobody chases anybody
        postage.expire(id);
        assertTrue(postage.stampOf(id).refunded);
        assertEq(postage.pendingOf(room), 0);
        assertEq(postage.owed(address(reach2), address(usdc)), POSTAGE, "the refund was not credited");

        vm.prank(carol);
        postage.claimRefund(id);
        assertEq(usdc.balanceOf(address(reach2)), 100_000_000, "the sender's account was not made whole");

        // once refunded, the more specific error wins over the window check
        vm.expectRevert(IPostageEvents.AlreadyRefunded.selector);
        postage.expire(id);
    }

    /// @dev A late answer is still speech — the archive takes it — but it
    ///      collects nothing, and the sender's money comes back.
    function test_aLateReplyIsSaidButDoesNotCollect() public {
        priceInbox(address(usdc), POSTAGE, true);
        uint256 id = stampFrom2(POSTAGE);
        vm.warp(block.timestamp + WINDOW + 1);

        replyFrom1();                           // not refused
        (, uint64 count,,,,,,,,,) = parley.stateOf(room);
        assertEq(count, 2, "the late reply was not recorded");
        assertEq(postage.owed(address(reach1), address(usdc)), 0, "a late reply collected");
        assertEq(postage.pendingOf(room), id, "a late reply resolved the stamp");

        postage.expire(id);
        postage.claimRefund(id);
        assertEq(usdc.balanceOf(address(reach2)), 100_000_000);
    }

    function test_exactlyOneOfSettledOrRefunded() public {
        priceInbox(address(usdc), POSTAGE, true);
        uint256 t0 = block.timestamp;

        // settled first: no refund, ever
        uint256 a = stampFrom2(POSTAGE);
        replyFrom1();
        vm.warp(t0 + WINDOW + 1);
        vm.expectRevert(IPostageEvents.AlreadySettled.selector);
        postage.expire(a);
        vm.expectRevert(IPostageEvents.AlreadySettled.selector);
        postage.claimRefund(a);
        Stamp memory sa = postage.stampOf(a);
        assertTrue(sa.settled && !sa.refunded);

        // refunded first: no settlement, ever (a reply after expiry is speech only)
        uint256 b = stampFrom2(POSTAGE);
        vm.warp(t0 + 2 * WINDOW + 2);
        postage.expire(b);
        replyFrom1();
        Stamp memory sb = postage.stampOf(b);
        assertTrue(sb.refunded && !sb.settled, "a reply after the refund settled it");
        assertEq(postage.owed(address(reach1), address(usdc)), POSTAGE, "the sink has more than one stamp's worth");
        assertEq(postage.owed(address(reach2), address(usdc)), POSTAGE);

        // and the two ledgers together are exactly the two stamps
        assertEq(usdc.balanceOf(address(postage)), 2 * POSTAGE);
        postage.claimSettled(1, address(usdc));
        postage.claimRefund(b);
        assertEq(usdc.balanceOf(address(postage)), 0, "value was created or lost");
    }

    /*═══════════════ the sender's bounds ═══════════════*/

    /// @dev ANIMA's repricing regressions: the recipient controls the live
    ///      price, so the sender states the most it will pay and in what.
    function test_postageAboveMaxIsRefused() public {
        priceInbox(address(usdc), POSTAGE, true);

        vm.prank(other);
        vm.expectRevert(IPostageEvents.PostageAboveMax.selector);
        parley.whisperStamped(2, 1, 0, bytes32(0), "cheaply", address(usdc), POSTAGE - 1);

        vm.prank(other);
        vm.expectRevert(IPostageEvents.UnexpectedFeeToken.selector);
        parley.whisperStamped(2, 1, 0, bytes32(0), "in the wrong coin", address(0), POSTAGE);

        assertEq(usdc.balanceOf(address(postage)), 0, "a refused stamp moved money");
        stampFrom2(POSTAGE);                    // exactly the max is fine
        assertEq(usdc.balanceOf(address(postage)), POSTAGE);
    }

    /// @dev The recipient reprices between the sender's read and the send.
    function test_aRepricedInboxFailsTheSendInsteadOfOverpaying() public {
        priceInbox(address(usdc), POSTAGE, true);
        priceInbox(address(usdc), POSTAGE * 10, true);       // raised in the mempool
        vm.prank(other);
        vm.expectRevert(IPostageEvents.PostageAboveMax.selector);
        parley.whisperStamped(2, 1, 0, bytes32(0), "at the old price", address(usdc), POSTAGE);
    }

    /*═══════════════ the inbox rules in Parley ═══════════════*/

    function test_aPricedInboxRefusesAnUnstampedStrangerUntilTheHolderReplies() public {
        priceInbox(address(usdc), POSTAGE, true);

        vm.prank(other);
        vm.expectRevert(Parley.PostageDue.selector);
        parley.whisper(2, 1, 0, bytes32(0), "for free");

        stampFrom2(POSTAGE);
        replyFrom1();                                       // consent
        vm.prank(other);
        parley.whisper(2, 1, 0, bytes32(0), "and now for free");  // admitted

        // consent is the holder's own word in the pair, stamped or not
        hub.mint(carol);                                    // #4
        vm.prank(carol);
        vm.expectRevert(Parley.PostageDue.selector);
        parley.whisper(4, 1, 0, bytes32(0), "a stranger");
        parley.whisper(1, 4, 0, bytes32(0), "hello stranger");
        vm.prank(carol);
        parley.whisper(4, 1, 0, bytes32(0), "not a stranger any more");
    }

    function test_aClosedInboxRefusesStrangersUntilTheHolderWrites() public {
        priceInbox(address(0), 0, false);

        vm.prank(other);
        vm.expectRevert(IPostageEvents.InboxClosed.selector);
        parley.whisper(2, 1, 0, bytes32(0), "knock");
        vm.prank(other);
        vm.expectRevert(IPostageEvents.InboxClosed.selector);
        parley.whisperStamped(2, 1, 0, bytes32(0), "knock, with money", address(0), 0);

        replyFrom1();                                       // the holder opens the pair
        vm.prank(other);
        parley.whisper(2, 1, 0, bytes32(0), "thanks");
    }

    /// @dev Consent is keyed by the recipient's custody epoch like every
    ///      delegated thing: the seller's reply does not open the buyer's door.
    function test_consentDiesWithTheSale() public {
        priceInbox(address(usdc), POSTAGE, true);
        replyFrom1();                                       // #1 writes to #2: consent
        vm.prank(other);
        parley.whisper(2, 1, 0, bytes32(0), "free, as agreed");

        hub.transferFrom(holder, carol, 1);
        vm.prank(carol);
        postage.configureInbox(1, address(usdc), POSTAGE, WINDOW, true);
        vm.prank(other);
        vm.expectRevert(Parley.PostageDue.selector);
        parley.whisper(2, 1, 0, bytes32(0), "free, as agreed with the last holder");
    }

    function test_inboxConfigIsStaleAfterSale() public {
        priceInbox(address(usdc), POSTAGE, false);
        Inbox memory box = postage.inboxOf(1);
        assertEq(box.feeToken, address(usdc)); assertEq(uint256(box.postage), POSTAGE);
        assertEq(uint256(box.epoch), 1); assertFalse(box.open);

        hub.transferFrom(holder, carol, 1);
        box = postage.inboxOf(1);
        assertTrue(box.open, "a sold inbox is still closed");
        assertEq(uint256(box.postage), 0, "a sold inbox still has a price");
        assertEq(box.feeToken, address(0));
        assertEq(uint256(box.epoch), 0);

        // the stranger is admitted now, free, without the buyer lifting a finger
        vm.prank(other);
        parley.whisper(2, 1, 0, bytes32(0), "welcome, new holder");
        vm.prank(other);
        parley.whisperStamped(2, 1, 0, bytes32(0), "and with a stamp that escrows nothing", address(0), 0);
        assertEq(postage.pendingOf(room), 0, "a free inbox produced a stamp");

        // a buy-back revives nothing
        vm.prank(carol);
        hub.transferFrom(carol, holder, 1);
        assertTrue(postage.inboxOf(1).open, "away-and-back revived the price list");
    }

    function test_onlyTheHolderConfiguresAndTheWindowIsBounded() public {
        vm.prank(other);
        vm.expectRevert(IPostageEvents.NotHolder.selector);
        postage.configureInbox(1, address(usdc), POSTAGE, WINDOW, true);
        vm.prank(address(reach1));
        vm.expectRevert(IPostageEvents.NotHolder.selector);
        postage.configureInbox(1, address(usdc), POSTAGE, WINDOW, true);

        vm.expectRevert(IPostageEvents.BadReplyWindow.selector);
        postage.configureInbox(1, address(usdc), POSTAGE, 5 minutes - 1, true);
        vm.expectRevert(IPostageEvents.BadReplyWindow.selector);
        postage.configureInbox(1, address(usdc), POSTAGE, 30 days + 1, true);
        postage.configureInbox(1, address(usdc), POSTAGE, 5 minutes, true);
        postage.configureInbox(1, address(usdc), POSTAGE, 30 days, true);
    }

    /*═══════════════ native postage ═══════════════*/

    function test_nativePostageIsEscrowedAndPaidOrRefunded() public {
        priceInbox(address(0), 0.1 ether, true);

        vm.prank(other);
        vm.expectRevert(IPostageEvents.WrongValue.selector);
        parley.whisperStamped{value: 0.05 ether}(2, 1, 0, bytes32(0), "short", address(0), 1 ether);

        vm.prank(other);
        parley.whisperStamped{value: 0.1 ether}(2, 1, 0, bytes32(0), "paid", address(0), 1 ether);
        assertEq(address(postage).balance, 0.1 ether);
        uint256 id = postage.pendingOf(room);

        replyFrom1();
        uint256 before = address(reach1).balance;
        postage.claimSettled(1, address(0));
        assertEq(address(reach1).balance - before, 0.1 ether, "the sink was not paid in ether");
        assertEq(address(postage).balance, 0);

        // and the refund path, into the sender's own account
        uint256 t0 = block.timestamp;
        vm.prank(other);
        parley.whisperStamped{value: 0.1 ether}(2, 1, 0, bytes32(0), "paid again", address(0), 1 ether);
        id = postage.pendingOf(room);
        vm.warp(t0 + WINDOW + 1);
        postage.expire(id);
        before = address(reach2).balance;
        postage.claimRefund(id);
        assertEq(address(reach2).balance - before, 0.1 ether, "the refund did not reach the sender's account");

        // value sent with an ERC-20 stamp is refused, not kept
        priceInbox(address(usdc), POSTAGE, true);
        vm.prank(other);
        vm.expectRevert(IPostageEvents.WrongValue.selector);
        parley.whisperStamped{value: 1 wei}(2, 1, 0, bytes32(0), "with change", address(usdc), POSTAGE);
    }

    /// @dev The push happens at claim time, not inside the whisper: a sink
    ///      that refuses ether cannot block the reply, only its own payout.
    function test_settlementIsPulledNotPushed() public {
        priceInbox(address(0), 0.1 ether, true);
        hub.setFeesToGrip(1, true);
        StubReach grip = StubReach(payable(hub.grip(1)));
        grip.setRefuse(true);

        vm.prank(other);
        parley.whisperStamped{value: 0.1 ether}(2, 1, 0, bytes32(0), "paid", address(0), 1 ether);
        replyFrom1();                                       // the reply is not blocked
        assertEq(postage.owed(address(grip), address(0)), 0.1 ether, "credited to the wrong sink");

        vm.expectRevert(IPostageEvents.TransferFailed.selector);
        postage.claimSettled(1, address(0));
        assertEq(postage.owed(address(grip), address(0)), 0.1 ether, "a failed pull lost the credit");

        grip.setRefuse(false);
        postage.claimSettled(1, address(0));
        assertEq(address(grip).balance, 0.1 ether, "the Grip was not paid once it could receive");
    }

    /*═══════════════ who may do what ═══════════════*/

    function test_onlyParleyMayStampOrSettle() public {
        priceInbox(address(usdc), POSTAGE, true);
        vm.expectRevert(IPostageEvents.NotParley.selector);
        postage.stamp(room, 2, 1, address(usdc), POSTAGE);
        vm.expectRevert(IPostageEvents.NotParley.selector);
        postage.settle(room);
        vm.prank(other);
        vm.expectRevert(IPostageEvents.NotParley.selector);
        postage.stamp(room, 2, 1, address(usdc), POSTAGE);
    }

    function test_nobodyStampsAsATokenTheyDoNotHold() public {
        priceInbox(address(usdc), POSTAGE, true);
        vm.prank(carol);
        vm.expectRevert(IParleyEvents.NotYours.selector);
        parley.whisperStamped(2, 1, 0, bytes32(0), "as somebody else", address(usdc), POSTAGE);

        // the seller cannot stamp as the token once it is sold; the account still can
        vm.prank(other);
        hub.transferFrom(other, carol, 2);
        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotYours.selector);
        parley.whisperStamped(2, 1, 0, bytes32(0), "as my old token", address(usdc), POSTAGE);
        reach2.call(address(parley), 0, abi.encodeCall(parley.whisperStamped,
            (2, 1, 0, bytes32(0), "as myself", address(usdc), POSTAGE)));
        assertEq(usdc.balanceOf(address(postage)), POSTAGE);
    }

    function test_aStampIsOnePerPairUntilResolved() public {
        priceInbox(address(usdc), POSTAGE, true);
        uint256 a = stampFrom2(POSTAGE);
        vm.prank(other);
        vm.expectRevert(IPostageEvents.StampPending.selector);
        parley.whisperStamped(2, 1, 0, bytes32(0), "again", address(usdc), POSTAGE);
        assertEq(usdc.balanceOf(address(postage)), POSTAGE, "a refused second stamp took money");

        replyFrom1();
        uint256 b = stampFrom2(POSTAGE);
        assertEq(b, a + 1);
        assertEq(usdc.balanceOf(address(postage)), 2 * POSTAGE);
    }

    function test_aFreeInboxStampsNothing() public {
        priceInbox(address(0), 0, true);
        vm.prank(other);
        vm.expectRevert(IPostageEvents.WrongValue.selector);
        parley.whisperStamped{value: 1 wei}(2, 1, 0, bytes32(0), "tip", address(0), 1 ether);
        vm.prank(other);
        parley.whisperStamped(2, 1, 0, bytes32(0), "free", address(0), 0);
        assertEq(postage.pendingOf(room), 0);
        vm.expectRevert(IPostageEvents.NoSuchStamp.selector);
        postage.expire(1);
    }

    /// @dev An empty body is refused before any money moves, and a stamped
    ///      sealed send pins the key like an unstamped one.
    function test_aBadStampedSendMovesNoMoney() public {
        priceInbox(address(usdc), POSTAGE, true);
        vm.prank(other);
        vm.expectRevert(IParleyEvents.BadBody.selector);
        parley.whisperStamped(2, 1, 0, bytes32(0), "", address(usdc), POSTAGE);

        keys.setEncryptionKey(3, hex"04aa");
        parley.bindKey(1);
        vm.prank(other);
        vm.expectRevert(IParleyEvents.KeyMoved.selector);
        parley.whisperStamped(2, 1, 1, keccak256("not that key"), "sealed", address(usdc), POSTAGE);
        assertEq(usdc.balanceOf(address(postage)), 0, "a refused send escrowed postage");

        vm.prank(other);
        parley.whisperStamped(2, 1, 1, keccak256(hex"04aa"), "sealed", address(usdc), POSTAGE);
        assertEq(usdc.balanceOf(address(postage)), POSTAGE);
    }

    /*═══════════════ re-entrancy ═══════════════*/

    /// @dev A fee token with a transfer hook gets control in the middle of
    ///      `stamp`, inside Parley's `whisperStamped`. It holds a token of
    ///      its own, so a word from it would be legitimate — and it is
    ///      refused anyway, because the lock is held. The same word, sent
    ///      when nothing is in flight, is accepted: the refusal is the
    ///      lock's, not the brake's.
    function test_aHookedFeeTokenCannotReenterParley() public {
        HostileToken hooked = new HostileToken();
        hub.mint(address(hooked));                          // #4, held by the token contract
        hooked.mint(address(reach2), 100_000_000);
        reach2.call(address(hooked), 0, abi.encodeCall(hooked.approve, (address(postage), 100_000_000)));
        postage.configureInbox(1, address(hooked), POSTAGE, WINDOW, true);

        hooked.arm(address(parley), abi.encodeCall(parley.speak, (0, 4, 0, 0, 0, "from inside the hook")));
        vm.prank(other);
        parley.whisperStamped(2, 1, 0, bytes32(0), "paid in a hooked coin", address(hooked), POSTAGE);
        assertTrue(hooked.reentered(), "the hook never fired, so this proves nothing");
        (, uint64 commons,,,,,,,,,) = parley.stateOf(0);
        assertEq(commons, 0, "the hook spoke in the commons from inside a stamp");
        assertEq(hooked.balanceOf(address(postage)), POSTAGE, "the stamp itself was lost");
        assertFalse(Transient.held(Transient.PARLEY_LOCK), "the lock outlived the call");

        // the control: the same word, outside any call, is a word
        vm.prank(address(hooked));
        parley.speak(0, 4, 0, 0, 0, "from outside");
        (, commons,,,,,,,,,) = parley.stateOf(0);
        assertEq(commons, 1);
    }
}
