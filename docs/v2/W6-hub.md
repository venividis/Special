# W6 — the hub's V2 terms, `residueOf`, the third row table, the site and the record

Unit W6 of INTACT V2 wave 2: docs/v2/INTEGRATION.md rows H1–H5, I1 and
I2, from d6dba77, on branch `worktree-agent-a63c5ed7f9c47dc83` (the
code is 492ab8c). This file is the unit's report: what changed, every
decision and its reason, the evidence, and what the files this unit does
not own need. Every count, size and gas number below is **measured** and
names the run it came from.

## 1. What changed

| File | Change | Row |
|---|---|---|
| `src/hub/IntactBase.sol` | `IntactConfig` appends `keepsake`, `journal` after `timelock`; `_KEEPSAKE`, `_JOURNAL` immutables; `_CONFIG_HASH` covers both | H1 |
| `src/hub/CoreLogic.sol` | `KEEPSAKE()`, `JOURNAL()` beside `MARKET()` and `ROLES()` (CoreFacet serves them) | H1 |
| `src/hub/SiteLogic.sol` | `getStateFingerprint` appends `Keepsake.commitmentOf(account(id))` and `Journal.rootOf(address(this), id)` after `planHash`; `residueOf(id)`; `_standing(id)` reads the eight satellite words once for both | H1, H2 |
| `src/interfaces/IIntact.sol` | `residueOf`, `KEEPSAKE`, `JOURNAL` (additive; the interface declares 96 functions) | H1, H2 |
| `src/interfaces/IBazaar.sol` | `IBazaarEvents` gains `error Unpriced()` and `event SeaportCompatibleContractDeployed()` | I1 |
| `src/interfaces/ISeaport.sol` | `ISeaportZoneInterface`: Seaport 1.6's own `ZoneInterface`, `supportsInterface` re-declared, id `0x39dd6933` | I2 |
| `src/Bazaar.sol` | the pin stores `hub.residueOf(id)`; `validateOrder` compares it after the transfers, then every floor; `_residue` and the two local declarations are gone, the ABI is the same set of entries | H2, I1, I2 |
| `src/Catalog.sol` | `CatalogRowsV2` (48 rows, letters `VJBbZcF`, its own transaction); `CatalogText(rows, post, v2)`; the V2 world, bits and probes; 57 errors (229 → 286) and 18 topics (33 → 51); the word-at-a-time hex writer, the joined `sel` shard, one copy fewer in `services()` | H3 |
| `tools/hub.mjs`, `tools/site.mjs` | the 18-field hub config; `deploySite`'s V2 options; the Catalog's 33-field config; the Catalog deployed after the Renderer and the Premises, which keep their nonces | H4 |
| `tools/deploy.mjs`, `tools/recover-record.mjs`, `tools/verify-venues.mjs` | the six V2 satellites as `intact.v2.<key>` CREATE3 placeholders; `catalogRowsV2`; the Seaport venue row for 84532 and its claims (and the header of the tool that re-proves them); record schema 3 | H5 |
| `tools/verify.mjs`, `tools/verify-bazaar.mjs`, `tools/verify-recover.mjs` | the drift gate over the V2 contracts and the sentences below | H3–H5 |
| `test/Fingerprint.t.sol`, `test/Bazaar.t.sol`, `test/mocks/BazaarFixtures.sol`, `test/Diamond.t.sol`, `test/Premises.t.sol`, `test/Gas.t.sol`, `test/helpers/Deploy.sol`, `test/Market.t.sol`, `test/Router.t.sol` | the proofs, the selector lists, the config literals | H1–H4 |
| `docs/INTERFACE-CHANGES.md` | "V2 wave 2 — W6" | I1, I2, H1, H2 |

## 2. Decisions, each with its reason

1. **The two pins are immutables appended to `IntactConfig`, and the
   config hash covers them.** The fingerprint reads them on every call, and
   an immutable is inlined into each facet's code (no storage read under
   the diamond's delegatecall); the diamond already refuses facets whose
   `intactConfigHash()` differ, so a facet built against another Keepsake
   cannot be cut in. Appending keeps every earlier field where it was
   (`tools/hub.mjs` `CONFIG_FIELDS`, the Bundle fixture). Like the Market's
   and the Roles' pins they are predictions: codeless until the satellite
   lands, and the guarded read makes a codeless pin a zero.

