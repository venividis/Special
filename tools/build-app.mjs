#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · build the console into shards

  Origin: IPSEITY tools/build-engine.mjs, adapted for INTACT U7 (DESIGN.md
  §5.1, §5.5). One document and six panels become the bytes `Engine`
  holds:

      head     the PROLOGUE — a plain-text <!doctype …</head><body> with the
               CSP meta, served as-is; `tokenURI` writes the token's state
               into the gap after it, then the loader
      body     the whole shell, gzip, inflated in the browser by its own
               DecompressionStream (nothing is fetched)
      panels   swap, social, launch, vault, identity, agent — each gzip,
               each hash-pinned by the keccak of its INFLATED text, which
               is the number the shell checks before injecting one

  The build refuses what the site refuses (DESIGN §5.5): an external
  `src="https://`, `eval(`, `new Function`, the `(1n<<256n)-1n` mask, an
  `innerHTML` assignment, `window.INTACT=` baked into the head, a loader
  (src/Renderer.sol INFLATE) that declares a global, a shell over 15,000
  bytes of gzip, a panel over 8,192.

  The shell ceiling was 18,000 (DESIGN §5.5) and is 15,000 since U9 (D16),
  because the gas sweep measured the slope: `tokenURI` ≈ 3.44 M + 262 gas
  per gzip byte (271 above 14 KB), crossing the 8 M cap at ≈ 17.4 KB, and
  `/token/<id>/hash` — which shares `/live`'s 2.5 M cap — crosses it COLD
  at ≈ 16.5 KB. A ceiling the gas gate would already have failed is not a
  ceiling. The shell's budget is ≤ 14,000 B gzip (tokenURI ≈ 7.09 M cold,
  `/hash` ≈ 2.34 M cold); 15,000 is the hard stop (≈ 7.35 M / ≈ 2.40 M).

  Two inlinings happen before the minifier and before the refusals (U9,
  D18), so the checks see what ships:

      engine/app.css      replaces the single `<link rel="stylesheet"
                          href="app.css">` in the real shell with
                          `<style>…</style>` — a `<link>` would be a fetch
      engine/whispers.mjs replaces the one-line `@inline engine/whispers.mjs`
                          block comment (WHISPERS_MARKER below) in a panel
                          with the module's text, every `export ` keyword
                          stripped (a Blob script is not a module)

  Each is a hard error when the real source is missing its marker, when the
  marker appears twice, when the file it names is absent, or when the
  stripped module no longer parses. The placeholder fixtures carry no
  marker and are left alone.

  Three more refusals and one option landed with the shell (U9, the shell
  agent; this is U7's file and the edits are additive):

      · a panel whose top level is anything but simple statements is
        refused ("panel <name> declares at top level") — terser mangles
        each <script> block's top level to one-letter names, so a top-level
        `const` in a Blob-injected panel can collide with a shell name and
        the panel never runs (measured, E §3.4); an IIFE declares nothing;
      · the host scan on dist/ removes exactly one literal before it runs,
        the SVG namespace `http://www.w3.org/2000/svg` that `createElementNS`
        needs for the QR (CONSOLE §13). It is a namespace identifier, never
        fetched (`connect-src 'self'` would refuse it anyway), and the scan
        measured `true` on it; it is removed whole, so a split spelling of
        the same host would still be caught;
      · `compress.toplevel` in shrinkShell only: block 1 of the shell is the
        wallet library's chain half published onto a one-shot `$lib`, and
        without that option terser keeps every unreferenced top-level
        function (measured: `function o(){return 2}` survives the default
        options and is dropped with it). The panels are IIFEs and lose
        nothing; selftest reads the source, not the build.

  Sources: `engine/app.html` and `engine/panels/<name>.js` (U9). Until
  those land this builds from `tools/fixtures/` — a placeholder shell and
  six placeholder panels that read `window.INTACT` and render through
  `textContent` — and says so loudly, so a `dist/` built from the
  placeholder is never mistaken for the console.

    node tools/build-app.mjs                 build into dist/
    node tools/build-app.mjs --no-min        skip minification
    node tools/build-app.mjs --chunk 20000   shard size in bytes
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { minify } from "terser";
import { keccak256 } from "ethereum-cryptography/keccak.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARGV = process.argv.slice(2);
const has = (f) => ARGV.includes(f);
const arg = (f, d) => { const i = ARGV.indexOf(f); return i < 0 ? d : ARGV[i + 1]; };

const MINIFY = !has("--no-min");
const CHUNK = Number(arg("--chunk", 24000));
const MAX_SHARD = 24575;                       // EIP-170 minus the STOP prefix
export const SHELL_GZIP_CEILING = 15_000;      // DESIGN §5.5 said 18,000; see the header (U9, D16)
export const PANEL_GZIP_CEILING = 8_192;       // DESIGN §5.1
export const PANELS = ["swap", "social", "launch", "vault", "identity", "agent"];

if (CHUNK > MAX_SHARD) throw new Error(`--chunk ${CHUNK} exceeds the EIP-170 ceiling`);

/*  The CSP every served document carries. The loader runs under it and
    `document.open()` keeps the policy container, so the inflated shell
    runs under it too: inline scripts (the state gap, the loader, the
    shell), Blob scripts (the hash-checked panels), inline styles,
    data:/blob: images, and no network path but the origin that served
    the page plus whatever an injected provider does on its own.        */
export const CSP =
  "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; " +
  "img-src data: blob:; connect-src 'self'; form-action 'none'; base-uri 'none'";

/*  The page the loader lands in before it replaces itself. Kept
    deliberately plain: if inflation fails this is what a reader is left
    looking at.                                                            */
export const PROLOGUE =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="color-scheme" content="dark"><title>INTACT</title>' +
  "<style>html,body{margin:0;height:100%;background:#07080c;color:#8b95ad;" +
  "font:14px ui-monospace,SFMono-Regular,Menlo,monospace}</style>" +
  "</head><body>";

/*──────────────── the refusals ────────────────*/

/// @dev The patterns are assembled from pieces so this file's own text
///      never contains the literal it forbids.
const FORBIDDEN = [
  { re: new RegExp('src\\s*=\\s*["\']https?:' + "//", "i"), why: "an external script or image source" },
  { re: new RegExp("\\bev" + "al\\s*\\("), why: "eval" },
  { re: new RegExp("\\bnew\\s+Fun" + "ction\\s*\\("), why: "new Function" },
  { re: new RegExp("\\(\\s*1n\\s*<<\\s*256n\\s*\\)\\s*-\\s*1n"), why: "the (1n<<" + "256n)-1n mask" },
  { re: new RegExp("\\binner" + "HTML\\s*="), why: "an innerHTML assignment" },
  { re: new RegExp("\\bdocument\\.write\\s*\\("), why: "document.write in the shell (only the loader may)" }
];

export function refuse(text, label) {
  for (const f of FORBIDDEN) if (f.re.test(text)) throw new Error(`${label} contains ${f.why}`);
}

/// The loader in src/Renderer.sol must declare nothing at global scope:
/// document.open() keeps the Window, so a name declared before the write
/// is still declared after it and collides with the minified shell.
export function checkLoader() {
  const sol = fs.readFileSync(path.join(ROOT, "src/Renderer.sol"), "utf8");
  const m = sol.match(/string internal constant INFLATE =\s*([\s\S]*?);\n/);
  if (!m) throw new Error("src/Renderer.sol has no INFLATE constant");
  const loader = m[1].split("\n").map((l) => l.trim().replace(/^'|'$/g, "")).join("");
  const outside = loader.replace(/\(async\(\)=>\{[\s\S]*\}\)\(\)/, "");
  if (/\b(?:const|let|var|function|class)\b/.test(outside)) {
    throw new Error("the loader declares something at global scope: " + outside.slice(0, 120));
  }
  if (!loader.includes("self.$INTACT")) throw new Error("the loader does not read self.$INTACT");
  return loader;
}

/*──────────────── the inlinings ────────────────*/

export const CSS_MARKER = '<link rel="stylesheet" href="app.css">';
/// The one host-shaped literal a document may carry: a namespace, not a URL
/// anything fetches. verify-site's B3 removes the same string before its scan.
export const SVG_NS = "http://www.w3.org/2000/svg";
export const WHISPERS_MARKER = "/*@inline engine/whispers.mjs*/";

/// `engine/app.css` into the shell at its single marker. A fixture (no
/// marker) passes through untouched; the real shell must carry exactly one.
export function inlineCss(html, { fixture, cssPath = path.join(ROOT, "engine/app.css") } = {}) {
  const n = html.split(CSS_MARKER).length - 1;
  if (n === 0) {
    if (fixture) return html;
    throw new Error(`the shell has no ${CSS_MARKER} marker — engine/app.css has no way in`);
  }
  if (n > 1) throw new Error(`the shell carries the app.css marker ${n} times; exactly one`);
  if (!fs.existsSync(cssPath)) throw new Error(`the shell asks for app.css and ${path.relative(ROOT, cssPath)} does not exist`);
  const css = fs.readFileSync(cssPath, "utf8");
  if (/<\/style/i.test(css)) throw new Error("engine/app.css contains </style> and would end its own block");
  return html.replace(CSS_MARKER, () => "<style>" + css + "</style>");
}

/// `engine/whispers.mjs` into a panel at its marker line, `export ` stripped
/// so the text is a script, not a module. Only the social panel carries the
/// marker today; any panel may. A fixture passes through.
/// A panel is one IIFE and nothing else at its top level. Each <script>
/// block's top level is mangled separately, so a panel's own `const x`
/// becomes a one-letter global that can already be declared by the shell —
/// a SyntaxError before the panel's first line runs. Parsed with terser's
/// own parser (no minification), so what is judged is the source.
export async function checkPanelTopLevel(js, name) {
  const r = await minify(js, { compress: false, mangle: false, format: { ast: true } });
  if (r.error) throw r.error;
  const bad = r.ast.body.filter((n) => n.TYPE !== "SimpleStatement");
  if (bad.length) throw new Error(`panel ${name} declares at top level (${bad.map((n) => n.TYPE).join(", ")}); a panel is one IIFE`);
}

export function inlineWhispers(js, name, { fixture, modPath = path.join(ROOT, "engine/whispers.mjs") } = {}) {
  const n = js.split(WHISPERS_MARKER).length - 1;
  if (n === 0) {
    if (fixture || name !== "social") return js;
    throw new Error(`panel social has no ${WHISPERS_MARKER} marker — the sealing module has no way in`);
  }
  if (n > 1) throw new Error(`panel ${name} carries the whispers marker ${n} times; exactly one`);
  if (!fs.existsSync(modPath)) throw new Error(`panel ${name} asks for whispers.mjs and ${path.relative(ROOT, modPath)} does not exist`);
  const stripped = fs.readFileSync(modPath, "utf8").replace(/^(\s*)export\s+/gm, "$1");
  if (/\bexport\b/.test(stripped)) throw new Error("whispers.mjs still says `export` after stripping — an inline form the build does not handle");
  try { new vm.Script(stripped, { filename: "whispers.inlined.js" }); }
  catch (e) { throw new Error(`whispers.mjs does not parse once its exports are stripped: ${e.message}`); }
  return js.replace(WHISPERS_MARKER, () => stripped);
}

/*──────────────── minification ────────────────*/

async function shrinkShell(html) {
  const scriptRe = /<script>([\s\S]*?)<\/script>/g;
  const styleRe = /<style>([\s\S]*?)<\/style>/g;
  let out = html;
  const scripts = [...html.matchAll(scriptRe)];
  if (!scripts.length) throw new Error("no <script> block in the shell");
  for (const s of scripts) {
    const r = await minify(s[1], {
      ecma: 2022, module: false,
      /*  toplevel: the shell's two blocks are hashed, published and read
          through window.INTACT, never by name; what nothing references is
          dead (U9, cut rule 6 of the byte budget).                    */
      compress: { passes: 2, drop_debugger: true, toplevel: true },
      mangle: { toplevel: true, reserved: ["INTACT"] },
      format: { comments: false, ascii_only: false }
    });
    if (r.error) throw r.error;
    new vm.Script(r.code, { filename: "shell.min.js" });   // it must still parse
    // function replacement, never a string: a minified script can contain "$1"
    out = out.replace(s[0], () => "<script>" + r.code + "</script>");
  }
  for (const st of [...html.matchAll(styleRe)]) {
    const css = st[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*([{}:;,>])\s*/g, "$1")
      .replace(/;}/g, "}").replace(/\s+/g, " ").trim();
    out = out.replace(st[0], () => "<style>" + css + "</style>");
  }
  return out.replace(/>\s*\n\s*</g, "><").trim();
}

