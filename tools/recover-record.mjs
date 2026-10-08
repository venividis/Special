#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · reading a deployment back out of the chain that holds it

  Origin: IPSEITY tools/recover-record.mjs — a record is a convenience,
  the chain is the truth, and the two are two answers to one question.
  IPSEITY walked a Premises → pages → desks tree of public immutables and
  reported drift (record and chain differ), orphans, missing keys and
  contradictions (two routes, two answers). INTACT U10 keeps the stance
  and widens the question, because the record now claims more than
  addresses:

  · every address three ways — the record, the pin that names it on the
    contract that uses it (tools/deploy.mjs `PINS`, both directions of
    every mutual pair), and the CREATE3 arithmetic from (factory, salt),
    checked against the factory's own `predict`. A salt that does not land
    where the record says is a contradiction, not a drift;
  · every codehash, against the record, and for the contracts whose runtime
    carries no immutables against the compiled bytes too (bytecodeHash
    "none" makes that exact);
  · the ship rule: `facetAddresses()` answering is the diamond, a revert
    is the monolith, and either must be what `shipBuild.build` says; in the
    diamond each facet's address, codehash and selector set, the absence of
    `diamondCut`, one `intactConfigHash` across hub and facets;
  · the Engine: frozen, engineHash, inflatedSize, the shard hashes, each
    panel hash, every head/body pointer against the record AND against
    CREATE(engine, 1 + k), each panel pointer holding the gzip the record
    hashes, the Engine itself at CREATE(burner, nonce) as recorded;
  · `Catalog.agrees()`, `catalogHash`, the registry's codehash, the band
    bounds on hub and Catalog, the Timelock's admin.

  Every disagreement is one line naming the field, what the record says
  and what the chain says. Exit 1 with the list; exit 0 with "0
  disagreeing" — the sentence INVARIANTS.md H3 names.

      node tools/recover-record.mjs deployments/<chainId>.json
      RPC_URL=… node tools/recover-record.mjs deployments/8453.json

  Read-only: any syntactically valid key can make `eth_call`, so a lost
  deployer key never stops a recovery (IPSEITY's rule, kept).
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decAddr, decUint, decBool } from "./evm.mjs";
import { REGISTRY, REGISTRY_RUNTIME, ZERO, PANELS, predictCreate, encRequest, decResponse } from "./site.mjs";
import { PINS, BAND_GETTERS, SALTED, PLACEHOLDERS, RECORD_KEYS, saltOf, predictCreate3, kec, decWords, decAddrs, decBytes4s, adapt } from "./deploy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const low = (a) => String(a).toLowerCase();
const kecHex = (hex) => kec(Buffer.from(hex.replace(/^0x/, ""), "hex"));

/*  A compiled artifact by contract name, for the codehash-vs-source check.
    Optional: a recovery with no out/solc.json still checks the chain
    against the record; it only cannot say whether the record matched the
    source it claims.                                                    */
function compiled(out, name) {
  if (!out) return null;
  for (const [file, cs] of Object.entries(out.contracts || {})) {
    if (cs[name] && !file.startsWith("test/")) return "0x" + cs[name].evm.deployedBytecode.object;
  }
  return null;
}
const ARTIFACT = {
  factory: "Create3Factory", engine: "Engine", timelock: "Timelock", crest: "Crest", reachImpl: "Reach", gripImpl: "Grip",
  catalogRows: "CatalogRows", catalogText: "CatalogText", catalogState: "CatalogState", catalog: "Catalog", renderer: "Renderer",
  coreFacet: "CoreFacet", rightsFacet: "RightsFacet", mintFacet: "MintFacet", siteFacet: "SiteFacet",
  keys: "KeyRegistry", roster: "Roster", postage: "Postage", parley: "Parley", locks: "Locks", pool: "Pool", kiln: "Kiln",
  launchpad: "Launchpad", router: "Router", steward: "Steward", premises: "Premises"
};

