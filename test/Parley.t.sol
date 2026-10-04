// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Parley} from "../src/Parley.sol";
import {Postage} from "../src/Postage.sol";
import {Roster} from "../src/Roster.sol";
import {KeyRegistry} from "../src/KeyRegistry.sol";
import {IParleyEvents} from "../src/interfaces/IParley.sol";
import {IKeyRegistry} from "../src/interfaces/IKeyRegistry.sol";
import {IPostageEvents} from "../src/interfaces/IPostage.sol";
import {SocialHub, SocialDeploy, StubReach} from "./mocks/SocialHub.sol";

/*───────────────────────────────────────────────────────────────────────────
  A chat with no server is a chat you can be locked out of by arithmetic.

  Origin: IPSEITY test/Parley.t.sol (26), ported onto INTACT's hub shape
  (U4), plus the sentences DESIGN.md §7 and §14 E1 name. The interesting
  failures here are not "a message is stored". They are the ones where the
  wrong party gets to speak as somebody else's token, where a room key
  collides with another room, where the back-link that makes the archive
  readable stops going backwards, where a list a stranger can grow becomes
  a list a stranger can fill — and, new here, where a seller's cooldown or
  key outlives the sale.
───────────────────────────────────────────────────────────────────────────*/
contract ParleyTest is Test {
    SocialHub   hub;
    KeyRegistry keys;
    Postage     postage;
    Parley      parley;
    Roster      roster;

    address holder = address(this);
    address other  = address(0x0777);
    address nobody = address(0xDEAD);

    function setUp() public {
        hub = new SocialHub();
        keys = new KeyRegistry();
        SocialDeploy d = new SocialDeploy(address(hub), address(keys));
        postage = d.postage();
        parley = d.parley();
        roster = new Roster(address(parley), address(hub));

        vm.deal(holder, 10 ether);
        vm.deal(other, 10 ether);
        vm.roll(1000);
        vm.warp(1_733_000_000);

        hub.mint(holder);                                 // #1, this contract
        hub.mint(other);                                  // #2, `other`
    }

    function say(uint256 room, uint256 from, bytes memory body) internal {
        parley.speak(room, from, 0, 0, 0, body);
    }

    function sayAs(address who, uint256 room, uint256 from, bytes memory body) internal {
        vm.prank(who);
        parley.speak(room, from, 0, 0, 0, body);
    }

    function countOf(uint256 room) internal view returns (uint64 count) {
        (, count,,,,,,,,,) = parley.stateOf(room);
    }

    function lastOf(uint256 room) internal view returns (uint64 last) {
        (last,,,,,,,,,,) = parley.stateOf(room);
    }

    /*═══════════════ the wiring ═══════════════*/

    /// @dev DESIGN §7.4: "`Postage`'s `PARLEY` and Parley's `POSTAGE` are
    ///      mutual immutables fixed by prediction and asserted". The deploy
    ///      helper predicts Parley before Postage is built; this is the
    ///      assertion that both halves point at each other.
    function test_theMutualImmutablesArePredictedAndAgree() public view {
        assertEq(parley.POSTAGE(), address(postage), "Parley does not know its Postage");
        assertEq(postage.PARLEY(), address(parley), "Postage does not know its Parley");
        assertEq(parley.HUB(), address(hub));
        assertEq(parley.KEYS(), address(keys));
        assertEq(postage.HUB(), address(hub));
    }

    /*═══════════════ who may speak ═══════════════*/

    function test_onlyTheHolderSpeaksAsTheirToken() public {
        vm.prank(nobody);
        vm.expectRevert(IParleyEvents.NotYours.selector);
        parley.speak(0, 1, 0, 0, 0, "hello");

        say(0, 1, "hello");                               // the holder can
        assertEq(countOf(0), 1, "the commons did not record it");
    }

    /// @dev The bound account is the token acting for itself, and its session
    ///      keys are the holder's own delegation. The renter is not: a lease
    ///      buys the instrument's use, not its name.
    function test_theBoundAccountMaySpeakAndTheRenterMayNot() public {
        address bound = hub.account(1);
        assertTrue(parley.mayActAs(1, bound), "the token cannot speak as itself");
        sayAs(bound, 0, 1, "as myself");
        assertEq(countOf(0), 1);

        hub.setUser(1, nobody, uint64(block.timestamp + 1 days));
        assertEq(hub.userOf(1), nobody, "the lease did not take");
        assertFalse(parley.mayActAs(1, nobody), "a renter was given the token's voice");
    }

    function test_aRenterCannotSpeak() public {
        hub.setUser(1, nobody, uint64(block.timestamp + 1 days));
        assertEq(hub.userOf(1), nobody);
        vm.prank(nobody);
        vm.expectRevert(IParleyEvents.NotYours.selector);
        parley.speak(0, 1, 0, 0, 0, "I am renting this voice");
        vm.prank(nobody);
        vm.expectRevert(IParleyEvents.NotYours.selector);
        parley.whisper(1, 2, 0, bytes32(0), "and this one");
        vm.prank(nobody);
        vm.expectRevert(IParleyEvents.NotYours.selector);
        parley.found(1, "renters club", true);
    }

    function test_aTokenThatDoesNotExistHasNoVoice() public {
        assertFalse(parley.mayActAs(99, holder));
        vm.expectRevert(IParleyEvents.NotYours.selector);
        parley.speak(0, 99, 0, 0, 0, "hello");
    }

    /*═══════════════ the back-link, which is the whole archive ═══════════════*/

    /*  The pointer itself is in the log, and reading logs is what the client
        does — `tools/verify-parley.mjs` walks a real archive the way a
        browser does, including the case that breaks a naive walker: two
        messages in one block, where the second one's pointer is its own
        block and a walker that followed it would ask for the same block
        until the node stopped answering.

        What is testable here is the storage half: the head the walk starts
        from, the counter that tells a client whether anything is new, and
        the ring of recent heads.                                         */

    function test_theRoomRemembersWhereItsNewestMessageIs() public {
        uint64 b0 = uint64(block.number);
        say(0, 1, "one");
        assertEq(lastOf(0), b0);

        vm.roll(b0 + 40);
        say(0, 1, "two");
        assertEq(lastOf(0), b0 + 40, "the head did not move");
        assertEq(countOf(0), 2);
    }

    function test_everyRoomKeepsItsOwnHead() public {
        uint256 key = parley.found(1, "elsewhere", true);
        say(0, 1, "in the commons");
        vm.roll(block.number + 9);
        say(key, 1, "in the group");

        assertEq(lastOf(0), block.number - 9, "one room's message moved another room's head");
        assertEq(lastOf(key), block.number);
        assertEq(countOf(0), 1);
        assertEq(countOf(key), 1);
    }

    /*  `at` is read out of the contract rather than out of `block.number`,
        and that is not style. Within one transaction `block.number` cannot
        change, so the optimiser is entitled to read NUMBER once and reuse
        it — and it sinks that read to the first use, which here would be
        *after* `vm.roll`. A cheatcode that moves the block mid-call is
        outside the language's model of the machine; anything that has to
        straddle one reads its evidence from storage.                     */
    function test_aTokenRemembersWhereItLastSpokeWhoeverElseHasSpoken() public {
        say(0, 1, "one");
        uint64 at = parley.lastSpoke(0, 1);
        assertTrue(at != 0, "the first message was not recorded at all");

        vm.roll(block.number + 3);
        sayAs(other, 0, 2, "not mine");

        assertEq(parley.lastSpoke(0, 1), at,
            "somebody else speaking moved this token's own back-link");
        assertTrue(parley.lastSpoke(0, 2) > at,
            "and the token that did speak did not move its own");
    }

    function test_headsAnswersForEveryRoomAtOnce() public {
        uint64 b0 = uint64(block.number);
        uint256 key = parley.found(1, "counted", true);
        say(0, 1, "a");
        vm.roll(b0 + 2);
        say(key, 1, "b");
        vm.roll(b0 + 4);
        say(key, 1, "c");

        uint256[] memory rooms = new uint256[](3);
        rooms[0] = 0;
        rooms[1] = key;
        rooms[2] = parley.groupKey(99);
        uint64[] memory last = parley.heads(rooms);
        assertEq(last.length, 3);
        assertEq(last[0], b0);
        assertEq(last[1], b0 + 4);
        assertEq(last[2], 0, "a room nobody opened has a head");
    }

    /// @dev The ring is the re-entry point once old logs are pruned: the
    ///      last four blocks with a message, newest first, and the seq of
    ///      the newest message in each. A second message in one block moves
    ///      a seq, not a block.
    function test_theRingShiftsOnANewBlockAndNotWithinOne() public {
        uint64 b0 = uint64(block.number);
        say(0, 1, "1");
        sayAs(other, 0, 2, "2");                          // same block, another token
        (,,,,,,,,, uint64[4] memory hb, uint64[4] memory hs) = parley.stateOf(0);
        assertEq(hb[0], b0); assertEq(hs[0], 2, "the second message in a block did not move the lane's seq");
        assertEq(hb[1], 0);  assertEq(hs[1], 0);

        vm.roll(b0 + 5);  say(0, 1, "3");
        vm.roll(b0 + 9);  say(0, 1, "4");
        vm.roll(b0 + 20); say(0, 1, "5");
        vm.roll(b0 + 23); say(0, 1, "6");
        (,,,,,,,,, hb, hs) = parley.stateOf(0);
        assertEq(hb[0], b0 + 23); assertEq(hs[0], 6);
        assertEq(hb[1], b0 + 20); assertEq(hs[1], 5);
        assertEq(hb[2], b0 + 9);  assertEq(hs[2], 4);
        assertEq(hb[3], b0 + 5);  assertEq(hs[3], 3, "the oldest lane is not the fourth block back");
        assertEq(lastOf(0), b0 + 23);
    }

    /*═══════════════ the brakes ═══════════════*/

    /*  Block numbers are captured once, before any roll: within one
        transaction NUMBER cannot change, so the optimiser may read it once
        and sink that read past a `vm.roll` (the IPSEITY lesson above). */
    function test_theCommonsRefusesTwoWordsInsideTwoBlocks() public {
        uint64 b0 = uint64(block.number);
        say(0, 1, "one");
        vm.expectRevert(IParleyEvents.Cooldown.selector);
        parley.speak(0, 1, 0, 0, 0, "two, same block");
        vm.roll(b0 + 1);
        vm.expectRevert(IParleyEvents.Cooldown.selector);
        parley.speak(0, 1, 0, 0, 0, "two, next block");
        vm.roll(b0 + 2);
        say(0, 1, "two, two blocks later");
        assertEq(countOf(0), 2);

        // the brake is per token: another token is not held by this one's word
        sayAs(other, 0, 2, "somebody else");
        assertEq(countOf(0), 3);
    }

    /// @dev DESIGN §7.1: the bucket is keccak(token, custodyEpoch). The
    ///      seller's last word is in the seller's bucket; the buyer's is
    ///      empty, so the buyer speaks at once — and the seller, holding
    ///      nothing, cannot.
    function test_aBuyerIsNotRateLimitedByTheSeller() public {
        say(0, 1, "my last word as the holder");
        hub.transferFrom(holder, other, 1);

        sayAs(other, 0, 1, "my first word as the holder");  // same block
        assertEq(countOf(0), 2);
        assertEq(parley.lastSpoke(0, 1), block.number, "the buyer's bucket is not the live one");

        vm.prank(other);
        vm.expectRevert(IParleyEvents.Cooldown.selector);
        parley.speak(0, 1, 0, 0, 0, "and my second, too soon");

        vm.expectRevert(IParleyEvents.NotYours.selector);
        parley.speak(0, 1, 0, 0, 0, "the seller, still talking");
    }

    function test_aStewardSetsACooldownUpToSevenDays() public {
        uint256 key = parley.found(1, "slow room", true);
        vm.prank(other);
        parley.join(key, 2);

        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotTheSteward.selector);
        parley.setCooldown(key, 2, 60);

        vm.expectRevert(IParleyEvents.TooLong.selector);
        parley.setCooldown(key, 1, 7 days + 1);

        parley.setCooldown(key, 1, 1 hours);
        (,,,,,,,, uint32 cd,,) = parley.stateOf(key);
        assertEq(cd, 1 hours);

        uint256 t0 = block.timestamp;
        sayAs(other, key, 2, "one");
        vm.warp(t0 + 1 hours - 1);
        vm.prank(other);
        vm.expectRevert(IParleyEvents.Cooldown.selector);
        parley.speak(key, 2, 0, 0, 0, "two, a second early");
        vm.warp(t0 + 1 hours);
        sayAs(other, key, 2, "two, on time");
        assertEq(countOf(key), 2);

        // the commons has no steward to ask
        vm.expectRevert(IParleyEvents.NoSuchRoom.selector);
        parley.setCooldown(0, 1, 60);
    }

    /*═══════════════ rooms ═══════════════*/

    function test_aGroupKeyIsNeverAPairKeyNorAHomeKey() public view {
        for (uint256 i = 1; i < 6; ++i) {
            for (uint256 a = 1; a < 6; ++a) {
                assertTrue(parley.groupKey(i) != parley.homeKey(a), "a group is somebody's home");
                for (uint256 b = a + 1; b < 7; ++b) {
                    assertTrue(parley.groupKey(i) != parley.pairKey(a, b),
                        "two different rooms are the same room");
                    assertTrue(parley.homeKey(i) != parley.pairKey(a, b), "a home is a pair");
                }
            }
        }
        assertEq(parley.homeKey(7), uint256(keccak256(abi.encodePacked(uint8(3), uint256(7)))));
    }

    function test_aPairIsTheSameRoomFromBothSides() public view {
        assertEq(parley.pairKey(1, 2), parley.pairKey(2, 1));
        assertTrue(parley.pairKey(1, 2) != parley.pairKey(1, 3));
    }

    function test_aRawPairKeyThroughSpeakReverts() public {
        uint256 key = parley.pairKey(1, 2);
        vm.prank(other);
        parley.whisper(2, 1, 0, bytes32(0), "just us");

        /*  The derivation is the membership proof, so the raw key must not
            be a door. #1 is genuinely in this room and still cannot use it
            this way — the check is on the route, not on the caller.      */
        vm.expectRevert(IParleyEvents.UseWhisper.selector);
        parley.speak(key, 1, 0, 0, 0, "sneaking in");
    }

    /// @dev The keys are computed before `expectRevert`: the expectation
    ///      is consumed by the next call, and a view used as an argument is
    ///      a call.
    function test_anUnfoundedRoomIsNotARoom() public {
        uint256 seventh = parley.groupKey(7);
        uint256 home2 = parley.homeKey(2);
        vm.expectRevert(IParleyEvents.NoSuchRoom.selector);
        parley.speak(seventh, 1, 0, 0, 0, "hello?");
        // somebody else's unopened home is not a room either
        vm.expectRevert(IParleyEvents.NoSuchRoom.selector);
        parley.speak(home2, 1, 0, 0, 0, "hello?");
        assertEq(roster.kindOf(seventh), roster.NO_ROOM());
    }

    function test_aGroupIsClosedUntilItIsOpened() public {
        uint256 key = parley.found(1, "the workshop", false);

        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotInvited.selector);
        parley.join(key, 2);

        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotAMember.selector);
        parley.speak(key, 2, 0, 0, 0, "let me in");

        parley.invite(key, 1, 2);
        vm.prank(other);
        parley.join(key, 2);
        sayAs(other, key, 2, "thank you");

        (, uint64 count,, uint32 members,,,,,,,) = parley.stateOf(key);
        assertEq(count, 1);
        assertEq(members, 2);
    }

    function test_anOpenDoorNeedsNoInvitation() public {
        uint256 key = parley.found(1, "the commons annexe", true);
        vm.prank(other);
        parley.join(key, 2);
        sayAs(other, key, 2, "hello");
        assertEq(countOf(key), 1);
    }

    /// @dev The reason `invite` records permission and `join` is the token's
    ///      own call. If a steward could push a token into a room, the
    ///      token's room list is an array a stranger can grow.
    function test_nobodyCanLengthenSomebodyElsesRoomList() public {
        uint256 key = parley.found(1, "unwanted", true);
        parley.invite(key, 1, 2);

        (uint256[] memory list,) = parley.roomsOf(2);
        assertEq(list.length, 0, "an invitation alone put a room on somebody's list");
        assertEq(parley.roomCount(2), 0);

        vm.prank(other);
        parley.join(key, 2);
        (list,) = parley.roomsOf(2);
        assertEq(list.length, 1, "joining did not record the room");
    }

    function test_leavingIsRememberedWithoutErasingTheRoom() public {
        uint256 key = parley.found(1, "briefly", true);
        vm.prank(other);
        parley.join(key, 2);
        vm.prank(other);
        parley.leave(key, 2);

        (uint256[] memory list, bool[] memory member) = parley.roomsOf(2);
        assertEq(list.length, 1, "the room vanished from the list entirely");
        assertFalse(member[0], "it still says they are in it");

        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotAMember.selector);
        parley.speak(key, 2, 0, 0, 0, "still here?");
    }

    function test_rejoiningDoesNotDuplicateTheEntry() public {
        uint256 key = parley.found(1, "in and out", true);
        vm.prank(other);
        parley.join(key, 2);
        vm.prank(other);
        parley.leave(key, 2);
        vm.prank(other);
        parley.join(key, 2);
        assertEq(parley.roomCount(2), 1, "the list grew on a rejoin");
        (, bool[] memory member) = parley.roomsOf(2);
        assertTrue(member[0]);
    }

    function test_onlyTheStewardInvitesAndEvicts() public {
        uint256 key = parley.found(1, "mine", true);
        vm.prank(other);
        parley.join(key, 2);

        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotTheSteward.selector);
        parley.invite(key, 2, 1);

        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotTheSteward.selector);
        parley.evict(key, 2, 1);

        parley.evict(key, 1, 2);
        assertFalse(parley.inRoom(key, 2));
    }

    /// @dev What eviction is not. Nothing in this contract can unsay a thing.
    function test_evictionCannotUnsayAnything() public {
        uint256 key = parley.found(1, "mine", true);
        vm.prank(other);
        parley.join(key, 2);
        sayAs(other, key, 2, "on the record");

        uint64 before = countOf(key);
        parley.evict(key, 1, 2);
        assertEq(countOf(key), before, "evicting somebody changed what the room holds");
    }

    /// @dev Hiding is a presentation bit. The count, the head and the log
    ///      are untouched; only the bit is set, and only by the steward.
    function test_hideIsABitNotADeletion() public {
        uint256 key = parley.found(1, "moderated", true);
        vm.prank(other);
        parley.join(key, 2);
        sayAs(other, key, 2, "something unwelcome");
        assertFalse(parley.hidden(key, 1));

        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotTheSteward.selector);
        parley.hide(key, 2, 1);

        uint64 before = countOf(key);
        uint64 head = lastOf(key);
        parley.hide(key, 1, 1);
        assertTrue(parley.hidden(key, 1));
        assertFalse(parley.hidden(key, 2), "a neighbouring bit moved");
        assertFalse(parley.hidden(key, 257), "the same bit in the next word moved");
        assertEq(countOf(key), before, "hiding changed the count");
        assertEq(lastOf(key), head, "hiding moved the head");
    }

    /*═══════════════ home rooms ═══════════════*/

    /// @dev DESIGN §7.2: `join(homeKey(target), mine)` is "follow" and
    ///      `Roster.membersOf(homeKey(t))` is the follower list. The home
    ///      room comes into being with its steward's first act in it.
    function test_followIsJoinOfTheHomeRoom() public {
        uint256 home = parley.homeKey(1);

        // nothing to follow before the first word
        vm.prank(other);
        vm.expectRevert(IParleyEvents.NoSuchRoom.selector);
        parley.join(home, 2);

        say(home, 1, "first word, in my own room");
        (,,,, uint8 kind, bool open, uint256 steward,,,,) = parley.stateOf(home);
        assertEq(kind, parley.IS_HOME());
        assertTrue(open, "a home room is not open to followers");
        assertEq(steward, 1, "the token is not its own steward");
        assertEq(roster.kindOf(home), roster.IS_HOME());

        vm.prank(other);
        parley.join(home, 2);                               // follow
        assertTrue(parley.inRoom(home, 2));
        (uint256[] memory ids, uint256 next) = roster.membersOf(home, 1);
        assertEq(ids.length, 1, "the follower list is not one long");
        assertEq(ids[0], 2);
        assertEq(next, 0, "a window past the band says there is more");
        assertEq(roster.inWindow(home, 1), 1 << 1, "bit 1 is token 2");

        // the steward is not its own follower, and cannot become one
        vm.expectRevert(IParleyEvents.AlreadyIn.selector);
        parley.join(home, 1);

        // a follower may speak there; the steward may show it the door
        sayAs(other, home, 2, "nice room");
        parley.evict(home, 1, 2);
        assertFalse(parley.inRoom(home, 2));
        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotAMember.selector);
        parley.speak(home, 2, 0, 0, 0, "still here?");

        // a stranger cannot steward somebody else's home
        vm.prank(other);
        vm.expectRevert(IParleyEvents.NotTheSteward.selector);
        parley.setCooldown(home, 2, 60);
    }

    function test_aHomeRoomAlsoOpensWithAnInvitationOrACooldown() public {
        uint256 home2 = parley.homeKey(2);
        vm.prank(other);
        parley.invite(home2, 2, 1);
        (,,,, uint8 kind,, uint256 steward,,,,) = parley.stateOf(home2);
        assertEq(kind, parley.IS_HOME());
        assertEq(steward, 2);
        parley.join(home2, 1);
        assertTrue(parley.inRoom(home2, 1));

        hub.mint(holder);                                   // #3
        uint256 home3 = parley.homeKey(3);
        parley.setCooldown(home3, 3, 30);
        uint32 cd;
        (,,,, kind,, steward,, cd,,) = parley.stateOf(home3);
        assertEq(kind, parley.IS_HOME());
        assertEq(steward, 3);
        assertEq(cd, 30);
    }

    /// @dev Home rooms are not in `stewardedBy` (derivable by anyone);
    ///      founded groups are, paged.
    function test_stewardedByListsFoundedGroupsOnly() public {
        uint256 a = parley.found(1, "a", true);
        vm.prank(other);
        parley.found(2, "b", true);
        uint256 c = parley.found(1, "c", false);
        say(parley.homeKey(1), 1, "home");

        uint256[] memory rooms = roster.stewardedBy(1, 0, 10);
        assertEq(rooms.length, 2);
        assertEq(rooms[0], a);
        assertEq(rooms[1], c);
        rooms = roster.stewardedBy(1, 3, 10);
        assertEq(rooms.length, 1);
        assertEq(rooms[0], c);
    }

    /*═══════════════ whispering ═══════════════*/

    function test_aWhisperNeedsSomebodyToWhisperTo() public {
        vm.expectRevert(IParleyEvents.NoSuchToken.selector);
        parley.whisper(1, 99, 0, bytes32(0), "anyone there");

        vm.expectRevert(IParleyEvents.TalkingToYourself.selector);
        parley.whisper(1, 1, 0, bytes32(0), "hello me");
    }

    function test_bothSidesLandInTheSameRoom() public {
        parley.whisper(1, 2, 0, bytes32(0), "hello");
        vm.prank(other);
        parley.whisper(2, 1, 0, bytes32(0), "hello back");

        (, uint64 count,,, uint8 kind,,,,,,) = parley.stateOf(parley.pairKey(1, 2));
        assertEq(count, 2, "the two halves of one conversation went to two rooms");
        assertEq(kind, 2);
    }

    /*═══════════════ what a message may be ═══════════════*/

    function test_aBodyHasBothEnds() public {
        vm.expectRevert(IParleyEvents.BadBody.selector);
        parley.speak(0, 1, 0, 0, 0, "");

        bytes memory big = new bytes(parley.MAX_BODY() + 1);
        vm.expectRevert(IParleyEvents.BadBody.selector);
        parley.speak(0, 1, 0, 0, 0, big);

        bytes memory edge = new bytes(parley.MAX_BODY());
        say(0, 1, edge);                                    // exactly at the limit
    }

    /// @dev A sealed envelope carries two copies, a salt and a point, so it
    ///      is allowed 4,096 bytes — and not one more.
    function test_aSealedBodyMayBeFourTimesLonger() public {
        keys.setEncryptionKey(3, hex"04aa");
        parley.bindKey(1);
        (, bytes32 kid,) = parley.keyOf(1);

        bytes memory plainTooBig = new bytes(parley.MAX_BODY() + 1);
        vm.prank(other);
        parley.whisper(2, 1, 1, kid, plainTooBig);          // fine when sealed

        bytes memory sealedEdge = new bytes(parley.MAX_SEALED());
        vm.prank(other);
        parley.whisper(2, 1, 1, kid, sealedEdge);

        bytes memory sealedTooBig = new bytes(parley.MAX_SEALED() + 1);
        vm.prank(other);
        vm.expectRevert(IParleyEvents.BadBody.selector);
        parley.whisper(2, 1, 1, kid, sealedTooBig);
    }

    function test_aKindThisContractDoesNotKnowIsRefused() public {
        vm.expectRevert(IParleyEvents.BadKind.selector);
        parley.speak(0, 1, 2, 0, 0, "what am i");
        parley.speak(0, 1, 1, 0, 0, "sealed");             // 1 is a real kind
    }

    function test_aRoomNeedsAName() public {
        vm.expectRevert(IParleyEvents.BadName.selector);
        parley.found(1, "", true);

        string memory long = new string(parley.MAX_NAME() + 1);
        vm.expectRevert(IParleyEvents.BadName.selector);
        parley.found(1, long, true);
    }

    /// @dev A reply names (block, seq) of the message it answers, in the
    ///      same room. Both halves or neither, and never a seq the room has
    ///      not reached — so a thread walked by logs never dangles.
    function test_aReplyPointerIsWalkable() public {
        uint64 b1 = uint64(block.number);
        say(0, 1, "a question");
        vm.roll(b1 + 2);

        vm.expectRevert(Parley.BadReply.selector);
        parley.speak(0, 1, 0, b1, 0, "half a pointer");
        vm.expectRevert(Parley.BadReply.selector);
        parley.speak(0, 1, 0, 0, 1, "the other half");
        vm.expectRevert(Parley.BadReply.selector);
        parley.speak(0, 1, 0, b1, 2, "a reply to a message not yet said");

        parley.speak(0, 1, 0, b1, 1, "an answer");
        assertEq(countOf(0), 2);
        vm.roll(b1 + 4);
        parley.speak(0, 1, 0, b1 + 2, 2, "an answer to the answer");
        assertEq(countOf(0), 3);
    }

    /*═══════════════ sealing keys ═══════════════*/

    /// @dev `bindKey` is `holds` — not the Reach, not a stranger — and
    ///      needs a key in the registry to bind.
    function test_onlyTheHolderBindsItsOwnKey() public {
        vm.prank(nobody);
        vm.expectRevert(IParleyEvents.NotHolder.selector);
        parley.bindKey(1);

        vm.prank(hub.account(1));
        vm.expectRevert(IParleyEvents.NotHolder.selector);
        parley.bindKey(1);

        vm.expectRevert(IParleyEvents.NoKey.selector);
        parley.bindKey(1);                                  // nothing published yet

        keys.setEncryptionKey(3, hex"04beef");
        parley.bindKey(1);
        (uint16 keyType, bytes32 keyId, bytes memory pk) = parley.keyOf(1);
        assertEq(keyType, 3);
        assertEq(keyId, keccak256(hex"04beef"));
        assertEq(pk, hex"04beef");
    }

    function test_theRegistryRefusesAnEmptyOrUntypedKey() public {
        vm.expectRevert(IKeyRegistry.EmptyKey.selector);
        keys.setEncryptionKey(1, "");
        vm.expectRevert(IKeyRegistry.BadKeyType.selector);
        keys.setEncryptionKey(0, hex"01");
        keys.setEncryptionKey(1001, hex"01");               // private-use types are allowed
        (uint16 t, bytes memory pk, uint64 at) = keys.getPublicKeys(holder);
        assertEq(t, 1001); assertEq(pk, hex"01"); assertEq(at, block.timestamp);
        assertEq(keys.keyIdOf(holder), keccak256(hex"01"));
        keys.revokeEncryptionKey();
        assertEq(keys.keyIdOf(holder), bytes32(0));
        assertEq(keys.publicKeyOf(holder).length, 0);
    }

    /// @dev IPSEITY `4fa41d0`: a page must never promise privacy to a
    ///      departed holder. Here the binding is also epoch-keyed, so a
    ///      buy-back revives nothing either.
    function test_aSoldTokenHasNoKey() public {
        keys.setEncryptionKey(3, hex"04aa");
        parley.bindKey(1);
        (, bytes32 before,) = parley.keyOf(1);
        assertTrue(before != bytes32(0));

        hub.transferFrom(holder, other, 1);
        (uint16 t, bytes32 kid, bytes memory pk) = parley.keyOf(1);
        assertEq(t, 0, "former holder's key type remained");
        assertEq(kid, bytes32(0), "former holder's key remained active");
        assertEq(pk.length, 0, "former holder's public key was still served");

        // a sealed whisper to the sold token is refused: no key, not a stale one
        vm.prank(other);
        vm.expectRevert(IParleyEvents.NoKey.selector);
        parley.whisper(2, 1, 1, before, "sealed to a ghost");

        // the buyer binds its own
        vm.prank(other);
        keys.setEncryptionKey(1, hex"bb");
        vm.prank(other);
        parley.bindKey(1);
        (, kid,) = parley.keyOf(1);
        assertEq(kid, keccak256(hex"bb"), "current holder could not bind");

        // and a buy-back by the original holder revives the old binding not at all
        vm.prank(other);
        hub.transferFrom(other, holder, 1);
        (, kid,) = parley.keyOf(1);
        assertEq(kid, bytes32(0), "away-and-back revived a binding");
    }

    /// @dev ANIMA's mempool-rotation guard: the client names the key it
    ///      sealed to, and the send fails if the recipient's key is not that
    ///      one any more — rotated or revoked.
    function test_aRotatedKeyRefusesTheWhisper() public {
        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c1");
        vm.prank(other);
        parley.bindKey(2);
        bytes32 k1 = keccak256(hex"04c1");

        parley.whisper(1, 2, 1, k1, "sealed to k1");       // fine

        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c2");               // rotated in the registry
        vm.expectRevert(IParleyEvents.KeyMoved.selector);
        parley.whisper(1, 2, 1, k1, "sealed to the old key");
        (, bytes32 live,) = parley.keyOf(2);
        assertEq(live, keccak256(hex"04c2"), "the binding did not follow the registry");
        parley.whisper(1, 2, 1, live, "sealed to k2");     // the new key works

        vm.prank(other);
        keys.revokeEncryptionKey();                         // withdrawn
        vm.expectRevert(IParleyEvents.NoKey.selector);
        parley.whisper(1, 2, 1, live, "sealed to nothing");

        // a plain whisper never asks about keys
        parley.whisper(1, 2, 0, bytes32(0), "in the clear");
    }

    function test_aSealedWhisperToATokenWithoutABindingIsRefused() public {
        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c1");                // published, never bound
        vm.expectRevert(IParleyEvents.NoKey.selector);
        parley.whisper(1, 2, 1, keccak256(hex"04c1"), "sealed to an unbound key");
    }

    /*═══════════════ the topics a browser cannot compute ═══════════════*/

    /// @dev The client ships no keccak, so it asks for these. If they were
    ///      ever written down by hand rather than derived, a filter would
    ///      match nothing and the chat would be silently, permanently empty
    ///      — which looks exactly like a chat nobody has used yet.
    function test_theTopicsAreDerivedFromTheSignaturesThemselves() public view {
        (bytes32 said, bytes32 founded, bytes32 invited,
         bytes32 entered, bytes32 departed) = parley.topics();
        assertEq(said, keccak256("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)"));
        assertEq(founded, keccak256("Founded(uint256,uint256,uint256,bool,string)"));
        assertEq(invited, keccak256("Invited(uint256,uint256,uint256)"));
        assertEq(entered, keccak256("Entered(uint256,uint256)"));
        assertEq(departed, keccak256("Departed(uint256,uint256)"));
    }
}
