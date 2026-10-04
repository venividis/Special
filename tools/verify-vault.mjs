#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the sealed vault, the receive-only hand, and the keys

  Origin: IPSEITY tools/verify-vault.mjs (97 assertions), ported to the
  Reach and the Grip of DESIGN.md §9 against the in-process EVM, plus the
  INTACT cases: the custody-epoch rule on every key (sale, buy-back, panic),
  the open-approval ledger, `executeTyped` with a receive floor, the ERC-7739
  attestation as a Safe owner, the Grip's ABI against IGrip, and the Reach's
  frozen storage layout against docs/ACCOUNTS.md.

  The claim under test: while a vault is sealed, nothing on its manifest
  leaves it, whatever the holder calls — and nothing a holder delegated
  outlives the holder.

  A selector list cannot support that claim, so this suite does not test a
  selector list. It tests the measurement, and it attacks it the way the
  gap would actually be exploited:

    · the obvious word            transfer / transferFrom
    · a word no list has          a drainer with a bespoke function name
    · the deferred drain          approve now, pull in the next block
    · the signature               ERC-1271 as an off-chain authority
    · the ether                   a plain value send
    · the ratchet                 shortening or dodging the seal
    · the sale                    does the promise survive the buyer
    · the key                     does a session survive the seller

    node tools/verify-vault.mjs
    node tools/verify-vault.mjs --layout     print the storage layout and its hash
───────────────────────────────────────────────────────────────────────────*/
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { compile, artifact, ROOT } from "./compile.mjs";
import { Chain, enc, encodeParams, decUint, decAddr, decBool } from "./evm.mjs";
import { createAddressFromString, hexToBytes, bytesToHex } from "@ethereumjs/util";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { secp256k1 } from "ethereum-cryptography/secp256k1.js";

const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}`);
  if (!c && d !== undefined) console.log(`      ${d}`);
};
const eq = (n, g, w) => ok(n, String(g) === String(w), `got ${g}\n      want ${w}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const WAD = 10n ** 18n;
const REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const MAX = BigInt("0x" + "ff".repeat(32));
const SEL_TRANSFER = "0xa9059cbb", SEL_TRANSFER_FROM = "0x23b872dd", SEL_APPROVE = "0x095ea7b3",
      SEL_APPROVE_ALL = "0xa22cb465", SEL_PERMIT2 = "0x87517c45", SEL_TAKE = "0x" + Buffer.from(keccak256(Buffer.from("take(address,uint256)"))).toString("hex").slice(0, 8);
const GRANT = "grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)";
const SESSION = "executeAsSession(address,uint256,bytes)";
const EXEC = "execute(address,uint256,bytes,uint8)";
const BATCH = "executeBatch((address,uint256,bytes)[])";
const TYPED = "executeTyped((address,uint256,bytes,(address,uint256)[],(address,uint256)[],uint64))";

/*──────────────── the frozen storage layout ────────────────*/
/*  The implementation address is an input to every Reach's address, so the
    layout can never change for a deployed band. It is hashed here from the
    compiler's own storageLayout output, and docs/ACCOUNTS.md carries the
    hash: a Reach that compiles to a different layout fails this suite before
    it can be deployed over a live one.                                    */
function layout() {
  const solc = require("solc");
  const src = fs.readFileSync(path.join(ROOT, "src/Reach.sol"), "utf8");
  const findImport = (p) => {
    for (const base of ["", "src/", "src/lib/", "src/interfaces/"]) {
      const full = path.join(ROOT, base, p);
      if (fs.existsSync(full)) return { contents: fs.readFileSync(full, "utf8") };
    }
    return { error: "not found: " + p };
  };
  const input = { language: "Solidity", sources: { "src/Reach.sol": { content: src } },
    settings: { optimizer: { enabled: true, runs: 800 }, viaIR: true, evmVersion: "cancun",
      metadata: { bytecodeHash: "none" }, outputSelection: { "*": { Reach: ["storageLayout"] } } } };
  const key = createHash("sha256").update(solc.version()).update(JSON.stringify(input)).digest("hex");
  const cacheDir = path.join(ROOT, "out", "compile-cache");
  const cacheFile = path.join(cacheDir, "layout-" + key + ".json");
  let L;
  if (fs.existsSync(cacheFile)) { try { L = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch {} }
  if (!L) {
    const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
    const errs = (out.errors || []).filter((e) => e.severity === "error");
    if (errs.length) throw new Error(errs[0].formattedMessage);
    L = out.contracts["src/Reach.sol"].Reach.storageLayout;
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(L));
  }
  // the AST id solc appends to struct and enum names is per-compile; the
  // length of a fixed array is part of the layout and stays
  const strip = (t) => t.replace(/(t_struct\([^)]*\)|t_enum\([^)]*\))\d+/g, "$1");
  const lines = [];
  for (const s of L.storage) lines.push(`${s.slot} ${s.offset} ${s.label} ${strip(s.type)}`);
  for (const [name, t] of Object.entries(L.types).sort()) {
    if (!t.members) continue;
    lines.push(`type ${strip(name)} ${t.numberOfBytes}`);
    for (const m of t.members) lines.push(`  ${m.slot} ${m.offset} ${m.label} ${strip(m.type)}`);
  }
  const text = lines.join("\n");
  return { text, hash: createHash("sha256").update(text).digest("hex") };
}

if (process.argv.includes("--layout")) {
  const l = layout();
  console.log(l.text);
  console.log("\nlayout hash: " + l.hash);
  process.exit(0);
}

/*──────────────── deploy ────────────────*/
const evm = await import("./evm.mjs");
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const me = c.from.toString();
const T0 = evm.GENESIS_TIME;

head("deploy");
const tmpReg = await c.deploy(A("test/mocks/MockRegistry6551.sol", "MockRegistry6551").bytecode);
await c.vm.stateManager.putCode(createAddressFromString(REGISTRY),
  await c.vm.stateManager.getCode(createAddressFromString(tmpReg)));
const impl = await c.deploy(A("src/Reach.sol", "Reach").bytecode, "", "Reach");
const gripImpl = await c.deploy(A("src/Grip.sol", "Grip").bytecode, "", "Grip");
const hub = await c.deploy(A("test/mocks/AccountsHub.sol", "AccountsHub").bytecode,
  encodeParams("address,address", [impl, gripImpl]));
const drainer = await c.deploy(A("test/mocks/Drainer.sol", "Drainer").bytecode);
const mkToken = (name, sym) => c.deploy(A("test/mocks/MockERC20.sol", "MockERC20").bytecode,
  encodeParams("string,string,uint8,uint256,bool", [name, sym, 18, 0, false]));
