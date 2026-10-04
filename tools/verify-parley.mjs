#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the tokens talking, on a real EVM

  Origin: IPSEITY tools/verify-parley.mjs (37 assertions), ported onto the
  INTACT social contracts (U4) and extended with what DESIGN.md §7 added:
  reply pointers, home rooms and the follower roster, epoch-keyed cooldowns
  and key bindings, and postage.

  `test/Parley.t.sol` checks what the contract stores. This checks the thing
  the contract exists for: that a conversation written as logs can be read
  back by something with no index, no server and no memory of what happened
  — by walking the back-links, one block at a time, the way a browser does.

  The walker below is deliberately a *second* implementation. The one that
  ships lives in `engine/panels/social.js` (U9) and is driven by
  `tools/verify-site.mjs` against a DOM. Two independent readers of the same
  archive have to agree, and if they ever stop, one of them is wrong in a
  way a single reader could never have reported.

    node tools/verify-parley.mjs
───────────────────────────────────────────────────────────────────────────*/
import { compile, artifact } from "./compile.mjs";
import { Chain, sel, enc, decUint, decBool, decAddr, encodeParams, roll, BLOCK, TX_GAS_CAP } from "./evm.mjs";
import { deployHub, etchRegistry } from "./hub.mjs";
import { keccak256 } from "ethereum-cryptography/keccak.js";

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${name}`);
  if (!cond && detail !== undefined) console.log(`      ${detail}`);
};
const eq = (name, got, want) =>
  ok(name, String(got) === String(want), `got ${got}\n      want ${want}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const w = (n) => BigInt(n).toString(16).padStart(64, "0");
const topic0 = (sig) => "0x" + Buffer.from(keccak256(Buffer.from(sig))).toString("hex");
const hex = (s) => "0x" + Buffer.from(s, "utf8").toString("hex");
const ZERO32 = "0x" + "00".repeat(32);

/// A call that must revert, with the error it must revert with.
async function refused(fn, errSig) {
  try { await fn(); return { refused: false }; }
  catch (e) {
    const m = String(e.message).match(/data=(0x[0-9a-f]+)/i);
    const got = m ? m[1].slice(0, 10) : null;
    return { refused: true, got, want: errSig ? sel(errSig) : null,
             named: errSig ? got === sel(errSig) : true };
  }
}

console.log("\n  \x1b[1mINTACT · the tokens talking\x1b[0m");

/*──────────────── stand it all up ────────────────*/
head("a collection, and a place to talk");
const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const alice = c;
const bob = await c.as("0x" + "b0".repeat(32));
const carol = await c.as("0x" + "ca".repeat(32));

/*  The real hub since the wave-1 integration (the ship build, tools/hub.mjs,
    price zero): every token's account is the real Reach forwarder, which is
    what Postage pays and refunds.                                        */
await etchRegistry(c);
const reachImpl = await c.deploy(A("src/Reach.sol", "Reach").bytecode, "", "Reach");
const gripImpl = await c.deploy(A("src/Grip.sol", "Grip").bytecode, "", "Grip");
const { hub } = await deployHub(c, out, { reachImpl, gripImpl }, { price: 0n });
const keys = await c.deploy(A("src/KeyRegistry.sol", "KeyRegistry").bytecode, "", "KeyRegistry");
const deployer = await c.deploy(A("test/mocks/SocialHub.sol", "SocialDeploy").bytecode,
  encodeParams("address,address", [hub, keys]), "SocialDeploy");
const parley = decAddr(await c.read(deployer, "parley()"));
const postage = decAddr(await c.read(deployer, "postage()"));
const roster = await c.deploy(A("src/Roster.sol", "Roster").bytecode,
  encodeParams("address,address", [parley, hub]), "Roster");
ok("the parley is deployed", (await c.codeSize(parley)) > 0);
ok("and so is the postage", (await c.codeSize(postage)) > 0);
eq("Parley's POSTAGE is the Postage that was built against its predicted address",
   decAddr(await c.read(parley, "POSTAGE()")), postage);
