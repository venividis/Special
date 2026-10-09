#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · an HTTP gateway, which is all a web3:// gateway is

  Origin: IPSEITY tools/gateway.mjs, kept verbatim in spirit (U10). Maps
  GET /path/segments onto Premises.request(["path","segments"], []) via
  eth_call and serves what comes back, with the status, Content-Type,
  Cache-Control, ETag, Content-Encoding and Location the contract chose —
  a 301 is a 301, a 404 a 404. This file holds no content — turn it off
  and every byte it ever served is still on the chain.

      node tools/gateway.mjs                        # deployments/31337.json
      node tools/gateway.mjs --record deployments/84532.json --port 8080
      RPC_URL=… PREMISES=0x… node tools/gateway.mjs # no record at all

  Three edits from the donor, each a reason:

  · the body is written as BYTES. INTACT serves gzip panels
    (`/panel/<name>.js`, `Content-Encoding: gzip`, an ETag over the
    inflated bytes); the donor's `res.end(string)` re-encoded utf8 and
    would have corrupted every one of them;
  · `POST /__rpc` forwards READS only — the eight methods a page needs to
    render and to watch logs without a wallet, and nothing that signs,
    sends, or administers the node. The donor's `/__wallet` (dev-key
    signing on 31337) is gone: this gateway passes no write at all, so a
    browser with no injected wallet can read and only read;
  · the record is `deployments/<chainId>.json` (U10's shape), or the
    PREMISES/RPC_URL environment when there is none.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { RpcChain, DEV_KEYS } from "./rpc.mjs";
import { encRequest, decResponse } from "./site.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARGV = process.argv.slice(2);
const arg = (f, d) => { const i = ARGV.indexOf(f); return i < 0 ? d : ARGV[i + 1]; };

const recordPath = arg("--record", path.join(ROOT, "deployments/31337.json"));
const record = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, "utf8")) : null;
const PORT = Number(arg("--port", 8080));
const HOST = arg("--host", "127.0.0.1");
const PREMISES = process.env.PREMISES || record?.contracts?.premises;
/// the endpoint comes from the environment, never from the record (a record
/// that named the node that serves it would be choosing its own oracle)
const RPC = process.env.RPC_URL || (record?.chainId === 31337 ? "http://127.0.0.1:8545" : null);
if (!PREMISES || !RPC) {
  console.error("no deployment to serve: pass --record <deployments/<chainId>.json> or set PREMISES and RPC_URL");
  process.exit(2);
}

/// Reads need a key only for the client's shape; the dev key signs nothing here.
const c = await RpcChain.open(RPC, DEV_KEYS[0]);
if (record && record.chainId && c.chainId !== record.chainId) {
  console.error(`the node at ${RPC} is chain ${c.chainId}; the record is for ${record.chainId}`);
  process.exit(2);
}

const MAX_REQUEST = 128 * 1024;
const body = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on("data", (d) => {
    size += d.length;
    if (size > MAX_REQUEST) { reject(new Error("request body is too large")); req.destroy(); return; }
    chunks.push(d);
  });
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

/*  This endpoint exists for pages to read through nodes that do not expose
    CORS. It is not a JSON-RPC relay: nothing that signs, sends or
    administers the node passes — eth_sendRawTransaction is excluded on
    purpose, as is anything under hardhat_/debug_/admin_.              */
export const PAGE_RPC = new Set([
  "eth_call", "eth_chainId", "eth_blockNumber", "eth_getCode", "eth_getLogs",
  "eth_estimateGas", "eth_getTransactionReceipt", "eth_getBalance"
]);

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/__rpc") {
      /*  Forwarded through the same client the deployer uses, because that
          one knows about proxies and this environment has one road out. */
      let payload;
      try { payload = JSON.parse(await body(req)); } catch { payload = null; }
      res.writeHead(200, { "Content-Type": "application/json" });
      if (!payload || typeof payload.method !== "string" || !PAGE_RPC.has(payload.method)) {
        return res.end(JSON.stringify({ jsonrpc: "2.0", id: (payload && payload.id) ?? 1,
          error: { code: -32601, message: "method not available through the page gateway" } }));
      }
      try {
        const result = await c.rpc(payload.method, payload.params || []);
        return res.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id ?? 1, result }));
      } catch (e) {
        return res.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id ?? 1,
          error: { code: -32000, message: String(e && e.message || e) } }));
      }
    }

    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end(); }

    const segments = decodeURIComponent((req.url || "/").split("?")[0]).split("/").filter(Boolean);
    const raw = await c.call(PREMISES, encRequest(segments));
    const { status, bodyBytes, headers } = decResponse(raw);

    /*  Every header the contract set, as set: Content-Type, Cache-Control,
        ETag, Content-Encoding on the gzip panels, Location on a 301.   */
    const h = { "Content-Length": String(bodyBytes.length) };
    for (const [k, v] of headers) h[k] = v;
    res.writeHead(status, h);
    res.end(req.method === "HEAD" ? undefined : bodyBytes);
  } catch (e) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("the node did not answer: " + (e && e.message || e));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`
  serving ${PREMISES}
  from    ${RPC}  (chain ${c.chainId})
  at      http://${HOST}:${PORT}/

  Every page is an eth_call made when you ask. Stop this process and
  nothing is lost, because nothing is here. POST /__rpc forwards reads
  only; there is no write path through this gateway.
`);
});
