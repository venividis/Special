#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the Bazaar against the real Seaport, on a fork of Base Sepolia
  (V2, unit W3; docs/V2.md §3.3)

  Two modes, both over a wire, so neither is a step of `npm run check`:

    node tools/verify-bazaar-fork.mjs --probe
        Seaport 1.6, its ConduitController and OpenSea's conduit, read from
        the chain at one pinned block (the endpoint from RPC_URL_84532, or
        RPC_URL): code and codehash at each address, Seaport's
        `information()` and `name()`, the conduit the controller names for
        OpenSea's key, its owner and whether Seaport's channel is open.
        Writes tools/fixtures/seaport-1.6/ — the two runtimes the in-process
        verifier etches, and probe.json, the evidence. Nothing in the record
        is typed by hand: every value is what the chain answered.

    node tools/verify-bazaar-fork.mjs
        A hardhat fork of Base Sepolia (FORK_URL, else RPC_URL_84532, else
        RPC_URL; hardhat.fork.config.cjs, cancun) spawned on port 8549, one
        local block mined before anything is read (a fork runs nothing at
        the fork block itself, as tools/testnet.mjs knows), the probe
        re-proved against the fork's state, then an INTACT-shaped hub (the
        forge suite's mock, whose fingerprint hashes the real hub's terms)
        with its Reach and Pool, and the Bazaar, deployed there, and orders
        filled against the REAL Seaport and OpenSea's REAL conduit:
          · an INTACT-zoned listing in ether through OpenSea's conduit,
            with an OpenSea-style fee item, signed with EIP-712 by the
            seller's key, published through the Bazaar, found from its log
            and filled — and the same shape refused after the transfers
            when the seller, a contract paid inside the fill, makes its
            Reach act from its own receive();
          · an OpenSea-shaped order on a plain NFT — OpenSea's conduit key,
            the fee item, no zone — published and filled;
          · the seller raises its counter (Seaport 1.6 adds the previous
            block hash's high half, which the in-process chain does not
            have), and an order signed at the new counter is published
            under the hash Seaport validated at it.
        The node is killed on exit, also on failure. Nothing is written: a
        fork is nobody's chain.

  The last line is "  N passed, M failed"; the exit code follows it.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { RpcChain, DEV_KEYS } from "./rpc.mjs";
import { enc, sel, encodeParams, decString, decUint, decAddr, decBool } from "./evm.mjs";
import {
  FIXTURE_DIR, SEAPORT, CONDUIT_CONTROLLER, OPENSEA_CONDUIT_KEY, OPENSEA_CONDUIT, ZERO, ZERO32, ITEM, KIND, SIG, TOPIC,
  loadFixture, orderHashOf, componentsOf, orderOf, signOrder, domainSeparatorOf, pinHashOf, decodePublished,
  etherListing, kecHex, low, word32, FLOORS_T
} from "./verify-bazaar.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CHAIN = 84532;
const PROBED_ON = "2026-10-19";
const PORT = 8549;
const ETH = 10n ** 18n;
const DAY = 86_400n;

const word = (hex, i) => "0x" + String(hex).replace(/^0x/, "").slice(i * 64, i * 64 + 64);
const addrAt = (hex, i) => "0x" + word(hex, i).slice(26);

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${String(detail).slice(0, 600)}`);
  return Boolean(cond);
};
const eq = (got, want, name) => ok(String(got) === String(want), name, `got  ${got}\n      want ${want}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const note = (s) => console.log(`      ${s}`);

/*═══════════════════ the reads both modes make ═══════════════════*/

