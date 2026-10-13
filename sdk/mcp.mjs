#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the MCP bridge — services.json as a tool catalogue nothing can
  change under you

  Origin: DESIGN.md §10 ("the MCP bridge in sdk/ refuses a catalog whose
  hash differs"; "propose and act are separate tools; sessionAllows is
  checked as a view before any send"; "MCP bridges never pass wallet tokens
  or session keys through"), docs/AGENT.md §1–§2 and §6, INVARIANTS G2.
  The shape is MCP's (JSON-RPC 2.0 over stdio: initialize, tools/list,
  tools/call), written here with Node's built-ins and nothing else, because
  a bridge that pulled a client library would be a bridge whose tool
  descriptions could change with a dependency.

  ── the one rule ──

  Every tool below is DERIVED from /services.json, read from the chain
  (Catalog.services()) and held against Catalog.catalogHash() on every
  listing and every call: keccak256 of the bytes served must equal the hash
  the chain pins, and, when the host names the hash it reviewed, that one
  too. A catalogue whose hash drifted is refused — the whole bridge refuses,
  not one tool — which closes the class of CVE-2025-54136 (an approved tool
  definition that changes after approval) by construction: the catalogue is
  a pure function of the deployment, and its hash is in contractURI, the
  state block and /manifest.

  ── what crosses the bridge, and what never does ──

      in    tokenId, a row name (word.name as services.json spells it), the
            arguments as strings, a value in wei, a target for a per-asset row
      out   calldata, the grant's answer, a simulation's verdict, a hash
      never a private key, a session key, a signature, a wallet token. The
            HOST constructs the bridge with a `signer` — {address, send(tx)}
            — that signs on the host's own machine; the bridge reads the
            address (public) to ask sessionAllows and hands `send` one
            transaction. A tool argument named like a secret is refused
            before anything is read.

  ── propose, then act ──

      propose   a READ: Reach.sessionAllows(key, target, selector), then a
                dry eth_call of the very executeAsSession(target, value,
                data) from the key. Nothing is sent. The answer says allowed
                or not, and whether the call would land or revert, by the
                error's name from the catalogue's own table.
      act       exactly one executeAsSession, sent through the host's signer,
                only after propose said allowed and the simulation landed.
                A refusal is a sentence; a send is a hash.

  Amounts are BigInt end to end (wei as decimal strings on the wire); an
  approval of 2^255 or more is never built; a deadline comes from the
  chain's clock (the `intact_clock` tool), never from Date.now(); no RPC is
  named here — the host brings its own.

    node sdk/mcp.mjs                      stdio, configured by the environment:
      INTACT_RPC_URL        the JSON-RPC endpoint the host chose
      INTACT_CATALOG        the band's Catalog (deployments/<chainId>.json)
      INTACT_PINNED_HASH    optional: the catalogHash the host reviewed
      INTACT_SIGNER         optional: a module exporting {address, send(tx)}
───────────────────────────────────────────────────────────────────────────*/
import { createInterface } from "node:readline";
import { keccak256 } from "ethereum-cryptography/keccak.js";

export const VERSION = "0.1.0";
export const PROTOCOL = "2025-06-18";
export const SERVER = { name: "intact-mcp", version: VERSION };
export const DRIFT = "the catalogue's hash drifted: refused";

/*═══════════════════ bytes, hashes, selectors ═══════════════════*/

const hex = (u) => "0x" + Buffer.from(u).toString("hex");
export const kec = (b) => hex(keccak256(Buffer.isBuffer(b) || b instanceof Uint8Array ? b : Buffer.from(String(b), "utf8")));
export const selector = (sig) => kec(sig).slice(0, 10);
const lower = (s) => String(s).toLowerCase();
export const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || ""));
const pad = (h) => String(h).replace(/^0x/, "").padStart(64, "0");
const padR = (h) => String(h).replace(/^0x/, "").padEnd(64, "0");

/*═══════════════════ the ABI coder: static types, bytes, string, arrays, tuples ═══════════════════*/

