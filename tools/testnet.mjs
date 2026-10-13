#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the rehearsal, in one command (U13)

  Origin: IPSEITY tools/testnet.mjs (preflight with the rollup-fee allowance,
  the journal, the read-back over the wire, "if the node lies, this fails")
  and tools/exercise.mjs (every function family walked live, refusals
  proven by eth_estimateGas pinned to a receipt, a campaign record beside
  the deployment record); ANIMA's three public-RPC lag defences; MASTER's
  literal --confirm token before any I/O. Rebuilt for INTACT around what
  U10 and U11 already proved: the deployment is tools/deploy.mjs's own
  `deployIntact(adapt(RpcChain))` — the same function the in-process suite
  verifies, over a wire, never a copy of it — and the record it writes is
  recovered in-process before it is published.

  What this adds is the CAMPAIGN: every function family exercised live,
  with receipts, on the deployment just made, written step by step into a
  campaign record (`intact.campaign/1`, deployments/README.md) as soon as
  each receipt is in. The order the campaign walks, and why:

    mint ×2 (ids from the Transfer log) → the Kiln launches a coin (the
    only ERC-20 a testnet is sure to have; the Reach holds the supply, the
    Launchpad the raise share) → the owned market opens on it with a native
    quote (the Reach hands the holder inventory through `execute`; the
    Router is skipped — there is no venue table on a testnet) → the second
    key swaps both ways (exact-in with ETH, exact-out paid in coin; every
    deadline from the chain's clock) → the holder speaks at home → both
    tokens bind a sealing key; the second prices its inbox; the holder
    whispers SEALED with a stamp; the reply settles the postage, and
    `claimSettled` pays the recipient's feeSink → the raise: `create`,
    buys until the target, `graduate` into a sealed market, a trade on it,
    `collect` pays the launcher's Reach; a buyer `claim`s its credits → a
    native lock to the Reach (released when due) → a session for the
    second key and one `executeAsSession` act (before the seal, so the
    coin may leave) → `seal` → `panic`, and its consequences read back →
    the steward: `arrange`, then `summon` and `cancel` where the clock can
    be moved (31337: evm_increaseTime), or `stillHere` and the two refusals
    proven by their selectors where it cannot (a public chain: the quiet
    period is thirty days) → `transferFrom` (the sale) with
    `rightsOf(id, seller)` read back as nothing → the sweep: the second
    key's remainder goes back to the burner, so nothing is stranded.

  Phases, each printed with its result and recorded:

    preflight   read-only: chain id against --chain; a lag probe (two
                eth_blockNumber reads and the latest block's clock against
                the wall clock; a stalled public endpoint is refused); gas
                price; the nonce-0 burner rule (or a journal to resume);
                the balance against the deploy budget (120 M gas × price ×
                1.5, plus L1 data where the OP-stack oracle has code) PLUS
                the campaign budget (the gas the 31337 wire rehearsal
                measured × price × 1.5, the ETH the campaign spends, the
                second key's funding); dist/ not the placeholder; the ship
                rule. --preflight-only stops here.
    deploy      deployIntact over RpcChain; journal and record as
                tools/deploy.mjs; the record is deployIntact's own, written
                with 0 disagreeing.
    campaign    above; --resume continues a campaign record whose steps
                already carry receipts.
    recover     recover(ad, record) once more, from the record on disk.
    gateway     tools/verify-gateway.mjs against --gateway, or on 31337
                against tools/gateway.mjs started here as a child (port
                8082): clean, then the tamper fixture.
    measure     tokenURI(1): eth_estimateGas and a plain eth_call, timed,
                on up to three endpoints (--endpoints), or the local node.
    disposition the Timelock admin's disposition from the chain, the
                burner's final nonce and balance, the sweep, and the key:
                a --key-file is overwritten and unlinked once both records
                are written; a key from the environment gets the exact
                words the operator must act on. The key is never printed.

    RPC_URL=… PRIVATE_KEY=0x… node tools/testnet.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA
        [--rpc URL] [--record path] [--journal path] [--campaign path] [--gateway URL]
        [--endpoints URL,URL,URL] [--preflight-only] [--skip-deploy] [--resume] [--key-file path] [--price wei]
    node tools/testnet.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL --record /tmp/x/31337.json
        --journal /tmp/x/31337.journal.json --campaign /tmp/x/31337.campaign.json      # spawns hardhat on 8547
    node tools/testnet.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL --rpc http://127.0.0.1:8547 …  # a running node

  Rules. The confirm token is checked before any file or socket is touched,
  so a mistyped command costs nothing; an option not in the list is refused.
  Only rehearsal chains run the campaign: a band's burner does nothing after
  its record (deployments/README.md), so on 8453/1/10 this tool refuses and
  names tools/deploy.mjs. On 31337 the three files default to a scratch
  directory, never deployments/ — the committed fixture is written only by
  name. Children (hardhat, the gateway) are killed on exit, also on failure.
  The second key is derived from the burner key as keccak256 over the text
  "intact.campaign/1:second" followed by the burner's 32 key bytes — on
  every chain, 31337 included, so the funding and the sweep run over a wire
  before they run for real; it is re-derivable from the burner key alone
  and is never printed.

  The last line is "  N passed, M failed" (one line per phase step) and the
  exit code follows it.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { compile, artifact, shipRule } from "./compile.mjs";
import { enc, sel, decAddr, decUint, decBool, decString } from "./evm.mjs";
import { adapt, deployIntact, bandOf, CONFIRM, SALTED, atomicWrite, parseArgs, readDist, awaitBlock, awaitCode, logsBy, ROOT,
         SATELLITES, SATELLITE_ORDER, deploySatellite, admitsSatellite } from "./deploy.mjs";
import { recover } from "./recover-record.mjs";
import { encRequest, decResponse, ZERO } from "./site.mjs";

const kec = (b) => "0x" + Buffer.from(keccak256(Buffer.isBuffer(b) ? b : Buffer.from(b))).toString("hex");
const low = (s) => String(s).toLowerCase();
const hexN = (n) => "0x" + BigInt(n).toString(16);
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const eth = (wei, d = 6) => (Number(BigInt(wei)) / 1e18).toFixed(d);
/// An expected refusal: already counted as a failed sentence, so the exit prints its message and no stack.
const refuse = (msg) => Object.assign(new Error(msg), { refusal: true });
const M = (g) => (Number(BigInt(g)) / 1e6).toFixed(2) + "M";
const topic = (sig) => kec(Buffer.from(sig, "utf8"));
/// A path for a sentence: relative inside the repository, absolute outside it.
const rel = (p) => { const r = path.relative(ROOT, p); return r.startsWith("..") ? p : r; };

/*═══════════════════ the campaign's numbers ═══════════════════*/

/// One unit of the campaign's money: 0.001 ETH. Every amount below is a
/// small multiple, so a public testnet's scarce ether goes a long way and
/// the gas measured on 31337 is the gas a public run pays.
export const UNIT = 10n ** 15n;
export const WAD = 10n ** 18n;
export const AMOUNTS = {
  supply: 1_000_000_000n * WAD, raise: 900_000_000n * WAD, curve: 700_000_000n * WAD,
  virtualQuote: UNIT, target: 3n * UNIT, buy: UNIT,
  inventory: 200n * WAD, marketBase: 100n * WAD, marketQuote: 2n * UNIT,
  swapIn: UNIT / 2n, swapOut: UNIT / 10n, sealedSwap: UNIT / 5n,
  postage: UNIT / 10n, replyWindow: 300n, lock: UNIT, lockSeconds: 120n,
  sessionTransfer: WAD, sealDays: 30n, quiet: 30n * 86400n, notice: 14n * 86400n
};
/// What the holder spends besides gas (two mints at the hub's price are
/// added at run time), and what the second key is funded with besides gas.
export const HOLDER_SPEND = AMOUNTS.marketQuote + 2n * AMOUNTS.buy + AMOUNTS.postage + AMOUNTS.lock;
export const SECOND_SPEND = AMOUNTS.buy + AMOUNTS.swapIn + AMOUNTS.sealedSwap;

/// The campaign's gas as the 31337 wire rehearsal measured it. `measuredOn`
/// is null until a run has been written here; the preflight then says
/// "budget" and uses CAMPAIGN_BUDGET_GAS instead of a measured number.
export const CAMPAIGN_GAS = {
  measuredOn: "31337 · 2026-10-13 · node tools/testnet.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL over npx hardhat node (cancun): 40 steps, 39 transactions",
  total: 5902168n,
  second: 1445791n,
  families: { fund: 42000n, mint: 595922n, launch: 1090563n, execute: 124234n, market: 364028n, swap: 224284n, speak: 180330n, social: 1012549n, raise: 1076687n, lock: 289104n, session: 332810n, seal: 46898n, panic: 116177n, steward: 280947n, clock: 0n, sale: 125635n }
};
export const CAMPAIGN_BUDGET_GAS = 30_000_000n;
/// The post-MVB satellites' budget: each is one `queue` and one `execute`
/// through the Timelock, the execute carrying the satellite's initcode
/// (deployments/README.md). Measured on the 31337 rehearsal of 2026-10-13
/// (the wave-4 integration tree): the card 3,023,544 gas (327,180 to queue,
/// 2,696,364 to land), the Market 1,647,536, the Roles 1,524,439; the
/// budget sits over the largest.
export const SATELLITE_BUDGET_GAS = 3_500_000n;

/*═══════════════════ signatures and topics ═══════════════════*/

const SIG = {
  mint: "mint(address)", transferFrom: "transferFrom(address,address,uint256)", panic: "panic(uint256)",
  launch: "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
  openMarket: "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", deposit: "deposit(uint256,uint256,uint256)",
  swapIn: "swapExactIn(uint256,bool,uint256,uint256,address,uint64)", swapOut: "swapExactOut(uint256,bool,uint256,uint256,address,uint64)",
  collect: "collect(uint256)", speak: "speak(uint256,uint256,uint8,uint64,uint64,bytes)",
  setKey: "setEncryptionKey(uint16,bytes)", bindKey: "bindKey(uint256)", configureInbox: "configureInbox(uint256,address,uint128,uint64,bool)",
  whisperStamped: "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)", whisper: "whisper(uint256,uint256,uint8,bytes32,bytes)",
  claimSettled: "claimSettled(uint256,address)",
  create: "create((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8))",
  buy: "buy(uint256,uint256,uint64,uint16)", graduate: "graduate(uint256)", claim: "claim(uint256,address)",
  lock: "lock(address,uint112,address,uint64,uint64,uint64,bool)", release: "release(uint256)",
  grant: "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)",
  asSession: "executeAsSession(address,uint256,bytes)", execute: "execute(address,uint256,bytes,uint8)", seal: "seal(uint64)",
  arrange: "arrange(uint256,bytes32,uint64,uint64,address[],uint8)", summon: "summon(uint256,address,bytes32)", cancel: "cancel(uint256)",
  stillHere: "stillHere(uint256)", transfer: "transfer(address,uint256)", approve: "approve(address,uint256)"
};
const TOPIC = {
  transfer: topic("Transfer(address,address,uint256)"),
  launched: topic("Launched(address,uint256,address,string,uint256,uint256)"),
  graduated: topic("Graduated(uint256,uint256,uint256,uint256)"),
  locked: topic("Locked(uint256,address,address,address,uint256,uint64,uint64,uint64,bool)"),
  stamped: topic("Stamped(uint256,uint256,uint256,uint256,address,uint128,uint64)"),
  settled: topic("Settled(uint256,address,address,uint128)"),
  said: topic("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)"),
  panicked: topic("Panicked(uint256,uint64,address)")
};

/*═══════════════════ the CLI, the token first ═══════════════════*/

export const CLI_OPTIONS = ["chain", "confirm", "rpc", "record", "journal", "campaign", "gateway", "endpoints",
                            "preflight-only", "skip-deploy", "resume", "key-file", "price", "keep"];

const args = parseArgs(process.argv.slice(2));
for (const k of Object.keys(args)) {
  if (!CLI_OPTIONS.includes(k)) { console.error(`unknown option --${k}; the options are ${CLI_OPTIONS.map((o) => "--" + o).join(" ")}`); process.exit(2); }
}
const chainId = Number(args.chain);
if (!args.chain || !Number.isInteger(chainId)) { console.error("which chain? --chain <id>"); process.exit(2); }
if (!CONFIRM[chainId]) { console.error(`chain ${chainId} has no confirm token; add it to CONFIRM in tools/deploy.mjs with its band`); process.exit(2); }
if (args.confirm !== CONFIRM[chainId]) { console.error(`a rehearsal on chain ${chainId} requires --confirm ${CONFIRM[chainId]}`); process.exit(2); }
const band = bandOf(chainId);
if (!band.rehearsal) {
  console.error(`chain ${chainId} is band ${band.band} (${band.name}), not a rehearsal chain: a band is deployed with tools/deploy.mjs, and its burner does nothing after the record is written — the campaign would spend it. Refusing.`);
  process.exit(2);
}
const LOCAL = chainId === 31337;
const RPC_PORT = 8547, GW_PORT = 8082;
const RPC = args.rpc && args.rpc !== true ? String(args.rpc) : (process.env.RPC_URL || (LOCAL ? `http://127.0.0.1:${RPC_PORT}` : null));
const SCRATCH = path.join(os.tmpdir(), "intact-testnet");
const where = (opt, name) => args[opt] && args[opt] !== true ? path.resolve(ROOT, String(args[opt])) : (LOCAL ? path.join(SCRATCH, name) : path.join(ROOT, "deployments", name));
const RECORD = where("record", `${chainId}.json`);
const JOURNAL = where("journal", `${chainId}.journal.json`);
const CAMPAIGN = where("campaign", `${chainId}.campaign.json`);
const KEEP = Boolean(args.keep);
const RESUME = Boolean(args.resume);

/*═══════════════════ the harness ═══════════════════*/

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${String(detail).slice(0, 600)}`);
  return !!cond;
};
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const note = (s) => console.log(`      ${s}`);

/*═══════════════════ children ═══════════════════*/

const children = [];
function child(name, cmd, cargs, env = {}) {
  const ch = spawn(cmd, cargs, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  ch.lines = [];
  const take = (d) => { for (const l of String(d).split("\n")) if (l.trim()) { ch.lines.push(l); if (ch.lines.length > 600) ch.lines.shift(); } };
  ch.stdout.on("data", take); ch.stderr.on("data", take);
  ch.on("exit", (code) => { ch.exited = code; });
  children.push(Object.assign(ch, { name }));
  return ch;
}
function killAll() {
  for (const ch of children) { if (ch.exited != null) continue; try { process.kill(-ch.pid, "SIGTERM"); } catch { /* gone */ } try { ch.kill("SIGTERM"); } catch { /* gone */ } }
}
process.on("exit", () => { if (!KEEP) killAll(); });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { if (!KEEP) killAll(); process.exit(130); });
const waitExit = (ch) => new Promise((r) => { if (ch.exited != null) return r(ch.exited); ch.on("exit", (code) => r(code)); });
async function until(fn, label, ms = 60000) {
  const t0 = Date.now();
  for (;;) { try { const v = await fn(); if (v) return v; } catch { /* not yet */ } if (Date.now() - t0 > ms) throw new Error("timed out waiting for " + label); await nap(500); }
}

/*═══════════════════ the key ═══════════════════*/

/// From --key-file, else PRIVATE_KEY, else (31337 only) hardhat's first
/// account. Never printed; only its address is.
function burnerKey() {
  if (args["key-file"] && args["key-file"] !== true) return fs.readFileSync(path.resolve(ROOT, String(args["key-file"])), "utf8").trim();
  if (process.env.PRIVATE_KEY) return process.env.PRIVATE_KEY.trim();
  return null;
}
/// The campaign's second key: keccak256("intact.campaign/1:second" ‖ burner key bytes).
export const SECOND_DERIVATION = 'keccak256("intact.campaign/1:second" ‖ the burner\'s 32 key bytes)';
export const deriveSecond = (keyHex) => kec(Buffer.concat([Buffer.from("intact.campaign/1:second", "utf8"), Buffer.from(keyHex.replace(/^0x/, ""), "hex")]));
/// Overwrite, then unlink: the file's bytes are zeroed before the name goes.
function destroyKeyFile(p) {
  const size = fs.statSync(p).size;
  const fd = fs.openSync(p, "r+");
  fs.writeSync(fd, Buffer.alloc(size, 0), 0, size, 0);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.unlinkSync(p);
}

/*═══════════════════ small chain helpers ═══════════════════*/

const now = async (c) => BigInt((await c.rpc("eth_getBlockByNumber", ["latest", false])).timestamp);
const word = (hex, i = 0) => "0x" + hex.replace(/^0x/, "").substr(i * 64, 64);
const addrAt = (hex, i = 0) => low(decAddr(hex, i));
/// A refusal proved by eth_estimateGas: the node replays the call and the
/// revert data names the custom error. `want` is the error's signature.
async function refusal(c, from, to, sig, cargs, want, value = 0n) {
  try {
    await c.rpc("eth_estimateGas", [{ from, to, data: enc(sig, cargs), value: hexN(value) }]);
    return { refused: false, notes: "it would have landed" };
  } catch (e) {
    const data = typeof e.data === "string" ? e.data : (e.data && typeof e.data.data === "string" ? e.data.data : null);
    const got = data ? data.slice(0, 10) : null;
    const arg = data && data.length >= 74 ? BigInt("0x" + data.slice(10, 74)) : null;
    return { refused: got === sel(want), selector: got, arg, notes: got === sel(want) ? `refused by ${want}${arg !== null ? ` (${arg})` : ""}` : `refused, but by ${got || e.message.slice(0, 120)}` };
  }
}

/*═══════════════════ main ═══════════════════*/

async function main() {
  const t0 = Date.now();
  console.log(`\n  \x1b[1mINTACT · testnet rehearsal\x1b[0m  chain ${chainId} (${band.name}, rehearsal: the whole edition)`);
  if (!RPC) { console.error("  RPC_URL (or --rpc) is required for any chain but 31337"); process.exit(2); }
  let key = burnerKey();
  if (!key) {
    if (!LOCAL) { console.error("  PRIVATE_KEY (or --key-file) is required for any chain but 31337; the key never lives in this repository"); process.exit(2); }
    const { DEV_KEYS } = await import("./rpc.mjs");
    key = DEV_KEYS[0];
  }
  const { RpcChain } = await import("./rpc.mjs");
  for (const p of [RECORD, JOURNAL, CAMPAIGN]) fs.mkdirSync(path.dirname(p), { recursive: true });

  /*──────────────── the node (31337: a child, unless --rpc) ────────────────*/
  let node = null;
  if (LOCAL && !(args.rpc && args.rpc !== true)) {
    head("the node");
    node = child("hardhat", "npx", ["hardhat", "node", "--port", String(RPC_PORT), "--hostname", "127.0.0.1"]);
    note(`npx hardhat node --port ${RPC_PORT} (pid ${node.pid})`);
    await until(() => new RpcChain(RPC, key, 31337).rpc("eth_chainId"), "the node at " + RPC, 90000);
  }

  /*═══════════════════ preflight (read-only) ═══════════════════*/
  head("preflight (read-only)");
  const c = await RpcChain.open(RPC, key);
  const ad = adapt(c);
  const me = low(c.from.toString());
  ok(c.chainId === chainId, `preflight · the node at ${RPC} is chain ${c.chainId}, as --chain says`, `expected ${chainId}`);
  if (c.chainId !== chainId) throw refuse("the node is not the chain --chain names");
  // the lag probe
  const blockA = BigInt(await c.rpc("eth_blockNumber"));
  const latest = await c.rpc("eth_getBlockByNumber", ["latest", false]);
  const blockB = BigInt(await c.rpc("eth_blockNumber"));
  const wall = BigInt(Math.floor(Date.now() / 1000));
  const skew = wall - BigInt(latest.timestamp);
  const stalled = !LOCAL && (blockB < blockA || skew > 600n);
  ok(!stalled, `preflight · the endpoint is live: block ${blockA} → ${blockB}; the latest block's clock is ${skew}s behind the wall clock${LOCAL ? " (a local node mines only on demand)" : ""}`, stalled ? "a replica going backwards, or more than ten minutes behind: refusing to send into it" : undefined);
  if (stalled) throw refuse("the endpoint is stalled");
  const gasPrice = BigInt(await c.rpc("eth_gasPrice"));
  ok(gasPrice > 0n, `preflight · gas price ${gasPrice} wei (${(Number(gasPrice) / 1e9).toFixed(4)} gwei)`);
  // the burner rule
  const nonce = await c.nonceNow();
  const bal = await c.balanceOf(me);
  const resumingDeploy = fs.existsSync(JOURNAL);
  const skipDeploy = Boolean(args["skip-deploy"]);
  if (skipDeploy) ok(fs.existsSync(RECORD), `preflight · --skip-deploy: the record at ${rel(RECORD)} is the deployment under rehearsal (deployer ${me}, nonce ${nonce})`, "no record there");
  else if (nonce === 0n) ok(true, `preflight · the key ${me} is a nonce-0 burner`);
  else if (resumingDeploy) ok(true, `preflight · the key ${me} is at nonce ${nonce} and ${rel(JOURNAL)} names a run to resume`);
  else ok(LOCAL, `preflight · the key ${me} is at nonce ${nonce} and no journal names a run to resume${LOCAL ? " — a warning on 31337 (hardhat's account is nobody's burner)" : ""}`, "a used key is not a burner, and the factory would land at an address no other band shares");
  if (!LOCAL && nonce !== 0n && !resumingDeploy && !skipDeploy) throw refuse("the key is not a burner");
  // dist/ and the ship rule
  if (!fs.existsSync(path.join(ROOT, "dist/shards.json"))) { note("dist/ is missing — building"); const { build } = await import("./build-app.mjs"); await build(); }
  const { plan, manifest } = readDist();
  ok(!plan.placeholder || LOCAL, `preflight · dist/ is ${plan.placeholder ? "the PLACEHOLDER shell (31337 only)" : `the console, not the placeholder (engineHash ${manifest.engineHash.slice(0, 18)}…, ${plan.head.length + plan.body.length} shards, ${plan.panels.length} panels)`}`, "refusing to deploy the placeholder anywhere but 31337");
  if (plan.placeholder && !LOCAL) throw refuse("dist/ is the placeholder");
  note("compiling src/ (the compile cache makes a warm run fast)");
  const out = compile({ quiet: true });
  const ship = shipRule(out);
  ok(ship.build === "diamond" || ship.build === "monolith", `preflight · the ship rule: ${ship.build} — ${ship.reason}`);
  // the budget: deploy + campaign
  const ORACLE = "0x420000000000000000000000000000000000000F";
  const oracle = (await ad.codeAt(ORACLE)) !== "0x";
  let l1Deploy = 0n, l1PerStep = 0n;
  if (oracle) {
    const sample = artifact(out, "src/Catalog.sol", "CatalogState").bytecode;
    l1Deploy = BigInt(await c.call(ORACLE, enc("getL1Fee(bytes)", [sample]))) * BigInt(SALTED.length + 12);
    l1PerStep = BigInt(await c.call(ORACLE, enc("getL1Fee(bytes)", ["0x" + "ab".repeat(600)])));
    note(`L1 data fee: ≈ ${l1Deploy} wei (${eth(l1Deploy, 9)} ETH) for the deploy, ≈ ${l1PerStep} wei per 600-byte campaign step (oracle at ${ORACLE})`);
  } else note("no GasPriceOracle predeploy on this chain — no L1 data term");
  const deployNeed = skipDeploy ? 0n : (120_000_000n * gasPrice * 15n) / 10n + l1Deploy;
  const measured = CAMPAIGN_GAS.measuredOn !== null;
  const campaignGas = measured ? CAMPAIGN_GAS.total : CAMPAIGN_BUDGET_GAS;
  const secondGas = measured ? CAMPAIGN_GAS.second : CAMPAIGN_BUDGET_GAS / 8n;
  const steps = 50n;
  const price = args.price && args.price !== true ? BigInt(args.price) : (skipDeploy ? decUint(await c.read(JSON.parse(fs.readFileSync(RECORD, "utf8")).contracts.hub, "price()")) : 10n ** 16n);
  const secondFund = (secondGas * gasPrice * 15n) / 10n + l1PerStep * 12n + SECOND_SPEND + 2n * 27_300n * gasPrice;
  const campaignNeed = (campaignGas * gasPrice * 15n) / 10n + l1PerStep * steps + HOLDER_SPEND + 2n * price + secondFund;
  const hasArtifact = (f, n) => { try { artifact(out, f, n); return true; } catch { return false; } };
  const satelliteKeys = SATELLITE_ORDER.filter((k) => !admitsSatellite(k, { chainId, band: { band: band.band } }) && hasArtifact(SATELLITES[k].file, SATELLITES[k].name));
  const satelliteNeed = (BigInt(satelliteKeys.length) * SATELLITE_BUDGET_GAS * gasPrice * 15n) / 10n + l1PerStep * 2n * BigInt(satelliteKeys.length);
  const need = deployNeed + campaignNeed + satelliteNeed;
  ok(bal >= need, `preflight · balance ${eth(bal)} ETH covers ${eth(need)} ETH: the deploy ${eth(deployNeed)} (120M gas × ${gasPrice} wei × 1.5 + L1) plus the campaign ${eth(campaignNeed)} (${campaignGas} gas ${measured ? `measured on ${CAMPAIGN_GAS.measuredOn}` : "BUDGET: no wire run measured yet"} × 1.5, two mints at ${eth(price)} ETH, ${eth(HOLDER_SPEND)} ETH the holder spends, ${eth(secondFund)} ETH funding the second key)${satelliteKeys.length ? ` plus the satellites ${eth(satelliteNeed)} (${satelliteKeys.join(", ")}: ${SATELLITE_BUDGET_GAS} gas each, a budget, × 1.5)` : ""}`,
     `fund ${me} with at least ${eth(need - bal)} ETH more`);
  if (bal < need) throw refuse(`underfunded: ${eth(need)} ETH needed, ${eth(bal)} ETH held`);
  const preflight = { rpcChainId: c.chainId, blockA: blockA.toString(), blockB: blockB.toString(), latestTimestamp: String(BigInt(latest.timestamp)), wallClock: wall.toString(), skewSeconds: skew.toString(),
                      gasPrice: gasPrice.toString(), deployer: me, nonce: nonce.toString(), balance: bal.toString(), deployBudget: deployNeed.toString(), campaignBudget: campaignNeed.toString(),
                      campaignGas: campaignGas.toString(), campaignGasMeasuredOn: CAMPAIGN_GAS.measuredOn, secondFund: secondFund.toString(), l1Oracle: oracle ? ORACLE : null, l1Deploy: l1Deploy.toString(), l1PerStep: l1PerStep.toString(),
                      placeholder: Boolean(plan.placeholder), shipBuild: ship.build, shipReason: ship.reason, price: price.toString() };
  if (args["preflight-only"]) {
    console.log(`\n  preflight only: nothing was sent. ${eth(need)} ETH is what the whole rehearsal needs at today's gas price.`);
    console.log(`\n  ${pass} passed, ${fail} failed\n`);
    if (!KEEP) killAll();
    process.exit(fail ? 1 : 0);
  }

  /*═══════════════════ deploy ═══════════════════*/
  head("deploy (tools/deploy.mjs's deployIntact over the wire)");
  let record;
  const tDeploy = Date.now();
  if (skipDeploy) {
    record = JSON.parse(fs.readFileSync(RECORD, "utf8"));
    ok(record.chainId === chainId && record.contracts && record.contracts.hub, `deploy · skipped: the record at ${rel(RECORD)} names the hub ${record.contracts && record.contracts.hub}`);
  } else {
    try {
      record = await deployIntact(ad, { out, plan, manifest, journalPath: JOURNAL, recordPath: RECORD, price: args.price && args.price !== true ? BigInt(args.price) : undefined, log: (s) => console.log("    " + s.trim()) });
    } catch (e) {
      ok(false, `deploy · deployIntact threw: ${e.message}`);
      note(`nothing was published; the journal at ${rel(JOURNAL)} holds what landed`);
      throw e;
    }
    ok(fs.existsSync(RECORD) && record.recovered && record.recovered.disagreeing === 0,
       `deploy · the record was written by deployIntact with ${record.recovered && record.recovered.checked} fields checked and 0 disagreeing: ${rel(RECORD)} (${M(record.gasTotal)} gas in all, ${M(record.gasThisRun)} this run, ${((Date.now() - tDeploy) / 1000).toFixed(0)} s)`);
    note(`door  web3://${record.contracts.premises}:${chainId}/`);
  }
  /*═══════════════════ satellites (post-MVB, through the Timelock) ═══════════════════*/
  head("satellites (the post-MVB contracts, through the Timelock's queue)");
  if (!satelliteKeys.length) note("no satellite contract is compiled in this tree; the phase runs once one lands (U14–U18)");
  for (const key of satelliteKeys) {
    try {
      const r = await deploySatellite(ad, record, key, { out, recordPath: RECORD, log: (s) => console.log("    " + s.trim()) });
      if (r.queued) {
        record = r.record;
        ok(true, `satellites · ${key} queued on the Timelock (op ${r.op}), executable at ${r.eta}: this chain waits the seven days — land it then with tools/deploy.mjs --satellite ${key} (anyone may)`);
      } else {
        record = r;
        ok(Boolean(record.contracts[key] && record.satellites[key].executed),
           `satellites · ${key} landed at ${record.contracts[key]} through the Timelock's queue (${M(record.satellites[key].executed.gas)} gas to land it) and the record recovered with ${record.recovered.checked} fields, 0 disagreeing`);
      }
    } catch (e) { ok(false, `satellites · ${key}: ${e.message}`); }
  }
  for (const key of SATELLITE_ORDER) {
    const why = admitsSatellite(key, { chainId, band: { band: band.band } });
    if (why && hasArtifact(SATELLITES[key].file, SATELLITES[key].name)) note(`${key}: not landed on ${chainId} — ${why}`);
  }

  const S = record.contracts;
  const HUB = S.hub, POOL = S.pool, PARLEY = S.parley, POSTAGE = S.postage, KEYS = S.keys, KILN = S.kiln, PAD = S.launchpad, LOCKS = S.locks, STEWARD = S.steward, PREMISES = S.premises;

  /*═══════════════════ campaign ═══════════════════*/
  head("campaign (every function family, live, with receipts)");
  const secondKey = deriveSecond(key);
  const c2 = await c.as(secondKey);
  const ad2 = adapt(c2);
  const second = low(c2.from.toString());
  let camp = {
    schema: "intact.campaign/1", chainId, network: band.name, record: rel(RECORD), hub: HUB, premises: PREMISES,
    startedAt: new Date().toISOString(), finishedAt: null, confirmToken: CONFIRM[chainId],
    actors: { holder: me, second, secondDerivation: SECOND_DERIVATION },
    amounts: Object.fromEntries(Object.entries(AMOUNTS).map(([k, v]) => [k, v.toString()])),
    preflight, vars: {}, steps: [], families: {}, gasTotal: "0", secondGas: "0",
    recover: null, gateway: null, measure: [], disposition: null
  };
  if (fs.existsSync(CAMPAIGN)) {
    const prior = JSON.parse(fs.readFileSync(CAMPAIGN, "utf8"));
    const same = prior.schema === camp.schema && low(prior.hub) === low(HUB) && low(prior.actors.holder) === me;
    if (!RESUME) { ok(false, `campaign · ${rel(CAMPAIGN)} exists (${prior.steps.length} step(s), hub ${prior.hub}); pass --resume to continue it, or another --campaign path`); throw new Error("campaign record exists"); }
    if (!same) { ok(false, `campaign · ${rel(CAMPAIGN)} is another rehearsal's (hub ${prior.hub}, holder ${prior.actors.holder}); refusing to resume it`); throw new Error("foreign campaign record"); }
    camp = { ...prior, preflight };
    note(`resuming ${rel(CAMPAIGN)}: ${camp.steps.length} step(s) recorded`);
  }
  const save = () => atomicWrite(CAMPAIGN, camp);
  save();
  const V = camp.vars;
  const landed = (label) => camp.steps.find((s) => s.label === label && (s.status === "0x1" || s.status === "refused" || s.status === "local-only" || s.status === "skipped"));
  /// One campaign step: run, record as soon as the receipt is in, hold the
  /// endpoint to the receipt's block before the next read.
  const step = async (label, family, actor, run) => {
    const prior = landed(label);
    if (prior) { ok(true, `${family} · ${label} — recorded already (${prior.status}${prior.txHash ? `, ${prior.txHash.slice(0, 12)}…` : ""}), skipped`); return prior; }
    const tS = Date.now();
    let r;
    try { r = await run(); }
    catch (e) {
      camp.steps.push({ i: camp.steps.length + 1, label, family, actor, status: "failed", notes: String(e.message).slice(0, 400),
                        txHash: e.r ? e.r.hash : null, block: e.r ? e.r.block.toString() : null, gasUsed: e.r ? e.r.gas.toString() : null, at: new Date().toISOString() }); save();
      ok(false, `${family} · ${label}`, e.message); throw e;
    }
    const rec = { i: camp.steps.length + 1, label, family, actor, fn: r.fn || null, to: r.to ? low(r.to) : null,
                  txHash: r.r ? r.r.hash : null, block: r.r ? r.r.block.toString() : null, gasUsed: r.r ? r.r.gas.toString() : null,
                  status: r.status || (r.r ? "0x1" : "skipped"), notes: r.notes || "", ms: Date.now() - tS, at: new Date().toISOString() };
    Object.assign(V, r.vars || {});
    camp.steps.push(rec);
    camp.families[family] = camp.families[family] || { steps: 0, gas: "0" };
    camp.families[family].steps++;
    camp.families[family].gas = (BigInt(camp.families[family].gas) + BigInt(rec.gasUsed || 0)).toString();
    camp.gasTotal = (BigInt(camp.gasTotal) + BigInt(rec.gasUsed || 0)).toString();
    if (actor === "second") camp.secondGas = (BigInt(camp.secondGas) + BigInt(rec.gasUsed || 0)).toString();
    save();
    if (r.r) await awaitBlock(ad, r.r.block);
    ok(true, `${family} · ${label}${rec.gasUsed ? ` — ${rec.gasUsed} gas, block ${rec.block}` : ` — ${rec.status}`}${rec.notes ? `; ${rec.notes}` : ""}`);
    return rec;
  };
  const tx = async (who, to, sig, cargs, o = {}) => ({ fn: sig, to, r: await (who === "second" ? ad2 : ad).exec(to, sig, cargs, { value: o.value || 0n, label: o.label || sig }), notes: o.notes, vars: o.vars });
  const read = (to, sig, cargs = []) => c.read(to, sig, cargs);
  const idFromTransfer = (logs, to) => { const l = logsBy(logs, HUB, TOPIC.transfer).find((x) => low("0x" + x.topics[2].slice(26)) === low(to)); if (!l) throw new Error("no Transfer log for the mint"); return BigInt(l.topics[3]).toString(); };
  const deadline = async () => (await now(c)) + 900n;
  const warp = async (seconds, label) => step(label, "clock", "node", async () => {
    if (!LOCAL) return { status: "skipped", notes: "a public chain's clock cannot be moved" };
    await c.rpc("evm_increaseTime", [Number(seconds)]); await c.rpc("evm_mine", []);
    return { status: "local-only", notes: `evm_increaseTime(${seconds}) + evm_mine on 31337: the chain's clock reads ${await now(c)}` };
  });

  let campaignFailed = null;
  try {
    /*── fund the second key ──*/
    await step("fund the second key from the burner", "fund", "holder", async () => {
      const have = await c.balanceOf(second);
      if (have >= secondFund) return { status: "skipped", notes: `the second key ${second} already holds ${eth(have)} ETH` };
      const raw = await c.send({ to: second, value: secondFund - have, label: "fund" });
      const r = { gas: raw.gas, hash: raw.hash, block: raw.block, logs: [] };
      return { fn: "(transfer)", to: second, r, notes: `${eth(secondFund - have)} ETH to ${second}, derived as ${SECOND_DERIVATION}` };
    });
    c2.nonce = BigInt(await c.rpc("eth_getTransactionCount", [second, "pending"]));

    /*── mint ──*/
    const hubPrice = decUint(await read(HUB, "price()"));
    await step("mint the holder's token", "mint", "holder", async () => {
      const r = await ad.exec(HUB, SIG.mint, [me], { value: hubPrice, label: "mint" });
      const id = idFromTransfer(r.logs, me);
      return { fn: SIG.mint, to: HUB, r, notes: `id ${id} from the Transfer log, ${eth(hubPrice)} ETH`, vars: { idA: id } };
    });
    await step("mint the second key's token", "mint", "holder", async () => {
      const r = await ad.exec(HUB, SIG.mint, [second], { value: hubPrice, label: "mint" });
      const id = idFromTransfer(r.logs, second);
      return { fn: SIG.mint, to: HUB, r, notes: `id ${id} from the Transfer log, paid by the burner, owned by the second key`, vars: { idB: id } };
    });
    const A = BigInt(V.idA), B = BigInt(V.idB);
    const reachA = addrAt(await read(HUB, "account(uint256)", [A]));
    const reachB = addrAt(await read(HUB, "account(uint256)", [B]));
    V.reachA = reachA; V.reachB = reachB; save();
    note(`token ${A} → Reach ${reachA}; token ${B} → Reach ${reachB}`);

    /*── the coin: the Kiln's launch ──*/
    await step("launch a coin on the Kiln", "launch", "holder", async () => {
      const r = await ad.exec(KILN, SIG.launch, [A, "Rehearsal Coin", "RHRSL", 18, AMOUNTS.supply, "0x" + "01".padStart(64, "0"), AMOUNTS.raise], { label: "launch" });
      const ev = logsBy(r.logs, KILN, TOPIC.launched);
      if (ev.length !== 1) throw new Error(`expected one Launched log, saw ${ev.length}`);
      const coin = low("0x" + ev[0].topics[1].slice(26));
      await awaitCode(ad, coin, "the coin");
      const held = decUint(await read(coin, "balanceOf(address)", [reachA]));
      return { fn: SIG.launch, to: KILN, r, notes: `coin ${coin} from the Launched log; the Reach holds ${held / WAD} of ${AMOUNTS.supply / WAD}, the Launchpad the raise share`, vars: { coin } };
    });
    const COIN = V.coin;

    /*── the owned market, with a native quote ──*/
    await step("the Reach hands the holder inventory (execute → coin.transfer)", "execute", "holder", async () => {
      const r = await ad.exec(reachA, SIG.execute, [COIN, 0, enc(SIG.transfer, [me, AMOUNTS.inventory]), 0], { label: "execute" });
      return { fn: SIG.execute, to: reachA, r, notes: `${AMOUNTS.inventory / WAD} coin to ${me}` };
    });
    await step("open the owned market: coin against ETH at 30 bps", "market", "holder", async () => {
      const r = await ad.exec(POOL, SIG.openMarket, [A, COIN, ZERO, 30, 0, 0, 0], { label: "openMarket" });
      const m = await read(POOL, "marketOf(uint256)", [A]);
      return { fn: SIG.openMarket, to: POOL, r, notes: `open ${decBool(m, 7)}, base ${addrAt(m, 0)}, quote native, fee ${decUint(m, 4)} bps, no sniper fee` };
    });
    await step("approve the Pool for exactly the deposit", "market", "holder", () => tx("holder", COIN, SIG.approve, [POOL, AMOUNTS.marketBase], { label: "approve", notes: "an exact approval, never unlimited" }));
    await step("deposit inventory and the native quote", "market", "holder", async () => {
      const r = await ad.exec(POOL, SIG.deposit, [A, AMOUNTS.marketBase, AMOUNTS.marketQuote], { value: AMOUNTS.marketQuote, label: "deposit" });
      const m = await read(POOL, "marketOf(uint256)", [A]);
      return { fn: SIG.deposit, to: POOL, r, notes: `reserves ${decUint(m, 2) / WAD} coin / ${eth(decUint(m, 3))} ETH, open ${decBool(m, 7)}` };
    });

    /*── swap both ways, by the second key ──*/
    await step("swap exact-in: ETH for coin", "swap", "second", async () => {
      const q = decUint(await read(POOL, "quote(uint256,bool,uint256)", [A, false, AMOUNTS.swapIn]));
      const minOut = q - q / 100n;
      const before = decUint(await read(COIN, "balanceOf(address)", [second]));
      const r = await ad2.exec(POOL, SIG.swapIn, [A, false, AMOUNTS.swapIn, minOut, second, await deadline()], { value: AMOUNTS.swapIn, label: "swapExactIn" });
      const got = decUint(await read(COIN, "balanceOf(address)", [second])) - before;
      // a landed transaction stays in the record even when the check after it fails
      if (got < minOut) throw Object.assign(new Error(`the swap paid ${got}, under its floor ${minOut}`), { r });
      return { fn: SIG.swapIn, to: POOL, r, notes: `${eth(AMOUNTS.swapIn)} ETH in, ${got} coin units out (floor ${minOut}); deadline from the chain's clock` };
    });
    await step("approve the Pool for the exact-out swap's maximum", "swap", "second", async () => {
      const need = decUint(await read(POOL, "quoteExactOut(uint256,bool,uint256)", [A, true, AMOUNTS.swapOut]));
      const maxIn = need + need / 20n;
      return { ...(await tx("second", COIN, SIG.approve, [POOL, maxIn], { label: "approve" })), notes: `maxIn ${maxIn} coin units for ${eth(AMOUNTS.swapOut)} ETH out`, vars: { maxIn: maxIn.toString() } };
    });
    await step("swap exact-out: coin for exactly some ETH", "swap", "second", async () => {
      const before = await c.balanceOf(second);
      const r = await ad2.exec(POOL, SIG.swapOut, [A, true, AMOUNTS.swapOut, BigInt(V.maxIn), second, await deadline()], { label: "swapExactOut" });
      const after = await c.balanceOf(second);
      return { fn: SIG.swapOut, to: POOL, r, notes: `exactly ${eth(AMOUNTS.swapOut)} ETH out for at most ${V.maxIn} coin units; the key's balance moved ${eth(after - before)} ETH net of gas` };
    });

    /*── speak at home ──*/
    await step("speak at home", "speak", "holder", async () => {
      const home = decUint(await read(PARLEY, "homeKey(uint256)", [A]));
      const r = await ad.exec(PARLEY, SIG.speak, [home, A, 0, 0, 0, "0x" + Buffer.from("the rehearsal speaks at home", "utf8").toString("hex")], { label: "speak" });
      const st = await read(PARLEY, "stateOf(uint256)", [home]);
      return { fn: SIG.speak, to: PARLEY, r, notes: `home room ${home.toString(16).slice(0, 10)}…, ${logsBy(r.logs, PARLEY, TOPIC.said).length} Said log, count ${decUint(st, 1)}` };
    });

    /*── keys, a priced inbox, a stamped whisper, the reply, the settlement ──*/
    const pub = (who) => "0x" + kec(Buffer.from("rehearsal sealing key of " + who, "utf8")).slice(2);
    await step("the holder publishes a sealing key", "social", "holder", () => tx("holder", KEYS, SIG.setKey, [1, pub(me)], { label: "setEncryptionKey", notes: "X25519 (type 1), address-keyed in the KeyRegistry" }));
    await step("the holder binds the key to its token", "social", "holder", async () => {
      const r = await ad.exec(PARLEY, SIG.bindKey, [A], { label: "bindKey" });
      const k = await read(PARLEY, "keyOf(uint256)", [A]);
      return { fn: SIG.bindKey, to: PARLEY, r, notes: `keyOf(${A}) is ${word(k, 1).slice(0, 14)}… under epoch ${decUint(await read(HUB, "custodyEpoch(uint256)", [A]))}`, vars: { keyA: word(k, 1) } };
    });
    await step("the second key publishes a sealing key", "social", "second", () => tx("second", KEYS, SIG.setKey, [1, pub(second)], { label: "setEncryptionKey" }));
    await step("the second key binds the key to its token", "social", "second", async () => {
      const r = await ad2.exec(PARLEY, SIG.bindKey, [B], { label: "bindKey" });
      const k = await read(PARLEY, "keyOf(uint256)", [B]);
      return { fn: SIG.bindKey, to: PARLEY, r, notes: `keyOf(${B}) is ${word(k, 1).slice(0, 14)}…`, vars: { keyB: word(k, 1) } };
    });
    await step("the second key prices its inbox", "social", "second", () => tx("second", POSTAGE, SIG.configureInbox, [B, ZERO, AMOUNTS.postage, AMOUNTS.replyWindow, true], { label: "configureInbox", notes: `${eth(AMOUNTS.postage)} ETH, a ${AMOUNTS.replyWindow}s reply window` }));
    await step("the holder whispers SEALED with a stamp", "social", "holder", async () => {
      const r = await ad.exec(PARLEY, SIG.whisperStamped, [A, B, 1, V.keyB, "0x" + Buffer.from("sealed bytes the rehearsal lays", "utf8").toString("hex"), ZERO, AMOUNTS.postage], { value: AMOUNTS.postage, label: "whisperStamped" });
      const st = logsBy(r.logs, POSTAGE, TOPIC.stamped);
      if (st.length !== 1) throw new Error(`expected one Stamped log, saw ${st.length}`);
      return { fn: SIG.whisperStamped, to: PARLEY, r, notes: `stamp ${BigInt(st[0].topics[1])} from the Stamped log, ${eth(AMOUNTS.postage)} ETH in escrow, expectedKeyId ${V.keyB.slice(0, 14)}…`, vars: { stampId: BigInt(st[0].topics[1]).toString() } };
    });
    await step("the reply settles the postage", "social", "second", async () => {
      const r = await ad2.exec(PARLEY, SIG.whisper, [B, A, 0, "0x" + "00".repeat(32), "0x" + Buffer.from("the reply, within the window", "utf8").toString("hex")], { label: "whisper" });
      const settled = logsBy(r.logs, POSTAGE, TOPIC.settled);
      if (settled.length !== 1) throw new Error("the reply did not settle the stamp");
      const owed = decUint(await read(POSTAGE, "owed(address,address)", [reachB, ZERO]));
      return { fn: SIG.whisper, to: PARLEY, r, notes: `Settled log for stamp ${BigInt(settled[0].topics[1])}; owed[feeSink(${B})] = ${eth(owed)} ETH` };
    });
    await step("claimSettled pays the recipient's feeSink", "social", "holder", async () => {
      const before = await c.balanceOf(reachB);
      const r = await ad.exec(POSTAGE, SIG.claimSettled, [B, ZERO], { label: "claimSettled" });
      const delta = (await c.balanceOf(reachB)) - before;
      if (delta !== AMOUNTS.postage) throw new Error(`the Reach received ${delta}, not the postage ${AMOUNTS.postage}`);
      return { fn: SIG.claimSettled, to: POSTAGE, r, notes: `${eth(delta)} ETH reached Reach ${reachB} (the postage, settled, not refunded)` };
    });

    /*── the raise ──*/
    await step("create the raise on the coin", "raise", "holder", async () => {
      const dl = (await now(c)) + 7n * 86400n;
      const p = [A, COIN, AMOUNTS.curve, AMOUNTS.virtualQuote, AMOUNTS.target, 0, 0, 2n ** 128n - 1n, 0, 0, 0, 0, dl, 0];
      const r = await ad.exec(PAD, SIG.create, [p], { label: "create" });
      const launchId = decUint(await read(PAD, "launchCount()")).toString();
      const l = await read(PAD, "launchOf(uint256)", [BigInt(launchId)]);
      if (decUint(l, 3) !== 1n) throw new Error("the launch is not Live");
      return { fn: SIG.create, to: PAD, r, notes: `launch ${launchId}, target ${eth(AMOUNTS.target)} ETH, deadline ${dl} (the chain's clock + 7 d), state Live`, vars: { launchId } };
    });
    const L = BigInt(V.launchId);
    await step("the second key buys credits", "raise", "second", async () => {
      const r = await ad2.exec(PAD, SIG.buy, [L, 0, await deadline(), 0], { value: AMOUNTS.buy, label: "buy" });
      return { fn: SIG.buy, to: PAD, r, notes: `${eth(AMOUNTS.buy)} ETH; credit ${decUint(await read(PAD, "creditOf(uint256,address)", [L, second]))} units, raised ${eth(decUint(await read(PAD, "raisedOf(uint256)", [L])))} ETH` };
    });
    for (let i = 1; i <= 3; i++) {
      const raised = decUint(await read(PAD, "raisedOf(uint256)", [L]));
      if (raised >= AMOUNTS.target) break;
      await step(`the holder buys credits (${i})`, "raise", "holder", async () => {
        const r = await ad.exec(PAD, SIG.buy, [L, 0, await deadline(), 0], { value: AMOUNTS.buy, label: "buy" });
        return { fn: SIG.buy, to: PAD, r, notes: `${eth(AMOUNTS.buy)} ETH; raised ${eth(decUint(await read(PAD, "raisedOf(uint256)", [L])))} of ${eth(AMOUNTS.target)} ETH` };
      });
    }
    await step("graduate into a sealed market", "raise", "second", async () => {
      const r = await ad2.exec(PAD, SIG.graduate, [L], { label: "graduate" });
      const ev = logsBy(r.logs, PAD, TOPIC.graduated);
      if (ev.length !== 1) throw new Error(`expected one Graduated log, saw ${ev.length}`);
      const key = BigInt(ev[0].topics[2]).toString();
      const m = await read(POOL, "marketOf(uint256)", [BigInt(key)]);
      if (!decBool(m, 7) || !decBool(m, 8)) throw new Error("the market is not open and sealed");
      return { fn: SIG.graduate, to: PAD, r, notes: `sealed market ${key.slice(0, 12)}… from the Graduated log: ${decUint(m, 2) / WAD} coin / ${eth(decUint(m, 3))} ETH, beneficiary token ${decUint(m, 15)}`, vars: { marketKey: key } };
    });
    const KEY = BigInt(V.marketKey);
    await step("a buyer claims its credits", "raise", "holder", async () => {
      const r = await ad.exec(PAD, SIG.claim, [L, second], { label: "claim" });
      return { fn: SIG.claim, to: PAD, r, notes: `${decUint(await read(COIN, "balanceOf(address)", [second])) / WAD} coin now held by the second key` };
    });
    await step("a trade on the sealed market", "raise", "second", async () => {
      const r = await ad2.exec(POOL, SIG.swapIn, [KEY, false, AMOUNTS.sealedSwap, 0, second, await deadline()], { value: AMOUNTS.sealedSwap, label: "swapExactIn" });
      const m = await read(POOL, "marketOf(uint256)", [KEY]);
      return { fn: SIG.swapIn, to: POOL, r, notes: `${eth(AMOUNTS.sealedSwap)} ETH in; feeQuoteOwed ${decUint(m, 14)} wei`, vars: { feeQuoteOwed: decUint(m, 14).toString() } };
    });
    await step("collect pays the launcher's feeSink", "raise", "holder", async () => {
      const before = await c.balanceOf(reachA);
      const r = await ad.exec(POOL, SIG.collect, [KEY], { label: "collect" });
      const delta = (await c.balanceOf(reachA)) - before;
      if (delta !== BigInt(V.feeQuoteOwed) || delta === 0n) throw new Error(`the Reach received ${delta}, the market owed ${V.feeQuoteOwed}`);
      return { fn: SIG.collect, to: POOL, r, notes: `${delta} wei reached Reach ${reachA} (feeSink of ${A}), exactly the fee owed` };
    });

    /*── a lock to the Reach ──*/
    await step("lock ETH to the Reach, due in two minutes", "lock", "holder", async () => {
      const due = (await now(c)) + AMOUNTS.lockSeconds;
      const r = await ad.exec(LOCKS, SIG.lock, [ZERO, AMOUNTS.lock, reachA, 0, due, due, false], { value: AMOUNTS.lock, label: "lock" });
      const ev = logsBy(r.logs, LOCKS, TOPIC.locked);
      if (ev.length !== 1) throw new Error(`expected one Locked log, saw ${ev.length}`);
      return { fn: SIG.lock, to: LOCKS, r, notes: `lock ${BigInt(ev[0].topics[1])} from the Locked log, ${eth(AMOUNTS.lock)} ETH, cliff = end = ${due}`, vars: { lockId: BigInt(ev[0].topics[1]).toString(), lockDue: due.toString() } };
    });

    /*── a session for the second key, and one act ──*/
    await step("grant the second key a session: coin.transfer only", "session", "holder", async () => {
      const r = await ad.exec(reachA, SIG.grant, [second, (await now(c)) + 86400n, 0, [], [COIN], [sel(SIG.transfer)], 0, 0], { label: "grantSession" });
      const live = decBool(await read(reachA, "sessionCurrent(address)", [second]));
      if (!live) throw new Error("the session is not current");
      return { fn: SIG.grant, to: reachA, r, notes: `sessionCurrent true; rightsOf bits ${decUint(await read(HUB, "rightsOf(uint256,address)", [A, second]))}` };
    });
    await step("the second key acts through the session", "session", "second", async () => {
      const before = decUint(await read(COIN, "balanceOf(address)", [second]));
      const r = await ad2.exec(reachA, SIG.asSession, [COIN, 0, enc(SIG.transfer, [second, AMOUNTS.sessionTransfer])], { label: "executeAsSession" });
      const delta = decUint(await read(COIN, "balanceOf(address)", [second])) - before;
      if (delta !== AMOUNTS.sessionTransfer) throw new Error(`the session moved ${delta}, not ${AMOUNTS.sessionTransfer}`);
      return { fn: SIG.asSession, to: reachA, r, notes: `${delta / WAD} coin left the Reach by the session's hand` };
    });

    /*── seal, then panic ──*/
    await step("seal the Reach for thirty days", "seal", "holder", async () => {
      const until = (await now(c)) + AMOUNTS.sealDays * 86400n;
      const r = await ad.exec(reachA, SIG.seal, [until], { label: "seal" });
      return { fn: SIG.seal, to: reachA, r, notes: `sealedUntil ${decUint(await read(reachA, "sealedUntil()"))}` };
    });
    await step("panic, and read what it did", "panic", "holder", async () => {
      const epoch0 = decUint(await read(HUB, "custodyEpoch(uint256)", [A]));
      const r = await ad.exec(HUB, SIG.panic, [A], { label: "panic" });
      const epoch = decUint(await read(HUB, "custodyEpoch(uint256)", [A]));
      const status = decUint(await read(HUB, "statusOf(uint256)", [A]));
      const sealed = decUint(await read(reachA, "sealedUntil()"));
      const session = decBool(await read(reachA, "sessionCurrent(address)", [second]));
      const keyNow = word(await read(PARLEY, "keyOf(uint256)", [A]), 1);
      const bits = decUint(await read(HUB, "rightsOf(uint256,address)", [A, second]));
      const consequences = epoch === epoch0 + 1n && status === 1n && sealed > (await now(c)) + 360n * 86400n && !session && BigInt(keyNow) === 0n && bits === 0n;
      if (!consequences) throw new Error(`epoch ${epoch0}→${epoch}, status ${status}, sealedUntil ${sealed}, session ${session}, key ${keyNow}, bits ${bits}`);
      return { fn: SIG.panic, to: HUB, r, notes: `custodyEpoch ${epoch0} → ${epoch}, Paused, the Reach sealed to its maximum (${sealed}), the session dead, the key binding dead, the second key's rights 0`, vars: { epochAfterPanic: epoch.toString() } };
    });

    /*── the steward ──*/
    const SALT = kec(Buffer.from("the rehearsal heir's salt", "utf8"));
    await step("arrange succession: the second key as heir", "steward", "holder", async () => {
      const h = word(await read(STEWARD, "heirHashOf(address,bytes32)", [second, SALT]), 0);
      const r = await ad.exec(STEWARD, SIG.arrange, [A, h, AMOUNTS.quiet, AMOUNTS.notice, [], 0], { label: "arrange" });
      return { fn: SIG.arrange, to: STEWARD, r, notes: `wouldPass ${decUint(await read(STEWARD, "wouldPass(uint256)", [A]))} (2 = SPEAKING), quiet 30 d, notice 14 d` };
    });
    if (LOCAL) {
      await warp(AMOUNTS.quiet + 60n, "move the chain's clock past the quiet period");
      await step("summon the heir after the silence", "steward", "second", async () => {
        const r = await ad2.exec(STEWARD, SIG.summon, [A, second, SALT], { label: "summon" });
        const wp = decUint(await read(STEWARD, "wouldPass(uint256)", [A]));
        const locked = decBool(await read(HUB, "locked(uint256)", [A]));
        if (wp !== 4n || !locked) throw new Error(`wouldPass ${wp}, locked ${locked}`);
        return { fn: SIG.summon, to: STEWARD, r, notes: `wouldPass 4 (WAITING), the token locked for the notice` };
      });
      await step("the holder cancels the notice", "steward", "holder", async () => {
        const r = await ad.exec(STEWARD, SIG.cancel, [A], { label: "cancel" });
        const locked = decBool(await read(HUB, "locked(uint256)", [A]));
        if (locked) throw new Error("still locked");
        return { fn: SIG.cancel, to: STEWARD, r, notes: `wouldPass ${decUint(await read(STEWARD, "wouldPass(uint256)", [A]))} (2 = SPEAKING again), the token unlocked` };
      });
    } else {
      await step("the holder gives its sign of life (stillHere)", "steward", "holder", () => tx("holder", STEWARD, SIG.stillHere, [A], { label: "stillHere" }));
      await step("summon is refused during the quiet period (proved by its selector)", "refusal", "second", async () => {
        const r = await refusal(c, second, STEWARD, SIG.summon, [A, second, SALT], "StillSpeaking(uint64)");
        if (!r.refused) throw new Error(r.notes);
        return { fn: SIG.summon, to: STEWARD, status: "refused", notes: `${r.notes}: the quiet period ends at ${r.arg} (thirty days; a public chain's clock cannot be moved)` };
      });
      await step("cancel is refused while no notice runs (proved by its selector)", "refusal", "holder", async () => {
        const r = await refusal(c, me, STEWARD, SIG.cancel, [A], "NotCalled()");
        if (!r.refused) throw new Error(r.notes);
        return { fn: SIG.cancel, to: STEWARD, status: "refused", notes: r.notes };
      });
    }

    /*── the lock, when due ──*/
    await step("release the lock when due", "lock", "second", async () => {
      const id = BigInt(V.lockId), due = BigInt(V.lockDue);
      for (let i = 0; i < 60 && (await now(c)) < due; i++) {
        if (LOCAL) { await c.rpc("evm_increaseTime", [Number(due - (await now(c)) + 1n)]); await c.rpc("evm_mine", []); break; }
        await nap(5000);
      }
      const releasable = decUint(await read(LOCKS, "releasable(uint256)", [id]));
      if (releasable === 0n) throw new Error(`nothing releasable yet: the chain's clock is ${await now(c)}, the lock is due at ${due}`);
      const before = await c.balanceOf(reachA);
      const r = await ad2.exec(LOCKS, SIG.release, [id], { label: "release" });
      const delta = (await c.balanceOf(reachA)) - before;
      if (delta !== AMOUNTS.lock) throw new Error(`the Reach received ${delta}`);
      return { fn: SIG.release, to: LOCKS, r, notes: `${eth(delta)} ETH reached Reach ${reachA}, released by anyone, paid only to the beneficiary` };
    });

    /*── the sale ──*/
    await step("sell: transferFrom to the second key, and the seller holds nothing", "sale", "holder", async () => {
      const r = await ad.exec(HUB, SIG.transferFrom, [me, second, A], { label: "transferFrom" });
      const owner = addrAt(await read(HUB, "ownerOf(uint256)", [A]));
      const bits = decUint(await read(HUB, "rightsOf(uint256,address)", [A, me]));
      const epoch = decUint(await read(HUB, "custodyEpoch(uint256)", [A]));
      const reachOwner = addrAt(await read(reachA, "owner()"));
      if (owner !== second || bits !== 0n || reachOwner !== second) throw new Error(`owner ${owner}, seller's bits ${bits}, reach owner ${reachOwner}`);
      return { fn: SIG.transferFrom, to: HUB, r, notes: `ownerOf = the second key, rightsOf(${A}, seller) = 0, custodyEpoch ${epoch}, the Reach answers to the buyer` };
    });

    /*── the sweep ──*/
    await step("sweep the second key's remainder back to the burner", "fund", "second", async () => {
      c2.nonce = BigInt(await c.rpc("eth_getTransactionCount", [second, "pending"]));
      const gp = (BigInt(await c.rpc("eth_gasPrice")) * 15n) / 10n + 1n;
      const have = await c.balanceOf(second);
      let r = null, sent = 0n;
      for (const reserve of [27_300n * gp, 2n * 27_300n * gp, 4n * 27_300n * gp]) {
        if (have <= reserve) break;
        try { const raw = await c2.send({ to: me, value: have - reserve, label: "sweep" }); r = { gas: raw.gas, hash: raw.hash, block: raw.block, logs: [] }; sent = have - reserve; break; }
        catch (e) { if (!/insufficient|underpriced|fee|funds/i.test(e.message)) throw e; }
      }
      if (!r) throw new Error(`could not sweep ${eth(have)} ETH`);
      return { fn: "(transfer)", to: me, r, notes: `${eth(sent)} ETH back to the burner; the second key keeps ${eth(await c.balanceOf(second))} ETH (dust under one transfer's gas), the burner holds ${eth(await c.balanceOf(me))} ETH` };
    });
  } catch (e) {
    campaignFailed = e;
    note(`the campaign stopped: ${e.message}`);
  }
  camp.finishedAt = new Date().toISOString();
  save();
  const famLine = Object.entries(camp.families).map(([f, v]) => `${f} ${v.gas}`).join(", ");
  ok(!campaignFailed, `campaign · ${camp.steps.length} steps recorded in ${rel(CAMPAIGN)}: ${camp.gasTotal} gas in all (${famLine})`, campaignFailed && campaignFailed.message);

  /*═══════════════════ recover ═══════════════════*/
  head("recover (the record on disk against the chain)");
  const onDisk = JSON.parse(fs.readFileSync(RECORD, "utf8"));
  const rr = await recover(ad, onDisk, { out, log: (s) => note(s.trim()) });
  camp.recover = { checked: rr.checked, disagreeing: rr.disagreements.length, missing: rr.missing };
  save();
  ok(rr.disagreements.length === 0, `recover · ${rr.checked} fields checked, ${rr.disagreements.length} disagreeing`, rr.disagreements.map((d) => `${d.field}: record ${d.want}, chain ${d.have}`).slice(0, 8).join("; "));

  /*═══════════════════ gateway ═══════════════════*/
  head("gateway (tools/verify-gateway.mjs: bytes and headers against eth_call)");
  const ids = [V.idA, V.idB].filter(Boolean);
  const runVerify = async (url, extra = []) => {
    const vg = child("verify-gateway", process.execPath, ["tools/verify-gateway.mjs", "--gateway", url, "--record", RECORD, "--ids", ids.join(",") || "1", ...extra], { RPC_URL: RPC });
    const code = await waitExit(vg);
    const line = [...vg.lines].reverse().find((l) => /^\s*\d+ passed, \d+ failed\s*$/.test(l)) || "";
    const m = line.match(/(\d+) passed, (\d+) failed/);
    for (const l of vg.lines.filter((x) => /✗|\x1b\[31m/.test(x))) note(l.trim());
    return { code, passed: m ? Number(m[1]) : 0, failed: m ? Number(m[2]) : -1 };
  };
  let gw = null;
  const gatewayUrl = args.gateway && args.gateway !== true ? String(args.gateway).replace(/\/$/, "") : null;
  if (gatewayUrl || LOCAL) {
    let url = gatewayUrl;
    if (!url) {
      gw = child("gateway", process.execPath, ["tools/gateway.mjs", "--record", RECORD, "--port", String(GW_PORT), "--host", "127.0.0.1"], { RPC_URL: RPC });
      url = `http://127.0.0.1:${GW_PORT}`;
      await until(async () => { const r = await fetch(url + "/manifest"); return r.status === 200; }, "the gateway at " + url, 60000);
      note(`tools/gateway.mjs --record ${rel(RECORD)} --port ${GW_PORT} (pid ${gw.pid})`);
    }
    const clean = await runVerify(url);
    ok(clean.code === 0 && clean.failed === 0 && clean.passed > 0, `gateway · verify-gateway against ${url}: ${clean.passed} passed, ${clean.failed} failed`);
    camp.gateway = { url, passed: clean.passed, failed: clean.failed };
    if (!gatewayUrl) {
      const tampered = await runVerify(url, ["--tamper"]);
      ok(tampered.code === 0 && tampered.failed === 0, `gateway · the tamper fixture (a script appended, a Set-Cookie, a rewritten ETag) is caught by name: ${tampered.passed} passed, ${tampered.failed} failed`);
      camp.gateway.tamper = { passed: tampered.passed, failed: tampered.failed };
      if (gw) { try { process.kill(-gw.pid, "SIGTERM"); } catch { /* gone */ } }
    }
    save();
  } else {
    note("no --gateway given and this is not 31337: the gateway diff is run separately (docs/DEPLOYMENT.md)");
    ok(true, "gateway · skipped by instruction (no --gateway)");
  }

  /*═══════════════════ measure ═══════════════════*/
  head("measure (tokenURI on each endpoint: eth_estimateGas, then a plain eth_call)");
  const endpoints = args.endpoints && args.endpoints !== true ? String(args.endpoints).split(",").map((s) => s.trim()).filter(Boolean) : [RPC];
  const probeId = BigInt(V.idA || 1);
  camp.measure = [];
  for (const url of endpoints.slice(0, 3)) {
    const row = { endpoint: url, chainId: null, estimateGas: null, estimateMs: null, call: null, bytes: null, callMs: null };
    try {
      const ec = await RpcChain.open(url, key);
      row.chainId = ec.chainId;
      const data = enc("tokenURI(uint256)", [probeId]);
      let tA = Date.now();
      try { row.estimateGas = BigInt(await ec.rpc("eth_estimateGas", [{ to: HUB, data }])).toString(); } catch (e) { row.estimateGas = "refused: " + e.message.slice(0, 160); }
      row.estimateMs = Date.now() - tA;
      tA = Date.now();
      try { const uri = decString(await ec.call(HUB, data)); row.call = "ok"; row.bytes = Buffer.byteLength(uri, "utf8"); } catch (e) { row.call = "refused: " + e.message.slice(0, 160); }
      row.callMs = Date.now() - tA;
    } catch (e) { row.call = "unreachable: " + e.message.slice(0, 160); }
    camp.measure.push(row);
    save();
    ok(row.chainId === chainId && row.call === "ok" && /^\d+$/.test(String(row.estimateGas)), `measure · ${url}: tokenURI(${probeId}) estimates ${row.estimateGas} gas in ${row.estimateMs} ms; eth_call ${row.call}${row.bytes ? ` (${row.bytes} B)` : ""} in ${row.callMs} ms`);
  }

  /*═══════════════════ disposition ═══════════════════*/
  head("disposition");
  const admin = addrAt(await read(S.timelock, "admin()"));
  const disposition = admin === me ? "the burner holds the admin; rotation or renunciation only through the Timelock's own 7-day queue" : admin === ZERO ? "renounced" : `rotated to ${admin} (through the queue; the burner no longer holds it)`;
  const finalNonce = BigInt(await c.rpc("eth_getTransactionCount", [me, "latest"]));
  const finalBal = await c.balanceOf(me);
  const secondBal = await c.balanceOf(second);
  camp.disposition = { timelockAdmin: admin, disposition, recordSaid: onDisk.timelock && onDisk.timelock.disposition, burnerNonce: finalNonce.toString(), burnerBalance: finalBal.toString(), secondBalance: secondBal.toString(), keyFile: null, writtenAt: new Date().toISOString() };
  ok(true, `disposition · Timelock admin ${admin}: ${disposition}`);
  ok(true, `disposition · the burner ${me} ends at nonce ${finalNonce} with ${eth(finalBal)} ETH; the second key ${second} keeps ${eth(secondBal)} ETH`);
  save();
  if (args["key-file"] && args["key-file"] !== true && campaignFailed && !KEEP) {
    /*  A campaign that stopped is resumed with --resume by the same key:
        destroying it now would strand the deployment's holder, its tokens
        and the burner's remainder (the first Base Sepolia rehearsal did).
        The operator destroys it by hand once the campaign is complete. */
    camp.disposition.keyFile = "kept: the campaign stopped, resume it with --resume";
    note(`the campaign stopped, so the key file ${path.relative(ROOT, path.resolve(ROOT, String(args["key-file"])))} is KEPT for --resume (the same command again); destroy it by hand once the campaign is complete — overwrite with zeros, then unlink`);
    ok(true, "disposition · the key is kept for --resume because the campaign stopped; it is destroyed when a run completes");
  } else if (args["key-file"] && args["key-file"] !== true) {
    const kf = path.resolve(ROOT, String(args["key-file"]));
    try { destroyKeyFile(kf); camp.disposition.keyFile = "overwritten and unlinked"; ok(true, `disposition · the key file ${path.relative(ROOT, kf)} was overwritten with zeros and unlinked, after both records were written`); }
    catch (e) { camp.disposition.keyFile = "NOT destroyed: " + e.message; ok(false, `disposition · the key file could not be destroyed: ${e.message}`); }
  } else {
    camp.disposition.keyFile = LOCAL && !process.env.PRIVATE_KEY ? "hardhat's first account: nothing to destroy" : "from the environment: the operator destroys it";
    note(LOCAL && !process.env.PRIVATE_KEY ? "the key is hardhat's first account; there is nothing to destroy"
      : "the key came from the environment. Do now: `unset PRIVATE_KEY`; remove the line that set it from the shell's history (`history -d <n>`, or edit ~/.bash_history); never fund this address again. Its address lives only in the record's `deployer` field.");
    ok(true, "disposition · the key was never printed; the operator's destruction step is stated above");
  }
  save();

  console.log(`\n  ${((Date.now() - t0) / 1000).toFixed(0)} s in all · record ${rel(RECORD)} · campaign ${rel(CAMPAIGN)}${KEEP ? ` — kept: node ${RPC}` : ""}`);
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  if (!KEEP) killAll();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  if (e && e.refusal) {
    console.log(`\n  \x1b[31mrefused: ${e.message}\x1b[0m — nothing was sent`);
  } else {
    console.error(`\n  \x1b[31m${e && e.stack || e}\x1b[0m`);
    for (const ch of children) if (ch.lines.length) console.error(`\n  [${ch.name}]\n` + ch.lines.slice(-15).join("\n"));
    fail += 1;
  }
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  if (!KEEP) killAll();
  process.exit(1);
});
