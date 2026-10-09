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
  and what the chain says, and of one of two kinds (IPSEITY's distinction,
  kept rather than collapsed): a DRIFT is the record and the chain
  answering differently; a CONTRADICTION is the chain answering one
  question two ways — the hub's `POOL()` against the factory's own
  `predict(salts.pool)`, a facet's `intactConfigHash` against the hub's,
  the factory's `TIMELOCK()` against the arithmetic — which no edit to the
  record could repair. Exit 1 with the list; exit 0 with "0 disagreeing"
  — the sentence INVARIANTS.md H3 names.

  A contract the record names that has no code answers every read with
  `0x`; each such field is reported as "(no answer)" and the walk goes on
  to the end, so the list is complete (the first version threw on the
  first empty array decode and never printed its last line).

      RPC_URL=… node tools/recover-record.mjs deployments/<chainId>.json

  The endpoint comes from the environment (31337 defaults to the local
  node); the record never carries one, since a record that named the node
  that verifies it would be choosing its own oracle.

  Read-only: any syntactically valid key can make `eth_call`, so a lost
  deployer key never stops a recovery (IPSEITY's rule, kept).
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decAddr, decUint, decBool } from "./evm.mjs";
import { REGISTRY, REGISTRY_RUNTIME, ZERO, PANELS, predictCreate, encRequest, decResponse } from "./site.mjs";
import { PINS, BAND_GETTERS, SALTED, PLACEHOLDERS, RECORD_KEYS, ROUTER_HASHES, venueTargets,
         saltOf, predictCreate3, kec, decWords, decAddrs, decBytes4s, adapt } from "./deploy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const low = (a) => String(a).toLowerCase();
const kecHex = (hex) => kec(Buffer.from(hex.replace(/^0x/, ""), "hex"));

/*  A compiled artifact by contract name, for the codehash-vs-source check.
    Optional: a recovery with no out/solc.json still checks the chain
    against the record; it only cannot say whether the record matched the
    source it claims.                                                    */
