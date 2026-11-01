/*───────────────────────────────────────────────────────────────────────────
  INTACT · the site, deployed into the in-process EVM

  Origin: IPSEITY tools/site.mjs (`deploySite`, the ERC-5219 request
  helpers), rewritten for INTACT U7. This is the harness's deployment,
  not the band's: `tools/deploy.mjs` (U10) does the same wiring through a
  CREATE3 factory under fixed salts and journals every step. The ORDER is
  DESIGN.md §12's and the mutual immutables are predicted the same way:
  every address the hub's config names is computed from the deployer's
  nonce before the hub exists, deployed in that order, and asserted.

  What it refuses to do: deploy the monolith. `Intact` measures over
  EIP-170 and the ship rule picks the diamond (out/ship.json); the harness
  deploys what ships, so a measurement here is a measurement of the
  deployment. `INTACT_IMPL=monolith` is the test suite's switch, run by
  tools/forge.mjs with the size limit lifted; it is not honoured here.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAddressFromString, hexToBytes, bytesToHex, generateAddress, bigIntToUnpaddedBytes } from "@ethereumjs/util";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { artifact } from "./compile.mjs";
import { enc, sel, encodeParams, decAddr } from "./evm.mjs";
import { hubCut } from "./facets.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REGISTRY = "0x000000006551c19487814612e58FE06813775758";
/// The real ERC-6551 registry's 571-byte runtime (keccak 0xda1d5b06…),
/// as test/helpers/Deploy.sol etches it: the hub's constructor checks the
/// codehash, so a stand-in would refuse to construct.
export const REGISTRY_RUNTIME =
  "0x608060405234801561001057600080fd5b50600436106100365760003560e01c8063246a00211461003b5780638a54c52f1461006a575b600080fd5b61004e6100493660046101b7565b61007d565b6040516001600160a01b03909116815260200160405180910390f35b61004e6100783660046101b7565b6100e1565b600060806024608c376e5af43d82803e903d91602b57fd5bf3606c5285605d52733d60ad80600a3d3981f3363d3d373d3d3d363d7360495260ff60005360b76055206035523060601b60015284601552605560002060601b60601c60005260206000f35b600060806024608c376e5af43d82803e903d91602b57fd5bf3606c5285605d52733d60ad80600a3d3981f3363d3d373d3d3d363d7360495260ff60005360b76055206035523060601b600152846015526055600020803b61018b578560b760556000f580610157576320188a596000526004601cfd5b80606c52508284887f79f19b3655ee38b1ce526556b7731a20c8f218fbda4a3990b6cc4172fdf887226060606ca46020606cf35b8060601b60601c60005260206000f35b80356001600160a01b03811681146101b257600080fd5b919050565b600080600080600060a086880312156101cf57600080fd5b6101d88661019b565b945060208601359350604086013592506101f46060870161019b565b94979396509194608001359291505056fea2646970667358221220ea2fe53af507453c64dd7c1db05549fa47a298dfb825d6d11e1689856135f16764736f6c63430008110033";

export const ZERO = "0x" + "00".repeat(20);
/// the Engine's slots in order — tools/build-app.mjs builds the same list: V1's six, then
/// V2's Gallery, the seventh (W8)
export const PANELS = ["swap", "social", "launch", "vault", "identity", "agent", "gallery"];
/// Post-MVB satellites: predicted-but-codeless placeholders, so the site
/// exercises its "not reported" path on every run.
export const MARKET_PLACEHOLDER = "0x0000000000000000000000000000000000A2CE70";
export const ROLES_PLACEHOLDER = "0x0000000000000000000000000000000000A01E50";
export const AGENTCARD_PLACEHOLDER = "0x000000000000000000000000000000000A6E7CA0";
export const NAMEPLATE_PLACEHOLDER = "0x00000000000000000000000000000000A3E97A7E";
/// V2 (wave 2, W6): the six V2 satellites' codeless placeholders, pinned
/// when a run does not deploy them, so the hub's config always carries a
/// Keepsake and a Journal (the hub is the same build either way) and the
/// Catalog's world always names all six.
export const KEEPSAKE_PLACEHOLDER = "0x00000000000000000000000000000000000C5A6E";
export const JOURNAL_PLACEHOLDER = "0x000000000000000000000000000000000070A2A1";
export const BAZAAR_PLACEHOLDER = "0x0000000000000000000000000000000000BA2AA2";
export const BRIDGES_PLACEHOLDER = "0x0000000000000000000000000000000000B21D6E";
export const STUDIO_PLACEHOLDER = "0x00000000000000000000000000000000005700D1";
export const AGORA_PLACEHOLDER = "0x00000000000000000000000000000000000A6024";
/// Seaport 1.6 and its ConduitController, at the addresses Seaport's keyless
/// CREATE2 deployment gives them on every chain V2 targets; the runtimes are
/// the bytes Base Sepolia returned (tools/fixtures/seaport-1.6/probe.json).
export const SEAPORT = "0x0000000000000068F116a894984e2DB1123eB395";
export const CONDUIT_CONTROLLER = "0x00000000F9490004C11Cef243f5400493c00Ad63";

export const CONFIG_TYPE =
  "(address,address,uint8,uint256,uint256,address,address,address,address,address,address,address,address,address,address,address,address,address)";
/// the Catalog's config, field for field (src/Catalog.sol `CatalogConfig`); the
/// Nameplate's pin was appended in the console round, and V2's seven after it
/// (keepsake, journal, bazaar, bridges, studio, agora, seaport)
export const CATALOG_CONFIG_TYPE =
  "(address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,uint8,uint256,uint256,address,address,address,address,address,address,address,address,address,address)";

/// The probed Seaport 1.6 and ConduitController runtimes, each held to the
/// codehash its probe recorded before anything is put at its address.
export function seaportFixture() {
  const dir = path.join(ROOT, "tools/fixtures/seaport-1.6");
  const probe = JSON.parse(fs.readFileSync(path.join(dir, "probe.json"), "utf8"));
  const seaport = fs.readFileSync(path.join(dir, "seaport.runtime.hex"), "utf8").trim();
  const controller = fs.readFileSync(path.join(dir, "conduit-controller.runtime.hex"), "utf8").trim();
  const hashOf = (h) => "0x" + Buffer.from(keccak256(Buffer.from(h.replace(/^0x/, ""), "hex"))).toString("hex");
  if (hashOf(seaport).toLowerCase() !== probe.codehash.toLowerCase()) throw new Error("tools/fixtures/seaport-1.6/seaport.runtime.hex is not the runtime probe.json hashes");
  if (hashOf(controller).toLowerCase() !== probe.conduitController.codehash.toLowerCase()) throw new Error("the ConduitController runtime is not the one probe.json hashes");
  return { probe, seaport, controller };
}

/// The address CREATE gives `from` at `nonce`.
export function predictCreate(from, nonce) {
  return bytesToHex(generateAddress(hexToBytes(from), bigIntToUnpaddedBytes(BigInt(nonce))));
}

const w = (n) => BigInt(n).toString(16).padStart(64, "0");

/*═══════════════════ ERC-5219 over the harness ═══════════════════*/

