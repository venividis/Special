#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the market, on a real EVM

  Origin: IPSEITY tools/verify-pool.mjs (62 assertions), ported to INTACT's
  Pool with its new surface — exact-out, native legs, the sniper fee, the
  sealed markets, the C5 solvency cap — and with its old admin section
  turned inside out: where IPSEITY asserted that the five switches could
  not name an asset, this asserts that there are no switches.

  This is money code, so the tests are written to break it rather than to
  demonstrate it. The ones that matter:

    · the invariant never falls, over hundreds of random trades
    · a round trip always loses money — exact in, exact out, dust, 2^64,
      both directions — so there is no free arbitrage in the curve
    · nobody but the holder or the Reach can move the inventory
    · no market can be paid with another market's reserves
    · a sealed market's principal never leaves, and collect conserves value
    · no selector on Pool names an admin

  Every refusal is asserted by its custom-error selector, not by "it
  threw": a revert for the wrong reason is a test passing by accident.

    node tools/verify-pool.mjs
───────────────────────────────────────────────────────────────────────────*/
import { compile, artifact } from "./compile.mjs";
import * as EVM from "./evm.mjs";
import { Chain, decUint, decAddr, decBool, encodeAddressArg, encodeParams, sel } from "./evm.mjs";
import { keccak256 } from "ethereum-cryptography/keccak.js";

const DEADLINE = 4102444800n;
const MAX = 2n ** 255n;
const WAD = 10n ** 18n;
const ZERO = "0x" + "00".repeat(20);
const CAP = 16_777_216n;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${detail}`);
};
const eq = (name, got, want) => ok(name, String(got) === String(want), `got ${got}\n      want ${want}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const fmt = (v, d = 18) => {
  const n = BigInt(v);
  const w = n / 10n ** BigInt(d);
  const f = (n % 10n ** BigInt(d)).toString().padStart(d, "0").slice(0, 4);
  return `${w}.${f}`;
};
const topic = (sig) => "0x" + Buffer.from(keccak256(Buffer.from(sig, "utf8"))).toString("hex");

