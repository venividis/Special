/*  INTACT panel "swap" — the token's own market, and the Reach's door to a
    venue. Injected as a Blob script after the shell keccak'd these bytes
    against window.INTACT.panels.swap. One IIFE, nothing at top level
    (terser mangles the shell's top level to one-letter names; a top-level
    const here would collide and the panel would never run — E §3.4; the
    build refuses one). Every text node through textContent. Every write
    through INTACT.ui.propose; every approval through INTACT.ui.approveExactThen,
    exact, as the button's current step.

    Origin: IPSEITY engine/console-lanes.js LANE[3] "TRADE THROUGH IT"
    (branch claude/claude-md-docs-8vvyc8, lines 405–706), ported onto the
    panel contract (docs/CONSOLE.md §5): the donor's provider() became the
    shell's ui.read/simulate/propose; its propose(title, lines, tx) became
    ui.propose with a sentence, lines and a recheck; its stepThenPropose —
    the exact approval as the button's current step, "Never · unlimited" —
    became ui.approveExactThen; mine()/onlyHolder() became ui.act/ui.gate
    on the rights bits; window.CON became window.INTACT (B §1.7). What the
    donor did not have and this lane does: swapExactOut with the residue
    offered back to zero (D19), the sniper fee as a fact with a countdown
    (set in the open form and nowhere else), the curve synced against the
    holder's trait with the anchored value as `expected`, the seal ratchet
    sentence, write-down, the owned directory from pool.openIds (so the
    viewer has it too), and the Elsewhere tab: router.quoteExactIn by
    revert beside the owned quote, router.venues() in hooklist shape, and
    the swap itself through reach.executeTyped with a spend cap and a
    receive floor, hidden for a native or manifest input under a Reach seal
    (D §4.4). Not built here (CONSOLE §14), and the lane says so where a
    holder would look — under the directory wherever the lane renders a
    market, and in the Elsewhere note: Market listings, trade history, v3
    paths and v4 keys from this page. Both swaps ask their venue once more inside the press
    (the slab's `recheck`): a floor the quote no longer meets, or a quote
    that will not answer, is a sentence before the wallet opens, never a
    Slippage revert after the signature. A receipt that leaves the rights
    as they were keeps what is typed and re-quotes, so after the approve
    step lands the same button is the swap; different bits or another
    account repaint the lane (the review's finding: a wholesale repaint on
    every receipt wiped the amount the slab had just said to press again).

    Elements this panel introduces (CONSOLE §6.2; the suite reads them
    scoped to #lane-swap):
      #swap-card          the swap card itself
      #swap-in            the amount input (exact-in: what you pay; exact-out: what you receive)
      #swap-out           the quote, dataset.raw = the quote in base units; or a sentence
      #swap-go            the button; its label is the current step (Approve … / Swap)
      #swap-flip          turns the pair round
      #swap-exact         toggles exact-in / exact-out
      #swap-sym-in, #swap-sym-out   the two symbols, textContent only
      #swap-details       rate, floor (or ceiling), fee; the owned quote row
      #swap-quote-owned .quote, #swap-quote-elsewhere .quote (dataset.raw)
      #swap-facts         the market's live facts (pair, reserves, fee, curve, seal, the sniper countdown)
      #swap-your-market   the holder's half; #swap-open-form (its inputs carry name=feeBps|curveBps|sniperBps|sniperSeconds)
      #swap-sniper        the sniper fee as a countdown while it runs; absent after
      #swap-directory .market (open ids) and .sealed (sealed markets this token collects from)
      #swap-elsewhere     the Elsewhere section; #swap-venues .venue
      [data-tab=owned|elsewhere]
      [data-act=swap|openMarket|deposit|withdraw|setFee|syncCurve|sealMarket|closeMarket|writeDown|collect|approveZero|swapElsewhere]
    Sentences the group proves (tools/verify-site/swap.mjs): "an absent
    Router hides the tab and sets the chip to not reported", "every approval
    the slab builds is exact", "a non-holder sees the custom error before
    the wallet opens", "the swap slab states the floor in words".            */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("swap"), R = S.rights, ID = S.id, ZERO = "0x" + "0".repeat(40);
    var REQ = "(uint8,address,address,uint256,uint256,uint64,uint256,bytes,(address,address,uint24,int24,address),uint160)";
    var TYPED = "executeTyped((address,uint256,bytes,(address,uint256)[],(address,uint256)[],uint64))";
    ui.rows({
      "pool.openMarket": "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)",
      "pool.deposit": "deposit(uint256,uint256,uint256)", "pool.withdraw": "withdraw(uint256,uint256,uint256,address)",
      "pool.closeMarket": "closeMarket(uint256)", "pool.setFee": "setFee(uint256,uint16)",
      "pool.syncCurve": "syncCurve(uint256,uint24,uint24)", "pool.sealMarket": "sealMarket(uint256,uint64)",
      "pool.writeDown": "writeDown(uint256)", "pool.collect": "collect(uint256)",
      "pool.swapExactIn": "swapExactIn(uint256,bool,uint256,uint256,address,uint64)",
      "pool.swapExactOut": "swapExactOut(uint256,bool,uint256,uint256,address,uint64)",
      "pool.quote": "quote(uint256,bool,uint256)", "pool.quoteExactOut": "quoteExactOut(uint256,bool,uint256)",
      "pool.marketOf": "marketOf(uint256)",
      "pool.openIds": "openIds(uint256,uint256)", "pool.sealedIds": "sealedIds(uint256,uint256)",
      "erc20.approve": "approve(address,uint256)", "erc20.allowance": "allowance(address,address)",
      "erc20.symbol": "symbol()", "erc20.decimals": "decimals()",
      "router.quoteExactIn": "quoteExactIn(" + REQ + ")", "router.swap": "swap(" + REQ + ")", "router.venues": "venues()",
      "reach.executeTyped": TYPED, "reach.manifest": "manifest()", "reach.sealedUntil": "sealedUntil()",
      "hub.getTraitValue": "getTraitValue(uint256,bytes32)"
    });

    /*── the market, as the chain last said it: the baked block for the first paint,
         pool.marketOf after that; every amount a BigInt, never a Number ──*/
    var B = S.ownedMarket, M = B && {
      open: B.open, base: B.base, quote: B.quote, bs: B.baseSymbol, qs: B.quoteSymbol,
      bd: B.baseDecimals, qd: B.quoteDecimals, rB: BigInt(B.rBase), rQ: BigInt(B.rQuote),
      fee: B.feeBps, curve: B.curveBps, snBps: B.sniperBps, snUntil: B.sniperUntil, seal: B.sealUntil
    };
    /*  the clock (CONSOLE §12): INTACT.time anchors the first paint, Date.now() only
        animates between reads, and a receipt re-anchors from the chain's own clock */
    var T0 = ui.now(), base = S.time;
    var chainNow = function () { return base + Math.floor((ui.now() - T0) / 1e3); };
    var date = function (t) { return new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC"; };
    /*  the full precision, always: a quote printed to six places and a floor in the
        calldata to eighteen would be two numbers, and the slab promises one */
    var amt = function (v, d) { return d == null ? String(v) + " units" : ui.fmt(v, d, d); };
    var coin = function (isBase) { return isBase ? { addr: M.base, sym: M.bs, dec: M.bd } : { addr: M.quote, sym: M.qs, dec: M.qd }; };
    var isEth = function (a) { return String(a).toLowerCase() === ZERO; };
    var same = function (a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); };
    /* whole numbers typed for bps and seconds: digits only, then BigInt — never Number() */
    var digits = function (s, max, what) {
      s = String(s).trim();
      if (!/^\d+$/.test(s)) { ui.say(what + ": a whole number", "err"); return null; }
      var n = BigInt(s); if (n > max) { ui.say(what + " is capped at " + max, "err"); return null; }
      return n;
    };
    var utf8 = function (hex) { return new TextDecoder().decode(new Uint8Array((hex.match(/../g) || []).map(function (x) { return parseInt(x, 16); }))); };
    var unread = function (e) { return "not reported: " + (e && e.message || e); };
    /* a coin's symbol and exponent: the symbol capped at 32 characters as the Catalog caps the baked one (Web.MAX_LABEL);
       the exponent is custody — when decimals() does not answer it stays null and every amount for that coin refuses */
    var sym = function (a) { return isEth(a) ? Promise.resolve(["ETH", 18]) : Promise.all([
      ui.read(a, "erc20.symbol", []).then(function (x) { return x.s(0).slice(0, 32); }, function () { return ui.short(a); }),
      ui.read(a, "erc20.decimals", []).then(function (x) { return Number(x.w(0)); }, function () { return null; })]); };

    /*── one SwapRequest, laid by hand: data() builds no tuples (CONSOLE §5) ──*/
    var swapReq = function (venue, tin, tout, a, minOut, dl) {
      var E = ui.enc;
      return E.W(32) + E.W(venue) + E.A(tin) + E.A(tout) + E.W(a) + E.W(minOut) + E.W(dl) + E.W(ID) + E.W(448) +
        E.A(ZERO) + E.A(ZERO) + E.W(0) + E.W(0) + E.A(ZERO) + E.W(0) + E.bytes("0x");
    };
    /*── one TypedCall around it (D §4.2 C): the Reach approves exactly, calls, zeroes,
         then measures what left and what arrived ──*/
    var typedCall = function (to, value, data, spend, recv, dl) {
      var E = ui.enc, body = E.bytes(data), n = body.length / 2;
      var offS = 192 + n, offR = offS + 32 + 64 * spend.length;
      var list = function (xs) { return E.W(xs.length) + xs.map(function (x) { return E.A(x[0]) + E.W(x[1]); }).join(""); };
      return S.sel["reach.executeTyped"] + E.W(32) + E.A(to) + E.W(value) + E.W(192) + E.W(offS) + E.W(offR) + E.W(dl) + body + list(spend) + list(recv);
    };

    /*── state the lane keeps between paints ──*/
    var baseIn = true, exactOut = false, tab = "owned", pending = null, qseq = 0, snT = 0, card = null, requote = null, seenBits, seenAcct;
    var reachSeal = S.clocks && S.clocks.sealedUntil || 0, manifest = [], manifestKnown = false;

    /*── the market re-read from the chain; a changed word repaints ──*/
    function syncMarket() {
      return ui.read(S.pool, "pool.marketOf", [ID]).then(function (r) {
        var n = { open: r.b(7), base: r.a(0), quote: r.a(1), rB: r.w(2), rQ: r.w(3), fee: Number(r.w(4)), curve: Number(r.w(10)),
                  snBps: Number(r.w(5)), snUntil: Number(r.w(6)), seal: Number(r.w(9)) };
        var pairSame = M && same(n.base, M.base) && same(n.quote, M.quote);
        var changed = !M || !pairSame || ["open", "rB", "rQ", "fee", "curve", "snBps", "snUntil", "seal"].some(function (k) { return String(n[k]) !== String(M[k]); });
        if (!changed) return false;
        return (pairSame ? Promise.resolve([[M.bs, M.bd], [M.qs, M.qd]]) : Promise.all([sym(n.base), sym(n.quote)])).then(function (s) {
          n.bs = s[0][0]; n.bd = s[0][1]; n.qs = s[1][0]; n.qd = s[1][1]; M = n; return true;
        });
      });
    }
    function syncClock() { return ui.clock().then(function (t) { base = Number(t); T0 = ui.now(); }, function () {}); }
    /* after a receipt that changed the market: the clock re-anchored, the market re-read, the lane repainted */
    var after = function () { return syncClock().then(syncMarket).then(function () { paint(); }); };

    /*═══════════ the swap card: anyone with a wallet; quoted at review time, every time ═══════════*/
    function swapCard(p) {
      var c = ui.el("div"); c.id = "swap-card"; card = c;
      p.append(ui.el("h3", "", "swap"), c);
      ui.note(c, "no permission from the holder is needed; the fee is theirs. Quoted first; nothing settles below what the slab states.");
      var row = ui.el("div", "kv");
      var sIn = ui.el("span", "k"); sIn.id = "swap-sym-in";
      var flip = ui.el("button", "chip", "flip"); flip.type = "button"; flip.id = "swap-flip";
      var sOut = ui.el("span", "k"); sOut.id = "swap-sym-out";
      row.append(sIn, flip, sOut); c.append(row);
      var mode = ui.el("button", "chip", ""); mode.type = "button"; mode.id = "swap-exact"; c.append(mode);
      var inp = ui.field(c, "amount", "0.0"); inp.id = "swap-in";
      var out = ui.el("p", "v"); out.id = "swap-out"; c.append(out);
      var det = ui.el("div"); det.id = "swap-details"; c.append(det);
      var go = ui.act(c, "swap", "Swap", 0, press, { spend: true });
      if (go) { go.id = "swap-go"; go.disabled = true; }
      var paintDir = function () {
        var IN = coin(baseIn), OUT = coin(!baseIn);
        sIn.textContent = IN.sym; sOut.textContent = OUT.sym;
        mode.textContent = exactOut ? "exact out: you name what arrives" : "exact in: you name what you pay";
        mode.classList.toggle("on", exactOut);
      };
      flip.addEventListener("click", function () { baseIn = !baseIn; paintDir(); quoteNow(); paintElsewhereAct(); });
      mode.addEventListener("click", function () { exactOut = !exactOut; paintDir(); quoteNow(); });
      inp.addEventListener("input", quoteNow);
      paintDir(); requote = quoteNow;

      function quoteNow() {
        var IN = coin(baseIn), OUT = coin(!baseIn), typedCoin = exactOut ? OUT : IN, quotedCoin = exactOut ? IN : OUT;
        pending = null; qseq++;
        out.textContent = ""; delete out.dataset.raw; det.replaceChildren();
        if (go) { go.disabled = true; go.textContent = "Swap"; }
        var raw = inp.value;
        if (!String(raw).trim()) return;
        if (typedCoin.dec == null || quotedCoin.dec == null) return ui.note(det, "the decimals of " + (typedCoin.dec == null ? typedCoin.sym : quotedCoin.sym) + " did not answer; the point is not guessed", "warn");
        var a;
        try { a = ui.parse(raw, typedCoin.dec); } catch (e) { return ui.note(det, "not a number: an amount of " + typedCoin.sym, "warn"); }
        if (a === 0n) return ui.note(det, "an amount of " + typedCoin.sym, "warn");
        var seq = qseq;
        ui.read(S.pool, exactOut ? "pool.quoteExactOut" : "pool.quote", [ID, baseIn, a]).then(function (r) {
          if (seq !== qseq) return;
          var q = r.w(0), slip = q * 50n / 10000n;
          pending = exactOut ? { a: a, q: q, lim: q + slip } : { a: a, q: q, lim: q - slip };
          out.dataset.raw = String(q); out.textContent = amt(q, quotedCoin.dec) + " " + quotedCoin.sym;
          /* the rate from the two amounts themselves, in BigInt: out per one in */
          var inAmt = exactOut ? q : a, outAmt = exactOut ? a : q;
          ui.kv(det, "rate", "1 " + IN.sym + " ≈ " + amt(outAmt * (10n ** BigInt(IN.dec)) / inAmt, OUT.dec) + " " + OUT.sym);
          var owned = ui.kv(det, "its own market", amt(q, quotedCoin.dec) + " " + quotedCoin.sym);
          owned.id = "swap-quote-owned"; owned.classList.add("quote"); owned.lastChild.dataset.raw = String(q);
          ui.kv(det, exactOut ? "pay at most" : "no less than", amt(pending.lim, quotedCoin.dec) + " " + quotedCoin.sym + (exactOut ? " — or nothing moves" : " — or nothing moves"));
          ui.kv(det, "fee", M.fee + " bps to whoever holds #" + ID + (M.snBps && M.snUntil > chainNow() ? ", plus the sniper fee while it runs" : ""));
          var payCoin = IN, pay = exactOut ? pending.lim : a;
          if (go) {
            go.disabled = false;
            if (isEth(payCoin.addr)) go.textContent = "Swap";
            else ui.read(payCoin.addr, "erc20.allowance", [ui.account(), S.pool]).then(function (al) {
              if (seq === qseq && al.w(0) < pay) go.textContent = "Approve " + amt(pay, payCoin.dec) + " " + payCoin.sym + " — the current step";
            }, function () {});
          }
          quoteElsewhere(a, seq);
        }, function (e) {
          if (seq !== qseq) return;
          var m = String(e && e.message || "");
          out.textContent = /TradeTooLarge/.test(m) ? "more than half of the reserve — the market will not promise what it cannot pay"
            : /ZeroAmount/.test(m) ? "prices at zero — nothing to swap" : /MarketNotOpen/.test(m) ? "the market is not open" : unread(e);
        });
      }

      /*  Press once: the exact approval is the current step (the shell's slab, "Never ·
          unlimited"); press the same button again: the swap, quoted again at this press,
          the floor in words, fifteen minutes on the chain's clock. */
      function press() {
        var IN = coin(baseIn), OUT = coin(!baseIn), P = pending;
        if (!P) return ui.say("an amount first", "err");
        var pay = exactOut ? P.lim : P.a, payCoin = IN;
        var steps = isEth(payCoin.addr) ? [] : [{ token: payCoin.addr, spender: S.pool, amount: pay, symbol: payCoin.sym, decimals: payCoin.dec }];
        ui.approveExactThen(steps, function () {
          return ui.read(S.pool, exactOut ? "pool.quoteExactOut" : "pool.quote", [ID, baseIn, P.a]).then(function (r) {
            var q = r.w(0), slip = q * 50n / 10000n, lim = exactOut ? q + slip : q - slip, to = ui.account();
            if (exactOut && lim > pay) return ui.say("the price moved: it now asks " + amt(q, IN.dec) + " " + IN.sym + " — review again", "err"), quoteNow();
            return ui.clock().then(function (now) {
              var dl = now + 900n, value = isEth(payCoin.addr) ? (exactOut ? lim : P.a) : 0n;
              var lines = exactOut
                ? [["Token", "#" + ID], ["Receive exactly", amt(P.a, OUT.dec) + " " + OUT.sym], ["Costs about", amt(q, IN.dec) + " " + IN.sym],
                   ["Pay at most", amt(lim, IN.dec) + " " + IN.sym + " — or nothing moves"], ["To", ui.short(to)], ["Dies", "in fifteen minutes"]]
                : [["Token", "#" + ID], ["In", amt(P.a, IN.dec) + " " + IN.sym], ["Out", "about " + amt(q, OUT.dec) + " " + OUT.sym],
                   ["No less than", amt(lim, OUT.dec) + " " + OUT.sym + " — or nothing moves"], ["To", ui.short(to)], ["Dies", "in fifteen minutes"]];
              return ui.propose({
                to: S.pool, key: exactOut ? "pool.swapExactOut" : "pool.swapExactIn", args: [ID, baseIn, P.a, lim, to, dl], value: value, need: 0, spend: true, lines: lines,
                /* at the press the market is asked once more: a floor the curve no longer meets is a sentence here, not a Slippage revert after the signature */
                recheck: function () { return ui.read(S.pool, exactOut ? "pool.quoteExactOut" : "pool.quote", [ID, baseIn, P.a]).then(function (r) { return (exactOut ? r.w(0) > lim : r.w(0) < lim) ? "the price moved past the floor — review again" : null; }, function () { return "the market could not be re-quoted at the press — review again"; }); },
                sentence: exactOut
                  ? "buys exactly " + amt(P.a, OUT.dec) + " " + OUT.sym + " through #" + ID + "'s market for at most " + amt(lim, IN.dec) + " " + IN.sym + ", or nothing moves; dies in fifteen minutes"
                  : "swaps exactly " + amt(P.a, IN.dec) + " " + IN.sym + " through #" + ID + "'s market for no less than " + amt(lim, OUT.dec) + " " + OUT.sym + ", or nothing moves; dies in fifteen minutes",
                then: function () {
                  var wasExactOut = exactOut, spent = payCoin;
                  return syncClock().then(syncMarket).then(function (changed) {
                    if (changed) paint();
                    /* D19: an exact-out pull is inUsed ≤ maxIn; what is left approved is offered back to zero */
                    if (!wasExactOut || isEth(spent.addr) || !card) return;
                    return ui.read(spent.addr, "erc20.allowance", [to, S.pool]).then(function (al) {
                      var left = al.w(0); if (!left) return;
                      var box = ui.el("div");
                      ui.note(box, "the market pulled less than approved: " + amt(left, spent.dec) + " " + spent.sym + " stays approved", "warn");
                      ui.act(box, "approveZero", "revoke the " + amt(left, spent.dec) + " " + spent.sym + " left approved", 0, function () {
                        return ui.propose({ to: spent.addr, key: "erc20.approve", args: [S.pool, 0n], need: 0, spend: true,
                          lines: [["Amount", "0 " + spent.sym], ["Leaves", "no standing allowance"]],
                          sentence: "revokes the " + amt(left, spent.dec) + " " + spent.sym + " still approved to the market: nothing stays approved" });
                      }, { spend: true });
                      card.append(box);
                    }, function () {});
                  });
                }
              });
            }, function () { ui.say("the chain's clock could not be read", "err"); if (go) go.disabled = true; ui.note(det, "the chain's clock could not be read; no deadline is guessed", "warn"); });
          }, function (e) { ui.say(/TradeTooLarge/.test(e.message) ? "more than half of the reserve" : "the market would not price it: " + e.message, "err"); });
        }).catch(function (e) { ui.say("the allowance did not answer: " + (e && e.message), "err"); });
      }
      return c;
    }

    /*═══════════ Elsewhere: the Router's quote beside the owned one; the swap through the Reach ═══════════*/
    var routerOn = !!(S.reported & S.bits.router) && !isEth(S.router);
    var elseOut = null, elseBox = null;
    /* the Router quotes by revert — QuoteResult(spent, received, sqrtPriceAfter): the received word, or null for any other answer */
    var routerGot = function (r) { var sig = !r.ok && S.err[r.data.slice(0, 10).toLowerCase()] || ""; return sig.indexOf("QuoteResult(") === 0 ? BigInt("0x" + r.data.slice(74, 138)) : null; };
    function quoteElsewhere(a, seq) {
      if (!routerOn || !elseOut) return;
      var IN = coin(baseIn), OUT = coin(!baseIn), v = elseOut.lastChild;
      delete v.dataset.raw;
      /* the Router swaps exact-in only: in exact-out mode the row says so, rather than print what the ceiling
         would buy in one coin beside what the owned market would charge in the other as if they compared */
      if (exactOut) { v.textContent = "exact-in only — switch the mode to compare"; return; }
      v.textContent = "reading…";
      ui.simulate(S.router, S.sel["router.quoteExactIn"] + swapReq(0, IN.addr, OUT.addr, a, 0n, 0n), { from: ui.account() || S.reach }).then(function (r) {
        if (seq !== qseq) return;
        var got = routerGot(r);
        if (got == null) { v.textContent = "no quote: " + (r.sentence || "the Router returned instead"); return; }
        v.dataset.raw = String(got); v.textContent = amt(got, OUT.dec) + " " + OUT.sym + " through the Router";
      }, function (e) { if (seq === qseq) v.textContent = unread(e); });
    }
    function elsewhere(p) {
      var sec = ui.el("div"); sec.id = "swap-elsewhere"; sec.hidden = tab !== "elsewhere"; p.append(sec);
      sec.append(ui.el("h3", "", "elsewhere"));
      ui.note(sec, "the same pair through the Router, from the Reach: an exact approval, the call, the allowance zeroed and proved, what left and what arrived measured. v3 paths and v4 keys are not built by this page yet.");
      elseOut = ui.kv(sec, "through the Router", "type an amount above"); elseOut.id = "swap-quote-elsewhere"; elseOut.classList.add("quote");
      var ven = ui.el("div"); ven.id = "swap-venues"; sec.append(ven);
      ui.read(S.router, "router.venues", []).then(function (r) {
        var h = r.raw.slice(2), w = function (at) { return BigInt("0x" + h.substr(at * 2, 64)); };
        var b0 = Number(w(0)), n = Number(w(b0));
        for (var k = 0; k < n; k++) {
          var e = b0 + 32 + Number(w(b0 + 32 + k * 32));
          var str = function (rel) { var at = e + Number(w(e + rel)); return utf8(h.substr(at * 2 + 64, Number(w(at)) * 2)); };
          var at = "0x" + h.substr((e + 32) * 2 + 24, 40);
          var row = ui.kv(ven, str(0), isEth(at) ? "not on this chain" : ui.short(ui.checksum(at)) + " · code " + h.substr((e + 64) * 2, 10) + "… · " + (w(e + 128) ? "upgradeable" : "pinned"));
          row.classList.add("venue");
        }
        if (!n) ui.note(ven, "the Router names no venue");
      }, function (e) { ui.note(ven, "venues " + unread(e), "warn"); });
      elseBox = ui.el("div"); sec.append(elseBox);
      paintElsewhereAct();
    }
    /*  D §4.4: under a Reach seal no native input can leave through any wrapper, and a
        manifest asset's balance may not fall — so both routes hide, and say why. */
    function paintElsewhereAct() {
      if (!elseBox) return; elseBox.replaceChildren();
      var IN = coin(baseIn), OUT = coin(!baseIn);
      var why = reachSeal > chainNow() && (isEth(IN.addr) ? "nothing native leaves it — flip the pair" : manifest.some(function (a) { return same(a, IN.addr); }) ? IN.sym + " is on the Reach's manifest: it cannot leave" : !manifestKnown && "its manifest could not be read");
      if (why) return ui.note(elseBox, "the Reach is sealed until " + date(reachSeal) + ": " + why, "warn");
      ui.act(elseBox, "swapElsewhere", "swap through the Router, from the Reach", R.HOLD, function () {
        var P = pending; if (!P || exactOut) return ui.say(exactOut ? "the Router swaps exact-in only; switch the mode" : "an amount first", "err");
        var a = P.a, ask = function () { return ui.simulate(S.router, S.sel["router.quoteExactIn"] + swapReq(0, IN.addr, OUT.addr, a, 0n, 0n), { from: S.reach }); };
        /* quoted again at this press, by the Router itself */
        return ask().then(function (r) {
          var q = routerGot(r);
          if (q == null) return ui.say("the Router would not price it: " + (r.sentence || "no quote"), "err");
          var minOut = q - q * 50n / 10000n;
          return ui.clock().then(function (now) {
            var dl = now + 900n, value = isEth(IN.addr) ? a : 0n;
            var inner = "0x" + S.sel["router.swap"].slice(2) + swapReq(0, IN.addr, OUT.addr, a, minOut, dl);
            return ui.propose({
              to: S.reach, data: "0x" + typedCall(S.router, value, inner, [[IN.addr, a]], [[OUT.addr, minOut]], dl).slice(2), sig: TYPED, need: R.HOLD, spend: true,
              /* the Router is asked once more inside the press: a floor its quote no longer meets is a sentence here, not a Slippage revert after the signature */
              recheck: function () { return ask().then(function (r) { var g = routerGot(r); return g == null ? "the Router could not be re-quoted at the press — review again" : g < minOut ? "the Router's price moved past the floor — review again" : null; }, function () { return "the Router could not be re-quoted at the press — review again"; }); },
              lines: [["Token", "#" + ID], ["Through", "the Router " + ui.short(ui.checksum(S.router)) + ", venue: its own pool, from the Reach"],
                      ["Spend", "at most " + amt(a, IN.dec) + " " + IN.sym + (value ? ", sent as value" : "")], ["Receive at least", amt(minOut, OUT.dec) + " " + OUT.sym + " — or nothing moves"],
                      ["About", amt(q, OUT.dec) + " " + OUT.sym], ["Allowance after", "zero, proved"], ["Dies", "in fifteen minutes"]],
              sentence: "the Reach swaps exactly " + amt(a, IN.dec) + " " + IN.sym + " through the Router for no less than " + amt(minOut, OUT.dec) + " " + OUT.sym + ", or nothing moves; no allowance survives; dies in fifteen minutes",
              then: after
            });
          }, function () { ui.say("the chain's clock could not be read", "err"); });
        }, function (e) { ui.say(unread(e), "err"); });
      }, { spend: true });
    }

    /*═══════════ the holder's half ═══════════*/
    function yourMarket(p) {
      var y = ui.el("div"); y.id = "swap-your-market"; p.append(y);
      y.append(ui.el("h3", "", "your market"));
      if (ui.mode() !== "console" || !(ui.rights() & R.HOLD)) { ui.gate(y, R.HOLD); return; }
      if (!M.open) return openForm(y);
      var sealed = M.seal > chainNow(), Bc = coin(true), Qc = coin(false);
      ui.note(y, "you are the only maker this market will ever have; what you deposit is what it trades.");
      if (sealed) ui.note(y, "sealed until " + date(M.seal) + " — the terms are promised until then; deposits still land.", "warn");
      /* legs: each ERC-20 leg is an exact approval step; the native leg is `value`, exactly */
      var legs = function (ab, aq) {
        var st = [];
        if (ab && !isEth(Bc.addr)) st.push({ token: Bc.addr, spender: S.pool, amount: ab, symbol: Bc.sym, decimals: Bc.dec });
        if (aq && !isEth(Qc.addr)) st.push({ token: Qc.addr, spender: S.pool, amount: aq, symbol: Qc.sym, decimals: Qc.dec });
        return st;
      };
      var two = function (box, verb) {
        var fb = ui.field(box, verb + " " + Bc.sym, "0.0"), fq = ui.field(box, "and " + Qc.sym, "0.0");
        return function () {
          if (Bc.dec == null || Qc.dec == null) return ui.say("a coin's decimals did not answer; nothing is guessed", "err"), null;
          var ab, aq;
          try { ab = fb.value.trim() ? ui.parse(fb.value, Bc.dec) : 0n; aq = fq.value.trim() ? ui.parse(fq.value, Qc.dec) : 0n; } catch (e) { return ui.say("not a number", "err"), null; }
          if (!ab && !aq) return ui.say("an amount of either coin", "err"), null;
          return [ab, aq];
        };
      };
      var dep = ui.el("div"); y.append(dep); var readDep = two(dep, "deposit");
      ui.act(dep, "deposit", "review the deposit", R.HOLD, function () {
        var v = readDep(); if (!v) return;
        var value = isEth(Bc.addr) ? v[0] : isEth(Qc.addr) ? v[1] : 0n;
        return ui.approveExactThen(legs(v[0], v[1]), function () {
          return ui.propose({ to: S.pool, key: "pool.deposit", args: [ID, v[0], v[1]], value: value, need: R.HOLD, spend: true,
            lines: [["Token", "#" + ID], [Bc.sym, amt(v[0], Bc.dec)], [Qc.sym, amt(v[1], Qc.dec)], ["Counted as", "what actually arrives, not what was sent"]],
            sentence: "deposits " + amt(v[0], Bc.dec) + " " + Bc.sym + " and " + amt(v[1], Qc.dec) + " " + Qc.sym + " into #" + ID + "'s market, counted as what arrives", then: after });
        }).catch(function (e) { ui.say("the allowance did not answer: " + (e && e.message), "err"); });
      }, { spend: true });
      if (!sealed) {
        var wd = ui.el("div"); y.append(wd); var readWd = two(wd, "withdraw");
        ui.act(wd, "withdraw", "review the withdrawal", R.HOLD, function () {
          var v = readWd(); if (!v) return;
          return ui.propose({ to: S.pool, key: "pool.withdraw", args: [ID, v[0], v[1], ui.account()], need: R.HOLD,
            lines: [["Token", "#" + ID], [Bc.sym, amt(v[0], Bc.dec)], [Qc.sym, amt(v[1], Qc.dec)], ["To", ui.short(ui.account())]],
            sentence: "withdraws " + amt(v[0], Bc.dec) + " " + Bc.sym + " and " + amt(v[1], Qc.dec) + " " + Qc.sym + " from #" + ID + "'s market to " + ui.account(), then: after });
        });
        var fee = ui.el("div"); y.append(fee); y.append(ui.el("h3", "", "the fee"));
        var fIn = ui.field(fee, "set it to, in bps (≤ 500)", String(M.fee)); fIn.name = "feeBps";
        ui.act(fee, "setFee", "review the fee", R.HOLD, function () {
          var f = digits(fIn.value, 500n, "the fee"); if (f == null) return;
          return ui.propose({ to: S.pool, key: "pool.setFee", args: [ID, f], need: R.HOLD,
            lines: [["Token", "#" + ID], ["From", M.fee + " bps"], ["To", f + " bps, to whoever holds the token"]],
            sentence: "sets #" + ID + "'s market fee from " + M.fee + " to " + f + " bps", then: after });
        });
        var cv = ui.el("div"); y.append(cv); cv.append(ui.el("h3", "", "the curve"));
        var drift = ui.kv(cv, "anchored at", M.curve + " bps; the curve trait says reading…");
        var trait = BigInt(S.curve || 0);
        ui.read(S.hub, "hub.getTraitValue", [ID, ui.khex("curve")]).then(function (r) { trait = r.w(0); drift.lastChild.textContent = M.curve + " bps; the curve trait says " + trait + " bps" + (trait === BigInt(M.curve) ? " — in agreement" : " — the artwork has moved"); },
          function (e) { drift.lastChild.textContent = M.curve + " bps; the curve trait " + unread(e) + " (baked: " + trait + ")"; });
        ui.act(cv, "syncCurve", "re-anchor to the trait", R.HOLD, function () {
          return ui.propose({ to: S.pool, key: "pool.syncCurve", args: [ID, trait, BigInt(M.curve)], need: R.HOLD,
            lines: [["Token", "#" + ID], ["Curve", M.curve + " bps → " + trait + " bps"], ["Expected", M.curve + " bps as read here; moved since, it is refused"], ["This is", "the only place the trait moves the price"]],
            sentence: "re-anchors #" + ID + "'s market to a curve of " + trait + " bps, expecting it to stand at " + M.curve + " bps", then: after });
        });
      }
      var sl = ui.el("div"); y.append(sl); sl.append(ui.el("h3", "", "the seal"));
      ui.note(sl, "a seal promises the inventory stays: no withdrawal, no fee change, no re-anchoring until it lapses. It only ever lengthens, and it survives sale.");
      if (M.seal) ui.kv(sl, "sealed until", date(M.seal) + (sealed ? "" : " (lapsed)"));
      if (!sealed) {
        var days = ui.field(sl, "seal for how many days (≤ 365)", "7");
        ui.act(sl, "sealMarket", "review the seal", R.HOLD, function () {
          var d = digits(days.value, 365n, "the number of days"); if (d == null) return; if (!d) return ui.say("at least one day", "err");
          return ui.clock().then(function (now) {
            var until = now + d * 86400n;
            return ui.propose({ to: S.pool, key: "pool.sealMarket", args: [ID, until], need: R.HOLD,
              lines: [["Token", "#" + ID], ["For", d + (d === 1n ? " day" : " days") + ", until " + date(until)], ["Reversible", "no — it only ever lengthens, and it survives sale"]],
              sentence: "seals #" + ID + "'s market until " + date(until) + ": it only ever lengthens, and it survives sale", then: after });
          }, function () { ui.say("the chain's clock could not be read", "err"); });
        });
      }
      var wr = ui.el("div"); y.append(wr); wr.append(ui.el("h3", "", "after a rebase"));
      ui.act(wr, "writeDown", "write the reserves down to what is held", R.HOLD, function () {
        return ui.propose({ to: S.pool, key: "pool.writeDown", args: [ID], need: R.HOLD,
          lines: [["Token", "#" + ID], ["Refused when", "nothing has shrunk"]],
          sentence: "writes #" + ID + "'s reserves down to what the pool actually holds", then: after });
      });
      var cl = ui.el("div"); y.append(cl); cl.append(ui.el("h3", "", "close it"));
      if (sealed) ui.note(cl, "closing is refused while the seal stands");
      else if (M.rB || M.rQ) ui.note(cl, "the inventory must be empty first: withdraw it, then close");
      else ui.act(cl, "closeMarket", "review the closing", R.HOLD, function () {
        return ui.propose({ to: S.pool, key: "pool.closeMarket", args: [ID], need: R.HOLD,
          lines: [["Token", "#" + ID], ["Refused unless", "both reserves are zero"]],
          sentence: "closes #" + ID + "'s market; it can be opened again", then: after });
      });
    }
    /* the open form: base, quote, fee, curve — and the sniper fee, set here and nowhere else (D19) */
    function openForm(y) {
      var f = ui.el("div"); f.id = "swap-open-form"; y.append(f);
      ui.note(f, "no market is open. The holder opens one; the fee is paid to whoever holds the token. The sniper fee is set here and nowhere else, and falls to nothing over its window.");
      var oB = ui.field(f, "base coin (0x0 for ETH)", "0x…"), oQ = ui.field(f, "quote coin (0x0 for ETH)", "0x…");
      var oF = ui.field(f, "fee, in bps (≤ 500)", "30"); oF.name = "feeBps";
      var oC = ui.field(f, "curve, in bps (≤ 80000; 0 = constant product)", "0"); oC.name = "curveBps";
      var oS = ui.field(f, "sniper fee at open, in bps (≤ 9000)", "0"); oS.name = "sniperBps";
      var oT = ui.field(f, "sniper window, in seconds (≤ 5880)", "0"); oT.name = "sniperSeconds";
      ui.act(f, "openMarket", "review the opening", R.HOLD, function () {
        /* "0x0 for ETH", as the labels say: an empty field, 0x0 or any run of zeros is the native coin */
        var eth0 = function (s) { s = String(s).trim(); return /^(0x0*)?$/i.test(s) ? ZERO : s; };
        var b = eth0(oB.value), q = eth0(oQ.value);
        if (!ui.isAddr(b) || !ui.isAddr(q)) return ui.say("two coin addresses (0x0 for ETH)", "err");
        if (same(b, q)) return ui.say("two different coins", "err");
        var fee = digits(oF.value, 500n, "the fee"), cv = digits(oC.value, 80000n, "the curve"), sb = digits(oS.value, 9000n, "the sniper fee"), ss = digits(oT.value, 5880n, "the sniper window");
        if (fee == null || cv == null || sb == null || ss == null) return;
        return ui.propose({ to: S.pool, key: "pool.openMarket", args: [ID, b, q, fee, cv, sb, ss], need: R.HOLD,
          lines: [["Token", "#" + ID], ["Base", isEth(b) ? "ETH" : ui.short(ui.checksum(b))], ["Quote", isEth(q) ? "ETH" : ui.short(ui.checksum(q))], ["Fee", fee + " bps, paid to whoever holds the token"],
                  ["Curve", cv + " bps of concentration"], ["Sniper fee", sb ? sb + " bps at open, falling to nothing over " + ss + " s — set here and nowhere else" : "none"]],
          sentence: "opens #" + ID + "'s market, " + (isEth(b) ? "ETH" : ui.short(ui.checksum(b))) + " against " + (isEth(q) ? "ETH" : ui.short(ui.checksum(q))) + " at " + fee + " bps" + (sb ? " with a sniper fee of " + sb + " bps for " + ss + " s" : ""),
          then: after });
      });
    }

    /*═══════════ the facts, the sniper countdown, the directory ═══════════*/
    function facts(p) {
      var f = ui.el("div"); f.id = "swap-facts"; p.append(f);
      if (!M.open) { ui.kv(f, "market", "closed"); return; }
      var Bc = coin(true), Qc = coin(false);
      ui.kv(f, "pair", Bc.sym + " / " + Qc.sym);
      ui.kv(f, "reserves", amt(M.rB, Bc.dec) + " " + Bc.sym + " · " + amt(M.rQ, Qc.dec) + " " + Qc.sym);
      ui.kv(f, "fee", M.fee + " bps");
      ui.kv(f, "curve", M.curve + " bps");
      ui.kv(f, "seal", M.seal ? (M.seal > chainNow() ? "sealed until " : "lapsed ") + date(M.seal) : "none");
      clearTimeout(snT);
      if (M.snBps && M.snUntil > chainNow()) {
        var sn = ui.kv(f, "sniper fee", ""); sn.id = "swap-sniper";
        var tick = function () {
          var left = M.snUntil - chainNow();
          if (left <= 0) { sn.remove(); return; }
          sn.lastChild.textContent = M.snBps + " bps at open, decaying — " + left + " s left";
          snT = setTimeout(tick, 1000);
        };
        tick();
      }
    }
    function directory(p) {
      var d = ui.el("div"); d.id = "swap-directory"; p.append(d);
      d.append(ui.el("h3", "", "open markets"));
      var ti = location.pathname.indexOf("/token/"), BASE = ti >= 0 ? location.pathname.slice(0, ti) : location.pathname.replace(/\/$/, "");
      ui.read(S.pool, "pool.openIds", [0n, 48n]).then(function (r) {
        var ids = r.arr(0);
        if (!ids.length) ui.note(d, "none open on this chain yet");
        ids.forEach(function (id) {
          var a = ui.el("a", "market v", "#" + id); if (ui.mode() !== "viewer") a.href = BASE + "/token/" + id + "/live"; d.append(a); d.append(ui.el("span", "s", " "));
        });
      }, function (e) { ui.note(d, "the directory " + unread(e), "warn"); });
      /* sealed markets whose fee stream is this token's: anyone may collect them to its feeSink */
      ui.read(S.pool, "pool.sealedIds", [0n, 48n]).then(function (r) {
        return Promise.all(r.arr(0).map(function (key) {
          return ui.read(S.pool, "pool.marketOf", [key]).then(function (m) {
            if (m.w(15) !== BigInt(ID)) return;
            /* its quote is ETH by construction (Pool.openSealed refuses any other); its base is the launch coin, read like the pair's */
            return sym(m.a(0)).then(function (s) {
              var row = ui.el("div", "sealed"); d.append(row);
              ui.kv(row, "sealed market " + String(key).slice(0, 8) + "…", "owes " + amt(m.w(13), s[1]) + " " + s[0] + " · " + amt(m.w(14), 18) + " ETH to #" + ID + "'s feeSink");
              ui.act(row, "collect", "collect its fees", 0, function () {
                return ui.propose({ to: S.pool, key: "pool.collect", args: [key], need: 0,
                  lines: [["Sealed market", String(key)], ["Pays", "its owed fees to #" + ID + "'s feeSink"], ["Who may", "anyone; the recipient is fixed"]],
                  sentence: "collects the fees sealed market " + String(key).slice(0, 10) + "… owes to #" + ID + "'s feeSink" });
              });
            });
          });
        }));
      }).catch(function () {});
    }

    /*═══════════ paint ═══════════*/
    function paint() {
      host.replaceChildren(); card = null; elseOut = null; elseBox = null; requote = null; pending = null; qseq++; clearTimeout(snT);
      seenBits = ui.rights(); seenAcct = ui.account();
      if (!(S.reported & S.bits.pool) || !M) {
        ui.note(host, S.absent & S.bits.pool ? "the market contract is not deployed on this chain" : "the market could not be read at block " + S.block + " — not the same fact as having no market", "warn");
        S.loaded.swap = true; return;
      }
      var tabs = ui.el("div");
      var tOwned = ui.el("button", "chip", "its own market"); tOwned.type = "button"; tOwned.dataset.tab = "owned";
      var tElse = ui.el("button", "chip", "elsewhere"); tElse.type = "button"; tElse.dataset.tab = "elsewhere"; tElse.hidden = !routerOn;
      tabs.append(tOwned, tElse);
      /* the chip says which spelling: a clear router bit is never a zero */
      if (!routerOn) ui.chip(tabs, "router: " + (S.absent & S.bits.router ? "not deployed on this chain" : "could not be read at block " + S.block), S.absent & S.bits.router ? "absent" : "unread");
      host.append(tabs);
      /*  The card is the input both tabs quote from, so it sits between the two halves the Elsewhere tab
          hides — the owned facts above it, the holder's market and the directory below. It used to live
          inside the owned half and hid with it: on Elsewhere a person could neither type an amount, flip
          the pair nor switch to exact-out. The suite passed because the shim clicked hidden nodes; once
          the shim refused them (as a browser's person would), the two Elsewhere sentences that flip and
          toggle found it. */
      var owned = ui.el("div"), rest = ui.el("div"); host.append(owned);
      var show = function () { tOwned.classList.toggle("on", tab === "owned"); tElse.classList.toggle("on", tab === "elsewhere"); owned.hidden = rest.hidden = tab === "elsewhere"; var e = host.querySelector("#swap-elsewhere"); if (e) e.hidden = tab !== "elsewhere"; };
      tOwned.addEventListener("click", function () { tab = "owned"; show(); });
      tElse.addEventListener("click", function () { tab = "elsewhere"; show(); });
      facts(owned);
      if (M.open) swapCard(host); else ui.note(owned, "no market is open for #" + ID + "; its holder opens one below");
      host.append(rest);
      yourMarket(rest);
      directory(rest);
      ui.note(rest, "trade history and Market listings are not built into this page yet");
      if (routerOn && M.open) elsewhere(host);
      show();
      S.loaded.swap = true;
      /* the live market after the baked one; the Reach's seal and manifest for Elsewhere */
      syncMarket().then(function (changed) { if (changed) paint(); }, function () {});
      if (routerOn) {
        ui.read(S.reach, "reach.sealedUntil", []).then(function (r) { reachSeal = Number(r.w(0)); paintElsewhereAct(); }, function () {});
        ui.read(S.reach, "reach.manifest", []).then(function (r) { manifest = r.arr(0, "address"); manifestKnown = true; paintElsewhereAct(); }, function () { manifestKnown = false; paintElsewhereAct(); });
      }
    }
    paint();
    /*  intact:rights fires after every receipt. The same bits for the same account is not a reason to
        wipe the card: the lane re-quotes instead, so the approve step's "press the same button again"
        holds — the amount stays typed and the button's step moves to Swap. Different bits, or another
        account, repaint: the holder's half and every gate are theirs. */
    window.addEventListener("intact:rights", function (e) {
      var d = e.detail || {};
      if (String(d.bits) !== String(seenBits) || String(d.account) !== String(seenAcct)) paint(); else if (requote) requote();
    });
    window.addEventListener("intact:epoch", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "swap") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
