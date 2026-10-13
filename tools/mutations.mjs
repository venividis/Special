#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the mutation gate for Parley and Postage (INVARIANTS E1 / E3)

  Origin: the discipline docs/INVARIANTS.md states in its preamble — a row
  is live only once its test has been seen to fail under a one-character
  mutation — and the one debt wave 1 left: U4's sixteen-mutation gate for
  Parley was interrupted, its script did not survive the worktree, and E1
  and E3 were flipped live on the integrated runs with the gate "still owed
  by U12". This is that gate, written down so it can be run again.

  What it does. For every row of MUTATIONS below — each a one-character or
  one-token change to src/Parley.sol or src/Postage.sol aimed at one named
  guard — it writes the mutated source OVER the real file, runs the suites
  the row names through tools/forge.mjs (`--match Parley`, `--match
  Postage`, and `--match Bundle` where the guard is about the custody
  epoch, since the Bundle suite is the one with the real hub behind it),
  records which named tests failed, and restores the file. A mutation that
  no test fails is a SURVIVOR, printed as such and counted as a failure of
  the gate: either the guard is dead code or a test is missing, and the
  report says which. A mutation that does not compile is not a mutation
  and is reported as a defect of this table.

  The files are restored in a `finally`, on SIGINT and on SIGTERM — first
  by writing the saved bytes back, then by `git checkout -- <files>` — and
  the run ends by proving `git status` is clean for both. It refuses to
  start if either file has uncommitted changes, because a checkout would
  erase them.

  Cost: every mutation changes the compiler's input, so every mutation is a
  cold viaIR compile of src/ and test/ (minutes). That is why this is not
  in `npm run check`; run it after a change to either contract or either
  suite, and quote the result in INVARIANTS E1/E3.

    node tools/mutations.mjs                 every mutation; `N passed, M failed` = killed, survived
    node tools/mutations.mjs --only P2,Q3    a subset while iterating
    node tools/mutations.mjs --suites Parley,Postage   only these suites (a pruned copy of the tree —
                                             the two contracts, their imports and their two suites —
                                             compiles in seconds; the Bundle rows need the whole tree)
    node tools/mutations.mjs --list          the table without running anything
    node tools/mutations.mjs --no-baseline   skip the pristine run (when it was seen green a moment ago)
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARGV = process.argv.slice(2);
const flag = (f) => ARGV.includes(f);
const listArg = (f) => { const i = ARGV.indexOf(f); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1].split(",").map((s) => s.trim()) : null; };

const PARLEY = "src/Parley.sol";
const POSTAGE = "src/Postage.sol";
const FILES = [PARLEY, POSTAGE];
const EPOCH = ["Parley", "Postage", "Bundle"];
const BOTH = ["Parley", "Postage"];

/*  `find` must occur exactly once in the pristine file; `replace` is the
    mutation. Where the same line occurs twice the row carries enough
    context to be unique and replaces only the one token inside it.      */
