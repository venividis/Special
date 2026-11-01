# W15 · the lanes' Catalog rows, the deployer's V2 rows, and a V2 fork rehearsal

Unit W15 of INTACT V2's integration covers docs/v2/INTEGRATION.md rows L5
and L8 and W6's four open requests (the `TokenState` comment, the agent
card's probe, gas with V2 landed, the deployer's V2 rows). It also takes
H4 to the deployer, checks H5's Seaport row against a forked chain, and
does W12-8's first half. It was built on cd5ef1f, 2026-10-19, in the
worktree `agent-ada476af6a21d461d`.

This file is the unit's report: what changed, every decision and its
reason, and the evidence. It also lists what the files this unit does not
own now need. Every count, size and gas number below is **measured**, and
each names the run that printed it.

The code is five commits on cd5ef1f, and this report is the sixth:
- 2390f7a, the rows, the letters and the card's probe;
- 3604927, gas in two shapes;
- 077b641, the deployer's V2 rows and `--v2`;
- 252996c, the default site's one source;
- a41a07e, the rehearsal's V2 family.

The battery is green on a41a07e (§8). Nothing is pushed.

## 1. What changed

| File | Change | Item |
|---|---|---|
| `src/Catalog.sol` | `CatalogRowsV2` grows from 48 rows to 71. It gains the Keepsake's `ownerOf` and `tokenURI`, seven Agora reads, a collection's `totalSupply` and `room`, six Seaport calls under a new letter `s`, and six ERC-721 rows under a new letter `e`. The constructor takes `address[9]` (`VJBbZcFse`). `stateOf` asks the agent card `HUB()` through a local `IAgentCardProbe` instead of `manifestHash(id)`. Stale comments are fixed: the bit comment and `stateFrom`'s. | L5, W6-7 |
| `src/interfaces/Site.sol` | `IEngine.panelCount()` becomes `view` (it was `pure`), with a comment naming the loaded prefix. `TokenState.reported`'s comment now runs to 262144. | L8, W6-4 |
| `test/Premises.t.sol` | `CatalogRowsV2` takes `address[9]` | the test the table change breaks |
| `docs/INTERFACE-CHANGES.md` | "V2 integration — W15": the `panelCount` mutability, the bit comment, and the table's new shape | L8 |
| `tools/verify.mjs` | The drift gate holds `seaport` rows to `ISeaport` and `erc721` rows to `IERC721Metadata`. Five new sentences: the 23 rows, two selectors, the addresses the new letters carry, and the tuple arguments. | L5 |
| `tools/site.mjs` | `CatalogRowsV2` is built with the world's `seaport` and a zero `e`. It is one deployment either way, so the Premises keeps its nonce. | L5 |
| `tools/gas.mjs` | The routes are measured twice: on the band with V2 codeless, and with `deploySite`'s `v2: true` (labels end " · V2"). `hub.residueOf(1)` is probed in both. The verdict line says "the band twice". | W6-8 |
| `tools/deploy.mjs` | New `SATELLITES` rows for the V2 seven (`keepsakeArt` first). `PINS` gains each V2 contract's own pins. `V2_ORDER`, `DEPLOY_ORDER` and `SATELLITE_ORDER` gain the V2 tail. `--v2` (a switch, `CLI_FLAGS`) makes a fresh deployment land V2 by the burner right after the Premises. The Router lands only where the venue row names a Uniswap venue. `checkVenues` makes no Uniswap claim for a row with none, and the Bazaar is re-proved against the row's Seaport half. The Keepsake waits for its art before it lands. The `--v2` deploy budget is 140 M. | W6-6, H4 |
| `tools/recover-record.mjs` | Knows `keepsakeArt`'s artifact. A V2 contract the burner landed is recorded `via: "burner"` and checked by the factory's `Deployed` event. A landed satellite whose entry records no landing block is a disagreement. The Router is missing only where the row names a Uniswap venue. | W6-6 |
| `tools/verify-recover.mjs` | 30 new sentences, a section of its own: a V2 band deployed whole, a V2 satellite through the Timelock, the Bazaar against the row's Seaport, the art before the Keepsake, and which records admit V2. The generic satellite loop now also runs for six V2 keys. Its sentences stay word for word, and its new wording for the new keys says what pins each one. | W6-6, H4 |
| `tools/testnet.mjs` | New `--v2`, `--port` and `--gateway-port`. A V2 family runs wherever V2 has landed: keepsake, memory, a Bazaar listing bought on the chain's Seaport, a Studio collection and a mint, and Agora. V2 is in the preflight's budgets, and `SATELLITE_BUDGET_GAS` rises from 4 M to 6.5 M (the Studio). The fork's campaign record keeps the fork block and hash but no longer the endpoint, and the usage lines name none (`--fork <url>`). | item 7 |
| `engine/sitepage.mjs` (new) | `export function sitePage(name)`, byte for byte as tools/verify-studio.mjs has it | W12-8, steps 1 |
| `tools/build-app.mjs` | `inlineSitePage`: the `/*@inline engine/sitepage.mjs*/` marker is optional and refused loudly in four cases | W12-8, step 2 |

Nothing under `engine/panels/`, `tools/verify-site*`, `tools/verify-console.mjs`, `tools/testnet-drive.mjs`, `docs/CONSOLE.md`, `docs/INVARIANTS.md`, `CLAUDE.md` or `DESIGN.md` was edited. What those files need is in §11.

## 2. Decisions, each with its reason

