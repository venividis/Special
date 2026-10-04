#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the hub, deployed the way it ships, for the verifiers

  Every tools/verify-*.mjs that needs a hub gets the real one from here:
  the four facets and the immutable diamond (the build the ship rule
  chose — the monolith measures over EIP-170 and the harness, like a
  chain, refuses it), wired by one IntactConfig, behind the REAL ERC-6551
  registry runtime etched at its canonical address so the hub's
  constructor check against AccountBinding.REGISTRY_HASH is met honestly
  and every Reach and Grip the hub makes is the canonical forwarder.

  The cut comes from tools/facets.mjs `hubCut` — derived from the compiled
  ABIs, never written — so a verifier can only deploy a diamond that
  routes every function of the token exactly once.

    import { deployHub, etchRegistry } from "./hub.mjs";
    await etchRegistry(c);
    const { hub, facets, cut } = await deployHub(c, out, { reachImpl, gripImpl, steward, timelock }, { price: 0n });

  Fields of the config not named default to address(0) — the hub admits an
  unpinned satellite (its guarded reads answer "no answer") — except the
  two implementations, which must exist before the hub does.
───────────────────────────────────────────────────────────────────────────*/
import { createAddressFromString, hexToBytes } from "@ethereumjs/util";
import { hubCut, findArtifact } from "./facets.mjs";
import { encodeParams } from "./evm.mjs";

export const REGISTRY = "0x000000006551c19487814612e58FE06813775758";
/// The canonical registry's 571-byte runtime (Pixel-Garden
/// test/fixtures/erc6551-registry.json; the same bytes test/helpers/Deploy.sol etches).
export const REGISTRY_RUNTIME = "0x608060405234801561001057600080fd5b50600436106100365760003560e01c8063246a00211461003b5780638a54c52f1461006a575b600080fd5b61004e6100493660046101b7565b61007d565b6040516001600160a01b03909116815260200160405180910390f35b61004e6100783660046101b7565b6100e1565b600060806024608c376e5af43d82803e903d91602b57fd5bf3606c5285605d52733d60ad80600a3d3981f3363d3d373d3d3d363d7360495260ff60005360b76055206035523060601b60015284601552605560002060601b60601c60005260206000f35b600060806024608c376e5af43d82803e903d91602b57fd5bf3606c5285605d52733d60ad80600a3d3981f3363d3d373d3d3d363d7360495260ff60005360b76055206035523060601b600152846015526055600020803b61018b578560b760556000f580610157576320188a596000526004601cfd5b80606c52508284887f79f19b3655ee38b1ce526556b7731a20c8f218fbda4a3990b6cc4172fdf887226060606ca46020606cf35b8060601b60601c60005260206000f35b80356001600160a01b03811681146101b257600080fd5b919050565b600080600080600060a086880312156101cf57600080fd5b6101d88661019b565b945060208601359350604086013592506101f46060870161019b565b94979396509194608001359291505056fea2646970667358221220ea2fe53af507453c64dd7c1db05549fa47a298dfb825d6d11e1689856135f16764736f6c63430008110033";
export const ZERO = "0x" + "00".repeat(20);
export const CONFIG_TYPE =
  "(address,address,uint8,uint256,uint256,address,address,address,address,address,address,address,address,address,address,address)";
export const CONFIG_FIELDS = [
  "reachImpl", "gripImpl", "band", "bandLo", "bandHi", "steward", "market", "roles", "pool",
  "parley", "launchpad", "locks", "renderer", "catalog", "premises", "timelock"
];
export const FACETS = ["CoreFacet", "RightsFacet", "MintFacet", "SiteFacet"];

export async function etchRegistry(c) {
  await c.vm.stateManager.putCode(createAddressFromString(REGISTRY), hexToBytes(REGISTRY_RUNTIME));
}

/// IntactConfig in field order, from a sparse object.
export function configOf(o) {
  if (!o.reachImpl || !o.gripImpl) throw new Error("configOf: reachImpl and gripImpl are required");
  const defaults = { band: 1, bandLo: 1n, bandHi: 4096n };
  return CONFIG_FIELDS.map((f) => o[f] ?? defaults[f] ?? ZERO);
}

export function creationCode(out, name) {
  const a = findArtifact(out, name);
  if (!a) throw new Error(`no artifact ${name} — compile with dirs ["src", ...]`);
  return "0x" + a.evm.bytecode.object;
}

export function runtimeSize(out, name) {
  return findArtifact(out, name).evm.deployedBytecode.object.length / 2;
}

/// Deploy the four facets with one config, derive the cut, deploy the diamond.
export async function deployHub(c, out, cfg, { price = 0n, label = "IntactDiamond" } = {}) {
  const args = encodeParams(CONFIG_TYPE, [configOf(cfg)]);
  const facets = {};
  for (const name of FACETS) facets[name] = await c.deploy(creationCode(out, name), args, name);
  const { cut } = hubCut(out, facets);
  const hub = await c.deploy(
    creationCode(out, "IntactDiamond"),
    encodeParams("(address,uint8,bytes4[])[],uint256",
      [cut.map((x) => [x.facetAddress, x.action, x.functionSelectors]), price]),
    label
  );
  return { hub, facets, cut };
}

/*──────────────── predicting a CREATE address ────────────────*/
import { keccak256 } from "ethereum-cryptography/keccak.js";

/// keccak256(rlp([deployer, nonce]))[12:] for every nonce under 2^24 — the
/// same arithmetic test/helpers/Deploy.sol uses, so a verifier can pin a
/// satellite into the hub's config before the satellite exists and assert
/// the prediction after.
export function predictCreate(deployerHex, nonce) {
  const addr = deployerHex.replace(/^0x/, "").toLowerCase();
  const n = BigInt(nonce);
  let rlp;
  if (n === 0n) rlp = "d694" + addr + "80";
  else if (n <= 0x7fn) rlp = "d694" + addr + n.toString(16).padStart(2, "0");
  else if (n <= 0xffn) rlp = "d794" + addr + "81" + n.toString(16).padStart(2, "0");
  else if (n <= 0xffffn) rlp = "d894" + addr + "82" + n.toString(16).padStart(4, "0");
  else rlp = "d994" + addr + "83" + n.toString(16).padStart(6, "0");
  return "0x" + Buffer.from(keccak256(Buffer.from(rlp, "hex"))).toString("hex").slice(24);
}

/// The address the chain's deployer will land its k-th next creation at
/// (k = 0 is the very next one).
export async function predictNext(c, k = 0) {
  return predictCreate(c.from.toString(), (await c.nonceNow()) + BigInt(k));
}
