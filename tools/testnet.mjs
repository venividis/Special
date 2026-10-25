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
    quote (the Reach hands the holder inventory through `execute`) → the second
    key swaps both ways (exact-in with ETH, exact-out paid in coin; every
    deadline from the chain's clock) → the holder speaks at home → both
    tokens bind a sealing key; the second prices its inbox; the holder
    whispers SEALED with a stamp; the reply settles the postage, and
    `claimSettled` pays the recipient's feeSink → the raise: `create`,
    buys until the target, `graduate` into a sealed market, a trade on it,
    `collect` pays the launcher's Reach; a buyer `claim`s its credits →
    where the chain has a venue table, the Router: the second token's Reach
    swaps on the owned market through it, and a caller that is not a Reach
    is refused by selector → where the custodian has landed (a fork, or a
    resumed run after the Timelock's delay), the v4 path: a coin from the
    second token, the hook's salt mined, `createV4Checked`, buys, the
    graduation that seeds the v4 position, swaps both ways through the
    Router, `collect`, the release refused, the ratchet extended and a
    shorter lock refused, and where the clock moves the release → a
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
        [--fork URL] [--v2] [--port n] [--gateway-port n]
    node tools/testnet.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL --record /tmp/x/31337.json
        --journal /tmp/x/31337.journal.json --campaign /tmp/x/31337.campaign.json      # spawns hardhat on 8547
    node tools/testnet.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL --rpc http://127.0.0.1:8547 …  # a running node
    node tools/testnet.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA --fork <url>
        # a hardhat fork of the chain at its latest block, spawned on 8548: records under out/fork/
        # (<url> is the chain's public endpoint, given on the command line; docs/DEPLOYMENT.md names it)
    node tools/testnet.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA --fork <url> --v2 --port 8549 --gateway-port 8083
        # the same with V2 landed by the burner in the deployment (tools/deploy.mjs --v2), on ports no other tool spawns

  V2 (W15). `--v2` is passed to deployIntact: the burner lands V2's seven
  contracts right after the Premises (tools/deploy.mjs V2_ORDER). Without
  it, where the clock moves, the satellites phase lands them through the
  Timelock's queue like the post-MVB four (they are SATELLITE_ORDER's
  tail); on a public chain it queues them. Wherever they have landed the
  campaign walks a V2 family, after the v4 family and before the lock: a
  keepsake of ether wrapped as a gift to the second key; a memory
  inscribed into token 1; token 2 listed through the Bazaar on the chain's
  own Seaport — its Reach sealed past the listing's end, Seaport approved
  for that one token, the order validated from the seller's wallet with no
  signature and published, then bought by the holder for exactly the
  price; a Studio collection launched from token 1 with the default site
  (engine/sitepage.mjs) and minted by the second key; and a word in
  Agora's commons spoken as token 1. `--port` and `--gateway-port` move
  the spawned node and gateway off 8547/8548 and 8082.

  The fork. `--fork <url>` runs the whole rehearsal against a hardhat fork
  of a rehearsal chain (hardhat.fork.config.cjs: the chain's own id, cancun
  rules), so the venue table, the Router, the custodian and the v4 launch
  path meet the real venues' code and state before a live run spends
  anything. A fork is nobody's chain: its burner is a fresh key the node
  funds, its clock can be moved, so every satellite lands in-run through
  the Timelock's queue, and its records go to out/fork/ — never under
  deployments/, which holds only what a live chain did.

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
         SATELLITES, SATELLITE_ORDER, deploySatellite, admitsSatellite, VENUES, checkVenues, V2_ORDER, RECORD_SCHEMA } from "./deploy.mjs";
import { recover } from "./recover-record.mjs";
import { encRequest, decResponse, ZERO } from "./site.mjs";
/*  V2 (W15): Seaport 1.6's order, built the one way the Bazaar's suite holds
    to Seaport's own getOrderHash, and the Studio's default site, one source */
import { etherListing, orderOf, componentsOf, pinHashOf, SIG as SEAPORT_SIG, TOPIC as BAZAAR_TOPIC, FLOORS_T, decodePublished } from "./verify-bazaar.mjs";
import { sitePage } from "../engine/sitepage.mjs";

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
  sessionTransfer: WAD, sealDays: 30n, quiet: 30n * 86400n, notice: 14n * 86400n,
  /// the Router family (where a venue table exists) and the v4 family (where the custodian has landed)
  routerSwap: UNIT / 20n, v4Gas: 6_000_000n, v4EthIn: UNIT / 100n,
  /// the v4 launch's hook terms: opens at once, locked a day, 10 % → 1 % over an hour
  v4Terms: [0, 86400, 100000, 10000, 3600],
  /// the V2 family (W15, where V2 has landed): the keepsake's ether, the listing's price, a collection's mint price,
  /// the second key's gas for its V2 steps, the seconds the keepsake frees over and the listing stays open
  keepsake: UNIT / 10n, listing: UNIT / 5n, collectionPrice: UNIT / 10n, v2SecondGas: 1_500_000n, v2HolderGas: 9_000_000n, keepsakeSeconds: 120n, listingSeconds: 3600n
};
/// What the V2 family spends besides gas: the holder's keepsake and purchase, the second key's mint.
export const V2_SPEND = { holder: AMOUNTS.keepsake + AMOUNTS.listing, second: AMOUNTS.collectionPrice };
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
/// 2,696,364 to land), the Market 1,647,536, the Roles 1,524,439; and on the
/// fork of Base Sepolia of 2026-10-18, the first chain with a venue table:
/// the custodian 3,556,363 (387,918 to queue, 3,168,445 to land). The budget
/// sits over the largest — since V2 (W15) the Studio, whose initcode carries
/// the Collection's creation code and whose constructor stores it: 6,189,198
/// in-process (627,434 to queue, 5,561,764 to land), the Keepsake 4,172,705.
export const SATELLITE_BUDGET_GAS = 6_500_000n;
/// Where the chain meters state gas (EIP-8037: 1,530 gas a byte of state,
/// against Cancun's 200 a byte of code), every gas budget above is
/// multiplied by this — a budget, not a measurement, until a run on such a
/// chain has measured one (tools/rpc.mjs `stateGas` says which chain is).
export const STATE_GAS_BUDGET = 8n;

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
  stillHere: "stillHere(uint256)", transfer: "transfer(address,uint256)", approve: "approve(address,uint256)",
  /* V2 (W15): the journey's calls, each the signature its Catalog row serves */
  wrap: "wrap(((address,uint256)[],(uint64,uint64,uint64),address,string,(uint8,uint256,uint256,uint256)))",
  inscribe: "inscribe(address,uint256,uint8,bytes,bytes32)",
  studioLaunch: "launch(uint256,(string,string,string,uint32,uint128,uint64,uint64,uint32,uint16,uint16,bytes,bytes),bytes32)",
  collectionMint: "mint(address,uint256)", agoraSpeak: "speak(uint256,uint256,uint8,uint64,uint64,bytes)"
};
const TOPIC = {
  transfer: topic("Transfer(address,address,uint256)"),
  launched: topic("Launched(address,uint256,address,string,uint256,uint256)"),
  graduated: topic("Graduated(uint256,uint256,uint256,uint256)"),
  locked: topic("Locked(uint256,address,address,address,uint256,uint64,uint64,uint64,bool)"),
  stamped: topic("Stamped(uint256,uint256,uint256,uint256,address,uint128,uint64)"),
  settled: topic("Settled(uint256,address,address,uint128)"),
  said: topic("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)"),
  panicked: topic("Panicked(uint256,uint64,address)"),
  launchCreated: topic("LaunchCreated(uint256,uint256,address,uint8,bytes32)"),
  seeded: topic("Seeded(uint256,bytes32,address,uint256,uint160,uint160,uint256)"),
  collected4: topic("Collected(uint256,address,uint256,uint256)"),
  released4: topic("Released(uint256,address,uint256,uint256)"),
  /* V2 (W15) */
  wrapped: topic("Wrapped(uint256,address,address,uint64,uint64,uint64,uint256,string)"),
  inscribed: topic("Inscribed(address,uint256,uint256,uint8,address,uint64,bytes32,bytes32,bytes)"),
  collectionLaunched: topic("Launched(address,uint256,address,string,string,uint32,uint128)"),
  collectionMinted: topic("Minted(uint256,address,uint256,uint256,uint256)")
};

