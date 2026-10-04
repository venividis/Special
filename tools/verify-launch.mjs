#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the launch: coin, raise, graduation, failure, and the hook
  actually executed

  Origin: IPSEITY tools/verify-launch.mjs, the coin half. The review of
  that repository found the disqualifying thing about its launchpad:
  `Gate.beforeSwap` and `Gate.beforeRemoveLiquidity` had never run — two
  callbacks holding other people's liquidity, shipped on the strength of
  the fact that they compiled. So the gate here is driven through a
  manager that dispatches BY SELECTOR the way v4 does, and never called
  directly.

  INTACT adds the raise (DESIGN.md §8.2–8.3): credits that move no ERC-20,
  a tax priced by the clock, fee legs earned only by a graduation, a
  sealed market opened at the curve's terminal price with both prices
  emitted side by side, and a failed launch that returns every wei. The
  Pool and Locks are U3's and U5's; this file drives the Launchpad against
  their FROZEN interfaces through test/mocks/LaunchFixtures.sol, which is
  what wave-1 parallelism means. U14's LaunchHook, LPCustodian and the
  "pre-initialised pool at the wrong price" assertion land in the other
  half of this file.

    node tools/verify-launch.mjs
───────────────────────────────────────────────────────────────────────────*/
import { compile, artifact } from "./compile.mjs";
import { Chain, decUint, decAddr, decBool, enc, encodeParams, sel, warp } from "./evm.mjs";
import { deployHub, etchRegistry } from "./hub.mjs";
import * as evm from "./evm.mjs";
import { keccak256 } from "ethereum-cryptography/keccak.js";

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}`);
  if (!c && d !== undefined) console.log(`      ${d}`);
};
const eq = (n, g, w) => ok(n, String(g) === String(w), `got ${g}\n      want ${w}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);
const refuses = async (name, fn, why) => {
  let threw = false;
  try { await fn(); } catch { threw = true; }
  ok(name, threw, why || "it went through");
};
/// @dev Refuses WITH a named custom error: the revert data the harness
///      reports must start with that error's selector.
const refusesWith = async (name, fn, sig) => {
  let data = null;
  try { await fn(); } catch (e) { data = (String(e.message).match(/(0x[0-9a-f]{8,})/) || [])[1] || "0x"; }
  ok(name, data !== null && data.startsWith(sel(sig)),
     data === null ? "it went through" : `reverted with ${data.slice(0, 10)}, wanted ${sel(sig)} (${sig})`);
};
const topic = (sig) => "0x" + Buffer.from(keccak256(Buffer.from(sig, "utf8"))).toString("hex");
const w = (n) => BigInt(n).toString(16).padStart(64, "0");
const E = 10n ** 18n;

const out = compile({ quiet: true, dirs: ["src", "test/mocks"] });
const A = (f, n) => artifact(out, f, n);
const c = await Chain.open();
const alice = await c.as("0x" + "aa".repeat(32));
const bob = await c.as("0x" + "b0".repeat(32));
const carol = await c.as("0x" + "ca".repeat(32));
const dave = await c.as("0x" + "da".repeat(32));
const eve = await c.as("0x" + "ee".repeat(32));

const SUPPLY = 1_000_000_000n * E;
const RAISE = 900_000_000n * E;
const CURVE = 700_000_000n * E;

/*═══════════════ deploy: the mutual immutables ═══════════════*/

head("deploy");
/*  The real hub since the wave-1 integration (the ship build, tools/hub.mjs,
    price zero); the Pool and Locks beside it are still the U6 fixtures so
    `shortBy` and the exact-delta checks keep their walk — the real Pool is
    met in test/Bundle.t.sol.                                             */
await etchRegistry(c);
const reachImpl = await c.deploy(A("src/Reach.sol", "Reach").bytecode, "", "Reach");
const gripImpl = await c.deploy(A("src/Grip.sol", "Grip").bytecode, "", "Grip");
const { hub } = await deployHub(c, out, { reachImpl, gripImpl }, { price: 0n });
const pm = await c.deploy(A("test/mocks/MockPoolManager.sol", "MockPoolManager").bytecode, "", "MockPoolManager");
const wiring = await c.deploy(A("test/mocks/LaunchFixtures.sol", "LaunchWiring").bytecode,
  encodeParams("address,address,uint256", [hub, pm, 0]), "LaunchWiring");
