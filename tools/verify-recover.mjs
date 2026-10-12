#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the deployment and its record, proved against the in-process EVM

  Origin: IPSEITY tools/verify-recover.mjs held the recovery's route
  tables to the Solidity source (a getter that resolves is not a getter
  that is right). INTACT U10 can do better, because tools/deploy.mjs is
  written around a chain adapter: the SAME function that deploys a band
  over JSON-RPC deploys here, into tools/evm.mjs, and the same
  tools/recover-record.mjs reads it back. So the sentences BUILD-PLAN names
  are run, not argued:

    · a local full deploy recovers with 0 disagreeing
    · a mis-predicted STEWARD refuses to publish
    · the same salts give the same addresses on two local chains
    · the record names which build shipped and why

  and the recovery is then shown to be a check rather than a report: a
  record tampered in one field — a codehash, a salt, an address, the
  build, a shard pointer — is caught by name; a chain made to disagree
  with itself is reported as a contradiction, not a drift; a record naming
  a codeless Engine is walked to its last line instead of thrown on.

  After the U10 review this file also proves the factory's gate on the
  deployed band (a stranger cannot land the market salt; the Timelock can,
  through its own queue), the two refusals the deployer's header claims
  (a stranger's code at a predicted address; the placeholder shell off
  31337), the stale-journal rule, the declared order, and that the record
  carries no endpoint.

    node tools/verify-recover.mjs
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Chain, warp, BLOCK, encodeParams, enc, decAddr } from "./evm.mjs";
import { compile, shipRule, artifact } from "./compile.mjs";
import { ROOT, adapt, deployIntact, predictCreate3, saltOf, SALTED, PLACEHOLDERS, RECORD_KEYS, PINS, DEPLOY_ORDER,
         PROXY_INITCODE_HASH, bandOf, assertTiles, BANDS, COLLECTION, kec, parseArgs, readDist, atomicWrite, CLI_OPTIONS } from "./deploy.mjs";
