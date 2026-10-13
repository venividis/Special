#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · a name, from `web3://intact.eth/…` to the bytes the site serves

  The helpers a verifier and an operator need around the Nameplate
  (src/Nameplate.sol, DESIGN.md §3 row 30, band 0):

    · the ENS arithmetic — `namehash`, `labelhash`, DNS wire encoding for
      ENSIP-10 `resolve(bytes,bytes)` — written out rather than imported,
      so what a test hashes is what a reader can check by hand;
    · the ERC-6821 record: `encodeContenthash` (ANIMA cli/anima.mjs, the
      ipfs-ns varint and a CID, kept so an operator can still publish a
      contenthash on some other name) and `decodeContentcontract`, which
      reads `eth:0x…` in ERC-3770 form and refuses the CAIP `eip155:1:0x…`
      form a gateway could not parse;
    · the walk a web3:// client makes, as one function: find the resolver
      through the registry (walking up to the apex, as ENSIP-10 says),
      ask it for `contentcontract`, check the chain prefix against the
      chain the reader is on, and call `Premises.request(segments)` —
      `openWeb3Url` returns the status, body and headers the site gave;
    · `custodyReport`, every read behind the Nameplate's answer laid out
      — registry owner, wrapper owner, registrar expiry, resolver record,
      the holding token and its accounts — and `assertEnsCustody`, which
      throws the findings when the name is not bound. Reads only.

  Every function that touches a chain takes `read(to, calldata) → hex`:
  the in-process `Chain.call` in a verifier, `RpcChain.call` over a wire.
  The command line reads RPC_URL from the environment and nowhere else,
  and nothing here writes an endpoint into any file.

    node tools/ens-name.mjs web3://intact.eth/token/3073/live
    node tools/ens-name.mjs --custody intact.eth --nameplate 0x…
    node tools/ens-name.mjs --hash 3073.intact.eth
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { enc, decAddr, decString, decUint } from "./evm.mjs";

/*═══════════════════ the ENS singletons ═══════════════════*/

/// The registry, at the same address on every chain ENS deploys to.
export const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
/// The .eth BaseRegistrar (mainnet and Sepolia).
export const ETH_REGISTRAR = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
/// The NameWrapper is a different contract per chain. Sepolia's own is the
/// one-line fix of IPSEITY PR #26 that its base never merged: deployed with
/// mainnet's address, custody-is-binding was silently dead on the rehearsal
/// chain, so the rehearsal could not validate the mainnet path.
export const NAME_WRAPPER = {
  1: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
  11155111: "0x0635513f179D50A207757E05759CbD106d7dFcE8"
};
/// ERC-3770 short names, from ethereum-lists/chains, for the chains a
/// .eth name can live on.
export const SHORT_NAME = { 1: "eth", 11155111: "sep" };
export const CHAIN_OF_SHORT = Object.fromEntries(Object.entries(SHORT_NAME).map(([c, s]) => [s, Number(c)]));

export const ZERO = "0x" + "00".repeat(20);
export const ETH_NODE = "0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae";

/// The resolver interface ids a client checks with ERC-165.
export const IFACE = {
  erc165: "0x01ffc9a7",
  addr: "0x3b3b57de",            // addr(bytes32)
  addrMulti: "0xf1cb7e06",       // addr(bytes32,uint256)
  contenthash: "0xbc1c58d1",     // contenthash(bytes32)
  text: "0x59d1d43c",            // text(bytes32,string)
  wildcard: "0x9061b923"         // resolve(bytes,bytes), ENSIP-10
};

/*═══════════════════ the arithmetic ═══════════════════*/

const hexOf = (u8) => "0x" + Buffer.from(u8).toString("hex");
const keccakHex = (bytes) => hexOf(keccak256(bytes));

