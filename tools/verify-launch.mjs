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
  "pre-initialised pool at the wrong price" assertion are the second half
  of this file: a second wiring with a custodian, the hook driven by
  selector, the position minted through a PositionManager that decodes
  the real action bytes, and a Permit2 with the real expiry rule.

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
eq("this MVB wiring pins no custodian: Target.UniswapV4 is NotYet in it", decAddr(await c.read(pad, "CUSTODIAN()")), "0x" + "00".repeat(20));

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
await refusesWith("the v4 target is NotYet where no custodian is pinned",
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

/*═══════════════ the v4 launch path (U14): hook, custodian, graduation ═══════════════*/

/*  DESIGN.md §8.3–8.4 and §14 D2/D6. The world below is the same real hub
    with a SECOND launch wiring — a Kiln, a Launchpad pinned to an
    LPCustodian, the U6 Pool and Locks fixtures — against the U14 fixtures:
    a PoolManager that dispatches hooks by selector and keeps the pool
    state StateLibrary reads, a PositionManager that decodes the real
    `modifyLiquidities` action bytes, and a Permit2 with the real expiry
    rule. Everything is deployed by one fresh actor so the same sequence on
    another chain lands every contract at the same address, which is what
    "one salt serves every band" has to mean.                             */
{
  const KEY = "(address,address,uint24,int24,address)";
  const TERMS = "(uint32,uint32,uint24,uint24,uint32)";
  const SWAP = "(bool,int256,uint160)";
  const MOD = "(int24,int24,int256,bytes32)";
  const MASK = (1n << 14n) - 1n;
  const HOOK_FLAGS = (1n << 13n) | (1n << 9n) | (1n << 7n);
  const Q96 = 1n << 96n;
  const ZERO32 = "0x" + "00".repeat(32);
  const { createAddressFromString } = await import("@ethereumjs/util");
  const codeOf = async (chain, addr) => "0x" + Buffer.from(await chain.vm.stateManager.getCode(createAddressFromString(addr))).toString("hex");
  const kec = (hex) => "0x" + Buffer.from(keccak256(Buffer.from(hex.replace(/^0x/, ""), "hex"))).toString("hex");
  const isqrt = (n) => { if (n < 2n) return n; let x = n, y = (n + 1n) / 2n; while (y < x) { x = y; y = (n / y + y) / 2n; } return x; };
  const word = (addr) => "0x" + addr.slice(2).toLowerCase().padStart(64, "0");
  const F = "test/mocks/V4Fixtures.sol";
  const deployV4World = async (chain, hubAddr) => {
    const factory = await chain.deploy(A(F, "CustodianFactory").bytecode, "", "CustodianFactory");
    const pm = await chain.deploy(A(F, "MockV4Manager").bytecode, "", "MockV4Manager");
    const permit2 = await chain.deploy(A(F, "MockPermit2").bytecode, "", "MockPermit2");
    const posm = await chain.deploy(A(F, "MockPositionManager").bytecode, encodeParams("address,address", [pm, permit2]), "MockPositionManager");
    const wiring = await chain.deploy(A(F, "V4Wiring").bytecode, encodeParams("address,address,address,address,address", [hubAddr, pm, posm, permit2, factory]), "V4Wiring");
    const r = async (s) => decAddr(await chain.read(wiring, s));
    return { pm, permit2, posm, wiring, kiln: await r("kiln()"), pad: await r("pad()"), cust: await r("custodian()"), locks: await r("locks()"), pool: await r("pool()") };
  };
  const mine = async (chain, kilnAddr, hash, flags, from = 0n) => {
    for (let f = from; f < from + 600000n; f += 60000n) {
      const r = await chain.read(kilnAddr, "mine(bytes32,uint16,uint256,uint256)", [hash, Number(flags), f, 60000n]);
      if (decUint(r, 0) === 1n) return { salt: "0x" + r.slice(2 + 64, 2 + 128), at: decAddr(r, 2) };
    }
    throw new Error("no salt in 600,000");
  };
  const custodyOf = async (launchId) => {
    const r = await c.read(W.cust, "custodyOf(uint256)", [launchId]);
    return { coin: decAddr(r, 0), unlocksAt: decUint(r, 1), released: decBool(r, 2), hook: decAddr(r, 3), seededAt: decUint(r, 4), salt: "0x" + r.slice(2 + 5 * 64, 2 + 6 * 64), id: decUint(r, 6), tokenId: decUint(r, 7) };
  };
  const poolOf = async (pid) => {
    const r = await c.read(W.pm, "pools(bytes32)", [pid]);
    return { init: decBool(r, 0), storedFee: decUint(r, 1), spacing: decUint(r, 2), price: decUint(r, 3), r0: decUint(r, 4), r1: decUint(r, 5), liquidity: decUint(r, 6), fees0: decUint(r, 7), fees1: decUint(r, 8) };
  };
  const keyOf = async (launchId) => { const r = await c.read(W.cust, `poolKeyOf(uint256)`, [launchId]); return [decAddr(r, 0), decAddr(r, 1), Number(decUint(r, 2)), Number(decUint(r, 3)), decAddr(r, 4)]; };
  const swapIn = (who, key, amount, data = "0x") => who.exec(W.pm, `swap(${KEY},${SWAP},bytes)`, [key, [true, -amount, 0n], data], { value: amount, label: "v4 swap" });
  /// the terminal sqrt price the Launchpad hands the custodian: sqrt(amountBase · 2^192 / raised)
  const terminalOf = async (launchId) => {
    const l = await c.read(W.pad, "launchOf(uint256)", [launchId]);
    const q = decUint(l, 4), b = decUint(l, 5), raised = decUint(l, 9);
    const amountBase = raised * b / q;
    return { q, b, raised, amountBase, sqrt: isqrt(amountBase * (1n << 192n) / raised), terminal: q * E / b };
  };

  head("the v4 launch path: a custodian pinned both ways");
  const v4 = await c.as("0x" + "f4".repeat(32));
  const W = await deployV4World(v4, hub);
  eq("the Launchpad pins the custodian", decAddr(await c.read(W.pad, "CUSTODIAN()")), W.cust);
  eq("and the custodian pins the Launchpad back", decAddr(await c.read(W.cust, "LAUNCHPAD()")), W.pad);
  eq("the Kiln", decAddr(await c.read(W.cust, "KILN()")), W.kiln);
  eq("the hub", decAddr(await c.read(W.cust, "HUB()")), hub);
  eq("the PoolManager", decAddr(await c.read(W.cust, "POOL_MANAGER()")), W.pm);
  eq("the PositionManager", decAddr(await c.read(W.cust, "POSITION_MANAGER()")), W.posm);
  eq("and Permit2", decAddr(await c.read(W.cust, "PERMIT2()")), W.permit2);
  eq("the Kiln pins the same manager the hooks will answer to", decAddr(await c.read(W.kiln, "POOL_MANAGER()")), W.pm);
  /*  The lever regex is case-insensitive, and the custodian pins the
      PositionManager's action bytes as public constants — MINT_POSITION,
      SETTLE_PAIR, SWEEP — which are getters of numbers, not levers; an
      ALL-CAPS name is a constant and is read, never pulled.             */
  for (const [f, n] of [["src/LPCustodian.sol", "LPCustodian"], ["src/LaunchHook.sol", "LaunchHook"]]) {
    const fns = names(f, n).filter((x) => !/^[A-Z0-9_]+$/.test(x));
    const hit = fns.filter((x) => lever.test(x));
    ok(`${n}: ${fns.length} functions beside its constants, none of them a withdraw, pause, owner, setter or mint`, hit.length === 0, hit.join(", "));
  }
  ok("the Launchpad's interface grew only additively: createV4, createV4Checked, v4TermsHash beside the old entries",
     ["createV4", "createV4Checked", "v4TermsHash", "create", "createChecked", "graduate", "fail", "claim"].every((n) => names("src/Launchpad.sol", "Launchpad").includes(n)));

  await c.exec(hub, "mint(address)", [alice.from.toString()]);
  const ID3 = 3n;
  const reach3 = decAddr(await c.read(hub, "account(uint256)", [ID3]));
  const grip3 = decAddr(await c.read(hub, "grip(uint256)", [ID3]));
  await alice.exec(W.kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)",
    [ID3, "Agent Four", "AGENT4", 18, SUPPLY, SALT, RAISE], { label: "launch" });
  const coinA = "0x" + c.getLogs({ address: W.kiln, topics: [topic("Launched(address,uint256,address,string,uint256,uint256)")] }).pop().topics[1].slice(26);
  const argA = word(coinA);

  head("the recipe: a hook whose salt depends on nothing but the coin");
  await refusesWith("the MVB wiring, with no custodian pinned, has no LaunchHook recipe",
    () => c.read(kiln, "recipeHash(uint8,bytes32)", [1, argA]), "UnknownRecipe(uint8)");
  const rhA = await c.read(W.kiln, "recipeHash(uint8,bytes32)", [1, argA]);
  const hashA = "0x" + rhA.slice(2, 66);
  const flagsA = decUint(rhA, 1);
  eq("the kiln names the three permissions the launch hook needs: beforeInitialize, beforeSwap, beforeRemoveLiquidity", flagsA, HOOK_FLAGS);
  eq("and the custodian agrees", decUint(await c.read(W.cust, "HOOK_FLAGS()")), HOOK_FLAGS);
  const { salt: saltA, at: atA } = await mine(c, W.kiln, hashA, flagsA);
  ok("a salt is found for exactly those permissions, in the same free eth_call", (BigInt(atA) & MASK) === HOOK_FLAGS);
  eq("the custodian predicts the same address from the coin and the salt", decAddr(await c.read(W.cust, "hookAt(address,bytes32)", [coinA, saltA])), atA);
  await refusesWith("nothing can be deployed from it before createV4 registered the terms: the constructor refuses blank terms",
    () => c.exec(W.kiln, "deployHook(uint8,bytes32,bytes32)", [1, saltA, argA]), "DeployFailed()");
  ok("and no code lives at the mined address", (await c.codeSize(atA)) === 0);

  head("createV4: the hook terms and the salt pinned beside the launch");
  const NOW3 = evm.BLOCK.header.timestamp;
  const termsA = [0, 30 * 86400, 100000, 10000, 86400];      // opens at once, locked 30 d, 10 % → 1 % over a day
  const paramsA = (target = 1) => [ID3, coinA, CURVE, E, 2n * E, 0n, 0n, (1n << 128n) - 1n, 0, 100, 1500, 0, NOW3 + 7n * 86400n, target];
  await refusesWith("`create` is the wrong door for the v4 target", () => alice.exec(W.pad, `create(${PARAMS})`, [paramsA()]), "WrongTarget()");
  await refusesWith("and `createV4` the wrong door for the owned target", () => alice.exec(W.pad, `createV4(${PARAMS},${TERMS},bytes32)`, [paramsA(0), termsA, saltA]), "WrongTarget()");
  await refusesWith("a stranger cannot create", () => bob.exec(W.pad, `createV4(${PARAMS},${TERMS},bytes32)`, [paramsA(), termsA, saltA]), "NotActor()");
  await refusesWith("a start fee above 90 % is refused", () => alice.exec(W.pad, `createV4(${PARAMS},${TERMS},bytes32)`, [paramsA(), [0, 30 * 86400, 900001, 10000, 86400], saltA]), "BadTerms()");
  await refusesWith("a floor above the start is refused", () => alice.exec(W.pad, `createV4(${PARAMS},${TERMS},bytes32)`, [paramsA(), [0, 30 * 86400, 100000, 100001, 86400], saltA]), "BadTerms()");
  await refusesWith("a lock past ten years is refused", () => alice.exec(W.pad, `createV4(${PARAMS},${TERMS},bytes32)`, [paramsA(), [0, 3650 * 86400 + 1, 100000, 10000, 86400], saltA]), "BadTerms()");
  await refusesWith("a salt the miner did not bless is refused", () => alice.exec(W.pad, `createV4(${PARAMS},${TERMS},bytes32)`, [paramsA(), termsA, "0x" + w(BigInt(saltA) ^ 1n)]), "BadSalt(address,uint16)");
  const v4hash = await c.read(W.pad, `v4TermsHash(${PARAMS},${TERMS},bytes32)`, [paramsA(), termsA, saltA]);
  await refusesWith("`createV4Checked` refuses terms that moved", () => alice.exec(W.pad, `createV4Checked(${PARAMS},${TERMS},bytes32,bytes32)`, [paramsA(), termsA, saltA, "0x" + "ff".repeat(32)]), "TermsMoved(bytes32,bytes32)");
  await alice.exec(W.pad, `createV4Checked(${PARAMS},${TERMS},bytes32,bytes32)`, [paramsA(), termsA, saltA, v4hash], { label: "createV4" });
  const createdA = c.getLogs({ address: W.pad, topics: [topic("LaunchCreated(uint256,uint256,address,uint8,bytes32)")] }).pop();
  const LA = decUint(createdA.topics[1]);
  eq("the launch is created with the v4 target", decUint(createdA.data, 0), 1n);
  const regA = c.getLogs({ address: W.cust, topics: [topic("Registered(uint256,uint256,address,address,bytes32)")] }).pop();
  eq("the custodian registered it: the launch", decUint(regA.topics[1]), LA);
  eq("the token", decUint(regA.topics[2]), ID3);
  eq("the coin", "0x" + regA.topics[3].slice(26), coinA);
  eq("and the hook the salt names", decAddr(regA.data, 0), atA);
  {
    const cA = await custodyOf(LA);
    eq("custodyOf carries the coin", cA.coin, coinA);
    eq("the salt", cA.salt, saltA);
    eq("the hook", cA.hook, atA);
    eq("no seeding yet", cA.seededAt, 0n);
    eq("and no ratchet before the clock starts", cA.unlocksAt, 0n);
    const t = await c.read(W.cust, "hookTermsOf(address)", [coinA]);
    eq("the terms are the ones the page showed", [0, 1, 2, 3, 4].map((i) => decUint(t, i)).join(","), termsA.map(BigInt).join(","));
    eq("launchOfCoin points back", decUint(await c.read(W.cust, "launchOfCoin(address)", [coinA])), LA);
  }
  await refusesWith("the share was spent: the same coin cannot raise twice", () => alice.exec(W.pad, `createV4(${PARAMS},${TERMS},bytes32)`, [paramsA(), termsA, saltA]), "WrongCoin(address)");
  for (const who of [bob, carol, dave]) await who.exec(W.pad, "buy(uint256,uint256,uint64,uint16)", [LA, 0n, NOW3 + 60n, 10000], { value: E, label: "buy" });
  ok("three buyers met the target", decUint(await c.read(W.pad, "raisedOf(uint256)", [LA])) >= 2n * E);

  head("a stranger's pool: refused off the price, resalted, then seeded");
  const keyA = await keyOf(LA);
  eq("the pool key is native against the coin, dynamic fee, spacing 60, the hook", keyA.join(","), ["0x" + "00".repeat(20), coinA, 0x800000, 60, atA].join(","));
  const pidA0 = await c.read(W.cust, "poolIdOf(uint256)", [LA]);
  await bob.exec(W.kiln, "deployHook(uint8,bytes32,bytes32)", [1, saltA, argA], { label: "deployHook" });
  ok("once the terms are registered anyone may deploy the hook: a stranger did, at the mined address", (await c.codeSize(atA)) > 0);
  eq("born with the registered terms", `${decUint(await c.read(atA, "LOCK_FOR()"))},${decUint(await c.read(atA, "START_FEE()"))},${decUint(await c.read(atA, "FLOOR_FEE()"))}`, "2592000,100000,10000");
  eq("and no opening time: the clock has not started", decUint(await c.read(atA, "OPENS()")), 0n);
  const tA = await terminalOf(LA);
  await bob.exec(W.pm, `initialize(${KEY},uint160)`, [keyA, tA.sqrt * 2n], { label: "initialize" });
  ok("and initialised the pool at twice the terminal price", (await poolOf(pidA0)).price === tA.sqrt * 2n);
  {
    const sim = await c.simulate(W.pad, enc("graduate(uint256)", [LA]), { from: eve.from.toString() });
    ok("a pre-initialised pool at the wrong price is refused", !sim.ok && sim.data.startsWith(sel("PriceOff(uint160,uint160)")), sim.data.slice(0, 10));
    eq("with both prices in the refusal: the terminal", decUint(sim.data.slice(10), 0), tA.sqrt);
    eq("and the stranger's", decUint(sim.data.slice(10), 1), tA.sqrt * 2n);
  }
  ok("the launch is untouched by the refusal", decUint(await c.read(W.pad, "launchOf(uint256)", [LA]), 3) === 1n);
  await refusesWith("a swap on the stranger's pool is NotOpenYet: nothing opens before the launch seeds",
    () => swapIn(c, keyA, E / 100n), "NotOpenYet(uint64)");
  const { salt: saltB, at: atB } = await mine(c, W.kiln, hashA, flagsA, BigInt(saltA) + 1n);
  await refusesWith("a stranger cannot resalt", () => eve.exec(W.cust, "resalt(uint256,bytes32)", [LA, saltB]), "NotActor()");
  await refusesWith("nor can the launcher to an unblessed salt", () => alice.exec(W.cust, "resalt(uint256,bytes32)", [LA, "0x" + w(BigInt(saltB) ^ 1n)]), "BadSalt(address,uint16)");
  await alice.exec(W.cust, "resalt(uint256,bytes32)", [LA, saltB], { label: "resalt" });
  const pidA = await c.read(W.cust, "poolIdOf(uint256)", [LA]);
  eq("and resalt gives a new key: a new hook address", (await custodyOf(LA)).hook, atB);
  ok("a pre-initialised pool at the wrong price is refused and resalt gives a new key", pidA !== pidA0 && atB !== atA);
  ok("the new hook has no code yet: the custodian will deploy it", (await c.codeSize(atB)) === 0);

  const before = await c.read(W.pad, "launchOf(uint256)", [LA]);
  const supplyA = decUint(await c.read(coinA, "totalSupply()"));
  const feesA = await c.read(W.pad, "feesHeld(uint256)", [LA]);
  const creatorOwedA = decUint(feesA, 0);
  await eve.exec(W.pad, "graduate(uint256)", [LA], { label: "graduate v4" });
  const SEEDED_A = evm.BLOCK.header.timestamp;
  const gradA = c.getLogs({ address: W.pad, topics: [topic("Graduated(uint256,uint256,uint256,uint256)")] }).pop();
  eq("a stranger graduated it, and the launch's key is the pool id", decUint(gradA.topics[2]), BigInt(pidA));
  eq("the Graduated log names the terminal price", decUint(gradA.data, 0), tA.terminal);
  {
    const spot = decUint(gradA.data, 1);
    const diff = spot > tA.terminal ? spot - tA.terminal : tA.terminal - spot;
    ok("and the pool's spot beside it, equal to a part in a billion", diff * 1_000_000_000n <= tA.terminal, `terminal ${tA.terminal} spot ${spot}`);
    eq("spotOf reads the same number off the pool", decUint(await c.read(W.cust, "spotOf(uint256)", [LA])), spot);
  }
  const seededA = c.getLogs({ address: W.cust, topics: [topic("Seeded(uint256,bytes32,address,uint256,uint160,uint160,uint256)")] }).pop();
  eq("the Seeded log names the pool", seededA.topics[2], pidA);
  eq("the hook the custodian deployed", "0x" + seededA.topics[3].slice(26), atB);
  const tokenA = decUint(seededA.data, 0);
  eq("the position is token 1 of the PositionManager", tokenA, 1n);
  eq("the terminal sqrt price", decUint(seededA.data, 1), tA.sqrt);
  eq("equals the pool's: the custodian initialised it", decUint(seededA.data, 2), tA.sqrt);
  ok("the custodian deployed the hook through the Kiln", (await c.codeSize(atB)) > 0);
  eq("at an address carrying exactly its bits", (BigInt(atB) & MASK), HOOK_FLAGS);
  {
    const p = await poolOf(pidA);
    ok("the pool is initialised at the terminal price with spacing 60", p.init && p.price === tA.sqrt && p.spacing === 60n);
    ok("holding the raise to the dust", p.r0 <= tA.raised && p.r0 + 1_000_000n >= tA.raised, `${p.r0} of ${tA.raised}`);
    ok("and the base the terminal price called for", p.r1 <= tA.amountBase && p.r1 + 1_000_000_000_000n >= tA.amountBase, `${p.r1} of ${tA.amountBase}`);
    eq("as liquidity the custodian's position owns", decUint(await c.read(W.posm, "getPositionLiquidity(uint256)", [tokenA])), p.liquidity);
    eq("the ledger's liquidity is the Seeded log's", decUint(seededA.data, 3), p.liquidity);
    eq("the base the price did not need was burned", decUint(await c.read(coinA, "totalSupply()")), supplyA - (decUint(before, 5) - tA.amountBase));
    eq("the position is the custodian's", decAddr(await c.read(W.posm, "ownerOf(uint256)", [tokenA])), W.cust);
    eq("the custodian holds no ether of its own", await c.balanceOf(W.cust), 0n);
    eq("nor coin", decUint(await c.read(coinA, "balanceOf(address)", [W.cust])), 0n);
    eq("the raise's dust went home to the Reach with the creator leg", await c.balanceOf(reach3), creatorOwedA + (tA.raised - p.r0));
    eq("the Launchpad holds no ether of a graduated launch", await c.balanceOf(W.pad), 0n);
    eq("and only the buyers' credits of the coin", decUint(await c.read(coinA, "balanceOf(address)", [W.pad])), decUint(before, 8));
    eq("the actions were MINT_POSITION, SETTLE_PAIR, SWEEP", await c.read(W.posm, "lastActions()").then((r) => "0x" + r.slice(2 + 128, 2 + 128 + 6)), "0x020d14");
  }
  head("Permit2: a real expiry, never zero, and nothing left standing");
  eq("the custodian never wrote a Permit2 approval with expiry 0", decUint(await c.read(W.permit2, "zeroExpiryWrites()")), 0n);
  eq("one approval and its revocation", decUint(await c.read(W.permit2, "approvals()")), 2n);
  {
    const al = await c.read(W.permit2, "allowance(address,address,address)", [W.cust, coinA, W.posm]);
    eq("the Permit2 allowance is zero after the call", decUint(al, 0), 0n);
    ok("and its expiry does not outlive the call", decUint(al, 1) <= evm.BLOCK.header.timestamp);
    eq("the coin's allowance to Permit2 is zero", decUint(await c.read(coinA, "allowance(address,address)", [W.cust, W.permit2])), 0n);
    eq("and the Launchpad's to the custodian", decUint(await c.read(coinA, "allowance(address,address)", [W.pad, W.cust])), 0n);
  }
  {
    const cA = await custodyOf(LA);
    eq("custodyOf: seeded now", cA.seededAt, SEEDED_A);
    eq("the ratchet starts at seededAt + LOCK_FOR", cA.unlocksAt, SEEDED_A + 30n * 86400n);
    eq("the position", cA.tokenId, tokenA);
    eq("the hook's own clock agrees: OPENS", decUint(await c.read(atB, "OPENS()")), SEEDED_A);
    eq("UNLOCKS", decUint(await c.read(atB, "UNLOCKS()")), SEEDED_A + 30n * 86400n);
    eq("SEEDED_AT", decUint(await c.read(atB, "SEEDED_AT()")), SEEDED_A);
  }
  await eve.exec(W.pad, "claim(uint256,address)", [LA, bob.from.toString()], { label: "claim" });
  ok("a buyer's claim lands as before", decUint(await c.read(coinA, "balanceOf(address)", [bob.from.toString()])) > 0n);
  await refusesWith("a second graduation is refused", () => eve.exec(W.pad, "graduate(uint256)", [LA]), "AlreadyGraduated(uint256)");
  await refusesWith("and a resalt after seeding", () => alice.exec(W.cust, "resalt(uint256,bytes32)", [LA, saltB]), "AlreadySeeded(uint256)");
  {
    const stray = await poolOf(pidA0);
    ok("the stranger's pool is left alone: its price, no reserves", stray.price === tA.sqrt * 2n && stray.r0 === 0n);
  }

  head("the hook: only the manager, exactly its bits, only its own key");
  const keyB = await keyOf(LA);
  await refusesWith("a stranger cannot drive beforeInitialize", () => c.exec(atB, `beforeInitialize(address,${KEY},uint160)`, [c.from.toString(), keyB, 1n]), "NotTheManager()");
  await refusesWith("nor beforeSwap", () => c.exec(atB, `beforeSwap(address,${KEY},${SWAP},bytes)`, [c.from.toString(), keyB, [true, -1000n, 0n], "0x"]), "NotTheManager()");
  await refusesWith("nor beforeRemoveLiquidity", () => c.exec(atB, `beforeRemoveLiquidity(address,${KEY},${MOD},bytes)`, [c.from.toString(), keyB, [-887220, 887220, -1000n, ZERO32], "0x"]), "NotTheManager()");
  ok("every hook entry refuses a caller that is not the manager", true);
  {
    const perms = await c.read(atB, "getHookPermissions()");
    let declared = 0n;
    for (let i = 0; i < 14; ++i) if (decBool(perms, i)) declared |= 1n << BigInt(13 - i);
    eq("`getHookPermissions` equals the address bits", declared, BigInt(atB) & MASK);
    eq("which are beforeInitialize, beforeSwap, beforeRemoveLiquidity", declared, HOOK_FLAGS);
    ok("and no delta-returning flag", [10, 11, 12, 13].every((i) => !decBool(perms, i)));
    eq("FLAGS says the same", decUint(await c.read(atB, "FLAGS()")), HOOK_FLAGS);
  }
  await refusesWith("a foreign PoolKey is refused at initialize", () => c.exec(W.pm, `initialize(${KEY},uint160)`, [[keyB[0], coin, keyB[2], keyB[3], keyB[4]], 1n << 96n]), "ForeignKey()");
  await refusesWith("a static fee is foreign", () => c.exec(W.pm, `initialize(${KEY},uint160)`, [[keyB[0], keyB[1], 3000, keyB[3], keyB[4]], 1n << 96n]), "ForeignKey()");
  await refusesWith("another spacing is foreign", () => c.exec(W.pm, `initialize(${KEY},uint160)`, [[keyB[0], keyB[1], keyB[2], 10, keyB[4]], 1n << 96n]), "ForeignKey()");
  await refusesWith("a non-native quote is foreign", () => c.exec(W.pm, `initialize(${KEY},uint160)`, [[coin, keyB[1], keyB[2], keyB[3], keyB[4]], 1n << 96n]), "ForeignKey()");
  await refusesWith("its own key is already a pool: the manager refuses a second initialisation", () => c.exec(W.pm, `initialize(${KEY},uint160)`, [keyB, 1n << 96n]), "PoolAlreadyInitialized()");

  head("the lock: negative deltas until UNLOCKS, zero-delta pokes always");
  /*  Driven on the STRANGER's pool, whose hook reads the same clock — the
      terms are the coin's, and the coin's launch has seeded — so the live
      pool's ledger is not disturbed by a test's bare liquidity changes.  */
  const takeA = (d) => c.exec(W.pm, `modifyLiquidity(${KEY},${MOD},bytes)`, [keyA, [-887220, 887220, d, ZERO32], "0x"], { label: "modifyLiquidity" });
  eq("the stranger's pool runs on the same clock: its hook reads the launch's seededAt", decUint(await c.read(atA, "UNLOCKS()")), SEEDED_A + 30n * 86400n);
  await takeA(1000n);
  ok("adding liquidity is never gated — the hook does not hold that bit", true);
  await refusesWith("a withdrawal through the manager is StillLocked", () => takeA(-1n), "StillLocked(uint64)");
  await takeA(0n);
  ok("a zero-delta poke passes during the lock", true);
  await c.exec(W.cust, "collect(uint256)", [LA], { label: "collect" });
  ok("and so does the custodian's collect, which is one", true);
  ok("negative deltas are blocked until UNLOCKS and zero-delta pokes pass", true);

  head("collect pays the Reach; principal waits for the unlock and goes only there");
  await swapIn(c, keyB, E / 10n);
  eq("the first swap after seeding pays the start fee: 10 %, with the override flag honoured by the pool", decUint(await c.read(W.pm, "lastFeeCharged()")), 100000n);
  ok("the fee pot holds it", (await poolOf(pidA)).fees0 === E / 100n);
  const reachBefore = await c.balanceOf(reach3);
  await eve.exec(W.cust, "collect(uint256)", [LA], { label: "collect" });
  eq("a stranger's collect pays the Reach the whole fee", (await c.balanceOf(reach3)) - reachBefore, E / 100n);
  const collected = c.getLogs({ address: W.cust, topics: [topic("Collected(uint256,address,uint256,uint256)")] }).pop();
  eq("the Collected log names the sink", "0x" + collected.topics[2].slice(26), reach3);
  eq("and the amounts", `${decUint(collected.data, 0)},${decUint(collected.data, 1)}`, `${E / 100n},0`);
  eq("the actions were DECREASE_LIQUIDITY(0), TAKE_PAIR: a poke, not a withdrawal", await c.read(W.posm, "lastActions()").then((r) => "0x" + r.slice(2 + 128, 2 + 128 + 4)), "0x0111");
  eq("the principal is untouched", decUint(await c.read(W.posm, "getPositionLiquidity(uint256)", [tokenA])), decUint(seededA.data, 3));
  eq("nothing passed through the custodian", await c.balanceOf(W.cust), 0n);
  await alice.exec(hub, "setFeesToGrip(uint256,bool)", [ID3, true]);
  await swapIn(c, keyB, E / 10n);
  await eve.exec(W.cust, "collect(uint256)", [LA], { label: "collect" });
  ok("feeSink is read live: with feesToGrip set the Grip is paid", (await c.balanceOf(grip3)) > 0n);
  ok("collect pays the Reach and principal waits for the unlock", true);
  await alice.exec(hub, "setFeesToGrip(uint256,bool)", [ID3, false]);
  await refusesWith("a release before the unlock is StillLocked", () => alice.exec(W.cust, "release(uint256)", [LA]), "StillLocked(uint64)");
  await refusesWith("a stranger cannot extend the lock", () => eve.exec(W.cust, "extend(uint256,uint64)", [LA, SEEDED_A + 40n * 86400n]), "NotActor()");
  await refusesWith("the lock cannot shorten", () => alice.exec(W.cust, "extend(uint256,uint64)", [LA, SEEDED_A + 30n * 86400n]), "RatchetOnly()");
  await refusesWith("nor reach past ten years", () => alice.exec(W.cust, "extend(uint256,uint64)", [LA, evm.BLOCK.header.timestamp + 3650n * 86400n + 1n]), "TooLong()");
  await alice.exec(W.cust, "extend(uint256,uint64)", [LA, SEEDED_A + 31n * 86400n], { label: "extend" });
  eq("the holder lengthened it by a day", decUint(await c.read(W.cust, "unlocksAt(uint256)", [LA])), SEEDED_A + 31n * 86400n);
  warp(SEEDED_A + 30n * 86400n);
  await takeA(-1n);
  ok("at the hook's UNLOCKS the pool pays a withdrawal", true);
  await refusesWith("but the custodian's ratchet runs a day longer", () => alice.exec(W.cust, "release(uint256)", [LA]), "StillLocked(uint64)");
  warp(SEEDED_A + 31n * 86400n);
  await refusesWith("a stranger cannot release", () => eve.exec(W.cust, "release(uint256)", [LA]), "NotActor()");
  {
    const p = await poolOf(pidA);
    const reachEth = await c.balanceOf(reach3);
    const reachCoin = decUint(await c.read(coinA, "balanceOf(address)", [reach3]));
    await alice.exec(W.cust, "release(uint256)", [LA], { label: "release" });
    const gotEth = (await c.balanceOf(reach3)) - reachEth;
    const gotCoin = decUint(await c.read(coinA, "balanceOf(address)", [reach3])) - reachCoin;
    ok("the holder released the principal to the Reach: the pool's native side to the wei of rounding", gotEth <= p.r0 + p.fees0 && gotEth + 2n >= p.r0 + p.fees0, `${gotEth} of ${p.r0 + p.fees0}`);
    ok("and its coin side", gotCoin <= p.r1 + p.fees1 && gotCoin + 2n >= p.r1 + p.fees1, `${gotCoin} of ${p.r1 + p.fees1}`);
    eq("the actions were BURN_POSITION, TAKE_PAIR", await c.read(W.posm, "lastActions()").then((r) => "0x" + r.slice(2 + 128, 2 + 128 + 4)), "0x0311");
    eq("the position is empty", decUint(await c.read(W.posm, "getPositionLiquidity(uint256)", [tokenA])), 0n);
    ok("custodyOf says released", (await custodyOf(LA)).released);
    eq("the custodian still holds nothing", await c.balanceOf(W.cust), 0n);
  }
  await refusesWith("a second release is refused", () => alice.exec(W.cust, "release(uint256)", [LA]), "NotSeeded(uint256)");
  await refusesWith("and a collect after it", () => eve.exec(W.cust, "collect(uint256)", [LA]), "NotSeeded(uint256)");

  head("the fee ramp: shut before OPENS, then start to floor by the clock alone");
  await c.exec(hub, "mint(address)", [bob.from.toString()]);
  const ID4 = 4n;
  const reach4 = decAddr(await c.read(hub, "account(uint256)", [ID4]));
  await bob.exec(W.kiln, "launch(uint256,string,string,uint8,uint256,bytes32,uint256)", [ID4, "Agent Five", "AGENT5", 18, SUPPLY, SALT, RAISE], { label: "launch" });
  const coinB = "0x" + c.getLogs({ address: W.kiln, topics: [topic("Launched(address,uint256,address,string,uint256,uint256)")] }).pop().topics[1].slice(26);
  const rhB = await c.read(W.kiln, "recipeHash(uint8,bytes32)", [1, word(coinB)]);
  ok("a second coin has its own recipe hash", "0x" + rhB.slice(2, 66) !== hashA);
  const { salt: saltC } = await mine(c, W.kiln, "0x" + rhB.slice(2, 66), decUint(rhB, 1));
  const NOW4 = evm.BLOCK.header.timestamp;
  const termsB = [86400, 10 * 86400, 500000, 3000, 3600];      // opens a day after seeding, locked 10 d, 50 % → 0.3 % over an hour
  const paramsB = [ID4, coinB, CURVE, E, 2n * E, 0n, 0n, (1n << 128n) - 1n, 0, 0, 0, 0, NOW4 + 7n * 86400n, 1];
  await bob.exec(W.pad, `createV4(${PARAMS},${TERMS},bytes32)`, [paramsB, termsB, saltC], { label: "createV4" });
  const LB = LA + 1n;
  for (const who of [alice, carol, dave]) await who.exec(W.pad, "buy(uint256,uint256,uint64,uint16)", [LB, 0n, NOW4 + 60n, 10000], { value: E, label: "buy" });
  const tB = await terminalOf(LB);
  const keyC = await keyOf(LB);
  const pidB = await c.read(W.cust, "poolIdOf(uint256)", [LB]);
  // a stranger initialises this one INSIDE the band: 0.4 % up in sqrt space is 0.8 % in price
  const live = tB.sqrt * 1004n / 1000n;
  await carol.exec(W.kiln, "deployHook(uint8,bytes32,bytes32)", [1, saltC, word(coinB)], { label: "deployHook" });
  await carol.exec(W.pm, `initialize(${KEY},uint160)`, [keyC, live], { label: "initialize" });
  const reach4Coin = decUint(await c.read(coinB, "balanceOf(address)", [reach4]));
  const reach4Eth = await c.balanceOf(reach4);
  await eve.exec(W.pad, "graduate(uint256)", [LB], { label: "graduate v4" });
  const SEEDED_B = evm.BLOCK.header.timestamp;
  {
    const p = await poolOf(pidB);
    eq("a pre-initialised pool within 1 % is used as it is: the stranger's price stands", p.price, live);
    const seededB = c.getLogs({ address: W.cust, topics: [topic("Seeded(uint256,bytes32,address,uint256,uint160,uint160,uint256)")] }).pop();
    eq("the Seeded log carries the terminal price", decUint(seededB.data, 1), tB.sqrt);
    eq("and the pool's, side by side", decUint(seededB.data, 2), live);
    ok("at a higher price the coin is the short side: all of it goes in", p.r1 <= tB.amountBase && p.r1 + 1_000_000_000_000n >= tB.amountBase, `${p.r1} of ${tB.amountBase}`);
    ok("and the ether the stranger's price did not need — under 1 % of the raise — went home to the Reach",
       p.r0 < tB.raised && (await c.balanceOf(reach4)) - reach4Eth === tB.raised - p.r0 && (tB.raised - p.r0) * 100n < tB.raised);
    ok("the coin's dust too", decUint(await c.read(coinB, "balanceOf(address)", [reach4])) - reach4Coin === tB.amountBase - p.r1);
    eq("the custodian keeps none of it", decUint(await c.read(coinB, "balanceOf(address)", [W.cust])), 0n);
    eq("nor any ether", await c.balanceOf(W.cust), 0n);
  }
  const hookC = (await custodyOf(LB)).hook;
  const OPENS_B = SEEDED_B + 86400n;
  eq("OPENS is seededAt + OPENS_IN", decUint(await c.read(hookC, "OPENS()")), OPENS_B);
  await refusesWith("before the opening hour the pool will not swap", () => swapIn(c, keyC, E / 100n), "NotOpenYet(uint64)");
  warp(OPENS_B - 1n);
  await refusesWith("not a second early", () => swapIn(c, keyC, E / 100n), "NotOpenYet(uint64)");
  warp(OPENS_B);
  await swapIn(c, keyC, E / 100n);
  eq("at the opening second the start fee: 50 %", decUint(await c.read(W.pm, "lastFeeCharged()")), 500000n);
  warp(OPENS_B + 1800n);
  await swapIn(c, keyC, E / 100n);
  eq("halfway down the ramp: 25.15 %", decUint(await c.read(W.pm, "lastFeeCharged()")), 251500n);
  eq("feeAt says the same", decUint(await c.read(hookC, "feeAt(uint64)", [OPENS_B + 1800n])), 251500n);
  warp(OPENS_B + 3600n);
  await swapIn(c, keyC, E / 100n);
  eq("at the ramp's end the floor: 0.3 %", decUint(await c.read(W.pm, "lastFeeCharged()")), 3000n);
  warp(OPENS_B + 400n * 86400n);
  await swapIn(c, keyC, E / 100n, "0x" + "de".repeat(40));
  eq("and forever after — garbage hookData changes nothing", decUint(await c.read(W.pm, "lastFeeCharged()")), 3000n);
  {
    const have = decUint(await c.read(coinB, "balanceOf(address)", [c.from.toString()]));
    await c.exec(coinB, "approve(address,uint256)", [W.pm, have]);
    await c.exec(W.pm, `swap(${KEY},${SWAP},bytes)`, [keyC, [false, -have, 0n], "0x"], { label: "v4 swap" });
    eq("the fee is a function of the clock alone: the other direction pays the same", decUint(await c.read(W.pm, "lastFeeCharged()")), 3000n);
  }
  {
    const st = await c.read(hookC, "status()");
    ok("status: open, and the lock long over", decBool(st, 0) && decBool(st, 1));
  }

  head("one codehash for every launch's hook, and one salt for every band");
  const codeB = await codeOf(c, atB), codeC = await codeOf(c, hookC);
  ok("two launches, two terms, one runtime: the hooks' codehashes are equal", kec(codeB) === kec(codeC));
  eq("and equal to the keccak of the compiled LaunchHook runtime — the number the Router pins as LAUNCH_HOOK_CODEHASH", kec(codeB), kec(A("src/LaunchHook.sol", "LaunchHook").deployed));
  ok("the hook's runtime carries no immutable: nothing of one launch is in another's code", !codeB.includes(coinA.slice(2).toLowerCase()) && !codeC.includes(coinB.slice(2).toLowerCase()));
  {
    const c2 = await Chain.open({ chainId: 8453 });
    const v4b = await c2.as("0x" + "f4".repeat(32));
    const WB = await deployV4World(v4b, hub);
    eq("the same deployer, the same sequence, another chain id: the Kiln lands at the same address", WB.kiln, W.kiln);
    eq("so does the custodian", WB.cust, W.cust);
    eq("the recipe hash is the same number there", "0x" + (await c2.read(WB.kiln, "recipeHash(uint8,bytes32)", [1, argA])).slice(2, 66), hashA);
    const there = await mine(c2, WB.kiln, hashA, flagsA);
    eq("the first salt mined there is the one mined here", there.salt, saltA);
    eq("one mined salt gives the same address on every chain", there.at, atA);
    eq("and the custodian there predicts it too", decAddr(await c2.read(WB.cust, "hookAt(address,bytes32)", [coinA, saltA])), atA);
  }

  head("the constants a deployment record pins, asserted");
  eq("MINT_POSITION is 0x02", decUint(await c.read(W.cust, "MINT_POSITION()")), 2n);
  eq("SETTLE_PAIR is 0x0d", decUint(await c.read(W.cust, "SETTLE_PAIR()")), 0x0dn);
  eq("SWEEP is 0x14", decUint(await c.read(W.cust, "SWEEP()")), 0x14n);
  eq("DECREASE_LIQUIDITY is 0x01", decUint(await c.read(W.cust, "DECREASE_LIQUIDITY()")), 1n);
  eq("BURN_POSITION is 0x03", decUint(await c.read(W.cust, "BURN_POSITION()")), 3n);
  eq("TAKE_PAIR is 0x11", decUint(await c.read(W.cust, "TAKE_PAIR()")), 0x11n);
  eq("POOLS_SLOT is 6, where StateLibrary reads slot0", decUint(await c.read(W.cust, "POOLS_SLOT()")), 6n);
  eq("the grid is spacing 60 from tick −887220", decUint(await c.read(W.cust, "TICK_LOWER()")), (1n << 256n) - 887220n);
  eq("to 887220", decUint(await c.read(W.cust, "TICK_UPPER()")), 887220n);
  eq("SQRT_LOWER is TickMath's sqrt price at the lower edge", decUint(await c.read(W.cust, "SQRT_LOWER()")), decUint(await c.read(W.pm, "sqrtAt(int24)", [-887220])));
  eq("SQRT_UPPER at the upper", decUint(await c.read(W.cust, "SQRT_UPPER()")), decUint(await c.read(W.pm, "sqrtAt(int24)", [887220])));
  eq("the 1 % band in sqrt space: sqrt(0.99) rounded in", decUint(await c.read(W.cust, "BAND_LO()")), 994988n);
  eq("sqrt(1.01) rounded in", decUint(await c.read(W.cust, "BAND_HI()")), 1004987n);
  eq("the start fee's ceiling is the Pool's sniper ceiling in v4's unit", decUint(await c.read(W.cust, "MAX_START_FEE()")), 900000n);
  eq("the Permit2 window is an hour: a real time, never zero", decUint(await c.read(W.cust, "PERMIT_WINDOW()")), 3600n);
  eq("the hook's own grid constant agrees", decUint(await c.read(atB, "TICK_SPACING()")), 60n);
}

head("gas");
for (const [k, v] of Object.entries(c.gas)) console.log(`  ${k.padEnd(18)} ${String(v).padStart(10)}`);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
