#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the MCP bridge, driven against the in-process chain (U17)

  What is proved: a Node agent that holds nothing but services.json and an
  RPC drives a swap and a word through executeAsSession ("a Node agent
  drives swap and speak through executeAsSession using only services.json
  and an RPC"); the bridge refuses a catalogue whose keccak is not the hash
  the chain pins, or not the one the host reviewed ("a catalog whose hash
  drifted is refused" — INVARIANTS G2); propose is a read that never sends;
  act sends exactly one executeAsSession through the host's signer, and
  only what propose allowed; a key never crosses the bridge; an unlimited
  approval is never built; a deadline is the chain's clock; the stdio
  framing is JSON-RPC 2.0 by the line.

  The host here is tools/dom-shim.mjs's walletFor: an EIP-1193 provider
  answered from tools/evm.mjs's Chain, whose eth_sendTransaction signs with
  the actor's key on the host's side — the bridge sees an address and a
  `send`, never the key. The chain is deployed by tools/site.mjs with the
  AgentCard at its pin.

    node sdk/mcp.test.mjs          the last line is `  N passed, M failed`
───────────────────────────────────────────────────────────────────────────*/
import { PassThrough } from "node:stream";
import { compile, artifact } from "../tools/compile.mjs";
import * as EVM from "../tools/evm.mjs";
import { Chain, sel, encodeParams, decUint, decAddr, decBool } from "../tools/evm.mjs";
import { deploySite, getter, mint, ZERO } from "../tools/site.mjs";
import { walletFor } from "../tools/dom-shim.mjs";
import { createBridge, serve, kec, selector, DRIFT } from "./mcp.mjs";

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${String(detail).slice(0, 400)}`);
};
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const lower = (s) => String(s).toLowerCase();
const WAD = 10n ** 18n;
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)", SPEAK = "speak(uint256,uint256,uint8,uint64,uint64,bytes)", EAS = "executeAsSession(address,uint256,bytes)";
const GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";
const now = () => EVM.BLOCK.header.timestamp;
const hexOf = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
const rpcCall = (jsonrpc, id, method, params) => ({ jsonrpc, id, method, params });
const call = (bridge, id, name, args) => bridge.handle(rpcCall("2.0", id, "tools/call", { name, arguments: args }));
const text = (r) => r.result.content[0].text;

/*═══════════════════ the world ═══════════════════*/
head("the world: the site with its AgentCard, #1 with a market, a key on swap and speak");
const t0 = Date.now();
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const c = await Chain.open();
const site = await deploySite(c, out, { deployAgentCard: true });
const GET = getter(c, site.premises);
const A = (f, n) => artifact(out, f, n);
const ME = c.from.toString();
const agentW = await c.as("0x" + "77".repeat(32)), AGENT = agentW.from.toString();
const weth = await c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode, encodeParams("string,string,uint8,uint256,bool", ["Wrapped Ether", "WETH", 18, 0, false]), "WETH");
await mint(c, site, ME);
const hub = site.hub, pool = site.pool, parley = site.parley;
const reach1 = decAddr(await c.read(hub, "account(uint256)", [1]));
await c.exec(weth, "mint(address,uint256)", [ME, 1000n * WAD]);
await c.exec(weth, "approve(address,uint256)", [pool, 200n * WAD]);
await c.exec(pool, "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", [1, weth, ZERO, 30, 0, 0, 0], { label: "openMarket" });
await c.exec(pool, "deposit(uint256,uint256,uint256)", [1, 100n * WAD, 10n * WAD], { value: 10n * WAD, label: "deposit" });
await c.send({ to: reach1, value: 2n * WAD });
const EXPIRES = now() + 100n * 86400n;
await c.exec(reach1, GRANT, [AGENT, EXPIRES, WAD, [], [pool, parley], [sel(SWAP_IN), sel(SPEAK)], 0, 0], { label: "grantSession" });
console.log(`      world in ${((Date.now() - t0) / 1000).toFixed(1)}s · card ${site.agentCard} · key ${AGENT}`);

/* the host: an EIP-1193 provider answered from the chain, and a signer that signs on the host's side of the bridge */
const W = walletFor(c, agentW);
const rpc = (method, params) => W.provider.request({ method, params });
const signer = { address: AGENT, send: (tx) => rpc("eth_sendTransaction", [tx]) };
const bridge = createBridge({ rpc, catalog: site.catalog, signer });
ok(!("key" in signer) && Object.keys(signer).join() === "address,send" && !JSON.stringify(bridge).includes("77".repeat(32)), "the signer the host supplies is an address and a send; the bridge holds no key");

/*═══════════════════ the catalogue, held to its hash ═══════════════════*/
head("the catalogue, held to its hash");
const cat = await bridge.catalogue();
const svc = await GET(["services.json"]);
const onChain = (await c.read(site.catalog, "catalogHash()")).slice(0, 66);
ok(cat.hash === onChain && cat.hash === kec(svc.bodyBytes) && cat.doc.services.length > 100 && lower(cat.hub) === lower(hub),
  "the bridge's catalogue is /services.json byte for byte, its keccak is Catalog.catalogHash(), and it names the hub", `${cat.hash} vs ${onChain}`);
const init = await bridge.handle(rpcCall("2.0", 1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } }));
ok(init.result && init.result.protocolVersion === "2025-06-18" && init.result.serverInfo.name === "intact-mcp" && init.result.capabilities.tools && /services\.json/.test(init.result.instructions),
  "initialize answers the protocol version, the server, the tools capability and the rule in one sentence", JSON.stringify(init).slice(0, 200));
const list = await bridge.handle(rpcCall("2.0", 2, "tools/list", {}));
const tools = list.result.tools, names = tools.map((t) => t.name);
const writeRows = cat.doc.services.filter((r) => r.kind !== "read" && r.on !== "reach"), readRows = cat.doc.services.filter((r) => r.kind === "read");
ok(names.includes("intact_propose") && names.includes("intact_act") && names.includes("intact_clock") && names.includes("intact_read") && names.includes("intact_catalogue") &&
   names.filter((n) => n.startsWith("propose_")).length === writeRows.length && names.filter((n) => n.startsWith("act_")).length === writeRows.length && names.filter((n) => n.startsWith("read_")).length === readRows.length &&
   new Set(names).size === names.length && names.every((n) => /^[A-Za-z0-9_]{1,64}$/.test(n)) && !names.some((n) => /^(propose|act)_reach_/.test(n)),
  `tools/list is derived from services.json: propose and act, separately, for each of the ${writeRows.length} write rows a session may be sent to, a read tool per read row (${readRows.length}), the five generic tools, no Reach row, every name MCP-shaped`, names.length);
ok(tools.every((t) => t.inputSchema && t.inputSchema.type === "object" && Object.keys(t.inputSchema.properties).every((k) => !/key|secret|private|signature|mnemonic/i.test(k))) && tools.find((t) => t.name === "propose_pool_swapExactIn").inputSchema.properties.args.maxItems === 6,
  "every tool carries an input schema, none takes a key-shaped argument, and a row's args are counted from its signature");
ok((await bridge.handle(rpcCall("2.0", 3, "nothing/here", {}))).error.code === -32601 && (await bridge.handle({ id: 4, method: "ping" })).error.code === -32600 && (await bridge.handle(rpcCall("2.0", 5, "ping", {}))).result && (await bridge.handle(rpcCall("2.0", null, "notifications/initialized", {}))) === null,
  "an unknown method is -32601, a message that is not JSON-RPC 2.0 is -32600, ping answers, a notification is not answered");

/*═══════════════════ a catalogue whose hash drifted ═══════════════════*/
head("a catalogue whose hash drifted");
{
  const flip = (h) => { const i = 300; const ch = h[i] === "a" ? "b" : "a"; return h.slice(0, i) + ch + h.slice(i + 1); };
  const lying = async (method, params) => {
    const r = await rpc(method, params);
    if (method === "eth_call" && lower(params[0].to) === lower(site.catalog) && lower(params[0].data) === selector("services()")) return flip(r);
    return r;
  };
  const drifted = createBridge({ rpc: lying, catalog: site.catalog, signer });
  const l2 = await drifted.handle(rpcCall("2.0", 10, "tools/list", {}));
  const c2 = await call(drifted, 11, "intact_propose", { tokenId: "1", row: "parley.speak", args: ["0", "1", "0", "0", "0", hexOf("x")] });
  const calls0 = W.count("eth_call"), sent0 = W.sent();
  let direct = null; try { await drifted.catalogue(); } catch (e) { direct = String(e.message); }
  ok(l2.error && l2.error.code === -32000 && l2.error.message.startsWith(DRIFT) && /the chain pins 0x[0-9a-f]{64}, the bytes served hash to 0x[0-9a-f]{64}/.test(l2.error.message) &&
     c2.result.isError === true && text(c2).startsWith(DRIFT) && direct !== null && direct.startsWith(DRIFT) && W.sent() === sent0 && W.count("eth_call") === calls0 + 2,
    "a catalog whose hash drifted is refused", `list ${JSON.stringify(l2.error)} call ${text(c2).slice(0, 120)}`);
  /* the chain itself answering another hash: refused the same way — the bytes and the pin must agree */
  const lyingPin = async (method, params) => {
    const r = await rpc(method, params);
    if (method === "eth_call" && lower(params[0].to) === lower(site.catalog) && lower(params[0].data) === selector("catalogHash()")) return "0x" + "11".repeat(32);
    return r;
  };
  let e2 = null; try { await createBridge({ rpc: lyingPin, catalog: site.catalog, signer }).tools(); } catch (e) { e2 = String(e.message); }
  ok(e2 !== null && e2.startsWith(DRIFT) && e2.includes("0x" + "11".repeat(32)), "a chain whose catalogHash() names other bytes than it serves is refused too", e2);
  /* the host reviewed another hash: refused, naming both */
  let e3 = null; try { await createBridge({ rpc, catalog: site.catalog, signer, pinnedHash: "0x" + "22".repeat(32) }).tools(); } catch (e) { e3 = String(e.message); }
  ok(e3 !== null && e3.startsWith(DRIFT) && /the host reviewed 0x22+, the chain pins 0x[0-9a-f]{64}/.test(e3), "a catalogue that is not the one the host reviewed (pinnedHash) is refused, naming both hashes", e3);
  const pinned = createBridge({ rpc, catalog: site.catalog, signer, pinnedHash: onChain });
  ok((await pinned.tools()).length === tools.length, "the reviewed hash admits the catalogue it names");
}

/*═══════════════════ propose, then act: the swap ═══════════════════*/
head("a Node agent drives swap and speak through executeAsSession");
let drove = true;
const d = (cond, name, x) => { ok(cond, name, x); drove = drove && !!cond; };
const clock = await bridge.invoke("intact_clock");
d(BigInt(clock.timestamp) === now() && BigInt(clock.number) === EVM.BLOCK.header.number, "intact_clock is the chain's clock: the latest block's timestamp and number", JSON.stringify(clock));
const deadline = String(BigInt(clock.timestamp) + 600n);
const swap = { tokenId: "1", row: "pool.swapExactIn", args: ["1", "false", String(WAD / 10n), "0", reach1, deadline], value: String(WAD / 10n) };
const calls1 = W.calls.length;
const q = JSON.parse(text(await call(bridge, 20, "intact_propose", swap)));
const seq1 = W.calls.slice(calls1), iAllows = seq1.findIndex((x) => x.method === "eth_call" && lower(x.params[0].to) === lower(reach1) && lower(x.params[0].data).startsWith(sel("sessionAllows(address,address,bytes4)"))),
      iSim = seq1.findIndex((x) => x.method === "eth_call" && lower(x.params[0].to) === lower(reach1) && lower(x.params[0].data).startsWith(sel(EAS)));
d(q.allowed === true && q.simulation.ok === true && lower(q.key) === lower(AGENT) && lower(q.reach) === lower(reach1) && lower(q.target) === lower(pool) && q.selector === sel(SWAP_IN) && q.calldata.startsWith(sel(EAS)) && q.catalogHash === onChain &&
  iAllows >= 0 && iSim > iAllows && lower(seq1[iSim].params[0].from) === lower(AGENT) && W.sent() === 0 && /allowed by the grant; the call simulates/.test(q.sentence),
  "propose reads sessionAllows(key, pool, swapExactIn) on the Reach, then simulates the very executeAsSession from the key, and sends nothing", JSON.stringify(q).slice(0, 300));
const wethBefore = decUint(await c.read(weth, "balanceOf(address)", [reach1]));
const r = JSON.parse(text(await call(bridge, 21, "intact_act", swap)));
const rc = W.receipts.get(r.hash);
const acted = c.getLogs({ address: reach1, topics: [kec("SessionActed(address,address,uint256,bytes4)")] });
const wethAfter = decUint(await c.read(weth, "balanceOf(address)", [reach1]));
const sent = W.calls.filter((x) => x.method === "eth_sendTransaction");
d(W.sent() === 1 && rc && rc.status === "0x1" && lower(sent[0].params[0].from) === lower(AGENT) && lower(sent[0].params[0].to) === lower(reach1) && sent[0].params[0].data === q.calldata && BigInt(sent[0].params[0].value || 0) === 0n &&
  wethAfter > wethBefore && acted.length === 1 && lower("0x" + acted[0].topics[1].slice(26)) === lower(AGENT) && decUint(await c.read(reach1, "sessionOf(address)", [AGENT]), 4) === WAD / 10n,
  "act sends exactly one executeAsSession from the key to the Reach — the calldata propose showed, no wallet value — and the Reach's WETH rose; the native cap was charged 0.1 ETH", `sent ${W.sent()} status ${rc && rc.status} weth ${wethBefore} → ${wethAfter}`);
/* the word, through the per-row tool the catalogue derived */
const s = JSON.parse(text(await call(bridge, 22, "act_parley_speak", { tokenId: "1", args: ["0", "1", "0", "0", "0", hexOf("hello from a bridge")] })));
const said = c.getLogs({ address: parley, topics: [kec("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)")] });
d(W.sent() === 2 && W.receipts.get(s.hash).status === "0x1" && said.length === 1 && s.row === "parley.speak", "act_parley_speak — a tool derived from the row — lands one word in the commons through executeAsSession", `sent ${W.sent()} said ${said.length}`);
ok(drove, "a Node agent drives swap and speak through executeAsSession using only services.json and an RPC");

/*═══════════════════ what is refused before any send ═══════════════════*/
head("refusals, each before any send");
{
  const sent2 = W.sent();
  const nope = JSON.parse(text(await call(bridge, 30, "intact_propose", { tokenId: "1", row: "pool.withdraw", args: ["1", "1", "1", AGENT] })));
  const nopeAct = await call(bridge, 31, "intact_act", { tokenId: "1", row: "pool.withdraw", args: ["1", "1", "1", AGENT] });
  ok(nope.allowed === false && nope.simulation === null && /^not allowed by the grant: pool\.withdraw/.test(nope.sentence) && nopeAct.result.isError && /not allowed by the grant/.test(text(nopeAct)) && W.sent() === sent2,
    "a row the grant does not list: propose reads not allowed and skips the simulation; act is refused and sends nothing", `${nope.sentence} / ${text(nopeAct)}`);
  const late = JSON.parse(text(await call(bridge, 32, "intact_propose", { ...swap, args: swap.args.slice(0, 5).concat(["1"]) })));
  const lateAct = await call(bridge, 33, "intact_act", { ...swap, args: swap.args.slice(0, 5).concat(["1"]) });
  ok(late.allowed === true && late.simulation.ok === false && /^[A-Za-z]+\(/.test(late.simulation.revert) && /would revert: [A-Za-z]+\(/.test(late.sentence) && lateAct.result.isError && /nothing is sent/.test(text(lateAct)) && W.sent() === sent2,
    "an allowed call that would revert is told so by the error's name from the catalogue, and act sends nothing", `${late.sentence} / ${text(lateAct)}`);
  const calls3 = W.count("eth_call");
  const keyed = await call(bridge, 34, "intact_propose", { ...swap, privateKey: "0x" + "77".repeat(32) });
  const keyed2 = await call(bridge, 35, "act_parley_speak", { tokenId: "1", args: ["0", "1", "0", "0", "0", "0x00"], sessionKey: "0x" + "77".repeat(32) });
  const keyed3 = await call(bridge, 36, "intact_read", { row: "hub.statusOf", args: ["1"], walletToken: "abc" });
  ok(keyed.result.isError && /never takes a wallet token or a session key through a tool argument \(privateKey\)/.test(text(keyed)) && keyed2.result.isError && /\(sessionKey\)/.test(text(keyed2)) && keyed3.result.isError && /\(walletToken\)/.test(text(keyed3)) && W.count("eth_call") === calls3 && W.sent() === sent2,
    "a key-shaped argument — privateKey, sessionKey, walletToken — is refused before anything is read; the bridge never passes one through", text(keyed));
  let built = null; try { await createBridge({ rpc, catalog: site.catalog, signer, privateKey: "0x" + "77".repeat(32) }); } catch (e) { built = String(e.message); }
  ok(built !== null && /never holds a key/.test(built), "a bridge constructed with a key refuses to exist", built);
  const calls4 = W.callsTo(reach1).length;
  const unl = await call(bridge, 37, "intact_propose", { tokenId: "1", row: "erc20.approve", to: weth, args: [pool, String(1n << 255n)] });
  const unl2 = await call(bridge, 38, "intact_propose", { tokenId: "1", row: "erc20.approve", to: weth, args: [pool, "115792089237316195423570985008687907853269984665640564039457584007913129639935"] });
  ok(unl.result.isError && text(unl) === "unlimited approvals are never built here" && unl2.result.isError && text(unl2) === "unlimited approvals are never built here" && W.callsTo(reach1).length === calls4,
    "an approval of 2^255 or more is never built, not even proposed: refused before the Reach is asked anything", text(unl));
  const exact = JSON.parse(text(await call(bridge, 39, "intact_propose", { tokenId: "1", row: "erc20.approve", to: weth, args: [pool, "1"] })));
  ok(exact.allowed === false && lower(exact.target) === lower(weth) && exact.selector === selector("approve(address,uint256)"), "an exact approval is built and read against the grant like any other row (WETH is not on this key's list: not allowed)", exact.sentence);
  const self = await call(bridge, 40, "intact_propose", { tokenId: "1", row: "reach.seal", args: ["1"] });
  const rd = await call(bridge, 41, "intact_propose", { tokenId: "1", row: "pool.quote", args: ["1", "true", "1"] });
  const none = await call(bridge, 42, "intact_propose", { tokenId: "1", row: "pool.nothing", args: [] });
  ok(self.result.isError && /cannot call the Reach itself/.test(text(self)) && rd.result.isError && /is a read row/.test(text(rd)) && none.result.isError && /no row pool\.nothing/.test(text(none)), "the Reach's own rows, a read row and an unknown row are each refused by name", text(self));
  const unsigned = createBridge({ rpc, catalog: site.catalog });
  const us = await call(unsigned, 43, "intact_propose", swap);
  ok(us.result.isError && /no signer: the host supplies \{address, send\(tx\)\}; the bridge never takes a key/.test(text(us)), "a bridge with no signer can list and read, and says who supplies one when asked to propose", text(us));
  const coin = await call(bridge, 44, "intact_propose", { tokenId: "1", row: "coin.redeem", args: ["1"] });
  ok(coin.result.isError && /its contract is per asset; name the target/.test(text(coin)), "a per-asset row without a target is refused by name", text(coin));
}

/*═══════════════════ reads ═══════════════════*/
head("reads");
{
  const so = JSON.parse(text(await call(bridge, 50, "read_reach_sessionOf", { to: reach1, args: [AGENT] })));
  const st = JSON.parse(text(await call(bridge, 51, "intact_read", { row: "hub.statusOf", args: ["1"] })));
  const al = JSON.parse(text(await call(bridge, 52, "read_reach_sessionAllows", { to: reach1, args: [AGENT, pool, sel(SWAP_IN)] })));
  ok(so.words.length === 14 && so.words[13] === "1" && BigInt(so.words[1]) === EXPIRES && so.words[4] === String(WAD / 10n) && st.words[0] === "0" && al.words[0] === "1",
    "read_reach_sessionOf (a per-token row, with a target) answers the fourteen words; hub.statusOf reads Active; sessionAllows reads 1", JSON.stringify(so.words));
  const bad = await call(bridge, 53, "read_hub_statusOf", { args: [] });
  ok(bad.result.isError && /1 argument\(s\) expected, 0 given/.test(text(bad)), "a read with the wrong number of arguments is refused by count", text(bad));
  const catI = JSON.parse(text(await call(bridge, 54, "intact_catalogue", {})));
  ok(catI.catalogHash === onChain && catI.rows === cat.doc.services.length && lower(catI.hub) === lower(hub) && catI.door === "/token/<id>/live?as=<key>", "intact_catalogue names the hash, the row count, the hub and the door", JSON.stringify(catI));
}

/*═══════════════════ over stdio ═══════════════════*/
head("over stdio");
{
  const input = new PassThrough(), output = new PassThrough();
  let buf = ""; output.on("data", (x) => { buf += x; });
  const done = serve(bridge, { input, output });
  input.write(JSON.stringify(rpcCall("2.0", 70, "initialize", {})) + "\n" + JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n" +
    JSON.stringify(rpcCall("2.0", 71, "tools/call", { name: "intact_clock", arguments: {} })) + "\n\nnot json\n" + JSON.stringify(rpcCall("2.0", 72, "tools/call", { name: "intact_propose", arguments: swap })) + "\n");
  input.end();
  await done;
  const lines = buf.trim().split("\n").map((l) => JSON.parse(l));
  ok(lines.length === 4 && lines[0].id === 70 && lines[0].result.protocolVersion === "2025-06-18" && lines[1].id === 71 && lines[1].result.content[0].type === "text" && lines[2].error.code === -32700 && lines[3].id === 72 && JSON.parse(lines[3].result.content[0].text).allowed === true,
    "over stdio the bridge answers newline-delimited JSON-RPC 2.0 in order: initialize, a tool call, a parse error as one, a propose; the notification is not answered", buf.slice(0, 200));
  ok(W.sent() === 2, "nothing over stdio sent a transaction: two sends in the whole run, both acts", W.sent());
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
