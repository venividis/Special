/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "boot" — the shell itself (H §7.1 planned 103 sentences; 137 run, the rest split or added by review)

  Twelve blocks, each on the runner's fresh chain: A build and boot, B the
  viewer ("the opaque origin boots the viewer and never offers connect"),
  C the loader's refusal ("a tampered panel is refused"), N discovery and
  the chain gate, R the collection page and the mint-from-the-page flow,
  Z session mode, Q the QR, V the self-hash footer, E′ the chips, O the
  shell's half of escaping, P the loader, G′ the slab's generic rules. The
  two BUILD-PLAN sentences this file owns end their blocks as `t.ok(...,
  "<sentence>")`, verbatim, so INVARIANTS can quote them.

  Nine sentences in N landed with the shell's fix round (review round two,
  each reproduced through the shim before the fix): a click inside the
  picker does not spend the dismissal; clicking your own address with two
  wallets enters the dismissed state — a read while the picker is open is
  refused with the §2 sentence, no read reaches the dropped wallet until the
  picker is answered, and the answer connects the chosen one; with one
  announcer it asks that wallet again; a failed eth_chainId is not "chain
  0"; an older rights read landing later is thrown away (the shim's queue is
  bypassed by hand to stage the overtaking); a successful #switch refreshes
  once; and the shim itself cannot click what a person cannot see.

  Three more landed with the review of that round (round three, each
  reproduced through the shim first): a wallet the page dropped, or passed
  over on a late pick, moves nothing — its chainChanged and accountsChanged
  are heard only while it is the provider in use; a stale rights read is
  thrown away whether it answers or rejects, and an answer landing on a
  wrong chain writes nothing; and with one announcer the crest click
  disconnects the page honestly before asking, so a decline leaves it so.

  Setup this group performs on its chain (every id literal below refers to
  it): #1, #2, #3 minted to `me`; `setUser(1, renter, +7 d)`; a session on
  #1's Reach for `agentW` (target: the Pool, selector: swapExactIn); the
  name trait of #1 set to `</script>x` (O); a second chain with a Breakable
  as the Router for E9. Lines dropped from H §7.1: none; where the real
  swap panel is not yet on the branch the placeholder panel from
  tools/fixtures/ stands in and the sentences about loading, hashing and
  refusing it hold the same.

  Elements this group reads are the shell's (CONSOLE §6.1); the one it
  reads from a panel is `#agent-stub` (the shell agent's own stub).
───────────────────────────────────────────────────────────────────────────*/
import vm from "node:vm";
import zlib from "node:zlib";

const GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";
const SWAP_IN = "swapExactIn(uint256,bool,uint256,uint256,address,uint64)";
const EXEC = "execute(address,uint256,bytes,uint8)", BATCH = "executeBatch((address,uint256,bytes)[])",
      TYPED = "executeTyped((address,uint256,bytes,(address,uint256)[],(address,uint256)[],uint64))";
const WAD = 10n ** 18n;
const short = (a) => a.slice(0, 6) + " … " + a.slice(-4);
const checksum = (a, kec) => { const h = kec(Buffer.from(a.slice(2).toLowerCase(), "utf8")).slice(2); let o = "0x"; for (let i = 0; i < 40; i++) o += parseInt(h[i], 16) >= 8 ? a[i + 2].toUpperCase() : a[i + 2].toLowerCase(); return o; };

export async function run(t, ctx) {
  const { c, site, GET, actors, weth, plan, sel, enc, encodeParams, decUint, decAddr, kec, fs, path, ROOT, ZERO, SVG_NS, walletFor, bootToken, bootPage, lane, mint, EVM, stateOfHtml } = ctx;
  const { me, renter, buyer, agentW } = actors;
  const ME = me.from.toString(), hub = site.hub, reach1 = decAddr(await c.read(hub, "account(uint256)", [1]));
  const clickAll = (page) => { for (const b of page.$$("button")) { try { page.click(b); } catch {} } };
  const calls = (W, method) => W.calls.filter((x) => x.method === method);
  const ethCalls = (W) => calls(W, "eth_call");
  const callsWith = (W, to, selector) => ethCalls(W).filter((x) => String(x.params[0].to).toLowerCase() === to.toLowerCase() && String(x.params[0].data).toLowerCase().startsWith(selector));
  const DIST = fs.readFileSync(path.join(ROOT, "dist/app.html"), "utf8");

  /* the cast: #1, #2, #3 to me; a renter on #1; a session key on #1's Reach */
  await mint(c, site, ME); await mint(c, site, ME); await mint(c, site, ME);
  const now = () => EVM.BLOCK.header.timestamp;
  await c.exec(hub, "setUser(uint256,address,uint64)", [1, renter.from.toString(), now() + 7n * 86400n]);
  await c.exec(reach1, GRANT, [agentW.from.toString(), now() + 86400n, WAD, [], [site.pool], [sel(SWAP_IN)], 0, 0], { label: "grantSession" });
  const live1 = await GET(["token", "1", "live"]);
  const S1 = stateOfHtml(live1.body).obj;
  const PREM = site.premises.toLowerCase();
  const WEB3 = `web3://${PREM}:1/token/1/live`;

  /*═══════════ A · build and boot ═══════════*/
  t.head("A · build and boot (console, holder, #1)");
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
    t.ok(plan.shell === "engine/app.html" && plan.shellIsFixture === false, "the shell that shipped is the console, not the placeholder" + (plan.placeholder ? ` (panels still fixtures: ${plan.fixturePanels.join(" ")} — the runner holds each against its group file)` : ""));
    t.ok(page.written === DIST, "the loader inflated the shell the build wrote, byte for byte", `written ${page.written.length} vs dist ${DIST.length}`);
    t.ok(vctx.INTACT.id === 1 && vctx.INTACT.__pin === 1 && !("$wallets" in vctx.INTACT), "window.INTACT survived document.open(), and the shell took the captured wallets off it");
    t.ok(page.errors.length === 0, "no script threw on the way in", page.errors.map((e) => e.stack || e.message).join("\n"));
    t.eq(page.$("body").dataset.mode, "console", "the body names its boot mode");
    const csp = (page.$("meta[http-equiv]") || { getAttribute: () => "" }).getAttribute("content") || "";
    t.ok(csp.includes("script-src 'unsafe-inline' blob:") && csp.includes("connect-src 'self'"), "the CSP meta is in the document the shell wrote");
    const offOrigin = [...page.$$("script[src]"), ...page.$$("img[src]")].some((e) => !/^(blob:|data:)/.test(e.getAttribute("src"))) || page.$$("link[href]").some((e) => !/^(blob:|data:)/.test(e.getAttribute("href")));
    t.ok(!offOrigin && page.fetches.every((f) => f.url.startsWith("/")), "nothing in the document points off the origin");
    const fact = (k) => page.text(`#facts [data-fact=${k}]`);
    t.ok(fact("id") === "1" && fact("chain") === "1" && fact("holder").toLowerCase() === S.owner && fact("epoch") === "1" && fact("status") === "Active",
      "Home prints the baked facts through textContent", `${fact("id")} ${fact("chain")} ${fact("holder")} ${fact("epoch")} ${fact("status")}`);
    t.ok(ctx.gzipBytes <= 15_000, `the shell's gzip is under the ceiling and the routes are cold-measured (${ctx.gzipBytes.toLocaleString()} B gzip; the runner printed the cold gas)`);
    t.ok(page.innerHTMLWrites === 0, "nothing was assigned through innerHTML, by anybody, all run (checked again at the end)");
    page.close();
  }

  /*═══════════ B · the viewer ═══════════*/
  t.head("B · the opaque origin boots the viewer and never offers connect");
  let B = true;
  {
    const { page } = await bootToken(1, { opaque: true });
    const q = (cond, name, d) => { t.ok(cond, name, d); B = B && !!cond; };
    q(page.$("body").dataset.mode === "viewer", "the detector fired");
    q(page.text("#link-web3") === WEB3, "the web3:// link is printed and is this token's", page.text("#link-web3"));
    const scan = DIST.split(SVG_NS).join("");
    const fetchCount = (DIST.match(/fetch\(/g) || []).length;
    const fetchNearPanel = /fetch\([^)]{0,80}\/panel\//.test(DIST);
    q(page.text("#link-https").includes("<gateway>") && page.text("#link-https").includes("/token/1/live") &&
      !/https?:\/\/[a-z0-9.-]+\.(org|com|io|xyz|net)\b/i.test(scan) && !/\bwss?:\/\//.test(scan) && !/"rpc"\s*:/.test(DIST) &&
      (DIST.match(/www\.w3/g) || []).length === 1 && fetchCount === 1 && fetchNearPanel,
      "the https twin is a template, never a baked host", `${page.text("#link-https")} fetch(×${fetchCount} w3×${(DIST.match(/www\.w3/g) || []).length}`);
    const svg = page.$("#qr svg[role=img]");
    q(!!svg && svg.getAttribute("aria-label") === WEB3 && page.$$("#qr svg rect").length >= 400, "a QR was drawn, by the shell, as SVG", svg && page.$$("#qr svg rect").length);
    q(!!svg && svg.textContent.trim() === "" && !svg.querySelector("a,script,foreignObject,image") && svg.children.every((r) => r.tagName === "rect" && r.getAttribute("shape-rendering") === "crispEdges"),
      "the QR carries nothing but shapes");
    q((page.$("#connect") === null || page.$("#connect").hidden) && page.$$("[data-go]").length === 0 && !/connect a wallet/i.test(page.$("body").textContent), "there is no connect control");
    q(/nothing here can sign/i.test(page.text("#viewer-note")), "the page says nothing here can sign");
    q(page.$$("#lanes a").length === 0 || page.$$("#lanes a").every((a) => a.getAttribute("aria-disabled") === "true"), "the lanes are not offered without a provider");
    q(page.fetches.length === 0 && page.errors.length === 0, "the viewer fetched nothing and asked nothing", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx, S } = await bootToken(1, { opaque: true, wallet: W });
    const q = (cond, name, d) => { t.ok(cond, name, d); B = B && !!cond; };
    clickAll(page); await page.settle();
    q(W.prompts().length === 0, "with a wallet announced, the viewer still never prompts", W.prompts().map((p) => p.method).join(","));
    q(W.firstIndex("eth_chainId") !== -1 && W.firstIndex("eth_chainId") < W.firstIndex("eth_call"), "it compared the chain before any read");
    q(W.count("eth_accounts") >= 1 && W.count("eth_requestAccounts") === 0, "it found the account quietly");
    page.hash("#swap"); await lane(page, "swap");
    const panelCall = callsWith(W, S.engine, sel("panel(uint256)"));
    q(panelCall.length >= 1 && vctx.INTACT.loaded.swap === true && page.appended.length === 1 && page.appended[0].hash === S.panels.swap,
      "it loaded a panel through the provider, hash-checked", `calls ${panelCall.length} loaded ${vctx.INTACT.loaded.swap} appended ${page.appended.length}`);
    q(page.$("body").dataset.rights === "1" && page.$$("[data-go]").length === 0 && !page.$("#cbox").classList.contains("on"), "a wallet with rights still gets no signable control in the viewer", page.$("body").dataset.rights);
    q(vctx.__storageReads === 1 && page.errors.length === 0, "closing the tab is logout: nothing was stored", `reads ${vctx.__storageReads} errors ${page.errors.map((e) => e.message).join("; ")}`);
    page.close();
  }
  {
    const W = walletFor(c, me, { chainId: 0x2105 });
    const { page } = await bootToken(1, { opaque: true, wallet: W });
    clickAll(page); await page.settle(); await page.settle();
    const ok14 = ethCalls(W).length === 0 && page.$("body").dataset.chain === "wrong" && /your wallet is on Base; this token lives on Ethereum/.test(page.text("#crest")) &&
      (page.$("#switch") === null || page.$("#switch").hidden) && W.count("wallet_switchEthereumChain") === 0 && W.prompts().length === 0 &&
      callsWith(W, S1.engine, sel("engineHash()")).length === 0 && W.count("eth_blockNumber") === 0 &&
      /self-consistent; wallet on Base, not this token's chain/.test(page.text("#verified"));
    t.ok(ok14, "a viewer wallet on another chain reads nothing, and is offered no move", `calls ${ethCalls(W).length} chain ${page.$("body").dataset.chain} crest "${page.text("#crest")}" verified "${page.text("#verified")}"`);
    B = B && ok14;
    page.close();
  }
  t.ok(B, "the opaque origin boots the viewer and never offers connect");

  /*═══════════ C · a tampered panel is refused ═══════════*/
  t.head("C · a tampered panel is refused");
  let C = true;
  const q = (cond, name, d) => { t.ok(cond, name, d); C = C && !!cond; };
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    page.tamperPanel("swap", (b) => { b[40] ^= 1; return b; });
    await lane(page, "swap");
    const text = page.text("#lane-swap");
    q(/panel refused/.test(text) && /hash/.test(text), "a flipped byte is refused with a sentence", text.slice(0, 120));
    q(page.appended.length === 0, "nothing was injected");
    q(!(vctx.INTACT.loaded && vctx.INTACT.loaded.swap === true) && page.$("#lane-swap").dataset.loaded === undefined, "the lane never marked itself loaded");
    const hs = text.match(/0x[0-9a-f]{64}/g) || [];
    q(!/function/.test(text) && hs.length === 2 && hs.includes(S1.panels.swap) && hs.some((h) => h !== S1.panels.swap),
      "the refusal leaks no code (the only 32-byte words are the pin and the computed hash)", text.slice(0, 160));
    page.close();
  }
  {
    const { page } = await bootToken(1, { wallet: walletFor(c, me) });
    page.tamperPanel("swap", (b) => { b[40] ^= 1; return b; }, { forgeETag: true });
    await lane(page, "swap");
    q(/panel refused/.test(page.text("#lane-swap")) && page.appended.length === 0, "a forged ETag changes nothing");
    page.close();
  }
  {
    const { page } = await bootToken(1, { wallet: walletFor(c, me) });
    page.tamperPanel("swap", (b) => b.subarray(0, b.length - 7));
    await lane(page, "swap");
    q(/panel refused/.test(page.text("#lane-swap")) && page.appended.length === 0, "a truncated panel is refused");
    page.close();
  }
  {
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: walletFor(c, me) });
    await lane(page, "swap");
    q(vctx.INTACT.loaded.swap === true && page.appended.length === 1, "the untampered panel loads once");
    const a = page.appended[0];
    q(a.type === "text/javascript" && a.hash === S.panels.swap && a.text === fs.readFileSync(path.join(ROOT, "dist/panels/swap.js"), "utf8"), "what was injected is exactly what was pinned");
    await lane(page, "social"); await lane(page, "swap");
    q(page.appended.length === 2 && page.fetches.filter((f) => f.url.endsWith("/panel/swap.js")).length === 1, "revisiting a lane injects nothing new", `appended ${page.appended.length} fetches ${page.fetches.map((f) => f.url).join(",")}`);
    const n = page.fetches.length;
    page.hash("#nonsense"); await page.settle();
    q(page.fetches.length === n && page.appended.length === 2 && page.$("#lane-home").classList.contains("on"), "a lane the state does not pin is not a lane");
    page.close();
  }
  {
    const { page, ctx: vctx } = await bootToken(1, { wallet: walletFor(c, me) });
    page.tamperPanel("social", (b) => { b[10] ^= 1; return b; });
    await lane(page, "social"); await lane(page, "swap");
    q(/panel refused/.test(page.text("#lane-social")) && vctx.INTACT.loaded.swap === true, "a refusal is per lane");
    page.close();
  }
  {
    const W = walletFor(c, me);
    const raw = await c.read(site.engine, "panel(uint256)", [0]);
    /* a valid gzip of altered content: the inflated panel with one byte flipped, re-gzipped, ABI-encoded */
    const inflated = zlib.gunzipSync(Buffer.from(raw.slice(2 + 128).slice(0, Number(decUint(raw, 1)) * 2), "hex"));
    inflated[20] ^= 1;
    const regz = zlib.gzipSync(inflated);
    W.answer(S1.engine, sel("panel(uint256)"), () => "0x" + encodeParams("bytes", ["0x" + regz.toString("hex")]));
    const { page } = await bootToken(1, { opaque: true, wallet: W });
    await lane(page, "swap");
    q(/panel refused/.test(page.text("#lane-swap")) && page.appended.length === 0, "the viewer path is checked the same way", page.text("#lane-swap").slice(0, 100));
    page.close();
  }
  t.ok(C, "a tampered panel is refused");

  /*═══════════ N · discovery and the chain gate ═══════════*/
  t.head("N · discovery and the chain gate");
  {
    const WA = walletFor(c, me, { rdns: "io.a", name: "Wallet A" }), WB = walletFor(c, me, { rdns: "io.b", name: "Wallet B" });
    const { page, ctx: vctx } = await bootToken(1, { wallets: [WA, WB], awaitReady: false });
    await page.settle(); await page.settle();
    const buttons = page.$$("#picker button[data-rdns]");
    t.ok(buttons.length === 2 && buttons.map((b) => b.textContent).join("|") === "Wallet A|Wallet B" && WA.prompts().length + WB.prompts().length === 0 && ethCalls(WA).length + ethCalls(WB).length === 0,
      "two wallets, a picker, no choice made for you", `buttons ${buttons.length} calls ${ethCalls(WA).length + ethCalls(WB).length}`);
    const na = WA.calls.length;
    page.click(buttons[1]); await page.settle();
    await vctx.INTACT.ui.ready; await page.settle();
    t.ok(ethCalls(WB).length >= 1 && WA.calls.length === na && ethCalls(WA).length === 0 && page.$("body").dataset.rights === "1", "the picked wallet answers every read and send", `WB ${ethCalls(WB).length} WA ${WA.calls.length}`);
    t.ok(vctx.localStorage.getItem("intact.wallet") === "io.b", "the remembered choice is a convenience, and the delegate check happens at connect (part 1: the rdns is stored)");
    page.close();
  }
  {
    const W = walletFor(c, me, { connected: false });
    const { page } = await bootToken(1, { wallet: W });
    const noPicker = page.$$("#picker button").length === 0 && (page.$("#picker").hidden);
    const before = W.count("eth_requestAccounts");
    page.click(page.$("#connect")); await page.settle(); await page.settle();
    t.ok(noPicker && before === 0 && W.count("eth_requestAccounts") === 1, "one wallet is used, but not before a gesture");
    const order = W.calls.map((x) => x.method);
    t.ok(order[0] === "eth_chainId" && order[1] === "eth_accounts" && order.indexOf("eth_requestAccounts") > order.indexOf("eth_accounts"), "quiet first, loud on a gesture", order.join(","));
    t.ok(W.lastIndex("eth_getCode") > W.firstIndex("eth_requestAccounts") && page.ctx.localStorage.getItem("intact.wallet") === W.info.rdns, "the remembered choice is a convenience, and the delegate check happens at connect", order.join(","));
    /* the shim models a person, not the API: #connect is hidden once connected, and a hidden control
       dispatches nothing — the group once clicked it here and the shell prompted (review, round two) */
    const req = W.count("eth_requestAccounts");
    const pressed = page.click(page.$("#connect")); await page.settle();
    t.ok(page.$("#connect").hidden && pressed === false && W.count("eth_requestAccounts") === req, "the shim cannot click what a person cannot see: a hidden #connect dispatches nothing", `hidden ${page.$("#connect").hidden} pressed ${pressed} prompts ${W.count("eth_requestAccounts") - req}`);
    /* CONSOLE §2: with one announcer there is no picker — clicking your own address asks that wallet again and stays connected */
    const name0 = page.text("#c-wallet-v");
    page.click(page.$("#c-wallet-v")); await page.settle(); await page.settle();
    t.ok(W.count("eth_requestAccounts") === req + 1 && page.ctx.INTACT.ui.account() === checksum(ME, kec) && page.$("body").dataset.rights === "1" && page.text("#c-wallet-v") === name0 && /Shim Wallet · 0x/.test(name0),
      "with one announcer, clicking your own address asks that wallet again and stays connected", `prompts +${W.count("eth_requestAccounts") - req} account ${page.ctx.INTACT.ui.account()} rights "${page.$("body").dataset.rights}" crest "${page.text("#c-wallet-v")}"`);
    /* review, round three: the same click nulled the account and asked, so for the length of the wallet prompt
       ui.account() was null under a crest that named the wallet, rights 1, #connect hidden, no intact:rights — and a
       propose in that window was refused with "connect the holding wallet" under a crest that said it was. The page
       is now disconnected first, honestly, and a decline leaves it so (CONSOLE §2); the sentence above holds because
       the shim's wallet answers, this one holds the prompt open */
    let held = null; W.override("eth_requestAccounts", () => new Promise((_, j) => { held = j; }));
    const fired = []; page.ctx.addEventListener("intact:rights", (e) => fired.push(e.detail.bits));
    page.click(page.$("#c-wallet-v")); await page.settle(); await page.settle();
    const asked = typeof held === "function" && page.ctx.INTACT.ui.account() === null && page.ctx.INTACT.ui.rights() === null && page.$("body").dataset.rights === "" &&
      page.text("#c-wallet-v") === "read only — connect" && !page.$("#connect").hidden && fired.length === 1 && fired[0] === null;
    const detail = `asked ${asked}: account ${page.ctx.INTACT.ui.account()} rights ${page.ctx.INTACT.ui.rights()} body "${page.$("body").dataset.rights}" crest "${page.text("#c-wallet-v")}" connect hidden ${page.$("#connect").hidden} fired ${JSON.stringify(fired)}`;
    if (held) held(Object.assign(new Error("User rejected the request."), { code: 4001 })); await page.settle(); await page.settle();
    t.ok(asked && page.ctx.INTACT.ui.account() === null && page.$("body").dataset.rights === "" && !page.$("#connect").hidden && page.text("#c-wallet-v") === "read only — connect" && page.text("#tick") === "you declined to connect",
      "with one announcer the page is disconnected while the wallet is asked again, and a decline leaves it so", `${detail}; declined: account ${page.ctx.INTACT.ui.account()} rights "${page.$("body").dataset.rights}" crest "${page.text("#c-wallet-v")}" tick "${page.text("#tick")}"`);
    W.override("eth_requestAccounts", null);
    page.close();
  }
  {
    const WA1 = walletFor(c, me, { rdns: "io.a", name: "A", uuid: "u1" }), WA2 = walletFor(c, me, { rdns: "io.a", name: "A again", uuid: "u2" }), WB = walletFor(c, me, { rdns: "io.b", name: "B" });
    const { page } = await bootToken(1, { wallets: [WA1, WA2, WB], awaitReady: false });
    await page.settle(); await page.settle();
    t.ok(page.$$("#picker button[data-rdns=\"io.a\"]").length === 1 && page.$$("#picker button").length === 2, "dedup by rdns", page.$$("#picker button").length);
    page.close();
  }
  {
    const WA = walletFor(c, me, { rdns: "io.a", name: "A", connected: false }), WB = walletFor(c, me, { rdns: "io.b", name: "B", connected: false });
    const { page, ctx: vctx } = await bootToken(1, { wallet: WA });
    const chainOnA = WA.count("eth_chainId") >= 1;
    WB.attach(vctx, page); await page.settle();
    page.click(page.$("#connect")); await page.settle();
    const picker = page.$$("#picker button[data-rdns]");
    const askedNothing = WA.count("eth_requestAccounts") === 0 && WB.count("eth_requestAccounts") === 0;
    const bBtn = picker.find((b) => b.dataset.rdns === "io.b");
    if (bBtn) page.click(bBtn); await page.settle(); await page.settle();
    const laterOnB = WB.count("eth_requestAccounts") === 1 && WA.count("eth_requestAccounts") === 0 && ethCalls(WB).length >= 1;
    t.ok(chainOnA && picker.length === 2 && askedNothing && laterOnB, "a late wallet joins, and the gesture asks", `picker ${picker.length} A.req ${WA.count("eth_requestAccounts")} B.req ${WB.count("eth_requestAccounts")} B.calls ${ethCalls(WB).length}`);
    page.close();
  }
  {
    /* D8's hard case: two announcers, the picker dismissed. window.ethereum is one of the two in a
       real browser; reading through it would be a choice the person declined to make */
    const WA = walletFor(c, me, { rdns: "io.a", name: "Wallet A", legacy: true }), WB = walletFor(c, me, { rdns: "io.b", name: "Wallet B" });
    const { page, ctx: vctx } = await bootToken(1, { wallets: [WA, WB], awaitReady: false });
    await page.settle(); await page.settle();
    page.click(page.$("#picker")); await page.settle();
    await vctx.INTACT.ui.ready; await page.settle();
    const quiet = WA.calls.length + WB.calls.length === 0 && page.$("body").dataset.chain === "none" && page.$("body").dataset.rights === "";
    const asksAgain = page.$("#connect") && !page.$("#connect").hidden && page.text("#rights-sentence") === "no wallet chosen; connect asks again";
    page.click(page.$("#connect")); await page.settle();
    t.ok(quiet && asksAgain && page.$$("#picker button[data-rdns]").length === 2 && !page.$("#picker").hidden,
      "a dismissed picker chooses nothing, and the gesture asks again", `calls A ${WA.calls.length} B ${WB.calls.length} chain ${page.$("body").dataset.chain} connect ${page.$("#connect") && page.$("#connect").hidden} "${page.text("#rights-sentence")}" picker ${page.$$("#picker button[data-rdns]").length}`);
    page.close();
  }
  {
    /* review, round two: the backdrop's dismissal was registered { once }, and a click anywhere inside the
       card (its heading, the space between buttons) spent it — after that the backdrop never dismissed and
       the only way out was to pick a wallet. A click inside the card must leave the dismissal intact,
       first time and every time */
    const WA = walletFor(c, me, { rdns: "io.a", name: "Wallet A" }), WB = walletFor(c, me, { rdns: "io.b", name: "Wallet B" });
    const { page, ctx: vctx } = await bootToken(1, { wallets: [WA, WB], awaitReady: false });
    await page.settle(); await page.settle();
    page.click(page.$("#picker .card")); await page.settle();
    const stillOpen = !page.$("#picker").hidden;
    page.click(page.$("#picker")); await page.settle();
    await vctx.INTACT.ui.ready; await page.settle();
    const dismissed = page.$("#picker").hidden && page.$("body").dataset.chain === "none" && page.$("body").dataset.rights === "" && !page.$("#connect").hidden && page.text("#rights-sentence") === "no wallet chosen; connect asks again";
    page.click(page.$("#connect")); await page.settle();
    const reopened = !page.$("#picker").hidden && page.$$("#picker button[data-rdns]").length === 2;
    page.click(page.$("#picker .card")); await page.settle();
    page.click(page.$("#picker")); await page.settle();
    t.ok(stillOpen && dismissed && reopened && page.$("#picker").hidden && WA.calls.length + WB.calls.length === 0,
      "a click inside the picker does not spend the dismissal", `open after card ${stillOpen} dismissed ${dismissed} reopened ${reopened} hidden again ${page.$("#picker").hidden} calls ${WA.calls.length + WB.calls.length}`);
    page.close();
  }
  {
    /* review, round two: clicking your own address nulled the account without the rights path — a dismissed
       re-opened picker left ui.rights() at 1, #connect hidden, the crest naming the dropped wallet and every
       read still going to it. CONSOLE §2 now: with two or more announcers the page is in the dismissed state
       until the picker is answered */
    const WA = walletFor(c, me, { rdns: "io.a", name: "Wallet A" }), WB = walletFor(c, me, { rdns: "io.b", name: "Wallet B" });
    const { page, ctx: vctx } = await bootToken(1, { wallets: [WA, WB], awaitReady: false });
    await page.settle(); await page.settle();
    page.click(page.$$("#picker button[data-rdns]")[1]); await page.settle();
    await vctx.INTACT.ui.ready; await page.settle();
    const ui = vctx.INTACT.ui, nB = WB.calls.length, fired = [];
    const connected = ui.account() === checksum(ME, kec) && ui.rights() === 1 && /Wallet B · 0x/.test(page.text("#c-wallet-v"));
    vctx.addEventListener("intact:rights", (e) => fired.push(e.detail.bits));
    page.click(page.$("#c-wallet-v")); await page.settle();
    const open = !page.$("#picker").hidden && page.$$("#picker button[data-rdns]").length === 2;
    const during = ui.account() === null && ui.rights() === null && page.$("body").dataset.chain === "none" && page.$("body").dataset.rights === "" && page.text("#c-wallet-v") === "read only" && !page.$("#connect").hidden &&
      page.text("#rights-sentence") === "no wallet chosen; connect asks again" && fired.length === 1 && fired[0] === null;
    const refused = await t.refuses(() => ui.read(hub, "hub.custodyEpoch", [1n]), /^no wallet chosen; connect asks again$/, "clicking your own address drops the wallet into the dismissed state, and a read while the picker is open is refused with the §2 sentence");
    page.click(page.$("#picker")); await page.settle(); await page.settle();
    t.ok(connected && open && during && refused && ui.account() === null && ui.rights() === null && !page.$("#connect").hidden && WB.calls.length === nB && WA.calls.length === 0,
      "after drop-then-dismiss the page is in the dismissed state, and no eth_call reached the dropped wallet", `connected ${connected} open ${open} during ${during} account ${ui.account()} rights ${ui.rights()} connect hidden ${page.$("#connect").hidden} B calls +${WB.calls.length - nB} A calls ${WA.calls.length} fired ${JSON.stringify(fired)}`);
    /* the picker, answered: the chosen wallet connects and every read goes to it */
    page.click(page.$("#connect")); await page.settle();
    const nB2 = WB.calls.length;
    page.click(page.$$("#picker button[data-rdns]").find((b) => b.dataset.rdns === "io.a")); await page.settle(); await page.settle(); await page.settle();
    t.ok(ui.account() === checksum(ME, kec) && ui.rights() === 1 && page.$("body").dataset.rights === "1" && /Wallet A · 0x/.test(page.text("#c-wallet-v")) && page.$("#connect").hidden && ethCalls(WA).length >= 1 && WB.calls.length === nB2 && WA.count("eth_requestAccounts") === 1,
      "the picker answered after a drop connects the chosen wallet, and the dropped one is still never asked", `account ${ui.account()} rights ${ui.rights()} crest "${page.text("#c-wallet-v")}" A calls ${ethCalls(WA).length} B +${WB.calls.length - nB2}`);
    page.close();
  }
  {
    /* review, round three: a wallet dropped from the crest, or passed over on a late pick, stayed wired, so its
       chainChanged moved the gate for the wallet that replaced it — a read on the chosen wallet was refused with the
       dropped one's chain sentence, and in the inverse case a read passed the gate to a wallet on Base for one
       eth_chainId round trip; its accountsChanged re-read everything through the chosen one. Three stagings, one
       sentence: B dropped for A with A on Ethereum, then with A on Base; A passed over for B on a late pick */
    const drop = async (optsA) => {
      const WA = walletFor(c, me, { rdns: "io.a", name: "Wallet A", ...optsA }), WB = walletFor(c, me, { rdns: "io.b", name: "Wallet B" });
      const { page, ctx: vctx } = await bootToken(1, { wallets: [WA, WB], awaitReady: false });
      await page.settle(); await page.settle();
      page.click(page.$$("#picker button[data-rdns]")[1]); await page.settle(); await vctx.INTACT.ui.ready; await page.settle();
      page.click(page.$("#c-wallet-v")); await page.settle();
      page.click(page.$$("#picker button[data-rdns]").find((b) => b.dataset.rdns === "io.a")); await page.settle(); await page.settle(); await page.settle();
      return { WA, WB, page, ui: vctx.INTACT.ui };
    };
    const one = await drop({});
    const onA = one.ui.account() === checksum(ME, kec) && one.page.$("body").dataset.chain === "ok";
    const nA = one.WA.calls.length, nB = one.WB.calls.length;
    one.WB.setChain(0x2105);
    const stillOk = one.page.$("body").dataset.chain === "ok" && /Wallet A · 0x/.test(one.page.text("#c-wallet-v"));
    let epoch = null; try { epoch = (await one.ui.read(hub, "hub.custodyEpoch", [1n])).w(0); } catch {}
    await one.page.settle();
    one.WB.setAccounts([renter.from.toString()]); await one.page.settle(); await one.page.settle();
    const quiet = one.WA.calls.length === nA + 1 && one.WB.calls.length === nB;
    const d1 = `A: onA ${onA} chain after B's chainChanged ${one.page.$("body").dataset.chain} crest "${one.page.text("#c-wallet-v")}" read ${epoch} A +${one.WA.calls.length - nA} (${one.WA.calls.slice(nA).map((x) => x.method).join(",")}) B +${one.WB.calls.length - nB}`;
    one.page.close();
    const two = await drop({ chainId: 0x2105 });
    const wrongOnA = two.page.$("body").dataset.chain === "wrong" && ethCalls(two.WA).length === 0;
    two.WB.setChain(1);
    const stillWrong = two.page.$("body").dataset.chain === "wrong";
    let msg = null; try { await two.ui.read(hub, "hub.custodyEpoch", [1n]); } catch (e) { msg = e.message; }
    await two.page.settle(); await two.page.settle();
    const noRead = ethCalls(two.WA).length === 0 && /on Base; this token lives on Ethereum/.test(msg || "");
    const d2 = `A on Base: wrong ${wrongOnA} chain after B's chainChanged(0x1) ${stillWrong ? "wrong" : two.page.$("body").dataset.chain} read "${msg}" A eth_call ${ethCalls(two.WA).length}`;
    two.page.close();
    const WA = walletFor(c, me, { rdns: "io.a", name: "A", connected: false }), WB = walletFor(c, me, { rdns: "io.b", name: "B", connected: false });
    const { page, ctx: vctx } = await bootToken(1, { wallet: WA });
    WB.attach(vctx, page); await page.settle();
    page.click(page.$("#connect")); await page.settle();
    page.click(page.$$("#picker button[data-rdns]").find((b) => b.dataset.rdns === "io.b")); await page.settle(); await page.settle();
    const onB = /B · 0x/.test(page.text("#c-wallet-v")) && page.$("body").dataset.chain === "ok";
    const nB3 = WB.calls.length;
    WA.setChain(0x2105);
    const lateOk = page.$("body").dataset.chain === "ok";
    await page.settle(); await page.settle();
    t.ok(onA && stillOk && epoch === 1n && quiet && wrongOnA && stillWrong && noRead && onB && lateOk && WB.calls.length === nB3,
      "a wallet the page dropped moves nothing: its chainChanged and accountsChanged neither move the gate nor cause a read", `${d1}; ${d2}; late pick: onB ${onB} chain after A's chainChanged ${lateOk ? "ok" : page.$("body").dataset.chain} B +${WB.calls.length - nB3}`);
    page.close();
  }
  {
    /* review, round two: a failed eth_chainId left walletChain at 0 and the crest read "your wallet is on
       chain 0". Zero and no answer are different facts here too: the chain is unreachable, no read is sent,
       and the move is still offered */
    const W = walletFor(c, me);
    W.override("eth_chainId", () => { throw Object.assign(new Error("boom"), { code: -32603 }); });
    const { page } = await bootToken(1, { wallet: W });
    const crest = page.text("#c-wallet-v");
    t.ok(!/chain 0/.test(crest) && crest === "your wallet is on an unreachable chain; this token lives on Ethereum" && page.$("body").dataset.chain === "wrong" && ethCalls(W).length === 0 && !page.$("#switch").hidden &&
      page.text("#verified") === "self-consistent; wallet on an unreachable chain, not this token's chain",
      "a failed eth_chainId is not chain 0: the crest says the chain is unreachable, reads nothing, and offers the move", `crest "${crest}" chain ${page.$("body").dataset.chain} calls ${ethCalls(W).length} verified "${page.text("#verified")}"`);
    page.close();
  }
  {
    /* discovery happened before this document existed: document.open() erases the wallets' listeners,
       so a loader that did not capture the announcements finds no wallet at all. The same two wallets,
       the capture lines cut from the served document — the shim's open() erases exactly as a browser's */
    const CAPTURE = 'const W=[];addEventListener("eip6963:announceProvider",e=>W.push(e.detail));dispatchEvent(new Event("eip6963:requestProvider"));';
    const stripped = live1.body.replace(CAPTURE, "").replace("window.INTACT.$wallets=W;", "");
    const WA = walletFor(c, me, { rdns: "io.a", name: "Wallet A" }), WB = walletFor(c, me, { rdns: "io.b", name: "Wallet B" });
    const { boot } = await import("../dom-shim.mjs");
    const pg = await boot(stripped, { wallets: [WA, WB], url: "/token/1/live", GET });
    t.ok(live1.body.includes(CAPTURE) && stripped.length < live1.body.length && pg.$$("#picker button[data-rdns]").length === 0 && pg.$("body").dataset.chain === "none" && WA.calls.length + WB.calls.length === 0,
      "the loader captures the announcements before document.open(), and a loader without the capture finds no wallet", `picker ${pg.$$("#picker button[data-rdns]").length} chain ${pg.$("body").dataset.chain} calls ${WA.calls.length + WB.calls.length}`);
    pg.close();
  }
  {
    const WL = walletFor(c, me, { legacy: true, noAnnounce: true });
    const { page } = await bootToken(1, { wallet: WL });
    const legacyUsed = WL.count("eth_chainId") >= 1 && page.$("body").dataset.chain === "ok";
    page.close();
    const WL2 = walletFor(c, me, { legacy: true, noAnnounce: true }), WX = walletFor(c, me, { rdns: "io.x" });
    const { page: p2 } = await bootToken(1, { wallets: [WL2, WX] });
    t.ok(legacyUsed && WX.count("eth_chainId") >= 1 && WL2.calls.length === 0, "legacy fallback only when nothing announced", `legacy ${WL2.calls.length} announced ${WX.calls.length}`);
    p2.close();
  }
  {
    const W = walletFor(c, me, { chainId: 0x2105 });
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
    await page.settle();
    const pre = ethCalls(W).length === 0 && page.$("body").dataset.chain === "wrong" && callsWith(W, S.engine, sel("engineHash()")).length === 0 && W.count("eth_blockNumber") === 0 &&
      /self-consistent; wallet on Base, not this token's chain/.test(page.text("#verified"));
    page.click(page.$("#switch")); await page.settle(); await page.settle();
    const sw = calls(W, "wallet_switchEthereumChain");
    t.ok(pre && sw.length === 1 && sw[0].params[0].chainId === "0x1" && W.count("wallet_addEthereumChain") === 0, "the wrong chain is refused before any read, and offers the move", `calls ${ethCalls(W).length} chain ${page.$("body").dataset.chain} sw ${sw.length} verified "${page.text("#verified")}"`);
    t.ok(callsWith(W, hub, sel("rightsOf(uint256,address)")).length >= 1 && page.$("body").dataset.chain === "ok" && page.$$("#lanes a").length > 0 && page.$$("#lanes a").every((a) => a.getAttribute("aria-disabled") !== "true"),
      "chainChanged recomputes", `rights calls ${callsWith(W, hub, sel("rightsOf(uint256,address)")).length} chain ${page.$("body").dataset.chain}`);
    /* review, round two: the resolved wallet_switchEthereumChain refreshed again after the chainChanged event
       had — every read twice. One eth_chainId at boot, one from the event, one rightsOf, one eth_accounts.
       Once, for a wallet that emits chainChanged before its request resolves (the shim's order); a wallet that
       resolves first and emits on a later tick re-reads eth_chainId once more, by design — the resolved request
       is the only refresh for a wallet that switched without saying so (round three, info) */
    t.ok(W.count("eth_chainId") === 2 && callsWith(W, hub, sel("rightsOf(uint256,address)")).length === 1 && W.count("eth_accounts") === 1,
      "a successful #switch refreshes every read once", `eth_chainId ${W.count("eth_chainId")} rightsOf ${callsWith(W, hub, sel("rightsOf(uint256,address)")).length} eth_accounts ${W.count("eth_accounts")}`);
    const r0 = page.$("body").dataset.rights;
    W.setAccounts([renter.from.toString()]); await page.settle(); await page.settle();
    const rc = callsWith(W, hub, sel("rightsOf(uint256,address)"));
    const lastArg = rc.length ? "0x" + rc[rc.length - 1].params[0].data.slice(10 + 64 + 24, 10 + 128) : "";
    t.ok(r0 === "1" && page.$("body").dataset.rights === "4" && lastArg === renter.from.toString().toLowerCase(), "accountsChanged recomputes", `${r0} → ${page.$("body").dataset.rights} actor ${lastArg}`);
    /* CONSOLE §3, §6.1: the bit that is not HOLD gets its sentence on Home — the renter's is the user's, with the date */
    t.ok(/^you are the user until \d{4}-\d\d-\d\d \d\d:\d\d UTC$/.test(page.text("#rights-sentence")), "the renter reads 'you are the user until <date>' on Home", page.text("#rights-sentence"));
    void vctx;
    page.close();
  }
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    await lane(page, "swap");
    const n = ethCalls(W).length;
    W.setChain(0x2105); await page.settle(); await page.settle();
    vctx.dispatchEvent(new vctx.CustomEvent("intact:lane", { detail: { name: "swap" } })); await page.settle();
    const msg = await t.refuses(() => vctx.INTACT.ui.read(hub, "hub.custodyEpoch", [1n]), /this token lives on Ethereum/, "a lane already open stops reading when the chain goes wrong (every read rejects with the chain sentence)");
    t.ok(ethCalls(W).length === n && page.$("body").dataset.chain === "wrong" && page.$("body").dataset.rights === "" && /this token lives on Ethereum/.test(msg || ""),
      "a lane already open stops reading when the chain goes wrong", `calls ${n} → ${ethCalls(W).length} chain ${page.$("body").dataset.chain} rights "${page.$("body").dataset.rights}"`);
    page.close();
  }
  {
    /* the gate is a property of the primitive, not of a pending promise: between chainChanged and the
       answer to the re-read, a read must already be refused. The shim's one-at-a-time queue would park
       the read behind the held eth_chainId and hide this; so the read is made while the hold is open
       and must reject on its own, before any queue is reached */
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    let release = null;
    W.override("eth_chainId", () => new Promise((r) => { release = r; }));
    const n = ethCalls(W).length;
    W.setChain(0x2105);
    const atOnce = page.$("body").dataset.chain === "wrong";
    const msg = await t.refuses(() => vctx.INTACT.ui.read(hub, "hub.custodyEpoch", [1n]), /your wallet is on Base; this token lives on Ethereum/, "a read parked between chainChanged and the re-read is refused by the gate, not answered by the new chain");
    if (release) release("0x2105"); await page.settle(); await page.settle();
    t.ok(atOnce && ethCalls(W).length === n && page.$("body").dataset.chain === "wrong" && /Base/.test(msg || ""), "the gate moved on the event itself, and the re-read only confirmed it", `atOnce ${atOnce} calls ${n} → ${ethCalls(W).length} chain ${page.$("body").dataset.chain}`);
    page.close();
  }
  {
    /* review, round two: rights() wrote after its await with no sequence check, so an older read could land
       after a newer one and publish a dropped account's bits. The shim's one-at-a-time queue cannot stage
       that (the second read waits behind the first), so the first rightsOf is held OUTSIDE the queue by
       replacing the provider's request for one call: the holder's read is held open, accountsChanged moves
       the page to the renter, the renter's read answers 4, then the holder's answer (1) is released — and
       must be thrown away */
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    const orig = W.provider.request; let hold = null;
    W.provider.request = (req) => (!hold && req.method === "eth_call" && String(req.params[0].data).toLowerCase().startsWith(sel("rightsOf(uint256,address)"))) ? new Promise((r) => { hold = r; }) : orig(req);
    W.setAccounts([ME]); await page.settle();
    W.provider.request = orig;
    const held = typeof hold === "function";
    W.setAccounts([renter.from.toString()]); await page.settle(); await page.settle();
    const mid = page.$("body").dataset.rights;
    if (held) hold(await c.read(hub, "rightsOf(uint256,address)", [1, ME]));
    await page.settle(); await page.settle();
    t.ok(held && mid === "4" && page.$("body").dataset.rights === "4" && vctx.INTACT.ui.rights() === 4 && vctx.INTACT.ui.account() === checksum(renter.from.toString(), kec),
      "only the latest rights read writes the body: an older read landing later is thrown away", `held ${held} ${mid} → ${page.$("body").dataset.rights} rights() ${vctx.INTACT.ui.rights()} account ${vctx.INTACT.ui.account()}`);
    page.close();
  }
  {
    /* review, round three: the sequence check sat after the await inside the try, so it guarded a stale read's
       SUCCESS only — a stale read that rejected after the newer one landed still printed "could not be read" over a
       read that had succeeded and fired intact:rights again; and a stale answer landing after chainChanged, before
       the pending refresh had reached rights() (its eth_chainId still in flight), wrote its bits under a wrong
       chain. Both stagings hold the holder's rightsOf outside the shim's queue, as above */
    const hold = (W, asAnswer) => { const orig = W.provider.request; let h = null; W.provider.request = (req) => (!h && req.method === "eth_call" && String(req.params[0].data).toLowerCase().startsWith(sel("rightsOf(uint256,address)"))) ? new Promise((res, rej) => { h = asAnswer ? res : rej; }) : orig(req); return () => { W.provider.request = orig; return h; }; };
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    let release = hold(W, false); W.setAccounts([ME]); await page.settle(); const rej = release();
    W.setAccounts([renter.from.toString()]); await page.settle(); await page.settle();
    const fired = []; vctx.addEventListener("intact:rights", (e) => fired.push({ bits: e.detail.bits, chain: page.$("body").dataset.chain }));
    const tick0 = page.text("#tick"), mid = page.$("body").dataset.rights;
    if (rej) rej(Object.assign(new Error("boom"), { code: -32000 }));
    await page.settle(); await page.settle();
    const rejectionIgnored = typeof rej === "function" && mid === "4" && page.text("#tick") === tick0 && fired.length === 0 && page.$("body").dataset.rights === "4" && vctx.INTACT.ui.rights() === 4;
    const d1 = `rejection: held ${typeof rej === "function"} body ${mid} → ${page.$("body").dataset.rights} tick "${tick0}" → "${page.text("#tick")}" fired ${JSON.stringify(fired)}`;
    release = hold(W, true); W.setAccounts([ME]); await page.settle(); const res = release();
    let relChain = null; W.override("eth_chainId", () => new Promise((r) => { relChain = r; }));
    W.setChain(0x2105);
    const wrongNow = page.$("body").dataset.chain === "wrong" && vctx.INTACT.ui.rights() === null;
    if (res) res(await c.read(hub, "rightsOf(uint256,address)", [1, ME]));
    await page.settle(); await page.settle();
    const during = { rights: vctx.INTACT.ui.rights(), fired: fired.length, chain: page.$("body").dataset.chain };
    if (relChain) relChain("0x2105"); await page.settle(); await page.settle();
    t.ok(rejectionIgnored && typeof res === "function" && wrongNow && during.rights === null && during.fired === 0 && page.$("body").dataset.rights === "" && page.$("body").dataset.chain === "wrong",
      "a stale rights read is thrown away whether it answers or rejects, and an answer landing on a wrong chain writes nothing", `${d1}; chain: held ${typeof res === "function"} wrongNow ${wrongNow} during ${JSON.stringify(during)} after rights "${page.$("body").dataset.rights}" chain ${page.$("body").dataset.chain} fired ${JSON.stringify(fired)}`);
    page.close();
  }
  {
    const W = walletFor(c, me);
    W.answer(hub, sel("rightsOf(uint256,address)"), () => { throw Object.assign(new Error("boom"), { code: -32000 }); });
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    for (const n of Object.keys(vctx.INTACT.panels)) await lane(page, n);
    t.ok(page.$("body").dataset.rights === "" && vctx.INTACT.ui.rights() === null && /your rights could not be read at block \d+/.test(page.text("#tick")) && page.$$("[data-act]").length === 0,
      "rights that could not be read are not zero", `rights "${page.$("body").dataset.rights}" tick "${page.text("#tick")}" acts ${page.$$("[data-act]").length}`);
    page.close();
  }

  /*═══════════ R · the collection page and the mint flow ═══════════*/
  t.head("R · the collection page / and the mint flow");
  {
    const W = walletFor(c, buyer);
    const { page, ctx: vctx, S } = await bootPage("/", { wallet: W });
    t.ok(page.$("body").dataset.mode === "console" && vctx.INTACT.id === 0, "the collection document boots as the console");
    const fmt = (wei) => { const w = BigInt(wei); const whole = w / WAD, frac = (w % WAD).toString().padStart(18, "0").slice(0, 6).replace(/0+$/, ""); return whole + (frac ? "." + frac : ""); };
    t.ok(page.text("#facts [data-fact=minted]") === String(S.minted) && page.text("#facts [data-fact=price]") === fmt(S.price) + " ETH" && !page.$("[data-fact=holder]") && !page.$("[data-fact=epoch]"),
      "Home shows the collection, not a token", `${page.text("#facts [data-fact=minted]")} ${page.text("#facts [data-fact=price]")}`);
    const openIds = await c.read(site.pool, "openIds(uint256,uint256)", [0, 48]);
    t.ok(page.$$("#directory .market").length === S.open.length && S.open.length === Number(decUint(openIds, 1)), "the directory lists the open markets", `${page.$$("#directory .market").length} ${S.open.length}`);
    t.ok(page.$$("#recent .coin").length === S.recent.length, "the recent coins are the Kiln's");
    t.ok(new RegExp(S.commons.count + " said").test(page.text("#commons")), "the commons head is a fact", page.text("#commons"));
    const before = ethCalls(W).length;
    page.click(page.$("#mint [data-act=mint]")); await page.until(() => page.$("#cbox").classList.contains("on") && !page.$("[data-go]").disabled, 50);
    const price = decUint(await c.read(hub, "price()"));
    const priceCall = callsWith(W, hub, sel("price()"));
    t.ok(priceCall.length >= 1 && page.$("#cbox").classList.contains("on") && page.$("[data-value]").dataset.wei === String(price) && page.text("[data-function]") === "mint(address)" && page.text("[data-arg=\"0\"]") === checksum(buyer.from.toString(), kec),
      "the mint re-reads the price and proposes exactly it", `calls ${priceCall.length} wei ${page.$("[data-value]") && page.$("[data-value]").dataset.wei} fn ${page.text("[data-function]")} arg0 ${page.text("[data-arg=\"0\"]")}`);
    void before;
    page.click(page.$("[data-go]")); await page.until(() => W.sent() === 1, 50); await page.settle(); await page.settle();
    t.ok(callsWith(W, hub, sel("custodyEpoch(uint256)")).length === 0 && W.sent() === 1, "no epoch is re-read on a page with no token");
    const receipt = [...W.receipts.values()][0];
    const log = receipt && receipt.logs.find((l) => l.topics[0] === S.topics.transfer && BigInt(l.topics[1]) === 0n);
    const newId = log ? BigInt(log.topics[3]) : 0n;
    const owner = newId ? decAddr(await c.read(hub, "ownerOf(uint256)", [newId])) : "";
    t.ok(newId === 4n && owner.toLowerCase() === buyer.from.toString().toLowerCase(), "the receipt's Transfer log names the new id", `id ${newId} owner ${owner}`);
    t.ok(page.navigations[0] === "/token/" + newId + "/live", "and the page navigates there", page.navigations.join(","));
    t.ok(calls(W, "eth_getCode").some((x) => String(x.params[0]).toLowerCase() === buyer.from.toString().toLowerCase()), "the 7702 delegate check runs for a minter too");
    page.close();
  }
  {
    const prefix = "/0x" + PREM.slice(2) + ":1";
    const W = walletFor(c, buyer);
    const { page } = await bootPage(prefix + "/token/1/live", { wallet: W });
    const loaded = await lane(page, "swap");
    const fetched = page.fetches[0] && page.fetches[0].url;
    page.close();
    const { page: p2 } = await bootPage(prefix + "/", { wallet: walletFor(c, buyer) });
    p2.click(p2.$("#mint [data-act=mint]")); await p2.until(() => p2.$("#cbox").classList.contains("on") && !p2.$("[data-go]").disabled, 50);
    p2.click(p2.$("[data-go]")); await p2.until(() => p2.navigations.length > 0, 50);
    const nav = p2.navigations[0];
    p2.close();
    t.ok(loaded && fetched === prefix + "/panel/swap.js" && /^\/0x[0-9a-f]{40}:1\/token\/5\/live$/.test(nav || "") && nav.startsWith(prefix), "paths resolve from the document's base, not the root",
      `fetched ${fetched} nav ${nav}`);
  }

  /*═══════════ Z · session mode ═══════════*/
  t.head("Z · session mode ?as=");
  {
    const KEY = agentW.from.toString();
    const W = walletFor(c, me, { accounts: [] });
    const { page, ctx: vctx, S } = await bootToken(1, { query: "?as=" + KEY, wallet: W });
    t.eq(page.$("body").dataset.mode, "session", "the door opens session mode");
    const st = page.text("#session");
    t.ok(/acts as key 0x/.test(st) && /for #1\D/.test(st), "Home names the key and the token", st.slice(0, 120));
    t.ok(callsWith(W, S.reach, sel("sessionOf(address)")).length >= 1 && /expires/.test(st) && /cap/.test(st) && callsWith(W, S.reach, sel("sessionExposure(address)")).length >= 1, "the key's grant is read in words", st.slice(0, 200));
    t.eq(page.$("body").dataset.rights, "128", "the SESSION bit is the key's");
    for (const n of Object.keys(vctx.INTACT.panels)) await lane(page, n);
    t.ok(page.$$("[data-act]").length === 0 && page.$$("[data-go]").length === 0, "every holder control is hidden");
    t.ok(/no executeAsSession composer until U17/.test(page.text("#lane-agent")), "the agent lane says what is missing (part 1: the §11 sentence, verbatim)", page.text("#lane-agent").slice(0, 160));
    page.close();
    const { page: p6 } = await bootToken(1, { query: "?as=" + KEY, wallet: walletFor(c, me) });
    t.ok(/connected wallet is 0x/.test(p6.text("#session")) && p6.$("body").dataset.rights === "", "a wallet that is not the key is refused", `${p6.text("#session").slice(0, 160)} rights "${p6.$("body").dataset.rights}"`);
    p6.close();
    const W7 = walletFor(c, agentW);
    const { page: p7, ctx: v7 } = await bootToken(1, { query: "?as=" + KEY, wallet: W7 });
    t.ok(!/connected wallet is 0x/.test(p7.text("#session")) && p7.$("body").dataset.rights === "128", "the key's wallet is accepted", p7.$("body").dataset.rights);
    /* CONSOLE §1, §11: session mode never writes — not even a propose whose need is the SESSION bit the key holds */
    await v7.INTACT.ui.propose({ to: site.pool, data: enc(SWAP_IN, [1n, true, 1n, 0n, KEY, 0n]), sig: SWAP_IN, need: 128, lines: [], sentence: "x" }); await p7.settle();
    t.ok(!p7.$("#cbox").classList.contains("on") && p7.$$("[data-go]").length === 0 && W7.count("eth_estimateGas") === 0 && W7.sent() === 0 && /a session speaks only through the Reach; this page acts as key 0x/.test(p7.text("#tick")),
      "propose refuses in session mode even for the SESSION bit the key holds", `slab ${p7.$("#cbox").classList.contains("on")} estimates ${W7.count("eth_estimateGas")} tick "${p7.text("#tick")}"`);
    p7.close();
    const { page: p8 } = await bootToken(1, { query: "?as=xyz", wallet: walletFor(c, me) });
    t.eq(p8.$("body").dataset.mode, "console", "the agent lane says what is missing (part 2: a malformed ?as= boots as the console)");
    p8.close();
    const { page: p9, ctx: v9 } = await bootToken(1, { query: "?as=" + ME, wallet: walletFor(c, me) });
    for (const n of Object.keys(v9.INTACT.panels)) await lane(p9, n);
    t.ok(p9.$("body").dataset.rights === "0" && v9.INTACT.ui.rights() === 0 && p9.$$("#social-composer textarea").length === 0 && p9.$$("[data-act]").length === 0,
      "the holder's own address as a key is only a key", `rights "${p9.$("body").dataset.rights}"`);
    p9.close();
  }

  /*═══════════ Q · the QR ═══════════*/
  t.head("Q · the QR");
  {
    const { page } = await bootToken(1, { opaque: true });
    const svg = page.$("#qr svg");
    const rects = page.$$("#qr svg rect");
    const N = 37, map = new Uint8Array(N * N);
    let inRange = true;
    for (const r of rects) { const x = Number(r.getAttribute("x")) - 4, y = Number(r.getAttribute("y")) - 4; if (x < 0 || y < 0 || x >= N || y >= N) inRange = false; else map[y * N + x] = 1; }
    const at = (x, y) => map[y * N + x];
    t.ok(svg.getAttribute("viewBox") === "0 0 45 45" && inRange, "the code is version 5 with its quiet zone");
    const finder = (ox, oy) => { for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) { const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3)); if (at(ox + dx, oy + dy) !== (d === 3 || d <= 1 ? 1 : 0)) return false; } return true; };
    const sepLight = [...Array(8)].every((_, i) => at(7, i) === 0 && at(i, 7) === 0 && at(29, i) === 0 && at(29 + i, 7) === 0 && at(7, 29 + i) === 0 && at(i, 29) === 0);
    t.ok(finder(0, 0) && finder(30, 0) && finder(0, 30) && sepLight, "three finders where the standard puts them");
    let timing = true; for (let i = 8; i <= 28; i++) { const want = i % 2 === 0 ? 1 : 0; if (at(i, 6) !== want || at(6, i) !== want) timing = false; }
    t.ok(timing, "the timing patterns alternate");
    t.ok(at(8, 29) === 1, "the dark module is dark");
    let align = true; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); if (at(30 + dx, 30 + dy) !== (d === 1 ? 0 : 1)) align = false; }
    t.ok(align, "the alignment pattern sits at (30,30)");
    /* the format bits, read back along the spec's two copies (bit 0 = LSB) */
    let f1 = 0, f2 = 0;
    for (let i = 0; i <= 5; i++) f1 |= at(8, i) << i; f1 |= at(8, 7) << 6; f1 |= at(8, 8) << 7; f1 |= at(7, 8) << 8; for (let i = 9; i < 15; i++) f1 |= at(14 - i, 8) << i;
    for (let i = 0; i < 8; i++) f2 |= at(N - 1 - i, 8) << i; for (let i = 8; i < 15; i++) f2 |= at(8, N - 15 + i) << i;
    t.ok(f1 === 0x77c4 && f2 === f1, "the format bits are a valid BCH word for L and mask 0", `0x${f1.toString(16)} 0x${f2.toString(16)}`);
    const mapHash = kec(Buffer.from(map));
    /* recorded on the first green run (2026-10-09) for the harness Premises 0xcbd1…c7ce on chain 1 and
       token #1; the map is a function of the payload, so another deployment pins another number */
    const PIN = "0x4bf26fe9fb8b081f4ef99dbcec98e6453d42144a4a8acb88b447dae6974afa5e";
    t.ok(mapHash === PIN, `the module map's keccak is pinned (${mapHash})`, "want " + PIN);
    /* an independent decoder: the map rasterised at 4 px per module, including the quiet zone */
    let decoded = null, how = "";
    try {
      const jsQR = (await import("jsqr")).default;
      const px = 4, side = 45 * px, img = new Uint8ClampedArray(side * side * 4);
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
        const mx = Math.floor(x / px) - 4, my = Math.floor(y / px) - 4;
        const dark = mx >= 0 && my >= 0 && mx < N && my < N && at(mx, my);
        const o = (y * side + x) * 4; img[o] = img[o + 1] = img[o + 2] = dark ? 0 : 255; img[o + 3] = 255;
      }
      const r = jsQR(img, side, side);
      decoded = r && r.data; how = "jsqr";
    } catch (e) {
      /* no jsqr: read the codewords back after unmasking and recompute the RS parity ourselves */
      how = "rs-recompute";
      const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
      for (let i = 0, x = 1; i < 255; i++) { EXP[i] = EXP[i + 255] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
      const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
      let gen = [1]; for (let i = 0; i < 26; i++) { const g = Array(gen.length + 1).fill(0); gen.forEach((cf, j) => { g[j] ^= cf; g[j + 1] ^= mul(cf, EXP[i]); }); gen = g; }
      const FX = new Uint8Array(N * N); const mark = (x, y) => { if (x >= 0 && y >= 0 && x < N && y < N) FX[y * N + x] = 1; };
      for (const [cx, cy] of [[3, 3], [N - 4, 3], [3, N - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
      for (let i = 0; i < 9; i++) { mark(i, 8); mark(8, i); if (i < 8) mark(N - 1 - i, 8); if (i < 7) mark(8, N - 1 - i); }
      for (let i = 8; i < N - 8; i++) { mark(i, 6); mark(6, i); }
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(N - 7 + dx, N - 7 + dy);
      mark(8, N - 8);
      const bits = [];
      for (let right = N - 1, k = 0; right >= 1; right -= 2, k++) { if (right === 6) right = 5; for (let i = 0; i < N; i++) { const y = k & 1 ? i : N - 1 - i; for (const x of [right, right - 1]) if (!FX[y * N + x]) bits.push(at(x, y) ^ (((x + y) & 1) ? 0 : 1)); } }
      const cw = []; for (let i = 0; i + 8 <= 1072; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(""), 2));
      const data = cw.slice(0, 108), ec = Array(26).fill(0);
      for (const cf of data) { const f = cf ^ ec.shift(); ec.push(0); if (f) for (let j = 0; j < 26; j++) ec[j] ^= mul(gen[j + 1], f); }
      const rsOk = ec.every((v, i) => v === cw[108 + i]);
      const len = (data[0] & 15) << 4 | data[1] >> 4; let text = "";
      for (let i = 0; i < len; i++) text += String.fromCharCode(((data[1 + i] & 15) << 4) | (data[2 + i] >> 4));
      decoded = rsOk ? text : null;
    }
    t.ok(decoded === WEB3, `an independent decoder reads the link back (${how})`, decoded);
    page.close();
  }

  /*═══════════ V · the self-hash footer ═══════════*/
  t.head("V · the self-hash footer");
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx, S } = await bootToken(1, { wallet: W });
    t.ok(page.$docAtClose === page.written && page.written.length > 1000, "the loader left the inflated bytes on the state object");
    t.ok(!("$doc" in vctx.INTACT), "and the shell took them off again");
    const eh = callsWith(W, S.engine, sel("engineHash()"));
    const bn = BigInt(EVM.BLOCK.header.number);
    const re = new RegExp("engine " + short(checksum(S.engine, kec)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " pins these bytes at block (\\d+)");
    const m = page.text("#verified").match(re);
    t.ok(eh.length === 1 && !!m && BigInt(m[1]) === bn && W.calls.indexOf(eh[0]) > W.firstIndex("eth_chainId") && callsWith(W, S.premises, sel("ENGINE()")).length === 0,
      "the console verifies against the chain, and names the engine", `"${page.text("#verified")}" engineHash calls ${eh.length}`);
    page.close();
    const { page: pv } = await bootToken(1, { opaque: true });
    t.ok(/self-consistent; chain not reachable to verify/.test(pv.text("#verified")), "the viewer without a provider is only self-consistent", pv.text("#verified"));
    pv.close();
    const W5 = walletFor(c, me);
    W5.answer(S.engine, sel("engineHash()"), () => "0x" + "00".repeat(32));
    const { page: p5 } = await bootToken(1, { wallet: W5 });
    t.ok(/does not match the engine hash/.test(p5.text("#verified")) && p5.$("#verified").classList.contains("bad"), "a chain that names another hash is told so in red", p5.text("#verified"));
    p5.close();
    /* a loader altered to keep no bytes is a tampered loader: red, the §8 sentence, not a shrug */
    const { boot } = await import("../dom-shim.mjs");
    const noDoc = await boot(live1.body.replace("window.INTACT.$doc=t;", ""), { opaque: true });
    t.ok(/does not match the engine hash/.test(noDoc.text("#verified")) && noDoc.$("#verified").classList.contains("bad") && /kept no bytes/.test(noDoc.text("#verified")),
      "a loader that kept no bytes to verify is told so in red", noDoc.text("#verified"));
    noDoc.close();
    const prefix = "/0x" + PREM.slice(2) + ":1";
    const W6 = walletFor(c, me);
    const { page: p6 } = await bootPage(prefix + "/token/1/live", { wallet: W6 });
    const en = callsWith(W6, S.premises, sel("ENGINE()")), eh6 = callsWith(W6, S.engine, sel("engineHash()"));
    const green = re.test(p6.text("#verified"));
    p6.close();
    const W6b = walletFor(c, me);
    W6b.answer(S.premises, sel("ENGINE()"), () => "0x" + "00".repeat(12) + "dead".repeat(10));
    const { page: p6b } = await bootPage(prefix + "/token/1/live", { wallet: W6b });
    t.ok(en.length === 1 && eh6.length === 1 && W6.calls.indexOf(en[0]) < W6.calls.indexOf(eh6[0]) && green &&
      /this document names a different Premises than the address you opened/.test(p6b.text("#verified")) && p6b.$("#verified").classList.contains("bad") && callsWith(W6b, S.engine, sel("engineHash()")).length === 0,
      "the address you opened anchors the sentence", `ENGINE ${en.length} engineHash ${eh6.length} green ${green} / "${p6b.text("#verified")}"`);
    p6b.close();
    const W7 = walletFor(c, me);
    const { page: p7 } = await bootPage("/0x" + "ab".repeat(20) + ":1/token/1/live", { wallet: W7 });
    t.ok(/this document names a different Premises than the address you opened/.test(p7.text("#verified")) && callsWith(W7, S.premises, sel("ENGINE()")).length === 0 && callsWith(W7, S.engine, sel("engineHash()")).length === 0,
      "a document that names another Premises is told so (and at /token/1/live the plain green sentence printed after engineHash() alone)", p7.text("#verified"));
    p7.close();
  }

  /*═══════════ E′ · the chips ═══════════*/
  t.head("E′ · the chips on Home");
  {
    const { page, S } = await bootToken(1, { opaque: true });
    t.ok(S.router === ZERO && (S.reported & S.bits.router) === 0 && (S.absent & S.bits.router) !== 0, "the state says absent, not zero");
    const rc = page.$("#chips .chip[data-bit=router]");
    t.ok(rc && rc.textContent === "router: not deployed on this chain" && rc.dataset.state === "absent", "the router chip reads not deployed", rc && rc.textContent);
    t.ok(!!page.$("#chips .chip[data-bit=pool][data-state=reported]") && page.text("#facts [data-fact=market]") === "closed" && S.ownedMarket.open === false, "a reported zero is a zero", page.text("#facts [data-fact=market]"));
    const clear = page.$$("#chips .chip").filter((ch) => ch.dataset.state !== "reported");
    const noZero = clear.every((ch) => !/:\s*0\b/.test(ch.textContent));
    page.close();
    /* site2: a Router address that holds code which does not answer the probe */
    const c2 = await ctx.Chain.open();
    const brk = await c2.deploy(ctx.A("test/mocks/Breakable.sol", "Breakable").bytecode, "", "Breakable");
    const site2 = await ctx.deploySite(c2, ctx.out, { router: brk });
    await mint(c2, site2, c2.from.toString());
    const live2 = await ctx.getter(c2, site2.premises)(["token", "1", "live"]);
    const S2 = stateOfHtml(live2.body).obj;
    const { boot } = await import("../dom-shim.mjs");
    const p2 = await boot(live2.body, { opaque: true });
    const rc2 = p2.$("#chips .chip[data-bit=router]");
    t.ok(noZero && clear.length >= 4 && rc2 && rc2.textContent === "router: could not be read at block " + S2.block && rc2.dataset.state === "unread",
      "no clear bit is ever printed as 0", `clear ${clear.length} site2 "${rc2 && rc2.textContent}" state ${rc2 && rc2.dataset.state}`);
    p2.close();
  }

  /*═══════════ O · escaping, the shell's half ═══════════*/
  t.head("O · escaping (the shell's half)");
  {
    const nameWord = "0x" + Buffer.from("</script>x", "utf8").toString("hex").padEnd(64, "0");
    await c.exec(hub, "setTrait(uint256,bytes32,bytes32)", [1, kec(Buffer.from("name", "utf8")), nameWord], { label: "setTrait" });
    const live = await GET(["token", "1", "live"]);
    const st = stateOfHtml(live.body);
    const { page } = await bootToken(1, { opaque: true });
    const el = page.$("#facts [data-fact=name]");
    t.ok(el && el.textContent === "</script>x" && el.children.length === 0, "the name trait is text on Home", el && el.textContent);
    let parses = false; try { JSON.parse(st.text); parses = true; } catch {}
    t.ok(parses && !st.text.includes("</script>") && st.obj.name === "</script>x", "the state block still parses with all of it inside");
    t.ok(page.innerHTMLWrites === 0, "innerHTML was never assigned");
    page.close();
  }

  /*═══════════ P · the loader itself ═══════════*/
  t.head("P · the loader itself");
  {
    const { page, ctx: vctx } = await bootToken(1, { opaque: true });
    t.ok(page.written === DIST, "document.write received the shell");
    t.ok(vctx.INTACT.__pin === 1 && vctx.INTACT.id === 1, "the state object is the one the gap wrote");
    t.ok(vctx.$INTACT === undefined && !("$INTACT" in vctx), "the payload property was deleted");
    const first = (DIST.match(/<script>const (\w+)=/) || [])[1];
    let threw = null; try { vm.runInContext("const " + first + "=0", vctx); } catch (e) { threw = e; }
    t.ok(!!first && !!threw && threw.name === "SyntaxError", "the shim reproduces the collision the loader rule guards against", first + " → " + (threw && threw.message));
    page.close();
    const { boot } = await import("../dom-shim.mjs");
    const m = live1.body.match(/self\.\$INTACT="([A-Za-z0-9+/=]+)";/);
    const i = Math.floor(m[1].length / 2);
    const bad = live1.body.replace(m[1], m[1].slice(0, i) + (m[1][i] === "A" ? "B" : "A") + m[1].slice(i + 1));
    const pb = await boot(bad, { opaque: true, awaitReady: false });
    await pb.settle(); await pb.settle();
    t.ok(pb.ctx.document.body.textContent.startsWith("INTACT could not inflate itself in this browser."), "a corrupted payload fails in words, not silence", pb.ctx.document.body.textContent.slice(0, 80));
    pb.close();
  }

  /*═══════════ G′ · the slab's generic rules ═══════════*/
  t.head("G′ · the slab's generic rules, through the harness");
  {
    const W = walletFor(c, me);
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    const ui = vctx.INTACT.ui;
    const tick = () => page.text("#tick");
    const slabOpen = () => page.$("#cbox").classList.contains("on");
    /* CONSOLE §5: the low-level coder's shapes — a bytes/string without the offset word (the panel
       places it), every bytesN left-aligned, a word from a BigInt or hex */
    t.ok(ui.enc.bytes("0x0102") === "0".repeat(63) + "2" + "0102".padEnd(64, "0") && ui.enc.str("ab") === "0".repeat(63) + "2" + "6162".padEnd(64, "0") &&
      ui.enc.B32("0xab") === "ab".padEnd(64, "0") && ui.enc.B4("0xa9059cbb") === "a9059cbb".padEnd(64, "0") && ui.enc.W(255n) === ui.enc.W("0xff") && ui.enc.W(255n).endsWith("00ff"),
      "enc.bytes and enc.str carry no offset word, and every bytesN is left-aligned", `${ui.enc.bytes("0x0102").slice(0, 80)}… ${ui.enc.B32("0xab").slice(0, 8)}`);
    /* CONSOLE §2: with no provider at all, Home says so — in words, on #rights-sentence */
    {
      const { page: pn } = await bootToken(1, {});
      t.ok(pn.$("body").dataset.chain === "none" && pn.text("#rights-sentence") === "no wallet in this browser; everything above is still true" && pn.$$("[data-act]").length === 0,
        "no wallet in this browser: Home says so and offers nothing", `${pn.$("body").dataset.chain} "${pn.text("#rights-sentence")}"`);
      pn.close();
    }
    /* CONSOLE §4: the promise never rejects, and a slab that failed half-built leaves nothing under the next one */
    {
      let rejected = false;
      await ui.propose({ to: "nope", key: "erc20.approve", args: [site.pool, 1n], lines: [["Lets", "STALE"]], sentence: "x" }).catch(() => { rejected = true; }); await page.settle();
      const clean = !rejected && !slabOpen() && page.$("#cslab").childNodes.length === 0 && /a panel bug/.test(tick());
      await Promise.race([ui.propose({ to: weth, key: "erc20.approve", args: [site.pool, 1n], sentence: "x" }), page.until(() => slabOpen(), 50)]);
      const firstRow = page.$("#cslab .kv .k");
      const own = slabOpen() && firstRow && firstRow.textContent === "To" && !/STALE/.test(page.text("#cslab"));
      /* the belt on Sign: a disabled button is inert in the shim (a browser fires nothing) and in the shell
         (send() returns before the wallet is asked), so a click event on it sends nothing */
      await page.until(() => !page.$("[data-go]").disabled, 50);
      page.$("[data-go]").disabled = true;
      const pressed = page.click(page.$("[data-go]"));
      page.$("[data-go]").dispatchEvent(new vctx.Event("click", { bubbles: true })); await page.settle();
      page.click(page.$("[data-no]")); await page.settle();
      t.ok(clean && own && pressed === false && W.sent() === 0 && !slabOpen(), "a bad destination resolves without a slab, leaves nothing behind, and a disabled Sign sends nothing",
        `rejected ${rejected} slab ${slabOpen()} rows ${page.$("#cslab").childNodes.length} first "${firstRow && firstRow.textContent}" pressed ${pressed} sent ${W.sent()} tick "${tick()}"`);
    }
    await ui.propose({ to: weth, key: "erc20.approve", args: [site.pool, 1n << 255n], sentence: "x" }); await page.settle();
    t.ok(!slabOpen() && /unlimited approvals are never built here/.test(tick()), "an approve of 2^255 or more never becomes a slab", tick());
    await ui.propose({ to: weth, key: "erc20.approve", args: [site.pool, 1n] }); await page.settle();
    t.ok(!slabOpen() && /sentence/.test(tick()), "a write without a sentence is refused as a panel bug", tick());
    const prompts0 = W.prompts().length;
    const refused = [];
    for (const m of ["eth_sendTransaction", "personal_sign", "eth_signTypedData_v4", "wallet_switchEthereumChain", "eth_requestAccounts"]) {
      try { await ui.request(m, [{}]); refused.push(false); } catch (e) { refused.push(/a panel cannot send; propose it/.test(e.message)); }
    }
    let bn = null; try { bn = await ui.request("eth_blockNumber", []); } catch {}
    t.ok(!("$lib" in vctx.INTACT) && vctx.INTACT.lib === undefined && refused.every(Boolean) && W.sent() === 0 && W.prompts().length === prompts0 && typeof bn === "string",
      "no panel can reach a provider", `refused ${refused.join(",")} bn ${bn}`);
    const MAX = BigInt("0x" + "ff".repeat(32));   // spelled so the static audit's mask rule stays a rule
    const approve = enc("approve(address,uint256)", [site.pool, MAX]);
    const inner = [weth, 0n, approve];
    const viaExec = enc(EXEC, [weth, 0n, approve, 0]);
    const viaBatch = enc(BATCH, [[[weth, 0n, enc("approve(address,uint256)", [site.pool, 1n])], inner]]);
    const viaTyped = enc(TYPED, [[weth, 0n, approve, [], [], 0n]]);
    const results = [];
    for (const [data, sig] of [[viaExec, EXEC], [viaBatch, BATCH], [viaTyped, TYPED]]) {
      await ui.propose({ to: vctx.INTACT.reach, data, sig, lines: [["Does", "a thing"]], sentence: "x" }); await page.settle();
      results.push(!slabOpen() && /unlimited approvals are never built here/.test(tick()));
    }
    t.ok(results.every(Boolean), "an unlimited approve hidden in a Reach call is still refused", results.join(","));
    await ui.propose({ to: weth, data: approve, sig: "transfer(address,uint256)", lines: [], sentence: "x" }); await page.settle();
    const r1 = !slabOpen() && /the signature does not name these bytes/.test(tick());
    await ui.propose({ to: weth, key: "erc20.transfer", args: [site.pool, 1n], sentence: "x" }); await page.settle();
    const r2 = !slabOpen() && /erc20\.transfer: not declared by this panel/.test(tick());
    t.ok(r1 && r2, "a signature that does not name the bytes is a panel bug", tick());
    t.ok(page.innerHTMLWrites === 0 && page.errors.length === 0, "nothing was assigned through innerHTML, by anybody, all run — and no script threw (end of the boot group)", page.errors.map((e) => e.message).join("; "));
    page.close();
  }
}