const split = (s) => { const o = []; let d = 0, c = ""; for (const ch of s) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && !d) { o.push(c); c = ""; } else c += ch; } if (c) o.push(c); return o; };
const inner = (t) => split(t.slice(1, t.lastIndexOf(")")));
const arr = (t) => t.match(/^(.*)\[(\d*)\]$/);
const isDyn = (t) => { const m = arr(t); return m ? !m[2] || isDyn(m[1]) : t === "bytes" || t === "string" || (t[0] === "(" && inner(t).some(isDyn)); };
const bigint = (v, t) => { const s = String(v).trim(); if (!/^-?\d+$/.test(s)) throw new Error(`${t}: a whole number, got "${s}"`); let n = BigInt(s); if (n < 0n) n = (1n << 256n) + n; return n; };

function encWord(t, v) {
  if (t === "address") { if (!isAddr(v)) throw new Error(`address: got "${v}"`); return pad(lower(v).slice(2)); }
  if (t === "bool") return pad(v === true || v === "true" || v === 1 || v === "1" ? "1" : "0");
  if (/^u?int\d*$/.test(t)) return pad(bigint(v, t).toString(16));
  if (/^bytes([1-9]|[12]\d|3[0-2])$/.test(t)) { if (!/^0x[0-9a-fA-F]*$/.test(String(v))) throw new Error(`${t}: hex, got "${v}"`); return padR(String(v)); }
  throw new Error("unsupported type " + t);
}
function encValue(t, v) {
  const m = arr(t);
  if (m) {
    const list = Array.isArray(v) ? v : String(v).split(",").map((s) => s.trim()).filter(Boolean);
    if (m[2] && list.length !== Number(m[2])) throw new Error(`${t}: ${m[2]} elements`);
    const body = encSeq(Array(list.length).fill(m[1]), list);
    return m[2] ? body : pad(list.length.toString(16)) + body;
  }
  if (t[0] === "(") { const ts = inner(t); const vals = Array.isArray(v) ? v : JSON.parse(String(v)); if (vals.length !== ts.length) throw new Error(`${t}: ${ts.length} fields`); return encSeq(ts, vals); }
  if (t === "string" || t === "bytes") {
    const b = t === "string" ? Buffer.from(String(v), "utf8") : Buffer.from(String(v).replace(/^0x/, ""), "hex");
    if (t === "bytes" && !/^0x([0-9a-fA-F]{2})*$/.test(String(v))) throw new Error(`bytes: hex, got "${String(v).slice(0, 20)}"`);
    let body = ""; for (let i = 0; i < b.length; i += 32) body += b.subarray(i, i + 32).toString("hex").padEnd(64, "0");
    return pad(b.length.toString(16)) + body;
  }
  return encWord(t, v);
}
const staticSize = (t) => { const m = arr(t); return m ? Number(m[2]) * staticSize(m[1]) : t[0] === "(" ? inner(t).reduce((n, x) => n + staticSize(x), 0) : 32; };
function encSeq(types, values) {
  let head = "", tail = "";
  const headLen = types.reduce((n, t) => n + (isDyn(t) ? 32 : staticSize(t)), 0);
  types.forEach((t, i) => { const e = encValue(t, values[i]); if (isDyn(t)) { head += pad((headLen + tail.length / 2).toString(16)); tail += e; } else head += e; });
  return head + tail;
}
export const encodeParams = (types, values) => { if (types.length !== values.length) throw new Error(`${types.length} argument(s) expected, ${values.length} given`); return encSeq(types, values); };
export const encodeCall = (sig, args) => selector(sig) + encodeParams(split(sig.slice(sig.indexOf("(") + 1, sig.lastIndexOf(")"))), args);
/* the read side: one word, a dynamic bytes, a sequence of words */
const W = (h, i) => BigInt("0x" + (String(h).replace(/^0x/, "").substr(i * 64, 64) || "0"));
const decBytes = (h) => { h = String(h).replace(/^0x/, ""); const off = Number(W(h, 0)) * 2, len = Number(BigInt("0x" + h.substr(off, 64))); return Buffer.from(h.substr(off + 64, len * 2), "hex"); };
const words = (h) => (String(h).replace(/^0x/, "").match(/.{64}/g) || []).map((w) => "0x" + w);

