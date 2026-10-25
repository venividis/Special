#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · memories written into a token, on the real site

  V2 unit W2, NEW (docs/V2.md §3.2; src/interfaces/IJournal.sol).

  `test/Journal.t.sol` checks what the contract stores, against a fixture
  hub. This checks the Journal beside the site as it deploys (tools/site.mjs
  `deploySite`: the diamond, every token's Reach the real 173-byte forwarder
  behind the canonical ERC-6551 registry, the KeyRegistry), and it checks
  the thing the root exists for: that a reader holding nothing but the
  `Inscribed` logs folds them into the root the contract stores. The fold
  below is a second implementation of the formula, in JavaScript, written
  from IJournal's comment; if it and the contract ever disagree, one of
  them is wrong in a way neither could report alone.

  The sealed memory is a real one: a P-256 envelope made by the console's
  own module (engine/whispers.mjs), sealed to the key the holder published
  in the KeyRegistry, under a journal context of its own, and opened again
  from the log by the holder — and not by the buyer's key after the sale.

  Gas is measured on this run and printed with the check that took it:
  `rootOf` as an `eth_call` and from a contract with the Journal cold (the
  read the hub's fingerprint will make, V2 W6), and `inscribe` at 100 B,
  1,024 B plain and 4,096 B sealed, as a page's first memory and a later one.

    node tools/build-app.mjs        once: deploySite reads dist/shards.json
    node tools/verify-journal.mjs
───────────────────────────────────────────────────────────────────────────*/
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { compile, artifact } from "./compile.mjs";
import { Chain, enc, sel, decUint, decAddr, decBool, encodeParams, BLOCK } from "./evm.mjs";
import { deploySite, mint } from "./site.mjs";
import { createMessagingKey, encryptWhisper, decryptWhisper, publicHex, hexPublic } from "../engine/whispers.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${detail}`);
};
const eq = (name, got, want) => ok(name, String(got) === String(want), `got ${got}\n      want ${want}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);

/// A call that must fail, and fail for the stated reason: a refusal that
/// cannot name its error is a refusal that might be the harness's.
const refuses = async (name, fn, error) => {
  let threw = false, why = "";
  try { await fn(); } catch (e) { threw = true; why = String(e.message || e); }
  const right = !error || why.includes(sel(error).slice(2));
  ok(name, threw && right, threw ? `reverted, but not with ${error}: ${why.slice(0, 160)}` : "it went through");
};

const lc = (a) => String(a).toLowerCase();
const hexOf = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
const kec = (hex) => "0x" + Buffer.from(keccak256(Buffer.from(String(hex).replace(/^0x/, ""), "hex"))).toString("hex");
const word = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");
const wordOf = (a) => "0x" + lc(a).replace(/^0x/, "").padStart(64, "0");
const filled = (n) => "0x" + Buffer.from(Array.from({ length: n }, (_, i) => 0x61 + (i % 26))).toString("hex");
const bytesAt = (hex, i) => {
  const h = hex.replace(/^0x/, "");
  const off = Number(BigInt("0x" + h.substr(i * 64, 64))) * 2;
  const len = Number(BigInt("0x" + h.substr(off, 64)));
  return "0x" + h.substr(off + 64, len * 2);
};
const ZERO32 = "0x" + "00".repeat(32);
const KIND = { NOTE: 0, TRADE: 1, GIFT: 2, MILESTONE: 3, SEALED: 4 };
const INSCRIBE = "inscribe(address,uint256,uint8,bytes,bytes32)";
const INSCRIBED = kec(hexOf("Inscribed(address,uint256,uint256,uint8,address,uint64,bytes32,bytes32,bytes)"));

console.log("\n  \x1b[1mINTACT · memories written into a token\x1b[0m");

/*──────────────── stand it up ────────────────*/
head("the site, and a journal beside it");
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const alice = c;                                         // mints #1, the holder
const bob = await c.as("0x" + "b0".repeat(32));          // the renter
const carol = await c.as("0x" + "ca".repeat(32));        // the approved address
const dave = await c.as("0x" + "da".repeat(32));         // the operator
const erin = await c.as("0x" + "e1".repeat(32));         // the buyer
const frank = await c.as("0x" + "f0".repeat(32));        // a foreign collection's holder
const who = (actor) => lc(actor.from.toString());

const site = await deploySite(c, out);
const hub = lc(site.hub);
const journal = lc(await c.deploy(A("src/Journal.sol", "Journal").bytecode, encodeParams("address", [hub]), "Journal"));
const runtime = A("src/Journal.sol", "Journal").deployed.length / 2 - 1;
eq(`the Journal is deployed beside the real site (runtime ${runtime} B), and its HUB is the site's diamond`,
   lc(decAddr(await c.read(journal, "HUB()"))), hub);
{
  const ev = A("src/Journal.sol", "Journal").abi.find((x) => x.type === "event" && x.name === "Inscribed");
  const sig = ev && `Inscribed(${ev.inputs.map((i) => i.type).join(",")})`;
  eq("the topic the reader filters by is the keccak of the Inscribed event the Journal's ABI declares",
     sig && kec(hexOf(sig)), INSCRIBED);
}
{
  const kinds = [];
  for (const k of ["NOTE()", "TRADE()", "GIFT()", "MILESTONE()", "SEALED()"]) kinds.push(decUint(await c.read(journal, k)));
  const plain = decUint(await c.read(journal, "MAX_PLAIN()"));
  const sealed = decUint(await c.read(journal, "MAX_SEALED()"));
  ok("the kinds read NOTE 0, TRADE 1, GIFT 2, MILESTONE 3, SEALED 4, and the bounds 1,024 plain and 4,096 sealed",
     kinds.join(",") === "0,1,2,3,4" && plain === 1024n && sealed === 4096n, `${kinds} / ${plain} / ${sealed}`);
}
const { id: one } = await mint(c, site, who(alice));
eq("token #1 is minted to the holder, its id read from the Transfer log", one, 1n);
const reach = lc(decAddr(await c.read(hub, "account(uint256)", [one])));
eq("its Reach is the real forwarder (173 bytes of code)", await c.codeSize(reach), 173);

