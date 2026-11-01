/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "swap" — the token's own market and the Reach's
  door to a venue (H §7.2 planned 52 sentences; the blocks below run more,
  split or added by review)

  Seven blocks, each on the runner's fresh chain: E the absent Router ("an
  absent Router hides the tab and sets the chip to not reported" — with a
  second chain whose Router pin holds code that will not answer, and a
  third whose pin holds a real Router), F the exact approval as the
  button's current step ("every approval the slab builds is exact"), G the
  estimate before the wallet ("a non-holder sees the custom error before
  the wallet opens"), H the floor in words ("the swap slab states the floor
  in words"), O1 the hostile symbol as text, X the Elsewhere swap through
  reach.executeTyped on the third chain, R the holder's forms pressed and a
  sealed market in the directory (added by review). The four BUILD-PLAN
  sentences this file owns end their blocks as `t.ok(..., "<sentence>")`,
  verbatim. The review's round added, inside the blocks: the Router re-asked
  inside the Elsewhere press (X), the amount kept and the step moved to Swap
  after an approve lands (F, H), a re-quote that will not answer refused
  with a sentence (H), the exact-out Elsewhere row (X), the open form's 0x0,
  the seal's day cap and the owed fees of a sealed market in their coins'
  units (R).

  Origin: IPSEITY tools/verify-site.mjs (branch claude/claude-md-docs-8vvyc8),
  the lane assertions for LANE[3], as C §5 grouped them (E, F, G, H), plus
  what INTACT's contract requires on top: the deadline on the chain's clock
  (the shim pins Date.now to the block, so the clock is moved first — D11),
  the epoch re-read inside the press, the gate in propose, the 7702 refusal,
  the exact-out residue offered back to zero (D19), the Router quote by
  revert decoded from the shim's full revert data, the TypedCall's spend cap
  and receive floor decoded from the bytes the slab will sign.

  Setup this group performs on its chain (every id literal below refers to
  it): #1, #2, #3 to `me`, #4 to `delegated`; WETH to `me` and `trader`;
  #2's market opened WETH against ETH at 30 bps with 100 WETH / 10 ETH;
  #3's market opened with a sniper fee (500 bps over 600 s); `renter` is the
  user of #3 for seven days. #2 is sold to `buyer` under an open slab in G;
  `buyer` seals it in H13; #1 gets a market whose base coin is named
  `</script><script>alert(1)</script>` in O1; #5 to `me`, closed, for the
  open form in R; #1 launches AGENT1 on the Kiln and the Launchpad graduates
  it into a sealed market whose beneficiary is #1 (R). Two more chains are opened
  here: one with a Breakable etched at the Router pin (E8) and one with a
  real Router over MockSwapRouter02 and MockWETH etched at the pin (E10,
  E11, X) — the Router's constructor needs the Pool's code and the Catalog
  pins the Router before the Pool exists, so the pin is filled afterwards
  (E §2.2's recipe, the way the 6551 registry itself is placed).

  Elements this group reads from its panel (CONSOLE §6.2; every selector
  scoped to #lane-swap): #swap-in, #swap-out[data-raw], #swap-go,
  #swap-flip, #swap-exact, #swap-sym-in, #swap-sym-out, #swap-details,
  #swap-quote-owned.quote, #swap-quote-elsewhere.quote, #swap-facts,
  #swap-your-market, #swap-open-form (inputs name=feeBps|curveBps|sniperBps|
  sniperSeconds), #swap-sniper, #swap-directory .market, #swap-directory .sealed, #swap-elsewhere,
  #swap-venues .venue, [data-tab=owned|elsewhere], [data-act=swap|openMarket|
  deposit|withdraw|setFee|syncCurve|sealMarket|closeMarket|writeDown|collect|
  approveZero|swapElsewhere]. From the shell: the slab (#cbox.on, #cslab,
  [data-go], [data-no], [data-to], [data-value], [data-function],
  [data-selector], [data-arg], [data-calldata], [data-digest], [data-engine],
  [data-gas]), #tick, #chips .chip[data-bit=router], #facts [data-fact=market],
  body[data-rights].

  V2 (W9, the Trade lane; docs/V2.md §3.1, §3.2), in `lockAndMemory`, run last:
  V0 the chip rule on two bands without the Keepsake and the Journal (the
  runner's chain, and one whose two pins hold code that will not answer); then,
  on a chain of its own deployed with `deploySite(…, { v2: true })`, V1 swap and
  lock in ether with a drip whose floor crosses decimals (a 6-decimal USD) and
  the memory slab after the receipt, V2 swap and lock an ERC-20 with its exact
  approval to the Keepsake, V3 a gift, V4 the refusals in words (a drip asked
  for a gift, no days, past ten years, a long message or memory, a gift to
  oneself, a mixed-case address that is not its own checksum, exact out, a flip
  that would misread a floor; and, in the chain's own words, the Keepsake as its
  own recipient and a schedule the chain's clock puts in the past), V5 a plain
  swap's memory dismissed and offered again. Its block
  sentences, verbatim: "a V2 part appears only where its contract reports:
  elsewhere its chip stands in its place, and no read is sent to the address",
  "lock what I receive: one slab swaps and wraps, the keepsake's id from the
  Wrapped log, then the memory", "a drip floor stated in human terms is the raw
  floor in the calldata, read back from keepsakeOf", "an ERC-20 locked through
  the Keepsake is approved to it exactly, as the button's current step, and
  pulled to zero", "a gift names its recipient in the sentence and in the
  calldata, and the keepsake is theirs with its message", "a refusal is said in
  words: a drip asked for a gift, no days, past ten years, a long message or
  memory, exact out, and a schedule in the past", "the memory slab follows the
  swap's receipt, its ref the swap's transaction, read back from the Inscribed
  log, and Not now never loses it". It reads, scoped to #lane-swap: #swap-say,
  #swap-lock (.chip[data-state], #swap-lock-on[role=switch][aria-checked],
  inputs name=lockDays|freeDays|floor|most|giftTo, textarea name=giftNote,
  #swap-lock-dates, #swap-drip-on, #swap-drip-now, #swap-gift-on,
  #swap-lock-why), #swap-memory (.chip, textarea name=memory,
  #swap-memory-count), #swap-kept (.keepsake[data-id], [data-act=inscribe]),
  #swap-sniper, #swap-facts.
───────────────────────────────────────────────────────────────────────────*/
import { createAddressFromString, Account } from "@ethereumjs/util";
import { argWords } from "../verify-console.mjs";

const WAD = 10n ** 18n;
const OPEN = "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)";
const DEPOSIT = "deposit(uint256,uint256,uint256)";
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";
const SWAP_OUT = "swapExactOut(uint256,bool,uint256,uint256,address,uint64)";
const APPROVE = "approve(address,uint256)";
const REQ = "(uint8,address,address,uint256,uint256,uint64,uint256,bytes,(address,address,uint24,int24,address),uint160)";
const TYPED = "executeTyped((address,uint256,bytes,(address,uint256)[],(address,uint256)[],uint64))";
/// the slab's [data-arg] rows, as words, are the calldata decoded apart from the shell — one row per argument, a
/// tuple's and an array of tuples' too since W14 (CONSOLE §4.2, INTEGRATION L7)
const argsAgree = (page, sig) => { const rows = page.$$("#cslab [data-arg]"), want = argWords(sig, page.text("#cslab [data-calldata]")); return rows.length === want.length && rows.every((r, i) => r.dataset.arg === String(i) && r.textContent === want[i]); };
/// The address the Catalog pins as the Router on the two side chains; the
/// code is etched there after the Pool exists (E §2.2).
const ROUTER_PIN = "0x0000000000000000000000000000000000c0ffee";
const HOSTILE = "</script><script>alert(1)</script>";
const hexN = (n) => "0x" + BigInt(n).toString(16);
const checksum = (a, kec) => { const h = kec(Buffer.from(a.slice(2).toLowerCase(), "utf8")).slice(2); let o = "0x"; for (let i = 0; i < 40; i++) o += parseInt(h[i], 16) >= 8 ? a[i + 2].toUpperCase() : a[i + 2].toLowerCase(); return o; };
/// What the panel prints: every amount at its full precision, so the floor in the words is the floor in the calldata.
const full = (v, d = 18) => { v = BigInt(v); const b = 10n ** BigInt(d); const f = (v % b).toString().padStart(d, "0").replace(/0+$/, ""); return (v / b).toString() + (f ? "." + f : ""); };
const toUnits = (s, d = 18) => { const [w, f = ""] = String(s).trim().split("."); return BigInt((w || "0") + f.padEnd(d, "0")); };
/// word i of a calldata hex, after the four-byte selector
const word = (cd, i) => BigInt("0x" + cd.slice(10 + 64 * i, 10 + 64 * (i + 1)));
const addrWord = (cd, i) => "0x" + cd.slice(10 + 64 * i + 24, 10 + 64 * (i + 1));
/// the receiveMin amount of the TypedCall the Elsewhere slab signs: w0 → the tuple, tuple+128 → the receiveMin list, its first entry's amount
const typedRecv = (cd) => { const body = cd.slice(10), at = (b) => BigInt("0x" + body.slice(b * 2, b * 2 + 64)); const tup = Number(at(0)); return at(tup + Number(at(tup + 128)) + 64); };
const revert = (data) => Object.assign(new Error("execution reverted"), { code: 3, data });
const lower = (s) => String(s).toLowerCase();

export async function run(t, ctx) {
  const { c, site, actors, weth, sel, enc, encodeParams, decUint, decAddr, kec, fs, path, ROOT, ZERO, walletFor, bootToken, lane, mint, EVM, A } = ctx;
  const { me, renter, buyer, trader, stranger, delegated } = actors;
  const ME = me.from.toString(), TRADER = trader.from.toString(), BUYER = buyer.from.toString(), hub = site.hub, pool = site.pool;
  const now = () => EVM.BLOCK.header.timestamp;
  const DIST = fs.readFileSync(path.join(ROOT, "dist/app.html"), "utf8");
  const DIST_PANELS = fs.readdirSync(path.join(ROOT, "dist/panels")).map((f) => fs.readFileSync(path.join(ROOT, "dist/panels", f), "utf8")).join("\n");
  const slabOpen = (page) => page.$("#cbox").classList.contains("on");
  const slabCd = (page) => page.text("#cslab [data-calldata]");
  const gasRow = (page) => page.text("#cslab [data-gas]");
  const tick = (page) => page.text("#tick");
  /// a slab line by its key: the panel's own words (or the shell's, for an exact approval), before the shell's rows
  const lineOf = (page, k) => { const r = page.$$("#cslab .kv").find((x) => x.firstChild && x.firstChild.textContent === k); return r ? r.lastChild.textContent : null; };
  const L = (page, s) => page.$("#lane-swap " + s);
  const LL = (page, s) => page.$$("#lane-swap " + s);
  const laneText = (page) => page.text("#lane-swap");
  /// type an amount and wait for the quote (or the refusal) and the button's step to settle
  const quote = async (page, v) => {
    page.type(L(page, "#swap-in"), v);
    await page.until(() => L(page, "#swap-out").textContent !== "" || /not a number|an amount of/.test(page.text("#lane-swap #swap-details")), 80);
    await page.settle(); await page.settle();
  };
  /// press a lane button and wait for the slab with its estimate answered
  const press = async (page, el) => {
    page.click(el);
    await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 120);
  };
  const sign = async (page, W, n) => { page.click(page.$("#cslab [data-go]")); await page.until(() => W.sent() === n, 120); await page.settle(); await page.settle(); await page.settle(); };
  const repaint = async (page, vctx) => { vctx.dispatchEvent(new vctx.CustomEvent("intact:lane", { detail: { name: "swap" } })); await page.settle(); await page.settle(); };
  /// a contract's runtime copied to the Router pin (how site.mjs places the 6551 registry)
  const etch = async (chain, at, from) => {
    const a = createAddressFromString(at);
    if (!(await chain.vm.stateManager.getAccount(a))) await chain.vm.stateManager.putAccount(a, new Account());
    await chain.vm.stateManager.putCode(a, await chain.vm.stateManager.getCode(createAddressFromString(from)));
  };
  /// the Router's own quote, by revert: QuoteResult(spent, received, sqrtPriceAfter)
  const routerQuote = async (chain, router, tin, tout, amountIn, key) => {
    const data = enc("quoteExactIn(" + REQ + ")", [[0, tin, tout, amountIn, 0n, 0n, key, "0x", [ZERO, ZERO, 0, 0, ZERO], 0n]]);
    const r = await chain.simulate(router, data, { from: chain.from.toString() });
    if (r.ok) throw new Error("quoteExactIn returned instead of reverting");
    return { sig: r.data.slice(0, 10), received: decUint("0x" + r.data.slice(10), 1) };
  };
  /// a market opened on a chain: WETH against ETH at 30 bps, 100 WETH / 10 ETH (Bundle.t.sol's _openMarket)
  const openMarket = async (chain, s, w, id, sniper = [0, 0]) => {
    await chain.exec(w, "mint(address,uint256)", [chain.from.toString(), 1000n * WAD]);
    await chain.exec(w, "approve(address,uint256)", [s.pool, 200n * WAD]);
    await chain.exec(s.pool, OPEN, [id, w, ZERO, 30, 0, sniper[0], sniper[1]], { label: "openMarket" });
    await chain.exec(s.pool, DEPOSIT, [id, 100n * WAD, 10n * WAD], { value: 10n * WAD, label: "deposit" });
  };

  /* the cast: #1, #2, #3 to me, #4 to delegated; #2's market; #3's sniper market; a renter on #3 */
  await mint(c, site, ME); await mint(c, site, ME); await mint(c, site, ME); await mint(c, site, delegated.from.toString());
  await openMarket(c, site, weth, 2);
  await c.exec(pool, OPEN, [3, weth, ZERO, 30, 0, 500, 600], { label: "openMarket" });
  await c.exec(pool, DEPOSIT, [3, 10n * WAD, 1n * WAD], { value: WAD, label: "deposit" });
  await c.exec(weth, "mint(address,uint256)", [TRADER, 10n * WAD]);
  await c.exec(hub, "setUser(uint256,address,uint64)", [3, renter.from.toString(), now() + 7n * 86400n]);
  const poolQuote = async (chain, p, id, baseIn, a) => decUint(await chain.read(p, "quote(uint256,bool,uint256)", [id, baseIn, a]));
  const allowance = async (chain, token, owner, spender) => decUint(await chain.read(token, "allowance(address,address)", [owner, spender]));

  /*═══════════ E · an absent Router hides the tab and sets the chip to not reported ═══════════*/
  t.head("E · an absent Router hides the tab and sets the chip to not reported");
  let E = true;
  const e = (cond, name, d) => { t.ok(cond, name, d); E = E && !!cond; };
  let c3 = null;
  {
    const W = walletFor(c, trader);
    const { page, S } = await bootToken(2, { wallet: W });
    await lane(page, "swap");
    e(S.router === ZERO && (S.reported & S.bits.router) === 0 && (S.absent & S.bits.router) !== 0, "the state says absent, not zero");
    const tab = L(page, "[data-tab=elsewhere]");
    e(tab === null || tab.hidden === true, "the Elsewhere tab is hidden", tab && tab.hidden);
    /* held to the router's own chip: since V2 the lane may also carry the keepsake's "not deployed" chip (W9) */
    e(/router: not deployed on this chain/.test(laneText(page)), "the hidden tab says which spelling: not deployed on this chain", laneText(page).slice(0, 160));
    const chip = page.$("#chips .chip[data-bit=router]");
    e(!!chip && chip.textContent === "router: not deployed on this chain" && chip.dataset.state === "absent", "the router chip on Home reads not deployed", chip && chip.textContent);
    e(LL(page, "#swap-elsewhere").length === 0 && LL(page, "[data-act=swapElsewhere]").length === 0 && LL(page, "#swap-quote-elsewhere").length === 0, "no Elsewhere section, control or quote exists without a Router");
    const n = Number(decUint(await c.read(pool, "openIds(uint256,uint256)", [0, 48]), 1));
    await page.until(() => LL(page, "#swap-directory .market").length === n, 40);
    e(LL(page, "#swap-directory .market").length === n && n === 2 && !page.fetches.some((f) => /\/open(\/|$)/.test(f.url)),
      "the owned directory comes from the Pool, so the viewer has it too — and no /open was fetched", `${LL(page, "#swap-directory .market").length} vs ${n}; fetches ${page.fetches.map((f) => f.url).join(",")}`);
    await quote(page, "1");
    e(LL(page, ".quote").length === 1 && !!L(page, "#swap-quote-owned.quote"), "owned and elsewhere quotes are two numbers, or one (no Router: one, the owned)", LL(page, ".quote").length);
    page.close();
  }
  {
    /* site2: the Router pin holds code that does not answer the probe — a clear bit, the other spelling */
    const c2 = await ctx.fresh({ router: ROUTER_PIN });
    const brk = await c2.c.deploy(A("test/mocks/Breakable.sol", "Breakable").bytecode, "", "Breakable");
    await etch(c2.c, ROUTER_PIN, brk);
    await mint(c2.c, c2.site, c2.c.from.toString());
    const { page, S } = await c2.bootToken(1, { wallet: walletFor(c2.c, c2.c) });
    await c2.lane(page, "swap");
    const tab = L(page, "[data-tab=elsewhere]"), chip = page.$("#chips .chip[data-bit=router]");
    e(lower(S.router) === ROUTER_PIN && (S.reported & S.bits.router) === 0 && (S.absent & S.bits.router) === 0 && (tab === null || tab.hidden === true) && /router: could not be read at block/.test(laneText(page)) &&
      !!chip && chip.textContent === "router: could not be read at block " + S.block && chip.dataset.state === "unread",
      "code that would not answer reads could not be read, and the tab is still hidden", `router ${S.router} reported ${S.reported} absent ${S.absent} chip "${chip && chip.textContent}"`);
    page.close();
  }
  {
    /* site3: a real Router over MockSwapRouter02 and MockWETH, etched at the pin after the Pool exists */
    c3 = await ctx.fresh({ router: ROUTER_PIN });
    const m3 = c3.c, s3 = c3.site, w3 = c3.weth;
    await mint(m3, s3, m3.from.toString()); await mint(m3, s3, m3.from.toString());
    await openMarket(m3, s3, w3, 2);
    const WETHM = await m3.deploy(A("test/mocks/MockWETH.sol", "MockWETH").bytecode, "", "MockWETH");
    const V3 = await m3.deploy(A("test/mocks/MockSwapRouter02.sol", "MockSwapRouter02").bytecode, "", "MockSwapRouter02");
    const real = await m3.deploy(A("src/Router.sol", "Router").bytecode,
      encodeParams("address,address,address,address,address,bytes32", [s3.hub, s3.pool, V3, ZERO, WETHM, "0x" + "00".repeat(32)]), "Router");
    await etch(m3, ROUTER_PIN, real);
    const reach2 = decAddr(await m3.read(s3.hub, "account(uint256)", [2]));
    await m3.exec(w3, "mint(address,uint256)", [reach2, 10n * WAD]);
    c3.reach2 = reach2;
    const W = walletFor(m3, m3);
    const { page, S } = await c3.bootToken(2, { wallet: W });
    await c3.lane(page, "swap");
    const tab = L(page, "[data-tab=elsewhere]");
    e(lower(S.router) === ROUTER_PIN && (S.reported & S.bits.router) !== 0 && !!tab && tab.hidden === false, "with a Router the tab appears", `reported ${S.reported} tab ${tab && tab.hidden}`);
    await quote(page, "1");
    const q3 = await poolQuote(m3, s3.pool, 2, true, WAD);
    const rq = await routerQuote(m3, ROUTER_PIN, w3, ZERO, WAD, 2n);
    await page.until(() => !!L(page, "#swap-quote-elsewhere .v") && !!L(page, "#swap-quote-elsewhere .v").dataset.raw, 60);
    const got = L(page, "#swap-quote-elsewhere .v");
    e(S.err[rq.sig] === "QuoteResult(uint256,uint256,uint160)" && !!got && got.dataset.raw === String(rq.received) && rq.received === q3 && got.textContent.startsWith(full(rq.received) + " ETH"),
      "with a Router the tab quotes: #swap-quote-elsewhere is the received word decoded from quoteExactIn's QuoteResult revert", `${got && got.dataset.raw} vs ${rq.received} (pool ${q3})`);
    const vraw = await m3.read(ROUTER_PIN, "venues()");
    const nv = Number(decUint(vraw, 1));
    await page.until(() => LL(page, "#swap-venues .venue").length === nv, 40);
    const names = LL(page, "#swap-venues .venue").map((v) => v.textContent);
    e(nv === 3 && names.length === nv && /Intact Pool/.test(names[0]) && /Uniswap v3 SwapRouter02/.test(names[1]) && /not on this chain/.test(names[2]) && names.every((x) => !/</.test(x)),
      "the venue manifest is the Router's, in hooklist shape, names through textContent", names.join(" | "));
    e(LL(page, ".quote").length === 2 && /its own market/.test(L(page, "#swap-quote-owned").textContent) && /through the Router/.test(L(page, "#swap-quote-elsewhere").textContent),
      "owned and elsewhere quotes are two numbers, or one (site3: two, labelled)", LL(page, ".quote").map((q) => q.textContent).join(" | "));
    page.close();
  }
  t.ok(E, "an absent Router hides the tab and sets the chip to not reported");

  /*═══════════ F · every approval the slab builds is exact ═══════════*/
  t.head("F · every approval the slab builds is exact");
  let F = true;
  const f = (cond, name, d) => { t.ok(cond, name, d); F = F && !!cond; };
  {
    const W = walletFor(c, trader);
    const { page, S } = await bootToken(2, { wallet: W });
    await lane(page, "swap");
    await quote(page, "1");
    await page.until(() => /^Approve\b/.test(page.text("#lane-swap #swap-go")), 40);
    const go = L(page, "#swap-go");
    f(!!go && /^Approve\b/.test(go.textContent) && /1 WETH/.test(go.textContent) && !go.disabled, "the button's current step is the approve", go && go.textContent);
    await press(page, go);
    f(slabOpen(page) && W.sent() === 0 && W.prompts().length === 0, "pressing raises the slab and sends nothing", `slab ${slabOpen(page)} sent ${W.sent()}`);
    const cd = slabCd(page);
    f(page.text("#cslab [data-function]") === APPROVE && page.text("#cslab [data-selector]") === lower(S.sel["erc20.approve"]) && lower(page.text("#cslab [data-to]")) === lower(weth),
      "the slab names the call and the target", `${page.text("#cslab [data-function]")} ${page.text("#cslab [data-selector]")} ${page.text("#cslab [data-to]")}`);
    f(cd.slice(0, 10) === lower(S.sel["erc20.approve"]) && word(cd, 1) === WAD && lower(addrWord(cd, 0)) === lower(pool), "the amount word is exactly what was typed, in base units, and the spender is the market", cd);
    /* W14 (INTEGRATION L7): a step that names no spender keeps V1's line, word for word */
    t.ok(lineOf(page, "Lets") === "the market pull exactly 1 WETH", "the market's exact approve keeps V1's line: Lets · the market pull exactly 1 WETH", lineOf(page, "Lets"));
    const slab = page.text("#cslab");
    f(/Never\s*unlimited/.test(slab) && (slab.match(/unlimited/g) || []).length === 1, "unlimited appears only as a refusal", slab.slice(0, 200));
    const MASK = new RegExp("\\(\\s*1n\\s*<<\\s*25" + "6n\\s*\\)\\s*-\\s*1n");
    f(!/f{64}/.test(cd) && !MASK.test(DIST) && !MASK.test(DIST_PANELS), "the mask is nowhere: not in the calldata, not in the shipped shell, not in any panel");
    f(page.text("#cslab [data-digest]") === kec(Buffer.from(cd.slice(2), "hex")) && page.text("#cslab [data-engine]") === S.engineHash, "the slab prints the digest and the engine hash", `${page.text("#cslab [data-digest]")} ${page.text("#cslab [data-engine]")}`);
    const keys = page.$$("#cslab .kv .k").map((k) => k.textContent);
    f(keys.includes("To") && keys.includes("Function") && keys.includes("Selector") && keys.includes("Lets") && page.text('#cslab [data-arg="0"]') === checksum(addrWord(cd, 0), kec) && page.text('#cslab [data-arg="1"]') === String(word(cd, 1)),
      "the slab prints To / Function / arguments in words, decoded from the bytes it will sign — the rows agree with the calldata, not merely with the typed value", `${keys.join(",")} arg0 ${page.text('#cslab [data-arg="0"]')} arg1 ${page.text('#cslab [data-arg="1"]')}`);
    await sign(page, W, 1);
    const sendIdx = W.firstIndex("eth_sendTransaction"), estIdx = W.calls.slice(0, sendIdx).map((x) => x.method).lastIndexOf("eth_estimateGas");
    f(W.sent() === 1 && await allowance(c, weth, TRADER, pool) === WAD, "signing sends one and the allowance is exact", `sent ${W.sent()} allowance ${await allowance(c, weth, TRADER, pool)}`);
    f(estIdx >= 0 && estIdx < sendIdx && W.calls[estIdx].params[0].data === W.calls[sendIdx].params[0].data && lower(W.calls[sendIdx].params[0].to) === lower(weth),
      "the estimate ran before the offer, on the same bytes", `est ${estIdx} send ${sendIdx}`);
    /* the receipt left the trader's rights as they were, so the lane kept the typed amount and re-quoted: the
       slab's "Then · press the same button again" can be followed — the same button is now the swap */
    await page.until(() => L(page, "#swap-go") && L(page, "#swap-go").textContent === "Swap" && !L(page, "#swap-go").disabled, 40);
    f(L(page, "#swap-in").value === "1" && L(page, "#swap-go").textContent === "Swap" && !L(page, "#swap-go").disabled && L(page, "#swap-out").dataset.raw === String(await poolQuote(c, pool, 2, true, WAD)),
      "after the approve lands the same button is the swap, and the amount is still typed", `value "${L(page, "#swap-in").value}" button "${L(page, "#swap-go").textContent}" disabled ${L(page, "#swap-go").disabled} raw ${L(page, "#swap-out").dataset.raw}`);
    /* a new amount is a new exact approve, never a cumulative one */
    await quote(page, "2");
    await page.until(() => /^Approve\b/.test(page.text("#lane-swap #swap-go")), 40);
    await press(page, L(page, "#swap-go"));
    f(word(slabCd(page), 1) === 2n * WAD && page.text("#cslab [data-function]") === APPROVE, "a new amount re-proposes a new exact approve, not a cumulative one", slabCd(page));
    page.click(page.$("#cslab [data-no]")); await page.settle();
    /* an ETH leg: no approve step, the typed ether rides as value, exactly */
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "1");
    const go2 = L(page, "#swap-go");
    f(L(page, "#swap-sym-in").textContent === "ETH" && go2.textContent === "Swap", "an ETH leg needs no approval: the button reads Swap", go2.textContent);
    await press(page, go2);
    f(page.text("#cslab [data-function]") === SWAP_IN && page.$("#cslab [data-value]") && page.$("#cslab [data-value]").dataset.wei === String(WAD) && word(slabCd(page), 2) === WAD && word(slabCd(page), 1) === 0n,
      "the ETH leg is the slab's Value, equal to the typed ether in wei", `${page.text("#cslab [data-function]")} wei ${page.$("#cslab [data-value]") && page.$("#cslab [data-value]").dataset.wei}`);
    page.click(page.$("#cslab [data-no]")); await page.settle();
    f(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the trader's page", page.errors.map((x) => x.message).join("; "));
    page.close();
  }
  t.ok(F, "every approval the slab builds is exact");

  /*═══════════ G · a non-holder sees the custom error before the wallet opens ═══════════*/
  t.head("G · a non-holder sees the custom error before the wallet opens");
  let G = true;
  const g = (cond, name, d) => { t.ok(cond, name, d); G = G && !!cond; };
  {
    /* the gate is in propose, not in the button: the renter of #3 */
    const W = walletFor(c, renter);
    const { page, ctx: vctx } = await bootToken(3, { wallet: W });
    await lane(page, "swap");
    const none = LL(page, "[data-act=setFee]").length === 0 && LL(page, "[data-act]").every((b) => b.dataset.act === "swap");
    const est0 = W.count("eth_estimateGas");
    await vctx.INTACT.ui.propose({ to: pool, key: "pool.setFee", args: [3n, 25n], need: 1, lines: [["Fee", "25 bps"]], sentence: "sets the fee" }); await page.settle();
    g(none && !slabOpen(page) && W.count("eth_estimateGas") === est0 && tick(page) === "you are the user; only the holder may act as it" && page.$("body").dataset.rights === "4",
      "the gate is in propose, not in the button: the renter gets no control and propose refuses with the renter's sentence", `acts ${LL(page, "[data-act]").map((b) => b.dataset.act).join(",")} tick "${tick(page)}" rights ${page.$("body").dataset.rights}`);
    page.close();
  }
  {
    /* the holder of #4 under an unknown 7702 delegate */
    await c.vm.stateManager.putCode(createAddressFromString(delegated.from.toString()), Buffer.from("ef0100" + "de".repeat(20), "hex"));
    const W = walletFor(c, delegated);
    const { page, ctx: vctx } = await bootToken(4, { wallet: W });
    await lane(page, "swap");
    const d = vctx.INTACT.ui.delegate();
    const tx = { to: pool, key: "pool.setFee", args: [4n, 25n], need: 1, spend: true, lines: [["Fee", "25 bps"]], sentence: "sets the fee" };
    await vctx.INTACT.ui.propose(tx); await page.settle();
    const refused = !slabOpen(page) && /acknowledge it on Identity first/.test(tick(page)) && W.count("eth_estimateGas") === 0;
    vctx.INTACT.ui.ackDelegate(); await page.settle();
    const p = vctx.INTACT.ui.propose(tx);
    await page.until(() => slabOpen(page), 40);
    g(!!d && d.known === false && d.acked === true && refused && slabOpen(page) && LL(page, "#swap-open-form").length === 1,
      "a holder under an unknown 7702 delegate is refused until acknowledged on Identity; then the same call raises the slab", `delegate ${JSON.stringify(d)} refused ${refused} slab ${slabOpen(page)}`);
    page.click(page.$("#cslab [data-no]")); await p; await page.settle();
    page.close();
  }
  {
    const W = walletFor(c, me);
    const { page, S } = await bootToken(2, { wallet: W });
    await lane(page, "swap");
    /* the holder opens the fee form and presses; the estimate passes */
    page.type(L(page, "#swap-your-market input[name=feeBps]"), "25");
    await press(page, L(page, "[data-act=setFee]"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    const passed = gasRow(page);
    /* the sale lands under the open slab — between the estimate and the press */
    await c.exec(hub, "transferFrom(address,address,uint256)", [ME, BUYER, 2], { label: "transferFrom" });
    const mark = W.calls.length;
    page.click(page.$("#cslab [data-go]"));
    await page.until(() => !slabOpen(page), 60); await page.settle();
    const epochReads = W.callsTo(hub, sel("custodyEpoch(uint256)")).map((x) => W.calls.indexOf(x)).filter((i) => i >= mark);
    /* W13: "closes the slab" was the wait's alone; the sentence now checks it */
    g(/^\d+ units$/.test(passed) && epochReads.length === 1 && !slabOpen(page) && /ownership or epoch changed — review again/.test(tick(page)) && W.sent() === 0 && W.prompts().length === 0,
      "the epoch is re-read immediately before Sign, and a changed epoch closes the slab unsent", `gas "${passed}" epochReads ${epochReads.length} tick "${tick(page)}" sent ${W.sent()}`);
    /* the page still believes its stale rights; the chain does not */
    await page.until(() => !!L(page, "#swap-your-market input[name=feeBps]"), 40);
    page.type(L(page, "#swap-your-market input[name=feeBps]"), "25");
    await press(page, L(page, "[data-act=setFee]"));
    g(gasRow(page) === "would revert: NotActor()", "the slab's estimate names the error", gasRow(page));
    g(page.$("#cslab [data-go]").disabled === true, "Sign is disabled when the estimate reverted");
    g(W.prompts().length === 0 && W.sent() === 0, "no prompt was reached", W.prompts().map((p) => p.method).join(","));
    g(S.err[sel("NotActor()")] === "NotActor()" && !/NotActor/.test(DIST) && !/NotActor/.test(DIST_PANELS), "the name came from the table the chain wrote, not from the shipped bytes");
    page.click(page.$("#cslab [data-no]")); await page.settle();
    W.override("eth_estimateGas", () => { throw revert(ctx.revertWith("Slippage(uint256,uint256)", 9n, 10n)); });
    await press(page, L(page, "[data-act=setFee]"));
    g(gasRow(page) === "would revert: Slippage(9, 10)" && page.$("#cslab [data-go]").disabled === true, "an error with arguments prints them decoded", gasRow(page));
    page.click(page.$("#cslab [data-no]")); await page.settle();
    W.override("eth_estimateGas", () => { throw revert("0xdeadbeef"); });
    await press(page, L(page, "[data-act=setFee]"));
    g(gasRow(page) === "would revert: unknown error 0xdeadbeef" && page.$("#cslab [data-go]").disabled === true, "an unknown selector is still a sentence", gasRow(page));
    page.click(page.$("#cslab [data-no]")); await page.settle();
    W.override("eth_estimateGas", null);
    /* rights are recomputed after the receipt: the old holder swaps ETH in (anyone may), and learns */
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "0.1");
    await page.until(() => L(page, "#swap-go") && !L(page, "#swap-go").disabled && L(page, "#swap-go").textContent === "Swap", 40);
    await press(page, L(page, "#swap-go"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 1);
    const rcpt = W.lastIndex("eth_getTransactionReceipt"), rights = W.callsTo(hub, sel("rightsOf(uint256,address)"));
    const lastRights = rights.length ? W.calls.indexOf(rights[rights.length - 1]) : -1;
    g(W.sent() === 1 && rcpt >= 0 && lastRights > rcpt && page.$("body").dataset.rights === "0" && /ownership or epoch changed — review again/.test(tick(page)) && LL(page, "[data-act=setFee]").length === 0,
      "rights are recomputed after the receipt: the old holder reads 0, is told to review again, and the fee form is gone", `rcpt ${rcpt} rights ${lastRights} body ${page.$("body").dataset.rights} tick "${tick(page)}"`);
    page.close();
  }
  {
    /*  a trader too big for the market, told before any prompt; the chain's own quote agrees. The
        cap is on the OUTGOING reserve (Pool.MAX_OUT_BPS: no trade takes more than half of it), so
        the amount that trips it is measured here, not assumed: on a constant-product market of
        100 WETH / 10 ETH, 60 WETH in quotes 3.80 ETH (under the 5 ETH cap) and 150 WETH quotes 6 */
    const W = walletFor(c, trader);
    const { page } = await bootToken(2, { wallet: W });
    await lane(page, "swap");
    const m = await c.read(pool, "marketOf(uint256)", [2]), rIn = decUint(m, 2), rOut = decUint(m, 3);
    const under = await c.simulate(pool, enc("quote(uint256,bool,uint256)", [2n, true, 60n * WAD]), { from: TRADER });
    const over = await c.simulate(pool, enc("quote(uint256,bool,uint256)", [2n, true, 150n * WAD]), { from: TRADER });
    await quote(page, "150");
    g(under.ok && decUint(under.data) <= rOut / 2n && !over.ok && over.data.slice(0, 10) === sel("TradeTooLarge()") && 150n * WAD > rIn &&
      /more than half/.test(L(page, "#swap-out").textContent) && !L(page, "#swap-out").dataset.raw && L(page, "#swap-go").disabled === true && W.prompts().length === 0,
      "a trader too big for the market is told so before any prompt — and the chain's own quote reverts TradeTooLarge for it (60 WETH is under the half-reserve cap, 150 is over)",
      `"${L(page, "#swap-out").textContent}" under ${under.ok && decUint(under.data)} of ${rOut} over ${over.data && over.data.slice(0, 10)}`);
    page.close();
  }
  t.ok(G, "a non-holder sees the custom error before the wallet opens");

  /*═══════════ H · the swap slab states the floor in words ═══════════*/
  t.head("H · the swap slab states the floor in words");
  let H = true;
  const h = (cond, name, d) => { t.ok(cond, name, d); H = H && !!cond; };
  {
    const W = walletFor(c, trader);
    const { page, S } = await bootToken(2, { wallet: W });
    await lane(page, "swap");
    await quote(page, "1");
    const q = await poolQuote(c, pool, 2, true, WAD), minOut = q - q * 50n / 10000n;
    const out = L(page, "#swap-out");
    h(out.dataset.raw === String(q) && out.textContent.endsWith(" ETH") && toUnits(out.textContent.replace(/ ETH$/, "")) === q, "the quote is Pool.quote to the unit, and the words re-parse to it", `${out.dataset.raw} "${out.textContent}" vs ${q}`);
    const det = page.text("#lane-swap #swap-details");
    h(/rate/.test(det) && /no less than/i.test(det) && /fee/.test(det) && /30 bps/.test(det), "the details name a rate, a floor and the fee", det.slice(0, 200));
    await page.until(() => L(page, "#swap-go").textContent === "Swap" && !L(page, "#swap-go").disabled, 40);
    /* the clock is moved first: the shim pins Date.now to the block, so only a deadline read from the chain can follow the answer */
    const ts = ctx.BLOCK().timestamp;
    W.override("eth_getBlockByNumber", () => ({ number: hexN(ctx.BLOCK().number), timestamp: hexN(ts + 7777n), hash: "0x" + "11".repeat(32) }));
    const mark = W.calls.length;
    await press(page, L(page, "#swap-go"));
    const after = (m) => { for (let i = mark; i < W.calls.length; i++) if (W.calls[i].method === m) return i; return -1; };
    const slab = page.text("#cslab"), cd = slabCd(page);
    h(new RegExp("No less than\\s*" + full(minOut).replace(/\./g, "\\.") + " ETH — or nothing moves").test(slab), "the slab states the floor in words", slab.slice(0, 240));
    h(page.text("#cslab [data-function]") === SWAP_IN && word(cd, 3) === minOut && word(cd, 1) === 1n && word(cd, 2) === WAD && word(cd, 0) === 2n, "the floor in the calldata is the floor in the words", `word3 ${word(cd, 3)} vs ${minOut}`);
    h(/Dies\s*in fifteen minutes/.test(slab) && word(cd, 5) === ts + 7777n + 900n && after("eth_getBlockByNumber") >= 0 && after("eth_getBlockByNumber") < after("eth_estimateGas"),
      "the deadline is fifteen minutes, exactly, on the chain's clock — read after the press and before the estimate", `word5 ${word(cd, 5)} vs ${ts + 7777n + 900n}; block ${after("eth_getBlockByNumber")} est ${after("eth_estimateGas")}`);
    h(lower(addrWord(cd, 4)) === lower(TRADER) && page.text('#cslab [data-arg="4"]') === checksum(TRADER, kec), "the recipient is the connected account", addrWord(cd, 4));
    W.override("eth_getBlockByNumber", null);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    /* the recheck: between the slab and the press the holder sells 5 WETH into the market, and the
       trader's quote falls below the floor the slab states — Sign is refused with a sentence, unsent */
    await c.exec(pool, SWAP_IN, [2, true, 5n * WAD, 0n, ME, now() + 60n], { label: "swapExactIn" });
    const mark2 = W.calls.length;
    page.click(page.$("#cslab [data-go]")); await page.until(() => !slabOpen(page), 60); await page.settle();
    const requotes = W.callsTo(pool, sel("quote(uint256,bool,uint256)")).map((x) => W.calls.indexOf(x)).filter((i) => i >= mark2);
    const q2 = await poolQuote(c, pool, 2, true, WAD), minOut2 = q2 - q2 * 50n / 10000n;
    h(!slabOpen(page) && W.sent() === 0 && W.prompts().length === 0 && requotes.length === 1 && q2 < minOut && /the price moved past the floor — review again/.test(tick(page)),
      "a price that moved past the floor between the slab and the press is a sentence at the press, not a Slippage revert after the signature", `quote ${q} → ${q2} floor ${minOut}; requotes ${requotes.length}; tick "${tick(page)}"`);
    await press(page, L(page, "#swap-go"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    h(word(slabCd(page), 3) === minOut2 && new RegExp("No less than\\s*" + full(minOut2).replace(/\./g, "\\.") + " ETH").test(page.text("#cslab")), "pressing again re-quotes: the new floor follows the moved price, in the bytes and in the words", `${word(slabCd(page), 3)} vs ${minOut2}`);
    /* a re-quote that does not answer at the press: the stale floor is not sent in silence — the slab closes with a sentence */
    W.answer(pool, sel("quote(uint256,bool,uint256)"), () => { throw new Error("down"); });
    page.click(page.$("#cslab [data-go]")); await page.until(() => !slabOpen(page), 60); await page.settle();
    W.answer(pool, sel("quote(uint256,bool,uint256)"), null);
    h(!slabOpen(page) && W.sent() === 0 && W.prompts().length === 0 && /the market could not be re-quoted at the press — review again/.test(tick(page)),
      "a re-quote that does not answer at the press is a sentence, not a silent send of the stale floor", `sent ${W.sent()} tick "${tick(page)}"`);
    await press(page, L(page, "#swap-go"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    const b0 = await c.balanceOf(TRADER);
    await sign(page, W, 1);
    const receipt = [...W.receipts.values()].pop();
    const delta = (await c.balanceOf(TRADER)) - b0;
    h(W.sent() === 1 && receipt.status === "0x1" && delta >= minOut2 && /landed in block/.test(tick(page)), "the swap lands and honours the floor", `status ${receipt.status} delta ${delta} minOut ${minOut2} tick "${tick(page)}"`);
    h(await allowance(c, weth, TRADER, pool) === 0n, "F8 · the swap spends the exact allowance to zero", await allowance(c, weth, TRADER, pool));
    const rcpt = W.lastIndex("eth_getTransactionReceipt"), rights = W.callsTo(hub, sel("rightsOf(uint256,address)"));
    h(rights.length && W.calls.indexOf(rights[rights.length - 1]) > rcpt, "rights are recomputed after the trader's receipt too");
    /* the receipt repainted the lane; what follows is typed afresh */
    await page.until(() => L(page, "#swap-in") && L(page, "#swap-in").value === "", 40);
    await quote(page, "not a number");
    h(L(page, "#swap-go").disabled === true && L(page, "#swap-out").textContent === "" && !L(page, "#swap-out").dataset.raw && !/NaN/.test(page.$("body").textContent) && /not a number/.test(page.text("#lane-swap #swap-details")),
      "nonsense is refused, never sent, never NaN", page.text("#lane-swap #swap-details"));
    await quote(page, "150");
    h(/more than half/.test(L(page, "#swap-out").textContent) && L(page, "#swap-go").disabled === true && !L(page, "#swap-out").dataset.raw, "a trade over half the reserve is a sentence, not a number", L(page, "#swap-out").textContent);
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "0.5");
    await press(page, L(page, "#swap-go"));
    h(L(page, "#swap-sym-in").textContent === "ETH" && L(page, "#swap-sym-out").textContent === "WETH" && word(slabCd(page), 1) === 0n && page.$("#cslab [data-value]").dataset.wei === String(WAD / 2n),
      "flipping turns the pair round: ETH in, baseIn 0, the ether as value", `${L(page, "#swap-sym-in").textContent} baseIn ${word(slabCd(page), 1)}`);
    page.click(page.$("#cslab [data-no]")); await page.settle();
    /* a clock that will not answer: no deadline is guessed, no slab is raised */
    W.refuse("eth_getBlockByNumber", new Error("down"));
    const sent0 = W.sent(), est0 = W.count("eth_estimateGas");
    page.click(L(page, "#swap-go")); await page.settle(); await page.settle(); await page.settle();
    h(!slabOpen(page) && /the chain's clock could not be read/.test(tick(page)) && W.count("eth_estimateGas") === est0 && W.sent() === sent0 && L(page, "#swap-go").disabled === true,
      "a clock that could not be read raises no slab: the ticker says so and nothing is guessed", `slab ${slabOpen(page)} tick "${tick(page)}"`);
    W.override("eth_getBlockByNumber", null);
    void S;
    page.close();
  }
  {
    /* the sniper fee as a countdown on #3, gone after its window; the sniper field exists only in the open form */
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(3, { wallet: W });
    await lane(page, "swap");
    const sn = L(page, "#swap-sniper");
    const before = sn ? sn.textContent : "";
    const openFields = LL(page, "[name=sniperBps]").length;   // #3's market is open: no open form, so no sniper field
    ctx.warpBy(601);
    await repaint(page, vctx);
    const gone = L(page, "#swap-sniper") === null && !/sniper.*\d+ s/.test(laneText(page));
    page.close();
    const { page: p1 } = await bootToken(1, { wallet: walletFor(c, me) });
    await lane(p1, "swap");
    const fields = LL(p1, "[name=sniperBps]");
    h(/sniper.*\d+ s left/.test(before) && /500 bps/.test(before) && gone, "the sniper fee shows as a countdown while it runs, and is gone after its window", `before "${before}" gone ${gone}`);
    h(openFields === 0 && fields.length === 1 && fields.every((x) => !!x.closest("#swap-open-form")) && LL(p1, "#swap-open-form").length === 1,
      "the open form is the only place a sniper field exists", `open market ${openFields}; closed market ${fields.length}`);
    p1.close();
  }
  {
    /* a live seal hides the terms: the new holder seals #2 and reads the lane */
    await buyer.exec(pool, "sealMarket(uint256,uint64)", [2, now() + 86400n], { label: "sealMarket" });
    const W = walletFor(c, buyer);
    const { page } = await bootToken(2, { wallet: W });
    await lane(page, "swap");
    const hidden = ["setFee", "syncCurve", "sealMarket", "withdraw", "closeMarket"].reduce((n, a) => n + LL(page, "[data-act=" + a + "]").length, 0);
    h(page.$("body").dataset.rights === "1" && hidden === 0 && LL(page, "[data-act=deposit]").length === 1 && LL(page, "[data-act=writeDown]").length === 1 &&
      /sealed until/.test(page.text("#facts [data-fact=market]")) && /sealed until/.test(laneText(page)) && /closing is refused while the seal stands/.test(laneText(page)),
      "a live seal hides the terms — fee, curve, seal, withdraw and close are gone; deposit and write-down stay; Home and the lane say sealed until", `hidden ${hidden} market "${page.text("#facts [data-fact=market]")}"`);
    page.close();
  }
  {
    /* exact-out (D19): the ceiling is approved exactly, the pull is less, and the residue is offered back to zero */
    const W = walletFor(c, trader);
    const { page } = await bootToken(2, { wallet: W });
    await lane(page, "swap");
    page.click(L(page, "#swap-exact")); await page.settle();
    await quote(page, "0.01");
    const need = decUint(await c.read(pool, "quoteExactOut(uint256,bool,uint256)", [2, true, WAD / 100n]));
    const maxIn = need + need * 50n / 10000n;
    await page.until(() => /^Approve\b/.test(page.text("#lane-swap #swap-go")), 40);
    h(L(page, "#swap-out").dataset.raw === String(need) && /pay at most/.test(page.text("#lane-swap #swap-details")) && /^Approve\b/.test(L(page, "#swap-go").textContent),
      "exact-out quotes what it costs and approves the ceiling as the current step", `${L(page, "#swap-out").dataset.raw} vs ${need}; "${L(page, "#swap-go").textContent}"`);
    await press(page, L(page, "#swap-go"));
    h(page.text("#cslab [data-function]") === APPROVE && word(slabCd(page), 1) === maxIn, "the exact-out approve is exactly the ceiling, never more", `${word(slabCd(page), 1)} vs ${maxIn}`);
    await sign(page, W, 1);
    /* the approve landed with the rights unchanged: the typed 0.01 stays and the button's step moves to Swap */
    await page.until(() => L(page, "#swap-go").textContent === "Swap" && !L(page, "#swap-go").disabled && L(page, "#swap-in").value === "0.01", 40);
    /* W13: this was a wait with no sentence, its claim in the comment above; it is a claim of the lane, so it is one */
    t.ok(L(page, "#swap-go").textContent === "Swap" && !L(page, "#swap-go").disabled && L(page, "#swap-in").value === "0.01",
      "after the exact-out approve lands the same button is the swap, and 0.01 is still typed", `button "${L(page, "#swap-go").textContent}" value "${L(page, "#swap-in").value}"`);
    await press(page, L(page, "#swap-go"));
    const cd = slabCd(page);
    h(page.text("#cslab [data-function]") === SWAP_OUT && word(cd, 2) === WAD / 100n && word(cd, 3) === maxIn && /Pay at most\s*/.test(page.text("#cslab")) && new RegExp(full(maxIn).replace(/\./g, "\\.") + " WETH — or nothing moves").test(page.text("#cslab")),
      "exact-out proposes swapExactOut with the ceiling in the words and in the calldata", `fn ${page.text("#cslab [data-function]")} w3 ${word(cd, 3)} vs ${maxIn}`);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 2);
    await page.until(() => LL(page, "[data-act=approveZero]").length === 1, 80);
    const left = await allowance(c, weth, TRADER, pool);
    const rcptIdx = W.lastIndex("eth_getTransactionReceipt");
    const alReads = W.callsTo(weth, sel("allowance(address,address)")).map((x) => W.calls.indexOf(x)).filter((i) => i > rcptIdx);
    h(left > 0n && left === maxIn - need && alReads.length >= 1 && LL(page, "[data-act=approveZero]").length === 1 && /pulled less than approved/.test(laneText(page)),
      "exact-out offers to zero the residue: the allowance is re-read after the receipt and a control appears", `left ${left} vs ${maxIn - need}; reads after receipt ${alReads.length}`);
    await press(page, L(page, "[data-act=approveZero]"));
    h(page.text("#cslab [data-function]") === APPROVE && word(slabCd(page), 1) === 0n && lower(addrWord(slabCd(page), 0)) === lower(pool) && page.text('#cslab [data-arg="1"]') === "0",
      "the residue slab's amount word is zero", slabCd(page));
    page.click(page.$("#cslab [data-no]")); await page.settle();
    page.close();
  }
  t.ok(H, "the swap slab states the floor in words");

  /*═══════════ O1 · escaping: the hostile symbol is text ═══════════*/
  t.head("O1 · escaping: a coin named </script><script>alert(1)</script> as #1's base");
  {
    const coin = await c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode, encodeParams("string,string,uint8,uint256,bool", ["Hostile", HOSTILE, 18, 0, false]), "coin");
    await c.exec(coin, "mint(address,uint256)", [ME, 10n ** 24n]);
    await c.exec(coin, "approve(address,uint256)", [pool, 10n ** 24n]);
    await c.exec(pool, OPEN, [1, coin, ZERO, 30, 0, 0, 0], { label: "openMarket" });
    await c.exec(pool, DEPOSIT, [1, 10n ** 21n, 10n ** 18n], { value: 10n ** 18n, label: "deposit" });
    const { page, S } = await bootToken(1, { wallet: walletFor(c, me) });
    await lane(page, "swap");
    /*  the chain caps a symbol at 32 bytes (Web.symbolOf), so the baked symbol is the hostile
        string's first 32 characters — the panel prints what the block carries, as text */
    const sym = L(page, "#swap-sym-in"), baked = S.ownedMarket.baseSymbol;
    t.ok(HOSTILE.startsWith(baked) && baked.includes("</script>") && !!sym && sym.textContent === baked && sym.children.length === 0 && LL(page, "script").length === 0 &&
      /<\/script>/.test(laneText(page)) && page.innerHTMLWrites === 0 && page.errors.length === 0,
      "the symbol is text in the swap card", `"${sym && sym.textContent}" baked "${baked}" children ${sym && sym.children.length} errors ${page.errors.map((x) => x.message).join("; ")}`);
    page.close();
  }

  /*═══════════ X · Elsewhere through the Reach (site3, holder) ═══════════*/
  t.head("X · Elsewhere through the Reach (site3, the holder of #2)");
  {
    const m3 = c3.c, s3 = c3.site, w3 = c3.weth, reach2 = c3.reach2;
    const W = walletFor(m3, m3);
    const { page, S, ctx: vctx } = await c3.bootToken(2, { wallet: W });
    await c3.lane(page, "swap");
    await quote(page, "1");
    page.click(L(page, "[data-tab=elsewhere]")); await page.settle();
    await page.until(() => LL(page, "[data-act=swapElsewhere]").length === 1 && L(page, "#swap-elsewhere").hidden === false, 60);
    const ts = ctx.BLOCK().timestamp;
    W.override("eth_getBlockByNumber", () => ({ number: hexN(ctx.BLOCK().number), timestamp: hexN(ts + 7777n), hash: "0x" + "11".repeat(32) }));
    await press(page, L(page, "[data-act=swapElsewhere]"));
    const slab = page.text("#cslab"), cd = slabCd(page), body = cd.slice(10);
    /* the TypedCall: w0 = 0x20, then the tuple (to, value, →data, →spend, →receiveMin, deadline) and its tails */
    const at = (byte) => BigInt("0x" + body.slice(byte * 2, byte * 2 + 64));
    const addrAt = (byte) => "0x" + body.slice(byte * 2 + 24, byte * 2 + 64);
    const tup = Number(at(0));
    const to = addrAt(tup), value = at(tup + 32), offData = Number(at(tup + 64)), offSpend = Number(at(tup + 96)), offRecv = Number(at(tup + 128)), deadline = at(tup + 160);
    const dataLen = Number(at(tup + offData));
    const inner = "0x" + body.slice((tup + offData + 32) * 2, (tup + offData + 32) * 2 + dataLen * 2);
    const spendN = Number(at(tup + offSpend)), spendAsset = addrAt(tup + offSpend + 32), spendAmt = at(tup + offSpend + 64);
    const recvN = Number(at(tup + offRecv)), recvAsset = addrAt(tup + offRecv + 32), recvAmt = at(tup + offRecv + 64);
    /* the inner router.swap: selector, w0 = 0x20, then the request (venue, tokenIn, tokenOut, amountIn, minOut, deadline, poolKey, →path, PoolKey ×5, sqrtLimit, path) */
    const venue = word(inner, 1), tin = addrWord(inner, 2), tout = addrWord(inner, 3), amountIn = word(inner, 4), minOut = word(inner, 5), iDeadline = word(inner, 6), poolKey = word(inner, 7);
    const rq = await routerQuote(m3, ROUTER_PIN, w3, ZERO, WAD, 2n);
    const expectMin = rq.received - rq.received * 50n / 10000n;
    t.ok(lower(page.text("#cslab [data-to]")) === lower(S.reach) && lower(S.reach) === lower(reach2) && page.text("#cslab [data-function]") === TYPED && lower(to) === ROUTER_PIN && value === 0n,
      "the elsewhere swap is proposed to the Reach, as executeTyped, calling the Router with no value for an ERC-20 input", `to ${page.text("#cslab [data-to]")} fn ${page.text("#cslab [data-function]")} inner to ${to}`);
    t.ok(inner.slice(0, 10) === lower(S.sel["router.swap"]) && venue === 0n && lower(tin) === lower(w3) && lower(tout) === ZERO && amountIn === WAD && poolKey === 2n && word(inner, 8) === 448n,
      "the inner call is the Router's swap of the pair through its own pool, the market keyed by the id", `sel ${inner.slice(0, 10)} venue ${venue} in ${tin} out ${tout} amount ${amountIn} key ${poolKey}`);
    t.ok(spendN === 1 && lower(spendAsset) === lower(w3) && spendAmt === WAD && recvN === 1 && lower(recvAsset) === ZERO && recvAmt === expectMin && minOut === expectMin &&
      argsAgree(page, TYPED) && /Spend/.test(slab) && /Receive at least/.test(slab) && /Dies/.test(slab) && new RegExp(full(expectMin).replace(/\./g, "\\.") + " ETH — or nothing moves").test(slab),
      "spend and receive floors are the typed amount and the Router's own quote less half a percent — in the bytes, in the words, and in the tuple's argument row decoded from the bytes", `spend ${spendAsset} ${spendAmt}; recv ${recvAsset} ${recvAmt} vs ${expectMin}; args ${page.$$("#cslab [data-arg]").map((r) => r.textContent).join(" | ").slice(0, 200)}`);
    t.ok(deadline === ts + 7777n + 900n && iDeadline === deadline && /Dies\s*in fifteen minutes/.test(slab), "the deadline word is the chain's, in the TypedCall and in the request alike", `${deadline} vs ${ts + 7777n + 900n}`);
    W.override("eth_getBlockByNumber", null);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 60);
    const b0 = await m3.balanceOf(reach2);
    await sign(page, W, 1);
    const receipt = [...W.receipts.values()].pop();
    t.ok(receipt.status === "0x1" && await allowance(m3, w3, reach2, ROUTER_PIN) === 0n && await allowance(m3, w3, ROUTER_PIN, s3.pool) === 0n,
      "no standing allowance survives: Reach→Router and Router→Pool both read zero after the receipt", `status ${receipt.status} ${await allowance(m3, w3, reach2, ROUTER_PIN)} ${await allowance(m3, w3, ROUTER_PIN, s3.pool)}`);
    const delta = (await m3.balanceOf(reach2)) - b0;
    t.ok(delta >= expectMin && /landed in block/.test(tick(page)), "the Reach received at least the floor", `delta ${delta} floor ${expectMin} tick "${tick(page)}"`);
    /* the recheck: the holder sells 5 WETH into the market between the slab and Sign; the Router's quote falls under the
       floor the slab states, and the press is refused with a sentence — the Router re-asked once after the click, nothing sent */
    await page.until(() => !!L(page, "#swap-in"), 40);
    await quote(page, "1");
    page.click(L(page, "[data-tab=elsewhere]")); await page.settle();
    await page.until(() => LL(page, "[data-act=swapElsewhere]").length === 1, 60);
    await press(page, L(page, "[data-act=swapElsewhere]"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 60);
    const rq0 = await routerQuote(m3, ROUTER_PIN, w3, ZERO, WAD, 2n), floor1 = typedRecv(slabCd(page));
    await m3.exec(s3.pool, SWAP_IN, [2, true, 5n * WAD, 0n, m3.from.toString(), now() + 60n], { label: "swapExactIn" });
    const rq1 = await routerQuote(m3, ROUTER_PIN, w3, ZERO, WAD, 2n);
    const mark3 = W.calls.length;
    page.click(page.$("#cslab [data-go]")); await page.until(() => !slabOpen(page), 60); await page.settle();
    const reasks = W.callsTo(ROUTER_PIN, sel("quoteExactIn(" + REQ + ")")).map((x) => W.calls.indexOf(x)).filter((i) => i >= mark3);
    t.ok(!slabOpen(page) && W.sent() === 1 && reasks.length === 1 && floor1 === rq0.received - rq0.received * 50n / 10000n && rq1.received < floor1 && /the Router's price moved past the floor — review again/.test(tick(page)),
      "a Router quote that moved past the floor between the slab and the press is a sentence at the press, not a Slippage revert after the signature", `quote ${rq0.received} → ${rq1.received} floor ${floor1}; re-asks ${reasks.length}; sent ${W.sent()}; tick "${tick(page)}"`);
    /* the card is the input both tabs quote from: on Elsewhere it is still there to type, flip and toggle (it once hid with
       the owned half, and a person on this tab could do none of the three; the shim clicking hidden nodes had hidden that) */
    t.ok(!!L(page, "#swap-elsewhere") && !L(page, "#swap-elsewhere").closest("[hidden]") && !!L(page, "#swap-card") && !L(page, "#swap-card").closest("[hidden]") && !L(page, "#swap-flip").closest("[hidden]") && !L(page, "#swap-in").closest("[hidden]"),
      "on the Elsewhere tab the swap card is still there to type, flip and toggle", L(page, "#swap-card") ? "card under [hidden]: " + !!L(page, "#swap-card").closest("[hidden]") : "no card");
    /* a sealed Reach: the native route hides and says why */
    await m3.exec(reach2, "seal(uint64)", [now() + 30n * 86400n], { label: "seal" });
    await repaint(page, vctx);
    await page.until(() => !!L(page, "#swap-flip"), 40);
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "0.1");
    page.click(L(page, "[data-tab=elsewhere]")); await page.settle();
    await page.until(() => /nothing native leaves/.test(laneText(page)), 60);
    t.ok(L(page, "#swap-sym-in").textContent === "ETH" && LL(page, "[data-act=swapElsewhere]").length === 0 && /sealed until/.test(laneText(page)) && /nothing native leaves/.test(laneText(page)),
      "a sealed Reach hides the native route and says why", laneText(page).slice(-200));
    /* a manifest asset is hidden under the seal too */
    await m3.exec(reach2, "guard(address)", [w3], { label: "guard" });
    await repaint(page, vctx);
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "1");
    page.click(L(page, "[data-tab=elsewhere]")); await page.settle();
    await page.until(() => /on the Reach's manifest/.test(laneText(page)), 60);
    t.ok(L(page, "#swap-sym-in").textContent === "WETH" && LL(page, "[data-act=swapElsewhere]").length === 0 && /on the Reach's manifest/.test(laneText(page)),
      "a manifest asset is hidden under the seal too, and the lane names the manifest", laneText(page).slice(-200));
    /* exact-out: the Router swaps exact-in only, so the Elsewhere row says so instead of quoting what the ceiling would buy in
       the other coin beside what the owned market would charge — two numbers that would read as one comparison */
    page.click(L(page, "#swap-exact")); await page.settle();
    const mark4 = W.calls.length;
    await quote(page, "0.01");
    await page.until(() => /exact-in only/.test(page.text("#lane-swap #swap-quote-elsewhere")), 40);
    const rowE = L(page, "#swap-quote-elsewhere"), rowO = L(page, "#swap-quote-owned");
    t.ok(/exact out/.test(L(page, "#swap-exact").textContent) && /its own market.* WETH$/.test(rowO.textContent) && /through the Router.*exact-in only — switch the mode to compare$/.test(rowE.textContent) && !rowE.lastChild.dataset.raw &&
      W.callsTo(ROUTER_PIN, sel("quoteExactIn(" + REQ + ")")).map((x) => W.calls.indexOf(x)).filter((i) => i >= mark4).length === 0,
      "in exact-out mode the Elsewhere row says exact-in only rather than quote the ceiling in the other coin", `${rowO.textContent} | ${rowE.textContent}`);
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the third chain", page.errors.map((x) => x.message).join("; "));
    page.close();
  }

  /*═══════════ R · the holder's forms, pressed; a sealed market in the directory (added by review) ═══════════*/
  t.head("R · the holder's forms, pressed; a sealed market in the directory");
  {
    /* "0x0 for ETH", as the open form's labels say: #5 is minted to me and its market is closed */
    await mint(c, site, ME);
    const W = walletFor(c, me);
    const { page } = await bootToken(5, { wallet: W });
    await lane(page, "swap");
    const fields = LL(page, "#swap-open-form input"), named = (nm) => L(page, `#swap-open-form input[name=${nm}]`);
    page.type(fields[0], "0x0"); page.type(fields[1], weth); page.type(named("feeBps"), "30"); page.type(named("curveBps"), "0"); page.type(named("sniperBps"), "0"); page.type(named("sniperSeconds"), "0");
    await press(page, L(page, "[data-act=openMarket]"));
    const cd = slabCd(page);
    t.ok(page.text("#cslab [data-function]") === OPEN && word(cd, 0) === 5n && lower(addrWord(cd, 1)) === ZERO && lower(addrWord(cd, 2)) === lower(weth) && word(cd, 3) === 30n && /ETH against/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)),
      "typing 0x0 for the base coin, as the label says, is ETH in the slab — and the estimate passes", `fn ${page.text("#cslab [data-function]")} base ${addrWord(cd, 1)} gas "${gasRow(page)}"`);
    page.click(page.$("#cslab [data-no]")); await page.settle();
    page.close();
  }
  {
    /* the seal's days on #3 (open, unsealed, mine): over the cap, zero, then three days on the chain's clock */
    const W = walletFor(c, me);
    const { page } = await bootToken(3, { wallet: W });
    await lane(page, "swap");
    const days = L(page, "[data-act=sealMarket]").parentNode.querySelector("input");
    page.type(days, "366"); page.click(L(page, "[data-act=sealMarket]")); await page.settle(); await page.settle();
    const over = tick(page), overSlab = slabOpen(page);
    page.type(days, "0"); page.click(L(page, "[data-act=sealMarket]")); await page.settle(); await page.settle();
    const zero = tick(page), zeroSlab = slabOpen(page);
    page.type(days, "3"); const ts = now();
    await press(page, L(page, "[data-act=sealMarket]"));
    t.ok(over === "the number of days is capped at 365" && !overSlab && zero === "at least one day" && !zeroSlab && page.text("#cslab [data-function]") === "sealMarket(uint256,uint64)" && word(slabCd(page), 0) === 3n && word(slabCd(page), 1) === ts + 3n * 86400n && /only ever lengthens/.test(page.text("#cslab [data-sentence]")),
      "a seal over 365 days is refused with the cap sentence, zero with its own, and three days land on the chain's clock", `over "${over}" zero "${zero}" until ${word(slabCd(page), 1)} vs ${ts + 3n * 86400n}`);
    page.click(page.$("#cslab [data-no]")); await page.settle();
    page.close();
  }
  {
    /* a sealed market exists only after a graduation (verify-launch.mjs's recipe): #1 launches AGENT1 on the Kiln, the
       Launchpad raises it, four buys and a graduate open the sealed market whose beneficiary is #1; a trade sets a fee aside */
    const E = WAD, topic = (sig) => kec(Buffer.from(sig, "utf8"));
    const { kiln, launchpad: pad } = site;
    const SUPPLY = 1_000_000_000n * E, RAISE = 900_000_000n * E, CURVE = 700_000_000n * E, SALT = "0x" + "01".padStart(64, "0");
    await c.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)", [1, "Agent One", "AGENT1", 18, SUPPLY, SALT, RAISE], { label: "launch" });
    const coin = "0x" + c.getLogs({ address: kiln, topics: [topic("Launched(address,uint256,address,string,uint256,uint256)")] }).pop().topics[1].slice(26);
    const T0 = now();
    const PARAMS = "(uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8)";
    await c.exec(pad, `create(${PARAMS})`, [[1n, coin, CURVE, E, 2n * E, 0n, 1000n, (1n << 128n) - 1n, 9900, 100, 1500, 0, T0 + 7n * 86400n, 0]], { label: "create" });
    const L1 = decUint(c.getLogs({ address: pad, topics: [topic("LaunchCreated(uint256,uint256,address,uint8,bytes32)")] }).pop().topics[1]);
    await buyer.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L1, 0n, T0 + 60n, 10000], { value: E, label: "buy" });
    ctx.warp(T0 + 1000n);
    for (const [who, v] of [[trader, E], [stranger, E], [stranger, E / 2n]]) await who.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L1, 0n, T0 + 2000n, 10000], { value: v, label: "buy" });
    await renter.exec(pad, "graduate(uint256)", [L1], { label: "graduate" });
    const key = decUint(c.getLogs({ address: pad, topics: [topic("Graduated(uint256,uint256,uint256,uint256)")] }).pop().topics[2]);
    await buyer.exec(pool, SWAP_IN, [key, false, E / 10n, 0n, BUYER, now() + 60n], { value: E / 10n, label: "swapExactIn" });
    const mk = await c.read(pool, "marketOf(uint256)", [key]), owedB = decUint(mk, 13), owedQ = decUint(mk, 14);
    const sink = decAddr(await c.read(hub, "feeSink(uint256)", [1]));
    const W = walletFor(c, me);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "swap");
    await page.until(() => LL(page, "#swap-directory .sealed").length === 1 && /owes/.test(page.text("#lane-swap #swap-directory")), 80);
    const row = LL(page, "#swap-directory .sealed")[0];
    t.ok(!!row && decUint(mk, 8) === 1n && decUint(mk, 15) === 1n && owedQ > 0n && new RegExp("owes " + full(owedB) + " AGENT1 · " + full(owedQ).replace(/\./g, "\\.") + " ETH to #1's feeSink").test(row.textContent) && !/units/.test(row.textContent),
      "a sealed market's owed fees are printed in their coins' units — the launch coin by its symbol, the quote as ETH", row && row.textContent);
    await press(page, L(page, "[data-act=collect]"));
    const b0 = await c.balanceOf(sink);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    t.ok(page.text("#cslab [data-function]") === "collect(uint256)" && word(slabCd(page), 0) === key, "the collect slab names the sealed market by its key", slabCd(page).slice(0, 80));
    await sign(page, W, 1);
    const receipt = [...W.receipts.values()].pop();
    t.ok(receipt.status === "0x1" && (await c.balanceOf(sink)) - b0 === owedQ && /landed in block/.test(tick(page)), "collecting pays exactly what the row said to #1's feeSink", `delta ${(await c.balanceOf(sink)) - b0} owed ${owedQ}`);
    page.close();
  }

  await lockAndMemory(t, ctx);
}