const GOLD = await mkToken("Gold", "GOLD");
const SILVER = await mkToken("Silver", "SLVR");
ok("deployed", true);
const reachBytes = (await c.codeSize(impl)), gripBytes = (await c.codeSize(gripImpl));
console.log(`      Reach implementation ${impl}  ${reachBytes} B`);
console.log(`      Grip  implementation ${gripImpl}  ${gripBytes} B`);
ok("the Grip measures 1,933 ± 50 bytes", Math.abs(gripBytes - 1933) <= 50, `${gripBytes} B`);
ok("the Reach is under the 21,000-byte valve", reachBytes <= 21000, `${reachBytes} B`);

const mintTo = async (who) => {
  const r = await c.exec(hub, "mint(address)", [who], { label: "mint" });
  const id = decUint(await c.read(hub, "minted()"));
  return { id, vault: decAddr(await c.read(hub, "account(uint256)", [id])), grip: decAddr(await c.read(hub, "grip(uint256)", [id])) };
};
const asOther = async (keyHex) => c.as(keyHex);
const refuses = async (name, fn, why) => {
  let threw = false, err;
  try { await fn(); } catch (e) { threw = true; err = e; }
  ok(name, threw, "IT WENT THROUGH — " + why);
  return err;
};
const callFrom = async (from, to, sig, args, value = 0n) => {
  const r = await c.vm.evm.runCall({
    to: createAddressFromString(to), caller: createAddressFromString(from),
    origin: createAddressFromString(from), data: hexToBytes(enc(sig, args)),
    gasLimit: 30_000_000n, value, block: evm.BLOCK
  });
  if (r.execResult.exceptionError) {
    const e = new Error(r.execResult.exceptionError.error);
    e.data = bytesToHex(r.execResult.returnValue || new Uint8Array());
    throw e;
  }
  return bytesToHex(r.execResult.returnValue);
};

/*──────────────── the vault ────────────────*/
head("a token's vault");
const t1 = await mintTo(me);
const vault = t1.vault;
ok("the account exists in the mint transaction", (await c.codeSize(vault)) > 0);
ok("and so does the Grip", (await c.codeSize(t1.grip)) > 0);
console.log(`      ${vault}`);
const tok = await c.read(vault, "token()");
eq("it knows which token it belongs to", decUint(tok, 2), t1.id);
eq("and which collection", decAddr(tok, 1).toLowerCase(), hub.toLowerCase());
eq("and who holds it", decAddr(await c.read(vault, "owner()")).toLowerCase(), me.toLowerCase());
eq("HUB() is the collection", decAddr(await c.read(vault, "HUB()")).toLowerCase(), hub.toLowerCase());

await c.exec(GOLD, "mint(address,uint256)", [vault, 1000n * WAD]);
await c.send({ to: vault, value: 5n * WAD });
eq("it holds gold", decUint(await c.read(GOLD, "balanceOf(address)", [vault])), 1000n * WAD);

head("unsealed, the vault is the holder's to empty");
await c.exec(vault, EXEC, [GOLD, 0, enc("transfer(address,uint256)", [me, 100n * WAD]), 0], { label: "execute" });
eq("gold left as asked", decUint(await c.read(GOLD, "balanceOf(address)", [vault])), 900n * WAD);
eq("the 6551 state counter moved", decUint(await c.read(vault, "state()")), 1);
ok("and the audit root chains it", decUint(await c.read(vault, "auditRoot()")) !== 0n);

/*──────────────── the seal ────────────────*/
head("the seal");
await c.exec(vault, "guard(address)", [GOLD], { label: "guard" });
await c.exec(vault, "seal(uint64)", [T0 + 30n * 86400n], { label: "seal" });
ok("sealed", decBool(await c.read(vault, "isSealed()")));
eq("the date is readable by anyone", decUint(await c.read(vault, "sealedUntil()")), T0 + 30n * 86400n);
const hold = await c.read(vault, "holdings()");
eq("and so is everything under it", decUint(hold, 0), 5n * WAD);
await refuses("shortening the seal", () => c.exec(vault, "seal(uint64)", [T0 + 100n]), "the ratchet turns backwards");
await refuses("a seal nobody can outlive", () => c.exec(vault, "seal(uint64)", [T0 + 400n * 86400n]), "the seal has no ceiling");

head("trying to get the gold out");
const goldBefore = decUint(await c.read(GOLD, "balanceOf(address)", [vault]));
await refuses("the obvious word — transfer", () =>
  c.exec(vault, EXEC, [GOLD, 0, enc("transfer(address,uint256)", [me, WAD]), 0]), "a sealed vault paid out on a plain transfer");
await refuses("transferFrom, pulling from the vault itself", () =>
  c.exec(vault, EXEC, [GOLD, 0, enc("transferFrom(address,address,uint256)", [vault, me, WAD]), 0]), "a sealed vault paid out on transferFrom");
await c.exec(GOLD, "approve(address,uint256)", [drainer, MAX]);
await refuses("a drainer with a function name no list has still Shrank", () =>
  c.exec(vault, EXEC, [drainer, 0, enc("take(address,uint256)", [GOLD, WAD]), 0]),
  "measurement missed a bespoke drainer — this is the whole point of the design");
await refuses("approving a spender to pull later", () =>
  c.exec(vault, EXEC, [GOLD, 0, enc("approve(address,uint256)", [me, MAX]), 0]), "the deferred drain is open");
await refuses("setApprovalForAll on an NFT", () =>
  c.exec(vault, EXEC, [GOLD, 0, enc("setApprovalForAll(address,bool)", [me, true]), 0]), "operator approval is open");
await refuses("permit, which is an approval wearing a signature", () =>
  c.exec(vault, EXEC, [GOLD, 0, "0xd505accf" + "00".repeat(224), 0]), "permit is an unmeasurable approval");
await refuses("Permit2's approve, the shape the old list never heard of", () =>
  c.exec(vault, EXEC, [GOLD, 0, SEL_PERMIT2 + "00".repeat(128), 0]), "a six-selector list was walked through with this once");
await refuses("sending the vault's ether", () =>
  c.exec(vault, EXEC, [me, WAD, "0x", 0]), "ether left a sealed vault");
await refuses("delegatecall, which would rewrite the account itself", () =>
  c.exec(vault, EXEC, [drainer, 0, "0x", 1]), "delegatecall is allowed — the seal can be overwritten in storage");
eq("not one satoshi of gold moved", decUint(await c.read(GOLD, "balanceOf(address)", [vault])), goldBefore);

head("but the vault still works");
let acted = false;
try { await c.exec(vault, EXEC, [hub, 0, enc("minted()", []), 0]); acted = true; } catch (e) { console.log("      " + String(e.message).slice(0, 90)); }
ok("a call to something it never promised still executes", acted);
await refuses("but an unlisted word said to a promised asset does not", () =>
  c.exec(vault, EXEC, [GOLD, 0, enc("balanceOf(address)", [vault]), 0]), "the manifest boundary is not deny-by-default after all");
