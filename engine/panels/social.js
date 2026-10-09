/*  INTACT panel "social" — the tokens talk to each other, and the archive
    is the chain. Injected as a Blob script after the shell keccak'd these
    bytes against window.INTACT.panels.social. One IIFE, nothing at top
    level (terser mangles the shell's top level to one-letter names; a
    top-level const here would collide and the panel would never run —
    E §3.4; the build refuses one). Every text node through textContent.
    Every write through INTACT.ui.propose; the one approval through
    INTACT.ui.approveExactThen, exact, as the button's current step.

    Origin: IPSEITY engine/console-lanes.js LANE[5] "SPEAK AS IT" (branch
    claude/claude-md-docs-8vvyc8, lines 828–1056) and src/DeskSeal.sol's
    SEAL_JS with PR #27's per-send key re-read (B §4), ported onto the panel
    contract (docs/CONSOLE.md §5): the donor's provider() became ui.read /
    ui.walkLogs / ui.propose; its propose(title, lines, tx) became ui.propose
    with a sentence, lines and a recheck; mine() became ui.act on the rights
    bits; window.CON became window.INTACT (B §1.7). What INTACT changed in
    the walk: Said carries two more head words (prevFrom, seq) and a reply
    pointer, so the body offset moved from word 4 to word 6, and the count
    comes from stateOf(room) word 1 — heads() returns blocks and is never
    called here. What the donor left unbuilt and this lane builds: the home
    room and its followers (the Roster), groups (found, join, leave,
    invite), sealed whispers through engine/whispers.mjs, postage, and the
    inbox. The donor's Echoed walk (a LayerZero port) is dropped: INTACT
    federates nothing. The donor's opening sentence about the archive is
    kept in substance and shortened for the byte ceiling (8,192 B gzip).

    The sealing flow (CONSOLE §9, D7): one P-256 key per WALLET, derived from
    the shell's one personal_sign of "INTACT seal v1 · chain <c> · hub <hub>"
    — the registry is address-keyed, so a per-token sentence would make a
    two-token holder's second binding erase the first; epoch death comes
    from Parley.Binding{owner, epoch}. The signature and the scalar live in
    this closure (MY) and never on window.INTACT. Before every sealed send
    the recipient's key is re-read twice — once when the slab is built and
    once inside the slab's go handler through `recheck` — and a key that
    moved, a key that is not P-256, or a missing crypto.subtle is a sentence
    that closes the slab; nothing is ever downgraded to plain text (PR #27
    failed open to plaintext; INTACT does not). Either read of a moved key
    re-arms the room to the key it found: the go-handler read once refused
    and left the status naming the key that had moved (found by review).
    The scalar is the wallet's, so paint() drops it when another account
    connects: wallet B, in the page where wallet A had derived, was once
    told that the key "this wallet derives" is not the one bound, and was
    offered no derivation of its own (found by review). The key versions in
    the AAD are the two key ids exactly as Parley handed them back — read,
    never recomputed here. A plain whisper is offered only where the room
    cannot be sealed, and the control says "in the clear".

    A reply that lands after a newer ask paints nothing. walk() keeps a
    generation on its feed (feed.g) and checks it before every row and every
    status; arm()'s keys, and the stamp row its receipts paint, check a
    lane-wide count of asks (lane-wide because `armed` is). A refused
    receipts read still prints its note under whatever recipient is showing:
    a line beside the status, never the status, and guarding it measured
    +4 B of gzip against a 5 B margin. A second recipient typed before the
    first one's reads answered once got the first pair's row and its count,
    a second composer, and `armed` still holding the first pair's key, so a
    room with no key at all was labelled sealed (found by review; the press
    re-reads keyOf(to) and refused, so nothing was ever sealed to the wrong
    key). Two walks on one feed had already painted 6 rows for 3 on a
    receipt before this lane landed. The stamp a pair remembers once
    pendingOf has forgotten it (expire deletes the pointer; the refund is
    still to claim) is that pair's, lastStamp[room]: a single slot once
    followed the lane into every other pair, expire control and all (found
    by review).

    Two room keys are computed here with the shell's proven keccak, exactly
    as Parley derives them, because no row serves either: the pair room
    keccak(abi.encodePacked(uint8(2), lo, hi)) and another token's home room
    keccak(abi.encodePacked(uint8(3), token)). CONSOLE §5 names only the pair
    key; the home key is the second, and the follow control needs it.

    The marker on the first line of the IIFE is where tools/build-app.mjs
    inlines engine/whispers.mjs, so this panel may not declare enc, dec,
    bytes, text, b64, un64, random, subtle, equal, pub, priv, shared,
    passwordKey, whisperScope, publicHex, hexPublic, createMessagingKey,
    messageContext, encryptWhisper, decryptWhisper, encryptKeyBackup or
    decryptKeyBackup (CONSOLE §5); ui.enc is E here, and the module's own
    bytes()/text() — the fatal UTF-8 pair — encode and decode every body.

    Not in the MVB (CONSOLE §14), and the lane says so where a holder would
    look: reactions ("reactions unavailable on this chain", under the
    commons), the steward tools evict/setCooldown/hide (under the rooms).
    revokeEncryptionKey has no control anywhere; a key is replaced by
    binding again, on Identity, which also holds the two binding slabs.

    Elements this panel introduces (CONSOLE §6.2; the suite reads them
    scoped to #lane-social):
      #social-commons .row (.who, .body)   the commons walk, oldest first; .who is "#<id>"
      #social-commons-status               all N messages / …back past block B / the refusal
      #social-composer                      the commons composer: a textarea and [data-act=speak],
                                            [data-act=speakAsReach]; or #social-why with the sentence
      #social-why                           why this hand may not speak (renter, operator, guardian,
                                            session, stranger, nobody, viewer, unread rights)
      #social-home, #social-home-feed .row  the home room; "this token has not spoken yet" while silent
      #social-followers .token              the Roster's members of the home room, "#<id>"
      #social-follow                        the field: another token's number, to follow its home
      #social-rooms .room                   every room this token ever entered (roomsOf), named from
                                            the Founded log at stateOf(room).opened
      #social-found-name                    the found form's name field
      #social-dm, #social-dm-to             the DM screen and its recipient field
      #social-dm-status                     the arming sentence: sealed · …, or why not
      #social-dm-derive                     derives the sealing key (the shell's one personal_sign)
      #social-dm-feed .row                  the pair room walk; sealed rows open when the key fits
      #social-inbox, #social-receipts       inboxOf as facts, the configure form, stamps and the ledger
      [data-act=speak|speakAsReach|whisper|found|join|leave|invite|configureInbox|expire|claimRefund|claimSettled]
    Sentences the group proves (tools/verify-site/social.mjs): "a renter
    sees the walk and the sentence", "the composer appears only for HOLD or
    ACCOUNT".                                                                 */