/// Every read of the record at one block tag: the same function proves a
/// fresh probe and re-proves the stored one against a fork.
async function readRecord(rpc, tag) {
  const code = (a) => rpc("eth_getCode", [a, tag]);
  const call = (to, data) => rpc("eth_call", [{ to, data }, tag]);
  const info = await call(SEAPORT, enc("information()", []));
  const got = await call(CONDUIT_CONTROLLER, enc("getConduit(bytes32)", [OPENSEA_CONDUIT_KEY]));
  const open = await call(CONDUIT_CONTROLLER, enc("getChannelStatus(address,address)", [OPENSEA_CONDUIT, SEAPORT]));
  const owner = await call(CONDUIT_CONTROLLER, enc("ownerOf(address)", [OPENSEA_CONDUIT]));
  const channels = await call(CONDUIT_CONTROLLER, enc("getTotalChannels(address)", [OPENSEA_CONDUIT]));
  const hashes = await call(CONDUIT_CONTROLLER, enc("getConduitCodeHashes()", []));
  return {
    seaportCode: await code(SEAPORT), controllerCode: await code(CONDUIT_CONTROLLER), conduitCode: await code(OPENSEA_CONDUIT),
    version: decString(info), domainSeparator: word(info, 1), infoController: addrAt(info, 2),
    name: decString(await call(SEAPORT, enc("name()", []))),
    conduitOfKey: addrAt(got, 0), conduitExists: BigInt(word(got, 1)) === 1n,
    seaportChannelOpen: BigInt(open) === 1n, conduitOwner: addrAt(owner, 0), totalChannels: Number(BigInt(channels)),
    conduitCreationCodeHash: word(hashes, 0), conduitRuntimeCodeHash: word(hashes, 1)
  };
}

/// The claims a record makes, as sentences: against the addresses for a
/// fresh probe, and against the stored probe for a fork.
function claims(r, want) {
  const sea = r.seaportCode !== "0x" ? kecHex(r.seaportCode) : null;
  const con = r.controllerCode !== "0x" ? kecHex(r.controllerCode) : null;
  const cdt = r.conduitCode !== "0x" ? kecHex(r.conduitCode) : null;
  ok(sea && (!want || low(sea) === low(want.codehash)), `Seaport has code at ${SEAPORT}${want ? " — the code probed on " + want.probed + " at block " + want.block : ""}`, `codehash ${sea}`);
  ok(r.version === "1.6", "Seaport's information() says version 1.6", r.version);
  ok(r.name === "Seaport", "Seaport's name() is \"Seaport\"", r.name);
  ok(low(r.infoController) === low(CONDUIT_CONTROLLER), "Seaport's information() names this ConduitController", r.infoController);
  if (want) ok(low(r.domainSeparator) === low(want.domainSeparator), "Seaport's domain separator is the one probed", r.domainSeparator);
  ok(con && (!want || low(con) === low(want.conduitController.codehash)), `the ConduitController has code at ${CONDUIT_CONTROLLER}${want ? " — the code probed" : ""}`, `codehash ${con}`);
  ok(low(r.conduitOfKey) === low(OPENSEA_CONDUIT) && r.conduitExists, "the controller names OpenSea's conduit for OpenSea's conduit key", `${r.conduitOfKey} exists=${r.conduitExists}`);
  ok(cdt && low(cdt) === low(r.conduitRuntimeCodeHash), "the conduit's code is the controller's conduit runtime", `codehash ${cdt}, controller says ${r.conduitRuntimeCodeHash}`);
  ok(r.seaportChannelOpen, "Seaport 1.6 holds an open channel on OpenSea's conduit");
  return { sea, con, cdt };
}

/*═══════════════════ --probe ═══════════════════*/