/*──────────────── reading, as a page does ────────────────*/
const countOf = async (col, id) => decUint(await c.read(journal, "countOf(address,uint256)", [col, id]));
const rootOf = async (col, id) => lc(await c.read(journal, "rootOf(address,uint256)", [col, id]));
const may = async (col, id, addr) => decBool(await c.read(journal, "mayInscribe(address,uint256,address)", [col, id, addr]));
const epochOf = async (id) => decUint(await c.read(hub, "custodyEpoch(uint256)", [id]));
const write = (actor, col, id, kind, body, ref = ZERO32, label = "inscribe") =>
  actor.exec(journal, INSCRIBE, [col, id, kind, body, ref], { label });

/// One `Inscribed` log as a reader with no ABI library sees it: three
/// topics, then (kind, author, epoch, ref, root, offset) and the body.
const decode = (log) => {
  const d = log.data.replace(/^0x/, "");
  const at = (i) => d.slice(i * 64, i * 64 + 64);
  const off = Number(BigInt("0x" + at(5))) * 2;
  const len = Number(BigInt("0x" + d.slice(off, off + 64)));
  return {
    collection: "0x" + log.topics[1].slice(26), id: BigInt(log.topics[2]), n: BigInt(log.topics[3]),
    kind: Number(BigInt("0x" + at(0))), author: "0x" + at(1).slice(24), epoch: BigInt("0x" + at(2)),
    ref: "0x" + at(3), root: "0x" + at(4), body: "0x" + d.slice(off + 64, off + 64 + len * 2), tx: log.transactionHash
  };
};
const memories = (col, id) =>
  c.getLogs({ address: journal, topics: [INSCRIBED, wordOf(col), word(id)] }).map(decode);

/// The formula, the second time: root' = keccak256(abi.encode(root, n,
/// kind, keccak256(body), ref, author, epoch)).
const fold = (root, m) => kec(encodeParams("bytes32,uint256,uint8,bytes32,bytes32,address,uint64",
  [root, m.n, m.kind, kec(m.body), m.ref, m.author, m.epoch]));
const replay = (logs) => logs.reduce((r, m) => fold(r, m), ZERO32);

