# Checkpoint — where INTACT stands and how to continue

Written at the end of the fourth build session (2026-10-13). Everything below is on branch
`ccr-d811d3ab-ng4o64` of `venividis/Special`, which stacks on `main` at 2105c11 (PR #2 merged: waves 0–2
complete). This session built two of wave 3's three units in parallel worktrees, one agent per unit on
disjoint files — U11 (`wave3/u11`, 68712cf) and U12 (`wave3/u12`, 794c343) — merged both here and
integrated the documents. U13 (the testnet rehearsal) was deferred by decision to a later session; none
of its files exist, and the documents say so wherever they would otherwise cite one.

## What exists and is verified

| Layer | Contracts (measured bytes, this tree) | Evidence |
|---|---|---|
| Hub | `IntactDiamond` + `CoreFacet` 12,785 · `RightsFacet` 5,034 · `MintFacet` 5,368 · `SiteFacet` 8,881 · diamond 2,004; monolith `Intact` 25,402 (over EIP-170, so the diamond ships; both builds tested) | `test/{Update,Approvals,Fingerprint,Mint,Rights,Panic,Diamond,Gas}.t.sol` |
| Accounts | `Reach` 20,821 · `Grip` 1,937 | `test/{Reach,Reach7739,Sessions,Ledger}.t.sol`, `tools/verify-vault.mjs` (168) |
| Swap | `Pool` 12,606 (+ `Curve` lib) · `Router` 11,823 | `test/{Pool,PoolReenter,Router}.t.sol`, `tools/verify-pool.mjs` (144), `tools/fuzz.mjs` (9 properties) |
| Social | `Parley` 9,955 · `Postage` 6,088 · `Roster` 3,196 · `KeyRegistry` 1,941 | `test/{Parley,Postage}.t.sol`, `tools/verify-parley.mjs` (81); the E1/E3 mutation gate `tools/mutations.mjs` (below) |
| Vault | `Locks` 5,404 · `Steward` 8,748 · `Timelock` 1,617 | `test/{Locks,Steward}.t.sol`, `tools/verify-steward.mjs` (91), `tools/verify-timelock.mjs` (35) |
| Launch | `Kiln` 9,904 · `Coin` 3,145 · `Launchpad` 15,983 | `test/Launchpad.t.sol`, `tools/verify-launch.mjs` (123) |
| Site | `Engine` 3,672 · `Renderer` 16,156 · `Crest` 3,950 · `Premises` 15,319 · `Catalog` 13,945 + `CatalogState` 15,953 + `CatalogText` 4,864 + `CatalogRows` 1,843 (159 service rows, 211 whole error signatures) | `test/Premises.t.sol` (14), `test/Binding.t.sol` (3), `tools/verify.mjs` (234, incl. "the two surfaces are one byte-stream" and the catalog-against-ABI drift gate), `tools/verify-premises.mjs` (63), `tools/gas.mjs` (79 probes, each COLD: `tokenURI` 7.64 M of 8 M, `/token/1/live` 1.74 M of 2.5 M, `/token/1/hash` 2.42 M of 2.5 M) |
| Console (U9) | `engine/app.html` + `engine/app.css` → one document of 14,955 B gzip (build-failing ceiling 15,000; 45 B under) · six lane panels, gzip against the 8,192 ceiling each: swap 8,172 · social 8,187 · launch 8,155 · vault 8,166 · identity 6,012 · agent 793 (the stub until U17) | `tools/verify-site.mjs` with every group present: 513 passed, 0 failed (boot 131, swap 84, social 76, launch 82, vault 68, identity 65, the runner's 7); `tools/selftest.mjs` (52); `tools/dom-shim.mjs` is the harness |
| Console journeys (U11, **complete**) | `tools/verify-console.mjs` (1,662 lines): the served bytes in Playwright's Chromium 141 behind an in-process HTTP gateway over the in-process chain, the shim's own EIP-1193 wallet injected over `exposeBinding` and announced over EIP-6963, nine groups — boot, viewer, session, swap, social, identity, vault, launch, journey. `tools/testnet-drive.mjs` (252 lines): the same journey over a real wire — `npx hardhat node` (cancun), `tools/deploy.mjs`'s CREATE3 run journaled and recorded under a scratch directory, `tools/gateway.mjs` serving the bytes, the wallet signing with a dev key and sending `eth_sendRawTransaction` to the node | verify-console **167 passed, 0 failed** in 4 m 06 s on U11's run of this code (boot 32, viewer 14, session 9, swap 22, social 18, identity 12, vault 19, launch 9, journey 28; the ≥ 110 gate met); the merged tree's own run is the battery table below. Proved in a real browser and nowhere else: the loader's EIP-6963 capture is load-bearing both ways (two wallets found; none when the capture lines are cut from the served body); the CSP is enforced and blob: panels run under it; the viewer is a `data:` document with an opaque origin (`localStorage` throws SecurityError, `crypto.subtle` is undefined, no request leaves it, never a prompt); a real WebCrypto run of `engine/whispers.mjs` on 127.0.0.1 (Chromium's P-256 point equals Node's; a sealed whisper laid, mined and read back open; refused after a rotation); the 7702 delegate's five spending controls are display:none and unreachable by a click; Home's and the Grip's QR screenshotted and decoded with jsqr; mint → open → connect → swap → speak → launch → seal → sell → the buyer's clean `rightsOf` with every receipt 0x1. testnet-drive: 35 passed, 0 failed in 293 s (the deploy 81.44 M gas, recover-record 345 fields, 0 disagreeing) |
| Battery (U12, **complete**) | `tools/check.mjs` (the runner behind `npm run check`), `tools/verify-findings.mjs` (792 lines), `tools/agents.mjs` (548), `tools/invariants-check.mjs` (384), `tools/mutations.mjs` (263) | verify-findings 36 verdicts, 0 failed: 31 refuted on HEAD, 5 reproduced against a copy of the source with one guard removed (C1, C2, C5 without their locks and cap; a Postage whose `expire` forgot the settled flag; a Steward whose `stillHere` forgot the door), 2 n/a (no handle registry, no hire flow), 5.4 s. agents: seven motives × 220 ticks over the real hub, three owned markets, a graduated sealed market, a raise, the commons, a priced inbox and a session key on a Reach sold and bought back under it — 6,623 invariant checks held, 0 failed in 60 s (seed 858423813; U12's two recorded seeds held 6,723 and 6,727). invariants-check: 89 passed, 0 failed — every INVARIANTS and DESIGN §14 row names an assertion that exists, F7 included. mutations: 19 one-token mutations of Parley and Postage in a tree pruned to the two contracts and their suites — 17 killed by named tests, 2 survived (P11, P13; see observations); P13 under `test/Bundle.t.sol` in the full tree: running when this checkpoint was committed — the follow-up commit records the verdict |
| Documents (U12 + integration) | `CLAUDE.md` (new), `docs/SECURITY.md` (new), `docs/AGENT.md` (new), `docs/CONSOLE.md` (§6.2 reconciled; §16 measured; §17 the Chromium battery), `docs/INVARIANTS.md` (the new provers cited row by row; F5 and F7 cite the Chromium sentences; F6 names the deferred gateway tool as pending), `docs/ACCOUNTS.md` (re-measured unchanged), `README.md`; DESIGN §14 E3 and F4 corrected so every cited assertion exists | `tools/invariants-check.mjs` 89/0 on this tree |
| Deployment (U10) | `Create3Factory` 1,103 · `tools/deploy.mjs` · `tools/recover-record.mjs` · `tools/verify-recover.mjs` · `tools/gateway.mjs` · `deployments/31337.json` (schema `intact.deployment/1`, from a hardhat run with every lane real) | `test/Create3.t.sol` (13), `tools/verify-recover.mjs` (137) |
| Bundle | all of the above wired by one `IntactConfig` | `test/Bundle.t.sol`: seven end-to-end journeys incl. selling the bundle, buy-back, panic, steward |

`npm run check` is now `node tools/check.mjs`: compile (the EIP-170 gate and the ship rule) → facets
(+ selftest) → selftest → build → forge on the monolith → forge on the diamond → gas (+ selftest) → verify
→ verify:site → verify:pool → verify:vault → verify:parley → verify:launch → verify:steward →
verify:timelock → verify:premises → fuzz → verify:findings → agents → static-audit (+ selftest) →
verify:recover → verify:console → invariants. Every step must print exactly one summary line of the shape
that tool prints, reporting zero failures; a non-zero exit, no summary, two summaries, a failure count or a
missing step file fails the run; `--only`/`--skip` is a PARTIAL run and is never called green. Last result
(2026-10-13, the merged tree, 4 cores):

*(the merged tree's battery was running when this checkpoint was committed; its table of counts and times, and the verdict, land in the follow-up commit — nothing below quotes a number that was not measured)*

## Decisions taken during the build (see DESIGN.md §3, §12, §14, §15 and docs/INTERFACE-CHANGES.md)
- The diamond ships (monolith 25,402 B > 24,576). Same source, both builds tested.
- `Timelock.execute` is open to anyone; Reach `sealMax` is idempotent at the cap; `setScriptURI` reverts for everyone so the ERC-5169 claim is honest.
- Reach measured 20,821 B against a 19,000 budget (accepted under the 21,000 valve).
- U7: the pipeline (gzip shards, the state gap as a sibling `<script>window.INTACT=…</script>`, the loader, the keccak manifest, `/panel/<name>.js` routes) is real and tested; `Base64.encode` was rewritten (55 gas/byte, canonical padding). `TokenState.absent` distinguishes "not deployed here" from "could not be read".
- U10 (DESIGN §12, decision 36): one CREATE3 factory per band from a fresh nonce-0 burner under salts `keccak("intact.v1.<key>")`; `Create3Factory.deploy` admits only the burner and the Timelock; the Engine is the burner's plain CREATE at nonce 2 and its shards `CREATE(engine, 1 + k)`; module immutables predicted before construction; the record written last, with no RPC endpoint; `recover-record` tells drift from contradiction; a resumed run reads the Engine's own `shardHashes()` and refuses a `dist/` rebuilt since the crash.
- U9 (docs/CONSOLE.md is the contract; docs/u9/DECISIONS.md D1–D20 and docs/u9/BLUEPRINT.md the working documents): three boot modes; the EIP-6963 rule; `eth_chainId` before any read; the confirm slab re-reads `custodyEpoch` inside the press and refuses any approval of 2^255 or more, also inside `execute`/`executeBatch`/`executeTyped`; amounts are BigInt and chain strings reach the DOM through `textContent` only; panels are IIFE Blob scripts keccak'd against `INTACT.panels` before injection; the sealing key is one per wallet from `personal_sign("INTACT seal v1 · chain <c> · hub <hub>")`.
- U11: the Chromium battery fronts the in-process chain with an in-process HTTP gateway (GET onto `Premises.request`, every header the contract set, a `/<premises>:<chain>` prefix stripped as a path-based gateway would) and reuses the shim's `walletFor` over `exposeBinding`, so `W.calls`, `W.prompts` and the full revert data are the shim's; errors cross the binding as `{message, code, data}` and are rebuilt page-side. The viewer is the served body as a `data:text/html;base64` URL inside an `<iframe>` of a blank host page — the marketplace's shape, and the only one Chromium allows (a top frame may not navigate to a `data:` URL, not even by its fragment). `tools/testnet-drive.mjs` sends through the node, never through the gateway's read-only `/__rpc`.
- U12: `npm run check` reads output, not only exit codes (`tools/check.mjs`, MASTER's "incomplete ≠ pass"); a verifier that is not on disk fails the battery rather than shrinking it, which is why `verify:console` was in the default list before U11 landed. A reproduction in `verify-findings` is the real source with one guard removed, compiled separately and deployed beside the real contract — never a mock pretending; a donor claim with no counterpart is an `n/a` line. The mutation gate runs in a copy of the tree pruned to the two contracts, their imports and their suites (minutes per mutation instead of a full viaIR compile each), is not in `check`, and quotes its result in INVARIANTS E1/E3; a survivor is a test request written into the row, never a reason to drop it.
- Integration: the ledger cites a file only once it exists. INVARIANTS F6 names `tools/verify-gateway.mjs` in its status cell as U13's, deferred, and DESIGN §14 F6 names the gateway diff as `verify-gateway` (U13, pending); `invariants-check` would otherwise fail a live row on a missing file. DESIGN §14 gained two citation corrections from U12's checker: E3's `test_aRotatedKeyRefusesTheWhisper` lives in `test/Parley.t.sol`, and F4 cites `test_aCoinNamedScriptTagCannotEndTheStateBlock` and *"the name trait is text on Home"* — a sentence that exists — rather than one no file printed.
- Residuals documented in DESIGN §3 and docs/SECURITY.md §5: an Intact sent to the undeployed canonical account of an unminted id is not classifiable; panic keeps the guardian; `ClearPathCache` is not emitted on `setUser`/`setStatus`/`pause`; Postage payer is the Reach; a home room can be followed only after its steward's first act; `R_ROLE` reads the USER role only until U16.

## Observations recorded, not changed (for the shell's next round and for U13)
1. **(U11, new)** In a marketplace frame `navigator.clipboard` is undefined, and the vault's copy button throws an uncaught TypeError when pressed in the viewer; `verify-console` sets the sentence aside by name in its viewer group. The fix is a guard where the button is built (the vault panel is 26 B under its ceiling, so it pays in cuts first, or the shell's `button` helper absorbs it).
2. The previous checkpoint's observation 1 (after a receipt the shell's `facts()` fires `intact:epoch` before `rights()` re-reads, so a panel repainting on `intact:epoch` might see `ui.act` draw nothing) was probed in Chromium after the holder's own panic and did not manifest: the vault still offers its controls and prints no false could-not-be-read sentence. Kept as a note for the shell's next round, not as a bug.
3. The mutation gate's two survivors are test requests to `test/Parley.t.sol`, written into INVARIANTS E1: P11 (`_hidden[room][seq >> 8]` as `seq >> 7` — no test hides a message with `seq ≥ 128`) and P13 (`keyOf`'s `b.epoch != custodyEpoch` as `>` — no Parley or Postage test buys a token back under a binding; `tools/agents.mjs`'s flipper reads `keyOf` after every buy-back). P13 under the Bundle suite in the full tree: running when this checkpoint was committed; the follow-up commit records the verdict.
4. The previous checkpoint's observations 2–4 stand: an exception inside a Blob panel's promise callback is invisible to the shim (in Chromium it is a `pageerror`, and every `verify-console` journey asserts none); `ui.kv` concatenates key and value with no separator; the shell is 45 B under its ceiling and the vault 26 B under its own.
5. `tools/check.mjs` on four cores takes well over the sixteen minutes of the old chain (the merged run's time is recorded by the follow-up commit); the standalone verifiers, the findings replay, the agents run and the Chromium battery are what it added over the sixteen-minute chain the previous checkpoint measured. The compile cache (`out/compile-cache/`) is keyed by the whole input, so a run that changes no Solidity compiles nothing.
6. Both public testnet endpoints answer from this container through the proxy (`https://sepolia.base.org` → chain 84532, `https://ethereum-sepolia-rpc.publicnode.com` → 11155111); `tools/rpc.mjs` already routes non-local URLs through it. What U13 lacks is a funded nonce-0 burner, not connectivity.

## What remains (BUILD-PLAN.md)
Wave 3's U11 and U12 are complete. **U13 — the testnet rehearsal — remains**: `tools/testnet.mjs` (the
public-RPC rehearsal in one command: preflight → `deployIntact` through `adapt(RpcChain)` → a campaign
exercising every function family live with receipts — mint, open market, swap both ways, speak, whisper
stamped, raise → graduate → collect, lock, seal, session act, panic, steward summon/cancel, sell → the
record recovered with 0 disagreeing → `verify-gateway` → `tokenURI` measured on three public endpoints →
the burner's disposition), `tools/verify-gateway.mjs` (a gateway's bodies and headers diffed against local
`eth_call` for every route template of DESIGN §5.3, the injection finding named by route),
`docs/DEPLOYMENT.md`, and `deployments/84532.json` and `deployments/11155111.json` from real runs. It needs
a funded nonce-0 burner and an RPC; `deployments/README.md` names the campaign/exercise record shapes it
adds. INVARIANTS F6's gateway half and the `verify:gateway` nightly stay pending U13. INVARIANTS rows
still pending beyond that: D2 and D6 for U14, G2 for U17. Wave 4 (post-MVB): U14 Uniswap v4 launch path;
U15 Market; U16 Roles; U17 agent surfaces; U18 Nameplate; U19 audits + mainnet.

## How to resume
```sh
git clone https://github.com/venividis/Special && cd Special
git checkout ccr-d811d3ab-ng4o64 && npm install      # this branch — or main, once its PR is merged
npm run check                                       # must be green before any new unit (the time is in the battery table above)
node tools/check.mjs --only verify:console          # a PARTIAL run of one step while iterating (never green)
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/verify-console.mjs --group swap   # one Chromium group
node tools/verify-site.mjs --group vault            # one lane through the shim, ≈ 30 s
node tools/forge.mjs --match X                      # one suite while iterating
npm run drive                                       # the journey over a real wire: hardhat on 8546, the gateway on 8081
npm run mutations -- --list                         # the E1/E3 mutation table; run it in a pruned copy (CLAUDE.md)
```
Then U13 in a worktree branched from the merged head (one agent, owning `tools/testnet.mjs`,
`tools/verify-gateway.mjs`, `docs/DEPLOYMENT.md`, `deployments/`), proved over `npx hardhat node` first and
run against Base Sepolia only with a funded burner; merge when its suite and the whole `npm run check` are
green. `CLAUDE.md` holds the conventions and the traps.
