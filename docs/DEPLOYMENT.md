# Deployment — the procedure, from this tooling

What an operator runs to put INTACT on a rehearsal chain or a band, what
each run leaves behind, and what has been measured. Two tools, two kinds
of chain:

| Chain | Kind | Tool | Confirm token (`CONFIRM` in `tools/deploy.mjs`) |
|---|---|---|---|
| 31337 (hardhat) | rehearsal, the whole edition | `tools/testnet.mjs` | `DEPLOY_INTACT_LOCAL` |
| 84532 (Base Sepolia) | rehearsal, the whole edition | `tools/testnet.mjs` | `DEPLOY_INTACT_TO_BASE_SEPOLIA` |
| 11155111 (Sepolia) | rehearsal, the whole edition | `tools/testnet.mjs` | `DEPLOY_INTACT_TO_SEPOLIA` |
| 8453 (Base) | band 1, ids 1–3,072 | `tools/deploy.mjs` | `DEPLOY_INTACT_TO_BASE` |
| 1 (Ethereum) | band 0, ids 3,073–3,584 | `tools/deploy.mjs` | `DEPLOY_INTACT_TO_ETHEREUM` |
| 10 (OP Mainnet) | band 2, ids 3,585–4,096 | `tools/deploy.mjs` | `DEPLOY_INTACT_TO_OP` |

`tools/testnet.mjs` is the rehearsal in one command: a read-only
preflight, `tools/deploy.mjs`'s own `deployIntact` over the wire, a
campaign that exercises every function family live with receipts, the
record recovered, the gateway diffed, `tokenURI` measured, and the
burner's disposition. It refuses a band: a band's burner does nothing
after its record is written (`deployments/README.md`, "The burner"), and
the campaign would spend it. A band is deployed with `tools/deploy.mjs`
alone and exercised by its holders.

Nothing in any record names an RPC endpoint. `RPC_URL` comes from the
environment every time (31337 defaults to the local node), because a
record that named the node that verifies it would be choosing its own
oracle.

## Prerequisites

1. **The tree is green.** `npm run check` on the commit you deploy (the
   battery; `docs/CHECKPOINT.md` has the last result), then `npm run build`
   so `dist/` holds the console and not the placeholder — the preflight
   refuses a placeholder `dist/` anywhere but 31337, and prints the
   engine hash it is about to deploy.
2. **A fresh burner at nonce 0.** The factory is `CREATE(burner, 0)`, so
   every address on every chain follows from this one key; a key that has
   ever sent a transaction lands the factory somewhere no other chain
   shares, and `tools/deploy.mjs` and `tools/testnet.mjs` both refuse it
   unless a journal names a run to resume. Generate it into the gitignored
   `.testnet-key` (mode 600) with whatever you trust to make 32 random
   bytes; never paste it into a shell line that history will keep. Only
   its address is ever printed. The key is destroyed when the run is done
   (below).
3. **Funding, from the preflight.** Run the preflight alone first (the
   command is in the next section); it prints one sentence with the
   whole figure and its parts: the deploy at 120 M gas × the live gas
   price × 1.5 plus the L1 data term where the OP-stack
   `GasPriceOracle` predeploy (`0x4200…000F`) has code, plus the campaign
   — the gas the 31337 wire rehearsal measured (`CAMPAIGN_GAS` in
   `tools/testnet.mjs`, 5,902,168 gas; a budget of 30 M until a run had
   measured it) × 1.5, two mints at the hub's price, the ether the
   campaign spends (0.0051 ETH: the market's quote, two buys, a stamp,
   a lock), and the second key's funding (its measured gas × 1.5, what it
   spends, two transfers' gas for the sweep). On an unfunded key the
   preflight ends with "fund `<address>` with at least N ETH more" and
   exits 1 having sent nothing. The mint price is the largest term on a
   cheap chain; `--price <wei>` lowers it for a rehearsal (the preflight
   prints the new figure).
