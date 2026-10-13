/*  INTACT panel "agent" — the token for a program, and the key's own lane
    (U17). Injected as a Blob script after the shell keccak'd these bytes
    against window.INTACT.panels.agent. One IIFE, nothing at top level
    (terser mangles the shell's top level to one-letter names; a top-level
    const here would collide and the panel would never run — E §3.4; the
    build refuses one). Every text node through textContent. Every write
    through INTACT.ui.propose, with the irreversible part in its sentence.

    What this lane keeps of the contract (docs/CONSOLE.md §3, §5, §11;
    DESIGN §10; docs/AGENT.md §2–§3):
      · the card is read from the chain, never trusted from the page: face 2
        is hub.tokenURIAt(id, 2), base64-decoded and parsed; the lane says
        whether it is a registration-v1 whose agentId is this token, whose
        agentWallet is the Reach, and prints the keccak of the bytes it was
        served beside AgentCard.manifestHash(id) read live — when the
        catalogue serves that row (requested of the Catalog as
        agentCard.manifestHash; until then the live hash reads "not
        reported", never a zero). The agent routes are printed as PATHS
        (/.well-known/*, /llms.txt, /token/<id>/face/2, /k/<id>/<key>): no
        host string ships in a document (CONSOLE §10);
      · the grants that exist are the SessionGranted log walked once over the
        Reach, each key confirmed live or dead by rightsOf (the SESSION bit is
        a hint; the Reach decides at the call); a walk the endpoint refuses is
        a sentence, never "sessions: 0";
      · the composer builds exactly one executeAsSession(to, value, data) for
        a key, from a write row of services.json (word.name, the arguments
        typed by type, or calldata pasted for a tuple row the shell's coder
        cannot lay). PROPOSE is a read and nothing else: sessionAllows(key,
        to, selector) on the Reach, then a dry eth_call of the same
        executeAsSession from the key; a call the grant does not allow is a
        sentence and never reaches the wallet. ACT is the slab (INTACT.ui.
        propose; the shell re-reads custodyEpoch at the press) and is offered
        only to a connected wallet whose rightsOf carries SESSION — the key
        itself, in the console; anyone else reads why; the recheck hook reads
        sessionAllows once more at the press;
      · in session mode (/k/<id>/<key> → ?as=<key>, CONSOLE §11) the lane
        prints the key's envelope (sessionOf, sessionExposure, rightsOf, the
        token's epoch and status), the doors its grant opens (sessionAllows
        over every fixed-target write row of the catalogue, on a press), the
        composer as a read, and the refusal when the connected wallet is not
        the key. The shell never writes in session mode (INTACT.ui.act renders
        nothing, propose refuses), so the act is offered where the key's
        wallet connects as itself: the console.

    Elements this panel introduces (CONSOLE §6.2; the suite reads them
    scoped to #lane-agent):
      #agent-card-address        the pinned AgentCard and its chip state (reported / not deployed on this chain / could not be read at block N)
      #agent-links .kv           the agent routes as paths: registration, card, llms, token llms, face 2, door
      #agent-face2               "parses as registration-v1 · agentId N == #N", or why not
      #agent-agentid, #agent-wallet, #agent-trust   the registration's facts (agentWallet beside the Reach; supportedTrust, x402Support, active, epoch)
      #agent-hash-baked          keccak of face 2's bytes as served; #agent-hash-live  AgentCard.manifestHash(id), live, or "not reported: …"
      #agent-services .svc       one row per registration service: name → endpoint
      #agent-sessions .row       the keys the grant log names (data-key), live or dead; #agent-session-count  "sessions: n live of m" / the refusal
      #agent-key-facts           one key's envelope in words (the typed key, or ?as= in session mode)
      #agent-refusal             session mode: "this page acts as key 0x…; the connected wallet is 0x… — connect the key's wallet"
      #agent-composer            inputs name=key|row|target|value|data; #agent-args input[name=arg<i>]; #agent-row-info; #agent-verdict; #agent-calldata
      #agent-propose             the read; #agent-doors  the probe; #agent-allowed .row  the doors the grant opens (data-row)
      [data-act=executeAsSession]   the one write (need SESSION; [data-spend])                                                  */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("agent"), R = S.rights, ID = BigInt(S.id), tok = "#" + ID, HUB = S.hub, REACH = S.reach;
    var el = ui.el, kv = ui.kv, note = ui.note, read = ui.read, say = ui.say, short = ui.short, checksum = ui.checksum, isAddr = ui.isAddr, field = ui.field, button = ui.button;
    var lower = function (s) { return String(s).toLowerCase(); };
    var same = function (a, b) { return lower(a) === lower(b); };
    var date = function (t) { return Number(t) ? new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "none"; };
    var hex = function (u) { return "0x" + Array.from(u, function (b) { return b.toString(16).padStart(2, "0"); }).join(""); };
    var unhex = function (h) { return Uint8Array.from(String(h).replace(/^0x/, "").match(/../g) || [], function (x) { return parseInt(x, 16); }); };
    var text = function (u) { return new TextDecoder().decode(u); };
    var unread = function (e) { return "not reported: " + (e && e.message || e); };
    var oops = function (e) { say(e && e.message || String(e), "err"); };
    var fld = function (p, n, label, v) { var i = field(p, label, ""); i.name = n; i.value = v || ""; return i; };
    var slot = function (p, k, id) { var n = kv(p, k, "reading…").lastChild; n.id = id; return n; };
    var addr = function (i, what) { var s = i.value.trim(); if (!isAddr(s)) throw Error(what + ": an address"); return s; };
    /* the rows this lane calls; the card's own row only once the catalogue serves it (CONSOLE §5: a key not in INTACT.sel throws) */
    var M = { "hub.tokenURIAt": "tokenURIAt(uint256,uint8)", "hub.rightsOf": "rightsOf(uint256,address)", "hub.custodyEpoch": "custodyEpoch(uint256)", "hub.statusOf": "statusOf(uint256)",
              "reach.sessionOf": "sessionOf(address)", "reach.sessionExposure": "sessionExposure(address)", "reach.sessionAllows": "sessionAllows(address,address,bytes4)",
              "reach.executeAsSession": "executeAsSession(address,uint256,bytes)", "catalog.services": "services()" };
    var CARD = "agentCard.manifestHash" in S.sel;
    if (CARD) M["agentCard.manifestHash"] = "manifestHash(uint256)";
    ui.rows(M);
    var sess = ui.mode() === "session", KEY = sess ? checksum(new URLSearchParams(location.search).get("as")) : null;
    var gen = 0, acct, SVC = null, ROWS = {};
    var bad = function (g, n) { return function (e) { if (g === gen) n.textContent = unread(e); }; };

    /* services.json, read once from the Catalog: the write rows a session may be sent to, keyed word.name, each
       declared to the shell so ui.data lays its arguments (a session cannot call the Reach itself: those rows are left out) */
    function catalogue() {
      if (SVC) return Promise.resolve(SVC);
      return read(S.catalog, "catalog.services", []).then(function (r) {
        var doc = JSON.parse(text(unhex(r.bytes(0)))), decl = {};
        doc.services.forEach(function (x) { if (x.kind !== "read" && x.on !== "reach") { ROWS[x.on + "." + x.name] = x; decl[x.on + "." + x.name] = x.sig; } });
        ui.rows(decl);
        return SVC = doc;
      });
    }

    /*═══════════ the card: face 2 as the chain serves it ═══════════*/
    function card(p, g) {
      p.append(el("h3", "", "the card"));
      var absent = S.absent & S.bits.agentcard;
      kv(p, "AgentCard", checksum(S.agentCard) + " · " + (S.reported & S.bits.agentcard ? "reported" : absent ? "not deployed on this chain" : "could not be read at block " + S.block)).lastChild.id = "agent-card-address";
      var links = el("div"); links.id = "agent-links"; p.append(links);
      [["registration", "/.well-known/agent-registration.json"], ["card", "/.well-known/agent-card.json"], ["llms", "/llms.txt"],
       ["token llms", "/token/" + ID + "/llms.txt"], ["face 2", "/token/" + ID + "/face/2"], ["door", "/k/" + ID + "/<key>"]].forEach(function (x) { kv(links, x[0], x[1]); });
      if (absent) return note(p, "no AgentCard on this chain: face 2 is the crest and the agent routes answer 404; the composer below still acts through the Reach");
      var f2 = slot(p, "face 2", "agent-face2"), aid = slot(p, "agentId", "agent-agentid"), aw = slot(p, "agentWallet", "agent-wallet"), tr = slot(p, "trust", "agent-trust");
      var hb = slot(p, "keccak of face 2 as served", "agent-hash-baked"), hl = slot(p, "manifestHash, live", "agent-hash-live"), sv = el("div"); sv.id = "agent-services"; p.append(sv);
      read(HUB, "hub.tokenURIAt", [ID, 2]).then(function (r) {
        if (g !== gen) return;
        var m = r.s(0).match(/^data:application\/json;base64,(.*)$/), doc = null, bytes;
        if (m) { bytes = Uint8Array.from(atob(m[1]), function (c) { return c.charCodeAt(0); }); try { doc = JSON.parse(text(bytes)); } catch (e) {} }
        if (!doc || typeof doc !== "object") return f2.textContent = "face 2 is not a registration: " + (m ? "the JSON does not parse" : "not application/json");
        var regs = doc.registrations || [], mine = /#registration-v1$/.test(String(doc.type)) && String(doc.agentId) === String(ID);
        f2.textContent = mine ? "parses as registration-v1 · agentId " + doc.agentId + " == " + tok : "parses, but not as " + tok + "'s registration-v1 (type …" + String(doc.type).slice(-16) + ", agentId " + doc.agentId + ")";
        aid.textContent = String(doc.agentId) + (regs[0] ? " in " + regs[0].agentRegistry : " — no registrations entry");
        aw.textContent = String(doc.agentWallet) + (same(doc.agentWallet, REACH) ? " — the Reach" : " — NOT the Reach " + short(REACH));
        tr.textContent = (doc.supportedTrust || []).join(", ") + " · x402Support " + doc.x402Support + " · active " + doc.active + " · custody epoch " + doc.custodyEpoch;
        hb.textContent = ui.kbytes(hex(bytes));
        (doc.services || []).forEach(function (x) { kv(sv, String(x.name), String(x.endpoint)).className = "kv svc"; });
        if (!CARD) return hl.textContent = "not reported: the catalogue serves no agentCard row";
        read(S.agentCard, "agentCard.manifestHash", [ID]).then(function (h) { if (g !== gen) return; var v = "0x" + h.words[0]; hl.textContent = v + (same(v, hb.textContent) ? " — equal to the bytes served" : " — moved since face 2 was served"); }, bad(g, hl));
      }, bad(g, f2));
    }

    /*═══════════ one key's envelope: sessionOf, sessionExposure, rightsOf, the token's epoch and status ═══════════*/
    function envelope(n, g, key) {
      n.textContent = "reading…";
      Promise.all([read(REACH, "reach.sessionOf", [key]), read(REACH, "reach.sessionExposure", [key]), read(HUB, "hub.rightsOf", [ID, key]), read(HUB, "hub.custodyEpoch", [ID]), read(HUB, "hub.statusOf", [ID])]).then(function (v) {
        if (g !== gen) return;
        var s = v[0], ep = v[3].w(0), live = !!(v[2].w(0) & BigInt(R.SESSION));
        n.textContent = (s.w(0) ? "recipe on " + short(s.a(10)) : "allowlist") + " · expires " + date(s.w(1)) + " · granted at epoch " + s.w(2) + " (the token is at epoch " + ep + ")" +
          " · native cap " + ui.fmt(s.w(3)) + " ETH, spent " + ui.fmt(s.w(4)) + " · uses left " + (s.w(5) === 4294967295n ? "not capped" : s.w(5)) + " · interval " + s.w(6) + " s · " +
          (s.w(13) ? "stored active" : "revoked or never granted") + " · worst-case exposure " + ui.fmt(v[1].w(0)) + " ETH, " + v[1].w(Number(v[1].w(1)) / 32) + " asset cap(s)" +
          " · token " + (v[4].w(0) ? "Paused: no key acts" : "Active") + " · SESSION right " + (live ? "yes: live" : "no: not a current key");
      }, bad(g, n));
    }

    /*═══════════ the grants that exist: the SessionGranted log over the Reach, each key confirmed by rightsOf ═══════════*/
    function sessions(p, g) {
      p.append(el("h3", "", "the keys"));
      var list = el("div"), cnt = note(p, "reading…", "s"); list.id = "agent-sessions"; cnt.id = "agent-session-count"; p.insertBefore(list, cnt);
      ui.walkLogs({ address: REACH, topics: [S.topics.sessionGranted], fromBlock: "0x0", toBlock: "latest" }).then(function (logs) {
        if (g !== gen) return;
        var keys = [];
        (logs || []).forEach(function (l) { var k = checksum("0x" + String(l.topics[1]).slice(26)); if (keys.indexOf(k) < 0) keys.push(k); });
        return Promise.all(keys.map(function (k) { return read(HUB, "hub.rightsOf", [ID, k]).then(function (r) { return !!(r.w(0) & BigInt(R.SESSION)); }); })).then(function (live) {
          if (g !== gen) return;
          var n = 0;
          keys.forEach(function (k, i) { var r = kv(list, short(k), live[i] ? "live" : "dead: revoked, expired or granted before the token last changed hands"); r.className = "kv row"; r.dataset.key = k; if (live[i]) n++; });
          cnt.textContent = "sessions: " + n + " live of " + keys.length + " ever granted";
        });
      }).catch(function (e) { if (g === gen) cnt.textContent = "sessions: not counted — the grant log could not be walked on this endpoint (" + (e && e.message || e) + ")"; });
    }

    /*═══════════ the composer: one executeAsSession; propose reads, act is the slab ═══════════*/
    function composer(p, g) {
      p.append(el("h3", "", "executeAsSession"));
      note(p, "propose is a read: sessionAllows(key, target, selector) on the Reach, then a dry eth_call of the same executeAsSession from the key; nothing a grant refuses reaches a wallet. act is that one call, sent by the key's own wallet through the slab.");
      var box = el("div"); box.id = "agent-composer"; p.append(box);
      var fk = sess ? null : fld(box, "key", "the session key (an address; the connected wallet by default)", acct || "");
      var kf = slot(box, "the key's grant", "agent-key-facts");
      var fr = fld(box, "row", "a write row of services.json, as word.name — pool.swapExactIn, parley.speak, launchpad.buy", "");
      var info = note(box, "", "s"); info.id = "agent-row-info";
      var args = el("div"); args.id = "agent-args"; box.append(args);
      var ft = fld(box, "target", "the target address, only for a row whose contract is per asset (a coin, an ERC-20)", "");
      var fv = fld(box, "value", "ether the Reach sends with the call, charged to the key's native cap", "0");
      var fd = fld(box, "data", "or calldata for this row, pasted, when its arguments are a tuple the coder cannot lay", "");
      var verdict = note(box, "", "s"); verdict.id = "agent-verdict";
      var code = el("pre", "code"); code.id = "agent-calldata"; box.append(code);
      var cur = null, inputs = [];
      var keyOf = function () { return sess ? KEY : addr(fk, "the key"); };
      var facts = function () { var k; try { k = keyOf(); } catch (e) { kf.textContent = e.message; return; } envelope(kf, g, k); };
      if (fk) fk.addEventListener("input", facts);
      facts();
      function pick() {
        var k = fr.value.trim(); cur = ROWS[k] || null; args.replaceChildren(); inputs = [];
        if (!cur) { info.textContent = k ? (SVC ? "not a write row a session can be sent to; the catalogue names " + Object.keys(ROWS).length : "the catalogue is still being read") : ""; return; }
        info.textContent = cur.sig + " · " + cur.kind + " · via " + cur.via + (cur.notes ? " · " + cur.notes : "") + (BigInt(cur.contract) ? " · on " + checksum(cur.contract) : " · the target is per asset: type it");
        cur.args.forEach(function (t, i) { inputs.push(fld(args, "arg" + i, "arg " + i + " · " + t, "")); });
      }
      fr.addEventListener("input", pick);
      catalogue().then(function () { if (g === gen) pick(); }, function (e) { if (g === gen) info.textContent = unread(e); });
      /* what the key would send: the key, the target, the selector, the inner calldata and the value — or a thrown sentence */
      function build() {
        var key = keyOf();
        if (!cur) throw Error("the row: a write row of services.json, as word.name");
        var to = BigInt(cur.contract) ? checksum(cur.contract) : addr(ft, "the target");
        var data = fd.value.trim();
        if (data) { if (!/^0x([0-9a-f]{2})*$/i.test(data) || lower(data.slice(0, 10)) !== lower(cur.selector)) throw Error("the data: calldata beginning with this row's selector " + cur.selector); }
        else data = ui.data(cur.on + "." + cur.name, inputs.map(function (i, k) { var v = i.value.trim(); return cur.args[k] === "bytes" && !/^0x/.test(v) ? hex(new TextEncoder().encode(v)) : v; }));
        return { key: key, to: to, sel: data.slice(0, 10), data: data, value: ui.parse(fv.value.trim() || "0"), name: cur.on + "." + cur.name };
      }
      /* the read: allowed or not by the grant, then the simulation; resolves {b, allowed, ok} or null */
      function propose() {
        var b; try { b = build(); } catch (e) { oops(e); return Promise.resolve(null); }
        var outer = ui.data("reach.executeAsSession", [b.to, b.value, b.data]);
        code.textContent = outer; verdict.textContent = "reading…";
        return read(REACH, "reach.sessionAllows", [b.key, b.to, b.sel]).then(function (r) {
          if (!r.b(0)) { verdict.textContent = "not allowed by the grant: " + b.name + " (" + b.sel + ") on " + short(b.to) + " for key " + short(b.key) + " — nothing is sent"; return { b: b, allowed: false }; }
          return ui.simulate(REACH, outer, { from: b.key }).then(function (s) {
            verdict.textContent = "allowed by the grant · " + (s.ok ? "simulates: executeAsSession would land" : "would revert: " + s.sentence);
            return { b: b, allowed: true, ok: s.ok };
          });
        }, function (e) { verdict.textContent = unread(e); return { b: b, allowed: false }; });
      }
      button(box, "propose: read what the grant says", true, function () { propose(); }).id = "agent-propose";
      /* the doors: every fixed-target write row asked of sessionAllows for this key, on a press */
      var doors = el("div"); doors.id = "agent-allowed"; box.append(doors);
      button(box, "which doors does the grant open?", true, function () {
        var key; try { key = keyOf(); } catch (e) { return oops(e); }
        doors.replaceChildren(); note(doors, "reading…", "s");
        catalogue().then(function () {
          var rs = Object.keys(ROWS).filter(function (k) { return BigInt(ROWS[k].contract); });
          return Promise.all(rs.map(function (k) { return read(REACH, "reach.sessionAllows", [key, ROWS[k].contract, ROWS[k].selector]).then(function (r) { return r.b(0); }); })).then(function (ok) {
            if (g !== gen) return;
            doors.replaceChildren(); var n = 0;
            rs.forEach(function (k, i) { if (!ok[i]) return; n++; var r = kv(doors, k, ROWS[k].selector + " on " + short(ROWS[k].contract)); r.className = "kv row"; r.dataset.row = k; r.addEventListener("click", function () { fr.value = k; pick(); }); });
            note(doors, n + " of " + rs.length + " doors open for key " + short(key) + (n ? "; a row above fills the composer" : ""), "s");
          });
        }).catch(function (e) { if (g === gen) { doors.replaceChildren(); note(doors, unread(e), "s"); } });
      }).id = "agent-doors";
      if (sess) return note(box, "this page reads only: the act is offered in the console (/token/" + ID + "/live) to this key's wallet, whose rightsOf carries SESSION there");
      if (!(ui.mode() === "console" && acct && ui.rights() !== null && (ui.rights() & R.SESSION))) return note(box, "act is the key's: connect the key's own wallet, whose rightsOf carries SESSION, to send what propose allowed");
      ui.act(box, "executeAsSession", "act: send it through the slab", R.SESSION, function () {
        return propose().then(function (r) {
          if (!r) return;
          if (!r.allowed) return say("not allowed by the grant; nothing reaches the wallet", "err");
          var b = r.b;
          return ui.propose({ to: REACH, key: "reach.executeAsSession", args: [b.to, b.value, b.data], need: R.SESSION, spend: true,
            lines: [["Key", checksum(b.key)], ["Calls", b.name + " on " + checksum(b.to)], ["Selector", b.sel], ["Value", ui.fmt(b.value) + " ETH from the Reach, charged to the native cap"], ["Allowed", "by the grant, read this block; read again at the press"]],
            sentence: "acts as key " + short(b.key) + " through " + tok + "'s Reach: one executeAsSession calling " + b.name + " on " + short(b.to) + " with " + ui.fmt(b.value) + " ETH; the grant allowed it when read, and every key dies with a sale",
            recheck: function () { return read(REACH, "reach.sessionAllows", [b.key, b.to, b.sel]).then(function (x) { return x.b(0) ? null : "the grant no longer allows this call — nothing sent"; }, function (e) { return unread(e); }); } });
        });
      }, { spend: true });
    }

    /*═══════════ paint ═══════════*/
    function paint() {
      var g = ++gen; host.replaceChildren();
      if (!ID) return note(host, "a token's agent surface: open one to read its card, its keys and its composer"), S.loaded.agent = true;
      acct = ui.account();
      if (sess && acct && !same(acct, KEY)) note(host, "this page acts as key " + KEY + "; the connected wallet is " + acct + " — connect the key's wallet", "bad").id = "agent-refusal";
      ui.gate(host, sess ? R.SESSION : 0);
      card(host, g); sessions(host, g); composer(host, g);
      S.loaded.agent = true;
    }
    paint();
    window.addEventListener("intact:rights", paint);
    window.addEventListener("intact:epoch", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "agent") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
