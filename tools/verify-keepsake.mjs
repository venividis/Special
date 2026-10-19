#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT V2 · the keepsake, on a real EVM

  Unit W1 (docs/V2.md §3.1): src/Keepsake.sol and its renderer,
  src/KeepsakeArt.sol, driven end to end on the in-process EVM against the
  real Pool. The hub is PoolFixtures' stand-in, on purpose: the Keepsake
  asks the hub nothing (`HUB` is a pin for pages and the Catalog), and the
  Pool asks it only `ownerOf`, `account` and `feeSink`, which the stand-in
  answers with the hub's semantics. The real hub meets the Keepsake in W6,
  where the fingerprint gains `commitmentOf(account(id))`.

  The journey: a bundle of ETH and two ERC-20s wrapped as a gift; the
  recipient's commitment unmoved by it; the release growing along its line
  as the clock moves; a stranger pressing `claim` and only the holder paid;
  `swapAndWrap` locking what a swap delivered, with a drip set in the same
  call; a drip selling at or above its floor, once per block, and refused
  below it after a large trade moves the price; the face read back as JSON
  whose image is an SVG and whose page carries no script. Events are read
  from the logs each transaction left, ids from the Transfer log, never
  from a read after the write. Gas is measured on the way and printed.

  Every refusal is asserted by its full revert data where its arguments
  matter, by selector otherwise: a revert for the wrong reason is a check
  passing by accident.

    node tools/verify-keepsake.mjs
───────────────────────────────────────────────────────────────────────────*/
import { compile, artifact } from "./compile.mjs";
import * as EVM from "./evm.mjs";
import { Chain, enc, sel, decUint, decAddr, decString, encodeParams } from "./evm.mjs";
import { keccak256 } from "ethereum-cryptography/keccak.js";

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${detail}`);
};
const eq = (name, got, want) => ok(name, String(got) === String(want), `got ${got}\n      want ${want}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const note = (s) => console.log(`      \x1b[2m${s}\x1b[0m`);

const ZERO = "0x" + "00".repeat(20);
const DAY = 86_400n;
const WAD = 10n ** 18n;
const MAX = 2n ** 255n;
const FOREVER = 4_102_444_800n;
const T0 = EVM.GENESIS_TIME;
const topic = (sig) => "0x" + Buffer.from(keccak256(Buffer.from(sig, "utf8"))).toString("hex");
const hex = (u) => "0x" + Buffer.from(u).toString("hex");
const lc = (a) => String(a).toLowerCase();
const word = (v) => BigInt(v).toString(16).padStart(64, "0");
const ceil = (x, f) => (x * f + WAD - 1n) / WAD;

/// A call that must fail: with exactly `want` when it is revert data
/// ("0x…", the whole of it), or with that error's selector when it is a
/// signature ("NotHolder()").
async function refuses(name, chain, to, data, want, value = 0n) {
  const r = await chain.simulate(to, data, { from: chain.from.toString(), value });
  const exact = want.startsWith("0x");
  const w = exact ? want : sel(want);
  const right = !r.ok && (exact ? r.data === w : r.data.startsWith(w));
  ok(name, right, r.ok ? "it went through" : `reverted with ${r.data.slice(0, 140)}, wanted ${w.slice(0, 140)}`);
}
const errData = (sig, ...args) => sel(sig) + args.map(word).join("");

/*──────────────── the ABI shapes ────────────────*/
const ASSETS = "(address,uint256)[]";
const SCHEDULE = "(uint64,uint64,uint64)";
const DRIP = "(uint8,uint256,uint256,uint256)";
const WRAP = `wrap((${ASSETS},${SCHEDULE},address,string,${DRIP}))`;
const SWAPWRAP = `swapAndWrap((uint256,bool,uint256,uint256,uint64,${SCHEDULE},address,string,${DRIP}))`;
const NODRIP = [0, 0, 0, 0];

