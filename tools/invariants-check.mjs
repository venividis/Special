#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the invariants ledger, held to the files it cites

  Origin: IPSEITY's INVARIANTS.md numbering discipline — "an invariant
  written down is a claim that can be attacked" — and BUILD-PLAN §U12's
  done-criterion: every INVARIANTS row, F7 included, names an assertion
  string that exists. docs/INVARIANTS.md promises in its own preamble that
  this tool asserts exactly that, so this file is the promise kept.

  What it proves, row by row:

    · every `path` a row cites under test/, tools/, src/ or sdk/ exists;
    · every assertion the row names after that path exists IN that file —
      a backticked `test_…`/`testFuzz_…` name is a `function <name>(` in a
      .t.sol; an italic *"sentence"* is a verbatim substring of a .mjs
      (whitespace collapsed, `\"` unescaped, so a wrapped sentence or one
      built with a template prefix still matches; a sentence that cannot be
      found verbatim is a FAIL, never a warning); a bare identifier after a
      src/ path (an error name) is a word in that source;
    · a row whose status cell begins with `pending` is reported
      `pending (<unit>)` and fails nothing — until its unit lands, the row
      is a plan, and a plan is not a claim;
    · the numbering discipline: every DESIGN.md §14 row id (A1 … H3) is an
      INVARIANTS row and vice versa, every §14 citation exists in its file
      the same way, and every file and assertion §14 names is also named
      by the INVARIANTS row of the same id — so the checklist and the
      ledger stay one line per row, as INVARIANTS' preamble promises.

  Pairing is strict: an assertion belongs to the path named immediately
  before it (`file · a, b; file2 · c`). An assertion with no file before
  it is a failure of the row's grammar, not a warning.

  Rows citing a tool another unit owns (tools/verify-console.mjs — U11;
  tools/verify-gateway.mjs — U13) fail honestly until that tool lands:
  incomplete is not pass.

    node tools/invariants-check.mjs                     every row, then `N passed, M failed`
    node tools/invariants-check.mjs --quiet             the summary only
    node tools/invariants-check.mjs --invariants F.md   check another copy (the negative control:
                                                        a copy with one word changed must fail)
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUIET = process.argv.includes("--quiet");

const argOf = (flag, dflt) => { const i = process.argv.indexOf(flag); return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : dflt; };
/// The two documents; overridable so a copy with one word changed can prove
/// the matcher refuses it (the negative control the mutation gate asks of
/// every checker).
const INVARIANTS = argOf("--invariants", path.join(ROOT, "docs/INVARIANTS.md"));
const DESIGN = argOf("--design", path.join(ROOT, "DESIGN.md"));

let pass = 0, fail = 0;
const say = (s) => { if (!QUIET) console.log(s); };
const ok = (label, detail) => { pass++; say(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ""}`); };
const bad = (label, why) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}\n      \x1b[31m${why}\x1b[0m`); };
const pend = (label, unit) => say(`  \x1b[33m—\x1b[0m ${label}  \x1b[2mpending (${unit})\x1b[0m`);

/*──────────────── tokens ────────────────*/

const PATH_RE = /^(test|tools|src|sdk)\/[\w./-]+\.(sol|mjs|js|json)$/;
const TEST_RE = /^test(Fuzz)?_\w+$/;
const IDENT_RE = /^[A-Za-z_]\w*$/;

