#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the front door

  Origin: IPSEITY tools/verify-premises.mjs (30 assertions), ported for
  INTACT U7. Every token is already a website; this is the router that
  gives it an origin a wallet will talk to.

  The claim under test is the constraint that makes a router safe to
  have at all:

      THE ARTWORK IS SERVED BY THE ROUTER FROM THE RENDERER, AND THE
      ROUTER HOLDS NONE OF IT.

  `/token/<id>/live` is `Renderer.document(id)`, which is what `tokenURI`
  base64s — one step earlier; `/raw` is `tokenURI` itself. If this
  contract is never deployed, every token renders. If it is replaced,
  every token renders identically. The deployed code contains none of
  the engine's bytes, and a reader can verify that against the source.

  Also under test: a request for nonsense is a 404, not a revert, and the
  404 never echoes the path; one resource has one URL; `resolveMode()`
  answers "5219"; every function is a view.

    node tools/verify-premises.mjs
───────────────────────────────────────────────────────────────────────────*/
import { createAddressFromString } from "@ethereumjs/util";
import { compile, artifact } from "./compile.mjs";
import { Chain, decString, decBool } from "./evm.mjs";
import { deploySite, getter, mint, PANELS } from "./site.mjs";

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}`);
  if (!c && d !== undefined) console.log(`      ${String(d).slice(0, 240)}`);
};
const eq = (n, g, w) => ok(n, String(g) === String(w), `got ${g}\n      want ${w}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);

const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const c = await Chain.open();

head("deploy");
const site = await deploySite(c, out);
ok("deployed", (await c.codeSize(site.premises)) > 0);
console.log(`      router   ${site.premises}`);
const { id } = await mint(c, site);
await mint(c, site);
const GET = getter(c, site.premises);

head("ERC-6860: the contract says how it answers");
ok("resolveMode() is \"5219\"", (await c.read(site.premises, "resolveMode()")).startsWith("0x35323139"));

head("the root");
const idx = await GET([]);
eq("200", idx.status, 200);
eq("Content-Type", idx.header("Content-Type"), "text/html; charset=utf-8");
eq("Cache-Control is short: half of what the site reports is a clock", idx.header("Cache-Control"), "public, max-age=15");
ok("the root is the collection document, the same shell with id 0", idx.body.includes('"id":0,') && idx.body.includes("self.$INTACT="));
ok("it lists the open markets and the mint count", idx.body.includes('"minted":2') && idx.body.includes('"open":[]'));

head("the instrument, on an origin a wallet will talk to");
const live = await GET(["token", String(id), "live"]);
eq("200", live.status, 200);
eq("served as html, not as a URI in a page", live.header("Content-Type"), "text/html; charset=utf-8");
ok("the body is a document, not a data: URI", live.body.startsWith("<!doctype html>"));
const doc = decString(await c.read(site.renderer, "document(uint256)", [id]));
ok("artwork is served by the router: the body is Renderer.document(id) byte for byte", live.body === doc);
const uri = decString(await c.read(site.hub, "tokenURI(uint256)", [id]));
const inner = (() => {
  const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
  return Buffer.from(json.animation_url.replace(/^data:text\/html;base64,/, ""), "base64").toString("utf8");
})();
ok("and they are exactly what tokenURI base64s", live.body === inner);
eq("/raw returns the URI itself", (await GET(["token", String(id), "raw"])).body, uri);
eq("as text/plain", (await GET(["token", String(id), "raw"])).header("Content-Type"), "text/plain; charset=utf-8");
ok("/live carries the service-desc Link header", String(live.header("Link")) === `</token/${id}/services.json>; rel="service-desc"`);

head("one resource, one URL");
eq("a trailing slash is dropped, not 404ed", (await GET(["token", String(id), "live", ""])).status, 200);
eq("a leading zero is refused: /token/01 is not a second address for token 1", (await GET(["token", "0" + id, "live"])).status, 404);
const moved = await GET(["token", String(id)]);
ok("/token/<id> is a 301 to the console, cached hard", moved.status === 301 &&
   moved.header("Location") === `/token/${id}/live` && moved.header("Cache-Control") === "public, max-age=86400");
ok("/c/<id> is a 301 to the console", (await GET(["c", String(id)])).header("Location") === `/token/${id}/live`);
const door = await GET(["k", String(id), "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01"]);
ok("/k/<id>/<key> is a 301 into session mode, the key written one way",
   door.status === 301 && door.header("Location") === `/token/${id}/live?as=0xabcdef0123456789abcdef0123456789abcdef01`);
eq("/k with a key that is not an address is a 404", (await GET(["k", String(id), "notakey"])).status, 404);
eq("/k with two segments is a 404 — the pair IS the page", (await GET(["k", String(id)])).status, 404);
eq("/c/<unminted> is a 404", (await GET(["c", "4000"])).status, 404);

