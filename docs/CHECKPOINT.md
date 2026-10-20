# Checkpoint — where INTACT stands and how to continue

Written at the end of the V2 build session (2026-10-19 to 2026-10-20). Everything below is on branch
`ccr-8704be7f-m990q4` of `venividis/Special`, PR #6 (draft), which stacks on `main` after PR #5's merge
(2075a38). The previous checkpoint (`git show 2075a38:docs/CHECKPOINT.md`) described V1 as built in the
fifth session. V1 stands as it described. This one says what V2 added on top of it, how it was proved, and
what is left.

## What V2 is, as asked

The owner asked for V2 of the token that is a website on 2026-10-19. The request:
- an interface that is "art within art";
- lock after a swap, and sell slowly after unlock;
- memories inscribed during a swap (a trading journal) or at any time;
- coins locked together as bundles, gifted and released slowly;
- the most advanced NFT viewer, able to buy and sell any NFT, OpenSea's listings included;
- the coin launchpad kept, with NFT-collection launches added;
- chat and a social layer with network effects;
- a receipt project ("zkAPI").

`docs/V2.md` is the plan, with an "as built" note where the build differs. All of it is built and proved
except two things: zkAPI (deferred, V2 §6) and posting to OpenSea's order book (it needs an API key and a
request the page does not make).

