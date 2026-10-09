# The console

What the shell, the six panels, `tools/verify-site.mjs` and U11's Chromium
battery all build against. This file is the contract: an element name, a
sentence or a rule written here is the one the suite asserts and the one
U11 drives. Where it names a decision it names the file that took it
(`BUILD-PLAN.md` §U9, `DESIGN.md` §1, §2, §5, the U9 lead's decisions).
U9 seeds it; U12 finishes it. Numbers are measured where a measurement
exists and marked "budget" where they are a target.

The document the chain serves is one HTML file: a prologue with the CSP, a
`<script>window.INTACT={…}</script>` the Catalog wrote, a base64 gzip
payload, and a loader that inflates the payload and `document.write`s it.
Everything below describes what that inflated shell does once it is
running, and what a panel may ask of it.

The state block's names are the ones that landed on `unit/U9` (commit
`69c81b2`): the token-level objects are `ownedMarket`, `reachLocks`,
`stewardStatus`, `roleCount` (the world-level `market`, `locks`, `steward`,
`roles` are addresses); `INTACT.sel` keys are `"<word>.<name>"`;
`INTACT.err` values are whole signatures (`"0x…":"Slippage(uint256,uint256)"`);
the loader leaves `window.INTACT.$doc` for the footer (§8). A panel that
reads `S.market.open` reads an address and is wrong.

Ownership of this file: the shell agent and the integration agent edit it.
**Panel agents do not edit `docs/CONSOLE.md` or `docs/INVARIANTS.md`**; a
panel lists its element ids in the header comment of its group file and
the integration agent copies them into §6.2.

---

## 1. Boot modes

The shell decides how it was opened before it reads anything, and the
decision is written on the body so a test or a stylesheet can read it:
`body.dataset.mode ∈ {viewer, console, session}`.

**The detector** is the one DESIGN §5.1 names: inside a marketplace frame
the document is a `data:` URI and its origin is opaque, so
`window.localStorage` throws. The shell does
`try { localStorage.getItem("intact"); } catch { opaque = true }` once, at
load, and never touches storage again in that mode. A real origin (an
`https://` gateway, a native `web3://` client, `http://localhost`) does not
throw.

| Mode | When | May | Never |
|---|---|---|---|
| **viewer** | opaque origin | render Home from the baked state; print the `web3://` link, the `https://` template twin (§10) and the QR; if an EIP-1193 provider is injected: `eth_chainId`, then `eth_accounts` quietly, `rightsOf`, every `eth_call`, panel loading through `engine.panel(i)`, `eth_getLogs` | `eth_requestAccounts`, any signing or `wallet_*` method (so no `#switch` control: on a chain mismatch the crest prints the sentence and offers nothing), the picker, a slab, a `[data-go]`, storage, `fetch` |
| **console** | real origin, no `?as=` | everything: discovery, the picker, connect on a gesture, every read, the slab, every write a panel builds | store anything but the picker's `rdns` (§2) |
| **session** | real origin with `?as=0x<40 hex>` | Home for the key (§11), reads, panels read-only; connect to prove the wallet is the key | every holder control; any write (no `executeAsSession` composer until U17) |

The viewer never enters session mode: a `data:` document has no query
string, and the detector wins over `location.search` regardless.

In viewer mode the shell says so on Home — *"nothing here can sign; open
the console at web3://…"* — and `INTACT.ui.propose` refuses with that same
sentence, so a panel cannot build a slab there even by mistake. A wallet
with every right still gets no signable control in the viewer; that is the
sentence verify-site asserts as *"a wallet with rights still gets no
signable control in the viewer"*.

`INTACT.ui.ready` resolves in **every** mode once the first chain check has
finished (`ok`, `wrong` or `none`) and, when there is an account, once the
first `rightsOf` has answered or failed; it never rejects. A panel that
paints after `ready` therefore always finds `body.dataset.chain` set.

## 2. Wallet discovery and the picker rule

