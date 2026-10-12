<!-- Reader report from the U9 understand phase (2026-10-08): what the donors contain, measured against their git refs, and what INTACT keeps or drops. Working document; docs/CONSOLE.md and docs/u9/DECISIONS.md record what was decided from it. -->

# U9 reader B — the donor console client as INTACT's lane template

Surface read, byte counts measured here (not quoted from docs):

| Source | Where | Size |
|---|---|---|
| `engine/console.js` | `git show origin/claude/claude-md-docs-8vvyc8:engine/console.js` in `/home/user/Most-Advanced-NFT-Possible` | 16,573 B, 379 lines |
| `engine/console-lanes.js` | same ref | 53,097 B, 1,143 lines |
| `engine/console.css` | same ref | 18,359 B, 300 lines |
| `src/ConsoleRead.sol` (`sels()`) | same ref, lines 209–265 | the 29-entry `CON.sel` table |
| `src/PageConsole.sol` (`_seedWho/_seedWhat/_seedTrade/_seedTalk/_seedPort`) | same ref, lines 395–520 | the `window.CON` shape |
| `src/Chrome.sol` `WALLET_JS` | working tree (branch `claude/special-work-continuation-0l0uhq`, HEAD `297e936`), lines 266–320; picker CSS lines 186–199 | 2.6 KB of JS |
| `src/DeskSeal.sol` `SEAL_JS` | working tree, 145 lines (identical on the fetched branch except the banner wording at 131–158) | — |
| `src/Desk.sol` `window.IP` | working tree, lines 213–346 (`W`, `call`, `tryCall`, `word`, `connect`, `send`) | — |
| IPSEITY PR #27 | `gh api repos/venividis/Most-Advanced-NFT-Possible/pulls/27` and `/files` | `src/DeskSeal.sol +12 −4` |
| `/home/user/Special/engine/whispers.mjs` | 220 lines | 9,066 B |
| `/home/user/Special/src/interfaces/IParley.sol`, `IKeyRegistry.sol`, `src/Parley.sol` | — | — |
| `/home/user/Special/src/Catalog.sol` `SERVICES` rows, `word()` | lines 359–520, 645–662 | the `INTACT.sel` key shape |
| `/home/user/Special/tools/build-app.mjs`, `tools/fixtures/app-placeholder.html`, `tools/fixtures/panels/social.js` | — | the build gate and the U7 panel contract |

Line numbers below are the line numbers of the file named in the heading (from `cat -n` of the `git show` output).

Two findings worth stating before the detail, because they change what the shell author must do:

1. **PR #27's per-send key re-read is not in any checked-out `DeskSeal.sol`.** The PR (`Revalidate armed DM keys and add Parley migration path`, merged 2026-09-16) has base branch `codex/propose-fix-for-sealing-client-vulnerability`, merge commit `d4843cc9…` — that object is not in the local clone and no fetched ref's `src/DeskSeal.sol` contains `PEER`. The working-tree `seal` (lines 89–92) encrypts with a cached `KEY` and never re-reads. The rule therefore has to be taken from the PR's patch, quoted in full in §4.3.
2. **A panel cannot contain ES-module syntax.** `tools/build-app.mjs` `shrinkPanel` (139–149) runs terser with `module: false` and then `new vm.Script(r.code)`; measured here, `vm.Script` throws `Unexpected token 'export'` and `Cannot use import statement outside a module`. So `whispers.mjs` must be inlined at build time with its `export` keywords stripped (§4.6).

---

## 1. `console.js` — structure, helpers, wallet, words

### 1.1 Structure

One IIFE (`(function () { "use strict"; var C = window.CON; if (!C) return; … })();`, lines 38–379) over the state the contract wrote as `window.CON` (PageConsole `_seed`, line 406: `"<script>window.CON={", _seedWho, _seedWhat, "};</script>"`). Sections, by box-header:

| Lines | Section | What it does |
|---|---|---|
| 43–53 | helpers | `$`, `esc`, `short` |
| 55–68 | the ticker | `say(msg, kind)`; `C.say = say` |
| 70–165 | the walk | `readWalk`, `walk`, `MAX_DEPTH = 3`, `paintWalk`, `frag`, `walkTo`, `walkOut`; `C.walkTo = walkTo` |
| 167–287 | the wallet | `paintAccount`, `paintChain`, `checkChain`, `switchChain`, `connect(loud)`; `C.connect = connect`; crest-cell click; `accountsChanged`/`chainChanged` listeners |
| 289–314 | the seven, and the words | `WORDS`, `ALIAS`, `openVerb(i)`, `.vb` click wiring |
| 316–354 | the command line | `run(raw)`; `C.run = run`; `#cin` Enter; `#palbtn` focus |
| 356–378 | arrival | `paintWalk(); C.ready = connect(false);` Escape / `/` keys |

### 1.2 The helpers (verbatim)

```js
var $ = function (s) { return document.querySelector(s); };                       // 43
var esc = function (s) {                                                           // 44–48
  return String(s).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
};
/*  Always with the spaces around the ellipsis: an address printed without
    them reads as one word and gets copied wrong.                       */
var short = function (a) {                                                         // 51–53
  return !a || /^0x0{40}$/i.test(a) ? "nobody" : a.slice(0, 6) + " … " + a.slice(-4);
};
```

`esc` is used exactly once (line 340, inside a `say()` whose sink is `textContent`) — it is HTML-escaping a string that never reaches HTML, i.e. redundant. INTACT keeps `short` and `$` and drops `esc`: chain strings reach the DOM through `textContent` only, so there is no HTML sink to escape for (the build gate `FORBIDDEN` refuses any `innerHTML =` anyway).

The ticker (59–68):

```js
var tickT = 0;
function say(msg, kind) {
  var t = $("#tick");
  if (!t) return;
  t.className = kind || "";
  t.textContent = msg;
  clearTimeout(tickT);
  tickT = setTimeout(function () { t.classList.add("fade"); }, 7000);
}
C.say = say;
```

One line, `kind ∈ {"", "ok", "err"}`, fades to opacity .55 after seven seconds and never disappears; there is no toast stack. **Keep verbatim** for INTACT (rename `C` → the shell's own namespace).

### 1.3 The walk (drop)

Lines 70–165 and the `frag(walk)` suffixes at 156, 164, 308, 376: an `id:hue` list carried in the URL fragment (`/c/1024#w=2049:214`), painted as 22-px margin bands (`.sub.past`, `.rung`) and crumbs in `#walk`. Its `paintWalk` contains the file's one `innerHTML` (line 127, `crest.innerHTML = "";` — a clear, no chain string). INTACT's screens are fragment-routed within one document (`#swap`, `#social`, …, DESIGN §1), so the fragment is already taken, the "walk into another token" is a navigation to `/token/<id>/live`, and the margin bands have no meaning. **Drop** `readWalk`, `walk`, `MAX_DEPTH`, `paintWalk`, `frag`, `walkTo`, `walkOut`, `.rung`, `.sub`, `#walk .cr`, `--walk`, `--own`. (Lane 7 — "look at another one" — goes with it; INTACT has no such lane.)

### 1.4 How it finds the wallet (replace)

Every provider reference is `window.ethereum` directly: lines 185 (`if (window.ethereum)` to decide whether the crest cell offers connect), 223 (`checkChain`), 234 (`switchChain`), 249 (`connect`), 282–285 (listeners). There is no EIP-6963, no picker, no memory. The flow is otherwise right and INTACT keeps its *shape*:

```js
function checkChain() {                                                            // 222–231
  var eth = window.ethereum;
  if (!eth || !C.chain) return Promise.resolve(undefined);
  return eth.request({ method: "eth_chainId" }).then(function (h) {
    var n = parseInt(h, 16);
    C.chainOk = (n === Number(C.chain));
    if (!C.chainOk) paintChain(n);
    return C.chainOk;
  }).catch(function () { C.chainOk = undefined; return undefined; });
}
function switchChain() {                                                           // 233–246
  var eth = window.ethereum;
  if (!eth) return;
  eth.request({ method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x" + Number(C.chain).toString(16) }] })
    .then(function () { say("The wallet moved to chain " + C.chain + ".", "ok"); C.chainOk = true; connect(false); })
    .catch(function () { say("The wallet does not know chain " + C.chain + ". Add it there, then return.", "err"); });
}
function connect(loud) {                                                           // 248–266
  var eth = window.ethereum;
  if (!eth) { if (loud) say("No wallet in this browser. Everything above is still true.", "err"); return Promise.resolve(null); }
  return eth.request({ method: loud ? "eth_requestAccounts" : "eth_accounts" })
    .then(function (a) {
      var acct = a && a[0] ? a[0] : null;
      C.account = acct;
      paintAccount(acct);
      if (loud && acct) say("Connected as " + short(acct) + ".", "ok");
      return checkChain().then(function () { return acct; });
    })
    .catch(function (e) { if (loud) say(e && e.message ? e.message : "The wallet refused.", "err"); return null; });
}
```

Three things to note against INTACT's rules:

- `connect(false)` runs `eth_accounts` *before* `eth_chainId` (line 254 then 260). DESIGN §5.4 says `eth_chainId` is compared **before any read**. `eth_accounts` is a wallet query, not a chain read, so the order is defensible, but the shell must not issue a single `eth_call` until `chainOk === true`; the donor's `C.chainOk === undefined` ("a provider that cannot say") is allowed through for sends (`propose` line 161 refuses only `=== false`). INTACT should refuse reads and sends on `undefined` too, printing "the wallet did not say which chain it is on".
- `connect(true)` is the only `eth_requestAccounts` and is reached only from a click (272–276) or the typed word `connect` (327). In INTACT the opaque `data:` viewer must never reach it: gate on the `localStorage`-throws detector before wiring the crest cell.
- The listeners (282–287) re-run `connect(false)` on both `accountsChanged` and `chainChanged` — this is where INTACT re-reads `rightsOf(id, account)` and repaints `body.dataset.rights` (the donor only repaints the crest, `paintAccount` 180–201, and sets `C.account`). `paintAccount` decides "you" by `acct.toLowerCase() === C.owner.toLowerCase()` (196) — INTACT replaces that with the `R_HOLD` bit.

### 1.5 `WORDS` / `ALIAS` (lines 291–304)

```js
var WORDS = ["", "turn", "hold", "trade", "hand", "speak", "make", "look"];
var ALIAS = {
  turn:  "commit rotate section hue face pin word cut",
  hold:  "vault reach grip seal lock send balance call assets",
  trade: "market pool swap fee bond curve liquidity exchange",
  hand:  "transfer sell rent lease will estate consign heir keys session give",
  speak: "chat say dm whisper room rooms roster sign verify commons",
  make:  "mint draw launch coin hook name ens renew issue",
  look:  "gallery collection open markets scan address nest another"
};
```

`WORDS` is held string-for-string equal to `PageConsole.verbWord(i)` by `verify-console.mjs`; `ALIAS` is JS-only (each alias key must name one of the seven). `run(raw)` (318–341): `#1234` → `walkTo`; `connect` → `connect(true)`; a head word equal to a `WORDS[i]` or `String(i)` → `openVerb(i)` (a navigation to `/c/<id>/<word>`); an alias → the same; anything else → `say("No word here is “…”. Try a verb, or #first.", "err")` — "unknown input is an error sentence, never a guess."

INTACT's `verbWord(1..7)` is `home, swap, social, launch, vault, identity, agent` (INTERFACE-CHANGES.md, U7); the panel order `swap, social, launch, vault, identity, agent` = `verbWord(2..7)`. If the shell keeps a command line it keeps `run` with `WORDS = ["", "home", "swap", "social", "launch", "vault", "identity", "agent"]`, `openVerb(i)` becomes `location.hash = "#" + WORDS[i]` (no navigation, no `frag`), and a new `ALIAS` is written against INTACT's screens (e.g. `swap: "market pool trade quote deposit withdraw fee seal curve"`, `vault: "reach grip seal session sessions steward panic approvals"`). Whether the words exist twice (a `verbWord` in Solidity) is U7's call; the placeholder shell derives its nav from `Object.keys(INTACT.panels)` (app-placeholder.html 129–135), which is the one-copy option.

### 1.6 What INTACT keeps / drops from `console.js`

Keep: `$`, `short`, `say` (ticker), the chain-check → switch → connect state machine (with the chooser's provider in place of `window.ethereum`), the crest cell as the single connect/switch control (269–276), the `accountsChanged`/`chainChanged` repaint (282–287, extended to recompute rights), `C.ready` as the promise lanes wait on (367; the comment at 362–365 records why: a lane painted before the wallet answered contradicted the crest), the Escape/`/` keys (371–378), the `run` shape. Drop: `esc`, the whole walk (70–165, `frag`, the `#w=` fragment, the margin bands), `openVerb`-as-navigation, lane 7, `C.first/C.last` band checks (INTACT's state block carries `band`, `bandLo`, `bandHi` if a band sentence is wanted).

### 1.7 The `window.CON` shape the lanes read (for the state-block mapping)

From `_seedWho`/`_seedWhat`/`_seedTrade`/`_seedTalk`/`_seedPort` (PageConsole 413–506): `id, chain, hue, word (decimal string), hub, read, owner, reach, grip, reported, first, last, verb, [pool], [mkt:{open,fee,base,quote}] (only when reported&0x02), [user, userX] (only when reported&0x10), [parley, said] (only when Parley has code and `topics()` answered), [port, echoed, eids], sel:{…}`. Set by the client: `chainOk, account, say, connect, walkTo, run, ready, propose`. The seed's rule — "only the keys whose contracts ANSWERED; an absent key is 'no answer'" — is INTACT's `reported`/`absent` pair expressed as key presence. INTACT's `Catalog.state` (TPL_TOKEN) always emits the keys and carries `reported` and `absent` bitmasks plus `bits:{reach:1,pool:2,parley:4,postage:8,locks:16,launchpad:32,steward:64,router:128,market:256,roles:512,keys:1024,agentcard:4096}`; the panels must test `INTACT.reported & INTACT.bits.pool`, never a literal (the donor's literals `& 2` = pool and `& 16` = the hub's `userOf` do **not** match INTACT's numbering: 16 is `locks` there).