console.log("      this is the cost, stated: a holder who wants to claim() on a");
console.log("      promised asset must unguard it first, or not promise it");
let received = false;
try { await c.exec(GOLD, "mint(address,uint256)", [vault, 50n * WAD]); received = true; } catch {}
ok("and the vault can still be paid", received && decUint(await c.read(GOLD, "balanceOf(address)", [vault])) === goldBefore + 50n * WAD);

head("a signature is an authority measurement cannot see");
eq("so a raw hash gets 0xffffffff while sealed",
  (await c.read(vault, "isValidSignature(bytes32,bytes)", ["0x" + "11".repeat(32), "0x" + "00".repeat(65)])).slice(0, 10), "0xffffffff");
eq("and the ERC-7739 probe answers 0x77390001",
  (await c.read(vault, "isValidSignature(bytes32,bytes)", ["0x" + "7739".repeat(16), "0x"])).slice(0, 10), "0x77390001");

/*──────────────── the sale ────────────────*/
head("the promise survives the sale");
const buyer = await asOther("0x" + "b1".repeat(32));
const buyerAddr = buyer.from.toString();
await c.exec(hub, "transferFrom(address,address,uint256)", [me, buyerAddr, t1.id]);
eq("the token moved", decAddr(await c.read(hub, "ownerOf(uint256)", [t1.id])).toLowerCase(), buyerAddr.toLowerCase());
eq("the vault followed it", decAddr(await c.read(vault, "owner()")).toLowerCase(), buyerAddr.toLowerCase());
eq("the seal is untouched", decUint(await c.read(vault, "sealedUntil()")), T0 + 30n * 86400n);
eq("and so is the gold", decUint(await c.read(GOLD, "balanceOf(address)", [vault])), goldBefore + 50n * WAD);
await refuses("the seller can no longer act as the vault", () =>
  c.exec(vault, EXEC, [GOLD, 0, enc("transfer(address,uint256)", [me, WAD]), 0]), "the old owner still commands the vault");
await refuses("and the buyer is bound by it too, until it expires", () =>
  buyer.exec(vault, EXEC, [GOLD, 0, enc("transfer(address,uint256)", [buyerAddr, WAD]), 0]), "the buyer walked through the seal");

head("and then it lifts");
evm.warp(T0 + 31n * 86400n);
ok("no longer sealed", !decBool(await c.read(vault, "isSealed()")));
let freed = false;
try { await buyer.exec(vault, EXEC, [GOLD, 0, enc("transfer(address,uint256)", [buyerAddr, WAD]), 0]); freed = true; } catch {}
ok("the buyer can move what they bought", freed);
eq("the gold is theirs", decUint(await c.read(GOLD, "balanceOf(address)", [buyerAddr])), WAD);
evm.warp(T0);

head("what the seal does not cover");
const t2 = await mintTo(me);
await c.exec(SILVER, "mint(address,uint256)", [t2.vault, 100n * WAD]);
await c.exec(t2.vault, "seal(uint64)", [T0 + 86400n]);
let unlistedLeft = false;
try { await c.exec(t2.vault, EXEC, [SILVER, 0, enc("transfer(address,uint256)", [me, WAD]), 0]); unlistedLeft = true; } catch {}
ok("an asset nobody put on the manifest can still leave — by design, and why manifest() is public", unlistedLeft);

/*════════════════ THE GRIP ════════════════*/
head("the other hand — the Grip");
const grip = t1.grip;
ok("a second account, at a second salt", grip.toLowerCase() !== vault.toLowerCase());
console.log(`      reach ${vault}\n      grip  ${grip}`);
eq("and it knows whose it is", decAddr(await c.read(grip, "owner()")).toLowerCase(), buyerAddr.toLowerCase());

head("the guarantee is in the shape, so read the shape");
const gripAbi = A("src/Grip.sol", "Grip").abi;
const igripAbi = A("src/interfaces/IGrip.sol", "IGrip").abi;
const sigOf = (f) => f.name + "(" + f.inputs.map((i) => i.type).join(",") + ")";
const gripSigs = gripAbi.filter((f) => f.type === "function").map(sigOf).sort();
const igripSigs = igripAbi.filter((f) => f.type === "function").map(sigOf).sort();
eq("the Grip's ABI is exactly IGrip's", gripSigs.join("|"), igripSigs.join("|"));
const writes = gripAbi.filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure");
eq("every state-changing function is a token receiver", writes.length, writes.filter((f) => /^onERC(721|1155)/.test(f.name)).length);
console.log("      " + (writes.map((f) => f.name).join(", ") || "(none)"));
ok("there is no execute", !gripAbi.some((f) => f.name === "execute"));
ok("the Grip's ABI has no selector that moves an asset",
  !gripAbi.some((f) => f.type === "function" && /withdraw|sweep|rescue|transfer|send|drain|claim|execute|call/i.test(f.name || "")));
ok("there is no owner override, admin or upgrade path",
  !gripAbi.some((f) => /setOwner|admin|upgrade|initialize|delegate/i.test(f.name || "")));
ok("it says so itself", decBool(await c.read(grip, "isOneWay()")));
eq("state() is a constant zero", decUint(await c.read(grip, "state()")), 0);
ok("and it declines to advertise IERC6551Executable",
  !decBool(await c.call(grip, "0x01ffc9a7" + "51945447".padEnd(64, "0"))), "a client checking before calling execute would be misled");
eq("its ERC-1271 is a definite no", (await c.read(grip, "isValidSignature(bytes32,bytes)", ["0x" + "11".repeat(32), "0x"])).slice(0, 10), "0xffffffff");

head("so the attacks have nothing to aim at");
await c.exec(GOLD, "mint(address,uint256)", [grip, 500n * WAD]);
await c.send({ to: grip, value: 2n * WAD });
eq("the grip holds gold", decUint(await c.read(GOLD, "balanceOf(address)", [grip])), 500n * WAD);
await refuses("the holder calling execute", () =>
  buyer.exec(grip, EXEC, [GOLD, 0, enc("transfer(address,uint256)", [buyerAddr, WAD]), 0]), "the Grip has an execute after all");
await refuses("the holder calling anything that spends", () =>
  buyer.exec(grip, "withdraw(address,uint256)", [GOLD, WAD]), "the Grip has a withdraw after all");
eq("nothing moved, because nothing could", decUint(await c.read(GOLD, "balanceOf(address)", [grip])), 500n * WAD);
eq("no signer is ever valid", decUint(await c.read(grip, "isValidSigner(address,bytes)", [buyerAddr, "0x"])), 0);
head("what a buyer reads is a floor, not a snapshot");
const h = await c.read(grip, "holdings(address[])", [[GOLD]]);
eq("ether", decUint(h, 0), 2n * WAD);
console.log("      a seller has no function with which to move either number");

