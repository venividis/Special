# W4 — the Studio and the Collection (V2 wave 1)

Unit W4 of V2 wave 1 (docs/V2.md §3.4, §5; `src/interfaces/IStudio.sol`,
`src/interfaces/ICollection.sol`). Built on b676ee0, 2026-10-19.

## 1. What was built

| File | What it is |
|---|---|
| `src/Studio.sol` | `launch(creator, spec, salt)` from a token, at a CREATE3 address of (Studio, creator, salt); the bounds; the registry (`isCollection`, `parentOf`, `collectionAt`, `collectionsOf`) |
| `src/Collection.sol` | the ERC-721 whose every token is a website: mint with a referral, pull claims to personas, ERC-2981, the custody epoch, `tokenURI` built on chain from two SSTORE2 templates |
| `src/lib/Template.sol` | the hole filler: exact match on the twelve ICollection names, one word-at-a-time scan, returns the count it filled |
| `test/Studio.t.sol` | 21 tests: who may launch, where it lands, every bound at both sides, the registry, the lineage |
| `test/Collection.t.sol` | 29 tests (25 on the Collection, 4 on the filler, one of them a fuzz against a byte-by-byte reference) |
| `test/mocks/StudioFixtures.sol` | the hub as lib/Persona reads it, any other ERC-721, accounts, three journals, a re-entrant payee, the filler probe, a base64 decoder |
| `tools/verify-studio.mjs` | the journey on the real site, Chromium included, and the gas; it carries the default site template (`sitePage`) |

Neither contract has an owner, an admin, a fee, a pause, a setter or an
upgrade. The Studio is not payable and holds nothing after `launch`; a
Collection's ether leaves only through `claim`, to a persona's payee.

## 2. Decisions, each with its reason

**The CREATE3 hop lives in the Studio, ungated.** `launch` CREATE2s
lib/Create3Factory's sixteen-byte proxy under `keccak256(abi.encode(creator,
salt))`, and the proxy CREATEs the Collection at its nonce 1, so the address
is a function of (Studio, creator, salt) alone and a "mint yours" link can
be shared before the launch is mined. Create3Factory gates `deploy` to its
deployer and the Timelock because the hub pins CREATE3 predictions of
codeless satellites under public salts: the first stranger to deploy under
`intact.v1.market` would have become the hub's market. A permissionless
Studio does not have that problem, for two reasons. The salt is namespaced
by the creator persona before it is hashed, and only whoever acts for that
persona can launch under it, so a stranger can spend salts only in the
namespaces of tokens it acts for: nobody can occupy, or burn, an address
someone else predicted. And nothing trusts a prediction before it lands:
`isCollection` is written by `launch` alone, and the code at every address
the Studio fills is the Collection's creation code, which the constructor
wrote once and nothing can replace. Mutation S21 (drop the creator from the
salt) is killed by two tests, which is the namespace proved.

**The Collection's creation code is an SSTORE2 shard the Studio's constructor
writes.** A factory that embeds its child's creation code in its runtime is
as large as the child. `type(Collection).creationCode` appears only in the
constructor, so it lives in the Studio's initcode (24,672 B, under EIP-3860's
49,152) and is written once as code (`CODE`, 17,013 B + the STOP byte, one
shard); `CODE_HASH` is its keccak for a reader to pin. `launch` reads it back
and appends the constructor's arguments. The alternative, a shard deployed
beside the Studio and pinned by codehash, needs a hash written into the
deployment that changes with every compile; the constructor-written shard
is the same bytes with nothing to keep in step. Embedding the creation code
in the runtime instead would add its 17,013 bytes to the Studio's 7,067 —
24,080 B by arithmetic (not built), 496 B from EIP-170 — so almost any
growth of the Collection would have broken the Studio.

**The templates are written by the Studio and handed over as pointers.**
Passing the page and the art as constructor arguments would put up to
17,013 + 24,000 + 12,000 bytes of initcode in front of the proxy's CREATE,
past EIP-3860's 49,152, and the CREATE would fail. The Studio writes both as
SSTORE2 code first; the Collection keeps two immutable pointers.

**A template holds at most 256 holes (`MAX_HOLES`, refused as `BadPage` /
`BadArt`).** ICollection's struct comment bounds the bytes only. A hole is at
most 14 bytes and prints up to 78 (`{{room}}`: 8 bytes, a 78-digit key), and
`tokenURI` base64s the filled page inside base64 JSON, so the bytes alone
do not bound the render. Measured by `tools/verify-studio.mjs` on this
tree: a Collection deployed directly with the largest templates holding
3,000 and 1,500 holes renders for 38,299,335 gas, 2.3× the 2^24 cap an
eth_call may be held to; at 256 holes in each the worst admitted render is
4,782,590 gas. The count is lib/Template's own (`fill` returns how many it
filled), so the Studio counts with the matcher the Collection renders with.
This is a bound the frozen comment does not carry; §6 asks for it.

**The window's opening is the later of `opensAt` and the launch.** "closesAt
0 or > the opening": with `opensAt` 0 the opening is now; with `opensAt` in
the past it is also now. A collection that would be born closed is refused.

**The referral rule is exactly the decided one.** The share goes to `via`
when `payeeOf(HUB, via)` is neither zero, the minter nor the recipient, and
the rest to the creator, so every wei is owed to someone (asserted). It is a
filter against the obvious self-referral, not a sybil defence: a minter with
a second wallet can refer itself, and a hub token's payee is its Reach, so a
holder whose wallet mints through its own token does earn the share. A
Reach that mints through its own token does not (tested).

**Claims pay the payee of the moment.** `owed` is keyed by persona and the
payee is read at the claim, never stored, so a sale of a token sells what it
is owed and the royalty follows (mutations C19 and C20 store it and are
killed). The console should say so before a creator token is sold: claim
first, or the buyer is paid.

**The custody epoch is stored as moves and read as moves + 1.** The mint
writes nothing for it (a cold slot fewer per mint); an id never minted reads
0, "no epoch", as the hub's does. `_beforeMove` adds one on every transfer,
self-transfers and operator transfers included.

**Values are decimal or lower-case 0x-hex.** `{{id}}`, `{{epoch}}`,
`{{memories}}`, `{{minted}}`, `{{supply}}`, `{{price}}` (wei), `{{creator}}`
(the persona, `collection << 96 | id`), `{{room}}` and `{{chain}}` are
decimal; `{{seed}}`, `{{holder}}` and `{{collection}}` are 0x-hex. None can
contain `<`, `>`, `&`, `"` or `'`, so no value can become markup.