---

## 2. `console-lanes.js` — the ABI coder, slab, furniture, seven lanes

### 2.1 Head (lines 36–112)

```js
var C = window.CON; if (!C) return;
var $ = function (s) { return document.querySelector(s); };
var say = C.say || function () {};
var pad = function (h) { return h.replace(/^0x/, "").padStart(64, "0"); };          // 45
var enc = {                                                                         // 46–49
  addr: function (a) { return pad(String(a).toLowerCase()); },
  uint: function (n) { return pad(BigInt(n).toString(16)); }
};
```

**Word padding**: every argument is one 32-byte word, `pad` strips `0x` and left-pads to 64 hex chars; `enc.addr` lowercases (so a checksummed input encodes correctly), `enc.uint` goes through `BigInt` (so `bool` is `enc.uint(1|0)`, `uint8/16/64` are `enc.uint`). Dynamic `bytes` are hand-laid: offset word, length word, data right-padded to a 64-char boundary (`hx + "0".repeat((64 - (hx.length % 64)) % 64)`, line 1035). No ABI library; "the four shapes this file needs" (header 24–27).

Amount helpers, all BigInt, no float anywhere:

- `wei(s)` (50–58): decimal string → wei; `/^(\d*)(?:\.(\d*))?$/`, fraction cut to 18 and right-padded; returns `null` on a non-number.
- `eth(v)` (59–67): wei → up to 5 decimals, trailing zeros stripped; prints `"<0.00001"` for nonzero dust ("Dust is still custody. A balance that rounds to zero and prints as zero is a lie").
- `units(s, dec)` / `amt(v, dec)` (73–86): the same two moves for an ERC-20 at `dec` decimals (6 shown, `"<0.000001"` dust); callers never call them with `dec == null` — "an amount scaled by a guessed exponent is wrong by factors of ten".
- `utf8hex(s)` (91–95) and `deHex(hex)` (96–104): UTF-8 via `unescape(encodeURIComponent)` / `decodeURIComponent` — ES5 on purpose; `deHex` returns `null` for non-UTF-8 ("a fact about the bytes, not an error to hide"). INTACT may use `TextEncoder`/`TextDecoder` (the shell's wallet library already does; `whispers.mjs` requires them).

```js
function provider() { return window.ethereum || null; }                             // 106
function call(to, data) {                                                           // 108–112
  var p = provider();
  if (!p) return Promise.reject(new Error("no wallet"));
  return p.request({ method: "eth_call", params: [{ to: to, data: data }, "latest"] });
}
```

**All** reads and sends in this file go through `provider()` — this is the one line U9 replaces: reads through the chooser's `pv()`, sends through `choose()` (§3). Uses of the provider: `call` (108), `watch` (126), `propose` (191), lane 2 `eth_getBalance` (357, 368), lane 5 `eth_getLogs` (878, 899, 982, 1014).

### 2.2 `watch(h)` — verbatim (lines 125–151)

```js
function watch(h) {
  var p = provider();
  if (!p) return;
  var tries = 0;
  var poll = function () {
    tries += 1;
    p.request({ method: "eth_getTransactionReceipt", params: [h] })
      .then(function (r) {
        if (r && r.blockNumber) {
          var n = parseInt(r.blockNumber, 16);
          if (r.status === "0x0") {
            say("It reverted in block " + n + ". Nothing changed.", "err");
          } else {
            say("Mined in block " + n + ". What this page shows may lag it by one.", "ok");
          }
          return;
        }
        if (tries === 22) say("Still not mined. The chain is slow or the fee was low.");
        if (tries < 45) setTimeout(poll, 4000);
        else say("Not mined after three minutes. The wallet may still land it — check there.");
      })
      /*  A wallet that cannot answer for receipts is not a failure of
          the transaction — stop asking rather than guessing.          */
      .catch(function () {});
  };
  setTimeout(poll, 4000);
}
```

45 polls × 4 s = three minutes (DESIGN §1 "a three-minute receipt watcher"). INTACT adds, inside the mined branch: re-read `rightsOf(id, account)` and `custodyEpoch(id)`; if either changed, `say("ownership or epoch changed — review again")` and discard any open slab.

### 2.3 `propose(title, lines, tx, fn)` — verbatim (lines 153–202)

```js
function propose(title, lines, tx, fn) {
  var box = $("#cbox"), slab = $("#cslab");
  if (!box || !slab) return;

  /*  The wrong chain refuses HERE, before a slab exists — §E.5. The
      crest already offers the move; a slab built for the wrong chain is
      a trap with a countdown. Unknown is not wrong: a provider that
      cannot say its chain leaves the wallet's own guard in charge.    */
  if (C.chainOk === false) {
    return say("Your wallet is on another chain. This token lives on chain " +
               C.chain + " — the crest offers the move.", "err");
  }

  slab.innerHTML =
    '<div class="k" style="margin-bottom:10px"></div>' +
    '<div class="body"></div>' +
    '<button class="b" type="button" data-go>1</button>' +
    '<button class="b g" type="button" data-no>Not now</button>';
  slab.querySelector(".k").textContent = title;
  var body = slab.querySelector(".body");
  var put = function (k, v) {
    var d = document.createElement("div");
    d.className = "kv";
    var a = document.createElement("span"); a.className = "k"; a.textContent = k;
    var b = document.createElement("span"); b.className = "v"; b.textContent = v;
    d.appendChild(a); d.appendChild(b); body.appendChild(d);
  };
  lines.forEach(function (l) { put(l[0], l[1]); });
  put("To", short(tx.to));
  if (tx.value) put("Value", eth(BigInt(tx.value)) + " ETH");
  if (tx.data && tx.data.length >= 10) put("Function", (fn ? fn + " · " : "") + tx.data.slice(0, 10));
  slab.querySelector("[data-go]").textContent = "Sign it";
  box.classList.add("on");

  var shut = function () { box.classList.remove("on"); };
  slab.querySelector("[data-no]").onclick = shut;
  slab.querySelector("[data-go]").onclick = function () {
    shut();
    var p = provider();
    if (!p || !C.account) return say("Connect a wallet first.", "err");
    say("Waiting for the wallet…");
    p.request({ method: "eth_sendTransaction", params: [Object.assign({ from: C.account }, tx)] })
      .then(function (h) {
        say("Sent · " + h.slice(0, 10) + "… — watching for the block.", "ok");
        watch(h);
      })
      .catch(function (e) { say(e && e.message ? e.message : "The wallet refused.", "err"); });
  };
}
C.propose = propose;
```

Arguments: `title` (string, uppercased by convention), `lines` (array of `[k, v]` string pairs, every `v` already in words/BigInt-formatted), `tx` (`{to, data?, value?}` — `value` is a `"0x…"` hex string, `data` is `sel + words`), `fn` (the human signature printed beside the 4-byte prefix). What the slab always prints: every line, `To` (shortened), `Value` (if any), `Function` (name · selector).

Changes U9 must make to this exact function:

- **`slab.innerHTML = …` (166–170) must go.** It carries no chain string (a static template), but `build-app.mjs` `FORBIDDEN` (`\binnerHTML\s*=`) refuses the whole build. Build the four nodes with `el()` and `slab.replaceChildren(...)`.
- **Insert `eth_estimateGas` between the press and `eth_sendTransaction`** (DESIGN §1 "every write goes through the slab: `eth_estimateGas` first, custom errors decoded from the `err` table"): on revert, the error data's first four bytes are looked up in `INTACT.err` (`{"0x…":"NotHolder",…}`) and the sentence replaces the slab's button — "a non-holder sees the custom error before the wallet opens" (U9 test).
- **Re-read `custodyEpoch(id)` immediately before `eth_sendTransaction`** (SERVICES row `custodyEpoch|H|custodyEpoch(uint256)|r|d|re-read before every send`); if it differs from `INTACT.epoch` (or the last read), refuse and say "ownership or epoch changed — review again".
- **Print the calldata digest and the engine hash** (DESIGN §1: "To / Value / Function / arguments / calldata digest / engine hash") — the shell has keccak (placeholder shell lines 97–119 carry a 2 KB BigInt keccak; the real shell has the wallet library's), so `put("Calldata", keccak(tx.data).slice(0,18)+"…")` and `put("Engine", INTACT.engineHash.slice(0,18)+"…")`.
- **Send through the chosen provider**: `p = await IW.choose()`; `from` must be the account that `rightsOf` was computed for.
- Refuse on `chainOk !== true` (not only `=== false`).

### 2.4 Furniture (lines 204–267)

```js
var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
function kv(parent, k, v) { var d = el("div", "kv"); d.appendChild(el("span", "k", k)); d.appendChild(el("span", "v", v)); parent.appendChild(d); return d; }
function button(parent, label, grey, fn) { var b = el("button", "b" + (grey ? " g" : ""), label); b.type = "button"; b.addEventListener("click", fn); parent.appendChild(b); return b; }
function field(parent, label, placeholder) { parent.appendChild(el("div", "k", label)); var i = el("input"); i.type = "text"; i.placeholder = placeholder || ""; i.autocomplete = "off"; parent.appendChild(i); return i; }
var short = …;                                                                       // 238–240, same as console.js
function note(parent, text, cls) { var p = el("p", "blurb" + (cls ? " " + cls : ""), text); parent.appendChild(p); return p; }
function unbuilt(parent, what) { var p = el("p", "s", what); p.style.color = "var(--warn)"; p.style.marginTop = "16px"; parent.appendChild(p); }
```

Every text node is `textContent`. `kv` returns the row so callers update `row.lastChild.textContent` later (the "reading… → value / not reported" pattern). Keep all of it.

### 2.5 Rights: `mine()` / `onlyHolder()` (lines 258–267)

```js
var mine = function () {
  return !!(C.account && C.owner && C.account.toLowerCase() === C.owner.toLowerCase());
};
function onlyHolder(parent) {
  if (mine()) return true;
  note(parent, C.account
    ? "You are reading somebody else's token. Nothing here will sign."
    : "Connect a wallet to act on this token.");
  return false;
}
```

The donor has one right (holder by address equality) and one sentence per state (connected-but-not-holder / not connected). INTACT replaces `mine()` with bit tests on the shell's `rights` (from `rightsOf(id, account)` → `uint16 bits`, mirrored in `INTACT.rights = {HOLD:1,ACCOUNT:2,USE:4,CUSTODY:8,ROLE:16,DELEGATE:32,GUARDIAN:64,SESSION:128}`):

- `canAct = bits & (HOLD|ACCOUNT)` — composer, swap-market ops, launch, Reach ops ("the composer appears only for HOLD or ACCOUNT").
- `holds = bits & HOLD` — grant sessions, seal, steward, `bindKey`, guardian/user/agent wallet, first launch, list.
- `bits & USE` — the renter sentence ("you are the user until T"; "a renter sees the walk and the sentence that says why they cannot speak").
- `bits & GUARDIAN` — pause/panic/revokeAllSessions/sealMax only.
- `bits & CUSTODY` — "may transfer only; never acts".
- `bits & DELEGATE` — viewing only; never a write.

`onlyHolder(parent)` becomes `gate(parent, needBits)` returning the same boolean and printing the sentence for the actual rights state (not connected / connected without the bit / renter / guardian / unknown 7702 delegate not yet acknowledged).

### 2.6 The lanes — `LANE[1..7]`

Selectors are `C.sel.<name>`, derived on chain from the signature strings in `ConsoleRead.sels()` (branch, lines 210–244). The donor table, in full:

| `C.sel.` | signature |
|---|---|
| `commit` | `commit(uint256,uint256)` |
| `embody` | `embody(uint256)` |
| `embodyGrip` | `embodyGrip(uint256)` |
| `xfer` | `transferFrom(address,address,uint256)` |
| `mint` | `mint()` |
| `price` | `price()` |
| `open` | `openMarket(uint256,address,address,uint16)` |
| `close` | `closeMarket(uint256)` |
| `setFee` | `setFee(uint256,uint16)` |
| `bond` | `bond(uint256,uint64)` |
| `deposit` | `deposit(uint256,uint256,uint256)` |
| `withdraw` | `withdraw(uint256,uint256,uint256,address)` |
| `quote` | `quote(uint256,bool,uint256)` |
| `swap` | `swap(uint256,bool,uint256,uint256,address,uint256)` |
| `sync` | `syncCurve(uint256)` |
| `drift` | `pendingCurve(uint256)` |
| `approve` | `approve(address,uint256)` |
| `allowance` | `allowance(address,address)` |
| `setUser` | `setUser(uint256,address,uint64)` |
| `lock` / `unlock` / `locked` | `lock(uint256)` / `unlock(uint256)` / `locked(uint256)` |
| `speak` | `speak(uint256,uint256,uint8,bytes)` |
| `state` | `stateOf(uint256)` |
| `balance` / `decimals` / `symbol` | `balanceOf(address)` / `decimals()` / `symbol()` |
| `echoLast` / `echoes` | `lastEcho()` / `echoCount()` |

INTACT's equivalents live in `Catalog.sol` `SERVICES` (lines 359–520) and reach the browser as `INTACT.sel["<word>.<name>"]` where `word` is `hub|pool|reach|parley|roster|postage|keys|kiln|launchpad|coin|locks|steward|router|erc20|engine|catalog` (`word()` 645–662; the key is written at 560–566 as `word(letter) + "." + name`). The mapping per lane is given below; **where the INTACT signature has more words than the donor's, the hand-laid calldata changes** — those are called out.

#### `LANE[1]` — TURN IT (lines 274–348) · *no INTACT equivalent*

Decodes `C.word` (a `uint256` orientation word: six 16-bit plane angles at bits 0–95, cut at 96–111, form at 112–119, hue at 120–127), renders six range inputs + cut + hue (the hue re-tints `--h` live, 316–319), gates on `onlyHolder` (321), and proposes `commit(uint256,uint256)` with `C.sel.commit + enc.uint(C.id) + enc.uint(next)`, printing the moved planes in degrees rather than two raw uint256s (333–343). INTACT has no orientation word; the *technique* to keep is "the slab prints what moved, in words, and the raw value rides in the calldata the slab already names" — e.g. the Identity panel's `setTrait(id, "curve", bps)` slab prints `"curve 3000 bps → 4500 bps"`.

#### `LANE[2]` — PUT SOMETHING IN IT (lines 351–402) · → **vault.js** (Reach / Grip)

- Rows `In the Reach` / `In the Grip` start as `"reading…"`, filled from `eth_getBalance(C.reach|C.grip, "latest")` → `eth(BigInt(b)) + " ETH"`; **no provider → `"not reported"`; a rejected request → `"not reported"`** (360–373; comment: "Not zero. Nobody answered, and those are different facts.").
- Holder half (375+): `embody(uint256)` / `embodyGrip(uint256)` (INTACT creates both accounts in the mint transaction — drop), then "PAY INTO THE GRIP": `wei(amt.value)`, slab lines `["Reversible", "no — nothing can leave the Grip"]`, `tx = { to: C.grip, value: "0x" + v.toString(16) }` (no `data`). INTACT keeps this exactly as the Grip's "permanence warning before any transfer in".
- INTACT additions here: `reach.holdings()` (`holdings() → (uint256 ether_, address[] assets, uint256[] balances, bool[] measured)`), `reach.manifest()`, `reach.pieces()`, `reach.sealedUntil()`, `reach.seal(uint64)` with the ratchet warning, `reach.execute(address,uint256,bytes,uint8)` composer (`operation` 0 only), `reach.openApprovals()` + `reach.revokeOpenApprovals()` ("one-click revoke"), sessions (`grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)`, `sessionExposure(address)`), steward rows, `hub.panic(uint256)` with the double confirm and the revoke list. Every one is a `propose(...)` with the same `[k, v]` discipline.

#### `LANE[3]` — TRADE THROUGH IT (lines 405–706) · → **swap.js**

Gate (409–413): `if (!(C.reported & 2) || !C.pool || !C.mkt) note("No market contract answered on this chain. That is not the same as this token having no market, and the console will not print one as the other."); return;` → INTACT: `if (!(INTACT.reported & INTACT.bits.pool))`, with the two spellings of a clear bit (`absent & bits.pool` → "not deployed on this chain", else "could not be read at block N").

Coins (422–451): `coinOf(a)` caches `{addr, sym: short(a), dec: null}` and fills `sym` from `symbol()` (`decodeSym`: accepts the bytes32 dialect at 64 hex chars or the string dialect at ≥192 with `len ≤ 32`; printable ASCII 1–12 chars or the short address stands in) and `dec` from `decimals()` (`Number(BigInt(r))`); **`dec` stays `null` if `decimals()` did not answer and `parseAmt` then refuses** ("the console will not guess where the point goes", 452–462). INTACT's `TPL_MARKET` already bakes `baseSymbol, quoteSymbol, baseDecimals, quoteDecimals` (via `Web.symbolOf/decimalsOf` on chain), so `coinOf` collapses to reading `INTACT.market` — keep the `dec == null` refusal for any coin the state block does not cover (Elsewhere tab, launch coins).

**Approval — exact, as a step** (464–489):

```js
function stepThenPropose(steps, fin) {
  var i = 0;
  var next = function () {
    while (i < steps.length && steps[i].need === 0n) i++;
    if (i >= steps.length) return fin();
    var s = steps[i];
    call(s.coin.addr, C.sel.allowance + enc.addr(C.account) + enc.addr(C.pool))
      .then(function (r) {
        var have = r && r !== "0x" ? BigInt(r) : 0n;
        if (have >= s.need) { i++; return next(); }
        propose("APPROVE — THE CURRENT STEP", [
          ["Lets", "the market pull exactly " + amt(s.need, s.coin.dec) + " " + s.coin.sym],
          ["Never", "unlimited"],
          ["Then", "press the same button again"]
        ], { to: s.coin.addr, data: C.sel.approve + enc.addr(C.pool) + enc.uint(s.need) },
          "approve(address,uint256)");
      })
      .catch(function () { say("The allowance did not answer.", "err"); });
  };
  next();
}
```

**There is no unlimited approval anywhere in the donor lanes** — `enc.uint(s.need)` is the exact amount, the slab says "Never · unlimited", and the approval is the button's current step, not a separate control. INTACT keeps this verbatim with `INTACT.sel["erc20.allowance"]` / `["erc20.approve"]` and spender `INTACT.pool`. (The BUILD-PLAN line "unlimited approvals replaced by exact amounts" is satisfied by the donor already; `verify-site` should still assert "every approval the slab builds is exact" by scanning every `approve` calldata the slab produced for `!= 2^256-1`, and the build gate refuses the `(1n<<256n)-1n` mask so nobody can write one.) For Elsewhere swaps through the Reach, the wallet approves nothing: `Reach.execute(ROUTER, …)` and the Router's exact-approve-then-zero happen on chain (U8).

Closed market (492–521): `openMarket(uint256,address,address,uint16)` → `C.sel.open + enc.uint(C.id) + enc.addr(b) + enc.addr(q) + enc.uint(f)`. INTACT: `pool.openMarket(uint256 id, address base, address quote, uint16 feeBps, uint24 curveBps, uint16 sniperBps, uint32 sniperSeconds)` — **7 words**; `acts`; "the sniper fee is set here and nowhere else" (SERVICES note).

Open market, anyone with a wallet (523–584): direction chips `buy B / sell B` (`baseIn` bool), amount field, then `stepThenPropose([{coin: IN, need: a}], …)`, then **quoted at review time, every time** (557–560): `call(C.pool, C.sel.quote + enc.uint(C.id) + enc.uint(baseIn ? 1 : 0) + enc.uint(a))`; `minOut = out - out * 50n / 10000n` (0.5 %); `dl = BigInt(Math.floor(Date.now()/1000) + 900)`; the slab states the floor **in words**: `["No less than", minWords + " — or nothing moves"], ["Dies", "in fifteen minutes"]`; calldata `C.sel.swap + enc.uint(C.id) + enc.uint(baseIn?1:0) + enc.uint(a) + enc.uint(minOut) + enc.addr(C.account) + enc.uint(dl)`. INTACT: `pool.swapExactIn(uint256 key, bool baseIn, uint256 amountIn, uint256 minOut, address to, uint64 deadline)` — same six words, payable (native legs: `value` = `amountIn` when the in-coin is `address(0)`; no approval step for a native leg), plus `pool.swapExactOut(key, baseIn, amountOut, maxIn, to, deadline)` / `pool.quoteExactOut`. The U9 test "the swap slab states the floor in words" is this slab.

Holder half (587–696): `deposit(uint256,uint256,uint256)` (INTACT: payable — `value` for a native leg; the slab line `["Counted as", "what actually arrives, not what was sent"]`), `withdraw(uint256,uint256,uint256,address)` (same), `setFee(uint256,uint16)` (same; "refused under seal"), `bond(uint256,uint64)` → INTACT `pool.sealMarket(uint256,uint64)` with the ratchet sentence ("It only ever lengthens, and it survives sale"), `pendingCurve(uint256)` drift row (671–679: three words `drifted, nowBps, wouldBps`; `r.length < 194` → `"not reported"`) + `syncCurve(uint256)` → INTACT `pool.syncCurve(uint256 id, uint24 curveBps, uint24 expected)` where `expected` is the `curveBps` read from `pool.marketOf(key)` in the same review (the chain reverts `CurveMoved` otherwise) and `curveBps` comes from the holder's `curve` trait (`hub.getTraitValue(id, bytes32("curve"))`), `closeMarket(uint256)` (same). "Hidden under a live seal": INTACT hides fee/curve/seal/sniper controls when `INTACT.market.sealUntil > now`.

Link out (701–705): `/swap` → INTACT's Elsewhere tab (`router.quoteExactIn` quote-by-revert, `router.venues()`), hidden when `!(reported & bits.router)`.

#### `LANE[4]` — HAND IT ON (lines 711–825) · → **vault.js** (sell checklist, locks) + **identity.js** (4907 user)

- FOR AN AFTERNOON (715–756): `lent = C.user nonzero && Number(C.userX) > now`; **`if (!(C.reported & 16)) note("Whether it is lent out was not reported.")`** — the bit, not the address ("a hub that did not answer userOf is not a token nobody borrows"). `setUser(uint256,address,uint64)` → `C.sel.setUser + enc.uint(C.id) + enc.addr(a) + enc.uint(x)`; "Take it back now" sends `setUser(id, 0x0, 0)`. INTACT: `hub.setUser` same signature (`holds`); the renter's rights are `R_USE` and the sentence "the borrower runs the instrument, and cannot move the token, spend from its hands, or speak as it" becomes DESIGN's "you are the user until T"; `INTACT.user`, `INTACT.clocks.userExpires`.
- Links (762–770) to `/keys` and `/k/<id>/<key>` — INTACT: Vault › Sessions and the `/k/<id>/<key>` door (`Premises` 301s it to `/token/<id>/live?as=<key>`).
- FOR A SEASON / FOR A PRICE: `unbuilt(...)` sentences (774–778) — the pattern for every INTACT post-MVB surface (Market listing, Roles, agent panel): say it is unbuilt, where a holder would look.
- FOR GOOD (782–824): `locked(uint256)` row (`"not reported"` on `"0x"` or catch), `onlyHolder`, the transfer: `transferFrom(address,address,uint256)` → `C.sel.xfer + enc.addr(C.owner) + enc.addr(a) + enc.uint(C.id)`, refusing a non-address and `a == owner`; `lock(uint256)`/`unlock(uint256)` → INTACT has no holder lock/unlock; `hub.sealTransfer(uint256,uint64)` is the holder's ratchet (≤ 365 d), `locked` is reported by `hub.locked(uint256)` and the state block (`locked`, `lockCount`, `guardianHold`). INTACT's transfer slab must first render the **survives / revoked checklist** (DESIGN §2 "What sale revokes" / "What survives") — "the Vault screen renders the checklist before any `transferFrom` the page proposes" — and should refuse `to ∈ {hub, reach, grip, reachImpl, gripImpl}` client-side (the chain refuses any canonical account; `hub.isCanonicalAccount(address,uint256,bool)` is in `sel` for a pre-check).

#### `LANE[5]` — SPEAK AS IT (lines 828–1056) · → **social.js**

Gate (829–833): `if (!C.parley || !C.said)` → the "no Parley answered … not the same as nothing to say" note. INTACT: `reported & bits.parley`, `INTACT.parley`, `INTACT.topics.said`.

The commons walk (848–931), exactly DESIGN §7.2's reading rule:

```js
function said(log) {                                                               // 861–876
  var d = log.data.slice(2);
  var prev = BigInt("0x" + d.substr(0, 64));
  var kind = parseInt(d.substr(64 * 3, 64), 16);
  var off = parseInt(d.substr(64 * 4, 64), 16) * 2;
  var len = parseInt(d.substr(off, 64), 16);
  var from = BigInt(log.topics[2]).toString();
  var text;
  if (kind === 1) { text = "— a sealed message —"; }
  else { text = deHex(d.substr(off + 64, len * 2)); if (text == null) text = "— not text —"; }
  return { prev: prev, from: from, text: text, muted: kind === 1 || text.charAt(0) === "—" };
}
```

`walk()` (877–925): `call(C.parley, C.sel.state + enc.uint(0))` → `last` = word 0, `count` = word 1 (`r.length < 130` → "The commons did not answer."; `last === 0n` → "Nothing has ever been said in the commons on this chain."); then `step(blk)`: one `eth_getLogs` with `fromBlock = toBlock = blk`, `topics: [C.said, "0x" + "0".repeat(64)]` (room 0 as a 32-byte topic); render that block's logs **newest first** (reverse loop) and follow `said(logs[0]).prev` (the OLDEST message's `prev` — "messages that share a block point within it, and only the first one points out of it"); stop at `prev === 0n` ("All N messages.") or after 12 hops ("…and older messages, back past block B. N ever said here."). No provider → "Reading the commons needs a wallet's node — connect one and the walk starts from the newest block."

**Word offsets change for INTACT.** INTACT's event is `Said(uint256 indexed room, uint256 indexed from, uint64 prev, uint64 prevFrom, uint64 seq, uint8 kind, uint64 reBlock, uint64 reSeq, bytes body)` (IParley.sol:15): data words are `prev`(0) `prevFrom`(1) `seq`(2) `kind`(3) `reBlock`(4) `reSeq`(5) `offset`(6 = 0xe0). So `kind` stays at `64*3` but **`off` moves from `64*4` to `64*6`**, and `reBlock/reSeq` (words 4, 5) are available for the reply thread. `stateOf(uint256)` returns `(last, count, opened, members, kind, open, steward, index, cooldown, uint64[4] headBlocks, uint64[4] headSeqs)` — static, so `last`/`count` stay at words 0/1 (and `heads(uint256[])` returns the head **block**, not a count — INTERFACE-CHANGES.md). Room kinds: commons 0, home `homeKey(token) = keccak(IS_HOME=3, token)`, groups `keccak(1, index)`, pairs `pairKey(a,b) = keccak(IS_PAIR=2, lo, hi)` (Parley.sol 225–240). Home rooms open on the steward's first word (`join` reverts `NoSuchRoom` until then — "this token has not spoken yet"). Followers = `roster.membersOf(uint256 room, uint256 from) → (uint256[] ids, uint256 next)`.

Heard from other chains (933–1019): the `ParleyPort` `Echoed` walk — **drop** (INTACT has no port; DESIGN §7.5 "Federation: none in v1"). Its one reusable sentence is the zero-vs-no-answer pair at 963–969 (`"The port did not answer."` vs `"Nothing has arrived from another chain yet."`).

The composer (1021–1051): `if (mine())` → field "AS #id" placeholder "a log, forever, readable by anyone"; `utf8hex(s)`, `bytes > 1024` refused with the count; calldata `C.sel.speak + enc.uint(0) + enc.uint(C.id) + enc.uint(0) + enc.uint(128) + enc.uint(bytes) + padded` — four head words so the `bytes` offset is 128. Else the sentence: connected → "Only the holder — or the token's own Reach — may speak as it. A renter buys the instrument's use, not its name."; not connected → "Connect the holding wallet to speak as it." INTACT: `parley.speak(uint256 room, uint256 from, uint8 kind, uint64 reBlock, uint64 reSeq, bytes body)` — **six head words, offset `0xc0` = 192**: `sel + W(room) + W(id) + W(0) + W(reBlock) + W(reSeq) + W(192) + W(len) + padded`; the gate is `rights & (HOLD|ACCOUNT)`; `MAX_BODY = 1024` (PLAIN), `MAX_SEALED = 4096`; `Cooldown(uint64 until)` is in `INTACT.err` for the estimate step (commons: two blocks). Whispers: §4.

`unbuilt(h, "Whispers, rooms and what it signs are not built into the console yet…")` (1053) — INTACT builds whispers (DMs), rooms and inbox in this panel.

#### `LANE[6]` — MAKE SOMETHING WITH IT (lines 1059–1092) · → **launch.js** (and the collection document's mint)

Price read before the button (1070–1079): `call(C.hub, C.sel.price)` → `price = BigInt(r)`, row `"… ETH, to the collection"`, else `"not reported"`; the button **refuses to propose when `price == null`** ("the console will not guess a payable value", 1082–1083); `tx = { to: C.hub, data: C.sel.mint, value: "0x" + price.toString(16) }`. INTACT: `hub.mint(address to)` payable — `sel["hub.mint"] + W(to)`, "value is `price()` exactly — the id is in the Transfer log" (SERVICES note); the collection document (`/`) is where the mint lives; the receipt watcher must parse `Transfer(0, to, id)` from the receipt logs to open `/token/<id>/live`. The rest of INTACT's launch panel (`kiln.launch(uint256,string,string,uint8,uint256,bytes32,uint256)`, `kiln.coinAt(...)` preview, `launchpad.create((…14-field tuple…))`/`createChecked(tuple, bytes32)`, `buy(uint256,uint256,uint64,uint16)` payable, `sell`, `graduate`, `fail`, `refund`, `claim`, `quoteBuy/quoteSell`, `snipeTaxBps` as a countdown, `coin.floorPerToken()`) has no donor lane; the discipline is lane 3's: quote at review time, floor in words, exact approvals as steps, `dec == null` refuses.

#### `LANE[7]` — LOOK AT ANOTHER ONE (lines 1095–1121) · *drop*

`field` by number → `C.walkTo`; "NEARBY" chips `#id±1..3` within the band. Depends on the walk; INTACT's directory is `/open` (`pool.openIds`) in the swap panel and the collection document.

#### Arrival (1125–1142)

```js
var lane = $("#lane");
if (lane && C.verb && LANE[C.verb]) {
  Promise.resolve(C.ready).then(function () {
    var n = $("#lane-note"); if (n) n.remove();
    var hold = el("div"); hold.style.marginTop = "14px"; lane.appendChild(hold);
    try { LANE[C.verb](hold); }
    catch (e) { say("This lane failed to open: " + (e && e.message), "err"); }
  });
}
```

Paint **after the wallet answered** (`C.ready`), remove the contract's "controls need a script" note, wrap the builder in try/catch so a thrown lane is a ticker sentence and not a blank. INTACT's panel contract (U7 fixture `social.js`): a panel is `(function(){ var S = window.INTACT; … var host = document.getElementById("lane-<name>"); … S.loaded["<name>"] = true; })();` — it finds its own host, reads state, renders through `textContent`, never calls `eth_requestAccounts`. The shell should expose the helpers above (`say`, `propose`, `watch`, `el/kv/button/field/note`, `enc`, `wei/eth/units/amt`, `call`, `gate`, the chosen provider, `rights`) on one object the panel reads (e.g. `window.INTACT.ui`), and the panel should wait on the shell's `ready` promise exactly as lanes wait on `C.ready`.

### 2.7 Direct `window.ethereum`, approvals, `innerHTML` — the checklist

| Rule | Donor | U9 action |
|---|---|---|
| `window.ethereum` directly | `console.js` 185, 223, 234, 249, 282–285; `console-lanes.js` 106 (`provider()`), used at 126, 191, 357, 368, 878, 899, 982, 1014 | one `provider()` → the chooser's `pv()` for reads, `choose()` for `eth_sendTransaction`/`personal_sign`/`eth_requestAccounts` |
| unlimited approval | none; `stepThenPropose` approves `enc.uint(s.need)` | keep; assert in `verify-site` |
| `innerHTML` | `console.js` 127 (`crest.innerHTML = ""`, walk — dropped); `console-lanes.js` 166 (`slab.innerHTML = <static template>`) | rebuild the slab with `el()` + `replaceChildren()`; the build gate refuses any `innerHTML =` |
| floats | none for amounts (`wei/units/amt/eth` BigInt); `Math.round(v*360/65536)` only for degrees (lane 1), `Number(fIn.value)` for bps (637, 653 — bps are small ints, but INTACT should parse bps with `/^\d+$/` + `BigInt` too) | keep BigInt; replace `Number()` on bps/days with a digits regex + `BigInt` |
| chain check before reads | `checkChain` after `eth_accounts`; `propose` refuses only `chainOk === false` | `eth_chainId` first; refuse reads and sends unless `chainOk === true` |
| "not reported" ≠ 0 | lane 2 balances, lane 3 gate + drift, lane 4 `reported & 16` + bolt, lane 5 gate + port zero-vs-no-answer, lane 6 price | keep the pattern; use `INTACT.bits.<name>` and the `absent` word for the two spellings |
| rights | address equality `mine()` | `rightsOf` bits (§2.5) |
| epoch before send | none | re-read `hub.custodyEpoch(id)` inside the slab's go handler |
| estimate before send | none | `eth_estimateGas` + `INTACT.err` decode |

---

## 3. `Chrome.sol` `WALLET_JS` — the EIP-6963 chooser, transcribed

Source: `/home/user/Most-Advanced-NFT-Possible/src/Chrome.sol` lines 280–320 (`string internal constant WALLET_JS`), served by `wallet()` (266–278) as `<script>…</script>` on every connected page. The header comment (254–265) is the design argument: "EIP-6963 exists so a person with three wallet extensions gets to say which one speaks for them; taking the first announcement defeats the standard — Phantom and Keplr race to announce, and MetaMask loses the sprint on every page load. Every announcer is kept, keyed by rdns. A passive read may use any provider, but Desk chooses one before a read can determine a transaction: otherwise one wallet could supply the terms and another could be asked to sign them. The signing identity is chosen by the stored choice, by being the only wallet, or by the person, from a picker. Clicking your own address clears the choice and asks again."

Unescaped from the Solidity string (the `'`-quoted JS is verbatim; only line breaks and indentation added; one Solidity comment kept as a JS comment):

```js
window.IPW = (() => {
  const P = new Map();
  addEventListener('eip6963:announceProvider', e => {
    const d = e.detail;
    if (d && d.info && d.info.rdns && d.provider) P.set(d.info.rdns, d);
  });
  dispatchEvent(new Event('eip6963:requestProvider'));
  let CHO = null;
  const save = () => { try { return localStorage.getItem('ipse.wallet') } catch (e) { return null } };
  const keep = r => { try { localStorage.setItem('ipse.wallet', r) } catch (e) {} };
  const drop = () => { try { localStorage.removeItem('ipse.wallet') } catch (e) {}; CHO = null };
  const pick = () => {
    if (CHO) return CHO;
    const s = save();
    if (s && P.has(s)) return CHO = P.get(s);
    if (P.size === 1) return CHO = P.values().next().value;
    return null
  };
  const pv = () => {
    const d = pick();
    if (d) return d.provider;
    return P.size ? P.values().next().value.provider : window.ethereum
  };
  const nm = () => { const d = pick(); return (d && d.info.name) || 'injected wallet' };
  /*  Names and icons come from extensions: the name goes in through
      textContent, the icon only if it is a data: image, which is what
      the standard says it is.                                       */
  const ask = () => new Promise(res => {
    const o = document.createElement('div'); o.className = 'wals';
    const c = document.createElement('div'); c.className = 'walc';
    const h = document.createElement('p'); h.className = 'k';
    h.textContent = 'which wallet speaks for you?'; c.append(h);
    for (const d of P.values()) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'walb';
      const i = document.createElement('img'); const ic = String(d.info.icon || '');
      if (ic.startsWith('data:image/')) i.src = ic; i.alt = '';
      const t = document.createElement('span'); t.textContent = d.info.name || d.info.rdns;
      b.append(i, t); b.addEventListener('click', () => { o.remove(); res(d) }); c.append(b)
    }
    const n = document.createElement('p'); n.className = 'e';
    n.textContent = 'Your choice is remembered on this site. Click your address later to switch wallets.';
    c.append(n); o.addEventListener('click', e => { if (e.target === o) { o.remove(); res(null) } });
    document.body.append(o)
  });
  const choose = async () => {
    let d = pick();
    if (!d && P.size > 1) { d = await ask(); if (!d) throw new Error('no wallet chosen'); }
    if (d) { CHO = d; keep(d.info.rdns); return d.provider }
    return window.ethereum
  };
  return { pv: pv, nm: nm, pick: pick, ask: ask, choose: choose, keep: keep, drop: drop,
           all: () => [...P.values()] }
})();
```

Its CSS (Chrome.sol 189–199; the only rules the picker needs):

```css
.wals{position:fixed;inset:0;background:#030204dd;display:grid;place-items:center;z-index:60}
.walc{background:#0b0806;border:1px solid #453a1f;border-radius:.8rem;padding:1.1rem 1.2rem 1.2rem;max-width:20rem;width:92%}
.walb{display:flex;align-items:center;gap:.6rem;width:100%;margin:.5rem 0 0;padding:.6rem .8rem;border-radius:.55rem;background:#0f0c07;border:1px solid #352c17;color:#f4eede;cursor:pointer;font-size:.95rem}
.walb:hover{border-color:#5e4e28;background:#171208}
.walb img{width:22px;height:22px;border-radius:5px}
.walc .e{margin:.85rem 0 0;font-size:.8rem}
```

(Recolour to the console palette in `app.css`: `--void-2`, `--rule-2`, no radius — §5.)

Semantics the shell author must know:

- **`P`** — every announcer, deduplicated by `info.rdns` (the EIP-6963 `announceProvider` detail is `{info:{uuid,name,icon,rdns}, provider}`). The listener is attached and `requestProvider` dispatched at script evaluation; wallets re-announce on request, so a shell that is `document.write`n after inflation still fills `P`. INTACT should also `Object.freeze` nothing here — `P` is private to the closure; "announcements frozen" (DESIGN §5.4) is satisfied by the closure plus not re-dispatching after `choose()`.
- **`pick()`** — the stored rdns if it still announces, else the sole announcer, else `null`. **Never picks among several** — that is `ask()`.
- **`pv()`** — "any provider for a passive read": the picked one, else the *first* announcer, else `window.ethereum`. DESIGN §5.4 "`window.ethereum` only when none announce" is exactly the last branch. INTACT uses `pv()` for `eth_call`/`eth_getLogs`/`eth_chainId`/`eth_accounts`, but only after `eth_chainId` against `INTACT.chainId` on that same provider.
- **`choose()`** — the signing provider: stored or sole → returned and remembered (`keep`); several and none stored → `ask()`; picker dismissed → throws `'no wallet chosen'` (the caller's `say`). Falls back to `window.ethereum` when nothing announced. Every `eth_sendTransaction`, `personal_sign`, `eth_requestAccounts`, `wallet_switchEthereumChain` goes through `await IW.choose()` (that is how `Desk.sol` 302/312/318 use it: `call` → `IW.choose()`, `connect` → `IW.choose()`, `send` → `connect()`).
- **`keep/drop`** — `localStorage` inside `try/catch`, key `'ipse.wallet'` → rename `'intact.wallet'`. In the opaque `data:` viewer `localStorage` throws, `save()` returns `null`, nothing is remembered — correct, and the viewer never calls `choose()` anyway. "Clicking your own address clears the choice and asks again" = the crest cell calls `IW.drop()` then `IW.choose()`.
- **`ask()`** — one overlay, one card, one button per announcer; name via `textContent`; icon only if `data:image/` (CSP `img-src data:` admits it); the sentence under it; click on the backdrop resolves `null`.
- **`nm()`** — the chosen wallet's name for the crest ("read only — connect" → "MetaMask · 0x12… 3456").

INTACT additions after `choose()` (DESIGN §5.4): `eth_chainId` compare (switch button on mismatch); `eth_accounts` quietly then `eth_requestAccounts` on the gesture; `eth_getCode(holder)` — a `0xef0100` prefix names a 7702 delegate, compare its codehash to `Catalog.knownDelegates()`, unknown → hide spend buttons until acknowledged; then one `hub.rightsOf(id, account)`; `body.dataset.rights = bits`.

---

## 4. `DeskSeal.sol` `SEAL_JS` — the seal client, PR #27, and the map to INTACT

### 4.1 What the donor is

`/home/user/Most-Advanced-NFT-Possible/src/DeskSeal.sol` (145 lines; `core()` returns `<script>SEAL_JS</script>`). Header (4–35): the private key is **derived, not stored** — "the hash of a wallet signature over a fixed sentence naming the chain and the token. Signatures from a given key over a given message are deterministic (RFC 6979), so the same wallet derives the same key in every browser forever"; the public point is recovered "by handing WebCrypto the scalar in a PKCS#8 envelope with the public half omitted — the browser computes the point itself on import, which is the one way to get curve arithmetic without shipping any"; the cipher is "static-static ECDH between the two tokens' published points, the shared secret hashed once into an AES-256-GCM key. One key per pair, both directions … there is no forward secrecy, and the page does not pretend otherwise."

It depends on `window.IP` (Desk.sol: `I.pv()` provider, `I.acct()` connected account, `I.D.chain`, `I.W(v) = pad(BigInt(v).toString(16))`, `I.tryCall(to, data) → result | null`, `I.word(r, i)`, `I.send(to, data)`, `I.say`) and on `window.PARL` from `DeskTalk.sol` (`PL.S` selectors, `PL.P` Parley address, `PL.T` page terms `{other, hub, max, room}`, `PL.out(f)` installs the outbound transform, `PL.me()`, `PL.on(f)`, `PL.repaint()`).

### 4.2 The functions, transcribed (lines 48–100, 110–143)

```js
// the order of P-256, for rejecting a hash that is not a scalar
const ORD = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const H2B = h => { h = String(h).replace(/^0x/, ''); const b = new Uint8Array(h.length >> 1);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16); return b };
const B2H = b => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const B64 = u => { const s = atob(String(u).replace(/-/g, '+').replace(/_/g, '/'));
  const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b };

// PKCS#8, P-256, private scalar only — the browser recomputes the public point on import.
// Sixty-seven bytes, thirty-five of them this fixed header.
const PK8 = '3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420';

const derive = async tok => {
  const p = I.pv(), from = I.acct();
  const msg = 'IPSEITY seal v1 · chain ' + I.D.chain + ' · token ' + tok;
  const hex = '0x' + B2H(new TextEncoder().encode(msg));
  const sig = await p.request({ method: 'personal_sign', params: [hex, from] });
  let h = new Uint8Array(await sub.digest('SHA-256', H2B(sig)));
  for (;;) { const d = BigInt('0x' + B2H(h)); if (d > 0n && d < ORD) break;
             h = new Uint8Array(await sub.digest('SHA-256', h)) }
  const priv = await sub.importKey('pkcs8', H2B(PK8 + B2H(h)),
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const jwk = await sub.exportKey('jwk', priv);
  return { priv: priv, x: B2H(B64(jwk.x)), y: B2H(B64(jwk.y)) } };

const onChain = async tok => {
  const r = await I.tryCall(P, S.keyOf + I.W(tok));
  if (!r) return null;
  const x = String(r).slice(2, 66), y = String(r).slice(66, 130);
  return /[^0]/.test(x) ? { x: x, y: y } : null };

const pairKey = async (mine, theirs) => {
  const pub = await sub.importKey('raw', H2B('04' + theirs.x + theirs.y),
    { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const bits = await sub.deriveBits({ name: 'ECDH', public: pub }, mine.priv, 256);
  const k = await sub.digest('SHA-256', bits);
  return sub.importKey('raw', k, 'AES-GCM', false, ['encrypt', 'decrypt']) };

// Keyed by token, because `derive` signs a sentence naming the token
let KEY = null, MY = {};
const seal = async h => { if (!KEY) return { k: 0, h: h };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await sub.encrypt({ name: 'AES-GCM', iv: iv }, KEY, H2B(h)));
  return { k: 1, h: B2H(iv) + B2H(ct) } };

// the renderer hands over every sealed row; rows this pair's key opens become text — textContent only
window.UNSEAL = async (m, p) => { if (m.kind !== 1 || !KEY) return;
  try { const b = H2B(m.body);
    const pt = new Uint8Array(await sub.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, KEY, b.slice(12)));
    p.textContent = new TextDecoder().decode(pt); p.className = 'sealed open' } catch (e) {} };

const arm = async me => { KEY = null; PL.out(async h => ({ k: 0, h: h })); btn.hidden = true;
  if (me == null) { say('connect to seal this room'); return }
  const theirs = await onChain(OTHER);
  const mineOn = await onChain(me);
  if (!mineOn) { btn.hidden = false;
    say('#' + me + ' has no published key — this room sends plaintext until it does'); return }
  // your own key is checked before theirs (INVARIANTS 113)
  MY[me] = MY[me] || await derive(me);
  if (MY[me].x !== mineOn.x || MY[me].y !== mineOn.y) { btn.hidden = false;
    say('the key this wallet derives is not the one #' + me + ' published — publish again to seal, or send plaintext', 1); return }
  if (!theirs) { say('#' + T.other + ' has not published a key — plaintext until they do'); return }
  KEY = await pairKey(MY[me], theirs); PL.out(seal);
  say('sealed · both tokens published under their current holders');
  PL.repaint() };

btn.addEventListener('click', async () => { try {
  const me = PL.me(); if (me == null) throw new Error('connect first');
  MY = await derive(me);
  await I.send(P, S.announce + I.W(me) + MY.x + MY.y);
  await arm(me) } catch (x) { I.say(String(x && x.message || x), 'no') } });
PL.on(me => { arm(me).catch(e => {}) });
```

Where the seal is applied per send: `DeskTalk.sol` 232–243 — `let OUT = async h => ({k:0,h:h}); const send = async(text) => { … const o = await OUT(h0); … d = T.other !== '0' ? S.whisper + I.W(ME) + I.W(T.other) + I.W(o.k) + I.W(128) + ARG(h) : S.speak + …; return I.send(P, d) }` — so `OUT` (installed by `PL.out(seal)`) runs on every send, and `o.k` becomes the `kind` byte.

**`derive`**: `personal_sign` of the fixed sentence → SHA-256 of the 65-byte signature → reject-and-rehash until `0 < d < n` → PKCS#8 import with the 35-byte header → `exportKey('jwk')` for `x, y`. (The scalar's `extractable: true` is needed for the jwk export; whispers.mjs imports the private half **from jwk**, so this is also what INTACT needs.) **`onChain`**: `keyOf(tok)` as two words `(x, y)` — IPSEITY's Parley stored a point; a zero `x` means no key. **`pairKey`**: static-static ECDH → SHA-256 → AES-GCM key. **`seal`/`UNSEAL`**: 12-byte IV ‖ ciphertext, no AAD.

### 4.3 PR #27 — "re-read the recipient's key immediately before every send"

`gh api repos/venividis/Most-Advanced-NFT-Possible/pulls/27`: *Revalidate armed DM keys and add Parley migration path*, merged `2026-09-16T20:51:16Z`, head `codex/fix-high-priority-issues-from-codex-review-tlo4vf`, **base `codex/propose-fix-for-sealing-client-vulnerability`**, merge commit `d4843cc9ec5683d7790cbfde479cf2756185e517` — not present in the local clone, and no fetched ref's `src/DeskSeal.sol` contains `PEER`. Motivation (PR body): "A DM page could remain armed with a cached AES key after the recipient token transferred, allowing the former holder to continue decrypting subsequent messages encrypted to the stale key." The `src/DeskSeal.sol` patch, in full:

```diff
@@ -85,8 +85,16 @@ contract DeskSeal {
         /*  Keyed by token, because `derive` signs a sentence naming the token:
             one cached key compared against another token's published point
             raises a mismatch that never happened.                        */
-        "let KEY=null,MY={};"
-        "const seal=async h=>{if(!KEY)return{k:0,h:h};"
+        "let KEY=null,PEER=null,MY={};"
+        /*  A DM page can remain open across a transfer. The key observed by
+            `arm` is therefore only a snapshot, never authority for a later
+            send. Re-read immediately before every encryption and fail open
+            to plaintext if the registry now reports no key or a rotation. */
+        "const seal=async h=>{if(!KEY||!PEER)return{k:0,h:h};"
+        "const now=await onChain(OTHER);"
+        "if(!now||now.x!==PEER.x||now.y!==PEER.y){KEY=null;PEER=null;"
+        "say('#'+T.other+' no longer has the key this room armed with \\u2014 plaintext until reconnected',1);"
+        "return{k:0,h:h}}"
         "const iv=crypto.getRandomValues(new Uint8Array(12));"
         "const ct=new Uint8Array(await sub.encrypt({name:'AES-GCM',iv:iv},KEY,H2B(h)));"
         "return{k:1,h:B2H(iv)+B2H(ct)}};"
@@ -107,7 +115,7 @@ contract DeskSeal {
-        "const arm=async me=>{KEY=null;PL.out(async h=>({k:0,h:h}));btn.hidden=true;"
+        "const arm=async me=>{KEY=null;PEER=null;PL.out(async h=>({k:0,h:h}));btn.hidden=true;"
@@ -126,7 +134,7 @@ contract DeskSeal {
-        "KEY=await pairKey(MY[me],theirs);PL.out(seal);"
+        "KEY=await pairKey(MY[me],theirs);PEER=theirs;PL.out(seal);"
```

The rule as implemented: `arm` snapshots the recipient's point as `PEER`; `seal` — which runs inside `send()` on every message — calls `onChain(OTHER)` again and compares to `PEER`; on no key or a different point it clears `KEY`/`PEER`, warns, and returns plaintext (`k: 0`). **INTACT does not fail open to plaintext**: a DM composed as sealed must be refused, not downgraded (the chain refuses too — `NoKey` / `KeyMoved`). The PR also added the browser regression "arms a DM page, transfers the recipient token while the page remains open, then asserts the subsequent send did not encrypt with the stale key" — U11's "the sealed DM re-reads the key before every send and refuses after rotation".

### 4.4 INTACT's chain side: `whisper`, `bindKey`, `keyOf`, the registry

`IParley.sol`:

```solidity
function whisper(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body) external;                         // :71
function whisperStamped(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body, address expectedFeeToken, uint128 maxPostage) external payable;  // :72
function bindKey(uint256 token) external;                                        // holds                                                // :84
function keyOf(uint256 token) external view returns (uint16 keyType, bytes32 keyId, bytes memory publicKey);   // zero unless owner and epoch unchanged   // :85
function pairKey(uint256 a, uint256 b) external pure returns (uint256);          // :66
event KeyBound(uint256 indexed token, address indexed owner, uint64 epoch, uint16 keyType, bytes32 keyId);     // :20
error KeyMoved(); error NoKey(); error NotHolder(); error BadBody(); error BadKind(); error TalkingToYourself(); error UseWhisper();
error PostageDue(uint256 to, uint128 postage); error BadReply();
```

How the binding is stored (`Parley.sol`): `struct Binding { address owner; uint64 epoch; }` `mapping(uint256 => Binding) private _bound;` (178–179). **Parley stores no key bytes** — only who bound and under which custody epoch:

```solidity
function bindKey(uint256 token) external {                                            // 535–546
    address o = _ownerOrZero(token);
    if (o != msg.sender) revert NotHolder();
    uint64 epoch = IParleyHub(HUB).custodyEpoch(token);
    _bound[token] = Binding(o, epoch);
    // written first so one reader serves both; a missing key unwinds it
    (uint16 keyType, bytes32 keyId,) = keyOf(token);
    if (keyId == bytes32(0)) revert NoKey();
    emit KeyBound(token, o, epoch, keyType, keyId);
}
function keyOf(uint256 token) public view returns (uint16 keyType, bytes32 keyId, bytes memory publicKey) {   // 550–557
    Binding memory b = _bound[token];
    if (b.owner == address(0) || b.owner != _ownerOrZero(token)) return (0, bytes32(0), "");
    if (b.epoch != IParleyHub(HUB).custodyEpoch(token)) return (0, bytes32(0), "");
    (uint16 kt, bytes memory pk,) = IKeyRegistry(KEYS).getPublicKeys(b.owner);
    if (pk.length == 0) return (0, bytes32(0), "");
    return (kt, keccak256(pk), pk);
}
```

So `keyOf` is a **live** read through the registry: `keyId = keccak256(publicKey)` (the registry's own `keyIdOf(address) = keccak256(publicKey), or zero`), zero after a sale, after an epoch bump (panic), or after `revokeEncryptionKey()`. `KeyRegistry` (`IKeyRegistry.sol`): `setEncryptionKey(uint16 keyType, bytes publicKey)`, `revokeEncryptionKey()`, `keyOf(address) → KeyRecord{keyType, updatedAt, publicKey}`, `publicKeyOf`, `keyIdOf`, `getPublicKeys(address) → (uint16 keyType, bytes publicKey, uint64 updatedAt)`; `KEY_TYPE_P256_ECIES() = 3`. The chain-side guard both whispers share (`_pair`, 335–351):

```solidity
if (from == to) revert TalkingToYourself();
if (_ownerOrZero(to) == address(0)) revert NoSuchToken();
if (kind == SEALED) {
    (, bytes32 keyId,) = keyOf(to);
    if (keyId == bytes32(0)) revert NoKey();
    if (keyId != expectedKeyId) revert KeyMoved();
}
room = pairKey(from, to);
```

Body limits (`_say`, 401): `body.length == 0 || body.length > (kind == SEALED ? MAX_SEALED : MAX_BODY)` → `BadBody`; `MAX_BODY = 1024`, `MAX_SEALED = 4096`, `PLAIN = 0`, `SEALED = 1`. An unstamped whisper to a token that has never written in the pair goes through `_admit` (`inboxOf(to)`: closed → `InboxClosed(to)`, priced → `PostageDue(to, postage)` → the panel offers `whisperStamped` with `expectedFeeToken`/`maxPostage` from `INTACT.inbox` / `postage.inboxOf(to)`).

ABI of `keyOf`'s return as the panel decodes it: word 0 `keyType`, word 1 `keyId`, word 2 offset (`0x60`), word 3 `publicKey.length`, then the bytes (65 for an uncompressed P-256 point `0x04‖x‖y`). `expectedKeyId` is word 1 **as read** — the panel passes it through; it does not need to recompute keccak.

### 4.5 `whispers.mjs` — exports and argument shapes

`/home/user/Special/engine/whispers.mjs`, 9,066 B, header 1–27 (Pixel-Garden `sdk/whispers.mjs` verbatim; the only edits are the two domain labels `intact-whisper/1`, `intact-key-backup/1`). Uses `TextEncoder`, `TextDecoder("utf-8", {fatal:true})`, `btoa/atob`, `crypto.getRandomValues`, `crypto.subtle` (secure context: `https:` gateway, `localhost`, native `web3://` clients that grant it; the `data:` viewer never seals). Private helpers: `bytes, text, b64, un64` (un64 refuses non-base64 or > 200,000 chars), `random(n)`, `subtle()`, `equal(a,b) = JSON.stringify(a) === JSON.stringify(b)`, `pub(b64raw)` → ECDH P-256 public `CryptoKey`, `priv(k)` → imports `k.privateKey` **as JWK** with `deriveBits`, `shared(privateKey, publicKey, salt, context)` → ECDH 256 bits → HKDF-SHA-256 (`salt`, `info = bytes(context)`) → AES-GCM-256 key, `passwordKey` (PBKDF2, 310,000 iterations).

| Export | Arguments | Returns |
|---|---|---|
| `whisperScope(chain, kernel, social, garden, epoch)` (41–47) | chain id, hub address, Parley address, token id, that token's custody epoch (Garden's names: kernel = hub, social = Parley, garden = token) | `[String(chain), kernel.toLowerCase(), social.toLowerCase(), String(garden), String(epoch)]` |
| `publicHex(key)` (49–50) | `key.publicKey` (base64 of the raw 65-byte point) | `"0x04…"` hex — **what goes into `setEncryptionKey(3, publicKey)`** |
| `hexPublic(hex)` (51–52) | `"0x…"` hex of a raw point (what `keyOf` returns as `publicKey`) | base64 raw — **what `encryptWhisper` wants** |
| `createMessagingKey(version)` (53–62) | version string | `{version, publicKey: b64(raw), privateKey: jwk}` — the **key object shape**; INTACT does not generate (derived key), but builds this same shape from `derive()` |
| `messageContext(scope, to, toEpoch, toVersion, fromVersion)` (83–92) | the sender's scope, recipient id, recipient's epoch, recipient's key version, sender's key version | `["intact-whisper/1", ...scope, String(to), String(toEpoch), String(toVersion), String(fromVersion)]` — the AAD prefix |
| `encryptWhisper(context, plaintext, toPublicKey, fromPublicKey)` (93–120) | context array, UTF-8 string of 1–1024 bytes, both public keys as **base64 raw** | `{v:1, context, ephemeralPublic (b64), salt (b64, 32 B), copies:[{iv,ciphertext},{iv,ciphertext}]}` — copy 0 to the recipient (AAD `[...context,"recipient"]`), copy 1 to the sender; throws if `JSON.stringify(envelope)` > 4096 bytes |
| `decryptWhisper(envelope, expectedContext, key, role = "recipient")` (121–141) | envelope object, the context the reader expects, `{privateKey: jwk}`, `"recipient"` or `"sender"` | the plaintext string; throws `Whisper identity mismatch` when `v !== 1`, context differs, role unknown or `copies.length !== 2`; checks salt 32, iv 12, ciphertext 17–1040 |
| `encryptKeyBackup(scope, keys, password)` / `decryptKeyBackup(backup, scope, password)` (154–220) | password 12–1024 chars, 1–128 keys | passphrase backup — **not needed in INTACT v1** (the key is derived, nothing to back up); drop at inline time (≈ 2.4 KB of the 9 KB) |

### 4.6 Including the module in a panel — recommendation: inline at build time

Facts: panels are classic scripts injected as `<script src="blob:…">` after the keccak check (DESIGN §5.2; placeholder shell 141–151); `tools/build-app.mjs` `shrinkPanel` (139–149) minifies with `module: false` and parses the result with `new vm.Script(...)`; measured in this session, `vm.Script` throws on `export` ("Unexpected token 'export'") and on `import` ("Cannot use import statement outside a module"), while terser with `module:false` passes them through — so a `social.js` that `import`s fails the build at the parse step, and a panel shipped with `import` would also fail at runtime as a classic Blob script. A `<script type="module">` Blob is admissible under `script-src 'unsafe-inline' blob:`, but it would make `whispers.mjs` a second resource: either a second Blob URL that the panel `import()`s (then its bytes are not covered by `INTACT.panels.social` unless the shell also pins and hashes it — a second pin for one panel) or a module panel whose own source carries the module (which is inlining anyway, with `module: true` in terser and a `type="module"` attribute the shell must set only for that panel).

**Recommend: inline.** `tools/build-app.mjs` `build()` gains one step before `refuse(js, …)`: if the panel source contains the marker line `/*@inline engine/whispers.mjs*/`, replace it with the module text transformed by `^export (async function|function|const) ` → `$1 ` (every export in the file is one of those three forms — lines 41, 49, 51, 53, 83, 93, 121, 154, 174), optionally dropping `encryptKeyBackup`/`decryptKeyBackup`/`passwordKey`. The result is a classic script inside `social.js`'s IIFE; `dist/panels/social.js` is what is hashed, so the pin covers the crypto bytes; `vm.Script` passes; terser `module:false` is unchanged; nothing else in the pipeline moves. The inline must happen before `refuse` and before the `window.INTACT` presence check (the module itself never reads it). Size: 9,066 B source (≈ 6.6 KB without the backup pair), ≈ 3 KB minified, well inside the panel's ≤ 20 KB source / ≤ 8,192 B gzip. Keep `engine/whispers.mjs` as the single source so `verify-parley`/Node tests can still `import` it.

### 4.7 The INTACT sealing flow for `social.js` (DeskSeal → whispers.mjs)

1. **Derive** (from `derive`, with the sentence from DESIGN §7.3): `msg = "INTACT seal v1 · chain " + INTACT.chainId + " · token " + id + " · epoch " + epoch` where `epoch` is `hub.custodyEpoch(id)` **read live** (not the baked `INTACT.epoch`); `personal_sign` through `IW.choose()` with `from = account`; SHA-256 → scalar loop → `importKey('pkcs8', PK8‖scalar, ECDH P-256, extractable: true, ['deriveBits'])`; `jwk = exportKey('jwk', priv)`; the whispers key object is `MY = { version: <my keyId hex>, publicKey: b64(0x04‖B64(jwk.x)‖B64(jwk.y)), privateKey: jwk }`. The key dies with the epoch by construction (the sentence names it).
2. **Bind** (Identity panel, two slabs, `holds` only): `keys.setEncryptionKey(uint16 keyType, bytes publicKey)` with `keyType = 3`, `publicKey = publicHex(MY)` (65 bytes; ABI: `W(3) + W(0x40) + W(65) + hex65 + pad`), then `parley.bindKey(uint256)`. After the receipt, `keyOf(id)` returns `(3, keccak256(pk), pk)`; the panel shows it as `INTACT.key = {type, id}` / `holderKeyId`.
3. **Arm a DM** (`arm`, kept in shape): `keyOf(me)` → if zero, "#me has no bound key — bind one on Identity" (the composer sends plaintext only if the user chooses so, and says so); compare `publicKey` to `publicHex(MY)` → mismatch is "the key this wallet derives is not the one #me bound — bind again"; `keyOf(other)` → zero means "#other has no key — this room cannot be sealed" (INVARIANTS 113's order: your own key first; the fixing control stays visible).
4. **Send — the per-send re-read (PR #27 + DESIGN §5.4), inside the slab's go handler, after the press and before `eth_sendTransaction`:** `keyOf(other)` again → `(kt, keyId, pk)`; `keyId == 0` or `pk != armed pk` → **refuse** ("#other's key moved — review again"), never downgrade; `hub.custodyEpoch(other)` and `hub.custodyEpoch(me)` → `toEpoch`, `fromEpoch` (the epoch re-read before every send is the same read); `context = messageContext(whisperScope(INTACT.chainId, INTACT.hub, INTACT.parley, me, fromEpoch), other, toEpoch, keyId /*toVersion*/, myKeyId /*fromVersion*/)`; `envelope = await encryptWhisper(context, text, hexPublic(pk), MY.publicKey)`; `body = TextEncoder(JSON.stringify(envelope))` (≤ 4096 by the module); calldata `sel["parley.whisper"] + W(me) + W(other) + W(1) + keyId + W(0xa0) + W(body.length) + hex(body) + pad` (five head words → offset 160); `eth_estimateGas` (decode `NoKey`, `KeyMoved`, `InboxClosed`, `PostageDue`, `Cooldown`); send. The chain's `KeyMoved` is the backstop for a rotation in the mempool.
5. **Read**: walk the pair room `pairKey(me, other)` with the lane-5 stepper (`topics: [said, W(room)]`), `kind === 1` → `JSON.parse(TextDecoder(body))` → `decryptWhisper(envelope, expectedContext, MY, role)` with `role = "recipient"` when `to === me`, `"sender"` when `from === me`; failures render "— a sealed message —" (muted), exactly as `UNSEAL` leaves rows "honestly shut"; `textContent` only.
6. **Say what it is**: the banner states no forward secrecy (header 28–34) and that both keys were bound under their current holders at arm time (the branch's banner, DeskSeal 131–158 on `origin/claude/claude-md-docs-8vvyc8`, also checks the hub's transfer count — INTACT's `custodyEpoch === 1` means "has never moved").

Key versions: INTACT's registry has no version field; using `keyId` (hex) as `toVersion`/`fromVersion` makes a rotation change the AAD as well, which is what the Garden scheme intends.

---

## 5. `console.css` — the visual system, and what `app.css` keeps

18,359 B / 300 lines (raw, never gzipped — "a script-inflated stylesheet means a flash of unstyled console", CLAUDE.md trap 3; INTACT's shell CSS rides inside the gzip body shard, so that constraint is moot, but the minifier in `shrinkShell` only strips comments/whitespace, so the ≈ 10 KB source budget is the real one).

### 5.1 Tokens (`:root`, lines 17–41)

```css
--h:34;                                   /* written by the server from the token's hue */
--a:hsl(var(--h) 92% 66%); --a-dim:hsl(var(--h) 62% 44%); --a-ghost:hsl(var(--h) 92% 66% / .10);
--void:#04050a; --void-2:#070912; --void-3:#0b0e18;
--rule:#151a26; --rule-2:#212838; --rule-3:#2e3648;
--dim:#5d6780; --mid:#8b95ad; --txt:#c8d0e2; --lit:#eef2fb;
--ok:#5fe3b4; --warn:#ffc95c; --bad:#ff6b63;
--mono:ui-monospace,SFMono-Regular,Menlo,monospace;
--ease:cubic-bezier(.22,.61,.36,1);
--crest:46px; --col:300px; --cmd:36px;
--walk:22px;                               /* drop */
--safeT:env(safe-area-inset-top,0px); --safeB:env(safe-area-inset-bottom,0px);
```

Rules of the language (header 8–15, 65, 231–232, 297–300): everything 1 px; no rounded corner except the LED and the scrollbar thumb; no shadow as elevation — a glow means *live*; `--warn` has exactly one meaning ("you can do this, but read this first"), `--bad` is failure or a passed deadline, `--ok` is a live connection / landed tx / bonded market; emphasis is hue, never weight (`b{color:var(--a);font-weight:400}`); read paths grey, write paths accent ("a holder should be able to tell whether a button will cost them anything without reading it"); no ambient motion. The `--h` hue: INTACT has no hue trait; set `--h` from `(id * 137) % 360` or the crest's own colour, written into the state gap or computed by the shell on boot — it must be present before first paint if the colour is to carry meaning.

### 5.2 Type — five classes (72–81)

`.k` 9px/.26em uppercase `--dim` (labels) · `.v` 12px `--lit` (values) · `.n` 11px `--txt` · `.s` 10px/.08em `--mid` · `.blurb` 11px/1.62 `--mid` (the notes) · `.acc .mut .warn .bad .ok` colour words. "The smaller the type, the wider the tracking, the dimmer the colour." Keep all (≈ 0.6 KB).

### 5.3 Layout

- `html,body` (43–46): mono 13px/1.45, `tabular-nums`, `"tnum" 1,"zero" 1`; `body{opacity:0;animation:arrive .9s var(--ease) forwards;overflow:hidden}` — an **animation, not a class the script adds** (47–57: a class once made the whole server-rendered document invisible when the client threw); reduced-motion cuts it (62, 70). Keep.
- The crest (131–164): `#crest` fixed top, `height:calc(var(--crest)+var(--safeT))`, flex of `.cell`s (`.cell .v` ellipsised), `.led` 5 px dot — `.live` green glow, `.ro` accent glow (140–143); `#c-chain` hides under 560 px ("identity gives way before actions do"). Keep minus `#walk .cr` (145–158).
- Two columns (166–180): `#body` fixed between crest and command line, `grid-template-columns:var(--col) minmax(0,1fr)`; `#col` scrolls (the state column), `#lane` scrolls, `border-left`, `max-width:680px`; under 900 px the lane becomes a full-screen sheet `translateY(101%)` → `.on` slides up (`.42s var(--ease)`). Keep: INTACT's Home is `#col`, the active panel is `#lane` (phone: one column, panel as the sheet).
- The still/identity/standing line (182–200): `#still` 184 px bordered (→ the Crest SVG), `#ident h1` 13px 400, `#stand` one standing line, `--warn` when `.soon`, never a stack. Keep (`#still` → `#crest-svg`).
- The verb row (202–228): `.vb` full-width left-bordered buttons, `.on` accent border, `.sub2` sub-line, `.cl` clock (`.soon` warn, `.past` bad), `.shut` keeps its place with a middot (`::after{content:" \00b7"}`) — "nothing in this interface is hidden because it is unavailable". Keep for the six screens' nav.
- Controls (230–264): `.b` (accent outline, uppercase 10px/.24em, inverts on hover), `.b.g` (grey = read path), `.b[disabled]`; inputs `--void-2` background, `--rule-2` border, `border-radius:0`, accent focus; range inputs with a 1 px track and 2 px glowing thumb (246–253 — only for the orientation sliders; drop unless Launch uses a range for terms); `.kv` flex row `space-between` with a `--rule` underline (the slab/row primitive); `hr`; `pre.code`; `.chip` + `.chip.on` (261–264) — the "not reported" chips are `.chip` with `.mut`/`.warn` colour words and the two spellings as text.
- The ticker (266–275): `#tick` fixed above the command line, `.fade` .55, `.ok`/`.err` colours. Keep.
- The command line (277–283): keep if the shell keeps `run`; else drop (≈ 0.4 KB).
- The confirm slab (285–290): `#cbox` fixed full-screen `rgba(4,5,10,.86)` backdrop, `display:none` → `.on{display:flex}`; `.slab` `min(460px,100%)`, `max-height:86vh`, `--void-2`, `--rule-2` border, 18 px padding. Keep verbatim; the slab's rows are `.kv`, its buttons `.b` and `.b.g`.
- Scrollbars 4 px (292–295). Keep.
- The walk (83–128: `.sub`, `.sub.past`, `.sub::before`, `.sub.here::before`, `.rung`) and `#walk .cr` (145–158), `--walk`, `--own`, `left:var(--walk)` on `#crest/#body/#tick/#cmd` → **drop** (≈ 3.5 KB of source including comments; set those `left`s to 0).

### 5.4 Budget

Measured: 18,359 B with its box-header comments. Without comments the rule text is ≈ 9.5 KB; dropping the walk, the range inputs, `#walk`, and the command line leaves ≈ 7 KB; adding the picker (`.wals/.walc/.walb`, recoloured, ≈ 0.4 KB), a QR box, the rights/"not reported" chip variants and the panel sheet brings `app.css` to ≈ 8–9 KB source — inside the ≈ 10 KB budget, and the build's `shrinkShell` strips the comments anyway so the load-bearing comments can stay in `engine/app.css`.

---

## 6. Open questions for the shell author

1. **Decrypting old envelopes.** `decryptWhisper` requires `equal(envelope.context, expectedContext)`; a reader rebuilding `expectedContext` for a message sealed under an earlier epoch or key must know the epochs/keyIds *at seal time*. Options: trust `envelope.context` for the epoch/version fields after checking the six fixed fields (label, chain, hub, parley, from, to) — a tampered field still fails AES-GCM because the context is the AAD; or read `custodyEpoch` history from `Transfer` logs. Recommend the first; state it in the panel's header comment.
2. **`keyType` other than 3.** `keyOf` may return an X25519 (1) or secp256k1 (2) key bound by another client; the panel must refuse to seal to a non-P-256 key with a sentence, not a throw from `importKey`.
3. **`whisperStamped`** value: `maxPostage` and `expectedFeeToken` come from `postage.inboxOf(to)` (`{feeToken, postage, replyWindow, open}`); the slab must print the stamp and that it is refunded if ignored.
4. **Who re-reads the epoch** — the shell's `propose` (generic, before every send) or each panel: put it in `propose` so no panel can forget it; the sealing panel adds the `keyOf` re-read in the same handler.
5. **`crypto.subtle` on an insecure gateway origin**: `http://localhost:8080` is a potentially-trustworthy origin; any other `http://` host is not, and `subtle` is `undefined` — the panel should say "sealing needs a secure origin" rather than throw.