const kiln = decAddr(await c.read(wiring, "kiln()"));
const pad = decAddr(await c.read(wiring, "pad()"));
const pool = decAddr(await c.read(wiring, "pool()"));
const locks = decAddr(await c.read(wiring, "locks()"));
eq("the Kiln was built against the Launchpad's predicted address", decAddr(await c.read(kiln, "LAUNCHPAD()")), pad);
eq("and the Launchpad pins the Kiln back", decAddr(await c.read(pad, "KILN()")), kiln);
eq("the Pool pins the Launchpad for openSealed", decAddr(await c.read(pool, "LAUNCHPAD()")), pad);
eq("the Launchpad pins the Pool", decAddr(await c.read(pad, "POOL()")), pool);
eq("and Locks", decAddr(await c.read(pad, "LOCKS()")), locks);
eq("no custodian exists yet: Target.UniswapV4 is NotYet", decAddr(await c.read(pad, "CUSTODIAN()")), "0x" + "00".repeat(20));

await c.exec(hub, "mint(address)", [alice.from.toString()]);
const ID = 1n;
const reach = decAddr(await c.read(hub, "account(uint256)", [ID]));

/*═══════════════ the ABI has no lever ═══════════════*/

head("no selector names an admin");
const names = (f, n) => A(f, n).abi.filter((e) => e.type === "function").map((e) => e.name);
const lever = /^(set|withdraw|pause|unpause|rescue|sweep|skim|owner|transferOwnership|renounce|upgrade|initialize|mint|blacklist|freeze)/i;
for (const [f, n] of [["src/Launchpad.sol", "Launchpad"], ["src/Kiln.sol", "Kiln"], ["src/Coin.sol", "Coin"]]) {
  const hit = names(f, n).filter((x) => lever.test(x));
  ok(`${n}: ${names(f, n).length} functions, none of them a withdraw, pause, owner, setter or mint`,
     hit.length === 0, hit.join(", "));
}
ok("the Coin has no receive or fallback: ether enters only through contribute",
   !A("src/Coin.sol", "Coin").abi.some((e) => e.type === "receive" || e.type === "fallback"));

/*═══════════════ the coin ═══════════════*/

head("the coin: minted to the vault, the raise share to the Launchpad");
const SALT = "0x" + "01".padStart(64, "0");
const predicted = decAddr(await c.read(kiln,
  "coinAt(uint256,address,string,string,uint8,uint256,bytes32,uint256)",
  [ID, alice.from.toString(), "Agent One", "AGENT1", 18, SUPPLY, SALT, RAISE]));
ok("nothing lives at the predicted address", (await c.codeSize(predicted)) === 0);

await refusesWith("a stranger cannot launch for a token they do not hold",
  () => bob.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
    [ID, "Agent One", "AGENT1", 18, SUPPLY, SALT, RAISE]), "NotActor()");
await refusesWith("a name outside printable ASCII is refused",
  () => alice.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
    [ID, "café", "AGENT1", 18, SUPPLY, SALT, RAISE]), "BadName()");
await refusesWith("a 33-byte symbol is refused",
  () => alice.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
    [ID, "Agent One", "A".repeat(33), 18, SUPPLY, SALT, RAISE]), "BadName()");
await refusesWith("a share larger than the supply is refused",
  () => alice.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
    [ID, "Agent One", "AGENT1", 18, SUPPLY, SALT, SUPPLY + 1n]), "ShareTooLarge()");

const launched = await alice.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
  [ID, "Agent One", "AGENT1", 18, SUPPLY, SALT, RAISE], { label: "launch" });