4. **An endpoint.** `RPC_URL` is any JSON-RPC endpoint of the chain; the
   tooling routes a non-local URL through the environment's proxy
   (`tools/rpc.mjs`). Base Sepolia's public endpoints
   (`https://sepolia.base.org` and others) answered from this container;
   a keyed provider is fine too. The record never carries it.
5. **The confirm token**, from the table above, spelled exactly. It is
   checked before any file or socket is touched, so a mistyped command
   costs nothing; an option the tool does not know is refused the same
   way.

## The commands

The preflight alone (read-only; the funding sentence):

```sh
RPC_URL=https://sepolia.base.org node tools/testnet.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA \
  --key-file .testnet-key --preflight-only
```

The whole rehearsal (preflight → deploy → campaign → recover → gateway →
measure → disposition), with the record and the campaign record written
under `deployments/` — the two files the operator commits:

```sh
RPC_URL=https://sepolia.base.org node tools/testnet.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA \
  --key-file .testnet-key \
  --endpoints https://sepolia.base.org,<a second endpoint>,<a third> \
  [--gateway https://<your web3url-gateway>] [--price 1000000000000000]
```

`--endpoints` names up to three endpoints for the `tokenURI` measurement
(the default is `RPC_URL` alone). `--gateway` runs `tools/verify-gateway.mjs`
against a gateway you host (below); without it the gateway phase is
skipped on a public chain and run afterwards by hand.

Resume after a crash. The deploy resumes itself from its journal
(`deployments/<chainId>.journal.json`, gitignored): the same command again
sends only what the chain lacks and refuses code it did not put there
(`deployments/README.md`, "The journal"). The campaign resumes from its own
record with `--resume`: a step whose receipt is recorded is never sent
twice, and the values earlier steps learned from their logs (the ids, the
coin, the launch, the lock) are read back from the record.

```sh
RPC_URL=… node tools/testnet.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA --key-file .testnet-key --resume
```

A campaign against a deployment already recorded (the record exists; the
key need not be the deployer, only funded): add `--skip-deploy`.

Recovery alone, any time, with any key (reads only):

```sh
RPC_URL=… node tools/recover-record.mjs deployments/84532.json        # the last line is "0 disagreeing", or the list
```

The gateway and its diff. `tools/gateway.mjs` is the plain HTTP gateway
over `Premises.request` (reads only; `POST /__rpc` forwards eight read
methods and nothing that signs):

```sh
RPC_URL=… node tools/gateway.mjs --record deployments/84532.json --port 8080
RPC_URL=… node tools/verify-gateway.mjs --gateway http://127.0.0.1:8080 --record deployments/84532.json --ids 1,2
RPC_URL=… node tools/verify-gateway.mjs --gateway http://127.0.0.1:8080 --record deployments/84532.json --tamper   # the fixture
```

`verify-gateway` fetches every route template of DESIGN §5.3 as raw bytes
and the chain's own answer through `eth_call`, and requires status, body
bytes (gzip panels as the gzip and as what it inflates to), Content-Type,
ETag, Cache-Control, Content-Encoding and Location equal; a gateway may add
Date, Content-Length, Connection, Keep-Alive and Transfer-Encoding and
nothing else — an extra header, an injected byte, a `<script>` the chain
did not serve, a Set-Cookie or a Content-Security-Policy header is a
finding named by route. It then recomputes `/manifest`'s hashes from the
bodies served and checks `/token/<id>/hash` against the served `/live`.
`--tamper` is its own proof: a forwarding proxy that appends a script,
adds a cookie and rewrites an ETag, each caught by name.

A `web3://` gateway for Base Sepolia. `w3link.io` serves Base mainnet and
not Base Sepolia, so the public-chain rehearsal fronts the deployment with
a self-hosted instance of `ethstorage/web3url-gateway` (Go; the project's
README has the build and the configuration keys, which move faster than
this document): configure chain 84532 against an RPC endpoint and the
host you serve from, start it, and point the diff at it — as a subdomain
gateway (`--gateway https://0x<premises>.84532.<your host>`) or as a path
gateway (`--gateway https://<your host> --prefix /0x<premises>:84532`,
the prefix being whatever the gateway puts before the route). A
`web3://` client needs no gateway at all: `web3://<premises>:84532/` is
the door, and `Premises.resolveMode()` answers `5219`. DESIGN §13 makes
this diff the nightly: against the self-hosted gateway on Base Sepolia,
and against `w3link.io` on Base mainnet once live.

