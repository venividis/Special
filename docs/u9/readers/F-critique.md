<!-- Reader report from the U9 understand phase (2026-10-08): what the donors contain, measured against their git refs, and what INTACT keeps or drops. Working document; docs/CONSOLE.md and docs/u9/DECISIONS.md record what was decided from it. -->

# F — completeness critique of the U9 understand phase

Critic's read of reports A–E against BUILD-PLAN.md §U9 (lines 96–101),
DESIGN.md §1, §2, §5 (lines 17–76, 265–306), and the source. Every claim
below that mattered was re-checked with `grep`/`sed`/`node` in this
container on 2026-10-08; the command or the file:line is given. Nothing
under `/home/user/Special` or `/home/user/wt` was written.

Verdict in one paragraph: the five reports are individually careful and
together cover the donors, the state block, the ABIs and the harness well
enough to start designing. They contradict each other or the source in
fifteen places (§1), most of them small, four of them load-bearing: two
different donor versions of the wallet library were read (A the working
tree, C the branch); the `INTACT.sel` key shape is wrong in A; the error
table is wrongly said to carry argument types in D; and the "verified
against chain at block N" self-hash that DESIGN §5.4/§11.7/§13 and
`Premises.sol:267-270` describe has no mechanism in the built Renderer. The
gaps (§2) are larger than the contradictions: the Vault cannot enumerate
sessions, cannot address Locks or Steward, the collection document `/` and
the `?as=<key>` session mode have no design, the QR has no source and no
spec, and the Catalog's key shadowing blocks three of the eleven
BUILD-PLAN sentences as C has planned them. Fourteen decisions (§5) are
needed before `engine/app.html` can be written without rework.

---

## 0. What was spot-checked (so the next reader need not)

| Claim | Command / file:line | Result |
|---|---|---|
| Catalog `TPL_TOKEN` reuses world keys | `sed -n 855,900p src/Catalog.sol` | `TPL_WORLD` 862–864: `"locks":"\x01","steward":"\x01","market":"\x01","roles":"\x01"`; `TPL_TOKEN` 875–876: `"market":\x04,…,"locks":\x04,"steward":\x04,"roles":\x04`. **Confirmed.** `tools/verify.mjs:191,193` assert `S.locks === 0`, `S.steward === 0`. |
| 6551 salts | `grep -n SALT src/lib/AccountBinding.sol` | 26–27: `keccak256("intact.reach.v1")`, `keccak256("intact.grip.v1")`. A correct. |
| Loader keeps its inflated bytes? | `sed -n 76,84p src/Renderer.sol` | `const t=…; document.open();document.write(t);document.close();` — `t` is a local of the async IIFE, never stored. **The shell has no byte-exact copy of itself.** |
| `/hash` route | `sed -n 267,281p src/Premises.sol` | returns `{document, head, body, state, engine, block}`; comment says "The crest's footer prints 'verified against chain at block N' after comparing its own inflated bytes to these." |
| Reach session enumeration | `grep -n "function session" src/interfaces/IReach.sol` | 160–164: `sessionAllows(key,…)`, `sessionExposure(key)`, `sessionCurrent(key)`, `sessionOf(key)`, `sessionCaps(key)` — **all keyed by address; no list, no count.** `SessionGranted` event (67) is the only enumeration path. |
| Reach size | `node -e` over `out/solc.json` | **20,821 B** (valve at 21,000 B, DESIGN §9.2). Catalog 13,945; CatalogState 15,914; Launchpad 15,983; Premises 15,319; Renderer 15,922. |
| SERVICES rows for knownDelegates, firstLaunchApproved, stampOf, pieces, getApproved, userOf, isApprovedForAll, guardNFT, heirHashOfToken, evict, setCooldown, revokeEncryptionKey | `grep -n … src/Catalog.sol` | only `knownDelegates()`'s own definition at 1426. **No row for any of them.** D's gap list is correct. |
| `graduationTarget` | `grep -n graduationTargetOf src/Launchpad.sol` | 156 `mapping(uint256 => uint128) public graduationTargetOf;` — not in the `Launch` struct (ILaunchpad.sol 21–42), no SERVICES row. |
| `/services.json` `errors` shape | `sed -n 791,800p src/Catalog.sol`; `node -e` on `dist/services.json` | `_renderErrors` cuts each entry at `(`: `[["0x29b490ad","NoSuchToken"],…]` — **names only**, identical to `INTACT.err`. The `ERRORS` constant (681–724) does hold the signatures (`Slippage(uint256,uint256)`, `Sealed(uint64)`…) but they are never served. |
| `sel` key shape | `sed -n 555,570p src/Catalog.sol` | 562–564: `word(letter) + "." + name` → `"hub.rightsOf"`. E's Appendix A and `dist/state-1.json` agree. |
| KeyRegistry keying | `grep -n mapping src/KeyRegistry.sol` | 45: `mapping(address account => KeyRecord)`; `setEncryptionKey(uint16,bytes)` has no token parameter. **One key per wallet address.** |
| Donor `ipseity.html`, tree vs branch | `sed -n '1859,2396p' … \| wc -c` on both | working tree (HEAD `297e936`) **24,449 B** = the BUILD-PLAN/DESIGN number; `origin/claude/claude-md-docs-8vvyc8` **24,678 B**; `git diff --stat` = 22 lines in 3 hunks (see §1.1). |
| Chooser auto-pick | `grep -n "P.size===1" src/Chrome.sol` (donor) | 292: `if(P.size===1)return CHO=P.values().next().value;` — B transcribed it right. |
| build-app gates | `sed -n 48,53p; 80,93p; 246,255p tools/build-app.mjs` | `SHELL_GZIP_CEILING = 18_000`, `PANEL_GZIP_CEILING = 8_192`; six FORBIDDEN regexes incl. `innerHTML\s*=` and `document.write(`; host scan `/https?:\/\/[a-z0-9.-]+\.(?:org\|com\|io\|xyz\|net)\b/i`, `/\bwss?:\/\//i` on `dist/app.html` and `dist/panels/*.js`. E exact. |
| `npm run check` contents | `grep -n '"check"' package.json` | line 35: `compile && facets && forge:monolith && forge:diamond && gas && gas:selftest && static-audit` — **no `selftest`, no `build`, no `verify`, no `verify-*`.** DESIGN §13 (line 550) lists all of them. |
| `selftest` today | `ls engine/`; `node tools/selftest.mjs` | `engine/` holds only `whispers.mjs`; selftest throws ENOENT on `engine/ipseity.html`. A's "byte-identical to the donor's" is right and the script is dead until U9 repoints it. |
| QR encoder in any donor | `grep -rli "reed.solomon\|qrcode\|GF256\|function qr"` over I, A, G, M | no JS/HTML/Solidity hit (DeskEstate's `qr…` are `$('qrev')` ids; MASTER's hits are bundled third-party dists). **No donor QR exists; it is new code**, as BUILD-PLAN says ("C's self-drawn SVG QR (≈ 3 KB, NEW)" — "C" is the design candidate of DESIGN §15, not a repository). |
| Fixture shell contract | `sed -n 1,160p tools/fixtures/app-placeholder.html`; `cat tools/fixtures/panels/social.js` | ids `#viewer #facts #reported #lanes #lane-<name> #verified`; detector `try{localStorage.getItem("intact")}catch{opaque=true}`; nav from `Object.keys(S.panels)`; `lane.dataset.loaded="1"` set by the shell before injection; panel sets `S.loaded[name]=true`; panel hash compared on the **fetched** (browser-inflated) bytes. |
| Said / speak / whisper layouts (B vs D) | `grep -n "event Said\|function speak\|function whisper" src/interfaces/IParley.sol` | `Said(room idx, from idx, u64 prev, u64 prevFrom, u64 seq, u8 kind, u64 reBlock, u64 reSeq, bytes body)` → event-data body offset is head word 6 (`0xe0`); `speak(...)` has six args → calldata body offset word 5 (`0xc0`); `whisper(...)` five → `0xa0`. B and D agree and are right. |
| `Chain.call` revert truncation | `sed -n 409,428p tools/evm.mjs` | 424: `${ret.slice(0, 138)}` — C and E agree; `QuoteResult` (100 B) and `Slippage` (68 B) need `runCall` directly. |
| `/k/<id>/<key>` door | `grep -n '"k"' src/Premises.sol` | 186–192: 301 → `/token/<id>/live?as=<key>`. |

