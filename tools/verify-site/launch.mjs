/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "launch" — a coin, its raise, the sealed market
  it graduates into, and the locks that travel with the token (H §7.4
  planned 18 sentences: J 15, F12 1, J′ 2; the blocks below run more)

  Blocks, on the runner's fresh chain: J the raise and its tax as a
  countdown ("the raise shows the tax as a countdown" — J1–J15 of the plan,
  with on top: the countdown's clock source, the percentage counting down
  between reads, the press's read order, the re-quote inside the press, a
  refused clock, another account dropping what was typed), F12 the Launch
  sell's half of the exact-approval sentence (credits, not tokens: there is
  no approval to build — re-asserted here and signed, owned by swap.mjs),
  C credits becoming coins (claim) and the floor (redeem, contribute), J′
  the fair window's per-buyer cap, K the coin and the raise pressed by the
  holder (the launch lands where the preview said; createChecked carries
  the termsHash it read), G the guardian's co-sign, F a raise that misses
  its target (fail, then refund), V the locks (listed, released, extended
  and given through the Reach, and the lock form's exact approval as the
  button's current step), O the gates (the viewer, unread rights, a read
  with no answer, the collection page), S two raises on one token. The one
  BUILD-PLAN sentence this file owns ends its block as `t.ok(J, "the raise
  shows the tax as a countdown")`, verbatim; J's conjunction carries J1–J15
  and the lines added beside them.

  Origin: IPSEITY tools/verify-site.mjs (branch claude/claude-md-docs-8vvyc8):
  its lane 6 had only the mint (the shell's here, asserted in boot.mjs R), so
  the ancestors of these assertions are its "driving the launchpad" block
  ("`where would it land` answered from the kiln, nothing sent", "the launch
  fired through the kiln", "and landed exactly where the page said it
  would", "attributed to the signing token") and its "driving the vault"
  block ("the first press approved the vault for exactly the amount", "a
  lock is a position, and a position changes hands"), as C §5 grouped them
  under J, plus what INTACT's contract requires on top: the deadline on the
  chain's clock (the shim pins Date.now to the block, so eth_getBlockByNumber's
  answer is moved first — D11), the countdown anchored on the same read, the
  re-quote inside the press, termsHash read in the press, the fee cap as the
  contract's clamp. The donor's "a token you do not hold cannot sign a
  launch" is the coin form's gate here: a stranger gets the sentence once
  and no form (J), not a press that reverts.

  Deviations from H §7.4, each forced by the contracts' arithmetic or by
  D20: J10's three buys are 1.05 ETH, not 1 ETH — after the 1 % fee three
  ether put 2.97 on a 3 ETH target, and this curve (900 M base against a
  1 ETH virtual reserve, 700 M on sale) exhausts at 3.5 ETH raised, so the
  buys must land the raise between the two; J′'s second launch is #2's, not
  a second launch of #1 (#1 is inside its seven-day spacing — which J14
  asserts); F12 is the INTACT form of C's line ("the sell approves exactly
  baseIn" became "sell needs no approval", H §7.4), and its ok string is not
  the swap group's verbatim sentence, so INVARIANTS can still quote one file
  per sentence; J15's lockRelease is pressed after the lock's end (before it
  nothing is releasable and the control is not drawn).

  Coverage the group does not reach, said here rather than only in the
  report: a holder under an unknown 7702 delegate (probed, not asserted —
  the shell hides each [data-spend] control and the panel still draws its
  inputs, because ackDelegate unhides those controls in place without a
  repaint; swap's card behaves the same); the chain moving to a wrong chain
  under an open launch lane (boot.mjs N asserts the gate with the swap lane;
  probed here: no eth_call, no control, no input); a coin whose decimals()
  reverts (the refusal is one helper, `dec`, reached here through an
  address with no code, whose empty answer is no answer); a clock refused
  at the paint of a live raise (the buy and the sell are not drawn, since
  both wait on the anchored clock — probed, not asserted); a launch or a
  raise composed through the Reach (not built — U17).

  The review round, each finding a sentence here: the locks list is
  written by strangers (Locks.lock is anyone's), so O locks a worthless
  token that calls itself ETH for #1's Reach and the viewer must tell it
  from ether by the row's key cell, and O stages a decimals() of 2^256 − 1
  that once threw inside the list and hid every lock after it; V gives
  lock #2 back to #1's Reach (listed twice before) and types an address
  with no code into the lock form (an approve to an EOA, forever, before);
  C refuses the coin's balanceOf (drawn as holding nothing, before); F
  boots the buyer past the deadline (a buy and a sell that could only
  revert, before); J12 waits for the collected market (a collect of
  nothing, before); O boots #5, never launched, with the clock and
  launchesOf refused (the clock's sentence over "none yet", and silent
  sealed markets, before). Four checks that claimed more than they read
  now read it: J9 looks for a Transfer topic in the buy's receipt, the
  countdown between reads compares the #launch-tax node and the
  snipeTaxBps calls before and after the warp, G tests the co-sign
  sentence it used to wait for, and K reads the rest of the supply at
  #3's Reach. What is typed surviving a repaint is proven by the buy's own
  receipt (the contribution typed beside it stays); the lock form's "still
  holds what was typed" is the approve step, which repaints nothing.

  Setup this group performs on its chain (every id literal below refers to
  it): #1, #2, #3, #4 to `me`; #1 launches AGENT1 (900 M of 1 B to the
  raise) and opens raise L with a 1000 s fair window, a 99 % opening tax,
  a 1 % fee and a 3 ETH target; #2 launches AGENT3 and opens a raise whose
  window caps each buyer at 2 ETH and which closes in fourteen days, so it
  is still open when, after its spacing, #2 launches AGENT6 (S); #3
  launches AGENT4 from the page (K); #4's guardian is `guardianW` (G), and
  #4 launches AGENT5 into a raise that fails (F); WETH to `me` (V), and
  lock #2 given back to #1's Reach from #2's (V); a stranger's lock of
  FAKE-ETH, a MockERC20 whose symbol is "ETH", for #1's Reach, and #5 to
  `me`, never launched (O).

  Elements this group reads from its panel (CONSOLE §6.2; every selector
  scoped to #lane-launch): #launch-coin, #launch-coin-form (inputs
  name=n|y|d|v|r|s), #launch-coin-preview, #launch-spacing, #launch-raises
  .raise, #launch-raise, #launch-tax, #launch-tax-countdown,
  #launch-floor[data-raw], #launch-window, #launch-buy-in,
  #launch-buy-out[data-raw], #launch-buy-fee[data-raw],
  #launch-buy-snipe[data-raw], #launch-create (inputs name=curve|vq|tgt|win|
  cap|tax|fee|cr|vest|days), #launch-positions .sealed[data-key],
  #launch-locks .lock (its key cell "lock #<k> · native ETH" or "lock
  #<k> · token <short address>"; inputs name=e<k>|g<k>, la|lv|ld),
  [data-act=launch|coinAt|create|buy|sell|graduate|fail|refund|claim|
  launchCollect|contribute|redeem|lock|lockRelease|extend|give|
  approveFirstLaunch] — every one pressed. From the shell: the slab
  (#cbox.on, #cslab, [data-go], [data-no], [data-to], [data-value],
  [data-function], [data-arg], [data-calldata], [data-gas],
  [data-sentence]), #tick, body[data-rights].
───────────────────────────────────────────────────────────────────────────*/
const WAD = 10n ** 18n;
const PARAMS = "(uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8)";
const LAUNCH = "launch(uint256,string,string,uint8,uint256,bytes32,uint256)";
const COIN_AT = "coinAt(uint256,address,string,string,uint8,uint256,bytes32,uint256)";
const BUY = "buy(uint256,uint256,uint64,uint16)";
const SELL = "sell(uint256,uint256,uint256,uint64)";
const LOCK = "lock(address,uint112,address,uint64,uint64,uint64,bool)";
const EXEC = "execute(address,uint256,bytes,uint8)";
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";
const hexN = (n) => "0x" + BigInt(n).toString(16);
const lower = (s) => String(s).toLowerCase();
/// word i of a calldata hex, after the four-byte selector
const word = (cd, i) => BigInt("0x" + cd.slice(10 + 64 * i, 10 + 64 * (i + 1)));
const addrWord = (cd, i) => "0x" + cd.slice(10 + 64 * i + 24, 10 + 64 * (i + 1));
/// what the panel prints: every amount at its full precision
const full = (v, d = 18) => { v = BigInt(v); const b = 10n ** BigInt(d); const f = (v % b).toString().padStart(d, "0").replace(/0+$/, ""); return (v / b).toString() + (f ? "." + f : ""); };
const toUnits = (s, d = 18) => { const [w, f = ""] = String(s).trim().split("."); return BigInt((w || "0") + f.padEnd(d, "0")); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const checksum = (a, kec) => { const h = kec(Buffer.from(a.slice(2).toLowerCase(), "utf8")).slice(2); let o = "0x"; for (let i = 0; i < 40; i++) o += parseInt(h[i], 16) >= 8 ? a[i + 2].toUpperCase() : a[i + 2].toLowerCase(); return o; };

export async function run(t, ctx) {
  const { c, site, actors, weth, sel, encodeParams, decUint, decAddr, kec, ZERO, walletFor, bootToken, lane, mint, EVM } = ctx;
  const { me, buyer, trader, stranger, guardianW } = actors;
  const ME = me.from.toString(), BUYER = buyer.from.toString(), hub = site.hub, pad = site.launchpad, kiln = site.kiln, locks = site.locks, pool = site.pool;
  const now = () => EVM.BLOCK.header.timestamp;
  const topic = (s) => kec(Buffer.from(s, "utf8"));
  const lastLog = (address, sig) => c.getLogs({ address, topics: [topic(sig)] }).pop();
  const L = (page, s) => page.$("#lane-launch " + s);
  const LL = (page, s) => page.$$("#lane-launch " + s);
  const laneText = (page) => page.text("#lane-launch");
  const slabOpen = (page) => page.$("#cbox").classList.contains("on");
  const slabCd = (page) => page.text("#cslab [data-calldata]");
  const gasRow = (page) => page.text("#cslab [data-gas]");
  const tick = (page) => page.text("#tick");
  /// a slab line by its key: the panel's own words, before the shell's rows
  const line = (page, k) => { const r = page.$$("#cslab .kv").find((x) => x.firstChild && x.firstChild.textContent === k); return r ? r.lastChild.textContent : null; };
  const press = async (page, el) => { page.click(el); await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 120); };
  /// sign the open slab and wait for the receipt, the panel's then() and its repaint
  const sign = async (page, W, n) => {
    const before = tick(page);
    page.click(page.$("#cslab [data-go]"));
    await page.until(() => W.sent() === n && tick(page) !== before && /landed in block|reverted in block/.test(tick(page)), 160);
    for (let k = 0; k < 4; k++) await page.settle();
  };
  const repaint = async (page, vctx) => { vctx.dispatchEvent(new vctx.CustomEvent("intact:lane", { detail: { name: "launch" } })); await page.settle(); await page.settle(); };
  const field = (page, scope, name) => L(page, `${scope} input[name=${name}]`);
  /// a lock row's key cell — the lane's own words, which no token writes — and the id it starts with
  /// (an empty row, which a row that threw half-way once left, reads as "")
  const lockKey = (r) => (r.firstChild && r.firstChild.firstChild || r).textContent;
  const lockId = (r) => lockKey(r).split(" · ")[0];
  const reverted = () => { throw Object.assign(new Error("execution reverted"), { code: 3, data: "0xdeadbeef" }); };
  const launchOf = (id) => c.read(pad, "launchOf(uint256)", [id]);
  const quoteBuy = async (id, v) => { const r = await c.read(pad, "quoteBuy(uint256,uint256)", [id, v]); return [decUint(r, 0), decUint(r, 1), decUint(r, 2)]; };
  const credit = async (id, who) => decUint(await c.read(pad, "creditOf(uint256,address)", [id, who]));

  /* the cast: #1–#4 to me; #1 launches AGENT1 and opens raise L (Bundle.t.sol `_launchAndGraduate`) */
  for (let i = 0; i < 4; i++) await mint(c, site, ME);
  const reach1 = decAddr(await c.read(hub, "account(uint256)", [1])), reach2 = decAddr(await c.read(hub, "account(uint256)", [2]));
  const SUPPLY = 1_000_000_000n * WAD, RAISE = 900_000_000n * WAD, SALT = "0x" + "01".padStart(64, "0");
  await c.exec(kiln, LAUNCH, [1, "Agent One", "AGENT1", 18, SUPPLY, SALT, RAISE], { label: "launch" });
  const coin = "0x" + lastLog(kiln, "Launched(address,uint256,address,string,uint256,uint256)").topics[1].slice(26);
  const T0 = now();
  await c.exec(pad, `create(${PARAMS})`, [[1n, coin, 700_000_000n * WAD, WAD, 3n * WAD, 0n, 1000n, (1n << 128n) - 1n, 9900, 100, 0, 0, T0 + 7n * 86400n, 0]], { label: "create" });
  const LID = decUint(lastLog(pad, "LaunchCreated(uint256,uint256,address,uint8,bytes32)").topics[1]);

  /*═══════════ J · the raise shows the tax as a countdown ═══════════*/
  t.head("J · the raise shows the tax as a countdown");
  let J = true;
  const j = (cond, name, d) => { t.ok(cond, name, d); J = J && !!cond; };
  let F12 = true;
  {
    const W = walletFor(c, buyer);
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
    await lane(page, "launch");
    await page.until(() => LL(page, "#launch-raises .raise").length > 0 && /falls to nothing/.test(page.text("#lane-launch #launch-tax-countdown")) && L(page, "#launch-floor").dataset.raw !== undefined, 80);
    const n = Number(decUint(await c.read(pad, "launchesOf(uint256)", [1]), 1));
    const row = LL(page, "#launch-raises .raise")[0];
    j(LL(page, "#launch-raises .raise").length === n && n === 1 && /^AGENT1 · live · /.test(row.textContent), "J1 the raise is listed with its coin, one row per launchesOf(1)", row && row.textContent);
    const tax0 = decUint(await c.read(pad, "snipeTaxBps(uint256)", [LID]));
    j(L(page, "#launch-tax").textContent === "99.00 %" && tax0 === 9900n, "J2 the tax at the opening block reads 99.00 %, the Launchpad's snipeTaxBps", `${L(page, "#launch-tax").textContent} / ${tax0}`);
    const ends = decUint(await launchOf(LID), 11), m = page.text("#lane-launch #launch-tax-countdown").match(/^falls to nothing in (\d+) s$/);
    j(!!m && BigInt(m[1]) === ends - now() && ends - now() === 1000n && W.count("eth_getBlockByNumber") >= 1,
      "J3 the window is a countdown: the seconds are fairWindowEnds less the chain's clock", `${page.text("#lane-launch #launch-tax-countdown")} vs ${ends - now()}`);
    /* the anchor is eth_getBlockByNumber, not INTACT.time and not Date.now (both pinned to the block here): moved
       100 s ahead, the countdown says 900 — and the percentage, read from the chain at the same paint, stands */
    const ts = now();
    W.override("eth_getBlockByNumber", () => ({ number: hexN(EVM.BLOCK.header.number), timestamp: hexN(ts + 100n), hash: "0x" + "11".repeat(32) }));
    await repaint(page, vctx);
    await page.until(() => /in 900 s$/.test(page.text("#lane-launch #launch-tax-countdown")), 40);
    j(page.text("#lane-launch #launch-tax-countdown") === "falls to nothing in 900 s" && L(page, "#launch-tax").textContent === "99.00 %",
      "the countdown follows the chain's clock as eth_getBlockByNumber answers it, never INTACT.time or Date.now", page.text("#lane-launch #launch-tax-countdown"));
    W.override("eth_getBlockByNumber", null);
    await repaint(page, vctx);
    await page.until(() => /in 1000 s$/.test(page.text("#lane-launch #launch-tax-countdown")) && LL(page, "#launch-raises .raise").length === 1, 40);
    const target = decUint(await c.read(pad, "graduationTargetOf(uint256)", [LID]));
    const xy = (LL(page, "#launch-raises .raise")[0].textContent.match(/raised (\S+) of (\S+) ETH$/) || []);
    j(xy.length === 3 && toUnits(xy[2]) === target && target === 3n * WAD && toUnits(xy[1]) === decUint(await launchOf(LID), 9),
      "J11 raised X of Y comes from two reads: X is launchOf's raised, Y is graduationTargetOf", xy[0]);
    const floor = decUint(await c.read(coin, "floorPerToken()"));
    j(L(page, "#launch-floor").dataset.raw === String(floor) && L(page, "#launch-floor").textContent === full(floor) + " ETH per whole AGENT1",
      "J6 the floor per token is the coin's floorPerToken (a reported zero is a zero)", `${L(page, "#launch-floor").dataset.raw} "${L(page, "#launch-floor").textContent}"`);
    j(!L(page, "#launch-coin-form") && (laneText(page).match(/this wallet holds no right on #1/g) || []).length === 1 && LL(page, "#launch-coin input").length === 0,
      "a stranger sees the coin form's gate sentence once and no orphan inputs", (laneText(page).match(/this wallet holds no right on #1/g) || []).length);

    /* J7 the curve preview is quoteBuy */
    page.type(L(page, "#launch-buy-in"), "1");
    await page.until(() => L(page, "#launch-buy-out").dataset.raw !== undefined, 60);
    const q = await quoteBuy(LID, WAD);
    const raws = ["#launch-buy-out", "#launch-buy-fee", "#launch-buy-snipe"].map((id) => L(page, id).dataset.raw);
    j(raws.join(",") === q.join(",") && q[1] === WAD / 100n && q[2] === 98n * WAD / 100n && !L(page, "[data-act=buy]").disabled,
      "J7 the curve preview is quoteBuy's three words, the 98 % tax the clamp leaves beside the 1 % fee", `${raws} vs ${q}`);

    /* J8 the buy slab names the call, the fee cap and the deadline — on the chain's clock, moved first */
    const ts8 = now(), mark8 = W.calls.length;
    W.override("eth_getBlockByNumber", () => ({ number: hexN(EVM.BLOCK.header.number), timestamp: hexN(ts8 + 7777n), hash: "0x" + "11".repeat(32) }));
    await press(page, L(page, "[data-act=buy]"));
    W.override("eth_getBlockByNumber", null);
    /* what the page asked, in order: the curve and the tax re-read and the chain's clock, all before the estimate */
    const at8 = (pred) => W.calls.findIndex((x, i) => i >= mark8 && pred(x));
    const isCall = (s4) => (x) => x.method === "eth_call" && String(x.params[0].data).startsWith(sel(s4));
    const order = [at8(isCall("quoteBuy(uint256,uint256)")), at8(isCall("snipeTaxBps(uint256)")), at8((x) => x.method === "eth_getBlockByNumber"), at8((x) => x.method === "eth_estimateGas")];
    j(order.every((i) => i >= 0) && Math.max(order[0], order[1], order[2]) < order[3] && W.prompts().length === 0,
      "the press re-reads quoteBuy, snipeTaxBps and the chain's clock before the estimate, and nothing prompts", order.join(","));
    const cd = slabCd(page), slab = page.text("#cslab"), min = q[0] - q[0] * 50n / 10000n;
    j(page.text("#cslab [data-function]") === BUY && word(cd, 0) === LID && /maxFeeBps 9900: fee and tax together at most 99\.00 %/.test(line(page, "Fee cap") || "") && word(cd, 3) === 9900n &&
      /Dies\s*in fifteen minutes/.test(slab) && word(cd, 2) === ts8 + 7777n + 900n && page.$("#cslab [data-value]").dataset.wei === String(WAD),
      "J8 the buy slab names buy(uint256,uint256,uint64,uint16), the fee cap as maxFeeBps, and a deadline fifteen minutes on the chain's clock; the value is the input exactly",
      `fn ${page.text("#cslab [data-function]")} cap "${line(page, "Fee cap")}" w3 ${word(cd, 3)} w2 ${word(cd, 2)} vs ${ts8 + 7777n + 900n} wei ${page.$("#cslab [data-value]") && page.$("#cslab [data-value]").dataset.wei}`);
    j(word(cd, 1) === min && new RegExp("no less than " + esc(full(min)) + " AGENT1 — or nothing moves").test(line(page, "Credit") || "") && /credits, not tokens/.test(line(page, "Holds") || "") && /^\d+ units$/.test(gasRow(page)),
      "the buy states its floor in words, and the floor in the words is minBaseOut in the calldata", `w1 ${word(cd, 1)} vs ${min}; "${line(page, "Credit")}"`);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    /* a contribution typed beside the buy before Sign: the receipt's own then() repaints and clears only what it consumed */
    page.type(field(page, "#launch-raise", "c1"), "0.01");
    const bin0 = L(page, "#launch-buy-in");
    await sign(page, W, 1);
    const cr = await credit(LID, BUYER), rc9 = [...W.receipts.values()].pop(), TRANSFER = topic("Transfer(address,address,uint256)");
    j(cr > 0n && cr === q[0] && rc9.status === "0x1" && rc9.logs.length > 0 && rc9.logs.every((l) => l.topics[0] !== TRANSFER),
      "J9 the buy lands as credit, and nothing ERC-20 moved", `credit ${cr} vs quoted ${q[0]}; topics ${rc9.logs.map((l) => l.topics[0].slice(0, 10))}`);
    await page.until(() => !!L(page, "#launch-buy-in") && L(page, "#launch-buy-in").value === "", 40);
    t.ok(L(page, "#launch-buy-in") !== bin0 && L(page, "#launch-buy-in").value === "" && (field(page, "#launch-raise", "c1") || {}).value === "0.01",
      "the buy's receipt repaints the lane and clears only what it consumed: the amount it paid is gone, the contribution typed beside it stays",
      `new node ${L(page, "#launch-buy-in") !== bin0} buy "${L(page, "#launch-buy-in").value}" contribution "${field(page, "#launch-raise", "c1") && field(page, "#launch-raise", "c1").value}"`);

    /* the re-quote inside the press: the curve moves between the slab and Sign, and Sign refuses with a sentence */
    page.type(L(page, "#launch-buy-in"), "1");
    await page.until(() => !!L(page, "#launch-buy-out").dataset.raw && !L(page, "[data-act=buy]").disabled, 60);
    await press(page, L(page, "[data-act=buy]"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await trader.exec(pad, BUY, [LID, 0n, now() + 600n, 10000], { value: WAD, label: "buy" });
    const mark = W.calls.length, sent0 = W.sent();
    page.click(page.$("#cslab [data-go]")); await page.until(() => !slabOpen(page), 60); await page.settle();
    const requotes = W.callsTo(pad, sel("quoteBuy(uint256,uint256)")).filter((x) => W.calls.indexOf(x) >= mark).length;
    j(!slabOpen(page) && W.sent() === sent0 && requotes === 1 && tick(page) === "the curve moved past the floor — review again",
      "a curve that moved past the floor between the slab and the press is a sentence at the press, not a SlippageExceeded revert after the signature", `requotes ${requotes} sent ${W.sent()} tick "${tick(page)}"`);

    /* F12: the sell moves credits, so there is nothing to approve, and the slab says so */
    await page.until(() => !!L(page, "#launch-raise input[name=s1]"), 40);
    const half = cr / 2n, markS = W.calls.length;
    page.type(L(page, "#launch-raise input[name=s1]"), full(half));
    await press(page, L(page, "[data-act=sell]"));
    const scd = slabCd(page);
    const allowanceAsked = W.calls.slice(markS).some((x) => x.method === "eth_call" && String(x.params[0].data).startsWith(sel("allowance(address,address)")));
    const ok12 = page.text("#cslab [data-function]") === SELL && word(scd, 0) === LID && word(scd, 1) === half && line(page, "Lets") === null && !/unlimited/.test(page.text("#cslab")) &&
      /credits, not tokens/.test(line(page, "Approval") || "") && !allowanceAsked && W.prompts().length === 1;
    t.ok(ok12, "F12 Launch › sell needs no approval and says so: the first slab is the sell itself, with the line credits, not tokens", `fn ${page.text("#cslab [data-function]")} w1 ${word(scd, 1)} vs ${half} approval "${line(page, "Approval")}" allowance asked ${allowanceAsked}`);
    F12 = F12 && ok12;
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    const p12 = W.prompts().length;
    await sign(page, W, 2);
    const cr2 = await credit(LID, BUYER), asked12 = W.calls.slice(markS).filter((x) => x.method === "eth_call" && /^0x(dd62ed3e|095ea7b3)/.test(String(x.params[0].data))).length;
    const ok12b = cr2 === cr - half && W.prompts().length === p12 + 1 && W.prompts()[p12].params[0].data.startsWith(sel(SELL)) && asked12 === 0;
    t.ok(ok12b, "F12 Sign → the credit fell by exactly what was sold, with one prompt and no allowance ever read or approved", `credit ${cr} → ${cr2} (sold ${half}) prompts +${W.prompts().length - p12} asked ${asked12}`);
    F12 = F12 && ok12b;

    /* a clock that will not answer: the buy refuses with the clock sentence and disables itself, unsent */
    W.refuse("eth_getBlockByNumber", Object.assign(new Error("boom"), { code: -32603 }));
    page.type(L(page, "#launch-buy-in"), "0.5");
    await page.until(() => !!L(page, "#launch-buy-out").dataset.raw && !L(page, "[data-act=buy]").disabled, 60);
    const est0 = W.count("eth_estimateGas");
    page.click(L(page, "[data-act=buy]")); await page.settle(); await page.settle();
    j(!slabOpen(page) && W.count("eth_estimateGas") === est0 && tick(page) === "the chain's clock could not be read" && L(page, "[data-act=buy]").disabled,
      "a clock that will not answer disables the buy with the clock sentence, and no deadline is guessed", `tick "${tick(page)}" disabled ${L(page, "[data-act=buy]").disabled}`);
    W.override("eth_getBlockByNumber", null);

    /* between reads the percentage itself counts down on the contract's own line: the chain moves 250 s, no repaint
       (the same #launch-tax node before and after) and no read (the wallet saw no snipeTaxBps call in between) */
    const taxNode = L(page, "#launch-tax"), taxReads = W.callsTo(pad, sel("snipeTaxBps(uint256)")).length;
    ctx.warp(T0 + 250n);
    await page.until(() => /in 750 s$/.test(page.text("#lane-launch #launch-tax-countdown")), 60);
    const mid = decUint(await c.read(pad, "snipeTaxBps(uint256)", [LID])), taxReads2 = W.callsTo(pad, sel("snipeTaxBps(uint256)")).length;
    j(page.text("#lane-launch #launch-tax-countdown") === "falls to nothing in 750 s" && L(page, "#launch-tax").textContent === "74.25 %" && mid === 7425n && L(page, "#launch-tax") === taxNode && taxReads2 === taxReads,
      "between reads the tax itself counts down: 250 s on, with no repaint, it reads 74.25 %, which is what snipeTaxBps then answers",
      `${L(page, "#launch-tax").textContent} ${page.text("#lane-launch #launch-tax-countdown")} chain ${mid} same node ${L(page, "#launch-tax") === taxNode} reads +${taxReads2 - taxReads}`);

    /* J4, J5: the window moves on the chain's clock */
    ctx.warp(T0 + 500n);
    await repaint(page, vctx);
    await page.until(() => L(page, "#launch-tax") && L(page, "#launch-tax").textContent === "49.50 %", 60);
    j(L(page, "#launch-tax").textContent === "49.50 %" && decUint(await c.read(pad, "snipeTaxBps(uint256)", [LID])) === 4950n && /in 500 s$/.test(page.text("#lane-launch #launch-tax-countdown")),
      "J4 halfway through the window the tax is half, and the countdown says 500 s", `${L(page, "#launch-tax").textContent} ${page.text("#lane-launch #launch-tax-countdown")}`);
    ctx.warp(T0 + 1001n);
    await repaint(page, vctx);
    await page.until(() => L(page, "#launch-tax") && /no tax/.test(L(page, "#launch-tax").textContent), 60);
    j(/no tax/.test(L(page, "#launch-tax").textContent) && L(page, "#launch-tax-countdown") === null && decUint(await c.read(pad, "snipeTaxBps(uint256)", [LID])) === 0n,
      "J5 after the window: no tax, and the countdown element is gone", L(page, "#launch-tax").textContent);
    /* what was typed belongs to the account that typed it: another account repaints the lane and drops it */
    page.type(L(page, "#launch-buy-in"), "0.3");
    await page.until(() => !!L(page, "#launch-buy-out").dataset.raw, 40);
    W.setAccounts([trader.from.toString()]); await page.settle(); await page.settle();
    await page.until(() => !!L(page, "#launch-buy-in") && L(page, "#launch-buy-in").value === "" && page.ctx.INTACT.ui.account() === checksum(trader.from.toString(), kec), 60);
    const trCredit = await credit(LID, trader.from.toString());
    await page.until(() => new RegExp("your credit" + esc(full(trCredit)) + " AGENT1").test(page.text("#lane-launch #launch-raise")), 60);
    t.ok(L(page, "#launch-buy-in").value === "" && !L(page, "#launch-buy-out").dataset.raw && new RegExp("your credit" + esc(full(trCredit)) + " AGENT1").test(page.text("#lane-launch #launch-raise")),
      "another account repaints the lane and drops what the last one typed; the credit shown is the new account's", page.text("#lane-launch #launch-raise").slice(0, 200));
    W.setAccounts([BUYER]); await page.settle();
    j(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the buyer's page", page.errors.map((e) => e.message).join("; "));
    void S;
    page.close();
  }

  /* J10 graduation is anyone's: three buys after the window fill the target (1.05 ETH each — see the header) */
  const sink1 = decAddr(await c.read(hub, "feeSink(uint256)", [1]));
  let KEY = 0n;
  {
    for (const who of [buyer, trader, stranger]) await who.exec(pad, BUY, [LID, 0n, now() + 600n, 10000], { value: 105n * WAD / 100n, label: "buy" });
    const w = await launchOf(LID);
    const W = walletFor(c, stranger);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "launch");
    await page.until(() => !!L(page, "[data-act=graduate]"), 80);
    const raised = decUint(w, 9);
    j(page.$("body").dataset.rights === "0" && !!L(page, "[data-act=graduate]") && raised >= 3n * WAD && decUint(w, 8) < decUint(w, 6),
      "J10 graduation is anyone's: a wallet with rights 0 is offered it once raised meets the target", `rights "${page.$("body").dataset.rights}" raised ${raised}`);
    await press(page, L(page, "[data-act=graduate]"));
    j(page.text("#cslab [data-function]") === "graduate(uint256)" && word(slabCd(page), 0) === LID && /nobody can withdraw/.test(page.text("#cslab [data-sentence]")),
      "the graduation slab says the sealed market's principal can never be withdrawn", page.text("#cslab [data-sentence]"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 1);
    j(decUint(await launchOf(LID), 3) === 2n, "J10 Sign → launchOf(L) word 3 is 2: graduated", decUint(await launchOf(LID), 3));
    KEY = decUint(lastLog(pad, "Graduated(uint256,uint256,uint256,uint256)").topics[2]);
    page.close();
  }

  /* J12 collect shows the sealed market and pays the Reach */
  {
    await buyer.exec(pool, SWAP_IN, [KEY, false, WAD / 10n, 0n, BUYER, now() + 60n], { value: WAD / 10n, label: "swapExactIn" });
    const mk = await c.read(pool, "marketOf(uint256)", [KEY]), owedB = decUint(mk, 13), owedQ = decUint(mk, 14);
    const W = walletFor(c, buyer);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "launch");
    await page.until(() => LL(page, "#launch-positions .sealed").length === 1 && /owes/.test(page.text("#lane-launch #launch-positions")), 80);
    const row = LL(page, "#launch-positions .sealed")[0];
    j(!!row && row.dataset.key === String(KEY) && owedQ > 0n && new RegExp("owes " + esc(full(owedB)) + " AGENT1 · " + esc(full(owedQ)) + " ETH to #1's fee sink").test(row.textContent) && !!L(page, "[data-act=launchCollect]"),
      "J12 the sealed market a graduation opened is listed by its key, with what it owes in its coins' units", row && row.textContent);
    await press(page, L(page, "[data-act=launchCollect]"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    j(page.text("#cslab [data-function]") === "collect(uint256)" && word(slabCd(page), 0) === KEY && lower(page.text("#cslab [data-to]")) === lower(pool),
      "J12 launchCollect raises collect(uint256) to the Pool, naming the sealed market", slabCd(page).slice(0, 80));
    const b0 = await c.balanceOf(sink1);
    await sign(page, W, 1);
    j((await c.balanceOf(sink1)) - b0 === owedQ && lower(sink1) === lower(reach1), "J12 collecting pays exactly what the row said to #1's fee sink, the Reach", `delta ${(await c.balanceOf(sink1)) - b0} owed ${owedQ}`);
    await page.until(() => /owes 0 AGENT1 · 0 ETH/.test(page.text("#lane-launch #launch-positions")), 60);
    const mk2 = await c.read(pool, "marketOf(uint256)", [KEY]);
    t.ok(decUint(mk2, 13) === 0n && decUint(mk2, 14) === 0n && /owes 0 AGENT1 · 0 ETH to #1's fee sink/.test(page.text("#lane-launch #launch-positions")) && !L(page, "[data-act=launchCollect]"),
      "a sealed market that owes nothing offers no collect, as a lock with nothing releasable offers no release", page.text("#lane-launch #launch-positions"));

    /*═══ C · credits become coins after graduation, and the floor is anyone's to raise and a holder's to burn into ═══*/
    t.head("C · credits become coins, and the floor");
    const cr = await credit(LID, BUYER), held = decUint(await c.read(coin, "balanceOf(address)", [BUYER]));
    await page.until(() => !!L(page, "[data-act=claim]"), 60);
    await press(page, L(page, "[data-act=claim]"));
    t.ok(page.text("#cslab [data-function]") === "claim(uint256,address)" && word(slabCd(page), 0) === LID && lower(addrWord(slabCd(page), 1)) === lower(BUYER) && line(page, "Hands") === full(cr) + " AGENT1 to " + page.ctx.INTACT.ui.short(page.ctx.INTACT.ui.checksum(BUYER)),
      "after graduation the credit is claimed for the connected account, the amount in words", `${slabCd(page).slice(0, 80)} "${line(page, "Hands")}"`);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 2);
    t.ok(decUint(await c.read(coin, "balanceOf(address)", [BUYER])) - held === cr && await credit(LID, BUYER) === 0n, "Sign → the credit is the coin, to the unit, and the credit is spent", `${decUint(await c.read(coin, "balanceOf(address)", [BUYER])) - held} vs ${cr}`);
    await page.until(() => !!L(page, "[data-act=redeem]"), 60);
    const floor = decUint(await c.read(coin, "floorPerToken()")), burn = cr / 4n, atLeast = burn * floor / WAD;
    page.type(L(page, "#launch-raise input[name=x1]"), full(burn));
    await press(page, L(page, "[data-act=redeem]"));
    t.ok(floor > 0n && page.text("#cslab [data-function]") === "redeem(uint256)" && word(slabCd(page), 0) === burn && line(page, "Receives") === "at least " + full(atLeast) + " ETH: the floor's share" && lower(page.text("#cslab [data-to]")) === lower(coin),
      "a holder of the coin may burn it into the floor, and the slab states the least it pays from floorPerToken", `floor ${floor} "${line(page, "Receives")}"`);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 3);
    const paid = decUint(lastLog(coin, "Redeemed(address,uint256,uint256)").data, 1);
    t.ok(paid >= atLeast && paid > 0n, "Sign → the redemption paid at least what the slab said", `paid ${paid} at least ${atLeast}`);
    await page.until(() => !!L(page, "[data-act=contribute]") && L(page, "#launch-floor").dataset.raw !== undefined, 60);
    page.type(L(page, "#launch-raise input[name=c1]"), "0.5");
    await press(page, L(page, "[data-act=contribute]"));
    t.ok(page.text("#cslab [data-function]") === "contribute()" && page.$("#cslab [data-value]").dataset.wei === String(WAD / 2n) && /does not come back/.test(page.text("#cslab [data-sentence]")),
      "anyone may raise the floor: contribute() with the value exactly, and the slab says it does not come back", page.text("#cslab [data-sentence]"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    const f0 = decUint(await c.read(coin, "floorPerToken()"));
    await sign(page, W, 4);
    const f1 = decUint(await c.read(coin, "floorPerToken()"));
    await page.until(() => L(page, "#launch-floor") && L(page, "#launch-floor").dataset.raw === String(f1), 60);
    t.ok(f1 > f0 && L(page, "#launch-floor").dataset.raw === String(f1), "Sign → every holder's floor rose, and the lane reads the new floor", `${f0} → ${f1}`);
    /* holding nothing draws no burn; a balance that does not answer must not look the same */
    W.answer(coin, sel("balanceOf(address)"), reverted);
    await repaint(page, page.ctx);
    await page.until(() => /you holdnot reported/.test(page.text("#lane-launch #launch-raise")), 60);
    t.ok(/you holdnot reported: unknown error 0xdeadbeef/.test(page.text("#lane-launch #launch-raise")) && !L(page, "[data-act=redeem]") && page.errors.length === 0,
      "a coin balance that does not answer is said where the burn would be, never drawn as holding nothing", page.text("#lane-launch #launch-raise").slice(-200));
    page.close();
  }

  /* J13, J14: the holder's coin form on #1 — a preview that sends nothing, and a spacing that is a countdown */
  {
    const W = walletFor(c, me);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "launch");
    await page.until(() => !!L(page, "#launch-coin-form") && /next launch in/.test(page.text("#lane-launch #launch-spacing")), 80);
    for (const [k, v] of [["n", "Agent Two"], ["y", "AGENT2"], ["d", "18"], ["v", "1000"], ["r", "0"], ["s", "0x2"]]) page.type(field(page, "#launch-coin-form", k), v);
    const mark = W.calls.length, sent0 = W.sent(), prompts0 = W.prompts().length;
    page.click(L(page, "[data-act=coinAt]"));
    await page.until(() => /^0x[0-9a-fA-F]{40}$/.test(page.text("#lane-launch #launch-coin-preview")), 60);
    const asked = W.callsTo(kiln, sel(COIN_AT)).filter((x) => W.calls.indexOf(x) >= mark);
    const want = decAddr(await c.read(kiln, COIN_AT, [1, ME, "Agent Two", "AGENT2", 18, 1000n * WAD, "0x" + "02".padStart(64, "0"), 0n]));
    j(asked.length === 1 && lower(addrWord(asked[0].params[0].data, 1)) === lower(ME) && lower(page.text("#lane-launch #launch-coin-preview")) === lower(want) && W.sent() === sent0 && W.prompts().length === prompts0,
      "J13 coinAt is previewed with the actual sender as `by`, the address printed, nothing sent", `by ${asked[0] && addrWord(asked[0].params[0].data, 1)} preview ${page.text("#lane-launch #launch-coin-preview")} want ${want}`);
    const last = decUint(await c.read(pad, "lastLaunchAt(uint256)", [1])), until = last + 604800n;
    const m = page.text("#lane-launch #launch-spacing").match(/^next launch in (\d+) s, at /);
    await press(page, L(page, "[data-act=launch]"));
    j(!!m && BigInt(m[1]) === until - now() && last === T0 && gasRow(page) === "would revert: TooSoon(" + until + ")" && W.sent() === sent0,
      "J14 the launch spacing is a countdown from lastLaunchAt + 7 d, and a second coin inside it is TooSoon before the wallet opens", `${page.text("#lane-launch #launch-spacing")} gas "${gasRow(page)}"`);
    page.click(page.$("#cslab [data-no]")); await page.settle();
    page.close();
  }

  /*═══════════ J′ · the fair window's cap per buyer ═══════════*/
  t.head("J′ · the fair window's cap per buyer");
  {
    await c.exec(kiln, LAUNCH, [2, "Agent Three", "AGENT3", 18, SUPPLY, SALT, RAISE], { label: "launch" });
    const coin3 = "0x" + lastLog(kiln, "Launched(address,uint256,address,string,uint256,uint256)").topics[1].slice(26);
    /* fourteen days, not seven: the raise must outlive #2's seven-day spacing, so S's two raises are both open (a closed one draws no buy card) */
    await c.exec(pad, `create(${PARAMS})`, [[2n, coin3, 700_000_000n * WAD, WAD, 3n * WAD, 0n, 3600n, 2n * WAD, 0, 100, 0, 0, now() + 14n * 86400n, 0]], { label: "create" });
    const L2 = decUint(lastLog(pad, "LaunchCreated(uint256,uint256,address,uint8,bytes32)").topics[1]);
    await buyer.exec(pad, BUY, [L2, 0n, now() + 600n, 10000], { value: WAD / 2n, label: "buy" });
    const bought = decUint(await c.read(pad, "boughtInWindow(uint256,address)", [L2, BUYER]));
    const W = walletFor(c, buyer);
    const { page } = await bootToken(2, { wallet: W });
    await lane(page, "launch");
    await page.until(() => /you may still buy/.test(page.text("#lane-launch #launch-window")), 80);
    const m = page.text("#lane-launch #launch-window").match(/you may still buy (\S+) ETH in the window/);
    const ok1 = !!m && toUnits(m[1]) === 2n * WAD - bought && bought === WAD / 2n - WAD / 200n;
    t.ok(ok1, "J′1 what this buyer may still buy in the window is printed: maxBuyInWindow less boughtInWindow, after fee", `${page.text("#lane-launch #launch-window")} vs ${2n * WAD - bought}`);
    page.type(L(page, "#launch-buy-in"), "3");
    await page.until(() => !!L(page, "#launch-buy-out").dataset.raw && !L(page, "[data-act=buy]").disabled, 60);
    const p0 = W.prompts().length;
    await press(page, L(page, "[data-act=buy]"));
    const ok2 = /^would revert: FairWindowCapExceeded\(\d+, 2000000000000000000\)$/.test(gasRow(page)) && page.$("#cslab [data-go]").disabled && W.prompts().length === p0;
    t.ok(ok2, "J′2 a buy over the cap is a sentence before any prompt: FairWindowCapExceeded in the estimate, Sign disabled", `gas "${gasRow(page)}" prompts ${W.prompts().length - p0}`);
    page.click(page.$("#cslab [data-no]")); await page.settle();
    page.close();
  }

  /*═══════════ K · the holder launches a coin and opens its raise from the page ═══════════*/
  t.head("K · the holder launches a coin and opens its raise from the page");
  {
    const W = walletFor(c, me);
    const { page } = await bootToken(3, { wallet: W });
    await lane(page, "launch");
    await page.until(() => !!L(page, "#launch-coin-form") && /none yet/.test(page.text("#lane-launch #launch-spacing")), 80);
    for (const [k, v] of [["n", "Agent Four"], ["y", "AGENT4"], ["d", "18"], ["v", "1000000"], ["r", "900000"], ["s", "0x4"]]) page.type(field(page, "#launch-coin-form", k), v);
    page.click(L(page, "[data-act=coinAt]"));
    await page.until(() => /^0x[0-9a-fA-F]{40}$/.test(page.text("#lane-launch #launch-coin-preview")), 60);
    const preview = page.text("#lane-launch #launch-coin-preview");
    await press(page, L(page, "[data-act=launch]"));
    const cd = slabCd(page);
    t.ok(page.text("#cslab [data-function]") === LAUNCH && line(page, "Lands at") === preview && word(cd, 0) === 3n && word(cd, 4) === 1_000_000n * WAD && word(cd, 6) === 900_000n * WAD &&
      /minted once and never again/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)),
      "the launch slab names launch(…), the supply and the raise share in base units, and where it lands — the preview's address", `fn ${page.text("#cslab [data-function]")} lands "${line(page, "Lands at")}" vs ${preview}`);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 1);
    const coin4 = "0x" + lastLog(kiln, "Launched(address,uint256,address,string,uint256,uint256)").topics[1].slice(26);
    const reach3 = decAddr(await c.read(hub, "account(uint256)", [3]));
    t.ok(lower(coin4) === lower(preview) && decUint(await c.read(kiln, "launchedBy(address)", [coin4])) === 3n && decUint(await c.read(coin4, "balanceOf(address)", [pad])) === 900_000n * WAD &&
      decUint(await c.read(coin4, "balanceOf(address)", [reach3])) === 100_000n * WAD,
      "the launch landed exactly where the page said it would, attributed to #3, its raise share at the Launchpad and the rest at #3's Reach", `${coin4} vs ${preview}`);
    /* the raise: createChecked with the termsHash read in the same press */
    await page.until(() => !!field(page, "#launch-create", "curve") && /AGENT4/.test(page.text("#lane-launch #launch-create")), 80);
    for (const [k, v] of [["curve", "700000"], ["vq", "1"], ["tgt", "3"], ["win", "1000"], ["cap", ""], ["tax", "9900"], ["fee", "100"], ["cr", "0"], ["vest", "0"], ["days", "7"]]) page.type(field(page, "#launch-create", k), v);
    const mark = W.calls.length;
    await press(page, L(page, "[data-act=create]"));
    const ccd = slabCd(page);
    const params = [...Array(14)].map((_, i) => i === 1 ? addrWord(ccd, 1) : word(ccd, i));
    const hash = await c.read(pad, `termsHash(${PARAMS})`, [params]);
    const hashed = W.callsTo(pad, sel(`termsHash(${PARAMS})`)).filter((x) => W.calls.indexOf(x) >= mark).length;
    t.ok(page.text("#cslab [data-function]") === `createChecked(${PARAMS},bytes32)` && page.$$("#cslab [data-arg]").length === 0 && word(ccd, 14) === BigInt(hash.slice(0, 66)) && hashed === 1 &&
      line(page, "Terms hash") === hash.slice(0, 66) && lower(params[1]) === lower(coin4) && params[2] === 700_000n * WAD && params[7] === (1n << 128n) - 1n && params[8] === 9900n && line(page, "Cap per buyer") === "none",
      "createChecked carries the termsHash read in the same press; a tuple gets no [data-arg] rows, so every argument is a line", `hash ${hash.slice(0, 18)} w14 ${word(ccd, 14).toString(16).slice(0, 16)} asked ${hashed} args ${page.$$("#cslab [data-arg]").length}`);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 2);
    const created = lastLog(pad, "LaunchCreated(uint256,uint256,address,uint8,bytes32)");
    t.ok(decUint(created.topics[2]) === 3n && lower("0x" + created.topics[3].slice(26)) === lower(coin4) && "0x" + created.data.slice(2 + 64, 2 + 128) === hash.slice(0, 66),
      "the raise opened under exactly the terms the slab hashed", created.data.slice(0, 140));
    await page.until(() => LL(page, "#launch-raises .raise").length === 1 && /AGENT4 · live/.test(page.text("#lane-launch #launch-raises")), 60);
    t.ok(/AGENT4 · live · raised 0 of 3 ETH/.test(page.text("#lane-launch #launch-raises")) && page.innerHTMLWrites === 0 && page.errors.length === 0,
      "after the receipt the lane lists the new raise, and no script threw", page.errors.map((e) => e.message).join("; ") || page.text("#lane-launch #launch-raises").slice(0, 120));
    page.close();
  }

  /*═══════════ G · the guardian co-signs the Reach's first launch ═══════════*/
  t.head("G · the guardian co-signs the Reach's first launch");
  {
    await c.exec(hub, "setGuardian(uint256,address)", [4, guardianW.from.toString()], { label: "setGuardian" });
    const W = walletFor(c, guardianW);
    const { page } = await bootToken(4, { wallet: W });
    await lane(page, "launch");
    await page.until(() => !!L(page, "[data-act=approveFirstLaunch]"), 80);
    t.ok(page.$("body").dataset.rights === "64" && !L(page, "#launch-coin-form") && LL(page, "#launch-coin input").length === 0 && !L(page, "#launch-create"),
      "the guardian is offered the co-sign and no coin form", `rights ${page.$("body").dataset.rights}`);
    await press(page, L(page, "[data-act=approveFirstLaunch]"));
    t.ok(page.text("#cslab [data-function]") === "approveFirstLaunch(uint256)" && word(slabCd(page), 0) === 4n && /custody epoch/.test(page.text("#cslab [data-sentence]")),
      "the co-sign's slab says it is stamped with the custody epoch", page.text("#cslab [data-sentence]"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 1);
    await page.until(() => /co-signed at this epoch/.test(laneText(page)), 60);
    t.ok((await c.read(pad, "firstLaunchApproved(uint256)", [4])).endsWith("1") && !L(page, "[data-act=approveFirstLaunch]") && /co-signed at this epoch: #4's Reach may make the first launch/.test(laneText(page)),
      "Sign → firstLaunchApproved(4), and the lane says the Reach may now make the first launch", laneText(page).slice(0, 200));
    page.close();
  }

  /*═══════════ F · a raise that misses its target fails, and its buyers are refunded ═══════════*/
  t.head("F · a raise that misses its target fails, and its buyers are refunded");
  {
    await c.exec(kiln, LAUNCH, [4, "Agent Five", "AGENT5", 18, SUPPLY, SALT, RAISE], { label: "launch" });
    const coin5 = "0x" + lastLog(kiln, "Launched(address,uint256,address,string,uint256,uint256)").topics[1].slice(26);
    const dl5 = now() + 86400n;
    await c.exec(pad, `create(${PARAMS})`, [[4n, coin5, 700_000_000n * WAD, WAD, 1000n * WAD, 0n, 0n, (1n << 128n) - 1n, 0, 100, 0, 0, dl5, 0]], { label: "create" });
    const L5 = decUint(lastLog(pad, "LaunchCreated(uint256,uint256,address,uint8,bytes32)").topics[1]);
    await buyer.exec(pad, BUY, [L5, 0n, now() + 600n, 10000], { value: WAD, label: "buy" });
    ctx.warp(dl5 + 1n);
    {
      /* past the deadline nothing can be bought or sold (Launchpad._live: DeadlinePassed): the buyer, credit in hand, is offered neither */
      const WB = walletFor(c, buyer);
      const { page: pp } = await bootToken(4, { wallet: WB });
      await lane(pp, "launch");
      await pp.until(() => /your credit/.test(pp.text("#lane-launch #launch-raise")) && !!L(pp, "[data-act=contribute]") && !!L(pp, "[data-act=fail]"), 80);
      const cr5 = await credit(L5, BUYER);
      t.ok(cr5 > 0n && new RegExp("your credit" + esc(full(cr5)) + " AGENT5").test(pp.text("#lane-launch #launch-raise")) && !L(pp, "[data-act=buy]") && !L(pp, "#launch-buy-in") &&
        !L(pp, "[data-act=sell]") && !L(pp, `#launch-raise input[name=s${L5}]`) && !!L(pp, "[data-act=fail]"),
        "past its deadline the raise offers no buy and no sell, only fail — the buyer's credit still printed", `acts ${LL(pp, "[data-act]").map((b) => b.dataset.act)}`);
      pp.close();
    }
    const WS = walletFor(c, stranger);
    const { page } = await bootToken(4, { wallet: WS });
    await lane(page, "launch");
    await page.until(() => !!L(page, "[data-act=fail]"), 80);
    t.ok(!L(page, "[data-act=graduate]") && page.$("body").dataset.rights === "0", "past its deadline short of its target, anyone is offered to fail it, and nobody to graduate it", laneText(page).slice(0, 160));
    await press(page, L(page, "[data-act=fail]"));
    t.ok(page.text("#cslab [data-function]") === "fail(uint256)" && word(slabCd(page), 0) === L5 && /for good/.test(page.text("#cslab [data-sentence]")) && /^\d+ units$/.test(gasRow(page)),
      "the fail slab says it is for good, and the estimate passes", page.text("#cslab [data-sentence]"));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, WS, 1);
    t.ok(decUint(await launchOf(L5), 3) === 3n, "Sign → the raise is failed (state 3)", decUint(await launchOf(L5), 3));
    page.close();
    const W = walletFor(c, buyer);
    const { page: pb } = await bootToken(4, { wallet: W });
    await lane(pb, "launch");
    await pb.until(() => !!L(pb, "[data-act=refund]"), 80);
    await press(pb, L(pb, "[data-act=refund]"));
    t.ok(pb.text("#cslab [data-function]") === "refund(uint256,address)" && word(slabCd(pb), 0) === L5 && lower(addrWord(slabCd(pb), 1)) === lower(BUYER) && /^AGENT5 · failed/.test(LL(pb, "#launch-raises .raise")[0].textContent),
      "a buyer of the failed raise is offered its refund, paid to itself", slabCd(pb).slice(0, 80));
    await pb.until(() => !pb.$("#cslab [data-go]").disabled, 40);
    const b0 = await c.balanceOf(BUYER);
    await sign(pb, W, 1);
    const refunded = decUint(lastLog(pad, "Refunded(uint256,address,uint256)").data, 0);
    t.ok(refunded === WAD && await credit(L5, BUYER) === 0n && (await c.balanceOf(BUYER)) > b0, "Sign → the whole pot comes back to the only buyer, fee included, and the credit is spent", `refunded ${refunded}`);
    pb.close();
  }

  /*═══════════ V · locks: the Reach's, listed; a new one through the exact approval step; extend and give ═══════════*/
  t.head("V · the locks that travel with the token");
  {
    const t1 = now();
    await c.exec(locks, LOCK, [ZERO, WAD, reach1, 0, t1 + 2n * 86400n, t1 + 2n * 86400n, false], { value: WAD, label: "lock" });
    await c.exec(locks, LOCK, [ZERO, WAD / 2n, reach1, 0, 0, t1 + 10n * 86400n, true], { value: WAD / 2n, label: "lock" });
    const [idA, idB] = [1n, 2n];
    const W = walletFor(c, me);
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
    await lane(page, "launch");
    const count = Number(decUint(await c.read(locks, "lockCountOf(address)", [reach1])));
    await page.until(() => LL(page, "#launch-locks .lock").length === count, 80);
    const rowA = LL(page, "#launch-locks .lock")[0];
    j(LL(page, "#launch-locks .lock").length === count && count === 2 && /^lock #1/.test(rowA.textContent) && /releasable now 0 ETH$/.test(rowA.firstChild.textContent) && !rowA.querySelector("[data-act=lockRelease]"),
      "J15 locks list the Reach's: one row per lockCountOf(reach), each with its releasable printed", `${LL(page, "#launch-locks .lock").length} vs ${count}: ${rowA && rowA.textContent}`);
    /* extend, through the Reach, its beneficiary */
    const rowB = LL(page, "#launch-locks .lock")[1];
    page.type(rowB.querySelector("input[name=e2]"), "30");
    const tsx = now();
    await press(page, rowB.querySelector("[data-act=extend]"));
    const xcd = slabCd(page), inner = "0x" + xcd.slice(10 + 64 * 5, 10 + 64 * 5 + 136);
    t.ok(page.text("#cslab [data-function]") === EXEC && lower(page.text("#cslab [data-to]")) === lower(reach1) && lower(addrWord(xcd, 0)) === lower(locks) && inner.slice(0, 10) === sel("extend(uint256,uint64)") &&
      word(inner, 0) === idB && word(inner, 1) === tsx + 30n * 86400n && /only ever lengthens/.test(page.text("#cslab [data-sentence]")),
      "extend goes through reach.execute to Locks, the new end thirty days on the chain's clock", `to ${page.text("#cslab [data-to]")} inner ${inner.slice(0, 10)} end ${word(inner, 1)}`);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 1);
    t.ok(decUint(await c.read(locks, "lockOf(uint256)", [idB]), 7) === tsx + 30n * 86400n, "the lock's end moved", decUint(await c.read(locks, "lockOf(uint256)", [idB]), 7));
    /* a new lock of WETH: the first press is the exact approve, the same button the lock */
    await c.exec(weth, "mint(address,uint256)", [ME, 10n * WAD]);
    await page.until(() => !!field(page, "#launch-locks", "la"), 40);
    page.type(field(page, "#launch-locks", "la"), weth); page.type(field(page, "#launch-locks", "lv"), "5"); page.type(field(page, "#launch-locks", "ld"), "30");
    await press(page, L(page, "[data-act=lock]"));
    const acd = slabCd(page);
    t.ok(page.text("#cslab [data-function]") === "approve(address,uint256)" && lower(page.text("#cslab [data-to]")) === lower(weth) && lower(addrWord(acd, 0)) === lower(locks) && word(acd, 1) === 5n * WAD && /Never\s*unlimited/.test(page.text("#cslab")),
      "the first press of an ERC-20 lock is the exact approve to Locks, never unlimited", acd.slice(0, 140));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 2);
    t.ok(decUint(await c.read(weth, "allowance(address,address)", [ME, locks])) === 5n * WAD && field(page, "#launch-locks", "lv").value === "5" && !!L(page, "[data-act=lock]"),
      "the approve landed exactly, and the form still holds what was typed: the same button is the lock", `allowance ${decUint(await c.read(weth, "allowance(address,address)", [ME, locks]))} value "${field(page, "#launch-locks", "lv").value}"`);
    const tsl = now();
    await press(page, L(page, "[data-act=lock]"));
    const lcd = slabCd(page);
    t.ok(page.text("#cslab [data-function]") === LOCK && lower(addrWord(lcd, 0)) === lower(weth) && word(lcd, 1) === 5n * WAD && lower(addrWord(lcd, 2)) === lower(reach1) && word(lcd, 5) === tsl + 30n * 86400n &&
      word(lcd, 4) === word(lcd, 5) && word(lcd, 6) === 0n && !page.$("#cslab [data-value]") && /goes with the token/.test(page.text("#cslab [data-sentence]")),
      "pressed again, the same button is the lock: the Reach as beneficiary, a date on the chain's clock, no value", lcd.slice(0, 140));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 3);
    t.ok(decUint(await c.read(locks, "lockCountOf(address)", [reach1])) === 3n && decUint(await c.read(weth, "allowance(address,address)", [ME, locks])) === 0n,
      "the lock landed for the Reach and nothing stays approved", decUint(await c.read(locks, "lockCountOf(address)", [reach1])));
    /* an ETH lock needs no approval: the amount is the value, exactly, and the first press is the lock */
    await page.until(() => !!field(page, "#launch-locks", "la") && field(page, "#launch-locks", "lv").value === "", 40);
    page.type(field(page, "#launch-locks", "la"), "0x0"); page.type(field(page, "#launch-locks", "lv"), "0.25"); page.type(field(page, "#launch-locks", "ld"), "1");
    await press(page, L(page, "[data-act=lock]"));
    const ecd = slabCd(page);
    t.ok(page.text("#cslab [data-function]") === LOCK && lower(addrWord(ecd, 0)) === ZERO && word(ecd, 1) === WAD / 4n && page.$("#cslab [data-value]").dataset.wei === String(WAD / 4n) && line(page, "Lets") === null,
      "an ETH lock is the lock itself at the first press, its amount the value exactly", ecd.slice(0, 80));
    page.click(page.$("#cslab [data-no]")); await page.settle();
    /* give: lock B to #2's Reach; #1's list drops it though the finding aid keeps the entry */
    await page.until(() => LL(page, "#launch-locks .lock").length === 3, 60);
    const rowB2 = LL(page, "#launch-locks .lock").find((r) => /^lock #2/.test(r.textContent));
    page.type(rowB2.querySelector("input[name=g2]"), reach2);
    await press(page, rowB2.querySelector("[data-act=give]"));
    const gcd = slabCd(page), ginner = "0x" + gcd.slice(10 + 64 * 5, 10 + 64 * 5 + 136);
    t.ok(page.text("#cslab [data-function]") === EXEC && ginner.slice(0, 10) === sel("give(uint256,address)") && word(ginner, 0) === idB && lower(addrWord(ginner, 1)) === lower(reach2),
      "give goes through reach.execute, naming the other token's Reach", ginner.slice(0, 80));
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 4);
    await page.until(() => LL(page, "#launch-locks .lock").length === 2, 60);
    t.ok(lower(decAddr(await c.read(locks, "lockOf(uint256)", [idB]), 1)) === lower(reach2) && LL(page, "#launch-locks .lock").length === 2 && decUint(await c.read(locks, "lockCountOf(address)", [reach1])) === 3n,
      "a lock given away leaves #1's list, though lockIdOf's finding aid keeps its entry", `${LL(page, "#launch-locks .lock").length} rows, count ${decUint(await c.read(locks, "lockCountOf(address)", [reach1]))}`);
    /* release: past lock A's end anyone may release it, to the Reach */
    ctx.warp(t1 + 2n * 86400n + 1n);
    await repaint(page, vctx);
    await page.until(() => !!L(page, "[data-act=lockRelease]"), 60);
    const relA = decUint(await c.read(locks, "releasable(uint256)", [idA]));
    const rowA2 = LL(page, "#launch-locks .lock").find((r) => /^lock #1/.test(r.textContent));
    j(relA === WAD && new RegExp("releasable now " + esc(full(relA)) + " ETH$").test(rowA2.firstChild.textContent) && !!rowA2.querySelector("[data-act=lockRelease]"),
      "J15 past its end, lock #1's releasable is printed and the release is offered", rowA2 && rowA2.textContent);
    await press(page, rowA2.querySelector("[data-act=lockRelease]"));
    j(page.text("#cslab [data-function]") === "release(uint256)" && lower(page.text("#cslab [data-to]")) === lower(S.locks) && word(slabCd(page), 0) === idA,
      "J15 the control is lockRelease → release(uint256) to INTACT.locks", `${page.text("#cslab [data-function]")} to ${page.text("#cslab [data-to]")}`);
    const r0 = await c.balanceOf(reach1);
    await page.until(() => !page.$("#cslab [data-go]").disabled, 40);
    await sign(page, W, 5);
    j((await c.balanceOf(reach1)) - r0 === WAD, "J15 the release pays the Reach, to the wei", (await c.balanceOf(reach1)) - r0);
    /* given back: Locks.give pushes the id onto #1's index again, so lockIdOf names lock #2 twice */
    await c.exec(reach2, EXEC, [locks, 0n, ctx.enc("give(uint256,address)", [idB, reach1]), 0n], { label: "give back" });
    await repaint(page, vctx);
    await page.until(() => LL(page, "#launch-locks .lock").length >= 3, 60);
    const idx = await Promise.all([0, 1, 2, 3].map(async (i) => decUint(await c.read(locks, "lockIdOf(address,uint256)", [reach1, i]))));
    t.ok(idx.filter((k) => k === idB).length === 2 && LL(page, "#launch-locks .lock").filter((r) => lockId(r) === "lock #2").length === 1 && LL(page, "#launch-locks .lock").length === 3,
      "a lock given away and given back is listed once, though lockIdOf now names it twice", `index ${idx.join(",")} rows ${LL(page, "#launch-locks .lock").map(lockId).join(",")}`);
    /* an address with no code answers every eth_call with nothing: that is no answer, not a coin with 0 decimals */
    const eoa = stranger.from.toString(), p5 = W.prompts().length, U = page.ctx.INTACT.ui;
    page.type(field(page, "#launch-locks", "la"), eoa); page.type(field(page, "#launch-locks", "lv"), "5"); page.type(field(page, "#launch-locks", "ld"), "30");
    page.click(L(page, "[data-act=lock]"));
    await page.until(() => /did not answer/.test(tick(page)) || slabOpen(page), 40);
    t.ok(!slabOpen(page) && tick(page) === U.short(eoa) + "'s decimals did not answer; nothing is guessed" && W.prompts().length === p5,
      "an address with no code is not a coin with 0 decimals: the lock form says its decimals did not answer and builds no approve", `slab ${slabOpen(page)} tick "${tick(page)}"`);
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML and no script threw on the holder's page", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
  t.ok(J, "the raise shows the tax as a countdown");
  t.ok(F12, "every approval the slab builds is exact — re-asserted for the Launch sell: credits, not tokens, so there is no approval to build");

  /*═══════════ O · the gates: the viewer offers nothing ═══════════*/
  t.head("O · the gates: who may press, and a read with no answer");
  /* Locks.lock is anyone's, for any asset and any Reach: a stranger locks a worthless token that calls itself ETH for #1's Reach */
  const fake = await c.deploy(ctx.A("test/mocks/MockERC20.sol", "MockERC20").bytecode, encodeParams("string,string,uint8,uint256,bool", ["Ether", "ETH", 18, 0, false]), "FAKE-ETH");
  await stranger.exec(fake, "mint(address,uint256)", [stranger.from.toString(), WAD]);
  await stranger.exec(fake, "approve(address,uint256)", [locks, WAD]);
  const tf = now() + 30n * 86400n;
  await stranger.exec(locks, LOCK, [fake, WAD, reach1, 0, tf, tf, false], { label: "lock" });
  const fid = decUint(await c.read(locks, "lockCount()"));
  {
    const W = walletFor(c, me);
    const { page } = await bootToken(1, { opaque: true, wallet: W });
    await lane(page, "launch");
    await page.until(() => LL(page, "#launch-raises .raise").length > 0, 80);
    t.ok(page.$("body").dataset.mode === "viewer" && LL(page, "[data-act]").length === 0 && LL(page, "input").length === 0 && (laneText(page).match(/nothing here can sign/g) || []).length === 1 &&
      LL(page, "#launch-raises .raise").length === 1 && W.prompts().length === 0,
      "the viewer reads every raise and offers no control and no input, with the one sentence", `acts ${LL(page, "[data-act]").length} inputs ${LL(page, "input").length}`);
    /* the buyer's own view: what #1's Reach carries, ether or a token named ETH */
    await page.until(() => LL(page, "#launch-locks .lock").some((r) => lockId(r) === "lock #" + fid), 60);
    const U = page.ctx.INTACT.ui, keys = LL(page, "#launch-locks .lock").map(lockKey), fr = LL(page, "#launch-locks .lock").find((r) => lockId(r) === "lock #" + fid);
    t.ok(keys.includes("lock #1 · native ETH") && keys.includes("lock #" + fid + " · token " + U.short(U.checksum(fake))) && !!fr && /^1 ETH · unlocks at /.test(fr.firstChild.lastChild.textContent),
      "the viewer tells ether from a token that calls itself ETH: each lock row names its asset in a cell no token writes, native ETH or the token's address", keys.join(" | "));
    page.close();
  }
  {
    /* a decimals() that answers 2^256 − 1 is no exponent: that lock prints raw units, and every lock after it still lists */
    const W = walletFor(c, me);
    W.answer(weth, sel("decimals()"), () => "0x" + "f".repeat(64));
    const { page } = await bootToken(1, { opaque: true, wallet: W });
    await lane(page, "launch");
    await page.until(() => LL(page, "#launch-locks .lock").some((r) => lockId(r) === "lock #" + fid) || page.errors.length > 0, 60);
    const wr = LL(page, "#launch-locks .lock").find((r) => lockId(r) === "lock #3");
    t.ok(!!wr && /^5000000000000000000 units of WETH · unlocks at /.test(wr.firstChild.lastChild.textContent) && LL(page, "#launch-locks .lock").some((r) => lockId(r) === "lock #" + fid) && page.errors.length === 0,
      "a decimals() of 2^256 − 1 hides nothing: that lock prints raw units, and the locks after it still list", `${LL(page, "#launch-locks .lock").map((r) => r.textContent.slice(0, 60)).join(" | ")} errors ${page.errors.map((e) => e.message)}`);
    page.close();
  }
  {
    /* a token that never launched, with the clock and the launch list both refused: each fact keeps its own sentence */
    await mint(c, site, ME);
    const W = walletFor(c, me);
    W.refuse("eth_getBlockByNumber", Object.assign(new Error("boom"), { code: -32603 }));
    W.answer(pad, sel("launchesOf(uint256)"), reverted);
    const { page } = await bootToken(5, { wallet: W });
    await lane(page, "launch");
    await page.until(() => !/reading/.test(page.text("#lane-launch #launch-spacing")) && /not reported/.test(page.text("#lane-launch #launch-raises")), 60);
    t.ok(page.text("#lane-launch #launch-spacing") === "none yet: the first is the holder's" && decUint(await c.read(pad, "lastLaunchAt(uint256)", [5])) === 0n,
      "a token that never launched says none yet with the clock refused: lastLaunchAt's zero needs no clock", `spacing "${page.text("#lane-launch #launch-spacing")}"`);
    t.ok(/not reported: unknown error 0xdeadbeef/.test(page.text("#lane-launch #launch-raises")) && /not reported: unknown error 0xdeadbeef/.test(page.text("#lane-launch #launch-positions")) &&
      !/none yet/.test(page.text("#lane-launch #launch-positions")) && page.errors.length === 0,
      "a launch list that does not answer is said under the raises and under the sealed markets, never as none", `positions "${page.text("#lane-launch #launch-positions")}"`);
    page.close();
  }
  {
    /* rights that could not be read are not a stranger's: even the anyone-controls wait for a read that answered */
    const W = walletFor(c, buyer);
    W.answer(hub, sel("rightsOf(uint256,address)"), () => { throw Object.assign(new Error("boom"), { code: -32000 }); });
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "launch");
    await page.until(() => LL(page, "#launch-raises .raise").length > 0 && /raised/.test(page.text("#lane-launch #launch-raises")), 80);
    t.ok(LL(page, "[data-act]").length === 0 && LL(page, "input").length === 0 && (laneText(page).match(/your rights could not be read at block \d+/g) || []).length === 1 && page.$("body").dataset.rights === "",
      "with rights that could not be read the lane still reads every raise, offers nothing to press, and says why once", `acts ${LL(page, "[data-act]").length} inputs ${LL(page, "input").length}`);
    page.close();
  }
  {
    /* zero and no answer are different facts: a floor, a tax and a lock count that will not answer print why, never 0 */
    const W = walletFor(c, buyer);
    const reverted = () => { throw Object.assign(new Error("execution reverted"), { code: 3, data: "0xdeadbeef" }); };
    W.answer(coin, sel("floorPerToken()"), reverted);
    W.answer(pad, sel("snipeTaxBps(uint256)"), reverted);
    W.answer(locks, sel("lockCountOf(address)"), reverted);
    const { page } = await bootToken(1, { wallet: W });
    await lane(page, "launch");
    await page.until(() => !!L(page, "#launch-floor") && /^not reported/.test(page.text("#lane-launch #launch-floor")) && /not reported/.test(page.text("#lane-launch #launch-locks")), 80);
    t.ok(page.text("#lane-launch #launch-floor") === "not reported: unknown error 0xdeadbeef" && L(page, "#launch-floor").dataset.raw === undefined &&
      page.text("#lane-launch #launch-tax") === "not reported: unknown error 0xdeadbeef" && !L(page, "#launch-tax-countdown") &&
      /not reported: unknown error 0xdeadbeef/.test(page.text("#lane-launch #launch-locks")) && LL(page, "#launch-locks .lock").length === 0 && !/: 0 ETH per whole|releasable now 0/.test(laneText(page)),
      "a floor, a tax and a lock list that will not answer print the reason, never a zero", `floor "${page.text("#lane-launch #launch-floor")}" tax "${page.text("#lane-launch #launch-tax")}"`);
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "and nothing threw or was written as markup on the way", page.errors.map((e) => e.message).join("; "));
    page.close();
  }

  {
    /* the collection page has no token: the lane says where a launch is made and reads nothing on a token's behalf */
    const W = walletFor(c, buyer);
    const { page } = await ctx.bootPage("/", { wallet: W });
    const n0 = W.count("eth_call");
    const loaded = await lane(page, "launch");
    t.ok(loaded && laneText(page) === "a coin is launched by a token: open one to see its raises and locks" && LL(page, "[data-act]").length === 0 && W.count("eth_call") === n0,
      "on the collection page the lane says a coin is launched by a token, and reads nothing", `"${laneText(page)}" calls +${W.count("eth_call") - n0}`);
    page.close();
  }

  /*═══════════ S · two raises on one token: the newest is open, and a press opens the other ═══════════*/
  t.head("S · two raises on one token");
  {
    ctx.warp(decUint(await c.read(pad, "lastLaunchAt(uint256)", [2])) + 604801n);
    await c.exec(kiln, LAUNCH, [2, "Agent Six", "AGENT6", 18, SUPPLY, SALT, RAISE], { label: "launch" });
    const coin6 = "0x" + lastLog(kiln, "Launched(address,uint256,address,string,uint256,uint256)").topics[1].slice(26);
    await c.exec(pad, `create(${PARAMS})`, [[2n, coin6, 700_000_000n * WAD, WAD, 3n * WAD, 0n, 0n, (1n << 128n) - 1n, 0, 100, 0, 0, now() + 7n * 86400n, 0]], { label: "create" });
    const L6 = decUint(lastLog(pad, "LaunchCreated(uint256,uint256,address,uint8,bytes32)").topics[1]);
    const W = walletFor(c, buyer);
    const { page } = await bootToken(2, { wallet: W });
    await lane(page, "launch");
    await page.until(() => LL(page, "#launch-raises .raise").length === 2 && !!L(page, "#launch-raise"), 80);
    const rows = LL(page, "#launch-raises .raise");
    const opened = (id) => new RegExp("^raise#" + id + " · ").test(L(page, "#launch-raise").firstChild.textContent);
    const first = rows[1].classList.contains("on") && !rows[0].classList.contains("on") && opened(L6) && /^AGENT6/.test(rows[1].textContent);
    page.click(rows[0]); await page.settle();
    const L2 = decUint(await c.read(pad, "launchesOf(uint256)", [2]), 2);
    await page.until(() => !!L(page, "#launch-raise") && opened(L2), 60);
    /* the two counts below are document-wide on purpose — the one exception to "every selector scoped to the lane"
       (BLUEPRINT §4): that an id names one element is a fact about the document, not the lane */
    t.ok(first && opened(L2) && LL(page, "#launch-raises .raise")[0].classList.contains("on") && page.$$("#launch-tax").length === 1 && page.$$("#launch-buy-in").length === 1,
      "with two raises the newest opens first, a press opens the other, and every id stays one element", `first ${first} opened ${L(page, "#launch-raise") && L(page, "#launch-raise").firstChild.textContent}`);
    page.close();
  }
}