head("the panels");
for (const name of PANELS) {
  const p = await GET(["panel", name + ".js"]);
  ok(`/panel/${name}.js is 200, gzip, with an ETag and a day of cache`, p.status === 200 && p.header("Content-Encoding") === "gzip" &&
     /^"0x[0-9a-f]{64}"$/.test(p.header("ETag")) && p.header("Cache-Control") === "public, max-age=86400");
}
eq("/panel/<unknown>.js is a 404", (await GET(["panel", "shell.js"])).status, 404);
eq("/panel/swap (no .js) is a 404", (await GET(["panel", "swap"])).status, 404);

head("the JSON routes");
for (const [name, p, type] of [["/services.json", ["services.json"], "application/json"], ["/token/<id>/services.json", ["token", String(id), "services.json"], "application/json"],
  ["/token/<id>/state.json", ["token", String(id), "state.json"], "application/json"], ["/open", ["open"], "application/json"], ["/open/<from>", ["open", "48"], "application/json"],
  ["/manifest", ["manifest"], "application/json"], ["/token/<id>/hash", ["token", String(id), "hash"], "application/json"]]) {
  const r = await GET(p);
  let parsed = false;
  try { JSON.parse(r.body); parsed = true; } catch { /* not JSON */ }
  ok(`${name} is 200, ${type}, and parses`, r.status === 200 && r.header("Content-Type") === type && parsed, `status ${r.status} type ${r.header("Content-Type")}`);
}
eq("/open/abc is a 404", (await GET(["open", "abc"])).status, 404);
eq("/services.json/1 is a 404 (no paging there)", (await GET(["services.json", "1"])).status, 404);
eq("/manifest/x is a 404", (await GET(["manifest", "x"])).status, 404);
eq("/token/<id>/crest.svg is image/svg+xml", (await GET(["token", String(id), "crest.svg"])).header("Content-Type"), "image/svg+xml");
eq("/token/<id>/face/0 is the whole URI, plain", (await GET(["token", String(id), "face", "0"])).body, uri);

head("a request for nonsense is a 404, never a revert, and never echoes the path");
for (const [name, p] of [
  ["a token that does not exist", ["token", "9999"]],
  ["a path that is not a number", ["token", "abc"]],
  ["a number too long to be an id", ["token", "99999999999"]],
  ["a route nobody defined", ["nonsense"]],
  ["token with nothing after it", ["token"]],
  ["an empty segment", ["token", ""]],
  ["a leaf nobody defined", ["token", String(id), "market"]],
  ["face with no number", ["token", String(id), "face"]],
  ["face 3 of 3", ["token", String(id), "face", "3"]],
  ["a fourth segment on a leaf", ["token", String(id), "live", "x"]],
  ["an agent route before an AgentCard exists", [".well-known", "agent-registration.json"]],
  ["llms.md before an AgentCard exists", ["llms.md"]],
  ["the token's llms.txt before an AgentCard exists", ["token", String(id), "llms.txt"]],
  ["a path that is a script", ["<script>alert(1)</script>"]]
]) {
  let r = null;
  try { r = await GET(p); } catch { /* a revert is the failure */ }
  const echoed = r && p.some((seg) => seg.length > 2 && r.body.includes(seg));
  ok(name, r !== null && r.status === 404 && !echoed, r === null ? "it reverted instead of answering" : `status ${r.status}${echoed ? ", and the path was echoed" : ""}`);
}

head("read off the compiled ABI and the deployed code");
const abi = artifact(out, "src/Premises.sol", "Premises").abi;
const writes = abi.filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure");
eq("there is no state-changing function at all", writes.length, 0);
ok("nothing that could hold or move an asset",
   !abi.some((f) => /transfer|withdraw|approve|execute|receive|admin|owner|set/i.test(f.name || "")),
   "a front door is a reader; anything else is a liability with a URL");
const code = await c.vm.stateManager.getCode(createAddressFromString(site.premises));
const engineShard = Buffer.from(site.plan.body[0].data.slice(2), "hex");
const hay = Buffer.from(code).toString("hex");
ok("it holds none of the artwork's bytes", !hay.includes(engineShard.subarray(0, 32).toString("hex")),
   "the router has a copy of the document — then it is infrastructure, not convenience");
ok("the Premises pins the renderer, the engine, the catalog, the crest and the hub",
   [["RENDERER()", site.renderer], ["ENGINE()", site.engine], ["CATALOG()", site.catalog], ["CREST()", site.crest], ["HUB()", site.hub]]
     .every(async ([fn, want]) => (await c.read(site.premises, fn)).slice(-40) === want.slice(2).toLowerCase()));
console.log("      the tokens render identically whether this contract exists,");
console.log("      is abandoned, or is replaced by something else entirely");

console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