/*════════════════ SESSION KEYS ════════════════*/
head("a bounded key, for something that is not you");
const t3 = await mintTo(me);
const v3 = t3.vault;
await c.exec(GOLD, "mint(address,uint256)", [v3, 100n * WAD]);
const agent = "0x" + "a9e07".padStart(40, "0");
await c.fund(agent, 10n ** 18n);
const asAgent = (to, sig, args, value = 0n) => callFrom(agent, to, sig, args, value);
const day = T0 + 86400n;

await c.exec(v3, GRANT, [agent, day, WAD, [], [GOLD], [SEL_TRANSFER], 0, 0], { label: "grantSession" });
ok("the session is live", decBool(await c.read(v3, "sessionAllows(address,address,bytes4)", [agent, GOLD, SEL_TRANSFER])));
eq("and stamped with the custody epoch", decUint(await c.read(v3, "sessionOf(address)", [agent]), 2), 1);
let agentActed = false;
try { await asAgent(v3, SESSION, [GOLD, 0, enc("transfer(address,uint256)", [agent, WAD])]); agentActed = true; }
catch (e) { console.log("      " + (e.data || e.message).slice(0, 90)); }
ok("the agent can do the one thing it was granted", agentActed);
eq("and it happened", decUint(await c.read(GOLD, "balanceOf(address)", [agent])), WAD);
await refuses("a selector it was not granted", () =>
  asAgent(v3, SESSION, [GOLD, 0, enc("approve(address,uint256)", [agent, MAX])]), "the selector allowlist is not enforced");
await refuses("a target it was not granted", () =>
  asAgent(v3, SESSION, [SILVER, 0, enc("transfer(address,uint256)", [agent, WAD])]), "the target allowlist is not enforced");
await refuses("calling the account itself, to grant itself more", () =>
  asAgent(v3, SESSION, [v3, 0, enc("revokeSession(address)", [agent])]), "a session can escalate its own privilege — this is the whole game");
await refuses("granting a session at all", () =>
  asAgent(v3, GRANT, [agent, day, 0, [], [], [], 0, 0]), "a session key can mint session keys");
await refuses("sealing the vault", () => asAgent(v3, "seal(uint64)", [T0 + 1000n]), "a session can seal a vault it does not own");
await refuses("revoking every key", () => asAgent(v3, "revokeAllSessions()", []), "a session can revoke");

head("an approval names its spender in the argument, not in the target");
await c.exec(v3, GRANT, [agent, day, WAD, [], [GOLD, SILVER], [SEL_TRANSFER, SEL_APPROVE, SEL_APPROVE_ALL], 0, 0]);
await refuses("approving a spender nobody named", () =>
  asAgent(v3, SESSION, [GOLD, 0, enc("approve(address,uint256)", [agent, MAX])]), "a session with approve on an allowlisted token can approve anyone at all");
let approvedNamed = false;
try { await asAgent(v3, SESSION, [GOLD, 0, enc("approve(address,uint256)", [SILVER, WAD])]); approvedNamed = true; }
catch (e) { console.log("      " + (e.data || e.message).slice(0, 90)); }
ok("but it may approve one that was", approvedNamed);
await refuses("and setApprovalForAll is checked the same way", () =>
  asAgent(v3, SESSION, [GOLD, 0, enc("setApprovalForAll(address,bool)", [agent, true])]), "the operator argument is not checked");
const P2 = await c.deploy(A("test/mocks/Permit2ish.sol", "Permit2ish").bytecode);
await c.exec(v3, GRANT, [agent, day, 0, [], [P2, GOLD], [SEL_PERMIT2], 0, 0]);
await refuses("Permit2 names its spender second, and that is the one checked", () =>
  asAgent(v3, SESSION, [P2, 0, enc("approve(address,address,uint160,uint48)", [GOLD, agent, 1, 0])]), "the Permit2 spender is not checked");

head("the spend cap counts across the whole session, not per call");
await c.send({ to: v3, value: 10n * WAD });
await c.exec(v3, GRANT, [agent, day, 2n * WAD, [], [agent], ["0x00000000"], 0, 0]);
const agentEth0 = await c.balanceOf(agent);
await asAgent(v3, SESSION, [agent, WAD, "0x"]);
await asAgent(v3, SESSION, [agent, WAD, "0x"]);
ok("two sends inside the cap go through", (await c.balanceOf(agent)) - agentEth0 === 2n * WAD);
await refuses("the third, which would exceed it, does not", () =>
  asAgent(v3, SESSION, [agent, 1n, "0x"]), "the cap is per call rather than cumulative, so it is not a cap");
eq("the worst case reads as zero", decUint(await c.read(v3, "sessionExposure(address)", [agent]), 0), 0);
await refuses("and the session cannot raise its own cap", () =>
  asAgent(v3, GRANT, [agent, day, 100n * WAD, [], [agent], ["0x00000000"], 0, 0]), "a session key can re-grant itself");

head("an ERC-20 cap is charged by what left, through any word");
await c.exec(v3, EXEC, [GOLD, 0, enc("approve(address,uint256)", [drainer, MAX]), 0]);
await c.exec(v3, GRANT, [agent, day, 0, [[GOLD, 10n * WAD]], [GOLD, drainer], [SEL_TRANSFER, SEL_TAKE], 0, 0]);
await asAgent(v3, SESSION, [GOLD, 0, enc("transfer(address,uint256)", [agent, 6n * WAD])]);
eq("six of ten spent", decUint(await c.read(v3, "sessionExposure(address)", [agent]), 4), 4n * WAD);
await refuses("a drainer that names no amount of gold still cannot take five more", () =>
  asAgent(v3, SESSION, [drainer, 0, enc("take(address,uint256)", [GOLD, 5n * WAD])]), "the ERC-20 cap is decoded, not measured");
await asAgent(v3, SESSION, [drainer, 0, enc("take(address,uint256)", [GOLD, 4n * WAD])]);
await refuses("and the cap is exhausted", () =>
  asAgent(v3, SESSION, [GOLD, 0, enc("transfer(address,uint256)", [agent, 1n])]), "a cap that is not cumulative is not a cap");

head("the expiry is a wall the key cannot move");
await c.exec(v3, GRANT, [agent, day, 0, [], [GOLD], [SEL_TRANSFER], 0, 0]);
evm.warp(day + 1n);
ok("sessionAllows says no once it has passed", !decBool(await c.read(v3, "sessionAllows(address,address,bytes4)", [agent, GOLD, SEL_TRANSFER])));
await refuses("and the call is refused", () =>
  asAgent(v3, SESSION, [GOLD, 0, enc("transfer(address,uint256)", [agent, 1n])]), "an expired session still acts");