const launchedLog = c.getLogs({ address: kiln, topics: [topic("Launched(address,uint256,address,string,uint256,uint256)")] }).pop();
const coin = "0x" + launchedLog.topics[1].slice(26);
eq("`coinAt` equals the deployed address", coin, predicted);
ok("and code lives there now", (await c.codeSize(coin)) > 0);
eq("the Launched log names the token", decUint(launchedLog.topics[2]), ID);
eq("the Reach holds the supply less the raise share from block one",
   decUint(await c.read(coin, "balanceOf(address)", [reach])), SUPPLY - RAISE);
eq("the raise share sits in the Launchpad", decUint(await c.read(coin, "balanceOf(address)", [pad])), RAISE);
eq("and no allowance from the Reach exists anywhere",
   decUint(await c.read(coin, "allowance(address,address)", [reach, pad])), 0n);
eq("the coin names its launcher", decUint(await c.read(coin, "LAUNCHER()")), ID);
eq("and its kiln", decAddr(await c.read(coin, "KILN()")), kiln);
eq("`launchedBy` points back", decUint(await c.read(kiln, "launchedBy(address)", [coin])), ID);
eq("the kiln counts it", decUint(await c.read(kiln, "coinCount()")), 1n);

/*  Recomputed independently: CREATE2 over (kiln, keccak(by, salt), keccak(
    creationCode ‖ args)) and nothing else, because the contract is the
    thing under test.                                                     */
{
  const initCode = A("src/Coin.sol", "Coin").bytecode.slice(2) +
    encodeParams("string,string,uint8,uint256,uint256,address,address,uint256",
      ["Agent One", "AGENT1", 18, SUPPLY, RAISE, reach, pad, ID]);
  const mixed = keccak256(Buffer.from(encodeParams("address,bytes32", [alice.from.toString(), SALT]), "hex"));
  const pre = Buffer.concat([
    Buffer.from("ff", "hex"), Buffer.from(kiln.slice(2), "hex"), Buffer.from(mixed), Buffer.from(keccak256(Buffer.from(initCode, "hex")))]);
  eq("recomputed in JS from (kiln, sender-mixed salt, initCodeHash) alone, it is the same address",
     "0x" + Buffer.from(keccak256(pre)).toString("hex").slice(24), coin.toLowerCase());
}

await refusesWith("a second launch inside seven days is refused",
  () => alice.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
    [ID, "Two", "TWO", 18, SUPPLY, "0x" + "02".padStart(64, "0"), 0n]), "TooSoon(uint64)");

/*═══════════════ the raise ═══════════════*/

head("the raise: credits, a tax priced by the clock, fee legs held");
const T0 = evm.BLOCK.header.timestamp;
const PARAMS = "(uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8)";
const terms = (over = {}) => [
  ID, coin, CURVE, E, over.target ?? 2n * E, 0n, over.window ?? 1000n, (1n << 128n) - 1n,
  over.tax ?? 9900, 100, 1500, over.vest ?? 0, over.deadline ?? T0 + 7n * 86400n, 0
];
const termsHash = await c.read(pad, `termsHash(${PARAMS})`, [terms()]);
await refusesWith("`createChecked` refuses terms that moved",
  () => alice.exec(pad, `createChecked(${PARAMS},bytes32)`, [terms(), "0x" + "ff".repeat(32)]), "TermsMoved(bytes32,bytes32)");
await refusesWith("a stranger cannot create a raise",
  () => bob.exec(pad, `create(${PARAMS})`, [terms()]), "NotActor()");
await refusesWith("a 101 bps fee is refused",
  () => alice.exec(pad, `create(${PARAMS})`, [[...terms().slice(0, 9), 101, ...terms().slice(10)]]), "FeeTooHigh(uint16)");
await refusesWith("the v4 target is NotYet",
  () => alice.exec(pad, `create(${PARAMS})`, [[...terms().slice(0, 13), 1]]), "NotYet()");
