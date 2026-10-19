#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the journey over a real wire (U11)

  Origin: IPSEITY tools/testnet-drive.mjs (an injected wallet walking the
  site over `npx hardhat node`), rebuilt around tools/verify-console.mjs's
  browser half and journey: the same page driver, the same injected
  EIP-6963 wallet, the same sentences — but every eth_* the page sends is
  answered by a node on the other side of a socket, and every transaction
  is a real signed legacy transaction sent with eth_sendRawTransaction.

  What this proves that verify-console.mjs cannot: there, the wallet
  answers from an EVM in the same process and the gateway is a function
  call; here, the node is a child process (hardhat, cancun — see
  hardhat.config.cjs), the deployment is tools/deploy.mjs's own CREATE3
  run over JSON-RPC (journaled, recovered, recorded), the document comes
  through tools/gateway.mjs as HTTP bytes with the headers the contract
  set, and the wallet's Node side signs with a hardhat dev key through
  tools/rpc.mjs's RpcChain (EIP-7825 cap asserted on every send). The
  gateway's POST /__rpc is read-only by design, so the wallet never goes
  near it: reads and sends go to the node directly, as a browser wallet's
  would.

  Steps, every child killed on exit (also on failure) unless --keep:

    1 · `npx hardhat node --port 8546` (U13 uses 8547/8082), or --rpc URL
        for a node already running — a FRESH node: the deploy below is a
        full run from the dev key's nonce 0;
    2 · `node tools/deploy.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL
        --rpc … --record <out>/drive-31337.json --journal <out>/drive-31337.journal.json`
        — never deployments/31337.json, never anything under deployments/;
    3 · `node tools/gateway.mjs --record <that record> --port 8081` with
        RPC_URL set, polled until /manifest answers;
    4 · Chromium at http://127.0.0.1:8081/ with the holder's wallet (dev
        key 1, connected: false) and the buyer's (dev key 2): mint → open
        → connect → swap → speak → launch → seal → sell → the buyer's clean
        rightsOf, each receipt status 0x1 from the node. Where the record's
        Studio reports, the Studio room opens on "A collection" and the
        journey presses "A coin" first (verify-console's toCoin, W14).

  Every wait the journey makes throws by name when it times out (verify-
  console's until, W14): the journey stops there and the drive prints
  "the journey threw: until timed out after N ms in group the journey over
  the wire, waiting at tools/verify-console.mjs:L ← …: <the condition>".
  The receipt's sentence is read from the ticker's log, never from one poll
  of its text, so the sale — whose landing the page replaces with "ownership
  or epoch changed — review again" within the same receipt (CONSOLE §4.7) —
  is seen land however fast the node answers the two reads after it.

    node tools/testnet-drive.mjs                      # spawns the node
    node tools/testnet-drive.mjs --rpc http://127.0.0.1:8546 --keep
    node tools/testnet-drive.mjs --out /tmp/wave3/u11  # where the record and journal go

  The last line is "  N passed, M failed" and the exit code follows it.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import { compile, artifact } from "./compile.mjs";
import { RpcChain, DEV_KEYS } from "./rpc.mjs";
import { harness, openBrowser, openPage, journey, hexN, lower, setGroup } from "./verify-console.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARGV = process.argv.slice(2);
const arg = (f) => { const i = ARGV.indexOf(f); return i < 0 ? null : ARGV[i + 1]; };
const RPC_PORT = 8546, GW_PORT = 8081;
const RPC = arg("--rpc") || `http://127.0.0.1:${RPC_PORT}`;
const KEEP = ARGV.includes("--keep");
const OUT_DIR = path.resolve(arg("--out") || path.join(os.tmpdir(), "intact-drive"));
const RECORD = path.join(OUT_DIR, "drive-31337.json"), JOURNAL = path.join(OUT_DIR, "drive-31337.journal.json");
const GATEWAY = `http://127.0.0.1:${GW_PORT}`;
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (u) => "0x" + Buffer.from(u).toString("hex");

/*═══════════════════ the children ═══════════════════*/

const children = [];
function child(name, cmd, args, env = {}) {
  const ch = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  ch.lines = [];
  const take = (d) => { for (const l of String(d).split("\n")) if (l.trim()) { ch.lines.push(l); if (ch.lines.length > 400) ch.lines.shift(); } };
  ch.stdout.on("data", take); ch.stderr.on("data", take);
  ch.on("exit", (code) => { ch.exited = code; });
  children.push(Object.assign(ch, { name }));
  return ch;
}
/// a detached child is a process-group leader: the whole group goes, npx and the node it started alike
function killAll() {
  for (const ch of children) { if (ch.exited != null) continue; try { process.kill(-ch.pid, "SIGTERM"); } catch {} try { ch.kill("SIGTERM"); } catch {} }
}
process.on("exit", () => { if (!KEEP) killAll(); });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { if (!KEEP) killAll(); process.exit(130); });
const waitExit = (ch) => new Promise((r) => { if (ch.exited != null) return r(ch.exited); ch.on("exit", (code) => r(code)); });

/*═══════════════════ JSON-RPC, with the revert data kept ═══════════════════*/

/*  tools/rpc.mjs's client folds an RPC error into its message; the page needs `error.data` (the
    custom error's selector and arguments) to print "would revert: NotActor()", so the wallet's
    reads go through this one, which keeps code and data on the thrown Error. Local only, no proxy. */
async function rpcRaw(url, method, params = []) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw Object.assign(new Error(j.error.message || "rpc error"), { code: j.error.code, data: j.error.data });
  return j.result === undefined ? null : j.result;
}
async function until(fn, label, ms = 60000) {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch {} if (Date.now() - t0 > ms) throw new Error("timed out waiting for " + label); await nap(500); }
}