/**
 * Compare `rec` with the chain behind `ad`. Returns
 * { disagreements: [{field, want, have}], checked, missing: [keys] }.
 * `missing` is a key a complete deployment has that the record lacks — not
 * fatal, as a chain may predate a contract; everything in `disagreements` is.
 */
export async function recover(ad, rec, { out = null, log = () => {} } = {}) {
  const D = [];
  let checked = 0;
  const say = (field, want, have) => { checked++; if (low(want) !== low(have)) D.push({ field, want: String(want), have: String(have) }); };
  const sayJson = (field, want, have) => { checked++; const a = JSON.stringify(want), b = JSON.stringify(have); if (a !== b) D.push({ field, want: a.slice(0, 160), have: b.slice(0, 160) }); };
  const C = rec.contracts || {};
  const addrOf = async (at, sig, args = []) => {
    try { const r = await ad.read(at, sig, args); return r && r !== "0x" ? low(decAddr(r)) : null; } catch { return null; }
  };
  const uintOf = async (at, sig, args = []) => { try { return decUint(await ad.read(at, sig, args)); } catch { return null; } };

  say("chainId", rec.chainId, ad.chainId);

  /*── codehashes: record vs chain, and vs source where reproducible ──*/
  for (const [key, addr] of Object.entries(C)) {
    const code = await ad.codeAt(addr);
    if (code === "0x") { checked++; D.push({ field: `contracts.${key}`, want: addr, have: "no code" }); continue; }
    const have = kecHex(code);
    say(`codehashes.${key}`, rec.codehashes?.[key] ?? "(unrecorded)", have);
    const src = compiled(out, ARTIFACT[key]);
    if (src) {
      const same = kecHex(src) === have;
      say(`reproducible.${key}`, rec.reproducible?.[key] ?? "(unrecorded)", same);
    }
  }
  const missing = RECORD_KEYS.filter((k) => !C[k] && !(k === "router" && !rec.venues) && !(k.endsWith("Facet") && rec.shipBuild?.build === "monolith"));

  /*── the factory, and every salt three ways ──*/
  if (rec.factoryVia?.create) say("factory = CREATE(deployer, nonce)", rec.factory, predictCreate(rec.deployer, rec.factoryVia.create.nonce));
  for (const key of [...SALTED, ...PLACEHOLDERS]) {
    const salt = rec.salts?.[key];
    if (!salt) continue;
    say(`salts.${key} = keccak("intact.v1.${key}")`, saltOf(key), salt);
    const predicted = predictCreate3(rec.factory, salt);
    const onChain = await addrOf(rec.factory, "predict(bytes32)", [salt]);
    say(`factory.predict(salts.${key})`, predicted, onChain);
    if (C[key]) say(`contracts.${key} = CREATE3(factory, salt)`, C[key], predicted);
    else if (PLACEHOLDERS.includes(key)) {
      say(`placeholders.${key}`, rec.placeholders?.[key] ?? "(unrecorded)", predicted);
      say(`placeholders.${key} is codeless`, "0x", await ad.codeAt(predicted));
    }
  }

  /*── every pin, both directions ──*/
  const world = { ...C, ...(rec.placeholders || {}) };
  if (!C.router) world.router = ZERO;
  for (const [holder, getter, target] of PINS) {
    if (!C[holder]) continue;
    const have = await addrOf(C[holder], getter);
    say(`${holder}.${getter.replace("()", "")} → ${target}`, world[target] ?? ZERO, have ?? "(no answer)");
  }
  for (const [holder, getter] of BAND_GETTERS) {
    if (!C[holder]) continue;
    const want = getter === "BAND()" ? rec.band?.band : getter === "BAND_LO()" ? rec.band?.lo : rec.band?.hi;
    say(`${holder}.${getter}`, want, await uintOf(C[holder], getter));
  }
  if (C.hub) say("hub.REGISTRY", REGISTRY, await addrOf(C.hub, "REGISTRY()"));

  /*── the Catalog ──*/
  if (C.catalog) {
    let ag = null;
    try { ag = await ad.read(C.catalog, "agrees()"); } catch { /* reported as false */ }
    say("Catalog.agrees()", true, ag ? decBool(ag, 0) : "(no answer)");
    try { say("catalogHash", rec.catalogHash, await ad.read(C.catalog, "catalogHash()")); } catch { say("catalogHash", rec.catalogHash, "(no answer)"); }
  }

  /*── the ship rule against the hub's actual form ──*/
  if (C.hub) {
    let facetAddrs = null;
    try { facetAddrs = decAddrs(await ad.read(C.hub, "facetAddresses()")).map(low); } catch { /* monolith */ }
    const form = facetAddrs ? "diamond" : "monolith";
    say("shipBuild.build", rec.shipBuild?.build, form);
    if (facetAddrs && rec.shipBuild?.facets) {
      const recorded = Object.values(rec.shipBuild.facets).map((f) => low(f.address)).sort();
      sayJson("facetAddresses()", recorded, [...facetAddrs].sort());
      say("facetAddress(diamondCut)", ZERO, (await addrOf(C.hub, "facetAddress(bytes4)", ["0x1f931c1c"])) ?? ZERO);
      let hubHash = null;
      try { hubHash = await ad.read(C.hub, "intactConfigHash()"); } catch { /* reported */ }
      for (const [name, f] of Object.entries(rec.shipBuild.facets)) {
        const key = name[0].toLowerCase() + name.slice(1);
        say(`shipBuild.facets.${name}.address = contracts.${key}`, f.address, C[key] ?? "(unrecorded)");
        const code = await ad.codeAt(f.address);
        say(`shipBuild.facets.${name}.codehash`, f.codehash, code === "0x" ? "no code" : kecHex(code));
        let sels = null;
        try { sels = decBytes4s(await ad.read(C.hub, "facetFunctionSelectors(address)", [f.address])).map(low).sort(); } catch { /* reported */ }
        sayJson(`shipBuild.facets.${name}.selectors`, [...f.selectors].map(low).sort(), sels);
        let fh = null;
        try { fh = await ad.read(f.address, "intactConfigHash()"); } catch { /* reported */ }
        say(`${name}.intactConfigHash = hub's`, hubHash, fh ?? "(no answer)");
      }
    }
  }

  /*── the Engine ──*/
  const E = rec.engine;
  if (E && C.engine) {
    const e = C.engine;
    say("engine.address = contracts.engine", E.address, e);
    if (E.via?.create) say("engine = CREATE(deployer, nonce)", e, predictCreate(E.via.create.from, E.via.create.nonce));
    say("engine.frozen", true, decBool(await ad.read(e, "frozen()")));
    say("engine.engineHash", E.engineHash, await ad.read(e, "engineHash()"));
    say("engine.inflatedSize", E.inflatedSize, await uintOf(e, "inflatedSize()"));
    say("engine.curator", E.curator, await addrOf(e, "curator()"));
    sayJson("engine.shardHashes", E.shardHashes.map(low), decWords(await ad.read(e, "shardHashes()")).map(low));
    for (let i = 0; i < PANELS.length; i++) {
      say(`engine.panelHashes.${PANELS[i]}`, E.panelHashes[PANELS[i]], await ad.read(e, "panelHash(uint256)", [i]));
    }
    const counts = await ad.read(e, "shardCount()");
    say("engine.head.length", E.head.length, decUint(counts, 0));
    say("engine.body.length", E.body.length, decUint(counts, 1));
    for (let i = 0; i < E.head.length; i++) {
      const have = await addrOf(e, "head(uint256)", [i]);
      say(`engine.head[${i}]`, E.head[i], have ?? "(no answer)");
      say(`engine.head[${i}] = CREATE(engine, ${1 + i})`, predictCreate(e, 1 + i), E.head[i]);
    }
    for (let i = 0; i < E.body.length; i++) {
      const have = await addrOf(e, "body(uint256)", [i]);
      say(`engine.body[${i}]`, E.body[i], have ?? "(no answer)");
      say(`engine.body[${i}] = CREATE(engine, ${1 + E.head.length + i})`, predictCreate(e, 1 + E.head.length + i), E.body[i]);
    }
    const base = 1 + E.head.length + E.body.length;
    for (let i = 0; i < (E.panels || []).length; i++) {
      const p = E.panels[i];
      say(`engine.panels[${i}].address = CREATE(engine, ${base + i})`, predictCreate(e, base + i), p.address);
      const code = await ad.codeAt(p.address);
      say(`engine.panels[${i}] holds its gzip (keccak)`, p.gzipHash, code.length > 4 ? kecHex(code.slice(4)) : "no code");
      say(`engine.panels[${i}].gzipHash = shardHashes[${base - 1 + i}]`, E.shardHashes[base - 1 + i], p.gzipHash);
    }
  }

  /*── the registry, the Timelock, /manifest ──*/
  if (rec.registry) {
    const code = await ad.codeAt(rec.registry.address);
    say("registry.codehash", rec.registry.codehash, code === "0x" ? "no code" : kecHex(code));
    say("registry runtime is the reference", kecHex(REGISTRY_RUNTIME), code === "0x" ? "no code" : kecHex(code));
  }
  if (C.timelock && rec.timelock) {
    say("timelock.admin", rec.timelock.admin, await addrOf(C.timelock, "admin()") ?? "(no answer)");
    say("timelock.delay", rec.timelock.delay, await uintOf(C.timelock, "DELAY()"));
    say("timelock.grace", rec.timelock.grace, await uintOf(C.timelock, "GRACE()"));
  }
  if (C.premises && E) {
    try {
      const man = decResponse(await ad.call(C.premises, encRequest(["manifest"])));
      say("/manifest status", 200, man.status);
      const j = JSON.parse(man.body);
      say("/manifest.engineHash", E.engineHash, j.engineHash);
      say("/manifest.catalogHash", rec.catalogHash, j.catalogHash);
      say("/manifest.crestCodehash = codehashes.crest", rec.codehashes?.crest, j.crestCodehash);
    } catch (e) { checked++; D.push({ field: "/manifest", want: "200", have: "no answer: " + e.message.slice(0, 80) }); }
  }

  for (const d of D) log(`  ! ${d.field}: record ${d.want} · chain ${d.have}`);
  for (const k of missing) log(`  - ${k}: in neither the record nor the walk (not fatal: a chain may predate a contract)`);
  return { disagreements: D, checked, missing };
}