eq("and Postage's PARLEY is the Parley", decAddr(await c.read(postage, "PARLEY()")), parley);

await alice.exec(hub, "mint(address)", [alice.from.toString()]);   // #1
await alice.exec(hub, "mint(address)", [bob.from.toString()]);     // #2
await alice.exec(hub, "mint(address)", [carol.from.toString()]);   // #3
eq("three tokens, three holders",
   decAddr(await c.read(hub, "ownerOf(uint256)", [2])).toLowerCase(), bob.from.toString().toLowerCase());
const account = async (id) => decAddr(await c.read(hub, "account(uint256)", [id]));

const SAID = topic0("Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes)");
{
  const t = await c.read(parley, "topics()");
  eq("the contract derives the same topic the events carry", "0x" + t.slice(2, 66), SAID);
}

/*──────────────── a second reader ────────────────

  Everything below this line is written as if it had no idea how the
  contract works: it knows the address, the topic and the room, and it asks
  the node one block at a time. `asked` counts the queries, because "it
  found the messages" and "it found them without scanning the chain" are
  different claims and only one of them is the point.                    */
let asked = 0;
const readBody = (log) => {
  const d = log.data.replace(/^0x/, "");
  const at = (i) => BigInt("0x" + d.slice(i * 64, i * 64 + 64));
  const off = Number(at(6)) * 2;
  const len = Number(BigInt("0x" + d.slice(off, off + 64)));
  return {
    room: BigInt(log.topics[1]),
    from: BigInt(log.topics[2]),
    prev: at(0), prevFrom: at(1), seq: at(2), kind: Number(at(3)),
    reBlock: at(4), reSeq: at(5),
    body: Buffer.from(d.slice(off + 64, off + 64 + len * 2), "hex").toString("utf8"),
    raw: d.slice(off + 64, off + 64 + len * 2),
    block: BigInt(log.blockNumber)
  };
};
const logsAt = (room, block) => {
  asked++;
  return c.getLogs({ address: parley, fromBlock: "0x" + block.toString(16),
                     toBlock: "0x" + block.toString(16), topics: [SAID, "0x" + w(room)] }).map(readBody);
};
const stateOf = async (room) => {
  const st = await c.read(parley, "stateOf(uint256)", [room]);
  const word = (i) => decUint(st, i);
  return { last: word(0), count: word(1), opened: word(2), members: word(3), kind: word(4),
           open: word(5) !== 0n, steward: word(6), index: word(7), cooldown: word(8),
           headBlocks: [9, 10, 11, 12].map(word), headSeqs: [13, 14, 15, 16].map(word) };
};

async function walk(room, want = 100) {
  let at = (await stateOf(room)).last;
  const out = [];
  let guard = 0;
  while (at > 0n && out.length < want) {
    if (++guard > 200) throw new Error("the walk did not terminate");
    const ms = logsAt(room, at);
    if (!ms.length) break;
    for (let i = ms.length - 1; i >= 0; --i) out.push(ms[i]);
    const step = ms[0].prev;
    if (!(step < at)) break;         // the guard that makes it terminate
    at = step;
  }
  return out.reverse();
}

const say = async (actor, room, from, text, kind = 0, re = [0, 0]) =>
  actor.exec(parley, "speak(uint256,uint256,uint8,uint64,uint64,bytes)",
    [room, from, kind, re[0], re[1], hex(text)], { label: "speak" });
const whisper = async (actor, from, to, text, kind = 0, keyId = ZERO32) =>
  actor.exec(parley, "whisper(uint256,uint256,uint8,bytes32,bytes)",
    [from, to, kind, keyId, hex(text)], { label: "whisper" });

/*──────────────── the commons ────────────────*/
head("the commons, written across several blocks");
const at0 = BLOCK.header.number;
await say(alice, 0n, 1n, "first");
await say(bob, 0n, 2n, "second, same block");
roll(at0 + 5n);
await say(bob, 0n, 2n, "third, five blocks later");
roll(at0 + 400n);
await say(alice, 0n, 1n, "fourth, four hundred blocks later");

