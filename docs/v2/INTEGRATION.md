# V2 integration — what the units handed over, and what happens to it

The five wave-1 units are merged into the integration branch. Each one
built its contract, a forge suite, a verifier and a mutation table in its
own worktree. Each also wrote down what it needed from files it does not
own. This file is that list, with the integrator's decision on each
request and its state. The unit reports in this folder carry the reasons
in full.

## Merged (2026-10-19)

The figures in this table are the units' own runs, in pruned copies. The
full-tree runs that re-prove them are listed under "The full-tree proof".

| Unit | Merge | Contract (runtime) | Suite | Verifier | Mutations |
|---|---|---|---|---|---|
| W2 Journal | 22aa9c4 | Journal 2,142 B | 36 passed | 48 passed | 40 / 40 killed |
| W3 Bazaar + Bridges | 9eb1c11 | Bazaar 11,705 B, Bridges 1,996 B | 53 + 14 passed | 58 passed (fork proof 32 passed) | 76 / 76 killed |
| W4 Studio + Collection | d7e3151 | Studio 7,067 B, Collection 14,688 B | 21 + 29 passed | 47 passed | 70 / 71 killed, 0 survived, 1 equivalent |
| W1 Keepsake | 8e451c6 | Keepsake 16,036 B, KeepsakeArt 11,207 B | 47 passed | 81 passed | 33 / 33 killed |
| W5 Agora | 96b3edc | Agora 11,311 B | 79 passed | 53 passed | 45 / 45 killed |

## The full-tree proof

Each unit ran its suite in a copy pruned to what that suite imports. The
merged head (96b3edc, the five units and nothing else) was then run once as
it stood, on 2026-10-19:

- `node tools/compile.mjs`: every gated contract under EIP-170, in 5 m 2 s
  cold. The V2 contracts: Keepsake 16,036 B, Collection 14,688 B, Bazaar
  11,705 B, Agora 11,311 B, KeepsakeArt 11,207 B, Studio 7,067 B, Journal
  2,142 B, Bridges 1,996 B. Intact is unchanged at 25,364 B, so the diamond
  ships.
- `node tools/forge.mjs` on the monolith: **631 passed, 0 failed** (38 m 53 s,
  the cold src+test compile included). The diamond: **631 passed, 0
  failed** (7 m 12 s). The seven V2 suites counted the same as in the
  pruned copies: Keepsake 47, Journal 36, Bazaar 53, Bridges 14, Studio 21,
  Collection 29, Agora 79. That is 279 V2 tests beside V1's 352 across 36
  suites, and no name collided in the shared compile.

## The battery on the merged head

`node tools/check.mjs --keep-going` on 3d33e4d (the five units, W6 and W7
merged): **check: green — all 33 steps passed in 64 m 24 s**. compile 46,
facets 96, selftest 52, build 21,949 B of 24,000, forge 640 on the
monolith and 640 on the diamond, gas 83, verify 249, verify:site 604,
mcp 29, verify:pool 144, verify:vault 184, verify:parley 81,
verify:launch 307, verify:steward 91, verify:timelock 35, verify:premises
63, verify:plate 228, verify:keepsake 81, verify:journal 48,
verify:bazaar 67, verify:studio 47, verify:agora 53, fuzz 9 properties,
verify:findings 36, agents 6,923, static-audit 14, verify:recover 184,
verify:console 174, invariants 107; 0 failed in every step.

## The shell's tuple encoder (959acee)

The V2 lanes send tuples: a keepsake's `Wrap`, a collection's spec, a
Seaport order. The shell decoded them already. Since 959acee it also
encodes them, by the same head/tail rule, and `ui.data` and `ui.propose`
take any row the Catalog serves. Measured on that tree:
- `node tools/selftest.mjs`: 60 passed, 0 failed. Eight vectors hold the
  encoder against `tools/evm.mjs`'s.
