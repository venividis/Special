# Checkpoint — where INTACT stands and how to continue

Written at the end of the third build session (2026-10-12). Everything below is on branch
`ccr-47c47b14-2qr2op` of `venividis/Special` (PR #2): PR #1's head (`claude/special-work-continuation-0l0uhq`,
7759e48 — U10 complete, U9's shell and its swap, social and launch lanes) plus this session's commits.
PR #1 was merged into `main` as d4aba9e on 2026-10-12, so `main` now holds that head. The two panel worktrees' branches (`u9/vault`,
`u9/identity`) were not pushed; their two files each were checked out into this branch and committed here.

## What exists and is verified

| Layer | Contracts (measured bytes, this tree) | Evidence |
|---|---|---|
| Hub | `IntactDiamond` + `CoreFacet` 12,785 · `RightsFacet` 5,034 · `MintFacet` 5,368 · `SiteFacet` 8,881 · diamond 2,004; monolith `Intact` 25,402 (over EIP-170, so the diamond ships; both builds tested) | `test/{Update,Approvals,Fingerprint,Mint,Rights,Panic,Diamond,Gas}.t.sol` |
| Accounts | `Reach` 20,821 · `Grip` 1,937 | `test/{Reach,Reach7739,Sessions,Ledger}.t.sol`, `tools/verify-vault.mjs` (168) |
| Swap | `Pool` 12,606 (+ `Curve` lib) · `Router` 11,823 | `test/{Pool,PoolReenter,Router}.t.sol`, `tools/verify-pool.mjs` (144), `tools/fuzz.mjs` (9 properties) |
| Social | `Parley` 9,955 · `Postage` 6,088 · `Roster` 3,196 · `KeyRegistry` 1,941 | `test/{Parley,Postage}.t.sol`, `tools/verify-parley.mjs` (81) |
| Vault | `Locks` 5,404 · `Steward` 8,748 · `Timelock` 1,617 | `test/{Locks,Steward}.t.sol`, `tools/verify-steward.mjs` (91), `tools/verify-timelock.mjs` (35) |
| Launch | `Kiln` 9,904 · `Coin` 3,145 · `Launchpad` 15,983 | `test/Launchpad.t.sol`, `tools/verify-launch.mjs` (123) |
| Site | `Engine` 3,672 · `Renderer` 16,156 · `Crest` 3,950 · `Premises` 15,319 · `Catalog` 13,945 + `CatalogState` 15,953 + `CatalogText` 4,864 + `CatalogRows` 1,843 (159 service rows, 211 whole error signatures) | `test/Premises.t.sol` (14), `test/Binding.t.sol` (3), `tools/verify.mjs` (234, incl. "the two surfaces are one byte-stream" and the catalog-against-ABI drift gate), `tools/verify-premises.mjs` (63), `tools/gas.mjs` (79 probes, each COLD: `tokenURI` 7.64 M of 8 M on the real shell, `/token/1/live` 1.74 M of 2.5 M, `/token/1/hash` 2.42 M of 2.5 M) |
| Console (U9, **complete**) | `engine/app.html` + `engine/app.css` → one document of 14,955 B gzip (build-failing ceiling 15,000; 45 B under) · six lane panels, gzip against the 8,192 ceiling each: swap 8,172 · social 8,187 · launch 8,155 · vault 8,166 · identity 6,012 · agent 2,942 B of source (the stub until U17) | `tools/verify-site.mjs` with every group present: **513 passed, 0 failed** — boot 131, swap 84, social 76, launch 82, vault 68, identity 65, and the runner's 7, among them *"the shell that shipped is the console, not the placeholder"* and the ≥ 150 floor met at 512; `tools/selftest.mjs` (52; the chain half 12,145 B, keccak `0x35000df5286898c97cc976ab4d104fe8ed13d25b80fb090a098d6236b4617352`); `tools/dom-shim.mjs` is the harness; the eleven BUILD-PLAN sentences all end their blocks verbatim |
| Deployment (U10) | `Create3Factory` 1,103 · `tools/deploy.mjs` (journaled, resumable; a resumed run now compares the shards the Engine already holds with the plan before sending anything) · `tools/recover-record.mjs` · `tools/verify-recover.mjs` · `tools/gateway.mjs` · `deployments/31337.json` (schema `intact.deployment/1`, regenerated 2026-10-12 from a fresh hardhat run with every lane real: `engine.placeholder` false, 81.44 M gas, recover-record 345 fields in-run and 344 standalone, 0 disagreeing) | `test/Create3.t.sol` (13), `tools/verify-recover.mjs` (137: six bands deployed in-process, two recovered field by field with 0 disagreeing, sixteen tampered records caught by name, and the interrupted run: a crash after the first body shard, a rebuilt `dist/` refused naming the shard, a shorter plan refused, the honest resume completing with 0 disagreeing) |
| Bundle | all of the above wired by one `IntactConfig` | `test/Bundle.t.sol`: seven end-to-end journeys incl. selling the bundle, buy-back, panic, steward |

