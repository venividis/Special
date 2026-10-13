#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · seven motives for two hundred and twenty ticks

  Origin: IPSEITY tools/agents.mjs (holder, arbitrageur, whale, shrimp,
  sandwicher, griefer, renter against the real contracts, re-checking
  conservation, the invariant, the bond and the seal after every tick).
  INTACT (U12) keeps the shape — seeded, every actor a motive rather than a
  script, every invariant checked after every tick — over the whole MVB
  bundle at once: the real hub (the ship build), three owned markets and a
  graduated sealed market on the Pool, a raise on the Launchpad, the
  commons and a priced inbox on Parley and Postage, and a session key on a
  Reach that is sold and bought back under it.

  The motives:

    trader        trades a random market in a random direction, exact-in or
                  exact-out, with the floor it chose
    arbitrageur   buys and sells straight back, and must never come out ahead
    sniper        buys the raise inside the fair window (and pays the tax),
                  graduates it the moment it may, and claims
    spammer       speaks in the commons every tick and once more in the same
                  block, so the brake fires every time
    drainer       holds a session key on #1's Reach and tries, in rotation,
                  every way to move the Reach's assets through it
    flipper       buys #1 mid-flow, re-arms it, re-grants the drainer, speaks
                  at once, deposits, seals, tries to withdraw under the seal,
                  and sells it back — the sale and the buy-back under a live
                  session, a bound key, a priced inbox
    griefer       stamps the priced inbox, lets stamps lapse, expires them,
                  claims refunds, and collects the sealed market's fees to
                  wherever feeSink says

  After EVERY tick the invariants are read from the chain and asserted: k
  never fell on any market across a trade (checked around every trade);
  every token's totalReserved equals the sum of the markets' claims in it
  and never exceeds the Pool's balance; the market seal and the Reach seal
  only lengthen; a sold token's session is dead (its epoch is not the
  token's); exactly one of settled/refunded per stamp, or neither while it
  is the pair's pending one; the sniper tax plus the fee never reach 99 %;
  the raise's coin never moves to a buyer before graduation; the seller's
  rightsOf carries nothing after a sale; the spammer's second word in a
  block is refused; the sealed Reach's manifest never shrinks and the
  drainer's take never passes its cap.

  A break stops the run and names the tick, the seed and the motive, so
  `--seed` reproduces it. The default run stays under two minutes.

    node tools/agents.mjs                        220 ticks, a fresh seed (printed)
    node tools/agents.mjs --ticks 60 --seed 7    reproduce
───────────────────────────────────────────────────────────────────────────*/
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { compile, artifact } from "./compile.mjs";
import { Chain, enc, sel, encodeParams, decUint, decAddr, decBool, warp, roll, BLOCK } from "./evm.mjs";
import { deploySite, mint, ZERO } from "./site.mjs";

/*──────────────── dials ────────────────*/
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const TICKS = Number(arg("ticks", 220));
const SEED = BigInt(arg("seed", String(Date.now() % 1_000_000_007)));
let s0 = SEED ^ 0x9e3779b97f4a7c15n, s1 = SEED * 0xbf58476d1ce4e5b9n + 1n;
const M64 = (1n << 64n) - 1n;
const next = () => { s1 = (s1 ^ (s1 << 13n)) & M64; s1 ^= s1 >> 7n; s1 = (s1 ^ (s1 << 17n)) & M64; s0 = (s0 + 0x9e3779b97f4a7c15n) & M64; return (s0 ^ s1) & M64; };
const rnd = (n) => Number(next() % BigInt(n));                       // 0 .. n-1
const pick = (xs) => xs[rnd(xs.length)];
const between = (lo, hi) => lo + (next() % (hi - lo + 1n));           // BigInt in [lo, hi]

/*──────────────── the roll ────────────────*/
let pass = 0, fail = 0;
let tick = 0, motive = "setup";
const counts = {};
const count = (who, what) => { counts[who] = counts[who] || {}; counts[who][what] = (counts[who][what] || 0) + 1; };
class Broken extends Error {}
/// The invariants, by the sentence that names each; `held[name]` counts the
/// ticks (or trades, or stamps) it was read true on. A false reading ends
/// the run with the tick, the seed and the motive named.
const held = {};
const hold = (cond, name, detail) => {
  if (cond) { pass++; held[name] = (held[name] || 0) + 1; return; }
  fail++;
  throw new Broken(`"${name}" did not hold${detail !== undefined ? " — " + String(detail).slice(0, 300) : ""}`);
};
const W = 10n ** 18n;
const FOREVER = (1n << 64n) - 1n;
const MAX = 1n << 255n;
const now = () => BLOCK.header.timestamp;
const low = (a) => String(a).toLowerCase();
const same = (a, b) => low(a) === low(b);
const kec = (b) => "0x" + Buffer.from(keccak256(b)).toString("hex");