/*═══════════ V · lock what I receive, and a memory of the trade (V2, W9) ═══════════*/
/*  docs/V2.md §3.1, §3.2: the Trade lane's two V2 parts, each where its contract reports and
    nowhere else. V0 runs on bands without them (the runner's own chain, and one whose pins hold
    code that will not answer); V1–V6 on a chain of their own whose site carries the V2
    satellites (deploySite's v2: true). The cast there: #1 and #2 to `me`; #1's market a 6-decimal
    USD against ETH, 100,000 / 50, at 30 bps with a sniper fee of 500 bps over 5,880 s (so the
    drip's floor crosses decimals and the countdown has minutes in it); #2's WETH against ETH,
    100 / 10, at 30 bps; WETH to the trader. Every id literal below refers to that chain.     */
const SAW = "swapAndWrap((uint256,bool,uint256,uint256,uint64,(uint64,uint64,uint64),address,string,(uint8,uint256,uint256,uint256)))";
const INSCRIBE = "inscribe(address,uint256,uint8,bytes,bytes32)";
const DAY = 86400n;
/// swapAndWrap's one tuple: w0 its offset, then fourteen head words (market, baseIn, amountIn, minOut, deadline,
/// start, cliff, end, to, →message, the drip's asset, market, floor, most) and the message's tail
const sawOf = (data) => {
  const h = data.slice(10), at = (i) => BigInt("0x" + h.slice(64 + i * 64, 128 + i * 64));
  const mo = 64 + Number(at(9)) * 2, len = Number(BigInt("0x" + h.slice(mo, mo + 64)));
  return { w0: BigInt("0x" + h.slice(0, 64)), market: at(0), baseIn: at(1), amountIn: at(2), minOut: at(3), deadline: at(4), start: at(5), cliff: at(6), end: at(7),
           to: "0x" + h.slice(64 + 8 * 64 + 24, 64 + 9 * 64), message: Buffer.from(h.slice(mo + 64, mo + 64 + len * 2), "hex").toString("utf8"),
           drip: { asset: at(10), market: at(11), floor: at(12), most: at(13) } };
};
/// KeepsakeView, read back from the chain: holder, creator, createdAt, the schedule, assets, paid, sold, proceeds, message, drip, lastDripBlock
const viewOf = (ret) => {
  const h = ret.replace(/^0x/, ""), base = Number(BigInt("0x" + h.slice(0, 64))) * 2, w = (i) => BigInt("0x" + h.slice(base + i * 64, base + i * 64 + 64));
  const arr = (i) => { const p = base + Number(w(i)) * 2, n = Number(BigInt("0x" + h.slice(p, p + 64))); return Array.from({ length: n }, (_, k) => ({ token: "0x" + h.slice(p + 64 + k * 128 + 24, p + 128 + k * 128), amount: BigInt("0x" + h.slice(p + 128 + k * 128, p + 192 + k * 128)) })); };
  const mp = base + Number(w(10)) * 2, ml = Number(BigInt("0x" + h.slice(mp, mp + 64)));
  return { holder: "0x" + h.slice(base + 24, base + 64), creator: "0x" + h.slice(base + 88, base + 128), start: w(3), cliff: w(4), end: w(5), assets: arr(6),
           message: Buffer.from(h.slice(mp + 64, mp + 64 + ml * 2), "hex").toString("utf8"), drip: { asset: w(11), market: w(12), floor: w(13), most: w(14) } };
};
/// a detail line that may carry BigInts
const js = (o) => JSON.stringify(o, (k, v) => typeof v === "bigint" ? String(v) : v);
/// the Journal's Inscribed log: topics (collection, id, n); data (kind, author, epoch, ref, root, body)
const inscribedOf = (l) => {
  const d = l.data.slice(2), w = (i) => d.slice(i * 64, i * 64 + 64), off = Number(BigInt("0x" + w(5))) * 2, len = Number(BigInt("0x" + d.slice(off, off + 64)));
  return { collection: "0x" + l.topics[1].slice(26), id: BigInt(l.topics[2]), n: BigInt(l.topics[3]), kind: BigInt("0x" + w(0)), author: "0x" + w(1).slice(24), ref: "0x" + w(3),
           body: Buffer.from(d.slice(off + 64, off + 64 + len * 2), "hex").toString("utf8"), tx: l.transactionHash };
};