/*═══════════════════ the catalogue, held to its hash ═══════════════════*/

const SIGS = {
  services: "services()", catalogHash: "catalogHash()", account: "account(uint256)", custodyEpoch: "custodyEpoch(uint256)",
  statusOf: "statusOf(uint256)", allows: "sessionAllows(address,address,bytes4)", eas: "executeAsSession(address,uint256,bytes)"
};
const APPROVE = selector("approve(address,uint256)"), INCREASE = selector("increaseAllowance(address,uint256)");
/// an argument named like a secret — a key, a mnemonic, a signature, a wallet or bearer token; `tokenId` is a token's number
const SECRET = (k) => /key|secret|private|mnemonic|signature|password|seed/i.test(k) || (/token/i.test(k) && !/^tokenid$/i.test(k));
const toolName = (kind, row) => `${kind}_${row.replace(/\./g, "_")}`;

export class Bridge {
  /**
   * @param {{ rpc: (method: string, params: any[]) => Promise<any>, catalog: string, signer?: { address: string, send: (tx: object) => Promise<string> }, pinnedHash?: string }} o
   * `rpc` is the host's transport; `signer` the host's, never a key; `pinnedHash` the catalogHash the host reviewed.
   */
  constructor(o) {
    if (!o || typeof o.rpc !== "function") throw new Error("a bridge needs the host's rpc(method, params)");
    if (!isAddr(o.catalog)) throw new Error("a bridge needs the band's Catalog address");
    if (o.signer && (!isAddr(o.signer.address) || typeof o.signer.send !== "function")) throw new Error("a signer is {address, send(tx)} — the key stays on the host's machine");
    for (const k of Object.keys(o)) if (k !== "signer" && k !== "pinnedHash" && SECRET(k)) throw new Error("the bridge takes no " + k + ": it never holds a key");
    this.rpc = o.rpc; this.catalog = lower(o.catalog); this.signer = o.signer || null; this.pinnedHash = o.pinnedHash ? lower(o.pinnedHash) : null;
    this._cat = null;
  }

  async call(to, data, from) { return this.rpc("eth_call", [from ? { to, data, from } : { to, data }, "latest"]); }

  /// services.json as the chain serves it, refused unless its keccak is the hash the chain pins (and the one the host reviewed).
  async catalogue() {
    const bytes = decBytes(await this.call(this.catalog, selector(SIGS.services)));
    const onChain = lower(await this.call(this.catalog, selector(SIGS.catalogHash))).slice(0, 66);
    const served = kec(bytes);
    if (served !== onChain) throw new Error(`${DRIFT} — the chain pins ${onChain}, the bytes served hash to ${served}`);
    if (this.pinnedHash && onChain !== this.pinnedHash) throw new Error(`${DRIFT} — the host reviewed ${this.pinnedHash}, the chain pins ${onChain}`);
    if (this._cat && this._cat.hash === served) return this._cat;
    const doc = JSON.parse(bytes.toString("utf8"));
    const rows = {};
    for (const r of doc.services) rows[r.on + "." + r.name] = r;
    const hubRow = doc.services.find((r) => r.on === "hub");
    this._cat = { hash: served, doc, rows, hub: hubRow ? lower(hubRow.contract) : null, errors: doc.errors || {} };
    return this._cat;
  }

