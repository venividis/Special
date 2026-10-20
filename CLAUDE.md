# Working in this repository

INTACT is one ERC-721 that is a website, a swap, a social layer, a launchpad
and a vault, entirely on chain. `DESIGN.md` and `BUILD-PLAN.md` are the
specification; `docs/CHECKPOINT.md` says what is built and how to resume;
`docs/INVARIANTS.md` is the ledger of claims and the test that attacks each.
This file is what an agent working here must know before touching anything.

## The toolchain

Node 22 and solc-js 0.8.36 (viaIR, optimizer 800, cancun, `bytecodeHash:
"none"`). No Foundry binary, no external Solidity dependency, no RPC in any
document.

```sh
npm install
npm run compile                       # tools/compile.mjs: every contract under EIP-170; the ship rule (--ship)
npm run forge                         # tools/forge.mjs: test/*.t.sol on @ethereumjs/vm with a cheatcode precompile
node tools/forge.mjs --match Parley   # one suite (or one test, or one file) while iterating
INTACT_IMPL=diamond node tools/forge.mjs   # the suite on the other hub build (monolith is the default)
node tools/verify-site.mjs --group vault   # one console lane through the DOM shim, ≈ 30 s
npm run check                         # tools/check.mjs: the whole battery, DESIGN §13's order, ≈ 20–40 min on 4 cores
node tools/check.mjs --only verify:pool,invariants   # a PARTIAL run (never called green)
npm run mutations                     # tools/mutations.mjs: the E1/E3 mutation gate (not in check; minutes per mutation)
npm run drive                         # tools/testnet-drive.mjs: the console journey over a wire (hardhat on 8546, the gateway on 8081)
npm run testnet -- --chain 31337 --confirm DEPLOY_INTACT_LOCAL   # tools/testnet.mjs: the rehearsal over a wire (hardhat on 8547, the gateway on 8082); docs/DEPLOYMENT.md
npm run testnet -- --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA --fork https://sepolia.base.org   # the same against a fork of the chain (8548): the real venues, the v4 path, records under out/fork/
npm run verify:venues                 # tools/verify-venues.mjs: the venue table re-proved against the chains (RPC_URL_<id>)
```

The first viaIR compile of `src/` takes about three minutes; `src/` plus
`test/` about twenty. `out/compile-cache/` is keyed by the exact compiler
input, so a run that changes no Solidity is fast and a run that changes one
character recompiles everything. Compile once; iterate with `--match` and
single verifiers. Four cores are shared.

## `npm run check` and the rule that incomplete ≠ pass

`tools/check.mjs` runs every step as a child process in this order: compile
(the EIP-170 gate and the ship rule) → facets (+ selftest) → selftest →
build → forge on the monolith → forge on the diamond → gas (+ selftest) →
verify → verify:site → mcp → verify:pool → verify:vault → verify:parley →
verify:launch → verify:steward → verify:timelock → verify:premises →
verify:plate → V2's verify:keepsake → verify:journal → verify:bazaar →
verify:studio → verify:agora → fuzz → verify:findings → agents →
static-audit (+ selftest) → verify:recover → verify:console → invariants
(33 steps; `node tools/check.mjs --list`). `verify:bazaar-fork` is not a
step: it forks Base Sepolia over the network. Every step must print EXACTLY ONE summary line
of the shape that tool prints (`node tools/check.mjs --list` shows the
regex per step) reporting zero failures; a non-zero exit, no summary, two
summaries, M > 0, or a step file that does not exist fails the run. The
default stops at the first failure; `--keep-going` runs everything and
prints the whole table. A run that skips a step is PARTIAL and is never
reported as green.

## Every verifier obeys one contract

- The last line is `  N passed, M failed` (two leading spaces), exit 1 on
  any failure. `tools/fuzz.mjs` prints `N properties held, M broken`; the
  five tools with a summary of their own (`compile`, `facets`, `gas`,
  `build-app`, `static-audit`) are read by their own line in `check.mjs`.
- Every assertion is a sentence — `test_aRenterCannotSpeak`, *"a tampered
  panel is refused"* — and `docs/INVARIANTS.md` cites the file and the
  sentence. `tools/invariants-check.mjs` fails when a cited sentence does
  not exist verbatim in the cited file (whitespace collapsed; a sentence
  built as a template literal counts, with only the `${…}` holes differing).
  So: never rename an assertion without grepping INVARIANTS and DESIGN §14.
