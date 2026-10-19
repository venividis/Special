/*  INTACT panel "identity" — who the token is and who may act as it: its
    status, the rights of any address, its fingerprint, the account's 7702
    code, its traits, its guardian, user and agent wallet, where its income
    goes, its pinned face, its transfer seal, its roles, its Market
    listing, the holder's operators, the sealing key in two slabs, and the
    hash manifest. Injected as a Blob
    script after the shell keccak'd these bytes against
    window.INTACT.panels.identity. One IIFE, nothing at top level (terser
    mangles the shell's top level to one-letter names; a top-level const
    here would collide and the panel would never run — E §3.4; the build
    refuses one). Every text node through textContent. Every write through
    INTACT.ui.propose, with the irreversible part in its sentence.

    What this lane keeps of the contract (docs/CONSOLE.md §3, §9, §14):
      · one read is the authority model: rightsOf(id, addr) for any typed
        address is drawn as chips named by right (data-right, not Home's
        data-bit), holder and epoch beside them; the token's own facts come
        from one coreOf read per paint, so the status, the face, the seal,
        the guardian, the user, the agent wallet and the income route are
        the words the chain holds now, never the baked block alone;
      · the 7702 row is the shell's reading: ui.delegate() is drawn on every
        paint, the known name as the Catalog spells it, "unknown delegate"
        otherwise, and #ack-delegate calls ui.ackDelegate(), which unhides
        every [data-spend] control and fires intact:rights. The controls
        this lane marks spend are the ones CONSOLE §3 names — approve,
        setApprovalForAll, setApprovalForAllUntil, setUser,
        proposeAgentWallet — so an unknown delegate hides exactly those;
      · the sealing key is two slabs, strictly HOLD: the P-256 scalar is
        SHA-256 of the shell's one personal_sign (ui.sealSignature(): chain
        and hub only, one key per wallet — D7), re-hashed until 0 < d < n,
        imported as PKCS#8 so WebCrypto computes the point; then
        keys.setEncryptionKey(3, 0x04‖x‖y), then parley.bindKey(id). The
        signature and the scalar live in this closure and go when another
        account connects. keyOf(id) answers (3, keccak(pk), pk) only under
        the holder and epoch that bound it, so "bound at epoch e" is a live
        fact and "no key bound" is the word after every sale;
      · the trait keys are the shell's own keccak (ui.khex("curve"),
        ui.khex("name") — D4); the curve slab prints "curve A bps → B bps"
        and moves no price until the market is re-anchored on Swap; a name
        is up to 32 bytes of UTF-8, laid left-aligned in one word;
      · every deadline — the user's expiry, the operator's expiry, the
        transfer seal — is the chain's clock plus the days typed (ui.clock(),
        never Date.now(); a clock that will not answer is a sentence and no
        slab); the seal and the operator approvals say what they are: a
        ratchet that only lengthens, and grants per owner over every token
        the wallet holds;
      · income into the Grip is said to be permanently unspendable before
        the control and again as the slab's first line.

    Post-MVB (wave 4), read as every satellite is: a clear bit is a chip by
    CONSOLE §6.3's rule, never a zero.
      · the Market (U15): the offer as listingOf holds it, the pinned
        fingerprint beside the live one, the floors, and the two seals a
        listing needs; the holder lists (the calldata laid by hand: the
        shell's encoder has no tuples, and the floors go empty, so the
        buyer holds the seller to the fingerprint and the seals) and
        delists; anyone else buys at value = price, the listing, the
        fingerprint and the epoch re-read at Sign; anyone clears a dead
        listing; the ledger's claim is the wallet's, not the token's. It
        lives on this lane, not on the Vault screen BUILD-PLAN U15 names:
        the vault panel is at its gzip ceiling;
      · the Roles (U16): liveRoleCount, and the USER role (keccak "USER")
        as recipientOf, roleExpirationDate, roleData and roleEpoch answer
        it; the ROLE chip above is rightsOf's bit, which the hub reads from
        hasAnyRole. Nothing is granted here: ROLE is viewing only (§3).
      · the Nameplate (U18), on band 0 alone: <id>.intact.eth as the
        catalogue's nameFor (tokenForName of the DNS wire bytes) and
        nameExpiry (the registrar's clock) answer it, read on the chain's
        clock; nothing is signed here (moving a name is the Vault's
        composer, registering it the ENS app's). A band without one — its
        bit absent, or a Catalog older than the pin — draws no row at all.
    Still not here (CONSOLE §14), and the lane says so where a holder would
    look: no revokeEncryptionKey (a key is replaced by publishing and
    binding again); on a band without a Nameplate, no ENS row.

    Elements this panel introduces (CONSOLE §6.2; the suite reads them
    scoped to #lane-identity):
      #identity-status             Active / Paused, from coreOf word 0
      #identity-status-rule        verbatim: sessions act only while Active; a sale pauses the token; re-arm to let your keys act
      #identity-rights-input       any address; #identity-rights-chips .chip[data-right=<HOLD|ACCOUNT|USE|CUSTODY|ROLE|DELEGATE|GUARDIAN|SESSION>][data-state=on|off]
      #identity-rights-fact        the holder, the custody epoch and the bits the read answered
      #identity-fingerprint-baked  S.fingerprint; #identity-fingerprint-live  getStateFingerprint(id), "as rendered" or "changed since this document was rendered"
      #identity-delegate           ui.delegate(): the known name, "unknown delegate", "none: a plain account"; #ack-delegate
      #identity-curve, #identity-name   the two traits as read
      #identity-user, #identity-guardian, #identity-agent, #identity-proposed, #identity-income, #identity-face, #identity-seal
      #identity-key                no key bound / bound at epoch e · P-256 · key 0x…; #identity-registry  this wallet's registry key
      input[name=curve|name|guardian|user|userDays|wallet|face|sealDays|operator|opDays|approvee]   the holder's fields
      #identity-manifest           engine, catalog and the six panel hashes
      #identity-roles              the chip, or #identity-role-count (liveRoleCount) and #identity-role-user: <addr> until <date> · granted
                                   at epoch e · data n bytes / none / none live: the grant stamped at epoch e died when the custody epoch moved | expired
      #identity-listing            the chip, or #identity-offer: not listed / <price> ETH until <date> · by <seller> · epoch e[ · expired |
                                   stale: the custody epoch moved; nothing can buy it], #identity-seals, #identity-pinned, #identity-owed;
                                   input[name=price|listDays]
      #identity-ens                band 0 only: the chip, or #identity-ens-name: <id>.intact.eth · resolves to this token's Reach; the registration
                                   lapses <date> / · resolves to nothing: no token holds intact.eth / · resolves to nothing: intact.eth lapsed <date>
      [data-act=setTrait(×2)|setStatus|pause|setGuardian|setUser|proposeAgentWallet|acceptAgentWallet|setFeesToGrip|pinTokenURI|
                unpinTokenURI|sealTransfer|setApprovalForAllUntil|setApprovalForAll|approve|revokeAllApprovals|setEncryptionKey|bindKey|
                list|delist|buy|claim]
    Sentences the group proves (tools/verify-site/identity.mjs): M1–M13 of
    BLUEPRINT §7.6 — the rule verbatim, the status after a sale, the rights
    of any address, the fingerprint diff, the 7702 delegate known and
    unknown, the trait keys, the key two-step, the guardian form, the agent
    wallet two-step, no ENS row, the Grip warning, per-owner approvals, the
    hash manifest.                                                          */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("identity"), R = S.rights, ID = BigInt(S.id), tok = "#" + ID, ZERO = "0x" + "0".repeat(40), HUB = S.hub;
    var el = ui.el, kv = ui.kv, note = ui.note, act = ui.act, read = ui.read, say = ui.say, short = ui.short, propose = ui.propose, clock = ui.clock, isAddr = ui.isAddr, checksum = ui.checksum, field = ui.field;
    /* the rows this panel calls and nothing else; the key is "<word>.<name>" as INTACT.sel spells it, and
       ui.rows holds every signature to the selector the chain baked, or the lane does not open */
    var M = {}, LIST = "list(uint256,uint256,uint64,bytes32,(address,uint256)[])";
    [["hub", "setTrait(uint256,bytes32,bytes32)", "setStatus(uint256,uint8)", "pause(uint256)", "setGuardian(uint256,address)", "setUser(uint256,address,uint64)",
      "proposeAgentWallet(uint256,address)", "acceptAgentWallet(uint256)", "setFeesToGrip(uint256,bool)", "pinTokenURI(uint256,uint256)", "unpinTokenURI(uint256)",
      "sealTransfer(uint256,uint64)", "setApprovalForAllUntil(address,uint64)", "setApprovalForAll(address,bool)", "approve(address,uint256)", "revokeAllApprovals()",
      "rightsOf(uint256,address)", "coreOf(uint256)", "getTraitValue(uint256,bytes32)", "getStateFingerprint(uint256)", "custodyEpoch(uint256)"],
     ["keys", "setEncryptionKey(uint16,bytes)", "keyIdOf(address)"],
     ["parley", "bindKey(uint256)", "keyOf(uint256)"],
     ["market", LIST, "delist(uint256)", "buy(uint256,uint256,bytes32)", "claim()", "listingOf(uint256)", "owed(address)"],
     ["reach", "sealedUntil()"], ["pool", "marketOf(uint256)"],
     ["roles", "liveRoleCount(uint256)", "USER()", "recipientOf(address,uint256,bytes32)", "roleData(address,uint256,bytes32)",
      "roleExpirationDate(address,uint256,bytes32)", "roleEpoch(uint256,bytes32)"]].forEach(function (r) { r.slice(1).forEach(function (s) { M[r[0] + "." + s.split("(")[0]] = s; }); });
    /* the Nameplate's two rows are named by the catalogue, not by the function (nameFor is tokenForName) */
    M["nameplate.nameFor"] = "tokenForName(bytes)"; M["nameplate.nameExpiry"] = "expiry(bytes32)";
    ui.rows(M);

    /*── words ──*/
    var lower = function (s) { return String(s).toLowerCase(); };
    var same = function (a, b) { return lower(a) === lower(b); };
    var none = function (a) { return same(a, ZERO); };
    var who = function (a) { return none(a) ? "nobody" : checksum(a); };
    var date = function (t) { return new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC"; };
    var hex = function (u) { return Array.from(u, function (b) { return b.toString(16).padStart(2, "0"); }).join(""); };
    var unhex = function (h) { return Uint8Array.from(String(h).replace(/^0x/, "").match(/../g) || [], function (x) { return parseInt(x, 16); }); };
    /* a read with no answer prints why, never a zero; the clock's refusal is its own sentence */
    var unread = function (e) { var m = e && e.message || String(e); return /clock/.test(m) ? m : "not reported: " + m; };
    var oops = function (e) { say(e && e.message || String(e), "err"); };
    /* every handler's refusals are thrown sentences, said once here — sync or async */
    var guard = function (f) { return function () { try { var r = f(); return r && r.catch ? r.catch(oops) : r; } catch (e) { oops(e); } }; };
    /* an address typed, 0x0 (or nothing) for none; whole numbers as digits only, then BigInt — never Number() */
    var addr = function (i, what) { var s = i.value.trim(); if (/^(0x0*)?$/i.test(s)) return ZERO; if (!isAddr(s)) throw Error(what + ": an address"); return s; };
    var digits = function (i, max, what) { var s = i.value.trim(); if (!/^\d+$/.test(s) || BigInt(s) > max) throw Error(what + ": a whole number up to " + max); return BigInt(s); };
    /* a field named for the suite, with what it starts as */
    var fld = function (p, n, label, v) { var i = field(p, label, ""); i.name = n; i.value = v || ""; return i; };
    /* a row whose value arrives later, found by its id */
    var slot = function (p, k, id) { var n = kv(p, k, "reading…").lastChild; if (id) n.id = id; return n; };
    var bad = function (g, n) { return function (e) { if (g === gen) n.textContent = unread(e); }; };
    /* one slab: the holder's by default; o carries the rest. No then(): every receipt fires intact:rights, which repaints */
    var send = function (to, key, args, lines, sentence, o) { return propose(Object.assign({ to: to, key: key, args: args, need: R.HOLD, lines: lines, sentence: sentence }, o)); };
    /* days typed become a date on the chain's clock, at the press; none typed needs no clock */
    var at = function (d) { return d ? clock().then(function (now) { return now + d * 86400n; }) : Promise.resolve(0n); };
    var gen = 0, hold, can, acct, MYPK = null;

    /*── the sealing key (CONSOLE §9, D7): the shell signs the sentence once; SHA-256 of the signature,
         re-hashed until 0 < d < n, is the scalar; the point is what WebCrypto computes on import ──*/
    var ORD = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
    var PK8 = "3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420";
    var urlBytes = function (s) { return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), function (c) { return c.charCodeAt(0); }); };
    function derive() {
      var sub = window.crypto && crypto.subtle;
      if (!sub) return Promise.reject(Error("sealing needs a secure origin"));
      return ui.sealSignature().then(function (sig) {
        var loop = function (u) { return sub.digest("SHA-256", u).then(function (x) { var h = new Uint8Array(x), d = BigInt("0x" + hex(h)); return d > 0n && d < ORD ? h : loop(h); }); };
        return loop(unhex(sig));
      }).then(function (h) { return sub.importKey("pkcs8", unhex(PK8 + hex(h)), { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]); })
        .then(function (k) { return sub.exportKey("jwk", k); })
        .then(function (j) { var raw = new Uint8Array(65); raw[0] = 4; raw.set(urlBytes(j.x), 1); raw.set(urlBytes(j.y), 33); MYPK = "0x" + hex(raw); });
    }

    /*═══════════ status: the rule verbatim, the holder's re-arm, the guardian's pause ═══════════*/
    function status(p, g, core) {
      p.append(el("h3", "", "status"));
      var st = slot(p, "status", "identity-status"), b = el("div"); p.append(b);
      note(p, "sessions act only while Active; a sale pauses the token; re-arm to let your keys act").id = "identity-status-rule";
      core.then(function (r) {
        if (g !== gen) return;
        var paused = !!r.w(0); st.textContent = paused ? "Paused" : "Active";
        if (!can) return;
        /* re-arming is the holder's (or the Reach's); a guardian may only ever pause */
        if (paused) hold && act(b, "setStatus", "re-arm: set Active", R.HOLD, function () {
          return send(HUB, "hub.setStatus", [ID, 0], [["Token", tok], ["Status", "Paused → Active"], ["Lets", "sessions and recipes act again, until it is paused or sold"]],
            "re-arms " + tok + ": its sessions and recipes act again until it is paused or sold");
        });
        else ui.rights() & (R.HOLD | R.GUARDIAN) && act(b, "pause", "pause it", R.HOLD | R.GUARDIAN, function () {
          return send(HUB, "hub.pause", [ID], [["Token", tok], ["Status", "Active → Paused"], ["Stops", "every session and recipe; only the holder re-arms"]],
            "pauses " + tok + ": no session or recipe acts until the holder re-arms it", { need: R.HOLD | R.GUARDIAN });
        });
      }, bad(g, st));
    }

    /*═══════════ rights of any address: one rightsOf, chips by right ═══════════*/
    function rights(p, g) {
      p.append(el("h3", "", "rights of any address"));
      var i = field(p, "an address", "0x…"); i.id = "identity-rights-input"; i.value = acct || "";
      var box = el("div"), fact = note(p, "", "s"), q = 0; box.id = "identity-rights-chips"; p.insertBefore(box, fact); fact.id = "identity-rights-fact";
      var ask = function () {
        var s = ++q, a = i.value.trim(); box.replaceChildren(); fact.textContent = a && !isAddr(a) ? "an address" : "";
        if (!isAddr(a)) return;
        fact.textContent = "reading…";
        read(HUB, "hub.rightsOf", [ID, a]).then(function (r) {
          if (s !== q || g !== gen) return;
          var b = r.w(0);
          for (var k in R) { var on = !!(b & BigInt(R[k])), c = ui.chip(box, k, on ? "on" : "off"); c.dataset.right = k; c.classList.toggle("on", on); }
          fact.textContent = "holder " + short(r.a(2)) + " · custody epoch " + r.w(1) + " · bits " + b;
        }, function (e) { if (s === q && g === gen) fact.textContent = unread(e); });
      };
      i.addEventListener("input", ask); ask();
    }

    /*═══════════ the fingerprint: the baked word beside the live one ═══════════*/
    function fingerprint(p, g) {
      p.append(el("h3", "", "fingerprint"));
      kv(p, "rendered", S.fingerprint).lastChild.id = "identity-fingerprint-baked";
      var live = slot(p, "live", "identity-fingerprint-live");
      read(HUB, "hub.getStateFingerprint", [ID]).then(function (r) {
        if (g !== gen) return;
        var h = "0x" + lower(r.words[0]); live.textContent = h + (same(h, S.fingerprint) ? " — as rendered" : " — changed since this document was rendered");
      }, bad(g, live));
    }

    /*═══════════ the account's 7702 code: the shell's reading, drawn on every paint ═══════════*/
    function delegate(p) {
      p.append(el("h3", "", "the account's code"));
      var d = ui.delegate();
      kv(p, "7702 delegate", !acct ? "not connected" : ui.mode() === "viewer" ? "not checked in the viewer" : d ? d.name + (d.acked ? " · acknowledged" : "") : "none: a plain account").lastChild.id = "identity-delegate";
      if (d && !d.known && !d.acked) {
        note(p, "an unknown delegate holds this account: nothing that spends is offered until you acknowledge it", "warn");
        ui.button(p, "I know this delegate: show what spends", true, function () { ui.ackDelegate(); }).id = "ack-delegate";
      }
    }

    /*═══════════ traits: the shell's own keccak names the keys; the curve moves no price until re-anchored ═══════════*/
    function traits(p, g) {
      p.append(el("h3", "", "traits"));
      var cv = slot(p, "curve", "identity-curve"), nm = slot(p, "name", "identity-name"), KC = ui.khex("curve"), KN = ui.khex("name"), cur = null, nam = "";
      read(HUB, "hub.getTraitValue", [ID, KC]).then(function (r) { if (g !== gen) return; cur = r.w(0); cv.textContent = cur + " bps"; }, bad(g, cv));
      read(HUB, "hub.getTraitValue", [ID, KN]).then(function (r) { if (g !== gen) return; nam = r.s(0); nm.textContent = nam || "—"; }, bad(g, nm));
      if (!hold) return;
      var fc = fld(p, "curve", "curve, in bps (≤ 80000): the market follows only when re-anchored on Swap", "0");
      act(p, "setTrait", "review the curve", R.HOLD, guard(function () {
        var v = digits(fc, 80000n, "the curve");
        if (cur == null) throw Error("the curve trait did not answer; nothing is guessed");
        return send(HUB, "hub.setTrait", [ID, KC, "0x" + v.toString(16).padStart(64, "0")],
          [["Token", tok], ["Trait", "curve " + cur + " bps → " + v + " bps"], ["Moves the price", "only when its holder re-anchors the market on Swap"]],
          "sets " + tok + "'s curve trait, curve " + cur + " bps → " + v + " bps; the market moves only when re-anchored to it");
      }));
      var fn = fld(p, "name", "name, up to 32 bytes of UTF-8 (empty: none)");
      act(p, "setTrait", "review the name", R.HOLD, guard(function () {
        var s = fn.value, u = new TextEncoder().encode(s);
        if (u.length > 32) throw Error("a name is at most 32 bytes and that is " + u.length);
        return send(HUB, "hub.setTrait", [ID, KN, "0x" + hex(u).padEnd(64, "0")], [["Token", tok], ["Trait", "name " + (nam || "—") + " → " + (s || "—")]],
          "sets " + tok + "'s name trait to " + (s ? "“" + s + "”" : "nothing") + ": the name Home and every marketplace print");
      }));
    }

    /*═══════════ the Core: guardian, user, agent wallet, income, face, seal — one read, many words ═══════════*/
    function core(p, g, cr) {
      var sec = function (title, id) { p.append(el("h3", "", title)); var n = slot(p, title, id), b = el("div"); p.append(b); return { n: n, b: b }; };
      var G = sec("guardian", "identity-guardian"), U = sec("user", "identity-user"), A = sec("agent wallet", "identity-agent"), P = kv(p, "proposed", "reading…");
      p.insertBefore(P, A.b); P = P.lastChild; P.id = "identity-proposed";
      var I = sec("income", "identity-income"), F = sec("pinned face", "identity-face"), T = sec("transfer seal", "identity-seal");
      cr.then(function (r) {
        if (g !== gen) return;
        var face = r.w(1), ep = r.w(3), seal = r.w(4), gd = r.a(6), grip = r.b(8), us = r.a(10), ux = r.w(11), aw = r.a(12), pw = r.a(13);
        G.n.textContent = who(gd) + (r.b(7) ? " · holding the token" : "");
        U.n.textContent = none(us) ? "nobody" : checksum(us) + " until " + date(ux);
        A.n.textContent = none(aw) ? "none: the Reach answers as it" : checksum(aw);
        P.textContent = none(pw) ? "none" : checksum(pw) + " · pending: it accepts by sending";
        I.n.textContent = grip ? "into the Grip: permanently unspendable" : "to the Reach";
        F.n.textContent = face ? "face " + (face - 1n) : "none: the Renderer chooses";
        T.n.textContent = seal ? "until " + date(seal) : "none";
        /* the proposed wallet accepts in its own transaction — proof of control by sending; anyone connected may be it */
        if (can && !none(pw) && same(acct, pw)) act(A.b, "acceptAgentWallet", "accept: become " + tok + "'s agent wallet", 0, function () {
          return send(HUB, "hub.acceptAgentWallet", [ID], [["Token", tok], ["Wallet", checksum(acct) + ": this one, by sending"]],
            "binds this wallet as " + tok + "'s agent wallet, by sending: a sale unbinds it", { need: 0 });
        });
        if (!hold) return;
        var fg = fld(G.b, "guardian", "guardian: an address (0x0 for none)", none(gd) ? "" : gd);
        act(G.b, "setGuardian", "review the guardian", R.HOLD, guard(function () {
          var a = addr(fg, "the guardian");
          return send(HUB, "hub.setGuardian", [ID, a], [["Token", tok], ["Guardian", who(gd) + " → " + who(a)], ["May", "pause, panic, seal and revoke sessions; never move or spend"]],
            "names " + who(a) + " the guardian of " + tok + ": it may pause, panic, seal and revoke sessions, and nothing else");
        }));
        var fu = fld(U.b, "user", "user: an address (0x0 takes it back)", none(us) ? "" : us), fd = fld(U.b, "userDays", "for how many days", "7");
        act(U.b, "setUser", "review the user", R.HOLD, guard(function () {
          var a = addr(fu, "the user"), d = none(a) ? 0n : digits(fd, 3650n, "the days");
          if (!none(a) && !d) throw Error("the days: at least one");
          return at(d).then(function (x) {
            return send(HUB, "hub.setUser", [ID, a, x], none(a) ? [["Token", tok], ["User", "none: taken back"]]
              : [["Token", tok], ["User", checksum(a)], ["Until", date(x)], ["Gets", "a sentence on Home; nothing to spend, speak or price"]],
              none(a) ? "takes " + tok + " back from its user" : "names " + checksum(a) + " the user of " + tok + " until " + date(x) + "; a sale ends it", { spend: true });
          });
        }), { spend: true });
        var fw = fld(A.b, "wallet", "agent wallet: an address (0x0 withdraws the proposal and unbinds)");
        act(A.b, "proposeAgentWallet", "review the proposal", R.HOLD, guard(function () {
          var a = addr(fw, "the wallet");
          return send(HUB, "hub.proposeAgentWallet", [ID, a], [["Token", tok], ["Proposed", who(a)], ["Bound", none(a) ? "nothing: the proposal and any bound wallet go" : "only when that wallet accepts, by sending"]],
            none(a) ? "withdraws " + tok + "'s agent wallet proposal and unbinds any bound wallet" : "proposes " + checksum(a) + " as " + tok + "'s agent wallet; it is bound only when it accepts, by sending", { spend: true });
        }), { spend: true });
        note(I.b, "income into the Grip is permanently unspendable: nothing moves it out again", "warn");
        act(I.b, "setFeesToGrip", grip ? "route income to the Reach again" : "route income into the Grip", R.HOLD, function () {
          return send(HUB, "hub.setFeesToGrip", [ID, !grip], [["Warning", "income into the Grip is permanently unspendable"], ["Token", tok], ["Income", grip ? "the Grip → the Reach" : "the Reach → the Grip, for good"]],
            grip ? "routes " + tok + "'s income to the Reach again; what the Grip holds stays unspendable" : "routes " + tok + "'s income into the Grip, where it is permanently unspendable; a sale clears the route");
        });
        var ff = fld(F.b, "face", "pin a face: 0, 1 or 2", "0");
        act(F.b, "pinTokenURI", "review the pin", R.HOLD, guard(function () {
          var i = digits(ff, 2n, "the face");
          return send(HUB, "hub.pinTokenURI", [ID, i], [["Token", tok], ["Face", i + ", until unpinned or sold"]], "pins face " + i + " as " + tok + "'s tokenURI; a sale unpins it");
        }));
        if (face) act(F.b, "unpinTokenURI", "unpin", R.HOLD, function () {
          return send(HUB, "hub.unpinTokenURI", [ID], [["Token", tok], ["Face", "the Renderer's choice again"]], "unpins " + tok + "'s face: the Renderer chooses again");
        });
        var fs = fld(T.b, "sealDays", "seal it against transfer for how many days (≤ 365; only ever longer)", "30");
        act(T.b, "sealTransfer", "review the seal", R.HOLD, guard(function () {
          var d = digits(fs, 365n, "the days"); if (!d) throw Error("the days: at least one");
          return at(d).then(function (u) {
            return send(HUB, "hub.sealTransfer", [ID, u], [["Token", tok], ["Until", date(u)], ["Moves", "for nobody before then: not the market, not the steward"], ["Reversible", "no: it only ever lengthens"]],
              "seals " + tok + " against transfer until " + date(u) + ": nobody moves it before then, and the seal only ever lengthens");
          });
        }));
      }, function (e) { [G.n, U.n, A.n, P, I.n, F.n, T.n].forEach(function (n) { bad(g, n)(e); }); });
    }

    /* a satellite whose bit is clear is a chip, never a zero (CONSOLE §6.3); 1 when it was drawn */
    var three = function (p, n) { var b = S.bits[n]; if (S.reported & b) return 0; ui.chip(p, n + ": " + (S.absent & b ? "not deployed on this chain" : "could not be read at block " + S.block), S.absent & b ? "absent" : "unread"); return 1; };
    var fmt = function (v) { return ui.fmt(v) + " ETH"; }, MOVED = "the listing or the token moved since it was read — review again";

    /*═══════════ roles (ERC-7432, U16): read here, granted nowhere on this page ═══════════*/
    function roles(p, g, cr) {
      p.append(el("h3", "", "roles"));
      var box = el("div"); box.id = "identity-roles"; p.append(box);
      if (three(box, "roles")) return;
      var RO = S.roles, n = slot(box, "live roles", "identity-role-count"), u = slot(box, "USER role", "identity-role-user");
      note(box, "a role holder reads what the role's data says; the page grants nothing on it", "s");
      read(RO, "roles.liveRoleCount", [ID]).then(function (r) { if (g === gen) n.textContent = String(r.w(0)); }, bad(g, n));
      read(RO, "roles.USER", []).then(function (k) {
        var K = "0x" + k.words[0];
        return Promise.all([read(RO, "roles.recipientOf", [HUB, ID, K]), read(RO, "roles.roleExpirationDate", [HUB, ID, K]), read(RO, "roles.roleData", [HUB, ID, K]), read(RO, "roles.roleEpoch", [ID, K]), cr]);
      }).then(function (v) {
        if (g !== gen) return;
        var to = v[0].a(0), e = v[3].w(0);
        /* recipientOf answers only a live grant; roleEpoch keeps the stamp of a dead one, so "none" and "died" are two facts */
        u.textContent = !none(to) ? checksum(to) + " until " + date(v[1].w(0)) + " · granted at epoch " + e + " · data " + (v[2].bytes(0).length - 2) / 2 + " bytes"
          : !e ? "none" : "none live: the grant stamped at epoch " + e + (e !== v[4].w(3) ? " died when the custody epoch moved" : " expired");
      }).catch(bad(g, u));
    }

    /*═══════════ the name (U18): <id>.intact.eth while the apex sits in a token's account; nothing is signed here ═══════════*/
    function ens(p, g) {
      /* no row at all on a band without a Nameplate, nor under a Catalog older than its pin (CONSOLE §6.2) */
      if (!S.bits.nameplate || S.absent & S.bits.nameplate) return;
      p.append(el("h3", "", "ENS"));
      var box = el("div"); box.id = "identity-ens"; p.append(box);
      if (three(box, "nameplate")) return;
      var NP = S.nameplate, n = slot(box, "name", "identity-ens-name"), nm = ID + ".intact.eth";
      /* DNS wire bytes: each label length-prefixed, then the root's zero; the registrar's clock is the lapse */
      var w = function (l) { return (l.length < 16 ? "0" : "") + l.length.toString(16) + hex(new TextEncoder().encode(l)); };
      Promise.all([read(NP, "nameplate.nameFor", ["0x" + w(String(ID)) + w("intact") + w("eth") + "00"]), read(NP, "nameplate.nameExpiry", [ui.khex("intact")]), clock()]).then(function (v) {
        if (g !== gen) return;
        var e = v[1].w(0);
        n.textContent = nm + (v[0].w(0) === ID ? " · resolves to this token's Reach; the registration lapses " + date(e) : e > v[2] || !e ? " · resolves to nothing: no token holds intact.eth" : " · resolves to nothing: intact.eth lapsed " + date(e));
      }, bad(g, n));
    }

    /*═══════════ the Market (U15): a listing is a seal to its expiry; a sale moves the epoch ═══════════*/
    function listing(p, g, cr) {
      p.append(el("h3", "", "listing"));
      var box = el("div"); box.id = "identity-listing"; p.append(box);
      if (three(box, "market")) return;
      var MK = S.market, of = slot(box, "offer", "identity-offer"), sl = slot(box, "seals", "identity-seals"), b = el("div"); box.append(b);
      Promise.all([read(MK, "market.listingOf", [ID]), read(HUB, "hub.getStateFingerprint", [ID]), read(S.reach, "reach.sealedUntil", []), read(S.pool, "pool.marketOf", [ID]), cr,
                   clock(), acct && read(MK, "market.owed", [acct])]).then(function (v) {
        if (g !== gen) return;
        /* Listing{seller, price, expiresAt, epoch, fingerprint, floors} behind one offset word; the floors' offset counts from the struct */
        var L = v[0], fp = "0x" + v[1].words[0], ru = v[2].w(0), open = v[3].b(7), mu = v[3].w(9), ep = v[4].w(3), now = v[5];
        var seller = L.a(1), price = L.w(2), until = L.w(3), lep = L.w(4), pin = "0x" + L.words[5], fo = 1 + Number(L.w(6)) / 32, fl = [];
        for (var i = 0; i < Number(L.w(fo)); i++) { var as = L.a(fo + 1 + 2 * i), mn = L.w(fo + 2 + 2 * i); fl.push(none(as) ? "ETH ≥ " + fmt(mn) : short(as) + " ≥ " + mn); }
        sl.textContent = "the Reach " + (ru ? "sealed until " + date(ru) : "unsealed") + " · the owned market " + (!open ? "closed" : mu ? "sealed until " + date(mu) : "open, unsealed");
        if (v[6] && v[6].w(0)) {
          var o = v[6].w(0); kv(b, "owed to this wallet", fmt(o) + ", from every sale it made").lastChild.id = "identity-owed";
          if (can) act(b, "claim", "claim " + fmt(o), 0, function () {
            return send(MK, "market.claim", [], [["Pays", fmt(o) + " to " + checksum(acct)], ["From", "every sale this wallet made"]],
              "claims the " + fmt(o) + " the Market owes this wallet", { need: 0 });
          });
        }
        if (none(seller)) {
          of.textContent = "not listed";
          if (!hold) return;
          var fpr = fld(b, "price", "price, in ETH"), fd = fld(b, "listDays", "for how many days (≤ 365)", "7");
          return act(b, "list", "review the listing", R.HOLD, guard(function () {
            var pr = /^\d*\.?\d+$/.test(fpr.value.trim()) ? ui.parse(fpr.value) : 0n, d = digits(fd, 365n, "the days");
            if (!pr) throw Error("the price: more than 0 ETH, in decimal");
            if (!d) throw Error("the days: at least one");
            return at(d).then(function (x) {
              if (ru < x || (open && mu < x)) throw Error("a listing until " + date(x) + " needs " + (ru < x ? "the Reach sealed until then (Vault)" : "") + (ru < x && open && mu < x ? " and " : "") + (open && mu < x ? "the market sealed until then (Swap)" : ""));
              var E = ui.enc, data = S.sel["market.list"] + E.W(ID) + E.W(pr) + E.W(x) + E.B32(fp) + E.W(160) + E.W(0);
              return send(MK, null, null, [["Token", tok], ["Price", fmt(pr) + ", exactly"], ["Until", date(x)], ["Floors", "none: the fingerprint and the seals bind it"]],
                "lists " + tok + " on the Market at " + fmt(pr) + " until " + date(x) + ": it stays locked to the listing, and whoever pays exactly that takes it, moving its custody epoch",
                { data: data, sig: LIST, recheck: function () { return read(HUB, "hub.getStateFingerprint", [ID]).then(function (r) { return same("0x" + r.words[0], fp) ? "" : MOVED; }); } });
            });
          }));
        }
        /* dead is expired or stale: nothing can buy it, and anyone may clear the lock it leaves (Market.delist) */
        var dead = now >= until ? "expired" : lep !== ep ? "stale: the custody epoch moved" : "";
        of.textContent = fmt(price) + " until " + date(until) + " · by " + checksum(seller) + " · epoch " + lep + (dead ? " · " + dead + "; nothing can buy it" : "");
        kv(b, "pinned fingerprint", pin + (same(pin, fp) ? " — as live" : " — moved since it was pinned: a buy reverts")).lastChild.id = "identity-pinned";
        kv(b, "floors", fl.length ? fl.join(" · ") : "none");
        if (!can) return;
        if (dead || hold) return act(b, "delist", dead ? "clear the dead listing" : "take the listing down", dead ? 0 : R.HOLD, function () {
          return send(MK, "market.delist", [ID], [["Token", tok], ["Listing", dead || "live: yours to end"], ["Releases", "its lock on " + tok]],
            "takes " + tok + "'s listing down and releases the lock it holds", { need: dead ? 0 : R.HOLD });
        });
        act(b, "buy", "buy " + tok + " for " + fmt(price), 0, function () {
          return send(MK, "market.buy", [ID, price, pin], [["Token", tok], ["Pays", fmt(price) + ", the listed price exactly"], ["Against", "fingerprint " + pin.slice(0, 10) + "… · custody epoch " + lep]],
            "buys " + tok + " for " + fmt(price) + ": the Market checks the fingerprint, the epoch and the floors, credits the seller and moves the token here, ending every authority the seller gave",
            { need: 0, value: price, recheck: function () {
              return Promise.all([read(MK, "market.listingOf", [ID]), read(HUB, "hub.getStateFingerprint", [ID]), read(HUB, "hub.custodyEpoch", [ID])]).then(function (w) {
                var l = w[0]; return same(l.a(1), seller) && l.w(2) === price && same("0x" + l.words[5], pin) && same("0x" + w[1].words[0], pin) && w[2].w(0) === lep ? "" : MOVED;
              });
            } });
        });
      }, function (e) { bad(g, of)(e); bad(g, sl)(e); });
    }

    /*═══════════ operators and approvals: per owner, over every token the wallet holds ═══════════*/
    function operators(p) {
      p.append(el("h3", "", "operators and approvals"));
      note(p, "operator approvals are per owner: one covers every token you hold, not only " + tok + "; revoking all drops every operator in one write");
      if (!hold) return;
      var SCOPE = ["Scope", "every token you hold, not only " + tok], fo = fld(p, "operator", "operator: an address"), fd = fld(p, "opDays", "for how many days (0 revokes this operator)", "30");
      act(p, "setApprovalForAllUntil", "review the timed approval", R.HOLD, guard(function () {
        var a = addr(fo, "the operator"), d = digits(fd, 3650n, "the days"); if (none(a)) throw Error("the operator: an address");
        return at(d).then(function (u) {
          return send(HUB, "hub.setApprovalForAllUntil", [a, u], [["Operator", checksum(a)], SCOPE, ["Until", d ? date(u) : "now: revoked"], ["May", "move them, not speak or spend"]],
            d ? "lets " + checksum(a) + " move every token you hold until " + date(u) : "revokes " + checksum(a) + " as an operator over every token you hold", { spend: true });
        });
      }), { spend: true });
      act(p, "setApprovalForAll", "review the unbounded approval", R.HOLD, guard(function () {
        var a = addr(fo, "the operator"); if (none(a)) throw Error("the operator: an address");
        return send(HUB, "hub.setApprovalForAll", [a, true], [["Operator", checksum(a)], SCOPE, ["Until", "revoked: an unbounded ERC-721 grant"]],
          "lets " + checksum(a) + " move every token you hold, with no end until revoked", { spend: true });
      }), { spend: true });
      var fa = fld(p, "approvee", "approve one address for " + tok + " (0x0 clears it)");
      act(p, "approve", "review the single approval", R.HOLD, guard(function () {
        var a = addr(fa, "the approvee");
        return send(HUB, "hub.approve", [a, ID], [["Token", tok], ["Approved", who(a)], ["May", "move " + tok + " once, not speak or spend"]],
          none(a) ? "clears the single approval on " + tok : "lets " + checksum(a) + " move " + tok + "; a sale clears it", { spend: true });
      }), { spend: true });
      act(p, "revokeAllApprovals", "revoke every operator", R.HOLD, function () {
        return send(HUB, "hub.revokeAllApprovals", [], [["Owner", checksum(acct)], SCOPE, ["Drops", "every operator approval you ever granted, in one write"]],
          "revokes every operator approval " + checksum(acct) + " ever granted, over every token it holds, in one write");
      });
    }

    /*═══════════ the sealing key: the registry, then the binding ═══════════*/
    function key(p, g, cr) {
      p.append(el("h3", "", "sealing key"));
      note(p, "one P-256 key per wallet, derived from one signature; sign this sentence nowhere but here: whoever holds that signature can read your sealed messages; there is no forward secrecy.");
      var ks = slot(p, "bound key", "identity-key"), b = el("div"); p.append(b);
      Promise.all([read(S.parley, "parley.keyOf", [ID]), acct && read(S.keys, "keys.keyIdOf", [acct]), cr]).then(function (v) {
        if (g !== gen) return;
        var t = v[0].w(0), id = "0x" + v[0].words[1], pk = v[0].bytes(2), rid = v[1] && "0x" + v[1].words[0], pub = !!(rid && BigInt(rid));
        ks.textContent = pk === "0x" ? "no key bound" : "bound at epoch " + v[2].w(3) + " · " + (t === 3n ? "P-256" : "type " + t) + " · key " + id.slice(0, 10) + "…";
        if (!hold) return;
        kv(b, "this wallet's registry key", pub ? "published · id " + rid.slice(0, 10) + "…" + (MYPK && same(ui.kbytes(MYPK), rid) ? " · the one derived here" : "") : "none published").lastChild.id = "identity-registry";
        act(b, "setEncryptionKey", (MYPK ? "publish" : "derive and publish") + " the sealing key", R.HOLD, guard(function () {
          return (MYPK ? Promise.resolve() : derive()).then(function () {
            return send(S.keys, "keys.setEncryptionKey", [3, MYPK], [["Wallet", checksum(acct)], ["Key", "P-256, 65 bytes, derived from this wallet's signature: " + MYPK.slice(0, 12) + "…"], ["Then", "bind it to " + tok + " with the next control"]],
              "publishes this wallet's P-256 sealing key in the registry: whoever holds the signature it came from can read what is sealed to it");
          });
        }));
        if (pub) act(b, "bindKey", "bind the registry key to " + tok, R.HOLD, function () {
          return send(S.parley, "parley.bindKey", [ID], [["Token", tok], ["Key", "this wallet's registry key, id " + rid.slice(0, 10) + "…"], ["Dies", "with a sale or a panic: the binding carries the custody epoch"]],
            "binds this wallet's registry key to " + tok + " at custody epoch " + v[2].w(3) + "; a sale or a panic unbinds it");
        });
      }, bad(g, ks));
    }

    /*═══════════ the hash manifest ═══════════*/
    function manifest(p) {
      p.append(el("h3", "", "hash manifest"));
      var m = el("div"); m.id = "identity-manifest"; p.append(m);
      kv(m, "engine", S.engineHash); kv(m, "catalog", S.catalogHash);
      for (var k in S.panels) kv(m, "panel " + k, S.panels[k]);
      note(p, (S.bits.nameplate && !(S.absent & S.bits.nameplate) ? "" : "no ENS name on this band: there is no Nameplate; ") + "a key is replaced by publishing and binding again, never revoked here", "s");
    }

    /*═══════════ paint ═══════════*/
    function paint() {
      var g = ++gen; host.replaceChildren();
      if (!ID) return note(host, "a token's identity: open one to see its status, rights, keys and hashes"), S.loaded.identity = true;
      /* the scalar is the wallet's (D7): another account derives its own */
      if (acct !== ui.account()) MYPK = null;
      acct = ui.account();
      /* one sentence when nobody here can press anything — the viewer, a session, not connected, rights unread,
         a renter, an operator, a guardian, a stranger — and none per control; even the anyone-control waits
         for a rights read that answered (unread rights are not a stranger's) */
      ui.gate(host, R.HOLD);
      can = ui.mode() === "console" && !!acct && ui.rights() !== null; hold = !!(can && ui.rights() & R.HOLD);
      var cr = read(HUB, "hub.coreOf", [ID]); cr.catch(function () {});
      status(host, g, cr); rights(host, g); roles(host, g, cr); fingerprint(host, g); delegate(host); traits(host, g); core(host, g, cr); listing(host, g, cr); operators(host); key(host, g, cr); ens(host, g); manifest(host);
      S.loaded.identity = true;
    }
    paint();
    /* every receipt, every connect, ackDelegate and every epoch move repaint: this lane keeps no typed state worth more than the facts */
    window.addEventListener("intact:rights", paint);
    window.addEventListener("intact:epoch", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "identity") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