1. **Seaport takes the letter `s`, and its rows carry the venue's address.**
   - All twenty-six capitals were taken (`HPRYTSKNLCOWXEGQMDAUI` and `VJBZF`), so Seaport takes a lower case, as W6 gave `b` and `c` theirs. `s` is the venue's initial.
   - A row carries its contract ("so a row carries its contract", `RowTable`'s header). Seaport sits at one canonical address on every chain V2 targets, and the Catalog's world already names it as `SEAPORT`: the venue row's address, zero where the table has none. So `CatalogRowsV2` takes the same address. Then `services.json` says where Seaport is, and says zero on a band with no venue.
   - That is exactly how the Router's `X` rows carry zero on a band with no Router.
   - Seaport stays a venue, not a satellite: it has no bit, and its rows are held to `ISeaport`, the interface the Bazaar and the Gallery call it through (Seaport 1.6's own shapes, `src/interfaces/ISeaport.sol`).
2. **Any ERC-721 takes `e`, a per-address family whose rows carry zero.** It sits beside `E`, any ERC-20, which it resembles: both are families of contracts the page names per token, never one address. The six rows are the ones L5 named: `ownerOf`, `tokenURI`, `getApproved`, `isApprovedForAll`, `setApprovalForAll` and `approve`. The drift gate holds them to `IERC721Metadata`, the standard's interface in `src/interfaces/Standards.sol`. W8 also asked for `erc1155.*` and `erc2981.*`. L5's decision did not take them and they are not here (§11, request 10).
3. **The Seaport rows are the six calls the Gallery makes:** `getCounter`, `getOrderHash`, `getOrderStatus`, `validate`, `fulfillOrder` and `cancel`. Their tuples are spelled as the Bazaar's `publish` row already spells them. `validate` and `cancel` are writes from the wallet, and `fulfillOrder` is payable ("value is the listed price exactly for an ether listing"). `incrementCounter` and `information` are not called by any lane, and no row is added for a call nobody makes.
4. **The new rows go in the third table, and the first two keep their bytes.** `CatalogRows` (159 rows) and `CatalogRowsPost` (43) render to the same runtime as at cd5ef1f. Their construction measured 14,529,412 and 4,952,476 before and after (§4.2). The third table went from 33.5 % of the 2^24 transaction cap to 48.8 %.
5. **The agent card is asked `HUB()`, an immutable, as the V2 six are.**
   - `manifestHash(id)` is the keccak of `registration(id)`, so answering a liveness probe cost the card its whole registration. It was the dearest of `stateOf`'s seventeen probes.
   - The card reads the hub and the catalog through guarded staticcalls and never reverts. So "the card has code and answers" is the whole question either probe asked, and the bit means what it meant.
   - `IAgentCard` (Site.sol) carries no `HUB()`, and this unit may change only Site.sol's comments and mutability. So the probe interface is declared in Catalog.sol beside `INameplateProbe`, as that one was, because nothing else asks.
   - Face 1 fell from 464,178 gas to 400,410 (§4.3). A13 in `tools/verify-site/agent.mjs` still holds: its condition is "bit 4096 set, not absent", and only its words name the old probe (§11, request 1).
6. **`panelCount()` becomes `view` in the interface (L8).**
   - The Engine counts its loaded prefix from storage, so `pure` was simply wrong.
   - Every caller already makes the call with STATICCALL from a `view` function, so the change is safe. CatalogState, Premises and Renderer compile to the same runtime bytes as at cd5ef1f (compared from the two compile outputs, §4.1).
7. **gas.mjs measures the band twice, each shape on its own chain, under one verdict line.**
   - The second shape is `deploySite`'s `v2: true`: the art, the Keepsake, the Journal, the Bazaar against the probed Seaport, Bridges, the Studio and Agora, on top of the card, the Market and the Roles.
   - Every probe carries its chain, so each is still the first call after a one-wei transaction on its own chain.
   - The verdict stays one line because `check.mjs` reads exactly one line matching `^every measured view is under its cap \((\d+) probed cold`.
8. **The deployer lands the Keepsake's art as a seventh V2 contract, `keepsakeArt`.**
   - The Keepsake pins its renderer as `ART()`, and the factory admits only the burner and the Timelock. So the art is CREATE3-salted (`intact.v2.keepsakeArt`), recorded as a placeholder like the six, and landed the same two ways.
   - It is not one of `V2_SALTED`'s six: the hub and the Catalog never name it, and W6's sentence holds that list at six.
   - The order is the task's: art, Keepsake, Journal, Bazaar, Bridges, Studio, Agora.
9. **`--v2` is a switch, listed apart from the options.** It makes the same fresh deployment land V2 by the burner, which is how the burner lands the MVB's satellites. The V2 contracts are journaled steps after the Premises, and the journal's order is asserted against `DEPLOY_ORDER`. They land at the placeholders the hub and the Catalog pinned at the MVB.
   - The constructor arguments come from the same `SATELLITES[key].args(world)` that `deploySatellite` uses through the Timelock, so the two paths cannot build different contracts.
   - A switch takes no value, while every member of `CLI_OPTIONS` does, so `--v2` is in `CLI_FLAGS`. `CLI_OPTIONS` stays the seven valued options, and verify-recover's sentence about them stays true as written.
   - `--v2` with `--satellite` is refused: one is a fresh deployment, the other a recorded one.
   - Both refusals, a value given to `--v2` and `--v2` beside `--satellite`, exit 2 before a file is read. verify-recover runs the CLI to hold each.
   - A journal that already holds a V2 step is treated as a `--v2` run being resumed, with or without the flag. Otherwise, a resume without the flag would record a placeholder that has code.
10. **A V2 contract the burner landed is recorded under `satellites`, `via: "burner"`.**
    - The entry has no op, no queue and no eta. `executed` holds the transaction, its block, its gas and `by`, read from the journal.
    - recover-record already demanded satellite evidence for every placeholder listed under `contracts`. Its existing check, the factory's `Deployed` event at the recorded block, is exactly a burner landing's evidence, so the schema did not have to change. A Timelock landing additionally has its queue checked for clear.
    - That check ran only when the entry named a block, and a burner entry has no op to fall back on. So an entry that claimed a landing with no `executed` was held to nothing. recover-record now reports `satellites.<key>.executed.block` as unrecorded for a landed satellite, by either path. Every committed record is unaffected: Base Sepolia's three queued satellites have not landed, so `contracts` does not list them, and 31337's three carry their blocks.
11. **The record stays at schema 3.**
    - The schema exists so that `pinApplies` can skip PINS rows whose holder's code predates a getter. The new rows are held by the V2 contracts themselves, and only a schema-3 record can hold one: before this unit no tool could land them.
    - So the rows carry no schema mark, like the post-MVB satellites' own pins.
    - The additions are additive: the `keepsakeArt` salt and placeholder, and the `via: "burner"` value (§5).
12. **A V2 satellite is admitted only for a record of schema 3 or later, and the Bazaar only where the record's venue row names Seaport.**
    - A schema-1 or schema-2 record's hub pins no Keepsake or Journal, and its Catalog names no V2 contract. Landing one there would deploy a contract nothing reads. That is every live record: deployments/31337.json, 84532.json and its first run.
    - The refusal is by name, through `admits`, so `--satellite all` skips V2 on those records.
13. **The Router lands only where the venue row names a Uniswap venue.**
    - A row may name only Seaport, the Bazaar's venue. The in-process V2 proof uses such a row: Base Sepolia's Seaport half, its two runtimes etched as `deploySite` does.
    - The old rule ("any row deploys the Router") would have deployed a Router with no venue. Every row in `VENUES` names both, so no existing path changes.
    - The Kiln's PoolManager argument reads `venues?.poolManager || ZERO`, which was `undefined` for such a row.
    - `checkVenues` makes no Uniswap claim for a row with no Uniswap key or probe.
14. **The Bazaar is re-proved against the venue before it lands, and the Keepsake waits for its art.**
    - Over a wire, `deploySatellite(bazaar)` first runs `checkVenues` on the Seaport half of the record's row (three codehashes, `information()`, the conduit and its channel), as `deployIntact` re-proves the whole row.
    - A queued Keepsake refuses to *execute* while its `ART()` has no code, by name, and stays queued. The refusal is at execution, not at queueing, so on a public chain the two can be queued in one run and land a week later in order.
15. **testnet.mjs's V2 family lists token 2, so token 1 keeps its holder for the steps after it.**
    - The family runs after the v4 family and before the lock. The steps after it (the lock, the session, the seal, the panic, the steward, the sale) all act on token 1.
    - The listing follows the Gallery's no-signature path: seal token 2's Reach past the listing's end (the Bazaar refuses a Reach sealed short), approve Seaport for that one token, and build the order after the last write so its pin is the fingerprint a fill finds. Then the seller validates from its own wallet, anyone publishes, and the holder buys for exactly the price.
    - The order is built by `tools/verify-bazaar.mjs`'s own `etherListing`/`orderOf`, the functions its suite holds against Seaport's `getOrderHash`.
    - The collection's page is `engine/sitepage.mjs`'s `sitePage`, the one source.
16. **The fork's campaign record no longer names the forked endpoint.** `preflight.fork` was `{url, block, hash}`, and the record under out/fork/ carried the upstream URL. A record names no RPC endpoint (docs/DEPLOYMENT.md), so the field is now `{block, hash}`. The console line still prints the URL to the operator.
17. **The fork ran on port 8549 and its gateway on 8083 (`--port`, `--gateway-port`).**
    - `tools/testnet.mjs` spawns 8547/8548 and 8082, and `tools/testnet-drive.mjs` 8546 and 8081.
    - `tools/verify-bazaar-fork.mjs` also defaults to 8549, and it was not running: no socket listened there before or after the run. The two must not run at once (§11, request 7).
18. **The default site's module lives at `engine/sitepage.mjs`, and only steps 1 and 2 are here.** This is the integrator's decision. The module is beside `engine/whispers.mjs`, inlined the same way.
    - `tools/verify-site/launch.mjs` (W14's file) reads W4's template out of `tools/verify-studio.mjs` by a regex.
    - So moving the function (step 3) must merge with that read's change (step 5) and the launch panel's marker (step 4). The integrator applies all three after the merge, and the exact edits are in §11, request 2.

## 3. The rows and the letters

The third table after this unit (`node tools/verify.mjs`: "every one of the 273 service rows names a function its contract's ABI serves"; 159 + 43 + 71):

| Letter | Word (`sel` prefix) | Contract (drift gate) | Rows at cd5ef1f → now | Address in the rows |
|---|---|---|---|---|
| V | `keepsake` | `Keepsake` | 12 → 14 (`ownerOf`, `tokenURI`) | the Keepsake |
| J | `journal` | `Journal` | 4 | the Journal |
| B | `bazaar` | `Bazaar` | 4 | the Bazaar |
| b | `bridges` | `Bridges` | 2 | Bridges |
| Z | `studio` | `Studio` | 5 | the Studio |
| c | `collection` | `Collection` | 5 → 7 (`totalSupply`, `room`) | zero (per collection) |
| F | `agora` | `Agora` | 16 → 23 (`followerCount`, `followingCount`, `follows`, `isRegistered`, `collectionKey`, `homeKey`, `persona`) | Agora |
| s | `seaport` | `ISeaport` | 0 → 6 (`getCounter`, `getOrderHash`, `getOrderStatus`, `validate`, `fulfillOrder`, `cancel`) | the venue's Seaport, the Catalog's `SEAPORT`; zero where the table names none |
| e | `erc721` | `IERC721Metadata` | 0 → 6 (`ownerOf`, `tokenURI`, `getApproved`, `isApprovedForAll`, `setApprovalForAll`, `approve`) | zero (per collection) |

W10's two rows are its own wording, and W11's seven are its list. W12's
two (`collection.totalSupply` → "minted so far, one read - no log walk";
`collection.room` → "agora.collectionKey of this collection") are as asked.

## 4. Measured

### 4.1 Sizes

From `node tools/compile.mjs --ship` on this tree (4 m 2 s cold), compared with cd5ef1f's compile output from the cache (scratch `cmpcache.mjs`). Only two runtimes moved:

| Contract | cd5ef1f | Now |
|---|---|---|
| `Catalog` | 16,846 B | 16,840 B (the probe) |
| `CatalogRowsV2` | 2,675 B | 2,819 B (two letters, nine slots) |
| every other contract, CatalogState 17,775, Premises 15,572, Renderer 16,826 and AgentCard 11,546 among them | | the same bytes |

Every gated contract fits under 24,576 B, and the ship rule reads "diamond — Intact 26082 B > 24000".

### 4.2 The table construction

The gas each table's deployment used against EIP-7825's 16,777,216:

| Table | cd5ef1f (`node tools/verify.mjs`, plain CREATE) | Now (same) | Now, on the fork (CREATE3, §7) |
|---|---|---|---|
| `CatalogRows` (159 rows) | 14,529,412 | 14,529,412 | 14,579,625 |
| `CatalogRowsPost` (43) | 4,952,476 | 4,952,476 | 4,999,530 |
| `CatalogRowsV2` (48 → 71) | 5,620,377 (33.5 %) | **8,194,360 (48.8 %)** | 8,244,240 (49.1 %) |
| `CatalogText` (joins the three `sel` maps) | 7.35 M | 7.51 M | 7,554,872 |
| `Catalog` (hashes `services()` at construction) | 4.30 M | 4.36 M | 4,414,542 |

### 4.3 Every capped view, in both shapes

`node tools/gas.mjs --json`, cold, a transaction between each probe:
- **Before:** gas.mjs taught the two shapes, run on cd5ef1f's `src/`.
- **After:** the same gas.mjs on this tree's `src/`.
- **Codeless:** the post-MVB card, Market and Roles landed, and V2's six as codeless placeholders.
- **V2:** `deploySite`'s `v2: true` on top.

Both runs: 124 probes, 0 over.

| View | Cap | Before, codeless | Before, V2 | **After, codeless** | **After, V2** |
|---|---|---|---|---|---|
| `/token/1/face/1` | 0.5 M | 464,178 (92.8 %) | 476,241 (95.2 %) | **400,410 (80.1 %)** | **412,473 (82.5 %)** |
| `hub.tokenURIAt(1,1)` | 0.5 M | 448,100 | 460,163 | 384,332 | 396,395 |
| `/token/1/crest.svg` | 0.5 M | 341,987 | 354,050 | 278,219 | 290,282 |
| `/token/1/state.json` | 1 M | 839,043 (83.9 %) | 851,265 (85.1 %) | **783,177 (78.3 %)** | **795,403 (79.5 %)** |
| `/services.json` | 1 M | 796,932 (79.7 %) | 796,932 | **890,502 (89.1 %)** | **890,502** |
| `/token/1/services.json` | 1 M | 338,664 | 350,729 | 274,896 | 286,961 |
| `catalog.state(1)` | 1 M | 800,841 | 813,063 | 741,313 | 753,539 |
| `catalog.state(0)` | 1 M | 342,205 | 342,205 | 346,289 | 346,289 |
| `hub.tokenURI(1)` | 8 M | 4,861,107 | 4,873,170 | 4,867,064 | 4,879,127 |
| `/token/1/raw` | 8 M | 5,123,886 | 5,135,949 | 5,135,639 | 5,147,702 |
| `/token/1/live` | 2.5 M | 1,450,313 | 1,462,535 | 1,398,720 | 1,410,946 |
| `/token/1/hash` | 2.5 M | 2,174,937 (87.0 %) | 2,195,381 (87.8 %) | 2,069,768 (82.8 %) | 2,090,220 (83.6 %) |
| `/` | 2.5 M | 975,274 | 975,274 | 984,738 | 984,738 |
| `renderer.document(1)` | 2.5 M | 1,345,900 | 1,358,122 | 1,292,328 | 1,304,554 |
| `catalog.stateOf(1)` | 16.78 M | 290,183 | 302,246 | 223,915 | 235,978 |
| `catalog.services()` | 16.78 M | 634,202 | 634,202 | 703,757 | 703,757 |
| `hub.residueOf(1)` (new probe) | 16.78 M | 67,986 | 74,512 | 67,986 | 74,512 |
| `/token/1/face/2` · `/manifest` · the seven panels · the agent routes · `/open` | as before | unchanged | unchanged | unchanged | unchanged |

What moved, and why:
- **The probe** is worth 63,768 gas on every read of `stateOf`. Face 1 and `tokenURIAt(1,1)` fell by exactly that, and `stateOf(1)` by 66,268.
- **The 23 rows** add 768 bytes to every state block's `sel` map, about 7.9 K gas. That is why `state.json` fell by only 55,866.
- **`/services.json`** rose by 93,570: its document grew from 79,808 B to 86,816 B. It is the one view this unit makes dearer, and it is now the closest to its cap of any view, at 89.1 % (§11, request 5).
- **The battery's `gas` line** reads 124 probes (§8).

## 5. The deployer's V2 rows, and the record's shape

**`SATELLITES`, in `V2_ORDER`.** Each constructor's arguments come from the
record's world: contracts, placeholders, and the venue table as `venue*` keys.

| Key | Contract | Constructor | Admitted when | Waits for |
|---|---|---|---|---|
| `keepsakeArt` | `KeepsakeArt` | none | schema ≥ 3 | — |
| `keepsake` | `Keepsake` | `(hub, pool, keepsakeArt)` | schema ≥ 3 | `keepsakeArt` has code |
| `journal` | `Journal` | `(hub)` | schema ≥ 3 | — |
| `bazaar` | `Bazaar` | `(venues.seaport, hub, pool)` | schema ≥ 3 and the row names Seaport; over a wire, the row's Seaport half re-proved | — |
| `bridges` | `Bridges` | `(timelock)` | schema ≥ 3 | — |
| `studio` | `Studio` | `(hub, journal, agora)`, Agora at its prediction | schema ≥ 3 | — |
| `agora` | `Agora` | `(hub, keys, studio)`, the Studio at its prediction | schema ≥ 3 | — |

**`PINS`**, read back the moment each lands, by `deploySatellite`, by `deployIntact`'s post-conditions and by recover-record:
- `keepsake.HUB/POOL/ART`
- `journal.HUB`
- `bazaar.SEAPORT/HUB/POOL`
- `bridges.TIMELOCK`
- `studio.HUB/JOURNAL/AGORA`
- `agora.HUB/KEYS/STUDIO`

Studio and Agora are a mutual pair, so each is pinned both ways.

**The record (`intact.deployment/3`, additive):**
- `salts.keepsakeArt` and `placeholders.keepsakeArt`, `keccak("intact.v2.keepsakeArt")`, codeless until it lands.
- A V2 contract that has landed is listed under `contracts`, `codehashes` and `reproducible`. KeepsakeArt carries no immutable and reproduces from source; the others do not.
- `satellites.<key>` has one of two shapes:
  - through the Timelock: `{via: "timelock", op, queued, eta, executed}`, as for the post-MVB four;
  - by the burner (`--v2`): `{via: "burner", op: null, queued: null, eta: null, executed: {tx, block, gas, by}}`.
- `gas.<key>` is the landing's gas.
- `venues` may be a row that names only Seaport. Such a record has no `router`, and its salts carry no router key.

**Measured in-process (`node tools/verify-recover.mjs`: 280 passed, 0 failed, 1 m 37 s; 282 passed, 0 failed once the landing-block sentence and the CLI's two refusals were added):**
- The MVB without a Router is 109.78 M gas and 28 contracts.
- With `--v2` on a Seaport-only row it is 127.46 M and 35 contracts. The burner's seven: keepsakeArt 2,510,809, keepsake 3,567,887, journal 558,544, bazaar 2,611,909, bridges 526,988, studio 5,333,195, agora 2,568,166, which is 17,677,498 in all.
- Recovery walked 462 fields against the V1 record's 421, 0 disagreeing.

**Through the Timelock (scratch `v2-timelock-gas.mjs`, in-process, the same row):**

| Contract | Queue | Execute | Both |
|---|---|---|---|
| keepsakeArt | 318,339 | 2,618,713 | 2,937,052 |
| keepsake | 450,639 | 3,722,066 | 4,172,705 |
| journal | 107,726 | 588,185 | 695,911 |
| bazaar | 342,024 | 2,727,452 | 3,069,476 |
| bridges | 104,349 | 555,515 | 659,864 |
| studio | 627,434 | 5,561,764 | 6,189,198 |
| agora | 335,772 | 2,680,030 | 3,015,802 |

That is 20,740,008 in all. The Studio's 6.19 M is over the old 4 M per-satellite budget, so `SATELLITE_BUDGET_GAS` is 6.5 M. The `--v2` deploy budget is 140 M in both tools' preflights (120 M without it).

## 6. The default site, one source (W12-8): steps 1 and 2

**Step 1.** `engine/sitepage.mjs` is a header comment, then `export ` and the function exactly as `tools/verify-studio.mjs` holds it. A scratch check ran both through `vm.runInNewContext`. For "Moonlit", a name with `<&>"'`, and "Longform", the two returned identical pages.

**Step 2.** `tools/build-app.mjs` `inlineSitePage` replaces `/*@inline engine/sitepage.mjs*/` with the module, its `export` stripped. It runs after the whispers inlining and before the refusals and the minifier, so every check sees what ships. With no marker it changes nothing: the build on this tree is byte-identical, and launch is 12,267 B gzip with keccak `0x9513…2076`.

The scratch proof (scratch `sitepage-proof.mjs`) used a copy of the build inputs, with launch.js's lines 752–800 replaced by the marker line:

| | gzip | inflated | keccak of the inflated bytes | gzipHash |
|---|---|---|---|---|
| the tree today | 12,267 B | 31,705 B | `0x951351680d66536767075de63e9814c9ca3f886dd6c5895803f83e9e589c2076` | `0xcaf1bae9dabca4b70fef1bc2a60a3069de247abff42472ec1f1c5a8d1b75c816` |
| the copy with the marker | 12,267 B | 31,705 B | `0x951351680d66536767075de63e9814c9ca3f886dd6c5895803f83e9e589c2076` | `0xcaf1bae9dabca4b70fef1bc2a60a3069de247abff42472ec1f1c5a8d1b75c816` |

The inflated bytes are identical. In the same copy, each of the four refusals was raised by name:
- the module removed: "panel launch asks for sitepage.mjs and engine/sitepage.mjs does not exist";
- the marker twice: "panel launch carries the sitepage marker 2 times; exactly one";
- the marker at the panel's top level: "panel launch carries the sitepage marker at its top level; it goes inside the panel's IIFE";
- a module that no longer parses once inlined: "panel launch does not parse once sitepage.mjs is inlined: Unexpected token ')'".

A rebuild of the restored copy reproduced the keccak. launch.js, verify-site/launch.mjs and verify-studio.mjs's copy are untouched; the edits for steps 3–5 are in §11, request 2.

## 7. The fork rehearsal

**The run:**

```sh
node tools/testnet.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA --fork <Base Sepolia's public endpoint> --v2 --port 8549 --gateway-port 8083
```

The endpoint is the one docs/DEPLOYMENT.md's fork command names. It was
given on the command line only and is in no file this unit wrote.

**The result: 112 passed, 0 failed, 142 s.**
- The fork was at block 48,341,282. One local block was mined before anything was read.
- Every read over the wire was pinned (`RpcChain`).
- The records went to `out/fork/84532.json` and `out/fork/84532.campaign.json`, nothing under `deployments/`. Neither names an endpoint (checked: no `https?://` other than `127.0.0.1` in either).
- The node (pid 19296) and the gateway (pid 19566) were stopped by the tool by their PIDs on exit. No socket listened on 8549 or 8083 afterwards.

**The Seaport venue row, against the forked chain:**
- The preflight re-proved Base Sepolia's whole row: the Uniswap claims, and the Seaport half's six sentences, all ✓.
- The Seaport half's six: Seaport, the ConduitController and OpenSea's conduit each "holds the code probed on 2026-10-19"; "Seaport's information() says version 1.6 and names this ConduitController"; "the ConduitController names this conduit for OpenSea's conduit key"; "the conduit's channel to Seaport is open".
- `deployIntact` re-proved the row again before it sent anything.

**The deployment:**
- 130.12 M gas in 76 s: the MVB with the Router (2,664,875) and V2's seven by the burner.
- The burner's seven: keepsakeArt 2,510,809, keepsake 3,567,875, journal 558,544, bazaar 2,611,909 (against the venue's Seaport at `0x0000000000000068F116a894984e2DB1123eB395`), bridges 527,000, studio 5,333,183, agora 2,568,166.
- The record was recovered in-run: 479 fields, 0 disagreeing.
- The post-MVB four then landed through the Timelock's queue in-run:

| Satellite | Queue | Land |
|---|---|---|
| the card | 327,180 | 2,696,364 |
| the custodian | 387,918 | 3,168,445 |
| the Market | 203,102 | 1,444,434 |
| the Roles | 188,154 | 1,336,285 |

- After the last of them the record recovered with 512 fields, 0 disagreeing. The record lists 40 contracts and 139,875,188 gas.

**The V2 journey, over the wire, on the forked chain's real Seaport:**

| # | Step | Actor | Gas | What was read back |
|---|---|---|---|---|
| 49 | wrap a keepsake: 0.0001 ETH freeing over two minutes, a gift to the second key | holder | 234,786 | keepsake 1 from the `Wrapped` log, `ownerOf` the second key |
| 50 | inscribe a memory into token 1 | holder | 90,803 | memory 1 from the `Inscribed` log; `countOf(hub, 1)` 0 → 1 |
| 51 | seal token 2's Reach past the listing's end | second | 64,020 | `sealedUntil` 1795047280 > the end 1795046680 |
| 52 | approve Seaport for token 2 alone | second | 53,273 | `getApproved(2)` is Seaport 1.6 |
| 53 | validate the listing on Seaport from the seller's wallet, with no signature | second | 63,930 | `getOrderStatus`: validated, not cancelled, at counter 0; no royalty owed |
| 54 | publish it through the Bazaar | holder | 256,995 | one `Published` log naming the order, token 2, 0.0002 ETH; `check()` zero |
| 55 | buy it on Seaport for exactly the price | holder | 314,755 | token 2 is the holder's, the seller received 0.0002 ETH, one `OrderFulfilled`, custody epoch 2 |
| 56 | launch a Studio collection from token 1, with the default site (2,909 B) | holder | 4,077,637 | the `Launched` log names the address `predict` gave |
| 57 | mint from it | second | 160,914 | token 1 from the collection's `Transfer` log; `totalSupply` 1 |
| 58 | speak in Agora's commons as token 1 | holder | 143,657 | one `Said` log from token 1's persona; the commons counts 1 |

The V2 family is these ten steps plus a funding step the second key's
balance made unnecessary: 5,460,770 gas in all.

**The rest of the campaign:**
- 70 steps and 15,773,376 gas, including the router family (214,530) and the v4 family (4,181,277): the graduation into a real v4 pool, swaps both ways with the hook's fee, `collect`, the refusals, the ratchet and the release.
- After the campaign the record recovered with 512 fields, 0 disagreeing.
- `verify-gateway`: 248 passed, 0 failed, and the tamper fixture 251 passed, 0 failed.
- `tokenURI(1)` estimated 5,046,263 gas and answered 106,677 B.

**Rehearsed first on a local node:** `--chain 31337 --v2 --port 8549 --gateway-port 8083` (records in the scratchpad) read 71 passed, 0 failed in 1 m 55 s.
- The deployment was 124.85 M gas, with the Bazaar skipped by name: 31337 has no Seaport.
- The V2 family without the listing: wrap 234,786, inscribe 90,803, launch 4,077,637, mint 160,914, speak 143,657.

## 8. The battery

`node tools/check.mjs --keep-going` on a41a07e, the five code commits, with nothing else in the tree but this report. It started 2026-10-19 23:35:47 UTC and ended 2026-10-20 00:05:17 UTC. Its verdict: **"check: green — all 33 steps passed in 29m 29s"**, then "33 passed, 0 failed". The compile and forge caches were warm: §4.1's cold compile and the Premises suite's cold forge compile had run on the same inputs before it.

Each step's summary line, the one its regex in `check.mjs` reads:

| Step | Its summary line | Time | |
|---|---|---|---|
| `compile` | `all gated contracts fit under the EIP-170 ceiling of 24576 bytes` | 0.7s | ✓ |
| `facets` | `96 selectors routed once each; no diamondCut anywhere` | 0.2s | ✓ |
| `facets:selftest` | `facets.mjs self-test: 8 passed` | 0.1s | ✓ |
| `selftest` | `60 passed, 0 failed` | 0.4s | ✓ |
| `build` | `shell gzip          22,224 bytes   (ceiling 24,000)` | 3.7s | ✓ |
| `forge:monolith` | `643 passed, 0 failed` | 5m 30s | ✓ |
| `forge:diamond` | `643 passed, 0 failed` | 6m 24s | ✓ |
| `gas` | `every measured view is under its cap (124 probed cold, a transaction between each; the band twice, V2's six satellites codeless and landed; every view ≤ 16.78M, tokenURI ≤ 8.00M, /live ≤ 2.50M)` | 16.9s | ✓ |
| `gas:selftest` | `gas.mjs self-test: the fixture (45.60M) is over the 16.78M cap and would fail the build; the control passes` | 28.3s | ✓ |
| `verify` | `258 passed, 0 failed` | 10.7s | ✓ |
| `verify:site` | `805 passed, 0 failed` | 4m 24s | ✓ |
| `mcp` | `29 passed, 0 failed` | 6.3s | ✓ |
| `verify:pool` | `144 passed, 0 failed` | 13.8s | ✓ |
| `verify:vault` | `184 passed, 0 failed` | 6.5s | ✓ |
| `verify:parley` | `81 passed, 0 failed` | 3.3s | ✓ |
| `verify:launch` | `307 passed, 0 failed` | 6.8s | ✓ |
| `verify:steward` | `91 passed, 0 failed` | 3.4s | ✓ |
| `verify:timelock` | `35 passed, 0 failed` | 1.9s | ✓ |
| `verify:premises` | `64 passed, 0 failed` | 8.3s | ✓ |
| `verify:plate` | `228 passed, 0 failed` | 35.2s | ✓ |
| `verify:keepsake` | `81 passed, 0 failed` | 2.4s | ✓ |
| `verify:journal` | `48 passed, 0 failed` | 4.4s | ✓ |
| `verify:bazaar` | `67 passed, 0 failed` | 13.7s | ✓ |
| `verify:studio` | `47 passed, 0 failed` | 12.9s | ✓ |
| `verify:agora` | `53 passed, 0 failed` | 4.8s | ✓ |
| `fuzz` | `9 properties held, 0 broken` | 13.3s | ✓ |
| `verify:findings` | `36 passed, 0 failed` | 9.6s | ✓ |
| `agents` | `6821 passed, 0 failed` | 1m 30s | ✓ |
| `static-audit` | `static audit passed — 10 Solidity rules, 4 JS rules; this is not a security audit` | 0.2s | ✓ |
| `static-audit:selftest` | `static-audit self-test: the fixture fails on 5 findings, the clean file passes` | 0.1s | ✓ |
| `verify:recover` | `282 passed, 0 failed` | 1m 37s | ✓ |
| `verify:console` | `215 passed, 0 failed` | 6m 35s | ✓ |
| `invariants` | `225 passed, 0 failed` | 0.3s | ✓ |

What the battery says about this unit's claims:
- `compile`: the ship rule still reads "diamond — Intact 26082 B > 24000; IntactDiamond compiled".
- `build`: the launch panel is "12267 bytes gzip 31705 inflated 0x951351680d665367…", as in §6.
- `gas`: 124 probes, the band in both shapes, every one under its cap.
- `verify:site`: 805 passed. A13 passed under its old words ("✓ A13 Catalog.stateOf reports the card (bit 4096 set, not absent): manifestHash answered"). Boot's QR pin did not move, since no transaction was added before the Premises.
- `agents`: seed 454122555, 220 ticks.
- `invariants`: 225 passed, so every sentence the ledger cites still exists verbatim.
- `verify`, `verify:recover`, `verify:premises` and `static-audit` read what their own runs read (§4, §5).

## 9. Mutations, by hand

Each mutation was one token changed in a scratch copy of the tree (scratch `mutate.mjs`), with the worktree left clean throughout. Each ran the verifier that should catch it, and nothing else compiled in the copy meanwhile. The copy's `src/`, `test/`, `tools/` and `engine/` were compared with the worktree's after the first runs and again before R2, once the last edits were copied in: identical both times, but for the mutant then running. `npm run mutations` (the E1/E3 gate) was not run; none of these touch Parley or Postage.

| # | File | The mutation | Run | Result |
|---|---|---|---|---|
| D1 | `tools/deploy.mjs` | the Studio is constructed with the Journal where Agora's prediction goes | `verify-recover` | **killed** by the deployer's own read-back, before any sentence: "refusing to record: the studio's AGORA is 0x7f43…b01d, the record's agora is 0xc791…b70c"; exit 1 with no summary line, 75 s |
| D2 | `tools/deploy.mjs` | the Keepsake no longer waits for its art (`after: []`) | `verify-recover` | **killed**: ✗ *"a queued Keepsake refuses to land before the art it pins, by name, and stays queued"*; exit 1, 99 s |
| D3 | `tools/deploy.mjs` | a schema-2 record admits V2 (`s >= 2`) | `verify-recover` | **killed**: 279 passed, 1 failed, ✗ *"a record written before V2, schema 2 or 1, admits no V2 satellite: its hub pins no Keepsake and its Catalog names no V2 contract"*; 97 s |
| D4 | `tools/deploy.mjs` | `--v2` lands the Bazaar exactly where there is no Seaport (the filter negated) | `verify-recover` | **killed**: ✗ *"a fresh deployment with --v2 lands V2's seven by the burner right after the Premises, in that order, …"*, ✗ *"each at its intact.v2 placeholder, with code there, and no Router on a row that names only Seaport"*, ✗ *"the record lists each under contracts, codehashes and satellites, via the burner: …"*; then exit 1 with no summary line, 85 s |
| R1 | `tools/recover-record.mjs` | a satellite's `Deployed` event is looked for at any block, not the recorded one | `verify-recover` | **killed**: 270 passed, 10 failed: *"<key>: a wrong landing block is caught (no Deployed event there)"* for the card, the Market, the Roles and six V2 keys, and *"a burner-landed V2 satellite recorded at a block where the factory deployed nothing is caught by name"*; 102 s |
| R2 | `tools/recover-record.mjs` | a landed satellite whose entry records no block is held to nothing again (the new `else` made a no-op) | `verify-recover` | **killed**: 281 passed, 1 failed, ✗ *"and one whose landing transaction is not recorded, though its address holds the code, is caught by name"*; 102 s |
| C1 | `src/Catalog.sol` | `LETTERS_V2 = "VJBbZcFes"`: the seaport and erc721 letters swap address slots | `verify-recover` | **killed**: 279 passed, 1 failed, ✗ *"the Bazaar zones the venue row's Seaport, which the Catalog's world names, and the third table's six seaport rows carry the same address"*; 353 s (a cold compile of `src/`) |
| C2 | `src/Catalog.sol` | `getCounter(uint256)`: a Seaport row names a signature Seaport does not serve | `verify` | **killed**: ✗ *"the 23 rows the lanes asked for are served under their words: …"* and ✗ the drift gate, *"every one of the 273 service rows names a function its contract's ABI serves"*; exit 1 before the summary line, 342 s |
| C3 | `src/Catalog.sol` | the card is asked `APEX()`, a word it does not serve | `verify-site --group agent` | **killed**: 71 passed, 3 failed, ✗ *"A13 Catalog.stateOf reports the card (bit 4096 set, not absent): manifestHash answered"*, ✗ *"face 2 parses as registration-v1 with agentId == tokenId"*, ✗ *"B1 with a card on the chain the shell offers the agent lane and the chip reads reported"*; 356 s |

D1–D4, R1 and C1 ran against verify-recover's 280 sentences, before the landing-block sentence (§2, decision 10) and the CLI's two refusals (decision 9) were written; R2 ran against all 282. A sentence added afterwards cannot revive a mutant that other sentences killed. Nine mutants, nine killed, no survivor.

C1 is caught only where a Seaport exists: on `tools/verify.mjs`'s band the world's `seaport` is zero, so both slots hold zero and the swap is invisible there. The in-process V2 band in verify-recover is the one that names a Seaport.

## 10. Proposed INVARIANTS rows (pending, W15)

Numbered W15-1… for the integrator to renumber, like W3's were. Each stays pending until the ledger's own gate has run it under a mutation.

| Row | Claim | Cited | Status |
|---|---|---|---|
| W15-1 | The Catalog serves every row the V2 lanes asked for, each held to its contract's ABI. Seaport's rows carry the venue's address, the same as the world's `seaport`, and any ERC-721's carry none. | `tools/verify.mjs` · *"the 23 rows the lanes asked for are served under their words: the Keepsake's ownerOf and tokenURI, Agora's seven reads, a collection's totalSupply and room, the six Seaport calls the Gallery makes and any ERC-721's six"*, *"the seaport rows carry the venue's address, the world's seaport, which is zero on a band with no Bazaar, and an erc721's carry none, as an erc20's"*, *"every one of the 273 service rows names a function its contract's ABI serves"* (a template; the count is the run's); `tools/verify-recover.mjs` · *"the Bazaar zones the venue row's Seaport, which the Catalog's world names, and the third table's six seaport rows carry the same address"* | pending (W15) |
| W15-2 | A fresh deployment with `--v2` lands V2's seven by the burner, at the placeholders the hub and the Catalog pinned and in the declared order. Without a Seaport the Bazaar is skipped by name, and the record recovers with 0 disagreeing. | `tools/verify-recover.mjs` · *"a fresh deployment with --v2 lands V2's seven by the burner right after the Premises, in that order, and the journal holds them in DESIGN §12's declared order"*, *"a V2 band deployed whole recovers with 0 disagreeing"*, *"the Studio and Agora each pin the other, as predicted before either existed, and the Studio the Journal"*, *"on a chain whose row names no Seaport, --v2 skips the Bazaar by name and leaves its placeholder codeless, while the other six land"*, *"on that band Catalog.stateOf reports all six V2 satellites, bits 8192 to 262144, and marks none of them absent"*, *"--v2 is the deployer's one switch: it takes no value, beside the seven options that do"*, *"and --v2 beside --satellite is refused: one lands V2 in a fresh deployment, the other through the Timelock for a recorded one"* | pending (W15) |
| W15-3 | Each V2 satellite lands through the Timelock's queue at its placeholder, and only for a record whose hub and Catalog name V2. The Keepsake lands only after its art. The record follows it and recovers. | `tools/verify-recover.mjs` · *"a V2 satellite queued and landed through the Timelock recovers with 0 disagreeing"*, *"a queued Keepsake refuses to land before the art it pins, by name, and stays queued"*, *"a record written before V2, schema 2 or 1, admits no V2 satellite: its hub pins no Keepsake and its Catalog names no V2 contract"*, *"keepsake: recover-record on the updated record: 0 disagreeing"* (a template, one per V2 key the record admits) | pending (W15) |
| W15-4 | A V2 contract the burner landed is held to the factory's `Deployed` event at its recorded block, as a Timelock landing is, and a landing that records no block is a disagreement | `tools/verify-recover.mjs` · *"a burner-landed V2 satellite recorded at a block where the factory deployed nothing is caught by name"*, *"and one claimed with no evidence at all"*, *"and one whose landing transaction is not recorded, though its address holds the code, is caught by name"* | pending (W15) |
| W15-5 | The Catalog asks the agent card an immutable, and the card reports. F2's caps hold in both shapes, V2 codeless and landed. | `tools/verify-site/agent.mjs` · A13 (its new wording, §11 request 1); `tools/gas.mjs`'s verdict (124 probes, the band twice) | pending (W15) |

## 11. Requests for files this unit does not own

1. **`tools/verify-site/agent.mjs` (W14), A13.**
   - It names the probe that is gone. Its condition, "bit 4096 set, not absent", still holds, and it passed in the battery (§8) under its old words.
   - The sentence, exactly: *"A13 Catalog.stateOf reports the card (bit 4096 set, not absent): manifestHash answered"*.
   - Proposed: *"A13 Catalog.stateOf reports the card (bit 4096 set, not absent): its HUB() answered"*.
   - Nothing in docs/INVARIANTS.md or DESIGN.md cites the old wording (grep).
2. **The integrator: item 6's steps 3, 4 and 5**, to apply together and prove with `node tools/build-app.mjs`, `node tools/verify-site.mjs --group launch` and `node tools/verify-studio.mjs`:
   - **Step 3, `tools/verify-studio.mjs`:**
     - After the line `import { deploySite, mint } from "./site.mjs";`, add the line
       `import { sitePage } from "../engine/sitepage.mjs";`
     - Delete the doc comment and the function. That runs from the line `/// The page template the Studio lane offers by default. \`name\` is the` through the function's closing `}`, today lines 63–116.
     - Under the heading `/*═══════════════════ the default site ═══════════════════*/`, put the one line
       `/// engine/sitepage.mjs is the one copy: tools/build-app.mjs inlines it into the launch panel (W12-8).`
     - In the header, `The default site (\`sitePage\`) is the template the Studio lane ships` becomes `The default site (\`sitePage\`, engine/sitepage.mjs) is the template the Studio lane ships`.
   - **Step 4, `engine/panels/launch.js`:**
     - Delete from `    /*  W4's default site, lifted from tools/verify-studio.mjs \`sitePage\` byte for byte (the suite holds the two` through the function's closing `}`, today lines 752–800 (49 lines).
     - Put the one line `    /*@inline engine/sitepage.mjs*/` in their place.
     - Measured in a scratch copy (§6): launch stays 12,267 B gzip, 31,705 B inflated, keccak `0x951351680d66536767075de63e9814c9ca3f886dd6c5895803f83e9e589c2076`.
   - **Step 5, `tools/verify-site/launch.mjs`.** The `W4` line, today line 900:
     ```js
     const W4 = vm.runInNewContext("(" + ctx.fs.readFileSync(ctx.path.join(ctx.ROOT, "tools/verify-studio.mjs"), "utf8").match(/\nfunction sitePage\(name\) \{[\s\S]*?\n\}\n/)[0].trim() + ")");
     ```
     becomes
     ```js
     const W4 = vm.runInNewContext("(" + ctx.fs.readFileSync(ctx.path.join(ctx.ROOT, "engine/sitepage.mjs"), "utf8").match(/\nexport function sitePage\(name\) \{[\s\S]*?\n\}\n/)[0].trim().replace(/^export /, "") + ")");
     ```
     - The comment above it, *W4's own default site, read out of tools/verify-studio.mjs and run apart from the panel, so "lifted byte for byte" is a comparison*, becomes *W4's default site, read out of engine/sitepage.mjs (the one source build-app inlines into the panel and verify-studio imports) and run apart from the panel, so "lifted byte for byte" is a comparison*.
     - Checked in a scratch run: the new read and the old one return the same page for "Moonlit", a name with `<&>"'`, and "Longform".
3. **`docs/INVARIANTS.md` and DESIGN §14:**
   - the rows of §10, pending (W15);
   - F2's cell gains "in two shapes, V2 codeless and V2 landed (124 probes)";
   - F6's 159-row sentence is a template, so it already reads 273.
4. **`deployments/README.md`**, the "Schema 3" section, appended:
   > A V2 contract lands one of two ways: through the Timelock (`--satellite`), as the post-MVB satellites do, or by the burner in a fresh deployment (`tools/deploy.mjs --v2`), right after the Premises, in `V2_ORDER`: the Keepsake's art, the Keepsake, the Journal, the Bazaar, Bridges, the Studio, Agora. The art is a seventh placeholder, salted `intact.v2.keepsakeArt`, which only the Keepsake pins (`ART()`). A burner landing is recorded under `satellites.<key>` as `{via: "burner", op: null, queued: null, eta: null, executed: {tx, block, gas, by}}`, and recovery holds it to the factory's `Deployed` event at that block. A landed satellite whose entry records no block, by either path, is a disagreement. The V2 contracts' own pins (`HUB()`, `POOL()`, `ART()`, `SEAPORT()`, `TIMELOCK()`, `JOURNAL()`, `AGORA()`, `KEYS()`, `STUDIO()`) are PINS rows of their own. A record of schema 1 or 2 admits no V2 satellite, and a record whose venue row names no Seaport admits no Bazaar. A venue row may name only Seaport; such a record has no Router.
5. **`CLAUDE.md`, the traps:**
   - *`/services.json` is at 89 % of its 1 M cap* (890,502 gas, 86,816 B, in both shapes; `tools/gas.mjs` on this tree). It is the view every new row makes dearer, at about 13 gas per rendered byte. A tuple signature is rendered twice, in `sig` and in `args`. The six Seaport rows are about half of the 7,008 B this unit added.
   - *`CatalogRowsV2` renders at 49 % of the transaction cap* (8.19 M, 71 rows): that is the room the next rows have.
   - *Every capital letter is a contract now.* `s` (Seaport, a venue, at the venue row's address) and `e` (any ERC-721, zero) joined `b` and `c`. A new family takes a lower case beside what it resembles.
   - *The burner may land V2 itself (`--v2`), and a journal that holds a V2 step resumes as `--v2` with or without the flag.*
   - *Two forks never share a port.* `tools/testnet.mjs` takes `--port` and `--gateway-port`, and `tools/verify-bazaar-fork.mjs` spawns on 8549 too.
6. **`docs/DEPLOYMENT.md`:**
   - "The post-MVB satellites" gains V2's seven, the `--v2` switch and the Bazaar's venue rule.
   - "Prerequisites" (3) says the deploy budget is 140 M with `--v2` (127.46 M in-process with V2's seven, 130.12 M on the fork with the Router), and the per-satellite budget 6.5 M (the Studio, 6,189,198 through the Timelock).
   - "Measured" gains §7's fork table: forked at block 48,341,282; 112 passed, 0 failed; the V2 journey's ten steps and their gas.
   - Its fork command lines name the public endpoints, as CLAUDE.md's command list does. That predates this unit. tools/testnet.mjs's usage line named one too; it now reads `--fork <url>` and points here for the endpoint.
7. **`tools/verify-bazaar-fork.mjs` (W3):** its fork defaults to port 8549, the port this unit's fork used. It should take a `--port`, or move, so it and a testnet fork cannot collide.
8. **The lanes (W14, `engine/panels/`):** the rows exist now, so each lane can declare them with `ui.rows` instead of computing selectors or hashing keys in the page:
   - the vault (W10): `keepsake.ownerOf`, `keepsake.tokenURI`;
   - social (W11): `agora.followerCount`, `followingCount`, `follows`, `isRegistered`, `collectionKey`, `homeKey`, `persona`;
   - launch (W12): `collection.totalSupply`, `collection.room`;
   - the gallery (W8): `seaport.getCounter`, `getOrderHash`, `getOrderStatus`, `validate`, `fulfillOrder`, `cancel` and the six `erc721.*`.

   docs/CONSOLE.md §19 lists the word prefixes (`seaport`, `erc721`) and the letters.
9. **`docs/v2/INTEGRATION.md`:**
   - L5 and L8 are done.
   - W6's four requests are done: the bit comment, the card's probe, gas with V2 landed, and the deployer's rows and PINS.
   - H4 reaches the deployer (`SATELLITES`, `--v2`), and H5's Seaport row held against a fork.
   - H6 was done by W8: the Engine holds up to eight.
10. **Not built: `erc1155.*` and `erc2981.*` rows** (W8's request 6). L5's decision named `seaport.*` and `erc721.*`. The Gallery still computes `uri`, `balanceOf(address,uint256)`, `supportsInterface` and `royaltyInfo` itself. If they are wanted they are two more lower-case families, in the same third table, with the same 13 gas per byte at `/services.json` to pay.