---

## 1. Contradictions, with evidence and resolution

### 1.1 Two different donor wallet libraries were read (A vs C; BUILD-PLAN vs itself)
- **A** read `/home/user/Most-Advanced-NFT-Possible/engine/ipseity.html` in the working tree (24,449 B for 1859–2396, 4,035 lines). **C** read `origin/claude/claude-md-docs-8vvyc8:engine/ipseity.html` (24,678 B, 4,037 lines) and quotes line offsets from it (e.g. `WALLETS`/`discover()` at 2074–2101, which are 2077–2100 in the tree).
- The diff (`git diff HEAD origin/claude/claude-md-docs-8vvyc8 -- engine/ipseity.html`): (i) the branch's `CHAINS` has eight entries, each with an `rpc` and `ex` URL (tree: two); (ii) the branch's attestation display at ≈2963 does `el.innerHTML = '<pre class="code">computed here ' + here + …` — **chain data interpolated into innerHTML** — where the tree does `el.innerHTML = '<pre class="code"></pre>'; el.firstElementChild.textContent = …` with a `^0x[0-9a-fA-F]{64}$` check on the answer; (iii) the nest iframe's `sandbox` gains `allow-same-origin` on the branch. The tree is the later, safer text.
- BUILD-PLAN names the branch only for `console.js`/`console-lanes.js`/`verify-site.mjs`/`verify-console.mjs`; its 24,449 B for the wallet library is the tree's number.
- **Resolution:** the verbatim unit is the **working tree** (HEAD `297e936`), lines **1858–2394** as A measured (24,407 B; 1859–2396 starts and ends inside a comment and does not parse). C's shim facts are unaffected; C's line references into the wallet library should be re-pointed at the tree (+0 before 2042, −6 after).

### 1.2 "Verbatim" is not achievable as written (BUILD-PLAN §U9, DESIGN §5.5 vs `tools/build-app.mjs:82-93`)
- BUILD-PLAN: "lines 1859–2396 … verbatim". A §3 lists the edits the build gate and the design force: `innerHTML` at 2239 (build-failing), `CHAINS[*].rpc`, `S.rpc`/`fetch` fallback, `wallet_addEthereumChain` with `rpcUrls`, `gwei` (float), `S.collection → S.hub`, salts, `connect()` order and the unconditional `eth_requestAccounts`.
- **Resolution:** redefine "verbatim" as *the selftest slice stays byte-identical* — from the `/*── keccak-256` marker through `agrees` (keccak, hex/utf8, EIP-55, ABI, units, EIP-712, CREATE2-6551 with the two salt lines and `S.hub` changed) — and the transport/UI half (`CHAINS`, `NET`, `rpc`, `connect`, `requireChain`, `propose/fire/watch`) is edited under A §3's list. Record the slice's keccak in `docs/INVARIANTS.md` so "unchanged" is a measured sentence.

### 1.3 `INTACT.sel` key shape (A §3.2 vs D §0, E Appendix A, `Catalog.sol:562-564`)
- A: "`INTACT.sel` is a map `{ rightsOf: "0x…", custodyEpoch: "0x…", panel: "0x…", … }` (row names …)". D/E: keys are `"hub.rightsOf"`, `"engine.panel"`; the source writes `word(letter) + "." + name`; `dist/state-1.json` shows `"sel":{"hub.mint":"0x6a627842",…}`.
- **Resolution:** A is wrong; every shell/panel lookup is `INTACT.sel["<word>.<name>"]`. A's good idea survives: the shell computes `selector(sig)` itself and refuses on disagreement with the baked value.