export const MUTATIONS = [
  { id: "P1", file: PARLEY, guard: "mayActAs on every write: the Reach's hand, nobody else's",
    find: "return who == o || who == IParleyHub(HUB).account(token);",
    replace: "return who == o || who != IParleyHub(HUB).account(token);", suites: BOTH },
  { id: "P2", file: PARLEY, guard: "the cooldown and consent bucket is (token, custody epoch)",
    find: "return keccak256(abi.encode(token, IParleyHub(HUB).custodyEpoch(token)));",
    replace: "return keccak256(abi.encode(token, token));", suites: EPOCH },
  { id: "P3", file: PARLEY, guard: "a PLAIN body is capped at MAX_BODY, not MAX_SEALED",
    find: "(kind == SEALED ? MAX_SEALED : MAX_BODY)",
    replace: "(kind == SEALED ? MAX_SEALED : MAX_SEALED)", suites: BOTH },
  { id: "P5", file: PARLEY, guard: "the head ring shifts on a new block and only then",
    find: "if (prev != uint64(block.number)) {",
    replace: "if (prev == uint64(block.number)) {", suites: BOTH },
  { id: "P6", file: PARLEY, guard: "a reply pointer carries both halves or neither",
    find: "if ((reBlock == 0) != (reSeq == 0) || reSeq > r.count) revert BadReply();",
    replace: "if ((reBlock == 0) == (reSeq == 0) || reSeq > r.count) revert BadReply();", suites: BOTH },
  { id: "P8", file: PARLEY, guard: "a sealed send names the key it sealed to (expectedKeyId)",
    find: "if (keyId != expectedKeyId) revert KeyMoved();",
    replace: "if (keyId == expectedKeyId) revert KeyMoved();", suites: BOTH },
  // (solc refuses the literal `bytes32(1)`; `bytes32(uint256(1))` is the one-token never-matching key)
  { id: "P9", file: PARLEY, guard: "a sealed send to a token with no key is refused (NoKey)",
    find: "            if (keyId == bytes32(0)) revert NoKey();\n            if (keyId != expectedKeyId) revert KeyMoved();",
    replace: "            if (keyId == bytes32(uint256(1))) revert NoKey();\n            if (keyId != expectedKeyId) revert KeyMoved();", suites: BOTH },
  { id: "P10", file: PARLEY, guard: "only the steward invites, evicts, sets the cooldown and hides",
    find: "if (r.steward != by) revert NotTheSteward();",
    replace: "if (r.steward == by) revert NotTheSteward();", suites: BOTH },
  { id: "P11", file: PARLEY, guard: "hide sets one bit in the right word and nothing else",
    find: "_hidden[room][seq >> 8] |= uint256(1) << (seq & 255);",
    replace: "_hidden[room][seq >> 7] |= uint256(1) << (seq & 255);", suites: BOTH },
  { id: "P12", file: PARLEY, guard: "bindKey is holds: not the Reach, not a stranger",
    find: "        if (o != msg.sender) revert NotHolder();\n        uint64 epoch = IParleyHub(HUB).custodyEpoch(token);",
    replace: "        if (o == address(0)) revert NotHolder();\n        uint64 epoch = IParleyHub(HUB).custodyEpoch(token);", suites: BOTH },
  { id: "P13", file: PARLEY, guard: "keyOf answers only under the epoch that bound it (a buy-back revives nothing)",
    find: "if (b.epoch != IParleyHub(HUB).custodyEpoch(token)) return (0, bytes32(0), \"\");",
    replace: "if (b.epoch > IParleyHub(HUB).custodyEpoch(token)) return (0, bytes32(0), \"\");", suites: EPOCH },
  { id: "P17", file: PARLEY, guard: "speak takes the Parley lock (a hooked fee token cannot re-enter from a stamp)",
    find: "        Transient.enter(Transient.PARLEY_LOCK);\n        _asToken(from);\n        Room storage r = _room[room];",
    replace: "        Transient.exit(Transient.PARLEY_LOCK);\n        _asToken(from);\n        Room storage r = _room[room];", suites: BOTH },
  { id: "P18", file: PARLEY, guard: "a home room admits its steward and its members, nobody else",
    find: "if (r.steward != from && !inRoom[room][from]) revert NotAMember();",
    replace: "if (r.steward != from && inRoom[room][from]) revert NotAMember();", suites: BOTH },
  { id: "Q1", file: POSTAGE, guard: "stamp is PARLEY-only",
    find: "        if (msg.sender != PARLEY) revert NotParley();\n        Transient.enter(Transient.POSTAGE_LOCK);",
    replace: "        if (msg.sender == PARLEY) revert NotParley();\n        Transient.enter(Transient.POSTAGE_LOCK);", suites: BOTH },
  { id: "Q2", file: POSTAGE, guard: "settle is PARLEY-only",
    find: "        if (msg.sender != PARLEY) revert NotParley();\n        uint256 stampId = pendingOf[pairRoom];",
    replace: "        if (msg.sender == PARLEY) revert NotParley();\n        uint256 stampId = pendingOf[pairRoom];", suites: BOTH },
  { id: "Q3", file: POSTAGE, guard: "exactly one of settled/refunded: a settled stamp cannot be expired",
    find: "        if (s.settled) revert AlreadySettled(stampId);\n        if (s.refunded) revert AlreadyRefunded(stampId);\n        if (block.timestamp <= s.replyBy)",
    replace: "        if (s.refunded) revert AlreadySettled(stampId);\n        if (s.refunded) revert AlreadyRefunded(stampId);\n        if (block.timestamp <= s.replyBy)", suites: BOTH },
  { id: "Q4", file: POSTAGE, guard: "expire waits for the reply window to close",
    find: "if (block.timestamp <= s.replyBy) revert ReplyWindowOpen(s.replyBy);",
    replace: "if (block.timestamp > s.replyBy) revert ReplyWindowOpen(s.replyBy);", suites: BOTH },
  { id: "Q5", file: POSTAGE, guard: "the pull ledger is zeroed before it pays (no double claim)",
    find: "        owed[payee][feeToken] = 0;",
    replace: "        owed[payee][feeToken] = amount;", suites: BOTH },
  { id: "Q6", file: POSTAGE, guard: "the inbox configuration is stamped with the custody epoch (stale after a sale)",
    find: "if (box.epoch == 0 || box.epoch != IPostageHub(HUB).custodyEpoch(token)) {",
    replace: "if (box.epoch == 0 || box.epoch > IPostageHub(HUB).custodyEpoch(token)) {", suites: EPOCH }
];

