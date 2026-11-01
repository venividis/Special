#!/usr/bin/env node
/*───────────────────────────────────────────────────────────────────────────
  INTACT · the venue table, re-proved against the chain it names

  tools/deploy.mjs VENUES holds, per rehearsal chain, the addresses the
  Router, the Kiln and the custodian are built against: SwapRouter02, the
  v4 PoolManager and PositionManager, Permit2 and the wrapped native
  token. IPSEITY's rule is that every such address was PROBED, never
  recalled; this tool is the probe, so the claim can be made again by
  anyone at any block. For one chain (--chain <id>, the endpoint from
  RPC_URL) or every row (--chain all, the endpoints from RPC_URL_<id>), it
  asserts what `checkVenues` asserts before every deploy over a wire:

    · code at every address, with the codehash the row recorded when it
      was probed (a metamorphic redeploy, a swapped predeploy or a typo'd
      address all fail here, by name);
    · the PositionManager naming this PoolManager and this Permit2;
    · the PositionManager and SwapRouter02 naming the same WETH, the row's;
    · SwapRouter02 naming the v3 factory Uniswap's feed names;
    · and, on a row that names Seaport (V2, W6: 84532, from
      tools/fixtures/seaport-1.6/probe.json), Seaport, its
      ConduitController and OpenSea's conduit holding the codehashes the
      row's `seaportProbed` recorded, `information()` saying 1.6 and naming
      that controller, the controller naming that conduit for OpenSea's
      key, and the conduit's channel to Seaport open.

  Every read is pinned to one block (tools/rpc.mjs), so the sentences are
  about one state of the chain. It needs the network, so it is not a step
  of `npm run check`; `npm run verify:venues` runs it by hand, and
  tools/testnet.mjs runs the same check in its read-only preflight.

  The last line is "  N passed, M failed"; the exit code follows it.
───────────────────────────────────────────────────────────────────────────*/
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RpcChain, DEV_KEYS } from "./rpc.mjs";
import { VENUES, checkVenues, parseArgs } from "./deploy.mjs";
import { harness } from "./verify-gateway.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const t = harness();
  const ids = !args.chain || args.chain === true || args.chain === "all" ? Object.keys(VENUES) : [String(args.chain)];
  console.log(`\n  \x1b[1mINTACT · verify-venues\x1b[0m  ${ids.length} row(s) of tools/deploy.mjs VENUES`);
  for (const id of ids) {
    const row = VENUES[id];
    if (!t.ok(Boolean(row), `chain ${id} has a row in the venue table`)) continue;
    const url = (ids.length === 1 && process.env.RPC_URL) || process.env[`RPC_URL_${id}`];
    if (!t.ok(Boolean(url), `an endpoint for chain ${id} is in the environment (RPC_URL${ids.length > 1 ? `_${id}` : ""})`)) continue;
    const c = await RpcChain.open(url, DEV_KEYS[0]);
    t.head(`chain ${id}: the row probed on ${row.probed.on} at block ${row.probed.block}, read again at block ${BigInt(await c.tag())}`);
    t.ok(c.chainId === Number(id), `the endpoint is chain ${id}`, `it says ${c.chainId}`);
    const read = { codeAt: async (a) => (await c.rpc("eth_getCode", [a, await c.tag()])).toLowerCase(), call: (to, data) => c.call(to, data) };
    for (const [sentence, ok, detail] of await checkVenues(read, row)) t.ok(ok, sentence, detail);
  }
  console.log(`\n  ${t.pass} passed, ${t.fail} failed\n`);
  process.exit(t.fail ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e && e.stack || e); console.log("\n  0 passed, 1 failed\n"); process.exit(1); });
}