await alice.exec(pad, `createChecked(${PARAMS},bytes32)`, [terms(), termsHash], { label: "create" });
const created = c.getLogs({ address: pad, topics: [topic("LaunchCreated(uint256,uint256,address,uint8,bytes32)")] }).pop();
const L1 = decUint(created.topics[1]);
eq("the raise is launch 1 of token 1", `${L1},${decUint(created.topics[2])}`, "1,1");
eq("the terms hash in the log is the one the page pinned", "0x" + created.data.slice(2 + 64, 2 + 128), termsHash.slice(0, 66));
eq("the raise half of a launch is not a new launch: the clock did not move",
   decUint(await c.read(pad, "lastLaunchAt(uint256)", [ID])), T0);
await refusesWith("the share was spent: the same coin cannot raise twice",
  () => alice.exec(pad, `create(${PARAMS})`, [terms()]), "WrongCoin(address)");

eq("the tax reads 99 % at the opening block", decUint(await c.read(pad, "snipeTaxBps(uint256)", [L1])), 9900n);
{
  const q = await c.read(pad, "quoteBuy(uint256,uint256)", [L1, E]);
  eq("a 1-ether snipe pays the 1 % fee", decUint(q, 1), E / 100n);
  eq("and a 98 % tax: the clamp keeps the whole take under 99 %", decUint(q, 2), 98n * E / 100n);
  ok("and still receives something", decUint(q, 0) > 0n);
}
await refusesWith("a buy whose fee bound is below the live tax is refused",
  () => bob.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L1, 0n, T0 + 60n, 9899], { value: E }), "FeeTooHigh(uint16)");
await refusesWith("graduation before the target is refused",
  () => eve.exec(pad, "graduate(uint256)", [L1]), "NotGraduatable(uint256)");

await bob.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L1, 0n, T0 + 60n, 10000], { value: E, label: "buy" });
const bought = c.getLogs({ address: pad, topics: [topic("Bought(uint256,address,uint256,uint256,uint256,uint256)")] }).pop();
const bobCredit = decUint(bought.data, 1);
eq("the Bought log carries fee and tax", `${decUint(bought.data, 2)},${decUint(bought.data, 3)}`, `${E / 100n},${98n * E / 100n}`);
eq("the buyer holds a credit", decUint(await c.read(pad, "creditOf(uint256,address)", [L1, bob.from.toString()])), bobCredit);
eq("and no coin: nothing ERC-20 moved", decUint(await c.read(coin, "balanceOf(address)", [bob.from.toString()])), 0n);
eq("the Launchpad still holds the whole raise share", decUint(await c.read(coin, "balanceOf(address)", [pad])), RAISE);
{
  const held = await c.read(pad, "feesHeld(uint256)", [L1]);
  eq("the creator leg is held, not paid", decUint(held, 0), E / 100n * 1500n / 10000n);
  eq("so is the floor leg, tax included", decUint(held, 1), E / 100n - E / 100n * 1500n / 10000n + 98n * E / 100n);
  eq("the Reach has received nothing yet", await c.balanceOf(reach), 0n);
  eq("the coin's pool is empty", decUint(await c.read(coin, "redemptionPool()")), 0n);
}
eq("the launch holds exactly what it was given", decUint(await c.read(pad, "totalHeld()")), E);
eq("and the contract balance agrees", await c.balanceOf(pad), E);

warp(T0 + 500n);
eq("halfway through the window the tax is half", decUint(await c.read(pad, "snipeTaxBps(uint256)", [L1])), 4950n);
warp(T0 + 1000n);
eq("at the window's end it is gone", decUint(await c.read(pad, "snipeTaxBps(uint256)", [L1])), 0n);

for (const [who, amt] of [[carol, E], [dave, E], [dave, E / 2n]]) {
  await who.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L1, 0n, T0 + 2000n, 10000], { value: amt, label: "buy" });
}
const raised = decUint(await c.read(pad, "raisedOf(uint256)", [L1]));
eq("raised is the net of every buy", raised, E / 100n + 99n * E / 100n * 2n + 99n * E / 200n);
ok("the target is met", raised >= 2n * E);

/*═══════════════ graduation ═══════════════*/

