# W5 — Agora, the social layer (V2 wave 1)

Unit W5 of INTACT V2's wave 1 (docs/V2.md §3.5, §5). Branch
`worktree-agent-a7eb36ca937bc00c1`, built on `b676ee0` ("V2 wave 0 freezes
eight interfaces…"). This file is the unit's report: what was built, every
decision and its reason, the Parley-to-Agora test map, the measured
numbers, the mutation evidence, the INVARIANTS rows proposed, the requests
for frozen files, and what later waves need to know.

## What was built

| File | What it is |
|---|---|
| `src/Agora.sol` | `Agora is IAgora`: Parley generalized from "a hub token" to a persona (`collection << 96 \| id`, lib/Persona). Rooms, rules and archive are Parley's; added are the registered-only commons, a room per collection, tipped reactions, a follow graph, and stamp-keyed delegated things. No admin, no stored value. |
| `test/Agora.t.sol` | `AgoraTest`: a counterpart for each of Parley's 41 tests but one (Roster's listing), and the guarantees Agora adds — 79 tests. |
| `test/mocks/AgoraFixtures.sol` | `AgoraStudio` (`isCollection`), `AgoraRevertingStudio`, `AgoraMumblingStudio` (answers 2), `AgoraCollection` (an ERC-721 that reports a custody epoch: a Studio collection as Agora sees it), `AgoraRefusingHolder`, `AgoraReentrantHolder`. The hub is `test/mocks/SocialHub.sol` (it has `feeSink`), the foreign collection `test/mocks/MockERC721.sol`, the keys the real `src/KeyRegistry.sol`. |
| `tools/verify-agora.mjs` | The real site (`deploySite`: the diamond hub, real Reach accounts, the real KeyRegistry) with Agora and a Studio stand-in beside it; a second reader that walks the archive one block at a time; every refusal by name, and those with arguments exactly (`Chain.simulate`); gas, measured — 53 sentences. |

## Decisions, each with its reason

1. **Identity is Persona's and is spelled nowhere else.** `persona`/`split`
   are `Persona.pack`/`split`; `mayActAs` is `Persona.actsFor(HUB, p, who)`
   (the hub's `acts` for a hub token — holder or its Reach — and `holds`
   for any other); a tip's payee is `Persona.payeeOf(HUB, author)`; every
   delegated thing is keyed by `Persona.stampOf`. *Reason:* the library
   exists so that no V2 contract spells these questions differently.

2. **The commons is registered-only.** `isRegistered(c)` is `c == HUB`, or
   the Studio's `isCollection(c)` read with EXTCODESIZE and a low-level
   staticcall: an absent Studio, a reverting one, a short answer or a word
   other than exactly 1 registers nothing, and then the hub alone speaks —
   V1's commons. *Reason:* the commons is the one room every page shows,
   and a collection anyone can deploy in a minute is a collection whose
   holders could flood it in the next; and CLAUDE.md's trap — a typed call
   to a codeless address reverts before the call is made.