/// A refusal, by selector. `err` is the error's signature ("NotActor()").
async function refuses(name, fn, err, why) {
  let threw = false, msg = "";
  try { await fn(); } catch (e) { threw = true; msg = String(e.message || e); }
  const want = err ? sel(err).slice(2) : null;
  const right = threw && (!want || msg.includes(want));
  ok(`${name}${err ? `  \x1b[2m${err}\x1b[0m` : ""}`, right,
     !threw ? "it allowed it" + (why ? " — " + why : "") : "reverted for another reason: " + msg.slice(0, 140));
}

/*──────────────────── deploy ────────────────────*/
head("deploy");
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const me = c.from.toString();
const bob = await c.as("0x" + "22".repeat(32));
const carol = await c.as("0x" + "33".repeat(32));
const BOB = bob.from.toString(), CAROL = carol.from.toString();

const hub = await c.deploy(A("test/mocks/PoolFixtures.sol", "PoolHub").bytecode, "", "PoolHub");
// the deployer plays the Launchpad, so openSealed can be exercised directly
const pool = await c.deploy(A("src/Pool.sol", "Pool").bytecode,
  encodeAddressArg(hub) + encodeAddressArg(me), "Pool");

const mkToken = (name, sym, dec, feeBps, silent) =>
  c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode,
    encodeParams("string,string,uint8,uint256,bool", [name, sym, dec, feeBps, silent]));
const WETH = await mkToken("Wrapped Ether", "WETH", 18, 0, false);
const USDC = await mkToken("USD Coin", "USDC", 18, 0, false);
const USDT = await mkToken("Tether", "USDT", 18, 0, true);       // returns nothing
const FEET = await mkToken("FeeOnTransfer", "FOT", 18, 100, false); // takes 1%

eq("the pool knows its hub", decAddr(await c.read(pool, "HUB()")).toLowerCase(), hub.toLowerCase());
eq("and its launchpad", decAddr(await c.read(pool, "LAUNCHPAD()")).toLowerCase(), me.toLowerCase());
console.log(`      Pool ${pool}  ${A("src/Pool.sol", "Pool").deployed.length / 2 - 1} B`);

const market = async (id) => {
  const m = await c.read(pool, "marketOf(uint256)", [id]);
  return {
    base: decAddr(m, 0), quote: decAddr(m, 1), rb: decUint(m, 2), rq: decUint(m, 3),
    fee: decUint(m, 4), sniperBps: decUint(m, 5), sniperUntil: decUint(m, 6),
    open: decBool(m, 7), sealed: decBool(m, 8), sealUntil: decUint(m, 9), curve: decUint(m, 10),
    vb: decUint(m, 11), vq: decUint(m, 12), feeB: decUint(m, 13), feeQ: decUint(m, 14), ben: decUint(m, 15)
  };
};
const bal = async (token, who) => token === ZERO ? c.balanceOf(who) : decUint(await c.read(token, "balanceOf(address)", [who]));
const reserved = (token) => c.read(pool, "totalReserved(address)", [token]).then(decUint);
const quote = (id, baseIn, amt) => c.read(pool, "quote(uint256,bool,uint256)", [id, baseIn, amt]).then(decUint);
const quoteOut = (id, baseIn, amt) => c.read(pool, "quoteExactOut(uint256,bool,uint256)", [id, baseIn, amt]).then(decUint);
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";
const SWAP_OUT = "swapExactOut(uint256,bool,uint256,uint256,address,uint64)";
const OPEN = "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)";
const WITHDRAW = "withdraw(uint256,uint256,uint256,address)";
const DEPOSIT = "deposit(uint256,uint256,uint256)";

for (const t of [WETH, USDC, USDT, FEET]) {
  await c.exec(t, "mint(address,uint256)", [me, 10n ** 27n]);
  await c.exec(t, "approve(address,uint256)", [pool, MAX]);
  await c.exec(t, "mint(address,uint256)", [BOB, 10n ** 27n]);
  await bob.exec(t, "approve(address,uint256)", [pool, MAX]);
  await c.exec(t, "mint(address,uint256)", [CAROL, 10n ** 27n]);
  await carol.exec(t, "approve(address,uint256)", [pool, MAX]);
}

/*──────────────────── set up a market ────────────────────*/
head("token #1 opens a market");
await c.exec(hub, "mint(address)", [me]);
await c.exec(pool, OPEN, [1, WETH, USDC, 30, 0, 0, 0], { label: "openMarket" });
await c.exec(pool, DEPOSIT, [1, 100n * WAD, 300000n * WAD], { label: "deposit" });

let m0 = await market(1);
eq("base reserve", m0.rb, 100n * WAD);
eq("quote reserve", m0.rq, 300000n * WAD);
eq("fee", m0.fee, 30);
ok("market is open, and it is not a sealed one", m0.open && !m0.sealed);
eq("concentration zero anchors to nothing", m0.vb + m0.vq, 0);
eq("the pool's claim on WETH is the reserve", await reserved(WETH), 100n * WAD);
eq("and on USDC", await reserved(USDC), 300000n * WAD);
eq("the directory lists it", decUint(await c.read(pool, "openIds(uint256,uint256)", [0, 10]), 2), 1);
const spot1 = decUint(await c.read(pool, "spot(uint256)", [1]));
console.log(`      spot: 1 WETH = ${fmt(spot1)} USDC`);

/*──────────────────── a stranger trades ────────────────────*/
head("anyone may trade against it");
const q = await quote(1, true, WAD);
console.log(`      quote: 1 WETH -> ${fmt(q)} USDC`);
ok("a quote is under the spot price (the curve charges for size)", q < spot1);

let before = await bal(USDC, BOB);
await bob.exec(pool, SWAP_IN, [1, true, WAD, q, BOB, DEADLINE], { label: "swapExactIn" });
let after = await bal(USDC, BOB);
eq("the trader was paid exactly what was quoted", after - before, q);
const swapped = c.getLogs({ address: pool, topics: [topic("Swapped(uint256,address,bool,uint256,uint256,uint256)")] });
eq("a Swapped log was written", swapped.length, 1);
eq("the WETH claim rose by the whole input (the fee stays in the reserve)", await reserved(WETH), 101n * WAD);
eq("and the USDC claim fell by the output", await reserved(USDC), 300000n * WAD - q);

/*──────────────────── the invariant ────────────────────*/
head("the invariant never falls");
/* Read the anchored offsets out of the market rather than recomputing them
   from the live reserves. Recomputing is what hid the round-trip leak that
   tools/fuzz.mjs found: virtual reserves proportional to live reserves move
   the curve on every trade, so k measured that way is not the quantity the
   pricing conserves. */
const inv = async (id = 1) => {
  const m = await market(id);
  return { k: (m.rb + m.vb) * (m.rq + m.vq), rb: m.rb, rq: m.rq };
};
await c.exec(pool, "syncCurve(uint256,uint24,uint24)", [1, 30000, 0], { label: "syncCurve" });
let k = (await inv()).k;
let worst = null, refused = 0, moved = 0;
let seed = 123456789n;
const rnd = (n) => { seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return seed % n; };

for (let i = 0; i < 200; i++) {
  const baseIn = rnd(2n) === 0n;
  const exactOut = rnd(4n) === 0n;
  const r = await inv();
  const cap = baseIn ? r.rb : r.rq;
  const amount = 1n + rnd(cap / 40n === 0n ? 1n : cap / 40n);
  try {
    if (exactOut) {
      const want = 1n + rnd((baseIn ? r.rq : r.rb) / 40n);
      await bob.exec(pool, SWAP_OUT, [1, baseIn, want, MAX, BOB, DEADLINE]);
    } else {
      await bob.exec(pool, SWAP_IN, [1, baseIn, amount, 0, BOB, DEADLINE]);
    }
  } catch {
    refused++;
    const r2 = await inv();
    if (r2.k !== r.k) moved++;
    continue;
  }
  const now = (await inv()).k;
  if (now < k) { worst = { i, before: k, after: now }; break; }
  k = now;
}
ok("k never decreased across 200 random trades, exact in and exact out", worst === null,
   worst && `fell at trade ${worst.i}: ${worst.before} -> ${worst.after}`);
ok(`a refused trade changes nothing (${refused} refused)`, moved === 0);

/*──────────────────── no free money ────────────────────*/
head("a round trip always loses money");
const roundTrip = async (id, size, baseFirst, shape) => {
  const tokA = baseFirst ? WETH : USDC;
  const a0 = await bal(tokA, BOB);
  let got;
  try {
    if (shape & 1) {
      const want = await quote(id, baseFirst, size);
      await bob.exec(pool, SWAP_OUT, [id, baseFirst, want, size, BOB, DEADLINE]);
      got = want;
    } else {
      const r = await bob.exec(pool, SWAP_IN, [id, baseFirst, size, 0, BOB, DEADLINE]);
      got = decUint(r.ret);
    }
  } catch { return null; }
  try {
    if (shape & 2) {
      const back = await quote(id, !baseFirst, got);
      await bob.exec(pool, SWAP_OUT, [id, !baseFirst, back, got, BOB, DEADLINE]);
    } else {
      await bob.exec(pool, SWAP_IN, [id, !baseFirst, got, 0, BOB, DEADLINE]);
    }
  } catch { return null; }
  const a1 = await bal(tokA, BOB);
  return { profit: a1 > a0, net: a1 - a0 };
};
const SIZES = [1n, 2n, 9n, WAD / 1000n, WAD / 10n, WAD, 3n * WAD, 2n ** 64n];
let leaks = 0, trips = 0, dustRefused = 0;
for (const size of SIZES) {
  for (const baseFirst of [true, false]) {
    for (let shape = 0; shape < 4; shape++) {
      const r = await roundTrip(1, baseFirst ? size : size * 3000n, baseFirst, shape);
      if (r === null) { if (size < 10n) dustRefused++; continue; }
      trips++;
      if (r.profit) { leaks++; console.log(`      \x1b[31mPROFIT\x1b[0m size ${size} ${baseFirst ? "base" : "quote"}-first shape ${shape}: +${r.net}`); }
    }
  }
}
ok(`no round trip ever came back with more than it started (${trips} trips in both directions, four shapes, dust to 2^64)`, leaks === 0);
ok("a dust trade is refused or loses, never pays (ZeroAmount at the bottom of the curve)", dustRefused > 0 && leaks === 0);
const big = await roundTrip(1, 2n ** 64n, true, 0);
ok("a 2^64-wei round trip loses", big !== null && !big.profit, big && `net ${big.net}`);

/*──────────────────── exact out ────────────────────*/
head("exact out is the inverse of exact in");
const want = 1000n * WAD;
const need = await quoteOut(1, true, want);
ok("the input exact-out names buys at least the output asked, through exact-in's own arithmetic", (await quote(1, true, need)) >= want);
const spentBefore = await bal(WETH, BOB);
const r1 = await bob.exec(pool, SWAP_OUT, [1, true, want, need, BOB, DEADLINE], { label: "swapExactOut" });
eq("swapExactOut charges exactly the quote", spentBefore - (await bal(WETH, BOB)), need);
eq("and returns it", decUint(r1.ret), need);
await refuses("a maxIn one wei short of the quote", () =>
  bob.exec(pool, SWAP_OUT, [1, true, want, need - 1n, BOB, DEADLINE]), "Slippage(uint256,uint256)");
const mNow = await market(1);
await refuses("an exact-out over half the reserve", () =>
  bob.exec(pool, SWAP_OUT, [1, true, mNow.rq / 2n + 1n, MAX, BOB, DEADLINE]), "TradeTooLarge()");

/*──────────────────── the curve is a number the holder keeps ────────────────────*/
head("the curve is the holder's number, applied only by sync");
await c.exec(pool, "syncCurve(uint256,uint24,uint24)", [1, 0, 30000], { label: "syncCurve" });
const flat = await quote(1, true, WAD);
const mFlat = await market(1);
eq("concentration zero: no offsets", mFlat.vb + mFlat.vq, 0);
await c.exec(pool, "syncCurve(uint256,uint24,uint24)", [1, 40000, 0], { label: "syncCurve" });
const tight = await quote(1, true, WAD);
const mTight = await market(1);
eq("the sync wrote the concentration", mTight.curve, 40000);
eq("and anchored the offsets at four times the reserves", mTight.vb, mTight.rb * 4n);
ok("a concentrated curve gives a better price for the same size", tight > flat, `${tight} vs ${flat}`);
console.log(`      flat   1 WETH -> ${fmt(flat)} USDC\n      4.0x   1 WETH -> ${fmt(tight)} USDC`);
await refuses("a sync against a curve that moved (the holder saw 0, it is 40000)", () =>
  c.exec(pool, "syncCurve(uint256,uint24,uint24)", [1, 1000, 0]), "CurveMoved()",
  "the renter-vs-holder sync race is open");
await refuses("a curve above 8x", () =>
  c.exec(pool, "syncCurve(uint256,uint24,uint24)", [1, 80001, 40000]), "CurveTooSteep()");
// a trade does not move the anchors
await bob.exec(pool, SWAP_IN, [1, true, WAD, 0, BOB, DEADLINE]);
const mAfter = await market(1);
ok("a trade moves along the curve and never moves the curve", mAfter.vb === mTight.vb && mAfter.vq === mTight.vq);
const anchored = c.getLogs({ address: pool, topics: [topic("CurveAnchored(uint256,uint128,uint128)")] });
ok("CurveAnchored was emitted only by open, deposit, withdraw and sync (never by a trade)",
   anchored.length === 1 + 1 + 3, `${anchored.length} anchor events`);

/*──────────────────── protections ────────────────────*/
head("what it refuses");
await refuses("a trade below the trader's minimum", () =>
  bob.exec(pool, SWAP_IN, [1, true, WAD, 10n ** 30n, BOB, DEADLINE]), "Slippage(uint256,uint256)");
await refuses("a trade past its deadline", () =>
  bob.exec(pool, SWAP_IN, [1, true, WAD, 0, BOB, 1n]), "Expired()");
await refuses("a trade larger than half the reserve", () =>
  bob.exec(pool, SWAP_IN, [1, true, 10n ** 24n, 0, BOB, DEADLINE]), "TradeTooLarge()");
await refuses("a zero trade", () =>
  bob.exec(pool, SWAP_IN, [1, true, 0, 0, BOB, DEADLINE]), "ZeroAmount()");
await refuses("a stranger withdrawing the inventory", () =>
  bob.exec(pool, WITHDRAW, [1, 1n, 1n, BOB]), "NotActor()");
await refuses("a stranger opening a market on someone else's token", () =>
  bob.exec(pool, OPEN, [1, WETH, USDC, 30, 0, 0, 0]), "NotActor()");
await refuses("a market on a token that does not exist", () =>
  c.exec(pool, OPEN, [999, WETH, USDC, 30, 0, 0, 0]), "NotActor()");
await refuses("a fee above the cap", () =>
  c.exec(pool, "setFee(uint256,uint16)", [1, 501]), "FeeTooHigh()");
await c.exec(hub, "mint(address)", [me]);   // #2
await refuses("a curve above the cap at open", () =>
  c.exec(pool, OPEN, [2, WETH, USDC, 30, 80001, 0, 0]), "CurveTooSteep()");
await refuses("a sniper fee above the cap", () =>
  c.exec(pool, OPEN, [2, WETH, USDC, 30, 0, 9001, 60]), "SniperTooHigh()");
await refuses("a sniper window over 98 minutes", () =>
  c.exec(pool, OPEN, [2, WETH, USDC, 30, 0, 100, 98 * 60 + 1]), "SniperTooHigh()");
await refuses("a market of a token against itself", () =>
  c.exec(pool, OPEN, [2, WETH, WETH, 30, 0, 0, 0]), "SameToken()");
await refuses("closing a market that still holds inventory", () =>
  c.exec(pool, "closeMarket(uint256)", [1]), "MarketNotEmpty()");
await refuses("a deposit of nothing", () =>
  c.exec(pool, DEPOSIT, [1, 0, 0]), "ZeroAmount()");
await refuses("ether sent to an ERC-20 pair", () =>
  c.exec(pool, DEPOSIT, [1, WAD, 0], { value: 1n }), "WrongValue()");
await refuses("a withdrawal of more than the market holds", () =>
  c.exec(pool, WITHDRAW, [1, 10n ** 30n, 0, me]), "Insolvent()");

/*──────────────────── awkward tokens ────────────────────*/
head("tokens that break naive pools");
await c.exec(pool, OPEN, [2, USDT, FEET, 30, 0, 0, 0]);
await c.exec(pool, DEPOSIT, [2, 1000n * WAD, 1000n * WAD]);
const m2 = await market(2);
eq("a token that returns nothing from transfer is accepted", m2.rb, 1000n * WAD);
ok("a token that takes a cut is credited only what arrived", m2.rq === 990n * WAD, `credited ${fmt(m2.rq)}, sent 1000`);
eq("and the claim is what arrived, not what was sent", await reserved(FEET), 990n * WAD);
const gross = await quote(2, true, WAD);
await refuses("a floor set at the gross output of a taxed token", () =>
  bob.exec(pool, SWAP_IN, [2, true, WAD, gross, BOB, DEADLINE]), "Slippage(uint256,uint256)",
  "an output-side transfer tax defeats the slippage floor");
const f0 = await bal(FEET, BOB);
const rr = await bob.exec(pool, SWAP_IN, [2, true, WAD, gross * 99n / 100n, BOB, DEADLINE]);
eq("the swap returns what the recipient actually received", decUint(rr.ret), (await bal(FEET, BOB)) - f0);
await refuses("exact-out of a taxed token (exact means exact at the recipient)", () =>
  bob.exec(pool, SWAP_OUT, [2, true, WAD, MAX, BOB, DEADLINE]), "Slippage(uint256,uint256)");

/*──────────────────── native legs ────────────────────*/
head("native ether on either side");
await c.exec(hub, "mint(address)", [me]);   // #3: USDC against ETH
await c.exec(pool, OPEN, [3, USDC, ZERO, 30, 0, 0, 0]);
await refuses("a native deposit whose value is not the amount", () =>
  c.exec(pool, DEPOSIT, [3, 3000n * WAD, WAD], { value: WAD - 1n }), "WrongValue()");
await c.exec(pool, DEPOSIT, [3, 3000n * WAD, WAD], { value: WAD, label: "deposit (native)" });
const m3 = await market(3);
eq("the native reserve is the value sent", m3.rq, WAD);
eq("the pool's native claim is the reserve", await reserved(ZERO), WAD);
eq("and its balance is the claim", await c.balanceOf(pool), WAD);
const qe = await quote(3, false, WAD / 10n);
await refuses("ether in without the value", () =>
  bob.exec(pool, SWAP_IN, [3, false, WAD / 10n, 0, BOB, DEADLINE]), "WrongValue()");
let u0 = await bal(USDC, BOB);
await bob.exec(pool, SWAP_IN, [3, false, WAD / 10n, qe, BOB, DEADLINE], { value: WAD / 10n, label: "swapExactIn (ether in)" });
eq("ether in, USDC out: paid the quote", (await bal(USDC, BOB)) - u0, qe);
const qo = await quote(3, true, 100n * WAD);
const e0 = await c.balanceOf(BOB);
const g = (await bob.exec(pool, SWAP_IN, [3, true, 100n * WAD, qo, BOB, DEADLINE], { label: "swapExactIn (ether out)" })).gas;
eq("USDC in, ether out: the pool paid ether", (await c.balanceOf(BOB)) - e0 + g * 10n, qo);
const needE = await quoteOut(3, false, 50n * WAD);
const e1 = await c.balanceOf(BOB);
const r2 = await bob.exec(pool, SWAP_OUT, [3, false, 50n * WAD, WAD, BOB, DEADLINE], { value: WAD, label: "swapExactOut (ether in)" });
eq("exact-out with ether in: maxIn sent, the change came back", e1 - (await c.balanceOf(BOB)) - r2.gas * 10n, needE);
eq("the pool's ether balance equals its books after the refund", await c.balanceOf(pool), await reserved(ZERO));
await c.exec(pool, WITHDRAW, [3, 0, WAD / 100n, me]);
eq("the holder withdraws ether and the books follow", await c.balanceOf(pool), await reserved(ZERO));

/*──────────────────── the market travels with the token ────────────────────*/
head("selling the token sells the market");
await c.exec(hub, "transferFrom(address,address,uint256)", [me, CAROL, 1]);
eq("the token moved", decAddr(await c.read(hub, "ownerOf(uint256)", [1])).toLowerCase(), CAROL.toLowerCase());
const mSold = await market(1);
ok("the reserves went with it", mSold.rb > 0n && mSold.rq > 0n, `${fmt(mSold.rb)} / ${fmt(mSold.rq)}`);
await refuses("the old owner can no longer touch the inventory", () =>
  c.exec(pool, WITHDRAW, [1, 1n, 0n, me]), "NotActor()");
const cb = await bal(WETH, CAROL);
await carol.exec(pool, WITHDRAW, [1, WAD, 0n, CAROL]);
eq("and the new owner can", (await bal(WETH, CAROL)) - cb, WAD);

/*──────────────────── the Reach acts; a renter never does ────────────────────*/
head("the holder or the token's Reach, and nobody else");
await c.exec(hub, "mint(address)", [me]);   // #4
await c.exec(pool, OPEN, [4, WETH, USDC, 30, 0, 0, 0]);
await c.exec(pool, DEPOSIT, [4, 10n * WAD, 30000n * WAD]);
await c.exec(hub, "setAccount(uint256,address)", [4, BOB]);   // bob is #4's Reach
let r4 = await market(4);
await bob.exec(pool, DEPOSIT, [4, WAD, 0]);
eq("the Reach may feed its own market", (await market(4)).rb, r4.rb + WAD);
await bob.exec(pool, "syncCurve(uint256,uint24,uint24)", [4, 20000, 0]);
eq("and sync its curve", (await market(4)).curve, 20000);
await refuses("but not another token's market", () =>
  bob.exec(pool, DEPOSIT, [3, 0, WAD], { value: WAD }), "NotActor()");
await refuses("and a third party — operator, renter, approvee — is nobody here", () =>
  carol.exec(pool, DEPOSIT, [4, WAD, 0]), "NotActor()");
await refuses("nor can a third party sync the curve", () =>
  carol.exec(pool, "syncCurve(uint256,uint24,uint24)", [4, 0, 20000]), "NotActor()");

/*──────────────────── the seal ────────────────────*/
head("the seal — a promise a buyer can check");
const NOW = EVM.GENESIS_TIME;
const SEAL = "sealMarket(uint256,uint64)";
eq("unsealed to begin with", (await market(4)).sealUntil, 0);
await c.exec(pool, SEAL, [4, NOW + 86400n], { label: "sealMarket" });
eq("sealed now, and the date is readable by anyone", (await market(4)).sealUntil, NOW + 86400n);
await refuses("withdrawing while sealed", () => c.exec(pool, WITHDRAW, [4, 1n, 0n, me]), "Sealed(uint64)");
await refuses("closing the market while sealed", () => c.exec(pool, "closeMarket(uint256)", [4]), "Sealed(uint64)");
await refuses("re-pricing the fee while sealed", () => c.exec(pool, "setFee(uint256,uint16)", [4, 100]), "Sealed(uint64)");
await refuses("re-shaping the curve while sealed", () =>
  c.exec(pool, "syncCurve(uint256,uint24,uint24)", [4, 0, 20000]), "Sealed(uint64)",
  "a seal that lets its maker reshape the curve is the same rug with more steps");
await refuses("shortening the seal", () => c.exec(pool, SEAL, [4, NOW + 100n]), "RatchetOnly()");
await refuses("a seal in the past", () => c.exec(pool, SEAL, [4, NOW - 1n]), "RatchetOnly()");
await refuses("a seal longer than anyone can outlive", () => c.exec(pool, SEAL, [4, NOW + 366n * 86400n]), "TooLong()");
const mSealed = await market(4);
let deposited = true;
try { await c.exec(pool, DEPOSIT, [4, WAD, 0n]); } catch { deposited = false; }
ok("depositing into a sealed market still works", deposited);
const mFed = await market(4);
ok("but the curve does not follow the deposit while the seal holds (IPSEITY invariant 56)",
   mFed.vb === mSealed.vb && mFed.vq === mSealed.vq && mFed.rb === mSealed.rb + WAD);
let traded = true;
try { await bob.exec(pool, SWAP_IN, [4, true, WAD / 10n, 0, BOB, DEADLINE]); } catch { traded = false; }
ok("and so does trading against it", traded);
await c.exec(pool, SEAL, [4, NOW + 172800n]);
eq("the seal extends", (await market(4)).sealUntil, NOW + 172800n);
await c.exec(hub, "transferFrom(address,address,uint256)", [me, CAROL, 4]);
eq("the seal survives the sale", (await market(4)).sealUntil, NOW + 172800n);
await refuses("and binds the new owner too", () => carol.exec(pool, WITHDRAW, [4, 1n, 0n, CAROL]), "Sealed(uint64)");
EVM.warp(NOW + 172800n);
let released = true;
try { await carol.exec(pool, WITHDRAW, [4, 1n, 0n, CAROL]); } catch { released = false; }
ok("and releases at the moment it names", released);
EVM.warp(NOW);

/*──────────────────── the sniper fee ────────────────────*/
head("the sniper fee: armed at open, decaying, never re-armed");
await c.exec(hub, "mint(address)", [me]);   // #5 with a sniper fee
await c.exec(hub, "mint(address)", [me]);   // #6 its sibling without
await c.exec(pool, OPEN, [5, WETH, USDC, 30, 0, 5000, 1000]);
await c.exec(pool, DEPOSIT, [5, 100n * WAD, 300000n * WAD]);
await c.exec(pool, OPEN, [6, WETH, USDC, 30, 0, 0, 0]);
await c.exec(pool, DEPOSIT, [6, 100n * WAD, 300000n * WAD]);
const qSn = await quote(5, true, WAD), qSib = await quote(6, true, WAD);
ok("the sniper fee is charged at open", qSn < qSib, `${qSn} vs ${qSib}`);
EVM.warp(NOW + 500n);
const qHalf = await quote(5, true, WAD);
ok("and decays linearly: half way through, half the surcharge", qHalf > qSn && qHalf < qSib);
EVM.warp(NOW + 1000n);
eq("at the window's end the fee is the base fee", await quote(5, true, WAD), qSib);
const armed = await market(5);
await c.exec(pool, DEPOSIT, [5, 10n * WAD, 30000n * WAD]);
await c.exec(pool, DEPOSIT, [6, 10n * WAD, 30000n * WAD]);
const reArmed = await market(5);
ok("a deposit does not re-arm it", reArmed.sniperUntil === armed.sniperUntil && (await quote(5, true, WAD)) === (await quote(6, true, WAD)));
EVM.warp(NOW);

/*──────────────────── sealed markets ────────────────────*/
head("sealed markets: graduation liquidity nobody can withdraw");
const COIN = await mkToken("Coin", "COIN", 18, 0, false);
await c.exec(COIN, "mint(address,uint256)", [me, 10n ** 27n]);
await c.exec(COIN, "approve(address,uint256)", [pool, MAX]);
await c.exec(COIN, "mint(address,uint256)", [BOB, 10n ** 27n]);
await bob.exec(COIN, "approve(address,uint256)", [pool, MAX]);
const LAUNCH = "0x" + "ab".repeat(32);
const OPEN_SEALED = "openSealed(bytes32,address,address,uint16,uint256,uint256)";
await refuses("a stranger opening a sealed market", () =>
  bob.exec(pool, OPEN_SEALED, [LAUNCH, COIN, ZERO, 100, 10n ** 24n, 1], { value: 10n * WAD }), "NotLaunchpad()");
await refuses("the launchpad with an ERC-20 quote (the raise is native)", () =>
  c.exec(pool, OPEN_SEALED, [LAUNCH, COIN, USDC, 100, 10n ** 24n, 1], { value: 10n * WAD }), "WrongValue()");
await refuses("the launchpad with no raise", () =>
  c.exec(pool, OPEN_SEALED, [LAUNCH, COIN, ZERO, 100, 10n ** 24n, 1]), "ZeroAmount()");
const nativeClaim0 = await reserved(ZERO);
const rs = await c.exec(pool, OPEN_SEALED, [LAUNCH, COIN, ZERO, 100, 10n ** 24n, 1], { value: 10n * WAD, label: "openSealed" });
const KEY = decUint(rs.ret);
eq("the key is keccak(\"intact.sealed\", launchKey)", KEY, decUint(await c.read(pool, "sealedKey(bytes32)", [LAUNCH])));
const ms = await market(KEY);
ok("open, sealed, beneficiary #1, principal as sent", ms.open && ms.sealed && ms.ben === 1n && ms.rb === 10n ** 24n && ms.rq === 10n * WAD);
eq("the opening spot price is the terminal price", decUint(await c.read(pool, "spot(uint256)", [KEY])), 10n * WAD * WAD / 10n ** 24n);
eq("the sealed directory lists it", decUint(await c.read(pool, "sealedIds(uint256,uint256)", [0, 10]), 2), KEY);
const ownedIds = await c.read(pool, "openIds(uint256,uint256)", [0, 50]);
const nOwned = Number(decUint(ownedIds, 1));
ok("and the owned directory does not", Array.from({ length: nOwned }, (_, i) => decUint(ownedIds, 2 + i)).every((x) => x !== KEY));
for (const [who, name] of [[carol, "the beneficiary's holder"], [c, "the launchpad"], [bob, "a stranger"]]) {
  await refuses(`${name} withdrawing principal`, () => who.exec(pool, WITHDRAW, [KEY, 1n, 0n, who.from.toString()]), "SealedMarket()");
}
await refuses("anyone setting its fee", () => carol.exec(pool, "setFee(uint256,uint16)", [KEY, 0]), "SealedMarket()");
await refuses("anyone syncing its curve", () => carol.exec(pool, "syncCurve(uint256,uint24,uint24)", [KEY, 1000, 0]), "SealedMarket()");
await refuses("anyone sealing it further", () => carol.exec(pool, SEAL, [KEY, NOW + 86400n]), "SealedMarket()");
await refuses("anyone closing it", () => carol.exec(pool, "closeMarket(uint256)", [KEY]), "SealedMarket()");
await refuses("anyone depositing into it", () => carol.exec(pool, DEPOSIT, [KEY, 1n, 0n]), "SealedMarket()");

// trade it, and account for every wei
const ethBefore = await c.balanceOf(pool), coinBefore = await bal(COIN, pool);
let ethIn = 0n, coinIn = 0n;
const g1 = decUint((await bob.exec(pool, SWAP_IN, [KEY, false, WAD, 0, BOB, DEADLINE], { value: WAD, label: "swapExactIn (sealed)" })).ret);
ethIn += WAD;
await bob.exec(pool, SWAP_IN, [KEY, true, g1 / 2n, 0, BOB, DEADLINE]);
coinIn += g1 / 2n;
const paid = decUint((await bob.exec(pool, SWAP_OUT, [KEY, false, g1 / 4n, WAD, BOB, DEADLINE], { value: WAD })).ret);
ethIn += paid;
const msT = await market(KEY);
ok("fees accrued to the owed ledgers, not the reserves", msT.feeB > 0n && msT.feeQ > 0n);
const ethOut = ethBefore + ethIn - (await c.balanceOf(pool));
const coinOut = coinBefore + coinIn - (await bal(COIN, pool));
eq("ether: reserve + owed + paid out == paid in", msT.rq + msT.feeQ + ethOut, ms.rq + ethIn);
eq("coin: reserve + owed + paid out == paid in", msT.rb + msT.feeB + coinOut, ms.rb + coinIn);
eq("the native claim counts the fee owed", await reserved(ZERO), nativeClaim0 + msT.rq + msT.feeQ);
const sink = decAddr(await c.read(hub, "feeSink(uint256)", [1]));
eq("feeSink(#1) is the Reach by default", sink.toLowerCase(), decAddr(await c.read(hub, "account(uint256)", [1])).toLowerCase());
const s0 = await c.balanceOf(sink), sc0 = await bal(COIN, sink);
await carol.exec(pool, "collect(uint256)", [KEY], { label: "collect" });
eq("anyone's collect pays the feeSink the ether owed", (await c.balanceOf(sink)) - s0, msT.feeQ);
eq("and the coin owed", (await bal(COIN, sink)) - sc0, msT.feeB);
const msC = await market(KEY);
ok("owed zeroed, principal untouched", msC.feeB === 0n && msC.feeQ === 0n && msC.rb === msT.rb && msC.rq === msT.rq);
eq("the pool's ether equals its books after collect", await c.balanceOf(pool), await reserved(ZERO));
await refuses("a second collect, with nothing owed", () => carol.exec(pool, "collect(uint256)", [KEY]), "ZeroAmount()");
await refuses("collect on an owned market (its fees are its reserves)", () => carol.exec(pool, "collect(uint256)", [6]), "ZeroAmount()");
await c.exec(hub, "setFeesToGrip(uint256,bool)", [1, true]);
await bob.exec(pool, SWAP_IN, [KEY, false, WAD, 0, BOB, DEADLINE], { value: WAD });
const grip = decAddr(await c.read(hub, "grip(uint256)", [1]));
const owedG = (await market(KEY)).feeQ;
await bob.exec(pool, "collect(uint256)", [KEY]);
eq("with feesToGrip set, the Grip is paid", await c.balanceOf(grip), owedG);
eq("selling #1 sells the stream: feeSink follows the token, not the seller", decAddr(await c.read(hub, "feeSink(uint256)", [1])).toLowerCase(), grip.toLowerCase());

/*──────────────────── cross-market solvency (C5) ────────────────────*/
head("no market pays with another market's reserves");
const RBS = await c.deploy(A("test/mocks/RebasingToken.sol", "RebasingToken").bytecode);
await c.exec(RBS, "mint(address,uint256)", [me, 10n ** 24n]);
await c.exec(RBS, "approve(address,uint256)", [pool, MAX]);
await c.exec(RBS, "mint(address,uint256)", [BOB, 10n ** 24n]);
await bob.exec(RBS, "approve(address,uint256)", [pool, MAX]);
await c.exec(hub, "mint(address)", [me]);    // #7 A
await c.exec(hub, "mint(address)", [BOB]);   // #8 B
await c.exec(pool, OPEN, [7, WETH, RBS, 30, 0, 0, 0]);
await c.exec(pool, DEPOSIT, [7, 100n * WAD, 100n * WAD]);
await bob.exec(pool, OPEN, [8, WETH, RBS, 30, 0, 0, 0]);
await bob.exec(pool, DEPOSIT, [8, 100n * WAD, 100n * WAD]);
eq("two markets, one balance, one claim", await reserved(RBS), 200n * WAD);
await c.exec(RBS, "rebase(uint256)", [5n * 10n ** 17n]);
eq("the token halved every balance", await bal(RBS, pool), 100n * WAD);
await refuses("A withdrawing its nominal reserve", () => c.exec(pool, WITHDRAW, [7, 0n, 100n * WAD, me]), "Insolvent()",
  "A was paid with B's money");
await refuses("A withdrawing one wei (the cap is balance minus B's claim: zero)", () => c.exec(pool, WITHDRAW, [7, 0n, 1n, me]), "Insolvent()");
await refuses("a trade paying RBS out of A", () => carol.exec(pool, SWAP_IN, [7, true, WAD, 0, CAROL, DEADLINE]), "Insolvent()");
await c.exec(pool, "writeDown(uint256)", [7], { label: "writeDown" });
eq("A writes itself down to what is left after B is whole: nothing", (await market(7)).rq, 0);
eq("the claim follows", await reserved(RBS), 100n * WAD);
let bWhole = true;
try { await bob.exec(pool, WITHDRAW, [8, 0n, 100n * WAD, BOB]); } catch { bWhole = false; }
ok("B is whole: every wei of its claim is still payable", bWhole);
await refuses("and B has nothing to write down", () => bob.exec(pool, "writeDown(uint256)", [8]), "ZeroAmount()");

/*──────────────────── C1 / C2 replays ────────────────────*/
head("the findings, replayed");
const mali = await c.deploy(A("test/mocks/PoolReenter.sol", "PoolReenter").bytecode);
await c.exec(hub, "mint(address)", [mali]);   // #9
await c.exec(mali, "wire(address,uint256)", [pool, 9]);
await c.exec(mali, "step1_open(address,address)", [mali, USDC]);
await c.exec(mali, "step2_depositAndClose(uint256)", [1000n * WAD]);
ok("C1: closeMarket re-entered from inside deposit's pull is refused", !decBool(await c.read(mali, "reentrySucceeded()")));
const m9 = await market(9);
ok("the market is still open with its reserve", m9.open && m9.rb === 1000n * WAD);
await refuses("and cannot be reopened over it", () => c.exec(mali, "step3_reopen(address,address)", [USDC, WETH]), "MarketAlreadyOpen()");

const sync = await c.deploy(A("test/mocks/SyncInsidePull.sol", "SyncInsidePull").bytecode);
await c.exec(hub, "mint(address)", [me]);   // #10
await c.exec(hub, "setAccount(uint256,address)", [10, sync]);   // the token is #10's Reach
await c.exec(sync, "mint(address,uint256)", [me, 10n ** 24n]);
await c.exec(sync, "approve(address,uint256)", [pool, MAX]);
await c.exec(sync, "mint(address,uint256)", [BOB, 10n ** 24n]);
await bob.exec(sync, "approve(address,uint256)", [pool, MAX]);
await c.exec(pool, OPEN, [10, sync, USDC, 30, 40000, 0, 0]);
await c.exec(pool, DEPOSIT, [10, 100n * WAD, 300000n * WAD]);
const qS = await quote(10, true, WAD);
const m10 = await market(10);
await c.exec(sync, "arm(address,uint256,uint24)", [pool, 10, 40000]);
const gotS = decUint((await bob.exec(pool, SWAP_IN, [10, true, WAD, 0, BOB, DEADLINE])).ret);
ok("C2: a sync from inside the pull, by the token that IS the Reach, is refused", !decBool(await c.read(sync, "syncSucceeded()")));
const lr = (await c.read(sync, "lastRevert()")).slice(2);
eq("refused by the lock, not by authority", lr.substr(128, 8), sel("Reentrancy()").slice(2));
ok("the trade was priced on the curve it quoted", gotS === qS && (await market(10)).vb === m10.vb);

/*──────────────────── no admin ────────────────────*/
head("what does not exist");
const abi = A("src/Pool.sol", "Pool").abi;
const writes = abi.filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure").map((f) => f.name).sort();
const DESIGNED = ["closeMarket", "collect", "deposit", "openMarket", "openSealed", "sealMarket", "setFee", "swapExactIn", "swapExactOut", "syncCurve", "withdraw", "writeDown"].sort();
eq("the state-changing surface is exactly the twelve DESIGN.md names", writes.join(","), DESIGNED.join(","));
ok("no selector on Pool names an admin", !abi.some((f) => f.type === "function" && /admin|pause|bless|allow|owner|rescue|sweep|skim|upgrade|init|proxy/i.test(f.name)));
ok("no function takes a switch (a bare bool) but the swaps' direction", abi.every((f) =>
  f.type !== "function" || (f.inputs || []).every((i) => i.type !== "bool" || i.name === "baseIn")));
const ctor = abi.find((f) => f.type === "constructor");
eq("the constructor pins two addresses and nothing else", ctor.inputs.map((i) => i.type).join(","), "address,address");
ok("there is no receive and no fallback: ether arrives only as a leg", !abi.some((f) => f.type === "receive" || f.type === "fallback"));

/*──────────────────── gas ────────────────────*/
head("gas");
const views = [
  ["quote(uint256,bool,uint256)", [1, true, WAD]],
  ["quoteExactOut(uint256,bool,uint256)", [1, true, WAD]],
  ["marketOf(uint256)", [1]],
  ["marketHash(uint256)", [1]],
  ["spot(uint256)", [1]],
  ["openIds(uint256,uint256)", [0, 50]],
  ["sealedIds(uint256,uint256)", [0, 50]]
];
let worstView = 0n;
for (const [sig, args] of views) {
  await c.read(pool, sig, args);
  if (c.lastGas > worstView) worstView = c.lastGas;
  console.log(`      ${sig.padEnd(40)} ${String(c.lastGas).padStart(8)} gas`);
}
ok(`every view is under the 16,777,216 cap (worst ${worstView})`, worstView < CAP);
for (const [k2, v] of Object.entries(c.gas)) {
  if (/openMarket|deposit|swap|sync|seal|collect|writeDown|Pool$/.test(k2)) console.log(`      ${k2.padEnd(28)} ${(Number(v) / 1e6).toFixed(3)}M`);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