await refuses("a grant past a year from now is refused", () =>
  c.exec(v3, GRANT, [agent, day + 1n + 366n * 86400n, 0, [], [GOLD], [SEL_TRANSFER], 0, 0]), "a key can outlive everyone who could revoke it");
evm.warp(T0);

head("two allowlists are a cross-product, and this is what that means");
await c.exec(v3, GRANT, [agent, day, 0, [], [GOLD, SILVER], [SEL_TRANSFER, SEL_APPROVE], 0, 0]);
for (const [tName, tAddr] of [["GOLD", GOLD], ["SILVER", SILVER]]) {
  for (const [sName, sel] of [["transfer", SEL_TRANSFER], ["approve", SEL_APPROVE]]) {
    ok(`${tName} × ${sName} is allowed, whether or not that pair was intended`,
      decBool(await c.read(v3, "sessionAllows(address,address,bytes4)", [agent, tAddr, sel])));
  }
}
console.log("      a holder who wants one pair and not the other uses two keys, or a recipe");

head("a recipe is one exact call, so many times, so often");
const step = enc("transfer(address,uint256)", [me, WAD]);
const stepHash = "0x" + Buffer.from(keccak256(hexToBytes(step))).toString("hex");
await c.exec(v3, "grantRecipe(address,uint64,address,bytes32,uint256,uint32,uint32)", [agent, day, GOLD, stepHash, 0, 2, 0], { label: "grantRecipe" });
await asAgent(v3, SESSION, [GOLD, 0, step]);
await refuses("a different calldata is not the recipe", () =>
  asAgent(v3, SESSION, [GOLD, 0, enc("transfer(address,uint256)", [me, WAD + 1n])]), "the recipe hash is not checked");
await asAgent(v3, SESSION, [GOLD, 0, step]);
await refuses("the third use is refused", () => asAgent(v3, SESSION, [GOLD, 0, step]), "uses are not counted");

head("the holder takes it back");
await c.exec(v3, GRANT, [agent, day, WAD, [], [GOLD], [SEL_TRANSFER], 0, 0]);
await c.exec(v3, "revokeSession(address)", [agent], { label: "revokeSession" });
ok("revoked instantly", !decBool(await c.read(v3, "sessionAllows(address,address,bytes4)", [agent, GOLD, SEL_TRANSFER])));
await refuses("and the key is dead", () =>
  asAgent(v3, SESSION, [GOLD, 0, enc("transfer(address,uint256)", [agent, WAD])]), "revocation does not take effect");
await c.exec(v3, GRANT, [agent, day, WAD, [], [GOLD], [SEL_TRANSFER], 0, 0]);
await c.exec(v3, "revokeAllSessions()", [], { label: "revokeAllSessions" });
ok("every key, in one write", !decBool(await c.read(v3, "sessionCurrent(address)", [agent])));

head("and it never had a way to the Grip");
ok("the Grip is not on any allowlist it could be given",
  !decBool(await c.read(v3, "sessionAllows(address,address,bytes4)", [agent, t3.grip, SEL_TRANSFER])));
console.log("      and even allowlisted it would find no function that spends");

/*════════════ the measurement's blind spots, stated honestly ════════════*/
head("an asset that stops answering — the hole, not the brick");
const tb = await mintTo(me);
const bVault = tb.vault;
const BRK = await c.deploy(A("test/mocks/Breakable.sol", "Breakable").bytecode);
await c.exec(BRK, "mint(address,uint256)", [bVault, 500n * WAD]);
await c.exec(GOLD, "mint(address,uint256)", [bVault, 500n * WAD]);
await c.exec(bVault, "guard(address)", [BRK]);
await c.exec(bVault, "guard(address)", [GOLD]);
eq("nothing is unmeasurable to begin with", decUint(await c.read(bVault, "unmeasurable()"), 1), 0);
await c.exec(BRK, "setBreakBalance(bool)", [true]);
const un = await c.read(bVault, "unmeasurable()");
eq("a token that stops answering is named", decUint(un, 1), 1);
eq("and it is the right one", decAddr(un, 2).toLowerCase(), BRK.toLowerCase());
console.log("      a buyer reads unmeasurable() beside holdings(), so the gap in the promise is stated");
await c.exec(bVault, "seal(uint64)", [T0 + 10n * 86400n]);
let stillWorks = false;
try { await c.exec(bVault, EXEC, [SILVER, 0, enc("balanceOf(address)", [bVault]), 0]); stillWorks = true; } catch (e) { console.log("      " + String(e.message).slice(0, 100)); }
ok("the sealed account still acts with a blind asset on the manifest", stillWorks, "one broken token bricked the whole account — this is Dave's C1 failure");
await refuses("and the assets it can still see are still held", () =>
  c.exec(bVault, EXEC, [GOLD, 0, enc("transfer(address,uint256)", [me, WAD]), 0]), "the seal stopped holding the measurable assets too");
await refuses("and it will not poke an asset it cannot see", () =>
  c.exec(bVault, EXEC, [BRK, 0, enc("transfer(address,uint256)", [bVault, 0n]), 0]), "a blind asset can be emptied and healed in one call");

head("going blind during a call is refused, not shrugged at");
const TRAP = await c.deploy(A("test/mocks/Trap.sol", "Trap").bytecode);
const tt = await mintTo(me);
await c.exec(TRAP, "mint(address,uint256)", [tt.vault, 5n * WAD]);
await c.exec(tt.vault, "guard(address)", [TRAP]);
await c.exec(tt.vault, "seal(uint64)", [T0 + 10n * 86400n]);
await c.exec(TRAP, "arm(address)", [tt.vault]);
await refuses("a call that ends with an asset unreadable", () =>
  c.exec(tt.vault, EXEC, [SILVER, 0, enc("balanceOf(address)", [tt.vault]), 0]), "an account could be walked into blindness inside a sealed call");

head("a blind asset can be let go of; a visible one cannot");
let released = false;
try { await c.exec(bVault, "unguard(address)", [BRK]); released = true; } catch (e) { console.log("      " + String(e.message).slice(0, 90)); }
ok("a token that stopped answering can be released mid-seal", released, "the account is trapped with an asset it can neither see nor remove");
await refuses("while the ones it CAN see stay exactly where they are", () =>
  c.exec(bVault, "unguard(address)", [GOLD]), "the manifest could be emptied instead of the vault — the whole promise");
await c.exec(BRK, "setBreakBalance(bool)", [false]);