(function () {
  /*@inline engine/whispers.mjs*/
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("social"), E = ui.enc, R = S.rights, ID = BigInt(S.id), CHAIN = String(S.chainId), ZERO = "0x" + "0".repeat(40);
    var NEED = R.HOLD | R.ACCOUNT, HOME = 3, LABEL = "intact-whisper/1", AGAIN = " — review again", CLEAR = "in the clear";
    ui.rows({
      "parley.speak": "speak(uint256,uint256,uint8,uint64,uint64,bytes)",
      "parley.whisper": "whisper(uint256,uint256,uint8,bytes32,bytes)",
      "parley.whisperStamped": "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)",
      "parley.found": "found(uint256,string,bool)", "parley.join": "join(uint256,uint256)", "parley.leave": "leave(uint256,uint256)",
      "parley.invite": "invite(uint256,uint256,uint256)", "parley.keyOf": "keyOf(uint256)", "parley.stateOf": "stateOf(uint256)",
      "parley.roomsOf": "roomsOf(uint256)", "roster.membersOf": "membersOf(uint256,uint256)",
      "postage.configureInbox": "configureInbox(uint256,address,uint128,uint64,bool)", "postage.inboxOf": "inboxOf(uint256)",
      "postage.expire": "expire(uint256)", "postage.claimRefund": "claimRefund(uint256)", "postage.claimSettled": "claimSettled(uint256,address)",
      "postage.owed": "owed(address,address)", "postage.pendingOf": "pendingOf(uint256)", "postage.stampOf": "stampOf(uint256)",
      "reach.execute": "execute(address,uint256,bytes,uint8)", "hub.custodyEpoch": "custodyEpoch(uint256)",
      "erc20.symbol": "symbol()", "erc20.decimals": "decimals()"
    });
    /* rows name only what this panel calls: the exact approve and the allowance it checks are the
       shell's (approveExactThen declares and calls its own); declared here as well, they were 24 B
       of gzip that paid for nothing (found by review) */

    /*── helpers: hex both ways (the module's bytes()/text() do UTF-8), the two room keys, dates ──*/
    var hex = function (u) { return Array.from(u, function (b) { return b.toString(16).padStart(2, "0"); }).join(""); };
    var unhex = function (h) { return Uint8Array.from(String(h).replace(/^0x/, "").match(/../g) || [], function (x) { return parseInt(x, 16); }); };
    var lower = function (s) { return String(s).toLowerCase(); };
    var same = function (a, b) { return lower(a) === lower(b); };
    var isEth = function (a) { return same(a, ZERO); };
    var date = function (t) { return new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC"; };
    var cut = function (s) { return s.length > 70 ? s.slice(0, 70) + "…" : s; };
    var unread = function (e) { return "not reported: " + (e && e.message || e); };
    var tok = function (n) { return "#" + n; };
    /* the pair room and a home room, derived as Parley derives them (src/Parley.sol pairKey, homeKey) */
    var pairKey = function (a, b) { var lo = a < b ? a : b, hi = a < b ? b : a; return BigInt(ui.kbytes("0x02" + E.W(lo) + E.W(hi))); };
    var homeKey = function (t) { return BigInt(ui.kbytes("0x03" + E.W(t))); };
    var topicOf = function (room) { return "0x" + E.W(room); };
    /* a whole number typed: digits only, then BigInt — never Number() */
    var digits = function (s, what) { s = String(s).trim(); if (!/^\d+$/.test(s)) { ui.say(what + ": a whole number", "err"); return null; } return BigInt(s); };
    /* a body: UTF-8, 1..1024 bytes for a plain word; the count is said when it is over */
    var bodyOf = function (s) {
      var u = bytes(String(s)); if (!String(s).trim()) { ui.say("something to say", "err"); return null; }
      if (u.length > 1024) { ui.say("1024 bytes at most; that is " + u.length + " — say it in two", "err"); return null; }
      return "0x" + hex(u);
    };
    /* a coin's symbol and exponent; the exponent stays null when decimals() did not answer, and every amount for that coin refuses */
    var coin = function (a) { return isEth(a) ? Promise.resolve(["ETH", 18]) : Promise.all([
      ui.read(a, "erc20.symbol", []).then(function (x) { return x.s(0).slice(0, 32); }, function () { return ui.short(a); }),
      ui.read(a, "erc20.decimals", []).then(function (x) { return Number(x.w(0)); }, function () { return null; })]); };
    var amt = function (v, cs) { return (cs[1] == null ? v + " units of" : ui.fmt(v, cs[1], cs[1])) + " " + cs[0]; };
    var NOPOINT = "decimals did not answer; the point is not guessed";

    /*── state the lane keeps between paints ──*/
    var MY = null, MYPK = null, other = 0n, armed = null, asks = 0, lastStamp = {}, seenBits, seenAcct, dmTo = "", dmText = "", refreshers = [];

    /*═══════════ the walk: one stateOf, then one single-block eth_getLogs per hop, oldest first on screen ═══════════
         The pointer onward is the OLDEST message's prev — messages that share a block point within it,
         and only the first one points out of it. Twelve hops, then the count of what lies deeper.
         INTACT's Said: prev(0) prevFrom(1) seq(2) kind(3) reBlock(4) reSeq(5) offset(6) length body. */
    var said = function (log) {
      var d = String(log.data).slice(2), w = function (i) { return BigInt("0x" + d.substr(64 * i, 64)); };
      var off = Number(w(6)) * 2, len = Number(BigInt("0x" + d.substr(off, 64)));
      return { prev: w(0), kind: Number(w(3)), from: BigInt(log.topics[2]), hex: d.substr(off + 64, len * 2) };
    };
    function row(feed, m, opener) {
      var r = ui.el("div", "row kv"), b = ui.el("span", "v body");
      r.append(ui.el("span", "k who", tok(m.from)), b);
      if (m.kind === 1) { b.textContent = "— a sealed message —"; b.classList.add("s"); if (opener) opener(m, b); }
      else { try { b.textContent = text(unhex(m.hex)); } catch (e) { b.textContent = "— not text —"; b.classList.add("s"); } }
      feed.insertBefore(r, feed.firstChild);
    }
    /* a walk owns its feed until the next walk on it starts: `g` is this walk's generation, and every
       write — a row, the status, a refusal — goes through a check of it. Without one, a pair room typed
       over before its walk answered kept the first pair's rows and "all 1 message" under the second
       recipient (found by review) */
    function walk(feed, status, room, silent, opener) {
      var g = feed.g = {}, put = function (s) { if (feed.g === g) status.textContent = s; };
      feed.replaceChildren(); put("reading…");
      return ui.read(S.parley, "parley.stateOf", [room]).then(function (r) {
        if (feed.g !== g) return;
        var last = r.w(0), count = r.w(1), hops = 0;
        if (!last) return put(silent);
        var step = function (blk) {
          if (!blk) return put("all " + count + (count === 1n ? " message" : " messages"));
          if (hops++ >= 12) return put("…older messages past block " + blk + "; " + count + " ever said here");
          var b = "0x" + blk.toString(16);
          return ui.walkLogs({ address: S.parley, fromBlock: b, toBlock: b, topics: [S.topics.said, topicOf(room)] }).then(function (logs) {
            if (feed.g !== g) return;
            if (!logs || !logs.length) return put("no logs at block " + blk);
            var oldest; for (var i = logs.length - 1; i >= 0; i--) { oldest = said(logs[i]); row(feed, oldest, opener); }
            return step(oldest.prev);
          }, function (e) { put("eth_getLogs refused; the walk cannot start: " + (e && e.message)); });
        };
        return step(last);
      }, function (e) { put("the room " + unread(e)); });
    }

    /*═══════════ who may speak: the composer for HOLD|ACCOUNT, the sentence for everyone else ═══════════
         #social-why says what the shell's gate does not: the user's sentence names the Reach as the
         token's other hand, the guardian's and the stranger's say who speaks, and a session key's wallet
         connected in the console (no ?as) gets CONSOLE §3's session sentence — the shell's why() has no
         SESSION branch outside session mode, and this lane printed the stranger's sentence to a wallet
         Home was calling a session (found by review; the shell's own gap is reported, not fixed here).
         The operator's sentence is the shell's OPER byte for byte, for exactly the bits that reach that
         branch, so ui.gate prints it: one copy of it, and 17 B of gzip toward the guards above. */
    var SPEAK = "only the holder — or the token's own Reach — may speak as it";
    function whyNot(p, withId) {
      var b = ui.rights(), s = ui.mode() !== "console" || !ui.account() || b === null ? null
        : b & R.USE ? "you are the user; " + SPEAK
        : b & R.CUSTODY ? null
        : b & R.GUARDIAN ? "a guardian does not speak as the token"
        : b & R.SESSION ? "a session speaks only through the Reach"
        : "no right on " + tok(ID) + "; " + SPEAK;
      if (s) p.append(ui.el("p", "blurb gate", s)); else ui.gate(p, NEED);
      var g = p.querySelector(".gate"); if (g && withId) g.id = "social-why";
    }
    /* rights() is null or a number, and null & NEED is already 0: the null test this once spelled out
       bought nothing and cost bytes the guards needed */
    var speaks = function () { return ui.mode() === "console" && ui.rights() & NEED; };
    /* `where` is a function: a room's name arrives from the Founded log after the composer is built */
    function composer(p, room, where, withId) {
      var box = ui.el("div"); if (withId) box.id = "social-composer"; p.append(box);
      if (!speaks()) return whyNot(box, withId);
      var ta = ui.el("textarea"); ta.placeholder = "a log, forever, readable by anyone"; box.append(ta);
      var tx = function () {
        var h = bodyOf(ta.value); if (!h) return null;
        return { args: [room, ID, 0, 0, 0, h], lines: [["Room", where()], ["Token", tok(ID)], ["Says", cut(ta.value)]],
                 sentence: "says, as " + tok(ID) + ", in " + where() + ", forever: " + cut(ta.value), then: function () { ta.value = ""; } };
      };
      ui.act(box, "speak", "review the message", NEED, function () {
        var t = tx(); if (!t) return;
        return ui.propose({ to: S.parley, key: "parley.speak", args: t.args, need: NEED, lines: t.lines, sentence: t.sentence, then: t.then });
      });
      /* the token's own hand: the Reach is admitted by mayActAs, so the holder may say it through the account */
      ui.act(box, "speakAsReach", "say it through the Reach", R.HOLD, function () {
        var t = tx(); if (!t) return;
        return ui.propose({ to: S.reach, key: "reach.execute", args: [S.parley, 0, ui.data("parley.speak", t.args), 0], need: R.HOLD, lines: t.lines, sentence: "the Reach " + t.sentence, then: t.then });
      });
      ui.note(box, "deleting is not possible: a message is a log", "s");
    }

    /*═══════════ the commons ═══════════*/
    function commons(p) {
      p.append(ui.el("h3", "", "the commons"));
      ui.note(p, "every message points at the block before it; the chain is the index.");
      var feed = ui.el("div"); feed.id = "social-commons"; p.append(feed);
      var status = ui.note(p, "", "s"); status.id = "social-commons-status";
      var go = function () { return walk(feed, status, 0n, "nothing has ever been said in the commons on this chain"); };
      go(); refreshers.push(go);
      composer(p, 0n, function () { return "the commons"; }, true);
      ui.note(p, "reactions unavailable on this chain", "s");
    }

    /*═══════════ the home room and its followers (the Roster) ═══════════*/
    function home(p) {
      var h = ui.el("div"); h.id = "social-home"; p.append(h);
      h.append(ui.el("h3", "", "its home room"));
      var room = S.home ? BigInt(S.home.room) : homeKey(ID);
      if (!S.home) ui.note(h, "home room: could not be read at block " + S.block, "warn");
      var feed = ui.el("div"); feed.id = "social-home-feed"; h.append(feed);
      var status = ui.note(h, "", "s");
      var fl = ui.el("div"); fl.id = "social-followers"; h.append(ui.el("div", "k", "followers"), fl);
      var go = function () {
        walk(feed, status, room, "this token has not spoken yet");
        fl.replaceChildren();
        ui.read(S.roster, "roster.membersOf", [room, 0]).then(function (r) {
          var ids = r.arr(0);
          if (!ids.length) return ui.note(fl, "no followers yet", "s");
          ids.forEach(function (id) { fl.append(ui.el("span", "chip token", tok(id))); });
        }, function (e) { ui.note(fl, "followers " + unread(e), "warn"); });
      };
      go(); refreshers.push(go);
      composer(h, room, function () { return "its home room"; }, false);
      /* following is joining another token's home; it exists only after that token's first word there */
      var fo = ui.el("div"); h.append(fo);
      var f = ui.field(fo, "follow a token by number", "2"); f.id = "social-follow";
      ui.act(fo, "join", "follow its home", NEED, function () {
        var n = digits(f.value, "the token"); if (n == null) return;
        if (n === ID) return ui.say("already home", "err");
        return ui.propose({ to: S.parley, key: "parley.join", args: [homeKey(n), ID], need: NEED, lines: [["Follows", tok(n) + "'s home room"], ["As", tok(ID)]],
          sentence: tok(ID) + " joins " + tok(n) + "'s home room as a follower; a home that has not spoken yet refuses" });
      });
    }

    /*═══════════ the rooms this token has entered: found, join, leave, invite; a composer in each it is in ═══════════*/
    function rooms(p) {
      var box = ui.el("div"); box.id = "social-rooms"; p.append(box);
      box.append(ui.el("h3", "", "rooms"));
      var list = ui.el("div"); box.append(list);
      var go = function () {
        list.replaceChildren();
        ui.read(S.parley, "parley.roomsOf", [ID]).then(function (r) {
          var keys = r.arr(0), member = r.arr(1, "bool");
          if (!keys.length) ui.note(list, "no rooms yet", "s");
          keys.forEach(function (key, i) {
            var d = ui.el("div", "room"); list.append(d);
            var title = ui.kv(d, "room", "reading…"), named = function () { return "the room " + title.firstChild.textContent; };
            ui.read(S.parley, "parley.stateOf", [key]).then(function (st) {
              var kind = Number(st.w(4)), steward = st.w(6), opened = "0x" + st.w(2).toString(16);
              var fact = st.w(1) + " said · " + st.w(3) + " members · " + (st.b(5) ? "open door" : "by invitation");
              if (kind === HOME) { title.firstChild.textContent = "home of " + tok(steward); title.lastChild.textContent = fact; }
              else ui.walkLogs({ address: S.parley, fromBlock: opened, toBlock: opened, topics: [S.topics.founded, topicOf(key)] }).then(function (logs) {
                var lg = logs && logs[0], name = "a room"; if (lg) { var h = String(lg.data).slice(2), off = Number(BigInt("0x" + h.substr(128, 64))) * 2, len = Number(BigInt("0x" + h.substr(off, 64))); try { name = text(unhex(h.substr(off + 64, len * 2))); } catch (e) {} }
                title.firstChild.textContent = name; title.lastChild.textContent = fact + " · founded by " + tok(steward);
              }, function () { title.firstChild.textContent = "a room"; title.lastChild.textContent = fact; });
              if (member[i]) {
                ui.act(d, "leave", "leave", NEED, function () {
                  return ui.propose({ to: S.parley, key: "parley.leave", args: [key, ID], need: NEED, lines: [["Leaves", named()], ["As", tok(ID)]], sentence: tok(ID) + " leaves " + named() });
                });
                composer(d, key, named, false);
              } else ui.act(d, "join", "join again", NEED, function () {
                return ui.propose({ to: S.parley, key: "parley.join", args: [key, ID], need: NEED, lines: [["Joins", named()], ["As", tok(ID)]], sentence: tok(ID) + " joins " + named() });
              });
              if (kind !== HOME && steward === ID) {
                var inv = ui.field(d, "invite a token by number", "2");
                ui.act(d, "invite", "invite", NEED, function () {
                  var n = digits(inv.value, "the token"); if (n == null) return;
                  return ui.propose({ to: S.parley, key: "parley.invite", args: [key, ID, n], need: NEED, lines: [["Invites", tok(n)], ["To", named()]], sentence: tok(ID) + " invites " + tok(n) + " into " + named() + "; it still has to join" });
                });
              }
            }, function (e) { title.lastChild.textContent = unread(e); });
          });
        }, function (e) { ui.note(list, "rooms " + unread(e), "warn"); });
      };
      go(); refreshers.push(go);
      var fd = ui.el("div"); box.append(fd);
      var nm = ui.field(fd, "found a room: its name (≤ 48 bytes)", "a room"); nm.id = "social-found-name";
      var door = toggle(fd, "open door", "by invitation");
      ui.act(fd, "found", "review the founding", NEED, function () {
        var n = bytes(nm.value).length; if (!nm.value.trim()) return ui.say("a name", "err"); if (n > 48) return ui.say("a name is at most 48 bytes and that is " + n, "err");
        var open = door.classList.contains("on");
        return ui.propose({ to: S.parley, key: "parley.found", args: [ID, nm.value, open], need: NEED, lines: [["Founds", nm.value], ["Door", open ? "open" : "by invitation"]],
          sentence: tok(ID) + " founds the room " + cut(nm.value) + ", " + (open ? "open door" : "by invitation") + ", and stewards it" });
      });
      var jk = ui.field(fd, "join a room by its key", "0");
      ui.act(fd, "join", "join", NEED, function () {
        var k = digits(jk.value, "the key"); if (k == null) return;
        return ui.propose({ to: S.parley, key: "parley.join", args: [k, ID], need: NEED, lines: [["Joins", "room " + k], ["As", tok(ID)]], sentence: tok(ID) + " joins room " + k });
      });
      ui.note(box, "evict, setCooldown and hide: not in this console", "s");
    }
    /* a two-state chip: on/off, the two labels */
    function toggle(p, on, off) {
      var c = ui.el("button", "chip on", on); c.type = "button"; p.append(c);
      c.addEventListener("click", function () { c.classList.toggle("on"); c.textContent = c.classList.contains("on") ? on : off; });
      return c;
    }

    /*═══════════ direct messages: the pair room, the sealing flow, postage ═══════════*/
    var ORD = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
    /* PKCS#8, P-256, the private scalar only — the browser recomputes the public point on import */
    var PK8 = "3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420";
    /* a JWK coordinate is base64url without padding; 43 characters decode without it */
    var urlBytes = function (s) { return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), function (c) { return c.charCodeAt(0); }); };
    var SUB = function () { if (!(window.crypto && crypto.subtle)) throw Error("sealing needs a secure origin"); return crypto.subtle; };
    /* the shell signs the sentence (its one personal_sign); SHA-256 of the signature, rejected and
       re-hashed until 0 < d < n, is the scalar; the point is what WebCrypto computes on import */
    function derive() {
      return Promise.resolve().then(SUB).then(function (sub) {
        return ui.sealSignature().then(function (sig) {
          var loop = function (u) { return sub.digest("SHA-256", u).then(function (x) { var h = new Uint8Array(x), d = BigInt("0x" + hex(h)); return d > 0n && d < ORD ? h : loop(h); }); };
          return loop(unhex(sig));
        }).then(function (h) { return sub.importKey("pkcs8", unhex(PK8 + hex(h)), { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]); })
          .then(function (k) { return sub.exportKey("jwk", k); })
          .then(function (jwk) { var raw = new Uint8Array(65); raw[0] = 4; raw.set(urlBytes(jwk.x), 1); raw.set(urlBytes(jwk.y), 33); MYPK = "0x" + hex(raw); MY = { version: "1", publicKey: b64(raw), privateKey: jwk }; });
      });
    }
    var keyOf = function (t) { return ui.read(S.parley, "parley.keyOf", [t]).then(function (r) { return { type: Number(r.w(0)), id: "0x" + r.words[1], pk: r.bytes(2) }; }); };
    var notP256 = function (n) { return tok(n) + "'s key is not a P-256 key; this page cannot seal to it"; };
    var moved = function (n) { return tok(n) + "'s key moved" + AGAIN; };
    /* a sealed row opens when the six fixed fields of its context are this pair's and the key fits (CONSOLE §9) */
    function opener(m, el) {
      if (!MY) return;
      var env; try { env = JSON.parse(text(unhex(m.hex))); } catch (e) { return; }
      var c = env && env.context, to = m.from === ID ? other : ID;
      var fixed = [LABEL, CHAIN, lower(S.hub), lower(S.parley), String(m.from)];
      if (!Array.isArray(c) || c.length !== 10 || fixed.some(function (v, i) { return c[i] !== v; }) || c[6] !== String(to)) return;
      decryptWhisper(env, c, MY, m.from === ID ? "sender" : "recipient").then(function (t) { el.textContent = t; el.classList.remove("s"); }, function () {});
    }
    function dm(p) {
      var box = ui.el("div"); box.id = "social-dm"; p.append(box);
      box.append(ui.el("h3", "", "direct messages"));
      ui.note(box, "a pair room is addressed, not private; sign this sentence nowhere but here: whoever holds that signature can read your sealed messages; there is no forward secrecy.");
      var to = ui.field(box, "to: a token by number", "3"); to.id = "social-dm-to"; to.value = dmTo;
      var status = ui.note(box, "", "s"); status.id = "social-dm-status";
      var feed = ui.el("div"); feed.id = "social-dm-feed"; box.append(feed);
      var fs = ui.note(box, "", "s");
      var ctl = ui.el("div"); box.append(ctl);
      var rc = ui.el("div"); rc.id = "social-receipts"; box.append(rc);
      var say = function (s, cls) { status.textContent = s; status.className = "blurb s" + (cls ? " " + cls : ""); };
      /* arm: your own key first, then theirs; a mismatch of the derived key is a bind problem, said as one.
         `a` is this ask; the keys and the receipts write only while it is still the newest one. The status
         is cleared with everything else: it once kept the last recipient's sentence while that one's
         controls were already gone — for a round trip when the keys were asked, and for good when they
         were not (a renter's "a token cannot whisper to itself" outlived the next number typed; found
         by review) */
      function arm() {
        var a = ++asks; armed = null; ctl.replaceChildren(); rc.replaceChildren(); feed.replaceChildren(); fs.textContent = ""; say("");
        var n = /^\d+$/.test(to.value.trim()) ? BigInt(to.value.trim()) : null;
        other = n || 0n; dmTo = to.value;
        if (!n) return;
        if (n === ID) return say("a token cannot whisper to itself");
        var room = pairKey(ID, n);
        walk(feed, fs, room, "nothing whispered yet", opener);
        receipts(room, a);
        if (!speaks()) return whyNot(ctl, false);
        Promise.all([keyOf(ID), keyOf(n)]).then(function (k) {
          if (a !== asks) return;
          var mine = k[0], theirs = k[1], plain = false;
          if (theirs.pk === "0x") { say(tok(n) + " has no key — this room cannot be sealed; whispers go " + CLEAR); plain = true; }
          else if (theirs.type !== 3) say(notP256(n), "warn");
          else if (mine.pk === "0x") { say(tok(ID) + " has no bound key — bind one on Identity; until then whispers go " + CLEAR, "warn"); plain = true; }
          else if (!MYPK) { say("both keys are bound; derive yours to seal", "warn"); ui.button(ctl, "derive the sealing key", true, function () { derive().then(arm, function (e) { ui.say(e && e.message, "err"); }); }).id = "social-dm-derive"; }
          else if (!same(MYPK, mine.pk)) say("the key this wallet derives is not the one " + tok(ID) + " bound — bind again on Identity", "bad");
          else { armed = { pk: theirs.pk, id: theirs.id, mine: mine.id }; say("sealed · both bound under their current holders · key " + theirs.id.slice(0, 10) + "…"); }
          sender(ctl, n, room, plain);
        }, function (e) { if (a === asks) say("the keys " + unread(e), "warn"); });
      }
      to.addEventListener("input", arm);
      if (dmTo) arm();
      /* the composer: sealed when armed; in the clear only when the room cannot be sealed, and the label says so */
      function sender(c, n, room, plain) {
        var ta = ui.el("textarea"); ta.value = dmText; c.append(ta);
        ta.placeholder = armed ? "sealed to " + tok(n) + "'s key" : CLEAR;
        ta.addEventListener("input", function () { dmText = ta.value; });
        /* a room that has a key and is not armed: the status already says why — derive yours, bind again,
           or a key this page cannot seal to — so the note says only what holds in all three. It once
           began "derive or bind the key", which sent the holder of a room whose recipient key is not
           P-256 to Identity for nothing (found by review). */
        if (!armed && !plain) return ui.note(c, "a sealable room is never sent " + CLEAR, "warn");
        ui.act(c, "whisper", armed ? "review the sealed whisper" : "review the whisper, " + CLEAR, NEED, function () {
          var s = ta.value; if (!s.trim()) return ui.say("something to say", "err");
          var A = armed;
          if (A) return Promise.resolve().then(SUB).then(function () {
            /* the key is re-read when the slab is built, and again inside the press (recheck); a move is a sentence, never plaintext */
            return Promise.all([keyOf(n), ui.read(S.hub, "hub.custodyEpoch", [ID]), ui.read(S.hub, "hub.custodyEpoch", [n])]).then(function (k) {
              var th = k[0], me = k[1].w(0), te = k[2].w(0);
              if (!same(th.id, A.id) || !same(th.pk, A.pk)) { arm(); throw Error(moved(n)); }
              if (th.type !== 3) throw Error(notP256(n));
              var ctx = messageContext(whisperScope(CHAIN, S.hub, S.parley, ID, me), n, te, th.id, A.mine);
              return encryptWhisper(ctx, s, hexPublic(th.pk), MY.publicKey).then(function (env) {
                var body = "0x" + hex(bytes(JSON.stringify(env)));
                return send(n, room, 1, th.id, body, "a sealed envelope of " + ((body.length - 2) / 2) + " bytes", function () {
                  /* the press-time read refuses as the review-time one does, and re-arms as it does */
                  return keyOf(n).then(function (now) { return !same(now.id, th.id) || !same(now.pk, th.pk) ? (arm(), moved(n)) : now.type !== 3 ? notP256(n) : null; },
                    function () { return tok(n) + "'s key could not be re-read at the press" + AGAIN; });
                }, ta);
              });
            });
          }).catch(function (e) { ui.say(e && e.message, "err"); });
          var h = bodyOf(s); if (!h) return;
          return send(n, room, 0, "0x" + "0".repeat(64), h, cut(s), null, ta);
        }, { spend: true });
      }
      /* the send: a plain whisper, or — when the recipient's live inbox says PostageDue — the stamped form with the
         exact postage: native as value, ERC-20 pulled from this token's Reach after the Reach's exact approve */
      function send(n, room, kind, keyId, body, saysLine, recheck, ta) {
        var lines = [["To", tok(n) + (kind ? ", sealed to key " + keyId.slice(0, 10) + "…" : ", " + CLEAR)], ["From", tok(ID)], ["Says", saysLine]];
        var after = function () { ta.value = ""; dmText = ""; arm(); };
        var head = tok(ID) + " whispers to " + tok(n);
        return ui.simulate(S.parley, ui.data("parley.whisper", [ID, n, kind, keyId, body]), { from: ui.account() }).then(function (sim) {
          if (sim.ok || !/^PostageDue\(/.test(sim.sentence)) return ui.propose({ to: S.parley, key: "parley.whisper", args: [ID, n, kind, keyId, body], need: NEED, lines: lines, recheck: recheck,
            sentence: head + (kind ? ", sealed" : ", " + CLEAR) + ", forever: " + saysLine, then: after });
          return ui.read(S.postage, "postage.inboxOf", [n]).then(function (ib) {
            var ft = ib.a(0), post = ib.w(1), win = ib.w(2) / 60n, native = isEth(ft);
            return coin(ft).then(function (cs) {
              if (cs[1] == null) throw Error("the postage coin's " + NOPOINT);
              var a = amt(post, cs), paid = native ? "this wallet, as value" : tok(ID) + "'s Reach, exactly";
              var go = function () {
                return ui.propose({ to: S.parley, key: "parley.whisperStamped", args: [ID, n, kind, keyId, body, ft, post], value: native ? post : 0n, need: NEED, spend: true, recheck: recheck,
                  lines: lines.concat([["Postage", a + ", escrowed; refunded if ignored for " + win + " minutes"], ["Paid by", paid]]),
                  sentence: head + " with " + a + " of postage, paid by " + paid + ", refunded if ignored; forever: " + saysLine, then: after });
              };
              if (native) return go();
              if (!ctl.querySelector(".paid")) ui.note(ctl, "postage in " + cs[0] + " is paid by " + tok(ID) + "'s Reach: an exact approve first, then the same button sends", "warn paid");
              return ui.approveExactThen([{ token: ft, spender: S.postage, amount: post, symbol: cs[0], decimals: cs[1], via: "reach" }], go);
            });
          });
        }).catch(function (e) { ui.say(e && e.message || e, "err"); });
      }
      /* receipts: the pending stamp of this pair (or the last one this pair showed), expire, the refund to
         the sender's Reach; written only while `a` is still the newest ask */
      function receipts(room, a) {
        ui.read(S.postage, "postage.pendingOf", [room]).then(function (r) {
          var id = r.w(0) || lastStamp[room]; if (!id) return; lastStamp[room] = id;
          ui.read(S.postage, "postage.stampOf", [id]).then(function (st) {
            var from = st.w(1), by = st.w(7), settled = st.b(8), refunded = st.b(9);
            coin(st.a(4)).then(function (cs) {
              if (a !== asks) return;
              ui.kv(rc, "stamp " + id, tok(from) + " → " + tok(st.w(2)) + " · " + amt(st.w(5), cs) + " · reply by " + date(by) + " · " + (settled ? "settled" : refunded ? "refunded" : "pending"));
              if (!settled && !refunded) ui.act(rc, "expire", "expire the stamp", 0, function () {
                return ui.propose({ to: S.postage, key: "postage.expire", args: [id], need: 0, lines: [["Stamp", String(id)], ["After", date(by)]], sentence: "expires stamp " + id + ": the postage is the sender's again, to be claimed", then: arm });
              });
              if (!settled) ui.act(rc, "claimRefund", "claim the refund", 0, function () {
                return ui.propose({ to: S.postage, key: "postage.claimRefund", args: [id], need: 0, lines: [["Stamp", String(id)], ["Pays", tok(from) + "'s Reach, whoever signed"]], sentence: "pays the expired stamp " + id + "'s postage back to " + tok(from) + "'s Reach", then: arm });
              });
            });
          }, function (e) { ui.note(rc, "stamp " + unread(e), "warn"); });
        }, function (e) { ui.note(rc, "receipts " + unread(e), "warn"); });
      }
    }

    /*═══════════ the inbox: live facts, the holder's price list, what it earned ═══════════
         The ledger is per coin — owed(feeSink, coin) answers for the coin asked — and the row asks
         for the coin the price list names, so the row names it: "earned in ETH". Unscoped, it once
         read "earned 0 ETH" over the 5 WETH a price list that had moved on from WETH still held
         (found by review). What another coin holds is not shown: a field to ask for it measured
         +74 B of gzip and the ceiling refused it. Naming that coin in the price list again shows
         its balance and the claim, and claimSettled(id, coin) is open to anyone from any tool. */
    function inbox(p) {
      var box = ui.el("div"); box.id = "social-inbox"; p.append(box);
      box.append(ui.el("h3", "", "its inbox"));
      var facts = ui.el("div"); box.append(facts);
      var go = function () {
        facts.replaceChildren();
        ui.read(S.postage, "postage.inboxOf", [ID]).then(function (ib) {
          var ft = ib.a(0), post = ib.w(1);
          coin(ft).then(function (cs) {
            ui.kv(facts, "door", ib.b(3) ? "open" : "closed to strangers");
            ui.kv(facts, "postage", post ? amt(post, cs) + " per first contact · " + ib.w(2) / 60n + "-minute window" : "free");
            ui.read(S.postage, "postage.owed", [S.feeSink, ft]).then(function (o) {
              var owed = o.w(0);
              ui.kv(facts, "earned in " + cs[0], amt(owed, cs));
              if (owed) ui.act(facts, "claimSettled", "pay the fee sink what it earned", 0, function () {
                return ui.propose({ to: S.postage, key: "postage.claimSettled", args: [ID, ft], need: 0, lines: [["Pays", amt(owed, cs)]], sentence: "pays " + tok(ID) + "'s fee sink " + ui.short(S.feeSink) + " the " + amt(owed, cs) + " its inbox earned" });
              });
            }, function (e) { ui.kv(facts, "earned in " + cs[0], unread(e)); });
          });
        }, function (e) { ui.note(facts, "the inbox " + unread(e), "warn"); });
      };
      go(); refreshers.push(go);
      if (ui.mode() !== "console" || !(ui.rights() & R.HOLD)) return;
      var f = ui.el("div"); box.append(f); f.append(ui.el("h3", "", "price list"));
      var ft = ui.field(f, "fee token, 0x0 for ETH", ZERO), pr = ui.field(f, "postage", "0.1"), wn = ui.field(f, "reply window, minutes", "1440");
      var door = toggle(f, "door open", "door closed to strangers");
      ui.act(f, "configureInbox", "review the price list", R.HOLD, function () {
        var t = /^(0x0*)?$/.test(ft.value.trim()) ? ZERO : ft.value.trim();
        if (!ui.isAddr(t)) return ui.say("the fee token: an address or 0x0", "err");
        var m = digits(wn.value, "the reply window"); if (m == null) return;
        if (m < 5n || m > 43200n) return ui.say("the window is 5 to 43200 minutes", "err");
        return coin(t).then(function (cs) {
          if (cs[1] == null) return ui.say("the coin's " + NOPOINT, "err");
          var post; try { post = ui.parse(pr.value, cs[1]); } catch (e) { return ui.say("the postage: a number", "err"); }
          var open = door.classList.contains("on"), a = post ? amt(post, cs) : "nothing";
          return ui.propose({ to: S.postage, key: "postage.configureInbox", args: [ID, t, post, m * 60n, open], need: R.HOLD,
            lines: [["Token", tok(ID)], ["Postage", a + " per first contact"], ["Reply window", m + " minutes"], ["Door", open ? "open" : "closed to strangers"]],
            sentence: "prices " + tok(ID) + "'s inbox at " + a + " per first contact, refunded if unanswered within " + m + " minutes; the door is " + (open ? "open" : "closed") + "; stale after sale" });
        });
      });
    }

    /*═══════════ paint ═══════════*/
    function paint() {
      host.replaceChildren(); refreshers = [];
      /* the scalar is the wallet's (D7): another account derives its own. Here and not in the rights
         handler: rights() fires intact:epoch first, and the paint it causes has already moved seenAcct */
      if (seenAcct !== ui.account()) MY = MYPK = null;
      seenBits = ui.rights(); seenAcct = ui.account();
      if (!(S.reported & S.bits.parley)) ui.note(host, "parley: " + (S.absent & S.bits.parley ? "not deployed on this chain" : "could not be read at block " + S.block) + " — not the same as this token having nothing to say, and the console will not print one as the other", "warn");
      else { commons(host); home(host); rooms(host); dm(host); inbox(host); }
      S.loaded.social = true;
    }
    paint();
    /* a receipt that leaves the rights as they were refreshes the feeds in place and keeps what is typed;
       different bits or another account repaint the lane (CONSOLE §5) */
    window.addEventListener("intact:rights", function (e) { var d = e.detail || {}; if (d.bits !== seenBits || d.account !== seenAcct) paint(); else refreshers.forEach(function (f) { f(); }); });
    /* the key is the wallet's, not the epoch's (D7): an epoch change repaints and re-arms, and the derived key stands */
    window.addEventListener("intact:epoch", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "social") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
