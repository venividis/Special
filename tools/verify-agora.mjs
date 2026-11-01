#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT V2 · every token talking, on the real site

  Origin: tools/verify-parley.mjs, carried to Agora (V2 unit W5). The site
  is the real one — tools/site.mjs `deploySite`, the diamond hub with real
  Reach accounts, the real KeyRegistry — and Agora is deployed beside it
  with a Studio stand-in (test/mocks/AgoraFixtures.sol) that registers one
  Studio collection, Moons. Apes is a collection from elsewhere
  (test/mocks/MockERC721.sol): no custody epoch, never registered.

  test/Agora.t.sol checks what the contract stores. This checks what the
  contract exists for, against the hub it will meet: that hub tokens and
  other collections' tokens speak in exactly the rooms they belong to; that
  a conversation written as logs reads back by walking single blocks; that
  a tip lands in the author's fee sink in the same call; that a sale
  silences the seller, kills its key and leaves the token's follows where
  they were; and what each of those costs.

  The walker below is a second implementation of the reader, as in
  verify-parley: it knows the address, the topics and the room key, and
  asks the node one block at a time.

    node tools/verify-agora.mjs
───────────────────────────────────────────────────────────────────────────*/
import { compile, artifact } from "./compile.mjs";
import { Chain, sel, enc, decUint, decBool, decAddr, encodeParams, roll, BLOCK, TX_GAS_CAP } from "./evm.mjs";
import { deploySite, mint } from "./site.mjs";
import { keccak256 } from "ethereum-cryptography/keccak.js";

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${detail}`);
};
const eq = (name, got, want) =>
  ok(name, String(got).toLowerCase() === String(want).toLowerCase(), `got  ${got}\n      want ${want}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const w = (n) => BigInt(n).toString(16).padStart(64, "0");
const kec = (buf) => "0x" + Buffer.from(keccak256(buf)).toString("hex");
const topic0 = (sig) => kec(Buffer.from(sig));
const hex = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
const ZERO32 = "0x" + "00".repeat(32);
const lower = (a) => String(a).toLowerCase();

console.log("\n  \x1b[1mINTACT V2 · every token talking, on the real site\x1b[0m");

/*──────────────── stand it all up ────────────────*/
head("the real site, Agora beside it, a Studio and two other collections");
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const alice = c;
const bob = await c.as("0x" + "b0".repeat(32));
const carol = await c.as("0x" + "ca".repeat(32));
const dave = await c.as("0x" + "da".repeat(32));
const addr = (actor) => actor.from.toString();

const site = await deploySite(c, out);
const hub = site.hub;
const studio = await c.deploy(A("test/mocks/AgoraFixtures.sol", "AgoraStudio").bytecode, "", "AgoraStudio");
const agora = await c.deploy(A("src/Agora.sol", "Agora").bytecode,
  encodeParams("address,address,address", [hub, site.keys, studio]), "Agora");
const apes = await c.deploy(A("test/mocks/MockERC721.sol", "MockERC721").bytecode, "", "MockERC721");
const moons = await c.deploy(A("test/mocks/AgoraFixtures.sol", "AgoraCollection").bytecode, "", "AgoraCollection");
await c.exec(studio, "register(address)", [moons]);
ok("Agora is deployed beside the real site", (await c.codeSize(agora)) > 0);
eq("its HUB is the site's hub", decAddr(await c.read(agora, "HUB()")), hub);
eq("its KEYS is the site's KeyRegistry", decAddr(await c.read(agora, "KEYS()")), site.keys);
eq("its STUDIO is the Studio", decAddr(await c.read(agora, "STUDIO()")), studio);

const t1 = await mint(c, site, addr(alice));
const t2 = await mint(c, site, addr(bob));
eq("the hub mints #1 to alice and #2 to bob, ids read from the Transfer log", `${t1.id},${t2.id}`, "1,2");
await c.exec(apes, "mint(address,uint256)", [addr(carol), 7]);
await c.exec(moons, "mint(address)", [addr(carol)]);

const persona = (coll, id) => (BigInt(coll) << 96n) | BigInt(id);
const P1 = persona(hub, 1), P2 = persona(hub, 2), APE7 = persona(apes, 7), MOON1 = persona(moons, 1);
eq("a persona is the collection and the id in one word, as the contract packs it",
   decUint(await c.read(agora, "persona(address,uint256)", [hub, 1])), P1);
