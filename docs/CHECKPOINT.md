# Checkpoint — where INTACT stands and how to continue

Written at the end of the first build session (2026-10-04). Everything below is on `main` of
`venividis/Special`; the unit branches (`unit/U1`–`unit/U8`, `wave2/router-merge`) are also pushed as history.

## What exists and is verified

| Layer | Contracts (measured bytes) | Evidence |
|---|---|---|
| Hub | `IntactDiamond` + `CoreFacet` 12,785 · `RightsFacet` 5,034 · `MintFacet` 5,368 · `SiteFacet` 8,881 · diamond 2,004; monolith `Intact` 25,402 (over EIP-170, so the diamond ships; both builds tested) | `test/{Update,Approvals,Fingerprint,Mint,Rights,Panic,Diamond,Gas}.t.sol` |
| Accounts | `Reach` 20,821 · `Grip` 1,937 | `test/{Reach,Reach7739,Sessions,Ledger}.t.sol`, `tools/verify-vault.mjs` (168) |
| Swap | `Pool` 12,606 (+ `Curve` lib) · `Router` 11,823 | `test/{Pool,PoolReenter,Router}.t.sol`, `tools/verify-pool.mjs` (144), `tools/fuzz.mjs` (9 properties) |
| Social | `Parley` 9,955 · `Postage` 6,088 · `Roster` 3,196 · `KeyRegistry` 1,941 | `test/{Parley,Postage}.t.sol`, `tools/verify-parley.mjs` (81) |
| Vault | `Locks` 5,404 · `Steward` 8,748 · `Timelock` 1,617 | `test/{Locks,Steward}.t.sol`, `tools/verify-steward.mjs` (91), `tools/verify-timelock.mjs` (35) |
| Launch | `Kiln` 9,904 · `Coin` 3,145 · `Launchpad` 15,983 | `test/Launchpad.t.sol`, `tools/verify-launch.mjs` (123) |
| Site | `Engine` 3,672 · `Renderer` 15,922 · `Crest` 3,950 · `Premises` 15,319 · `Catalog` 13,945 + `CatalogState` 15,914 + `CatalogText` 4,864 + `CatalogRows` 1,843 (one Catalog measured 54,023 B, so it is four) | `test/Premises.t.sol` (14), `tools/verify.mjs` (217, incl. "the two surfaces are one byte-stream"), `tools/verify-premises.mjs` (63), `tools/gas.mjs` (75 probes: tokenURI 4.09 M of 8 M on the placeholder shell, /live 0.77 M of 2.5 M) |
| Bundle | all of the above wired by one `IntactConfig` | `test/Bundle.t.sol`: seven end-to-end journeys incl. selling the bundle, buy-back, panic, steward |

`npm run check` = compile with the EIP-170 gate → facet-cut derivation → the suite on BOTH builds
(`INTACT_IMPL=monolith` and `=diamond`) → view-gas gate → static audit. Last result (2026-10-05, commit 6ed1539): exit 0 — all gated contracts under 24,576 B; facets self-test 8; 271 passed / 0 failed on the monolith and 271 / 0 on the diamond; 75 gas probes under their caps; static audit clean.

## Decisions taken during the build (see DESIGN.md §3 and docs/INTERFACE-CHANGES.md)
- The diamond ships (monolith 25,402 B > 24,576). Same source, both builds tested.
- `Timelock.execute` is open to anyone; Reach `sealMax` is idempotent at the cap; `setScriptURI` reverts for everyone so the ERC-5169 claim is honest.
- Reach measured 20,821 B against a 19,000 budget (accepted under the 21,000 valve).
- U7: the site's shell and panels are placeholders in `tools/fixtures/` until U9 writes `engine/app.html`; the pipeline (gzip shards, state gap as a sibling `<script>window.INTACT=…</script>`, loader, keccak manifest, `/panel/<name>.js` routes) is real and tested. `Base64.encode` was rewritten (55 gas/byte, canonical padding) so the real shell projects to ≈6.3–6.7 M gas under the 8 M cap; re-measure when U9 lands. `TokenState.absent` distinguishes "not deployed here" from "could not be read".
- Residuals documented in DESIGN §3: an Intact sent to the undeployed canonical account of an unminted id is not classifiable; panic keeps the guardian; `ClearPathCache` is not emitted on `setUser`/`setStatus`/`pause`; Postage payer is the Reach; a home room can be followed only after its steward's first act; `R_ROLE` reads the USER role only until U16.

## What remains (BUILD-PLAN.md)
Wave 2: U7 and U8 are done and merged; U9 app shell + four lane panels; U10 deployment/CREATE3/records.
Wave 3: U11 Chromium journeys; U12 adversarial battery, findings replay, docs (incl. the 16-mutation gate for Parley, INVARIANTS rows left pending: A9, C4, D2/D6, F*, G2, H3); U13 testnet rehearsal.
Wave 4 (post-MVB): U14 Uniswap v4 launch path; U15 Market; U16 Roles; U17 agent surfaces; U18 Nameplate; U19 audits + mainnet.

## How to resume
```sh
git clone https://github.com/venividis/Special && cd Special && npm install
npm run check                     # must be green before any new unit
node tools/forge.mjs --match X    # one suite while iterating
```
Then take the next unit from BUILD-PLAN.md (U9 first: it depends on U7's build pipeline and state-block shape; U10 next), one agent per unit in a worktree branched from `main`, merge when its suite and the whole `npm run check` are green, push `main`.
