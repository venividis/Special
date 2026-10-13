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
verify → verify:site → verify:pool → verify:vault → verify:parley →
verify:launch → verify:steward → verify:timelock → verify:premises → fuzz →
verify:findings → agents → static-audit (+ selftest) → verify:recover →
verify:console → invariants. Every step must print EXACTLY ONE summary line
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
  and on a shell over 15,000 B gzip or a panel over 8,192 B.
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
  the custodian, `I` the nameplate); the text layer serves both as one
  `sel` map and one `services` array, and the drift gate in
  `tools/verify.mjs` holds a row to its contract's interface until the
  contract lands, then to both.
- **The shell is 45 B under its gzip ceiling** (14,955 of 15,000) and the
  vault panel 26 B under its own; any fix to either pays in cuts first.
- **The monolith is over EIP-170** (25,402 B); the diamond ships. Both
  builds are compiled and tested on every run; the harness deploys with the
  size limit lifted, so the gate is `compile.mjs`, not the test runner.
- **A mutated `src/` poisons every compile in the tree.** `tools/mutations.mjs`
  writes over `src/Parley.sol`/`src/Postage.sol` and restores them in a
  `finally` and on SIGINT; run nothing else that compiles in that checkout
  while it runs, or run it in a copy (see below).
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