2. **The two terms are appended after `planHash`, through the existing
   `_guarded32`.** Every earlier term keeps its position, so the reasoning
   that each V1 test and the Bazaar's pin rest on is unchanged; an absent
   Keepsake or Journal (or one that does not answer a word) contributes
   zero, never a revert. `Keepsake.commitmentOf(reach)` moves only when a
   keepsake LEAVES the Reach or its holder changes its own terms, never on
   a gift and never on a stranger's `claim`, so a gift cannot break a
   listing (W1's rule, proved here against the real Keepsake);
   `Journal.rootOf(address(this), id)` names the hub by `address(this)`,
   which is the diamond under delegatecall and the monolith itself.

3. **`_standing(id)` reads the eight satellite words once, for both
   hashes.** The fingerprint and the residue cannot then disagree about how
   a term is read, and SiteFacet carries one copy of the eight guarded
   reads rather than two (SiteFacet 8,881 → 9,440 B, §5).

4. **`residueOf` is exactly the terms `_update` leaves standing.** A sale
   moves the holder and the custody epoch and voids, in `_update` and
   `_strip`, the single approval, the guardian and its hold, `feesToGrip`,
   the pinned face, the user and its expiry, the agent wallet and its
   proposal, and the status (it pauses); the steward's plan is keyed by
   the epoch, so it dies too. Everything else the fingerprint hashes is in
   the residue, in the fingerprint's own order: `lockCount`,
   `transferSealUntil`, `createdAt`, `launchCount`, `curve`, `nameHash`,
   then the eight words. `lockCount` is zero at any sale (a locked token
   does not move) and `createdAt`/`launchCount` have no writer after the
   mint; they are kept because the residue's definition is "every term a
   sale does not move", and a definition with exceptions is one a later
   field could fall through. It reverts `NoSuchToken` for an unminted id,
   as the fingerprint does.

5. **The Bazaar compares the residue first, then the floors, and refuses
   with the error it already had.** The pin's residue is
   `hub.residueOf(id)` at `publish`; at `authorizeOrder` the whole
   fingerprint matched the pin, and it hashes every residue term, so the
   residue the zone compares after the transfers is the one the buyer saw.
   A moved residue is `FingerprintMoved(pinned, live)`, as before, so a
   page and a test read one refusal for "the state moved". This closes the
   residual W3's report §2.1 and §7 named — the terms its two-term residue
   (`Reach.state()`, `Pool.marketHash(id)`) did not reach: a trait, a
   memory, a launch or a lock written while a seller paid inside a conduit
   fill still holds the token. The steward's plan is the one term W3
   listed that stays out, because the sale itself voids it.

6. **`ISeaportZoneInterface` is declared beside `ISeaportZone`, not
   instead of it.** `ISeaportZone` is frozen and its id (`0x3822a094`) is
   what the frozen interface computes; the Bazaar answers both. The mirror
   re-declares `supportsInterface` as seaport-types does, so
   `type(ISeaportZoneInterface).interfaceId` is `0x39dd6933`, asserted
   against the compiler in `test/Bazaar.t.sol`.

7. **A third rows contract, with letters of its own.** Seven contracts
   needed letters and five capitals were free (B, F, J, V, Z), so the two
   that would have taken a capital already in use take its lower case,
   beside the family they resemble: `b` bridges beside `B` bazaar, and `c`
   a Studio collection beside `C` a coin — both per-address families whose
   rows carry address zero and name their target, as the MCP bridge
   already says for a coin. V is the keepsake (the vault's gift), J the
   journal, B the bazaar, Z the studio, F the agora (the forum). A letter
   stays one byte, so the row format, `_find` and `_renderRows` are
   untouched. `CatalogRowsV2` maps its letters to its own seven addresses
   through a `virtual _index`, so `RowTable`'s 21-slot array and `LETTERS`
   are unchanged and `CatalogRows` and `CatalogRowsPost` keep their runtime
   bytes exactly (compared with d6dba77's compile output); their
   construction got cheaper, not dearer (decision 15). `word()` names the V2 letters, then every
   letter of the two tables above through `RowTable`'s, which ends in
   `catalog`, so it stays total over every byte.

8. **The V2 rows are held to the contracts' ABIs, not the interfaces'.**
   Agora's `evict`, `heads`, `roomsOf` and a Collection's `pageOf` are in
   the contracts and in INTEGRATION's I3/I7, not yet in the frozen
   interfaces; the drift gate in `tools/verify.mjs` maps each V2 word to
   its contract (`Keepsake`, `Journal`, `Bazaar`, `Bridges`, `Studio`,
   `Collection`, `Agora`) and adds the seven to `PANEL_FACING`, so every
   error they declare must be in the err table.

9. **Seaport is a world address with no bit.** It is a venue, not an
   INTACT satellite: nothing about the token is read from it, and the
   Bazaar's own bit already says whether the zone exists. The Catalog's
   `SEAPORT` is the venue row's address where the table has one and zero
   elsewhere.

10. **`stateOf` asks each V2 satellite its cheapest word.** `HUB()` of the
    Keepsake, the Journal, the Bazaar, the Studio and Agora, and Bridges'
    `TIMELOCK()` — immutables, one word each, no slot loaded. The state
    block carries no V2 datum, only whether each answered, and every face
    that reads `stateOf` pays for the six: the first cut asked per-token
    views (`commitmentOf(reach)`, `countOf(hub, id)`, `collectionsOf`,
    `followerCount`, `names()`), and on a band with all six landed
    `/token/1/face/1` measured 485,517 gas of its 500,000 cap (§5). The
    loop and its one call site are the existing ones; the bits continue
    after the agent card's 4096 in the order INTEGRATION gave them, and
    `TokenState.reported`/`absent` are `uint32`.

11. **`deploySite` deploys V2 only when asked, and the hub's config always
    carries a Keepsake and a Journal.** Six options (`deployJournal`,
    `deployKeepsake`, `deployBazaar`, `deployBridges`, `deployStudio`,
    `deployAgora`) and `v2: true` for all six, each deployed after
    everything else at a predicted CREATE address, so every V1 verifier
    sees the band it always saw. When an option is off its pin is a
    distinct codeless placeholder constant, so the hub is the same build
    either way and the state block's chips read "not deployed", never "0".
    `deployBazaar` puts the probed Seaport 1.6 and ConduitController
    runtimes at their canonical addresses first, each held to the codehash
    `probe.json` recorded. Studio and Agora are each pinned to the other's
    prediction. The third table is one more CREATE before the text layer,
    so the Renderer and the Premises — which read nothing at construction
    — now come before the Catalog and keep the nonces they had at d6dba77:
    the Premises' address is what the console's QR carries, and
    `tools/verify-site` pins the QR's module map (the first run with the
    Catalog first moved the Premises and read 603 passed, 1 failed on
    *"the module map's keccak is pinned"*; with the Premises back at its
    nonce, 604 passed, 0 failed). `tools/deploy.mjs` is CREATE3 and has no
    such coupling.

12. **The deployer pins all six V2 satellites as `intact.v2.<key>`
    CREATE3 placeholders.** The hub needs two of them, but the Catalog's
    world and its third table carry all six addresses, and a placeholder
    is what the post-MVB pins already are. The namespace is new so a V2
    salt can never collide with a V1 key; `catalogRowsV2` keeps
    `intact.v1.` because it is part of the MVB sequence (between
    `catalogRowsPost` and `catalogText`). The record schema is 3, and the
    ten PINS rows that read a V2 getter carry `3`, so `pinApplies` skips
    them for a schema-1 or schema-2 record, whose hub and Catalog predate
    the getters.

13. **The Seaport venue row carries its own probe.** `seaportProbed`
    (date, block, block hash, version, domain separator, three codehashes)
    is copied from `tools/fixtures/seaport-1.6/probe.json`, not re-probed,
    and sits apart from the Uniswap row's `probed` because it is other
    evidence from another block. `checkVenues` makes W3 §7's claims: the
    three codehashes, `information()` saying 1.6 and naming this
    controller, `getConduit(openseaConduitKey)` naming this conduit, and
    the conduit's channel to Seaport open. Sepolia's row names no Seaport.

14. **`tools/verify-bazaar.mjs` takes its Bazaar, Bridges and Journal from
    `deploySite`.** The in-fill memory is a residue term only when the
    hub pins the Journal the seller writes into, so the verifier runs on a
    site whose hub was built with the Journal's prediction
    (`deployJournal`, `deployBazaar`, `deployBridges`). Every sentence it
    printed before is printed unchanged; the `published.intact` count
    stays nine because the new cases publish through the relayer like the
    old ones.

15. **The state block pays for V2 with a faster hex writer and one copy
    fewer.** With V2's world, bits, rows, errors and topics and the old
    writer, `tools/gas.mjs` measured `/token/1/state.json` at 995,363 gas
    of its 1,000,000 cap and `/services.json` at 965,160 (d6dba77: 0.90 M
    and 0.68 M). Profiled cold, two thirds of CatalogState's world went to
    `_writeHex`'s byte loop, and the 79 KB `services` document was copied
    once more than it needed (`_rowsAll`). So `_writeHex` writes an
    address or a word as two words of characters (sixteen bytes at a time,
    branch-free, ending exactly at the last character, so the
    `memory-safe` bound is unchanged; a selector keeps the byte loop),
    `CatalogText` joins the three `sel` maps once at construction into one
    shard, and `services()` hands the three row pieces to `_fill` directly.
    The documents' bytes are unchanged (the equality step and every
    selector and address sentence of `tools/verify.mjs`, and the Premises
    suite, read them). Measured after the two changes: 814,332 and
    796,932 (814,250 with decision 10's probes) — the state block, V2 and
    all, below d6dba77's 0.90 M; `/services.json`, 17.8 KB longer, at
    0.80 M against 0.68 M (§5).

## 3. The residue: its terms, and the tests that prove each direction

`residueOf(id) = keccak256(abi.encode(lockCount, transferSealUntil,
createdAt, launchCount, curve, nameHash, Reach.state, Reach.sealedUntil,
Reach.openApprovalsRoot, Pool.marketHash(id), Locks.commitmentOf(reach),
Launchpad.launchRoot(id), Keepsake.commitmentOf(reach),
Journal.rootOf(hub, id)))` — the fourteen, in the fingerprint's order.

| Direction | Proof |
|---|---|
| it is keccak of exactly those fourteen | `test/Fingerprint.t.sol` `test_everyTermOfTheResidueMovesIt`: *"residueOf is keccak of its fourteen terms, createdAt and launchCount among them"*, recomputed from the public reads after every move (`_residueByFormula`) |
| each term moves it | the same test, one write per term on the real hub with the real Keepsake and Journal: `lockCount` (a module lock, and back), `transferSealUntil`, `curve`, `nameHash`, `Reach.state`, `Reach.sealedUntil`, `Reach.openApprovalsRoot`, `Pool.marketHash`, `Locks.commitmentOf(reach)`, `Launchpad.launchRoot`, `Keepsake.commitmentOf(reach)` (a keepsake transferred out of the Reach), `Journal.rootOf(hub, id)` (a memory); `createdAt` and `launchCount` have no writer after the mint and are held by the formula |
| what a sale moves or voids is not in it | `test_aSaleMovesNoTermOfTheResidue`: the status, the pinned face, the guardian, `feesToGrip`, the user, the proposed and the accepted agent wallet and the steward's plan each move the fingerprint and leave the residue (*"the status is not in the residue"*, *"nor the pinned face"*, … *"nor the steward's plan"*) |
| a sale moves none of it | the same test, every term set before the sale: *"a sale moves no term of the residue"*, *"every one of its fourteen terms reads as it did before the sale"*; on the real site, `tools/verify-bazaar.mjs` *"and the sale moved no term of the hub's residueOf, which validateOrder compared after the transfers"* |
| the same in both builds | `test/Diamond.t.sol`: *"and so is the residue a zone reads after a sale's transfers"* |
| the zone reads it after the transfers | `test/Bazaar.t.sol` `test_aSellerWhoWritesATraitInsideTheFillIsRefusedAfterTheTransfers`, `test_aSellerWhoWritesAMemoryInsideTheFillIsRefusedAfterTheTransfers` (the real Journal), `test_aSellerWhoLaunchesInsideTheFillIsRefusedAfterTheTransfers`, `test_theZoneReadsTheHubsResidueAndTheSaleMovesNoneOfIt`; and on the real site through a real conduit, `tools/verify-bazaar.mjs` *"a seller whose receive() writes a trait inside a conduit fill is refused by validateOrder after the transfers"*, *"a seller whose receive() writes a memory inside a conduit fill is refused by validateOrder after the transfers"*, *"a seller whose receive() launches a coin from the token inside a conduit fill is refused by validateOrder after the transfers"*, *"and nothing moved in any of the three: each token is its seller's, with no trait, memory or launch written"* |

The two fingerprint terms: `test_theKeepsakeAndTheJournalMoveTheFingerprint`
(*"Keepsake.commitmentOf(reach): a keepsake transferred out of the
Reach"*, *"Journal.rootOf(hub, id): a memory inscribed by the holder"*,
*"Journal.rootOf(hub, id): a memory the token's Reach inscribed"*, and
*"a gift to the Reach and a stranger's claim move nothing"*), the hub
deployed at a predicted address with the REAL Keepsake and Journal at the
two addresses its config named before they existed (*"the hub pins the
Keepsake that landed at its prediction"*);
`test_theV2TermsOfAnAbsentKeepsakeAndJournalAreZeroNotARevert`; and
`tools/verify-bazaar.mjs` *"a listing whose holder wrote a memory after
publishing is refused at the fill with FingerprintMoved(pinned, live): the
Journal's root is in the fingerprint"*.

## 4. The letters, the bits, the state block

| Letter | Word (`sel` key prefix, `services[].on`) | Contract | Rows | Address in the rows |
|---|---|---|---|---|
| V | `keepsake` | Keepsake | 12 | the Keepsake |
| J | `journal` | Journal | 4 | the Journal |
| B | `bazaar` | Bazaar | 4 | the Bazaar |
| b | `bridges` | Bridges | 2 | Bridges |
| Z | `studio` | Studio | 5 | the Studio |
| c | `collection` | a Studio collection | 5 | zero (per collection, as `C` a coin) |
| F | `agora` | Agora | 16 | Agora |

The two older tables keep H P R Y T S K N L C O W X E G Q and M D A U I;
`b` and `c` are the only lower-case letters, and every other byte names
`catalog`.

The state block (every `/token/<id>/state.json`, `window.INTACT`) gains,
in the world: `keepsake`, `journal`, `bazaar`, `bridges`, `studio`,
`agora` (addresses: the satellite or its placeholder) and `seaport` (the
venue, zero where the table has none); in `bits`: `keepsake` 8192,
`journal` 16384, `bazaar` 32768, `studio` 65536, `agora` 131072,
`bridges` 262144, read from `reported` and `absent` as every other bit;
in `sel`: the 48 `keepsake.*`, `journal.*`, `bazaar.*`, `bridges.*`,
`studio.*`, `collection.*`, `agora.*` keys; in `err`: the 57 V2 errors;
in `topics`: `inscribed`, `wrapped`, `paid`, `dripped`, `dripSet`,
`dripCleared`, `keepsakeExtended`, `published`, `pinned`,
`orderValidated`, `orderFulfilled`, `endpointSet`, `collectionLaunched`,
`collectionMinted`, `collectionClaimed`, `reacted`, `followed`,
`agoraKeyBound` (Agora's `Said`, `Founded` and `Entered` are Parley's
signatures, so their topics are the existing `said`, `founded`,
`entered`). Home draws a chip per bit, so a band without V2 shows six
"not deployed on this chain" chips.

## 5. Measured

**Sizes** (deployed bytes; `node tools/compile.mjs --ship`, d6dba77 from
this unit's baseline compile, after from the battery's compile of §6):

| Contract | d6dba77 | After | |
|---|---|---|---|
| `Intact` (the monolith, measured, not shipped) | 25,364 | 26,082 | +718; over EIP-170 as before, the diamond ships |
| `CoreFacet` | 12,785 | 12,942 | +157: `KEEPSAKE()`, `JOURNAL()` |
| `SiteFacet` | 8,881 | 9,440 | +559: `residueOf`, `_standing`, two fingerprint terms |
| `RightsFacet`, `MintFacet`, `IntactDiamond` | 4,996, 5,368, 2,004 | the same | |
| `Bazaar` | 11,705 | 11,621 | −84: `_residue` gone, one hub call |
| `Catalog` | 14,848 | 16,778 | +1,930: the V2 world, getters, `agrees()`, six probes |
| `CatalogState` | 16,032 | 16,999 | +967: the world's seven keys and bits, `hex16` |
| `CatalogText` | 5,345 | 5,830 | +485: the third table, the joined `sel` shard |
| `CatalogRows`, `CatalogRowsPost` | 2,198 each | 2,198 each | the same runtime bytes |
| `CatalogRowsV2` | — | 2,675 | new |

Every gated contract is under the EIP-170 ceiling of 24,576 B; the ship
rule reads "diamond — Intact 26082 B > 24000". `Renderer` (16,826) and
`Premises` (15,319) are unchanged.

**The three tables' construction** (gas used by each deployment
transaction, `tools/verify.mjs`'s "gas, measured" in the battery of §6;
the middle column is the same tool's run with V2 and the old hex writer;
the cap is EIP-7825's 16,777,216):

| Table | Rows | At d6dba77 | With V2, the old hex writer | Final |
|---|---|---|---|---|
| `CatalogRows` | 159 | 14.97 M (docs/CHECKPOINT.md) | 14,970,517 | 14,529,412 (86.6 % of the cap) |
| `CatalogRowsPost` | 43 | — | 5,067,517 | 4,952,476 |
| `CatalogRowsV2` | 48 | — | 5,763,031 | 5,620,377 |

Neither existing table's construction grew: their runtime bytes are
d6dba77's, and the faster hex writer made both cheaper to render.
`CatalogText` (which now joins the three `sel` maps into one shard) went
to 7.35 M, the Catalog to 4.29 M, CatalogState to 3.73 M.

**The capped views** (`tools/gas.mjs`, cold, a transaction between each;
gas.mjs's world has the card, the Roles and the Market and no V2
satellite; the last column is the same probes with `deploySite`'s
`v2: true`, all six V2 satellites landed, from a scratch run of the same
`measure`):

| View | Cap | d6dba77 | V2, old writer | Final | Final, V2 landed |
|---|---|---|---|---|---|
| `/token/1/state.json` | 1.00 M | 0.90 M | 995,363 | 814,250 | 826,471 |
| `/services.json` | 1.00 M | 0.68 M | 965,160 | 796,932 | 796,932 |
| `hub.tokenURI(1)` | 8.00 M | 3.64 M | 4,121,387 | 3,940,274 | 3,952,337 |
| `/token/1/live` | 2.50 M | 1.29 M | 1,417,052 | 1,235,939 | 1,248,160 |
| `/token/1/hash` | 2.50 M | 2.08 M | 2,281,795 | 1,932,069 | 1,952,511 |
| `/token/1/face/1` | 0.50 M | 0.44 M | 464,260 | 464,178 | 476,241 |
| `hub.tokenURIAt(1,1)` | 0.50 M | 0.42 M | 448,182 | 448,100 | 460,163 |
| `/token/1/crest.svg` | 0.50 M | 0.32 M | 342,069 | 341,987 | 354,050 |
| `catalog.stateOf(1)` | — | 0.27 M | 290,265 | 290,183 | 302,246 |
| `hub.getStateFingerprint(1)` | — | 0.08 M | 81,462 | 81,462 | 87,989 |
| `hub.residueOf(1)` | — | — | — | 67,986 | 74,512 |

The d6dba77 column is this unit's baseline `tools/gas.mjs` run, printed
to two places; the battery's `gas` step printed the Final column's
figures to two places (0.81 M, 0.80 M, 3.94 M, 1.24 M, 1.93 M, 0.46 M,
0.45 M, 0.34 M). **Face 1 is the tightest**: 92.8 % of its cap, 95.2 % on a
band with V2 landed — every face that reads `stateOf` pays its seventeen
probes, and the agent card's (`manifestHash`, which renders the whole
registration) is the largest of them (§7, request 7). The V2 probes'
first cut (per-token views) measured 485,517 there.

## 6. The battery

`node tools/check.mjs --keep-going` on this branch, on the tree of
492ab8c (this report's commit adds only this file; 2026-10-19, four
cores; the forge runner's compile of src + test was cold): **check:
green — all 33 steps passed in 59m 23s**.
Every step's own summary line, as `check.mjs` read it:

| Step | Summary line | Time |
|---|---|---|
| compile | `all gated contracts fit under the EIP-170 ceiling of 24576 bytes` (ship rule: diamond) | 4m 33s |
| facets | `96 selectors routed once each; no diamondCut anywhere` | 0.2s |
| facets:selftest | `facets.mjs self-test: 8 passed` | 0.1s |
| selftest | `52 passed, 0 failed` | 0.2s |
| build | `shell gzip          14,955 bytes   (ceiling 15,000)` | 3.1s |
| forge:monolith | `639 passed, 0 failed` | 35m 42s |
| forge:diamond | `639 passed, 0 failed` | 6m 36s |
| gas | `every measured view is under its cap (83 probed cold, a transaction between each; every view ≤ 16.78M, tokenURI ≤ 8.00M, /live ≤ 2.50M)` | 10.9s |
| gas:selftest | `gas.mjs self-test: the fixture (45.60M) is over the 16.78M cap and would fail the build; the control passes` | 23.1s |
| verify | `249 passed, 0 failed` | 9.8s |
| verify:site | `604 passed, 0 failed` | 3m 12s |
| mcp | `29 passed, 0 failed` | 6.9s |
| verify:pool | `144 passed, 0 failed` | 14.5s |
| verify:vault | `184 passed, 0 failed` | 7.3s |
| verify:parley | `81 passed, 0 failed` | 3.9s |
| verify:launch | `307 passed, 0 failed` | 8.1s |
| verify:steward | `91 passed, 0 failed` | 3.8s |
| verify:timelock | `35 passed, 0 failed` | 2.1s |
| verify:premises | `63 passed, 0 failed` | 8.2s |
| verify:plate | `228 passed, 0 failed` | 40.6s |
| verify:keepsake | `81 passed, 0 failed` | 2.8s |
| verify:journal | `48 passed, 0 failed` | 4.7s |
| verify:bazaar | `67 passed, 0 failed` | 14.5s |
| verify:studio | `47 passed, 0 failed` | 14.2s |
| verify:agora | `53 passed, 0 failed` | 6.0s |
| fuzz | `9 properties held, 0 broken` | 15.0s |
| verify:findings | `36 passed, 0 failed` | 9.1s |
| agents | `6630 passed, 0 failed` (seed 430300292, 220 ticks) | 1m 40s |
| static-audit | `static audit passed — 10 Solidity rules, 4 JS rules; this is not a security audit` | 0.2s |
| static-audit:selftest | `static-audit self-test: the fixture fails on 5 findings, the clean file passes` | 0.1s |
| verify:recover | `184 passed, 0 failed` | 57.1s |
| verify:console | `174 passed, 0 failed` (Chromium 141.0.7390.37) | 3m 14s |
| invariants | `107 passed, 0 failed` | 0.2s |

This unit's own share of those counts: eight of the 639 tests on each
build (four in `test/Fingerprint.t.sol`, four in `test/Bazaar.t.sol`,
beside the new assertions in five existing ones); fourteen of `verify`'s
249 sentences; nine of `verify:bazaar`'s 67 (W3's report: 58); nine of
`verify:recover`'s 184; `facets` routes 96 selectors (93 at d6dba77).
Before the battery, the five suites this unit changed were run in a
pruned copy on both builds (87 passed, 0 failed each), and every
verifier on the warm compile.

**Mutations** (by hand, each in a scratch copy of the tree pruned to the
suites that read it, the worktree itself left clean throughout; not
`npm run mutations`, whose table is not this unit's):

| Mutant (one token) | Run | Killed by |
|---|---|---|
| `src/hub/SiteLogic.sol` `getStateFingerprint`: the Journal term `t[7]` → `t[6]` | `tools/forge.mjs` on Fingerprint + Bazaar (with the next row): 43 passed, 21 failed | `test_theKeepsakeAndTheJournalMoveTheFingerprint` · *"Journal.rootOf(hub, id): a memory inscribed by the holder"* (A12) |
| `src/Bazaar.sol` `validateOrder`: `hub.residueOf(id) != pin.residue` → `==` | the same run | 20 Bazaar tests, among them `test_aSellerWhoWritesATraitInsideTheFillIsRefusedAfterTheTransfers`, `…AMemory…`, `…Launches…`, `test_theSameConduitFillLandsWhenTheSellerDoesNothingInsideIt` and `test_theZoneReadsTheHubsResidueAndTheSaleMovesNoneOfIt` (Z12) |
| `src/hub/SiteLogic.sol` `residueOf`: `c.createdAt` → `c.custodyEpoch` | `tools/forge.mjs` on Fingerprint: 5 passed, 2 failed | `test_aSaleMovesNoTermOfTheResidue` · *"a sale moves no term of the residue"*, `test_everyTermOfTheResidueMovesIt` · *"residueOf is keccak of its fourteen terms, createdAt and launchCount among them"* (A13) |
| `src/Catalog.sol` `stateOf`: the Journal's probe target `JOURNAL` → `KEEPSAKE` | `tools/verify-bazaar.mjs`: 66 passed, 1 failed | *"Catalog.stateOf reports the Journal, the Bazaar and Bridges this site landed (bits 16384, 32768, 262144) and names the Keepsake, the Studio and Agora absent"* (F9) |

No survivor. The rows stay pending until the ledger's own gate runs.

## 7. Requests for files this unit does not own

1. **`docs/INVARIANTS.md` and DESIGN.md §14** — four rows, numbered
   after the ledger's own (H1–H3 are taken there; A is the hub, F the
   site, Z the Bazaar). Their tests ran in the battery of §6 and the
   mutations of §6 failed them; they are **pending (W6)** until the
   ledger's own gate has run them:

   | Row | Claim | Cited | Status |
   |---|---|---|---|
   | A12 | The fingerprint hashes the Keepsake's commitment of the Reach and the Journal's root for the token, after the steward's plan: a keepsake leaving the Reach and a memory each move it, a gift and a stranger's claim do not, and an absent Keepsake or Journal is zero, never a revert | `test/Fingerprint.t.sol` · `test_theKeepsakeAndTheJournalMoveTheFingerprint`, `test_theV2TermsOfAnAbsentKeepsakeAndJournalAreZeroNotARevert`; `tools/verify-bazaar.mjs` · *"a listing whose holder wrote a memory after publishing is refused at the fill with FingerprintMoved(pinned, live): the Journal's root is in the fingerprint"* | pending (W6) |
   | A13 | `residueOf(id)` is keccak of exactly the fourteen terms a sale leaves standing: each moves it, a sale moves none of it, and both builds agree | `test/Fingerprint.t.sol` · `test_everyTermOfTheResidueMovesIt`, `test_aSaleMovesNoTermOfTheResidue`; `test/Diamond.t.sol` · *"and so is the residue a zone reads after a sale's transfers"*; `tools/verify-bazaar.mjs` · *"and the sale moved no term of the hub's residueOf, which validateOrder compared after the transfers"* | pending (W6) |
   | Z12 | The zone compares the hub's `residueOf` after the transfers, so a seller paid inside a fill who writes a trait or a memory, or launches from the token, is refused and nothing moves | `test/Bazaar.t.sol` · `test_aSellerWhoWritesATraitInsideTheFillIsRefusedAfterTheTransfers`, `test_aSellerWhoWritesAMemoryInsideTheFillIsRefusedAfterTheTransfers`, `test_aSellerWhoLaunchesInsideTheFillIsRefusedAfterTheTransfers`, `test_theZoneReadsTheHubsResidueAndTheSaleMovesNoneOfIt`; `tools/verify-bazaar.mjs` · *"a seller whose receive() writes a trait inside a conduit fill is refused by validateOrder after the transfers"*, *"a seller whose receive() writes a memory inside a conduit fill is refused by validateOrder after the transfers"*, *"a seller whose receive() launches a coin from the token inside a conduit fill is refused by validateOrder after the transfers"*, *"and nothing moved in any of the three: each token is its seller's, with no trait, memory or launch written"* | pending (W6) |
   | F9 | The state block names every V2 contract and its bit, and every V2 row's selector computed on chain; an undeployed V2 satellite is absent, never zero, and a landed one reports | `tools/verify.mjs` · *"the V2 satellites take bits 8192 to 262144 after the agent card's 4096: keepsake, journal, bazaar, studio, agora, bridges"*, *"none of the six reported and each is absent — codeless placeholders on a band that has not deployed V2"*, *"the V2 rows carry their contracts' addresses by letter, and a collection's carry none, as a coin's"*; `tools/verify-bazaar.mjs` · *"Catalog.stateOf reports the Journal, the Bazaar and Bridges this site landed (bits 16384, 32768, 262144) and names the Keepsake, the Studio and Agora absent"* | pending (W6) |

   W3's Z6 says *"the Reach's state and the owned market's hash are read
   again after the transfers"*: it is now the hub's whole `residueOf`,
   which includes both; its cited sentences are unchanged and pass. A8's
   status cell says `allSelectors` is 93: it is 96 (`KEEPSAKE`,
   `JOURNAL`, `residueOf`).
2. **`docs/CONSOLE.md`** (the state block's paragraph): the world's seven
   new keys (`keepsake`, `journal`, `bazaar`, `bridges`, `studio`,
   `agora` addresses; `seaport` a venue, zero without a Bazaar), the six
   bits and their chips, the seven `sel` word prefixes and the 18 topic
   names of §4.
3. **`CLAUDE.md`**: "The monolith is over EIP-170 (25,402 B)" — measured
   26,082 B now (§5); the `CatalogRows.SERVICES` trap — the V2 rows go in
   `CatalogRowsV2.SERVICES`, the third table, its own transaction, under
   V J B b Z c F, and the text layer serves three tables as one `sel` map
   and one `services` array; a line that the fingerprint has two V2 terms
   after `planHash`, read through the hub's `KEEPSAKE`/`JOURNAL` pins, and
   that `residueOf` is what a zone compares after a sale's transfers; the
   record schema is 3 (the ten V2 PINS rows skip an older record).
4. **`src/interfaces/Site.sol`**: the `TokenState.reported` comment lists
   the bits to 4096; append "8192 keepsake, 16384 journal, 32768 bazaar,
   65536 studio, 131072 agora, 262144 bridges" (a comment only; the field
   is `uint32` and holds them).
5. **`deployments/README.md`**: the record's shape at schema 3 — the six
   V2 keys under `salts` and `placeholders` (`intact.v2.<key>`),
   `catalogRowsV2` under `contracts`, and the Seaport keys of a venue row
   (`seaport`, `conduitController`, `openseaConduitKey`, `openseaConduit`,
   `seaportProbed`).
6. **Wave 3 (the deployer)**: V2 has no `SATELLITES` rows yet, so
   `deploySatellite` cannot land a Keepsake, a Journal, the Bazaar,
   Bridges, the Studio or Agora at its placeholder; each needs a row (its
   constructor arguments from the record: Keepsake(hub, pool, art) with
   the KeepsakeArt first, Journal(hub), Bazaar(venue seaport, hub, pool),
   Bridges(timelock), Studio(hub, journal, agora) and Agora(hub, keys,
   studio) at each other's predictions) and its own PINS (`HUB()`,
   `POOL()`, `TIMELOCK()`, …) so `recover-record` reads them back.
7. **The agent card's probe in `Catalog.stateOf`** (U17's choice, and
   `tools/verify-site/agent.mjs` A13 names it): `manifestHash(id)` renders
   the whole registration to answer a liveness question, and it is the
   largest of the seventeen probes every `stateOf` reader pays — face 1
   is at 92.8 % of its cap (95.2 % with V2 landed, §5). A probe of an
   immutable (as the V2 six now are) would give back most of that; it
   changes A13's wording, so it is not made here.
8. **`tools/gas.mjs`** measures the band "once the post-MVB satellites
   have landed"; a V2 band has six more, and `deploySite`'s `v2: true`
   lands them. The battery's figures are the codeless shape; §5's last
   column is the landed one, every view under its cap.