/// `(address,uint256)[]` whose offset word sits at head index `at`.
function decAssets(h, at, base = 0) {
  const pos = base + Number(BigInt("0x" + h.substr(base + at * 64, 64))) * 2;
  const n = Number(BigInt("0x" + h.substr(pos, 64)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pos + 64 + i * 128;
    out.push({ token: "0x" + h.substr(p + 24, 40), amount: BigInt("0x" + h.substr(p + 64, 64)) });
  }
  return out;
}
function decUints(h, at, base) {
  const pos = base + Number(BigInt("0x" + h.substr(base + at * 64, 64))) * 2;
  const n = Number(BigInt("0x" + h.substr(pos, 64)));
  return Array.from({ length: n }, (_, i) => BigInt("0x" + h.substr(pos + 64 + i * 64, 64)));
}
/// KeepsakeView: holder, creator, createdAt, schedule(3), assets, paid, sold,
/// proceeds, message, drip(4), lastDripBlock — sixteen head words.
function decView(ret) {
  const h = ret.replace(/^0x/, "");
  const base = Number(BigInt("0x" + h.substr(0, 64))) * 2;
  const w = (i) => BigInt("0x" + h.substr(base + i * 64, 64));
  const msgPos = base + Number(w(10)) * 2;
  const len = Number(BigInt("0x" + h.substr(msgPos, 64)));
  return {
    holder: "0x" + h.substr(base + 24, 40), creator: "0x" + h.substr(base + 64 + 24, 40), createdAt: w(2),
    start: w(3), cliff: w(4), end: w(5),
    assets: decAssets(h, 6, base), paid: decUints(h, 7, base), sold: decUints(h, 8, base), proceeds: decAssets(h, 9, base),
    message: Buffer.from(h.substr(msgPos + 64, len * 2), "hex").toString("utf8"),
    drip: { asset: w(11), market: w(12), floor: w(13), max: w(14) }, lastDripBlock: w(15)
  };
}

/// A `string` in ABI data whose offset word sits at index `at`.
function strAt(data, at) {
  const h = data.replace(/^0x/, "");
  const pos = Number(BigInt("0x" + h.substr(at * 64, 64))) * 2;
  const len = Number(BigInt("0x" + h.substr(pos, 64)));
  return Buffer.from(h.substr(pos + 64, len * 2), "hex").toString("utf8");
}

/// The logs a transaction left, by event signature.
const logsOf = (r, sig, address) => r.logs
  .map(([a, t, d]) => ({ address: hex(a), topics: t.map(hex), data: hex(d) }))
  .filter((l) => l.topics[0] === topic(sig) && (!address || lc(l.address) === lc(address)));

/*──────────────── deploy ────────────────*/
head("deploy");
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const me = c.from.toString();
const alice = await c.as("0x" + "a1".repeat(32), 10n ** 24n);
const bob = await c.as("0x" + "b0".repeat(32));
const carol = await c.as("0x" + "ca".repeat(32), 10n ** 24n);
const keeper = await c.as("0x" + "4e".repeat(32));
const ALICE = alice.from.toString(), BOB = bob.from.toString(), CAROL = carol.from.toString(), KEEPER = keeper.from.toString();

const hub = await c.deploy(A("test/mocks/PoolFixtures.sol", "PoolHub").bytecode, "", "PoolHub");
const pool = await c.deploy(A("src/Pool.sol", "Pool").bytecode, encodeParams("address,address", [hub, me]), "Pool");
const art = await c.deploy(A("src/KeepsakeArt.sol", "KeepsakeArt").bytecode, "", "KeepsakeArt");
const ks = await c.deploy(A("src/Keepsake.sol", "Keepsake").bytecode,
  encodeParams("address,address,address", [hub, pool, art]), "Keepsake");
const mkToken = (name, sym, dec) => c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode,
  encodeParams("string,string,uint8,uint256,bool", [name, sym, dec, 0, false]));
