<!-- Reader report from the U9 understand phase (2026-10-08): what the donors contain, measured against their git refs, and what INTACT keeps or drops. Working document; docs/CONSOLE.md and docs/u9/DECISIONS.md record what was decided from it. -->

# U9 reader C — the verify-site shim: donor DOM + wallet, INTACT boot, and the assertion plan

Reader: C. Scope: what `tools/verify-site.mjs` for INTACT must be built from, and what it must prove.
Nothing under `/home/user/Special` or `/home/user/wt` was written; every number below was measured in this
container (Node v22.22.0) or read off the files named.

## 0. Sources read, with the ranges that matter

| Source | Where | What it gave |
|---|---|---|
| Donor `tools/verify-site.mjs` (153,169 B, 3,119 lines) | `git show origin/claude/claude-md-docs-8vvyc8:tools/verify-site.mjs` in `/home/user/Most-Advanced-NFT-Possible` | DOM shim 836–987 (`byId` 840, `matches` 853–858, `ALL` 860, `mkEl` 861–936, `mount` 937–983, `runScripts` 984–986, `nap` 987); `wallet(actor)` 988–1044; drivers: swap card 1047–1152, commons 1155–1232, DM 1234–1262, door 1283–1356, terminal 1358–1452, Uniswap card 1487–1665, seals 1857–1912, session keys 2049–2126, launchpad 2228–2388, vault 2419–2557, sealed room 2637–2806, holder's side 2844–2876, rental counter 2878–2916, renting 2918–3070, ABI tail 3079–3119 |
| Donor `tools/verify-console.mjs` (42,805 B, 845 lines) | same branch | Chromium driver 479–841: `addInitScript` wallet stub, `window.__sent`, `pageerror`, `textContent` reads, four contexts (holder, wrong chain, trade stub by selector, federated-walk stub) |
| Donor `engine/ipseity.html` 1859–2396 (24,678 B) | same branch | the wallet library the shell inherits: EIP-6963 `WALLETS`/`discover()` 2074–2101, `SANDBOXED` 2102–2107, `rpc`/`ethCall`/`readSig` 2109–2137, `connect`/`requireChain` 2139–2194, `propose`/`fire`/`watch` 2232–2320 (file offsets 215–480 of the slice) |
| Donor `engine/console.js` (16,573 B) + `console-lanes.js` (53,097 B) | same branch | `checkChain`/`connect`/`paintChain` 223–290; lanes' `provider()`/`call()` 106–112, `watch` 125–151, `propose` 153–202, the exact-approval wording 467–484, the floor wording 567–578 |
| Donor `src/Chrome.sol` `WALLET_JS` (278–) | same branch | the EIP-6963 chooser (`P` map by rdns, `pick`, `ask`, `choose`, `localStorage` in try/catch) |
| `/home/user/Special/tools/verify.mjs` (494 lines) | | `stateOfHtml` (43–46), the loader checks (123–137), the state-block assertions (141–260), the panel route checks (302–316), `attrOf`, the hostile-symbol and sale sections |
| `/home/user/Special/tools/evm.mjs` (448 lines) | | `Chain` API; `enc`/`sel`/`encodeParams`/`dec*`; `warp`/`roll`/`BLOCK`; `getLogs` filter rules |
| `/home/user/Special/tools/site.mjs` | | `deploySite(c, out, opts)` (opts: `plan, price, band, lo, hi, router, agentCard`), `getter`, `mint`, `PANELS`, `ZERO`, placeholders `MARKET_PLACEHOLDER`/`ROLES_PLACEHOLDER`/`AGENTCARD_PLACEHOLDER` |
| `/home/user/Special/tools/build-app.mjs` | | `PROLOGUE`, `CSP`, `FORBIDDEN`, `checkLoader`, `sources()` fallback to `tools/fixtures/` |
| `/home/user/Special/src/Renderer.sol` | | `INFLATE` (lines 55–63), `document(id)` (90–97) |
| `/home/user/Special/src/Catalog.sol` | | `TPL_WORLD`/`TPL_TOKEN`/`TPL_TAIL`/`TPL_MARKET`/`TPL_INBOX`/`TPL_ROOM`/`TPL_KEY` (860–898), `stateOf` (1303–1356), `state` (1364–1371), `knownDelegates` (1426–1431), `verbWord` |
| `/home/user/Special/src/Premises.sol` | | the `panel` route (141–157): `Content-Type: text/javascript; charset=utf-8`, `Content-Encoding: gzip`, `ETag: "<keccak of inflated>"`, `Cache-Control` long; `_panelIndex` (414–419) via `verbWord(i+2)+".js"` |
| `/home/user/Special/src/interfaces/{IIntact,IReach,IPool,IParley,ILaunchpad,IKiln,IPostage,ISteward,IRouter,ILocks,IKeyRegistry,Site}.sol`, `src/hub/RightsLogic.sol` 36–72, `src/lib/Rights.sol` | | every signature quoted in §5 |
| `/home/user/Special/test/Bundle.t.sol` (693 lines), `test/helpers/Deploy.sol` 328–430 | | how the real contracts are driven: `_openMarket`, `_params`, `_buy`, `_launchAndGraduate`, `_tradeSealed`, `_grantAgent`, `_bindKey`, `_arrange`, the seven sentences |
| `/home/user/Special/tools/verify-{vault,launch,pool,parley}.mjs` | | the harness spellings of `GRANT`, `TYPED`, `PARAMS`, `terms()`, `OPEN`, `DEPOSIT`, `SWAP_IN` |
| `/home/user/Special/engine/whispers.mjs` (9,066 B) | | the sealing module the social panel inlines |
| `BUILD-PLAN.md` §U9 (96–100), `DESIGN.md` §1, §2 (17–76), §5 (265–306), `docs/INTERFACE-CHANGES.md`, `docs/INVARIANTS.md` rows F3–F6 | | the rules and the eleven sentences |

---

## 1. The donor DOM shim (verify-site.mjs 836–987)

### 1.1 Transcription (verbatim, comments included where they carry a decision)

```js
/*  A DOM small enough to read: elements by id, two attribute selectors,
    and events. Enough to run the contract's own client, which is the only
    way to find out whether the calldata it assembles means what the page
    says it means.                                                        */
let byId = new Map();

/*  Elements built by a script rather than by the page.
    The fee-tier row on the Uniswap card is written with `innerHTML` and
    then wired up with `querySelectorAll` on the same element — ... So
    assigning innerHTML re-parses, and the parse is cached on the string so
    that listeners attached to a child survive until the parent's markup
    actually changes.                                                      */
const matches = (el, q) => {
  const d = q.match(/^\[data-([\w-]+)\]$/);
  if (d) return d[1].replace(/-(\w)/g, (x, y) => y.toUpperCase()) in el.dataset;
  if (q.startsWith(".")) return el.className.split(/\s+/).includes(q.slice(1));
  return el.tagName === q;
};

let ALL = [];
const mkEl = (tag, attrs) => {
  const el = {
    tagName: tag, value: "",
    disabled: false, hidden: false, className: "", placeholder: "",
    href: "", src: "", alt: "", title: "", tabIndex: 0, checked: false,
    scrollTop: 0, scrollHeight: 0, style: {},
    dataset: {}, _on: {}, _html: "", _kids: null, _text: "", children: [],
    /*  Real textContent is the concatenation of every descendant's text,
        and setting it removes the children. ...                          */
    get textContent() {
      return this._text + this.children.map((k) => k.textContent).join("");
    },
    set textContent(v) { this._text = String(v); this.children.length = 0; },
    append(...nodes) {
      for (const n of nodes) {
        this.children.push(n);
        if (n && n.tagName) ALL.push(n);
      }
    },
    setAttribute(k, v) { if (k in this) this[k] = v; else this.dataset[k] = v; },
    getAttribute(k) { return k in this ? this[k] : this.dataset[k]; },
    get innerHTML() { return this._html; },
    set innerHTML(v) { if (v !== this._html) { this._html = String(v); this._kids = null; } },
    querySelectorAll(q) {
      if (this._kids === null) {
        this._kids = [];
        for (const m of String(this._html).matchAll(/<(\w+)([^>]*)>/g)) {
          this._kids.push(mkEl(m[1], m[2]));
        }
      }
      return this._kids.filter((e) => matches(e, q));
    },
    addEventListener(k, f) { (this._on[k] = this._on[k] || []).push(f); },
    focus() {}, blur() {}, click() { return this.fire("click"); },
    dispatchEvent(e) { return this.fire(e && e.type); },
    async fire(k) { for (const f of this._on[k] || []) await f(); }
  };
  el.classList = {
    add: (k) => { if (!el.className.split(/\s+/).includes(k))
                    el.className = (el.className + " " + k).trim(); },
    remove: (k) => { el.className =
      el.className.split(/\s+/).filter((x) => x && x !== k).join(" "); },
    contains: (k) => el.className.split(/\s+/).includes(k),
    /*  Standard, and its absence was not a bug in the page — it was the
        shim silently lacking a method every browser has ...               */
    toggle: (k, force) => {
      const has = el.className.split(/\s+/).includes(k);
      const want = force === undefined ? !has : !!force;
      if (want && !has) el.className = (el.className + " " + k).trim();
      if (!want && has) {
        el.className = el.className.split(/\s+/).filter((x) => x && x !== k).join(" ");
      }
      return want;
    }
  };
  for (const m of (attrs || "").matchAll(/data-([\w-]+)(?:=["']?([^"'\s>]*)["']?)?/g)) {
    el.dataset[m[1].replace(/-(\w)/g, (x, y) => y.toUpperCase())] = m[2] ?? "";
  }
  const v = (attrs || "").match(/\bvalue=["']?([^"'\s>]*)["']?/);
  if (v) el.value = v[1];
  const hr = (attrs || "").match(/\bhref=["']?([^"'\s>]*)["']?/);
  if (hr) el.href = hr[1];
  const cl = (attrs || "").match(/\bclass=["']?([^"'>]*)["']?/);
  if (cl) el.className = cl[1].trim();
  return el;
};
function mount(html) {
  byId = new Map();
  const all = [];
  ALL = all;
  for (const m of html.matchAll(/<(\w+)([^>]*)>/g)) {
    const el = mkEl(m[1], m[2]);
    all.push(el);
    const id = (m[2].match(/\bid=["']?([\w.-]+)["']?/) || [])[1];
    if (id && !byId.has(id)) byId.set(id, el);
  }
  /*  Every JSON config block, not just the one this shim was first written
      for. ...                                                             */
  for (const m of html.matchAll(
      /<script type="application\/json" id="(\w+)">([\s\S]*?)<\/script>/g)) {
    if (byId.get(m[1])) byId.get(m[1]).textContent = m[2];
  }
  const listeners = {};
  globalThis.addEventListener = (k, f) => { (listeners[k] = listeners[k] || []).push(f); };
  globalThis.dispatchEvent = (e) => { for (const f of listeners[e.type] || []) f(e); };
  globalThis.Event = class { constructor(t) { this.type = t; } };
  const body = mkEl("body", "");
  globalThis.document = {
    body: body,
    hidden: false,
    createElement: (t) => mkEl(t, ""),
    getElementById: (i) => byId.get(i) || null,
    querySelectorAll: (q) => all.filter((e) => matches(e, q))
  };
  /*  Storage exists but forgets between pages, which is what a fresh
      browser looks like and the harder case for the client.           */
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  return byId;
}
const runScripts = (html) => {
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1])();
};
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
```

### 1.2 What it fakes, exactly