/// A transaction that may legitimately be refused: the selector it reverted with, or ok.
async function tryTx(who, fn) {
  try { const r = await fn(); count(who, "ok"); return { ok: true, r }; }
  catch (e) {
    const m = String(e.message).match(/data=(0x[0-9a-f]*)/i);
    const s = m ? m[1].slice(0, 10) : "0x";
    const name = ERR[s] || s;
    count(who, "refused:" + name);
    return { ok: false, sel: s, name, msg: String(e.message) };
  }
}

/*──────────────── the world ────────────────*/
console.log(`\n  \x1b[1mINTACT · agents\x1b[0m  seed ${SEED}  ticks ${TICKS}`);
const T0 = Date.now();
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const site = await deploySite(c, out);
const { hub, pool, parley, postage, keys, kiln, launchpad } = site;
const me = c.from.toString();

/// Every custom error of the contracts, by selector, so a refusal prints its name.
const ERR = {};
for (const file of Object.keys(out.contracts)) {
  for (const cn of Object.keys(out.contracts[file])) {
    for (const e of out.contracts[file][cn].abi || []) {
      if (e.type === "error") ERR[sel(e.name + "(" + e.inputs.map((i) => i.type).join(",") + ")")] = e.name;
    }
  }
}

const actors = {};
for (const [name, k] of [["trader", "71"], ["arbitrageur", "a1"], ["sniper", "5e"], ["spammer", "5a"], ["drainer", "d1"], ["flipper", "f1"], ["griefer", "61"], ["holder", "40"]]) {
  actors[name] = await c.as("0x" + k.repeat(32), 10n ** 22n);
}
const { trader, arbitrageur, sniper, spammer, drainer, flipper, griefer, holder } = actors;
const addr = (a) => a.from.toString();

const erc20 = (name, sym, dec, feeBps) => c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode,
  encodeParams("string,string,uint8,uint256,bool", [name, sym, dec, feeBps, false]), name);
const GOLD = await erc20("Gold", "GOLD", 18, 0);
const USDC = await erc20("USD Coin", "USDC", 6, 0);
const FEE = await erc20("Taxed", "TAX", 18, 100);        // 1 % on every transfer
const SILVER = await erc20("Silver", "SLVR", 18, 0);
const TOKENS = { GOLD, USDC, FEE, SILVER, ETH: ZERO };

const mintTo = async (who) => (await mint(c, site, addr(who))).id;
const H1 = await mintTo(holder);     // the flipped token: market GOLD/ETH, the drainer's session, a bound key, a priced inbox
const H2 = await mintTo(griefer);    // market GOLD/USDC (GOLD shared with #1's), the griefer's voice
const H3 = await mintTo(spammer);    // market TAX/USDC, the priced inbox the griefer stamps
const H4 = await mintTo(holder);     // the raise
const reach1 = decAddr(await c.read(hub, "account(uint256)", [H1]));
const reach4 = decAddr(await c.read(hub, "account(uint256)", [H4]));

const OPEN = "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)";
const DEPOSIT = "deposit(uint256,uint256,uint256)";
const WITHDRAW = "withdraw(uint256,uint256,uint256,address)";
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";
const SWAP_OUT = "swapExactOut(uint256,bool,uint256,uint256,address,uint64)";
const EXEC = "execute(address,uint256,bytes,uint8)";
const AS_SESSION = "executeAsSession(address,uint256,bytes)";
const GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";
const SPEAK = "speak(uint256,uint256,uint8,uint64,uint64,bytes)";
const WHISPER = "whisper(uint256,uint256,uint8,bytes32,bytes)";
const STAMPED = "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)";
const XFER = sel("transfer(address,uint256)");
const hex = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");

const fund = async (token, who, amount) => { await c.exec(token, "mint(address,uint256)", [addr(who), amount]); };
const approve = async (who, token, spender) => { await who.exec(token, "approve(address,uint256)", [spender, MAX]); };
for (const who of [trader, arbitrageur, holder, griefer, spammer, flipper, sniper]) {
  await fund(GOLD, who, 100_000n * W); await fund(USDC, who, 100_000n * 10n ** 6n); await fund(FEE, who, 100_000n * W);
  for (const t of [GOLD, USDC, FEE]) await approve(who, t, pool);
}

/*── three owned markets ──*/
await holder.exec(pool, OPEN, [H1, GOLD, ZERO, 30, 20_000, 0, 0]);
await holder.exec(pool, DEPOSIT, [H1, 1_000n * W, 100n * W], { value: 100n * W });
await griefer.exec(pool, OPEN, [H2, GOLD, USDC, 50, 0, 3_000, 1_800]);          // a sniper fee for 30 minutes
await griefer.exec(pool, DEPOSIT, [H2, 2_000n * W, 6_000n * 10n ** 6n]);
await spammer.exec(pool, OPEN, [H3, FEE, USDC, 100, 40_000, 0, 0]);
await spammer.exec(pool, DEPOSIT, [H3, 5_000n * W, 5_000n * 10n ** 6n]);