Every announcer is kept, keyed by `info.rdns`, from the first
`eip6963:announceProvider` that arrives. **Discovery happens in the loader,
before this document exists**: `document.open()` keeps the Window's
properties but erases every event listener on it (HTML "document open
steps" 9–10; measured in Chromium 141 — a wallet's `requestProvider`
listener registered at injection never fires after the rewrite, and a
request the inflated shell dispatches is heard by nobody), so
`src/Renderer.sol` `INFLATE` dispatches `eip6963:requestProvider` and
collects every announcement while the wallets' listeners are alive, and
leaves the list on `window.INTACT.$wallets` beside `$doc`. The shell seeds
its map from it, deletes it before `ready` resolves, and keeps its own
listener for a wallet injected later (which announces unsolicited). A late
announcer joins the set. The same `rdns` announced twice is one wallet. The
suite proves the capture is load-bearing: the same two wallets against a
served document with the capture lines cut find no wallet at all (*"the
loader captures the announcements before document.open(), and a loader
without the capture finds no wallet"*).

**The rule (D8).**

- Zero announcers: `window.ethereum` if it exists, else no provider
  (`NET.dead`), and Home says *"no wallet in this browser; everything above
  is still true"*.
- One announcer: used, silently. No picker.
- Two or more and a remembered `rdns` that still announces: the remembered
  one, silently.
- Two or more and nothing remembered: **the picker appears before the first
  `eth_call`** — `#picker` with one `button[data-rdns]` per announcer, the
  name through `textContent`, the icon only when it is a `data:image/` URL.
  Every read and every send then uses the chosen provider. The picker is
  page UI, not a wallet prompt; it costs no permission and the viewer
  never shows it (the viewer reads through the first announcer and never
  chooses). **Dismissing the picker chooses nothing**: `window.ethereum` is
  one of the announcers in a real browser, so the shell does not fall back
  to it (that would be the choice the person declined to make);
  `body.dataset.chain = "none"`, no wallet is asked anything, `#connect`
  stays visible, Home's `#rights-sentence` reads *"no wallet chosen;
  connect asks again"*, and the next `#connect` gesture opens the picker
  again (*"a dismissed picker chooses nothing, and the gesture asks
  again"*). `window.ethereum` is used only when **nothing** announced.

**The instant the rule is decided.** Extensions inject their content
scripts at different times, so `choose()` does not decide at the first
tick: it waits for the `load` event (or 150 ms after its own
`eip6963:requestProvider`, whichever is later) before deciding silently.
A pick made silently (one announcer at decision time) is remembered as
silent; if the set later grows past one while nothing is remembered and
the pick was silent, the next `#connect` gesture opens `#picker` first and
`eth_requestAccounts` goes to the wallet the user picked. Two announcers
never resolve to a wallet the user did not choose — that is the sentence
*"two wallets, a picker, no choice made for you"*, and its late form *"a
late wallet joins, and the gesture asks"*.

The choice is remembered in `localStorage["intact.wallet"]` inside
`try/catch`, as a convenience only. Clicking your own address in the crest
clears it and asks again. Closing the tab is logout; there is no SIWE, no
nonce, no server.

**Order on the chosen provider**, before anything else:
`eth_chainId` → compare to `INTACT.chainId` → on mismatch `body.dataset.chain
= "wrong"`, **no reads**, and in console or session mode the `#switch`
button (the viewer prints *"your wallet is on <name>; this token lives on
<name>"* in `#crest` and renders no control — `#switch` exists only when
`mode !== "viewer"`) → on match `body.dataset.chain = "ok"`, `eth_accounts`
quietly → `eth_requestAccounts` only from a click on `#connect` →
`eth_getCode(account)` for the 7702 check → one `rightsOf(id, account)`.
`body.dataset.chain = "none"` when no provider exists. `#switch` sends
`wallet_switchEthereumChain` with the baked chain id and nothing else; the
shell never sends `wallet_addEthereumChain` (that call carries RPC URLs,
and no document of this project names an endpoint — §10).

**The chain gate is a property of the primitives, not of boot order.**
Every provider primitive in `INTACT.ui` (`read`, `readAs`, `request`,
`simulate`, `walkLogs`, `clock`, `propose`, `approveExactThen`) and every
read the shell makes for itself rejects with the §4.1 chain sentence
unless `body.dataset.chain === "ok"`. The only methods the shell sends on
any other chain state are `eth_chainId` (to learn it) and, from `#switch`,
`wallet_switchEthereumChain`. So a panel already loaded when
`chainChanged` moves the wallet to a wrong chain repaints on
`intact:rights`, its reads reject, and the lane prints the chain sentence
instead of another chain's numbers; the suite asserts the `eth_call`
count does not grow (*"a lane already open stops reading when the chain
goes wrong"*).

`accountsChanged` and `chainChanged` both run the same path again from the
chain check, so rights are recomputed on both; the chain check comes first
on `chainChanged` so a wrong chain clears rights rather than reading with
them. **The gate moves on the event itself**: `chainChanged` carries the new
id, and the shell writes `body.dataset.chain` from it synchronously before
it re-reads `eth_chainId` to confirm — so a read a panel sends between the
event and the answer is refused by the gate, not answered by the new chain
(a real EIP-1193 provider does not serialise requests; the suite holds
`eth_chainId` open and reads: *"a read parked between chainChanged and the
re-read is refused by the gate, not answered by the new chain"*).

## 3. The rights gate

One read, `hub.rightsOf(id, account) → (uint16 bits, uint64 epoch, address
holder)`, is the whole authority model as the page sees it. The bits are
`INTACT.rights`: `HOLD 1 · ACCOUNT 2 · USE 4 · CUSTODY 8 · ROLE 16 ·
DELEGATE 32 · GUARDIAN 64 · SESSION 128`. The shell writes them as decimal
on `body.dataset.rights` (`""` before connect and whenever the read has no
answer, `"0"` for a connected stranger) and panels read
`INTACT.ui.rights()`, which is `null` when unknown and a number only after
a successful read. Zero and no answer are different facts here as
everywhere: a `rightsOf` that rejects (a provider error after the chain
check) leaves `body.dataset.rights = ""`, prints *"your rights could not be
read at block <n>"* in the ticker, and `gate()` prints that sentence rather
than the stranger's; no `[data-act]` that needs a bit renders until a read
succeeds (a control with `needBits === 0` — the mint — renders for any
connected account, §5 `act`).

| Bits | What renders |
|---|---|
| none / not connected | the walk, the facts, every read; one sentence per panel saying what connecting would allow |
| `HOLD` | everything; the only bits that grant, seal, arrange, bind, set guardian/user/agent wallet, list, first-launch |
| `HOLD \| ACCOUNT` ("acts") | the composer, market operations, launch, Reach operations through the slab — `ACCOUNT` never belongs to a browser wallet, so in practice this is the holder's wallet choosing the Reach as the hand |
| `USE` | *"you are the user until <date>"* on Home (`#rights-sentence`, from `INTACT.clocks.userExpires`); the walk; no composer, no money, no traits |
| `CUSTODY` | *"an operator may move the token, not speak"*; the transfer control after the checklist (§7); nothing else |
| `GUARDIAN` | `pause`, `panic` (the guardian's list, §7), `revokeAllSessions`, `sealMax`, `approveFirstLaunch`; nothing else |
| `SESSION` | *"a session speaks only through the Reach"*; the session's own facts; nothing to press until U17 |
| `DELEGATE`, `ROLE` | viewing only; printed as chips on Identity › rights of any address |

In session mode (§11) the bits are masked to `SESSION` before they reach
the body or `rights()`: `?as=<the holder's own address>` yields `"0"`, not
`HOLD`, so a panel branching on `rights() & HOLD` for a form renders
nothing a session page should not show.

**The 7702 check.** After `eth_requestAccounts`, `eth_getCode(account)`. A
code beginning `0xef0100` names a delegate; the shell keccaks the 23 bytes
and compares to `catalog.knownDelegates()` (a live read; the row is
`knownDelegates|Q|knownDelegates()|r|d|…`, `INTACT.sel["catalog.knownDelegates"]`).
The result is `INTACT.ui.delegate() → { code, name, known, acked } | null`
(`null` for a plain account). The Identity **panel** draws the row
(`#identity-delegate`) from it; an unknown delegate prints *"unknown
delegate"* and every control marked `[data-spend]` is hidden until the
holder presses `#ack-delegate`, which calls `INTACT.ui.ackDelegate()`; the
shell then sets `acked`, unhides `[data-spend]` and fires `intact:rights`.
`opts.spend` marks every control whose transaction moves value or tokens
out of the signer's or the Reach's hands: swaps, deposits, buys,
contributions, locks, stamped whispers, approvals of any kind, session
grants, `execute*`, `transferFrom`, `mint`.

**`propose` enforces the gate, not only `act`.** `act` renders nothing for a
missing bit, so there is nothing hidden to click; the gate that matters is
in `INTACT.ui.propose`, which re-checks `tx.need` against the live bits
(refusing with `gate`'s sentence) and refuses `opts.spend` while
`delegate().known === false && !acked` (*"an unknown delegate holds this
account; acknowledge it on Identity first"*). verify-site exercises both
from the harness by calling `propose` directly as the renter and under an
unknown delegate: no slab, no `eth_estimateGas`.

## 4. The confirm slab

Every write passes through one function, `INTACT.ui.propose(tx)`; no panel
holds a provider and no panel can send — not through `INTACT.ui.request`
(§5: an allowlist of read methods), not through the wallet library (block
1 publishes to a one-shot `window.INTACT.$lib` that block 2 copies into a
closure and deletes before `ready` resolves and before any panel is
injected; `INTACT.lib` does not exist), not through `window.ethereum` (a
panel never reads it — a build and a suite rule). The slab is built with
`createElement`/`textContent` — never a markup string — into `#cslab`
inside the `#cbox` backdrop, which takes class `on` while open.
`propose(tx)` returns a `Promise<void>` that resolves when the slab closes
for any reason; outcomes reach the panel through `then(receipt)` and the
ticker, never through the promise rejecting — a `to` that is not an
address, a `value` that is not a number or `lines` that are not a list are
refused as *"a panel bug: <reason>"* in the ticker, the promise resolves,
and `#cslab` is left empty, so the next slab's first row is its own
(*"a bad destination resolves without a slab, leaves nothing behind, and a
disabled Sign sends nothing"*). Closing the slab always clears `#cslab`,
whether or not one was open.

What happens, in order:

1. **Refusals before a slab exists.** Wrong chain (`body.dataset.chain !==
   "ok"`): *"your wallet is on <name>; this token lives on <name> — the
   crest offers the move"* (in the viewer: *"… — open the console to
   move"*). Viewer or session mode: the §1 sentence — `propose` checks the
   mode itself, before the rights, so a session key whose grant carries the
   `SESSION` bit a `tx.need` names is still refused (*"propose refuses in
   session mode even for the SESSION bit the key holds"*). A write without a
   clear-signing `sentence`: refused (a panel bug, printed as one). A key
   the panel did not declare through `rows`: refused. A raw `data` whose
   first four bytes are not `selector(sig)`: *"a panel bug: the signature
   does not name these bytes"*. A deadline the panel built while
   `clock()` rejected: *"the chain's clock could not be read"* (§12). An
   `approve`/`increaseAllowance` whose amount word is `≥ 2^255` — **in the
   outer call or inside any call the outer one carries**: when the outer
   selector is `execute(address,uint256,bytes,uint8)`,
   `executeBatch((address,uint256,bytes)[])` or `executeTyped(…)`, every
   inner `data` is decoded and the same word check runs on it —
   *"unlimited approvals are never built here"*. A `tx.need` the live bits
   do not satisfy, or `opts.spend` under an unacknowledged unknown
   delegate (§3): refused with the gate's sentence.
2. **The rows.** The panel's own `lines` first (every value already in
   words); then `To` (`[data-to]`, the checksummed address), `Value`
   (`[data-value]`, in ether with its decimal wei on `dataset.wei`, present
   only when non-zero), `Function` (`[data-function]`, the canonical
   signature; `[data-selector]`, the four bytes), the argument rows, the
   calldata (`[data-calldata]`, full hex), its keccak (`[data-digest]`),
   the engine hash (`[data-engine]`, `INTACT.engineHash`), the gas row
   (`[data-gas]`), and the clear-signing sentence (`[data-sentence]`) above
   the buttons `[data-go]` ("Sign and send") and `[data-no]` ("Not now").
   **The argument rows are decoded from the calldata**, never copied from
   the panel's `args`: when every type in `sig` is one `data()` can build
   (§5 — static types, `bytes`, `string`, `T[]` of a static base) the shell
   renders one row per argument (`[data-arg=<i>]`: addresses checksummed,
   numbers decimal, booleans as words, bytes as their length) from
   `[data-calldata]`, so what is shown is what is signed; when `sig`
   carries a tuple or a nested array the shell renders **no** `[data-arg]`
   rows and the panel's `lines` must carry every argument in words (the
   suite reads those arguments from `[data-calldata]` and from `lines`).
3. **`eth_estimateGas`** with `{from, to, data, value}` on the chosen
   provider, before the wallet is ever asked. `[data-go]` is disabled until
   it answers. Success: *"<n> units"* and the slab remembers `n × 125 / 100`
   as the gas to send. A revert: the first four bytes of the revert data
   are looked up in `INTACT.err`, which carries the **full signature**
   (D6 — `"0x…":"Slippage(uint256,uint256)"`); the arguments are decoded
   with that signature and the row reads exactly `"would revert: " +
   errorSentence(data)` — **`would revert: Slippage(9, 10)`** — the name,
   then the decoded arguments in parentheses, addresses checksummed and
   shortened, numbers decimal, bytes as hex. An unknown selector reads
   `would revert: unknown error 0xdeadbeef` (the hex, never an empty row).
   A revert with no data reads `would revert`. In every revert case
   `[data-go]` stays disabled and the wallet never opens: that is *"a
   non-holder sees the custom error before the wallet opens"*. Wallets
   differ in where they put the data (`e.data`, `e.data.data`, or a
   `0x[0-9a-f]{8,}` run inside `e.message`); the shell tries all three.
   One spelling, one decoder: `errorSentence` is the only place a revert
   becomes words, and `[data-gas]`, `simulate().sentence` and `read`'s
   rejection all use it.
4. **One press.** `[data-go]`'s handler, in the shell and nowhere else:
   `hub.custodyEpoch(id)` is re-read and compared to the epoch the screen
   was rendered from; a difference closes the slab with *"ownership or
   epoch changed — review again"* and sends nothing. The social panel's
   `keyOf(to)` re-read runs here too, through the `tx.recheck()` hook
   (§9); a refusal sentence from it closes the slab the same way. On the
   collection page (`INTACT.id === 0`) there is no epoch to re-read and the
   step is skipped.
5. **`eth_sendTransaction`** `{from, to, data, value?, gas?}` on the chosen
   provider. The hash is said in the ticker. A wallet that throws
   `4001`/"denied"/"rejected" reads *"you declined the signature"*; any
   other throw is printed as its message, truncated. A reverted
   transaction is never learned from the send throwing — it is learned
   from the receipt.
6. **The receipt watcher**: `eth_getTransactionReceipt` every 2 s, 90
   times — three minutes. `status 0x1` → *"landed in block <n>"*; `0x0` →
   *"reverted in block <n>; nothing changed"*; after three minutes →
   *"still not mined after three minutes; it may yet land"*.
7. **After the receipt**: `hub.coreOf(id)` (status, lock count, epoch,
   guardian hold — the live facts) and `rightsOf(id, account)` are re-read;
   the epoch comes back in both, so no separate `custodyEpoch(id)` call is
   made here (the slab's go handler is where that call lives). The body's
   rights are rewritten, `intact:rights` and `intact:epoch` fire, and if
   either moved the ticker says *"ownership or epoch changed — review
   again"* and any open slab is discarded. Then the
   panel's `then(receipt)` runs (its errors are swallowed into the
   ticker).

The exact-approval step is also a slab: `INTACT.ui.approveExactThen(steps,
fin)` reads `allowance(owner, spender)` for each step (`owner` defaults to
the connected account; a step with `via: "reach"` reads the Reach's
allowance and proposes `reach.execute(token, 0, approve(spender, amount),
0)` instead of a wallet approve), and when it is short proposes
`approve(spender, exactly the amount)` with the lines `Lets · the market
pull exactly <amount> <symbol>`, `Never · unlimited`, `Then · press the
same button again`; when every step stands it calls `fin()`. The word
"unlimited" appears in the console only as that refusal.

## 5. The panel contract

A panel is a classic script, injected by the shell as `<script
src="blob:…">` after its bytes hashed to `INTACT.panels[name]`. It is one
IIFE with **zero top-level declarations** — terser mangles each
`<script>`'s top level separately, so a top-level `const` in a panel can
collide with a one-letter name in the shell and the panel never runs
(measured, E §3.4). The build parses every panel and refuses one whose top
level is anything but simple statements (*"panel <name> declares at top
level"*). Everything shared hangs off `window.INTACT`; a panel spells
`window.INTACT` at least once because the build requires the literal.

```js
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("swap");           // #lane-swap
    ui.rows({ "pool.quote": "quote(uint256,bool,uint256)", /* … */ });
    /* render through textContent; read with ui.read; write with ui.propose */
    S.loaded.swap = true;
  });
})();
```

`social.js` carries `/*@inline engine/whispers.mjs*/` at the top of its
IIFE and therefore **may not declare** `enc, dec, bytes, text, b64, un64,
random, subtle, equal, pub, priv, shared, passwordKey, whisperScope,
publicHex, hexPublic, createMessagingKey, messageContext, encryptWhisper,
decryptWhisper, encryptKeyBackup, decryptKeyBackup` — those are the
module's names, inlined into the same function scope (terser refuses a
redeclaration at build). Alias `ui.enc` as `E`. The backup pair vanishes
from the build on its own when the panel never calls it (terser drops
unreferenced inner functions).

**`window.INTACT.ui` — the whole surface panels may call.** Nothing else
on the shell is promised; a panel that reaches past this list is a bug.
Values: every `uint`/`int` is a `BigInt`; every address, `bytesN` and
`bytes` is lowercase or checksummed hex; `bool` is a boolean; `string` is a
string; `T[]` is an array.

| Member | What it does |
|---|---|
| `ready` | a promise that resolves after the first chain check (`ok`/`wrong`/`none`) and the first `rightsOf` when there is an account; it resolves in every mode and never rejects (§1) |
| `mode()` | `"viewer" \| "console" \| "session"` |
| `rights()` | `null` when unknown (not connected, read failed), else the bits as a number (masked to `SESSION` in session mode); `account()` the connected address or `null`; `epoch() → BigInt \| null`, the last `custodyEpoch` read |
| `host(name)` | the `#lane-<name>` element |
| `rows(map)` | declares `{ "<word>.<name>": "<signature>" }`; for each key the shell recomputes `selector(sig)` and compares with `INTACT.sel[key]`; **throws** `Error("<key>: not a row the chain serves")` on a missing key and `Error("<key>: this panel's ABI disagrees with the chain's")` on a mismatch (the lane prints the message); `data`, `read`, `readAs`, `propose` with an undeclared key throw `Error("<key>: not declared by this panel")` |
| `data(key, args)` | calldata: the baked selector plus the ABI-encoded arguments, types from the declared signature. **Reach:** the static types (`uintN`, `intN`, `address`, `bool`, `bytesN`), `bytes`, `string`, and `T[]` of a static base. Tuples and nested arrays are **not** built here: lay them with `enc.*` and propose `{ to, data, sig, lines }` (§4.2 — no `[data-arg]` rows; `lines` carries every argument) |
| `read(to, key, args)`; `readAs(to, key, args, from)` | `eth_call` on the chosen provider (the first announcer in the viewer); rejects with the §2 chain sentence unless `body.dataset.chain === "ok"`; returns `{ raw, words[], w(i) → BigInt, a(i) → checksummed address, b(i) → boolean, s(i) → string (the dynamic string at the offset in word i, or a `bytes32` dialect when the word has no offset), bytes(i) → hex (the dynamic bytes at the offset in word i), arr(i) → BigInt[]/hex[] (a static-element array at the offset in word i), tuple(i, types) → values (a static tuple array element or a dynamic tuple at the offset in word i, decoded by `types`) }`; rejects on revert with `errorSentence(data)` |
| `request(method, params)` | the one provider path for reads `data`/`read` cannot express. **Allowlist**: `eth_call, eth_getLogs, eth_getBalance, eth_getBlockByNumber, eth_blockNumber, eth_getCode, eth_getTransactionReceipt, eth_chainId, eth_accounts`. Every other method, in every mode, rejects with *"a panel cannot send; propose it"*; chain-gated like `read` (`eth_chainId` excepted) |
| `sealSignature()` | console mode only: `personal_sign` of exactly `"INTACT seal v1 · chain <INTACT.chainId> · hub <INTACT.hub lowercase>"` by the connected account (§9); resolves to the signature hex; stores nothing; the only `personal_sign` in the document. Refused in viewer and session mode with the §1 sentence |
| `simulate(to, data, { from, value })` | `eth_call` that returns `{ ok, data, sentence }` with the **full** revert data instead of throwing — for quotes-by-revert: `router.quoteExactIn` always reverts `QuoteResult(uint256 spent, uint256 received, uint160 sqrtPriceAfter)` (`0x5cbe38e7`) and the panel decodes the three words; `sentence` is `errorSentence(data)` when `!ok`, `""` otherwise, so no panel re-implements the decoder |
| `errorSentence(revertHex)` | the §4.3 sentence for any revert data, from `INTACT.err` |
| `propose(tx) → Promise<void>` | the slab (§4). `tx = { to, key, args, value?, lines: [[k, v]…], sentence, note?, need?: bits, spend?: bool, recheck?: async () => sentence \| null, then?: (receipt) => void }`; `key`+`args` build the data and the argument rows; a raw `data` is accepted only with `sig` (`selector(sig)` must equal `data.slice(0, 10)`), and its argument rows follow §4.2. Resolves when the slab closes |
| `approveExactThen(steps, fin)` | `steps = [{ token, spender, amount: BigInt, symbol, decimals, owner?, via?: "reach" }]` — §4, last paragraph |
| `act(parent, name, label, needBits, fn, opts)` | a write button carrying `data-act="<name>"`, rendered only in console mode: when `needBits !== 0`, iff `rights() & needBits`; when `needBits === 0` ("anyone"), iff `account()` is non-null. Otherwise it renders nothing and `gate` prints the sentence once. `opts.spend` marks it `[data-spend]` for the 7702 rule (§3). Never rendered in viewer or session mode |
| `gate(parent, needBits)` | the sentence for the actual state: not connected / rights unreadable / connected without the bit / renter / guardian / viewer / session; returns the boolean |
| `delegate()`, `ackDelegate()` | `{ code, name, known, acked } \| null` (§3); `ackDelegate()` sets `acked`, unhides `[data-spend]`, fires `intact:rights` |
| `qr(text) → SVGElement` | the §13 code; throws `RangeError("payload over 106 bytes")` and the caller prints the link alone |
| `el(tag, cls, text)`, `kv(parent, k, v)`, `button(parent, label, grey, fn)`, `field(parent, label, placeholder) → the <input>`, `note(parent, text, cls)`, `chip(parent, label, state)` | the furniture, every text node through `textContent`; `kv` returns the row so `row.lastChild.textContent` can move from *reading…* to the value |
| `enc.W(v)` word of a BigInt/hex · `enc.A(addr)` · `enc.B4(sel)` · `enc.B32(hex)` (every `bytesN` left-aligned) · `enc.bytes(hex)` (length word + padded body, **no offset word** — the panel places it at its own offset) · `enc.str(s)` (likewise) · `enc.params(types, values)` (a whole head + tail, offsets included) | the low-level coder, for the nested shapes `data()` cannot build (`executeBatch`, `executeTyped`, `grantSession`'s `(address,uint128)[]`, `SwapRequest`, the launchpad's 14-field params) |
| `fmt(v, decimals, prec)`, `parse(s, decimals)`, `short(addr)`, `checksum(addr)`, `isAddr(s)` | amounts are BigInt in, BigInt out; `parse` throws on anything but `^\d*\.?\d*$`; dust prints `<0.000001`, never `0` |
| `khex(string)`, `kbytes(hex)` | the shell's proven keccak — for the two trait keys `khex("curve")`, `khex("name")`, the social lane's `pairKey`, and nothing else |
| `clock() → Promise<BigInt>` | the chain's clock (§12): `eth_getBlockByNumber("latest", false).timestamp`; **rejects** when the read fails or the chain is not `ok` — it never falls back to `INTACT.time` or `Date.now()`; `now()` is `Date.now()` for animation only |
| `say(msg, kind)` | the ticker `#tick`, `kind ∈ {"", "ok", "err"}` |
| `walkLogs(filter)` | `eth_getLogs` through the provider, recording nothing; rejects when the endpoint refuses, and the rejection is a fact the panel prints (never `0`) |

**Shell events** (dispatched on `window`, `CustomEvent` with `detail`):

| Event | When | `detail` |
|---|---|---|
| `intact:chain` | after every chain check | `{ ok, chainId, name }` |
| `intact:rights` | after every `rightsOf` (connect, `accountsChanged`, `chainChanged`, every receipt, `ackDelegate`) | `{ bits, account, epoch }` (`bits` is `null` when the read failed) |
| `intact:epoch` | whenever `custodyEpoch` is read and differs from the last reading | `{ epoch }` |
| `intact:lane` | whenever a lane is shown, including a revisit | `{ name }` |

A panel registers `INTACT.loaded[name] = true` when its first paint is
done; the shell sets `lane.dataset.loaded = "1"` before injection and the
suite reads both.

## 6. The element vocabulary

The names below are the contract; verify-site asserts them and U11's
Chromium driver uses the same strings. Panels add their own, prefixed by
their lane, listed in the header comment of their group file; the
integration agent copies them here. **Every selector a group file writes
is scoped to its lane** (`#lane-swap [data-act=collect]`, never
`[data-act=collect]`): `collect` and `approve` name different calls in
different lanes, and the two that would have collided outright are renamed
(`lockRelease`, `launchCollect` in the launch lane).

### 6.1 The shell

| Element | Meaning |
|---|---|
| `body[data-mode]` | `viewer` \| `console` \| `session` |
| `body[data-rights]` | the decimal bits; `""` before connect and when the read failed |
| `body[data-chain]` | `ok` \| `wrong` \| `none` |
| `#crest` | the wallet cell: *read only — connect* / *<wallet> · 0x12… 3456*; on a wrong chain *your wallet is on <name>; this token lives on <name>*; clicking an address drops the remembered choice |
| `#connect`, `#switch` | the gesture controls; neither exists in the viewer (`#switch` is rendered only when `mode !== "viewer"`). `#connect` is visible while the chain is `ok` and nobody is connected, and also after a dismissed picker (§2), so it can ask again |
| `#picker button[data-rdns]` | the EIP-6963 picker |
| `#lanes a[data-lane=<name>]` | the nav; absent or `aria-disabled="true"` in the viewer **without a provider** (with one, the viewer loads panels through `engine.panel(i)`); no `agent` link until the AgentCard has code |
| `#lane-home`, `#lane-<name>` | one section per lane; `.on` on the visible one; `dataset.loaded="1"` once a panel was injected |
| `#tick` | the ticker (`.ok`, `.err`, `.fade`) |
| `#facts [data-fact=<key>]` | Home facts: `id chain holder epoch status locked reach grip seal market fingerprint name engine catalog block` (`locked` reads *yes*/*no* from `INTACT.locked`, refreshed from `hub.locked(id)` after receipts); on the collection page `minted price` |
| `#chips .chip[data-bit=<name>][data-state=…]` | §6.3 |
| `#rights-sentence` | Home's one sentence about who is reading: with no provider at all, the §2 sentence *no wallet in this browser; everything above is still true* (every mode) — or, when wallets announced and the picker was dismissed, *no wallet chosen; connect asks again*; else, after a successful `rightsOf`, the sentence for the bit that is not `HOLD` — `USE` *you are the user until <date>*, `CUSTODY` *an operator may move the token, not speak*, `GUARDIAN`, `SESSION` *a session speaks only through the Reach* (§3); `""` for the holder, a stranger, and while the read has no answer |
| `#verified` | the self-hash footer (§8) |
| `#qr` | the SVG QR (`svg[role=img][aria-label=<payload>]`, only `rect` children) |
| `#link-web3`, `#link-https` | the two links (§10) |
| `#mint`, `#directory .market`, `#recent .coin`, `#commons` | the collection page |
| `#session` | the session-mode Home (§11) |
| `#cbox.on`, `#cslab`, `[data-go]`, `[data-no]`, `[data-to]`, `[data-value]`, `[data-function]`, `[data-selector]`, `[data-arg=<i>]`, `[data-calldata]`, `[data-digest]`, `[data-engine]`, `[data-gas]`, `[data-sentence]` | the slab (§4) |

**As shipped by the shell (U9, reconciled by the shell agent).** The table
above holds; these are the ids the shell added beside it, listed so a test
or a driver finds them by the same name: `#ident` (the `h1`, *INTACT #<id>*
or *INTACT*); the crest cells `#c-chain` with `#c-chain-v` (the chain's
name) and `#c-wallet` with `#c-wallet-v` (the wallet text) — there is no
separate id cell; `#viewer` (the block that holds `#viewer-note`,
`#link-web3`, `#link-https` and `#qr`, shown on every token page in every
mode, with `#viewer-note` carrying the §1 sentence only in the viewer);
`#collection` (the `id === 0` block that holds `#mint`, `#directory`,
`#recent`, `#commons`); `#picker` carries the `hidden` attribute until the
rule needs it; `#connect` and `#switch` carry `hidden` when they do not
apply and are absent from the tree in the viewer. On the collection page
the facts are `chain minted price engine catalog block`; on a token page
they are the fifteen above. The agent stub's one id is `#agent-stub`.
There is no `#stand` and no `#still` in the MVB shell (cut for the byte
budget; neither is in the table).

### 6.2 The panels

| Lane | Elements |
|---|---|
| swap | `#swap-in`, `#swap-out` (`dataset.raw` = the quote in base units), `#swap-go`, `#swap-flip`, `#swap-sym-in`, `#swap-sym-out`, `#swap-details`, `#swap-quote-owned`, `#swap-quote-elsewhere`, `[data-tab=owned\|elsewhere]`, `#swap-your-market`, `#swap-open-form`, `#swap-sniper`, `#swap-directory .market`, `#swap-venues .venue`, `[data-act=openMarket\|deposit\|withdraw\|setFee\|syncCurve\|sealMarket\|closeMarket\|writeDown\|collect\|approveZero\|swapElsewhere]` |
| social | `#social-commons .row` (`.who`, `.body`), `#social-home`, `#social-rooms`, `#social-dm`, `#social-dm-status`, `#social-inbox`, `#social-composer`, `#social-why`, `#social-followers .token`, `[data-act=speak\|speakAsReach\|whisper\|found\|join\|leave\|invite\|configureInbox\|expire\|claimRefund\|claimSettled]` |
| launch | `#launch-raises .raise`, `#launch-tax`, `#launch-tax-countdown`, `#launch-floor` (`dataset.raw`), `#launch-buy-in`, `#launch-buy-out`, `#launch-buy-fee`, `#launch-buy-snipe` (each `dataset.raw`), `#launch-coin-form`, `#launch-coin-preview`, `#launch-spacing`, `#launch-positions .sealed`, `#launch-locks .lock`, `[data-act=launch\|coinAt\|create\|buy\|sell\|graduate\|fail\|refund\|claim\|launchCollect\|contribute\|redeem\|lock\|lockRelease\|extend\|give\|approveFirstLaunch]` |
| vault | `#vault-holdings .row`, `#vault-manifest`, `#vault-approvals .row` (`.allowance[data-raw]`), `#vault-revoke-all`, `#vault-seal-until` (an input whose `min` is the current seal), `#vault-seal-note`, `#vault-execute`, `#vault-batch`, `#vault-grip`, `#vault-grip-address`, `#vault-grip-warning`, `#vault-sessions .row`, `#vault-session-key`, `#vault-session-walk`, `#vault-sessions [data-sel]`, `#vault-steward-status`, `#vault-checklist .survives`, `#vault-checklist .revoked`, `#vault-panic`, `#vault-panic-list`, `[data-act=execute\|executeBatch\|seal\|sealMax\|guard\|unguard\|revokeOpenApprovals\|grantSession\|grantRecipe\|revokeSession\|revokeAllSessions\|arrange\|stillHere\|cancel\|summon\|attest\|stewardExecute\|panic\|release\|transfer]` |
| identity | `#identity-status`, `#identity-status-rule`, `#identity-rights-input`, `#identity-rights-chips .chip[data-right=<HOLD\|ACCOUNT\|…>]` (rights names, distinct from Home's `data-bit` satellite names), `#identity-fingerprint-baked`, `#identity-fingerprint-live`, `#identity-delegate` (drawn by the panel from `ui.delegate()`), `#ack-delegate`, `#identity-key`, `#identity-proposed`, `[data-act=setTrait\|setStatus\|pause\|setGuardian\|setUser\|proposeAgentWallet\|acceptAgentWallet\|setFeesToGrip\|pinTokenURI\|unpinTokenURI\|sealTransfer\|setApprovalForAllUntil\|setApprovalForAll\|approve\|revokeAllApprovals\|setEncryptionKey\|bindKey]`; no `#identity-ens` exists on a band without a Nameplate |
| agent | `#agent-stub` and, in session mode, the key's facts |

### 6.3 The "not reported" chip rule

A clear bit has two spellings and neither is zero. For every name in
`INTACT.bits`:

```
reported & bit   → data-state="reported"   text "<name>: reported"            (a zero under it is a zero)
absent & bit     → data-state="absent"     text "<name>: not deployed on this chain"
otherwise        → data-state="unread"     text "<name>: could not be read at block <INTACT.block>"
```

The same three-way rule applies to every `null` sub-object (`ownedMarket`,
`inbox`, `home`, `commons`, `key`, `launches`, `reachLocks`,
`stewardStatus`, `roleCount`, `holderKeyId` — `market` is the Market
contract's address and is never a sub-object) and to every live read a
panel makes: *reading…* → the value (zero included) or *not reported* (a
rejected request) — never `0` for an unanswered question. The Vault's
`holdings()` prints *not measurable* for an asset whose `measured` flag is
false. The Vault's session count prints *"sessions: not counted"* when the
grant-log walk was refused by the endpoint (§7). No clear bit is ever
printed as `0`: the suite scans every chip for `/:\s*0\b/`.

## 7. The Vault: sessions, the sell-time checklist, panic

**Sessions (D2).** The Reach has no session list and the frozen `IReach`
gains none. Vault › Sessions offers (i) a key field: any pasted address is
inspected with `reach.sessionOf(key)` (14 words), `reach.sessionExposure(key)`
and `hub.rightsOf(id, key)`'s `SESSION` bit; (ii) *walk the grant log*:
one `eth_getLogs({ address: INTACT.reach, topics: [INTACT.topics.sessionGranted],
fromBlock: "0x0", toBlock: "latest" })`, each key confirmed live with
`rightsOf(id, key) & SESSION`. An endpoint that refuses the range makes the
lane print *"the grant log could not be walked on this endpoint"* — never
`0` sessions. The grant form's selector chips are `INTACT.sel` entries
(`[data-sel]`), never typed hex; the exposure (`nativeCap`, every asset
cap) is printed in words before Sign.

**The sell-time checklist** renders before any `transferFrom` the page
proposes (`#vault-checklist`, two columns), and `W.prompts()` does not move
while it renders. Each line names the live read that proves it; a line
whose read has no row is printed as a category, not a number. Before the
checklist the recipient is classified: `eth_getCode(to)`; a code of exactly
173 bytes is an ERC-6551 forwarder whose last word is a token id `k` and
whose preceding word is the hub — when the hub is `INTACT.hub`,
`isCanonicalAccount(to, k, false) || isCanonicalAccount(to, k, true)` refuses
with *"no Intact can sit inside another Intact's accounts"* before the
chain is asked to estimate; `to ∈ {hub, reach, grip, reachImpl, gripImpl}`
is refused without a read. Anything else is proposed and the estimate
surfaces the hub's own revert.

| Revoked by the sale (same transaction) | Proving read |
|---|---|
| the single approval | `rightsOf(id, approvee) & CUSTODY` → 0 (no `getApproved` row: printed as *"the single approval, if one stands"*) |
| the user (ERC-4907) | `coreOf` w10/w11 → 0; `rightsOf(id, user) & USE` → 0 |
| the guardian | `coreOf` w6 → 0 |
| the agent wallet and any proposal | `coreOf` w12, w13 → 0 |
| the pinned face | `coreOf` w1 → 0 |
| income to the Grip | `coreOf` w8 → false; `feeSink(id)` → the Reach |
| status → Paused | `statusOf(id)` 0 → 1 |
| custody epoch +1 | `custodyEpoch(id)` |
| every session and recipe | `sessions: <n>` from the grant-log walk (or *not counted*); each dies by `sessionOf(key)` w2 ≠ the new epoch |
| the key binding | `parley.keyOf(id)` → `(0, 0x0, "")` — *"key bound: yes/no"* |
| the inbox price | `postage.inboxOf(id)` → open and free — *"inbox price: <amount>"* |
| the steward plan | `steward.wouldPass(id)` → 1 SOLD — *"steward plan: <word>"* |
| the first-launch approval | `launchpad.firstLaunchApproved(id)` → false |
| **not** revoked: your operator approvals | per owner, not per token — printed as a note |

| Survives for the buyer | Proving read |
|---|---|
| the Reach's seal | `reach.sealedUntil()` |
| manifest and guarded pieces | `reach.manifest()`, `reach.pieces()` |
| the owned market: reserves, fee, curve, seal | `pool.marketOf(id)` words 2–4, 9–12; `marketHash(id)` |
| sealed markets' fee streams | `pool.marketOf(key)` w15 `beneficiary == id`; paid to `feeSink(id)` |
| Locks whose beneficiary is the Reach | `locks.lockCountOf(reach)`, `lockOf(id)` w1 |
| the Grip's contents | `eth_getBalance(grip)`, `erc20.balanceOf(grip)` |
| the archive and the home room | `parley.stateOf(home.room)` w1 |
| traits | `coreOf` w14, w15 |
| open-approval ledger entries | `reach.openApprovals()` — visible, the buyer's to revoke |
| launches and their root | `launchpad.launchesOf(id)` |

Footer: *"nothing the previous holder delegated comes along."*

**Panic** is one red button (`#vault-panic`, class `red`), two presses. The
first press lists what it revokes (`#vault-panic-list`) from live reads:
the grant-log walk (*sessions: 2* or *sessions: not counted*), `keyOf`,
`inboxOf`, `wouldPass`, `firstLaunchApproved`, and the categories that
have no read — *every operator approval on every token you hold*, *the
single approval, if one stands*, *the user*, *status → Paused*, *seal →
<date, +365 d>*. A token with nothing delegated still gets a sentence:
*"nothing is delegated; panic still moves the epoch and seals the Reach"*.
The second press proposes `panic(uint256)`; one transaction does all of
it. The guardian's list is different and says so: *"does not touch the
holder's operators"*, *"guardian hold"*; under the hold Home's
`[data-fact=locked]` reads *yes* (the hub's `locked` is a token fact the
shell prints, not a satellite chip), the vault repeats *locked: yes*, and
only the holder in person may `release`.

## 8. The self-hash footer

The loader (`src/Renderer.sol` `INFLATE`) keeps the inflated bytes on the
state object — `window.INTACT.$doc = t` immediately before
`document.open()` (D3; a property, not a global binding, so the build's
`checkLoader()` and verify.mjs's *"declares nothing at all in global
scope"* still hold). After first paint the shell keccaks `INTACT.$doc`,
deletes it, and compares. **The live comparison runs only while
`body.dataset.chain === "ok"`**: on any other chain the shell would be
reading another chain's contract at `INTACT.engine` (U10 deploys with
CREATE3, so the same address plausibly holds another band's Engine) and
could print a false block number — so it does not read at all, and the
suite asserts no `engineHash()` call and no `eth_blockNumber` on a wrong
chain.

| Comparison | `#verified` reads |
|---|---|
| equal to the baked `INTACT.engineHash` **and**, with the chain `ok`, to a live `eth_call engine.engineHash()` | **engine 0x1234…cdef pins these bytes at block <n>** — the engine's address shortened so the reader can compare it to the address they navigated to; <n> from `eth_blockNumber` at the time of the read |
| equal to the baked hash; a provider on the wrong chain | **self-consistent; wallet on <name>, not this token's chain** |
| equal to the baked hash only (no provider, or the read failed) | **self-consistent; chain not reachable to verify** |
| different from either | **does not match the engine hash** — in red (`.bad`) |
| the loader kept no bytes (`INTACT.$doc` absent: the one loader line was altered) | **does not match the engine hash; the loader kept no bytes** — in red (`.bad`); never a neutral *nothing to verify* |
| the opened address names another Premises (below) | **this document names a different Premises than the address you opened** — in red (`.bad`) |

The live read proves the bytes running here are the bytes the chain pins
now **at the engine this document names**; the baked comparison alone only
proves the loader inflated what the state block names. A wholesale
tampered document (bytes, baked hash and `INTACT.engine` all changed)
would pass both, so in console mode the shell also uses the one anchor the
reader chose — the URL: when `location.hostname + location.pathname`
carries a 40-hex address (a `web3://<premises>:<chain>/…` client, a
path-based or host-based gateway), the shell compares it to
`INTACT.premises`; on agreement it `eth_call`s `premises.ENGINE()` (the
shell computes `selector("ENGINE()")` with its proven keccak — no row
exists for it) and requires the answer to equal `INTACT.engine` before the
live hash counts; on disagreement it prints the red Premises sentence. No
address in the location (the viewer, a bare `localhost`) leaves the
weaker sentences as they are. All five sentences are asserted; a tampered
`engineHash()` answer produces the red one.

## 9. The sealing flow (D7)

The P-256 scalar is derived from `personal_sign("INTACT seal v1 · chain <c>
· hub <hub>")` — chain and hub only, **one key per wallet**. The registry is
address-keyed (`setEncryptionKey(uint16,bytes)` has no token parameter), so
a per-token sentence would make a two-token holder's second binding erase
the first; epoch death comes from `Parley.Binding{owner, epoch}` and needs
nothing in the sentence. `bindKey(id)` binds the wallet's registry key to
each token the holder seals for. The derivation: SHA-256 of the signature,
rejected and re-hashed until `0 < d < n`, imported as PKCS#8 with the
35-byte header (extractable, for the JWK export whispers.mjs needs); the
public point is what WebCrypto computes on import.

The sentence is deterministic key material: whoever holds a signature of
it holds the scalar. So only the shell signs it (`INTACT.ui.sealSignature()`,
§5 — the one `personal_sign` in the document, console mode only, exactly
that sentence built from `INTACT.chainId` and `INTACT.hub`), the signature
and the scalar live in the social panel's closure and never on
`window.INTACT`, and the banner says: *"sign this sentence nowhere but
here: whoever holds that signature can read your sealed messages; there is
no forward secrecy."*

Two slabs on Identity, strictly `HOLD`: `keys.setEncryptionKey(3, 0x04‖x‖y)`
then `parley.bindKey(id)`. After the receipt `keyOf(id)` answers
`(3, keccak(pk), pk)` and Identity prints *"bound at epoch <e>"*.

The social lane arms a DM by reading `keyOf(me)` (your own key first: a
mismatch is *"the key this wallet derives is not the one #me bound — bind
again"*) and `keyOf(other)` (*"#other has no key — this room cannot be
sealed"*). Then **inside the slab's go handler, immediately before every
send**, the `recheck` hook re-reads `parley.keyOf(to)` and
`hub.custodyEpoch(id)`, and refuses with a sentence — never downgrades to
plain text — when the key moved (*"#other's key moved — review again"*),
when `keyType` is not P-256 (`3`) (*"#other's key is not a P-256 key; this
page cannot seal to it"*), or when `crypto.subtle` is undefined (*"sealing
needs a secure origin"*). The envelope is `encryptWhisper(context, text,
hexPublic(pk), mine)` with `context = messageContext(whisperScope(chainId,
hub, parley, me, myEpoch), other, otherEpoch, keyId, myKeyId)`; the
`expectedKeyId` word is `keyOf(to)`'s word 1 as read. Decrypting trusts the
envelope's epoch and key-version fields after the six fixed fields
(label, chain, hub, parley, from, to) match — the context is the AAD, so a
tampered field still fails AES-GCM — and archives sealed under an earlier
epoch still open. A row that will not open renders *"— a sealed message —"*.

## 10. Hosts, names and paths (D14)

No document names a URL of any kind: no `rpc`, no explorer, no gateway
host. The viewer prints the `web3://` link (`#link-web3` =
`web3://<premises>:<chainId>/token/<id>/live`), the QR of it, and a
**template** twin in `#link-https`:
`https://<gateway>/<premises>:<chainId>/token/<id>/live` with the
placeholder `<gateway>` visible. On a real origin the twin is
`location.origin + location.pathname`. Chain names come from a table in the
shell — `{1: "Ethereum", 10: "OP Mainnet", 8453: "Base", 84532: "Base
Sepolia", 11155111: "Sepolia", 31337: "local"}` — and an unknown id prints
*chain <n>*.

**Paths are resolved from a base, never from the root.** The twin the
shell itself prints puts the document at `/<premises>:<chainId>/token/<id>/live`
on a path-based gateway, where a root-relative `/panel/swap.js` would hit
the gateway's root (whatever answered would be hash-refused — safe, and
every lane dead) and a root-relative `/token/<id>/live` after a mint would
leave this Premises. So `BASE` is the pathname up to `/token/` when the
path has one, and otherwise the pathname less its trailing slash — `""` on
`/`, `"/<premises>:<chainId>"` on a path-based gateway's collection page,
so a mint from `/<premises>:<chainId>/` stays on that Premises (boot R11
asserts both) — the panel loader fetches `BASE + "/panel/" + name + ".js"`,
the mint flow navigates to `BASE + "/token/" + id + "/live"`, and the
directory's links are `BASE + "/token/" + id + "/live"`. (`Premises._moved`
emits root-relative `Location` headers for `/k` and `/c`; that is U8's
file and is noted for the integration agent, not changed here.)

verify-site asserts: no `rpc` key anywhere in the shipped shell, no
`fetch(` outside the panel loader, no `https?://[a-z0-9.-]+\.(org|com|io|xyz|net)`
after the one permitted literal is removed (§13), no `wss?://`.

## 11. Session mode (D13)

`?as=0x<40 hex>` on a real origin. `body.dataset.mode = "session"`; Home
(`#session`) prints *"this page acts as key 0x… for #<id>"*,
`reach.sessionOf(key)` in words (kind, expires, native cap and spent, uses
left, interval), `reach.sessionExposure(key)`, and whether
`rightsOf(id, key)` carries `SESSION`. `body.dataset.rights` and
`rights()` carry `bits & 128` only — `?as=<the holder's own address>`
reads `"0"` — and `gate()` prints the session sentence for any other bit.
Every holder control is hidden (`INTACT.ui.act` renders nothing in session
mode; `propose` refuses). A connected wallet whose account is not the key
is refused with *"this page acts as key 0x…; the connected wallet is 0x… —
connect the key's wallet"*. The agent lane says *"no executeAsSession
composer until U17"*. A malformed `as` is ignored and the page boots as
the console.

## 12. The clock (D11)

Every deadline the page writes into calldata — `swapExactIn`/`swapExactOut`'s
`uint64 deadline`, `buy`'s, `whisperStamped`'s window arithmetic,
`executeTyped`'s — is `eth_getBlockByNumber("latest", false).timestamp + 900`
(`INTACT.ui.clock()` + 900n); the slab says *"dies in fifteen minutes"* and
the word is exact on the chain's clock. `clock()` **rejects** when the read
fails or the chain is not `ok`; it never falls back to `INTACT.time` or to
`Date.now()`, and a `propose` whose deadline the panel could not build is
refused with *"the chain's clock could not be read"* — a stale deadline is
worse than no slab. `INTACT.time` is the clock for the **first paint**
only (the countdowns' initial render). `Date.now()` is used only to
animate a countdown between reads. The sniper fee, the fair-window tax
and the launch spacing are countdowns anchored the same way. The suite
tells the two clocks apart by answering `eth_getBlockByNumber` with a
timestamp 7,777 s ahead of the block and requiring the calldata word to
follow the answer.

## 13. The QR (D9)

New code, ≤ 3 KB source. Byte mode, version 5 (37 × 37 modules), error
correction L: 134 codewords, 108 data + 26 EC in one block, 106 bytes of
capacity (the payload `web3://0x<40 hex>:<chainId>/token/<id>/live` is at
most 74 characters; `ethereum:0x<40 hex>@<chainId>` is 60); over 106
bytes `qr()` throws `RangeError("payload over 106 bytes")` and the caller
prints the link alone. Mask pattern 0, format bits computed (`0x77C4` for
L/0). Rendered as inline SVG `<rect>`s with `shape-rendering="crispEdges"`,
a 4-module quiet zone, built with `createElementNS` — never a string of
markup. Two uses: Home (viewer and console) and Vault › Grip
(`ethereum:0x<grip>@<chainId>`).

The namespace literal `"http://www.w3.org/2000/svg"` matches the build's
host scan (`/https?:\/\/[a-z0-9.-]+\.(?:org|com|io|xyz|net)\b/i` — measured
`true` on `createElementNS("http://www.w3.org/2000/svg","rect")`). It is a
namespace identifier, never fetched (`connect-src 'self'` would refuse it
anyway), so it is the **one** permitted literal: `tools/build-app.mjs`
removes exactly that string before the scan, with a comment naming it as
the sole exception, and verify-site's B3 does the same before its own
scan. Splitting it (`"http://www.w3" + ".org/2000/svg"`) to slip past the
scan is forbidden: the suite requires `www.w3` to occur in the shipped
shell exactly once, as the whole literal.

The suite proves three finders, the two timing patterns, the dark module
and a valid format BCH, and decodes it independently — rasterising the
module map at ≥ 4 px per module (≥ 180 × 180 with the quiet zone) before
handing it to `jsqr`, whose locator fails at 1 px per module; without
`jsqr` an independent RS encoder reproduces the 134 codewords.

## 14. Not in the MVB (D5)

Struck from the MVB panels — no rows, no controls, and the lane says so
where a holder would look:

- Parley steward tools: `evict`, `setCooldown`, `hide`.
- `KeyRegistry.revokeEncryptionKey` (a key is replaced by binding again).
- Reach `guardNFT` / `unguardNFT` (pieces are **read** through
  `reach.pieces()`, never guarded from the page).
- Reactions (ERC-7409): the Social lane prints *"reactions unavailable on
  this chain"* everywhere.
- `Market` listing, `Roles`, `Nameplate`/ENS, `AgentCard`, the audit walk,
  the `executeAsSession` composer, v4 positions, trade and inbox history
  views, federation of any kind.

## 15. The eleven sentences and the file that proves each

`tools/verify-site.mjs` runs the groups and prints one `N passed, M
failed` line (≥ 150 assertions in all). **Every group runs on its own
chain**: the runner does `Chain.open()` → `deploySite` → mints the cast for
that group and hands a fresh `ctx` to `run(t, ctx)`, so the state one group
leaves (a panicked #1, an opened market, a sold #3) cannot falsify
another's assertions; measured here, `Chain.open()` + `deploySite` is
≈ 1.2 s and a mint 0.02 s, so six chains cost ≈ 7 s. Each BUILD-PLAN
sentence is an `ok()` string in exactly one group file (D20): the group
ends the block that proves it with `t.ok(blockPassed, "<the sentence
verbatim>")`, and INVARIANTS quotes that string.

| BUILD-PLAN §U9 sentence | Group file |
|---|---|
| the opaque origin boots the viewer and never offers connect | `tools/verify-site/boot.mjs` |
| a tampered panel is refused | `tools/verify-site/boot.mjs` |
| a renter sees the walk and the sentence | `tools/verify-site/social.mjs` |
| an absent Router hides the tab and sets the chip to not reported | `tools/verify-site/swap.mjs` (the chip itself is also asserted in `boot.mjs`) |
| every approval the slab builds is exact | `tools/verify-site/swap.mjs` (with the Launch sell and the Reach approve re-asserted in `launch.mjs`, `vault.mjs`) |
| a non-holder sees the custom error before the wallet opens | `tools/verify-site/swap.mjs` |
| the swap slab states the floor in words | `tools/verify-site/swap.mjs` |
| the composer appears only for HOLD or ACCOUNT | `tools/verify-site/social.mjs` |
| the raise shows the tax as a countdown | `tools/verify-site/launch.mjs` |
| the vault lists open approvals and revokes in one press | `tools/verify-site/vault.mjs` |
| panic lists what it revokes | `tools/verify-site/vault.mjs` |

Plus `identity.mjs` (Identity, the 7702 delegate, the key two-step), and
in `boot.mjs` the collection page and the mint-from-the-page flow, session
mode, discovery and the chain gate, the QR, the loader, escaping, the
self-hash footer, and the panel surface's refusals (`ui.request` of a
sending method, the absence of `$lib` and `INTACT.lib`, the inner-approve
guard). `selftest.mjs`'s fifty chain vectors are unchanged and the two
hard ERC-6551 vectors are added (D12); `gas.mjs` stays green with every
route measured cold (D16).
