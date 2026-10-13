#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · every historical finding, replayed against the contracts

  Origin: IPSEITY tools/verify-findings.mjs — thirteen adversary-panel
  claims, each ending `reproduced(...)` or `refuted(...)`, on the principle
  that a fix nobody can re-run is a fix nobody can trust. INTACT (U12)
  keeps the shape and widens the list to every class the four donor
  reviews left: IPSEITY's thirteen (the seal, the drainer, the piece, the
  renter, the walker, the Postage, the Timelock, the Steward, the Kiln, the
  Router), its pool reviews C1/C2/C5, its own B-list (the sealed DM to a
  departed holder, the renter's sync race, launch authority after a sale),
  INVARIANTS B1–B4, and ANIMA's EmptyBatch, handle, revenue-revival,
  self-hire and derivatives-calldata classes.

  Every block performs the ATTACK — the drain, the re-entry, the stranger's
  call — and asserts the refusal: the custom error by selector, the balance
  that did not move, the session that is dead. Two verdicts:

    refuted on HEAD      the attack fails against the compiled contracts,
                         deployed the way every verifier deploys them
                         (tools/site.mjs, the ship build behind the real
                         ERC-6551 registry runtime);
    reproduced           the same attack SUCCEEDS against a variant: a
                         COPY of the source with the one guard removed,
                         compiled separately, deployed beside the real
                         contract. A reproduction that does not reproduce
                         is a failure of this file, never a pass.

  Where a donor's claim has no counterpart in INTACT the block says so in
  an `n/a` line and asserts nothing, rather than inventing one. Nothing
  here is faked: a variant is the real source with one line changed, and
  the change is printed.

    node tools/verify-findings.mjs            every finding, then `N passed, M failed`
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { compile, artifact, ROOT } from "./compile.mjs";
import { Chain, enc, sel, encodeParams, decUint, decAddr, decBool, warp, roll, BLOCK } from "./evm.mjs";
import { deploySite, mint, ZERO, predictCreate } from "./site.mjs";

const require = createRequire(import.meta.url);
const solc = require("solc");

/*──────────────── the verdicts ────────────────*/
let pass = 0, fail = 0, na = 0;
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const note = (s) => console.log(`      \x1b[2m${s}\x1b[0m`);
function verdict(kind, name, cond, detail) {
  cond ? pass++ : fail++;
  const word = kind === "refuted" ? "refuted on HEAD" : "reproduced on the variant";
  console.log(`  ${cond ? "\x1b[32m✓" : "\x1b[31m✗"}\x1b[0m ${cond ? word : (kind === "refuted" ? "NOT refuted" : "did NOT reproduce")} · ${name}`);
  if (!cond && detail !== undefined) console.log(`      \x1b[31m${String(detail).slice(0, 400)}\x1b[0m`);
}
const refuted = (name, cond, detail) => verdict("refuted", name, cond, detail);
const reproduced = (name, cond, detail) => verdict("reproduced", name, cond, detail);
const notApplicable = (name, why) => { na++; console.log(`  \x1b[2m— n/a · ${name}: ${why}\x1b[0m`); };

/*──────────────── helpers ────────────────*/
const W = 10n ** 18n;
const hex = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
const kec = (b) => "0x" + Buffer.from(keccak256(b)).toString("hex");
const topic = (sig) => kec(Buffer.from(sig, "utf8"));
const w = (n) => BigInt(n).toString(16).padStart(64, "0");
const now = () => BLOCK.header.timestamp;
const low = (a) => String(a).toLowerCase();
const same = (a, b) => low(a) === low(b);

/// Run a call that is expected to revert; report the selector it reverted with.
async function attempt(fn) {
  try { const r = await fn(); return { ok: true, ret: r }; }
  catch (e) {
    const m = String(e.message).match(/data=(0x[0-9a-f]*)/i);
    const data = m ? m[1] : "0x";
    return { ok: false, data, sel: data.slice(0, 10), msg: String(e.message) };
  }
}
const named = (r, sig) => !r.ok && r.sel === sel(sig);
const why = (r, sig) => r.ok ? "it went through" : `reverted ${r.sel} (${r.msg.slice(0, 120)}), wanted ${sel(sig)} ${sig}`;

/*──────────────── a variant: one guard removed, compiled on its own ────────────────*/

const findImport = (p) => {
  for (const base of ["", "src/", "src/lib/", "src/interfaces/"]) {
    const full = path.join(ROOT, base, p);
    if (fs.existsSync(full)) return { contents: fs.readFileSync(full, "utf8") };
  }
  return { error: "not found: " + p };
};

/**
 * Compile `rel` (a file under src/) with `edits` applied — each [find, replace]
 * must match exactly once — as its own unit, so the real artifact is
 * untouched and the two can be deployed side by side.
 */
function variantOf(rel, contractName, edits) {
  let src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  for (const [find, replace] of edits) {
    const n = src.split(find).length - 1;
    if (n !== 1) throw new Error(`variant anchor occurs ${n} times in ${rel}: ${find}`);
    src = src.replace(find, replace);
  }
  const dir = path.posix.dirname(rel);
  src = src.replace(/from "\.\/([^"]+)"/g, (m, p) => `from "${path.posix.join(dir, p)}"`);
  const unit = `variant/${contractName}.sol`;
  const input = {
    language: "Solidity",
    sources: { [unit]: { content: src } },
    settings: {
      optimizer: { enabled: true, runs: 800 }, viaIR: true, evmVersion: "cancun",
      metadata: { bytecodeHash: "none" },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } }
    }
  };
  const key = createHash("sha256").update(solc.version()).update(JSON.stringify(input)).digest("hex");
  const cacheDir = path.join(ROOT, "out", "compile-cache");
  const cacheFile = path.join(cacheDir, "variant-" + key + ".json");
  let out = null;
  if (fs.existsSync(cacheFile)) { try { out = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch { out = null; } }
  const t0 = Date.now();
  if (!out) {
    out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
    const errors = (out.errors || []).filter((e) => e.severity === "error");
    if (errors.length) throw new Error("the variant does not compile: " + errors[0].formattedMessage);
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(out));
  }
  const c = out.contracts[unit][contractName];
  note(`variant of ${rel} (${edits.length} line${edits.length === 1 ? "" : "s"} changed) compiled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  for (const [find, replace] of edits) note(`  − ${find.trim().replace(/\s+/g, " ")}\n        + ${replace.trim().replace(/\s+/g, " ") || "(removed)"}`);
  return { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
}

/*──────────────── the world ────────────────*/
console.log("\n  \x1b[1mINTACT · verify-findings\x1b[0m");
head("the world: the ship build, deployed as every verifier deploys it");
const T0 = Date.now();
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const site = await deploySite(c, out);
const me = c.from.toString();
const bob = await c.as("0x" + "b0".repeat(32));
const carol = await c.as("0x" + "ca".repeat(32));
const stranger = await c.as("0x" + "57".repeat(32));
const agent = await c.as("0x" + "a6".repeat(32));
const { hub, pool, parley, postage, keys, kiln, launchpad, steward, timelock, reachImpl } = site;
const PRICE = site.price;
note(`hub ${hub} · pool ${pool} · parley ${parley} · ${Object.keys(site.gasLog).length} load steps · ${((Date.now() - T0) / 1000).toFixed(1)}s`);

const mintTo = async (who) => (await mint(c, site, who)).id;
const reachOf = async (id) => decAddr(await c.read(hub, "account(uint256)", [id]));
const gripOf = async (id) => decAddr(await c.read(hub, "grip(uint256)", [id]));
const erc20 = (name, sym, dec = 18) => c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode,
  encodeParams("string,string,uint8,uint256,bool", [name, sym, dec, 0, false]), name);
const balance = async (token, who) => decUint(await c.read(token, "balanceOf(address)", [who]));
const market = async (key) => {
  const r = await c.read(pool, "marketOf(uint256)", [key]);
  return { base: decAddr(r, 0), quote: decAddr(r, 1), rb: decUint(r, 2), rq: decUint(r, 3), open: decBool(r, 7), vb: decUint(r, 11), vq: decUint(r, 12) };
};
const EXEC = "execute(address,uint256,bytes,uint8)";
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";
const FOREVER = (1n << 64n) - 1n;
const MAX = (1n << 255n);   // "unlimited" as a page would never build it; a plain large number here

const GOLD = await erc20("Gold", "GOLD");
const SILVER = await erc20("Silver", "SLVR");
const USDC = await erc20("USD Coin", "USDC", 6);

/*═══════════════════ I · the Pool: C1, C2, C5 ═══════════════════*/

head("the Pool — C1: a close re-entered from inside a deposit's pull");
const mali = await c.deploy(A("test/mocks/PoolReenter.sol", "PoolReenter").bytecode, "", "PoolReenter");
const M = await mintTo(mali);
await c.exec(mali, "wire(address,uint256)", [pool, M]);
await c.exec(mali, "step1_open(address,address)", [mali, USDC]);
await c.exec(mali, "step2_depositAndClose(uint256)", [1000n * W]);
{
  const m = await market(M);
  const re = decBool(await c.read(mali, "reentrySucceeded()"));
  const reopen = await attempt(() => c.exec(mali, "step3_reopen(address,address)", [USDC, GOLD]));
  refuted("C1: closeMarket re-entered from inside deposit's pull is refused, the market stays open with its reserve, and it cannot be reopened over it",
    !re && m.open && m.rb === 1000n * W && named(reopen, "MarketAlreadyOpen()"),
    `reentry ${re} open ${m.open} rBase ${m.rb} reopen ${why(reopen, "MarketAlreadyOpen()")}`);
}

head("the Pool — C2: the curve moved from inside the pull, by the holder");
const SYNC = await c.deploy(A("test/mocks/SyncInsidePull.sol", "SyncInsidePull").bytecode, "", "SyncInsidePull");
const S = await mintTo(me);
await c.exec(SYNC, "mint(address,uint256)", [me, 10_000n * W]);
await c.exec(SYNC, "approve(address,uint256)", [pool, MAX]);
await c.exec(USDC, "mint(address,uint256)", [me, 10_000n * 10n ** 6n]);
await c.exec(USDC, "approve(address,uint256)", [pool, MAX]);
await c.exec(pool, "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", [S, SYNC, USDC, 30, 0, 0, 0]);
await c.exec(pool, "deposit(uint256,uint256,uint256)", [S, 1000n * W, 1000n * 10n ** 6n]);
// the hostile token becomes the HOLDER (a plain transferFrom needs no receiver hook), so its re-entrant
// sync is the one actor allowed to move the curve — refused by the lock, never by authority
await c.exec(hub, "transferFrom(address,address,uint256)", [me, SYNC, S]);
await c.exec(SYNC, "mint(address,uint256)", [bob.from.toString(), 100n * W]);
await bob.exec(SYNC, "approve(address,uint256)", [pool, MAX]);
await c.exec(SYNC, "arm(address,uint256,uint24)", [pool, S, 0]);
{
  const before = await market(S);
  await bob.exec(pool, SWAP_IN, [S, true, W, 0, bob.from.toString(), FOREVER]);
  const synced = decBool(await c.read(SYNC, "syncSucceeded()"));
  const lr = (await c.read(SYNC, "lastRevert()")).slice(2);
  const errSel = "0x" + lr.substr(128, 8);
  const after = await market(S);
  refuted("C2: a syncCurve from inside the pull, by the token that holds the market, is refused by the lock (Reentrancy) and the anchors are untouched",
    !synced && errSel === sel("Reentrancy()") && after.vb === before.vb && after.vq === before.vq,
    `synced ${synced} error ${errSel} anchors ${before.vb}/${before.vq} → ${after.vb}/${after.vq}`);
}

head("the Pool — C5: two markets on one rebasing token");
const RBS = await c.deploy(A("test/mocks/RebasingToken.sol", "RebasingToken").bytecode, "", "RebasingToken");
const TA = await mintTo(me);
const TB = await mintTo(bob.from.toString());
for (const who of [c, bob]) {
  await c.exec(RBS, "mint(address,uint256)", [who.from.toString(), 1000n * W]);
  await who.exec(RBS, "approve(address,uint256)", [pool, MAX]);
  await c.exec(USDC, "mint(address,uint256)", [who.from.toString(), 1000n * 10n ** 6n]);
  await who.exec(USDC, "approve(address,uint256)", [pool, MAX]);
}
const OPEN = "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)";
const DEPOSIT = "deposit(uint256,uint256,uint256)";
const WITHDRAW = "withdraw(uint256,uint256,uint256,address)";
await c.exec(pool, OPEN, [TA, RBS, USDC, 30, 0, 0, 0]);
await c.exec(pool, DEPOSIT, [TA, 100n * W, 100n * 10n ** 6n]);
await bob.exec(pool, OPEN, [TB, RBS, USDC, 30, 0, 0, 0]);
await bob.exec(pool, DEPOSIT, [TB, 100n * W, 100n * 10n ** 6n]);
await c.exec(RBS, "rebase(uint256)", [5n * 10n ** 17n]);     // every balance halves out of band
{
  const reserved = decUint(await c.read(pool, "totalReserved(address)", [RBS]));
  const held = await balance(RBS, pool);
  const a = await attempt(() => c.exec(pool, WITHDRAW, [TA, 1n, 0n, me]));
  const trade = await attempt(() => bob.exec(pool, SWAP_IN, [TA, false, 10n ** 6n, 0, bob.from.toString(), FOREVER]));
  await c.exec(pool, "writeDown(uint256)", [TA]);
  const mA = await market(TA);
  const bobBefore = await balance(RBS, bob.from.toString());
  const b = await attempt(() => bob.exec(pool, WITHDRAW, [TB, 100n * W, 0n, bob.from.toString()]));
  const bobAfter = await balance(RBS, bob.from.toString());
  refuted("C5: after a downward rebase the pool fails CLOSED — A cannot withdraw one wei or be traded out of, A writes itself down to nothing, and B is still paid every wei of its claim",
    reserved === 200n * W && held < reserved && named(a, "Insolvent()") && named(trade, "Insolvent()") && mA.rb === 0n && b.ok && bobAfter - bobBefore >= 100n * W,
    `reserved ${reserved} held ${held} A ${why(a, "Insolvent()")} trade ${why(trade, "Insolvent()")} A.rBase ${mA.rb} B ${b.ok ? "paid " + (bobAfter - bobBefore) : b.msg}`);
}

head("the Pool — the same three attacks against a variant with the three guards removed");
const poolVariant = variantOf("src/Pool.sol", "Pool", [
  ["function closeMarket(uint256 id) external locked {", "function closeMarket(uint256 id) external {"],
  ["function syncCurve(uint256 id, uint24 curveBps, uint24 expected) external locked {", "function syncCurve(uint256 id, uint24 curveBps, uint24 expected) external {"],
  ["if (bal < others || amount > bal - others) revert Insolvent();", "/* the variant pays whatever is asked */"]
]);
const vpool = await c.deploy(poolVariant.bytecode, encodeParams("address,address", [hub, launchpad]), "PoolVariant");
{
  // C1 on the variant
  const mali2 = await c.deploy(A("test/mocks/PoolReenter.sol", "PoolReenter").bytecode, "", "PoolReenter2");
  const M2 = await mintTo(mali2);
  await c.exec(mali2, "wire(address,uint256)", [vpool, M2]);
  await c.exec(mali2, "step1_open(address,address)", [mali2, USDC]);
  await c.exec(mali2, "step2_depositAndClose(uint256)", [1000n * W]);
  const r = await c.read(vpool, "marketOf(uint256)", [M2]);
  const re = decBool(await c.read(mali2, "reentrySucceeded()"));
  const open = decBool(r, 7), rb = decUint(r, 2);
  const reopen = await attempt(() => c.exec(mali2, "step3_reopen(address,address)", [USDC, GOLD]));
  reproduced("C1 without the lock on closeMarket: the re-entered close succeeds and the deposit writes a 1000-token reserve into a CLOSED struct — the phantom reserve",
    re && !open && rb === 1000n * W, `reentry ${re} open ${open} rBase ${rb}`);
  refuted("and HEAD's second defence still holds on the variant: a struct with a reserve in it cannot be reopened (MarketNotEmpty)",
    named(reopen, "MarketNotEmpty()"), why(reopen, "MarketNotEmpty()"));
}
{
  // C2 on the variant
  const SYNC2 = await c.deploy(A("test/mocks/SyncInsidePull.sol", "SyncInsidePull").bytecode, "", "SyncInsidePull2");
  const S2 = await mintTo(me);
  await c.exec(SYNC2, "mint(address,uint256)", [me, 10_000n * W]);
  await c.exec(SYNC2, "approve(address,uint256)", [vpool, MAX]);
  await c.exec(USDC, "mint(address,uint256)", [me, 10_000n * 10n ** 6n]);
  await c.exec(USDC, "approve(address,uint256)", [vpool, MAX]);
  await c.exec(vpool, OPEN, [S2, SYNC2, USDC, 30, 40_000, 0, 0]);
  await c.exec(vpool, DEPOSIT, [S2, 1000n * W, 1000n * 10n ** 6n]);
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, SYNC2, S2]);
  await c.exec(SYNC2, "mint(address,uint256)", [bob.from.toString(), 100n * W]);
  await bob.exec(SYNC2, "approve(address,uint256)", [vpool, MAX]);
  await c.exec(SYNC2, "arm(address,uint256,uint24)", [vpool, S2, 40_000]);
  const before = await c.read(vpool, "marketOf(uint256)", [S2]);
  await bob.exec(vpool, SWAP_IN, [S2, true, W, 0, bob.from.toString(), FOREVER]);
  const synced = decBool(await c.read(SYNC2, "syncSucceeded()"));
  const after = await c.read(vpool, "marketOf(uint256)", [S2]);
  reproduced("C2 without the lock on syncCurve: the holder's token re-anchors the curve from inside the trade's own pull (the anchors moved under a live swap)",
    synced && (decUint(after, 11) !== decUint(before, 11) || decUint(after, 12) !== decUint(before, 12)),
    `synced ${synced} anchors ${decUint(before, 11)}/${decUint(before, 12)} → ${decUint(after, 11)}/${decUint(after, 12)}`);
}
{
  // C5 on the variant
  const RBS2 = await c.deploy(A("test/mocks/RebasingToken.sol", "RebasingToken").bytecode, "", "RebasingToken2");
  const VA = await mintTo(me), VB = await mintTo(bob.from.toString());
  for (const who of [c, bob]) {
    await c.exec(RBS2, "mint(address,uint256)", [who.from.toString(), 1000n * W]);
    await who.exec(RBS2, "approve(address,uint256)", [vpool, MAX]);
    await c.exec(USDC, "mint(address,uint256)", [who.from.toString(), 1000n * 10n ** 6n]);
    await who.exec(USDC, "approve(address,uint256)", [vpool, MAX]);
  }
  await c.exec(vpool, OPEN, [VA, RBS2, USDC, 30, 0, 0, 0]);
  await c.exec(vpool, DEPOSIT, [VA, 100n * W, 100n * 10n ** 6n]);
  await bob.exec(vpool, OPEN, [VB, RBS2, USDC, 30, 0, 0, 0]);
  await bob.exec(vpool, DEPOSIT, [VB, 100n * W, 100n * 10n ** 6n]);
  await c.exec(RBS2, "rebase(uint256)", [5n * 10n ** 17n]);
  const a = await attempt(() => c.exec(vpool, WITHDRAW, [VA, 100n * W, 0n, me]));
  const b = await attempt(() => bob.exec(vpool, WITHDRAW, [VB, 100n * W, 0n, bob.from.toString()]));
  reproduced("C5 without the solvency cap: A withdraws its whole claim out of a pool that holds only half, and B, whose claim is as good, is left with a transfer that fails",
    a.ok && !b.ok, `A ${a.ok ? "paid" : a.msg.slice(0, 80)} B ${b.ok ? "paid" : b.sel}`);
}

/*═══════════════════ II · the accounts ═══════════════════*/

head("the accounts — B1: the Grip's ABI has no selector that moves an asset");
{
  const gripAbi = A("src/Grip.sol", "Grip").abi;
  const mover = /withdraw|sweep|rescue|transfer|send|drain|claim|execute|call|approve/i;
  const override = /setOwner|admin|upgrade|initialize|delegate/i;
  const fns = gripAbi.filter((f) => f.type === "function");
  const moves = fns.filter((f) => mover.test(f.name || "") || override.test(f.name || ""));
  const writes = fns.filter((f) => f.stateMutability !== "view" && f.stateMutability !== "pure" && !/^onERC(721|1155)/.test(f.name));
  const g1 = await gripOf(1n);
  const probe = await attempt(() => c.exec(g1, EXEC, [me, 1n, "0x", 0]));
  const claims = decBool(await c.read(g1, "supportsInterface(bytes4)", ["0x51945447"]));
  refuted("B1: the Grip's ABI has no selector that moves an asset and no owner override, no state-changing function but the receivers, execute() on it reverts, and it does not advertise 0x51945447",
    moves.length === 0 && writes.length === 0 && !probe.ok && !claims,
    `movers ${moves.map((f) => f.name)} writes ${writes.map((f) => f.name)} execute ${probe.ok} claims6551Executable ${claims}`);
  note(`${fns.length} functions: ${fns.map((f) => f.name).join(", ")}`);
}

head("the accounts — B2: Reach.execute with operation 1 (delegatecall) is refused");
const R1 = await mintTo(me);
const reach1 = await reachOf(R1);
{
  const r = await attempt(() => c.exec(reach1, EXEC, [GOLD, 0, enc("balanceOf(address)", [reach1]), 1]));
  const ok0 = await attempt(() => c.exec(reach1, EXEC, [GOLD, 0, enc("balanceOf(address)", [reach1]), 0]));
  refuted("B2: operation 1 reverts OnlyCall; the same call as operation 0 goes through", named(r, "OnlyCall()") && ok0.ok, why(r, "OnlyCall()"));
}

head("the accounts — B3: ERC-7739 — the probe answers, a session key's signature never does");
{
  const PROBE = "0x7739773977397739773977397739773977397739773977397739773977397739";
  const probe = (await c.read(reach1, "isValidSignature(bytes32,bytes)", [PROBE, "0x"])).slice(0, 10);
  const forged = (await c.read(reach1, "isValidSignature(bytes32,bytes)", [kec(Buffer.from("an order hash")), "0x" + "11".repeat(65)])).slice(0, 10);
  const sessionSig = (await c.read(reach1, "isValidSignature(bytes32,bytes)", [kec(Buffer.from("signed by a session key")), "0x" + "22".repeat(64) + "1b"])).slice(0, 10);
  refuted("B3: 0x7739… with an empty signature answers 0x77390001; a signature that is not the holder's attestation — a venue's order, a session key's word — answers 0xffffffff",
    probe === "0x77390001" && forged === "0xffffffff" && sessionSig === "0xffffffff", `probe ${probe} forged ${forged} session ${sessionSig}`);
}

head("the accounts — B4: the seal ratchets up only, ≤ 365 days, and survives the sale");
{
  const t = now();
  await c.exec(reach1, "seal(uint64)", [t + 10n * 86400n]);
  const shorter = await attempt(() => c.exec(reach1, "seal(uint64)", [t + 5n * 86400n]));
  const tooLong = await attempt(() => c.exec(reach1, "seal(uint64)", [t + 400n * 86400n]));
  const until = decUint(await c.read(reach1, "sealedUntil()"));
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, bob.from.toString(), R1]);
  const afterSale = decUint(await c.read(reach1, "sealedUntil()"));
  const buyerShortens = await attempt(() => bob.exec(reach1, "seal(uint64)", [t + 6n * 86400n]));
  refuted("B4: a shorter seal is RatchetOnly, one past 365 days is TooLong, the sale leaves sealedUntil where it was, and the buyer cannot shorten it either",
    named(shorter, "RatchetOnly()") && named(tooLong, "TooLong()") && until === t + 10n * 86400n && afterSale === until && named(buyerShortens, "RatchetOnly()"),
    `shorter ${why(shorter, "RatchetOnly()")} long ${why(tooLong, "TooLong()")} until ${until} afterSale ${afterSale}`);
}

head("the accounts — the drainer with a function name no list has, and Permit2's word");
const drainer = await c.deploy(A("test/mocks/Drainer.sol", "Drainer").bytecode, "", "Drainer");
const R2 = await mintTo(me);
const reach2 = await reachOf(R2);
await c.exec(GOLD, "mint(address,uint256)", [reach2, 10n * W]);
await c.exec(reach2, "guard(address)", [GOLD]);
await c.exec(reach2, EXEC, [GOLD, 0, enc("approve(address,uint256)", [drainer, MAX]), 0]);   // unsealed: recorded, allowed
{
  const ledger = await c.read(reach2, "openApprovals()");
  const n = decUint(ledger, 1);
  await c.exec(reach2, "seal(uint64)", [now() + 30n * 86400n]);
  const before = await balance(GOLD, reach2);
  const take = await attempt(() => c.exec(reach2, EXEC, [drainer, 0, enc("take(address,uint256)", [GOLD, W]), 0]));
  const after = await balance(GOLD, reach2);
  refuted("a drainer with a function name no list has still Shrank: the sealed Reach measured its manifest and refused; the balance did not move; the standing approval it gave while unsealed is on the ledger",
    named(take, "Shrank(address,uint256,uint256)") && after === before && n === 1n,
    `take ${why(take, "Shrank(address,uint256,uint256)")} balance ${before} → ${after} ledger ${n}`);
  const p2 = await attempt(() => c.exec(reach2, EXEC, [GOLD, 0, enc("approve(address,address,uint160,uint48)", [GOLD, drainer, 1n, 0]), 0]));
  const plain = await attempt(() => c.exec(reach2, EXEC, [GOLD, 0, enc("approve(address,uint256)", [drainer, 1n]), 0]));
  refuted("Permit2's approve(address,address,uint160,uint48) — same custody, a word no six-selector list had — is refused on a promised asset while sealed, by the same rule as a plain approve (NotSafeWhileSealed)",
    named(p2, "NotSafeWhileSealed(bytes4)") && named(plain, "NotSafeWhileSealed(bytes4)"), `${why(p2, "NotSafeWhileSealed(bytes4)")} / ${why(plain, "NotSafeWhileSealed(bytes4)")}`);
}

head("the accounts — SealBreaker: the manifest moved out from under the measurement");
{
  const brk = await c.deploy(A("test/mocks/Breakable.sol", "Breakable").bytecode, "", "Breakable");
  const breaker = await c.deploy(A("test/mocks/SealBreaker.sol", "SealBreaker").bytecode, "", "SealBreaker");
  await c.exec(breaker, "setup(address,address,address)", [hub, brk, GOLD], { value: PRICE });
  const acct = decAddr(await c.read(breaker, "acct()"));
  await c.exec(GOLD, "mint(address,uint256)", [acct, 10n * W]);
  await c.exec(breaker, "sealIt(uint64)", [now() + 30n * 86400n]);
  const before = await balance(GOLD, acct);
  const r = await attempt(() => c.exec(breaker, "drain(address,uint256,address)", [GOLD, W, me]));
  refuted("a batch that re-enters unguard to renumber the manifest under the snapshot is refused (ManifestBusy) and the sealed asset stays",
    named(r, "ManifestBusy()") && (await balance(GOLD, acct)) === before, why(r, "ManifestBusy()"));
}

head("the accounts — the guarded piece moved");
{
  const nft = await c.deploy(A("test/mocks/MockERC721.sol", "MockERC721").bytecode, "", "MockERC721");
  const R3 = await mintTo(me);
  const reach3 = await reachOf(R3);
  await c.exec(nft, "mint(address,uint256)", [reach3, 7n]);
  await c.exec(reach3, "guardNFT(address,uint256)", [nft, 7n]);
  await c.exec(reach3, "seal(uint64)", [now() + 30n * 86400n]);
  const r = await attempt(() => c.exec(reach3, EXEC, [nft, 0, enc("transferFrom(address,address,uint256)", [reach3, me, 7n]), 0]));
  const owner = decAddr(await c.read(nft, "ownerOf(uint256)", [7n]));
  refuted("a guarded piece sent away from a sealed Reach is caught by identity (PieceLeft), not by count, and is still held", named(r, "PieceLeft(address,uint256)") && same(owner, reach3), why(r, "PieceLeft(address,uint256)"));
}

head("the accounts — ANIMA EmptyBatch: executeBatch([]) must not bump the state");
{
  const s0 = decUint(await c.read(reach2, "state()"));
  const r = await attempt(() => c.exec(reach2, "executeBatch((address,uint256,bytes)[])", [[]]));
  const s1 = decUint(await c.read(reach2, "state()"));
  refuted("executeBatch([]) reverts EmptyBatch and state() is unchanged (ANIMA main advanced the counter with no authorisation at all)", named(r, "EmptyBatch()") && s0 === s1, `${why(r, "EmptyBatch()")} state ${s0} → ${s1}`);
}

head("the accounts — ANIMA derivatives-calldata: an approval a session key did not have the right to name");
const R4 = await mintTo(me);
const reach4 = await reachOf(R4);
await c.exec(GOLD, "mint(address,uint256)", [reach4, 10n * W]);
const GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";
await c.exec(reach4, GRANT, [agent.from.toString(), now() + 86400n, 0, [], [GOLD], [sel("approve(address,uint256)")], 0, 0]);
{
  const r = await attempt(() => agent.exec(reach4, "executeAsSession(address,uint256,bytes)", [GOLD, 0, enc("approve(address,uint256)", [stranger.from.toString(), MAX])]));
  const allowance = decUint(await c.read(GOLD, "allowance(address,address)", [reach4, stranger.from.toString()]));
  const toTarget = await attempt(() => agent.exec(reach4, "executeAsSession(address,uint256,bytes)", [GOLD, 0, enc("approve(address,uint256)", [GOLD, W])]));
  const ledger = decUint(await c.read(reach4, "openApprovals()"), 1);
  await c.exec(reach4, "revokeOpenApprovals()", []);
  const zeroed = decUint(await c.read(GOLD, "allowance(address,address)", [reach4, GOLD]));
  refuted("a session key's approve to a spender the holder never named is SpenderNotAllowed and leaves no allowance; one to a named target is allowed, recorded on the ledger, and the holder zeroes it in one call",
    named(r, "SpenderNotAllowed(address)") && allowance === 0n && toTarget.ok && ledger === 1n && zeroed === 0n,
    `${why(r, "SpenderNotAllowed(address)")} allowance ${allowance} toTarget ${toTarget.ok} ledger ${ledger} zeroed ${zeroed}`);
}

head("the accounts — IPSEITY claim 7: a revoke that leaves the allowlists standing");
{
  const XFER = sel("transfer(address,uint256)");
  await c.exec(reach4, GRANT, [agent.from.toString(), now() + 86400n, 0, [], [GOLD], [XFER], 0, 0]);
  await c.exec(reach4, "revokeSession(address)", [agent.from.toString()]);
  await c.exec(reach4, GRANT, [agent.from.toString(), now() + 86400n, 0, [], [SILVER], [XFER], 0, 0]);
  const r = await attempt(() => agent.exec(reach4, "executeAsSession(address,uint256,bytes)", [GOLD, 0, enc("transfer(address,uint256)", [agent.from.toString(), W])]));
  refuted("grant [GOLD], revoke, re-grant [SILVER]: the key cannot reach GOLD (TargetNotAllowed) — the list epoch retired the old entries a delete could not", named(r, "TargetNotAllowed(address)"), why(r, "TargetNotAllowed(address)"));
}

head("the accounts — a session dies on sale and does not revive on buy-back; the seller's rights are nothing");
{
  const XFER = sel("transfer(address,uint256)");
  await c.exec(reach4, GRANT, [agent.from.toString(), now() + 86400n, 0, [], [GOLD], [XFER], 0, 0]);
  await c.exec(hub, "setStatus(uint256,uint8)", [R4, 0]);
  const live = await attempt(() => agent.exec(reach4, "executeAsSession(address,uint256,bytes)", [GOLD, 0, enc("transfer(address,uint256)", [agent.from.toString(), W])]));
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, bob.from.toString(), R4]);
  const sold = await attempt(() => agent.exec(reach4, "executeAsSession(address,uint256,bytes)", [GOLD, 0, enc("transfer(address,uint256)", [agent.from.toString(), W])]));
  const sellerBits = decUint(await c.read(hub, "rightsOf(uint256,address)", [R4, me]), 0);
  await bob.exec(hub, "transferFrom(address,address,uint256)", [bob.from.toString(), me, R4]);
  await c.exec(hub, "setStatus(uint256,uint8)", [R4, 0]);
  const back = await attempt(() => agent.exec(reach4, "executeAsSession(address,uint256,bytes)", [GOLD, 0, enc("transfer(address,uint256)", [agent.from.toString(), W])]));
  const current = decBool(await c.read(reach4, "sessionCurrent(address)", [agent.from.toString()]));
  refuted("the key works before the sale, is SoldOn after it, the seller's rightsOf is 0, and a buy-back by the same holder revives nothing (still SoldOn, sessionCurrent false)",
    live.ok && named(sold, "SoldOn(uint64,uint64)") && sellerBits === 0n && named(back, "SoldOn(uint64,uint64)") && !current,
    `live ${live.ok} sold ${why(sold, "SoldOn(uint64,uint64)")} sellerBits ${sellerBits} back ${why(back, "SoldOn(uint64,uint64)")} current ${current}`);
}

head("agents — the Bankrbot class: receiving a token grants nothing");
{
  const nft = await c.deploy(A("test/mocks/MockERC721.sol", "MockERC721").bytecode, "", "MockERC721b");
  const g = await gripOf(R2);
  const bitsBefore = decUint(await c.read(hub, "rightsOf(uint256,address)", [R2, stranger.from.toString()]), 0);
  await stranger.exec(nft, "mint(address,uint256)", [stranger.from.toString(), 1n]);
  await stranger.exec(nft, "transferFrom(address,address,uint256)", [stranger.from.toString(), reach2, 1n]);
  await stranger.send({ to: g, value: W });
  const bitsAfter = decUint(await c.read(hub, "rightsOf(uint256,address)", [R2, stranger.from.toString()]), 0);
  const session = decBool(await c.read(reach2, "sessionCurrent(address)", [stranger.from.toString()]));
  refuted("a stranger who sends an NFT to the Reach and ether to the Grip holds no bit of rightsOf and no session afterwards", bitsBefore === 0n && bitsAfter === 0n && !session, `bits ${bitsBefore} → ${bitsAfter} session ${session}`);
}

/*═══════════════════ III · speech and postage ═══════════════════*/

head("speech — the renter speaking");
const P1 = await mintTo(me);
const P2 = await mintTo(bob.from.toString());
const renter = carol;
await c.exec(hub, "setUser(uint256,address,uint64)", [P1, renter.from.toString(), now() + 86400n]);
{
  const user = decAddr(await c.read(hub, "userOf(uint256)", [P1]));
  const SPEAK = "speak(uint256,uint256,uint8,uint64,uint64,bytes)";
  const a = await attempt(() => renter.exec(parley, SPEAK, [0, P1, 0, 0, 0, hex("I am renting this voice")]));
  const b = await attempt(() => renter.exec(parley, "whisper(uint256,uint256,uint8,bytes32,bytes)", [P1, P2, 0, "0x" + "00".repeat(32), hex("and this one")]));
  const d = await attempt(() => renter.exec(parley, "found(uint256,string,bool)", [P1, "renters club", true]));
  const holder = await attempt(() => c.exec(parley, SPEAK, [0, P1, 0, 0, 0, hex("the holder, speaking")]));
  refuted("the ERC-4907 user of a token cannot speak, whisper or found as it (NotYours ×3); the holder can", same(user, renter.from.toString()) && named(a, "NotYours()") && named(b, "NotYours()") && named(d, "NotYours()") && holder.ok,
    `user ${user} speak ${why(a, "NotYours()")} whisper ${why(b, "NotYours()")} found ${why(d, "NotYours()")} holder ${holder.ok}`);
}

head("speech — the naive log walker");
{
  const SAID = topic("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)");
  const SPEAK = "speak(uint256,uint256,uint8,uint64,uint64,bytes)";
  roll(BLOCK.header.number + 5n);
  // two tokens, one block: the second message's `prev` is its own block
  await c.exec(parley, SPEAK, [0, P1, 0, 0, 0, hex("first in this block")]);
  await bob.exec(parley, SPEAK, [0, P2, 0, 0, 0, hex("second in this block")]);
  const st = await c.read(parley, "stateOf(uint256)", [0]);
  const last = decUint(st, 0);
  const at = (block) => c.getLogs({ address: parley, fromBlock: "0x" + block.toString(16), toBlock: "0x" + block.toString(16), topics: [SAID, "0x" + w(0)] })
    .map((l) => ({ prev: BigInt("0x" + l.data.slice(2, 66)), seq: BigInt("0x" + l.data.slice(130, 194)) }));
  // the naive reader: follow the NEWEST message's pointer
  let naive = last, asked = 0, repeated = false;
  for (let i = 0; i < 4 && naive > 0n; i++) {
    const logs = at(naive); asked++;
    const newest = logs.reduce((a, b) => (b.seq > a.seq ? b : a));
    if (newest.prev === naive) { repeated = true; break; }
    naive = newest.prev;
  }
  reproduced("a reader that follows the newest message's pointer asks for the same block again: two messages in one block point the second at its own block, and the walk never ends",
    repeated, `asked ${asked} repeated ${repeated}`);
  // the rule: follow the OLDEST message's pointer in each block
  let cur = last, found = 0, queries = 0, guard = 0;
  while (cur > 0n && guard++ < 50) {
    const logs = at(cur); queries++;
    found += logs.length;
    cur = logs.reduce((a, b) => (b.seq < a.seq ? b : a)).prev;
  }
  refuted("the walk rule — follow the oldest pointer in each block — reads both messages and terminates in single-block queries", found >= 2 && cur === 0n && guard < 50, `found ${found} queries ${queries} ended at ${cur}`);
}

head("postage — the double-settle");
const WHISPER_STAMPED = "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)";
const WHISPER = "whisper(uint256,uint256,uint8,bytes32,bytes)";
const POST = 5_000_000n;
const reachP2 = await reachOf(P2);
await c.exec(USDC, "mint(address,uint256)", [reachP2, 100n * 10n ** 6n]);
await bob.exec(reachP2, EXEC, [USDC, 0, enc("approve(address,uint256)", [postage, 100n * 10n ** 6n]), 0]);
{
  await c.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)", [P1, USDC, POST, 3600n, true]);
  await bob.exec(parley, WHISPER_STAMPED, [P2, P1, 0, "0x" + "00".repeat(32), hex("may I have a moment"), USDC, POST]);
  const room = decUint(await c.read(parley, "pairKey(uint256,uint256)", [P1, P2]));
  const stampId = decUint(await c.read(postage, "pendingOf(uint256)", [room]));
  await c.exec(parley, WHISPER, [P1, P2, 0, "0x" + "00".repeat(32), hex("you may")]);   // the reply settles
  const sink = decAddr(await c.read(hub, "feeSink(uint256)", [P1]));
  const owed = decUint(await c.read(postage, "owed(address,address)", [sink, USDC]));
  warp(now() + 7200n);
  const expire = await attempt(() => stranger.exec(postage, "expire(uint256)", [stampId]));
  const refund = await attempt(() => stranger.exec(postage, "claimRefund(uint256)", [stampId]));
  await stranger.exec(postage, "claimSettled(uint256,address)", [P1, USDC]);
  const left = await balance(USDC, postage);
  refuted("a settled stamp cannot be expired or refunded (AlreadySettled ×2); the sink is paid once and the contract holds nothing after",
    stampId !== 0n && owed === POST && named(expire, "AlreadySettled(uint256)") && named(refund, "AlreadySettled(uint256)") && left === 0n,
    `stamp ${stampId} owed ${owed} expire ${why(expire, "AlreadySettled(uint256)")} refund ${why(refund, "AlreadySettled(uint256)")} left ${left}`);
}

head("postage — the double-settle on a variant whose expire forgot the settled flag");
{
  const postageVariant = variantOf("src/Postage.sol", "Postage", [
    ["        if (s.settled) revert AlreadySettled(stampId);\n        if (s.refunded) revert AlreadyRefunded(stampId);\n        if (block.timestamp <= s.replyBy)",
     "        if (s.refunded) revert AlreadyRefunded(stampId);\n        if (block.timestamp <= s.replyBy)"]
  ]);
  // Parley ↔ Postage are mutual immutables: the variant Postage is built against the address the
  // next Parley will land at, exactly as the deploy script predicts them
  const nonce = await c.nonceNow();
  const parleyAt = predictCreate(me, nonce + 1n);
  const vpostage = await c.deploy(postageVariant.bytecode, encodeParams("address,address", [hub, parleyAt]), "PostageVariant");
  const vparley = await c.deploy(A("src/Parley.sol", "Parley").bytecode, encodeParams("address,address,address", [hub, keys, vpostage]), "ParleyForVariant");
  if (!same(vparley, parleyAt)) throw new Error("the variant Parley did not land where predicted");
  await bob.exec(reachP2, EXEC, [USDC, 0, enc("approve(address,uint256)", [vpostage, 100n * 10n ** 6n]), 0]);
  await c.exec(vpostage, "configureInbox(uint256,address,uint128,uint64,bool)", [P1, USDC, POST, 3600n, true]);
  await bob.exec(vparley, WHISPER_STAMPED, [P2, P1, 0, "0x" + "00".repeat(32), hex("may I have a moment"), USDC, POST]);
  const room = decUint(await c.read(vparley, "pairKey(uint256,uint256)", [P1, P2]));
  const stampId = decUint(await c.read(vpostage, "pendingOf(uint256)", [room]));
  await c.exec(vparley, WHISPER, [P1, P2, 0, "0x" + "00".repeat(32), hex("you may")]);
  warp(now() + 7200n);
  const expire = await attempt(() => stranger.exec(vpostage, "expire(uint256)", [stampId]));
  const st = await c.read(vpostage, "stampOf(uint256)", [stampId]);
  const settled = decBool(st, 8), refunded = decBool(st, 9);
  const sink = decAddr(await c.read(hub, "feeSink(uint256)", [P1]));
  const owedSink = decUint(await c.read(vpostage, "owed(address,address)", [sink, USDC]));
  const owedSender = decUint(await c.read(vpostage, "owed(address,address)", [reachP2, USDC]));
  const held = await balance(USDC, vpostage);
  await stranger.exec(vpostage, "claimSettled(uint256,address)", [P1, USDC]);
  const refund = await attempt(() => stranger.exec(vpostage, "claimRefund(uint256)", [stampId]));
  reproduced("without the settled check in expire, one stamp is both settled and refunded: the ledger owes twice what the contract holds, and the second claimant's pull fails",
    expire.ok && settled && refunded && owedSink + owedSender === 2n * POST && held === POST && !refund.ok,
    `expire ${expire.ok} settled ${settled} refunded ${refunded} owed ${owedSink}+${owedSender} held ${held} refund ${refund.ok ? "PAID" : refund.sel}`);
}

head("speech — IPSEITY B1: the sealed DM to a departed holder");
{
  const P3 = await mintTo(me);
  await c.exec(keys, "setEncryptionKey(uint16,bytes)", [3, "0x04aa"]);
  await c.exec(parley, "bindKey(uint256)", [P3]);
  const k = await c.read(parley, "keyOf(uint256)", [P3]);
  const keyId = "0x" + k.slice(66, 130);
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, carol.from.toString(), P3]);
  const after = await c.read(parley, "keyOf(uint256)", [P3]);
  const r = await attempt(() => bob.exec(parley, WHISPER, [P2, P3, 1, keyId, hex("sealed to a ghost")]));
  refuted("after the sale keyOf answers zero and a whisper sealed to the seller's key is refused (NoKey): no page can encrypt to a departed holder",
    keyId !== "0x" + "00".repeat(32) && decUint(after, 1) === 0n && named(r, "NoKey()"), `keyId ${keyId} after ${decUint(after, 1)} ${why(r, "NoKey()")}`);
}

head("the market — IPSEITY B2: the renter's sync race");
{
  const P4 = await mintTo(me);
  await c.exec(GOLD, "mint(address,uint256)", [me, 1000n * W]);
  await c.exec(GOLD, "approve(address,uint256)", [pool, MAX]);
  await c.exec(pool, OPEN, [P4, GOLD, ZERO, 30, 0, 0, 0]);
  await c.exec(pool, DEPOSIT, [P4, 100n * W, 10n * W], { value: 10n * W });
  await c.exec(hub, "setUser(uint256,address,uint64)", [P4, renter.from.toString(), now() + 86400n]);
  const byRenter = await attempt(() => renter.exec(pool, "syncCurve(uint256,uint24,uint24)", [P4, 40_000, 0]));
  const stale = await attempt(() => c.exec(pool, "syncCurve(uint256,uint24,uint24)", [P4, 40_000, 1]));
  const fresh = await attempt(() => c.exec(pool, "syncCurve(uint256,uint24,uint24)", [P4, 40_000, 0]));
  refuted("a renter cannot sync the curve (NotActor); the holder's sync against a moved `expected` is CurveMoved; the sync against what was seen goes through",
    named(byRenter, "NotActor()") && named(stale, "CurveMoved()") && fresh.ok, `renter ${why(byRenter, "NotActor()")} stale ${why(stale, "CurveMoved()")} fresh ${fresh.ok}`);
}

head("the launch — IPSEITY B4: launch authority follows the token");
{
  const P5 = await mintTo(me);
  const LAUNCH = "launch(uint256,string,string,uint8,uint256,bytes32,uint256)";
  const first = await attempt(() => c.exec(kiln, LAUNCH, [P5, "Agent One", "AGENT1", 18, 1000n * W, "0x" + w(1), 0]));
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, bob.from.toString(), P5]);
  const seller = await attempt(() => c.exec(kiln, LAUNCH, [P5, "Two", "TWO", 18, 1000n * W, "0x" + w(2), 0]));
  const tooSoon = await attempt(() => bob.exec(kiln, LAUNCH, [P5, "Two", "TWO", 18, 1000n * W, "0x" + w(2), 0]));
  warp(now() + 8n * 86400n);
  const buyer = await attempt(() => bob.exec(kiln, LAUNCH, [P5, "Two", "TWO", 18, 1000n * W, "0x" + w(2), 0]));
  refuted("the seller cannot launch from a sold token (NotActor); the buyer waits out the seven-day spacing (TooSoon) and then can",
    first.ok && named(seller, "NotActor()") && named(tooSoon, "TooSoon(uint64)") && buyer.ok, `first ${first.ok} seller ${why(seller, "NotActor()")} soon ${why(tooSoon, "TooSoon(uint64)")} buyer ${buyer.ok ? "ok" : buyer.msg}`);
}

head("names — ANIMA handle squatting");
{
  const NAME = kec(Buffer.from("name"));
  const label = "0x" + Buffer.from("the same name").toString("hex").padEnd(64, "0");
  const byRenter = await attempt(() => renter.exec(hub, "setTrait(uint256,bytes32,bytes32)", [P1, NAME, label]));
  const mine = await attempt(() => c.exec(hub, "setTrait(uint256,bytes32,bytes32)", [P1, NAME, label]));
  const theirs = await attempt(() => bob.exec(hub, "setTrait(uint256,bytes32,bytes32)", [P2, NAME, label]));
  refuted("the name trait is holds-only: the renter's write is refused (NotHolder) — design A's trait race is closed", named(byRenter, "NotHolder()") && mine.ok, why(byRenter, "NotHolder()"));
  notApplicable("handle squatting / the stale-attestation hijack", `INTACT's MVB has no handle registry; the name trait is a per-token label with no uniqueness claim (two tokens may carry the same name: ${mine.ok && theirs.ok}); ENS binding is the post-MVB Nameplate (U18)`);
}