/*── the raise on #4 ──*/
const SUPPLY = 1_000_000_000n * W, RAISE = 900_000_000n * W, CURVE = 700_000_000n * W;
const LAUNCH = "launch(uint256,string,string,uint8,uint256,bytes32,uint256)";
await holder.exec(kiln, LAUNCH, [H4, "Agent Four", "AGENT4", 18, SUPPLY, "0x" + "04".padStart(64, "0"), RAISE]);
const LAUNCHED = kec(Buffer.from("Launched(address,uint256,address,string,uint256,uint256)"));
const coin = "0x" + c.getLogs({ address: kiln, topics: [LAUNCHED] }).pop().topics[1].slice(26);
const PARAMS = "(uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8)";
const FAIR = 600n;
const params = [H4, coin, CURVE, W, 3n * W, 0n, FAIR, W / 2n, 5_000, 100, 1_000, 0, now() + 7n * 86400n, 0];
await holder.exec(launchpad, `create(${PARAMS})`, [params]);
const L = decUint(c.getLogs({ address: launchpad, topics: [kec(Buffer.from("LaunchCreated(uint256,uint256,address,uint8,bytes32)"))] }).pop().topics[1]);
let sealedKey = null;      // the sealed market once graduated
let graduated = false;

/*── #1: a key bound, an inbox priced, SILVER on the manifest, sealed, and the drainer's session ──*/
await holder.exec(keys, "setEncryptionKey(uint16,bytes)", [3, "0x04aa"]);
await holder.exec(parley, "bindKey(uint256)", [H1]);
await holder.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)", [H1, USDC, 1_000_000n, 300n, true]);
await c.exec(GOLD, "mint(address,uint256)", [reach1, 1_000n * W]);
await c.exec(SILVER, "mint(address,uint256)", [reach1, 1_000n * W]);
await c.send({ to: reach1, value: 10n * W });
await holder.exec(reach1, "guard(address)", [SILVER]);
await holder.exec(reach1, "seal(uint64)", [now() + 30n * 86400n]);
const GOLD_CAP = 50n * W;
const grantDrainer = (who) => who.exec(reach1, GRANT, [addr(drainer), now() + 86400n, 0n, [[GOLD, GOLD_CAP]], [GOLD], [XFER], 0, 0]);
await grantDrainer(holder);
let drainerEpoch = decUint(await c.read(hub, "custodyEpoch(uint256)", [H1]));   // the epoch the live grant was made in
let goldOutCap = GOLD_CAP;                                                        // the cap the live grant carries
let goldOut = 0n;                                                                 // what the drainer has moved under it

/*── #3: the inbox the griefer stamps, priced in USDC; #2's Reach pays, so it holds USDC and approves Postage ──*/
await spammer.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)", [H3, USDC, 2_000_000n, 300n, true]);
const reach2 = decAddr(await c.read(hub, "account(uint256)", [H2]));
await c.exec(USDC, "mint(address,uint256)", [reach2, 10_000n * 10n ** 6n]);
await griefer.exec(reach2, EXEC, [USDC, 0, enc("approve(address,uint256)", [postage, MAX]), 0]);
const ROOM23 = decUint(await c.read(parley, "pairKey(uint256,uint256)", [H2, H3]));

console.log(`      \x1b[2mhub ${hub} · markets #${H1} GOLD/ETH, #${H2} GOLD/USDC (sniper fee), #${H3} TAX/USDC · raise ${L} on #${H4} (${coin.slice(0, 10)}…) · world in ${((Date.now() - T0) / 1000).toFixed(1)}s\x1b[0m`);

/*──────────────── reads ────────────────*/
const market = async (key) => {
  const r = await c.read(pool, "marketOf(uint256)", [key]);
  return { base: decAddr(r, 0), quote: decAddr(r, 1), rb: decUint(r, 2), rq: decUint(r, 3), fee: decUint(r, 4), open: decBool(r, 7),
           sealedMarket: decBool(r, 8), sealUntil: decUint(r, 9), vb: decUint(r, 11), vq: decUint(r, 12), fbo: decUint(r, 13), fqo: decUint(r, 14) };
};
const kOf = (m) => (m.rb + m.vb) * (m.rq + m.vq);
const balance = async (token, who) => token === ZERO ? c.balanceOf(who) : decUint(await c.read(token, "balanceOf(address)", [who]));
const marketKeys = () => [H1, H2, H3, ...(graduated ? [sealedKey] : [])];
const bitsOf = async (id, who) => decUint(await c.read(hub, "rightsOf(uint256,address)", [id, who]), 0);
const epochOf = async (id) => decUint(await c.read(hub, "custodyEpoch(uint256)", [id]));
const launch = async () => { const r = await c.read(launchpad, "launchOf(uint256)", [L]); return { state: decUint(r, 3), raised: decUint(r, 9), fairEnds: decUint(r, 11), feeBps: decUint(r, 15) }; };