  /// A revert's data as a sentence, by the catalogue's error table.
  sentence(cat, data) {
    const d = String(data || "");
    if (d.length < 10) return "reverted";
    const sig = cat.errors[lower(d.slice(0, 10))];
    if (!sig) return "unknown error " + d.slice(0, 10);
    const ts = split(sig.slice(sig.indexOf("(") + 1, sig.lastIndexOf(")")));
    const ws = words(d.slice(10));
    return sig.slice(0, sig.indexOf("(")) + "(" + ts.map((t, i) => t === "address" ? "0x" + String(ws[i] || "").slice(26) : /^u?int|^bytes\d/.test(t) ? String(W(ws[i] || "0x0", 0)) : String(ws[i] || "")).join(", ") + ")";
  }

  async reachOf(cat, tokenId) {
    if (!cat.hub) throw new Error("the catalogue names no hub row");
    const a = await this.call(cat.hub, encodeCall(SIGS.account, [tokenId]));
    return "0x" + String(a).slice(26, 66);
  }

  /// The one shape a key sends: executeAsSession(target, value, data) on the token's Reach.
  async build(p) {
    const cat = await this.catalogue();
    const tokenId = bigint(p.tokenId, "tokenId");
    const row = cat.rows[String(p.row || "")];
    if (!row) throw new Error(`no row ${p.row} in services.json (${Object.keys(cat.rows).length} rows)`);
    if (row.kind === "read") throw new Error(`${p.row} is a read row: use read_${p.row.replace(/\./g, "_")}`);
    if (row.on === "reach") throw new Error("a session cannot call the Reach itself (NoPrivilegeEscalation)");
    const target = BigInt(row.contract) ? lower(row.contract) : lower(p.to || "");
    if (!isAddr(target)) throw new Error(`${p.row}: its contract is per asset; name the target`);
    const args = Array.isArray(p.args) ? p.args : [];
    const data = row.selector + encodeParams(row.args, args);
    if ((lower(data.slice(0, 10)) === APPROVE || lower(data.slice(0, 10)) === INCREASE) && W(data.slice(10), 1) >> 255n) throw new Error("unlimited approvals are never built here");
    const value = bigint(p.value == null ? "0" : p.value, "value (wei)");
    const reach = await this.reachOf(cat, tokenId);
    return { cat, tokenId, row, reach, target, selector: lower(data.slice(0, 10)), data, value, outer: encodeCall(SIGS.eas, [target, value, data]) };
  }

  /// propose: a read — sessionAllows, then the dry run. Never sends.
  async propose(p) {
    const b = await this.build(p);
    if (!this.signer) throw new Error("no signer: the host supplies {address, send(tx)}; the bridge never takes a key");
    const key = lower(this.signer.address);
    const allowed = W(await this.call(b.reach, encodeCall(SIGS.allows, [key, b.target, b.selector])), 0) === 1n;
    let simulation = null;
    if (allowed) {
      try { await this.call(b.reach, b.outer, key); simulation = { ok: true }; }
      catch (e) { const d = e && (e.data && e.data.data || e.data); simulation = { ok: false, revert: typeof d === "string" ? this.sentence(b.cat, d) : String(e && e.message || e) }; }
    }
    return { allowed, simulation, key, tokenId: String(b.tokenId), row: p.row, reach: b.reach, target: b.target, selector: b.selector, value: String(b.value), data: b.data, calldata: b.outer, catalogHash: b.cat.hash,
             sentence: !allowed ? `not allowed by the grant: ${p.row} on ${b.target} for key ${key} — nothing is sent` : simulation.ok ? "allowed by the grant; the call simulates" : `allowed by the grant, but would revert: ${simulation.revert}` };
  }

  /// act: exactly one executeAsSession through the host's signer, only after propose allowed it.
  async act(p) {
    const q = await this.propose(p);
    if (!q.allowed) throw new Error(q.sentence);
    if (!q.simulation.ok) throw new Error(q.sentence + " — nothing is sent");
    const hash = await this.signer.send({ from: q.key, to: q.reach, data: q.calldata, value: "0x0" });
    return { ...q, hash, sentence: "sent: one executeAsSession " + hash };
  }