/*═══════════════════ IV · the Kiln, the Router, the Steward, the Timelock ═══════════════════*/

head("the Kiln — a mis-mined hook");
{
  const opens = now() + 3600n, unlocks = now() + 86400n;
  const arg = "0x" + w((opens << 64n) | unlocks);
  const rh = await c.read(kiln, "recipeHash(uint8,bytes32)", [0, arg]);
  const hash = "0x" + rh.slice(2, 66);
  const flags = decUint(rh, 1);
  let found = false, salt = null, at = null, from = 0n;
  while (!found && from < 600_000n) {
    const r = await c.read(kiln, "mine(bytes32,uint16,uint256,uint256)", [hash, Number(flags), from, 60_000n]);
    found = decUint(r, 0) === 1n;
    if (found) { salt = "0x" + r.slice(66, 130); at = decAddr(r, 2); }
    from += 60_000n;
  }
  let bad = BigInt(salt) + 1n;
  const bits = (a) => BigInt(a) & 0x3fffn;
  while (bits(decAddr(await c.read(kiln, "mine(bytes32,uint16,uint256,uint256)", [hash, Number(flags), bad, 1n]), 2)) === flags) bad += 1n;
  // `mine` with one try answers the address of that salt only when the bits match; recompute the bad salt's address instead
  const wrong = await attempt(() => c.exec(kiln, "deployHook(uint8,bytes32,bytes32)", [0, "0x" + w(bad), arg]));
  const right = await attempt(() => c.exec(kiln, "deployHook(uint8,bytes32,bytes32)", [0, salt, arg]));
  refuted("a hook deployed at a salt whose address bits are not its permissions is refused (WrongFlags); the mined salt lands where the miner said and carries code",
    found && named(wrong, "WrongFlags(uint16,uint16)") && right.ok && (await c.codeSize(at)) > 0, `found ${found} wrong ${why(wrong, "WrongFlags(uint16,uint16)")} right ${right.ok ? "ok" : right.msg}`);
}