const TOK = await mkToken("Token", "TOK", 18);
const USDC = await mkToken("USD Coin", "USDC", 6);
const HOSTILE = await c.deploy(A("test/mocks/HostileToken.sol", "HostileToken").bytecode, "", "HostileToken");
const KS_BYTES = A("src/Keepsake.sol", "Keepsake").deployed.length / 2 - 1;
const ART_BYTES = A("src/KeepsakeArt.sol", "KeepsakeArt").deployed.length / 2 - 1;
ok(`the Keepsake is deployed under EIP-170 (runtime ${KS_BYTES} B of 24,576)`, KS_BYTES <= 24_576);
ok(`and its renderer (runtime ${ART_BYTES} B of 24,576)`, ART_BYTES <= 24_576);
eq("the Keepsake pins the Pool", lc(decAddr(await c.read(ks, "POOL()"))), lc(pool));
eq("and the hub", lc(decAddr(await c.read(ks, "HUB()"))), lc(hub));
eq("and the renderer", lc(decAddr(await c.read(ks, "ART()"))), lc(art));

// the market: TOK against native ETH, 1,000,000 : 100, the deployer its holder
await c.exec(hub, "mint(address)", [me]);
await c.exec(TOK, "mint(address,uint256)", [me, 10n ** 30n]);
await c.exec(TOK, "approve(address,uint256)", [pool, MAX]);
await c.exec(pool, "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", [1, TOK, ZERO, 30, 0, 0, 0]);
await c.exec(pool, "deposit(uint256,uint256,uint256)", [1, 1_000_000n * WAD, 100n * WAD], { value: 100n * WAD });
for (const [t, who] of [[TOK, alice], [USDC, alice], [HOSTILE, alice], [TOK, carol]]) {
  await c.exec(t, "mint(address,uint256)", [who.from.toString(), 10n ** 27n]);
  await who.exec(t, "approve(address,uint256)", [ks, MAX]);
}
await carol.exec(TOK, "approve(address,uint256)", [pool, MAX]);
const spot0 = decUint(await c.read(pool, "spot(uint256)", [1]));
note(`market 1: TOK/ETH, spot ${spot0} ETH-wei per 1e18 TOK-wei`);

const bal = async (token, who) => token === ZERO ? c.balanceOf(who) : decUint(await c.read(token, "balanceOf(address)", [who]));
const view = async (id) => decView(await c.call(ks, enc("keepsakeOf(uint256)", [id])));
const claimable = async (id) => {
  const h = (await c.call(ks, enc("claimable(uint256)", [id]))).replace(/^0x/, "");
  return { freed: decAssets(h, 0), proceeds: decAssets(h, 1) };
};
const commitment = async (who) => "0x" + (await c.read(ks, "commitmentOf(address)", [who])).replace(/^0x/, "");
const gas = {};

/*──────────────── a gift ────────────────*/
head("a bundle of ETH and two ERC-20s, wrapped as a gift");
const MESSAGE = 'for the long road: "slowly", like everything <good> & true';
const END = T0 + 100n * DAY;
const c0 = await commitment(BOB);
const gift = await alice.exec(ks, WRAP,
  [[[[ZERO, 2n * WAD], [TOK, 1_000n * WAD], [USDC, 500n * 10n ** 6n]], [0, 0, END], BOB, MESSAGE, NODRIP]],
  { value: 2n * WAD, label: "wrap (3 assets)" });
gas.wrap = gift.gas;
const mints = logsOf(gift, "Transfer(address,address,uint256)", ks);
const GIFT = BigInt(mints[0]?.topics[3] ?? 0);
ok("the mint's Transfer log names the new id, and it is the first", mints.length === 1 && GIFT === 1n);
ok("the Transfer is a mint to the recipient", mints[0] && mints[0].topics[1] === "0x" + word(0) && lc(mints[0].topics[2]) === "0x" + word(BOB));
const wrapped = logsOf(gift, "Wrapped(uint256,address,address,uint64,uint64,uint64,uint256,string)", ks);
ok("Wrapped names the giver and the recipient in its topics",
  wrapped.length === 1 && lc(wrapped[0].topics[2]) === "0x" + word(ALICE) && lc(wrapped[0].topics[3]) === "0x" + word(BOB));
ok("and carries the schedule, the count and the message in its data",
  wrapped.length === 1 && decUint(wrapped[0].data, 0) === T0 && decUint(wrapped[0].data, 2) === END &&
  decUint(wrapped[0].data, 3) === 3n && strAt(wrapped[0].data, 4) === MESSAGE);