- `node tools/build-app.mjs`: the shell is 22,149 B of 24,000.
- `node tools/verify.mjs`: 249 passed.
- `node tools/verify-site.mjs`: 604 passed, 0 failed.
- `node tools/verify-console.mjs`: 174 passed, 0 failed.
- `node tools/gas.mjs`: every view under its cap, 83 probed cold.
  tokenURI 4.82 M, /token/1/live 1.42 M, /token/1/hash 2.14 M, face 1
  0.46 M, state.json 0.81 M.

## The lanes (wave 2)

| Lane | Merge | Panel (gzip of 12,288) | The unit's runs on its own tree |
|---|---|---|---|
| W10 Vault | 4a87609 | vault 12,209 B | verify-site 639, verify-console 184; 20/20 panel mutations killed |
| W9 Trade | f927bae | swap 12,044 B | verify-site 656, verify-console 181; 19/19 killed |
| W11 Social | 2082cf0 | social 12,160 B | verify-site 645, verify-console 184; 13/13 killed |
| W8 Gallery and the seventh lane | 46d26f5 | gallery 12,209 B | verify-site 646, verify-console 179, forge 643 on both builds, gas 84 probes |

The battery on the merged lanes, `node tools/check.mjs --keep-going` on
80ae2d1: **check: green — all 33 steps passed in 60 m 40 s**. compile 46,
facets 96, selftest 60, build 22,224 B of 24,000, forge 643 on the
monolith and 643 on the diamond, gas 84, verify 253, verify:site 799, mcp
29, verify:pool 144, verify:vault 184, verify:parley 81, verify:launch 307,
verify:steward 91, verify:timelock 35, verify:premises 64, verify:plate
228, verify:keepsake 81, verify:journal 48, verify:bazaar 67, verify:studio
47, verify:agora 53, fuzz 9, verify:findings 36, agents 6,825,
static-audit 14, verify:recover 186, verify:console 214, invariants 225;
0 failed in every step. W12 (Studio) merged as c69ea76, and its payee
sentence was corrected in 80ae2d1.

Requests from the lanes:

