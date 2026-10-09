/*───────────────────────────────────────────────────────────────────────────
  INTACT · the DOM and wallet shim the site suite boots the console in

  Origin: IPSEITY tools/verify-site.mjs lines 836–1044 (C §1–§2), rewritten
  for a document that REPLACES ITSELF. Nothing in the donor ever ran the
  Renderer's loader: the pages it mounted were server-rendered HTML with
  inline classic scripts, so a regex over `<script>` blocks and a map of
  elements by id was a whole browser. INTACT's `/token/<id>/live` is a
  prologue, a state script, a base64 payload and an async loader that
  inflates the shell with DecompressionStream and `document.open()`s,
  writes it and closes — so this shim is the first tool to execute that
  loader, and it does so in one `vm` context per page, exactly as a browser
  does: `open()` empties the tree and keeps the Window, the written shell's
  scripts run in document order, and a second `const D` at the top level
  throws the same SyntaxError Chromium throws (boot group P5 proves the
  shim reproduces the collision the loader rule guards against).

  What is faked, and how far (C §1.3, §6.2 of the blueprint):

      the tree       a hand-rolled tokenizer (open/close/void tags, quoted
                     and unquoted attributes, raw text for script/style,
                     comments and the doctype skipped) into nodes with the
                     DOM surface the shell and the panels use — textContent
                     get/set, append/appendChild/insertBefore/replaceChildren/
                     remove, attributes, a live dataset, classList, style,
                     closest/matches/querySelector(All) over a compound
                     selector matcher (tag #id .class [attr] [attr=v],
                     descendant and > combinators, :not())
      events         a bubbling dispatcher with target/currentTarget, Node's
                     own Event/CustomEvent classes as the objects; the window
                     is an EventTarget too (EIP-6963, hashchange, load)
      innerHTML      a setter that COUNTS and THROWS — and so do outerHTML's
                     setter and insertAdjacentHTML, the other two markup-string
                     sinks. The build refuses the assignment in shipped text;
                     this refuses it at run time, and the whole suite asserts
                     the count stayed 0 (O4)
      open()         empties the tree, keeps the Window's properties and
                     ERASES every event listener, as the HTML spec says and
                     Chromium does; the loader's EIP-6963 capture exists
                     because of this, and the shim would have hidden it
      scripts        inline scripts run in order inside close(); a <script>
                     whose src is a blob: URL resolves through node:buffer's
                     resolveObjectURL, runs in the same context, and is
                     recorded with its text and keccak (page.appended); any
                     other src is recorded and refused
      storage        console: a Map; viewer: a throwing getter that counts
                     reads (ctx.__storageReads), because the opaque-origin
                     detector is "localStorage throws" and B16 asserts the
                     page probed it exactly once
      fetch          console: GET(segments) against the deployed Premises,
                     Content-Encoding: gzip honoured the way a browser does
                     (the page sees inflated bytes), every call recorded,
                     a /<premises>:<chain> prefix stripped before routing
                     (R11); viewer: TypeError("Failed to fetch")
      location       built from the page URL; a hash setter that dispatches
                     hashchange; an href setter that RECORDS the navigation
                     instead of following it (the mint flow asserts it)
      clock          ctx.Date.now() is the chain's block timestamp, so a
                     countdown and the chain agree — and so a deadline the
                     shell cheats from Date.now() is indistinguishable from
                     one it reads, which is why the deadline assertions move
                     eth_getBlockByNumber's answer first (D11)
      timers         compressed to ≤ 2 ms, so the three-minute receipt
                     watcher and the 150 ms chooser instant finish in a
                     test's lifetime; requestAnimationFrame/IdleCallback →
                     setTimeout 0

  The wallet (walletFor) is an EIP-1193 provider announced over EIP-6963
  (and as window.ethereum with `legacy`), answering from the in-process
  chain: eth_call and eth_estimateGas through Chain.simulate, so a revert
  reaches the page with its FULL data (D15); eth_sendTransaction through the
  actor's own `send` — and only with `from` = the actor, since that is the one
  key the shim holds (a `from` that setAccounts named is refused with 4100
  rather than signed by the wrong key) — a revert becoming a receipt with
  status 0x0 and never a throw (F §1.9); personal_sign as a real secp256k1 signature over the
  prefixed message; eth_getLogs from the chain's ledger. Every call is kept
  in order (W.calls), every prompting method in W.promptsLog, and three
  override hooks stage what a node might say: W.answer(to, selector, fn) for
  one eth_call target, W.override(method, fn) for a whole method, W.refuse.
  There is no W.beforeSend: a race against the epoch re-read is staged by
  landing the competing transaction between the estimate and the press.

  Exports: boot, walletFor, nap, click, fill, textOf, prompts, parse.
───────────────────────────────────────────────────────────────────────────*/
import vm from "node:vm";
import zlib from "node:zlib";
import { resolveObjectURL } from "node:buffer";
import { createAddressFromString } from "@ethereumjs/util";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import * as EVM from "./evm.mjs";

export const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (u) => "0x" + Buffer.from(u).toString("hex");
const kec = (b) => hex(keccak256(Buffer.isBuffer(b) || b instanceof Uint8Array ? b : Buffer.from(String(b), "utf8")));
const VOID = new Set(["meta", "link", "input", "br", "img", "hr", "area", "base", "col", "embed", "source", "track", "wbr"]);
const BOOL_ATTRS = new Set(["hidden", "disabled", "checked", "readonly", "required", "selected"]);

/*═══════════════════ the tree ═══════════════════*/

const camel = (k) => k.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const kebab = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