/// Unescape the two escapes a Markdown or JavaScript string may carry and
/// collapse whitespace, so a wrapped sentence equals an unwrapped one.
const norm = (s) => s.replace(/\\"/g, "\"").replace(/\\'/g, "'").replace(/\s+/g, " ").trim();

/**
 * Scan a citation cell into ordered tokens. `plainStrings` admits "…" (the
 * DESIGN §14 spelling); INVARIANTS writes its sentences in italics, *"…"*.
 * Inside a backtick span nothing is a string; inside a string a backtick
 * is text ("`getHookPermissions` equals the address bits").
 */
function tokens(cell, { plainStrings }) {
  const out = [];
  let i = 0;
  while (i < cell.length) {
    const ch = cell[i];
    if (ch === "`") {
      const j = cell.indexOf("`", i + 1);
      if (j < 0) break;
      const span = cell.slice(i + 1, j).trim();
      const word = span.split(/\s+/)[0];
      const grp = span.match(/--group\s+(\w+)/);
      if (PATH_RE.test(word)) out.push({ kind: "path", value: word, group: grp ? grp[1] : null });
      else if (/^--group\s+\w+$/.test(span)) out.push({ kind: "path", value: "tools/verify-site.mjs", group: grp[1] });
      else if (TEST_RE.test(span)) out.push({ kind: "test", value: span });
      else if (IDENT_RE.test(span)) out.push({ kind: "ident", value: span });
      i = j + 1;
      continue;
    }
    if (ch === "*" && cell[i + 1] === "\"") {
      const j = closingQuote(cell, i + 2);
      if (j < 0) break;
      out.push({ kind: "string", value: norm(cell.slice(i + 2, j)) });
      i = j + 2;   // past `"*`
      continue;
    }
    if (plainStrings && ch === "\"") {
      const j = closingQuote(cell, i + 1);
      if (j < 0) break;
      out.push({ kind: "string", value: norm(cell.slice(i + 1, j)) });
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

/// The index of the next unescaped `"` at or after `from`.
function closingQuote(s, from) {
  for (let k = from; k < s.length; k++) {
    if (s[k] === "\\") { k++; continue; }
    if (s[k] === "\"") return k;
  }
  return -1;
}

/// Group tokens into { path, assertions[] } segments, strictly in order.
function segments(toks) {
  const segs = [];
  const loose = [];
  let cur = null;
  for (const t of toks) {
    if (t.kind === "path") { cur = { path: t.value, group: t.group, assertions: [] }; segs.push(cur); continue; }
    if (t.kind === "ident") { if (cur && cur.path.startsWith("src/")) cur.assertions.push(t); continue; }
    if (cur) cur.assertions.push(t); else loose.push(t);
  }
  return { segs, loose };
}

/*──────────────── the file checks ────────────────*/

const fileCache = new Map();
function readNorm(rel) {
  if (!fileCache.has(rel)) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) fileCache.set(rel, null);
    else {
      const raw = fs.readFileSync(full, "utf8");
      fileCache.set(rel, { raw, flat: norm(raw), templates: templatesOf(raw) });
    }
  }
  return fileCache.get(rel);
}

/// The files a citation's sentences may live in. A runner that splits its
/// suite into a directory of the same name (tools/verify-site.mjs and
/// tools/verify-site/<group>.mjs) prints the union of its groups, so a bare
/// citation searches the runner and every group; `--group g` searches that
/// one group file and nothing else.
function searchFiles(seg) {
  const dir = seg.path.replace(/\.mjs$/, "");
  const hasDir = seg.path.endsWith(".mjs") && fs.existsSync(path.join(ROOT, dir)) && fs.statSync(path.join(ROOT, dir)).isDirectory();
  if (seg.group) return [`${dir}/${seg.group}.mjs`];
  if (!hasDir) return [seg.path];
  return [seg.path, ...fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".mjs")).sort().map((f) => `${dir}/${f}`)];
}

/// Every template literal in a JavaScript source, as its static segments
/// (the text between `${…}` holes). A sentence the documents quote is
/// often the RENDERED form of one of these — the number inside is the
/// run's — so a sentence counts as verbatim when it is an instance of a
/// template: every literal character present, in order, only the holes
/// differing. Braces inside a hole are balanced by counting.
function templatesOf(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf("`", i)) >= 0) {
    let j = i + 1, depth = 0, segs = [], cur = "", closed = false;
    while (j < src.length) {
      const c = src[j];
      if (depth === 0) {
        if (c === "\\") { cur += src[j + 1] === "n" ? " " : src[j + 1]; j += 2; continue; }
        if (c === "`") { closed = true; j++; break; }
        if (c === "$" && src[j + 1] === "{") { segs.push(cur); cur = ""; depth = 1; j += 2; continue; }
        cur += c; j++;
      } else {
        if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth === 0) { j++; continue; } }
        else if (c === "`") { // a nested template inside a hole: skip to its end naively
          const k = src.indexOf("`", j + 1); j = k < 0 ? src.length : k + 1; continue;
        }
        j++;
      }
    }
    if (!closed) break;
    segs.push(cur);
    if (segs.length > 1) out.push(segs.map(norm));
    i = j;
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/// Is `sentence` the rendered form of a template whose static segments are
/// `segs`? It is when sentence = s0 h0 s1 h1 … s(k-1) h(k-1) p, where every
/// h is any text (a hole) and p is the final segment whole (so the
/// sentence is the whole render) or, when a hole follows sk, sk whole or a
/// prefix of it (the quote stopped short of that hole). A quote may never
/// end inside a hole that has static text beyond it. At least twelve static
/// characters must take part, so a template that is mostly holes proves
/// nothing.
function instanceOf(sentence, segs) {
  const n = segs.length;
  if (segs[0].length >= 4 && !sentence.startsWith(segs[0].slice(0, 4))) return false;
  for (let k = 0; k < n; k++) {
    const head = segs.slice(0, k).map(esc).join(".*?");
    const fixedBefore = segs.slice(0, k).join("").length;
    const last = segs[k];
    const holeFollows = k < n - 1;
    for (let c = last.length; c >= 0; c--) {
      if (fixedBefore + c < 12) break;
      if (c < last.length && !holeFollows) break;           // a final segment is quoted whole or not at all
      // whole render (k final: the trailing hole, if any, is the last `.*?`),
      // or a quote that stops at or inside a segment a hole follows — never
      // a quote whose tail disappears into a hole with static text beyond it
      const body = (head ? head + ".*?" : "") + esc(last.slice(0, c));
      if (new RegExp("^" + body + "$").test(sentence)) return true;
    }
  }
  return false;
}

