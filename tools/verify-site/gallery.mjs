/*───────────────────────────────────────────────────────────────────────────
  INTACT · verify-site group "gallery" — any NFT, from the chain alone
  (docs/V2.md §2, §3.3; V2 wave 2, unit W8)

  The runner hands this group its default chain, which carries no V2
  contract: block K reads the chips there. Everything else runs on a chain
  of the group's own, deployed with every V2 contract (`deploySite(…, {
  v2: true, deployMarket: true })`: the Journal, the Keepsake, the Bazaar
  beside Seaport 1.6's probed runtime at its canonical address, Bridges,
  the Studio, Agora and the Market), where the Timelock first writes a 5 %
  royalty for the hub and the OpenSea door, seven days before the cast acts.

  Blocks: A an on-chain SVG token (INTACT #1, face 1) drawn, its frame lit
  by its own fills, its traits as chips; B the owners walked from Transfer
  logs, and a refused range said; C memories folded against rootOf, the
  constellation drawn, and a root that disagrees named; D a Studio mint
  (the spec shown before the signature, the price exactly, the link's via)
  and the minted token's own page in a sandboxed iframe; E a foreign
  MockERC721 whose metadata lives off chain, shown as a link only; F an
  INTACT listing sealed, approved, validated and published from the lane
  and bought by a second account, the royalty paid, the sale in its story;
  G a moved fingerprint refused in words; G2 (W17) a listing that outlives
  its Reach's seal, refused at its end; H a plain NFT listed and bought;
  I the INTACT Market's own listing bought; J "include OpenSea": the door
  printed beside a switch that stays off; K the chips on a band with no V2;
  L the viewer reads and offers nothing, the holder's own wallet included
  (W17); M the hygiene of the whole run.

  Elements this group reads from its panel (every selector scoped to
  #lane-gallery): #gallery-form (summary, input[name=collection|id]), #gallery-open,
  #gallery-frame[data-ambient], #gallery-art img|a.offchain, #gallery-site,
  #gallery-token, #gallery-name, #gallery-price, #gallery-what, #gallery-meta,
  #gallery-traits .trait,
  #gallery-listings .listing[data-hash] .state, #gallery-market,
  #gallery-market-offer, #gallery-sell input[name=price|days],
  #gallery-review, #gallery-steps .step[data-step][data-done], #gallery-mint,
  #gallery-spec, #gallery-via, #gallery-owners .owner, #gallery-archive,
  #gallery-constellation svg circle(.star), #gallery-memories .memory,
  #gallery-sales .sale, #gallery-opensea, #gallery-door,
  [data-act=buy|marketBuy|cancel|sealReach|sealMarket|approve|validate|
  publish|mint]. From the shell: the slab (#cbox.on, #cslab, [data-go],
  [data-no], [data-to], [data-value], [data-function], [data-calldata],
  [data-gas], [data-sentence]), #tick, body[data-mode].
───────────────────────────────────────────────────────────────────────────*/
import { SEAPORT, ITEM, KIND, PARAMS_T, ORDER_T, FLOORS_T, SIG, TOPIC, orderOf, componentsOf, orderHashOf, decodeValidated, etherListing, pinHashOf } from "../verify-bazaar.mjs";
import { KEEPSAKE_PLACEHOLDER, JOURNAL_PLACEHOLDER, BAZAAR_PLACEHOLDER, BRIDGES_PLACEHOLDER, STUDIO_PLACEHOLDER } from "../site.mjs";
import { argWords } from "../verify-console.mjs";

const WAD = 10n ** 18n, DAY = 86_400n;
const lower = (s) => String(s).toLowerCase();
const w32 = (n) => "0x" + BigInt(n).toString(16).padStart(64, "0");
const word = (cd, i) => BigInt("0x" + cd.slice(10 + 64 * i, 10 + 64 * (i + 1)));
const date = (t) => new Date(Number(t) * 1e3).toISOString().replace("T", " ").slice(0, 16) + " UTC";
const persona = (c, id) => (BigInt(c) << 96n) | BigInt(id);
const SPEC_T = "(string,string,string,uint32,uint128,uint64,uint64,uint32,uint16,uint16,bytes,bytes)";
const LAUNCH = `launch(uint256,${SPEC_T},bytes32)`;
const VALIDATE = `validate(${ORDER_T}[])`, FULFILL = `fulfillOrder(${ORDER_T},bytes32)`;
/// the slab's [data-arg] rows, as words, are the calldata decoded apart from the shell — one row per argument, a
/// tuple's and an array of tuples' too since W14 (CONSOLE §4.2, INTEGRATION L7)
const argsAgree = (page, sig) => { const rows = page.$$("#cslab [data-arg]"), want = argWords(sig, page.text("#cslab [data-calldata]")); return rows.length === want.length && rows.every((r, i) => r.dataset.arg === String(i) && r.textContent === want[i]); };
/// A token page with every hole a Studio template has and one script, as small as a page can be.
const PAGE = '<!doctype html><html><head><meta charset="utf-8"><title>Lantern #{{id}}</title><style>body{background:#05040a;color:#f4f1ff}</style></head>' +
  '<body><h1 id="t">Lantern #{{id}} of {{supply}}</h1><p id="h">{{holder}}</p><p>{{memories}} memories · epoch {{epoch}} · room {{room}}</p>' +
  "<script>document.body.dataset.seed='{{seed}}';document.title+=' · '+'{{collection}}'.slice(0,6)</script></body></html>";