head("the Router — a venue that under-delivers by one wei");
{
  const weth = await c.deploy(A("test/mocks/MockWETH.sol", "MockWETH").bytecode, "", "MockWETH");
  const venue = await c.deploy(A("test/mocks/UnderDeliveringVenue.sol", "UnderDeliveringVenue").bytecode, "", "UnderDeliveringVenue");
  const router = await c.deploy(A("src/Router.sol", "Router").bytecode,
    encodeParams("address,address,address,address,address,bytes32", [hub, pool, venue, ZERO, weth, "0x" + "00".repeat(32)]), "Router");
  const R5 = await mintTo(me);
  const reach5 = await reachOf(R5);
  await c.exec(GOLD, "mint(address,uint256)", [reach5, 10n * W]);
  await c.exec(SILVER, "mint(address,uint256)", [venue, 100n * W]);
  await c.exec(reach5, EXEC, [GOLD, 0, enc("approve(address,uint256)", [router, W]), 0]);
  const path43 = GOLD + "000bb8" + SILVER.slice(2);
  const REQ = "(uint8,address,address,uint256,uint256,uint64,uint256,bytes,(address,address,uint24,int24,address),uint160)";
  const req = [1, GOLD, SILVER, W, W, now() + 3600n, 0n, path43, [ZERO, ZERO, 0, 0, ZERO], 0n];
  const before = await balance(SILVER, reach5);
  const r = await attempt(() => c.exec(reach5, EXEC, [router, 0, enc(`swap(${REQ})`, [req]), 0]));
  const after = await balance(SILVER, reach5);
  const eoa = await attempt(() => c.exec(router, `swap(${REQ})`, [req]));
  refuted("the Router measures its own balance delta: a venue that returns the asked amount and pays one wei less is Slippage(amountIn − 1, minOut); an EOA cannot use the Router at all (NotReach)",
    named(r, "Slippage(uint256,uint256)") && decUint(r.data.slice(10), 0) === W - 1n && after === before && named(eoa, "NotReach(address)"),
    `swap ${why(r, "Slippage(uint256,uint256)")} received ${r.data.length >= 74 ? decUint(r.data.slice(10), 0) : "?"} eoa ${why(eoa, "NotReach(address)")}`);
}

