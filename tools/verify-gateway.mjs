#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · a gateway's answers, diffed against the chain's own (U13)

  Origin: the `verify-gateway` idea in research/designs/B-clean-room.md
  §10.3 ("tools/verify-gateway.mjs diffs a gateway's response against
  local eth_call in CI") and the EthStorage injection finding the IPSEITY
  brief recorded: a web3:// gateway is an HTTP server somebody else runs,
  and a server can add a byte the chain never served — a script, a cookie,
  a header that softens the document's own Content-Security-Policy. The
  contract's answer is the only reference, so this tool asks both and
  requires them equal.

  For every route template of DESIGN.md §5.3 — `/`, `/token/<id>/live`,
  `/raw`, `/face/<n>`, `/crest.svg`, `/state.json`, `/hash`,
  `/services.json`, `/panel/<each>.js`, `/services.json`, `/open`,
  `/manifest`, the three 301s (`/k/<id>/<key>`, `/c/<id>`, `/token/<id>`)
  and three paths that name nothing (404) — the gateway's response is read
  as RAW BYTES (undici's `request`, which decodes nothing, so a gzip panel
  is compared as the gzip it is AND as what it inflates to) and the chain's
  answer is read through `eth_call Premises.request(segments)` over
  RPC_URL. Status, body bytes, Content-Type, ETag, Cache-Control,
  Content-Encoding and Location must be equal; the gateway may add the
  hop-by-hop headers an HTTP server owns — Date, Content-Length,
  Connection, Keep-Alive, Transfer-Encoding — and nothing else. An extra
  header, an injected byte, a `<script>` the chain did not serve, a
  Set-Cookie, or a Content-Security-Policy header (the document carries
  its policy in a <meta>; a header can only weaken it) is a finding named
  by route. Then the hashes: `/manifest`'s panel hashes must equal the
  keccaks of the panels as served, its panel-route keccak the keccak over
  them, its engineHash the keccak of what the served document inflates
  to; `/token/<id>/hash` must be the keccak of the served `/live` body and
  of the served `/state.json`; and the manifest must be the record's.

    RPC_URL=… node tools/verify-gateway.mjs --gateway http://host:port --record deployments/<chainId>.json [--ids 1,2]
    RPC_URL=… node tools/verify-gateway.mjs --gateway … --record … --tamper      # the proof that the diff catches a tamper
    PREMISES=0x… RPC_URL=… node tools/verify-gateway.mjs --gateway …            # no record at all
    --prefix /0x<premises>:<chainId>                                            # a path-based gateway's prefix

  `--tamper` is this tool's own self-test: it stands a tiny forwarding
  proxy in front of the gateway — a TEST FIXTURE that lives here and
  nowhere near tools/gateway.mjs — which, one mode at a time, appends a
  `<script>` to an HTML body, adds a Set-Cookie, and rewrites a panel's
  ETag, and asserts that each is caught by name. 31337 defaults RPC_URL
  to the local node; any other chain takes it from the environment, never
  from the record (a record naming its own verifier would be choosing its
  own oracle). Reads only: the dev key signs nothing.

  The last line is "  N passed, M failed"; the exit code follows it.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { RpcChain, DEV_KEYS } from "./rpc.mjs";
import { encRequest, decResponse, PANELS } from "./site.mjs";
import { parseArgs } from "./deploy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kec = (b) => "0x" + Buffer.from(keccak256(Buffer.isBuffer(b) ? b : Buffer.from(b))).toString("hex");
const low = (s) => String(s).toLowerCase();

/*═══════════════════ the harness ═══════════════════*/

export function harness() {
  const t = { pass: 0, fail: 0, failures: [] };
  t.ok = (cond, name, detail) => {
    cond ? t.pass++ : t.fail++;
    if (!cond) t.failures.push(name);
    console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
    if (!cond && detail !== undefined) console.log(`      ${String(detail).slice(0, 400)}`);
    return !!cond;
  };
  t.head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
  return t;
}

/*═══════════════════ raw HTTP, through the proxy when the host is not ours ═══════════════════*/

/// A gateway's answer as the bytes it sent: undici's `request` decodes no
/// Content-Encoding (fetch would inflate a gzip panel and hide the bytes
/// under test). A non-local host goes through the environment's proxy the
/// way tools/rpc.mjs goes, with the same CA bundle.
let agent = null;
export async function rawGet(url) {
  const { request, ProxyAgent } = await import("undici");
  const host = new URL(url).hostname;
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  const local = host === "127.0.0.1" || host === "localhost" || host === "::1";
  const opts = { method: "GET", headers: { "accept-encoding": "identity" } };
  if (proxy && !local) {
    if (!agent) {
      const caPath = process.env.NODE_EXTRA_CA_CERTS || "/root/.ccr/ca-bundle.crt";
      agent = new ProxyAgent({ uri: proxy, requestTls: fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath) } : undefined });
    }
    opts.dispatcher = agent;
  }
  const r = await request(url, opts);
  const chunks = [];
  for await (const ch of r.body) chunks.push(ch);
  // header names lowercased; a repeated header (Set-Cookie) is a list
  const headers = {};
  for (const [k, v] of Object.entries(r.headers)) headers[low(k)] = v;
  return { status: r.statusCode, headers, body: Buffer.concat(chunks) };
}

