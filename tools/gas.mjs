#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the gas budget, measured against the caps that actually exist

  Origin: IPSEITY tools/gas.mjs, re-capped. A view function costs nobody
  any ether, which is exactly why it is easy to write one nobody can call:
  `eth_call` is executed by a node, and every node puts a ceiling on how
  much work it will do for a call it is not being paid for — and on a
  Fusaka chain (EIP-7825) no call can use more than 2^24 anyway. Past the
  ceiling the call does not return an error about gas; it returns "out of
  gas", which reads to a marketplace as a broken token.

  The caps (DESIGN.md §5.5), build-failing:

      tokenURI(id)          8,000,000   derived from 192 gas/byte at ≈ 34 KB
      /token/<id>/live      2,500,000   ≈ 82 gas/byte at ≈ 22 KB, no base64
      /panel/*.js           1,000,000
      /manifest             3,000,000
      every other view     16,777,216   the EIP-7825 transaction cap
      nothing, anywhere    50,000,000   geth / erigon / reth --rpc.gascap

  Two halves: every argument-free view of every argument-free contract
  (a sweep that catches a view before a unit remembers to list it), and
  the routes — the whole MVB deployed from dist/ by tools/site.mjs, every
  row of DESIGN §5.3 probed with its own cap (U7).

    node tools/gas.mjs              measure; non-zero if anything is over its cap
    node tools/gas.mjs --json       machine-readable
    node tools/gas.mjs --fixture    include test/mocks/GasHog.hog(400000) as a probe (must fail)
    node tools/gas.mjs --selftest   assert that --fixture fails
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { createAddressFromString, hexToBytes } from "@ethereumjs/util";
import { compile, artifact, isLibrary, ROOT } from "./compile.mjs";
import * as EVM from "./evm.mjs";
import { Chain, enc } from "./evm.mjs";

export const CAPS = {
  tokenURI: 8_000_000n,
  live: 2_500_000n,
  panel: 1_000_000n,
  manifest: 3_000_000n,
  any: 16_777_216n,
  hard: 50_000_000n
};

const JSON_OUT = process.argv.includes("--json");
const FIXTURE = process.argv.includes("--fixture") || process.argv.includes("--selftest");
const SELFTEST = process.argv.includes("--selftest");
const M = (n) => (Number(n) / 1e6).toFixed(2) + "M";

/*  Gas is measured on the call itself, not on a transaction wrapping it,
    because eth_call is what a wallet issues — no 21,000 intrinsic cost, no
    calldata pricing, just the execution. The limit handed to the EVM is
    far above every cap so the measurement is of the work, not of the
    limit.                                                                */
export async function measure(chain, to, data) {
  const res = await chain.vm.evm.runCall({
    to: createAddressFromString(to),
    caller: createAddressFromString(chain.from.toString()),
    origin: createAddressFromString(chain.from.toString()),
    data: hexToBytes(data), gasLimit: 3_000_000_000n, value: 0n,
    block: EVM.BLOCK
  });
  if (res.execResult.exceptionError) {
    return { gas: null, bytes: 0, err: res.execResult.exceptionError.error };
  }
  return { gas: res.execResult.executionGasUsed, bytes: (res.execResult.returnValue || new Uint8Array()).length };
}

/// A probe: { label, note, cap, to, data }. `cap` is a key of CAPS.
export function verdict(row) {
  const capValue = CAPS[row.cap] ?? CAPS.any;
  if (row.gas === null) return { over: false, capValue };
  return { over: row.gas > capValue || row.gas > CAPS.hard, capValue };
}

