# Checkpoint — where INTACT stands and how to continue

Written at the end of the fifth build session (2026-10-13). Everything below is on branch
`ccr-8704be7f-m990q4` of `venividis/Special` (PR #4), which stacks on PR #3's head 40a678f (wave 3 complete
as tooling; until PR #3 merges, PR #4's diff against `main` carries its eleven commits first). This session
built wave 4's five post-MVB units in parallel, one agent per unit in its own worktree on disjoint files —
U14 (`wave4/u14`, 78847a9), U15 (`wave4/u15`, e60cc04), U16 (`wave4/u16`, eb053b1), U17 (`wave4/u17`, f6a4ede) and
U18 (`wave4/u18`, a349333) — and merged each here with an integration commit after it. The integration
itself added what no unit owned: the way a post-MVB satellite lands on a band (through the Timelock's
queue, at the address the MVB pinned), the record and the recovery that follow it, the second service
table so the MVB rows' transaction stays under the cap, one read of the state block per `tokenURI`, and the
base64 encoder rewritten when the landed shape's `tokenURI` crossed its cap (8.15 M → 3.62 M, the same bytes).
U19 (audits, the mainnet band, the Base launch) is calendar-bound and not started. U13's live run happened on Base Sepolia
at the end of the session, twice: the first deploy was complete and recovered but its campaign stopped at the
tenth step to a lagging replica (the swap landed, the read after it did not see it), which taught the tree to
pin every wire read to a block; the second walked all forty steps and is the record (`deployments/84532.json`,
the first kept as `84532.first.json`), with the three satellites queued on its Timelock until 2026-10-20.
`deployments/11155111.json` does not exist and no document pretends otherwise.

## What exists and is verified

| Layer | Contracts (measured bytes, this tree) | Evidence |
|---|---|---|
| Hub | `IntactDiamond` + `CoreFacet` 12,785 · `RightsFacet` 4,996 (5,034 before U16: `R_ROLE` now reads `IRoles.hasAnyRole`) · `MintFacet` 5,368 · `SiteFacet` 8,881 · diamond 2,004; monolith `Intact` 25,364 (over EIP-170, so the diamond ships; both builds tested) | `test/{Update,Approvals,Fingerprint,Mint,Rights,Panic,Diamond,Gas}.t.sol` |
| Accounts | `Reach` 20,821 · `Grip` 1,937 | `test/{Reach,Reach7739,Sessions,Ledger}.t.sol`, `tools/verify-vault.mjs` |
| Swap | `Pool` 12,606 (+ `Curve` lib) · `Router` 11,823 | `test/{Pool,PoolReenter,Router}.t.sol`, `tools/verify-pool.mjs`, `tools/fuzz.mjs` (9 properties) |
| Social | `Parley` 9,955 · `Postage` 6,088 · `Roster` 3,196 · `KeyRegistry` 1,941 | `test/{Parley,Postage}.t.sol`, `tools/verify-parley.mjs`; the E1/E3 mutation gate `tools/mutations.mjs` (P11 its one survivor, a test request) |
| Vault | `Locks` 5,404 · `Steward` 8,748 · `Timelock` 1,617 | `test/{Locks,Steward}.t.sol`, `tools/verify-steward.mjs`, `tools/verify-timelock.mjs` |
| Launch (U6 + U14) | `Kiln` 14,047 (9,904 before: it carries the `LaunchHook` creation code as recipe kind 1) · `Coin` 3,145 · `Launchpad` 17,176 (15,983 before: the v4 doors `createV4`/`createV4Checked`/`v4TermsHash`, the custodian seam, `Graduated` with both prices) · **`LaunchHook` 3,156** (one immutable-free contract per launch, so the Router pins one codehash for every launch's hook) · **`LPCustodian` 13,589** (over DESIGN §3's 9,000 estimate by 4,589 B and under EIP-170; the unit's size ladder is in `docs/wave4/u14-report.md`) | `test/Launchpad.t.sol`, `test/Hook.t.sol` (U14), `tools/verify-launch.mjs` (307: the coin half's 123 and the hook half's 184 — the pre-initialised pool refused at the wrong price and used within 1 %, every hook entry refusing a caller that is not the manager, the permission bits equal to the address, negative deltas blocked until UNLOCKS, collect paying the Reach, one mined salt the same on every chain) |
| Market (U15) | **`Market` 5,930** (budget 10,000): a listing needs the Reach seal and the market seal to reach `expiresAt`, holds the module lock, pins the fingerprint; `buy` fills at the exact price under the same custody epoch against the fingerprint recomputed live with every balance floor standing, royalty first, every payee pulling from `owed`; a dead listing is anyone's to clear | `test/Market.t.sol` (24 sentences; 38 with the suites whose names match, both builds); 23 of 26 one-token mutations killed, the three survivors written as test requests in `docs/wave4/u15-report.md`; INVARIANTS C6 |
| Roles (U16) | **`Roles` 5,467** (budget 5,500): ERC-7432 roles that lock the token instead of escrowing it, granted by the holder alone, revocable only, stamped with the custody epoch and dead once it moves, at most sixteen role ids per token; `hasAnyRole` is what the hub reads `R_ROLE` from | `test/Roles.t.sol` (22 sentences, both builds); eight mutations killed; INVARIANTS A11 |
| Agent surfaces (U17) | **`AgentCard` 11,546** (budget 12,000): face 2 is the ERC-8004 `registration-v1` in RFC 8785 canonical bytes, `manifestHash(id)` their keccak; the A2A card, `llms.txt`, the collection's documents under `/.well-known/`; `engine/panels/agent.js` **4,883 B gzip** (the stub's 793 before): the card's facts, the grant log, the `executeAsSession` composer — propose as a read (`sessionAllows`, then a dry `eth_call`), act through the slab for the key's own wallet — and session mode with the refusal when the connected wallet is not the key; `sdk/mcp.mjs`, the MCP bridge whose tools come from `services.json` and which refuses a catalogue whose hash drifted | `tools/verify-site/agent.mjs` (74), `sdk/mcp.test.mjs` (29, the `mcp` step of `npm run check`); INVARIANTS G2 live, G3 and G4 new |
| Nameplate (U18) | **`Nameplate` 6,979** (budget 10,000): band 0's adminless ENS resolver — `intact.eth` and every `<id>.intact.eth` of the band answer only while the registry names the canonical NameWrapper as the apex's owner, the wrapper names a canonical account of this hub and the .eth registrar's clock is live; `contentcontract` is `eth:0x<Premises>`; no setter, no stored binding | `tools/verify-plate.mjs` (228 on a local ENS fixture, the `verify:plate` step), `tools/ens-name.mjs`; five mutations killed; INVARIANTS F8 |
| Site | `Engine` 3,672 · `Renderer` 16,826 (16,156 before: face 0 builds its document from the state it already read, and the encoder's twelve word constants) · `Crest` 3,950 · `Premises` 15,319 · `Catalog` 14,604 + **`CatalogRows` 2,198 + `CatalogRowsPost` 2,198** (the service table is two contracts: the 159 MVB rows unchanged at 14.97 M gas to deploy, 89 % of the 2^24 cap, and the post-MVB rows — the Market's six under M, the Roles' eleven under D, the card's five under A, the Nameplate's four under I, the v4 path's three under L and fourteen under U — in a second transaction at ≈ 2.4 M) + `CatalogText` 5,345 + `CatalogState` 15,953 | `test/Premises.t.sol`, `test/Binding.t.sol`, `tools/verify.mjs` (the equality step and the drift gate over every row), `tools/verify-premises.mjs`, `tools/gas.mjs` (now measuring the shape a band has with the satellites landed: every probe cold, `tokenURI` 3.62 M of 8 M, `/token/1/live` 1.28 M of 2.5 M, the four agent routes and face 2 under their caps; `/token/1/state.json` 0.89 M of 1 M is the closest to its cap) |
| Console (U9 + U17) | `engine/app.html` + `engine/app.css` → 14,955 B gzip (untouched; 45 B under the ceiling) · the panels, gzip against 8,192 each: swap 8,172 · social 8,187 · launch 8,155 · vault 8,166 · identity 6,012 · agent 4,883 | `tools/verify-site.mjs` with every group present: 581 passed, 0 failed (boot 137, swap 84, social 76, launch 82, vault 68, identity 65, agent 74, the runner's 7; the QR module map's keccak re-pinned after the rows split moved the harness Premises to the next nonce, the decoder sentences proving the new map) |
| Console journeys (U11) | `tools/verify-console.mjs` (Chromium), `tools/testnet-drive.mjs` (a wire) | verify-console 167 passed, 0 failed (the session group's stub sentence retargeted: the agent lane reads only in session mode and says where the act is) |
| Battery (U12) | `tools/check.mjs` (28 steps now: `mcp` after `verify:site`, `verify:plate` after `verify:premises`), `tools/verify-findings.mjs`, `tools/agents.mjs`, `tools/invariants-check.mjs` (107 rows checked, 0 failed: A11, C6, D7, F8, G3, G4 added; D2, D6 and G2 live), `tools/mutations.mjs` | the battery table below |
| Deployment (U10 + integration) | `Create3Factory` 1,103 · `tools/deploy.mjs` (the MVB as before, the Launchpad now taking the custodian's prediction as its fifth argument; **`deploySatellite` and `--satellite <key[,key]|all>`**: for a recorded deployment the admin queues `Timelock.execute(factory, 0, deploy(salt, initcode))` and anyone lands it once ripe, the record gaining `satellites.<key>` with the queue and the landing transactions; a queue-only run on a public chain records the queue and says to come back) · `tools/recover-record.mjs` (a landed satellite checked like every contract and twice more: the Timelock's queue clear, the factory's `Deployed` event at the recorded block naming it) · `tools/testnet.mjs` (a `satellites` phase after the deploy, budgeted in the preflight) · `tools/verify-recover.mjs` · `deployments/31337.json` and `deployments/31337.campaign.json` (regenerated from this tree's rehearsal over hardhat, 2026-10-13: 59 sentences, 0 failed, 72 s; the MVB 89.68 M gas, 27 contracts, 45 s; the card, the Market and the Roles each queued and landed through the Timelock, 95.87 M in all; the campaign 5,907,685 gas over 40 steps; the record recovered with 383 fields, 0 disagreeing; the gateway 240 and the tamper fixture 243 passed; `tokenURI(1)` estimated at 3,779,242 gas, answered in 78,109 B; the nameplate and the custodian refused by name) | `test/Create3.t.sol`, `tools/verify-recover.mjs` (174 passed, 0 failed: the agent card, the Market and the Roles each queued by the burner, landed by a stranger a week later where the hub pinned them, recovered with 0 disagreeing, their tampered codehash, landing block and missing evidence caught by name) |
| Bundle | all of the above wired by one `IntactConfig` | `test/Bundle.t.sol` |

`npm run check` is `node tools/check.mjs`: compile → facets (+ selftest) → selftest → build → forge on the
monolith → forge on the diamond → gas (+ selftest) → verify → verify:site → mcp → verify:pool → verify:vault →
verify:parley → verify:launch → verify:steward → verify:timelock → verify:premises → verify:plate → fuzz →
verify:findings → agents → static-audit (+ selftest) → verify:recover → verify:console → invariants. Every
step must print exactly one summary line reporting zero failures; a missing step file fails the run;
`--only`/`--skip` is a PARTIAL run and is never called green. Last result (2026-10-13, 4 cores, the tree at
037fc57 — every unit merged and integrated, the encoder rewritten, the fixture regenerated; this checkpoint's own
commit follows it with documents only; `node tools/check.mjs --keep-going`):

| step | passed | failed | time |
|---|---|---|---|
| compile (ship rule: diamond) | 37 contracts measured | 0 | 0.5 s |
| facets · facets:selftest | 93 selectors · 8 | 0 | 0.2 s |
| selftest | 52 | 0 | 0.2 s |
| build | 14,955 B of 15,000 | 0 | 2.4 s |
| forge:monolith | 352 | 0 | 20 m 35 s (the cold compile of src + test) |
| forge:diamond | 352 | 0 | 3 m 28 s |
| gas · gas:selftest | 83 probes cold · the 45.60 M fixture fails the 16.78 M cap | 0 | 23.9 s |
| verify | 234 | 0 | 7.4 s |
| verify:site | 581 | 0 | 2 m 13 s |
| mcp | 29 | 0 | 4.7 s |
| verify:pool | 144 | 0 | 11.4 s |
| verify:vault | 184 | 0 | 5.1 s |
| verify:parley | 81 | 0 | 2.5 s |
| verify:launch | 307 | 0 | 5.5 s |
| verify:steward | 91 | 0 | 2.8 s |
| verify:timelock | 35 | 0 | 1.5 s |
| verify:premises | 63 | 0 | 6.2 s |
| verify:plate | 228 | 0 | 29.9 s |
| fuzz | 9 properties | 0 | 10.8 s |
| verify:findings | 36 | 0 | 21.5 s |
| agents | 6,721 (seed 912913116, 220 ticks) | 0 | 1 m 15 s |
| static-audit · static-audit:selftest | 14 rules · 5 fixture findings | 0 | 0.2 s |
| verify:recover | 174 | 0 | 36.9 s |
| verify:console | 167 (Chromium 141.0.7390.37) | 0 | 2 m 20 s |
| invariants | 107 | 0 | 0.2 s |
| **total** | **28 steps, check: green** | **0** | **32 m 44 s** |

The compile was cold for the forge runner (the encoder and the Catalog changed after the last full compile of
src + test), which is the 20 m 35 s of forge:monolith; the tools' compile of src alone was warm. A battery on
a tree whose Solidity has not changed since runs in about 12 minutes on these four cores — measured after the live runs' tool changes on this tree, before the push: 28 steps, 0 failed, 13 m 17 s, with `npm run drive` (the console journey over a wire) 35 passed, 0 failed beside it.

## Decisions taken during the build (see DESIGN.md §3, §12, §14, §15 and docs/INTERFACE-CHANGES.md)
- Everything the previous checkpoints recorded stands: the diamond ships; `Timelock.execute` is open; the Reach at 20,821 B under the valve; U7's pipeline; U10's CREATE3 factory gated to the burner and the Timelock; U9's console contract; U11's Chromium battery; U12's incomplete ≠ pass; U13's rehearsal in one command.
- **A post-MVB satellite lands only through the Timelock's queue** (DESIGN §12, decision 38): `tools/deploy.mjs --satellite` predicts the address from the record's factory and salt, refuses a record for another chain, a placeholder off the arithmetic, a holder whose pin is not that address, a constructor argument the record lacks or a queue the key may not make (printing the exact `queue` call for the admin), builds the initcode from the record's own addresses, and after landing reads every pin of the new contract back and recovers the whole record in-process before writing it. The Nameplate is admitted only where `tools/ens-name.mjs` names a NameWrapper; the custodian only where the venue table names a probed PoolManager, PositionManager and Permit2.
- **The service table is two contracts** (`RowTable` base; `CatalogRows` the MVB rows, `CatalogRowsPost` the post-MVB rows; the text layer serves both as one `sel` map and one `services` array, its `tableHash` over both raw tables) with five new letters — M market, D roles, A the agent card, U the custodian, I the nameplate — because the MVB table's transaction was at 89 % of the 2^24 cap and a row appended there could make a deployment un-includable. The drift gate holds a post-MVB row to its contract's interface until the contract lands, then to both.
- **Face 0 reads the state block once** (`ICatalog.stateFrom(id, s)`, additive): every satellite probed once per `tokenURI`, the card building its registration once; `document(id)`, the Premises' `/live`, keeps its own read, and the equality step holds the two surfaces to one byte-stream.
- **U14**: the hook's times are durations from seeding (`HookTerms{opensIn, lockFor, startFee, floorFee, decay}`, counted from the custodian's `seededAt`), so a raise that graduates any time inside its deadline neither idles nor shortens its lock; nothing in the hook is a Solidity immutable, so the Router pins one `LAUNCH_HOOK_CODEHASH` for every launch's hook (the compiled runtime's keccak, the same on every band); the hook's terms live in the custodian's registry keyed by the coin, so the salt is mined before `createV4` and pinned beside the launch; `seed(launchId, amountBase)` derives the terminal sqrt price from the two amounts and uses the pool's live price for the liquidity it mints; tick spacing 60 and the full-range bounds are protocol constants; the 1 % band is checked in sqrt-price space; the curve's price corners are checked at `register`; a Permit2 expiry of zero is never written. `LPCustodian` measures 13,589 B against a 9,000 estimate that predates the PositionManager encoding, the Permit2 chain, the registry and the corner check — accepted under EIP-170 with the size ladder recorded.
- **U15** (decision 37): `delist` is `holds` while a listing is live and anyone's once it is dead (expired, or stale because the epoch moved), the Steward's rule for a void plan's notice, so a lost key's listing never holds an heir off for ever; the fingerprint is verified before the module lock and pinned after it (`lockCount` is in the Core it covers); floors are checked at `list` as at `buy`.
- **U16**: grants are strict `holds` (the frozen `NotOwnerOrApproved` kept; only the owner passes), revocable only, one recipient per role id, at most sixteen role ids per token; `IRoles` gains `hasAnyRole`, `MAX_ROLES` and two errors additively, and the hub's `R_ROLE` reads any live role, as DESIGN §2 always said.
- **U17**: the shell never writes in session mode, so at the door the composer is a read and the act is the console's, offered to the key's own wallet whose `rightsOf` carries `SESSION`; the registration is RFC 8785 canonical, its door the RFC 6570 template `/k/<id>/{key}`, and nothing a holder types is in it; the bridge never receives a key through a tool argument.
- **U18**: custody is the binding — the apex and the wildcards answer only while a canonical account of this hub holds the wrapped name and the registrar's clock is live; `addr` is the Reach; the NameWrapper is a per-chain constructor argument from a table of contract addresses, never an endpoint.
- **The base64 encoder is a word at a time** (DESIGN §15, decision 39): the cap stays 8 M and the encoder shrank, not the shell — 24 bytes a loop into one 32-byte store, the sextets spread by five mask-shift-or steps and named by the alphabet's arithmetic on every lane at once; 55.7 → 16.5 gas per input byte, the same bytes (observation 1).
- The battery measures the deployment shape a band has once the satellites are through the Timelock: `tools/gas.mjs` deploys the card, the Roles and the Market before it probes, and `tools/verify-recover.mjs` lands every satellite the in-process chain admits.