if (flag("--list")) {
  console.log("\n  id    file             suites                    guard");
  for (const m of MUTATIONS) console.log(`  ${m.id.padEnd(5)} ${path.basename(m.file).padEnd(16)} ${m.suites.join(",").padEnd(25)} ${m.guard}`);
  console.log(`\n  ${MUTATIONS.length} mutations\n`);
  process.exit(0);
}

const only = listArg("--only");
if (only) for (const id of only) if (!MUTATIONS.some((m) => m.id === id)) { console.error(`  no mutation ${id}; see --list`); process.exit(2); }
const suitesWanted = listArg("--suites");
const chosen = MUTATIONS.filter((m) => !only || only.includes(m.id))
  .map((m) => ({ ...m, suites: suitesWanted ? m.suites.filter((s) => suitesWanted.includes(s)) : m.suites }))
  .filter((m) => m.suites.length);

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const fmt = (ms) => `${Math.floor(ms / 60000)}m ${String(Math.round(ms / 1000) % 60).padStart(2, "0")}s`;
const git = (...a) => spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });

/*──────────────── restore, always ────────────────*/
const originals = new Map(FILES.map((f) => [f, fs.readFileSync(path.join(ROOT, f), "utf8")]));
let restored = false;
function restore() {
  for (const [f, text] of originals) {
    try { if (fs.readFileSync(path.join(ROOT, f), "utf8") !== text) fs.writeFileSync(path.join(ROOT, f), text); } catch { /* rewritten below */ }
  }
  git("checkout", "--", ...FILES);
  restored = true;
}
process.on("SIGINT", () => { restore(); console.log("\n  interrupted — sources restored"); process.exit(130); });
process.on("SIGTERM", () => { restore(); process.exit(143); });
process.on("exit", () => { if (!restored) restore(); });

const dirty = git("status", "--porcelain", "--", ...FILES).stdout.trim();
if (dirty) {
  console.error(`\n  refusing to start: uncommitted changes in\n${dirty}\n  the gate restores by git checkout and would erase them\n`);
  process.exit(2);
}

/*──────────────── running forge ────────────────*/
function forge(match) {
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools/forge.mjs"), "--match", match], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, INTACT_IMPL: "monolith" }
  });
  const out = strip((r.stdout || "") + (r.stderr || ""));
  const failed = [...new Set([...out.matchAll(/^\s*✗ (\w+)/gm)].map((m) => m[1]))];
  const sum = out.match(/^\s*(\d+) passed, (\d+) failed\s*$/m);
  const firstError = (out.match(/^(?:Error|.*Error:|.*error:).*$/m) || [])[0] || "";
  return { status: r.status, failed, passed: sum ? +sum[1] : null, total: sum ? +sum[1] + +sum[2] : null, ran: !!sum, firstError, out };
}

/// tools/forge.mjs compiles quietly, so a mutant that does not compile only says "N compile
/// error(s)". The same compile, asked again in this process, is a cache hit and names the line.
const FORGE_DIRS = ["src", "test", "lib/forge-std/src"];     // forge.mjs's input, so the cache answers
async function diagnose(fallback) {
  try { const { compile } = await import("./compile.mjs"); compile({ quiet: true, dirs: FORGE_DIRS }); return fallback; }
  catch (e) { return (e.errors?.[0]?.formattedMessage || e.message).split("\n").slice(0, 2).map((l) => l.trim()).join("  "); }
}

const cacheDir = path.join(ROOT, "out", "compile-cache");
const cacheNow = () => new Set(fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : []);

