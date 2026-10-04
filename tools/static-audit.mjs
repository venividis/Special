#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the static audit: patterns this codebase refuses, by grep

  Origin: MASTER scripts/static-audit.mjs (tx.origin, selfdestruct,
  .delegatecall(, assembly sstore), with INTACT's additions: the EOA-only
  idioms (`msg.sender.code.length == 0`, `isContract`, `extcodesize(caller())`
  — a 7702-delegated holder must work, DESIGN A7), string reverts (custom
  errors only), and for the JavaScript that ships to a browser: `eval(`,
  `new Function`, the `(1n<<256n)-1n` mask that once silently truncated a
  uint256 in a wallet client, and `innerHTML` for chain strings.

  This is a heuristic scan, not a security audit. It exists so the
  patterns a review already rejected cannot come back in a later commit
  without a conversation.

    node tools/static-audit.mjs             scan the tree; non-zero on a finding
    node tools/static-audit.mjs --selftest  prove the scan fails on a fixture
    node tools/static-audit.mjs --root DIR  scan another tree
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/*  Rules are built from pieces so this file's own text never contains the
    literal it forbids: a scanner that trips on itself is a scanner that
    gets an exemption, and an exemption is the hole.                      */
const re = (...parts) => new RegExp(parts.join(""), "g");

export const SOLIDITY_RULES = [
  { pattern: re("\\btx\\.", "origin\\b"), reason: "tx.origin authorization" },
  { pattern: re("\\bself", "destruct\\b"), reason: "selfdestruct" },
  { pattern: re("\\.delegate", "call\\s*\\("), reason: "Solidity-level delegatecall (only the diamond's assembly dispatcher may)" },
  { pattern: re("assembly\\s*(\\(\"memory-safe\"\\))?\\s*\\{[^}]*\\bs", "store\\s*\\("), reason: "manual storage mutation in assembly" },
  { pattern: re("msg\\.sender\\.code\\.length\\s*==\\s*0"), reason: "EOA-only check (a 7702-delegated holder has code)" },
  { pattern: re("\\bis", "Contract\\s*\\("), reason: "isContract idiom" },
  { pattern: re("extcodesize\\s*\\(\\s*caller\\s*\\(\\s*\\)\\s*\\)"), reason: "extcodesize(caller()) EOA check" },
  { pattern: re("\\brequire\\s*\\([^;]*,\\s*\""), reason: "require with a string: custom errors only" },
  { pattern: re("\\brevert\\s*\\(\\s*\""), reason: "revert with a string: custom errors only" },
  { pattern: re("\\bimport\\s+[^;]*[\"']@"), reason: "import from outside src/ (no external Solidity dependencies)" }
];

export const JS_RULES = [
  { pattern: re("\\bev", "al\\s*\\("), reason: "eval" },
  { pattern: re("\\bnew\\s+Fun", "ction\\s*\\("), reason: "new Function" },
  { pattern: re("\\(\\s*1n\\s*<<\\s*256n\\s*\\)\\s*-\\s*1n"), reason: "(1n<<256n)-1n: a uint256 mask that hides a truncation" },
  { pattern: re("\\binner", "HTML\\s*="), reason: "innerHTML assignment: chain strings reach the DOM through textContent only" }
];

/// Which trees carry which rules. tools/ is scanned for the JS rules too,
/// since a harness that evals is a harness that could be fed anything.
export const TARGETS = [
  { dir: "src",    exts: [".sol"], rules: SOLIDITY_RULES },
  { dir: "engine", exts: [".js", ".mjs", ".html"], rules: JS_RULES },
  { dir: "sdk",    exts: [".js", ".mjs"], rules: JS_RULES },
  { dir: "tools",  exts: [".js", ".mjs"], rules: JS_RULES, skip: ["static-audit.mjs"] }
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === "dist") return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/// Strip Solidity/JS comments so a rule written about a pattern (this
/// protocol's comments record past bugs by name) is not a finding.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
            .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, pre) => pre + " ".repeat(m.length - pre.length));
}

