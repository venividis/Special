#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the Bazaar on the real Seaport, in-process (V2, unit W3; docs/V2.md §3.3)

  The strongest proof this unit can run without a wire. The real INTACT
  site (tools/site.mjs `deploySite`: the diamond, the real Reach and Grip
  behind the canonical registry, the real Pool, Locks, Steward, Launchpad,
  the real Timelock) on a chain that says it is Base Sepolia (84532), with
  Seaport 1.6's RUNTIME — the bytes `eth_getCode` returned on Base Sepolia,
  tools/fixtures/seaport-1.6/, re-hashed here against the probe — put at
  its canonical address, so its domain separator is the one it baked for
  that chain at that address, and its ConduitController beside it. Then
  the Bazaar and Bridges, and real EIP-712 signatures: the seller's key
  signs OrderComponents; this file's typed-data hash must equal Seaport's
  `getOrderHash` and pass Seaport's own signature check.

  What it proves, one sentence per check:
    · an INTACT listing published through the Bazaar is found from the
      `Published` log filtered by (hub, id), rebuilt from Seaport's own
      `OrderValidated` log, and filled with no signature by a buyer; the
      token moves and the seller and the royalty receiver are paid;
    · a listing whose fingerprint moved after publishing (a trait written)
      is refused at the fill with FingerprintMoved and nothing moves; a
      Reach seal shorter than the order's end (ReachSealShort), an owned
      market on the real Pool sealed short of it (MarketSealShort), a
      broken floor (FloorBroken — never met, and drained by a spender
      approved before listing) and an order with no royalty item
      (RoyaltyShort) are refused at the fill, each by its exact revert
      data; and publish refuses an order carrying a consideration item its
      offerer never signed (NotValidated);
    · a token whose owned market on the real Pool is open and sealed to
      the order's end fills: the sale moves neither term of the residue
      validateOrder reads again (the Reach's state, the market's hash);
    · a WETH bid on an INTACT token pays the royalty and fills;
    · through a real conduit (created in-process by the probed
      ConduitController, Seaport's channel opened), a contract seller paid
      in ether inside the fill that acts on its Reach from its own
      receive() is refused by validateOrder after the transfers, and the
      same fill with nothing done inside it lands;
    · (V2 wave 2, W6) the zone reads the hub's own `residueOf` after the
      transfers, so a seller who writes a trait or a memory, or launches a
      coin from the token, inside the fill is refused the same way, and a
      memory written after publishing moves the fingerprint the pin holds;
    · a plain MockERC721 listing with no zone is published and filled;
    · Bridges is written through the real Timelock (queue, seven days,
      execute) and read back, and a direct call is NotTimelock.

  It compiles src + test/mocks (the full site: minutes cold, cached by
  input) and runs tools/build-app.mjs for the shards. The site comes from
  tools/site.mjs `deploySite` with its V2 options (W6): the Journal pinned
  by the hub, the Bazaar on Seaport's probed runtime, Bridges on the
  Timelock. The last line is "  N passed, M failed"; the exit code follows it.

    node tools/verify-bazaar.mjs
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAddressFromString, hexToBytes, Account } from "@ethereumjs/util";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";
import { compile, artifact } from "./compile.mjs";
import * as evm from "./evm.mjs";
import { Chain, enc, sel, encodeParams, decUint, decAddr, decBool, decString } from "./evm.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = path.join(HERE, "fixtures", "seaport-1.6");

/// The addresses as Seaport's own deployment documents them for every chain
/// it targets (one keyless CREATE2 deployment); each is re-read by
/// tools/verify-bazaar-fork.mjs --probe, and probe.json is what it read.
export const SEAPORT = "0x0000000000000068F116a894984e2DB1123eB395";
export const CONDUIT_CONTROLLER = "0x00000000F9490004C11Cef243f5400493c00Ad63";
export const OPENSEA_CONDUIT_KEY = "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
export const OPENSEA_CONDUIT = "0x1E0049783F008A0085193E00003D00cd54003c71";
export const ZERO = "0x" + "00".repeat(20);
export const ZERO32 = "0x" + "00".repeat(32);

export const low = (a) => String(a).toLowerCase();
export const kecHex = (h) => "0x" + Buffer.from(keccak256(Buffer.from(String(h).replace(/^0x/, ""), "hex"))).toString("hex");
export const kecStr = (s) => "0x" + Buffer.from(keccak256(Buffer.from(s, "utf8"))).toString("hex");
export const W = (n) => BigInt(n).toString(16).padStart(64, "0");
/// A topic word: an address or a hex word as given, a number as a number.
export const word32 = (a) => "0x" + (typeof a === "bigint" || typeof a === "number" ? BigInt(a).toString(16)
  : String(a).replace(/^0x/, "")).toLowerCase().padStart(64, "0");

/// The fixture, checked against its own record.
export function loadFixture() {
  const probe = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, "probe.json"), "utf8"));
  const seaport = fs.readFileSync(path.join(FIXTURE_DIR, "seaport.runtime.hex"), "utf8").trim();
  const controller = fs.readFileSync(path.join(FIXTURE_DIR, "conduit-controller.runtime.hex"), "utf8").trim();
  return { probe, seaport, controller,
           seaportMatches: low(kecHex(seaport)) === low(probe.codehash),
           controllerMatches: low(kecHex(controller)) === low(probe.conduitController.codehash) };
}

/*═══════════════════ Seaport 1.6, in JavaScript ═══════════════════*/