import { recover } from "./recover-record.mjs";
import { predictCreate, PANELS } from "./site.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${String(detail).slice(0, 400)}`);
};
const eq = (name, got, want) => ok(name, String(got) === String(want), `got ${String(got).slice(0, 160)}\n      want ${String(want).slice(0, 160)}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const note = (s) => console.log(`      \x1b[2m${s}\x1b[0m`);
const low = (a) => String(a).toLowerCase();
const clone = (o) => JSON.parse(JSON.stringify(o));
const throwsWith = async (fn, re) => { try { await fn(); return null; } catch (e) { return re.test(e.message) ? e.message : "wrong error: " + e.message; } };

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "intact-u10-"));

console.log("\n  \x1b[1mINTACT · verify-recover\x1b[0m");

/*──────────────── arithmetic ────────────────*/
head("the arithmetic every address rests on");
eq("the proxy initcode hash is keccak of the sixteen bytes", kec(Buffer.from("67363d3d37363d34f03d5260086018f3", "hex")), PROXY_INITCODE_HASH);
eq("a salt is keccak of its name", saltOf("hub"), kec(Buffer.from("intact.v1.hub", "utf8")));
ok("predictCreate3 is a pure function of (factory, salt)",
   predictCreate3("0x" + "ab".repeat(20), saltOf("hub")) === predictCreate3("0x" + "ab".repeat(20), saltOf("hub")) &&
   predictCreate3("0x" + "ab".repeat(20), saltOf("hub")) !== predictCreate3("0x" + "ab".repeat(20), saltOf("pool")) &&
   predictCreate3("0x" + "ab".repeat(20), saltOf("hub")) !== predictCreate3("0x" + "cd".repeat(20), saltOf("hub")));
eq("CREATE at nonce 0 from a known key (the hardhat first account)",
   predictCreate("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 0), "0x5fbdb2315678afecb367f032d93f642f64180aa3");
ok("the bands tile the edition exactly once", (() => { try { assertTiles(BANDS, COLLECTION); return true; } catch { return false; } })());
ok("a hole in the bands is refused", (() => { try { assertTiles({ a: { name: "a", first: 1n, last: 10n }, b: { name: "b", first: 12n, last: 4096n } }, 4096n); return false; } catch { return true; } })());
ok("an overlap is refused", (() => { try { assertTiles({ a: { name: "a", first: 1n, last: 10n }, b: { name: "b", first: 10n, last: 4096n } }, 4096n); return false; } catch { return true; } })());
ok("an unbanded, non-rehearsal chain is refused", (() => { try { bandOf(5); return false; } catch { return true; } })());
eq("31337 rehearses the whole edition", `${bandOf(31337).first}-${bandOf(31337).last}`, "1-4096");
eq("Base is band 1, ids 1–3072", `${bandOf(8453).band}:${bandOf(8453).first}-${bandOf(8453).last}`, "1:1-3072");
ok("a repeated CLI option is refused", (() => { try { parseArgs(["--chain", "1", "--chain", "2"]); return false; } catch { return true; } })());

/*──────────────── a local full deploy ────────────────*/
head("a local full deploy recovers with 0 disagreeing");
if (!fs.existsSync(path.join(ROOT, "dist/shards.json"))) {
  const { build } = await import("./build-app.mjs");
  await build();
  note("built dist/ first (it was missing)");
}
const out = compile({ quiet: true });
const ship = shipRule(out);
const c1 = await Chain.open({ chainId: 31337 });
const ad1 = adapt(c1);
const recordPath = path.join(scratch, "31337.json");
const journalPath = path.join(scratch, "31337.journal.json");
let t0 = Date.now();
const rec = await deployIntact(ad1, { out, journalPath, recordPath, rpc: "in-process" });
note(`deployed in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${(Number(rec.gasTotal) / 1e6).toFixed(2)}M gas, ${Object.keys(rec.contracts).length} contracts`);
ok("the record was written", fs.existsSync(recordPath));
ok("the journal was written", fs.existsSync(journalPath));
const r1 = await recover(ad1, rec, { out });
eq("0 disagreeing", r1.disagreements.length, 0);
ok(`${r1.checked} fields were checked (not a vacuous zero)`, r1.checked > 200, r1.checked);
eq("nothing a complete MVB record needs is missing", r1.missing.join(","), "");
ok("every CREATE3 key is in the record except the unconfigured Router", SALTED.filter((k) => k !== "router").every((k) => rec.contracts[k]));
ok("the Router is absent and pinned as zero (no probed venue table for 31337)", !rec.contracts.router && rec.venues === null);
eq("the factory is CREATE(burner, 0)", rec.factory, predictCreate(rec.deployer, 0));
eq("the Engine is CREATE(burner, 2): factory at 0, the Timelock's factory call at 1", rec.engine.address, predictCreate(rec.deployer, 2));
ok("every salted address is CREATE3(factory, keccak('intact.v1.<key>'))",
   SALTED.filter((k) => rec.contracts[k]).every((k) => low(rec.contracts[k]) === low(predictCreate3(rec.factory, saltOf(k)))));
ok("the three post-MVB pins are predicted and codeless", PLACEHOLDERS.every((k) => rec.placeholders[k] === predictCreate3(rec.factory, saltOf(k))) &&
   (await Promise.all(PLACEHOLDERS.map((k) => ad1.codeAt(rec.placeholders[k])))).every((c) => c === "0x"));
ok("the record holds a codehash for every contract", Object.keys(rec.contracts).every((k) => /^0x[0-9a-f]{64}$/.test(rec.codehashes[k])));
ok("the no-immutable contracts reproduce from source; the pinned ones (the factory included, since its gate is two immutables) do not",
   rec.reproducible.engine && rec.reproducible.crest && rec.reproducible.reachImpl && !rec.reproducible.factory &&
   !rec.reproducible.catalog && !rec.reproducible.premises && !rec.reproducible.coreFacet);
ok("every head and body pointer is CREATE(engine, 1 + k) in load order",
   rec.engine.head.every((a, i) => low(a) === low(predictCreate(rec.engine.address, 1 + i))) &&
   rec.engine.body.every((a, i) => low(a) === low(predictCreate(rec.engine.address, 1 + rec.engine.head.length + i))));
eq("six panel pointers follow", rec.engine.panels.length, 6);
eq("the panel names are the lanes in order", rec.engine.panels.map((p) => p.name).join(","), PANELS.join(","));
ok("the record names the gas each step took and a total", Object.keys(rec.gas).length > 20 && BigInt(rec.gasTotal) > 0n);
ok("the record names the toolchain (solc, 800 runs, viaIR, cancun, bytecodeHash none)",
   /^0\.8\.36/.test(rec.toolchain.solc) && rec.toolchain.optimizerRuns === 800 && rec.toolchain.viaIR && rec.toolchain.bytecodeHash === "none");
ok("the record names the burner as the Timelock's admin", low(rec.timelock.admin) === low(rec.deployer));
ok("the record says the shell is the placeholder (dist/ from tools/fixtures/) — or not, truthfully",
   rec.engine.placeholder === JSON.parse(fs.readFileSync(path.join(ROOT, "dist/manifest.json"), "utf8")).placeholder);
eq("the Coin template the Kiln carries is recorded by keccak", /^0x[0-9a-f]{64}$/.test(rec.coinTemplate.keccak), true);
ok("the record's PINS cover every mutual pair both ways",
   [["hub", "pool"], ["hub", "parley"], ["hub", "launchpad"], ["hub", "locks"], ["hub", "steward"], ["hub", "catalog"], ["hub", "renderer"], ["hub", "premises"],
    ["parley", "postage"], ["pool", "launchpad"], ["kiln", "launchpad"]].every(([a, b]) =>
      PINS.some(([h, , t]) => h === a && t === b) && PINS.some(([h, , t]) => h === b && t === a)));
ok("PINS read the Kiln's POOL_MANAGER and the Router's three venue addresses",
   PINS.some(([h, g]) => h === "kiln" && g === "POOL_MANAGER()") && ["SWAP_ROUTER02()", "POOL_MANAGER()", "WETH()"].every((g) => PINS.some(([h, gg]) => h === "router" && gg === g)));
ok("the record carries no endpoint", !("rpc" in rec));
ok("the record's disposition is read from the chain (the burner holds the admin) and the burner's nonce after the run is recorded",
   /^the burner holds the admin/.test(rec.timelock.disposition) && BigInt(rec.burner.nonceAfter) > 2n);
const journal1 = JSON.parse(fs.readFileSync(journalPath, "utf8"));
eq("the journal's steps are in DESIGN §12's declared order", Object.keys(journal1.steps).join(","), DEPLOY_ORDER.filter((k) => journal1.steps[k]).join(","));
ok("every head, body and panel pointer in the journal came from its receipt's log and is the record's",
   rec.engine.head.every((a, i) => low(journal1.loads.find((l) => l.kind === "head" && l.i === i).pointer) === low(a)) &&
   rec.engine.body.every((a, i) => low(journal1.loads.find((l) => l.kind === "body" && l.i === i).pointer) === low(a)) &&
   rec.engine.panels.every((p, i) => low(journal1.loads.find((l) => l.kind === "panel" && l.i === i).pointer) === low(p.address)));

/*──────────────── resume ────────────────*/
head("a crashed run resumes from the journal");
t0 = Date.now();
const again = await deployIntact(ad1, { out, journalPath, recordPath: null, rpc: "in-process" });
note(`re-ran in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
eq("a second run on the same chain sends nothing and lands on the same addresses", JSON.stringify(again.contracts), JSON.stringify(rec.contracts));
eq("and spends no gas", again.gasThisRun, "0");
eq("while its record still carries the whole deployment's cost from the journal", again.gasTotal, rec.gasTotal);
const other = await Chain.open({ chainId: 31337 });
const stranger = await other.as("0x" + "22".repeat(32));
const msg = await throwsWith(() => deployIntact(adapt(stranger), { out, journalPath, recordPath: null }), /belongs to deployer/);
ok("a journal belonging to another deployer is refused", msg && !msg.startsWith("wrong"), msg);
{
  // the journal says this key sent 26 steps; a fresh 31337 says it never did
  const fresh = adapt(await Chain.open({ chainId: 31337 }));
  const stalePath = path.join(scratch, "stale.journal.json");
  fs.copyFileSync(journalPath, stalePath);
  const r = await deployIntact(fresh, { out, journalPath: stalePath, recordPath: null });
  ok("on 31337 a journal the chain never saw is set aside and the run starts clean", fs.readdirSync(scratch).some((f) => /^stale\.journal\.stale-\d+\.json$/.test(f)) && Object.keys(r.contracts).length === Object.keys(rec.contracts).length);
  const band = adapt(await Chain.open({ chainId: 8453 }));
  const stale2 = path.join(scratch, "stale2.journal.json");
  fs.copyFileSync(journalPath, stale2);
  const m = await throwsWith(() => deployIntact(band, { out, journalPath: stale2, recordPath: null }), /nonce 0 — a different chain/);
  ok("on a real band the same contradiction is a refusal", m && !m.startsWith("wrong"), m);
  // a journal naming a factory with no code, on a chain where the key HAS been used: the message names the remedy
  const bogus = path.join(scratch, "bogus.journal.json");
  atomicWrite(bogus, { ...JSON.parse(fs.readFileSync(journalPath, "utf8")), steps: { factory: { address: "0x" + "99".repeat(20), codehash: "0x" + "00".repeat(32) } } });
  const b = await throwsWith(() => deployIntact(ad1, { out, journalPath: bogus, recordPath: null }), /factory at .* with no code .* remove .*bogus\.journal\.json/);
  ok("a journal naming a factory with no code is refused with the remedy named", b && !b.startsWith("wrong"), b);
}

/*──────────────── the refusal ────────────────*/
head("a mis-predicted STEWARD refuses to publish");
const c2 = await Chain.open({ chainId: 31337 });
const badPath = path.join(scratch, "bad.json");
const wrong = "0x" + "57".repeat(20);
const err = await throwsWith(() => deployIntact(adapt(c2), { out, journalPath: null, recordPath: badPath, mispredict: { steward: wrong } }),
                             /refusing to publish/);
ok("the deploy threw a refusal", err && !err.startsWith("wrong"), err);
ok("the refusal names the STEWARD", /STEWARD/.test(err || ""), err);
ok("no record was written", !fs.existsSync(badPath));
const everything = await deployIntact(adapt(await Chain.open({ chainId: 31337 })), { out, journalPath: null, recordPath: null });
eq("while an honest deploy on a fresh chain publishes", Object.keys(everything.contracts).length, Object.keys(rec.contracts).length);

head("code at a predicted address that no journal accounts for is a refusal");
{
  const c3 = await Chain.open({ chainId: 31337 });
  const ad3 = adapt(c3);
  const crestAt = predictCreate3(predictCreate(ad3.from, 0), saltOf("crest"));
  await ad3.setCode(crestAt, "0x6000");                      // a stranger's bytes, before any run
  const m = await throwsWith(() => deployIntact(ad3, { out, journalPath: null, recordPath: null }), /code at crest's predicted address .* does not account for .* refusing/);
  ok("the deploy refuses rather than adopting the stranger's contract", m && !m.startsWith("wrong"), m);
  ok("and the factory it had already landed stays (the salt was never ours to retry)", (await ad3.codeAt(predictCreate(ad3.from, 0))) !== "0x");
}
head("the placeholder shell is refused anywhere but 31337");
{
  const { plan, manifest } = readDist();
  const wire = { ...adapt(await Chain.open({ chainId: 8453 })), inProcess: false };   // what a public endpoint looks like to the function
  const m = await throwsWith(() => deployIntact(wire, { out, plan: { ...plan, placeholder: true }, manifest, journalPath: null, recordPath: null }), /PLACEHOLDER shell .* anywhere but 31337/);
  ok("a placeholder dist/ over a wire to a band is refused before anything is sent", m && !m.startsWith("wrong"), m);
  const local = { ...adapt(await Chain.open({ chainId: 31337 })), inProcess: false };
  const r = await deployIntact(local, { out, plan: { ...plan, placeholder: true }, manifest, journalPath: null, recordPath: null });
  ok("while 31337 over a wire takes it and says so in the record", r.engine.placeholder === true);
}

/*──────────────── two chains ────────────────*/
head("the same salts give the same addresses on two local chains");
const cA = await Chain.open({ chainId: 8453 });
const cB = await Chain.open({ chainId: 10 });
const recA = await deployIntact(adapt(cA), { out, journalPath: null, recordPath: null });
const recB = await deployIntact(adapt(cB), { out, journalPath: null, recordPath: null });
eq("the two chains are different chains", `${recA.chainId}/${recB.chainId}`, "8453/10");
eq("with different bands", `${recA.band.band}:${recA.band.lo}-${recA.band.hi} · ${recB.band.band}:${recB.band.lo}-${recB.band.hi}`, "1:1-3072 · 2:3585-4096");
eq("the same burner gives the same factory", recA.factory, recB.factory);
eq("and every contract lands at the same address", JSON.stringify(recA.contracts), JSON.stringify(recB.contracts));
eq("including the Engine and its shards", JSON.stringify([recA.engine.address, recA.engine.head, recA.engine.body]), JSON.stringify([recB.engine.address, recB.engine.head, recB.engine.body]));
ok("while the band-bearing contracts differ in code (the band is an immutable of the facets and the Catalog)",
   recA.codehashes.coreFacet !== recB.codehashes.coreFacet && recA.codehashes.catalog !== recB.codehashes.catalog);
ok("and the diamond itself, which holds no immutable, does not", recA.codehashes.hub === recB.codehashes.hub);
ok("and the band-free ones do not", recA.codehashes.engine === recB.codehashes.engine && recA.codehashes.reachImpl === recB.codehashes.reachImpl);
eq("the first local chain deployed to the same addresses too", JSON.stringify(rec.contracts), JSON.stringify(recA.contracts));

/*──────────────── the factory's gate ────────────────*/
head("the factory admits the burner and the Timelock, and no one else (on band 1's chain, whose record is then left as it was)");
const read = async (ad, at, sig, args = []) => low(decAddr(await ad.read(at, sig, args)));
const adA = adapt(cA);
eq("factory.DEPLOYER is the burner", await read(adA, recA.factory, "DEPLOYER()"), low(recA.deployer));
eq("factory.TIMELOCK is where the timelock salt landed", await read(adA, recA.factory, "TIMELOCK()"), low(recA.contracts.timelock));
const keysInit = artifact(out, "src/KeyRegistry.sol", "KeyRegistry").bytecode;   // any constructor-less contract will do
const mallory = adapt(await cA.as("0x" + "33".repeat(32)));
const marketAddr = recA.placeholders.market;
const refused = await throwsWith(() => mallory.exec(recA.factory, "deploy(bytes32,bytes)", [saltOf("market"), keysInit], { label: "mallory" }), /revert/);
ok("a stranger's deploy under the market salt reverts (NotDeployer)", refused && !refused.startsWith("wrong"), refused);
eq("and the hub's MARKET stays codeless", await adA.codeAt(marketAddr), "0x");
const tlCall = enc("deploy(bytes32,bytes)", [saltOf("market"), keysInit]);
await adA.exec(recA.contracts.timelock, "queue(address,uint256,bytes,bytes32)", [recA.factory, 0, tlCall, "0x" + "01".repeat(32)], { label: "queue" });
const early = await throwsWith(() => mallory.exec(recA.contracts.timelock, "execute(address,uint256,bytes,bytes32)", [recA.factory, 0, tlCall, "0x" + "01".repeat(32)], { label: "early" }), /revert/);
ok("the queued deployment cannot be executed before the delay", early && !early.startsWith("wrong"), early);
warp(BLOCK.header.timestamp + 7n * 86400n + 1n);
await mallory.exec(recA.contracts.timelock, "execute(address,uint256,bytes,bytes32)", [recA.factory, 0, tlCall, "0x" + "01".repeat(32)], { label: "execute" });
ok("a week later a stranger executes it and the market salt lands where the hub pinned it", (await adA.codeAt(marketAddr)) !== "0x");
eq("which the hub now sees as its MARKET", await read(ad1, recA.contracts.hub, "MARKET()"), low(marketAddr));

/*──────────────── a contradiction ────────────────*/
head("a chain that disagrees with itself is reported as a contradiction, not a drift");
{
  // a factory built by a stranger carries that stranger's DEPLOYER and a
  // TIMELOCK predicted from ITS address; etched over band 2's factory, the
  // chain's TIMELOCK() no longer equals CREATE3(factory, salts.timelock)
  const sc = await (await Chain.open({ chainId: 10 })).as("0x" + "44".repeat(32));
  const sf = await adapt(sc).deploy(artifact(out, "src/lib/Create3Factory.sol", "Create3Factory").bytecode, "", "strangerFactory");
  const adB = adapt(cB);
  await adB.setCode(recB.factory, await adapt(sc).codeAt(sf.address));
  const r = await recover(adB, recB, { out });
  const con = r.disagreements.filter((d) => d.kind === "contradiction");
  ok("factory.TIMELOCK against the arithmetic is a contradiction", con.some((d) => /factory\.TIMELOCK = CREATE3/.test(d.field)), r.disagreements.map((d) => `${d.kind}:${d.field}`).slice(0, 6).join(", "));
  ok("factory.DEPLOYER against the record is a drift", r.disagreements.some((d) => d.kind === "drift" && /factory\.DEPLOYER/.test(d.field)));
  ok("every other pin still agrees with the factory's prediction (predict depends on the address alone; only the gate's own TIMELOCK pin contradicts it)",
     !con.some((d) => /= factory\.predict/.test(d.field) && !/^factory\./.test(d.field)) && con.some((d) => d.field === "factory.TIMELOCK = factory.predict(salts.timelock)"));
}

/*──────────────── the build ────────────────*/
head("the record names which build shipped and why");
eq("shipBuild.build is the ship rule's", rec.shipBuild.build, ship.build);
eq("shipBuild.reason is the ship rule's sentence", rec.shipBuild.reason, ship.reason);
eq("shipBuild.intactBytes is the measured monolith", rec.shipBuild.intactBytes, ship.intactBytes);
if (ship.build === "diamond") {
  eq("four facets are named with address, codehash and selectors", Object.keys(rec.shipBuild.facets).sort().join(","), "CoreFacet,MintFacet,RightsFacet,SiteFacet");
  const total = Object.values(rec.shipBuild.facets).reduce((n, f) => n + f.selectors.length, 0);
  ok(`the facets route ${total} selectors, every one once`, total === new Set(Object.values(rec.shipBuild.facets).flatMap((f) => f.selectors)).size && total > 80);
  ok("no facet routes diamondCut", !Object.values(rec.shipBuild.facets).some((f) => f.selectors.includes("0x1f931c1c")));
  ok("the cut is recorded", Array.isArray(rec.shipBuild.cut) && rec.shipBuild.cut.length === 4);
}
ok("out/ship.json, when present, agrees with the record", !fs.existsSync(path.join(ROOT, "out/ship.json")) ||
   JSON.parse(fs.readFileSync(path.join(ROOT, "out/ship.json"), "utf8")).build === rec.shipBuild.build);

/*──────────────── tampering ────────────────*/
head("a tampered record is caught by name");
const tamper = async (label, mutate, re) => {
  const t = clone(rec);
  mutate(t);
  const r = await recover(ad1, t, { out });
  const hit = r.disagreements.find((d) => re.test(d.field));
  ok(label, r.disagreements.length > 0 && hit, r.disagreements.map((d) => d.field).slice(0, 5).join(", ") || "0 disagreeing");
};
await tamper("a wrong codehash", (t) => { t.codehashes.pool = "0x" + "11".repeat(32); }, /codehashes\.pool/);
await tamper("a wrong salt", (t) => { t.salts.pool = "0x" + "22".repeat(32); }, /salts\.pool/);
await tamper("a swapped address (pool recorded at the parley's)", (t) => { t.contracts.pool = t.contracts.parley; }, /contracts\.pool = CREATE3|hub\.POOL/);
await tamper("a wrong ship build", (t) => { t.shipBuild.build = "monolith"; }, /shipBuild\.build/);
await tamper("a wrong facet selector set", (t) => { Object.values(t.shipBuild.facets)[0].selectors.pop(); }, /selectors/);
await tamper("a wrong shard pointer", (t) => { t.engine.head[0] = t.engine.body[0]; }, /engine\.head\[0\]/);
await tamper("a wrong engine hash", (t) => { t.engine.engineHash = "0x" + "33".repeat(32); }, /engine\.engineHash/);
await tamper("a wrong panel hash", (t) => { t.engine.panelHashes.swap = "0x" + "44".repeat(32); }, /panelHashes\.swap/);
await tamper("a wrong band", (t) => { t.band.hi = "3072"; }, /BAND_HI/);
await tamper("a wrong deployer (the factory's CREATE no longer reproduces)", (t) => { t.deployer = "0x" + "55".repeat(20); }, /factory = CREATE/);
await tamper("a wrong catalog hash", (t) => { t.catalogHash = "0x" + "66".repeat(32); }, /catalogHash/);
await tamper("a wrong Timelock admin", (t) => { t.timelock.admin = "0x" + "77".repeat(20); }, /timelock\.admin/);
await tamper("a recorded contract with no code on this chain", (t) => { t.contracts.crest = "0x" + "88".repeat(20); }, /contracts\.crest/);
await tamper("a wrong venue table (the Kiln's POOL_MANAGER is read back)", (t) => { t.venues = { poolManager: "0x" + "99".repeat(20) }; }, /kiln\.POOL_MANAGER/);
await tamper("a wrong Coin template keccak", (t) => { t.coinTemplate.keccak = "0x" + "aa".repeat(32); }, /coinTemplate\.keccak/);
await tamper("a wrong factory deployer (the gate is read back)", (t) => { t.deployer = t.contracts.crest; t.factoryVia.create.from = t.contracts.crest; }, /factory\.DEPLOYER/);
{
  const t = clone(rec);
  t.contracts.engine = t.engine.address = "0x" + "89".repeat(20);
  let r = null, threw = null;
  try { r = await recover(ad1, t, { out }); } catch (e) { threw = e.message; }
  ok("a record naming a codeless Engine is walked to the end, not thrown on", r && !threw, threw);
  ok("with every Engine field listed as (no answer)", r && ["engine.frozen", "engine.shardHashes", "engine.head.length", "engine.head[0]"].every((f) => r.disagreements.some((d) => d.field === f)),
     r && r.disagreements.filter((d) => d.field.startsWith("engine")).map((d) => d.field).slice(0, 6).join(", "));
  ok("and the walk reached the Timelock and /manifest after it", r && r.checked > 200);
}
const r2 = await recover(ad1, rec, { out: null });
eq("without out/solc.json the recovery still agrees (codehashes against the record only)", r2.disagreements.length, 0);
ok("and checks fewer fields, saying so by the count", r2.checked < r1.checked, `${r2.checked} vs ${r1.checked}`);

/*──────────────── the record's shape ────────────────*/
head("the record's shape (deployments/README.md)");
for (const k of ["schema", "chainId", "band", "deployer", "factory", "factoryVia", "salts", "contracts", "codehashes", "reproducible", "placeholders",
                 "shipBuild", "engine", "catalogHash", "coinTemplate", "registry", "price", "timelock", "venues", "gas", "gasTotal", "toolchain", "writtenAt", "block"]) {
  ok(`has ${k}`, k in rec);
}
eq("schema", rec.schema, "intact.deployment/1");
const written = JSON.parse(fs.readFileSync(recordPath, "utf8"));
eq("the file on disk is the record (minus the path it was written to)", JSON.stringify({ ...written }), JSON.stringify((({ path: _p, ...r }) => r)(rec)));
eq("RECORD_KEYS names the factory, the engine and every salted key", RECORD_KEYS.length, SALTED.length + 2);
ok("the CLI options are the header's five plus --chain", CLI_OPTIONS.join(",") === "chain,confirm,rpc,journal,record,price");
ok("has burner (nonce and balance after the run)", "burner" in rec && "nonceAfter" in rec.burner);

fs.rmSync(scratch, { recursive: true, force: true });
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
