# W2 — Journal: memories written into a token

Unit W2 of INTACT V2 wave 1. Branch `worktree-agent-a3452bb53ecd6c963`,
from b676ee0 ("V2 wave 0 freezes eight interfaces…"). Specification:
docs/V2.md §3.2 (with §5.6 and §8), docs/INTERFACE-CHANGES.md "V2 wave 0",
and every comment in the frozen `src/interfaces/IJournal.sol`.

## What was built

| File | Role |
|---|---|
| `src/Journal.sol` (NEW) | `inscribe(collection, id, kind, body, ref)` under `Transient.JOURNAL_LOCK`; `mayInscribe` = `Rights.acts(HUB, id, who)` for the hub, `Rights.holds(collection, id, who)` for any other collection; kinds 0..4, bodies 1..1,024 B plain and 1..4,096 B sealed; the epoch read typed from the hub and guarded from anyone else; two words of storage per token (`count`, `root`), no body stored; `countOf`, `rootOf`; the kinds and bounds as the interface's `pure` functions; no admin, no setter, nothing that edits or deletes |
| `test/Journal.t.sol` (NEW) | 36 tests, every one a sentence (one of them a fuzz property, 24 runs) |
| `test/mocks/JournalFixtures.sol` (NEW) | `JournalHub` (exactly `ownerOf`, `account`, `custodyEpoch`, plus the hands that must not be believed — an ERC-4907 user, an approval, an operator — a `transferFrom` and a `panic` that move the epoch, and a switch that makes the epoch unreadable); `JournalReach` (relays one call for the token's holder only, as the real `execute`'s `onlySigner`); `JournalForeign` (five answer shapes for `ownerOf` and `custodyEpoch` separately: honest, a revert carrying the word, 31 bytes, nothing, a word with bit 255 set; and an `account(id)` the Journal must never ask); `JournalLiar` (anyone claims any id); `JournalReentrant` (calls `inscribe` from inside its `ownerOf`); `JournalProbe` (measures a contract's `rootOf` read) |
| `tools/verify-journal.mjs` (NEW) | 48 checks on the real site (`deploySite`: the diamond, the real Reach forwarder, the KeyRegistry), with the root re-folded in JavaScript from the `Inscribed` logs, a real P-256 sealed memory, and the gas measurements below |
| `docs/v2/W2-journal.md` (NEW) | this report |

No file outside these five was edited.

## Decisions, each with its reason

Decided by the unit brief and kept exactly (the reasons are the contract's
box comment, in short):

- **`constructor(address hub)`; no admin.** The hub is the one address the
  Journal trusts. There is no zero check: IJournal declares no error for it,
  and a zero hub would only make writes into the zero collection revert;
  the wave-3 deployer should assert `HUB()` as it asserts every other pin.
- **`mayInscribe` uses Rights' two words and nothing else.** For the hub,
  `acts`: the holder or the token's Reach — the token acting for itself,
  which is how `[swapAndWrap, inscribe]` is one batch. For any other
  ERC-721, `holds`, a guarded `ownerOf` staticcall: no code, a revert or a
  short answer is nobody. Never a renter (a lease buys the instrument's use,
  and a memory outlives the lease), never an approved address or an
  operator (permission to move the token is not a pen), and a session key
  only AS the Reach.
- **Refusals in the interface's order**: `NotYours`, then `UnknownKind(kind)`
  for a kind above 4, then `Empty`, then `TooLong(length, max)` with the
  kind's own bound. A stranger learns nothing past `NotYours`
  (`test_theRefusalsComeInTheirOrder`).
- **Parley's bounds**: 1,024 B plain, 4,096 B sealed. A sealed envelope is a
  point, a salt and two copies, so it is allowed four times the room, and
  one envelope shape serves the whisper and the memory.
- **The root**: `keccak256(abi.encode(root, n, kind, keccak256(body), ref,
  msg.sender, epoch))`, `n = ++count`; the body only in the log.
- **The epoch**: `HUB.custodyEpoch(id)` by a typed call for the hub, a
  guarded `custodyEpoch(uint256)` staticcall for any other collection (no
  code, a revert, a short answer or a word over 64 bits is 0).

Decided here:

- **The hub's epoch is not guarded, on purpose.** A hub that cannot answer
  stops the write (its own revert bubbles) instead of recording epoch 0, an
  epoch no hub token ever had (`test_aHubThatCannotAnswerItsEpochStopsTheWrite`;
  mutation M29 routes the hub through the guarded read and that test kills
  it).
- **`Persona.epochOf` is not used.** It reads the same thing with the same
  rules, but of a packed persona, and `Persona.pack` refuses ids at or
  above 2^96. A Journal page is any `(collection, id)` — an ENS name's id is
  a hash — so the guarded read is spelled out in `_epochOf` with Persona's
  rules, and the comment says so.
- **A foreign collection's `account(id)` is never asked.** The hub's Reach is
  canonical by CREATE2 and codehash; another collection's is a word
  (`test_aForeignCollectionsAccountIsNotAsked`; mutation M01 asks it).
- **One struct per page**, `{uint256 count; bytes32 root;}` under
  `mapping(address collection => mapping(uint256 id => Page))`: one slot
  computation for both words, and `rootOf` is one cold `SLOAD`. The
  increment is `unchecked` (a uint256 of memories does not wrap).
- **The kinds and bounds are explicit `pure` functions** (`NOTE()` …
  `MAX_SEALED()`), not `public constant`s: solc 0.8.36 accepts a public
  constant against a `pure` interface function but its ABI then says
  `view` (probed on this compiler), and the Catalog's drift gate reads ABIs.
- **No `topics()` view.** Parley has one because the console has no keccak;
  the Catalog's topics table now serves every topic by signature, so the
  Journal's `Inscribed` belongs there (request 3 below).
- **No back-link pointer.** Parley's archive is walkable in single-block
  queries because every message carries the block of the one before. The
  frozen `Inscribed` carries no such field and the brief stores two words,
  so memories are found by `eth_getLogs` over the indexed `(collection, id)`
  (and `n` for one memory): a range query, like the Gallery's `Transfer`
  provenance. If a lane needs single-block walks, see "What later waves must
  know".
- **The sealed envelope is the console's own** (`engine/whispers.mjs`,
  `encryptWhisper(context, plaintext, key, key)`: both copies to the
  author's key), under a journal context of its own —
  `["intact-journal/1", chainId, hub, journal, id, epoch, keyVersion]` — so a
  whisper replayed as a memory, or a memory replayed into another token or
  custody, fails to open (probed: another context is refused with
  "Whisper identity mismatch", another key by AES-GCM).

## Sizes and counts (measured)

| What | Run | Result |
|---|---|---|
| `Journal` runtime | `node tools/compile.mjs`, this worktree, solc 0.8.36 viaIR 800, `bytecodeHash: "none"` (338 s cold on shared cores) | **2,142 B** (9 % of EIP-170); every gated contract under 24,576 B; the ship rule unchanged (diamond: Intact 25,364 B > 24,000) |
| the suite | `node tools/forge.mjs --match Journal` in the pruned copy `/tmp/v2-journal` (`src/interfaces`, `src/lib`, `src/Journal.sol`, `test/Journal.t.sol`, `test/mocks/{JournalFixtures,MockERC721}.sol`) | **36 passed, 0 failed** (81 s, cold compile included) |
| the verifier | `node tools/verify-journal.mjs`, this worktree, after `node tools/build-app.mjs` | **48 passed, 0 failed** (10 s on a warm compile cache; the cold `src` + `test/mocks` compile took 7 m 53 s on shared cores) |
| the static audit | `node tools/static-audit.mjs`, this worktree | passed — 10 Solidity rules, 4 JS rules |

**Gas** (measured by `tools/verify-journal.mjs` on the run above; the hub is
the diamond, so every write pays a delegatecall into a facet for `ownerOf`
and another for `custodyEpoch`):

| Call | Gas |
|---|---|
| `rootOf(HUB, id)` as an `eth_call` (execution only) | 2,511 |
| `rootOf(HUB, id)` from a contract with the Journal cold — what the hub's fingerprint will pay (V2 W6) | 5,372 |
| `inscribe`, 100 B plain — a page's first memory / a later one | 92,334 / 58,134 |
| `inscribe`, 1,024 B plain — first / later | 114,692 / 80,492 |
| `inscribe`, 4,096 B sealed — first / later | 190,288 / 156,088 |
| `Reach.execute(inscribe)`, a 27 B milestone, the page's third memory — the Reach's first call ever | 127,378 |
| `Reach.executeBatch([inscribe, inscribe])`, the page's fourth and fifth — the Reach's second call | 118,958 |

Transaction gas, intrinsic and calldata included, except the two `rootOf`
rows. A page's first memory pays two zero-to-nonzero stores (count and
root) and a later one two rewrites: 34,200 gas, the whole difference
between the columns at every size. The Reach rows carry the Reach's own
bookkeeping: every call rewrites its `_state` counter and `_auditRoot`, and
its first call writes both from zero, which is why one memory through
`execute` cost more than two through the later `executeBatch`.

