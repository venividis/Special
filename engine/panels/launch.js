/*  INTACT panel "launch" — a coin the token makes, the raise that sells it,
    the sealed market it graduates into, and the locks that travel with the
    token. Injected as a Blob script after the shell keccak'd these bytes
    against window.INTACT.panels.launch. One IIFE, nothing at top level
    (terser mangles the shell's top level to one-letter names; a top-level
    const here would collide and the panel would never run — E §3.4; the
    build refuses one). Every text node through textContent. Every write
    through INTACT.ui.propose; the one approval (an ERC-20 lock) through
    INTACT.ui.approveExactThen, exact, as the button's current step.

    Origin: IPSEITY engine/console-lanes.js LANE[6] "MAKE SOMETHING WITH IT"
    (branch claude/claude-md-docs-8vvyc8, lines 1059–1092), ported onto the
    panel contract (docs/CONSOLE.md §5). The donor lane was the mint and one
    promise: the price is read before the button and attached to the send,
    and a price that does not answer refuses to guess. INTACT's mint is the
    collection page's (the shell's), so what this lane keeps is the promise,
    applied to everything it sends: a quote that does not answer, a coin's
    decimals that do not answer, a landing address that does not answer, a
    clock that does not answer — each is a sentence and no slab. The donor's
    `unbuilt` line ("launching a coin … not built into the console yet") is
    the lane this file is, and its other half survives as the note under the
    sealed markets naming what is still not built. The coin form's checks
    are IPSEITY src/DeskLaunch.sol's (`form()`: a name and a symbol, decimals
    0 to 36, a supply above nothing, the salt as hex), its "where would it
    land" preview is `coinAt` with `by` = the wallet that will send (D19),
    and the lock form keeps IPSEITY /lock's two promises (a date, not a
    number; the first press approves exactly the amount). window.CON became
    window.INTACT (B §1.7); mine()/onlyHolder() became ui.act/ui.gate on the
    rights bits; the donor's propose(title, lines, tx) became ui.propose with
    a sentence, lines and, where a quote can move under the slab, a recheck
    that asks the curve again inside the press.

    What INTACT changed, and the lane encodes:
      · buyers hold credits, not tokens, until graduation — so a sell needs
        no approval, and the slab says so ("credits, not tokens");
      · the opening tax is priced by the clock: the lane prints the
        Launchpad's own snipeTaxBps(L) and counts down to the fair window's
        end on the chain's clock (ui.clock(), never Date.now(); Date.now()
        only moves the seconds between reads, CONSOLE §12). Between reads
        the percentage is the contract's own line over the launch's own
        words, so the number shown is the one the next block charges; the
        clamp (fee and tax together at most 99 %) is what the buy's
        maxFeeBps carries — min(fee + tax, 9900), not BLUEPRINT §5.3's
        "≥ fee + tax": the contract never takes more than 99 %, so a cap of
        fee + tax (100 % at the opening block) would protect nothing;
      · the curve's terms are pinned by their hash: createChecked with
        termsHash(params) read in the same press, the 14-field tuple laid
        with ui.enc and every argument in the slab's lines (a tuple has no
        [data-arg] rows, CONSOLE §4.2). The raise opens at once (startsAt 0)
        into this collection's Pool (Target.UniswapV4 is NotYet); `create`,
        which pins nothing, has no row here;
      · graduation, failure, refunds, claims, collecting and releasing are
        anyone's, and render for any connected account whose rights read
        answered — stricter than CONSOLE §3's "needBits 0 renders for any
        connected account": unread rights are not a stranger's, and boot's
        "rights that could not be read are not zero" holds with every panel
        loaded;
      · locks name the token's Reach as beneficiary, so a sale sells them;
        the list is the live lockCountOf(reach), not the baked reachLocks,
        and each lock is asked for its beneficiary (lockIdOf is a finding
        aid that keeps a given lock's entry).

    Not in the MVB (CONSOLE §14), and the lane says so where a holder would
    look — under the sealed markets: Uniswap v4 launches, their positions
    and the LP custodian. A coin is launched here from the holder's wallet
    only; a launch through the Reach (an agent's session, with the
    guardian's co-sign) is U17's composer, and the guardian's half of it —
    approveFirstLaunch — is here. On the collection page (id 0) the lane
    says a coin is launched by a token, and reads nothing.

    Elements this panel introduces (CONSOLE §6.2; the suite reads them
    scoped to #lane-launch):
      #launch-coin                 the coin section; #launch-spacing (next launch in N s)
      #launch-coin-form            name, symbol, decimals, supply, raise share, salt (HOLD only)
      #launch-coin-preview         where coinAt says the coin would land
      #launch-raises .raise        one button per launchesOf(id), "SYM · state · raised X of Y ETH"
      #launch-raise                the selected raise: #launch-tax ("99.00 %" / "no tax"),
                                   #launch-tax-countdown ("falls to nothing in N s"), #launch-floor
                                   (dataset.raw = floorPerToken), #launch-window ("you may still buy …"),
                                   #launch-buy-in, #launch-buy-out, #launch-buy-fee, #launch-buy-snipe
                                   (dataset.raw = quoteBuy's three words)
      #launch-create               the raise form (HOLD), inputs name=curve|vq|tgt|win|cap|tax|fee|cr|vest|days
      #launch-positions .sealed    graduated raises' sealed markets (dataset.key)
      #launch-locks .lock          the locks whose beneficiary is the Reach
      [data-act=launch|coinAt|create|buy|sell|graduate|fail|refund|claim|launchCollect|contribute|
                redeem|lock|lockRelease|extend|give|approveFirstLaunch]
    Sentences the group proves (tools/verify-site/launch.mjs): "the raise
    shows the tax as a countdown", and the Launch sell's half of "every
    approval the slab builds is exact" (there is none to build).           */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("launch"), R = S.rights, ID = BigInt(S.id), tok = "#" + ID, ZERO = "0x" + "0".repeat(40);
    var LP = S.launchpad, KL = S.kiln, LK = S.locks, PL = S.pool, RE = S.reach;
    var el = ui.el, kv = ui.kv, note = ui.note, act = ui.act, read = ui.read, say = ui.say, fmt = ui.fmt, short = ui.short, propose = ui.propose, clock = ui.clock;
    var PARAMS = "(uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8)";
    var CREATE = "createChecked(" + PARAMS + ",bytes32)";
    /*  the rows this panel calls and nothing else (the shell's approveExactThen declares its own erc20
        approve/allowance), grouped by contract word; the key is "<word>.<name>" as INTACT.sel spells it,
        and ui.rows holds every signature to the selector the chain baked, or the lane does not open */
    var M = {};
    [["kiln", "launch(uint256,string,string,uint8,uint256,bytes32,uint256)", "coinAt(uint256,address,string,string,uint8,uint256,bytes32,uint256)", "recordsOf(uint256)"],
     ["launchpad", CREATE, "termsHash(" + PARAMS + ")", "approveFirstLaunch(uint256)", "buy(uint256,uint256,uint64,uint16)", "sell(uint256,uint256,uint256,uint64)",
      "graduate(uint256)", "fail(uint256)", "refund(uint256,address)", "claim(uint256,address)", "launchOf(uint256)", "launchesOf(uint256)", "quoteBuy(uint256,uint256)",
      "quoteSell(uint256,uint256)", "snipeTaxBps(uint256)", "creditOf(uint256,address)", "graduationTargetOf(uint256)", "boughtInWindow(uint256,address)",
      "lastLaunchAt(uint256)", "firstLaunchApproved(uint256)"],
     ["coin", "contribute()", "redeem(uint256)", "floorPerToken()"],
     ["pool", "collect(uint256)", "marketOf(uint256)"],
     ["locks", "lock(address,uint112,address,uint64,uint64,uint64,bool)", "release(uint256)", "extend(uint256,uint64)", "give(uint256,address)", "lockOf(uint256)",
      "releasable(uint256)", "lockCountOf(address)", "lockIdOf(address,uint256)"],
     ["erc20", "balanceOf(address)", "symbol()", "decimals()"],
     ["reach", "execute(address,uint256,bytes,uint8)"]].forEach(function (r) { r.slice(1).forEach(function (s) { M[r[0] + "." + s.split("(")[0]] = s; }); });
    ui.rows(M);

    /*── words: every amount at its full precision (the words in a slab are the words in the calldata),
         percentages from basis points in BigInt, dates in UTC ──*/
    var lower = function (s) { return String(s).toLowerCase(); };
    var isEth = function (a) { return lower(a) === ZERO; };
    var eth = function (v) { return fmt(v, 18, 18) + " ETH"; };
    var amt = function (v, c) { return c.d == null ? v + " units of " + c.s : fmt(v, c.d, c.d) + " " + c.s; };
    var pct = function (b) { return b / 100n + "." + String(b % 100n).padStart(2, "0") + " %"; };
    var date = function (t) { return new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC"; };
    /* a read with no answer prints why, never a zero; the clock's refusal is its own sentence */
    var unread = function (e) { var m = e && e.message || String(e); return /clock/.test(m) ? m : "not reported: " + m; };
    var STATE = ["none", "live", "graduated", "failed"], AGAIN = " — review again", DIES = ", or nothing moves; dies in fifteen minutes";
    var oops = function (e) { say(e && e.message || String(e), "err"); };
    /* every handler's refusals are thrown sentences, said once here — sync or async */
    var guard = function (f) { return function () { try { var r = f(); return r && r.catch ? r.catch(oops) : r; } catch (e) { oops(e); } }; };

    /*── what is typed survives a repaint for the same account (an approve that lands leaves the lock form
         as it was, so "press the same button again" can be followed); keyed by item — "b<L>" is raise L's
         buy, "e<k>" lock k's extension — and dropped when the account, the bits or the epoch move ──*/
    var typed = {}, gen = 0, pick = null, T = null, t0 = 0, ck, can, hold, seenBits, seenAcct;
    var fld = function (p, k, label, d) { var i = ui.field(p, label, d); i.value = k in typed ? typed[k] : d; i.name = k; i.addEventListener("input", function () { typed[k] = i.value; }); return i; };
    /* a typed amount through ui.parse, so a non-number is a sentence and never NaN; zero is refused too */
    var num = function (i, d, what) { var v; try { v = ui.parse(i.value, d); } catch (e) {} if (!v) throw Error(what + ": a number above zero"); return v; };
    /* whole numbers typed for bps, seconds and days: digits only, then BigInt — never Number() */
    var digits = function (i, max, what) { var s = i.value.trim(); if (!/^\d+$/.test(s) || BigInt(s) > max) throw Error(what + ": a whole number up to " + max); return BigInt(s); };
    var dec = function (c) { if (c.d == null) throw Error(c.s + "'s decimals did not answer; nothing is guessed"); return c.d; };
    var done = function (ks) { return function () { ks.forEach(function (k) { delete typed[k]; }); paint(); }; };
    /* one slab: anyone's by default (need 0), repainting after its receipt; o carries the rest */
    var send = function (to, key, args, lines, sentence, o) { return propose(Object.assign({ to: to, key: key, args: args, need: 0, lines: lines, sentence: sentence, then: done([]) }, o)); };
    /* a row whose value arrives later, found by its id */
    var slot = function (p, k, id) { var n = kv(p, k, "reading…").lastChild; n.id = id; return n; };
    /* a live read that did not answer, written where its answer would have been — for this paint only */
    var bad = function (g, n) { return function (e) { if (g === gen) n.textContent = unread(e); }; };
    /* the three-way rule: a satellite that did not report is a chip in one of two spellings, never a zero */
    var three = function (p, b, n) { if (S.reported & b) return 0; ui.chip(p, n + ": " + (S.absent & b ? "not deployed on this chain" : "could not be read at block " + S.block), S.absent & b ? "absent" : "unread"); return 1; };
    /* a coin's symbol and exponent; the exponent is custody — when decimals() does not answer it stays null */
    var meta = function (a) {
      return isEth(a) ? Promise.resolve({ s: "ETH", d: 18, a: a }) : Promise.all([
        read(a, "erc20.symbol", []).then(function (x) { return x.s(0).slice(0, 32); }, function () { return short(a); }),
        read(a, "erc20.decimals", []).then(function (x) { return Number(x.w(0)); }, function () { return null; })
      ]).then(function (m) { return { s: m[0], d: m[1], a: a }; });
    };
    /* a re-quote inside the press: a floor the curve no longer meets, or a curve that will not answer, closes the slab unsent */
    var floorHolds = function (key, L, v, min) { return function () { return read(LP, key, [L, v]).then(function (r) { return r.w(0) < min ? "the curve moved past the floor" + AGAIN : null; }, function () { return "the curve could not be re-quoted at the press" + AGAIN; }); }; };

    /*── the chain's clock: read once per paint, the anchor of every countdown; ui.now() only moves the
         seconds between reads. A deadline is never built from the anchor — every press reads clock()
         again, so the word in the calldata is the chain's at the press (CONSOLE §12) ──*/
    var cnow = function () { return T + BigInt(Math.floor((ui.now() - t0) / 1e3)); };
    var count = function (g, n, until, f, end) {
      (function tick() {
        if (g !== gen || !n.isConnected) return;
        var left = until - cnow();
        if (left <= 0n) return end();
        n.textContent = f(left);
        setTimeout(tick, 1e3);
      })();
    };

    /*═══════════ a coin: the Kiln, the spacing, the guardian's co-sign ═══════════*/
    function coin(p, g) {
      var b = el("div"); b.id = "launch-coin"; p.append(b);
      b.append(el("h3", "", "a coin"));
      note(b, "minted once, never again: the raise share to the Launchpad, the rest to " + tok + "'s Reach");
      var sp = slot(b, "launches", "launch-spacing");
      var last = read(LP, "launchpad.lastLaunchAt", [ID]).then(function (r) { return r.w(0); });
      Promise.all([last, ck]).then(function (v) {
        if (g !== gen) return;
        var at = v[0] + 604800n;
        if (!v[0]) sp.textContent = "none yet: the first is the holder's";
        else count(g, sp, at, function (l) { return "next launch in " + l + " s, at " + date(at); }, function () { sp.textContent = "a launch may be made now"; });
      }, bad(g, sp));
      var f = el("div"), bits = ui.rights() || 0; b.append(f);
      /*  the guardian's one act here: the Reach's first launch, co-signed once and stamped with the
          custody epoch, so a sale voids it (Launchpad.approveFirstLaunch) */
      if (can && bits & R.GUARDIAN && !(bits & R.HOLD)) {
        return Promise.all([last, read(LP, "launchpad.firstLaunchApproved", [ID])]).then(function (v) {
          if (g !== gen) return;
          if (v[0]) return note(f, "launched before: nothing to co-sign");
          if (v[1].b(0)) return note(f, "co-signed at this epoch: " + tok + "'s Reach may make the first launch");
          act(f, "approveFirstLaunch", "co-sign the Reach's first launch", R.GUARDIAN, function () {
            return send(LP, "launchpad.approveFirstLaunch", [ID], [["Token", tok], ["Lets", tok + "'s Reach make its first launch, once"]],
              "lets " + tok + "'s Reach make the token's first launch, once, at this custody epoch: a sale voids it", { need: R.GUARDIAN });
          });
        }, bad(g, f));
      }
      /* a connected wallet without HOLD hears why once, here, where a holder would launch */
      if (!hold) return can && ui.gate(f, R.HOLD);
      f.id = "launch-coin-form";
      var fN = fld(f, "n", "name, 1 to 32 printable ASCII characters", ""), fY = fld(f, "y", "symbol, 1 to 32 printable ASCII characters", ""),
          fD = fld(f, "d", "decimals, 0 to 36", "18"), fV = fld(f, "v", "supply, in coins (a number)", ""),
          fR = fld(f, "r", "of it, to a raise, in coins (0 for none)", "0"), fS = fld(f, "s", "salt, 0x and up to 64 hex digits", "0x0");
      /* the preview answers for what was typed at its press: an edit clears it, and an older answer cannot paint over a newer one */
      var pv = el("p", "v"), ps = 0; pv.id = "launch-coin-preview"; f.append(pv);
      f.addEventListener("input", function () { ps++; pv.textContent = ""; });
      /* DeskLaunch's form(): the Kiln's own label rule, checked before anything is asked of the chain */
      var form = function () {
        var n = fN.value, y = fY.value, ok = /^[ -~]{1,32}$/, s = fS.value.trim();
        if (!ok.test(n) || !ok.test(y)) throw Error("a name and a symbol: 1 to 32 printable ASCII characters");
        var d = Number(digits(fD, 36n, "decimals")), v = num(fV, d, "the supply"), r = ui.parse(fR.value || "0", d);
        if (r > v) throw Error("the raise share is more than the supply");
        if (!/^0x[0-9a-f]{1,64}$/i.test(s)) throw Error("the salt: 0x and up to 64 hex digits");
        return [ID, n, y, d, v, "0x" + s.slice(2).padStart(64, "0"), r];
      };
      /* where CREATE2 puts it: `by` is the wallet that will send launch, because the Kiln mixes the sender into the salt */
      var at = function (a) { return read(KL, "kiln.coinAt", [ID, ui.account()].concat(a.slice(1))).then(function (r) { return r.a(0); }); };
      act(f, "coinAt", "where would it land?", R.HOLD, guard(function () {
        var a = form(), s = ++ps;
        pv.textContent = "reading…";
        return at(a).then(function (x) { if (s === ps) pv.textContent = x, say("read from the Kiln; nothing sent", "ok"); }, function (e) { if (s === ps) pv.textContent = unread(e); });
      }));
      act(f, "launch", "review the launch", R.HOLD, guard(function () {
        var a = form(), c = { s: a[2], d: a[3] };
        return at(a).then(function (x) {
          return send(KL, "kiln.launch", a, [["Token", tok], ["Coin", a[1] + " (" + a[2] + "), " + a[3] + " decimals"], ["Supply", amt(a[4], c) + ", minted once"], ["To a raise", amt(a[6], c)],
                    ["To the Reach", amt(a[4] - a[6], c)], ["Salt", a[5]], ["Lands at", x], ["Next launch", "not for seven days"]],
            "launches " + a[2] + ": " + amt(a[4], c) + " minted once and never again, " + amt(a[6], c) + " of it to the Launchpad, the rest to " + tok + "'s Reach; no owner, no mint",
            { need: R.HOLD, then: done(["n", "y", "v", "r", "s"]) });
        }, function (e) { throw Error("where it lands did not answer; nothing is guessed: " + e.message); });
      }));
    }

    /*═══════════ the raises: the list, the selected one, the form that starts one ═══════════*/
    function raises(p, pos, g) {
      var b = el("div"); b.id = "launch-raises"; p.insertBefore(b, pos);
      b.append(el("h3", "", "raises"));
      read(LP, "launchpad.launchesOf", [ID]).then(function (r) {
        return Promise.all(r.arr(0).map(function (L) {
          return Promise.all([read(LP, "launchpad.launchOf", [L]), read(LP, "launchpad.graduationTargetOf", [L])]).then(function (x) {
            return meta(x[0].a(1)).then(function (c) { return { L: L, w: x[0].w, c: c, t: x[1].w(0) }; });
          });
        }));
      }).then(function (xs) {
        if (g !== gen) return;
        if (!xs.length) note(b, "none yet");
        var sel = xs.filter(function (x) { return x.L === pick; })[0] || xs[xs.length - 1];
        xs.forEach(function (x) {
          var r = ui.button(b, x.c.s + " · " + STATE[x.w(3)] + " · raised " + fmt(x.w(9), 18, 18) + " of " + fmt(x.t, 18, 18) + " ETH", true, function () { pick = x.L; paint(); });
          r.classList.add("raise"); r.classList.toggle("on", x === sel);
        });
        if (sel) detail(b, sel, g);
        if (hold) create(b, xs, g);
        positions(pos, xs, g);
      }, function (e) { if (g === gen) note(b, "the raises " + unread(e), "warn"); });
    }

    function detail(b, x, g) {
      var d = el("div"); d.id = "launch-raise"; b.append(d);
      var w = x.w, L = x.L, c = x.c, me = ui.account(), st = w(3), live = st === 1n, grad = w(9) >= x.t || w(8) >= w(6), R0 = "#" + L + " · " + c.s;
      kv(d, "raise", R0 + " " + short(c.a) + " · " + STATE[st] + " · closes " + date(w(12)));
      var tx = slot(d, "opening tax", "launch-tax");
      var cd = el("p", "s"); cd.id = "launch-tax-countdown"; d.append(cd);
      note(d, "fee and tax together never pass 99 %; the tax goes to the floor");
      var fl = slot(d, "floor", "launch-floor");
      var win = el("div"), box = el("div"), cb = el("div"), fd = el("div"); win.id = "launch-window"; d.append(win, box, cb, fd);
      read(c.a, "coin.floorPerToken", []).then(function (r) { if (g === gen) fl.dataset.raw = r.w(0), fl.textContent = eth(r.w(0)) + " per whole " + c.s; }, bad(g, fl));
      /*  the tax: the Launchpad's snipeTaxBps(L) as read, then the contract's own line — the start bps
          until the raise opens, falling linearly to nothing at fairWindowEnds — on the anchored clock.
          A clock that will not answer leaves the read standing and says so where the seconds would be */
      var end = w(11), off = function () { tx.textContent = "no tax"; cd.remove(); };
      read(LP, "launchpad.snipeTaxBps", [L]).then(function (r) {
        var bps = r.w(0), s0 = w(14), from = w(10);
        if (g !== gen) return;
        if (!bps) return off();
        tx.textContent = pct(bps);
        ck.then(function (now) {
          count(g, cd, end, function (l) { tx.textContent = pct(l === end - now ? bps : end - l <= from ? s0 : s0 * l / (end - from)); return "falls to nothing in " + l + " s"; }, off);
        }, bad(g, cd));
      }, function (e) { bad(g, tx)(e); cd.remove(); });
      ck.then(function (now) {
        if (g !== gen || !can || !live) return;
        /* the per-buyer cap counts what reaches the curve, after fee and tax; 2^128 − 1 is "no cap" */
        if (now < end && !(w(13) >> 127n)) read(LP, "launchpad.boughtInWindow", [L, me]).then(function (r) {
          if (g === gen) note(win, "you may still buy " + eth(w(13) - r.w(0)) + " in the window, counted after fee and tax");
        }, bad(g, win));
        if (now > w(12) && !grad) act(d, "fail", "close it as failed", 0, function () {
          return send(LP, "launchpad.fail", [L], [["Raise", R0], ["Opens", "refunds, pro rata to credit"], ["Returns", "the unsold supply to " + tok + "'s Reach"]],
            "fails raise #" + L + " for good: refunds open pro rata and the supply goes home to " + tok + "'s Reach");
        });
      }, function () {});
      if (!can) return;
      if (live && grad) act(d, "graduate", "graduate it", 0, function () {
        return send(LP, "launchpad.graduate", [L], [["Raise", R0], ["Opens", "a sealed market at the curve's last price"], ["Burns", "the base that price does not need"]],
          "graduates raise #" + L + " into a sealed market nobody can withdraw; the base its price does not need is burned");
      });
      if (live) buy(box, x, g);
      /* credits: claimed after graduation, refunded after a failure, sold back while live — never an approval */
      read(LP, "launchpad.creditOf", [L, me]).then(function (r) {
        var cr = r.w(0), a = amt(cr, c);
        if (g !== gen) return;
        kv(cb, "your credit", a);
        if (!cr) return;
        if (st === 2n) act(cb, "claim", "claim " + a, 0, function () {
          return send(LP, "launchpad.claim", [L, me], [["Raise", R0], ["Hands", a + " to " + short(me)]], "hands " + me + " the " + a + " its credits in raise #" + L + " name");
        });
        if (st === 3n) act(cb, "refund", "take the refund", 0, function () {
          return send(LP, "launchpad.refund", [L, me], [["Raise", R0 + ", failed"], ["Pays", short(me) + " its share of the pot, pro rata to " + a]], "pays " + me + " its share of failed raise #" + L + "'s pot, pro rata to " + a);
        });
        if (live) sell(cb, x, a, R0);
      }, bad(g, cb));
      floor(fd, x, me, g);
    }

    /*── the buy: quoted as it is typed and again at the press, the floor in words, fifteen minutes on the
         chain's clock; the fee cap is the clamp the contract applies, so the slab states the most it can take ──*/
    function buy(box, x, g) {
      var L = x.L, c = x.c, a = null, q = 0;
      var bi = fld(box, "b" + L, "pay, in ETH", ""); bi.id = "launch-buy-in";
      var rows = ["credit", "fee", "tax"].map(function (k) { return kv(box, k, "").lastChild; });
      rows[0].id = "launch-buy-out"; rows[1].id = "launch-buy-fee"; rows[2].id = "launch-buy-snipe";
      var go = act(box, "buy", "review the buy", 0, guard(function () {
        var v = a; if (!v) throw Error("an amount first");
        return Promise.all([read(LP, "launchpad.quoteBuy", [L, v]), read(LP, "launchpad.snipeTaxBps", [L]), clock()]).then(function (z) {
          var out = z[0].w(0), min = out - out * 50n / 10000n, cap = x.w(15) + z[1].w(0);
          if (cap > 9900n) cap = 9900n;
          if (!out) throw Error("the fee and the tax would take all of it");
          return send(LP, "launchpad.buy", [L, min, z[2] + 900n, cap],
            [["Raise", "#" + L + " · " + c.s], ["Pay", eth(v) + ", exactly"], ["Credit", "about " + amt(out, c) + ", no less than " + amt(min, c) + " — or nothing moves"],
             ["Fee cap", "maxFeeBps " + cap + ": fee and tax together at most " + pct(cap)], ["Holds", "credits, not tokens: claimed after graduation, refunded after a failure"], ["Dies", "in fifteen minutes"]],
            "pays exactly " + eth(v) + " into raise #" + L + " for no less than " + amt(min, c) + " of credit" + DIES,
            { value: v, spend: true, recheck: floorHolds("launchpad.quoteBuy", L, v, min), then: done(["b" + L]) });
        }, function (e) { if (/clock/.test(e.message)) go.disabled = true; throw e; });
      }), { spend: true });
      var quote = function () {
        var s = ++q, v; a = null; if (go) go.disabled = true;
        rows.forEach(function (n) { n.textContent = ""; delete n.dataset.raw; });
        if (!bi.value.trim()) return;
        try { v = ui.parse(bi.value, 18); } catch (e) { return rows[0].textContent = "not a number: an amount of ETH"; }
        read(LP, "launchpad.quoteBuy", [L, v]).then(function (r) {
          if (s !== q || g !== gen) return;
          rows.forEach(function (n, i) { n.dataset.raw = r.w(i); });
          rows[0].textContent = r.w(0) ? "about " + amt(r.w(0), c) : "nothing: the fee and the tax take it all";
          rows[1].textContent = eth(r.w(1)); rows[2].textContent = eth(r.w(2));
          if (r.w(0)) { a = v; if (go) go.disabled = false; }
        }, function (e) { if (s === q) bad(g, rows[0])(e); });
      };
      bi.addEventListener("input", quote); quote();
    }

    function sell(cb, x, cr, R0) {
      var L = x.L, c = x.c, si = fld(cb, "s" + L, "credit to sell back, in " + c.s, "");
      act(cb, "sell", "review the sale", 0, guard(function () {
        var v = num(si, dec(c), "the credit");
        return Promise.all([read(LP, "launchpad.quoteSell", [L, v]), clock()]).then(function (z) {
          var out = z[0].w(0), min = out - out * 50n / 10000n;
          if (!out) throw Error("nothing comes back for that");
          return send(LP, "launchpad.sell", [L, v, min, z[1] + 900n],
            [["Raise", R0], ["Sell back", amt(v, c) + " of " + cr + " credit"], ["Receive", "about " + eth(out) + ", no less than " + eth(min) + " — or nothing moves"],
             ["Approval", "none: credits, not tokens"], ["Dies", "in fifteen minutes"]],
            "sells " + amt(v, c) + " of credit back to raise #" + L + " for no less than " + eth(min) + DIES,
            { recheck: floorHolds("launchpad.quoteSell", L, v, min), then: done(["s" + L]) });
        });
      }));
    }

    /*── the floor: anyone may raise it; a holder of the coin may burn for its share, which only rises ──*/
    function floor(fd, x, me, g) {
      var L = x.L, c = x.c, ci = fld(fd, "c" + L, "add to " + c.s + "'s floor, in ETH", "");
      act(fd, "contribute", "review the contribution", 0, guard(function () {
        var v = num(ci, 18, "the contribution");
        return send(c.a, "coin.contribute", [], [["Coin", c.s], ["Adds", eth(v) + " to its floor, for every holder"], ["Back", "never: only burning " + c.s + " takes it out"]],
          "gives " + eth(v) + " to " + c.s + "'s floor for every holder; it does not come back", { value: v, spend: true, then: done(["c" + L]) });
      }), { spend: true });
      read(c.a, "erc20.balanceOf", [me]).then(function (r) {
        if (g !== gen || !r.w(0)) return;
        var ri = fld(fd, "x" + L, "burn for the floor, in " + c.s + " (you hold " + amt(r.w(0), c) + ")", "");
        act(fd, "redeem", "review the redemption", 0, guard(function () {
          var v = num(ri, dec(c), "the amount");
          /*  paid = pool·amount/supply and floorPerToken = pool·10^d/supply, both rounded down; the floor
              per token never falls (a redemption is neutral, a contribution raises it), so "at least" holds */
          return read(c.a, "coin.floorPerToken", []).then(function (f) {
            var back = v * f.w(0) / 10n ** BigInt(c.d);
            return send(c.a, "coin.redeem", [v], [["Burns", amt(v, c)], ["Receives", "at least " + eth(back) + ": the floor's share"]],
              "burns " + amt(v, c) + " for at least " + eth(back) + " from its floor; burned coins are gone", { spend: true, then: done(["x" + L]) });
          });
        }), { spend: true });
      });
    }

    /*── a raise: createChecked pins the terms by their hash, read in the same press; the tuple is laid by
         hand (data() builds no tuples) and every argument is a line, since the slab draws no [data-arg] ──*/
    function create(b, xs, g) {
      var f = el("div"); f.id = "launch-create"; b.append(f);
      f.append(el("h3", "", "start a raise"));
      read(KL, "kiln.recordsOf", [ID]).then(function (r) {
        var used = xs.map(function (x) { return lower(x.c.a); });
        var k = r.arr(0, "(address,uint64,uint256,uint256)").filter(function (k) { return k[3] && used.indexOf(lower(k[0])) < 0; }).pop();
        if (!k) return g === gen && note(f, "no coin awaits a raise: launch one with a share to it");
        return meta(k[0]).then(function (c) {
          if (g !== gen) return;
          kv(f, "coin", c.s + " " + short(k[0]) + " · " + amt(k[3], c) + " for the raise");
          var F = [["curve", "sold on the curve, in " + c.s, ""], ["vq", "opening reserve, in ETH (the first price)", "1"], ["tgt", "graduates at, in ETH raised", ""],
                   ["win", "fair window, seconds (≤ 86400)", "3600"], ["cap", "cap per buyer in the window, in ETH (empty: none)", ""],
                   ["tax", "opening tax, bps (≤ 9900)", "0"], ["fee", "fee, bps (≤ 100)", "100"], ["cr", "creator's share of the fee, bps (≤ 1500)", "0"],
                   ["vest", "vested to the Reach, bps of the share (≤ 1500)", "0"], ["days", "closes in, days (1 to 30)", "7"]].map(function (y) {
            var i = fld(f, y[0] + k[0], y[1], y[2]); i.name = y[0]; return i;
          });
          act(f, "create", "review the raise", R.HOLD, guard(function () {
            var cur = num(F[0], dec(c), "the curve supply"), vq = num(F[1], 18, "the opening reserve"), tgt = num(F[2], 18, "the target"), win = digits(F[3], 86400n, "the fair window"),
                capped = F[4].value.trim(), cap = capped ? num(F[4], 18, "the cap") : (1n << 128n) - 1n, tax = digits(F[5], 9900n, "the tax"), fee = digits(F[6], 100n, "the fee"),
                cr = digits(F[7], 1500n, "the creator's share"), vest = digits(F[8], 1500n, "the vest"), dy = digits(F[9], 30n, "the days");
            if (!dy) throw Error("the days: at least one");
            return clock().then(function (now) {
              var dl = now + dy * 86400n, P = lower([ID, k[0], cur, vq, tgt, 0n, win, cap, tax, fee, cr, vest, dl, 0n].map(ui.enc.W).join(""));
              return ui.simulate(LP, S.sel["launchpad.termsHash"] + P, {}).then(function (h) {
                if (!h.ok) throw Error("the terms could not be hashed: " + h.sentence);
                var H = h.data.slice(0, 66);
                return propose({ to: LP, data: S.sel["launchpad.createChecked"] + P + H.slice(2), sig: CREATE, need: R.HOLD,
                  lines: [["Token", tok], ["Coin", c.s + " " + ui.checksum(k[0])], ["On the curve", amt(cur, c)], ["Opening reserve", eth(vq)], ["Graduates at", eth(tgt) + " raised"],
                          ["Opens", "at once"], ["Fair window", win + " s"], ["Cap per buyer", capped ? eth(cap) + " in the window" : "none"],
                          ["Opening tax", pct(tax) + ", falling to nothing over the window"], ["Fee", pct(fee)], ["Creator's share", pct(cr) + " of the fee, to " + tok + "'s fee sink at graduation"],
                          ["Vested", pct(vest) + " of the share to " + tok + "'s Reach: 30-day cliff, over 365 days"], ["Closes", date(dl) + "; then, short of the target, anyone may fail it"],
                          ["Graduates into", "this collection's Pool"], ["Terms hash", H]],
                  sentence: "opens a raise for " + c.s + " on " + tok + "'s curve under the terms hashed " + H.slice(0, 10) + "…; nobody can change them or withdraw the raise",
                  then: done([]) });
              });
            });
          }));
        });
      }).catch(function (e) { if (g === gen) note(f, "the coins " + unread(e), "warn"); });
    }

    /*═══════════ the sealed markets graduated raises opened, and what they owe ═══════════*/
    function positions(p, xs, g) {
      if (three(p, S.bits.pool, "pool")) return;
      xs = xs.filter(function (x) { return x.w(3) === 2n; });
      if (!xs.length) note(p, "none yet");
      xs.forEach(function (x) {
        var key = x.w(19), ks = String(key).slice(0, 10) + "…", row = el("div", "sealed"); row.dataset.key = key; p.append(row);
        var v = kv(row, x.c.s + " · market " + ks, "reading…").lastChild;
        read(PL, "pool.marketOf", [key]).then(function (m) {
          if (g !== gen) return;
          v.textContent = "owes " + amt(m.w(13), x.c) + " · " + eth(m.w(14)) + " to " + tok + "'s fee sink";
          if (can) act(row, "launchCollect", "collect it", 0, function () {
            return send(PL, "pool.collect", [key], [["Sealed market", String(key)], ["Pays", "what it owes, to " + tok + "'s fee sink and nobody else"]],
              "collects the fees sealed market " + ks + " owes to " + tok + "'s fee sink");
          });
        }, bad(g, v));
      });
    }

    /*═══════════ the locks whose beneficiary is the Reach: a sale sells them ═══════════*/
    function locks(p, g) {
      var b = el("div"); b.id = "launch-locks"; p.append(b);
      b.append(el("h3", "", "locks"));
      if (three(b, S.bits.locks, "locks")) return;
      note(b, "what is locked for " + tok + "'s Reach goes with the token; no function ends a lock early");
      var list = el("div"); b.append(list);
      read(LK, "locks.lockCountOf", [RE]).then(function (r) {
        var ids = [];
        for (var i = 0n; i < r.w(0); i++) ids.push(read(LK, "locks.lockIdOf", [RE, i]).then(function (x) { return x.w(0); }));
        return Promise.all(ids);
      }).then(function (ids) {
        /* lockIdOf is a finding aid: after a give the old index keeps its entry, so the lock itself is asked */
        return Promise.all(ids.map(function (k) {
          return Promise.all([read(LK, "locks.lockOf", [k]), read(LK, "locks.releasable", [k])]).then(function (v) {
            return lower(v[0].a(1)) !== lower(RE) ? null : meta(v[0].a(2)).then(function (c) { return { k: k, w: v[0].w, c: c, rel: v[1].w(0) }; });
          });
        }));
      }).then(function (ls) {
        if (g !== gen) return;
        ls = ls.filter(Boolean);
        if (!ls.length) note(list, "none yet");
        ls.forEach(function (x) { lock(list, x); });
      }, bad(g, list));
      if (can) lockForm(b);
    }

    function lock(list, x) {
      var w = x.w, c = x.c, k = x.k, row = el("div", "lock"), K = "lock #" + k; list.append(row);
      kv(row, K, amt(w(3), c) + " · " + (w(8) ? "vests until " : "unlocks at ") + date(w(7)) + " · released " + amt(w(4), c) + " · releasable now " + amt(x.rel, c));
      if (can && x.rel) act(row, "lockRelease", "release " + amt(x.rel, c) + " to the Reach", 0, function () {
        return send(LK, "locks.release", [k], [["Lock", "#" + k], ["Pays", "what has vested, " + amt(x.rel, c) + " or more, to " + tok + "'s Reach and nobody else"]],
          "releases what " + K + " has vested to " + tok + "'s Reach");
      });
      /* the beneficiary is the Reach, so the holder moves it through reach.execute — inputs only beside a control that can be pressed */
      if (!hold) return;
      var xi = fld(row, "e" + k, "lengthen to, days from now (up to 3650)", ""), gi = fld(row, "g" + k, "or give it to another token's Reach, an address", "");
      var exec = function (inner, lines, sentence, key) { return send(RE, "reach.execute", [LK, 0n, inner, 0n], lines, sentence, { need: R.HOLD, spend: true, then: done([key]) }); };
      act(row, "extend", "review the extension", R.HOLD, guard(function () {
        var dd = digits(xi, 3650n, "the days"); if (!dd) throw Error("the days: at least one");
        return clock().then(function (now) {
          var end = now + dd * 86400n;
          return exec(ui.data("locks.extend", [k, end]), [["Lock", "#" + k], ["Ends", date(w(7)) + " → " + date(end)], ["Through", tok + "'s Reach, its beneficiary"], ["Reversible", "no: a lock only ever lengthens"]],
            "lengthens " + K + " to " + date(end) + " through " + tok + "'s Reach; it only ever lengthens", "e" + k);
        });
      }), { spend: true });
      act(row, "give", "review the gift", R.HOLD, guard(function () {
        var to = gi.value.trim(); if (!ui.isAddr(to)) throw Error("another token's Reach: an address");
        return exec(ui.data("locks.give", [k, to]), [["Lock", "#" + k], ["From", tok + "'s Reach"], ["To", ui.checksum(to)], ["Only", "a token's Reach takes it, and it goes with that token"]],
          "gives " + K + " from " + tok + "'s Reach to " + ui.checksum(to) + "; the dates do not move, and it does not come back", "g" + k);
      }), { spend: true });
    }

    /*── a new lock for the Reach: ETH as value, exactly; an ERC-20 through the exact approval step ──*/
    function lockForm(b) {
      var f = el("div"); b.append(f);
      var fa = fld(f, "la", "lock what: a coin's address, or 0x0 for ETH", "0x0"), fv = fld(f, "lv", "how much, in that coin (a number)", ""), fd = fld(f, "ld", "until, days from now (1 to 3650)", "365");
      var lin = ui.button(f, "", true, function () { typed.lin = !typed.lin; show(); });
      var show = function () { lin.textContent = typed.lin ? "vests evenly until then" : "all of it at the end"; };
      show();
      act(f, "lock", "review the lock", 0, guard(function () {
        var a = fa.value.trim(), dd = digits(fd, 3650n, "the days"); if (/^(0x0*)?$/i.test(a)) a = ZERO;
        if (!ui.isAddr(a)) throw Error("a coin's address, or 0x0 for ETH");
        if (!dd) throw Error("the days: at least one");
        return meta(a).then(function (c) {
          var v = num(fv, dec(c), "the amount");
          return clock().then(function (now) {
            var end = now + dd * 86400n, ln = !!typed.lin;
            return ui.approveExactThen(isEth(a) ? [] : [{ token: a, spender: LK, amount: v, symbol: c.s, decimals: c.d }], function () {
              return send(LK, "locks.lock", [a, v, RE, 0n, ln ? 0n : end, end, ln],
                [["Locks", amt(v, c)], ["For", tok + "'s Reach: the claim goes with the token"], ["Releases", (ln ? "evenly from now until " : "all of it at ") + date(end)], ["Early", "never: no function ends a lock early"]],
                "locks " + amt(v, c) + " for " + tok + "'s Reach until " + date(end) + "; nothing ends it early, and it goes with the token", { value: isEth(a) ? v : 0n, spend: true, then: done(["lv"]) });
            });
          });
        });
      }), { spend: true });
    }

    /*═══════════ paint ═══════════*/
    function paint() {
      var g = ++gen; host.replaceChildren();
      /* the collection page has no token to launch from, no Reach to lock for */
      if (!ID) return note(host, "a coin is launched by a token: open one to see its raises and locks"), S.loaded.launch = true;
      seenBits = ui.rights(); seenAcct = ui.account();
      ck = clock().then(function (t) { if (g === gen) { T = t; t0 = ui.now(); } return t; });
      ck.catch(function () {});
      /*  one sentence when nobody here can press anything — not connected, the viewer, a session, the wrong
          chain, or rights that could not be read — and none per control. Unread rights are not a stranger's:
          even the anyone-controls wait for a rights read that answered (boot's "rights that could not be read
          are not zero" holds with every panel loaded), so the gate is asked for HOLD then, for its sentence */
      can = ui.gate(host, ui.rights() === null ? R.HOLD : 0); hold = !!(can && ui.rights() & R.HOLD);
      if (!three(host, S.bits.launchpad, "launchpad")) {
        coin(host, g);
        var pos = el("div"); pos.id = "launch-positions"; host.append(pos);
        pos.append(el("h3", "", "sealed markets"));
        note(pos, "Uniswap v4 launches, their positions and the LP custodian are not built here yet");
        raises(host, pos, g);
      }
      locks(host, g);
      S.loaded.launch = true;
    }
    paint();
    /*  intact:rights fires after every receipt. The same bits for the same account is not a reason to wipe
        what is typed: the receipt's own then() repaints and clears only what it consumed, and an approve
        that lands (it has no then) leaves the form as it was. Different bits, another account or a new
        epoch drop what was typed and repaint. */
    window.addEventListener("intact:rights", function (e) {
      var d = e.detail || {};
      if (d.bits !== seenBits || d.account !== seenAcct) { typed = {}; paint(); }
    });
    window.addEventListener("intact:epoch", function () { typed = {}; paint(); });
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "launch") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