export async function run(t, ctx0) {
  const { walletFor, kec, sel, enc, encodeParams, decUint, decAddr, decBool, A: ART } = ctx0;

  /*──────────── the page helpers, as identity.mjs drives a lane ────────────*/
  const L = (page, s) => page.$("#lane-gallery " + s);
  const LL = (page, s) => page.$$("#lane-gallery " + s);
  const T = (page, s) => page.text("#lane-gallery " + s);
  const slabOpen = (page) => page.$("#cbox").classList.contains("on");
  const gasRow = (page) => page.text("#cslab [data-gas]");
  const slabCd = (page) => page.text("#cslab [data-calldata]");
  const fnRow = (page) => page.text("#cslab [data-function]");
  const tick = (page) => page.text("#tick");
  const line = (page, k) => { const r = page.$$("#cslab .kv").find((x) => x.firstChild && x.firstChild.textContent === k); return r ? r.lastChild.textContent : null; };
  const press = async (page, el) => { if (!el) throw new Error("press: no control"); page.click(el); await page.until(() => slabOpen(page) && gasRow(page) !== "estimating…", 160); };
  const dismiss = async (page) => { page.click(page.$("#cslab [data-no]")); await page.settle(); };
  /* a receipt that itself moves the open token's custody epoch or this wallet's rights (a buy of #1 from #1's page)
     ends, as CONSOLE §4.7 says, on the sentence after the landing; such a call passes `moved`, and its wait names
     that sentence (W13: the landing wait timed out there, in silence, until the shim's waits threw) */
  const sign = async (page, W, n, moved = false) => {
    await page.until(() => !page.$("#cslab [data-go]").disabled, 60);
    const before = tick(page);
    page.click(page.$("#cslab [data-go]"));
    await page.until(() => W.sent() === n && tick(page) !== before && (moved ? tick(page) === "ownership or epoch changed — review again" : /landed in block|reverted in block/.test(tick(page))), 200);
    for (let k = 0; k < 6; k++) await page.settle();
  };
  /// the lane open and its first paint done, every read answered
  const gallery = async (ctx, id, o = {}) => {
    const r = await ctx.bootToken(id, o);
    const ok = await ctx.lane(r.page, "gallery");
    if (!ok) throw new Error("the gallery lane did not open: " + r.page.text("#lane-gallery").slice(0, 200) + " " + r.page.errors.map((e) => e.message).join("; "));
    return r;
  };
  /// open another NFT from the form, by a person's path: type, press open, wait for the paint
  const open = async (page, coll, id) => {
    page.click(L(page, "#gallery-form summary"));
    page.type(L(page, "#gallery-form input[name=collection]"), coll);
    page.type(L(page, "#gallery-form input[name=id]"), id == null ? "" : String(id));
    page.ctx.INTACT.loaded.gallery = false;
    page.click(L(page, "#gallery-open"));
    await page.until(() => page.ctx.INTACT.loaded.gallery === true, 200);
    for (let k = 0; k < 3; k++) await page.settle();
  };
  const repaint = async (page) => { page.ctx.INTACT.loaded.gallery = false; page.ctx.dispatchEvent(new page.ctx.CustomEvent("intact:lane", { detail: { name: "gallery" } })); await page.until(() => page.ctx.INTACT.loaded.gallery === true, 200); await page.settle(); };
  const errorsOf = (page) => page.errors.map((e) => String(e && e.message || e)).join("; ").slice(0, 300);
  const actsOf = (page) => LL(page, "[data-act]").map((b) => b.dataset.act);
  const fetchedOtherThanPanels = (page) => page.fetches.filter((f) => !/\/panel\/\w+\.js$/.test(f.url));
  const pages = [];
  const keep = (r) => { pages.push(r.page); return r; };

  /*═══════════ the V2 chain: every V2 contract, the Market, a royalty and the door ═══════════*/
  const ctx = await ctx0.fresh({ v2: true, deployMarket: true });
  const { c, site, actors, mint } = ctx;
  const { me, buyer, stranger } = actors;
  const ME = me.from.toString(), BUYER = buyer.from.toString();
  const hub = site.hub, bazaar = site.bazaar, journal = site.journal, studio = site.studio, bridges = site.bridges, market = site.market;
  const now = () => ctx.BLOCK().timestamp;
  const RECEIVER = "0x00000000000000000000000000000000000a11ce";
  const DOOR = kec(Buffer.from("opensea.v2", "utf8")), URL_ = "https://orders.example/api/v2";
  {
    const QUEUE = "queue(address,uint256,bytes,bytes32)", EXEC = "execute(address,uint256,bytes,bytes32)";
    const royalty = enc("setRoyalty(address,uint16)", [RECEIVER, 500]), door = enc("setEndpoint(bytes32,string)", [DOOR, URL_]);
    await c.exec(site.timelock, QUEUE, [hub, 0, royalty, w32(1)]);
    await c.exec(site.timelock, QUEUE, [bridges, 0, door, w32(2)]);
    ctx.warpBy(7n * DAY + 1n);
    await stranger.exec(site.timelock, EXEC, [hub, 0, royalty, w32(1)]);
    await stranger.exec(site.timelock, EXEC, [bridges, 0, door, w32(2)]);
  }
  for (let i = 0; i < 4; i++) await mint(c, site, ME);
  const reachOf = async (id) => decAddr(await c.read(hub, "account(uint256)", [id]));
  const ownerOf = async (coll, id) => lower(decAddr(await c.read(coll, "ownerOf(uint256)", [id])));
  const fpOf = async (id) => "0x" + (await c.read(hub, "getStateFingerprint(uint256)", [id])).slice(2, 66);
  t.ok(lower(decAddr(await c.read(hub, "royaltyInfo(uint256,uint256)", [1, 10_000]))) === lower(RECEIVER) && (await c.codeSize(SEAPORT)) > 0 && (await c.codeSize(bazaar)) > 0,
    "the gallery's chain carries every V2 contract and Seaport 1.6 at its canonical address, and the Timelock has written a 5 % royalty and the OpenSea door");

  /*═══════════ A · an on-chain SVG token drawn, lit by its own fills ═══════════*/
  t.head("A · an on-chain SVG token, drawn from its own data: URI and lit by its own colours");
  {
    const W = walletFor(c, me);
    const { page, S } = keep(await gallery(ctx, 1, { wallet: W }));
    await page.until(() => !!L(page, "#gallery-art img") && LL(page, "#gallery-traits .trait").length > 0, 80);
    const img = L(page, "#gallery-art img"), src = img ? img.getAttribute("src") : "";
    const svg = Buffer.from(src.split(",")[1] || "", "base64").toString("utf8");
    const face1 = JSON.parse(Buffer.from(ctx.decString(await c.read(hub, "tokenURIAt(uint256,uint8)", [1, 1])).split(",")[1], "base64").toString("utf8"));
    const painted = [...svg.matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g)].map((m) => m[1].replace(/\s+/g, ""));
    const ambient = (L(page, "#gallery-frame").dataset.ambient || "").split(" ");
    t.ok(/^data:image\/svg\+xml;base64,/.test(src) && src === face1.image && /<svg/.test(svg) && T(page, "#gallery-name") === face1.name,
      "an on-chain SVG token is drawn from its own data: URI: the image is face 1's, decoded in place, and its name is the metadata's", `${src.slice(0, 40)} name "${T(page, "#gallery-name")}"`);
    t.ok(ambient.length === 2 && ambient.every((a) => painted.includes(a)),
      "its frame is lit by the colours its own fills and strokes paint with, sampled from the SVG", `ambient ${ambient.join(" | ")} painted ${[...new Set(painted)].slice(0, 6).join(" | ")}`);
    /* W17: the sentence above holds that the frame's colours are the art's own, and a light() that returned one colour
       twice passed it. This one holds the two most vivid the art paints with, distinct, the most vivid first, each by
       its chroma: (1 − |2L − 1|) × S for an hsl(), (max − min) / 255 for a hex */
    const chroma = (p) => {
      let m = /^hsla?\(([\d.]+),([\d.]+)%,([\d.]+)%/.exec(p);
      if (m) return (1 - Math.abs(2 * m[3] / 100 - 1)) * m[2] / 100;
      m = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(p);
      if (!m) return -1;
      const x = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1], q = [0, 2, 4].map((k) => parseInt(x.substr(k, 2), 16));
      return (Math.max(...q) - Math.min(...q)) / 255;
    };
    const vivid = [...new Set(painted)].filter((p) => chroma(p) >= 0).sort((a, b) => chroma(b) - chroma(a));
    t.ok(ambient.length === 2 && ambient[0] !== ambient[1] && ambient[0] === vivid[0] && ambient[1] === vivid[1],
      "its frame is lit by two distinct colours, the two most vivid its art paints with, the most vivid first", `ambient ${ambient.join(" | ")} · by chroma ${vivid.slice(0, 3).map((p) => p + " " + chroma(p).toFixed(2)).join(" | ")}`);
    const traits = LL(page, "#gallery-traits .trait").map((ch) => ch.textContent);
    t.ok(face1.attributes.length > 0 && face1.attributes.every((a) => traits.includes(String(a.trait_type) + ": " + String(a.value))),
      "its attributes are chips, one per trait, each as the metadata spells it", traits.slice(0, 4).join(" | "));
    const { short: SH, checksum: CS } = page.ctx.INTACT.ui;
    t.ok(/its own site is this console/.test(T(page, "#gallery-token")) && !L(page, "#gallery-site") &&
      T(page, "#gallery-what") === "ERC-721 · INTACT · #1 · held by " + SH(CS(ME)),
      "an INTACT token says its own site is this console and runs no copy of it; its holder is ownerOf's", T(page, "#gallery-what"));
    const hero = [...L(page, "#gallery-token").children].map((e) => e.id).filter(Boolean);
    t.ok(hero.slice(0, 4).join() === "gallery-frame,gallery-name,gallery-price,gallery-what" && L(page, "#gallery-price").hidden && L(page, "#gallery-form").tagName === "DETAILS" && !L(page, "#gallery-form").open,
      "the art comes first, then its name, its price while one stands, and its facts; the form to open another NFT waits closed above them", hero.join(" → "));
  }

  /*═══════════ B · the owners, walked ═══════════*/
  t.head("B · its owners, from Transfer logs; a refused range is said, never a zero");
  {
    await c.exec(hub, "transferFrom(address,address,uint256)", [ME, BUYER, 2]);
    const W = walletFor(c, me);
    const { page } = keep(await gallery(ctx, 1, { wallet: W }));
    await open(page, hub, 2);
    const rows = LL(page, "#gallery-owners .owner").map((r) => r.textContent);
    const { short: SH, checksum: CS } = page.ctx.INTACT.ui;
    t.ok(rows.length === 2 && rows[0].startsWith("minted to " + SH(CS(ME))) && rows[1].startsWith(SH(CS(ME)) + " → " + SH(CS(BUYER))) &&
      W.filters().some((f) => lower(f.address) === lower(hub) && f.topics[3] === w32(2) && f.fromBlock === "0x0"),
      "the owners are walked from Transfer logs filtered by the id: minted to its first holder, then each move, in order", rows.join(" | "));
    W.refuse("eth_getLogs", Object.assign(new Error("query returned more than 10000 results"), { code: -32005 }));
    await repaint(page);
    t.ok(/the Transfer log could not be walked on this endpoint: query returned more than 10000 results/.test(T(page, "#gallery-owners")) && LL(page, "#gallery-owners .owner").length === 0 &&
      /its memories could not be read/.test(T(page, "#gallery-memories")) && !/\b0 memor/.test(T(page, "#gallery-memories")),
      "a range the endpoint refuses is said in words, for the owners and the memories alike, and never read as none", T(page, "#gallery-owners").slice(0, 160));
    W.override("eth_getLogs", null);
  }

  /*═══════════ C · memories, folded against rootOf ═══════════*/
  t.head("C · its memories: the Inscribed logs folded in order and held to rootOf, drawn as a constellation");
  {
    const INSCRIBE = "inscribe(address,uint256,uint8,bytes,bytes32)";
    const body = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
    await c.exec(journal, INSCRIBE, [hub, 1, 0, body("minted on a quiet morning; the first thing it saw was the commons"), w32(0)]);
    await c.exec(journal, INSCRIBE, [hub, 1, 3, body("a year of holding"), w32(0)]);
    await c.exec(journal, INSCRIBE, [hub, 1, 4, "0x" + "5e".repeat(180), w32(0)]);
    const W = walletFor(c, me);
    const { page } = keep(await gallery(ctx, 1, { wallet: W }));
    const root = lower(await c.read(journal, "rootOf(address,uint256)", [hub, 1])).slice(0, 66);
    await page.until(() => /the archive/.test(T(page, "#gallery-archive")), 80);
    const stars = LL(page, "#gallery-constellation svg circle.star"), mems = LL(page, "#gallery-memories .memory");
    t.ok(T(page, "#gallery-archive") === "the archive replays: 3 memories fold to rootOf, " + root.slice(0, 10) + "…" && decUint(await c.read(journal, "countOf(address,uint256)", [hub, 1])) === 3n,
      "the archive replays: the Inscribed logs, folded in order in the page, give the Journal's rootOf and countOf", T(page, "#gallery-archive"));
    t.ok(stars.length === 3 && stars.filter((s) => s.getAttribute("fill-opacity") === ".3").length === 1 && stars[2].dataset.kind === "4" && LL(page, "#gallery-constellation svg line").length === 2 &&
      LL(page, "#gallery-constellation svg circle").length === 6 &&
      L(page, "#gallery-constellation svg").getAttribute("role") === "img" && !L(page, "#gallery-constellation svg animate"),
      "the constellation draws one star per memory, the sealed one dim, the archive's line between them, and nothing in it loops", `${stars.length} stars`);
    /* W17: the sentence above counts one dim star and finds the sealed memory third; a constellation that dimmed the
       milestone and lit the sealed one passed it. This one holds which star is dim: the sealed memory's and no other */
    t.ok(stars.length === 3 && stars.every((s) => (s.dataset.kind === "4") === (s.getAttribute("fill-opacity") === ".3")) &&
      stars.filter((s) => s.dataset.kind !== "4").every((s) => s.getAttribute("fill-opacity") === "1"),
      "the dim star is the sealed memory's and no other: the note and the milestone shine at full strength", stars.map((s) => "kind " + s.dataset.kind + " at " + s.getAttribute("fill-opacity")).join(" · "));
    t.ok(mems.length === 3 && /— a sealed memory —/.test(mems[2].textContent) && /a year of holding/.test(mems[1].textContent) && /a milestone/.test(mems[1].textContent),
      "plain memories are printed as text and a sealed one as a sealed memory, never opened", mems.map((m) => m.textContent.slice(0, 50)).join(" | "));
    W.answer(journal, sel("rootOf(address,uint256)"), () => w32(0xbad));
    await repaint(page);
    t.ok(T(page, "#gallery-archive") === "the archive does not replay: the logs fold to " + root.slice(0, 10) + "…, rootOf says 0x00000000…",
      "a rootOf that disagrees with the logs is named: the archive does not replay, and why", T(page, "#gallery-archive"));
    W.answer(journal, sel("rootOf(address,uint256)"), null);
  }

  /*═══════════ D · a Studio collection: the spec before the signature, the mint, its page sandboxed ═══════════*/
  t.head("D · a Studio mint: the spec read before the signature, the price exactly, the link's via; the token's page in a sandbox");
  let LANTERN = null;
  {
    const PRICE = WAD / 100n;
    const spec = ["Lantern", "LANT", "Small lights, each its own site.", 50, PRICE, 0, 0, 0, 1_000, 500, "0x" + Buffer.from(PAGE, "utf8").toString("hex"), "0x"];
    const r = await c.exec(studio, LAUNCH, [persona(hub, 1), spec, w32(7)], { label: "launch Lantern" });
    LANTERN = decAddr(r.ret);
    t.ok(decBool(await c.read(studio, "isCollection(address)", [LANTERN])), "token #1's holder launched Lantern from #1 through the Studio");
    const VIA = persona(hub, 2);
    const W = walletFor(c, me);
    const { page } = keep(await gallery(ctx, 1, { wallet: W, query: "?via=" + VIA }));
    await open(page, LANTERN, null);
    await page.until(() => !!L(page, "#gallery-mint [data-act=mint]"), 80);
    const specText = T(page, "#gallery-spec");
    t.ok(/Lantern \(LANT\)/.test(specText) && /0 of 50/.test(specText) && /0\.01 ETH, exactly/.test(specText) && /10 % of each mint to the token that shared the link · royalty 5 %/.test(specText) &&
      T(page, "#gallery-via") === "persona " + VIA + " (from the link's ?via=)" && W.sent() === 0 && W.callsTo(LANTERN, sel("spec()")).length >= 1,
      "a Studio collection's spec is read from the chain and shown before anything is signed, with the via the link carries", specText.slice(0, 160));
    await press(page, L(page, "#gallery-mint [data-act=mint]"));
    const cd = slabCd(page);
    t.ok(fnRow(page) === "mint(address,uint256)" && lower(page.text("#cslab [data-to]")) === lower(LANTERN) && page.$("#cslab [data-value]").dataset.wei === String(PRICE) &&
      lower("0x" + cd.slice(34, 74)) === lower(ME) && word(cd, 1) === VIA && /^\d+ units$/.test(gasRow(page)),
      "the mint's slab sends exactly the price, mints to the connected wallet, and names the link's via", `${fnRow(page)} value ${page.$("#cslab [data-value]") && page.$("#cslab [data-value]").dataset.wei} gas ${gasRow(page)}`);
    await sign(page, W, 1);
    await page.until(() => !!L(page, "#gallery-site"), 120);
    const frame = L(page, "#gallery-site"), srcdoc = frame ? frame.getAttribute("srcdoc") : "";
    const uri = ctx.decString(await c.read(LANTERN, "tokenURI(uint256)", [1])), j = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
    const html = Buffer.from(j.animation_url.split(",")[1], "base64").toString("utf8");
    const { short: SH, checksum: CS } = page.ctx.INTACT.ui;
    t.ok(await ownerOf(LANTERN, 1) === lower(ME) && T(page, "#gallery-what") === "ERC-721 · " + SH(CS(LANTERN)) + " · #1 · held by " + SH(CS(ME)),
      "after the mint lands the lane opens the token the Transfer log names, the wallet's", T(page, "#gallery-what"));
    t.ok(!!frame && frame.tagName === "IFRAME" && frame.getAttribute("sandbox") === "allow-scripts" && !/allow-same-origin/.test(frame.getAttribute("sandbox")) &&
      srcdoc.endsWith(html) && /^<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:">/.test(srcdoc) && !frame.getAttribute("src"),
      "a token's data:text/html page runs in an iframe sandboxed to allow-scripts alone, its srcdoc carrying a CSP that refuses every network request", (frame && frame.getAttribute("sandbox")) + " " + srcdoc.slice(0, 90));
    const img = L(page, "#gallery-art img"), amb = (L(page, "#gallery-frame").dataset.ambient || "").split(" ");
    const orb = Buffer.from(j.image.split(",")[1], "base64").toString("utf8");
    t.ok(!!img && img.getAttribute("src") === j.image && amb.length === 2 && amb.every((a) => orb.replace(/\s+/g, "").includes(a)),
      "and its image, the Collection's own SVG orb, lights the frame with the orb's own colours", `${amb.join(" | ")}`);
    /* W14 (INTEGRATION W12-9): the Studio lane's own link carries a hub token's number, ?via=2, where this one carried a
       persona; the two forms never overlap (a persona's top bits are its collection), and either names the same referrer */
    const W2 = walletFor(c, me);
    const { page: p2 } = keep(await gallery(ctx, 1, { wallet: W2, query: "?via=2" }));
    await open(p2, LANTERN, null);
    await p2.until(() => !!L(p2, "#gallery-mint [data-act=mint]"), 80);
    const via2 = T(p2, "#gallery-via");
    await press(p2, L(p2, "#gallery-mint [data-act=mint]"));
    t.ok(via2 === "persona " + persona(hub, 2) + " (from the link's ?via=)" && fnRow(p2) === "mint(address,uint256)" && word(slabCd(p2), 1) === persona(hub, 2) && W2.sent() === 0,
      "a link's ?via= that is a token's number, as the Studio lane's link carries it, names that token's persona: ?via=2 mints through #2's", `"${via2}" · via word ${word(slabCd(p2), 1)}`);
    await dismiss(p2);
  }

  /*═══════════ E · a foreign ERC-721 whose metadata lives off chain ═══════════*/
  t.head("E · a foreign ERC-721: an off-chain URI is a link a person may open, never a request");
  const MOCK = await c.deploy(ART("test/mocks/MockERC721.sol", "MockERC721").bytecode, "", "MockERC721");
  await c.exec(MOCK, "mint(address,uint256)", [ME, 7]);
  const offchain = (W) => {
    W.answer(MOCK, sel("tokenURI(uint256)"), (data) => BigInt("0x" + data.slice(10)) === 7n ? "0x" + encodeParams("string", ["ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/7.json"])
      : "0x" + encodeParams("string", ["data:application/json;utf8," + JSON.stringify({ name: "Far", image: "https://images.example/far.png", attributes: [{ trait_type: "realm", value: "elsewhere" }] })]));
    return W;
  };
  {
    const W = offchain(walletFor(c, me));
    const { page } = keep(await gallery(ctx, 1, { wallet: W }));
    await open(page, MOCK, 7);
    const a = L(page, "#gallery-meta");
    t.ok(!!a && a.tagName === "A" && a.getAttribute("href") === "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/7.json" && a.getAttribute("rel") === "noopener noreferrer" &&
      !L(page, "#gallery-art img") && fetchedOtherThanPanels(page).length === 0,
      "a foreign ERC-721 whose metadata lives off chain is shown as a link a person may open, and the page fetches nothing", `${a && a.getAttribute("href")} fetches ${fetchedOtherThanPanels(page).map((f) => f.url)}`);
    await c.exec(MOCK, "mint(address,uint256)", [ME, 8]);
    await open(page, MOCK, 8);
    const link = L(page, "#gallery-art a.offchain");
    t.ok(T(page, "#gallery-name") === "Far" && !!link && link.getAttribute("href") === "https://images.example/far.png" && !L(page, "#gallery-art img") && /never loads it/.test(T(page, "#gallery-art")) &&
      LL(page, "#gallery-traits .trait").map((x) => x.textContent).join() === "realm: elsewhere" && fetchedOtherThanPanels(page).length === 0,
      "on-chain JSON whose image lives off chain: the JSON is decoded in place and the image is a link, never loaded", T(page, "#gallery-art"));
    const js = Buffer.from("javascript:alert(1)").toString();
    W.answer(MOCK, sel("tokenURI(uint256)"), () => "0x" + encodeParams("string", ["data:application/json," + encodeURIComponent(JSON.stringify({ name: "<b>bold</b>", image: js, animation_url: js }))]));
    await repaint(page);
    t.ok(T(page, "#gallery-name") === "<b>bold</b>" && !L(page, "#gallery-name b") && !LL(page, "#lane-gallery a").some((x) => /^javascript:/i.test(x.getAttribute("href") || "")) && !L(page, "#gallery-art img"),
      "a hostile name is text and a javascript: image is neither drawn nor linked", T(page, "#gallery-art"));
    /* W17: the sentence above looks for a javascript: anchor under `#lane-gallery #lane-gallery a`, a selector no element
       matches, and a lane that printed the hostile URI and linked it as well passed it. This one reads the lane itself */
    const lane = page.$("#lane-gallery"), hrefs = lane ? Array.from(lane.querySelectorAll("a")).map((x) => x.getAttribute("href") || "") : [];
    t.ok(!!lane && !hrefs.some((h) => /^javascript:/i.test(h)) && page.text("#lane-gallery").includes(js),
      "no link the lane draws carries a javascript: URI: the hostile token's animation is printed as text, never an anchor", `hrefs ${hrefs.join(" | ").slice(0, 200)}`);
  }

  /*═══════════ F · an INTACT listing: sealed, approved, validated and published from the lane, then bought ═══════════*/
  t.head("F · an INTACT listing published from the lane with no signature, and bought by a second account");
  {
    const W = walletFor(c, me);
    const { page, S } = keep(await gallery(ctx, 1, { wallet: W }));
    await page.until(() => !!L(page, "#gallery-sell #gallery-review"), 80);
    page.type(L(page, "#gallery-sell input[name=price]"), "0.1");
    page.type(L(page, "#gallery-sell input[name=days]"), "7");
    const t0 = now();
    page.click(L(page, "#gallery-review"));
    await page.until(() => !!L(page, "#gallery-steps [data-act=sealReach]"), 120);
    const steps0 = LL(page, "#gallery-steps .step").map((s) => s.dataset.step + (s.dataset.done ? "✓" : "")).join(",");
    t.ok(steps0 === "seal,market✓,approve,validate,publish" && W.sent() === 0 && /0\.1 ETH until .* · 0\.005 ETH of it to the royalty receiver/.test(T(page, "#gallery-steps")),
      "the sale is laid out as steps read from the chain: the Reach to seal, the market already closed, then approve, validate and publish, nothing yet sent", steps0 + " " + T(page, "#gallery-steps").slice(0, 120));
    const reach1 = await reachOf(1);
    await press(page, L(page, "#gallery-steps [data-act=sealReach]"));
    const end = word(slabCd(page), 0);
    t.ok(fnRow(page) === "seal(uint64)" && lower(page.text("#cslab [data-to]")) === lower(reach1) && end === t0 + 7n * DAY && /a seal only ever lengthens/.test(page.text("#cslab [data-sentence]")),
      "the Reach is sealed to the listing's end, on the chain's clock, in a slab that says a seal only lengthens", `${fnRow(page)} until ${end} (${t0})`);
    await sign(page, W, 1);
    await page.until(() => !!L(page, "#gallery-steps [data-act=approve]"), 120);
    await press(page, L(page, "#gallery-steps [data-act=approve]"));
    const acd = slabCd(page);
    t.ok(fnRow(page) === "approve(address,uint256)" && lower(page.text("#cslab [data-to]")) === lower(hub) && lower("0x" + acd.slice(34, 74)) === lower(SEAPORT) && word(acd, 1) === 1n,
      "Seaport is approved for this one token, exactly, never as an operator over all", `${fnRow(page)} ${acd.slice(0, 80)}`);
    await sign(page, W, 2);
    await page.until(() => !!L(page, "#gallery-steps [data-act=validate]"), 120);
    const fp = await fpOf(1), zh = pinHashOf(bazaar, 1n, fp, []);
    await press(page, L(page, "#gallery-steps [data-act=validate]"));
    const vcd = slabCd(page);
    t.ok(fnRow(page) === VALIDATE && lower(page.text("#cslab [data-to]")) === lower(SEAPORT) && !page.$("#cslab [data-value]") && argsAgree(page, VALIDATE) &&
      vcd.includes(zh.slice(2)) && vcd.includes(lower(bazaar).slice(2)) && line(page, "Signature") === "none: validating from your wallet is the authority" && /^\d+ units$/.test(gasRow(page)),
      "validate carries the order zoned to the Bazaar under pinHash(id, the live fingerprint, no floors), from the wallet, with no signature, every argument in words", `${line(page, "Order")} gas ${gasRow(page)}`);
    await sign(page, W, 3);
    await page.until(() => !!L(page, "#gallery-steps [data-act=publish]"), 120);
    await press(page, L(page, "#gallery-steps [data-act=publish]"));
    t.ok(fnRow(page) === `publish(${ORDER_T},${FLOORS_T})` && lower(page.text("#cslab [data-to]")) === lower(bazaar) && /^\d+ units$/.test(gasRow(page)), "publish goes to the Bazaar with the same order and no floors", gasRow(page));
    await sign(page, W, 4);
    await page.until(() => LL(page, "#gallery-listings .listing").length === 1 && /live/.test(T(page, "#gallery-listings .listing .state")), 160);
    const pub = c.getLogs({ address: bazaar, topics: [TOPIC.published, w32(hub), w32(1)] });
    const status = await c.read(SEAPORT, "getOrderStatus(bytes32)", [pub[0] && pub[0].topics[3]]);
    t.ok(pub.length === 1 && decBool(status, 0) && !decBool(status, 1) && W.sent() === 4 && W.prompts().every((p) => p.method === "eth_sendTransaction") &&
      LL(page, "#gallery-steps .step").length === 5 && LL(page, "#gallery-steps .step").every((s) => s.dataset.done === "1") && /listed: it shows above/.test(T(page, "#gallery-steps")) &&
      !LL(page, "#gallery-listings [data-act=buy]").length && !!L(page, "#gallery-listings [data-act=cancel]"),
      "an INTACT listing is validated and published from the lane with no signature: Seaport holds it validated, the Bazaar indexed it, and its seller is offered cancel, not buy",
      `published ${pub.length} sent ${W.sent()} prompts ${W.prompts().map((p) => p.method)}`);

    const WB = walletFor(c, buyer);
    const { page: pb } = keep(await gallery(ctx, 1, { wallet: WB }));
    await pb.until(() => !!L(pb, "#gallery-listings [data-act=buy]"), 120);
    const row = L(pb, "#gallery-listings .listing");
    t.ok(/^0\.1 ETH · by /.test(row.firstChild.textContent) && T(pb, "#gallery-listings .listing .state") === "live" && WB.callsTo(bazaar, sel("check(bytes32,uint256)")).length >= 1 &&
      !L(pb, "#gallery-price").hidden && T(pb, "#gallery-price") === "0.1 ETH · on Seaport, until " + date(end) &&
      WB.filters().some((f) => lower(f.address) === lower(SEAPORT) && f.topics[0] === TOPIC.orderValidated && f.fromBlock !== "0x0"),
      "a second account finds the listing from the Bazaar's logs, its order rebuilt from Seaport's OrderValidated near its publication and still good by bazaar.check, its price under the art", row.textContent.slice(0, 120));
    await press(pb, L(pb, "#gallery-listings [data-act=buy]"));
    const value = pb.$("#cslab [data-value]");
    t.ok(fnRow(pb) === FULFILL && lower(pb.text("#cslab [data-to]")) === lower(SEAPORT) && value && value.dataset.wei === String(WAD / 10n) && /^\d+ units$/.test(gasRow(pb)) &&
      /the seller is paid and the token is yours/.test(pb.text("#cslab [data-sentence]")),
      "buy is Seaport.fulfillOrder(order, 0) with exactly the price as value", `${fnRow(pb).slice(0, 20)} value ${value && value.dataset.wei}`);
    const s0 = await c.balanceOf(ME), r0 = await c.balanceOf(RECEIVER);
    await sign(pb, WB, 1, true);   // the buy moves #1's epoch and the buyer's rights on #1's page
    t.ok(await ownerOf(hub, 1) === lower(BUYER) && (await c.balanceOf(ME)) - s0 === WAD / 10n - WAD / 200n && (await c.balanceOf(RECEIVER)) - r0 === WAD / 200n,
      "a second account buys the INTACT listing at exactly the price: the token is the buyer's, the seller is paid the price less the royalty, the royalty receiver its 5 %",
      `owner ${await ownerOf(hub, 1)}`);
    await repaint(pb);
    t.ok(/^sold for 0\.1 ETH to /.test(T(pb, "#gallery-sales .sale")) && T(pb, "#gallery-sales .sale").includes(pb.ctx.INTACT.ui.short(pb.ctx.INTACT.ui.checksum(BUYER))) && T(pb, "#gallery-listings .listing .state") === "filled" &&
      L(pb, "#gallery-price").hidden,
      "the sale enters its story from Seaport's OrderFulfilled, and the listing reads filled", T(pb, "#gallery-sales"));
  }

  /*═══════════ G · a moved fingerprint, refused in words ═══════════*/
  t.head("G · a listing whose token moved since it was listed is refused in words, with no buy");
  {
    const id = 3n, end = now() + 30n * DAY;
    await c.exec(await reachOf(id), "seal(uint64)", [end]);
    await c.exec(hub, "approve(address,uint256)", [SEAPORT, id]);
    const fp = await fpOf(id), zh = pinHashOf(bazaar, id, fp, []);
    const o = etherListing({ token: hub, id, seller: ME, price: WAD / 4n, royalty: WAD / 4n * 500n / 10_000n, receiver: RECEIVER, zone: bazaar, zoneHash: zh, start: now(), end, salt: 33n });
    await c.exec(SEAPORT, SIG.validate, [[orderOf(o)]]);
    await c.exec(bazaar, SIG.publish, [orderOf(o), []]);
    await c.exec(hub, "setTrait(uint256,bytes32,bytes32)", [id, kec(Buffer.from("name", "utf8")), "0x" + Buffer.from("moved").toString("hex").padEnd(64, "0")]);
    const WB = walletFor(c, buyer);
    const { page } = keep(await gallery(ctx, 1, { wallet: WB }));
    await open(page, hub, id);
    await page.until(() => /refused/.test(T(page, "#gallery-listings")), 80);
    const check = await c.read(bazaar, "check(bytes32,uint256)", [zh, end]);
    t.ok(T(page, "#gallery-listings .listing .state") === "refused" && /refused by the zone: FingerprintMoved — the token changed since it was listed/.test(T(page, "#gallery-listings")) &&
      !L(page, "#gallery-listings [data-act=buy]") && check.startsWith(sel("FingerprintMoved(bytes32,bytes32)")) && WB.count("eth_estimateGas") === 0,
      "a moved fingerprint is refused in words: bazaar.check names FingerprintMoved, the lane says the token changed since it was listed, and offers no buy", T(page, "#gallery-listings").slice(0, 200));
  }

  /*═══════════ G2 · a listing that outlives its Reach's seal, held to the zone at its end (W17) ═══════════*/
  t.head("G2 · a listing whose Reach's seal lapses before the listing ends is refused in words, with no buy");
  {
    /* W17: every listing above was sealed past its end or had moved, so a lane asking bazaar.check at a listing's start
       passed them all. #2 here, the buyer's since B, is sealed past now and short of the listing's end: only the
       question asked at the end refuses it, as the zone refuses a fill (the seal must outlast the order) */
    const id = 2n, start = now(), sealEnd = start + 10n * DAY, end = start + 30n * DAY;
    await buyer.exec(await reachOf(id), "seal(uint64)", [sealEnd]);
    await buyer.exec(hub, "approve(address,uint256)", [SEAPORT, id]);
    const zh = pinHashOf(bazaar, id, await fpOf(id), []);
    const o = etherListing({ token: hub, id, seller: BUYER, price: WAD / 4n, royalty: WAD / 4n * 500n / 10_000n, receiver: RECEIVER, zone: bazaar, zoneHash: zh, start, end, salt: 35n });
    await buyer.exec(SEAPORT, SIG.validate, [[orderOf(o)]]);
    await buyer.exec(bazaar, SIG.publish, [orderOf(o), []]);
    const W = walletFor(c, me);
    const { page } = keep(await gallery(ctx, 1, { wallet: W }));
    await open(page, hub, id);
    await page.until(() => /^(refused|live)$/.test(T(page, "#gallery-listings .listing .state")), 80);
    const asked = W.callsTo(bazaar, sel("check(bytes32,uint256)")).filter((x) => lower(x.params[0].data).slice(10, 74) === lower(zh).slice(2)).map((x) => word(x.params[0].data, 1));
    const atEnd = await c.read(bazaar, "check(bytes32,uint256)", [zh, end]), atStart = await c.read(bazaar, "check(bytes32,uint256)", [zh, start]);
    t.ok(T(page, "#gallery-listings .listing .state") === "refused" && /refused by the zone: ReachSealShort — its Reach's seal ends before the listing does/.test(T(page, "#gallery-listings")) &&
      !L(page, "#gallery-listings [data-act=buy]") && asked.length >= 1 && asked.every((x) => x === end) && atEnd.startsWith(sel("ReachSealShort(uint64,uint256)")) && BigInt(atStart) === 0n && W.count("eth_estimateGas") === 0,
      "a listing that outlives its Reach's seal is refused in words: bazaar.check is asked at the listing's end and names ReachSealShort, though the seal stands now, and no buy is offered",
      `${T(page, "#gallery-listings").slice(0, 160)} · asked at ${asked.join(",")}, the end ${end}`);
  }

  /*═══════════ H · a plain NFT, listed and bought ═══════════*/
  t.head("H · a plain NFT listed from the lane and bought: an open order, no zone, no floors");
  {
    const W = offchain(walletFor(c, me));
    const { page } = keep(await gallery(ctx, 1, { wallet: W }));
    await open(page, MOCK, 7);
    await page.until(() => !!L(page, "#gallery-sell #gallery-review"), 80);
    page.type(L(page, "#gallery-sell input[name=price]"), "0.05");
    page.click(L(page, "#gallery-review"));
    await page.until(() => !!L(page, "#gallery-steps [data-act=approve]"), 120);
    const steps = LL(page, "#gallery-steps .step").map((s) => s.dataset.step).join(","), stepsText = T(page, "#gallery-steps");
    await press(page, L(page, "#gallery-steps [data-act=approve]"));
    await sign(page, W, 1);
    await page.until(() => !!L(page, "#gallery-steps [data-act=validate]"), 120);
    await press(page, L(page, "#gallery-steps [data-act=validate]"));
    const vcd = slabCd(page);
    await sign(page, W, 2);
    await page.until(() => !!L(page, "#gallery-steps [data-act=publish]"), 120);
    await press(page, L(page, "#gallery-steps [data-act=publish]"));
    await sign(page, W, 3);
    const pub = c.getLogs({ address: bazaar, topics: [TOPIC.published, w32(MOCK), w32(7)] });
    t.ok(steps === "approve,validate,publish" && pub.length === 1 && /0\.05 ETH until .* · no royalty asked/.test(stepsText) && !vcd.includes(lower(bazaar).slice(2)),
      "a plain NFT's sale has no seal to make: approve, validate and publish an open order with no zone", `${steps} published ${pub.length}`);
    const WB = offchain(walletFor(c, buyer));
    const { page: pb } = keep(await gallery(ctx, 1, { wallet: WB }));
    await open(pb, MOCK, 7);
    await pb.until(() => !!L(pb, "#gallery-listings [data-act=buy]"), 120);
    await press(pb, L(pb, "#gallery-listings [data-act=buy]"));
    const v = pb.$("#cslab [data-value]");
    await sign(pb, WB, 1);
    t.ok(v && v.dataset.wei === String(WAD / 20n) && await ownerOf(MOCK, 7) === lower(BUYER),
      "a plain NFT listing is published from the lane and bought by a second account at exactly the price", `owner ${await ownerOf(MOCK, 7)}`);
    await repaint(pb);
    t.ok(/^sold for 0\.05 ETH to /.test(T(pb, "#gallery-sales .sale")), "and its sale is found by the offerers that published it, though the contract emits no Transfer", T(pb, "#gallery-sales"));
  }

  /*═══════════ N · a price in an ERC-20: the buy's exact approval names Seaport (W14, INTEGRATION L7) ═══════════*/
  t.head("N · an NFT priced in WETH: the buy's exact approval names Seaport as the one who pulls");
  {
    const PRICE = WAD / 20n, Z = "0x" + "0".repeat(40), Z32_ = "0x" + "0".repeat(64);
    await c.exec(MOCK, "mint(address,uint256)", [ME, 8]);
    await c.exec(MOCK, "approve(address,uint256)", [SEAPORT, 8]);
    const o = { offerer: ME, zone: Z, offer: [{ itemType: ITEM.ERC721, token: MOCK, id: 8n, start: 1n, end: 1n }],
      consideration: [{ itemType: ITEM.ERC20, token: ctx.weth, id: 0n, start: PRICE, end: PRICE, recipient: ME }],
      orderType: KIND.FULL_OPEN, startTime: now(), endTime: now() + 30n * DAY, zoneHash: Z32_, salt: 8n, conduitKey: Z32_ };
    await c.exec(SEAPORT, VALIDATE, [[orderOf(o)]]);
    await c.exec(bazaar, SIG.publish, [orderOf(o), []]);
    const WB = offchain(walletFor(c, buyer));
    const { page } = keep(await gallery(ctx, 1, { wallet: WB }));
    await open(page, MOCK, 8);
    await page.until(() => !!L(page, "#gallery-listings [data-act=buy]"), 120);
    await press(page, L(page, "#gallery-listings [data-act=buy]"));
    const cd = slabCd(page);
    t.ok(fnRow(page) === "approve(address,uint256)" && lower(page.text("#cslab [data-to]")) === lower(ctx.weth) && lower("0x" + cd.slice(34, 74)) === lower(SEAPORT) && word(cd, 1) === PRICE &&
      line(page, "Lets") === "Seaport pull exactly 0.05 WETH" && line(page, "Never") === "unlimited" && WB.sent() === 0,
      "an NFT priced in WETH asks an exact approval first, and its line names who pulls it: Lets · Seaport pull exactly 0.05 WETH", `${fnRow(page)} · "${line(page, "Lets")}"`);
    await dismiss(page);
  }

  /*═══════════ I · the INTACT Market's own listing ═══════════*/
  t.head("I · the INTACT Market's own listing, shown beside Seaport's, with its buy");
  {
    const id = 4n, price = WAD / 5n, until = now() + 5n * DAY;
    await c.exec(await reachOf(id), "seal(uint64)", [until + DAY]);
    await c.exec(market, "list(uint256,uint256,uint64,bytes32,(address,uint256)[])", [id, price, until, await fpOf(id), []]);
    const WB = walletFor(c, buyer);
    const { page } = keep(await gallery(ctx, 1, { wallet: WB }));
    await open(page, hub, id);
    await page.until(() => !!L(page, "#gallery-market [data-act=marketBuy]"), 80);
    t.ok(new RegExp("^0\\.2 ETH until " + date(until) + " · by ").test(T(page, "#gallery-market-offer")) && T(page, "#gallery-price") === "0.2 ETH · on the INTACT Market, until " + date(until),
      "the Market's listing is printed as listingOf holds it, its price under the art", T(page, "#gallery-market-offer"));
    await press(page, L(page, "#gallery-market [data-act=marketBuy]"));
    const cd = slabCd(page), v = page.$("#cslab [data-value]");
    t.ok(fnRow(page) === "buy(uint256,uint256,bytes32)" && word(cd, 0) === id && word(cd, 1) === price && v && v.dataset.wei === String(price), "the Market's buy sends exactly the listed price", fnRow(page));
    await sign(page, WB, 1);
    t.ok(await ownerOf(hub, id) === lower(BUYER), "the INTACT Market's own listing is shown with its buy, and a second account buys it at the exact price", await ownerOf(hub, id));
  }

  /*═══════════ J · include OpenSea: the door printed, the switch off ═══════════*/
  t.head("J · include OpenSea: the Bridges door is printed beside a switch that stays off");
  {
    const W = walletFor(c, me);
    const { page } = keep(await gallery(ctx, 1, { wallet: W }));
    const sw = L(page, "#gallery-opensea");
    page.click(sw); await page.settle();
    t.ok(!!sw && sw.disabled && !sw.checked && sw.getAttribute("role") === "switch" && sw.getAttribute("aria-checked") === "false" &&
      new RegExp("^" + URL_.replace(/[.]/g, "\\.") + " · written .*; nothing is sent to it$").test(T(page, "#gallery-door")) &&
      /needs an API key and a request to a host this page never makes/.test(T(page, "#gallery-opensea") + page.text("#lane-gallery")) && fetchedOtherThanPanels(page).length === 0,
      "include OpenSea reads the door the Timelock wrote and prints it beside a switch that is off and disabled, with the sentence of why, and nothing is fetched", T(page, "#gallery-door"));
  }

  /*═══════════ K · a band with no V2: the chips, and no read to a codeless address ═══════════*/
  t.head("K · on a band without V2, each V2 section is a chip and no read goes to a codeless address");
  {
    const W = walletFor(ctx0.c, ctx0.actors.me);
    await ctx0.mint(ctx0.c, ctx0.site, ctx0.actors.me.from.toString());
    const { page } = keep(await gallery(ctx0, 1, { wallet: W }));
    const chips = LL(page, ".chip[data-state=absent]").map((ch) => ch.textContent);
    const codeless = [KEEPSAKE_PLACEHOLDER, JOURNAL_PLACEHOLDER, BAZAAR_PLACEHOLDER, BRIDGES_PLACEHOLDER, STUDIO_PLACEHOLDER];
    t.ok(/no Seaport on this chain/.test(T(page, "#gallery-listings")) && chips.includes("journal: not deployed on this chain") && chips.includes("bridges: not deployed on this chain") &&
      chips.includes("market: not deployed on this chain") && codeless.every((a) => W.callsTo(a).length === 0) && !chips.some((x) => /:\s*0\b/.test(x)),
      "where a V2 contract is not deployed its section is the chip by CONSOLE §6.3, never a zero, and no read is sent to its codeless address", chips.join(" | "));
  }

  /*═══════════ L · the viewer ═══════════*/
  t.head("L · the viewer reads the gallery and offers nothing to sign");
  {
    const W = walletFor(c, me);
    const { page } = keep(await gallery(ctx, 1, { wallet: W, opaque: true }));
    await page.until(() => !!L(page, "#gallery-art img") && /the archive/.test(T(page, "#gallery-archive")), 80);
    page.$$("#lane-gallery button").forEach((b) => page.click(b)); await page.settle();
    /* W13: "draws the gallery and its story" was the wait's alone; the sentence now checks the art and the archive */
    t.ok(page.$("body").dataset.mode === "viewer" && !!L(page, "#gallery-art img") && /the archive/.test(T(page, "#gallery-archive")) &&
      actsOf(page).length === 0 && W.prompts().length === 0 && /nothing here can sign/.test(T(page, ".gate")) && !L(page, "#gallery-sell"),
      "the viewer draws the gallery and its story from the chain, prompts nothing and renders no control that signs", `acts ${actsOf(page)} prompts ${W.prompts().length}`);
    /* W17: #1 is the buyer's since F, so the wallet above holds nothing here, and a lane that offered the viewer its
       sale form passed the sentence above. The holder's own wallet, read quietly in the viewer, is offered no sale */
    const WH = walletFor(c, buyer);
    const { page: ph } = keep(await gallery(ctx, 1, { wallet: WH, opaque: true }));
    await ph.until(() => !!L(ph, "#gallery-art img") && /the archive/.test(T(ph, "#gallery-archive")), 80);
    ph.$$("#lane-gallery button").forEach((b) => ph.click(b)); await ph.settle();
    t.ok(ph.$("body").dataset.mode === "viewer" && await ownerOf(hub, 1) === lower(BUYER) && !L(ph, "#gallery-sell") && LL(ph, "input[name=price]").length === 0 &&
      actsOf(ph).length === 0 && WH.prompts().length === 0,
      "the holder's own wallet in the viewer is offered no sale: no sell form, no control, and nothing prompts", `sell ${!!L(ph, "#gallery-sell")} acts ${actsOf(ph)} prompts ${WH.prompts().length}`);
  }

  /*═══════════ M · hygiene ═══════════*/
  t.head("M · the whole run: no markup string, no fetch but the panels, no error");
  t.ok(pages.every((p) => p.innerHTMLWrites === 0) && pages.every((p) => fetchedOtherThanPanels(p).length === 0) && pages.every((p) => p.errors.length === 0),
    "nothing was assigned through innerHTML, nothing was fetched but the panels, and no page threw, in any gallery page of the run", pages.map(errorsOf).filter(Boolean).join(" || ").slice(0, 400));
  for (const p of pages) p.close();
}
