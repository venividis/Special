<!-- Working document from the U9 design phase (2026-10-08), kept so the panel work can resume. docs/CONSOLE.md is the contract and wins wherever the two disagree; D1–D6, D10–D15, D17 and D18 were executed in the prep and shell commits (see docs/CHECKPOINT.md). -->

# G — decisions for INTACT U9 (taken by the unit lead after reading A–F)

Every agent on U9 reads this file first. Where it disagrees with a reader
report, this file wins; where it is silent, F-critique.md §6 ("what the
reports got right") stands and need not be re-derived. The repo's own
docs (BUILD-PLAN.md §U9, DESIGN.md §1, §2, §5, docs/INTERFACE-CHANGES.md)
remain the spec; the items below resolve what they left open.

Worktree: `/home/user/wt/U9` (branch `unit/U9`, from `main` at 5aa323b).
Nothing is written under `/home/user/Special` or `/home/user/wt/U10`.

## D1 · The shadowed Catalog keys — rename the TOKEN-level keys
`CatalogState.TPL_TOKEN` in `src/Catalog.sol` reuses four keys that
`TPL_WORLD` uses for addresses. Rename the token-level ones:
`market`→`ownedMarket` (the 16-field market object), `locks`→`reachLocks`
(the `Locks.lockCountOf(reach)` count), `steward`→`stewardStatus`
(`wouldPass` code), `roles`→`roleCount`. The world-level `market`, `locks`,
`steward`, `roles` stay the ADDRESSES. Update `tools/verify.mjs` (lines
≈188–193 read `S.market.open`, `S.locks === 0`, `S.steward === 0`) and
`tools/fixtures/app-placeholder.html` (reads `S.market`). `CATALOG_HASH`
moves; nothing is deployed, so that is acceptable. Note in
`docs/INTERFACE-CHANGES.md` under a new "U9" heading.

## D2 · Session enumeration — no contract change
The Reach (20,821 B against the 21,000 B valve, frozen `IReach`) gains no
list. Vault › Sessions: (i) a key field that inspects any pasted key with
`reach.sessionOf`, `reach.sessionExposure`, `reach.sessionAllows`; (ii) a
"walk the grant log" action: `eth_getLogs({address: INTACT.reach, topics:
[INTACT.topics.sessionGranted], fromBlock: "0x0", toBlock: "latest"})`,
each found key confirmed live with `hub.rightsOf(id, key)` bit SESSION
(128); on an endpoint that refuses the range the lane prints "the grant
log could not be walked on this endpoint" — never 0. Panic lists the
CATEGORIES it revokes always, and the session count only when the walk
succeeded ("sessions: 2" vs "sessions: not counted"). Zero and no-answer
stay different facts.

## D3 · The self-hash footer — the one-line loader change
`src/Renderer.sol` `INFLATE`: add `window.INTACT.$doc=t;` immediately
before `document.open();` (a property assignment on the existing object —
no global binding, so `tools/build-app.mjs` `checkLoader()` and
`tools/verify.mjs` "declares nothing at all in global scope" still hold;
re-run both plus `node tools/forge.mjs --match Premises`). The shell, after
first paint (idle callback / setTimeout 0), keccaks `INTACT.$doc`, compares
with the baked `INTACT.engineHash` (self-consistency: the loader inflated
what the state block names) and, when a provider exists, with a LIVE
`eth_call` of `engine.engineHash()`; it prints "verified against chain at
block N" only after the live comparison succeeds, "self-consistent; chain
not reachable to verify" after the baked one alone, and "does not match
the engine hash" in red otherwise. Add the SERVICES row
`engineHash|G|engineHash()|r|d|keccak of the inflated shell;` to
`CatalogRows.SERVICES`. Delete `INTACT.$doc` after hashing.

## D4 · knownDelegates and trait keys
Add the SERVICES row `knownDelegates|Q|knownDelegates()|r|d|codehash of
0xef0100‖delegate for the 7702 check;`. The shell computes the two trait
keys with its own proven keccak (`khex("curve")`, `khex("name")`); no
Catalog `traits` object.

## D5 · Rows for the MVB screens; what is struck from the MVB panels
Add SERVICES rows (verify each signature against the compiled ABI — the
drift gate in `tools/verify.mjs` fails the build on a row no contract
serves; read the contracts for the exact names):
`launchpad.graduationTargetOf(uint256)`, `launchpad.boughtInWindow(...)`,
`launchpad.lastLaunchAt(...)`, `launchpad.firstLaunchApproved(...)`,
`postage.stampOf(uint256)`, `reach.pieces()`, `steward.heirHashOfToken(...)`
— only those that exist as public functions; where the name differs use
the real one; where none exists, drop the control and say so in the lane.
Struck from the MVB panels (no rows, no controls): Parley steward tools
(`evict`, `setCooldown`, `hide`), `revokeEncryptionKey`, Reach
`guardNFT`/`unguardNFT`, reactions (ERC-7409 — the Social lane prints
"reactions unavailable on this chain" everywhere in the MVB). Record the
struck list in `docs/CONSOLE.md` under "Not in the MVB".

## D6 · Error argument shapes — serve the full signature
`CatalogText._renderErrors` emits `"0x…":"Slippage(uint256,uint256)"` (the
whole signature, not cut at `(`). The name is the prefix before `(`; the
argument list is what the slab decodes a revert's data with. Update
`tools/verify.mjs` (`S.err[selOf("NotHolder()")] === "NotHolder"` becomes
`"NotHolder()"`; "every err entry names the error whose selector it is"
compares the prefix). `CATALOG_HASH` moves. Note in INTERFACE-CHANGES.

## D7 · The sealing key — one key per wallet
The P-256 scalar derives from `personal_sign("INTACT seal v1 · chain <c> ·
hub <hub>")` — chain and hub only, no token, no epoch. Epoch death comes
from `Parley.Binding{owner, epoch}` already; `bindKey(id)` binds the
wallet's registry key to each token the holder seals for. Fix DESIGN.md
§7.3's sentence in the same commit and say why in the commit body. The
social lane: re-read `parley.keyOf(to)` (and `hub.custodyEpoch(id)`)
inside the slab's go handler immediately before every send; refuse with a
sentence (never downgrade to plain text) when the key moved, when
`keyType` is not P-256 (3), or when `crypto.subtle` is undefined ("sealing
needs a secure origin"). Decrypting: trust `envelope.context`'s epoch and
key-version fields after the six fixed fields match (the context is the
AAD), so archives sealed under an earlier epoch still open.

## D8 · Which provider reads
Console mode with ≥ 2 EIP-6963 announcers and no remembered `rdns`: the
picker (page UI, not a wallet prompt) appears BEFORE the first `eth_call`;
every read and send then uses the chosen provider. One announcer: used,
no picker (DESIGN §5.4 "a picker whenever more than one announces").
`window.ethereum` only when none announce. `eth_requestAccounts` only on a
gesture and never in the opaque-origin viewer. Viewer mode reads through
`pv()` and never chooses. `eth_chainId` on the provider that will be used,
before any other read; mismatch → the switch button and no reads.
Remembered choice in `localStorage("intact.wallet")` inside try/catch.

## D9 · The QR
New code, ≤ 3 KB source: byte mode, version 5, ECC level L (106 B
capacity; the payload `web3://0x<40 hex>:<chainid>/token/<id>/live` is
≤ 72 chars), one fixed mask pattern (0), format bits computed, rendered as
inline SVG `<rect>`s with `shape-rendering="crispEdges"` and a 4-module
quiet zone, through DOM construction (`createElementNS`), never a string
of markup. Two uses: Home (viewer and console) and Vault › Grip (the Grip
address as `ethereum:0x…@<chainid>`). verify-site proves it: structural
assertions (three finders, timing rows, dark module, valid format BCH) AND
an independent decode — add `jsqr` as a devDependency for the test only if
`npm install --save-dev jsqr` succeeds in this container (pure JS, no
dependencies; it ships nothing); if it cannot install, recompute the RS
codewords independently in the test and pin the module map's keccak.

## D10 · One element vocabulary (write it before the shell)
`docs/CONSOLE.md` (seeded by U9; U12 finishes it) carries the contract
verify-site and U11 share. Slab: `#cbox` (backdrop, class `on` when open),
`#cslab` (body), `[data-go]`, `[data-no]`, and the seams `[data-to]`,
`[data-value]`, `[data-selector]`, `[data-calldata]`, `[data-digest]`,
`[data-engine]`, `[data-gas]`, `[data-sentence]` (the clear-signing
sentence). Shell: `body.dataset.mode` ∈ {viewer, console, session},
`body.dataset.rights` (the decimal bits, "" before connect),
`body.dataset.chain` ("ok" | "wrong" | "none"), `#lanes` nav with
`a[data-lane=<name>]`, `#lane-<name>` sections, `lane.dataset.loaded`,
`#tick` ticker, `#chips` with `.chip[data-bit=<name>][data-state=
reported|absent|unread]`, `#facts` with `[data-fact=<key>]`, `#verified`,
`#qr`, `#link-web3`, `#link-https`, `#picker` with `button[data-rdns]`,
`#connect`. Panels add their own ids prefixed by lane (`#swap-in`,
`#social-composer`, `#launch-tax`, `#vault-panic`, `#identity-status`…) and
list them in CONSOLE.md's table.

## D11 · The clock
Deadlines (`swap*`'s `uint64 deadline`, `whisperStamped`, `buy`'s
deadline) = `eth_getBlockByNumber("latest", false).timestamp + 900` when a
provider exists; `INTACT.time` for the first paint; `Date.now()` only to
animate a countdown between reads. The verify-site shim answers
`eth_getBlockByNumber` from the chain and pins `Date.now` to it.

## D12 · selftest
`tools/selftest.mjs` reads `engine/app.html`; FROM marker `/*── keccak-256`
unchanged; TO marker a new explicit comment line `/*── end of the chain
half ──*/` placed in app.html right after `agrees()`; the prelude's `S`
stub uses INTACT keys (`id`, `hub`, `chainId`, `reachImpl`, `gripImpl`);
drop the five IPSEITY section-word assertions (55 → 50 chain vectors,
"unchanged" means these 50); add the ERC-6551 hard vector: stub
`{id:7, hub:0x1234567890AbcdEF1234567890aBcdef12345678, chainId:1,
reachImpl:0x0}` → Reach `0x6aFB0ef97eB85b6742326c7372421a166C5dac1a`
(A computed it two independent ways; CONFIRM it a third way with
`AccountBinding.predict` before pinning), and pin the same vector in one
`.t.sol` test (`test/Fingerprint.t.sol` or a new `test/Binding.t.sol`:
`test_theShellsSixFiveFiveOneDerivationIsTheContracts`). Record the slice
keccak and the vector in `docs/INVARIANTS.md` F3.

## D13 · Session mode (`?as=<key>`)
The shell parses `?as=0x…`: `body.dataset.mode = "session"`, a Home that
prints "this page acts as key 0x… for #id", `reach.sessionOf(key)`,
`reach.sessionExposure(key)`, the SESSION bit of `rightsOf(id, key)`, and
HIDES every holder control; a connected wallet whose account ≠ key is
refused with a sentence. No `executeAsSession` composer until U17 (the
agent lane stub says so). The viewer never enters session mode.

## D14 · Hosts and names
No URL of any kind in any document: no `rpc`, no explorer, no gateway
host. The viewer prints the `web3://` link, the QR, and a TEMPLATE twin
`https://<gateway>/<premises>:<chainid>/token/<id>/live` with the
placeholder visible; on a real origin the twin is `location.origin +
location.pathname`. A names-only chain table in the shell:
`{1:"Ethereum", 10:"OP Mainnet", 8453:"Base", 84532:"Base Sepolia",
11155111:"Sepolia", 31337:"local"}`. `wallet_switchEthereumChain` only
(never `wallet_addEthereumChain` with `rpcUrls`). verify-site asserts: no
`rpc` key anywhere, no `fetch(` outside the panel loader and the `/hash`
check, no `https?://[a-z0-9.-]+\.(org|com|io|xyz|net)` (the build's own
scan), `wss?://` absent.

## D15 · Harness additions (additive, `tools/evm.mjs`, U0's file)
`Chain.send()` returns `hash` (keccak of the signed tx bytes, hex);
`Chain.simulate(to, data, {from, value})` runs the call under
`journal.checkpoint()/revert()` and returns `{ok, data, gas}` with the FULL
revert data (so `Slippage(uint256,uint256)` and `QuoteResult(...)` reach
the page whole). Existing behaviour of `call`/`read`/`exec` unchanged.
State the ownership in the commit body.

## D16 · Size and gas gates
`tools/build-app.mjs` `SHELL_GZIP_CEILING` 18,000 → 15,000 with a header
note citing E's measurement (tokenURI ≈ 3.44 M + 262 gas per gzip byte,
over 8 M at ≈ 17.4 KB; `/hash` over 2.5 M cold at ≈ 16.5 KB). Shell
budget ≤ 14,000 B gzip; verify-site prints the gzip size beside the
tokenURI and `/live` gas. `tools/gas.mjs` sends a one-wei transaction
between route probes so every route is measured COLD (a header note
records the warm/cold difference ≈ 0.19 M).

## D17 · `npm run check`
Order (DESIGN §13): `compile && facets && selftest && build &&
forge:monolith && forge:diamond && gas && gas:selftest && verify &&
verify:site && static-audit`. `package.json` is U0's file; say so in the
commit body. Add `"verify:site": "node tools/verify-site.mjs"` (the alias
already exists; keep it).

## D18 · CSS and the module
`engine/app.css` is inlined by `tools/build-app.mjs` at the single marker
`<link rel="stylesheet" href="app.css">` in `engine/app.html` (replaced by
`<style>…</style>` before the minifier and the FORBIDDEN checks; hard
error if the marker or the file is missing, or if the marker appears
twice). `engine/whispers.mjs` is inlined into `engine/panels/social.js`
at the marker line `/*@inline engine/whispers.mjs*/` with every `export `
keyword stripped (hard error if the marker is missing or the stripped text
fails `new vm.Script`). The placeholder fixtures keep working (no marker →
no inlining).

## D19 · Other rules settled by the critique (apply, do not re-open)
- The sniper fee is set only inside the "open your market" form; after
  opening it is a fact with a countdown (F §1.7).
- The verbatim unit of the wallet library is the donor WORKING TREE
  `/home/user/Most-Advanced-NFT-Possible/engine/ipseity.html` lines
  1858–2394 (24,407 B), not the branch (F §1.1). "Verbatim" means the
  selftest slice (`/*── keccak-256` … `agrees()`) is byte-identical except
  the two salt lines and `S.collection → S.hub`; the transport/UI half is
  edited per A §3 (no RPC fallback, no `rpcUrls`, `eth_chainId` first,
  `eth_requestAccounts` only on a gesture and never when SANDBOXED, the
  slab built by DOM not innerHTML, `gwei` without floats or dropped).
- `INTACT.sel` keys are `"<word>.<name>"` (`"hub.rightsOf"`); the shell
  recomputes `selector(sig)` for every row it uses and refuses on a
  disagreement with the baked value (F §1.3).
- The custody-epoch re-read lives in the shell's slab go handler, so no
  panel can forget it; the social lane adds its `keyOf` re-read there
  (F §1.15). A reverted send is learned from the receipt, never from
  `eth_sendTransaction` throwing (F §1.9).
- `heads()` returns head BLOCKS; counts come from `stateOf(room)` word 1.
- `swapExactOut` with an ERC-20 input: offer exact-in by default; after an
  exact-out receipt read `allowance` and offer `approve(spender, 0)`.
- `kiln.coinAt` is called with `by` = the actual sender (wallet or Reach).
- Postage: ERC-20 postage is pulled from the sender token's REACH; the
  slab says which hand pays.
- Panels are IIFEs with zero top-level declarations; everything shared
  hangs off `window.INTACT` (`INTACT.ui`, `INTACT.chain`, …) because
  terser mangles each `<script>` block's top level separately (E §3.4).
- `NET.ro` → "provider present, no account requested"; `NET.dead` = none.

## D20 · File layout for verify-site (so five panel agents do not collide)
`tools/verify-site.mjs` — the runner: compile, deploySite, mint the cast
of tokens/actors, build the shim, boot a document, then run every group
and print the one `N passed, M failed` line (≥ 150 assertions total).
`tools/dom-shim.mjs` — the DOM + wallet shim (reused by U11), exporting
`boot(html, {provider, opaque, hash, query})`, `walletFor(chain, actor,
opts)`, `nap`, `click`, `fill`, `textOf`, `prompts()`.
`tools/verify-site/<group>.mjs` — one file per group, each exporting
`async function run(t, ctx)` where `t = {ok, eq, head, refuses}` and `ctx`
carries the chain, the site, the actors, `GET`, `bootToken(id, opts)`.
Groups: `boot.mjs` (viewer, console, session, discovery, loader,
escaping, collection page `/` incl. mint-from-the-page), `swap.mjs`,
`social.mjs`, `launch.mjs`, `vault.mjs`, `identity.mjs`. A panel agent
owns exactly `engine/panels/<name>.js` and `tools/verify-site/<name>.mjs`.
`node tools/verify-site.mjs --group swap` runs one group.