export const ITEM = { NATIVE: 0, ERC20: 1, ERC721: 2, ERC1155: 3, ERC721_WITH_CRITERIA: 4, ERC1155_WITH_CRITERIA: 5 };
export const KIND = { FULL_OPEN: 0, PARTIAL_OPEN: 1, FULL_RESTRICTED: 2, PARTIAL_RESTRICTED: 3, CONTRACT: 4 };
const OFFER_T = "(uint8,address,uint256,uint256,uint256)";
const CONS_T = "(uint8,address,uint256,uint256,uint256,address)";
/// OrderParameters and OrderComponents share one shape; the last word is
/// totalOriginalConsiderationItems in one and the counter in the other.
export const PARAMS_T = `(address,address,${OFFER_T}[],${CONS_T}[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256)`;
export const ORDER_T = `(${PARAMS_T},bytes)`;
/// What the zone is shown: Seaport's ZoneParameters.
export const ZP_T = "(bytes32,address,address,(uint8,address,uint256,uint256)[],(uint8,address,uint256,uint256,address)[],bytes,bytes32[],uint256,uint256,bytes32)";
export const FLOORS_T = "(address,uint256)[]";
export const SIG = {
  publish: `publish(${ORDER_T},${FLOORS_T})`,
  fulfillOrder: `fulfillOrder(${ORDER_T},bytes32)`,
  validate: `validate(${ORDER_T}[])`,
  getOrderHash: `getOrderHash(${PARAMS_T})`
};
export const TOPIC = {
  published: kecStr("Published(address,uint256,bytes32,address,uint8,uint8,address,uint256,uint256)"),
  pinned: kecStr("Pinned(bytes32,uint256,bytes32,uint256)"),
  orderValidated: kecStr(`OrderValidated(bytes32,${PARAMS_T})`),
  orderFulfilled: kecStr("OrderFulfilled(bytes32,address,address,address,(uint8,address,uint256,uint256)[],(uint8,address,uint256,uint256,address)[])"),
  deployed: kecStr("SeaportCompatibleContractDeployed()"),
  endpointSet: kecStr("EndpointSet(bytes32,string)")
};

const offerRow = (i) => [i.itemType, i.token, i.id, i.start, i.end];
const consRow = (i) => [i.itemType, i.token, i.id, i.start, i.end, i.recipient];
export const paramsOf = (o) => [o.offerer, o.zone, o.offer.map(offerRow), o.consideration.map(consRow),
  o.orderType, o.startTime, o.endTime, o.zoneHash, o.salt, o.conduitKey, o.consideration.length];
export const componentsOf = (o, counter) => [o.offerer, o.zone, o.offer.map(offerRow), o.consideration.map(consRow),
  o.orderType, o.startTime, o.endTime, o.zoneHash, o.salt, o.conduitKey, counter];
export const orderOf = (o, signature = "0x") => [paramsOf(o), signature];

/// Seaport 1.6's type strings (seaport-core ConsiderationBase.sol `_deriveTypehashes`).
const OFFER_TS = "OfferItem(uint8 itemType,address token,uint256 identifierOrCriteria,uint256 startAmount,uint256 endAmount)";
const CONS_TS = "ConsiderationItem(uint8 itemType,address token,uint256 identifierOrCriteria,uint256 startAmount,uint256 endAmount,address recipient)";
const ORDER_TS = "OrderComponents(address offerer,address zone,OfferItem[] offer,ConsiderationItem[] consideration," +
  "uint8 orderType,uint256 startTime,uint256 endTime,bytes32 zoneHash,uint256 salt,bytes32 conduitKey,uint256 counter)" + CONS_TS + OFFER_TS;
const DOMAIN_TS = "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

/// The EIP-712 struct hash of OrderComponents — what Seaport calls the order hash.
export function orderHashOf(o, counter) {
  const items = (rows, ts, types) => kecHex(rows.map((r) => kecHex(encodeParams(types, [kecStr(ts), ...r]))).map((h) => h.slice(2)).join(""));
  return kecHex(encodeParams("bytes32,address,address,bytes32,bytes32,uint8,uint256,uint256,bytes32,uint256,bytes32,uint256", [
    kecStr(ORDER_TS), o.offerer, o.zone,
    items(o.offer.map(offerRow), OFFER_TS, "bytes32,uint8,address,uint256,uint256,uint256"),
    items(o.consideration.map(consRow), CONS_TS, "bytes32,uint8,address,uint256,uint256,uint256,address"),
    o.orderType, o.startTime, o.endTime, o.zoneHash, o.salt, o.conduitKey, counter
  ]));
}

export function domainSeparatorOf(chainId, verifying = SEAPORT) {
  return kecHex(encodeParams("bytes32,bytes32,bytes32,uint256,address",
    [kecStr(DOMAIN_TS), kecStr("Seaport"), kecStr("1.6"), chainId, verifying]));
}

/// A 65-byte signature over the EIP-712 digest of an order hash.
export function signOrder(key, domain, hash) {
  const digest = keccak256(Buffer.from("1901" + domain.slice(2) + hash.slice(2), "hex"));
  const s = secp256k1.sign(digest, key);
  return "0x" + Buffer.from(s.toCompactRawBytes()).toString("hex") + (27 + s.recovery).toString(16);
}

/// keccak256(abi.encode(bazaar, id, fingerprint, floors)) — what a page computes.
export const pinHashOf = (bazaar, id, fp, floors) =>
  kecHex(encodeParams(`address,uint256,bytes32,${FLOORS_T}`, [bazaar, id, fp, floors.map((f) => [f.asset, f.min])]));

/// OrderParameters out of an `OrderValidated` log's data: the order a page
/// finds with no API, and fills with no signature.
export function decodeValidated(data) {
  const h = String(data).replace(/^0x/, "");
  const w = (b) => BigInt("0x" + h.slice(b * 2, b * 2 + 64));
  const a = (b) => "0x" + h.slice(b * 2 + 24, b * 2 + 64);
  const x = (b) => "0x" + h.slice(b * 2, b * 2 + 64);
  const base = Number(w(32));
  const offerAt = base + Number(w(base + 64));
  const consAt = base + Number(w(base + 96));
  const offer = [...Array(Number(w(offerAt)))].map((_, i) => {
    const p = offerAt + 32 + i * 160;
    return { itemType: Number(w(p)), token: a(p + 32), id: w(p + 64), start: w(p + 96), end: w(p + 128) };
  });
  const consideration = [...Array(Number(w(consAt)))].map((_, i) => {
    const p = consAt + 32 + i * 192;
    return { itemType: Number(w(p)), token: a(p + 32), id: w(p + 64), start: w(p + 96), end: w(p + 128), recipient: a(p + 160) };
  });
  return {
    orderHash: x(0),
    order: { offerer: a(base), zone: a(base + 32), offer, consideration, orderType: Number(w(base + 128)),
             startTime: w(base + 160), endTime: w(base + 192), zoneHash: x(base + 224), salt: w(base + 256),
             conduitKey: x(base + 288) },
    totalOriginal: w(base + 320)
  };
}

