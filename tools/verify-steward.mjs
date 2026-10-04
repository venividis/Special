#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the steward — succession and recovery, attacked

  Origin: the succession half of IPSEITY tools/verify-estate.mjs, ported
  for U5 (DESIGN.md §9.4, §14 B7), plus what INTACT added: the hashed heir,
  the guardian threshold, duress, the epoch-void and the seal the heir
  waits out. A contract that can move somebody else's token is worth
  attacking rather than demonstrating, and the attacks are the ones that
  would actually be tried:

    · the phished approval     can an operator write or reset the will?
    · the impatient heir       execute without a knock, knock too soon
    · the stranger's hand      does a passer-by's call count as life?
    · the second knock         can a stranger move the heir's deadline?
    · the cancelled knock      does one word from the holder reset it?
    · the sale                 does a plan survive the token leaving?
    · the panic                does a plan survive the epoch moving in place?
    · the seal                 can a steward move bypass a ratchet?
    · the lone guardian        can one of three open the door?
    · the split vote           do two doors make a threshold?
    · the duress heartbeat     can the key-holder shorten what it bought?
    · the instrument heir      does the estate follow token N live?

  The hub is the U5 mock (test/mocks/MockHubForVault.sol) until U1 lands:
  it implements exactly the IIntact selectors the Steward calls, with the
  hub's documented rules for each.

    node tools/verify-steward.mjs
───────────────────────────────────────────────────────────────────────────*/
import { compile, artifact } from "./compile.mjs";
import * as evm from "./evm.mjs";
import { Chain, enc, sel, decUint, decAddr, decBool, encodeAddressArg, warp } from "./evm.mjs";
import { createAddressFromString } from "@ethereumjs/util";

let pass = 0, fail = 0;
const ok = (n, cond, d) => {
  cond ? pass++ : fail++;
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}`);
  if (!cond && d !== undefined) console.log(`      ${d}`);
};
const eq = (n, g, w) => ok(n, String(g) === String(w), `got ${g}\n      want ${w}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const ZERO = "0x" + "00".repeat(20);
const DAY = 86400n;
const now = () => evm.BLOCK.header.timestamp;

/// A call that must fail, for the stated reason.
const refuses = async (name, fn, error) => {
  let threw = false, why = "";
  try { await fn(); } catch (e) { threw = true; why = String(e.message || e); }
  const right = !error || why.includes(sel(error).slice(2));
  ok(name, threw && right, threw ? `reverted, but not with ${error}: ${why.slice(0, 120)}` : "it went through");
};

const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const me = c.from.toString();

/*  The status codes, as the page would render them. */
const S = { NO_PLAN: 0n, SOLD: 1n, SPEAKING: 2n, SUMMONABLE: 3n, WAITING: 4n, LOCKED: 5n, BAD_HANDS: 6n, OK: 7n };

head("deploy");
const tmpReg = await c.deploy(A("test/mocks/MockRegistry6551.sol", "MockRegistry6551").bytecode);
await c.vm.stateManager.putCode(createAddressFromString(REGISTRY),
  await c.vm.stateManager.getCode(createAddressFromString(tmpReg)));
const impl = await c.deploy(A("test/mocks/MockHubForVault.sol", "StubAccountImpl").bytecode);
const hub = await c.deploy(A("test/mocks/MockHubForVault.sol", "MockHubForVault").bytecode,
  encodeAddressArg(impl) + encodeAddressArg(impl));
const steward = await c.deploy(A("src/Steward.sol", "Steward").bytecode, encodeAddressArg(hub), "Steward");
const market = await c.as("0x" + "aa".repeat(32));        // stands in for another pinned module
await c.exec(hub, "wire(address,address,address)", [steward, market.from.toString(), ZERO]);
const bytes = A("src/Steward.sol", "Steward").deployed.length / 2 - 1;
ok(`deployed (Steward runtime ${bytes} B)`, steward.length === 42);
for (const name of ["NO_PLAN", "SOLD", "SPEAKING", "SUMMONABLE", "WAITING", "LOCKED", "BAD_HANDS", "OK"]) {
  if (decUint(await c.read(steward, `${name}()`)) !== S[name]) ok(`status code ${name}`, false);
}
ok("the eight status codes read 0..7 in order", true);

/*  Hands. The heir is who the estate is left to; the thief holds a phished
    approval and nothing else; the agent and buyer take tokens; three
    guardians were named by the holder.                                 */