console.log(`\n  \x1b[1mINTACT · the mutation gate — ${chosen.length} mutation${chosen.length === 1 ? "" : "s"} of Parley and Postage\x1b[0m`);
const T0 = Date.now();
const results = [];
try {
  /*── the baseline: pristine sources, every suite green, or nothing below means anything ──*/
  const suites = [...new Set(chosen.flatMap((m) => m.suites))];
  const counts = {};
  if (!flag("--no-baseline")) {
    console.log("\n  \x1b[1mbaseline\x1b[0m  (pristine sources; a cold compile)");
    for (const s of suites) {
      const t = Date.now();
      const r = forge(s);
      counts[s] = r.total;
      console.log(`  ${r.ran && r.failed.length === 0 ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${s.padEnd(8)} ${r.ran ? `${r.passed} of ${r.total} passed` : "did not run"}  \x1b[2m${fmt(Date.now() - t)}\x1b[0m`);
      if (!r.ran || r.failed.length) {
        console.log(`\n  the baseline is not green (${s}: ${r.ran ? r.failed.join(", ") : r.firstError}); a kill would mean nothing. Stopping.\n`);
        console.log("  0 passed, 1 failed\n");
        process.exit(1);
      }
    }
  }

  /*── every mutation ──*/
  for (const m of chosen) {
    const t = Date.now();
    const file = path.join(ROOT, m.file);
    const pristine = originals.get(m.file);
    const n = pristine.split(m.find).length - 1;
    if (n !== 1) {
      results.push({ m, kind: "invalid", why: `the anchor occurs ${n} times, wanted once` });
      console.log(`  \x1b[31m✗\x1b[0m ${m.id.padEnd(4)} INVALID — the anchor occurs ${n} times in ${m.file}`);
      continue;
    }
    const before = cacheNow();
    fs.writeFileSync(file, pristine.replace(m.find, m.replace));
    const killers = [];
    const detail = [];
    let compiled = true, firstError = "";
    try {
      for (const s of m.suites) {
        const r = forge(s);
        if (!r.ran) { compiled = false; firstError = await diagnose(r.firstError); break; }
        killers.push(...r.failed.filter((k) => !killers.includes(k)));
        detail.push(`${s}: ${r.failed.length} of ${r.total} failed`);
      }
    } finally {
      fs.writeFileSync(file, pristine);
      // the mutated compile is of no further use; keep the cache the size it was
      for (const f of cacheNow()) if (!before.has(f)) { try { fs.unlinkSync(path.join(cacheDir, f)); } catch { /* fine */ } }
    }
    const ms = Date.now() - t;
    if (!compiled) {
      results.push({ m, kind: "invalid", why: `did not compile: ${firstError.slice(0, 200)}`, ms });
      console.log(`  \x1b[31m✗\x1b[0m ${m.id.padEnd(4)} DID NOT COMPILE — ${firstError.slice(0, 200)}  \x1b[2m${fmt(ms)}\x1b[0m`);
    } else if (killers.length === 0) {
      results.push({ m, kind: "survived", ms, detail });
      console.log(`  \x1b[31m✗\x1b[0m ${m.id.padEnd(4)} SURVIVED — ${m.guard}  (${detail.join("; ")})  \x1b[2m${fmt(ms)}\x1b[0m`);
    } else {
      results.push({ m, kind: "killed", killers, ms, detail });
      console.log(`  \x1b[32m✓\x1b[0m ${m.id.padEnd(4)} killed by ${killers.join(", ")}  \x1b[2m(${detail.join("; ")}; ${fmt(ms)})\x1b[0m`);
    }
  }
} finally {
  restore();
}

/*──────────────── the table ────────────────*/
const clean = git("status", "--porcelain", "--", ...FILES).stdout.trim() === "";
console.log(`\n  \x1b[1mthe mutation gate\x1b[0m\n`);
console.log(`  ${"id".padEnd(4)} ${"file".padEnd(12)} ${"result".padEnd(10)} ${"time".padEnd(8)} guard → killed by`);
for (const r of results) {
  const word = r.kind === "killed" ? "\x1b[32mkilled\x1b[0m    " : r.kind === "survived" ? "\x1b[31mSURVIVED\x1b[0m  " : "\x1b[31mINVALID\x1b[0m   ";
  console.log(`  ${r.m.id.padEnd(4)} ${path.basename(r.m.file).padEnd(12)} ${word} ${(r.ms ? fmt(r.ms) : "—").padEnd(8)} ${r.m.guard}`);
  console.log(`       ${" ".repeat(12)} ${r.kind === "killed" ? "→ " + r.killers.join(", ") : "→ " + (r.why || "no test failed: the guard is dead code or a test is missing")}`);
}
const killed = results.filter((r) => r.kind === "killed").length;
const bad = results.length - killed;
console.log(`\n  ${clean ? "\x1b[32m" : "\x1b[31m"}sources restored: git status ${clean ? "clean" : "NOT CLEAN"} for ${FILES.join(", ")}\x1b[0m  (${fmt(Date.now() - T0)} in all)`);
console.log(`\n  ${bad === 0 && clean ? "\x1b[32m" : "\x1b[31m"}${killed} passed, ${bad + (clean ? 0 : 1)} failed\x1b[0m\n`);
process.exit(bad === 0 && clean ? 0 : 1);