  /// A read row: eth_call on its contract (or `to` for a per-token or per-asset row), the answer as words.
  async read(p) {
    const cat = await this.catalogue();
    const row = cat.rows[String(p.row || "")];
    if (!row) throw new Error(`no row ${p.row} in services.json`);
    if (row.kind !== "read") throw new Error(`${p.row} is a ${row.kind} row: propose it`);
    const to = BigInt(row.contract) ? lower(row.contract) : lower(p.to || "");
    if (!isAddr(to)) throw new Error(`${p.row}: its contract is per token or per asset; name the target`);
    const raw = await this.call(to, row.selector + encodeParams(row.args, Array.isArray(p.args) ? p.args : []));
    return { row: p.row, to, raw, words: words(raw).map((w) => String(W(w, 0))) };
  }

  async clock() { const b = await this.rpc("eth_getBlockByNumber", ["latest", false]); return { timestamp: String(BigInt(b.timestamp)), number: String(BigInt(b.number)) }; }

  /*═══════════════════ MCP ═══════════════════*/

  /// Every tool, derived from the verified catalogue: one read tool per read row, propose and act per write row, and the five generic ones.
  async tools() {
    const cat = await this.catalogue();
    const argSchema = (row) => ({ type: "array", items: { type: "string" }, minItems: row.args.length, maxItems: row.args.length, description: "the arguments, as strings, in order: " + (row.args.join(", ") || "none") });
    const common = (row) => ({ tokenId: { type: "string", description: "the token whose Reach is the hand" }, args: argSchema(row), ...(BigInt(row.contract) ? {} : { to: { type: "string", description: "the target: this row's contract is per asset" } }) });
    const out = [
      { name: "intact_catalogue", description: "the catalogue this bridge is bound to: its keccak (catalogHash), the rows, the hub", inputSchema: { type: "object", properties: {} } },
      { name: "intact_clock", description: "the chain's clock: the latest block's timestamp and number — every deadline comes from here, never from a wall clock", inputSchema: { type: "object", properties: {} } },
      { name: "intact_read", description: "a read row of services.json by name (word.name), as words", inputSchema: { type: "object", properties: { row: { type: "string" }, args: { type: "array", items: { type: "string" } }, to: { type: "string" } }, required: ["row"] } },
      { name: "intact_propose", description: "a READ: sessionAllows(key, target, selector) on the token's Reach, then a dry eth_call of the executeAsSession act would send; nothing is sent",
        inputSchema: { type: "object", properties: { tokenId: { type: "string" }, row: { type: "string" }, args: { type: "array", items: { type: "string" } }, value: { type: "string", description: "wei the Reach sends with the call" }, to: { type: "string" } }, required: ["tokenId", "row"] } },
      { name: "intact_act", description: "exactly one executeAsSession through the host's signer, only after propose allowed it and the simulation landed",
        inputSchema: { type: "object", properties: { tokenId: { type: "string" }, row: { type: "string" }, args: { type: "array", items: { type: "string" } }, value: { type: "string" }, to: { type: "string" } }, required: ["tokenId", "row"] } }
    ];
    for (const [name, row] of Object.entries(cat.rows)) {
      const where = BigInt(row.contract) ? ` on ${row.on} ${row.contract}` : ` on ${row.on} (a target to name)`;
      if (row.kind === "read") out.push({ name: toolName("read", name), description: `read ${row.sig}${where}${row.notes ? " — " + row.notes : ""}`, inputSchema: { type: "object", properties: { args: argSchema(row), ...(BigInt(row.contract) ? {} : { to: { type: "string" } }) }, required: ["args"] } });
      else if (row.on !== "reach") {
        const value = row.kind === "payable" ? { value: { type: "string", description: "wei the Reach sends with the call, charged to the key's native cap" } } : {};
        out.push({ name: toolName("propose", name), description: `propose ${row.sig}${where} (${row.kind}, via ${row.via}${row.notes ? "; " + row.notes : ""}): a read, nothing sent`, inputSchema: { type: "object", properties: { ...common(row), ...value }, required: ["tokenId", "args"] } });
        out.push({ name: toolName("act", name), description: `act ${row.sig}${where}: one executeAsSession through the host's signer, after propose allowed it`, inputSchema: { type: "object", properties: { ...common(row), ...value }, required: ["tokenId", "args"] } });
      }
    }
    return out;
  }

