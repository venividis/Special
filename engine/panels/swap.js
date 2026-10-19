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
    the wallet opens", "the swap slab states the floor in words".

    V2, the Trade lane (W9; docs/V2.md §0 rows 2–3, §2, §3.1, §3.2). The
    owner asked to lock what a swap brings, to sell it slowly once it frees,
    and to write a memory of the trade, like a journal. So under the card:
      · "Lock what I receive" (a switch). On, the swap is the Keepsake's
        swapAndWrap: locked for N days, then freed slowly over M days (two
        day counts; the dates are the chain's clock, ui.clock()), optionally
        sold slowly as it frees, never below a price the person names (the
        drip: the human price P, in what was paid per one of what arrives,
        becomes the raw floor P × 10^decPaid × 1e18 / 10^decReceived, rounded
        up; at most a tenth of the amount per sale unless typed), kept or
        given as a gift with a message of at most 280 bytes. A drip is only
        for a keepsake you keep. Native input rides as value = amountIn; an
        ERC-20 input is an exact approval to the Keepsake first, as the
        button's current step. The keepsake's id is read from the receipt's
        Wrapped log, never from a read after the write (CLAUDE.md).
      · "Write a memory of this trade" (the holder's only: only the holder
        writes a token's journal). After the swap's receipt lands, a second
        slab offers Journal.inscribe(hub, id, TRADE, body, ref = the swap's
        transaction hash); "Not now" leaves it as a button, never forced.
      · Each part appears only where its contract reports (CONSOLE §6.3,
        S.bits.keepsake / S.bits.journal); elsewhere its chip stands in its
        place, and nothing is read from a codeless address.
      · The card says in one breath (#swap-say) what the slab will say; the
        rate both ways, the fee in percent and bps, the sniper countdown in
        minutes and seconds.
    V2 elements (scoped to #lane-swap; the integration step copies them):
      #swap-say           the card's one breath: the sentence the slab opens with, the floor in it
      #swap-lock          the lock part, or the keepsake chip; #swap-lock-on (button[role=switch], aria-checked),
                          inputs name=lockDays|freeDays, #swap-lock-dates, #swap-drip-on (switch) with inputs
                          name=floor|most and #swap-drip-now (what one of it fetches now), #swap-gift-on (switch)
                          with input name=giftTo and textarea name=giftNote, #swap-lock-why (the refusal, in words)
      #swap-memory        the holder's memory part, or the journal chip; textarea name=memory, #swap-memory-count
      #swap-kept          after a landed swap: .keepsake[data-id] (from the Wrapped log), the memory's state
      [data-act=inscribe] the memory, offered again after "Not now" (need HOLD)                          */
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
    /*  V2: the Keepsake's swapAndWrap and the Journal's inscribe, held to the chain's selectors like
        every row. A Catalog that does not serve them silences the two parts, never the lane. */
    var v2 = "";
    try {
      ui.rows({ "keepsake.swapAndWrap": "swapAndWrap((uint256,bool,uint256,uint256,uint64,(uint64,uint64,uint64),address,string,(uint8,uint256,uint256,uint256)))",
                "journal.inscribe": "inscribe(address,uint256,uint8,bytes,bytes32)" });
    } catch (e) { v2 = e.message; }

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

    /*── V2 helpers: bytes as a chain counts them, days, plain time, a rate that is only ever "≈" ──*/
    var u8 = function (s) { return new TextEncoder().encode(s); };
    var hexOf = function (s) { return "0x" + Array.from(u8(s), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join(""); };
    var whole = function (s) { s = String(s).trim(); return /^\d{1,6}$/.test(s) ? BigInt(s) : null; };
    var dayz = function (n) { return n + (n === 1n ? " day" : " days"); };
    var plain = function (s) { return (s >= 60 ? Math.floor(s / 60) + " min " : "") + s % 60 + " s"; };
    var pct = function (b) { return b / 100 + " % (" + b + " bps)"; };
    /* about six significant figures, never a flat zero and never eighteen places: for a rate, not a floor */
    var approx = function (v, d) { var s = amt(v, d), j = s.indexOf("."); return j < 0 ? s : s.slice(0, Math.max(j + 7, s.search(/[1-9]/) + 6)).replace(/\.?0+$/, ""); };
    /* the first log a receipt carries from `a` under topic `t`: its topic word `i`, or null */
    var logged = function (r, a, t, i) { var l = (r.logs || []).filter(function (x) { return same(x.address, a) && same(x.topics && x.topics[0], t); })[0]; return l ? BigInt(l.topics[i]) : null; };
    /*  a V2 part shows only where its contract reports (CONSOLE §6.3); elsewhere its chip stands in its
        place, and nothing is read from it — a codeless address answers no question */
    var part = function (p, k) {
      var bit = S.bits[k];
      if (v2) return ui.note(p, v2, "warn"), false;
      if (S.reported & bit) return true;
      ui.chip(p, k + ": " + (S.absent & bit ? "not deployed on this chain" : "could not be read at block " + S.block), S.absent & bit ? "absent" : "unread");
      return false;
    };
    /* what is typed under the card lives here, so a repaint keeps it; a landed trade starts afresh */
    var lk0 = function () { return { on: false, days: "30", free: "30", drip: false, floor: "", most: "", gift: false, to: "", note: "", mem: "" }; };
    var LK = lk0(), last = null, memLive = false, sayEl = null, whyEl = null, datesEl = null, nowEl = null, drawLock = null;
    /*  the lane's own light, written once into the head and scoped to #lane-swap (never markup: one
        textContent): a switch is a row with a knob in the token's two hues, the one breath is set large,
        and a keepsake wears an orb of the same light — art within art. No animation, so nothing loops. */
    if (!document.getElementById("swap-style")) {
      var st = ui.el("style"); st.id = "swap-style";
      st.textContent = "#lane-swap [role=switch]{display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 14px;border-radius:16px;font-size:14px}" +
        "#lane-swap [role=switch]::after{content:'';width:40px;height:22px;border-radius:99px;background:radial-gradient(circle at 11px,#fff 7px,#0000 8px),#fff3}" +
        "#lane-swap [aria-checked=true]::after{background:radial-gradient(circle at 29px,#fff 7px,#0000 8px),linear-gradient(90deg,hsl(var(--h2) 90% 70%),hsl(var(--h) 80% 60%))}" +
        "#swap-say{font-size:17px}" +
        "#swap-kept .keepsake::before{content:'';float:left;width:46px;height:46px;margin-right:12px;border-radius:50%;background:radial-gradient(circle at 38% 34%,#fff,hsl(var(--h2) 90% 70%) 40%,hsl(var(--h) 80% 30%));box-shadow:0 0 24px hsl(var(--h2) 90% 70%)}";
      document.head.append(st);
    }
    /* a switch: a button with role=switch, its state in aria-checked (the knob reads it), its label its own text */
    var sw = function (p, id, label, k, fn) {
      var b = ui.el("button", "chip", label), set = function () { b.setAttribute("aria-checked", String(LK[k])); };
      b.type = "button"; b.id = id; b.setAttribute("role", "switch"); set();
      b.addEventListener("click", function () { LK[k] = !LK[k]; set(); fn(); });
      p.append(b); return b;
    };
    /* every field is labelled for assistive technology as well as on screen: ui.field draws the words, this names the input */
    var fld = function (p, l, ph) { var i = ui.field(p, l, ph); i.setAttribute("aria-label", l); return i; };
    /* a field bound to LK[k], labelled for assistive technology as well as on screen */
    var bound = function (p, label, k, name, ph, area) {
      p.append(ui.el("div", "k", label));
      var i = ui.el(area ? "textarea" : "input"); if (!area) { i.type = "text"; i.autocomplete = "off"; }
      i.name = name; i.placeholder = ph; i.value = LK[k]; i.setAttribute("aria-label", label); p.append(i);
      i.addEventListener("input", function () { LK[k] = i.value; summary(); });
      return i;
    };

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

    /*═══════════ V2: the lock's terms, the one breath, the receipt's facts, the memory ═══════════*/
    /*  the lock's terms from what is typed: an object, or the sentence that refuses them. The drip
        sells what arrives (OUT) for what was paid (IN), so its price is IN per one OUT and the floor
        the Keepsake reads is IN units per 1e18 OUT units, rounded up: never below what was typed */
    function terms(q) {
      var IN = coin(baseIn), OUT = coin(!baseIn), L = whole(LK.days), F = whole(LK.free), t = { L: L, F: F, note: "" }, x, b;
      if (exactOut) return "a lock names what you pay: switch to exact in";
      if (IN.dec == null || OUT.dec == null) return "a coin's decimals did not answer; nothing is guessed";
      if (L == null || F == null) return "the days are whole numbers";
      if (!(L + F)) return "a lock of no days is no lock: name at least one day";
      if (L + F > 3650n) return "a keepsake frees within ten years: 3,650 days at most";
      if (LK.gift) {
        if (LK.drip) return "a drip is only for a keepsake you keep: a giver never sells a recipient's gift";
        x = LK.to.trim();
        if (!ui.isAddr(x) || isEth(x)) return "a gift needs the address it goes to";
        /* a mixed-case address carries its own checksum (EIP-55): one that does not match is a typo, and a gift is not taken back */
        if (/[a-f]/.test(x) && /[A-F]/.test(x) && ui.checksum(x) !== x) return "that address's mixed case is not its checksum: check every character";
        if (same(x, ui.account())) return "that is your own address: a keepsake you keep is no gift";
        t.to = ui.checksum(x); t.note = LK.note.trim(); x = u8(t.note).length;
        if (x > 280) return "the message is " + x + " bytes; a gift's card holds 280";
      }
      if (LK.drip) {
        try { x = ui.parse(LK.floor, IN.dec); } catch (e) { x = 0n; }
        if (!x) return "name the lowest price it may sell at, in " + IN.sym + " per " + OUT.sym;
        b = 10n ** BigInt(OUT.dec); t.P = x; t.floor = (x * 10n ** 18n + b - 1n) / b;
        try { x = LK.most.trim() ? ui.parse(LK.most, OUT.dec) : (q || 0n) / 10n || 1n; } catch (e) { x = 0n; }
        if (!x) return "the most it sells at a time is an amount of " + OUT.sym;
        t.most = x;
      }
      return t;
    }
    /* the one breath a slab opens with, and the card shows before the press (V2 §2) */
    function words(P, t) {
      var IN = coin(baseIn), OUT = coin(!baseIn), lo = amt(P.lim, (exactOut ? IN : OUT).dec);
      if (exactOut) return "You receive exactly " + amt(P.a, OUT.dec) + " " + OUT.sym + " and pay at most " + lo + " " + IN.sym + ", or nothing moves";
      var s = "You pay " + amt(P.a, IN.dec) + " " + IN.sym + " and ";
      if (!t || typeof t === "string") return s + "receive at least " + lo + " " + OUT.sym + ", or nothing moves";
      return s + (t.to ? "give at least " + lo + " " + OUT.sym + " to " + t.to : "receive at least " + lo + " " + OUT.sym) + ", " +
        (t.L ? "locked for " + dayz(t.L) + ", then " + (t.F ? "freed slowly over " + dayz(t.F) : "freed all at once") : "freed slowly over " + dayz(t.F) + " from now") +
        (t.P ? "; it sells itself slowly, never below " + amt(t.P, IN.dec) + " " + IN.sym + " per " + OUT.sym : "");
    }
    /* the card's one breath, the lock's dates on the chain's clock and its refusal, as things are typed */
    function summary() {
      var P = pending, t = LK.on && terms(P && P.q), IN = coin(baseIn), OUT = coin(!baseIn), n = BigInt(chainNow()), L = whole(LK.days), F = whole(LK.free);
      if (whyEl) { whyEl.textContent = typeof t === "string" ? t : ""; whyEl.hidden = typeof t !== "string"; }
      if (datesEl) datesEl.textContent = L != null && F != null && L + F ? (L ? "locked until " + date(n + L * 86400n) + ", " : "frees from now, ") + "all free by " + date(n + (L + F) * 86400n) : "";
      if (nowEl) nowEl.textContent = P && P.q && !exactOut ? "now 1 " + OUT.sym + " fetches ≈ " + approx(P.a * 10n ** BigInt(OUT.dec) / P.q, IN.dec) + " " + IN.sym : "";
      if (sayEl) sayEl.textContent = P ? words(P, t) + "." : "";
    }
    /* the holder's memory as typed, when its part is showing: false (said in words) when too long */
    function memText() {
      var s = memLive ? LK.mem.trim() : "", n = u8(s).length;
      return n > 1024 ? (ui.say("the memory is " + n + " bytes; a journal entry holds 1,024", "err"), false) : s;
    }
    /*  after a swap that landed: the keepsake's id from its Wrapped log — never a read after the write
        (CLAUDE.md) — and the memory, kept for the card; what follows is typed afresh */
    function kept(r, info, body) {
      if (!r || BigInt(r.status || 0) !== 1n) return false;
      var had = !!last;
      last = info || body ? { acct: ui.account(), hash: r.transactionHash, body: body, info: info, n: null, id: info && logged(r, S.keepsake, S.topics.wrapped, 1) } : null;
      if (last) LK = lk0();
      return had || !!last;
    }
    /* the memory slab follows the swap it is about, offered and never forced */
    var offer = function (h) { return function () { var m = last; return m && m.hash === h && m.body && !m.n ? inscribe() : null; }; };
    function inscribe() {
      var m = last; if (!m || !m.body || m.n) return;
      return ui.propose({
        to: S.journal, key: "journal.inscribe", args: [S.hub, BigInt(ID), 1n, hexOf(m.body), m.hash], need: R.HOLD,
        lines: [["Token", "#" + ID], ["Memory", m.body], ["Kind", "a trade"], ["About", "the swap in transaction " + m.hash],
                ["Read by", "anyone, for ever; never edited or deleted"], ["Fingerprint", "it moves: a listing signed before this memory no longer fills"]],
        sentence: "Writes your memory of this trade into #" + ID + "'s journal. It is public, and it enters the token's fingerprint.",
        then: function (r) { var n = logged(r, S.journal, S.topics.inscribed, 3); if (n != null && m === last) { m.n = n; paintKept(); } }
      });
    }
    function paintKept() {
      var k = host.querySelector("#swap-kept"), m = last, e;
      if (!k) return; k.replaceChildren();
      if (!m || !same(m.acct, ui.account())) return;
      if (m.info) {
        e = ui.note(k, (m.id == null ? "a keepsake" : "keepsake #" + m.id) + " holds what arrived" + (m.info.gift ? " and is now " + m.info.gift + "'s" : "; it is yours") +
          ": it frees from " + date(m.info.start) + ", all free by " + date(m.info.end), "ok");
        e.classList.add("keepsake", "card"); if (m.id != null) e.dataset.id = String(m.id);
      }
      if (m.body) m.n ? ui.note(k, "memory #" + m.n + " is in #" + ID + "'s journal, for anyone to read", "ok") : ui.act(k, "inscribe", "write the memory of this trade", R.HOLD, inscribe);
    }

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
      var inp = fld(c, "amount", "0.0"); inp.id = "swap-in"; inp.inputMode = "decimal";
      var out = ui.el("p", "v"); out.id = "swap-out"; c.append(out);
      var det = ui.el("div"); det.id = "swap-details"; c.append(det);
      /* V2: the lock and the memory sit between what is quoted and the button that signs it */
      var opt = ui.el("div"); c.append(opt);
      var go = ui.act(c, "swap", "Swap", 0, press, { spend: true });
      var kb = ui.el("div"); kb.id = "swap-kept"; c.append(kb);
      if (go) { go.id = "swap-go"; go.disabled = true; lockPart(opt); memPart(opt); }
      var paintDir = function () {
        var IN = coin(baseIn), OUT = coin(!baseIn);
        sIn.textContent = IN.sym; sOut.textContent = OUT.sym;
        mode.textContent = exactOut ? "exact out: you name what arrives" : "exact in: you name what you pay";
        mode.classList.toggle("on", exactOut);
      };
      /* a floor and a per-sale amount are in the pair's units: a flip clears them, never reads them the other way round */
      flip.addEventListener("click", function () { baseIn = !baseIn; LK.floor = LK.most = ""; if (drawLock) drawLock(); paintDir(); quoteNow(); paintElsewhereAct(); });
      mode.addEventListener("click", function () { exactOut = !exactOut; paintDir(); quoteNow(); });
      inp.addEventListener("input", quoteNow);
      paintDir(); requote = quoteNow; paintKept();

      /*  "Lock what I receive": the days, the slow sale, the gift — each a switch that opens its own
          fields, every field bound to LK, the dates on the chain's clock, the refusal in words */
      function lockPart(o) {
        var b = ui.el("div"); b.id = "swap-lock"; o.append(b);
        if (!part(b, "keepsake")) return;
        var body = ui.el("div"), draw = function () {
          body.replaceChildren(); body.className = LK.on ? "card" : ""; datesEl = nowEl = null;
          if (!LK.on) return;
          bound(body, "locked for how many days", "days", "lockDays", "30").inputMode = "numeric";
          bound(body, "then freed slowly over how many days", "free", "freeDays", "30").inputMode = "numeric";
          datesEl = ui.note(body, "", "s"); datesEl.id = "swap-lock-dates";
          sw(body, "swap-drip-on", "Sell it slowly as it frees", "drip", flipped);
          if (LK.drip) {
            bound(body, "never below this price, in " + coin(baseIn).sym + " per " + coin(!baseIn).sym, "floor", "floor", "the lowest you accept").inputMode = "decimal";
            nowEl = ui.note(body, "", "s"); nowEl.id = "swap-drip-now";
            bound(body, "at most this much " + coin(!baseIn).sym + " per sale", "most", "most", "a tenth of what arrives").inputMode = "decimal";
            ui.note(body, "anyone may press a sale, once a block; it pays only you", "s");
          }
          sw(body, "swap-gift-on", "Give it as a gift", "gift", flipped);
          if (LK.gift) {
            bound(body, "to this address", "to", "giftTo", "0x…");
            bound(body, "with a message on its card (280 bytes at most)", "note", "giftNote", "", 1);
          }
        }, flipped = function () { draw(); quoteNow(); };
        sw(b, "swap-lock-on", "Lock what I receive", "on", function () { syncClock().then(summary); flipped(); });
        b.append(body);
        whyEl = ui.note(b, "", "warn"); whyEl.id = "swap-lock-why"; whyEl.hidden = true;
        (drawLock = draw)();
      }
      /* "Write a memory of this trade": only the holder writes a token's journal */
      function memPart(o) {
        if (!(ui.rights() & R.HOLD)) return;
        var b = ui.el("div"); b.id = "swap-memory"; o.append(b);
        if (!part(b, "journal")) return;
        memLive = true;
        var t = bound(b, "Write a memory of this trade (optional)", "mem", "memory", "what you were thinking", 1);
        var n = ui.el("p", "s"); n.id = "swap-memory-count"; b.append(n);
        var count = function () { var len = u8(t.value.trim()).length; n.textContent = len + " of 1,024 bytes · public, written after the swap lands"; n.classList.toggle("bad", len > 1024); };
        t.addEventListener("input", count); count();
      }
      /* the button's word and the approval's spender follow the lock: the Keepsake pulls what the lock pays */
      var locked = function () { return LK.on && !!host.querySelector("#swap-lock-on"); };
      var label = function () { return locked() ? (LK.gift ? "Swap and give" : "Swap and lock") : "Swap"; };

      function quoteNow() {
        var IN = coin(baseIn), OUT = coin(!baseIn), typedCoin = exactOut ? OUT : IN, quotedCoin = exactOut ? IN : OUT;
        pending = null; qseq++; sayEl = null;
        out.textContent = ""; delete out.dataset.raw; det.replaceChildren();
        if (go) { go.disabled = true; go.textContent = label(); }
        summary();
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
          /* the one breath first: what the slab will say, the floor in it (V2 §2) */
          sayEl = ui.el("p", "v"); sayEl.id = "swap-say"; det.append(sayEl);
          /* the rate from the two amounts themselves, in BigInt, both ways: out per one in, and in per one out */
          var inAmt = exactOut ? q : a, outAmt = exactOut ? a : q;
          ui.kv(det, "rate", "1 " + IN.sym + " ≈ " + approx(outAmt * (10n ** BigInt(IN.dec)) / inAmt, OUT.dec) + " " + OUT.sym + " · 1 " + OUT.sym + " ≈ " + approx(inAmt * (10n ** BigInt(OUT.dec)) / outAmt, IN.dec) + " " + IN.sym);
          var owned = ui.kv(det, "its own market", amt(q, quotedCoin.dec) + " " + quotedCoin.sym);
          owned.id = "swap-quote-owned"; owned.classList.add("quote"); owned.lastChild.dataset.raw = String(q);
          ui.kv(det, exactOut ? "pay at most" : "no less than", amt(pending.lim, quotedCoin.dec) + " " + quotedCoin.sym + (exactOut ? " — or nothing moves" : " — or nothing moves"));
          ui.kv(det, "fee", pct(M.fee) + " to whoever holds #" + ID + (M.snBps && M.snUntil > chainNow() ? ", plus the sniper fee while it runs" : ""));
          summary();
          var payCoin = IN, pay = exactOut ? pending.lim : a;
          if (go) {
            go.disabled = false;
            if (isEth(payCoin.addr)) go.textContent = label();
            else ui.read(payCoin.addr, "erc20.allowance", [ui.account(), locked() ? S.keepsake : S.pool]).then(function (al) {
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
        /* V2: the memory and the lock are refused in words before anything is asked of the chain */
        var mem = memText(), lock = locked(), t = lock && terms(P.q);
        if (mem === false) return;
        if (typeof t === "string") return ui.say(t, "err");
        var pay = exactOut ? P.lim : P.a, payCoin = IN;
        var steps = isEth(payCoin.addr) ? [] : [{ token: payCoin.addr, spender: lock ? S.keepsake : S.pool, amount: pay, symbol: payCoin.sym, decimals: payCoin.dec }];
        ui.approveExactThen(steps, function () {
          return ui.read(S.pool, exactOut ? "pool.quoteExactOut" : "pool.quote", [ID, baseIn, P.a]).then(function (r) {
            var q = r.w(0), slip = q * 50n / 10000n, lim = exactOut ? q + slip : q - slip, to = ui.account();
            if (exactOut && lim > pay) return ui.say("the price moved: it now asks " + amt(q, IN.dec) + " " + IN.sym + " — review again", "err"), quoteNow();
            /* at the press the market is asked once more: a floor the curve no longer meets is a sentence here, not a Slippage revert after the signature */
            var recheck = function () { return ui.read(S.pool, exactOut ? "pool.quoteExactOut" : "pool.quote", [ID, baseIn, P.a]).then(function (r) { return (exactOut ? r.w(0) > lim : r.w(0) < lim) ? "the price moved past the floor — review again" : null; }, function () { return "the market could not be re-quoted at the press — review again"; }); };
            return ui.clock().then(function (now) {
              var dl = now + 900n, value = isEth(payCoin.addr) ? (exactOut ? lim : P.a) : 0n;
              /*  V2: lock what arrives — Keepsake.swapAndWrap, the schedule from the chain's clock, the drip's
                  floor raw in the calldata and in words in the lines (a tuple: the shell draws no argument
                  rows, so every field is a line); the keepsake's id comes from the receipt's Wrapped log */
              if (lock) {
                t = terms(q); if (typeof t === "string") return ui.say(t, "err");
                var start = t.L ? now + t.L * 86400n : 0n, end = now + (t.L + t.F) * 86400n, info = { gift: t.to, start: start || now, end: end };
                return ui.propose({
                  to: S.keepsake, key: "keepsake.swapAndWrap", value: value, need: 0, spend: true, recheck: recheck,
                  args: [[ID, baseIn, P.a, lim, dl, [start, 0n, end], t.to || to, t.note, t.P ? [0n, ID, t.floor, t.most] : [0n, 0n, 0n, 0n]]],
                  lines: [["Token", "#" + ID], ["You pay", "exactly " + amt(P.a, IN.dec) + " " + IN.sym + (value ? ", sent as value" : ", pulled exactly by the Keepsake")],
                          ["About", amt(q, OUT.dec) + " " + OUT.sym], ["No less than", amt(lim, OUT.dec) + " " + OUT.sym + " — or nothing moves"],
                          ["Held as", "a keepsake, an NFT nothing opens early"],
                          ["Frees from", start ? date(start) : "now"], ["All free by", date(end) + (t.F ? ", along a straight line" : ", at once")],
                          t.to ? ["A gift to", t.to] : ["Kept by", "you, " + ui.short(to)], ["Message", t.note || "none"],
                          ["Sells", t.P ? "slowly as it frees: never below " + amt(t.P, IN.dec) + " " + IN.sym + " per " + OUT.sym + ", at most " + amt(t.most, OUT.dec) + " " + OUT.sym + " a sale, through #" + ID + "'s market; anyone may press it, and it pays only you" : "never by itself"],
                          ["Dies", "in fifteen minutes"]],
                  sentence: words({ a: P.a, lim: lim }, t) + ".",
                  then: function (r) { kept(r, info, mem); return after().then(offer(r.transactionHash)); }
                });
              }
              var lines = exactOut
                ? [["Token", "#" + ID], ["Receive exactly", amt(P.a, OUT.dec) + " " + OUT.sym], ["Costs about", amt(q, IN.dec) + " " + IN.sym],
                   ["Pay at most", amt(lim, IN.dec) + " " + IN.sym + " — or nothing moves"], ["To", ui.short(to)], ["Dies", "in fifteen minutes"]]
                : [["Token", "#" + ID], ["In", amt(P.a, IN.dec) + " " + IN.sym], ["Out", "about " + amt(q, OUT.dec) + " " + OUT.sym],
                   ["No less than", amt(lim, OUT.dec) + " " + OUT.sym + " — or nothing moves"], ["To", ui.short(to)], ["Dies", "in fifteen minutes"]];
              return ui.propose({
                to: S.pool, key: exactOut ? "pool.swapExactOut" : "pool.swapExactIn", args: [ID, baseIn, P.a, lim, to, dl], value: value, need: 0, spend: true, lines: lines,
                recheck: recheck,
                /* the card's one breath, through #ID's market, and the deadline */
                sentence: words({ a: P.a, lim: lim }) + "; it goes through #" + ID + "'s market and dies in fifteen minutes.",
                then: function (r) {
                  var f = kept(r, null, mem), wasExactOut = exactOut, spent = payCoin;
                  return syncClock().then(syncMarket).then(function (changed) {
                    if (changed || f) paint();
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
                  }).then(offer(r.transactionHash));
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
        /* V2: a lock goes through the token's own market; a memory follows this swap as it follows that one */
        if (LK.on && host.querySelector("#swap-lock-on")) return ui.say("a lock goes through #" + ID + "'s own market: turn it off to swap through the Router", "err");
        var mem = memText(); if (mem === false) return;
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
              then: function (r) { kept(r, null, mem); return after().then(offer(r.transactionHash)); }
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
        var fb = fld(box, verb + " " + Bc.sym, "0.0"), fq = fld(box, "and " + Qc.sym, "0.0");
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
        var fIn = fld(fee, "set it to, in bps (≤ 500)", String(M.fee)); fIn.name = "feeBps";
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
        var days = fld(sl, "seal for how many days (≤ 365)", "7");
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
      var oB = fld(f, "base coin (0x0 for ETH)", "0x…"), oQ = fld(f, "quote coin (0x0 for ETH)", "0x…");
      var oF = fld(f, "fee, in bps (≤ 500)", "30"); oF.name = "feeBps";
      var oC = fld(f, "curve, in bps (≤ 80000; 0 = constant product)", "0"); oC.name = "curveBps";
      var oS = fld(f, "sniper fee at open, in bps (≤ 9000)", "0"); oS.name = "sniperBps";
      var oT = fld(f, "sniper window, in seconds (≤ 5880)", "0"); oT.name = "sniperSeconds";
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
      ui.kv(f, "fee", pct(M.fee));
      ui.kv(f, "curve", M.curve + " bps");
      ui.kv(f, "seal", M.seal ? (M.seal > chainNow() ? "sealed until " : "lapsed ") + date(M.seal) : "none");
      clearTimeout(snT);
      if (M.snBps && M.snUntil > chainNow()) {
        var sn = ui.kv(f, "sniper fee", ""); sn.id = "swap-sniper";
        var tick = function () {
          var left = M.snUntil - chainNow();
          if (left <= 0) { sn.remove(); return; }
          sn.lastChild.textContent = M.snBps + " bps at open, falling to nothing — " + plain(left) + " left";
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
      memLive = false; sayEl = whyEl = datesEl = nowEl = drawLock = null;
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