## Mutation evidence

Every guard in the brief, each as a one-token mutation written over the
file in a copy of the pruned tree (`/tmp/v2-journal-mut`: `src/Journal.sol`,
`src/interfaces/IJournal.sol`, `src/lib/{Rights,Transient}.sol`, the suite
and its two mocks), `node tools/forge.mjs --match Journal` run, the failing
tests recorded by name, the file restored; the run ended by comparing both
files byte for byte with their originals (`sources restored byte for byte:
true`). The guards in `src/lib/Rights.sol` (M05, M34–M36, M41) are mutated
there because the Journal's refusal of a renter, an operator, a codeless,
short-answering or reverting collection IS Rights' code; Rights itself was
never edited in the worktree.

**The final run** (driver and record in `scratchpad/w2-journal/`, sources
hashed before and after): **40 mutations, 40 killed, 0 survived, 0 refused
as ambiguous; sources restored byte for byte: true.** M06 is unused: the
candidate was dropped before the first run (it made the Journal ask
whether the collection itself holds the token, which refuses every write
and names no guard). The run reused the compile cache for the 38 mutants
the first run had already compiled — the cache is keyed by the exact
compiler input, so a cached artifact is the same compilation — and every
mutant's suite was executed afresh (10–22 s each); M18 and M19 compiled
cold (78–79 s): the first run had refused them as ambiguous, because their
search strings also matched the formula quoted in the box comment, and
they were re-anchored to the code line.