eq("the recipient holds the keepsake", lc(decAddr(await c.read(ks, "ownerOf(uint256)", [GIFT]))), lc(BOB));
eq("the Keepsake holds the ETH asset to the wei", await c.balanceOf(ks), 2n * WAD);
eq("and the first ERC-20 exactly", await bal(TOK, ks), 1_000n * WAD);
eq("and the second, in its own decimals", await bal(USDC, ks), 500n * 10n ** 6n);
eq("the recipient's commitment is unmoved by the gift", await commitment(BOB), c0);
eq("and so is the giver's: nothing left the giver as a keepsake", await commitment(ALICE), "0x" + word(0));
await refuses("a gift that would carry a drip is refused: a giver never sells a recipient's gift", alice, ks,
  enc(WRAP, [[[[TOK, WAD]], [0, 0, END], BOB, "", [0, 1, 1, 1]]]), "BadDrip()");
await refuses("a wrap whose value is not the ETH asset is refused, naming both", alice, ks,
  enc(WRAP, [[[[ZERO, WAD]], [0, 0, END], BOB, "", NODRIP]]), errData("WrongValue(uint256,uint256)", WAD, WAD + 1n), WAD + 1n);

/*──────────────── the line ────────────────*/
head("the release grows along its line");
EVM.warp(T0 + 25n * DAY);
let f = await claimable(GIFT);
ok("a quarter of the way along, a quarter of every asset is free",
  f.freed[0].amount === WAD / 2n && f.freed[1].amount === 250n * WAD && f.freed[2].amount === 125n * 10n ** 6n,
  f.freed.map((x) => x.amount).join(", "));
EVM.warp(T0 + 50n * DAY);
f = await claimable(GIFT);
ok("half of the way, half",
  f.freed[0].amount === WAD && f.freed[1].amount === 500n * WAD && f.freed[2].amount === 250n * 10n ** 6n,
  f.freed.map((x) => x.amount).join(", "));

/*──────────────── the claim ────────────────*/
head("a stranger presses claim; the holder is paid");
const before = { eth: await c.balanceOf(BOB), tok: await bal(TOK, BOB), usdc: await bal(USDC, BOB),
                 cEth: await c.balanceOf(CAROL), cTok: await bal(TOK, CAROL) };
const claim = await carol.exec(ks, "claim(uint256)", [GIFT], { label: "claim (3 assets)" });
gas.claim = claim.gas;
eq("the holder received the free ETH", await c.balanceOf(BOB) - before.eth, WAD);
eq("and the free TOK", await bal(TOK, BOB) - before.tok, 500n * WAD);
eq("and the free USDC", await bal(USDC, BOB) - before.usdc, 250n * 10n ** 6n);
ok("the stranger who pressed received nothing", await c.balanceOf(CAROL) <= before.cEth && await bal(TOK, CAROL) === before.cTok);
const paidLogs = logsOf(claim, "Paid(uint256,address,address,uint256)", ks);
ok("three Paid logs, each naming the holder", paidLogs.length === 3 && paidLogs.every((l) => lc(l.topics[2]) === "0x" + word(BOB)));
await refuses("a second press in the same second finds nothing freed", carol, ks, enc("claim(uint256)", [GIFT]), "NothingFreed()");
eq("the claim moved no commitment", await commitment(BOB), c0);

/*──────────────── swap and wrap ────────────────*/
head("swapAndWrap locks what the swap delivered, and sets its drip in the same call");
const T1 = T0 + 50n * DAY;
const quote = decUint(await c.read(pool, "quote(uint256,bool,uint256)", [1, false, WAD]));
const FLOOR = spot0 * 95n / 100n;                      // ETH-wei per 1e18 TOK-wei, 95 % of the opening price
const MOST = 200n * WAD;
const sw = await alice.exec(ks, SWAPWRAP,
  [[1, false, WAD, quote, FOREVER, [0, 0, T1 + 30n * DAY], ALICE, "locked what I bought", [0, 1, FLOOR, MOST]]],
  { value: WAD, label: "swapAndWrap" });