asked = 0;
const commons = await walk(0n);
eq("every message came back", commons.length, 4);
eq("in the order they were said",
   commons.map((m) => m.body).join(" | "),
   "first | second, same block | third, five blocks later | fourth, four hundred blocks later");
eq("and each is attributed to the token that said it",
   commons.map((m) => m.from).join(","), "1,2,2,1");
eq("the sequence numbers are the room's, not the block's",
   commons.map((m) => m.seq).join(","), "1,2,3,4");

/*  Three blocks hold messages and 400 blocks separate the first from the
    last. A reader that scanned would have asked for 401.               */
eq("the second walker reads 405 blocks of history in 3 single-block queries", asked, 3);

/*  The failure this guard exists for: the second message in a block points
    at its own block, because the head had already moved. A walker that
    followed that pointer asks the node for the same block forever.     */
ok("two messages in one block do not send the walk in a circle",
   commons[1].prev === commons[1].block, `prev ${commons[1].prev} block ${commons[1].block}`);
{
  let looped = false, steps = 0;
  let at = commons[commons.length - 1].block;
  while (steps++ < 12) {
    const ms = logsAt(0n, at);
    if (!ms.length) break;
    const naive = ms[ms.length - 1].prev;   // the newest, not the oldest
    if (naive === at) { looped = true; break; }
    if (naive === 0n) break;
    at = naive;
  }
  ok("and following the newest log instead would have looped, which is why it does not",
     looped, "the naive walk happened to terminate, so this control proves nothing");
}
console.log("      (the walk follows the oldest log in a block, which is why it terminates)");

{
  const st = await stateOf(0n);
  eq("the ring holds the last three blocks that held a message, newest first",
     st.headBlocks.slice(0, 3).join(","), [at0 + 400n, at0 + 5n, at0].join(","));
  eq("with the seq of the newest message in each", st.headSeqs.slice(0, 3).join(","), "4,3,2");
  eq("and an empty fourth lane, because only three blocks have spoken", st.headBlocks[3], 0n);
}

/*──────────────── the brake ────────────────*/
head("the commons brake, keyed by custody epoch");
{
  const r = await refused(() => say(alice, 0n, 1n, "fifth, same block as fourth"), "Cooldown(uint64)");
  ok("a token cannot speak twice in the commons inside two blocks", r.refused && r.named, r.got);
  roll(BLOCK.header.number + 2n);
  await say(alice, 0n, 1n, "fifth, two blocks on");
  eq("and may two blocks later", (await stateOf(0n)).count, 5n);
}

/*──────────────── who may speak ────────────────*/
head("a message is signed by the token, not by an address");
{
  const r = await refused(() => say(bob, 0n, 1n, "I am alice"), "NotYours()");
  ok("a wallet cannot speak as a token it does not hold", r.refused && r.named, r.got);
}
const bound = await account(1);
ok("but the token's own account may speak for it",
   decBool(await c.read(parley, "mayActAs(uint256,address)", [1, bound])));
await alice.exec(hub, "setUser(uint256,address,uint64)",
  [1, bob.from.toString(), BLOCK.header.timestamp + 86400n]);
ok("and a renter may not",
   !decBool(await c.read(parley, "mayActAs(uint256,address)", [1, bob.from.toString()])));

/*──────────────── pairs ────────────────*/
head("two tokens, one room, derived rather than founded");
const pair = decUint(await c.read(parley, "pairKey(uint256,uint256)", [1, 2]));
eq("the key is the same from both sides",
   pair, decUint(await c.read(parley, "pairKey(uint256,uint256)", [2, 1])));

roll(BLOCK.header.number + 3n);
await whisper(alice, 1n, 2n, "just us");
roll(BLOCK.header.number + 3n);
await whisper(bob, 2n, 1n, "and nobody else");