The brief's guards, by row: holder-only for a foreign collection M01;
`acts` for the hub — the Reach writes M02, M03, a renter and an operator do
not M04, M05; the kind bound M07, M08; the plain bound at its boundary
M10, M12, M13; the sealed bound M11–M13, M15; a 1,025-byte sealed body M14;
`Empty` M09; the root field by field — the previous root M16, `n` M17, the
kind M18, the body M19, the ref M20, the author M21, the epoch M22, and its
encoding and storage M23, M24; the count by exactly one M25, M26; the hub's
epoch read M27–M29; a codeless collection M34, M35 (a reverting one M36,
the zero address M41); a lying collection's namespace M37, M38. Beyond the
brief: a foreign epoch's four "no answer" rules M30–M33 and the lock M39,
M40.

| # | Guard | Mutation | Killed by |
|---|---|---|---|
| M01 | holder-only for a foreign collection | `: Rights.holds(collection, id, who)` → `: Rights.acts(collection, id, who)` | 6 of 36: `test_aForeignCollectionsAccountIsNotAsked` and 5 more |
| M02 | acts for the hub (its Reach writes) | `? Rights.acts(HUB, id, who)` → `? Rights.holds(HUB, id, who)` | 3 of 36: `test_theTokensReachWritesForIt`, `test_theLockIsReleasedBetweenTwoMemoriesInOneTransaction`, `test_theRootRollsByTheFormulaFieldByField` |
| M03 | the hub/foreign choice of word | `return collection == HUB ?` → `return collection != HUB ?` | 14 of 36: `test_theTokensReachWritesForIt`, `test_aLyingCollectionMovesOnlyItsOwnNamespace` and 12 more |
| M04 | NotYours unless mayInscribe | `if (!mayInscribe(collection, id, msg.sender))` → `if (mayInscribe(collection, id, msg.sender))` | 33 of 36: `test_aRenterCannotWrite`, `test_anApprovedOperatorCannotWrite`, `test_theHolderWritesAndTheFirstMemoryIsNumberOne` and 30 more |
| M05 | a renter or an operator is not the Reach (Rights.acts) | `IRightsHub(hub).account(id) == who` → `IRightsHub(hub).account(id) != who` | 13 of 36: `test_aRenterCannotWrite`, `test_anApprovedOperatorCannotWrite`, `test_aStrangerAndAnotherTokensHolderCannotWrite` and 10 more |
| M07 | the kind bound, one past SEALED | `kind > _SEALED` → `kind > _SEALED + 1` | 2 of 36: `test_aKindAboveSealedIsRefusedByName`, `testFuzz_aMemoryIsAcceptedExactlyWithinItsKindsBound` |
| M08 | the kind bound, at SEALED | `kind > _SEALED` → `kind >= _SEALED` | 6 of 36: `test_everyKindFromNoteToSealedIsAccepted` and 5 more |
| M09 | Empty | `body.length == 0` → `body.length < 0` | 4 of 36: `test_anEmptyBodyIsRefused`, `testFuzz_aMemoryIsAcceptedExactlyWithinItsKindsBound`, `test_aRefusedWriteMovesNeitherTheCountNorTheRoot`, `test_theRefusalsComeInTheirOrder` |
| M10 | the plain bound, 1,024 | `_MAX_PLAIN  = 1024` → `_MAX_PLAIN  = 1025` | 6 of 36: `test_aPlainBodyMayBe1024BytesAndNotOneMore` and 5 more |
| M11 | the sealed bound, 4,096 | `_MAX_SEALED = 4096` → `_MAX_SEALED = 4097` | 2 of 36: `test_aSealedBodyMayBe4096BytesAndNotOneMore`, `test_theKindsAndTheBoundsAreTheInterfaces` |
| M12 | the length comparison at the bound | `body.length > max` → `body.length >= max` | 2 of 36: `test_aPlainBodyMayBe1024BytesAndNotOneMore`, `test_aSealedBodyMayBe4096BytesAndNotOneMore` |
| M13 | the length comparison one past the bound | `body.length > max)` → `body.length > max + 1)` | 4 of 36: `test_aPlainBodyMayBe1024BytesAndNotOneMore`, `test_aSealedBodyMayBe4096BytesAndNotOneMore`, `test_aRefusedWriteMovesNeitherTheCountNorTheRoot`, `test_aSealedBodyMayBeLongerThanAPlainOne` |
| M14 | SEALED alone takes the sealed bound | `kind == _SEALED ? _MAX_SEALED` → `kind != _SEALED ? _MAX_SEALED` | 7 of 36: `test_aSealedBodyMayBeLongerThanAPlainOne` and 6 more |
| M15 | TooLong names the kind's own bound | `TooLong(body.length, max)` → `TooLong(body.length, _MAX_PLAIN)` | 1 of 36: `test_aSealedBodyMayBe4096BytesAndNotOneMore` |
| M16 | the root folds the previous root | `abi.encode(p.root, n,` → `abi.encode(bytes32(0), n,` | 5 of 36: `test_theRootRollsByTheFormulaFieldByField` and 4 more |
| M17 | the root folds n | `p.root, n, kind` → `p.root, id, kind` | 7 of 36: `test_theRootRollsByTheFormulaFieldByField`, `test_eachFieldOfAMemoryMovesTheRoot` and 5 more |
| M18 | the root folds the kind | `abi.encode(p.root, n, kind,` → `abi.encode(p.root, n, _NOTE,` | 8 of 36: `test_eachFieldOfAMemoryMovesTheRoot`, `test_theRootRollsByTheFormulaFieldByField` and 6 more |
| M19 | the root folds the body's hash | `kind, keccak256(body), ref, msg.sender` → `kind, bytes32(body.length), ref, msg.sender` | 13 of 36: `test_eachFieldOfAMemoryMovesTheRoot`, `test_theRootRollsByTheFormulaFieldByField` and 11 more |
| M20 | the root folds the ref | `ref, msg.sender, epoch)` → `bytes32(0), msg.sender, epoch)` | 7 of 36: `test_eachFieldOfAMemoryMovesTheRoot`, `test_theRootRollsByTheFormulaFieldByField` and 5 more |
| M21 | the root folds the author | `ref, msg.sender, epoch)` → `ref, collection, epoch)` | 13 of 36: `test_eachFieldOfAMemoryMovesTheRoot`, `test_theRootRollsByTheFormulaFieldByField` and 11 more |
| M22 | the root folds the epoch | `msg.sender, epoch))` → `msg.sender, uint64(0)))` | 11 of 36: `test_eachFieldOfAMemoryMovesTheRoot`, `test_theRootRollsByTheFormulaFieldByField` and 9 more |
| M23 | the root is abi.encode, word by word | `keccak256(abi.encode(p.root` → `keccak256(abi.encodePacked(p.root` | 13 of 36: `test_theRootRollsByTheFormulaFieldByField` and 12 more |
| M24 | the root is kept | `p.root = root;` → `p.root = p.root;` | 13 of 36: `test_theRootRollsByTheFormulaFieldByField` and 12 more |
| M25 | the count rises by one | `p.count + 1` → `p.count + 2` | 23 of 36: `test_theCountRisesByExactlyOnePerMemory`, `test_theHolderWritesAndTheFirstMemoryIsNumberOne` and 21 more |
| M26 | the count is kept | `p.count = n;` → `p.count = 1;` | 4 of 36: `test_theCountRisesByExactlyOnePerMemory`, `test_aPlainBodyMayBe1024BytesAndNotOneMore`, `test_everyKindFromNoteToSealedIsAccepted`, `test_theRootRollsByTheFormulaFieldByField` |
| M27 | the hub's epoch is read | `return IJournalCustody(HUB).custodyEpoch(id);` → `return 1;` | 5 of 36: `test_theHubsEpochIsReadAtEveryWriteNotAssumed`, `test_aSaleRefusesTheSellerAndAdmitsTheBuyerUnderTheNextEpoch`, `test_aHubThatCannotAnswerItsEpochStopsTheWrite`, `test_aPanicMovesTheEpochInPlaceAndTheHolderStillWrites`, `test_theRootRollsByTheFormulaFieldByField` |
| M28 | the hub's epoch is the hub's alone | `if (collection == HUB) return` → `if (collection != HUB) return` | 6 of 36: `test_aForeignHolderWritesIntoItsOwnNamespace`, `test_aLyingCollectionMovesOnlyItsOwnNamespace` and 4 more |
| M29 | the hub's epoch is read without a guard | `if (collection == HUB) return` → `if (collection == address(this)) return` | 1 of 36: `test_aHubThatCannotAnswerItsEpochStopsTheWrite` |
| M30 | a foreign epoch over uint64 is 0 (at the top) | `word > type(uint64).max` → `word >= type(uint64).max` | 1 of 36: `test_aForeignEpochIsReadWhereTheCollectionAnswersIt` |
| M31 | a foreign epoch over uint64 is 0, not truncated | `? 0 : uint64(word)` → `? uint64(word) : uint64(word)` | 1 of 36: `test_aForeignEpochThatCannotBeReadIsZero` |
| M32 | a short foreign epoch is 0 | `ret.length < 32) return 0;` → `ret.length < 31) return 0;` | 1 of 36: `test_aForeignEpochThatCannotBeReadIsZero` |
| M33 | a reverting foreign epoch is 0 | `if (!ok \|\| ret.length < 32) return 0;` → `if (ret.length < 32) return 0;` | 1 of 36: `test_aForeignEpochThatCannotBeReadIsZero` |
| M34 | a codeless collection names nobody (Rights.holds) | `ret.length < 32) return false;` → `ret.length < 32) return true;` | 5 of 36: `test_aCodelessCollectionTakesNoMemory` and 4 more |
| M35 | a short ownerOf names nobody (Rights.holds) | `if (!ok \|\| ret.length < 32) return false;` → `if (!ok) return false;` | 3 of 36: `test_aCodelessCollectionTakesNoMemory`, `test_aCollectionThatAnswersShortTakesNoMemory`, `test_mayInscribeAnswersFalseWithoutRevertingForAnyoneWithNoPen` |
| M36 | a reverting ownerOf names nobody (Rights.holds) | `if (!ok \|\| ret.length < 32)` → `if (ret.length < 32)` | 2 of 36: `test_aRevertingCollectionTakesNoMemory`, `test_mayInscribeAnswersFalseWithoutRevertingForAnyoneWithNoPen` |
| M37 | a page is the collection's own | `Page storage p = _pages[collection][id];` → `Page storage p = _pages[HUB][id];` | 6 of 36: `test_aLyingCollectionMovesOnlyItsOwnNamespace` and 5 more |
| M38 | a page is the token's own | `Page storage p = _pages[collection][id];` → `Page storage p = _pages[collection][0];` | 16 of 36: `test_theCountRisesByExactlyOnePerMemory`, `test_aLyingCollectionMovesOnlyItsOwnNamespace` and 14 more |
| M39 | the lock is taken | `Transient.enter(Transient.JOURNAL_LOCK);` → `Transient.exit(Transient.JOURNAL_LOCK);` | 1 of 36: `test_aCollectionThatReentersInscribeMeetsTheLock` |
| M40 | the lock is released | `Transient.exit(Transient.JOURNAL_LOCK);` → `Transient.held(Transient.JOURNAL_LOCK);` | 14 of 36: `test_theLockIsReleasedBetweenTwoMemoriesInOneTransaction` and 13 more |
| M41 | the zero address holds nothing (Rights.holds) | `if (who == address(0)) return false;` → `if (false) return false;` | 1 of 36: `test_mayInscribeAnswersFalseWithoutRevertingForAnyoneWithNoPen` |