/*──────────────── the probes ────────────────*/
async function buildProbes(chain, out) {
  const probes = [];

  /*  Every deployable in src/ with an argument-free constructor: deploy it
      and probe every zero-argument view. This is the sweep that catches a
      satellite's directory view or a renderer's collection page before a
      unit remembers to list it. Contracts whose constructors take
      arguments are reached through the named probes below.             */
  for (const [file, cs] of Object.entries(out.contracts)) {
    if (!file.startsWith("src/")) continue;
    for (const [name, c] of Object.entries(cs)) {
      const deployed = c.evm.deployedBytecode.object;
      if (!deployed.length || isLibrary(deployed)) continue;
      const ctor = c.abi.find((e) => e.type === "constructor");
      if (ctor && ctor.inputs.length) continue;
      let at;
      try { at = await chain.deploy("0x" + c.evm.bytecode.object, "", name); } catch { continue; }
      for (const f of c.abi) {
        if (f.type !== "function" || f.inputs.length) continue;
        if (!["view", "pure"].includes(f.stateMutability)) continue;
        probes.push({ label: `${name}.${f.name}()`, note: file, cap: "any", to: at, data: enc(`${f.name}()`, []) });
      }
    }
  }

  /*  The routes (U7). The whole MVB is deployed by tools/site.mjs from
      dist/ — run `npm run build` first — and every route of DESIGN §5.3
      is probed with the cap its row names; the hub's faces and the
      Catalog's documents beside them. Without a dist/ this half is
      skipped and says so, so the sweep above still runs alone.         */
  if (fs.existsSync(path.join(ROOT, "dist/shards.json"))) {
    const { deploySite, mint, encRequest } = await import("./site.mjs");
    const site = await deploySite(chain, out);
    const { id } = await mint(chain, site);
    const route = (resource, cap, note) => probes.push({
      label: "/" + resource.join("/"), note: note || "Premises.request", cap, to: site.premises, data: encRequest(resource) });
    const view = (label, to, sig, args, cap, note) => probes.push({ label, note: note || "", cap, to, data: enc(sig, args) });
    const i = String(id);
    view(`hub.tokenURI(${i})`, site.hub, "tokenURI(uint256)", [id], "tokenURI", "face 0: the whole document, base64 twice");
    view(`hub.tokenURIAt(${i},1)`, site.hub, "tokenURIAt(uint256,uint8)", [id, 1], "any", "face 1: the crest alone");
    view(`hub.tokenURIs(${i})`, site.hub, "tokenURIs(uint256)", [id], "any", "every face at once");
    view("hub.contractURI()", site.hub, "contractURI()", [], "any");
    view(`hub.getStateFingerprint(${i})`, site.hub, "getStateFingerprint(uint256)", [id], "any");
    route([], "live", "the collection document");
    route(["token", i, "live"], "live", "the console, on a real origin");
    route(["token", i, "raw"], "tokenURI");
    route(["token", i, "face", "1"], "any");
    route(["token", i, "crest.svg"], "any");
    route(["token", i, "state.json"], "any");
    route(["token", i, "hash"], "live");
    route(["token", i, "services.json"], "any");
    for (const name of ["swap", "social", "launch", "vault", "identity", "agent"]) route(["panel", name + ".js"], "panel");
    route(["services.json"], "any");
    route(["open"], "any");
    route(["manifest"], "manifest");
    route(["k", i, "0x" + "ab".repeat(20)], "any", "a 301");
    route(["nonsense"], "any", "a 404");
    view(`catalog.state(${i})`, site.catalog, "state(uint256)", [id], "any", "the state block");
    view("catalog.state(0)", site.catalog, "state(uint256)", [0], "any", "the collection's block");
    view(`catalog.stateOf(${i})`, site.catalog, "stateOf(uint256)", [id], "any", "the gather");
    view("catalog.services()", site.catalog, "services()", [], "any");
    view("catalog.agrees()", site.catalog, "agrees()", [], "any");
    view(`renderer.document(${i})`, site.renderer, "document(uint256)", [id], "live");
    view(`crest.svg(${i},1,0,0)`, site.crest, "svg(uint256,uint64,uint8,uint64)", [id, 1, 0, 0], "any");
  } else if (!JSON_OUT) {
    console.log("      \x1b[2mno dist/shards.json — run `npm run build` to probe the routes; the argument-free sweep ran alone\x1b[0m");
  }

  if (FIXTURE) {
    const hog = artifact(out, "test/mocks/GasHog.sol", "GasHog");
    const at = await chain.deploy(hog.bytecode, "", "GasHog");
    probes.push({ label: "GasHog.hog(400000)", note: "the fixture: a view over 2^24 — must be reported over its cap",
                  cap: "any", to: at, data: enc("hog(uint256)", [400_000]) });
    probes.push({ label: "GasHog.cheap()", note: "the fixture's control", cap: "any", to: at, data: enc("cheap()", []) });
  }
  return probes;
}

