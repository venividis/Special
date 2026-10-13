# Security

What INTACT promises, who can do what, how each promise is enforced, what is
left open, which battery attacks each class, how a finding becomes a
replayed row, and what is not claimed. Written by U12 from `DESIGN.md` §2,
§3, §12 and §14, `docs/INVARIANTS.md` and the three battery tools; counts
are from the runs the commit body names.

## 1. The threat model in one paragraph

Every value a holder can lose sits in one of a token's two ERC-6551
accounts (the Reach and the Grip), in the token's owned market on the Pool,
in a raise on the Launchpad, or in the token itself. The adversaries are:
a stranger with an RPC; a renter, operator or approvee who has a narrower
right and wants the holder's; the holder's own leaked session key or
phished approval; a hostile token (fee-on-transfer, rebasing, re-entering,
blind) a market or a manifest was opened on; a venue whose code changed
under a pinned address; the seller of a token who tries to keep a hand on
it; a browser page that lies about what it will sign; and the curator. No
admin exists over a holder's guarantees, so "the operator" is not an
adversary class: there is nobody to compromise.

## 2. Trust boundaries — who can do what

`holds(id, who) = ownerOf(id) == who`; `acts(id, who) = holds || who ==
account(id)` (the holder or the token's own Reach). Every satellite uses one
of these two words and re-derives nothing (DESIGN §2; `src/lib/Rights.sol`).

| Actor | May | May never |
|---|---|---|
| **Holder** (`R_HOLD`) | everything: grant and revoke sessions, seal, guard, arrange the steward, bind a key, set guardian / user / agent wallet, the first launch, every market operation, panic | shorten a seal, a lock or a market seal; move a locked or transfer-sealed token; send the token into any canonical account of the collection |
| **Reach** (`R_ACCOUNT`, the token's acting account) | act in every satellite under `acts`; sign ERC-7739 attestations only; be the payer of record for postage | grant sessions, seal, bind keys, arrange the steward, set guardian / user / wallet (strict `holds`); sign a venue's order while sealed (arithmetically incapable); delegatecall (`OnlyCall`) |
| **Session key** (`R_SESSION`) | act only through `executeAsSession` / `executeTyped`, only while the token is `Active`, within its allowlist, caps and interval, under the custody epoch it was granted in | call the Reach itself or any grant / seal / revoke word (`NoPrivilegeEscalation`); name a spender the holder did not; sign ERC-1271 (`0xffffffff`); survive a sale, a panic or a buy-back |
| **Guardian** (`R_GUARDIAN`) | `pause`, `panic` (custody epoch, `guardianHold`, `sealMax`, `revokeAllSessions`), `revokeSession`, `revokeOpenApprovals`, `approveFirstLaunch` | transfer, spend, un-pause, revoke the owner's operators on other tokens; outlive the sale (cleared by `_update`) |
| **Renter** (`R_USE`, ERC-4907) | be printed "you are the user until T" | speak, swap, launch, set a trait, sync the curve, move inventory (`NotYours`, `NotActor`, `NotHolder`) |
| **Operator / approvee** (`R_CUSTODY`) | transfer the token (not under a guardian's hold) | act in any satellite |
| **Delegate** (`R_DELEGATE`, delegate.xyz) / **role holder** (`R_ROLE`) | view | write |
| **Steward** (contract) | `hub.stewardTransfer(id, dest)` for a matured plan, through the sealed `_update` | bypass a lock, a seal or the canonical-account rule; count a stranger's call as life |
| **Timelock** (the curator) | `setPrice`, `setRoyalty` (≤ 5 %), `withdraw` of mint proceeds, `sealPricing`, and after the MVB the deployment of a post-MVB satellite through the CREATE3 factory — every one a week after it was queued in public | touch any holder's token, account, market, raise or speech; anything after `sealPricing` and renunciation |
| **Anyone** | mint at the price; trade any open market; `graduate`, `fail`, `refund`, `claim`; `collect` a sealed market's fees to the beneficiary's `feeSink`; `expire` a lapsed stamp; `summon` with the heir's preimage; `execute` a ripe Timelock operation; read everything | — |
| **Nobody** | — | spend from the Grip (no selector exists); withdraw a sealed market's principal; shorten any ratchet; set the script URI; `diamondCut`; pause a withdrawal |

The **custody epoch** is the clock every delegated right dies by:
`custodyEpoch[id]` moves on every custody change (sale, self-transfer,
steward or market move, panic), and sessions, recipes, key bindings, inbox
prices, cooldown buckets, steward plans, first-launch approvals and (post-MVB)
roles and listings store the epoch at grant and compare live. Away-and-back
revives nothing. What survives a sale is the buyer's protection: the Reach's
seal, manifest and pieces; the market with its reserves and seal; sealed
markets' fee streams (paid to whoever `feeSink(id)` names); locks whose
beneficiary is the Reach; the Grip's contents; the archive; traits; the
open-approval ledger (visible, revocable in one call).

## 3. How each promise is enforced

**By construction** (no measurement, no page, no key can change it): every
address a contract trusts is an immutable (`src/Pool.sol` `HUB`,
`LAUNCHPAD`; the hub's `IntactConfig`); there is no owner, admin, pause,
allowlist or upgrade path on any contract a holder's value sits in (the
Pool's ABI is asserted to name none; the diamond has no `diamondCut`); the
Grip has no function that moves an asset (asserted against its compiled
ABI); `Reach.execute` is CALL only; the Reach's own address and every
grant / seal / revoke selector are refused to a session; no Intact can enter
any canonical account of the collection (`_isCanonicalRecipient`
recomputes CREATE2 and the forwarder codehash — a `token()` answer is never
believed); `Ratchet.raise` is the one way any seal, lock or market seal
moves; `Engine.freeze()`, `sealPricing()` and every immutable are one-way;
`Transient` locks on every door that moves value or hands control to a
token — every state-changing function of the Pool, the Reach's acting
paths, Parley's three ways of saying something, Postage's stamp and pull,
the Launchpad, the Kiln and the Router — cleared on every exit including a
revert.

**By measurement** (the contract reads balances, never trusts words): the
Reach's seal snapshots every manifest asset and every guarded piece before
a call and refuses the call if anything is smaller or gone afterwards
(`Shrank`, `WentBlind`, `PieceLeft`), so a drain by a function name no list
has is still caught; while sealed, a promised asset hears only `transfer`
and `transferFrom` (deny-by-default, after Permit2 walked through a
blocklist); session ERC-20 caps are charged by balance delta;
`executeTyped` measures what left and what arrived; the Pool measures what
arrived on every pull and caps every payout at `balance − (totalReserved −
this market's claim)`, so a rebasing or sweeping token fails the market
CLOSED (`Insolvent`) until its holder writes it down; the Router trusts its
own balance delta over a venue's return value and re-reads every venue's
`extcodehash`; Postage settles by crediting a ledger, never by pushing
inside a whisper.

**By the page** (the console refuses before the wallet opens; a different
client could skip these, so they protect a person, not the contracts):
the confirm slab re-reads the custody epoch inside the press; every
approval the page builds is exact and an approval of 2^255 or more is
refused, also inside `execute` / `executeBatch` / `executeTyped`; every
deadline is the chain's clock; an unknown EIP-7702 delegate hides the
spending controls; the sealed DM re-reads the recipient's key immediately
before every send and never downgrades to plain text; a non-holder sees the
custom error from `eth_estimateGas` before a prompt; the viewer never asks
to sign. Each of these is asserted by `tools/verify-site.mjs` (INVARIANTS
F3–F7) and, in a real browser, by U11's `tools/verify-console.mjs`.

## 4. One-way operations

`Engine.freeze()`; every immutable; the diamond's routing table; each
launch's fee terms; a sealed market's principal (never withdrawn); the Grip
(no spend path, so anything sent there is there until the collection ends,
which is never — there is no burn); seals, locks and market seals only
lengthen (365 days / 10 years / 365 days); `sealPricing()`; the Timelock
admin's renunciation. After `sealPricing` and renunciation there is no
setter anywhere (DESIGN §12).

## 5. Residuals — documented, not fixed

From DESIGN §3 and the build sessions (`docs/CHECKPOINT.md`):

- An Intact sent to the **not-yet-deployed canonical account of an
  unminted id** is not classifiable: before that id is minted the address
  has no code and is an ordinary recipient. Reachable only by a deliberate
  transfer to a precomputed address; the page never builds that calldata.
- **`panic` keeps the guardian** (a safety role is appointed, not
  delegated; a guardian who has just panicked a token must still be able to
  panic it again). A sale clears it.
- **`ClearPathCache` is not emitted on `setUser`, `setStatus` or `pause`**;
  a gateway caching `/token/<id>/state.json` across a status change serves a
  stale status until the next custody event. `Catalog.stateOf` is live.
- **Postage's payer of record is the sender token's Reach** — no
  wallet-pays model in v1; ERC-20 postage is pulled from the Reach, and
  every refund lands there.
- **A home room exists only after its steward's first act in it**, so
  `follow` reverts `NoSuchRoom` for a token that has never spoken at home.
- **`R_ROLE` reads the USER role only** until U16 widens `IRoles`.
- **`Timelock.execute` is open to anyone**; `queue` and `cancel` stay the
  admin's.
- **The holder can re-shape an unsealed curve against a pending trade**
  (bounded by the trader's `minOut`/`maxIn`; a trader who passes zero has
  chosen to be); a renter cannot (`syncCurve` is `acts` and pins `expected`).
- **One liquidity provider per market**: no aggregation, no oracle, no TWAP;
  nothing should read an owned market as a price feed.
- **Fail-closed has a liveness cost**: a downward rebase of a market's
  token freezes that market's withdrawals until the holder calls
  `writeDown`; whoever writes down first books the loss.
- **A sealed Reach cannot `claim()` or `vote()` on a promised asset**
  (deny-by-default): remove the promise before sealing, or do not make it.
- **ERC-1155 holdings cannot be guarded by identity** (`guardNFT` needs
  `ownerOf`); only ERC-721 pieces are.
- **No rolling per-period session cap** in v1 (DESIGN decision 33): caps
  are cumulative per grant; the holder re-grants to reset.
- **Sealed DMs have no forward secrecy**, and the sealing key is one per
  wallet derived from one `personal_sign` sentence: whoever holds that
  signature holds the scalar. The page says so before it asks.
- **Logs are the archive**: once EIP-4444 prunes old logs from non-archive
  nodes, the four-head ring is the re-entry point and older messages need
  an archive node.
- **The Postage `settle` window check is redundant** with Parley's
  `_settleIfReply` (its only caller already enforces `block.timestamp ≤
  replyBy`), so no test drives it alone; kept as defence in depth.
- **The MVB contracts are unaudited** (§8).

## 6. The battery, by class

| Class | INVARIANTS rows | What runs in `npm run check` |
|---|---|---|
| Sale revokes every seller authority; buy-back revives nothing | A1, A5, B5, E1, E3 | `test/Update.t.sol`, `test/Bundle.t.sol`, `test/Sessions.t.sol`; `tools/verify-findings.mjs` (*"the key works before the sale, is SoldOn after it, the seller's rightsOf is 0, and a buy-back by the same holder revives nothing (still SoldOn, sessionCurrent false)"*); `tools/agents.mjs` (*"a sold token's sessions are dead"*, *"rightsOf of a seller carries nothing after a sale"*, *"a sold token has no key"*, *"a sold token's inbox is open and free again"*) |
| Locks, holds, seals only lengthen | 0.1, A2, B4, C3 | `test/Ratchet.t.sol`; `tools/verify-vault.mjs`; `tools/verify-findings.mjs` (B4); `tools/agents.mjs` (*"the market seal only lengthens"*, *"the Reach seal only lengthens"*) |
| The seal is measured, not enumerated | B4, B6 | `tools/verify-vault.mjs` (*"a drainer with a function name no list has still Shrank"*); `tools/verify-findings.mjs` (the drainer, Permit2's word, SealBreaker, the guarded piece) |
| The Grip has no spend path | B1 | `tools/verify-vault.mjs`, `tools/verify-findings.mjs` (the compiled ABI) |
| Sessions: epoch, Active, caps, no escalation | B5 | `test/Sessions.t.sol`; `tools/verify-findings.mjs` (SpenderNotAllowed, TargetNotAllowed after a re-grant, EmptyBatch); `tools/agents.mjs` (the drainer's nine shapes every tick) |
| The market: k, anchors, one lock, solvency, no admin | C1, C2, C3, C5 | `test/Pool.t.sol`, `test/PoolReenter.t.sol`; `tools/verify-pool.mjs`; `tools/fuzz.mjs`; `tools/verify-findings.mjs` (C1/C2/C5 refuted on HEAD and reproduced on a variant with the guards removed); `tools/agents.mjs` (*"k never falls on any market across a trade"*, *"totalReserved never exceeds the Pool's balance"*) |
| The Router: Reach-only, pinned venues, delta floors | C4 | `test/Router.t.sol`; `tools/verify-findings.mjs` (a venue that under-delivers by one wei) |
| The raise: credits, tax clamp, no withdraw | D1, D3, D4, D5 | `test/Launchpad.t.sol`; `tools/verify-launch.mjs`; `tools/agents.mjs` (*"the raise's credits never move ERC-20 before graduation"*, *"the sniper tax and the fee together stay under 99 %"*) |
| Speech: `mayActAs`, (token, epoch) buckets, keys, postage | E1, E2, E3 | `test/Parley.t.sol`, `test/Postage.t.sol`; `tools/verify-parley.mjs`; `tools/verify-findings.mjs` (the renter, the naive walker, the double-settle, the departed holder's key); `tools/agents.mjs` (*"a second word in the same block is refused by the brake"*, *"exactly one of settled/refunded per stamp, never both"*); the mutation gate `tools/mutations.mjs` |
| The site: one byte-stream, caps, no eval, escaping, the slab | F1–F7 | `tools/verify.mjs`, `tools/gas.mjs`, `tools/build-app.mjs`, `tools/verify-premises.mjs`, `tools/verify-site.mjs`; `tools/verify-console.mjs` (U11) |
| Agents: receiving grants nothing | G1 | `test/Rights.t.sol`; `tools/verify-findings.mjs` (the Bankrbot class) |
| Deployment: records, salts, the factory's gate | H3 | `tools/verify-recover.mjs`, `tools/recover-record.mjs` |
| The ledger itself | all | `tools/invariants-check.mjs`: every row names an assertion that exists |

## 7. Reporting a finding, and how it becomes a row

1. Reproduce it against HEAD in the harness: `tools/evm.mjs` `Chain.open()`
   and `tools/site.mjs` `deploySite` give the same deployment every
   verifier uses, and `test/mocks/` holds the hostile tokens, venues and
   re-entrant holders. Say which actor, which call, which error — or which
   balance moved.
2. If it reproduces, the fix lands with a sentence-named test in the unit's
   suite and a block in `tools/verify-findings.mjs` that performs the
   attack and asserts the refusal (`refuted on HEAD`). Where a one-line
   removal of the new guard re-opens the hole, the block also compiles that
   COPY of the source and shows the attack succeed against it
   (`reproduced`); a reproduction that does not reproduce fails the run.
3. The INVARIANTS row the finding belongs to cites the new sentence, and
   `tools/invariants-check.mjs` holds the citation to the file forever.
4. A guard in Parley or Postage gets a row in `tools/mutations.mjs` so the
   test that kills its removal is known by name.
5. A donor finding with no counterpart here is recorded as an `n/a` line in
   `verify-findings` with the reason, never as a pass.

There is no bounty programme and no disclosure address in this repository
yet; until a deployment exists beyond a local chain there is nothing to
disclose against.

## 8. What is not claimed

- **Unaudited.** No audit has been performed. DESIGN decision 35 requires
  two independent audits of `Intact`, `Reach`, `Pool` and `Launchpad` on the
  deployed commit before band 1 launches.
- **Nothing is deployed beyond a local chain.** `deployments/31337.json` is
  a record of a hardhat run; the testnet rehearsal is U13.
- **The harness is not Foundry.** `tools/forge.mjs` runs the stated tests
  with a cheatcode precompile; there are no invariant campaigns, no
  coverage, no traces. `tools/agents.mjs` is a seeded monitor of 220 ticks,
  not a proof; `tools/fuzz.mjs` is seeded and shrinking but bounded.
- **`static-audit` is a heuristic scan**, not a security audit; its own
  summary line says so.
- **The mutation gate covers Parley and Postage only**: 19 one-token
  mutations, 18 killed (17 in a tree pruned to the two contracts and their
  suites, P13 by `test/Bundle.t.sol` in the full tree), 1 survivor (P11) named
  in INVARIANTS E1 with the test it asks for. Every other contract's mutation evidence is the one-character
  checks its unit recorded in its commit body, not a gate that can be rerun.
- **Page-enforced rules protect a person using this console**; another
  client is free to build an unlimited approval or skip the epoch re-read,
  and the contracts do not stop it.
- **Not implemented**: ERC-7857 (no claim), ERC-4337, passkeys, ERC-7579/7821,
  MLS sealed rooms, federation, Market, Roles, AgentCard, the MCP bridge,
  Nameplate (post-MVB units U14–U18); the Reach is never an EIP-7702
  delegate.
- **Gas gates are measured against caps that exist today** (EIP-7825's
  2^24, node defaults of 50 M); a chain that lowers them breaks `tokenURI`
  first, and `tools/gas.mjs` would say so.