const heir  = await c.as("0x" + "a1".repeat(32));
const thief = await c.as("0x" + "b2".repeat(32));
const agent = await c.as("0x" + "c3".repeat(32));
const buyer = await c.as("0x" + "d4".repeat(32));
const g1 = await c.as("0x" + "61".repeat(32));
const g2 = await c.as("0x" + "62".repeat(32));
const g3 = await c.as("0x" + "63".repeat(32));
const addr = (actor) => actor.from.toString().toLowerCase();

for (let i = 0; i < 8; i++) await c.exec(hub, "mint(address)", [me]);
const reach1 = decAddr(await c.read(hub, "account(uint256)", [1]));
await c.exec(hub, "createReach(uint256)", [1]);
const ownerOf = async (id) => decAddr(await c.read(hub, "ownerOf(uint256)", [id])).toLowerCase();
const status = async (id) => decUint(await c.read(steward, "wouldPass(uint256)", [id]));
const locked = async (id) => decBool(await c.read(hub, "locked(uint256)", [id]));
/// getWill returns a struct holding a dynamic array: word 0 is the offset,
/// the struct head follows in field order.
const will = async (id) => {
  const h = await c.read(steward, "getWill(uint256)", [id]);
  return { heirHash: "0x" + h.slice(2).substr(64, 64), quiet: decUint(h, 2), notice: decUint(h, 3),
           lastLife: decUint(h, 4), due: decUint(h, 5), dest: decAddr(h, 6).toLowerCase(), epoch: decUint(h, 7),
           threshold: decUint(h, 9), nonce: decUint(h, 10), duress: decBool(h, 11) };
};
const obit = async (id) => {
  const h = await c.read(steward, "getObit(uint256)", [id]);
  return { status: decUint(h, 0), due: decUint(h, 1), dest: decAddr(h, 2).toLowerCase(), nonce: decUint(h, 3), spoken: decUint(h, 4) };
};
const SALT = "0x" + "5a".repeat(32);
const heirHash = async (who) => c.read(steward, "heirHashOf(address,bytes32)", [who, SALT]);
const ARRANGE = "arrange(uint256,bytes32,uint64,uint64,address[],uint8)";
const arrange = (id, h, quiet = 60n * DAY, notice = 30n * DAY, guardians = [], threshold = 0) =>
  c.exec(steward, ARRANGE, [id, h, quiet, notice, guardians, threshold], { label: "arrange" });
eq("eight tokens minted to one wallet", await ownerOf(1), me.toLowerCase());

/*════════════════════════ a plan only its holder can write ════════════════════════*/
head("a plan only its holder can write");
{
  const id = 1;
  const h = await heirHash(addr(heir));
  /*  The whole point of the strict door. If an approved operator can name
      the heir, a phished approval does not have to steal anything — the
      thief writes themselves into the will and waits for the silence.  */
  await c.exec(hub, "approve(address,uint256)", [addr(thief), id]);
  await refuses("an approved operator cannot name the heir",
    async () => thief.exec(steward, ARRANGE, [id, await heirHash(addr(thief)), 60n * DAY, 30n * DAY, [], 0]), "NotHolder()");
  /*  The Reach cannot arrange either (`holds`, not `acts`): the harness
      cannot impersonate a contract, so that refusal is proved by prank in
      test/Steward.t.sol · test_aStrangerCannotResetSilence.             */

  await arrange(id, h);
  const w = await will(id);
  eq("the holder can, and the heir is a hash — nobody is named in public", w.heirHash, h);
  eq("stamped with the custody epoch", w.epoch, 1n);
  eq("and the plan reads as speaking", await status(id), S.SPEAKING);
  ok("the plan hashes into the fingerprint", decUint(await c.read(steward, "planHash(uint256)", [id])) !== 0n);

  await refuses("the operator cannot say the holder is here", () => thief.exec(steward, "stillHere(uint256)", [id]), "NotHolder()");
  await refuses("nor say it under duress", () => thief.exec(steward, "stillHereUnderDuress(uint256)", [id]), "NotHolder()");

  /*  A silence shorter than a month is an accident waiting to fire, and
      one longer than ten years is a promise about a system that may not
      be there. A notice under two weeks cannot be noticed.             */
  await refuses("a silence of one day is refused", () => arrange(2, h, DAY), "TooShort()");
  await refuses("and one of twenty years is too", () => arrange(2, h, 7300n * DAY), "TooLong()");
  await refuses("a notice of a week is refused", () => arrange(2, h, 60n * DAY, 7n * DAY), "TooShort()");
  await refuses("and one of two years is too", () => arrange(2, h, 60n * DAY, 730n * DAY), "TooLong()");
  await refuses("naming nobody is not a plan", () => arrange(2, "0x" + "00".repeat(32)), "BadDestination()");
  await refuses("one guardian is not a council", () => arrange(2, h, 60n * DAY, 30n * DAY, [addr(g1)], 1), "BadGuardians()");
  await refuses("a council needs at least two to agree",
    () => arrange(2, h, 60n * DAY, 30n * DAY, [addr(g1), addr(g2)], 1), "BadThreshold()");
}

