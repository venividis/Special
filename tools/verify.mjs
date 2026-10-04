#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · end to end, on a real EVM

  Origin: IPSEITY tools/verify.mjs (121 assertions), ported onto the
  INTACT site (U7) with the equality step DESIGN.md §13 names: the two
  surfaces are one byte-stream.

  Compiles the contracts, deploys the whole MVB into an in-process EVM at
  Cancun (tools/site.mjs — the diamond that ships, the real ERC-6551
  registry, every satellite at its predicted address), loads the shell
  and the six panels shard by shard, freezes the engine, mints, and then
  pulls tokenURI() back out and takes it apart: base64 → JSON → base64 →
  the document → the state block and the gzip shell. The document that
  comes back has to be the same bytes `/token/<id>/live` serves, the
  shell inside it the same bytes `dist/app.html` holds, and every
  selector, topic and hash in the state block the number this process
  recomputes from the signature and the file.

    node tools/verify.mjs
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { compile } from "./compile.mjs";
import { Chain, sel, decUint, decAddr, decBool, decString, decStringArray, encodeParams } from "./evm.mjs";
import { ROOT, deploySite, getter, mint, readPlan, PANELS, ZERO } from "./site.mjs";
import { CAPS } from "./gas.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${String(detail).slice(0, 300)}`);
};
const eq = (name, got, want) => ok(name, String(got) === String(want), `got ${String(got).slice(0, 120)}\n      want ${String(want).slice(0, 120)}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const gas = (n) => (Number(n) / 1e6).toFixed(2) + "M";
const kec = (b) => "0x" + Buffer.from(keccak256(Buffer.from(b))).toString("hex");
const selOf = (sig) => kec(Buffer.from(sig, "utf8")).slice(0, 10);
const b64json = (uri) => JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
const stateOfHtml = (html) => {
  const m = html.match(/<script>window\.INTACT=([\s\S]*?)<\/script>/);
  return m ? { text: m[1], obj: JSON.parse(m[1]) } : null;
};

/*──────────────────── build ────────────────────*/
head("build");
const plan = readPlan();
const DOC = fs.readFileSync(path.join(ROOT, "dist/app.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "dist/manifest.json"), "utf8"));
ok(`shard plan is ${plan.mode}${plan.placeholder ? " (PLACEHOLDER shell from tools/fixtures/)" : ""}`, plan.mode === "packed");
eq("the plan's engine hash is the keccak of dist/app.html", plan.engineHash, kec(Buffer.from(DOC, "utf8")));
console.log(`      ${plan.storedBytes.toLocaleString()} bytes on chain across ${plan.head.length + plan.body.length} shard(s), ${plan.panels.length} panels`);

const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
ok("contracts compile", true);

/*──────────────────── deploy ────────────────────*/
head("deploy: the diamond that ships, every satellite at its predicted address");
const c = await Chain.open();
const site = await deploySite(c, out);
ok("the ERC-6551 registry sits at its canonical address with its real runtime", (await c.codeSize(site.registry)) === 571);
ok("every prediction landed (the deployer would have refused otherwise)", true);
console.log(`      hub ${site.hub}\n      premises ${site.premises}\n      catalog ${site.catalog} (+rows ${site.catalogRows.slice(0, 10)}… text ${site.catalogText.slice(0, 10)}… state ${site.catalogState.slice(0, 10)}…)`);
const GET = getter(c, site.premises);

const agrees = await c.read(site.catalog, "agrees()");
ok("the Catalog agrees with the hub on every pinned address and the band", decBool(agrees), agrees);

/*──────────────────── the engine ────────────────────*/
head("the engine");
const sizes = await c.read(site.engine, "sizes()");
eq("head bytes stored", decUint(sizes, 0), plan.head.reduce((a, s) => a + s.bytes, 0));
eq("body bytes stored", decUint(sizes, 1), plan.body.reduce((a, s) => a + s.bytes, 0));
ok("engine is frozen", decBool(await c.read(site.engine, "frozen()")));
eq("engineHash is the keccak of the inflated shell", "0x" + (await c.read(site.engine, "engineHash()")).slice(2), plan.engineHash);
eq("inflatedSize is the shell's length", decUint(await c.read(site.engine, "inflatedSize()")), plan.inflatedSize);
for (let i = 0; i < PANELS.length; i++) {
  const h = await c.read(site.engine, "panelHash(uint256)", [i]);
  eq(`panel ${PANELS[i]} is pinned by the keccak of its inflated bytes`, h, manifest.panelHashes[PANELS[i]]);
}
let threw = false;
try { await c.exec(site.engine, "loadBody(bytes)", ["0xdeadbeef"]); } catch { threw = true; }
ok("a frozen engine refuses more shards", threw);
threw = false;
try { await c.exec(site.engine, "loadPanel(uint256,bytes,bytes32)", [0, "0xdeadbeef", "0x" + "11".repeat(32)]); } catch { threw = true; }
ok("and refuses a panel", threw);
threw = false;
try { await c.exec(site.engine, "setEngineHash(bytes32,uint32)", ["0x" + "22".repeat(32), 1]); } catch { threw = true; }
ok("and a new hash", threw);
console.log(`      loading cost ${gas(Object.values(site.gasLog).reduce((a, b) => a + b, 0n))} gas`);

/*──────────────────── mint ────────────────────*/
head("mint");
const me = c.from.toString();
const { id, gas: mintGas } = await mint(c, site, me);
eq("the Transfer log names the first id of the band", id, 1n);
eq("owner of #1", decAddr(await c.read(site.hub, "ownerOf(uint256)", [id])).toLowerCase(), me.toLowerCase());
console.log(`      mint cost ${gas(mintGas)} gas`);
const reach = decAddr(await c.read(site.hub, "account(uint256)", [id]));
const grip = decAddr(await c.read(site.hub, "grip(uint256)", [id]));
ok("the Reach exists", (await c.codeSize(reach)) === 173);
ok("the Grip exists", (await c.codeSize(grip)) === 173);

/*──────────────────── tokenURI round trip ────────────────────*/
head("tokenURI round trip");
const uri = decString(await c.read(site.hub, "tokenURI(uint256)", [id]));
const uriGas = c.lastGas;
ok("tokenURI is a data URI", uri.startsWith("data:application/json;base64,"));
ok(`tokenURI reads for under ${gas(CAPS.tokenURI)} gas — the build-failing cap`, uriGas <= CAPS.tokenURI, gas(uriGas));
console.log(`      ${(uri.length / 1024).toFixed(1)} KB returned for ${gas(uriGas)} gas`);
const meta = b64json(uri);
eq("name", meta.name, "INTACT #1");
ok("has a description", typeof meta.description === "string" && meta.description.length > 100);
ok("has an image", String(meta.image || "").startsWith("data:image/svg+xml;base64,"));
ok("has an animation", String(meta.animation_url || "").startsWith("data:text/html;base64,"));
eq("external_url is the console on the web3:// origin", meta.external_url, `web3://${site.premises.toLowerCase()}:1/token/1/live`);
ok("has attributes", Array.isArray(meta.attributes) && meta.attributes.length >= 8);
const attr = (k) => (meta.attributes.find((a) => a.trait_type === k) || {}).value;
eq("the Custody epoch attribute is 1", attr("Custody epoch"), 1);
eq("the Status attribute is Active at mint", attr("Status"), "Active");
eq("the Reach attribute is the account", String(attr("Reach")).toLowerCase(), reach.toLowerCase());

const html = Buffer.from(meta.animation_url.split(",")[1], "base64").toString("utf8");
/*  Canonical, not merely decodable. The donor's Base64 read its last chunk
    past the input, so a partial chunk's padding carried whatever memory
    followed the array; every decoder dropped those bits, so a round trip
    never noticed. Re-encoding the decoded bytes here gives the one
    canonical string, and the chain's must equal it at both layers.      */
eq("the inner base64 is canonical: re-encoding the decoded document reproduces the chain's string byte for byte",
   meta.animation_url.split(",")[1], Buffer.from(html, "utf8").toString("base64"));
eq("and so is the outer: the tokenURI's base64 re-encodes to itself",
   uri.split(",")[1], Buffer.from(Buffer.from(uri.split(",")[1], "base64")).toString("base64"));
eq("and the crest's: three layers, three lengths, each re-encoding to the chain's string",
   meta.image.split(",")[1], Buffer.from(Buffer.from(meta.image.split(",")[1], "base64")).toString("base64"));
console.log(`      document: ${(html.length / 1024).toFixed(1)} KB`);
ok("the document begins with the prologue and its CSP", html.startsWith("<!doctype html>") && html.includes("Content-Security-Policy"));
const m = html.match(/self\.\$INTACT="([A-Za-z0-9+/=]+)";<\/script>/);
ok("the loader carries a payload", !!m);
const recovered = zlib.gunzipSync(Buffer.from(m[1], "base64")).toString("utf8");
ok("the loader calls DecompressionStream", html.includes("DecompressionStream"));
ok("the document that comes back is byte-for-byte the shell that went in", recovered === DOC,
   `chain ${recovered.length} bytes vs dist ${DOC.length} bytes`);
eq("and its keccak is the engineHash the state block carries", kec(Buffer.from(recovered, "utf8")), plan.engineHash);

/*  document.open() clears the document and keeps the Window. Anything the
    loader declares at the top level is therefore still declared while the
    shell is being written in — and the shell is minified, so its own
    top-level names are single letters. The loader must put its payload on
    a property and read it from inside a function.                       */
const loader = html.slice(html.indexOf("<script>self.$INTACT="));
const outside = loader.replace(/\(async\(\)=>\{[\s\S]*\}\)\(\)/, "");
ok("the loader hands the payload over on a property, not a global binding", loader.startsWith('<script>self.$INTACT="'));
ok("and declares nothing at all in global scope", !/\b(?:const|let|var|function|class)\b/.test(outside), outside.slice(0, 160));
ok("the state is a sibling script before the loader, so the Window keeps it across document.open()",
   html.indexOf("<script>window.INTACT=") < html.indexOf("<script>self.$INTACT="));

/*──────────────────── the state block ────────────────────*/
head("the state written into the document");
const st = stateOfHtml(html);
ok("a state block was written into the gap and parses as JSON", !!st);
const S = st.obj;
eq("state.id", S.id, 1);
eq("state.chainId", S.chainId, 1);
eq("state.hub", S.hub.toLowerCase(), site.hub.toLowerCase());
eq("state.reach is account(id)", S.reach.toLowerCase(), reach.toLowerCase());
eq("state.grip is grip(id)", S.grip.toLowerCase(), grip.toLowerCase());
eq("state.owner", S.owner.toLowerCase(), me.toLowerCase());
eq("state.epoch starts at 1", S.epoch, 1);
eq("state.status is Active (0) at mint", S.status, 0);
eq("state.premises", S.premises.toLowerCase(), site.premises.toLowerCase());
eq("state.catalog", S.catalog.toLowerCase(), site.catalog.toLowerCase());
eq("state.pool", S.pool.toLowerCase(), site.pool.toLowerCase());
eq("state.parley", S.parley.toLowerCase(), site.parley.toLowerCase());
eq("state.router is zero on a band with no Router", S.router, ZERO);
eq("state.engineHash", S.engineHash, plan.engineHash);
ok("state.block is the block the call ran at", Number(S.block) > 0);
for (const k of ["clocks", "market", "inbox", "home", "commons", "sel", "err", "topics", "panels", "rights", "bits"]) {
  ok(`state.${k} is present`, S[k] !== undefined);
}

/* the reported bits: a clear bit is "not reported", never zero */
const bits = S.bits;
const rep = (name) => (S.reported & bits[name]) !== 0;
ok("the Reach reported (bit 1)", rep("reach"));
ok("the Pool reported (bit 2) — a closed market is a reported zero, not an absence", rep("pool") && S.market && S.market.open === false);
ok("the Parley reported (bit 4)", rep("parley") && S.home !== null);
ok("the Postage reported (bit 8) — the inbox defaults open and free", rep("postage") && S.inbox && S.inbox.open === true && S.inbox.postage === "0");
ok("the Locks reported (bit 16) — zero locks, as a reported zero", rep("locks") && S.locks === 0);
ok("the Launchpad reported (bit 32)", rep("launchpad") && Array.isArray(S.launches));
ok("the Steward reported (bit 64) — NO_PLAN, as a reported zero", rep("steward") && S.steward === 0);
ok("the Router did NOT report (bit 128) — there is none on this band, and the block says so rather than 0", !rep("router"));
ok("the Market did NOT report (bit 256) — a prediction with no code yet", !rep("market"));
ok("the Roles did NOT report (bit 512)", !rep("roles"));
ok("the KeyRegistry reported (bit 1024) — a zero key id, reported", rep("keys") && S.holderKeyId === "0x" + "00".repeat(32));
ok("the AgentCard did NOT report (bit 4096) — codeless until U17", !rep("agentcard"));
/* and the absent word says which kind of silence each clear bit is */
const abs = (name) => (S.absent & bits[name]) !== 0;
ok("absent: the Router, the Market, the Roles and the AgentCard have no code on this band — 'not deployed', not 'could not be read'",
   abs("router") && abs("market") && abs("roles") && abs("agentcard"));
ok("absent: nothing that reported is marked absent", (S.absent & S.reported) === 0);
ok("the state block carries both words", typeof S.reported === "number" && typeof S.absent === "number");

/* every selector in the block is the keccak of the signature, computed on chain */
const svc = await GET(["services.json"]);
const SV = JSON.parse(svc.body);
ok("/services.json parses", Array.isArray(SV.services) && SV.services.length > 100);
let selBad = 0, selN = 0;
for (const row of SV.services) {
  selN++;
  if (row.selector !== selOf(row.sig)) selBad++;
  const key = row.on + "." + row.name;
  if (S.sel[key] !== row.selector) selBad++;
}
ok(`every one of the ${selN} selectors in services.json and sel is keccak256(sig)[:4] recomputed here`, selBad === 0, `${selBad} disagree`);
eq("sel['hub.mint'] is the hub's mint selector", S.sel["hub.mint"], selOf("mint(address)"));
eq("sel['pool.swapExactIn']", S.sel["pool.swapExactIn"], selOf("swapExactIn(uint256,bool,uint256,uint256,address,uint64)"));
eq("sel['reach.executeAsSession']", S.sel["reach.executeAsSession"], selOf("executeAsSession(address,uint256,bytes)"));
let errBad = 0;
for (const [selector, name] of Object.entries(S.err)) {
  const row = Object.entries(SV.errors).find(([s2]) => s2 === selector);
  if (!row) errBad++;
}
ok(`the err table (${Object.keys(S.err).length} errors) matches services.json's`, errBad === 0);
eq("err maps NotHolder()", S.err[selOf("NotHolder()")], "NotHolder");
eq("err maps Slippage(uint256,uint256)", S.err[selOf("Slippage(uint256,uint256)")], "Slippage");
const SAID = kec(Buffer.from("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)"));
eq("topics.said is keccak of the Said signature", S.topics.said, SAID);
{
  const t = await c.read(site.parley, "topics()");
  eq("and equals the topic Parley itself derives", "0x" + t.slice(2, 66), S.topics.said);
}
eq("topics.transfer", S.topics.transfer, kec(Buffer.from("Transfer(address,address,uint256)")));
for (const name of PANELS) eq(`panels.${name} is the pinned hash`, S.panels[name], manifest.panelHashes[name]);
eq("catalogHash in the gap is the Catalog's immutable", S.catalogHash, await c.read(site.catalog, "catalogHash()"));
eq("and it is the keccak of /services.json's bytes", S.catalogHash, kec(svc.bodyBytes));
ok("services.json names no price and no count, so its hash is a property of the deployment",
   SV.price === undefined && SV.minted === undefined && SV.block === undefined);
ok("services.json carries the walk rule, the door and the band table",
   typeof SV.walk === "string" && SV.door.includes("<key>") && SV.bands.length === 3);
ok("every row names contract, sig, selector, kind, via, args and notes",
   SV.services.every((r) => ["name", "on", "contract", "sig", "selector", "kind", "via", "args", "notes"].every((k) => k in r)));
ok("a tuple argument is one argument, as the ABI sees it",
   SV.services.find((r) => r.name === "create" && r.on === "launchpad").args.length === 1);
ok("the hub rows carry the hub's address, the coin rows carry none",
   SV.services.find((r) => r.on === "hub").contract.toLowerCase() === site.hub.toLowerCase() &&
   SV.services.find((r) => r.on === "coin").contract === ZERO);

/*  The tables are hand-written text in Catalog.sol and the ABIs are what
    the compiler produced: this is where they are held equal. A row whose
    signature no contract serves is calldata the panels build for a
    function that does not exist; an error a contract declares and the
    table lacks is a bare selector where a sentence should be. Both fail
    the build. The first run of this gate found 58 missing errors.      */
head("the catalog cannot drift from the ABIs");
{
  const { artifact: art } = await import("./compile.mjs");
  const find = (name) => { for (const cs of Object.values(out.contracts)) if (cs[name]) return cs[name]; };
  const canon = (t) => t.type.startsWith("tuple") ? "(" + t.components.map(canon).join(",") + ")" + t.type.slice(5) : t.type;
  const sigOf = (f) => `${f.name}(${(f.inputs || []).map(canon).join(",")})`;
  const ON = { hub: "IIntact", pool: "Pool", reach: "Reach", parley: "Parley", roster: "Roster", postage: "Postage", keys: "KeyRegistry",
               kiln: "Kiln", launchpad: "Launchpad", coin: "Coin", locks: "Locks", steward: "Steward", router: "Router",
               erc20: "MockERC20", engine: "Engine", catalog: "Catalog" };
  const fns = {};
  for (const [on, name] of Object.entries(ON)) fns[on] = new Set(find(name).abi.filter((f) => f.type === "function").map(sigOf));
  const unserved = SV.services.filter((r) => !fns[r.on] || !fns[r.on].has(r.sig));
  ok(`every one of the ${SV.services.length} service rows names a function its contract's ABI serves`, unserved.length === 0,
     unserved.map((r) => `${r.on}.${r.sig}`).join(", "));
  const tableErr = new Set(Object.values(SV.errors));
  const errSels = new Set(Object.keys(SV.errors));
  // every error a panel-facing contract can revert with, by selector; two
  // are construction-time and never reach a panel
  const PANEL_FACING = ["CoreFacet", "RightsFacet", "MintFacet", "SiteFacet", "Pool", "Reach", "Grip", "Parley", "Roster", "Postage",
                        "KeyRegistry", "Kiln", "Coin", "Launchpad", "Locks", "Steward", "Router", "IMarket", "IRoles"];
  const CONSTRUCTION_ONLY = new Set(["BadBand()", "WrongRegistry()"]);
  const lacking = new Set();
  for (const name of PANEL_FACING) for (const f of find(name).abi) {
    if (f.type !== "error") continue;
    const sig = sigOf(f);
    if (!CONSTRUCTION_ONLY.has(sig) && !errSels.has(selOf(sig))) lacking.add(`${name}.${sig}`);
  }
  ok(`every error a panel-facing contract declares is in the err table (${errSels.size} entries, ${PANEL_FACING.length} contracts)`, lacking.size === 0, [...lacking].join(", "));
  ok("and every err entry names the error whose selector it is", Object.entries(SV.errors).every(([s2, name]) => {
    return [...PANEL_FACING, "Engine", "Timelock", "IIntact"].some((n) => find(n).abi.some((f) => f.type === "error" && f.name === name && selOf(sigOf(f)) === s2));
  }));
  const eventHashes = new Set();
  for (const cs of Object.values(out.contracts)) for (const c2 of Object.values(cs)) for (const f of c2.abi || []) if (f.type === "event") eventHashes.add(kec(Buffer.from(sigOf(f))));
  ok(`every one of the ${Object.keys(SV.topics).length} topics is the keccak of an event some contract declares`,
     Object.values(SV.topics).every((t) => eventHashes.has(t)));
  void art;
}

/*──────────────────── the equality step ────────────────────*/
head("the two surfaces are one byte-stream");
const live = await GET(["token", "1", "live"]);
eq("/token/1/live is 200", live.status, 200);
eq("served as html", live.header("Content-Type"), "text/html; charset=utf-8");
ok("the two surfaces are one byte-stream: animation_url's bytes equal /token/<id>/live's body", live.body === html,
   `live ${live.body.length} vs tokenURI ${html.length}`);
ok(`/live reads for under ${gas(CAPS.live)} gas`, live.gas <= CAPS.live, gas(live.gas));
ok("the live document carries the service-desc Link", String(live.header("Link")).includes("/token/1/services.json"));
ok("no RPC string, no host of any kind, in the served document: the only network path is the origin that served it",
   !/https?:\/\//i.test(live.body) && !/wss?:\/\//i.test(live.body), (live.body.match(/(?:https?|wss?):\/\/[^"' <]*/i) || [])[0]);
ok("nor in the state block alone", !/https?:\/\//i.test(st.text));
const hashes = JSON.parse((await GET(["token", "1", "hash"])).body);
eq("/token/<id>/hash: document is the keccak of the live body", hashes.document, kec(live.bodyBytes));
eq("/token/<id>/hash: state is the keccak of the state block's bytes", hashes.state, kec(Buffer.from(st.text, "utf8")));
eq("/token/<id>/hash: engine is the engineHash", hashes.engine, plan.engineHash);
eq("/token/<id>/hash: body is the keccak of the gzip shards", hashes.body, kec(Buffer.concat(plan.body.map((s) => Buffer.from(s.data.slice(2), "hex")))));
const sj = await GET(["token", "1", "state.json"]);
eq("/token/<id>/state.json is the same bytes as the block in the document", sj.body, st.text);
eq("served as JSON", sj.header("Content-Type"), "application/json");
const raw = await GET(["token", "1", "raw"]);
eq("/token/<id>/raw is tokenURI itself", raw.body, uri);
const face1 = decString(await c.read(site.hub, "tokenURIAt(uint256,uint8)", [1, 1]));
eq("/token/<id>/face/1 is the crest face", (await GET(["token", "1", "face", "1"])).body, face1);

/*──────────────────── /manifest ────────────────────*/
head("/manifest hashes route templates, not ids, and every hash recomputes");
const man = await GET(["manifest"]);
const M = JSON.parse(man.body);
eq("engineHash", M.engineHash, plan.engineHash);
eq("inflatedSize", M.inflatedSize, plan.inflatedSize);
eq("shardHashes: head, body and panel shards in order", JSON.stringify(M.shardHashes), JSON.stringify(manifest.shardHashes));
eq("panelHashes", JSON.stringify(M.panelHashes), JSON.stringify(manifest.panelHashes));
eq("catalogHash", M.catalogHash, S.catalogHash);
eq("crestCodehash is the Crest's extcodehash", M.crestCodehash, kec(await c.vm.stateManager.getCode((await import("@ethereumjs/util")).createAddressFromString(site.crest))));
ok("routes are templates, and there are sixteen of them, not 4,096", M.routes.length === 16 && M.routes.every((r) => !/\/token\/\d/.test(r.template)));
ok("the templated token routes hash the engine", M.routes.find((r) => r.template === "/token/<id>/live").keccak === plan.engineHash);
ok("the panel route hashes the six panel hashes together",
   M.routes.find((r) => r.template === "/panel/<name>.js").keccak === kec(Buffer.concat(PANELS.map((n) => Buffer.from(manifest.panelHashes[n].slice(2), "hex")))));
ok(`/manifest reads for under ${gas(CAPS.manifest)} gas`, man.gas <= CAPS.manifest, gas(man.gas));

/*──────────────────── panels ────────────────────*/
head("panels are ordinary resources, hash-checked, gzip on the wire");
for (let i = 0; i < PANELS.length; i++) {
  const name = PANELS[i];
  const p = await GET(["panel", name + ".js"]);
  const inflated = zlib.gunzipSync(p.bodyBytes);
  const okAll = p.status === 200 && p.header("Content-Encoding") === "gzip" &&
    p.header("Content-Type") === "text/javascript; charset=utf-8" &&
    p.header("ETag") === `"${manifest.panelHashes[name]}"` &&
    kec(inflated) === manifest.panelHashes[name] &&
    inflated.toString("utf8") === fs.readFileSync(path.join(ROOT, "dist/panels", name + ".js"), "utf8") &&
    p.gas <= CAPS.panel;
  ok(`/panel/${name}.js: 200, gzip, ETag = keccak of the inflated bytes = the state's pin, ${gas(p.gas)}`, okAll,
     `status ${p.status} enc ${p.header("Content-Encoding")} etag ${p.header("ETag")}`);
}
eq("/panel/nope.js is a 404", (await GET(["panel", "nope.js"])).status, 404);

/*──────────────────── the collection ────────────────────*/
head("the collection");
const root = await GET([]);
eq("/ is 200", root.status, 200);
const S0 = stateOfHtml(root.body);
ok("the root serves the collection document with id 0 and the directory", S0 && S0.obj.id === 0 && Array.isArray(S0.obj.open) && S0.obj.minted === 1);
ok("the collection document inflates to the same shell", (() => {
  const mm = root.body.match(/self\.\$INTACT="([A-Za-z0-9+/=]+)";<\/script>/);
  return mm && zlib.gunzipSync(Buffer.from(mm[1], "base64")).toString("utf8") === DOC;
})());
const cURI = decString(await c.read(site.hub, "contractURI()"));
const cMeta = b64json(cURI);
eq("contractURI: name", cMeta.name, "INTACT");
eq("contractURI carries engineHash", cMeta.engineHash, plan.engineHash);
eq("contractURI carries catalogHash", cMeta.catalogHash, S.catalogHash);
ok("contractURI carries the route table and the band map", cMeta.routes.length === 16 && cMeta.bands.length === 3);
ok("contractURI has an image", String(cMeta.image).startsWith("data:image/svg+xml;base64,"));
const scriptURI = decStringArray(await c.read(site.hub, "scriptURI()"), 0);
eq("scriptURI (ERC-5169) is the web3:// origin", scriptURI[0], `web3://${site.premises.toLowerCase()}:1/`);
const open0 = JSON.parse((await GET(["open"])).body);
ok("/open lists no market yet, as an empty page rather than null", Array.isArray(open0.markets) && open0.markets.length === 0 && open0.next === null);
const tm = b64json(decString(await c.read(site.hub, "getTraitMetadataURI()")));
ok("trait metadata names curve, name and the five validateOnSale mirrors",
   ["curve", "name", "custodyEpoch", "sealedUntil", "marketSealedUntil", "fingerprint", "locked"].every((k) => tm.traits[k]));

/*──────────────────── the crest ────────────────────*/
head("the crest, drawn on chain");
const svg = Buffer.from(meta.image.split(",")[1], "base64").toString("utf8");
ok("is an svg", svg.startsWith("<svg"));
ok("is under four kilobytes", Buffer.byteLength(svg) <= 4096, Buffer.byteLength(svg));
ok("names the token", svg.includes("INTACT #1"));
ok("prints the epoch and the status", svg.includes("EPOCH 1 / ACTIVE"));
ok("prints the seal", svg.includes("UNSEALED"));
ok("no raw ampersand or angle bracket lands in character data", !/>[^<]*[&]/.test(svg) && !/<text[^>]*>[^<]*<[^\/]/.test(svg));
eq("/token/<id>/crest.svg is the same drawing", (await GET(["token", "1", "crest.svg"])).body, svg);
eq("served as image/svg+xml", (await GET(["token", "1", "crest.svg"])).header("Content-Type"), "image/svg+xml");
const f1 = b64json(face1);
eq("face 1 is the crest alone", f1.name, "INTACT #1 - The crest");
ok("face 1 carries no animation", f1.animation_url === undefined);
const faces = decStringArray(await c.read(site.hub, "tokenURIs(uint256)", [1]), 1);
eq("three faces", faces.length, 3);
eq("face 2 answers as face 1 until an AgentCard has code", faces[2], faces[1]);

/*──────────────────── standards ────────────────────*/
head("standards: the fifteen ids the hub claims");
const IDS = {
  "ERC-165": "0x01ffc9a7", "ERC-721": "0x80ac58cd", "ERC-721Metadata": "0x5b5e139f",
  "ERC-721Enumerable": "0x780e9d63", "ERC-2981": "0x2a55205a", "ERC-4906": "0x49064906",
  "ERC-4907": "0xad092b5c", "ERC-5192": "0xb45a3c0e", "ERC-6454": "0x91a6262f",
  "ERC-7572": "0xe8a3d485", "ERC-7160": "0x06e1bc5b", "ERC-7496": "0xaf332f3e",
  "ERC-5169": "0xa86517a1", "ERC-5646": "0xf5112315", "ERC-6454 (isTransferable)": "0x91a6262f"
};
for (const [name, iid] of Object.entries(IDS)) {
  const r = await c.call(site.hub, sel("supportsInterface(bytes4)") + iid.slice(2).padEnd(64, "0"));
  ok(`declares ${name}`, decBool(r));
}
const bogus = await c.call(site.hub, sel("supportsInterface(bytes4)") + "ffffffff".padEnd(64, "0"));
ok("refuses 0xffffffff, as ERC-165 requires", !decBool(bogus));
ok("resolveMode() is 5219", (await c.read(site.premises, "resolveMode()")).startsWith("0x35323139"));

/*──────────────────── a hostile symbol ────────────────────*/
head("a coin named </script> cannot end the state block");
{
  const { artifact } = await import("./compile.mjs");
  const coinArt = artifact(out, "test/mocks/MockERC20.sol", "MockERC20");
  const coin = await c.deploy(coinArt.bytecode, encodeParams("string,string,uint8,uint256,bool", ["Hostile", "</script><script>alert(1)</script>", 18, 0, false]), "coin");
  await c.exec(coin, "mint(address,uint256)", [me, 10n ** 24n]);
  await c.exec(coin, "approve(address,uint256)", [site.pool, 10n ** 24n]);
  await c.exec(site.hub, "setTrait(uint256,bytes32,bytes32)", [1, kec(Buffer.from("name")), "0x" + Buffer.from("</script>x").toString("hex").padEnd(64, "0")], { label: "setTrait" });
  await c.exec(site.pool, "openMarket(uint256,address,address,uint16,uint24,uint16,uint32)", [1, coin, ZERO, 30, 0, 0, 0], { label: "openMarket" });
  await c.exec(site.pool, "deposit(uint256,uint256,uint256)", [1, 10n ** 21n, 10n ** 18n], { value: 10n ** 18n, label: "deposit" });
  const live2 = await GET(["token", "1", "live"]);
  const S2 = stateOfHtml(live2.body);
  ok("the state block still parses", !!S2);
  ok("the hostile symbol is in the block, escaped", S2.obj.market.baseSymbol.includes("\\u003c") === false && S2.obj.market.baseSymbol.includes("</script>"));
  ok("the raw bytes of the document carry no </script> inside the state block", !S2.text.includes("</script>"));
  ok("the name trait is escaped the same way", S2.obj.name === "</script>x" && !S2.text.includes("</script>x"));
  ok("the market now reports open with the coin as base", S2.obj.market.open === true && S2.obj.market.base.toLowerCase() === coin.toLowerCase());
  const open1 = JSON.parse((await GET(["open"])).body);
  ok("/open lists the market", open1.markets.length === 1 && open1.markets[0].id === 1);
  const uri2 = decString(await c.read(site.hub, "tokenURI(uint256)", [1]));
  const meta2 = b64json(uri2);
  ok("tokenURI still parses with the hostile name in its attributes", attrOf(meta2, "Name") === "</script>x");
  ok("the Market attribute moved to open", String(attrOf(meta2, "Market")).startsWith("unsealed") || String(attrOf(meta2, "Market")).startsWith("sealed"));
}
function attrOf(m2, k) { return (m2.attributes.find((a) => a.trait_type === k) || {}).value; }

/*──────────────────── a sale ────────────────────*/
head("a sale moves the epoch and pauses the token, and the document says so");
{
  const bob = "0x" + "44".repeat(20);
  await c.exec(site.hub, "transferFrom(address,address,uint256)", [me, bob, 1], { label: "transferFrom" });
  const S3 = stateOfHtml((await GET(["token", "1", "live"])).body).obj;
  eq("epoch is 2", S3.epoch, 2);
  eq("status is Paused (1)", S3.status, 1);
  eq("owner is the buyer", S3.owner.toLowerCase(), bob);
  const meta3 = b64json(decString(await c.read(site.hub, "tokenURI(uint256)", [1])));
  eq("the Status attribute follows", attrOf(meta3, "Status"), "Paused");
  eq("the Custody epoch attribute follows", attrOf(meta3, "Custody epoch"), 2);
  const svg3 = Buffer.from(meta3.image.split(",")[1], "base64").toString("utf8");
  ok("the crest wears a second ring and says PAUSED", svg3.includes("EPOCH 2 / PAUSED") && (svg3.match(/<rect x=/g) || []).length === 2);
}

/*──────────────────── 404s and 301s ────────────────────*/
head("a request for nonsense is a 404 that never echoes the path");
for (const [name, p] of [["a token that does not exist", ["token", "9999"]], ["a path that is not a number", ["token", "abc"]],
  ["a number too long", ["token", "99999999999"]], ["a route nobody defined", ["nonsense"]], ["token with nothing after it", ["token"]],
  ["a leaf nobody defined", ["token", "1", "wat"]], ["face without a number", ["token", "1", "face"]], ["face 9 of 3", ["token", "1", "face", "9"]],
  ["a leading zero", ["token", "01", "live"]], ["an agent route before U17", [".well-known", "agent-card.json"]], ["llms.txt before U17", ["llms.txt"]]]) {
  let r = null;
  try { r = await GET(p); } catch { /* a revert is the failure */ }
  const echoed = r && p.some((seg) => seg.length > 2 && r.body.includes(seg));
  ok(name, r !== null && r.status === 404 && !echoed, r === null ? "it reverted" : `status ${r.status}${echoed ? ", echoed" : ""}`);
}
const moved = await GET(["token", "1"]);
ok("/token/<id> is a 301 to the console", moved.status === 301 && moved.header("Location") === "/token/1/live");
const door = await GET(["k", "1", "0xABCDEF0123456789abcdef0123456789ABCDEF01"]);
ok("/k/<id>/<key> is a 301 into session mode with the key lower-cased",
   door.status === 301 && door.header("Location") === "/token/1/live?as=0xabcdef0123456789abcdef0123456789abcdef01");
eq("/c/<id> is a 301 to the console", (await GET(["c", "1"])).header("Location"), "/token/1/live");
eq("a trailing slash is dropped, not 404ed", (await GET(["token", "1", "live", ""])).status, 200);

/*──────────────────── artefacts ────────────────────*/
head("artefacts");
fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "dist/token-1.html"), live.body);
fs.writeFileSync(path.join(ROOT, "dist/token-1.json"), JSON.stringify(meta, null, 1));
fs.writeFileSync(path.join(ROOT, "dist/crest-1.svg"), svg);
fs.writeFileSync(path.join(ROOT, "dist/services.json"), svc.body);
fs.writeFileSync(path.join(ROOT, "dist/state-1.json"), st.text);
console.log("      dist/token-1.html   the document exactly as /token/1/live served it");
console.log("      dist/token-1.json   the metadata; dist/crest-1.svg the still; dist/services.json; dist/state-1.json");

head("gas, measured");
for (const [k, v] of Object.entries(c.gas)) if (["Engine", "Catalog", "CatalogRows", "CatalogText", "CatalogState", "Renderer", "Premises", "IntactDiamond", "mint", "loadHead", "loadBody", "loadPanel"].includes(k)) console.log(`      ${k.padEnd(20)} ${gas(v).padStart(8)}`);
console.log(`      ${"tokenURI".padEnd(20)} ${gas(uriGas).padStart(8)}   (cap ${gas(CAPS.tokenURI)})`);
console.log(`      ${"/token/1/live".padEnd(20)} ${gas(live.gas).padStart(8)}   (cap ${gas(CAPS.live)})`);
console.log(`      ${"/manifest".padEnd(20)} ${gas(man.gas).padStart(8)}   (cap ${gas(CAPS.manifest)})`);
console.log(`      ${"/services.json".padEnd(20)} ${gas(svc.gas).padStart(8)}`);

console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail ? 1 : 0);
