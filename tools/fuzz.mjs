#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the market's properties, under random attack

  Origin: IPSEITY tools/fuzz.mjs — the generator, the scoreboard and the
  shrinker verbatim; the properties re-aimed at INTACT's Pool and Curve.
  The Foundry-shaped suite states the same properties as `testFuzz_`
  functions and tools/forge.mjs runs them at 24 inputs each; this runs
  them at hundreds, with a generator that goes looking for the edges.

  This is not a re-implementation of the properties in JavaScript: every
  assertion below calls the real Solidity, and the arithmetic under test is
  the arithmetic that would be deployed. What JavaScript does is choose
  hostile inputs and keep score.

  ── what it does that forge does not ──

  The generator is a seeded PRNG and the seed is printed on every run, so a
  failure is reproducible by anyone with the seed rather than only by
  whoever happened to hit it. On failure it shrinks: the failing input is
  repeatedly simplified — halved, zeroed, truncated — for as long as it
  keeps failing, so what gets printed is a small case rather than the
  256-bit number that happened to trip it.

  ── the nine market properties (BUILD-PLAN U3) ──

  Pure, through test/mocks/PoolFixtures.sol:CurveProbe, at reserves drawn
  from {1, 2, 9, 2^64, 2^112−1, random} on each side:

    1  the anchor is bounded by eight times the reserve; steeper is refused
    2  more in never means less out
    3  the quote never exceeds the reserve it is priced against
    4  k never falls, measured against the offsets the market anchored
    5  a round trip never profits, at any concentration, size or direction
    6  exact-out never under-charges, and is the inverse of exact-in

  Live, against the Pool with markets at 9 wei, 2^64 and 2^112 a side and
  one with a native leg:

    7  a live swap never lowers the invariant, at any curve a holder can sync
    8  buying and selling straight back never comes out ahead — exact in,
       exact out, native legs, dust
    9  the pool never pays out more than it holds, and never another
       market's reserves

  The sizes 0, 1, 2 and 9 wei and 2^64 and 2^112 are in the generator's
  edge set, so a quarter of every draw is one of them.

    node tools/fuzz.mjs                 256 runs per property
    node tools/fuzz.mjs --runs 2000     more
    node tools/fuzz.mjs --seed 12345    reproduce a reported failure
───────────────────────────────────────────────────────────────────────────*/
import { compile, artifact } from "./compile.mjs";
import { Chain, decUint, encodeAddressArg, encodeParams } from "./evm.mjs";

/*──────────────── the dice ────────────────*/

const arg = (name, dflt) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const RUNS = Number(arg("runs", 256));
const SEED = BigInt(arg("seed", String(Math.floor(Math.random() * 2 ** 31))));

/* xoshiro-ish: small, deterministic, and good enough to find edges. The
   point is reproducibility, not cryptography. */
let s0 = SEED ^ 0x9e3779b97f4a7c15n, s1 = SEED * 0xbf58476d1ce4e5b9n + 1n;
const M = (1n << 64n) - 1n;
function next() {
  s1 = (s1 ^ (s1 << 13n)) & M;
  s1 = s1 ^ (s1 >> 7n);
  s1 = (s1 ^ (s1 << 17n)) & M;
  s0 = (s0 + 0x9e3779b97f4a7c15n) & M;
  return (s0 ^ s1) & M;
}

/// @notice A 256-bit draw, built from four 64-bit ones.
function rand256() {
  let v = 0n;
  for (let i = 0; i < 4; i++) v = (v << 64n) | next();
  return v;
}

/* Uniform sampling never finds the interesting inputs. A quarter of every
   draw is pulled from the edges of the range instead — the values a human
   would try first and a uniform generator would take millions of runs to
   reach: the ends, one past them, the middle, and the sizes this unit's
   done-criterion names. */