Eight rows are killed by one test alone (M15, M29–M33, M39, M41), so a
later edit to those tests should be run against those rows again. Two of
them carry a guard nothing else observes: the unguarded hub epoch (M29),
seen only by `test_aHubThatCannotAnswerItsEpochStopsTheWrite`, and the
lock's `enter` (M39), seen only by
`test_aCollectionThatReentersInscribeMeetsTheLock` — every read `inscribe`
makes is static, so without that fixture nothing could tell a taken lock
from a missing one.

## Proposed INVARIANTS rows

Pending (W2) until `verify:journal` runs in `npm run check` (request 1);
each cited sentence exists verbatim in the cited file.

| Row | Claim | Proof |
|---|---|---|
| J1 | Only the holder writes into a token's journal; for the hub the holder or the token's Reach (`acts`), never a renter, an approved address, an operator, a stranger, or the seller after the sale; a foreign collection's own `account` is never believed | `test/Journal.t.sol` · `test_aRenterCannotWrite`, `test_anApprovedOperatorCannotWrite`, `test_aStrangerAndAnotherTokensHolderCannotWrite`, `test_theTokensReachWritesForIt`, `test_aTokensReachIsAPenForItsOwnTokenOnly`, `test_aSaleRefusesTheSellerAndAdmitsTheBuyerUnderTheNextEpoch`, `test_aForeignCollectionsAccountIsNotAsked`; `tools/verify-journal.mjs` · *"the renter's inscribe is refused NotYours"*, *"the approved address's inscribe is refused NotYours"*, *"the operator's inscribe is refused NotYours"*, *"the seller's inscribe after the sale is refused NotYours"*, *"the token's Reach writes memory 3 through Reach.execute, and its log names the Reach as the author"* |
| J2 | Any ERC-721 has a journal, and a collection's answers bind only its own pages: no code, a revert, a short or wide answer names nobody; a lying collection moves only its own namespace | `test/Journal.t.sol` · `test_aForeignHolderWritesIntoItsOwnNamespace`, `test_aCodelessCollectionTakesNoMemory`, `test_aRevertingCollectionTakesNoMemory`, `test_aCollectionThatAnswersShortTakesNoMemory`, `test_aCollectionThatAnswersWideNamesNobody`, `test_aLyingCollectionMovesOnlyItsOwnNamespace`; `tools/verify-journal.mjs` · *"a MockERC721 token's holder writes memory 1 into that collection's namespace, under epoch 0"*, *"and the hub's token #1, the same id, kept its count and its root"*, *"an inscribe into a codeless collection is refused NotYours"* |
| J3 | A memory is NOTE..SEALED with a body of 1..1,024 bytes, or 1..4,096 sealed; anything else is refused by name with its arguments and moves nothing | `test/Journal.t.sol` · `test_everyKindFromNoteToSealedIsAccepted`, `test_aKindAboveSealedIsRefusedByName`, `test_anEmptyBodyIsRefused`, `test_aPlainBodyMayBe1024BytesAndNotOneMore`, `test_aSealedBodyMayBe4096BytesAndNotOneMore`, `test_aSealedBodyMayBeLongerThanAPlainOne`, `testFuzz_aMemoryIsAcceptedExactlyWithinItsKindsBound` |
| J4 | The count rises by exactly one per memory and the root folds every field — `keccak256(abi.encode(root, n, kind, keccak256(body), ref, author, epoch))` — so the logs alone replay it | `test/Journal.t.sol` · `test_theCountRisesByExactlyOnePerMemory`, `test_theRootRollsByTheFormulaFieldByField`, `test_eachFieldOfAMemoryMovesTheRoot`; `tools/verify-journal.mjs` · *"the root recomputed in JavaScript from the Inscribed logs equals rootOf"*, *"every log carries the root after its memory, folded from the root before it"*, *"the logs number the memories 1..n with no gap"* |
| J5 | Every memory carries the custody epoch it was written under: the hub's, read at the write (a hub that cannot answer stops it); a foreign collection's where it answers, else 0 | `test/Journal.t.sol` · `test_theHubsEpochIsReadAtEveryWriteNotAssumed`, `test_aPanicMovesTheEpochInPlaceAndTheHolderStillWrites`, `test_aHubThatCannotAnswerItsEpochStopsTheWrite`, `test_aForeignEpochIsReadWhereTheCollectionAnswersIt`, `test_aForeignEpochThatCannotBeReadIsZero`; `tools/verify-journal.mjs` · *"the buyer writes memory 6, and its log carries epoch 2 and the buyer as author"* |
| J6 | A sealed memory opens for its author from the log alone and for no later holder | `tools/verify-journal.mjs` · *"the holder opens it again from the log alone"*, *"the buyer's own key does not open the seller's sealed memory"* |
| J7 | `inscribe` holds the registered lock: a re-entrant call meets `Reentrancy()` by name, and the lock is released between memories in one transaction | `test/Journal.t.sol` · `test_aCollectionThatReentersInscribeMeetsTheLock`, `test_theLockIsReleasedBetweenTwoMemoriesInOneTransaction`; `tools/verify-journal.mjs` · *"two memories land in one Reach.executeBatch, in one transaction: the lock is released between them"* |

