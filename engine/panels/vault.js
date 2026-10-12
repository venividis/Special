/*  INTACT panel "vault" — the token's two hands and everything delegated
    from them: the Reach (what it holds under the seal, the seal itself,
    a call or a batch from it, the open-approval ledger), the Grip (the
    hand that only holds), the sessions (a pasted key inspected, the grant
    log walked, a grant laid by hand, a key revoked), the Steward (the plan
    in words; arrange, heartbeat, cancel, summon, attest, execute), the
    sale (the checklist read live before transferFrom) and panic (two
    presses: the list from live reads, then one transaction). Injected as
    a Blob script after the shell keccak'd these bytes against
    window.INTACT.panels.vault. One IIFE, nothing at top level (terser
    mangles the shell's top level to one-letter names; a top-level const
    here would collide and the panel would never run — E §3.4; the build
    refuses one). Every text node through textContent. Every write through
    INTACT.ui.propose with a sentence naming the irreversible part.

    Origin: IPSEITY engine/console-lanes.js LANE[4] "THE VAULT" (branch
    claude/claude-md-docs-8vvyc8) — its three promises are kept: the
    approval ledger is read live and revoked in one press, the seal only
    ever lengthens and the page says so before the input, and the Grip
    warns before it offers any way in. Ported onto the panel contract
    (docs/CONSOLE.md §5, §7): window.CON became window.INTACT; mine()/
    onlyHolder() became ui.act/ui.gate on the rights bits; propose(title,
    lines, tx) became ui.propose with a sentence, lines and, for the
    tuples data() cannot build (grantSession's (address,uint128)[], the
    batch's (address,uint256,bytes)[]), bytes laid with ui.enc and every
    argument carried in the lines (CONSOLE §4.2 — no [data-arg] rows).

    What INTACT adds, and the lane encodes:
      · the Reach keeps no session list (D2): a key is inspected by
        sessionOf / sessionExposure / rightsOf's SESSION bit, and the set is
        the grant log walked in one eth_getLogs over the Reach, each key
        confirmed live by rightsOf; an endpoint that refuses the range is a
        sentence, "sessions: not counted" — never 0;
      · the sell-time checklist (CONSOLE §7) is read live before any
        transferFrom: each line names the read that proves it, a line with
        no row is printed as a category, and the recipient is classified
        first — this collection's own five addresses refused without a
        read, a 173-byte ERC-6551 forwarder decoded (its last word a token
        id, the word before it the hub) and refused when isCanonicalAccount
        says so, anything else proposed with the hub's own revert in the
        estimate;
      · panic is two presses: the first lists what one transaction
        revokes, from the same reads the checklist makes plus the
        categories that have no read; the guardian's list is different and
        says so; a token with nothing delegated still gets a sentence;
      · the composer's approve is laid with ui.data("erc20.approve") in
        base units, and the shell's propose refuses an inner amount ≥ 2^255
        exactly as an outer one — inside execute and inside a batch;
      · the seal input is a date, its min the live sealedUntil; the slab
        names the date; sealMax is the guardian's too;
      · the steward's words are wouldPass's eight codes; the heir hash is
        read from the Steward (heirHashOf / heirHashOfToken), never keccak'd
        here; stillHere is the holder's; summon, attest and execute render
        for any connected account only in the status that admits them, and
        the estimate names the Steward's refusal for anyone else.

    Reads with no answer print why ("not reported: …"), never a zero: a
    read whose reply has no words (an address with no code answers every
    eth_call with nothing) is no answer. Amounts are BigInt at full
    precision; dates in UTC; the clock is the chain's (ui.clock) for the
    grant's expiry and the panic list's seal date.

    Cut from this lane for the byte ceiling (8,192 B gzip, build-failing;
    measured 8,166 B with everything below in): guard/unguard (the manifest
    is read, never edited here), grantRecipe (an allowlist session is the
    one grant), stillHereUnderDuress, getWill/getObit prose (the status
    word and the controls it admits are the plan's whole surface here),
    the Grip's per-asset balances (its ether only; the manifest's assets
    are the Reach's), marketHash and the sealed markets' streams (categories
    in the checklist, not reads), the grant's minInterval and uses (sent
    as 0: unlimited uses at any interval), the pinned-face line of the
    revoked list (coreOf w1), and a live "sealed until" row (Home's fact
    carries the seal; the input's min is the live read).

    Elements this panel introduces (CONSOLE §6.2; the suite reads them
    scoped to #lane-vault):
      #vault-reach, #vault-holdings .row (ETH, then one per manifest asset: a measurement or
                                   "not measurable"), #vault-manifest
      #vault-seal-note, #vault-seal-until (input, min = the live sealedUntil; a date as
                                   YYYY-MM-DD HH:MM UTC), [data-act=seal|sealMax]
      #vault-execute (inputs name=to|value|data|spender|amount; a spender typed lays
                      approve(spender, amount) as the data at the press), [data-act=execute];
                      #vault-batch .row, #vault-batch-add, [data-act=executeBatch]
      #vault-approvals .row (.allowance[data-raw]), #vault-revoke-all ([data-act=revokeOpenApprovals])
      #vault-grip, #vault-grip-warning (before the address), #vault-grip-address, its QR
                      (svg[role=img]), #vault-grip-eth; the only buttons are .copy
      #vault-sessions .row (the live keys the walk found), #vault-session-key,
                      #vault-session-info, #vault-session-walk, #vault-session-count,
                      [data-sel] chips (inputs name=k|d|n|t|a|c), [data-act=grantSession|revokeSession|revokeAllSessions]
      #vault-steward, #vault-steward-status (nothing arranged · void (sold) · speaking · summonable ·
                      waiting · locked · bad hands · ready), inputs name=h|s|q|o|g|th (arrange),
                      sh|ss (summon), ad|an (attest), [data-act=arrange|stillHere|cancel|summon|attest|stewardExecute]
      #vault-sell (input name=to), #vault-checklist .revoked / .survives, [data-act=transfer]
      #vault-panic-box, #vault-locked ("locked: yes/no"), #vault-panic (.red), #vault-panic-list,
                      [data-act=panic|release]
    Of CONSOLE §6.2's vault row, [data-act=guard|unguard|grantRecipe] do not exist (cut above).
    Sentences the group proves (tools/verify-site/vault.mjs): "the vault
    lists open approvals and revokes in one press", "panic lists what it
    revokes", and the Reach's half of "every approval the slab builds is
    exact" (F10, owned by swap.mjs).                                       */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("vault"), R = S.rights, ID = BigInt(S.id), tok = "#" + ID, RCH = tok + "'s Reach", ZERO = "0x" + "0".repeat(40);
    var RE = S.reach, HUB = S.hub, ST = S.steward, GR = S.grip, E = ui.enc, GH = R.HOLD | R.GUARDIAN;
    var el = ui.el, kv = ui.kv, note = ui.note, act = ui.act, read = ui.read, say = ui.say, fmt = ui.fmt, short = ui.short, propose = ui.propose, clock = ui.clock, isAddr = ui.isAddr, cks = ui.checksum;
    var GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)", BATCH = "executeBatch((address,uint256,bytes)[])";
    /* the rows this panel calls and nothing else, by contract word; ui.rows holds every signature to the selector the chain baked */
    var M = {};
    [["reach", "execute(address,uint256,bytes,uint8)", BATCH, "seal(uint64)", "sealMax()", "revokeOpenApprovals()", GRANT, "revokeSession(address)", "revokeAllSessions()",
      "sessionOf(address)", "sessionExposure(address)", "openApprovals()", "holdings()", "pieces()", "sealedUntil()"],
     ["steward", "arrange(uint256,bytes32,uint64,uint64,address[],uint8)", "stillHere(uint256)", "cancel(uint256)", "summon(uint256,address,bytes32)", "attest(uint256,address,uint32)",
      "execute(uint256)", "wouldPass(uint256)", "heirHashOf(address,bytes32)", "heirHashOfToken(uint256,bytes32)"],
     ["hub", "panic(uint256)", "release(uint256)", "transferFrom(address,address,uint256)", "isCanonicalAccount(address,uint256,bool)", "coreOf(uint256)", "rightsOf(uint256,address)"],
     ["parley", "keyOf(uint256)"], ["postage", "inboxOf(uint256)"], ["launchpad", "firstLaunchApproved(uint256)", "launchesOf(uint256)"], ["pool", "marketOf(uint256)"], ["locks", "lockCountOf(address)"],
     ["erc20", "allowance(address,address)", "symbol()", "decimals()", "approve(address,uint256)"]
    ].forEach(function (r) { r.slice(1).forEach(function (s) { M[r[0] + "." + s.split("(")[0]] = s; }); });
    ui.rows(M);

    /*── words ──*/
    var lower = function (s) { return String(s).toLowerCase(); };
    var same = function (a, b) { return lower(a) === lower(b); };
    var eth = function (v) { return fmt(v, 18, 18) + " ETH"; };
    var amt = function (v, c) { return c.d == null ? v + " units of " + c.s : fmt(v, c.d, c.d) + " " + c.s; };
    var date = function (t) { return new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC"; };
    var unread = function (e) { return "not reported: " + (e && e.message || e); };
    var oops = function (e) { say(e && e.message || String(e), "err"); };
    var guard = function (f) { return function () { try { var r = f(); return r && r.catch ? r.catch(oops) : r; } catch (e) { oops(e); } }; };
    /* a reply with no words is no answer: an address with no code answers every eth_call with nothing */
    var rd = function (to, key, args) { return read(to, key, args).then(function (r) { if (!r.words.length) throw Error("no answer"); return r; }); };
    var fact = function (p) { return p.then(function (v) { return { v: v }; }, function (e) { return { e: unread(e) }; }); };
    var v = function (x, f) { return x.v ? f(x.v) : x.e; };
    var WORDS = ["nothing arranged", "void (sold)", "speaking", "summonable", "waiting", "locked", "bad hands", "ready"];
    var U32 = 4294967295n, gen = 0, batch = [], armed = null, armedP = false, can, hold, gd, cu, bits, seenBits, seenAcct;
    var fld = function (p, k, label, d) { var i = ui.field(p, label, d); i.value = d; i.name = k; return i; };
    var digits = function (i, max, what) { var s = i.value.trim(); if (!/^\d+$/.test(s) || BigInt(s) > max) throw Error(what + ": a whole number up to " + max); return BigInt(s); };
    /* one address, or a comma-separated list of them */
    var addr = function (i, what, many) { var xs = i.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean); if (!xs.every(isAddr) || !many && xs.length !== 1) throw Error(what + ": " + (many ? "addresses separated by commas" : "an address")); return many ? xs : xs[0]; };
    var b32 = function (i) { var s = i.value.trim(); if (!/^0x[0-9a-f]{1,64}$/i.test(s)) throw Error("the salt: 0x and up to 64 hex digits"); return "0x" + s.slice(2).padStart(64, "0"); };
    /* an heir is an address, or a token number (an instrument heir, whose holder the Steward resolves at the summons) */
    var heir = function (i) { var s = i.value.trim().replace(/^#/, ""); if (/^\d+$/.test(s)) return ["token #" + s, "0x" + BigInt(s).toString(16).padStart(40, "0"), BigInt(s)]; if (!isAddr(s)) throw Error("the heir: an address or a token number"); return [cks(s), s, null]; };
    /* one slab: the holder's by default, repainting after its receipt; o carries the rest */
    var send = function (to, key, args, lines, sentence, o) { return propose(Object.assign({ to: to, key: key, args: args, need: R.HOLD, lines: lines, sentence: sentence, then: paint }, o)); };
    var slot = function (p, k, id) { var n = kv(p, k, "reading…").lastChild; if (id) n.id = id; return n; };
    var bad = function (g, n) { return function (e) { if (g === gen) n.textContent = unread(e); }; };
    var line = function (p, t) { p.append(el("p", "s", t)); };
    var h3 = function (p, t) { p.append(el("h3", "", t)); return p; };
    var sect = function (id, title) { var b = el("div"); b.id = id; host.append(b); return h3(b, title); };
    var three = function (p, b, n) { if (S.reported & b) return 0; ui.chip(p, n + ": " + (S.absent & b ? "not deployed on this chain" : "could not be read at block " + S.block), S.absent & b ? "absent" : "unread"); return 1; };
    /* a coin's symbol and exponent; an exponent that did not answer stays null and the amount prints in units */
    var meta = function (a) { return Promise.all([rd(a, "erc20.symbol", []).then(function (x) { return x.s(0).slice(0, 32) || short(a); }, function () { return short(a); }),
      rd(a, "erc20.decimals", []).then(function (x) { var d = x.w(0); return d < 37n ? Number(d) : null; }, function () { return null; })]).then(function (m) { return { s: m[0], d: m[1] }; }); };
    var live = function (r) { return !!(r.w(0) & BigInt(R.SESSION)); };

    /*── the grant log, walked once over the Reach (D2): every key ever granted, kept only when rightsOf says
         its session is current; a refused range rejects, and the caller prints it as a fact, never as 0 ──*/
    var walk = function () {
      return ui.walkLogs({ address: RE, topics: [S.topics.sessionGranted], fromBlock: "0x0", toBlock: "latest" }).then(function (logs) {
        var ks = []; (logs || []).forEach(function (l) { var k = cks("0x" + l.topics[1].slice(26)); if (ks.indexOf(k) < 0) ks.push(k); });
        return Promise.all(ks.map(function (k) { return rd(HUB, "hub.rightsOf", [ID, k]).then(function (r) { return live(r) ? k : null; }); })).then(function (xs) { return xs.filter(Boolean); });
      });
    };
    /*── what a sale and a panic revoke, read live: the walk, the key binding, the inbox, the plan, the co-sign,
         and the hub's own word (coreOf); each line names the read that proves it, a category where no row exists ──*/
    var delegated = function () {
      return Promise.all([fact(walk()), fact(rd(S.parley, "parley.keyOf", [ID])), fact(rd(S.postage, "postage.inboxOf", [ID])), fact(rd(ST, "steward.wouldPass", [ID])),
        fact(rd(S.launchpad, "launchpad.firstLaunchApproved", [ID])), fact(rd(HUB, "hub.coreOf", [ID]))]);
    };
    var revoked = function (d) {
      var c = d[5], who = function (i) { return v(c, function (r) { return r.w(i) ? short(r.a(i)) : "none"; }); };
      return [
        "the single approval, if one stands · rightsOf(approvee) & CUSTODY",
        "the user: " + v(c, function (r) { return r.w(10) ? short(r.a(10)) + " until " + date(r.w(11)) : "none"; }) + " · coreOf w10, w11",
        "the guardian: " + who(6) + " · coreOf w6",
        "agent wallet and proposal: " + who(12) + ", " + who(13) + " · coreOf w12, w13",
        "income to the Grip: " + v(c, function (r) { return r.b(8) ? "yes" : "no"; }) + " · coreOf w8",
        "status → Paused · statusOf",
        "custody epoch " + v(c, function (r) { return r.w(3) + " → " + (r.w(3) + 1n); }) + " · custodyEpoch",
        "sessions: " + (d[0].v ? d[0].v.length : "not counted") + " — every session and recipe · the grant-log walk; each dies by its epoch",
        "key bound: " + v(d[1], function (r) { return r.w(1) ? "yes" : "no"; }) + " · keyOf",
        "inbox price: " + v(d[2], function (r) { return (same(r.a(0), ZERO) ? eth(r.w(1)) : r.w(1) + " units of " + short(r.a(0))) + (r.b(3) ? "" : ", closed"); }) + " · inboxOf",
        "steward plan: " + v(d[3], function (r) { return WORDS[Number(r.w(0))] || String(r.w(0)); }) + " · wouldPass",
        "first-launch approval: " + v(d[4], function (r) { return r.b(0) ? "yes" : "no"; }) + " · firstLaunchApproved"
      ];
    };

    /*═══════════ the Reach: holdings, the seal, the composer and the batch, the ledger ═══════════*/
    function reach(g) {
      var b = sect("vault-reach", "the Reach");
      var hd = el("div"), mf = el("p", "s"); hd.id = "vault-holdings"; mf.id = "vault-manifest"; b.append(hd, mf);
      rd(RE, "reach.holdings", []).then(function (r) {
        if (g !== gen) return;
        var as = r.arr(1, "address"), bs = r.arr(2), ms = r.arr(3, "bool"), r0 = el("div", "row"); hd.append(r0); kv(r0, "ETH", eth(r.w(0)));
        mf.textContent = "manifest: " + (as.length ? as.length + " guarded asset(s)" : "nothing guarded");
        as.forEach(function (a, i) {
          var rw = el("div", "row"), x = kv(rw, short(a), "reading…").lastChild; hd.append(rw);
          meta(a).then(function (c) { rw.firstChild.firstChild.textContent = c.s + " " + short(a); x.textContent = ms[i] ? amt(bs[i], c) : "not measurable"; });
        });
      }, bad(g, mf));
      /* the seal: a date, never shorter than the live sealedUntil; the note before the input */
      var sl = h3(el("div"), "the seal"); b.append(sl);
      note(sl, "nothing leaves a sealed Reach until the seal lapses; it only ever lengthens, at most 365 days from now, and it survives sale").id = "vault-seal-note";
      var cur = BigInt(S.clocks && S.clocks.sealedUntil || 0), si = null;
      rd(RE, "reach.sealedUntil", []).then(function (r) { if (g === gen) { cur = r.w(0); if (si) si.min = String(cur); } }, function () {});
      if (hold) {
        si = fld(sl, "seal", "seal until, as YYYY-MM-DD HH:MM UTC", ""); si.id = "vault-seal-until"; si.min = String(cur);
        act(sl, "seal", "review the seal", R.HOLD, guard(function () {
          var m = si.value.trim().match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d) UTC$/); if (!m) throw Error("a date as YYYY-MM-DD HH:MM UTC");
          var u = BigInt(Math.floor(Date.parse(m[1] + "T" + m[2] + "Z") / 1e3)); if (u <= cur) throw Error("a seal only ever lengthens");
          return send(RE, "reach.seal", [u], [["Until", date(u)]], "seals " + RCH + " until " + date(u) + ": nothing leaves it until then; it only ever lengthens");
        }));
      }
      if (gd) act(sl, "sealMax", "seal a full year", GH, function () { return send(RE, "reach.sealMax", [], [], "seals " + RCH + " for 365 days from the block it lands in", { need: GH }); });
      if (hold) composer(b);
      ledger(b, g);
    }
    /* the composer: operation 0 only; the approve laid as data in base units, so the word in the slab is the word typed */
    function composer(b) {
      var x = h3(el("div"), "execute"); x.id = "vault-execute"; b.append(x);
      note(x, "operation 0 only. An approve laid here is exact: 2^255 and above is refused, in a call or in a batch.");
      var ti = fld(x, "to", "to, an address", ""), vi = fld(x, "value", "value, in ETH", "0"), di = fld(x, "data", "data, hex (0x for none)", "0x"), pi = fld(x, "spender", "or lay an approve: the spender", ""), ai = fld(x, "amount", "and the amount, in base units of the coin at `to`", "");
      /* a spender typed lays approve(spender, amount) as the data, at the press */
      var call = function () { var d = pi.value.trim() ? ui.data("erc20.approve", [addr(pi, "the spender"), digits(ai, 2n ** 256n - 1n, "the amount")]) : di.value.trim() || "0x"; if (!/^0x([0-9a-f]{2})*$/i.test(d)) throw Error("data: hex bytes"); return { to: addr(ti, "to"), value: ui.parse(vi.value || "0", 18), data: d }; };
      var one = function (c) { return cks(c.to) + " · " + eth(c.value) + " · " + (c.data.length - 2) / 2 + " bytes" + (c.data.length > 10 ? " · " + c.data.slice(0, 10) : ""); };
      act(x, "execute", "review the call", R.HOLD, guard(function () { var c = call(); return send(RE, "reach.execute", [c.to, c.value, c.data, 0n], [["Call", one(c)]], "calls " + one(c) + " from " + RCH, { spend: true }); }), { spend: true });
      var bt = h3(el("div"), "batch"), ls = el("div"); bt.id = "vault-batch"; x.append(bt); bt.append(ls);
      var show = function () { ls.replaceChildren(); batch.forEach(function (c, i) { kv(ls, "call " + (i + 1), one(c)).classList.add("row"); }); };
      show();
      ui.button(bt, "add this call to the batch", true, guard(function () { batch.push(call()); show(); })).id = "vault-batch-add";
      act(bt, "executeBatch", "review the batch", R.HOLD, guard(function () {
        if (!batch.length) throw Error("an empty batch is refused");
        var tups = batch.map(function (c) { return E.A(c.to) + E.W(c.value) + E.W(96) + E.bytes(c.data); }), offs = "", o = 32 * batch.length;
        tups.forEach(function (t) { offs += E.W(o); o += t.length / 2; });
        return propose({ to: RE, data: S.sel["reach.executeBatch"] + E.W(32) + E.W(batch.length) + offs + tups.join(""), sig: BATCH, need: R.HOLD, spend: true,
          lines: batch.map(function (c, i) { return ["Call " + (i + 1), one(c)]; }), sentence: "makes " + batch.length + " call(s) from " + RCH + " as one act, or none of them", then: function () { batch = []; paint(); } });
      }), { spend: true });
    }
    /* the ledger: every approval the Reach recorded and has not zeroed, its allowance read live */
    function ledger(b, g) {
      var lg = h3(el("div"), "open approvals"), ls = el("div"); lg.id = "vault-approvals"; b.append(lg); lg.append(ls);
      rd(RE, "reach.openApprovals", []).then(function (r) {
        if (g !== gen) return;
        var xs = r.arr(0, "(address,address)");
        if (!xs.length) return note(ls, "nothing may leave: no approval stands");
        xs.forEach(function (x) {
          var rw = el("div", "row"), n = kv(rw, short(x[0]) + " → " + short(x[1]), "reading…").lastChild; ls.append(rw); n.classList.add("allowance");
          Promise.all([meta(x[0]), rd(x[0], "erc20.allowance", [RE, x[1]])]).then(function (y) { rw.firstChild.firstChild.textContent = y[0].s + " → " + short(x[1]); n.dataset.raw = String(y[1].w(0)); n.textContent = amt(y[1].w(0), y[0]); }, bad(g, n));
        });
        /* drawn only while the rights stand: a receipt's facts() fires intact:epoch before rights() re-reads, and in that window act draws nothing */
        var rb = gd && act(lg, "revokeOpenApprovals", "revoke all", GH, function () { return send(RE, "reach.revokeOpenApprovals", [], [], "zeroes every approval " + RCH + " has recorded, in one transaction", { need: GH }); });
        if (rb) rb.id = "vault-revoke-all";
      }, bad(g, ls));
    }

    /*═══════════ the Grip: the warning before the address ═══════════*/
    function grip(g) {
      var b = sect("vault-grip", "the Grip"), a = el("p", "v", cks(GR));
      note(b, "the hand that only holds: nothing can ever leave it, by no function, key, holder or sale; what goes in is permanent", "warn").id = "vault-grip-warning";
      a.id = "vault-grip-address"; b.append(a);
      try { b.append(ui.qr("ethereum:" + GR + "@" + S.chainId)); } catch (e) {}
      ui.button(b, "copy", true, function () { navigator.clipboard.writeText(GR).then(function () { say("copied", "ok"); }, oops); }).classList.add("copy");
      var bal = slot(b, "ETH", "vault-grip-eth");
      ui.request("eth_getBalance", [GR, "latest"]).then(function (h) { if (g === gen) bal.textContent = eth(BigInt(h)); }, bad(g, bal));
    }

    /*═══════════ sessions: a key inspected, the log walked, a grant laid by hand ═══════════*/
    function sessions(g) {
      var b = sect("vault-sessions", "sessions");
      note(b, "the Reach keeps no list of its keys: the grant log is walked, and each key is confirmed by the hub");
      var ki = ui.field(b, "inspect a key", "0x…"), info = slot(b, "key", "vault-session-info"); ki.id = "vault-session-key"; info.textContent = "";
      ki.addEventListener("input", function () {
        var k = ki.value.trim(); if (!isAddr(k)) return info.textContent = "";
        info.textContent = "reading…";
        Promise.all([rd(RE, "reach.sessionOf", [k]), rd(RE, "reach.sessionExposure", [k]), rd(HUB, "hub.rightsOf", [ID, k])]).then(function (r) {
          if (ki.value.trim() !== k) return;
          var s = r[0].w, x = r[1];
          info.textContent = (s(0) ? "recipe" : "allowlist") + " · expires " + date(s(1)) + " · epoch " + s(2) + " · native cap " + eth(s(3)) + ", spent " + eth(s(4)) + " · exposure " + eth(x.w(0)) + " + " + x.arr(1, "(address,uint128)").length + " asset cap(s) · " + (live(r[2]) ? "live" : "dead at this epoch");
        }, function (e) { info.textContent = unread(e); });
      });
      var cnt = el("p", "s"), ls = el("div"); cnt.id = "vault-session-count";
      ui.button(b, "walk the grant log", true, function () {
        cnt.textContent = "reading…"; ls.replaceChildren();
        walk().then(function (ks) {
          if (g !== gen) return;
          cnt.textContent = "sessions: " + ks.length;
          ks.forEach(function (k) {
            var rw = el("div", "row"); ls.append(rw); kv(rw, "key", k);
            if (gd) act(rw, "revokeSession", "revoke", GH, function () { return send(RE, "reach.revokeSession", [k], [], "revokes session key " + k + " on " + RCH + " at once", { need: GH }); });
          });
        }, function (e) { if (g === gen) cnt.textContent = "the grant log could not be walked on this endpoint: " + (e && e.message); });
      }).id = "vault-session-walk";
      b.append(cnt, ls);
      if (gd) act(b, "revokeAllSessions", "revoke every key", GH, function () { return send(RE, "reach.revokeAllSessions", [], [], "revokes every session and recipe on " + RCH + " at once", { need: GH }); });
      if (hold) grant(b);
    }
    /* the grant: selectors are INTACT.sel entries, never typed hex; the tuple laid by hand, every argument a line, the exposure before Sign */
    function grant(b) {
      var f = h3(el("div"), "grant a session"), chips = el("div"); b.append(f);
      var fk = fld(f, "k", "key, an address", ""), fd = fld(f, "d", "expires, days from now (1 to 365)", "1"), fn = fld(f, "n", "native cap, in ETH (0 for none)", "0"), ft = fld(f, "t", "targets, addresses separated by commas", ""),
          fa = fld(f, "a", "asset cap: a coin's address (empty for none)", ""), fc = fld(f, "c", "its cap, in base units", "0");
      f.append(el("div", "k", "selectors the key may call"), chips);
      ["pool.swapExactIn", "pool.swapExactOut", "pool.deposit", "pool.collect", "launchpad.buy", "erc20.approve"].forEach(function (k) {
        if (!(k in S.sel)) return;
        var c = el("button", "chip", k); c.type = "button"; c.dataset.sel = S.sel[k]; c.addEventListener("click", function () { c.classList.toggle("on"); }); chips.append(c);
      });
      act(f, "grantSession", "review the grant", R.HOLD, guard(function () {
        var key = addr(fk, "the key"), dd = digits(fd, 365n, "the days"), cap = ui.parse(fn.value || "0", 18), ts = addr(ft, "targets", 1);
        var sels = [].slice.call(chips.querySelectorAll(".on")).map(function (c) { return [c.textContent, c.dataset.sel]; }), caps = fa.value.trim() ? [[addr(fa, "the asset"), digits(fc, 2n ** 128n - 1n, "the cap")]] : [];
        if (!dd) throw Error("the days: at least one");
        return clock().then(function (now) {
          var exp = now + dd * 86400n, A = E.W(caps.length) + caps.map(function (c) { return E.A(c[0]) + E.W(c[1]); }).join(""), T = E.W(ts.length) + ts.map(E.A).join(""), L = E.W(sels.length) + sels.map(function (s) { return E.B4(s[1]); }).join("");
          var o2 = 256 + A.length / 2, o3 = o2 + T.length / 2, x = "native cap " + eth(cap) + (caps.length ? ", " + caps[0][1] + " base units of " + short(cks(caps[0][0])) : ", no asset cap");
          return propose({ to: RE, data: S.sel["reach.grantSession"] + E.A(key) + E.W(exp) + E.W(cap) + E.W(256) + E.W(o2) + E.W(o3) + E.W(0) + E.W(0) + A + T + L, sig: GRANT, need: R.HOLD, spend: true,
            lines: [["Key", cks(key)], ["Expires", date(exp)], ["Targets", ts.length ? ts.map(function (t) { return short(cks(t)); }).join(", ") : "none"], ["Selectors", sels.length ? sels.map(function (s) { return s[0] + " " + s[1]; }).join(", ") : "none"],
                    ["Exposure", x + "; the worst case"]],
            sentence: "lets " + cks(key) + " act through " + RCH + " until " + date(exp) + " on the targets and selectors above, exposing at most " + x, then: paint });
        });
      }), { spend: true });
    }

    /*═══════════ the Steward: the plan in words, and the controls its status admits ═══════════*/
    function steward(g) {
      var b = sect("vault-steward", "the steward");
      if (three(b, S.bits.steward, "steward")) return;
      var st = slot(b, "plan", "vault-steward-status");
      rd(ST, "steward.wouldPass", [ID]).then(function (r) {
        if (g !== gen) return;
        var s = Number(r.w(0)); st.textContent = WORDS[s];
        if (!can) return;
        if (hold) {
          if (s > 1 && s < 5) act(b, "stillHere", "still here: a sign of life", R.HOLD, function () { return send(ST, "steward.stillHere", [ID], [], "says " + tok + "'s holder is still here: the quiet starts over, any notice ends"); });
          if (s === 4) act(b, "cancel", "cancel the notice", R.HOLD, function () { return send(ST, "steward.cancel", [ID], [], "cancels the notice running on " + tok); });
          arrange(b);
        }
        if (s === 3) {
          var sm = el("div"), hi = fld(sm, "sh", "summon: the heir, an address or a token number", ""), si = fld(sm, "ss", "and the salt", ""); b.append(sm);
          act(sm, "summon", "summon the heir", 0, guard(function () { var h = heir(hi); return send(ST, "steward.summon", [ID, h[1], b32(si)], [["Heir", h[0]]], "summons " + tok + "'s heir " + h[0] + ": the notice starts; only the holder may cancel it", { need: 0 }); }));
        }
        if (s === 2 || s === 3) {
          var at = el("div"), di = fld(at, "ad", "attest: the destination, an address", ""), ni = fld(at, "an", "and the plan's nonce", ""); b.append(at);
          act(at, "attest", "attest as a named guardian", 0, guard(function () { var d = addr(di, "the destination"); return send(ST, "steward.attest", [ID, d, digits(ni, U32, "the nonce")], [], "attests, as a named guardian, that " + tok + " should go to " + cks(d), { need: 0 }); }));
        }
        if (s === 7) act(b, "stewardExecute", "hand it over", 0, function () { return send(ST, "steward.execute", [ID], [], "hands " + tok + " to its resolved heir; the plan is spent", { need: 0 }); });
      }, bad(g, st));
    }
    function arrange(b) {
      var f = h3(el("div"), "arrange"); b.append(f);
      var hi = fld(f, "h", "the heir, an address or a token number", ""), si = fld(f, "s", "the salt, 0x and up to 64 hex digits", ""), qi = fld(f, "q", "quiet, days (30 to 3650)", "30"),
          ni = fld(f, "o", "notice, days (14 to 365)", "14"), gi = fld(f, "g", "guardians, addresses (none, or 2 to 5)", ""), ti = fld(f, "th", "their threshold (0 without any)", "0");
      act(f, "arrange", "review the plan", R.HOLD, guard(function () {
        var h = heir(hi), salt = b32(si), q = digits(qi, 3650n, "the quiet"), n = digits(ni, 365n, "the notice"), gs = gi.value.trim() ? addr(gi, "guardians", 1) : [], th = digits(ti, 5n, "the threshold");
        /* the heir hash is the Steward's own: no keccak of the heir is taken here */
        return (h[2] == null ? rd(ST, "steward.heirHashOf", [h[1], salt]) : rd(ST, "steward.heirHashOfToken", [h[2], salt])).then(function (r) {
          var hh = r.raw.slice(0, 66);
          return send(ST, "steward.arrange", [ID, hh, q * 86400n, n * 86400n, gs, th], [["Heir", h[0] + ", hashed with the salt"], ["Heir hash", hh]],
            "arranges " + tok + "'s succession: " + q + " quiet days, then a summons, then " + n + " days' notice; a sale voids it");
        });
      }));
    }

    /*═══════════ the sale: the recipient classified, the checklist read live, then transferFrom ═══════════*/
    function sell(g) {
      var b = sect("vault-sell", "sell"), cl = el("div"); cl.id = "vault-checklist";
      if (cu) {
        var ti = fld(b, "to", "to, an address", ""), btn = act(b, "transfer", "review the sale", R.HOLD | R.CUSTODY, guard(function () {
          var t = addr(ti, "the recipient"), NO = "no Intact can sit inside another Intact's accounts: " + short(cks(t)) + " is ";
          if ([HUB, RE, GR, S.reachImpl, S.gripImpl].some(function (x) { return same(x, t); })) throw Error(NO + "this collection's own");
          if (armed === lower(t)) return rd(HUB, "hub.rightsOf", [ID, ui.account()]).then(function (r) {
            return send(HUB, "hub.transferFrom", [r.a(2), t, ID], [], "transfers " + tok + " from " + r.a(2) + " to " + cks(t) + ": every delegated right dies and nothing comes back", { need: R.HOLD | R.CUSTODY, spend: true });
          });
          /* a 173-byte code is an ERC-6551 forwarder: its last word a token id, the word before it the hub */
          return ui.request("eth_getCode", [t, "latest"]).then(function (code) {
            if (code.length !== 348 || !same("0x" + code.slice(-104, -64), HUB)) return;
            var k = BigInt("0x" + code.slice(-64));
            return Promise.all([rd(HUB, "hub.isCanonicalAccount", [t, k, false]), rd(HUB, "hub.isCanonicalAccount", [t, k, true])]).then(function (r) { if (r[0].b(0) || r[1].b(0)) throw Error(NO + "#" + k + "'s"); });
          }).then(function () { return checklist(cl, g); }).then(function () { if (g === gen) { armed = lower(t); btn.textContent = "transfer " + tok + " to " + short(cks(t)) + " now"; } });
        }), { spend: true });
      }
      b.append(cl);
    }
    function checklist(cl, g) {
      var rv = h3(el("div", "revoked"), "revoked by the sale"), sv = h3(el("div", "survives"), "survives for the buyer"); cl.replaceChildren(rv, sv);
      return Promise.all([delegated(), fact(rd(RE, "reach.sealedUntil", [])), fact(rd(RE, "reach.holdings", [])), fact(rd(RE, "reach.pieces", [])), fact(rd(S.pool, "pool.marketOf", [ID])), fact(rd(S.locks, "locks.lockCountOf", [RE])),
        fact(ui.request("eth_getBalance", [GR, "latest"])), fact(rd(RE, "reach.openApprovals", [])), fact(rd(S.launchpad, "launchpad.launchesOf", [ID]))]).then(function (d) {
        if (g !== gen) return;
        revoked(d[0]).forEach(function (t) { line(rv, t); });
        line(rv, "not revoked: your operator approvals, per owner, not per token");
        [
          "the Reach's seal: " + v(d[1], function (r) { return r.w(0) ? "sealed until " + date(r.w(0)) : "none"; }) + " · sealedUntil",
          "manifest, pieces: " + v(d[2], function (r) { return r.arr(1, "address").length + " asset(s)"; }) + ", " + v(d[3], function (r) { return r.arr(0, "(address,uint256)").length + " piece(s)"; }) + " · holdings, pieces",
          "the owned market: " + v(d[4], function (r) { return r.b(7) ? "open · reserves " + r.w(2) + " / " + r.w(3) + " · fee " + r.w(4) + " bps · curve " + r.w(10) + " bps · " + (r.w(9) ? "sealed until " + date(r.w(9)) : "no seal") : "closed"; }) + " · marketOf",
          "sealed markets' fee streams: paid to " + tok + "'s fee sink · marketOf w15",
          "locks for the Reach: " + v(d[5], function (r) { return String(r.w(0)); }) + " · lockCountOf",
          "the Grip's contents: " + v(d[6], function (h) { return eth(BigInt(h)); }) + " · eth_getBalance",
          "the archive and the home room · stateOf",
          "traits: " + v(d[0][5], function (r) { return "curve " + (r.w(14) & 131071n) + " bps · name hash " + r.words[15].slice(0, 8) + "…"; }) + " · coreOf w14, w15",
          "open approvals: " + v(d[7], function (r) { return String(r.arr(0, "(address,address)").length); }) + ", the buyer's to revoke · openApprovals",
          "launches: " + v(d[8], function (r) { return String(r.arr(0).length); }) + " · launchesOf"
        ].forEach(function (t) { line(sv, t); });
        note(cl, "nothing the previous holder delegated comes along.");
      });
    }

    /*═══════════ panic: the hold, the list from live reads, then one transaction ═══════════*/
    function panic(g) {
      var b = sect("vault-panic-box", "panic"), lk = slot(b, "locked: ", "vault-locked"), ls = el("div"); ls.id = "vault-panic-list";
      rd(HUB, "hub.coreOf", [ID]).then(function (r) {
        if (g !== gen) return;
        var held = r.b(7); lk.textContent = r.w(2) || held ? "yes" + (held ? " — a guardian's hold; only the holder in person may move or release it" : " — a module's lock") : "no";
        if (held && hold) act(b, "release", "release the hold", R.HOLD, function () { return send(HUB, "hub.release", [ID], [], "lifts the guardian's hold on " + tok + "; the guardian stays appointed"); });
      }, bad(g, lk));
      var btn = gd && act(b, "panic", "panic: what it revokes", GH, guard(function () {
        if (armedP) return send(HUB, "hub.panic", [ID], [], "kills every delegated right on " + tok + " in one transaction, as listed above: the epoch moves, the token pauses, the Reach seals for a year", { need: GH });
        ls.replaceChildren(); note(ls, "reading…");
        return Promise.all([delegated(), clock().then(function (t) { return date(t + 31536000n); }, function () { return "the maximum, 365 days from the block it lands in"; })]).then(function (x) {
          if (g !== gen) return;
          var d = x[0], w = d[5].v && d[5].v.w, out = revoked(d).concat(["seal → " + x[1] + " · sealedUntil; sealMax", hold ? "every operator approval on every token you hold · approvalEpoch" : "does not touch the holder's operators; guardian hold: only the holder in person may move or release it"]);
          if (d[0].v && !d[0].v.length && d[1].v && !d[1].v.w(1) && d[2].v && !d[2].v.w(1) && d[3].v && !d[3].v.w(0) && d[4].v && !d[4].v.b(0) && w && !w(10) && !w(12) && !w(13)) out.push("nothing is delegated; panic still moves the epoch and seals the Reach");
          ls.replaceChildren(); out.forEach(function (t) { line(ls, t); });
          armedP = true; btn.textContent = "panic now: one transaction";
        });
      }));
      if (btn) { btn.id = "vault-panic"; btn.classList.add("red"); }
      b.append(ls);
    }

    /*═══════════ paint ═══════════*/
    function paint() {
      var g = ++gen; host.replaceChildren(); armed = null; armedP = false; batch = [];
      if (!ID) return note(host, "the vault is a token's: open one to see its Reach, its Grip, its sessions, its steward and the sale checklist"), S.loaded.vault = true;
      bits = seenBits = ui.rights(); seenAcct = ui.account();
      /*  one sentence when nobody here can press anything, and none per control: unread rights are not a
          stranger's, so even the anyone-controls wait for a rights read that answered */
      can = ui.gate(host, bits === null ? R.HOLD : 0); hold = !!(can && bits & R.HOLD); gd = !!(can && bits & GH); cu = !!(can && bits & (R.HOLD | R.CUSTODY));
      if (can && !gd && !cu) ui.gate(host, R.HOLD);
      reach(g); grip(g); sessions(g); steward(g); sell(g); panic(g);
      S.loaded.vault = true;
    }
    paint();
    /* the same bits for the same account is not a reason to repaint under a person's hands: a receipt's own then() repaints */
    window.addEventListener("intact:rights", function (e) { var d = e.detail || {}; if (d.bits !== seenBits || d.account !== seenAcct) paint(); });
    window.addEventListener("intact:epoch", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "vault") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