`npm run check` = compile with the EIP-170 gate and the ship rule → facet-cut derivation → selftest →
build → the suite on BOTH builds (`INTACT_IMPL=monolith` and `=diamond`) → view-gas gate, cold →
`verify` (the equality step) → `verify:site` (every lane through the shim) → static audit →
`verify:recover`. Last result (2026-10-12, this tree): exit 0 in 15 m 59 s on 4 cores — all gated contracts under 24,576 B and the diamond ships; facets self-test 8; selftest 52; shell 14,955 B gzip; 286 passed / 0 failed on the monolith and 286 / 0 on the diamond; 79 gas probes cold, every view under its cap; verify 234; verify-site 513 (every lane present; *"the shell that shipped is the console, not the placeholder"*; the ≥ 150 floor met at 512); static audit clean; verify-recover 137.

## Decisions taken during the build (see DESIGN.md §3, §12, §14, §15 and docs/INTERFACE-CHANGES.md)
- The diamond ships (monolith 25,402 B > 24,576). Same source, both builds tested.
- `Timelock.execute` is open to anyone; Reach `sealMax` is idempotent at the cap; `setScriptURI` reverts for everyone so the ERC-5169 claim is honest.
- Reach measured 20,821 B against a 19,000 budget (accepted under the 21,000 valve).
- U7: the pipeline (gzip shards, the state gap as a sibling `<script>window.INTACT=…</script>`, the loader, the keccak manifest, `/panel/<name>.js` routes) is real and tested; `Base64.encode` was rewritten (55 gas/byte, canonical padding). `TokenState.absent` distinguishes "not deployed here" from "could not be read".
- U10 (DESIGN §12, decision 36): one CREATE3 factory per band from a fresh nonce-0 burner under salts `keccak("intact.v1.<key>")`; `Create3Factory.deploy` admits only the burner and the Timelock; the Engine is the burner's plain CREATE at nonce 2 and its shards `CREATE(engine, 1 + k)`; module immutables predicted before construction; the record written last, with no RPC endpoint; `recover-record` tells drift from contradiction. After PR #1's review: a resumed run reads the Engine's own `shardHashes()` and refuses a `dist/` rebuilt since the crash while the Engine is still open (it can never be redeployed), proved through a `crashAfter` test hook beside `mispredict`; and the committed record was regenerated from the console rather than the placeholder.
- U9 (docs/CONSOLE.md is the contract; docs/u9/DECISIONS.md D1–D20 and docs/u9/BLUEPRINT.md are the working documents, kept as the record): three boot modes; the EIP-6963 rule; `eth_chainId` before any read; the confirm slab re-reads `custodyEpoch` inside the press and refuses any approval of 2^255 or more, also inside `execute`/`executeBatch`/`executeTyped`; amounts are BigInt and chain strings reach the DOM through `textContent` only; panels are IIFE Blob scripts keccak'd against `INTACT.panels` before injection; the loader keeps the inflated bytes on `INTACT.$doc`; the sealing key is one per wallet from `personal_sign("INTACT seal v1 · chain <c> · hub <hub>")`, and Identity owns its two slabs (`setEncryptionKey(3, 0x04‖x‖y)`, then `bindKey(id)`).
- U9 panels (D20 held: one agent per panel in a worktree, owning exactly `engine/panels/<name>.js` and `tools/verify-site/<name>.mjs`): the byte ceiling decided the vault's shape — its first full draft measured 9,531 B, so `guard/unguard`, `grantRecipe`, `stillHereUnderDuress`, the `getWill/getObit` prose, per-asset Grip balances, `marketHash` and sealed-market fee streams as reads, the grant's `minInterval`/`uses` fields and a live "sealed until" row were cut (named in both headers); everything CONSOLE §7 mandates is in. Identity declares only the rows it calls (`hub.statusOf` and `keys.getPublicKeys` from the blueprint's list are not: status is a `coreOf` word, the registry state is `keyIdOf(account)` against the derived point). One planned half-line was dropped (the vault's L7 "the Identity rule visible"); the rest of §7.5 and all of §7.6 run.
- INVARIANTS F7, the confirm slab, is the row BLUEPRINT §8 asked the integration step to add; DESIGN §14 gained the same line so the ledger stays one line per checklist row, as its preamble promises.
- Residuals documented in DESIGN §3: an Intact sent to the undeployed canonical account of an unminted id is not classifiable; panic keeps the guardian; `ClearPathCache` is not emitted on `setUser`/`setStatus`/`pause`; Postage payer is the Reach; a home room can be followed only after its steward's first act; `R_ROLE` reads the USER role only until U16.