head("the Steward — a stranger is not life");
const QUIET = 30n * 86400n, NOTICE = 14n * 86400n;
const SALT = kec(Buffer.from("the heir's salt"));
const heir = carol.from.toString();
{
  const P6 = await mintTo(me);
  const h = await c.read(steward, "heirHashOf(address,bytes32)", [heir, SALT]);
  await c.exec(steward, "arrange(uint256,bytes32,uint64,uint64,address[],uint8)", [P6, h, QUIET, NOTICE, [], 0]);
  warp(now() + QUIET + 1n);
  const status0 = decUint(await c.read(steward, "wouldPass(uint256)", [P6]));
  const life = await attempt(() => stranger.exec(steward, "stillHere(uint256)", [P6]));
  const grab = await attempt(() => stranger.exec(hub, "transferFrom(address,address,uint256)", [me, stranger.from.toString(), P6]));
  const status1 = decUint(await c.read(steward, "wouldPass(uint256)", [P6]));
  const wrong = await attempt(() => stranger.exec(steward, "summon(uint256,address,bytes32)", [P6, stranger.from.toString(), SALT]));
  await stranger.exec(steward, "summon(uint256,address,bytes32)", [P6, heir, SALT]);
  const status2 = decUint(await c.read(steward, "wouldPass(uint256)", [P6]));
  const cancel = await attempt(() => stranger.exec(steward, "cancel(uint256)", [P6]));
  refuted("after the quiet the plan is SUMMONABLE; a stranger's stillHere is NotHolder and a stranger's grab at the token is NotAuthorized — neither counts as life; the wrong preimage is WrongHeir, the right one starts the notice (WAITING), and a stranger cannot cancel it (NotHolder)",
    status0 === 3n && named(life, "NotHolder()") && named(grab, "NotAuthorized()") && status1 === 3n && named(wrong, "WrongHeir()") && status2 === 4n && named(cancel, "NotHolder()"),
    `status ${status0} life ${why(life, "NotHolder()")} grab ${why(grab, "NotAuthorized()")} → ${status1} wrong ${why(wrong, "WrongHeir()")} after summon ${status2} cancel ${why(cancel, "NotHolder()")}`);
}