### 1.4 Error argument types (D §0/§2 vs E §1.7, `Catalog.sol:791-800`, `dist/services.json`)
- D: "(selector → error *name*; the argument types are in §1's tables and in `/services.json` `errors`)" and later "ABI-decode the arguments when the err table's signature has them (`Slippage(uint256,uint256)` → 'got 9, wanted 10')". E: "`/services.json` also carries `errors` (= `err`)" and "the shell cannot decode argument *values* from this table alone (no types)".
- Measured: `_renderErrors` emits `"0x…":"Name"` only; `dist/services.json`'s `errors` is `[["0x29b490ad","NoSuchToken"],…]`. The signatures exist in the on-chain `ERRORS` constant but are cut at `(`.
- Consequences: C's **G5** ("Slippage.*got 9.*wanted 10"), C's **G10**, D's slab rule and DESIGN §11.14 ("slab sentences built from the `sel`/`err`/arg tables") cannot be built from served data today.
- **Resolution:** decision §5.6 — either (a) `CatalogText._renderErrors` also emits the argument list (`"0x…":{"name":"Slippage","args":["uint256","uint256"]}` or a parallel `errArgs` object; U7 file; `CATALOG_HASH` moves, which is fine before deployment) or (b) each panel carries a tiny local table for the errors its slab must explain. (a) keeps "no ABI knowledge in the browser that the chain did not write" and is ~15 lines.

