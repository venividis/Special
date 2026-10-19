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
merged tree has never been compiled or tested as one. Before any
integration change, the merged head is run once as it stands:
`node tools/compile.mjs`, then `node tools/forge.mjs` on the monolith and
on the diamond. Its counts are written here when the run ends.

## Requests, decisions, state

Interfaces (additive only, one new section in `docs/INTERFACE-CHANGES.md`):

| # | Request | From | Decision | State |
|---|---|---|---|---|
| I1 | `IBazaarEvents`: `error Unpriced()`, SIP-5's `event SeaportCompatibleContractDeployed()`, and drop Bazaar's local copies | W3 | yes | open |
| I2 | `ISeaport`: Seaport 1.6's own `ZoneInterface` (which re-declares `supportsInterface`, id `0x39dd6933`) beside `ISeaportZone` (`0x3822a094`) | W3 | yes; the Bazaar already answers both | open |
| I3 | `IAgora`: `evict`, `heads`, `topics`, `roomsOf`, `roomCount` | W5 | yes | open |
| I4 | `IAgoraEvents`: `error NoSuchPersona(uint256)` | W5 | no: `NotAPersona` is already in the ABI and says the same | closed |
| I5 | `IStudio`: `SaltUsed(address at)` → `SaltUsed(address collection)` (solc: `at` becomes a keyword) | W4 | yes; ABI-neutral, same selector | open |
| I6 | `ICollection`: the "≤ 256 holes" bound in the struct comment | W4 | yes | open |
| I7 | Record the surface beyond the interfaces: Keepsake `(hub, pool, art)`, `ART()`, `ZeroAddress`, `KeepsakeArt.render`; Collection `HUB/JOURNAL/AGORA/pageOf/imageOf/CollectionInit`; Studio `CODE/CODE_HASH/PROXY_INITCODE_HASH/MAX_*/ZeroAddress`; `claim`'s per-asset wording | W1, W4 | yes | open |

Shared code:

| # | Request | From | Decision | State |
|---|---|---|---|---|
| S1 | `src/lib/Rights.sol`: `holds` reads an over-wide `ownerOf` word as no holder instead of reverting | W2 | no: every V1 satellite compiles this library, so the change would move their codehashes against the live records. The write is refused either way | closed |
| S2 | `tools/forge.mjs`: keep the caller's gas refund when `expectRevert` swallows a revert | W5 | yes: a harness bug that fails tests falsely | open |
| S3 | `test/Ratchet.t.sol`: `Keepsake.extend` in `test_everyRatchetOnlyLengthens` | W1 | yes | open |

The hub, the Catalog and the deployment (W6):

| # | Request | From | Decision | State |
|---|---|---|---|---|
| H1 | The fingerprint gains `Journal.rootOf(HUB, id)` and `Keepsake.commitmentOf(account(id))`, each read guarded | V2 §3.1, §3.2 | yes; `IntactConfig` gains `keepsake` and `journal`, pinned as predictions like the Market | open |
| H2 | `residueOf(id)`: keccak of every fingerprint term a sale does not move. The Bazaar stores it at `publish` and compares it after the transfers, which closes the in-fill gap its report §2.1 measured | W3 | yes; the Bazaar's two-term residue goes | open |
| H3 | The Catalog learns the V2 contracts: letters (B, F, J, V, Z are free; seven are needed), rows, errors, topics, the state block and its bits | W1–W5 | yes; a third rows table, so neither existing table's construction gas grows | open |
| H4 | `deploySite` options for every V2 contract; Studio and Agora at CREATE3 predictions (each constructor pins the other) | W2, W4, W5 | yes | open |
| H5 | The Seaport venue row for 84532 and its `checkVenues` claims, from the probe in `tools/fixtures/seaport-1.6/probe.json` | W3 | yes | open |
| H6 | The Engine's six-panel constant becomes an array, so the Gallery lane fits | V2 §2, W7 | yes, with the lanes | open |

The battery:

| # | Request | From | Decision | State |
|---|---|---|---|---|
| B1 | `check.mjs` steps and `package.json` scripts: `verify:keepsake`, `verify:journal`, `verify:bazaar`, `verify:studio`, `verify:agora` (the fork proof stays out: it needs the network) | all | yes | done: 33 steps; `verify:bazaar-fork` is a script only |
| B2 | `invariants-check.mjs` learns V2's row letters; INVARIANTS and DESIGN §14 gain the units' rows | all | yes; pending until they run in `npm run check` | done: ids `[A-Z]\d+`; 55 rows pending; the checker read 107 passed, 0 failed |
| B3 | `fuzz.mjs`: no drip ever executes below its floor | W1, V2 §8 | yes | open |
| B4 | `agents.mjs`: a keeper motive pressing `drip` and `claim` | W1 | later | open |
| B5 | `mutations.mjs`: the units' rows | W5 | later; the units' tables are the evidence until then | open |
| B6 | `CLAUDE.md`: Yul evaluates a call's arguments right to left | W1 | yes | done, with the battery's true step order |

The ledger's ids for the units' rows: W1's K1–K12 and W2's J1–J7 keep
their ids; W3's W3-1…W3-11 are Z1–Z11; W4's ST1–ST6 are S1–S6 and its
CL1–CL10 are S7–S16; W5's AG1–AG9 are N1–N9.

Noted in review, not requested:

- Keepsake counts an ERC-20 payout as paid when the contract's balance
  fell at all, not by exactly the amount. Only a token that changed its
  behaviour after the exact pull at wrap can make the two differ, and the
  difference stays with that token. Revisit with H1.
- Whether OpenSea's API accepts an order zoned to the Bazaar is
  unverified: from this container its testnet API is refused at the proxy,
  and its mainnet API wants a key. W3's report §7 lists the four questions
  to ask it.