## The post-MVB satellites

AgentCard, Market, Roles and the Nameplate — and LPCustodian as its unit
lands — are not part of the MVB record: the hub, the Catalog, the
Renderer and the Premises pin their CREATE3 addresses at the MVB, and
those addresses stay codeless until each lands through the Timelock's
seven-day public queue, the only caller the factory admits once the
burner is gone (`deployments/README.md`, "The burner"). One command per
satellite, run twice on a public chain:

```sh
RPC_URL=… node tools/deploy.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA --satellite market
#   the admin's key queues it; the record gains `satellites.market` with the queue transaction and the eta
#   … seven days …
RPC_URL=… node tools/deploy.mjs --chain 84532 --confirm DEPLOY_INTACT_TO_BASE_SEPOLIA --satellite market
#   anyone's key lands it; the record gains `contracts.market`, its codehash and `satellites.market.executed`
```

`--satellite all` takes every satellite the band admits in DESIGN §12's
order; `--satellite a,b` a chosen few, in that order. Before anything is
sent the command refuses a record for another chain, a salt or a
placeholder that is not where the arithmetic predicts, a holder whose
pin is not the predicted address, a constructor argument the record
lacks, an unknown key, and a queue the key may not make — then it prints
the exact `queue` call for the admin to make by hand (a band's admin is
the multisig). After landing it reads every pin of the new contract
back, recovers the whole record in-process and writes it only on 0
disagreeing; a repeated run sends nothing and changes nothing. On 31337
and in-process the clock is moved past the eta, so one run queues, lands
and records; `tools/verify-recover.mjs` proves the path on the in-process
EVM — the burner queues, nothing lands before the delay, a stranger lands
it a week later where the hub pinned it, the record follows it and
recovers, and a tampered codehash, a wrong landing block or a missing
queue is caught by name.

### Band 0: the name

The Nameplate (`src/Nameplate.sol`, U18) is one more satellite, admitted
only on a chain with a NameWrapper in `tools/ens-name.mjs`'s table
(Ethereum, and Sepolia to rehearse): `--satellite nameplate` lands it at
`keccak("intact.v1.nameplate")` with the ENS registry, the NameWrapper,
the .eth BaseRegistrar and the label `intact` as its constructor
arguments (contract addresses, never endpoints); its constructor refuses
a codeless pin, a registrar the registry does not name at `namehash("eth")`
and a bad label. The binding is custody, so the rest is the operator's
wallet's, not the burner's, in this order: own `intact.eth` wrapped
(`registry.owner(node) == NameWrapper`, the registrant a durable key);
land the Nameplate; mint the home token, id 3073; `NameWrapper.setResolver(node, nameplate)`
by the wrapped owner (and, one-way if wanted, `setFuses(node, CANNOT_UNWRAP | CANNOT_SET_RESOLVER)`);
`NameWrapper.safeTransferFrom(registrant, hub.account(3073), uint256(node), 1, "")`
— into the Reach, or into `hub.grip(3073)` for permanence — from which
block the apex and every `<id>.intact.eth` of the band answer, and before
which nothing does. Verify with reads only:
`RPC_URL=… node tools/ens-name.mjs --custody intact.eth --nameplate <addr>`
and `RPC_URL=… node tools/ens-name.mjs web3://intact.eth/token/3073/live`.
Renewal is anyone's through the public controller; from the registrar's
expiry second the resolver answers nothing (`nameplate.expiry(keccak("intact"))`),
the wrapper still names the account for ninety days, and past those the
name must be registered anew. `tools/verify-plate.mjs` walks every one of
these paths on a local ENS fixture.

### The custodian and the venue table

