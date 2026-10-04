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
  (src/Renderer.sol INFLATE) that declares a global, a shell over 18,000
  bytes of gzip, a panel over 8,192.

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
export const SHELL_GZIP_CEILING = 18_000;      // DESIGN §5.5
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
      compress: { passes: 2, drop_debugger: true },
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
  return { shellPath, panels, placeholder };
}

/*──────────────── build ────────────────*/

export async function build() {
  const { shellPath, panels, placeholder } = sources();
  const source = fs.readFileSync(shellPath, "utf8");

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
    const js = fs.readFileSync(p.path, "utf8");
    refuse(js, `panel ${p.name}`);
    if (!/window\.INTACT/.test(js)) throw new Error(`panel ${p.name} never reads window.INTACT`);
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

  const plan = {
    mode: "packed", minified: MINIFY, placeholder, chunkBytes: CHUNK,
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
    const t = fs.readFileSync(path.join(dist, f), "utf8");
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
  stored on chain     ${plan.storedBytes.toLocaleString()} bytes   ${pct(plan.storedBytes, plan.sourceBytes)} of source  (ceiling ${SHELL_GZIP_CEILING.toLocaleString()} gzip)
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
