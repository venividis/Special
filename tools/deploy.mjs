#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · deploying one band, through one factory, under fixed salts

  Origin: IPSEITY tools/testnet.mjs (preflight, registry gate, journal,
  read-back, record) and tools/site.mjs (`assertTiles`, `bandFor`, the
  prediction-then-assertion pattern); MASTER scripts/sepolia.mjs (the
  literal `--confirm` token before any I/O, atomic writes, resume from a
  journal, post-conditions parsed from creation events); the three
  public-RPC lag defences IPSEITY grew in three files, here as one helper
  each. Rewritten for INTACT U10 around two ideas the donors did not have:

  · CREATE3. Every satellite is deployed through `Create3Factory` under
    `salt = keccak("intact.v1.<key>")`, so its address is a function of
    (factory, key) and nothing else — not the initcode, not the band's
    constructor arguments, not the deployer's nonce. The factory itself is
    the one plain CREATE, from a FRESH burner at nonce 0, so the same key
    gives the same factory on every band and every address follows. The
    predictions are computed up front, fed into every constructor that
    pins another contract, and asserted after every step; a miss refuses
    to continue and nothing is published (DESIGN.md §12).

  · an adapter. The same function deploys over JSON-RPC (tools/rpc.mjs)
    and into the in-process EVM (tools/evm.mjs): `adapt(c)` wraps either
    as {deploy, exec, call, read, codeAt, getLogs, blockNumber, setCode?}
    so tools/verify-recover.mjs runs THIS code, not a copy of it, and what
    the suite verified is what the band gets.

  Two things DESIGN §12 says that this script does differently, on purpose:

  · The Engine is NOT deployed through the factory. Its constructor records
    `msg.sender` as the curator, and under CREATE3 that sender is the
    factory's single-use proxy, which can never call `loadHead`. The Engine
    is the second plain CREATE from the burner (nonce 2: factory at 0, the
    Timelock's factory call at 1), so its address is still the same on
    every band — it is predicted and asserted like every other — but by
    `keccak(rlp([burner, 2]))` rather than by a salt. The record says so
    (`engine.via`), and tools/recover-record.mjs recomputes it.
  · Engine shards are SSTORE2 pointers, CREATEd from the Engine's own
    nonce (1 + k for the k-th shard in load order), not salted. With the
    Engine at one address and dist/ byte-identical, the pointers are the
    same everywhere; the record stores them and recovery recomputes them.

  Order (DESIGN §12, every arrow a hard constraint where a constructor
  inspects code): factory → Timelock → Engine (load head, body, six
  panels; setEngineHash; freeze) → Crest → Reach impl → Grip impl →
  CatalogRows → CatalogText → CatalogState → Catalog → Renderer → hub (the
  four facets then IntactDiamond, or the monolith, by out/ship.json) →
  KeyRegistry → Roster → Postage → Parley → Locks → Pool → Coin template
  check → Kiln → Launchpad → Router (only where venues are configured) →
  Steward → Premises → post-conditions → recover-record in-process → the
  record is written LAST.

  Resume: every step is journaled to deployments/<chainId>.journal.json
  as soon as its receipt is in. A crashed run re-runs the same command;
  a step whose predicted address already holds code with the journaled
  codehash is skipped. Code at a prediction that the journal does not
  know is a refusal, not an adoption: the factory admits only the burner
  and the Timelock (`Create3Factory.NotDeployer`), so such code can only
  mean a run this journal does not know about, and a contract at our
  address that we did not put there is exactly what the record must not
  bless. On 31337 a journal whose deployer is back at nonce 0 describes a
  chain that no longer exists (the node was restarted); it is set aside
  with a line saying so and the run starts clean. Anywhere else that
  contradiction is a refusal.

  The order is declared once (`DEPLOY_ORDER`) and the journal's steps are
  asserted against it before the record is written, so a reordering is a
  refusal and not a silent difference between DESIGN §12 and the band.

    node tools/deploy.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL
    RPC_URL=… PRIVATE_KEY=0x… node tools/deploy.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA
      [--rpc URL] [--journal path] [--record path] [--price wei]

  `--record` names where the record is written (default
  deployments/<chainId>.json — a rehearsal that must not overwrite the
  committed fixture passes its own path); an option not in this list is
  refused. The record never carries the endpoint: on a real band RPC_URL
  is a keyed provider URL, and a record that named the node that verifies
  it would be choosing its own oracle.

  The key comes from the environment only. On a real band it MUST be a
  fresh burner at nonce 0 (checked; refused otherwise unless a journal
  names a run to resume); on 31337 a non-zero nonce is a warning, since
  hardhat's first account is nobody's burner.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { createAddressFromString, hexToBytes, bytesToHex, Account } from "@ethereumjs/util";
import { compile, artifact, shipRule, LIMIT } from "./compile.mjs";
import { enc, encodeParams, decAddr, decUint, decBool, TX_GAS_CAP } from "./evm.mjs";
import * as EVM from "./evm.mjs";
import { hubCut } from "./facets.mjs";
import { REGISTRY, REGISTRY_RUNTIME, ZERO, PANELS, CONFIG_TYPE, CATALOG_CONFIG_TYPE,
         predictCreate, encRequest, decResponse } from "./site.mjs";
/*  A static import, although recover-record.mjs imports this file back:
    ESM resolves a static cycle (each side touches the other's exports only
    inside functions), where a dynamic `import()` from this module while
    its own top-level await is pending can never settle — the first
    hardhat run deployed everything and then exited with code 13 at the
    recovery step, having published nothing.                             */
import { recover } from "./recover-record.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

export const kec = (b) => "0x" + Buffer.from(keccak256(Buffer.from(b))).toString("hex");
const kecHex = (hex) => kec(Buffer.from(hex.replace(/^0x/, ""), "hex"));
const low = (a) => String(a).toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*═══════════════════ bands, chains, tokens ═══════════════════*/

export const COLLECTION = 4096n;
/// DESIGN §12: three disjoint id bands, one chain each. `band` is the hub's
/// BAND immutable; `first`/`last` its bounds.
export const BANDS = {
  8453: { band: 1, name: "Base", first: 1n, last: 3072n },
  1:    { band: 0, name: "Ethereum", first: 3073n, last: 3584n },
  10:   { band: 2, name: "OP Mainnet", first: 3585n, last: 4096n }
};
/// A rehearsal chain takes the whole edition; any other unbanded chain is refused.
export const REHEARSAL = { 31337: "hardhat", 84532: "Base Sepolia", 11155111: "Sepolia" };
/// The literal token `--confirm` must carry, per chain. Checked before any
/// file or network access (MASTER's rule), so a wrong token costs nothing.
export const CONFIRM = {
  31337: "DEPLOY_INTACT_LOCAL", 84532: "DEPLOY_INTACT_TO_BASE_SEPOLIA", 11155111: "DEPLOY_INTACT_TO_SEPOLIA",
  8453: "DEPLOY_INTACT_TO_BASE", 1: "DEPLOY_INTACT_TO_ETHEREUM", 10: "DEPLOY_INTACT_TO_OP"
};
/// Per-chain venue addresses for the Router and the Kiln: SwapRouter02, the
/// v4 PoolManager and the wrapped native token. IPSEITY's rule applies —
/// every address here must have been PROBED for code on the date noted,
/// never recalled — and no chain has been probed yet, so the table is empty
/// and the Router is skipped (pinned as address(0) in the Catalog's letter
/// X, as the harness does). Filling a row is a deliberate, dated commit.
export const VENUES = {};

/// The bands tile the edition exactly once (IPSEITY `assertTiles`, verbatim
/// in intent): runs at import, throws on a backwards band, an overlap, a
/// hole or an edition not exhausted.
export function assertTiles(bands, total) {
  const rows = Object.values(bands).sort((a, b) => (a.first < b.first ? -1 : 1));
  let next = 1n;
  for (const r of rows) {
    if (r.last < r.first) throw new Error(`band ${r.name} runs backwards`);
    if (r.first < next) throw new Error(`band ${r.name} overlaps the one before it`);
    if (r.first > next) throw new Error(`ids ${next}..${r.first - 1n} belong to no band`);
    next = r.last + 1n;
  }
  if (next - 1n !== total) throw new Error(`the bands cover ${next - 1n} ids, the edition has ${total}`);
}
assertTiles(BANDS, COLLECTION);

export function bandOf(chainId) {
  const id = Number(chainId);
  if (BANDS[id]) return { ...BANDS[id], rehearsal: false };
  if (REHEARSAL[id]) return { band: 1, name: REHEARSAL[id], first: 1n, last: COLLECTION, rehearsal: true };
  throw new Error(`chain ${id} has no band and is not a rehearsal chain — refusing`);
}

/*═══════════════════ salts and predictions ═══════════════════*/

export const SALT_PREFIX = "intact.v1.";
export const saltOf = (key) => kec(Buffer.from(SALT_PREFIX + key, "utf8"));

/// Every record key that is a CREATE3 deployment, in deployment order. The
/// three post-MVB pins are predicted and codeless on every chain today.
export const SALTED = [
  "timelock", "crest", "reachImpl", "gripImpl",
  "catalogRows", "catalogText", "catalogState", "catalog", "renderer",
  "coreFacet", "rightsFacet", "mintFacet", "siteFacet", "hub",
  "keys", "roster", "postage", "parley", "locks", "pool", "kiln", "launchpad", "router", "steward", "premises"
];
export const PLACEHOLDERS = ["market", "roles", "agentCard"];
/// DESIGN §12's order as one list, asserted against the journal before the
/// record is written: the factory, the Timelock, the Engine (whose loads
/// are journaled apart), then every salted key. The facets exist only in
/// the diamond build and the Router only where a venue table exists, so
/// the assertion compares the journal with this list FILTERED to what the
/// run deployed, in this order.
export const DEPLOY_ORDER = ["factory", "timelock", "engine", ...SALTED.filter((k) => k !== "timelock")];
/// What a complete MVB record contains. `router` is present only where a
/// venue table exists for the chain; the facets only in the diamond build.
export const RECORD_KEYS = ["factory", "engine", ...SALTED];

export const PROXY_INITCODE_HASH = "0x21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f";

/// keccak(0xff ‖ factory ‖ salt ‖ keccak(proxy initcode)) is the proxy;
/// keccak(rlp([proxy, 1])) is what the proxy's first CREATE lands at. The
/// third implementation of this formula (the factory's `predict` and
/// test/Create3.t.sol hold the other two) — they check each other.
export function predictCreate3(factory, salt) {
  const proxy = kecHex("ff" + low(factory).slice(2) + salt.replace(/^0x/, "") + PROXY_INITCODE_HASH.slice(2)).slice(26);
  return "0x" + kecHex("d694" + proxy + "01").slice(26);
}

const DEPLOYED_TOPIC = kec(Buffer.from("Deployed(bytes32,address)", "utf8"));
const PANEL_TOPIC = kec(Buffer.from("PanelLoaded(uint256,address,uint256,bytes32)", "utf8"));
const LOADED_TOPIC = kec(Buffer.from("Loaded(bool,uint256,address,uint256)", "utf8"));

/*═══════════════════ the chain adapter ═══════════════════*/

/// One surface over tools/evm.mjs `Chain` and tools/rpc.mjs `RpcChain`:
///   from, chainId, deploy(code,args,label) → {address, logs, gas, block, hash}
///   exec(to,sig,args,{value,label}) → {logs, gas, block, hash}
///   call(to,data) / read(to,sig,args) → hex, codeAt(addr) → hex,
///   getLogs(filter), blockNumber(), nonceNow(), balanceOf, setCode?(addr,hex), gas
/// Logs are normalised to {address, topics[], data} lowercase hex whichever
/// side produced them.
export function adapt(c) {
  const inProcess = Boolean(c.vm);
  const hex = (u) => (typeof u === "string" ? low(u) : "0x" + Buffer.from(u).toString("hex"));
  const logsOf = (raw) => (raw || []).map((l) => Array.isArray(l)
    ? { address: hex(l[0]), topics: l[1].map(hex), data: hex(l[2]) }
    : { address: low(l.address), topics: l.topics.map(low), data: low(l.data) });
  const norm = async (r) => ({
    address: r.address ? low(r.address) : null, gas: r.gas, hash: r.hash || null,
    block: r.block !== undefined ? BigInt(r.block) : (inProcess ? EVM.BLOCK.header.number : 0n),
    logs: logsOf(r.logs)
  });
  const ad = {
    raw: c, inProcess,
    chainId: Number(c.chainId ?? (c.common ? c.common.chainId() : c.vm ? c.vm.common.chainId() : 1)),
    from: low(c.from.toString()), gas: c.gas,
    deploy: async (code, args = "", label = "") => norm(await c.send({ data: code + args.replace(/^0x/, ""), label })),
    exec: async (to, sig, args = [], o = {}) => norm(await c.exec(to, sig, args, o)),
    call: (to, data) => c.call(to, data),
    read: (to, sig, args = []) => c.read(to, sig, args),
    getLogs: (f) => c.getLogs(f),
    nonceNow: () => c.nonceNow(),
    balanceOf: (a) => c.balanceOf(a),
    codeAt: async (addr) => inProcess
      ? bytesToHex(await c.vm.stateManager.getCode(createAddressFromString(addr)))
      : low(await c.rpc("eth_getCode", [addr, "latest"])),
    blockNumber: async () => inProcess ? EVM.BLOCK.header.number : BigInt(await c.rpc("eth_blockNumber"))
  };
  if (inProcess) {
    ad.setCode = async (addr, codeHex) => {
      const a = createAddressFromString(addr);
      if (!(await c.vm.stateManager.getAccount(a))) await c.vm.stateManager.putAccount(a, new Account());
      await c.vm.stateManager.putCode(a, hexToBytes(codeHex));
    };
  } else if (ad.chainId === 31337) {
    ad.setCode = (addr, codeHex) => c.rpc("hardhat_setCode", [addr, codeHex]);
  }
  return ad;
}

/*═══════════════════ the three lag defences ═══════════════════*/

/// Wait until `addr` holds code — before any constructor that inspects a
/// fresh deployment. A lagging replica replays `eth_estimateGas` against a
/// state where the dependency is still `0x`, reports a revert, and the
/// deploy dies on a false negative.
export async function awaitCode(ad, addr, what = addr) {
  for (let i = 0; i < 12; i++) {
    const code = await ad.codeAt(addr);
    if (code && code !== "0x") return code;
    await sleep(ad.inProcess ? 0 : 500 * (i + 1));
  }
  throw new Error(`no code at ${what} (${addr}) after waiting — the endpoint never caught up`);
}

/// Block until the endpoint reports at least block `n` (the receipt's).
export async function awaitBlock(ad, n) {
  for (let i = 0; i < 40; i++) {
    if ((await ad.blockNumber()) >= BigInt(n)) return;
    await sleep(ad.inProcess ? 0 : 750);
  }
  throw new Error(`the endpoint never reached block ${n}`);
}

/// Receipt logs by topic — ids and addresses come from here, never from a
/// read after the write.
export const logsBy = (logs, address, topic0) =>
  logs.filter((l) => l.address === low(address) && l.topics[0] === topic0);

/*═══════════════════ ABI decoding beyond evm.mjs ═══════════════════*/

/// A dynamic array of 32-byte words at head word `at`.
export function decWords(hex, at = 0) {
  const h = hex.replace(/^0x/, "");
  const base = Number(BigInt("0x" + h.substr(at * 64, 64))) * 2;
  const n = Number(BigInt("0x" + h.substr(base, 64)));
  const out = [];
  for (let i = 0; i < n; i++) out.push("0x" + h.substr(base + 64 + i * 64, 64));
  return out;
}
export const decAddrs = (hex) => decWords(hex).map((w) => "0x" + w.slice(26));
export const decBytes4s = (hex) => decWords(hex).map((w) => w.slice(0, 10));

/*═══════════════════ what deploy and recover both walk ═══════════════════*/

/// [holder key, getter, target key]: every immutable pin that is an address,
/// read back after deployment and again by recover-record. Mutual pairs
/// appear as two rows (hub.POOL and pool.HUB), so a one-sided pin is a
/// disagreement in one direction and a contradiction in the other.
export const PINS = [
  ["factory", "TIMELOCK()", "timelock"],
  ["hub", "REACH_IMPL()", "reachImpl"], ["hub", "GRIP_IMPL()", "gripImpl"],
  ["hub", "STEWARD()", "steward"], ["hub", "MARKET()", "market"], ["hub", "ROLES()", "roles"],
  ["hub", "POOL()", "pool"], ["hub", "PARLEY()", "parley"], ["hub", "LAUNCHPAD()", "launchpad"],
  ["hub", "LOCKS()", "locks"], ["hub", "RENDERER()", "renderer"], ["hub", "CATALOG()", "catalog"],
  ["hub", "PREMISES()", "premises"], ["hub", "TIMELOCK()", "timelock"],
  ["catalog", "HUB()", "hub"], ["catalog", "ENGINE()", "engine"], ["catalog", "ROUTER()", "router"],
  ["catalog", "ROSTER()", "roster"], ["catalog", "POSTAGE()", "postage"], ["catalog", "KEYS()", "keys"],
  ["catalog", "KILN()", "kiln"], ["catalog", "AGENTCARD()", "agentCard"], ["catalog", "REACH_IMPL()", "reachImpl"],
  ["catalog", "GRIP_IMPL()", "gripImpl"], ["catalog", "POOL()", "pool"], ["catalog", "PARLEY()", "parley"],
  ["catalog", "LAUNCHPAD()", "launchpad"], ["catalog", "LOCKS()", "locks"], ["catalog", "STEWARD()", "steward"],
  ["catalog", "MARKET()", "market"], ["catalog", "ROLES()", "roles"], ["catalog", "TIMELOCK()", "timelock"],
  ["catalog", "PREMISES()", "premises"], ["catalog", "RENDERER()", "renderer"],
  ["catalog", "TEXT()", "catalogText"], ["catalog", "STATE()", "catalogState"],
  ["catalogState", "TEXT()", "catalogText"], ["catalogText", "ROWS()", "catalogRows"],
  ["renderer", "HUB()", "hub"], ["renderer", "ENGINE()", "engine"], ["renderer", "CREST()", "crest"],
  ["renderer", "CATALOG()", "catalog"], ["renderer", "AGENTCARD()", "agentCard"],
  ["premises", "HUB()", "hub"], ["premises", "RENDERER()", "renderer"], ["premises", "ENGINE()", "engine"],
  ["premises", "CATALOG()", "catalog"], ["premises", "CREST()", "crest"], ["premises", "AGENTCARD()", "agentCard"],
  ["parley", "HUB()", "hub"], ["parley", "KEYS()", "keys"], ["parley", "POSTAGE()", "postage"],
  ["postage", "HUB()", "hub"], ["postage", "PARLEY()", "parley"],
  ["roster", "PARLEY()", "parley"], ["roster", "HUB()", "hub"],
  ["pool", "HUB()", "hub"], ["pool", "LAUNCHPAD()", "launchpad"],
  ["kiln", "HUB()", "hub"], ["kiln", "LAUNCHPAD()", "launchpad"],
  ["launchpad", "HUB()", "hub"], ["launchpad", "KILN()", "kiln"], ["launchpad", "POOL()", "pool"], ["launchpad", "LOCKS()", "locks"],
  ["kiln", "POOL_MANAGER()", "venuePoolManager"],
  ["locks", "HUB()", "hub"], ["steward", "HUB()", "hub"],
  ["router", "HUB()", "hub"], ["router", "POOL()", "pool"],
  ["router", "SWAP_ROUTER02()", "venueSwapRouter02"], ["router", "POOL_MANAGER()", "venuePoolManager"], ["router", "WETH()", "venueWeth"]
];
/// The venue table's addresses as PINS targets (`venue*` keys), so the
/// Kiln's and the Router's venue immutables are read back like every other
/// pin: a record that lies about `venues.poolManager` is caught by name,
/// not only by the Router's codehash. Absent venues pin as address(0).
export const venueTargets = (venues) => ({
  venuePoolManager: venues?.poolManager || ZERO, venueSwapRouter02: venues?.swapRouter02 || ZERO, venueWeth: venues?.weth || ZERO
});
/// The Router's bytes32 immutables: [getter, what the chain must say given
/// the record]. POOL_HASH is the Pool's codehash at construction; the two
/// venue hashes are the venues' codehashes or zero when the venue is absent;
/// the hook codehash is the table's.
export const ROUTER_HASHES = ["POOL_HASH()", "SWAP_ROUTER02_HASH()", "POOL_MANAGER_HASH()", "LAUNCH_HOOK_CODEHASH()"];
/// Non-address immutables of the hub and the Catalog, read back as numbers.
export const BAND_GETTERS = [["hub", "BAND()"], ["hub", "BAND_LO()"], ["hub", "BAND_HI()"],
                             ["catalog", "BAND()"], ["catalog", "BAND_LO()"], ["catalog", "BAND_HI()"]];

/*═══════════════════ journal ═══════════════════*/

/// tmp + rename, mode 0o600: a crash mid-write leaves the old file, never
/// half of the new one. Public receipt data only — never the key.
export function atomicWrite(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, (k, v) => (typeof v === "bigint" ? v.toString() : v), 1) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/*═══════════════════ inputs ═══════════════════*/

export function readDist() {
  const p = path.join(ROOT, "dist/shards.json");
  if (!fs.existsSync(p)) throw new Error("dist/shards.json is missing — run `node tools/build-app.mjs`");
  const plan = JSON.parse(fs.readFileSync(p, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "dist/manifest.json"), "utf8"));
  if (plan.mode !== "packed") throw new Error(`dist/shards.json mode is ${plan.mode}, not packed`);
  return { plan, manifest };
}