/*──────────────── a trade, with k read around it ────────────────*/
async function trade(who, key, baseIn, exactOut, label) {
  const before = await market(key);
  if (!before.open) return;
  const tokenIn = baseIn ? before.base : before.quote;
  const rIn = baseIn ? before.rb : before.rq, rOut = baseIn ? before.rq : before.rb;
  if (rIn === 0n || rOut === 0n) return;
  const k0 = kOf(before);
  let r;
  if (!exactOut) {
    const amountIn = rIn / BigInt(50 + rnd(150));                     // 0.5 % .. 2 % of the in-reserve
    if (amountIn === 0n) return;
    r = await tryTx(label, () => who.exec(pool, SWAP_IN, [key, baseIn, amountIn, 0, addr(who), FOREVER], { value: tokenIn === ZERO ? amountIn : 0n }));
  } else {
    const amountOut = rOut / BigInt(100 + rnd(300));
    if (amountOut === 0n) return;
    const maxIn = tokenIn === ZERO ? rIn / 10n : rIn;                // a native exact-out sends maxIn and gets the rest back
    r = await tryTx(label, () => who.exec(pool, SWAP_OUT, [key, baseIn, amountOut, maxIn, addr(who), FOREVER], { value: tokenIn === ZERO ? maxIn : 0n }));
  }
  const after = await market(key);
  hold(kOf(after) >= k0, "k never falls on any market across a trade", `market ${key}, ${exactOut ? "swapExactOut" : "swapExactIn"} by the ${label}: ${k0} → ${kOf(after)}`);
  hold(after.vb === before.vb && after.vq === before.vq, "a trade moves along the curve and never moves the anchors", `market ${key}: ${before.vb}/${before.vq} → ${after.vb}/${after.vq}`);
  return r;
}

