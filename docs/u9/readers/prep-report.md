# U9 prep — what landed on `unit/U9` before the shell and the panels

Worktree `/home/user/wt/U9`, branch `unit/U9` (from `main` 5aa323b). Every
number below was measured in this container on 2026-10-09; the command is
named beside it. Nothing under `/home/user/Special` or `/home/user/wt/U10`
was written. `docs/CONSOLE.md` is untracked in the worktree and belongs to
another agent; it was not touched or committed.

## Files changed (owned by this unit of work)

| File | Change |
|---|---|
| `src/Catalog.sol` | D1 four token keys renamed in `TPL_TOKEN` (+ box comment); D5/D3/D4 nine SERVICES rows (+ note on the ASCII/separator rule and the struck list); D6 `_renderErrors` emits the whole signature (buffer `t.length*3+64`; doc comment rewritten) |
| `src/Renderer.sol` | D3 `window.INTACT.$doc=t;` before `document.open()`; the INFLATE doc comment gains the paragraph arguing it |
| `tools/evm.mjs` | D15 `send()` returns `hash`; new `simulate()`; header gains the two additions (U0's file, additive) |
| `tools/gas.mjs` | D16 one-wei tx between every two probes; header records the warm/cold difference; verdict line says "probed cold" |
| `tools/build-app.mjs` | D16 ceiling 15,000 with header note; D18 `inlineCss`, `inlineWhispers`, `CSS_MARKER`, `WHISPERS_MARKER` exported, wired before the refusals; `sources()` also returns `shellIsFixture` (U7's file, additive) |
| `tools/verify.mjs` | renamed keys, whole-signature err assertions, the `$doc` line, the nine rows, the struck list, the shadowing proof |
| `tools/selftest.mjs` | repointed at `engine/app.html`; FROM `/*── keccak-256`, TO the "end of the chain half" box comment; INTACT `S` stub; five section-word vectors dropped; Reach+Grip hard vectors added; prints the slice's byte count and keccak; exits 1 with "engine/app.html missing" (no ENOENT) |
| `tools/fixtures/app-placeholder.html` | reads `S.ownedMarket` |
| `test/Premises.t.sol` | the err pin becomes `"NotHolder()"`; nine more pins (Slippage whole, engine.engineHash, catalog.knownDelegates, the four renamed keys, locks/steward are addresses); `"reachLocks":0,` |
| `test/Binding.t.sol` | NEW: `test_theShellsSixFiveFiveOneDerivationIsTheContracts`, `test_theSaltsAreTheKeccaksTheShellHardcodes` |
| `docs/INTERFACE-CHANGES.md` | new "U9" section (the table above in prose, plus the toolchain shapes) |
| `docs/INVARIANTS.md` | F2 (cold, ceiling), F3 (`$doc`, Binding, selftest vector), F6 (159 rows, err/shadowing strings) — additive edits to a shared doc, said so in the commit body |
| `DESIGN.md` §7.3 | D7: the sealing sentence is `"INTACT seal v1 · chain <c> · hub <hub>"`, with the why |
| `package.json` | NOT edited: `"verify:site"` already exists; the `check` order is left for the integration agent (D17) |

## The 6551 vector — confirmed a third way

`AccountBinding.predict(address(0), REACH_SALT, 1, 0x1234567890AbcdEF1234567890aBcdef12345678, 7)`
= `0x6aFB0ef97eB85b6742326c7372421a166C5dac1a` — the contract agrees with
A's two derivations and with a Node recomputation over
`ethereum-cryptography`'s keccak (run before the test existed). The Grip of
the same stub is `0xc4392998811A83E714e2E443D5C1f3EC72C55E0A` (checksum as
solc spells it; my first guess at the mixed case was wrong and the compiler
corrected it). Salts: `REACH_SALT = keccak("intact.reach.v1") =
0x1d97c6e8ecf40bc45561209243f476bcf68c575ec575f9c181d13e8b8a5847ec`,
`GRIP_SALT = keccak("intact.grip.v1") =
0xfd337a35301ee4404b1253abd358da8011894832b313d6c3ab3f648f26da6be0`.
Both pinned in `test/Binding.t.sol` and `tools/selftest.mjs`
(`node tools/forge.mjs --match Binding` → 3 passed, 0 failed; the third is a
Parley test matched by substring).

## New SERVICES rows, each verified against the compiled ABI by the drift gate

Format `key` · `signature` · on. All nine are public functions; none of the
names the lead listed differed from the source.

| `INTACT.sel` key | signature | contract |
|---|---|---|
| `engine.engineHash` | `engineHash()` | Engine (`Site.sol:57`) |
| `catalog.knownDelegates` | `knownDelegates()` | Catalog |
| `launchpad.graduationTargetOf` | `graduationTargetOf(uint256)` | Launchpad (public mapping, `:156`) |
| `launchpad.boughtInWindow` | `boughtInWindow(uint256,address)` | Launchpad (public mapping, `:139`) |
| `launchpad.lastLaunchAt` | `lastLaunchAt(uint256)` | Launchpad (public mapping, `:144`) |
| `launchpad.firstLaunchApproved` | `firstLaunchApproved(uint256)` | Launchpad (`:210`) |
| `postage.stampOf` | `stampOf(uint256)` → `Stamp` | Postage (`:245`) |
| `reach.pieces` | `pieces()` → `(address,uint256)[]` | Reach (`:474`) |
| `steward.heirHashOfToken` | `heirHashOfToken(uint256,bytes32)` | Steward (`:336`) |

Did not exist / deliberately NOT added: nothing the lead named was missing
from the ABIs. Struck per D5 (no row): `parley.evict`, `parley.setCooldown`,
`parley.hide`, `keys.revokeEncryptionKey`, `reach.guardNFT`,
`reach.unguardNFT`, reactions. `tools/verify.mjs` asserts their absence
(*"no row for what the MVB struck …"*). Row count 150 → 159.

The `knownDelegates` note reads `keccak of the 23-byte 0xef0100 designation
per known 7702 delegate` rather than the brief's `0xef0100‖delegate`: a
Solidity string literal must be ASCII, and `|` is the row parser's field
separator.

## New state-block key names (token level; the world-level four are addresses)

`ownedMarket` (16-field market object or `null`), `reachLocks`
(`Locks.lockCountOf(reach)` or `null`), `stewardStatus` (`wouldPass` code or
`null`), `roleCount` (`liveRoleCount` or `null`). Measured in
`dist/state-1.json`: `market`/`locks`/`steward`/`roles` are now
`0x…` addresses; `ownedMarket={"open":false,…}`, `reachLocks=0`,
`stewardStatus=0`, `roleCount=null` (Roles not deployed on this band —
zero and no-answer stay different).

## New `err` value shape

`"0x<8 hex>":"<Name>(<types>)"` — e.g. `"0x2746152a":"Slippage(uint256,uint256)"`,
`"…":"NotHolder()"`, `"…":"QuoteResult(uint256,uint256,uint160)"`. The name
is the prefix before `(`; the argument list decodes a revert's data.
Identical object in `/services.json` `errors`. 211 entries; the rendered
table grew 5,851 → 7,144 bytes (+1,293), which is most of the state block's
growth (`dist/state-1.json` is now 17,919 bytes).

## evm.mjs additions — exact signatures

```js
// unchanged fields plus hash:
async send({ to = null, data = "0x", value = 0n, label = "", gasLimit = 400_000_000n, allowOverCap = false })
  → { gas: bigint, address: string|null, ret: hex, logs: Log[], hash: hex /* keccak of the signed tx, 32 bytes */ }

async simulate(to, data, { from, value = 0n, gasLimit = 3_000_000_000n } = {})
  → { ok: boolean, data: hex /* return value, or the FULL revert data */, gas: bigint /* executionGasUsed */, error: string|null }
// runs under vm.evm.journal.checkpoint() … revert(): never commits, never throws on a revert
```

Proved in this container: a contract reverting `Slippage(uint256,uint256)`
gives `simulate()` 68 bytes of data with the right selector while `call()`
still throws with the data cut at 138 hex characters; a 5-wei value
simulate leaves the recipient's balance at 0; `send().hash` is 66
characters.

## Gas — the warm/cold difference observed

Same deployment, placeholder shell (3,015 B gzip), a one-wei tx before the
first call, then the same call twice:

| call | cold | warm | diff |
|---|---|---|---|
| `hub.tokenURI(1)` | 4,342,557 | 4,148,057 | +194,500 |
| `/token/1/hash` | 1,623,201 | 1,432,701 | +190,500 |
| `/token/1/live` | 968,955 | 778,455 | +190,500 |
| `/token/1/state.json` | 770,948 | 595,948 | +175,000 |
| `/` | 574,414 | 490,414 | +84,000 |

`node tools/gas.mjs` before any change (warm, old contracts): tokenURI
4,089,259, `/hash` 1,410,544, `/live` 765,419. After (cold, new contracts):
4,342,557 / 1,623,201 / 968,955 — 75 probes, none over its cap. The
before→after delta mixes the cold measurement (≈ 0.19 M) with the state
block's growth (the err signatures, ≈ 1.3 KB; tokenURI +253,298 of which
≈ 194,500 is cold).

## Sizes (`node tools/compile.mjs`, size gate on)

Renderer 15,922 → 15,961 B; CatalogState 15,914 → 15,953 B (under 16,000;
the four longer key names); Catalog 13,945 (unchanged); CatalogText 4,864
(unchanged — the tables live in init code); CatalogRows 1,843; Premises
15,319; Engine 3,672. All under 24,576. `Intact` 25,402 as before (the
diamond ships).

## New CATALOG_HASH

`0x85a5340fa3b64fdab7d6b547a1d3c548058583fb90a513f44fc4ac20706e313e`
(`dist/state-1.json` after `node tools/verify.mjs`; equals
`keccak(/services.json)` — asserted). It moved because the error table and
the row table are inside `services()`; nothing is deployed.

## Commands run and their results

- `node tools/compile.mjs` — green, sizes above
- `node tools/build-app.mjs` — green from the placeholder; ceiling prints 15,000; inliner error paths exercised by hand (10 cases, all as specified)
- `node tools/forge.mjs --match Binding` — 3 passed, 0 failed
- `node tools/forge.mjs --match Premises` — 14 passed, 0 failed
- `node tools/verify.mjs` — 234 passed, 0 failed (was 217)
- `node tools/verify-premises.mjs` — 63 passed, 0 failed
- `node tools/gas.mjs` — 75 probed cold, none over
- `node tools/static-audit.mjs` — passed
- `node tools/selftest.mjs` — exits 1 with "engine/app.html missing — the shell has not landed" (by design; not in `check`)

## Left for others

- `package.json` `check` order (D17) — integration agent; `verify:site` alias already present.
- `docs/INVARIANTS.md` F3: the chain-half slice keccak is printed by `selftest.mjs` and is to be recorded when `engine/app.html` exists.
- `DESIGN.md` §5.1 still writes `err:{"0x…":"NotHolder",…}` in its state-block sketch; only §7.3 was in this unit's remit. INTERFACE-CHANGES.md carries the new shape.
- The shell must: keccak `INTACT.$doc` after first paint, compare with `INTACT.engineHash` and a live `sel["engine.engineHash"]` call, `delete INTACT.$doc`; place `/*── end of the chain half ──*/` right after `agrees()`; expose `account6551`, `grip6551`, `agrees` and the 24 selftest names at the slice's top level; read `S.ownedMarket`/`S.reachLocks`/`S.stewardStatus`/`S.roleCount`; decode reverts with `INTACT.err[sel]`'s argument list.
