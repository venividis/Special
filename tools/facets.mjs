#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · deriving the diamond's cut from the ABI it must present

  Origin: ANIMA sdk/src/index.ts `deriveFacetCut` / `cutIsImmutable`
  (lines 637-765), ported to plain JS over the solc output in out/solc.json
  so the test deploy, tools/deploy.mjs and CI all route from one function.

  Hand-written selector lists are the standing hazard of an immutable
  diamond: the cut is welded shut in the constructor, and only later does
  someone notice a function nobody routed. So the cut is computed instead —
  the monolith `Intact`'s ABI is the specification, and the facets must
  partition it.

  Facets that inherit a shared base (IntactBase) all carry the shared
  surface in their ABI, so every shared selector appears more than once and
  the split has to be decided rather than read off. The rule: `specialised`
  facets claim the selectors they add over `base`, and `base` serves the
  whole remainder of the token ABI. `additional` facets contribute
  functions the token itself does not declare (none in INTACT: the loupe is
  folded into IntactDiamond).

  It throws rather than returning a partial cut on any of: a token function
  no facet can serve, a facet claiming a function the token does not
  declare, or two facets claiming one selector. Each of those, silently
  accepted, is a permanently wrong diamond. It also refuses a cut that
  routes `diamondCut`, and scans every facet's deployed bytecode for the
  selector's four bytes, since a facet could hold one under another name.

    node tools/facets.mjs               derive and print the hub's cut
    node tools/facets.mjs --json        the cut as JSON, for a deploy script
    node tools/facets.mjs --selftest    the three refusals, on a fixture ABI
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256 } from "ethereum-cryptography/keccak.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/// `keccak256("diamondCut((address,uint8,bytes4[])[],address,bytes)")[0..4]`.
/// If a diamond routes this selector, it is mutable — whatever else its
/// documentation says.
export const DIAMOND_CUT_SELECTOR = "0x1f931c1c";
/// ERC-165 id for IDiamondLoupe.
export const DIAMOND_LOUPE_INTERFACE_ID = "0x48e2b093";

/// The hub's facet layout (DESIGN.md §4.1): the base serves the remainder.
export const HUB = {
  token: "Intact",
  base: "CoreFacet",
  specialised: ["RightsFacet", "MintFacet", "SiteFacet"],
  additional: []
};

/*──────────────── signatures from an ABI entry ────────────────*/
function typeOf(input) {
  if (input.type.startsWith("tuple")) {
    return "(" + input.components.map(typeOf).join(",") + ")" + input.type.slice(5);
  }
  return input.type;
}

export function signatureOf(entry) {
  return entry.name + "(" + (entry.inputs || []).map(typeOf).join(",") + ")";
}

export function selectorOf(sig) {
  return "0x" + Buffer.from(keccak256(Buffer.from(sig, "utf8"))).toString("hex").slice(0, 8);
}

export function selectorsOf(abi) {
  return abi.filter((e) => e.type === "function").map((e) => selectorOf(signatureOf(e)));
}

/// Selector → signature, for a readable routing table.
export function namesOf(abi) {
  const m = new Map();
  for (const e of abi) if (e.type === "function") m.set(selectorOf(signatureOf(e)), signatureOf(e));
  return m;
}

/*──────────────── the cut ────────────────*/
/**
 * @param {{tokenAbi, base:{name,address,abi}, specialised:[...], additional?:[...]}} options
 * @returns {{facetAddress, action:0, functionSelectors}[]}
 */
export function deriveFacetCut({ tokenAbi, base, specialised, additional = [] }) {
  const baseSelectors = new Set(selectorsOf(base.abi));
  const token = selectorsOf(tokenAbi);
  const tokenSet = new Set(token);

  const claimedBy = new Map();
  const cuts = [];

  for (const facet of specialised) {
    const claims = selectorsOf(facet.abi).filter((s) => !baseSelectors.has(s));
    for (const selector of claims) {
      const other = claimedBy.get(selector);
      if (other) throw new Error(`${selector} is claimed by both ${other} and ${facet.name}`);
      if (!tokenSet.has(selector)) {
        throw new Error(`${facet.name} routes ${selector}, which the token ABI does not declare`);
      }
      claimedBy.set(selector, facet.name);
    }
    if (claims.length === 0) throw new Error(`${facet.name} adds nothing over ${base.name}`);
    cuts.push({ facetAddress: facet.address, action: 0, functionSelectors: claims });
  }

  const remainder = token.filter((s) => !claimedBy.has(s));
  const unservable = remainder.filter((s) => !baseSelectors.has(s));
  if (unservable.length) {
    throw new Error(`${base.name} cannot serve ${unservable.join(", ")} — the diamond would be incomplete`);
  }
  cuts.unshift({ facetAddress: base.address, action: 0, functionSelectors: remainder });

  for (const facet of additional) {
    const claims = selectorsOf(facet.abi);
    for (const selector of claims) {
      if (tokenSet.has(selector) || claimedBy.has(selector)) {
        throw new Error(`${facet.name} collides with the token ABI at ${selector}`);
      }
      claimedBy.set(selector, facet.name);
    }
    cuts.push({ facetAddress: facet.address, action: 0, functionSelectors: claims });
  }

  if (!cutIsImmutable(cuts)) throw new Error(`the cut routes diamondCut ${DIAMOND_CUT_SELECTOR} — this diamond would be mutable`);
  return cuts;
}