- **Elements**: a flat list. `mount` regex-scans every open tag (`/<(\w+)([^>]*)>/g`) into `mkEl` objects, indexes `id=` into `byId`, and *never builds a tree*: an element's `children` is populated only by scripts calling `append`. `document.querySelectorAll(q)` filters the flat list; an element's own `querySelectorAll` works only over children re-parsed from a string assigned to its `innerHTML` (cached in `_kids`).
- **Selectors**: three forms only — `[data-x]` (presence in `dataset`), `.class`, and a bare tag name. No `#id` (that is `byId.get`), no attribute values, no combinators.
- **Attributes**: `data-*` → camelCased `dataset`; `value`, `href`, `class` parsed from the tag text by regex; everything else dropped. `setAttribute(k, v)` writes a known property or else into `dataset[k]` — wrong for `viewBox`, `aria-*`, `type`, `min`, `max`.
- **Text**: `textContent` getter concatenates own `_text` plus descendants'; the setter wipes children. `innerHTML` is a string with a lazy re-parse.
- **Events**: `addEventListener(k, f)` records; `fire(k)` awaits each listener **with no event object**; `click()` and `dispatchEvent(e)` route to `fire`. No bubbling, no `target`, no `preventDefault`, no `removeEventListener`, no capture/once.
- **Form state**: `value`, `checked`, `disabled`, `hidden`, `placeholder`, `tabIndex` as plain fields; `focus/blur` no-ops.
- **`style`**: a bare `{}` (direct property writes work; `setProperty` does not exist — `console.js` calls `style.setProperty` six times and `document.documentElement.style.setProperty` once).
- **`classList`**: add/remove/contains/toggle over the `className` string.
- **`document`**: `body`, `hidden`, `createElement`, `getElementById`, `querySelectorAll`. No `head`, `documentElement`, `querySelector`, `createElementNS`, `createTextNode`, `createDocumentFragment`, `open/write/close`, `title`, `addEventListener`.
- **Window**: `globalThis` is the window (`globalThis.window = globalThis` is set inside `wallet()`); `addEventListener/dispatchEvent` over a listeners map; `Event` is a one-field class; `localStorage` is a per-mount `Map` that **never throws**.
- **`location`**: not provided; the door test sets `globalThis.location = { href: "/" }` by hand (line 1298) and deletes it after.
- **Scripts**: `runScripts` runs every `<script>…</script>` body through `new Function(code)()` in the **main realm**. Consequences: top-level `const`/`let` in a page script are function-scoped (so two pages' scripts never collide — a property the browser does *not* have), globals set with `window.X =` leak across pages (line 2912 deletes `window, document, addEventListener, dispatchEvent, Event, IP` by hand), and `<script type="…">` blocks are skipped by the regex.
- **Clock**: `nap(ms)` is a real `setTimeout`; pages' own timers run at real speed (the donor sessions test warps the chain to `Date.now()` because the page computes expiries from the wall clock).

### 1.3 What it does not support that INTACT's shell needs, and the Node 22 shim for each

Measured here (Node v22.22.0): `Blob`, `URL.createObjectURL`, `require("node:buffer").resolveObjectURL`, `DecompressionStream`, `CompressionStream`, `TextEncoder/TextDecoder`, `crypto.subtle`, `crypto.getRandomValues`, `atob/btoa`, `Event/CustomEvent/EventTarget`, `fetch/Response`, `structuredClone`, `queueMicrotask`, `performance.now` **exist**; `localStorage`, `sessionStorage`, `window`, `document`, `location`, `requestAnimationFrame` **do not** (`globalThis.localStorage` is `undefined` without `--experimental-webstorage`). The whole Renderer loader pipeline — `Uint8Array.from(atob(D), c => c.charCodeAt(0))` → `new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text()` — ran unchanged in Node and returned the inflated bytes.

| Gap | Why INTACT needs it | Shim in Node 22 |
|---|---|---|
| A real element **tree** (`parentNode`, `children`, `firstChild`, `nextSibling`, `insertBefore`, `replaceChildren`, `remove()`, `closest`, `matches`, `contains`) | panels build lanes out of elements; the shell delegates clicks to a lane root (`e.target.closest("[data-act]")`); the sell checklist and approval ledger are lists that get re-rendered | hand-rolled tokenizer (~150 lines, no dependency — the repo rule): open/close tags, void elements (`meta link input br img hr`), quoted and unquoted attributes, raw-text for `<script>`/`<style>`, text nodes, skip `<!doctype>` and comments. Each node: `{ tagName, attrs: Map, parentNode, childNodes: [], children (getter: element nodes only) }`. |
| `querySelector(All)` with `#id`, `tag.class`, `[attr]`, `[attr="v"]`, descendant and `>` combinators, `:not(...)` optional | tests say `page.$("#lane-vault [data-act=revoke]")` | a ~60-line compound-selector matcher over the tree (split on whitespace/`>`, each compound `tag? #id? .class* [attr(=val)]*`), applied depth-first. |
| **Events with a target and bubbling**, `preventDefault`, `stopPropagation`, `removeEventListener`, `{ once }` | delegation; `submit`; `keydown` Enter in the composer | own dispatcher: `dispatchEvent(ev)` sets `ev.target = el`, walks `parentNode` to `document` then `window`, honours `stopPropagation`/`defaultPrevented`; `click(el)` dispatches a `click`; `type(el, v)` sets `value` and dispatches `input` then `change`. Use Node's `Event`/`CustomEvent` classes as the event objects (they carry `type`, `detail`, `preventDefault`). |
| `document.head`, `documentElement`, `title`, `createElementNS`, `createTextNode`, `createDocumentFragment`, `activeElement` | the QR is SVG built with `createElementNS`; console.js writes CSS variables on `documentElement.style` | `createElementNS(ns, t)` → same node factory with `namespaceURI`; `style` → an object with `setProperty/getPropertyValue/removeProperty` plus a `cssText` string and direct props. |
| `attributes` proper (`getAttribute/setAttribute/removeAttribute/hasAttribute`, `aria-*`, `min`, `max`, `type`, `for`, `viewBox`) | sliders carry `min` = current seal (ratchet), chips carry `data-sel`, QR rects carry `x y width height` | `attrs: Map`; `dataset` is a live view of `data-*` keys; `value/checked/disabled/hidden/id/className` are properties mirrored to attrs on first read. |
| `location` + `hashchange` + `popstate`, `history.replaceState` | the panel loader keys off `location.hash.slice(1)`; session mode reads `location.search` (`?as=<key>`) | `location = { href, origin, pathname, search, hash }` built from the page URL; a `hash` setter that dispatches `new Event("hashchange")` on the window; `history.pushState/replaceState` update `location` without events. |
| `localStorage` that **throws** (opaque-origin detector) vs a Map-backed one (console) | DESIGN §5.1: "Opaque origin (`localStorage` throws — the detector)"; the placeholder shell already does `try { window.localStorage.getItem("intact") } catch (e) { opaque = true }` | console mode: a Map-backed `{ getItem, setItem, removeItem, clear, key, length }`. Viewer mode: `Object.defineProperty(ctx, "localStorage", { get() { throw new DOMException("The operation is insecure.", "SecurityError"); } })` — verified: the detector returns `true`. |
| `fetch` | console mode: `fetch("/panel/<name>.js")`, `fetch("/token/<id>/hash")` (the "verified against chain at block N" footer) | a shim bound to `GET = getter(c, site.premises)`: parse the URL path into segments, call `GET(seg)`, honour `Content-Encoding: gzip` by `zlib.gunzipSync(bodyBytes)` (a browser decodes before the page sees the body), return `new Response(bytes, { status, headers })`. Record every call in `page.fetches`. Viewer mode (`data:` origin): `fetch` rejects with `TypeError("Failed to fetch")` — there is no origin; the shell must take the `eth_call Engine.panel(i)` path. |
| `Blob` + `URL.createObjectURL` + `<script src="blob:…">` execution | DESIGN §5.2: panel bytes → keccak → "only then injects it as `<script src=\"blob:…\">`" | Node **has** `URL.createObjectURL(blob)` (returns `blob:nodedata:<uuid>`) and `require("node:buffer").resolveObjectURL(url)` → the Blob. Pass Node's `Blob` and `URL` into the context. Hook `appendChild/append/insertBefore` on the shim: when the node is a `script` with `src`, `const blob = resolveObjectURL(src); const text = await blob.text(); vm.runInContext(text, ctx, { filename: "blob:" + name })`, then dispatch `load` on the element; record `{ src, type: blob.type, text, hash: keccak(text) }` in `page.appended`. Verified: a `Uint8Array` built *inside* the context, wrapped in a main-realm `Blob`, resolves and runs in the page context (`var P=42` → `ctx.P === 42`). A `src` that is not `blob:` → record and refuse (CSP has no `https:` script source) — assert `page.appended.every(s => s.src.startsWith("blob:"))`. |
| `DecompressionStream`, `Response`, `TextEncoder/Decoder`, `atob/btoa`, `crypto` (`subtle`, `getRandomValues`), `CustomEvent`, `EventTarget`, `structuredClone`, `queueMicrotask`, `console` | the loader; the panel inflate in the viewer; whispers.mjs; EIP-6963 | **pass Node's own** into the `vm.createContext` sandbox — they are not there by default (a probe that omitted `TextDecoder` failed with `ReferenceError: TextDecoder is not defined` the moment whispers.mjs ran). Verified cross-realm: `crypto.getRandomValues(ctxUint8Array)` fills, `subtle.digest` accepts context bytes, `keccak256` (noble `isBytes` is explicitly cross-realm-tolerant) hashes context bytes identically, `whispers.mjs` encrypt/decrypt round-trips inside a context (423-byte envelope). |
| `window` as an **`EventTarget`** for `eip6963:*`, `hashchange`, `load`, `DOMContentLoaded`, `unhandledrejection` | discovery; the hash router | back `window.addEventListener/dispatchEvent/removeEventListener` with a Node `new EventTarget()`; verified that an `eip6963:announceProvider` `CustomEvent` dispatched from the harness reaches a listener registered inside the context with its `detail`. |
| `document.open()/write()/close()` | the loader | §4. |
| EIP-1193 `provider.on/removeListener` and a way to **emit** `accountsChanged`/`chainChanged` | rule: rights recomputed on both | §2.3. |
| Timers under test control; `requestAnimationFrame`; `Date.now` | `watch` polls every 2 s for 90 tries; countdowns; 15-minute deadlines must be exact | because the page runs in a vm context, its `setTimeout` is whatever the sandbox provides: `ctx.setTimeout = (f, ms, ...a) => setTimeout(f, Math.min(ms, 2), ...a)` (verified: a 2000 ms page timer took 2 ms); `requestAnimationFrame = f => setTimeout(f, 0)`; `ctx.Date` = a subclass whose `now()` returns `Number(BLOCK.header.timestamp) * 1000` so the shell's clock **is** the chain's — then a deadline the shell computes as "now + 900" equals `BLOCK.header.timestamp + 900n` exactly and an assertion can say so. The shell should prefer `INTACT.time` for first paint anyway (`TPL_TAIL` carries `"time":\x02`). |
| `getComputedStyle`, `getBoundingClientRect`, `scrollIntoView`, `matchMedia`, `navigator.clipboard` | copy buttons; layout probes | stubs returning zeros / a resolved promise; record clipboard writes for the "copy" assertion. |
| An `innerHTML` **tripwire** | build-app refuses `innerHTML\s*=` in shipped files; the DOM half of F4 is "textContent only" | define `innerHTML` with a setter that records `page.innerHTMLWrites.push(stack)` and throws — the whole run must leave it at 0 (assertion O4). The donor shim's lazy re-parse is not wanted. |
| `console.error` / uncaught errors / unhandled rejections inside the context | "no script threw on the way in" | pass a `console` whose `error` records; wrap every `vm.runInContext` and every awaited promise in try/catch into `page.errors`; `process.on("unhandledRejection")` during a page's run appends too. |

Realm note (measured): `vm.runInContext("Uint8Array", ctx) === Uint8Array` is **false** — every intrinsic differs by identity across the boundary, so anything that does `instanceof Uint8Array` on page bytes in the harness must use `ArrayBuffer.isView` or `Buffer.from(x)`. Node's `Blob`, `crypto`, noble's keccak and Node's `TextDecoder` are all tolerant (verified above).

---

## 2. The donor wallet shim `wallet(actor)` (verify-site.mjs 988–1044)

### 2.1 Transcription (verbatim)

```js
const wallet = (actor) => {
  let n = 0;
  const filters = [];
  /*  One request at a time. The in-process EVM is not a node: two
      interleaved runCalls corrupt each other's checkpoints and neither
      returns. A page is entitled to fire overlapping reads — its boot
      chain and a click chain race in real browsers too — and a real RPC
      endpoint absorbs that; this queue is the shim's version of a node's
      front door.                                                        */
  let q = Promise.resolve();
  const seq = (f) => { const p = q.then(f, f); q = p.then(() => {}, () => {}); return p; };
  globalThis.window = globalThis;
  globalThis.window.ethereum = {
    request: async ({ method, params }) => {
      if (method === "eth_chainId") return "0x1";
      if (method === "eth_requestAccounts" || method === "eth_accounts")
        return [actor.from.toString()];
      /*  Deterministic per (actor, message) — which is the only property
          the seal client relies on (RFC 6979 in a real wallet). The bytes
          are entropy to the page, never verified as a signature.        */
      if (method === "personal_sign") {
        const h1 = Buffer.from(keccak256(Buffer.from(
          actor.from.toString() + String(params[0]), "utf8")));
        const h2 = Buffer.from(keccak256(h1));
        return "0x" + h1.toString("hex") + h2.toString("hex") + "1b";
      }
      if (method === "eth_call")
        return seq(() => c.call(params[0].to, params[0].data, actor.from.toString()));
      /*  The conversation is read from logs, so the provider has to answer
          for them. The ledger is the same one the transactions above wrote
          into, filtered the way a node filters.                        */
      if (method === "eth_getLogs") { filters.push(params[0]); return seq(() => c.getLogs(params[0])); }
      if (method === "eth_sendTransaction") {
        n++;
        const t = params[0];
        await seq(() => actor.send({ to: t.to, data: t.data,
                           value: t.value ? BigInt(t.value) : 0n, label: "app" }));
        return "0x" + "ab".repeat(32);
      }
      throw new Error("unexpected method " + method);
    }
  };
  return { sent: () => n, filters: () => filters };
};
```

### 2.2 How it answers each method, and what is missing

| Method | Donor site shim (above) | Donor console shim (verify-console.mjs 505–520, 575–590, 681–705, 743–775) | INTACT needs |
|---|---|---|---|
| `eth_chainId` | constant `"0x1"`; the wrong-chain test (1133–1140) **replaces `request`** with a function answering `"0x2105"` | second context answers `"0x270f"` (9999) | from the chain: `"0x" + BigInt(c.common.chainId()).toString(16)`; a `W.setChain(id)` that changes the answer **and emits `chainChanged`** |
| `eth_accounts` / `eth_requestAccounts` | both return `[actor.from]` — indistinguishable | both return `[window.CON.owner]` | keep both answering, but **record** `eth_requestAccounts` as a prompt (§2.4); `W.accounts = []` option for "not connected" |
| `eth_call` | `c.call(to, data, from)` through the one-at-a-time queue `seq` | `"0x"` for everything (so the lanes render "not reported"); the trade stub matches `data.indexOf(sel.X) === 0` and answers by selector | `c.call(params[0].to, params[0].data, params[0].from ?? actor)`; on revert, throw an error carrying the revert bytes (see `eth_estimateGas`); a `W.answer(to, selector, fn)` override for "a satellite that does not answer" and for tampered `Engine.panel(i)` bytes |
| `eth_estimateGas` | not handled → `throw "unexpected method"` | not handled | **checkpoint → `runTx` → revert** (below) |
| `eth_sendTransaction` | `actor.send({ to, data, value })`, counts `n`, returns a constant fake hash `0xabab…`; a revert **throws out of `request`** (Chain.send throws) | pushes `params[0]` to `window.__sent`, returns the same constant | real hash, a **receipt** recorded per hash, `status 0x0` on revert instead of a throw (a browser mines the failure), optional auto-roll of one block per send |
| `eth_getTransactionReceipt` | not handled | not handled (the lanes' `watch` would poll into `catch(){}`) | `W.receipts.get(hash)` in JSON-RPC shape with `logs` — the shell reads the `Transfer(0,…)` log from a mint receipt for the id (DESIGN §1 "Flows") |
| `eth_getCode` | not handled | not handled | `bytesToHex(await c.vm.stateManager.getCode(createAddressFromString(addr)))` (`"0x"` when empty); the 7702 check reads `0xef0100` + 20 bytes |
| `eth_getLogs` | `c.getLogs(params[0])`, every filter recorded for the single-block assertions | fabricates one `Echoed` log in the federated test | `c.getLogs` plus: accept `address` as an array (JSON-RPC allows it; `Chain.getLogs` compares one string), keep recording |
| `eth_blockNumber` / `eth_getBalance` / `eth_gasPrice` | no | `eth_getBalance` → `"0x16345785d8a0000"` | `"0x" + BLOCK.header.number.toString(16)`; `"0x" + (await c.balanceOf(a)).toString(16)`; `"0xa"` |
| `personal_sign` | deterministic entropy: `keccak(actor ‖ message)` ‖ `keccak(that)` ‖ `1b` — 65 bytes, never a valid signature | no | **real** `secp256k1.sign(digest, actor.key)` (`ethereum-cryptography/secp256k1.js`, already imported by `verify-vault.mjs`) over `keccak("\x19Ethereum Signed Message:\n" + len + msg)`; accept `params[0]` as hex bytes or utf-8 (MetaMask sends `[message, address]`); return `r ‖ s ‖ (27 + recovery)`. Deterministic (RFC 6979) *and* verifiable on chain, so a Reach `isValidSignature` test can use it. Record as a prompt. |
| `eth_signTypedData_v4` | no | no | `params = [address, json]`; compute `keccak(0x1901 ‖ hashStruct(EIP712Domain) ‖ hashStruct(primaryType, message))` with a ~60-line encoder (atomic types, `bytes`/`string` hashed, arrays, nested structs — the donor library's `typeHash` at ipseity.html 2322–2360 is the template) and sign as above. MVB panels may never call it; until one does, keep the donor's `throw new Error("unexpected method " + method)` so a stray call fails the run loudly. |
| `wallet_switchEthereumChain` / `wallet_addEthereumChain` | no (the ipseity lib's `requireChain` would throw) | no | switch: if the chain is in `W.knownChains` → set, emit `chainChanged`, return `null`; else throw `{ code: 4902 }`; add: record as a prompt and succeed. |
| `provider.on(ev, fn)` / `removeListener` | **absent** (the lib guards with `NET.provider.on && …`; console.js wraps in try/catch) | absent | implement, plus `W.emit("accountsChanged", [addr])` and `W.emit("chainChanged", "0x2105")` for the tests |
| EIP-6963 | **not announced** — the shim sets `window.ethereum`, so the lib takes the `discover()` legacy branch (`"legacy:0"`, name `"Injected wallet"`) | `addInitScript` sets `window.ethereum` too | announce (§2.5); `legacy: true` option to also set `window.ethereum` for the fallback assertion |

**`eth_estimateGas`, implementable.** `c.call` runs `vm.evm.runCall`, which journals and **commits** on success (evm.js 1127–1131 checkpoints; runTx.js 390/421 checkpoint→commit), so a state-changing estimate through it would land. Use the state manager's own checkpoint around a real `runTx`, as `Chain.send` builds it:

```js
async function simulate(actor, { to, data, value }) {
  const sm = c.vm.stateManager;
  await sm.checkpoint();                                   // MerkleStateManager.checkpoint, line 347
  try {
    const sender = await sm.getAccount(actor.from);
    const tx = createLegacyTx({ nonce: sender ? sender.nonce : 0n, gasPrice: 10n, gasLimit: 30_000_000n,
      to: to ? createAddressFromString(to) : undefined, value: BigInt(value || 0),
      data: hexToBytes(data || "0x") }, { common: c.common }).sign(actor.key);
    const res = await runTx(c.vm, { tx, block: BLOCK, skipBalance: true,
      skipBlockGasLimitValidation: true, skipHardForkValidation: true });
    const err = res.execResult.exceptionError;
    return { ok: !err, gas: res.totalGasSpent, error: err && err.error,
             ret: bytesToHex(res.execResult.returnValue || new Uint8Array()) };
  } finally { await sm.revert(); }                         // inner commit only decrements _checkpointCount (line 356–361); the outer revert discards it
}
```

Return `"0x" + gas.toString(16)` on success; on revert throw an error shaped like a wallet's: `Object.assign(new Error("execution reverted"), { code: 3, data: ret })`. The shell must decode `e.data` (string) **or** `e.data.data` **or** a `0x[0-9a-f]{8,}` match in `e.message` (MetaMask, Rabby and Coinbase differ), look up `INTACT.err[selector]`, and ABI-decode the arguments when the err table's signature has them (`Slippage(uint256,uint256)` → "got 9, wanted 10").

**EIP-3607 caution** (runTx.js 590–602): a sender whose account has code is refused as "not EOA", so a 7702-coded holder (set with `stateManager.putCode(addr, hexToBytes("0xef0100" + delegate))`) can be **read** (`eth_getCode`, `rightsOf`) but cannot **send** through this harness. The 7702 assertions are read-side (M5, N11).

**Receipts.** `Chain.send` returns `{ gas, address, ret, logs }` but not the hash. Preferred: an additive one-liner in `evm.mjs` returning `hash: bytesToHex(tx.hash())` (U9 may make it; it changes no existing field). Fallback: the shim builds and signs the tx itself (same code as `simulate`, no revert) so it owns `tx.hash()`. Receipt shape the shell reads:

```js
{ transactionHash, from, to, status: ok ? "0x1" : "0x0", blockNumber: "0x" + BLOCK.header.number.toString(16),
  gasUsed: "0x…", contractAddress: null,
  logs: logs.map(([addr, topics, data], i) => ({ address: hex(addr), topics: topics.map(hex), data: hex(data),
        blockNumber, logIndex: "0x" + i.toString(16), transactionHash })) }
```

On a revert `Chain.send` throws before `_record`; the shim catches, records `status: "0x0"` with no logs, and still returns the hash (a wallet returns a hash for a transaction that will fail; the page learns from the receipt). `autoRoll: true` (default on) calls `roll(BLOCK.header.number + 1n)` after each send so receipts have increasing block numbers and Parley's "two words inside two blocks" cooldown is not tripped by consecutive sends (the donor rolled by hand: `evm.roll(evm.BLOCK.header.number + 7n)`, line 1191).

**Serialisation.** Keep the donor's `seq` queue for every method that touches the VM (`eth_call`, `eth_estimateGas`, `eth_sendTransaction`, `eth_getCode`, `eth_getBalance`): the comment's warning about interleaved `runCall`s is real, and the shell's boot chain and a click chain race.

### 2.3 Events

```js
const listeners = new Map();                                       // event → Set(fn)
provider.on = (ev, fn) => { (listeners.get(ev) || listeners.set(ev, new Set()).get(ev)).add(fn); return provider; };
provider.removeListener = (ev, fn) => { listeners.get(ev)?.delete(fn); return provider; };
W.emit = (ev, arg) => { for (const f of listeners.get(ev) || []) f(arg); };
W.setChain = (id) => { state.chainId = BigInt(id); W.emit("chainChanged", "0x" + state.chainId.toString(16)); };
W.setAccounts = (list) => { state.accounts = list; W.emit("accountsChanged", list); };
```

### 2.4 Prompts

The donor records only a send counter (`n`) and the log filters; the console shim records sent params in `window.__sent`. INTACT's viewer rule ("never calls `eth_requestAccounts` and never asks to sign") needs a transcript:

```js
const PROMPTING = new Set(["eth_requestAccounts", "eth_sendTransaction", "personal_sign", "eth_sign",
  "eth_signTypedData", "eth_signTypedData_v3", "eth_signTypedData_v4", "wallet_switchEthereumChain",
  "wallet_addEthereumChain", "wallet_requestPermissions", "wallet_watchAsset"]);
request: async ({ method, params }) => {
  W.calls.push({ method, params, at: W.calls.length });        // every call, in order
  if (PROMPTING.has(method)) W.promptsLog.push({ method, params });
  …
}
W.prompts = () => W.promptsLog;  W.sent = () => W.promptsLog.filter(p => p.method === "eth_sendTransaction").length;
W.firstIndex = (m) => W.calls.findIndex(x => x.method === m);
```

Assertions then read: `W.prompts().length === 0` ("never reached a wallet prompt"), `W.firstIndex("eth_chainId") < W.firstIndex("eth_call")` ("compared before any read"), `W.calls.some(x => x.method === "eth_call" && x.params[0].to === S.hub && x.params[0].data.startsWith(S.sel["hub.rightsOf"]))` ("one free rightsOf").

### 2.5 EIP-6963 announcements

The donor never announces. INTACT's shell discovers by EIP-6963 first and `window.ethereum` only when nothing announces (DESIGN §5.4). With the window backed by a Node `EventTarget` (§1.3):

```js
const info = Object.freeze({ uuid: crypto.randomUUID(), name, icon: "data:image/svg+xml,", rdns });
const announce = () => ctx.window.dispatchEvent(new CustomEvent("eip6963:announceProvider",
  { detail: Object.freeze({ info, provider }) }));
ctx.window.addEventListener("eip6963:requestProvider", announce);   // re-announce on request, as the standard says
announce();                                                         // and once unprompted, before the shell runs
```

Verified: the listener inside the context receives `e.detail.info.rdns`. `wallet(actor, { rdns: "io.shim.a", name: "Shim A" })` twice with different rdns drives the picker; the same rdns twice drives the dedup assertion; `{ legacy: true }` also sets `ctx.window.ethereum` for the fallback assertion. `announce` must run **before** the shell's scripts (a wallet installed before the page) and a second call after boot models a late wallet.

---

## 3. How the donor drives a page

Pattern, from "driving the swap card" (1047–1152):

```js
const page = await GET(["token", String(T), "market"]);      // the contract's bytes, over ERC-5219
mount(page.body);                                            // DOM
const trader = await c.as("0x" + "44".repeat(32));           // a second key on the same VM
await c.exec(weth, "mint(address,uint256)", [trader.from.toString(), 10n ** 21n]);
const W1 = wallet(trader);                                    // provider → window.ethereum
runScripts(page.body);                                        // run the page's own scripts
await nap(30);
ok("the client loaded against the page's own config", !!globalThis.IP);
const $ = (i) => byId.get(i);
$("si").value = "1";  await $("si").fire("input");  await nap(400);
const expect = decUint(await c.read(pool, "quote(uint256,bool,uint256)", [T, true, IN]));
const shown = $("so").value.replace(/,/g, "");
ok("and it is what Pool.quote says, to the displayed precision", shownRaw > expect - 2n && shownRaw < expect + 2n, …);
ok("and the button knows an approval is needed first", /^Approve /.test($("go").textContent), $("go").textContent);
await $("go").fire("click");
eq("pressing it sent one transaction", sent(), 1);
const allowed = decUint(await c.read(weth, "allowance(address,address)", [trader.from.toString(), pool]));
ok("which was the approval, and it landed", allowed > 0n);
…
ok("at no worse than the floor the card promised", after - before >= expect * 9950n / 10000n, …);
```

The vocabulary, all of it:

- **Assertions**: `ok(name, cond, detail)`, `eq(name, got, want)` (string compare), `refuses(name, fn, wantSubstring)` (line 64: a thrown message must include the custom-error selector or name), `head(section)`; the final line prints `${pass} passed, ${fail} failed` and `process.exit(fail ? 1 : 0)` — INTACT's `check.mjs` "incomplete ≠ pass" rule (BUILD-PLAN U12) needs that summary line present once.
- **Reach into the DOM**: `byId.get(id)` (aliased `$`), `.value =`, `.textContent`, `.innerHTML` (regex-tested: `/receive at least/.test($("det").innerHTML)`), `.children`, `.disabled`, `.hidden`, `.className`, `document.body.classList.contains("held")`, `document.querySelectorAll("[data-sel]")` (the chips, 2089), `.dataset.sel`, `.style.display` (launchpad 2256–2278).
- **Act**: `await el.fire("input" | "change" | "click")`, then `await nap(ms)` (30–500 ms, raised to a 20×300 ms poll when decryption was slow: 2744–2751).
- **Read the chain back** rather than the DOM for the truth: `c.read(pool, "quote(…)")`, `c.read(weth, "allowance(address,address)")`, `c.read(site.parley, "stateOf(uint256)", [0])` word 1 (`decUint(…, 1)` — the count), `c.getLogs({ address })` for the eavesdropper (2707–2716).
- **Provider transcript**: `W.sent()` for "pressing it sent one transaction"; `W.filters()` for "every one of them asked for exactly one block" (`asked.every(f => f.fromBlock === f.toBlock)`, 1223) and "filtered to the room, by a topic the contract computed" (`f.topics.length === 2 && f.topics[0].length === 66`).
- **Globals the page exposes** for tests: `globalThis.IP` (`.connect()`), `IPT` (`.me()`, `.mine()`, `.paint()`, `.room()`), `TERM.run(line)`, `DOORS`, `UNI.U`. INTACT's shell may expose one test seam (`window.INTACT.__page`?) but the rules say the shell declares no stray globals; prefer `body.dataset.*` and element state.
- **Clock and chain moves between acts**: `warp(BigInt(Math.floor(Date.now() / 1000)))` before sessions (2065) because the page used the wall clock; `evm.roll(evm.BLOCK.header.number + 7n)` between messages so the walk has pointers to follow (1191).
- **Hostile input**: `HOSTILE = "</script><img src=x onerror=alert(1)> & <b>bold</b>"` typed into the composer, then `eq("the hostile one reads exactly as it was typed", body.textContent, HOSTILE)`, `eq("and it is text, not markup — nothing was parsed out of it", body.children.length, 0)`, `ok("because the client never assigned innerHTML to it", body.innerHTML === "")` (1206–1213).
- **Negative control on the wallet**: swap `window.ethereum.request` for a function answering `eth_chainId` `0x2105` and assert the client refuses with `/on chain/` (1133–1140).
- **Sessions**: `chips.find(x => x.dataset.sel === evm.sel("swap(uint256,bool,uint256,uint256,address,uint256)"))`, press, then `sessionAllows(address,address,bytes4)` on chain for the chosen selector, for an unchosen one, and for the same selector at another address (2096–2118).
- **Sealed room**: two actors (`wallet(c)`, `wallet(buyer)`) alternate on the same page bytes; the claim banner is asserted against `statsOf` (the transfer count) rather than a fixed string (2680–2690); the log is read raw to prove the words are not in the bytes (2707–2716).
- **Teardown**: `for (const g of ["window", "document", "addEventListener", "dispatchEvent", "Event", "IP"]) delete globalThis[g];` (2912–2914).

verify-console.mjs (Chromium, the U11 ancestor) drives differently and two of its moves carry over as *ideas*: the stub answers **every** `eth_call` with `"0x"` so the lanes must render "not reported" rather than zero (568–579 "an unanswered price renders as not reported, never as zero"); and a stub that answers **by selector** (`d.indexOf(window.CON.sel.allowance) === 0 ? …`) toggles the allowance to show the same button proposing an exact approve and then the swap (743–790). Its assertions on the slab's words are the INTACT vocabulary: "with no allowance, the button's current step is an exact approve" (`/APPROVE/ && /exactly 1/`), "and never an unlimited one" (`/Never.*unlimited/s`), "with a floor under it, or nothing moves" (`/No less than/ && /or nothing moves/`), "and a deadline" (`/fifteen minutes/`), "a control on the wrong chain raises no slab", "and sends nothing before a person presses it".

---

## 4. INTACT's served document, and the boot sequence for the shim

### 4.1 The bytes

`Renderer.document(id)` (Renderer.sol 90–97) is, byte for byte:

```
PROLOGUE                                   build-app.mjs: <!doctype html><html lang="en"><head><meta charset="utf-8">
                                           <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'self'; form-action 'none'; base-uri 'none'">
                                           <meta name="viewport" …><meta name="color-scheme" content="dark"><title>INTACT</title><style>…</style></head><body>
<script>window.INTACT={…}</script>         Catalog.state(id): valid JSON, every key quoted, "<" as <
<script>self.$INTACT="<base64 gzip>";</script>
INFLATE                                    <script>(async()=>{try{const D=self.$INTACT;delete self.$INTACT;const b=Uint8Array.from(atob(D),c=>c.charCodeAt(0));
                                           const t=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
                                           document.open();document.write(t);document.close();}catch(e){document.body.textContent="INTACT could not inflate itself in this browser.\n\n"+e;}})()</script>
```

No closing `</body></html>` — the loader replaces the document. The inflated `t` is the whole `dist/app.html` (its own doctype, head with CSP, style, body, scripts). `tools/verify.mjs` already takes it apart without running it: `stateOfHtml(html)` = `html.match(/<script>window\.INTACT=([\s\S]*?)<\/script>/)` → `{ text, obj: JSON.parse(text) }` (43–46); the payload by `html.match(/self\.\$INTACT="([A-Za-z0-9+/=]+)";<\/script>/)` and `zlib.gunzipSync(Buffer.from(m[1], "base64"))` (123–126), asserted equal to `dist/app.html`; the panels by `GET(["panel", name + ".js"])` → `zlib.gunzipSync(p.bodyBytes)` → keccak equals `manifest.panelHashes[name]` and the `ETag` (302–316). Catalog's `TPL_TOKEN` (869–877) fixes the keys the shell reads: `price, owner, reach, grip, guardian, user, agentWallet, proposedWallet, feeSink, epoch, status, locked, lockCount, guardianHold, feesToGrip, pinnedFace, launchCount, curve, name, fingerprint, clocks{sealedUntil, marketSealedUntil, userExpires, transferSealUntil, createdAt}, market, inbox, home, commons, key, launches, locks, steward, roles, holderKeyId, reported, absent`, then `TPL_TAIL`: `sel, err, topics, panels{swap, social, launch, vault, identity, agent}, engineHash, catalogHash, block, time`; `TPL_WORLD` (861–868) adds the addresses and `rights{HOLD:1 … SESSION:128}`, `bits{reach:1, pool:2, parley:4, postage:8, locks:16, launchpad:32, steward:64, router:128, market:256, roles:512, keys:1024, agentcard:4096}`.

How this differs from what the donor shim mounted: the donor's pages were server-rendered HTML with inline classic scripts and `<script type="application/json" id="…">` config blocks — `mount` + `runScripts` was the whole boot. INTACT's `/token/<id>/live` is a prologue, a state script, a base64 payload and an async loader; nothing in the donor ever *ran* the loader (the "front page is the instrument" section only regex-matched `$IPSE` and `DecompressionStream`, 1263–1281). verify-site will be the first tool to execute it.

### 4.2 Two boot sequences

**(a) Emulate `document.open/write/close` in one vm context — recommended as the default.**

```js
async function openPage({ html, url = "/token/1/live", mode = "console", wallets = [], clock = BLOCK }) {
  const sandbox = platform(mode, clock);        // Blob, URL, Response, DecompressionStream, TextEncoder/Decoder, atob, btoa,
                                               // crypto, Event, CustomEvent, EventTarget, structuredClone, queueMicrotask,
                                               // console (recording), compressed setTimeout/clearTimeout/setInterval,
                                               // requestAnimationFrame, Date (now() = chain time), navigator, getComputedStyle
  const ctx = vm.createContext(sandbox);
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  installWindowEvents(ctx);                    // Node EventTarget behind add/remove/dispatchEventListener
  installLocation(ctx, url);                   // location + hashchange, history
  installStorage(ctx, mode);                   // Map-backed, or a throwing getter in "viewer"
  installFetch(ctx, mode, GET);                // console: GET(segments) with gzip decode; viewer: TypeError
  const page = installDocument(ctx);           // the tree, byId, open/write/close, the Blob-script hook, the innerHTML tripwire
  for (const w of wallets) w.attach(ctx);      // EIP-6963 announce (+ legacy window.ethereum when asked)
  page.load(html);                             // parse the served bytes into the tree (prologue + three scripts)
  for (const s of page.scripts()) {            // in document order, exactly as a browser runs classic inline scripts
    const r = vm.runInContext(s.text, ctx, { filename: `served#${s.index}` });
    if (r && typeof r.then === "function") await r;    // the loader is an async IIFE: its promise resolves after document.close()
  }
  await page.settle();
  return page;
}
```

`document.open()` empties the tree and `byId` **but not the context** — that is the browser fact the Renderer comment relies on ("document.open() clears the document but keeps the Window"), and it falls out for free. `document.write(t)` appends to a buffer; `document.close()` parses the buffer with the same tokenizer, mounts it, runs its `<script>` elements in order (`vm.runInContext(text, ctx, { filename: "shell#" + i })`), then dispatches `DOMContentLoaded` on `document` and `load` on `window`. The shell's top-level `const`s become context-global lexical bindings exactly as in a browser — so a fresh context **per page** is mandatory (verified: a second `const D` in the same context throws `SyntaxError: Identifier 'D' has already been declared`, which is the collision the loader rule exists for). `window.INTACT` set by the state script is a property on the context and survives `open()`: assert `ctx.INTACT.id === id` after boot.

Ordering caveat for the shell author: a browser runs a `<head>` script before `<body>` elements exist; `close()` as described mounts the whole shell first and then runs its scripts. The placeholder shell puts its script at the end of `<body>`; the real shell should too, or the shim's `close()` must interleave (run each script when the tokenizer reaches it — a 10-line change, worth doing so the behaviour is faithful).

**(b) Bypass the loader** (what verify.mjs does to the bytes): `const m = html.match(/self\.\$INTACT="([A-Za-z0-9+/=]+)";<\/script>/); const shell = zlib.gunzipSync(Buffer.from(m[1], "base64")).toString("utf8");` then `page.load(shell)`, `ctx.INTACT = JSON.parse(stateOfHtml(html).text)`, run the shell's scripts. Faster (no async stream, no base64 in JS), and it keeps working if the loader is edited — which is also why it proves less.

**Recommendation.** Boot every section with (a). It costs one `await` and ~40 lines of `open/write/close`, and it is the only way the suite can say "the opaque origin boots the viewer" about the document a marketplace actually hands a browser. Keep (b) as `openShell()` for sections that remount the same bytes many times (the sealed-room section remounts five times), and run (b) once against (a) in the boot section to assert they produce the same `document.documentElement.outerHTML`-equivalent tree (same ids, same text) — then every later section's results are known to be loader-independent.

**Testing the loader itself** (group P below): assert `page.written` (what `document.write` received) `=== fs.readFileSync("dist/app.html")`; `ctx.INTACT` is the **same object** the state script created (store a sentinel on it before the loader runs: `ctx.INTACT.__pin = 1` after script 1, check after boot); `ctx.$INTACT === undefined` after boot (the `delete`); the failure branch — corrupt the base64 in the served bytes before `page.load` and assert `document.body.textContent.startsWith("INTACT could not inflate itself")`; and a **negative control** that the shim reproduces the browser's rule — run `const D=1` as a synthetic second global script in a context where a shell has already declared `D` and assert the `SyntaxError` (so a future loader that grew a global would fail here before it failed in Chromium). The static halves — `checkLoader()` in build-app, "declares nothing at all in global scope" in verify.mjs — stay where they are.

### 4.3 Driving after boot

```js
const $ = (sel) => page.$(sel), $$ = (sel) => page.$$(sel);
page.hash("#swap");                 // sets location.hash, dispatches hashchange → the panel loader runs
await page.settle();                // ≥ 3 rounds of setImmediate so queued microtasks and compressed timers drain
page.type($("#swap-in"), "1");      // value + input + change
page.click($("#swap-go"));          // bubbling click with target
await page.settle();
const slab = $("#cslab");           // read: slab.textContent, $("#cslab [data-go]").disabled, body.dataset.rights
W.emit("accountsChanged", [other]); await page.settle();
```

`settle()` replaces `nap(ms)`: with timers compressed to ≤ 2 ms, three `setImmediate` rounds plus one `setTimeout(0)` drains a boot chain; a `page.until(() => cond, 200)` helper polls with the same primitive for the decryption-style cases.

---

## 5. The assertions (≥ 150), grouped by sentence

Conventions: `S` = `stateOfHtml(live.body).obj`; `GET = getter(c, site.premises)`; `WAD = 10n ** 18n`; `me = c.from.toString()`; harness spellings are the ones the existing verifiers use:

```js
const OPEN    = "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)";   // verify-pool.mjs:110
const DEPOSIT = "deposit(uint256,uint256,uint256)";                                   // :112
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";          // :108
const GRANT   = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";   // verify-vault.mjs:59
const EXEC    = "execute(address,uint256,bytes,uint8)";                               // :61
const PARAMS  = "(uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8)";  // verify-launch.mjs:173
const SPEAK   = "speak(uint256,uint256,uint8,uint64,uint64,bytes)";                  // IParley.sol:70 — bytes as a hex string, never a Buffer (evm.mjs rule)
```

Shared setup, once: `const out = compile({ quiet: true, dirs: ["src", "test/mocks"] }); const c = await Chain.open(); const site = await deploySite(c, out);` (router `ZERO` by default), `weth = c.deploy(MockERC20, encodeParams("string,string,uint8,uint256,bool", ["Wrapped Ether","WETH",18,0,false]))`, actors `renter = c.as("0x"+"22".repeat(32))`, `buyer = c.as("0x"+"33".repeat(32))`, `trader = c.as("0x"+"44".repeat(32))`, `stranger = c.as("0x"+"55".repeat(32))`, `guardianW = c.as("0x"+"66".repeat(32))`, `agentW = c.as("0x"+"77".repeat(32))`. Mint: `const { id } = await mint(c, site, me)` (the id from the `Transfer` log). The page under test is `(await GET(["token", String(id), "live"])).body` unless a group says otherwise.

### A. Build and boot (every mode) — 10

Setup: the first mint (#1 to `me`). Boot (a) in console mode with `wallet(c, { rdns: "io.shim.a" })`.

- A1 "the shell that shipped is the console, not the placeholder" — `readPlan().placeholder === false` and `plan.shell === "engine/app.html"`.
- A2 "the loader inflated the shell the build wrote, byte for byte" — `page.written === fs.readFileSync("dist/app.html","utf8")`.
- A3 "window.INTACT survived document.open()" — `ctx.INTACT.id === Number(id)` and the sentinel set after script 1 is still there.
- A4 "no script threw on the way in" — `page.errors.length === 0`.
- A5 "the body names its boot mode" — `document.body.dataset.mode === "console"`.
- A6 "the CSP meta is in the document the shell wrote" — `$('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")` includes `script-src 'unsafe-inline' blob:` and `connect-src 'self'`.
- A7 "nothing in the document points off the origin" — every `script[src]`, `img[src]`, `link[href]` in the tree is `blob:` or `data:`; `page.fetches.every(f => f.url.startsWith("/"))`.
- A8 "Home prints the baked facts through textContent" — `$("#fact-id").textContent === String(S.id)`, `#fact-chain` = `S.chainId`, `#fact-holder` = `S.owner` (checksummed or lower; compare lower-cased), `#fact-epoch` = `S.epoch`, `#fact-status` = `"Active"`.
- A9 "the footer names the block the state was read at" — `/verified against chain at block \d+/` in `$("#verified").textContent` and the number equals the `/token/<id>/hash` `block` (console mode fetches it: `page.fetches` includes `/token/1/hash`).
- A10 "nothing was assigned through innerHTML, by anybody, all run" — `page.innerHTMLWrites === 0` (checked again at the very end of the suite).

### B. "the opaque origin boots the viewer and never offers connect" — 16

Setup: same bytes, `mode: "viewer"` (throwing `localStorage`, `fetch` rejects), **no wallet** for B1–B9; then a second boot with `wallet(c)` announced for B10–B16; a third with `W.setChain(0x2105)` before boot for B14.

- B1 "the detector fired" — `document.body.dataset.mode === "viewer"`.
- B2 "the web3:// link is printed and is this token's" — `$("#link-web3").textContent === \`web3://${site.premises.toLowerCase()}:1/token/${id}/live\`` (matches `external_url` in verify.mjs).
- B3 "the https twin is derived from the state, never a baked host" — the twin's `textContent` contains `/token/${id}/live` and `S.premises`, and `dist/app.html` matches no `/https?:\/\/[a-z0-9.-]+\.(org|com|io|xyz|net)\b/i` (build-app already refuses; re-asserted on the mounted text). (See open question 6.3.)
- B4 "a QR was drawn, by the shell, as SVG" — `$("#qr svg")` exists, `$$("#qr svg rect").length >= 200` (a 25×25 module code has ≥ 300 dark cells), `aria-label` equals the web3 link.
- B5 "the QR carries nothing but shapes" — `$("#qr svg").textContent.trim() === ""` and no `a`, `script`, `foreignObject` inside.
- B6 "there is no connect control" — `$$("[data-connect]").length === 0` and `!/connect/i.test(document.body.textContent)`.
- B7 "the page says nothing here can sign" — `/nothing (here )?can sign/i.test($("#viewer").textContent)`.
- B8 "the lanes are not offered" — `$$("#lanes a").length === 0` or every one has `aria-disabled="true"`.
- B9 "the viewer fetched nothing and asked nothing" — `page.fetches.length === 0`; no wallet attached so `W` is null; `page.errors.length === 0`.
- B10 "with a wallet announced, the viewer still never prompts" — after boot *and* after clicking every `button` in the document: `W.prompts().length === 0`.
- B11 "it compared the chain before any read" — `W.firstIndex("eth_chainId") !== -1 && W.firstIndex("eth_chainId") < W.firstIndex("eth_call")`.
- B12 "it found the account quietly" — `W.calls.some(x => x.method === "eth_accounts")` and none `eth_requestAccounts`.
- B13 "it loaded a panel through the provider, hash-checked" — a call `eth_call` to `S.engine` with `data.startsWith(sel("panel(uint256)"))`; after `page.hash("#swap")`: `ctx.INTACT.loaded.swap === true`, `page.appended.length === 1`, `page.appended[0].hash === S.panels.swap`.
- B14 "a viewer wallet on another chain reads nothing" — with `W.setChain(0x2105)`: `W.calls.filter(x => x.method === "eth_call").length === 0`; `$("#chip-chain").textContent` matches `/wallet on chain 8453/`; `W.prompts().length === 0` (no switch prompt in the viewer either).
- B15 "a wallet with rights still gets no signable control in the viewer" — holder's wallet attached: `document.body.dataset.rights === "1"` yet `$$("[data-go]").length === 0` and `$$("#cbox").length === 0 || !$("#cbox").classList.contains("on")`.
- B16 "closing the tab is logout: nothing was stored" — `ctx.__storageWrites === 0` (the throwing getter records attempts; a shell that tried to remember the wallet in the viewer would have thrown inside its try/catch — assert the attempt count is 0 or that every attempt was inside a catch: `page.errors.length === 0`).

### C. "a tampered panel is refused" — 12

Setup: console mode, holder; `W.tamperPanel("swap", (inflated) => { inflated[40] ^= 1; return inflated; })` installs a fetch override that re-gzips the mutated script and (by default) **keeps the original ETag**; `{ forgeETag: true }` also rewrites the ETag to the tampered keccak.

- C1 "a flipped byte is refused with a sentence" — after `page.hash("#swap")`: `/refused/.test($("#lane-swap").textContent) && /hash/.test(…)`.
- C2 "nothing was injected" — `page.appended.length === 0`.
- C3 "the lane never marked itself loaded" — `ctx.INTACT.loaded?.swap !== true` and `$("#lane-swap").dataset.loaded === undefined`.
- C4 "a forged ETag changes nothing" — `forgeETag: true` → same refusal (the shell hashes bytes, not headers).
- C5 "a truncated panel is refused" — `tamperPanel("swap", b => b.subarray(0, b.length - 7))` → refusal.
- C6 "the untampered panel loads once" — fresh page, no tamper: `ctx.INTACT.loaded.swap === true`, `page.appended.length === 1`.
- C7 "what was injected is exactly what was pinned" — `page.appended[0].type === "text/javascript"`, `page.appended[0].hash === S.panels.swap`, `page.appended[0].text === fs.readFileSync("dist/panels/swap.js","utf8")`.
- C8 "revisiting a lane injects nothing new" — `page.hash("#social"); page.hash("#swap")` → `page.appended.length` grew by exactly one (social), swap not re-fetched: `page.fetches.filter(f => f.url === "/panel/swap.js").length === 1`.
- C9 "a lane the state does not pin is not a lane" — `page.hash("#nonsense")` → no fetch, no injection, Home shown (`$("#lane-home").classList.contains("on")`).
- C10 "a refusal is per lane" — tamper social only: social refused, swap loads.
- C11 "the viewer path is checked the same way" — viewer mode with a wallet, `W.answer(S.engine, sel("panel(uint256)"), ret => flipOneByteInsideTheAbiBytes(ret))` → the same refusal sentence in `#lane-swap`.
- C12 "the refusal leaks no code" — `!$("#lane-swap").textContent.includes("function")` and does not include any 32-byte hex except the expected pin.

### D. "a renter sees the walk and the sentence" — 12

Setup: `await c.exec(site.hub, "setUser(uint256,address,uint64)", [id, renter.from.toString(), BLOCK.header.timestamp + 7n * 86400n])`; two words in the commons from the holder in two blocks: `c.exec(site.parley, SPEAK, [0n, id, 0, 0, 0, hex("hello, commons")]); roll(BLOCK.header.number + 2n); c.exec(…"and again")` (Bundle.t.sol rolls 2 between words — `test_theCommonsRefusesTwoWordsInsideTwoBlocks`). Boot console mode as `wallet(renter)`.

- D1 "one free rightsOf at connect" — exactly one `eth_call` to `S.hub` with `data.startsWith(S.sel["hub.rightsOf"])` and the actor word equal to the renter.
- D2 "the body carries the bits" — `document.body.dataset.rights === "4"` (`R_USE`, Rights.sol:37).
- D3 "Home says you are the user until when" — `/you are the user until/.test($("#rights-sentence").textContent)` and the date derives from `S.clocks.userExpires`.
- D4 "the composer is not there" — `page.hash("#social")`; `$$("#lane-social [data-act=speak]").length === 0 && $$("#lane-social textarea, #lane-social input[type=text]").length === 0`.
- D5 "the walk is" — `$$("#commons .row").length === 2`, oldest first: `rows[0].textContent` includes `hello, commons`.
- D6 "and the sentence says why" — `/user|renter/.test($("#lane-social .why").textContent) && /holder/.test(…)`.
- D7 "a renter may still trade like anyone" — `page.hash("#swap")`: the quote card exists and `#swap-go` is enabled once a market is open (group F's market), while `#your-market` is absent.
- D8 "the vault answers to the holder" — `page.hash("#vault")`: `$$("#lane-vault [data-go], #lane-vault button:not(.copy)").length === 0` and `/answers to the holder/.test(text)`.
- D9 "traits are read-only" — `page.hash("#identity")`: `$$("[data-act=setTrait]").length === 0`.
- D10 "the right expires and the sentence with it" — `warp(BLOCK.header.timestamp + 8n * 86400n); W.emit("accountsChanged", [renter.from.toString()])` → `body.dataset.rights === "0"` and the sentence is gone.
- D11 "nothing a renter can press sends" — click every button in every lane: `W.sent() === 0`.
- D12 "nothing a renter can press even estimates" — `W.calls.filter(x => x.method === "eth_estimateGas").length === 0`.

### E. "an absent Router hides the tab and sets the chip to not reported" — 12

Setup: the default `deploySite` (router `ZERO`, Market/Roles/AgentCard placeholders codeless). For E8, a second site: `deploySite(c2, out, { router: await c2.deploy(A("test/mocks/Breakable.sol","Breakable").bytecode) })` — an address with code whose `HUB()` reverts; for E10 a third with a real `Router` over `MockSwapRouter02` (as verify-vault.mjs 701–705 wires it).

- E1 "the state says absent, not zero" — `S.router === ZERO`, `(S.reported & S.bits.router) === 0`, `(S.absent & S.bits.router) !== 0`.
- E2 "the Elsewhere tab is hidden" — `page.hash("#swap")`: `$("[data-tab=elsewhere]") === null || $("[data-tab=elsewhere]").hidden === true`.
- E3 "the router chip reads not deployed" — `$("#chip-router").textContent === "router: not deployed on this chain"` and has class `off`.
- E4–E6 the Market, Roles and AgentCard chips likewise; `$$("#lanes a[href='#agent']").length === 0` or `aria-disabled`.
- E7 "a reported zero is a zero" — `$("#chip-pool").classList.contains("on")` and `$("#fact-market").textContent === "closed"` while `S.market.open === false` (Pool answered; the market is closed — verify.mjs's own sentence).
- E8 "code that would not answer reads could not be read" — on site 2: `$("#chip-router").textContent === "router: could not be read at block " + S2.block`.
- E9 "no clear bit is ever printed as 0" — for every `name in S.bits` with the bit clear: `!/:\s*0\b/.test($("#chip-" + name).textContent)`.
- E10 "with a Router the tab appears and quotes" — on site 3: `$("[data-tab=elsewhere]").hidden === false`; typing 1 shows a number from `quoteExactIn` (the shim's `eth_call` returns the `QuoteResult(uint256,uint256,uint160)` revert data: the shell decodes `spent, received`); the venue manifest lists `venues()` rows in hooklist shape (`$$("#venues .venue").length === venues.length`).
- E11 "no Nameplate, no ENS row" — `$("#ens-row") === null`.
- E12 "reactions degrade in words" — `/reactions unavailable on this chain/.test($("#lane-social").textContent)`.

### F. "every approval the slab builds is exact" — 15

Setup: mint #2 to `me`; `c.exec(weth, "mint(address,uint256)", [me, 1000n*WAD]); c.exec(weth, "approve(address,uint256)", [site.pool, 100n*WAD]); c.exec(site.pool, OPEN, [2, weth, ZERO, 30, 0, 0, 0]); c.exec(site.pool, DEPOSIT, [2, 100n*WAD, 10n*WAD], { value: 10n*WAD })` (Bundle.t.sol `_openMarket`: 100 WETH against 10 ETH). `c.exec(weth, "mint(address,uint256)", [trader.from.toString(), 10n*WAD])`. Boot `/token/2/live` console as `wallet(trader)`; `page.hash("#swap")`; `page.type($("#swap-in"), "1")`.

- F1 "the button's current step is the approve" — `/^Approve\b/.test($("#swap-go").textContent)`.
- F2 "pressing raises the slab and sends nothing" — `page.click($("#swap-go"))` → `$("#cbox").classList.contains("on")`, `W.sent() === 0`.
- F3 "the slab names the call and the target" — slab text has `approve(address,uint256)` and `To` = short(weth); `#cslab [data-selector]`.textContent === `S.sel["erc20.approve"]`.
- F4 "the amount word is exactly what was typed, in base units" — decode the pending calldata (`$("#cslab [data-calldata]").textContent`): word 1 === `WAD` (1 × 10^18).
- F5 "unlimited appears only as a refusal" — `/Never\s+unlimited/.test(slab)` and no other `unlimited`.
- F6 "the mask is nowhere" — the calldata contains no `ff{64}`; `dist/app.html` and every `dist/panels/*.js` lack `(1n<<256n)-1n` (build refuses; re-checked).
- F7 "signing sends one and the allowance is exact" — `page.click($("#cslab [data-go]"))` → `W.sent() === 1`, `allowance(trader, pool) === WAD`.
- F8 "the swap spends it to zero" — after the swap (group H): `allowance === 0n`.
- F9 "a new amount re-proposes a new exact approve, not a cumulative one" — type `2`, press: word 1 === `2n*WAD`.
- F10 "the Reach's approve through execute is exact too" — as holder, Vault › execute composer with target `weth`, data from the approve form: the inner calldata's amount equals the typed amount; `openApprovals()` afterwards lists `(weth, pool)` once.
- F11 "an ETH leg needs no approval" — flip to ETH-in: the button reads `Swap`, no approve step, slab `Value` equals the typed ether.
- F12 "Launch › sell approves exactly baseIn" — group J's coin: the `sell(uint256,uint256,uint256,uint64)` path first proposes `approve(launchpad, baseIn)` with word 1 === baseIn.
- F13 "the estimate ran before the offer" — in `W.calls`, the last `eth_estimateGas` index < the `eth_sendTransaction` index, and its `data` equals the sent `data`.
- F14 "the slab prints the digest and the engine hash" — `$("#cslab [data-digest]").textContent === kec(calldata)` and `[data-engine]` === `S.engineHash`.
- F15 "the slab prints To / Value / Function / arguments" — four `.kv` rows with those keys; the arguments row decodes `spender` and `amount` in words.

### G. "a non-holder sees the custom error before the wallet opens" — 10

Setup: holder (`me`) boots `/token/2/live` console; opens Swap › Your market › fee form, types `25` bps, presses "Set fee" → slab up. Then **underneath the open slab** the token is sold: `c.exec(site.hub, "transferFrom(address,address,uint256)", [me, buyer.from.toString(), 2])`.

- G1 "the slab's estimate names the error" — the shim's `eth_estimateGas` reverts `NotActor()`; `$("#cgas").textContent === "would revert: NotActor"` (name from `S.err[sel("NotActor()")]`).
- G2 "Sign is disabled when the estimate reverted" — `$("#cslab [data-go]").disabled === true`.
- G3 "no prompt was reached" — `W.prompts().length === 0`.
- G4 "the name came from the table the chain wrote" — `S.err[selector] === "NotActor"` and the shell did not carry its own copy (`!/NotActor/.test(fs.readFileSync("dist/app.html"))` — the word is absent from the shipped shell).
- G5 "an error with arguments prints them" — trader types an amount with `minOut` forced above the quote (edit the slab's floor field if offered, else `W.answer(site.pool, sel(SWAP_IN), …)` to make the estimate revert `Slippage(9,10)`): `/Slippage.*got 9.*wanted 10/.test($("#cgas").textContent)`.
- G6 "an unknown selector is still a sentence" — `W.answer(site.pool, …, () => revert("0xdeadbeef"))`: `$("#cgas").textContent` includes `0xdeadbeef` and `unknown error`, never empty.
- G7 "the epoch is re-read immediately before Sign" — with the sale done and a still-open slab whose estimate had passed (do the sale between estimate and Sign by stubbing `W.beforeSend = () => c.exec(transferFrom…)`): pressing Sign issues `eth_call custodyEpoch(uint256)`; it reads 2 ≠ `S.epoch`; the slab closes with `/ownership or epoch changed — review again/` and `W.sent() === 0`.
- G8 "rights are recomputed after the receipt" — after any successful send, `W.calls` shows `eth_call rightsOf` after `eth_getTransactionReceipt`; after the sale `document.body.dataset.rights === "0"` for the old holder.
- G9 "a hidden control is still gated" — as renter, dispatch a synthetic click on a hidden holder button found in the tree: no slab (`!$("#cbox").classList.contains("on")`), no estimate.
- G10 "a trader too big for the market is told so before any prompt" — type `60` (over half of 100 WETH): `/TradeTooLarge/.test($("#cgas").textContent)` or the card's own sentence, `W.prompts().length === 0`.

### H. "the swap slab states the floor in words" — 14

Setup: group F's market; trader with allowance standing (after F7). Type `1`.

- H1 "the quote is Pool.quote to the unit" — `$("#swap-out").dataset.raw === String(await quote)` where `quote = decUint(await c.read(site.pool, "quote(uint256,bool,uint256)", [2, true, WAD]))`; the formatted text re-parses (BigInt from the string × 10^dec) to the same value.
- H2 "the details name a rate, a floor and the fee" — `/rate/.test(det) && /receive at least|No less than/.test(det) && /fee/.test(det)`.
- H3 "the slab states the floor in words" — slab row `No less than <amount> <symbol> — or nothing moves` with amount = `fmt(quote - quote*50n/10000n)`.
- H4 "the floor in the calldata is the floor in the words" — decode word 3 (`minOut`) of the pending `swapExactIn` calldata === `quote - quote*50n/10000n`.
- H5 "the deadline is fifteen minutes, exactly, on the chain's clock" — `/Dies in fifteen minutes/.test(slab)`; word 5 === `BLOCK.header.timestamp + 900n` (Date.now pinned to the chain, §1.3).
- H6 "the recipient is the connected account" — word 4 === trader.
- H7 "the swap lands and honours the floor" — Sign → `W.sent()` +1, receipt `status 0x1`, `balanceOf(trader) delta >= minOut`.
- H8 "nonsense is refused, never sent, never NaN" — `page.type($("#swap-in"), "not a number")`: `$("#swap-go").disabled === true`, `$("#swap-out").textContent === ""`, no `NaN` anywhere in `document.body.textContent`.
- H9 "a trade over half the reserve is a sentence, not a number" — type `60`: `/more than half/.test($("#swap-out").textContent)` or TradeTooLarge wording.
- H10 "flipping turns the pair round" — click `#swap-flip`: `$("#swap-sym-in").textContent === "ETH"`, the pending calldata's `baseIn` word becomes 0.
- H11 "owned and elsewhere quotes are two numbers, or one" — with no Router: one `.quote` element; on site 3 (E10): two, labelled.
- H12 "the sniper fee shows as a countdown while it runs" — a market opened with `sniperBps 500, sniperSeconds 600` (`OPEN [3, weth, ZERO, 30, 0, 500, 600]`): `/sniper.*\d+ s/.test(card)` and after `warp(+601)` + repaint it is gone.
- H13 "a live seal hides the terms" — `c.exec(site.pool, "sealMarket(uint256,uint64)", [2, BLOCK.header.timestamp + 86400n])` → `$$("#your-market [data-act=setFee], [data-act=syncCurve], [data-act=sealMarket]").length === 0` and `/sealed until/.test($("#fact-market").textContent)`.
- H14 "the market directory comes from /open" — `page.fetches` includes `/open`; `$$("#directory .market").length === JSON.parse((await GET(["open"])).body).markets.length`.

### I. "the composer appears only for HOLD or ACCOUNT" — 15

Setup: token #1 (holder `me`); renter set as in D; `c.exec(site.hub, "setGuardian(uint256,address)", [1, guardianW.from]); c.exec(site.hub, "approve(address,uint256)", [1, stranger.from])` (operator/approvee); a session for `agentW`: `c.exec(reach, GRANT, [agentW.from, BLOCK.header.timestamp + 86400n, 0n, [], [weth], ["0xa9059cbb"], 0, 0])` where `reach = decAddr(await c.read(site.hub, "account(uint256)", [1]))`. Boot `#social` as each actor in turn.

- I1 holder: `$$("#lane-social [data-act=speak]").length >= 1` on commons, home and rooms.
- I2 renter (`rights 4`): none (D4).
- I3 stranger-with-approval (`rights 8`): none; sentence names "an operator may move the token, not speak".
- I4 session key (`rights 128`): none; `/a session speaks only through the Reach/`.
- I5 guardian (`rights 64`): none.
- I6 nobody (`rights 0`): none, sentence present.
- I7 "the Reach's own hand is offered to the holder" — `$("[data-act=speakAsReach]")` proposes `execute(address,uint256,bytes,uint8)` to `S.reach` with inner data starting `S.sel["parley.speak"]` and operation word 0.
- I8 "speaking raises a slab naming the commons and speak" — type, press: slab has `speak(uint256,uint256,uint8,uint64,uint64,bytes)`, `the commons`, `forever`; Sign → `decUint(await c.read(site.parley, "stateOf(uint256)", [0]), 1)` incremented by 1.
- I9 "the walk reads one block at a time by a topic the chain computed" — `W.filters().every(f => f.fromBlock === f.toBlock)`, `f.topics[0] === S.topics.said`, `f.topics[1]` is the room word.
- I10 "a hostile body is text" — `HOSTILE` from the donor: `row.textContent === HOSTILE`, `row.children.length === 0`, `page.innerHTMLWrites === 0`.
- I11 "the sender is a token, not an address" — `/^#\d+/.test(row.querySelector(".who").textContent)`.
- I12 "a home that has not spoken says so" — fresh token #3: `/has not spoken yet/.test($("#home").textContent)` (the `heads()`-returns-a-block wart: the count comes from `stateOf(room)` word 1).
- I13 "followers are the roster" — holder of #3 joins #1's home (`c.as(…).exec(site.parley, "join(uint256,uint256)", [homeKey, 3])`): `$$("#followers .token").length === 1` and `=== membersOf(home, 0).ids.length`.
- I14 "the DM key is re-read before every send" — both keys bound (`setEncryptionKey(uint16,bytes)` + `bindKey(uint256)` for #1 and #3 as Bundle.t.sol `_bindKey`): press send → between the click and `eth_sendTransaction`, `W.calls` contains `eth_call keyOf(uint256)` to `S.parley` for the recipient; then sell #3 (`transferFrom`) and rebind under the new holder → the next send is refused with `/key changed|changed hands/` and `W.sent()` unchanged.
- I15 "sealed only when both keys exist" — with one key bound: `/unsealed — publish a key/.test($("#dm-status").textContent)`; with both: `/^sealed/`.

### J. "the raise shows the tax as a countdown" — 14

Setup (Bundle.t.sol `_launchAndGraduate`, harness spelling from verify-launch.mjs): `c.exec(site.kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)", [1, "Agent One", "AGENT1", 18, SUPPLY, "0x"+"01".padStart(64,"0"), RAISE])` with `SUPPLY = 1_000_000_000n*WAD, RAISE = 900_000_000n*WAD`; `coin = "0x" + launchedLog.topics[1].slice(26)` from `getLogs({ address: site.kiln, topics: [topic("Launched(address,uint256,address,string,uint256,uint256)")] })`; `c.exec(site.launchpad, \`create(${PARAMS})\`, [[1, coin, 700_000_000n*WAD, WAD, 3n*WAD, 0n, 1000n, (1n<<128n)-1n, 9900, 100, 0, 0, T0 + 7n*86400n, 0]])` (`fairWindow 1000 s`, `snipeTaxStartBps 9900`, `feeBps 100`); `L = decUint(createdLog.topics[1])`. Boot `#launch` as `wallet(buyer)`.

- J1 "the raise is listed with its coin" — `$$("#raises .raise").length === launchesOf(1).length` and the row shows `AGENT1` through textContent.
- J2 "the tax at the opening block" — `$("#tax").textContent === "99.00 %"` and `decUint(await c.read(site.launchpad, "snipeTaxBps(uint256)", [L])) === 9900n`.
- J3 "the window is a countdown" — `/\d+ s/.test($("#tax-countdown").textContent)` with the number === `fairWindowEnds - BLOCK.header.timestamp`.
- J4 "halfway, half" — `warp(T0 + 500n); W.emit("chainChanged", "0x1")` (or `page.click($("#refresh"))`): `$("#tax").textContent === "49.50 %"` (verify-launch.mjs:227 asserts 4950 on chain).
- J5 "after the window, no tax" — `warp(T0 + 1001n)`: `/no tax/.test($("#tax").textContent)` and the countdown element is gone.
- J6 "the floor per token is the coin's" — `$("#floor").dataset.raw === String(decUint(await c.read(coin, "floorPerToken()")))`.
- J7 "the curve preview is quoteBuy" — type `1` ETH: `#buy-out`, `#buy-fee`, `#buy-snipe` raw values equal `quoteBuy(L, WAD)`'s three words.
- J8 "the buy slab names the call, the fee cap and the deadline" — slab has `buy(uint256,uint256,uint64,uint16)`, a `maxFeeBps` row, `Dies in fifteen minutes`; word 2 (`deadline`) === `BLOCK.header.timestamp + 900n`.
- J9 "the buy lands as credit" — Sign → `creditOf(L, buyer) > 0n`.
- J10 "graduation is anyone's" — after three 1-ETH buys (buyer, trader, stranger), boot as `stranger`: `$("[data-act=graduate]")` exists for a wallet with rights 0; Sign → `launchOf(L).state === 2`.
- J11 "collect shows the sealed market and pays the Reach" — after `_tradeSealed`-style trades: `$("#positions .sealed").textContent` includes the key and `feeQuoteOwed`; the slab names `collect(uint256)`.
- J12 "coinAt is previewed, nothing sent" — Coin form filled, press "where would it land": `eth_call coinAt(…)` issued, `$("#coin-preview").textContent` is the address, `W.sent()` unchanged.
- J13 "the launch spacing is a countdown too" — a second Coin attempt within 7 days: `/TooSoon/.test($("#cgas").textContent)` **or** the form shows `/next launch in \d+/` from `lastLaunchAt + LAUNCH_SPACING`.
- J14 "locks list the Reach's" — `c.exec(site.locks, "lock(address,uint112,address,uint64,uint64,uint64,bool)", [ZERO, WAD, reach, 0, until, until, false], { value: WAD })`: `$$("#locks .lock").length === Number(lockCountOf(reach))`.

### K. "the vault lists open approvals and revokes in one press" — 22

Setup: holder `me`, token #1, `reach`. `c.exec(weth, "mint(address,uint256)", [reach, 10n*WAD]); c.exec(reach, EXEC, [weth, 0n, enc("approve(address,uint256)", [site.pool, 10n*WAD]), 0])` → `openApprovals().length === 1` (Bundle.t.sol asserts exactly this). Boot `#vault` as `wallet(c)`.

- K1 "the ledger renders" — `$$("#approvals .row").length === 1`, row text has `WETH` and `short(pool)`.
- K2 "the allowance is read live and printed exactly" — row `.allowance` raw === `allowance(reach, pool)` (`10n*WAD`).
- K3 "one press proposes revokeOpenApprovals" — click `#revoke-all`: slab has `revokeOpenApprovals()`, `W.sent() === 0`.
- K4 "Sign revokes in one transaction" — `W.sent() +1`; `openApprovals().length === 0`; `allowance === 0n`; the row list re-renders empty with "nothing may leave".
- K5 "holdings say measured or not, never 0 for unmeasurable" — `holdings()` → rows; a `Breakable` asset guarded then broken (verify-vault.mjs 437–460) shows `not measurable`, not `0`.
- K6 "the seal slider cannot shorten" — `Number($("#seal-until").min) >= Number(sealedUntil)`; `/only ever lengthens/.test($("#seal-note").textContent)`.
- K7 "the seal slab names the date" — `seal(uint64)` and a date string equal to the slider's value.
- K8 "a sealed Reach refuses value in words before any prompt" — `c.exec(reach, "seal(uint64)", [T0 + 30n*86400n])`; execute composer with value 1 → `$("#cgas").textContent === "would revert: ValueWhileSealed"`.
- K9 "the Grip warns before any way in" — `$("#grip-address").textContent.toLowerCase() === S.grip.toLowerCase()`; `$("#grip svg")` exists; `/cannot ever leave|permanent/i.test($("#grip-warning").textContent)` and the warning precedes any `a[href]` in `#grip`.
- K10 "the Grip offers nothing outbound" — `$$("#grip button").every(b => b.classList.contains("copy"))`.
- K11 "session chips carry on-chain selectors" — `$$("#sessions [data-sel]").length >= 4`, each `dataset.sel` is a value in `S.sel`, including `S.sel["pool.swapExactIn"] === sel(SWAP_IN)`.
- K12 "the grant's calldata is exactly the chips pressed" — press one chip + target `site.pool` + key `0x5a…` + 1 day: decode the pending `grantSession` tuple: `selectors.length === 1 && selectors[0] === sel(SWAP_IN)`, `targets[0] === pool`, `expires === BLOCK.header.timestamp + 86400n`.
- K13 "the exposure is printed before Sign" — `/exposure/.test(slab)` with `nativeCap` and each asset cap in words.
- K14 "the account agrees" — Sign → `sessionAllows(key, pool, sel(SWAP_IN)) === true`, `sessionAllows(key, pool, sel("withdraw(uint256,uint256,uint256,address)")) === false`, `sessionAllows(key, S.hub, sel(SWAP_IN)) === false` (the donor's three, 2111–2118).
- K15 "revoking one key" — row's revoke → `revokeSession(address)`; `sessionCurrent(key) === false`.
- K16 "the steward speaks in words" — `$("#steward-status").textContent === "nothing arranged"` (NO_PLAN 0); after `arrange` (Bundle.t.sol `_arrange`: `heirHashOf(address,bytes32)` read first) → `"speaking"`; after `warp(+30 d)` → `"summonable"`.
- K17 "the heir hash is the chain's" — the arrange form issues `eth_call heirHashOf(address,bytes32)`; the slab's `heirHash` word equals it; no keccak of the heir in page JS (`!/heirHash.*keccak/`).
- K18 "the heartbeat is the holder's" — `$("[data-act=stillHere]")` present for holder, absent for renter.
- K19 "the sell checklist comes before the transfer" — press "Sell / transfer": `#checklist` renders two columns `survives` / `revoked` **before** any slab; `W.prompts().length` unchanged.
- K20 "the checklist names what is actually live" — with a session, a bound key, a priced inbox (`configureInbox(uint256,address,uint128,uint64,bool)` `[1, ZERO, WAD/10n, 86400n, true]`), a plan: the revoked column lists `sessions: 1`, `key bound: yes`, `inbox price: 0.1 ETH`, `steward plan: speaking`; the survives column lists `seal`, `market`, `Grip contents`, `name`, `open approvals: 0`.
- K21 "execute is call-only" — the composer's slab names `execute(address,uint256,bytes,uint8)` and the operation word is `0`; no control offers `1`.
- K22 "a batch is one slab, one transaction" — two rows → slab `executeBatch((address,uint256,bytes)[])`, decoded array length 2; Sign → `W.sent() +1`.

### L. "panic lists what it revokes" — 10

Setup (Bundle.t.sol `test_panicRevokesAcrossEverySatellite`): session for `agentW`, `_bindKey`, `configureInbox` priced, `setGuardian(1, guardianW)`, `setApprovalForAll(stranger, true)`, `approve(trader, 1)`, `setUser(1, renter, +10 d)`, guardian `approveFirstLaunch(uint256)`, `_arrange`. Boot `#vault` as holder.

- L1 "one red button" — `$$("#panic").length === 1 && $("#panic").classList.contains("red")`.
- L2 "the first press lists, from live reads" — click: `#panic-list` has rows `sessions (1)`, `key binding`, `inbox price 0.1 ETH`, `steward plan`, `first-launch approval`, `operator approvals (every token you hold)`, `single approval → trader`, `user → renter`, `status → Paused`, `seal → <date of +365 d>`; `W.calls` shows the reads (`sessionCurrent`/`keyOf`/`inboxOf`/`wouldPass`/`firstLaunchApproved`/`isApprovedForAll`/`getApproved`/`userOf`) after the click.
- L3 "nothing delegated is still a sentence" — on a fresh token: `/nothing is delegated/.test(list) && /still moves the epoch and seals/.test(list)`.
- L4 "the second press proposes panic" — slab `panic(uint256)`, `W.sent() === 0` until Sign.
- L5 "one transaction does all of it" — Sign → `W.sent() +1`; chain: `custodyEpoch(1) === 2n`, `approvalEpoch(me) === 1n`, `statusOf === 1`, `sealedUntil(reach) === T0 + 365n*86400n`, `sessionCurrent(agentW) === false`, `keyOf(1).keyId === 0`, `inboxOf(1).postage === 0n`, `wouldPass(1) === 1 (SOLD)`, `firstLaunchApproved === false`, `isApprovedForAll(me, stranger) === false`, `getApproved(1) === ZERO`, `userOf(1) === ZERO`.
- L6 "the page re-reads and says so" — `#fact-epoch` `2`, `#fact-status` `Paused`, Identity's Active/Paused sentence visible, `#sessions .row` count 0, `/sealed until/.test($("#fact-seal").textContent)`.
- L7 "the guardian's panic is a different list" — boot as `guardianW`: `/does not touch the holder's operators/.test(list) && /guardian hold/.test(list)`; slab `panic(uint256)`.
- L8 "under the hold, only the holder releases" — after the guardian's Sign: `$("#chip-locked").textContent === "locked: yes"`, `/only the holder in person/.test(text)`; `[data-act=release]` absent for the guardian, present for the holder; holder's Sign → `locked(1) === false`.
- L9 "nobody else sees the button" — renter and stranger boots: `$("#panic") === null`.
- L10 "panic is one transaction" — `W.sent()` grew by exactly 1 per panic.

### M. Identity — 10

- M1 "the rule is printed verbatim" — `$("#status-rule").textContent === "sessions act only while Active; a sale pauses the token; re-arm to let your keys act"` (DESIGN §1).
- M2 "the status follows the chain and re-arm is the holder's" — Active at mint; after a sale `Paused`; `[data-act=setStatus]` present for the new holder only; Sign → `statusOf === 0`.
- M3 "rights of any address" — type `renter`: chips `USE` on, others off; type `S.reach`: `ACCOUNT`; type `ZERO`: all off.
- M4 "the fingerprint diff" — `#fingerprint-baked === S.fingerprint`; after `openMarket` on chain: `/changed since this document was rendered/.test($("#fingerprint-live").textContent)` and the live value equals `getStateFingerprint(1)`.
- M5 "a known 7702 delegate is named, an unknown one hides spending" — `putCode(holder, 0xef0100 ‖ 0x63c0c19a282a1b52b07dd5a65b58948a07dae32b)` → `$("#delegate").textContent === "MetaMask EIP7702StatelessDeleGator"` (`knownDelegates()` names[0]); `putCode(holder, 0xef0100 ‖ 0xdead…)` → `/unknown delegate/.test(…)` and `$$("[data-spend]").every(b => b.hidden)` until `page.click($("#ack-delegate"))`. (Reads only: EIP-3607.)
- M6 "the console re-hashes itself" — `page.fetches` includes `/token/1/hash`; `$("#verified").textContent` includes `verified against chain at block`; tamper `W.tamperFetch("/token/1/hash", j => ({ ...j, document: "0x" + "00".repeat(32) }))` → `/does not match/`.
- M7 "the encryption key is a two-step" — no key: `/no key bound/`; after `setEncryptionKey` via the slab (`setEncryptionKey(uint16,bytes)`) the next step offers `bindKey(uint256)`; after Sign: `/bound at epoch 1/`.
- M8 "the guardian form is the holder's" — present for holder, absent for guardian and renter.
- M9 "the agent wallet is proposed then accepted" — `proposeAgentWallet(uint256,address)` slab; after Sign `$("#proposed").textContent` names it as pending; the `acceptAgentWallet(uint256)` control appears only when the connected account is the proposed wallet.
- M10 "no ENS row on a band without Nameplate" — `$("#ens-row") === null`.

### N. Discovery and the chain gate — 11

- N1 "two wallets, a picker, no choice made for you" — two `wallet()`s with rdns `io.a`, `io.b`: `$$("#picker button").length === 2`, names via textContent, `WA.prompts().length + WB.prompts().length === 0` until a click.
- N2 "one wallet is used, but not before a gesture" — single announce: no picker; `eth_requestAccounts` only after `page.click($("#connect"))`.
- N3 "dedup by rdns" — announce `io.a` twice (different uuid): one button.
- N4 "a late wallet joins" — announce after boot: picker count grows by one.
- N5 "legacy fallback only when nothing announced" — `{ legacy: true }` and no announce: used; `{ legacy: true }` plus an announce: the announced one is used (`W.calls` on the announced provider only).
- N6 "the wrong chain is refused before any read, and offers the move" — `W.setChain(0x2105)` before boot: `W.calls.filter(x => x.method === "eth_call").length === 0`; `/wallet on chain 8453/.test($("#chip-chain").textContent)`; click `#switch` → `wallet_switchEthereumChain` with `params[0].chainId === "0x1"`.
- N7 "chainChanged recomputes" — after N6, `W.setChain(1)`: `rightsOf` called again; chip clears; lanes enabled.
- N8 "accountsChanged recomputes" — `W.setAccounts([renter])`: `rightsOf` with the renter word; `body.dataset.rights` goes from `1` to `4`.
- N9 "quiet first, loud on a gesture" — order in `W.calls`: `eth_chainId`, `eth_accounts`, … and `eth_requestAccounts` only after the click.
- N10 "the choice is a convenience" — console: `localStorage` holds the rdns after choosing; viewer: the throwing store leaves no trace and the shell did not throw (`page.errors.length === 0`).
- N11 "the delegate check happens at connect" — `eth_getCode` with the holder's address appears in `W.calls` after `eth_requestAccounts`.

### O. Escaping — the DOM half of F4 — 5

Setup from verify.mjs's hostile section: a coin with symbol `</script><script>alert(1)</script>` as base of #1's market; `setTrait(1, keccak("name"), "</script>x")`; a Parley word `HOSTILE`.

- O1 "the symbol is text in the swap card" — `$("#swap-sym-in").textContent === "</script><script>alert(1)</script>"`, `children.length === 0`.
- O2 "the name trait is text on Home" — `$("#fact-name").textContent === "</script>x"`.
- O3 "a message body is text" — I10.
- O4 "innerHTML was never assigned" — `page.innerHTMLWrites === 0` across the run (tripwire).
- O5 "the state block still parses with all of it inside" — `JSON.parse(stateOfHtml(live.body).text)` succeeds and the raw text has no `</script>`.

### P. The loader itself — 5

- P1 "document.write received the shell" — A2.
- P2 "the state object is the one the gap wrote" — A3 sentinel identity.
- P3 "the payload property was deleted" — `ctx.$INTACT === undefined` and `!("$INTACT" in ctx)`.
- P4 "a corrupted payload fails in words, not silence" — flip a base64 character: `document.body.textContent.startsWith("INTACT could not inflate itself in this browser.")`.
- P5 "the shim reproduces the collision the loader rule guards against" — negative control: after a boot, `vm.runInContext("const " + firstTopLevelName + "=0", ctx)` throws `SyntaxError` (first name read off `dist/app.html`'s first `const`).

Count: A 10 + B 16 + C 12 + D 12 + E 12 + F 15 + G 10 + H 14 + I 15 + J 14 + K 22 + L 10 + M 10 + N 11 + O 5 + P 5 = **193**, grouped under the eleven BUILD-PLAN sentences plus boot, discovery, identity, escaping and the loader. Each sentence above is meant to be the `ok()` string, so `docs/INVARIANTS.md` rows F3–F6 can name them (F3 already names *"a tampered panel is refused"*, F4 *"a coin named `</script>` cannot end the state block"* — O1/O5 here, F6 *"an absent Router hides the tab and sets the chip to not reported"* — E2/E3).

---

## 6. Open questions and risks for the shell author

1. **Element ids are a contract between shell and suite.** The ids used above (`#swap-in`, `#swap-go`, `#cbox`, `#cslab [data-go]`, `#chip-<bit>`, `#fact-<key>`, `#lane-<name>`, `#panic`, `#checklist`, `body.dataset.{mode,rights}`) are proposals; whichever names the shell takes, keep the donor's two that U11's Chromium driver already relies on — `#cbox.on` and `#cslab [data-go]` / `[data-no]` — so verify-site and verify-console share a vocabulary.
2. **A test seam for the pending transaction.** The slab should expose the exact calldata it will send as data (`[data-calldata]`, `[data-digest]`, `[data-selector]`) so F4/H4/K12 decode bytes rather than regex prose. It costs nothing and it is what a careful holder reads anyway.
3. **The https gateway twin vs. the no-host rule.** build-app refuses any `https?://<host>.(org|com|io|xyz|net)` literal in `dist/`; DESIGN §1 wants an `https://` twin in viewer mode. On a gateway the twin is `location.origin + path`; in a `data:` viewer there is no origin and no permitted host — print the `web3://` link and a *template* twin (`https://<gateway>/…`) or decide the twin exists only on a real origin. The suite asserts B3 either way; decide before the shell is written.
4. **Panels are classic scripts, whispers.mjs is a module.** `export` must be stripped and the module inlined into `social.js` at build (reader B §4.6 says the same); the suite verified the inlined form runs under WebCrypto in a vm context.
5. **`heads()` returns blocks, not counts** (INTERFACE-CHANGES wart) — the social panel must read `stateOf(room)` word 1 for a count; I12 catches a panel that gets this backwards.
6. **`Chain.send` returns no hash.** Either the additive `hash:` field in `evm.mjs` or the shim's own tx construction (§2.2) — pick one before writing `eth_getTransactionReceipt`.
7. **`eth_call` revert data.** `Chain.call` throws `Error("call reverted: revert 0x…")` with the bytes truncated to 138 hex chars; the shim should use `c.vm.evm.runCall` directly (as `Chain.call` does) to hand the page the full `returnValue`, since `Slippage(uint256,uint256)` needs 68 bytes and `QuoteResult(uint256,uint256,uint160)` 100.
8. **EIP-3607.** A 7702-coded sender cannot send through `runTx`; keep M5 read-only or add a `skipEoaCheck`-style branch only if ethereumjs grows one (it has `skipNonce`/`skipBalance`, not that).
9. **Timers.** The shell's receipt watcher and countdowns must take their interval from a single constant (or `INTACT.time`-anchored arithmetic) so compressed timers in the shim do not change *what* is asserted, only how long it takes; and `Date.now()` should be used only for live countdowns, never for a deadline word (use `INTACT.time` + re-read `eth_blockNumber`/block timestamp when a wallet is present), otherwise H5/J8 become approximate.
10. **One context per page, always.** Minified top-level names collide across remounts in a shared context; the suite must never reuse a context, and the shim should assert `ctx.__used !== true` on `openPage`.