/*──────────────── the motives ────────────────*/
const motives = {
  async trader() {
    const key = pick(marketKeys());
    await trade(trader, key, rnd(2) === 0, rnd(10) < 3, "trader");
  },

  async arbitrageur() {
    const key = pick(marketKeys());
    const m = await market(key);
    if (!m.open || m.rb === 0n || m.rq === 0n) return;
    const baseIn = rnd(2) === 0;
    const tokenIn = baseIn ? m.base : m.quote, tokenOut = baseIn ? m.quote : m.base;
    const amountIn = (baseIn ? m.rb : m.rq) / BigInt(30 + rnd(100));
    if (amountIn === 0n) return;
    const inBefore = await balance(tokenIn, addr(arbitrageur));
    const outBefore = await balance(tokenOut, addr(arbitrageur));
    const leg1 = await tryTx("arbitrageur", () => arbitrageur.exec(pool, SWAP_IN, [key, baseIn, amountIn, 0, addr(arbitrageur), FOREVER], { value: tokenIn === ZERO ? amountIn : 0n }));
    if (!leg1.ok) return;
    const got = (await balance(tokenOut, addr(arbitrageur))) - outBefore;
    if (got === 0n) return;
    if (tokenOut !== ZERO && tokenOut === coin) await approve(arbitrageur, coin, pool);
    const leg2 = await tryTx("arbitrageur", () => arbitrageur.exec(pool, SWAP_IN, [key, !baseIn, got, 0, addr(arbitrageur), FOREVER], { value: tokenOut === ZERO ? got : 0n }));
    if (!leg2.ok) return;
    const inAfter = await balance(tokenIn, addr(arbitrageur));
    // gas is paid by the harness at 10 wei a unit; a native leg costs the arbitrageur that much on top
    const slack = tokenIn === ZERO ? 10n * 10_000_000n : 0n;
    hold(inAfter <= inBefore + slack, "a round trip never profits, in either direction", `market ${key}: ${inBefore} → ${inAfter}`);
    count("arbitrageur", "round trip never profited");
  },

  async sniper() {
    const l = await launch();
    if (l.state === 1n) {
      const inWindow = now() < l.fairEnds;
      const value = inWindow ? between(W / 10n, W / 4n) : between(W / 4n, W);
      const taxNow = decUint(await c.read(launchpad, "snipeTaxBps(uint256)", [L]));
      hold(taxNow + l.feeBps <= 9_900n, "the sniper tax and the fee together stay under 99 %", `${taxNow} + ${l.feeBps}`);
      const r = await tryTx("sniper", () => sniper.exec(launchpad, "buy(uint256,uint256,uint64,uint16)", [L, 0, now() + 60n, 10_000], { value }));
      if (r.ok) {
        const log = c.getLogs({ address: launchpad, topics: [kec(Buffer.from("Bought(uint256,address,uint256,uint256,uint256,uint256)"))] }).pop();
        const d = log.data.slice(2);
        const quoteIn = BigInt("0x" + d.slice(0, 64)), fee = BigInt("0x" + d.slice(128, 192)), snipe = BigInt("0x" + d.slice(192, 256));
        hold(fee + snipe < quoteIn, "a buy's fee and tax leave something for the curve", `${fee} + ${snipe} of ${quoteIn}`);
        if (inWindow && snipe > 0n) count("sniper", "paid the tax");
      }
      hold((await balance(coin, addr(sniper))) === 0n, "the raise's credits never move ERC-20 before graduation");
      const g = await tryTx("sniper", () => sniper.exec(launchpad, "graduate(uint256)", [L]));
      if (g.ok) {
        graduated = true;
        const lk = await c.read(launchpad, "launchKey(uint256)", [L]);
        sealedKey = decUint(await c.read(pool, "sealedKey(bytes32)", [lk]));
        count("sniper", "graduated the raise");
        await tryTx("sniper", () => sniper.exec(launchpad, "claim(uint256,address)", [L, addr(sniper)]));
        hold((await balance(coin, addr(sniper))) > 0n, "credits become coins at graduation");
        await approve(sniper, coin, pool);
        await approve(trader, coin, pool);
      }
    } else if (graduated) {
      await trade(sniper, sealedKey, rnd(2) === 0, false, "sniper");
    }
  },

  async spammer() {
    const first = await tryTx("spammer", () => spammer.exec(parley, SPEAK, [0, H3, 0, 0, 0, hex(`tick ${tick}`)]));
    const second = await tryTx("spammer", () => spammer.exec(parley, SPEAK, [0, H3, 0, 0, 0, hex(`tick ${tick} again`)]));
    hold(!second.ok && second.name === "Cooldown", "a second word in the same block is refused by the brake", second.ok ? "it went through" : second.name);
    if (first.ok) count("spammer", "spoke");
    if (rnd(4) === 0) {
      // a priced inbox: the spammer answers the griefer's stamp sometimes, and ignores it the rest of the time
      const pending = decUint(await c.read(postage, "pendingOf(uint256)", [ROOM23]));
      if (pending !== 0n) {
        const r = await tryTx("spammer", () => spammer.exec(parley, WHISPER, [H3, H2, 0, "0x" + "00".repeat(32), hex("you may")]));
        if (r.ok) count("spammer", "replied to a stamp");
      }
    }
  },

  async drainer() {
    const shape = rnd(9);
    const ethBefore = await c.balanceOf(reach1);
    const silverBefore = await balance(SILVER, reach1);
    const goldBefore = await balance(GOLD, reach1);
    const want = between(W, 15n * W);
    const names = ["GOLD within the cap", "GOLD over the cap", "SILVER (not a target)", "an approve (not a selector)", "execute as a non-signer",
                   "grantSession through the session", "ether through the session", "the Reach's own revokeSession", "a typed call over its spend"];
    let r;
    if (shape === 0) r = await tryTx("drainer", () => drainer.exec(reach1, AS_SESSION, [GOLD, 0, enc("transfer(address,uint256)", [addr(drainer), want])]));
    else if (shape === 1) r = await tryTx("drainer", () => drainer.exec(reach1, AS_SESSION, [GOLD, 0, enc("transfer(address,uint256)", [addr(drainer), goldOutCap + W])]));
    else if (shape === 2) r = await tryTx("drainer", () => drainer.exec(reach1, AS_SESSION, [SILVER, 0, enc("transfer(address,uint256)", [addr(drainer), W])]));
    else if (shape === 3) r = await tryTx("drainer", () => drainer.exec(reach1, AS_SESSION, [GOLD, 0, enc("approve(address,uint256)", [addr(drainer), MAX])]));
    else if (shape === 4) r = await tryTx("drainer", () => drainer.exec(reach1, EXEC, [GOLD, 0, enc("transfer(address,uint256)", [addr(drainer), W]), 0]));
    else if (shape === 5) r = await tryTx("drainer", () => drainer.exec(reach1, AS_SESSION, [reach1, 0, enc(GRANT, [addr(drainer), now() + 86400n, W, [], [GOLD, SILVER], [XFER], 0, 0])]));
    else if (shape === 6) r = await tryTx("drainer", () => drainer.exec(reach1, AS_SESSION, [addr(drainer), W, "0x"]));
    else if (shape === 7) r = await tryTx("drainer", () => drainer.exec(reach1, "revokeSession(address)", [addr(drainer)]));
    else r = await tryTx("drainer", () => drainer.exec(reach1, "executeTyped((address,uint256,bytes,(address,uint256)[],(address,uint256)[],uint64))",
      [[GOLD, 0n, enc("transfer(address,uint256)", [addr(drainer), 2n * W]), [[GOLD, W]], [], now() + 60n]]));
    const goldAfter = await balance(GOLD, reach1);
    if (r.ok) {
      goldOut += goldBefore - goldAfter;
      count("drainer", "moved GOLD under the grant");
      hold(shape === 0, "only a transfer within the cap passes a session key", `the shape "${names[shape]}" went through`);
    } else {
      count("drainer", `refused ${names[shape]}: ${r.name}`);
    }
    hold(goldOut <= goldOutCap, "a session key's cumulative take never passes its cap", `${goldOut} of ${goldOutCap}`);
    hold((await balance(SILVER, reach1)) === silverBefore, "the sealed Reach's manifest asset never shrinks", `${silverBefore} → ${await balance(SILVER, reach1)}`);
    hold((await c.balanceOf(reach1)) === ethBefore, "no ether leaves through a session with no native cap");
  },

  async flipper() {
    const owner = decAddr(await c.read(hub, "ownerOf(uint256)", [H1]));
    const flipperHolds = same(owner, addr(flipper));
    const seller = flipperHolds ? flipper : holder;
    const buyer = flipperHolds ? holder : flipper;
    if (tick % 20 === 10) {
      /*── the sale (a buy-back every other time) ──*/
      await seller.exec(parley, SPEAK, [0, H1, 0, 0, 0, hex("my last word as the holder")]).catch(() => {});
      const sealBefore = decUint(await c.read(reach1, "sealedUntil()"));
      const epochBefore = await epochOf(H1);
      await seller.exec(hub, "transferFrom(address,address,uint256)", [addr(seller), addr(buyer), H1]);
      count("flipper", flipperHolds ? "sold it back" : "bought #1");
      const epochAfter = await epochOf(H1);
      hold(epochAfter === epochBefore + 1n, "a sale moves the custody epoch by exactly one", `${epochBefore} → ${epochAfter}`);
      hold(!decBool(await c.read(reach1, "sessionCurrent(address)", [addr(drainer)])), "a sold token's sessions are dead", "sessionCurrent is still true");
      hold((await bitsOf(H1, addr(seller))) === 0n, "rightsOf of a seller carries nothing after a sale", await bitsOf(H1, addr(seller)));
      hold(decUint(await c.read(parley, "keyOf(uint256)", [H1]), 1) === 0n, "a sold token has no key", "keyOf still answers");
      const inbox = await c.read(postage, "inboxOf(uint256)", [H1]);
      hold(decBool(inbox, 3) && decUint(inbox, 1) === 0n, "a sold token's inbox is open and free again", `open ${decBool(inbox, 3)} postage ${decUint(inbox, 1)}`);
      hold(decUint(await c.read(hub, "statusOf(uint256)", [H1])) === 1n, "a sale pauses the token", "status is not Paused");
      hold(decUint(await c.read(reach1, "sealedUntil()")) === sealBefore, "the Reach seal survives the sale", sealBefore);
      const dead = await tryTx("drainer", () => drainer.exec(reach1, AS_SESSION, [GOLD, 0, enc("transfer(address,uint256)", [addr(drainer), W])]));
      hold(!dead.ok && dead.name === "SoldOn", "a sold token's session key is SoldOn when it tries", dead.ok ? "it went through" : dead.name);
      // the buyer speaks at once: the seller's word in this block rate-limits nobody
      const word = await tryTx("flipper", () => buyer.exec(parley, SPEAK, [0, H1, 0, 0, 0, hex("my first word as the holder")]));
      hold(word.ok, "the cooldown is keyed by (token, epoch): a buyer is not rate-limited by the seller", word.name);
      // re-arm, re-grant, re-bind, re-price: the new holder's own delegations
      await buyer.exec(hub, "setStatus(uint256,uint8)", [H1, 0]);
      await grantDrainer(buyer);
      drainerEpoch = epochAfter; goldOutCap = GOLD_CAP; goldOut = 0n;
      await buyer.exec(keys, "setEncryptionKey(uint16,bytes)", [3, flipperHolds ? "0x04aa" : "0x04bb"]).catch(() => {});
      await buyer.exec(parley, "bindKey(uint256)", [H1]);
      await buyer.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)", [H1, USDC, 1_000_000n, 300n, true]);
      count("flipper", "re-armed and re-granted");
    } else {
      /*── the holder's hand on #1's market: deposit, seal, the refusals under the seal ──*/
      const who = flipperHolds ? flipper : holder;
      const m = await market(H1);
      const shape = rnd(5);
      if (shape === 0) {
        const r = await tryTx("flipper", () => who.exec(pool, DEPOSIT, [H1, 10n * W, W], { value: W }));
        if (r.ok) count("flipper", "deposited");
      } else if (shape === 1) {
        const until = now() + between(1n, 40n) * 86400n;
        const r = await tryTx("flipper", () => who.exec(pool, "sealMarket(uint256,uint64)", [H1, until]));
        count("flipper", r.ok ? "sealed the market" : `seal refused: ${r.name}`);
      } else if (shape === 2) {
        const r = await tryTx("flipper", () => who.exec(pool, WITHDRAW, [H1, W, 0n, addr(who)]));
        if (m.sealUntil > now()) hold(!r.ok && r.name === "Sealed", "nothing leaves a sealed market", r.ok ? "a withdrawal went through" : r.name);
        count("flipper", r.ok ? "withdrew (unsealed)" : `withdraw refused: ${r.name}`);
      } else if (shape === 3) {
        const r = await tryTx("flipper", () => who.exec(pool, "setFee(uint256,uint16)", [H1, 10 + rnd(400)]));
        if (m.sealUntil > now()) hold(!r.ok && r.name === "Sealed", "no term of a sealed market moves", r.ok ? "a fee change went through" : r.name);
      } else {
        const r = await tryTx("flipper", () => who.exec(reach1, "seal(uint64)", [now() + between(1n, 60n) * 86400n]));
        count("flipper", r.ok ? "lengthened the Reach seal" : `Reach seal refused: ${r.name}`);
      }
    }
  },

  async griefer() {
    const shape = rnd(4);
    if (shape === 0) {
      const r = await tryTx("griefer", () => griefer.exec(parley, STAMPED, [H2, H3, 0, "0x" + "00".repeat(32), hex(`a stamp at tick ${tick}`), USDC, 2_000_000n]));
      if (r.ok) {
        const id = decUint(await c.read(postage, "pendingOf(uint256)", [ROOM23]));
        if (id !== 0n) { stamps.add(id); count("griefer", "stamped"); }
      }
    } else if (shape === 1) {
      for (const id of stamps) {
        const st = await c.read(postage, "stampOf(uint256)", [id]);
        if (!decBool(st, 8) && !decBool(st, 9) && now() > decUint(st, 7)) {
          const r = await tryTx("griefer", () => griefer.exec(postage, "expire(uint256)", [id]));
          if (r.ok) count("griefer", "expired a lapsed stamp");
        }
      }
    } else if (shape === 2) {
      for (const id of stamps) {
        const st = await c.read(postage, "stampOf(uint256)", [id]);
        if (decBool(st, 9)) {
          const r = await tryTx("griefer", () => griefer.exec(postage, "claimRefund(uint256)", [id]));
          if (r.ok) count("griefer", "claimed a refund");
        }
      }
      await tryTx("griefer", () => griefer.exec(postage, "claimSettled(uint256,address)", [H3, USDC]));
    } else if (graduated) {
      // Pool accrues the fee on the side that came in (base on a sell, quote on a buy), so a
      // collect may move one token alone; the hold reads what was owed and what arrived, per token
      const m = await market(sealedKey);
      const sink = decAddr(await c.read(hub, "feeSink(uint256)", [H4]));
      const b0 = await balance(m.base, sink), q0 = await balance(m.quote, sink);
      const r = await tryTx("griefer", () => griefer.exec(pool, "collect(uint256)", [sealedKey]));
      if (r.ok) {
        count("griefer", "collected the sealed market's fees");
        const b1 = await balance(m.base, sink), q1 = await balance(m.quote, sink);
        hold(b1 - b0 === m.fbo && q1 - q0 === m.fqo && m.fbo + m.fqo > 0n,
          "collect pays the beneficiary's feeSink exactly what the sealed market owed, in each token",
          `owed ${m.fbo} base and ${m.fqo} quote; the feeSink received ${b1 - b0} and ${q1 - q0}`);
        const after = await market(sealedKey);
        hold(after.fbo === 0n && after.fqo === 0n, "a collected market owes nothing", `owes ${after.fbo} base and ${after.fqo} quote`);
      } else {
        hold(r.name === "ZeroAmount" && m.fbo === 0n && m.fqo === 0n, "collect is refused only when nothing is owed",
          `${r.name} with ${m.fbo} base and ${m.fqo} quote owed`);
      }
    }
  }
};
const stamps = new Set();
const resolved = new Map();