`LPCustodian` (U14) lands like the others (`--satellite custodian`, salt
`keccak("intact.v1.custodian")`, the address the Launchpad pinned as its
fifth constructor argument at the MVB) but only on a chain whose venue
table (`VENUES` in `tools/deploy.mjs`) names a PoolManager, a
PositionManager and a Permit2 — contract addresses probed for code on a
dated commit, never recalled; it seeds every v4 launch's position through
them. No chain has a probed row yet, so on every rehearsal the custodian
is refused by name and `Target.UniswapV4` stays `NotYet` (the owned-pool
path is unaffected). The Router's `LAUNCH_HOOK_CODEHASH` is the keccak of
`LaunchHook`'s compiled runtime, which the deployer writes into the venue
table it records when the table does not name it.

## What a run leaves behind

- `deployments/<chainId>.json` — the deployment record, schema
  `intact.deployment/1`, written by `deployIntact` as its last act after
  an in-process recovery with 0 disagreeing (`deployments/README.md`,
  "The schema").
- `deployments/<chainId>.campaign.json` — the campaign record, schema
  `intact.campaign/1`: one step per transaction with its receipt, the
  families' gas, the recovery, the gateway counts, the `tokenURI`
  measurements per endpoint, and the disposition (`deployments/README.md`,
  "The campaign record").
- `deployments/<chainId>.journal.json` — the deploy's journal, gitignored:
  a resume reads it; it is never committed.

The operator commits the first two and nothing else: not the journal, and
never a key or a file that held one. Both records carry public receipt
data only.

## The campaign, and what a public chain cannot do

The order (the header of `tools/testnet.mjs` says why each step sits where
it does): two mints, ids from the `Transfer` logs → the Kiln launches a
coin, the one ERC-20 a testnet is sure to have → the Reach hands the
holder inventory through `execute` → the owned market opens on it with a
native quote (there is no venue table on a testnet, so the Router is
skipped and pinned as address(0)) → the second key swaps both ways →
the holder speaks at home → both tokens bind a sealing key, the second
prices its inbox, the holder whispers SEALED with a stamp, the reply
settles it and `claimSettled` pays the recipient's feeSink → the raise:
`create`, buys to the target, `graduate`, a buyer's `claim`, a trade on
the sealed market, `collect` to the launcher's Reach → a native lock to
the Reach → a session for the second key and one `executeAsSession` →
`seal` → `panic`, its consequences read back → the steward → the lock
released when due → the sale, with `rightsOf(id, seller)` read back as 0
→ the sweep.

