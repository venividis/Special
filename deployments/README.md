# Deployment records

One file per chain, named by chain id (`31337.json`, `84532.json`,
`11155111.json`, `8453.json`, `1.json`, `10.json`), written by
`tools/deploy.mjs` as the LAST act of a deployment and checked against the
chain by `tools/recover-record.mjs`. A record is a convenience; the chain
is the truth. The two must agree, and the tool that says so exits non-zero
when they do not.

## The recovery rule

```
node tools/recover-record.mjs deployments/<chainId>.json     # RPC_URL or the record's rpc
```

Every field that can be read back is read back and compared. Addresses
are checked three ways — the record, the immutable that names the address
on the contract that uses it (`PINS` in `tools/deploy.mjs`, both directions
of every mutual pair: `hub.POOL` and `pool.HUB`), and the CREATE3
arithmetic from `(factory, salt)`, also asked of the factory's own
`predict`. Codehashes are compared with the record for every contract and
with the compiled runtime for the contracts whose runtime carries no
immutables (`reproducible`). The ship rule is compared with the hub's
actual form (`facetAddresses()` answers → diamond; reverts → monolith),
each facet's codehash and selector set with the record, and `diamondCut`
is confirmed unrouted. The Engine is confirmed frozen with the manifest's
`engineHash`, `inflatedSize`, shard hashes and panel hashes, every shard
pointer at `CREATE(engine, 1 + k)`, every panel pointer holding the gzip
the record hashes. `Catalog.agrees()` must be true, `catalogHash`, the
registry's codehash, the band bounds and the Timelock's admin must match,
and `/manifest` over ERC-5219 must name the same hashes.

The last line is either `0 disagreeing` (exit 0) or the list of
disagreeing fields, each with what the record says and what the chain
says (exit 1). `tools/deploy.mjs` runs the same function in-process
before writing the record and refuses to publish on any disagreement; a
field the record lacks that a complete deployment has is reported as
`missing` and is not fatal, because a chain may predate a contract.

`tools/verify-recover.mjs` runs all of this against the in-process EVM
(the same `deployIntact` code, through a chain adapter) and proves the
recovery catches a tampered codehash, salt, address, build, selector set,
shard pointer, engine hash, panel hash, band, deployer, catalog hash and
admin by name.

## The schema (`intact.deployment/1`)

| Field | Meaning |
|---|---|
| `chainId`, `network`, `rpc` | the chain; `rpc` is the endpoint the record was made against (null for a public one) |
| `band` | `{band, lo, hi, rehearsal}` — the hub's `BAND`, `BAND_LO`, `BAND_HI`; rehearsal chains take the whole edition |
| `deployer` | the burner. On a real band it was at nonce 0 before the run and must never be used again |
| `factory`, `factoryVia` | the `Create3Factory`, and the plain CREATE that made it (`{from, nonce: 0}`) |
| `salts` | `keccak("intact.v1.<key>")` per record key, including the three post-MVB pins |
| `contracts` | record key → address. Flat, like IPSEITY's, so a spread cannot drop one |
| `codehashes` | `extcodehash` at deploy, per key |
| `reproducible` | per key, whether that codehash equals `keccak(compiled deployedBytecode)` — true only for contracts without immutables |
| `placeholders` | `market`, `roles`, `agentCard`: CREATE3-predicted and codeless until their units land. The hub, Catalog, Renderer and Premises pin these addresses immutably |
| `shipBuild` | `out/ship.json` verbatim (`build`, `reason`, `intactBytes`, `threshold`, `limit`, `solc`) plus, in the diamond build, `facets {name: {address, codehash, selectors}}` and the `cut` |
| `engine` | `address`, `via` (the plain CREATE that made it), `curator`, `frozen`, `engineHash`, `inflatedSize`, `shardHashes`, `panelHashes`, `head[]`, `body[]`, `panels[{name, address, hash, gzipHash}]`, `storedBytes`, `placeholder` |
| `catalogHash` | `Catalog.catalogHash()` |
| `coinTemplate` | the keccak and length of `type(Coin).creationCode` the Kiln carries |
| `registry` | the ERC-6551 registry's address and codehash |
| `price` | the initial mint price the hub's constructor wrote |
| `timelock` | `admin` (the burner at deploy), `delay`, `grace`, and `disposition` — what happens to the admin next |
| `venues` | the probed venue table used for the Router and Kiln, or null (Router skipped, letter X pinned as address(0)) |
| `gas`, `gasTotal` | gas per step label and the sum |
| `toolchain` | solc version, optimizer runs, viaIR, evmVersion, `bytecodeHash: none`, the EIP-170 limit |
| `confirmToken`, `journal`, `writtenAt`, `block`, `recovered` | the literal token the run carried, the journal's path, when, at which block, and how many fields the in-process recovery checked |

## Two things the record says that DESIGN.md §12 says differently

- **The Engine is not a CREATE3 deployment.** Its constructor records
  `msg.sender` as the curator, and under CREATE3 the sender is the
  factory's single-use proxy, which could never call `loadHead`. The
  Engine is the second plain CREATE from the burner (nonce 2: the factory
  at 0, the Timelock's factory call at 1). Its address is still the same on
  every band, by `keccak(rlp([burner, 2]))` rather than by a salt; `via`
  records which, and recovery recomputes it.
- **Engine shards are SSTORE2 pointers, not salted.** `loadHead`,
  `loadBody` and `loadPanel` CREATE from the Engine's own nonce, so the
  k-th shard written (head, body, then panels, in load order) is
  `CREATE(engine, 1 + k)`. With the Engine at one address and `dist/`
  byte-identical, every pointer is the same on every band. `dropLast` is
  never called by the deployer, since it would desynchronise that sequence.

## The journal

`deployments/<chainId>.journal.json` (gitignored) is written atomically
after every receipt — public receipt data only, never the key. A crashed
run re-runs the same command: a step whose predicted address already holds
code with the journaled codehash is skipped; the Engine's loads are
counted against the chain and only the missing ones are sent. Code at a
prediction that the journal does not account for is a refusal, not an
adoption: anyone may use a salt once, and a stranger's contract at our
address is exactly what a record must not bless. A journal belonging to
another deployer is refused.

## The burner

The factory's address is `CREATE(burner, 0)`, so every address on every
band follows from one key. On a real band `tools/deploy.mjs` refuses a key
whose nonce is not 0 unless a journal names a run to resume. The key lives
in the environment (`PRIVATE_KEY`) and nowhere in this repository;
`.testnet-key` is gitignored for throwaway testnet keys. After the record
is written the burner should do nothing else, ever; DESIGN §12 destroys it
once the Timelock's admin has been rotated through the Timelock's own
seven-day queue (`disposition` records the state of that).

## `31337.json`

A fixture produced by an actual local run against `npx hardhat node`
(`node tools/deploy.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL`, then
`node tools/recover-record.mjs deployments/31337.json` → `0 disagreeing`).
Its `engine.placeholder` says whether `dist/` held the placeholder shell
from `tools/fixtures/` (until U9's shell lands, it does); `deploy.mjs`
refuses to deploy a placeholder anywhere but 31337. Its deployer is
hardhat's first account, which is nobody's burner; the warning the run
printed is the record's `deployer` field.

## Not in MVB

Reusing an existing Parley on a redeploy (`--reuse parley=<addr>`, as
IPSEITY's `existingParley`), the post-MVB satellites (AgentCard, Market,
Roles, LPCustodian, LaunchHook template, Nameplate), the venue table
(`VENUES` in `tools/deploy.mjs` is empty until each address is probed for
code on a dated commit), and the campaign/exercise record shapes U13 will
add.