/*═══════════════════ the routes ═══════════════════*/

/// The hop-by-hop headers an HTTP server owns (RFC 9110 §7.6.1, plus its
/// clock and the framing of this hop). Everything else must be the chain's.
export const HOP_HEADERS = new Set(["date", "content-length", "connection", "keep-alive", "transfer-encoding"]);
/// The headers the contract sets, compared one by one when present.
export const CONTRACT_HEADERS = ["content-type", "cache-control", "etag", "content-encoding", "location", "link"];

export function routesFor(ids, key) {
  const R = [];
  const add = (p, kind) => R.push({ path: p, segments: p.split("/").filter(Boolean), kind });
  add("/", "document");
  for (const id of ids) {
    add(`/token/${id}/live`, "document");
    add(`/token/${id}/raw`, "text");
    add(`/token/${id}/face/0`, "text");
    add(`/token/${id}/crest.svg`, "svg");
    add(`/token/${id}/state.json`, "json");
    add(`/token/${id}/hash`, "json");
    add(`/token/${id}/services.json`, "json");
    add(`/k/${id}/${key}`, "moved");
    add(`/c/${id}`, "moved");
    add(`/token/${id}`, "moved");
  }
  for (const name of PANELS) add(`/panel/${name}.js`, "panel");
  add("/services.json", "json");
  add("/open", "json");
  add("/manifest", "json");
  /// three paths that name nothing: a 404 that never echoes them (words
  /// the 404 document itself does not contain — it is titled "no such
  /// resource", so a probe spelled that way would find its own words)
  add("/nonsense", "nothing");
  add("/token/abc", "nothing");
  add("/elsewhere/entirely", "nothing");
  return R;
}

const scripts = (buf) => (buf.toString("latin1").match(/<script\b/gi) || []).length;
const headerOf = (chain, name) => (chain.headers.find((h) => low(h[0]) === name) || [])[1];

/**
 * Diff one gateway against the chain for every route. Returns the served
 * bodies keyed by path, so the manifest checks can recompute from them.
 */