gas.swapAndWrap = sw.gas;
const LOCK = decUint(sw.ret, 0), OUT = decUint(sw.ret, 1);
eq("the swap's id comes from its own Transfer log", BigInt(logsOf(sw, "Transfer(address,address,uint256)", ks)[0].topics[3]), LOCK);
eq("what the swap delivered is what the market quoted", OUT, quote);
let v = await view(LOCK);
ok("and exactly that is locked, as the one asset", v.assets.length === 1 && lc(v.assets[0].token) === lc(TOK) && v.assets[0].amount === OUT);
eq("the Keepsake's TOK grew by the output, measured by balance", await bal(TOK, ks), 500n * WAD + OUT);
ok("the drip rode in the same signature", v.drip.floor === FLOOR && v.drip.market === 1n && v.drip.max === MOST);
ok("selling into ETH, the market's other side", v.proceeds.length === 1 && v.proceeds[0].token === ZERO);
eq("the Pool's allowance is back to zero", decUint(await c.read(TOK, "allowance(address,address)", [ks, pool])), 0);

/*──────────────── the drip ────────────────*/
head("a drip sells what has freed, at or above the floor, once per block");
EVM.warp(T1 + 3n * DAY);                              // a tenth of the line has freed
const freedNow = (await claimable(LOCK)).freed[0].amount;
const sellQuote = decUint(await c.read(pool, "quote(uint256,bool,uint256)", [1, true, MOST]));
const keeperEth = await c.balanceOf(KEEPER);
const d1 = await keeper.exec(ks, "drip(uint256)", [LOCK], { label: "drip" });
gas.drip = d1.gas;
const sold1 = decUint(d1.ret, 0), got1 = decUint(d1.ret, 1);
ok(`a tenth has freed (${freedNow / WAD} TOK) and the drip sold its most, 200`, freedNow > 3n * MOST && sold1 === MOST);
eq("it received what the market paid", got1, sellQuote);
ok("which is at or above ceil(sold x floor / 1e18)", got1 >= ceil(sold1, FLOOR), `${got1} < ${ceil(sold1, FLOOR)}`);
const dripped = logsOf(d1, "Dripped(uint256,address,address,uint256,address,uint256)", ks);
ok("Dripped names the keeper and both legs", dripped.length === 1 && lc(dripped[0].topics[2]) === "0x" + word(KEEPER) &&
  decUint(dripped[0].data, 1) === sold1 && decUint(dripped[0].data, 3) === got1);
ok("the keeper who pressed was paid nothing", await c.balanceOf(KEEPER) <= keeperEth);
v = await view(LOCK);
ok("the proceeds are the keepsake's, owed to its holder", v.proceeds[0].amount === got1 && v.sold[0] === sold1);
await refuses("a second drip in the same block is refused", keeper, ks, enc("drip(uint256)", [LOCK]), errData("OnePerBlock()"));
EVM.warp(T1 + 3n * DAY + 12n);                        // the next block
const d2 = await keeper.exec(ks, "drip(uint256)", [LOCK]);
eq("the next block's drip lands", decUint(d2.ret, 0), MOST);
eq("and the commitment never moved for a drip", await commitment(ALICE), "0x" + word(0));

/*──────────────── below the floor ────────────────*/
head("a large trade moves the price below the floor, and the drip refuses it");
await carol.exec(pool, "swapExactIn(uint256,bool,uint256,uint256,address,uint64)", [1, true, 200_000n * WAD, 0, CAROL, FOREVER]);
const spot1 = decUint(await c.read(pool, "spot(uint256)", [1]));
ok(`the trade moved the price below the floor (${spot1} < ${FLOOR})`, spot1 < FLOOR);
EVM.warp(T1 + 3n * DAY + 24n);
const lowQuote = decUint(await c.read(pool, "quote(uint256,bool,uint256)", [1, true, MOST]));
await refuses("the drip is refused by the Pool, which was asked for ceil(sold x floor / 1e18)", keeper, ks,
  enc("drip(uint256)", [LOCK]), errData("Slippage(uint256,uint256)", lowQuote, ceil(MOST, FLOOR)));
let threw = false;
try { await keeper.exec(ks, "drip(uint256)", [LOCK]); } catch { threw = true; }
v = await view(LOCK);
ok("and sold nothing below it", threw && v.sold[0] === 2n * MOST);

