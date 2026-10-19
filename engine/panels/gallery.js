/*  INTACT panel "gallery" — any NFT, from the chain alone (docs/V2.md §2, §3.3;
    V2 wave 2, unit W8). Injected as a Blob script after the shell keccak'd
    these bytes against window.INTACT.panels.gallery. One IIFE, nothing at top
    level (terser mangles each script's top level apart; a top-level const
    here would collide with the shell and the panel would never run — the
    build refuses one). Every chain string reaches the DOM through
    textContent; the one place foreign HTML lives is a sandboxed srcdoc.

    What the lane does:
      · opens any ERC-721 or ERC-1155 — a collection and an id, a pasted
        collection:id, or a persona (collection << 96 | id); this token is
        the default. tokenURI (or uri with {id} filled) is read by eth_call
        and data: JSON is decoded in place, base64 or plain. An image that is
        data: SVG, PNG or GIF is drawn large in a frame whose ambient light
        is sampled from the SVG's own fills; a data:text/html animation_url
        runs in <iframe sandbox="allow-scripts" srcdoc>, never with
        allow-same-origin, its document carrying a CSP of its own that
        refuses every network request; anything off chain (ipfs://, ar://,
        http(s)://) is a link a person may open and the page never loads.
        An INTACT token is drawn from face 1 (the crest): its face 0 is this
        very console. Attributes are chips.
      · its story: the owners from Transfer logs (a refused range is said,
        never a zero); its memories from the Journal's Inscribed logs, folded
        in order and held to rootOf and countOf ("the archive replays", or
        why not), and drawn as a constellation, one star per memory, sealed
        ones dim, nothing that loops; its sales from Seaport's OrderFulfilled
        logs where the endpoint serves them, filtered to the offerers that
        could have sold it.
      · buy: listings from the Bazaar's Published logs filtered by (token,
        id), each order rebuilt from Seaport's OrderValidated — in the
        Published transaction's own receipt, else in the 256 blocks before
        it, where a validate from the seller's wallet lands — and held to
        Seaport's getOrderHash at the seller's live counter and to
        getOrderStatus; an INTACT order zoned to the Bazaar is offered only
        while bazaar.check(zoneHash, endTime) is zero, else the refusal is
        printed in words. Buy is Seaport.fulfillOrder(order, 0) with exactly
        the price as value for ether, or after an exact approval for an
        ERC-20. The INTACT Market's own listing is shown beside, with its buy.
      · sell (the connected wallet holds it): a price, a duration on the
        chain's clock, the ERC-2981 royalty item, all in ether. An INTACT
        token's order names the Bazaar as its zone, FULL_RESTRICTED, under
        zoneHash = bazaar.pinHash(id, liveFingerprint, []), and the steps
        first seal the Reach (and the owned market, while it is open) to the
        order's end — each a slab with its sentence: a seal only lengthens.
        Then, with no signature: let Seaport move it (or say it already
        may), Seaport.validate([order]) from the wallet, bazaar.publish(order,
        []). The seller's own live listings offer Seaport.cancel([components]).
      · mint from any studio.isCollection address: spec() is read and shown
        before the signature, then mint(to, via) with the price exactly; via
        is the link's ?via= — a hub token's number (the Studio lane's link),
        taken as its persona, or a persona as it stands — or 0.
      · "include OpenSea": the Bridges door is read and printed beside a
        switch that stays off and disabled, with the sentence of why. No
        fetch is made, here or anywhere in this file.
    The V2 sections appear only where their contract reports (S.bits,
    S.reported, S.absent); otherwise the §6.3 chip, and no read is sent to a
    codeless address. Selectors of the standard interfaces the Catalog does
    not serve as rows (ERC-721 metadata and approvals, ERC-1155, ERC-2981,
    ERC-165, Seaport 1.6's calls) are computed with the shell's own keccak
    from their signatures, and every write is proposed with that signature,
    which the shell holds to the bytes.

    Elements this panel introduces (CONSOLE §6.2; the suite reads them scoped
    to #lane-gallery):
      #gallery-form            a <details>, closed until opened: input[name=collection], input[name=id], #gallery-open, #gallery-this
      #gallery-token           the hero, in this order: the art, its name, its price, its facts, its traits, its own page
      #gallery-frame           the frame (dataset.ambient: the two colours sampled from the art, or "crest")
      #gallery-art             img (data: SVG, PNG or GIF) | a.offchain (a link, never loaded) | p (why not drawn)
      #gallery-name, #gallery-price (the lowest live price, hidden while none), #gallery-what (standard · collection · id ·
                               holder), #gallery-about, #gallery-meta (the metadata URI when off chain)
      #gallery-traits .trait   one chip per attribute (dataset.trait)
      #gallery-sitebox         the second frame, holding #gallery-site: iframe[sandbox=allow-scripts][srcdoc], the token's own page
      #gallery-buy             #gallery-listings .listing[data-hash] (.state: live | expired | cancelled | filled | void | refused | not open),
                               #gallery-market (the INTACT Market's listing)
      #gallery-sell            input[name=price|days], #gallery-review, #gallery-steps .step[data-step=seal|market|approve|validate|publish][data-done]
      #gallery-mint            #gallery-spec, #gallery-via
      #gallery-story           #gallery-owners .owner, #gallery-memories .memory, #gallery-archive,
                               #gallery-constellation svg circle.star (one per memory, data-kind; each behind a halo), #gallery-sales .sale
      #gallery-opensea         the switch (disabled, unchecked, role=switch); #gallery-door (the Bridges endpoint, as text)
      [data-act=buy|marketBuy|cancel|sealReach|sealMarket|approve|validate|publish|mint]; [data-spend] on buy, marketBuy, approve, validate, mint
    Sentences the group proves: tools/verify-site/gallery.mjs, and in Chromium
    tools/verify-console.mjs --group gallery.                                    */