/*════════════════════════ two clocks ════════════════════════*/
head("two clocks, and what resets them");
{
  const id = 1;
  const SUMMON = "summon(uint256,address,bytes32)";
  await refuses("nobody may knock while the token is still in use",
    () => heir.exec(steward, SUMMON, [id, addr(heir), SALT]), "StillSpeaking(uint64)");
  await refuses("and executing without a knock is refused", () => heir.exec(steward, "execute(uint256)", [id]), "NotCalled()");

  const seen = (await will(id)).lastLife;
  warp(seen + 61n * DAY);
  eq("after the silence, it reads as summonable", await status(id), S.SUMMONABLE);

  /*  The attack that defeated the donor's feature, run as the attack: a
      stranger's call against the token (IPSEITY's `embody`) must not be a
      sign of life. The mock's `touch` is that call.                    */
  await thief.exec(hub, "touch(uint256)", [id]);
  eq("a stranger touching the token does not reset the silence", await status(id), S.SUMMONABLE);
  await thief.exec(hub, "touch(uint256)", [id]);
  eq("nor does doing it again", await status(id), S.SUMMONABLE);
  eq("and the hub did not move the custody epoch for it", decUint(await c.read(hub, "custodyEpoch(uint256)", [id])), 1n);

  await refuses("the wrong preimage opens nothing", () => thief.exec(steward, SUMMON, [id, addr(thief), SALT]), "WrongHeir()");
  await thief.exec(steward, SUMMON, [id, addr(heir), SALT], { label: "summon" });
  eq("a stranger with the right preimage may knock, and a second clock starts", await status(id), S.WAITING);
  ok("the knock holds the module lock", await locked(id));
  const opens = (await will(id)).due;
  eq("the door opens after the notice", opens, now() + 30n * DAY);

  await refuses("a second knock cannot restart the notice", () => heir.exec(steward, SUMMON, [id, addr(heir), SALT]), "AlreadyCalled()");
  eq("and the first knock keeps its original deadline", (await will(id)).due, opens);
  await refuses("executing during the notice is refused", () => heir.exec(steward, "execute(uint256)", [id]), "NotYet(uint64)");
  await refuses("a stranger cannot cancel the notice", () => thief.exec(steward, "cancel(uint256)", [id]), "NotHolder()");

  /*  The knock is loud on purpose: it is public, and one word from the
      holder cancels it. The difference between a switch and a trap.    */
  await c.exec(steward, "stillHere(uint256)", [id]);
  eq("the holder speaking up cancels the knock outright", await status(id), S.SPEAKING);
  ok("and releases the lock", !(await locked(id)));
  warp(now() + 31n * DAY);
  await refuses("so the heir who was mid-notice gets nothing", () => heir.exec(steward, "execute(uint256)", [id]), "NotCalled()");
  eq("the token never moved", await ownerOf(id), me.toLowerCase());
}

/*════════════════════════ the token passes ════════════════════════*/
head("the token actually passes");
{
  const id = 1;
  warp((await will(id)).lastLife + 61n * DAY);
  await heir.exec(steward, "summon(uint256,address,bytes32)", [id, addr(heir), SALT]);
  warp((await will(id)).due + 1n);
  eq("both clocks run out and it reads as ready", await status(id), S.OK);
  await refuses("a stranger cannot displace a claim that is ready",
    () => thief.exec(steward, "summon(uint256,address,bytes32)", [id, addr(heir), SALT]), "AlreadyCalled()");

  /*  Anybody may push the button; only the named party can receive. */
  const r = await thief.exec(steward, "execute(uint256)", [id], { label: "execute" });
  eq("a stranger may press the button", await ownerOf(id), addr(heir));
  eq("the plan is spent", await status(id), S.NO_PLAN);
  eq("the move is a custody change: the epoch moved", decUint(await c.read(hub, "custodyEpoch(uint256)", [id])), 2n);
  eq("and the token arrives Paused, like any sale", decUint(await c.read(hub, "statusOf(uint256)", [id])), 1n);
  ok("the lock went with it", !(await locked(id)));
  eq("no hash remains for the fingerprint", decUint(await c.read(steward, "planHash(uint256)", [id])), 0n);
  ok(`execute cost ${r.gas} gas, under the transaction cap`, r.gas < 16_777_216n);
}