/*═══════════════════ the wallet over the wire ═══════════════════*/

const PROMPTING = new Set(["eth_requestAccounts", "eth_sendTransaction", "eth_signTransaction", "eth_sendRawTransaction", "personal_sign", "eth_sign",
                           "eth_signTypedData", "eth_signTypedData_v3", "eth_signTypedData_v4", "wallet_switchEthereumChain", "wallet_addEthereumChain"]);

/**
 * An EIP-1193 provider whose Node side is an RpcChain: reads forwarded to the node with their revert
 * data intact, sends signed with the dev key and sent raw, personal_sign a real secp256k1 signature.
 * The same surface the shim's walletFor gives the page driver (calls, promptsLog, receipts, prompts(),
 * sent(), count(), callsTo(), override(), setAccounts(), info), so journey() runs unchanged.
 */
export function rpcWalletFor(rc, opts = {}) {
  const me = rc.from.toString();
  let connected = opts.connected !== false, chainId = rc.chainId;
  const listeners = new Map();
  const W = { calls: [], promptsLog: [], receipts: new Map(), overrides: new Map(), info: null, provider: null, actor: rc, address: me };
  const raw = (method, params) => rpcRaw(rc.url, method, params);
  let seq = Promise.resolve();
  async function answer(method, params = []) {
    const p = params[0] || {};
    if (W.overrides.has(method)) return W.overrides.get(method)(params);
    switch (method) {
      case "eth_chainId": return hexN(chainId);
      case "net_version": return String(chainId);
      case "eth_accounts": return connected ? [me] : [];
      case "eth_requestAccounts": connected = true; return [me];
      case "eth_call": case "eth_estimateGas": case "eth_getBlockByNumber": case "eth_getBlockByHash": case "eth_blockNumber": case "eth_getCode":
      case "eth_getLogs": case "eth_getBalance": case "eth_getTransactionReceipt": case "eth_getTransactionByHash": case "eth_gasPrice": case "eth_getTransactionCount":
        return raw(method, params);
      case "eth_sendTransaction": {
        if (lower(p.from || me) !== lower(me)) throw Object.assign(new Error("unknown account"), { code: 4100 });
        try {
          /* RpcChain.send: estimate (the EIP-7825 cap asserted), sign a legacy transaction, eth_sendRawTransaction, wait for the receipt */
          const r = await rc.send({ to: p.to, data: p.data || "0x", value: p.value ? BigInt(p.value) : 0n, label: "wallet" });
          const receipt = await raw("eth_getTransactionReceipt", [r.hash]);
          W.receipts.set(r.hash, receipt);
          return r.hash;
        } catch (e) {
          /* a reverted send is a receipt with status 0x0, never a throw (the shim's contract, kept) */
          const hash = hex(keccak256(Buffer.from(String(p.data || "") + me + String(W.calls.length) + Date.now(), "utf8")));
          W.receipts.set(hash, { transactionHash: hash, status: "0x0", blockNumber: "0x0", gasUsed: "0x0", from: me, to: p.to, logs: [], revert: String(e.message) });
          return hash;
        }
      }
      case "personal_sign": {
        const [m, addr] = params;
        const msg = /^0x[0-9a-fA-F]*$/.test(String(m)) ? Buffer.from(String(m).slice(2), "hex") : Buffer.from(String(m), "utf8");
        const prefixed = Buffer.concat([Buffer.from("\x19Ethereum Signed Message:\n" + msg.length, "utf8"), msg]);
        const sig = secp256k1.sign(keccak256(prefixed), rc.key);
        W.promptsLog[W.promptsLog.length - 1].message = msg.toString("utf8");
        W.promptsLog[W.promptsLog.length - 1].address = addr;
        return hex(Buffer.concat([Buffer.from(sig.toCompactRawBytes()), Buffer.from([27 + sig.recovery])]));
      }
      case "wallet_switchEthereumChain": { chainId = Number(p.chainId); provider.emit("chainChanged", hexN(chainId)); return null; }
      case "wallet_addEthereumChain": throw Object.assign(new Error("this wallet refuses wallet_addEthereumChain: it carries RPC URLs"), { code: 4200 });
      default: throw new Error("unexpected method " + method);
    }
  }
  const provider = {
    isIntactDrive: true,
    request: ({ method, params }) => {
      const run = () => { const rec = { method, params }; W.calls.push(rec); if (PROMPTING.has(method)) W.promptsLog.push({ method, params }); return answer(method, params); };
      const r = seq.then(run, run); seq = r.then(() => {}, () => {}); return r;
    },
    on: (ev, fn) => { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(fn); return provider; },
    removeListener: (ev, fn) => { listeners.set(ev, (listeners.get(ev) || []).filter((f) => f !== fn)); return provider; },
    emit: (ev, a) => { for (const f of listeners.get(ev) || []) try { f(a); } catch {} }
  };
  W.provider = provider;
  W.info = { uuid: opts.uuid || ("uuid-" + Math.random().toString(16).slice(2)), name: opts.name || "Drive Wallet", icon: opts.icon || "data:image/svg+xml;base64,PHN2Zy8+", rdns: opts.rdns || "io.intact.drive" };
  W.setChain = (id) => { chainId = Number(id); provider.emit("chainChanged", hexN(chainId)); };
  W.setAccounts = () => { throw new Error("the drive wallet holds one key"); };
  W.prompts = () => W.promptsLog.slice();
  W.sent = () => W.calls.filter((x) => x.method === "eth_sendTransaction").length;
  W.count = (method) => W.calls.filter((x) => x.method === method).length;
  W.firstIndex = (method) => W.calls.findIndex((x) => x.method === method);
  W.lastIndex = (method) => { for (let i = W.calls.length - 1; i >= 0; i--) if (W.calls[i].method === method) return i; return -1; };
  W.callsTo = (to, selector) => W.calls.filter((x) => x.method === "eth_call" && lower(x.params[0].to) === lower(to) && (!selector || lower(x.params[0].data).startsWith(lower(selector))));
  W.override = (method, fn) => { fn ? W.overrides.set(method, fn) : W.overrides.delete(method); };
  W.refuse = (method, err) => W.override(method, () => { throw err; });
  return W;
}