## Observations recorded, not changed (for U11 and the shell's next round)
1. After a receipt the shell's `facts()` fires `intact:epoch` before `rights()` re-reads, and `rights()` sets its bits to `null` first, so a panel repainting on `intact:epoch` sees `ui.act` draw nothing until the receipt's own repaint. The vault guards its one `act(...).id` assignment; a shell-side ordering (rights first, then the epoch event) would remove the hazard for every lane.
2. An exception thrown inside a Blob panel's promise callback is not captured in `page.errors`; it surfaces as an unhandled rejection that ends the runner mid-group. The shim could install `unhandledrejection` capture so a panel bug reads as a failed sentence, not a dead run.
3. `ui.kv` concatenates key and value with no separator in `textContent`; lines that must read as a sentence are `<p>` elements in the vault.
4. The shell is 45 B under its ceiling and the vault 26 B under its own; any fix to either pays in cuts first. `scratchpad/tools-scratch/size.mjs` (not committed) reproduced the build's per-function gzip measurement and is worth recreating for trimming.

## What remains (BUILD-PLAN.md)
Wave 2 is complete. Wave 3: U11 Chromium journeys (`tools/verify-console.mjs`, `tools/testnet-drive.mjs`:
the six groups' sentences in a real browser; Playwright's Chromium is preinstalled in the container);
U12 the adversarial battery, findings replay and documents (`verify-findings`, `agents`,
`invariants-check` — every INVARIANTS row, F7 included, names an assertion string that exists;
`CLAUDE.md`; `docs/{SECURITY,DEPLOYMENT,AGENT}.md`; the E1/E3 sixteen-mutation gate still owed for
Parley; wiring the standalone verifiers — pool, vault, parley, launch, steward, timelock, premises, fuzz —
into `npm run check` with the "incomplete ≠ pass" rule); U13 the testnet rehearsal (`tools/testnet.mjs`,
`tools/verify-gateway.mjs`, `deployments/84532.json`; a funded burner and an RPC). INVARIANTS rows still
pending: D2 and D6 for U14, G2 for U17, F6's gateway half for U13. Wave 4 (post-MVB): U14 Uniswap v4
launch path; U15 Market; U16 Roles; U17 agent surfaces; U18 Nameplate; U19 audits + mainnet.

Open on GitHub: PR #2 (this branch), whose diff against `main` is this session's commits alone now that
PR #1 is merged.

## How to resume
```sh
git clone https://github.com/venividis/Special && cd Special
git checkout ccr-47c47b14-2qr2op && npm install     # PR #2 — or main, once it is merged
npm run check                                      # must be green before any new unit (≈ 20 min on 4 cores)
node tools/verify-site.mjs --group vault           # one lane: build, compile (cached), one chain, ≈ 30 s
node tools/forge.mjs --match X                     # one suite while iterating
```
Then U11 (it consumes the six groups' sentences and the shim's `boot`), U12 and U13; one agent per unit in
a worktree branched from the merged head, merge when its suite and the whole `npm run check` are green.