const collectionKey = (coll) => BigInt(kec(Buffer.from("04" + lower(coll).slice(2), "hex")));
const APES_ROOM = collectionKey(apes);
eq("a collection's room is keccak(4, collection), computed here without a call",
   decUint(await c.read(agora, "collectionKey(address)", [apes])), APES_ROOM);
ok("the hub is registered", decBool(await c.read(agora, "isRegistered(address)", [hub])));
ok("and so is the Studio's collection", decBool(await c.read(agora, "isRegistered(address)", [moons])));
ok("and a collection from elsewhere is not", !decBool(await c.read(agora, "isRegistered(address)", [apes])));

/*──────────────── the topics, and a second reader ────────────────*/
const SAID = topic0("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)");
const REACTED = topic0("Reacted(uint256,uint256,uint256,uint64,bytes4,uint256)");
const FOLLOWED = topic0("Followed(uint256,uint256,bool)");
{
  const t = (await c.read(agora, "topics()")).slice(2);
  const word = (i) => "0x" + t.slice(i * 64, i * 64 + 64);
  eq("the contract derives the Said topic the events carry", word(0), SAID);
  eq("and the Reacted topic", word(5), REACTED);
  eq("and the Followed topic", word(6), FOLLOWED);
}

let asked = 0;
const readSaid = (log) => {
  const d = log.data.replace(/^0x/, "");
  const at = (i) => BigInt("0x" + d.slice(i * 64, i * 64 + 64));
  const off = Number(at(6)) * 2;
  const len = Number(BigInt("0x" + d.slice(off, off + 64)));
  return {
    room: BigInt(log.topics[1]), from: BigInt(log.topics[2]),
    prev: at(0), prevFrom: at(1), seq: at(2), kind: Number(at(3)), reBlock: at(4), reSeq: at(5),
    body: Buffer.from(d.slice(off + 64, off + 64 + len * 2), "hex").toString("utf8"),
    block: BigInt(log.blockNumber)
  };
};
const said = (topics, block) => {
  asked++;
  return c.getLogs({ address: agora, fromBlock: "0x" + block.toString(16), toBlock: "0x" + block.toString(16), topics })
    .map(readSaid);
};
const stateOf = async (room) => {
  const st = await c.read(agora, "stateOf(uint256)", [room]);
  const word = (i) => decUint(st, i);
  return { last: word(0), count: word(1), opened: word(2), members: word(3), kind: word(4),
           open: word(5) !== 0n, steward: word(6), index: word(7), cooldown: word(8) };
};
/// A room, newest block first, following the OLDEST log's `prev` in each
/// block — the rule that terminates when two messages share a block.
async function walk(room) {
  let at = (await stateOf(room)).last;
  const got = [];
  for (let guard = 0; at > 0n; ++guard) {
    if (guard > 200) throw new Error("the walk did not terminate");
    const ms = said([SAID, "0x" + w(room)], at);
    if (!ms.length) break;
    for (let i = ms.length - 1; i >= 0; --i) got.push(ms[i]);
    const step = ms[0].prev;
    if (!(step < at)) break;
    at = step;
  }
  return got.reverse();
}
/// Everything one persona has said, anywhere: start from a block it spoke
/// in and follow `prevFrom`, a single-block query per step.
async function walkPersona(p, startBlock) {
  let at = startBlock;
  const got = [];
  for (let guard = 0; at > 0n; ++guard) {
    if (guard > 200) throw new Error("the persona walk did not terminate");
    const ms = said([SAID, null, "0x" + w(p)], at);
    if (!ms.length) break;
    for (let i = ms.length - 1; i >= 0; --i) got.push(ms[i]);
    const step = ms[0].prevFrom;
    if (!(step < at)) break;
    at = step;
  }
  return got.reverse();
}