/*═══════════════════ the CLI, the token first ═══════════════════*/

export const CLI_OPTIONS = ["chain", "confirm", "rpc", "record", "journal", "campaign", "gateway", "endpoints",
                            "preflight-only", "skip-deploy", "resume", "key-file", "price", "keep", "fork",
                            "v2", "port", "gateway-port"];

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
/// --fork <url>: a hardhat fork of a rehearsal chain, spawned here (the header says what it is for)
const FORK = args.fork && args.fork !== true ? String(args.fork) : null;
if (FORK && LOCAL) { console.error("--fork forks a rehearsal chain (84532, 11155111); 31337 is nobody's already"); process.exit(2); }
if (FORK && (args["key-file"] || args.rpc || args["skip-deploy"] || args.resume)) { console.error("--fork spawns its own node and makes its own key for one run: --rpc, --key-file, --skip-deploy and --resume do not apply"); process.exit(2); }
/// a chain whose clock this tool may move: 31337, or a fork
const MOVABLE = LOCAL || Boolean(FORK);
/// --port moves the node this tool spawns (31337 or a fork), --gateway-port the gateway it spawns (W15)
const portArg = (k) => { if (!args[k]) return null; const n = Number(args[k]); if (!Number.isInteger(n) || n < 1024 || n > 65535) { console.error(`--${k} takes a port number from 1024 to 65535`); process.exit(2); } return n; };
const PORT = portArg("port"), GATEWAY_PORT = portArg("gateway-port");
const RPC_PORT = PORT || 8547, GW_PORT = GATEWAY_PORT || 8082, FORK_PORT = PORT || 8548;
/// --v2 (W15): the deployment lands V2 by the burner (tools/deploy.mjs's switch)
const V2 = Boolean(args.v2);
if (args.v2 !== undefined && args.v2 !== true) { console.error("--v2 is a switch and takes no value"); process.exit(2); }
const RPC = FORK ? `http://127.0.0.1:${FORK_PORT}` : args.rpc && args.rpc !== true ? String(args.rpc) : (process.env.RPC_URL || (LOCAL ? `http://127.0.0.1:${RPC_PORT}` : null));
const SCRATCH = path.join(os.tmpdir(), "intact-testnet");
const where = (opt, name) => args[opt] && args[opt] !== true ? path.resolve(ROOT, String(args[opt])) : (LOCAL ? path.join(SCRATCH, name) : FORK ? path.join(ROOT, "out", "fork", name) : path.join(ROOT, "deployments", name));
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
  if (FORK) return kec(Buffer.concat([Buffer.from("intact.fork/1:", "utf8"), Buffer.from(String(Date.now())), keccak256(Buffer.from(String(Math.random())))]));
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
  if (FORK) {
    /*  A fork run is one-shot: its node and its key end with it, so the
        files a previous fork run left are of a chain that no longer
        exists. They are cleared; a path under deployments/ is refused,
        because that directory holds only what a live chain did.      */
    for (const p of [RECORD, JOURNAL, CAMPAIGN]) {
      if (path.relative(path.join(ROOT, "deployments"), p).split(path.sep)[0] !== "..") { console.error(`  a fork's records never go under deployments/ (${rel(p)})`); process.exit(2); }
      fs.rmSync(p, { force: true });
    }
  }

  /*──────────────── the node (31337: a child, unless --rpc; a fork: always a child) ────────────────*/
  let node = null;
  let forkInfo = null;
  if (FORK) {
    head("the node (a fork)");
    node = child("hardhat-fork", "npx", ["hardhat", "--config", "hardhat.fork.config.cjs", "node", "--port", String(FORK_PORT), "--hostname", "127.0.0.1"], { FORK_URL: FORK, FORK_CHAIN_ID: String(chainId) });
    note(`npx hardhat --config hardhat.fork.config.cjs node --port ${FORK_PORT} (pid ${node.pid}), forking ${FORK}`);
    const r0 = new RpcChain(RPC, key, chainId);
    await until(() => r0.rpc("eth_chainId"), "the fork at " + RPC, 120000);
    const meta = await r0.rpc("hardhat_metadata", []);
    /*  the fork block and its hash, never the endpoint: a record names no RPC
        endpoint (docs/DEPLOYMENT.md), a fork's under out/fork/ included (W15) */
    forkInfo = { block: meta.forkedNetwork ? String(meta.forkedNetwork.forkBlockNumber) : null, hash: meta.forkedNetwork ? meta.forkedNetwork.forkBlockHash : null };
    /*  Execution at the fork block itself would need the forked chain's
        hardfork history; a local block runs this node's own rules
        (cancun), so the first thing the fork does is mine one.          */
    await r0.rpc("evm_mine", []);
    await r0.rpc("hardhat_setBalance", [r0.from.toString(), "0x" + (100n * WAD).toString(16)]);
    note(`forked at block ${forkInfo.block}; the run's burner ${low(r0.from.toString())} is a fresh key holding 100 ETH on the fork, and nobody's`);
  }
  if (LOCAL && !(args.rpc && args.rpc !== true)) {
    head("the node");
    node = child("hardhat", "npx", ["hardhat", "node", "--port", String(RPC_PORT), "--hostname", "127.0.0.1"]);
    note(`npx hardhat node --port ${RPC_PORT} (pid ${node.pid})`);
    await until(() => new RpcChain(RPC, key, 31337).rpc("eth_chainId"), "the node at " + RPC, 90000);
  }

  /*═══════════════════ preflight (read-only) ═══════════════════*/
  head("preflight (read-only)");
  const c = await RpcChain.open(RPC, key);
  if (FORK) c.fork = forkInfo;
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
  const stalled = !MOVABLE && (blockB < blockA || skew > 600n);
  ok(!stalled, `preflight · the endpoint is live: block ${blockA} → ${blockB}; the latest block's clock is ${skew}s behind the wall clock${LOCAL ? " (a local node mines only on demand)" : ""}`, stalled ? "a replica going backwards, or more than ten minutes behind: refusing to send into it" : undefined);
  if (stalled) throw refuse("the endpoint is stalled");
  const gasPrice = BigInt(await c.rpc("eth_gasPrice"));
  ok(gasPrice > 0n, `preflight · gas price ${gasPrice} wei (${(Number(gasPrice) / 1e9).toFixed(4)} gwei)`);
  /*  EIP-8037 (tools/rpc.mjs `stateGas`): where the chain meters state
      creation as its own gas, a transaction's total may pass 2^24, its
      execution share may not, and the run's gas grows with every byte it
      stores, so the budgets below are multiplied by STATE_GAS_BUDGET.  */
  const stateGas = await c.stateGas();
  const stateX = stateGas ? STATE_GAS_BUDGET : 1n;
  note(stateGas
    ? `the chain meters state gas (EIP-8037): a one-byte creation is estimated at ${c.view.oneByteCreation} gas; the 2^24 cap binds execution gas alone, and every gas budget below is ×${stateX}`
    : `no state gas on this chain: a one-byte creation is estimated at ${c.view.oneByteCreation} gas, and every transaction stays under 2^24 in total`);
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
  // the venue table's row, re-proved against this chain before anything is sent
  const venueRow = VENUES[chainId];
  if (venueRow) {
    let held = true;
    for (const [s, v, d] of await checkVenues(ad, venueRow)) held = ok(v, `preflight · venue · ${s}`, d) && held;
    if (!held) throw refuse("the venue table's row does not hold on this chain");
  } else note(`no venue table for chain ${chainId}: the Router is skipped and the custodian refused`);
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
  /*  The MVB's 120 M budget, or with --v2 the 140 M that covers V2's seven
      as well: measured in-process (tools/verify-recover.mjs, W15) at
      109.78 M for the MVB without a Router and 127.46 M with V2's seven
      (17.68 M of them) on a row that names only Seaport; the fork's
      figures with the Router are in docs/v2/W15-deploy.md.             */
  const deployGas = (V2 ? 140_000_000n : 120_000_000n) * stateX;
  const deployNeed = skipDeploy ? 0n : (deployGas * gasPrice * 15n) / 10n + l1Deploy;
  const measured = CAMPAIGN_GAS.measuredOn !== null;
  const campaignGas = (measured ? CAMPAIGN_GAS.total : CAMPAIGN_BUDGET_GAS) * stateX;
  const secondGas = (measured ? CAMPAIGN_GAS.second : CAMPAIGN_BUDGET_GAS / 8n) * stateX;
  const steps = 50n;
  const price = args.price && args.price !== true ? BigInt(args.price) : (skipDeploy ? decUint(await c.read(JSON.parse(fs.readFileSync(RECORD, "utf8")).contracts.hub, "price()")) : 10n ** 16n);
  const secondFund = (secondGas * gasPrice * 15n) / 10n + l1PerStep * 12n + SECOND_SPEND + 2n * 27_300n * gasPrice;
  /// with --v2 the V2 family runs too: its ether, and its gas as a budget until a run has measured it (W15)
  const v2Need = V2 ? V2_SPEND.holder + V2_SPEND.second + ((AMOUNTS.v2HolderGas + AMOUNTS.v2SecondGas) * stateX * gasPrice * 15n) / 10n + l1PerStep * 12n : 0n;
  const campaignNeed = (campaignGas * gasPrice * 15n) / 10n + l1PerStep * steps + HOLDER_SPEND + 2n * price + secondFund + v2Need;
  const hasArtifact = (f, n) => { try { artifact(out, f, n); return true; } catch { return false; } };
  /// the budget's list, before any record exists: what this chain's band and venue table admit
  /// (a fresh deployment writes this tree's schema; with --v2 the burner lands V2 itself, so the Timelock lands none of it)
  const satelliteKeys = SATELLITE_ORDER.filter((k) => !(V2 && V2_ORDER.includes(k)) &&
    !admitsSatellite(k, { chainId, band: { band: band.band }, venues: VENUES[chainId] || null, schema: "intact.deployment/" + RECORD_SCHEMA }) && hasArtifact(SATELLITES[k].file, SATELLITES[k].name));
  const satelliteNeed = (BigInt(satelliteKeys.length) * SATELLITE_BUDGET_GAS * stateX * gasPrice * 15n) / 10n + l1PerStep * 2n * BigInt(satelliteKeys.length);
  const need = deployNeed + campaignNeed + satelliteNeed;
  ok(bal >= need, `preflight · balance ${eth(bal)} ETH covers ${eth(need)} ETH: the deploy ${eth(deployNeed)} (${M(deployGas)} gas × ${gasPrice} wei × 1.5 + L1${V2 ? ", V2 landed by the burner" : ""}) plus the campaign ${eth(campaignNeed)} (${campaignGas} gas ${measured ? `measured on ${CAMPAIGN_GAS.measuredOn}` : "BUDGET: no wire run measured yet"} × 1.5, two mints at ${eth(price)} ETH, ${eth(HOLDER_SPEND)} ETH the holder spends, ${eth(secondFund)} ETH funding the second key)${satelliteKeys.length ? ` plus the satellites ${eth(satelliteNeed)} (${satelliteKeys.join(", ")}: ${SATELLITE_BUDGET_GAS * stateX} gas each, a budget, × 1.5)` : ""}`,
     `fund ${me} with at least ${eth(need - bal)} ETH more`);
  if (bal < need) throw refuse(`underfunded: ${eth(need)} ETH needed, ${eth(bal)} ETH held`);
  const preflight = { rpcChainId: c.chainId, blockA: blockA.toString(), blockB: blockB.toString(), latestTimestamp: String(BigInt(latest.timestamp)), wallClock: wall.toString(), skewSeconds: skew.toString(),
                      gasPrice: gasPrice.toString(), deployer: me, nonce: nonce.toString(), balance: bal.toString(), deployBudget: deployNeed.toString(), campaignBudget: campaignNeed.toString(),
                      campaignGas: campaignGas.toString(), campaignGasMeasuredOn: CAMPAIGN_GAS.measuredOn, secondFund: secondFund.toString(), l1Oracle: oracle ? ORACLE : null, l1Deploy: l1Deploy.toString(), l1PerStep: l1PerStep.toString(),
                      placeholder: Boolean(plan.placeholder), shipBuild: ship.build, shipReason: ship.reason, price: price.toString(), fork: forkInfo };
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
      record = await deployIntact(ad, { out, plan, manifest, journalPath: JOURNAL, recordPath: RECORD, price: args.price && args.price !== true ? BigInt(args.price) : undefined, v2: V2, log: (s) => console.log("    " + s.trim()) });
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
  /// the landing's list, from the record itself: a recorded deployment with no venue table admits no custodian
  const landKeys = SATELLITE_ORDER.filter((k) => !admitsSatellite(k, record) && hasArtifact(SATELLITES[k].file, SATELLITES[k].name));
  if (!landKeys.length) note("no satellite contract is compiled in this tree; the phase runs once one lands (U14–U18)");
  for (const key of landKeys) {
    if (record.satellites?.[key]?.via === "burner" && record.contracts?.[key]) {
      ok(true, `satellites · ${key} landed at ${record.contracts[key]} by the burner in the deployment (--v2), ${M(record.satellites[key].executed.gas)} gas, and recovered with the record`);
      continue;
    }
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
    const why = admitsSatellite(key, record);
    if (why && hasArtifact(SATELLITES[key].file, SATELLITES[key].name)) note(`${key}: not landed on ${chainId} — ${why}`);
  }

  const S = record.contracts;
  const HUB = S.hub, POOL = S.pool, PARLEY = S.parley, POSTAGE = S.postage, KEYS = S.keys, KILN = S.kiln, PAD = S.launchpad, LOCKS = S.locks, STEWARD = S.steward, PREMISES = S.premises;

  /*═══════════════════ campaign ═══════════════════*/
  head("campaign (every function family, live, with receipts)");
  const secondKey = deriveSecond(key);
  const c2 = await c.as(secondKey);
  if (FORK) c2.fork = c.fork;
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
  const landed = (label) => camp.steps.find((s) => s.label === label && (s.status === "0x1" || s.status === "refused" || s.status === "local-only" || s.status === "skipped" || s.status === "read"));
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
    if (!MOVABLE) return { status: "skipped", notes: "a public chain's clock cannot be moved" };
    await c.rpc("evm_increaseTime", [Number(seconds)]); await c.rpc("evm_mine", []);
    return { status: "local-only", notes: `evm_increaseTime(${seconds}) + evm_mine on ${LOCAL ? "31337" : `a fork of ${chainId}`}: the chain's clock reads ${await now(c)}` };
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

    /*── the Router: the only door a Reach trades through ──*/
    const ROUTER = S.router || null;
    const REQ = "(uint8,address,address,uint256,uint256,uint64,uint256,bytes,(address,address,uint24,int24,address),uint160)";
    const NOKEY = [ZERO, ZERO, 0, 0, ZERO];
    if (ROUTER) {
      await step("the Reach of token 2 swaps ETH for coin on the owned market through the Router", "router", "second", async () => {
        const amountIn = AMOUNTS.routerSwap;
        const q = decUint(await read(POOL, "quote(uint256,bool,uint256)", [A, false, amountIn]));
        const minOut = q - q / 100n;
        const before = decUint(await read(COIN, "balanceOf(address)", [reachB]));
        const req = [0, ZERO, COIN, amountIn, minOut, await deadline(), A, "0x", NOKEY, 0n];
        const r = await ad2.exec(reachB, SIG.execute, [ROUTER, amountIn, enc(`swap(${REQ})`, [req]), 0], { label: "execute → Router.swap" });
        const got = decUint(await read(COIN, "balanceOf(address)", [reachB])) - before;
        if (got < minOut) throw Object.assign(new Error(`the Router paid ${got}, under its floor ${minOut}`), { r });
        return { fn: SIG.execute, to: reachB, r, notes: `${eth(amountIn)} ETH of the Reach's own in, ${got} coin units out (floor ${minOut}), market ${A} by its key` };
      });
      await step("a caller that is not a Reach is refused by the Router (proved by its selector)", "refusal", "second", async () => {
        const req = [0, ZERO, COIN, AMOUNTS.routerSwap, 0n, await deadline(), A, "0x", NOKEY, 0n];
        const x = await refusal(c, second, ROUTER, `swap(${REQ})`, [req], "NotReach(address)", AMOUNTS.routerSwap);
        if (!x.refused) throw new Error(x.notes);
        return { fn: `swap(${REQ})`, to: ROUTER, status: "refused", notes: x.notes };
      });
    } else note("no Router on this chain (no venue table): the router family is skipped");

    /*── the v4 path: a raise graduates into a Uniswap v4 pool the custodian holds ──*/
    const CUST = S.custodian && (await ad.codeAt(S.custodian)) !== "0x" ? S.custodian : null;
    if (CUST && ROUTER) {
      const TERMS4 = "(uint32,uint32,uint24,uint24,uint32)";
      const PARAMS4 = "(uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8)";
      const POSM = record.venues.positionManager, PM = record.venues.poolManager, PERMIT2 = record.venues.permit2;
      const MIN_SQRT = 4295128739n, MAX_SQRT = 1461446703485210103287273052203988822378723970342n;
      await step("fund the second key for the v4 path", "v4", "holder", async () => {
        const gp = BigInt(await c.rpc("eth_gasPrice"));
        const need = (AMOUNTS.v4Gas * gp * 15n) / 10n;
        const have = await c.balanceOf(second);
        if (have >= need) return { status: "skipped", notes: `the second key holds ${eth(have)} ETH, the v4 steps' ${AMOUNTS.v4Gas} gas at ${gp} wei × 1.5 needs ${eth(need)}` };
        const raw = await c.send({ to: second, value: need - have, label: "fund" });
        return { fn: "(transfer)", to: second, r: { gas: raw.gas, hash: raw.hash, block: raw.block, logs: [] }, notes: `${eth(need - have)} ETH: the v4 steps' ${AMOUNTS.v4Gas} gas at ${gp} wei × 1.5` };
      });
      await step("launch a coin from token 2 for the v4 target", "v4", "second", async () => {
        const r = await ad2.exec(KILN, SIG.launch, [B, "Rehearsal Four", "RHRS4", 18, AMOUNTS.supply, "0x" + "04".padStart(64, "0"), AMOUNTS.raise], { label: "launch" });
        const ev = logsBy(r.logs, KILN, TOPIC.launched);
        if (ev.length !== 1) throw new Error(`expected one Launched log, saw ${ev.length}`);
        const coin = low("0x" + ev[0].topics[1].slice(26));
        await awaitCode(ad, coin, "the coin");
        return { fn: SIG.launch, to: KILN, r, notes: `coin ${coin} from the Launched log, token 2's first launch`, vars: { coin4: coin } };
      });
      const COIN4 = V.coin4;
      const arg4 = "0x" + COIN4.slice(2).padStart(64, "0");
      await step("mine the hook's salt for exactly its three permissions (a free eth_call)", "v4", "node", async () => {
        const rh = await read(KILN, "recipeHash(uint8,bytes32)", [1, arg4]);
        const hash = word(rh, 0), flags = decUint(rh, 1);
        for (let f = 0n; f < 1_000_000n; f += 8192n) {
          const m = await read(KILN, "mine(bytes32,uint16,uint256,uint256)", [hash, Number(flags), f, 8192n]);
          if (decUint(m, 0) !== 1n) continue;
          const salt = word(m, 1), at = addrAt(m, 2);
          const predicted = addrAt(await read(CUST, "hookAt(address,bytes32)", [COIN4, salt]));
          if (predicted !== at) throw new Error(`the custodian predicts ${predicted}, the Kiln mined ${at}`);
          return { status: "read", notes: `salt ${salt.slice(0, 18)}… within ${f + 8192n} tries; the hook will live at ${at} with flags ${flags} in its low bits, and the custodian predicts the same address`, vars: { hookSalt: salt, hookAt: at } };
        }
        throw new Error("no salt in a million tries");
      });
      await step("createV4Checked: the v4 target, the hook terms and the mined salt", "v4", "second", async () => {
        const dl = (await now(c)) + 7n * 86400n;
        const p = [B, COIN4, AMOUNTS.curve, AMOUNTS.virtualQuote, AMOUNTS.target, 0, 0, 2n ** 128n - 1n, 0, 0, 0, 0, dl, 1];
        const h = AMOUNTS.v4Terms;
        const termsHash = await read(PAD, `v4TermsHash(${PARAMS4},${TERMS4},bytes32)`, [p, h, V.hookSalt]);
        const r = await ad2.exec(PAD, `createV4Checked(${PARAMS4},${TERMS4},bytes32,bytes32)`, [p, h, V.hookSalt, termsHash], { label: "createV4Checked" });
        const ev = logsBy(r.logs, PAD, TOPIC.launchCreated);
        if (ev.length !== 1) throw new Error(`expected one LaunchCreated log, saw ${ev.length}`);
        const launchId = BigInt(ev[0].topics[1]).toString();
        const cu = await read(CUST, "custodyOf(uint256)", [BigInt(launchId)]);
        if (addrAt(cu, 0) !== low(COIN4) || addrAt(cu, 3) !== low(V.hookAt)) throw Object.assign(new Error("the custodian did not register the coin and the hook"), { r });
        return { fn: "createV4Checked", to: PAD, r, notes: `launch ${launchId}, target ${eth(AMOUNTS.target)} ETH; the custodian registered the coin and the hook at ${V.hookAt}; opens at once, locked ${h[1]} s, fee ${h[2] / 10000} % → ${h[3] / 10000} % over ${h[4]} s`, vars: { launchV4: launchId } };
      });
      const L4 = BigInt(V.launchV4);
      for (let i = 1; i <= 4; i++) {
        if (decUint(await read(PAD, "raisedOf(uint256)", [L4])) >= AMOUNTS.target) break;
        await step(`the holder buys credits on the v4 launch (${i})`, "v4", "holder", async () => {
          const r = await ad.exec(PAD, SIG.buy, [L4, 0, await deadline(), 0], { value: AMOUNTS.buy, label: "buy" });
          return { fn: SIG.buy, to: PAD, r, notes: `${eth(AMOUNTS.buy)} ETH; raised ${eth(decUint(await read(PAD, "raisedOf(uint256)", [L4])))} of ${eth(AMOUNTS.target)} ETH` };
        });
      }
      await step("graduate into a Uniswap v4 pool: the custodian seeds the position through the PositionManager", "v4", "holder", async () => {
        const r = await ad.exec(PAD, SIG.graduate, [L4], { label: "graduate v4" });
        const ev = logsBy(r.logs, CUST, TOPIC.seeded);
        if (ev.length !== 1) throw Object.assign(new Error(`expected one Seeded log, saw ${ev.length}`), { r });
        const poolId = ev[0].topics[2], hook = low("0x" + ev[0].topics[3].slice(26));
        const tokenId = decUint(ev[0].data, 0), terminal = decUint(ev[0].data, 1), live = decUint(ev[0].data, 2), liquidity = decUint(ev[0].data, 3);
        const owner = addrAt(await read(POSM, "ownerOf(uint256)", [tokenId]));
        const held = decUint(await read(POSM, "getPositionLiquidity(uint256)", [tokenId]));
        const slot0 = BigInt(await read(PM, "extsload(bytes32)", [kec(Buffer.from(poolId.slice(2) + "06".padStart(64, "0"), "hex"))])) & ((1n << 160n) - 1n);
        const hookHash = kec(Buffer.from((await ad.codeAt(hook)).slice(2), "hex"));
        const al = await read(PERMIT2, "allowance(address,address,address)", [CUST, COIN4, POSM]);
        const checks = [
          [owner === low(CUST), `the position is the custodian's (ownerOf says ${owner})`],
          [held === liquidity, `the PositionManager holds the Seeded liquidity for it (${held})`],
          [slot0 === live, `the PoolManager's slot0 is the seeded price (${slot0})`],
          [low(hookHash) === low(record.venues.launchHookCodehash), "the hook's codehash is the Router's LAUNCH_HOOK_CODEHASH"],
          [decUint(al, 0) === 0n, "the custodian's Permit2 allowance is back to zero"],
          [(await c.balanceOf(CUST)) === 0n, "the custodian holds no ether"],
          [decUint(await read(COIN4, "balanceOf(address)", [CUST])) === 0n, "nor coin"]];
        const bad = checks.filter(([v]) => !v).map(([, s]) => s);
        if (bad.length) throw Object.assign(new Error(bad.join("; ")), { r });
        return { fn: SIG.graduate, to: PAD, r, notes: `pool ${poolId.slice(0, 12)}… initialised at the terminal sqrt price ${terminal} (slot0 ${live}); position ${tokenId} of the PositionManager, the custodian's, ${liquidity} liquidity; the hook at ${hook} with the codehash the Router pins; Permit2's allowance back to zero, nothing left in the custodian`, vars: { v4TokenId: tokenId.toString(), poolId, v4Hook: hook } };
      });
      const key4 = async () => { const k = await read(CUST, "poolKeyOf(uint256)", [L4]); return [addrAt(k, 0), addrAt(k, 1), Number(decUint(k, 2)), Number(BigInt.asIntN(24, decUint(k, 3))), addrAt(k, 4)]; };
      const quote4 = async (req) => {
        let d = null;
        try { await c.call(ROUTER, enc(`quoteExactIn(${REQ})`, [req]), reachB); }
        catch (e) { d = typeof e.data === "string" ? e.data : (e.data && typeof e.data.data === "string" ? e.data.data : null); if (!d) throw new Error(`the quote failed: ${e.message.slice(0, 200)}`); }
        if (!d || d.slice(0, 10) !== sel("QuoteResult(uint256,uint256,uint160)")) throw new Error(`no QuoteResult: ${d ? d.slice(0, 10) : "the quote did not revert"}`);
        return { spent: decUint("0x" + d.slice(10), 0), received: decUint("0x" + d.slice(10), 1) };
      };
      await step("the Reach of token 2 approves the Router for exactly the v4 swap", "v4", "second", async () => {
        const amt = decUint(await read(COIN4, "balanceOf(address)", [reachB])) / 1000n;
        const r = await ad2.exec(reachB, SIG.execute, [COIN4, 0, enc(SIG.approve, [ROUTER, amt]), 0], { label: "execute → approve" });
        return { fn: SIG.execute, to: reachB, r, notes: `${amt} coin units, exactly the swap's input`, vars: { v4CoinIn: amt.toString() } };
      });
      await step("swap coin for ETH through the Router on the v4 pool: the hook's fee applies", "v4", "second", async () => {
        const k = await key4(), amountIn = BigInt(V.v4CoinIn);
        const at = (minOut) => [2, COIN4, ZERO, amountIn, minOut, 0n, 0n, "0x", k, MAX_SQRT - 1n];
        const dl = await deadline();
        const q = await quote4([...at(0n).slice(0, 5), dl, ...at(0n).slice(6)]);
        const minOut = q.received - q.received / 100n;
        const before = await c.balanceOf(reachB);
        const r = await ad2.exec(reachB, SIG.execute, [ROUTER, 0, enc(`swap(${REQ})`, [[...at(minOut).slice(0, 5), dl, ...at(minOut).slice(6)]]), 0], { label: "execute → Router.swap v4" });
        const got = (await c.balanceOf(reachB)) - before;
        if (got < minOut) throw Object.assign(new Error(`the Reach received ${got} wei, under the floor ${minOut}`), { r });
        const fee = decUint(await read(V.v4Hook, "feeAt(uint64)", [await now(c)]));
        return { fn: SIG.execute, to: reachB, r, notes: `${amountIn} coin units in, ${got} wei out (quoted ${q.received}); the hook's fee at this block ${Number(fee) / 10000} %` };
      });
      await step("swap ETH for coin through the Router on the v4 pool", "v4", "second", async () => {
        const k = await key4(), amountIn = AMOUNTS.v4EthIn, dl = await deadline();
        const at = (minOut) => [2, ZERO, COIN4, amountIn, minOut, dl, 0n, "0x", k, MIN_SQRT + 1n];
        const q = await quote4(at(0n));
        const minOut = q.received - q.received / 100n;
        const before = decUint(await read(COIN4, "balanceOf(address)", [reachB]));
        const r = await ad2.exec(reachB, SIG.execute, [ROUTER, amountIn, enc(`swap(${REQ})`, [at(minOut)]), 0], { label: "execute → Router.swap v4" });
        const got = decUint(await read(COIN4, "balanceOf(address)", [reachB])) - before;
        if (got < minOut) throw Object.assign(new Error(`the Reach received ${got} coin units, under the floor ${minOut}`), { r });
        return { fn: SIG.execute, to: reachB, r, notes: `${eth(amountIn)} ETH of the Reach's own in, ${got} coin units out (quoted ${q.received})` };
      });
      await step("collect: the v4 position's fees to feeSink(2), by anyone", "v4", "holder", async () => {
        const sink = addrAt(await read(HUB, "feeSink(uint256)", [B]));
        const e0 = await c.balanceOf(sink), c0 = decUint(await read(COIN4, "balanceOf(address)", [sink]));
        const r = await ad.exec(CUST, "collect(uint256)", [L4], { label: "collect v4" });
        const ev = logsBy(r.logs, CUST, TOPIC.collected4);
        if (ev.length !== 1) throw Object.assign(new Error(`expected one Collected log, saw ${ev.length}`), { r });
        const a0 = decUint(ev[0].data, 0), a1 = decUint(ev[0].data, 1);
        const e1 = await c.balanceOf(sink), c1 = decUint(await read(COIN4, "balanceOf(address)", [sink]));
        if (a0 === 0n || a1 === 0n || e1 - e0 !== a0 || c1 - c0 !== a1) throw Object.assign(new Error(`Collected ${a0} wei and ${a1} coin units; the sink moved ${e1 - e0} and ${c1 - c0}`), { r });
        return { fn: "collect(uint256)", to: CUST, r, notes: `${a0} wei and ${a1} coin units of fees reached feeSink(2) ${sink}, collected by token 1's holder, nothing through the custodian` };
      });
      await step("release is refused before the unlock (proved by its selector)", "refusal", "second", async () => {
        const x = await refusal(c, second, CUST, "release(uint256)", [L4], "StillLocked(uint64)");
        if (!x.refused) throw new Error(x.notes);
        return { fn: "release(uint256)", to: CUST, status: "refused", notes: `${x.notes}: the principal waits for unlocksAt` };
      });
      await step("the ratchet: extend the lock by a day", "v4", "second", async () => {
        const before = decUint(await read(CUST, "unlocksAt(uint256)", [L4]));
        const r = await ad2.exec(CUST, "extend(uint256,uint64)", [L4, before + 86400n], { label: "extend" });
        const after = decUint(await read(CUST, "unlocksAt(uint256)", [L4]));
        if (after !== before + 86400n) throw Object.assign(new Error(`unlocksAt ${after}, not ${before + 86400n}`), { r });
        return { fn: "extend(uint256,uint64)", to: CUST, r, notes: `unlocksAt ${before} → ${after}`, vars: { v4Unlocks: after.toString() } };
      });
      await step("a shorter lock is refused (proved by its selector)", "refusal", "second", async () => {
        const x = await refusal(c, second, CUST, "extend(uint256,uint64)", [L4, BigInt(V.v4Unlocks) - 1n], "RatchetOnly()");
        if (!x.refused) throw new Error(x.notes);
        return { fn: "extend(uint256,uint64)", to: CUST, status: "refused", notes: x.notes };
      });
      if (MOVABLE) {
        await warp(BigInt(V.v4Unlocks) - (await now(c)) + 60n, "move the chain's clock past the v4 lock");
        await step("release: the principal home to the Reach once the lock has passed", "v4", "second", async () => {
          const e0 = await c.balanceOf(reachB), c0 = decUint(await read(COIN4, "balanceOf(address)", [reachB]));
          const r = await ad2.exec(CUST, "release(uint256)", [L4], { label: "release v4" });
          const ev = logsBy(r.logs, CUST, TOPIC.released4);
          if (ev.length !== 1) throw Object.assign(new Error(`expected one Released log, saw ${ev.length}`), { r });
          const a0 = decUint(ev[0].data, 0), a1 = decUint(ev[0].data, 1);
          const e1 = await c.balanceOf(reachB), c1 = decUint(await read(COIN4, "balanceOf(address)", [reachB]));
          let left = null;
          try { left = decUint(await read(POSM, "getPositionLiquidity(uint256)", [BigInt(V.v4TokenId)])); } catch { left = 0n; }
          if (a0 === 0n || a1 === 0n || e1 - e0 !== a0 || c1 - c0 !== a1 || left !== 0n) throw Object.assign(new Error(`Released ${a0} wei and ${a1} coin units; the Reach moved ${e1 - e0} and ${c1 - c0}; liquidity left ${left}`), { r });
          return { fn: "release(uint256)", to: CUST, r, notes: `${eth(a0)} ETH and ${a1 / WAD} coin of principal and fees reached Reach ${reachB}, only the Reach; the position is burned` };
        });
      } else note("a public chain's clock cannot be moved: the release waits for unlocksAt (refused above, by its selector)");
    } else note(`the v4 family is skipped: ${!ROUTER ? "no Router on this chain (no venue table)" : "the custodian has not landed here yet — it waits for the Timelock's delay; a fork (--fork) walks this path in-run"}`);

    /*── V2 (W15): where V2 has landed, one walk through each contract, every step with its receipt.
         Token 2 is the one listed, so token 1 keeps its holder for the steps after this family. ──*/
    const landedV2 = {};
    for (const k of ["keepsake", "journal", "bazaar", "studio", "agora"]) landedV2[k] = Boolean(S[k]) && (await ad.codeAt(S[k])) !== "0x";
    if (Object.values(landedV2).some(Boolean)) {
      const PA = (BigInt(HUB) << 96n) | A;                                  // token 1 as a persona: the hub in the high 160 bits, the id in the low 96
      const hexText = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
      const ZERO32 = "0x" + "00".repeat(32);
      await step("fund the second key for the V2 family", "v2", "holder", async () => {
        const gp = BigInt(await c.rpc("eth_gasPrice"));
        const need = (AMOUNTS.v2SecondGas * gp * 15n) / 10n + V2_SPEND.second;
        const have = await c.balanceOf(second);
        if (have >= need) return { status: "skipped", notes: `the second key holds ${eth(have)} ETH; its V2 steps need ${eth(need)} (${AMOUNTS.v2SecondGas} gas at ${gp} wei × 1.5 and a mint)` };
        const raw = await c.send({ to: second, value: need - have, label: "fund" });
        return { fn: "(transfer)", to: second, r: { gas: raw.gas, hash: raw.hash, block: raw.block, logs: [] }, notes: `${eth(need - have)} ETH: ${AMOUNTS.v2SecondGas} gas at ${gp} wei × 1.5 and the mint price` };
      });
      if (landedV2.keepsake) {
        await step("wrap a keepsake: ether that frees over two minutes, a gift to the second key", "v2", "holder", async () => {
          const end = (await now(c)) + AMOUNTS.keepsakeSeconds;
          const w = [[[ZERO, AMOUNTS.keepsake]], [0, 0, end], second, "kept for the second key by the rehearsal", [0, 0, 0, 0]];
          const r = await ad.exec(S.keepsake, SIG.wrap, [w], { value: AMOUNTS.keepsake, label: "wrap" });
          const ev = logsBy(r.logs, S.keepsake, TOPIC.wrapped);
          if (ev.length !== 1) throw Object.assign(new Error(`expected one Wrapped log, saw ${ev.length}`), { r });
          const id = BigInt(ev[0].topics[1]);
          const owner = addrAt(await read(S.keepsake, "ownerOf(uint256)", [id]));
          if (owner !== second) throw Object.assign(new Error(`keepsake ${id} is held by ${owner}, not the second key`), { r });
          return { fn: SIG.wrap, to: S.keepsake, r, notes: `keepsake ${id} from the Wrapped log, held by the second key: ${eth(AMOUNTS.keepsake)} ETH freeing until ${end} on the chain's clock`, vars: { keepsakeId: id.toString() } };
        });
      }
      if (landedV2.journal) {
        await step("inscribe a memory into token 1", "v2", "holder", async () => {
          const before = decUint(await read(S.journal, "countOf(address,uint256)", [HUB, A]));
          const r = await ad.exec(S.journal, SIG.inscribe, [HUB, A, 0, hexText("the rehearsal remembers this token"), ZERO32], { label: "inscribe" });
          const ev = logsBy(r.logs, S.journal, TOPIC.inscribed);
          if (ev.length !== 1) throw Object.assign(new Error(`expected one Inscribed log, saw ${ev.length}`), { r });
          const after = decUint(await read(S.journal, "countOf(address,uint256)", [HUB, A]));
          if (after !== before + 1n) throw Object.assign(new Error(`countOf moved ${before} → ${after}`), { r });
          return { fn: SIG.inscribe, to: S.journal, r, notes: `memory ${BigInt(ev[0].topics[3])} from the Inscribed log; countOf(hub, ${A}) ${before} → ${after}, rootOf ${word(await read(S.journal, "rootOf(address,uint256)", [HUB, A]), 0).slice(0, 14)}…` };
        });
      }
      const SEA = record.venues?.seaport || null;
      if (landedV2.bazaar && SEA) {
        const BZ = S.bazaar;
        if (!V.listEnd) { V.listStart = (await now(c)).toString(); V.listEnd = (BigInt(V.listStart) + AMOUNTS.listingSeconds).toString(); V.listSalt = BigInt(kec(Buffer.from(`intact.campaign/1:listing:${HUB}:${B}`, "utf8"))).toString(); save(); }
        const reachB2 = addrAt(await read(HUB, "account(uint256)", [B]));
        await step("seal token 2's Reach past the listing's end (the Bazaar's floor on the Reach)", "v2", "second", async () => {
          const until = BigInt(V.listEnd) + 600n;
          const r = await ad2.exec(reachB2, SIG.seal, [until], { label: "seal" });
          return { fn: SIG.seal, to: reachB2, r, notes: `sealedUntil ${decUint(await read(reachB2, "sealedUntil()"))}, past the listing's end ${V.listEnd}` };
        });
        await step("approve Seaport for token 2 alone", "v2", "second", () => tx("second", HUB, SIG.approve, [SEA, B], { label: "approve", notes: `getApproved(${B}) is Seaport 1.6 at ${SEA}; a sale clears it` }));
        /* the order, built after the last write to the token so the fingerprint it pins is the one a fill finds */
        const roy = await read(HUB, "royaltyInfo(uint256,uint256)", [B, AMOUNTS.listing]);
        const receiver = addrAt(roy, 0), royalty = decUint(roy, 1);
        const fp = word(await read(HUB, "getStateFingerprint(uint256)", [B]), 0);
        const zh = pinHashOf(BZ, B, fp, []);
        const theirs = word(await read(BZ, `pinHash(uint256,bytes32,${FLOORS_T})`, [B, fp, []]), 0);
        if (low(theirs) !== low(zh)) throw new Error(`the Bazaar's pinHash ${theirs} is not the page's ${zh}`);
        const o = etherListing({ token: HUB, id: B, seller: second, price: AMOUNTS.listing, royalty, receiver, zone: BZ, zoneHash: zh,
                                 start: BigInt(V.listStart), end: BigInt(V.listEnd), salt: BigInt(V.listSalt) });
        const counter = decUint(await read(SEA, "getCounter(address)", [second]));
        const orderHash = word(await read(SEA, SEAPORT_SIG.getOrderHash, [componentsOf(o, counter)]), 0);
        await step("validate the listing on Seaport from the seller's wallet, with no signature", "v2", "second", async () => {
          const r = await ad2.exec(SEA, SEAPORT_SIG.validate, [[orderOf(o)]], { label: "validate" });
          const st = await read(SEA, "getOrderStatus(bytes32)", [orderHash]);
          if (!decBool(st, 0) || decBool(st, 1)) throw Object.assign(new Error(`Seaport says validated ${decBool(st, 0)}, cancelled ${decBool(st, 1)}`), { r });
          return { fn: SEAPORT_SIG.validate, to: SEA, r, notes: `order ${orderHash.slice(0, 14)}… at the seller's counter ${counter}, validated on the chain's own Seaport; ${eth(AMOUNTS.listing)} ETH${royalty ? `, ${eth(royalty)} of it the royalty to ${receiver}` : ", no royalty owed"}, zoned to the Bazaar under pin ${zh.slice(0, 14)}…`, vars: { orderHash } };
        });
        await step("publish it through the Bazaar, which pins the fingerprint and indexes the order", "v2", "holder", async () => {
          const r = await ad.exec(BZ, SEAPORT_SIG.publish, [orderOf(o), []], { label: "publish" });
          const ev = logsBy(r.logs, BZ, BAZAAR_TOPIC.published);
          if (ev.length !== 1) throw Object.assign(new Error(`expected one Published log, saw ${ev.length}`), { r });
          const pub = decodePublished(ev[0]);
          if (low(pub.orderHash) !== low(orderHash) || pub.identifier !== B || pub.price !== AMOUNTS.listing) throw Object.assign(new Error(`Published names ${pub.orderHash} for ${pub.identifier} at ${pub.price}`), { r });
          const chk = word(await read(BZ, "check(bytes32,uint256)", [zh, BigInt(V.listEnd)]), 0);
          if (BigInt(chk) !== 0n) throw Object.assign(new Error(`check says ${chk.slice(0, 10)}: a fill would be refused`), { r });
          return { fn: SEAPORT_SIG.publish, to: BZ, r, notes: `Published log: order ${pub.orderHash.slice(0, 14)}…, token ${pub.identifier}, ${eth(pub.price)} ETH until ${pub.endTime}; check() is zero, so a fill would pass` };
        });
        await step("buy it on Seaport for exactly the price: the seller is paid and token 2 moves to the holder", "v2", "holder", async () => {
          const before = await c.balanceOf(second);
          const r = await ad.exec(SEA, SEAPORT_SIG.fulfillOrder, [orderOf(o), ZERO32], { value: AMOUNTS.listing, label: "fulfillOrder" });
          const owner = addrAt(await read(HUB, "ownerOf(uint256)", [B]));
          const paid = (await c.balanceOf(second)) - before;
          if (owner !== me || paid !== AMOUNTS.listing - royalty) throw Object.assign(new Error(`owner ${owner}, the seller was paid ${paid}`), { r });
          const fills = logsBy(r.logs, SEA, BAZAAR_TOPIC.orderFulfilled).length;
          return { fn: SEAPORT_SIG.fulfillOrder, to: SEA, r, notes: `token ${B} is the holder's; the seller received ${eth(paid)} ETH; ${fills} OrderFulfilled log; custodyEpoch ${decUint(await read(HUB, "custodyEpoch(uint256)", [B]))}` };
        });
      } else if (landedV2.bazaar) note("the Bazaar has landed but the record's venue row names no Seaport: the listing is skipped");
      if (landedV2.studio) {
        const SALT = kec(Buffer.from(`intact.campaign/1:collection:${HUB}:${A}`, "utf8"));
        const at = addrAt(await read(S.studio, "predict(uint256,bytes32)", [PA, SALT]));
        const spec = ["Rehearsal", "RHRSL", "A collection the rehearsal launched from token 1; every token is its own site.", 100, AMOUNTS.collectionPrice,
                      0, 0, 0, 0, 0, hexText(sitePage("Rehearsal")), "0x"];
        await step("launch a Studio collection from token 1, with the default site", "v2", "holder", async () => {
          const r = await ad.exec(S.studio, SIG.studioLaunch, [PA, spec, SALT], { label: "launch collection" });
          const ev = logsBy(r.logs, S.studio, TOPIC.collectionLaunched);
          if (ev.length !== 1 || low("0x" + ev[0].topics[1].slice(26)) !== low(at)) throw Object.assign(new Error(`the Launched log names ${ev.length ? "0x" + ev[0].topics[1].slice(26) : "nothing"}, predict said ${at}`), { r });
          await awaitCode(ad, at, "the collection");
          return { fn: SIG.studioLaunch, to: S.studio, r, notes: `collection ${at} from the Launched log, where predict(${PA.toString(16).slice(0, 10)}…, salt) said it would be; the default site is ${Buffer.byteLength(sitePage("Rehearsal"))} B`, vars: { collection: at } };
        });
        await step("mint from it", "v2", "second", async () => {
          const r = await ad2.exec(V.collection, SIG.collectionMint, [second, 0], { value: AMOUNTS.collectionPrice, label: "mint collection" });
          const ev = logsBy(r.logs, V.collection, TOPIC.transfer);
          if (ev.length !== 1) throw Object.assign(new Error(`expected one Transfer log, saw ${ev.length}`), { r });
          const id = BigInt(ev[0].topics[3]);
          const supply = decUint(await read(V.collection, "totalSupply()"));
          return { fn: SIG.collectionMint, to: V.collection, r, notes: `token ${id} from the Transfer log, the second key's; totalSupply ${supply}; ${eth(AMOUNTS.collectionPrice)} ETH owed to token 1`, vars: { collectionId: id.toString() } };
        });
      }
      if (landedV2.agora) {
        await step("speak in Agora's commons as token 1", "v2", "holder", async () => {
          const r = await ad.exec(S.agora, SIG.agoraSpeak, [0, PA, 0, 0, 0, hexText("gm from the rehearsal")], { label: "speak" });
          const said = logsBy(r.logs, S.agora, TOPIC.said);
          if (said.length !== 1 || BigInt(said[0].topics[2]) !== PA) throw Object.assign(new Error(`expected one Said log from token 1's persona, saw ${said.length}`), { r });
          const st = await read(S.agora, "stateOf(uint256)", [0]);
          return { fn: SIG.agoraSpeak, to: S.agora, r, notes: `one Said log in the commons from persona ${PA.toString(16).slice(0, 12)}…; the commons now counts ${decUint(st, 1)}` };
        });
      }
    } else note("no V2 contract has landed here: the V2 family is skipped (--v2 lands them in the deployment, the satellites phase where the clock moves)");

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
    if (MOVABLE) {
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
        if (MOVABLE) { await c.rpc("evm_increaseTime", [Number(due - (await now(c)) + 1n)]); await c.rpc("evm_mine", []); break; }
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
  if (gatewayUrl || MOVABLE) {
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
  if (FORK) {
    camp.disposition.keyFile = "a fork's own key, made for this run: nothing to destroy";
    ok(true, "disposition · the fork's key was made for this run and lives nowhere else; the fork ends with the node");
  } else if (args["key-file"] && args["key-file"] !== true && campaignFailed && !KEEP) {
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