head("the Steward — the same stranger against a variant whose stillHere forgot the door (IPSEITY's `embody`)");
{
  const stewardVariant = variantOf("src/Steward.sol", "Steward", [
    ["    function stillHere(uint256 id) external {\n        _onlyHolder(id);\n        _life(id);", "    function stillHere(uint256 id) external {\n        _life(id);"]
  ]);
  const vsteward = await c.deploy(stewardVariant.bytecode, encodeParams("address", [hub]), "StewardVariant");
  const P7 = await mintTo(me);
  const h = await c.read(vsteward, "heirHashOf(address,bytes32)", [heir, SALT]);
  await c.exec(vsteward, "arrange(uint256,bytes32,uint64,uint64,address[],uint8)", [P7, h, QUIET, NOTICE, [], 0]);
  warp(now() + QUIET + 1n);
  const before = decUint(await c.read(vsteward, "wouldPass(uint256)", [P7]));
  const life = await attempt(() => stranger.exec(vsteward, "stillHere(uint256)", [P7]));
  const after = decUint(await c.read(vsteward, "wouldPass(uint256)", [P7]));
  reproduced("without the holder check a passer-by's call resets the silence: SUMMONABLE becomes SPEAKING and the heir's clock restarts",
    before === 3n && life.ok && after === 2n, `before ${before} life ${life.ok} after ${after}`);
}