/// A transaction that must be refused, by the error it must be refused with.
async function refused(fn, errSig) {
  try { await fn(); return { refused: false, named: false, got: "it went through" }; }
  catch (e) {
    const m = String(e.message).match(/data=(0x[0-9a-f]+)/i);
    const got = m ? m[1].slice(0, 10) : null;
    return { refused: true, got, named: got === sel(errSig) };
  }
}
/// The exact refusal — selector AND arguments — from a call simulated
/// against the live state, which keeps the whole revert data.
async function refusal(actor, to, data, value = 0n) {
  const r = await c.simulate(to, data, { from: addr(actor), value });
  return r.ok ? "it went through" : r.data;
}

const speak = (actor, room, from, text, kind = 0, re = [0n, 0n]) =>
  actor.exec(agora, "speak(uint256,uint256,uint8,uint64,uint64,bytes)",
    [room, from, kind, re[0], re[1], typeof text === "string" && !text.startsWith("0x") ? hex(text) : text], { label: "speak" });
const whisper = (actor, from, to, text, kind = 0, keyId = ZERO32) =>
  actor.exec(agora, "whisper(uint256,uint256,uint8,bytes32,bytes)", [from, to, kind, keyId, hex(text)], { label: "whisper" });
const react = (actor, room, from, seq, author, glyph, value = 0n) =>
  actor.exec(agora, "react(uint256,uint256,uint64,uint256,bytes4)", [room, from, seq, author, glyph], { value, label: "react" });
const follow = (actor, from, to, on = true) =>
  actor.exec(agora, "follow(uint256,uint256,bool)", [from, to, on], { label: "follow" });

/*──────────────── who speaks where ────────────────*/
head("one identity, the rooms it belongs to, and no others");
const b0 = BLOCK.header.number;
await speak(alice, 0n, P1, "gm from the hub");
await speak(carol, 0n, MOON1, "and gm from a Studio collection");
eq("hub token #1 and a Studio collection's token both speak in the commons", (await stateOf(0n)).count, 2n);
{
  const r = await refusal(carol, agora, enc("speak(uint256,uint256,uint8,uint64,uint64,bytes)", [0, APE7, 0, 0, 0, hex("and gm from elsewhere")]));
  eq("the Apes holder is refused in the commons as Unregistered(Apes), by name and argument",
     r, sel("Unregistered(address)") + w(apes));
}
await speak(carol, APES_ROOM, APE7, "the Apes room needs nobody to found it");
{
  const st = await stateOf(APES_ROOM);
  ok("and speaks in the Apes room, which its first word opens as a collection room naming Apes",
     st.count === 1n && st.kind === 4n && st.index === BigInt(apes) && st.opened === b0,
     JSON.stringify({ count: String(st.count), kind: String(st.kind), index: st.index.toString(16) }));
  const r = await refusal(alice, agora, enc("speak(uint256,uint256,uint8,uint64,uint64,bytes)", [APES_ROOM, P1, 0, 0, 0, hex("may I?")]));
  eq("hub token #1 is refused in the Apes room as NotOfCollection(#1, Apes)",
     r, sel("NotOfCollection(uint256,address)") + w(P1) + w(apes));
}
roll(b0 + 5n);
await speak(bob, 0n, P2, "five blocks later, #2");
{
  /*  The real Reach: the holder calls `execute`, and Agora sees the Reach
      as msg.sender — the hub's `acts`, which is how a session key speaks. */
  const reach1 = decAddr(await c.read(hub, "account(uint256)", [1]));
  const data = enc("speak(uint256,uint256,uint8,uint64,uint64,bytes)", [0, P1, 0, 0, 0, hex("through my own Reach")]);
  await alice.exec(reach1, "execute(address,uint256,bytes,uint8)", [agora, 0, data, 0], { label: "speak via Reach" });
  const m = (await walk(0n)).pop();
  ok("hub token #1's real Reach speaks for it, and the log names the persona", m.from === P1 && m.body === "through my own Reach");
  await alice.exec(hub, "setUser(uint256,address,uint64)", [1, addr(bob), BLOCK.header.timestamp + 86400n]);
  const r = await refusal(bob, agora, enc("speak(uint256,uint256,uint8,uint64,uint64,bytes)", [0, P1, 0, 0, 0, hex("I rent this voice")]));
  eq("and the renter the hub names for #1 is refused as NotYours", r, sel("NotYours()"));
}
roll(b0 + 405n);
await speak(alice, 0n, P1, "four hundred blocks later");