/*═══════════════════ the drive ═══════════════════*/

async function main() {
  const t = harness();
  const t0 = Date.now();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of [RECORD, JOURNAL]) if (fs.existsSync(f)) fs.unlinkSync(f);
  t.head("the node");
  let node = null;
  if (!arg("--rpc")) {
    node = child("hardhat", "npx", ["hardhat", "node", "--port", String(RPC_PORT), "--hostname", "127.0.0.1"]);
    console.log(`      npx hardhat node --port ${RPC_PORT} (pid ${node.pid})`);
  }
  const chainHex = await until(() => rpcRaw(RPC, "eth_chainId"), "the node at " + RPC, 90000);
  t.ok(chainHex === "0x7a69", `the node at ${RPC} answers chain 31337 (${chainHex})`);
  const deployerNonce = BigInt(await rpcRaw(RPC, "eth_getTransactionCount", [new RpcChain(RPC, DEV_KEYS[0], 31337).from.toString(), "pending"]));
  t.ok(deployerNonce === 0n, "the node is fresh: the deployer key is at nonce 0", String(deployerNonce));

  t.head("the deployment, journaled and recorded under " + OUT_DIR);
  const dep = child("deploy", process.execPath, ["tools/deploy.mjs", "--chain", "31337", "--confirm", "DEPLOY_INTACT_LOCAL", "--rpc", RPC, "--record", RECORD, "--journal", JOURNAL]);
  const code = await waitExit(dep);
  for (const l of dep.lines.filter((x) => /gas by step|total|recover-record|wrote|door|\x1b\[31m/.test(x))) console.log("      " + l.trim());
  t.ok(code === 0 && fs.existsSync(RECORD), `tools/deploy.mjs exits 0 and wrote the record (${((Date.now() - t0) / 1000).toFixed(0)} s so far)`, dep.lines.slice(-12).join("\n"));
  if (code !== 0) throw new Error("the deployment failed");
  const record = JSON.parse(fs.readFileSync(RECORD, "utf8"));
  t.ok(record.chainId === 31337 && record.recovered && record.recovered.checked > 300 && !record.engine.placeholder && fs.existsSync(JOURNAL) && !fs.existsSync(path.join(ROOT, "deployments/31337.journal.json")),
    `the record is chain 31337, recovered in-run (${record.recovered && record.recovered.checked} fields), the console not the placeholder, and nothing under deployments/ was touched`, JSON.stringify({ chainId: record.chainId, checked: record.recovered && record.recovered.checked, placeholder: record.engine && record.engine.placeholder }));

  t.head("the gateway");
  const gw = child("gateway", process.execPath, ["tools/gateway.mjs", "--record", RECORD, "--port", String(GW_PORT), "--host", "127.0.0.1"], { RPC_URL: RPC });
  const manifest = await until(async () => { const r = await fetch(GATEWAY + "/manifest"); return r.status === 200 ? r.json() : null; }, "the gateway at " + GATEWAY, 60000);
  const live = await fetch(GATEWAY + "/token/1/live");
  const panel = await fetch(GATEWAY + "/panel/swap.js", { headers: { "Accept-Encoding": "identity" } });
  t.ok(manifest.engineHash === record.engine.engineHash && live.status === 404 && /text\/html/.test(live.headers.get("content-type") || "") && panel.status === 200 && panel.headers.get("etag") === `"${record.engine.panelHashes.swap}"`,
    "the gateway serves /manifest with the record's engine hash, a 404 document for a token not yet minted, and the swap panel with its pin as the ETag", `manifest ${manifest.engineHash} live ${live.status} panel ${panel.status} etag ${panel.headers.get("etag")}`);

  t.head("the journey over the wire");
  const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
  const me = await RpcChain.open(RPC, DEV_KEYS[1]);
  const buyer = await me.as(DEV_KEYS[2]);
  const W = rpcWalletFor(me, { connected: false, name: "Drive Wallet" }), WB = rpcWalletFor(buyer, { name: "Buyer Wallet", rdns: "io.intact.buyer" });
  const browser = await openBrowser();
  console.log(`      Chromium ${browser.version()} at ${GATEWAY}`);
  const site = record.contracts;
  let ok = false;
  /* a wait that times out names where it was */
  setGroup("the journey over the wire");
  try {
    ok = await journey(t, {
      open: (o) => openPage(browser, { origin: GATEWAY, ...o }),
      c: me, buyerChain: buyer, site, W, WB,
      ME: me.from.toString(), BUYER: buyer.from.toString(), AGENT: "0x" + "77".repeat(20),
      mockERC20: artifact(out, "test/mocks/MockERC20.sol", "MockERC20").bytecode,
      now: async () => BigInt((await rpcRaw(RPC, "eth_getBlockByNumber", ["latest", false])).timestamp),
      chainId: 31337
    });
  } catch (e) { t.ok(false, `the journey threw: ${e && e.stack || e}`); }
  const receipts = [...W.receipts.values()];
  t.ok(receipts.length >= 11 && receipts.every((r) => r.status === "0x1") && receipts.every((r) => BigInt(r.blockNumber) > 0n), `every receipt came from the node with status 0x1 (${receipts.length} transactions, blocks ${receipts.map((r) => Number(r.blockNumber)).join(",")})`, receipts.map((r) => r.status + (r.revert ? " " + r.revert : "")).join(","));
  t.ok(W.calls.every((x) => x.method !== "eth_sendRawTransaction") && gw.exited == null && (node === null || node.exited == null), "the page never sent raw bytes itself, and the gateway and the node are still up", `gateway ${gw.exited} node ${node && node.exited}`);
  await browser.close();
  console.log(`\n  ${((Date.now() - t0) / 1000).toFixed(0)} s in all${KEEP ? ` — kept: node ${RPC}, gateway ${GATEWAY}, record ${RECORD}` : ""}`);
  console.log(`\n  ${t.pass} passed, ${t.fail} failed\n`);
  if (!KEEP) killAll();
  process.exit(t.fail || !ok ? 1 : 0);
}

main().catch((e) => { console.error(e && e.stack || e); for (const ch of children) console.error(`\n  [${ch.name}]\n` + ch.lines.slice(-20).join("\n")); console.log("\n  0 passed, 1 failed\n"); if (!KEEP) killAll(); process.exit(1); });