export const REQUEST = "request(string[],(string,string)[])";
export const encRequest = (resource) => enc(REQUEST, [resource, []]);

export const decResponse = (hex) => {
  const h = hex.replace(/^0x/, "");
  const status = Number(BigInt("0x" + h.substr(0, 64)));
  const bodyOff = Number(BigInt("0x" + h.substr(64, 64))) * 2;
  const hdrOff = Number(BigInt("0x" + h.substr(128, 64))) * 2;
  const bodyLen = Number(BigInt("0x" + h.substr(bodyOff, 64)));
  const bodyBytes = Buffer.from(h.substr(bodyOff + 64, bodyLen * 2), "hex");
  const n = Number(BigInt("0x" + h.substr(hdrOff, 64)));
  const headers = [];
  for (let i = 0; i < n; i++) {
    const t = hdrOff + 64 + Number(BigInt("0x" + h.substr(hdrOff + 64 + i * 64, 64))) * 2;
    const readAt = (at) => {
      const o = t + Number(BigInt("0x" + h.substr(at, 64))) * 2;
      const len = Number(BigInt("0x" + h.substr(o, 64)));
      return Buffer.from(h.substr(o + 64, len * 2), "hex").toString("utf8");
    };
    headers.push([readAt(t), readAt(t + 64)]);
  }
  return { status, body: bodyBytes.toString("utf8"), bodyBytes, headers,
           header: (k) => (headers.find((x) => x[0].toLowerCase() === k.toLowerCase()) || [])[1] };
};

