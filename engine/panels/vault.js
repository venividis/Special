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
    argument carried in the lines (CONSOLE §4.2; since W14 the slab also
    draws each tuple's row, decoded from the calldata).

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

    V2 (W10, docs/V2.md §3.1, docs/v2/W10-vault.md): KEEPSAKES, the first
    section, where the Keepsake reports (S.bits.keepsake by S.reported /
    S.absent; elsewhere the §6.3 chip and not one read of the codeless
    address). A keepsake is coins locked together under one schedule,
    kept or given, freed slowly, optionally sold slowly:
      · found from the Keepsake's Transfer logs to the connected wallet and
        to this token's Reach, in one eth_getLogs (topic 2 an "any of"
        list), each id kept while ownerOf still names one of the two; a
        refused range is a sentence, never an empty list;
      · drawn as its orb (its own tokenURI image, accepted only as a base64
        data:image/svg+xml), its coins (symbol and decimals read live; what
        each still holds), the schedule as a bar and "<n> % free · fully
        free on <date>" on the chain's clock (ui.clock), what a claim pays
        now (claimable), its slow sale in words ("sells slowly, never below
        P OUT per IN"), its note;
      · claim is anyone's and says whom it pays; lengthen (only ever
        later: a non-positive count is refused in words), the slow sale set
        in human terms (P OUT per IN is P × 10^decOut × 1e18 / 10^decIn,
        rounded up) or stopped, give ("the keepsake and everything in it
        becomes theirs") and a memory into its own journal are the
        holder's: its wallet directly, or this token's Reach through
        execute (HOLD, and [data-spend] as every execute is);
      · made from the page: ETH and up to seven coins by address, "locked
        for N days, then freed over M days", for you or a gift to an
        address with a note of at most 280 bytes, a slow sale only on one
        you keep; ui.approveExactThen lays each coin's exact approval
        first, then wrap with value the ETH to the wei; the new number is
        read from the receipt's Wrapped log, never from a read after it.
    No row serves tokenURI(uint256): its calldata is laid by hand
    (0xc87b56dd) and sent through ui.request's eth_call; ownerOf is the
    hub's ownerOf(uint256) row, the same ERC-721 selector, read at the
    Keepsake. The Grip's copy button no longer throws in a data: frame
    (navigator.clipboard is undefined there): it says copying is not
    available. Every field carries its label as its accessible name.

    Cut from this lane for the byte ceiling (8,192 B gzip in V1, build-
    failing; measured 8,166 B with everything below in; V2's ceiling is
    12,288 B and W10 measured 12,209 B with the keepsakes in): guard/unguard (the manifest
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
      #vault-keepsakes (V2: the section; its .chip[data-state=absent|unread] "keepsake: …" where the Keepsake does
                      not report), #vault-keepsakes-status ("<n> held by this wallet or #<id>'s Reach" / "none held
                      by … yet" / "the keepsakes could not be found on this endpoint: …"),
                      #vault-keepsakes-list .keepsake[data-id=<id>] (img the orb, p.k, p.s "made by … · held by …" or
                      "a gift from … · held by …", p.note, .kv per coin, progress[value] (aria-hidden), p.free,
                      p.claimable, p.drip, [data-act=claim]; the holder's details: "lengthen it" input name=more
                      [data-act=extend], "sell it slowly as it frees" inputs name=dsell|dmkt|dfloor|dmax
                      [data-act=setDrip|clearDrip], "give it" input name=give [data-act=give], "write a memory
                      into it" input name=memory [data-act=inscribe], or the journal's chip)
      #vault-make (inputs name=eth, .coin rows of name=token|amount with p.s "<SYM> · <d> decimals", name=lock|over|to|note,
                      a details of name=dsell|dmkt|dfloor|dmax), #vault-make-add, [data-act=wrap], #vault-keepsake-made
                      ("keepsake #<id> is made[, a gift to 0x… … ] · its number from the Wrapped log")
      [data-spend] on wrap, give, and every change of a keepsake the Reach holds
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
    exact" (F10, owned by swap.mjs). V2 adds the V0–V6 blocks there (on a
    deploySite({ v2: true }) chain) and the keepsake journey in
    tools/verify-console.mjs's vault group; docs/v2/W10-vault.md lists
    every sentence and the rows they propose.                              */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("vault"), R = S.rights, ID = BigInt(S.id), tok = "#" + ID, RCH = tok + "'s Reach", ZERO = "0x" + "0".repeat(40);
    var RE = S.reach, HUB = S.hub, ST = S.steward, GR = S.grip, E = ui.enc, GH = R.HOLD | R.GUARDIAN;
    var el = ui.el, kv = ui.kv, note = ui.note, act = ui.act, read = ui.read, say = ui.say, fmt = ui.fmt, short = ui.short, propose = ui.propose, clock = ui.clock, isAddr = ui.isAddr, cks = ui.checksum;
    var GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)", BATCH = "executeBatch((address,uint256,bytes)[])";
    /* the rows this panel calls and nothing else, by contract word; ui.rows holds every signature to the selector the chain baked */
    var decl = function (L) { var M = {}; L.forEach(function (r) { r.slice(1).forEach(function (s) { M[r[0] + "." + s.split("(")[0]] = s; }); }); ui.rows(M); };
    decl([["reach", "execute(address,uint256,bytes,uint8)", BATCH, "seal(uint64)", "sealMax()", "revokeOpenApprovals()", GRANT, "revokeSession(address)", "revokeAllSessions()",
      "sessionOf(address)", "sessionExposure(address)", "openApprovals()", "holdings()", "pieces()", "sealedUntil()"],
     ["steward", "arrange(uint256,bytes32,uint64,uint64,address[],uint8)", "stillHere(uint256)", "cancel(uint256)", "summon(uint256,address,bytes32)", "attest(uint256,address,uint32)",
      "execute(uint256)", "wouldPass(uint256)", "heirHashOf(address,bytes32)", "heirHashOfToken(uint256,bytes32)"],
     ["hub", "panic(uint256)", "release(uint256)", "transferFrom(address,address,uint256)", "isCanonicalAccount(address,uint256,bool)", "coreOf(uint256)", "rightsOf(uint256,address)"],
     ["parley", "keyOf(uint256)"], ["postage", "inboxOf(uint256)"], ["launchpad", "firstLaunchApproved(uint256)", "launchesOf(uint256)"], ["pool", "marketOf(uint256)"], ["locks", "lockCountOf(address)"],
     ["erc20", "allowance(address,address)", "symbol()", "decimals()", "approve(address,uint256)"]
    ]);
    /* V2: the Keepsake's rows, and the Journal's for a keepsake's own memories, are declared only where each reports,
       so a band whose Catalog predates them still opens this lane. No keepsake.ownerOf or keepsake.tokenURI row is
       served: ownerOf is the hub's ERC-721 row (the same selector, held to the chain's by ui.rows) read at the Keepsake */
    var KS = S.keepsake, KB = S.bits.keepsake, JB = S.bits.journal, DT = "(uint8,uint256,uint256,uint256)", ETH = { s: "ETH", d: 18 }, made = "";
    if (S.reported & KB) decl([["keepsake", "wrap(((address,uint256)[],(uint64,uint64,uint64),address,string," + DT + "))", "claim(uint256)", "claimable(uint256)", "extend(uint256,uint64)",
      "setDrip(uint256," + DT + ")", "clearDrip(uint256)", "transferFrom(address,address,uint256)", "keepsakeOf(uint256)"], ["hub", "ownerOf(uint256)"]].concat(S.reported & JB ? [["journal", "inscribe(address,uint256,uint8,bytes,bytes32)"]] : []));

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
    /* the label is also the input's accessible name: ui.field draws it as text beside the box, not as a <label> */
    var fld = function (p, k, label, d) { var i = ui.field(p, label, d); i.value = d; i.name = k; i.setAttribute("aria-label", label); return i; };
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
      /* a data: frame is no secure context: navigator.clipboard is undefined there (W7's observation), so it is said, not thrown */
      ui.button(b, "copy", true, function () { var c = navigator.clipboard; c ? c.writeText(GR).then(function () { say("copied", "ok"); }, oops) : say("copying is not available in this frame; select the address above to copy it", "err"); }).classList.add("copy");
      var bal = slot(b, "ETH", "vault-grip-eth");
      ui.request("eth_getBalance", [GR, "latest"]).then(function (h) { if (g === gen) bal.textContent = eth(BigInt(h)); }, bad(g, bal));
    }

    /*═══════════ sessions: a key inspected, the log walked, a grant laid by hand ═══════════*/
    function sessions(g) {
      var b = sect("vault-sessions", "sessions");
      note(b, "the Reach keeps no list of its keys: the grant log is walked, and each key is confirmed by the hub");
      var ki = ui.field(b, "inspect a key", "0x…"), info = slot(b, "key", "vault-session-info"); ki.id = "vault-session-key"; ki.setAttribute("aria-label", "inspect a key"); info.textContent = "";
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

    /*═══════════ keepsakes: coins locked together, kept or given, freed slowly, sold slowly (V2 §3.1) ═══════════*/
    var VIEW = ["address", "address", "uint64", "(uint64,uint64,uint64)", "(address,uint256)[]", "uint256[]", "uint256[]", "(address,uint256)[]", "string", DT, "uint64"];
    var metaOf = function (t) { return same(t, ZERO) ? Promise.resolve(ETH) : meta(t); };
    var and = function (xs) { return xs.length > 1 ? xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1] : xs[0]; };
    var sc = function (a) { return short(cks(a)); }, whose = function (h) { return same(h, seenAcct) ? "you" : same(h, RE) ? RCH : sc(h); };
    /* progressive depth: what is optional or the holder's opens on a tap, a native disclosure */
    var dd = function (p, t) { var d = el("details"); d.append(el("summary", "", t)); p.append(d); return d; };
    /* the orb is the keepsake's own tokenURI image, a data: SVG and nothing else. No row serves tokenURI(uint256),
       so its calldata is laid here: 0xc87b56dd is selector("tokenURI(uint256)"), which the suite recomputes */
    var orb = function (id) {
      return ui.request("eth_call", [{ to: KS, data: "0xc87b56dd" + E.W(id) }, "latest"]).then(function (h) {
        var j = atob(decodeURIComponent(h.slice(130, 130 + 2 * parseInt(h.slice(66, 130), 16)).replace(/../g, "%$&")).split(",")[1]).match(/"image":"(data:image\/svg\+xml;base64,[\w+\/=]+)"/);
        return j && j[1];
      });
    };
    /* the holder acts: its own wallet directly, or this token's Reach through execute, which is HOLD's and, as every
       execute is, a spending control (CONSOLE §3) */
    var hs = function (k, to, key, args, lines, sentence, o) {
      var r = same(k.h, RE);
      return propose(Object.assign({ to: r ? RE : to, key: r ? "reach.execute" : key, args: r ? [to, 0n, ui.data(key, args), 0n] : args, need: r ? R.HOLD : 0, spend: r, lines: lines, sentence: sentence, then: paint }, o));
    };
    /* a slow sale in a person's words — a coin of the keepsake by its symbol or address, a Pool market, the floor as a
       price — becomes DripTerms: P OUT per IN is P × 10^decOut × 1e18 / 10^decIn, rounded up, so nothing sells below
       the price typed (W1: the floor is output units per 1e18 input units) */
    var price = function (fl, ci, co) { return fmt(fl * 10n ** BigInt(ci.d), co.d + 18, co.d + 18) + " " + co.s + " per " + ci.s; };
    var dripF = function (p) { return [fld(p, "dsell", "sell slowly: which coin", ""), fld(p, "dmkt", "in Pool market #", String(ID)), fld(p, "dfloor", "never below this price, for one", ""), fld(p, "dmax", "at most each time", "")]; };
    var dripOf = function (f, xs) {
      var q = lower(f[0].value.trim()), i = xs.findIndex(function (a) { return lower(a[2].s) === q || same(a[0], q); }), a = xs[i], s = f[1].value.trim(), m = /^\d{1,78}$/.test(s) && BigInt(s);
      if (!a || a[2].d == null) throw Error("sell which coin?");
      if (m === false || m >> 256n) throw Error("the market: its number");
      return rd(S.pool, "pool.marketOf", [m]).then(function (r) {
        var o = same(r.a(0), a[0]) ? r.a(1) : same(r.a(1), a[0]) && r.a(0);
        if (!r.b(7) || !o) throw Error("market #" + m + " does not trade " + a[2].s);
        return metaOf(o);
      }).then(function (c) {
        var P = f[2].value.trim(), X = f[3].value.trim(), fl, mx, w;
        if (c.d == null || !+P || !+X) throw Error("a slow sale needs a price and an amount");
        fl = (ui.parse(P, c.d + 18) + 10n ** BigInt(a[2].d) - 1n) / 10n ** BigInt(a[2].d); mx = ui.parse(X, a[2].d); w = price(fl, a[2], c);
        return { t: [i, m, fl, mx], w: "anyone may sell its " + a[2].s + " as it frees, at most " + amt(mx, a[2]) + " each time, into market #" + m + ", never below " + w,
          l: [["Terms", "asset " + i + " · market #" + m + " · floor " + fl + " per 1e18 · at most " + mx]] };
      });
    };
    /*  Found from the Keepsake's Transfer logs to the connected wallet and to this token's Reach, in one walk; each id
        kept only while ownerOf still names one of the two. A refused range is a sentence, never an empty list. */
    function keepsakes(g) {
      var b = sect("vault-keepsakes", "keepsakes");
      if (three(b, KB, "keepsake")) return;
      note(b, "coins locked together: nothing frees before the lock ends, then it frees slowly to whoever holds the keepsake");
      var st = el("p", "s", "reading…"), ls = el("div"), who = seenAcct ? [seenAcct, RE] : [RE], here = (seenAcct ? "this wallet or " : "") + RCH, now = clock();
      st.id = "vault-keepsakes-status"; ls.id = "vault-keepsakes-list"; b.append(st, ls); now.catch(function () {});
      ui.walkLogs({ address: KS, topics: [S.topics.transfer, null, who.map(function (a) { return "0x" + E.A(a); })], fromBlock: "0x0", toBlock: "latest" }).then(function (logs) {
        var ids = []; (logs || []).forEach(function (l) { var i = BigInt(l.topics[3]); if (ids.indexOf(i) < 0) ids.push(i); });
        return Promise.all(ids.map(function (i) { return rd(KS, "hub.ownerOf", [i]).then(function (r) { return { id: i, h: r.a(0) }; }); }));
      }).then(function (xs) {
        if (g !== gen) return;
        xs = xs.filter(function (k) { return who.some(function (a) { return same(a, k.h); }); });
        st.textContent = xs.length ? xs.length + " held by " + here : "none held by " + here + " yet";
        xs.forEach(function (k) { card(ls, k, g, now); });
      }).catch(function (e) { if (g === gen) st.textContent = "the keepsakes could not be found on this endpoint: " + (e && e.message); });
      if (can) make(b);
    }
    /* one keepsake: its orb, its coins, the schedule as a filling bar on the chain's clock, what a claim pays now, its
       slow sale in words, its note; a claim for anyone, the rest for its holder */
    function card(ls, k, g, now) {
      var id = k.id, tk = "keepsake #" + id, c = el("div", "card keepsake"), o = el("img");
      c.dataset.id = String(id); ls.append(c); c.append(el("p", "k", tk));
      o.alt = tk + "'s orb"; o.style.cssText = "display:block;width:150px;margin:auto;border-radius:50%";
      orb(id).then(function (s) { if (s && g === gen) { o.src = s; c.insertBefore(o, c.childNodes[1]); } }, function () {});
      Promise.all([rd(KS, "keepsake.keepsakeOf", [id]), rd(KS, "keepsake.claimable", [id]), now]).then(function (x) {
        var v = x[0].tuple(0, VIEW), fr = x[1].arr(0, "(address,uint256)"), pr = x[1].arr(1, "(address,uint256)");
        return Promise.all(v[4].concat(pr).map(function (a) { return metaOf(a[0]); })).then(function (ms) {
          if (g !== gen) return;
          var xs = v[4].map(function (a, i) { return [a[0], a[1], ms[i]]; }), s0 = v[3][0], cl = v[3][1], e = v[3][2], t = x[2], dr = v[9], bar = el("progress"),
              pc = t < cl ? 0n : t < e ? (t - s0) * 100n / (e - s0) : 100n, due = fr.concat(pr).map(function (a, i) { return a[1] ? amt(a[1], ms[i]) : ""; }).filter(Boolean);
          c.append(el("p", "s", (same(v[1], k.h) ? "made by " : "a gift from ") + whose(v[1]) + " · held by " + whose(k.h)));
          if (v[8]) c.append(el("p", "blurb note", "“" + v[8] + "”"));
          xs.forEach(function (a, i) { kv(c, a[2].s, amt(a[1] - v[5][i] - v[6][i], a[2])); });
          /* the bar fills on the chain's clock; the sentence beside it says the same, so the bar is hidden from readers */
          bar.max = 100; bar.setAttribute("value", pc); bar.setAttribute("aria-hidden", "true"); bar.style.cssText = "width:100%;accent-color:var(--a)";
          c.append(bar, el("p", "s free", pc + " % free · " + (t < cl ? "nothing frees before " + date(cl) + " · " : "") + "fully free " + (t < e ? "on " : "since ") + date(e)),
            el("p", "v claimable", due.length ? "ready to claim now: " + and(due) : "nothing to claim yet"));
          var dp = el("p", "s drip", dr[2] ? "reading…" : "no slow sale"), a = xs[Number(dr[0])]; c.append(dp);
          if (dr[2]) rd(S.pool, "pool.marketOf", [dr[1]]).then(function (r) { return metaOf(same(r.a(0), a[0]) ? r.a(1) : r.a(0)); }).then(function (m) {
            if (g === gen) dp.textContent = "sells slowly, never below " + price(dr[2], a[2], m) + " · at most " + amt(dr[3], a[2]) + " each time, in market #" + dr[1];
          }).catch(bad(g, dp));
          if (can && due.length) act(c, "claim", "claim for its holder", 0, function () {
            return propose({ to: KS, key: "keepsake.claim", args: [id], need: 0, lines: [["Keepsake", "#" + id], ["Pays", whose(k.h)], ["Now", and(due)]], then: paint,
              sentence: "pays " + tk + "'s holder, " + whose(k.h) + ", what has freed — now " + and(due) + "; whoever presses is paid nothing" });
          });
          if (can && (same(k.h, seenAcct) || same(k.h, RE) && hold)) manage(c, k, v, xs);
        });
      }).catch(function (e) { if (g === gen) c.append(el("p", "s", unread(e))); });
    }
    /* the holder's changes, each its own disclosure, so the card stays a list of what can be done */
    function manage(c, k, v, xs) {
      var id = k.id, tk = "keepsake #" + id, e = v[3][2], need = same(k.h, RE) ? R.HOLD : 0, K1 = [["Keepsake", "#" + id]];
      var m = dd(c, "lengthen it");
      /* through the Reach every change is an execute, so every button is a spending one there; a give is one anywhere */
      var ac = function (n, l, f, s) { return act(m, n, l, need, guard(f), { spend: s || !!need }); };
      var xi = fld(m, "more", "by how many days", "30");
      ac("extend", "review the extension", function () {
        var s = xi.value.trim(), d = /^-?\d+$/.test(s) ? BigInt(s) : 0n, n = e + d * 86400n;
        if (d < 1n) throw Error("a keepsake only lengthens, by whole days: it never ends sooner");
        return hs(k, KS, "keepsake.extend", [id, n], K1.concat([["Ends", date(e) + " → " + date(n)]]), "lengthens " + tk + " by " + d + " days: fully free on " + date(n) + ", not " + date(e) + "; it only lengthens, never shortens");
      });
      var df = dripF(m = dd(c, "sell it slowly as it frees"));
      ac("setDrip", "review the slow sale", function () { return dripOf(df, xs).then(function (d) { return hs(k, KS, "keepsake.setDrip", [id, d.t], K1.concat(d.l), "on " + tk + ", " + d.w + "; what it earns waits there for its holder"); }); });
      if (v[9][2]) ac("clearDrip", "stop the slow sale", function () { return hs(k, KS, "keepsake.clearDrip", [id], K1, "stops the slow sale of " + tk + "; what has freed stays to be claimed"); });
      var gi = fld(m = dd(c, "give it"), "give", "to whom, an address", "");
      ac("give", "review the gift", function () { var t = addr(gi, "the recipient"); return hs(k, KS, "keepsake.transferFrom", [k.h, t, id], K1.concat([["To", cks(t)]]), "gives " + tk + " to " + sc(t) + ": the keepsake and everything in it becomes theirs", { spend: true }); }, 1);
      if (three(c, JB, "journal")) return;
      var mi = fld(m = dd(c, "write a memory into it"), "memory", "a memory, public and for good", "");
      ac("inscribe", "review the memory", function () {
        var t = mi.value.trim(), b = [].map.call(new TextEncoder().encode(t), function (x) { return (x + 256).toString(16).slice(1); }).join("");
        if (!t || b.length > 2048) throw Error("a memory is 1 to 1,024 bytes");
        return hs(k, S.journal, "journal.inscribe", [KS, id, 0, "0x" + b, "0x" + E.W(0)], K1.concat([["Memory", t]]), "writes a memory into " + tk + ", public and for good: “" + t + "”");
      });
    }
    /*  Make one: ETH and up to seven coins by address (decimals read live), "locked for N days, then freed over M days",
        for you or a gift with a note; the exact approvals first (ui.approveExactThen), then wrap with value the ETH
        exactly. The new keepsake's number is read from the Wrapped log of the receipt, never from a read after it. */
    function make(b) {
      var f = h3(el("div"), "make a keepsake"), cs = el("div"), rows = [], out = el("p", "v ok", made); f.id = "vault-make"; out.id = "vault-keepsake-made"; b.append(f);
      var ei = fld(f, "eth", "ETH to lock, 0 for none", "0"); f.append(cs);
      var add = function () {
        if (rows.length > 6) return say("seven coins beside ETH at most", "err");
        var r = el("div", "coin"), t = fld(r, "token", "a coin to lock, by its address", ""), a = fld(r, "amount", "how much of it", ""), s = el("p", "s"); r.append(s); cs.append(r); rows.push([t, a]);
        t.addEventListener("input", function () { var x = t.value.trim(); s.textContent = ""; if (isAddr(x)) meta(x).then(function (m) { if (t.value.trim() === x) s.textContent = m.d == null ? "its decimals did not answer: it cannot be locked" : m.s + " · " + m.d + " decimals"; }); });
      };
      add(); ui.button(f, "add another coin", true, add).id = "vault-make-add";
      var li = fld(f, "lock", "locked for, in days", "30"), oi = fld(f, "over", "then frees slowly over, in days", "30"), ti = fld(f, "to", "a gift to, an address; empty keeps it yours", ""), ni = fld(f, "note", "a note for its face, up to 280 bytes", "");
      var df = dripF(dd(f, "sell it slowly as it frees? only one you keep"));
      act(f, "wrap", "review the keepsake", 0, guard(function () {
        var me = seenAcct, to = ti.value.trim() ? addr(ti, "the recipient") : me, gift = !same(to, me), nt = ni.value.trim(), nb = new TextEncoder().encode(nt).length,
            eth = ui.parse(ei.value || "0", 18), N = digits(li, 3650n, "the lock"), Mo = digits(oi, 3650n, "the release"), dp = df[2].value.trim(),
            ps = rows.filter(function (r) { return r[0].value.trim() || r[1].value.trim(); }).map(function (r) { return [addr(r[0], "a coin"), r[1].value]; });
        if (nb > 280) throw Error("the note is " + nb + " bytes; 280 at most");
        if (gift && dp) throw Error("a slow sale only on a keepsake you keep: a giver never sells a recipient's gift");
        if (!N && !Mo) throw Error("lock it, or free it, over a day at least");
        return Promise.all(ps.map(function (p) { return meta(p[0]); })).then(function (ms) {
          var xs = (eth ? [[ZERO, eth, ETH]] : []).concat(ps.map(function (p, i) { if (ms[i].d == null) throw Error(sc(p[0]) + ": its decimals did not answer: it cannot be locked"); return [p[0], ui.parse(p[1], ms[i].d), ms[i]]; }));
          if (!xs.length || xs.some(function (a, i) { return !a[1] || xs.findIndex(function (y) { return same(y[0], a[0]); }) < i; })) throw Error("lock ETH or a coin, each once, each above zero");
          return Promise.all([clock(), dp && dripOf(df, xs)]).then(function (y) {
            var d = y[1], st = N ? y[0] + N * 86400n : 0n, en = (N ? st : y[0]) + Mo * 86400n, l = and(xs.map(function (a) { return amt(a[1], a[2]); })), fr = xs.length > 1 ? "they free" : "it frees";
            return ui.approveExactThen(xs.filter(function (a) { return a[0] !== ZERO; }).map(function (a) { return { token: a[0], spender: KS, amount: a[1], symbol: a[2].s, decimals: a[2].d, who: "the Keepsake" }; }), function () {
              return propose({ to: KS, key: "keepsake.wrap", args: [[xs.map(function (a) { return [a[0], a[1]]; }), [st, 0n, en], to, nt, d ? d.t : [0, 0, 0, 0]]], value: eth, need: 0, spend: true,
                sentence: "You lock " + l + (N ? " for " + N + " days, then " + (Mo ? fr + " slowly over " + Mo + " days" : "all of it frees at once") : "; " + fr + " slowly over " + Mo + " days") +
                  (gift ? "; it is a gift to " + sc(to) + (nt ? " with your note" : "") : "; it is yours" + (nt ? ", with your note" : "")) + (d ? "; as it frees, " + d.w : "") + ".",
                lines: [["Assets", l], ["Schedule", (N ? "nothing frees before " + date(st) : "starts when it lands") + "; all free on " + date(en)], ["For", (gift ? "a gift to " : "you, ") + cks(to)], ["Note", nt || "none"], ["Slow sale", d ? d.w : "none"]].concat(d ? d.l : []),
                then: function (rc) {
                  var w = (rc.logs || []).find(function (x) { return same(x.address, KS) && same(x.topics[0], S.topics.wrapped); });
                  made = w && "keepsake #" + BigInt(w.topics[1]) + " is made" + (gift ? ", a gift to " + sc(to) : "") + " · its number from the Wrapped log";
                  paint();
                } });
            });
          });
        });
      }), { spend: true });
      f.append(out);
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
      keepsakes(g); reach(g); grip(g); sessions(g); steward(g); sell(g); panic(g);
      S.loaded.vault = true;
    }
    paint();
    /* the same bits for the same account is not a reason to repaint under a person's hands: a receipt's own then() repaints */
    window.addEventListener("intact:rights", function (e) { var d = e.detail || {}; if (d.bits !== seenBits || d.account !== seenAcct) paint(); });
    window.addEventListener("intact:epoch", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "vault") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