/*──────────────── run ────────────────*/
if (import.meta.url !== `file://${process.argv[1]}`) {
  // imported for CAPS only (tools/verify.mjs); the measurement runs from the CLI
} else {
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const chain = await Chain.open();
const probes = await buildProbes(chain, out);
/* a route's return is ABI-encoded (status, body, headers): the bytes column
   is the body for a route, the raw return for a view */

const rows = [];
for (const p of probes) {
  const r = await measure(chain, p.to, p.data);
  rows.push({ ...p, ...r, ...verdict({ ...p, ...r }) });
}
const over = rows.filter((r) => r.over);

if (SELFTEST) {
  const hog = rows.find((r) => r.label.startsWith("GasHog.hog"));
  const cheap = rows.find((r) => r.label === "GasHog.cheap()");
  const ok = hog && hog.gas !== null && hog.over && cheap && !cheap.over;
  console.log(ok
    ? `\n  \x1b[32mgas.mjs self-test: the fixture (${M(hog.gas)}) is over the ${M(CAPS.any)} cap and would fail the build; the control passes\x1b[0m\n`
    : `\n  \x1b[31mgas.mjs self-test failed: ${hog ? `hog gas=${hog.gas} over=${hog.over}` : "no hog row"}; ${cheap ? `cheap over=${cheap.over}` : "no control row"}\x1b[0m\n`);
  process.exit(ok ? 0 : 1);
}

if (JSON_OUT) {
  console.log(JSON.stringify({
    caps: Object.fromEntries(Object.entries(CAPS).map(([k, v]) => [k, String(v)])),
    rows: rows.map((r) => ({ label: r.label, cap: r.cap, gas: r.gas === null ? null : String(r.gas), bytes: r.bytes, over: r.over, err: r.err || null })),
    over: over.map((r) => r.label)
  }, null, 2));
} else {
  console.log("\n  \x1b[1mINTACT · the gas budget\x1b[0m\n");
  console.log("      \x1b[2m" + "call".padEnd(40) + "gas".padStart(9) + "  returned".padStart(11) + "   cap\x1b[0m");
  if (!rows.length) console.log("      \x1b[2mnothing deployable to measure yet — the probe table fills as units land\x1b[0m");
  for (const r of rows) {
    if (r.gas === null) { console.log(`      ${r.label.padEnd(40)}${"reverted".padStart(9)}  ${r.err}`); continue; }
    const colour = r.over ? "\x1b[31m" : r.gas > r.capValue / 2n ? "\x1b[33m" : "\x1b[32m";
    console.log(`      ${r.label.padEnd(40)}${colour}${M(r.gas).padStart(9)}\x1b[0m  ${(r.bytes.toLocaleString() + " B").padStart(9)}   \x1b[2m${r.cap} ≤ ${M(r.capValue)}\x1b[0m`);
  }
  console.log("\n  \x1b[1mverdict\x1b[0m");
  if (!over.length) {
    console.log(`      \x1b[32mevery measured view is under its cap\x1b[0m (${rows.length} probed; every view ≤ ${M(CAPS.any)}, tokenURI ≤ ${M(CAPS.tokenURI)}, /live ≤ ${M(CAPS.live)})`);
  } else {
    for (const r of over) console.log(`      \x1b[31m${r.label} needs ${M(r.gas)}\x1b[0m, over its ${M(r.capValue)} cap.`);
    console.log(`\n      \x1b[2mA call over the cap does not fail politely. The node returns "out of gas"` +
                `\n      and the caller cannot tell that from a broken contract.\x1b[0m`);
  }
  console.log("");
}
process.exit(over.length ? 1 : 0);
}