/// A GET against a deployed Premises: { status, body, bodyBytes, headers, header(k), gas }.
export const getter = (c, premises) => async (resource) => {
  const r = decResponse(await c.call(premises, encRequest(resource)));
  r.gas = c.lastGas;
  return r;
};

/*═══════════════════ the deployment ═══════════════════*/

export function readPlan() {
  const p = path.join(ROOT, "dist/shards.json");
  if (!fs.existsSync(p)) throw new Error("run `node tools/build-app.mjs` first — dist/shards.json is missing");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * Deploy the whole MVB site into chain `c` from the compiled `out`.
 * Returns every address, the shard plan and the gas each step took.
 */
export async function deploySite(c, out, opts = {}) {
  const plan = opts.plan || readPlan();
  const price = opts.price ?? 10n ** 16n;
  const band = opts.band ?? 1;
  const lo = opts.lo ?? 1n;
  const hi = opts.hi ?? 3072n;
  const A = (f, n) => artifact(out, f, n);
  const from = c.from.toString();
  const gasLog = {};
  const step = async (label, fn) => { const r = await fn(); gasLog[label] = (gasLog[label] || 0n) + (r.gas || 0n); return r; };

  // the canonical registry, at its canonical address, with its real runtime
  if ((await c.codeSize(REGISTRY)) === 0) {
    const a = createAddressFromString(REGISTRY);
    if (!(await c.vm.stateManager.getAccount(a))) {
      const { Account } = await import("@ethereumjs/util");
      await c.vm.stateManager.putAccount(a, new Account());
    }
    await c.vm.stateManager.putCode(a, hexToBytes(REGISTRY_RUNTIME));
  }

  const reachImpl = await c.deploy(A("src/Reach.sol", "Reach").bytecode, "", "Reach");
  const gripImpl = await c.deploy(A("src/Grip.sol", "Grip").bytecode, "", "Grip");

  /*── the engine: shards, panels, the hash, the freeze ──*/
  const engine = await c.deploy(A("src/Engine.sol", "Engine").bytecode, "", "Engine");
  for (const s of plan.head) await step("loadHead", () => c.exec(engine, "loadHead(bytes)", [s.data], { label: "loadHead" }));
  for (const s of plan.body) await step("loadBody", () => c.exec(engine, "loadBody(bytes)", [s.data], { label: "loadBody" }));
  for (let i = 0; i < plan.panels.length; i++) {
    const p = plan.panels[i];
    await step("loadPanel", () => c.exec(engine, "loadPanel(uint256,bytes,bytes32)", [i, p.data, p.hash], { label: "loadPanel" }));
  }
  await c.exec(engine, "setEngineHash(bytes32,uint32)", [plan.engineHash, plan.inflatedSize]);
  await c.exec(engine, "freeze()", []);

  const crest = await c.deploy(A("src/Crest.sol", "Crest").bytecode, "", "Crest");
  const keys = await c.deploy(A("src/KeyRegistry.sol", "KeyRegistry").bytecode, "", "KeyRegistry");
  const timelock = await c.deploy(A("src/Timelock.sol", "Timelock").bytecode, encodeParams("address", [from]), "Timelock");

  /*── predictions: everything from here is one CREATE per nonce, no other tx ──*/
  const n0 = await c.nonceNow();
  const at = (k) => predictCreate(from, n0 + BigInt(k));
  /*  V2 (W6): the third row table is one more CREATE before the Catalog's
      text layer. The Renderer and the Premises read nothing at
      construction, so they now come before the Catalog and keep the
      nonces they always had — the Premises' address is what a web3://
      link and the console's QR carry (tools/verify-site pins the QR's
      module map) — and the Catalog takes the slot after them.          */
  const P = {
    catalogRows: at(0), catalogRowsPost: at(1), catalogRowsV2: at(2), catalogText: at(3), catalogState: at(4),
    renderer: at(5), premises: at(6), catalog: at(7),
    coreFacet: at(8), rightsFacet: at(9), mintFacet: at(10), siteFacet: at(11), hub: at(12),
    locks: at(13), steward: at(14), postage: at(15), parley: at(16), roster: at(17),
    pool: at(18), kiln: at(19), launchpad: at(20)
  };
  /*  U17 (additive): `deployAgentCard` deploys src/AgentCard.sol as the LAST
      CREATE of the run, at the address the Catalog, the Renderer and the
      Premises are pinned to before it exists — the card takes their
      addresses as constructor arguments, so it must come after them and is
      predicted like everything else. Without the option the pin stays the
      codeless placeholder and every agent route is a 404, which is what
      the other verifiers measure.                                         */
  if (opts.deployAgentCard) P.agentCard = at(21);
  /*  Wave 4 (additive): `deployMarket` and `deployRoles` deploy src/Market.sol
      and src/Roles.sol after the card, at the addresses the hub's and the
      Catalog's configurations pin before they exist — predicted like
      everything else — so a lane or a verifier can exercise the real
      satellites. Without the options the pins stay the codeless
      placeholders and the "not reported" paths are what the run measures. */
  let next = opts.deployAgentCard ? 22 : 21;
  if (opts.deployMarket) P.market = at(next++);
  if (opts.deployRoles) P.roles = at(next++);
  /*  The console round (additive): `deployNameplate: { ens, wrapper, registrar }`
      deploys src/Nameplate.sol last, at the address the Catalog pins, against an
      ENS the caller deployed first (test/mocks' registry, wrapper and registrar,
      as tools/verify-plate.mjs builds them) — band 0's resolver, so the identity
      lane's ENS row reads a real one. Without it the pin is `opts.nameplate` or
      the codeless placeholder.                                               */
  if (opts.deployNameplate) P.nameplate = at(next++);
  /*  V2 (wave 2, W6, additive): `deployJournal`, `deployKeepsake` (the
      KeepsakeArt, then Keepsake(hub, pool, art)), `deployBazaar` (Seaport
      1.6's probed runtime and its ConduitController put at their canonical
      addresses in-process, as tools/verify-bazaar.mjs does, then
      Bazaar(seaport, hub, pool)), `deployBridges` (Bridges(timelock)),
      `deployStudio` and `deployAgora` (Studio(hub, journal, agora) and
      Agora(hub, keys, studio), each pinned to the other's prediction), all
      after everything above, at predicted CREATE addresses; `v2: true`
      turns all six on. Off by default, so every V1 suite sees the band it
      always saw: the pins stay the codeless placeholders, and the hub's
      config carries them either way.                                      */
  const on = (k) => opts.v2 === true || Boolean(opts[k]);
  if (on("deployJournal")) P.journal = at(next++);
  if (on("deployKeepsake")) { P.keepsakeArt = at(next++); P.keepsake = at(next++); }
  if (on("deployBazaar")) P.bazaar = at(next++);
  if (on("deployBridges")) P.bridges = at(next++);
  if (on("deployStudio")) P.studio = at(next++);
  if (on("deployAgora")) P.agora = at(next++);
  const keepsake = P.keepsake || KEEPSAKE_PLACEHOLDER;
  const journal = P.journal || JOURNAL_PLACEHOLDER;
  const bazaar = P.bazaar || BAZAAR_PLACEHOLDER;
  const bridges = P.bridges || BRIDGES_PLACEHOLDER;
  const studio = P.studio || STUDIO_PLACEHOLDER;
  const agora = P.agora || AGORA_PLACEHOLDER;
  /// a venue: canonical where the Bazaar is deployed, else what the caller names, else none
  const seaport = on("deployBazaar") ? SEAPORT : (opts.seaport || ZERO);
  const market = opts.deployMarket ? P.market : MARKET_PLACEHOLDER;
  const roles = opts.deployRoles ? P.roles : ROLES_PLACEHOLDER;
  const nameplate = opts.deployNameplate ? P.nameplate : (opts.nameplate || NAMEPLATE_PLACEHOLDER);      // band 0 only
  const router = opts.router || ZERO;
  const agentCard = opts.deployAgentCard ? P.agentCard : (opts.agentCard || AGENTCARD_PLACEHOLDER);

  // the Catalog's companions, before it (EIP-3860 keeps them out of its
  // initcode; EIP-7825 keeps the three table renderings in three transactions);
  // the rows carry every contract's address, so they take the predictions by letter
  const byLetter = [P.hub, P.pool, ZERO, P.parley, P.roster, P.postage, keys, P.kiln, P.launchpad, ZERO,
                    P.locks, P.steward, router, ZERO, engine, P.catalog,
                    market, roles, agentCard, ZERO, nameplate];                      // HPRYTSKNLCOWXEGQMDAUI
  const catalogRows = await c.deploy(A("src/Catalog.sol", "CatalogRows").bytecode,
    encodeParams("address[21]", [byLetter]), "CatalogRows");
  const catalogRowsPost = await c.deploy(A("src/Catalog.sol", "CatalogRowsPost").bytecode,
    encodeParams("address[21]", [byLetter]), "CatalogRowsPost");
  /*  the third table's letters (W15): s is Seaport, the venue the world names
      (canonical where the Bazaar is deployed, else the caller's, else none),
      and e any ERC-721, zero as E's any ERC-20 is; one deployment either way,
      so the Premises keeps its nonce                                     */
  const catalogRowsV2 = await c.deploy(A("src/Catalog.sol", "CatalogRowsV2").bytecode,
    encodeParams("address[9]", [[keepsake, journal, bazaar, bridges, studio, ZERO, agora, seaport, ZERO]]), "CatalogRowsV2");   // VJBbZcFse
  const catalogText = await c.deploy(A("src/Catalog.sol", "CatalogText").bytecode,
    encodeParams("address,address,address", [catalogRows, catalogRowsPost, catalogRowsV2]), "CatalogText");
  const catalogState = await c.deploy(A("src/Catalog.sol", "CatalogState").bytecode, encodeParams("address", [catalogText]), "CatalogState");
  const renderer = await c.deploy(A("src/Renderer.sol", "Renderer").bytecode,
    encodeParams("address,address,address,address,address", [P.hub, engine, crest, P.catalog, agentCard]), "Renderer");
  const premises = await c.deploy(A("src/Premises.sol", "Premises").bytecode,
    encodeParams("address,address,address,address,address,address", [P.hub, renderer, engine, P.catalog, crest, agentCard]), "Premises");
  const catalog = await c.deploy(A("src/Catalog.sol", "Catalog").bytecode,
    encodeParams(CATALOG_CONFIG_TYPE, [[
      P.hub, engine, router, P.roster, P.postage, keys, P.kiln, agentCard,
      reachImpl, gripImpl, P.pool, P.parley, P.launchpad, P.locks, P.steward, market, roles,
      timelock, premises, renderer, band, lo, hi, catalogText, catalogState, nameplate,
      keepsake, journal, bazaar, bridges, studio, agora, seaport]]), "Catalog");

  const config = [reachImpl, gripImpl, band, lo, hi, P.steward, market, roles, P.pool, P.parley,
                  P.launchpad, P.locks, renderer, catalog, premises, timelock, keepsake, journal];
  const cfg = encodeParams(CONFIG_TYPE, [config]);
  const facets = {};
  for (const name of ["CoreFacet", "RightsFacet", "MintFacet", "SiteFacet"]) {
    facets[name] = await c.deploy(A(`src/hub/facets/${name}.sol`, name).bytecode, cfg, name);
  }
  const { cut } = hubCut(out, facets);
  const hub = await c.deploy(A("src/hub/IntactDiamond.sol", "IntactDiamond").bytecode,
    encodeParams("(address,uint8,bytes4[])[],uint256", [cut.map((x) => [x.facetAddress, 0, x.functionSelectors]), price]),
    "IntactDiamond");

  const locks = await c.deploy(A("src/Locks.sol", "Locks").bytecode, encodeParams("address", [hub]), "Locks");
  const steward = await c.deploy(A("src/Steward.sol", "Steward").bytecode, encodeParams("address", [hub]), "Steward");
  const postage = await c.deploy(A("src/Postage.sol", "Postage").bytecode, encodeParams("address,address", [hub, P.parley]), "Postage");
  const parley = await c.deploy(A("src/Parley.sol", "Parley").bytecode, encodeParams("address,address,address", [hub, keys, postage]), "Parley");
  const roster = await c.deploy(A("src/Roster.sol", "Roster").bytecode, encodeParams("address,address", [parley, hub]), "Roster");
  const pool = await c.deploy(A("src/Pool.sol", "Pool").bytecode, encodeParams("address,address", [hub, P.launchpad]), "Pool");
  const kiln = await c.deploy(A("src/Kiln.sol", "Kiln").bytecode, encodeParams("address,address,address", [hub, P.launchpad, ZERO]), "Kiln");
  const launchpad = await c.deploy(A("src/Launchpad.sol", "Launchpad").bytecode,
    encodeParams("address,address,address,address,address", [hub, kiln, pool, locks, ZERO]), "Launchpad");   // no custodian in the harness world: Target.UniswapV4 stays NotYet

  const got = { catalogRows, catalogRowsPost, catalogRowsV2, catalogText, catalogState, catalog, renderer, premises, coreFacet: facets.CoreFacet, rightsFacet: facets.RightsFacet,
                mintFacet: facets.MintFacet, siteFacet: facets.SiteFacet, hub, locks, steward, postage, parley, roster,
                pool, kiln, launchpad };
  if (opts.deployAgentCard) {
    got.agentCard = await c.deploy(A("src/AgentCard.sol", "AgentCard").bytecode,
      encodeParams("address,address,address", [hub, catalog, premises]), "AgentCard");
  }
  if (opts.deployMarket) got.market = await c.deploy(A("src/Market.sol", "Market").bytecode, encodeParams("address,address", [hub, pool]), "Market");
  if (opts.deployRoles) got.roles = await c.deploy(A("src/Roles.sol", "Roles").bytecode, encodeParams("address", [hub]), "Roles");
  if (opts.deployNameplate) {
    const e = opts.deployNameplate;
    got.nameplate = await c.deploy(A("src/Nameplate.sol", "Nameplate").bytecode,
      encodeParams("address,address,address,address,address,string", [hub, premises, e.ens, e.wrapper, e.registrar, "intact"]), "Nameplate");
  }
  /*── V2, in the order the predictions above were made ──*/
  if (on("deployJournal")) got.journal = await c.deploy(A("src/Journal.sol", "Journal").bytecode, encodeParams("address", [hub]), "Journal");
  if (on("deployKeepsake")) {
    got.keepsakeArt = await c.deploy(A("src/KeepsakeArt.sol", "KeepsakeArt").bytecode, "", "KeepsakeArt");
    got.keepsake = await c.deploy(A("src/Keepsake.sol", "Keepsake").bytecode,
      encodeParams("address,address,address", [hub, pool, got.keepsakeArt]), "Keepsake");
  }
  if (on("deployBazaar")) {
    const fx = seaportFixture();
    for (const [addr, code] of [[SEAPORT, fx.seaport], [CONDUIT_CONTROLLER, fx.controller]]) {
      const a = createAddressFromString(addr);
      if (!(await c.vm.stateManager.getAccount(a))) {
        const { Account } = await import("@ethereumjs/util");
        await c.vm.stateManager.putAccount(a, new Account());
      }
      await c.vm.stateManager.putCode(a, hexToBytes(code));
    }
    got.bazaar = await c.deploy(A("src/Bazaar.sol", "Bazaar").bytecode, encodeParams("address,address,address", [SEAPORT, hub, pool]), "Bazaar");
  }
  if (on("deployBridges")) got.bridges = await c.deploy(A("src/Bridges.sol", "Bridges").bytecode, encodeParams("address", [timelock]), "Bridges");
  if (on("deployStudio")) {
    got.studio = await c.deploy(A("src/Studio.sol", "Studio").bytecode, encodeParams("address,address,address", [hub, journal, agora]), "Studio");
  }
  if (on("deployAgora")) {
    got.agora = await c.deploy(A("src/Agora.sol", "Agora").bytecode, encodeParams("address,address,address", [hub, keys, studio]), "Agora");
  }
  const missed = Object.keys(P).filter((k) => P[k].toLowerCase() !== got[k].toLowerCase());
  if (missed.length) throw new Error("a prediction missed: " + missed.map((k) => `${k} ${P[k]} vs ${got[k]}`).join(", "));

  // the hub agrees it was built against what was deployed
  const check = async (fn, want, what) => {
    const have = decAddr(await c.read(hub, fn)).toLowerCase();
    if (have !== want.toLowerCase()) throw new Error(`the hub's ${what} is ${have}, deployed at ${want}`);
  };
  await check("RENDERER()", renderer, "RENDERER");
  await check("CATALOG()", catalog, "CATALOG");
  await check("PREMISES()", premises, "PREMISES");
  await check("POOL()", pool, "POOL");
  await check("PARLEY()", parley, "PARLEY");
  await check("LAUNCHPAD()", launchpad, "LAUNCHPAD");
  await check("LOCKS()", locks, "LOCKS");
  await check("STEWARD()", steward, "STEWARD");
  await check("KEEPSAKE()", keepsake, "KEEPSAKE");
  await check("JOURNAL()", journal, "JOURNAL");

  return {
    plan, price, band, lo, hi, gasLog,
    registry: REGISTRY, reachImpl, gripImpl, engine, crest, keys, timelock, router, agentCard,
    market, roles, nameplate, keepsake, journal, bazaar, bridges, studio, agora, seaport, ...got, facets
  };
}

/// Mint one token to `to` and return its id from the Transfer log, not a
/// read-after-write (one of the three public-RPC lag defences).
export async function mint(c, site, to) {
  const r = await c.exec(site.hub, "mint(address)", [to || c.from.toString()], { value: site.price, label: "mint" });
  const TRANSFER = "0x" + Buffer.from((await import("ethereum-cryptography/keccak.js")).keccak256(
    Buffer.from("Transfer(address,address,uint256)"))).toString("hex");
  const log = r.logs.map((l) => ({ topics: l[1].map((t) => "0x" + Buffer.from(t).toString("hex")) }))
    .find((l) => l.topics[0] === TRANSFER);
  if (!log) throw new Error("mint emitted no Transfer");
  return { id: BigInt(log.topics[3]), gas: r.gas };
}

export { sel, w };