export async function diffRoutes(t, { gateway, prefix = "", routes, chainAnswer }) {
  const served = {};
  for (const route of routes) {
    const chain = await chainAnswer(route.segments);
    let got;
    try { got = await rawGet(gateway + prefix + route.path); }
    catch (e) { t.ok(false, `${route.path}: the gateway answered`, e.message); continue; }
    served[route.path] = { chain, got };
    const r = route.path;
    t.ok(got.status === chain.status, `${r}: the status is the chain's (${chain.status})`, `gateway ${got.status}`);
    const ctype = headerOf(chain, "content-type") || "";
    const gz = headerOf(chain, "content-encoding") === "gzip";
    if (gz) {
      let inflated = null;
      try { inflated = zlib.gunzipSync(got.body); } catch { /* not gzip */ }
      t.ok(got.body.equals(chain.bodyBytes), `${r}: the body is the chain's gzip bytes`, `gateway ${got.body.length} B, chain ${chain.bodyBytes.length} B`);
      t.ok(inflated !== null && inflated.equals(zlib.gunzipSync(chain.bodyBytes)), `${r}: and inflates to what the chain's bytes inflate to`, inflated === null ? "the served body does not inflate" : `${inflated.length} B inflated`);
    } else {
      t.ok(got.body.equals(chain.bodyBytes), `${r}: the body is the chain's bytes`,
           `gateway ${got.body.length} B, chain ${chain.bodyBytes.length} B${got.body.length > chain.bodyBytes.length && got.body.subarray(0, chain.bodyBytes.length).equals(chain.bodyBytes) ? `; the gateway appended ${JSON.stringify(got.body.subarray(chain.bodyBytes.length).toString("utf8").slice(0, 120))}` : ""}`);
    }
    if (/text\/html/.test(ctype)) {
      t.ok(scripts(got.body) === scripts(chain.bodyBytes), `${r}: no script was injected into the body`, `gateway serves ${scripts(got.body)} <script> element(s), the chain ${scripts(chain.bodyBytes)}`);
    }
    /// every header the contract set, as set
    const wrong = [];
    for (const [k, v] of chain.headers) {
      const have = got.headers[low(k)];
      if (have === undefined) wrong.push(`${k} missing`);
      else if (String(Array.isArray(have) ? have.join(", ") : have) !== v) wrong.push(`${k}: gateway ${JSON.stringify(have)} vs chain ${JSON.stringify(v)}`);
    }
    t.ok(wrong.length === 0, `${r}: every header the contract set is served as set`, `${chain.headers.map((h) => h[0]).join(", ")}: ${wrong.join("; ")}`);
    if (headerOf(chain, "etag") !== undefined) t.ok(got.headers.etag === headerOf(chain, "etag"), `${r}: the ETag is the chain's`, `gateway ${got.headers.etag} vs chain ${headerOf(chain, "etag")}`);
    if (chain.status === 301) t.ok(got.headers.location === headerOf(chain, "location"), `${r}: Location is the chain's (${headerOf(chain, "location")})`, `gateway ${got.headers.location}`);
    /// and nothing the contract did not set, hop headers aside
    const set = new Set(chain.headers.map((h) => low(h[0])));
    const extra = Object.keys(got.headers).filter((k) => !set.has(k) && !HOP_HEADERS.has(k));
    t.ok(extra.length === 0, `${r}: a gateway adds hop headers and nothing else`, `extra header(s): ${extra.join(", ")}`);
    t.ok(got.headers["set-cookie"] === undefined, `${r}: no Set-Cookie`, `Set-Cookie: ${JSON.stringify(got.headers["set-cookie"])}`);
    t.ok(got.headers["content-security-policy"] === undefined && got.headers["content-security-policy-report-only"] === undefined,
         `${r}: no CSP header weakens the document's meta`, `header: ${got.headers["content-security-policy"] || got.headers["content-security-policy-report-only"]}`);
    if (route.kind === "nothing") {
      const echoed = route.segments.filter((s) => s.length > 2 && got.body.toString("utf8").includes(s));
      t.ok(chain.status === 404 && got.status === 404 && echoed.length === 0, `${r}: a 404 never echoes the path`, echoed.length ? `echoed: ${echoed.join(", ")}` : `status ${got.status}`);
    }
  }
  return served;
}