function sentenceIn(sentence, f) {
  if (f.flat.includes(sentence)) return true;
  return f.templates.some((segs) => instanceOf(sentence, segs));
}

/// Every problem with one segment, as sentences; [] when it holds.
function checkSegment(seg) {
  const why = [];
  const main = readNorm(seg.path);
  if (!main) return [`${seg.path}: missing file`];
  const files = searchFiles(seg);
  const texts = files.map((rel) => [rel, readNorm(rel)]);
  for (const [rel, f] of texts) if (!f) why.push(`${rel}: missing file`);
  const present = texts.filter(([, f]) => f);
  const where = seg.group ? files[0] : seg.path;
  for (const a of seg.assertions) {
    if (a.kind === "test") {
      const re = new RegExp("function\\s+" + a.value + "\\s*\\(");
      if (!present.some(([, f]) => re.test(f.raw))) why.push(`${where}: no function ${a.value}(`);
    } else if (a.kind === "string") {
      if (!present.some(([, f]) => sentenceIn(a.value, f))) why.push(`${where}: sentence not found verbatim: "${a.value}"`);
    } else if (a.kind === "ident") {
      if (!present.some(([, f]) => new RegExp("\\b" + a.value + "\\b").test(f.raw))) why.push(`${where}: no identifier ${a.value}`);
    }
  }
  return why;
}

function checkCell(cell, flavour) {
  const { segs, loose } = segments(tokens(cell, flavour));
  const why = [];
  for (const t of loose) why.push(`an assertion with no file before it: ${t.kind === "test" ? t.value : `"${t.value}"`}`);
  for (const s of segs) why.push(...checkSegment(s));
  const n = segs.reduce((a, s) => a + s.assertions.length, 0);
  return { segs, why, files: segs.length, assertions: n };
}

/*──────────────── the two documents ────────────────*/

/// Split a Markdown table row into cells, honouring `\|` inside a cell.
function cells(line) {
  const SAFE = "\u0001";
  return line.replace(/\\\|/g, SAFE).split("|").slice(1, -1).map((c) => c.replace(new RegExp(SAFE, "g"), "|").trim());
}

function parseInvariants(text) {
  const rows = new Map();          // id → { id, cell, status }
  // the lettered rows
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*([A-H]\d+)\s*\|/);
    if (!m) continue;
    const c = cells(line);
    if (c.length < 4) { rows.set(m[1], { id: m[1], cell: "", status: "", malformed: true }); continue; }
    rows.set(m[1], { id: m[1], cell: c[2], status: c[3].replace(/\*/g, "").trim() });
  }
  // the foundation paragraphs: **0.N …** … → citations
  const paras = [];
  const re = /\*\*(0\.\d+)\s[\s\S]*?(?=\n\*\*0\.\d+\s|\n---|\n## )/g;
  let m;
  while ((m = re.exec(text))) {
    const block = m[0];
    const arrow = block.indexOf("→");
    paras.push({ id: m[1], cell: arrow < 0 ? "" : block.slice(arrow + 1) });
  }
  return { rows, paras };
}