export function toolchain() {
  const solc = require("solc");
  return { solc: solc.version(), optimizerRuns: 800, viaIR: true, evmVersion: "cancun", bytecodeHash: "none", eip170: LIMIT };
}

/*═══════════════════ the deployment ═══════════════════*/

/**
 * Deploy the whole band through `ad` (an adapted chain). Returns the record.
 * Throws — and writes no record — on any prediction miss, any post-condition
 * failure, or any disagreement recover-record finds.
 *
 * opts: out, plan, manifest, price, venues, journalPath (null = in memory),
 *       recordPath (null = return only; undefined = deployments/<chainId>.json),
 *       band override, log(line),
 *       mispredict {key: address} — a TEST hook that feeds a wrong prediction
 *       into every constructor that pins `key`, so the refusal can be proved.
 */
export async function deployIntact(ad, opts = {}) {
  const log = opts.log || (() => {});
  const out = opts.out || compile({ quiet: true });
  const A = (f, n) => artifact(out, f, n);
  const { plan, manifest } = opts.plan ? { plan: opts.plan, manifest: opts.manifest } : readDist();
  const price = opts.price ?? 10n ** 16n;
  const chainId = ad.chainId;
  const band = opts.band || bandOf(chainId);
  const venues = opts.venues !== undefined ? opts.venues : (VENUES[chainId] || null);
  const ship = { ...shipRule(out), limit: LIMIT, solc: toolchain().solc };
  if (ship.build !== "diamond" && ship.build !== "monolith") throw new Error(`the ship rule is ${ship.build}: ${ship.reason}`);
  const from = ad.from;

  /// the in-process EVM is never a public chain; anything over a wire is
  if (plan.placeholder && chainId !== 31337 && !ad.inProcess) {
    throw new Error("dist/ holds the PLACEHOLDER shell from tools/fixtures/ — refusing to deploy it anywhere but 31337");
  }

  /*── the journal: resume if one exists for this deployer ──*/
  const journalPath = opts.journalPath === undefined ? path.join(ROOT, "deployments", `${chainId}.journal.json`) : opts.journalPath;
  let journal = { schema: "intact.journal/1", chainId, deployer: from, startedAt: new Date().toISOString(), steps: {}, loads: [] };
  if (journalPath && fs.existsSync(journalPath)) {
    const j = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    if (low(j.deployer) !== from) throw new Error(`${journalPath} belongs to deployer ${j.deployer}, this key is ${from}`);
    const done = Object.keys(j.steps).length;
    if (done && (await ad.nonceNow()) === 0n) {
      /*  The journal says this key sent transactions; the chain says it
          never did. On 31337 that is a restarted node and the journal is
          stale: set aside (never deleted — it is the only account of
          what the old chain held) and start clean. Anywhere else the two
          cannot both be true and nothing is sent.                       */
      if (chainId !== 31337) throw new Error(`${path.relative(ROOT, journalPath)} records ${done} step(s) by ${from}, but the chain has ${from} at nonce 0 — a different chain, or an endpoint far behind; refusing`);
      const aside = journalPath.replace(/\.json$/, "") + `.stale-${Date.now()}.json`;
      fs.renameSync(journalPath, aside);
      log(`  the journal (${done} step(s)) names a run this chain never saw — the local node was restarted; set aside as ${path.relative(ROOT, aside)}, starting clean`);
    } else {
      journal = j;
      log(`  resuming from ${path.relative(ROOT, journalPath)} (${done} step(s) done)`);
    }
  }
  const save = () => { if (journalPath) atomicWrite(journalPath, journal); };
  const gasOf = {};
  /// every receipt is held to the EIP-7825 transaction cap (DESIGN §12:
  /// "the deployer refuses post-EIP-8037 chunks over the 2^24 cap") — a
  /// step that spent more could not be included on a Fusaka chain
  const took = (label, r) => {
    if (BigInt(r.gas || 0n) > TX_GAS_CAP) throw new Error(`${label} used ${r.gas} gas, over the 2^24 transaction cap — not includable on a Fusaka chain`);
    gasOf[label] = (gasOf[label] || 0n) + BigInt(r.gas || 0n); return r;
  };

  /*── the registry: canonical address, real runtime, checked by codehash ──*/
  const registryCode = await ad.codeAt(REGISTRY);
  if (registryCode === "0x") {
    if (!ad.setCode) {
      throw new Error("no code at the canonical ERC-6551 registry on this chain; deploy the reference " +
                      "registry via its published CREATE2 transaction first");
    }
    await ad.setCode(REGISTRY, REGISTRY_RUNTIME);
    log("  etched the ERC-6551 registry runtime at its canonical address (local chain)");
  }
  const registryHash = kecHex(await ad.codeAt(REGISTRY));
  if (registryHash !== kecHex(REGISTRY_RUNTIME)) throw new Error(`the registry at ${REGISTRY} is not the reference runtime (${registryHash})`);

  /*── the factory: the one plain CREATE, from the burner at nonce 0 ──*/
  const nonce0 = await ad.nonceNow();
  let factory;
  if (journal.steps.factory) {
    factory = low(journal.steps.factory.address);
    if ((await ad.codeAt(factory)) === "0x") {
      throw new Error(`the journal names a factory at ${factory} with no code — a different chain, or an endpoint far behind` +
                      (chainId === 31337 ? `; if the local node was restarted, remove ${journalPath ? path.relative(ROOT, journalPath) : "the journal"} and run again` : ""));
    }
  } else {
    if (nonce0 !== 0n) {
      const msg = `the deployer ${from} is at nonce ${nonce0}, not 0 — the factory's address, and so every address, would differ from the other bands'`;
      if (chainId === 31337 || opts.allowUsedBurner) log("  WARNING " + msg); else throw new Error(msg);
    }
    const want = predictCreate(from, nonce0);
    const r = took("factory", await ad.deploy(A("src/lib/Create3Factory.sol", "Create3Factory").bytecode, "", "factory"));
    await awaitBlock(ad, r.block);
    if (r.address !== want) throw new Error(`the factory landed at ${r.address}, predicted ${want}`);
    factory = want;
    journal.factoryNonce = nonce0.toString();
    journal.steps.factory = { address: factory, codehash: kecHex(await ad.codeAt(factory)), gas: r.gas.toString(), tx: r.hash, block: r.block.toString() };
    save();
  }
  log(`  factory ${factory}`);

  /*── every CREATE3 address, up front ──*/
  const salts = {};
  for (const k of [...SALTED, ...PLACEHOLDERS]) salts[k] = saltOf(k);
  const P = {};
  for (const k of Object.keys(salts)) P[k] = predictCreate3(factory, salts[k]);
  /// the gate the factory was built with: this key, and the Timelock's
  /// predicted address — checked now, since every later step depends on it
  const gateDeployer = low(decAddr(await ad.read(factory, "DEPLOYER()")));
  if (gateDeployer !== from) throw new Error(`the factory's DEPLOYER is ${gateDeployer}, this key is ${from} — this key cannot deploy through it`);
  const gateTimelock = low(decAddr(await ad.read(factory, "TIMELOCK()")));
  if (gateTimelock !== P.timelock) throw new Error(`the factory's TIMELOCK is ${gateTimelock}, the timelock salt predicts ${P.timelock}`);
  /// what the constructors are TOLD (the test hook may lie here; the chain never does)
  const T = { ...P, ...(opts.mispredict || {}) };
  if (!venues) { P.router = ZERO; T.router = ZERO; }

  const got = { factory }; // key → deployed address
  const codehashes = {};  // key → extcodehash
  const reproducible = {};// key → codehash equals keccak(compiled runtime)

  /// One CREATE3 step: resume or deploy, then prove the address from the
  /// factory's own event and the code from the chain.
  const create3 = async (key, file, name, argsHex = "", inspects = []) => {
    const art = A(file, name);
    const init = art.bytecode + argsHex.replace(/^0x/, "");
    const initBytes = (init.length - 2) / 2;
    if (initBytes > 49_152) throw new Error(`${key}'s initcode is ${initBytes} bytes, over EIP-3860's 49,152`);
    const want = P[key];
    const have = await ad.codeAt(want);
    if (have !== "0x") {
      const j = journal.steps[key];
      if (j && low(j.address) === want && j.codehash === kecHex(have)) {
        log(`  ${key.padEnd(13)} ${want}  (journaled, skipped)`);
      } else {
        throw new Error(`code at ${key}'s predicted address ${want} that this run's journal does not account for — ` +
                        `someone else used salt ${salts[key]}; refusing`);
      }
    } else {
      for (const a of inspects) await awaitCode(ad, a.addr, a.what);
      const r = took(key, await ad.exec(factory, "deploy(bytes32,bytes)", [salts[key], init], { label: key }));
      await awaitBlock(ad, r.block);
      const ev = logsBy(r.logs, factory, DEPLOYED_TOPIC).filter((l) => l.topics[1] === salts[key]);
      if (ev.length !== 1) throw new Error(`${key}: expected one Deployed event from the factory, saw ${ev.length}`);
      const landed = "0x" + ev[0].topics[2].slice(26);
      if (landed !== want) throw new Error(`a prediction missed: ${key} predicted ${want}, landed ${landed} — refusing to continue`);
      journal.steps[key] = { address: want, salt: salts[key], codehash: kecHex(await ad.codeAt(want)),
                             gas: r.gas.toString(), tx: r.hash, block: r.block.toString() };
      save();
      log(`  ${key.padEnd(13)} ${want}  ${(Number(r.gas) / 1e6).toFixed(2)}M gas`);
    }
    got[key] = want;
    codehashes[key] = journal.steps[key].codehash;
    reproducible[key] = codehashes[key] === kecHex(art.deployed);
    return want;
  };
  const code = (key) => ({ addr: got[key] || P[key], what: key });

  /*── 2. Timelock(admin = burner) ──*/
  await create3("timelock", "src/Timelock.sol", "Timelock", encodeParams("address", [from]));

  /*── 3. Engine: plain CREATE (curator = msg.sender), then the shards ──*/
  let engine;
  if (journal.steps.engine) {
    engine = low(journal.steps.engine.address);
    if ((await ad.codeAt(engine)) === "0x") throw new Error("the journal names an Engine with no code");
  } else {
    const n = await ad.nonceNow();
    const want = predictCreate(from, n);
    if ((await ad.codeAt(want)) !== "0x") throw new Error(`code already at the Engine's predicted address ${want}`);
    const r = took("engine", await ad.deploy(A("src/Engine.sol", "Engine").bytecode, "", "engine"));
    await awaitBlock(ad, r.block);
    if (r.address !== want) throw new Error(`a prediction missed: engine predicted ${want} (CREATE from ${from} at nonce ${n}), landed ${r.address}`);
    engine = want;
    journal.steps.engine = { address: engine, via: { create: { from, nonce: n.toString() } }, codehash: kecHex(await ad.codeAt(engine)),
                             gas: r.gas.toString(), tx: r.hash, block: r.block.toString() };
    save();
    log(`  ${"engine".padEnd(13)} ${engine}  (CREATE from the burner at nonce ${n})`);
  }
  got.engine = engine;
  codehashes.engine = journal.steps.engine.codehash;
  reproducible.engine = codehashes.engine === kecHex(A("src/Engine.sol", "Engine").deployed);

  /// Loads are idempotent against the chain: what is already there is
  /// counted, what is missing is sent. `dropLast` is never called (it would
  /// desynchronise the Engine's nonce from the shard sequence the record
  /// predicts). Each pointer comes from the receipt's own `Loaded` /
  /// `PanelLoaded` log (the second lag defence: the receipt is the only
  /// thing the node has already proved) and is journaled with the load; a
  /// shard a resumed run finds already on the chain takes its pointer from
  /// the journal, or, when the journal predates this field, from the
  /// chain's public arrays. The endpoint is held to each receipt's block
  /// before the next read (the third defence) — the first version of this
  /// script read the pointers back after the writes and waited for no
  /// block, which a reviewer measured against the header's claim.
  const pointers = { head: [], body: [], panels: [] };
  const pointerOf = (kind, i) => journal.loads.find((l) => l.kind === kind && l.i === i && l.pointer)?.pointer;
  const loadedPointer = (r, topic, i) => {
    const ev = logsBy(r.logs, engine, topic);
    if (ev.length !== 1) throw new Error(`load ${i}: expected one ${topic === LOADED_TOPIC ? "Loaded" : "PanelLoaded"} event from the Engine, saw ${ev.length}`);
    // Loaded(bool isHead, uint256 index, address pointer, uint256 size): the pointer is data word 2;
    // PanelLoaded(uint256 indexed index, address pointer, uint256 size, bytes32 hash): data word 0
    return low(decAddr(ev[0].data, topic === LOADED_TOPIC ? 2 : 0));
  };
  const frozen0 = decBool(await ad.read(engine, "frozen()"));
  if (!frozen0) {
    const counts = await ad.read(engine, "shardCount()");
    const nh = Number(decUint(counts, 0)), nb = Number(decUint(counts, 1));
    for (let i = nh; i < plan.head.length; i++) {
      const r = took("loadHead", await ad.exec(engine, "loadHead(bytes)", [plan.head[i].data], { label: "loadHead" }));
      await awaitBlock(ad, r.block);
      journal.loads.push({ kind: "head", i, pointer: loadedPointer(r, LOADED_TOPIC, i), tx: r.hash, gas: r.gas.toString(), block: r.block.toString() }); save();
    }
    for (let i = nb; i < plan.body.length; i++) {
      const r = took("loadBody", await ad.exec(engine, "loadBody(bytes)", [plan.body[i].data], { label: "loadBody" }));
      await awaitBlock(ad, r.block);
      journal.loads.push({ kind: "body", i, pointer: loadedPointer(r, LOADED_TOPIC, i), tx: r.hash, gas: r.gas.toString(), block: r.block.toString() }); save();
    }
    for (let i = 0; i < plan.panels.length; i++) {
      const p = plan.panels[i];
      const have = await ad.read(engine, "panelHash(uint256)", [i]);
      if (low(have) === low(p.hash)) continue;
      const r = took("loadPanel", await ad.exec(engine, "loadPanel(uint256,bytes,bytes32)", [i, p.data, p.hash], { label: "loadPanel" }));
      await awaitBlock(ad, r.block);
      journal.loads.push({ kind: "panel", i, pointer: loadedPointer(r, PANEL_TOPIC, i), tx: r.hash, gas: r.gas.toString(), block: r.block.toString() }); save();
    }
    if (low(await ad.read(engine, "engineHash()")) !== low(plan.engineHash)) {
      const r = took("setEngineHash", await ad.exec(engine, "setEngineHash(bytes32,uint32)", [plan.engineHash, plan.inflatedSize], { label: "setEngineHash" }));
      await awaitBlock(ad, r.block);
      journal.loads.push({ kind: "setEngineHash", tx: r.hash, gas: r.gas.toString(), block: r.block.toString() }); save();
    }
    const fr = took("freeze", await ad.exec(engine, "freeze()", [], { label: "freeze" }));
    await awaitBlock(ad, fr.block);
    journal.loads.push({ kind: "freeze", tx: fr.hash, gas: fr.gas.toString(), block: fr.block.toString() }); save();
    log(`  engine loaded: ${plan.head.length} head, ${plan.body.length} body, ${plan.panels.length} panels; frozen`);
  } else {
    log("  engine already frozen (resumed)");
  }
  // the pointers: from the receipts (via the journal) where this or a
  // resumed run sent the load, else from the chain's public arrays; every
  // one then asserted against CREATE(engine, 1 + k) in load order — head,
  // body, then panels — which is what the record and the recovery predict
  for (let i = 0; i < plan.head.length; i++) pointers.head.push(pointerOf("head", i) || low(decAddr(await ad.read(engine, "head(uint256)", [i]))));
  for (let i = 0; i < plan.body.length; i++) pointers.body.push(pointerOf("body", i) || low(decAddr(await ad.read(engine, "body(uint256)", [i]))));
  const shardBase = 1 + plan.head.length + plan.body.length;
  for (let i = 0; i < plan.panels.length; i++) pointers.panels.push(pointerOf("panel", i) || predictCreate(engine, shardBase + i));
  pointers.head.forEach((a, i) => { if (low(a) !== low(predictCreate(engine, 1 + i))) throw new Error(`head shard ${i} is not at CREATE(engine, ${1 + i})`); });
  pointers.body.forEach((a, i) => { if (low(a) !== low(predictCreate(engine, 1 + plan.head.length + i))) throw new Error(`body shard ${i} is not at CREATE(engine, ${1 + plan.head.length + i})`); });
  pointers.panels.forEach((a, i) => { if (low(a) !== low(predictCreate(engine, shardBase + i))) throw new Error(`panel ${PANELS[i]} is not at CREATE(engine, ${shardBase + i})`); });
  for (let i = 0; i < plan.panels.length; i++) {
    const c = await ad.codeAt(pointers.panels[i]);
    if (kecHex(c.slice(4)) !== low(plan.panels[i].gzipHash)) throw new Error(`panel ${PANELS[i]}'s pointer ${pointers.panels[i]} does not hold its gzip bytes`);
  }

  /*── 4–6. Crest, Reach impl, Grip impl ──*/
  await create3("crest", "src/Crest.sol", "Crest");
  await create3("reachImpl", "src/Reach.sol", "Reach");
  await create3("gripImpl", "src/Grip.sol", "Grip");

  /*── 7. the Catalog: three companions, then the façade (checks text/state code) ──*/
  const byLetter = [T.hub, T.pool, ZERO, T.parley, T.roster, T.postage, T.keys, T.kiln, T.launchpad, ZERO,
                    T.locks, T.steward, T.router, ZERO, engine, T.catalog];                 // HPRYTSKNLCOWXEGQ
  await create3("catalogRows", "src/Catalog.sol", "CatalogRows", encodeParams("address[16]", [byLetter]));
  await create3("catalogText", "src/Catalog.sol", "CatalogText", encodeParams("address", [got.catalogRows]), [code("catalogRows")]);
  await create3("catalogState", "src/Catalog.sol", "CatalogState", encodeParams("address", [got.catalogText]), [code("catalogText")]);
  await create3("catalog", "src/Catalog.sol", "Catalog", encodeParams(CATALOG_CONFIG_TYPE, [[
    T.hub, engine, T.router, T.roster, T.postage, T.keys, T.kiln, T.agentCard,
    got.reachImpl, got.gripImpl, T.pool, T.parley, T.launchpad, T.locks, T.steward, T.market, T.roles,
    got.timelock, T.premises, T.renderer, band.band, band.first, band.last, got.catalogText, got.catalogState]]),
    [code("catalogText"), code("catalogState")]);

  /*── 8. Renderer ──*/
  await create3("renderer", "src/Renderer.sol", "Renderer",
    encodeParams("address,address,address,address,address", [T.hub, engine, got.crest, got.catalog, T.agentCard]));

  /*── 9. the hub, by the ship rule, under one salt either way ──*/
  const config = [got.reachImpl, got.gripImpl, band.band, band.first, band.last, T.steward, T.market, T.roles, T.pool, T.parley,
                  T.launchpad, T.locks, got.renderer, got.catalog, T.premises, got.timelock];
  const cfg = encodeParams(CONFIG_TYPE, [config]);
  let facets = null, cut = null;
  if (ship.build === "diamond") {
    facets = {};
    for (const [key, name] of [["coreFacet", "CoreFacet"], ["rightsFacet", "RightsFacet"], ["mintFacet", "MintFacet"], ["siteFacet", "SiteFacet"]]) {
      facets[name] = await create3(key, `src/hub/facets/${name}.sol`, name, cfg, [code("reachImpl"), code("gripImpl")]);
    }
    cut = hubCut(out, facets).cut;
    await create3("hub", "src/hub/IntactDiamond.sol", "IntactDiamond",
      encodeParams("(address,uint8,bytes4[])[],uint256", [cut.map((x) => [x.facetAddress, 0, x.functionSelectors]), price]),
      Object.values(facets).map((a) => ({ addr: a, what: "facet" })));
  } else {
    await create3("hub", "src/hub/Intact.sol", "Intact", encodeParams(CONFIG_TYPE + ",uint256", [config, price]),
      [code("reachImpl"), code("gripImpl")]);
  }

  /*── 10–18. the satellites ──*/
  await create3("keys", "src/KeyRegistry.sol", "KeyRegistry");
  await create3("roster", "src/Roster.sol", "Roster", encodeParams("address,address", [T.parley, got.hub]));
  await create3("postage", "src/Postage.sol", "Postage", encodeParams("address,address", [got.hub, T.parley]));
  await create3("parley", "src/Parley.sol", "Parley", encodeParams("address,address,address", [got.hub, got.keys, got.postage]));
  await create3("locks", "src/Locks.sol", "Locks", encodeParams("address", [got.hub]));
  await create3("pool", "src/Pool.sol", "Pool", encodeParams("address,address", [got.hub, T.launchpad]));

  // the Coin template check: the Kiln carries type(Coin).creationCode; the
  // compiled Coin must be the bytes it carries, and its keccak is recorded
  const coinCode = A("src/Coin.sol", "Coin").bytecode.slice(2);
  if (!A("src/Kiln.sol", "Kiln").deployed.includes(coinCode)) throw new Error("the compiled Coin creation code is not what Kiln.sol carries");
  const coinTemplate = { bytes: coinCode.length / 2, keccak: kecHex(coinCode) };

  await create3("kiln", "src/Kiln.sol", "Kiln", encodeParams("address,address,address", [got.hub, T.launchpad, venues ? venues.poolManager : ZERO]));
  await create3("launchpad", "src/Launchpad.sol", "Launchpad", encodeParams("address,address,address,address", [got.hub, got.kiln, got.pool, got.locks]));

  /*── 19. Router, only where a probed venue table exists; else pinned zero ──*/
  if (venues) {
    await create3("router", "src/Router.sol", "Router",
      encodeParams("address,address,address,address,address,bytes32",
        [got.hub, got.pool, venues.swapRouter02 || ZERO, venues.poolManager || ZERO, venues.weth || ZERO, venues.launchHookCodehash || "0x" + "00".repeat(32)]),
      [code("pool")]);
  } else {
    log("  router        skipped — no probed venue table for this chain; pinned as address(0)");
  }

  /*── 20–21. Steward, Premises ──*/
  await create3("steward", "src/Steward.sol", "Steward", encodeParams("address", [got.hub]));
  await create3("premises", "src/Premises.sol", "Premises",
    encodeParams("address,address,address,address,address,address", [got.hub, got.renderer, engine, got.catalog, got.crest, T.agentCard]));

  /*═══════════════════ post-conditions: refuse to publish on any miss ═══════════════════*/
  const world = { ...got, factory, market: P.market, roles: P.roles, agentCard: P.agentCard, ...venueTargets(venues) };
  if (!venues) world.router = ZERO;
  const fail = (m) => { throw new Error("refusing to publish: " + m); };

  // the order performed is the order declared (DESIGN §12)
  const performed = Object.keys(journal.steps);
  const declared = DEPLOY_ORDER.filter((k) => journal.steps[k]);
  if (JSON.stringify(performed) !== JSON.stringify(declared)) fail(`the steps were performed as [${performed}], DESIGN §12 declares [${declared}]`);
  for (const k of performed) if (!DEPLOY_ORDER.includes(k)) fail(`the journal holds a step DESIGN §12 does not name: ${k}`);

  // the factory's gate
  if (low(decAddr(await ad.read(factory, "DEPLOYER()"))) !== from) fail("the factory's DEPLOYER is not the burner");

  // every pin, both ways
  for (const [holder, getter, target] of PINS) {
    if (!got[holder]) continue;                                  // the Router may be absent
    const have = low(decAddr(await ad.read(got[holder], getter)));
    const want = low(world[target] ?? ZERO);
    if (have !== want) fail(`the ${holder}'s ${getter.replace("()", "")} is ${have}, ${target} was deployed at ${want} (a mis-predicted ${target.toUpperCase()})`);
  }
  for (const [holder, getter] of BAND_GETTERS) {
    const have = decUint(await ad.read(got[holder], getter));
    const want = getter === "BAND()" ? BigInt(band.band) : getter === "BAND_LO()" ? band.first : band.last;
    if (have !== want) fail(`the ${holder}'s ${getter} is ${have}, the band says ${want}`);
  }
  if (low(decAddr(await ad.read(got.hub, "REGISTRY()"))) !== low(REGISTRY)) fail("the hub's REGISTRY is not the canonical address");

  // the Catalog agrees with the hub
  const ag = await ad.read(got.catalog, "agrees()");
  if (!decBool(ag, 0)) fail(`Catalog.agrees() is false; the first disagreeing getter is 0x${ag.replace(/^0x/, "").slice(64, 72)}`);

  // the hub's form matches the ship rule
  let facetRecord = null;
  if (ship.build === "diamond") {
    const addrs = decAddrs(await ad.read(got.hub, "facetAddresses()")).map(low).sort();
    const wantF = Object.values(facets).map(low).sort();
    if (JSON.stringify(addrs) !== JSON.stringify(wantF)) fail("the diamond's facetAddresses() are not the four facets deployed");
    if (low(decAddr(await ad.read(got.hub, "facetAddress(bytes4)", ["0x1f931c1c"]))) !== ZERO) fail("the diamond routes diamondCut");
    const hubHash = await ad.read(got.hub, "intactConfigHash()");
    facetRecord = {};
    for (const [name, addr] of Object.entries(facets)) {
      if ((await ad.read(addr, "intactConfigHash()")) !== hubHash) fail(`${name}'s intactConfigHash differs from the hub's`);
      const sels = decBytes4s(await ad.read(got.hub, "facetFunctionSelectors(address)", [addr])).sort();
      const wantS = cut.find((x) => low(x.facetAddress) === low(addr)).functionSelectors.map(low).sort();
      if (JSON.stringify(sels) !== JSON.stringify(wantS)) fail(`${name}'s selectors on chain are not the derived cut`);
      const key = name[0].toLowerCase() + name.slice(1);
      facetRecord[name] = { address: low(addr), codehash: codehashes[key], selectors: wantS };
    }
    if (decUint(await ad.read(got.hub, "price()")) !== price) fail("the hub's price is not the initial price");
  } else {
    let loupe = false;
    try { await ad.read(got.hub, "facetAddresses()"); loupe = true; } catch { /* a monolith has no loupe */ }
    if (loupe) fail("the ship rule says monolith and the hub answers the loupe");
  }

  // the Engine
  if (!decBool(await ad.read(engine, "frozen()"))) fail("the Engine is not frozen");
  if (low(await ad.read(engine, "engineHash()")) !== low(manifest.engineHash)) fail("engineHash differs from dist/manifest.json");
  if (decUint(await ad.read(engine, "inflatedSize()")) !== BigInt(manifest.inflatedSize)) fail("inflatedSize differs from dist/manifest.json");
  const shardHashes = decWords(await ad.read(engine, "shardHashes()"));
  if (JSON.stringify(shardHashes.map(low)) !== JSON.stringify(manifest.shardHashes.map(low))) fail("shardHashes() differ from dist/manifest.json");
  for (let i = 0; i < PANELS.length; i++) {
    if (low(await ad.read(engine, "panelHash(uint256)", [i])) !== low(manifest.panelHashes[PANELS[i]])) fail(`panel ${PANELS[i]}'s hash differs from the manifest`);
  }
  const curator = low(decAddr(await ad.read(engine, "curator()")));

  // /manifest over ERC-5219 names the same hashes
  const man = decResponse(await ad.call(got.premises, encRequest(["manifest"])));
  if (man.status !== 200) fail(`/manifest answered ${man.status}`);
  const manJson = JSON.parse(man.body);
  const catalogHash = low(await ad.read(got.catalog, "catalogHash()"));
  if (low(manJson.engineHash) !== low(manifest.engineHash)) fail("/manifest's engineHash differs");
  if (low(manJson.catalogHash) !== catalogHash) fail("/manifest's catalogHash differs from Catalog.catalogHash()");
  if (low(manJson.crestCodehash) !== codehashes.crest) fail("/manifest's crestCodehash differs from the Crest's code");

  // the Timelock
  const admin = low(decAddr(await ad.read(got.timelock, "admin()")));
  if (admin !== from) fail(`the Timelock's admin is ${admin}, the burner is ${from}`);

  /*═══════════════════ the record ═══════════════════*/
  /// gas from the JOURNAL, not this run: a resumed run spends nothing on
  /// the steps it skips and the record must still say what the band cost
  const gasOfAll = {};
  for (const [k, st] of Object.entries(journal.steps)) gasOfAll[k] = BigInt(st.gas || 0);
  for (const l of journal.loads) {
    const label = l.kind === "head" ? "loadHead" : l.kind === "body" ? "loadBody" : l.kind === "panel" ? "loadPanel" : l.kind;
    gasOfAll[label] = (gasOfAll[label] || 0n) + BigInt(l.gas || 0);
  }
  const gas = {};
  for (const [k, v] of Object.entries(gasOfAll)) gas[k] = v.toString();
  const gasTotal = Object.values(gasOfAll).reduce((a, b) => a + b, 0n);
  const gasThisRun = Object.values(gasOf).reduce((a, b) => a + b, 0n);
  const contracts = { factory, engine, ...Object.fromEntries(SALTED.filter((k) => got[k]).map((k) => [k, got[k]])) };
  /// what the chain says about the admin, not a sentence written in advance:
  /// the burner holds it at the MVB; the record of a later state (rotated
  /// through the queue, or renounced) reads the same field
  const disposition = admin === from ? "the burner holds the admin; rotation or renunciation only through the Timelock's own 7-day queue"
                    : admin === ZERO ? "renounced" : `rotated to ${admin} (through the queue; the burner no longer holds it)`;
  const burner = { nonceAfter: (await ad.nonceNow()).toString(), balanceAfter: (await ad.balanceOf(from)).toString() };
  const record = {
    schema: "intact.deployment/1",
    chainId, network: band.name,
    band: { band: band.band, lo: band.first.toString(), hi: band.last.toString(), rehearsal: band.rehearsal },
    deployer: from,
    factory, factoryVia: { create: { from, nonce: journal.factoryNonce ?? "0" } },
    salts: Object.fromEntries(Object.keys(salts).filter((k) => k !== "router" || venues).map((k) => [k, salts[k]])),
    contracts,
    codehashes: { factory: journal.steps.factory.codehash, ...codehashes },
    reproducible: { factory: journal.steps.factory.codehash === kecHex(A("src/lib/Create3Factory.sol", "Create3Factory").deployed), ...reproducible },
    placeholders: { market: P.market, roles: P.roles, agentCard: P.agentCard },
    shipBuild: { build: ship.build, reason: ship.reason, intactBytes: ship.intactBytes, threshold: ship.threshold, limit: ship.limit, solc: ship.solc,
                 facets: facetRecord, cut: cut ? cut.map((x) => ({ facet: low(x.facetAddress), selectors: x.functionSelectors.map(low) })) : null },
    engine: {
      address: engine, via: journal.steps.engine.via, curator, frozen: true,
      engineHash: low(manifest.engineHash), inflatedSize: manifest.inflatedSize,
      shardHashes: shardHashes.map(low), panelHashes: manifest.panelHashes,
      head: pointers.head.map(low), body: pointers.body.map(low),
      panels: PANELS.map((name, i) => ({ name, address: low(pointers.panels[i]), hash: low(manifest.panelHashes[name]), gzipHash: low(plan.panels[i].gzipHash) })),
      storedBytes: plan.storedBytes, placeholder: Boolean(plan.placeholder)
    },
    catalogHash, coinTemplate,
    registry: { address: REGISTRY, codehash: registryHash },
    price: price.toString(),
    timelock: { admin, delay: "604800", grace: "1209600", disposition },
    burner,
    venues: venues || null,
    gas, gasTotal: gasTotal.toString(), gasThisRun: gasThisRun.toString(),
    toolchain: toolchain(),
    confirmToken: CONFIRM[chainId] || null,
    journal: journalPath ? path.relative(ROOT, journalPath) : null,
    writtenAt: new Date().toISOString(),
    block: (await ad.blockNumber()).toString()
  };

  /*── recover-record, in-process, before anything is written ──*/
  const rr = await recover(ad, record, { out });
  if (rr.disagreements.length) {
    fail(`recover-record disagrees on ${rr.disagreements.length} field(s): ` +
         rr.disagreements.map((d) => `${d.field} (record ${d.want}, chain ${d.have})`).join("; "));
  }
  record.recovered = { checked: rr.checked, disagreeing: 0 };

  if (opts.recordPath !== null) {
    const rp = opts.recordPath || path.join(ROOT, "deployments", `${chainId}.json`);
    fs.mkdirSync(path.dirname(rp), { recursive: true });
    fs.writeFileSync(rp, JSON.stringify(record, null, 1) + "\n");
    record.path = path.relative(ROOT, rp);
  }
  return record;
}

