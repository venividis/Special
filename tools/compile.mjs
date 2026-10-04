#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  Compile every contract in src/ with solc-js and report deployed sizes
  against the EIP-170 ceiling.

    node tools/compile.mjs            compile, report, write out/
    node tools/compile.mjs --quiet    exit code only
    node tools/compile.mjs --ship     also print and record the ship rule

  Origin: IPSEITY tools/compile.mjs. INTACT (U0) adds three things:

    · `metadata.bytecodeHash: "none"`, so the runtime bytes carry no CBOR
      metadata hash and a contract's codehash is a function of its source
      and compiler alone. Every codehash this protocol pins — the Router's
      venues, the facets in the deployment record, the Reach implementation
      in /manifest, the 173-byte forwarder — has to be reproducible from a
      checkout, and an IPFS hash of the metadata JSON (which embeds absolute
      source paths) is not;
    · a single-entry MEASURED list, ["Intact"]: the monolith is built and
      measured on every run but is not hard-gated at 24,576, because the
      ship rule (DESIGN.md §0) decides between it and the diamond by its
      measured size rather than failing the build. Every other contract is
      hard-gated;
    · `--ship`: prints which build ships (monolith if Intact ≤ 24,000 B,
      else diamond) and writes out/ship.json for tools/deploy.mjs.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const solc = require("solc");

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUIET = process.argv.includes("--quiet");
const SHIP = process.argv.includes("--ship");

/// @dev EIP-170: the ceiling every deployable must fit under, on every band.
export const LIMIT = 24_576;
/// @dev DESIGN.md §0 ship rule: the monolith ships at or under this.
export const SHIP_THRESHOLD = 24_000;
/// @dev Contracts measured but not hard-gated: the monolith, whose size is a
///      decision input rather than a build failure. Single entry, on purpose.
export const MEASURED = ["Intact"];

function sources(dir, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (e.name.endsWith(".sol")) {
      out[path.relative(ROOT, p)] = { content: fs.readFileSync(p, "utf8") };
    }
  }
  return out;
}