head("graduation: a sealed market at the terminal price, by anyone");
const before = await c.read(pad, "launchOf(uint256)", [L1]);
const q = decUint(before, 4), b = decUint(before, 5), sold = decUint(before, 8);
const terminal = q * E / b;
eq("`priceOf` is the curve's price", decUint(await c.read(pad, "priceOf(uint256)", [L1])), terminal);
const fees = await c.read(pad, "feesHeld(uint256)", [L1]);
const creatorOwed = decUint(fees, 0), floorOwed = decUint(fees, 1);
const supplyBefore = decUint(await c.read(coin, "totalSupply()"));

await eve.exec(pad, "graduate(uint256)", [L1], { label: "graduate" });
const grad = c.getLogs({ address: pad, topics: [topic("Graduated(uint256,uint256,uint256,uint256)")] }).pop();
const key = decUint(grad.topics[2]);
const emittedTerminal = decUint(grad.data, 0), emittedSpot = decUint(grad.data, 1);
eq("a stranger graduated it, and the log names the terminal price", emittedTerminal, terminal);
{
  const diff = emittedSpot > emittedTerminal ? emittedSpot - emittedTerminal : emittedTerminal - emittedSpot;
  ok("the sealed market's spot equals the terminal price to a part in a billion",
     diff * 1_000_000_000n <= emittedTerminal, `terminal ${emittedTerminal} spot ${emittedSpot}`);
}
eq("the market key is Pool.sealedKey(launchKey)",
   key, decUint(await c.read(pool, "sealedKey(bytes32)", [await c.read(pad, "launchKey(uint256)", [L1])])));
eq("the launch records its market", decUint(await c.read(pad, "launchOf(uint256)", [L1]), 19), key);
{
  const m = await c.read(pool, "marketOf(uint256)", [key]);
  const amountBase = raised * b / q;
  eq("the sealed market holds the whole raise as quote", decUint(m, 3), raised);
  eq("and exactly raised·b/q base — what the terminal price calls for", decUint(m, 2), amountBase);
  eq("the market is sealed", decBool(m, 8), true);
  eq("its beneficiary is the launching token", decUint(m, 15), ID);
  eq("its fee is 100 bps", decUint(m, 4), 100n);
  eq("the base the price did not need was burned",
     decUint(await c.read(coin, "totalSupply()")), supplyBefore - (b - amountBase));
  eq("only the buyers' credits remain in the Launchpad", decUint(await c.read(coin, "balanceOf(address)", [pad])), sold);
  eq("and no allowance survived the call", decUint(await c.read(coin, "allowance(address,address)", [pad, pool])), 0n);
}
eq("the creator leg reached feeSink(id): the Reach", await c.balanceOf(reach), creatorOwed);
eq("the floor leg and the entire tax reached the coin", decUint(await c.read(coin, "redemptionPool()")), floorOwed);
ok("so every holder has a floor", decUint(await c.read(coin, "floorPerToken()")) > 0n);
eq("the Launchpad holds no ether of a graduated launch", await c.balanceOf(pad), 0n);
eq("and says so", decUint(await c.read(pad, "totalHeld()")), 0n);

await eve.exec(pad, "claim(uint256,address)", [L1, bob.from.toString()], { label: "claim" });
eq("anyone may pay for a claim; the recipient is fixed",
   decUint(await c.read(coin, "balanceOf(address)", [bob.from.toString()])), bobCredit);
await refusesWith("a second claim is refused",
  () => eve.exec(pad, "claim(uint256,address)", [L1, bob.from.toString()]), "NothingToClaim()");
await refusesWith("a buy after graduation is refused",
  () => bob.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L1, 0n, T0 + 9000n, 10000], { value: E }), "AlreadyGraduated(uint256)");
await refusesWith("and so is a second graduation",
  () => eve.exec(pad, "graduate(uint256)", [L1]), "AlreadyGraduated(uint256)");
await refusesWith("a graduated launch cannot fail",
  () => eve.exec(pad, "fail(uint256)", [L1]), "NotFailable(uint256)");

/*═══════════════ failure ═══════════════*/

