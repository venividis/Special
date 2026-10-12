# Checkpoint — where INTACT stands and how to continue

Written at the end of the second build session (2026-10-09). Everything below is on branch
`claude/special-work-continuation-0l0uhq` of `venividis/Special`: `main` at 5aa323b (the first
checkpoint) plus the U10 and U9 unit branches merged in that order. The unit branches' commits are in
this branch's history; the branches themselves were not pushed.

## What exists and is verified

| Layer | Contracts (measured bytes, this tree) | Evidence |
|---|---|---|
| Hub | `IntactDiamond` + `CoreFacet` 12,785 · `RightsFacet` 5,034 · `MintFacet` 5,368 · `SiteFacet` 8,881 · diamond 2,004; monolith `Intact` 25,402 (over EIP-170, so the diamond ships; both builds tested) | `test/{Update,Approvals,Fingerprint,Mint,Rights,Panic,Diamond,Gas}.t.sol` |
| Accounts | `Reach` 20,821 · `Grip` 1,937 | `test/{Reach,Reach7739,Sessions,Ledger}.t.sol`, `tools/verify-vault.mjs` (168) |
| Swap | `Pool` 12,606 (+ `Curve` lib) · `Router` 11,823 | `test/{Pool,PoolReenter,Router}.t.sol`, `tools/verify-pool.mjs` (144), `tools/fuzz.mjs` (9 properties) |
| Social | `Parley` 9,955 · `Postage` 6,088 · `Roster` 3,196 · `KeyRegistry` 1,941 | `test/{Parley,Postage}.t.sol`, `tools/verify-parley.mjs` (81) |
| Vault | `Locks` 5,404 · `Steward` 8,748 · `Timelock` 1,617 | `test/{Locks,Steward}.t.sol`, `tools/verify-steward.mjs` (91), `tools/verify-timelock.mjs` (35) |
| Launch | `Kiln` 9,904 · `Coin` 3,145 · `Launchpad` 15,983 | `test/Launchpad.t.sol`, `tools/verify-launch.mjs` (123) |
| Site | `Engine` 3,672 · `Renderer` 16,156 · `Crest` 3,950 · `Premises` 15,319 · `Catalog` 13,945 + `CatalogState` 15,953 + `CatalogText` 4,864 + `CatalogRows` 1,843 (159 service rows, 211 whole error signatures; one Catalog measured 54,023 B, so it is four) | `test/Premises.t.sol` (14), `test/Binding.t.sol` (3: the shell's ERC-6551 derivation and salts equal the contracts'), `tools/verify.mjs` (234, incl. "the two surfaces are one byte-stream" and the catalog-against-ABI drift gate), `tools/verify-premises.mjs` (63), `tools/gas.mjs` (75 probes, each COLD: `tokenURI` 7.64 M of 8 M on the real shell, `/token/1/live` 1.74 M of 2.5 M, `/token/1/hash` 2.43 M of 2.5 M) |
| Console (U9, **partial**) | `engine/app.html` + `engine/app.css` → one document of 14,976 B gzip (build-failing ceiling 15,000; budget 14,000, unmet) · `engine/panels/agent.js` (the stub) · the swap, social, launch, vault and identity panels are still `tools/fixtures/panels/*.js`, and the build header says so | `tools/verify-site.mjs --group boot` (125: twelve blocks — build and boot, the viewer, the tampered panel, discovery and the chain gate, the collection page and the mint, session mode, the QR, the self-hash footer, the chips, escaping, the loader, the slab's generic rules), `tools/selftest.mjs` (52; the chain half is 12,145 B, keccak `0x35000df5286898c97cc976ab4d104fe8ed13d25b80fb090a098d6236b4617352`), `tools/dom-shim.mjs` is the harness (a DOM, `document.open/write/close`, Blob scripts, fetch over the deployed Premises, an EIP-1193 wallet answering through `Chain.simulate` with every call and prompt recorded) |
| Deployment (U10) | `Create3Factory` 1,103 · `tools/deploy.mjs` (journaled, resumable, over JSON-RPC or in-process) · `tools/recover-record.mjs` · `tools/verify-recover.mjs` · `tools/gateway.mjs` (read-only) · `deployments/31337.json` (schema `intact.deployment/1`, from a hardhat run) | `test/Create3.t.sol` (13), `tools/verify-recover.mjs` (130: six bands deployed in-process, 31337 and OP recovered field by field with 0 disagreeing, sixteen tampered records caught by name) |
| Bundle | all of the above wired by one `IntactConfig` | `test/Bundle.t.sol`: seven end-to-end journeys incl. selling the bundle, buy-back, panic, steward |

`npm run check` = compile with the EIP-170 gate and the ship rule → facet-cut derivation → selftest →
build → the suite on BOTH builds (`INTACT_IMPL=monolith` and `=diamond`) → view-gas gate, cold →
`verify` (the equality step) → `verify:site` (the shell through the shim) → static audit →
`verify:recover` (the order DECISIONS D17 fixed, with U10's recovery step kept last).
Last result (2026-10-09, this tree): exit 0 in 13 m 21 s on 4 cores — all gated contracts under 24,576 B and the diamond ships; facets self-test 8; selftest 52; shell 14,976 B gzip; 286 passed / 0 failed on the monolith and 286 / 0 on the diamond; 79 gas probes cold, every view under its cap; verify 234; verify-site 125; static audit clean; verify-recover 130.

## Decisions taken during the build (see DESIGN.md §3, §12, §15 and docs/INTERFACE-CHANGES.md)
- The diamond ships (monolith 25,402 B > 24,576). Same source, both builds tested.
- `Timelock.execute` is open to anyone; Reach `sealMax` is idempotent at the cap; `setScriptURI` reverts for everyone so the ERC-5169 claim is honest.
- Reach measured 20,821 B against a 19,000 budget (accepted under the 21,000 valve).
- U7: the pipeline (gzip shards, the state gap as a sibling `<script>window.INTACT=…</script>`, the loader, the keccak manifest, `/panel/<name>.js` routes) is real and tested; `Base64.encode` was rewritten (55 gas/byte, canonical padding). `TokenState.absent` distinguishes "not deployed here" from "could not be read".
- U10 (DESIGN §12, decision 36): every deployable lands through one CREATE3 factory per band from a fresh nonce-0 burner under salts `keccak("intact.v1.<key>")`, so each name has one address on every band; `Create3Factory.deploy` admits only the burner and the Timelock's predicted address (a review found that an open `deploy` let a stranger land code at the hub's codeless `MARKET` pin and call `moduleTransfer`); the Engine is the burner's plain CREATE at nonce 2 and its shards are `CREATE(engine, 1 + k)`; the hub's module immutables are predicted before construction and the deploy refuses to publish on any miss; the record is written last and carries no RPC endpoint; `recover-record` tells drift (the chain moved on) from contradiction (the chain disagrees with itself).
- U9 (docs/CONSOLE.md is the contract; docs/u9/DECISIONS.md D1–D20 and docs/u9/BLUEPRINT.md are the working documents it was built from): three boot modes — viewer on an opaque origin (never signs, never offers connect), console, session (`?as=<key>`); the EIP-6963 rule — one announcer is used silently and not remembered, two or more open the picker before the first `eth_call`, `window.ethereum` only when none announce; `eth_chainId` is asked before any read and `wallet_switchEthereumChain` is the only move offered; the confirm slab re-reads `custodyEpoch` inside the press handler and refuses any approval of 2^255 or more, also when hidden inside `execute`/`executeBatch`/`executeTyped`; amounts are BigInt and chain strings reach the DOM through `textContent` only; panels are IIFE Blob scripts whose inflated bytes are keccak'd against `INTACT.panels` before anything is appended; the loader keeps the inflated bytes on `INTACT.$doc` (the footer hashes the document it is running in) and captures EIP-6963 announcements before `document.open()` (they are lost otherwise — a boot assertion cuts the capture and proves it); the sealing key is one per wallet, derived from `personal_sign("INTACT seal v1 · chain <c> · hub <hub>")`.
- U9 prep: the Catalog's token-level keys that shadowed world addresses were renamed (`ownedMarket`, `reachLocks`, `stewardStatus`, `roleCount`); the `err` table serves whole signatures (`"0x2746152a":"Slippage(uint256,uint256)"`) so a panel can decode arguments; nine rows were added (159), each held to its contract's ABI by the drift gate; `CATALOG_HASH` is `0x85a5340fa3b64fdab7d6b547a1d3c548058583fb90a513f44fc4ac20706e313e`.
- `INTACT.$lib` publishes the 15 names block 2 reads, not the 23 the blueprint listed (cut rule 6, pre-authorised); the 6551 derivation, EIP-712 and `decString` stay in the source where the selftest proves them and leave the build. Cut rule 3 (a static-only `tuple()`) was not taken: CONSOLE §5 promises a dynamic tuple.
- Residuals documented in DESIGN §3: an Intact sent to the undeployed canonical account of an unminted id is not classifiable; panic keeps the guardian; `ClearPathCache` is not emitted on `setUser`/`setStatus`/`pause`; Postage payer is the Reach; a home room can be followed only after its steward's first act; `R_ROLE` reads the USER role only until U16.

## U9: what is built, what is open, and what is not built
Built and in `npm run check`: the shell, the shim, the runner and the boot group; INVARIANTS F2–F5 are
live through them and F6's chips are. The session was stopped after the first fix round, as asked;
the second round's review ran and its findings are recorded here, unfixed:

1. **medium** — `ask()` registers the picker's backdrop dismissal with `{ once: true }`; the first click anywhere inside the picker (the card, its heading) spends it, after which the backdrop no longer dismisses and the person can only proceed by picking a wallet. Reproduced through the shim; fix priced at +8 B gzip; one sentence for boot N ("a click inside the picker does not spend the dismissal").
2. **medium** — clicking your own address in the crest nulls `account` without re-running the rights path, so a dismissed picker leaves `ui.rights()` at 1 while `ui.account()` is null, `#connect` hidden, the crest naming the dropped wallet and every read still going to it; the handler's `account` guard then makes a second click a no-op. Fix priced at +13 B; needs the CONSOLE §2 sentence "until the picker is answered the page is in the dismissed state".
3. **medium** — the byte budget. The shell is 14,976 B gzip, 976 B over BLUEPRINT §3's 14,000 budget and 24 B under the build-failing ceiling; findings 1 and 2 cost +20 B together and the `#switch` double-refresh fix another +7, which crosses 15,000. BLUEPRINT §3's pre-authorised cut list is exhausted. Decide first: accept ≈ 14,992 B as the measured number (record it in INVARIANTS F2 and BLUEPRINT §3) or name new prose cuts.
4. **low** — a failed `eth_chainId` prints "chain 0"; `rights()` writes after an `await` with no sequence check (hidden by the shim's serialised queue); `ROWS` is shared across panels, so "not declared by this panel" is unenforceable; the shim's `allowOverCap` is unconditional; the shim's `click()` honours `disabled` but not `hidden`; a successful `#switch` refreshes every read twice; CONSOLE §6.1's "refreshed from `hub.locked(id)`" describes code that reads `coreOf` words 2 and 7 (the same rule as `_locked`).
5. **info** — a pinned panel could inject a fake announcer into the picker (only a hash-pinned panel runs, so this is a trust statement, not a hole); `build-app`'s header still reads "not the console".

Not built: the swap, social, launch, vault and identity panels (BLUEPRINT §4 skeleton, §5 screens and
rows, §7 groups) and their `tools/verify-site/<name>.mjs` groups (DECISIONS D20 layout). The runner's
assertion enforces `placeholder === false` by itself once all six groups exist, and the BUILD-PLAN
gate of ≥ 150 assertions applies to that full run; the boot group alone is 125. The viewer's
`rightsOf` read without `eth_getCode` is within CONSOLE §3's letter and was left as is.

## What remains (BUILD-PLAN.md)
Wave 2: U9's five panels (above). Wave 3: U11 Chromium journeys (the boot group's sentences in a real
browser); U12 adversarial battery, findings replay, docs (INVARIANTS rows still pending: D2 and D6 for
U14, G2 for U17, F6's gateway half for U13, E3's mutation gate); U13 testnet rehearsal (`deploy.mjs`
over a wire, `recover-record` against it, the gateway). Wave 4 (post-MVB): U14 Uniswap v4 launch path;
U15 Market; U16 Roles; U17 agent surfaces; U18 Nameplate; U19 audits + mainnet.

## How to resume
```sh
git clone https://github.com/venividis/Special && cd Special
git checkout claude/special-work-continuation-0l0uhq && npm install
npm run check                               # must be green before any new unit (≈ 17 min on 4 cores)
node tools/verify-site.mjs --group boot     # the shell alone: build, compile, one chain, ≈ 20 s
node tools/forge.mjs --match X              # one suite while iterating
```
Then: settle finding 3 (the budget), fix 1 and 2 with their boot sentences, and start the five
panels — one agent per panel in a worktree branched from this branch, sharing `out/compile-cache`,
each owning `engine/panels/<name>.js` and `tools/verify-site/<name>.mjs` and nothing else (DECISIONS
D20); merge each when its group and the whole `npm run check` are green. U11 follows the panels.