/*──────────────── the holder ────────────────*/
head("the holder writes into #1, plain and sealed");
ok("mayInscribe names the holder", await may(hub, one, who(alice)));
const first = await write(alice, hub, one, KIND.NOTE, hexOf("minted on a quiet morning; the first thing it saw was the commons"));
eq("the holder's plain memory is number 1", decUint(first.ret), 1n);

const aliceKey = await createMessagingKey(1);
await alice.exec(site.keys, "setEncryptionKey(uint16,bytes)", [3, publicHex(aliceKey)], { label: "setEncryptionKey" });
const published = await c.read(site.keys, "getPublicKeys(address)", [who(alice)]);
eq("the holder's P-256 key is published in the KeyRegistry as type 3", decUint(published, 0), 3n);
/*  The sealing client re-reads the key from the registry before it seals,
    as the console does before every encryption, and binds the envelope to
    a journal context of its own — never "intact-whisper/1" — so a whisper
    replayed as a memory, or a memory replayed into another token or
    custody, fails to open.                                              */
const context = ["intact-journal/1", "1", hub, journal, String(one), String(await epochOf(one)), aliceKey.version];
/*  A letter to oneself of about 730 bytes: its envelope (two copies, a
    point, a salt, the context) is past a plain body's 1,024 and inside the
    sealed 4,096, which is the case the second bound exists for.         */
const secret = Array.from({ length: 14 }, (_, i) => `${i + 1}. what I paid for it, and why I will never sell it.`).join(" ");
const sealedKey = hexPublic(bytesAt(published, 1));
const envelope = await encryptWhisper(context, secret, sealedKey, sealedKey);
const sealedBody = hexOf(JSON.stringify(envelope));
const sealedLen = (sealedBody.length - 2) / 2;
const second = await write(alice, hub, one, KIND.SEALED, sealedBody);
eq(`the holder's sealed memory, a ${sealedLen} B P-256 envelope to the holder's own key, is number 2`, decUint(second.ret), 2n);
ok("the sealed envelope is longer than a plain body may be and within the sealed bound", sealedLen > 1024 && sealedLen <= 4096, `${sealedLen} B`);
const sealedLog = memories(hub, one).find((m) => m.n === 2n);
const sealedEnvelope = JSON.parse(Buffer.from(sealedLog.body.slice(2), "hex").toString("utf8"));
eq("the holder opens it again from the log alone", await decryptWhisper(sealedEnvelope, context, aliceKey), secret);
ok("and its words appear in no log",
   !c.log.some((l) => Buffer.from(l.data.replace(/^0x/, ""), "hex").toString("utf8").includes("never sell it")));

/*──────────────── the token ────────────────*/
head("the token writes for itself");
ok("mayInscribe names the token's Reach", await may(hub, one, reach));
const viaReach = await alice.exec(reach, "execute(address,uint256,bytes,uint8)",
  [journal, 0, enc(INSCRIBE, [hub, one, KIND.MILESTONE, hexOf("the token wrote this itself"), kec(hexOf("a month old"))]), 0],
  { label: "Reach.execute(inscribe)" });
const third = memories(hub, one).find((m) => m.n === 3n);
eq("the token's Reach writes memory 3 through Reach.execute, and its log names the Reach as the author", third && third.author, reach);
const batch = await alice.exec(reach, "executeBatch((address,uint256,bytes)[])", [[
  [journal, 0, enc(INSCRIBE, [hub, one, KIND.NOTE, hexOf("two memories in one breath"), ZERO32])],
  [journal, 0, enc(INSCRIBE, [hub, one, KIND.GIFT, hexOf("and the second"), ZERO32])]
]], { label: "Reach.executeBatch(inscribe x2)" });
{
  const pair = memories(hub, one).filter((m) => m.n === 4n || m.n === 5n);
  ok("two memories land in one Reach.executeBatch, in one transaction: the lock is released between them",
     pair.length === 2 && pair.every((m) => m.tx === batch.hash && m.author === reach), pair.map((m) => `${m.n} in ${m.tx}`).join(", "));
}