| # | Request | From | Decision | State |
|---|---|---|---|---|
| L1 | The DOM shim's `page.until` returns false on a timeout instead of throwing: 279 waits drop the result, so an assertion only a wait checked cannot fail | W11 | yes: make it throw, and give every wait that is a real expectation its own sentence | done: W13. 374 of verify-site's 380 waits throw, 22 claims became sentences, and the 5 silent timeouts were all right pages |
| L2 | verify-console's `visible()` reports what is inside a closed `<details>` as visible | W11 | yes | done: W13 |
| L15 | verify-console's own `until`: 122 of 129 waits drop their answer. None timed out silently in W13's measured run; fixing it touches testnet-drive | W13 | yes | open |
| L3 | `#cslab [data-sentence]{overflow-wrap:anywhere}`: a full address runs off a 390 px screen | W10 | yes | open |
| L4 | Panel styles into app.css (W9's switch and orb; W11's `.post`), freeing panel bytes | W9, W11 | yes | open |
| L5 | Catalog rows: `keepsake.ownerOf`, `keepsake.tokenURI`; Agora's counts, `follows`, `isRegistered`, `collectionKey`, `homeKey`, `persona`; `seaport.*`, `erc721.*` | W10, W11, W8 | yes, one CatalogRowsV2 pass | open |
| L6 | The identity lane on an Agora band binds and reads keys through Agora | W11 | yes | open |
| L7 | The slab: a per-step label on the exact-approval line ("Lets the market pull…" when the spender is the Keepsake); argument rows for tuple arguments | W9 | yes | open |
| L8 | `IEngine.panelCount` is `view`, not `pure` (INTERFACE-CHANGES) | W8 | yes | open |
| L9 | CONSOLE.md §5 (`ui.data` builds tuples since 959acee), §6.2 (every lane's new ids), §9, §14, §16, §18, §19 | all | yes | written in 3a094fc: §5, §6.2's V2 table, §9 under Agora, §14, §18, §19. After W14: §4.2's tuple rows, the approval label, identity's Agora ids, §16's bytes |
| L10 | INVARIANTS and DESIGN §14: W10-1…15, W9's F16–F22, W11's N10–N17, W8's F16–F18 and Y1–Y10 (renumbered at integration) | all | yes, pending until the battery | written, pending: F16–F19, K13–K32, J8, S17–S26, N10–N17, Y1–Y10 (53 rows; the id map below). Every cited sentence was found verbatim with all 53 read as live in a scratch copy: the checker read 331 passed, 0 failed. They flip after the battery, each by its own mutation evidence |
| L11 | CLAUDE.md: the panel sizes; a panel's style goes in the head; a suite's own chain write while a shim read is in flight fails on its nonce; Playwright's service-worker error in sandboxed frames; never `pkill -f` | W8, W9, W11 | yes | traps written: PID-only kills, the shim's throwing waits (W13), solc's unhandled rejection (W12), the nonce, the shim's clock, the closed details, the sandboxed frame. The sizes line and the panel-style rule wait for W14, which moves the styles (L4) |
| L12 | "six panels" wording in DESIGN and DEPLOYMENT; V2.md §3.3 as built (off-chain art is a link, selling needs no signature, OpenSea stays off, no WETH offers yet) | W8 | yes | written: V2.md §3.3 as built and §4's eight; DESIGN's deploy order. DEPLOYMENT.md waits for W15 |
| L13 | verify-console's viewer group no longer needs the Grip clipboard observation (fixed in W10) | W10 | yes | open |
| L14 | `tools/mutations.mjs` adopts the panels' mutation tables | W11 | later | open |
| W7-7 | the Grip's copy button in a `data:` frame | W7 | yes | done in W10 |
| W7-5 | a seventh panel | W7 | yes | done in W8: the Engine holds up to eight |

Incident: one `pkill -f "tools/verify-site.mjs"` from W8 killed W10's run
(exit 143), and W10 re-ran. From then on the units stop processes by PID
only. CLAUDE.md gains that line (L11).

## Requests, decisions, state

Interfaces (additive only, one new section in `docs/INTERFACE-CHANGES.md`):

| # | Request | From | Decision | State |
|---|---|---|---|---|
| I1 | `IBazaarEvents`: `error Unpriced()`, SIP-5's `event SeaportCompatibleContractDeployed()`, and drop Bazaar's local copies | W3 | yes | done: W6 |
| I2 | `ISeaport`: Seaport 1.6's own `ZoneInterface` (which re-declares `supportsInterface`, id `0x39dd6933`) beside `ISeaportZone` (`0x3822a094`) | W3 | yes; the Bazaar already answers both | done: W6 |
| I3 | `IAgora`: `evict`, `heads`, `topics`, `roomsOf`, `roomCount` | W5 | yes | done |
| I4 | `IAgoraEvents`: `error NoSuchPersona(uint256)` | W5 | no: `NotAPersona` is already in the ABI and says the same | closed |
| I5 | `IStudio`: `SaltUsed(address at)` → `SaltUsed(address collection)` (solc: `at` becomes a keyword) | W4 | yes; ABI-neutral, same selector | done |
| I6 | `ICollection`: the "≤ 256 holes" bound in the struct comment | W4 | yes | done |
| I7 | Record the surface beyond the interfaces: Keepsake `(hub, pool, art)`, `ART()`, `ZeroAddress`, `KeepsakeArt.render`; Collection `HUB/JOURNAL/AGORA/pageOf/imageOf/CollectionInit`; Studio `CODE/CODE_HASH/PROXY_INITCODE_HASH/MAX_*/ZeroAddress`; `claim`'s per-asset wording | W1, W4 | yes | done: INTERFACE-CHANGES, "V2 wave 1 integration" |

Shared code:

| # | Request | From | Decision | State |
|---|---|---|---|---|
| S1 | `src/lib/Rights.sol`: `holds` reads an over-wide `ownerOf` word as no holder instead of reverting | W2 | no: every V1 satellite compiles this library, so the change would move their codehashes against the live records. The write is refused either way | closed |
| S2 | `tools/forge.mjs`: keep the caller's gas refund when `expectRevert` swallows a revert | W5 | yes: a harness bug that fails tests falsely | done: `test/Harness.t.sol` · `test_aSwallowedRevertKeepsTheCallersGasRefund` failed on the old runner (0 passed, 1 failed) and passes on the fixed one |
| S3 | `test/Ratchet.t.sol`: `Keepsake.extend` in `test_everyRatchetOnlyLengthens` | W1 | no: that file tests the library through a probe and holds no satellite (the custodian is not in it either); `test/Keepsake.t.sol` · `test_extendOnlyLengthens` holds the Keepsake's use of it, row K5 | closed |

The hub, the Catalog and the deployment (W6):

| # | Request | From | Decision | State |
|---|---|---|---|---|
| H1 | The fingerprint gains `Journal.rootOf(HUB, id)` and `Keepsake.commitmentOf(account(id))`, each read guarded | V2 §3.1, §3.2 | yes; `IntactConfig` gains `keepsake` and `journal`, pinned as predictions like the Market | done: W6, merged 3d33e4d; rows A12 (pending) |
| H2 | `residueOf(id)`: keccak of every fingerprint term a sale does not move. The Bazaar stores it at `publish` and compares it after the transfers, which closes the in-fill gap its report §2.1 measured | W3 | yes; the Bazaar's two-term residue goes | done: W6; rows A13, Z12 (pending) |
| H3 | The Catalog learns the V2 contracts: letters (B, F, J, V, Z are free; seven are needed), rows, errors, topics, the state block and its bits | W1–W5 | yes; a third rows table, so neither existing table's construction gas grows | done: W6, `CatalogRowsV2` under V J B b Z c F; CONSOLE §19; row F15 (pending) |
| H4 | `deploySite` options for every V2 contract; Studio and Agora at CREATE3 predictions (each constructor pins the other) | W2, W4, W5 | yes | done: W6, `v2: true` and one option each, at CREATE predictions as every other deploySite address |
| H5 | The Seaport venue row for 84532 and its `checkVenues` claims, from the probe in `tools/fixtures/seaport-1.6/probe.json` | W3 | yes | done: W6; record schema 3 (deployments/README.md) |
| H6 | The Engine's six-panel constant becomes an array, so the Gallery lane fits | V2 §2, W7 | yes, with the lanes | done: W8, a loaded prefix of up to eight (rows F16, F17, pending) |

The shell (W7, merged d2838bd):

| # | Request | From | Decision | State |
|---|---|---|---|---|
| W7-1 | `CONSOLE.md`: the new shell ids, the dock, the slab's order, the landing sentence, the footer, the numbers | W7 | yes | done: §18 |
| W7-2 | `CLAUDE.md`: ceilings 24,000 / 12,288; the soul in the battery; nothing loops without `html.alive`; Home outside `#lanes`; `scroll-padding` | W7 | yes | done |
| W7-3 | INVARIANTS F2 rewritten from W7's derivation; six rows for the light | W7 | yes | done: F2 live with the new figures; F9–F14 pending (W7) |
| W7-4 | DESIGN §5.5: the ceilings | W7 | yes | done |
| W7-5 | A seventh panel (the Engine's `PANELS = 6`, Premises' and the Catalog's loops, the panel lists in build-app, site and gas) | W7 | yes, with the Gallery lane | done: W8 |
| W7-6 | `verify-console.mjs` B′: `textContent()` without a timeout waits 30 s after a sheet's ✕ closes it | W7 | yes | open |
| W7-7 | `vault.js`: the Grip's copy button throws in a `data:` frame (no `navigator.clipboard`) | W7 | yes, with the Vault lane | done: W10 (row K32, pending) |
| W7-8 | Lanes: an endless animation waits for `html.alive` | W7 | yes: in every lane's brief | done: in every lane's brief; the battery's sentence for it is F10's, pending |

The battery:

| # | Request | From | Decision | State |
|---|---|---|---|---|
| B1 | `check.mjs` steps and `package.json` scripts: `verify:keepsake`, `verify:journal`, `verify:bazaar`, `verify:studio`, `verify:agora` (the fork proof stays out: it needs the network) | all | yes | done: 33 steps; `verify:bazaar-fork` is a script only |
| B2 | `invariants-check.mjs` learns V2's row letters; INVARIANTS and DESIGN §14 gain the units' rows | all | yes | done: ids `[A-Z]\d+`; the 55 unit rows and W6's A12, A13, Z12 and F15 are live since the battery ran green on 3d33e4d (the checker: 225 passed, 0 failed); W7's F9–F14 wait for Chromium sentences |
| B3 | `fuzz.mjs`: no drip ever executes below its floor | W1, V2 §8 | yes | written: properties 10 and 11 against the real Keepsake and Pool, held on four seeds; the one-character mutants of `Keepsake.drip` are being run |
| B4 | `agents.mjs`: a keeper motive pressing `drip` and `claim` | W1 | later | open |
| B5 | `mutations.mjs`: the units' rows | W5 | later; the units' tables are the evidence until then | open |
| B6 | `CLAUDE.md`: Yul evaluates a call's arguments right to left | W1 | yes | done, with the battery's true step order |

The ledger's ids for the units' rows: W1's K1–K12 and W2's J1–J7 keep
their ids; W3's W3-1…W3-11 are Z1–Z11; W4's ST1–ST6 are S1–S6 and its
CL1–CL10 are S7–S16; W5's AG1–AG9 are N1–N9.

The lanes' rows continue the letter of the promise they keep in the
console, as V1's G1 cites a forge test and a lane sentence in one row:
- W8's F16–F18 and Y1–Y10 keep their ids; Y is the Gallery's letter.
- W9's F16 is F19, its F17–F21 are K13–K17, and its F22 is J8.
- W10-1…W10-15 are K18–K32.
- W11's N10–N17 keep their ids.
- W12-1…W12-10 are S17–S26.
- W13's two harness rows, with S2's (`test/Harness.t.sol`), become the
  foundation's 0.9–0.11 once the battery runs them; a foundation
  paragraph has no pending state, so it is written only then.

W6's own requests, beyond those rows:
- `src/interfaces/Site.sol`'s `TokenState` comment lists the bits up to
  262144: open. It is a comment in `src/`, so it waits for a run that
  recompiles anyway.
- The agent card's `manifestHash` probe is the dearest of `stateOf`'s
  seventeen. Face 1 is at 92.8 % of its cap, 95.2 % with V2 landed: open,
  and it changes verify-site A13's wording.
- `tools/gas.mjs` measuring a band with V2 landed (`v2: true`): open.
- V2's `SATELLITES` rows and PINS in `tools/deploy.mjs`, so
  `deploySatellite` can land each V2 contract at its placeholder: open,
  for wave 3.

Noted in review, not requested:

- Keepsake counts an ERC-20 payout as paid when the contract's balance
  fell at all, not by exactly the amount. Only a token that changed its
  behaviour after the exact pull at wrap can make the two differ, and the
  difference stays with that token. Revisit with H1.
- Whether OpenSea's API accepts an order zoned to the Bazaar is
  unverified: from this container its testnet API is refused at the proxy,
  and its mainnet API wants a key. W3's report §7 lists the four questions
  to ask it.