function parseDesign14(text) {
  const start = text.indexOf("\n## 14.");
  if (start < 0) throw new Error("DESIGN.md has no §14");
  const rest = text.slice(start + 1);
  const end = rest.indexOf("\n## ");
  const section = end < 0 ? rest : rest.slice(0, end);
  const rows = new Map();
  for (const line of section.split("\n")) {
    const m = line.match(/^\|\s*([A-H]\d+)\s*\|/);
    if (!m) continue;
    const c = cells(line);
    rows.set(m[1], { id: m[1], cell: c[2] || "" });
  }
  return rows;
}

/*──────────────── run ────────────────*/

const inv = parseInvariants(fs.readFileSync(INVARIANTS, "utf8"));
const d14 = parseDesign14(fs.readFileSync(DESIGN, "utf8"));
const ITALIC = { plainStrings: false };
const PLAIN = { plainStrings: true };

say("\n  \x1b[1mINTACT · invariants-check\x1b[0m");
say("\n  \x1b[1mthe foundation (0.x)\x1b[0m");
for (const p of inv.paras) {
  const r = checkCell(p.cell, ITALIC);
  if (r.files === 0) { bad(p.id, "no file cited"); continue; }
  if (r.why.length) bad(p.id, r.why.join("\n      "));
  else ok(p.id, `${r.files} file${r.files === 1 ? "" : "s"} · ${r.assertions} assertion${r.assertions === 1 ? "" : "s"}`);
}

say("\n  \x1b[1mthe rows (A–H)\x1b[0m");
const pendingUnits = new Map();
for (const row of inv.rows.values()) {
  const label = row.id.padEnd(4);
  if (row.malformed) { bad(label, "malformed table row"); continue; }
  const pm = row.status.match(/^pending\b\s*\(?\s*([A-Za-z0-9]+)?/i);
  if (pm) { pendingUnits.set(row.id, pm[1] || "?"); pend(label, pm[1] || "?"); continue; }
  const r = checkCell(row.cell, ITALIC);
  if (r.files === 0) { bad(label, "no file cited"); continue; }
  if (r.why.length) bad(label, r.why.join("\n      "));
  else ok(label, `${row.status.split(" ")[0]} · ${r.files} file${r.files === 1 ? "" : "s"} · ${r.assertions} assertion${r.assertions === 1 ? "" : "s"}`);
}

say("\n  \x1b[1mDESIGN §14 ↔ INVARIANTS: one line per row\x1b[0m");
{
  const a = [...d14.keys()].sort();
  const b = [...inv.rows.keys()].sort();
  const onlyDesign = a.filter((x) => !inv.rows.has(x));
  const onlyInv = b.filter((x) => !d14.has(x));
  if (onlyDesign.length || onlyInv.length) {
    bad("the two tables name the same rows",
      (onlyDesign.length ? `only in DESIGN §14: ${onlyDesign.join(", ")}` : "") +
      (onlyInv.length ? ` only in INVARIANTS: ${onlyInv.join(", ")}` : ""));
  } else {
    ok("the two tables name the same rows", `${a.length} rows, ${a[0]} … ${a[a.length - 1]}, F7 included: ${a.includes("F7")}`);
  }
}
for (const row of d14.values()) {
  const label = `§14 ${row.id}`.padEnd(8);
  const unit = pendingUnits.get(row.id);
  if (unit) { pend(label, unit); continue; }
  const invRow = inv.rows.get(row.id);
  if (!invRow) continue;   // already reported above
  const r = checkCell(row.cell, PLAIN);
  const why = [...r.why];
  if (r.files === 0) why.push("no file cited");
  // every file and assertion §14 names is also in INVARIANTS' row
  const invSegs = segments(tokens(invRow.cell, ITALIC)).segs;
  const invFiles = new Set(invSegs.map((s) => s.path));
  const invAsserts = invSegs.flatMap((s) => s.assertions);
  const cited = (x) => invAsserts.some((y) => y.kind === x.kind &&
    (x.kind === "string" ? y.value.includes(x.value) : y.value === x.value));   // §14 may quote the shorter form
  for (const s of r.segs) {
    if (!invFiles.has(s.path)) why.push(`INVARIANTS ${row.id} does not cite ${s.path}`);
    for (const x of s.assertions) {
      if (!cited(x)) why.push(`INVARIANTS ${row.id} does not cite ${x.kind === "test" ? x.value : `"${x.value}"`}`);
    }
  }
  if (why.length) bad(label, why.join("\n      "));
  else ok(label, `${r.files} file${r.files === 1 ? "" : "s"} · ${r.assertions} assertion${r.assertions === 1 ? "" : "s"}, every one also in INVARIANTS ${row.id}`);
}

console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail ? 1 : 0);
