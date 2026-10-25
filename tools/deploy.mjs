#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · deploying one band, through one factory, under fixed salts

  Origin: IPSEITY tools/testnet.mjs (preflight, registry gate, journal,
  read-back, record) and tools/site.mjs (`assertTiles`, `bandFor`, the
  prediction-then-assertion pattern); MASTER scripts/sepolia.mjs (the
  literal `--confirm` token before any I/O, atomic writes, resume from a
  journal, post-conditions parsed from creation events); the three
  public-RPC lag defences IPSEITY grew in three files, here as one helper
  each. Rewritten for INTACT U10 around two ideas the donors did not have:

  · CREATE3. Every satellite is deployed through `Create3Factory` under
    `salt = keccak("intact.v1.<key>")`, so its address is a function of
    (factory, key) and nothing else — not the initcode, not the band's
    constructor arguments, not the deployer's nonce. The factory itself is
    the one plain CREATE, from a FRESH burner at nonce 0, so the same key
    gives the same factory on every band and every address follows. The
    predictions are computed up front, fed into every constructor that
    pins another contract, and asserted after every step; a miss refuses
    to continue and nothing is published (DESIGN.md §12).

  · an adapter. The same function deploys over JSON-RPC (tools/rpc.mjs)
    and into the in-process EVM (tools/evm.mjs): `adapt(c)` wraps either
    as {deploy, exec, call, read, codeAt, getLogs, blockNumber, setCode?}
    so tools/verify-recover.mjs runs THIS code, not a copy of it, and what
    the suite verified is what the band gets.

  Two things DESIGN §12 says that this script does differently, on purpose:

  · The Engine is NOT deployed through the factory. Its constructor records
    `msg.sender` as the curator, and under CREATE3 that sender is the
    factory's single-use proxy, which can never call `loadHead`. The Engine
    is the second plain CREATE from the burner (nonce 2: factory at 0, the
    Timelock's factory call at 1), so its address is still the same on
    every band — it is predicted and asserted like every other — but by
    `keccak(rlp([burner, 2]))` rather than by a salt. The record says so
    (`engine.via`), and tools/recover-record.mjs recomputes it.
  · Engine shards are SSTORE2 pointers, CREATEd from the Engine's own
    nonce (1 + k for the k-th shard in load order), not salted. With the
    Engine at one address and dist/ byte-identical, the pointers are the
    same everywhere; the record stores them and recovery recomputes them.

  Order (DESIGN §12, every arrow a hard constraint where a constructor
  inspects code): factory → Timelock → Engine (load head, body, six
  panels; setEngineHash; freeze) → Crest → Reach impl → Grip impl →
  CatalogRows → CatalogRowsPost → CatalogRowsV2 → CatalogText → CatalogState → Catalog → Renderer → hub (the
  four facets then IntactDiamond, or the monolith, by out/ship.json) →
  KeyRegistry → Roster → Postage → Parley → Locks → Pool → Coin template
  check → Kiln → Launchpad → Router (only where the venue row names a
  Uniswap venue) → Steward → Premises → (with --v2: KeepsakeArt → Keepsake
  → Journal → Bazaar → Bridges → Studio → Agora) → post-conditions →
  recover-record in-process → the record is written LAST.

  Resume: every step is journaled to deployments/<chainId>.journal.json
  as soon as its receipt is in. A crashed run re-runs the same command;
  a step whose predicted address already holds code with the journaled
  codehash is skipped. Engine shards already stored are compared with the
  plan by keccak (the Engine's own shardHashes()) before anything more is
  sent: a dist/ rebuilt since the crash is a refusal while the Engine is
  still open, because the Engine — a plain CREATE at the burner's nonce 2 —
  can never be redeployed. Code at a prediction that the journal does not
  know is a refusal, not an adoption: the factory admits only the burner
  and the Timelock (`Create3Factory.NotDeployer`), so such code can only
  mean a run this journal does not know about, and a contract at our
  address that we did not put there is exactly what the record must not
  bless. On 31337 a journal whose deployer is back at nonce 0 describes a
  chain that no longer exists (the node was restarted); it is set aside
  with a line saying so and the run starts clean. Anywhere else that
  contradiction is a refusal.

  The order is declared once (`DEPLOY_ORDER`) and the journal's steps are
  asserted against it before the record is written, so a reordering is a
  refusal and not a silent difference between DESIGN §12 and the band.

    node tools/deploy.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL
    RPC_URL=… PRIVATE_KEY=0x… node tools/deploy.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA
      [--rpc URL] [--journal path] [--record path] [--price wei] [--v2]

  `--v2` (W15) is a switch: the same fresh deployment also lands V2 by the
  burner, after the Premises and in V2_ORDER — the Keepsake's art, the
  Keepsake, the Journal, the Bazaar (only where the venue row names
  Seaport), Bridges, the Studio and Agora — each at the "intact.v2.<key>"
  placeholder the hub and the Catalog pin, with the constructor arguments
  `deploySatellite` gives the same contract through the Timelock. Without
  it they stay placeholders until `--satellite` lands them.

  `--record` names where the record is written (default
  deployments/<chainId>.json — a rehearsal that must not overwrite the
  committed fixture passes its own path); an option not in this list is
  refused. The record never carries the endpoint: on a real band RPC_URL
  is a keyed provider URL, and a record that named the node that verifies
  it would be choosing its own oracle.

  The key comes from the environment only. On a real band it MUST be a
  fresh burner at nonce 0 (checked; refused otherwise unless a journal
  names a run to resume); on 31337 a non-zero nonce is a warning, since
  hardhat's first account is nobody's burner.
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { createAddressFromString, hexToBytes, bytesToHex, Account } from "@ethereumjs/util";
import { compile, artifact, shipRule, LIMIT } from "./compile.mjs";
import { enc, encodeParams, decAddr, decUint, decBool, decString, TX_GAS_CAP } from "./evm.mjs";
import * as EVM from "./evm.mjs";
import { hubCut } from "./facets.mjs";
import { REGISTRY, REGISTRY_RUNTIME, ZERO, CONFIG_TYPE, CATALOG_CONFIG_TYPE,
         predictCreate, encRequest, decResponse } from "./site.mjs";
/*  A static import, although recover-record.mjs imports this file back:
    ESM resolves a static cycle (each side touches the other's exports only
    inside functions), where a dynamic `import()` from this module while
    its own top-level await is pending can never settle — the first
    hardhat run deployed everything and then exited with code 13 at the
    recovery step, having published nothing.                             */
import { recover } from "./recover-record.mjs";
import { ENS_REGISTRY, ETH_REGISTRAR, NAME_WRAPPER } from "./ens-name.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

export const kec = (b) => "0x" + Buffer.from(keccak256(Buffer.from(b))).toString("hex");
const kecHex = (hex) => kec(Buffer.from(hex.replace(/^0x/, ""), "hex"));
const low = (a) => String(a).toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*═══════════════════ bands, chains, tokens ═══════════════════*/

export const COLLECTION = 4096n;
/// DESIGN §12: three disjoint id bands, one chain each. `band` is the hub's
/// BAND immutable; `first`/`last` its bounds.
export const BANDS = {
  8453: { band: 1, name: "Base", first: 1n, last: 3072n },
  1:    { band: 0, name: "Ethereum", first: 3073n, last: 3584n },
  10:   { band: 2, name: "OP Mainnet", first: 3585n, last: 4096n }
};
/// A rehearsal chain takes the whole edition; any other unbanded chain is refused.
export const REHEARSAL = { 31337: "hardhat", 84532: "Base Sepolia", 11155111: "Sepolia" };
/// The literal token `--confirm` must carry, per chain. Checked before any
/// file or network access (MASTER's rule), so a wrong token costs nothing.
export const CONFIRM = {
  31337: "DEPLOY_INTACT_LOCAL", 84532: "DEPLOY_INTACT_TO_BASE_SEPOLIA", 11155111: "DEPLOY_INTACT_TO_SEPOLIA",
  8453: "DEPLOY_INTACT_TO_BASE", 1: "DEPLOY_INTACT_TO_ETHEREUM", 10: "DEPLOY_INTACT_TO_OP"
};
/// Per-chain venue addresses for the Router, the Kiln and the custodian:
/// SwapRouter02, the v4 PoolManager and PositionManager, Permit2 and the
/// wrapped native token. IPSEITY's rule applies — every address here was
/// PROBED for code on the date noted, never recalled — and a chain with no
/// row skips the Router (pinned as address(0) in the Catalog's letter X, as
/// the harness does) and refuses the custodian. Filling a row is a
/// deliberate, dated commit; `probed` is its evidence, re-proved by
/// `tools/verify-venues.mjs` against the chain and before every deploy
/// over a wire (`checkVenues`): code at every address with the codehash
/// recorded here, the PositionManager naming this PoolManager, this Permit2
/// and the WETH that SwapRouter02 names, SwapRouter02 naming the v3 factory.
/// The addresses come from Uniswap's own deployment feed
/// (developers.uniswap.org/deployments.json, generated 2026-09-22 from
/// github.com/Uniswap/contracts at a677c0d); the WETH is the one both
/// routers name on chain, which on Base Sepolia is the OP-stack predeploy.
export const VENUES = {
  84532: {
    swapRouter02: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    poolManager: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    positionManager: "0x4B2C77d209D3405F41a037Ec6c77F7F5b8e2ca80",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    weth: "0x4200000000000000000000000000000000000006",
    probed: {
      on: "2026-10-18", block: 48296154, v3Factory: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
      codehashes: {
        swapRouter02: "0x60e9352f5af4eee63b41456f85bf80c63044e98123ad599d41d87f2d068de0be",
        poolManager: "0x03c45db6d09b14da7c1f7239a5a49697f976d395277e6d2acb6fbed3f9e0249f",
        positionManager: "0xe8329b35b8b34290b6cf03affc0836f7b23205229cc96ffdc66544b93112c076",
        permit2: "0xdcde65555316946c298e4c60c6213eb5c3aeab4354d1f3fac5427236bcbb9ebe",
        weth: "0x83f731a17e6c0cdd04bc6f60b15d3e789e215b71403087b84b48650a1e5cbb21"
      }
    },
    /// V2 (wave 2, W6): Seaport 1.6, its ConduitController and OpenSea's
    /// conduit, from tools/fixtures/seaport-1.6/probe.json — read by
    /// `node tools/verify-bazaar-fork.mjs --probe` at one pinned block, the
    /// bytes eth_getCode returned kept beside it; the evidence is the fixture,
    /// with its own date and block, so it rides apart from the Uniswap probe
    seaport: "0x0000000000000068F116a894984e2DB1123eB395",
    conduitController: "0x00000000F9490004C11Cef243f5400493c00Ad63",
    openseaConduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
    openseaConduit: "0x1E0049783F008A0085193E00003D00cd54003c71",
    seaportProbed: {
      on: "2026-10-19", block: 48309960, blockHash: "0x0fcc734d8fa39434facf5fccb339994d4fe5a86427bc6f5465a0fe2ce29d01ef",
      version: "1.6", domainSeparator: "0x4778aa25cd18fc3b8e9d053bb369734ae2ce8511b24dd9b00010466bdb496b45",
      codehashes: {
        seaport: "0x7912af42062ec0080cde88360c1429d58984ae16eb3f17af505b815bf6ffc745",
        conduitController: "0x880348b652e7cce91216153a4d0107e70c77b92192f3d7a127ff1f1351961948",
        openseaConduit: "0x069efdc9b946a332dce9951324fa197268e3ff0e00e44c6bf36049fc53113a41"
      }
    }
  },
  11155111: {
    swapRouter02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
    positionManager: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4",
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    probed: {
      on: "2026-10-18", block: 11943880, v3Factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
      codehashes: {
        swapRouter02: "0xe7f98ee73dfe6d5c96cbf8936920f496b1b82f24326d6a415b4144a2252271de",
        poolManager: "0x09930125a49f5b95caf8052991cc14d1240dca8b43f42b899115b86867e4bce1",
        positionManager: "0xcffd746f78c2b50aafd19076bbe9c48f14446e5248fc5d76b9b4896610e51aab",
        permit2: "0x96d9f5c3f0fb0423426b7f970186235b7347027f4e5c19c40c412b7d97fc3751",
        weth: "0xc864e10689f2da18833652a3b075d43106e87f0f90d95ee64f6f0b33bc026083"
      }
    },
    /// Seaport 1.6, its ConduitController and OpenSea's conduit at the
    /// addresses 84532's row names, from tools/fixtures/seaport-1.6/
    /// probe.11155111.json — read by `node tools/verify-bazaar-fork.mjs
    /// --probe --chain 11155111` at one pinned block, the bytes eth_getCode
    /// returned kept beside it. The controller and the conduit hash as on
    /// 84532; Seaport does not, since its chain id and domain separator are
    /// immutables of its runtime.
    seaport: "0x0000000000000068F116a894984e2DB1123eB395",
    conduitController: "0x00000000F9490004C11Cef243f5400493c00Ad63",
    openseaConduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
    openseaConduit: "0x1E0049783F008A0085193E00003D00cd54003c71",
    seaportProbed: {
      on: "2026-10-25", block: 11987924, blockHash: "0x7350506dc3a5eac742e2a3ae5e1a13806cda90d6f71421e3af4695baa917fe17",
      version: "1.6", domainSeparator: "0xabe6fa56e16aecdc0a81f712b3c41518e063f22fb475c9f802a8265c782f7beb",
      codehashes: {
        seaport: "0xd3c20b1b63b44e7a392b8b95b710186b79cc494f440e07a01545e2fb14901f5a",
        conduitController: "0x880348b652e7cce91216153a4d0107e70c77b92192f3d7a127ff1f1351961948",
        openseaConduit: "0x069efdc9b946a332dce9951324fa197268e3ff0e00e44c6bf36049fc53113a41"
      }
    }
  }
};

/// A venue row's evidence, re-proved against the chain about to be used:
/// one [sentence, ok, detail] per claim the row makes. `read` is
/// { codeAt(addr) → hex, call(to, data) → hex } — the deploy adapter, or an
/// RpcChain's pinned reads (tools/verify-venues.mjs).
export const VENUE_KEYS = ["swapRouter02", "poolManager", "positionManager", "permit2", "weth"];
export async function checkVenues(read, row) {
  const out = [];
  const say = (sentence, ok, detail) => out.push([sentence, Boolean(ok), detail]);
  const addrOf = (hex) => (hex && hex.length >= 66 ? low("0x" + hex.replace(/^0x/, "").slice(24, 64)) : null);
  const ask = async (to, sig) => { try { return await read.call(to, enc(sig, [])); } catch { return null; } };
  /*  A row that names no Uniswap venue (and carries no Uniswap probe) makes
      no Uniswap claim: the Seaport half alone is what a Bazaar is landed
      against (W15, `deploySatellite`'s re-proof), and every row in VENUES
      today names both.                                                   */
  if (VENUE_KEYS.some((k) => row[k]) || row.probed) {
    for (const k of VENUE_KEYS) {
      const code = row[k] ? await read.codeAt(row[k]) : "0x";
      const h = code && code !== "0x" ? kecHex(code) : null;
      const want = row.probed?.codehashes?.[k];
      say(`the venue ${k} at ${row[k]} holds the code probed on ${row.probed?.on}`, h && want && low(h) === low(want), h ? `codehash ${h}, probed ${want}` : "no code there");
    }
    const pm = addrOf(await ask(row.positionManager, "poolManager()"));
    say("the PositionManager names this PoolManager", pm === low(row.poolManager), pm);
    const p2 = addrOf(await ask(row.positionManager, "permit2()"));
    say("the PositionManager names this Permit2", p2 === low(row.permit2), p2);
    const w1 = addrOf(await ask(row.positionManager, "WETH9()")), w2 = addrOf(await ask(row.swapRouter02, "WETH9()"));
    say("the PositionManager and SwapRouter02 name this WETH", w1 === low(row.weth) && w2 === low(row.weth), `${w1} and ${w2}`);
    const f = addrOf(await ask(row.swapRouter02, "factory()"));
    say("SwapRouter02 names the v3 factory the feed names", f === low(row.probed?.v3Factory), f);
  }
  /*  V2 (wave 2, W6): a row that names Seaport carries its own probe, and
      the claims tools/verify-bazaar-fork.mjs makes of it: the three
      codehashes, `information()` saying 1.6 and naming this controller,
      the controller naming this conduit for OpenSea's key, and the
      conduit's channel to Seaport open. A row without Seaport says nothing. */
  if (row.seaport) {
    const P = row.seaportProbed || {};
    for (const k of SEAPORT_KEYS) {
      const code = row[k] ? await read.codeAt(row[k]) : "0x";
      const h = code && code !== "0x" ? kecHex(code) : null;
      const want = P.codehashes?.[k];
      say(`the venue ${k} at ${row[k]} holds the code probed on ${P.on}`, h && want && low(h) === low(want), h ? `codehash ${h}, probed ${want}` : "no code there");
    }
    const info = await ask(row.seaport, "information()");
    let version = null, controller = null;
    try { version = decString(info); controller = addrOf("0x" + info.replace(/^0x/, "").slice(128, 192)); } catch { /* no answer */ }
    say("Seaport's information() says version 1.6 and names this ConduitController", version === "1.6" && controller === low(row.conduitController), `${version} ${controller}`);
    let named = null;
    try { named = addrOf(await read.call(row.conduitController, enc("getConduit(bytes32)", [row.openseaConduitKey]))); } catch { named = null; }
    say("the ConduitController names this conduit for OpenSea's conduit key", named === low(row.openseaConduit), named);
    let open = null;
    try { open = decBool(await read.call(row.conduitController, enc("getChannelStatus(address,address)", [row.openseaConduit, row.seaport]))); } catch { open = null; }
    say("the conduit's channel to Seaport is open", open === true, String(open));
  }
  return out;
}
/// The Seaport keys a venue row may carry beside the Uniswap ones (V2, W6).
export const SEAPORT_KEYS = ["seaport", "conduitController", "openseaConduit"];
/// The Seaport half of a venue row (W15): what the Bazaar is constructed and
/// re-proved against, apart from the Uniswap venues the Router needs.
export const seaportRow = (row) => (row?.seaport ? Object.fromEntries(
  ["seaport", "conduitController", "openseaConduitKey", "openseaConduit", "seaportProbed"].filter((k) => row[k] !== undefined).map((k) => [k, row[k]])) : null);

/// The bands tile the edition exactly once (IPSEITY `assertTiles`, verbatim
/// in intent): runs at import, throws on a backwards band, an overlap, a
/// hole or an edition not exhausted.
export function assertTiles(bands, total) {
  const rows = Object.values(bands).sort((a, b) => (a.first < b.first ? -1 : 1));
  let next = 1n;
  for (const r of rows) {
    if (r.last < r.first) throw new Error(`band ${r.name} runs backwards`);
    if (r.first < next) throw new Error(`band ${r.name} overlaps the one before it`);
    if (r.first > next) throw new Error(`ids ${next}..${r.first - 1n} belong to no band`);
    next = r.last + 1n;
  }
  if (next - 1n !== total) throw new Error(`the bands cover ${next - 1n} ids, the edition has ${total}`);
}
assertTiles(BANDS, COLLECTION);

export function bandOf(chainId) {
  const id = Number(chainId);
  if (BANDS[id]) return { ...BANDS[id], rehearsal: false };
  if (REHEARSAL[id]) return { band: 1, name: REHEARSAL[id], first: 1n, last: COLLECTION, rehearsal: true };
  throw new Error(`chain ${id} has no band and is not a rehearsal chain — refusing`);
}

/*═══════════════════ salts and predictions ═══════════════════*/

export const SALT_PREFIX = "intact.v1.";
/// V2 (wave 2, W6): the V2 satellites are predicted under salts of their own
/// namespace, "intact.v2.<key>"; every other key keeps "intact.v1.<key>".
export const V2_SALTED = ["keepsake", "journal", "bazaar", "bridges", "studio", "agora"];
/// The integration (W15): the Keepsake's renderer, `ART()`, is a seventh V2
/// deployment. Nothing but the Keepsake pins it, so it is not one of the six
/// the hub and the Catalog name, but it is predicted, salted and landed the
/// same way, under "intact.v2.keepsakeArt", and it lands before the Keepsake.
export const V2_ART = "keepsakeArt";
/// The order V2 lands in, by the burner in a fresh deployment (`--v2`) or
/// through the Timelock afterwards (`--satellite`): the art before the
/// Keepsake that pins it, then the Journal, the Bazaar, Bridges, and the
/// Studio and Agora, each constructed at the other's prediction.
export const V2_ORDER = [V2_ART, "keepsake", "journal", "bazaar", "bridges", "studio", "agora"];
export const saltName = (key) => (V2_ORDER.includes(key) ? "intact.v2." : SALT_PREFIX) + key;
export const saltOf = (key) => kec(Buffer.from(saltName(key), "utf8"));

/// Every record key that is a CREATE3 deployment, in deployment order. The
/// three post-MVB pins are predicted and codeless on every chain today.
export const SALTED = [
  "timelock", "crest", "reachImpl", "gripImpl",
  "catalogRows", "catalogRowsPost", "catalogRowsV2", "catalogText", "catalogState", "catalog", "renderer",
  "coreFacet", "rightsFacet", "mintFacet", "siteFacet", "hub",
  "keys", "roster", "postage", "parley", "locks", "pool", "kiln", "launchpad", "router", "steward", "premises"
];
/// From schema 3 (V2, W6) the six V2 satellites are placeholders too: the
/// hub pins the Keepsake and the Journal, the Catalog's world names all six,
/// each CREATE3-predicted under its "intact.v2.<key>" salt and codeless until
/// it lands; and (W15) the Keepsake's art, which only the Keepsake pins.
export const PLACEHOLDERS = ["market", "roles", "agentCard", "nameplate", "custodian", ...V2_SALTED, V2_ART];
/// AgentCard, LPCustodian, Market, Roles and the Nameplate land AFTER the
/// MVB record (DESIGN §12's tail), at the addresses the hub, the Catalog,
/// the Renderer and the Premises already pin — the same factory, the same
/// salts — and only through the Timelock's seven-day public queue, since
/// the factory admits nobody but the burner (destroyed once the MVB record
/// is written) and the Timelock. The admin queues
/// `Timelock.execute(factory, 0, deploy(salt, initcode))`; anyone lands it
/// once ripe. On a rehearsal the burner still holds the admin, so one
/// command queues, moves the clock and lands it. Every constructor
/// argument comes from the record's own addresses (`args(world)`), so a
/// satellite can pin nothing the record does not name; `pins` lists the
/// record keys it needs, refused up front when absent; `bands`, when set,
/// restricts a satellite to those bands. Entries are added as the units
/// land (U14–U18).
export const SATELLITES = {
  agentCard: { file: "src/AgentCard.sol", name: "AgentCard", pins: ["hub", "catalog", "premises"],
               args: (w) => encodeParams("address,address,address", [w.hub, w.catalog, w.premises]) },
  /// the v4 launch path's custodian (U14): lands only where the venue table
  /// names a probed PoolManager, PositionManager and Permit2 — contract
  /// addresses probed for code on a dated commit, never recalled
  custodian: { file: "src/LPCustodian.sol", name: "LPCustodian", pins: ["hub", "launchpad", "kiln"],
               admits: (rec) => (rec.venues?.poolManager && rec.venues?.positionManager && rec.venues?.permit2 ? null
                 : `chain ${rec.chainId} has no probed venue table with a PoolManager, a PositionManager and a Permit2 (VENUES in tools/deploy.mjs) — the custodian seeds v4 positions and lands nowhere without one`),
               args: (w, rec) => encodeParams("address,address,address,address,address,address",
                 [w.hub, w.launchpad, w.kiln, rec.venues.poolManager, rec.venues.positionManager, rec.venues.permit2]) },
  market:    { file: "src/Market.sol", name: "Market", pins: ["hub", "pool"],
               args: (w) => encodeParams("address,address", [w.hub, w.pool]) },
  roles:     { file: "src/Roles.sol", name: "Roles", pins: ["hub"],
               args: (w) => encodeParams("address", [w.hub]) },
  /// band 0's resolver (U18): the ENS singletons are contract addresses
  /// (`tools/ens-name.mjs`), never endpoints; a chain with no NameWrapper
  /// in that table is refused by name before anything is sent
  nameplate: { file: "src/Nameplate.sol", name: "Nameplate", pins: ["hub", "premises"],
               admits: (rec) => (NAME_WRAPPER[Number(rec.chainId)] ? null : `chain ${rec.chainId} has no NameWrapper in tools/ens-name.mjs's table — the Nameplate is band 0's (Ethereum, and Sepolia to rehearse)`),
               args: (w, rec) => encodeParams("address,address,address,address,address,string",
                 [w.hub, w.premises, ENS_REGISTRY, NAME_WRAPPER[Number(rec.chainId)], ETH_REGISTRAR, "intact"]) },
  /*  V2 (W15; W6's request 6, H4). Each lands at its "intact.v2.<key>"
      placeholder, its constructor arguments from the record: only a record
      of schema 3 or later has the hub that pins a Keepsake and a Journal and
      the Catalog that names all six, so an older record admits none of
      them. `after` names what must have code before this one is executed
      (the art the Keepsake pins as ART); the Studio and Agora are each
      constructed at the other's prediction, which neither inspects.     */
  keepsakeArt: { file: "src/KeepsakeArt.sol", name: "KeepsakeArt", pins: [], admits: (rec) => v2Admits(rec),
                 args: () => "" },
  keepsake: { file: "src/Keepsake.sol", name: "Keepsake", pins: ["hub", "pool", V2_ART], after: [V2_ART], admits: (rec) => v2Admits(rec),
              args: (w) => encodeParams("address,address,address", [w.hub, w.pool, w[V2_ART]]) },
  journal: { file: "src/Journal.sol", name: "Journal", pins: ["hub"], admits: (rec) => v2Admits(rec),
             args: (w) => encodeParams("address", [w.hub]) },
  /// a venue's zone: Seaport 1.6 is the venue table's (`VENUES`, `seaport`, probed
  /// with its own evidence), never recalled; a record whose row names none is refused
  bazaar: { file: "src/Bazaar.sol", name: "Bazaar", pins: ["hub", "pool", "venueSeaport"], venue: (rec) => seaportRow(rec.venues),
            admits: (rec) => v2Admits(rec) || (rec.venues?.seaport ? null
              : `chain ${rec.chainId}'s record names no Seaport venue (VENUES in tools/deploy.mjs, seaport, probed) — the Bazaar zones Seaport 1.6's orders and lands nowhere without one`),
            args: (w) => encodeParams("address,address,address", [w.venueSeaport, w.hub, w.pool]) },
  bridges: { file: "src/Bridges.sol", name: "Bridges", pins: ["timelock"], admits: (rec) => v2Admits(rec),
             args: (w) => encodeParams("address", [w.timelock]) },
  studio: { file: "src/Studio.sol", name: "Studio", pins: ["hub", "journal", "agora"], admits: (rec) => v2Admits(rec),
            args: (w) => encodeParams("address,address,address", [w.hub, w.journal, w.agora]) },
  agora: { file: "src/Agora.sol", name: "Agora", pins: ["hub", "keys", "studio"], admits: (rec) => v2Admits(rec),
           args: (w) => encodeParams("address,address,address", [w.hub, w.keys, w.studio]) }
};
/// A V2 satellite lands only for a record whose hub and Catalog name it: schema 3 or later.
function v2Admits(rec) {
  const s = schemaOf(rec);
  return s >= 3 ? null : `the record is schema ${s || "(none)"}, written before V2 — its hub pins no Keepsake or Journal and its Catalog names no V2 satellite`;
}
/// DESIGN §12's post-MVB order, then V2's. `admits(rec)`, when present, names
/// why a chain does not take the satellite (null when it does).
export const SATELLITE_ORDER = ["agentCard", "custodian", "market", "roles", "nameplate", ...V2_ORDER];
export const admitsSatellite = (key, rec) => (SATELLITES[key].admits ? SATELLITES[key].admits(rec) : null);
/// DESIGN §12's order as one list, asserted against the journal before the
/// record is written: the factory, the Timelock, the Engine (whose loads
/// are journaled apart), then every salted key. The facets exist only in
/// the diamond build and the Router only where a venue table exists, so
/// the assertion compares the journal with this list FILTERED to what the
/// run deployed, in this order.
/// A fresh deployment run with `--v2` (W15) lands V2 by the burner right
/// after the Premises, in V2_ORDER, so a journal that holds V2 steps holds
/// them last.
export const DEPLOY_ORDER = ["factory", "timelock", "engine", ...SALTED.filter((k) => k !== "timelock"), ...V2_ORDER];
/// What a complete MVB record contains. `router` is present only where a
/// venue table exists for the chain; the facets only in the diamond build.
export const RECORD_KEYS = ["factory", "engine", ...SALTED];

export const PROXY_INITCODE_HASH = "0x21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f";

/// keccak(0xff ‖ factory ‖ salt ‖ keccak(proxy initcode)) is the proxy;
/// keccak(rlp([proxy, 1])) is what the proxy's first CREATE lands at. The
/// third implementation of this formula (the factory's `predict` and
/// test/Create3.t.sol hold the other two) — they check each other.
export function predictCreate3(factory, salt) {
  const proxy = kecHex("ff" + low(factory).slice(2) + salt.replace(/^0x/, "") + PROXY_INITCODE_HASH.slice(2)).slice(26);
  return "0x" + kecHex("d694" + proxy + "01").slice(26);
}

export const DEPLOYED_TOPIC = kec(Buffer.from("Deployed(bytes32,address)", "utf8"));
const PANEL_TOPIC = kec(Buffer.from("PanelLoaded(uint256,address,uint256,bytes32)", "utf8"));
const LOADED_TOPIC = kec(Buffer.from("Loaded(bool,uint256,address,uint256)", "utf8"));

/*═══════════════════ the chain adapter ═══════════════════*/

/// One surface over tools/evm.mjs `Chain` and tools/rpc.mjs `RpcChain`:
///   from, chainId, deploy(code,args,label) → {address, logs, gas, block, hash}
///   exec(to,sig,args,{value,label}) → {logs, gas, block, hash}
///   call(to,data) / read(to,sig,args) → hex, codeAt(addr) → hex,
///   getLogs(filter), blockNumber(), nonceNow(), balanceOf, setCode?(addr,hex), gas
/// Logs are normalised to {address, topics[], data} lowercase hex whichever
/// side produced them.
export function adapt(c) {
  const inProcess = Boolean(c.vm);
  const hex = (u) => (typeof u === "string" ? low(u) : "0x" + Buffer.from(u).toString("hex"));
  const logsOf = (raw) => (raw || []).map((l) => Array.isArray(l)
    ? { address: hex(l[0]), topics: l[1].map(hex), data: hex(l[2]) }
    : { address: low(l.address), topics: l.topics.map(low), data: low(l.data) });
  const norm = async (r) => ({
    address: r.address ? low(r.address) : null, gas: r.gas, hash: r.hash || null,
    block: r.block !== undefined ? BigInt(r.block) : (inProcess ? EVM.BLOCK.header.number : 0n),
    logs: logsOf(r.logs)
  });
  const ad = {
    raw: c, inProcess,
    chainId: Number(c.chainId ?? (c.common ? c.common.chainId() : c.vm ? c.vm.common.chainId() : 1)),
    from: low(c.from.toString()), gas: c.gas,
    deploy: async (code, args = "", label = "") => norm(await c.send({ data: code + args.replace(/^0x/, ""), label })),
    exec: async (to, sig, args = [], o = {}) => norm(await c.exec(to, sig, args, o)),
    call: (to, data) => c.call(to, data),
    read: (to, sig, args = []) => c.read(to, sig, args),
    getLogs: (f) => c.getLogs(f),
    nonceNow: () => c.nonceNow(),
    balanceOf: (a) => c.balanceOf(a),
    /// whether the chain meters state creation as its own gas (EIP-8037, measured by tools/rpc.mjs);
    /// the in-process chain is Cancun and never does
    stateGas: async () => (inProcess || !c.stateGas ? false : c.stateGas()),
    codeAt: async (addr) => inProcess
      ? bytesToHex(await c.vm.stateManager.getCode(createAddressFromString(addr)))
      : low(await c.rpc("eth_getCode", [addr, await c.tag()])),   // pinned: a replica behind the receipt answers "header not found" and is retried, never 0x
    blockNumber: async () => inProcess ? EVM.BLOCK.header.number : BigInt(await c.rpc("eth_blockNumber")),
    /// the chain's clock (the latest block's timestamp) and any account's nonce
    timestamp: async () => inProcess ? EVM.BLOCK.header.timestamp : BigInt((await c.rpc("eth_getBlockByNumber", ["latest", false])).timestamp),
    nonceOf: async (addr) => inProcess
      ? BigInt((await c.vm.stateManager.getAccount(createAddressFromString(addr)))?.nonce ?? 0n)
      : BigInt(await c.rpc("eth_getTransactionCount", [addr, "latest"]))
  };
  if (inProcess) {
    ad.setCode = async (addr, codeHex) => {
      const a = createAddressFromString(addr);
      if (!(await c.vm.stateManager.getAccount(a))) await c.vm.stateManager.putAccount(a, new Account());
      await c.vm.stateManager.putCode(a, hexToBytes(codeHex));
    };
    /// the clock moves only on a chain that is nobody's: in-process, or hardhat
    ad.warp = async (t) => { EVM.warp(BigInt(t)); };
  } else if (ad.chainId === 31337 || c.fork) {
    /// 31337, or a hardhat fork of a rehearsal chain (tools/testnet.mjs --fork):
    /// nobody's chain, whatever its id
    ad.warp = async (t) => { await c.rpc("evm_setNextBlockTimestamp", [Number(t)]); await c.rpc("evm_mine", []); };
    ad.setCode = (addr, codeHex) => c.rpc("hardhat_setCode", [addr, codeHex]);
  }
  return ad;
}

/*═══════════════════ the three lag defences ═══════════════════*/

/// Wait until `addr` holds code — before any constructor that inspects a
/// fresh deployment. A lagging replica replays `eth_estimateGas` against a
/// state where the dependency is still `0x`, reports a revert, and the
/// deploy dies on a false negative.
export async function awaitCode(ad, addr, what = addr) {
  for (let i = 0; i < 12; i++) {
    const code = await ad.codeAt(addr);
    if (code && code !== "0x") return code;
    await sleep(ad.inProcess ? 0 : 500 * (i + 1));
  }
  throw new Error(`no code at ${what} (${addr}) after waiting — the endpoint never caught up`);
}

/// Block until the endpoint reports at least block `n` (the receipt's).
export async function awaitBlock(ad, n) {
  for (let i = 0; i < 40; i++) {
    if ((await ad.blockNumber()) >= BigInt(n)) return;
    await sleep(ad.inProcess ? 0 : 750);
  }
  throw new Error(`the endpoint never reached block ${n}`);
}

/// Receipt logs by topic — ids and addresses come from here, never from a
/// read after the write.
export const logsBy = (logs, address, topic0) =>
  logs.filter((l) => l.address === low(address) && l.topics[0] === topic0);

/*═══════════════════ ABI decoding beyond evm.mjs ═══════════════════*/

/// A dynamic array of 32-byte words at head word `at`.
export function decWords(hex, at = 0) {
  const h = hex.replace(/^0x/, "");
  const base = Number(BigInt("0x" + h.substr(at * 64, 64))) * 2;
  const n = Number(BigInt("0x" + h.substr(base, 64)));
  const out = [];
  for (let i = 0; i < n; i++) out.push("0x" + h.substr(base + 64 + i * 64, 64));
  return out;
}
export const decAddrs = (hex) => decWords(hex).map((w) => "0x" + w.slice(26));
export const decBytes4s = (hex) => decWords(hex).map((w) => w.slice(0, 10));

/*═══════════════════ what deploy and recover both walk ═══════════════════*/

/// [holder key, getter, target key]: every immutable pin that is an address,
/// read back after deployment and again by recover-record. Mutual pairs
/// appear as two rows (hub.POOL and pool.HUB), so a one-sided pin is a
/// disagreement in one direction and a contradiction in the other.
export const PINS = [
  ["factory", "TIMELOCK()", "timelock"],
  ["hub", "REACH_IMPL()", "reachImpl"], ["hub", "GRIP_IMPL()", "gripImpl"],
  ["hub", "STEWARD()", "steward"], ["hub", "MARKET()", "market"], ["hub", "ROLES()", "roles"],
  ["hub", "POOL()", "pool"], ["hub", "PARLEY()", "parley"], ["hub", "LAUNCHPAD()", "launchpad"],
  ["hub", "LOCKS()", "locks"], ["hub", "RENDERER()", "renderer"], ["hub", "CATALOG()", "catalog"],
  ["hub", "PREMISES()", "premises"], ["hub", "TIMELOCK()", "timelock"],
  ["catalog", "HUB()", "hub"], ["catalog", "ENGINE()", "engine"], ["catalog", "ROUTER()", "router"],
  ["catalog", "ROSTER()", "roster"], ["catalog", "POSTAGE()", "postage"], ["catalog", "KEYS()", "keys"],
  ["catalog", "KILN()", "kiln"], ["catalog", "AGENTCARD()", "agentCard"], ["catalog", "REACH_IMPL()", "reachImpl"],
  ["catalog", "GRIP_IMPL()", "gripImpl"], ["catalog", "POOL()", "pool"], ["catalog", "PARLEY()", "parley"],
  ["catalog", "LAUNCHPAD()", "launchpad"], ["catalog", "LOCKS()", "locks"], ["catalog", "STEWARD()", "steward"],
  ["catalog", "MARKET()", "market"], ["catalog", "ROLES()", "roles"], ["catalog", "TIMELOCK()", "timelock"],
  ["catalog", "PREMISES()", "premises"], ["catalog", "RENDERER()", "renderer"],
  ["catalog", "TEXT()", "catalogText"], ["catalog", "STATE()", "catalogState"],
  /// from schema 2 (the console round) the Catalog pins the Nameplate too; a schema-1 record's Catalog predates the getter
  ["catalog", "NAMEPLATE()", "nameplate", 2],
  ["catalogState", "TEXT()", "catalogText"], ["catalogText", "ROWS()", "catalogRows"], ["catalogText", "ROWS_POST()", "catalogRowsPost"],
  /// from schema 3 (V2, W6): the hub's two V2 pins, the Catalog's V2 world and its third table
  ["hub", "KEEPSAKE()", "keepsake", 3], ["hub", "JOURNAL()", "journal", 3],
  ["catalog", "KEEPSAKE()", "keepsake", 3], ["catalog", "JOURNAL()", "journal", 3], ["catalog", "BAZAAR()", "bazaar", 3],
  ["catalog", "BRIDGES()", "bridges", 3], ["catalog", "STUDIO()", "studio", 3], ["catalog", "AGORA()", "agora", 3],
  ["catalog", "SEAPORT()", "venueSeaport", 3], ["catalogText", "ROWS_V2()", "catalogRowsV2", 3],
  ["renderer", "HUB()", "hub"], ["renderer", "ENGINE()", "engine"], ["renderer", "CREST()", "crest"],
  ["renderer", "CATALOG()", "catalog"], ["renderer", "AGENTCARD()", "agentCard"],
  ["premises", "HUB()", "hub"], ["premises", "RENDERER()", "renderer"], ["premises", "ENGINE()", "engine"],
  ["premises", "CATALOG()", "catalog"], ["premises", "CREST()", "crest"], ["premises", "AGENTCARD()", "agentCard"],
  ["parley", "HUB()", "hub"], ["parley", "KEYS()", "keys"], ["parley", "POSTAGE()", "postage"],
  ["postage", "HUB()", "hub"], ["postage", "PARLEY()", "parley"],
  ["roster", "PARLEY()", "parley"], ["roster", "HUB()", "hub"],
  ["pool", "HUB()", "hub"], ["pool", "LAUNCHPAD()", "launchpad"],
  ["kiln", "HUB()", "hub"], ["kiln", "LAUNCHPAD()", "launchpad"],
  ["launchpad", "HUB()", "hub"], ["launchpad", "KILN()", "kiln"], ["launchpad", "POOL()", "pool"], ["launchpad", "LOCKS()", "locks"],
  ["kiln", "POOL_MANAGER()", "venuePoolManager"],
  ["locks", "HUB()", "hub"], ["steward", "HUB()", "hub"],
  ["router", "HUB()", "hub"], ["router", "POOL()", "pool"],
  ["router", "SWAP_ROUTER02()", "venueSwapRouter02"], ["router", "POOL_MANAGER()", "venuePoolManager"], ["router", "WETH()", "venueWeth"],
  /// the post-MVB satellites' own pins, read back the moment one lands
  ["market", "HUB()", "hub"], ["market", "POOL()", "pool"],
  ["roles", "HUB()", "hub"],
  ["agentCard", "HUB()", "hub"], ["agentCard", "CATALOG()", "catalog"], ["agentCard", "PREMISES()", "premises"],
  ["launchpad", "CUSTODIAN()", "custodian"],
  ["custodian", "HUB()", "hub"], ["custodian", "LAUNCHPAD()", "launchpad"], ["custodian", "KILN()", "kiln"],
  ["custodian", "POOL_MANAGER()", "venuePoolManager"], ["custodian", "POSITION_MANAGER()", "venuePositionManager"], ["custodian", "PERMIT2()", "venuePermit2"],
  /// V2's own pins (W15), read back the moment each lands — only a schema-3 record can hold one,
  /// so they need no schema of their own; Studio and Agora are a mutual pair, both ways
  ["keepsake", "HUB()", "hub"], ["keepsake", "POOL()", "pool"], ["keepsake", "ART()", V2_ART],
  ["journal", "HUB()", "hub"],
  ["bazaar", "SEAPORT()", "venueSeaport"], ["bazaar", "HUB()", "hub"], ["bazaar", "POOL()", "pool"],
  ["bridges", "TIMELOCK()", "timelock"],
  ["studio", "HUB()", "hub"], ["studio", "JOURNAL()", "journal"], ["studio", "AGORA()", "agora"],
  ["agora", "HUB()", "hub"], ["agora", "KEYS()", "keys"], ["agora", "STUDIO()", "studio"]
];
/// The record schema this tree writes, and whether a PINS row applies to a
/// record: a row with a fourth element exists in records of that schema or
/// later, because its holder's code in an older record has no such getter
/// (2: the Catalog's NAMEPLATE; 3: V2's — the hub's KEEPSAKE and JOURNAL,
/// the Catalog's seven V2 addresses, CatalogText's ROWS_V2). Every walker of
/// PINS asks this first.
export const RECORD_SCHEMA = 3;
export const schemaOf = (rec) => Number((String(rec?.schema || "").match(/^intact\.deployment\/(\d+)$/) || [])[1] || 0);
export const pinApplies = (row, rec) => !row[3] || schemaOf(rec) >= row[3];
/// The venue table's addresses as PINS targets (`venue*` keys), so the
/// Kiln's and the Router's venue immutables are read back like every other
/// pin: a record that lies about `venues.poolManager` is caught by name,
/// not only by the Router's codehash. Absent venues pin as address(0).
export const venueTargets = (venues) => ({
  venuePoolManager: venues?.poolManager || ZERO, venueSwapRouter02: venues?.swapRouter02 || ZERO, venueWeth: venues?.weth || ZERO,
  venuePositionManager: venues?.positionManager || ZERO, venuePermit2: venues?.permit2 || ZERO,
  venueSeaport: venues?.seaport || ZERO                                   // V2 (W6): the Catalog's SEAPORT
});
/// The Router's bytes32 immutables: [getter, what the chain must say given
/// the record]. POOL_HASH is the Pool's codehash at construction; the two
/// venue hashes are the venues' codehashes or zero when the venue is absent;
/// the hook codehash is the table's.
export const ROUTER_HASHES = ["POOL_HASH()", "SWAP_ROUTER02_HASH()", "POOL_MANAGER_HASH()", "LAUNCH_HOOK_CODEHASH()"];
/// Non-address immutables of the hub and the Catalog, read back as numbers.
export const BAND_GETTERS = [["hub", "BAND()"], ["hub", "BAND_LO()"], ["hub", "BAND_HI()"],
                             ["catalog", "BAND()"], ["catalog", "BAND_LO()"], ["catalog", "BAND_HI()"]];

/*═══════════════════ journal ═══════════════════*/

/// tmp + rename, mode 0o600: a crash mid-write leaves the old file, never
/// half of the new one. Public receipt data only — never the key.
export function atomicWrite(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, (k, v) => (typeof v === "bigint" ? v.toString() : v), 1) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/*═══════════════════ inputs ═══════════════════*/

export function readDist() {
  const p = path.join(ROOT, "dist/shards.json");
  if (!fs.existsSync(p)) throw new Error("dist/shards.json is missing — run `node tools/build-app.mjs`");
  const plan = JSON.parse(fs.readFileSync(p, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "dist/manifest.json"), "utf8"));
  if (plan.mode !== "packed") throw new Error(`dist/shards.json mode is ${plan.mode}, not packed`);
  return { plan, manifest };
}

export function toolchain() {
  const solc = require("solc");
  return { solc: solc.version(), optimizerRuns: 800, viaIR: true, evmVersion: "cancun", bytecodeHash: "none", eip170: LIMIT };
}

/*═══════════════════ the deployment ═══════════════════*/

/**
 * Deploy the whole band through `ad` (an adapted chain). Returns the record.
 * Throws — and writes no record — on any prediction miss, any post-condition
 * failure, or any disagreement recover-record finds.
 *
 * opts: out, plan, manifest, price, venues, journalPath (null = in memory),
 *       recordPath (null = return only; undefined = deployments/<chainId>.json),
 *       band override, log(line), v2 (W15: land V2 by the burner after the
 *       Premises, recorded under `satellites` with `via: "burner"`),
 *       mispredict {key: address} — a TEST hook that feeds a wrong prediction
 *       into every constructor that pins `key`, so the refusal can be proved;
 *       crashAfter "<loadHead|loadBody|loadPanel>:<i>" — a TEST hook that
 *       throws right after that shard is journaled, so a run that died
 *       mid-engine can be staged and its resume proved.
 */
export async function deployIntact(ad, opts = {}) {
  const log = opts.log || (() => {});
  const out = opts.out || compile({ quiet: true });
  const A = (f, n) => artifact(out, f, n);
  const { plan, manifest } = opts.plan ? { plan: opts.plan, manifest: opts.manifest } : readDist();
  const price = opts.price ?? 10n ** 16n;
  const chainId = ad.chainId;
  const band = opts.band || bandOf(chainId);
  let venues = opts.venues !== undefined ? opts.venues : (VENUES[chainId] || null);
  /// the Router pins ONE codehash for every launch's hook (DESIGN §6.2): the
  /// LaunchHook carries no immutable, so the compiled runtime's keccak is
  /// that number on every band; a venue table that does not name it gets it
  /// here, and the record carries what the Router was told
  const hookArt = (() => { try { return artifact(out, "src/LaunchHook.sol", "LaunchHook"); } catch { return null; } })();
  const hookHash = hookArt ? kecHex(hookArt.deployed) : "0x" + "00".repeat(32);
  if (venues && !venues.launchHookCodehash && hookArt) venues = { ...venues, launchHookCodehash: hookHash };
  /// the Router lands where the row names a Uniswap venue; a row that names
  /// only Seaport (the Bazaar's venue, W15) is a venue table for the Bazaar
  /// and none for the Router, whose letter X is then pinned as address(0)
  const routed = Boolean(venues && (venues.swapRouter02 || venues.poolManager));
  /// over a wire, the venue row is re-proved before anything is sent: a
  /// venue whose code is not the code probed, or a PositionManager naming
  /// another PoolManager, refuses the deploy by name
  if (venues && !ad.inProcess && (venues.probed || venues.seaportProbed)) {
    const bad = (await checkVenues(ad, venues)).filter(([, ok]) => !ok);
    if (bad.length) throw new Error(`the venue table's row for chain ${chainId} does not hold on this chain — re-probe it (tools/verify-venues.mjs):\n    ${bad.map(([s, , d]) => `${s}: ${d}`).join("\n    ")}`);
  }
  const ship = { ...shipRule(out), limit: LIMIT, solc: toolchain().solc };
  if (ship.build !== "diamond" && ship.build !== "monolith") throw new Error(`the ship rule is ${ship.build}: ${ship.reason}`);
  const from = ad.from;

  /// the in-process EVM is never a public chain; anything over a wire is
  if (plan.placeholder && chainId !== 31337 && !ad.inProcess) {
    throw new Error("dist/ holds the PLACEHOLDER shell from tools/fixtures/ — refusing to deploy it anywhere but 31337");
  }

  /*── the journal: resume if one exists for this deployer ──*/
  const journalPath = opts.journalPath === undefined ? path.join(ROOT, "deployments", `${chainId}.journal.json`) : opts.journalPath;
  let journal = { schema: "intact.journal/1", chainId, deployer: from, startedAt: new Date().toISOString(), steps: {}, loads: [] };
  if (journalPath && fs.existsSync(journalPath)) {
    const j = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    if (low(j.deployer) !== from) throw new Error(`${journalPath} belongs to deployer ${j.deployer}, this key is ${from}`);
    const done = Object.keys(j.steps).length;
    if (done && (await ad.nonceNow()) === 0n) {
      /*  The journal says this key sent transactions; the chain says it
          never did. On 31337 that is a restarted node and the journal is
          stale: set aside (never deleted — it is the only account of
          what the old chain held) and start clean. Anywhere else the two
          cannot both be true and nothing is sent.                       */
      if (chainId !== 31337) throw new Error(`${path.relative(ROOT, journalPath)} records ${done} step(s) by ${from}, but the chain has ${from} at nonce 0 — a different chain, or an endpoint far behind; refusing`);
      const aside = journalPath.replace(/\.json$/, "") + `.stale-${Date.now()}.json`;
      fs.renameSync(journalPath, aside);
      log(`  the journal (${done} step(s)) names a run this chain never saw — the local node was restarted; set aside as ${path.relative(ROOT, aside)}, starting clean`);
    } else {
      journal = j;
      log(`  resuming from ${path.relative(ROOT, journalPath)} (${done} step(s) done)`);
    }
  }
  const save = () => { if (journalPath) atomicWrite(journalPath, journal); };
  const gasOf = {};
  /// every receipt is held to the EIP-7825 transaction cap (DESIGN §12) — a
  /// step that spent more could not be included on a Fusaka chain. On a
  /// chain that meters state gas (EIP-8037) a receipt counts the state
  /// reservoir too, and the cap binds the execution share alone, which the
  /// node's estimate already held (tools/rpc.mjs `send`).
  const stateGas = ad.stateGas ? await ad.stateGas() : false;
  const took = (label, r) => {
    if (!stateGas && BigInt(r.gas || 0n) > TX_GAS_CAP) throw new Error(`${label} used ${r.gas} gas, over the 2^24 transaction cap — not includable on a Fusaka chain`);
    gasOf[label] = (gasOf[label] || 0n) + BigInt(r.gas || 0n); return r;
  };

  /*── the registry: canonical address, real runtime, checked by codehash ──*/
  const registryCode = await ad.codeAt(REGISTRY);
  if (registryCode === "0x") {
    if (!ad.setCode) {
      throw new Error("no code at the canonical ERC-6551 registry on this chain; deploy the reference " +
                      "registry via its published CREATE2 transaction first");
    }
    await ad.setCode(REGISTRY, REGISTRY_RUNTIME);
    log("  etched the ERC-6551 registry runtime at its canonical address (local chain)");
  }
  const registryHash = kecHex(await ad.codeAt(REGISTRY));
  if (registryHash !== kecHex(REGISTRY_RUNTIME)) throw new Error(`the registry at ${REGISTRY} is not the reference runtime (${registryHash})`);

  /*── the factory: the one plain CREATE, from the burner at nonce 0 ──*/
  const nonce0 = await ad.nonceNow();
  let factory;
  if (journal.steps.factory) {
    factory = low(journal.steps.factory.address);
    if ((await ad.codeAt(factory)) === "0x") {
      throw new Error(`the journal names a factory at ${factory} with no code — a different chain, or an endpoint far behind` +
                      (chainId === 31337 ? `; if the local node was restarted, remove ${journalPath ? path.relative(ROOT, journalPath) : "the journal"} and run again` : ""));
    }
  } else {
    if (nonce0 !== 0n) {
      const msg = `the deployer ${from} is at nonce ${nonce0}, not 0 — the factory's address, and so every address, would differ from the other bands'`;
      if (chainId === 31337 || opts.allowUsedBurner) log("  WARNING " + msg); else throw new Error(msg);
    }
    const want = predictCreate(from, nonce0);
    const r = took("factory", await ad.deploy(A("src/lib/Create3Factory.sol", "Create3Factory").bytecode, "", "factory"));
    await awaitBlock(ad, r.block);
    if (r.address !== want) throw new Error(`the factory landed at ${r.address}, predicted ${want}`);
    factory = want;
    journal.factoryNonce = nonce0.toString();
    journal.steps.factory = { address: factory, codehash: kecHex(await ad.codeAt(factory)), gas: r.gas.toString(), tx: r.hash, block: r.block.toString() };
    save();
  }
  log(`  factory ${factory}`);

  /*── every CREATE3 address, up front ──*/
  const salts = {};
  for (const k of [...SALTED, ...PLACEHOLDERS]) salts[k] = saltOf(k);
  const P = {};
  for (const k of Object.keys(salts)) P[k] = predictCreate3(factory, salts[k]);
  /// the gate the factory was built with: this key, and the Timelock's
  /// predicted address — checked now, since every later step depends on it
  const gateDeployer = low(decAddr(await ad.read(factory, "DEPLOYER()")));
  if (gateDeployer !== from) throw new Error(`the factory's DEPLOYER is ${gateDeployer}, this key is ${from} — this key cannot deploy through it`);
  const gateTimelock = low(decAddr(await ad.read(factory, "TIMELOCK()")));
  if (gateTimelock !== P.timelock) throw new Error(`the factory's TIMELOCK is ${gateTimelock}, the timelock salt predicts ${P.timelock}`);
  /// what the constructors are TOLD (the test hook may lie here; the chain never does)
  const T = { ...P, ...(opts.mispredict || {}) };
  if (!routed) { P.router = ZERO; T.router = ZERO; }

  const got = { factory }; // key → deployed address
  const codehashes = {};  // key → extcodehash
  const reproducible = {};// key → codehash equals keccak(compiled runtime)

  /// One CREATE3 step: resume or deploy, then prove the address from the
  /// factory's own event and the code from the chain.
  const create3 = async (key, file, name, argsHex = "", inspects = []) => {
    const art = A(file, name);
    const init = art.bytecode + argsHex.replace(/^0x/, "");
    const initBytes = (init.length - 2) / 2;
    if (initBytes > 49_152) throw new Error(`${key}'s initcode is ${initBytes} bytes, over EIP-3860's 49,152`);
    const want = P[key];
    const have = await ad.codeAt(want);
    if (have !== "0x") {
      const j = journal.steps[key];
      if (j && low(j.address) === want && j.codehash === kecHex(have)) {
        log(`  ${key.padEnd(13)} ${want}  (journaled, skipped)`);
      } else {
        throw new Error(`code at ${key}'s predicted address ${want} that this run's journal does not account for — ` +
                        `someone else used salt ${salts[key]}; refusing`);
      }
    } else {
      for (const a of inspects) await awaitCode(ad, a.addr, a.what);
      const r = took(key, await ad.exec(factory, "deploy(bytes32,bytes)", [salts[key], init], { label: key }));
      await awaitBlock(ad, r.block);
      const ev = logsBy(r.logs, factory, DEPLOYED_TOPIC).filter((l) => l.topics[1] === salts[key]);
      if (ev.length !== 1) throw new Error(`${key}: expected one Deployed event from the factory, saw ${ev.length}`);
      const landed = "0x" + ev[0].topics[2].slice(26);
      if (landed !== want) throw new Error(`a prediction missed: ${key} predicted ${want}, landed ${landed} — refusing to continue`);
      journal.steps[key] = { address: want, salt: salts[key], codehash: kecHex(await ad.codeAt(want)),
                             gas: r.gas.toString(), tx: r.hash, block: r.block.toString() };
      save();
      log(`  ${key.padEnd(13)} ${want}  ${(Number(r.gas) / 1e6).toFixed(2)}M gas`);
    }
    got[key] = want;
    codehashes[key] = journal.steps[key].codehash;
    reproducible[key] = codehashes[key] === kecHex(art.deployed);
    return want;
  };
  const code = (key) => ({ addr: got[key] || P[key], what: key });

  /*── 2. Timelock(admin = burner) ──*/
  await create3("timelock", "src/Timelock.sol", "Timelock", encodeParams("address", [from]));

  /*── 3. Engine: plain CREATE (curator = msg.sender), then the shards ──*/
  let engine;
  if (journal.steps.engine) {
    engine = low(journal.steps.engine.address);
    if ((await ad.codeAt(engine)) === "0x") throw new Error("the journal names an Engine with no code");
  } else {
    const n = await ad.nonceNow();
    const want = predictCreate(from, n);
    if ((await ad.codeAt(want)) !== "0x") throw new Error(`code already at the Engine's predicted address ${want}`);
    const r = took("engine", await ad.deploy(A("src/Engine.sol", "Engine").bytecode, "", "engine"));
    await awaitBlock(ad, r.block);
    if (r.address !== want) throw new Error(`a prediction missed: engine predicted ${want} (CREATE from ${from} at nonce ${n}), landed ${r.address}`);
    engine = want;
    journal.steps.engine = { address: engine, via: { create: { from, nonce: n.toString() } }, codehash: kecHex(await ad.codeAt(engine)),
                             gas: r.gas.toString(), tx: r.hash, block: r.block.toString() };
    save();
    log(`  ${"engine".padEnd(13)} ${engine}  (CREATE from the burner at nonce ${n})`);
  }
  got.engine = engine;
  codehashes.engine = journal.steps.engine.codehash;
  reproducible.engine = codehashes.engine === kecHex(A("src/Engine.sol", "Engine").deployed);

  /// Loads are idempotent against the chain: what is already there is
  /// counted, what is missing is sent. `dropLast` is never called (it would
  /// desynchronise the Engine's nonce from the shard sequence the record
  /// predicts). Each pointer comes from the receipt's own `Loaded` /
  /// `PanelLoaded` log (the second lag defence: the receipt is the only
  /// thing the node has already proved) and is journaled with the load; a
  /// shard a resumed run finds already on the chain takes its pointer from
  /// the journal, or, when the journal predates this field, from the
  /// chain's public arrays. The endpoint is held to each receipt's block
  /// before the next read (the third defence) — the first version of this
  /// script read the pointers back after the writes and waited for no
  /// block, which a reviewer measured against the header's claim.
  const pointers = { head: [], body: [], panels: [] };
  const pointerOf = (kind, i) => journal.loads.find((l) => l.kind === kind && l.i === i && l.pointer)?.pointer;
  const loadedPointer = (r, topic, i) => {
    const ev = logsBy(r.logs, engine, topic);
    if (ev.length !== 1) throw new Error(`load ${i}: expected one ${topic === LOADED_TOPIC ? "Loaded" : "PanelLoaded"} event from the Engine, saw ${ev.length}`);
    // Loaded(bool isHead, uint256 index, address pointer, uint256 size): the pointer is data word 2;
    // PanelLoaded(uint256 indexed index, address pointer, uint256 size, bytes32 hash): data word 0
    return low(decAddr(ev[0].data, topic === LOADED_TOPIC ? 2 : 0));
  };
  const frozen0 = decBool(await ad.read(engine, "frozen()"));
  /// a TEST hook beside `mispredict`: die right after a journaled load
  const crash = (step) => { if (opts.crashAfter === step) throw new Error(`test hook: crashed after ${step}`); };
  if (!frozen0) {
    const counts = await ad.read(engine, "shardCount()");
    const nh = Number(decUint(counts, 0)), nb = Number(decUint(counts, 1));
    /*  A resumed run finds shards already stored. Each is compared with
        the plan — by keccak, through the Engine's own shardHashes() —
        BEFORE anything more is sent. The first version of these loops
        skipped the stored prefix by count alone, so a dist/ rebuilt
        between the crash and the resume would have been loaded on top of
        the old shards and frozen; the manifest comparison would have
        failed afterwards, but by then the Engine — a plain CREATE at the
        burner's nonce 2, never redeployable — held a document no plan
        describes. A reviewer named it; this refuses it while the Engine
        can still take the right bytes.                                   */
    if (nh || nb) {
      const stored = decWords(await ad.read(engine, "shardHashes()")).map(low);
      const differs = (kind, want, at, i) => i >= want.length
        ? `${kind} shard ${i} is stored but the plan has only ${want.length} ${kind} shard(s)`
        : low(want[i].hash) === stored[at] ? null : `${kind} shard ${i} stored on the chain (${stored[at]}) is not the plan's (${low(want[i].hash)})`;
      const bad = [];
      for (let i = 0; i < nh; i++) { const d = differs("head", plan.head, i, i); if (d) bad.push(d); }
      for (let i = 0; i < nb; i++) { const d = differs("body", plan.body, nh + i, i); if (d) bad.push(d); }
      if (bad.length) {
        throw new Error(`the Engine at ${engine} already holds ${nh} head and ${nb} body shard(s) that are not this plan's — dist/ was rebuilt since this run began:\n    ${bad.join("\n    ")}\n  nothing more was sent and the Engine is not frozen; rebuild dist/ exactly as the interrupted run built it and resume, or start again with a fresh burner`);
      }
      log(`  engine: ${nh} head and ${nb} body shard(s) already stored match the plan (resumed)`);
    }
    for (let i = nh; i < plan.head.length; i++) {
      const r = took("loadHead", await ad.exec(engine, "loadHead(bytes)", [plan.head[i].data], { label: "loadHead" }));
      await awaitBlock(ad, r.block);
      journal.loads.push({ kind: "head", i, pointer: loadedPointer(r, LOADED_TOPIC, i), tx: r.hash, gas: r.gas.toString(), block: r.block.toString() }); save();
      crash(`loadHead:${i}`);
    }
    for (let i = nb; i < plan.body.length; i++) {
      const r = took("loadBody", await ad.exec(engine, "loadBody(bytes)", [plan.body[i].data], { label: "loadBody" }));
      await awaitBlock(ad, r.block);
      journal.loads.push({ kind: "body", i, pointer: loadedPointer(r, LOADED_TOPIC, i), tx: r.hash, gas: r.gas.toString(), block: r.block.toString() }); save();
      crash(`loadBody:${i}`);
    }
    for (let i = 0; i < plan.panels.length; i++) {
      const p = plan.panels[i];
      const have = await ad.read(engine, "panelHash(uint256)", [i]);
      if (low(have) === low(p.hash)) continue;
      const r = took("loadPanel", await ad.exec(engine, "loadPanel(uint256,bytes,bytes32)", [i, p.data, p.hash], { label: "loadPanel" }));
      await awaitBlock(ad, r.block);
      journal.loads.push({ kind: "panel", i, pointer: loadedPointer(r, PANEL_TOPIC, i), tx: r.hash, gas: r.gas.toString(), block: r.block.toString() }); save();
      crash(`loadPanel:${i}`);
    }
    if (low(await ad.read(engine, "engineHash()")) !== low(plan.engineHash)) {
      const r = took("setEngineHash", await ad.exec(engine, "setEngineHash(bytes32,uint32)", [plan.engineHash, plan.inflatedSize], { label: "setEngineHash" }));
      await awaitBlock(ad, r.block);
      journal.loads.push({ kind: "setEngineHash", tx: r.hash, gas: r.gas.toString(), block: r.block.toString() }); save();
    }
    const fr = took("freeze", await ad.exec(engine, "freeze()", [], { label: "freeze" }));
    await awaitBlock(ad, fr.block);
    journal.loads.push({ kind: "freeze", tx: fr.hash, gas: fr.gas.toString(), block: fr.block.toString() }); save();
    log(`  engine loaded: ${plan.head.length} head, ${plan.body.length} body, ${plan.panels.length} panels; frozen`);
  } else {
    log("  engine already frozen (resumed)");
  }
  // the pointers: from the receipts (via the journal) where this or a
  // resumed run sent the load, else from the chain's public arrays; every
  // one then asserted against CREATE(engine, 1 + k) in load order — head,
  // body, then panels — which is what the record and the recovery predict
  for (let i = 0; i < plan.head.length; i++) pointers.head.push(pointerOf("head", i) || low(decAddr(await ad.read(engine, "head(uint256)", [i]))));
  for (let i = 0; i < plan.body.length; i++) pointers.body.push(pointerOf("body", i) || low(decAddr(await ad.read(engine, "body(uint256)", [i]))));
  const shardBase = 1 + plan.head.length + plan.body.length;
  for (let i = 0; i < plan.panels.length; i++) pointers.panels.push(pointerOf("panel", i) || predictCreate(engine, shardBase + i));
  pointers.head.forEach((a, i) => { if (low(a) !== low(predictCreate(engine, 1 + i))) throw new Error(`head shard ${i} is not at CREATE(engine, ${1 + i})`); });
  pointers.body.forEach((a, i) => { if (low(a) !== low(predictCreate(engine, 1 + plan.head.length + i))) throw new Error(`body shard ${i} is not at CREATE(engine, ${1 + plan.head.length + i})`); });
  pointers.panels.forEach((a, i) => { if (low(a) !== low(predictCreate(engine, shardBase + i))) throw new Error(`panel ${plan.panels[i].name} is not at CREATE(engine, ${shardBase + i})`); });
  for (let i = 0; i < plan.panels.length; i++) {
    const c = await ad.codeAt(pointers.panels[i]);
    if (kecHex(c.slice(4)) !== low(plan.panels[i].gzipHash)) throw new Error(`panel ${plan.panels[i].name}'s pointer ${pointers.panels[i]} does not hold its gzip bytes`);
  }

  /*── 4–6. Crest, Reach impl, Grip impl ──*/
  await create3("crest", "src/Crest.sol", "Crest");
  await create3("reachImpl", "src/Reach.sol", "Reach");
  await create3("gripImpl", "src/Grip.sol", "Grip");

  /*── 7. the Catalog: three companions, then the façade (checks text/state code) ──*/
  const byLetter = [T.hub, T.pool, ZERO, T.parley, T.roster, T.postage, T.keys, T.kiln, T.launchpad, ZERO,
                    T.locks, T.steward, T.router, ZERO, engine, T.catalog,
                    T.market, T.roles, T.agentCard, ZERO, T.nameplate];                    // HPRYTSKNLCOWXEGQMDAUI
  await create3("catalogRows", "src/Catalog.sol", "CatalogRows", encodeParams("address[21]", [byLetter]));
  await create3("catalogRowsPost", "src/Catalog.sol", "CatalogRowsPost", encodeParams("address[21]", [byLetter]));
  await create3("catalogRowsV2", "src/Catalog.sol", "CatalogRowsV2",
    encodeParams("address[9]", [[T.keepsake, T.journal, T.bazaar, T.bridges, T.studio, ZERO, T.agora, venues?.seaport || ZERO, ZERO]]));   // VJBbZcFse
  await create3("catalogText", "src/Catalog.sol", "CatalogText", encodeParams("address,address,address", [got.catalogRows, got.catalogRowsPost, got.catalogRowsV2]),
    [code("catalogRows"), code("catalogRowsPost"), code("catalogRowsV2")]);
  await create3("catalogState", "src/Catalog.sol", "CatalogState", encodeParams("address", [got.catalogText]), [code("catalogText")]);
  await create3("catalog", "src/Catalog.sol", "Catalog", encodeParams(CATALOG_CONFIG_TYPE, [[
    T.hub, engine, T.router, T.roster, T.postage, T.keys, T.kiln, T.agentCard,
    got.reachImpl, got.gripImpl, T.pool, T.parley, T.launchpad, T.locks, T.steward, T.market, T.roles,
    got.timelock, T.premises, T.renderer, band.band, band.first, band.last, got.catalogText, got.catalogState, T.nameplate,
    T.keepsake, T.journal, T.bazaar, T.bridges, T.studio, T.agora, venues?.seaport || ZERO]]),
    [code("catalogText"), code("catalogState")]);

  /*── 8. Renderer ──*/
  await create3("renderer", "src/Renderer.sol", "Renderer",
    encodeParams("address,address,address,address,address", [T.hub, engine, got.crest, got.catalog, T.agentCard]));

  /*── 9. the hub, by the ship rule, under one salt either way ──*/
  const config = [got.reachImpl, got.gripImpl, band.band, band.first, band.last, T.steward, T.market, T.roles, T.pool, T.parley,
                  T.launchpad, T.locks, got.renderer, got.catalog, T.premises, got.timelock, T.keepsake, T.journal];
  const cfg = encodeParams(CONFIG_TYPE, [config]);
  let facets = null, cut = null;
  if (ship.build === "diamond") {
    facets = {};
    for (const [key, name] of [["coreFacet", "CoreFacet"], ["rightsFacet", "RightsFacet"], ["mintFacet", "MintFacet"], ["siteFacet", "SiteFacet"]]) {
      facets[name] = await create3(key, `src/hub/facets/${name}.sol`, name, cfg, [code("reachImpl"), code("gripImpl")]);
    }
    cut = hubCut(out, facets).cut;
    await create3("hub", "src/hub/IntactDiamond.sol", "IntactDiamond",
      encodeParams("(address,uint8,bytes4[])[],uint256", [cut.map((x) => [x.facetAddress, 0, x.functionSelectors]), price]),
      Object.values(facets).map((a) => ({ addr: a, what: "facet" })));
  } else {
    await create3("hub", "src/hub/Intact.sol", "Intact", encodeParams(CONFIG_TYPE + ",uint256", [config, price]),
      [code("reachImpl"), code("gripImpl")]);
  }

  /*── 10–18. the satellites ──*/
  await create3("keys", "src/KeyRegistry.sol", "KeyRegistry");
  await create3("roster", "src/Roster.sol", "Roster", encodeParams("address,address", [T.parley, got.hub]));
  await create3("postage", "src/Postage.sol", "Postage", encodeParams("address,address", [got.hub, T.parley]));
  await create3("parley", "src/Parley.sol", "Parley", encodeParams("address,address,address", [got.hub, got.keys, got.postage]));
  await create3("locks", "src/Locks.sol", "Locks", encodeParams("address", [got.hub]));
  await create3("pool", "src/Pool.sol", "Pool", encodeParams("address,address", [got.hub, T.launchpad]));

  // the Coin template check: the Kiln carries type(Coin).creationCode; the
  // compiled Coin must be the bytes it carries, and its keccak is recorded
  const coinCode = A("src/Coin.sol", "Coin").bytecode.slice(2);
  if (!A("src/Kiln.sol", "Kiln").deployed.includes(coinCode)) throw new Error("the compiled Coin creation code is not what Kiln.sol carries");
  const coinTemplate = { bytes: coinCode.length / 2, keccak: kecHex(coinCode) };

  await create3("kiln", "src/Kiln.sol", "Kiln", encodeParams("address,address,address", [got.hub, T.launchpad, venues?.poolManager || ZERO]));
  await create3("launchpad", "src/Launchpad.sol", "Launchpad", encodeParams("address,address,address,address,address", [got.hub, got.kiln, got.pool, got.locks, T.custodian]));

  /*── 19. Router, only where a probed venue table names a Uniswap venue; else pinned zero ──*/
  if (routed) {
    await create3("router", "src/Router.sol", "Router",
      encodeParams("address,address,address,address,address,bytes32",
        [got.hub, got.pool, venues.swapRouter02 || ZERO, venues.poolManager || ZERO, venues.weth || ZERO, venues.launchHookCodehash || "0x" + "00".repeat(32)]),
      [code("pool")]);
  } else {
    log(`  router        skipped — ${venues ? "the venue row names no Uniswap venue" : "no probed venue table for this chain"}; pinned as address(0)`);
  }

  /*── 20–21. Steward, Premises ──*/
  await create3("steward", "src/Steward.sol", "Steward", encodeParams("address", [got.hub]));
  await create3("premises", "src/Premises.sol", "Premises",
    encodeParams("address,address,address,address,address,address", [got.hub, got.renderer, engine, got.catalog, got.crest, T.agentCard]));

  /*── 22. V2, by the burner (--v2, W15): each at the placeholder the hub and
       the Catalog already pin, its constructor arguments the same function
       of the world `deploySatellite` uses through the Timelock, so the two
       paths cannot build different contracts. The art lands before the
       Keepsake that pins it; the Studio and Agora at each other's
       prediction. A row with no Seaport skips the Bazaar by name, as a
       chain with no Uniswap venue skips the Router.                      ──*/
  /// --v2 (W15): the burner lands V2 right after the Premises, as it lands the
  /// MVB's satellites; the Bazaar only where the row names Seaport. A journal
  /// that already holds a V2 step is a --v2 run being resumed, flag or not.
  const v2 = Boolean(opts.v2) || V2_ORDER.some((k) => journal.steps[k]);
  const v2Keys = v2 ? V2_ORDER.filter((k) => k !== "bazaar" || venues?.seaport) : [];
  if (v2) {
    const w2 = { ...P, ...got, ...venueTargets(venues) };
    for (const key of V2_ORDER) {
      if (!v2Keys.includes(key)) { log(`  ${key.padEnd(13)} skipped — the venue row names no Seaport; its placeholder stays codeless`); continue; }
      const sat = SATELLITES[key];
      await create3(key, sat.file, sat.name, sat.args({ ...w2, ...got }, { chainId, venues }), (sat.after || []).map((k) => code(k)));
    }
  }

  /*═══════════════════ post-conditions: refuse to publish on any miss ═══════════════════*/
  const world = { ...got, factory, ...Object.fromEntries(PLACEHOLDERS.map((k) => [k, P[k]])), ...venueTargets(venues) };
  if (!routed) world.router = ZERO;
  const fail = (m) => { throw new Error("refusing to publish: " + m); };

  // the order performed is the order declared (DESIGN §12)
  const performed = Object.keys(journal.steps);
  const declared = DEPLOY_ORDER.filter((k) => journal.steps[k]);
  if (JSON.stringify(performed) !== JSON.stringify(declared)) fail(`the steps were performed as [${performed}], DESIGN §12 declares [${declared}]`);
  for (const k of performed) if (!DEPLOY_ORDER.includes(k)) fail(`the journal holds a step DESIGN §12 does not name: ${k}`);

  // the factory's gate
  if (low(decAddr(await ad.read(factory, "DEPLOYER()"))) !== from) fail("the factory's DEPLOYER is not the burner");

  // every pin, both ways
  for (const [holder, getter, target] of PINS) {
    if (!got[holder]) continue;                                  // the Router may be absent
    const have = low(decAddr(await ad.read(got[holder], getter)));
    const want = low(world[target] ?? ZERO);
    if (have !== want) fail(`the ${holder}'s ${getter.replace("()", "")} is ${have}, ${target} was deployed at ${want} (a mis-predicted ${target.toUpperCase()})`);
  }
  for (const [holder, getter] of BAND_GETTERS) {
    const have = decUint(await ad.read(got[holder], getter));
    const want = getter === "BAND()" ? BigInt(band.band) : getter === "BAND_LO()" ? band.first : band.last;
    if (have !== want) fail(`the ${holder}'s ${getter} is ${have}, the band says ${want}`);
  }
  if (low(decAddr(await ad.read(got.hub, "REGISTRY()"))) !== low(REGISTRY)) fail("the hub's REGISTRY is not the canonical address");

  // the Catalog agrees with the hub
  const ag = await ad.read(got.catalog, "agrees()");
  if (!decBool(ag, 0)) fail(`Catalog.agrees() is false; the first disagreeing getter is 0x${ag.replace(/^0x/, "").slice(64, 72)}`);

  // the hub's form matches the ship rule
  let facetRecord = null;
  if (ship.build === "diamond") {
    const addrs = decAddrs(await ad.read(got.hub, "facetAddresses()")).map(low).sort();
    const wantF = Object.values(facets).map(low).sort();
    if (JSON.stringify(addrs) !== JSON.stringify(wantF)) fail("the diamond's facetAddresses() are not the four facets deployed");
    if (low(decAddr(await ad.read(got.hub, "facetAddress(bytes4)", ["0x1f931c1c"]))) !== ZERO) fail("the diamond routes diamondCut");
    const hubHash = await ad.read(got.hub, "intactConfigHash()");
    facetRecord = {};
    for (const [name, addr] of Object.entries(facets)) {
      if ((await ad.read(addr, "intactConfigHash()")) !== hubHash) fail(`${name}'s intactConfigHash differs from the hub's`);
      const sels = decBytes4s(await ad.read(got.hub, "facetFunctionSelectors(address)", [addr])).sort();
      const wantS = cut.find((x) => low(x.facetAddress) === low(addr)).functionSelectors.map(low).sort();
      if (JSON.stringify(sels) !== JSON.stringify(wantS)) fail(`${name}'s selectors on chain are not the derived cut`);
      const key = name[0].toLowerCase() + name.slice(1);
      facetRecord[name] = { address: low(addr), codehash: codehashes[key], selectors: wantS };
    }
    if (decUint(await ad.read(got.hub, "price()")) !== price) fail("the hub's price is not the initial price");
  } else {
    let loupe = false;
    try { await ad.read(got.hub, "facetAddresses()"); loupe = true; } catch { /* a monolith has no loupe */ }
    if (loupe) fail("the ship rule says monolith and the hub answers the loupe");
  }

  // the Engine
  if (!decBool(await ad.read(engine, "frozen()"))) fail("the Engine is not frozen");
  if (low(await ad.read(engine, "engineHash()")) !== low(manifest.engineHash)) fail("engineHash differs from dist/manifest.json");
  if (decUint(await ad.read(engine, "inflatedSize()")) !== BigInt(manifest.inflatedSize)) fail("inflatedSize differs from dist/manifest.json");
  const shardHashes = decWords(await ad.read(engine, "shardHashes()"));
  if (JSON.stringify(shardHashes.map(low)) !== JSON.stringify(manifest.shardHashes.map(low))) fail("shardHashes() differ from dist/manifest.json");
  /*  the lanes the plan loaded, in slot order (the Engine holds up to eight, W8): each slot's pin is
      the manifest's, and the Engine holds nothing past them (panelCount is the loaded prefix) */
  for (let i = 0; i < plan.panels.length; i++) {
    const name = plan.panels[i].name;
    if (low(await ad.read(engine, "panelHash(uint256)", [i])) !== low(manifest.panelHashes[name])) fail(`panel ${name}'s hash differs from the manifest`);
  }
  const lanes = decUint(await ad.read(engine, "panelCount()"));
  if (lanes !== BigInt(plan.panels.length)) fail(`the Engine holds ${lanes} lanes and the plan ${plan.panels.length}`);
  const curator = low(decAddr(await ad.read(engine, "curator()")));

  // /manifest over ERC-5219 names the same hashes
  const man = decResponse(await ad.call(got.premises, encRequest(["manifest"])));
  if (man.status !== 200) fail(`/manifest answered ${man.status}`);
  const manJson = JSON.parse(man.body);
  const catalogHash = low(await ad.read(got.catalog, "catalogHash()"));
  if (low(manJson.engineHash) !== low(manifest.engineHash)) fail("/manifest's engineHash differs");
  if (low(manJson.catalogHash) !== catalogHash) fail("/manifest's catalogHash differs from Catalog.catalogHash()");
  if (low(manJson.crestCodehash) !== codehashes.crest) fail("/manifest's crestCodehash differs from the Crest's code");

  // the Timelock
  const admin = low(decAddr(await ad.read(got.timelock, "admin()")));
  if (admin !== from) fail(`the Timelock's admin is ${admin}, the burner is ${from}`);

  /*═══════════════════ the record ═══════════════════*/
  /// gas from the JOURNAL, not this run: a resumed run spends nothing on
  /// the steps it skips and the record must still say what the band cost
  const gasOfAll = {};
  for (const [k, st] of Object.entries(journal.steps)) gasOfAll[k] = BigInt(st.gas || 0);
  for (const l of journal.loads) {
    const label = l.kind === "head" ? "loadHead" : l.kind === "body" ? "loadBody" : l.kind === "panel" ? "loadPanel" : l.kind;
    gasOfAll[label] = (gasOfAll[label] || 0n) + BigInt(l.gas || 0);
  }
  const gas = {};
  for (const [k, v] of Object.entries(gasOfAll)) gas[k] = v.toString();
  const gasTotal = Object.values(gasOfAll).reduce((a, b) => a + b, 0n);
  const gasThisRun = Object.values(gasOf).reduce((a, b) => a + b, 0n);
  const contracts = { factory, engine, ...Object.fromEntries([...SALTED, ...V2_ORDER].filter((k) => got[k]).map((k) => [k, got[k]])) };
  /// a V2 contract the burner landed in this run (--v2) carries the evidence a
  /// Timelock landing carries, less the queue: the transaction that made it,
  /// whose block holds the factory's Deployed event recover-record reads
  const v2Landed = Object.fromEntries(V2_ORDER.filter((k) => got[k]).map((k) => [k, {
    via: "burner", op: null, queued: null, eta: null,
    executed: { tx: journal.steps[k].tx, block: journal.steps[k].block, gas: journal.steps[k].gas, by: from } }]));
  /// what the chain says about the admin, not a sentence written in advance:
  /// the burner holds it at the MVB; the record of a later state (rotated
  /// through the queue, or renounced) reads the same field
  const disposition = admin === from ? "the burner holds the admin; rotation or renunciation only through the Timelock's own 7-day queue"
                    : admin === ZERO ? "renounced" : `rotated to ${admin} (through the queue; the burner no longer holds it)`;
  const burner = { nonceAfter: (await ad.nonceNow()).toString(), balanceAfter: (await ad.balanceOf(from)).toString() };
  const record = {
    schema: "intact.deployment/" + RECORD_SCHEMA,
    chainId, network: band.name,
    band: { band: band.band, lo: band.first.toString(), hi: band.last.toString(), rehearsal: band.rehearsal },
    deployer: from,
    factory, factoryVia: { create: { from, nonce: journal.factoryNonce ?? "0" } },
    salts: Object.fromEntries(Object.keys(salts).filter((k) => k !== "router" || routed).map((k) => [k, salts[k]])),
    contracts,
    codehashes: { factory: journal.steps.factory.codehash, ...codehashes },
    reproducible: { factory: journal.steps.factory.codehash === kecHex(A("src/lib/Create3Factory.sol", "Create3Factory").deployed), ...reproducible },
    placeholders: Object.fromEntries(PLACEHOLDERS.map((k) => [k, P[k]])),
    shipBuild: { build: ship.build, reason: ship.reason, intactBytes: ship.intactBytes, threshold: ship.threshold, limit: ship.limit, solc: ship.solc,
                 facets: facetRecord, cut: cut ? cut.map((x) => ({ facet: low(x.facetAddress), selectors: x.functionSelectors.map(low) })) : null },
    engine: {
      address: engine, via: journal.steps.engine.via, curator, frozen: true,
      engineHash: low(manifest.engineHash), inflatedSize: manifest.inflatedSize,
      shardHashes: shardHashes.map(low), panelHashes: manifest.panelHashes,
      head: pointers.head.map(low), body: pointers.body.map(low),
      panels: plan.panels.map(({ name, gzipHash }, i) => ({ name, address: low(pointers.panels[i]), hash: low(manifest.panelHashes[name]), gzipHash: low(gzipHash) })),
      storedBytes: plan.storedBytes, placeholder: Boolean(plan.placeholder)
    },
    catalogHash, coinTemplate,
    registry: { address: REGISTRY, codehash: registryHash },
    price: price.toString(),
    timelock: { admin, delay: "604800", grace: "1209600", disposition },
    burner,
    venues: venues || null,
    ...(Object.keys(v2Landed).length ? { satellites: v2Landed } : {}),
    gas, gasTotal: gasTotal.toString(), gasThisRun: gasThisRun.toString(),
    toolchain: toolchain(),
    confirmToken: CONFIRM[chainId] || null,
    journal: journalPath ? path.relative(ROOT, journalPath) : null,
    writtenAt: new Date().toISOString(),
    block: (await ad.blockNumber()).toString()
  };

  /*── recover-record, in-process, before anything is written ──*/
  const rr = await recover(ad, record, { out });
  if (rr.disagreements.length) {
    fail(`recover-record disagrees on ${rr.disagreements.length} field(s): ` +
         rr.disagreements.map((d) => `${d.field} (record ${d.want}, chain ${d.have})`).join("; "));
  }
  record.recovered = { checked: rr.checked, disagreeing: 0 };

  if (opts.recordPath !== null) {
    const rp = opts.recordPath || path.join(ROOT, "deployments", `${chainId}.json`);
    fs.mkdirSync(path.dirname(rp), { recursive: true });
    fs.writeFileSync(rp, JSON.stringify(record, null, 1) + "\n");
    record.path = path.relative(ROOT, rp);
  }
  return record;
}

/*═══════════════════ landing a post-MVB satellite ═══════════════════*/

/// The chain's clock, for the Timelock's eta.
async function chainTime(ad) {
  if (!ad.timestamp) throw new Error("the adapter cannot read the chain's clock");
  return BigInt(await ad.timestamp());
}

/// Land one satellite for a recorded deployment and return the record with
/// it added — or `{queued: true, eta, …}` when the Timelock's delay has not
/// run and the adapter cannot move the clock (a public chain: run the same
/// command again once `eta` has passed; anyone may). `rec` is the record
/// `deployIntact` wrote; `opts.recordPath` writes the updated one; the
/// updated record is recovered in-process before it is written, as the
/// MVB's was. Nothing here touches the MVB's journal: a satellite's
/// evidence is the Timelock's queue and the factory's `Deployed` event,
/// both public, and the record carries the transactions that made them.
export async function deploySatellite(ad, rec, key, opts = {}) {
  const log = opts.log || (() => {});
  const out = opts.out || compile({ quiet: true });
  const sat = SATELLITES[key];
  if (!sat) throw new Error(`${key} is not a post-MVB satellite; the satellites are ${SATELLITE_ORDER.join(", ")}`);
  if (Number(rec.chainId) !== ad.chainId) throw new Error(`the record is chain ${rec.chainId}, the node is chain ${ad.chainId}; refusing`);
  const why = admitsSatellite(key, rec); if (why) throw new Error(`${key}: ${why}; refusing`);
  if (!rec.factory || !rec.contracts?.timelock) throw new Error("the record names no factory or no Timelock; the MVB must land first");
  const factory = low(rec.factory);
  const timelock = low(rec.contracts.timelock);
  const salt = low(rec.salts?.[key] || saltOf(key));
  if (salt !== saltOf(key)) throw new Error(`the record's salt for ${key} is not keccak("${saltName(key)}"); refusing`);
  const want = predictCreate3(factory, salt);
  if (rec.placeholders?.[key] && low(rec.placeholders[key]) !== want) throw new Error(`the record's placeholder for ${key} is ${rec.placeholders[key]}, the salt predicts ${want}; refusing`);
  if (rec.contracts?.[key] && low(rec.contracts[key]) !== want) throw new Error(`the record's ${key} is ${rec.contracts[key]}, the salt predicts ${want}; refusing`);
  const onChain = low(decAddr(await ad.read(factory, "predict(bytes32)", [salt])));
  if (onChain !== want) throw new Error(`the factory predicts ${onChain} for ${key}, the arithmetic ${want} — a contradiction; refusing`);
  /// the record's world as recover-record builds it: contracts, placeholders, and the venue
  /// table's addresses as `venue*` targets (the custodian pins three of them)
  const world = { ...(rec.placeholders || {}), ...(rec.contracts || {}), ...venueTargets(rec.venues) };
  for (const p of sat.pins) if (!world[p]) throw new Error(`the record has no ${p}, which ${key}'s constructor pins; refusing`);
  /// every holder that pinned this satellite at the MVB pinned THIS address
  for (const row of PINS) {
    const [holder, getter, target] = row;
    if (target !== key || !rec.contracts?.[holder] || !pinApplies(row, rec)) continue;
    const have = low(decAddr(await ad.read(rec.contracts[holder], getter)));
    if (have !== want) throw new Error(`the ${holder}'s ${getter.replace("()", "")} is ${have}, the ${key} salt predicts ${want}; refusing`);
  }
  /// a venue's zone is landed against the venue as probed: over a wire the
  /// Seaport half of the record's row is re-proved first, by name (W15)
  if (sat.venue && !ad.inProcess) {
    const row = sat.venue(rec);
    const bad = row ? (await checkVenues(ad, row)).filter(([, ok]) => !ok) : [["the record's venue row", false, "names none"]];
    if (bad.length) throw new Error(`${key}: the venue it is constructed against does not hold on this chain — re-probe it:\n    ${bad.map(([s, , d]) => `${s}: ${d}`).join("\n    ")}`);
  }
  const art = artifact(out, sat.file, sat.name);
  const init = art.bytecode + sat.args(world, rec).replace(/^0x/, "");
  if ((init.length - 2) / 2 > 49_152) throw new Error(`${key}'s initcode is ${(init.length - 2) / 2} bytes, over EIP-3860's 49,152`);
  const data = enc("deploy(bytes32,bytes)", [salt, init]);
  const op = low(await ad.read(timelock, "opHash(address,uint256,bytes,bytes32)", [factory, 0, data, salt]));
  /// as deployIntact's receipts: 2^24 in total, or the execution share alone where the chain meters state gas
  const stateGas = ad.stateGas ? await ad.stateGas() : false;
  const capped = (label, r) => {
    if (!stateGas && BigInt(r.gas || 0n) > TX_GAS_CAP) throw new Error(`${label} used ${r.gas} gas, over the 2^24 transaction cap`);
    return r;
  };
  let landed = rec.satellites?.[key] ? { ...rec.satellites[key] } : null;
  let spent = 0n;                                   // gas this run sent, never a re-count of a recorded step
  if ((await ad.codeAt(want)) !== "0x") {
    /// code is already there: only the burner or the Timelock could have
    /// put it — a run this record does not know, or one it does. It is
    /// adopted only if every immutable it pins reads back as the record's.
    if (!landed) landed = { via: "unrecorded", op, queued: null, eta: null, executed: null };
    log(`  ${key.padEnd(13)} ${want}  already has code${rec.contracts?.[key] ? " (recorded)" : " — adopted if its pins read back"}`);
  } else {
    const admin = low(decAddr(await ad.read(timelock, "admin()")));
    let eta = decUint(await ad.read(timelock, "eta(bytes32)", [op]));
    if (eta === 0n) {
      if (ad.from !== admin) {
        throw new Error(`the Timelock's admin is ${admin} and this key is ${ad.from}: the admin must queue\n` +
                        `    Timelock(${timelock}).queue(${factory}, 0, deploy(${salt}, <${key} initcode, ${(init.length - 2) / 2} bytes>), ${salt})\n` +
                        `  (op ${op}); once the delay has passed, anyone runs this command again to land it`);
      }
      const q = capped(`queue ${key}`, await ad.exec(timelock, "queue(address,uint256,bytes,bytes32)", [factory, 0, data, salt], { label: `queue ${key}` }));
      await awaitBlock(ad, q.block);
      eta = decUint(await ad.read(timelock, "eta(bytes32)", [op]));
      if (eta === 0n) throw new Error(`the Timelock did not queue ${key} (eta is 0 after the receipt)`);
      landed = { via: "timelock", op, queued: { tx: q.hash, block: q.block.toString(), gas: q.gas.toString(), by: ad.from }, eta: eta.toString(), executed: null };
      spent += BigInt(q.gas || 0);
      log(`  ${key.padEnd(13)} queued on the Timelock (op ${op}); executable at ${eta}`);
    } else {
      landed = { ...(landed || { via: "timelock", queued: null }), op, eta: eta.toString(), executed: null };
      log(`  ${key.padEnd(13)} already queued (op ${op}); executable at ${eta}`);
    }
    const now = await chainTime(ad);
    if (now < eta) {
      if (!ad.warp) {
        /// a public chain: the queue transaction is recorded now, under
        /// `satellites.<key>` with no `executed`, so the run that lands it
        /// a week later carries both halves; the record stays recoverable
        /// (the salt is still a codeless placeholder until then)
        const pending = JSON.parse(JSON.stringify(rec, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
        delete pending.path;
        pending.satellites = { ...(pending.satellites || {}), [key]: landed };
        if (spent) { pending.gas = { ...pending.gas, [key]: (BigInt(pending.gas?.[key] || 0) + spent).toString() }; pending.gasTotal = (BigInt(pending.gasTotal || 0) + spent).toString(); }
        pending.writtenAt = new Date().toISOString();
        if (opts.recordPath) { fs.writeFileSync(opts.recordPath, JSON.stringify(pending, null, 1) + "\n"); pending.path = path.relative(ROOT, opts.recordPath); }
        return { queued: true, key, op, eta, address: want, record: pending, satellite: landed };
      }
      await ad.warp(eta + 1n);
      log(`  the clock moved to ${eta + 1n} (a rehearsal; a band waits the seven days)`);
    }
    const grace = decUint(await ad.read(timelock, "GRACE()"));
    if ((await chainTime(ad)) > eta + grace) throw new Error(`the queued ${key} expired (eta ${eta}, grace ${grace}); the admin must queue it again`);
    /// what it pins must be there before it lands (W15: the Keepsake's art); the queue may wait beside it
    for (const k of sat.after || []) {
      if ((await ad.codeAt(world[k])) === "0x") throw new Error(`${key} pins the ${k} at ${world[k]}, which has no code yet: land ${k} first (--satellite ${k}); ${key} stays queued`);
    }
    const ex = capped(`execute ${key}`, await ad.exec(timelock, "execute(address,uint256,bytes,bytes32)", [factory, 0, data, salt], { label: `execute ${key}` }));
    await awaitBlock(ad, ex.block);
    const ev = logsBy(ex.logs, factory, DEPLOYED_TOPIC).filter((l) => l.topics[1] === salt);
    if (ev.length !== 1) throw new Error(`${key}: expected one Deployed event from the factory, saw ${ev.length}`);
    const at = "0x" + ev[0].topics[2].slice(26);
    if (at !== want) throw new Error(`a prediction missed: ${key} predicted ${want}, landed ${at}`);
    landed.executed = { tx: ex.hash, block: ex.block.toString(), gas: ex.gas.toString(), by: ad.from };
    spent += BigInt(ex.gas || 0);
    log(`  ${key.padEnd(13)} ${want}  landed through the Timelock, ${(Number(ex.gas) / 1e6).toFixed(2)}M gas`);
  }
  /// read-back before anything is recorded: the satellite's own pins
  for (const [holder, getter, target] of PINS) {
    if (holder !== key) continue;
    const have = low(decAddr(await ad.read(want, getter)));
    if (have !== low(world[target] ?? ZERO)) throw new Error(`refusing to record: the ${key}'s ${getter.replace("()", "")} is ${have}, the record's ${target} is ${world[target]}`);
  }
  const code = await ad.codeAt(want);
  const next = JSON.parse(JSON.stringify(rec, (k, v) => (typeof v === "bigint" ? v.toString() : v)));
  delete next.path;
  next.contracts = { ...next.contracts, [key]: want };
  next.codehashes = { ...next.codehashes, [key]: kecHex(code) };
  next.reproducible = { ...next.reproducible, [key]: kecHex(code) === kecHex(art.deployed) };
  next.satellites = { ...(next.satellites || {}), [key]: landed };
  /// the gas this run spent is added once; a resumed or repeated run adds nothing for what it skipped
  if (spent) {
    next.gas = { ...next.gas, [key]: (BigInt(next.gas?.[key] || 0) + spent).toString() };
    next.gasTotal = (BigInt(next.gasTotal || 0) + spent).toString();
  }
  const admin = low(decAddr(await ad.read(timelock, "admin()")));
  next.timelock = { ...next.timelock, admin,
    disposition: admin === low(rec.deployer) ? "the burner holds the admin; rotation or renunciation only through the Timelock's own 7-day queue"
               : admin === ZERO ? "renounced" : `rotated to ${admin} (through the queue; the burner no longer holds it)` };
  if (ad.nonceOf) next.burner = { nonceAfter: (await ad.nonceOf(rec.deployer)).toString(), balanceAfter: (await ad.balanceOf(rec.deployer)).toString() };
  next.writtenAt = new Date().toISOString();
  next.block = (await ad.blockNumber()).toString();
  const rr = await recover(ad, next, { out });
  if (rr.disagreements.length) {
    throw new Error(`refusing to record ${key}: recover-record disagrees on ${rr.disagreements.length} field(s): ` +
                    rr.disagreements.map((d) => `${d.field} (record ${d.want}, chain ${d.have})`).join("; "));
  }
  next.recovered = { checked: rr.checked, disagreeing: 0 };
  if (opts.recordPath) {
    fs.mkdirSync(path.dirname(opts.recordPath), { recursive: true });
    fs.writeFileSync(opts.recordPath, JSON.stringify(next, null, 1) + "\n");
    next.path = path.relative(ROOT, opts.recordPath);
  }
  return next;
}

/*═══════════════════ the CLI ═══════════════════*/

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new Error(`unexpected argument ${a}`);
    const k = a.slice(2);
    if (k in o) throw new Error(`repeated option --${k}`);
    o[k] = argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? true : argv[++i];
  }
  return o;
}

export const CLI_OPTIONS = ["chain", "confirm", "rpc", "journal", "record", "price", "satellite"];
/// Switches, which take no value (W15): `--v2` makes a fresh deployment land
/// V2's contracts by the burner, right after the Premises (`deployIntact`'s
/// `v2`), instead of leaving them to the Timelock's queue.
export const CLI_FLAGS = ["v2"];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  for (const k of Object.keys(args)) {
    if (!CLI_OPTIONS.includes(k) && !CLI_FLAGS.includes(k)) { console.error(`unknown option --${k}; the options are ${[...CLI_OPTIONS, ...CLI_FLAGS].map((o) => "--" + o).join(" ")}`); process.exit(2); }
    if (CLI_FLAGS.includes(k) && args[k] !== true) { console.error(`--${k} is a switch and takes no value`); process.exit(2); }
  }
  if (args.v2 && args.satellite) { console.error("--v2 lands V2 by the burner in a fresh deployment; --satellite lands it through the Timelock for a recorded one — one or the other"); process.exit(2); }
  /*  The confirm token first, before reading a file, opening a socket or
      touching the key (MASTER's rule): a mistyped command costs nothing. */
  const chainId = Number(args.chain);
  if (!args.chain || !Number.isInteger(chainId)) { console.error("which chain? --chain <id>"); process.exit(2); }
  const want = CONFIRM[chainId];
  if (!want) { console.error(`chain ${chainId} has no confirm token; add it to CONFIRM in tools/deploy.mjs with its band`); process.exit(2); }
  if (args.confirm !== want) {
    console.error(`deployment to chain ${chainId} requires --confirm ${want}`);
    process.exit(2);
  }
  const band = bandOf(chainId);
  const local = chainId === 31337;
  const rpc = args.rpc || process.env.RPC_URL || (local ? "http://127.0.0.1:8545" : null);
  const { DEV_KEYS, RpcChain } = await import("./rpc.mjs");
  const key = process.env.PRIVATE_KEY || (local ? DEV_KEYS[0] : null);
  if (!rpc || !key) { console.error("RPC_URL and PRIVATE_KEY are required in the environment for any chain but 31337"); process.exit(2); }

  console.log(`\n  \x1b[1mINTACT · deploy\x1b[0m  chain ${chainId} (${band.name}${band.rehearsal ? ", rehearsal: the whole edition" : `, band ${band.band}: ids ${band.first}–${band.last}`})`);

  // dist/ — build if missing; refuse a placeholder anywhere but 31337
  if (!fs.existsSync(path.join(ROOT, "dist/shards.json"))) {
    console.log("  dist/ is missing — building");
    const { build } = await import("./build-app.mjs");
    await build();
  }
  const { plan, manifest } = readDist();
  if (plan.placeholder) {
    if (!local) { console.error("  dist/ is the PLACEHOLDER shell — refusing to deploy it to any chain but 31337"); process.exit(2); }
    console.log("  \x1b[33mdist/ holds the placeholder shell from tools/fixtures/ (31337 only)\x1b[0m");
  }

  console.log("  compiling");
  const out = compile({ quiet: true });
  const ship = shipRule(out);
  console.log(`  ship rule: ${ship.build} — ${ship.reason}`);

  const c = await RpcChain.open(rpc, key);
  if (c.chainId !== chainId) { console.error(`  the node at ${rpc} is chain ${c.chainId}, not ${chainId}`); process.exit(2); }
  const ad = adapt(c);
  const journalPath = args.journal ? path.resolve(ROOT, args.journal) : path.join(ROOT, "deployments", `${chainId}.journal.json`);
  const recordPath = args.record ? path.resolve(ROOT, args.record) : path.join(ROOT, "deployments", `${chainId}.json`);
  const resuming = fs.existsSync(journalPath);

  /*── --satellite <key[,key]|all>: land post-MVB satellites for the recorded deployment ──*/
  if (args.satellite) {
    if (!fs.existsSync(recordPath)) { console.error(`  no record at ${path.relative(ROOT, recordPath)}: the MVB must land first`); process.exit(2); }
    let rec = JSON.parse(fs.readFileSync(recordPath, "utf8"));
    const keys = args.satellite === "all"
      ? SATELLITE_ORDER.filter((k) => !admitsSatellite(k, rec))
      : String(args.satellite).split(",");
    for (const key of keys) {
      console.log(`\n  satellite ${key}`);
      let r;
      try { r = await deploySatellite(ad, rec, key, { out, recordPath, log: (s) => console.log(s) }); }
      catch (e) { console.error(`\n  \x1b[31m${e.message}\x1b[0m\n  the record was not changed`); process.exit(1); }
      if (r.queued) {
        console.log(`  queued; executable at ${r.eta} (${new Date(Number(r.eta) * 1000).toISOString()}) — run this command again then; anyone may`);
        process.exit(0);
      }
      rec = r;
      console.log(`  recover-record: ${rec.recovered.checked} fields checked, 0 disagreeing\n  wrote ${rec.path}`);
    }
    process.exit(0);
  }

  // preflight: the burner, its balance, and what the run needs
  const nonce = await c.nonceNow();
  const bal = await c.balanceOf(c.from.toString());
  console.log(`  deployer ${c.from} · nonce ${nonce} · balance ${(Number(bal) / 1e18).toFixed(4)} ETH`);
  if (!local && nonce !== 0n && !resuming) {
    console.error("  the key has been used (nonce > 0) and no journal names a run to resume: a used key is not a burner, " +
                  "and the factory would land at an address no other band shares"); process.exit(2);
  }
  if (!local) {
    const gasPrice = BigInt(await c.rpc("eth_gasPrice"));
    /*  DESIGN §12 budgets ≈ 85–100 M per band; 120 M with the 1.5× fee
        margin IPSEITY learned the hard way (its 90 M constant let a run
        pass preflight and die after 56 mined transactions). A rollup
        band adds the L1 data fee, asked of the OP-stack oracle when the
        predeploy has code; its absence is said, not assumed.          */
    /// with --v2 the burner lands V2's seven too: measured in-process at 127.46 M with them, 109.78 M without (W15)
    const deploymentGas = args.v2 ? 140_000_000n : 120_000_000n;
    const execution = (deploymentGas * gasPrice * 15n) / 10n;
    let l1 = 0n;
    const ORACLE = "0x420000000000000000000000000000000000000F";
    if ((await ad.codeAt(ORACLE)) !== "0x") {
      const sample = artifact(out, "src/Catalog.sol", "CatalogState").bytecode;      // the largest initcode
      const fee = BigInt(await c.call(ORACLE, enc("getL1Fee(bytes)", [sample])));
      l1 = fee * BigInt(SALTED.length + 12);
      console.log(`  preflight: L1 data fee ≈ ${(Number(l1) / 1e18).toFixed(5)} ETH (oracle at ${ORACLE})`);
    } else {
      console.log("  preflight: no GasPriceOracle predeploy on this chain — no L1 data term");
    }
    const need = execution + l1;
    console.log(`  preflight: ${(Number(need) / 1e18).toFixed(4)} ETH needed (${Number(deploymentGas / 1_000_000n)}M gas at ${gasPrice} wei ×1.5, plus L1 data)`);
    if (bal < need) { console.error(`  fund the deployer first: it holds ${(Number(bal) / 1e18).toFixed(4)} ETH`); process.exit(2); }
  }

  const t0 = Date.now();
  let record;
  try {
    record = await deployIntact(ad, { out, plan, manifest, journalPath, recordPath, price: args.price ? BigInt(args.price) : undefined,
                                      v2: Boolean(args.v2), log: (s) => console.log(s) });
  } catch (e) {
    console.error(`\n  \x1b[31m${e.message}\x1b[0m\n  nothing was published; the journal at ${path.relative(ROOT, journalPath)} holds what landed`);
    process.exit(1);
  }
  const gas = Object.entries(record.gas).sort((a, b) => Number(b[1]) - Number(a[1]));
  console.log("\n  gas by step");
  for (const [k, v] of gas) console.log(`    ${k.padEnd(14)} ${(Number(v) / 1e6).toFixed(2)}M`);
  console.log(`    ${"total".padEnd(14)} ${(Number(record.gasTotal) / 1e6).toFixed(2)}M  in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`\n  recover-record: ${record.recovered.checked} fields checked, 0 disagreeing`);
  console.log(`  wrote ${record.path}\n  door  web3://${record.contracts.premises}:${chainId}/\n`);
}