/// The hashes: what /manifest promises against what the gateway served.
export async function checkHashes(t, { served, ids, record, codeAt }) {
  const man = served["/manifest"];
  if (!man) return;
  let M = null;
  try { M = JSON.parse(man.got.body.toString("utf8")); } catch { /* not JSON */ }
  if (!t.ok(M && Array.isArray(M.routes), "/manifest is JSON with routes", man.got.body.toString("utf8").slice(0, 120))) return;
  const panelHashes = {};
  for (const name of PANELS) {
    const p = served[`/panel/${name}.js`];
    try { panelHashes[name] = kec(zlib.gunzipSync(p.got.body)); } catch { panelHashes[name] = null; }
  }
  const panelsPacked = Buffer.concat(PANELS.map((n) => Buffer.from(String(M.panelHashes[n] || "0x").slice(2), "hex")));
  const route = (tpl) => (M.routes.find((x) => x.template === tpl) || {}).keccak;
  const inflatedDoc = (buf) => { const m = buf.toString("utf8").match(/self\.\$INTACT="([A-Za-z0-9+/=]+)";<\/script>/); return m ? zlib.gunzipSync(Buffer.from(m[1], "base64")) : null; };
  const live0 = served[`/token/${ids[0]}/live`];
  const shell = live0 ? inflatedDoc(live0.got.body) : null;
  const root = served["/"] ? inflatedDoc(served["/"].got.body) : null;
  const recomputed = PANELS.every((n) => panelHashes[n] && low(panelHashes[n]) === low(M.panelHashes[n]))
    && low(route("/panel/<name>.js")) === low(kec(panelsPacked))
    && shell !== null && low(kec(shell)) === low(M.engineHash)
    && root !== null && low(kec(root)) === low(M.engineHash)
    && low(route("/token/<id>/live")) === low(M.engineHash) && low(route("/")) === low(M.engineHash);
  t.ok(recomputed, "/manifest hashes equal those recomputed from the bodies served",
       `panels ${PANELS.map((n) => `${n} ${panelHashes[n] === null ? "no inflate" : low(panelHashes[n]) === low(M.panelHashes[n])}`).join(", ")}; shell ${shell ? kec(shell) : "no payload"} vs ${M.engineHash}`);
  for (const id of ids) {
    const h = served[`/token/${id}/hash`], live = served[`/token/${id}/live`], state = served[`/token/${id}/state.json`];
    let H = null;
    try { H = JSON.parse(h.got.body.toString("utf8")); } catch { /* not JSON */ }
    t.ok(H && live && low(H.document) === low(kec(live.got.body)), `/token/${id}/hash is the keccak of the served /live body`, H ? `${H.document} vs ${live ? kec(live.got.body) : "?"}` : "no hash body");
    t.ok(H && state && low(H.state) === low(kec(state.got.body)) && low(H.engine) === low(M.engineHash), `/token/${id}/hash names the served /state.json and the manifest's engine`, H ? `${H.state} vs ${state ? kec(state.got.body) : "?"}; engine ${H.engine}` : "no hash body");
  }
  if (record) {
    const E = record.engine || {};
    const same = low(M.engineHash) === low(E.engineHash) && JSON.stringify(M.shardHashes.map(low)) === JSON.stringify((E.shardHashes || []).map(low))
      && PANELS.every((n) => low(M.panelHashes[n]) === low((E.panelHashes || {})[n])) && low(M.catalogHash) === low(record.catalogHash);
    t.ok(same, "/manifest is the record's: engineHash, shardHashes, panelHashes, catalogHash", `manifest ${M.engineHash} ${M.catalogHash}; record ${E.engineHash} ${record.catalogHash}`);
    if (codeAt && record.contracts && record.contracts.crest) {
      const code = await codeAt(record.contracts.crest);
      t.ok(code !== "0x" && low(M.crestCodehash) === low(kec(Buffer.from(code.slice(2), "hex"))), "/manifest's crestCodehash is the keccak of the Crest's code on this chain", `${M.crestCodehash} vs code ${code === "0x" ? "none" : kec(Buffer.from(code.slice(2), "hex"))}`);
    }
  }
}

/*═══════════════════ the test fixture: a gateway that tampers ═══════════════════*/