const NAMED = [0n, 1n, 2n, 9n, 2n ** 64n, 2n ** 112n, 2n ** 112n - 1n];
function pick(lo, hi) {
  lo = BigInt(lo); hi = BigInt(hi);
  if (hi <= lo) return lo;
  const span = hi - lo + 1n;
  const r = next() % 4n;
  if (r === 0n) {
    const edges = [lo, lo + 1n, hi, hi - 1n, (lo + hi) / 2n, ...NAMED.filter((x) => x >= lo && x <= hi)];
    return edges[Number(next() % BigInt(edges.length))];
  }
  return lo + (rand256() % span);
}
const bool = () => (next() & 1n) === 1n;
/// A reserve: one of the named tiers, or anything.
const TIERS = [1n, 2n, 9n, 2n ** 64n, 2n ** 112n - 1n];
const tier = () => (next() % 2n === 0n ? TIERS[Number(next() % BigInt(TIERS.length))] : pick(1n, 2n ** 112n - 1n));

/*──────────────── the scoreboard ────────────────*/

let pass = 0, fail = 0;
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);

/*  Shrinking: keep the failure, make the input smaller. Each candidate is
    re-run, and it is only kept if it still fails — so what is reported is
    never a different bug from the one that was found. */
function shrinkCandidates(v) {
  if (typeof v === "bigint") {
    const out = [];
    if (v > 0n) out.push(0n, 1n, v / 2n, v - 1n);
    return out.filter((x) => x >= 0n && x !== v);
  }
  if (typeof v === "boolean") return [!v];
  if (Array.isArray(v)) {
    const out = [];
    for (let i = 0; i < v.length; i++) {
      for (const c of shrinkCandidates(v[i])) {
        const copy = v.slice(); copy[i] = c; out.push(copy);
      }
    }
    if (v.length > 1) out.push(v.slice(0, Math.floor(v.length / 2)));
    return out;
  }
  return [];
}

