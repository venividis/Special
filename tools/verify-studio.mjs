#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the Studio, on the real site (V2 wave 1, unit W4)

  docs/V2.md §3.4 and §5. The site is the one every verifier deploys
  (tools/site.mjs `deploySite`: the ship build, the four facets and the
  immutable diamond, the Market at its pin), and the Studio is deployed
  beside it with the Journal and Agora at codeless addresses — W2 and W5
  land them — so `{{memories}}` reads 0 and the room is a key no call
  makes. Then the journey V2 promises, one sentence per fact:

    · token #1's holder launches "Moonlit" from #1, with the default site
      below, at the address `predict` named before the launch;
    · a mint through a referral from token #2 is owed #2 its share, and a
      stranger's claim pays it to #2's fee sink;
    · tokenURI is valid JSON whose animation_url decodes to the page with
      every hole replaced by the chain's value, and whose image is the orb;
    · Chromium renders that page in a sandboxed iframe with no wallet and
      no network: the art large, "#1 of 100", the holder, the memories,
      "mint yours" with this token's persona, the room;
    · a second collection is launched from a Moonlit token, and parentOf
      names Moonlit;
    · royaltyInfo names #1's fee sink — the Grip once the holder routes
      fees there — and, after #1 is sold on the Market, the Reach the
      buyer now holds; the creator's claim follows the token the same way;
    · gas, measured: a launch with a 24,000-byte page, a mint, a tokenURI
      eth_call, and the worst template the Studio admits.

  The default site (`sitePage`) is the template the Studio lane ships
  (W12 lifts it): a real small website, no host, no font, no library.

    node tools/build-app.mjs      (once: deploySite reads dist/shards.json)
    node tools/verify-studio.mjs
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { compile, artifact } from "./compile.mjs";
import * as EVM from "./evm.mjs";
import { Chain, enc, sel, decUint, decAddr, decString, encodeParams } from "./evm.mjs";
import { deploySite, mint } from "./site.mjs";

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}`);
  if (!c && d !== undefined) console.log(`      ${d}`);
};
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const lower = (a) => String(a).toLowerCase();
const k256 = (buf) => Buffer.from(keccak256(buf));
const fmt = (g) => Number(g).toLocaleString("en-US");

/// A call that must fail for the stated reason, named by its selector.
const refuses = async (name, fn, error) => {
  let threw = false, why = "";
  try { await fn(); } catch (e) { threw = true; why = String(e.message || e); }
  ok(name, threw && why.includes(sel(error).slice(2)), threw ? `reverted, but not with ${error}: ${why.slice(0, 160)}` : "it went through");
};

/*═══════════════════ the default site ═══════════════════*/

/// The page template the Studio lane offers by default. `name` is the
/// collection's, written into the template as text before the launch
/// (the holes carry values, never markup, so the name is the creator's
/// own bytes); everything else is a hole the Collection fills per token.
/// The page reads with no script; the one script colours the orb from
/// the seed (the same two hues as the on-chain orb) and prints this
/// token's persona, the `via` a mint through this page should name.
function sitePage(name) {
  const text = String(name).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${text} #{{id}}</title>
<style>
:root{color-scheme:dark;--a:266;--b:146}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;color:#f4f1ff;font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;background:radial-gradient(90% 70% at 50% 0%,hsl(var(--a) 45% 14%),#05040a 70%)}
main{width:min(92vw,560px);padding:28px 0 40px;text-align:center}
.orb{width:min(78vw,380px);aspect-ratio:1;margin:0 auto 22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,hsl(var(--b) 90% 82%),hsl(var(--a) 75% 58%) 55%,hsl(var(--a) 70% 22%));box-shadow:0 0 90px hsl(var(--a) 80% 55%/.45),inset -18px -24px 60px rgba(0,0,0,.35);animation:breathe 6s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(1.025)}}
@media (prefers-reduced-motion:reduce){.orb{animation:none}}
h1{margin:0;font-size:clamp(28px,7vw,40px);letter-spacing:-.01em}
h1 small{font-weight:400;opacity:.6;font-size:.55em}
.facts{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:22px auto;text-align:left;font-size:13px}
.facts dt{color:rgba(236,232,255,.6)}
.facts dd{margin:0;font-family:ui-monospace,Menlo,monospace;word-break:break-all}
.mint{margin-top:18px;padding:18px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);text-align:left}
.mint h2{margin:0 0 6px;font-size:17px}
.mint p{margin:6px 0;font-size:13px;color:rgba(236,232,255,.75)}
code{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all;color:#b9f6ea}
footer{margin-top:18px;font-size:11px;color:rgba(236,232,255,.4);word-break:break-all}
</style></head><body><main>
<div class="orb" id="orb" role="img" aria-label="${text} #{{id}}"></div>
<h1 id="title">#{{id}} <small>of {{supply}}</small></h1>
<dl class="facts">
<dt>Held by</dt><dd id="holder">{{holder}}</dd>
<dt>Memories</dt><dd id="memories">{{memories}}</dd>
<dt>Custody epoch</dt><dd>{{epoch}}</dd>
<dt>Minted</dt><dd>{{minted}} of {{supply}}</dd>
<dt>Room</dt><dd id="room">{{room}}</dd>
</dl>
<section class="mint"><h2>Mint yours</h2>
<p>{{price}} wei on chain {{chain}}: call <code>mint(to, via)</code> on <code>{{collection}}</code> with <code>via</code> = <code id="via">{{collection}} &lt;&lt; 96 | {{id}}</code>, and this token is paid its share of your mint.</p>
</section>
<footer>${text}, served by {{collection}} from chain {{chain}}; launched by token {{creator}}; seed {{seed}}</footer>
</main>
<script>
(()=>{const s="{{seed}}",c="{{collection}}",i="{{id}}",r=document.documentElement.style;
const a=parseInt(s.slice(2,4),16)*360>>8,b=(a+60+parseInt(s.slice(4,6),16)%120)%360;
r.setProperty("--a",a);r.setProperty("--b",b);
document.getElementById("via").textContent=((BigInt(c)<<96n)|BigInt(i)).toString()})()
</script>
</body></html>
`;
}