export function compile({ quiet = false, dirs = ["src"] } = {}) {
  const input = {
    language: "Solidity",
    sources: dirs.reduce((a, d) => Object.assign(a, sources(path.join(ROOT, d))), {}),
    settings: {
      optimizer: { enabled: true, runs: 800 },
      viaIR: true,
      evmVersion: "cancun",
      metadata: { bytecodeHash: "none" },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } }
    }
  };

  /* remappings.txt, honoured the same way forge honours it, so a path that
     resolves for `forge build` resolves here too */
  const remaps = fs.existsSync(path.join(ROOT, "remappings.txt"))
    ? fs.readFileSync(path.join(ROOT, "remappings.txt"), "utf8")
        .split("\n").map((l) => l.trim()).filter((l) => l.includes("="))
        .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
    : [];

  const findImport = (p) => {
    for (const [from, to] of remaps) {
      if (p.startsWith(from)) {
        const full = path.join(ROOT, to + p.slice(from.length));
        if (fs.existsSync(full)) return { contents: fs.readFileSync(full, "utf8") };
      }
    }
    for (const base of ["", "src/", "src/lib/", "src/interfaces/"]) {
      const full = path.join(ROOT, base, p);
      if (fs.existsSync(full)) return { contents: fs.readFileSync(full, "utf8") };
    }
    return { error: "not found: " + p };
  };

  /*  Most verification programs use the identical src + test/mocks graph.
      viaIR takes minutes on the complete site, and npm check used to repeat
      that work in every fresh Node process. The cache key covers the exact
      standard-json input, compiler build and remapping file. All Solidity
      imports currently live inside the requested directories; including the
      remapping text makes a future path change invalidate rather than reuse.
      Set INTACT_NO_COMPILE_CACHE=1 when measuring the compiler itself.      */
  const inputJSON = JSON.stringify(input);
  const cacheKey = createHash("sha256")
    .update(solc.version()).update("\0")
    .update(inputJSON).update("\0")
    .update(remaps.map(([a, b]) => `${a}=${b}`).join("\n"))
    .digest("hex");
  const cacheDir = path.join(ROOT, "out", "compile-cache");
  const cacheFile = path.join(cacheDir, cacheKey + ".json");
  let out;
  const noCache = process.env.INTACT_NO_COMPILE_CACHE === "1" || process.env.IPSEITY_NO_COMPILE_CACHE === "1";
  if (!noCache && fs.existsSync(cacheFile)) {
    try { out = JSON.parse(fs.readFileSync(cacheFile, "utf8")); }
    catch { /* an interrupted writer is only a cache miss */ }
  }
  if (!out) {
    out = JSON.parse(solc.compile(inputJSON, { import: findImport }));
    if (!noCache) {
      fs.mkdirSync(cacheDir, { recursive: true });
      const tmp = cacheFile + `.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(out));
      fs.renameSync(tmp, cacheFile);
    }
  }

  const errors = (out.errors || []).filter((e) => e.severity === "error");
  const warnings = (out.errors || []).filter((e) => e.severity === "warning");

  if (!quiet) {
    for (const e of errors) console.error("\x1b[31m" + e.formattedMessage + "\x1b[0m");
    for (const w of warnings) {
      // shadowing and unused-parameter noise from interface conformance is expected
      if (/Unused (function parameter|local variable)/.test(w.message)) continue;
      console.warn("\x1b[33m" + (w.formattedMessage || w.message).split("\n").slice(0, 3).join("\n") + "\x1b[0m");
    }
  }
  if (errors.length) {
    const err = new Error(errors.length + " compile error(s)");
    err.errors = errors;
    throw err;
  }
  return out;
}

/// @dev A library's runtime is a stub: for one with `public` functions it
///      begins PUSH20 <own address> ADDRESS EQ (the delegatecall guard);
///      for one with only `internal` functions, which is every library in
///      this protocol, it is PUSH0 DUP1 REVERT and the solc marker — 16
///      bytes under `bytecodeHash: "none"` (it measured 57 with the ipfs
///      hash still attached). Neither is a size worth a row in the table.
export function isLibrary(deployedHex) {
  const h = deployedHex.replace(/^0x/, "");
  if (h.startsWith("73") && h.slice(42, 46) === "3014") return true;
  return h.startsWith("5f80fd") && h.length <= 128;
}

/// @dev The ship rule, from compiled artifacts. `undecided` until a hub exists.
export function shipRule(out) {
  let intact = null, diamond = false;
  for (const [file, cs] of Object.entries(out.contracts || {})) {
    for (const [name, c] of Object.entries(cs)) {
      const n = c.evm.deployedBytecode.object.length / 2;
      if (name === "Intact" && file.endsWith("/Intact.sol")) intact = n;
      if (name === "IntactDiamond" && n > 0) diamond = true;
    }
  }
  if (intact === null) return { build: "undecided", reason: "no src/hub/Intact.sol artifact yet", intactBytes: null, threshold: SHIP_THRESHOLD };
  const fits = intact <= SHIP_THRESHOLD;
  return {
    build: fits ? "monolith" : (diamond ? "diamond" : "none"),
    reason: fits ? `Intact ${intact} B <= ${SHIP_THRESHOLD}` :
            diamond ? `Intact ${intact} B > ${SHIP_THRESHOLD}; IntactDiamond compiled` :
            `Intact ${intact} B > ${SHIP_THRESHOLD} and no IntactDiamond artifact`,
    intactBytes: intact, threshold: SHIP_THRESHOLD
  };
}

export function artifact(out, file, name) {
  const c = out.contracts?.[file]?.[name];
  if (!c) throw new Error("no artifact for " + file + ":" + name);
  return {
    abi: c.abi,
    bytecode: "0x" + c.evm.bytecode.object,
    deployed: "0x" + c.evm.deployedBytecode.object
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const out = compile({ quiet: QUIET });
  const rows = [];
  for (const [file, cs] of Object.entries(out.contracts)) {
    for (const [name, c] of Object.entries(cs)) {
      const deployed = c.evm.deployedBytecode.object;
      const n = deployed.length / 2;
      if (n === 0) continue;                       // interfaces
      if (isLibrary(deployed)) continue;           // internal libraries: a 57-byte guard stub
      rows.push({ name, file, n, measured: MEASURED.includes(name) });
    }
  }
  rows.sort((a, b) => b.n - a.n);
  if (!QUIET) {
    console.log(`\n  compiled in ${((Date.now() - t0) / 1000).toFixed(1)}s — deployed sizes\n`);
    for (const r of rows) {
      const pct = (r.n / LIMIT) * 100;
      const bar = "█".repeat(Math.round(pct / 4)).padEnd(25, "·");
      const col = pct > 100 ? "\x1b[31m" : pct > 85 ? "\x1b[33m" : "\x1b[32m";
      const tag = r.measured ? `  \x1b[2m(measured, ship rule at ${SHIP_THRESHOLD})\x1b[0m` : "";
      console.log(`  ${col}${bar}\x1b[0m ${String(r.n).padStart(6)} B  ${pct.toFixed(0).padStart(3)}%  ${r.name}${tag}`);
    }
  }
  const over = rows.filter((r) => r.n > LIMIT && !r.measured);
  const overMeasured = rows.filter((r) => r.n > LIMIT && r.measured);
  if (!QUIET) {
    console.log(over.length
      ? `\n  \x1b[31m${over.length} contract(s) exceed the EIP-170 ceiling of ${LIMIT} bytes\x1b[0m\n`
      : `\n  \x1b[32mall gated contracts fit under the EIP-170 ceiling of ${LIMIT} bytes\x1b[0m\n`);
    for (const r of overMeasured) {
      console.log(`  \x1b[33m${r.name} measures ${r.n} B, over EIP-170 — the diamond ships on this band\x1b[0m\n`);
    }
  }
  const ship = shipRule(out);
  if (SHIP || !QUIET) {
    const col = ship.build === "monolith" ? "\x1b[32m" : ship.build === "diamond" ? "\x1b[33m" : "\x1b[2m";
    console.log(`  ship rule: ${col}${ship.build}\x1b[0m — ${ship.reason}\n`);
  }
  if (over.length) process.exit(1);
  fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "out/solc.json"), JSON.stringify(out));
  fs.writeFileSync(path.join(ROOT, "out/ship.json"), JSON.stringify({
    ...ship, limit: LIMIT, solc: solc.version(), measuredAt: new Date().toISOString()
  }, null, 2));
}