/*──────────────── the invariants read after every tick ────────────────*/
let lastMarketSeal = 0n, lastReachSeal = 0n;
async function invariants() {
  // every token's claims add up and are covered
  const ms = await Promise.all(marketKeys().map((k) => market(k)));
  for (const [name, t] of Object.entries(TOKENS).concat(graduated ? [["COIN", coin]] : [])) {
    let claims = 0n;
    for (const m of ms) {
      if (!m.open) continue;
      if (same(m.base, t)) claims += m.rb + m.fbo;
      if (same(m.quote, t)) claims += m.rq + m.fqo;
    }
    const reserved = decUint(await c.read(pool, "totalReserved(address)", [t]));
    const balanceHeld = await balance(t, pool);
    hold(reserved === claims, "totalReserved of every token is exactly the sum of the markets' claims in it (no market pays with another's reserves)", `${name}: ${reserved} vs ${claims}`);
    hold(reserved <= balanceHeld, "totalReserved never exceeds the Pool's balance", `${name}: ${reserved} > ${balanceHeld}`);
  }
  // seals only lengthen
  const m1 = ms[0];
  hold(m1.sealUntil >= lastMarketSeal, "the market seal only lengthens", `${lastMarketSeal} → ${m1.sealUntil}`); lastMarketSeal = m1.sealUntil;
  const rs = decUint(await c.read(reach1, "sealedUntil()"));
  hold(rs >= lastReachSeal, "the Reach seal only lengthens", `${lastReachSeal} → ${rs}`); lastReachSeal = rs;
  // a live session is stamped with the token's current epoch, and a dead one is not current
  const s = await c.read(reach1, "sessionOf(address)", [addr(drainer)]);
  const current = decBool(await c.read(reach1, "sessionCurrent(address)", [addr(drainer)]));
  const epoch = await epochOf(H1);
  if (current) hold(decUint(s, 2) === epoch, "a live session is stamped with the token's current epoch", `${decUint(s, 2)} vs ${epoch}`);
  else hold(decUint(s, 2) !== epoch || decUint(s, 1) < now() || !decBool(s, 13), "a session that is not live is dead for a reason the chain states (epoch, expiry or revocation)", decUint(s, 2));
  // stamps: exactly one of settled/refunded, or neither while pending; a resolved stamp is
  // re-read every tenth tick (its flags must never flip), an open one every tick
  for (const id of stamps) {
    if (resolved.has(id) && tick % 10 !== 0) continue;
    const st = await c.read(postage, "stampOf(uint256)", [id]);
    const settled = decBool(st, 8), refunded = decBool(st, 9);
    hold(!(settled && refunded), "exactly one of settled/refunded per stamp, never both", `stamp ${id}`);
    if (resolved.has(id)) hold(resolved.get(id) === (settled ? "settled" : "refunded"), "a resolved stamp never changes its resolution", `stamp ${id} was ${resolved.get(id)}`);
    if (settled || refunded) resolved.set(id, settled ? "settled" : "refunded");
    else hold(decUint(await c.read(postage, "pendingOf(uint256)", [ROOM23])) === id, "an unresolved stamp is its pair's one pending stamp", `stamp ${id}`);
  }
  // the raise's coin never moves to a buyer before graduation
  if (!graduated) hold((await balance(coin, addr(sniper))) === 0n, "the raise's credits never move ERC-20 before graduation", "the sniper holds coin while the launch is live");
  // the seller of #1 holds nothing of it
  const owner = decAddr(await c.read(hub, "ownerOf(uint256)", [H1]));
  const other = same(owner, addr(flipper)) ? holder : flipper;
  hold((await bitsOf(H1, addr(other))) === 0n, "rightsOf of a seller carries nothing after a sale", await bitsOf(H1, addr(other)));
}