async function shrinkPanel(js, name) {
  const r = await minify(js, {
    ecma: 2022, module: false,
    compress: { passes: 2, drop_debugger: true },
    mangle: { toplevel: true, reserved: ["INTACT"] },
    format: { comments: false, ascii_only: false }
  });
  if (r.error) throw r.error;
  new vm.Script(r.code, { filename: name + ".min.js" });
  return r.code;
}

/*──────────────── helpers ────────────────*/

const hex = (b) => "0x" + Buffer.from(b).toString("hex");
const kec = (b) => "0x" + Buffer.from(keccak256(Buffer.from(b))).toString("hex");
const chunk = (buf) => {
  const out = [];
  for (let i = 0; i < buf.length; i += CHUNK) out.push(buf.subarray(i, i + CHUNK));
  return out;
};
/* Calldata is 16 gas per non-zero byte and 4 per zero byte since EIP-2028;
   code deposit is 200 gas per byte. The rest is the CREATE and the call. */
const gasFor = (b) => { let g = 53000; for (const x of b) g += x === 0 ? 4 : 16; return g + b.length * 200 + 6000; };

export function sources() {
  const shellPath = fs.existsSync(path.join(ROOT, "engine/app.html"))
    ? path.join(ROOT, "engine/app.html") : path.join(ROOT, "tools/fixtures/app-placeholder.html");
  const panels = PANELS.map((name) => {
    const real = path.join(ROOT, "engine/panels", name + ".js");
    return { name, path: fs.existsSync(real) ? real : path.join(ROOT, "tools/fixtures/panels", name + ".js") };
  });
  const placeholder = shellPath.includes("fixtures") || panels.some((p) => p.path.includes("fixtures"));
  return { shellPath, panels, placeholder, shellIsFixture: shellPath.includes("fixtures") };
}