/// Lower-case ASCII only. ENS names are ENSIP-15 normalised before they
/// are hashed, and a hash of an un-normalised name is a different name;
/// anything outside ASCII is refused here rather than hashed wrong.
export function normalize(name) {
  const s = String(name).trim();
  if (s === "") return "";
  if (/[^\x21-\x7e]/.test(s)) throw new Error("normalise the name with an ENSIP-15 library first: it is not plain ASCII");
  const lower = s.toLowerCase();
  if (lower.split(".").some((l) => l === "")) throw new Error("a name has no empty label: " + s);
  return lower;
}

export const labels = (name) => (normalize(name) === "" ? [] : normalize(name).split("."));

export function labelhash(label) {
  if (String(label).includes(".")) throw new Error("a label has no dot: " + label);
  return keccakHex(Buffer.from(normalize(label), "utf8"));
}

/// namehash("") = 0; namehash(name) = keccak(namehash(rest) ‖ keccak(label)).
export function namehash(name) {
  let node = "0x" + "00".repeat(32);
  for (const l of labels(name).reverse()) {
    node = keccakHex(Buffer.concat([Buffer.from(node.slice(2), "hex"), Buffer.from(labelhash(l).slice(2), "hex")]));
  }
  return node;
}

/// DNS wire format: a length byte and the label's bytes per label, then a
/// zero — what ENSIP-10 `resolve` takes, so the contract does the hashing.
export function dnsEncode(name) {
  const parts = labels(name).map((l) => {
    const b = Buffer.from(l, "utf8");
    if (b.length > 63) throw new Error("a DNS label is at most 63 bytes: " + l);
    return Buffer.concat([Buffer.from([b.length]), b]);
  });
  return hexOf(Buffer.concat([...parts, Buffer.from([0])]));
}

/*═══════════════════ ERC-6821 / ERC-3770 ═══════════════════*/

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(s) {
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("not base58: " + ch);
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const body = Buffer.from(hex, "hex");
  let zeros = 0;
  for (const ch of s) { if (ch === "1") zeros++; else break; }
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

const B32 = "abcdefghijklmnopqrstuvwxyz234567";
function base32Decode(s) {
  let bits = 0, acc = 0;
  const out = [];
  for (const ch of s.toLowerCase()) {
    if (ch === "=") break;
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error("not base32: " + ch);
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); acc &= (1 << bits) - 1; }
  }
  return Buffer.from(out);
}
export function base32Encode(buf) {
  let bits = 0, acc = 0, out = "";
  for (const byte of buf) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; out += B32[(acc >> bits) & 31]; }
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

/// ENS contenthash: varint(ipfs-ns = 0xe3) then the CID bytes. Takes a
/// CIDv1 base32 `ipfs://b…` (ANIMA's form), a CIDv0 `ipfs://Qm…` (lifted to
/// v1: version 1, dag-pb 0x70, then the multihash), or a pre-encoded 0x.
/// The Nameplate itself serves no contenthash — this site is the chain —
/// but an operator may want one on some other name.
export function encodeContenthash(uri) {
  if (uri.startsWith("0x")) {
    if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(uri)) throw new Error("a pre-encoded contenthash is non-empty, even-length hex");
    return uri.toLowerCase();
  }
  if (!uri.startsWith("ipfs://")) throw new Error("use an ipfs:// CID or a pre-encoded 0x contenthash");
  const cid = uri.slice(7).split("/")[0];
  let bytes;
  if (cid.startsWith("Qm")) {
    bytes = base58Decode(cid);
    if (bytes.length !== 34 || bytes[0] !== 0x12 || bytes[1] !== 0x20) throw new Error("not a CIDv0 sha2-256 multihash");
    bytes = Buffer.concat([Buffer.from([0x01, 0x70]), bytes]);
  } else if (cid.startsWith("b")) {
    bytes = base32Decode(cid.slice(1));
    if (bytes.length < 4 || bytes[0] !== 1) throw new Error("not a CIDv1 base32 IPFS address");
  } else {
    throw new Error("use a CIDv1 base32 (b…) or CIDv0 (Qm…) IPFS address");
  }
  return "0xe301" + bytes.toString("hex");
}