  /// tools/call: a name and its arguments → a result object, or a thrown sentence. A secret-shaped argument is refused unread.
  async invoke(name, args = {}) {
    for (const k of Object.keys(args || {})) if (SECRET(k)) throw new Error(`the bridge never takes a wallet token or a session key through a tool argument (${k}); the host's signer holds it`);
    const m = String(name).match(/^(read|propose|act)_(\w+?)_(\w+)$/);
    if (name === "intact_catalogue") { const cat = await this.catalogue(); return { catalogHash: cat.hash, rows: Object.keys(cat.rows).length, hub: cat.hub, schema: cat.doc.schema, door: cat.doc.door }; }
    if (name === "intact_clock") return this.clock();
    if (name === "intact_read") return this.read(args);
    if (name === "intact_propose") return this.propose(args);
    if (name === "intact_act") return this.act(args);
    if (m) { const p = { ...args, row: m[2] + "." + m[3] }; return m[1] === "read" ? this.read(p) : m[1] === "propose" ? this.propose(p) : this.act(p); }
    throw new Error("no such tool: " + name);
  }

  /// One JSON-RPC 2.0 message in, one out (null for a notification).
  async handle(msg) {
    const id = msg && msg.id;
    const reply = (result) => ({ jsonrpc: "2.0", id, result });
    const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(-32600, "not a JSON-RPC 2.0 request");
    if (msg.method.startsWith("notifications/")) return null;
    try {
      switch (msg.method) {
        case "initialize": return reply({ protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER,
          instructions: "every tool is derived from services.json and refused whole when the catalogue's keccak is not Catalog.catalogHash(); propose is a read, act is one executeAsSession through the host's signer; no key crosses this bridge" });
        case "ping": return reply({});
        case "tools/list": return reply({ tools: await this.tools() });
        case "tools/call": {
          const p = msg.params || {};
          try { const r = await this.invoke(p.name, p.arguments || {}); return reply({ content: [{ type: "text", text: JSON.stringify(r) }], isError: false }); }
          catch (e) { return reply({ content: [{ type: "text", text: String(e && e.message || e) }], isError: true }); }
        }
        default: return fail(-32601, "method not found: " + msg.method);
      }
    } catch (e) { return fail(-32000, String(e && e.message || e)); }
  }
}

export const createBridge = (o) => new Bridge(o);

/// The stdio loop: newline-delimited JSON in, newline-delimited JSON out. Resolves when the input ends.
export function serve(bridge, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input, crlfDelay: Infinity });
    let chain = Promise.resolve();
    rl.on("line", (line) => {
      if (!line.trim()) return;
      chain = chain.then(async () => {
        let msg; try { msg = JSON.parse(line); } catch { output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }) + "\n"); return; }
        const r = await bridge.handle(msg);
        if (r) output.write(JSON.stringify(r) + "\n");
      });
    });
    rl.on("close", () => chain.then(resolve));
  });
}

/// A JSON-RPC transport over fetch, for the URL the host chose. Nothing here names one.
export const httpRpc = (url) => async (method, params = []) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data });
  return j.result;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.INTACT_RPC_URL, catalog = process.env.INTACT_CATALOG;
  if (!url || !catalog) { console.error("INTACT_RPC_URL and INTACT_CATALOG are the host's to set; INTACT_PINNED_HASH and INTACT_SIGNER are optional"); process.exit(2); }
  const signer = process.env.INTACT_SIGNER ? (await import(process.env.INTACT_SIGNER)).default : null;
  await serve(createBridge({ rpc: httpRpc(url), catalog, pinnedHash: process.env.INTACT_PINNED_HASH || undefined, signer: signer || undefined }));
}