- `tools/verify-findings.mjs` replays every historical finding: the attack
  is performed and the refusal asserted; `refuted on HEAD`, or `reproduced`
  against a COPY of the source with one guard removed and compiled
  separately. Never fake a reproduction; a donor claim with no counterpart
  is an `n/a` line.
- `tools/agents.mjs` runs seven motives for 220 ticks (`--ticks`, `--seed`;
  the seed is printed) and asserts the system invariants after every tick.

## Documents

Counts and gas numbers are written to a document only after a run, from
that run's output, and the sentence says which run. "Budget" marks a
target; "measured" marks a number from a run. `docs/CHECKPOINT.md` is
rewritten at the end of a session; `docs/INVARIANTS.md` rows are **live**
only once their test runs in `npm run check` and has been seen to fail
under a one-character mutation, **pending** otherwise, naming the unit.

## Ownership

Units own disjoint files (BUILD-PLAN's wave table). A unit that needs a
change in another unit's file writes the request into its report and does
not edit the file. Panel agents never edit `docs/CONSOLE.md` or
`docs/INVARIANTS.md`; element ids go in the panel's header comment and the
integration step copies them. Interfaces under `src/interfaces/` are frozen
after wave 0: a change is additive only and goes in
`docs/INTERFACE-CHANGES.md` with a rerun of every wave-1 suite.

## Rules the build and the audit enforce

- `tools/static-audit.mjs` fails on `tx.origin`, `selfdestruct`,
  Solidity-level `delegatecall`, raw `sstore`, the EOA-only idioms, string
  reverts and any import from outside `src/`; and, under `engine/`, `sdk/`
  and `tools/`, on `eval(`, `new Function`, the `(1n<<256n)-1n` mask and
  `innerHTML =`. Write the rule's text in pieces if a comment must name the
  pattern (the audit strips comments, but a literal in code trips it).
- `tools/build-app.mjs` fails on a loader that declares a global, on
  `src="https://`, on any host string (`https?://…\.(org|com|io|xyz|net)`,
  `wss?://`) in `dist/` — the SVG namespace literal is the one exception —
  and on a shell over 24,000 B gzip or a panel over 12,288 B (V2's budgets,
  docs/V2.md §2; V1 shipped at 15,000 and 8,192).
- Amounts are `BigInt` end to end; the console never builds an approval of
  2^255 or more, in an outer call or inside `execute`/`executeBatch`/
  `executeTyped`; chain strings reach the DOM through `textContent` only;
  every deadline is the chain's clock (`eth_getBlockByNumber`), never
  `Date.now()`.
- No AI model is named in code or documents.

## Traps, each with its reason

- **Loader globals.** terser mangles each `<script>` block's top level
  separately, so a top-level `const` in a panel collides with a one-letter
  name in the shell and the panel never runs. Panels declare nothing at top
  level (one IIFE); the build refuses otherwise.
- **`document.open()` erases EIP-1193/6963 listeners.** The HTML "document
  open steps" drop every listener on the Window, so a wallet's
  `requestProvider` listener registered at injection never fires after the
  loader rewrites the document. The loader dispatches
  `eip6963:requestProvider` and captures the announcements BEFORE
  `document.open()`, leaving them on `window.INTACT.$wallets`.
- **`try` alone on a codeless address reverts.** Solidity inserts an
  `extcodesize` check before a call that returns data, and it reverts before
  the call, so `catch` never sees it. Every satellite read is `extcodesize`
  AND a low-level `staticcall`; an absent contract reads as "no answer",
  never as a revert and never as 0.
- **`metadata.bytecodeHash: "none"`.** Every codehash this protocol pins
  (facets, venues, the Reach implementation in `/manifest`, the forwarder)
  must be reproducible from a checkout; an IPFS hash of metadata that embeds
  absolute source paths is not.
- **Permit2 expiry 0.** Permit2's `approve(token, spender, amount, expiration)`
  reads `expiration == 0` as "expires at this block", not "never" (the
  Pixel-Garden lesson); any code that writes a Permit2 approval — U14's
  custodian seeding a v4 position — normalises 0 to a real time. The Reach's
  ledger records the Permit2 shape by its own selector (`0x87517c45`) and
  the seal refuses it on a promised asset by deny-by-default: a six-selector
  blocklist once missed exactly this word.
- **Ids come from the `Transfer` log, never a read after the write.** A
  public RPC's replica can lag the receipt; `mint` returns the id from the
  receipt's log (tools/site.mjs `mint`), and the deployer waits for code
  before a constructor inspects a fresh deployment.
- **Every read over the wire is pinned to a block.** A load-balanced public
  endpoint answers each request from whichever replica the balancer picks,
  and a replica a block behind answers a read at `latest` from before the
  receipt: the first Base Sepolia rehearsal (2026-10-13) lost its campaign
  at the exact-in swap — the swap landed, `balanceOf` read 0. `RpcChain`
  (tools/rpc.mjs) pins every `eth_call`, `eth_getBalance`, `eth_getCode`
  and `eth_estimateGas` to the highest of the receipts' blocks and the
  latest block the endpoint reports (`tag()`, shared by every `as()` key),
  and `call` retries "header not found" for up to a minute as lag, never as
  an answer. A campaign that stops keeps its key for `--resume`.
- **A hardhat fork runs nothing at the fork block.** Executing at the
  forked block itself needs the forked chain's hardfork history, which
  the node is not given (`chains` in a config did not take, hardhat
  2.29.1), so `tools/testnet.mjs --fork` mines one local block before it
  reads anything; from a local block the node's own rules (cancun) apply.
  The forked endpoint must keep that block's state for the whole run, and
  some public ones do not.
- **The venue table is evidence, not memory.** A `VENUES` row is filled
  only from a source that names the addresses (Uniswap's deployment feed)
  and only after a probe; it carries the probe (`probed`: date, block,
  codehashes) and `checkVenues` re-proves it before every deploy over a
  wire. A row whose code moved refuses the deploy by name; re-probe it in
  a dated commit, never edit a hash to match.
- **hardhat must run cancun.** Left to default it runs Osaka, where
  EIP-7825 caps a transaction at 2^24 gas and applies that cap to
  `eth_call` too, so `tokenURI` fails with a bare revert while every
  transaction lands. `hardhat.config.cjs` pins `hardfork: "cancun"`.
- **`CatalogRows.SERVICES` is at 89 % of the transaction cap.** Rendering
  and storing the MVB table costs 14.94 M gas of the 16.78 M a Fusaka
  chain admits per transaction (EIP-7825); a row appended there could make
  the deployment un-includable. Post-MVB rows go in
  `CatalogRowsPost.SERVICES` — the second table, its own transaction —
  under their own letters (`M` market, `D` roles, `A` the agent card, `U`
  the custodian, `I` the nameplate). V2's rows go in a third table,
  `CatalogRowsV2.SERVICES`, again its own transaction, under `V` keepsake,
  `J` journal, `B` bazaar, `b` bridges, `Z` studio, `c` a collection, `F`
  agora, `s` Seaport and `e` any ERC-721. Seaport is a venue, so its rows
  carry the venue row's address, or zero. Any ERC-721's rows carry zero,
  as a coin's do. The three tables' construction measured 14.53 M, 4.95 M
  and 8.19 M gas: the third holds 71 rows since W15, 48.8 % of the cap.
  Every capital letter is a contract now; a new family takes a lower case
  beside what it resembles. The text layer serves all three as one `sel` map
  and one `services` array, and the drift gate in `tools/verify.mjs`
  holds a row to its contract's interface until the contract lands, then
  to both.
- **`/services.json` is at 89 % of its 1 M cap** (890,502 gas for
  86,816 B, in both shapes; `tools/gas.mjs` after W15). Every row the
  Catalog adds makes it dearer, at about 13 gas per rendered byte, and a
  tuple signature is rendered twice, in `sig` and in `args`. It is the
  view the next rows meet first.
- **The burner may land V2 itself.** `tools/deploy.mjs --v2` lands V2's
  seven right after the Premises in a fresh deployment. A journal that
  holds a V2 step resumes as a `--v2` run, with or without the flag, or a
  resume would record a placeholder that has code. `--v2` beside
  `--satellite` is refused.
- **Two forks never share a port.** `tools/testnet.mjs` takes `--port` and
  `--gateway-port`, and `tools/verify-bazaar-fork.mjs` spawns on 8549
  too: run one fork at a time, or move the other.
- **The fingerprint has two V2 terms, appended after `planHash`.** They
  are `Keepsake.commitmentOf(account(id))` and `Journal.rootOf(hub, id)`,
  read through the hub's `KEEPSAKE`/`JOURNAL` pins, guarded like every
  other term. `residueOf(id)` hashes the fourteen terms a sale leaves
  standing; the Bazaar's zone compares it after a fill's transfers, so a
  seller paid inside a fill cannot move the token's state. Records are at
  schema 3, and the V2 pins skip an older record.
- **The shell is 1,600 B under its gzip ceiling** (22,400 of 24,000,
  measured on the merged head after W14, a0a6c7f). Of the panels' 12,288
  each, launch and gallery are at 12,233 (55 B under), vault 12,217, social
  12,114, swap 11,650, identity 8,350 and agent 4,883. Any fix to launch,
  gallery or vault pays in cuts first. In a panel that repeats `function(`
  as V1's do, an arrow function costs more gzip than `function` (W12).
  The shell's ceiling follows the gas caps: at a padded 24,000 B,
  `/token/1/hash` reads 2.333 M of its 2.5 M (29.4 gas per gzip byte,
  INVARIANTS F2), so the hash route is the first cap a bigger shell meets.
- **The soul runs in the battery.** The battery's Chromium has WebGL
  through SwiftShader, so the shader starts on every page. Naming the
  software rasteriser is what keeps the battery's CPU flat: one still at
  0.25×, no timed frame, no `html.alive`. Time any shader change on a real
  GPU as well.
- **Nothing loops without `html.alive`.** An endless CSS animation keeps
  this Chromium's compositor at about 80 % of a core for as long as a page
  is open (measured, docs/v2/W7-shell.md decision 9). Any animation in the
  shell or a panel that never ends is paused unless `html.alive` is set,
  and `html.alive` is set only while the sky animates.
- **Home is outside `#lanes`.** Nothing added to the dock may be an
  `a[data-lane]` inside `#lanes` unless it is a lane; both suites count
  them.
- **The bars are fixed over the page.** html's `scroll-padding` keeps the
  body's clearance; if the crest bar or the dock grows, both numbers move
  together, or focus lands under them again (WCAG 2.2 2.4.11).
- **The monolith is over EIP-170** (26,082 B with V2's two terms and
  `residueOf`; 25,364 before them); the diamond ships. Both
  builds are compiled and tested on every run; the harness deploys with the
  size limit lifted, so the gate is `compile.mjs`, not the test runner.
- **A mutated `src/` poisons every compile in the tree.** `tools/mutations.mjs`
  writes over `src/Parley.sol`/`src/Postage.sol` and restores them in a
  `finally`, on SIGINT and on SIGTERM. A SIGKILL, or a container restart,
  restores nothing. Run nothing else that compiles in that checkout while
  it runs, or run it in a copy (see below). A scratch driver of your own
  restores on SIGTERM too, and proves the restore by sha256 (W17).
- **The compile cache is keyed by the whole input.** A one-character change
  anywhere under `src/` or `test/` is a full recompile; the forge runner's
  input (`src` + `test` + `lib/forge-std/src`) is the twenty-minute one.
- **The harness is not forge.** `tools/forge.mjs` runs the stated tests with
  a cheatcode precompile and a 3-byte-REVERT self-check that must burn gas;
  no invariant campaigns, no coverage, no traces. `expectRevert` matches
  an error name or any 4-byte selector of that name.
- **`expectRevert(bytes)` matches any revert in this runner**, and there is
  no `expectEmit` or log capture: an exact refusal (its selector and its
  arguments) is asserted through a raw call that returns the data, and an
  event through the state it changed (or a verifier reading
  `Chain.send().logs`), never through those two cheats.
- **A `view` call inside a pranked statement's arguments consumes the
  prank** (forge and this runner agree): compute keys before `vm.prank`.
- **`block.number` is read once per transaction by the optimiser**, so a
  test that straddles `vm.roll` reads its evidence from storage, not from
  `block.number`.
- **Yul evaluates a call's arguments right to left.** In
  `and(staticcall(…), gt(returndatasize(), 31))` the size is read BEFORE
  the call runs, so it measures the previous call. Bind the call to a
  variable first (`let ok := staticcall(…)`), then read `returndatasize()`.
  Keepsake's first draft paid nothing for every honest token this way, and
  its suite caught it (docs/v2/W1-keepsake.md).
- **Stop your own processes by PID, never `pkill -f`.** Units share four
  cores and one process table, so a pattern matches their runs too. One
  `pkill -f "tools/verify-site.mjs"` killed another unit's run (exit 143)
  on 2026-10-19.
- **The suites' waits throw.** The shim's `page.until`
  (tools/dom-shim.mjs, W13) and verify-console's `pg.until` (W14) throw an
  `UntilTimeout` naming the group, the lines that waited and the
  condition, and the group stops there. `{ soft: true }` keeps the old
  answer, for a wait whose answer the caller reads or a deliberate pause;
  each soft call says why. A wait raced against another promise must be
  soft: one that loses the race and throws later is an unhandled
  rejection. A `sign` after a transaction that moves the epoch or the
  wallet's rights (a panic, a buy, a sale) ends on "ownership or epoch
  changed — review again" (CONSOLE §4.7), so it passes `{ moved: true }`;
  in Chromium a sign that ends there without it throws, and every sign
  reads the ticker's log (`window.__ticks`), never one poll of its text
  (docs/v2/W13-waits.md, docs/v2/W14-polish.md).
- **A lane's style is the shell's.** A panel writes no `<style>` and no
  `style` attribute for a rule the shell can carry. The suites read a
  whole lane's `textContent`, and a stylesheet inside a lane reads as
  text. The shared rules live in `engine/app.css`: `button[role=switch]`,
  `.post` and `.qr` (W14, INVARIANTS F21).
- **jsqr decodes an inverted code.** A dark code on a dark ground still
  decodes, because jsqr also tries the inverted image. A test that wants
  a light ground reads the pixels or the computed background, never the
  decode alone (verify-console's `qrInPlace`).
- **solc kills a run on any unhandled rejection.**
  `node_modules/solc/soljson.js` registers
  `process.on("unhandledRejection", reason => { throw reason; })`, and every
  suite that compiles loads it. So a panel's unhandled rejection in the
  shim ends the run before its summary. A panel's promise chain ends in
  `.catch`; `.then(ok, err)` does not cover a throw inside `ok`.
- **A suite's own write while the page has a read in flight fails on its
  nonce.** The shim answers `eth_call` with `Chain.simulate`, which
  checkpoints the shared VM, and the suite's write reads its nonce outside
  that checkpoint: "the tx doesn't have the correct nonce". Wait for the
  page to go quiet (`quiet(page, W)` in the social group) before the suite
  writes.
- **The shim's clock moves 12 s on every `eth_sendTransaction`.** A paint
  after a receipt reads a newer clock than the one before it.
- **Chromium hides a closed `<details>` with `content-visibility`**, and its
  fields keep their client rects, so a box test calls them visible.
  verify-console's `visible()` asks `checkVisibility()` and walks the
  ancestors.
- **Playwright's service-worker block throws in a sandboxed frame.**
  `serviceWorkers: "block"` installs an init script that reads
  `navigator.serviceWorker` in every frame, and a frame sandboxed without
  `allow-same-origin` throws a SecurityError there. The error is the
  harness's: filter it by its text, as the gallery group does, and
  nothing else.

## The mutation gate (INVARIANTS E1/E3)

`tools/mutations.mjs` holds a table of one-character or one-token
mutations of `src/Parley.sol` and `src/Postage.sol`, each aimed at one
guard. For each it writes the mutated source over the real file, runs
`tools/forge.mjs --match Parley` and `--match Postage` (and `--match Bundle`
for the three rows about the custody epoch), records which named tests
failed, and restores the file; the run ends by proving `git status` is
clean for both. A mutation no test fails is a SURVIVOR and fails the gate.
Every mutation is a cold compile, so the gate is not in `npm run check`.
Run it in a copy of the tree so nothing else compiles against a mutated
source: `git clone --no-hardlinks <worktree> /tmp/mut && ln -s <worktree>/node_modules /tmp/mut/node_modules`.
A copy pruned to `src/{Parley,Postage,Roster,KeyRegistry}.sol`,
`src/interfaces`, `src/lib`, `test/{Parley,Postage}.t.sol` and
`test/mocks/{SocialHub,MockERC20,HostileToken}.sol` compiles in under two
minutes per mutation; run `--suites Parley,Postage` there and the three
`Bundle` rows (`--only P2,P13,Q6`) in a full copy. Quote the result in
INVARIANTS E1/E3 and in the commit body. On this tree the pruned gate reads
17 killed, 2 survived (P11: no test hides at `seq ≥ 128`; P13: no Parley or
Postage test buys a token back) — and P13 is killed in the full tree by
`test/Bundle.t.sol` (`test_aBuyBackRevivesNothingAnywhere`,
`test_panicRevokesAcrossEverySatellite`), so P11 is the gate's one survivor;
a survivor is a test request written into E1, never a reason to drop the row. A mutant must be Solidity: `bytes32(1)`
does not compile (`bytes32(uint256(1))` does), and the gate prints the
compiler's line when a row is not a mutation.

## Commits

A sentence as the subject; a body saying what was proved and the measured
counts of the run that proved it. Every message ends with the attribution
trailers the session carries. Do not push unless asked.