/*──────────────── hands that are not the holder's ────────────────*/
head("a renter, an approved address and an operator hold no pen");
await alice.exec(hub, "setUser(uint256,address,uint64)", [one, who(bob), BLOCK.header.timestamp + 86400n]);
eq("the lease takes: userOf names the renter", lc(decAddr(await c.read(hub, "userOf(uint256)", [one]))), who(bob));
ok("mayInscribe does not name the renter", !(await may(hub, one, who(bob))));
await refuses("the renter's inscribe is refused NotYours",
  () => write(bob, hub, one, KIND.NOTE, hexOf("I am renting this")), "NotYours()");
await alice.exec(hub, "approve(address,uint256)", [who(carol), one]);
eq("the approval takes: getApproved names the approved address", lc(decAddr(await c.read(hub, "getApproved(uint256)", [one]))), who(carol));
await refuses("the approved address's inscribe is refused NotYours",
  () => write(carol, hub, one, KIND.NOTE, hexOf("I may move it")), "NotYours()");
await alice.exec(hub, "setApprovalForAll(address,bool)", [who(dave), true]);
ok("the operator approval takes", decBool(await c.read(hub, "isApprovedForAll(address,address)", [who(alice), who(dave)])));
await refuses("the operator's inscribe is refused NotYours",
  () => write(dave, hub, one, KIND.NOTE, hexOf("I may move them all")), "NotYours()");
eq("and none of the three was counted", await countOf(hub, one), 5n);

/*──────────────── the archive ────────────────*/
head("the logs are the archive: folded in JavaScript, they are the root");
{
  const logs = memories(hub, one);
  eq("countOf equals the number of Inscribed logs for the token", await countOf(hub, one), BigInt(logs.length));
  ok("the logs number the memories 1..n with no gap", logs.every((m, i) => m.n === BigInt(i + 1)), logs.map((m) => m.n).join(","));
  ok("every log carries the root after its memory, folded from the root before it",
     logs.every((m, i) => m.root === fold(i ? logs[i - 1].root : ZERO32, m)));
  eq("the root recomputed in JavaScript from the Inscribed logs equals rootOf", replay(logs), await rootOf(hub, one));
  ok("every memory before the sale carries epoch 1", logs.every((m) => m.epoch === 1n));
}

/*──────────────── a sale ────────────────*/
head("a sale moves the pen and the epoch");
await alice.exec(hub, "transferFrom(address,address,uint256)", [who(alice), who(erin), one], { label: "sale" });
eq("the sale moves the hub's custody epoch to 2", await epochOf(one), 2n);
await refuses("the seller's inscribe after the sale is refused NotYours",
  () => write(alice, hub, one, KIND.NOTE, hexOf("still mine")), "NotYours()");
await write(erin, hub, one, KIND.TRADE, hexOf("bought it for the story"), kec(hexOf("the sale of #1")));
{
  const m = memories(hub, one).at(-1);
  ok("the buyer writes memory 6, and its log carries epoch 2 and the buyer as author",
     m.n === 6n && m.epoch === 2n && m.author === who(erin), JSON.stringify({ n: String(m.n), epoch: String(m.epoch), author: m.author }));
}
await erin.exec(reach, "execute(address,uint256,bytes,uint8)",
  [journal, 0, enc(INSCRIBE, [hub, one, KIND.NOTE, hexOf("the token, for its new holder"), ZERO32]), 0]);
{
  const m = memories(hub, one).at(-1);
  ok("the token's Reach, driven by the buyer, writes memory 7 under epoch 2", m.n === 7n && m.epoch === 2n && m.author === reach);
}
eq("the root still replays from the logs across the sale", replay(memories(hub, one)), await rootOf(hub, one));
{
  const erinKey = await createMessagingKey(1);
  let opened = null;
  try { opened = await decryptWhisper(sealedEnvelope, context, erinKey); } catch { opened = null; }
  ok("the buyer's own key does not open the seller's sealed memory", opened === null);
  eq("while the seller's still does", await decryptWhisper(sealedEnvelope, context, aliceKey), secret);
}