**Metadata strings go through `Web.jsonEsc`,** the house whitelist:
printable ASCII, with `"` `\` `<` `>` `&` escaped. A name with other bytes
renders without them in the JSON; `name()` returns what the creator typed.

**The default orb** is the prototype's sphere, its two hues, radius, orbit
and period drawn from the first five bytes of the seed. The default site
draws the same two hues from `{{seed}}` (`a = byte0 × 360 / 256`,
`b = (a + 60 + byte1 mod 120) mod 360`), which the verifier checks in
Chromium against the image.

**Two additive reads, `pageOf(id)` and `imageOf(id)`,** return the filled
page and art as raw bytes: the console renders a token's site with one
eth_call and no base64, and the suites compare `tokenURI` against them.

**The fixtures carry their own hub.** test/mocks/SocialHub.sol has the reads
lib/Persona needs, but importing it compiles Parley and Postage into every
Studio run; `StudioHub` is the four reads and the two sale rules a payee can
see (the epoch moves, `feesToGrip` clears).

**The Studio's lock is the house rule, not a reachable guard.** Every call
under it is a staticcall (lib/Persona) or the Collection's own constructor,
so nothing can re-enter `launch`, and no test can kill its removal. The
Collection's lock is reachable: `claim` pushes ether, and the payee's attempts
to claim again or to mint inside its payout are refused by it (C25, C26).

## 3. Sizes, gas and counts (measured)

Sizes, `node tools/compile.mjs` in the worktree (2026-10-19, 219 s cold,
"all gated contracts fit under the EIP-170 ceiling of 24576 bytes"):

| Contract | Runtime | Creation |
|---|---|---|
| `Collection` | 14,688 B (60 % of EIP-170) | 17,013 B (one SSTORE2 shard) |
| `Studio` | 7,067 B (29 %) | 24,672 B (50 % of EIP-3860) |

Gas, `node tools/verify-studio.mjs` on this tree (47 passed, 0 failed),
real site (`deploySite`, the diamond), every transaction asserted under the
2^24 cap by tools/evm.mjs:

| What | Gas |
|---|---|
| deploy the Studio (writes the Collection's code) | 5,280,919 |
| launch Moonlit (the 2,903-byte default site, default orb) | 4,053,801 |
| **launch with a 24,000-byte page** | **8,848,516** |
| launch the worst admitted (24,000 B page + 12,000 B art, 256 `{{room}}` each) | 12,113,698 |
| **mint** — first of a collection / later / referred (first) | **160,914** / 126,714 / 204,738 |
| claim (a referral share to a hub token's Reach) | 57,628 |
| **tokenURI eth_call** — Moonlit #1 / the 24,000-byte page | **382,484** / **1,513,149** |
| tokenURI, the worst admitted templates | 4,782,590 |
| tokenURI, the same templates unbounded (3,000 + 1,500 holes; the Studio refuses them) | 38,299,335 |

Counts, `node tools/forge.mjs` in the pruned copy (`/tmp/v2-studio`), on
the unmutated sources after the mutation gate: `--match Studio.t.sol`
21 passed, 0 failed; `--match Collection.t.sol` 29 passed, 0 failed (the
fuzz at 24 runs). `node tools/static-audit.mjs` in the worktree: "static
audit passed — 10 Solidity rules, 4 JS rules".

## 4. The mutation table

Applied only in the pruned copy (`/tmp/v2-studio`: `src/interfaces`,
`src/lib`, the two contracts, the two suites and the fixtures), one row at
a time: the mutation is written over the copy's source, `node
tools/forge.mjs --match <slice>` runs the named tests (one cold viaIR
compile per row, 82–153 s on the shared machine), the file is restored in a
`finally` (and on SIGINT/SIGTERM), and the run ends by proving every file
equals the worktree's by sha256. The run read **71 rows: 70 killed, 0
survived, 0 not mutations, 1 equivalent (predicted, not gated); restored:
every file equals the worktree's**. Two corrections went into that number,
both reruns of the same rows: C27–C29 first matched no test (the slice was
`EveryHole`, the test is `test_everyHoleIsFilled…`, and `--match` is
case-sensitive); and the first T3, the brace finder under-counting by one,
ended after 38 s having printed no test line, before the runner kept each
row's output, so why is not known. Re-run with its output saved, the same
mutation ran its six tests and passed them all; it is T3u below, and the
gated T3 is now the over-count, which is the direction that can fail.

Every guard named for W4 is a row: actsFor (S1, S2), each bound at each
side (S3–S19), SaltUsed (S20), predict (S21, S22), the window at both ends
(C1–C3), SoldOut (C4), WrongPrice (C5), WalletLimit (C6–C8), the split and
the self-referral rule (C9–C13), the payee of a claim and its move on a
sale (C14–C19), the royalty (C20, C21), the custody epoch (C22–C24), and
each of the twelve holes (H1–H12, with C27–C29 on the values). The rest
are the lineage, the lock, the guarded Journal read, the room, the seed,
the filler's two ends and its brace finder (S23, C25, C26, C30–C32, T1–T3).

Two things no row can reach, and why. T3u survives because it is
equivalent: an offset counted one short stops the copy one byte before the
brace, and the next step, reading from that byte, finds the brace at offset
1, so the output and the count are the same bytes and only gas differs (its
log: 6 passed, 0 failed). And the seed's `- 1` in
`blockhash(block.number - 1)`: both harnesses run a mock chain whose every
block hash is zero, so the previous block and the current one read alike;
C32, which drops the hash, is killed, and the `- 1` is a hardhat rehearsal
check (§7). The Studio's lock is not a row for the reason in §2.

| # | Guard | Mutation | Killed by |
|---|---|---|---|
| S1 | actsFor on launch: a non-holder is refused | Studio: `if (!Persona.actsFor(HUB, creator, msg.sender)) revert NotYours();` → `if (false) revert NotYours();` | `test_aStrangerCannotLaunchFromSomeoneElsesToken` |
| S2 | actsFor on launch: a hub token's Reach may launch | Studio: `if (!Persona.actsFor(HUB, creator, msg.sender)) revert NotYours();` → `if (Persona.holderOf(creator) != msg.sender) revert NotYours();` | `test_theReachMayLaunchForItsToken` |
| S3 | name: at least one byte | Studio: `if (n == 0 \|\| n > MAX_NAME) revert BadName();` → `if (n > MAX_NAME) revert BadName();` | `test_theNameIsOneToFortyEightBytes` |
| S4 | name: at most 48 bytes | Studio: `n > MAX_NAME` → `n >= MAX_NAME` | `test_theNameIsOneToFortyEightBytes` |
| S5 | symbol: at least one byte | Studio: `if (n == 0 \|\| n > MAX_SYMBOL) revert BadSymbol();` → `if (n > MAX_SYMBOL) revert BadSymbol();` | `test_theSymbolIsOneToTwelveBytes` |
| S6 | symbol: at most 12 bytes | Studio: `n > MAX_SYMBOL` → `n >= MAX_SYMBOL` | `test_theSymbolIsOneToTwelveBytes` |
| S7 | description: at most 1,024 bytes | Studio: `length > MAX_DESCRIPTION` → `length >= MAX_DESCRIPTION` | `test_theDescriptionIsAtMostOneThousandAndTwentyFourBytes` |
| S8 | supply: at least one | Studio: `if (spec.supply == 0 \|\| spec.supply > MAX_SUPPLY)` → `if (spec.supply > MAX_SUPPLY)` | `test_theSupplyIsOneToOneMillion` |
| S9 | supply: at most 1,000,000 | Studio: `spec.supply > MAX_SUPPLY` → `spec.supply >= MAX_SUPPLY` | `test_theSupplyIsOneToOneMillion` |
| S10 | window: the close is after the opening, not at it | Studio: `spec.closesAt <= opening` → `spec.closesAt < opening` | `test_theWindowMustCloseAfterItOpens` |
| S11 | window: the opening is the later of opensAt and now | Studio: `uint256 opening = spec.opensAt > block.timestamp ? spec.opensAt : block.timestamp;` → `uint256 opening = block.timestamp;` | `test_theWindowMustCloseAfterItOpens` |
| S12 | window: closesAt 0 is never | Studio: `if (spec.closesAt != 0 && spec.closesAt <= opening)` → `if (spec.closesAt <= opening)` | `test_theWindowMustCloseAfterItOpens` |
| S13 | referral share: at most 2,000 bps | Studio: `spec.referralBps > MAX_REFERRAL_BPS` → `spec.referralBps >= MAX_REFERRAL_BPS` | `test_theReferralShareIsAtMostTwoThousandBasisPoints` |
| S14 | royalty: at most 1,000 bps | Studio: `spec.royaltyBps > MAX_ROYALTY_BPS` → `spec.royaltyBps >= MAX_ROYALTY_BPS` | `test_theRoyaltyIsAtMostOneThousandBasisPoints` |
| S15 | page: at least one byte | Studio: `if (n == 0 \|\| n > MAX_PAGE \|\|` → `if (n > MAX_PAGE \|\|` | `test_thePageIsOneToTwentyFourThousandBytes` |
| S16 | page: at most 24,000 bytes | Studio: `n > MAX_PAGE` → `n >= MAX_PAGE` | `test_thePageIsOneToTwentyFourThousandBytes` |
| S17 | page: at most 256 holes | Studio: `_holes(spec.page) > MAX_HOLES` → `_holes(spec.page) >= MAX_HOLES` | `test_aTemplateHoldsAtMostTwoHundredFiftySixHoles` |
| S18 | art: at most 12,000 bytes | Studio: `spec.art.length > MAX_ART` → `spec.art.length >= MAX_ART` | `test_theArtIsAtMostTwelveThousandBytes` |
| S19 | art: at most 256 holes | Studio: `_holes(spec.art) > MAX_HOLES` → `_holes(spec.art) >= MAX_HOLES` | `test_aTemplateHoldsAtMostTwoHundredFiftySixHoles` |
| S20 | SaltUsed: a spent salt is refused by name | Studio: `if (collection.code.length != 0) revert SaltUsed(collection);` deleted | `test_aSaltIsSpentOncePerCreator` |
| S21 | the salt is namespaced by the creator persona | Studio: `return keccak256(abi.encode(creator, salt));` → `return keccak256(abi.encode(salt));` | `test_aSaltIsSpentOncePerCreator`, `test_theCollectionLandsWherePredictSaid` |
| S22 | predict equals the deployed address | Studio: `abi.encodePacked(hex"d694", proxy, hex"01")` → `abi.encodePacked(hex"d694", proxy, hex"02")` | `test_theCollectionLandsWherePredictSaid` |
| S23 | lineage: parentOf is the creator's collection | Studio: `parentOf[collection] = parent;` deleted | `test_aTokenOfAStudioCollectionLaunchesAChild` |
| C1 | window: open at its first second | Collection: `if (block.timestamp < OPENS)` → `if (block.timestamp <= OPENS)` | `test_theWindowIsOpenFromItsFirstSecondToBeforeItsLast` |
| C2 | window: closed at its closing second | Collection: `block.timestamp >= CLOSES` → `block.timestamp > CLOSES` | `test_theWindowIsOpenFromItsFirstSecondToBeforeItsLast` |
| C3 | window: closesAt 0 never closes | Collection: `if (CLOSES != 0 && block.timestamp >= CLOSES)` → `if (block.timestamp >= CLOSES)` | `test_aCollectionWithNoWindowIsAlwaysOpen` |
| C4 | SoldOut at supply | Collection: `if (_minted >= SUPPLY)` → `if (_minted > SUPPLY)` | `test_theSupplyIsACap` |
| C5 | WrongPrice is exact | Collection: `if (msg.value != PRICE)` → `if (msg.value < PRICE)` | `test_aWrongPriceIsRefusedWithBothNumbers` |
| C6 | WalletLimit at the limit | Collection: `count >= PER_WALLET` → `count > PER_WALLET` | `test_theWalletLimitCountsTheMinterNotTheRecipient` |
| C7 | WalletLimit counts the minter | Collection: `mintedBy[msg.sender] = count + 1;` → `mintedBy[to] = count + 1;` | `test_theWalletLimitCountsTheMinterNotTheRecipient` |
| C8 | WalletLimit: perWallet 0 is no limit | Collection: `if (PER_WALLET != 0 && count >= PER_WALLET)` → `if (count >= PER_WALLET)` | `test_theWalletLimitCountsTheMinterNotTheRecipient` |
| C9 | self-referral: not the minter's payee | Collection: `if (payee != address(0) && payee != msg.sender && payee != to)` → `if (payee != address(0) && payee != to)` | `test_aReferralToTheMinterOrTheRecipientStaysWithTheCreator` |
| C10 | self-referral: not the recipient's payee | Collection: `if (payee != address(0) && payee != msg.sender && payee != to)` → `if (payee != address(0) && payee != msg.sender)` | `test_aReferralToTheMinterOrTheRecipientStaysWithTheCreator` |
| C11 | referral: a persona with no payee earns nothing | Collection: `if (payee != address(0) && payee != msg.sender && payee != to)` → `if (payee != msg.sender && payee != to)` | `test_aReferralToTheMinterOrTheRecipientStaysWithTheCreator` |
| C12 | split: the creator is owed the price less the share | Collection: `owed[CREATOR] += PRICE - share;` → `owed[CREATOR] += PRICE;` | `test_aReferralIsOwedItsShareAndTheCreatorTheRest` |
| C13 | split: the share is price x referralBps / 10,000 | Collection: `SHARE = uint256(i.price) * i.referralBps / 10_000;` → `SHARE = uint256(i.price) * i.referralBps / 1_000;` | `test_aReferralIsOwedItsShareAndTheCreatorTheRest` |
| C14 | claim pays the payee, never the caller | Collection: `address payee = Persona.payeeOf(HUB, persona);` → `address payee = msg.sender;` | `test_claimPaysThePayeeWhoeverAsks` |
| C15 | claim pays a hub token's fee sink (the hub's rules) | Collection: `address payee = Persona.payeeOf(HUB, persona);` → `address payee = Persona.payeeOf(address(0), persona);` | `test_aSaleOfTheCreatorTokenMovesThePayee`, `test_claimPaysThePayeeWhoeverAsks` |
| C16 | NoPayee: nobody to pay is refused | Collection: `if (payee == address(0)) revert NoPayee(persona);` deleted | `test_claimRefusesAPersonaWithNoPayee` |
| C17 | a claim clears the debt before the push | Collection: `owed[persona] = 0;` deleted | `test_claimPaysThePayeeWhoeverAsks` |
| C18 | TransferFailed on a refused push | Collection: `if (!ok) revert TransferFailed();` deleted | `test_aRefusedPushFailsTheClaimAndKeepsTheDebt` |
| C19 | a sale of the creator token moves the payee (read at the claim, never stored) | Collection: `address payee = Persona.payeeOf(HUB, persona);` → `address payee = persona == CREATOR ? PAYEE0 : Persona.payeeOf(HUB, persona);` — plus an immutable `PAYEE0 = payeeOf(creator)` taken in the constructor | `test_aSaleOfTheCreatorTokenMovesThePayee` |
| C20 | royalty names the payee of the moment | Collection: `receiver = Persona.payeeOf(HUB, CREATOR);` → `receiver = PAYEE0;` — plus an immutable `PAYEE0 = payeeOf(creator)` taken in the constructor | `test_royaltyNamesTheCreatorsPayeeWhenAsked` |
| C21 | royalty is salePrice x royaltyBps / 10,000 | Collection: `royaltyAmount = salePrice * ROYALTY_BPS / 10_000;` → `royaltyAmount = salePrice * REFERRAL_BPS / 10_000;` | `test_royaltyNamesTheCreatorsPayeeWhenAsked` |
| C22 | the custody epoch moves on a transfer | Collection: `unchecked { ++_moves[id]; }` → `unchecked { _moves[id] += 0; }` | `test_theCustodyEpochIsOneAtMintAndMovesOnEveryTransfer` |
| C23 | the custody epoch does not move at the mint | Collection: `if (from != address(0)) {` → `if (from == from) {` | `test_theCustodyEpochIsOneAtMintAndMovesOnEveryTransfer` |
| C24 | the custody epoch is 1 at mint | Collection: `return _exists(id) ? _moves[id] + 1 : 0;` → `return _exists(id) ? _moves[id] : 0;` | `test_theCustodyEpochIsOneAtMintAndMovesOnEveryTransfer` |
| C25 | the lock: no claim inside a payout | Collection: `Transient.enter(Transient.COLLECTION_LOCK); amount = owed[persona];` → `amount = owed[persona];` | `test_aPayeeCannotReenterFromItsOwnPayout` |
| C26 | the lock: no mint inside a payout | Collection: `Transient.enter(Transient.COLLECTION_LOCK); if (block.timestamp < OPENS)` → `if (block.timestamp < OPENS)` | `test_aPayeeCannotReenterFromItsOwnPayout` |
| C27 | {{epoch}} is the custody epoch | Collection: `v.epoch = bytes(epoch.str());` → `v.epoch = bytes(uint256(1).str());` | `test_everyHoleIsFilledWithTheChainsValue` |
| C28 | {{memories}} is the Journal's count | Collection: `v.memories = bytes(memories.str());` → `v.memories = bytes(uint256(0).str());` | `test_everyHoleIsFilledWithTheChainsValue` |
| C29 | {{holder}} is the holder | Collection: `v.holder = bytes(LibNum.hexAddr(holder));` → `v.holder = bytes(LibNum.hexAddr(address(this)));` | `test_everyHoleIsFilledWithTheChainsValue` |
| C30 | the memory read is guarded: a short answer is none | Collection: `if (ok && ret.length >= 32) n =` → `if (ok) n =` | `test_theMemoriesAreTheJournalsCountOrNone` |
| C31 | the room is Agora's collectionKey | Collection: `abi.encodePacked(uint8(4), address(this))` → `abi.encodePacked(uint8(3), address(this))` | `test_theRoomIsAgorasCollectionKey` |
| C32 | the seed binds the previous block's hash | Collection: `keccak256(abi.encode(address(this), id, blockhash(block.number - 1)))` → `keccak256(abi.encode(address(this), id))` | `test_theSeedIsTheCollectionTheIdAndThePreviousBlock` |
| H1 | {{id}} is filled with its own value | Template: `if named(w, rem, 6, "{{id}}") { h := 0 l := 6 }` → `if named(w, rem, 6, "{{id}}") { h := 1 l := 6 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H2 | {{seed}} is filled with its own value | Template: `if named(w, rem, 8, "{{seed}}") { h := 1 l := 8 }` → `if named(w, rem, 8, "{{seed}}") { h := 2 l := 8 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H3 | {{holder}} is filled with its own value | Template: `if named(w, rem, 10, "{{holder}}") { h := 2 l := 10 }` → `if named(w, rem, 10, "{{holder}}") { h := 3 l := 10 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H4 | {{epoch}} is filled with its own value | Template: `if named(w, rem, 9, "{{epoch}}") { h := 3 l := 9 }` → `if named(w, rem, 9, "{{epoch}}") { h := 4 l := 9 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H5 | {{memories}} is filled with its own value | Template: `if named(w, rem, 12, "{{memories}}") { h := 4 l := 12 }` → `if named(w, rem, 12, "{{memories}}") { h := 5 l := 12 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H6 | {{minted}} is filled with its own value | Template: `if named(w, rem, 10, "{{minted}}") { h := 5 l := 10 }` → `if named(w, rem, 10, "{{minted}}") { h := 6 l := 10 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H7 | {{supply}} is filled with its own value | Template: `if named(w, rem, 10, "{{supply}}") { h := 6 l := 10 }` → `if named(w, rem, 10, "{{supply}}") { h := 7 l := 10 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H8 | {{price}} is filled with its own value | Template: `if named(w, rem, 9, "{{price}}") { h := 7 l := 9 }` → `if named(w, rem, 9, "{{price}}") { h := 8 l := 9 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H9 | {{collection}} is filled with its own value | Template: `if named(w, rem, 14, "{{collection}}") { h := 8 l := 14 }` → `if named(w, rem, 14, "{{collection}}") { h := 9 l := 14 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H10 | {{creator}} is filled with its own value | Template: `if named(w, rem, 11, "{{creator}}") { h := 9 l := 11 }` → `if named(w, rem, 11, "{{creator}}") { h := 10 l := 11 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H11 | {{room}} is filled with its own value | Template: `if named(w, rem, 8, "{{room}}") { h := 10 l := 8 }` → `if named(w, rem, 8, "{{room}}") { h := 11 l := 8 }` | `test_aHoleIsAnExactName`, `test_everyHoleIsFilledWithTheChainsValue` |
| H12 | {{chain}} is filled with its own value | Template: `if named(w, rem, 9, "{{chain}}") { h := 11 l := 9 }` → `if named(w, rem, 9, "{{chain}}") { h := 0 l := 9 }` | `test_aHoleIsAnExactName` |
| T1 | a hole cut short by the template's end is text | Template: `r := and(iszero(gt(len, rem)), eq(and(w, not(shr(mul(8, len), not(0)))), lit))` → `r := eq(and(w, not(shr(mul(8, len), not(0)))), lit)` | `test_aHoleCutShortByTheEndIsText` |
| T2 | no brace past the template's end is read | Template: `m := and(m, not(shr(mul(8, rem), not(0))))` deleted | `test_aHoleCutShortByTheEndIsText` |
| T3 | the first brace of a word is never skipped | Template: `if iszero(shr(192, m)) { k := add(k, 8) m := shl(64, m) }` → `if iszero(shr(192, m)) { k := add(k, 9) m := shl(64, m) }` | `test_theFillerAgreesWithTheSlowReading` |
| T3u | an under-counted brace is found one step later | Template: `if iszero(shr(192, m)) { k := add(k, 8) m := shl(64, m) }` → `if iszero(shr(192, m)) { k := add(k, 7) m := shl(64, m) }` | survives, as predicted: equivalent (same bytes out; only gas differs) — not gated |

H12 is killed by the filler's own suite and not by the Collection's: on
the harness `block.chainid` is 1 and so is the id, so `{{chain}}` filled
with the id reads the same there. T3 is killed by the fuzz alone, because a
skipped lone `{` is copied as text either way; only a skipped brace that
opens a hole changes the output.

## 5. Proposed INVARIANTS rows

Each cites a test that exists in the named file, or a sentence printed by
`tools/verify-studio.mjs` (the gas sentences are template literals: only
the `${…}` holes differ run to run). Status for all: **pending (W4)** until
`verify:studio` and the two suites run in `npm run check`.

| # | Invariant | Enforced by |
|---|---|---|
| ST1 | Only whoever acts for the creator persona launches: a hub token's holder or canonical Reach (never its Grip, another token's Reach or a stranger), any other ERC-721's holder | `test/Studio.t.sol` · `test_aStrangerCannotLaunchFromSomeoneElsesToken`, `test_theReachMayLaunchForItsToken`, `test_anyERC721TokenMayLaunch`; `tools/verify-studio.mjs` · *"bob, who does not hold #1, cannot launch from it"*, *"#1's canonical Reach, driven by its holder through execute, launches for #1 on the real hub"* |
| ST2 | A collection lands at `predict(creator, salt)`, CREATE3 under `keccak256(abi.encode(creator, salt))`, whatever the spec; a salt is spent once per creator and is fresh in every other creator's namespace | `test/Studio.t.sol` · `test_theCollectionLandsWherePredictSaid`, `test_aSaltIsSpentOncePerCreator`; `tools/verify-studio.mjs` · *"Moonlit lands at the address predict named before the launch"*, *"the same salt cannot be launched twice"* |
| ST3 | Every bound of the spec is refused by name, at both sides: name 1..48, symbol 1..12, description ≤ 1,024, supply 1..1,000,000, a close after the opening, referral ≤ 2,000 bps, royalty ≤ 1,000 bps, page 1..24,000, art ≤ 12,000, ≤ 256 holes in each template | `test/Studio.t.sol` · `test_theNameIsOneToFortyEightBytes`, `test_theSymbolIsOneToTwelveBytes`, `test_theDescriptionIsAtMostOneThousandAndTwentyFourBytes`, `test_theSupplyIsOneToOneMillion`, `test_theWindowMustCloseAfterItOpens`, `test_theReferralShareIsAtMostTwoThousandBasisPoints`, `test_theRoyaltyIsAtMostOneThousandBasisPoints`, `test_thePageIsOneToTwentyFourThousandBytes`, `test_theArtIsAtMostTwelveThousandBytes`, `test_aTemplateHoldsAtMostTwoHundredFiftySixHoles` |
| ST4 | The Studio holds nothing and takes no ether; its one asset is the Collection's creation code, written once | `test/Studio.t.sol` · `test_theStudioHoldsNothing`; `tools/verify-studio.mjs` · *"the Studio holds nothing after the launch"*, *"the Collection's creation code is held as one SSTORE2 shard, and CODE_HASH is its keccak"* |
| ST5 | Lineage: `parentOf` is the creator persona's collection, the hub included | `test/Studio.t.sol` · `test_aTokenOfAStudioCollectionLaunchesAChild`; `tools/verify-studio.mjs` · *"and parentOf names Moonlit: the family tree is on chain"* |
| ST6 | Every admitted spec launches in one transaction and renders far under the 2^24 cap; the unbounded templates would not | `test/Collection.t.sol` · `test_theLargestTemplatesRenderFarUnderTheCap`; `tools/verify-studio.mjs` · *"the worst template the Studio admits (256 of the widest hole in a 24,000-byte page and a 12,000-byte art): launch ${…}, tokenURI ${…}"*, *"without the bound, the same templates holding 3,000 and 1,500 holes cost ${…} gas to render: past the 2^24 cap, which is why the Studio refuses them"* |
| CL1 | A mint pays exactly the price, inside its window (open at `opensAt`, closed at `closesAt`, 0 never), under the supply and the minter's `perWallet`; ids count from 1 | `test/Collection.t.sol` · `test_mintsCountFromOneAtExactlyThePrice`, `test_aWrongPriceIsRefusedWithBothNumbers`, `test_theWindowIsOpenFromItsFirstSecondToBeforeItsLast`, `test_aCollectionWithNoWindowIsAlwaysOpen`, `test_theSupplyIsACap`, `test_theWalletLimitCountsTheMinterNotTheRecipient`, `test_aZeroRecipientIsRefused` |
| CL2 | A referral share is owed to `via` only when its payee is neither zero, the minter nor the recipient; the rest is owed to the creator; every wei the collection holds is owed to a persona | `test/Collection.t.sol` · `test_aReferralIsOwedItsShareAndTheCreatorTheRest`, `test_aReferralToTheMinterOrTheRecipientStaysWithTheCreator`; `tools/verify-studio.mjs` · *"#2 is owed price × referralBps / 10,000 and #1 the rest"* |
| CL3 | `claim` is anyone's and pays only the persona's payee; nobody to pay is `NoPayee`, a refused push is `TransferFailed` and keeps the debt | `test/Collection.t.sol` · `test_claimPaysThePayeeWhoeverAsks`, `test_claimRefusesAPersonaWithNoPayee`, `test_aRefusedPushFailsTheClaimAndKeepsTheDebt`; `tools/verify-studio.mjs` · *"a stranger's claim pays the share to #2's fee sink (its Reach), not to the stranger"* |
| CL4 | The money follows the token: the claim's and the royalty's payee is read when asked, so a sale of the creator token moves both | `test/Collection.t.sol` · `test_aSaleOfTheCreatorTokenMovesThePayee`, `test_royaltyNamesTheCreatorsPayeeWhenAsked`; `tools/verify-studio.mjs` · *"after the sale royaltyInfo names the fee sink the buyer now holds: the Reach, since a sale clears the Grip route"*, *"and the creator's proceeds follow the token: a claim after the sale pays #1's Reach, the buyer's"* |
| CL5 | One lock covers mint and claim: a payee can neither claim nor mint inside its own payout | `test/Collection.t.sol` · `test_aPayeeCannotReenterFromItsOwnPayout` |
| CL6 | The custody epoch is 1 at mint, moves by one on every transfer (self and operator transfers included) and is 0 for an id never minted | `test/Collection.t.sol` · `test_theCustodyEpochIsOneAtMintAndMovesOnEveryTransfer` |
| CL7 | Every hole is replaced by exact match with the chain's ASCII value and nothing else is touched: near-misses, braces in CSS and a hole the template's end cuts short are text | `test/Collection.t.sol` · `test_everyHoleIsFilledWithTheChainsValue`, `test_aHoleIsAnExactName`, `test_aHoleCutShortByTheEndIsText`, `test_aLongTemplateIsCopiedWordForWord`, `test_theFillerAgreesWithTheSlowReading`; `tools/verify-studio.mjs` · *"and every hole holds the chain's value: id, seed, holder, epoch, memories, minted, supply, price, collection, creator, room, chain"* |
| CL8 | `tokenURI` is base64 JSON whose `animation_url` is the filled page and whose `image` is the filled art or the seed's orb; creator strings are JSON-escaped | `test/Collection.t.sol` · `test_tokenURIIsTheJSONOfTheFilledPageAndArt`, `test_metadataEscapesWhatTheCreatorTyped`, `test_noArtMeansTheDefaultOrb`; `tools/verify-studio.mjs` · *"animation_url decodes to the filled page, byte for byte the collection's pageOf(1)"* |
| CL9 | The default site reads in a sandboxed iframe with no wallet and no network, and cannot reach the page that embeds it | `tools/verify-studio.mjs` · *"the page renders: the art large, '#1 of 100', the holder, the memories and the room"*, *"'mint yours' names this token's persona as the via, computed in the page from {{collection}} and {{id}}"*, *"with no wallet in the frame, and the frame cannot reach the page that embeds it"*, *"and it asked the network for nothing"* |
| CL10 | The room is Agora's `collectionKey(this)`; `{{memories}}` is the Journal's count, and a codeless, reverting or silent Journal reads 0 | `test/Collection.t.sol` · `test_theRoomIsAgorasCollectionKey`, `test_theMemoriesAreTheJournalsCountOrNone`; `tools/verify-studio.mjs` · *"the room is Agora's collectionKey: keccak256(abi.encodePacked(uint8(4), collection))"* |

## 6. Requests for frozen files

1. **`src/interfaces/ICollection.sol`, the struct comment** — add the hole
   bound to `page` and `art`: "≤ 256 holes" (BadPage / BadArt). The Studio
   enforces it (§2, measured); a reader of the frozen comment would not
   know. Comment only, no signature changes.
2. **`docs/INTERFACE-CHANGES.md`** — record W4's additive surface beyond the
   frozen interfaces: on `Collection`, `HUB()`, `JOURNAL()`, `AGORA()`,
   `pageOf(uint256)`, `imageOf(uint256)` and the constructor's
   `CollectionInit`; on `Studio`, `CODE()`, `CODE_HASH()`,
   `PROXY_INITCODE_HASH()`, the ten `MAX_*` constants and
   `error ZeroAddress()`. `ICollection` could gain `pageOf`/`imageOf` in a
   later additive row if the Gallery wants them through the interface.
3. **`src/interfaces/IStudio.sol`** — `error SaltUsed(address at)`: solc
   warns that `at` "will be promoted to keyword in the future". Renaming the
   parameter to `collection` keeps the selector (`SaltUsed(address)`) and
   saves the file from a future compiler. ABI-neutral.
4. **`tools/check.mjs`** (wave 3) — a `verify:studio` step: `node
   tools/verify-studio.mjs`, summary `  N passed, M failed`; it needs
   `dist/shards.json` (build) and Chromium, both already in the battery.
5. **`docs/INVARIANTS.md`** (wave 3) — the rows in §5.

## 7. What later waves must know

- **Constructor.** `Studio(hub, journal, agora)`: the hub is required
  (`ZeroAddress`); the Journal and Agora may be codeless until they land
  (memories read 0; the room is a key, no call). A Collection is deployed
  only by a Studio: its constructor takes `CollectionInit`.
- **Deployment order.** Agora pins `STUDIO()` and the Studio pins `AGORA`:
  deploy both at CREATE3 predictions (lib/Create3Factory, by the burner or
  through the Timelock) so each constructor takes the other's address
  before it exists. The Journal likewise. The Studio's deployment is one
  transaction of 5,280,919 gas with 24,672 bytes of initcode.
- **Agora (W5).** `isRegistered(c)` should answer `IStudio(STUDIO).isCollection(c)`
  (and the hub); a collection room's speakers are its holders by `holds`;
  `collectionKey(c)` must stay `uint256(keccak256(abi.encodePacked(uint8(4), c)))`,
  which every Collection computes and prints as `{{room}}` without a call.
- **Journal (W2).** The Collection reads `countOf(address,uint256)` by
  extcodesize and a staticcall; `custodyEpoch(uint256)` answers the
  Journal's epoch stamp (1 at mint, +1 per transfer).
- **The console reads (W12 Studio lane, W8 Gallery).** Before a launch:
  `predict(creator, salt)` (the address a mint link names),
  `MAX_*`. After: `collectionsOf(persona)`, `collectionCount`/`collectionAt`,
  `parentOf` and `Launched` logs (the family tree), `isCollection`. On a
  collection: `spec()`, `totalSupply()`, `mintedBy(address)`,
  `owed(persona)`, `seedOf`, `custodyEpoch`, `room()`, `creator()`,
  `royaltyInfo`, `contractURI()`, `tokenURI`, and `pageOf(id)` / `imageOf(id)`
  for the raw site and art in one eth_call. `Minted(id, to, via, paid,
  referral)` carries the referral (zero when the rule withheld it);
  `Claimed(persona, payee, amount)`.
- **The mint link.** `?via=<persona>` is decimal, `collection << 96 | id`;
  the default site computes it in the page and prints it.
- **A predicted address is the token's, not the sharer's.** If the creator
  token changes hands before the launch lands, its next holder may launch
  at the same `predict(creator, salt)` with other terms. A page that mints
  from a link reads `spec()` from the chain and shows it before the
  signature; it never trusts terms carried in the link.
- **The default site** is `sitePage(name)` in `tools/verify-studio.mjs`
  (2,903 bytes for "Moonlit"): W12 lifts it into the Studio lane. The
  collection's name is written into it as escaped text before the launch;
  everything else is a hole. It names no host and runs with no network
  (verified in Chromium in a `sandbox="allow-scripts"` iframe).
- **The Catalog rows** go in `CatalogRowsPost.SERVICES` (the MVB table is at
  89 % of the transaction cap), under two new letters — proposed `Z` for the
  Studio and `B` for "a collection", a per-address family like `C` (a coin),
  zero in `byLetter`:
  ```
  launch|Z|launch(uint256,(string,string,string,uint32,uint128,uint64,uint64,uint32,uint16,uint16,bytes,bytes),bytes32)|w|a|the holder or the Reach of the creator token - the address is predict(creator, salt) - name 1..48 symbol 1..12 description <= 1024 supply 1..1000000 referral <= 2000 royalty <= 1000 page 1..24000 art <= 12000 bytes - <= 256 holes per template;
  predict|Z|predict(uint256,bytes32)|r|d|the collection's address before the launch;
  collectionsOf|Z|collectionsOf(uint256)|r|d|every collection a token launched;
  parentOf|Z|parentOf(address)|r|d|the creator token's collection - the family tree;
  isCollection|Z|isCollection(address)|r|d|launched by this Studio;
  mint|B|mint(address,uint256)|p|d|value is the price exactly - via is a persona or 0 - the share is withheld when via's payee is the minter or the recipient;
  claim|B|claim(uint256)|w|d|anyone - pays the persona's payee at the moment of the claim;
  owed|B|owed(uint256)|r|d|;
  spec|B|spec()|r|d|the terms and both templates;
  pageOf|B|pageOf(uint256)|r|d|the token's site, filled now;
  ```
  The err table gains IStudioEvents' and ICollectionEvents' errors,
  `Studio.ZeroAddress`, lib/SSTORE2's three, `Transient.Reentrancy` and
  lib/ERC721Base's ERC-6093 errors.
- **Not in this unit (nothing in the frozen interfaces carries it).** A
  discount or allowlist for the parent collection's holders (V2 §5.4 "can
  honour the parent's holders"), a coin as a room's currency (§4: Agora's),
  and the coin launch beside the collection launch in one Studio room
  (W12). Each would be an additive interface row first.
- **Not provable in these harnesses.** The seed's `blockhash(block.number - 1)`:
  both harnesses run a mock blockchain whose every block hash is zero, so
  `block.number - 1` and `block.number` read alike; mutation C32 (dropping
  the hash) is killed, the `- 1` is a rehearsal check on hardhat.