/*──────────────── the holder's terms ────────────────*/
head("only the holder re-writes the terms, and each re-write moves the commitment");
await refuses("a stranger cannot extend", carol, ks, enc("extend(uint256,uint64)", [LOCK, T1 + 60n * DAY]), "NotHolder()");
await refuses("nor shorten, as the holder", alice, ks, enc("extend(uint256,uint64)", [LOCK, T1 + 20n * DAY]), "RatchetOnly()");
const ext = await alice.exec(ks, "extend(uint256,uint64)", [LOCK, T1 + 60n * DAY]);
ok("the holder lengthens it, and Extended says from when to when",
  logsOf(ext, "Extended(uint256,uint64,uint64)", ks).length === 1 && (await view(LOCK)).end === T1 + 60n * DAY);
const cAfter = await commitment(ALICE);
ok("the holder's commitment moved with the terms", cAfter !== "0x" + word(0));
await alice.exec(ks, "clearDrip(uint256)", [LOCK]);
ok("clearing the drip moves it again", (await commitment(ALICE)) !== cAfter);

/*──────────────── the face ────────────────*/
head("the face: JSON whose image is an SVG, and a page with no script");
// a fourth asset whose symbol is markup
await alice.exec(ks, WRAP, [[[[TOK, WAD], [HOSTILE, WAD]], [0, 0, END], CAROL, "", NODRIP]]);
const PREFIX = "data:application/json;base64,";
const decodeUri = (u, p) => (u.startsWith(p) ? Buffer.from(u.slice(p.length), "base64").toString("utf8") : null);
/// A well-formedness walk: every tag opened is closed, in order.
function balanced(doc, voids = []) {
  const stack = [];
  for (const m of doc.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self || voids.includes(name.toLowerCase())) continue;
    if (close) { if (stack.pop() !== name) return false; } else stack.push(name);
  }
  return stack.length === 0;
}
for (const id of [GIFT, 3n]) {
  const uri = decString(await c.call(ks, enc("tokenURI(uint256)", [id])));
  if (id === GIFT) gas.uri = c.lastGas;
  const json = decodeUri(uri, PREFIX);
  let meta = null;
  try { meta = JSON.parse(json); } catch { /* reported below */ }
  ok(`keepsake #${id}: tokenURI is a base64 data URI of valid JSON`, meta !== null);
  if (!meta) continue;
  eq(`keepsake #${id}: its name is "Keepsake #${id}"`, meta.name, `Keepsake #${id}`);
  const attrs = Object.fromEntries((meta.attributes || []).map((a) => [a.trait_type, a]));
  const vv = await view(id);
  ok(`keepsake #${id}: the attributes carry the count of assets, the cliff and the end as unix seconds`,
    attrs.Assets?.value === vv.assets.length && attrs.Cliff?.value === Number(vv.cliff) && attrs.End?.value === Number(vv.end) &&
    attrs.Cliff?.display_type === "date");
  const svg = decodeUri(meta.image, "data:image/svg+xml;base64,");
  ok(`keepsake #${id}: the image decodes to an SVG document`, svg !== null && svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\"") && svg.endsWith("</svg>"));
  ok(`keepsake #${id}: the SVG is well formed, one orb and an arc of the freed share`, svg !== null && balanced(svg) && svg.includes("stroke-dasharray=\""));
  const page = decodeUri(meta.animation_url, "data:text/html;base64,");
  ok(`keepsake #${id}: the animation_url is an HTML page`, page !== null && page.startsWith("<!doctype html>") && page.endsWith("</html>"));
  ok(`keepsake #${id}: the page is well formed and carries no script`,
    page !== null && balanced(page, ["meta"]) && !/<script/i.test(page));
  if (id === GIFT) {
    eq("the gift's description is its message, JSON-escaped and read back whole", meta.description, MESSAGE);
    ok("on the page the message is HTML-escaped", page.includes("&quot;slowly&quot;, like everything &lt;good&gt; &amp; true"));
    ok("the page names the giver of a gift", page.includes(`a gift from ${lc(ALICE)}`));
  } else {
    ok("a token whose symbol is markup is printed as text, never as markup",
      page.includes("&lt;script&gt;alert(1)&lt;/script&gt;") && !page.includes("<script>alert"));
  }
}
await refuses("an id that does not exist has no face, by ERC-6093's own word", c, ks, enc("tokenURI(uint256)", [99]),
  errData("ERC721NonexistentToken(uint256)", 99n));