asked = 0;
const commons = await walk(0n);
eq("the second walker reads the commons back in order",
   commons.map((m) => m.body).join(" | "),
   "gm from the hub | and gm from a Studio collection | five blocks later, #2 | through my own Reach | four hundred blocks later");
eq("each message attributed to the persona that said it, across two collections",
   commons.map((m) => m.from === P1 ? "#1" : m.from === P2 ? "#2" : m.from === MOON1 ? "Moon1" : "?").join(","), "#1,Moon1,#2,#1,#1");
eq("and 406 blocks of history cost 3 single-block queries", asked, 3);
eq("the sequence numbers are the room's own", commons.map((m) => m.seq).join(","), "1,2,3,4,5");

/*──────────────── the brakes ────────────────*/
head("the commons brake and the collection room's, in blocks");
{
  const at = BLOCK.header.number;
  const r = await refusal(alice, agora, enc("speak(uint256,uint256,uint8,uint64,uint64,bytes)", [0, P1, 0, 0, 0, hex("again, same block")]));
  eq("a second word in the commons within two blocks is refused as Cooldown(the block it lifts at)", r, sel("Cooldown(uint64)") + w(at + 2n));
  roll(at + 1n);
  await speak(carol, APES_ROOM, APE7, "an Ape, again");
  const r2 = await refused(() => speak(carol, APES_ROOM, APE7, "and again"), "Cooldown(uint64)");
  ok("a collection room brakes the same way: two words of one Ape inside two blocks are refused", r2.refused && r2.named, r2.got);
}

/*──────────────── reactions and tips ────────────────*/
head("a reaction, and the tip in it");
const TIP = 10n ** 14n;                                   // 0.0001 ether
const STAR = "0xe29ca600";                                // ✦, left-aligned
{
  const sink = decAddr(await c.read(hub, "feeSink(uint256)", [1]));
  const reach1 = decAddr(await c.read(hub, "account(uint256)", [1]));
  eq("#1's fee sink on the hub is its Reach", sink, reach1);
  const sinkBefore = await c.balanceOf(sink);
  const aliceBefore = await c.balanceOf(addr(alice));
  roll(BLOCK.header.number + 2n);
  const r = await react(bob, 0n, P2, 1n, P1, STAR, TIP);
  eq("#2's ✦ on #1's first message carries 0.0001 ETH into feeSink(1) on the hub, in the same call",
     (await c.balanceOf(sink)) - sinkBefore, TIP);
  eq("and none of it stays in Agora", await c.balanceOf(agora), 0n);
  eq("and none of it goes to #1's holder directly", await c.balanceOf(addr(alice)), aliceBefore);
  const log = r.logs.map((l) => ({ topics: l[1].map((t) => "0x" + Buffer.from(t).toString("hex")), data: "0x" + Buffer.from(l[2]).toString("hex") }))
    .find((l) => l.topics[0] === REACTED);
  ok("the Reacted log names the room, the reactor, the author, the seq, the glyph and the tip",
     log && BigInt(log.topics[1]) === 0n && BigInt(log.topics[2]) === P2 && BigInt(log.topics[3]) === P1 &&
     decUint(log.data, 0) === 1n && log.data.slice(66, 74) === "e29ca600" && decUint(log.data, 2) === TIP,
     log && log.data);
}
{
  const before = await c.balanceOf(addr(carol));
  await react(bob, APES_ROOM, P2, 1n, APE7, "0x2b000000", TIP);
  eq("a hub token's tip to an Ape's word in the Apes room lands with the Ape's holder", (await c.balanceOf(addr(carol))) - before, TIP);
  const ghost = persona(hub, 3000);
  const r = await refusal(bob, agora, enc("react(uint256,uint256,uint64,uint256,bytes4)", [0, P2, 1, ghost, "0x2b000000"]), TIP);
  eq("a tip to a hub token nobody holds is refused as NoPayee(the persona)", r, sel("NoPayee(uint256)") + w(ghost));
  const r2 = await refused(() => react(bob, 0n, P2, 99n, P1, STAR), "BadReply()");
  ok("a reaction to a message the room has not reached is refused (BadReply)", r2.refused && r2.named, r2.got);
  const r3 = await refused(() => react(bob, 0n, P2, 1n, P1, "0xff000000"), "BadGlyph()");
  ok("and a glyph that is not UTF-8 is refused (BadGlyph)", r3.refused && r3.named, r3.got);
}