head("the manifest is not append-only forever");
const tu = await mintTo(me);
await c.exec(tu.vault, "guard(address)", [GOLD]);
await c.exec(tu.vault, "unguard(address)", [GOLD], { label: "unguard" });
eq("it can be taken off while unsealed", decUint(await c.read(tu.vault, "manifest()"), 1), 0);
await c.exec(tu.vault, "guard(address)", [GOLD]);
await c.exec(tu.vault, "seal(uint64)", [T0 + 10n * 86400n]);
await refuses("while sealed, nobody may take one off", () => c.exec(tu.vault, "unguard(address)", [GOLD]), "the manifest could be emptied instead of the vault");

head("a batch is one act or none");
const tbt = await mintTo(me);
const btV = tbt.vault;
await c.exec(GOLD, "mint(address,uint256)", [btV, 100n * WAD]);
await c.exec(SILVER, "mint(address,uint256)", [btV, 100n * WAD]);
await c.exec(btV, BATCH, [[[GOLD, 0n, enc("transfer(address,uint256)", [me, WAD])], [SILVER, 0n, enc("transfer(address,uint256)", [me, WAD])]]], { label: "executeBatch" });
eq("two calls landed in one act", decUint(await c.read(GOLD, "balanceOf(address)", [btV])), 99n * WAD);
await refuses("an empty batch is refused outright", () => c.exec(btV, BATCH, [[]]), "an empty batch advanced the state with no authorisation (ANIMA main)");
await c.exec(btV, "guard(address)", [GOLD]);
await c.exec(btV, "seal(uint64)", [T0 + 10n * 86400n]);
await refuses("a sealed batch that ends poorer", () =>
  c.exec(btV, BATCH, [[[GOLD, 0n, enc("transfer(address,uint256)", [me, WAD])], [SILVER, 0n, enc("transfer(address,uint256)", [me, WAD])]]]), "the measurement does not wrap the batch");
await refuses("and an approval anywhere inside it", () =>
  c.exec(btV, BATCH, [[[SILVER, 0n, enc("transfer(address,uint256)", [me, WAD])], [GOLD, 0n, enc("approve(address,uint256)", [me, MAX])]]]), "an approval slipped through a batch");
let dipped = false;
try {
  await c.exec(btV, BATCH, [[[GOLD, 0n, enc("transfer(address,uint256)", [drainer, WAD])], [drainer, 0n, enc("give(address,address,uint256)", [GOLD, btV, WAD])]]]);
  dipped = true;
} catch (e) { console.log("      " + String(e.message).slice(0, 110)); }
ok("but a batch that dips and comes back whole goes through", dipped, "per-call measurement would refuse the ordinary shape of real work");

/*════════════ the voice: ERC-7739 attestations ════════════*/
const signHash = (h) => {
  const sig = secp256k1.sign(hexToBytes(h), c.key);
  return "0x" + sig.toCompactHex() + (27 + sig.recovery).toString(16).padStart(2, "0");
};
const envelope = (purpose, payload, deadline, sig) => "0x" + encodeParams("string,bytes32,uint64,bytes", [purpose, payload, deadline, sig]);

head("a sealed vault can say who it is, and cannot promise what it holds");
const rawHash = "0x" + "11".repeat(32);
eq("a raw hash gets nothing while sealed",
  (await c.read(btV, "isValidSignature(bytes32,bytes)", [rawHash, "0x" + "22".repeat(65)])).slice(0, 10), "0xffffffff");
const PURPOSE = "i am the token that holds this";
const PAYLOAD = "0x" + "ab".repeat(32);
const DEADLINE = T0 + 3600n;
const digest = await c.read(btV, "attestationDigest(string,bytes32,uint64)", [PURPOSE, PAYLOAD, DEADLINE]);
const env1 = envelope(PURPOSE, PAYLOAD, DEADLINE, signHash(digest));
eq("but it validates the one digest it can rebuild",
  (await c.read(btV, "isValidSignature(bytes32,bytes)", [digest, env1])).slice(0, 10), "0x1626ba7e");
eq("a well-formed envelope over a different hash is refused",
  (await c.read(btV, "isValidSignature(bytes32,bytes)", [rawHash, env1])).slice(0, 10), "0xffffffff");
eq("and the payload itself is refused while sealed — a venue's order hash can never be the digest",
  (await c.read(btV, "isValidSignature(bytes32,bytes)", [PAYLOAD, env1])).slice(0, 10), "0xffffffff");
eq("garbage is a plain no rather than a revert",
  (await c.read(btV, "isValidSignature(bytes32,bytes)", [rawHash, "0xdeadbeef"])).slice(0, 10), "0xffffffff");
head("and it can take it back");
const past = await c.read(btV, "attestationDigest(string,bytes32,uint64)", [PURPOSE, PAYLOAD, T0 - 1n]);
eq("an expired attestation is refused",
  (await c.read(btV, "isValidSignature(bytes32,bytes)", [past, envelope(PURPOSE, PAYLOAD, T0 - 1n, signHash(past))])).slice(0, 10), "0xffffffff");
await c.exec(btV, "retireAttestations()", [], { label: "retireAttestations" });
eq("and one bump retires every signature the account ever gave",
  (await c.read(btV, "isValidSignature(bytes32,bytes)", [digest, env1])).slice(0, 10), "0xffffffff");
const fresh = await c.read(btV, "attestationDigest(string,bytes32,uint64)", [PURPOSE, PAYLOAD, DEADLINE]);
ok("the same statement re-signed after the bump is a different digest", fresh !== digest);
eq("and that one is honoured",
  (await c.read(btV, "isValidSignature(bytes32,bytes)", [fresh, envelope(PURPOSE, PAYLOAD, DEADLINE, signHash(fresh))])).slice(0, 10), "0x1626ba7e");

head("unsealed, it stands behind a hash it was asked about — as a Safe owner");
const ts = await mintTo(me);
const SAFE = await c.deploy(A("test/mocks/SafeLike.sol", "SafeLike").bytecode, encodeParams("address", [ts.vault]));
const txHash = await c.read(SAFE, "getTransactionHash(address,uint256,bytes,uint8,uint256)", [hub, 0, enc("minted()", []), 0, 0]);
const txData = "0x" + (await c.read(SAFE, "encodeTransactionData(address,uint256,bytes,uint8,uint256)", [hub, 0, enc("minted()", []), 0, 0])).replace(/^0x/, "").slice(128, 128 + 132);
const sd = await c.read(ts.vault, "attestationDigest(string,bytes32,uint64)", ["safe-owner", txHash, DEADLINE]);
const senv = envelope("safe-owner", txHash, DEADLINE, signHash(sd));
const csig = "0x" + (await c.read(SAFE, "contractSignature(address,bytes)", [ts.vault, senv])).replace(/^0x/, "").slice(128).slice(0, 2 * Number(decUint(await c.read(SAFE, "contractSignature(address,bytes)", [ts.vault, senv]), 1)));
eq("the Reach answers 0x1626ba7e for the Safe's own transaction hash",
  (await c.read(ts.vault, "isValidSignature(bytes32,bytes)", [txHash, senv])).slice(0, 10), "0x1626ba7e");