/*═══════════════════ the CLI ═══════════════════*/

if (import.meta.url === `file://${process.argv[1]}`) {
  const recPath = process.argv[2];
  if (!recPath) { console.error("which deployment? node tools/recover-record.mjs deployments/<chainId>.json"); process.exit(2); }
  const rec = JSON.parse(fs.readFileSync(path.resolve(ROOT, recPath), "utf8"));
  const rpc = process.env.RPC_URL || rec.rpc || (rec.chainId === 31337 ? "http://127.0.0.1:8545" : null);
  if (!rpc) { console.error("RPC_URL is required: the record names no endpoint"); process.exit(2); }
  const { RpcChain, DEV_KEYS } = await import("./rpc.mjs");
  const c = await RpcChain.open(rpc, process.env.PRIVATE_KEY || DEV_KEYS[0]);
  const ad = adapt(c);
  let out = null;
  const solcJson = path.join(ROOT, "out/solc.json");
  if (fs.existsSync(solcJson)) out = JSON.parse(fs.readFileSync(solcJson, "utf8"));
  else console.log("  (no out/solc.json — codehashes are checked against the record, not against source)");

  console.log(`\n  chain ${c.chainId} · ${path.relative(ROOT, path.resolve(ROOT, recPath))} · ${Object.keys(rec.contracts || {}).length} contracts\n`);
  const r = await recover(ad, rec, { out, log: (s) => console.log(s) });
  console.log(`\n  ${r.checked} fields checked, ${r.disagreements.length} disagreeing, ${r.missing.length} missing`);
  if (r.disagreements.length) {
    console.log("  a disagreement means the record and the chain describe different deployments");
    process.exitCode = 1;
  } else {
    console.log("  0 disagreeing");
  }
}