### 1.5 "verified against chain at block N after the shell re-hashes its own inflated bytes" has no mechanism (DESIGN §5.4, §11.7, §13; `Premises.sol:267-270` vs `Renderer.sol:76-84`)
- DESIGN §5.4: "footer prints 'verified against chain at block N' after the shell re-hashes its own inflated bytes against `/token/<id>/hash`". §13: "`/token/<id>/hash` equals the loader's own keccak of the inflated bytes". `Premises.sol:267-270`: "The crest's footer prints … after comparing its own inflated bytes to these."
- The loader (`INFLATE`) is ~300 bytes with no keccak, and its `t` is a `const` inside the async IIFE that is dropped after `document.write(t)`. After `document.open()/write()/close()` the only text the shell can reach is `document.documentElement.outerHTML`, which is a re-serialisation and is not byte-equal to `t` in general (doctype casing, attribute quoting, entity normalisation, void-tag forms). C's **A9** and **M6** assert the footer and a "does not match" on a tampered `/hash` but never say which bytes the shell hashes; the placeholder prints `"state read at block N"` precisely because it cannot.
- **Resolution:** decision §5.3. Options: (a) a one-line U7 change to `INFLATE` — `window.INTACT.$doc=t;` before `document.open()` (a property on the existing object, not a global binding, so `checkLoader` and verify.mjs's "declares nothing at all in global scope" still hold) — then the shell keccaks `INTACT.$doc` (≈40 KB; the BigInt keccak takes on the order of 100–300 ms, run once, off the first paint) and compares with a **live** `Engine.engineHash()` (`eth_call`, `sel["engine.*"]` has no `engineHash` row — one would be added) or `/hash`.`engine`, which is the one comparison that proves "the bytes running here are the bytes the chain pins now" (comparing to the baked `INTACT.engineHash` proves nothing — both arrived in the same document); or (b) rewrite the sentence to what is provable without that change ("panels verified against pins; state read at block N; engine hash on chain agrees with this document's") and fix DESIGN §5.4/§13 and the Premises comment. Either way C's A9/M6 need the chosen bytes named.

### 1.6 The shadowed Catalog keys (D §6.2 vs E §1.2–§1.3)
- D flags `market`, `locks`, `steward`, `roles` as shadowed and the Locks/Steward addresses as **absent** from the state block. E lists both meanings in two tables and writes "The block is valid JSON" without noting that the token keys overwrite the world keys. Source confirmed (§0).
- Consequences beyond the panels: `/token/<id>/state.json` is also what agents read, and `JSON.parse` keeps the last key — the Locks and Steward addresses are unreachable from every state surface, not only the shell.
- **Resolution:** D is right; decision §5.1 (rename the four token-middle keys in `TPL_TOKEN`, update `verify.mjs:191,193`; `CATALOG_HASH` moves). Until then C's J14, K16–K18, K20 (steward row), L2 (`wouldPass`) have no `to` address in the viewer and only `/services.json`'s `contract` fields on the live origin.

### 1.7 "sniper settings" after open (DESIGN §1 Swap vs Pool ABI, DESIGN §15 decision 10, D §2.1)
- DESIGN §1: "fee/curve/seal/sniper settings (S, hidden under a live seal)". Pool: `sniperBps`/`sniperSeconds` are arguments of `openMarket` only ("the sniper fee is armed here and nowhere else", Pool.sol:255-262; DESIGN §15 #10 "settable only at `openMarket`").
- **Resolution:** the Swap panel shows the sniper fee as a fact (countdown while it runs, C's H12) and offers it as a control only inside the Open-your-market form. DESIGN §1's word list should drop "sniper" from the post-open settings.

### 1.8 Per-token key derivation vs a per-address registry (DESIGN §7.3, B §4.7 step 1 vs `KeyRegistry.sol:45`, `IKeyRegistry.sol:33`)
- DESIGN §7.3 and B derive the P-256 scalar from `personal_sign("INTACT seal v1 · chain <c> · token <t> · epoch <e>")` — a different key per token and per epoch. `KeyRegistry.setEncryptionKey(uint16,bytes)` stores **one key per `msg.sender` address** (no token parameter); `Parley.keyOf(token)` returns `getPublicKeys(binding.owner)`.
- A wallet holding tokens #1 and #2 cannot bind both under this sentence: binding #2 replaces the registry entry, so `keyOf(1)` then returns #2's point while the page derives #1's → B's step-3 mismatch sentence on every visit, and DMs to #1 encrypt to a key the holder's #1 derivation cannot open. The epoch death DESIGN wants is already provided by `Parley.Binding{owner, epoch}`; putting the epoch in the sentence adds nothing and forces a re-publish on every custody change of *any* held token.
- No report flags it.
- **Resolution:** decision §5.7 — derive from a sentence naming the chain, the hub and the wallet only (`"INTACT seal v1 · chain <c> · hub <hub>"`), one key per wallet, bound per token with `bindKey`; or accept "one sealed token per wallet" and print it. DESIGN §7.3 and B §4.7 step 1 change either way.

### 1.9 Shim receipt on a reverted send (C §2.2 vs E §2.4)
- C: catch the throw, record `status: "0x0"`, still return the hash (what a wallet does). E's table: "status `0x1` (a revert threw)".
- **Resolution:** C's shape; a page learns of failure from the receipt, never from `eth_sendTransaction` throwing. Keep E's `journal.checkpoint()/revert()` for `eth_call`/`eth_estimateGas` and C's `stateManager.checkpoint → runTx → revert` for the estimate (either works; pick one and put it in one helper).

### 1.10 Single announcer: picker or not (A q1 vs DESIGN §5.4, Chrome.sol:292, C N2)
- DESIGN §5.4: "a picker **whenever more than one announces**, never auto-selected". Chrome.sol picks the sole announcer silently; C's N2 asserts "one wallet is used, but not before a gesture". U11's sentence "the EIP-6963 picker never auto-selects" is about the picker, i.e. ≥ 2.
- **Resolution:** not a contradiction once read closely: one announcer → used, no picker; `eth_requestAccounts` still only on a gesture. Record it in `docs/CONSOLE.md` so U11 does not test the other reading.

### 1.11 Two slab vocabularies, mixed in C (A §2 vs B §2.3 vs C §5)
- A's donor: `#cbox` is the slab **body** (`innerHTML` written), `#confirm` toggles class `open`, buttons `#cgo`/`#cno`, gas row `#cgas`. B's donor: `#cbox` is the **backdrop** toggling class `on`, `#cslab` the body, buttons `[data-go]`/`[data-no]`, no gas row. C uses `#cbox.on` + `#cslab [data-go]` (B's) **and** `#cgas` (A's) in G1/G5/J13/K8, and proposes `[data-calldata] [data-digest] [data-selector] [data-engine]` seams.
- **Resolution:** decision §5.10 — one vocabulary, written down before the shell and the suite. Recommend B's (`#cbox.on`, `#cslab`, `[data-go]`, `[data-no]`, since U11's Chromium driver already relies on it) plus C's data seams and a `[data-gas]` row in place of `#cgas`.

### 1.12 Library gzip size (E q7 vs A §5)
- E: "gzip(minify(ipseity.html lines 1859-2396)) … has not been measured". A measured it: 1858–2394 → terser 13,101 B → **gzip 5,310 B**.
- **Resolution:** answered. Budget arithmetic (E ≤ 14,000 B gzip; A 5.3 KB library; B ≈ 8–9 KB CSS source ≈ 2.5 KB gzip) leaves **≈ 6 KB gzip (≈ 15 KB minified)** for chooser, Home (token and collection), rights gate, DOM-built slab, QR, panel loader and viewer. This is tight and should be tracked per commit.

### 1.13 "selftest.mjs vectors unchanged" (BUILD-PLAN vs A §4.4, measured ENOENT)
- A: 55 → 50 (the five IPSEITY section-word checks go) + 1 proposed 6551 vector `0x6aFB0ef97eB85b6742326c7372421a166C5dac1a`. The script today reads `engine/ipseity.html`, which does not exist in Special; `npm run selftest` throws.
- **Resolution:** decision §5.12 — the 50 chain vectors are what "unchanged" means; add the hard 6551 vector and pin it with one `.t.sol` line against `AccountBinding.predict(address(0), REACH_SALT, 1, 0x1234…5678, 7)`; record in INVARIANTS.md.

### 1.14 Which clock the shell uses for deadlines (B §2.6 lane 3, C §1.3/§6.9, E §1.7)
- The donor computes `deadline = Date.now()/1000 + 900`. C pins `Date.now` to the chain in the shim and asserts word 5 `=== BLOCK.timestamp + 900n` (H5, J8); C also says "use `INTACT.time`". E: `INTACT.time` is `block.timestamp` **at render** — stale once the page has been open. Neither shim lists `eth_getBlockByNumber`, the only way a page learns the chain's current time.
- **Resolution:** decision §5.11 — deadlines from `eth_getBlockByNumber("latest", false).timestamp + 900` when a provider exists (add the method to the shim), `Date.now()` only for live countdown animation; "Dies in fifteen minutes" is then exact in both verify-site and Chromium.

### 1.15 Where the epoch re-read lives (A q5, B q4, C G7)
- A: `fire()`/`refresh()`; B: the slab's go handler, so no panel can forget it; C's G7 asserts exactly that (press Sign → `eth_call custodyEpoch` → refuse on change).
- **Resolution:** agreed in effect: the shell's `propose` go-handler does `custodyEpoch` (and the social panel adds `keyOf` in the same handler); panels never send directly. Record as decided.

### 1.16 Smaller disagreements
- B says `connect(false)` in console.js issues `eth_accounts` before `eth_chainId` and calls that "defensible"; DESIGN says `eth_chainId` **before any read** and A's new order puts `eth_chainId` first. Use A's order; `eth_accounts` is a wallet query, but there is no reason to make it first.
- C's shim `eth_estimateGas` returns `totalGasSpent`; E's returns `executionGasUsed + 21,000 + calldata`. Either; the shell multiplies by 1.25 and the wallet re-estimates anyway.
- A says "`document` is not referenced anywhere in the range"; true, but `propose` reaches the DOM through `$()`, which the shell must define before the range (A lists it).

---

## 2. Gaps — what the implementer still does not know

Each row: the gap, where the answer is (file) or "needs a decision" (→ §5).

### 2.1 Addresses and rows the panels cannot obtain
| Gap | Evidence | Where the answer is |
|---|---|---|
| Locks and Steward **addresses** are not in the state block (shadowed) | `Catalog.sol:862-864` vs `875-876`; `verify.mjs:191,193` | needs a decision → §5.1 (rename in `TPL_TOKEN`; U7 file) |
| **Session enumeration**: Vault › Sessions and Panic's list need the set of live keys; `IReach` has only per-key views | `IReach.sol:160-164`; Reach 20,821 B vs the 21,000 B valve (DESIGN §9.2) | needs a decision → §5.2. Options: (a) `sessionKeys()`/`sessionCount()` on the Reach (U2 file, frozen interface → `docs/INTERFACE-CHANGES.md` note and a wave-1 rerun; likely crosses the valve, so the `SessionPolicy` split DESIGN §9.2 names comes with it); (b) `eth_getLogs` for `topics.sessionGranted` on `INTACT.reach` from the token's mint block — which the block does not carry (`clocks.createdAt` is a timestamp); bake `mintBlock` in `TPL_TOKEN` (U7) and accept one bounded range scan per Vault visit; (c) Vault inspects only a key the holder types/pastes, Panic lists categories without counts. C's K11–K15, K20 ("sessions: 1") and L2 assume (a) or (b). |
| `knownDelegates()` has no `sel` row and is not baked | `Catalog.sol:1426-1431` | needs a decision → §5.4 (row `knownDelegates\|Q\|knownDelegates()\|r\|d\|`, or bake `delegates:{"0x<codehash>":"name"}` into `TPL_WORLD`). The shell has keccak and *could* compute the selector, but every report's convention is "panels call only `INTACT.sel`". |
| Trait keys `keccak256("curve")`, `keccak256("name")` not baked | D §6.2.3 | needs a decision → §5.4 (compute with the shell's proven keccak — cheapest — or bake `traits`) |
| `graduationTarget` is not in `Launch` and `graduationTargetOf` has no row; the Raise card cannot print "raised X of Y" | `Launchpad.sol:156`; `ILaunchpad.sol:21-42` | needs a decision → §5.5 (add a row; U7 file) |
| Writes/reads named by DESIGN §1 with no row: Parley `evict/setCooldown/hide`; Reach `pieces()`, `guardNFT/unguardNFT`; KeyRegistry `revokeEncryptionKey`; Steward `heirHashOfToken`; Launchpad `lastLaunchAt`, `firstLaunchApproved`, `boughtInWindow`; Postage `stampOf`; hub `getApproved/isApprovedForAll/userOf` (derivable from `coreOf`/`rightsOf` except operator enumeration) | D §6.2.5–6 (confirmed by grep) | needs a decision → §5.5: add rows for the MVB screens that need them, and drop the rest from §1's MVB word list |
| Error argument shapes | §1.4 | → §5.6 |
| Reactions (ERC-7409 singleton) | D §6.2.4; DESIGN §5.5 names the degradation sentence | decision → §5.5; MVB default "reactions unavailable on this chain" everywhere (C's E12) |

### 2.2 Screens and modes nobody designed
| Gap | Evidence | Where the answer is |
|---|---|---|
| **The collection document `/`** (`document(0)`): mint control with `price` exactly, the `Transfer(0,…)` log → id → navigate to `/token/<id>/live` (DESIGN §1 "Mint" flow), `open` directory, `recent` coins, commons head. E §1.6 gives the keys (`id:0`, `price`, `minted`, `open`, `recent`, `commons`; **no** `owner/epoch/reported/absent`); B lane 6 gives the mint recipe. No report designs the screen and C has **no assertion group** for `/`. | DESIGN §5.3 row `/`; E §1.6 | design-phase work, not a decision: the shell branches on `S.id === 0`; verify-site needs a group (mint from the page, id from the receipt's `Transfer` log, directory count = `openIds`). |
| **Session mode `?as=<key>`**: Premises 301s `/k/<id>/<key>` there; DESIGN §13 puts "the `/k` door" in U11's Chromium battery, which depends on U9; D §2.6 sketches the behaviour (refuse a wallet whose account ≠ key, `rightsOf(id,key)` SESSION bit, offer only `executeAsSession`/`executeTyped`). agent.js is a stub until U17. | `Premises.sol:186-192`; D §2.6 | needs a decision → §5.13: what the MVB shell does with `?as=` (at least: parse it, show a session-mode Home with `sessionOf(key)`/`sessionExposure`, hide every holder control; or 404 it until U17 and move the U11 sentence). |
| **The QR**: new code, no donor, no spec in any report; two uses (Home link, Grip address). Payload `web3://0x<40 hex>:<chainid>/token/<id>/live` is 62–72 chars. C's B4/B5/K9 assert shape only. No decoder exists in the repo to test against. | §0 grep | needs a decision → §5.9: byte mode, fixed version (5-L holds 106 B; 4-L 78 B) or computed, ECC L, mask fixed (spec-legal) or penalty-scored; structural test (finder patterns at three corners, timing rows, format bits consistent, dark module) plus one golden vector hand-checked against an external encoder once. |
| **Read-provider identity with ≥ 2 announcers and no remembered choice**: `pv()` returns the first announcer; DESIGN §5.4 "eth_chainId compared before any read" (on which provider?); Chrome.sol's own rule "Desk chooses one before a read can determine a transaction". C's N1 asserts no prompt until a click but not which provider answered the reads. | B §3; Chrome.sol header | needs a decision → §5.8 |
| **The https gateway twin in the viewer** | DESIGN §1, §5.1 vs `build-app.mjs:248-253` host scan and verify.mjs "no host of any kind in the served document" (so baking a gateway host into Catalog fails verify.mjs too) | needs a decision → §5.14 (template with a visible placeholder in the `data:` viewer; `location.origin + path` on a real origin) |
| **Chain names for the five bands** (`requireChain`'s sentence, the wrong-chain chip) | A q2; `/services.json` `bands` carries chainIds only | decision §5.14: a names-only table in the shell (`{1:"Ethereum",10:"OP Mainnet",8453:"Base",…}`, no URLs) — not a Catalog change |
| **Panel ↔ shell helper contract**: the fixture defines `window.INTACT`, `#lane-<name>`, `lane.dataset.loaded`, `S.loaded[name]`; B proposes `INTACT.ui = {say, propose, watch, el, kv, button, field, note, enc, wei/eth/units/amt, call, gate, provider, rights}` and a `ready` promise; E proves everything shared must hang off `window.INTACT` (terser `toplevel` mangling; panels are IIFEs with zero top-level declarations). The exact surface, names and the `ready` semantics are undefined. | B §2.6; E §3.4; fixture | design-phase work; write it as `docs/CONSOLE.md`'s "panel contract" before any panel |
| **Element-id vocabulary** shared by verify-site and U11 | §1.11; C §6.1 | → §5.10 |

### 2.3 Harness and toolchain
| Gap | Evidence | Where the answer is |
|---|---|---|
| `Chain.call` commits on success; `Chain.send` returns no hash; `Chain.call` truncates revert data at 138 hex | E §2.1 (measured), C §2.2/§6.6–7, `evm.mjs:424` | decisions → §5.15: additive `hash` field and a `simulate()`/read-only call in `evm.mjs` (U0 file, additive) vs shim-local copies |
| `gas.mjs` measures routes warm; `/hash` crosses 2.5 M at ≈ 16.5 KB cold while reading 2.41 M warm at 18 KB; `tokenURI` crosses 8 M at ≈ 17.4 KB | E §4.2–4.3 | decision → §5.16: lower `SHELL_GZIP_CEILING` to 15,000 and/or a transaction between probes in `gas.mjs` (U7 file); verify-site asserts cold |
| `npm run check` omits `selftest`, `build`, `verify`, every `verify-*` | `package.json:35`; DESIGN §13 line 550 | decision → §5.17 (U9 adds `build`, `selftest`, `verify`, `verify-site` with a note; `package.json` is U0's file) |
| `engine/app.css` has no path into the build | E §3.7 | decision → §5.18 |
| `whispers.mjs` must be inlined into `social.js` at build (`vm.Script` rejects `export`; measured by B and C) | B §4.6; C §6.4 | decision → §5.18 (marker line + export-stripping in `build-app.mjs`, U7 file, additive) |
| `eth_getBlockByNumber` missing from both shim designs | §1.14 | → §5.11 |

### 2.4 Rules stated but with no owner yet (panel-level, no decision needed — assign them)
- Decrypting envelopes sealed under an earlier epoch/key: trust `envelope.context`'s epoch/version fields after checking the six fixed fields (the context is the AAD) — B q1's recommendation; adopt and write in `social.js`'s header.
- `keyOf` returning a non-P-256 `keyType` (1, 2, 5): refuse to seal with a sentence (B q2).
- `crypto.subtle` undefined on a non-localhost `http://` gateway: "sealing needs a secure origin" (B q5).
- `whisperStamped` slab wording for an escrowed, refundable stamp (B q3) and that ERC-20 postage is pulled from the sender's **Reach** (D §2.2) — the panel must say which hand pays.
- `swapExactOut` with an ERC-20 input can leave a residual allowance (D q7): offer `swapExactIn` by default; after an exact-out receipt read `allowance` and offer `approve(spender, 0)`.
- `kiln.coinAt` must be called with `by` = the sender (wallet vs Reach) (D §6.3).
- `heads()` returns head **blocks**; counts come from `stateOf(room)` word 1 (every report agrees; C's I12 guards it).
- `NET.ro` (A q4): rename to "provider present, no account requested"; `NET.dead` = no provider. Trivial.

---

## 3. DESIGN §1 screen elements with no supporting read/write in D's ABI map

"Supported" means a `sel` row (or a state-block key) exists for every read and write the element needs. Items marked **post-MVB** are expected gaps; the rest are MVB gaps.

| Screen | Element (DESIGN §1 wording) | Status | Why / what is missing |
|---|---|---|---|
| Home | holder (ENS when reported) | post-MVB | Nameplate has no letter; degrade to the address (DESIGN §5.5). |
| Home | "verified against chain at block N" | **gap** | no bytes to hash (§1.5); `engineHash` has no `sel` row for a live read either. |
| Home | `https://` gateway twin (viewer) | **gap/decision** | §5.14. |
| Home | self-drawn SVG QR | **gap (new code)** | §5.9. |
| Swap | sniper settings (post-open) | **contradiction** | no such write; §1.7. |
| Swap | directory from `/open` | partial | HTTP route only; in the `data:` viewer use `pool.openIds` (has a row). |
| Swap | Elsewhere: venue manifest, Reach-mediated swap | supported | `router.venues`, `router.quoteExactIn` (revert decode needs full revert data — shim §2.3), `reach.execute/executeBatch/executeTyped`. |
| Social | Rooms (steward tools) | **gap** | `evict`, `setCooldown`, `hide` have no rows; group names (`nameOf`) have no row — walk `topics.founded` at block `stateOf(room).opened` (single block) instead. |
| Social | Inbox receipts (sender side) | **gap** | `stampOf` has no row (`replyBy`, `refunded`); `pendingOf`, `expire`, `claimRefund` exist. |
| Social | reactions via ERC-7409 | **gap/decision** | no row, no letter; MVB sentence "reactions unavailable on this chain". |
| Social | DMs sealed, key re-read | supported, **design flaw** | §1.8 (per-token derivation vs per-address registry). |
| Launch | Raise: "buyers see the curve … `floorPerToken`" | **partial gap** | `graduationTarget` unreadable (§2.1); `maxBuyInWindow` is in `Launch` (w13) but `boughtInWindow` has no row, so "you may still buy X in the window" cannot be printed. |
| Launch | Locks | **gap** | Locks address shadowed (§1.6). |
| Launch | Coin spacing "next launch in …" | partial | `lastLaunchAt` has no row; only the `TooSoon(uint64)` error at estimate time (needs §1.4 for the argument). |
| Vault | Reach › pieces | **gap** | `pieces()`, `guardNFT`, `unguardNFT` have no rows. |
| Vault | Reach › holdings, manifest, seal, execute/executeBatch composer, open-approval ledger + revoke | supported | `holdings`, `manifest`, `seal/sealMax`, `execute*`, `openApprovals`, `revokeOpenApprovals`. |
| Vault | Grip › address, QR, warning | supported except the QR | §5.9. |
| Vault | Sessions (list, caps, exposure) | **gap** | no enumeration (§2.1); per-key views exist. |
| Vault | Steward (will, guardians, heartbeat, `wouldPass` in words) | **gap** | Steward address shadowed; `heirHashOfToken` has no row (instrument heirs); rows otherwise exist. |
| Vault | Panic "lists what it revokes" | **partial gap** | needs session count (§2.1), `firstLaunchApproved` (no row), operator enumeration (no view exists; say "every operator you ever approved"), `getApproved`/`userOf` (derivable from `coreOf`/`rightsOf`), `wouldPass` (Steward address). |
| Vault | Sell checklist before `transferFrom` | supported | D §5 names a proving read per line; the "sessions: n" and "steward plan" lines inherit the two gaps above. |
| Identity | traits (`setTrait`) | partial | trait keys not baked (§2.1). |
| Identity | status + the Active/Paused rule, guardian, agent wallet two-step, encryption key (`bindKey`), rights of any address, fingerprint diff, hash manifest | supported | rows exist; "hash manifest" in the viewer = `INTACT.panels/engineHash/catalogHash`. |
| Identity | 7702 delegate status | **gap** | `knownDelegates` not reachable (§2.1). |
| Identity | ENS binding (band 0) | post-MVB | Nameplate. |
| Agent | all | post-MVB stub | `catalog.services`, `reach.sessionOf/sessionExposure/sessionAllows/executeAsSession` rows exist for the stub's reads. |

---

## 4. BUILD-PLAN §U9 test sentences vs C's recipes

All eleven sentences have a setup recipe in C §5; none is missing outright. Several rest on open gaps and will not pass as planned until the decision lands:

| # | Sentence | C group | Recipe present | Blocked by |
|---|---|---|---|---|
| 1 | the opaque origin boots the viewer and never offers connect | B (16) | yes | B3 (https twin, §5.14); A9/M6 self-hash bytes (§1.5) |
| 2 | a tampered panel is refused | C (12) | yes | — |
| 3 | a renter sees the walk and the sentence | D (12) | yes | — |
| 4 | an absent Router hides the tab and sets the chip to not reported | E (12) | yes (incl. E8 "could not be read" via a Breakable at `opts.router`) | — |
| 5 | every approval the slab builds is exact | F (15) | yes | F3/F4/F14 need the `[data-calldata]/[data-selector]/[data-digest]` seams (§5.10) |
| 6 | a non-holder sees the custom error before the wallet opens | G (10) | yes | G5/G10 argument decoding (§1.4) |
| 7 | the swap slab states the floor in words | H (14) | yes | H5 exact deadline word (§1.14) |
| 8 | the composer appears only for HOLD or ACCOUNT | I (15) | yes | I14/I15 inherit §1.8's derivation flaw for a two-token holder |
| 9 | the raise shows the tax as a countdown | J (14) | yes | J14 (Locks address, §1.6); "raised X of Y" has no read (§2.1) |
| 10 | the vault lists open approvals and revokes in one press | K (22) | yes | K11–K15 (session enumeration), K16–K18/K20 (Steward address), K5 needs a Breakable asset |
| 11 | panic lists what it revokes | L (10) | yes | L2's counts and `firstLaunchApproved`/`wouldPass` reads (§2.1) |
| — | `selftest.mjs` vectors unchanged | — | A §4 | §1.13 |
| — | `gas.mjs` still green after the real shell lands | — | E §4 | warm measurement (§5.16) |

Groups C has that BUILD-PLAN does not name (A boot, M identity, N discovery, O escaping, P loader) are welcome. Groups **missing** from C: the collection document `/` and the mint flow; session mode `?as=`; "which provider answered the reads" with two announcers (N1 should assert it).

---

## 5. Decisions the design phase must take

Numbered; each with the recommendation the evidence supports and the file it touches.

1. **Rename the shadowed token keys** in `Catalog.sol` `TPL_TOKEN` (`market`→`ownedMarket`, `locks`→`reachLocks`, `steward`→`stewardStatus`, `roles`→`roleCount`) and update `tools/verify.mjs:188-193`; `CATALOG_HASH` moves (pre-deployment, acceptable). U7 file, additive-in-spirit; note in `docs/INTERFACE-CHANGES.md`. Without it three sentences cannot pass.
2. **Session enumeration.** Recommend (b): bake `mintBlock` into `TPL_TOKEN` and walk `topics.sessionGranted` on `INTACT.reach` from there (one bounded `eth_getLogs`; liveness then confirmed per key with `rightsOf(id,key) & SESSION`); (a) a `sessionKeys()` view is cleaner but Reach sits at 20,821 B against the 21,000 B valve and the interface is frozen; (c) typed-key-only is the fallback if neither is accepted. Panic's list then prints real counts.
3. **The self-hash footer.** Recommend the one-line `INFLATE` change (`window.INTACT.$doc=t;` before `document.open()`), an `engine.engineHash` `sel` row, and the shell comparing keccak(`$doc`) to the **live** `engineHash()`; otherwise rewrite DESIGN §5.4/§11.7/§13 and `Premises.sol:267-270` to the provable sentence. Either way C's A9/M6 name the bytes.
4. **`knownDelegates` and trait keys.** Add the `knownDelegates` row (or bake the codehash→name map into `TPL_WORLD`); let the shell compute the two trait keys with its proven keccak (no Catalog change).
5. **Rows for MVB screens:** add `launchpad.graduationTargetOf`, `launchpad.boughtInWindow`, `launchpad.lastLaunchAt`, `launchpad.firstLaunchApproved`, `postage.stampOf`, `reach.pieces` (and `guardNFT/unguardNFT` if "pieces" stays in the MVB Vault), `steward.heirHashOfToken`; decide that Parley steward tools (`evict/setCooldown/hide`), `revokeEncryptionKey` and reactions are **not** MVB panel controls and strike them from §1's MVB list (reactions keep the degradation sentence).
6. **Error argument shapes.** Recommend serving them: `_renderErrors` emits the argument list beside the name (U7 file, ~15 lines, `CATALOG_HASH` moves). Fallback: a per-panel local table for the dozen errors the slab explains.
7. **Key derivation sentence.** Drop `token` and `epoch` from the `personal_sign` sentence (one key per wallet, `"INTACT seal v1 · chain <c> · hub <hub>"`); keep epoch death in `Parley.Binding`. Fix DESIGN §7.3 and B §4.7 step 1. Alternative: declare "one sealed token per wallet" and print it.
8. **Read-provider identity.** In console mode with ≥ 2 announcers and no remembered rdns, show the picker **before the first `eth_call`** (the picker is page UI, not a wallet prompt, so F5/U11 hold) and do every read and send on the chosen provider; in viewer mode read via `pv()` and never choose. Chain check on the provider that will be used, always first.
9. **QR spec.** Byte mode, fixed version 5, ECC L, one fixed mask (penalty scoring is optional in the spec); ≤ 3 KB source; structural assertions in verify-site plus one golden-vector module map checked once against an external encoder and pinned in `docs/INVARIANTS.md`.
10. **Slab/element vocabulary.** Adopt B's donor words (`#cbox.on`, `#cslab`, `[data-go]`, `[data-no]`), add C's seams (`[data-calldata]`, `[data-selector]`, `[data-digest]`, `[data-engine]`, `[data-gas]`), keep the fixture's `#lane-<name>`, `#verified`, `lane.dataset.loaded`, `body.dataset.{mode,rights}`; write the list in `docs/CONSOLE.md` before the shell, so U11 shares it.
11. **The clock.** Deadlines and countdown anchors from `eth_getBlockByNumber("latest")` when a provider exists (add to the shim), `INTACT.time` at first paint, `Date.now()` only to animate; the shim pins `Date.now` as C proposes but the assertion reads the block.
12. **selftest.** "Unchanged" = the 50 chain vectors; delete the five section-word checks; add the 6551 hard vector and its `.t.sol` twin; repoint `SRC` to `engine/app.html`, `TO` to an explicit end marker; record in INVARIANTS.md.
13. **Session mode in the MVB shell.** Recommend: parse `?as=<key>`, render a session-mode Home (`sessionOf`, `sessionExposure`, the SESSION bit, every holder control hidden, "this page acts as a key for #id"), no `executeAsSession` composer until U17; U11's "/k door" sentence tests that much.
14. **Hosts and names in the shell.** No URL of any kind; the viewer prints the `web3://` link, the QR and a **template** twin (`https://<gateway>/<premises>:<chain>/token/<id>/live` with the placeholder visible); on a real origin the twin is `location.origin + path`; a names-only chain table for the five bands; verify-site asserts "no `rpc` key, no `fetch(` outside the panel loader and `/hash`", not "no `https://`".
15. **Harness additions** (U0's `evm.mjs`, additive): `send()` returns `hash`; a `simulate()`/read-only call under `journal.checkpoint()/revert()` that returns full revert data; otherwise the shim carries both. Decide so U11 and U13 do not re-implement them.
16. **Size and gas gates.** Lower `SHELL_GZIP_CEILING` to 15,000 (U7 file, with a note) so the build fails before `gas.mjs` does; `gas.mjs` inserts a one-wei transaction between route probes so `/hash` is measured cold; verify-site prints the gzip size beside both numbers. Shell budget: ≤ 14,000 B gzip.
17. **`npm run check`.** U9 adds `selftest`, `build`, `verify`, `verify-site` after `facets` (DESIGN §13 order), noting the `package.json` ownership in the commit body.
18. **CSS and the module.** `engine/app.css` inlined at a single `<link rel="stylesheet" href="app.css">` marker by `build-app.mjs` before the checks (E §3.7 option A); `engine/whispers.mjs` inlined into `social.js` at a `/*@inline engine/whispers.mjs*/` marker with `export` stripped (B §4.6). Both are additive edits to U7's `build-app.mjs`; fail hard on a missing file or marker.

---

## 6. What the reports got right that the implementer should not re-derive

So the design phase does not re-open settled ground: the verbatim unit is 1858–2394 of the tree (A); the 6551 formula is `AccountBinding.predict` with only the salts and `S.hub` changed, and `0x6aFB0ef9…5dac1a` is the vector for the stub (A); `stepThenPropose` already approves exactly (B); the `Said` layout, `speak`/`whisper`/`whisperStamped` offsets, `stateOf` 17 words, `keyOf` live through the registry (B, D); the shim mechanics — Blob scripts via `resolveObjectURL`, a throwing `localStorage` getter, `window` as an `EventTarget`, one `vm` context per page, `document.open/write/close` emulation (C, all measured); the state-block schema with the quoted-vs-bare number rule, the `reported`/`absent` three-way chip rule, `Chain.call` committing, warm-vs-cold gas and the 262 gas/gzip-byte slope (E, all measured). Build on those; spend the design phase on §5.