eq("and 0x20c13b0b through the legacy shape Safe 1.4.1 uses",
  (await c.read(ts.vault, "isValidSignature(bytes,bytes)", [txData, senv])).slice(0, 10), "0x20c13b0b");
let safeOk = false;
try { await c.exec(SAFE, "execTransaction(address,uint256,bytes,bytes)", [hub, 0, enc("minted()", []), csig], { label: "safe.execTransaction" }); safeOk = true; }
catch (e) { console.log("      " + String(e.message).slice(0, 120)); }
ok("a Safe 1.4.1 accepts the Reach as an owner", safeOk);
await refuses("and the same signature cannot be replayed against the next nonce", () =>
  c.exec(SAFE, "execTransaction(address,uint256,bytes,bytes)", [hub, 0, enc("minted()", []), csig]), "a contract signature replayed");
await c.exec(ts.vault, "seal(uint64)", [T0 + 86400n]);
eq("sealed, the same envelope no longer stands behind the Safe's hash",
  (await c.read(ts.vault, "isValidSignature(bytes32,bytes)", [txHash, senv])).slice(0, 10), "0xffffffff");

/*════════════ the manifest, moved out from under the measurement ════════════*/
head("the manifest cannot move while a call is in flight");
{
  const breaker = await c.deploy(A("test/mocks/SealBreaker.sol", "SealBreaker").bytecode);
  await c.send({ to: breaker, value: WAD });
  await c.exec(breaker, "setup(address,address,address)", [hub, BRK, GOLD]);
  const bad = decAddr(await c.read(breaker, "acct()"));
  await c.exec(GOLD, "mint(address,uint256)", [bad, 1000n * WAD]);
  await c.exec(BRK, "mint(address,uint256)", [bad, 5n * WAD]);
  await c.exec(breaker, "sealIt(uint64)", [T0 + 30n * 86400n]);
  eq("a contract holder sealed a vault over two assets", decUint(await c.read(bad, "manifest()"), 1), 2);
  await refuses("with both assets readable the re-entered unguard is refused", () => c.exec(breaker, "drain(address,uint256,address)", [GOLD, 100n * WAD, me]));
  await c.exec(BRK, "setBreakBalance(bool)", [true]);
  eq("one asset is now unmeasurable, and says so publicly", decUint(await c.read(bad, "unmeasurable()"), 1), 1);
  await refuses("and a batch that unguards the blind one mid-flight is refused too",
    () => c.exec(breaker, "drain(address,uint256,address)", [GOLD, 1000n * WAD, me]), "a sealed vault was emptied by renumbering its manifest inside the call being measured");
  eq("the gold never moved", decUint(await c.read(GOLD, "balanceOf(address)", [bad])), 1000n * WAD);
  eq("and the manifest is intact", decUint(await c.read(bad, "manifest()"), 1), 2);
  await c.exec(BRK, "setBreakBalance(bool)", [false]);
}

head("a guarded piece cannot be dropped from inside the call that moves it");
{
  const tp = await mintTo(me);
  const v = tp.vault;
  const PUNK = await c.deploy(A("test/mocks/MockERC721.sol", "MockERC721").bytecode);
  await c.exec(PUNK, "mint(address,uint256)", [v, 7n]);
  await c.exec(v, "guardNFT(address,uint256)", [PUNK, 7n]);
  await c.exec(v, "seal(uint64)", [T0 + 30n * 86400n]);
  eq("one named piece is under the seal", decUint(await c.read(v, "pieces()"), 1), 1);
  const inner = enc("transferFrom(address,address,uint256)", [v, me, 7n]);
  await refuses("the piece cannot simply be sent away", () => c.exec(v, EXEC, [PUNK, 0n, inner, 0n]));
  await refuses("nor moved and then quietly dropped from the list in one batch",
    () => c.exec(v, BATCH, [[[PUNK, 0n, inner], [v, 0n, enc("unguardNFT(uint256)", [0n])]]]), "the whole promise of guarding a named piece, defeated in two calls");
  eq("the piece is still held by the vault", decAddr(await c.read(PUNK, "ownerOf(uint256)", [7n])).toLowerCase(), v.toLowerCase());
  eq("and still named by it", decUint(await c.read(v, "pieces()"), 1), 1);
}

/*════════════ a key does not survive the sale of what it spends from ════════*/
head("a session key does not survive the sale");
{
  const t = await mintTo(me);
  const v = t.vault;
  await c.exec(GOLD, "mint(address,uint256)", [v, 100n * WAD]);
  const bot = await asOther("0x" + "7e".repeat(32));
  const key = bot.from.toString();
  const move = enc("transfer(address,uint256)", [me, WAD]);
  await c.exec(v, GRANT, [key, T0 + 300n * 86400n, 0n, [], [GOLD], [SEL_TRANSFER], 0, 0]);
  ok("the key is granted and current", decBool(await c.read(v, "sessionAllows(address,address,bytes4)", [key, GOLD, SEL_TRANSFER])));
  await bot.exec(v, SESSION, [GOLD, 0n, move]);
  eq("and it spends", decUint(await c.read(GOLD, "balanceOf(address)", [v])), 99n * WAD);
  const b2 = await asOther("0x" + "b2".repeat(32));
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, b2.from.toString(), t.id]);
  eq("the Reach follows the token", decAddr(await c.read(v, "owner()")).toLowerCase(), b2.from.toString().toLowerCase());
  await refuses("the seller's key cannot spend from the buyer's Reach", () => bot.exec(v, SESSION, [GOLD, 0n, move]),
    "a key granted before the sale kept spending for up to a year afterwards");
  eq("not one wei moved", decUint(await c.read(GOLD, "balanceOf(address)", [v])), 99n * WAD);
  ok("and the page-facing read says so rather than showing it as live",
    !decBool(await c.read(v, "sessionAllows(address,address,bytes4)", [key, GOLD, SEL_TRANSFER])));
  ok("`sessionCurrent` names the reason", !decBool(await c.read(v, "sessionCurrent(address)", [key])));
  await b2.exec(hub, "transferFrom(address,address,uint256)", [b2.from.toString(), me, t.id]);
  eq("the token comes back to the one who granted it", decAddr(await c.read(hub, "ownerOf(uint256)", [t.id])).toLowerCase(), me.toLowerCase());
  await refuses("and the retired key stays retired", () => bot.exec(v, SESSION, [GOLD, 0n, move]),
    "an identity check would have woken every key the seller ever granted");
  await c.exec(v, GRANT, [key, T0 + 300n * 86400n, 0n, [], [GOLD], [SEL_TRANSFER], 0, 0]);
  await refuses("a key granted after a sale waits for the holder to re-arm the token", () => bot.exec(v, SESSION, [GOLD, 0n, move]),
    "a sale paused the token and its keys still act");
  await c.exec(hub, "setStatus(uint256,uint8)", [t.id, 0]);
  await bot.exec(v, SESSION, [GOLD, 0n, move]);
  eq("a key granted by the holder who holds it now works", decUint(await c.read(GOLD, "balanceOf(address)", [v])), 98n * WAD);

  head("and panic kills every key and seals to the maximum, in one call");
  await c.exec(hub, "panic(uint256)", [t.id], { label: "panic" });
  ok("the key is gone", !decBool(await c.read(v, "sessionCurrent(address)", [key])));
  eq("the seal stands at its cap", decUint(await c.read(v, "sealedUntil()")), T0 + 365n * 86400n);
  await refuses("and nothing a stranger can do revives it", () => bot.exec(v, SESSION, [GOLD, 0n, move]));
}