## Observations recorded, not changed
1. **`tokenURI` headroom, and the encoder that gave it back.** With the custodian's seventeen rows, sixteen errors and six topics in the state block, `tokenURI(1)` on the landed shape (the card, the Roles and the Market deployed, cold) measured 8.15 M — over the 8 M cap, 7.04 M of it in the Renderer and 6.6 M of that in `src/lib/Base64.sol`'s loop (an opcode profile over `tools/gas.mjs`'s deployment on this tree). The cap stands (DESIGN §15, decision 39); the encoder was rewritten to encode 24 bytes a loop by mask-shift-or spreads and the alphabet's arithmetic on every byte lane at once, the same bytes (the canonical-encoding sentences of `tools/verify.mjs`; a differential check against Node's encoder on every length to 130, random inputs to 5 KB and the 64 sextets at every lane position, 435 cases, during the integration), 55.7 → 16.5 gas per input byte. `tokenURI(1)` now measures 3.62 M of the 8 M cap in the gas sweep (3.78 M as hardhat estimates it); the state block still carries every service row's selector, so a row costs bytes in every `tokenURI`, and the card's `manifestHash` probe (which builds the whole registration) remains the next-cheapest cut.
2. **`LPCustodian` is 13,589 B against a 9,000 B estimate** (observation 1 of U14's report, with the ladder: nothing single is large; the contract is ≈ 25 external call sites, six events, fifteen errors, eleven views and the 512-bit `mulDiv` the full-range liquidity needs). Getting under 9,000 B would drop `resalt`, `extend` or the reads a page needs.
3. **Survivors of the mutation gates stand as test requests**: P11 (Parley: no test hides at `seq ≥ 128`, from U12) and U15's three (the two floor walks are one guard in two lines until a hub hook exists; the codeless-asset line before the balance staticcall is redundant with the length check).
4. **The console does not yet read the Market, the Roles or the Nameplate**: the vault's sell flow through `Market.list` with the two seals (BUILD-PLAN U15's done-criterion), the identity lane's `ROLE` chip from `hasAnyRole`/`roleData`/`roleEpoch` and its `#identity-ens` row (U18's report §10) are console work for the shell's next round; the chip rule already moves each satellite from "not deployed" to "reported" the moment it has code. The Chromium `agent` group for `tools/verify-console.mjs` (U17's report §9) is the same round's.
5. **`tools/forge.mjs`'s `expectRevert(bytes)` matches any revert** (U15, U16): an exact refusal is asserted through a raw call that returns the data; a data comparison in the runner would tighten every such assertion in the tree.
6. **`test/Ratchet.t.sol` could add the custodian's `extend`** to `test_everyRatchetOnlyLengthens` (U14's request); `tools/verify-findings.mjs` could replay ANIMA's CRITICAL #1 against the Market (U15's).
7. The previous checkpoints' observations stand: a marketplace frame has no `navigator.clipboard` and the vault's copy button throws there; `catalogRows` at 89 % of the EIP-7825 cap (now the reason for the second table); hardhat's `eth_estimateGas` of `tokenURI` took 16 s at 7.9 M and takes 1.4 s at 3.8 M; the shell is 45 B under its ceiling and the vault panel 26 B under its own.
8. The unit agents share one scratchpad directory: a generically named file one wrote was overwritten by another's before it was read (U15's note; its commit message was restored by hand). Unit-specific names, or a directory per unit, next time.
9. **A read at `latest` on a public endpoint is not a read after the receipt.** The first Base Sepolia run (84532, 2026-10-13) deployed in 91 s and queued the satellites, then stopped its campaign at the exact-in swap: the swap landed (block 48,081,907; the second key holds the full output, read at the chain's head afterwards) and the balance read after the receipt was answered by a replica a block behind, so the step recorded a failure and the disposition destroyed the key. `tools/rpc.mjs` now pins every read to the highest of the receipts' blocks and the latest the endpoint reports, `call` retries "header not found" as lag, a failed step keeps the receipt it got, and a stopped campaign keeps its key for `--resume` (proved again on 31337: 59 sentences, 0 failed). The deployment stands as `84532.first.json`; the burner's 0.005451 ETH and the second key's 0.001213 ETH went with the key. The second run, an hour later with the pinned reads, walked all forty steps (59 sentences passed; the one failure a third public endpoint rate-limiting the 78 KB `tokenURI` answer) and is the committed record.

## What remains (BUILD-PLAN.md)
Waves 0–3 are built and wave 4's five units are in. **What remains of the MVB proof** is the Sepolia
rehearsal (`tools/testnet.mjs --chain 11155111`, a fresh funded nonce-0 burner, where the Nameplate lands), the
gateway opened from `web3://`, and, from 2026-10-20, landing the three satellites queued on the Base Sepolia
deployment with `tools/deploy.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA --satellite all` from
any funded key (the record then gains their `executed` transactions, and `tools/recover-record.mjs` must read
0 disagreeing; the landing is scheduled for the window's opening, with a separate landing key). The venue
table is filled since 2026-10-18 (Base Sepolia and Sepolia, from Uniswap's feed, probed and re-proved by
`npm run verify:venues`, 24 passed), and `tools/testnet.mjs --fork` walked the whole rehearsal against forks of
both chains (88 and 89 sentences, 0 failed): the Router, the custodian and every satellite landing, and the v4
launch path against the real PoolManager, PositionManager and Permit2. The next live rehearsal on either chain
carries the Router and the custodian; the deployment of 2026-10-13 predates the rows and keeps its shape. Then
the console's next round (observation 4), and U19: two audits of `Intact`, `Reach`, `Pool`,
`Launchpad` (and now `Market`, `Roles`, `LPCustodian`) on the deployed commit, the mainnet band, the Base
launch. INVARIANTS rows pending: none (F6's gateway half still waits for a self-hosted gateway on a public
chain, recorded in its status cell).

## How to resume
```sh
git clone https://github.com/venividis/Special && cd Special
git checkout ccr-8704be7f-m990q4 && npm install      # PR #4 — or main, once PR #3 and PR #4 are merged
npm run check                                       # must be green before any new unit (the time is in the battery table above)
node tools/check.mjs --only verify:console          # a PARTIAL run of one step while iterating (never green)
node tools/verify-site.mjs --group agent            # one lane through the shim, ≈ 30 s
node tools/forge.mjs --match Market                 # one suite while iterating
npm run verify:mcp                                  # the MCP bridge against the in-process chain
npm run verify:plate                                # the ENS resolver on the local fixture
npm run testnet -- --chain 31337 --confirm DEPLOY_INTACT_LOCAL   # the rehearsal over a wire, the satellites landing after the deploy
node tools/deploy.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL --satellite all   # the satellites for a recorded deployment
```
Then the live rehearsal (`docs/DEPLOYMENT.md`), the console's next round (observation 4), and U19.
`CLAUDE.md` holds the conventions and the traps; `docs/wave4/u1{4,5,6,7,8}-report.md` are the units' own
records of what they built, measured and could not do.
