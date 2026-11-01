// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Agora} from "../src/Agora.sol";
import {KeyRegistry} from "../src/KeyRegistry.sol";
import {IAgoraEvents} from "../src/interfaces/IAgora.sol";
import {IKeyRegistry} from "../src/interfaces/IKeyRegistry.sol";
import {Persona} from "../src/lib/Persona.sol";
import {SocialHub, StubReach} from "./mocks/SocialHub.sol";
import {MockERC721} from "./mocks/MockERC721.sol";
import {
    AgoraStudio, AgoraRevertingStudio, AgoraMumblingStudio, AgoraCollection,
    AgoraRefusingHolder, AgoraReentrantHolder
} from "./mocks/AgoraFixtures.sol";

/*───────────────────────────────────────────────────────────────────────────
  One social layer for every token, and the ways it could let the wrong
  party speak.

  Origin: test/Parley.t.sol, carried over sentence for sentence onto
  personas (INTACT V2, unit W5), plus what Agora adds. Parley's interesting
  failures are all still here: the wrong party speaking as somebody else's
  token, a room key colliding with another room, the back-link that makes
  the archive readable no longer going backwards, a list a stranger can
  grow, a seller's cooldown or key outliving the sale. Agora adds its own:
  a collection from elsewhere talking in the commons, an outsider talking
  in a collection's room, a buyer inheriting the seller's seat or
  invitation, two tokens of one holder sharing one brake, a tip that lands
  anywhere but with the author, and a follow graph that miscounts.

  The world: SocialHub (the hub as the social contracts see it) with #1 held
  by this contract and #2 by `other`; Apes, a MockERC721 from elsewhere
  (no custody epoch, never registered), whose #7 carol holds; Moons, a
  Studio collection (registered, with a custody epoch), whose #1 carol
  holds too.
───────────────────────────────────────────────────────────────────────────*/
contract AgoraTest is Test {
    SocialHub       hub;
    KeyRegistry     keys;
    AgoraStudio     studio;
    Agora           agora;
    MockERC721      apes;
    AgoraCollection moons;

    address holder = address(this);
    address other  = address(0x0777);
    address carol  = address(0xCA201);
    address dave   = address(0xDA7E);
    address nobody = address(0xDEAD);

    uint256 h1;      // the hub's #1, held by this contract
    uint256 h2;      // the hub's #2, held by `other`
    uint256 ape7;    // Apes #7, held by carol
    uint256 moon1;   // Moons #1, held by carol

    receive() external payable {}

    function setUp() public {
        vm.roll(1000);
        vm.warp(1_733_000_000);

        hub = new SocialHub();
        keys = new KeyRegistry();
        studio = new AgoraStudio();
        agora = new Agora(address(hub), address(keys), address(studio));
        apes = new MockERC721();
        moons = new AgoraCollection();
        studio.register(address(moons));

        vm.deal(holder, 10 ether);
        vm.deal(other, 10 ether);
        vm.deal(carol, 10 ether);

        hub.mint(holder);                                 // #1, this contract
        hub.mint(other);                                  // #2, `other`
        apes.mint(carol, 7);
        moons.mint(carol);                                // Moons #1

        h1 = agora.persona(address(hub), 1);
        h2 = agora.persona(address(hub), 2);
        ape7 = agora.persona(address(apes), 7);
        moon1 = agora.persona(address(moons), 1);
    }

    function say(uint256 room, uint256 from, bytes memory body) internal {
        agora.speak(room, from, 0, 0, 0, body);
    }

    function sayAs(address who, uint256 room, uint256 from, bytes memory body) internal {
        vm.prank(who);
        agora.speak(room, from, 0, 0, 0, body);
    }

    function countOf(uint256 room) internal view returns (uint64 count) {
        (, count,,,,,,,,,) = agora.stateOf(room);
    }

    function lastOf(uint256 room) internal view returns (uint64 last) {
        (last,,,,,,,,,,) = agora.stateOf(room);
    }

    function openedOf(uint256 room) internal view returns (uint64 opened) {
        (,, opened,,,,,,,,) = agora.stateOf(room);
    }

    function membersOf(uint256 room) internal view returns (uint32 members) {
        (,,, members,,,,,,,) = agora.stateOf(room);
    }

    /// @dev The exact refusal — selector AND arguments — through a raw call
    ///      that hands the revert data back. `expectRevert` here matches a
    ///      name only, and `NotOfCollection(h1, apes)` is a claim about both
    ///      of its arguments.
    function refusal(address who, uint256 value, bytes memory data) internal returns (bytes memory ret) {
        vm.prank(who);
        bool ok;
        (ok, ret) = address(agora).call{value: value}(data);
        assertFalse(ok, "a call that had to be refused went through");
    }

    /*═══════════════ the wiring ═══════════════*/

    /// @dev Parley's first test asserted its mutual immutables with Postage.
    ///      Agora has no Postage; what it is pinned to is these three.
    function test_theConstructorNamesTheHubTheKeysAndTheStudio() public view {
        assertEq(agora.HUB(), address(hub), "Agora does not know its hub");
        assertEq(agora.KEYS(), address(keys), "Agora does not know its key registry");
        assertEq(agora.STUDIO(), address(studio), "Agora does not know its Studio");
        assertEq(agora.COMMONS(), 0);
        assertEq(agora.MAX_BODY(), 1024);
        assertEq(agora.MAX_SEALED(), 4096);
        assertEq(agora.MAX_NAME(), 48);
        assertEq(uint256(agora.MAX_COOLDOWN()), 7 days);
        assertEq(uint256(agora.IS_COLLECTION()), 4, "the collection kind is not the prefix its key is hashed under");
        assertTrue(openedOf(0) != 0, "the commons was not open from the start");
    }

    /*═══════════════ personas ═══════════════*/

    function test_aPersonaIsItsCollectionAndItsIdInOneWord() public view {
        assertEq(h1, (uint256(uint160(address(hub))) << 96) | 1, "a persona is not collection << 96 | id");
        (address c, uint256 id) = agora.split(ape7);
        assertEq(c, address(apes), "split did not give the collection back");
        assertEq(id, 7, "split did not give the id back");
        assertTrue(h1 != h2 && h1 != ape7 && ape7 != moon1, "two tokens share one persona");
    }

    function test_anIdPastNinetySixBitsOrTheZeroCollectionIsNoPersona() public {
        uint256 big = uint256(1) << 96;
        bytes memory ret = refusal(holder, 0, abi.encodeCall(agora.persona, (address(apes), big)));
        assertEq(ret, abi.encodeWithSelector(Persona.NotAPersona.selector, address(apes), big),
            "an id of 2^96 was packed into a persona");
        ret = refusal(holder, 0, abi.encodeCall(agora.persona, (address(0), uint256(1))));
        assertEq(ret, abi.encodeWithSelector(Persona.NotAPersona.selector, address(0), uint256(1)),
            "the zero collection was packed into a persona");
        (, uint256 id) = agora.split(agora.persona(address(apes), big - 1));
        assertEq(id, big - 1, "the largest id did not survive the round trip");
    }

    /*═══════════════ who may speak ═══════════════*/

    function test_onlyTheHolderSpeaksAsTheirPersona() public {
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.speak(0, h1, 0, 0, 0, "hello");

        say(0, h1, "hello");                              // the holder can
        assertEq(countOf(0), 1, "the commons did not record it");
    }

    /// @dev The Reach is the token acting for itself, and its session keys
    ///      are the holder's own delegation. The renter is not: a lease buys
    ///      the instrument's use, not its name.
    function test_theReachMaySpeakForAHubPersonaAndTheRenterMayNot() public {
        address bound = hub.account(1);
        assertTrue(agora.mayActAs(h1, bound), "a hub token cannot speak through its own Reach");
        sayAs(bound, 0, h1, "as myself");
        assertEq(countOf(0), 1);

        hub.setUser(1, nobody, uint64(block.timestamp + 1 days));
        assertEq(hub.userOf(1), nobody, "the lease did not take");
        assertFalse(agora.mayActAs(h1, nobody), "a renter was given the persona's voice");
    }

    function test_aRenterCannotSpeak() public {
        say(0, h1, "something to react to");
        hub.setUser(1, nobody, uint64(block.timestamp + 1 days));
        assertEq(hub.userOf(1), nobody);
        vm.deal(nobody, 1 ether);
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.speak(0, h1, 0, 0, 0, "I am renting this voice");
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.whisper(h1, h2, 0, bytes32(0), "and this one");
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.found(h1, "renters club", true);
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.react{value: 1 wei}(0, h1, 1, h1, "+");
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.follow(h1, h2, true);
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.bindKey(h1);
    }

    function test_aPersonaNobodyHoldsHasNoVoice() public {
        uint256 ghost = agora.persona(address(hub), 99);
        assertFalse(agora.mayActAs(ghost, holder));
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.speak(0, ghost, 0, 0, 0, "hello");
        uint256 nowhere = agora.persona(address(0xC0DE), 1);
        assertFalse(agora.mayActAs(nowhere, holder), "a collection with no code named an actor");
    }

    /// @dev For any collection but the hub, `holds`: an approved address
    ///      or an operator may move the token and may not speak as it.
    function test_aForeignTokenIsActedForByItsHolderAlone() public {
        assertTrue(agora.mayActAs(ape7, carol), "the holder of a foreign token cannot act as it");
        vm.prank(carol);
        apes.approve(nobody, 7);
        vm.prank(carol);
        apes.setApprovalForAll(other, true);
        assertFalse(agora.mayActAs(ape7, nobody), "an approved address was given the persona's voice");
        assertFalse(agora.mayActAs(ape7, other), "an operator was given the persona's voice");
        assertFalse(agora.mayActAs(ape7, address(0)), "the zero address acts as a persona");
        assertFalse(agora.mayActAs(ape7, holder), "holding a hub token is holding an Ape");
    }

    /*═══════════════ the commons is registered-only ═══════════════*/

    function test_theCommonsHearsOnlyRegisteredCollections() public {
        say(0, h1, "the hub is registered");
        sayAs(carol, 0, moon1, "and so is every Studio collection");
        assertEq(countOf(0), 2, "a registered collection was not heard in the commons");

        bytes memory ret = refusal(carol, 0, abi.encodeCall(agora.speak, (0, ape7, 0, 0, 0, bytes("and I am from elsewhere"))));
        assertEq(ret, abi.encodeWithSelector(IAgoraEvents.Unregistered.selector, address(apes)),
            "a collection the Studio never launched was heard in the commons");
        assertTrue(agora.isRegistered(address(hub)), "the hub is not registered");
        assertTrue(agora.isRegistered(address(moons)), "a Studio collection is not registered");
        assertFalse(agora.isRegistered(address(apes)), "a collection from elsewhere is registered");
        assertEq(countOf(0), 2);
    }

    /// @dev The trap a typed call sets: on a codeless address it reverts
    ///      before the call is made. An unreadable Studio must read as an
    ///      empty register — never as a revert that takes the hub's own
    ///      commons down with it.
    function test_aStudioThatIsAbsentOrRevertsRegistersOnlyTheHub() public {
        address[3] memory studios =
            [address(0xBEEF), address(new AgoraRevertingStudio()), address(new AgoraMumblingStudio())];
        for (uint256 i; i < 3; ++i) {
            Agora a = new Agora(address(hub), address(keys), studios[i]);
            assertTrue(a.isRegistered(address(hub)), "an unreadable Studio silenced the hub's own commons");
            assertFalse(a.isRegistered(address(moons)), "an unreadable Studio registered a collection");
            vm.prank(carol);
            vm.expectRevert(IAgoraEvents.Unregistered.selector);
            a.speak(0, moon1, 0, 0, 0, "is anybody listening");
            a.speak(0, h1, 0, 0, 0, "the hub still is");
        }
    }

    /// @dev Registration is read at the word, never cached: a collection the
    ///      Studio registers is heard at once, one it strikes off is refused
    ///      at once. (Ordered so no store that subtracts a gas refund follows
    ///      a swallowed `expectRevert`: this runner hands the caller the
    ///      reverted call's zeroed refund counter, and the store then fails
    ///      with "refund exhausted" — a property of the harness, not of Agora.)
    function test_registrationIsReadLiveFromTheStudio() public {
        AgoraCollection suns = new AgoraCollection();
        suns.mint(carol);
        uint256 sun1 = agora.persona(address(suns), 1);
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.Unregistered.selector);
        agora.speak(0, sun1, 0, 0, 0, "not launched yet");
        studio.register(address(suns));
        sayAs(carol, 0, sun1, "launched, and heard at once");
        assertEq(countOf(0), 1, "a collection the Studio registered was not heard at once");

        studio.unregister(address(moons));
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.Unregistered.selector);
        agora.speak(0, moon1, 0, 0, 0, "struck off");
        assertEq(countOf(0), 1);
    }

    /*═══════════════ collection rooms ═══════════════*/

    function test_aCollectionRoomNeedsNoFounding() public {
        uint256 room = agora.collectionKey(address(apes));
        assertEq(openedOf(room), 0, "a collection room was open before anybody spoke in it");
        uint64 b0 = uint64(block.number);
        sayAs(carol, room, ape7, "the first word in the Apes room");
        (, uint64 count, uint64 opened, uint32 members, uint8 kind, bool open, uint256 steward, uint256 index,,,) =
            agora.stateOf(room);
        assertEq(count, 1, "the collection room did not record the word");
        assertEq(opened, b0, "the first word did not open the room");
        assertEq(kind, agora.IS_COLLECTION(), "the room is not a collection room");
        assertEq(index, uint256(uint160(address(apes))), "the room does not name its collection");
        assertEq(steward, 0, "a collection room has a steward");
        assertEq(members, 0, "a collection room counts seats");
        assertFalse(open, "a collection room has a door");
    }

    function test_onlyACollectionsOwnPersonasSpeakInItsRoom() public {
        uint256 room = agora.collectionKey(address(apes));
        sayAs(carol, room, ape7, "Apes only");
        apes.mint(other, 8);
        uint256 ape8 = agora.persona(address(apes), 8);
        sayAs(other, room, ape8, "another Ape");
        assertEq(countOf(room), 2, "a second holder of the collection was not heard in its room");

        bytes memory ret = refusal(holder, 0, abi.encodeCall(agora.speak, (room, h1, 0, 0, 0, bytes("a hub token in the Apes room"))));
        assertEq(ret, abi.encodeWithSelector(IAgoraEvents.NotOfCollection.selector, h1, address(apes)),
            "a persona of another collection spoke in a collection's room");
        // carol holds an Ape too: the room asks what the persona is, not who holds it
        ret = refusal(carol, 0, abi.encodeCall(agora.speak, (room, moon1, 0, 0, 0, bytes("a registered collection is still not this one"))));
        assertEq(ret, abi.encodeWithSelector(IAgoraEvents.NotOfCollection.selector, moon1, address(apes)),
            "a Moon spoke in the Apes room because its holder holds an Ape");
        assertEq(countOf(room), 2);
    }

    /// @dev Until one of its holders opens it, a collection room's key is a
    ///      number nobody can invert, exactly like an unopened home.
    function test_anOutsiderNamingAnUnopenedCollectionRoomIsToldThereIsNoSuchRoom() public {
        uint256 room = agora.collectionKey(address(apes));
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.speak(room, h1, 0, 0, 0, "is this the Apes room?");
        assertEq(openedOf(room), 0, "an outsider opened a collection's room");
    }

    /// @dev No steward sets a collection room's cooldown, so it brakes as
    ///      the commons does, in blocks.
    function test_aCollectionRoomBrakesLikeTheCommons() public {
        uint256 room = agora.collectionKey(address(apes));
        uint64 b0 = uint64(block.number);
        sayAs(carol, room, ape7, "one");
        bytes memory ret = refusal(carol, 0, abi.encodeCall(agora.speak, (room, ape7, 0, 0, 0, bytes("two, same block"))));
        assertEq(ret, abi.encodeWithSelector(IAgoraEvents.Cooldown.selector, b0 + 2),
            "a collection room let one persona speak twice in one block");
        vm.roll(b0 + 1);
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.Cooldown.selector);
        agora.speak(room, ape7, 0, 0, 0, "two, next block");
        vm.roll(b0 + 2);
        sayAs(carol, room, ape7, "two, two blocks later");
        assertEq(countOf(room), 2);
        assertEq(agora.lastSpoke(room, ape7), b0 + 2, "a collection room's brake is not counted in blocks");
    }

    function test_aCollectionRoomHasNoStewardAndNoDoor() public {
        uint256 room = agora.collectionKey(address(apes));
        sayAs(carol, room, ape7, "open");
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.join(room, ape7);
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.setCooldown(room, ape7, 60);
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.invite(room, ape7, h1);
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.hide(room, ape7, 1);
    }

    function test_theCollectionKeyIsTheFormulaACollectionComputesWithoutACall() public view {
        assertEq(agora.collectionKey(address(apes)), uint256(keccak256(abi.encodePacked(uint8(4), address(apes)))),
            "a collection could not compute its own room");
        assertTrue(agora.collectionKey(address(apes)) != agora.collectionKey(address(moons)),
            "two collections share one room");
    }

    /*═══════════════ one identity, every room ═══════════════*/

    function test_onePersonaSpeaksInEveryRoomItBelongsTo() public {
        uint256 hubRoom = agora.collectionKey(address(hub));
        uint256 home = agora.homeKey(h1);
        uint256 group = agora.found(h1, "everyone", true);
        say(0, h1, "in the commons");
        say(hubRoom, h1, "in the hub's own room");
        say(home, h1, "at home");
        say(group, h1, "in my group");
        agora.whisper(h1, ape7, 0, bytes32(0), "and to an Ape");

        uint256 apesRoom = agora.collectionKey(address(apes));
        uint256 apeHome = agora.homeKey(ape7);
        sayAs(carol, apesRoom, ape7, "the Ape in its own room");
        sayAs(carol, apeHome, ape7, "at its own home");
        vm.prank(carol);
        agora.join(group, ape7);
        sayAs(carol, group, ape7, "and in a hub token's group");
        vm.prank(carol);
        agora.whisper(ape7, h1, 0, bytes32(0), "and back");

        assertEq(countOf(0), 1);
        assertEq(countOf(hubRoom), 1, "a hub token could not speak in the hub's own room");
        assertEq(countOf(home), 1);
        assertEq(countOf(group), 2, "two collections did not meet in one group");
        assertEq(countOf(apesRoom), 1);
        assertEq(countOf(apeHome), 1, "a foreign token has no home");
        assertEq(countOf(agora.pairKey(h1, ape7)), 2, "a whisper did not cross collections");
    }

    /*═══════════════ the back-link, which is the whole archive ═══════════════*/

    /*  As in Parley, the pointer itself is in the log, and tools/verify-agora.mjs
        walks a real archive the way a browser does. What is testable here is
        the storage half: the head the walk starts from, the counter that
        tells a client whether anything is new, and the ring of recent heads.

        Block numbers are captured once, before any roll: within one
        transaction NUMBER cannot change, so the optimiser may read it once
        and sink that read past a `vm.roll` (the IPSEITY lesson Parley's
        tests record). Anything that straddles a roll reads its evidence from
        storage or from the captured number.                               */

    function test_theRoomRemembersWhereItsNewestMessageIs() public {
        uint64 b0 = uint64(block.number);
        say(0, h1, "one");
        assertEq(lastOf(0), b0);

        vm.roll(b0 + 40);
        say(0, h1, "two");
        assertEq(lastOf(0), b0 + 40, "the head did not move");
        assertEq(countOf(0), 2);
    }

    function test_everyRoomKeepsItsOwnHead() public {
        uint64 b0 = uint64(block.number);
        uint256 key = agora.found(h1, "elsewhere", true);
        say(0, h1, "in the commons");
        vm.roll(b0 + 9);
        say(key, h1, "in the group");

        assertEq(lastOf(0), b0, "one room's message moved another room's head");
        assertEq(lastOf(key), b0 + 9);
        assertEq(countOf(0), 1);
        assertEq(countOf(key), 1);
    }

    function test_aPersonaRemembersWhereItLastSpokeWhoeverElseHasSpoken() public {
        say(0, h1, "one");
        uint64 at = agora.lastSpoke(0, h1);
        assertTrue(at != 0, "the first message was not recorded at all");

        vm.roll(at + 3);
        sayAs(other, 0, h2, "not mine");

        assertEq(agora.lastSpoke(0, h1), at,
            "somebody else speaking moved this persona's own back-link");
        assertTrue(agora.lastSpoke(0, h2) > at,
            "and the persona that did speak did not move its own");
    }

    function test_headsAnswersForEveryRoomAtOnce() public {
        uint64 b0 = uint64(block.number);
        uint256 key = agora.found(h1, "counted", true);
        say(0, h1, "a");
        vm.roll(b0 + 2);
        say(key, h1, "b");
        vm.roll(b0 + 4);
        say(key, h1, "c");

        uint256[] memory rooms = new uint256[](3);
        rooms[0] = 0;
        rooms[1] = key;
        rooms[2] = agora.groupKey(99);
        uint64[] memory last = agora.heads(rooms);
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
        say(0, h1, "1");
        sayAs(other, 0, h2, "2");                          // same block, another persona
        (,,,,,,,,, uint64[4] memory hb, uint64[4] memory hs) = agora.stateOf(0);
        assertEq(hb[0], b0); assertEq(hs[0], 2, "the second message in a block did not move the lane's seq");
        assertEq(hb[1], 0);  assertEq(hs[1], 0);

        vm.roll(b0 + 5);  say(0, h1, "3");
        vm.roll(b0 + 9);  say(0, h1, "4");
        vm.roll(b0 + 20); say(0, h1, "5");
        vm.roll(b0 + 23); say(0, h1, "6");
        (,,,,,,,,, hb, hs) = agora.stateOf(0);
        assertEq(hb[0], b0 + 23); assertEq(hs[0], 6);
        assertEq(hb[1], b0 + 20); assertEq(hs[1], 5);
        assertEq(hb[2], b0 + 9);  assertEq(hs[2], 4);
        assertEq(hb[3], b0 + 5);  assertEq(hs[3], 3, "the oldest lane is not the fourth block back");
        assertEq(lastOf(0), b0 + 23);
    }

    /*═══════════════ the brakes ═══════════════*/

    function test_theCommonsRefusesTwoWordsInsideTwoBlocks() public {
        uint64 b0 = uint64(block.number);
        say(0, h1, "one");
        bytes memory ret = refusal(holder, 0, abi.encodeCall(agora.speak, (0, h1, 0, 0, 0, bytes("two, same block"))));
        assertEq(ret, abi.encodeWithSelector(IAgoraEvents.Cooldown.selector, b0 + 2),
            "the commons brake does not name the block it lifts at");
        vm.roll(b0 + 1);
        vm.expectRevert(IAgoraEvents.Cooldown.selector);
        agora.speak(0, h1, 0, 0, 0, "two, next block");
        vm.roll(b0 + 2);
        say(0, h1, "two, two blocks later");
        assertEq(countOf(0), 2);

        // the brake is per persona: another persona is not held by this one's word
        sayAs(other, 0, h2, "somebody else");
        assertEq(countOf(0), 3);
    }

    /// @dev The bucket is (persona, stamp), and the stamp is keccak(holder,
    ///      custody epoch). The seller's last word is in the seller's bucket;
    ///      the buyer's is empty, so the buyer speaks at once — and the
    ///      seller, holding nothing, cannot.
    function test_aBuyerIsNotRateLimitedByTheSeller() public {
        uint64 b0 = uint64(block.number);
        say(0, h1, "my last word as the holder");
        hub.transferFrom(holder, other, 1);

        sayAs(other, 0, h1, "my first word as the holder");   // same block
        assertEq(countOf(0), 2);
        assertEq(agora.lastSpoke(0, h1), b0, "the buyer's bucket is not the live one");

        vm.prank(other);
        vm.expectRevert(IAgoraEvents.Cooldown.selector);
        agora.speak(0, h1, 0, 0, 0, "and my second, too soon");

        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.speak(0, h1, 0, 0, 0, "the seller, still talking");
    }

    /// @dev A collection with no custody epoch is stamped by its holder
    ///      alone, and a sale changes the holder: the same rule, one term short.
    function test_aForeignBuyerIsNotRateLimitedByTheSellerEither() public {
        uint256 room = agora.collectionKey(address(apes));
        sayAs(carol, room, ape7, "my last word as the holder");
        vm.prank(carol);
        apes.transferFrom(carol, other, 7);

        sayAs(other, room, ape7, "my first word as the holder");   // same block
        assertEq(countOf(room), 2, "the buyer of a foreign token was braked by the seller's word");
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.speak(room, ape7, 0, 0, 0, "the seller, still talking");
    }

    /// @dev Two hub tokens of one holder have one stamp — the same holder,
    ///      both at epoch 1 — and two Apes of one holder share one too. The
    ///      bucket is the persona AND its stamp, so each token keeps its own
    ///      brake, as Parley's (token, epoch) bucket did.
    function test_twoPersonasOfOneHolderKeepTwoBrakes() public {
        hub.mint(holder);                                   // #3, also this contract's
        uint256 h3 = agora.persona(address(hub), 3);
        say(0, h1, "one persona");
        say(0, h3, "and another, same block, same holder");
        assertEq(countOf(0), 2, "two hub tokens of one holder shared one brake");

        apes.mint(carol, 8);
        uint256 ape8 = agora.persona(address(apes), 8);
        uint256 room = agora.collectionKey(address(apes));
        sayAs(carol, room, ape7, "one Ape");
        sayAs(carol, room, ape8, "another Ape, same block, same holder");
        assertEq(countOf(room), 2, "two Apes of one holder shared one brake");
    }

    function test_aStewardSetsACooldownUpToSevenDays() public {
        uint256 key = agora.found(h1, "slow room", true);
        vm.prank(other);
        agora.join(key, h2);

        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotTheSteward.selector);
        agora.setCooldown(key, h2, 60);

        vm.expectRevert(IAgoraEvents.TooLong.selector);
        agora.setCooldown(key, h1, 7 days + 1);
        agora.setCooldown(key, h1, 7 days);                 // the week itself is allowed

        agora.setCooldown(key, h1, 1 hours);
        (,,,,,,,, uint32 cd,,) = agora.stateOf(key);
        assertEq(cd, 1 hours);

        uint256 t0 = block.timestamp;
        sayAs(other, key, h2, "one");
        vm.warp(t0 + 1 hours - 1);
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.Cooldown.selector);
        agora.speak(key, h2, 0, 0, 0, "two, a second early");
        vm.warp(t0 + 1 hours);
        sayAs(other, key, h2, "two, on time");
        assertEq(countOf(key), 2);

        // the commons has no steward to ask
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.setCooldown(0, h1, 60);
    }

    /*═══════════════ rooms ═══════════════*/

    function test_noTwoKindsOfRoomShareAKey() public view {
        for (uint256 i = 1; i < 6; ++i) {
            for (uint256 a = 1; a < 6; ++a) {
                uint256 pa = (uint256(uint160(address(hub))) << 96) | a;
                assertTrue(agora.groupKey(i) != agora.homeKey(a), "a group is somebody's home");
                assertTrue(agora.groupKey(i) != agora.homeKey(pa), "a group is a persona's home");
                assertTrue(agora.collectionKey(address(uint160(a))) != agora.groupKey(i), "a collection's room is a group");
                assertTrue(agora.collectionKey(address(uint160(a))) != agora.homeKey(a), "a collection's room is a home");
                for (uint256 b = a + 1; b < 7; ++b) {
                    uint256 pb = (uint256(uint160(address(hub))) << 96) | b;
                    assertTrue(agora.groupKey(i) != agora.pairKey(a, b), "two different rooms are the same room");
                    assertTrue(agora.homeKey(i) != agora.pairKey(a, b), "a home is a pair");
                    assertTrue(agora.homeKey(pa) != agora.pairKey(pa, pb), "a persona's home is a pair");
                    assertTrue(agora.collectionKey(address(uint160(a))) != agora.pairKey(a, b), "a collection's room is a pair");
                }
            }
            assertTrue(agora.collectionKey(address(uint160(i))) != 0, "a collection's room is the commons");
        }
        assertEq(agora.homeKey(7), uint256(keccak256(abi.encodePacked(uint8(3), uint256(7)))));
        assertEq(agora.groupKey(7), uint256(keccak256(abi.encodePacked(uint8(1), uint256(7)))));
        assertEq(agora.pairKey(h2, h1), uint256(keccak256(abi.encodePacked(uint8(2), h1, h2))));
    }

    function test_aPairIsTheSameRoomFromBothSides() public view {
        assertEq(agora.pairKey(h1, h2), agora.pairKey(h2, h1));
        assertTrue(agora.pairKey(h1, h2) != agora.pairKey(h1, ape7));
    }

    function test_aRawPairKeyThroughSpeakReverts() public {
        uint256 key = agora.pairKey(h1, h2);
        vm.prank(other);
        agora.whisper(h2, h1, 0, bytes32(0), "just us");

        /*  The derivation is the membership proof, so the raw key must not
            be a door. #1 is genuinely in this room and still cannot use it
            this way — the check is on the route, not on the caller.      */
        vm.expectRevert(IAgoraEvents.UseWhisper.selector);
        agora.speak(key, h1, 0, 0, 0, "sneaking in");
    }

    /// @dev The keys are computed before `expectRevert`: the expectation
    ///      is consumed by the next call, and a view used as an argument is
    ///      a call.
    function test_anUnfoundedRoomIsNotARoom() public {
        uint256 seventh = agora.groupKey(7);
        uint256 home2 = agora.homeKey(h2);
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.speak(seventh, h1, 0, 0, 0, "hello?");
        // somebody else's unopened home is not a room either
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.speak(home2, h1, 0, 0, 0, "hello?");
        assertEq(openedOf(seventh), 0, "an unfounded group reads as a room that came into being");
    }

    function test_aGroupIsClosedUntilItIsOpened() public {
        uint256 key = agora.found(h1, "the workshop", false);

        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotInvited.selector);
        agora.join(key, h2);

        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotAMember.selector);
        agora.speak(key, h2, 0, 0, 0, "let me in");

        agora.invite(key, h1, h2);
        vm.prank(other);
        agora.join(key, h2);
        sayAs(other, key, h2, "thank you");

        (, uint64 count,, uint32 members,,,,,,,) = agora.stateOf(key);
        assertEq(count, 1);
        assertEq(members, 2);
    }

    function test_anOpenDoorNeedsNoInvitation() public {
        uint256 key = agora.found(h1, "the commons annexe", true);
        vm.prank(other);
        agora.join(key, h2);
        sayAs(other, key, h2, "hello");
        assertEq(countOf(key), 1);
    }

    /// @dev The reason `invite` records permission and `join` is the
    ///      persona's own call. If a steward could push a persona into a
    ///      room, its room list is an array a stranger can grow.
    function test_nobodyCanLengthenSomebodyElsesRoomList() public {
        uint256 key = agora.found(h1, "unwanted", true);
        agora.invite(key, h1, h2);

        (uint256[] memory list,) = agora.roomsOf(h2);
        assertEq(list.length, 0, "an invitation alone put a room on somebody's list");
        assertEq(agora.roomCount(h2), 0);

        vm.prank(other);
        agora.join(key, h2);
        (list,) = agora.roomsOf(h2);
        assertEq(list.length, 1, "joining did not record the room");
    }

    function test_leavingIsRememberedWithoutErasingTheRoom() public {
        uint256 key = agora.found(h1, "briefly", true);
        vm.prank(other);
        agora.join(key, h2);
        vm.prank(other);
        agora.leave(key, h2);

        (uint256[] memory list, bool[] memory member) = agora.roomsOf(h2);
        assertEq(list.length, 1, "the room vanished from the list entirely");
        assertFalse(member[0], "it still says they are in it");

        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotAMember.selector);
        agora.speak(key, h2, 0, 0, 0, "still here?");
    }

    function test_rejoiningDoesNotDuplicateTheEntry() public {
        uint256 key = agora.found(h1, "in and out", true);
        vm.prank(other);
        agora.join(key, h2);
        vm.prank(other);
        agora.leave(key, h2);
        vm.prank(other);
        agora.join(key, h2);
        assertEq(agora.roomCount(h2), 1, "the list grew on a rejoin");
        (, bool[] memory member) = agora.roomsOf(h2);
        assertTrue(member[0]);
    }

    function test_onlyTheStewardInvitesAndEvicts() public {
        uint256 key = agora.found(h1, "mine", true);
        vm.prank(other);
        agora.join(key, h2);

        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotTheSteward.selector);
        agora.invite(key, h2, h1);

        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotTheSteward.selector);
        agora.evict(key, h2, h1);

        agora.evict(key, h1, h2);
        assertFalse(agora.inRoom(key, h2));

        // and the steward cannot invite a token nobody holds
        uint256 ghost = agora.persona(address(hub), 99);
        bytes memory ret = refusal(holder, 0, abi.encodeCall(agora.invite, (key, h1, ghost)));
        assertEq(ret, abi.encodeWithSelector(Persona.NotAPersona.selector, address(hub), uint256(99)),
            "an invitation went to a token nobody holds");
    }

    /// @dev A seat is taken once: joining again is refused, and the count
    ///      and the room list say one.
    function test_aSeatedPersonaCannotTakeItsSeatTwice() public {
        uint256 key = agora.found(h1, "once", true);
        vm.prank(other);
        agora.join(key, h2);
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.AlreadyIn.selector);
        agora.join(key, h2);
        assertEq(membersOf(key), 2, "a second join counted a second seat");
        assertEq(agora.roomCount(h2), 1);
    }

    /// @dev What eviction is not. Nothing in this contract can unsay a thing.
    function test_evictionCannotUnsayAnything() public {
        uint256 key = agora.found(h1, "mine", true);
        vm.prank(other);
        agora.join(key, h2);
        sayAs(other, key, h2, "on the record");

        uint64 before = countOf(key);
        agora.evict(key, h1, h2);
        assertEq(countOf(key), before, "evicting somebody changed what the room holds");
    }

    /// @dev Hiding is a presentation bit. The count, the head and the log
    ///      are untouched; only the bit is set, and only by the steward. A
    ///      seq past 255 is hidden too, in the next word of bits — the row
    ///      Parley's mutation gate found no test for (INVARIANTS E1, P11).
    function test_hideIsABitNotADeletion() public {
        uint256 key = agora.found(h1, "moderated", true);
        vm.prank(other);
        agora.join(key, h2);
        sayAs(other, key, h2, "something unwelcome");
        assertFalse(agora.hidden(key, 1));

        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotTheSteward.selector);
        agora.hide(key, h2, 1);

        uint64 before = countOf(key);
        uint64 head = lastOf(key);
        agora.hide(key, h1, 1);
        assertTrue(agora.hidden(key, 1));
        assertFalse(agora.hidden(key, 2), "a neighbouring bit moved");
        assertFalse(agora.hidden(key, 257), "the same bit in the next word moved");
        assertEq(countOf(key), before, "hiding changed the count");
        assertEq(lastOf(key), head, "hiding moved the head");

        agora.hide(key, h1, 300);
        assertTrue(agora.hidden(key, 300), "a message past the first word of bits could not be hidden");
        assertFalse(agora.hidden(key, 44), "hiding 300 set the bit of 44 in the first word");
        assertFalse(agora.hidden(key, 556), "hiding 300 set a bit in the third word");
    }

    /*═══════════════ home rooms ═══════════════*/

    /// @dev Parley's home room, with personas: it comes into being with its
    ///      steward's first act, and its door is open. Following is no longer
    ///      a seat here — Agora keeps a follow graph of its own (below) — but
    ///      a seat in a home is still a seat, given and taken the same way.
    function test_aHomeRoomOpensWithItsStewardsFirstWord() public {
        uint256 home = agora.homeKey(h1);

        // nothing to join before the first word
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NoSuchRoom.selector);
        agora.join(home, h2);

        say(home, h1, "first word, in my own room");
        (,,,, uint8 kind, bool open, uint256 steward,,,,) = agora.stateOf(home);
        assertEq(kind, agora.IS_HOME());
        assertTrue(open, "a home room is not open");
        assertEq(steward, h1, "the persona is not its own steward");

        vm.prank(other);
        agora.join(home, h2);
        assertTrue(agora.inRoom(home, h2));
        assertEq(membersOf(home), 1, "the seat was not counted");

        // the steward does not take a seat in its own home, and cannot
        vm.expectRevert(IAgoraEvents.AlreadyIn.selector);
        agora.join(home, h1);

        // a guest may speak there, the steward by right; the steward may show the guest the door
        sayAs(other, home, h2, "nice room");
        say(home, h1, "thank you, it is mine");
        assertEq(countOf(home), 3, "the steward could not speak again in its own home");
        agora.evict(home, h1, h2);
        assertFalse(agora.inRoom(home, h2));
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotAMember.selector);
        agora.speak(home, h2, 0, 0, 0, "still here?");

        // a stranger cannot steward somebody else's home
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NotTheSteward.selector);
        agora.setCooldown(home, h2, 60);
    }

    function test_aHomeRoomAlsoOpensWithAnInvitationOrACooldown() public {
        uint256 home2 = agora.homeKey(h2);
        vm.prank(other);
        agora.invite(home2, h2, h1);
        (,,,, uint8 kind,, uint256 steward,,,,) = agora.stateOf(home2);
        assertEq(kind, agora.IS_HOME());
        assertEq(steward, h2);
        agora.join(home2, h1);
        assertTrue(agora.inRoom(home2, h1));

        hub.mint(holder);                                   // #3
        uint256 h3 = agora.persona(address(hub), 3);
        uint256 home3 = agora.homeKey(h3);
        agora.setCooldown(home3, h3, 30);
        uint32 cd;
        (,,,, kind,, steward,, cd,,) = agora.stateOf(home3);
        assertEq(kind, agora.IS_HOME());
        assertEq(steward, h3);
        assertEq(cd, 30);
    }

    /// @dev Parley's `stewardedBy` listing lived in Roster, which Agora does
    ///      not carry; what remains is the numbering a page builds links from.
    function test_groupsAreNumberedFromOneAndKeyedByTheirNumber() public {
        assertEq(agora.groups(), 0);
        uint256 a = agora.found(h1, "a", true);
        vm.prank(other);
        uint256 b = agora.found(h2, "b", false);
        assertEq(agora.groups(), 2, "the group counter did not count");
        assertEq(a, agora.groupKey(1), "the first group did not take the first key");
        assertEq(b, agora.groupKey(2));
        (,,,,, bool open, uint256 steward, uint256 index,,,) = agora.stateOf(b);
        assertFalse(open);
        assertEq(steward, h2, "the founder is not the steward");
        assertEq(index, 2, "the group does not know its own number");
        assertEq(agora.nameOf(a), "a");
    }

    /*═══════════════ what a sale ends, and what it passes on ═══════════════*/

    function test_aSaleEmptiesTheSellersSeatAndTheBuyerTakesItsOwn() public {
        uint256 key = agora.found(h1, "open house", true);
        vm.prank(other);
        agora.join(key, h2);
        assertTrue(agora.inRoom(key, h2));
        assertEq(membersOf(key), 2);

        vm.prank(other);
        hub.transferFrom(other, carol, 2);
        assertFalse(agora.inRoom(key, h2), "the seller's seat passed to the buyer with the token");
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.NotAMember.selector);
        agora.speak(key, h2, 0, 0, 0, "the buyer, in the seller's seat");

        vm.prank(carol);
        agora.join(key, h2);
        assertTrue(agora.inRoom(key, h2), "the buyer could not take a seat of its own");
        assertEq(membersOf(key), 2, "a seat a sale left behind was counted twice when it was taken again");
        sayAs(carol, key, h2, "the buyer, in its own seat");
        assertEq(agora.roomCount(h2), 1, "the room list grew when the buyer took the seat");
    }

    function test_anInvitationIsToTheHolderAndDiesWithTheSale() public {
        uint256 key = agora.found(h1, "by invitation", false);
        agora.invite(key, h1, h2);
        assertTrue(agora.invited(key, h2));

        vm.prank(other);
        hub.transferFrom(other, carol, 2);
        assertFalse(agora.invited(key, h2), "an invitation to the seller passed to the buyer");
        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.NotInvited.selector);
        agora.join(key, h2);

        agora.invite(key, h1, h2);                          // the steward invites the buyer
        vm.prank(carol);
        agora.join(key, h2);
        assertTrue(agora.inRoom(key, h2), "the buyer, invited, could not join");
    }

    /// @dev The stewardship is the token's: a buyer governs the groups and
    ///      the home its token founded, and speaks in them by right though it
    ///      holds no live seat there.
    function test_aBuyerStewardsTheGroupsAndTheHomeItsTokenFounded() public {
        uint256 key = agora.found(h1, "mine to sell", false);
        uint256 home = agora.homeKey(h1);
        say(home, h1, "home");
        hub.transferFrom(holder, carol, 1);

        assertFalse(agora.inRoom(key, h1), "the founder's seat passed with the token");
        sayAs(carol, key, h1, "the buyer speaks in the group it now stewards");
        assertEq(countOf(key), 1, "the buyer was locked out of the group its token founded");
        vm.prank(carol);
        agora.invite(key, h1, h2);
        vm.prank(carol);
        agora.setCooldown(home, h1, 60);
        (,,,,,, uint256 steward,,,,) = agora.stateOf(key);
        assertEq(steward, h1, "the stewardship did not stay with the token");

        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.invite(key, h1, h2);                          // the seller
    }

    /// @dev No write happens at a sale, so a seat its persona's sale left
    ///      behind is still counted. The buyer cannot give up a seat it never
    ///      took; the steward can clear it.
    function test_aStewardClearsTheSeatASaleLeftBehind() public {
        uint256 key = agora.found(h1, "tidy", true);
        vm.prank(other);
        agora.join(key, h2);
        vm.prank(other);
        hub.transferFrom(other, carol, 2);
        assertEq(membersOf(key), 2);

        vm.prank(carol);
        vm.expectRevert(IAgoraEvents.NotAMember.selector);
        agora.leave(key, h2);

        agora.evict(key, h1, h2);
        assertEq(membersOf(key), 1, "the steward could not clear the seat a sale left behind");
        vm.expectRevert(IAgoraEvents.NotAMember.selector);
        agora.evict(key, h1, h2);
    }

    /*═══════════════ whispering ═══════════════*/

    function test_aWhisperNeedsSomebodyToWhisperTo() public {
        uint256 ghost = agora.persona(address(hub), 99);
        bytes memory ret = refusal(holder, 0, abi.encodeCall(agora.whisper, (h1, ghost, 0, bytes32(0), bytes("anyone there"))));
        assertEq(ret, abi.encodeWithSelector(Persona.NotAPersona.selector, address(hub), uint256(99)),
            "a whisper to a token nobody holds was not refused as no persona");

        vm.expectRevert(IAgoraEvents.TalkingToYourself.selector);
        agora.whisper(h1, h1, 0, bytes32(0), "hello me");
    }

    function test_bothSidesLandInTheSameRoom() public {
        agora.whisper(h1, h2, 0, bytes32(0), "hello");
        vm.prank(other);
        agora.whisper(h2, h1, 0, bytes32(0), "hello back");

        (, uint64 count,,, uint8 kind,,,,,,) = agora.stateOf(agora.pairKey(h1, h2));
        assertEq(count, 2, "the two halves of one conversation went to two rooms");
        assertEq(kind, 2);
    }

    /*═══════════════ what a message may be ═══════════════*/

    function test_aBodyHasBothEnds() public {
        vm.expectRevert(IAgoraEvents.BadBody.selector);
        agora.speak(0, h1, 0, 0, 0, "");

        bytes memory big = new bytes(agora.MAX_BODY() + 1);
        vm.expectRevert(IAgoraEvents.BadBody.selector);
        agora.speak(0, h1, 0, 0, 0, big);

        bytes memory edge = new bytes(agora.MAX_BODY());
        say(0, h1, edge);                                   // exactly at the limit
    }

    /// @dev A sealed envelope carries two copies, a salt and a point, so it
    ///      is allowed 4,096 bytes — and not one more. Both sides bind a key:
    ///      a sealed whisper needs one on each.
    function test_aSealedBodyMayBeFourTimesLonger() public {
        keys.setEncryptionKey(3, hex"04aa");
        agora.bindKey(h1);
        (, bytes32 kid,) = agora.keyOf(h1);
        vm.prank(other);
        keys.setEncryptionKey(3, hex"04bb");
        vm.prank(other);
        agora.bindKey(h2);

        bytes memory plainTooBig = new bytes(agora.MAX_BODY() + 1);
        vm.prank(other);
        agora.whisper(h2, h1, 1, kid, plainTooBig);          // fine when sealed

        bytes memory sealedEdge = new bytes(agora.MAX_SEALED());
        vm.prank(other);
        agora.whisper(h2, h1, 1, kid, sealedEdge);

        bytes memory sealedTooBig = new bytes(agora.MAX_SEALED() + 1);
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.BadBody.selector);
        agora.whisper(h2, h1, 1, kid, sealedTooBig);
    }

    function test_aKindThisContractDoesNotKnowIsRefused() public {
        vm.expectRevert(IAgoraEvents.BadKind.selector);
        agora.speak(0, h1, 2, 0, 0, "what am i");
        agora.speak(0, h1, 1, 0, 0, "sealed");             // 1 is a real kind
    }

    function test_aRoomNeedsAName() public {
        vm.expectRevert(IAgoraEvents.BadName.selector);
        agora.found(h1, "", true);

        string memory long = new string(agora.MAX_NAME() + 1);
        vm.expectRevert(IAgoraEvents.BadName.selector);
        agora.found(h1, long, true);

        string memory edge = new string(agora.MAX_NAME());
        agora.found(h1, edge, true);                        // exactly at the limit
        assertEq(agora.groups(), 1, "a name of exactly the limit was refused");
    }

    /// @dev A reply names (block, seq) of the message it answers, in the
    ///      same room. Both halves or neither, and never a seq the room has
    ///      not reached — so a thread walked by logs never dangles.
    function test_aReplyPointerIsWalkable() public {
        uint64 b1 = uint64(block.number);
        say(0, h1, "a question");
        vm.roll(b1 + 2);

        vm.expectRevert(IAgoraEvents.BadReply.selector);
        agora.speak(0, h1, 0, b1, 0, "half a pointer");
        vm.expectRevert(IAgoraEvents.BadReply.selector);
        agora.speak(0, h1, 0, 0, 1, "the other half");
        vm.expectRevert(IAgoraEvents.BadReply.selector);
        agora.speak(0, h1, 0, b1, 2, "a reply to a message not yet said");

        agora.speak(0, h1, 0, b1, 1, "an answer");
        assertEq(countOf(0), 2);
        vm.roll(b1 + 4);
        agora.speak(0, h1, 0, b1 + 2, 2, "an answer to the answer");
        assertEq(countOf(0), 3);
    }

    /*═══════════════ sealing keys ═══════════════*/

    /// @dev `bindKey` is `holds` — not the Reach, not a stranger — and
    ///      needs a key in the registry to bind.
    function test_onlyTheHolderBindsItsOwnKey() public {
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.bindKey(h1);

        address bound = hub.account(1);
        vm.prank(bound);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.bindKey(h1);

        vm.expectRevert(IAgoraEvents.NoKey.selector);
        agora.bindKey(h1);                                  // nothing published yet

        keys.setEncryptionKey(3, hex"04beef");
        agora.bindKey(h1);
        (uint16 keyType, bytes32 keyId, bytes memory pk) = agora.keyOf(h1);
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
    ///      departed holder. The binding is stamped, and the hub's stamp
    ///      moves on every transfer, so a buy-back revives nothing either.
    function test_aSoldPersonaHasNoKey() public {
        keys.setEncryptionKey(3, hex"04aa");
        agora.bindKey(h1);
        (, bytes32 before,) = agora.keyOf(h1);
        assertTrue(before != bytes32(0));
        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c2");
        vm.prank(other);
        agora.bindKey(h2);                                  // the sender keeps a live key throughout
        vm.prank(carol);
        keys.setEncryptionKey(1, hex"bb");                  // the buyer has a key before it buys

        hub.transferFrom(holder, carol, 1);
        (uint16 t, bytes32 kid, bytes memory pk) = agora.keyOf(h1);
        assertEq(t, 0, "the former holder's key type remained");
        assertEq(kid, bytes32(0), "a key was served under the seller's binding after the sale");
        assertEq(pk.length, 0, "a public key was still served under the seller's binding");

        // a sealed whisper to the sold persona is refused: no key, not a stale one
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.NoKey.selector);
        agora.whisper(h2, h1, 1, before, "sealed to a ghost");

        // the buyer binds its own
        vm.prank(carol);
        agora.bindKey(h1);
        (, kid,) = agora.keyOf(h1);
        assertEq(kid, keccak256(hex"bb"), "the current holder could not bind");

        // and a buy-back by the original holder revives the old binding not at all
        vm.prank(carol);
        hub.transferFrom(carol, holder, 1);
        (, kid,) = agora.keyOf(h1);
        assertEq(kid, bytes32(0), "away-and-back revived a binding");
    }

    function test_aForeignSaleKillsTheKeyBindingToo() public {
        keys.setEncryptionKey(3, hex"04aa");
        agora.bindKey(h1);
        vm.prank(carol);
        keys.setEncryptionKey(3, hex"04ca");
        vm.prank(carol);
        agora.bindKey(ape7);
        (, bytes32 before,) = agora.keyOf(ape7);
        assertEq(before, keccak256(hex"04ca"), "a foreign token's holder could not bind a key");
        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c1");                // the buyer has a key before it buys

        vm.prank(carol);
        apes.transferFrom(carol, other, 7);
        (, bytes32 after_,) = agora.keyOf(ape7);
        assertEq(after_, bytes32(0), "a foreign token's key outlived its sale");
        vm.expectRevert(IAgoraEvents.NoKey.selector);
        agora.whisper(h1, ape7, 1, before, "sealed to the seller of an Ape");
    }

    /// @dev Persona's stamp is (holder, custody epoch), and a collection that
    ///      reports no epoch is stamped by its holder alone: there a buy-back
    ///      by the binder finds its binding where it left it, while on a
    ///      collection that reports one — the hub, every Studio collection —
    ///      a buy-back revives nothing. Both, side by side.
    function test_aCollectionWithoutAnEpochIsStampedByItsHolderAlone() public {
        vm.prank(carol);
        keys.setEncryptionKey(3, hex"04ca");
        vm.prank(carol);
        agora.bindKey(ape7);
        vm.prank(carol);
        agora.bindKey(moon1);

        vm.prank(carol);
        apes.transferFrom(carol, other, 7);
        vm.prank(carol);
        moons.transferFrom(carol, other, 1);
        (, bytes32 ape,) = agora.keyOf(ape7);
        (, bytes32 moon,) = agora.keyOf(moon1);
        assertEq(ape, bytes32(0), "a sale did not move an Ape's stamp");
        assertEq(moon, bytes32(0), "a sale did not move a Moon's stamp");

        vm.prank(other);
        apes.transferFrom(other, carol, 7);
        vm.prank(other);
        moons.transferFrom(other, carol, 1);
        (, ape,) = agora.keyOf(ape7);
        (, moon,) = agora.keyOf(moon1);
        assertEq(ape, keccak256(hex"04ca"), "a collection without an epoch was stamped by more than its holder");
        assertEq(moon, bytes32(0), "a buy-back of a token with an epoch revived its binding");
    }

    /// @dev ANIMA's mempool-rotation guard: the client names the key it
    ///      sealed to, and the send fails if the recipient's key is not that
    ///      one any more — rotated or revoked.
    function test_aRotatedKeyRefusesTheWhisper() public {
        keys.setEncryptionKey(3, hex"04aa");
        agora.bindKey(h1);
        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c1");
        vm.prank(other);
        agora.bindKey(h2);
        bytes32 k1 = keccak256(hex"04c1");

        agora.whisper(h1, h2, 1, k1, "sealed to k1");       // fine

        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c2");                // rotated in the registry
        vm.expectRevert(IAgoraEvents.KeyMoved.selector);
        agora.whisper(h1, h2, 1, k1, "sealed to the old key");
        (, bytes32 live,) = agora.keyOf(h2);
        assertEq(live, keccak256(hex"04c2"), "the binding did not follow the registry");
        agora.whisper(h1, h2, 1, live, "sealed to k2");     // the new key works

        vm.prank(other);
        keys.revokeEncryptionKey();                         // withdrawn
        vm.expectRevert(IAgoraEvents.NoKey.selector);
        agora.whisper(h1, h2, 1, live, "sealed to nothing");

        // a plain whisper never asks about keys
        agora.whisper(h1, h2, 0, bytes32(0), "in the clear");
    }

    function test_aSealedWhisperToAPersonaWithoutABindingIsRefused() public {
        keys.setEncryptionKey(3, hex"04aa");
        agora.bindKey(h1);
        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c1");                // published, never bound
        vm.expectRevert(IAgoraEvents.NoKey.selector);
        agora.whisper(h1, h2, 1, keccak256(hex"04c1"), "sealed to an unbound key");
    }

    /// @dev The envelope carries a copy for each side. A sender with no live
    ///      key could seal only to the recipient and never read its own words
    ///      back, so the send is refused rather than recorded.
    function test_aSealedWhisperNeedsTheSendersKeyToo() public {
        vm.prank(other);
        keys.setEncryptionKey(3, hex"04c1");
        vm.prank(other);
        agora.bindKey(h2);
        bytes32 theirs = keccak256(hex"04c1");

        vm.expectRevert(IAgoraEvents.NoKey.selector);
        agora.whisper(h1, h2, 1, theirs, "sealed by a sender with no key");

        keys.setEncryptionKey(3, hex"04aa");                // published, not yet bound
        vm.expectRevert(IAgoraEvents.NoKey.selector);
        agora.whisper(h1, h2, 1, theirs, "sealed by a sender with an unbound key");

        agora.bindKey(h1);
        agora.whisper(h1, h2, 1, theirs, "sealed, both keys live");
        assertEq(countOf(agora.pairKey(h1, h2)), 1, "a sealed whisper with both keys live was not recorded");
    }

    /*═══════════════ reactions ═══════════════*/

    function test_aReactionNamesAMessageTheRoomHasReached() public {
        uint256 apesRoom = agora.collectionKey(address(apes));
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.BadReply.selector);
        agora.react(0, h2, 1, h1, "+");                    // nothing said yet

        say(0, h1, "one");
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.BadReply.selector);
        agora.react(0, h2, 0, h1, "+");                    // there is no message zero
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.BadReply.selector);
        agora.react(0, h2, 2, h1, "+");                    // a message not yet said
        vm.prank(other);
        agora.react(0, h2, 1, h1, "+");                    // the one that was
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.BadReply.selector);
        agora.react(apesRoom, h2, 1, ape7, "+");           // the count is the room's own
    }

    function test_aGlyphIsOneToFourBytesOfUtf8LeftAligned() public {
        say(0, h1, "react to me");
        bytes4[11] memory good = [
            bytes4("+"), bytes4("+1"), bytes4("ok!!"),
            bytes4(hex"c3a9"),          // é
            bytes4(hex"e29ca6"),        // ✦
            bytes4(hex"e282ac"),        // €
            bytes4(hex"f09f918d"),      // 👍
            bytes4(hex"61c3a9"),        // "aé"
            bytes4(hex"ed9fbf"),        // U+D7FF, the last before the surrogates
            bytes4(hex"ee8080"),        // U+E000, the first after them
            bytes4(hex"f48fbfbf")       // U+10FFFF, the last code point
        ];
        for (uint256 i; i < good.length; ++i) agora.react(0, h1, 1, h1, good[i]);

        bytes4[16] memory bad = [
            bytes4(0),                  // nothing
            bytes4(hex"ff"),            // never a byte of UTF-8
            bytes4(hex"80"),            // a continuation with no lead
            bytes4(hex"c080"),          // an overlong NUL
            bytes4(hex"c1bf"),          // an overlong two-byte form
            bytes4(hex"e08080"),        // an overlong three-byte form
            bytes4(hex"e09fbf"),        // overlong, at the top of its range
            bytes4(hex"eda080"),        // a surrogate
            bytes4(hex"f08f8080"),      // an overlong four-byte form
            bytes4(hex"f4908080"),      // past U+10FFFF
            bytes4(hex"f5808080"),      // a lead no code point has
            bytes4(hex"e29c"),          // a character cut short
            bytes4(hex"6161e29c"),      // a character that does not fit
            bytes4(hex"c3"),            // a lead with nothing after it
            bytes4(hex"41004200"),      // a gap: "A", then a "B" no page shows
            bytes4(hex"00410000")       // not left-aligned
        ];
        for (uint256 i; i < bad.length; ++i) {
            vm.expectRevert(IAgoraEvents.BadGlyph.selector);
            agora.react(0, h1, 1, h1, bad[i]);
        }
    }

    function test_aTipLandsInTheAuthorsFeeSinkAndNowhereElse() public {
        say(0, h1, "worth a tip");
        address sink = hub.feeSink(1);
        assertEq(sink, hub.account(1), "the fixture's fee sink is not the Reach");
        uint256 tip = 0.0001 ether;
        uint256 sinkBefore = sink.balance;
        uint256 reactorBefore = other.balance;
        uint256 holderBefore = holder.balance;
        uint256 reactorReachBefore = hub.account(2).balance;

        vm.prank(other);
        agora.react{value: tip}(0, h2, 1, h1, bytes4(hex"e29ca6"));

        assertEq(sink.balance, sinkBefore + tip, "the tip did not land in the author's fee sink");
        assertEq(other.balance, reactorBefore - tip, "the reactor did not pay exactly the tip");
        assertEq(address(agora).balance, 0, "Agora kept some of the tip");
        assertEq(holder.balance, holderBefore, "the tip went to the author's holder instead of its fee sink");
        assertEq(hub.account(2).balance, reactorReachBefore, "the tip went to the reactor's own Reach");
    }

    function test_aTipFollowsTheFeesIntoTheGrip() public {
        say(0, h1, "fees to the grip");
        hub.setFeesToGrip(1, true);
        address grip = hub.grip(1);
        uint256 reachBefore = hub.account(1).balance;
        vm.prank(other);
        agora.react{value: 1 gwei}(0, h2, 1, h1, "+");
        assertEq(grip.balance, 1 gwei, "a tip ignored the holder's choice of the Grip");
        assertEq(hub.account(1).balance, reachBefore, "a tip went to the Reach after the holder chose the Grip");
    }

    function test_aTipToAForeignAuthorLandsWithItsHolder() public {
        uint256 room = agora.collectionKey(address(apes));
        sayAs(carol, room, ape7, "an Ape's word");
        uint256 before = carol.balance;
        vm.prank(other);
        agora.react{value: 0.0001 ether}(room, h2, 1, ape7, "+");   // a hub token tips an Ape, in the Apes room
        assertEq(carol.balance, before + 0.0001 ether, "a tip to a foreign token did not reach its holder");
        assertEq(address(agora).balance, 0);
    }

    function test_aTippedReactionToAPersonaNobodyHoldsIsRefused() public {
        say(0, h1, "a word");
        uint256 ghost = agora.persona(address(hub), 99);
        uint256 lostApe = agora.persona(address(apes), 99);
        uint256 before = other.balance;

        bytes memory ret = refusal(other, 1 gwei, abi.encodeCall(agora.react, (0, h2, 1, ghost, bytes4("+"))));
        assertEq(ret, abi.encodeWithSelector(IAgoraEvents.NoPayee.selector, ghost),
            "a tip to a hub token nobody holds was not refused as having no payee");
        ret = refusal(other, 1 gwei, abi.encodeCall(agora.react, (0, h2, 1, lostApe, bytes4("+"))));
        assertEq(ret, abi.encodeWithSelector(IAgoraEvents.NoPayee.selector, lostApe),
            "a tip to a foreign token nobody holds was not refused as having no payee");
        ret = refusal(other, 1 gwei, abi.encodeCall(agora.react, (0, h2, 1, uint256(1), bytes4("+"))));
        assertEq(ret, abi.encodeWithSelector(IAgoraEvents.NoPayee.selector, uint256(1)),
            "a tip to a raw id, collection zero, was not refused as having no payee");
        assertEq(other.balance, before, "a refused tip moved money");
        assertEq(address(agora).balance, 0);
    }

    function test_aTipThePayeeRefusesIsRefused() public {
        say(0, h1, "a word");
        StubReach(payable(hub.account(1))).setRefuse(true);
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.TipFailed.selector);
        agora.react{value: 1 gwei}(0, h2, 1, h1, "+");

        // the name is the reactor's claim and the contract cannot check it;
        // what it can do is refuse a push the payee will not take
        AgoraRefusingHolder wall = new AgoraRefusingHolder();
        apes.mint(address(wall), 9);
        uint256 ape9 = agora.persona(address(apes), 9);
        vm.prank(other);
        vm.expectRevert(IAgoraEvents.TipFailed.selector);
        agora.react{value: 1 gwei}(0, h2, 1, ape9, "+");
        assertEq(address(agora).balance, 0, "a refused tip stayed in Agora");
    }

    function test_aReactionWithoutATipAsksNothingOfThePayee() public {
        say(0, h1, "a word");
        uint256 ghost = agora.persona(address(hub), 99);
        StubReach(payable(hub.account(1))).setRefuse(true);
        vm.prank(other);
        agora.react(0, h2, 1, h1, "+");                    // a payee that refuses is not asked
        vm.prank(other);
        agora.react(0, h2, 1, ghost, "+");                 // nor is a payee that does not exist
    }

    /// @dev The push is the last thing a reaction does, under the lock: a
    ///      payee that calls back while it is being paid finds speech and
    ///      reaction shut, and the tip still arrives.
    function test_aPayeeCannotReenterWhileItIsBeingPaid() public {
        AgoraReentrantHolder loud = new AgoraReentrantHolder(agora);
        apes.mint(address(loud), 11);
        uint256 ape11 = agora.persona(address(apes), 11);
        say(0, h1, "a word");
        loud.aim(ape11, 0, 1);

        vm.prank(other);
        agora.react{value: 1 gwei}(0, h2, 1, ape11, "+");
        assertTrue(loud.called(), "the payee was never paid");
        assertEq(address(loud).balance, 1 gwei, "the tip did not arrive");
        assertEq(bytes32(loud.reactRefusal()), bytes32(IAgoraEvents.Reentrancy.selector),
            "a payee reacted again while it was being paid");
        assertEq(bytes32(loud.speakRefusal()), bytes32(IAgoraEvents.Reentrancy.selector),
            "a payee spoke while it was being paid");
    }

    /*═══════════════ follows ═══════════════*/

    function test_followingTwiceCountsOnce() public {
        vm.prank(other);
        agora.follow(h2, h1, true);
        vm.prank(other);
        agora.follow(h2, h1, true);
        assertTrue(agora.follows(h2, h1), "the follow did not take");
        assertEq(agora.followerCount(h1), 1, "following twice counted twice");
        assertEq(agora.followingCount(h2), 1, "following twice counted twice on the follower's side");

        vm.prank(other);
        agora.follow(h2, h1, false);
        assertFalse(agora.follows(h2, h1), "the unfollow did not take");
        assertEq(agora.followerCount(h1), 0);
        assertEq(agora.followingCount(h2), 0);
    }

    function test_unfollowingWhatYouDoNotFollowChangesNothing() public {
        vm.prank(carol);
        agora.follow(ape7, h1, true);
        vm.prank(other);
        agora.follow(h2, h1, false);                        // never followed
        assertEq(agora.followerCount(h1), 1, "an unfollow of nothing took a follower away");
        assertEq(agora.followingCount(h2), 0, "an unfollow of nothing moved the follower's count");
        assertFalse(agora.follows(h2, h1));
    }

    function test_aPersonaCannotFollowItself() public {
        vm.expectRevert(IAgoraEvents.TalkingToYourself.selector);
        agora.follow(h1, h1, true);
        assertEq(agora.followerCount(h1), 0);
    }

    /// @dev Follows are keyed by the persona itself and survive a sale, by
    ///      design: a token's followers follow the token to its next holder,
    ///      and what the token followed passes with it for the buyer to keep
    ///      or undo — the seller can undo nothing any more.
    function test_followsBelongToTheTokenAndSurviveItsSale() public {
        vm.prank(other);
        agora.follow(h2, h1, true);
        vm.prank(carol);
        agora.follow(ape7, h1, true);
        agora.follow(h1, ape7, true);

        hub.transferFrom(holder, dave, 1);
        assertTrue(agora.follows(h2, h1), "a sale took a follower away from the token");
        assertEq(agora.followerCount(h1), 2, "a sale changed the token's follower count");
        assertTrue(agora.follows(h1, ape7), "what the token followed did not pass to its buyer");

        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.follow(h1, ape7, false);                      // the seller
        vm.prank(dave);
        agora.follow(h1, ape7, false);                      // the buyer may undo what it inherited
        assertEq(agora.followerCount(ape7), 0);

        vm.prank(carol);
        apes.transferFrom(carol, other, 7);
        assertTrue(agora.follows(ape7, h1), "a foreign token's follows did not survive its sale");
        assertEq(agora.followingCount(ape7), 1);
    }

    function test_aNewFollowNeedsAPersonaSomebodyHolds() public {
        uint256 ghost = agora.persona(address(hub), 99);
        bytes memory ret = refusal(holder, 0, abi.encodeCall(agora.follow, (h1, ghost, true)));
        assertEq(ret, abi.encodeWithSelector(Persona.NotAPersona.selector, address(hub), uint256(99)),
            "a token nobody holds was followed");
        ret = refusal(holder, 0, abi.encodeCall(agora.follow, (h1, uint256(2), true)));
        assertEq(ret, abi.encodeWithSelector(Persona.NotAPersona.selector, address(0), uint256(2)),
            "a raw id was followed as if it were a persona");

        // and undoing a follow never needs one
        agora.follow(h1, ape7, true);
        vm.prank(carol);
        apes.transferFrom(carol, address(0), 7);            // gone
        agora.follow(h1, ape7, false);
        assertEq(agora.followerCount(ape7), 0, "a follow of a token nobody holds any more could not be undone");
    }

    function test_onlyAnActorFollowsAsAPersona() public {
        vm.prank(nobody);
        vm.expectRevert(IAgoraEvents.NotYours.selector);
        agora.follow(h1, h2, true);
        address bound = hub.account(1);
        vm.prank(bound);
        agora.follow(h1, h2, true);
        assertTrue(agora.follows(h1, h2), "a hub token's Reach could not follow for it");
    }

    /*═══════════════ the topics a browser cannot compute ═══════════════*/

    /// @dev The client ships no keccak, so it asks for these. If they were
    ///      ever written down by hand rather than derived, a filter would
    ///      match nothing and the chat would be silently, permanently empty
    ///      — which looks exactly like a chat nobody has used yet.
    function test_theTopicsAreDerivedFromTheSignaturesThemselves() public view {
        (bytes32 said, bytes32 founded, bytes32 invited, bytes32 entered, bytes32 departed,
         bytes32 reacted, bytes32 followed) = agora.topics();
        assertEq(said, keccak256("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)"));
        assertEq(founded, keccak256("Founded(uint256,uint256,uint256,bool,string)"));
        assertEq(invited, keccak256("Invited(uint256,uint256,uint256)"));
        assertEq(entered, keccak256("Entered(uint256,uint256)"));
        assertEq(departed, keccak256("Departed(uint256,uint256)"));
        assertEq(reacted, keccak256("Reacted(uint256,uint256,uint256,uint64,bytes4,uint256)"));
        assertEq(followed, keccak256("Followed(uint256,uint256,bool)"));
    }
}