const dm = await walk(pair);
eq("both halves of the conversation are in it", dm.length, 2);
eq("and it reads in order", dm.map((m) => m.body).join(" | "), "just us | and nobody else");
eq("the commons did not gain them", (await walk(0n)).length, 5);
{
  const r = await refused(() => say(alice, pair, 1n, "through the front"), "UseWhisper()");
  ok("and the raw key is not a door into it", r.refused && r.named, r.got);
}

/*──────────────── groups ────────────────*/
head("a group");
const key = decUint(await c.read(parley, "groupKey(uint256)", [1]));
await alice.exec(parley, "found(uint256,string,bool)", [1, "the workshop", false], { label: "found" });
eq("the first group takes the first key", decUint(await c.read(parley, "groups()")), 1);
{
  const st = await stateOf(key);
  eq("and it is a group", st.kind, 1n);
  eq("with one member", st.members, 1n);
  eq("and a steward", st.steward, 1n);
}
{
  const r = await refused(() => bob.exec(parley, "join(uint256,uint256)", [key, 2]), "NotInvited()");
  ok("a closed door stays closed", r.refused && r.named, r.got);
}
eq("and nothing was added to the uninvited token's list",
   decUint(await c.read(parley, "roomCount(uint256)", [2])), 0);
await alice.exec(parley, "invite(uint256,uint256,uint256)", [key, 1, 2], { label: "invite" });
eq("an invitation alone still adds nothing to it",
   decUint(await c.read(parley, "roomCount(uint256)", [2])), 0);
await bob.exec(parley, "join(uint256,uint256)", [key, 2], { label: "join" });
eq("joining is what adds it, and only the token can join",
   decUint(await c.read(parley, "roomCount(uint256)", [2])), 1);

roll(BLOCK.header.number + 2n);
await say(bob, key, 2n, "thanks for the invitation");
const group = await walk(key);
eq("the group has its own archive", group.length, 1);
eq("kept apart from every other room's", (await walk(0n)).length, 5);
{
  const bits = decUint(await c.read(roster, "inWindow(uint256,uint256)", [key, 1]));
  eq("the roster's window has bits 0 and 1 set: tokens 1 and 2", bits, 0b11n);
  const r = await c.read(roster, "membersOf(uint256,uint256)", [key, 1]);
  const d = r.replace(/^0x/, "");
  const off = Number(BigInt("0x" + d.slice(0, 64))) * 2;
  const n = Number(BigInt("0x" + d.slice(off, off + 64)));
  const ids = []; for (let i = 0; i < n; ++i) ids.push(BigInt("0x" + d.slice(off + 64 + i * 64, off + 128 + i * 64)));
  eq("and as a list", ids.join(","), "1,2");
  eq("with no next window, because the band ends inside this one", BigInt("0x" + d.slice(64, 128)), 0n);
}

/*──────────────── replies ────────────────*/
head("a thread is a pointer, walked the same way");
roll(BLOCK.header.number + 2n);
await say(alice, 0n, 1n, "a question");
const question = (await walk(0n)).pop();
roll(BLOCK.header.number + 2n);
await say(bob, 0n, 2n, "an answer", 0, [question.block, question.seq]);
const answer = (await walk(0n)).pop();
eq("the reply names the block of what it answers", answer.reBlock, question.block);
eq("and its seq", answer.reSeq, question.seq);
{
  asked = 0;
  const parent = logsAt(0n, answer.reBlock).find((m) => m.seq === answer.reSeq);
  eq("so one single-block query resolves the thread", asked, 1);
  eq("to the message that was answered", parent && parent.body, "a question");
  const r = await refused(() => say(bob, 0n, 2n, "an answer to nothing", 0, [question.block, 99n]), "BadReply()");
  ok("and a pointer to a message the room has not reached is refused", r.refused && r.named, r.got);
}