/*═══════════════════ V · ANIMA's remaining classes ═══════════════════*/

head("ANIMA — revenue revival: away and back revives no policy");
{
  const P8 = await mintTo(me);
  const r = await reachOf(P8), g = await gripOf(P8);
  await c.exec(hub, "setFeesToGrip(uint256,bool)", [P8, true]);
  const s0 = decAddr(await c.read(hub, "feeSink(uint256)", [P8]));
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, bob.from.toString(), P8]);
  const s1 = decAddr(await c.read(hub, "feeSink(uint256)", [P8]));
  await bob.exec(hub, "transferFrom(address,address,uint256)", [bob.from.toString(), me, P8]);
  const s2 = decAddr(await c.read(hub, "feeSink(uint256)", [P8]));
  refuted("the fee route to the Grip is a policy of the holder who set it: the sale clears it and the buy-back does not bring it back — feeSink is the Grip, then the Reach, then still the Reach",
    same(s0, g) && same(s1, r) && same(s2, r), `${s0} → ${s1} → ${s2} (grip ${g}, reach ${r})`);
}

head("ANIMA — self-hire: the agent wallet is proposed by the holder and accepted by the wallet, never by the Reach for itself");
{
  const P9 = await mintTo(me);
  const r = await reachOf(P9);
  const selfPropose = await attempt(() => c.exec(r, EXEC, [hub, 0, enc("proposeAgentWallet(uint256,address)", [P9, r]), 0]));
  const strangerAccept = await attempt(() => stranger.exec(hub, "acceptAgentWallet(uint256)", [P9]));
  await c.exec(hub, "proposeAgentWallet(uint256,address)", [P9, agent.from.toString()]);
  const wrongAccept = await attempt(() => stranger.exec(hub, "acceptAgentWallet(uint256)", [P9]));
  await agent.exec(hub, "acceptAgentWallet(uint256)", [P9]);
  const bound = decAddr(await c.read(hub, "agentWalletOf(uint256)", [P9]));
  refuted("the Reach cannot name itself (NotHolder: proposing is holds-only); nobody accepts for a wallet that was not proposed (NotWallet) or for one that was (NotWallet); the proposed wallet accepts by sending",
    named(selfPropose, "NotHolder()") && named(strangerAccept, "NotWallet()") && named(wrongAccept, "NotWallet()") && same(bound, agent.from.toString()),
    `self ${why(selfPropose, "NotHolder()")} stranger ${why(strangerAccept, "NotWallet()")} wrong ${why(wrongAccept, "NotWallet()")} bound ${bound}`);
  notApplicable("reputation farming by self-hire", "INTACT v1 has no WorkEscrow and no reputation registry; the only unforgeable records are Postage reply receipts and sealed-market collect history (DESIGN §10)");
}