export function scan(root, targets = TARGETS) {
  const findings = [];
  for (const t of targets) {
    for (const file of walk(path.join(root, t.dir))) {
      if (!t.exts.some((e) => file.endsWith(e))) continue;
      if ((t.skip || []).some((s) => file.endsWith(s))) continue;
      const source = stripComments(fs.readFileSync(file, "utf8"));
      for (const rule of t.rules) {
        rule.pattern.lastIndex = 0;
        const m = rule.pattern.exec(source);
        if (m) {
          const line = source.slice(0, m.index).split("\n").length;
          findings.push({ file: path.relative(root, file), line, issue: rule.reason });
        }
        rule.pattern.lastIndex = 0;
      }
    }
  }
  return findings;
}

/*──────────────── self-test ────────────────*/
export function selftest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "intact-audit-"));
  fs.mkdirSync(path.join(tmp, "src"));
  fs.mkdirSync(path.join(tmp, "engine"));
  // the fixtures are assembled from pieces for the reason the rules are
  fs.writeFileSync(path.join(tmp, "src", "Bad.sol"),
    "pragma solidity ^0.8.24;\ncontract Bad {\n  function f() external view returns (bool) { return " +
    "tx." + "origin == msg.sender; }\n" +
    "  function g() external view { require(msg.sender.code.length == 0, " + '"eoa"' + "); }\n}\n");
  fs.writeFileSync(path.join(tmp, "engine", "bad.js"),
    "const m = (1n << 256n) - 1n;\nconst f = ev" + "al(" + '"1"' + ");\n");
  fs.writeFileSync(path.join(tmp, "src", "Fine.sol"),
    "pragma solidity ^0.8.24;\n// a comment that says tx." + "origin is forbidden\n" +
    "contract Fine { error No(); function f() external pure { revert No(); } }\n");
  const findings = scan(tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  const want = ["tx.origin authorization", "EOA-only check (a 7702-delegated holder has code)",
                "require with a string: custom errors only", "(1n<<256n)-1n: a uint256 mask that hides a truncation", "eval"];
  const got = findings.map((f) => f.issue);
  const missing = want.filter((w) => !got.includes(w));
  const commentFlagged = findings.some((f) => f.file.endsWith("Fine.sol"));
  return { ok: missing.length === 0 && !commentFlagged, missing, commentFlagged, findings };
}

/*──────────────── CLI ────────────────*/
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--selftest")) {
    const r = selftest();
    for (const f of r.findings) console.log(`  \x1b[2mfixture:\x1b[0m ${f.file}:${f.line}  ${f.issue}`);
    if (!r.ok) {
      console.log(`\n  \x1b[31mstatic-audit self-test failed\x1b[0m` +
                  (r.missing.length ? ` — did not catch: ${r.missing.join(", ")}` : "") +
                  (r.commentFlagged ? " — flagged a pattern that only appears in a comment" : "") + "\n");
      process.exit(1);
    }
    console.log(`\n  \x1b[32mstatic-audit self-test: the fixture fails on ${r.findings.length} findings, the clean file passes\x1b[0m\n`);
    process.exit(0);
  }
  const i = process.argv.indexOf("--root");
  const root = i >= 0 ? path.resolve(process.argv[i + 1]) : ROOT;
  const findings = scan(root);
  if (findings.length) {
    console.error("\n  \x1b[31mForbidden patterns found:\x1b[0m");
    for (const f of findings) console.error(`    ${f.file}:${f.line}  ${f.issue}`);
    console.error("");
    process.exit(1);
  }
  console.log(`\n  \x1b[32mstatic audit passed\x1b[0m — ${SOLIDITY_RULES.length} Solidity rules, ${JS_RULES.length} JS rules; this is not a security audit\n`);
}