/*──────────────── follows ────────────────*/
head("follows, across collections");
await follow(bob, P2, P1);
await follow(carol, APE7, P1);
await follow(bob, P2, P1);                                   // twice
eq("#2 and Ape #7 follow #1, and following twice counts once", decUint(await c.read(agora, "followerCount(uint256)", [P1])), 2n);
{
  const logs = c.getLogs({ address: agora, topics: [FOLLOWED, null, "0x" + w(P1)] });
  eq("one Followed log per edge, none for the repeat", logs.length, 2);
}

/*──────────────── keys and a whisper ────────────────*/
head("sealing keys, and a whisper between #1 and #2");
const pkA = "0x04" + "a1".repeat(64), pkB = "0x04" + "b2".repeat(64), pkD = "0x04" + "d4".repeat(64);
const idOf = (pk) => kec(Buffer.from(pk.slice(2), "hex"));
await alice.exec(site.keys, "setEncryptionKey(uint16,bytes)", [3, pkA]);
await alice.exec(agora, "bindKey(uint256)", [P1], { label: "bindKey" });
await bob.exec(site.keys, "setEncryptionKey(uint16,bytes)", [3, pkB]);
await bob.exec(agora, "bindKey(uint256)", [P2], { label: "bindKey" });
{
  const k = await c.read(agora, "keyOf(uint256)", [P2]);
  eq("#2's bound key is bob's key in the registry", "0x" + k.slice(66, 130), idOf(pkB));
}
roll(BLOCK.header.number + 2n);
await whisper(alice, P1, P2, "sealed, for #2's key", 1, idOf(pkB));
await whisper(bob, P2, P1, "and a plain answer");
const PAIR = decUint(await c.read(agora, "pairKey(uint256,uint256)", [P1, P2]));
{
  const dm = await walk(PAIR);
  eq("both halves of the whisper are in the pair room, in order", dm.map((m) => m.body).join(" | "), "sealed, for #2's key | and a plain answer");
  eq("the first flagged sealed, the second plain", dm.map((m) => m.kind).join(","), "1,0");
  const r = await refused(() => whisper(alice, P1, P2, "to a key #2 never had", 1, idOf(pkD)), "KeyMoved()");
  ok("a sealed whisper to a key that is not #2's bound key is refused (KeyMoved)", r.refused && r.named, r.got);
}

/*──────────────── the sale ────────────────*/
head("#1 is sold: the seller is silenced, the buyer speaks, the follows stay");
{
  roll(BLOCK.header.number + 2n);
  const S = BLOCK.header.number;
  await speak(alice, 0n, P1, "my last word as #1's holder");
  await alice.exec(hub, "transferFrom(address,address,uint256)", [addr(alice), addr(dave), 1]);
  eq("the hub names dave as #1's holder", decAddr(await c.read(hub, "ownerOf(uint256)", [1])), addr(dave));
  const r = await refusal(alice, agora, enc("speak(uint256,uint256,uint8,uint64,uint64,bytes)", [0, P1, 0, 0, 0, hex("still mine?")]));
  eq("the seller is refused as NotYours", r, sel("NotYours()"));
  await speak(dave, 0n, P1, "my first word as #1's holder");
  const last = (await walk(0n)).slice(-2);
  ok("the buyer speaks in the very block of the seller's last word: its brake is its own",
     last[1].body === "my first word as #1's holder" && last[1].block === S && last[0].block === S);
  const r2 = await refusal(dave, agora, enc("speak(uint256,uint256,uint8,uint64,uint64,bytes)", [0, P1, 0, 0, 0, hex("and a second")]));
  eq("and fills that brake with its own words: a second is Cooldown(S + 2)", r2, sel("Cooldown(uint64)") + w(S + 2n));

  const k = await c.read(agora, "keyOf(uint256)", [P1]);
  eq("the seller's key binding died with the sale: keyOf(#1) is zero", "0x" + k.slice(66, 130), ZERO32);
  const r3 = await refused(() => whisper(bob, P2, P1, "sealed to the seller", 1, idOf(pkA)), "NoKey()");
  ok("and a whisper sealed to the seller's key is refused rather than recorded (NoKey)", r3.refused && r3.named, r3.got);
  await dave.exec(site.keys, "setEncryptionKey(uint16,bytes)", [3, pkD]);
  await dave.exec(agora, "bindKey(uint256)", [P1], { label: "bindKey" });
  await whisper(bob, P2, P1, "sealed, for the buyer", 1, idOf(pkD));
  eq("once the buyer binds its own key, #2 seals to it", (await walk(PAIR)).pop().body, "sealed, for the buyer");

  ok("#2 still follows #1 after the sale", decBool(await c.read(agora, "follows(uint256,uint256)", [P2, P1])));
  eq("and #1 keeps both its followers: follows belong to the token, by design",
     decUint(await c.read(agora, "followerCount(uint256)", [P1])), 2n);
}