/*──────────────── home rooms ────────────────*/
head("a home room, and following");
const home1 = decUint(await c.read(parley, "homeKey(uint256)", [1]));
{
  const r = await refused(() => bob.exec(parley, "join(uint256,uint256)", [home1, 2]), "NoSuchRoom()");
  ok("there is nothing to follow before the first word", r.refused && r.named, r.got);
}
roll(BLOCK.header.number + 2n);
await say(alice, home1, 1n, "first word at home");
{
  const st = await stateOf(home1);
  eq("the first word opens the home room", st.kind, 3n);
  eq("with the token as steward", st.steward, 1n);
  ok("and an open door", st.open);
}
await bob.exec(parley, "join(uint256,uint256)", [home1, 2], { label: "follow" });
await carol.exec(parley, "join(uint256,uint256)", [home1, 3], { label: "follow" });
eq("the roster's follower window is tokens 2 and 3",
   decUint(await c.read(roster, "inWindow(uint256,uint256)", [home1, 1])), 0b110n);
eq("and the roster knows it is a home", decUint(await c.read(roster, "kindOf(uint256)", [home1])), 3n);
await alice.exec(parley, "evict(uint256,uint256,uint256)", [home1, 1, 3]);
eq("an eviction removes a follower",
   decUint(await c.read(roster, "inWindow(uint256,uint256)", [home1, 1])), 0b010n);

/*──────────────── what a body may be ────────────────*/
head("a body is bytes, and stays the bytes it was");
const nasty = "</script><img src=x onerror=alert(1)>é→🔥";
roll(BLOCK.header.number + 2n);
await say(alice, 0n, 1n, nasty);
const back = (await walk(0n)).pop();
eq("a body that is markup comes back as the same characters", back.body, nasty);
eq("byte for byte", back.raw, Buffer.from(nasty, "utf8").toString("hex"));
console.log("      (what stops it being markup is the client, and that is checked in verify-site)");

roll(BLOCK.header.number + 2n);
await say(alice, 0n, 1n, "not really sealed", 1);
const sealed = (await walk(0n)).pop();
eq("a sealed body is flagged rather than interpreted", sealed.kind, 1);

const max = Number(decUint(await c.read(parley, "MAX_BODY()")));
{
  roll(BLOCK.header.number + 2n);
  const r = await refused(() => alice.exec(parley, "speak(uint256,uint256,uint8,uint64,uint64,bytes)",
    [0, 1, 0, 0, 0, "0x" + "61".repeat(max + 1)]), "BadBody()");
  ok(`a body over ${max} bytes is refused`, r.refused && r.named, r.got);
}

/*──────────────── keys ────────────────*/
head("sealing keys, bound to the holder and the epoch");
const pk = "0x04" + "ab".repeat(64);
await bob.exec(keys, "setEncryptionKey(uint16,bytes)", [3, pk]);
await bob.exec(parley, "bindKey(uint256)", [2], { label: "bindKey" });
const keyId = "0x" + Buffer.from(keccak256(Buffer.from(pk.slice(2), "hex"))).toString("hex");
{
  const k = await c.read(parley, "keyOf(uint256)", [2]);
  eq("the bound key is the registry's", "0x" + k.slice(66, 130), keyId);
  eq("typed", decUint(k, 0), 3n);
}
const maxSealed = Number(decUint(await c.read(parley, "MAX_SEALED()")));
roll(BLOCK.header.number + 2n);
await alice.exec(parley, "whisper(uint256,uint256,uint8,bytes32,bytes)",
  [1, 2, 1, keyId, "0x" + "5e".repeat(maxSealed)], { label: "whisper-sealed" });