/*═══════════════════ the CLI ═══════════════════*/

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new Error(`unexpected argument ${a}`);
    const k = a.slice(2);
    if (k in o) throw new Error(`repeated option --${k}`);
    o[k] = argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? true : argv[++i];
  }
  return o;
}

export const CLI_OPTIONS = ["chain", "confirm", "rpc", "journal", "record", "price"];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  for (const k of Object.keys(args)) {
    if (!CLI_OPTIONS.includes(k)) { console.error(`unknown option --${k}; the options are ${CLI_OPTIONS.map((o) => "--" + o).join(" ")}`); process.exit(2); }
  }
  /*  The confirm token first, before reading a file, opening a socket or
      touching the key (MASTER's rule): a mistyped command costs nothing. */
  const chainId = Number(args.chain);
  if (!args.chain || !Number.isInteger(chainId)) { console.error("which chain? --chain <id>"); process.exit(2); }
  const want = CONFIRM[chainId];
  if (!want) { console.error(`chain ${chainId} has no confirm token; add it to CONFIRM in tools/deploy.mjs with its band`); process.exit(2); }
  if (args.confirm !== want) {
    console.error(`deployment to chain ${chainId} requires --confirm ${want}`);
    process.exit(2);
  }
  const band = bandOf(chainId);
  const local = chainId === 31337;
  const rpc = args.rpc || process.env.RPC_URL || (local ? "http://127.0.0.1:8545" : null);
  const { DEV_KEYS, RpcChain } = await import("./rpc.mjs");
  const key = process.env.PRIVATE_KEY || (local ? DEV_KEYS[0] : null);
  if (!rpc || !key) { console.error("RPC_URL and PRIVATE_KEY are required in the environment for any chain but 31337"); process.exit(2); }

  console.log(`\n  \x1b[1mINTACT · deploy\x1b[0m  chain ${chainId} (${band.name}${band.rehearsal ? ", rehearsal: the whole edition" : `, band ${band.band}: ids ${band.first}–${band.last}`})`);

  // dist/ — build if missing; refuse a placeholder anywhere but 31337
  if (!fs.existsSync(path.join(ROOT, "dist/shards.json"))) {
    console.log("  dist/ is missing — building");
    const { build } = await import("./build-app.mjs");
    await build();
  }
  const { plan, manifest } = readDist();
  if (plan.placeholder) {
    if (!local) { console.error("  dist/ is the PLACEHOLDER shell — refusing to deploy it to any chain but 31337"); process.exit(2); }
    console.log("  \x1b[33mdist/ holds the placeholder shell from tools/fixtures/ (31337 only)\x1b[0m");
  }

  console.log("  compiling");
  const out = compile({ quiet: true });
  const ship = shipRule(out);
  console.log(`  ship rule: ${ship.build} — ${ship.reason}`);

  const c = await RpcChain.open(rpc, key);
  if (c.chainId !== chainId) { console.error(`  the node at ${rpc} is chain ${c.chainId}, not ${chainId}`); process.exit(2); }
  const ad = adapt(c);
  const journalPath = args.journal ? path.resolve(ROOT, args.journal) : path.join(ROOT, "deployments", `${chainId}.journal.json`);
  const recordPath = args.record ? path.resolve(ROOT, args.record) : path.join(ROOT, "deployments", `${chainId}.json`);
  const resuming = fs.existsSync(journalPath);

  // preflight: the burner, its balance, and what the run needs
  const nonce = await c.nonceNow();
  const bal = await c.balanceOf(c.from.toString());
  console.log(`  deployer ${c.from} · nonce ${nonce} · balance ${(Number(bal) / 1e18).toFixed(4)} ETH`);
  if (!local && nonce !== 0n && !resuming) {
    console.error("  the key has been used (nonce > 0) and no journal names a run to resume: a used key is not a burner, " +
                  "and the factory would land at an address no other band shares"); process.exit(2);
  }
  if (!local) {
    const gasPrice = BigInt(await c.rpc("eth_gasPrice"));
    /*  DESIGN §12 budgets ≈ 85–100 M per band; 120 M with the 1.5× fee
        margin IPSEITY learned the hard way (its 90 M constant let a run
        pass preflight and die after 56 mined transactions). A rollup
        band adds the L1 data fee, asked of the OP-stack oracle when the
        predeploy has code; its absence is said, not assumed.          */
    const deploymentGas = 120_000_000n;
    const execution = (deploymentGas * gasPrice * 15n) / 10n;
    let l1 = 0n;
    const ORACLE = "0x420000000000000000000000000000000000000F";
    if ((await ad.codeAt(ORACLE)) !== "0x") {
      const sample = artifact(out, "src/Catalog.sol", "CatalogState").bytecode;      // the largest initcode
      const fee = BigInt(await c.call(ORACLE, enc("getL1Fee(bytes)", [sample])));
      l1 = fee * BigInt(SALTED.length + 12);
      console.log(`  preflight: L1 data fee ≈ ${(Number(l1) / 1e18).toFixed(5)} ETH (oracle at ${ORACLE})`);
    } else {
      console.log("  preflight: no GasPriceOracle predeploy on this chain — no L1 data term");
    }
    const need = execution + l1;
    console.log(`  preflight: ${(Number(need) / 1e18).toFixed(4)} ETH needed (120M gas at ${gasPrice} wei ×1.5, plus L1 data)`);
    if (bal < need) { console.error(`  fund the deployer first: it holds ${(Number(bal) / 1e18).toFixed(4)} ETH`); process.exit(2); }
  }

  const t0 = Date.now();
  let record;
  try {
    record = await deployIntact(ad, { out, plan, manifest, journalPath, recordPath, price: args.price ? BigInt(args.price) : undefined,
                                      log: (s) => console.log(s) });
  } catch (e) {
    console.error(`\n  \x1b[31m${e.message}\x1b[0m\n  nothing was published; the journal at ${path.relative(ROOT, journalPath)} holds what landed`);
    process.exit(1);
  }
  const gas = Object.entries(record.gas).sort((a, b) => Number(b[1]) - Number(a[1]));
  console.log("\n  gas by step");
  for (const [k, v] of gas) console.log(`    ${k.padEnd(14)} ${(Number(v) / 1e6).toFixed(2)}M`);
  console.log(`    ${"total".padEnd(14)} ${(Number(record.gasTotal) / 1e6).toFixed(2)}M  in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`\n  recover-record: ${record.recovered.checked} fields checked, 0 disagreeing`);
  console.log(`  wrote ${record.path}\n  door  web3://${record.contracts.premises}:${chainId}/\n`);
}