/*──────────────── everything one persona said ────────────────*/
head("one persona, every room: the prevFrom walk");
{
  const home1 = decUint(await c.read(agora, "homeKey(uint256)", [P1]));
  roll(BLOCK.header.number + 3n);
  await speak(dave, home1, P1, "at home");
  roll(BLOCK.header.number + 3n);
  await whisper(dave, P1, APE7, "to an Ape");
  const lastBlock = BLOCK.header.number;
  asked = 0;
  const all = await walkPersona(P1, lastBlock);
  eq("#1's own back-link walks every word it said, in every room, across both of its holders",
     all.map((m) => m.body).join(" | "),
     "gm from the hub | through my own Reach | four hundred blocks later | sealed, for #2's key | my last word as #1's holder | my first word as #1's holder | at home | to an Ape");
  eq("in one single-block query per block it spoke in", asked, 7);
}

/*──────────────── gas ────────────────*/
head("gas, measured");
const views = [
  ["Agora.stateOf", enc("stateOf(uint256)", [0])],
  ["Agora.keyOf", enc("keyOf(uint256)", [P1])],
  ["Agora.mayActAs", enc("mayActAs(uint256,address)", [P1, addr(dave)])],
  ["Agora.isRegistered", enc("isRegistered(address)", [moons])],
  ["Agora.heads(3)", enc("heads(uint256[])", [[0n, APES_ROOM, PAIR]])]
];
let worst = 0n;
for (const [label, data] of views) {
  await c.call(agora, data);
  worst = c.lastGas > worst ? c.lastGas : worst;
  console.log(`      ${label.padEnd(40)} ${String(c.lastGas).padStart(9)} gas`);
}
ok(`every view is under the 2^24 cap (worst ${worst})`, worst < TX_GAS_CAP);
const one = {};
{
  /*  One of each write in a fresh block, after the slots it touches are no
      longer new: the steady-state cost a holder pays, not the first-ever.
      A follow is always a new edge, so it is measured twice: once where all
      three words are fresh (the edge and both counters: a first follow by a
      persona of a persona nobody followed), once where both counters
      already hold a number (a follower of others following a followed
      persona), which is the common case once a graph exists.            */
  roll(BLOCK.header.number + 2n);
  one["speak, 100 B"] = (await speak(bob, 0n, P2, "a".repeat(100))).gas;
  roll(BLOCK.header.number + 2n);
  one["speak, 1,024 B"] = (await speak(bob, 0n, P2, "b".repeat(1024))).gas;
  roll(BLOCK.header.number + 2n);
  one["react with a tip"] = (await react(bob, 0n, P2, 1n, P1, STAR, TIP)).gas;
  one["follow, three fresh words"] = (await follow(carol, MOON1, P2)).gas;
  one["follow, counters already set"] = (await follow(carol, APE7, P2)).gas;
  one["whisper, plain"] = (await whisper(bob, P2, P1, "c".repeat(100))).gas;
  one["whisper, sealed"] = (await whisper(bob, P2, P1, "d".repeat(100), 1, idOf(pkD))).gas;
  for (const [k, g] of Object.entries(one)) console.log(`      ${(k + " (one call)").padEnd(40)} ${String(g).padStart(9)} gas`);
  ok("every write measured lands under the EIP-7825 transaction cap", Object.values(one).every((g) => g < TX_GAS_CAP));
}

console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