export function decodePublished(log) {
  const d = String(log.data).replace(/^0x/, "");
  const w = (i) => BigInt("0x" + d.slice(i * 64, i * 64 + 64));
  return { token: "0x" + log.topics[1].slice(26), identifier: BigInt(log.topics[2]), orderHash: log.topics[3],
           offerer: "0x" + d.slice(24, 64), side: Number(w(1)), itemType: Number(w(2)),
           currency: "0x" + d.slice(3 * 64 + 24, 4 * 64), price: w(4), endTime: w(5) };
}

/// A listing in ether: the proceeds to the seller and, when owed, the royalty.
export function etherListing({ token, id, seller, price, royalty, receiver, zone = ZERO, zoneHash = ZERO32,
                               start, end, salt = 1n, conduitKey = ZERO32, restricted = zone !== ZERO }) {
  const consideration = [{ itemType: ITEM.NATIVE, token: ZERO, id: 0n, start: price - royalty, end: price - royalty, recipient: seller }];
  if (royalty > 0n) consideration.push({ itemType: ITEM.NATIVE, token: ZERO, id: 0n, start: royalty, end: royalty, recipient: receiver });
  return { offerer: seller, zone, offer: [{ itemType: ITEM.ERC721, token, id, start: 1n, end: 1n }], consideration,
           orderType: restricted ? KIND.FULL_RESTRICTED : KIND.FULL_OPEN, startTime: start, endTime: end,
           zoneHash, salt, conduitKey };
}

/*═══════════════════ the run ═══════════════════*/

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
const ETH = 10n ** 18n;
const DAY = 86_400n;