/*═══════════════════ helpers ═══════════════════*/

const SPEC = "(string,string,string,uint32,uint128,uint64,uint64,uint32,uint16,uint16,bytes,bytes)";
const LAUNCH = `launch(uint256,${SPEC},bytes32)`;
const LAUNCHED = "0x" + k256(Buffer.from("Launched(address,uint256,address,string,string,uint32,uint128)")).toString("hex");
const MINTED = "0x" + k256(Buffer.from("Minted(uint256,address,uint256,uint256,uint256)")).toString("hex");
const HOLES = ["id", "seed", "holder", "epoch", "memories", "minted", "supply", "price", "collection", "creator", "room", "chain"];
const hex = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
const persona = (collection, id) => (BigInt(collection) << 96n) | BigInt(id);
const salt = (s) => "0x" + k256(Buffer.from(s)).toString("hex");
const word = (n) => "0x" + BigInt(n).toString(16).padStart(64, "0");
const roomOf = (collection) => BigInt("0x" + k256(Buffer.concat([Buffer.from([4]), Buffer.from(collection.slice(2), "hex")])).toString("hex"));
const decBytes = (h) => {
  const x = h.replace(/^0x/, "");
  const off = Number(BigInt("0x" + x.slice(0, 64))) * 2;
  const len = Number(BigInt("0x" + x.slice(off, off + 64)));
  return Buffer.from(x.slice(off + 64, off + 64 + len * 2), "hex");
};
const dataURI = (uri, prefix) => uri.startsWith(prefix) ? Buffer.from(uri.slice(prefix.length), "base64") : null;
const spec = (o) => [o.name, o.symbol, o.description ?? "", o.supply, o.price, o.opensAt ?? 0, o.closesAt ?? 0,
  o.perWallet ?? 0, o.referralBps ?? 0, o.royaltyBps ?? 0, hex(o.page), o.art ? hex(o.art) : "0x"];