/*═══════════════════ VI · the Timelock, last: it moves the mint price through the queue ═══════════════════*/

head("the Timelock — the curator without the queue");
{
  const data = enc("setPrice(uint256)", [12345n]);
  const salt = "0x" + "07".repeat(32);
  const direct = await attempt(() => c.exec(hub, "setPrice(uint256)", [12345n]));
  const unqueued = await attempt(() => c.exec(timelock, "execute(address,uint256,bytes,bytes32)", [hub, 0, data, salt]));
  const strangerQ = await attempt(() => stranger.exec(timelock, "queue(address,uint256,bytes,bytes32)", [hub, 0, data, salt]));
  await c.exec(timelock, "queue(address,uint256,bytes,bytes32)", [hub, 0, data, salt]);
  const early = await attempt(() => c.exec(timelock, "execute(address,uint256,bytes,bytes32)", [hub, 0, data, salt]));
  warp(now() + 7n * 86400n + 1n);
  const landed = await attempt(() => stranger.exec(timelock, "execute(address,uint256,bytes,bytes32)", [hub, 0, data, salt]));
  const price = decUint(await c.read(hub, "price()"));
  refuted("the admin cannot set the price directly (NotTimelock) nor execute what was never queued (NotQueued); a stranger cannot queue (NotAdmin); a queued change waits its week (TooEarly) and then anyone may land it",
    named(direct, "NotTimelock()") && named(unqueued, "NotQueued()") && named(strangerQ, "NotAdmin()") && named(early, "TooEarly()") && landed.ok && price === 12345n,
    `direct ${why(direct, "NotTimelock()")} unqueued ${why(unqueued, "NotQueued()")} stranger ${why(strangerQ, "NotAdmin()")} early ${why(early, "TooEarly()")} landed ${landed.ok} price ${price}`);
}

/*═══════════════════ the roll ═══════════════════*/
console.log(`\n  \x1b[2m${pass + fail} verdicts, ${na} n/a, ${((Date.now() - T0) / 1000).toFixed(1)}s\x1b[0m`);
console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail ? 1 : 0);
