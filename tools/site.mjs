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
export const PANELS = ["swap", "social", "launch", "vault", "identity", "agent"];
/// Post-MVB satellites: predicted-but-codeless placeholders, so the site
/// exercises its "not reported" path on every run.
export const MARKET_PLACEHOLDER = "0x0000000000000000000000000000000000A2CE70";
export const ROLES_PLACEHOLDER = "0x0000000000000000000000000000000000A01E50";
export const AGENTCARD_PLACEHOLDER = "0x000000000000000000000000000000000A6E7CA0";

export const CONFIG_TYPE =
  "(address,address,uint8,uint256,uint256,address,address,address,address,address,address,address,address,address,address,address)";
export const CATALOG_CONFIG_TYPE =
  "(address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,uint8,uint256,uint256,address,address)";

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
  const P = {
    catalogRows: at(0), catalogText: at(1), catalogState: at(2), catalog: at(3), renderer: at(4), premises: at(5),
    coreFacet: at(6), rightsFacet: at(7), mintFacet: at(8), siteFacet: at(9), hub: at(10),
    locks: at(11), steward: at(12), postage: at(13), parley: at(14), roster: at(15),
    pool: at(16), kiln: at(17), launchpad: at(18)
  };
  const router = opts.router || ZERO;
  const agentCard = opts.agentCard || AGENTCARD_PLACEHOLDER;

  // the Catalog's three companions, before it (EIP-3860 keeps them out of its
  // initcode; EIP-7825 keeps the two table renderings in two transactions);
  // the rows carry every contract's address, so they take the predictions by letter
  const byLetter = [P.hub, P.pool, ZERO, P.parley, P.roster, P.postage, keys, P.kiln, P.launchpad, ZERO,
                    P.locks, P.steward, router, ZERO, engine, P.catalog];           // HPRYTSKNLCOWXEGQ
  const catalogRows = await c.deploy(A("src/Catalog.sol", "CatalogRows").bytecode,
    encodeParams("address[16]", [byLetter]), "CatalogRows");
  const catalogText = await c.deploy(A("src/Catalog.sol", "CatalogText").bytecode,
    encodeParams("address", [catalogRows]), "CatalogText");
  const catalogState = await c.deploy(A("src/Catalog.sol", "CatalogState").bytecode, encodeParams("address", [catalogText]), "CatalogState");
  const catalog = await c.deploy(A("src/Catalog.sol", "Catalog").bytecode,
    encodeParams(CATALOG_CONFIG_TYPE, [[
      P.hub, engine, router, P.roster, P.postage, keys, P.kiln, agentCard,
      reachImpl, gripImpl, P.pool, P.parley, P.launchpad, P.locks, P.steward, MARKET_PLACEHOLDER, ROLES_PLACEHOLDER,
      timelock, P.premises, P.renderer, band, lo, hi, catalogText, catalogState]]), "Catalog");
  const renderer = await c.deploy(A("src/Renderer.sol", "Renderer").bytecode,
    encodeParams("address,address,address,address,address", [P.hub, engine, crest, catalog, agentCard]), "Renderer");
  const premises = await c.deploy(A("src/Premises.sol", "Premises").bytecode,
    encodeParams("address,address,address,address,address,address", [P.hub, renderer, engine, catalog, crest, agentCard]), "Premises");

  const config = [reachImpl, gripImpl, band, lo, hi, P.steward, MARKET_PLACEHOLDER, ROLES_PLACEHOLDER, P.pool, P.parley,
                  P.launchpad, P.locks, renderer, catalog, premises, timelock];
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
    encodeParams("address,address,address,address", [hub, kiln, pool, locks]), "Launchpad");

  const got = { catalogRows, catalogText, catalogState, catalog, renderer, premises, coreFacet: facets.CoreFacet, rightsFacet: facets.RightsFacet,
                mintFacet: facets.MintFacet, siteFacet: facets.SiteFacet, hub, locks, steward, postage, parley, roster,
                pool, kiln, launchpad };
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

  return {
    plan, price, band, lo, hi, gasLog,
    registry: REGISTRY, reachImpl, gripImpl, engine, crest, keys, timelock, router, agentCard,
    market: MARKET_PLACEHOLDER, roles: ROLES_PLACEHOLDER, ...got, facets
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