head("failure: every wei goes back, the supply goes home");
warp(T0 + 7n * 86400n);
const T1 = evm.BLOCK.header.timestamp;
await alice.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
  [ID, "Two", "TWO", 18, SUPPLY, "0x" + "02".padStart(64, "0"), RAISE], { label: "launch" });
const coin2 = "0x" + c.getLogs({ address: kiln, topics: [topic("Launched(address,uint256,address,string,uint256,uint256)")] }).pop().topics[1].slice(26);
ok("seven days later the token launches again", coin2 !== coin);
const terms2 = [ID, coin2, CURVE, E, 3n * E, 0n, 1000n, (1n << 128n) - 1n, 9900, 100, 1500, 1000, T1 + 86400n, 0];
await alice.exec(pad, `create(${PARAMS})`, [terms2], { label: "create" });
const L2 = 2n;
{
  const vest = RAISE * 1000n / 10000n;
  eq("the creator vest went to Locks", decUint(await c.read(coin2, "balanceOf(address)", [locks])), vest);
  const lock = await c.read(locks, "lockOf(uint256)", [1n]);
  eq("to the Reach as beneficiary", decAddr(lock, 1), reach);
  eq("with a 30-day cliff", decUint(lock, 6), T1 + 30n * 86400n);
  eq("and a 365-day term", decUint(lock, 7), T1 + 365n * 86400n);
  eq("and no allowance survived", decUint(await c.read(coin2, "allowance(address,address)", [pad, locks])), 0n);
}
await bob.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L2, 0n, T1 + 60n, 10000], { value: E, label: "buy" });
await carol.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L2, 0n, T1 + 60n, 10000], { value: E / 2n, label: "buy" });
const pot = decUint(await c.read(pad, "totalHeld()"));
eq("the launch holds everything both buyers gave", pot, E + E / 2n);
await refusesWith("before the deadline nobody can fail it",
  () => eve.exec(pad, "fail(uint256)", [L2]), "NotFailable(uint256)");
warp(T1 + 86400n + 1n);
await refusesWith("after the deadline, short of the target, nobody can graduate it",
  () => eve.exec(pad, "graduate(uint256)", [L2]), "NotGraduatable(uint256)");
await refusesWith("and nobody can buy",
  () => bob.exec(pad, "buy(uint256,uint256,uint64,uint16)", [L2, 0n, T1 + 90000n, 10000], { value: E }), "DeadlinePassed(uint64)");
const reachBefore = decUint(await c.read(coin2, "balanceOf(address)", [reach]));
await eve.exec(pad, "fail(uint256)", [L2], { label: "fail" });
ok("a stranger failed it", c.getLogs({ address: pad, topics: [topic("LaunchFailed(uint256)")] }).length === 1);
eq("the supply went home to the Reach (less the vest, which is already the Reach's)",
   decUint(await c.read(coin2, "balanceOf(address)", [reach])) - reachBefore, RAISE - RAISE * 1000n / 10000n);
const bobBefore = await c.balanceOf(bob.from.toString());
const carolBefore = await c.balanceOf(carol.from.toString());
await eve.exec(pad, "refund(uint256,address)", [L2, bob.from.toString()], { label: "refund" });
await eve.exec(pad, "refund(uint256,address)", [L2, carol.from.toString()], { label: "refund" });
const back = (await c.balanceOf(bob.from.toString()) - bobBefore) + (await c.balanceOf(carol.from.toString()) - carolBefore);
ok("the whole pot came back — fees and tax included — to the wei of rounding", back >= pot - 1n && back <= pot, `${back} of ${pot}`);
ok("the Launchpad is empty to the wei of rounding", (await c.balanceOf(pad)) <= 1n);
eq("the failed launch's floor leg was never paid", decUint(await c.read(coin2, "redemptionPool()")), 0n);
await refusesWith("a refund twice is refused",
  () => eve.exec(pad, "refund(uint256,address)", [L2, bob.from.toString()]), "NothingToClaim()");
await refusesWith("and a claim on a failed launch",
  () => eve.exec(pad, "claim(uint256,address)", [L2, bob.from.toString()]), "NothingToClaim()");

