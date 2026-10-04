#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the delay

  Origin: IPSEITY tools/verify-timelock.mjs (24 assertions), ported for U5.
  The Timelock itself is the donor's, byte for byte below its header; what
  changed is the thing it curates. IPSEITY handed a two-step `Ownable` to
  the lock; INTACT's hub pins `TIMELOCK` as an immutable before it exists
  (DESIGN.md §4.7, §12), so "the collection is administered by the delay"
  is a constructor fact here, asserted as one, and a direct call from the
  deployer to the curated surface is refused with `NotTimelock`.

  A timelock is only worth the attacks it survives, so this tries them:
  executing early, executing after the grace window, executing something
  never queued, re-queueing to move an eta underneath a watcher, rotating
  the admin without the delay, and calling any of it as a stranger — queue,
  cancel and (the donor's rule, recorded because DESIGN.md §3 row 27 says
  otherwise) execute.

  The hub is the real one since the wave-1 integration — the ship build
  (four facets and the immutable diamond, tools/hub.mjs) with this lock
  pinned as its TIMELOCK and a mint price of zero, so the walk reads the
  curated surface the chain will have, not a mock of it.

    node tools/verify-timelock.mjs
───────────────────────────────────────────────────────────────────────────*/
import { compile, artifact } from "./compile.mjs";
import * as evm from "./evm.mjs";
import { Chain, enc, sel, decUint, decAddr, decBool, encodeAddressArg } from "./evm.mjs";
import { deployHub, etchRegistry } from "./hub.mjs";

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${n}`);
  if (!c && d !== undefined) console.log(`      ${d}`);
};
const eq = (n, g, w) => ok(n, String(g) === String(w), `got ${g}\n      want ${w}`);
const head = (s) => console.log(`\n  \x1b[1m${s}\x1b[0m`);

/// A call that must fail, and fail for the stated reason: a refusal that
/// cannot name its error is a refusal that might be the harness's.
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
const ZERO = "0x" + "00".repeat(20);

head("deploy");
await etchRegistry(c);
const reachImpl = await c.deploy(A("src/Reach.sol", "Reach").bytecode, "", "Reach");
const gripImpl = await c.deploy(A("src/Grip.sol", "Grip").bytecode, "", "Grip");
const lock = await c.deploy(A("src/Timelock.sol", "Timelock").bytecode, encodeAddressArg(me), "Timelock");
const { hub, cut } = await deployHub(c, out, { reachImpl, gripImpl, timelock: lock }, { price: 0n });
ok(`the real hub: the diamond, ${cut.length} facets, ${cut.reduce((n, x) => n + x.functionSelectors.length, 0)} selectors routed`, hub.length === 42);
const bytes = A("src/Timelock.sol", "Timelock").deployed.length / 2 - 1;
ok(`deployed (Timelock runtime ${bytes} B)`, lock.length === 42);

const DELAY = 7n * 24n * 3600n;
const GRACE = 14n * 24n * 3600n;
eq("the delay is seven days", decUint(await c.read(lock, "DELAY()")), DELAY);
eq("queued operations expire after a fortnight", decUint(await c.read(lock, "GRACE()")), GRACE);
eq("the deployer is the admin", decAddr(await c.read(lock, "admin()")).toLowerCase(), me.toLowerCase());

/* the harness runs every call against one fixed block, so time is moved by
   rewriting that block's timestamp rather than by mining */
const at = (t) => evm.warp(t);
const T0 = evm.GENESIS_TIME;

/*──────────────── the mechanism ────────────────*/
head("a queued operation waits");
const data = enc("setPrice(uint256)", [12345n]);
const salt = "0x" + "01".repeat(32);
const X = "execute(address,uint256,bytes,bytes32)";
const Q = "queue(address,uint256,bytes,bytes32)";

const opHash = await c.read(lock, "opHash(address,uint256,bytes,bytes32)", [hub, 0, data, salt]);

await refuses("executing something never queued", () => c.exec(lock, X, [hub, 0, data, salt]), "NotQueued()");

await c.exec(lock, Q, [hub, 0, data, salt], { label: "queue" });
const eta = decUint(await c.read(lock, "eta(bytes32)", [opHash]));
eq("the eta is a week out", eta, BigInt(T0) + DELAY);
ok("not ready yet", !decBool(await c.read(lock, "ready(bytes32)", [opHash])));

await refuses("executing before the delay is up", () => c.exec(lock, X, [hub, 0, data, salt]), "TooEarly()");
await refuses("re-queueing to move the eta underneath a watcher", () => c.exec(lock, Q, [hub, 0, data, salt]), "AlreadyQueued()");

/*──────────────── the delay elapses ────────────────*/
head("and then it lands");
at(BigInt(T0) + DELAY + 1n);
ok("ready once the week has passed", decBool(await c.read(lock, "ready(bytes32)", [opHash])));

/*  IPSEITY handed the collection over with a two-step Ownable, which took
    a week of its own. INTACT pins the lock at construction: there is no
    handover to perform and no moment at which the hub answers to anyone
    else, so the fact is read back rather than produced.               */
eq("the collection is administered by the delay — pinned, not handed over",
   decAddr(await c.read(hub, "TIMELOCK()")).toLowerCase(), lock.toLowerCase());
await refuses("and the deployer cannot reach the curated surface directly",
  () => c.exec(hub, "setPrice(uint256)", [1n]), "NotTimelock()");
eq("nothing changed on the way", decUint(await c.read(hub, "price()")), 0n);

await c.exec(lock, X, [hub, 0, data, salt], { label: "execute" });
eq("the queued change took effect", decUint(await c.read(hub, "price()")), 12345n);
eq("the queue slot is cleared", decUint(await c.read(lock, "eta(bytes32)", [opHash])), 0);

await refuses("replaying the same operation", () => c.exec(lock, X, [hub, 0, data, salt]), "NotQueued()");

/*──────────────── expiry ────────────────*/
head("a forgotten operation dies");
const stale = enc("setPrice(uint256)", [999n]);
const saltS = "0x" + "03".repeat(32);
const opS = await c.read(lock, "opHash(address,uint256,bytes,bytes32)", [hub, 0, stale, saltS]);
const T1 = BigInt(T0) + DELAY + 1n;
await c.exec(lock, Q, [hub, 0, stale, saltS]);

at(T1 + DELAY + GRACE + 10n);
ok("no longer ready", !decBool(await c.read(lock, "ready(bytes32)", [opS])));
await refuses("executing a year-old proposal", () => c.exec(lock, X, [hub, 0, stale, saltS]), "Expired()");
eq("the collection was not changed", decUint(await c.read(hub, "price()")), 12345n);

/*──────────────── the admin ────────────────*/
head("the admin cannot slip out from under the delay");
const bob = await c.as("0x" + "b0b1".repeat(16));
const bobAddr = bob.from.toString();

await refuses("a stranger queueing", () => bob.exec(lock, Q, [hub, 0, data, "0x" + "04".repeat(32)]), "NotAdmin()");
await refuses("a stranger cancelling", () => bob.exec(lock, "cancel(bytes32)", [opHash]), "NotAdmin()");

/*  DESIGN.md §3 row 27: "admin queues; anyone executes". The donor's
    `execute` was `onlyAdmin`; the wave-1 integration dropped the one word
    (the admin announced the change a week ago, and who presses does not
    change what lands), so a stranger may execute a ripe operation — and
    nothing else: queueing and cancelling stay the admin's.             */
const saltE = "0x" + "0e".repeat(32);
const T2 = T1 + DELAY + GRACE + 10n;
await c.exec(lock, Q, [hub, 0, enc("setPrice(uint256)", [777n]), saltE]);
at(T2 + DELAY + 1n);
await bob.exec(lock, X, [hub, 0, enc("setPrice(uint256)", [777n]), saltE]);
eq("a stranger executing a ripe operation lands it (DESIGN.md §3 row 27: anyone executes)",
   decUint(await c.read(hub, "price()")), 777n);
await refuses("and cannot land it twice",
  () => bob.exec(lock, X, [hub, 0, enc("setPrice(uint256)", [777n]), saltE]), "NotQueued()");

await refuses("the admin rotating itself directly", () => c.exec(lock, "setAdmin(address)", [bobAddr]), "NotSelf()");
const rot0 = enc("setAdmin(address)", [ZERO]);
const salt0 = "0x" + "00".repeat(31) + "0a";
await c.exec(lock, Q, [lock, 0, rot0, salt0]);
at(T2 + 2n * DELAY + 2n);
await refuses("rotating to nobody, even through the queue, is refused at the door",
  () => c.exec(lock, X, [lock, 0, rot0, salt0]), "CallFailed(bytes)");
eq("the admin is unchanged", decAddr(await c.read(lock, "admin()")).toLowerCase(), me.toLowerCase());

// rotation has to go through the queue like anything else
const rot = enc("setAdmin(address)", [bobAddr]);
const saltR = "0x" + "05".repeat(32);
const T3 = T2 + 2n * DELAY + 2n;
await c.exec(lock, Q, [lock, 0, rot, saltR]);
await refuses("and it waits its week like anything else", () => c.exec(lock, X, [lock, 0, rot, saltR]), "TooEarly()");
at(T3 + DELAY + 1n);
await c.exec(lock, X, [lock, 0, rot, saltR]);
eq("rotation lands, seven days later", decAddr(await c.read(lock, "admin()")).toLowerCase(), bobAddr.toLowerCase());
await refuses("and the old admin is finished",
  () => c.exec(lock, Q, [hub, 0, data, "0x" + "06".repeat(32)]), "NotAdmin()");

/*──────────────── cancelling ────────────────*/
head("a proposal can be pulled");
const saltC = "0x" + "07".repeat(32);
const opC = await c.read(lock, "opHash(address,uint256,bytes,bytes32)", [hub, 0, data, saltC]);
await bob.exec(lock, Q, [hub, 0, data, saltC]);
ok("queued", decUint(await c.read(lock, "eta(bytes32)", [opC])) > 0n);
await bob.exec(lock, "cancel(bytes32)", [opC]);
eq("and cancelled", decUint(await c.read(lock, "eta(bytes32)", [opC])), 0);
await refuses("cancelling what is not there", () => bob.exec(lock, "cancel(bytes32)", [opC]), "NotQueued()");

/*──────────────── the failed call ────────────────*/
head("a call the target refuses is reported, not swallowed");
const bad = enc("panic(uint256)", [42n]);        // no such token: the hub reverts NoSuchToken
const saltB = "0x" + "0b".repeat(32);
const T4 = T3 + DELAY + 1n;
await bob.exec(lock, Q, [hub, 0, bad, saltB]);
at(T4 + DELAY + 1n);
await refuses("the revert surfaces as CallFailed", () => bob.exec(lock, X, [hub, 0, bad, saltB]), "CallFailed(bytes)");
ok("and the operation is still queued for a retry within the grace",
   decBool(await c.read(lock, "ready(bytes32)", [await c.read(lock, "opHash(address,uint256,bytes,bytes32)", [hub, 0, bad, saltB])])));

at(T0);   // leave the shared block as we found it
console.log(`\n  gas: queue ${c.gas.queue}, execute ${c.gas.execute}`);
console.log(`  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
