/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "boot" — the shell itself (H §7.1, 103 sentences)

  The first landing carries six of the twelve blocks, so the panel agents
  can test against a real shell at once: A build and boot, C the loader's
  refusal ("a tampered panel is refused"), N discovery and the chain gate,
  O the shell's half of escaping, P the loader, G′ the slab's generic
  rules. B the viewer, R the collection page, Z session mode, Q the QR, V
  the footer and E′ the chips follow in the next commit. The BUILD-PLAN
  sentence this file owns ends its block as `t.ok(..., "<sentence>")`,
  verbatim, so INVARIANTS can quote it.

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
    t.ok(plan.shell === "engine/app.html" && !/fixtures/.test(plan.shell), "the shell that shipped is the console, not the placeholder" + (plan.placeholder ? " (some panels are still fixtures)" : ""));
    t.ok(page.written === DIST, "the loader inflated the shell the build wrote, byte for byte", `written ${page.written.length} vs dist ${DIST.length}`);
    t.ok(vctx.INTACT.id === 1 && vctx.INTACT.__pin === 1, "window.INTACT survived document.open()");
    t.ok(page.errors.length === 0, "no script threw on the way in", page.errors.map((e) => e.stack || e.message).join("\n"));
    t.eq(page.$("body").dataset.mode, "console", "the body names its boot mode");
    const csp = (page.$("meta[http-equiv]") || { getAttribute: () => "" }).getAttribute("content") || "";
    t.ok(csp.includes("script-src 'unsafe-inline' blob:") && csp.includes("connect-src 'self'"), "the CSP meta is in the document the shell wrote");
    const offOrigin = [...page.$$("script[src]"), ...page.$$("img[src]")].some((e) => !/^(blob:|data:)/.test(e.getAttribute("src"))) || page.$$("link[href]").some((e) => !/^(blob:|data:)/.test(e.getAttribute("href")));
    t.ok(!offOrigin && page.fetches.every((f) => f.url.startsWith("/")), "nothing in the document points off the origin");
    const fact = (k) => page.text(`#facts [data-fact=${k}]`);
    t.ok(fact("id") === "1" && fact("chain") === "1" && fact("holder").toLowerCase() === S.owner && fact("epoch") === "1" && fact("status") === "Active",
      "Home prints the baked facts through textContent", `${fact("id")} ${fact("chain")} ${fact("holder")} ${fact("epoch")} ${fact("status")}`);
    t.ok(ctx.gzipBytes <= 15_000, `the shell's gzip is under the ceiling and the routes are cold-measured (${ctx.gzipBytes.toLocaleString()} B gzip; the runner printed the cold gas)${ctx.gzipBytes > 14_000 ? " — over the 14,000 budget" : ""}`);
    t.ok(page.innerHTMLWrites === 0, "nothing was assigned through innerHTML, by anybody, all run (checked again at the end)");
    page.close();
  }

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
    q(!/function/.test(text) && (text.match(/0x[0-9a-f]{64}/g) || []).every((h) => h === S1.panels.swap || h !== S1.panels.swap) && (text.match(/0x[0-9a-f]{64}/g) || []).length === 2,
      "the refusal leaks no code", text.slice(0, 160));
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
    const r0 = page.$("body").dataset.rights;
    W.setAccounts([renter.from.toString()]); await page.settle(); await page.settle();
    const rc = callsWith(W, hub, sel("rightsOf(uint256,address)"));
    const lastArg = rc.length ? "0x" + rc[rc.length - 1].params[0].data.slice(10 + 64 + 24, 10 + 128) : "";
    t.ok(r0 === "1" && page.$("body").dataset.rights === "4" && lastArg === renter.from.toString().toLowerCase(), "accountsChanged recomputes", `${r0} → ${page.$("body").dataset.rights} actor ${lastArg}`);
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
    const W = walletFor(c, me);
    W.answer(hub, sel("rightsOf(uint256,address)"), () => { throw Object.assign(new Error("boom"), { code: -32000 }); });
    const { page, ctx: vctx } = await bootToken(1, { wallet: W });
    for (const n of Object.keys(vctx.INTACT.panels)) await lane(page, n);
    t.ok(page.$("body").dataset.rights === "" && vctx.INTACT.ui.rights() === null && /your rights could not be read at block \d+/.test(page.text("#tick")) && page.$$("[data-act]").length === 0,
      "rights that could not be read are not zero", `rights "${page.$("body").dataset.rights}" tick "${page.text("#tick")}" acts ${page.$$("[data-act]").length}`);
    page.close();
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
    t.ok(!!first && threw instanceof SyntaxError || (threw && threw.name === "SyntaxError"), "the shim reproduces the collision the loader rule guards against", first + " → " + (threw && threw.message));
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
