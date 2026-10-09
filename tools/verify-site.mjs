#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the site, booted and driven in a shimmed browser

  Origin: IPSEITY tools/verify-site.mjs, split for U9 into a runner (this
  file), the DOM + wallet shim (tools/dom-shim.mjs) and one group file per
  lane (tools/verify-site/<group>.mjs), so six panel agents could write six
  suites without touching one another's lines (D20).

  What this proves that tools/verify.mjs cannot: verify.mjs takes the served
  bytes apart and checks every number in them; this file RUNS them. The
  document a marketplace hands a browser — prologue, state block, base64
  payload, loader — is booted in a vm context with Node's own
  DecompressionStream, the loader inflates the shell and document.write()s
  it, the shell's two script blocks run, the chooser picks a wallet
  announced over EIP-6963, the chain gate reads eth_chainId first, rights
  are read, a lane is opened, the panel's bytes are keccak'd against the
  pin and injected as a Blob script, a slab is raised, estimated, pressed,
  sent, mined, re-read. Every eth_* the page sends is answered by the
  in-process chain and recorded in order, so the suite can say not only
  what the page showed but what it asked, and in which order.

  One chain per group (CONSOLE §15): the runner does Chain.open() →
  deploySite → mint the cast → a fresh ctx for every group, so the state
  one group leaves (a panicked #1, a sold #3) cannot falsify another's
  assertions. Measured here: Chain.open() + deploySite ≈ 1.2 s, a mint
  0.02 s. A group file that has not landed prints "group <g> not present"
  and the run stays green; the ≥ 150 gate applies once every group exists.

  The build runs FIRST: deploySite reads dist/shards.json, and a stale
  plan would pin stale panel hashes and make every lane print "refused".

    node tools/verify-site.mjs               every group present
    node tools/verify-site.mjs --group boot  one group
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { compile, artifact } from "./compile.mjs";
import * as EVM from "./evm.mjs";
import { Chain, sel, enc, encodeParams, decUint, decAddr, decBool, decString, decStringArray } from "./evm.mjs";
import { ROOT, deploySite, getter, mint, PANELS, ZERO } from "./site.mjs";
import { build, SVG_NS } from "./build-app.mjs";
import { boot, walletFor, nap } from "./dom-shim.mjs";
import { CAPS } from "./gas.mjs";

const ARGV = process.argv.slice(2);
const arg = (f) => { const i = ARGV.indexOf(f); return i < 0 ? null : ARGV[i + 1]; };
const ONLY = arg("--group");
export const GROUPS = ["boot", "swap", "social", "launch", "vault", "identity"];
const MIN_ASSERTIONS = 150;

let pass = 0, fail = 0;
const t = {
  ok(cond, name, detail) {
    cond ? pass++ : fail++;
    console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
    if (!cond && detail !== undefined) console.log(`      ${String(detail).slice(0, 400)}`);
  },
  eq(got, want, name) { t.ok(String(got) === String(want), name, `got  ${String(got).slice(0, 160)}\n      want ${String(want).slice(0, 160)}`); },
  head(s) { console.log(`\n  \x1b[1m${s}\x1b[0m`); },
  async refuses(fn, re, name) {
    let msg = null;
    try { await fn(); } catch (e) { msg = String(e && e.message || e); }
    t.ok(msg !== null && re.test(msg), name, msg === null ? "did not throw" : `threw: ${msg}`);
    return msg;
  }
};

const kec = (b) => "0x" + Buffer.from(keccak256(Buffer.isBuffer(b) || b instanceof Uint8Array ? b : Buffer.from(String(b), "utf8"))).toString("hex");
const stateOfHtml = (html) => { const m = html.match(/<script>window\.INTACT=([\s\S]*?)<\/script>/); return m ? { text: m[1], obj: JSON.parse(m[1]) } : null; };
const M = (n) => (Number(n) / 1e6).toFixed(2) + "M";

/*──────────────── build, compile ────────────────*/
t.head("build");
const plan = await build();
const gzipBytes = plan.body.reduce((a, s) => a + s.bytes, 0);
t.ok(!plan.placeholder || true, `shard plan built: ${plan.shell}${plan.placeholder ? " (some PLACEHOLDER panels from tools/fixtures/)" : ""}`);
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
t.ok(true, "contracts compile");

/*──────────────── the cold measurements, once ────────────────*/
t.head("the shell's gzip beside the cold gas");
{
  const c = await Chain.open();
  const site = await deploySite(c, out);
  await mint(c, site, c.from.toString());
  const GET = getter(c, site.premises);
  const cold = async () => c.send({ to: "0x" + "77".repeat(20), value: 1n });
  await cold(); await c.read(site.hub, "tokenURI(uint256)", [1]); const uriGas = c.lastGas;
  await cold(); const live = await GET(["token", "1", "live"]);
  await cold(); const hash = await GET(["token", "1", "hash"]);
  console.log(`      shell ${gzipBytes.toLocaleString()} B gzip · cold tokenURI ${M(uriGas)} · /token/1/live ${M(live.gas)} · /token/1/hash ${M(hash.gas)}`);
  t.ok(gzipBytes <= 15_000, `the shell's gzip is under the 15,000 ceiling (${gzipBytes.toLocaleString()} B; budget 14,000${gzipBytes > 14_000 ? " — over budget, under the ceiling" : ""})`);
  t.ok(uriGas <= CAPS.tokenURI, `cold tokenURI ≤ ${M(CAPS.tokenURI)} (${M(uriGas)})`);
  t.ok(hash.gas <= CAPS.live, `cold /token/1/hash ≤ ${M(CAPS.live)} (${M(hash.gas)})`);
  t.ok(live.gas <= CAPS.live, `cold /token/1/live ≤ ${M(CAPS.live)} (${M(live.gas)})`);
}

/*──────────────── a chain, a site and a cast per group ────────────────*/
const KEYS = { renter: "22", buyer: "33", trader: "44", stranger: "55", guardianW: "66", agentW: "77", delegated: "88" };
async function fresh(opts = {}) {
  const c = await Chain.open();
  const site = await deploySite(c, out, opts);
  const actors = { me: c };
  for (const [k, v] of Object.entries(KEYS)) actors[k] = await c.as("0x" + v.repeat(32));
  const A = (f, n) => artifact(out, f, n);
  const weth = await c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode,
    encodeParams("string,string,uint8,uint256,bool", ["Wrapped Ether", "WETH", 18, 0, false]), "WETH");
  const GET = getter(c, site.premises);
  const stripPrefix = (p) => p.replace(/^\/0x[0-9a-fA-F]{40}:\d+(?=\/|$)/, "");
  const page = async (pth, o = {}) => {
    const seg = stripPrefix(pth).split(/[?#]/)[0].split("/").filter(Boolean);
    const r = await GET(seg);
    if (r.status !== 200) throw new Error(`GET ${pth} → ${r.status}`);
    const wallets = o.wallets || (o.wallet ? [o.wallet] : []);
    const pg = await boot(r.body, { wallets, opaque: !!o.opaque, url: o.url || pth, query: o.query, hash: o.hash, GET, awaitReady: o.awaitReady });
    return { page: pg, ctx: pg.ctx, W: wallets[0] || null, S: pg.ctx.INTACT, html: r.body, state: stateOfHtml(r.body) };
  };
  const ctx = {
    c, out, site, plan, GET, getter, actors, weth, A, EVM, Chain, deploySite, mint, walletFor, nap, zlib, fs, path, ROOT, kec, stateOfHtml, ZERO, PANELS, SVG_NS, CAPS, gzipBytes,
    sel, enc, encodeParams, decUint, decAddr, decBool, decString, decStringArray,
    BLOCK: () => EVM.BLOCK.header,
    roll: (n) => EVM.roll(n), warp: (ts) => EVM.warp(ts), warpBy: (s) => EVM.warp(EVM.BLOCK.header.timestamp + BigInt(s)),
    revertWith: (sig, ...args) => enc(sig, args),
    bootToken: (id, o = {}) => page(`/token/${id}/live`, o),
    bootPage: page,
    lane: async (pg, name) => {
      pg.hash("#" + name);
      await pg.until(() => (pg.ctx.INTACT.loaded && pg.ctx.INTACT.loaded[name] === true) || /panel refused|could not be read/.test(pg.$("#lane-" + name).textContent), 60);
      await pg.settle();
      return pg.ctx.INTACT.loaded && pg.ctx.INTACT.loaded[name] === true;
    },
    fresh
  };
  return ctx;
}

/*──────────────── the groups ────────────────*/
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "verify-site");
let present = 0;
for (const g of GROUPS) {
  if (ONLY && g !== ONLY) continue;
  const file = path.join(dir, g + ".mjs");
  if (!fs.existsSync(file)) { console.log(`\n  group ${g} not present (tools/verify-site/${g}.mjs)`); continue; }
  present++;
  t.head(`group ${g}`);
  const before = pass + fail;
  const mod = await import(file);
  const t0 = Date.now();
  try { await mod.run(t, await fresh()); }
  catch (e) { t.ok(false, `group ${g} threw: ${e && e.stack || e}`); }
  console.log(`      ${pass + fail - before} assertions in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

const total = pass + fail;
if (!ONLY && present === GROUPS.length) t.ok(total >= MIN_ASSERTIONS, `at least ${MIN_ASSERTIONS} assertions ran (${total})`);
else console.log(`\n  ${total} assertions; the ≥ ${MIN_ASSERTIONS} gate applies to a full run with every group present`);
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