The second key is derived from the burner key (`keccak256` over the text
`intact.campaign/1:second` followed by the burner's 32 key bytes), funded
by the burner within the budget, and swept back to it at the end, so
nothing is stranded; it is re-derivable from the burner key alone and is
never printed. On 31337 it is derived and funded the same way, so the
funding and the sweep have run over a wire before they run for real.

Two things only a local chain can do, and what the public run does
instead: the steward's `summon` needs thirty days of silence
(`Steward.MIN_QUIET`), so on 31337 the clock is moved
(`evm_increaseTime`, a `clock` step marked `local-only`) and `summon`
and `cancel` land with receipts, while on a public chain the holder's
`stillHere` lands and the two refusals are proven by `eth_estimateGas` —
the revert's selector is `StillSpeaking(uint64)`, then `NotCalled()` —
and recorded as `refused`, with the timestamp the quiet period ends.
The lock is due two minutes after it is made; on 31337 the clock is moved
if it is not yet due, on a public chain the campaign waits for the
chain's clock (five-second polls, up to five minutes).

## Measured

From `node tools/testnet.mjs --chain 31337 --confirm DEPLOY_INTACT_LOCAL`
over `npx hardhat node --port 8547` (cancun), 2026-10-13, this tree: 56
sentences passed, 0 failed, 101 s in all; every number below is from that
run's records (`/tmp/wave3/u13/31337.json`, `/tmp/wave3/u13/31337.campaign.json`
during the build; the fixture committed as `deployments/31337.json` is
U10's, from the same sources).

| What | Measured on 31337 | Base Sepolia (84532) | Sepolia (11155111) |
|---|---|---|---|
| deploy, in all | 81,440,766 gas, 26 contracts, 41 s; the record recovered in-run: 345 fields, 0 disagreeing | awaiting a funded burner | awaiting a funded burner |
| deploy, the largest steps | catalogRows 14.94 M · loadPanel (six) 9.18 M · reachImpl 4.60 M · catalogText 4.14 M · renderer 3.59 M · launchpad 3.56 M · catalogState 3.55 M · catalog 3.53 M | — | — |
| campaign, in all | 5,902,168 gas over 39 transactions (40 steps, one of them the clock); the second key's share 1,445,791 | awaiting a funded burner | awaiting a funded burner |
| fund (2) | 42,000 | | |
| mint (2) | 595,922 | | |
| launch (1) | 1,090,563 | | |
| execute (1) | 124,234 | | |
| market: openMarket, approve, deposit (3) | 364,028 | | |
| swap: exact-in, approve, exact-out (3) | 224,284 | | |
| speak (1) | 180,330 | | |
| social: two keys, two bindings, the inbox, the stamped whisper, the reply, claimSettled (8) | 1,012,549 | | |
| raise: create, three buys, graduate, claim, a sealed trade, collect (8) | 1,076,687 | | |
| lock: lock, release (2) | 289,104 | | |
| session: grant, act (2) | 332,810 | | |
| seal (1) | 46,898 | | |
| panic (1) | 116,177 | | |
| steward: arrange, summon, cancel (3) | 280,947 | | |
| sale: transferFrom (1) | 125,635 | | |
| `tokenURI(1)` | `eth_estimateGas` 7,914,549 gas (16.2 s for the estimate's search on hardhat); a plain `eth_call` answers 72,989 bytes in 2.4 s | awaiting a funded burner (three public endpoints, `--endpoints`) | awaiting a funded burner |
| `verify-gateway` against `tools/gateway.mjs` | 240 passed, 0 failed over 33 routes for ids 1 and 2; the tamper fixture: 243 passed, 0 failed (the appended script, the Set-Cookie and the rewritten ETag each caught by name) | awaiting a self-hosted `web3url-gateway` and a funded burner | — |

The read-only preflight against `https://sepolia.base.org` on 2026-10-13,
with a freshly generated, unfunded throwaway key, nothing sent: chain
84532 at block 48,046,859, the latest block's clock 1 s behind the wall
clock, gas price 6,000,000 wei (0.006 gwei), the `GasPriceOracle` present
and its L1 data term negligible — `getL1Fee` answered 290 wei for the
16 KB initcode sample and 163 wei for a 600-byte step, with the L1 base
fee at 18 wei and the blob base fee at 2 wei; the whole rehearsal needs
0.027946 ETH — the deploy 0.001080 ETH (120 M gas × 0.006 gwei × 1.5),
the campaign 0.026866 ETH, of which two mints at the default 0.01 ETH
price are 0.020 and the second key's funding 0.001713 — and the run ended
with "fund `<address>` with at least 0.027946 ETH more", exit 1.

The hub's `tokenURI` budget in CI is 8,000,000 (`tools/gas.mjs`, 7.64 M
measured cold in the battery); the 7.91 M the node estimates is the
estimate's own margin over the execution, not a different measurement.

## The key, when the run is done

The burner holds the Timelock's admin at the end of a rehearsal (the
record's `timelock.disposition` says so, read from the chain, and the
campaign record's `disposition` reads it again). On a rehearsal chain the
key is then destroyed: with `--key-file` the file is overwritten with
zeros, fsynced and unlinked after both records are written, and the run
says so; a key from `PRIVATE_KEY` is the operator's to destroy, and the
run prints the exact steps — `unset PRIVATE_KEY`, remove the line that set
it from the shell's history, never fund the address again. Its address
lives on only in the record's `deployer` field. On a band the order is
DESIGN §12's: the admin is rotated to the 2-of-3 queue-only multisig or
renounced through the Timelock's own seven-day queue, and the burner is
destroyed after the record is written.

## The MVB done-criterion, as a checklist

BUILD-PLAN.md's criterion for waves 0–3, and where each item is proved:

- [x] `npm run check` green on both builds — `docs/CHECKPOINT.md`'s battery table (26 steps).
- [x] a holder can mint — the campaign's two mints, ids from the `Transfer` log (wire); `verify-console` journey (Chromium).
- [x] open the site from a marketplace frame — `verify-console`'s viewer group (the `data:` document in an `<iframe>`, Chromium, U11).
- [ ] open the site from `web3://` — a `web3://` client or a self-hosted `web3url-gateway` against the Base Sepolia deployment: the operator's step, with `verify-gateway` as the check.
- [x] connect — `verify-console` (the EIP-6963 picker, the gesture), Chromium.
- [x] swap on the owned market — the campaign's exact-in and exact-out (wire); `verify-console`.
- [ ] quote elsewhere — needs the Router, which needs a probed venue table (`VENUES` in `tools/deploy.mjs`); no testnet row exists, so the Router is skipped on every rehearsal chain and the quote-elsewhere path is `verify-site`'s and `verify-console`'s against the in-process venue mocks only.
- [x] speak and whisper — the campaign's `speak` at home and the stamped SEALED whisper, settled by the reply (wire).
- [x] launch a coin and a raise that graduates into a sealed market whose `collect` pays the Reach — the campaign's launch → create → buys → graduate → collect, the fee read as the Reach's balance delta (wire).
- [x] seal — the campaign's `seal`, and `panic`'s seal to the maximum (wire).
- [x] lock — the campaign's native lock to the Reach, released when due (wire).
- [x] grant a session that dies on sale — the campaign's grant and act, then `sessionCurrent` false after `panic` and `rightsOf(id, key)` 0 (wire); the sale's revocation of a live session is `verify-console`'s journey and `test/Bundle.t.sol`.
- [x] sell the whole bundle with the buyer's `rightsOf` showing the seller holds nothing — the campaign's `transferFrom`, `rightsOf(id, seller)` read back as 0 and the Reach answering to the buyer (wire).
- [ ] the same on Base Sepolia and Sepolia, with `deployments/84532.json`, `deployments/11155111.json` and their campaign records committed — awaiting a funded burner: the command is the second one in "The commands".

## The rollout order (DESIGN §12), and what comes after

Per chain, in this order, every arrow a constructor that inspects code:
CREATE3 factory → Timelock → Engine (head, body, six panels; `freeze`) →
Crest → Reach impl → Grip impl → Catalog (its three companions, then the
façade) → Renderer → hub (the four facets then `IntactDiamond`, or the
monolith, by the ship rule) → KeyRegistry → Roster → Postage → Parley →
Locks → Pool → Coin template check → Kiln → Launchpad → Router (only
where a probed venue table exists) → Steward → Premises → `recover-record`
with 0 disagreeing → the record. Then, through the Timelock's seven-day
public queue and only there (`Timelock.execute(factory, 0, deploy(salt,
code))`, executable by anyone once ripe): AgentCard, the LaunchHook
template, LPCustodian, Market, Roles, Nameplate (band 0) — each at the
address the hub already pins. Then the Timelock's admin to the multisig or
renounced; the burner destroyed after the record is written.

Across chains: Base (band 1) first; Ethereum (band 0) before
Glamsterdam/EIP-8037 reprices code deposit; OP Mainnet (band 2) only on a
written decision. Every deployable shares one address on every band,
because every band's factory is `CREATE(burner, 0)` from a key at nonce 0
and every salt is `keccak("intact.v1.<key>")`; the Engine is the burner's
plain CREATE at nonce 2 and its shards `CREATE(engine, 1 + k)`, the same
everywhere with `dist/` byte-identical (`deployments/README.md`, "Two
things the record says that DESIGN.md §12 says differently").