(function () {
  var S = window.INTACT, ui = S && S.ui;
  if (!ui) return;
  ui.ready.then(function () {
    var host = ui.host("gallery"), R = S.rights, ID = BigInt(S.id || 0), HUB = S.hub, ZA = "0x" + "0".repeat(40), Z32 = "0x" + "0".repeat(64);
    var el = ui.el, kv = ui.kv, note = ui.note, act = ui.act, read = ui.read, enc = ui.enc, short = ui.short, cs = ui.checksum, say = ui.say, propose = ui.propose;
    var none = function (a) { return !a || /^0x0*$/.test(a); };
    var lower = function (s) { return String(s).toLowerCase(); }, same = function (a, b) { return lower(a) === lower(b); };
    var SEA = none(S.seaport) ? null : S.seaport, BZ = S.bazaar;
    /* Seaport 1.6's shapes (src/interfaces/ISeaport.sol): OrderParameters and OrderComponents share one, the last word being the
       consideration count in one and the counter in the other */
    var OF = "(uint8,address,uint256,uint256,uint256)", CO = "(uint8,address,uint256,uint256,uint256,address)",
        PAR = "(address,address," + OF + "[]," + CO + "[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256)", ORD = "(" + PAR + ",bytes)", FL = "(address,uint256)[]",
        VALIDATE = "validate(" + ORD + "[])", FULFILL = "fulfillOrder(" + ORD + ",bytes32)", CANCEL = "cancel(" + PAR + "[])";
    /* the rows this panel calls, each held to the selector the chain baked, or the lane does not open */
    ui.rows({ "hub.ownerOf": "ownerOf(uint256)", "hub.approve": "approve(address,uint256)", "hub.setApprovalForAll": "setApprovalForAll(address,bool)",
      "hub.tokenURIAt": "tokenURIAt(uint256,uint8)", "hub.getStateFingerprint": "getStateFingerprint(uint256)", "hub.account": "account(uint256)", "hub.custodyEpoch": "custodyEpoch(uint256)",
      "reach.sealedUntil": "sealedUntil()", "reach.seal": "seal(uint64)", "pool.marketOf": "marketOf(uint256)", "pool.sealMarket": "sealMarket(uint256,uint64)",
      "journal.countOf": "countOf(address,uint256)", "journal.rootOf": "rootOf(address,uint256)",
      "bazaar.publish": "publish(" + ORD + "," + FL + ")", "bazaar.check": "check(bytes32,uint256)", "bazaar.pinHash": "pinHash(uint256,bytes32," + FL + ")",
      "market.listingOf": "listingOf(uint256)", "market.buy": "buy(uint256,uint256,bytes32)", "studio.isCollection": "isCollection(address)",
      "collection.spec": "spec()", "collection.mint": "mint(address,uint256)", "bridges.endpointOf": "endpointOf(bytes32)", "erc20.symbol": "symbol()", "erc20.decimals": "decimals()" });

    /*── the coder: a selector from a signature with the shell's keccak; words, addresses and dynamic bytes out of hex ──*/
    var SEL = function (s) { return ui.khex(s).slice(0, 10); };
    var raw = function (to, sig, ts, vs) {
      return ui.request("eth_call", [{ to: to, data: SEL(sig) + (ts ? enc.params(ts, vs) : "") }, "latest"]).then(function (r) { r = String(r).slice(2); if (!r) throw Error("no answer"); return r; });
    };
    var W = function (h, i) { return BigInt("0x" + (h.substr(i * 64, 64) || "0")); }, N = function (h, i) { return Number(W(h, i)); };
    var A = function (h, i) { return cs("0x" + h.substr(i * 64 + 24, 40)); }, X = function (h, i) { return "0x" + h.substr(i * 64, 64); };
    var BY = function (h, i) { var o = N(h, i) / 32; return h.substr(o * 64 + 64, N(h, o) * 2); };
    var TX = function (x) { return new TextDecoder().decode(Uint8Array.from(x.match(/../g) || [], function (b) { return parseInt(b, 16); })); };
    var T = function (v) { return "0x" + lower(enc.W(v)); };
    var walk = function (address, topics, from, to) { return ui.walkLogs({ address: address, topics: topics, fromBlock: from || "0x0", toBlock: to || "latest" }); };
    var hexb = function (n) { return "0x" + BigInt(n).toString(16); };
    /* word 0 of an answer; `alt` (when given) stands for no answer */
    var w0 = function (p, alt) { return p.then(function (h) { return W(h, 0); }, arguments.length > 1 ? function () { return alt; } : null); };
    var counter = function (a) { return w0(raw(SEA, "getCounter(address)", ["address"], [a])); };
    var ohash = function (comps) { return raw(SEA, "getOrderHash(" + PAR + ")", [PAR], [comps]).then(function (h) { return X(h, 0); }); };
    var ostat = function (hash) { return raw(SEA, "getOrderStatus(bytes32)", ["bytes32"], [hash]); };

    /*── words ──*/
    var date = function (t) { return new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC"; };
    var why = function (e) { var m = e && e.message || String(e); return /clock/.test(m) ? m : "not reported: " + m; };
    var oops = function (e) { say(e && e.message || String(e), "err"); };
    var MOVED = "the listing changed since it was read — review again";
    var guard = function (f) { return function () { try { var r = f(); return r && r.catch ? r.catch(oops) : r; } catch (e) { oops(e); } }; };
    var three = function (p, n) { var b = S.bits[n]; if (S.reported & b) return 0; ui.chip(p, n + ": " + (S.absent & b ? "not deployed on this chain" : "could not be read at block " + S.block), S.absent & b ? "absent" : "unread"); return 1; };
    var box = function (p, title, id) { var d = el("div"); if (id) d.id = id; if (title) d.append(el("h3", "", title)); p.append(d); return d; };
    var slot = function (p, k, id) { var n = kv(p, k, "reading…").lastChild; if (id) n.id = id; return n; };
    var fld = function (p, n, label, v) { var i = ui.field(p, label, ""); i.name = n; i.value = v || ""; i.setAttribute("aria-label", label); return i; };
    var money = function (v, c) { return c ? ui.fmt(v, c.dec) + " " + c.sym : ui.fmt(v) + " ETH"; };
    /* the price strip under its name: the lowest live ether price wins, a token price shows only while no ether one does */
    var best = function (v, c, where) { if (BEST && (c || !BEST[1] && BEST[0] <= v)) return; BEST = [v, c]; PR.hidden = false; PR.textContent = money(v, c) + " · " + where; };
    var nameOf = function (t) { return (same(t.c, HUB) ? "INTACT" : short(cs(t.c))) + " #" + t.id; };
    var KIND = ["a note", "a trade", "a gift", "a milestone", "sealed"];
    var gen = 0, acct = null, can = false, cur = { c: HUB, id: ID || null }, DRAFT = null, PUB = null, PR = null, BEST = null, NS = (document.querySelector("svg") || {}).namespaceURI;
    /*  the link's ?via=, in either form a link carries (W12-9): a token number below 2^96 — the Studio lane's own
        link, ?via=<id> — is that hub token's persona, hub << 96 | id; a number at or above it is a persona as it
        stands. The two never overlap, since a persona's top 160 bits are its collection */
    var VIA = (function () { try { var v = new URLSearchParams(location.search).get("via"); v = /^\d{1,78}$/.test(v || "") ? BigInt(v) : 0n; return v && !(v >> 96n) ? BigInt(HUB) << 96n | v : v; } catch (e) { return 0n; } })();
    /* the CSP a token's own page runs under, inside the sandbox: inline script and style, data: images, and no network at all */
    var CSP = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:\">";

    /*═══════════ open: a collection and an id, collection:id, or a persona ═══════════*/
    function parse(c, i) {
      c = String(c).trim(); i = String(i).trim();
      var m = /^(0x[0-9a-fA-F]{40})\s*[:\/# ]\s*(\d+)$/.exec(c);
      if (m) return { c: cs(m[1]), id: BigInt(m[2]) };
      var p = /^\d{29,78}$/.test(c) ? c : /^\d{29,78}$/.test(i) && !c ? i : null;
      if (p) { p = BigInt(p); if (p >> 96n) return { c: cs("0x" + (p >> 96n).toString(16).padStart(40, "0")), id: p % (1n << 96n) }; }
      if (!ui.isAddr(c)) throw Error("the collection: an address, collection:id, or a persona");
      if (i && !/^\d{1,78}$/.test(i)) throw Error("the id: a whole number");
      return { c: cs(c), id: i ? BigInt(i) : null };
    }
    /* a disclosure, closed until a person opens it: the art comes first */
    function form(p) {
      var d = el("details", "card"); d.id = "gallery-form"; d.open = cur.id == null; d.append(el("summary", "", "open any NFT")); d.firstChild.style.border = "0"; p.append(d);
      var fc = fld(d, "collection", "collection: an address, collection:id, or a persona", cur.c), fi = fld(d, "id", "token id", cur.id == null ? "" : String(cur.id));
      var go = guard(function () { cur = parse(fc.value, fi.value); DRAFT = null; paint(); });
      [fc, fi].forEach(function (i) { i.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); }); });
      ui.button(d, "open", false, go).id = "gallery-open";
      if (ID) ui.button(d, "this token, #" + ID, true, function () { cur = { c: HUB, id: ID }; DRAFT = null; paint(); }).id = "gallery-this";
    }

    /*═══════════ the art: its light sampled from its own fills ═══════════*/
    /* the two most vivid colours its SVG paints with, as CSS rebuilt from the numbers read, never from its text */
    function light(svg) {
      var re = /(?:fill|stop-color|stroke)\s*[=:]\s*["']?\s*(?:#([0-9a-f]{6}|[0-9a-f]{3})\b|(rgb|hsl)a?\(\s*([\d.]+)[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?)/gi, m, all = [];
      while ((m = re.exec(svg)) && all.length < 96) {
        var x = m[1] && (m[1].length < 6 ? m[1].replace(/./g, "$&$&") : m[1]), q = x ? [0, 2, 4].map(function (k) { return parseInt(x.substr(k, 2), 16); }) : [+m[3], +m[4], +m[5]], h = /h/i.test(m[2]);
        if (q.every(isFinite)) all.push([h ? q[1] * (100 - Math.abs(2 * q[2] - 100)) / 40 : Math.max.apply(0, q) - Math.min.apply(0, q),
          h ? "hsl(" + q[0] % 360 + "," + Math.min(q[1], 100) + "%," + Math.min(q[2], 100) + "%)" : "rgb(" + q.map(function (n) { return Math.min(n, 255); }) + ")"]);
      }
      all.sort(function (a, b) { return b[0] - a[0]; });
      var c = all[0], d = all.find(function (a) { return a[1] !== c[1]; }) || c;
      return c && c[0] > 24 ? [c[1], d[1]] : null;
    }
    var DRAW = /^data:image\/(svg\+xml|png|gif)[;,]/i, OFF = /^(https?|ipfs|ar):\/\//i;
    var data = function (u) {
      var m = /^data:([^,]*),([\s\S]*)$/i.exec(u); if (!m) return null;
      var t = m[2]; if (/;base64$/i.test(m[1])) t = TX(Array.from(atob(t.replace(/\s+/g, "")), function (c) { return c.charCodeAt(0).toString(16).padStart(2, "0"); }).join(""));
      else try { t = decodeURIComponent(t); } catch (e) {}
      return t;
    };
    var link = function (p, u, label) {
      if (!OFF.test(u)) return kv(p, label, u.slice(0, 160));
      var a = el("a", "offchain b g", label + ": " + u.slice(0, 120)); a.href = u; a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
      p.append(a); return a;
    };
    /* an iridescent ring in the art's own colours, and the dark well inside it */
    var ring = function (p, c1, c2, id) {
      var o = el("div"), i = el("div"); i.id = id; o.append(i); p.append(o);
      o.style.cssText = "border-radius:24px;padding:3px;margin:6px auto 14px;max-width:min(100%,46vh);background:conic-gradient(from 210deg," + c1 + "," + c2 + "," + c1 + ");box-shadow:0 0 46px -8px " + c1;
      i.style.cssText = "border-radius:21px;overflow:hidden;background:#07080c;display:grid;place-items:center;min-height:160px";
      return i;
    };
    function frame(p, img, name) {
      var L = img && /^data:image\/svg/i.test(img) ? light(data(img) || "") : null, c1 = L ? L[0] : "hsl(var(--h),70%,58%)", c2 = L ? L[1] : "hsl(var(--h2),70%,60%)", at = ring(p, c1, c2, "gallery-art");
      at.parentNode.id = "gallery-frame"; at.parentNode.dataset.ambient = L ? L.join(" ") : "crest";
      if (img && DRAW.test(img)) { var i = el("img"); i.src = img; i.alt = name; i.style.cssText = "width:100%;display:block"; at.append(i); }
      else if (img && OFF.test(img)) { link(at, img, "its image lives off chain"); note(at, "this page never loads it: the console contacts no host on anyone's behalf", "s"); }
      else note(at, img ? "not drawn here: only data: SVG, PNG and GIF images are" : "no image in its metadata", "s");
      return [c1, c2];
    }
    /* the token's own page: srcdoc in a sandbox of scripts alone, under a CSP of its own that refuses the network */
    function site(p, page, col) {
      var f = el("iframe"); f.id = "gallery-site"; f.setAttribute("sandbox", "allow-scripts"); f.setAttribute("srcdoc", CSP + page);
      var w = "its own page, sandboxed: scripts only, no network, no wallet";
      f.setAttribute("title", w); f.style.cssText = "width:100%;height:440px;border:0;display:block"; ring(p, col[1], col[0], "gallery-sitebox").append(f); note(p, w, "s");
    }

    /*═══════════ the token: its standard, its metadata, its holder ═══════════*/
    function std(c) {
      if (same(c, HUB)) return Promise.resolve(721);
      var q = function (id) { return w0(raw(c, "supportsInterface(bytes4)", ["bytes4"], [id]), 0n); };
      return q("0x80ac58cd").then(function (y) { return y ? 721 : q("0xd9b67a26").then(function (z) { return z ? 1155 : 721; }); });
    }
    function meta(t, k) {
      var u = same(t.c, HUB) ? read(HUB, "hub.tokenURIAt", [t.id, 1]).then(function (r) { return r.s(0); })
        : raw(t.c, k === 1155 ? "uri(uint256)" : "tokenURI(uint256)", ["uint256"], [t.id]).then(function (h) { return TX(BY(h, 0)); });
      return u.then(function (s) {
        if (k === 1155) s = s.replace(/\{id\}/g, t.id.toString(16).padStart(64, "0"));
        var d = /^data:/i.test(s) ? data(s) : null, j = null;
        if (d != null) try { j = JSON.parse(d); } catch (e) { throw Error("its metadata is a data: URI that is not JSON"); }
        return { uri: s, j: j };
      });
    }

    /*═══════════ paint ═══════════*/
    function paint() {
      var g = ++gen; host.replaceChildren();
      acct = ui.account(); can = ui.mode() === "console" && !!acct;
      form(host);
      ui.gate(host, 0);
      if (!cur.c) return done();
      var t = cur, isHub = same(t.c, HUB), head = box(host, null, "gallery-token");
      ui.request("eth_getCode", [t.c, "latest"]).then(function (code) {
        if (g !== gen) return;
        if (!code || code === "0x") return note(head, "there is no contract at " + cs(t.c) + " on this chain");
        return std(t.c).then(function (k) {
          if (g !== gen) return;
          if (t.id == null) return Promise.all([mint(t, g), opensea(g)]);
          var own = k === 721 ? read(t.c, "hub.ownerOf", [t.id]).then(function (r) { return r.a(0); }, function () { return null; })
            : Promise.resolve(null);
          return Promise.all([meta(t, k).catch(function (e) { return { e: e }; }), own]).then(function (v) {
            if (g !== gen) return;
            var m = v[0], j = m.j || {}, owner = v[1], name = typeof j.name === "string" ? j.name.slice(0, 120) : nameOf(t);
            var img = typeof j.image === "string" ? j.image : typeof j.image_data === "string" ? "data:image/svg+xml," + encodeURIComponent(j.image_data) : null;
            var an = typeof j.animation_url === "string" ? j.animation_url : null, page = an && /^data:text\/html[;,]/i.test(an) ? data(an) : null;
            /* the art first, then its name, its price while one stands, and the facts */
            var col = frame(head, img, name);
            head.append(el("h2", "", name)); head.lastChild.id = "gallery-name";
            PR = note(head, "", "ok"); PR.id = "gallery-price"; PR.hidden = true; BEST = null; PR.style.cssText = "font-size:19px;font-weight:700";
            note(head, "ERC-" + k + " · " + (isHub ? "INTACT" : short(cs(t.c))) + " · #" + t.id + (owner ? " · held by " + short(owner) : k === 721 ? " · no holder: not minted, or burned" : "")).id = "gallery-what";
            if (m.e) note(head, "its metadata could not be read: " + (m.e.message || m.e), "warn");
            else if (!m.j) link(head, m.uri, "its metadata lives off chain").id = "gallery-meta";
            if (an && !page) link(head, an, "its animation lives off chain");
            if (typeof j.description === "string") note(head, j.description.slice(0, 600)).id = "gallery-about";
            if (isHub) note(head, "its own site is this console: face 0 of its tokenURI", "s");
            var tr = el("div"); tr.id = "gallery-traits"; head.append(tr);
            (Array.isArray(j.attributes) ? j.attributes : []).slice(0, 48).forEach(function (a) {
              if (!a || typeof a !== "object") return;
              var c = ui.chip(tr, (a.trait_type != null ? String(a.trait_type).slice(0, 40) + ": " : "") + String(a.value).slice(0, 100)); c.classList.add("trait"); c.dataset.trait = String(a.trait_type == null ? "" : a.trait_type).slice(0, 40);
              c.style.cssText = "max-width:100%;overflow-wrap:anywhere";
            });
            if (page) site(head, page, col);
            var holds = k === 721 ? Promise.resolve(!!owner && !!acct && same(owner, acct))
              : acct ? w0(raw(t.c, "balanceOf(address,uint256)", ["address", "uint256"], [acct, t.id]), 0n).then(function (b) { return b > 0n; }) : Promise.resolve(false);
            return holds.then(function (mine) {
              if (g !== gen) return;
              /* one walk of the Bazaar's index for the token, read by the listings and by the sales */
              PUB = SEA && S.reported & S.bits.bazaar ? walk(BZ, [S.topics.published, T(t.c), T(t.id)]) : Promise.resolve([]); PUB.catch(function () {});
              return Promise.all([buy(t, g, mine, k), sell(t, g, mine, k), mint(t, g), story(t, g, k, col), opensea(g)]);
            });
          });
        });
      }).catch(function (e) { if (g === gen) note(head, why(e), "warn"); }).then(done);
    }
    function done() { S.loaded.gallery = true; }

    /*═══════════ buy: Seaport listings from the Bazaar's index, and the INTACT Market ═══════════*/
    var REFUSE = { NotPinned: "the Bazaar holds no pin for it", FingerprintMoved: "the token changed since it was listed", ReachSealShort: "its Reach's seal ends before the listing does",
                   MarketSealShort: "its market's seal ends before the listing does", FloorBroken: "a balance its seller promised is gone" };
    var refusal = function (sel4) { var s = S.err[lower(sel4)] || "unknown error " + sel4, n = s.split("(")[0]; return "refused by the zone: " + n + " — " + (REFUSE[n] || "a fill would revert"); };
    var currency = function (tok) {
      return none(tok) ? Promise.resolve(null) : Promise.all([read(tok, "erc20.symbol", []), read(tok, "erc20.decimals", [])]).then(function (v) { return { token: cs(tok), sym: v[0].s(0) || "tokens", dec: Number(v[1].w(0)) }; });
    };
    /* the order, out of OrderValidated's data: the hash, then OrderParameters behind one offset */
    function decode(h) {
      var b = N(h, 1) / 32, at = function (k) { return b + N(h, b + k) / 32; };
      var items = function (s, w) { var o = []; for (var i = 0; i < N(h, s); i++) { var q = s + 1 + i * w, it = []; for (var j = 0; j < w; j++) it.push(j === 1 || j === 5 ? A(h, q + j) : W(h, q + j)); o.push(it); } return o; };
      return { hash: X(h, 0), p: [A(h, b), A(h, b + 1), items(at(2), 5), items(at(3), 6), W(h, b + 4), W(h, b + 5), W(h, b + 6), X(h, b + 7), W(h, b + 8), X(h, b + 9), W(h, b + 10)] };
    }
    var validated = function (ls, hash) {
      for (var i = 0; i < ls.length; i++) { var l = ls[i]; if (SEA && same(l.address, SEA) && same(l.topics[0], S.topics.orderValidated) && same(l.data.slice(0, 66), hash)) return decode(l.data.slice(2)); }
      return null;
    };
    /* where its OrderValidated is: the Published transaction's own receipt (a signed order published in one call), else the 256
       blocks before it, where a validate the seller sent from the wallet lands */
    function rebuild(l) {
      var hash = l.topics[3];
      return ui.request("eth_getTransactionReceipt", [l.transactionHash]).then(function (r) {
        var o = validated(r && r.logs || [], hash); if (o) return o;
        var b = BigInt(l.blockNumber);
        return walk(SEA, [S.topics.orderValidated], hexb(b > 256n ? b - 256n : 0n), hexb(b)).then(function (ls) { var o = validated(ls, hash); if (!o) throw Error("its order could not be rebuilt: no OrderValidated near its publication"); return o; });
      });
    }
    /* what Seaport says of it now: the hash at the seller's live counter, and its status */
    function standing(o) {
      return counter(o.p[0]).then(function (n) {
        var comps = o.p.slice(0, 10).concat([n]);
        return Promise.all([ohash(comps), ostat(o.hash)]).then(function (v) {
          return { comps: comps, same: same(v[0], o.hash), ok: !!W(v[1], 0), cancelled: !!W(v[1], 1), filled: W(v[1], 3) > 0n && W(v[1], 2) >= W(v[1], 3) };
        });
      });
    }
    /* one price in one currency, start = end on every item; else null */
    var priced = function (o) {
      var c = o.p[3], k = c.length && c[0][0], tok = c.length && c[0][1], sum = 0n;
      for (var i = 0; i < c.length; i++) { if (c[i][0] !== k || !same(c[i][1], tok) || c[i][3] !== c[i][4] || k > 1n) return null; sum += c[i][3]; }
      return c.length ? { v: sum, tok: k === 1n ? tok : null } : null;
    };
    function buy(t, g, mine, k) {
      var d = box(host, "buy it", "gallery-buy"), isHub = same(t.c, HUB);
      if (isHub) market(t, g, d, mine);
      var ls = el("div"); ls.id = "gallery-listings"; d.append(ls);
      if (!SEA) return note(ls, "no Seaport on this chain: the venue table names none");
      if (three(ls, "bazaar")) return;
      var st = note(ls, "reading its listings…", "s");
      return Promise.all([PUB, ui.clock()]).then(function (v) {
        if (g !== gen) return;
        var now = v[1], offers = v[0].filter(function (l) { return W(l.data.slice(2), 1) === 0n; });
        st.textContent = offers.length ? offers.length + " listing" + (offers.length > 1 ? "s" : "") + " published for it" : "no listing published for it";
        return Promise.all(offers.map(function (l) { return listing(t, g, ls, l, now, mine); }));
      }, function (e) { if (g === gen) st.textContent = "its listings could not be walked on this endpoint: " + (e && e.message || e); });
    }
    function listing(t, g, p, l, now, mine) {
      var row = el("div", "row listing"), w = el("span", "v", "reading…"), state = el("span", "chip state", "reading");
      row.dataset.hash = l.topics[3]; row.append(w, state); p.append(row);
      return rebuild(l).then(function (o) {
        return Promise.all([standing(o), currency(priced(o) && priced(o).tok), same(o.p[1], BZ) && !none(o.p[7]) ? read(BZ, "bazaar.check", [o.p[7], o.p[6]]) : null, raw(t.c, "ownerOf(uint256)", ["uint256"], [t.id]).then(function (h) { return A(h, 0); }, function () { return null; })]).then(function (v) {
          if (g !== gen) return;
          var s = v[0], c = v[1], pr = priced(o), zone = v[2] && v[2].words[0].slice(0, 8), seller = o.p[0], end = o.p[6], isHub = same(t.c, HUB);
          var word = !s.ok ? "not validated" : s.cancelled ? "cancelled" : s.filled ? "filled" : !s.same ? "void" : now < o.p[5] ? "not open" : now >= end ? "expired" : v[3] && !same(v[3], seller) ? "seller moved it"
            : zone && !/^0+$/.test(zone) ? "refused" : !pr ? "unpriced" : "live";
          w.textContent = (pr ? money(pr.v, c) : "no single fixed price") + " · by " + short(seller) + " · until " + date(end);
          if (word === "live") best(pr.v, c, "on Seaport, until " + date(end));
          state.textContent = word; state.dataset.state = word === "live" ? "reported" : "unread";
          if (word === "void") note(row, "its seller raised their Seaport counter: the order is void", "s");
          if (word === "refused") note(row, refusal("0x" + zone), "warn");
          if (isHub && !same(o.p[1], BZ)) note(row, "it names no zone: none of the Market's guarantees hold", "warn");
          if (!can) return;
          if (same(seller, acct) && s.ok && !s.cancelled && !s.filled && s.same) act(row, "cancel", "cancel this listing", 0, function () {
            return propose({ to: SEA, data: SEL(CANCEL) + enc.params([PAR + "[]"], [[s.comps]]), sig: CANCEL, need: 0, lines: [["Cancels", "your listing of " + nameOf(t) + " · order " + o.hash.slice(0, 10) + "…"], ["Then", "nobody can fill it again"]],
              sentence: "cancels your listing of " + nameOf(t) + " on Seaport: nobody can fill it after this lands" });
          });
          if (word !== "live" || same(seller, acct) || mine) return;
          act(row, "buy", "buy it for " + money(pr.v, c), 0, function () {
            var tx = function () {
              return propose({ to: SEA, data: SEL(FULFILL) + enc.params([ORD, "bytes32"], [[o.p, "0x"], Z32]), sig: FULFILL, value: c ? 0n : pr.v, need: 0, spend: true,
                lines: [["Buys", nameOf(t)], ["Pays", money(pr.v, c) + ", the listed price exactly"], ["To", cs(seller) + (o.p[3].length > 1 ? " and the royalty, inside the price" : "")], ["Settles", "on Seaport 1.6, order " + o.hash.slice(0, 10) + "…, with no signature"]].concat(same(o.p[1], BZ) ? [["Zone", "the Bazaar re-checks the token before anything moves"]] : []),
                sentence: "buys " + nameOf(t) + " for " + money(pr.v, c) + " on Seaport: the seller is paid and the token is yours in the same transaction",
                recheck: function () { return standing(o).then(function (n) { return n.ok && n.same && !n.cancelled && !n.filled ? "" : MOVED; }); } });
            };
            return c ? ui.approveExactThen([{ token: c.token, spender: SEA, amount: pr.v, symbol: c.sym, decimals: c.dec, who: "Seaport" }], tx) : tx();
          }, { spend: true });
        });
      }).catch(function (e) { if (g === gen) { w.textContent = e && e.message || String(e); state.textContent = "unread"; state.dataset.state = "unread"; } });
    }
    /* the INTACT Market's own listing: a seal to its expiry, the fingerprint pinned, the price exact */
    function market(t, g, d, mine) {
      var m = el("div"); m.id = "gallery-market"; d.append(m);
      if (three(m, "market")) return;
      var of = slot(m, "the INTACT Market", "gallery-market-offer");
      return Promise.all([read(S.market, "market.listingOf", [t.id]), read(HUB, "hub.custodyEpoch", [t.id]), ui.clock()]).then(function (v) {
        if (g !== gen) return;
        var L = v[0], seller = L.a(1), price = L.w(2), until = L.w(3), lep = L.w(4), pin = "0x" + L.words[5], dead = v[2] >= until ? "expired" : lep !== v[1].w(0) ? "stale: the custody epoch moved" : "";
        if (none(seller)) return of.textContent = "not listed on the Market";
        of.textContent = money(price) + " until " + date(until) + " · by " + short(seller) + (dead ? " · " + dead + "; nothing can buy it" : "");
        if (!dead) best(price, null, "on the INTACT Market, until " + date(until));
        if (dead || !can || mine || same(seller, acct)) return;
        act(m, "marketBuy", "buy it on the Market for " + money(price), 0, function () {
          return propose({ to: S.market, key: "market.buy", args: [t.id, price, pin], value: price, need: 0, spend: true,
            lines: [["Buys", nameOf(t)], ["Pays", money(price) + ", the listed price exactly"], ["Against", "fingerprint " + pin.slice(0, 10) + "… · custody epoch " + lep]],
            sentence: "buys " + nameOf(t) + " for " + money(price) + " on the INTACT Market: it checks the fingerprint, the epoch and the floors, and the token moves to you",
            recheck: function () { return read(S.market, "market.listingOf", [t.id]).then(function (r) { return same(r.a(1), seller) && r.w(2) === price && same("0x" + r.words[5], pin) ? "" : MOVED; }); } });
        }, { spend: true });
      }, function (e) { if (g === gen) of.textContent = why(e); });
    }

    /*═══════════ sell: one order, three steps, no signature ═══════════*/
    function sell(t, g, mine, k) {
      /* with no Seaport the buy box has said so */
      if (!can || !mine || !SEA) return;
      var d = box(host, "sell it", "gallery-sell"), isHub = same(t.c, HUB);
      if (three(d, "bazaar")) return;
      var key = t.c + ":" + t.id, D = DRAFT && DRAFT.key === key ? DRAFT : null;
      var fp = fld(d, "price", "price, in ETH", D ? D.price : ""), fd = fld(d, "days", "days, on the chain's clock (1–365)", D ? D.days : "7");
      note(d, "the collection's ERC-2981 royalty comes out of the price; the order settles on Seaport", "s");
      ui.button(d, D ? "review again" : "review the listing", false, guard(function () {
        var days = fd.value.trim(), price = /^\d*\.?\d+$/.test(fp.value.trim()) ? ui.parse(fp.value.trim()) : 0n;
        if (!price) throw Error("the price: more than 0 ETH, in decimal");
        if (!/^\d{1,3}$/.test(days) || +days < 1 || +days > 365) throw Error("the days: a whole number from 1 to 365");
        return Promise.all([raw(t.c, "royaltyInfo(uint256,uint256)", ["uint256", "uint256"], [t.id, price]).then(function (h) { return [A(h, 0), W(h, 1)]; }, function () { return [ZA, 0n]; }), ui.clock()]).then(function (v) {
          var r = v[0];
          if (r[1] >= price) throw Error("the royalty this collection asks is the whole price");
          var salt = BigInt("0x" + Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) { return b.toString(16).padStart(2, "0"); }).join(""));
          DRAFT = { key: key, price: fp.value.trim(), days: days, v: price, roy: none(r[0]) ? [ZA, 0n] : r, start: v[1], end: v[1] + BigInt(days) * 86400n, salt: salt };
          paint();
        });
      })).id = "gallery-review";
      if (!D) return;
      var sx = el("div"); sx.id = "gallery-steps"; d.append(sx);
      var roy = D.roy[1], need = isHub && t.id === ID ? R.HOLD : 0, what = nameOf(t);
      kv(sx, "the listing", money(D.v) + " until " + date(D.end) + (roy ? " · " + money(roy) + " of it to the royalty receiver " + short(cs(D.roy[0])) : " · no royalty asked"));
      var step = function (name, label, ok) { var r = el("div", "row step"); r.dataset.step = name; r.dataset.done = ok ? "1" : ""; r.append(el("span", "v", (ok ? "✓ " : "· ") + label)); sx.append(r); return r; };
      var reach = isHub ? (t.id === ID ? Promise.resolve(S.reach) : read(HUB, "hub.account", [t.id]).then(function (r) { return r.a(0); })) : Promise.resolve(null);
      return reach.then(function (RC) {
        return Promise.all([RC && read(RC, "reach.sealedUntil", []), isHub && read(S.pool, "pool.marketOf", [t.id]),
          k === 721 ? raw(t.c, "getApproved(uint256)", ["uint256"], [t.id]).then(function (h) { return A(h, 0); }, function () { return ZA; }) : ZA,
          w0(raw(t.c, "isApprovedForAll(address,address)", ["address", "address"], [acct, SEA]), 0n),
          D.hash && ostat(D.hash).then(function (h) { return !!W(h, 0) && !W(h, 1); }),
          D.hash && walk(BZ, [S.topics.published, T(t.c), T(t.id), D.hash]).then(function (ls) { return ls.length > 0; })]).then(function (v) {
          if (g !== gen) return;
          var sealed = !RC || v[0].w(0) >= D.end, mk = v[1], mOk = !isHub || !mk.b(7) || mk.w(9) >= D.end, appr = same(v[2], SEA) || v[3], val = !!v[4], pub = !!v[5], one = k === 721 && t.id < 1n << 255n;
          /* the two seals the zone holds a fill to, each one slab that says it only lengthens */
          var E = date(D.end), seal = function (name, to, key, args, of, then) {
            return function (r) { act(r, name, "seal " + of + " until " + E, need, function () {
              return propose({ to: to, key: key, args: args, need: need, lines: [["Seals", of + " of " + what], ["Until", E], ["Reversible", "no: a seal only ever lengthens"]],
                sentence: "seals " + of + " of " + what + " until " + E + ": " + then + ", and a seal only ever lengthens" }); }); };
          };
          /* every step is shown, done or not; only the first one not done carries its control */
          var steps = [isHub && ["seal", sealed, sealed ? "the Reach is sealed past the listing's end" : "seal the Reach until " + E + ": the zone refuses a fill otherwise", seal("sealReach", RC, "reach.seal", [D.end], "the Reach", "nothing leaves it before then")],
            isHub && ["market", mOk, mOk ? "its owned market is closed or sealed past the end" : "seal its open market until " + E, seal("sealMarket", S.pool, "pool.sealMarket", [t.id, D.end], "the owned market", "it trades on, its terms fixed")], ["approve", appr, appr ? "Seaport may move it already" : "let Seaport move it when it sells", function (r) {
            act(r, "approve", one ? "let Seaport move " + what : "let Seaport move this collection's tokens you hold", 0, function () {
              return propose({ to: t.c, key: one ? "hub.approve" : "hub.setApprovalForAll", args: one ? [SEA, t.id] : [SEA, true], need: 0, spend: true,
                lines: [["Lets", "Seaport 1.6 (" + short(cs(SEA)) + ") move " + (one ? what + " alone" : "every token of this collection you hold")], ["When", "only as an order you validate says"]],
                sentence: one ? "lets Seaport move " + what + " when an order you validate is filled; a sale clears it" : "lets Seaport move every token of this collection you hold, when an order you validate is filled" });
            }, { spend: true });
          }], ["validate", val, val ? "validated on Seaport: anyone can fill it, at the price" : "validate the order on Seaport, from this wallet, with no signature", function (r) {
            act(r, "validate", "validate the listing", 0, guard(function () {
            var zp = isHub ? read(HUB, "hub.getStateFingerprint", [t.id]).then(function (r) { return read(BZ, "bazaar.pinHash", [t.id, "0x" + r.words[0], []]); }).then(function (r) { return "0x" + r.words[0]; }) : Promise.resolve(Z32);
            return Promise.all([zp, counter(acct)]).then(function (x) {
              /* the proceeds to the seller and the royalty item, both in ether, on one consideration */
              var cons = [[0, ZA, 0n, D.v - roy, D.v - roy, acct]].concat(roy ? [[0, ZA, 0n, roy, roy, D.roy[0]]] : []);
              D.p = [acct, isHub ? BZ : ZA, [[k === 1155 ? 3 : 2, t.c, t.id, 1n, 1n]], cons, isHub ? 2 : 0, D.start, D.end, x[0], D.salt, Z32, BigInt(cons.length)];
              return ohash(D.p.slice(0, 10).concat([x[1]])).then(function (h) {
                D.hash = h;
                return propose({ to: SEA, data: SEL(VALIDATE) + enc.params([ORD + "[]"], [[[D.p, "0x"]]]), sig: VALIDATE, need: 0, spend: true,
                  lines: [["Lists", what], ["Price", money(D.v) + (roy ? ", of which " + money(roy) + " is the royalty" : "")], ["Until", date(D.end)], ["Order", D.hash.slice(0, 10) + "… · " + (isHub ? "zoned to the Bazaar: the token is held to its fingerprint and seals" : "open: no zone")], ["Signature", "none: validating from your wallet is the authority"]],
                  sentence: "lists " + what + " on Seaport for " + money(D.v) + " until " + date(D.end) + ": anyone who pays exactly that takes it, until you cancel" });
              });
            });
          }), { spend: true });
          }], ["publish", pub, pub ? "published: buyers find it from logs, with no API" : "publish it through the Bazaar, so it is found from logs", function (r) {
            act(r, "publish", "publish the listing", 0, function () {
              return propose({ to: BZ, key: "bazaar.publish", args: [[D.p, "0x"], []], need: 0,
                lines: [["Publishes", "order " + D.hash.slice(0, 10) + "… for " + what], ["Floors", "none: " + (isHub ? "the fingerprint and the seals bind it" : "an open order")], ["Moves", "nothing: it indexes what Seaport validated"]],
                sentence: "publishes your Seaport listing of " + what + " on chain, so anyone finds it from logs and fills it with no API" });
            });
          }]].filter(Boolean), next = steps.filter(function (s) { return !s[1]; })[0];
          steps.forEach(function (s) { var r = step(s[0], s[2], s[1]); if (s === next) s[3](r); });
          if (pub) { DRAFT = null; note(sx, "listed: it shows above, with its buy", "ok"); }
        });
      }).catch(function (e) { if (g === gen) note(sx, why(e), "warn"); });
    }

    /*═══════════ mint: a Studio collection, its spec read before the signature ═══════════*/
    function mint(t, g) {
      if (same(t.c, HUB) || !(S.reported & S.bits.studio)) return;
      /* its place is kept, hidden, while the Studio is asked: the mint sits above the story whenever it answers */
      var d = box(host, "mint one", "gallery-mint"); d.hidden = true;
      return read(S.studio, "studio.isCollection", [t.c]).then(function (r) {
        if (g !== gen || !r.b(0)) return d.remove();
        d.hidden = false;
        return Promise.all([read(t.c, "collection.spec", []), w0(raw(t.c, "totalSupply()"), null), ui.clock()]).then(function (v) {
          if (g !== gen) return;
          var s = v[0].tuple(0, ["string", "string", "string", "uint32", "uint128", "uint64", "uint64", "uint32", "uint16", "uint16", "bytes", "bytes"]), now = v[2], price = s[4];
          var sp = el("div"); sp.id = "gallery-spec"; d.append(sp);
          kv(sp, "collection", s[0] + " (" + s[1] + ")"); kv(sp, "minted", (v[1] == null ? "not reported" : String(v[1])) + " of " + s[3]); kv(sp, "price", money(price) + ", exactly");
          kv(sp, "window", (s[5] > now ? "opens " + date(s[5]) : "open") + (s[6] ? (s[6] > now ? " · closes " + date(s[6]) : " · closed " + date(s[6])) : " · never closes"));
          kv(sp, "per wallet", s[7] ? String(s[7]) : "no limit"); kv(sp, "shares", (Number(s[8]) / 100) + " % of each mint to the token that shared the link · royalty " + (Number(s[9]) / 100) + " %");
          if (s[2]) note(sp, s[2].slice(0, 400), "s");
          kv(d, "shared by", VIA ? "persona " + VIA + " (from the link's ?via=)" : "nobody: the link carries no ?via=").lastChild.id = "gallery-via";
          if (!can || s[5] > now || s[6] && s[6] <= now) return;
          act(d, "mint", "mint one for " + money(price), 0, function () {
            return propose({ to: t.c, key: "collection.mint", args: [acct, VIA], value: price, need: 0, spend: true,
              lines: [["Mints", "the next token of " + s[0]], ["To", cs(acct)], ["Pays", money(price) + ", the price exactly"], ["Shared by", VIA ? "persona " + VIA + ": " + (Number(s[8]) / 100) + " % of the price goes to its Reach" : "nobody"]],
              sentence: "mints the next token of " + s[0] + " to you for " + money(price) + (VIA ? ", " + (Number(s[8]) / 100) + " % of it to the token that shared the link" : ""),
              then: function (rc) {
                var l = (rc.logs || []).filter(function (x) { return same(x.address, t.c) && same(x.topics[0], S.topics.transfer); })[0];
                if (l) { cur = { c: t.c, id: BigInt(l.topics[3]) }; paint(); }
              } });
          }, { spend: true });
        });
      }).catch(function (e) { if (g === gen) { d.hidden = false; note(d, why(e), "warn"); } });
    }

    /*═══════════ its story: owners, memories, sales ═══════════*/
    function story(t, g, k, col) {
      var d = box(host, "its story", "gallery-story"), ow = el("div"), mm = el("div"), sa = el("div");
      ow.id = "gallery-owners"; mm.id = "gallery-memories"; sa.id = "gallery-sales"; d.append(el("h3", "", "owners"), ow, el("h3", "", "memories"), mm, el("h3", "", "sales"), sa);
      var sellers = [];
      var owners = k !== 721 ? Promise.resolve(note(ow, "an ERC-1155 has holders by balance, not one owner")) : walk(t.c, [S.topics.transfer, null, null, T(t.id)]).then(function (ls) {
        if (g !== gen) return;
        if (!ls.length) return note(ow, "no Transfer log names it: never minted, or its contract emits none");
        ls.slice(-12).forEach(function (l) {
          var from = cs("0x" + l.topics[1].slice(26)), to = cs("0x" + l.topics[2].slice(26)), r = el("div", "row owner");
          r.append(el("span", "v", (none(from) ? "minted to " : short(from) + " → ") + short(to) + " · block " + BigInt(l.blockNumber))); r.title = cs(to); ow.append(r);
        });
        ls.forEach(function (l) { sellers.push("0x" + l.topics[2].slice(26)); });
        if (ls.length > 12) note(ow, ls.length + " transfers; the last twelve are shown", "s");
      }, function (e) { if (g === gen) note(ow, "the Transfer log could not be walked on this endpoint: " + (e && e.message || e), "warn"); });
      memories(t, g, mm, col);
      /* who could have sold it: everyone a Transfer gave it to, and everyone who published a listing of it */
      return owners.then(function () { return PUB; }).then(function (ls) { ls.forEach(function (l) { sellers.push("0x" + l.data.slice(26, 66)); }); }, function () {}).then(function () { return sales(t, g, sa, sellers); });
    }
    function memories(t, g, p, col) {
      if (three(p, "journal")) return;
      var J = S.journal, st = note(p, "reading its memories…", "s"); st.id = "gallery-archive";
      return Promise.all([walk(J, [S.topics.inscribed, T(t.c), T(t.id)]), read(J, "journal.countOf", [t.c, t.id]), read(J, "journal.rootOf", [t.c, t.id])]).then(function (v) {
        if (g !== gen) return;
        var ms = v[0].map(function (l) { var h = l.data.slice(2); return { n: BigInt(l.topics[3]), kind: N(h, 0), author: A(h, 1), epoch: W(h, 2), ref: X(h, 3), root: X(h, 4), body: BY(h, 5) }; }).sort(function (a, b) { return a.n < b.n ? -1 : 1; });
        var root = Z32, bad = "";
        ms.forEach(function (m, i) {
          root = ui.kbytes("0x" + enc.params(["bytes32", "uint256", "uint8", "bytes32", "bytes32", "address", "uint64"], [root, m.n, m.kind, ui.kbytes("0x" + m.body), m.ref, m.author, m.epoch]));
          if (!bad && (m.n !== BigInt(i + 1) || !same(root, m.root))) bad = "memory " + m.n + " does not fold from the one before it";
        });
        var count = v[1].w(0), live = "0x" + v[2].words[0];
        st.textContent = !ms.length && !count ? "no memories written into it yet" : bad ? "the archive does not replay: " + bad
          : count !== BigInt(ms.length) ? "the archive does not replay: countOf says " + count + ", the logs hold " + ms.length
          : !same(root, live) ? "the archive does not replay: the logs fold to " + root.slice(0, 10) + "…, rootOf says " + live.slice(0, 10) + "…"
          : "the archive replays: " + ms.length + " memor" + (ms.length > 1 ? "ies fold" : "y folds") + " to rootOf, " + live.slice(0, 10) + "…";
        if (!ms.length || !NS) return;
        /* the constellation: one star per memory where its root puts it, sealed ones dim, the line of the archive between them */
        var sv = function (tag, at, q) { var e = document.createElementNS(NS, tag); for (var a in at) e.setAttribute(a, at[a]); if (q) q.append(e); return e; };
        var svg = sv("svg", { viewBox: "0 0 320 130", role: "img", "aria-label": ms.length + " memories as a constellation, sealed ones dim" }), px, py, cn = el("div");
        cn.id = "gallery-constellation"; cn.style.cssText = "margin:6px 0 10px;border-radius:16px;background:radial-gradient(circle,#ffffff10,#0000 70%)"; cn.append(svg); p.insertBefore(cn, st.nextSibling);
        ms.forEach(function (m) {
          var x = 14 + parseInt(m.root.slice(2, 4), 16) / 255 * 292, y = 12 + parseInt(m.root.slice(4, 6), 16) / 255 * 106;
          var c = m.kind === 4 ? col[1] : col[0], at = { cx: x.toFixed(1), cy: y.toFixed(1), style: "fill:" + c };
          if (px != null) sv("line", { x1: px, y1: py, x2: at.cx, y2: at.cy, style: "stroke:" + col[0], "stroke-opacity": ".45", "stroke-width": ".9" }, svg);
          /* a halo, then the star: a milestone larger, a sealed memory dim */
          sv("circle", Object.assign({ r: 11, "fill-opacity": m.kind === 4 ? ".06" : ".18" }, at), svg);
          var star = sv("circle", Object.assign({ class: "star", r: m.kind === 3 ? 5 : 3.4, "fill-opacity": m.kind === 4 ? ".3" : "1" }, at), svg);
          star.dataset.kind = m.kind; sv("title", {}, star).textContent = "memory " + m.n + " · " + (KIND[m.kind] || "kind " + m.kind);
          px = at.cx; py = at.cy;
        });
        ms.slice(-8).forEach(function (m) {
          var r = el("div", "row memory"); r.dataset.kind = m.kind; r.style.cssText = "padding:9px 0;border-top:1px solid var(--line)"; p.append(r);
          r.append(el("div", "k", "#" + m.n + " · " + (KIND[m.kind] || "kind " + m.kind)), el("div", "v", m.kind === 4 ? "— a sealed memory —" : TX(m.body).slice(0, 280)), el("div", "s", "by " + short(m.author)));
        });
      }, function (e) { if (g === gen) st.textContent = "its memories could not be read: " + (e && e.message || e); });
    }
    function sales(t, g, p, sellers) {
      if (!SEA) return note(p, "no Seaport on this chain");
      var q = sellers.map(lower).filter(function (a, i, x) { return x.indexOf(a) === i; }).slice(-24).map(T);
      if (!q.length) return note(p, "no holder of it is known from its logs, so its sales are not walked", "s");
      return walk(SEA, [S.topics.orderFulfilled, q]).then(function (ls) {
        if (g !== gen) return;
        var n = 0;
        /* a fill whose offer names it: the price is what the consideration paid in currency, the buyer its recipient */
        ls.forEach(function (l) {
          var h = l.data.slice(2), o = N(h, 2) / 32, c = N(h, 3) / 32, it = false, v = 0n, tok = null, i, q2;
          for (i = 0; i < N(h, o); i++) { q2 = o + 1 + i * 4; if (same(A(h, q2 + 1), t.c) && W(h, q2 + 2) === t.id && N(h, q2) > 1) it = true; }
          if (!it) return;
          for (i = 0; i < N(h, c); i++) { q2 = c + 1 + i * 5; if (N(h, q2) < 2) { tok = tok || A(h, q2 + 1); v += W(h, q2 + 3); } }
          var r = el("div", "row sale"); n++;
          r.append(el("span", "v", "sold for " + (none(tok) ? money(v) : v + " of " + short(tok)) + " to " + short(A(h, 1)) + " · block " + BigInt(l.blockNumber))); p.append(r);
        });
        if (!n) note(p, "no Seaport sale of it by any of its holders", "s");
      }, function (e) { if (g === gen) note(p, "Seaport's fills could not be read on this endpoint: " + (e && e.message || e), "warn"); });
    }

    /*═══════════ OpenSea: the door is read, printed, and stays shut ═══════════*/
    function opensea(g) {
      var d = box(host, "include OpenSea", null), lab = el("label", "row"), sw = el("input"), door = el("span", "v", "");
      sw.type = "checkbox"; sw.id = "gallery-opensea"; sw.disabled = true; sw.checked = false; sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", "false");
      lab.append(sw, el("span", "k", "include OpenSea's listings: off")); d.append(lab);
      note(d, "it stays off: OpenSea's book needs an API key and a request to a host this page never makes. A listing here is a Seaport order on chain, the Seaport OpenSea settles on, so anyone can fill it.", "s");
      var row = kv(d, "the door the Timelock wrote", ""); row.lastChild.replaceWith(door); door.id = "gallery-door";
      if (three(row, "bridges")) return door.remove();
      door.textContent = "reading…";
      return read(S.bridges, "bridges.endpointOf", [ui.khex("opensea.v2")]).then(function (r) {
        if (g !== gen) return;
        var u = r.s(0), at = r.w(1);
        door.textContent = u ? u + " · written " + date(at) + "; nothing is sent to it" : at ? "removed " + date(at) : "none recorded on this chain";
      }, function (e) { if (g === gen) door.textContent = why(e); });
    }

    paint();
    /* every receipt, every connect and every visit repaints: the steps of a sale are read from the chain each time */
    window.addEventListener("intact:rights", paint);
    window.addEventListener("intact:lane", function (e) { if (e.detail && e.detail.name === "gallery") paint(); });
  }).catch(function (e) { ui.say("this lane failed to open: " + (e && e.message), "err"); });
})();