ok(`a sealed envelope may be ${maxSealed} bytes`, true);
{
  const r = await refused(() => alice.exec(parley, "whisper(uint256,uint256,uint8,bytes32,bytes)",
    [1, 2, 1, keyId, "0x" + "5e".repeat(maxSealed + 1)]), "BadBody()");
  ok("and not one more", r.refused && r.named, r.got);
  const r2 = await refused(() => whisper(alice, 1n, 2n, "to the wrong key", 1, ZERO32), "KeyMoved()");
  ok("a send sealed to a key that is not the bound one is refused", r2.refused && r2.named, r2.got);
}
await bob.exec(hub, "transferFrom(address,address,uint256)", [bob.from.toString(), carol.from.toString(), 2]);
{
  const k = await c.read(parley, "keyOf(uint256)", [2]);
  eq("a sold token has no key", "0x" + k.slice(66, 130), ZERO32);
  const r = await refused(() => whisper(alice, 1n, 2n, "sealed to a ghost", 1, keyId), "NoKey()");
  ok("and a sealed send to it is refused rather than recorded", r.refused && r.named, r.got);
}
{
  /*  The epoch-keyed cooldown: bob's last word in the commons was blocks
      ago; carol, holding #2 now, speaks at once; and in the same block a
      second word from carol as #2 is braked — the bucket is hers.     */
  roll(BLOCK.header.number + 2n);
  await say(carol, 0n, 2n, "the buyer's first word");
  const r = await refused(() => say(carol, 0n, 2n, "the buyer's second"), "Cooldown(uint64)");
  ok("a buyer starts with an empty cooldown bucket and fills it with its own words", r.refused && r.named, r.got);
  const r2 = await refused(() => say(bob, 0n, 2n, "the seller, still talking"), "NotYours()");
  ok("and the seller has no bucket because it has no voice", r2.refused && r2.named, r2.got);
}

/*──────────────── postage ────────────────*/
head("postage: priced first contact, settled by the reply, pulled by anyone");
roll(BLOCK.header.number + 2n);
const price = 10n ** 16n;                                // 0.01 ether
await alice.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)",
  [1, "0x" + "00".repeat(20), price, 3600, true], { label: "configureInbox" });
{
  const r = await refused(() => whisper(carol, 3n, 1n, "for free"), "PostageDue(uint256,uint128)");
  ok("a stranger cannot whisper to a priced inbox without a stamp", r.refused && r.named, r.got);
  const r2 = await refused(() => carol.exec(parley,
    "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)",
    [3, 1, 0, ZERO32, hex("underpaid"), "0x" + "00".repeat(20), price], { value: price - 1n }), "WrongValue()");
  ok("and a stamp short of the price is refused", r2.refused && r2.named, r2.got);
}
await carol.exec(parley, "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)",
  [3, 1, 0, ZERO32, hex("may I have a moment"), "0x" + "00".repeat(20), price], { value: price, label: "whisperStamped" });
const pair13 = decUint(await c.read(parley, "pairKey(uint256,uint256)", [1, 3]));
eq("the postage is escrowed", await c.balanceOf(postage), price);
const stampId = decUint(await c.read(postage, "pendingOf(uint256)", [pair13]));
eq("as the pair's one pending stamp", stampId, 1n);
const sink1 = await account(1);
roll(BLOCK.header.number + 2n);
await whisper(alice, 1n, 3n, "you may");
eq("the reply credits the token's fee sink", decUint(await c.read(postage, "owed(address,address)", [sink1, "0x" + "00".repeat(20)])), price);
eq("and moves nothing inside the whisper", await c.balanceOf(sink1), 0n);
await bob.exec(postage, "claimSettled(uint256,address)", [1, "0x" + "00".repeat(20)], { label: "claimSettled" });
eq("anyone may pull it to where it belongs", await c.balanceOf(sink1), price);
eq("and the escrow is empty", await c.balanceOf(postage), 0n);
roll(BLOCK.header.number + 2n);
await whisper(carol, 3n, 1n, "thank you");
ok("once answered, the pair is open and the stranger whispers free", true);