async function main() {
  console.log("\n  \x1b[1mINTACT · verify-bazaar\x1b[0m  the Bazaar and Bridges on the real site and Seaport 1.6's probed runtime");
  const { deploySite, mint } = await import("./site.mjs");
  const { build } = await import("./build-app.mjs");

  /*──────────── the fixture ────────────*/
  head("Seaport 1.6, as probed");
  const fx = loadFixture();
  ok(fx.seaportMatches, `the Seaport runtime in tools/fixtures/seaport-1.6 hashes to ${fx.probe.codehash}, read on chain ${fx.probe.chainId} at block ${fx.probe.block} on ${fx.probe.probed}`);
  ok(fx.controllerMatches, `the ConduitController runtime hashes to ${fx.probe.conduitController.codehash}, read at the same block`);

  /*──────────── the site ────────────*/
  head("the site, on a chain that says it is Base Sepolia");
  const plan = await build();
  const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
  const A = (f, n) => artifact(out, f, n);
  const c = await Chain.open({ chainId: fx.probe.chainId });
  const me = c.from.toString();
  const site = await deploySite(c, out, { plan, deployJournal: true, deployBazaar: true, deployBridges: true });
  const hub = site.hub;
  ok((await c.codeSize(hub)) > 0, `the real site is deployed: the diamond at ${hub}, the Pool at ${site.pool}, the Timelock at ${site.timelock}`);

  const put = async (addr, code) => {
    const a = createAddressFromString(addr);
    if (!(await c.vm.stateManager.getAccount(a))) await c.vm.stateManager.putAccount(a, new Account());
    await c.vm.stateManager.putCode(a, hexToBytes(code));
  };
  await put(SEAPORT, fx.seaport);
  await put(CONDUIT_CONTROLLER, fx.controller);
  const placed = kecHex("0x" + Buffer.from(await c.vm.stateManager.getCode(createAddressFromString(SEAPORT))).toString("hex"));
  eq(low(placed), low(fx.probe.codehash), "Seaport's probed runtime is at its canonical address");
  const info = await c.read(SEAPORT, "information()", []);
  eq(decString(info), "1.6", "the runtime answers information() with version 1.6");
  const domain = "0x" + info.slice(2 + 64, 2 + 128);
  eq(low(domain), low(fx.probe.domainSeparator), "its domain separator is the one it holds on Base Sepolia");
  eq(low(domain), low(domainSeparatorOf(fx.probe.chainId)), "and it is EIP712Domain(\"Seaport\", \"1.6\", 84532, its address), computed here");

  /*──────────── the Bazaar and Bridges ────────────*/
  head("the Bazaar and Bridges");
  const bazaar = site.bazaar;
  const bazaarBytes = (A("src/Bazaar.sol", "Bazaar").deployed.length - 2) / 2;
  const bridgesBytes = (A("src/Bridges.sol", "Bridges").deployed.length - 2) / 2;
  ok(c.getLogs({ address: bazaar, topics: [TOPIC.deployed] }).length === 1,
     `the Bazaar (runtime ${bazaarBytes} B) emits SIP-5's SeaportCompatibleContractDeployed at construction`);
  eq(low(decAddr(await c.read(bazaar, "POOL()", []))), low(decAddr(await c.read(hub, "POOL()", []))), "the Bazaar's POOL is the hub's POOL");
  ok(low(decAddr(await c.read(bazaar, "SEAPORT()", []))) === low(SEAPORT) && low(decAddr(await c.read(bazaar, "HUB()", []))) === low(hub),
     "deploySite's Bazaar names Seaport's canonical address and the site's hub");
  const bridges = site.bridges;
  ok(low(decAddr(await c.read(bridges, "TIMELOCK()", []))) === low(site.timelock), `Bridges (runtime ${bridgesBytes} B) is deployed against the site's Timelock`);
  const journal = site.journal;
  eq(low(decAddr(await c.read(hub, "JOURNAL()", []))), low(journal), "the hub pins the Journal deploySite put beside it, whose root its residue reads");

  /*──────────── the Timelock: the royalty and the door ────────────*/
  head("the Timelock writes the royalty and the door");
  const receiver = "0x0000000000000000000000000000000000002071";
  const DOOR = kecStr("opensea.v2");
  const URL = "https://orders.example/api/v2";
  const QUEUE = "queue(address,uint256,bytes,bytes32)", EXEC = "execute(address,uint256,bytes,bytes32)";
  const royaltyCall = enc("setRoyalty(address,uint16)", [receiver, 500]);
  const doorCall = enc("setEndpoint(bytes32,string)", [DOOR, URL]);
  await c.exec(site.timelock, QUEUE, [hub, 0, royaltyCall, word32(1)]);
  await c.exec(site.timelock, QUEUE, [bridges, 0, doorCall, word32(2)]);
  const direct = await c.simulate(bridges, doorCall);
  ok(!direct.ok && direct.data === sel("NotTimelock()"), "a direct call to Bridges, even from the Timelock's admin, is refused with NotTimelock");
  const early = await c.simulate(site.timelock, enc(EXEC, [bridges, 0, doorCall, word32(2)]));
  ok(!early.ok && early.data.startsWith(sel("TooEarly()")), "the door cannot land before the Timelock's seven days");
  let now = evm.GENESIS_TIME + 7n * DAY + 1n;
  evm.warp(now);
  const stranger = await c.as("0x" + "5a".repeat(32));
  await stranger.exec(site.timelock, EXEC, [hub, 0, royaltyCall, word32(1)]);
  const set = await stranger.send({ to: site.timelock, data: enc(EXEC, [bridges, 0, doorCall, word32(2)]), label: "door" });
  const r1 = await c.read(hub, "royaltyInfo(uint256,uint256)", [1n, 10_000n]);
  ok(low(decAddr(r1, 0)) === low(receiver) && decUint(r1, 1) === 500n, "after seven days a stranger lands the royalty: 5 % to the receiver");
  const door = await c.read(bridges, "endpointOf(bytes32)", [DOOR]);
  eq(decString(door), URL, "the door the Timelock queued is the door Bridges reads back");
  eq(decUint(door, 1), now, "and it records when it landed");
  const named = await c.read(bridges, "names()", []);
  ok(decUint(named, 1) === 1n && low("0x" + named.slice(2 + 128, 2 + 192)) === low(DOOR), "names() lists the one door, by its name");
  ok(set.logs.some((l) => "0x" + Buffer.from(l[1][0]).toString("hex") === TOPIC.endpointSet), "the landing emits EndpointSet");

  /*──────────── the cast ────────────*/
  const seller = await c.as("0x" + "a1".repeat(32), 100n * ETH);
  const buyer = await c.as("0x" + "b0".repeat(32), 100n * ETH);
  const relayer = await c.as("0x" + "c3".repeat(32), 10n * ETH);
  const spender = await c.as("0x" + "d4".repeat(32), 10n * ETH);
  const S = seller.from.toString(), B = buyer.from.toString();
  const attacker = "0x000000000000000000000000000000000000bad1";
  const PRICE = ETH / 10n;
  const ROY = PRICE * 500n / 10_000n;
  const counterOf = async (who) => decUint(await c.read(SEAPORT, "getCounter(address)", [who]));
  const ownerOf = async (id) => low(decAddr(await c.read(hub, "ownerOf(uint256)", [id])));
  const reachOf = async (id) => decAddr(await c.read(hub, "account(uint256)", [id]));
  const fpOf = async (id) => "0x" + (await c.read(hub, "getStateFingerprint(uint256)", [id])).slice(2);
  const sealed = async (who, until) => {
    const { id } = await mint(who, site, who.from.toString());
    await who.exec(await reachOf(id), "seal(uint64)", [until]);
    await who.exec(hub, "setApprovalForAll(address,bool)", [SEAPORT, true]);
    return id;
  };
  /// The pin a page computes, held to the Bazaar's own pinHash.
  const pinOf = async (id, floors = []) => {
    const fp = await fpOf(id);
    const zh = pinHashOf(bazaar, id, fp, floors);
    const theirs = await c.read(bazaar, `pinHash(uint256,bytes32,${FLOORS_T})`, [id, fp, floors.map((f) => [f.asset, f.min])]);
    return { fp, zh, same: low(theirs) === low(zh) };
  };
  /// Sign with the offerer's key, after holding the JS hash to Seaport's.
  const signed = async (who, o) => {
    const counter = await counterOf(o.offerer);
    const mine = orderHashOf(o, counter);
    const theirs = await c.read(SEAPORT, SIG.getOrderHash, [componentsOf(o, counter)]);
    return { o, hash: mine, same: low(theirs) === low(mine), sig: signOrder(who.key, domain, mine) };
  };
  const published = { intact: [], plain: [] };
  const publish = async (s, floors = []) => {
    const r = await relayer.send({ to: bazaar, data: enc(SIG.publish, [orderOf(s.o, s.sig), floors.map((f) => [f.asset, f.min])]) });
    published[s.o.zone === ZERO ? "plain" : "intact"].push(r.gas);
    return r;
  };
  const fillData = (o, sig = "0x", key = ZERO32) => enc(SIG.fulfillOrder, [orderOf(o, sig), key]);
  const refusal = async (o, sig, value, from = buyer) => (await from.simulate(SEAPORT, fillData(o, sig), { value }));
  const err = (sig, ...words) => sel(sig) + words.map((x) => (typeof x === "string" ? x.replace(/^0x/, "").padStart(64, "0") : W(x))).join("");

  /*──────────── A: listed, found from logs, filled ────────────*/
  head("an INTACT listing: signed, published, found from logs, filled");
  const end = now + 30n * DAY;
  const idA = await sealed(seller, end);
  const reachA = await reachOf(idA);
  {
    /* V2 (W6): the Catalog's probes on a site that landed three of the six V2 satellites (TokenState words 13 and 14) */
    const st = await c.read(site.catalog, "stateOf(uint256)", [idA]);
    const rep = decUint(st, 13), abs = decUint(st, 14), landed = 16384n | 32768n | 262144n, unlanded = 8192n | 65536n | 131072n;
    ok((rep & landed) === landed && (abs & landed) === 0n && (abs & unlanded) === unlanded && (rep & unlanded) === 0n,
       "Catalog.stateOf reports the Journal, the Bazaar and Bridges this site landed (bits 16384, 32768, 262144) and names the Keepsake, the Studio and Agora absent",
       `reported ${rep} absent ${abs}`);
  }
  await relayer.send({ to: reachA, value: ETH });
  const floorsA = [{ asset: ZERO, min: ETH }];
  const pinA = await pinOf(idA, floorsA);
  ok(pinA.same, "the zone hash a page computes is the Bazaar's pinHash(id, fingerprint, floors)");
  const oA = etherListing({ token: hub, id: idA, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinA.zh, start: now, end });
  const sA = await signed(seller, oA);
  ok(sA.same, "the EIP-712 OrderComponents hash computed here is Seaport's getOrderHash");
  const pubA = await publish(sA, floorsA);
  const status0 = await c.read(SEAPORT, "getOrderStatus(bytes32)", [sA.hash]);
  ok(decBool(status0, 0) && !decBool(status0, 1), "Seaport accepted the seller's signature and the order stands validated");
  const found = c.getLogs({ address: bazaar, topics: [TOPIC.published, word32(hub), word32(idA)] });
  ok(found.length === 1, "exactly one Published log answers the filter (hub, id)", `${found.length} logs`);
  const p = decodePublished(found[0]);
  ok(low(p.orderHash) === low(sA.hash) && low(p.offerer) === low(S) && p.side === 0 && p.itemType === ITEM.ERC721,
     "it names the order hash, the seller, the OFFER side and an ERC-721");
  ok(p.price === PRICE && low(p.currency) === low(ZERO) && p.endTime === end, "it prices the listing in ether at the whole consideration, with its end");
  const pinned = c.getLogs({ address: bazaar, topics: [TOPIC.pinned, pinA.zh, word32(idA)] });
  ok(pinned.length === 1 && low("0x" + pinned[0].data.slice(2, 66)) === low(pinA.fp), "a Pinned log carries the zone hash, the token and the pinned fingerprint");
  const validated = c.getLogs({ address: SEAPORT, topics: [TOPIC.orderValidated] }).map((l) => decodeValidated(l.data))
    .find((v) => low(v.orderHash) === low(sA.hash));
  ok(Boolean(validated), "Seaport's own OrderValidated log carries the whole order beside it");
  const rebuilt = validated.order;
  ok(low(orderHashOf(rebuilt, await counterOf(rebuilt.offerer))) === low(sA.hash), "the order rebuilt from that log hashes to the published order hash");
  eq(await c.read(bazaar, "check(bytes32,uint256)", [pinA.zh, end]), ZERO32, "check(zoneHash, endTime) says the pin is still good");
  // the zone's own two calls, as Seaport will make them, measured before the fill
  const zpA = [sA.hash, B, S, [[ITEM.ERC721, hub, idA, 1n]],
               [[ITEM.NATIVE, ZERO, 0n, PRICE - ROY, S], [ITEM.NATIVE, ZERO, 0n, ROY, receiver]], "0x", [sA.hash], now, end, pinA.zh];
  const auth = await c.simulate(bazaar, enc(`authorizeOrder(${ZP_T})`, [zpA]), { from: SEAPORT });
  const vald = await c.simulate(bazaar, enc(`validateOrder(${ZP_T})`, [zpA]), { from: SEAPORT });
  ok(auth.ok && auth.data.startsWith(sel(`authorizeOrder(${ZP_T})`)) && vald.ok && vald.data.startsWith(sel(`validateOrder(${ZP_T})`)),
     "asked by Seaport's address, the zone admits the order with each call's own selector");
  const s0 = await c.balanceOf(S), r0 = await c.balanceOf(receiver);
  const fillA = await buyer.send({ to: SEAPORT, data: fillData(rebuilt), value: PRICE, label: "fill (INTACT)" });
  eq(await ownerOf(idA), low(B), "a buyer fills the rebuilt order with no signature, and the INTACT token is the buyer's");
  eq(await c.balanceOf(S) - s0, PRICE - ROY, "the seller is paid the price less the royalty");
  eq(await c.balanceOf(receiver) - r0, ROY, "the royalty receiver is paid 5 %");
  const status1 = await c.read(SEAPORT, "getOrderStatus(bytes32)", [sA.hash]);
  ok(decUint(status1, 2) === 1n && decUint(status1, 3) === 1n, "Seaport records the order filled");

  /*──────────── B..E: refusals at the fill ────────────*/
  head("refused at the fill, and nothing moves");
  const idB = await sealed(seller, end);
  const pinB = await pinOf(idB);
  const oB = etherListing({ token: hub, id: idB, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinB.zh, start: now, end, salt: 2n });
  const sB = await signed(seller, oB);
  await publish(sB);
  const NAME = kecStr("name");
  await seller.exec(hub, "setTrait(uint256,bytes32,bytes32)", [idB, NAME, "0x" + Buffer.from("renamed").toString("hex").padEnd(64, "0")]);
  const liveB = await fpOf(idB);
  const rB = await refusal(oB, sB.sig, PRICE);
  ok(!rB.ok && rB.data === err("FingerprintMoved(bytes32,bytes32)", pinB.fp, liveB),
     "a listing whose name trait was written after publishing is refused at the fill with FingerprintMoved(pinned, live)", rB.data);
  let threw = false;
  try { await buyer.send({ to: SEAPORT, data: fillData(oB, sB.sig), value: PRICE }); } catch { threw = true; }
  ok(threw && (await ownerOf(idB)) === low(S), "and the token did not move");
  eq(await c.read(bazaar, "check(bytes32,uint256)", [pinB.zh, end]), sel("FingerprintMoved(bytes32,bytes32)") + "0".repeat(56), "check names FingerprintMoved for that pin");

  const shortSeal = now + 10n * DAY;
  const idC = await sealed(seller, shortSeal);
  const pinC = await pinOf(idC);
  const oC = etherListing({ token: hub, id: idC, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinC.zh, start: now, end, salt: 3n });
  const sC = await signed(seller, oC);
  await publish(sC);
  const rC = await refusal(oC, sC.sig, PRICE);
  ok(!rC.ok && rC.data === err("ReachSealShort(uint64,uint256)", shortSeal, end),
     "a Reach sealed ten days for a thirty-day order is refused at the fill with ReachSealShort(sealedUntil, endTime)", rC.data);

  const idD = await sealed(seller, end);
  const reachD = await reachOf(idD);
  await relayer.send({ to: reachD, value: ETH });
  const floorsD = [{ asset: ZERO, min: 5n * ETH }];
  const pinD = await pinOf(idD, floorsD);
  const oD = etherListing({ token: hub, id: idD, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinD.zh, start: now, end, salt: 4n });
  const sD = await signed(seller, oD);
  await publish(sD, floorsD);
  const rD = await refusal(oD, sD.sig, PRICE);
  ok(!rD.ok && rD.data === err("FloorBroken(address,uint256,uint256)", ZERO, ETH, 5n * ETH),
     "a Reach holding 1 ETH under a 5 ETH floor is refused at the fill with FloorBroken(asset, balance, min)", rD.data);

  const coin = await c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode,
    encodeParams("string,string,uint8,uint256,bool", ["Coin", "COIN", 18, 0, false]), "MockERC20");
  const idE = await sealed(seller, end);
  const reachE = await reachOf(idE);
  await c.exec(coin, "mint(address,uint256)", [reachE, 100n * ETH]);
  await seller.exec(reachE, "execute(address,uint256,bytes,uint8)", [coin, 0, enc("approve(address,uint256)", [spender.from.toString(), 100n * ETH]), 0]);
  const floorsE = [{ asset: coin, min: 100n * ETH }];
  const pinE = await pinOf(idE, floorsE);
  const oE = etherListing({ token: hub, id: idE, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinE.zh, start: now, end, salt: 5n });
  const sE = await signed(seller, oE);
  await publish(sE, floorsE);
  ok((await refusal(oE, sE.sig, PRICE)).ok, "a listing whose coin floor stands would fill");
  await spender.exec(coin, "transferFrom(address,address,uint256)", [reachE, spender.from.toString(), 1n]);
  ok((await fpOf(idE)) === pinE.fp, "a spender approved before listing pulls one wei and the fingerprint does not move");
  const rE = await refusal(oE, sE.sig, PRICE);
  ok(!rE.ok && rE.data === err("FloorBroken(address,uint256,uint256)", coin, 100n * ETH - 1n, 100n * ETH),
     "but the floor it broke refuses the fill with FloorBroken", rE.data);

  const idF = await sealed(seller, end);
  const pinF = await pinOf(idF);
  const oF = etherListing({ token: hub, id: idF, seller: S, price: PRICE, royalty: 0n, receiver, zone: bazaar, zoneHash: pinF.zh, start: now, end, salt: 6n });
  const sF = await signed(seller, oF);
  await publish(sF);
  const rF = await refusal(oF, sF.sig, PRICE);
  ok(!rF.ok && rF.data === err("RoyaltyShort(address,uint256,uint256)", receiver, 0n, ROY),
     "an order with no royalty item is refused at the fill with RoyaltyShort(receiver, paid, owed)", rF.data);

  const idM = await sealed(seller, end);
  await seller.exec(site.pool, "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", [idM, ZERO, coin, 30, 0, 0, 0]);
  await seller.exec(site.pool, "sealMarket(uint256,uint64)", [idM, shortSeal]);
  const pinM = await pinOf(idM);
  const oM = etherListing({ token: hub, id: idM, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinM.zh, start: now, end, salt: 10n });
  const sM = await signed(seller, oM);
  await publish(sM);
  const rM = await refusal(oM, sM.sig, PRICE);
  ok(!rM.ok && rM.data === err("MarketSealShort(uint64,uint256)", shortSeal, end),
     "an owned market on the real Pool, sealed ten days for a thirty-day order, is refused at the fill with MarketSealShort(sealUntil, endTime)", rM.data);
  ok([idB, idC, idD, idE, idF, idM].length === 6 && (await Promise.all([idB, idC, idD, idE, idF, idM].map(ownerOf))).every((o) => o === low(S)),
     "no refused token moved");

  // the other half of the residue, end to end: the sale itself moves neither term
  const idN = await sealed(seller, end);
  await seller.exec(site.pool, "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", [idN, ZERO, coin, 30, 0, 0, 0]);
  await seller.exec(site.pool, "sealMarket(uint256,uint64)", [idN, end]);
  const pinN = await pinOf(idN);
  const oN = etherListing({ token: hub, id: idN, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinN.zh, start: now, end, salt: 12n });
  const sN = await signed(seller, oN);
  await publish(sN);
  const hashN = decUint(await c.read(site.pool, "marketHash(uint256)", [idN]));
  await buyer.send({ to: SEAPORT, data: fillData(oN, sN.sig), value: PRICE, label: "fill (INTACT, open market)" });
  ok((await ownerOf(idN)) === low(B) && decUint(await c.read(site.pool, "marketHash(uint256)", [idN])) === hashN,
     "a token whose owned market on the real Pool is open and sealed to the order's end fills, and the sale leaves the market's hash as it was");

  // an order carrying consideration its offerer never signed: Seaport hashes the
  // signed items (totalOriginalConsiderationItems) and the Bazaar hashes them all
  const tip = { itemType: ITEM.NATIVE, token: ZERO, id: 0n, start: 1n, end: 1n, recipient: S };
  const tipped = paramsOf(oM);
  tipped[3] = [...tipped[3], [tip.itemType, tip.token, tip.id, tip.start, tip.end, tip.recipient]];
  tipped[10] = BigInt(oM.consideration.length);
  const h3 = orderHashOf({ ...oM, consideration: [...oM.consideration, tip] }, await counterOf(S));
  const rT = await relayer.simulate(bazaar, enc(SIG.publish, [[tipped, sM.sig], []]));
  ok(!rT.ok && rT.data === err("NotValidated(bytes32)", h3),
     "an order carrying a consideration item its offerer never signed is refused by publish with NotValidated", rT.data);

  /*──────────── a bid ────────────*/
  head("a WETH bid on an INTACT token");
  const weth = await c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode,
    encodeParams("string,string,uint8,uint256,bool", ["Wrapped Ether", "WETH", 18, 0, false]), "WETH");
  await c.exec(weth, "mint(address,uint256)", [B, PRICE]);
  await buyer.exec(weth, "approve(address,uint256)", [SEAPORT, PRICE]);
  await seller.exec(weth, "approve(address,uint256)", [SEAPORT, ROY]);
  const idG = await sealed(seller, end);
  const pinG = await pinOf(idG);
  const oG = { offerer: B, zone: bazaar, offer: [{ itemType: ITEM.ERC20, token: weth, id: 0n, start: PRICE, end: PRICE }],
               consideration: [{ itemType: ITEM.ERC721, token: hub, id: idG, start: 1n, end: 1n, recipient: B },
                               { itemType: ITEM.ERC20, token: weth, id: 0n, start: ROY, end: ROY, recipient: receiver }],
               orderType: KIND.FULL_RESTRICTED, startTime: now, endTime: end, zoneHash: pinG.zh, salt: 7n, conduitKey: ZERO32 };
  const sG = await signed(buyer, oG);
  await publish(sG);
  const bid = decodePublished(c.getLogs({ address: bazaar, topics: [TOPIC.published, word32(hub), word32(idG)] })[0]);
  ok(bid.side === 1 && low(bid.currency) === low(weth) && bid.price === PRICE, "a bid is published on the CONSIDERATION side, priced at its WETH offer");
  await seller.send({ to: SEAPORT, data: fillData(oG, sG.sig), label: "accept a bid (INTACT)" });
  eq(await ownerOf(idG), low(B), "the holder accepts the bid and the token is the bidder's");
  eq(decUint(await c.read(weth, "balanceOf(address)", [S])), PRICE - ROY, "the holder keeps the bid less the royalty");
  eq(decUint(await c.read(weth, "balanceOf(address)", [receiver])), ROY, "the royalty is paid in the bid's currency");

  /*──────────── the window ────────────*/
  head("a real conduit, and a seller paid inside the fill");
  const conduitKey = low(me) + "000000000000000000000001";
  await c.exec(CONDUIT_CONTROLLER, "createConduit(bytes32,address)", [conduitKey, me]);
  const got = await c.read(CONDUIT_CONTROLLER, "getConduit(bytes32)", [conduitKey]);
  const conduit = decAddr(got, 0);
  await c.exec(CONDUIT_CONTROLLER, "updateChannel(address,address,bool)", [conduit, SEAPORT, true]);
  ok(decBool(got, 1) && decBool(await c.read(CONDUIT_CONTROLLER, "getChannelStatus(address,address)", [conduit, SEAPORT])),
     "the probed ConduitController makes a conduit and opens Seaport's channel on it");
  const sellerC = await c.deploy(A("test/mocks/BazaarFixtures.sol", "BazaarSeller").bytecode, "", "BazaarSeller");
  const { id: idW } = await mint(c, site, sellerC);
  const reachW = await reachOf(idW);
  const run = (to, data) => c.exec(sellerC, "run(address,uint256,bytes)", [to, 0, data]);
  await run(hub, enc("setApprovalForAll(address,bool)", [conduit, true]));
  await run(reachW, enc("seal(uint64)", [end]));
  const pinW = await pinOf(idW);
  const oW = etherListing({ token: hub, id: idW, seller: sellerC, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinW.zh, start: now, end, salt: 8n, conduitKey });
  await run(SEAPORT, enc(SIG.validate, [[orderOf(oW)]]));
  await relayer.send({ to: bazaar, data: enc(SIG.publish, [orderOf(oW), []]), label: "publish (INTACT, pre-validated)" });
  ok(true, "a contract seller validates its own order on Seaport and the Bazaar publishes it with no signature");
  await c.exec(sellerC, "arm(address,bytes)", [reachW, enc("execute(address,uint256,bytes,uint8)", [coin, 0, enc("approve(address,uint256)", [attacker, 50n * ETH]), 0])]);
  const rW = await refusal(oW, "0x", PRICE);
  const fmSel = sel("FingerprintMoved(bytes32,bytes32)");
  ok(!rW.ok && rW.data.startsWith(fmSel) && low("0x" + rW.data.slice(10, 74)) === low(pinW.fp) && low("0x" + rW.data.slice(74, 138)) !== low(pinW.fp),
     "a seller whose receive() makes its Reach grant an approval inside a conduit fill is refused by validateOrder after the transfers", rW.data);
  threw = false;
  try { await buyer.send({ to: SEAPORT, data: fillData(oW), value: PRICE }); } catch { threw = true; }
  ok(threw && (await ownerOf(idW)) === low(sellerC) && decUint(await c.read(coin, "allowance(address,address)", [reachW, attacker])) === 0n,
     "and nothing moved: the token is the seller's and no approval survives");
  await c.exec(sellerC, "arm(address,bytes)", ["0x000000000000000000000000000000000000d1e5", "0x"]);
  const residueW = await c.read(hub, "residueOf(uint256)", [idW]);
  const fillW = await buyer.send({ to: SEAPORT, data: fillData(oW), value: PRICE, label: "fill (INTACT, through a conduit)" });
  eq(await ownerOf(idW), low(B), "the same fill through the real conduit, with nothing done inside it, lands");
  ok(decBool(await c.read(sellerC, "attempted()", [])), "the seller was called while the fill was under way");
  eq(await c.read(hub, "residueOf(uint256)", [idW]), residueW, "and the sale moved no term of the hub's residueOf, which validateOrder compared after the transfers");

  /*──────────── V2 (W6): a trait, a memory, a launch, inside the fill ────────────*/
  head("the hub's residue, read after the transfers: a trait, a memory or a launch inside the fill");
  const KILN_LAUNCH = "launch(uint256,string,string,uint8,uint256,bytes32,uint256)";
  const INSCRIBE = "inscribe(address,uint256,uint8,bytes,bytes32)";
  const inFill = async (salt, act) => {
    const sc = await c.deploy(A("test/mocks/BazaarFixtures.sol", "BazaarSeller").bytecode, "", "BazaarSeller");
    const { id } = await mint(c, site, sc);
    const runX = (to, data) => c.exec(sc, "run(address,uint256,bytes)", [to, 0, data]);
    await runX(hub, enc("setApprovalForAll(address,bool)", [conduit, true]));
    await runX(await reachOf(id), enc("seal(uint64)", [end]));
    const pinX = await pinOf(id);
    const oX = etherListing({ token: hub, id, seller: sc, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinX.zh, start: now, end, salt, conduitKey });
    await runX(SEAPORT, enc(SIG.validate, [[orderOf(oX)]]));
    await relayer.send({ to: bazaar, data: enc(SIG.publish, [orderOf(oX), []]), label: "publish (INTACT, pre-validated)" });
    const [to, data] = act(id);
    await c.exec(sc, "arm(address,bytes)", [to, data]);
    const r = await refusal(oX, "0x", PRICE);
    let sent = false;
    try { await buyer.send({ to: SEAPORT, data: fillData(oX), value: PRICE }); sent = true; } catch { /* refused, as simulated */ }
    return { id, sc, refused: !r.ok && r.data.startsWith(fmSel) && low("0x" + r.data.slice(10, 74)) === low(pinX.fp) && !sent, data: r.data };
  };
  const nameWord = "0x" + Buffer.from("renamed inside the fill").toString("hex").padEnd(64, "0");
  const tr = await inFill(20n, (id) => [hub, enc("setTrait(uint256,bytes32,bytes32)", [id, NAME, nameWord])]);
  ok(tr.refused, "a seller whose receive() writes a trait inside a conduit fill is refused by validateOrder after the transfers", tr.data);
  const mm = await inFill(21n, (id) => [journal, enc(INSCRIBE, [hub, id, 0, "0x" + Buffer.from("written inside the fill").toString("hex"), ZERO32])]);
  ok(mm.refused, "a seller whose receive() writes a memory inside a conduit fill is refused by validateOrder after the transfers", mm.data);
  const ln = await inFill(22n, (id) => [site.kiln, enc(KILN_LAUNCH, [id, "Inside", "INSIDE", 18, 10n ** 24n, word32(id), 0])]);
  ok(ln.refused, "a seller whose receive() launches a coin from the token inside a conduit fill is refused by validateOrder after the transfers", ln.data);
  const untouched = await Promise.all([tr, mm, ln].map(async (x) => (await ownerOf(x.id)) === low(x.sc)));
  ok(untouched.every(Boolean) &&
     decUint(await c.read(hub, "getTraitValue(uint256,bytes32)", [tr.id, NAME])) === 0n &&
     decUint(await c.read(journal, "countOf(address,uint256)", [hub, mm.id])) === 0n &&
     decUint(await c.read(site.launchpad, "launchRoot(uint256)", [ln.id])) === 0n,
     "and nothing moved in any of the three: each token is its seller's, with no trait, memory or launch written");
  {
    // the memory term at authorizeOrder: written after publishing, it moves the fingerprint the pin holds
    const idJ = await sealed(seller, end);
    const pinJ = await pinOf(idJ);
    const oJ = etherListing({ token: hub, id: idJ, seller: S, price: PRICE, royalty: ROY, receiver, zone: bazaar, zoneHash: pinJ.zh, start: now, end, salt: 23n });
    const sJ = await signed(seller, oJ);
    await relayer.send({ to: bazaar, data: enc(SIG.publish, [orderOf(sJ.o, sJ.sig), []]), label: "publish (INTACT, a memory after)" });
    await seller.exec(journal, INSCRIBE, [hub, idJ, 0, "0x" + Buffer.from("written after the listing").toString("hex"), ZERO32]);
    const rJ = await refusal(oJ, sJ.sig, PRICE);
    ok(!rJ.ok && rJ.data === err("FingerprintMoved(bytes32,bytes32)", pinJ.fp, await fpOf(idJ)),
       "a listing whose holder wrote a memory after publishing is refused at the fill with FingerprintMoved(pinned, live): the Journal's root is in the fingerprint", rJ.data);
  }

  /*──────────── any NFT ────────────*/
  head("a plain NFT, no zone");
  const art = await c.deploy(A("test/mocks/MockERC721.sol", "MockERC721").bytecode, "", "MockERC721");
  await c.exec(art, "mint(address,uint256)", [S, 77n]);
  await seller.exec(art, "setApprovalForAll(address,bool)", [SEAPORT, true]);
  const oP = etherListing({ token: art, id: 77n, seller: S, price: PRICE, royalty: 0n, receiver, start: now, end, salt: 9n });
  const sP = await signed(seller, oP);
  await publish(sP);
  const plain = c.getLogs({ address: bazaar, topics: [TOPIC.published, word32(art), word32(77n)] });
  ok(plain.length === 1 && low(decodePublished(plain[0]).orderHash) === low(sP.hash), "a plain MockERC721 listing with no zone is published and found by (token, id)");
  const fillP = await buyer.send({ to: SEAPORT, data: fillData(oP, sP.sig), value: PRICE, label: "fill (plain)" });
  eq(low(decAddr(await c.read(art, "ownerOf(uint256)", [77n]))), low(B), "and filled: the plain NFT is the buyer's");

  /*──────────── measured ────────────*/
  head("measured (this run)");
  note(`Bazaar runtime ${bazaarBytes} B, Bridges runtime ${bridgesBytes} B (EIP-170: 24,576)`);
  const avg = (xs) => xs.reduce((a, x) => a + x, 0n) / BigInt(xs.length);
  note(`gas (transactions): publish INTACT ${avg(published.intact)} average over ${published.intact.length}, publish plain ${avg(published.plain)}, ` +
       `fill INTACT ${fillA.gas}, fill INTACT with an open sealed market ${c.gas["fill (INTACT, open market)"]}, ` +
       `fill INTACT through a conduit ${fillW.gas}, fill plain ${fillP.gas}, ` +
       `accept a bid ${c.gas["accept a bid (INTACT)"]}, Bazaar deploy ${c.gas.Bazaar}, the door's execute ${set.gas}`);
  note(`gas (the zone alone, execution, one floor): authorizeOrder ${auth.gas}, validateOrder ${vald.gas}`);
  ok(published.intact.length === 9 && published.plain.length === 1, "nine INTACT orders and one plain order were published in this run");

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e && e.stack || e); console.log(`\n  ${pass} passed, ${fail + 1} failed\n`); process.exit(1); });
}
