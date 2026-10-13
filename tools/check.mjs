#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · `npm run check` — the whole battery, and the rule that an
  incomplete run is not a pass

  Origin: MASTER's "incomplete ≠ pass" rule (a missing or duplicated suite
  summary fails the run), applied to the order DESIGN.md §13 gives and the
  list BUILD-PLAN §U12 wires. Before this file `check` was a chain of
  `npm run` steps joined by `&&`: a step that printed nothing and exited 0,
  a verifier whose file did not exist yet (npm prints "cannot find module"
  and exits 1 — fine) or one that reported its failures only in prose were
  all read by the shell as whatever their exit code said. This runner reads
  the output as well.

  Every step must produce EXACTLY ONE line of the shape that tool prints as
  its summary — the table STEPS names the regex per step and how to read the
  passed/failed counts out of it — and that line must report zero failures.
  A step fails the run when it:

    · exits non-zero;
    · prints no summary line (it stopped, crashed, or never ran its suite);
    · prints two summary lines (it ran twice, or one is a stray);
    · reports M > 0 in its summary;
    · is a file that does not exist (a unit not yet landed is not a pass).

  Output is streamed as each step runs, so a long step is watchable, and at
  the end a table gives every step's counts and wall time and the total —
  the table the documents quote.

    node tools/check.mjs                     the whole battery, in order, stopping at the first failure
    node tools/check.mjs --keep-going        run every step even after one fails (the whole table)
    node tools/check.mjs --only a,b          a PARTIAL run (never called green)
    node tools/check.mjs --skip a,b          likewise
    node tools/check.mjs --list              the step table: name, command, summary regex
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARGV = process.argv.slice(2);
const flag = (f) => ARGV.includes(f);
const list = (f) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1].split(",").map((s) => s.trim()).filter(Boolean) : null; };

/*  The summary shapes. `N passed, M failed` is the contract every verifier
    in this repository obeys; the five tools with a summary of their own
    are read by their own line. `read` turns a regex match into {n, m}.   */
