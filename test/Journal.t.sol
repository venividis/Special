// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Journal} from "../src/Journal.sol";
import {IJournal, IJournalEvents} from "../src/interfaces/IJournal.sol";
import {JournalHub, JournalReach, JournalForeign, JournalLiar, JournalReentrant} from "./mocks/JournalFixtures.sol";
import {MockERC721} from "./mocks/MockERC721.sol";

/*───────────────────────────────────────────────────────────────────────────
  A memory is worth exactly what it costs to forge one.

  INTACT V2 W2, NEW (docs/V2.md §3.2, src/interfaces/IJournal.sol). The
  failures that matter here are not "a memory is stored". They are the
  wrong hand writing in a token's name — a renter, an operator, the seller
  after the sale, a collection's own idea of an account; a bound one byte
  off; a root that forgets one of the seven fields it promises to commit
  to; a count that skips; an epoch assumed instead of read; and a lying
  collection writing outside its own pages.

  The harness is not forge: `expectRevert(bytes)` matches any revert, so an
  exact refusal is asserted through a raw call that returns its data, and
  there is no log capture, so the event is asserted through the root it
  folds (tools/verify-journal.mjs reads the logs themselves). A test runs
  as one transaction, and transient storage clears only at its end, so
  every test that writes twice also proves the lock is released.
───────────────────────────────────────────────────────────────────────────*/
contract JournalTest is Test {
    JournalHub hub;
    Journal journal;
    MockERC721 art;
    JournalForeign foreign;

    address holder   = address(this);
    address other    = address(0x0777);
    address renter   = address(0x4E7);
    address operator = address(0x0BE);
    address nobody   = address(0xDEAD);

    uint8 constant NOTE = 0;
    uint8 constant TRADE = 1;
    uint8 constant GIFT = 2;
    uint8 constant MILESTONE = 3;
    uint8 constant SEALED = 4;

    bytes32 constant REF = keccak256("the swap: market, amounts, block");

    function setUp() public {
        hub = new JournalHub();
        journal = new Journal(address(hub));
        art = new MockERC721();
        foreign = new JournalForeign();
        vm.warp(1_733_000_000);

        hub.mint(holder);                                 // #1, this contract
        hub.mint(other);                                  // #2, `other`
        art.mint(holder, 1);
        art.mint(other, 2);
        for (uint256 id = 1; id <= 5; ++id) foreign.mint(holder, id);
    }

    /*═══════════════ helpers ═══════════════*/

    /// @dev The formula, written once on this side: IJournal's comment, word for word.
    function fold(bytes32 root, uint256 n, uint8 kind, bytes memory body, bytes32 ref, address author, uint64 epoch)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encode(root, n, kind, keccak256(body), ref, author, epoch));
    }

    function write(address who, address collection, uint256 id, uint8 kind, bytes memory body, bytes32 ref)
        internal returns (uint256 n)
    {
        vm.prank(who);
        n = journal.inscribe(collection, id, kind, body, ref);
    }

    /// @dev The refusal's exact data, selector and arguments.
    function refusal(address who, address collection, uint256 id, uint8 kind, bytes memory body, bytes32 ref)
        internal returns (bytes memory ret)
    {
        bool ok;
        vm.prank(who);
        (ok, ret) = address(journal).call(abi.encodeCall(IJournal.inscribe, (collection, id, kind, body, ref)));
        assertFalse(ok, "a write that must be refused went through");
    }

    function notYours() internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IJournalEvents.NotYours.selector);
    }

    function tooLong(uint256 length, uint256 max) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IJournalEvents.TooLong.selector, length, max);
    }

    function filled(uint256 len) internal pure returns (bytes memory b) {
        b = new bytes(len);
        for (uint256 i; i < len; ++i) b[i] = bytes1(uint8(0x61 + i % 26));
    }

    function viaReach(address driver, uint256 token, address collection, uint256 id, uint8 kind, bytes memory body, bytes32 ref)
        internal returns (uint256)
    {
        address reach = hub.account(token);
        bytes memory call_ = abi.encodeCall(IJournal.inscribe, (collection, id, kind, body, ref));
        vm.prank(driver);
        return abi.decode(JournalReach(reach).execute(address(journal), call_), (uint256));
    }

    /*═══════════════ the shape ═══════════════*/

    function test_theKindsAndTheBoundsAreTheInterfaces() public view {
        assertEq(uint256(journal.NOTE()), 0, "NOTE is not 0");
        assertEq(uint256(journal.TRADE()), 1, "TRADE is not 1");
        assertEq(uint256(journal.GIFT()), 2, "GIFT is not 2");
        assertEq(uint256(journal.MILESTONE()), 3, "MILESTONE is not 3");
        assertEq(uint256(journal.SEALED()), 4, "SEALED is not 4");
        assertEq(journal.MAX_PLAIN(), 1024, "a plain body is not bounded at 1,024 bytes");
        assertEq(journal.MAX_SEALED(), 4096, "a sealed body is not bounded at 4,096 bytes");
        assertEq(journal.HUB(), address(hub), "the Journal does not know its hub");
    }

    /*═══════════════ who writes, on the hub ═══════════════*/

    function test_theHolderWritesAndTheFirstMemoryIsNumberOne() public {
        assertTrue(journal.mayInscribe(address(hub), 1, holder), "the holder may not write into their own token");
        uint256 n = journal.inscribe(address(hub), 1, NOTE, "the day it was minted", bytes32(0));
        assertEq(n, 1, "the first memory is not number one");
        assertEq(journal.countOf(address(hub), 1), 1, "the count did not record it");
        assertEq(journal.rootOf(address(hub), 1), fold(bytes32(0), 1, NOTE, "the day it was minted", bytes32(0), holder, 1),
            "the first root is not the formula over the zero root");
    }

    /// @dev `acts`: the token acting for itself, which is how "swap, lock,
    ///      inscribe" is one batch. The author recorded is the Reach.
    function test_theTokensReachWritesForIt() public {
        address reach = hub.account(1);
        assertTrue(journal.mayInscribe(address(hub), 1, reach), "the token cannot write as itself");
        uint256 n = viaReach(holder, 1, address(hub), 1, MILESTONE, "written by the token itself", REF);
        assertEq(n, 1, "the Reach's memory is not number one");
        assertEq(journal.rootOf(address(hub), 1), fold(bytes32(0), 1, MILESTONE, "written by the token itself", REF, reach, 1),
            "the author folded into the root is not the Reach");
    }

    function test_aTokensReachIsAPenForItsOwnTokenOnly() public {
        address reach1 = hub.account(1);
        assertFalse(journal.mayInscribe(address(hub), 2, reach1), "token 1's Reach may write into token 2");
        assertFalse(journal.mayInscribe(address(art), 1, reach1), "the hub's Reach may write into another collection's token");
        bytes memory into2 = abi.encodeCall(IJournal.inscribe, (address(hub), 2, NOTE, bytes("not mine"), bytes32(0)));
        vm.expectRevert(IJournalEvents.NotYours.selector);
        JournalReach(reach1).execute(address(journal), into2);
        assertEq(journal.countOf(address(hub), 2), 0, "token 1's Reach wrote into token 2");
    }

    /// @dev A lease buys the instrument's use for a while; a memory is
    ///      written in the token's name and outlives the lease.
    function test_aRenterCannotWrite() public {
        hub.setUser(1, renter, uint64(block.timestamp + 1 days));
        assertEq(hub.userOf(1), renter, "the lease did not take");
        assertFalse(journal.mayInscribe(address(hub), 1, renter), "a renter was handed the token's pen");
        assertEq(refusal(renter, address(hub), 1, NOTE, "I am renting this", bytes32(0)), notYours(),
            "the renter's write was not refused as NotYours");
        assertEq(journal.countOf(address(hub), 1), 0, "a renter's write was counted");
    }

    /// @dev An approval is permission to move the token; a phished one must
    ///      not also be a pen.
    function test_anApprovedOperatorCannotWrite() public {
        hub.approve(operator, 1);
        hub.setApprovalForAll(nobody, true);
        assertEq(hub.getApproved(1), operator, "the approval did not take");
        assertTrue(hub.isApprovedForAll(holder, nobody), "the operator approval did not take");
        assertFalse(journal.mayInscribe(address(hub), 1, operator), "an approved address may write");
        assertFalse(journal.mayInscribe(address(hub), 1, nobody), "an approved operator may write");
        assertEq(refusal(operator, address(hub), 1, NOTE, "I may move it", bytes32(0)), notYours(),
            "the approved address's write was not refused as NotYours");
        assertEq(refusal(nobody, address(hub), 1, NOTE, "I may move them all", bytes32(0)), notYours(),
            "the operator's write was not refused as NotYours");
        assertEq(journal.countOf(address(hub), 1), 0, "an operator's write was counted");
    }

    function test_aStrangerAndAnotherTokensHolderCannotWrite() public {
        assertEq(refusal(nobody, address(hub), 1, NOTE, "passing by", bytes32(0)), notYours(),
            "a stranger's write was not refused as NotYours");
        assertEq(refusal(other, address(hub), 1, NOTE, "I hold token 2", bytes32(0)), notYours(),
            "another token's holder wrote into token 1");
        assertEq(journal.countOf(address(hub), 1), 0, "a refused write was counted");
    }

    function test_aTokenThatDoesNotExistTakesNoMemory() public {
        assertFalse(journal.mayInscribe(address(hub), 99, holder), "an unminted token has a holder");
        assertFalse(journal.mayInscribe(address(hub), 99, address(0)), "the zero address may write into an unminted token");
        assertEq(refusal(holder, address(hub), 99, NOTE, "nothing here", bytes32(0)), notYours(),
            "a write into an unminted token was not refused as NotYours");
    }

    /// @dev The sale moves the pen and the epoch together: the seller is
    ///      refused, and the buyer's memory folds epoch 2.
    function test_aSaleRefusesTheSellerAndAdmitsTheBuyerUnderTheNextEpoch() public {
        journal.inscribe(address(hub), 1, NOTE, "mine", bytes32(0));
        bytes32 before = journal.rootOf(address(hub), 1);
        hub.transferFrom(holder, other, 1);
        assertEq(uint256(hub.custodyEpoch(1)), 2, "the sale did not move the epoch");
        assertFalse(journal.mayInscribe(address(hub), 1, holder), "the seller still holds the pen");
        assertEq(refusal(holder, address(hub), 1, NOTE, "still mine?", bytes32(0)), notYours(),
            "the seller's write after the sale was not refused as NotYours");
        assertEq(write(other, address(hub), 1, TRADE, "bought it", REF), 2, "the buyer's memory is not the second");
        assertEq(journal.rootOf(address(hub), 1), fold(before, 2, TRADE, "bought it", REF, other, 2),
            "the buyer's memory is not folded under epoch 2");
    }

    /// @dev A buy-back is a new custody: the same address writes under a
    ///      new epoch, read from the hub at the moment of writing.
    function test_theHubsEpochIsReadAtEveryWriteNotAssumed() public {
        journal.inscribe(address(hub), 1, NOTE, "first custody", bytes32(0));
        bytes32 r1 = journal.rootOf(address(hub), 1);
        assertEq(r1, fold(bytes32(0), 1, NOTE, "first custody", bytes32(0), holder, 1), "the minter's memory is not under epoch 1");
        hub.transferFrom(holder, other, 1);
        vm.prank(other);
        hub.transferFrom(other, holder, 1);
        assertEq(uint256(hub.custodyEpoch(1)), 3, "the round trip did not move the epoch twice");
        journal.inscribe(address(hub), 1, NOTE, "bought back", bytes32(0));
        assertEq(journal.rootOf(address(hub), 1), fold(r1, 2, NOTE, "bought back", bytes32(0), holder, 3),
            "the buy-back's memory is not under epoch 3");
        assertTrue(journal.rootOf(address(hub), 1) != fold(r1, 2, NOTE, "bought back", bytes32(0), holder, 1),
            "the buy-back's memory reads as the first custody");
    }

    function test_aPanicMovesTheEpochInPlaceAndTheHolderStillWrites() public {
        hub.panic(1);
        assertEq(uint256(hub.custodyEpoch(1)), 2, "the panic did not move the epoch");
        assertTrue(journal.mayInscribe(address(hub), 1, holder), "the holder lost the pen to a panic");
        journal.inscribe(address(hub), 1, MILESTONE, "after the panic", bytes32(0));
        assertEq(journal.rootOf(address(hub), 1), fold(bytes32(0), 1, MILESTONE, "after the panic", bytes32(0), holder, 2),
            "the memory after a panic is not under the new epoch");
    }

    /// @dev The hub is read with a typed call: a hub that cannot answer
    ///      stops the write rather than recording an epoch no token had.
    function test_aHubThatCannotAnswerItsEpochStopsTheWrite() public {
        hub.breakEpoch(true);
        vm.expectRevert(JournalHub.EpochUnreadable.selector);
        journal.inscribe(address(hub), 1, NOTE, "when?", bytes32(0));
        assertEq(journal.countOf(address(hub), 1), 0, "a memory was recorded with an unread epoch");
        hub.breakEpoch(false);
        journal.inscribe(address(hub), 1, NOTE, "now", bytes32(0));
        assertEq(journal.rootOf(address(hub), 1), fold(bytes32(0), 1, NOTE, "now", bytes32(0), holder, 1),
            "the mended hub's epoch was not read");
    }

    /*═══════════════ who writes, anywhere else ═══════════════*/

    /// @dev Any ERC-721: its holder alone, under epoch 0 when it keeps none —
    ///      even where the hub's token with the same id is at epoch 1.
    function test_aForeignHolderWritesIntoItsOwnNamespace() public {
        assertTrue(journal.mayInscribe(address(art), 1, holder), "a foreign token's holder may not write");
        assertFalse(journal.mayInscribe(address(art), 1, other), "a foreign token's non-holder may write");
        assertEq(journal.inscribe(address(art), 1, GIFT, "from a friend", REF), 1, "the foreign memory is not number one");
        assertEq(journal.rootOf(address(art), 1), fold(bytes32(0), 1, GIFT, "from a friend", REF, holder, 0),
            "a collection that keeps no epoch did not fold epoch 0, or borrowed the hub's");
        assertEq(journal.countOf(address(hub), 1), 0, "the hub's token 1 moved with the foreign token 1");
        assertEq(journal.rootOf(address(hub), 1), bytes32(0), "the hub's root moved with the foreign token 1");
        assertEq(refusal(other, address(art), 1, NOTE, "not mine", bytes32(0)), notYours(),
            "a foreign token's non-holder was not refused as NotYours");
        assertEq(write(other, address(art), 2, NOTE, "mine", bytes32(0)), 1, "the holder of foreign token 2 could not write into it");
    }

    /// @dev The hub's Reach is canonical by CREATE2 and codehash; another
    ///      collection's `account(id)` is a word, and the Journal never asks.
    function test_aForeignCollectionsAccountIsNotAsked() public {
        foreign.setAccount(nobody);
        assertEq(foreign.account(1), nobody, "the fixture does not name its account");
        assertFalse(journal.mayInscribe(address(foreign), 1, nobody), "a foreign collection's account was believed");
        assertEq(refusal(nobody, address(foreign), 1, NOTE, "I am its account", bytes32(0)), notYours(),
            "a foreign collection's account was not refused as NotYours");
        assertTrue(journal.mayInscribe(address(foreign), 1, holder), "its holder may not write");
        assertEq(journal.inscribe(address(foreign), 1, NOTE, "its holder", bytes32(0)), 1, "its holder could not write");
    }

    function test_aCodelessCollectionTakesNoMemory() public {
        address eoa = address(0xC0DE1E55);
        assertEq(eoa.code.length, 0, "the fixture address has code");
        assertFalse(journal.mayInscribe(eoa, 1, holder), "a codeless collection has a holder");
        assertFalse(journal.mayInscribe(address(0), 1, holder), "the zero collection has a holder");
        assertEq(refusal(holder, eoa, 1, NOTE, "into nothing", bytes32(0)), notYours(),
            "a write into a codeless collection was not refused as NotYours");
        assertEq(refusal(holder, address(0), 0, NOTE, "into nothing", bytes32(0)), notYours(),
            "a write into the zero collection was not refused as NotYours");
        assertEq(journal.countOf(eoa, 1), 0, "a codeless collection took a memory");
    }

    function test_aRevertingCollectionTakesNoMemory() public {
        foreign.setOwnerMode(foreign.REVERTS());
        assertFalse(journal.mayInscribe(address(foreign), 1, holder), "a reverting ownerOf names a holder");
        assertEq(refusal(holder, address(foreign), 1, NOTE, "into a wall", bytes32(0)), notYours(),
            "a write into a reverting collection was not refused as NotYours");
    }

    function test_aCollectionThatAnswersShortTakesNoMemory() public {
        foreign.setOwnerMode(foreign.SHORT());
        assertFalse(journal.mayInscribe(address(foreign), 1, holder), "thirty-one bytes named a holder");
        assertEq(refusal(holder, address(foreign), 1, NOTE, "half an answer", bytes32(0)), notYours(),
            "a write into a short-answering collection was not refused as NotYours");
        foreign.setOwnerMode(foreign.SILENT());
        assertFalse(journal.mayInscribe(address(foreign), 1, holder), "an empty answer named a holder");
        assertEq(refusal(holder, address(foreign), 1, NOTE, "no answer", bytes32(0)), notYours(),
            "a write into a silent collection was not refused as NotYours");
        assertEq(journal.countOf(address(foreign), 1), 0, "a collection that names nobody took a memory");
    }

    /// @dev A word wider than an address names nobody. Rights' decoder
    ///      refuses it by reverting, so the write is refused and `mayInscribe`
    ///      never answers true (docs/v2/W2-journal.md asks Rights to answer
    ///      false instead).
    function test_aCollectionThatAnswersWideNamesNobody() public {
        foreign.setOwnerMode(foreign.WIDE());
        (bool ok,) = address(journal).call(
            abi.encodeCall(IJournal.inscribe, (address(foreign), 1, NOTE, bytes("a wide answer"), bytes32(0))));
        assertFalse(ok, "a wide ownerOf word let the holder write");
        (bool asked, bytes memory said) = address(journal).staticcall(
            abi.encodeCall(IJournal.mayInscribe, (address(foreign), 1, holder)));
        assertTrue(!asked || !abi.decode(said, (bool)), "mayInscribe answered true for a wide ownerOf word");
        assertEq(journal.countOf(address(foreign), 1), 0, "a wide answer took a memory");
    }

    /// @dev "Everyone holds token 1." Believed — about the liar's own pages,
    ///      and no others: the hub's token 1 and another collection's token
    ///      1 keep their counts and roots through every lie.
    function test_aLyingCollectionMovesOnlyItsOwnNamespace() public {
        journal.inscribe(address(hub), 1, NOTE, "the hub's token 1", bytes32(0));
        journal.inscribe(address(art), 1, NOTE, "the art's token 1", bytes32(0));
        bytes32 hubRoot = journal.rootOf(address(hub), 1);
        bytes32 artRoot = journal.rootOf(address(art), 1);

        JournalLiar liar = new JournalLiar();
        vm.prank(nobody);
        liar.claim(1);
        assertEq(liar.ownerOf(1), nobody, "the liar did not lie");
        assertEq(write(nobody, address(liar), 1, NOTE, "I hold everything", bytes32(0)), 1, "the liar's page did not take the lie");
        assertEq(write(nobody, address(liar), 1, TRADE, "and I sold it to myself", REF), 2, "the liar's page did not count");
        assertEq(journal.rootOf(address(liar), 1),
            fold(fold(bytes32(0), 1, NOTE, "I hold everything", bytes32(0), nobody, 7), 2, TRADE, "and I sold it to myself", REF, nobody, 7),
            "the liar's page is not folded from its own answers");

        assertEq(journal.countOf(address(hub), 1), 1, "a lying collection moved the hub's count");
        assertEq(journal.rootOf(address(hub), 1), hubRoot, "a lying collection moved the hub's root");
        assertEq(journal.countOf(address(art), 1), 1, "a lying collection moved another collection's count");
        assertEq(journal.rootOf(address(art), 1), artRoot, "a lying collection moved another collection's root");
        assertFalse(journal.mayInscribe(address(hub), 1, nobody), "the liar's word carried over to the hub");
    }

    /*═══════════════ kinds and bounds ═══════════════*/

    function test_everyKindFromNoteToSealedIsAccepted() public {
        for (uint8 k = NOTE; k <= SEALED; ++k) {
            assertEq(journal.inscribe(address(hub), 1, k, "a memory of every kind", bytes32(0)), uint256(k) + 1,
                "a kind from NOTE to SEALED was refused or miscounted");
        }
        assertEq(journal.countOf(address(hub), 1), 5, "five kinds did not make five memories");
    }

    function test_aKindAboveSealedIsRefusedByName() public {
        assertEq(refusal(holder, address(hub), 1, 5, "one past SEALED", bytes32(0)),
            abi.encodeWithSelector(IJournalEvents.UnknownKind.selector, uint8(5)), "kind 5 was not refused as UnknownKind(5)");
        assertEq(refusal(holder, address(hub), 1, 255, "the last uint8", bytes32(0)),
            abi.encodeWithSelector(IJournalEvents.UnknownKind.selector, uint8(255)), "kind 255 was not refused as UnknownKind(255)");
        assertEq(journal.countOf(address(hub), 1), 0, "an unknown kind was counted");
    }

    function test_anEmptyBodyIsRefused() public {
        assertEq(refusal(holder, address(hub), 1, NOTE, "", bytes32(0)), abi.encodeWithSelector(IJournalEvents.Empty.selector),
            "an empty plain body was not refused as Empty");
        assertEq(refusal(holder, address(hub), 1, SEALED, "", bytes32(0)), abi.encodeWithSelector(IJournalEvents.Empty.selector),
            "an empty sealed body was not refused as Empty");
        assertEq(journal.inscribe(address(hub), 1, NOTE, "x", bytes32(0)), 1, "a one-byte body was refused");
    }

    function test_aPlainBodyMayBe1024BytesAndNotOneMore() public {
        bytes memory edge = filled(1024);
        bytes memory over = filled(1025);
        for (uint8 k = NOTE; k < SEALED; ++k) {
            assertEq(journal.inscribe(address(hub), 1, k, edge, bytes32(0)), uint256(k) + 1, "a 1,024-byte plain body was refused");
            assertEq(refusal(holder, address(hub), 1, k, over, bytes32(0)), tooLong(1025, 1024),
                "a 1,025-byte plain body was not refused as TooLong(1025, 1024)");
        }
    }

    function test_aSealedBodyMayBe4096BytesAndNotOneMore() public {
        assertEq(journal.inscribe(address(hub), 1, SEALED, filled(4096), bytes32(0)), 1, "a 4,096-byte sealed body was refused");
        assertEq(refusal(holder, address(hub), 1, SEALED, filled(4097), bytes32(0)), tooLong(4097, 4096),
            "a 4,097-byte sealed body was not refused as TooLong(4097, 4096)");
    }

    function test_aSealedBodyMayBeLongerThanAPlainOne() public {
        bytes memory b = filled(1025);
        assertEq(journal.inscribe(address(hub), 1, SEALED, b, bytes32(0)), 1, "a 1,025-byte sealed body was refused");
        assertEq(refusal(holder, address(hub), 1, NOTE, b, bytes32(0)), tooLong(1025, 1024),
            "the same 1,025 bytes as a plain body were not refused");
    }

    /// @dev The order is the interface's: the hand, then the kind, then the
    ///      body's emptiness, then its length.
    function test_theRefusalsComeInTheirOrder() public {
        assertEq(refusal(nobody, address(hub), 1, 9, "", bytes32(0)), notYours(), "a stranger was told more than NotYours");
        assertEq(refusal(holder, address(hub), 1, 9, "", bytes32(0)),
            abi.encodeWithSelector(IJournalEvents.UnknownKind.selector, uint8(9)), "the kind was not judged before the body");
        assertEq(refusal(holder, address(hub), 1, NOTE, "", bytes32(0)), abi.encodeWithSelector(IJournalEvents.Empty.selector),
            "emptiness was not judged before length");
        assertEq(refusal(holder, address(hub), 1, NOTE, filled(5000), bytes32(0)), tooLong(5000, 1024),
            "a long plain body was not refused with its own length and the plain bound");
    }

    /*═══════════════ the count and the root ═══════════════*/

    function test_theCountRisesByExactlyOnePerMemory() public {
        for (uint256 i = 1; i <= 5; ++i) {
            assertEq(journal.inscribe(address(hub), 1, NOTE, "one more", bytes32(i)), i, "inscribe did not return the next number");
            assertEq(journal.countOf(address(hub), 1), i, "the count did not rise by exactly one");
        }
        assertEq(journal.countOf(address(hub), 2), 0, "another token's count moved");
        assertEq(write(other, address(hub), 2, NOTE, "token 2's first", bytes32(0)), 1, "another token's numbering is not its own");
    }

    /// @dev Every field non-trivial: a second and third memory (n), three
    ///      kinds none of them 0, three bodies, three refs, two authors (the
    ///      buyer and the token's Reach), epoch 2. A formula that drops or
    ///      swaps any field answers differently from this side's.
    function test_theRootRollsByTheFormulaFieldByField() public {
        hub.transferFrom(holder, other, 1);                       // epoch 2, held by `other`
        address reach = hub.account(1);
        bytes memory b1 = "first, by the buyer";
        bytes memory b2 = "second, by the token itself";
        bytes memory b3 = filled(2000);

        assertEq(write(other, address(hub), 1, TRADE, b1, REF), 1, "the first memory is not number one");
        bytes32 r = fold(bytes32(0), 1, TRADE, b1, REF, other, 2);
        assertEq(journal.rootOf(address(hub), 1), r, "the first root is not the formula");

        assertEq(viaReach(other, 1, address(hub), 1, MILESTONE, b2, keccak256("ref 2")), 2, "the second memory is not number two");
        r = fold(r, 2, MILESTONE, b2, keccak256("ref 2"), reach, 2);
        assertEq(journal.rootOf(address(hub), 1), r, "the second root is not the formula over the first");

        assertEq(write(other, address(hub), 1, SEALED, b3, keccak256("ref 3")), 3, "the third memory is not number three");
        r = fold(r, 3, SEALED, b3, keccak256("ref 3"), other, 2);
        assertEq(journal.rootOf(address(hub), 1), r, "the third root is not the formula over the second");
    }

    /// @dev Pages that differ in exactly one field have different roots, and
    ///      pages with the same memories have the same root: the root commits
    ///      to the memories, not to the page they are written in (the hub's
    ///      fingerprint binds the id).
    function test_eachFieldOfAMemoryMovesTheRoot() public {
        for (uint256 id = 10; id <= 14; ++id) art.mint(holder, id);
        art.mint(other, 15);
        bytes32 REF2 = keccak256("another ref");

        journal.inscribe(address(art), 10, NOTE, "same", REF);
        bytes32 base = journal.rootOf(address(art), 10);
        journal.inscribe(address(art), 11, NOTE, "same", REF);
        assertEq(journal.rootOf(address(art), 11), base, "two pages with the same memory have different roots");

        journal.inscribe(address(art), 12, GIFT, "same", REF);
        assertTrue(journal.rootOf(address(art), 12) != base, "the kind does not move the root");
        journal.inscribe(address(art), 13, NOTE, "Same", REF);
        assertTrue(journal.rootOf(address(art), 13) != base, "the body does not move the root");
        journal.inscribe(address(art), 14, NOTE, "same", REF2);
        assertTrue(journal.rootOf(address(art), 14) != base, "the ref does not move the root");
        write(other, address(art), 15, NOTE, "same", REF);
        assertTrue(journal.rootOf(address(art), 15) != base, "the author does not move the root");

        foreign.setEpoch(foreign.HONEST(), 0);
        journal.inscribe(address(foreign), 1, NOTE, "same", REF);
        assertEq(journal.rootOf(address(foreign), 1), base, "epoch 0 read from a collection is not the epoch a collection without one folds");
        foreign.setEpoch(foreign.HONEST(), 5);
        journal.inscribe(address(foreign), 2, NOTE, "same", REF);
        assertTrue(journal.rootOf(address(foreign), 2) != base, "the epoch does not move the root");

        journal.inscribe(address(art), 10, NOTE, "same", REF);
        assertEq(journal.rootOf(address(art), 10), fold(base, 2, NOTE, "same", REF, holder, 0), "the second memory is not the formula");
        assertTrue(journal.rootOf(address(art), 10) != fold(base, 1, NOTE, "same", REF, holder, 0), "the number does not move the root");
    }

    function test_aRefusedWriteMovesNeitherTheCountNorTheRoot() public {
        journal.inscribe(address(hub), 1, NOTE, "the only memory", bytes32(0));
        bytes32 root = journal.rootOf(address(hub), 1);
        refusal(nobody, address(hub), 1, NOTE, "not yours", bytes32(0));
        refusal(holder, address(hub), 1, 7, "no such kind", bytes32(0));
        refusal(holder, address(hub), 1, NOTE, "", bytes32(0));
        refusal(holder, address(hub), 1, NOTE, filled(1025), bytes32(0));
        assertEq(journal.countOf(address(hub), 1), 1, "a refused write moved the count");
        assertEq(journal.rootOf(address(hub), 1), root, "a refused write moved the root");
    }

    /*═══════════════ a foreign collection's epoch ═══════════════*/

    function test_aForeignEpochIsReadWhereTheCollectionAnswersIt() public {
        foreign.setEpoch(foreign.HONEST(), 7);
        journal.inscribe(address(foreign), 1, NOTE, "at seven", bytes32(0));
        assertEq(journal.rootOf(address(foreign), 1), fold(bytes32(0), 1, NOTE, "at seven", bytes32(0), holder, 7),
            "a foreign collection's epoch 7 was not folded");
        foreign.setEpoch(foreign.HONEST(), type(uint64).max);
        journal.inscribe(address(foreign), 2, NOTE, "at the top", bytes32(0));
        assertEq(journal.rootOf(address(foreign), 2), fold(bytes32(0), 1, NOTE, "at the top", bytes32(0), holder, type(uint64).max),
            "the widest epoch a uint64 holds was not folded as itself");
    }

    /// @dev A revert, a short answer, an empty one, a word with high bits and
    ///      a word one past uint64 all mean "keeps no epoch": 0.
    function test_aForeignEpochThatCannotBeReadIsZero() public {
        uint8[5] memory modes = [foreign.REVERTS(), foreign.SHORT(), foreign.SILENT(), foreign.WIDE(), foreign.HONEST()];
        for (uint256 i; i < 5; ++i) {
            foreign.setEpoch(modes[i], i == 4 ? uint256(type(uint64).max) + 1 : 7);
            journal.inscribe(address(foreign), i + 1, NOTE, "when?", bytes32(0));
            assertEq(journal.rootOf(address(foreign), i + 1), fold(bytes32(0), 1, NOTE, "when?", bytes32(0), holder, 0),
                "an epoch that cannot be read was not folded as 0");
        }
    }

    /*═══════════════ the lock ═══════════════*/

    /// @dev JournalReentrant's `ownerOf(1)` calls `inscribe` for id 2 and
    ///      names this contract only if that call was refused with
    ///      `Reentrancy()`. Outside a write nothing holds the lock, the inner
    ///      call dies on its first store in the static frame, and it names
    ///      nobody; inside one it meets the lock by name.
    function test_aCollectionThatReentersInscribeMeetsTheLock() public {
        JournalReentrant r = new JournalReentrant(IJournal(address(journal)));
        r.setWriter(holder);
        assertFalse(journal.mayInscribe(address(r), 1, holder), "outside a write the inner call was refused by name");
        assertEq(journal.inscribe(address(r), 1, NOTE, "the lock answered by name", bytes32(0)), 1,
            "a re-entrant inscribe did not meet Reentrancy()");
        assertEq(journal.countOf(address(r), 2), 0, "the inner write landed");
    }

    function test_theLockIsReleasedBetweenTwoMemoriesInOneTransaction() public {
        assertEq(journal.inscribe(address(hub), 1, NOTE, "one", bytes32(0)), 1, "the first memory of the transaction was refused");
        assertEq(journal.inscribe(address(art), 1, NOTE, "two", bytes32(0)), 1, "the lock was still held for the second memory");
        assertEq(viaReach(holder, 1, address(hub), 1, NOTE, "three", bytes32(0)), 2, "the lock was still held for the third");
    }

    /*═══════════════ the question a page asks ═══════════════*/

    function test_mayInscribeAnswersFalseWithoutRevertingForAnyoneWithNoPen() public {
        assertFalse(journal.mayInscribe(address(hub), 1, address(0)), "the zero address may write into the hub");
        assertFalse(journal.mayInscribe(address(art), 1, address(0)), "the zero address may write into a collection");
        assertEq(art.ownerOf(99), address(0), "the fixture names a holder for an unminted token");
        assertFalse(journal.mayInscribe(address(art), 99, address(0)),
            "the zero address may write where a collection answers ownerOf with the zero address");
        assertFalse(journal.mayInscribe(address(hub), 4096, holder), "an unminted hub token has a pen");
        assertFalse(journal.mayInscribe(address(0xBEEF), 1, holder), "a codeless collection has a pen");
        assertFalse(journal.mayInscribe(address(journal), 1, holder), "the Journal itself answered as a collection");
        foreign.setOwnerMode(foreign.REVERTS());
        assertFalse(journal.mayInscribe(address(foreign), 1, holder), "a reverting collection has a pen");
        assertTrue(journal.mayInscribe(address(hub), 1, holder) && journal.mayInscribe(address(art), 1, holder),
            "a holder lost the pen");
    }

    /*═══════════════ any memory ═══════════════*/

    /// @dev Accepted exactly when the kind is NOTE..SEALED and the body is
    ///      1..its kind's bound; folded by the formula when accepted, refused
    ///      by name and moving nothing when not.
    function testFuzz_aMemoryIsAcceptedExactlyWithinItsKindsBound(uint8 kind, bytes memory b, bytes32 ref) public {
        kind = uint8(bound(kind, 0, 6));
        uint256 max = kind == SEALED ? 4096 : 1024;
        bool fits = kind <= SEALED && b.length != 0 && b.length <= max;
        (bool ok, bytes memory ret) = address(journal).call(abi.encodeCall(IJournal.inscribe, (address(hub), 1, kind, b, ref)));
        if (fits) {
            assertTrue(ok, "a memory within its kind's bound was refused");
            assertEq(abi.decode(ret, (uint256)), 1, "an accepted memory is not number one");
            assertEq(journal.rootOf(address(hub), 1), fold(bytes32(0), 1, kind, b, ref, holder, 1), "an accepted memory is not the formula");
        } else {
            assertFalse(ok, "a memory outside its kind's bound was accepted");
            bytes memory want = kind > SEALED ? abi.encodeWithSelector(IJournalEvents.UnknownKind.selector, kind)
                : b.length == 0 ? abi.encodeWithSelector(IJournalEvents.Empty.selector)
                : tooLong(b.length, max);
            assertEq(ret, want, "a refused memory was not refused by its own name");
            assertEq(journal.countOf(address(hub), 1), 0, "a refused memory was counted");
        }
    }
}