J1 is also the property W6 needs from the fingerprint term: nobody but the
token's holder or its Reach can move `rootOf(HUB, id)`, so a stranger cannot
break a listing by writing a memory (the Keepsake commitment's "never on
what a stranger can do", for the Journal).

## Requests for frozen files

1. **`tools/check.mjs` and `package.json`** (integration): a step
   `{ name: "verify:journal", file: "tools/verify-journal.mjs", args: [],
   shape: "passedFailed", what: "memories: the holder's pen, the root
   replayed from the logs" }` after `verify:premises`, and the script
   `"verify:journal": "node tools/verify-journal.mjs"`. The verifier prints
   exactly one `  N passed, M failed` line and exits 1 on any failure. It
   needs `dist/shards.json` (`node tools/build-app.mjs`), as every
   `deploySite` verifier does.
2. **`src/lib/Rights.sol`**: `holds` decodes `ownerOf`'s word with
   `abi.decode(ret, (address))`, which reverts on a word with bits above 160
   set, so `mayInscribe` (and every satellite's `holds`) reverts instead of
   answering false for such a collection. The write is refused either way
   (`test_aCollectionThatAnswersWideNamesNobody` accepts both), but a page
   asking the question gets a revert. `Persona._word` already reads such a
   word as nobody; the request is the same rule in `holds`
   (`uint256 w = abi.decode(ret, (uint256)); if (w >> 160 != 0) return false;`),
   which is behaviour-preserving for every honest collection. Until then a
   page treats a reverting `mayInscribe` as false.
3. **`src/Catalog.sol` and `tools/verify.mjs`** (W6 / wave 3): a letter for
   the Journal (J is free in `HPRYTSKNLCOWXEGQMDAUI`) and `address[22]`; rows
   in `CatalogRowsPost.SERVICES` (the MVB table is at 89 % of the
   transaction cap):
   `inscribe|J|inscribe(address,uint256,uint8,bytes,bytes32)|w|a|kind 0-4, body 1-1024 B, sealed 1-4096 B - the root moves;`
   `countOf|J|countOf(address,uint256)|r|d|;`
   `rootOf|J|rootOf(address,uint256)|r|d|the hub fingerprint term;`
   `mayInscribe|J|mayInscribe(address,uint256,address)|r|d|;`
   the err table gains `TooLong(uint256,uint256)` and `UnknownKind(uint8)`
   (`NotYours()`, `Empty()` and `Reentrancy()` are already in it); the
   topics table gains
   `inscribed=Inscribed(address,uint256,uint256,uint8,address,uint64,bytes32,bytes32,bytes);`;
   and the drift gate's `ON` and `PANEL_FACING` gain `journal: "Journal"`.
4. **`tools/site.mjs`** (wave 3): a `deployJournal` option deploying
   `Journal(hub)` at a predicted address after the hub, as `deployMarket`
   does, so the lanes and `tools/verify-journal.mjs` share one deployment.

## What later waves must know

- **W6, the hub's fingerprint term.** Read `rootOf(HUB, id)` as CLAUDE.md's
  satellite rule says — `extcodesize` and a low-level `staticcall`, an absent
  Journal "no answer", never a revert — and hash the word. Measured cost
  from a contract, cold: 5,372 gas (`tools/verify-journal.mjs`, the run
  above). The root does not bind the page it is in — two pages with the
  same memories have the same root (`test_eachFieldOfAMemoryMovesTheRoot`)
  — so the term means something only beside the id, which the fingerprint
  already binds. Only the holder or the Reach moves it (J1), so pinning it
  is safe; a holder's own memory written after an order was signed breaks
  the order, which is the point (§3.2).
- **The console's reads (W8 Gallery, W10 Vault, W11 Social).** The
  constellation needs only `countOf` and `rootOf`. Bodies come from
  `eth_getLogs` at the Journal with topics `[Inscribed, collection, id]`
  (`n` as the fourth topic picks one memory); the log's data is
  `(kind, author, epoch, ref, root, body)`. A reader that wants to check the
  archive folds the logs in order and compares with `rootOf`
  (`tools/verify-journal.mjs` `fold`). There is no back-link, so a lane that
  must walk in single-block queries needs an additive change (a stored
  `last` block per page, packable with the count at no extra store, and a
  second event carrying the previous memory's block) — W8's decision, not
  built here. A sealed memory is sealed with `engine/whispers.mjs`
  `encryptWhisper(["intact-journal/1", chainId, hub, journal, id, epoch,
  keyVersion], plaintext, key, key)` after re-reading the author's key from
  the KeyRegistry (plaintext ≤ 1,024 B, envelope ≤ 4,096 B; the module
  enforces both). A TRADE memory is marked "same transaction" only when the
  receipt that carries `Inscribed` also carries the swap its `ref` names.
- **The hub derives a Reach for every id**, so `mayInscribe(HUB, id,
  account(id))` is true for an unminted token. Nothing can send from that
  address (a Reach whose token has no holder refuses every signer); a page
  should ask `mayInscribe` with the connected wallet or the Reach of a token
  it has read `ownerOf` for.
- **W1 Keepsake.** A keepsake is an ERC-721, so it has a journal of its own:
  the recipient (its holder) writes into `(Keepsake, id)`; the giver writes
  in their own token's journal with `ref = keccak(Keepsake, id)`. IKeepsake
  declares no `custodyEpoch`, so a keepsake's memories carry epoch 0 unless
  the contract answers one.
- **W4 Studio collections** answer `custodyEpoch(uint256)` (ICollection), so
  their memories carry their epoch with no change here. Their templates'
  `{{memories}}` hole is `Journal.countOf(this, id)` (ICollection): the same
  one-slot read as `rootOf`, a view that never reverts for any
  `(collection, id)`; read it guarded all the same, so a band with no
  Journal prints 0.
- **The batch shape.** `[swapAndWrap, inscribe]` through `Reach.executeBatch`
  works as is: the Reach writes for its token, and two Journal calls in one
  transaction both land (the lock is released between them, J7).

## A note on the shared scratchpad

The session's scratchpad directory is shared by every wave-1 unit. W2's
first mutation run (05:18–05:42) wrote `scratchpad/mutations.json` and
`scratchpad/mutations.log`, the same names W1's Keepsake gate uses, and the
two runs overwrote each other: W2's per-mutation record was clobbered (its
verdicts survived — 38 killed, 0 survived, 2 refused as ambiguous — and
the whole gate was re-run for the table above), and W1's record may have been overwritten by
W2's after-every-mutation writes in that window. W1's mutation evidence
should be re-read from a run that wrote only to its own files. Every W2
file since lives in `scratchpad/w2-journal/`.