async function property(name, gen, check, runs = RUNS) {
  let counterexample = null, why = "";
  for (let i = 0; i < runs && !counterexample; i++) {
    const input = gen();
    try {
      const r = await check(input);
      if (r === false) { counterexample = input; why = "the property did not hold"; }
      else if (typeof r === "string") { counterexample = input; why = r; }
    } catch (e) {
      counterexample = input;
      why = "threw: " + String(e.message || e).slice(0, 120);
    }
  }

  if (!counterexample) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}  \x1b[2m${runs} runs\x1b[0m`);
    return;
  }

  // shrink for as long as a smaller input still fails
  let best = counterexample, moved = true, budget = 300;
  while (moved && budget-- > 0) {
    moved = false;
    for (const cand of shrinkCandidates(best)) {
      if (budget-- <= 0) break;
      let failed = false;
      try {
        const r = await check(cand);
        failed = r === false || typeof r === "string";
      } catch { failed = true; }
      if (failed) { best = cand; moved = true; break; }
    }
  }

  fail++;
  console.log(`  \x1b[31m✗\x1b[0m ${name}`);
  console.log(`      ${why}`);
  console.log(`      shrunk to ${JSON.stringify(best, (_, x) => typeof x === "bigint" ? x.toString() : x)}`);
  console.log(`      reproduce with --seed ${SEED}`);
}

/*──────────────── the world ────────────────*/

const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const me = c.from.toString();
const WAD = 10n ** 18n;
const FOREVER = 2n ** 40n;
const MAX = 2n ** 255n;
const ZERO = "0x" + "00".repeat(20);
const BPS = 10_000n;

console.log(`\n  \x1b[1mINTACT · the market's properties\x1b[0m   seed ${SEED}   ${RUNS} runs each`);

const probe = await c.deploy(A("test/mocks/PoolFixtures.sol", "CurveProbe").bytecode);
const hub = await c.deploy(A("test/mocks/PoolFixtures.sol", "PoolHub").bytecode);
const pool = await c.deploy(A("src/Pool.sol", "Pool").bytecode, encodeAddressArg(hub) + encodeAddressArg(me));
const MAX_CONC = decUint(await c.read(probe, "MAX_CONCENTRATION()"));
const MAX_RESERVE = decUint(await c.read(probe, "MAX_RESERVE()"));

const anchorOf = async (bps, rB, rQ) => {
  const r = await c.read(probe, "anchor(uint256,uint256,uint256)", [bps, rB, rQ]);
  return [decUint(r, 0), decUint(r, 1)];
};
const outOf = (a, ri, ro, vi, vo, fee) =>
  c.read(probe, "amountOut(uint256,uint256,uint256,uint256,uint256,uint256)", [a, ri, ro, vi, vo, fee]).then(decUint);
const inOf = (o, ri, ro, vi, vo, fee) =>
  c.read(probe, "amountIn(uint256,uint256,uint256,uint256,uint256,uint256)", [o, ri, ro, vi, vo, fee]).then(decUint);
/// A refusal from the library is a legal answer to an input with no answer
/// (nothing in, nothing out, or a reserve the trade would empty).
const refused = (e) => /revert/.test(String(e.message || e));

/*═══════════════════ the curve, as pure arithmetic ═══════════════════*/
head("the curve");

await property("1  the anchor is bounded by eight times the reserve, and a steeper curve is refused",
  () => [pick(0, MAX_CONC + 1000n), tier(), tier()],
  async ([bps, rb, rq]) => {
    if (bps > MAX_CONC) {
      try { await anchorOf(bps, rb, rq); } catch (e) { return refused(e) ? true : "wrong refusal"; }
      return `a concentration of ${bps} bps was accepted`;
    }
    const [vb, vq] = await anchorOf(bps, rb, rq);
    if (vb !== rb * bps / BPS || vq !== rq * bps / BPS) return "the anchor is not reserve × bps / 10000";
    if (vb > rb * 8n || vq > rq * 8n) return "an offset exceeds eight times its reserve";
    if (vb >= 2n ** 128n || vq >= 2n ** 128n) return "an offset does not fit its uint128";
    return true;
  });

await property("2  more in never means less out, at any reserve, curve and fee",
  () => [tier(), tier(), pick(0, MAX_CONC), pick(0, 9500), rand256(), rand256()],
  async ([rIn, rOut, bps, fee, x, y]) => {
    if (rIn === 0n || rOut === 0n) return true;
    let a = 1n + x % rIn, b = 1n + y % rIn;
    if (a > b) [a, b] = [b, a];
    const [vIn, vOut] = await anchorOf(bps, rIn, rOut);
    const [oa, ob] = [await outOf(a, rIn, rOut, vIn, vOut, fee), await outOf(b, rIn, rOut, vIn, vOut, fee)];
    if (oa > ob) return `${a} got ${oa} out but the larger ${b} got only ${ob}`;
    return true;
  });

await property("3  the quote never exceeds the reserve it is priced against",
  () => [tier(), tier(), pick(0, MAX_CONC), pick(0, 9500), pick(1n, 2n ** 120n)],
  async ([rIn, rOut, bps, fee, amt]) => {
    if (rIn === 0n || rOut === 0n || amt === 0n) return true;
    const [vIn, vOut] = await anchorOf(bps, rIn, rOut);
    const o = await outOf(amt, rIn, rOut, vIn, vOut, fee);
    if (o >= rOut + vOut) return `quoted ${o} against a priced reserve of ${rOut + vOut}`;
    return true;
  });

/*  Two different things get called "the invariant" here, and conflating
    them is how a curve with virtual reserves gets misread. `amountOut`
    prices against the offsets as anchored and preserves k with respect to
    those. A pool that recomputed its offsets from the new reserves after
    every trade measured a different quantity, and that one is not
    conserved — it fell on a single large trade at high concentration, and
    a round trip extracted the difference (400 in, 718 out). The offsets
    are anchored now; these two properties measure what the pool conserves.

    An owned market credits the whole input to its reserve; a sealed one
    credits the input net of ceil(in · fee / 10000). Both are checked. */
await property("4  k never falls, measured against the offsets the market anchored",
  () => [tier(), tier(), pick(0, MAX_CONC), pick(0, 9500), rand256(), bool()],
  async ([rIn, rOut, bps, fee, x, sealed]) => {
    if (rIn === 0n || rOut === 0n) return true;                 // no market; the shrinker gets here
    const amt = 1n + x % (rIn * 4n);
    const [vIn, vOut] = await anchorOf(bps, rIn, rOut);
    const o = await outOf(amt, rIn, rOut, vIn, vOut, fee);
    // the curve prices against liquidity the pool does not hold; above half
    // the real reserve the Pool refuses the trade (MAX_OUT_BPS), so k is
    // only a claim about the trades that happen
    if (o * 2n > rOut) return true;
    const credited = sealed ? amt - (amt * fee + BPS - 1n) / BPS : amt;
    const before = (rIn + vIn) * (rOut + vOut);
    const after = (rIn + vIn + credited) * (rOut + vOut - o);
    if (after < before) return `k fell from ${before} to ${after}`;
    return true;
  });

/*  The property that caught it. Buy, then sell straight back along the same
    anchored curve, from the reserves the first trade left — which is what a
    market that does not re-anchor on a trade actually offers. In both
    directions, because the fee and the rounding are not symmetric. */
await property("5  a round trip never profits, at any concentration, at any size, in either direction",
  () => [tier(), tier(), pick(0, MAX_CONC), pick(0, 9500), rand256(), bool()],
  async ([rb, rq, bps, fee, x, baseFirst]) => {
    if (rb === 0n || rq === 0n) return true;
    const [vb, vq] = await anchorOf(bps, rb, rq);
    const [rIn, rOut, vIn, vOut] = baseFirst ? [rb, rq, vb, vq] : [rq, rb, vq, vb];
    const amt = 1n + x % (rIn * 2n);
    const got = await outOf(amt, rIn, rOut, vIn, vOut, fee);
    if (got === 0n || got * 2n > rOut) return true;          // nothing came out, or the pool would refuse it
    const back = await outOf(got, rOut - got, rIn + amt, vOut, vIn, fee);
    if (back > amt) return `put in ${amt}, got ${back} back — a profit of ${back - amt}`;
    return true;
  });

await property("6  exact-out never under-charges, and is the inverse of exact-in",
  () => [tier(), tier(), pick(0, MAX_CONC), pick(0, 9500), rand256()],
  async ([rIn, rOut, bps, fee, x]) => {
    if (rIn === 0n || rOut === 0n) return true;
    const [vIn, vOut] = await anchorOf(bps, rIn, rOut);
    const amt = 1n + x % rIn;
    const o = await outOf(amt, rIn, rOut, vIn, vOut, fee);
    if (o === 0n) return true;
    const back = await inOf(o, rIn, rOut, vIn, vOut, fee);
    if (back > amt) return `exact-out asks ${back} for what ${amt} bought`;
    const again = await outOf(back, rIn, rOut, vIn, vOut, fee);
    if (again < o) return `the input exact-out names (${back}) buys ${again}, not the ${o} asked`;
    return true;
  });

/*═══════════════════ the market, as a live pool ═══════════════════*/
head("the market");

const mkToken = (name, sym) =>
  c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode, encodeParams("string,string,uint8,uint256,bool", [name, sym, 18, 0, false]));
const BASE = await mkToken("Base", "BASE");
const QUOTE = await mkToken("Quote", "QUOTE");
for (const t of [BASE, QUOTE]) {
  await c.exec(t, "mint(address,uint256)", [me, 2n ** 200n]);
  await c.exec(t, "approve(address,uint256)", [pool, MAX]);
}
await c.fund(me, 2n ** 120n);

const OPEN = "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)";
const DEPOSIT = "deposit(uint256,uint256,uint256)";
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";
const SWAP_OUT = "swapExactOut(uint256,bool,uint256,uint256,address,uint64)";
const SYNC = "syncCurve(uint256,uint24,uint24)";

/* Four markets: the ordinary one, a 9-wei one, a 2^64 one, a 2^112 one, and
   a fifth with a native quote — so "at 0/1/2/9 wei and 2^64/2^112" is a
   statement about live reserves, not only about the arithmetic. */
const MARKETS = [];
const openAt = async (quote, rb, rq, value) => {
  const id = Number(decUint((await c.exec(hub, "mint(address)", [me])).ret));
  await c.exec(pool, OPEN, [id, BASE, quote, 30, 0, 0, 0]);
  await c.exec(pool, DEPOSIT, [id, rb, rq], { value });
  MARKETS.push({ id, native: quote === ZERO });
  return id;
};
await openAt(QUOTE, 1_000_000n * WAD, 3_000_000n * WAD, 0n);
await openAt(QUOTE, 9n, 9n, 0n);
await openAt(QUOTE, 2n ** 64n, 2n ** 64n, 0n);
await openAt(QUOTE, MAX_RESERVE, MAX_RESERVE, 0n);
await openAt(ZERO, 1_000n * WAD, 1_000n * WAD, 1_000n * WAD);
const anyMarket = () => MARKETS[Number(next() % BigInt(MARKETS.length))];

const market = async (id) => {
  const m = await c.read(pool, "marketOf(uint256)", [id]);
  return { rb: decUint(m, 2), rq: decUint(m, 3), curve: decUint(m, 10), vb: decUint(m, 11), vq: decUint(m, 12) };
};
const k = async (id) => {
  const m = await market(id);
  return (m.rb + m.vb) * (m.rq + m.vq);
};
const bal = (token, who) => token === ZERO ? c.balanceOf(who) : c.read(token, "balanceOf(address)", [who]).then(decUint);
const reserved = (token) => c.read(pool, "totalReserved(address)", [token]).then(decUint);
const sync = async (id, bps) => c.exec(pool, SYNC, [id, bps, (await market(id)).curve]);

await property("7  a live swap never lowers the invariant, at any curve a holder can sync",
  () => [pick(0, MAX_CONC), bool(), bool(), rand256()],
  async (v) => {
    const { id, native } = anyMarket();
    const [bps, baseIn, exactOut] = [BigInt(v[0]), v[1], v[2]];
    await sync(id, bps);
    const m = await market(id);
    const rIn = baseIn ? m.rb : m.rq, rOut = baseIn ? m.rq : m.rb;
    const before = await k(id);
    try {
      if (exactOut) {
        const want = 1n + BigInt(v[3]) % (rOut / 2n + 1n);
        const maxIn = rIn * 100n;
        await c.exec(pool, SWAP_OUT, [id, baseIn, want, maxIn, me, FOREVER], { value: native && !baseIn ? maxIn : 0n });
      } else {
        const amount = 1n + BigInt(v[3]) % (rIn / 3n + 1n);
        await c.exec(pool, SWAP_IN, [id, baseIn, amount, 0, me, FOREVER], { value: native && !baseIn ? amount : 0n });
      }
    } catch {
      const after = await k(id);
      if (after !== before) return "a refused trade still moved the reserves";
      return true;
    }
    const after = await k(id);
    if (after < before) return `the invariant fell from ${before} to ${after} on market ${id}`;
    return true;
  }, Math.max(24, Math.floor(RUNS / 4)));

await property("8  buying and selling straight back never comes out ahead — exact in, exact out, native legs, dust",
  () => [pick(0, MAX_CONC), rand256(), bool(), bool(), bool()],
  async (v) => {
    const { id, native } = anyMarket();
    const [bps, x, baseFirst, outFirst, outSecond] = [BigInt(v[0]), BigInt(v[1]), v[2], v[3], v[4]];
    await sync(id, bps);
    const m = await market(id);
    const rIn = baseFirst ? m.rb : m.rq;
    const amount = 1n + x % (rIn / 4n + 1n);
    const quoteTok = native ? ZERO : QUOTE;
    const tokA = baseFirst ? BASE : quoteTok;
    const start = await bal(tokA, me);
    let got = 0n, gasA = 0n, gasB = 0n;
    try {
      if (outFirst) {
        const want = decUint(await c.read(pool, "quote(uint256,bool,uint256)", [id, baseFirst, amount]));
        const r = await c.exec(pool, SWAP_OUT, [id, baseFirst, want, amount, me, FOREVER], { value: native && !baseFirst ? amount : 0n });
        got = want; gasA = r.gas;
      } else {
        const r = await c.exec(pool, SWAP_IN, [id, baseFirst, amount, 0, me, FOREVER], { value: native && !baseFirst ? amount : 0n });
        got = decUint(r.ret); gasA = r.gas;
      }
    } catch { return true; }
    if (got === 0n) return true;
    try {
      if (outSecond) {
        const back = decUint(await c.read(pool, "quote(uint256,bool,uint256)", [id, !baseFirst, got]));
        const r = await c.exec(pool, SWAP_OUT, [id, !baseFirst, back, got, me, FOREVER], { value: native && baseFirst ? got : 0n });
        gasB = r.gas;
      } else {
        const r = await c.exec(pool, SWAP_IN, [id, !baseFirst, got, 0, me, FOREVER], { value: native && baseFirst ? got : 0n });
        gasB = r.gas;
      }
    } catch { return true; }
    // a native leg also paid gas at 10 wei a unit; add it back so the
    // comparison is about the curve and not the fee market
    const end = (await bal(tokA, me)) + (tokA === ZERO ? (gasA + gasB) * 10n : 0n);
    if (end > start) return `a round trip on market ${id} made ${end - start} out of nothing`;
    return true;
  }, Math.max(24, Math.floor(RUNS / 4)));

await property("9  the pool never pays out more than it holds, and never another market's reserves",
  () => [pick(1, 2n ** 120n), bool(), bool()],
  async (v) => {
    const { id, native } = anyMarket();
    const [amt, baseIn, exactOut] = [BigInt(v[0]), v[1], v[2]];
    const m = await market(id);
    const held = baseIn ? m.rq : m.rb;
    const tokOut = baseIn ? (native ? ZERO : QUOTE) : BASE;
    const tokIn = baseIn ? BASE : (native ? ZERO : QUOTE);
    const others = (await reserved(tokOut)) - held;
    const poolBefore = await bal(tokOut, pool);
    try {
      if (exactOut) {
        await c.exec(pool, SWAP_OUT, [id, baseIn, amt, MAX, me, FOREVER], { value: tokIn === ZERO ? 2n ** 100n : 0n });
        if (amt * 2n > held) return `exact-out paid ${amt} while holding ${held}`;
      } else {
        const r = await c.exec(pool, SWAP_IN, [id, baseIn, amt, 0, me, FOREVER], { value: tokIn === ZERO ? amt : 0n });
        const o = decUint(r.ret);
        if (o * 2n > held) return `paid out ${o} while holding ${held}`;
      }
    } catch { /* refusing an oversized trade is the correct outcome */ }
    const poolAfter = await bal(tokOut, pool);
    if (poolAfter < others) return `the pool now holds ${poolAfter} of a token other markets are owed ${others} of`;
    if (poolAfter < (await reserved(tokOut))) return "the balance fell below the books";
    return true;
  }, Math.max(24, Math.floor(RUNS / 4)));

/*──────────────── the tally ────────────────*/
console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} properties held, ${fail} broken\x1b[0m`);
console.log(`  \x1b[2mseed ${SEED} — pass --seed ${SEED} to run exactly this again\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