/*════════════ the open-approval ledger ════════════*/
head("the ledger: what MAY leave, written down and taken back in one call");
{
  const t = await mintTo(me);
  const v = t.vault;
  await c.exec(GOLD, "mint(address,uint256)", [v, 100n * WAD]);
  eq("empty to begin with", decUint(await c.read(v, "openApprovalsRoot()")), 0);
  await c.exec(v, EXEC, [P2, 0n, enc("approve(address,address,uint160,uint48)", [GOLD, agent, 100n, 0n]), 0n]);
  await c.exec(v, EXEC, [GOLD, 0n, enc("approve(address,uint256)", [agent, 5n]), 0n]);
  const list = await c.read(v, "openApprovals()");
  eq("Permit2's approve and a plain approve are two entries", decUint(list, 1), 2);
  eq("the Permit2 entry names the token, not Permit2", decAddr(list, 2).toLowerCase(), GOLD.toLowerCase());
  const root = await c.read(v, "openApprovalsRoot()");
  ok("the root moved, so the fingerprint moves", decUint(root) !== 0n);
  const HOSTILE = await c.deploy(A("test/mocks/HostileToken.sol", "HostileToken").bytecode);
  await c.exec(v, EXEC, [HOSTILE, 0n, enc("approve(address,uint256)", [agent, 1n]), 0n]);
  await c.exec(HOSTILE, "setMode(uint8)", [1]);
  await c.exec(v, "revokeOpenApprovals()", [], { label: "revokeOpenApprovals" });
  eq("a reverting asset does not block the others: one entry left", decUint(await c.read(v, "openApprovals()"), 1), 1);
  eq("Permit2's allowance was zeroed through Permit2", decUint(await c.read(P2, "allowance(address,address)", [v, agent])), 0);
  eq("the plain allowance was zeroed", decUint(await c.read(GOLD, "allowance(address,address)", [v, agent])), 0);
  await c.exec(HOSTILE, "setMode(uint8)", [0]);
  await c.exec(v, "revokeOpenApprovals()", []);
  eq("and once the token answers, it is cleared too", decUint(await c.read(v, "openApprovals()"), 1), 0);
}

/*════════════ executeTyped: exactly this for at least that ════════════*/
head("executeTyped drives a swap with a receive floor");
{
  const t = await mintTo(me);
  const v = t.vault;
  const VENUE = await c.deploy(A("test/mocks/MockVenue.sol", "MockVenue").bytecode);
  await c.exec(GOLD, "mint(address,uint256)", [v, 100n * WAD]);
  await c.exec(SILVER, "mint(address,uint256)", [VENUE, 100n * WAD]);
  const swap = (out_) => enc("swap(address,uint256,address,uint256)", [GOLD, 10n * WAD, SILVER, out_]);
  await refuses("a venue that under-delivers is caught by the floor", () =>
    c.exec(v, TYPED, [[VENUE, 0n, swap(9n * WAD), [[GOLD, 10n * WAD]], [[SILVER, 10n * WAD]], T0 + 60n]]), "the receive floor is not enforced");
  eq("and nothing left", decUint(await c.read(GOLD, "balanceOf(address)", [v])), 100n * WAD);
  await c.exec(v, TYPED, [[VENUE, 0n, swap(10n * WAD), [[GOLD, 10n * WAD]], [[SILVER, 10n * WAD]], T0 + 60n]], { label: "executeTyped" });
  eq("exactly this for at least that", decUint(await c.read(SILVER, "balanceOf(address)", [v])), 10n * WAD);
  eq("no allowance survives the call", decUint(await c.read(GOLD, "allowance(address,address)", [v, VENUE])), 0);
  await refuses("a stale deadline is refused", () =>
    c.exec(v, TYPED, [[VENUE, 0n, swap(10n * WAD), [[GOLD, 10n * WAD]], [[SILVER, 10n * WAD]], T0 - 1n]]), "the deadline is decorative");
  await c.exec(v, GRANT, [agent, day, 0n, [[GOLD, 10n * WAD]], [VENUE], [enc("swap(address,uint256,address,uint256)", [GOLD, 0n, SILVER, 0n]).slice(0, 10)], 0, 0]);
  await asAgent(v, TYPED, [[VENUE, 0n, swap(10n * WAD), [[GOLD, 10n * WAD]], [[SILVER, 10n * WAD]], T0 + 60n]]);
  eq("a session drives the same shape, under its caps", decUint(await c.read(SILVER, "balanceOf(address)", [v])), 20n * WAD);
  await refuses("and the cap is charged by the swap", () =>
    asAgent(v, TYPED, [[VENUE, 0n, swap(10n * WAD), [[GOLD, 10n * WAD]], [[SILVER, 10n * WAD]], T0 + 60n]]), "an executeTyped swap escaped the session's cap");
}

/*════════════ the frozen layout ════════════*/
head("the storage layout is the code forever");
{
  const l = layout();
  const doc = fs.existsSync(path.join(ROOT, "docs/ACCOUNTS.md")) ? fs.readFileSync(path.join(ROOT, "docs/ACCOUNTS.md"), "utf8") : "";
  const m = doc.match(/layout hash:\s*`([0-9a-f]{64})`/);
  ok("docs/ACCOUNTS.md records a layout hash", !!m);
  eq("and it is this compiler's layout of this source", m ? m[1] : "(none)", l.hash);
  ok("sixteen slots are reserved at the end", /\d+ 0 __gap t_array\(t_uint256\)16_storage/.test(l.text));
  ok("the Session struct is eight slots", /type t_struct\(Session\)_storage 256/.test(l.text));
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