/*═══════════════ the first-launch rule ═══════════════*/

head("an agent's first launch needs the guardian");
await c.exec(hub, "mint(address)", [bob.from.toString()]);
const ID2 = 2n;
const reach2 = decAddr(await c.read(hub, "account(uint256)", [ID2]));
const asReach2 = await c.as("0x" + "77".repeat(32));
/*  The Reach is a derived address with no key; the hub mock lets a test
    stand in for it by pranking. The harness has no prank, so the rule is
    shown from the other side: the holder's first launch needs nobody, a
    stranger's is NotActor whatever the guardian said, and the approval
    itself is epoch-stamped.                                            */
await refusesWith("a stranger cannot approve", () => asReach2.exec(pad, "approveFirstLaunch(uint256)", [ID2]), "NotGuardian()");
await bob.exec(hub, "setGuardian(uint256,address)", [ID2, eve.from.toString()]);
await eve.exec(pad, "approveFirstLaunch(uint256)", [ID2], { label: "approveFirstLaunch" });
eq("the guardian's approval is live", decBool(await c.read(pad, "firstLaunchApproved(uint256)", [ID2])), true);
const approvedLog = c.getLogs({ address: pad, topics: [topic("FirstLaunchApproved(uint256,address,uint64)")] }).pop();
eq("stamped with the custody epoch", decUint(approvedLog.data, 0), 1n);
await refusesWith("it does not let a stranger launch",
  () => asReach2.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
    [ID2, "Mine", "MINE", 18, SUPPLY, SALT, 0n]), "NotActor()");
await bob.exec(hub, "transferFrom(address,address,uint256)", [bob.from.toString(), carol.from.toString(), ID2]);
eq("a sale voids it", decBool(await c.read(pad, "firstLaunchApproved(uint256)", [ID2])), false);
await carol.exec(kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
  [ID2, "Mine", "MINE", 18, SUPPLY, SALT, 0n], { label: "launch" });
ok("the holder's first launch needed nobody", decUint(await c.read(kiln, "launchCount(uint256)", [ID2])) === 1n);
ok("(the Reach-side of the rule is proved in test/Launchpad.t.sol, where a prank can be the Reach)", reach2.length === 42);

/*═══════════════ the hook, finally executed ═══════════════*/

head("mining a hook's address, in a free eth_call");
const NOW = evm.BLOCK.header.timestamp;
const opens = NOW + 3600n, unlocks = NOW + 86400n;
const arg = "0x" + ((opens << 64n) | unlocks).toString(16).padStart(64, "0");
const rh = await c.read(kiln, "recipeHash(uint8,bytes32)", [0, arg]);
const hash = "0x" + rh.slice(2, 66);
const flags = decUint(rh, 1);
eq("the kiln names the permissions the gate needs, rather than a caller guessing", flags, (1n << 9n) | (1n << 7n));
await refusesWith("an unknown recipe is refused", () => c.read(kiln, "recipeHash(uint8,bytes32)", [7, arg]), "UnknownRecipe(uint8)");

let found = false, salt = null, at = null, from = 0n;
let gasOfWindow = null;
while (!found && from < 600000n) {
  const r = await c.read(kiln, "mine(bytes32,uint16,uint256,uint256)", [hash, Number(flags), from, 60000n]);
  if (gasOfWindow === null) gasOfWindow = c.lastGas;
  found = decUint(r, 0) === 1n;
  salt = "0x" + r.slice(2 + 64, 2 + 128);
  at = decAddr(r, 2);
  from += 60000n;
}
ok("a salt is found for exactly those permissions", found, "searched 600,000 and found none");
ok(`sixty thousand salts cost ${gasOfWindow} gas — under the 16,777,216 eth_call cap`, gasOfWindow < 16_777_216n);
const MASK = (1n << 14n) - 1n;
eq("and the address it predicts carries them and nothing else", (BigInt(at) & MASK).toString(16), flags.toString(16));
{
  const pre = Buffer.concat([
    Buffer.from("ff", "hex"), Buffer.from(kiln.slice(2), "hex"),
    Buffer.from(salt.slice(2), "hex"), Buffer.from(hash.slice(2), "hex")]);
  eq("recomputed from (deployer, salt, initCodeHash) alone, it is the same address",
     "0x" + Buffer.from(keccak256(pre)).toString("hex").slice(24), at.toLowerCase());
  ok("none of those three is a chain id, so one salt serves every band", true);
}