/// True when `cut` routes no `diamondCut`. Necessary for immutability and
/// not sufficient — also check each facet's bytecode (`bytecodeIsCutFree`).
export function cutIsImmutable(cut) {
  return !cut.some((entry) => entry.functionSelectors.includes(DIAMOND_CUT_SELECTOR));
}

/// A facet's deployed bytecode must not contain the four bytes of the
/// diamondCut selector anywhere: a dispatcher that compares against it, or
/// a constant that would let one be built, is a mutability path.
export function bytecodeIsCutFree(deployedHex) {
  return !deployedHex.replace(/^0x/, "").toLowerCase().includes(DIAMOND_CUT_SELECTOR.slice(2));
}

/*──────────────── the hub, from out/solc.json ────────────────*/
export function loadSolc() {
  const p = path.join(ROOT, "out/solc.json");
  if (!fs.existsSync(p)) throw new Error("out/solc.json missing — run node tools/compile.mjs first");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function findArtifact(out, name) {
  for (const [file, cs] of Object.entries(out.contracts || {})) {
    if (cs[name]) return { file, name, ...cs[name] };
  }
  return null;
}

/// The hub's cut with placeholder addresses (a deployer substitutes real
/// ones in the same order), plus every per-facet check that needs no chain.
export function hubCut(out, addresses = {}) {
  const A = (n) => {
    const a = findArtifact(out, n);
    if (!a) throw new Error(`no artifact ${n} — is src/hub/ built?`);
    return a;
  };
  const token = A(HUB.token);
  const base = A(HUB.base);
  const specialised = HUB.specialised.map(A);
  const additional = HUB.additional.map(A);
  const src = (a) => ({ name: a.name, address: addresses[a.name] || "0x" + "00".repeat(20), abi: a.abi });

  for (const f of [base, ...specialised, ...additional]) {
    if (!bytecodeIsCutFree(f.evm.deployedBytecode.object)) {
      throw new Error(`${f.name}'s bytecode contains the diamondCut selector`);
    }
    if (f !== token && !f.abi.some((e) => e.type === "function" && e.name === "intactConfigHash")) {
      throw new Error(`${f.name} has no intactConfigHash() — the diamond's constructor could not check it`);
    }
  }
  const cut = deriveFacetCut({
    tokenAbi: token.abi, base: src(base), specialised: specialised.map(src), additional: additional.map(src)
  });
  return { cut, names: namesOf(token.abi), facets: [base, ...specialised, ...additional].map((f) => f.name) };
}

/*──────────────── the self-test ────────────────*/
const fn = (name, inputs = []) => ({ type: "function", name, inputs: inputs.map((t) => ({ type: t })), outputs: [], stateMutability: "nonpayable" });

export function selftest() {
  const results = [];
  const check = (label, f, expectThrow) => {
    let threw = null;
    try { f(); } catch (e) { threw = e.message; }
    const ok = expectThrow ? (threw !== null && threw.includes(expectThrow)) : threw === null;
    results.push({ label, ok, detail: threw });
  };
  const shared = [fn("supportsInterface", ["bytes4"]), fn("ownerOf", ["uint256"])];
  const tokenAbi = [...shared, fn("mint", ["address"]), fn("rightsOf", ["uint256", "address"]), fn("tokenURI", ["uint256"])];
  const base = { name: "Core", address: "0x" + "01".repeat(20), abi: [...shared] };
  const mintF = { name: "Mint", address: "0x" + "02".repeat(20), abi: [...shared, fn("mint", ["address"])] };
  const rightsF = { name: "Rights", address: "0x" + "03".repeat(20), abi: [...shared, fn("rightsOf", ["uint256", "address"])] };
  const siteF = { name: "Site", address: "0x" + "04".repeat(20), abi: [...shared, fn("tokenURI", ["uint256"])] };

  check("partitions a complete ABI, every function routed once", () => {
    const cut = deriveFacetCut({ tokenAbi, base, specialised: [mintF, rightsF, siteF] });
    const all = cut.flatMap((c) => c.functionSelectors);
    if (new Set(all).size !== all.length) throw new Error("a selector was routed twice");
    if (all.length !== tokenAbi.length) throw new Error("routed " + all.length + " of " + tokenAbi.length);
    if (cut[0].facetAddress !== base.address || cut[0].functionSelectors.length !== 2) throw new Error("base serves the shared pair");
  }, null);

  check("refuses an unrouted selector", () => {
    deriveFacetCut({ tokenAbi, base, specialised: [mintF, rightsF] });   // nobody serves tokenURI
  }, "cannot serve");

  check("refuses a duplicate", () => {
    const dup = { name: "Dup", address: "0x" + "05".repeat(20), abi: [...shared, fn("mint", ["address"])] };
    deriveFacetCut({ tokenAbi, base, specialised: [mintF, dup, rightsF, siteF] });
  }, "claimed by both");

  check("refuses an extra", () => {
    const extra = { name: "Extra", address: "0x" + "06".repeat(20), abi: [...shared, fn("tokenURI", ["uint256"]), fn("selfDestructEverything")] };
    deriveFacetCut({ tokenAbi, base, specialised: [mintF, rightsF, extra] });
  }, "does not declare");

  check("refuses a facet that adds nothing", () => {
    const idle = { name: "Idle", address: "0x" + "07".repeat(20), abi: [...shared] };
    deriveFacetCut({ tokenAbi, base, specialised: [mintF, rightsF, siteF, idle] });
  }, "adds nothing");

  check("refuses a cut that routes diamondCut", () => {
    const cutter = fn("diamondCut", ["(address,uint8,bytes4[])[]", "address", "bytes"]);
    if (selectorOf(signatureOf(cutter)) !== DIAMOND_CUT_SELECTOR) throw new Error("selector derivation drifted");
    deriveFacetCut({ tokenAbi: [...tokenAbi, cutter], base, specialised: [mintF, rightsF, siteF, { name: "Cutter", address: "0x" + "08".repeat(20), abi: [...shared, cutter] }] });
  }, "mutable");

  check("sees the selector in bytecode even when no ABI names it", () => {
    if (bytecodeIsCutFree("0x6080604052" + "1f931c1c" + "00")) throw new Error("missed it");
    if (!bytecodeIsCutFree("0x6080604052deadbeef")) throw new Error("false positive");
  }, null);

  check("tuple signatures hash as the compiler hashes them", () => {
    const e = { type: "function", name: "swap", inputs: [{ type: "tuple", components: [{ type: "address" }, { type: "uint256" }] }] };
    if (signatureOf(e) !== "swap((address,uint256))") throw new Error(signatureOf(e));
    const arr = { type: "function", name: "cut", inputs: [{ type: "tuple[]", components: [{ type: "address" }, { type: "uint8" }, { type: "bytes4[]" }] }, { type: "address" }, { type: "bytes" }] };
    if (signatureOf(arr) !== "cut((address,uint8,bytes4[])[],address,bytes)") throw new Error(signatureOf(arr));
  }, null);

  return results;
}

/*──────────────── CLI ────────────────*/
if (import.meta.url === `file://${process.argv[1]}`) {
  const JSON_OUT = process.argv.includes("--json");
  if (process.argv.includes("--selftest")) {
    const r = selftest();
    for (const x of r) console.log(`  ${x.ok ? "\x1b[32m✓" : "\x1b[31m✗"}\x1b[0m ${x.label}${x.ok ? "" : "  — " + x.detail}`);
    const bad = r.filter((x) => !x.ok).length;
    console.log(bad ? `\n  \x1b[31m${bad} self-test(s) failed\x1b[0m\n` : `\n  \x1b[32mfacets.mjs self-test: ${r.length} passed\x1b[0m\n`);
    process.exit(bad ? 1 : 0);
  }
  const out = loadSolc();
  if (!findArtifact(out, HUB.token)) {
    console.log(`\n  \x1b[2mno ${HUB.token} artifact in out/solc.json yet — nothing to route (wave 1 adds src/hub/)\x1b[0m\n`);
    process.exit(0);
  }
  try {
    const { cut, names, facets } = hubCut(out);
    if (JSON_OUT) { console.log(JSON.stringify({ facets, cut }, null, 2)); process.exit(0); }
    console.log(`\n  \x1b[1mINTACT · the diamond's cut, derived from ${HUB.token}'s ABI\x1b[0m\n`);
    cut.forEach((c, i) => {
      console.log(`  ${facets[i]}  \x1b[2m${c.functionSelectors.length} selectors\x1b[0m`);
      for (const s of c.functionSelectors) console.log(`      ${s}  \x1b[2m${names.get(s) || "?"}\x1b[0m`);
    });
    const total = cut.reduce((n, c) => n + c.functionSelectors.length, 0);
    console.log(`\n  \x1b[32m${total} selectors routed once each; no diamondCut anywhere\x1b[0m\n`);
  } catch (e) {
    console.error(`\n  \x1b[31m${e.message}\x1b[0m\n`);
    process.exit(1);
  }
}