// the heaviest face: eight assets, one of them a token that burns the gas of any call made to it
const extra = [];
for (let i = 0; i < 4; i++) {
  const t = await mkToken(`Extra ${i}`, `X${i}`, 18);
  await c.exec(t, "mint(address,uint256)", [ALICE, 10n ** 24n]);
  await alice.exec(t, "approve(address,uint256)", [ks, MAX]);
  extra.push(t);
}
const eight = [[ZERO, WAD], [TOK, WAD], [USDC, 10n ** 6n], [HOSTILE, WAD], ...extra.map((t) => [t, WAD])];
const w8 = await alice.exec(ks, WRAP, [[eight, [0, 0, END], BOB, "eight at once", NODRIP]], { value: WAD });
const EIGHT = BigInt(logsOf(w8, "Transfer(address,address,uint256)", ks)[0].topics[3]);
await c.exec(HOSTILE, "setMode(uint8)", [6]);
const uri8 = decString(await c.call(ks, enc("tokenURI(uint256)", [EIGHT])));
gas.uri8 = c.lastGas;
let meta8 = null;
try { meta8 = JSON.parse(decodeUri(uri8, PREFIX)); } catch { /* reported below */ }
ok(`the heaviest face (eight assets, one burning all the gas it is given) still renders, in ${gas.uri8} gas, under tokenURI's 8,000,000`,
  meta8 !== null && meta8.attributes[0].value === 8 && gas.uri8 < 8_000_000n);
await c.exec(HOSTILE, "setMode(uint8)", [0]);

/*──────────────── the books ────────────────*/
head("the books: the Keepsake holds exactly what it owes");
const count = decUint(await c.read(ks, "keepsakeCount()"));
const owed = {};
for (let id = 1n; id <= count; id++) {
  const x = await view(id);
  x.assets.forEach((a, i) => { owed[lc(a.token)] = (owed[lc(a.token)] || 0n) + a.amount - x.paid[i] - x.sold[i]; });
  x.proceeds.forEach((p) => { owed[lc(p.token)] = (owed[lc(p.token)] || 0n) + p.amount; });
}
for (const [token, amt] of Object.entries(owed)) {
  eq(`what is held of ${token === ZERO ? "ETH" : token} is what is owed of it`, await bal(token, ks), amt);
}

/*──────────────── no switches ────────────────*/
head("no switches");
const fns = A("src/Keepsake.sol", "Keepsake").abi.filter((x) => x.type === "function").map((x) => x.name);
const admin = fns.filter((n) => /^owner$|ownership|admin|pause|upgrade|sweep|rescue|withdraw|burn/i.test(n));
ok(`no selector on the Keepsake names an owner, a pause, an upgrade, a sweep or a burn (${fns.length} functions read)`, admin.length === 0, admin.join(", "));
const setters = fns.filter((n) => /^set/.test(n));
ok("its only setters are the holder's drip and ERC-721's operator approval", setters.sort().join(",") === "setApprovalForAll,setDrip", setters.join(","));

/*──────────────── gas ────────────────*/
head("gas, measured on this run (each transaction's total, intrinsic included)");
note(`wrap, three assets (ETH and two ERC-20s), first keepsake  ${gas.wrap}`);
note(`claim, three assets, a stranger pressing                  ${gas.claim}`);
note(`swapAndWrap, ETH in, TOK locked, a drip set in the call    ${gas.swapAndWrap}`);
note(`drip, 200 TOK sold for ETH                                ${gas.drip}`);
note(`tokenURI of the three-asset gift (a view)                  ${gas.uri}`);
note(`tokenURI of eight assets, one burning its stipends (a view) ${gas.uri8}`);
ok("every transaction above stayed under the EIP-7825 cap of 2^24", [gas.wrap, gas.claim, gas.swapAndWrap, gas.drip].every((g) => g < EVM.TX_GAS_CAP));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