async function probe(url) {
  head(`probe · Seaport 1.6 on chain ${CHAIN}`);
  const c = new RpcChain(url, DEV_KEYS[0], CHAIN);
  const chainId = Number(await c.rpc("eth_chainId"));
  if (!ok(chainId === CHAIN, `the endpoint is chain ${CHAIN}`, `it says ${chainId}`)) return;
  // a few blocks behind the head, so every replica behind the balancer holds it
  const block = BigInt(await c.rpc("eth_blockNumber")) - 5n;
  const tag = "0x" + block.toString(16);
  const blk = await c.rpc("eth_getBlockByNumber", [tag, false]);
  note(`every read pinned to block ${block} (${blk.hash}), timestamp ${BigInt(blk.timestamp)}`);
  const r = await readRecord((m, p) => c.rpc(m, p), tag);
  const before = fail;
  const { sea, con, cdt } = claims(r, null);
  ok(low(r.domainSeparator) === low(domainSeparatorOf(chainId)), "its domain separator is EIP712Domain(\"Seaport\", \"1.6\", 84532, its address)", r.domainSeparator);
  if (fail !== before) { note("a claim failed: nothing written"); return; }
  const record = {
    probed: PROBED_ON,
    chainId, block: Number(block), blockHash: blk.hash, blockTimestamp: Number(BigInt(blk.timestamp)),
    address: SEAPORT, codehash: sea, bytes: (r.seaportCode.length - 2) / 2,
    version: r.version, name: r.name, domainSeparator: r.domainSeparator,
    conduitController: { address: CONDUIT_CONTROLLER, codehash: con, bytes: (r.controllerCode.length - 2) / 2,
                         conduitCreationCodeHash: r.conduitCreationCodeHash, conduitRuntimeCodeHash: r.conduitRuntimeCodeHash },
    opensea: { conduitKey: OPENSEA_CONDUIT_KEY, conduit: OPENSEA_CONDUIT, codehash: cdt, bytes: (r.conduitCode.length - 2) / 2,
               owner: r.conduitOwner, totalChannels: r.totalChannels, seaportChannelOpen: r.seaportChannelOpen },
    how: "node tools/verify-bazaar-fork.mjs --probe: eth_getCode and eth_call at the pinned block; the runtimes beside this file are the bytes eth_getCode returned"
  };
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIXTURE_DIR, "seaport.runtime.hex"), r.seaportCode + "\n");
  fs.writeFileSync(path.join(FIXTURE_DIR, "conduit-controller.runtime.hex"), r.controllerCode + "\n");
  fs.writeFileSync(path.join(FIXTURE_DIR, "probe.json"), JSON.stringify(record, null, 2) + "\n");
  const back = loadFixture();
  ok(back.seaportMatches && back.controllerMatches, "the written runtimes hash to the codehashes the record names");
  note(`wrote ${path.relative(ROOT, FIXTURE_DIR)}/ (probe.json, seaport.runtime.hex ${record.bytes} B, conduit-controller.runtime.hex ${record.conduitController.bytes} B)`);
}

/*═══════════════════ the fork ═══════════════════*/

const children = [];
function child(cmd, args, env) {
  const ch = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  ch.lines = [];
  const take = (d) => { for (const l of String(d).split("\n")) if (l.trim()) { ch.lines.push(l); if (ch.lines.length > 300) ch.lines.shift(); } };
  ch.stdout.on("data", take); ch.stderr.on("data", take);
  ch.on("exit", (code) => { ch.exited = code; });
  children.push(ch);
  return ch;
}
const killAll = () => { for (const ch of children) { if (ch.exited != null) continue; try { process.kill(-ch.pid, "SIGTERM"); } catch { /* gone */ } } };
process.on("exit", killAll);
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { killAll(); process.exit(130); });
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

/// A refusal over the wire: eth_call reverts, and the node hands back the data.
async function refusalOf(c, to, data, value, from) {
  try {
    await c.rpc("eth_call", [{ from, to, data, value: "0x" + BigInt(value).toString(16) }, await c.tag()]);
    return { ok: true, data: "0x" };
  } catch (e) {
    const d = typeof e.data === "string" ? e.data : (e.data && e.data.data) || "";
    return { ok: false, data: low(d) };
  }
}