const pad = (s, n) => {
  // a page of exactly n bytes: the template, then a comment of words to fill it
  const filler = " moonlight on the water, a map of the night it was minted;";
  const room = n - Buffer.byteLength(s) - 9;
  if (room < 0) throw new Error("page longer than " + n);
  return s + "<!--" + filler.repeat(Math.ceil(room / filler.length)).slice(0, room) + " -->\n";
};

/*═══════════════════ the site and the Studio ═══════════════════*/

const out = compile({ quiet: true, dirs: ["src"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const site = await deploySite(c, out, { deployMarket: true });
const hub = site.hub;
const JOURNAL = "0x00000000000000000000000000000000000010a1";   // W2: codeless here
const AGORA = "0x000000000000000000000000000000000000a60a";     // W5: codeless here

head("the Studio, beside the site");
const studioBytes = (A("src/Studio.sol", "Studio").deployed.length - 2) / 2;
const collectionBytes = (A("src/Collection.sol", "Collection").deployed.length - 2) / 2;
const studio = await c.deploy(A("src/Studio.sol", "Studio").bytecode, encodeParams("address,address,address", [hub, JOURNAL, AGORA]), "Studio");
const studioGas = c.gas.Studio;
ok(`the Studio is deployed beside the real hub (runtime ${fmt(studioBytes)} B; the Collection ${fmt(collectionBytes)} B; both under EIP-170's 24,576)`,
  studio.length === 42 && studioBytes <= 24_576 && collectionBytes <= 24_576);
ok("the Studio pins the hub, the Journal and Agora it was given",
  lower(decAddr(await c.read(studio, "HUB()"))) === lower(hub) && lower(decAddr(await c.read(studio, "JOURNAL()"))) === lower(JOURNAL) &&
  lower(decAddr(await c.read(studio, "AGORA()"))) === lower(AGORA));
const creationHash = "0x" + k256(Buffer.from(A("src/Collection.sol", "Collection").bytecode.slice(2), "hex")).toString("hex");
const codePtr = decAddr(await c.read(studio, "CODE()"));
ok("the Collection's creation code is held as one SSTORE2 shard, and CODE_HASH is its keccak",
  lower(await c.read(studio, "CODE_HASH()")) === lower(creationHash) && (await c.codeSize(codePtr)) === (A("src/Collection.sol", "Collection").bytecode.length - 2) / 2 + 1);

const alice = await c.as("0x" + "a1".repeat(32), 10n ** 21n);
const bob = await c.as("0x" + "b0".repeat(32), 10n ** 21n);
const carol = await c.as("0x" + "ca".repeat(32), 10n ** 21n);
const dave = await c.as("0x" + "da".repeat(32), 10n ** 21n);
const stranger = await c.as("0x" + "57".repeat(32), 10n ** 21n);
const ALICE = alice.from.toString(), BOB = bob.from.toString(), CAROL = carol.from.toString(), DAVE = dave.from.toString();
const t1 = (await mint(c, site, ALICE)).id, t2 = (await mint(c, site, BOB)).id;
ok("token #1 is alice's and token #2 bob's, read from the hub's Transfer logs", t1 === 1n && t2 === 2n &&
  lower(decAddr(await c.read(hub, "ownerOf(uint256)", [1]))) === lower(ALICE));
const P1 = persona(hub, 1), P2 = persona(hub, 2);
const reachOf = async (id) => decAddr(await c.read(hub, "account(uint256)", [id]));
const gripOf = async (id) => decAddr(await c.read(hub, "grip(uint256)", [id]));
const sinkOf = async (id) => decAddr(await c.read(hub, "feeSink(uint256)", [id]));

/*═══════════════════ launching Moonlit from #1 ═══════════════════*/

head("token #1's holder launches Moonlit from #1");
const PRICE = 10n ** 16n;
const PAGE = sitePage("Moonlit");
ok(`the default site is ${fmt(Buffer.byteLength(PAGE))} bytes, names no host and uses every hole but none other`,
  !/https?:\/\//.test(PAGE) && !/wss?:\/\//.test(PAGE) && HOLES.every((h) => PAGE.includes(`{{${h}}}`)) &&
  [...PAGE.matchAll(/\{\{(\w+)\}\}/g)].every((m) => HOLES.includes(m[1])));
const moonSpec = { name: "Moonlit", symbol: "MOON", description: "A map of the night it was minted. Every token is its own site.",
  supply: 100, price: PRICE, referralBps: 1_000, royaltyBps: 500, page: PAGE };
const SALT = salt("moonlit");
const predicted = decAddr(await c.read(studio, "predict(uint256,bytes32)", [P1, SALT]));
await refuses("bob, who does not hold #1, cannot launch from it", () => bob.exec(studio, LAUNCH, [P1, spec(moonSpec), SALT]), "NotYours()");
const launch = await alice.exec(studio, LAUNCH, [P1, spec(moonSpec), SALT], { label: "launch Moonlit" });
const moon = decAddr(launch.ret);
ok("Moonlit lands at the address predict named before the launch", lower(moon) === lower(predicted) && (await c.codeSize(moon)) === collectionBytes);
const lg = launch.logs.map((l) => ({ address: "0x" + Buffer.from(l[0]).toString("hex"), topics: l[1].map((t) => "0x" + Buffer.from(t).toString("hex")) }))
  .find((l) => l.topics[0] === LAUNCHED);
ok("Launched names the collection, the creator persona and the hub as its parent",
  !!lg && lower(lg.address) === lower(studio) && lower(lg.topics[1]) === lower(word(BigInt(moon))) && BigInt(lg.topics[2]) === P1 && lower(lg.topics[3]) === lower(word(BigInt(hub))));
ok("the Studio registers it, its parent is the hub, and it is listed under #1",
  BigInt(await c.read(studio, "isCollection(address)", [moon])) === 1n && lower(decAddr(await c.read(studio, "parentOf(address)", [moon]))) === lower(hub) &&
  lower(decAddr(await c.read(studio, "collectionsOf(uint256)", [P1]), 2)) === lower(moon));
ok("the collection's creator is token #1, as a persona, and it names the Studio", decUint(await c.read(moon, "creator()")) === P1 &&
  lower(decAddr(await c.read(moon, "STUDIO()"))) === lower(studio));
ok("the Studio holds nothing after the launch", (await c.balanceOf(studio)) === 0n);
await refuses("the same salt cannot be launched twice", () => alice.exec(studio, LAUNCH, [P1, spec(moonSpec), SALT]), "SaltUsed(address)");

/*═══════════════════ a mint through #2 ═══════════════════*/

head("a mint through a referral from token #2");
const m1 = await carol.exec(moon, "mint(address,uint256)", [CAROL, P2], { value: PRICE, label: "mint (referred)" });
const share = PRICE * 1_000n / 10_000n;
const ml = m1.logs.find((l) => "0x" + Buffer.from(l[1][0]).toString("hex") === MINTED);
ok("carol mints Moonlit #1 through #2: the Minted log carries the referral", !!ml &&
  BigInt("0x" + Buffer.from(ml[1][3]).toString("hex")) === P2 && decUint("0x" + Buffer.from(ml[2]).toString("hex"), 1) === share);
ok("#2 is owed price × referralBps / 10,000 and #1 the rest",
  decUint(await c.read(moon, "owed(uint256)", [P2])) === share && decUint(await c.read(moon, "owed(uint256)", [P1])) === PRICE - share);
const sink2 = await sinkOf(2), sink2Before = await c.balanceOf(sink2), strangerBefore = await c.balanceOf(stranger.from.toString());
const claim2 = await stranger.exec(moon, "claim(uint256)", [P2], { label: "claim" });
ok("a stranger's claim pays the share to #2's fee sink (its Reach), not to the stranger",
  lower(sink2) === lower(await reachOf(2)) && (await c.balanceOf(sink2)) - sink2Before === share &&
  (await c.balanceOf(stranger.from.toString())) <= strangerBefore && decUint(await c.read(moon, "owed(uint256)", [P2])) === 0n);
await refuses("and nothing is left to claim for #2", () => stranger.exec(moon, "claim(uint256)", [P2]), "NothingOwed()");
const m2 = await dave.exec(moon, "mint(address,uint256)", [DAVE, 0], { value: PRICE, label: "mint" });

/*═══════════════════ the token is a website ═══════════════════*/

head("tokenURI is the token's website, built on chain");
const uriHex = await c.call(moon, enc("tokenURI(uint256)", [1]));
const uriGas = c.lastGas;
const uri = decString(uriHex);
let meta = null;
try { meta = JSON.parse(dataURI(uri, "data:application/json;base64,").toString("utf8")); } catch { meta = null; }
ok("tokenURI is base64 JSON that parses", !!meta && typeof meta === "object", uri.slice(0, 80));
ok("named 'Moonlit #1' and described by the creator", meta && meta.name === "Moonlit #1" && meta.description === moonSpec.description);
const html = meta ? dataURI(meta.animation_url, "data:text/html;base64,") : null;
const pageOf = decBytes(await c.call(moon, enc("pageOf(uint256)", [1])));
ok("animation_url decodes to the filled page, byte for byte the collection's pageOf(1)", !!html && html.equals(pageOf));
const H = html ? html.toString("utf8") : "";
ok("no hole is left in it", HOLES.every((h) => !H.includes(`{{${h}}}`)));
const seed1 = await c.read(moon, "seedOf(uint256)", [1]);
const want = {
  id: "1", seed: lower(seed1), holder: lower(CAROL), epoch: "1", memories: "0", minted: "2", supply: "100", price: PRICE.toString(),
  collection: lower(moon), creator: P1.toString(), room: roomOf(moon).toString(), chain: String(c.common.chainId())
};
const page = PAGE.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in want ? want[k] : m));
ok("and every hole holds the chain's value: id, seed, holder, epoch, memories, minted, supply, price, collection, creator, room, chain",
  H === page, H.length + " vs " + page.length);
ok("the room is Agora's collectionKey: keccak256(abi.encodePacked(uint8(4), collection))", decUint(await c.read(moon, "room()")) === roomOf(moon));
ok("with the Journal codeless, the memory count reads 0 rather than reverting the page", H.includes('<dd id="memories">0</dd>'));
const svg = meta ? dataURI(meta.image, "data:image/svg+xml;base64,") : null;
const s0 = parseInt(lower(seed1).slice(2, 4), 16), hueA = (s0 * 360) >> 8;
ok("image is the default orb, an SVG whose hue is the seed's first byte", !!svg && svg.toString().startsWith('<svg xmlns="http://www.w3.org/2000/svg"') &&
  svg.toString().includes(`stop-color="hsl(${hueA},75%,58%)"`));
ok("the attributes carry the custody epoch, the memories, the creator, the room and the seed",
  meta && Array.isArray(meta.attributes) && meta.attributes.length === 5 && meta.attributes[0].value === 1 && meta.attributes[1].value === 0 &&
  meta.attributes[2].value === P1.toString() && meta.attributes[3].value === want.room && meta.attributes[4].value === want.seed);
const cu = JSON.parse(dataURI(decString(await c.call(moon, enc("contractURI()"))), "data:application/json;base64,").toString());
ok("contractURI is JSON naming the collection, its creator persona and its room", cu.name === "Moonlit" && cu.creator === P1.toString() && cu.room === want.room && cu.minted === 2);

/*═══════════════════ in a browser ═══════════════════*/

head("the page in Chromium: a sandboxed iframe, no wallet, no network");
{
  let browser = null, failed = null;
  const seen = [];
  try {
    const { chromium } = await import("playwright");
    const exe = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers", "chromium");
    browser = await chromium.launch({ headless: true, ...(fs.existsSync(exe) ? { executablePath: exe } : {}) });
    const pg = await browser.newPage();
    pg.on("request", (r) => seen.push(r.url()));
    await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>a marketplace frame</title></head><body style="margin:0">` +
      `<iframe id="v" sandbox="allow-scripts" style="width:600px;height:1000px;border:0" src="${meta.animation_url}"></iframe></body></html>`);
    const frame = await (await pg.waitForSelector("#v")).contentFrame();
    await frame.waitForFunction(() => /^\d+$/.test((document.getElementById("via") || {}).textContent || ""), null, { timeout: 15000 });
    const got = await frame.evaluate(() => ({
      title: document.getElementById("title").textContent,
      holder: document.getElementById("holder").textContent,
      memories: document.getElementById("memories").textContent,
      room: document.getElementById("room").textContent,
      via: document.getElementById("via").textContent,
      mint: !!Array.from(document.querySelectorAll("h2")).find((h) => h.textContent === "Mint yours"),
      orb: document.getElementById("orb").getBoundingClientRect().width,
      a: getComputedStyle(document.documentElement).getPropertyValue("--a").trim(),
      wallet: typeof window.ethereum,
      parent: (() => { try { return parent.document ? "same-origin" : "?"; } catch { return "opaque"; } })()
    }));
    ok("the page renders: the art large, '#1 of 100', the holder, the memories and the room", got.title === "#1 of 100" &&
      got.holder === want.holder && got.memories === "0" && got.room === want.room && got.orb >= 300, JSON.stringify(got));
    ok("'mint yours' names this token's persona as the via, computed in the page from {{collection}} and {{id}}",
      got.mint && got.via === persona(moon, 1).toString(), got.via);
    ok("its orb takes the seed's hue, the same one the on-chain image draws", got.a === String(hueA), `${got.a} vs ${hueA}`);
    ok("with no wallet in the frame, and the frame cannot reach the page that embeds it", got.wallet === "undefined" && got.parent === "opaque", `${got.wallet} ${got.parent}`);
  } catch (e) { failed = e; }
  finally { if (browser) await browser.close(); }
  if (failed) ok("the page renders in Chromium", false, String(failed.message || failed).slice(0, 300));
  const net = seen.filter((u) => /^(https?|wss?):/i.test(u));
  ok("and it asked the network for nothing", !failed && net.length === 0, net.join(", "));
}

/*═══════════════════ lineage ═══════════════════*/

head("a collection born from a Moonlit token");
const echoSpec = { ...moonSpec, name: "Moonlit Echo", symbol: "ECHO", page: sitePage("Moonlit Echo") };
const PM1 = persona(moon, 1);
const echoLaunch = await carol.exec(studio, LAUNCH, [PM1, spec(echoSpec), SALT], { label: "launch Echo" });
const echo = decAddr(echoLaunch.ret);
ok("carol, who holds Moonlit #1, launches Moonlit Echo from it", BigInt(await c.read(studio, "isCollection(address)", [echo])) === 1n &&
  decUint(await c.read(echo, "creator()")) === PM1);
ok("and parentOf names Moonlit: the family tree is on chain", lower(decAddr(await c.read(studio, "parentOf(address)", [echo]))) === lower(moon));
ok("the same salt under another creator is another address", lower(echo) !== lower(moon) &&
  lower(echo) === lower(decAddr(await c.read(studio, "predict(uint256,bytes32)", [PM1, SALT]))));
ok("the Studio has launched two collections", decUint(await c.read(studio, "collectionCount()")) === 2n &&
  lower(decAddr(await c.read(studio, "collectionAt(uint256)", [1]))) === lower(echo));
const viaReach = await alice.exec(await reachOf(1), "execute(address,uint256,bytes,uint8)",
  [studio, 0, enc(LAUNCH, [P1, spec({ ...moonSpec, name: "Moonlit Tide", symbol: "TIDE" }), salt("tide")]), 0], { label: "launch via the Reach" });
const tide = "0x" + decBytes(viaReach.ret).subarray(12).toString("hex");
ok("#1's canonical Reach, driven by its holder through execute, launches for #1 on the real hub",
  BigInt(await c.read(studio, "isCollection(address)", [tide])) === 1n && decUint(await c.read(tide, "creator()")) === P1 &&
  lower(tide) === lower(decAddr(await c.read(studio, "predict(uint256,bytes32)", [P1, salt("tide")]))));

/*═══════════════════ royalties and the sale of #1 ═══════════════════*/

head("royaltyInfo, before and after #1 is sold");
const roy = async () => { const r = await c.read(moon, "royaltyInfo(uint256,uint256)", [1, 10n ** 18n]); return [lower(decAddr(r, 0)), decUint(r, 1)]; };
let [to, amt] = await roy();
ok("royaltyInfo names #1's fee sink, its Reach, for 5 % of the sale", to === lower(await sinkOf(1)) && to === lower(await reachOf(1)) && amt === 5n * 10n ** 16n);
await alice.exec(hub, "setFeesToGrip(uint256,bool)", [1, true]);
[to] = await roy();
ok("read at the moment it is asked: once the holder routes fees to the Grip, the Grip", to === lower(await gripOf(1)) && to === lower(await sinkOf(1)));

const now = () => EVM.BLOCK.header.timestamp;
await alice.exec(await reachOf(1), "seal(uint64)", [now() + 30n * 86400n]);
const SALE = 10n ** 17n, until = now() + 7n * 86400n;
const fp = await c.read(hub, "getStateFingerprint(uint256)", [1]);
await alice.exec(site.market, "list(uint256,uint256,uint64,bytes32,(address,uint256)[])", [1, SALE, until, fp, []], { label: "list" });
const pinned = "0x" + (await c.read(site.market, "listingOf(uint256)", [1])).slice(2 + 64 * 5, 2 + 64 * 6);
await dave.exec(site.market, "buy(uint256,uint256,bytes32)", [1, SALE, pinned], { value: SALE, label: "buy" });
ok("dave buys #1 on the Market", lower(decAddr(await c.read(hub, "ownerOf(uint256)", [1]))) === lower(DAVE));
[to] = await roy();
ok("after the sale royaltyInfo names the fee sink the buyer now holds: the Reach, since a sale clears the Grip route",
  to === lower(await reachOf(1)) && to === lower(await sinkOf(1)));
const owed1 = decUint(await c.read(moon, "owed(uint256)", [P1])), reach1 = await reachOf(1), r1Before = await c.balanceOf(reach1);
await stranger.exec(moon, "claim(uint256)", [P1]);
ok("and the creator's proceeds follow the token: a claim after the sale pays #1's Reach, the buyer's",
  owed1 === 2n * PRICE - share && (await c.balanceOf(reach1)) - r1Before === owed1 && decUint(await c.read(moon, "owed(uint256)", [P1])) === 0n);

/*═══════════════════ gas ═══════════════════*/

head("gas, measured on this run");
const LONG = pad(sitePage("Longform"), 24_000);
const longSpec = { ...moonSpec, name: "Longform", symbol: "LONG", page: LONG };
const longLaunch = await bob.exec(studio, LAUNCH, [P2, spec(longSpec), salt("longform")], { label: "launch 24,000-byte page" });
const long = decAddr(longLaunch.ret);
const longMint = await carol.exec(long, "mint(address,uint256)", [CAROL, 0], { value: PRICE, label: "mint (first)" });
await c.call(long, enc("tokenURI(uint256)", [1]));
const longUriGas = c.lastGas;
ok(`a launch with a 24,000-byte page is one transaction of ${fmt(longLaunch.gas)} gas, under the 2^24 cap`,
  Buffer.byteLength(LONG) === 24_000 && longLaunch.gas < EVM.TX_GAS_CAP);
ok(`its first mint costs ${fmt(longMint.gas)} gas, a referred mint ${fmt(m1.gas)}, a later one ${fmt(m2.gas)}`, longMint.gas < 300_000n && m1.gas < 300_000n);
ok(`its tokenURI eth_call costs ${fmt(longUriGas)} gas, Moonlit's ${fmt(uriGas)}: far under the 2^24 cap`, longUriGas < 4_000_000n && uriGas < 4_000_000n);

const holey = (n, k) => "{{room}}".repeat(k) + "x".repeat(n - 8 * k);
const worstSpec = { ...moonSpec, name: "Worst", symbol: "WORST", page: holey(24_000, 256), art: holey(12_000, 256) };
const worstLaunch = await bob.exec(studio, LAUNCH, [P2, spec(worstSpec), salt("worst")], { label: "launch worst" });
const worst = decAddr(worstLaunch.ret);
await carol.exec(worst, "mint(address,uint256)", [CAROL, 0], { value: PRICE });
await c.call(worst, enc("tokenURI(uint256)", [1]));
const worstUriGas = c.lastGas;
ok(`the worst template the Studio admits (256 of the widest hole in a 24,000-byte page and a 12,000-byte art): launch ${fmt(worstLaunch.gas)}, tokenURI ${fmt(worstUriGas)}`,
  worstLaunch.gas < EVM.TX_GAS_CAP && worstUriGas < 8_000_000n);
await refuses("and one hole more is refused at launch",
  () => bob.exec(studio, LAUNCH, [P2, spec({ ...worstSpec, page: holey(24_000, 257), art: "" }), salt("over")]), "BadPage()");

/*  Why the bound exists, measured: the same two templates with as many
    holes as their bytes hold (3,000 and 1,500), in a Collection deployed
    directly — the Studio would refuse them — so nothing checks the count.
    SSTORE2 shards are written here by hand: init code 61 <len+1> 80 60 0c
    60 00 39 60 00 f3, then the STOP byte and the data (lib/SSTORE2).    */
const shard = async (text) => {
  const data = Buffer.from(text, "utf8");
  const init = "0x61" + (data.length + 1).toString(16).padStart(4, "0") + "80600c6000396000f3" + "00" + data.toString("hex");
  return c.deploy(init, "", "shard");
};
const INIT = "(address,address,address,address,uint256,string,string,string,uint32,uint128,uint64,uint64,uint32,uint16,uint16,address,address)";
const unbounded = await c.send({
  data: A("src/Collection.sol", "Collection").bytecode + encodeParams(INIT, [[studio, hub, JOURNAL, AGORA, P2, "Unbounded", "UNB", "", 10, 0, 0, 0, 0, 0, 0,
    await shard(holey(24_000, 3_000)), await shard(holey(12_000, 1_500))]]),
  label: "deploy unbounded"
});
await carol.exec(unbounded.address, "mint(address,uint256)", [CAROL, 0]);
await c.call(unbounded.address, enc("tokenURI(uint256)", [1]));
const unboundedGas = c.lastGas;
ok(`without the bound, the same templates holding 3,000 and 1,500 holes cost ${fmt(unboundedGas)} gas to render: past the 2^24 cap, which is why the Studio refuses them`,
  unboundedGas > EVM.TX_GAS_CAP);

console.log(`\n  gas: Studio deploy ${fmt(studioGas)}, launch (Moonlit, ${fmt(Buffer.byteLength(PAGE))}-byte page) ${fmt(launch.gas)}, ` +
  `launch (24,000-byte page) ${fmt(longLaunch.gas)}, mint ${fmt(longMint.gas)} first / ${fmt(m2.gas)} later / ${fmt(m1.gas)} referred, ` +
  `claim ${fmt(claim2.gas)}, tokenURI ${fmt(uriGas)} (Moonlit) / ${fmt(longUriGas)} (24,000 B) / ${fmt(worstUriGas)} (worst admitted) / ` +
  `${fmt(unboundedGas)} (unbounded, not admitted)`);
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
