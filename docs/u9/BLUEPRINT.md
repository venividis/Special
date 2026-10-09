<!-- Working document from the U9 design phase (2026-10-08), kept so the panel work can resume. §1 (prep), §2 (the shell), §6 (verify-site) and the boot blocks of §7 are built; §4, §5 and the five panel groups of §7, §8 (integration) are not. docs/CONSOLE.md is the contract and wins wherever the two disagree; the byte budget in §3 is superseded by the measured 14,976 B recorded in docs/INVARIANTS.md F2. -->

# H — the U9 blueprint (what each implementation agent builds, in order)

Read DECISIONS.md first; this file turns those decisions and the reader
reports into a build order. Where this file and G disagree, G wins. The
public contract (names, sentences, rules) is `docs/CONSOLE.md` in the
worktree; this file is the private side — layout, budgets, recipes, the
assertion list, who owns what.

Worktree `/home/user/wt/U9`, branch `unit/U9`. Nothing under
`/home/user/Special` or `/home/user/wt/U10`.

---

## 0. Build order and ownership

Six kinds of agent; the first must land before the rest start, the last
after everything else.

| Agent | Owns (creates or edits) | Must not touch |
|---|---|---|
| **prep** — *landed, commit `69c81b2`; see prep-report.md* | `src/Catalog.sol` (D1 renames, D3/D4/D5 rows, D6 `_renderErrors`); `src/Renderer.sol` (D3 one line); `tools/verify.mjs` (D1, D6 assertions); `tools/fixtures/app-placeholder.html` (`S.market` → `S.ownedMarket`); `tools/evm.mjs` (D15, additive); `tools/build-app.mjs` (D16 ceiling, D18 CSS + whispers inlining); `tools/gas.mjs` (D16 cold probes); `tools/selftest.mjs` (D12); `test/Binding.t.sol` (D12 vectors); `docs/INTERFACE-CHANGES.md` (new "U9" heading); `DESIGN.md` §7.3 sentence (D7); `docs/INVARIANTS.md` F2/F3/F6 (additive). **Not done by prep and re-assigned below:** `package.json` (D17) and the `jsqr` install (D9) → integration | `engine/`, `tools/verify-site*` |
| **shell + shim** | `engine/app.html`, `engine/app.css`, `engine/panels/agent.js` (stub), `tools/dom-shim.mjs`, `tools/verify-site.mjs` (runner), `tools/verify-site/boot.mjs`; three **additive** edits to `tools/build-app.mjs` (U7's file — say so in the commit body): (i) strip the one permitted literal `http://www.w3.org/2000/svg` before the host scan, with a comment naming it the sole exception (CONSOLE §13); (ii) parse each panel with terser's `parse` and refuse unless every `AST_Toplevel.body` node is an `AST_SimpleStatement` (*"panel <name> declares at top level"*); (iii) `compress: { passes: 2, drop_debugger: true, toplevel: true }` in `shrinkShell` only (§3 cut rule 6). The shell agent's **first** commit (`INTACT.ui` + chooser + boot, before Home/QR) prints the shell's gzip size in its body | any other panel |
| **swap** | `engine/panels/swap.js`, `tools/verify-site/swap.mjs` | the shell |
| **social** | `engine/panels/social.js`, `tools/verify-site/social.mjs` | |
| **launch** | `engine/panels/launch.js`, `tools/verify-site/launch.mjs` | |
| **vault** | `engine/panels/vault.js`, `tools/verify-site/vault.mjs` | |
| **identity** | `engine/panels/identity.js`, `tools/verify-site/identity.mjs` | |
| **integration** | `package.json` (D17 `check` order; `jsqr` devDependency — U0's file, say so), the single `npm install --save-dev jsqr` (the worktree's `node_modules` is a symlink into the shared tree, so one install lands everywhere; `boot.mjs` imports it lazily with the RS-recompute fallback when absent), `docs/INVARIANTS.md` (F3–F6 rows → live, assertion strings quoted exactly; F3 records that D19's "byte-identical" became "equal to the recorded keccak of the reordered chain half", §2.1), `docs/CONSOLE.md` §6.2 (copy each panel's id list from its group file header), README numbers (measured), the final `node tools/verify-site.mjs`, `npm run build`, `npm run gas`, `npm run verify`, `node tools/forge.mjs --match Premises`, `node tools/forge.mjs --match Binding`, the commit | source files owned above, except to fix a measured disagreement and say so |

`docs/CONSOLE.md` is committed on `unit/U9` **before** the panel agents start,
so the contract they read is the one on the branch. Panel agents do not
edit `docs/CONSOLE.md` or `docs/INVARIANTS.md`; a panel lists its element
ids in the header comment of its group file.

A panel agent needs `INTACT.ui` to exist to test against; until the shell
lands, a panel agent develops its group against the **contract in
CONSOLE.md §5** and runs it once the shell is merged. The shell agent
therefore lands `INTACT.ui` first and the Home/QR/footer after, in two
commits, so panel agents are unblocked early.

---

## 1. The prep changes (the files D names), exactly

**Status: landed** (`unit/U9` commit `69c81b2`; `prep-report.md` is the
record). The items below are kept as the specification they were written
against; where the landed text differs, the landed text wins and is noted
inline: the `knownDelegates` row's note reads `keccak of the 23-byte 0xef0100
designation per known 7702 delegate` (a Solidity string literal must be
ASCII and `|` is the row separator); `Chain.simulate` returns `{ ok, data,
gas, error }`; the selftest's `__X` list is the 23 names in §2.1 (no
`derive6551`, no `agrees`) and it pins both the Reach vector
`0x6aFB0ef97eB85b6742326c7372421a166C5dac1a` and the Grip vector
`0xc4392998811A83E714e2E443D5C1f3EC72C55E0A`; `tools/verify.mjs` is at 234
assertions, the SERVICES table at 159 rows, `CATALOG_HASH` at
`0x85a5340fa3b64fdab7d6b547a1d3c548058583fb90a513f44fc4ac20706e313e`;
items 8 and 11 were **not** done and belong to the integration agent (§0).

1. **`src/Catalog.sol` `CatalogState.TPL_TOKEN`**: rename the four token-level
   keys — `"market":` → `"ownedMarket":`, `"locks":` → `"reachLocks":`,
   `"steward":` → `"stewardStatus":`, `"roles":` → `"roleCount":`. The world
   keys keep their names (they are the addresses). `tools/verify.mjs`
   ≈ 188–193: `S.market.open` → `S.ownedMarket.open`, `S.locks === 0` →
   `S.reachLocks === 0`, `S.steward === 0` → `S.stewardStatus === 0`, and
   any assertion that reads `S.market`/`S.roles` as a token value.
   `tools/fixtures/app-placeholder.html`: `S.market` → `S.ownedMarket` (one
   line). `CATALOG_HASH` moves; nothing is deployed.
2. **`CatalogRows.SERVICES`** — add rows (format `name|letter|sig|kind|via|note;`,
   letters from `LETTERS`: `G` engine, `Q` catalog, `L` launchpad, `S`
   postage, `R` reach, `W` steward). Every signature below was read from
   the interfaces in this worktree:
   ```
   engineHash|G|engineHash()|r|d|keccak of the inflated shell;
   knownDelegates|Q|knownDelegates()|r|d|codehash of 0xef0100‖delegate for the 7702 check;
   graduationTargetOf|L|graduationTargetOf(uint256)|r|d|raised X of Y;
   boughtInWindow|L|boughtInWindow(uint256,address)|r|d|what this buyer may still buy in the fair window;
   lastLaunchAt|L|lastLaunchAt(uint256)|r|d|next launch in …;
   firstLaunchApproved|L|firstLaunchApproved(uint256)|r|d|live only under the current epoch;
   stampOf|S|stampOf(uint256)|r|d|the sender's receipt: replyBy, settled, refunded;
   pieces|R|pieces()|r|d|guarded NFTs, read only;
   heirHashOfToken|W|heirHashOfToken(uint256,bytes32)|r|d|instrument heir: whoever holds token N;
   ```
   The drift gate in `tools/verify.mjs` (*"every one of the N service rows
   names a function its contract's ABI serves"*) fails the build on a row
   the ABI does not serve, so a wrong name is caught at `npm run verify`;
   update that assertion's count (150 → 159). `engine.engineHash` is also
   what the shell reads for the footer.
3. **`CatalogText._renderErrors`** (D6): emit the whole signature —
   `"0x…":"Slippage(uint256,uint256)"`, not cut at `(`. `tools/verify.mjs`:
   `S.err[selOf("NotHolder()")] === "NotHolder"` → `"NotHolder()"`; *"every
   err entry names the error whose selector it is"* compares
   `selOf(value) === key` (the value is now the signature, so the check gets
   stronger: the selector must equal the keccak of the value itself).
4. **`src/Renderer.sol` `INFLATE`** (D3): insert `window.INTACT.$doc=t;`
   immediately before `document.open();`. Re-run `node tools/build-app.mjs`
   (`checkLoader()`), `node tools/verify.mjs` (*"declares nothing at all in
   global scope"*), `node tools/forge.mjs --match Premises`.
5. **`tools/evm.mjs`** (D15, additive, U0's file — say so in the commit
   body): `Chain.send()` adds `hash: bytesToHex(tx.hash())` to its return;
   new `Chain.simulate(to, data, { from, value })` → `{ ok, data, gas }`
   running `vm.evm.runCall` under `journal.checkpoint()/revert()` with the
   **full** `returnValue` (not the 138-char cut `call` applies). `call`,
   `read`, `exec` unchanged.
6. **`tools/build-app.mjs`** (D16, D18): `SHELL_GZIP_CEILING` 18,000 →
   15,000 with a header note citing E: tokenURI ≈ 3.44 M + 262 gas per gzip
   byte, over 8 M at ≈ 17.4 KB, `/hash` over 2.5 M cold at ≈ 16.5 KB. CSS:
   exactly one `<link rel="stylesheet" href="app.css">` in `engine/app.html`
   is replaced by `<style>` + `engine/app.css` + `</style>` **before**
   `refuse()`, the minifier and the host scan; hard error on a missing
   marker with the file present, a missing file with the marker present, or
   two markers; fixtures (no marker) keep working. Whispers:
   `engine/panels/social.js` carries the line `/*@inline engine/whispers.mjs*/`,
   replaced by the module text with every `^export ` stripped
   (`/^export (async function|function|const) /gm` → `$1 `); hard error on a
   missing marker in `social.js` or if the stripped text fails `new
   vm.Script`. Record `plan.css` and `cssBytes` in `dist/shards.json`.
7. **`tools/gas.mjs`** (D16): a one-wei `chain.send({ to: "0x" + "77".repeat(20),
   value: 1n })` between route probes so each is measured cold; header note
   records the warm/cold difference ≈ 0.19 M.
8. **`package.json`** (D17, U0's file — say so) — **not done by prep; the integration agent's**: `"check": "npm run compile
   && npm run facets && npm run selftest && npm run build && npm run
   forge:monolith && npm run forge:diamond && npm run gas && npm run
   gas:selftest && npm run verify && npm run verify:site && npm run
   static-audit"`. `verify:site` already exists; keep it.
9. **`tools/selftest.mjs`** (D12): `SRC` → `engine/app.html`; `FROM`
   unchanged (`/*── keccak-256`); `TO = "/*── end of the chain half ──*/"`
   and `slice = SRC.slice(a, b)` (drop the `lastIndexOf("/*", b)` dance);
   prelude: drop `TAU`, the `grab(...)` line and `clamp`; the `S` stub
   becomes `{ id: 7, hub: "0x1234567890AbcdEF1234567890aBcdef12345678",
   chainId: 1, reachImpl: "0x0000000000000000000000000000000000000000",
   gripImpl: "0x0000000000000000000000000000000000000000" }`; keep the
   `$ $$ say shock refresh paintRail window fetch` stubs; `__X` drops
   `packSection`, `unpackSection`, adds `grip6551` — the landed list is the
   23 names of §2.1 (no `derive6551`, no `agrees`).
   Delete the five section-word assertions (55 → 50); add
   `eq("the Reach of token 7 on chain 1 with a zero implementation",
   X.account6551(), "0x6aFB0ef97eB85b6742326c7372421a166C5dac1a")`. **Before
   pinning**, confirm the vector a third way: a `.t.sol` line
   `assertEq(AccountBinding.predict(address(0), AccountBinding.REACH_SALT,
   1, 0x1234567890AbcdEF1234567890aBcdef12345678, 7),
   0x6aFB0ef97eB85b6742326c7372421a166C5dac1a)` in `test/Binding.t.sol`
   named `test_theShellsSixFiveFiveOneDerivationIsTheContracts` (read
   `AccountBinding.predict`'s real signature first; if the registry address
   is a parameter, pass `AccountBinding.REGISTRY`). If the Solidity
   disagrees, the Solidity is right and the vector in selftest changes.
10. **Docs**: `docs/INTERFACE-CHANGES.md` gains a "## U9" heading listing
    the four renamed keys, the nine rows, the `err` value shape, the
    `$doc` property, and `Chain.send().hash`/`simulate`; `DESIGN.md` §7.3's
    sentence becomes `"INTACT seal v1 · chain <c> · hub <hub>"` with the
    reason in the commit body (the registry is address-keyed; a per-token
    sentence erases a two-token holder's first binding); INVARIANTS F3 gets
    two placeholders the integration agent fills: the selftest slice keccak
    and the 6551 vector.
11. **`jsqr`** — **not done by prep; the integration agent's** (`node_modules/jsqr`
    does not exist; `npm view jsqr` answers 1.4.0): run `npm install --save-dev
    jsqr` once. `boot.mjs` imports it lazily (`await import("jsqr")` in a
    try/catch); when it is present Q8 decodes a rasterised module map at ≥ 4 px
    per module; when absent `boot.mjs` recomputes the RS codewords
    independently (its own 60-line GF(256) encoder, from the same tables) and
    pins the module map's keccak.

---

## 2. `engine/app.html` — the module layout, in order

The shell is one HTML document. Two `<script>` blocks, both bare
(`<script>`, no attributes — the minifier only touches bare blocks). Block
1 is **the chain half of the wallet library and nothing else** — pure
functions over bytes (keccak, hex/utf8, EIP-55, ABI, units, EIP-712,
ERC-6551) that touch no DOM, no provider and no `location` — and is the
selftest's unit; block 2 is the shell proper, including the transport half
(`NET`, the provider gate, `requireChain`, the slab's `propose`/`fire`/
`watch`), rewritten there because that code needs `$`, `say`, `el` and the
chooser, which live in block 2 (the donor's transport half reached `$`,
`say`, `esc`, `shock`, `refresh` by bare name; after per-block mangling
those would be free globals and the first slab a `ReferenceError`). Block 2
reaches block 1 only through `window.INTACT`, never by name (terser mangles
each block's top level separately — E §3.4); so **block 1 ends by
publishing the 23 selftest names plus `agrees` onto a one-shot
`window.INTACT.$lib`** in **one statement placed after the end marker**
(outside the selftest slice), and **block 2's first statement is `const L =
S.$lib; delete S.$lib;`** — before `ready` resolves, before any panel is
injected. `INTACT.lib` never exists; a panel reaches the pure helpers only
through the `INTACT.ui` members CONSOLE §5 lists (`khex`, `kbytes`,
`checksum`, `enc`, `fmt`…). No provider, no `rpc`, no `fire` is reachable
from a Blob script; the suite asserts `!("$lib" in ctx.INTACT)` and
`ctx.INTACT.lib === undefined` after boot (G′3).

```
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="…the PROLOGUE's CSP, verbatim…">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>INTACT</title>
  <link rel="stylesheet" href="app.css">          ← the one D18 marker; the build inlines it
</head>
<body data-mode="" data-rights="" data-chain="">
  <header id="crest">                             fixed top bar
    <div class="cell" id="c-id"><span class="k">intact</span><span class="v" data-fact="id"></span></div>
    <div class="cell" id="c-chain"><span class="k">chain</span><span class="v" data-fact="chain"></span></div>
    <div class="cell" id="c-wallet"><span class="led"></span><span class="v" id="c-wallet-v">read only</span>
         <button class="b g" id="connect" type="button" hidden>connect</button>
         <button class="b" id="switch" type="button" hidden>switch chain</button></div>
                                                  ← both are removed from the tree at boot in viewer mode (never merely hidden): B6/B14 assert null-or-hidden
  </header>
  <div id="body">
    <aside id="col">                              the state column (Home)
      <section id="lane-home" class="on">
        <div id="still"></div>                    the crest SVG slot (an <img src="data:…"> is NOT available in viewer; Home draws nothing here in the MVB — reserved)
        <h1 id="ident"></h1>                      "INTACT #<id>" / "INTACT"
        <p id="stand" class="s"></p>              the standing line: status · epoch · sealed until
        <p id="rights-sentence" class="blurb"></p>
        <dl id="facts"></dl>                      [data-fact=<key>] rows, built by the shell
        <div id="chips"></div>                    .chip[data-bit][data-state]
        <div id="viewer" hidden>                  viewer-mode block
          <p class="blurb" id="viewer-note"></p>  "nothing here can sign; open the console at …"
          <p><a id="link-web3" class="v"></a></p>
          <p><span id="link-https" class="v"></span></p>
          <div id="qr"></div>
        </div>
        <div id="session" hidden></div>           session-mode block (D13)
        <div id="collection" hidden>              id === 0 block
          <div id="mint"></div>
          <div id="directory"></div>
          <div id="recent"></div>
          <div id="commons"></div>
        </div>
      </section>
    </aside>
    <main id="lane">
      <nav id="lanes"></nav>                      a[data-lane=<name>] built from Object.keys(INTACT.panels), agent omitted while agentCard is codeless
      <section id="lane-swap"></section>
      <section id="lane-social"></section>
      <section id="lane-launch"></section>
      <section id="lane-vault"></section>
      <section id="lane-identity"></section>
      <section id="lane-agent"></section>
    </main>
  </div>
  <p id="tick"></p>
  <p id="verified" class="s"></p>
  <div id="cbox"><div id="cslab" class="slab"></div></div>
  <div id="picker" hidden></div>
  <script>
    /*═══ 1 · THE CHAIN — the wallet library's chain half, from IPSEITY ═══*/
    const S = window.INTACT || {};                                                  ← the only top-level name the slice may reference besides its own
    /*── keccak-256 (the Ethereum variant: 0x01 padding, not SHA-3's 0x06) ──*/   ← selftest FROM
    …donor 1866–2040 (keccak, hex/utf8, EIP-55, ABI, units), then the three constants, then donor 2322–2394 (EIP-712, 6551)…
    function agrees(derived, reported){ … }
    /*── end of the chain half ──*/                                                 ← selftest TO (tools/selftest.mjs exports both strings)
    window.INTACT.$lib = { keccak256, khex, kbytes, selector, checksum, encodeCall, encodeParams, utf8, toHex, fromHex,
      decUint, decAddr, decString, decStringLoose, fmtUnits, toUnits, account6551, grip6551,
      digest712, domainSeparator, hashStruct, typeHash, isAddr, agrees };            ← the one publish statement; block 2 deletes it
  </script>
  <script>
    /*═══ 2 · THE SHELL ═══*/
    (() => { … everything in one IIFE … })();
  </script>
</body>
</html>
```

Both scripts sit at the end of `<body>` so the elements exist when they
run (the shim's `close()` runs scripts in document order after mounting;
a browser runs them where they are; both agree only with scripts at the
end).

### 2.1 Block 1 — the chain half (reordered from the donor, with the D19 edits only)

Source of truth: `/home/user/Most-Advanced-NFT-Possible/engine/ipseity.html`
**working tree** lines **1858–2394** (24,407 B). Block 1 takes from that
range only the **chain half**: donor 1866–2040 (keccak, hex/utf8, EIP-55,
ABI encode/decode, units), then the three constants `REG_6551`,
`REACH_IMPL`, `GRIP_IMPL` (donor 2203, 2209, 2210, moved up), then donor
2322–2394 (EIP-712, ERC-6551, `agrees`). The donor's transport/UI half
(donor 2042–2320: `CHAINS`, `NET`, `WALLETS`/`discover`, `rpc`/`ethCall`/
`readSig`, `connect`, `requireChain`, `splitWords`, `propose`/`fire`/`watch`,
`gwei`, `esc`) is **not** in block 1 — its rewritten form is block 2's
(§2.2 steps 3, 4 and 6a). Moving code changes no byte inside the kept
functions, and A's dependency table shows EIP-712 and 6551 use only `pad`,
`khex`, `kbytes`, `checksum`, `S.*` and the three constants.

Inside the selftest slice (`/*── keccak-256` … `/*── end of the chain half ──*/`),
only these edits:
- `const REACH_SALT = pad("0");` → `const REACH_SALT = khex("intact.reach.v1").slice(2);`
- `const GRIP_SALT = khex("IPSEITY.GRIP.v1").slice(2);` → `khex("intact.grip.v1").slice(2);`
- `pad(String(S.collection).slice(2).toLowerCase())` → `pad(String(S.hub).slice(2).toLowerCase())`
- the comment block above the salts (donor 2204–2208) is rewritten for the
  two INTACT salts.

**What "verbatim" means from here on (supersedes D19's wording).** D19 said
the slice is "byte-identical except the two salt lines and `S.collection →
S.hub`"; moving EIP-712/6551 and the three constants into the slice makes
that untrue by construction. The measured sentence is: *the slice between
the two markers has the keccak recorded in INVARIANTS F3*, computed by
`tools/selftest.mjs` on the first landing (it prints the slice's byte count
and keccak) and recorded by the integration agent with the donor line
ranges that moved. The integration agent states the change of wording in
INVARIANTS F3 and in the commit body.

**The slice's contract with `tools/selftest.mjs`** (landed; read it before
writing block 1):
- `FROM = "/*── keccak-256"`, `TO = "/*── end of the chain half ──*/"`, both
  exported; the slice is `SRC.slice(indexOf(FROM), indexOf(TO))`.
- The slice must define at top level exactly these **23 names**, which the
  selftest pulls into `__X`: `keccak256, khex, kbytes, selector, checksum,
  encodeCall, encodeParams, utf8, toHex, fromHex, decUint, decAddr,
  decString, decStringLoose, fmtUnits, toUnits, account6551, grip6551,
  digest712, domainSeparator, hashStruct, typeHash, isAddr` — plus
  `agrees`, which the end marker follows.
- The prelude stubs only `S` (with `id, hub, chainId, reachImpl, gripImpl,
  owner`), `$`, `$$`, `say`, `shock`, `refresh`, `paintRail`, `window`,
  `fetch`; **the slice may reference nothing else** — no `document`, no
  `location`, no `NET`, no `CHAINS`, no `fetch` in practice (the stub
  throws). `S` is `const S = window.INTACT || {};` at the top of block 1,
  before the FROM marker (the selftest supplies its own).
- The selftest pins `account6551()` → `0x6aFB0ef97eB85b6742326c7372421a166C5dac1a`
  and `grip6551()` → `0xc4392998811A83E714e2E443D5C1f3EC72C55E0A` for the
  stub `{ id: 7, hub: 0x1234567890AbcdEF1234567890aBcdef12345678, chainId: 1,
  reachImpl: 0x0, gripImpl: 0x0 }`; `test/Binding.t.sol` pins the same two.

After the end marker, one statement: `window.INTACT.$lib = { …the 23 names…,
agrees };`. Nothing else at block 1's top level (the `S` alias excepted).
Terser with `compress.toplevel` (§3 rule 6) drops any of the 23 that block
2 never reads; the publish statement is the only reference that keeps them.

### 2.2 Block 2 — the shell proper, one IIFE, in this order

1. **Aliases**: `const S = window.INTACT, L = S.$lib; delete S.$lib;` — the
   first two statements of the IIFE, before anything async; then `$ = s =>
   document.querySelector(s)`, the names-only chain table, `BASE =
   location.pathname.slice(0, Math.max(0, location.pathname.indexOf("/token/")))`
   (CONSOLE §10; `""` on `/` and in the viewer).
2. **Mode detection**: the `localStorage` try/catch → `opaque`; `as = new
   URLSearchParams(location.search).get("as")`; `mode = opaque ? "viewer" :
   (L.isAddr(as) ? "session" : "console")`; `document.body.dataset.mode =
   mode`; in viewer mode `#connect` and `#switch` are **removed** from the
   tree.
3. **The chooser** (Chrome.sol `WALLET_JS`, transcribed in B §3): `P` map by
   rdns, `pick/pv/nm/ask/choose/keep/drop`, storage key `intact.wallet`,
   every storage access in try/catch, `ask()` building `#picker` with
   `button[data-rdns]`. Per D8: `choose()` in console mode with `P.size > 1`
   and nothing remembered shows the picker **before the first eth_call** —
   so boot calls `await choose()` (console) or uses `pv()` (viewer) to
   obtain the read provider. **The instant** (CONSOLE §2): `choose()` awaits
   `Promise.all([loaded, nap(150)])` where `loaded` resolves on the `load`
   event (or at once when `document.readyState === "complete"`) before
   deciding silently; it records `silent = true` when it picked the sole
   announcer; `#connect`'s handler checks `P.size > 1 && silent && nothing
   remembered` and opens `#picker` first, sending `eth_requestAccounts` to
   the picked wallet only. `pv()`'s fallback order: picked → first announcer
   → `window.ethereum` (wrapped) → `null`. The discovery map lives here
   only (block 1 has no `WALLETS`).
4. **The chain check, and the gate it leaves behind**: `eth_chainId` on that
   provider → `body.dataset.chain`; `#switch` wiring (`wallet_switchEthereumChain`
   only; the button exists only when `mode !== "viewer"`, the viewer's crest
   prints the sentence with no control); `intact:chain` with `{ ok, chainId,
   name }`. **One function `rpc(method, params)` is the only path to the
   provider for the whole shell and every `INTACT.ui` primitive**, and it
   throws the §4.1 chain sentence unless `body.dataset.chain === "ok"`, with
   `eth_chainId` the single exception (`#switch` calls the provider's
   `request` directly, once, from its handler). So the gate holds after
   `chainChanged` too: a loaded panel repaints on `intact:rights`, its reads
   throw, the lane prints the sentence (N12).
5. **Accounts and rights**: `eth_accounts` quietly → `account`; `#connect`
   (console only) → `eth_requestAccounts`; `eth_getCode(account)` → the
   delegate check against `catalog.knownDelegates()` (decode `(bytes32[],
   string[])`) into `delegate = { code, name, known, acked } | null`;
   `rightsOf(id, account)` → `bits` (`null` when the read rejected:
   `body.dataset.rights = ""`, ticker *"your rights could not be read at
   block <n>"*), `#rights-sentence`, `intact:rights`; in session mode `bits
   &= 128` before anything reads it. `refresh()` = chain check + rights +
   epoch, bound to `accountsChanged`/`chainChanged` and called by `watch()`
   (a closure, not an `INTACT.ui` member). In session mode the actor for
   `rightsOf` is the key, and a connected account ≠ key is refused.
6. **`INTACT.ui`** — the surface of CONSOLE §5, built here; every member is
   the one the table names, with the signatures there (`act(parent, name,
   label, needBits, fn, opts)`, `rows` throwing the two sentences, `read`'s
   `s(i)/bytes(i)/arr(i)/tuple(i, types)`, `request`'s allowlist and the
   refusal *"a panel cannot send; propose it"*, `sealSignature()`,
   `simulate → { ok, data, sentence }`, `delegate()`/`ackDelegate()`,
   `qr`, `clock` that rejects, `epoch() → BigInt | null`, `field() → the
   <input>`). `ready` resolves at the end of step 5 in every mode (or
   immediately with no provider) and never rejects.
6a. **The transport half — the slab, in block 2** (rewritten from donor
   2225–2320 per A §3, here because it needs `$`, `say`, `el`): `propose(tx)`
   returns a promise resolved when the slab closes; the refusals of CONSOLE
   §4.1 in order (mode, chain, `sentence`, undeclared key, `selector(sig) !==
   data.slice(0,10)`, the clock refusal, the **approve guard on the outer
   call and on every inner call** — when the outer selector is
   `execute(address,uint256,bytes,uint8)`, `executeBatch((address,uint256,bytes)[])`
   or `executeTyped(…)`, decode the inner `data` word(s) at their offsets and
   run the `≥ 1n << 255n` check on any whose selector is `approve(address,uint256)`
   or `increaseAllowance(address,uint256)` — then `tx.need` against the live
   bits, then `opts.spend` against `delegate`); the rows by DOM, `[data-arg]`
   decoded from the calldata with a `decodeArgs(types, hex)` of ~20 lines
   covering `data()`'s type set and **omitted** when `sig` carries a tuple or
   nested array (CONSOLE §4.2); the gas row reads exactly `"would revert: " +
   errorSentence(data)`; `tx.epoch` captured at propose from the shell's last
   epoch read. `fire()`: the custodyEpoch re-read (skipped when `S.id === 0`);
   `await tx.recheck?.()` → a string refuses; `eth_sendTransaction` through
   `rpc`; the hash said plainly; `shock()` is a CSS pulse class on `#crest`.
   `watch()`: 90 × 2 s; `BigInt(r.status)`; then `refresh()`; then `then(r)`.
   `approveExactThen` with `owner?` and `via: "reach"` (CONSOLE §4, last
   paragraph). `gwei`, `esc`, `WALLETS`, `discover`, `rpcId`, the `fetch`
   fallback and `wallet_addEthereumChain` do not exist in the shell.
7. **Home**: facts (`[data-fact]` from the baked block, including `locked`
   from `S.locked`, refreshed from `coreOf`/`statusOf`/`locked` after
   receipts), the standing line, chips (three-way rule), `#rights-sentence`;
   for `S.id === 0` the collection block: `#mint` (price from a live
   `hub.price()` re-read, value exactly that; refuses to propose when the
   read failed — "the console will not guess a payable value";
   `then(receipt)` finds the log with `address === S.hub`, `topics[0] ===
   S.topics.transfer`, `topics[1]` zero, takes `id = BigInt(topics[3])`, and
   navigates to `BASE + "/token/" + id + "/live"`), `#directory` from
   `S.open` (ids as links `BASE + "/token/<id>/live"` on a real origin; text
   in the viewer), `#recent` from `S.recent` (symbols via `erc20.symbol` when
   a provider exists, else the short address), `#commons` from `S.commons`
   (count, last block).
8. **Viewer block**: the sentence, `#link-web3`, `#link-https` (template twin
   or `location.origin + location.pathname`), the QR.
9. **The QR** (D9; the algorithm, with the real numbers):
   - Version 5: 37 × 37 modules; quiet zone 4 → `viewBox="0 0 45 45"`.
   - Data: mode `0100`, count 8 bits (versions 1–9), the bytes, terminator up
     to 4 zero bits, pad to a byte, then `0xEC, 0x11` alternating up to
     **108 data codewords**; over **106 bytes** of payload → `throw new
     RangeError("payload over 106 bytes")` (the version is fixed; the caller
     prints the link alone).
   - EC level L, one block: **26 EC codewords**, total 134. GF(2^8) with
     primitive polynomial `0x11D`; exp/log tables built at load (two arrays
     of 256); generator polynomial `∏_{i=0}^{25}(x − α^i)` (degree 26),
     computed once; RS remainder by the usual shift-and-xor over the 108
     data codewords.
   - Function patterns: three 7×7 finders at (0,0), (30,0), (0,30) with
     their 1-module separators; timing patterns on row 6 and column 6 from
     index 8 to 28 alternating dark/light; one 5×5 alignment pattern
     centered at (30,30); the dark module at column 8, row 29 (= 4·5 + 9);
     format regions reserved (two copies of 15 bits around the finders); no
     version information (version < 7).
   - Placement: 134 × 8 = 1072 bits, then **7 remainder bits** (version 5),
     in the two-column zigzag starting bottom-right, upward, skipping column
     6, filling only unreserved modules.
   - Mask 0: flip a data module when `(row + col) % 2 === 0`.
   - Format information: 5 bits `01` (L) ‖ `000` (mask 0) = `01000`;
     BCH(15,5) with generator `0x537` → 15 bits; XOR mask `0x5412`; result
     **`0x77C4` = `111011111000100`**, written in both locations per the
     spec's bit order.
   - Render: `createElementNS("http://www.w3.org/2000/svg", …)` — the **one**
     literal the host scan permits; `build-app.mjs` strips exactly that
     string before scanning and B3 does the same; the literal is written
     whole, never split (CONSOLE §13); one `<rect x y width="1" height="1">`
     per dark module; `shape-rendering="crispEdges"`; `role="img"`,
     `aria-label` = the payload; width/height 100%. ≤ 3 KB source.
   - `qr(text) → SVGElement` is exposed as `INTACT.ui.qr` so the Vault reuses
     it for the Grip (`ethereum:0x<grip>@<chainId>`).
10. **The panel loader**: `show(name)` on `hashchange` and at boot; unknown
    names → Home; per lane once (`lane.dataset.loaded`); bytes from
    `fetch(BASE + "/panel/" + name + ".js")` on a real origin (the browser
    inflates; check `1f 8b` anyway and inflate if present) or from `eth_call
    engine.panel(i)` in the viewer with a provider (decode `bytes`: word 0
    offset, word 1 length; inflate with `DecompressionStream("gzip")`);
    `L.toHex(L.keccak256(bytes)) === S.panels[name].toLowerCase()` or the
    lane prints *"panel refused: its hash is not the one the chain pinned"*
    with the two hashes and injects nothing; else `lane.dataset.loaded =
    "1"`, `<script src = URL.createObjectURL(new Blob([bytes], { type:
    "text/javascript" }))>` appended to `document.body`; `intact:lane`
    dispatched. In the viewer with no provider the nav is `aria-disabled`
    and `show` does nothing but switch sections.
11. **The self-hash footer** (D3, CONSOLE §8): on `requestIdleCallback` or
    `setTimeout(0)` after first paint: `h = L.toHex(L.keccak256(L.utf8(S.$doc)))`;
    `delete S.$doc`; compare to `S.engineHash`. **Only while
    `body.dataset.chain === "ok"`**: in console mode, if `location.hostname +
    location.pathname` carries `/0x[0-9a-f]{40}/i`, compare it to
    `S.premises` — a disagreement prints the red Premises sentence and stops;
    on agreement `eth_call premises.ENGINE()` (selector computed with `L.selector`;
    no row) must equal `S.engine` or the red sentence prints; then `eth_call
    engine.engineHash()` and `eth_blockNumber`, and the green sentence names
    the engine: *"engine 0x1234…cdef pins these bytes at block <n>"*. On a
    wrong chain: *"self-consistent; wallet on <name>, not this token's
    chain"* and **no read**. No provider, or a read that failed:
    *"self-consistent; chain not reachable to verify"*. A hash mismatch
    anywhere: red *"does not match the engine hash"*.
12. **Session mode** (D13): the `#session` block; `bits & 128` masking (step
    5); hide `#connect` until the account matches; the key's
    `sessionOf`/`sessionExposure`/`SESSION` bit in words.
13. **Arrival**: `ready` resolution; `show(location.hash.slice(1))`; Escape
    closes the slab; `/` focuses nothing (no command line in the MVB — the
    nav is the seven words).

### 2.3 `engine/app.css`

From the donor `console.css` (B §5), keeping: tokens (`--a` from `--h`, set
by the shell as `(id * 137) % 360` on `documentElement.style` before first
paint — or in the viewer from `S.id` likewise), the five type classes, the
`arrive` animation on `body` (an animation, not a class), the crest, the two
columns and the phone sheet, the standing line, the verb row (`.vb` →
`#lanes a`), controls (`.b`, `.b.g`, inputs with `border-radius:0`), `.kv`,
`.chip` with the three `data-state` colours, the ticker, the slab
(`#cbox`/.slab), 4 px scrollbars, the picker (`#picker` recoloured). Dropped:
the walk, `#walk`, `--walk`, `--own`, range inputs, the command line. Rules of
the language stay as comments (the minifier strips them). Budget ≈ 8–9 KB
source → ≈ 2.2 KB gzip.

---

## 3. The byte budget (gzip, after terser; budget 14,000 B, build fails at 15,000 B)

*Superseded (the shell's fix round, 2026-10-09): the table below is the forecast the shell was
built against; the measured whole-document number, the gas slopes it was checked against and
the margin under the 15,000 B ceiling are recorded in `docs/INVARIANTS.md` F2, and the 14,000 B
"budget" line is retired as a target — the build-failing ceiling is the gate.*

A measured 5,310 B for the whole verbatim library (1858–2394 → terser
13,101 B → gzip 5,310 B) and forecast "near 6 KB gzip after U9's edits";
B's ≈ 2.5 KB for the CSS; the rest are estimates from the placeholder's
ratios (gzip ≈ 48 % of minified JS; prose-like CSS ≈ 25 %). The library
is now split between the blocks (§2.1), so its two halves are two rows.
The first version of this table summed to 13,800 with a 200 B reserve
against a measurement it disagreed with by 500 B; this one takes the
judges' numbers and says where the slack is.

| Part | Source (B) | Minified (B) | Gzip budget (B) | Note |
|---|---|---|---|---|
| prologue head + body skeleton | 2,000 | 1,600 | 500 | ids and classes only |
| `engine/app.css` | 8,500 | 6,500 | 2,200 | donor CSS minus the walk, range inputs, command line |
| block 1: the chain half + the `$lib` publish | 11,500 | 6,000 | 2,600 | keccak, hex/utf8, EIP-55, ABI, units, EIP-712, 6551 — the selftest slice; ≈ half of A's 5,310 |
| block 2: the transport half and the slab | 9,000 | 5,500 | 3,200 | `rpc` gate, `requireChain`, `propose` by DOM with `decodeArgs`, the inner-approve guard, the error decoder, `fire`, `watch`, `approveExactThen` (incl. `via: "reach"`) |
| block 2: the chooser | 3,000 | 1,700 | 750 | Chrome.sol `WALLET_JS` + the load/150 ms instant and the silent-pick rule |
| block 2: mode, chain check, accounts, rights, delegate, refresh, events | 4,500 | 2,900 | 1,300 | `rights()` null-vs-number, the session mask, `knownDelegates` decode |
| block 2: `INTACT.ui` (rows/data/read with `s bytes arr tuple`/readAs/request allowlist/sealSignature/simulate/errorSentence/act/gate/delegate/ackDelegate/furniture/enc/fmt/clock/walkLogs) | 5,000 | 3,000 | 1,300 | the furniture is the donor's `el/kv/button/field/note`; the judges called the earlier 800 optimistic |
| block 2: Home (token + collection + mint flow with receipt parsing), chips, facts, links, `BASE` | 4,500 | 3,000 | 1,300 | likewise raised from 1,100 |
| block 2: QR | 3,000 | 1,800 | 900 | D9 ceiling 3 KB source |
| block 2: panel loader + self-hash footer (chain-gated, Premises anchor) | 2,000 | 1,500 | 750 | |
| block 2: session mode | 1,000 | 700 | 300 | |
| **sum of parts** | **54,000** | **34,200** | **15,100** | |
| `compress.toplevel` in `shrinkShell` (cut rule 6, applied from the first build) | | | **−500** | measured in this container: without it an unreferenced top-level function survives; with it, dropped. The publish statement names 24 functions; block 2 reads ≈ 14 |
| gzip over one document rather than eleven parts | | | **≈ −600** | shared dictionary; not yet measured for this shell — the shell agent's first commit replaces this line with the number |
| **expected whole-document gzip** | | | **≈ 14,000 ± 500** | **15,000 fails the build**; the 14,000 budget is met by the cut list below when the measurement lands above it |

Arithmetic: 500 + 2,200 + 2,600 + 3,200 + 750 + 1,300 + 1,300 + 1,300 +
900 + 750 + 300 = 15,100; − 500 − 600 = 14,000. The reserve against the
hard ceiling is therefore ≈ 1,000 B **before** the whole-document gain and
cuts, and the budget itself has none — so the cut list is pre-authorised,
in order, until the printed number is ≤ 14,000.

`tools/verify-site.mjs` prints the shell's gzip size beside the cold
`tokenURI` and `/hash` gas on every run; the shell agent's **first** commit
body prints it too, so the integration agent is not the first to learn the
number; the integration agent writes the measured numbers into this table's
commit body and into INVARIANTS.

**The cut rule when over** (apply in this order, measuring after each;
cuts 2–5 are pre-authorised here and need no further decision):
1. Comments cost nothing (terser strips them) — do not cut prose first.
2. CSS: drop the phone-sheet slide animation and hover rules (−150), then
   the picker's icon rules (−50).
3. `read().tuple(i, types)` becomes static-tuple-only (the Launch and Vault
   panels decode their own dynamic tuples with `w()`/`bytes()`) (−150).
4. Home: the collection block's `#recent` symbols read (−100); facts
   refresh from `coreOf` after receipts becomes a `statusOf`+`custodyEpoch`
   +`locked` read only (−150).
5. Session mode: `sessionExposure` decoding in words → print the raw caps
   (−100).
6. The library: `decStringLoose`, `digest712`, `domainSeparator`,
   `hashStruct`, `typeHash` are unused by the MVB. Terser drops an
   unreferenced top-level function **only** with `compress: { toplevel:
   true }` (measured here with the build's exact options: `function
   o(){return 2}` unreferenced at top level survives the default options and
   is dropped with `compress.toplevel`), so the shell agent adds that option
   to `shrinkShell` only (§0) — block 2 and the panels are IIFEs and lose
   nothing; `selftest` reads source and is unaffected — and the `$lib`
   publish statement is the only reference that keeps a block-1 function
   alive. Publishing fewer names is then real and worth 400–800 B; the
   source text stays (the selftest reads the source, not the build).
7. **Never cut**: the QR (D9), the three-way chips, the slab rows, the epoch
   re-read, the inner-approve guard, the chain gate on `rpc`, the self-hash
   footer. `simulate` and `walkLogs` cannot move into panels (a panel holds
   no provider — CONSOLE §4), so the earlier cut that moved them is struck.

---

## 4. The panel skeleton every panel follows

```js
/*  INTACT panel "<name>" — <one line>. Injected as a Blob script after the
    shell keccak'd these bytes against window.INTACT.panels.<name>. One IIFE,
    nothing at top level (terser mangles the shell's top level to one-letter
    names; a top-level const here would collide — E §3.4). Every text node
    through textContent. Every write through INTACT.ui.propose. */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("<name>");
    ui.rows({ /* "<word>.<name>": "<signature>" … only what this panel calls */ });
    function paint() { host.replaceChildren(); /* screens */ }
    paint();
    window.addEventListener("intact:rights", paint);
    window.addEventListener("intact:epoch", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail.name === "<name>") paint(); });
    S.loaded = S.loaded || {}; S.loaded["<name>"] = true;
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
```

Rules every panel obeys (the suite asserts them where it can):
`BigInt` for every amount and every `eth_call` word; `ui.parse` for typed
amounts (a non-number disables the button — never `NaN` in the DOM); the
three-way chip rule for every satellite read; `ui.act(parent, name, label,
needBits, fn, opts)` for every write control (so viewer/session/rights
gating is the shell's; `name` is the `data-act` value; `needBits === 0`
renders for any connected account in console mode); the `sentence` on
every `propose` stating the irreversible part in words; `ui.clock()` for
every deadline, and when it rejects the control is disabled with the
clock sentence (never `Date.now()`); the `recheck` hook where a chain fact
must be fresh at the press; nothing stored; no `fetch`; no
`window.ethereum`; no `ui.request` of any method outside CONSOLE §5's
allowlist (the shell refuses it anyway); no selector literal (`ui.rows` is
the only source, verified against `INTACT.sel`); tuples and nested arrays
laid with `ui.enc.*` and proposed as `{ to, data, sig, lines }` with every
argument in `lines` (CONSOLE §4.2 — no `[data-arg]` rows for those).
**Every selector in a group file is scoped to the lane** (`#lane-<name> …`).
`social.js` may not declare any of whispers.mjs's names (CONSOLE §5 lists
them) — alias `ui.enc` as `E`.

---

## 5. Per-panel screens, rows and ids

Rows are `INTACT.sel` keys with the signatures D confirmed (Appendix A of
E). "needs" is the rights bit for the write control (`ui.act`).

### 5.1 swap — `engine/panels/swap.js` (owner: swap agent)

Screens: *Your market* (`#swap-your-market`): closed → the open form
(`#swap-open-form`: base, quote, feeBps ≤ 500, curveBps ≤ 80000, sniperBps
≤ 9000, sniperSeconds ≤ 5880 — the only place the sniper fee is set, D19);
open → deposit/withdraw (exact approval step for each ERC-20 leg; the
native leg is `value` exactly), fee (`setFee`), curve (`syncCurve(id,
S.curve, S.ownedMarket.curveBps)`), seal (`sealMarket`, ratchet sentence
"only ever lengthens, survives sale"), write-down, close (both reserves
zero); hidden under a live seal (`S.ownedMarket.sealUntil > clock`), the
sniper fee a fact with a countdown (`#swap-sniper`). *Swap card*
(`#swap-in`, `#swap-out[data-raw]`, `#swap-flip`, `#swap-sym-in/out`,
`#swap-details`, `#swap-go`): quote at review time (`pool.quote`),
`minOut = out − out·50/10000`, deadline from `ui.clock() + 900n`, the floor
in words (`No less than <amt> <sym> — or nothing moves`, `Dies in fifteen
minutes`), exact approval as the button's current step (`approveExactThen`),
exact-in by default; exact-out offered with the residual-allowance
follow-up (D19) through `[data-act=approveZero]` (listed in CONSOLE §6.2). Over half the reserve → a sentence. Directory
(`#swap-directory .market`) from `pool.openIds(0, 48)` (the `/open` HTTP
route is for agents; the panel reads the row so the viewer works too).
*Elsewhere* (`[data-tab=elsewhere]`, hidden when `!(S.reported & S.bits.router)`
or `S.router` is zero; the chip says which spelling): `router.quoteExactIn`
through `ui.simulate` decoding `QuoteResult`, beside the owned quote
(`#swap-quote-owned`, `#swap-quote-elsewhere`); `router.venues()` in hooklist
shape (`#swap-venues .venue`); the swap through `reach.executeTyped` (D §4.2
C) with spend `(tokenIn, amountIn)` and receiveMin `(tokenOut, minOut)`;
hidden for native or manifest assets under a Reach seal (D §4.4).

Rows: `pool.openMarket deposit withdraw closeMarket swapExactIn swapExactOut quote quoteExactOut syncCurve setFee sealMarket writeDown collect marketOf spot openIds sealedIds marketHash`, `erc20.approve allowance balanceOf symbol decimals`, `router.quoteExactIn swap venues`, `reach.executeTyped manifest sealedUntil`, `hub.getTraitValue`.
Needs: market operations `HOLD` (acts); swaps none; Elsewhere `HOLD`.

### 5.2 social — `engine/panels/social.js` (owner: social agent)

Screens: *Commons* (`#social-commons`): the walk — `stateOf(0)` words 0/1
(count from word 1, never from `heads`), `eth_getLogs` one block at a time
with `topics: [S.topics.said, W(0)]`, body offset word 6 (`0xe0`), `kind
=== 1` → *— a sealed message —*, newest first per block, follow the oldest's
`prev`, 12 hops; rows `.row .who .body`, `.who` = `#<id>`. The composer
(`#social-composer`, `[data-act=speak]`) only for `HOLD|ACCOUNT`; else
`#social-why` with the sentence (renter: *you are the user; only the holder
— or the token's own Reach — may speak as it*; operator: *an operator may
move the token, not speak*; session: *a session speaks only through the
Reach*; nobody: *connect the holding wallet to speak as it*). `speak`
calldata: six head words, body offset `0xc0`; `MAX_BODY` 1024, refused with
the count; `Cooldown(uint64)` decoded by the slab. `[data-act=speakAsReach]`
wraps the same inner data in `reach.execute(parley, 0, data, 0)`. *Home
room* (`#social-home`): `S.home` → *this token has not spoken yet* when
`count === 0`; followers `roster.membersOf(home.room, 0)` (`#social-followers
.token`); follow/unfollow another token's home (`join`/`leave`). *Rooms*
(`#social-rooms`): `roomsOf(id)`, found (`found(id, name ≤ 48 B, open)`),
join/leave/invite; group names walked from the `founded` topic at
`stateOf(room).opened` (one block). *DMs* (`#social-dm`, `#social-dm-status`):
the sealing flow of CONSOLE §9 (`/*@inline engine/whispers.mjs*/` at the top
of the IIFE — the inliner is landed in `build-app.mjs`; the panel may not
redeclare the module's names, CONSOLE §5; terser drops `encryptKeyBackup`/
`decryptKeyBackup`/`passwordKey` on its own when the panel never calls them).
The scalar comes from `ui.sealSignature()` — the shell's one `personal_sign`
— and the signature and scalar stay in this IIFE's closure, never on
`window.INTACT`. **In the same commit as the panel, rewrite the header
paragraph of `engine/whispers.mjs` (lines 19–21) that still derives the
scalar from `"INTACT seal v1 · chain <c> · token <t> · epoch <e>"`: the D7
sentence is `"INTACT seal v1 · chain <c> · hub <hub>"`, one key per wallet,
because the registry is address-keyed (`setEncryptionKey(uint16,bytes)` has
no token parameter) and epoch death comes from `Parley.Binding{owner,
epoch}`.** The pair room
walk with `W(pairKey)` — the panel needs `pairKey(a,b)`: it has no row, so
derive it as the Parley does (`keccak(abi.encodePacked(uint8(2), lo, hi))`)
with `ui.kbytes` — **this is the one hash the panel computes for a room key;
say so in the header**; `whisper` (five head words, offset `0xa0`) or
`whisperStamped` (seven, offset `0xe0`; `expectedFeeToken`/`maxPostage` from
`postage.inboxOf(to)`; native postage as `value` exactly; ERC-20 postage is
pulled from the **sender's Reach** — the slab says *"paid by #me's Reach"* and
offers the Reach's exact approve first); the `recheck` hook (`keyOf(to)` +
both epochs). *Inbox* (`#social-inbox`): `inboxOf(id)` as facts; `configureInbox`
(`HOLD`, replyWindow 5 min..30 d); `pendingOf(pairRoom)`, `stampOf(stampId)`
(10 words) for receipts; `expire`, `claimRefund` (pays the sender's Reach),
`claimSettled(id, feeToken)`. Reactions: *reactions unavailable on this chain*.

Rows: `parley.speak whisper whisperStamped found join leave invite bindKey keyOf stateOf roomsOf`, `roster.membersOf`, `postage.configureInbox inboxOf expire claimRefund claimSettled owed pendingOf stampOf`, `keys.getPublicKeys keyIdOf`, `reach.execute`, `hub.custodyEpoch`, `erc20.approve allowance symbol decimals`.
Needs: speak/whisper/found/join/leave/invite `HOLD` (acts); configureInbox `HOLD`; expire/claim* none.

### 5.3 launch — `engine/panels/launch.js` (owner: launch agent)

Screens: *Coin* (`#launch-coin-form`): name, symbol, decimals ≤ 36, supply,
salt, raiseShare; `[data-act=coinAt]` previews with `by` = the actual sender
(the wallet; the Reach when the Reach launches) into `#launch-coin-preview`
and sends nothing; `[data-act=launch]` (`HOLD` for a first launch; the
guardian's `approveFirstLaunch` control for `GUARDIAN`); spacing from
`lastLaunchAt(id) + 7 d` as a countdown (`#launch-spacing`, *next launch in
…*). *Raise* (`#launch-raises .raise`): `launchesOf(id)` → `launchOf(L)` (20
words) per raise: coin symbol, state word, `raised X of Y` with
`graduationTargetOf(L)`, `#launch-tax` from `snipeTaxBps(L)` as `99.00 %`,
`#launch-tax-countdown` to `fairWindowEnds` (*no tax* after), `#launch-floor
[data-raw]` from `coin.floorPerToken()`, `boughtInWindow(L, me)` vs
`maxBuyInWindow` (*you may still buy X in the window*); the create form
(`createChecked(params, termsHash(params))` — `termsHash` read in the same
slab, `coin` must be a prior launch's with `raiseShare > 0`); buy card
(`#launch-buy-in`, `-out`, `-fee`, `-snipe` with `dataset.raw` from
`quoteBuy(L, in)`'s three words; `buy(L, minBaseOut, deadline, maxFeeBps ≥
feeBps + snipeTaxBps)` with `value` = the input exactly); sell credits
(`sell(L, baseIn ≤ creditOf, minQuoteOut, deadline)` — credits, no approval);
graduate (anyone, when `raised ≥ target || baseSold ≥ curveSupply`); fail /
refund / claim. *Positions* (`#launch-positions .sealed`): graduated
launches' `marketKey` → `pool.marketOf(key)` w13/w14 owed, `collect(key)`
as `[data-act=launchCollect]` (renamed: `collect` is the swap lane's).
*Floor*: `contribute()` (value), `redeem(amount)`. *Locks* (`#launch-locks
.lock`): `S.reachLocks` count, `lockIdOf(reach, i)` → `lockOf(id)` filtered
by `beneficiary == reach`, `releasable(id)`; `lock(asset, amount, reach,
start, cliff, end, linear)` with the exact approve to `S.locks` for an ERC-20
(the address is `INTACT.locks` after D1), `release` as `[data-act=lockRelease]`
(renamed: `release` is the vault lane's `hub.release`), `extend`/`give`
through `reach.execute` when the beneficiary is the Reach.

Rows: `kiln.launch coinAt recordsOf recent`, `launchpad.create createChecked approveFirstLaunch buy sell graduate fail refund claim launchOf launchesOf quoteBuy quoteSell snipeTaxBps creditOf termsHash graduationTargetOf boughtInWindow lastLaunchAt firstLaunchApproved`, `coin.contribute redeem floorPerToken`, `pool.collect marketOf`, `locks.lock release extend give lockOf releasable lockCountOf lockIdOf`, `erc20.approve allowance balanceOf symbol decimals`, `reach.execute`.
Needs: launch/create `HOLD` (acts); approveFirstLaunch `GUARDIAN`; buy/sell/graduate/fail/refund/claim/collect/contribute/redeem/lock/release none.

### 5.4 vault — `engine/panels/vault.js` (owner: vault agent)

Screens: *Reach*: `holdings()` (`#vault-holdings .row`; `measured === false`
→ *not measurable*), `manifest()` (`#vault-manifest`, guard/unguard `HOLD`),
`pieces()` read-only, seal (`#vault-seal-until` input with `min` = the
current `sealedUntil`, `#vault-seal-note` *only ever lengthens*, `seal(until)`
slab naming the date; `sealMax` for `HOLD|GUARDIAN`), the execute composer
(`#vault-execute`: to, value, data; `execute(to, value, data, 0)` — operation
0 only, no control offers 1; the vault's approve form lays the inner
`approve(spender, amount)` with `ui.data("erc20.approve", …)` and the shell's
`propose` refuses an inner amount `≥ 2^255` exactly as it refuses an outer
one — the panel does not need its own check, F10b asserts the shell's), the
batch (`#vault-batch`: rows → `executeBatch` hand-laid with
`enc.W/enc.bytes`, proposed as `{ to, data, sig, lines }` with a line per
row), the open-approval ledger (`#vault-approvals
.row` with `.allowance[data-raw]` from a live `erc20.allowance(reach, spender)`,
`#vault-revoke-all` → `revokeOpenApprovals()`; empty → *nothing may leave*).
*Grip* (`#vault-grip`): `#vault-grip-address`, `ui.qr("ethereum:" + grip + "@"
+ chainId)`, `#vault-grip-warning` **before** any way in (*nothing can ever
leave the Grip*), balances via `eth_getBalance`/`erc20.balanceOf`; the only
buttons are `.copy`. *Sessions* (`#vault-sessions`): the key field
(`#vault-session-key` → `sessionOf`, `sessionExposure`, `rightsOf & SESSION`),
`#vault-session-walk` (the grant-log walk, D2; *the grant log could not be
walked on this endpoint*), grant form with `[data-sel]` chips from `S.sel`
(selectors as `bytes4` left-aligned words), targets, caps, expires ≤ 365 d,
exposure printed before Sign; `grantRecipe`; revoke one / all. *Steward*
(`#vault-steward-status` in words from `S.stewardStatus`/`wouldPass`: *nothing
arranged · void (sold) · speaking · summonable · waiting · locked · bad hands ·
ready*): arrange (`heirHashOf(heir, salt)` or `heirHashOfToken(tokenN, salt)`
read live — no local keccak of the heir), heartbeat (`stillHere`, `HOLD`),
cancel, summon/attest/execute for the roles that may; the Steward address is
`INTACT.steward` after D1. *Sell* (`[data-act=transfer]`): the checklist
(`#vault-checklist .survives/.revoked`, CONSOLE §7) renders first; then
`transferFrom(owner, to, id)` refusing `to ∈ {hub, reach, grip, reachImpl,
gripImpl}` client-side with no read, and any canonical account by this
recipe (`isCanonicalAccount(candidate, id, gripRole)` needs the id, which a
pasted address does not carry): `code = await ui.request("eth_getCode",
[to, "latest"])`; if `code.length === 2 + 173 * 2` (the ERC-6551 forwarder
footer, DESIGN §2) read the last word as `k` and the word before it as the
hub; when the hub equals `S.hub`, `isCanonicalAccount(to, k, false) ||
isCanonicalAccount(to, k, true)` → refuse with *"no Intact can sit inside
another Intact's accounts"*; otherwise propose and let the estimate surface
the hub's own revert. (T1 asserts `eth_getCode` and the two
`isCanonicalAccount` calls in `W.calls` before any estimate.)
*Panic* (`#vault-panic.red`, `#vault-panic-list`): two presses, the list from
live reads (CONSOLE §7), the guardian's variant, `release` under a hold; the
hold itself is Home's `[data-fact=locked]` (the shell's, from `S.locked`),
which the vault repeats as *locked: yes* — there is no `#chip-locked`.

Rows: `reach.execute executeBatch executeTyped seal sealMax guard unguard revokeOpenApprovals grantSession grantRecipe revokeSession revokeAllSessions sessionAllows sessionOf sessionExposure openApprovals holdings manifest pieces sealedUntil state`, `steward.arrange stillHere stillHereUnderDuress cancel summon attest execute wouldPass getWill getObit heirHashOf heirHashOfToken`, `hub.panic release transferFrom isCanonicalAccount coreOf rightsOf custodyEpoch statusOf feeSink`, `parley.keyOf`, `postage.inboxOf`, `launchpad.firstLaunchApproved launchesOf`, `pool.marketOf marketHash`, `locks.lockCountOf lockOf lockIdOf`, `erc20.allowance balanceOf symbol decimals`.
Needs: Reach writes `HOLD`; `sealMax`/`revokeAllSessions`/`revokeOpenApprovals`/`panic` `HOLD|GUARDIAN`; steward writes `HOLD` strictly (attest: a named guardian; summon/execute: anyone when due); transfer `HOLD|CUSTODY`; release `HOLD`.

### 5.5 identity — `engine/panels/identity.js` (owner: identity agent)

Screens: status (`#identity-status` Active/Paused, `#identity-status-rule`
verbatim *sessions act only while Active; a sale pauses the token; re-arm to
let your keys act*, `setStatus` `HOLD` acts, `pause` `HOLD|GUARDIAN`); traits
(`setTrait(id, ui.khex("curve"), bps ≤ 80000)` and `setTrait(id,
ui.khex("name"), ≤ 32 B UTF-8 left-aligned)` — the slab prints *curve 3000
bps → 4500 bps* / the name); guardian (`setGuardian`, `HOLD`); renter
(`setUser(id, user, expires)`, `HOLD`; *take it back* = `(0x0, 0)`); agent
wallet two-step (`proposeAgentWallet`; `#identity-proposed`; `acceptAgentWallet`
only when `account === S.proposedWallet`); fees to Grip (`setFeesToGrip`,
with *permanently unspendable* first); pin/unpin face; `sealTransfer`
ratchet; operators (`setApprovalForAllUntil`, `setApprovalForAll`, `approve`,
`revokeAllApprovals` — these are per owner and the slab says so); encryption
key two-step (CONSOLE §9: `setEncryptionKey(3, pk)` then `bindKey(id)`;
`#identity-key` *no key bound* / *bound at epoch e*); rights of any address
(`#identity-rights-input` → `rightsOf(id, addr)` → `#identity-rights-chips
.chip[data-right=<HOLD|ACCOUNT|…>]` — `data-right`, not `data-bit`, which
Home uses for satellite names); fingerprint diff (`#identity-fingerprint-baked` =
`S.fingerprint`, `#identity-fingerprint-live` = `getStateFingerprint(id)`,
*changed since this document was rendered* when they differ); the 7702
delegate (`#identity-delegate`, `#ack-delegate` — the read is the shell's;
the panel draws the row from `ui.delegate()` on every paint and
`#ack-delegate` calls `ui.ackDelegate()`, which unhides `[data-spend]` and
fires `intact:rights`; the controls the panel marks `opts.spend` are the
ones CONSOLE §3 names, so M5 is not vacuous: `approve`,
`setApprovalForAll*`, `setUser`, `proposeAgentWallet`); hash manifest (`S.panels`, `S.engineHash`,
`S.catalogHash` as facts); no ENS row.

Rows: `hub.setTrait setStatus pause setGuardian setUser proposeAgentWallet acceptAgentWallet setFeesToGrip pinTokenURI unpinTokenURI sealTransfer setApprovalForAllUntil setApprovalForAll approve revokeAllApprovals rightsOf coreOf statusOf getTraitValue getStateFingerprint`, `keys.setEncryptionKey getPublicKeys keyIdOf`, `parley.bindKey keyOf`.

### 5.6 agent — `engine/panels/agent.js` (owner: shell agent; stub)

`#agent-stub`: *"the agent lane arrives with U17; until then: the catalogue
is `/services.json`, sessions are granted in the Vault, and a key opens
`/k/<id>/<key>`"*; in session mode the key's facts (`sessionOf`,
`sessionExposure`, `sessionAllows` probe field) and *no executeAsSession
composer until U17*. Rows: `reach.sessionOf sessionExposure sessionAllows`,
`catalog.services`.

---

## 6. verify-site — architecture

### 6.1 Files

- `tools/dom-shim.mjs` — the DOM + wallet shim, reused by U11. Exports
  `boot(html, { provider | wallets, opaque, hash, query, url })`, `walletFor(chain,
  actor, opts)`, `nap`, `click`, `fill`, `textOf`, `prompts()`.
- `tools/verify-site.mjs` — the runner: `compile({ quiet: true, dirs: ["src",
  "test/mocks"] })`, **`build()` first** (`deploySite` reads `dist/shards.json`
  through `readPlan()`, so a runner that does not build first deploys stale
  panel pins and every lane prints *panel refused*), then **per group**:
  `Chain.open()` → `deploySite(c, out)` → mint the cast → a fresh `ctx` →
  `await g.run(t, ctx)` (§6.3; ≈ 1.2 s a chain, measured). Groups are
  imported with `fs.existsSync` and a missing file prints `group <g> not
  present` instead of throwing, so the runner is green while a panel group
  has not landed. `--group <name>` runs one; prints the gzip size of the
  shell beside the cold `tokenURI` and `/hash` gas (a one-wei transaction
  before each), then one `N passed, M failed` line and `process.exit(fail ?
  1 : 0)`.
- `tools/verify-site/{boot,swap,social,launch,vault,identity}.mjs` — each
  `export async function run(t, ctx)`. **The shapes, pinned:**
  - `t.ok(cond, name)`, `t.eq(got, want, name)` (got first — not selftest's
    order), `t.head(text)`, `t.refuses(fn, re, name)` (awaits `fn`, passes
    when it throws/rejects with a message matching `re`).
  - `ctx = { c, out, site, S, GET, actors: { me, renter, buyer, trader,
    stranger, guardianW, agentW, delegated }, weth, bootToken, bootPage, lane,
    roll, warp, warpBy, revertWith, BLOCK: () => EVM.BLOCK.header, sel, enc,
    dec*, zlib, fs, build }`.
  - `ctx.bootToken(id, { wallet?: W | wallets?: W[], opaque?, query?, hash?,
    url? }) → { page, ctx: vmctx, W, S, html }` and `ctx.bootPage(path, opts)`
    the same shape; **both resolve after `vmctx.INTACT.ui.ready` has
    settled** (the loader's `document.close()` is not awaited by the loader
    IIFE, so `boot()` returning on the outer promise is too early; the
    harness polls for `vmctx.INTACT?.ui?.ready`, awaits it, with a 5 s timeout
    that fails the group loudly) plus one `page.settle()`. `W` is the first
    wallet; `S` is `vmctx.INTACT`.
  - `ctx.lane(page, name)` sets `location.hash`, dispatches `hashchange`, and
    awaits `vmctx.INTACT.loaded[name] === true` (or the lane's refusal text),
    then settles.
  - `ctx.revertWith(sig, ...args) → hex` (selector + encoded args, for
    `W.answer` throws); `ctx.warpBy(seconds)` (relative; `warp(t)` in
    `evm.mjs` is absolute); `ctx.roll(n)`.
  - Each group ends every BUILD-PLAN block with `t.ok(blockPassed, "<the
    sentence verbatim>")` where `blockPassed` is the conjunction of that
    block's assertions, so INVARIANTS can quote one exact string per
    sentence.

### 6.2 The shim (C §4, boot (a) — the loader runs)

One `vm` context per page, always (`ctx.__used` asserted). The sandbox gets
Node's own `Blob, URL, Response, DecompressionStream, CompressionStream,
TextEncoder, TextDecoder, atob, btoa, crypto, Event, CustomEvent, EventTarget,
structuredClone, queueMicrotask, console (recording errors), setTimeout/
clearTimeout/setInterval (compressed to ≤ 2 ms), requestAnimationFrame,
requestIdleCallback (→ setTimeout 0), navigator, getComputedStyle`;
`ctx.window = ctx.self = ctx.globalThis = ctx`.

- **Window as an EventTarget**: `addEventListener/removeEventListener/
  dispatchEvent` backed by a Node `EventTarget`; EIP-6963 `CustomEvent`s
  reach listeners with `detail` (verified by C).
- **The tree**: a hand-rolled tokenizer (open/close/void tags, quoted and
  unquoted attributes, raw text for `<script>`/`<style>`, comments and
  doctype skipped); nodes `{ tagName, attrs: Map, dataset (live view of
  `data-*`), parentNode, childNodes, children, textContent get/set,
  append/appendChild/insertBefore/replaceChildren/remove, setAttribute/
  getAttribute/removeAttribute/hasAttribute, classList, style (with
  setProperty), hidden/disabled/value/checked/min/max/type/href/src, closest,
  matches, querySelector(All) }`; a compound selector matcher (`tag #id
  .class [attr] [attr=v]`, descendant and `>` combinators, `:not()`);
  `createElement`, `createElementNS` (sets `namespaceURI`), `createTextNode`,
  `createDocumentFragment`, `document.head/body/documentElement/title`.
- **`innerHTML` tripwire**: a setter that records `page.innerHTMLWrites++`
  and throws; the whole run asserts 0.
- **`document.open()/write()/close()`**: `open()` empties the tree and `byId`
  but keeps the context; `write()` buffers; `close()` parses the buffer,
  mounts it, runs each `<script>` in document order as the tokenizer reaches
  it (`vm.runInContext(text, ctx, { filename: "shell#" + i })`, awaiting a
  returned promise), then dispatches `DOMContentLoaded` and `load`.
- **Blob scripts**: `appendChild/append/insertBefore` of a `script` with
  `src` → `resolveObjectURL(src)` (`node:buffer`) → `blob.text()` →
  `vm.runInContext` → `load` event; recorded in `page.appended = [{ src, type,
  text, hash }]`; a non-`blob:` `src` is recorded and refused.
- **Storage**: console → a Map-backed `localStorage`; viewer (`opaque`) →
  `Object.defineProperty(ctx, "localStorage", { get() { ctx.__storageReads++;
  throw new DOMException("The operation is insecure.", "SecurityError"); } })`.
- **`fetch`**: console → `GET(segments)` from the URL path, `Content-Encoding:
  gzip` honoured with `zlib.gunzipSync`, a `Response` returned, every call in
  `page.fetches`; viewer → rejects `TypeError("Failed to fetch")`.
  `W.tamperPanel(name, fn, { forgeETag })` and `W.tamperFetch(path, fn)`
  override.
- **`location`/`history`**: built from the page URL (`origin`, `pathname`,
  `search`, `hash`); a `hash` setter dispatches `hashchange`; `location.href`
  assignment records `page.navigations.push(href)` (the mint flow asserts the
  navigation rather than following it).
- **Clock**: `ctx.Date` is a subclass whose `now()` returns
  `Number(EVM.BLOCK.header.timestamp) * 1000`, so a countdown's animation
  and the chain's clock agree. Because of that pin a deadline built from
  `Date.now()` and one built from the chain are indistinguishable by
  default — so the deadline assertions (H5, J8, X4) first `W.override(
  "eth_getBlockByNumber", …)` to answer `timestamp = BLOCK.timestamp + 7777n`
  once and require the calldata word to be that answer + 900; `Date.now()`
  stays pinned to the block, so a shell that cheated would print +900, not
  +8677.
- **Errors**: `console.error` recorded; every `runInContext` and awaited
  promise wrapped into `page.errors`; `unhandledRejection` appended during a
  page's run.
- `page.settle()` — three `setImmediate` rounds plus a `setTimeout(0)`;
  `page.until(cond, tries)`; `page.$`, `page.$$`, `page.click(el)` (bubbling
  with `target`), `page.type(el, v)` (`value` + `input` + `change`),
  `page.hash("#name")`.

**The wallet** `walletFor(chain, actor, { rdns, name, legacy, chainId,
accounts })`: an EIP-1193 provider announced over EIP-6963 (and as
`window.ethereum` with `legacy`), with `on/removeListener` and `W.emit`,
`W.setChain(id)`, `W.setAccounts(list)`. Every request through the donor's
one-at-a-time `seq` queue. `W.calls` (every call, in order), `W.promptsLog`
(the `PROMPTING` set: `eth_requestAccounts, eth_sendTransaction, personal_sign,
eth_sign, eth_signTypedData*, wallet_switchEthereumChain, wallet_addEthereumChain,
wallet_requestPermissions, wallet_watchAsset`), `W.prompts()`, `W.sent()`,
`W.firstIndex(method)`, `W.receipts`, and three override hooks: `W.answer(to,
selector, fn)` for one `eth_call` target+selector (`fn(data) → hex` or throws
the shaped revert); `W.override(method, fn)` for a whole method (`fn(params)
→ answer` or throws; `W.override(method, null)` restores); `W.refuse(method,
err)` = `W.override(method, () => { throw err })`. There is no `W.beforeSend`:
a race against the epoch re-read is staged by landing the competing
transaction on the chain between the estimate and `page.click([data-go])`
(G7).

| Method | Answer |
|---|---|
| `eth_chainId` | `"0x" + chainId.toString(16)` (the chain's, or `setChain`'s) |
| `eth_accounts` / `eth_requestAccounts` | `accounts` (default `[actor.from]`); the second is a prompt |
| `eth_call` | `c.simulate(to, data, { from })` (D15) → `ok ? data : throw Object.assign(new Error("execution reverted"), { code: 3, data })` with the **full** revert data |
| `eth_estimateGas` | `c.simulate(...)` with `value` → `"0x" + (gas + 21000n + calldataGas).toString(16)` or the same shaped throw |
| `eth_sendTransaction` | `actor.send({ to, data, value })` → `hash` from D15; a revert is caught and recorded as a receipt with `status "0x0"`, the hash still returned; `autoRoll` one block per send |
| `eth_getTransactionReceipt` | `W.receipts.get(hash)` in JSON-RPC shape with `logs` (address, topics, data, blockNumber, logIndex, transactionHash) |
| `eth_getBlockByNumber` | `{ number, timestamp: "0x" + EVM.BLOCK.header.timestamp.toString(16), hash }` (D11) |
| `eth_blockNumber`, `eth_getBalance`, `eth_getCode`, `eth_gasPrice` | from the chain (`getCode` via `stateManager.getCode`; `putCode` models a 7702 holder — read-side only, EIP-3607) |
| `eth_getLogs` | `c.getLogs(filter)`, `address` as a string or an array; every filter in `W.filters()` |
| `personal_sign` | real `secp256k1.sign` over `keccak("\x19Ethereum Signed Message:\n" + len + msg)` with the actor's key, `r‖s‖(27+v)`; a prompt |
| `wallet_switchEthereumChain` | in `knownChains` → set + `chainChanged`, `null`; else `{ code: 4902 }`; a prompt |
| anything else | `throw new Error("unexpected method " + method)` |

### 6.3 The cast and the shared setup (once, in the runner)

```
me        = c (0x11…)          holder of #1 (minted first), #2, #3
renter    = c.as(0x22…)        setUser on #1 for 7 d
buyer     = c.as(0x33…)        buys #2 under an open slab (G), buys on the raise (J)
trader    = c.as(0x44…)        10 WETH, trades #2's market (F/H)
stranger  = c.as(0x55…)        approvee of #1 (CUSTODY), graduates (J10)
guardianW = c.as(0x66…)        setGuardian(1, guardianW)
agentW    = c.as(0x77…)        a session key on #1's Reach
weth      = MockERC20("Wrapped Ether","WETH",18,0,false)
site      = deploySite(c, out)                 router ZERO
site2     = deploySite(c2, out, { router: Breakable })     E8 (a second Chain)
site3     = deploySite(c3, out, { router: etched real Router over MockSwapRouter02 })   E10/H11 (E §2.2 recipe)
```

**One chain per group.** The six groups do not share a chain: the state
one leaves falsifies another's assertions (vault's L6 panics #1 — epoch 2,
Paused, Reach sealed 365 d — while identity's M2 wants #1 Active at mint
and M7 wants no key bound; swap's O1 opens #1's market while identity's M4
opens it again, which `openMarket` refuses; social's I14 sells #3 while
swap's H12 opened #3's sniper market as `me`), and "idempotent by checking
the chain first" does not undo another group's writes. So the runner does
the block above **once per group**: `Chain.open()` → `deploySite(c, out)` →
the cast → a fresh `ctx` (measured: `Chain.open()` + `deploySite` 1.2 s and
1.0 s on two fresh chains, `mint` 0.02 s — six chains ≈ 7 s). `site2`
(Breakable router) and `site3` (etched real Router) are further chains
opened inside the groups that need them (boot E9, swap E8/E10/X). Literal
token ids are therefore allowed in a group file; each group file still
states the setup it performs at its head so it reads alone. The runner
passes `cast = { me, renter, buyer, trader, stranger, guardianW, agentW,
delegated }` on every chain with the same keys, so addresses are stable
across groups; `delegated = c.as(0x88…)` holds nothing and exists for the
7702 `putCode` check (M5) so no signing actor ever carries code.

---

## 7. The assertion plan (258 sentences)

Each line is the `ok()`/`eq()` string. Vocabulary: `S` = the booted page's
state block; `W` = the wallet; `page` = the shim page; `sel(sig)`;
`BLOCK` = `EVM.BLOCK.header`. Element names are CONSOLE §6; every selector
below is understood as scoped to its lane (`#lane-swap [data-act=collect]`).
Every group runs on its own chain (§6.3).

### 7.1 `boot.mjs` — 103

**A · build and boot (console, holder, #1)** — 10
- A1 the shell that shipped is the console, not the placeholder — `readPlan().placeholder === false`, `plan.shell === "engine/app.html"`
- A2 the loader inflated the shell the build wrote, byte for byte — `page.written === fs.readFileSync("dist/app.html","utf8")`
- A3 window.INTACT survived document.open() — `ctx.INTACT.id === 1` and the sentinel set after script 1 is still there
- A4 no script threw on the way in — `page.errors.length === 0`
- A5 the body names its boot mode — `body.dataset.mode === "console"`
- A6 the CSP meta is in the document the shell wrote — `meta[http-equiv]` content includes `script-src 'unsafe-inline' blob:` and `connect-src 'self'`
- A7 nothing in the document points off the origin — every `script[src]`, `img[src]`, `link[href]` is `blob:`/`data:`; `page.fetches.every(f => f.url.startsWith("/"))`
- A8 Home prints the baked facts through textContent — `[data-fact=id]` = `"1"`, `chain` = `"1"`, `holder` lower-cased = `S.owner`, `epoch` = `"1"`, `status` = `"Active"`
- A9 the shell's gzip is under budget and the routes are cold-measured — shell gzip ≤ 14,000 (warn) and ≤ 15,000 (fail); cold `tokenURI` ≤ 8,000,000; cold `/token/1/hash` ≤ 2,500,000 (a one-wei tx before each) — printed with the sizes
- A10 nothing was assigned through innerHTML, by anybody, all run — `page.innerHTMLWrites === 0` (re-checked at the very end)

**B · "the opaque origin boots the viewer and never offers connect"** — 16 (viewer; B1–B9 no wallet; B10–B13, B15–B16 holder's wallet announced; B14 `setChain(0x2105)`)
- B1 the detector fired — `body.dataset.mode === "viewer"`
- B2 the web3:// link is printed and is this token's — `#link-web3` = `web3://<premises lower>:1/token/1/live` (matches `external_url` in verify.mjs)
- B3 the https twin is a template, never a baked host — `#link-https` contains `<gateway>` and `/token/1/live`; `dist/app.html` **after removing the one permitted literal `http://www.w3.org/2000/svg`** matches no `/https?:\/\/[a-z0-9.-]+\.(org|com|io|xyz|net)\b/i`, no `/\bwss?:\/\//`, no `"rpc"` key; `www.w3` occurs in `dist/app.html` exactly once (the whole literal — no split dodge); and `fetch(` occurs only inside the panel loader (count the occurrences in the source around `"/panel/"`)
- B4 a QR was drawn, by the shell, as SVG — `#qr svg[role=img]` exists, `aria-label` = the web3 link, `$$("#qr svg rect").length >= 400`
- B5 the QR carries nothing but shapes — `#qr svg` textContent trim `""`; no `a`, `script`, `foreignObject`, `image` inside; every child is `rect` with `shape-rendering="crispEdges"`
- B6 there is no connect control — `$("#connect") === null || hidden`, `$$("[data-go]").length === 0`, `!/connect a wallet/i.test(body text)`
- B7 the page says nothing here can sign — `/nothing here can sign/i.test($("#viewer-note").textContent)`
- B8 the lanes are not offered without a provider — `$$("#lanes a").length === 0 || every aria-disabled="true"`
- B9 the viewer fetched nothing and asked nothing — `page.fetches.length === 0`, `page.errors.length === 0`
- B10 with a wallet announced, the viewer still never prompts — after boot and after clicking every `button` in the document: `W.prompts().length === 0`
- B11 it compared the chain before any read — `W.firstIndex("eth_chainId") !== -1 && < W.firstIndex("eth_call")`
- B12 it found the account quietly — `eth_accounts` called, `eth_requestAccounts` never
- B13 it loaded a panel through the provider, hash-checked — an `eth_call` to `S.engine` with `data.startsWith(sel("panel(uint256)"))`; after `page.hash("#swap")`: `ctx.INTACT.loaded.swap === true`, `page.appended.length === 1`, `page.appended[0].hash === S.panels.swap`
- B14 a viewer wallet on another chain reads nothing, and is offered no move — `eth_call` count 0; `body.dataset.chain === "wrong"`; `/wallet on Base/.test($("#crest").textContent)`; `$("#switch") === null || hidden`; after clicking every button no `wallet_switchEthereumChain` in `W.calls` and `W.prompts().length === 0`; after `page.settle()` no `eth_call` whose data starts with `sel("engineHash()")` and no `eth_blockNumber`; `/self-consistent; wallet on Base, not this token's chain/.test($("#verified").textContent)`
- B15 a wallet with rights still gets no signable control in the viewer — `body.dataset.rights === "1"` yet `$$("[data-go]").length === 0` and `!$("#cbox").classList.contains("on")` after clicking every button
- B16 closing the tab is logout: nothing was stored — `ctx.__storageReads === 1` (the detector's one probe) and `page.errors.length === 0`

**C · "a tampered panel is refused"** — 12 (console, holder)
- C1 a flipped byte is refused with a sentence — `W.tamperPanel("swap", b => { b[40] ^= 1; return b })`, `page.hash("#swap")`: `/panel refused/.test($("#lane-swap").textContent) && /hash/.test(…)`
- C2 nothing was injected — `page.appended.length === 0`
- C3 the lane never marked itself loaded — `ctx.INTACT.loaded?.swap !== true` and `$("#lane-swap").dataset.loaded === undefined`
- C4 a forged ETag changes nothing — `forgeETag: true` → the same refusal
- C5 a truncated panel is refused — `b.subarray(0, b.length - 7)` → refusal
- C6 the untampered panel loads once — fresh page: `loaded.swap === true`, `appended.length === 1`
- C7 what was injected is exactly what was pinned — `appended[0].type === "text/javascript"`, `.hash === S.panels.swap`, `.text === fs.readFileSync("dist/panels/swap.js","utf8")`
- C8 revisiting a lane injects nothing new — `#social` then `#swap`: `appended.length` grew by one; `/panel/swap.js` fetched once
- C9 a lane the state does not pin is not a lane — `page.hash("#nonsense")`: no fetch, no injection, `$("#lane-home").classList.contains("on")`
- C10 a refusal is per lane — tamper social only: social refused, swap loads
- C11 the viewer path is checked the same way — viewer with a wallet, `W.answer(S.engine, sel("panel(uint256)"), ret => flip one byte inside the ABI bytes)` → the same sentence in `#lane-swap`
- C12 the refusal leaks no code — `!/function/.test($("#lane-swap").textContent)`; the only 32-byte hex strings are the pin and the computed hash

**N · discovery and the chain gate** — 13 (console)
- N1 two wallets, a picker, no choice made for you — rdns `io.a`, `io.b`: `$$("#picker button[data-rdns]").length === 2`, names via textContent, `WA.prompts().length + WB.prompts().length === 0`, **and no `eth_call` on either before the click** (D8)
- N2 the picked wallet answers every read and send — click `io.b`: every later `eth_call` is on `WB`; `WA.calls` gains nothing
- N3 one wallet is used, but not before a gesture — single announce: no picker; `eth_requestAccounts` only after `page.click($("#connect"))`
- N4 dedup by rdns — `io.a` twice (different uuid): one button
- N5 a late wallet joins, and the gesture asks — one announcer at boot (picked silently, `eth_chainId` on it), then `io.b` announces: `page.click($("#connect"))` opens `#picker` with two buttons and sends **no** `eth_requestAccounts`; clicking `io.b` sends `eth_requestAccounts` on `WB` only, and every later read is on `WB`
- N6 legacy fallback only when nothing announced — `{ legacy: true }` alone: used; `{ legacy: true }` plus an announce: the announced one is used
- N7 the wrong chain is refused before any read, and offers the move — `setChain(0x2105)` before boot: `eth_call` count 0; `body.dataset.chain === "wrong"`; after `page.settle()` no `eth_call` starting `sel("engineHash()")` and no `eth_blockNumber` (the footer did not read another chain's Engine); `#verified` reads `/self-consistent; wallet on Base, not this token's chain/`; click `#switch` → `wallet_switchEthereumChain` with `params[0].chainId === "0x1"` and nothing else (no `wallet_addEthereumChain` ever, in `W.calls`)
- N8 chainChanged recomputes — `setChain(1)`: `rightsOf` called again; `body.dataset.chain === "ok"`; lanes enabled
- N9 accountsChanged recomputes — `setAccounts([renter])`: `rightsOf` with the renter word; `body.dataset.rights` `"1"` → `"4"`
- N10 quiet first, loud on a gesture — order in `W.calls`: `eth_chainId`, `eth_accounts`, …, `eth_requestAccounts` only after the click
- N11 the remembered choice is a convenience, and the delegate check happens at connect — console: `localStorage["intact.wallet"]` holds the rdns after choosing; `eth_getCode` with the account appears after `eth_requestAccounts`
- N12 a lane already open stops reading when the chain goes wrong — console, `ctx.lane(page, "swap")` loaded; `n = count(eth_call)`; `W.setChain(0x2105)`, `W.emit("chainChanged", "0x2105")`, dispatch `intact:lane` for `swap`, `page.settle()`: `count(eth_call) === n`, `body.dataset.chain === "wrong"`, `/this token lives on Ethereum/.test($("#lane-swap").textContent)`, `body.dataset.rights === ""`
- N13 rights that could not be read are not zero — `W.answer(S.hub, sel("rightsOf(uint256,address)"), () => { throw Object.assign(new Error("boom"), { code: -32000 }) })`, connect: `body.dataset.rights === ""`, `ctx.INTACT.ui.rights() === null`, `/your rights could not be read at block \d+/.test($("#tick").textContent)`, `$$("[data-act]").length === 0` after loading every lane

**R · the collection page `/` and the mint flow** — 11 (console, `bootPage("/")`, a fresh `buyer`-funded actor)
- R1 the collection document boots as the console — `body.dataset.mode === "console"`, `ctx.INTACT.id === 0`
- R2 Home shows the collection, not a token — `[data-fact=minted]` = `String(S.minted)`, `[data-fact=price]` = `fmt(S.price) + " ETH"`; no `[data-fact=holder]`, no `[data-fact=epoch]`
- R3 the directory lists the open markets — `$$("#directory .market").length === S.open.length` and equals `pool.openIds(0,48)` decoded
- R4 the recent coins are the Kiln's — `$$("#recent .coin").length === S.recent.length`
- R5 the commons head is a fact — `/<count> said/.test($("#commons").textContent)` with the count = `S.commons.count`
- R6 the mint re-reads the price and proposes exactly it — click `#mint [data-act=mint]`: an `eth_call hub.price()` precedes the slab; `[data-value].dataset.wei === String(await price())`; `[data-function]` = `mint(address)`; `[data-arg=0]` = the account
- R7 no epoch is re-read on a page with no token — press `[data-go]`: no `eth_call custodyEpoch` in `W.calls`; one `eth_sendTransaction`
- R8 the receipt's Transfer log names the new id — the receipt's log with `topics[0] === S.topics.transfer` and `topics[1]` zero has `topics[3]` = the next id; `ownerOf(id) === buyer`
- R9 and the page navigates there — `page.navigations[0] === "/token/" + id + "/live"`
- R10 the 7702 delegate check runs for a minter too — `eth_getCode(buyer)` in `W.calls`
- R11 paths resolve from the document's base, not the root — `bootPage("/0x" + premises + ":1/token/1/live", …)` with `GET` mapped under that prefix (the shim strips `/<40 hex>:<n>` before routing): `ctx.lane(page, "swap")` loads (`loaded.swap === true`) and `page.fetches[0].url === "/0x" + premises + ":1/panel/swap.js"`; a mint from `bootPage("/0x…:1/")` navigates to `"/0x" + premises + ":1/token/" + id + "/live"`; the same two under `bootPage("/")` begin `/panel/` and `/token/` (`BASE === ""`)

**Z · session mode `?as=`** — 9 (console origin, `bootToken(1, { query: "?as=" + agentW })` with a session granted to `agentW`)
- Z1 the door opens session mode — `body.dataset.mode === "session"`
- Z2 Home names the key and the token — `/acts as key 0x/.test($("#session").textContent)` and `/#1\b/`
- Z3 the key's grant is read in words — `sessionOf(key)` called; `/expires/.test(text) && /cap/.test(text)`; `sessionExposure` called
- Z4 the SESSION bit is the key's — `body.dataset.rights === "128"` without any wallet connected (the actor is the key)
- Z5 every holder control is hidden — after loading every lane: `$$("[data-act]").length === 0`, `$$("[data-go]").length === 0`
- Z6 a wallet that is not the key is refused — `wallet(me)` connected: `/connected wallet is 0x/.test($("#session").textContent)`, `body.dataset.rights === ""`
- Z7 the key's wallet is accepted — `wallet(agentW)`: no refusal, `body.dataset.rights === "128"`
- Z8 the agent lane says what is missing — `page.hash("#agent")`: `/until U17/.test($("#lane-agent").textContent)`; a malformed `?as=xyz` boots as `console`
- Z9 the holder's own address as a key is only a key — `bootToken(1, { query: "?as=" + me })`: `body.dataset.rights === "0"` (masked to SESSION; `me` holds no session), `ctx.INTACT.ui.rights() === 0`, after loading every lane `$$("#social-composer textarea").length === 0` and `$$("[data-act]").length === 0`

**Q · the QR** — 8 (viewer, no wallet; `#qr svg`)
- Q1 the code is version 5 with its quiet zone — `viewBox === "0 0 45 45"`; every rect has `x,y ∈ [4, 40]`
- Q2 three finders where the standard puts them — the 7×7 blocks at module (0,0), (30,0), (0,30) match the finder pattern exactly, with light separators
- Q3 the timing patterns alternate — row 6 and column 6, modules 8..28, alternate dark/light starting dark
- Q4 the dark module is dark — module (col 8, row 29) is dark
- Q5 the alignment pattern sits at (30,30) — the 5×5 block centered there matches
- Q6 the format bits are a valid BCH word for L and mask 0 — read the 15 bits at the top-left copy, `=== 0x77C4`; the second copy agrees
- Q7 the module map's keccak is pinned — `keccak(map as 1369 bytes) === <value recorded in INVARIANTS by the integration agent>` (computed once, then pinned)
- Q8 an independent decoder reads the link back — the harness rasterises the module map itself (no canvas in Node) into a grey `Uint8ClampedArray` at **4 px per module** (180 × 180 with the quiet zone; jsqr's locator fails at 1 px/module) and `jsQR(data, 180, 180).data === web3 link`; without `jsqr` (lazy import failed): an independent RS encoder (own GF(256) tables) reproduces the 134 codewords read back from the module map after unmasking

**V · the self-hash footer** — 7
- V1 the loader left the inflated bytes on the state object — before the shell's scripts run, `ctx.INTACT.$doc === page.written` (checked by a hook in `close()` before script 1 of the shell)
- V2 and the shell took them off again — after settle: `!("$doc" in ctx.INTACT)`
- V3 the console verifies against the chain, and names the engine — with a provider on the right chain: `eth_call engine.engineHash()` in `W.calls`; `new RegExp("engine " + short(S.engine) + " pins these bytes at block \\d+").test($("#verified").textContent)` and the number equals `eth_blockNumber`'s; the `engineHash()` call comes **after** `eth_chainId` in `W.calls`
- V4 the viewer without a provider is only self-consistent — `/self-consistent; chain not reachable to verify/`
- V5 a chain that names another hash is told so in red — `W.answer(S.engine, sel("engineHash()"), () => "0x" + "00".repeat(32))`: `/does not match the engine hash/` and `$("#verified").classList.contains("bad")`
- V6 the address you opened anchors the sentence — `bootPage("/0x" + premises + ":1/token/1/live")`: `eth_call premises.ENGINE()` (`sel("ENGINE()")`, to `S.premises`) precedes `engineHash()` in `W.calls`; the green sentence prints. `W.answer(S.premises, sel("ENGINE()"), () => word(0xdead…))`: `/this document names a different Premises than the address you opened/` in red and **no** `engineHash()` call
- V7 a document that names another Premises is told so — boot at `"/0x" + other40hex + ":1/token/1/live"` (the path's address ≠ `S.premises`): the red Premises sentence, no `ENGINE()` call, no `engineHash()` call; at `/token/1/live` (no address in the location) the plain green sentence prints after `engineHash()` alone

**E′ · the chips on Home** — 4 (the Swap group proves the tab; the shell proves the chips)
- E1 the state says absent, not zero — `S.router === ZERO`, `(S.reported & S.bits.router) === 0`, `(S.absent & S.bits.router) !== 0`
- E3 the router chip reads not deployed — `.chip[data-bit=router]` text `"router: not deployed on this chain"`, `dataset.state === "absent"`
- E7 a reported zero is a zero — `.chip[data-bit=pool][data-state=reported]`; `[data-fact=market]` = `"closed"` while `S.ownedMarket.open === false`
- E9 no clear bit is ever printed as 0 — for every clear bit `!/:\s*0\b/.test(chip.textContent)`; and on site2 `.chip[data-bit=router]` reads `"router: could not be read at block " + S2.block` with `dataset.state === "unread"`

**O · escaping (the shell's half)** — 3 (`setTrait(1, keccak("name"), "</script>x")` on chain, re-rendered page)
- O2 the name trait is text on Home — `[data-fact=name]` textContent `=== "</script>x"`, `children.length === 0`
- O4 innerHTML was never assigned — the tripwire, end of suite
- O5 the state block still parses with all of it inside — `JSON.parse(stateOfHtml(live.body).text)` succeeds; the raw text has no `</script>`

**P · the loader itself** — 5
- P1 document.write received the shell — A2
- P2 the state object is the one the gap wrote — the A3 sentinel
- P3 the payload property was deleted — `ctx.$INTACT === undefined && !("$INTACT" in ctx)`
- P4 a corrupted payload fails in words, not silence — flip a base64 character: `document.body.textContent.startsWith("INTACT could not inflate itself in this browser.")`
- P5 the shim reproduces the collision the loader rule guards against — `vm.runInContext("const " + firstTopLevelName + "=0", ctx)` throws `SyntaxError`

**G′ · the slab's generic rules, through the mint** — 5
- G′1 an approve of 2^255 or more never becomes a slab — call `ctx.INTACT.ui.propose({ to: weth, key: "erc20.approve", args: [site.pool, 1n << 255n], sentence: "x" })` from the harness: no `#cbox.on`, ticker `/unlimited approvals are never built here/`
- G′2 a write without a sentence is refused as a panel bug — `propose({ … no sentence })`: no slab, ticker names the missing sentence
- G′3 no panel can reach a provider — after boot `!("$lib" in ctx.INTACT)`, `ctx.INTACT.lib === undefined`; `await t.refuses(() => ctx.INTACT.ui.request("eth_sendTransaction", [{}]), /a panel cannot send; propose it/)`, likewise `personal_sign`, `eth_signTypedData_v4`, `wallet_switchEthereumChain`, `eth_requestAccounts`; `W.sent() === 0` and `W.prompts().length` unchanged; `ctx.INTACT.ui.request("eth_blockNumber", [])` resolves
- G′4 an unlimited approve hidden in a Reach call is still refused — `propose({ to: S.reach, data: execute(weth, 0, approve(pool, (1n<<256n)-1n), 0), sig: "execute(address,uint256,bytes,uint8)", lines: [...], sentence: "x" })`: no `#cbox.on`, ticker `/unlimited approvals are never built here/`; the same through `executeBatch` with the approve as row 2 of 2, and through `executeTyped`
- G′5 a signature that does not name the bytes is a panel bug — `propose({ to: weth, data: "0x095ea7b3" + …, sig: "transfer(address,uint256)", lines, sentence })`: no slab, `/the signature does not name these bytes/`; and `propose({ key: "erc20.transfer", … })` from a harness panel that never declared it through `rows`: `/erc20.transfer: not declared by this panel/`

### 7.2 `swap.mjs` — 52

Setup: mint #2 to `me`; `weth.mint(me, 1000 WAD)`; `weth.approve(pool, 100 WAD)`;
`pool.openMarket(2, weth, ZERO, 30, 0, 0, 0)`; `pool.deposit(2, 100 WAD, 10 WAD)
{ value: 10 WAD }`; `weth.mint(trader, 10 WAD)`. #3 minted to `me` with a
market opened `(3, weth, ZERO, 30, 0, 500, 600)` for H12. Boot `/token/2/live`
console as `trader`; `page.hash("#swap")`; `page.type($("#swap-in"), "1")`.

**E · "an absent Router hides the tab and sets the chip to not reported"** — 6
- E2 the Elsewhere tab is hidden — `$("[data-tab=elsewhere]") === null || .hidden === true`
- E4 the hidden tab says which spelling — `/not deployed on this chain/.test($("#lane-swap").textContent)`
- E8 code that would not answer reads could not be read — site2: `/could not be read at block/.test(lane text)` and the tab still hidden
- E10 with a Router the tab appears and quotes — site3: `[data-tab=elsewhere].hidden === false`; typing 1 → `#swap-quote-elsewhere` is a number equal to `received` decoded from `quoteExactIn`'s `QuoteResult` revert (the shim hands the full data; the page decodes word 1)
- E11 the venue manifest is the Router's — `$$("#swap-venues .venue").length === venues().length`, names via textContent
- E13 the owned directory comes from the Pool, so the viewer has it too — `$$("#swap-directory .market").length === openIds(0,48).length`; no `/open` fetch

**F · "every approval the slab builds is exact"** — 13
- F1 the button's current step is the approve — `/^Approve\b/.test($("#swap-go").textContent)`
- F2 pressing raises the slab and sends nothing — `#cbox.on`, `W.sent() === 0`
- F3 the slab names the call and the target — `[data-function]` = `approve(address,uint256)`; `[data-selector]` = `S.sel["erc20.approve"]`; `[data-to]` lower = weth
- F4 the amount word is exactly what was typed, in base units — word 1 of `[data-calldata]` === `WAD`
- F5 unlimited appears only as a refusal — `/Never\s+unlimited/.test(slab)` and no other `unlimited`
- F6 the mask is nowhere — no `f{64}` in the calldata; `dist/app.html` and `dist/panels/*.js` lack `(1n<<256n)-1n`
- F7 signing sends one and the allowance is exact — `[data-go]` → `W.sent() === 1`, `allowance(trader, pool) === WAD`
- F8 the swap spends it to zero — after H7: `allowance === 0n`
- F9 a new amount re-proposes a new exact approve, not a cumulative one — type `2`, press: word 1 === `2 WAD`
- F11 an ETH leg needs no approval — flip: `#swap-go` reads `Swap`, no approve step, `[data-value].dataset.wei` = the typed ether in wei
- F13 the estimate ran before the offer — last `eth_estimateGas` index < `eth_sendTransaction` index; same `data`
- F14 the slab prints the digest and the engine hash — `[data-digest]` === `kec(calldata)`, `[data-engine]` === `S.engineHash`
- F15 the slab prints To / Value / Function / arguments in words, decoded from the bytes it will sign — `[data-arg=0]` equals `checksum(decAddr([data-calldata], word 0))`, `[data-arg=1]` equals `fmt(decUint([data-calldata], word 1))` + ` WETH`; the rows agree with the calldata, not merely with the typed value

**G · "a non-holder sees the custom error before the wallet opens"** — 10 (holder boots `/token/2/live`, opens the fee form, types 25, presses; then the sale `transferFrom(me, buyer, 2)` lands under the open slab)
- G1 the slab's estimate names the error — `$("#cslab [data-gas]").textContent === "would revert: NotActor()"`
- G2 Sign is disabled when the estimate reverted — `[data-go].disabled === true`
- G3 no prompt was reached — `W.prompts().length === 0`
- G4 the name came from the table the chain wrote — `S.err[sel("NotActor()")] === "NotActor()"`; `!/NotActor/.test(dist/app.html)`
- G5 an error with arguments prints them decoded — `W.answer(site.pool, sel(SWAP_IN), () => revert(Slippage(9, 10)))`: `[data-gas]` === `"would revert: Slippage(9, 10)"`
- G6 an unknown selector is still a sentence — `revert("0xdeadbeef")`: `[data-gas]` === `"would revert: unknown error 0xdeadbeef"`
- G7 the epoch is re-read immediately before Sign — the estimate passes and `[data-go]` is enabled; **then** the sale lands on the chain (`await me.send(transferFrom(me, buyer, 2))`, one block); pressing Sign issues `eth_call custodyEpoch(uint256)` **after** the click, reads 2 ≠ 1, the slab closes with `/ownership or epoch changed — review again/`, `W.sent() === 0`
- G8 rights are recomputed after the receipt — after any successful send: `eth_call rightsOf` after `eth_getTransactionReceipt`; after the sale `body.dataset.rights === "0"` for the old holder and the ticker says review again
- G9 the gate is in propose, not in the button — as renter: `$$("#lane-swap [data-act=setFee]").length === 0` (nothing renders), and `ctx.INTACT.ui.propose({ to: S.pool, key: "pool.setFee", args: [2n, 25n], need: 1, lines, sentence })` called from the harness (through a harness panel that declared the row): no `#cbox.on`, no `eth_estimateGas`, the ticker carries `gate`'s renter sentence; as holder under an unknown 7702 delegate (`putCode(delegated, 0xef0100‖0xdead…)`, boot as `delegated` holding #2): `propose({ …, spend: true })` → `/acknowledge it on Identity first/`, no slab; after `ui.ackDelegate()` the same call raises the slab
- G10 a trader too big for the market is told so before any prompt — type `60`: `/TradeTooLarge\(\)|more than half/.test(card or [data-gas])`, `W.prompts().length === 0`

**H · "the swap slab states the floor in words"** — 14 (trader, allowance standing)
- H1 the quote is Pool.quote to the unit — `$("#swap-out").dataset.raw === String(quote(2, true, WAD))`; the formatted text re-parses to the same value
- H2 the details name a rate, a floor and the fee — `/rate/ && /no less than/i && /fee/` in `#swap-details`
- H3 the slab states the floor in words — row `No less than <fmt(quote − quote·50/10000)> ETH — or nothing moves`
- H4 the floor in the calldata is the floor in the words — word 3 === `quote − quote·50n/10000n`
- H5 the deadline is fifteen minutes, exactly, on the chain's clock — `W.override("eth_getBlockByNumber", () => ({ timestamp: hex(BLOCK.timestamp + 7777n), number: …, hash: … }))` for this press only: `/Dies in fifteen minutes/`; word 5 === `BLOCK.timestamp + 7777n + 900n` (not `Date.now()/1000 + 900`, which the pin would make `BLOCK.timestamp + 900n`); `eth_getBlockByNumber` in `W.calls` after the click and before `eth_estimateGas`; then `W.refuse("eth_getBlockByNumber", new Error("down"))`: pressing again raises no slab and the ticker reads `/the chain's clock could not be read/`
- H6 the recipient is the connected account — word 4 === trader
- H7 the swap lands and honours the floor — Sign → `W.sent()` +1, receipt `0x1`, `balance delta >= minOut`
- H8 nonsense is refused, never sent, never NaN — `"not a number"`: `#swap-go.disabled`, `#swap-out` empty, no `NaN` in `body.textContent`
- H9 a trade over half the reserve is a sentence, not a number — `60`: `/more than half/.test($("#swap-out").textContent)`
- H10 flipping turns the pair round — `#swap-flip`: `#swap-sym-in` = `"ETH"`, the pending `baseIn` word is 0
- H11 owned and elsewhere quotes are two numbers, or one — no Router: one `.quote`; site3: two, labelled
- H12 the sniper fee shows as a countdown while it runs — `/token/3/live`: `/sniper.*\d+ s/.test($("#swap-sniper").textContent)`; after `warp(+601)` and `intact:lane` repaint it is gone; and the open form is the only place a sniper field exists (`$$("[name=sniperBps]")` only inside `#swap-open-form`)
- H13 a live seal hides the terms — `sealMarket(2, +86400)`: `$$("[data-act=setFee],[data-act=syncCurve],[data-act=sealMarket]").length === 0`; `/sealed until/.test($("[data-fact=market]").textContent)`
- H14 exact-out offers to zero the residue — exact-out with `maxIn` above `inUsed`: after the receipt, `eth_call allowance` and a `[data-act=approveZero]` control whose slab's word 1 is 0

**O1 · escaping** — 1 (a coin named `</script><script>alert(1)</script>` as base of #1's market, per verify.mjs's hostile section)
- O1 the symbol is text in the swap card — `#swap-sym-in` textContent === the hostile symbol, `children.length === 0`

**X · Elsewhere through the Reach** — 8 (site3, holder)
- X1 the elsewhere swap is proposed to the Reach — `[data-act=swapElsewhere]`: `[data-to]` = `S.reach`, `[data-function]` = `executeTyped(…)`
- X2 the inner call is the Router's swap — the tuple's `data` starts `S.sel["router.swap"]`, its `to` is `S.router`
- X3 spend and receive floors are the typed amounts — `spend[0] = (weth, amountIn)`, `receiveMin[0] = (0x0, minOut)` decoded from `[data-calldata]` (the tuple carries no `[data-arg]` rows: `$$("#cslab [data-arg]").length === 0`, and the panel's `lines` name `spend`, `receive at least` and `dies` in words)
- X4 the deadline word is the chain's — with the +7777 override of H5: tuple `deadline` === `BLOCK.timestamp + 7777n + 900n`
- X5 no standing allowance survives — after Sign: `allowance(reach, router) === 0n`
- X6 the Reach received at least the floor — `balanceOf(reach)` delta ≥ `minOut`
- X7 a sealed Reach hides the native route — `reach.seal(+30 d)`: the native-in option is gone and `/sealed/.test(lane text)`
- X8 a manifest asset is hidden under the seal too — `reach.guard(weth)`: the weth-in option gone, `/manifest/.test(text)`

### 7.3 `social.mjs` — 33

Setup: #1 holder `me`; `setUser(1, renter, +7 d)`; two commons words from
`me` two blocks apart (`speak(0, 1, 0, 0, 0, "hello, commons")`, `roll(+2)`,
`speak(…"and again")`); `setGuardian(1, guardianW)`; `approve(stranger, 1)`;
`grantSession(agentW, …)` on #1's Reach; #3 minted to `me`.

**D · "a renter sees the walk and the sentence"** — 12 (console as renter)
- D1 one free rightsOf at connect — exactly one `eth_call` to `S.hub` with `rightsOf` and the renter word
- D2 the body carries the bits — `body.dataset.rights === "4"`
- D3 Home says you are the user until when — `/you are the user until/.test($("#rights-sentence").textContent)`, the date from `S.clocks.userExpires`
- D4 the composer is not there — `#social`: `$$("#lane-social [data-act=speak]").length === 0`, no `textarea`/`input[type=text]` in `#social-composer`
- D5 the walk is — `$$("#social-commons .row").length === 2`, oldest first, row 0 includes `hello, commons`
- D6 and the sentence says why — `/user|renter/.test($("#social-why").textContent) && /holder/`
- D7 a renter may still trade like anyone — `#swap`: the card exists; `#swap-your-market` absent
- D8 the vault answers to the holder — `#vault`: `$$("#lane-vault [data-act]").length === 0`, `/answers to the holder/`
- D9 traits are read-only — `#identity`: `$$("[data-act=setTrait]").length === 0`
- D10 the right expires and the sentence with it — `warp(+8 d)`, `W.emit("accountsChanged", [renter])`: `body.dataset.rights === "0"`, the sentence gone
- D11 nothing a renter can press sends — "press" = every `[data-act]` button inside `#lane-social`, `#lane-vault`, `#lane-identity` and `#swap-your-market` (never `[data-go]` or `#swap-go`: D7 says a renter may trade like anyone, and that path legitimately estimates): after pressing them all `W.sent() === 0`
- D12 nothing a renter can press even estimates — under the same definition of "press", no `eth_estimateGas` in `W.calls`

**I · "the composer appears only for HOLD or ACCOUNT"** — 16
- I1 holder — `$$("#lane-social [data-act=speak]").length >= 1` on commons, home and rooms
- I2 renter (4) — none (D4)
- I3 stranger-with-approval (8) — none; `/an operator may move the token, not speak/`
- I4 session key (128) — none; `/a session speaks only through the Reach/`
- I5 guardian (64) — none
- I6 nobody (0) — none; `/connect the holding wallet/`
- I7 the Reach's own hand is offered to the holder — `[data-act=speakAsReach]` proposes `execute(address,uint256,bytes,uint8)` to `S.reach`, inner data starts `S.sel["parley.speak"]`, operation word 0
- I8 speaking raises a slab naming the commons and speak — type, press: `[data-function]` = `speak(uint256,uint256,uint8,uint64,uint64,bytes)`, `/the commons/`, `/forever/`; Sign → `stateOf(0)` word 1 +1; body offset word is `0xc0`
- I9 the walk reads one block at a time by a topic the chain computed — `W.filters().every(f => f.fromBlock === f.toBlock)`, `topics[0] === S.topics.said`, `topics[1]` = the room word
- I10 a hostile body is text — `HOSTILE` typed and sent: `row.textContent === HOSTILE`, `children.length === 0`
- I11 the sender is a token, not an address — `/^#\d+/.test(row.querySelector(".who").textContent)`
- I12 a home that has not spoken says so — #3's home: `/has not spoken yet/`; the count comes from `stateOf` word 1 (`heads` is never called with a count in mind: no `heads` call precedes the sentence)
- I13 followers are the roster — #3 joins #1's home: `$$("#social-followers .token").length === 1 === membersOf(home,0).ids.length`
- I14 the DM key is re-read before every send — both keys bound (`setEncryptionKey(3, pk)` + `bindKey` for #1 and #3): press send → `eth_call keyOf(uint256)` to `S.parley` for the recipient **after** the click and before `eth_sendTransaction`; then `transferFrom(#3 → buyer)` and rebind under the buyer → the next send is refused with `/key moved — review again/`, `W.sent()` unchanged, and **no plaintext whisper was sent** (no `eth_sendTransaction` with kind word 0 to the pair)
- I15 sealed only when both keys exist — one key: `/no key — this room cannot be sealed/.test($("#social-dm-status").textContent)`; both: `/^sealed/`
- I16 the sealing sentence is one key per wallet, and the shell is the only hand that signs it — the `personal_sign` message in `W.promptsLog` is exactly `"INTACT seal v1 · chain 1 · hub 0x<hub lower>"` and contains no token id or epoch; it was issued by `ctx.INTACT.ui.sealSignature` (the shim tags the call with the `vm` stack's frame — `shell#2`, not a `blob:` frame); `ctx.INTACT.ui.request("personal_sign", …)` rejects `/a panel cannot send; propose it/`; `/sign this sentence nowhere but here/.test($("#lane-social").textContent)`; nothing on `ctx.INTACT` holds the signature (`JSON.stringify(ctx.INTACT)` lacks its hex)

**K′ · inbox and postage** — 4
- K′1 a priced inbox is a fact — `configureInbox(3, ZERO, WAD/10n, 86400, true)`: `#social-inbox` on #3 reads `/0.1 ETH/`
- K′2 first contact to a priced inbox proposes the stamped form with the exact value — from #1 to #3: `[data-function]` = `whisperStamped(…)`, `[data-value].dataset.wei === String(WAD/10n)`, `/refunded if ignored/.test(slab)`, body offset word `0xe0`
- K′3 ERC-20 postage names the paying hand — an inbox priced in weth: `/paid by #1's Reach/.test(slab)` and the first step is the Reach's exact approve to `S.postage`
- K′4 reactions degrade in words — `/reactions unavailable on this chain/.test($("#lane-social").textContent)`

**O3** — 1
- O3 a message body is text — I10 (counted once)

### 7.4 `launch.mjs` — 18

Setup (Bundle.t.sol `_launchAndGraduate`): `kiln.launch(1, "Agent One",
"AGENT1", 18, SUPPLY, salt, RAISE)`; coin from the `Launched` log;
`launchpad.create([1, coin, 700M WAD, WAD, 3 WAD, 0, 1000, 2^128−1, 9900, 100,
0, 0, T0 + 7 d, 0])`; `L` from `LaunchCreated`. Boot `#launch` as `buyer`.

**J · "the raise shows the tax as a countdown"** — 15
- J1 the raise is listed with its coin — `$$("#launch-raises .raise").length === launchesOf(1).length`, `AGENT1` via textContent
- J2 the tax at the opening block — `$("#launch-tax").textContent === "99.00 %"` and `snipeTaxBps(L) === 9900n`
- J3 the window is a countdown — `/\d+ s/.test($("#launch-tax-countdown").textContent)` with the number `=== fairWindowEnds − BLOCK.timestamp` (from `eth_getBlockByNumber`)
- J4 halfway, half — `warp(T0 + 500)`, `intact:lane` repaint: `"49.50 %"`
- J5 after the window, no tax — `warp(T0 + 1001)`: `/no tax/`, the countdown element gone
- J6 the floor per token is the coin's — `$("#launch-floor").dataset.raw === String(floorPerToken())`
- J7 the curve preview is quoteBuy — type 1 ETH: `#launch-buy-out/-fee/-snipe` raw === `quoteBuy(L, WAD)`'s three words
- J8 the buy slab names the call, the fee cap and the deadline — `buy(uint256,uint256,uint64,uint16)`, a `maxFeeBps` row, `/Dies in fifteen minutes/`; with `W.override("eth_getBlockByNumber", …+7777n)` for this press: word 2 === `BLOCK.timestamp + 7777n + 900n`; `[data-value].dataset.wei === WAD`
- J9 the buy lands as credit — Sign → `creditOf(L, buyer) > 0n`
- J10 graduation is anyone's — three 1-ETH buys (buyer, trader, stranger); boot as `stranger` (rights 0): `[data-act=graduate]` exists; Sign → `launchOf(L)` word 3 === 2
- J11 raised X of Y comes from two reads — `/raised .* of .*/.test(raise text)`; the Y equals `graduationTargetOf(L)`
- J12 collect shows the sealed market and pays the Reach — after `_tradeSealed`-style trades: `$$("#launch-positions .sealed")` includes the key and the owed; `[data-act=launchCollect]` → slab `collect(uint256)`
- J13 coinAt is previewed with the actual sender, nothing sent — fill the Coin form, press `[data-act=coinAt]`: an `eth_call coinAt(…)` whose `by` word is the wallet; `#launch-coin-preview` is an address; `W.sent()` unchanged
- J14 the launch spacing is a countdown — a second Coin within 7 days: `/next launch in \d+/.test($("#launch-spacing").textContent)` from `lastLaunchAt + 7 d`, and the estimate reads `would revert: TooSoon(<until>)`
- J15 locks list the Reach's — `locks.lock(ZERO, WAD, reach, 0, until, until, false) { value: WAD }`: `$$("#launch-locks .lock").length === lockCountOf(reach)`, the lock's `releasable` printed; the control is `#lane-launch [data-act=lockRelease]` → slab `release(uint256)` to `S.locks`

**F12 · the sell approves exactly baseIn** — 1
- F12 Launch › sell needs no approval and says so — `sell(uint256,uint256,uint256,uint64)` slab has no approve step and the line `/credits, not tokens/`

**J′ · window cap** — 2
- J′1 what this buyer may still buy is printed — `/you may still buy .* in the window/` and the amount `=== maxBuyInWindow − boughtInWindow(L, buyer)` (a `maxBuyInWindow` of 2 ETH set on a second launch)
- J′2 a cap breach is a sentence before any prompt — type over it: `[data-gas]` `/FairWindowCapExceeded\(/`, `W.prompts().length` unchanged

### 7.5 `vault.mjs` — 39

Setup: holder `me`, #1, `reach`; `weth.mint(reach, 10 WAD)`;
`reach.execute(weth, 0, approve(pool, 10 WAD), 0)` → `openApprovals().length
=== 1`; a session for `agentW`; `_bindKey`; `configureInbox(1, ZERO, WAD/10n,
86400, true)`; `setGuardian(1, guardianW)`; `setApprovalForAll(stranger,
true)`; `approve(trader, 1)`; `setUser(1, renter, +10 d)`; guardian
`approveFirstLaunch(1)`; `_arrange`. Boot `#vault` as `me`.

**K · "the vault lists open approvals and revokes in one press"** — 24
- K1 the ledger renders — `$$("#vault-approvals .row").length === 1`, `WETH` and `short(pool)` in the row
- K2 the allowance is read live and printed exactly — `.allowance.dataset.raw === String(allowance(reach, pool))`
- K3 one press proposes revokeOpenApprovals — `#vault-revoke-all`: `[data-function]` = `revokeOpenApprovals()`, `W.sent() === 0`
- K4 Sign revokes in one transaction — `W.sent()` +1; `openApprovals().length === 0`; `allowance === 0n`; the list re-renders `/nothing may leave/`
- K5 holdings say measured or not, never 0 for unmeasurable — a `Breakable` asset guarded then broken: `/not measurable/` in its row, not `0`
- K6 the seal input cannot shorten — `Number($("#vault-seal-until").min) >= sealedUntil`; `/only ever lengthens/.test($("#vault-seal-note").textContent)`
- K7 the seal slab names the date — `seal(uint64)` and a date string equal to the input's value
- K8 a sealed Reach refuses value in words before any prompt — `reach.seal(T0 + 30 d)`; the composer with value 1: `[data-gas] === "would revert: ValueWhileSealed()"`
- K9 the Grip warns before any way in — `#vault-grip-address` lower === `S.grip`; `#vault-grip svg[role=img]` with `aria-label === "ethereum:" + grip + "@1"`; `/cannot ever leave|permanent/i.test($("#vault-grip-warning").textContent)` and the warning precedes the address in document order
- K10 the Grip offers nothing outbound — `$$("#vault-grip button").every(b => b.classList.contains("copy"))`
- K11 session chips carry on-chain selectors — `$$("#vault-sessions [data-sel]").length >= 4`, each `dataset.sel` is a value in `S.sel`, including `S.sel["pool.swapExactIn"]`
- K12 the grant's calldata is exactly the chips pressed — one chip + target `pool` + a key + 1 day: decoded `grantSession` tuple: one selector `=== sel(SWAP_IN)`, `targets[0] === pool`, `expires === BLOCK.timestamp + 86400n`
- K13 the exposure is printed before Sign — `/exposure/.test(slab)` with `nativeCap` and each asset cap in words
- K14 the account agrees — Sign → `sessionAllows(key, pool, SWAP_IN) === true`, `(key, pool, withdraw) === false`, `(key, hub, SWAP_IN) === false`
- K15 a pasted key is inspected — type `agentW` into `#vault-session-key`: `sessionOf`, `sessionExposure` and `rightsOf(1, agentW)` called; the row reads `/live/`
- K16 the grant log is walked, one range, and counted — click `#vault-session-walk`: one `eth_getLogs` with `address === S.reach`, `topics[0] === S.topics.sessionGranted`, `fromBlock "0x0"`, `toBlock "latest"`; `$$("#vault-sessions .row").length === 2` (agentW and K14's key); each confirmed by a `rightsOf` call
- K17 an endpoint that refuses the range is a sentence, not a zero — `W.refuse("eth_getLogs", new Error("range too large"))`: `/the grant log could not be walked on this endpoint/`, no `sessions: 0`
- K18 revoking one key — the row's revoke → `revokeSession(address)`; `sessionAllows(key, pool, SWAP_IN) === false` after Sign
- K19 the steward speaks in words — `$("#vault-steward-status").textContent === "nothing arranged"` before `_arrange`; `"speaking"` after; `"summonable"` after `warp(+30 d)`; the writes go to `S.steward` (an address after D1)
- K20 the heir hash is the chain's — the arrange form issues `eth_call heirHashOf(address,bytes32)`; the slab's `heirHash` word equals it; an instrument heir issues `heirHashOfToken(uint256,bytes32)`
- K21 the heartbeat is the holder's — `[data-act=stillHere]` present for holder, absent for renter
- K22 the sell checklist comes before the transfer — press `[data-act=transfer]`: `#vault-checklist .survives` and `.revoked` render; `W.prompts().length` unchanged; no `#cbox.on` yet
- K23 the checklist names what is actually live — revoked column: `/sessions: 2/`, `/key bound: yes/`, `/inbox price: 0.1 ETH/`, `/steward plan: speaking/`, `/first-launch approval: yes/`; survives column: `/seal/`, `/market/`, `/Grip/`, `/open approvals: 1/`, `/launches/`; footer `/nothing the previous holder delegated comes along/`
- K24 execute is call-only and a batch is one slab — the composer's slab names `execute(address,uint256,bytes,uint8)` with operation word 0 and no control offers 1; two batch rows → `executeBatch((address,uint256,bytes)[])`, decoded array length 2; Sign → `W.sent()` +1

**L · "panic lists what it revokes"** — 11
- L1 one red button — `$$("#vault-panic").length === 1 && classList.contains("red")`
- L2 the first press lists, from live reads — `#vault-panic-list` rows `/sessions: 2/`, `/key binding/`, `/inbox price 0.1 ETH/`, `/steward plan/`, `/first-launch approval/`, `/every operator approval on every token you hold/`, `/the single approval, if one stands/`, `/user/`, `/status → Paused/`, `/seal → /`; `W.calls` after the click shows `eth_getLogs` (the walk), `keyOf`, `inboxOf`, `wouldPass`, `firstLaunchApproved`
- L3 the count is honest when the walk fails — with `eth_getLogs` refused: `/sessions: not counted/`, never `/sessions: 0/`
- L4 nothing delegated is still a sentence — fresh token: `/nothing is delegated/ && /still moves the epoch and seals/`
- L5 the second press proposes panic — `[data-function]` = `panic(uint256)`, `W.sent() === 0` until Sign
- L6 one transaction does all of it — Sign → `W.sent()` +1; chain: `custodyEpoch(1) === 2n`, `approvalEpoch(me) === 1n`, `statusOf === 1`, `sealedUntil(reach) === T0 + 365 d`, `sessionAllows(agentW, …) === false`, `keyOf(1).keyId === 0`, `inboxOf(1).postage === 0n`, `wouldPass(1) === 1`, `firstLaunchApproved(1) === false`, `isApprovedForAll(me, stranger) === false`, `getApproved(1) === ZERO`, `userOf(1) === ZERO`
- L7 the page re-reads and says so — `[data-fact=epoch]` `"2"`, `[data-fact=status]` `"Paused"`, the Identity rule visible, `#vault-sessions .row` count 0 after a re-walk, `/sealed until/.test($("[data-fact=seal]").textContent)`
- L8 the guardian's panic is a different list — boot as `guardianW`: `/does not touch the holder's operators/ && /guardian hold/`; slab `panic(uint256)`
- L9 under the hold, only the holder releases — after the guardian's Sign: `$("#facts [data-fact=locked]").textContent === "yes"` (the hub's `locked` is a token fact the shell prints) and `/locked: yes/.test($("#lane-vault").textContent)`, `/only the holder in person/`; `#lane-vault [data-act=release]` absent for the guardian, present for the holder; holder's Sign → `locked(1) === false` and `[data-fact=locked]` reads `no`
- L10 nobody else sees the button — renter and stranger: `$("#vault-panic") === null`
- L11 panic is one transaction — `W.sent()` grew by exactly 1 per panic

**F10 · the Reach's approve through execute is exact too** — 2
- F10 the Reach's approve through execute is exact — composer target weth, data from the approve form: the inner calldata's amount equals the typed amount; `openApprovals()` lists `(weth, pool)` once afterwards
- F10b the Reach's approve cannot be unlimited either — the approve form with amount `(1n<<256n)-1n` (typed as the max, or `2^255` exactly): no `#cbox.on`, the ticker reads `/unlimited approvals are never built here/`, no `eth_estimateGas`; the same amount in a two-row batch is refused as a whole

**T · the transfer slab** — 2
- T1 a canonical account is refused before the chain is asked — type `S.grip` as `to`: no slab, no read, `/no Intact can sit inside another Intact's accounts/`; type #2's Reach address (not in the block): `eth_getCode(to)` in `W.calls`, then `isCanonicalAccount(to, 2, false)` and `isCanonicalAccount(to, 2, true)` (`k` parsed from the 173-byte footer's last word), the refusal, and **no** `eth_estimateGas`; type `buyer` (no code): no `isCanonicalAccount` call, the checklist renders
- T2 the transfer is proposed after the checklist with from, to, id — `[data-function]` = `transferFrom(address,address,uint256)`, `[data-arg=0]` the holder, `[data-arg=2]` `1`

### 7.6 `identity.mjs` — 13

Boot `#identity` as `me` on #1 (and as the roles named).

- M1 the rule is printed verbatim — `$("#identity-status-rule").textContent === "sessions act only while Active; a sale pauses the token; re-arm to let your keys act"`
- M2 the status follows the chain and re-arm is the holder's — Active at mint; after a sale `Paused`; `[data-act=setStatus]` present for the new holder only; Sign → `statusOf === 0`
- M3 rights of any address — type `renter`: `.chip[data-bit=USE]` on, others off; `S.reach`: `ACCOUNT`; `ZERO`: all off
- M4 the fingerprint diff — `#identity-fingerprint-baked` === `S.fingerprint`; after `openMarket` on chain: `/changed since this document was rendered/.test($("#identity-fingerprint-live").textContent)` and the live value equals `getStateFingerprint(1)`
- M5 a known 7702 delegate is named, an unknown one hides spending — on the actor `delegated` (holds a freshly minted token on this group's chain; `me` never carries code, because on Cancun `runTx` enforces EIP-3607 and a coded `me` could not sign M7, M9, M12): `putCode(delegated, 0xef0100 ‖ 0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B)`, boot as `delegated`: `$("#identity-delegate").textContent === "MetaMask EIP7702StatelessDeleGator"` and `knownDelegates()` was read live (`eth_call` to `S.catalog`); `putCode(delegated, 0xef0100 ‖ 0xdead…)`, reboot: `/unknown delegate/` and `$$("#lane-identity [data-spend]").length >= 1 && every(b => b.hidden)` until `page.click($("#ack-delegate"))`, after which they are visible and `intact:rights` fired once more; reads only — `delegated` sends nothing in this group
- M6 the trait keys are the shell's own keccak — the `setTrait` slab's word 1 === `keccak("curve")`; the name slab's word 2 is the UTF-8 left-aligned; the slab reads `/curve 0 bps → 4500 bps/`
- M7 the encryption key is a two-step — no key: `/no key bound/`; after `setEncryptionKey(uint16,bytes)` via the slab (word 0 === 3, the bytes 65 long starting `04`) the next step offers `bindKey(uint256)`; after Sign: `/bound at epoch 1/`
- M8 the guardian form is the holder's — present for holder, absent for guardian and renter
- M9 the agent wallet is proposed then accepted — `proposeAgentWallet(uint256,address)` slab; after Sign `#identity-proposed` names it pending; `[data-act=acceptAgentWallet]` appears only when the connected account is the proposed wallet
- M10 no ENS row on a band without a Nameplate — `$("#identity-ens") === null`
- M11 income into the Grip is warned as permanent — `[data-act=setFeesToGrip]`: `/permanently unspendable/.test(slab)` before the function row
- M12 operator approvals are per owner and the slab says so — `setApprovalForAllUntil` slab: `/every token you hold/`; `revokeAllApprovals()` is one transaction and `approvalEpoch(me)` +1
- M13 the hash manifest is the state's — `/engine 0x41|engine 0x/.test(lane text)` with `S.engineHash`, `S.catalogHash` and every `S.panels[*]` printed

**Total: boot 103 + swap 52 + social 33 + launch 18 + vault 39 + identity 13 = 258 planned; the runner asserts `≥ 150`.** (Boot: A 10 + B 16 + C 12 + N 13 + R 11 + Z 9 + Q 8 + V 7 + E′ 4 + O 3 + P 5 + G′ 5 = 103. Swap: E 6 + F 13 + G 10 + H 14 + O1 1 + X 8 = 52. Social: D 12 + I 16 + K′ 4 + O3 1 = 33. Launch: J 15 + F12 1 + J′ 2 = 18. Vault: K 24 + L 11 + F10 2 + T 2 = 39.) A group may drop a line it cannot set up in the harness (say which, in the group's header) as long as the eleven BUILD-PLAN strings survive and the total stays ≥ 150.

---

## 8. INVARIANTS and docs the integration agent writes

- F3 → live: *"a tampered panel is refused"* (C1), *"the loader left the inflated bytes on the state object"* (V1), the selftest slice keccak (printed by `node tools/selftest.mjs`; the number recorded) **with the sentence that D19's "byte-identical except the two salt lines and `S.collection → S.hub`" became "equal to the recorded keccak of the reordered chain half" and the donor line ranges that moved (§2.1)**, the two 6551 vectors and `test_theShellsSixFiveFiveOneDerivationIsTheContracts`.
- F4 → live: *"the name trait is text on Home"* (O2), *"the symbol is text in the swap card"* (O1), *"a hostile body is text"* (I10), *"innerHTML was never assigned"* (O4).
- F5 → partial (U11 Chromium pending): *"the opaque origin boots the viewer and never offers connect"* (B1–B16), *"two wallets, a picker, no choice made for you"* (N1), *"accountsChanged recomputes"* (N9).
- F6 → live: *"an absent Router hides the tab and sets the chip to not reported"* (E2/E3), *"no clear bit is ever printed as 0"* (E9), *"the count is honest when the walk fails"* (L3).
- A new row for the clear-signing slab: *"the epoch is re-read immediately before Sign"* (G7), *"every approval the slab builds is exact"* (F4/F7/F9), *"an unlimited approve hidden in a Reach call is still refused"* (G′4), *"the deadline is fifteen minutes, exactly, on the chain's clock"* (H5), *"no panel can reach a provider"* (G′3), *"a lane already open stops reading when the chain goes wrong"* (N12).
- `package.json` (D17 order, `jsqr` devDependency) and the `jsqr` install, with the U0 ownership note; `docs/CONSOLE.md` §6.2 filled from the group files' headers; a note for U8's owner that `Premises._moved` emits root-relative `Location` headers for `/k` and `/c`, which a path-based gateway will need prefixed (not changed in U9).
- The byte table of §3 with measured numbers; the cold gas numbers; `docs/CONSOLE.md` §6.2 reconciled with the ids that shipped; README "What was and was not run here".
- Commit message: a declarative sentence ("The console runs in the document the chain serves, and a shim is the first thing to execute its loader"), the body carrying the gzip size, the cold `tokenURI`/`/hash` gas, the assertion count per group, the slice keccak, the vector, what was measured and what was assumed, and the ownership notes for `evm.mjs`, `package.json`, `build-app.mjs`, `gas.mjs`.

---

## 9. The judges' thirty findings — disposition

Two judges reviewed `docs/CONSOLE.md` and this file (2026-10-09). Every
finding was re-checked in this container before deciding; the measurements
that decided the contested ones: the build's host-scan regex
`/https?:\/\/[a-z0-9.-]+\.(?:org|com|io|xyz|net)\b/i` returns `true` on
`document.createElementNS("http://www.w3.org/2000/svg","rect")` and `false`
on the `web3://` and `https://<gateway>/` shapes; terser with the build's
exact options (`compress:{passes:2}`, `mangle:{toplevel:true}`) keeps
`function o(){return 2}` unreferenced at top level and drops it only with
`compress.toplevel:true`; `node_modules/jsqr` does not exist and
`node_modules` is a symlink into `/home/user/Special/node_modules`;
`tools/selftest.mjs` pulls exactly 23 names and exports `TO =
"/*── end of the chain half ──*/"`; `locked` is a baked token key in
`TPL_TOKEN` (so `[data-fact=locked]` has backing); `IPremises.ENGINE()`
exists (`Site.sol:106`); `hub.isCanonicalAccount(address,uint256,bool)`
takes the id (`IIntact.sol:213`); `Premises._moved` writes a root-relative
`Location`.

### Rejected findings

None. Every finding was accepted and applied to both documents. Three were
applied in a form stronger than the fix proposed, because the proposed fix
left a smaller version of the same hole:

- **Finding 1 (panels reach the provider).** The fix kept "pure functions
  on `INTACT.lib`". Applied: `INTACT.lib` never exists; block 1 publishes
  to a one-shot `$lib` that block 2's first statement copies and deletes,
  and the pure helpers reach a panel only through the `INTACT.ui` members
  CONSOLE §5 names. Evidence: a second object with its own name is a
  second surface the suite would have to enumerate; one surface is one
  assertion (G′3).
- **Finding 13 (block 1's free globals).** The fix listed the cross-block
  references. Applied: the transport half leaves block 1 altogether and
  is rewritten in block 2, where `$`, `say`, `el` live; block 1 is the
  chain half and the publish statement only. Evidence: the slice may
  reference nothing but `S.*` (selftest's prelude stubs prove it), so a
  block 1 with no DOM code has no cross-block reference to list.
- **Finding 26 (colliding `[data-act]` names).** The fix offered "rename or
  scope". Applied: both — every group selector is lane-scoped, and the two
  outright collisions are renamed (`lockRelease`, `launchCollect`), so an
  unscoped `[data-act=release]` in a future test cannot pass by accident.

Two were applied with a correction to the fix itself:

- **Finding 22 (Q8 pixel scale).** The fix said "rasterise at ≥ 4 px per
  module"; Node has no canvas, so the harness rasterises the module map
  into a grey `Uint8ClampedArray` itself (`jsQR(data, 180, 180)`).
- **Finding 23 (G7).** The fix offered a `W.beforeCall` hook or landing the
  sale between the estimate and the click; the latter is taken and
  `W.beforeSend` is removed from the shim (§6.2) so no test can be written
  against a hook that fires too late.

One cut rule was struck by a finding rather than added: §3's former cut 3
("move `simulate`/`walkLogs` into the panels") contradicts finding 1 — a
panel holds no provider — and is replaced.

### Where each finding landed

| # | Finding | CONSOLE.md | BLUEPRINT.md |
|---|---|---|---|
| 1 | panels can send through `INTACT.lib`/`request` | §4 preamble, §5 `request` allowlist, `sealSignature`, §9 | §2 intro, §2.1 publish, §2.2 steps 1/6/6a, G′3 |
| 2 | footer reads another chain's Engine | §8 | §2.2.11, B14, N7 |
| 3 | chain gate is boot-order, not a primitive property | §2 "a property of the primitives" | §2.2.4, N12 |
| 4 | `#switch` in the viewer | §1, §2, §6.1 | §2 layout, §2.2.2/4, B14 |
| 5 | `createElementNS` literal fails the host scan | §10, §13 | §0 shell agent (i), §2.2.9, B3 |
| 6 | unlimited approve wrapped in `execute*` | §4.1 | §2.2.6a, §5.4, G′4, F10b |
| 7 | `Date.now` pin hides a cheat; `clock()` failure | §12 | §6.2 clock note, H5, J8, X4 |
| 8 | footer anchors on `S.engine` alone | §8 | §2.2.11, V3, V6, V7 |
| 9 | root-relative fetch/navigate | §10 | §2.2.1/7/10, R11, §8 (U8 note) |
| 10 | late announcer auto-selects | §2 "the instant" | §2.2.3, N5 |
| 11 | `rights()` collapses zero and no answer | §3, §5 | §2.2.5, N13 |
| 12 | raw-`data` rows not checked against bytes | §4.1, §4.2, §5 `propose` | §2.2.6a, F15, G′5 |
| 13 | block 1's free globals; no panel top-level gate | §5 | §2 intro, §2.1, §0 shell agent (ii) |
| 14 | G9 clicks nothing; delegate rule not in `propose` | §3 "propose enforces the gate" | G9 |
| 15 | `market` sub-object; whispers header | §6.3 | §5.2 |
| 16 | the seal sentence is key material | §9 | §5.2, I16 |
| 17 | session mode leaks holder bits | §3, §11 | §2.2.5/12, Z9 |
| 18 | six groups share one chain | §15 | §6.1, §6.3 |
| 19 | `act` has no name; `needBits 0`; missing members | §5 table | §2.2.6, §4 |
| 20 | `data()`'s reach; hand-laid rows | §4.2, §5 `data` | §2.2.6a, §4, X3 |
| 21 | byte budget reserve; cut rule 6 | — | §3, §0 shell agent (iii) |
| 22 | QR >106 B; Q8 scale; who installs jsqr | §13 | §0 integration, §1.11, §2.2.9, Q8 |
| 23 | M5/G7/D11–D12 unrealisable | — | M5, G7, D11, D12, §6.2, §6.3 `delegated` |
| 24 | harness shapes unpinned | §15 | §6.1, §6.2 |
| 25 | ownership of package.json/jsqr; §6.2 concurrency | preamble, §6 | §0, §1.8, §1.11, §8 |
| 26 | element overlaps | §6, §6.1, §6.2, §7 | §4, §5.3–5.5, J12, J15, L9 |
| 27 | whispers reserved names; "dropped at inline time" | §5 | §5.2 |
| 28 | canonical refusal needs the id | §7 | §5.4, T1 |
| 29 | D19 "verbatim" wording; the 23 names | — | §2.1, §8 |
| 30 | `simulate` shape; one revert spelling | §4.3, §5 `simulate` | §2.2.6a |