/*──────────────── the ticks ────────────────*/
const ORDER = ["trader", "arbitrageur", "sniper", "spammer", "drainer", "flipper", "griefer"];
let broke = null;
try {
  for (tick = 1; tick <= TICKS; tick++) {
    roll(BLOCK.header.number + 2n);
    warp(now() + 12n);
    for (const m of ORDER) { motive = m; await motives[m](); }
    motive = "invariants";
    await invariants();
  }
} catch (e) {
  broke = e;
}

/*──────────────── the roll ────────────────*/
console.log(`\n  \x1b[1m${Math.min(tick, TICKS)} ticks · seed ${SEED}\x1b[0m  (${((Date.now() - T0) / 1000).toFixed(1)}s, ${graduated ? "the raise graduated into sealed market " + String(sealedKey).slice(0, 12) + "…" : "the raise did not graduate"})`);
for (const who of ORDER) {
  const cs = counts[who] || {};
  const total = Object.values(cs).reduce((a, b) => a + b, 0);
  console.log(`  ${who.padEnd(12)} ${String(total).padStart(5)} actions  ` + Object.entries(cs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(" · "));
}
console.log("\n  \x1b[1mthe invariants, and how many times each was read true\x1b[0m");
for (const [name, n] of Object.entries(held).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${name}`);
if (broke) {
  if (broke instanceof Broken) console.log(`\n  \x1b[31m✗ tick ${tick} · ${motive}: ${broke.message}\x1b[0m\n  \x1b[31mreproduce with --seed ${SEED} --ticks ${tick}\x1b[0m`);
  else { fail++; console.log(`\n  \x1b[31m✗ tick ${tick} · ${motive} threw: ${String(broke.stack || broke.message).slice(0, 600)}\x1b[0m\n  \x1b[31mreproduce with --seed ${SEED} --ticks ${tick}\x1b[0m`); }
}
console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail ? 1 : 0);