| Asked | Built |
|---|---|
| lock after a swap, sell slowly after unlock | `Keepsake.swapAndWrap`, a drip that sells what has freed never below the holder's floor; the Trade lane's *Lock what I receive* |
| bundles, gifts, slow release | `Keepsake`: up to eight assets under one schedule, a gift is a keepsake minted to someone else; the Vault lane |
| memories, a trading journal | `Journal`: memories in any ERC-721, a rolling root replayable from logs; the Trade lane's memory after a swap |
| buy and sell any NFT, OpenSea included | `Bazaar` on Seaport 1.6 (OpenSea's protocol): publish and buy with no signature; the zone that keeps an INTACT token's guarantees on any Seaport venue; the Gallery lane |
| NFT-collection launches beside the coin launchpad | `Studio` + `Collection`: a collection launched from a token, every token a website; the Studio room |
| chat and a social layer | `Agora`: Parley carried onto personas, a room for every collection, follows that stay with the token, tipped reactions; the Social lane's feed |
| art within art | the living-light shell: the token's own WebGL sky, its crest in a frame, a dock of rooms, the slab as a sheet |

## What exists and is verified

Sizes are runtime bytes from `node tools/compile.mjs` in the final battery on e0341e3. No Solidity changed
after f93cee9.

| Layer | Contracts (measured) | Evidence |
|---|---|---|
| V1 (unchanged but for the hub's two terms) | the hub (diamond ships: monolith `Intact` 26,082 B over EIP-170; `CoreFacet` 12,942), `Reach` 20,821, `Pool` 12,606, `Router` 11,823, `Launchpad` 17,176, `Parley` 9,955, the Market, Roles, AgentCard, Nameplate, LPCustodian … | the previous checkpoint's suites, all still green (forge 643 on each build) |
| Keepsake (W1) | `Keepsake` 16,036 · `KeepsakeArt` 11,207 | `test/Keepsake.t.sol` 47, `tools/verify-keepsake.mjs` 81, 33 of 33 mutations killed; `tools/fuzz.mjs` properties 10–11 (the drip against the real Pool; both one-character mutants of `Keepsake.drip` break it) |
| Journal (W2) | `Journal` 2,142 | 36 tests, 48 checks, 40 of 40 mutations killed |
| Bazaar + Bridges (W3, W6) | `Bazaar` 11,621 · `Bridges` 1,996 | 53 + 14 tests, 67 checks, 76 of 76 killed; a fork proof against the real Seaport and OpenSea's conduit |
| Studio + Collection (W4) | `Studio` 7,067 · `Collection` 14,688 | 21 + 29 tests, 47 checks, 70 of 71 killed (1 equivalent) |
| Agora (W5) | `Agora` 11,311 | 79 tests, 53 checks, 45 of 45 killed |
| The hub's V2 terms (W6) | the fingerprint reads `Keepsake.commitmentOf(account(id))` and `Journal.rootOf(hub, id)`; `residueOf(id)` | `test/Fingerprint.t.sol`, `test/Bazaar.t.sol` |
| The Catalog (W6, W15) | `Catalog` 16,840 · `CatalogState` 17,775 · `CatalogRowsV2` 2,819 (71 rows under V J B b Z c F s e; 8.19 M gas to build, 48.8 % of the cap) | `tools/verify.mjs` 258: the drift gate holds each row to its contract's interface, and every one of `/services.json`'s 273 selectors recomputes from its signature |
| The console (W7–W14, W16, W17) | the shell 22,441 B gzip of 24,000; seven panels of 12,288: swap 11,650 · social 12,114 · launch 12,233 · vault 12,217 · identity 8,350 · agent 4,883 · gallery 12,233 | `tools/verify-site.mjs` 825 through the DOM shim; `tools/verify-console.mjs` 241 in Chromium 141, twelve groups (the light's own among them) |
| The deployer (W15) | `tools/deploy.mjs`: V2's seven through the Timelock or by the burner (`--v2`); `tools/gas.mjs` in two shapes; `engine/sitepage.mjs`, the Studio's one default site | `tools/verify-recover.mjs` 282; a fork of Base Sepolia, 112 passed, the V2 journey on the chain's own Seaport (5,460,770 gas) |

## The battery

The battery is `node tools/check.mjs`: 33 steps in DESIGN §13's order. Each step is a child process that
must print exactly one summary line reporting zero failures. A skipped step makes the run partial, and a
partial run is never green.

`node tools/check.mjs --keep-going` on e0341e3 (every unit merged, the integration's fixes, the documents
before this one) read **check: green — all 33 steps passed in 25 m 47 s**. The compile cache answered both
forge steps.

| Step | Passed | Step | Passed |
|---|---|---|---|
| compile | 46 | verify:steward | 91 |
| facets | 96 | verify:timelock | 35 |
| facets:selftest | 8 | verify:premises | 64 |
| selftest | 60 | verify:plate | 228 |
| build | 22,441 B of 24,000 | verify:keepsake | 81 |
| forge:monolith | 643 (4 m 25 s) | verify:journal | 48 |
| forge:diamond | 643 (5 m 23 s) | verify:bazaar | 67 |
| gas | 124 probes | verify:studio | 47 |
| gas:selftest | 45.60 M over 16.78 M | verify:agora | 53 |
| verify | 258 | fuzz | 11 properties |
| verify:site | 825 | verify:findings | 36 |
| mcp | 29 | agents | 6,813 (seed 465384428, 220 ticks) |
| verify:pool | 144 | static-audit | 14 |
| verify:vault | 184 | static-audit:selftest | 5 |
| verify:parley | 81 | verify:recover | 282 |
| verify:launch | 307 | verify:console | 241 |
| | | invariants | 309 |

0 failed in every step. The battery's invariants step read the ledger before the flip below. The first
green battery on the merged V2 head was f93cee9: all 33 steps in 64 m 16 s, of which 34 m 42 s was
forge:monolith's cold `src` + `test` compile.

## The ledger

`docs/INVARIANTS.md` holds every claim with the test that attacks it. A row is live only once its test runs
in the battery and has been seen to fail under a one-character mutation. After this session the ledger
holds 182 lettered rows (A–H, and V2's K, J, Z, S, N and Y) and the foundation's twelve paragraphs
(0.1–0.12). **Every one is live; no row is pending.** The foundation gained 0.9–0.12, the harnesses' own
honesty:
- the shim's and Chromium's waits throw by name;
- a folded field is not visible;
- the forge runner keeps a swallowed revert's refund.

On the final battery the last 34 rows flipped:
- W16's F9–F13, behind its one-character mutants of the shell;
- W17's F20–F25, K29, K31, S24, S26–S28, N18 and Y1–Y11, behind its one-token mutants of the console;
- the integration's F28, behind the decoder bound skipped in a copy;
- F14 and F16–F18, behind seven one-token mutants the integration ran in scratch copies of e0341e3, each
  restored by sha256. They are aimed at:
  - V1's promises under the light: the epoch re-read before Sign, and the footer's live check;
  - the Engine's prefix freeze;
  - the lane count in the Catalog's panel map, the manifest and the panel router;
  - the recovery's lane walk.

  `docs/v2/INTEGRATION.md` lists each mutant and what it failed.

`node tools/invariants-check.mjs` reads 377 passed, 0 failed on the flipped ledger: every cited sentence,
word for word in its file.

## Decisions taken during the build

The units' reports (`docs/v2/W1-…W17-*.md`) carry every decision with its reason; `docs/v2/INTEGRATION.md`
holds every request and its state. The ones that shape the whole:
- **The Bazaar is Seaport, not a new book.** It publishes orders through `Seaport.validate`, so a listing is
  found from logs and filled with no API and no signature. It is also the zone an INTACT order names. Before
  any transfer it checks the pinned fingerprint, both seals and the floors. After the transfers it checks
  the floors again and the hub's `residueOf`: Seaport pays a seller before the conduit moves the token, and
  the residue (the fourteen terms a sale leaves standing) closes that moment.
- **Gifts cannot break a listing.** The Keepsake's commitment moves only on the holder's own acts (a keepsake
  leaving, an extend, a drip set or cleared), never on a wrap or a transfer to the account.
- **The Journal and Agora accept any ERC-721.** A lying collection pollutes only its own namespace; only
  registered collections (the hub and the Studio's) speak in Agora's commons.
- **OpenSea stays off in the console.** The Bridges door is the Timelock's record of OpenSea's endpoint. The
  console reads and prints it beside a switch that is off and disabled, and the engine names no host.
  Whether OpenSea's API accepts an order zoned to the Bazaar is unverified (W3's report §7 lists the four
  questions).
- **Off-chain art is a link, never fetched.** The console contacts no host; a token's own HTML runs in a
  sandbox of `allow-scripts` alone under a CSP that refuses every request.
- **`src/lib/Rights.sol` is unchanged**, so V1's deployed codehashes still reproduce.
- **A third rows table, nine letters.** V2's rows live in `CatalogRowsV2`, its own transaction. Every capital
  letter is a contract now, so a new family takes a lower case beside what it resembles.
- **The Engine holds up to eight lanes** as a loaded prefix; the Gallery is the seventh.
- **V2's ceilings**: the shell 24,000 B gzip and a panel 12,288 B, derived from the gas caps (INVARIANTS F2).
- **The suites' waits throw by name** (W13 for the shim, W14 for Chromium), and a sign reads the ticker's log.
- **A length word is a claim the bytes must hold.** The shell's decoder refuses an array longer than the
  data after it (F28). A decode at a wrong offset once asked for such an array and ran node out of memory
  (W17).
- **The deployer lands V2 two ways**: through the Timelock, or by the burner with `--v2`. KeepsakeArt is the
  seventh placeholder, and a record of schema 1 or 2 admits no V2 contract.
- **The agent card is probed by an immutable** (`HUB()`), so the state block no longer renders its whole
  registration: face 1 fell from 464,178 to 400,410 gas.

## Observations recorded, not changed

1. **`/services.json` is at 89 % of its 1 M cap** (890,502 gas for 86,816 B in the final battery's gas step).
   Every row the Catalog adds makes it dearer; it is the view the next rows meet first.
2. **The launch and gallery panels are 55 B under their ceiling**, the vault 71 B, and the shell 1,559 B. Any
   fix to those three panels pays in cuts first, or moves a style into `app.css` (L16).
3. **The Keepsake counts an ERC-20 payout as what left its balance**, not the amount asked. Only a token that
   changed its behaviour after the exact pull at wrap can make the two differ, and the difference stays with
   that token.
4. **Two forks on one port**: `tools/verify-bazaar-fork.mjs` spawns on 8549, the port the V2 fork rehearsal
   used (L19).
5. **Not built**:
   - `erc1155.*` and `erc2981.*` rows;
   - WETH offers in the Gallery;
   - the lanes declaring W15's rows with `ui.rows` instead of computing selectors (L20);
   - verify-console's `journey()` speak step on an Agora band (L17).
6. **testnet-drive has not run over a wire since W14** made its waits throw (L18).
7. **P11 stands** as the E1/E3 gate's one survivor (a test request: no test hides at `seq ≥ 128`).
8. CLAUDE.md's command list and DEPLOYMENT.md's prerequisites name a public endpoint, against "no RPC in any
   document"; no record does (the fork's records name none since W15).
9. **verify.mjs reads a lane's bytes before its status.** Its panel loop gunzips each `/panel/<name>.js`
   body before it reads the status. So a router that refuses a lane (the integration's R1) ends the run at
   that lane, exit 1 with no summary, rather than failing a sentence by name. The battery still fails, since
   a step without its summary fails.
10. **verify-recover's six-lane sentences cannot fail by name under one mutant.** The deployer runs the same
    recovery before it publishes and refuses a record it disagrees with. So a mutant of the recovery or the
    record ends the run at the six-lane deploy, by the field's name (the integration's J1).
11. **The sheets' focus walk** measured two gaps inside the sheets, L21 and L22. Outside the sheets no focused
    control is ever partly covered (F12).

## What remains

- **Landing V1's three queued satellites on Base Sepolia** (the card, the Market, the Roles). A scheduled
  task fires at 2026-10-20 23:15 UTC from the worktree pinned at fd18df4 (`/home/user/Special-land`). The
  pin matters because a Timelock op is the hash of the initcode, and the admin key that queued them is
  destroyed. The landing key (0xc79e8f31d50727a6c5ca30e297964874f2598f02) needs about 0.001 Base Sepolia
  ETH, and the window closes 2026-11-03 23:11 UTC.
- **A live V2 deployment** needs a fresh nonce-0 burner (`tools/deploy.mjs --v2`, or the rehearsal with
  `tools/testnet.mjs --v2`), funded per the preflight (the deploy budget is 140 M gas with V2).
- **Open requests**: L14 (`tools/mutations.mjs` adopting a JavaScript mode, W17's driver as its shape) and
  B4 (a keeper motive in `tools/agents.mjs`). L16–L22 are listed in `docs/v2/INTEGRATION.md`.
- **Later work**: zkAPI (V2 §6), OpenSea posting and WETH offers. After those comes U19: the audits, the
  mainnet band, the Base launch.

## How to resume
```sh
git clone https://github.com/venividis/Special && cd Special
git checkout ccr-8704be7f-m990q4 && npm install      # PR #6
npm run check                                       # must be green before any new unit (≈ 26 min with a warm compile cache, ≈ 65 min cold, on 4 cores)
node tools/verify-site.mjs --group gallery          # one lane through the shim
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group gallery   # the same lane in Chromium
node tools/forge.mjs --match Keepsake               # one suite while iterating
node tools/fuzz.mjs --seed 1                        # the seeded properties, the drip among them
npm run testnet -- --chain 31337 --confirm DEPLOY_INTACT_LOCAL --v2   # the rehearsal with V2 over a wire
```
`CLAUDE.md` holds the conventions and the traps; `docs/v2/INTEGRATION.md` the integration's ledger;
`docs/v2/W*-*.md` the units' own records of what they built, measured and could not do.