const PASSED_FAILED = { re: /^(\d+) passed, (\d+) failed$/, read: (m) => ({ n: +m[1], m: +m[2] }) };
const SHAPES = {
  passedFailed: PASSED_FAILED,
  propertiesHeld: { re: /^(\d+) properties held, (\d+) broken$/, read: (m) => ({ n: +m[1], m: +m[2] }) },
  gate: { re: /^all gated contracts fit under the EIP-170 ceiling of (\d+) bytes$/, read: () => ({ n: null, m: 0 }) },
  facets: { re: /^(\d+) selectors routed once each; no diamondCut anywhere$/, read: (m) => ({ n: +m[1], m: 0 }) },
  facetsSelftest: { re: /^facets\.mjs self-test: (\d+) passed$/, read: (m) => ({ n: +m[1], m: 0 }) },
  shellGzip: { re: /^shell gzip\s+([\d,]+) bytes\s+\(ceiling ([\d,]+)\)$/,
    read: (m) => { const n = Number(m[1].replace(/,/g, "")), c = Number(m[2].replace(/,/g, "")); return { n, m: n > c ? 1 : 0, note: `${m[1]} B of ${m[2]}` }; } },
  gas: { re: /^every measured view is under its cap \((\d+) probed cold/, read: (m) => ({ n: +m[1], m: 0 }) },
  gasSelftest: { re: /^gas\.mjs self-test: the fixture \(([\d.]+M)\) is over the ([\d.]+M) cap and would fail the build; the control passes$/,
    read: (m) => ({ n: 1, m: 0, note: `${m[1]} over ${m[2]}` }) },
  staticAudit: { re: /^static audit passed — (\d+) Solidity rules, (\d+) JS rules; this is not a security audit$/, read: (m) => ({ n: +m[1] + +m[2], m: 0 }) },
  staticSelftest: { re: /^static-audit self-test: the fixture fails on (\d+) findings, the clean file passes$/, read: (m) => ({ n: +m[1], m: 0 }) }
};

/*  step → command → summary regex → how N and M are read. DESIGN §13's
    order, with the standalone verifiers wired in where BUILD-PLAN §U12 puts
    them; `verify:console` (U11) is in the default list even where it has
    not landed, because a battery that silently skipped the browser would
    be reporting on a smaller battery than the documents describe.        */
export const STEPS = [
  { name: "compile", file: "tools/compile.mjs", args: ["--ship"], shape: "gate", extra: "shipRule",
    what: "the EIP-170 size gate and the ship rule; N counts the contracts measured" },
  { name: "facets", file: "tools/facets.mjs", args: [], shape: "facets", what: "the diamond's cut, derived; N selectors routed once" },
  { name: "facets:selftest", file: "tools/facets.mjs", args: ["--selftest"], shape: "facetsSelftest", what: "the cut derivation refuses the fixture's bad ABIs" },
  { name: "selftest", file: "tools/selftest.mjs", args: [], shape: "passedFailed", what: "the shell's chain half against published vectors" },
  { name: "build", file: "tools/build-app.mjs", args: [], shape: "shellGzip", extra: "noPlaceholder",
    what: "the shards; N is the shell's gzip bytes, M = 1 when over the ceiling; a placeholder shell or panel fails" },
  { name: "forge:monolith", file: "tools/forge.mjs", args: [], env: { INTACT_IMPL: "monolith" }, shape: "passedFailed", what: "the .t.sol suite on the monolith" },
  { name: "forge:diamond", file: "tools/forge.mjs", args: [], env: { INTACT_IMPL: "diamond" }, shape: "passedFailed", what: "the .t.sol suite on the diamond" },
  { name: "gas", file: "tools/gas.mjs", args: [], shape: "gas", what: "every view under its cap, measured cold; N probes" },
  { name: "gas:selftest", file: "tools/gas.mjs", args: ["--selftest"], shape: "gasSelftest", what: "the gate fails the GasHog fixture" },
  { name: "verify", file: "tools/verify.mjs", args: [], shape: "passedFailed", what: "the equality step: tokenURI bytes equal /live, the manifest, the catalog" },
  { name: "verify:site", file: "tools/verify-site.mjs", args: [], shape: "passedFailed", what: "every lane through the DOM and wallet shim" },
  { name: "mcp", file: "sdk/mcp.test.mjs", args: [], shape: "passedFailed", what: "the MCP bridge: tools from services.json, the drift refusal, propose then act" },
  { name: "verify:pool", file: "tools/verify-pool.mjs", args: [], shape: "passedFailed", what: "the market: k-walk, round trips, C1/C2/C5, no admin" },
  { name: "verify:vault", file: "tools/verify-vault.mjs", args: [], shape: "passedFailed", what: "the Reach and the Grip: seal, sessions, ledger, 7739" },
  { name: "verify:parley", file: "tools/verify-parley.mjs", args: [], shape: "passedFailed", what: "the archive walked by single blocks; keys; postage" },
  { name: "verify:launch", file: "tools/verify-launch.mjs", args: [], shape: "passedFailed", what: "the coin, the raise, graduation, failure, the hook by selector" },
  { name: "verify:steward", file: "tools/verify-steward.mjs", args: [], shape: "passedFailed", what: "succession and recovery against the real hub" },
  { name: "verify:timelock", file: "tools/verify-timelock.mjs", args: [], shape: "passedFailed", what: "the only curator, through its queue" },
  { name: "verify:premises", file: "tools/verify-premises.mjs", args: [], shape: "passedFailed", what: "the ERC-5219 router: routes, 404s, one resource one URL" },
  { name: "verify:plate", file: "tools/verify-plate.mjs", args: [], shape: "passedFailed", what: "the ENS resolver: custody is the binding, the wildcard, the clock" },
  { name: "fuzz", file: "tools/fuzz.mjs", args: [], shape: "propertiesHeld", what: "the seeded, shrinking market properties" },
  { name: "verify:findings", file: "tools/verify-findings.mjs", args: [], shape: "passedFailed", what: "every historical finding replayed: refuted on HEAD, reproduced on a variant" },
  { name: "agents", file: "tools/agents.mjs", args: [], shape: "passedFailed", what: "seven motives for 220 ticks with the invariants checked after every tick" },
  { name: "static-audit", file: "tools/static-audit.mjs", args: [], shape: "staticAudit", what: "the patterns this codebase refuses, by grep; N rules" },
  { name: "static-audit:selftest", file: "tools/static-audit.mjs", args: ["--selftest"], shape: "staticSelftest", what: "the scan fails on the fixture" },
  { name: "verify:recover", file: "tools/verify-recover.mjs", args: [], shape: "passedFailed", what: "the deployment and its record, in-process; tampered records caught by name" },
  { name: "verify:console", file: "tools/verify-console.mjs", args: [], shape: "passedFailed", what: "the console journeys in Chromium (U11)" },
  { name: "invariants", file: "tools/invariants-check.mjs", args: [], shape: "passedFailed", what: "every INVARIANTS and DESIGN §14 row names an assertion that exists" }
];

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const fmtMs = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${(ms / 1000).toFixed(1)}s`;
};

if (flag("--list")) {
  console.log("\n  step                    command                                   summary line (regex)");
  for (const s of STEPS) {
    const env = s.env ? Object.entries(s.env).map(([k, v]) => `${k}=${v} `).join("") : "";
    console.log(`  ${s.name.padEnd(23)} ${(env + "node " + s.file + " " + s.args.join(" ")).trim().padEnd(41)} ${SHAPES[s.shape].re.source}`);
  }
  console.log("\n  exactly one line per step must match; M > 0, a non-zero exit, no line, two lines or a missing file fails the run\n");
  process.exit(0);
}

const only = list("--only"), skip = list("--skip");
const KEEP = flag("--keep-going");
for (const n of [...(only || []), ...(skip || [])]) {
  if (!STEPS.some((s) => s.name === n)) { console.error(`  no step named ${n}; see --list`); process.exit(2); }
}
const selected = STEPS.filter((s) => (!only || only.includes(s.name)) && !(skip && skip.includes(s.name)));
const PARTIAL = selected.length !== STEPS.length;

/// Run one step as a child process, streaming its output and keeping it.
function run(step) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const full = path.join(ROOT, step.file);
    if (!fs.existsSync(full)) {
      resolve({ step, ok: false, why: `incomplete ≠ pass: ${step.file} does not exist`, n: null, m: null, ms: 0, code: null });
      return;
    }
    const child = spawn(process.execPath, [full, ...step.args], {
      cwd: ROOT, env: { ...process.env, ...(step.env || {}) }, stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "";
    const take = (chunk) => { const s = chunk.toString(); out += s; process.stdout.write(s); };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("close", (code) => {
      const ms = Date.now() - t0;
      const lines = strip(out).split("\n").map((l) => l.trim());
      const shape = SHAPES[step.shape];
      const hits = lines.map((l) => l.match(shape.re)).filter(Boolean);
      let why = null, n = null, m = null, note = "";
      if (code !== 0) why = `exit code ${code}`;
      if (hits.length === 0) why = (why ? why + "; " : "") + "no summary line of the expected shape";
      else if (hits.length > 1) why = (why ? why + "; " : "") + `${hits.length} summary lines, wanted exactly one`;
      else {
        const r = shape.read(hits[0]);
        n = r.n; m = r.m; note = r.note || "";
        if (m > 0) why = (why ? why + "; " : "") + `${m} failed`;
      }
      if (step.extra === "shipRule") {
        const ship = lines.map((l) => l.match(/^ship rule: (monolith|diamond) — /)).filter(Boolean);
        if (ship.length !== 1) why = (why ? why + "; " : "") + `ship rule printed ${ship.length} times, wanted once`;
        else note = `ship rule: ${ship[0][1]}`;
        n = lines.filter((l) => /^[█·]+\s+\d+ B\s+\d+%/.test(l)).length || n;
      }
      if (step.extra === "noPlaceholder" && /\(PLACEHOLDER/.test(strip(out))) {
        why = (why ? why + "; " : "") + "dist/ carries a placeholder shell or panel";
      }
      resolve({ step, ok: !why, why, n, m, ms, code, note });
    });
  });
}

console.log(`\n  \x1b[1mINTACT · check\x1b[0m  ${PARTIAL ? "\x1b[33mPARTIAL — " + selected.length + " of " + STEPS.length + " steps\x1b[0m" : STEPS.length + " steps, DESIGN §13's order"}${KEEP ? "  (keep going)" : "  (stopping at the first failure)"}\n`);
const T0 = Date.now();
const results = [];
let stopped = false;
for (const step of selected) {
  console.log(`\n\x1b[1m══ ${step.name}\x1b[0m  \x1b[2m${(step.env ? Object.entries(step.env).map(([k, v]) => `${k}=${v} `).join("") : "")}node ${step.file} ${step.args.join(" ")}\x1b[0m`);
  const r = await run(step);
  results.push(r);
  console.log(r.ok ? `\x1b[32m── ${step.name}: ok (${fmtMs(r.ms)})\x1b[0m` : `\x1b[31m── ${step.name}: FAILED — ${r.why} (${fmtMs(r.ms)})\x1b[0m`);
  if (!r.ok && !KEEP) { stopped = true; break; }
}
const total = Date.now() - T0;

/*──────────────── the table ────────────────*/
console.log(`\n  \x1b[1mINTACT · check — ${PARTIAL ? "PARTIAL run" : "the battery"}\x1b[0m\n`);
console.log(`  ${"step".padEnd(23)} ${"passed".padStart(7)} ${"failed".padStart(7)} ${"time".padStart(9)}  result`);
for (const r of results) {
  const n = r.n === null ? "—" : String(r.n);
  const m = r.m === null ? "—" : String(r.m);
  console.log(`  ${r.step.name.padEnd(23)} ${n.padStart(7)} ${m.padStart(7)} ${fmtMs(r.ms).padStart(9)}  ${r.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"}${r.note ? " " + r.note : ""}${r.ok ? "" : " — " + r.why}`);
}
const notRun = selected.slice(results.length);
for (const s of notRun) console.log(`  ${s.name.padEnd(23)} ${"—".padStart(7)} ${"—".padStart(7)} ${"—".padStart(9)}  \x1b[2mnot run (stopped at the first failure)\x1b[0m`);
console.log(`  ${"total".padEnd(23)} ${"".padStart(7)} ${"".padStart(7)} ${fmtMs(total).padStart(9)}`);

const failed = results.filter((r) => !r.ok);
const passed = results.filter((r) => r.ok).length;
let verdict;
if (failed.length || stopped) verdict = `\x1b[31mcheck: FAILED — ${failed.map((r) => r.step.name).join(", ")}${notRun.length ? `; ${notRun.length} step(s) not run` : ""}\x1b[0m`;
else if (PARTIAL) verdict = `\x1b[33mcheck: PARTIAL — ${passed} of ${STEPS.length} steps run and passed; this is not the battery\x1b[0m`;
else verdict = `\x1b[32mcheck: green — all ${STEPS.length} steps passed in ${fmtMs(total)}\x1b[0m`;
console.log(`\n  ${verdict}`);
console.log(`\n  ${failed.length === 0 ? "\x1b[32m" : "\x1b[31m"}${passed} passed, ${failed.length + notRun.length} failed\x1b[0m\n`);
process.exit(failed.length || stopped ? 1 : 0);