/// `[<short-name>:]<address>` per ERC-6821 and ERC-3770. A bare address is
/// "the chain you are on" (chainId null). A CAIP `eip155:1:0x…` — two
/// colons — is refused: it is right for an avatar and wrong here, and the
/// resemblance is exactly how the mistake survives.
export function decodeContentcontract(text) {
  const s = String(text).trim();
  if (s === "") throw new Error("the contentcontract record is empty: the name is not bound");
  const parts = s.split(":");
  if (parts.length > 2) throw new Error("not an ERC-3770 address (one colon at most): " + s);
  const address = parts[parts.length - 1];
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("not an address: " + address);
  if (parts.length === 1) return { shortName: null, chainId: null, address: address.toLowerCase() };
  const shortName = parts[0];
  if (!/^[a-z0-9-]+$/.test(shortName)) throw new Error("not an ERC-3770 short name: " + shortName);
  const chainId = CHAIN_OF_SHORT[shortName];
  return { shortName, chainId: chainId === undefined ? undefined : chainId, address: address.toLowerCase() };
}

/// `web3://<host>[:<chainId>]/<path>[?query]` (ERC-4804 / ERC-6860). The
/// host is a name or an address; the path becomes the ERC-5219 resource.
export function parseWeb3Url(url) {
  const m = String(url).match(/^web3:\/\/([^/:?#]+)(?::(\d+))?(\/[^?#]*)?(?:\?[^#]*)?$/);
  if (!m) throw new Error("not a web3:// URL: " + url);
  const host = m[1];
  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(host);
  if (!isAddress) normalize(host);
  const chainId = m[2] ? Number(m[2]) : null;
  const path = m[3] || "/";
  /*  The bare root is the empty resource. Any deeper trailing slash is an
      empty last segment, which Premises drops itself (one resource, one
      URL) — the client sends what the URL says.                        */
  const segments = path === "/" ? [] : path.split("/").slice(1).map((s) => decodeURIComponent(s));
  return { host: isAddress ? host.toLowerCase() : normalize(host), isAddress, chainId, segments };
}

/*═══════════════════ calls and their answers ═══════════════════*/

export const addrCall = (node) => enc("addr(bytes32)", [node]);
export const addrMultiCall = (node, coinType = 60) => enc("addr(bytes32,uint256)", [node, coinType]);
export const textCall = (node, key) => enc("text(bytes32,string)", [node, key]);
export const contenthashCall = (node) => enc("contenthash(bytes32)", [node]);
export const resolveCall = (name, inner) => enc("resolve(bytes,bytes)", [dnsEncode(name), inner]);
export const supportsCall = (id) => enc("supportsInterface(bytes4)", [id]);

/// The `bytes` a `resolve` returns, unwrapped to the inner call's own
/// return data (itself ABI-encoded), as hex.
export function unwrapResolve(hex) {
  const h = String(hex).replace(/^0x/, "");
  if (h.length < 128) return "0x";
  const off = Number(BigInt("0x" + h.substr(0, 64))) * 2;
  const len = Number(BigInt("0x" + h.substr(off, 64)));
  return "0x" + h.substr(off + 64, len * 2);
}

/// `addr(bytes32)`'s answer from the raw return data, or the zero address
/// for an empty answer.
export const decodeAddr = (hex) => (String(hex).replace(/^0x/, "").length >= 64 ? decAddr(hex) : ZERO);
/// A `string` answer, or "" for an empty one.
export const decodeText = (hex) => (String(hex).replace(/^0x/, "").length >= 128 ? decString(hex) : "");

/*═══════════════════ the walk ═══════════════════*/

const addrEq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/// ENSIP-10: the resolver of the name, or of the nearest parent that has
/// one. `viaParent` says the record was a parent's, in which case the
/// resolver must speak ENSIP-10 or the name cannot be resolved at all.
export async function findResolver(read, registry, name) {
  const ls = labels(name);
  for (let i = 0; i < ls.length; i++) {
    const at = ls.slice(i).join(".");
    const resolver = decAddr(await read(registry, enc("resolver(bytes32)", [namehash(at)])));
    if (!addrEq(resolver, ZERO)) return { resolver, recordOf: at, viaParent: i > 0 };
  }
  return { resolver: ZERO, recordOf: null, viaParent: false };
}

async function supports(read, resolver, id) {
  try { return decUint(await read(resolver, supportsCall(id))) === 1n; } catch { return false; }
}

/// One record of a name: the inner call's raw return data, through
/// ENSIP-10 when the resolver speaks it (always, when the record is a
/// parent's), directly otherwise. `steps` records what was asked.
export async function resolveRecord(read, { registry = ENS_REGISTRY, name, inner, steps = [] }) {
  const n = normalize(name);
  const { resolver, recordOf, viaParent } = await findResolver(read, registry, n);
  if (addrEq(resolver, ZERO)) throw new Error(`no resolver for ${n} or any parent of it`);
  steps.push(`registry.resolver(namehash("${recordOf}")) = ${resolver}${viaParent ? " (a parent's record: ENSIP-10)" : ""}`);
  const wildcard = await supports(read, resolver, IFACE.wildcard);
  if (viaParent && !wildcard) throw new Error(`${recordOf}'s resolver does not speak ENSIP-10, so ${n} cannot be resolved`);
  let data;
  if (wildcard) {
    steps.push(`resolve(dns("${n}"), ${inner.slice(0, 10)}…) through ENSIP-10`);
    data = unwrapResolve(await read(resolver, resolveCall(n, inner)));
  } else {
    steps.push(`${inner.slice(0, 10)}… called directly on the resolver`);
    data = await read(resolver, inner);
  }
  return { resolver, recordOf, viaParent, wildcard, data };
}

/// The ERC-6821 walk: the name's `contentcontract` record, decoded, and
/// checked against the chain the reader is on when one is given.
export async function resolveContentcontract(read, { registry = ENS_REGISTRY, name, chainId, steps = [] }) {
  const n = normalize(name);
  const node = namehash(n);
  const r = await resolveRecord(read, { registry, name: n, inner: textCall(node, "contentcontract"), steps });
  const text = decodeText(r.data);
  steps.push(`text(node, "contentcontract") = ${JSON.stringify(text)}`);
  const cc = decodeContentcontract(text);
  if (cc.chainId === undefined) throw new Error(`contentcontract names a chain this tool does not know: ${cc.shortName}`);
  if (chainId !== undefined && chainId !== null && cc.chainId !== null && Number(chainId) !== cc.chainId) {
    throw new Error(`contentcontract is on ${cc.shortName} (chain ${cc.chainId}); the reader is on chain ${chainId}`);
  }
  steps.push(cc.chainId === null ? "a bare address: the chain the reader is on" : `${cc.shortName} is chain ${cc.chainId}: the reader's`);
  return { name: n, node, ...r, contentcontract: text, shortName: cc.shortName, chainId: cc.chainId, premises: cc.address, steps };
}

/// `web3://intact.eth/token/3073/live` → ENS → contentcontract →
/// `Premises.request(["token","3073","live"])`: the whole walk, returning
/// what the site answered. An address host skips ENS, as a client does.
export async function openWeb3Url(read, { registry = ENS_REGISTRY, url, chainId }) {
  const { encRequest, decResponse } = await import("./site.mjs");
  const u = parseWeb3Url(url);
  const steps = [];
  let premises, resolution = null;
  if (u.isAddress) {
    if (u.chainId !== null && chainId !== undefined && chainId !== null && Number(chainId) !== u.chainId) {
      throw new Error(`the URL names chain ${u.chainId}; the reader is on chain ${chainId}`);
    }
    premises = u.host;
    steps.push(`the host is an address: ${premises}`);
  } else {
    resolution = await resolveContentcontract(read, { registry, name: u.host, chainId, steps });
    premises = resolution.premises;
  }
  const response = decResponse(await read(premises, encRequest(u.segments)));
  steps.push(`Premises.request(${JSON.stringify(u.segments)}) → ${response.status} ${response.header("Content-Type") || ""} ${response.bodyBytes.length} bytes`);
  return { url, host: u.host, segments: u.segments, premises, resolution, ...response, steps };
}

/*═══════════════════ custody, read out ═══════════════════*/

const tryRead = async (read, to, data) => { try { return await read(to, data); } catch { return null; } };

/// Every read behind the Nameplate's answer for a name, laid out, and the
/// one word `bound`. Reads only. `now` is the chain's clock — a block
/// timestamp, never Date.now(); `expectWrapper` is the chain's canonical
/// NameWrapper when the caller knows it (the command line passes the
/// table's entry), so a Nameplate pinned to the wrong one is a finding.
export async function custodyReport(read, { name, nameplate, registry = ENS_REGISTRY, now, expectWrapper }) {
  const n = normalize(name);
  const node = namehash(n);
  const ls = labels(n);
  const isEth2LD = ls.length === 2 && ls[1] === "eth";
  const findings = [];
  const r = {
    name: n, node, nameplate, bound: false, findings,
    registry: null, wrapper: null, registrar: null, hub: null, premises: null, apex: null,
    registryOwner: null, resolver: null, wrapperOwner: null, wrapperExpiry: null, fuses: null,
    expires: null, live: null, heldBy: 0n, inGrip: false, holder: null, reach: null, grip: null,
    contentcontract: null, tokenOf: 0n
  };
  r.registry = decAddr(await read(nameplate, enc("ENS()")));
  r.wrapper = decAddr(await read(nameplate, enc("WRAPPER()")));
  r.registrar = decAddr(await read(nameplate, enc("REGISTRAR()")));
  r.hub = decAddr(await read(nameplate, enc("HUB()")));
  r.premises = decAddr(await read(nameplate, enc("PREMISES()")));
  r.apex = await read(nameplate, enc("APEX()"));
  if (!addrEq(r.registry, registry)) findings.push(`the Nameplate pins registry ${r.registry}, not ${registry}`);
  if (expectWrapper && !addrEq(r.wrapper, expectWrapper)) {
    findings.push(`the Nameplate pins wrapper ${r.wrapper}; this chain's NameWrapper is ${expectWrapper}`);
  }

  r.registryOwner = decAddr(await read(registry, enc("owner(bytes32)", [node])));
  r.resolver = decAddr(await read(registry, enc("resolver(bytes32)", [node])));
  if (!addrEq(r.registryOwner, r.wrapper)) findings.push(`the registry names ${r.registryOwner} as the owner of ${n}, not the canonical NameWrapper ${r.wrapper}`);
  if (!addrEq(r.resolver, nameplate)) findings.push(`the registry's resolver for ${n} is ${r.resolver}, not the Nameplate`);

  const w = await tryRead(read, r.wrapper, enc("getData(uint256)", [BigInt(node)]));
  if (w) { r.wrapperOwner = decAddr(w, 0); r.fuses = decUint(w, 1); r.wrapperExpiry = decUint(w, 2); }
  else findings.push("the wrapper did not answer getData for this node");

  if (isEth2LD) {
    const e = await tryRead(read, r.registrar, enc("nameExpires(uint256)", [BigInt(labelhash(ls[0]))]));
    r.expires = e ? decUint(e) : 0n;
    r.live = now !== undefined && now !== null ? r.expires > BigInt(now) : null;
    if (r.expires === 0n) findings.push(`the registrar has no registration under keccak("${ls[0]}")`);
    else if (r.live === false) findings.push(`the registration lapsed at ${r.expires} (now ${now}); in grace the wrapper still names the holder and the resolver already answers nothing`);
  }

  const h = await read(nameplate, enc("heldBy(bytes32)", [node]));
  r.heldBy = decUint(h, 0);
  r.inGrip = decUint(h, 1) === 1n;
  r.tokenOf = decUint(await read(nameplate, enc("tokenOf(bytes32)", [node])));
  r.contentcontract = decodeText(await read(nameplate, textCall(node, "contentcontract")));
  if (r.heldBy === 0n) findings.push(`no canonical account of hub ${r.hub} holds ${n} (the wrapper names ${r.wrapperOwner || "nobody"})`);
  else {
    r.reach = decAddr(await read(r.hub, enc("account(uint256)", [r.heldBy])));
    r.grip = decAddr(await read(r.hub, enc("grip(uint256)", [r.heldBy])));
    const o = await tryRead(read, r.hub, enc("ownerOf(uint256)", [r.heldBy]));
    r.holder = o ? decAddr(o) : null;
  }
  if (r.tokenOf === 0n && r.heldBy !== 0n) findings.push("held, but the resolver answers nothing: the registrar's clock");
  r.bound = findings.length === 0 && r.tokenOf !== 0n && r.contentcontract !== "";
  return r;
}

/// Throws, naming every finding, unless the name is bound the way the
/// deployment intends (ANIMA's `assertMainnetEnsCustody`, made to read
/// the chain instead of a chain id).
export function assertEnsCustody(report) {
  if (report.bound) return report;
  throw new Error(`${report.name} is not bound: ` + (report.findings.length ? report.findings.join("; ") : "the resolver answers nothing"));
}

/*═══════════════════ the command line ═══════════════════*/

const arg = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; };

if (process.argv[1] && import.meta.url === `file://${fs.realpathSync(process.argv[1])}`) {
  const target = process.argv.slice(2).find((a) => a.startsWith("web3://"));
  const hashOnly = arg("--hash");
  if (hashOnly !== undefined) {
    const n = normalize(hashOnly);
    console.log(`  name      ${n}\n  namehash  ${namehash(n)}\n  dns       ${dnsEncode(n)}\n  labelhash ${labels(n).length ? labelhash(labels(n)[0]) : "-"}`);
    process.exit(0);
  }
  const url = process.env.RPC_URL;
  if (!url) {
    console.error("  set RPC_URL in the environment (it is read from there and written nowhere)");
    process.exit(2);
  }
  const { RpcChain, DEV_KEYS } = await import("./rpc.mjs");
  const chain = await RpcChain.open(url, DEV_KEYS[0]);
  const read = (to, data) => chain.call(to, data);
  const block = await chain.rpc("eth_getBlockByNumber", ["latest", false]);
  const now = BigInt(block.timestamp);
  const custody = arg("--custody");
  if (custody) {
    const nameplate = arg("--nameplate");
    if (!nameplate) { console.error("  --custody needs --nameplate 0x…"); process.exit(2); }
    const report = await custodyReport(read, { name: custody, nameplate, now, expectWrapper: NAME_WRAPPER[chain.chainId] });
    for (const [k, v] of Object.entries(report)) if (k !== "findings") console.log(`  ${k.padEnd(16)} ${v === null ? "-" : String(v)}`);
    for (const f of report.findings) console.log(`  ! ${f}`);
    console.log(`\n  ${report.bound ? "bound" : "not bound"}\n`);
    process.exit(report.bound ? 0 : 1);
  }
  if (!target) { console.error("  usage: node tools/ens-name.mjs web3://<name>/<path> | --custody <name> --nameplate 0x… | --hash <name>"); process.exit(2); }
  const r = await openWeb3Url(read, { url: target, chainId: chain.chainId });
  for (const s of r.steps) console.log("  " + s);
  console.log(`\n  ${r.status} ${r.header("Content-Type") || ""}\n`);
  process.stdout.write(r.body.slice(0, 2000) + (r.body.length > 2000 ? "\n  …\n" : "\n"));
}
