# IPSEITY (Most-Advanced-NFT-Possible) — branch survey, batch 1

Repository: `/home/user/Most-Advanced-NFT-Possible`
Base ref: `origin/claude/advanced-3d-nft-gui-6490lk` (tip `297e936`, 2026-09-23, "Merge pull request #40 from venividis/codex/run-complete-testnet-on-sepolia").
Method: read-only (`git log`, `git diff --stat`, `git diff base...branch`, `git show branch:file`); nothing checked out. For every branch that was "ahead" I also grepped the base tree for the branch's distinctive identifiers, because the base is 20-50 commits ahead of most of these branches and several fixes reached it through a different commit.

## Executive summary

35 branches scanned. 22 are fully merged (zero commits ahead). 13 are ahead, but they collapse to **seven distinct bodies of work**, because five branches are merge-commit wrappers or byte-identical re-submissions of another:

| Distinct work | Branch (canonical) | Duplicates / wrappers | In base? | Value for the GOAL |
|---|---|---|---|---|
| Console second tranche: TRADE / HAND / SPEAK lanes, cross-chain SPEAK walk, 3 Base Sepolia redeploys, invariants 150-156 | `claude/claude-md-docs-8vvyc8` | — | **No** (base console-lanes.js is 23 KB vs 53 KB; no `openMarket`, `stateOf`, `Echoed`, `sels()`, `PORT`) | **High** — this is the holder-gated web app for swap + messaging + handing-on, the exact surface the GOAL needs |
| Sepolia ENS NameWrapper address fix (1 line) | `codex/fix-high-priority-bug-in-ens-custody` | `codex/propose-fix-for-custody-vulnerability-iodub2` (merge of PR #26) | **No** (base still uses the mainnet wrapper for chain 11155111) | Medium — ENS custody is dead on Sepolia without it |
| Rollup L1-data-fee reserve in deploy preflight | `codex/fix-high-priority-bug-in-preflight-checks` | `codex/locate-container-key-in-project` (merge of PR #25) | **No** | Low-medium (ops) |
| Sealed-DM stale-key revalidation + `--new-parley` migration | `codex/fix-high-priority-issues-from-codex-review` | `...-tlo4vf` (identical), `codex/propose-fix-for-sealing-client-vulnerability` (merge of PR #27) | **No** | **High** (security, messaging layer) |
| Facet `syncFee` front-running fix + launch-page sync control | `codex/fix-issues-from-codex-review-#31` | `codex/propose-fix-for-facet-pool-fee-vulnerability` (merge of PR #36) | **No** (base `Facet.syncFee()` still takes no argument) | **High** (security, launchpad) |
| Gate+Facet combined hook, V4PositionPlanner hardening, position lifecycle UI | `codex/list-nft-functions-and-suggest-upgrades-hciyvv` | sibling `codex/list-nft-functions-and-suggest-upgrades` is merged (PR #38) but this branch is a *parallel* line with 2 extra commits | Partly (base has `V4PositionPlanner`/`LaunchView` from PR #38 but **not** `GateFacet`, the authority fix, the PoolKey-from-PositionManager fix, or StateView pricing) | **High** (launchpad security + features) |
| Hidden second codebase "IDFBI / ImpossibleNFT" shipped as a checksum-locked base64 tarball | `idfbi-isolated-ci-20260904` | — | No (not source in tree) | **High as design reference** (agent kernel, session keys, passkeys, capsule vault, cross-chain mirror); not mergeable as-is |
| ENS custody authentication (wrapper-only, anti-counterfeit) | `codex/propose-fix-for-custody-vulnerability` | — | **Yes, in substance** (base Nameplate has `NAME_WRAPPER`, wrapper-only `_ownsNode`/`heldBy`, and the "registry control cannot counterfeit custody" test) | Already captured; vulnerability write-up below for the record |

Important context for the merge program: the base went **Ethereum-only** (`codex/restrict-to-ethereum-only`, merged) after most of these branches forked. The Base Sepolia deployment records in `claude/claude-md-docs-8vvyc8` are therefore historical for the base, but the contracts and client code are not.

---

## claude/claude-md-docs-8vvyc8 — UNMERGED, HIGH VALUE

**6 commits ahead, 53 behind.** Author: Claude (sessions 2026-08-23/24). Despite the branch name, there is no CLAUDE.md change; this is the **second console tranche** plus three live Base Sepolia redeploys.

```
8fe6931 A message from another chain renders in the console, labeled and live
7f8565e The console hears the other chains: the SPEAK lane walks the port
3cc0fd3 The full console ships to Base Sepolia, and a live chain proves the walk
68ce265 The lanes fill: trade, hand and speak stop being honest notes
9823a31 The Live now block catches up with the deploy it describes
4113909 The redesigned site is live where a browser can reach it
```

```
 CONSOLE.md                    |  61 ++++
 DEPLOYMENTS.md                | 110 ++++++-
 INTERFACE.md                  |  21 +-
 INVARIANTS.md                 |  66 ++++
 OMNICHAIN.md                  |  18 +-
 deployments/base-sepolia.json |  91 +++---
 engine/console-lanes.js       | 692 ++++++++++++++++++++++++++++++++++++++++--
 src/ConsoleRead.sol           |  82 +++++
 src/PageConsole.sol           | 135 ++++++--
 tools/redeploy-site.mjs       |  12 +
 tools/site.mjs                |   8 +-
 tools/verify-console.mjs      | 313 ++++++++++++++++++-
 12 files changed, 1492 insertions(+), 117 deletions(-)
```

**Verified absent from base**: `ConsoleRead.sels()`, `PageConsole.PORT`/`PARLEY`, the string "HEARD FROM OTHER CHAINS", and every `openMarket`/`stateOf`/`Echoed`/`approve` reference in `engine/console-lanes.js` (base file 23,060 bytes; branch 53,097 bytes). Base `PageConsole` constructor still takes 4 args; branch takes 6 (`parley`, `port`).

### What it builds (the holder's web app — directly on the GOAL)

From commit 68ce265, "The lanes fill":

> TRADE carries the maker's whole bench — openMarket, deposit, withdraw, setFee, bond with the ratchet stated beside the button, syncCurve with the drift read first through pendingCurve, closeMarket — and the swap for anyone: quoted at review time, a floor in words beside "or nothing moves", a fifteen-minute deadline. The ERC-20 approval is the button's current step (spec row 24): exact amount, never unlimited, never a separate control. An amount for a coin whose decimals() did not answer is refused, not guessed. ANYONE'S POOL stays at /swap, linked — the two trading surfaces stay two because who is paid the fee must stay loud.
>
> HAND now runs its sections in ascending finality, and that ordering is asserted. setUser fills its named hole (lend free, ends by itself, with a take-it-back while it stands); the transfer is the first control under the last heading; the bolt (lock/unlock) lives under FOR GOOD as the refusal to hand on. Granting keys stays at /keys, argued in CONSOLE.md: the page that serves the signature table is the only one that can honor "signatures, never raw bytes4".
>
> SPEAK carries the commons: a composer (PLAIN, refusing past 1024 bytes counted as bytes) and the walk — stateOf(0), then one single-block eth_getLogs per hop along the prev pointers, twelve hops then the count of what lies deeper. Sealed messages render as sealed, non-UTF-8 as not text, and a commons that did not answer is never an empty commons.
>
> The seed grew to carry it: pool and market (mkt key present exactly when the pool answered — open:0 is a closed market, absence is no answer), the lender's user/userX, Parley's address and the Said topic asked of topics() at render time. Twenty-seven selectors, all derived on chain — and the table pushed PageConsole to 24,082 B, 98% of EIP-170, so it moved to ConsoleRead.sels(): PageConsole is 19,977 B (81%) and ConsoleRead 7,476 B (30%).

From commit 7f8565e, the cross-chain messaging surface:

> PageConsole takes the port as a sixth constructor argument (site.mjs passes it; redeploy-site reads it from the chain's own deployments/port-<chainId>.json, and a chain without a record simply does not federate); the seed grows port, echoed and an eid-name map; ConsoleRead.sels() grows lastEcho and echoCount, to 29 entries.
>
> The lane renders HEARD FROM OTHER CHAINS as a second archive, kept visibly second: walked by the same single-block eth_getLogs step along Echoed's prev pointers, every voice labeled with its origin chain's name, never mixed into the local column — the port cannot impersonate a local token on chain, and the rendering preserves the boundary. Three silences stay three sentences: no port wired, a port that heard nothing, a port that did not answer.
>
> The port cannot serve its topic the way Parley serves topics() — it is sealed at its nonce-0 address on every chain — so PageConsole spells the event signature once, and verify-console rebuilds the signature from the compiled port's own ABI, hashes it with the tool's own keccak, and holds the seed equal to it.

### The selector table (ConsoleRead.sels) — the console's whole write surface, derived on chain

```
commit(uint256,uint256)  embody(uint256)  embodyGrip(uint256)  transferFrom(address,address,uint256)
mint()  price()  openMarket(uint256,address,address,uint16)  closeMarket(uint256)  setFee(uint256,uint16)
bond(uint256,uint64)  deposit(uint256,uint256,uint256)  withdraw(uint256,uint256,uint256,address)
quote(uint256,bool,uint256)  swap(uint256,bool,uint256,uint256,address,uint256)  syncCurve(uint256)
pendingCurve(uint256)  approve(address,uint256)  allowance(address,address)  setUser(uint256,address,uint64)
lock(uint256)  unlock(uint256)  locked(uint256)  speak(uint256,uint256,uint8,bytes)  stateOf(uint256)
balanceOf(address)  decimals()  symbol()  lastEcho()  echoCount()
```

The eid-name map seeded for labeling foreign voices: `30101 Ethereum, 30111 Optimism, 30102 BNB, 30320 Unichain, 30416 Robinhood, 30184 Base, 30110 Arbitrum, 40161 Ethereum Sepolia, 40245 Base Sepolia, 40451 Robinhood Testnet`. The `Echoed` event signature spelled in PageConsole: `Echoed(uint32,uint256,uint64,uint64,uint8,bytes)`.

### New invariants (INVARIANTS.md 150-156), quoted

> **150. The seed distinguishes an absent market contract from a closed market.** The console's `mkt` key is present exactly when the pool answered — `open:0` is a market that could open, an absent key is a chain where no pool spoke, and the trade lane renders those as the two different facts they are.
>
> **151. Every selector in the seed is the keccak of its signature, derived on chain.** The browser ships no hash function; the seed's twenty-seven selectors come from `ConsoleRead.sels()` and the `Said` topic from Parley's own `topics()` — and the verifier re-derives each with its own keccak and compares.
>
> **152. The approval is the button's current step, exact, never unlimited.** Pressing the swap with no allowance proposes an approve for exactly the amount entered; pressing the same button with the allowance standing proposes the swap. There is no separate approve control and no unlimited allowance anywhere in the console.
>
> **153. A proposed swap carries its floor and its deadline.** The quote is read at review time, the slab states the minimum out in words beside "or nothing moves", and the calldata carries both — the two front-running defenses ride in every swap the console builds.
>
> **154. The commons is walked by its own back-pointers, and silence has two spellings.** The speak lane opens with the sentence that justifies the one past this console shows; the walk is one `stateOf` and one single-block `eth_getLogs` per hop; and a commons that did not answer is never rendered as a commons where nothing was said.
>
> **155. The hand lane runs shallow to deep, and the shallow end says it ends by itself.** FOR AN AFTERNOON precedes FOR GOOD in the rendered lane — the ordering is the warning — the loan's slab states that it ends on its own, and an unanswered bolt is "not reported", never open or shut.
>
> **156. Foreign voices are labeled and never mixed.** The SPEAK lane walks the port's `Echoed` archive under its own heading, each message named by its origin chain, and no federated message ever renders in the local column — the port cannot impersonate a local token on chain, and the console preserves that boundary in the rendering.

### Deployment records (Base Sepolia, chain 84532) — three Premises in two days

From DEPLOYMENTS.md additions:

```
2026-08-23  Premises 0xd4e64108b923f2eb845c05e65610a9520e6b26ee   redesigned site: ways-map door, priced mint, services/2, /k/<id>/<key>
            Parley   0xaa8b3ff644638a29333953328fb877e8dd23e0f2   (kept)
            Token #3 minted (174,729 gas); Reach embodied at 0xed5560d3589bd25cbac39426499b254fc70099ea (102,471 gas);
            session granted to 0x31b23c2e798fa33f89fb210f5af33fff2fe1a5c5 — may call `commit`, 7 days, spend cap zero (153,231 gas)
            web3://0xd4e64108b923f2eb845c05e65610a9520e6b26ee:84532/k/3/0x31b23c2e798fa33f89fb210f5af33fff2fe1a5c5  -> "active, granted by the current holder"
2026-08-24  Premises 0xc64dff66cb3eb2a6afb6ff72a207f43addd33b95   lanes filled; forge 135/0, verify-site 580/0, verify-console 87/0; ~0.0012 ETH
2026-08-24  Premises 0xa2519f12b1bcd262ffa8ef76533e0dc58ec85350   console hears other chains; port 0x65d1e9d08488a68ef6bf48e057ab69496333c7ae in the seed
            port.lastEcho() = block 45,828,666; rendered: "block 45828666 · #3 · Ethereum Sepolia · 'the commons, heard on another chain'"
Ipseity 0x36c49f58c6437ee994766ce80f6654c4d797b8db · Pool 0x8b699b46edb8e8bd156347d73c8eaa2a0abe80f4 · Engine 0x3f3e39a630376301575afbf90b3af2a3eb003636 (frozen)
```

The branch's `deployments/base-sepolia.json` rewrites all 44 site addresses (chrome, desk, every page, every desk, kiln, locker, nameplate, succession, consign, roster, consoleSkin/Core/Read, pConsole, and a new `pKey`) to the 0xa2519f deployment. **Record conflict to resolve**: the base's `DEPLOYMENTS.md` "Live now" names Premises `0x01de7b5d...` while the base's `deployments/base-sepolia.json` names `0xc59f75d2...` — the base's own two records disagree, and both predate this branch's three deploys. Since the base is now Ethereum-only, treat all Base Sepolia records as history.

### Merge notes
- `PageConsole` constructor gains `(IParleyTopics parley, address port)`; `tools/site.mjs deploySite` gains `port`; `redeploy-site.mjs` reads `deployments/port-<chainId>.json`.
- Expect conflicts with the base's later console commits ("Fix console door across token ID bands", site enumeration fix, Ethereum-only). The lane JavaScript (`console-lanes.js`) and `ConsoleRead.sels()` are largely additive and should port cleanly.
- `verify-console.mjs` grows from 55 to 96 assertions; `CONSOLE.md` §D.3-D.5 "Shipped" notes record the amendments (ANYONE'S POOL links `/swap`; key grants stay at `/keys`).

---

## codex/fix-console-door-hard-coding-issue — merged
0 ahead (tip `aa06327` "Fix console door across token ID bands", in base).

## codex/fix-dom-based-xss-in-launch-preview — merged
0 ahead (tip `c2c28c2` "Escape launch symbols in preview", in base).

## codex/fix-high-priority-bug-in-ens-custody — UNMERGED, small but real

**1 commit ahead** (`adedb26`, 2026-09-16, venividis, "Use canonical Sepolia ENS NameWrapper"). One line:

```diff
   11155111: { name: "Ethereum Sepolia", ...
     ens: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
-    nameWrapper: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401"
+    nameWrapper: "0x0635513f179D50A207757E05759CbD106d7dFcE8"
```

**Verified**: base `tools/site.mjs` line 317 still has `0xD4416b13...` (the **mainnet** NameWrapper) under chain 11155111; `0x0635513f...` (the canonical Sepolia NameWrapper) appears nowhere in the base.

**Why it matters**: after the custody-authentication fix (which *is* in the base), `Nameplate` consults exactly one wrapper address, `NAME_WRAPPER`, and treats registry ownership by anything else as non-custody (`heldBy` returns `(0,false)`; `_ownsNode` rejects). With the mainnet address baked into a Sepolia deployment, every wrapped `.eth` name on Sepolia fails custody — the "put the name NFT in your token's Reach and it means your token" feature is silently dead on the one chain the project rehearses on, so the rehearsal cannot validate the mainnet path. Fold into the unified deploy config.

Wrapper branch: `codex/propose-fix-for-custody-vulnerability-iodub2` is the merge commit of PR #26 containing only this commit.

## codex/fix-high-priority-bug-in-preflight-checks — UNMERGED, ops fix

**1 commit ahead** (`9f3e6fd`, 2026-09-16, "Account for rollup data fees in deployment preflight"). New `tools/deployment-budget.mjs`, `tools/verify-deployment-budget.mjs`; `tools/testnet.mjs` uses it. Not in base (`deploymentBudget`/`ROLLUP_L1_FEE_ALLOWANCE` absent).

> Deployment funding must include fees that eth_gasPrice cannot see. OP Stack and Arbitrum-family chains charge an additional L1 data fee for transaction calldata. A full deployment measured 0.0214 ETH on Base Sepolia, so reserve more than twice that observed total rather than pretending execution gas is the whole bill. Keep this deliberately simple and auditable: it is a funding floor, not a quote.

```js
const ROLLUP_CHAIN_IDS = new Set([10, 11155420, 130, 1301, 4663, 46630, 8453, 84532, 42161, 421614]);
export const ROLLUP_L1_FEE_ALLOWANCE = 5n * 10n ** 16n; // 0.05 ETH
export function deploymentBudget(chainId, gasPrice, deploymentGas = 180_000_000n) {
  const execution = (deploymentGas * BigInt(gasPrice) * 15n) / 10n;
  const l1Data = ROLLUP_CHAIN_IDS.has(Number(chainId)) ? ROLLUP_L1_FEE_ALLOWANCE : 0n;
  const seedMints = 2n * 10n ** 14n;
  return { execution, l1Data, seedMints, total: execution + l1Data + seedMints };
}
```

The verifier pins "the Base Sepolia price that badly underquoted the live run" (6,000,000 wei). Relevant to the unified protocol if it deploys to Base (ANIMA is on Base Sepolia); the lesson is "a half-deployment is irrecoverable without a receipt journal".

Wrapper branch: `codex/locate-container-key-in-project` = merge of PR #25, same content, nothing else (the branch name is unrelated to its content).

## codex/fix-high-priority-issues-from-codex-review — UNMERGED, security (messaging)

**1 commit ahead** (`a7f6c2f`, 2026-09-16, "Revalidate DM keys and support Parley migration"). Files: `src/DeskSeal.sol`, `tools/redeploy-site.mjs`, `tools/verify-site.mjs`. Not in base (`PEER=null`, `--new-parley` absent). `codex/fix-high-priority-issues-from-codex-review-tlo4vf` is byte-identical (empty diff between the two); `codex/propose-fix-for-sealing-client-vulnerability` is the merge commit of PR #27 (tlo4vf).

**Vulnerability (sealed DM client, `DeskSeal`)**: the `/dm/<id>` page derives an AES-GCM pair key once, in `arm`, from the wallet's signature-derived point and the peer token's *published* point, and installs a `seal` callback that keeps using that key. A DM page can stay open across a transfer of the peer token. The published point does not change on sale (and the former holder's wallet can still derive it), so every later send kept encrypting to the **former** holder: the new holder could not read, the departed holder could. The old test only checked a "changed hands" banner at arm time.

**Fix** (quoted from the new comment in DeskSeal):

> A DM page can remain open across a transfer. The key observed by `arm` is therefore only a snapshot, never authority for a later send. Re-read immediately before every encryption and fail open to plaintext if the registry now reports no key or a rotation.

```js
const seal=async h=>{if(!KEY||!PEER)return{k:0,h:h};
const now=await onChain(OTHER);
if(!now||now.x!==PEER.x||now.y!==PEER.y){KEY=null;PEER=null;
say('#'+T.other+' no longer has the key this room armed with — plaintext until reconnected',1);
return{k:0,h:h}} ...
```

The new verify-site case arms the page, transfers the recipient token while the page is open, sends, and asserts the log's `k` flag is 0 ("the send revalidates the recipient and refuses stale-key encryption") and that the banner shows the downgrade as a warning.

**Second part — Parley migration**: `redeploy-site.mjs --new-parley` deliberately starts a new archive when "a release changes Parley's registry semantics", recording the old address in `rec.archivedParleys` instead of silently dropping it; unknown flags are rejected. Useful for the unified protocol's messaging layer: an explicit, recorded way to retire a message archive.

## codex/fix-high-priority-issues-from-codex-review-tlo4vf — duplicate
1 ahead; identical content to the branch above (`git diff` between the two tips is empty). Nothing unique.

## codex/fix-issues-from-codex-review-#31 — UNMERGED, security (launchpad)

**1 commit ahead** (`eeeff29`, 2026-09-16, "Secure and expose Facet fee synchronization"). Files: `src/Facet.sol`, `src/DeskLaunch.sol`, `src/PageLaunch.sol`, `tools/verify-launch.mjs`. Not in base (`syncFee(uint256`, `SectionMoved` absent). `codex/propose-fix-for-facet-pool-fee-vulnerability` = merge of PR #36, same content.

**Vulnerability (Uniswap v4 `Facet` hook)**: `Facet.syncFee()` copied the artwork's *live* section (`HUB.sectionOf(TOKEN)`) into the fee snapshot at mining time. Only the token owner may call it, but an ERC-4907 renter/operator may `commit` a new orientation. So between the owner reading the section and the sync transaction mining, a renter can turn the artwork, and the owner's sync approves a fee (anywhere between floor and ceiling) the owner never saw — a renter can set the pool's fee by front-running the owner's own approval.

**Fix**:
```solidity
error SectionMoved();
function syncFee(uint256 expectedSection) external {
    if (msg.sender != HUB.ownerOf(TOKEN)) revert NotTokenOwner();
    uint256 liveSection = HUB.sectionOf(TOKEN);
    if (liveSection != expectedSection) revert SectionMoved();
    _section = expectedSection;
    _synced = true;
}
```
The launch page gains a "Synchronize fee to the current section" control that reads the Facet's own immutable `TOKEN()`/`HUB()` (never form state), reads `sectionOf`, displays the section being approved, and carries it as the expectation. New selectors in the page config: `TOKEN()`, `HUB()`, `sectionOf(uint256)`, `syncFee(uint256)`. The copy changes from "nobody can set it by hand / no setter, no owner" to "after the owner synchronizes, it moves … between synchronizations the fee stays fixed" — honest about the snapshot semantics. New test: "a renter cannot front-run the section the owner approved".

Note: `GateFacet` on the hciyvv branch (below) still has the un-argumented `syncFee()`; apply this fix there too when merging both.

## codex/fix-provider-selection-vulnerability — merged
0 ahead (tip `4066a07` "Transaction reads follow the chosen wallet").

## codex/fix-user-overwrite-vulnerability-in-lease-contract — merged
0 ahead (tip `f6dcdda` "Authenticate expired lease users").

## codex/fix-vulnerability-in-token-indexing-logic — merged
0 ahead (tip `e321fdf` "Fix site enumeration for nonzero token bands").

## codex/list-nft-functions-and-suggest-upgrades — merged
0 ahead (tip `6b89a86` "Complete non-custodial Uniswap v4 launch liquidity", merged as PR #38; it introduced `V4PositionPlanner.sol` and `LaunchView.sol` into the base).

## codex/list-nft-functions-and-suggest-upgrades-hciyvv — UNMERGED, HIGH VALUE (launchpad)

**2 commits ahead, 4 behind**; merge-base `c0575b8`. The 4 base commits it lacks are PR #38 (the sibling above) and PR #40 (Sepolia exercise). This branch is a *parallel* line that re-implemented the sibling's planner and then went further:

```
9d63d9a 2026-09-19 Complete safe v4 position lifecycle
883df87 2026-09-18 Harden dynamic v4 launch liquidity controls
```

Three-dot stat vs merge-base: 16 files, +1196/-108 (new `src/GateFacet.sol` 116, `src/V4PositionPlanner.sol` 272, `src/LaunchView.sol` 115, `test/GateFacet.t.sol` 81, `test/V4PositionPlanner.t.sol` 305; `DeskLaunch.sol` +140, `Kiln.sol` +26, `PageLaunch.sol` ±119, `Venue.sol` +14, `tools/site.mjs` +38). **True delta against today's base** (two-dot): `GateFacet.sol` (+116, absent from base), `Kiln.sol` (+26), `V4PositionPlanner.sol` (57 lines changed), `LaunchView.sol` (+87), `DeskLaunch.sol` (+94), `PageLaunch.sol` (85), `Desk.sol` (+7), `README.md` (+24), tests (+81, +153). The two-dot diff would also *delete* `deployments/eth-sepolia-campaign-2026-09-24.json` and `eth-sepolia-exercise-2026-09-24.json` — an artefact of being behind, not intent; do not carry that over.

### Unique work, concretely

1. **`GateFacet.sol` — one immutable v4 hook combining launch gate + liquidity lock + artwork-driven dynamic fee.** Immutables `MANAGER, HUB, TOKEN, INITIAL_SECTION, FLOOR, CEILING, OPENS, UNLOCKS`; `beforeInitialize` requires a dynamic-fee pool; `beforeSwap` reverts `NotOpenYet(opens)` before the start time and returns `fee() | OVERRIDE_FEE` where `fee = FLOOR + (CEILING-FLOOR) * concentration(section)/MAX`; `beforeRemoveLiquidity` reverts `StillLocked(unlocks)` only for `liquidityDelta < 0` so PositionManager's zero-delta fee collection still works during the lock ("Hold principal until UNLOCKS without also stranding the fees it earned"); `status()` and `flags()` views; no admin, no upgrade. `Kiln.gateFacetArg(token, floor, ceiling, opens, unlocks)` packs the recipe into one word (`token<<176 | floor<<152 | ceiling<<128 | opens<<64 | unlocks`), and `recipeHash(kind==2, …)` mines/deploys it with `BEFORE_INITIALIZE|BEFORE_SWAP|BEFORE_REMOVE_LIQUIDITY`.

2. **`V4PositionPlanner` hardening vs the base's version** (three real fixes):
   - *Authority follows the NFT.* Base: `if (KILN.launcher(coin) != msg.sender || !KILN.mayActAs(token, msg.sender)) revert`. Branch: `if (!KILN.mayActAs(token, msg.sender)) revert`, with the comment "Otherwise transferring the NFT leaves the old holder unauthorized and the new holder blocked by the historical `launcher` record." Test: `test_authorityFollowsSigningNftAfterTransfer`.
   - *Settlement currencies come from PositionManager, not the form.* Base `increasePlan/decreasePlan/collectPlan/burnPlan` take a caller-supplied `PoolKey` whose currencies go into `SETTLE_PAIR`/`TAKE_PAIR`; the branch drops the parameter and reads the real key via `getPoolAndPositionInfo(positionId)` (`_positionKey`), so "the form cannot substitute settlement currencies".
   - *Mint prices from live StateView.* New immutable `STATE_VIEW`; `mintPlan` computes liquidity from `getSlot0(poolId)` rather than the caller's `sqrtPriceX96` (which could be stale or chosen), falling back to the supplied price only when `STATE_VIEW == 0` (local/mock). `livePrice(key, fallback)` returns the price and the block used. Test: `test_mintUsesLiveStateViewPriceAndReportsBlock`.

3. **Position lifecycle in the launch page** (`LaunchView.liquidity()` section 5 "manage a position": inspect, collect, increase, decrease, burn), Permit2 allowance read/skip/revoke ("Revoke PositionManager allowances"), explicit "position owner and fee controller" selector (wallet / the signing NFT's Reach / another address) with the warning that choosing somebody else "gives them that power", and a `Desk.wait(hash)` helper so each launch stage waits for a receipt (and throws on `status == 0`). New verify-launch assertions: "the liquidity call is built by the Solidity planner", "the returned plan goes straight to the configured PositionManager", "every dependent launch stage waits for a receipt", "the mint refreshes its price through StateView before planning", "Permit2 allowance is read and may be revoked".

4. **New chain config** in `tools/site.mjs`: `stateView` for mainnet (`0x7ffe42c4a5deea5b0fec41c94c136cf115597227`), `v4Positions`/`permit2` for mainnet, Base, Base Sepolia, Sepolia; `v4Planner` and `launchView` added to `VIA`/`EXPECTED`.

README paragraph (branch-only), quoted:

> The hook catalogue also includes a combined **Gate + Facet**: one immutable hook that schedules trading, locks liquidity, and derives a bounded dynamic fee from the launching NFT's section. Its three callback permissions are visible in its address, while its times and fee bounds have no setter, admin, or upgrade path. Lifecycle plans now read their PoolKey from PositionManager by position id rather than trusting a caller-supplied currency pair. This is local authority, not global control: the named position owner controls that official position and its LP fees, but any holder may create a separate pool or position because both the ERC-20 and Uniswap remain permissionless.
>
> Launch authority follows the NFT after a transfer: its current holder or Reach may complete the official position instead of authority becoming stuck between the historical launcher and the new holder. Before minting, the planner reads the pool's current square-root price from Uniswap's official StateView and reports the block used for the preview.
>
> The combined lock distinguishes principal from earnings. A negative liquidity delta stays locked until the immutable date; PositionManager's zero-delta fee collection remains available. Permit2 approvals are read before sending, skipped when sufficient, bounded to the requested amount and deadline, and may be revoked from the page.

Tests on the branch: `test_mintPlanIsCanonicalAndOwnerControlsPositionAndFees`, `test_onlyCurrentLaunchTokenAuthorityCanBuildAdvertisedMint`, `test_authorityFollowsSigningNftAfterTransfer`, `test_nativePairReturnsExactlyTheMaximumAsCallValue`, `test_decreaseChoosesWherePrincipalAndFeesGo`, `test_collectPokesWithZeroLiquidityAndRoutesFees`, `test_invalidRangeAndExpiredPlanAreRefused`, `test_plansExecuteThroughPositionManagerDecoderLifecycle`, `test_mintUsesLiveStateViewPriceAndReportsBlock`, `test_combinesAllThreePermissionsAndGuards`, `test_onlyTokenOwnerCanSyncArtworkFee`, `test_kilnPacksMinesAndDeploysCombinedRecipe`.

**Merge notes**: rebase the two commits onto the base's `V4PositionPlanner`/`LaunchView` (same names, different ancestry); apply the `#31` `syncFee(expected)` fix to `GateFacet.syncFee()` as well; `PageLaunch` constructor gains `planner, launchView` in both lines so check arity; `Venue.Wiring` struct gains `v4Positions, permit2` (constructor arg count changes — `verify-site` pads with two extra words).

## codex/locate-container-key-in-project — duplicate wrapper
2 ahead = merge commit of PR #25 + `9f3e6fd` (the preflight fix above). Nothing unique; branch name does not describe its content.

## codex/prepare-repo-for-production-readiness — merged
0 ahead (tip `6dc39e4` "The production review catches up with the branch it must join").

## codex/propose-fix-for-cookie-bomb-vulnerability — merged
0 ahead (tip `28ef2da` "Sandbox portal documents to isolate cookies").

## codex/propose-fix-for-css-vulnerability — merged
0 ahead (tip `b3edc94` "Keep financial warnings visible").

## codex/propose-fix-for-custody-vulnerability — merged in substance (no unique work)

1 commit ahead (`4b0b35b`, 2026-09-14, "Authenticate ENS name custody"), but every element of it is already in the base through another commit: base `src/Nameplate.sol` has `NAME_WRAPPER = nameWrapper` (line 165), `if (o == address(NAME_WRAPPER) && o != address(0))` (254), the "Registry control is not NFT custody" comment (389), and base `tools/verify-plate.mjs` has the "registry control cannot counterfeit custody" / "a noncanonical wrapper cannot invent name custody" cases (290-307). The only two-dot differences are the base's later Ethereum-only edits. For the record, the vulnerability it fixed:

> An account's own word is not enough. Any contract can implement `token()` and claim to be token 7's; the canonical NameWrapper must own the registry node and its answer must be the account. Registry control alone is deliberately insufficient because a .eth registrant can reclaim that control without a transfer from the account.

Before: `heldBy(node)` took whatever contract the ENS registry named as owner, called `ownerOf(node)` on it if it had code, and trusted the answer; `_ownsNode` likewise accepted any code-bearing registry owner's `ownerOf`. An attacker could set the registry owner of a node to a fake "wrapper" that answers `ownerOf` with any token's account — counterfeiting custody and therefore the name-to-token resolution — and plain registry control (reclaimable by the .eth registrant at any time) counted as custody. After: only the immutable `NAME_WRAPPER` is consulted; unwrapped registry control is not custody; a non-canonical wrapper cannot invent it. `Nameplate` constructor gains a 4th argument.

## codex/propose-fix-for-custody-vulnerability-iodub2 — duplicate wrapper
2 ahead = merge of PR #26 + `adedb26` (the 1-line Sepolia NameWrapper fix). Nothing unique.

## codex/propose-fix-for-ens-registration-vulnerability — merged
0 ahead (tip `e9e1224` "Use unpredictable ENS commitment secrets").

## codex/propose-fix-for-facet-pool-fee-vulnerability — duplicate wrapper
2 ahead = merge of PR #36 + `eeeff29` (the Facet `syncFee` fix above). Nothing unique.

## codex/propose-fix-for-inheritance-blockage-vulnerability — merged
0 ahead (tip `15844fe` "The first summons fixes the inheritance deadline").

## codex/propose-fix-for-known-default-key-vulnerability — merged
0 ahead (tip `f56c66b` "Require private key for port writes").

## codex/propose-fix-for-locker-reentrancy-issue — merged
0 ahead (tip `dfad0c7` "Guard Locker token flows against reentrancy").

## codex/propose-fix-for-market-picker-vulnerability — merged
0 ahead (tip `a4cc885` "Fix market picker selection outside initial window").

## codex/propose-fix-for-nft-approval-vulnerability — merged
0 ahead (tip `237608e` "Protect guarded NFTs from deferred approvals").

## codex/propose-fix-for-renewal-ui-vulnerability — merged
0 ahead (tip `afc5d55` "The expiry clock outlives the wildcard claim").

## codex/propose-fix-for-roster-scanning-vulnerability — merged
0 ahead (tip `0522015` "Scan sparse room rosters through token supply").

## codex/propose-fix-for-sealing-client-vulnerability — duplicate wrapper
2 ahead = merge of PR #27 + `7f58e37` (identical to the DeskSeal fix above). Nothing unique.

## codex/propose-fix-for-token-picker-vulnerability — merged
0 ahead (tip `7ef8516` "Ignore stale swap token lookups").

## codex/propose-fix-for-wallet-enabled-xss-vulnerability — merged
0 ahead (tip `cb0767c` "Isolate nested token documents from wallet origin").

## codex/propose-fix-for-xss-vulnerability-in-rpc — merged
0 ahead (tip `42dc541` "Validate attestation digest before rendering").

## codex/restrict-to-ethereum-only — merged
0 ahead (tip `fe990f7` "Make IPSEITY Ethereum-only"). Context for everything above: the base's Nameplate `_bandFirst` now returns a band only for chain 1, with 31337/11155111 holding the whole edition for rehearsal.

## codex/run-complete-testnet-on-sepolia — merged
0 ahead (tip `4ef317b` "Exercise live Sepolia agents and market" = PR #40, the base tip; it added `deployments/eth-sepolia-campaign-2026-09-24.json` and `eth-sepolia-exercise-2026-09-24.json`).

## idfbi-isolated-ci-20260904 — UNMERGED; a hidden second codebase

**2 commits ahead, 53 behind** (venividis, 2026-09-04): "Add an isolated checksum-locked compile payload for IDFBI", "Run the isolated IDFBI Foundry verification payload". Files: `.github/workflows/idfbi-isolated-ci.yml` (+31) and seven `.idfbi-ci/payload.00-06` lines (6×7000 + 2716 base64 chars).

The workflow (`on: push` to this branch only, `permissions: contents: read`) concatenates the payloads, base64-decodes to `/tmp/idfbi.tar.gz`, checks `sha256 3c3be7eaec1cd67ad6fb17b96693ff5b88230bb757517cc7c468c61babf8312b`, extracts, then `forge build --sizes` and `forge test -vvv` with foundry-toolchain. I decoded it in the scratchpad (hash matches). It is **not IPSEITY code at all** — it is a complete, separate Foundry project:

```
foundry.toml   solc 0.8.24, cancun, via_ir, optimizer_runs 1_000_000, src = "contracts"
contracts/ImpossibleNFT.sol                  (26.8 KB) name "i dont fucking believe it!", symbol IDFBI
contracts/accounts/ImpossibleAccount.sol     (24.9 KB) ERC-6551 account + ERC-7579 modular + ERC-4337 validateUserOp
contracts/accounts/ImpossibleAccountRegistry.sol
contracts/agent/AgentKernel.sol              (14.0 KB) ERC-7579 executor module + on-chain agent/tool registry
contracts/crosschain/MultiverseMirror.sol    bridge-agnostic state mirroring via proof adapters, never mints canonical assets
contracts/engine/{AttestationVerifier,HashProofVerifier,ProofRouter}.sol
contracts/modules/{P256PasskeyValidator,SessionKeyExecutor}.sol
contracts/renderer/ImpossibleRenderer.sol    (12.7 KB)
contracts/storage/CapsuleVault.sol           content-addressed immutable bytecode storage, global chunk dedup, EIP-3541-safe 0x00 prefix
contracts/interfaces/{IImpossible,Standards}.sol   IERC165/721/1271/6551/7579(Module,Hook,Validator,Execution,AccountConfig,ModuleConfig)/4337, IProofVerifier, IAccessPredicate, IStateProofAdapter
contracts/lib/{Base64,Owned,SignatureChecker,Strings}.sol, contracts/mocks/*
test/{AgentKernel,ImpossibleAccount,ImpossibleNFT,Infrastructure}.t.sol, test/TestBase.sol, test/helpers/ProtocolFixture.sol
script/{DeployLocal,DeployProduction}.s.sol
```

`ImpossibleNFT` header: "An ERC-721 whose token is simultaneously an on-chain organism, deterministic smart account, proof-driven state machine and autonomous agent. The contract is non-upgradeable; optional surfaces can be permanently frozen." Its `Organism` struct carries `seed, genome, memoryRoot, capabilityRoot, lineageRoot, stateRoot, signal, nameHash, bornAt, lastEvolvedAt, generation, experience, coherence, entropy, agency, vitality, phase, revealed`; mint is commit-reveal (`MIN_REVEAL_DELAY 2`, `MAX_REVEAL_DELAY 200` blocks); `Evolution` applies deltas behind a `ProofRouter` with nullifiers; traits emit ERC-7496 `TraitUpdated*` events. `AgentKernel`: "Agents get explicit capabilities, bounded calls, causal memory receipts, raw reputation signals and validator attestations. No model is trusted by default and no agent can bypass its token-bound account's kernel." (`Tool{target, selector, accessPredicate, maxValue, manifestRoot, inputSchemaHash, outputSchemaHash, enabled, frozen}`, `Agent{operator, operatorOwner, operatorEpoch, modelHash, memoryRoot, capabilityRoot, validationRoot, nonce, tasks, reputationSum, reputationCount, active}`).

**Assessment**: benign (a CI smoke test for a sibling project), but a trap for anyone grepping the repo — the source is invisible to search. For the GOAL it is a **design reference**, not a merge candidate: it overlaps ANIMA (agent kernel, session keys, ERC-6551/7579/4337) and adds pieces neither IPSEITY nor ANIMA has in this form — a passkey (P256) validator module, a content-addressed deduplicating bytecode vault, and a proof-adapter cross-chain state mirror. Extracted copy for the program: `/tmp/claude-0/-home-user/9872dd98-bd4a-5b4c-9579-cffc2e916f05/scratchpad/idfbi/x/`. If it is one of the "four repositories", its canonical source should be taken from that repo, not from this payload.

---

## Recommendations for the merge program

1. **Port the console second tranche** (`claude/claude-md-docs-8vvyc8`): it is the only implementation in any branch of a holder-gated web app with a swap lane, a hand-it-on lane and a cross-chain messaging lane, with 96 Chromium-driven assertions. This is the GOAL's "connect wallet, prove you hold it, then swap/message" surface.
2. **Apply the three unmerged security fixes** before any deployment: DeskSeal per-send key revalidation; `Facet.syncFee(expectedSection)` (and the same on `GateFacet`); the Sepolia NameWrapper address. All are small and self-contained.
3. **Rebase `hciyvv` onto the base's planner**: the authority-follows-the-NFT fix and the PoolKey-from-PositionManager fix are correctness/security improvements over what the base merged in PR #38; `GateFacet` is the launchpad's "schedule + lock + artwork fee" hook.
4. Keep `deploymentBudget` if the unified protocol deploys to an L2.
5. Mine the IDFBI payload for the passkey validator, capsule vault and mirror designs; do not merge the tarball mechanism.