/// A forwarding proxy that changes one thing per mode, so the diff above
/// can be shown to catch it. It forwards to a LOCAL gateway only and lives
/// in this verifier; tools/gateway.mjs knows nothing of it.
export function tamperProxy(upstream, mode) {
  const u = new URL(upstream);
  const server = http.createServer((req, res) => {
    const fwd = http.request({ host: u.hostname, port: u.port, path: req.url, method: "GET", headers: { "accept-encoding": "identity" } }, (up) => {
      const chunks = [];
      up.on("data", (d) => chunks.push(d));
      up.on("end", () => {
        let body = Buffer.concat(chunks);
        const h = { ...up.headers };
        delete h["transfer-encoding"];
        if (mode === "script" && /text\/html/.test(String(h["content-type"]))) body = Buffer.concat([body, Buffer.from("<script>/* a byte the chain never served */</script>", "utf8")]);
        if (mode === "cookie") h["set-cookie"] = "gateway=1; Path=/";
        if (mode === "etag" && h.etag) h.etag = `"0x${"00".repeat(32)}"`;
        h["content-length"] = String(body.length);
        res.writeHead(up.statusCode, h);
        res.end(body);
      });
    });
    fwd.on("error", (e) => { res.writeHead(502); res.end(String(e.message)); });
    fwd.end();
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}

/*═══════════════════ the CLI ═══════════════════*/

const OPTIONS = ["gateway", "record", "ids", "prefix", "tamper", "premises"];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const k of Object.keys(args)) if (!OPTIONS.includes(k)) { console.error(`unknown option --${k}; the options are ${OPTIONS.map((o) => "--" + o).join(" ")}`); process.exit(2); }
  if (!args.gateway || args.gateway === true) { console.error("which gateway? --gateway http://host:port"); process.exit(2); }
  const gateway = String(args.gateway).replace(/\/$/, "");
  const prefix = args.prefix && args.prefix !== true ? String(args.prefix).replace(/\/$/, "") : "";
  const recordPath = args.record && args.record !== true ? path.resolve(ROOT, args.record) : null;
  const record = recordPath ? JSON.parse(fs.readFileSync(recordPath, "utf8")) : null;
  const premises = (args.premises && args.premises !== true ? args.premises : null) || process.env.PREMISES || record?.contracts?.premises;
  if (!premises) { console.error("no Premises to ask: pass --record deployments/<chainId>.json or --premises 0x… (or PREMISES in the environment)"); process.exit(2); }
  const rpc = process.env.RPC_URL || ((record?.chainId ?? 31337) === 31337 ? "http://127.0.0.1:8545" : null);
  if (!rpc) { console.error(`RPC_URL is required for chain ${record.chainId}: the record carries no endpoint, by design`); process.exit(2); }
  const ids = args.ids && args.ids !== true ? String(args.ids).split(",").map((s) => s.trim()).filter(Boolean) : ["1"];

  const t = harness();
  console.log(`\n  \x1b[1mINTACT · verify-gateway\x1b[0m  ${gateway}${prefix} against ${premises} over ${rpc}`);
  const c = await RpcChain.open(rpc, DEV_KEYS[0]);
  if (record && record.chainId && c.chainId !== record.chainId) { console.error(`  the node at ${rpc} is chain ${c.chainId}; the record is for ${record.chainId}`); process.exit(2); }
  const chainAnswer = async (segments) => decResponse(await c.call(premises, encRequest(segments)));
  const codeAt = (a) => c.rpc("eth_getCode", [a, "latest"]);
  const key = record?.deployer || "0x" + "ab".repeat(20);
  const routes = routesFor(ids, key);

  t.head(`${routes.length} routes: status, bytes and headers against eth_call`);
  const served = await diffRoutes(t, { gateway, prefix, routes, chainAnswer });
  t.head("the hashes the manifest promises, recomputed from what was served");
  await checkHashes(t, { served, ids, record, codeAt });
  const cleanFailures = t.fail;
  console.log(`      ${routes.length} routes for ${ids.length} id(s): ${ids.join(", ")}`);
  t.ok(cleanFailures === 0, "every route's status, body bytes and headers are the chain's own answer", `${cleanFailures} difference(s) above`);

  if (args.tamper) {
    if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(gateway)) { t.ok(false, "--tamper fronts a local gateway only"); }
    else {
      t.head("the fixture: a gateway that tampers is caught by name (each mode fronts the clean gateway with one change)");
      const expect = [
        ["script", /^\/: no script was injected into the body$/, "a gateway that appends a script to an HTML body is caught by name"],
        ["cookie", /^\/token\/\d+\/live: no Set-Cookie$/, "a gateway that adds a Set-Cookie is caught by name"],
        ["etag", /^\/panel\/swap\.js: the ETag is the chain's$/, "a gateway that rewrites an ETag is caught by name"]
      ];
      for (const [mode, re, sentence] of expect) {
        const proxy = await tamperProxy(gateway, mode);
        const quiet = harness();
        const origLog = console.log; console.log = () => {};
        try { await diffRoutes(quiet, { gateway: proxy.url, prefix, routes, chainAnswer }); }
        finally { console.log = origLog; await proxy.close(); }
        const hit = quiet.failures.filter((f) => re.test(f));
        const bodyHit = mode === "script" ? quiet.failures.some((f) => /^\/: the body is the chain's bytes/.test(f)) : true;
        t.ok(hit.length > 0 && bodyHit, sentence, quiet.failures.slice(0, 6).join(" | "));
        console.log(`      ${hit[0] || "not caught"}; ${quiet.fail} finding(s) against the tampering gateway in all`);
      }
    }
  }

  console.log(`\n  ${t.pass} passed, ${t.fail} failed\n`);
  process.exit(t.fail ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e && e.stack || e); console.log("\n  0 passed, 1 failed\n"); process.exit(1); });
}