function compiled(out, name, which = "deployedBytecode") {
  if (!out) return null;
  for (const [file, cs] of Object.entries(out.contracts || {})) {
    if (cs[name] && !file.startsWith("test/")) return "0x" + cs[name].evm[which].object;
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
 * { disagreements: [{field, want, have, kind}], checked, missing: [keys] },
 * `kind` being "drift" (record vs chain) or "contradiction" (chain vs chain).
 * `missing` is a key a complete deployment has that the record lacks — not
 * fatal, as a chain may predate a contract; everything in `disagreements` is.
 */
export async function recover(ad, rec, { out = null, log = () => {} } = {}) {
  const D = [];
  let checked = 0;
  const NO = "(no answer)";
  const say = (field, want, have, kind = "drift") => { checked++; if (low(want) !== low(have)) D.push({ field, want: String(want), have: String(have), kind }); };
  const sayJson = (field, want, have, kind = "drift") => { checked++; const a = JSON.stringify(want), b = JSON.stringify(have); if (a !== b) D.push({ field, want: a.slice(0, 160), have: b.slice(0, 160), kind }); };
  const C = rec.contracts || {};
  /*  Every read tolerates a codeless or reverting target: `null` for a
      decoded value, so the field is reported as "(no answer)" and the
      walk continues. A read that throws is the same fact as `0x`.      */
  const rawOf = async (at, sig, args = []) => { try { const r = await ad.read(at, sig, args); return r && r !== "0x" ? low(r) : null; } catch { return null; } };
  const addrOf = async (at, sig, args = []) => { const r = await rawOf(at, sig, args); return r ? low(decAddr(r)) : null; };
  const uintOf = async (at, sig, args = []) => { const r = await rawOf(at, sig, args); return r ? decUint(r) : null; };
  const boolOf = async (at, sig, args = []) => { const r = await rawOf(at, sig, args); return r ? decBool(r) : null; };
  const wordsOf = async (at, sig, args = []) => { const r = await rawOf(at, sig, args); return r ? decWords(r).map(low) : null; };
  const or = (v) => (v === null || v === undefined ? NO : v);

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

  /*── the factory, its gate, and every salt three ways ──*/
  if (rec.factoryVia?.create) say("factory = CREATE(deployer, nonce)", rec.factory, predictCreate(rec.deployer, rec.factoryVia.create.nonce));
  if (rec.factory) {
    say("factory.DEPLOYER = deployer", rec.deployer, or(await addrOf(rec.factory, "DEPLOYER()")));
    if (rec.salts?.timelock) {
      // chain vs arithmetic: the gate's second caller must be where the timelock salt lands
      say("factory.TIMELOCK = CREATE3(factory, salts.timelock)", predictCreate3(rec.factory, rec.salts.timelock), or(await addrOf(rec.factory, "TIMELOCK()")), "contradiction");
    }
  }
  const predictedOnChain = {};
  for (const key of [...SALTED, ...PLACEHOLDERS]) {
    const salt = rec.salts?.[key];
    if (!salt) continue;
    say(`salts.${key} = keccak("intact.v1.${key}")`, saltOf(key), salt);
    const predicted = predictCreate3(rec.factory, salt);
    const onChain = await addrOf(rec.factory, "predict(bytes32)", [salt]);
    predictedOnChain[key] = onChain;
    say(`factory.predict(salts.${key})`, predicted, or(onChain));
    if (C[key]) say(`contracts.${key} = CREATE3(factory, salt)`, C[key], predicted);
    else if (PLACEHOLDERS.includes(key)) {
      say(`placeholders.${key}`, rec.placeholders?.[key] ?? "(unrecorded)", predicted);
      say(`placeholders.${key} is codeless`, "0x", await ad.codeAt(predicted));
    }
  }

  /*── every pin, both directions: against the record (drift) and, where
       the target is a salted key, against the factory's own prediction
       (a contradiction: two chain answers to "where is the pool?") ──*/
  const world = { ...C, ...(rec.placeholders || {}), ...venueTargets(rec.venues) };
  if (!C.router) world.router = ZERO;
  for (const [holder, getter, target] of PINS) {
    if (!C[holder]) continue;
    const have = await addrOf(C[holder], getter);
    say(`${holder}.${getter.replace("()", "")} → ${target}`, world[target] ?? ZERO, or(have));
    if (predictedOnChain[target] && have && !(target === "router" && !C.router)) {
      say(`${holder}.${getter.replace("()", "")} = factory.predict(salts.${target})`, predictedOnChain[target], have, "contradiction");
    }
  }
  for (const [holder, getter] of BAND_GETTERS) {
    if (!C[holder]) continue;
    const want = getter === "BAND()" ? rec.band?.band : getter === "BAND_LO()" ? rec.band?.lo : rec.band?.hi;
    say(`${holder}.${getter}`, want, or(await uintOf(C[holder], getter)));
  }
  if (C.hub) say("hub.REGISTRY", REGISTRY, or(await addrOf(C.hub, "REGISTRY()")));

  /*── the Router's venue hashes and the Kiln's Coin template ──*/
  if (C.router) {
    const hashOf = async (a) => { const code = a && a !== ZERO ? await ad.codeAt(a) : "0x"; return code === "0x" ? "0x" + "00".repeat(32) : kecHex(code); };
    const want = [rec.codehashes?.pool ?? "(unrecorded)", await hashOf(rec.venues?.swapRouter02), await hashOf(rec.venues?.poolManager),
                  rec.venues?.launchHookCodehash || "0x" + "00".repeat(32)];
    for (let i = 0; i < ROUTER_HASHES.length; i++) say(`router.${ROUTER_HASHES[i].replace("()", "")}`, want[i], or(await rawOf(C.router, ROUTER_HASHES[i])));
  }
  if (C.kiln && rec.coinTemplate) {
    const coin = compiled(out, "Coin", "bytecode");
    if (coin) {
      say("coinTemplate.keccak = keccak(compiled Coin creation code)", rec.coinTemplate.keccak, kecHex(coin));
      say("coinTemplate.bytes", rec.coinTemplate.bytes, (coin.length - 2) / 2);
      const kilnCode = await ad.codeAt(C.kiln);
      say("kiln carries the Coin template (on-chain bytes include it)", true, kilnCode !== "0x" && kilnCode.includes(coin.slice(2)));
    }
  }

  /*── the Catalog ──*/
  if (C.catalog) {
    const ag = await rawOf(C.catalog, "agrees()");
    say("Catalog.agrees()", true, ag ? decBool(ag, 0) : NO);
    say("catalogHash", rec.catalogHash, or(await rawOf(C.catalog, "catalogHash()")));
  }

  /*── the ship rule against the hub's actual form ──*/
  if (C.hub && (await ad.codeAt(C.hub)) !== "0x") {
    const loupe = await rawOf(C.hub, "facetAddresses()");
    const facetAddrs = loupe ? decAddrs(loupe).map(low) : null;
    const form = facetAddrs ? "diamond" : "monolith";
    say("shipBuild.build", rec.shipBuild?.build, form);
    if (facetAddrs && rec.shipBuild?.facets) {
      const recorded = Object.values(rec.shipBuild.facets).map((f) => low(f.address)).sort();
      sayJson("facetAddresses()", recorded, [...facetAddrs].sort());
      say("facetAddress(diamondCut)", ZERO, (await addrOf(C.hub, "facetAddress(bytes4)", ["0x1f931c1c"])) ?? ZERO);
      const hubHash = await rawOf(C.hub, "intactConfigHash()");
      for (const [name, f] of Object.entries(rec.shipBuild.facets)) {
        const key = name[0].toLowerCase() + name.slice(1);
        say(`shipBuild.facets.${name}.address = contracts.${key}`, f.address, C[key] ?? "(unrecorded)");
        const code = await ad.codeAt(f.address);
        say(`shipBuild.facets.${name}.codehash`, f.codehash, code === "0x" ? "no code" : kecHex(code));
        const selsRaw = await rawOf(C.hub, "facetFunctionSelectors(address)", [f.address]);
        sayJson(`shipBuild.facets.${name}.selectors`, [...f.selectors].map(low).sort(), selsRaw ? decBytes4s(selsRaw).map(low).sort() : null);
        // chain vs chain: the facet and the hub were built from one config
        say(`${name}.intactConfigHash = hub's`, or(hubHash), or(await rawOf(f.address, "intactConfigHash()")), "contradiction");
      }
    }
  } else if (C.hub) {
    say("shipBuild.build", rec.shipBuild?.build, NO);
  }

  /*── the Engine (every read tolerant: a codeless Engine lists every field as "(no answer)") ──*/
  const E = rec.engine;
  if (E && C.engine) {
    const e = C.engine;
    say("engine.address = contracts.engine", E.address, e);
    if (E.via?.create) say("engine = CREATE(deployer, nonce)", e, predictCreate(E.via.create.from, E.via.create.nonce));
    say("engine.frozen", true, or(await boolOf(e, "frozen()")));
    say("engine.engineHash", E.engineHash, or(await rawOf(e, "engineHash()")));
    say("engine.inflatedSize", E.inflatedSize, or(await uintOf(e, "inflatedSize()")));
    say("engine.curator", E.curator, or(await addrOf(e, "curator()")));
    sayJson("engine.shardHashes", E.shardHashes.map(low), await wordsOf(e, "shardHashes()"));
    for (let i = 0; i < PANELS.length; i++) {
      say(`engine.panelHashes.${PANELS[i]}`, E.panelHashes[PANELS[i]], or(await rawOf(e, "panelHash(uint256)", [i])));
    }
    const counts = await rawOf(e, "shardCount()");
    say("engine.head.length", E.head.length, counts ? decUint(counts, 0) : NO);
    say("engine.body.length", E.body.length, counts ? decUint(counts, 1) : NO);
    for (let i = 0; i < E.head.length; i++) {
      say(`engine.head[${i}]`, E.head[i], or(await addrOf(e, "head(uint256)", [i])));
      say(`engine.head[${i}] = CREATE(engine, ${1 + i})`, predictCreate(e, 1 + i), E.head[i]);
    }
    for (let i = 0; i < E.body.length; i++) {
      say(`engine.body[${i}]`, E.body[i], or(await addrOf(e, "body(uint256)", [i])));
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
    say("timelock.admin", rec.timelock.admin, or(await addrOf(C.timelock, "admin()")));
    say("timelock.delay", rec.timelock.delay, or(await uintOf(C.timelock, "DELAY()")));
    say("timelock.grace", rec.timelock.grace, or(await uintOf(C.timelock, "GRACE()")));
  }
  if (C.premises && E) {
    try {
      const man = decResponse(await ad.call(C.premises, encRequest(["manifest"])));
      say("/manifest status", 200, man.status);
      const j = JSON.parse(man.body);
      say("/manifest.engineHash", E.engineHash, j.engineHash);
      say("/manifest.catalogHash", rec.catalogHash, j.catalogHash);
      say("/manifest.crestCodehash = codehashes.crest", rec.codehashes?.crest, j.crestCodehash);
    } catch (e) { checked++; D.push({ field: "/manifest", want: "200", have: "no answer: " + e.message.slice(0, 80), kind: "drift" }); }
  }

  for (const d of D) log(d.kind === "contradiction" ? `  !! ${d.field}: ${d.want} · but ${d.have} (contradiction: two chain answers)` : `  ! ${d.field}: record ${d.want} · chain ${d.have}`);
  for (const k of missing) log(`  - ${k}: in neither the record nor the walk (not fatal: a chain may predate a contract)`);
  return { disagreements: D, checked, missing };
}

/*═══════════════════ the CLI ═══════════════════*/

if (import.meta.url === `file://${process.argv[1]}`) {
  const recPath = process.argv[2];
  if (!recPath) { console.error("which deployment? node tools/recover-record.mjs deployments/<chainId>.json"); process.exit(2); }
  const rec = JSON.parse(fs.readFileSync(path.resolve(ROOT, recPath), "utf8"));
  /// never the record's: a record that named the node that verifies it would be choosing its own oracle
  const rpc = process.env.RPC_URL || (rec.chainId === 31337 ? "http://127.0.0.1:8545" : null);
  if (!rpc) { console.error(`RPC_URL is required for chain ${rec.chainId}: the record carries no endpoint, by design`); process.exit(2); }
  const { RpcChain, DEV_KEYS } = await import("./rpc.mjs");
  const c = await RpcChain.open(rpc, process.env.PRIVATE_KEY || DEV_KEYS[0]);
  const ad = adapt(c);
  let out = null;
  const solcJson = path.join(ROOT, "out/solc.json");
  if (fs.existsSync(solcJson)) out = JSON.parse(fs.readFileSync(solcJson, "utf8"));
  else console.log("  (no out/solc.json — codehashes are checked against the record, not against source)");

  console.log(`\n  chain ${c.chainId} · ${path.relative(ROOT, path.resolve(ROOT, recPath))} · ${Object.keys(rec.contracts || {}).length} contracts\n`);
  const r = await recover(ad, rec, { out, log: (s) => console.log(s) });
  const contradictions = r.disagreements.filter((d) => d.kind === "contradiction").length;
  console.log(`\n  ${r.checked} fields checked, ${r.disagreements.length} disagreeing (${r.disagreements.length - contradictions} drift, ${contradictions} contradiction${contradictions === 1 ? "" : "s"}), ${r.missing.length} missing`);
  if (r.disagreements.length) {
    console.log("  a drift means the record and the chain describe different deployments; a contradiction means the chain disagrees with itself");
    process.exitCode = 1;
  } else {
    console.log("  0 disagreeing");
  }
}