class Node {
  constructor(doc, type, tagName, ns) {
    this.ownerDocument = doc;
    this.nodeType = type;              // 1 element, 3 text, 9 document, 11 fragment
    this.tagName = tagName;
    this.namespaceURI = ns || null;
    this.attrs = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this._ls = new Map();
    this._text = "";
    this._value = undefined;
    this.style = mkStyle();
    this.dataset = mkDataset(this);
    this.classList = mkClassList(this);
  }
  /*── text ──*/
  get nodeValue() { return this.nodeType === 3 ? this._text : null; }
  get textContent() { return this.nodeType === 3 ? this._text : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) {
    if (this.nodeType === 3) { this._text = String(v); return; }
    for (const c of this.childNodes) c.parentNode = null;
    this.childNodes = [];
    if (v != null && String(v) !== "") this.appendChild(this.ownerDocument.createTextNode(String(v)));
  }
  get innerText() { return this.textContent; }
  set innerText(v) { this.textContent = v; }
  /*── the tripwire: every markup-string sink — innerHTML, outerHTML, insertAdjacentHTML —
       counted on the page and refused with one sentence ──*/
  _markup(sink, v) {
    const page = this.ownerDocument._page;
    if (page) page.innerHTMLWrites++;
    throw new Error(sink + " refused by the shim (chain strings reach the DOM through textContent only): " + String(v).slice(0, 60));
  }
  get innerHTML() { return this.childNodes.map(serialize).join(""); }
  set innerHTML(v) { this._markup("innerHTML assignment", v); }
  get outerHTML() { return serialize(this); }
  set outerHTML(v) { this._markup("outerHTML assignment", v); }
  insertAdjacentHTML(where, v) { this._markup("insertAdjacentHTML", v); }
  /*── structure ──*/
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get nextSibling() { const p = this.parentNode; if (!p) return null; const i = p.childNodes.indexOf(this); return p.childNodes[i + 1] || null; }
  get previousSibling() { const p = this.parentNode; if (!p) return null; const i = p.childNodes.indexOf(this); return p.childNodes[i - 1] || null; }
  get nextElementSibling() { let n = this.nextSibling; while (n && n.nodeType !== 1) n = n.nextSibling; return n; }
  get isConnected() { let n = this; while (n) { if (n.nodeType === 9) return true; n = n.parentNode; } return false; }
  contains(n) { while (n) { if (n === this) return true; n = n.parentNode; } return false; }
  _adopt(n) {
    if (typeof n === "string" || typeof n === "number" || typeof n === "bigint") return this.ownerDocument.createTextNode(String(n));
    if (n.nodeType === 11) return n;   // fragments are unwrapped by the caller
    if (n.parentNode) n.parentNode.removeChild(n);
    return n;
  }
  appendChild(n) {
    n = this._adopt(n);
    if (n.nodeType === 11) { for (const c of [...n.childNodes]) this.appendChild(c); return n; }
    n.parentNode = this; this.childNodes.push(n); this.ownerDocument._mounted(n); return n;
  }
  append(...nodes) { for (const n of nodes) this.appendChild(n); }
  prepend(...nodes) { for (const n of nodes.reverse()) this.insertBefore(n, this.firstChild); }
  insertBefore(n, ref) {
    n = this._adopt(n);
    if (n.nodeType === 11) { for (const c of [...n.childNodes]) this.insertBefore(c, ref); return n; }
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    n.parentNode = this;
    if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n);
    this.ownerDocument._mounted(n); return n;
  }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) { this.childNodes.splice(i, 1); n.parentNode = null; } return n; }
  replaceChildren(...nodes) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...nodes); }
  replaceChild(n, old) { this.insertBefore(n, old); this.removeChild(old); return old; }
  replaceWith(...nodes) { const p = this.parentNode; if (!p) return; for (const n of nodes) p.insertBefore(n, this); p.removeChild(this); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  cloneNode(deep) {
    const c = new Node(this.ownerDocument, this.nodeType, this.tagName, this.namespaceURI);
    c._text = this._text; for (const [k, v] of this.attrs) c.attrs.set(k, v);
    if (deep) for (const k of this.childNodes) c.appendChild(k.cloneNode(true));
    return c;
  }
  /*── attributes ──*/
  setAttribute(k, v) { this.attrs.set(String(k).toLowerCase(), String(v)); }
  getAttribute(k) { k = String(k).toLowerCase(); return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(String(k).toLowerCase()); }
  hasAttribute(k) { return this.attrs.has(String(k).toLowerCase()); }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  get id() { return this.getAttribute("id") || ""; }
  set id(v) { this.setAttribute("id", v); }
  get className() { return this.getAttribute("class") || ""; }
  set className(v) { this.setAttribute("class", v); }
  get hidden() { return this.hasAttribute("hidden"); }
  set hidden(v) { v ? this.setAttribute("hidden", "") : this.removeAttribute("hidden"); }
  get disabled() { return this.hasAttribute("disabled"); }
  set disabled(v) { v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled"); }
  get checked() { return this.hasAttribute("checked"); }
  set checked(v) { v ? this.setAttribute("checked", "") : this.removeAttribute("checked"); }
  get value() { return this._value !== undefined ? this._value : (this.getAttribute("value") || ""); }
  set value(v) { this._value = String(v); }
  get type() { return this.getAttribute("type") || ""; }
  set type(v) { this.setAttribute("type", v); }
  get href() { return this.getAttribute("href") || ""; }
  set href(v) { this.setAttribute("href", v); }
  get src() { return this.getAttribute("src") || ""; }
  set src(v) { this.setAttribute("src", v); this.ownerDocument._mounted(this); }
  get alt() { return this.getAttribute("alt") || ""; }
  set alt(v) { this.setAttribute("alt", v); }
  get title() { return this.getAttribute("title") || ""; }
  set title(v) { this.setAttribute("title", v); }
  get name() { return this.getAttribute("name") || ""; }
  set name(v) { this.setAttribute("name", v); }
  get placeholder() { return this.getAttribute("placeholder") || ""; }
  set placeholder(v) { this.setAttribute("placeholder", v); }
  get autocomplete() { return this.getAttribute("autocomplete") || ""; }
  set autocomplete(v) { this.setAttribute("autocomplete", v); }
  get min() { return this.getAttribute("min") || ""; }
  set min(v) { this.setAttribute("min", v); }
  get max() { return this.getAttribute("max") || ""; }
  set max(v) { this.setAttribute("max", v); }
  get htmlFor() { return this.getAttribute("for") || ""; }
  set htmlFor(v) { this.setAttribute("for", v); }
  get tabIndex() { return Number(this.getAttribute("tabindex") || 0); }
  set tabIndex(v) { this.setAttribute("tabindex", v); }
  get readOnly() { return this.hasAttribute("readonly"); }
  set readOnly(v) { v ? this.setAttribute("readonly", "") : this.removeAttribute("readonly"); }
  get offsetWidth() { return 0; } get offsetHeight() { return 0; } get scrollTop() { return 0; } set scrollTop(v) {} get scrollHeight() { return 0; }
  getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }; }
  scrollIntoView() {} focus() { this.ownerDocument.activeElement = this; } blur() {} select() {}
  /*── selectors ──*/
  matches(sel) { return parseSelector(sel).some((chain) => matchChain(this, chain)); }
  closest(sel) { let n = this; while (n && n.nodeType === 1) { if (n.matches(sel)) return n; n = n.parentNode; } return null; }
  querySelectorAll(sel) { const out = []; const chains = parseSelector(sel); walk(this, (n) => { if (n !== this && n.nodeType === 1 && chains.some((c) => matchChain(n, c))) out.push(n); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementsByTagName(t) { const out = []; walk(this, (n) => { if (n !== this && n.nodeType === 1 && (t === "*" || n.tagName.toLowerCase() === t.toLowerCase())) out.push(n); }); return out; }
  getElementsByClassName(c) { return this.querySelectorAll("." + c); }
  /*── events: bubbling, with target and currentTarget ──*/
  addEventListener(type, fn, opts) { if (!fn) return; if (!this._ls.has(type)) this._ls.set(type, []); this._ls.get(type).push({ fn, once: !!(opts && opts.once) }); }
  removeEventListener(type, fn) { const l = this._ls.get(type); if (l) this._ls.set(type, l.filter((x) => x.fn !== fn)); }
  _invoke(ev) {
    const l = this._ls.get(ev.type); if (!l) return;
    Object.defineProperty(ev, "currentTarget", { value: this, configurable: true });
    for (const x of [...l]) {
      if (x.once) this._ls.set(ev.type, this._ls.get(ev.type).filter((y) => y !== x));
      try { typeof x.fn === "function" ? x.fn.call(this, ev) : x.fn.handleEvent(ev); }
      catch (e) { this.ownerDocument._page?.errors.push(e); }
      if (ev.cancelBubble && ev._stopImmediate) break;
    }
  }
  dispatchEvent(ev) {
    Object.defineProperty(ev, "target", { value: this, configurable: true });
    let n = this;
    while (n) { n._invoke(ev); if (ev.cancelBubble || !ev.bubbles) break; n = n.parentNode; }
    if (ev.bubbles && !ev.cancelBubble) this.ownerDocument._page?.win._invoke(ev);
    return !ev.defaultPrevented;
  }
  /*  A person's click, not the API's: a disabled control is inert in every browser (no event,
      no handler), and so is an element carrying `hidden` or one inside an ancestor that does.
      A browser's own el.click() would still dispatch on a hidden node, which is exactly the
      lie this once told: the boot group clicked a hidden #connect and the shell prompted,
      where no finger could have reached it (U9 review, round two). That is the whole model:
      the shim parses no CSS, so a lane section without `.on` or a `#cbox` without it
      (display:none in app.css) is still clickable here, by design — the boot group's clickAll
      presses every control in the document to prove the viewer never prompts, and occlusion
      is for U11's real browser (round three, info). Returns false, dispatches nothing. */
  click() { if (this.disabled || this.closest("[hidden]")) return false; const ev = new this.ownerDocument._page.ctx.Event("click", { bubbles: true, cancelable: true }); return this.dispatchEvent(ev); }
}

function mkStyle() {
  const s = {};
  Object.defineProperties(s, {
    setProperty: { value: (k, v) => { s[k] = String(v); s[camel(k.replace(/^--/, "ⵈ"))] = String(v); }, enumerable: false },
    getPropertyValue: { value: (k) => s[k] || "", enumerable: false },
    removeProperty: { value: (k) => { delete s[k]; }, enumerable: false },
    cssText: { get() { return Object.keys(s).map((k) => k + ":" + s[k]).join(";"); }, set(v) {}, enumerable: false }
  });
  return s;
}
function mkDataset(el) {
  return new Proxy({}, {
    get: (_, k) => typeof k === "string" ? (el.attrs.has("data-" + kebab(k)) ? el.attrs.get("data-" + kebab(k)) : undefined) : undefined,
    set: (_, k, v) => { el.attrs.set("data-" + kebab(String(k)), String(v)); return true; },
    has: (_, k) => el.attrs.has("data-" + kebab(String(k))),
    deleteProperty: (_, k) => el.attrs.delete("data-" + kebab(String(k))),
    ownKeys: () => [...el.attrs.keys()].filter((k) => k.startsWith("data-")).map((k) => camel(k.slice(5))),
    getOwnPropertyDescriptor: (_, k) => el.attrs.has("data-" + kebab(String(k))) ? { value: el.attrs.get("data-" + kebab(String(k))), enumerable: true, configurable: true, writable: true } : undefined
  });
}
function mkClassList(el) {
  const list = () => el.className.split(/\s+/).filter(Boolean);
  const set = (a) => { el.className = a.join(" "); };
  return {
    add: (...ks) => { const a = list(); for (const k of ks) if (!a.includes(k)) a.push(k); set(a); },
    remove: (...ks) => set(list().filter((x) => !ks.includes(x))),
    contains: (k) => list().includes(k),
    toggle: (k, force) => { const has = list().includes(k); const want = force === undefined ? !has : !!force; if (want && !has) set([...list(), k]); if (!want && has) set(list().filter((x) => x !== k)); return want; },
    get length() { return list().length; }
  };
}
function walk(n, fn) { fn(n); for (const c of n.childNodes) walk(c, fn); }
function serialize(n) {
  if (n.nodeType === 3) return n._text;
  const a = [...n.attrs].map(([k, v]) => ` ${k}="${v}"`).join("");
  const t = n.tagName.toLowerCase();
  return `<${t}${a}>` + (VOID.has(t) ? "" : n.childNodes.map(serialize).join("") + `</${t}>`);
}

/*═══════════════════ selectors ═══════════════════*/

const selCache = new Map();
/// "a.b#c[d=e] > f, g" → [[{compound, comb}...], ...]; each chain is right-to-left
function parseSelector(sel) {
  if (selCache.has(sel)) return selCache.get(sel);
  const chains = sel.split(",").map((part) => {
    const tokens = []; let s = part.trim();
    while (s.length) {
      let comb = " ";
      const m = s.match(/^\s*(>)\s*|^\s+/);
      if (m) { if (m[1]) comb = ">"; s = s.slice(m[0].length); }
      const cm = s.match(/^(?:[\w-]+|\*)?(?:#[\w-]+|\.[\w-]+|\[[^\]]+\]|:not\([^)]*\)|:[\w-]+(?:\([^)]*\))?)*/);
      const text = cm[0]; if (!text) throw new Error("bad selector: " + sel);
      s = s.slice(text.length);
      tokens.push({ comb, c: parseCompound(text) });
    }
    return tokens.reverse();   // subject first
  });
  selCache.set(sel, chains); return chains;
}
function parseCompound(text) {
  const c = { tag: null, id: null, classes: [], attrs: [], nots: [], pseudos: [] };
  const tm = text.match(/^([\w-]+|\*)/); if (tm) { c.tag = tm[1] === "*" ? null : tm[1].toLowerCase(); text = text.slice(tm[0].length); }
  for (const m of text.matchAll(/#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([~|^$*]?=)"?([^"\]]*)"?)?\]|:not\(([^)]*)\)|:([\w-]+)(?:\(([^)]*)\))?/g)) {
    if (m[1]) c.id = m[1];
    else if (m[2]) c.classes.push(m[2]);
    else if (m[3]) c.attrs.push({ name: m[3].toLowerCase(), op: m[4] || null, value: m[5] });
    else if (m[6]) c.nots.push(parseSelector(m[6]));
    else if (m[7]) c.pseudos.push({ name: m[7], arg: m[8] });
  }
  return c;
}
function matchCompound(el, c) {
  if (c.tag && el.tagName.toLowerCase() !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  for (const k of c.classes) if (!el.classList.contains(k)) return false;
  for (const a of c.attrs) {
    if (!el.attrs.has(a.name)) return false;
    const v = el.attrs.get(a.name);
    if (a.op === "=" && v !== a.value) return false;
    if (a.op === "^=" && !v.startsWith(a.value)) return false;
    if (a.op === "$=" && !v.endsWith(a.value)) return false;
    if (a.op === "*=" && !v.includes(a.value)) return false;
    if (a.op === "~=" && !v.split(/\s+/).includes(a.value)) return false;
  }
  for (const n of c.nots) if (n.some((chain) => matchChain(el, chain))) return false;
  for (const p of c.pseudos) {
    if (p.name === "empty" && el.childNodes.length) return false;
    if (p.name === "first-child" && el.parentNode && el.parentNode.children[0] !== el) return false;
    if (p.name === "last-child" && el.parentNode && el.parentNode.children.at(-1) !== el) return false;
    if (p.name === "disabled" && !el.disabled) return false;
    if (p.name === "enabled" && el.disabled) return false;
    if (p.name === "checked" && !el.checked) return false;
  }
  return true;
}
function matchChain(el, chain) {
  if (!matchCompound(el, chain[0].c)) return false;
  let n = el;
  for (let i = 1; i < chain.length; i++) {
    const { c } = chain[i], comb = chain[i - 1].comb;
    if (comb === ">") { n = n.parentNode; if (!n || n.nodeType !== 1 || !matchCompound(n, c)) return false; }
    else { n = n.parentNode; while (n && n.nodeType === 1 && !matchCompound(n, c)) n = n.parentNode; if (!n || n.nodeType !== 1) return false; }
  }
  return true;
}

/*═══════════════════ the tokenizer ═══════════════════*/

/// Parse HTML into `root` (a document or fragment). Scripts are collected
/// in document order and returned; nothing is run here.
export function parse(html, doc, root) {
  const scripts = [];
  let i = 0, cur = root;
  const stack = [root];
  const text = (t) => { if (t) cur.childNodes.push(Object.assign(doc.createTextNode(t), { parentNode: cur })); };
  while (i < html.length) {
    if (html[i] !== "<") { const j = html.indexOf("<", i); const t = html.slice(i, j < 0 ? html.length : j); text(decodeEntities(t)); i = j < 0 ? html.length : j; continue; }
    if (html.startsWith("<!--", i)) { const j = html.indexOf("-->", i); i = j < 0 ? html.length : j + 3; continue; }
    if (html.startsWith("<!", i)) { const j = html.indexOf(">", i); i = j < 0 ? html.length : j + 1; continue; }
    if (html[i + 1] === "/") {
      const j = html.indexOf(">", i); const name = html.slice(i + 2, j).trim().toLowerCase(); i = j + 1;
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].tagName.toLowerCase() === name) { stack.length = k; break; }
      cur = stack[stack.length - 1]; continue;
    }
    // an open tag
    const m = html.slice(i).match(/^<([a-zA-Z][\w:-]*)/); if (!m) { text("<"); i++; continue; }
    const name = m[1].toLowerCase(); let j = i + m[0].length;
    const el = doc.createElement(name);
    // attributes
    for (;;) {
      const ws = html.slice(j).match(/^\s+/); if (ws) j += ws[0].length;
      if (html[j] === ">") { j++; break; }
      if (html.startsWith("/>", j)) { j += 2; break; }
      const am = html.slice(j).match(/^([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/);
      if (!am) { j++; continue; }
      el.attrs.set(am[1].toLowerCase(), decodeEntities(am[2] ?? am[3] ?? am[4] ?? ""));
      j += am[0].length;
    }
    i = j;
    // where does it go
    if (name === "html" && root.nodeType === 9) { root._html = el; }
    el.parentNode = cur; cur.childNodes.push(el);
    if (name === "script" || name === "style") {
      const end = html.toLowerCase().indexOf("</" + name, i);
      const raw = html.slice(i, end < 0 ? html.length : end);
      el.childNodes.push(Object.assign(doc.createTextNode(raw), { parentNode: el }));
      i = end < 0 ? html.length : html.indexOf(">", end) + 1;
      if (name === "script") scripts.push(el);
      continue;
    }
    if (VOID.has(name)) continue;
    stack.push(el); cur = el;
  }
  return scripts;
}
function decodeEntities(t) {
  return t.includes("&") ? t.replace(/&(amp|lt|gt|quot|#39|apos|#x27);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", "#x27": "'" }[e])) : t;
}

/*═══════════════════ the document ═══════════════════*/

function mkDocument(page) {
  const doc = new Node(null, 9, "#document", null);
  doc.ownerDocument = doc;
  doc._page = page;
  doc.readyState = "loading";
  doc.activeElement = null;
  doc.hidden = false;
  doc.cookie = "";
  doc.currentScript = null;
  doc.createElement = (tag) => new Node(doc, 1, String(tag).toUpperCase(), "http://www.w3.org/1999/xhtml");
  doc.createElementNS = (ns, tag) => new Node(doc, 1, String(tag), ns);
  doc.createTextNode = (t) => Object.assign(new Node(doc, 3, "#text", null), { _text: String(t) });
  doc.createDocumentFragment = () => new Node(doc, 11, "#fragment", null);
  doc.createEvent = () => { throw new Error("createEvent is not in the shim; use new Event"); };
  doc.getElementById = (id) => { let out = null; walk(doc, (n) => { if (!out && n.nodeType === 1 && n.id === id) out = n; }); return out; };
  Object.defineProperty(doc, "documentElement", { get: () => doc.children.find((c) => c.tagName === "HTML") || null });
  Object.defineProperty(doc, "head", { get: () => doc.documentElement?.children.find((c) => c.tagName === "HEAD") || null });
  Object.defineProperty(doc, "body", { get: () => doc.documentElement?.children.find((c) => c.tagName === "BODY") || null });
  Object.defineProperty(doc, "title", { get: () => doc.head?.querySelector("title")?.textContent || "", set(v) { const t = doc.head?.querySelector("title"); if (t) t.textContent = v; } });
  /*  A script that lands in the tree with a src runs — only a blob: one,
      because the CSP has no network script source; anything else is
      recorded and refused. The text is run in the page's own context, so
      the panel's IIFE sees the same window the shell does.             */
  doc._mounted = (n) => {
    if (n.nodeType !== 1 || n.tagName !== "SCRIPT" || !n.isConnected || n._ran) return;
    const src = n.getAttribute("src"); if (!src) return;
    n._ran = true;
    if (!src.startsWith("blob:")) { page.appended.push({ src, refused: true }); page.errors.push(new Error("a script src that is not blob: was refused: " + src)); queueMicrotask(() => n.dispatchEvent(new page.ctx.Event("error"))); return; }
    const blob = resolveObjectURL(src);
    const run = async () => {
      try {
        const text = await blob.text();
        const rec = { src, type: blob.type, text, hash: kec(Buffer.from(text, "utf8")) };
        page.appended.push(rec);
        const r = vm.runInContext(text, page.ctx, { filename: "blob:" + (page.appended.length - 1) });
        if (r && typeof r.then === "function") await r;
        n.dispatchEvent(new page.ctx.Event("load"));
      } catch (e) { page.errors.push(e); n.dispatchEvent(new page.ctx.Event("error")); }
    };
    page.pending.push(run());
  };
  /*  document.open/write/close — the loader's three calls. open() empties
      the tree and keeps the Window's PROPERTIES (the browser fact
      src/Renderer.sol relies on for INTACT and window.ethereum) but ERASES
      every event listener on the window and on every node (HTML "document
      open steps" 9–10; measured in Chromium 141) — which is why a wallet's
      eip6963:requestProvider listener is gone by the time the inflated
      shell runs, and why the loader captures the announcements before it
      opens. A shim that kept the listeners made N1–N6 green for behaviour
      no browser has. write() buffers; close() parses, mounts, runs the
      scripts in order, then fires DOMContentLoaded and load.           */
  let buffer = null;
  doc.open = () => {
    walk(doc, (n) => { n._ls = new Map(); });
    page.win._ls = new Map();
    for (const c of doc.childNodes) c.parentNode = null; doc.childNodes = []; buffer = ""; doc.readyState = "loading"; return doc;
  };
  doc.write = (t) => { if (buffer === null) buffer = ""; buffer += String(t); page.written = (page.written || "") + String(t); };
  doc.writeln = (t) => doc.write(String(t) + "\n");
  doc.close = () => {
    if (buffer === null) return;
    const html = buffer; buffer = null;
    page.closes++;
    page.$docAtClose = page.ctx.INTACT ? page.ctx.INTACT.$doc : undefined;
    page._mount(html, "shell");
  };
  return doc;
}

/*═══════════════════ the window and the page ═══════════════════*/

const PAGES = new Set();
process.on("unhandledRejection", (e) => { for (const p of PAGES) p.errors.push(e instanceof Error ? e : new Error(String(e))); });

/**
 * Boot a served document in a fresh vm context.
 *   boot(html, { wallets: [W…] | provider: W, opaque, url, query, hash, GET, tamper, awaitReady })
 * Resolves to the page once INTACT.ui.ready has settled (unless awaitReady: false).
 */
export async function boot(html, opts = {}) {
  const page = {
    errors: [], fetches: [], appended: [], navigations: [], pending: [],
    innerHTMLWrites: 0, written: "", closes: 0, opaque: !!opts.opaque,
    scripts: [], consoleLog: []
  };
  PAGES.add(page);
  const url = opts.url || (opts.opaque ? "about:blank" : "/token/1/live");
  const u = opts.opaque ? { origin: "null", protocol: "about:", host: "", hostname: "", pathname: "", search: "", hash: "" }
    : Object.assign(new URL(url, "http://localhost"), {});
  if (!opts.opaque) { u.search = opts.query || ""; u.hash = opts.hash || ""; }
  const win = new Node(null, 1, "#window", null);   // an EventTarget with the bubbling machinery
  win.ownerDocument = { _page: page };
  page.win = win;

  /*── the sandbox: Node's own platform objects, a clock pinned to the chain ──*/
  const timers = new Set();
  const PinnedDate = class extends Date { static now() { return Number(EVM.BLOCK.header.timestamp) * 1000; } };
  const ctx = vm.createContext({
    Blob, URL, URLSearchParams, Response, Request, Headers, DecompressionStream, CompressionStream, TextEncoder, TextDecoder,
    atob, btoa, crypto, Event, CustomEvent, EventTarget, structuredClone, queueMicrotask, DOMException, AbortController,
    Date: PinnedDate, performance: { now: () => Number(EVM.BLOCK.header.timestamp) * 1000 },
    console: { log: (...a) => page.consoleLog.push(a.join(" ")), warn: (...a) => page.consoleLog.push(a.join(" ")), error: (...a) => page.errors.push(new Error("console.error: " + a.map(String).join(" "))), info() {}, debug() {} },
    setTimeout: (f, ms, ...a) => { const id = setTimeout(() => { timers.delete(id); try { f(...a); } catch (e) { page.errors.push(e); } }, Math.min(Number(ms) || 0, 2)); timers.add(id); return id; },
    clearTimeout: (id) => { clearTimeout(id); timers.delete(id); },
    setInterval: (f, ms, ...a) => setInterval(() => { try { f(...a); } catch (e) { page.errors.push(e); } }, Math.max(1, Math.min(Number(ms) || 0, 2))),
    clearInterval,
    requestAnimationFrame: (f) => setTimeout(() => f(PinnedDate.now()), 0),
    cancelAnimationFrame: clearTimeout,
    requestIdleCallback: (f) => setTimeout(() => f({ timeRemaining: () => 50, didTimeout: false }), 0),
    navigator: { userAgent: "intact-shim", language: "en", clipboard: { writeText: async (t) => { page.clipboard = t; } }, onLine: true },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    alert: (m) => page.errors.push(new Error("alert: " + m)), confirm: () => false, prompt: () => null,
    scrollTo() {}, scroll() {}, open: () => null
  });
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.top = ctx; ctx.parent = ctx; ctx.frames = ctx;
  page.ctx = ctx;
  /* the window as an EventTarget */
  ctx.addEventListener = (t, f, o) => win.addEventListener(t, f, o);
  ctx.removeEventListener = (t, f) => win.removeEventListener(t, f);
  ctx.dispatchEvent = (ev) => { Object.defineProperty(ev, "target", { value: ctx, configurable: true }); win._invoke(ev); return !ev.defaultPrevented; };
  /* storage */
  if (opts.opaque) {
    ctx.__storageReads = 0;
    Object.defineProperty(ctx, "localStorage", { get() { ctx.__storageReads++; throw new DOMException("The operation is insecure.", "SecurityError"); }, configurable: true });
    Object.defineProperty(ctx, "sessionStorage", { get() { ctx.__storageReads++; throw new DOMException("The operation is insecure.", "SecurityError"); }, configurable: true });
  } else {
    const mk = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(String(k), String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, _map: m }; };
    ctx.localStorage = mk(); ctx.sessionStorage = mk();
  }
  /* location and history */
  const loc = {
    get href() { return opts.opaque ? "about:blank" : u.origin + u.pathname + u.search + u.hash; },
    set href(v) { page.navigations.push(String(v)); },
    get origin() { return u.origin; }, get protocol() { return u.protocol; }, get host() { return u.host; }, get hostname() { return u.hostname; },
    get pathname() { return u.pathname; }, get search() { return u.search; },
    get hash() { return u.hash; },
    set hash(v) { v = String(v); if (v && !v.startsWith("#")) v = "#" + v; if (v === u.hash) return; u.hash = v; ctx.dispatchEvent(new Event("hashchange")); },
    assign: (v) => { page.navigations.push(String(v)); }, replace: (v) => { page.navigations.push(String(v)); }, reload() {}, toString() { return this.href; }
  };
  ctx.location = loc;
  ctx.history = { pushState: (s, t, url) => { if (url) { const n = new URL(url, "http://localhost"); u.pathname = n.pathname; u.search = n.search; u.hash = n.hash; } }, replaceState: (s, t, url) => ctx.history.pushState(s, t, url), back() {}, state: null, length: 1 };
  /* fetch */
  const GET = opts.GET;
  ctx.fetch = async (input, init) => {
    const url = String(input && input.url || input);
    page.fetches.push({ url, init });
    if (opts.opaque) throw new TypeError("Failed to fetch");
    if (!GET) throw new TypeError("Failed to fetch (no GET bound)");
    const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/0x[0-9a-fA-F]{40}:\d+(?=\/|$)/, "").split(/[?#]/)[0];
    const seg = path.split("/").filter(Boolean).map(decodeURIComponent);
    const tf = page.tamperFetches.get(path);
    const r = await GET(seg);
    let bytes = r.bodyBytes;
    if (r.header("Content-Encoding") === "gzip") { try { bytes = zlib.gunzipSync(bytes); } catch { /* a browser would fail the body too */ } }
    const headers = Object.fromEntries(r.headers.map(([k, v]) => [k, v]));
    delete headers["Content-Encoding"];
    const pm = path.match(/^\/panel\/(\w+)\.js$/);
    if (pm && page.tamperPanels.has(pm[1])) { const t = page.tamperPanels.get(pm[1]); bytes = Buffer.from(t.fn(Buffer.from(bytes))); if (t.forgeETag) headers.ETag = `"${(ctx.INTACT && ctx.INTACT.panels && ctx.INTACT.panels[pm[1]]) || ""}"`; }
    if (tf) bytes = Buffer.from(tf(Buffer.from(bytes)));
    return new Response(r.status === 204 ? null : new Uint8Array(bytes), { status: r.status, headers });
  };
  page.tamperPanels = new Map(); page.tamperFetches = new Map();
  page.tamperPanel = (name, fn, o = {}) => page.tamperPanels.set(name, { fn, forgeETag: !!o.forgeETag });
  page.tamperFetch = (path, fn) => page.tamperFetches.set(path, fn);
  /* the document */
  const doc = mkDocument(page);
  ctx.document = doc;
  /* mount: parse, attach, run the scripts in order */
  page._mount = (src, label) => {
    const scripts = parse(src, doc, doc);
    if (!doc.documentElement) {           // a bare fragment: wrap it the way a browser would
      const h = doc.createElement("html"), hd = doc.createElement("head"), b = doc.createElement("body");
      for (const c of [...doc.childNodes]) { doc.removeChild(c); (c.tagName === "HEAD" || c.tagName === "TITLE" || c.tagName === "META" || c.tagName === "LINK" || c.tagName === "STYLE" ? hd : b).appendChild(c); }
      h.append(hd, b); doc.appendChild(h);
    } else {
      const he = doc.documentElement;
      if (!doc.head) he.insertBefore(doc.createElement("head"), he.firstChild);
      if (!doc.body) he.appendChild(doc.createElement("body"));
      // text and elements written directly under <html> after </head> belong to the body
      for (const c of [...he.childNodes]) if (c.tagName !== "HEAD" && c.tagName !== "BODY") { he.removeChild(c); doc.body.appendChild(c); }
    }
    doc.readyState = "interactive";
    let i = 0;
    for (const s of scripts) {
      if (s.getAttribute("type") && !/javascript|module/.test(s.getAttribute("type"))) continue;
      if (s.getAttribute("src")) { doc._mounted(s); continue; }
      const text = s.textContent;
      const name = `${label}#${i++}`;
      page.scripts.push(name);
      try {
        const r = vm.runInContext(text, ctx, { filename: name });
        if (r && typeof r.then === "function") page.pending.push(r.catch((e) => page.errors.push(e)));
      } catch (e) { page.errors.push(e); }
      if (label === "served" && i === 1) page.sentinel = ctx.INTACT ? (ctx.INTACT.__pin = 1) : 0;
    }
    doc.readyState = "complete";
    doc.dispatchEvent(new Event("DOMContentLoaded"));
    ctx.dispatchEvent(new Event("load"));
  };
  /*── drivers ──*/
  page.$ = (sel) => doc.querySelector(sel);
  page.$$ = (sel) => doc.querySelectorAll(sel);
  page.settle = async () => {
    for (let k = 0; k < 4; k++) { await new Promise((r) => setImmediate(r)); const p = page.pending.splice(0); if (p.length) await Promise.allSettled(p); }
    await nap(8);
    for (let k = 0; k < 3; k++) await new Promise((r) => setImmediate(r));
  };
  page.until = async (cond, tries = 200) => { for (let k = 0; k < tries; k++) { if (cond()) return true; await page.settle(); } return cond(); };
  page.click = (el) => { if (!el) throw new Error("click: no element"); return el.click(); };
  page.type = (el, v) => { if (!el) throw new Error("type: no element"); el.value = v; el.dispatchEvent(new ctx.Event("input", { bubbles: true })); el.dispatchEvent(new ctx.Event("change", { bubbles: true })); };
  page.hash = (h) => { loc.hash = h; };
  page.text = (sel) => (doc.querySelector(sel) || { textContent: "" }).textContent;
  page.close = () => { PAGES.delete(page); for (const id of timers) clearTimeout(id); };
  /* the wallets: attached before the served document runs, so the shell's
     requestProvider finds them */
  const wallets = opts.wallets || (opts.provider ? [opts.provider] : []);
  for (const w of wallets) w.attach(ctx, page);
  /*── the served document runs: prologue, state, payload, loader ──*/
  page._mount(html, "served");
  await page.settle();
  if (opts.awaitReady !== false) {
    const t0 = Date.now();
    while (!(ctx.INTACT && ctx.INTACT.ui && ctx.INTACT.ui.ready)) { if (Date.now() - t0 > 5000) throw new Error("the shell never exposed INTACT.ui.ready (errors: " + page.errors.map((e) => e.message).join("; ") + ")"); await page.settle(); }
    await Promise.race([ctx.INTACT.ui.ready, nap(5000).then(() => { throw new Error("INTACT.ui.ready did not settle in 5 s"); })]);
    await page.settle();
  }
  return page;
}

export const click = (page, sel) => page.click(typeof sel === "string" ? page.$(sel) : sel);
export const fill = (page, sel, v) => page.type(typeof sel === "string" ? page.$(sel) : sel, v);
export const textOf = (page, sel) => page.text(sel);
export const prompts = (W) => W.prompts();

/*═══════════════════ the wallet ═══════════════════*/

/* every method a wallet would put a prompt in front of — counted in W.prompts() whether the
   shim answers it or refuses it as unexpected, so a page that reaches for one is seen */
const PROMPTING = new Set(["eth_requestAccounts", "eth_sendTransaction", "eth_signTransaction", "eth_sendRawTransaction", "personal_sign", "eth_sign",
                           "eth_signTypedData", "eth_signTypedData_v3", "eth_signTypedData_v4", "eth_decrypt", "eth_getEncryptionPublicKey",
                           "wallet_switchEthereumChain", "wallet_addEthereumChain", "wallet_requestPermissions", "wallet_grantPermissions", "wallet_watchAsset", "wallet_sendCalls"]);
const hexN = (n) => "0x" + BigInt(n).toString(16);

/**
 * An EIP-1193 provider over the in-process chain, announced over EIP-6963.
 *   walletFor(chain, actor, { rdns, name, icon, legacy, noAnnounce, connected, chainId, accounts, knownChains })
 * `actor` is the Chain whose key signs (c or c.as(...)); `accounts` defaults to [actor.from].
 * `connected: false` models a site the wallet has not been connected to: eth_accounts answers []
 * until the first eth_requestAccounts. `legacy` also installs window.ethereum; `noAnnounce` makes
 * it a legacy-only provider that never announces over EIP-6963.
 */
export function walletFor(chain, actor, opts = {}) {
  const c = chain, me = actor.from.toString();
  let chainId = opts.chainId ?? Number(c.common ? c.common.chainId() : 1);
  let accounts = opts.accounts ?? [me];
  let connected = opts.connected !== false;
  const knownChains = new Set(opts.knownChains || [1, 10, 8453, 84532, 11155111, 31337, chainId]);
  const listeners = new Map();
  const W = { calls: [], promptsLog: [], receipts: new Map(), filtersLog: [], answers: new Map(), overrides: new Map(), info: null, provider: null, actor, address: me };
  let seq = Promise.resolve();
  const calldataGas = (d) => { let g = 0n; for (const b of Buffer.from(String(d).replace(/^0x/, ""), "hex")) g += b === 0 ? 4n : 16n; return g; };
  const revert = (data) => Object.assign(new Error("execution reverted"), { code: 3, data });
  const toLog = (l, n, hash, i) => ({ address: hex(l[0]), topics: l[1].map(hex), data: hex(l[2]), blockNumber: hexN(n), logIndex: hexN(i), transactionHash: hash, transactionIndex: "0x0", removed: false });

  async function answer(method, params = []) {
    const p = params[0] || {};
    if (W.overrides.has(method)) return W.overrides.get(method)(params);
    switch (method) {
      case "eth_chainId": return hexN(chainId);
      case "net_version": return String(chainId);
      case "eth_accounts": return connected ? accounts.slice() : [];
      case "eth_requestAccounts": connected = true; return accounts.slice();
      case "eth_call": {
        const to = String(p.to || "").toLowerCase(), data = String(p.data || "0x");
        const a = W.answers.get(to + data.slice(0, 10).toLowerCase());
        if (a) return a(data, p);
        const r = await c.simulate(p.to, data, { from: p.from || me, value: p.value ? BigInt(p.value) : 0n });
        if (!r.ok) throw revert(r.data);
        return r.data;
      }
      case "eth_estimateGas": {
        const r = await c.simulate(p.to, String(p.data || "0x"), { from: p.from || me, value: p.value ? BigInt(p.value) : 0n });
        if (!r.ok) throw revert(r.data);
        return hexN(r.gas + 21000n + calldataGas(p.data || "0x") + 1000n);
      }
      case "eth_sendTransaction": {
        if (!accounts.map((x) => x.toLowerCase()).includes(String(p.from || me).toLowerCase())) throw Object.assign(new Error("unknown account"), { code: 4100 });
        /* the shim holds one key — the actor's. A `from` that setAccounts named but the actor
           does not own would be signed by the wrong key and land as the wrong sender; it is
           refused, so a group that "connects as" another actor and sends sees the refusal
           rather than a receipt it did not mean */
        if (String(p.from || me).toLowerCase() !== me.toLowerCase()) throw Object.assign(new Error("the shim signs only as its actor " + me + "; make a wallet for " + p.from), { code: 4100 });
        const n = EVM.BLOCK.header.number;
        let hash, receipt;
        try {
          const r = await actor.send({ to: p.to, data: p.data || "0x", value: p.value ? BigInt(p.value) : 0n, label: "wallet", allowOverCap: true });
          hash = r.hash;
          receipt = { transactionHash: hash, status: "0x1", blockNumber: hexN(n), gasUsed: hexN(r.gas), from: me, to: p.to, logs: r.logs.map((l, i) => toLog(l, n, hash, i)), contractAddress: r.address };
        } catch (e) {
          /* a reverted send is a receipt with status 0x0, never a throw */
          hash = kec(Buffer.from(String(p.data || "") + me + String(W.calls.length) + Date.now(), "utf8"));
          receipt = { transactionHash: hash, status: "0x0", blockNumber: hexN(n), gasUsed: "0x5208", from: me, to: p.to, logs: [], revert: String(e.message) };
        }
        W.receipts.set(hash, receipt);
        EVM.roll(n + 1n);
        return hash;
      }
      case "eth_getTransactionReceipt": return W.receipts.get(params[0]) || null;
      case "eth_getTransactionByHash": return W.receipts.has(params[0]) ? { hash: params[0], blockNumber: W.receipts.get(params[0]).blockNumber } : null;
      case "eth_getBlockByNumber": case "eth_getBlockByHash": {
        const h = EVM.BLOCK.header;
        return { number: hexN(h.number), timestamp: hexN(h.timestamp), hash: hex(EVM.BLOCK.hash()), parentHash: hex(h.parentHash), gasLimit: hexN(h.gasLimit), baseFeePerGas: hexN(h.baseFeePerGas || 0n), transactions: [] };
      }
      case "eth_blockNumber": return hexN(EVM.BLOCK.header.number);
      case "eth_gasPrice": return "0xa";
      case "eth_maxPriorityFeePerGas": return "0x1";
      case "eth_getBalance": return hexN(await c.balanceOf(params[0]));
      case "eth_getTransactionCount": { const a = await c.vm.stateManager.getAccount(createAddressFromString(params[0])); return hexN(a ? a.nonce : 0n); }
      case "eth_getCode": { const code = await c.vm.stateManager.getCode(createAddressFromString(params[0])); return hex(code || new Uint8Array()); }
      case "eth_getLogs": { W.filtersLog.push(params[0]); return c.getLogs(params[0] || {}); }
      case "personal_sign": {
        const [m, addr] = params;
        const msg = /^0x[0-9a-fA-F]*$/.test(String(m)) ? Buffer.from(String(m).slice(2), "hex") : Buffer.from(String(m), "utf8");
        const prefixed = Buffer.concat([Buffer.from("\x19Ethereum Signed Message:\n" + msg.length, "utf8"), msg]);
        const sig = secp256k1.sign(keccak256(prefixed), actor.key);
        W.promptsLog[W.promptsLog.length - 1].message = msg.toString("utf8");
        W.promptsLog[W.promptsLog.length - 1].address = addr;
        return hex(Buffer.concat([Buffer.from(sig.toCompactRawBytes()), Buffer.from([27 + sig.recovery])]));
      }
      case "wallet_switchEthereumChain": {
        const want = Number(p.chainId);
        if (!knownChains.has(want)) throw Object.assign(new Error("Unrecognized chain ID"), { code: 4902 });
        W.setChain(want); return null;
      }
      case "wallet_addEthereumChain": throw Object.assign(new Error("the shim refuses wallet_addEthereumChain: it carries RPC URLs and no document of this project names one"), { code: 4200 });
      case "wallet_requestPermissions": return [{ parentCapability: "eth_accounts" }];
      case "wallet_getPermissions": return [{ parentCapability: "eth_accounts" }];
      default: throw new Error("unexpected method " + method);
    }
  }
  const provider = {
    isMetaMask: false, isIntactShim: true,
    request: ({ method, params }) => {
      /* one request at a time: two interleaved runCalls corrupt each other's checkpoints.
         This serialisation also HIDES one race a real provider has: a read sent while an
         eth_chainId is pending waits here, where a browser wallet would answer it from the
         new chain at once — so the chain gate is asserted on the event (the N block holds
         eth_chainId open and reads), never on the queue */
      const run = async () => {
        const rec = { method, params, frame: new Error().stack.split("\n").find((l) => /shell#|blob:|served#/.test(l)) || "" };
        W.calls.push(rec);
        if (PROMPTING.has(method)) W.promptsLog.push({ method, params, frame: rec.frame });
        return answer(method, params);
      };
      const r = seq.then(run, run);
      seq = r.then(() => {}, () => {});
      return r;
    },
    on: (ev, fn) => { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(fn); return provider; },
    removeListener: (ev, fn) => { listeners.set(ev, (listeners.get(ev) || []).filter((f) => f !== fn)); return provider; },
    emit: (ev, arg) => { for (const f of listeners.get(ev) || []) try { f(arg); } catch (e) { W.page?.errors.push(e); } }
  };
  W.provider = provider;
  W.info = { uuid: opts.uuid || ("uuid-" + Math.random().toString(16).slice(2)), name: opts.name || "Shim Wallet", icon: opts.icon || "data:image/svg+xml;base64,PHN2Zy8+", rdns: opts.rdns || "io.intact.shim" };
  W.emit = (ev, arg) => provider.emit(ev, arg);
  W.setChain = (id) => { chainId = Number(id); provider.emit("chainChanged", hexN(chainId)); };
  W.setAccounts = (list) => { accounts = list.slice(); provider.emit("accountsChanged", accounts.slice()); };
  W.prompts = () => W.promptsLog.slice();
  W.sent = () => W.calls.filter((x) => x.method === "eth_sendTransaction").length;
  W.count = (method) => W.calls.filter((x) => x.method === method).length;
  W.firstIndex = (method) => W.calls.findIndex((x) => x.method === method);
  W.lastIndex = (method) => { for (let i = W.calls.length - 1; i >= 0; i--) if (W.calls[i].method === method) return i; return -1; };
  W.filters = () => W.filtersLog.slice();
  W.callsTo = (to, selector) => W.calls.filter((x) => x.method === "eth_call" && String(x.params[0].to).toLowerCase() === String(to).toLowerCase() && (!selector || String(x.params[0].data).toLowerCase().startsWith(selector.toLowerCase())));
  W.answer = (to, selector, fn) => { const k = String(to).toLowerCase() + selector.toLowerCase(); fn ? W.answers.set(k, fn) : W.answers.delete(k); };
  W.override = (method, fn) => { fn ? W.overrides.set(method, fn) : W.overrides.delete(method); };
  W.refuse = (method, err) => W.override(method, () => { throw err; });
  W.attach = (ctx, page) => {
    W.page = page;
    const detail = Object.freeze({ info: W.info, provider });
    const announce = () => ctx.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
    if (opts.legacy) ctx.ethereum = provider;
    if (opts.noAnnounce) return;
    ctx.addEventListener("eip6963:requestProvider", announce);
    announce();
    W.announce = announce;
  };
  return W;
}
