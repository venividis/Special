#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the nameplate: custody is the binding

  Origin: IPSEITY tools/verify-plate.mjs (62 sentences about a resolver
  with stored bindings and a station table), re-aimed for INTACT U18 at
  a resolver that stores nothing. The whole claim under test:

      `intact.eth`, AND EVERY `<id>.intact.eth` UNDER IT, ANSWERS EXACTLY
      WHILE THE REGISTRY HANDS THE APEX TO THE CANONICAL NAMEWRAPPER, THE
      WRAPPER SAYS A CANONICAL ACCOUNT OF THIS HUB HOLDS IT, AND THE .ETH
      REGISTRAR SAYS THE REGISTRATION HAS NOT LAPSED — AND NOT ONE BLOCK
      LONGER, BECAUSE NOTHING IS WRITTEN HERE THAT COULD GO STALE.

  The fixture is the real site deployed with band 0's bounds (ids 3,073
  to 3,584) and an ENS in the shape of the real one — the registry with
  its `authorised` rule, the .eth registrar with its clock and its
  reclaim, the NameWrapper with its expiry rule, its stored wire names and
  its ERC-1155 acceptance check — so the operator's steps are performed
  here exactly as docs/DEPLOYMENT.md will list them: register and wrap,
  set the resolver, transfer the wrapper token into the Reach.

  Three sentences BUILD-PLAN names: "`contentcontract` opens the site"
  (the walk in tools/ens-name.mjs returns the bytes `Premises.request`
  serves for /token/3073/live), "a counterfeit wrapper cannot bind", "the
  wildcard resolves every id in the band" (every one of the 512, and
  neither neighbour).

    node tools/verify-plate.mjs
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile, artifact } from "./compile.mjs";
import { Chain, enc, sel, decAddr, decUint, decString, encodeParams } from "./evm.mjs";
import * as evm from "./evm.mjs";
import { deploySite, getter, mint } from "./site.mjs";
import {
  namehash, labelhash, dnsEncode, normalize, encodeContenthash, decodeContentcontract, parseWeb3Url,
  addrCall, addrMultiCall, textCall, contenthashCall, unwrapResolve, decodeAddr, decodeText,
  findResolver, resolveContentcontract, openWeb3Url, custodyReport, assertEnsCustody, base32Encode,
  NAME_WRAPPER, IFACE, ETH_NODE, ZERO
} from "./ens-name.mjs";

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}`);
  if (!c && d !== undefined) console.log(`      ${String(d).slice(0, 300)}`);
};
const eq = (n, g, w) => ok(n, String(g).toLowerCase() === String(w).toLowerCase(), `got  ${g}\n      want ${w}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const refuses = async (n, fn, errorSig) => {
  try { await fn(); ok(n, false, "it went through"); }
  catch (e) {
    if (errorSig) ok(n, String(e.message).includes(sel(errorSig).slice(2)), `reverted, but not with ${errorSig}: ${e.message}`);
    else ok(n, true);
  }
};
const throws = (n, fn, needle) => {
  try { fn(); ok(n, false, "it did not throw"); }
  catch (e) { ok(n, needle ? String(e.message).includes(needle) : true, `threw, but without "${needle}": ${e.message}`); }
};
const throwsAsync = async (n, fn, needle) => {
  try { await fn(); ok(n, false, "it did not throw"); }
  catch (e) { ok(n, needle ? String(e.message).includes(needle) : true, `threw, but without "${needle}": ${e.message}`); }
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();                       // chain 1, where a .eth resolver runs
const from = c.from.toString();
const DAY = 86400;
const YEAR = 365 * DAY;
const now = () => BigInt(evm.BLOCK.header.timestamp);
const read = (to, data) => c.call(to, data);

/*═══════════════════ the fixture ═══════════════════*/

head("deploy: the site with band 0's bounds, an ENS in the shape of the real one, the Nameplate");
const site = await deploySite(c, out, { band: 0, lo: 3073n, hi: 3584n });
const GET = getter(c, site.premises);
const { id } = await mint(c, site);
eq("the first mint of band 0 is id 3073", id, 3073n);
const reach = decAddr(await c.read(site.hub, "account(uint256)", [id]));
const grip = decAddr(await c.read(site.hub, "grip(uint256)", [id]));

const ens = await c.deploy(A("test/mocks/EnsRegistry.sol", "EnsRegistry").bytecode, "", "EnsRegistry");
const registrar = await c.deploy(A("test/mocks/EnsRegistrar.sol", "EnsRegistrar").bytecode,
  encodeParams("address,bytes32", [ens, ETH_NODE]), "EnsRegistrar");
await c.exec(ens, "setSubnodeOwner(bytes32,bytes32,address)", ["0x" + "00".repeat(32), labelhash("eth"), registrar]);
const wrapper = await c.deploy(A("test/mocks/EnsNameWrapper.sol", "EnsNameWrapper").bytecode,
  encodeParams("address,address", [ens, registrar]), "EnsNameWrapper");
await c.exec(registrar, "addController(address)", [wrapper]);
eq("the registry hands `eth` to the registrar, as on mainnet", decAddr(await c.read(ens, "owner(bytes32)", [ETH_NODE])), registrar);

/*  Register and wrap `intact` for a year — what the ETHRegistrarController
    does for a new registration — to the deployer, with no resolver yet. */
const registeredAt = now();
await c.exec(wrapper, "registerAndWrapETH2LD(string,address,uint256,address,uint16)", ["intact", from, YEAR, ZERO, 0]);
const APEX = namehash("intact.eth");
const APEX_LABEL = labelhash("intact");
eq("after the wrap the registry names the wrapper as the apex's owner", decAddr(await c.read(ens, "owner(bytes32)", [APEX])), wrapper);
eq("and the wrapper names the deployer", decAddr(await c.read(wrapper, "ownerOf(uint256)", [BigInt(APEX)])), from);
eq("the registrar's clock runs a year from registration", decUint(await c.read(registrar, "nameExpires(uint256)", [BigInt(APEX_LABEL)])), registeredAt + BigInt(YEAR));

const PLATE_ARGS = "address,address,address,address,address,string";
const plate = await c.deploy(A("src/Nameplate.sol", "Nameplate").bytecode,
  encodeParams(PLATE_ARGS, [site.hub, site.premises, ens, wrapper, registrar, "intact"]), "Nameplate");
ok("the Nameplate deployed", (await c.codeSize(plate)) > 0);
console.log(`      nameplate ${plate}\n      reach     ${reach}\n      grip      ${grip}`);

const R = async (name, inner, pl = plate) => unwrapResolve(await c.read(pl, "resolve(bytes,bytes)", [dnsEncode(name), inner]));
const addrOf = async (name, pl) => decodeAddr(await R(name, addrCall(namehash(name)), pl));
const txt = async (name, key, pl) => decodeText(await R(name, textCall(namehash(name), key), pl));
const held = async (node, pl = plate) => {
  const h = await c.read(pl, "heldBy(bytes32)", [node]);
  return { id: decUint(h, 0), inGrip: decUint(h, 1) === 1n };
};
const tokenFor = async (name, pl = plate) => decUint(await c.read(pl, "tokenForName(bytes)", [dnsEncode(name)]));
const transfer1155 = (who, fromAddr, to, node) =>
  who.exec(wrapper, "safeTransferFrom(address,address,uint256,uint256,bytes)", [fromAddr, to, BigInt(node), 1, "0x"]);
const register = async (label, to, duration) =>
  c.exec(registrar, "register(uint256,address,uint256)", [BigInt(labelhash(label)), to, duration]);
/// The registrant's own wrap of an unwrapped name: approve, then wrap.
const wrap = async (label, resolver = plate) => {
  await c.exec(registrar, "approve(address,uint256)", [wrapper, BigInt(labelhash(label))]);
  await c.exec(wrapper, "wrapETH2LD(string,address,uint16,address)", [label, from, 0, resolver]);
  return namehash(label + ".eth");
};

head("the constructor pins the world and refuses a wrong one");
eq("HUB", decAddr(await c.read(plate, "HUB()")), site.hub);
eq("PREMISES", decAddr(await c.read(plate, "PREMISES()")), site.premises);
eq("ENS", decAddr(await c.read(plate, "ENS()")), ens);
eq("WRAPPER", decAddr(await c.read(plate, "WRAPPER()")), wrapper);
eq("REGISTRAR", decAddr(await c.read(plate, "REGISTRAR()")), registrar);
eq("APEX is namehash(\"intact.eth\")", await c.read(plate, "APEX()"), APEX);
eq("APEX_LABEL is keccak(\"intact\"), the registrar's key — not the namehash", await c.read(plate, "APEX_LABEL()"), APEX_LABEL);
eq("BAND_LO is read from the hub: 3073", decUint(await c.read(plate, "BAND_LO()")), 3073n);
eq("BAND_HI is read from the hub: 3584", decUint(await c.read(plate, "BAND_HI()")), 3584n);
const stranger = await c.deploy(A("test/mocks/EnsRegistrar.sol", "EnsRegistrar").bytecode, encodeParams("address,bytes32", [ens, ETH_NODE]), "StrangerRegistrar");
await refuses("a registrar the registry does not name is refused (WrongRegistrar)",
  () => c.deploy(A("src/Nameplate.sol", "Nameplate").bytecode, encodeParams(PLATE_ARGS, [site.hub, site.premises, ens, wrapper, stranger, "intact"])), "WrongRegistrar()");
await refuses("a codeless wrapper is refused (NothingThere)",
  () => c.deploy(A("src/Nameplate.sol", "Nameplate").bytecode, encodeParams(PLATE_ARGS, [site.hub, site.premises, ens, "0x" + "00".repeat(19) + "01", registrar, "intact"])), "NothingThere()");
await refuses("an empty label is refused (BadLabel)",
  () => c.deploy(A("src/Nameplate.sol", "Nameplate").bytecode, encodeParams(PLATE_ARGS, [site.hub, site.premises, ens, wrapper, registrar, ""])), "BadLabel()");
await refuses("\"intact.eth\" is not a label (BadLabel): the apex is the label and the .eth is derived",
  () => c.deploy(A("src/Nameplate.sol", "Nameplate").bytecode, encodeParams(PLATE_ARGS, [site.hub, site.premises, ens, wrapper, registrar, "intact.eth"])), "BadLabel()");

/*═══════════════════ binding: the operator's three steps ═══════════════════*/

head("before custody lands in a canonical account, the resolver answers nothing");
eq("heldBy(intact.eth) is 0 while the deployer's wallet holds the wrapped name", (await held(APEX)).id, 0n);
eq("addr(intact.eth) is the zero address", await addrOf("intact.eth"), ZERO);
eq("text(intact.eth, contentcontract) is empty", await txt("intact.eth", "contentcontract"), "");
eq("3073.intact.eth answers nothing either: the wildcard follows the apex", await addrOf("3073.intact.eth"), ZERO);
await throwsAsync("the walk refuses to open web3://intact.eth: no resolver record exists yet",
  () => openWeb3Url(read, { registry: ens, url: "web3://intact.eth/token/3073/live", chainId: 1 }), "no resolver for intact.eth");

head("step 2 of 3: the wrapped owner points the name's resolver at the Nameplate");
await c.exec(wrapper, "setResolver(bytes32,address)", [APEX, plate]);
eq("registry.resolver(intact.eth) is the Nameplate", decAddr(await c.read(ens, "resolver(bytes32)", [APEX])), plate);
eq("and still nothing answers: a resolver record is not a binding", await addrOf("intact.eth"), ZERO);
await throwsAsync("the walk now finds the resolver and refuses to open the site: the record is empty, the name is not bound",
  () => openWeb3Url(read, { registry: ens, url: "web3://intact.eth/token/3073/live", chainId: 1 }), "not bound");

head("step 3 of 3: the wrapper token moves into the Reach of token 3073, and the name means the token");
await transfer1155(c, from, reach, APEX);
eq("the wrapper names the Reach", decAddr(await c.read(wrapper, "ownerOf(uint256)", [BigInt(APEX)])), reach);
const h0 = await held(APEX);
eq("heldBy(intact.eth) is 3073", h0.id, 3073n);
ok("and not sealed: a Reach can send it back out", !h0.inGrip);
eq("addr(intact.eth) is token 3073's Reach — sending ETH to the name funds the token's acting account", await addrOf("intact.eth"), reach);
eq("the legacy addr(node) agrees", decAddr(await c.read(plate, "addr(bytes32)", [APEX])), reach);
{
  const raw = (await c.read(plate, "addr(bytes32,uint256)", [APEX, 60])).replace(/^0x/, "");
  ok("addr(node, 60) is the same twenty bytes in ENSIP-9 form", BigInt("0x" + raw.slice(64, 128)) === 20n && ("0x" + raw.slice(128, 168)).toLowerCase() === reach.toLowerCase(), raw);
  const none = (await c.read(plate, "addr(bytes32,uint256)", [APEX, 0])).replace(/^0x/, "");
  ok("addr(node, 0) is empty: only coin type 60 is served", BigInt("0x" + none.slice(64, 128)) === 0n, none);
}
const cc = await txt("intact.eth", "contentcontract");
eq("text(intact.eth, contentcontract) is eth:0x<premises> — ERC-6821 with the ERC-3770 prefix", cc, "eth:" + site.premises.toLowerCase());
ok("it does not use the CAIP form", !cc.startsWith("eip155:"), cc);
ok("it is shortName:address, one colon", cc.split(":").length === 2, cc);
ok("the address half is a lower-case 20-byte hex address", /^0x[0-9a-f]{40}$/.test(cc.split(":")[1]), cc);
eq("the legacy text(node, key) agrees", decString(await c.read(plate, "text(bytes32,string)", [APEX, "contentcontract"])), cc);
eq("contentcontract() alone says what the record would say", decString(await c.read(plate, "contentcontract()")), cc);
eq("contenthash(intact.eth) is empty: this site is not on IPFS, it is the chain", (await R("intact.eth", contenthashCall(APEX))).replace(/^0x/, "").slice(64, 128), "0".repeat(64));
eq("the legacy contenthash(node) is empty too", (await c.read(plate, "contenthash(bytes32)", [APEX])).replace(/^0x/, "").slice(64, 128), "0".repeat(64));
eq("text(intact.eth, avatar) is the CAIP NFT reference of the holding token", await txt("intact.eth", "avatar"), `eip155:1/erc721:${site.hub.toLowerCase()}/3073`);
eq("text(intact.eth, url) is the collection's web3:// address", await txt("intact.eth", "url"), `web3://${site.premises.toLowerCase()}:1/`);
eq("text(intact.eth, description) is empty: no record this resolver does not serve is invented", await txt("intact.eth", "description"), "");
eq("tokenForName(intact.eth) is 3073", await tokenFor("intact.eth"), 3073n);
eq("tokenOf(node) is 3073", decUint(await c.read(plate, "tokenOf(bytes32)", [APEX])), 3073n);

head("the resolver ids");
for (const [name, want] of [["supportsInterface(bytes4)", IFACE.erc165], ["addr(bytes32)", IFACE.addr], ["addr(bytes32,uint256)", IFACE.addrMulti],
  ["contenthash(bytes32)", IFACE.contenthash], ["text(bytes32,string)", IFACE.text], ["resolve(bytes,bytes)", IFACE.wildcard]]) {
  ok(`${want} is the keccak of ${name}, and the Nameplate claims it`, sel(name) === want && decUint(await c.read(plate, "supportsInterface(bytes4)", [want])) === 1n);
}
eq("0xffffffff is not claimed", decUint(await c.read(plate, "supportsInterface(bytes4)", ["0xffffffff"])), 0n);
eq("a selector nobody defined is not claimed", decUint(await c.read(plate, "supportsInterface(bytes4)", ["0xdeadbeef"])), 0n);

/*═══════════════════ contentcontract opens the site ═══════════════════*/

head("`contentcontract` opens the site");
/*  A walk that throws here is a failed sentence, not a dead verifier: a
    resolver answering a prefix the tool does not know (the mutation that
    misspells "eth") must die as a ✗ with the run's summary intact.      */
try {
  const live = await GET(["token", "3073", "live"]);
  const doc = decString(await c.read(site.renderer, "document(uint256)", [3073]));
  const w = await openWeb3Url(read, { registry: ens, url: "web3://intact.eth/token/3073/live", chainId: 1 });
  eq("web3://intact.eth/token/3073/live → ENS → contentcontract → Premises.request: 200", w.status, 200);
  ok("the walk's bytes equal Premises.request([\"token\",\"3073\",\"live\"])'s body byte for byte", w.body === live.body && w.bodyBytes.equals(live.bodyBytes));
  ok("which are Renderer.document(3073): the console, on a real origin, reached by name", w.body === doc);
  eq("served as text/html", w.header("Content-Type"), "text/html; charset=utf-8");
  eq("the walk found the resolver on the apex's own record", w.resolution.recordOf, "intact.eth");
  ok("and asked through ENSIP-10, which the resolver claims", w.resolution.wildcard === true);
  eq("the premises the walk opened is the one the Nameplate pins", w.premises, site.premises);
  for (const s of w.steps) console.log(`      ${s}`);

  const root = await openWeb3Url(read, { registry: ens, url: "web3://intact.eth/", chainId: 1 });
  ok("web3://intact.eth/ is the collection document", root.status === 200 && root.body.includes('"id":0,') && root.body.includes("self.$INTACT="));

  const viaChild = await openWeb3Url(read, { registry: ens, url: "web3://3073.intact.eth/token/3073/state.json", chainId: 1 });
  ok("web3://3073.intact.eth/…: the registry has no record for the child, the client walks up to the apex and asks through ENSIP-10",
     viaChild.resolution.viaParent === true && viaChild.resolution.recordOf === "intact.eth" && viaChild.status === 200);
  const fr = await findResolver(read, ens, "3073.intact.eth");
  eq("findResolver names the apex's resolver for the child", fr.resolver, plate);

  const byAddr = await openWeb3Url(read, { registry: ens, url: `web3://${site.premises}:1/token/3073/live`, chainId: 1 });
  ok("web3://<premises>:1/… skips ENS and serves the same bytes", byAddr.body === live.body && byAddr.resolution === null);
  await throwsAsync("a reader on another chain refuses eth:0x…: the record names Ethereum",
    () => openWeb3Url(read, { registry: ens, url: "web3://intact.eth/", chainId: 8453 }), "the reader is on chain 8453");
  await throwsAsync("a name no resolver serves is refused by name",
    () => openWeb3Url(read, { registry: ens, url: "web3://nobody.eth/", chainId: 1 }), "no resolver for nobody.eth");
} catch (e) {
  ok("the walk through ENS reached the site without throwing", false, e.message);
}

/*═══════════════════ the wildcard ═══════════════════*/

head("the wildcard resolves every id in the band");
eq("3073.intact.eth answers token 3073's Reach", await addrOf("3073.intact.eth"), reach);
eq("3074.intact.eth answers the zero address while 3074 is unminted: the name exists the moment the token does", await addrOf("3074.intact.eth"), ZERO);
eq("and tokenForName says 0 for it", await tokenFor("3074.intact.eth"), 0n);
const t0 = Date.now();
let last = id;
for (let i = 3074; i <= 3584; i++) last = (await mint(c, site)).id;
eq(`the band is minted out in ${((Date.now() - t0) / 1000).toFixed(1)} s: the last id is 3584`, last, 3584n);
await refuses("3585 cannot be minted: the band is exhausted, not wrapped (BandExhausted)", () => mint(c, site), "BandExhausted()");
let agree = 0, disagree = [];
for (let i = 3073; i <= 3584; i++) {
  const want = decAddr(await c.read(site.hub, "account(uint256)", [i]));
  const got = await addrOf(`${i}.intact.eth`);
  if (got.toLowerCase() === want.toLowerCase()) agree++; else disagree.push(i);
}
eq("every id from 3073 to 3584 answers its own Reach through <id>.intact.eth: 512 of 512", agree, 512);
if (disagree.length) console.log(`      disagreeing: ${disagree.slice(0, 10).join(", ")}`);
await R("3584.intact.eth", addrCall(namehash("3584.intact.eth")));
console.log(`      resolve(3584.intact.eth, addr) reads for ${c.lastGas} gas`);
await R("3584.intact.eth", textCall(namehash("3584.intact.eth"), "contentcontract"));
console.log(`      resolve(3584.intact.eth, text contentcontract) reads for ${c.lastGas} gas`);
await c.read(plate, "addr(bytes32)", [APEX]);
console.log(`      addr(intact.eth) through the legacy path reads for ${c.lastGas} gas`);
eq("3584.intact.eth's contentcontract is the site", await txt("3584.intact.eth", "contentcontract"), "eth:" + site.premises.toLowerCase());
eq("3584.intact.eth's avatar is its own token", await txt("3584.intact.eth", "avatar"), `eip155:1/erc721:${site.hub.toLowerCase()}/3584`);
eq("3584.intact.eth's url is its own page", await txt("3584.intact.eth", "url"), `web3://${site.premises.toLowerCase()}:1/token/3584/live`);
eq("tokenForName(3584.intact.eth) is 3584", await tokenFor("3584.intact.eth"), 3584n);
{
  const raw = await R("3100.intact.eth", addrMultiCall(namehash("3100.intact.eth"), 60));
  const want = decAddr(await c.read(site.hub, "account(uint256)", [3100]));
  eq("addr(node, 60) through the wildcard is the Reach's twenty bytes", "0x" + raw.replace(/^0x/, "").slice(128, 168), want);
}
eq("3072.intact.eth answers nothing: one below the band", await addrOf("3072.intact.eth"), ZERO);
eq("3585.intact.eth answers nothing: one above the band", await addrOf("3585.intact.eth"), ZERO);
eq("1.intact.eth answers nothing: band 1's ids are not this chain's", await addrOf("1.intact.eth"), ZERO);
eq("0.intact.eth answers nothing", await addrOf("0.intact.eth"), ZERO);
eq("03073.intact.eth answers nothing: a leading zero is not a second name for 3073", await addrOf("03073.intact.eth"), ZERO);
eq("3073x.intact.eth answers nothing", await addrOf("3073x.intact.eth"), ZERO);
eq("12345678901.intact.eth answers nothing: eleven digits is not an id", await addrOf("12345678901.intact.eth"), ZERO);
eq("x.3073.intact.eth answers nothing: a child of a wildcard is not a wildcard", await addrOf("x.3073.intact.eth"), ZERO);
eq("3073.other.eth answers nothing: the parent must be the apex", await addrOf("3073.other.eth"), ZERO);
eq("3073.intact.xyz answers nothing", await addrOf("3073.intact.xyz"), ZERO);
eq("text(3072.intact.eth, contentcontract) is empty, not the site", await txt("3072.intact.eth", "contentcontract"), "");
eq("the legacy addr(namehash(3073.intact.eth)) is the zero address: no registry record points a legacy client here, and a bare node carries no label",
   decAddr(await c.read(plate, "addr(bytes32)", [namehash("3073.intact.eth")])), ZERO);

head("a request for nonsense is an empty answer, never a revert");
{
  let r = null;
  try { r = await c.read(plate, "resolve(bytes,bytes)", ["0x0533303733", addrCall(APEX)]); } catch { /* the failure */ }
  ok("a wire name with no terminator answers the zero address", r !== null && decodeAddr(unwrapResolve(r)) === ZERO, r === null ? "it reverted" : r);
  r = null;
  try { r = await c.read(plate, "resolve(bytes,bytes)", ["0x", addrCall(APEX)]); } catch { /* the failure */ }
  ok("an empty name answers the zero address", r !== null && decodeAddr(unwrapResolve(r)) === ZERO, r === null ? "it reverted" : r);
  r = null;
  try { r = await c.read(plate, "resolve(bytes,bytes)", ["0x40" + "61".repeat(64) + "00", addrCall(APEX)]); } catch { /* the failure */ }
  ok("a 64-byte label answers the zero address", r !== null && decodeAddr(unwrapResolve(r)) === ZERO, r === null ? "it reverted" : r);
  r = null;
  try { r = await c.read(plate, "resolve(bytes,bytes)", ["0x" + "0161".repeat(17) + "00", addrCall(APEX)]); } catch { /* the failure */ }
  ok("seventeen labels answer the zero address: no recursion a hostile name could deepen", r !== null && decodeAddr(unwrapResolve(r)) === ZERO, r === null ? "it reverted" : r);
  r = null;
  try { r = await R("3073.intact.eth", "0xdeadbeef"); } catch { /* the failure */ }
  ok("an inner call this resolver does not serve gets empty bytes", r === "0x", r === null ? "it reverted" : r);
  r = null;
  try { r = await R("3073.intact.eth", "0xde"); } catch { /* the failure */ }
  ok("two bytes of inner call get empty bytes", r === "0x", r === null ? "it reverted" : r);
  eq("nodeOf(bytes) is this contract's own namehash, equal to the tool's", await c.read(plate, "nodeOf(bytes)", [dnsEncode("3073.intact.eth")]), namehash("3073.intact.eth"));
  eq("nodeOf of a malformed name is zero", await c.read(plate, "nodeOf(bytes)", ["0x0533303733"]), "0x" + "00".repeat(32));
}

/*═══════════════════ a counterfeit wrapper cannot bind ═══════════════════*/

head("a counterfeit wrapper cannot bind");
{
  const fake = await c.deploy(A("test/mocks/EnsCounterfeits.sol", "EnsCounterfeitWrapper").bytecode, "", "FakeWrapper");
  const node = namehash("counterfeit.eth");
  await register("counterfeit", from, YEAR);
  await c.exec(ens, "setOwner(bytes32,address)", [node, fake]);
  await c.exec(fake, "setOwner(uint256,address)", [BigInt(node), reach]);
  await c.exec(fake, "setName(bytes32,bytes)", [node, dnsEncode("counterfeit.eth")]);
  eq("the registry names the counterfeit as counterfeit.eth's owner", decAddr(await c.read(ens, "owner(bytes32)", [node])), fake);
  eq("and the counterfeit says the Reach holds it", decAddr(await c.read(fake, "ownerOf(uint256)", [BigInt(node)])), reach);
  eq("a contract claiming to be the NameWrapper cannot bind: heldBy(counterfeit.eth) is 0", (await held(node)).id, 0n);
  eq("addr(counterfeit.eth) is the zero address", await addrOf("counterfeit.eth"), ZERO);
  eq("the legacy addr(node) is too, even though the counterfeit answers names(node) faithfully", decAddr(await c.read(plate, "addr(bytes32)", [node])), ZERO);

  /*  Nor can a counterfeit-held apex open a wildcard: a Nameplate whose
      apex is `counterfeit.eth`, with the counterfeit in the registry.  */
  const plate2 = await c.deploy(A("src/Nameplate.sol", "Nameplate").bytecode,
    encodeParams(PLATE_ARGS, [site.hub, site.premises, ens, wrapper, registrar, "counterfeit"]), "Nameplate2");
  eq("a Nameplate for counterfeit.eth: heldBy(apex) is 0", (await held(node, plate2)).id, 0n);
  eq("and 3073.counterfeit.eth answers nothing: the wildcard follows the apex", await addrOf("3073.counterfeit.eth", plate2), ZERO);

  /*  The real wrapper, but held by an impostor: a contract that says it is
      token 3073's account and is not `hub.account(3073)`.             */
  const impostor = await c.deploy(A("test/mocks/EnsCounterfeits.sol", "EnsImpostorAccount").bytecode,
    encodeParams("uint256,address,uint256", [1, site.hub, 3073]), "Impostor");
  await register("impostor", from, YEAR);
  const n2 = await wrap("impostor");
  await transfer1155(c, from, impostor, n2);
  eq("the canonical wrapper names the impostor", decAddr(await c.read(wrapper, "ownerOf(uint256)", [BigInt(n2)])), impostor);
  eq("a contract claiming through token() to be 3073's account is disbelieved: heldBy is 0", (await held(n2)).id, 0n);
  eq("addr(impostor.eth) is the zero address", await addrOf("impostor.eth"), ZERO);

  const other = await c.deploy(A("test/mocks/EnsCounterfeits.sol", "EnsImpostorAccount").bytecode,
    encodeParams("uint256,address,uint256", [1, "0x" + "ee".repeat(20), 3073]), "OtherCollection");
  await register("other", from, YEAR);
  const n3 = await wrap("other");
  await transfer1155(c, from, other, n3);
  eq("so is another collection's account", (await held(n3)).id, 0n);

  const elsewhere = await c.deploy(A("test/mocks/EnsCounterfeits.sol", "EnsImpostorAccount").bytecode,
    encodeParams("uint256,address,uint256", [8453, site.hub, 3073]), "ElsewhereAccount");
  await register("elsewhere", from, YEAR);
  const n4 = await wrap("elsewhere");
  await transfer1155(c, from, elsewhere, n4);
  eq("so is an account that names this hub on another chain", (await held(n4)).id, 0n);

  await register("wallet", from, YEAR);
  const n5 = await wrap("wallet");
  eq("a wallet holding a wrapped name is not a token holding it", (await held(n5)).id, 0n);
  eq("addr(wallet.eth) is the zero address", await addrOf("wallet.eth"), ZERO);

  await register("plain", from, YEAR);
  const n6 = namehash("plain.eth");
  eq("an unwrapped name's registry owner is the registrant, not the wrapper", decAddr(await c.read(ens, "owner(bytes32)", [n6])), from);
  eq("and registry control is not custody: heldBy(plain.eth) is 0", (await held(n6)).id, 0n);
  await c.exec(ens, "setOwner(bytes32,address)", [n6, reach]);
  eq("not even registry control by the Reach itself: a registrant can reclaim that at any time", (await held(n6)).id, 0n);
  eq("addr(plain.eth) is the zero address", await addrOf("plain.eth"), ZERO);
}

head("any wrapped name in a token's account means that token (DESIGN §2: the name survives a sale)");
const ALICE_DAYS = 30;
const aliceNode = await (async () => {
  await register("alice", from, ALICE_DAYS * DAY);
  const n = await wrap("alice");
  await transfer1155(c, from, reach, n);
  return n;
})();
eq("alice.eth in token 3073's Reach: heldBy is 3073", (await held(aliceNode)).id, 3073n);
eq("addr(alice.eth) is the Reach", await addrOf("alice.eth"), reach);
eq("text(alice.eth, contentcontract) is the site", await txt("alice.eth", "contentcontract"), "eth:" + site.premises.toLowerCase());
eq("text(alice.eth, url) is token 3073's page", await txt("alice.eth", "url"), `web3://${site.premises.toLowerCase()}:1/token/3073/live`);
eq("the legacy addr(node) agrees: the wrapper's stored wire name gives the bare node back its label", decAddr(await c.read(plate, "addr(bytes32)", [aliceNode])), reach);
{
  await register("gripped", from, YEAR);
  const n = await wrap("gripped");
  await transfer1155(c, from, grip, n);
  const h = await held(n);
  ok("a name in the Grip means the token and reads as sealed there", h.id === 3073n && h.inGrip === true);
  eq("and addr still answers the Reach, where spending happens", await addrOf("gripped.eth"), reach);
}

/*═══════════════════ custody moves away ═══════════════════*/

head("a name whose custody moved away stops answering");
const moveOut = (who, to) => who.exec(reach, "execute(address,uint256,bytes,uint8)",
  [wrapper, 0, enc("safeTransferFrom(address,address,uint256,uint256,bytes)", [reach, to, BigInt(APEX), 1, "0x"]), 0]);
await moveOut(c, from);
eq("the holder sent the apex back out through the Reach: the wrapper names the wallet", decAddr(await c.read(wrapper, "ownerOf(uint256)", [BigInt(APEX)])), from);
eq("heldBy(intact.eth) is 0 in the same block", (await held(APEX)).id, 0n);
eq("addr(intact.eth) is the zero address", await addrOf("intact.eth"), ZERO);
eq("text(intact.eth, contentcontract) is empty", await txt("intact.eth", "contentcontract"), "");
eq("3073.intact.eth answers nothing: every wildcard fell silent with the apex", await addrOf("3073.intact.eth"), ZERO);
eq("3584.intact.eth too", await addrOf("3584.intact.eth"), ZERO);
eq("alice.eth, still in the Reach, still answers: each name is its own custody", await addrOf("alice.eth"), reach);
await transfer1155(c, from, reach, APEX);
eq("moved back in, the apex answers again with no transaction on the Nameplate", await addrOf("intact.eth"), reach);
eq("and so does the wildcard", await addrOf("3073.intact.eth"), reach);

head("a sale moves the name with the token");
const buyerKey = "0x" + "b1".repeat(32);
const buyer = await c.as(buyerKey);
const buyerAddr = buyer.from.toString();
await c.exec(site.hub, "transferFrom(address,address,uint256)", [from, buyerAddr, 3073]);
eq("token 3073 sold", decAddr(await c.read(site.hub, "ownerOf(uint256)", [3073])), buyerAddr);
eq("the name still means token 3073 and addr is still its Reach: the Reach did not move, the token did", await addrOf("intact.eth"), reach);
eq("3073.intact.eth still answers", await addrOf("3073.intact.eth"), reach);
await refuses("the seller can no longer move the name out of the Reach", () => moveOut(c, from));
await moveOut(buyer, buyerAddr);
eq("the buyer can: the name was never the seller's separately from the token", decAddr(await c.read(wrapper, "ownerOf(uint256)", [BigInt(APEX)])), buyerAddr);
eq("and out of the Reach it answers nothing", await addrOf("intact.eth"), ZERO);
await transfer1155(buyer, buyerAddr, reach, APEX);
eq("returned, it answers", await addrOf("intact.eth"), reach);

/*═══════════════════ the clock ═══════════════════*/

head("an expired registration answers nothing — the registrar's clock, read live");
const aliceExpiry = registeredAt + BigInt(ALICE_DAYS * DAY);
evm.warp(aliceExpiry + 1n);
eq("alice.eth, registered for thirty days, lapsed: addr is the zero address while the wrapper still names the Reach",
   await addrOf("alice.eth"), ZERO);
eq("heldBy(alice.eth) is still 3073: custody did not move, the clock did", (await held(aliceNode)).id, 3073n);
eq("the legacy addr(node) keeps the same clock through the wrapper's stored name", decAddr(await c.read(plate, "addr(bytes32)", [aliceNode])), ZERO);
eq("the apex, registered for a year, is unaffected", await addrOf("intact.eth"), reach);
await c.exec(wrapper, "renew(uint256,uint256)", [BigInt(labelhash("alice")), YEAR]);
eq("renewed, alice.eth answers again", await addrOf("alice.eth"), reach);

const apexExpiry = registeredAt + BigInt(YEAR);
eq("expiry(APEX_LABEL) is the registrar's date", decUint(await c.read(plate, "expiry(bytes32)", [APEX_LABEL])), apexExpiry);
eq("live(APEX_LABEL) is true", decUint(await c.read(plate, "live(bytes32)", [APEX_LABEL])), 1n);
eq("expiry of a label nobody registered is 0", decUint(await c.read(plate, "expiry(bytes32)", [labelhash("nobody")])), 0n);
eq("and live is false for it", decUint(await c.read(plate, "live(bytes32)", [labelhash("nobody")])), 0n);
evm.warp(apexExpiry - 1n);
eq("one second before expiry the apex answers", await addrOf("intact.eth"), reach);
eq("and so does the wildcard", await addrOf("3584.intact.eth"), decAddr(await c.read(site.hub, "account(uint256)", [3584])));
evm.warp(apexExpiry);
eq("at the very second of expiry the name answers nothing", await addrOf("intact.eth"), ZERO);
eq("text(intact.eth, contentcontract) is empty", await txt("intact.eth", "contentcontract"), "");
eq("3073.intact.eth answers nothing", await addrOf("3073.intact.eth"), ZERO);
eq("live(APEX_LABEL) is false", decUint(await c.read(plate, "live(bytes32)", [APEX_LABEL])), 0n);
eq("in grace the wrapper still names the Reach, so heldBy is still 3073 — and the resolver already answers nothing", (await held(APEX)).id, 3073n);
eq("tokenOf(node) is 0: custody and the clock, both", decUint(await c.read(plate, "tokenOf(bytes32)", [APEX])), 0n);
{
  const rep = await custodyReport(read, { name: "intact.eth", nameplate: plate, registry: ens, now: now() });
  ok("custodyReport says not bound, and names the lapse", rep.bound === false && rep.findings.some((f) => f.includes("lapsed")), rep.findings.join("; "));
}
evm.warp(apexExpiry + 89n * BigInt(DAY));
eq("eighty-nine days into the grace period the wrapper still names the Reach", decAddr(await c.read(wrapper, "ownerOf(uint256)", [BigInt(APEX)])), reach);
await c.exec(wrapper, "renew(uint256,uint256)", [BigInt(labelhash("intact")), YEAR]);
const renewedExpiry = apexExpiry + BigInt(YEAR);
eq("renewed through the controller inside the grace period, the registrar's clock moves a year on", decUint(await c.read(plate, "expiry(bytes32)", [APEX_LABEL])), renewedExpiry);
eq("and the apex answers again: nothing had to be re-bound", await addrOf("intact.eth"), reach);
eq("and the wildcard", await addrOf("3073.intact.eth"), reach);

head("past the grace period the name is anyone's — and answers nothing until it sits in a token's account again");
evm.warp(renewedExpiry + 90n * BigInt(DAY) + 1n);
eq("one second past expiry plus grace, the wrapper itself says nobody holds it", decAddr(await c.read(wrapper, "ownerOf(uint256)", [BigInt(APEX)])), ZERO);
eq("heldBy(intact.eth) is 0", (await held(APEX)).id, 0n);
eq("addr(intact.eth) is the zero address", await addrOf("intact.eth"), ZERO);
await refuses("the registrar refuses a renewal now (Expired): only a fresh registration brings the name back", () => c.exec(wrapper, "renew(uint256,uint256)", [BigInt(labelhash("intact")), YEAR]), "Expired()");
const strangerKey = "0x" + "c2".repeat(32);
const strangerChain = await c.as(strangerKey);
const strangerAddr = strangerChain.from.toString();
const reRegisteredAt = now();
await c.exec(wrapper, "registerAndWrapETH2LD(string,address,uint256,address,uint16)", ["intact", strangerAddr, YEAR, plate, 0]);
eq("a stranger registers intact.eth anew: the wrapper names the stranger", decAddr(await c.read(wrapper, "ownerOf(uint256)", [BigInt(APEX)])), strangerAddr);
eq("the registry still names the wrapper", decAddr(await c.read(ens, "owner(bytes32)", [APEX])), wrapper);
eq("live again, by the registrar", decUint(await c.read(plate, "live(bytes32)", [APEX_LABEL])), 1n);
eq("and still nothing answers: a wallet is not a token, whoever registered", await addrOf("intact.eth"), ZERO);
eq("3073.intact.eth answers nothing for the stranger", await addrOf("3073.intact.eth"), ZERO);
await transfer1155(strangerChain, strangerAddr, reach, APEX);
eq("the stranger puts the name into token 3073's Reach, and the apex answers for 3073 again", await addrOf("intact.eth"), reach);
eq("and the wildcard", await addrOf("3073.intact.eth"), reach);

/*═══════════════════ the custody report ═══════════════════*/

head("custodyReport reads what the steps wrote, and nothing else");
{
  const rep = await custodyReport(read, { name: "intact.eth", nameplate: plate, registry: ens, now: now() });
  eq("registryOwner is the wrapper", rep.registryOwner, wrapper);
  eq("resolver is the Nameplate", rep.resolver, plate);
  eq("wrapperOwner is the Reach", rep.wrapperOwner, reach);
  eq("expires is the registrar's date", rep.expires, reRegisteredAt + BigInt(YEAR));
  ok("live", rep.live === true);
  eq("heldBy is 3073", rep.heldBy, 3073n);
  ok("not in the Grip", rep.inGrip === false);
  eq("holder is the buyer", rep.holder, buyerAddr);
  eq("reach", rep.reach, reach);
  eq("grip", rep.grip, grip);
  eq("contentcontract", rep.contentcontract, "eth:" + site.premises.toLowerCase());
  ok("bound, with no findings", rep.bound === true && rep.findings.length === 0, rep.findings.join("; "));
  ok("assertEnsCustody passes it", (() => { try { return assertEnsCustody(rep) === rep; } catch { return false; } })());
  const walletRep = await custodyReport(read, { name: "wallet.eth", nameplate: plate, registry: ens, now: now() });
  throws("assertEnsCustody refuses a name a wallet holds, naming the reason", () => assertEnsCustody(walletRep), "no canonical account");
  const plainRep = await custodyReport(read, { name: "plain.eth", nameplate: plate, registry: ens, now: now() });
  ok("an unwrapped name's report names the registry owner that is not the wrapper", plainRep.findings.some((f) => f.includes("not the canonical NameWrapper")), plainRep.findings.join("; "));
  const wrongChain = await custodyReport(read, { name: "intact.eth", nameplate: plate, registry: ens, now: now(), expectWrapper: NAME_WRAPPER[11155111] });
  ok("told Sepolia's canonical wrapper, the report says the pinned wrapper is not it", wrongChain.findings.some((f) => f.includes("0x0635513f179D50A207757E05759CbD106d7dFcE8")), wrongChain.findings.join("; "));
}

/*═══════════════════ the helpers ═══════════════════*/

head("tools/ens-name.mjs: the arithmetic");
eq("namehash(\"\") is zero", namehash(""), "0x" + "00".repeat(32));
eq("namehash(\"eth\") is the ETH node", namehash("eth"), ETH_NODE);
eq("namehash(\"intact.eth\") is the contract's APEX", namehash("intact.eth"), await c.read(plate, "APEX()"));
eq("namehash is case-insensitive over ASCII", namehash("INTACT.eth"), APEX);
eq("dnsEncode(\"intact.eth\") is 06 intact 03 eth 00", dnsEncode("intact.eth"), "0x06696e746163740365746800");
eq("dnsEncode(\"\") is a lone terminator", dnsEncode(""), "0x00");
throws("a non-ASCII name is refused rather than hashed wrong", () => namehash("intäct.eth"), "ENSIP-15");
throws("an empty label is refused", () => namehash("intact..eth"), "empty label");
throws("a 64-byte label is refused by dnsEncode", () => dnsEncode("a".repeat(64) + ".eth"), "63 bytes");
eq("labelhash(\"intact\") is keccak of the label", labelhash("intact"), APEX_LABEL);
eq("normalize trims and lowers", normalize("  Intact.ETH "), "intact.eth");
{
  const u = parseWeb3Url("web3://intact.eth/token/3073/live?x=1");
  ok("parseWeb3Url: name host, three segments, the query dropped", u.host === "intact.eth" && !u.isAddress && u.chainId === null && u.segments.join("/") === "token/3073/live");
  const a = parseWeb3Url(`web3://${site.premises}:1/token/1/raw`);
  ok("parseWeb3Url: address host with a chain", a.isAddress && a.chainId === 1 && a.host === site.premises.toLowerCase());
  ok("parseWeb3Url: a trailing slash is an empty last segment, as ERC-5219 sends it", parseWeb3Url("web3://intact.eth/token/3073/").segments.join("|") === "token|3073|");
  ok("parseWeb3Url: a bare host is the root", parseWeb3Url("web3://intact.eth").segments.length === 0);
  throws("an https URL is not a web3 URL", () => parseWeb3Url("https://intact.eth/"), "not a web3");
}

head("tools/ens-name.mjs: ERC-6821 and ERC-3770");
{
  const d = decodeContentcontract("eth:" + site.premises);
  ok("eth:0x… is chain 1", d.chainId === 1 && d.shortName === "eth" && d.address === site.premises.toLowerCase());
  const s = decodeContentcontract("sep:" + site.premises);
  ok("sep:0x… is Sepolia", s.chainId === 11155111);
  const b = decodeContentcontract(site.premises);
  ok("a bare address is the chain the reader is on", b.chainId === null && b.shortName === null);
  ok("an unknown short name decodes with no chain, so the walk refuses it", decodeContentcontract("base:" + site.premises).chainId === undefined);
  throws("the CAIP form eip155:1:0x… is refused: two colons", () => decodeContentcontract(`eip155:1:${site.premises}`), "one colon");
  throws("an upper-case short name is refused", () => decodeContentcontract("ETH:" + site.premises), "short name");
  throws("an empty record is the name not being bound", () => decodeContentcontract(""), "not bound");
  throws("a short address is refused", () => decodeContentcontract("eth:0x1234"), "not an address");

  const v0 = "QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4";
  const ch = encodeContenthash("ipfs://" + v0);
  ok("encodeContenthash(ipfs://Qm…) is e3 01 | 01 70 | 12 20 | 32 bytes: ipfs-ns, CIDv1, dag-pb, sha2-256", /^0xe30101701220[0-9a-f]{64}$/.test(ch), ch);
  const digest = ch.slice(-64);
  const v1 = "b" + base32Encode(Buffer.from("01701220" + digest, "hex"));
  eq("the same CID as CIDv1 base32 (ANIMA's form) encodes to the same bytes", encodeContenthash("ipfs://" + v1), ch);
  eq("a pre-encoded 0x contenthash passes through", encodeContenthash(ch.toUpperCase().replace("0X", "0x")), ch);
  throws("ipfs://zz… is refused", () => encodeContenthash("ipfs://zz"), "CIDv1");
  throws("https:// is not a contenthash", () => encodeContenthash("https://x"), "ipfs://");
  throws("odd hex is refused", () => encodeContenthash("0xe30"), "even-length");
}

head("read off the compiled ABI, the deployed code and the tool's source");
{
  const abi = A("src/Nameplate.sol", "Nameplate").abi;
  const fns = abi.filter((f) => f.type === "function");
  ok("every function on the ABI is a view or pure: no setter, no admin, no stored binding", fns.every((f) => ["view", "pure"].includes(f.stateMutability)));
  ok("no function is named bind, claim, set, admin, owner, renounce, transfer or station",
     !fns.some((f) => /bind|claim|^set|admin|owner|renounce|transfer|station|renew/i.test(f.name)));
  ok("the ABI has no fallback and no receive", !abi.some((f) => f.type === "fallback" || f.type === "receive"));
  const ctor = abi.find((f) => f.type === "constructor");
  eq("the constructor takes hub, premises, ens, wrapper, registrar, label", ctor.inputs.map((i) => i.type).join(","), PLATE_ARGS);
  const n = A("src/Nameplate.sol", "Nameplate").deployed.length / 2 - 1;
  ok(`Nameplate measures ${n} B of 10,000`, n <= 10_000);
  eq("the Sepolia NameWrapper in the tool's table is the canonical one (I PR #26)", NAME_WRAPPER[11155111], "0x0635513f179D50A207757E05759CbD106d7dFcE8");
  ok("and it is not mainnet's", NAME_WRAPPER[11155111].toLowerCase() !== NAME_WRAPPER[1].toLowerCase());
  const src = fs.readFileSync(path.join(ROOT, "tools/ens-name.mjs"), "utf8");
  ok("tools/ens-name.mjs names no endpoint: RPC_URL comes from the environment and is written nowhere",
     !/https?:\/\/|wss?:\/\//.test(src) && src.includes("process.env.RPC_URL") && !/writeFile|appendFile/.test(src));
  /*  Every statement at the contract body's indentation is an immutable,
      a constant, an error, an event, a `using`, or an interface member —
      never a state variable. Locals sit deeper and are not looked at.  */
  const sol = fs.readFileSync(path.join(ROOT, "src/Nameplate.sol"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const bodyStatements = sol.split("\n").filter((l) => /^ {4}\S/.test(l) && /;\s*$/.test(l));
  ok(`src/Nameplate.sol declares no storage variable (${bodyStatements.length} body statements, each an immutable, a constant, an error or an interface member): every binding is read from ENS at the block of the query`,
     bodyStatements.length > 0 && bodyStatements.every((l) => /\b(immutable|constant|error|event|using|function)\b/.test(l)),
     bodyStatements.filter((l) => !/\b(immutable|constant|error|event|using|function)\b/.test(l)).join(" | "));
}

console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