/*════════════════════════ what it refuses to promise ════════════════════════*/
head("what it refuses to promise");
{
  /*  A seal outlives nobody: `stewardTransfer` walks the hub's ordinary
      `_update`, so the holder's transfer ratchet stops it exactly as it
      stops a sale. The page says LOCKED first; the hub says it last.   */
  const id = 2;
  await arrange(id, await heirHash(addr(heir)));
  await c.exec(hub, "sealTransfer(uint256,uint64)", [id, now() + 200n * DAY]);
  warp(now() + 61n * DAY);
  await heir.exec(steward, "summon(uint256,address,bytes32)", [id, addr(heir), SALT]);
  warp((await will(id)).due + 1n);
  eq("a sealed token reports that the heir must wait", await status(id), S.LOCKED);
  await refuses("and execute reverts at the hub's door rather than half-working",
    () => heir.exec(steward, "execute(uint256)", [id]), "IsTransferSealed(uint256)");
  ok("the notice is still standing after the refusal", (await will(id)).due !== 0n && (await locked(id)));
  warp(now() + 200n * DAY);
  eq("once the seal has run, it is ready", await status(id), S.OK);

  /*  Another module's lock, likewise. */
  await market.exec(hub, "moduleLock(uint256)", [id]);
  eq("another module's lock reads as LOCKED too", await status(id), S.LOCKED);
  await refuses("and stops the move", () => heir.exec(steward, "execute(uint256)", [id]), "IsLocked(uint256)");
  await market.exec(hub, "moduleUnlock(uint256)", [id]);
  await heir.exec(steward, "execute(uint256)", [id]);
  eq("released, the heir receives", await ownerOf(id), addr(heir));

  /*  A plan does not survive the token being sold. The buyer never
      agreed to it, and buying it back revives nothing.                 */
  const id3 = 3;
  await arrange(id3, await heirHash(addr(heir)));
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, addr(buyer), id3]);
  eq("a sold token carries no inheritance to its buyer", await status(id3), S.SOLD);
  eq("and no plan hash", decUint(await c.read(steward, "planHash(uint256)", [id3])), 0n);
  warp(now() + 61n * DAY);
  await refuses("the old heir cannot knock on the new owner's door",
    () => heir.exec(steward, "summon(uint256,address,bytes32)", [id3, addr(heir), SALT]), "Void()");
  await buyer.exec(hub, "transferFrom(address,address,uint256)", [addr(buyer), me, id3]);
  eq("buying it back revives nothing", await status(id3), S.SOLD);

  /*  A panic moves the epoch without a transfer, mid-notice. The void
      plan's lock then protects nobody, so anyone may clear it.         */
  const id4 = 4;
  await arrange(id4, await heirHash(addr(heir)));
  warp(now() + 61n * DAY);
  await heir.exec(steward, "summon(uint256,address,bytes32)", [id4, addr(heir), SALT]);
  await c.exec(hub, "panic(uint256)", [id4]);
  eq("a panic voids the plan in place", await status(id4), S.SOLD);
  warp(now() + 31n * DAY);
  await refuses("the void notice cannot execute", () => heir.exec(steward, "execute(uint256)", [id4]), "Void()");
  ok("but its lock is still held", await locked(id4));
  await thief.exec(steward, "cancel(uint256)", [id4]);
  ok("and anyone may release it", !(await locked(id4)));
}