/*──────────────── build ────────────────*/

export async function build() {
  const { shellPath, panels, placeholder, shellIsFixture } = sources();
  const source = inlineCss(fs.readFileSync(shellPath, "utf8"), { fixture: shellIsFixture });

  if (/window\.INTACT\s*=/.test(source.slice(0, source.indexOf("</head>"))))
    throw new Error("state must be injected by the contract, not baked into the head");
  if (!/window\.INTACT/.test(source)) throw new Error("the shell never reads window.INTACT");
  if (!/<\/head>/.test(source)) throw new Error("the shell has no </head> for the state gap");
  if (!PROLOGUE.includes("Content-Security-Policy")) throw new Error("the prologue carries no CSP");
  refuse(source, "the shell");
  const loader = checkLoader();

  const doc = MINIFY ? await shrinkShell(source) : source;
  if (!/<\/head>/.test(doc)) throw new Error("minifier ate the </head>");
  if (!/window\.INTACT/.test(doc)) throw new Error("minifier ate the state hook");
  refuse(doc, "the minified shell");

  const headBuf = Buffer.from(PROLOGUE, "utf8");
  const bodyBuf = zlib.gzipSync(Buffer.from(doc, "utf8"), { level: 9 });
  if (zlib.gunzipSync(bodyBuf).toString("utf8") !== doc) throw new Error("gzip round trip did not reproduce the shell");
  if (bodyBuf.length > SHELL_GZIP_CEILING)
    throw new Error(`the shell is ${bodyBuf.length} bytes of gzip, over the ${SHELL_GZIP_CEILING} ceiling — shrink it`);

  const builtPanels = [];
  for (const p of panels) {
    const js = inlineWhispers(fs.readFileSync(p.path, "utf8"), p.name, { fixture: p.path.includes("fixtures") });
    refuse(js, `panel ${p.name}`);
    if (!/window\.INTACT/.test(js)) throw new Error(`panel ${p.name} never reads window.INTACT`);
    await checkPanelTopLevel(js, p.name);
    const min = MINIFY ? await shrinkPanel(js, p.name) : js;
    refuse(min, `minified panel ${p.name}`);
    const gz = zlib.gzipSync(Buffer.from(min, "utf8"), { level: 9 });
    if (zlib.gunzipSync(gz).toString("utf8") !== min) throw new Error(`gzip round trip failed for ${p.name}`);
    if (gz.length > PANEL_GZIP_CEILING)
      throw new Error(`panel ${p.name} is ${gz.length} bytes of gzip, over the ${PANEL_GZIP_CEILING} ceiling`);
    builtPanels.push({ name: p.name, bytes: gz.length, inflatedBytes: Buffer.byteLength(min, "utf8"),
                       hash: kec(Buffer.from(min, "utf8")), gzipHash: kec(gz), data: hex(gz), source: min });
  }

  const H = chunk(headBuf);
  const B = chunk(bodyBuf);
  const engineHash = kec(Buffer.from(doc, "utf8"));

  /*  `placeholder` is true while ANY source is a fixture; `shellIsFixture` and `fixturePanels`
      say which, so a runner can hold a fixture panel against its landed group file and a
      label can say "shell" only when it means the shell (U9, additive). */
  const plan = {
    mode: "packed", minified: MINIFY, placeholder, shellIsFixture, chunkBytes: CHUNK,
    fixturePanels: panels.filter((p) => p.path.includes("fixtures")).map((p) => p.name),
    shell: path.relative(ROOT, shellPath),
    sourceBytes: Buffer.byteLength(source, "utf8"),
    documentBytes: Buffer.byteLength(doc, "utf8"),
    storedBytes: headBuf.length + bodyBuf.length,
    inflatedSize: Buffer.byteLength(doc, "utf8"),
    engineHash,
    csp: CSP,
    head: H.map((b, i) => ({ i, bytes: b.length, gas: gasFor(b), hash: kec(b), data: hex(b) })),
    body: B.map((b, i) => ({ i, bytes: b.length, gas: gasFor(b), hash: kec(b), data: hex(b) })),
    panels: builtPanels.map(({ source, ...p }) => p)
  };

  const dist = path.join(ROOT, "dist");
  fs.mkdirSync(path.join(dist, "panels"), { recursive: true });
  fs.writeFileSync(path.join(dist, "shards.json"), JSON.stringify(plan, null, 1));
  fs.writeFileSync(path.join(dist, "app.html"), doc);
  for (const p of builtPanels) fs.writeFileSync(path.join(dist, "panels", p.name + ".js"), p.source);
  fs.writeFileSync(path.join(dist, "manifest.json"), JSON.stringify({
    engineHash, inflatedSize: plan.inflatedSize,
    shardHashes: [...plan.head.map((s) => s.hash), ...plan.body.map((s) => s.hash), ...builtPanels.map((p) => p.gzipHash)],
    panelHashes: Object.fromEntries(builtPanels.map((p) => [p.name, p.hash])),
    loaderHash: kec(Buffer.from(loader, "utf8")),
    placeholder
  }, null, 1));

  /*  No RPC string anywhere in dist/ (DESIGN §5.1): the only network path
      a document has is the origin that served it and an injected provider. */
  for (const f of ["app.html", ...builtPanels.map((p) => "panels/" + p.name + ".js")]) {
    /*  The sole exception: the SVG namespace identifier the QR's
        createElementNS needs (CONSOLE §13). Removed whole, before the scan,
        so "www.w3" split across two strings would still be a host.      */
    const t = fs.readFileSync(path.join(dist, f), "utf8").split(SVG_NS).join("");
    if (/https?:\/\/[a-z0-9.-]+\.(?:org|com|io|xyz|net)\b/i.test(t) || /\bwss?:\/\//i.test(t)) {
      throw new Error(`dist/${f} names a host — no RPC URL may ship in a document`);
    }
  }
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const plan = await build();
  const all = [...plan.head, ...plan.body];
  const totalGas = all.reduce((a, x) => a + x.gas, 0) + plan.panels.reduce((a, p) => a + gasFor(Buffer.from(p.data.slice(2), "hex")), 0);
  const pct = (a, b) => ((a / b) * 100).toFixed(1) + "%";
  console.log(`
  INTACT · shard plan${plan.placeholder ? "   \x1b[33m(PLACEHOLDER shell/panels from tools/fixtures/ — not the console)\x1b[0m" : ""}
  ───────────────────────────────────────────────────────────────
  shell               ${plan.shell}
  source              ${plan.sourceBytes.toLocaleString()} bytes
  after minifying     ${plan.documentBytes.toLocaleString()} bytes   ${pct(plan.documentBytes, plan.sourceBytes)} of source
  shell gzip          ${plan.body.reduce((a, s) => a + s.bytes, 0).toLocaleString()} bytes   (ceiling ${SHELL_GZIP_CEILING.toLocaleString()}; budget 14,000)
  stored on chain     ${plan.storedBytes.toLocaleString()} bytes   ${pct(plan.storedBytes, plan.sourceBytes)} of source  (the plain prologue + the shell gzip)
  engine hash         ${plan.engineHash}
  ───────────────────────────────────────────────────────────────
  head                ${plan.head.reduce((a, s) => a + s.bytes, 0).toLocaleString()} bytes -> ${plan.head.length} shard(s)
  body                ${plan.body.reduce((a, s) => a + s.bytes, 0).toLocaleString()} bytes -> ${plan.body.length} shard(s)`);
  for (const p of plan.panels) {
    console.log(`  panel ${p.name.padEnd(9)}     ${String(p.bytes).padStart(6)} bytes gzip  ${String(p.inflatedBytes).padStart(6)} inflated  ${p.hash.slice(0, 18)}…`);
  }
  console.log(`  transactions        ${all.length + plan.panels.length} load(s) + setEngineHash + freeze
  storage gas         ~${(totalGas / 1e6).toFixed(2)}M
  ───────────────────────────────────────────────────────────────
  wrote dist/shards.json, dist/manifest.json, dist/app.html, dist/panels/*.js
`);
}