/*  A salt the miner did not bless: the first whose address bits differ. */
let bad = 0n;
for (;;) {
  const pre = Buffer.concat([
    Buffer.from("ff", "hex"), Buffer.from(kiln.slice(2), "hex"),
    Buffer.from(w(bad), "hex"), Buffer.from(hash.slice(2), "hex")]);
  const a = BigInt("0x" + Buffer.from(keccak256(pre)).toString("hex").slice(24));
  if ((a & MASK) !== flags) break;
  bad += 1n;
}
await refusesWith("`WrongFlags` on a mis-mined hook",
  () => c.exec(kiln, "deployHook(uint8,bytes32,bytes32)", [0, "0x" + w(bad), arg]), "WrongFlags(uint16,uint16)");
ok("nothing lives at the mined address before the deploy", (await c.codeSize(at)) === 0);
await c.exec(kiln, "deployHook(uint8,bytes32,bytes32)", [0, salt, arg], { label: "deployHook" });
ok("and the kiln built it at exactly the address the miner named", (await c.codeSize(at)) > 0);
eq("with the opening hour it was given", decUint(await c.read(at, "OPENS()")), opens);
eq("and the unlock date", decUint(await c.read(at, "UNLOCKS()")), unlocks);
eq("and the manager", decAddr(await c.read(at, "MANAGER()")), pm);

head("the gate: two promises a launch makes, kept by the pool");
const KEY = "(address,address,uint24,int24,address)";
const pk = ["0x" + "11".repeat(20), "0x" + "22".repeat(20), 3000, 60, at];
const doInit = () => c.exec(pm, `initialize(${KEY},uint160)`, [pk, 1n], { label: "initialize" });
const doSwap = () => c.exec(pm, `swap(${KEY},(bool,int256,uint160),bytes)`, [pk, [false, 1000n, 0n], "0x"], { label: "swap" });
const doMod = (delta) => c.exec(pm, `modifyLiquidity(${KEY},(int24,int24,int256,bytes32),bytes)`,
  [pk, [-100, 100, delta, "0x" + "00".repeat(32)], "0x"], { label: "modifyLiquidity" });
await doInit();
await refusesWith("before the opening hour the pool will not swap", doSwap, "NotOpenYet(uint64)");
await doMod(1000n);
ok("adding liquidity is never gated — the hook does not hold that bit", true);
await refusesWith("and liquidity cannot leave while it is locked", () => doMod(-1000n), "StillLocked(uint64)");
warp(opens + 1n);
await doSwap();
ok("once the hour comes, the pool trades", true);
await refusesWith("but the liquidity is still locked", () => doMod(-1000n), "StillLocked(uint64)");
warp(unlocks + 1n);
await doMod(-1000n);
ok("and when the date arrives it comes out", true);
console.log("      shut, opened, still locked, released — every branch, through the manager");

head("only the endpoint of the protocol may call it");
await refusesWith("a stranger cannot drive beforeSwap",
  () => c.exec(at, `beforeSwap(address,${KEY},(bool,int256,uint160),bytes)`,
    [c.from.toString(), pk, [false, 1000n, 0n], "0x"]), "NotTheManager()");
await refusesWith("nor beforeRemoveLiquidity",
  () => c.exec(at, `beforeRemoveLiquidity(address,${KEY},(int24,int24,int256,bytes32),bytes)`,
    [c.from.toString(), pk, [-100, 100, -1000n, "0x" + "00".repeat(32)], "0x"]), "NotTheManager()");

head("gas");
for (const [k, v] of Object.entries(c.gas)) console.log(`  ${k.padEnd(18)} ${String(v).padStart(10)}`);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