/*════════════════════════ guardians ════════════════════════*/
head("guardians open the door together, never alone");
{
  const id = 5;
  const ATTEST = "attest(uint256,address,uint32)";
  await arrange(id, await heirHash(addr(heir)), 60n * DAY, 30n * DAY, [addr(g1), addr(g2), addr(g3)], 2);
  const nonce = (await will(id)).nonce;
  await refuses("a stranger is not a guardian", () => thief.exec(steward, ATTEST, [id, addr(buyer), nonce]), "NotGuardian()");
  await refuses("a stale nonce is refused", () => g1.exec(steward, ATTEST, [id, addr(buyer), nonce - 1n]), "StaleNonce()");
  await refuses("the holder's own hands are bad hands", () => g1.exec(steward, ATTEST, [id, me, nonce]), "BadHands()");
  await refuses("so is the token's Reach", () => g1.exec(steward, ATTEST, [id, reach1, nonce]), "BadHands()");

  await g1.exec(steward, ATTEST, [id, addr(buyer), nonce], { label: "attest" });
  eq("one guardian's word starts nothing", (await will(id)).due, 0n);
  eq("the obit counts it", (await obit(id)).spoken, 1n);
  await refuses("and cannot be given twice", () => g1.exec(steward, ATTEST, [id, addr(buyer), nonce]), "AlreadyAttested()");
  await g2.exec(steward, ATTEST, [id, addr(agent), nonce]);
  eq("two words for two doors is no threshold", (await will(id)).due, 0n);
  await g3.exec(steward, ATTEST, [id, addr(buyer), nonce]);
  eq("two agreeing on one door is — the notice starts without any silence", await status(id), S.WAITING);
  eq("toward the agreed door", (await will(id)).dest, addr(buyer));
  ok("the token is locked for the notice", await locked(id));

  await c.exec(steward, "cancel(uint256)", [id]);
  eq("the holder, still holding the key, cancels it", await status(id), S.SPEAKING);
  await refuses("and the old count is gone with the nonce", () => g1.exec(steward, ATTEST, [id, addr(buyer), nonce]), "StaleNonce()");
  const fresh = (await will(id)).nonce;
  await g1.exec(steward, ATTEST, [id, addr(buyer), fresh]);
  await g2.exec(steward, ATTEST, [id, addr(buyer), fresh]);
  warp((await will(id)).due + 1n);
  await thief.exec(steward, "execute(uint256)", [id]);
  eq("a lost key is recovered to where the council agreed", await ownerOf(id), addr(buyer));
}

/*════════════════════════ duress ════════════════════════*/
head("the duress heartbeat");
{
  const id = 6;
  const h = await heirHash(addr(heir));
  await arrange(id, h);
  await c.exec(steward, "stillHereUnderDuress(uint256)", [id]);
  const w = await will(id);
  eq("the notice quietly became a year", w.notice, 365n * DAY);
  ok("flagged for the heir's page", w.duress);
  eq("and it counted as life", w.lastLife, now());
  await refuses("whoever holds the key cannot shorten what duress bought",
    () => arrange(id, h, 60n * DAY, 30n * DAY), "TooShort()");
  warp(now() + 61n * DAY);
  await thief.exec(steward, "summon(uint256,address,bytes32)", [id, addr(heir), SALT]);
  eq("the knock waits a year", (await will(id)).due, now() + 365n * DAY);
}

/*════════════════════════ the instrument heir ════════════════════════*/
head("inheritance that follows an instrument");
{
  /*  Naming a token rather than an address survives the heir changing
      wallets — the single most likely way for a ten-year plan to rot. */
  const id = 7, viaToken = 8;
  const h = await c.read(steward, "heirHashOfToken(uint256,bytes32)", [viaToken, SALT]);
  await arrange(id, h);
  warp(now() + 61n * DAY);
  const asAddress = "0x" + viaToken.toString(16).padStart(40, "0");
  await refuses("the address shape of the preimage is not the token shape",
    () => heir.exec(steward, "summon(uint256,address,bytes32)", [id, addr(heir), SALT]), "WrongHeir()");
  await refuses("while the holder of the named token is the holder, that is bad hands",
    () => heir.exec(steward, "summon(uint256,address,bytes32)", [id, asAddress, SALT]), "BadHands()");
  await c.exec(hub, "transferFrom(address,address,uint256)", [me, addr(heir), viaToken]);
  await heir.exec(steward, "summon(uint256,address,bytes32)", [id, asAddress, SALT]);
  eq("the heir is whoever holds the named token", (await obit(id)).dest, addr(heir));
  await heir.exec(hub, "transferFrom(address,address,uint256)", [addr(heir), addr(agent), viaToken]);
  eq("and it follows that token when it changes hands, live", (await obit(id)).dest, addr(agent));
  warp((await will(id)).due + 1n);
  await thief.exec(steward, "execute(uint256)", [id]);
  eq("the estate went to the instrument's holder as of the moment", await ownerOf(id), addr(agent));
}

/*════════════════════════ gas ════════════════════════*/
head("the views are cheap");
{
  const cap = 16_777_216n;
  for (const [name, sig, args] of [["wouldPass", "wouldPass(uint256)", [5]], ["getWill", "getWill(uint256)", [5]],
                                   ["getObit", "getObit(uint256)", [5]], ["planHash", "planHash(uint256)", [5]]]) {
    await c.read(steward, sig, args);
    ok(`${name} reads in ${c.lastGas} gas`, c.lastGas < cap);
  }
}

warp(evm.GENESIS_TIME);
console.log(`\n  gas: arrange ${c.gas.arrange}, summon ${c.gas.summon}, attest ${c.gas.attest}, execute ${c.gas.execute}`);
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