3. **A collection room is opened by its first word.** `collectionKey(c)`
   needs no founding: the first word of one of `c`'s personas opens it
   (`kind = IS_COLLECTION = 4`, `index = c`). From then on an outsider is
   refused `NotOfCollection(persona, c)`; before then it is told
   `NoSuchRoom`, because a key cannot be inverted and nothing can yet say
   which collection it names (as for anybody's unopened home). *Reason:*
   IAgora has no opening call, and a Collection computes its `room()`
   without one.

4. **A collection room brakes as the commons does: two blocks.** No steward
   exists to set a cooldown there, and a room with no brake at all is the
   one room a holder could flood every transaction.

5. **Delegated things are keyed by (persona, stamp).** The cooldown bucket
   is `keccak(persona, stampOf(persona))`: the stamp alone is (holder,
   epoch), which two tokens of one holder share — two hub tokens of one
   holder are both at epoch 1, two Apes of one holder both at 0 — so the
   persona is in the bucket, as the token was in Parley's. A seat and an
   invitation record the stamp they were taken or given under, and "in the
   room" means "the seat's stamp is the live stamp", so a sale empties
   every seat and voids every invitation of the seller without a write.
   The key binding stores the stamp, so `keyOf` answers zero the moment
   the stamp moves. *Reason:* the unit's brief, and Parley's (token, epoch)
   bucket in persona form.

6. **What belongs to the token passes to the buyer.** Stewardship of a
   group or a home is the persona's, so a buyer stewards what its token
   founded; and a steward speaks in its own room by right. Without that a
   buyer would be locked out of the group it governs: its founder's seat
   is stale after the sale, and `join` refuses the steward (Parley's
   rule). `prevFrom` is keyed by the persona, so "everything this token
   has said" is one walk across all its holders. Follows are the
   persona's, by design.

7. **`members` counts seats, in 32 bits.** Parley's 16 bits were bounded by
   an edition of 4,096; an open group of personas has no edition. A seat a
   sale left behind stays counted until the persona's new holder takes it
   again (which re-records the stamp and counts nothing twice) or the
   steward clears it — `evict` accepts a stale seat, which nobody else
   can clear. No write happens at a sale, so no exact live count can exist
   without one. To keep the first slot at 32 bytes `opened` is stored in
   48 bits: it is written once, read only by `stateOf`, and 2^48 blocks is
   two million years of quarter-second blocks.

8. **A reaction is open to any persona, in any room with the message in
   it.** The rules are the decided ones: `mayActAs(from)`; a glyph of one
   to four bytes of well-formed UTF-8, left-aligned (RFC 3629: no overlong
   form, no surrogate, nothing above U+10FFFF; a zero byte ends the glyph
   and every byte after it must be zero, so no "A\0B" gap carries a byte
   no page shows); `1 ≤ seq ≤ count`. *Reason:* a reaction says four bytes
   about one message and may carry money to its author, and whom a holder
   may pay is not a room's to decide. A page can show a closed room's
   reactions from its members only (`inRoom`).

9. **The tip is the last act, under the lock, with no return data copied.**
   A reaction writes no storage: `Reacted` is emitted, then `msg.value` is
   pushed to the payee with an assembly `call` that copies nothing back (a
   payee that returns a megabyte costs the call nothing), inside
   `AGORA_LOCK`, so a payee that calls back finds speech, whispers and
   reactions shut and nothing of the call to corrupt (the lock covers what
   Parley's did — the paths that speak — and now the one that pays).
   `NoPayee(author)` is raised only when there is a tip; a zero tip asks
   nothing of the payee. Agora holds nothing before or after.

10. **Follows are idempotent and say nothing when nothing changed.**
    Following twice is one edge and one event; undoing a follow that is
    not there is no event, no revert and no underflow. A *new* follow needs
    a persona somebody holds (`NotAPersona`): a raw hub id passed where a
    persona was meant names collection zero, and would otherwise be kept
    as junk in two counters. Undoing a follow never needs one. This is the
    one rule beyond the brief — Parley's "nothing to follow before the
    first word", in persona form.

11. **A sealed whisper needs both live keys.** The envelope carries a copy
    for each side; a sender with no bound key could seal only to the
    recipient and never read its own words back. The recipient's key is
    pinned by `expectedKeyId` (`KeyMoved`), as in Parley; a plain whisper
    asks about no key.

12. **A persona nobody holds is refused by Persona's own error.** IAgora
    froze no `NoSuchToken` and no `NotHolder`. A whisper, an invitation or
    a new follow to a persona nobody holds is refused with
    `NotAPersona(collection, id)` — already in Agora's ABI through
    `persona()`, and a token nobody holds is not "one token of one
    ERC-721". `bindKey` by anyone but the holder is `NotYours`.

13. **Kept from Parley beyond IAgora:** `evict`, `heads`, `topics` (seven
    words: Parley's five first in Parley's order, so a reader written for
    Parley reads them the same, then `Reacted` and `Followed`), `roomsOf`
    and `roomCount`. Each carries a guarantee Parley's suite asserts
    (request 1 asks for them in IAgora, additively).

14. **Dropped, as IAgora drops them:** Postage — `whisperStamped`, the
    inbox rule (`_admit`) and `PostageDue` — so every whisper is admitted
    and free; and Roster, whose 256-wide windows read one band of small
    ids, which personas are not.

15. **No admin, no owner, no setter.** The three addresses are immutables;
    the only value that moves is a tip, in the call that carries it.

## Parley's tests and their Agora counterparts

Every Parley test (test/Parley.t.sol, 41) and the Agora test that carries
its guarantee over (test/Agora.t.sol).

| Parley | Agora | What changed |
|---|---|---|
| `test_theMutualImmutablesArePredictedAndAgree` | `test_theConstructorNamesTheHubTheKeysAndTheStudio` | no Postage; the pins are HUB, KEYS, STUDIO |
| `test_onlyTheHolderSpeaksAsTheirToken` | `test_onlyTheHolderSpeaksAsTheirPersona` | personas |
| `test_theBoundAccountMaySpeakAndTheRenterMayNot` | `test_theReachMaySpeakForAHubPersonaAndTheRenterMayNot` | |
| `test_aRenterCannotSpeak` | `test_aRenterCannotSpeak` | also `react`, `follow`, `bindKey` |
| `test_aTokenThatDoesNotExistHasNoVoice` | `test_aPersonaNobodyHoldsHasNoVoice` | also a collection with no code |
| `test_theRoomRemembersWhereItsNewestMessageIs` | same name | |
| `test_everyRoomKeepsItsOwnHead` | same name | |
| `test_aTokenRemembersWhereItLastSpokeWhoeverElseHasSpoken` | `test_aPersonaRemembersWhereItLastSpokeWhoeverElseHasSpoken` | |
| `test_headsAnswersForEveryRoomAtOnce` | same name | |
| `test_theRingShiftsOnANewBlockAndNotWithinOne` | same name | |
| `test_theCommonsRefusesTwoWordsInsideTwoBlocks` | same name | the exact `Cooldown(until)` asserted |
| `test_aBuyerIsNotRateLimitedByTheSeller` | same name | plus `test_aForeignBuyerIsNotRateLimitedByTheSellerEither`, `test_twoPersonasOfOneHolderKeepTwoBrakes` |
| `test_aStewardSetsACooldownUpToSevenDays` | same name | seven days exactly is allowed |
| `test_aGroupKeyIsNeverAPairKeyNorAHomeKey` | `test_noTwoKindsOfRoomShareAKey` | collection keys and every formula |
| `test_aPairIsTheSameRoomFromBothSides` | same name | |
| `test_aRawPairKeyThroughSpeakReverts` | same name | |
| `test_anUnfoundedRoomIsNotARoom` | same name | `opened == 0` where Parley asked Roster's `NO_ROOM` |
| `test_aGroupIsClosedUntilItIsOpened` | same name | |
| `test_anOpenDoorNeedsNoInvitation` | same name | |
| `test_nobodyCanLengthenSomebodyElsesRoomList` | same name | |
| `test_leavingIsRememberedWithoutErasingTheRoom` | same name | |
| `test_rejoiningDoesNotDuplicateTheEntry` | same name | plus `test_aSeatedPersonaCannotTakeItsSeatTwice` |
| `test_onlyTheStewardInvitesAndEvicts` | same name | no invitation to a persona nobody holds |
| `test_evictionCannotUnsayAnything` | same name | |
| `test_hideIsABitNotADeletion` | same name | hides seq 300 too: Parley's survivor P11 (INVARIANTS E1) has its test here |
| `test_followIsJoinOfTheHomeRoom` | `test_aHomeRoomOpensWithItsStewardsFirstWord` | following is its own graph now (five `follow` tests below); a seat in a home is a seat |
| `test_aHomeRoomAlsoOpensWithAnInvitationOrACooldown` | same name | |
| `test_stewardedByListsFoundedGroupsOnly` | — | Roster's listing; Roster is not carried. `test_groupsAreNumberedFromOneAndKeyedByTheirNumber` keeps the numbering |
| `test_aWhisperNeedsSomebodyToWhisperTo` | same name | `NotAPersona(collection, id)` where Parley said `NoSuchToken` |
| `test_bothSidesLandInTheSameRoom` | same name | |
| `test_aBodyHasBothEnds` | same name | |
| `test_aSealedBodyMayBeFourTimesLonger` | same name | both sides bind keys |
| `test_aKindThisContractDoesNotKnowIsRefused` | same name | |
| `test_aRoomNeedsAName` | same name | 48 bytes exactly is allowed |
| `test_aReplyPointerIsWalkable` | same name | |
| `test_onlyTheHolderBindsItsOwnKey` | same name | `NotYours` where Parley said `NotHolder` |
| `test_theRegistryRefusesAnEmptyOrUntypedKey` | same name | |
| `test_aSoldTokenHasNoKey` | `test_aSoldPersonaHasNoKey` | the buyer's key, published before it buys, is not served under the seller's binding |
| `test_aRotatedKeyRefusesTheWhisper` | same name | |
| `test_aSealedWhisperToATokenWithoutABindingIsRefused` | `test_aSealedWhisperToAPersonaWithoutABindingIsRefused` | |
| `test_theTopicsAreDerivedFromTheSignaturesThemselves` | same name | seven topics |

Agora's own (39): personas — `test_aPersonaIsItsCollectionAndItsIdInOneWord`,
`test_anIdPastNinetySixBitsOrTheZeroCollectionIsNoPersona`,
`test_aForeignTokenIsActedForByItsHolderAlone`; the commons —
`test_theCommonsHearsOnlyRegisteredCollections`,
`test_aStudioThatIsAbsentOrRevertsRegistersOnlyTheHub`,
`test_registrationIsReadLiveFromTheStudio`; collection rooms —
`test_aCollectionRoomNeedsNoFounding`,
`test_onlyACollectionsOwnPersonasSpeakInItsRoom`,
`test_anOutsiderNamingAnUnopenedCollectionRoomIsToldThereIsNoSuchRoom`,
`test_aCollectionRoomBrakesLikeTheCommons`,
`test_aCollectionRoomHasNoStewardAndNoDoor`,
`test_theCollectionKeyIsTheFormulaACollectionComputesWithoutACall`,
`test_onePersonaSpeaksInEveryRoomItBelongsTo`; the brakes —
`test_aForeignBuyerIsNotRateLimitedByTheSellerEither`,
`test_twoPersonasOfOneHolderKeepTwoBrakes`; rooms —
`test_groupsAreNumberedFromOneAndKeyedByTheirNumber`,
`test_aSeatedPersonaCannotTakeItsSeatTwice`; a sale —
`test_aSaleEmptiesTheSellersSeatAndTheBuyerTakesItsOwn`,
`test_anInvitationIsToTheHolderAndDiesWithTheSale`,
`test_aBuyerStewardsTheGroupsAndTheHomeItsTokenFounded`,
`test_aStewardClearsTheSeatASaleLeftBehind`; keys —
`test_aForeignSaleKillsTheKeyBindingToo`,
`test_aCollectionWithoutAnEpochIsStampedByItsHolderAlone`,
`test_aSealedWhisperNeedsTheSendersKeyToo`; reactions —
`test_aReactionNamesAMessageTheRoomHasReached`,
`test_aGlyphIsOneToFourBytesOfUtf8LeftAligned`,
`test_aTipLandsInTheAuthorsFeeSinkAndNowhereElse`,
`test_aTipFollowsTheFeesIntoTheGrip`,
`test_aTipToAForeignAuthorLandsWithItsHolder`,
`test_aTippedReactionToAPersonaNobodyHoldsIsRefused`,
`test_aTipThePayeeRefusesIsRefused`,
`test_aReactionWithoutATipAsksNothingOfThePayee`,
`test_aPayeeCannotReenterWhileItIsBeingPaid`; follows —
`test_followingTwiceCountsOnce`,
`test_unfollowingWhatYouDoNotFollowChangesNothing`,
`test_aPersonaCannotFollowItself`,
`test_followsBelongToTheTokenAndSurviveItsSale`,
`test_aNewFollowNeedsAPersonaSomebodyHolds`,
`test_onlyAnActorFollowsAsAPersona`.

One property the suite records rather than hides:
`test_aCollectionWithoutAnEpochIsStampedByItsHolderAlone`. Persona's stamp
is (holder, custody epoch), and a collection that reports no epoch is
stamped by its holder alone, so on such a collection a buy-back by the
binder finds its key binding (and its brake, seats and invitations) where
it left them. On the hub and on every Studio collection, which report an
epoch, a buy-back revives nothing; the test shows both side by side.

## Measured (2026-10-19, each number from the run named)

| What | Measured | Run |
|---|---|---|
| Agora's runtime | **11,311 B**, 46 % of EIP-170's 24,576 (Parley 9,955 B, KeyRegistry 1,941 B) | `node tools/compile.mjs` in the worktree on the final source, 13:57: "all gated contracts fit under the EIP-170 ceiling of 24576 bytes", exit 0, compiled in 246.2 s (the same 11,311 B at 05:35, before the comment-only edit) |
| The suite | **79 passed, 0 failed** | `node tools/forge.mjs --match Agora` in the pruned copy (/tmp/v2-agora) on the final source, 13:52, after the mutation gate (the same at 05:26, before the comment-only edit) |
| The verifier | **53 passed, 0 failed** | `node tools/verify-agora.mjs` in the worktree on the final source, 14:03 (the same at 05:31 and 05:36) |
| The static audit | passed, 10 Solidity rules and 4 JS rules; its self-test fails on 5 findings and passes the clean file | `node tools/static-audit.mjs` (and `--selftest`) in the worktree |
| Parley, for comparison | 81 passed, 0 failed | `node tools/verify-parley.mjs` on this tree, 05:37, the same compiled input as the verifier's |

**Gas**, from the verifier's run on the final source at 14:03 (identical,
figure for figure, to its run at 05:36), against the real diamond hub.
Each write is one call in a fresh block, after the slots it touches are no
longer new (the steady-state cost a holder pays); each view is an
`eth_call`'s execution gas.

| Write | Gas |
|---|---|
| `speak`, a 100-byte body, commons | 77,394 |
| `speak`, a 1,024-byte body, commons | 99,408 |
| `react` with a 0.0001 ETH tip pushed to the author's Reach | 67,372 |
| `follow`, a new edge where all three words are fresh (the edge and both counters) | 108,433 |
| `follow`, a new edge where both counters already hold a number | 74,265 |
| `whisper`, plain, 100 bytes | 82,039 |
| `whisper`, sealed, 100 bytes (both keys read, the recipient's pinned) | 121,414 |

| View | Gas |
|---|---|
| `stateOf` | 13,275 |
| `keyOf` | 38,994 |
| `mayActAs` | 2,922 |
| `isRegistered` (a Studio collection) | 6,849 |
| `heads`, three rooms | 6,581 |

Parley's own steady-state words on the same hub, from verify-parley's run
above, measured `speak` 71,497 gas (a 19-byte body) and `whisper` 87,904
(22 bytes, including Postage's inbox read). Agora's `speak` pays one more
hub read for the stamp (`ownerOf` again beside `custodyEpoch`) and Persona's
guarded staticcalls; its plain `whisper` pays no Postage read.

## The mutation gate (measured)

Forty-five mutations of `src/Agora.sol`, each one token or one expression
aimed at one guard, applied one at a time to the pruned copy
(`/tmp/v2-agora`: `src/{Agora,KeyRegistry,Parley,Postage}.sol`,
`src/interfaces`, `src/lib`, `test/Agora.t.sol` and its three mocks), each
followed by `node tools/forge.mjs --match Agora` there and a restore of the
file. The driver is a scratch script, not a committed file (request 6 asks
for the rows in `tools/mutations.mjs`). **45 killed, 0 survived**, 7,505 s
of runs.

The gate ran in two sittings. Rows M1–M43 ran 05:36–07:36 against the
source as it stood before a comment-only edit; the first sitting was then
cut off during M44, which left that mutant (`COMMONS_BLOCKS = 1`) in the
pruned copy. It was found by comparing the pruned copy with the worktree
byte for byte, restored, and rows M44–M45 ran 13:44–13:49 against the final
text. The edit rewrote six comments and no code: Agora's runtime and
creation code compile byte-identical before and after it (11,311 B; the
pruned copy's compile caches of the two texts, compared). After the gate
the pruned copy's `src/Agora.sol` is byte-identical to the worktree's
(sha256 `025392f7…`), and the suite reads 79 passed, 0 failed on it
(13:52).

Every guard of the brief is a row: `mayActAs` (M1 the holder, M2 the Reach,
M1 the renter), the registered-only commons (M3, M4), collection-room
membership (M5), the cooldown keyed by stamp (M7, M8), the binding that
dies on sale (M9), the `BadBody` bounds (M17–M19), both keys and the key
pin (M20, M21), the tip to the payee and nobody else (M23, M24), `NoPayee`
(M25), `TipFailed` (M26), idempotent follows (M37, M38),
`TalkingToYourself` (M39, M40) and `BadReply` beyond the room's count (M29,
M30 for reactions, M32 for replies).

| Row | Guard | Mutation of `src/Agora.sol` | Killed by |
|---|---|---|---|
| M1 | mayActAs on every write: the holder speaks, nobody else (the inversion) | `if (!mayActAs(p, msg.sender)) revert NotYours();` → `if (mayActAs(p, msg.sender)) revert NotYours();` | `test_aRenterCannotSpeak`, `test_onlyTheHolderSpeaksAsTheirPersona`, `test_aPersonaNobodyHoldsHasNoVoice` and 65 more (68 of the suite fail) |
| M2 | mayActAs: the Reach acts for a hub persona (the hub's acts) | `return Persona.actsFor(HUB, persona_, who);` → `return Persona.actsFor(address(0), persona_, who);` | `test_onlyAnActorFollowsAsAPersona`, `test_theReachMaySpeakForAHubPersonaAndTheRenterMayNot` |
| M3 | the commons hears registered collections only | `if (!isRegistered(c)) revert Unregistered(c);` → `if (!isRegistered(HUB)) revert Unregistered(c);` | `test_aStudioThatIsAbsentOrRevertsRegistersOnlyTheHub`, `test_registrationIsReadLiveFromTheStudio`, `test_theCommonsHearsOnlyRegisteredCollections` |
| M4 | a Studio answer that is neither 0 nor 1 registers nothing | `abi.decode(ret, (uint256)) == 1` → `abi.decode(ret, (uint256)) != 0` | `test_aStudioThatIsAbsentOrRevertsRegistersOnlyTheHub` |
| M5 | a collection room hears its own collection's personas only | `if (room != collectionKey(c)) revert NotOfCollection` → `if (room == collectionKey(c)) revert NotOfCollection` | `test_aCollectionRoomBrakesLikeTheCommons`, `test_aForeignBuyerIsNotRateLimitedByTheSellerEither`, `test_onlyACollectionsOwnPersonasSpeakInItsRoom`, `test_twoPersonasOfOneHolderKeepTwoBrakes` |
| M6 | a collection room brakes in blocks, as the commons does | `room == COMMONS \|\| r.kind == IS_COLLECTION` → `room == COMMONS \|\| r.kind == IS_PAIR` | `test_aCollectionRoomBrakesLikeTheCommons`, `test_aRotatedKeyRefusesTheWhisper`, `test_aSealedBodyMayBeFourTimesLonger` |
| M7 | the cooldown bucket is keyed by the stamp: a buyer is not braked by the seller | `bytes32 bucket = _bucket(from, stamp);` → `bytes32 bucket = _bucket(from, bytes32(0));` | `test_aBuyerIsNotRateLimitedByTheSeller`, `test_aCollectionRoomBrakesLikeTheCommons`, `test_aForeignBuyerIsNotRateLimitedByTheSellerEither`, `test_aPersonaRemembersWhereItLastSpokeWhoeverElseHasSpoken` |
| M8 | the cooldown bucket is the persona's: two tokens of one holder keep two brakes | `return keccak256(abi.encode(p, stamp));` → `return keccak256(abi.encode(stamp, stamp));` | `test_twoPersonasOfOneHolderKeepTwoBrakes` |
| M9 | a key binding dies on sale (keyOf compares the stamp) | `if (b == bytes32(0) \|\| b != Persona.stampOf(persona_)) return (0, bytes32(0), "");` → `if (b == bytes32(0) && b != Persona.stampOf(persona_)) return (0, bytes32(0), "");` | `test_aCollectionWithoutAnEpochIsStampedByItsHolderAlone`, `test_aForeignSaleKillsTheKeyBindingToo`, `test_aSoldPersonaHasNoKey` |
| M10 | bindKey is holds only, never the Reach | `if (holder != msg.sender) revert NotYours();` → `if (!mayActAs(persona_, msg.sender)) revert NotYours();` | `test_onlyTheHolderBindsItsOwnKey` |
| M11 | a seat is the holder's: a sale empties it | `if (r.steward != from && _seat[room][from] != stamp) revert NotAMember();` → `if (r.steward != from && _seat[room][from] == bytes32(0)) revert NotAMember();` | `test_aSaleEmptiesTheSellersSeatAndTheBuyerTakesItsOwn` |
| M12 | an invitation is the holder's: a sale voids it | `if (!r.open && _invite[room][persona_] != stamp) revert NotInvited();` → `if (!r.open && _invite[room][persona_] == bytes32(0)) revert NotInvited();` | `test_anInvitationIsToTheHolderAndDiesWithTheSale` |
| M13 | a steward speaks in its own room by right (a buyer is not locked out) | `if (r.steward != from &&` → `if (r.steward != 0 &&` | `test_aBuyerStewardsTheGroupsAndTheHomeItsTokenFounded`, `test_aHomeRoomOpensWithItsStewardsFirstWord` |
| M14 | a seat is counted once, and taken again without counting twice | `if (_seat[room][p] == bytes32(0)) {` → `if (_seat[room][p] != bytes32(uint256(1))) {` | `test_aSaleEmptiesTheSellersSeatAndTheBuyerTakesItsOwn` |
| M15 | a seated persona cannot join again (AlreadyIn) | `if (_seat[room][persona_] == stamp \|\| r.steward == persona_) revert AlreadyIn();` → `if (r.steward == persona_) revert AlreadyIn();` | `test_aSeatedPersonaCannotTakeItsSeatTwice` |
| M16 | the steward clears a seat a sale left behind | `if (_seat[room][persona_] == bytes32(0)) revert NotAMember();` → `if (_seat[room][persona_] != Persona.stampOf(persona_)) revert NotAMember();` | `test_aStewardClearsTheSeatASaleLeftBehind` |
| M17 | BadBody: a body reaches its limit and not one byte more | `body.length > (kind == SEALED ? MAX_SEALED : MAX_BODY)` → `body.length >= (kind == SEALED ? MAX_SEALED : MAX_BODY)` | `test_aBodyHasBothEnds`, `test_aSealedBodyMayBeFourTimesLonger` |
| M18 | BadBody: 1,024 for plain, 4,096 only for sealed | `kind == SEALED ? MAX_SEALED : MAX_BODY` → `kind == SEALED ? MAX_SEALED : MAX_SEALED` | `test_aBodyHasBothEnds` |
| M19 | BadBody: an empty body is refused | `if (body.length == 0 \|\|` → `if (body.length == 1 \|\|` | `test_aBodyHasBothEnds`, `test_headsAnswersForEveryRoomAtOnce`, `test_theRingShiftsOnANewBlockAndNotWithinOne` |
| M20 | a sealed whisper needs both keys (NoKey) | `if (mine == bytes32(0) \|\| theirs == bytes32(0)) revert NoKey();` → `if (mine == bytes32(0) && theirs == bytes32(0)) revert NoKey();` | `test_aForeignSaleKillsTheKeyBindingToo`, `test_aRotatedKeyRefusesTheWhisper`, `test_aSealedWhisperNeedsTheSendersKeyToo`, `test_aSealedWhisperToAPersonaWithoutABindingIsRefused`, `test_aSoldPersonaHasNoKey` |
| M21 | a sealed whisper names the recipient's live key (KeyMoved) | `if (theirs != expectedKeyId) revert KeyMoved();` → `if (mine != expectedKeyId) revert KeyMoved();` | `test_aRotatedKeyRefusesTheWhisper`, `test_aSealedBodyMayBeFourTimesLonger`, `test_aSealedWhisperNeedsTheSendersKeyToo` |
| M22 | a whisper, an invitation or a new follow needs a persona somebody holds | `if (Persona.holderOf(p) == address(0)) {` → `if (Persona.holderOf(p) == address(1)) {` | `test_aNewFollowNeedsAPersonaSomebodyHolds`, `test_aWhisperNeedsSomebodyToWhisperTo`, `test_onlyTheStewardInvitesAndEvicts` |
| M23 | the tip goes to the author's payee (not the reactor's) | `address payee = Persona.payeeOf(HUB, author);` → `address payee = Persona.payeeOf(HUB, from);` | `test_aPayeeCannotReenterWhileItIsBeingPaid`, `test_aTipFollowsTheFeesIntoTheGrip`, `test_aTipLandsInTheAuthorsFeeSinkAndNowhereElse`, `test_aTipThePayeeRefusesIsRefused`, `test_aTipToAForeignAuthorLandsWithItsHolder`, `test_aTippedReactionToAPersonaNobodyHoldsIsRefused` |
| M24 | the tip is pushed to the payee and nobody else (not back to the caller) | `call(gas(), payee, callvalue(), 0, 0, 0, 0)` → `call(gas(), caller(), callvalue(), 0, 0, 0, 0)` | `test_aPayeeCannotReenterWhileItIsBeingPaid`, `test_aTipFollowsTheFeesIntoTheGrip`, `test_aTipLandsInTheAuthorsFeeSinkAndNowhereElse`, `test_aTipThePayeeRefusesIsRefused`, `test_aTipToAForeignAuthorLandsWithItsHolder` |
| M25 | NoPayee: a tip with nobody to pay is refused, never sent to address(0) | `if (payee == address(0)) revert NoPayee(author);` → `if (payee == address(1)) revert NoPayee(author);` | `test_aTippedReactionToAPersonaNobodyHoldsIsRefused` |
| M26 | TipFailed: a push the payee refuses fails the reaction | `if (!ok) revert TipFailed();` → `if (!ok) return;` | `test_aTipThePayeeRefusesIsRefused` |
| M27 | a zero tip pushes nothing and asks nothing of the payee | `if (msg.value != 0) {` → `if (msg.value != 1) {` | `test_aReactionWithoutATipAsksNothingOfThePayee` |
| M28 | the push happens under the lock: a payee cannot re-enter | `payable { Transient.enter(Transient.AGORA_LOCK);` → `payable { Transient.exit(Transient.AGORA_LOCK);` | `test_aPayeeCannotReenterWhileItIsBeingPaid` |
| M29 | BadReply: a reaction's seq is within the room's own count | `if (seq == 0 \|\| seq > _room[room].count) revert BadReply();` → `if (seq == 0 \|\| seq > _room[COMMONS].count) revert BadReply();` | `test_aReactionNamesAMessageTheRoomHasReached`, `test_aTipToAForeignAuthorLandsWithItsHolder` |
| M30 | BadReply: a reaction to a message not yet said is refused | `seq > _room[room].count) revert BadReply();` → `seq > _room[room].count + 1) revert BadReply();` | `test_aReactionNamesAMessageTheRoomHasReached` |
| M31 | BadReply: there is no message zero | `if (seq == 0 \|\| seq >` → `if (seq == 9 \|\| seq >` | `test_aReactionNamesAMessageTheRoomHasReached` |
| M32 | BadReply: a reply pointer never names a seq the room has not reached | `reSeq > r.count) revert BadReply();` → `reSeq > r.count + 1) revert BadReply();` | `test_aReplyPointerIsWalkable` |
| M33 | BadGlyph: the zero glyph is refused | `if (w == 0) return false;` → `if (w == 1) return false;` | `test_aGlyphIsOneToFourBytesOfUtf8LeftAligned` |
| M34 | BadGlyph: a surrogate is refused | `if (b == 0xed) hi = 0x9f;` → `if (b == 0xed) hi = 0xbf;` | `test_aGlyphIsOneToFourBytesOfUtf8LeftAligned` |
| M35 | BadGlyph: every byte after the glyph is zero | `return i == 4 \|\|` → `return i != 0 \|\|` | `test_aGlyphIsOneToFourBytesOfUtf8LeftAligned` |
| M36 | BadGlyph: an overlong form is refused | `if (b == 0xe0) lo = 0xa0;` → `if (b == 0xe0) lo = 0x80;` | `test_aGlyphIsOneToFourBytesOfUtf8LeftAligned` |
| M37 | follow is idempotent: an unfollow is not a follow | `if (follows[from][to] == on) return;` → `if (follows[from][to] == true) return;` | `test_aNewFollowNeedsAPersonaSomebodyHolds`, `test_followingTwiceCountsOnce`, `test_followsBelongToTheTokenAndSurviveItsSale`, `test_unfollowingWhatYouDoNotFollowChangesNothing` |
| M38 | follow is idempotent: following twice counts once | `if (follows[from][to] == on) return;` → `if (follows[from][to] == on) {}` | `test_followingTwiceCountsOnce`, `test_unfollowingWhatYouDoNotFollowChangesNothing` |
| M39 | TalkingToYourself: a persona cannot follow itself | `if (from == to) revert TalkingToYourself(); if (follows` → `if (from == 0) revert TalkingToYourself(); if (follows` | `test_aPersonaCannotFollowItself` |
| M40 | TalkingToYourself: a persona cannot whisper to itself | `if (from == to) revert TalkingToYourself(); _mustBeHeld(to);` → `if (from == 0) revert TalkingToYourself(); _mustBeHeld(to);` | `test_aWhisperNeedsSomebodyToWhisperTo` |
| M41 | hide sets the bit in the right word (seq past 255) | `_hidden[room][seq >> 8] \|=` → `_hidden[room][seq >> 7] \|=` | `test_hideIsABitNotADeletion` |
| M42 | a cooldown is at most seven days, and seven days is allowed | `if (seconds_ > MAX_COOLDOWN) revert TooLong();` → `if (seconds_ >= MAX_COOLDOWN) revert TooLong();` | `test_aStewardSetsACooldownUpToSevenDays` |
| M43 | a name is 1..48 bytes, and 48 is allowed | `if (n == 0 \|\| n > MAX_NAME) revert BadName();` → `if (n == 0 \|\| n >= MAX_NAME) revert BadName();` | `test_aRoomNeedsAName` |
| M44 | the commons brake is two blocks | `uint64 private constant COMMONS_BLOCKS = 2;` → `uint64 private constant COMMONS_BLOCKS = 1;` | `test_aCollectionRoomBrakesLikeTheCommons`, `test_theCommonsRefusesTwoWordsInsideTwoBlocks` |
| M45 | the ring: a second message in a block moves a seq, not a lane | `r.headSeqs = (r.headSeqs & ~uint256(type(uint64).max)) \| seq;` → `r.headSeqs = (r.headSeqs << 64) \| seq;` | `test_theRingShiftsOnANewBlockAndNotWithinOne` |

One redundancy, not counted as a row: `isRegistered`'s EXTCODESIZE check
is behaviourally covered by its own `ret.length >= 32` (a staticcall to a
codeless address succeeds with no data), so removing it changes nothing a
test can see; it stays because CLAUDE.md asks for both, and saying so is
better than a mutant that cannot die.

## Proposed INVARIANTS rows

For `docs/INVARIANTS.md` (the integration's file; this unit does not edit
it). Each sentence below is verbatim in the file named. Status for all:
**pending (W5)** — each runs in its suite or its verifier and its guard was
seen to fail under a one-token mutation in the pruned tree (the table
above); live once `test/Agora.t.sol` runs in the battery's forge steps and
`tools/verify-agora.mjs` has a `verify:agora` step in `tools/check.mjs`.

| Row | Claim | Attacked by |
|---|---|---|
| AG1 | Only whoever acts as a persona speaks, whispers, reacts, follows or founds as it: its holder, or for a hub token its Reach; never a renter, an approved address or an operator | `test/Agora.t.sol` · `test_aRenterCannotSpeak`, `test_onlyTheHolderSpeaksAsTheirPersona`, `test_theReachMaySpeakForAHubPersonaAndTheRenterMayNot`, `test_aForeignTokenIsActedForByItsHolderAlone`; `tools/verify-agora.mjs` · *"hub token #1's real Reach speaks for it, and the log names the persona"*, *"and the renter the hub names for #1 is refused as NotYours"* |
| AG2 | The commons hears registered collections only — the hub and the Studio's — read live, and an absent, reverting or mumbling Studio registers nothing but the hub | `test/Agora.t.sol` · `test_theCommonsHearsOnlyRegisteredCollections`, `test_aStudioThatIsAbsentOrRevertsRegistersOnlyTheHub`, `test_registrationIsReadLiveFromTheStudio`; `tools/verify-agora.mjs` · *"the Apes holder is refused in the commons as Unregistered(Apes), by name and argument"* |
| AG3 | Every ERC-721 has a room no one founds, in which only its own personas speak, braked as the commons is | `test/Agora.t.sol` · `test_onlyACollectionsOwnPersonasSpeakInItsRoom`, `test_aCollectionRoomNeedsNoFounding`, `test_aCollectionRoomBrakesLikeTheCommons`; `tools/verify-agora.mjs` · *"and speaks in the Apes room, which its first word opens as a collection room naming Apes"*, *"hub token #1 is refused in the Apes room as NotOfCollection(#1, Apes)"*, *"a collection room brakes the same way: two words of one Ape inside two blocks are refused"* |
| AG4 | Delegated things are keyed by (persona, stamp): a sale silences the seller, gives the buyer an empty brake, empties the seller's seats and invitations and kills its key binding; two tokens of one holder keep two brakes | `test/Agora.t.sol` · `test_aBuyerIsNotRateLimitedByTheSeller`, `test_aForeignBuyerIsNotRateLimitedByTheSellerEither`, `test_twoPersonasOfOneHolderKeepTwoBrakes`, `test_aSaleEmptiesTheSellersSeatAndTheBuyerTakesItsOwn`, `test_anInvitationIsToTheHolderAndDiesWithTheSale`, `test_aSoldPersonaHasNoKey`, `test_aForeignSaleKillsTheKeyBindingToo`; `tools/verify-agora.mjs` · *"the buyer speaks in the very block of the seller's last word: its brake is its own"*, *"the seller's key binding died with the sale: keyOf(#1) is zero"* |
| AG5 | A sealed whisper needs both sides' live keys and names the recipient's (NoKey, KeyMoved) | `test/Agora.t.sol` · `test_aSealedWhisperNeedsTheSendersKeyToo`, `test_aSealedWhisperToAPersonaWithoutABindingIsRefused`, `test_aRotatedKeyRefusesTheWhisper`; `tools/verify-agora.mjs` · *"a sealed whisper to a key that is not #2's bound key is refused (KeyMoved)"*, *"and a whisper sealed to the seller's key is refused rather than recorded (NoKey)"* |
| AG6 | A tip is pushed, in the call that carries it, to the payee of the persona named as author and to nobody else; Agora holds nothing; no payee is NoPayee, a refused push is TipFailed, and a payee cannot re-enter | `test/Agora.t.sol` · `test_aTipLandsInTheAuthorsFeeSinkAndNowhereElse`, `test_aTipFollowsTheFeesIntoTheGrip`, `test_aTipToAForeignAuthorLandsWithItsHolder`, `test_aTippedReactionToAPersonaNobodyHoldsIsRefused`, `test_aTipThePayeeRefusesIsRefused`, `test_aReactionWithoutATipAsksNothingOfThePayee`, `test_aPayeeCannotReenterWhileItIsBeingPaid`; `tools/verify-agora.mjs` · *"#2's ✦ on #1's first message carries 0.0001 ETH into feeSink(1) on the hub, in the same call"*, *"and none of it stays in Agora"*, *"a tip to a hub token nobody holds is refused as NoPayee(the persona)"* |
| AG7 | A reaction names a message its room has reached and a glyph of one to four bytes of well-formed UTF-8 | `test/Agora.t.sol` · `test_aReactionNamesAMessageTheRoomHasReached`, `test_aGlyphIsOneToFourBytesOfUtf8LeftAligned`; `tools/verify-agora.mjs` · *"a reaction to a message the room has not reached is refused (BadReply)"*, *"and a glyph that is not UTF-8 is refused (BadGlyph)"* |
| AG8 | Follows are the token's: idempotent counts, no self-follow, and they survive a sale | `test/Agora.t.sol` · `test_followingTwiceCountsOnce`, `test_unfollowingWhatYouDoNotFollowChangesNothing`, `test_aPersonaCannotFollowItself`, `test_followsBelongToTheTokenAndSurviveItsSale`; `tools/verify-agora.mjs` · *"#2 and Ape #7 follow #1, and following twice counts once"*, *"and #1 keeps both its followers: follows belong to the token, by design"* |
| AG9 | Parley's archive, unchanged: body caps, single-block walks of a room and of one persona across rooms, the heads ring | `test/Agora.t.sol` · `test_aBodyHasBothEnds`, `test_aSealedBodyMayBeFourTimesLonger`, `test_theRingShiftsOnANewBlockAndNotWithinOne`, `test_aReplyPointerIsWalkable`; `tools/verify-agora.mjs` · *"and 406 blocks of history cost 3 single-block queries"*, *"#1's own back-link walks every word it said, in every room, across both of its holders"* |

## Requests for frozen files

1. **`src/interfaces/IAgora.sol`, additive** (a new section of
   `docs/INTERFACE-CHANGES.md`): declare the five functions Agora serves
   beyond IAgora — `evict(uint256 room, uint256 by, uint256 persona)`,
   `heads(uint256[] rooms) returns (uint64[])`, `topics() returns (bytes32
   said, bytes32 founded, bytes32 invited, bytes32 entered, bytes32
   departed, bytes32 reacted, bytes32 followed)`, `roomsOf(uint256 persona)
   returns (uint256[] keys, bool[] member)` and `roomCount(uint256 persona)`.
   *Reason:* each carries a guarantee Parley's suite asserts (eviction,
   the one-call poll, topics a page cannot hash, the room list), and the
   Catalog's drift gate and the console name functions through the
   interface.
2. **`src/interfaces/IAgora.sol`, additive, optional:** IAgora froze no
   `NoSuchToken` and no `NotHolder`. Agora refuses a whisper, an
   invitation or a new follow to a persona nobody holds with Persona's
   `NotAPersona(address collection, uint256 id)`, which is already in its
   ABI through `persona()`, and `bindKey` by a non-holder with `NotYours`.
   If a dedicated name is wanted, add `error NoSuchPersona(uint256 persona)`
   to `IAgoraEvents` and Agora changes one line in `_mustBeHeld`.
3. **`tools/forge.mjs` (a harness gap, found here):** when `expectRevert`
   swallows a revert, the runner hands the caller a result whose
   `gasRefund` ethereumjs has already zeroed (@ethereumjs/evm 10.1.3,
   `evm.js` `runCall`: "all refunds are forfeited",
   `result.execResult.gasRefund = BIGINT_0`), and once the runner has
   turned the revert into a success the caller adopts it (`interpreter.js`
   `_baseCall`: `this._runState.gasRefund = results.execResult.gasRefund`). Every
   refund the test earned before the swallow is lost, so a later SSTORE
   that subtracts a refund — re-setting a slot the same test had zeroed —
   throws `refund exhausted` and the test fails with "no data". Forge keeps
   the caller's counter. *Fix:* record `msg.gasRefund` on the frame in
   `beforeMessage` and restore it in the swallow branch of `afterMessage`.
   `test_registrationIsReadLiveFromTheStudio` is ordered around it and
   says so.
4. **`tools/check.mjs` (integration):** a `verify:agora` step running
   `node tools/verify-agora.mjs`, read by the common `N passed, M failed`
   regex.
5. **`docs/INVARIANTS.md` and DESIGN §14 (integration):** the rows above.
6. **`tools/mutations.mjs` (integration, optional):** the 45 rows of this
   unit's table, so the gate covers Agora beside Parley and Postage.
7. **`src/Catalog.sol` (W6) and `tools/site.mjs` / `tools/deploy.mjs`
   (wave 3):** Agora's rows and its place in the deployment — below.

## What later waves must know

- **Constructor:** `Agora(address hub, address keys, address studio)` —
  the hub (the diamond, whose `acts`, `feeSink`, `account` and
  `custodyEpoch` Persona reads), the KeyRegistry, the Studio. All three are
  immutables; the constructor makes no external call, so deployment order
  is free once the three addresses are known. `IStudio` declares
  `AGORA()`: if W4's Studio pins it as an immutable, it and
  `Agora.STUDIO()` are mutual immutables, as Parley's and Postage's were —
  predict both (CREATE3 salts in `tools/deploy.mjs`, nonces in
  `tools/site.mjs`) and assert both after.
- **Deploy it once.** The archive is the logs at Agora's address; a
  replacement does not migrate a conversation, it ends one (Roster's
  argument). Nothing in Agora needs replacing to add a read: Roster-style
  readers go beside it.
- **Personas everywhere.** A hub token is `persona(hub, id)`, never the
  bare id: a bare id names collection zero, and is refused (`NotYours` as a
  speaker, `NotAPersona` as a target, `NoPayee` as a tipped author).
- **What the social lane reads.** `stateOf` keeps Parley's eleven words:
  `opened == 0` is a room that never came into being (an unopened room
  reads kind 0, which is also the commons'), kind 4 is a collection room
  and its `index` is the collection. `heads(rooms)` is the poll;
  `topics()` gives seven topic0s (Parley's five first, then `Reacted`,
  `Followed`); `Said`, `Founded`, `Invited`, `Entered`, `Departed`,
  `CooldownSet` and `Hidden` have Parley's exact signatures, so their
  topics are Parley's; `KeyBound` carries the stamp (`bytes32`) where
  Parley's carried the epoch, so its topic differs. `keyOf`, `roomsOf`,
  `inRoom`, `invited`, `hidden`, `lastSpoke`, `follows`, `followerCount`,
  `followingCount`, `isRegistered` and `mayActAs` answer the rest. Two
  readings follow from stamp-keyed seats: `inRoom` answers seats only, and
  a steward speaks in its group or home by right without a live one (after
  a sale the buyer-steward has none), so a page shows a stewarded room by
  `stateOf(room).steward`; and `roomsOf(persona)` lists every room the
  token ever took a seat in, across its holders, with `member` saying
  whether the current holder holds that seat.
- **Collection rooms open themselves.** A Studio Collection's `room()` is
  `collectionKey(address(this))`; nothing is called at mint, and the
  room's first word opens it.
- **Sealing.** A sealed whisper needs both sides bound (`bindKey`, holder
  only, per persona), and `expectedKeyId` is the recipient's `keyOf` id.
- **Tips.** `react{value}` pushes to `payeeOf(HUB, author)` — for a hub
  token `feeSink(id)`, its Reach or its Grip. Agora cannot check the
  author, so the page must name the author the `Said` log names.
- **The feed** (V2 §3.5) is client-side: `Said` by followed personas
  (topic 2 is the persona), joined with Journal, Keepsake and Bazaar
  events; Agora stores no feed.
- **The Catalog (W6).** `CatalogRows.SERVICES` is at 89 % of the
  transaction cap, so Agora's rows belong in `CatalogRowsPost`, under a
  letter of its own (the free ones are B, F, J, V and Z; F, for forum, is
  this unit's suggestion). The writes: `speak`, `whisper`, `react`
  (payable), `follow`, `found`, `invite`, `join`, `leave`, `evict`,
  `setCooldown`, `hide`, `bindKey`. The err table needs the six selectors
  Agora adds to Parley's: `BadGlyph()`, `NoPayee(uint256)`,
  `NotAPersona(address,uint256)`, `NotOfCollection(uint256,address)`,
  `TipFailed()`, `Unregistered(address)`.
- **Harness traps met here:** the refund trap of request 3, and the
  shared scratchpad — five units write into one session scratchpad, so a
  file there needs a unit-unique path.