{
  // the refund path: a second priced inbox, ignored
  await carol.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)",
    [3, "0x" + "00".repeat(20), price, 3600, true]);
  roll(BLOCK.header.number + 2n);
  await bob.exec(hub, "mint(address)", [bob.from.toString()]);     // #4 for bob
  await bob.exec(parley, "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)",
    [4, 3, 0, ZERO32, hex("hello?"), "0x" + "00".repeat(20), price], { value: price, label: "whisperStamped" });
  const pair34 = decUint(await c.read(parley, "pairKey(uint256,uint256)", [3, 4]));
  const sid = decUint(await c.read(postage, "pendingOf(uint256)", [pair34]));
  const r = await refused(() => alice.exec(postage, "expire(uint256)", [sid]), "ReplyWindowOpen(uint64)");
  ok("a stamp cannot expire while the window is open", r.refused && r.named, r.got);
  roll(BLOCK.header.number + 301n);                      // 12 s a block: past the hour
  await alice.exec(postage, "expire(uint256)", [sid], { label: "expire" });
  const sink4 = await account(4);
  await alice.exec(postage, "claimRefund(uint256)", [sid], { label: "claimRefund" });
  eq("an ignored stamp is refunded to the sender's account", await c.balanceOf(sink4), price);
  eq("and the escrow is empty again", await c.balanceOf(postage), 0n);
}

/*──────────────── the head, which is how a client knows to look ────────────────*/
head("polling is one call");
{
  const rooms = [0n, key, pair];
  const r = await c.read(parley, "heads(uint256[])", [rooms]);
  const d = r.replace(/^0x/, "");
  const at = (i) => BigInt("0x" + d.slice(i * 64, i * 64 + 64));
  eq("three rooms in, three heads out", at(1), 3n);
  eq("the commons head is where its newest message is", at(2), (await stateOf(0n)).last);
  eq("the group head", at(3), (await stateOf(key)).last);
  eq("the pair head", at(4), (await stateOf(pair)).last);
}

/*──────────────── gas ────────────────*/
head("gas");
const views = [
  ["Parley.stateOf", parley, enc("stateOf(uint256)", [0])],
  ["Parley.heads(3)", parley, enc("heads(uint256[])", [[0n, key, pair]])],
  ["Parley.keyOf", parley, enc("keyOf(uint256)", [2])],
  ["Parley.roomsOf", parley, enc("roomsOf(uint256)", [2])],
  ["Roster.inWindow(256)", roster, enc("inWindow(uint256,uint256)", [key, 1])],
  ["Roster.membersOf(256)", roster, enc("membersOf(uint256,uint256)", [home1, 1])],
  ["Postage.inboxOf", postage, enc("inboxOf(uint256)", [1])]
];
let worst = 0n;
for (const [label, to, data] of views) {
  await c.call(to, data);
  worst = c.lastGas > worst ? c.lastGas : worst;
  console.log(`      ${label.padEnd(24)} ${String(c.lastGas).padStart(9)} gas`);
}
ok(`every view is under the 2^24 cap (worst ${worst})`, worst < TX_GAS_CAP);
{
  /*  One of each write, measured on its own in a fresh block, after the
      slots it touches are no longer new: the steady-state cost a holder
      pays, not the first-ever one. */
  roll(BLOCK.header.number + 2n);
  const one = {};
  one.speak = (await say(alice, 0n, 1n, "a steady-state word")).gas;
  one.whisper = (await whisper(carol, 3n, 1n, "a steady-state whisper")).gas;
  await alice.exec(postage, "configureInbox(uint256,address,uint128,uint64,bool)",
    [1, "0x" + "00".repeat(20), price, 3600, true]);
  one.whisperStamped = (await bob.exec(parley, "whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)",
    [4, 1, 0, ZERO32, hex("a steady-state stamp"), "0x" + "00".repeat(20), price], { value: price })).gas;
  for (const [k, g] of Object.entries(one)) console.log(`      ${(k + " (one call)").padEnd(24)} ${String(g).padStart(9)} gas`);
}
for (const [label, g] of Object.entries(c.gas)) {
  if (["speak", "whisper", "whisperStamped", "found", "join", "follow", "bindKey", "claimSettled", "expire", "claimRefund", "whisper-sealed", "configureInbox"].includes(label))
    console.log(`      ${label.padEnd(24)} ${String(g).padStart(9)} gas total across the run`);
}

console.log(`\n  ${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