/*──────────────── any ERC-721 ────────────────*/
head("any ERC-721 has a journal");
const mock = lc(await c.deploy(A("test/mocks/MockERC721.sol", "MockERC721").bytecode, "", "MockERC721"));
await c.exec(mock, "mint(address,uint256)", [who(frank), 1]);
{
  const hubCount = await countOf(hub, one), hubRoot = await rootOf(hub, one);
  ok("mayInscribe names the foreign token's holder, and not the hub token #1's", (await may(mock, 1, who(frank))) && !(await may(mock, 1, who(erin))));
  await write(frank, mock, 1, KIND.GIFT, hexOf("a token from elsewhere remembers too"));
  const fm = memories(mock, 1);
  ok("a MockERC721 token's holder writes memory 1 into that collection's namespace, under epoch 0",
     fm.length === 1 && fm[0].n === 1n && fm[0].epoch === 0n && fm[0].author === who(frank) && fm[0].collection === mock);
  eq("whose root replays from its own logs", replay(fm), await rootOf(mock, 1));
  ok("and the hub's token #1, the same id, kept its count and its root", (await countOf(hub, one)) === hubCount && (await rootOf(hub, one)) === hubRoot);
  await refuses("a wallet that does not hold the foreign token is refused NotYours",
    () => write(erin, mock, 1, KIND.NOTE, hexOf("not mine")), "NotYours()");
}
head("a collection with no code");
{
  const codeless = "0x000000000000000000000000000000000000c0de";
  eq("the address has no code", await c.codeSize(codeless), 0);
  ok("mayInscribe names nobody there", !(await may(codeless, 1, who(alice))));
  await refuses("an inscribe into a codeless collection is refused NotYours",
    () => write(alice, codeless, 1, KIND.NOTE, hexOf("into nothing")), "NotYours()");
  eq("and it holds no page", await countOf(codeless, 1), 0n);
  /*  The hub derives a Reach address for any id, so mayInscribe answers
      true for an unminted token's derived Reach; nothing can send from it,
      since a Reach whose token has no holder refuses every caller. A wallet
      is refused outright.                                               */
  await refuses("an inscribe into a hub token that does not exist is refused NotYours",
    () => write(alice, hub, 999, KIND.NOTE, hexOf("not yet")), "NotYours()");
}

/*──────────────── gas ────────────────*/
head("gas, measured on this run");
await c.read(journal, "rootOf(address,uint256)", [hub, one]);
const rootCall = c.lastGas;
const probe = await c.deploy(A("test/mocks/JournalFixtures.sol", "JournalProbe").bytecode, "", "JournalProbe");
const probed = await c.read(probe, "measure(address,address,uint256)", [journal, hub, one]);
const rootCold = decUint(probed, 0);
eq("the probe reads the same root a page does", "0x" + probed.slice(66, 130), await rootOf(hub, one));
ok(`rootOf costs ${rootCall} gas as an eth_call and ${rootCold} gas from a contract with the Journal cold, the read the hub's fingerprint will make`,
   rootCold > 0n && rootCold < 10_000n, `${rootCold}`);
const ids = [];
for (let i = 0; i < 3; i++) ids.push((await mint(c, site, who(alice))).id);
const shapes = [[100, KIND.NOTE, "100 B plain"], [1024, KIND.NOTE, "1,024 B plain"], [4096, KIND.SEALED, "4,096 B sealed"]];
const table = [];
for (let i = 0; i < shapes.length; i++) {
  const [n, kind, label] = shapes[i];
  const a = await write(alice, hub, ids[i], kind, filled(n), ZERO32, `inscribe ${label}, first`);
  const b = await write(alice, hub, ids[i], kind, filled(n), ZERO32, `inscribe ${label}, later`);
  table.push([label, a.gas, b.gas]);
}
for (const [label, a, b] of table) console.log(`      inscribe ${label.padEnd(15)} first memory of a page ${String(a).padStart(7)} gas · a later one ${String(b).padStart(7)} gas`);
console.log(`      Reach.execute(inscribe), 27 B milestone     ${viaReach.gas} gas · Reach.executeBatch(inscribe ×2) ${batch.gas} gas`);
ok(`inscribe costs ${table[0][1]} / ${table[1][1]} / ${table[2][1]} gas at 100 B, 1,024 B plain and 4,096 B sealed as a page's first memory, ` +
   `${table[0][2]} / ${table[1][2]} / ${table[2][2]} as a later one, every one under the EIP-7825 transaction cap`,
   table.every(([, a, b]) => a < 16_777_216n && b < 16_777_216n && b < a));

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