export async function lockAndMemory(t, ctx) {
  const { walletFor, mint, encodeParams, decUint, kec, sel, ZERO, A } = ctx;
  const L = (pg, s) => pg.$("#lane-swap " + s), LL = (pg, s) => pg.$$("#lane-swap " + s);
  const open = (pg) => pg.$("#cbox").classList.contains("on");
  const cdOf = (pg) => pg.text("#cslab [data-calldata]"), gasOf = (pg) => pg.text("#cslab [data-gas]"), tickOf = (pg) => pg.text("#tick");
  const quote = async (pg, v) => {
    pg.type(L(pg, "#swap-in"), v);
    await pg.until(() => L(pg, "#swap-out").textContent !== "" || /not a number|an amount of/.test(pg.text("#lane-swap #swap-details")), 80);
    await pg.settle(); await pg.settle();
  };
  const press = async (pg, el) => { pg.click(el); await pg.until(() => open(pg) && gasOf(pg) !== "estimating…", 120); };
  const sign = async (pg, W, n) => { pg.click(pg.$("#cslab [data-go]")); await pg.until(() => W.sent() === n, 120); await pg.settle(); await pg.settle(); await pg.settle(); };
  const put = (pg, name, v) => pg.type(L(pg, `[name=${name}]`), v);
  const flipOn = async (pg, id) => { pg.click(L(pg, "#" + id)); await pg.settle(); };
  const cks = (a) => checksum(a, kec);
  /* W14: the shipped shell, for the rules that moved into it from this panel; a slab line by its key */
  const DIST = ctx.fs.readFileSync(ctx.path.join(ctx.ROOT, "dist/app.html"), "utf8");
  const lineOf = (pg, k) => { const r = pg.$$("#cslab .kv").find((x) => x.firstChild && x.firstChild.textContent === k); return r ? r.lastChild.textContent : null; };
  const date = (s) => new Date(Number(s) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const topic = (s) => kec(Buffer.from(s, "utf8"));
  const WRAPPED = topic("Wrapped(uint256,address,address,uint64,uint64,uint64,uint256,string)");
  const INSCRIBED = topic("Inscribed(address,uint256,uint256,uint8,address,uint64,bytes32,bytes32,bytes)");

  /*─────── V0 · the chip rule: a part appears only where its contract reports ───────*/
  t.head("V0 · on a band without the Keepsake and the Journal, their chips stand where the parts would");
  let V0 = true;
  const v0 = (cond, name, d) => { t.ok(cond, name, d); V0 = V0 && !!cond; };
  {
    /* the runner's chain: V1 only, the two pins codeless placeholders; #3 is still me's, its market open */
    const { trader } = ctx.actors;
    const Wt = walletFor(ctx.c, trader);
    const { page, S } = await ctx.bootToken(3, { wallet: Wt });
    await ctx.lane(page, "swap");
    const chip = L(page, "#swap-lock .chip");
    v0((S.absent & S.bits.keepsake) !== 0 && !!chip && chip.textContent === "keepsake: not deployed on this chain" && chip.dataset.state === "absent" && !L(page, "#swap-lock-on") && !L(page, "#swap-memory"),
      "without a Keepsake the lock is its chip, not deployed on this chain — and a trader is offered no memory at all", chip && chip.textContent);
    page.close();
    const W = walletFor(ctx.c, ctx.actors.me);
    const { page: p2, S: S2 } = await ctx.bootToken(3, { wallet: W });
    await ctx.lane(p2, "swap");
    const jc = L(p2, "#swap-memory .chip");
    v0(!!jc && jc.textContent === "journal: not deployed on this chain" && jc.dataset.state === "absent" && !L(p2, "#swap-memory textarea"),
      "and to the holder the memory is the journal's chip, not deployed on this chain", jc && jc.textContent);
    const sent = [...Wt.calls, ...W.calls].filter((x) => ["eth_call", "eth_estimateGas"].includes(x.method) && [S.keepsake, S2.journal, S.journal, S2.keepsake].map(lower).includes(lower(x.params[0].to)));
    v0(sent.length === 0, "no read is sent to either codeless address", sent.map((x) => x.method + " " + x.params[0].to).join(", "));
    p2.close();
  }
  {
    /* a band whose two pins hold code that will not answer: the other spelling, could not be read */
    const u = await ctx.fresh();
    const brk = await u.c.deploy(A("test/mocks/Breakable.sol", "Breakable").bytecode, "", "Breakable");
    for (const at of [u.site.keepsake, u.site.journal]) {
      const a = createAddressFromString(at);
      if (!(await u.c.vm.stateManager.getAccount(a))) await u.c.vm.stateManager.putAccount(a, new Account());
      await u.c.vm.stateManager.putCode(a, await u.c.vm.stateManager.getCode(createAddressFromString(brk)));
    }
    await mint(u.c, u.site, u.c.from.toString());
    await u.c.exec(u.weth, "mint(address,uint256)", [u.c.from.toString(), 100n * WAD]);
    await u.c.exec(u.weth, "approve(address,uint256)", [u.site.pool, 100n * WAD]);
    await u.c.exec(u.site.pool, OPEN, [1, u.weth, ZERO, 30, 0, 0, 0], { label: "openMarket" });
    await u.c.exec(u.site.pool, DEPOSIT, [1, 10n * WAD, WAD], { value: WAD, label: "deposit" });
    const W = walletFor(u.c, u.c);
    const { page, S } = await u.bootToken(1, { wallet: W });
    await u.lane(page, "swap");
    const kc = L(page, "#swap-lock .chip"), jc = L(page, "#swap-memory .chip");
    const sent = W.calls.filter((x) => ["eth_call", "eth_estimateGas"].includes(x.method) && [S.keepsake, S.journal].map(lower).includes(lower(x.params[0].to)));
    v0((S.reported & S.bits.keepsake) === 0 && (S.absent & S.bits.keepsake) === 0 && !!kc && kc.textContent === "keepsake: could not be read at block " + S.block && kc.dataset.state === "unread" &&
      !!jc && jc.textContent === "journal: could not be read at block " + S.block && jc.dataset.state === "unread" && sent.length === 0 && !L(page, "#swap-lock-on"),
      "pins whose code will not answer read could not be read at block N, and nothing is asked of them", `${kc && kc.textContent} | ${jc && jc.textContent} | sent ${sent.length}`);
    page.close();
  }
  t.ok(V0, "a V2 part appears only where its contract reports: elsewhere its chip stands in its place, and no read is sent to the address");

  /*─────── the V2 chain ───────*/
  const v = await ctx.fresh({ v2: true });
  const c = v.c, site = v.site, weth = v.weth, { me, trader, buyer } = v.actors;
  const ME = me.from.toString(), TRADER = trader.from.toString(), BUYER = buyer.from.toString(), ks = site.keepsake, jr = site.journal, pool = site.pool, hub = site.hub;
  const now = () => v.BLOCK().timestamp;
  await mint(c, site, ME); await mint(c, site, ME);
  const usd = await c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode, encodeParams("string,string,uint8,uint256,bool", ["US Dollar", "USD", 6, 0, false]), "USD");
  await c.exec(usd, "mint(address,uint256)", [ME, 10n ** 12n]);
  await c.exec(usd, "approve(address,uint256)", [pool, 10n ** 12n]);
  await c.exec(pool, OPEN, [1, usd, ZERO, 30, 0, 500, 5880], { label: "openMarket" });
  await c.exec(pool, DEPOSIT, [1, 100_000n * 10n ** 6n, 50n * WAD], { value: 50n * WAD, label: "deposit" });
  await c.exec(weth, "mint(address,uint256)", [ME, 1000n * WAD]);
  await c.exec(weth, "approve(address,uint256)", [pool, 200n * WAD]);
  await c.exec(pool, OPEN, [2, weth, ZERO, 30, 0, 0, 0], { label: "openMarket" });
  await c.exec(pool, DEPOSIT, [2, 100n * WAD, 10n * WAD], { value: 10n * WAD, label: "deposit" });
  await c.exec(weth, "mint(address,uint256)", [TRADER, 10n * WAD]);
  const poolQuote = async (id, baseIn, a) => decUint(await c.read(pool, "quote(uint256,bool,uint256)", [id, baseIn, a]));
  const view = async (id) => viewOf(await c.read(ks, "keepsakeOf(uint256)", [id]));
  const journalLogs = () => c.getLogs({ address: jr, topics: [INSCRIBED] }).map(inscribedOf);

  /*─────── V1 · swap and lock in ether, sold slowly above a floor, and a memory of it ───────*/
  t.head("V1 · ETH into #1's USD market, locked 30 days and freed over 30, sold slowly never below 0.0005 ETH per USD, with a memory");
  let V1 = true, FL = true, MEM = true;
  const v1 = (cond, name, d) => { t.ok(cond, name, d); V1 = V1 && !!cond; };
  const fl = (cond, name, d) => { t.ok(cond, name, d); FL = FL && !!cond; };
  const mm = (cond, name, d) => { t.ok(cond, name, d); MEM = MEM && !!cond; };
  let keptId = 0n;
  {
    const W = walletFor(c, me);
    const { page, S } = await v.bootToken(1, { wallet: W });
    await v.lane(page, "swap");
    const lockOn = L(page, "#swap-lock-on");
    v1((S.reported & S.bits.keepsake) !== 0 && (S.reported & S.bits.journal) !== 0 && !!lockOn && lockOn.getAttribute("role") === "switch" && lockOn.getAttribute("aria-checked") === "false" &&
      !!L(page, "#swap-memory textarea[name=memory]") && L(page, "#swap-memory textarea[name=memory]").getAttribute("aria-label") && LL(page, ".chip[data-state]").filter((x) => /keepsake|journal/.test(x.textContent)).length === 0,
      "where the Keepsake and the Journal report, the lock is a switch and the holder is offered a memory, each labelled, with no chip", `lock ${!!lockOn} memory ${!!L(page, "#swap-memory textarea")}`);
    /* W14 (INTEGRATION L4): the lane's light is the shell's stylesheet, so the panel writes no <style> of its own */
    t.ok(!page.$("#swap-style") && page.$$("style").length === 1 && /button\[role=switch\]\{display:flex/.test(DIST) && /\[role=switch\]\[aria-checked=true\]::after\{/.test(DIST) &&
      /#swap-say\{font-size:17px\}/.test(DIST) && /#swap-kept \.keepsake::before\{/.test(DIST),
      "the lane writes no stylesheet of its own: the switch's knob, the one breath and the keepsake's orb are rules of the shell's", `#swap-style ${!!page.$("#swap-style")} · ${page.$$("style").length} style element(s)`);
    /* W17: the sentence above finds each moved rule by its selector, and an orb shrunk to 4 px passed it and Chromium's
       too; the orb's values are the shell's as they moved, so its rule is held whole in the shipped stylesheet */
    const ORB = '#swap-kept .keepsake::before{content:"";float:left;width:46px;height:46px;margin-right:12px;border-radius:50%;' +
      "background:radial-gradient(circle at 38% 34%,#fff,hsl(var(--h2) 90% 70%) 40%,hsl(var(--h) 80% 30%));box-shadow:0 0 24px hsl(var(--h2) 90% 70%)}";
    t.ok(DIST.includes(ORB), "the keepsake's orb is the shell's rule as it moved, whole: a 46 px circle, white into the token's two hues, glowing in the second",
      (DIST.match(/#swap-kept \.keepsake::before\{[^}]*\}/) || ["no such rule"])[0]);
    /* friendlier: the fee in percent beside its bps, the sniper countdown in minutes and seconds, the rate both ways */
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "0.5");
    const q = await poolQuote(1, false, WAD / 2n), lim = q - q * 50n / 10000n;
    const det = page.text("#lane-swap #swap-details"), sn = L(page, "#swap-sniper");
    v1(!!sn && /^sniper fee500 bps at open, falling to nothing — \d+ min \d+ s left$/.test(sn.textContent) && /fee0\.3 % \(30 bps\)/.test(page.text("#lane-swap #swap-facts")) &&
      /rate1 ETH ≈ [\d.]+ USD · 1 USD ≈ 0\.000[\d]+ ETH/.test(det) && /0\.3 % \(30 bps\) to whoever holds #1, plus the sniper fee while it runs/.test(det),
      "the card is friendlier where it can be: the fee in percent beside its bps, the sniper countdown in minutes and seconds, the rate both ways", `${sn && sn.textContent} | ${det.slice(0, 220)}`);
    v1(page.text("#lane-swap #swap-say") === "You pay 0.5 ETH and receive at least " + full(lim, 6) + " USD, or nothing moves.",
      "the card says in one breath what the swap will do, the floor in it", page.text("#lane-swap #swap-say"));
    /* the lock: on, its two day counts, its dates on the chain's clock — moved first, so only a read of the chain can follow */
    const ts = v.BLOCK().timestamp;
    W.override("eth_getBlockByNumber", () => ({ number: hexN(v.BLOCK().number), timestamp: hexN(ts + 7777n), hash: "0x" + "11".repeat(32) }));
    await flipOn(page, "swap-lock-on"); await page.settle();
    v1(L(page, "#swap-lock-on").getAttribute("aria-checked") === "true" && L(page, "[name=lockDays]").value === "30" && L(page, "[name=freeDays]").value === "30" &&
      page.text("#lane-swap #swap-lock-dates") === "locked until " + date(ts + 7777n + 30n * DAY) + ", all free by " + date(ts + 7777n + 60n * DAY) && L(page, "#swap-go").textContent === "Swap and lock",
      "turned on, the lock asks two day counts and says its dates on the chain's clock; the button is Swap and lock", `${page.text("#lane-swap #swap-lock-dates")} | ${L(page, "#swap-go").textContent}`);
    await flipOn(page, "swap-drip-on");
    put(page, "floor", "0.0005"); await page.settle();
    const MEMO = "locked 30 days: not selling the top this time";
    put(page, "memory", "  " + MEMO + "  "); await page.settle();
    const say = "You pay 0.5 ETH and receive at least " + full(lim, 6) + " USD, locked for 30 days, then freed slowly over 30 days; it sells itself slowly, never below 0.0005 ETH per USD.";
    v1(page.text("#lane-swap #swap-say") === say && /^now 1 USD fetches ≈ 0\.000\d+ ETH$/.test(page.text("#lane-swap #swap-drip-now")) && page.text("#lane-swap #swap-memory-count").startsWith(Buffer.byteLength(MEMO) + " of 1,024 bytes · public"),
      "the one breath grows with the lock and the slow sale, the drip says what one USD fetches now, and the memory counts its bytes as the chain will", `${page.text("#lane-swap #swap-say")} | ${page.text("#lane-swap #swap-drip-now")} | ${page.text("#lane-swap #swap-memory-count")}`);
    const est0 = W.count("eth_estimateGas");
    await press(page, L(page, "#swap-go"));
    W.override("eth_getBlockByNumber", null);
    const cd = cdOf(page), x = sawOf(cd), slab = page.text("#cslab");
    v1(page.text("#cslab [data-function]") === SAW && lower(page.text("#cslab [data-to]")) === lower(ks) && page.$("#cslab [data-value]").dataset.wei === String(WAD / 2n) &&
      argsAgree(page, SAW) && page.text("#cslab [data-sentence]") === say && W.count("eth_estimateGas") === est0 + 1 && /^\d+ units$/.test(gasOf(page)),
      "the lock is one slab: Keepsake.swapAndWrap, the ether as its value, the card's one breath as its sentence, and the estimate passes", `${page.text("#cslab [data-function]")} | ${page.text("#cslab [data-sentence]")} | ${gasOf(page)}`);
    v1(x.w0 === 32n && x.market === 1n && x.baseIn === 0n && x.amountIn === WAD / 2n && x.minOut === lim && x.deadline === ts + 7777n + 900n &&
      x.start === ts + 7777n + 30n * DAY && x.cliff === 0n && x.end === ts + 7777n + 60n * DAY && lower(x.to) === lower(ME) && x.message === "",
      "in the calldata: the market, the ether in, the floor, a deadline fifteen minutes on the chain's clock, and a schedule locked 30 days then freed over 30 from that clock", js(x).slice(0, 400));
    /* the floor: P × 10^decPaid × 1e18 / 10^decReceived — 0.0005 ETH per USD is 5e14 ETH-wei per 1e6 USD-units, so 5e26 per 1e18 */
    const FLOOR = 5n * 10n ** 26n;
    fl(x.drip.asset === 0n && x.drip.market === 1n && x.drip.floor === FLOOR && x.drip.most === q / 10n &&
      /Sells\s*slowly as it frees: never below 0\.0005 ETH per USD, at most [\d.]+ USD a sale, through #1's market/.test(slab) && /No less than\s*[\d.]+ USD — or nothing moves/.test(slab) && /Dies\s*in fifteen minutes/.test(slab),
      "the drip's floor is stated in words as 0.0005 ETH per USD and found raw in the calldata as 5e26, with at most a tenth of what arrives a sale", `floor ${x.drip.floor} most ${x.drip.most} vs ${q / 10n}`);
    const b0 = await c.balanceOf(ME);
    await sign(page, W, 1);
    const swap = [...W.receipts.values()].pop(), rcpt = W.lastIndex("eth_getTransactionReceipt");
    const wl = swap.logs.find((l) => lower(l.address) === lower(ks) && l.topics[0] === WRAPPED);
    keptId = wl ? BigInt(wl.topics[1]) : 0n;
    await page.until(() => open(page) && page.text("#cslab [data-function]") === INSCRIBE && gasOf(page) !== "estimating…", 120);
    const kept = L(page, "#swap-kept .keepsake");
    const reads = W.calls.filter((y, i) => i > rcpt && y.method === "eth_call" && lower(y.params[0].to) === lower(ks));
    v1(swap.status === "0x1" && keptId > 0n && !!kept && kept.dataset.id === String(keptId) && new RegExp("^keepsake #" + keptId + " holds what arrived; it is yours").test(kept.textContent) &&
      reads.length === 0 && W.callsTo(ks).length === 0 && b0 - (await c.balanceOf(ME)) >= WAD / 2n,
      "the keepsake's id is read from the receipt's Wrapped log, and nothing is asked of the Keepsake after the write", `id ${keptId} kept "${kept && kept.textContent}" reads ${reads.length}`);
    const ks1 = await view(keptId);
    fl(lower(ks1.holder) === lower(ME) && lower(ks1.creator) === lower(ME) && ks1.start === x.start && ks1.cliff === x.start && ks1.end === x.end && ks1.assets.length === 1 && lower(ks1.assets[0].token) === lower(usd) && ks1.assets[0].amount >= lim &&
      ks1.drip.asset === 0n && ks1.drip.market === 1n && ks1.drip.floor === FLOOR && ks1.drip.most === q / 10n,
      "and keepsakeOf reads it back: the holder, the schedule, what arrived, and the drip with the very floor the words named", `holder ${ks1.holder} floor ${ks1.drip.floor} amount ${ks1.assets[0] && ks1.assets[0].amount}`);
    /* the memory, the second slab, offered after the receipt */
    const mcd = cdOf(page), ref = swap.transactionHash;
    /* W13: "a second slab offers … Journal.inscribe" — the open slab and its function — was the wait's alone; the sentence now checks it */
    mm(open(page) && page.text("#cslab [data-function]") === INSCRIBE && lower(page.text("#cslab [data-to]")) === lower(jr) && page.text('#cslab [data-arg="0"]') === cks(hub) && page.text('#cslab [data-arg="1"]') === "1" && page.text('#cslab [data-arg="2"]') === "1" &&
      lower(mcd.slice(10 + 4 * 64, 10 + 5 * 64)) === lower(ref.slice(2)) && /public/.test(page.text("#cslab [data-sentence]")) && /fingerprint/.test(page.text("#cslab [data-sentence]")) &&
      page.text("#cslab").includes("Memory" + MEMO) && /^\d+ units$/.test(gasOf(page)),
      "after the receipt a second slab offers the memory: Journal.inscribe(hub, #1, TRADE, the words, the swap's transaction), its sentence saying it is public and enters the fingerprint", `${page.text("#cslab [data-sentence]")} | ref ${ref}`);
    await sign(page, W, 2);
    await page.until(() => /memory #1 is in #1's journal/.test(page.text("#lane-swap #swap-kept")), 80);
    const logs = journalLogs(), m1 = logs[logs.length - 1];
    mm(logs.length === 1 && m1.n === 1n && lower(m1.collection) === lower(hub) && m1.id === 1n && m1.kind === 1n && lower(m1.author) === lower(ME) && lower(m1.ref) === lower(ref) &&
      m1.body === MEMO && lower(m1.tx) !== lower(ref) && /memory #1 is in #1's journal/.test(page.text("#lane-swap #swap-kept")),
      "the Inscribed log carries it: memory #1 of #1, kind TRADE, by the holder, the body as typed, its ref the swap's own transaction", js(m1));
    v1(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the holder's lock", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
  t.ok(V1, "lock what I receive: one slab swaps and wraps, the keepsake's id from the Wrapped log, then the memory");
  t.ok(FL, "a drip floor stated in human terms is the raw floor in the calldata, read back from keepsakeOf");

  /*─────── V2 · swap and lock an ERC-20: the exact approval to the Keepsake is the button's current step ───────*/
  t.head("V2 · the trader locks WETH's proceeds from #2: an exact approval to the Keepsake first");
  let V2 = true;
  const v2 = (cond, name, d) => { t.ok(cond, name, d); V2 = V2 && !!cond; };
  {
    const W = walletFor(c, trader);
    const { page } = await v.bootToken(2, { wallet: W });
    await v.lane(page, "swap");
    v2(!!L(page, "#swap-lock-on") && !L(page, "#swap-memory"), "a trader may lock like anyone, and is offered no memory: only the holder writes a token's journal");
    await quote(page, "1");
    await flipOn(page, "swap-lock-on");
    await page.until(() => /^Approve\b/.test(page.text("#lane-swap #swap-go")), 40);
    v2(/^Approve 1 WETH — the current step$/.test(L(page, "#swap-go").textContent), "locked, the button's current step is an exact approval to the Keepsake", L(page, "#swap-go").textContent);
    await press(page, L(page, "#swap-go"));
    const acd = cdOf(page);
    v2(page.text("#cslab [data-function]") === APPROVE && lower(page.text("#cslab [data-to]")) === lower(weth) && lower(addrWord(acd, 0)) === lower(ks) && word(acd, 1) === WAD && /Never\s*unlimited/.test(page.text("#cslab")) && W.sent() === 0,
      "the approve slab names the Keepsake as the spender of exactly the amount typed", acd);
    /* W14 (INTEGRATION L7): the line names who pulls, not "the market" */
    t.ok(lineOf(page, "Lets") === "the Keepsake pull exactly 1 WETH", "locked, the exact approval's line names who pulls it: Lets · the Keepsake pull exactly 1 WETH", lineOf(page, "Lets"));
    await sign(page, W, 1);
    await page.until(() => L(page, "#swap-go") && L(page, "#swap-go").textContent === "Swap and lock" && !L(page, "#swap-go").disabled, 40);
    v2(L(page, "#swap-in").value === "1" && L(page, "#swap-lock-on").getAttribute("aria-checked") === "true" && L(page, "#swap-go").textContent === "Swap and lock",
      "after the approve lands the same button is Swap and lock, the amount and the lock still as typed", L(page, "#swap-go").textContent);
    const q = await poolQuote(2, true, WAD), lim = q - q * 50n / 10000n;
    await press(page, L(page, "#swap-go"));
    const x = sawOf(cdOf(page));
    v2(page.text("#cslab [data-function]") === SAW && !page.$("#cslab [data-value]") && x.market === 2n && x.baseIn === 1n && x.amountIn === WAD && x.minOut === lim && lower(x.to) === lower(TRADER) &&
      x.drip.floor === 0n && x.drip.market === 0n && x.message === "" && /You pay\s*exactly 1 WETH, pulled exactly by the Keepsake/.test(page.text("#cslab")),
      "the swapAndWrap slab sends no ether for an ERC-20 input and pulls exactly what was approved", js(x).slice(0, 300));
    await sign(page, W, 2);
    const r = [...W.receipts.values()].pop(), wl = r.logs.find((l) => lower(l.address) === lower(ks) && l.topics[0] === WRAPPED), id = wl ? BigInt(wl.topics[1]) : 0n;
    await page.until(() => !!L(page, "#swap-kept .keepsake"), 60);
    const kv1 = await view(id), al = decUint(await c.read(weth, "allowance(address,address)", [TRADER, ks]));
    v2(r.status === "0x1" && id === keptId + 1n && al === 0n && lower(kv1.holder) === lower(TRADER) && kv1.assets.length === 1 && lower(kv1.assets[0].token) === ZERO && kv1.assets[0].amount >= lim && L(page, "#swap-kept .keepsake").dataset.id === String(id),
      "the approval is spent to zero, and the keepsake holds the ether that arrived, for the trader", `allowance ${al} holder ${kv1.holder} amount ${kv1.assets[0] && kv1.assets[0].amount}`);
    page.close();
  }
  t.ok(V2, "an ERC-20 locked through the Keepsake is approved to it exactly, as the button's current step, and pulled to zero");

  /*─────── V3 · a gift ───────*/
  t.head("V3 · a gift: the trader locks ether's WETH for the buyer, with a message");
  let V3 = true;
  const v3 = (cond, name, d) => { t.ok(cond, name, d); V3 = V3 && !!cond; };
  {
    const W = walletFor(c, trader);
    const { page } = await v.bootToken(2, { wallet: W });
    await v.lane(page, "swap");
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "0.2");
    await flipOn(page, "swap-lock-on");
    put(page, "lockDays", "7"); put(page, "freeDays", "90");
    await flipOn(page, "swap-gift-on");
    put(page, "giftTo", BUYER.toLowerCase()); put(page, "giftNote", "for the long road — it frees slowly, like everything good"); await page.settle();
    const q = await poolQuote(2, false, WAD / 5n), lim = q - q * 50n / 10000n;
    const say = "You pay 0.2 ETH and give at least " + full(lim) + " WETH to " + cks(BUYER) + ", locked for 7 days, then freed slowly over 90 days.";
    v3(page.text("#lane-swap #swap-say") === say && L(page, "#swap-go").textContent === "Swap and give", "a gift's one breath names its recipient, checksummed, and the button says Swap and give", page.text("#lane-swap #swap-say"));
    await press(page, L(page, "#swap-go"));
    const x = sawOf(cdOf(page)), slab = page.text("#cslab");
    v3(page.text("#cslab [data-sentence]") === say && lower(x.to) === lower(BUYER) && x.message === "for the long road — it frees slowly, like everything good" && x.drip.floor === 0n &&
      x.end - x.start === 90n * DAY && new RegExp("A gift to\\s*" + cks(BUYER)).test(slab) && /Message\s*for the long road/.test(slab) && page.$("#cslab [data-value]").dataset.wei === String(WAD / 5n),
      "the slab names the recipient in its sentence, its lines and its calldata, with the message", `to ${x.to} message "${x.message}"`);
    await sign(page, W, 1);
    const r = [...W.receipts.values()].pop(), wl = r.logs.find((l) => lower(l.address) === lower(ks) && l.topics[0] === WRAPPED), id = wl ? BigInt(wl.topics[1]) : 0n;
    await page.until(() => !!L(page, "#swap-kept .keepsake"), 60);
    const kv1 = await view(id);
    v3(r.status === "0x1" && lower(wl.topics[3].slice(26)) === lower(BUYER.slice(2)) && lower(kv1.holder) === lower(BUYER) && lower(kv1.creator) === lower(TRADER) && kv1.message === x.message &&
      new RegExp("^keepsake #" + id + " holds what arrived and is now " + cks(BUYER) + "'s").test(page.text("#lane-swap #swap-kept")),
      "the keepsake is the buyer's, given by the trader, with the message on its card; the lane says whose it now is", `${kv1.holder} ${kv1.creator} "${kv1.message}"`);
    page.close();
  }
  t.ok(V3, "a gift names its recipient in the sentence and in the calldata, and the keepsake is theirs with its message");

  /*─────── V4 · refusals in words ───────*/
  t.head("V4 · what the lock refuses, it says in words before any wallet");
  let V4 = true;
  const v4 = (cond, name, d) => { t.ok(cond, name, d); V4 = V4 && !!cond; };
  {
    const W = walletFor(c, me);
    const { page, ctx: vc } = await v.bootToken(2, { wallet: W });
    await v.lane(page, "swap");
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "0.1");
    await flipOn(page, "swap-lock-on");
    const refused = async (why) => {
      const est = W.count("eth_estimateGas"), sent = W.sent();
      page.click(L(page, "#swap-go")); await page.settle(); await page.settle();
      return !open(page) && tickOf(page) === why && W.count("eth_estimateGas") === est && W.sent() === sent;
    };
    /* a floor and a per-sale amount are in the pair's units: turning the pair round clears them */
    await flipOn(page, "swap-drip-on"); put(page, "floor", "0.05"); put(page, "most", "0.01"); await page.settle();
    page.click(L(page, "#swap-flip")); await page.settle();
    v4(L(page, "[name=floor]").value === "" && L(page, "[name=most]").value === "" && /never below this price, in WETH per ETH/.test(page.text("#lane-swap #swap-lock")) && /at most this much ETH per sale/.test(page.text("#lane-swap #swap-lock")),
      "a flip clears the floor and the per-sale amount, and their labels follow the pair: never read the other way round", page.text("#lane-swap #swap-lock").slice(0, 200));
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "0.1");
    await flipOn(page, "swap-drip-on");
    await flipOn(page, "swap-gift-on"); put(page, "giftTo", BUYER); await flipOn(page, "swap-drip-on"); put(page, "floor", "9"); await page.settle();
    const why = "a drip is only for a keepsake you keep: a giver never sells a recipient's gift";
    v4(page.text("#lane-swap #swap-lock-why") === why && !L(page, "#swap-lock-why").hidden && await refused(why), "a drip asked for a gift is refused in words under the switch and at the press: no slab, no estimate", tickOf(page));
    /* the chain says the same: the same tuple proposed by hand estimates to the Keepsake's own refusal */
    const dl = now() + 900n;
    const p = vc.INTACT.ui.propose({ to: ks, key: "keepsake.swapAndWrap", value: WAD / 10n, need: 0, lines: [["Drip", "for a gift"]], sentence: "locks a gift with a drip",
      args: [[2n, false, WAD / 10n, 0n, dl, [0n, 0n, now() + 30n * DAY], BUYER, "", [0n, 2n, 10n ** 17n, 10n ** 17n]]] });
    await page.until(() => open(page) && gasOf(page) !== "estimating…", 60);
    v4(gasOf(page) === "would revert: BadDrip()" && page.$("#cslab [data-go]").disabled === true, "and the chain agrees: the same gift with a drip estimates to would revert: BadDrip(), Sign disabled", gasOf(page));
    page.click(page.$("#cslab [data-no]")); await p; await page.settle();
    await flipOn(page, "swap-drip-on"); await flipOn(page, "swap-gift-on");
    put(page, "lockDays", "0"); put(page, "freeDays", "0"); await page.settle();
    v4(await refused("a lock of no days is no lock: name at least one day"), "a lock of no days is refused in words", tickOf(page));
    put(page, "lockDays", "3000"); put(page, "freeDays", "651"); await page.settle();
    v4(await refused("a keepsake frees within ten years: 3,650 days at most"), "a lock past ten years is refused in words", tickOf(page));
    put(page, "lockDays", "1"); put(page, "freeDays", "5"); await flipOn(page, "swap-gift-on"); put(page, "giftTo", BUYER); put(page, "giftNote", "x".repeat(281)); await page.settle();
    v4(await refused("the message is 281 bytes; a gift's card holds 280"), "a gift's message over 280 bytes is refused in words, counted as bytes", tickOf(page));
    put(page, "giftNote", "é".repeat(141)); await page.settle();
    v4(await refused("the message is 282 bytes; a gift's card holds 280"), "and the count is bytes, not letters: 141 é are 282 bytes", tickOf(page));
    put(page, "giftTo", ME); put(page, "giftNote", ""); await page.settle();
    v4(await refused("that is your own address: a keepsake you keep is no gift"), "a gift to your own address is refused in words", tickOf(page));
    /* one letter's case turned: still an address to isAddr, no longer its own EIP-55 checksum — a typo a gift cannot take back */
    const typo = cks(BUYER).replace(/[a-f]/, (ch) => ch.toUpperCase());
    put(page, "giftTo", typo); await page.settle();
    v4(typo !== cks(BUYER) && await refused("that address's mixed case is not its checksum: check every character"), "a mixed-case address that is not its own checksum is refused in words: a gift cannot be taken back", typo);
    /* the Keepsake as its own recipient is the chain's refusal by name, before any wallet */
    put(page, "giftTo", ks); await page.settle();
    await press(page, L(page, "#swap-go"));
    v4(gasOf(page) === "would revert: ZeroRecipient()" && page.$("#cslab [data-go]").disabled === true && W.prompts().length === 0, "a gift to the Keepsake itself is its own refusal in words: would revert: ZeroRecipient(), Sign disabled", gasOf(page));
    page.click(page.$("#cslab [data-no]")); await page.settle();
    await flipOn(page, "swap-gift-on");
    put(page, "memory", "m".repeat(1025)); await page.settle();
    v4(await refused("the memory is 1025 bytes; a journal entry holds 1,024") && L(page, "#swap-memory-count").classList.contains("bad"), "a memory over 1,024 bytes is refused in words, and its count turns red", tickOf(page));
    put(page, "memory", ""); await page.settle();
    page.click(L(page, "#swap-exact")); await page.settle();
    await quote(page, "0.01");
    v4(await refused("a lock names what you pay: switch to exact in"), "in exact-out mode the lock is refused in words: a lock names what you pay", tickOf(page));
    page.click(L(page, "#swap-exact")); await page.settle();
    await quote(page, "0.1");
    /* a schedule the chain puts in the past: the wallet's clock answers three days behind the block, so a start one day after
       it is two days gone when the transaction runs — the panel builds what the clock said, and the estimate says no */
    const ts = v.BLOCK().timestamp;
    W.override("eth_getBlockByNumber", () => ({ number: hexN(v.BLOCK().number), timestamp: hexN(ts - 3n * DAY), hash: "0x" + "11".repeat(32) }));
    await press(page, L(page, "#swap-go"));
    W.override("eth_getBlockByNumber", null);
    v4(sawOf(cdOf(page)).start === ts - 2n * DAY && gasOf(page) === "would revert: BadSchedule()" && page.$("#cslab [data-go]").disabled === true && W.prompts().length === 0,
      "a schedule in the past is the chain's own refusal in words: would revert: BadSchedule(), Sign disabled, no prompt", gasOf(page));
    page.click(page.$("#cslab [data-no]")); await page.settle();
    v4(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the refusals' page", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
  t.ok(V4, "a refusal is said in words: a drip asked for a gift, no days, past ten years, a long message or memory, exact out, and a schedule in the past");

  /*─────── V5 · a memory after a plain swap: offered, dismissed, offered again ───────*/
  t.head("V5 · a plain swap with a memory: Not now leaves it as a button, and it lands with the swap's transaction");
  {
    const W = walletFor(c, me);
    const { page } = await v.bootToken(2, { wallet: W });
    await v.lane(page, "swap");
    page.click(L(page, "#swap-flip")); await page.settle();
    await quote(page, "0.1");
    put(page, "memory", "a plain trade, remembered"); await page.settle();
    await press(page, L(page, "#swap-go"));
    mm(page.text("#cslab [data-function]") === SWAP_IN && page.text("#cslab [data-sentence]") === page.text("#lane-swap #swap-say").replace(/\.$/, "") + "; it goes through #2's market and dies in fifteen minutes.",
      "a plain swap's sentence is the card's one breath, through the market, with its deadline", page.text("#cslab [data-sentence]"));
    await sign(page, W, 1);
    const swap = [...W.receipts.values()].pop();
    /* soft (W13): the answer is read on the next line, so a slab that never comes fails that sentence by name */
    const offered = await page.until(() => open(page) && page.text("#cslab [data-function]") === INSCRIBE, 120, { soft: true });
    mm(offered && swap.status === "0x1", "after a plain swap's receipt the memory's slab is offered", page.text("#cslab [data-function]") || "no slab");
    if (offered) { page.click(page.$("#cslab [data-no]")); await page.settle(); }
    await page.until(() => LL(page, "#swap-kept [data-act=inscribe]").length === 1, 40);
    const sent = W.sent();
    mm(!open(page) && LL(page, "#swap-kept [data-act=inscribe]").length === 1 && sent === 1 && L(page, "#swap-in").value === "" && L(page, "[name=memory]").value === "",
      "Not now writes nothing and leaves the memory as a button; the card is fresh for the next trade", `sent ${sent} acts ${LL(page, "#swap-kept [data-act=inscribe]").length}`);
    const again = L(page, "#swap-kept [data-act=inscribe]");
    if (again) { await press(page, again); await sign(page, W, 2); }
    await page.until(() => /memory #1 is in #2's journal/.test(page.text("#lane-swap #swap-kept")), 80);
    const m = journalLogs().pop();
    mm(m.id === 2n && m.n === 1n && m.kind === 1n && lower(m.ref) === lower(swap.transactionHash) && m.body === "a plain trade, remembered" && LL(page, "#swap-kept [data-act=inscribe]").length === 0,
      "pressed again, it lands: #2's first memory, its ref the plain swap's transaction", js(m));
    mm(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the memory's page", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
  t.ok(MEM, "the memory slab follows the swap's receipt, its ref the swap's transaction, read back from the Inscribed log, and Not now never loses it");
}