async function fork(url) {
  const fx = loadFixture();
  ok(fx.seaportMatches && fx.controllerMatches, `the fixture's runtimes hash to the codehashes probed at block ${fx.probe.block}`);

  head(`the node: a hardhat fork of chain ${CHAIN} on 127.0.0.1:${PORT}`);
  const node = child("npx", ["hardhat", "--config", "hardhat.fork.config.cjs", "node", "--port", String(PORT), "--hostname", "127.0.0.1"],
                     { FORK_URL: url, FORK_CHAIN_ID: String(CHAIN) });
  const RPC = `http://127.0.0.1:${PORT}`;
  // a fresh key for this run, funded by the node: a fork is nobody's chain
  const key = "0x" + Buffer.from(keccak256(Buffer.from(`intact.w3.fork:${Date.now()}:${Math.random()}`))).toString("hex");
  let c = null;
  for (let i = 0; i < 240 && !c; i++) {
    if (node.exited != null) throw new Error("hardhat exited: " + node.lines.slice(-8).join(" | "));
    try { c = await RpcChain.open(RPC, key); } catch { await nap(500); }
  }
  if (!c) throw new Error("the fork never answered: " + node.lines.slice(-8).join(" | "));
  ok(c.chainId === CHAIN, `the fork says it is chain ${CHAIN}`, c.chainId);
  const meta = await c.rpc("hardhat_metadata", []);
  const forkBlock = meta.forkedNetwork ? BigInt(meta.forkedNetwork.forkBlockNumber) : null;
  ok(forkBlock !== null, `the node forked Base Sepolia at block ${forkBlock}`);
  await c.rpc("evm_mine", []);                     // nothing runs at the fork block itself
  const fund = (a, wei) => c.rpc("hardhat_setBalance", [a, "0x" + BigInt(wei).toString(16)]);
  await fund(c.from.toString(), 100n * ETH);

  head("the probe, re-proved on the fork");
  claims(await readRecord((m, p) => c.rpc(m, p), "latest"), fx.probe);
  const domain = word(await c.call(SEAPORT, enc("information()", [])), 1);

  head("an INTACT-shaped hub, its Pool, the Bazaar");
  const { compile, artifact } = await import("./compile.mjs");
  const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
  const A = (f, n) => artifact(out, f, n);
  const F = "test/mocks/BazaarFixtures.sol";
  const pool = await c.deploy(A(F, "BazaarPool").bytecode, "", "BazaarPool");
  const hub = await c.deploy(A(F, "BazaarHub").bytecode, encodeParams("address", [pool]), "BazaarHub");
  const bazaar = await c.deploy(A("src/Bazaar.sol", "Bazaar").bytecode, encodeParams("address,address,address", [SEAPORT, hub, pool]), "Bazaar");
  ok((await c.codeSize(bazaar)) > 0, `deployed on the fork: the hub ${hub}, the Pool ${pool}, the Bazaar ${bazaar}`);
  const receiver = "0x0000000000000000000000000000000000002071";
  const feeTo = "0x0000000000000000000000000000000000000fee";       // a stand-in for OpenSea's fee recipient
  await c.exec(hub, "setRoyalty(address,uint16)", [receiver, 500]);

  const seller = await c.as("0x" + Buffer.from(keccak256(Buffer.from("intact.w3.fork.seller"))).toString("hex"));
  const buyer = await c.as("0x" + Buffer.from(keccak256(Buffer.from("intact.w3.fork.buyer"))).toString("hex"));
  for (const who of [seller, buyer]) await fund(who.from.toString(), 50n * ETH);
  const S = seller.from.toString(), B = buyer.from.toString();
  const latest = await c.rpc("eth_getBlockByNumber", ["latest", false]);
  const now = BigInt(latest.timestamp);
  const end = now + 30n * DAY;
  const TRANSFER = "0x" + Buffer.from(keccak256(Buffer.from("Transfer(address,address,uint256)"))).toString("hex");
  const mintTo = async (to) => {
    const r = await c.exec(hub, "mint(address)", [to]);
    const log = r.logs.find((l) => low(l.topics[0]) === low(TRANSFER) && low(l.address) === low(hub));
    return BigInt(log.topics[3]);
  };
  const ownerOf = async (id) => low(decAddr(await c.call(hub, enc("ownerOf(uint256)", [id]))));
  const PRICE = ETH / 10n, ROY = PRICE * 500n / 10_000n, FEE = PRICE * 250n / 10_000n;
  const withFee = (o) => {
    o.consideration[0].start -= FEE; o.consideration[0].end -= FEE;
    o.consideration.push({ itemType: ITEM.NATIVE, token: ZERO, id: 0n, start: FEE, end: FEE, recipient: feeTo });
    return o;
  };
  const sign = async (who, o) => {
    const counter = decUint(await c.call(SEAPORT, enc("getCounter(address)", [o.offerer])));
    const h = orderHashOf(o, counter);
    const theirs = await c.call(SEAPORT, enc(SIG.getOrderHash, [componentsOf(o, counter)]));
    return { o, hash: h, same: low(theirs) === low(h), sig: signOrder(who.key, domain, h) };
  };

  /*──────── an INTACT listing through OpenSea's conduit ────────*/
  head("an INTACT listing in ether through OpenSea's real conduit");
  const id = await mintTo(S);
  const reach = decAddr(await c.call(hub, enc("account(uint256)", [id])));
  await seller.exec(reach, "seal(uint64)", [end]);
  await seller.exec(hub, "setApprovalForAll(address,bool)", [OPENSEA_CONDUIT, true]);
  const fp = await c.call(hub, enc("getStateFingerprint(uint256)", [id]));
  const zh = pinHashOf(bazaar, id, fp, []);
  eq(low(await c.call(bazaar, enc(`pinHash(uint256,bytes32,${FLOORS_T})`, [id, fp, []]))), low(zh), "the zone hash computed here is the Bazaar's pinHash");
  const oA = withFee(etherListing({ token: hub, id, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: zh,
                                    start: now - 60n, end, conduitKey: OPENSEA_CONDUIT_KEY }));
  const sA = await sign(seller, oA);
  ok(sA.same, "the EIP-712 order hash computed here is the fork's Seaport getOrderHash");
  const pub = await c.send({ to: bazaar, data: enc(SIG.publish, [orderOf(oA, sA.sig), []]), label: "publish" });
  const logs = await c.getLogs({ address: bazaar, fromBlock: "0x" + pub.block.toString(16), toBlock: "0x" + pub.block.toString(16),
                                 topics: [TOPIC.published, word32(hub), word32(id)] });
  ok(logs.length === 1 && low(decodePublished(logs[0]).orderHash) === low(sA.hash),
     "the listing is published through the Bazaar, validated on the real Seaport, and found by eth_getLogs on (hub, id)");
  const s0 = await c.balanceOf(S), r0 = await c.balanceOf(receiver), f0 = await c.balanceOf(feeTo);
  const fill = await buyer.send({ to: SEAPORT, data: enc(SIG.fulfillOrder, [orderOf(oA, sA.sig), OPENSEA_CONDUIT_KEY]), value: PRICE, label: "fill" });
  ok(fill.logs.some((l) => low(l.topics[0]) === low(TOPIC.orderFulfilled) && low(l.address) === low(SEAPORT)), "the real Seaport fills it");
  eq(await ownerOf(id), low(B), "OpenSea's conduit moved the INTACT token to the buyer, after the zone admitted the order");
  eq(await c.balanceOf(S) - s0, PRICE - ROY - FEE, "the seller is paid the price less the royalty and the fee");
  eq(await c.balanceOf(receiver) - r0, ROY, "the royalty receiver is paid 5 % of the price");
  eq(await c.balanceOf(feeTo) - f0, FEE, "the fee recipient is paid its 2.5 % item");
  note(`gas on the fork: publish ${pub.gas}, fill through OpenSea's conduit ${fill.gas}`);

  /*──────── the window, on the real conduit ────────*/
  head("a contract seller acting inside the fill, refused after the transfers");
  const sellerC = await c.deploy(A(F, "BazaarSeller").bytecode, "", "BazaarSeller");
  const coin = await c.deploy(A(F, "BazaarToken").bytecode, "", "BazaarToken");
  const idW = await mintTo(sellerC);
  const reachW = decAddr(await c.call(hub, enc("account(uint256)", [idW])));
  const run = (to, data) => c.exec(sellerC, "run(address,uint256,bytes)", [to, 0, data]);
  await run(reachW, enc("seal(uint64)", [end]));
  await run(hub, enc("setApprovalForAll(address,bool)", [OPENSEA_CONDUIT, true]));
  await c.exec(coin, "mint(address,uint256)", [reachW, 10n * ETH]);
  const fpW = await c.call(hub, enc("getStateFingerprint(uint256)", [idW]));
  const oW = withFee(etherListing({ token: hub, id: idW, seller: sellerC, price: PRICE, royalty: ROY, receiver, zone: bazaar,
                                    zoneHash: pinHashOf(bazaar, idW, fpW, []), start: now - 60n, end, salt: 2n, conduitKey: OPENSEA_CONDUIT_KEY }));
  await run(SEAPORT, enc(SIG.validate, [[orderOf(oW)]]));
  await c.send({ to: bazaar, data: enc(SIG.publish, [orderOf(oW), []]) });
  ok(true, "a contract seller validates its own order on the real Seaport and the Bazaar publishes it with no signature");
  await c.exec(sellerC, "arm(address,bytes)", [reachW, enc("execute(address,uint256,bytes)", [coin, 0, enc("approve(address,uint256)", ["0x000000000000000000000000000000000000bad1", 5n * ETH])])]);
  const refused = await refusalOf(c, SEAPORT, enc(SIG.fulfillOrder, [orderOf(oW), OPENSEA_CONDUIT_KEY]), PRICE, B);
  const fm = sel("FingerprintMoved(bytes32,bytes32)");
  ok(!refused.ok && refused.data.startsWith(fm) && refused.data.slice(10, 74) === low(fpW).slice(2),
     "paid in ether before OpenSea's conduit moves the token, the seller makes its Reach approve a stranger — and validateOrder refuses the fill with FingerprintMoved", refused.data);
  await c.exec(sellerC, "arm(address,bytes)", ["0x000000000000000000000000000000000000d1e5", "0x"]);
  const fillW = await buyer.send({ to: SEAPORT, data: enc(SIG.fulfillOrder, [orderOf(oW), OPENSEA_CONDUIT_KEY]), value: PRICE, label: "fill (window, nothing done)" });
  eq(await ownerOf(idW), low(B), "the same fill, with nothing done inside it, lands through OpenSea's conduit");
  ok(decBool(await c.call(sellerC, enc("attempted()", []))), "and the seller was called while the fill was under way");
  note(`gas on the fork: fill through OpenSea's conduit with a contract seller ${fillW.gas}`);

  /*──────── an OpenSea-shaped order, no zone ────────*/
  head("an OpenSea-shaped order on a plain NFT: OpenSea's conduit key, a fee item, no zone");
  const art = await c.deploy(A(F, "BazaarNFT").bytecode, "", "BazaarNFT");
  await c.exec(art, "mint(address,uint256)", [S, 1n]);
  await seller.exec(art, "setApprovalForAll(address,bool)", [OPENSEA_CONDUIT, true]);
  const oO = withFee(etherListing({ token: art, id: 1n, seller: S, price: PRICE, royalty: 0n, receiver, start: now - 60n, end, salt: 3n,
                                    conduitKey: OPENSEA_CONDUIT_KEY }));
  const sO = await sign(seller, oO);
  const pubO = await c.send({ to: bazaar, data: enc(SIG.publish, [orderOf(oO, sO.sig), []]), label: "publish (plain)" });
  const logO = await c.getLogs({ address: bazaar, fromBlock: "0x" + pubO.block.toString(16), toBlock: "0x" + pubO.block.toString(16),
                                 topics: [TOPIC.published, word32(art), word32(1n)] });
  ok(logO.length === 1 && decodePublished(logO[0]).price === PRICE, "the OpenSea-shaped order is published and found by (token, id), priced at its whole consideration");
  const f1 = await c.balanceOf(feeTo);
  const fillO = await buyer.send({ to: SEAPORT, data: enc(SIG.fulfillOrder, [orderOf(oO, sO.sig), OPENSEA_CONDUIT_KEY]), value: PRICE, label: "fill (plain)" });
  eq(low(decAddr(await c.call(art, enc("ownerOf(uint256)", [1n])))), low(B), "and filled through OpenSea's conduit: the plain NFT is the buyer's");
  eq(await c.balanceOf(feeTo) - f1, FEE, "the fee item was paid");
  note(`gas on the fork: publish (plain) ${pubO.gas}, fill (plain) through OpenSea's conduit ${fillO.gas}`);

  /*──────── a raised counter ────────*/
  // The in-process chain has no block hashes, and Seaport 1.6 raises a counter
  // by the previous block hash's high half, so only a real chain shows this.
  head("a seller who raised its Seaport counter: publish hashes at the live counter");
  await seller.exec(SEAPORT, "incrementCounter()", []);
  const counter = decUint(await c.call(SEAPORT, enc("getCounter(address)", [S])));
  ok(counter > 0n, `the seller's counter on the real Seaport is now ${counter}, not zero`);
  await c.exec(art, "mint(address,uint256)", [S, 2n]);
  const oK = withFee(etherListing({ token: art, id: 2n, seller: S, price: PRICE, royalty: 0n, receiver, start: now - 60n, end, salt: 4n,
                                    conduitKey: OPENSEA_CONDUIT_KEY }));
  const sK = await sign(seller, oK);
  ok(sK.same, "the order hash computed here at that counter is the fork's Seaport getOrderHash");
  const pubK = await c.send({ to: bazaar, data: enc(SIG.publish, [orderOf(oK, sK.sig), []]), label: "publish (raised counter)" });
  const logK = await c.getLogs({ address: bazaar, fromBlock: "0x" + pubK.block.toString(16), toBlock: "0x" + pubK.block.toString(16),
                                 topics: [TOPIC.published, word32(art), word32(2n)] });
  const statusK = await c.call(SEAPORT, enc("getOrderStatus(bytes32)", [sK.hash]));
  ok(logK.length === 1 && low(decodePublished(logK[0]).orderHash) === low(sK.hash) && BigInt(word(statusK, 0)) === 1n,
     "an order signed at the raised counter is published under the hash the real Seaport validated at that counter");
}

/*═══════════════════ main ═══════════════════*/

async function main() {
  const argv = process.argv.slice(2);
  const probing = argv.includes("--probe");
  console.log(`\n  \x1b[1mINTACT · verify-bazaar-fork\x1b[0m  ${probing ? "probe" : "fork"}`);
  const url = probing ? (process.env.RPC_URL_84532 || process.env.RPC_URL)
                      : (process.env.FORK_URL || process.env.RPC_URL_84532 || process.env.RPC_URL);
  if (ok(Boolean(url), `an endpoint for chain ${CHAIN} is in the environment (${probing ? "RPC_URL_84532 or RPC_URL" : "FORK_URL, RPC_URL_84532 or RPC_URL"})`)) {
    if (probing) await probe(url); else await fork(url);
  }
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  killAll();
  process.exit(fail ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e && e.stack || e); console.log(`\n  ${pass} passed, ${fail + 1} failed\n`); killAll(); process.exit(1); });
}
