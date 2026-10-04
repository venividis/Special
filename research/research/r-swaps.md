# Swap and DEX technology for a fully on-chain NFT protocol

Research report for the unified NFT protocol (swap + messaging + launchpad + vault inside one
ERC-721, website served from chain). Topic: swaps and DEX technology. Written 2026-10-02.

Method: 24 web searches, 32 pages fetched. Primary sources (EIP/ERC text, protocol docs, GitHub
source, audit-firm post-mortems, DefiLlama data pages, an arXiv paper) are marked **[P]**; news
and secondary summaries are marked **[S]** and the claim is flagged unverified where no primary
source backed it. Numbers from DefiLlama were read on 2026-10-02 and will drift. I also read the
swap code already in the four local repositories (IPSEITY `Pool.sol`/`Venue.sol`/`Kiln.sol`, ANIMA
`AgentSwapRouter.sol`, MASTER `OfficialV4SwapRouter.sol`/`OfficialV4QuoteLens.sol`, Pixel-Garden
`LiquidityCartridge.sol`/`MarketCartridge.sol`) so the recommendations build on what exists.

---

## 1. The short answer

A swap "inside the NFT" should be **both** an owned pool and a router, in two clearly separated
layers, and it should **not** be an aggregator:

1. **An owned market per token** (the IPSEITY `Pool` design: the holder is the sole LP, the
   curve is anchored, the bond ratchets, the pause can never trap funds). This is the only part
   that is genuinely *inside* the NFT: selling the token sells the market. It is also the only
   swap venue that can be served, quoted and traded entirely from the token's own web page with
   zero external dependency.
2. **A trust-minimised router from the token's ERC-6551 account to a tiny, immutable allowlist
   of external venues** (ANIMA `AgentSwapRouter` + MASTER `OfficialV4SwapRouter` patterns):
   verify output by balance delta, never retain approvals, allowlist venues by *codehash* and
   *PoolKey*, and never route into an unknown Uniswap v4 hook. This is how the vault reaches real
   liquidity (Aerodrome and Uniswap carry ~77% of Base DEX volume between them, §2.7).
3. **No off-chain aggregator and no hook marketplace.** 0x's September 2026 study classified
   54.2% of 84,163 deployed v4 hooks as malicious and 26.4% as likely malicious [P]; Odos, the
   third-largest aggregator brand, shut down all APIs on 2026-07-30 [S, multiple]. An NFT whose
   website is contract bytecode cannot depend on either.

The rest of this report is the evidence, the specs, and the specific things to build.

---

## 2. State of the art

### 2.1 Uniswap v4 — the substrate everything on Base now builds on

**Numbers (DefiLlama, read 2026-10-02) [P]:** Uniswap v4 TVL $867.83M (Ethereum $648.11M,
Base $46.95M, Robinhood Chain $37.11M, BSC $36.1M, Arbitrum $30.43M, Unichain $16.79M). 30-day
DEX volume $21.026B (Ethereum $9.671B, Robinhood Chain $4.796B, BSC $2.534B, Base $967.19M).
Cumulative fees $334.1M, of which Base $91.06M — Base is the second-largest cumulative fee source
for v4 after Ethereum, despite modest current TVL, which says Base v4 pools are high-turnover
(launch tokens). Protocol revenue is $0 on every chain (fee switch off). A secondary source
claims ~$355B cumulative v4 volume and "over 2,500 hook-based pools" by mid-2026 [S, unverified].

**Hook permissions are the address (v4-core `Hooks.sol`) [P].** Fourteen flags occupy the low
14 bits of the hook address:

```
BEFORE_INITIALIZE_FLAG                    = 1 << 13
AFTER_INITIALIZE_FLAG                     = 1 << 12
BEFORE_ADD_LIQUIDITY_FLAG                 = 1 << 11
AFTER_ADD_LIQUIDITY_FLAG                  = 1 << 10
BEFORE_REMOVE_LIQUIDITY_FLAG              = 1 << 9
AFTER_REMOVE_LIQUIDITY_FLAG               = 1 << 8
BEFORE_SWAP_FLAG                          = 1 << 7
AFTER_SWAP_FLAG                           = 1 << 6
BEFORE_DONATE_FLAG                        = 1 << 5
AFTER_DONATE_FLAG                         = 1 << 4
BEFORE_SWAP_RETURNS_DELTA_FLAG            = 1 << 3
AFTER_SWAP_RETURNS_DELTA_FLAG             = 1 << 2
AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG    = 1 << 1
AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG = 1 << 0
ALL_HOOK_MASK = uint160((1 << 14) - 1)
```

`isValidHookAddress` enforces that a returns-delta flag cannot be set without its action flag,
that `address(0)` requires a static fee, and that a non-zero hook must have at least one flag or
a dynamic fee; `validateHookPermissions` reverts at deployment if the declared booleans disagree
with the address bits. **Hooks are immutable per pool**: "The hook is part of the PoolKey and is
set once when the pool is created through PoolManager.initialize. It cannot be added, removed,
or swapped afterward" (Uniswap docs) [P]. The hook *contract* may still be upgradeable or
owner-controlled, which is why the hooklist schema records `upgradeability` separately.

**Address mining.** Because the bits are in the address, a hook is deployed with CREATE2 under
a mined salt; a full 14-bit pattern is ~2^14 attempts. The usual tool is `HookMiner.find` in
v4-periphery [S]. The IPSEITY `Kiln.mine` does this as a `view` function run under `eth_call`
(the visitor's node walks ~60k salts per call and commits nothing) so a serverless page can
deploy a hook without a keccak in the browser. That trick is unusual and worth keeping.

**Custom accounting / custom curves [P].** With `BEFORE_SWAP_FLAG | BEFORE_SWAP_RETURNS_DELTA_FLAG`
a hook returns a `BeforeSwapDelta` that zeroes the specified amount and supplies its own
unspecified amount, "ejecting the native concentrated liquidity pricing mechanism" (Uniswap
custom-accounting guide). OpenZeppelin's `uniswap-hooks` library ships `BaseCustomCurve`,
`BaseCustomAccounting`, `BaseAsyncSwap` (renamed from `BaseNoOp`), `BaseDynamicFee`,
`BaseOverrideFee` and an `AntiSandwichHook`, Foundry-only, explicitly "experimental software"
[P, OZ docs]. EulerSwap is the headline production example: the hook replaces the swap math with
its own bonding curve against Euler vaults [S]. This is the mechanism by which an owned
per-token pool *could* be exposed to v4 routers (§3.3).

**Periphery vocabulary you will need to speak [P].** Universal Router `Commands.sol`:
`V3_SWAP_EXACT_IN=0x00, V3_SWAP_EXACT_OUT=0x01, PERMIT2_TRANSFER_FROM=0x02,
PERMIT2_PERMIT_BATCH=0x03, SWEEP=0x04, TRANSFER=0x05, PAY_PORTION=0x06,
PAY_PORTION_FULL_PRECISION=0x07, V2_SWAP_EXACT_IN=0x08, V2_SWAP_EXACT_OUT=0x09,
PERMIT2_PERMIT=0x0a, WRAP_ETH=0x0b, UNWRAP_WETH=0x0c, PERMIT2_TRANSFER_FROM_BATCH=0x0d,
BALANCE_CHECK_ERC20=0x0e, V4_SWAP=0x10, V3_POSITION_MANAGER_PERMIT=0x11,
V3_POSITION_MANAGER_CALL=0x12, V4_INITIALIZE_POOL=0x13, V4_POSITION_MANAGER_CALL=0x14,
EXECUTE_SUB_PLAN=0x21, ACROSS_V4_DEPOSIT_V3=0x40, FLAG_ALLOW_REVERT=0x80`. Entry point is
`execute(bytes commands, bytes[] inputs, uint256 deadline)`.
v4-periphery `Actions.sol`: `SWAP_EXACT_IN_SINGLE=0x06, SWAP_EXACT_IN=0x07,
SWAP_EXACT_OUT_SINGLE=0x08, SWAP_EXACT_OUT=0x09, DONATE=0x0a, SETTLE=0x0b, SETTLE_ALL=0x0c,
SETTLE_PAIR=0x0d, TAKE=0x0e, TAKE_ALL=0x0f, TAKE_PORTION=0x10, TAKE_PAIR=0x11,
CLOSE_CURRENCY=0x12, CLEAR_OR_TAKE=0x13, SWEEP=0x14, WRAP=0x15, UNWRAP=0x16, MINT_6909=0x17,
BURN_6909=0x18, UNWIND_WITH_FALLBACK=0x19`. Two liquidity actions
(`INCREASE_LIQUIDITY_FROM_DELTAS=0x04`, `MINT_POSITION_FROM_DELTAS=0x05`) are marked deprecated
as "vulnerable to sandwich attacks" in the source — a useful reminder that even Uniswap's own
periphery has shipped sandwichable actions.

The MASTER repo's `OfficialV4SwapRouter` shows the minimal correct shape of a direct
PoolManager integration without the Universal Router: `unlock(payload)` → `unlockCallback` →
`manager.swap(key, SwapParams(zeroForOne, -int256(amountIn), sqrtPriceLimitX96), "")` → check
`inputDelta <= 0`, `outputDelta >= 0`, `spent <= amountIn`, `received >= minimumOut` →
`sync/transferFrom/settle` the input, `take` the output. Its `OfficialV4QuoteLens` runs the real
swap inside `unlock` and reverts with `QuoteResult(spent, received)`, so a quote is literally the
settlement path executed and rolled back. That "quote by executing" pattern is the single most
important defence against the 0x finding (hooks that detect quoting and behave differently) —
see §2.2.

### 2.2 Hook security: what has actually gone wrong

**Cork Protocol, 2025-05-28, ~$11M (Dedaub post-mortem) [P].** Root cause stack: (1) the
hook's `beforeSwap` had no `onlyPoolManager` modifier, so anyone could call it directly;
(2) `beforeInitialize` did no token-type validation, so a DS (insurance) token from one market
could be passed off as the RA (redemption asset) of a new one; (3) no validation of pool id or
hook address, so an attacker-deployed pool with an attacker hook was accepted. The attacker
called the unprotected callback with crafted `hookData` and was credited ~3,761 weETH-DS
without depositing. Lesson: *every* external hook function is `PoolManager`-only, and the hook
must allowlist the exact `PoolKey`s it serves, not just tokens.

**Bunni v2, 2025-09-02, ~$8.4M (BlockSec analysis) [P].** `withdraw()` rounded the idle balance
in the "safe" direction in isolation; `queryLDF()` then computed
`balance0 = rawBalance0 + reserve0 - idleBalance`, so an over-estimated idle balance
under-stated available liquidity. Three swaps drove USDC in the pool to 28 wei; 44 tiny
withdrawals exploited the floor rounding to cut the active balance from 28 wei to 4 wei (an
85.7% reduction for a ~8.9e-7% share burn); two directional swaps then captured the mispriced
liquidity (tick 5,000 → 839,189 and back). Bunni wound down and declared bankruptcy on
2025-10-23 [S]. Lesson: rounding direction must be proven across the *composition* of
operations, and "rounding errors are non-linearly amplified when token balances are severely
imbalanced" — invariants must be fuzzed at dust balances, not just at normal ones.

**The rsETH/Safe incident, 2025-09-15, ~$7.7M [S, attribution contested].** Initially reported
as a "v4 hook exploit"; later transaction-level analysis cited by Digital Coin Journal says the
pool had no custom hook and the exploitable path was a third-party Safe module plus helper
contract. Treat as a Safe-module incident, not a hook incident, unless a primary post-mortem says
otherwise.

**0x, "Uniswap v4 hooks were a mistake", 2026-09-14 [P].** 0x routed 81.92M trades / $42.67B
in 2026 with ~70% touching Uniswap. Their analysis of 84,163 hooks across six chains (static
analysis, dynamic analysis, and observed settled trades; data as of 2026-09-11) classified
19.4% safe, 54.2% malicious, 26.4% likely malicious. The attack is quote spoofing: "some operate
like a dice roll, some inspect the EVM environment to detect quoting", delivering "as much as 50%
less at execution than the amount quoted". Example on Base, hook
`0x800cef53c3fd41109dffec62e5251bdd7acba5c7`, ETH/NVDAc: 6,516 fills, 3,946 charged (60.6%),
fee range 0–18%, median fee when charged 18%, total $143,037. Hayden Adams' reply ("skill
issue" [S]) was that the Uniswap API only integrates reviewed hooks and routing hygiene is the
aggregator's job. Both are right, and both agree on the operative rule: **never route into a
hook you have not vetted, and vet by executing, not by static quoting.**

**Uniswap Foundation Hooks Security Framework (developers.uniswap.org/…/v4/security) [P].**
Nine scored dimensions: Complexity (0–5), Custom Math (0–5), External Dependencies (0–3),
External Liquidity Exposure (0–3), TVL Potential (0–5), Team Maturity (0–3), Upgradeability
(0–3), Autonomous Parameter Updates (0–3), Price-Impacting Behaviour (0–3). Seven feature
triggers override the tier (custom curve, hook holds external liquidity, oracle dependencies,
autonomous parameters, price-impacting behaviour, upgradeability, TVL score 5). Tiers: Low
(0–6) one audit + static analysis; Medium (7–17) adds a recommended bug bounty and monitoring;
High (18–33) "two formal audits including one by a math specialist", mandatory bounty,
stateful fuzzing, mandatory anomaly monitoring (liquidity imbalances, delta anomalies, fee
spikes, curve divergence, revert rates, slippage patterns). Named threats: reentrancy into the
same pool and into other pools sharing the hook, external state drift between callbacks,
liquidity migration between callbacks, flash-accounting transient-state manipulation,
non-standard tokens, rounding cascades. A hook that *is* a custom curve and *holds* the token's
inventory (which is what an owned pool exposed as a hook would be) trips at least three
triggers and lands in High regardless of score.

**Trail of Bits, "Building secure Uniswap v4 hooks", 2026-07-30 [P].** Seven classes:
unrestricted callbacks; untrusted pool acceptance (trusting user-supplied `PoolKey`);
accounting errors; callback timing mismatches (logic in the wrong hook sees stale state);
permission-bit desynchronisation; callback failures that block exits; cross-callback state
mutation. Eight recommendations: gate with `BaseHook`/`SafeCallback` caller checks; allowlist
`PoolKey`s not tokens; label ownership of every balance/delta; segregate LP funds, fees and
incentives; isolate non-essential code from exit paths; verify address bits match declared
permissions; fuzz nested callbacks, fee extremes and malicious tokens (Echidna/Medusa); key
temporary callback state by `PoolId` and caller. Also cited: Sorella Angstrom shipped once
without `afterSwapReturnDelta` and every swap reverted — a permission-bit bug in a flagship
hook.

**Uniswap `hooklist` registry [P].** A JSON registry (address, chain, all 14 permission bits,
dynamic-fee flag, upgradeability, custom-swap-data requirement, project, deployer, audit URL)
populated by a Claude-driven bot that pulls verified source from explorers. The README is
explicit that inclusion "DOES NOT automatically cause your hook to be allowlisted for routing by
Uniswap's routing algorithm". For us the schema is the useful artefact: it is the minimum
metadata an on-chain venue allowlist should carry.

### 2.3 Intents: UniswapX, ERC-7683, CoW, 1inch, 0x Settler

**UniswapX (GitHub README) [P].** "An ERC20 swap settlement protocol that provides swappers
with a gasless experience, MEV protection, and access to arbitrary liquidity sources."
Reactors validate an order, resolve inputs/outputs, pull tokens via Permit2
`permitWitnessTransferFrom` (the signed order is the witness), call the filler
(`execute`, `executeBatch`, `executeWithCallback`, `executeBatchWithCallback` → `reactorCallback`),
and transfer outputs. Reactor types: `LimitOrderReactor`, `DutchOrderReactor`,
`ExclusiveDutchOrderReactor`, V2/V3 Dutch reactors, and **`PriorityOrderReactor` on Base** (the
docs index also lists "Filling on Priority Chains: Base and Unichain" [P]) — the auction is the
priority fee rather than a time decay, which fits a sequencer that orders by priority fee.
Deployed on 20+ networks at CREATE2-consistent addresses. Crucially, a UniswapX order is an
*off-chain* signed message distributed through Uniswap's order feed; there is no on-chain way to
post one that a serverless page could use without talking to Uniswap's API.

**ERC-7683 status [P, eips.ethereum.org + ethereum-magicians].** Status: **Draft**, created
2024-04-11, authors Giordano, Toda, Rice, Pai, Lindgren, Gretzke, Cashwell; **Requires
EIP-7930** (Interoperable Addresses). On 2026-02-06 Francisco Giordano (OpenZeppelin), with
Across, Uniswap and LI.FI, published "ERC-7683 Redux: Programmable Fillers", arguing the
original draft "doesn't deliver" on filler interoperability because of implementation-specific
`orderData`, lower-bound-only profit estimates, and gas overhead. The *current* ERC text is the
redesign: a resolver-based interface —

```solidity
interface IResolver {
    function resolve(bytes calldata payload) external view returns (ResolvedOrder memory);
}
struct ResolvedOrder { bytes[] steps; bytes[] variables; bytes[] payments; Assumption[] assumptions; }
struct Assumption { string name; bytes data; }
```

— with `IStep`, `IVariableRole`, `IPayment`, `IAttribute`, `IFormula` building blocks. The
`GaslessCrossChainOrder` / `OnchainCrossChainOrder` / `ResolvedCrossChainOrder` structs and
`IOriginSettler.open/openFor` / `IDestinationSettler.fill` that Across, UniswapX, Eco and LI.FI
actually implement in production [S] are **the superseded draft**. Any claim that "ERC-7683 is
ratified" [S, eco.com] is wrong: the ERC is a Draft that was rewritten in 2026. Do not build to
either version as a stable ABI; if we want intent compatibility, build to the *resolver* model
(a `view` that explains our order to any filler) because that is where the authors are going and
it costs nothing on our side beyond a view function.

**CoW Protocol [P, docs].** Settlement is permissioned to allow-listed solvers:

```solidity
function settle(IERC20[] calldata tokens, uint256[] calldata clearingPrices,
                GPv2Trade.Data[] calldata trades, GPv2Interaction.Data[][3] calldata interactions)
    external nonReentrant onlySolver;
```

`GPv2Order.Data` = `{sellToken, buyToken, receiver, sellAmount, buyAmount, validTo (uint32),
appData (bytes32), feeAmount, kind, partiallyFillable, sellTokenBalance, buyTokenBalance}`.
Signing schemes: EIP-712, ETH_SIGN, **ERC-1271**, and **PRE_SIGN** via
`setPreSignature(bytes orderUid, bool signed)`; `invalidateOrder(bytes orderUid)` cancels.
`orderUid` is 56 bytes (digest ‖ owner ‖ validTo). The auction is now a "fair combinatorial
batch auction" with Uniform Directed Clearing Prices so order position in the batch cannot be
exploited. CoW launched on Base in December 2024 and reports ~$87B 2025 volume [S, unverified].
The ERC-1271/PRE_SIGN path is the one that matters for us: a token-bound account can authorise
a CoW order purely on-chain (`setPreSignature`) and let solvers find it. The order still has to
be *posted* to CoW's off-chain order book, which the visitor's browser can do, but our contracts
cannot — see Open Questions.

**1inch Limit Order Protocol v4 [P, GitHub].** Part of 1inch Router v6 at
`0x111111125421cA6dc452d289314280a0f8842A65` on 15+ chains; EIP-712 orders with
MakerTraits/TakerTraits, predicates (stop-loss), pre/post interactions, on-chain getters that
implement Dutch auctions and range orders, private orders by taker address, epoch cancellation,
ERC-721/1155 via proxy extensions. Production is tag `4.3.2`; master is unaudited.

**0x Settler [P, GitHub].** Replaces the 0x exchange proxy; **no standing allowances** — users
sign single-use, deadline-bound Permit2 coupons; `AllowanceHolder` is the ERC-2771-style bridge
for users who prefer classic approvals; actions like `UNISWAPV3_VIP` execute Permit2 transfers
inside the DEX callback to avoid custody; integrators discover the current Settler through an
ERC-721-shaped deployer/registry at `0x00000000000004533Fe15556B1E086BB1A72cEae` (same on all
chains); Base supported. 0x powers Coinbase Wallet's in-app swap [S, unverified]. The "no
standing approvals, discover via registry" design is a good model for how our router should be
versioned if it ever needs a successor (it should not need one — see §6).

**Aggregator mortality.** Odos announced wind-down on 2026-07-23, went read-only 2026-07-27,
and ended all API and trading services 2026-07-30, having routed ~$104B lifetime [S, multiple
outlets; odos.xyz home page now titled "Odos Shutdown & Wallet Recovery"]. A protocol that
promises a swap *inside* the NFT cannot have that swap depend on an HTTP quote API.

### 2.4 MEV: what Base actually protects you from

Base has no public mempool in the Ethereum sense and a single sequencer, which is why
"sandwiches are nearly impossible on L2s" is a common claim [S]. The evidence says otherwise.
"No Place to Hide: An Analysis on Protected Order Flow Sandwich Attacks" (Heimbach, Solmaz,
Öz, Ferreira Torres, arXiv 2609.28115, submitted 2026-09-23) [P] is a three-year study across
six chains of attacks on order flow users believed was protected: 28.0M on Solana, 30,607 on
Ethereum (+2,875 in reorged blocks), 38,567 on Tron, **1,889 on Base**, and none persistent on
Arbitrum or Monad. On Base the enablers were "an RPC bug that exposes pending transactions" and
"predictable victim behaviour". Flashbots Protect is Ethereum-mainnet-only [S, Flashbots docs].
Arbitrum's sequencer is FCFS with Timeboost since April 2025 [S]; OP-Stack sequencers order by
priority fee, which is what UniswapX's Priority orders exploit as an auction.

Mitigations that exist as hooks: Sorella's Angstrom (app-specific mempool + two auctions per
block, batch price for all orders, live on mainnet since late July 2025 per Uniswap Foundation
announcement [S]); OpenZeppelin's `AntiSandwichHook` [P, OZ docs]. Both are mainnet/hook-side
and neither is something a serverless NFT site can depend on.

**Implication for us.** On-chain protections are the only ones we control: a mandatory
`minOut`/`maxIn` the trader sets, a `deadline`, a `sqrtPriceLimitX96` where v4 is involved,
exact-value patterns (`buy(agreed)`), and — for the owned pool — the fact that the only party
who can move the curve is the holder, bounded by the bond. "The holder can move the curve"
(IPSEITY Pool header) is the owned pool's version of a sandwich, and `minOut` is its answer.

### 2.5 Per-NFT AMMs: sudoswap v2 and NFTX v3

**sudoswap v2 / lssvm2 [P, GitHub].** Pool types TOKEN/NFT/TRADE; curves `LinearCurve`,
`ExponentialCurve`, `XYKCurve`, `GDACurve`; ERC-2981 royalties by default via a non-upgradeable
fork of Manifold's RoyaltyEngine (also Rarible, Foundation, SuperRare, Zora, ArtBlocks,
KnownOrigin); `IPropertyChecker` to restrict a pool to traits/ids (bitmap or merkle);
opt-in `Settings` contracts (lock durations, upfront fees, 50/50 fee splits); ERC-1155 pairs;
`LSSVMPairFactory` at `0xA020d57aB0448Ef74115c112D18a9C231CC86000`, `VeryFastRouter` at
`0x090C236B62317db226e6ae6CD4c0Fd25b7028b65` with partial fills; AGPL-3.0.
**Numbers (DefiLlama, 2026-10-02) [P]:** TVL $919,603 (Ethereum $918,070; Base $1,183);
30-day volume $15,593; cumulative DEX volume $36,411 (v2 only); cumulative fees $4.83M;
quarterly gross revenue fell from $2.97M (Q1 2023) to $1.93K (Q2 2026).

**NFTX v3 [P, docs].** Its own concentrated-liquidity AMM, "a forked version of Uniswap V3 with
support for proportional vault fees to LPs"; vault fees paid in ETH rather than vTokens;
inventory and liquidity positions are ERC-721s; a "premium" that works "like a Dutch auction
for newly deposited NFTs"; ~3,700 lines audited; TVL ~$2.2M [S, unverified — the DefiLlama
page for nftx-v3 could not be fetched].

**Reading.** Standalone NFT-for-ETH AMMs are, as of 2026, a solved-but-abandoned problem: the
designs are good, the volumes are gone. Two things are still worth taking: sudoswap's
*property checker* (a pool that only accepts tokens meeting an on-chain predicate) and the GDA
curve (gradual Dutch auction), and NFTX's Dutch-auction premium on fresh deposits as an
anti-dump mechanism. Note that the IPSEITY pool-per-token design is a different object: it does
not trade the NFT, it is an ERC-20 market *owned by* the NFT. That is the design that still has
a reason to exist.

### 2.6 Launch-pool designs on Base (relevant to the swap because they *are* v4 pools)

Doppler (Whetstone Research) [P, docs + GitHub]: "an onchain protocol for launching tokens
through various price discovery auctions"; Airlock + modules (token factory, governance
factory, pool initializer, liquidity migrator); a v4-hook Dutch auction (epochs, gamma, ticks),
a v3 static auction, and a "Multicurve" initializer; migration to Uniswap v2 or v4; BUSL-1.1;
deployed on Ethereum, Base, Arbitrum, Monad, Robinhood Chain. Secondary sources say it hosts
>90% of Base token launches [S, unverified]. Zora's `ZoraV4CoinHook` [P, docs] initialises
multiple Doppler-curve positions, applies a sniper tax that decays linearly from 99% to the base
fee over the first 10 seconds, then 1% (creator/content coins) or 0.01% (trend coins), and in
`afterSwap` collects fees from every position, converts them through multi-hop paths and
distributes them (with 20% LP remint). Clanker launches the full supply into a single-sided v4
pool with a creator-set 1–3% fee and a fixed 20% of LP fees to Clanker [S, unverified]. The
Uniswap docs index now also lists a "Liquidity Launchpad" built on a "Continuous Clearing
Auction (CCA)" with strategy contracts and token factories [P, index only — not read]; the
launchpad researcher should read it. The MASTER repo already vendors Doppler and notes its own
auction "is not Uniswap CCA v2".

Pattern worth copying regardless of launchpad choice: **the time-decaying sniper tax** is a
pure hook-side fee that needs no oracle and no server.

### 2.7 Base vs Ethereum DEX landscape

DefiLlama Base DEX page, read 2026-10-02 [P]: 24h volume $1.358B, 30d $28.768B, weekly change
+8.91%. 30-day by venue: Aerodrome $14.037B (48.8%), Uniswap $8.153B (28.3%), PancakeSwap
$3.188B, Metric $1.302B, Tessera $1.001B, Hanji $414M, ElfomoFi $301M; Curve $20M, Balancer
$25M, Sushi $16M. Aerodrome's often-quoted "over 60%" share [S] is not what the data showed on
this day; ~49% is. Uniswap v4 specifically did $967M on Base in 30 days versus $9.671B on
Ethereum — so on Base, v3-era liquidity and Aerodrome still dominate, and a Base-first router
that only knew v4 would miss most of the depth. Fifteen-plus chains run v4 now including Base,
Unichain, Monad and Robinhood Chain [S], but Base's own v4 TVL is $46.95M [P].

Design consequence: an **immutable** router allowlist on Base should at launch contain exactly
the Uniswap v3 factory/pools and v4 PoolManager (no hook, or vetted-by-codehash hooks only) and,
optionally, Aerodrome's router/pools. Anything else is a second-order venue.

### 2.8 Approvals: Permit2, EIP-7702, ERC-1271

Permit2 [P, GitHub] is two contracts in one: `AllowanceTransfer` (standing, deadline-bound
allowances: `permit(PermitSingle)`, `transferFrom(from,to,amount,token)`) and
`SignatureTransfer` (one-shot: `permitTransferFrom(PermitTransferFrom, SignatureTransferDetails,
owner, signature)` and `permitWitnessTransferFrom(..., witness, witnessTypeString, signature)`),
with "unordered, non-monotonic nonces" and EIP-1271 support. Canonical address
`0x000000000022D473030F116dDEE9F6B43aC78BA3` (verified by the explorer label on Arbiscan [P];
the same address is used on every chain Uniswap deploys to). UniswapX, CoW, 1inch Fusion and
0x Settler all use the `SignatureTransfer` half [S]. EIP-7702 went live with Pectra on
2025-05-07 [S, widely reported; not fetched from primary], and the Uniswap docs index shows a
"Uniswap smart wallet" built on 7702 delegation with ERC-7739 defensive rehashing and ERC-7914
ETH allowances [P, index only]. A delegated EOA validates via ERC-1271, so anything that
supports contract signers (Permit2, CoW, UniswapX) already works for it.

For our token-bound account this means: the account should implement ERC-1271 **for the
holder's key only** (the ANIMA rule "session keys may never sign ERC-1271" is correct and must
survive the merge), and the site's swap page should prefer Permit2 `SignatureTransfer` so a
visitor never leaves a standing approval to our contracts.

### 2.9 ERC-6551 (the account that does the swapping)

EIP-6551 [P]: registry at `0x000000006551c19487814612e58FE06813775758`;
`createAccount(implementation, salt, chainId, tokenContract, tokenId)` and `account(...)`;
`IERC6551Account.token()`, `state()`, `isValidSigner(signer, context) returns (bytes4)`;
`IERC6551Executable.execute(to, value, data, operation) payable returns (bytes)`. Security
section: ownership cycles (the token transferred into its own account) render assets
inaccessible, and marketplaces should bind orders to account `state()` so a seller cannot
drain the account between listing and sale. The second point is exactly the IPSEITY "bond"
problem restated for the whole vault, and `state()` is the hook for solving it at the market
layer.

### 2.10 What the four repositories already have

- **IPSEITY `Pool`** (31,989 B): one market per token; holder is sole LP; curve derived from
  the artwork's orientation but **anchored** (copied on `openMarket/deposit/withdraw/syncCurve`,
  never read live during a swap — a renter could otherwise reshape a curve holding someone
  else's inventory); `swap(id, baseIn, amountIn, minOut, to, deadline)` pulls and *measures*
  (`_pull` returns what arrived); bond ratchet (`bond(id, until)` never shortens, survives
  sale); admin pause can halt trading and deposits but "may NEVER halt withdrawal"; `MAX_DEPOSIT`
  cap because unaudited; no LP shares, no oracle, no TWAP, no flash loans, by design.
- **IPSEITY `Venue`**: read-only Uniswap v3 reads (`getPool`, `slot0`, `liquidity`, `observe`);
  shows the owned market *beside* the deepest external venue and says which is better; "has no
  function that moves anything"; all seven addresses are constructor arguments and every page
  prints them.
- **IPSEITY `Kiln`/`Facet`**: fixed-supply ownerless `Coin`; `mine()` hook-salt search as a
  view; pool creation and liquidity go straight from the visitor's wallet to Uniswap.
- **ANIMA `AgentSwapRouter`**: callable only by the agent's 6551 account; `SwapRequest{agentId,
  tokenIn, tokenOut, amountIn, minOut, deadline, venue, venueCalldata}`; venue allowlist;
  per-token `perSwap`/`daily` budgets ("token budgets have to be denominated in the token");
  output verified by balance delta; approval set to exactly `amountIn` and zeroed in the same tx;
  `ReentrancyGuardTransient`.
- **MASTER `OfficialV4SwapRouter` / `OfficialV4QuoteLens`**: direct `PoolManager.unlock`
  exact-input swap with `sqrtPriceLimitX96`, no owner, no retained approvals; quote-by-revert.
- **Pixel-Garden `LiquidityCartridge` / `MarketCartridge`**: v4 position seeding and v2/v3/v4
  exact-input swaps executed *from inside the NFT runtime*, "permissionless hook selection; no
  arbitrary commands, LP transfers, upgrade or rescue authority"; a `SwapLockAdversary` test
  fixture exists.

The pieces of a correct answer are all present; what is missing is one design that puts them
in layers and one set of invariants.

---

## 3. What a swap inside an NFT should be

### 3.1 The three candidate shapes

| Shape | What the holder gets | What can break it | Serverless? |
|---|---|---|---|
| **Owned pool** (IPSEITY Pool) | A market that is literally part of the token; fee income; price curve tied to the art; sells with the token | Thin liquidity (one LP); holder can move the curve; needs bond to be trustworthy | Yes — quote, trade, manage all via `eth_call`/`eth_sendTransaction` to our contracts |
| **Router to external liquidity** (ANIMA/MASTER) | Real depth (Aerodrome/Uniswap ≈ 77% of Base volume); vault can rebalance | Venue upgrades, malicious hooks, dangling approvals, dead aggregator APIs | Yes if venues are immutable on-chain contracts and quotes are `eth_call`s of the real path; **no** if it needs an HTTP aggregator |
| **Aggregator client** (1inch/0x/Odos API) | Best price today | The API (Odos died 2026-07-30); the aggregator's hook curation (0x: 54.2% malicious); CORS/keys in a page that is bytecode | No |

### 3.2 Recommendation: owned pool + immutable router, no aggregator

Build **both** of the first two, keep them in separate contracts with separate pages (the Venue
header's argument — "they are separate pages precisely so the two are never confused" — is
right), and let the token's own page be the only "aggregator" by comparing the two quotes
on-chain:

- `quote(id, baseIn, amountIn)` on the owned pool (pure view), and
- a `QuoteLens`-style revert-quote against the allowlisted external pool,

then rendering both and letting the trader choose. This is the Venue design upgraded from
"compare against v3 slot0" to "compare against the executed path", which is the only quote the
0x study says you can trust.

### 3.3 Should the owned pool also be a Uniswap v4 hook?

Tempting: wrap the per-token curve in a `BaseCustomCurve` hook so external routers can fill
against the token's inventory and the token earns flow it would never see on its own page.
Against it:

1. It puts the token's inventory inside the PoolManager's flash-accounting envelope and makes
   our hook a High-tier object under the Foundation framework (custom math + holds liquidity +
   price-impacting), i.e. "two formal audits including one by a math specialist" before it
   should hold anyone's money.
2. Aggregators are actively de-listing hooks; 0x routes only to vetted ones and the hooklist
   says inclusion ≠ routing. The flow benefit is speculative.
3. The IPSEITY pool has deliberately no oracle, no TWAP, no flash loans. A v4 pool exposes
   `sqrtPriceX96` and `donate` to everyone; the curve's "holder can move it" property, benign on
   the token's own page with `minOut`, becomes a quote-spoofing hook from a router's point of
   view — exactly the malicious pattern 0x describes, even if we are honest.

Verdict: **not in v1.** Keep the owned pool a standalone contract. Record the hook adapter as a
later, separately-audited, opt-in module that the *holder* enables per token (and that the bond
freezes), and design the pool's interface so a future hook can call `quote`/`swap` without
changes.

### 3.4 Exact-output, slippage and deadline

- Offer both `swap` (exact-in, `minOut`) and `swapExactOut` (exact-out, `maxIn`) on the owned
  pool. Exact-out is what a vault needs for "pay exactly X of token B", and the Universal Router
  and v4 `SWAP_EXACT_OUT*` actions exist because users ask for it; the IPSEITY pool is
  exact-in only today.
- `deadline` is a `block.timestamp` check on every state-changing swap (the pool already does
  `before(deadline)`); the router must *also* check it even when the venue would, because a
  venue that drops its own check (Universal Router has one; raw `PoolManager.swap` does not)
  must not weaken ours.
- For v4 venues always pass a real `sqrtPriceLimitX96`, never the min/max tick sentinel; it is a
  second slippage bound that stops a route after the price moves even when `minOut` would have
  been met by a partial fill (MASTER's router rejects `spent > amountIn` for that reason).
- Verify by **balance delta** at the recipient, never by return value (ANIMA router), and
  measure what arrived on input (`_pull`) so fee-on-transfer tokens cannot mint phantom credit
  (the Foundation framework lists non-standard tokens as a named threat).
- Front-running of *terms* (not price): keep the exact-value pattern — `buy(agreed)`, rent's
  `msg.value` equality, `setFee` blocked under bond — so a holder cannot raise a fee between a
  visitor's quote and their transaction.

---

## 4. Concrete specs for our protocol

### 4.1 Owned market (evolve IPSEITY `Pool`)

```solidity
interface IOwnedMarket {
    // lifecycle (holder only; refused while bonded except deposit/bond-extend)
    function openMarket(uint256 id, address base, address quote, uint16 feeBps) external;
    function deposit(uint256 id, uint256 amountBase, uint256 amountQuote) external;
    function withdraw(uint256 id, uint256 amountBase, uint256 amountQuote, address to) external;
    function closeMarket(uint256 id) external;
    function setFee(uint256 id, uint16 feeBps) external;
    function syncCurve(uint256 id) external;                 // copy the art's section word
    function bond(uint256 id, uint64 until) external;        // ratchet: never shortens, survives sale

    // trading (anyone)
    function quote(uint256 id, bool baseIn, uint256 amountIn) external view returns (uint256 out);
    function quoteExactOut(uint256 id, bool baseIn, uint256 amountOut) external view returns (uint256 inNeeded);
    function swap(uint256 id, bool baseIn, uint256 amountIn, uint256 minOut, address to, uint256 deadline)
        external returns (uint256 out);
    function swapExactOut(uint256 id, bool baseIn, uint256 amountOut, uint256 maxIn, address to, uint256 deadline)
        external returns (uint256 spent);

    // reads for the page
    function market(uint256 id) external view returns (MarketView memory);
    function bondedUntil(uint256 id) external view returns (uint64);
    function pendingCurve(uint256 id) external view returns (bool drifted, uint256 artWord, uint256 marketWord);
}
```

Invariants to carry over verbatim: curve anchored, never recomputed in `swap`; rounding favours
the pool in *both* directions and is fuzzed at dust balances (Bunni); withdrawal can never be
paused; bond ratchets; `MAX_DEPOSIT` until audited; no oracle surface (no TWAP, no `observe`).
New: `swapExactOut` rounds `inNeeded` up; `quoteExactOut` and `swapExactOut` share one pure
function so the page's quote is the settlement maths.

### 4.2 Vault router (evolve ANIMA `AgentSwapRouter` + MASTER `OfficialV4SwapRouter`)

```solidity
struct Venue { address target; bytes32 codehash; bytes4[] selectors; }   // immutable set, constructor-only
struct SwapRequest {
    uint256 tokenId; address tokenIn; address tokenOut;
    uint256 amountIn; uint256 minOut; uint256 deadline;
    uint8 venueIndex; bytes venueCalldata;                                 // calldata is validated per venue kind
}
interface IVaultRouter {
    function swap(SwapRequest calldata r) external returns (uint256 amountOut); // only the token's 6551 account
    function setLimit(uint256 tokenId, address token, uint128 perSwap, uint128 daily) external; // holder only
    function venues() external view returns (Venue[] memory);
}
```

Rules: (1) caller must be `registry.account(impl, salt, chainid, token, id)` for `tokenId` and
the token must not be paused/locked; (2) `extcodehash(venue.target) == venue.codehash` at call
time (defends against proxy venues being upgraded under us; if a venue upgrades, the route dies
rather than drains); (3) for a v4 venue the router *is* the unlock callback — it never hands
the PoolManager to arbitrary calldata; the `PoolKey.hooks` must be `address(0)` or in a
constructor-pinned codehash set; (4) approvals: exact `amountIn` then zero in the same tx, or
Permit2 `SignatureTransfer` when the venue supports it; (5) balance-delta verification at the
recipient; (6) per-token-denominated `perSwap`/`daily` budgets; (7) `nonReentrant` via
transient storage; (8) no owner. If venues must change, deploy a new router and let each
holder opt their token into it (ANIMA's "selling the agent revokes authority" epoch roll must
also clear router opt-ins).

### 4.3 Quote lens (MASTER pattern, generalised)

```solidity
contract QuoteLens {  // stateless; run under eth_call
    error QuoteResult(uint256 spent, uint256 received, uint160 sqrtPriceAfter);
    function quoteV4(PoolKey calldata key, bool zeroForOne, int256 amountSpecified, uint160 limit) external returns (uint256, uint256, uint160);
    function quoteOwned(uint256 id, bool baseIn, uint256 amountIn) external view returns (uint256);
}
```

The page shows both numbers, the executed-path number *is* the quote, and hook behaviour that
differs between quote and settlement is caught because the quote is a settlement.

### 4.4 Hook salt mining as a view (keep IPSEITY `Kiln.mine`)

`function mine(bytes32 initCodeHash, uint160 flags, uint256 from, uint256 count) external view
returns (bytes32 salt, bool found, uint256 tried)` with the CREATE2 deployer address as an
immutable. Keep it; it is the reason a hook can be deployed from a page with no keccak in the
browser.

### 4.5 Account signing surface

`IpseityAccount`/`AgentAccount` implements `isValidSignature` (ERC-1271) **only** for the
holder's key, never for session keys; exposes `state()` (EIP-6551) so an off-chain or on-chain
market can pin an order to the vault's state; may expose `setPreSignature`-style helpers so a
holder can authorise a CoW order from the account without a private key for it.

---

## 5. Security lessons, consolidated

1. Every hook callback is `PoolManager`-only, and the hook allowlists `PoolKey`s, not tokens
   (Cork).
2. Rounding direction is a property of the *composition* of operations; fuzz at dust balances
   and after price manipulation, not only at healthy states (Bunni).
3. Quote by executing. Static quotes are the attack surface (0x, 84,163 hooks).
4. Never route into an unvetted hook; pin by codehash, not address; treat `upgradeability` as a
   first-class field (hooklist schema).
5. Verify by balance delta at the recipient; measure input on arrival (ANIMA, IPSEITY).
6. No standing approvals: exact approve-then-zero or Permit2 `SignatureTransfer` (0x Settler,
   UniswapX).
7. `minOut`/`maxIn` + `deadline` + `sqrtPriceLimitX96` on every path, enforced by *our* contract
   regardless of the venue's own checks; two v4-periphery actions were deprecated for lacking
   this.
8. Private RPC is not sandwich protection on Base (1,889 protected-flow attacks; RPC pending-tx
   leak). Design as if the mempool were public.
9. Never derive the curve live in a swap; the renter/holder authority split demands an anchored
   copy (IPSEITY, fuzz-caught).
10. Pause may stop trading, never withdrawal; no admin path that moves funds (IPSEITY).
11. Bonds ratchet and survive sale; orders bind to account `state()` (IPSEITY bond, EIP-6551).
12. Standards drift: ERC-7683's ABI was replaced in 2026 while still Draft. Build to views and
    data, not to a draft's function selectors.
13. Aggregators die (Odos, 2026-07-30). Anything a visitor must be able to do from a page that
    is bytecode must be an `eth_call`/`eth_sendTransaction` to an immutable contract.
14. Session keys never sign ERC-1271; token budgets are denominated in the token, not in native
    value (ANIMA).

---

## 6. Recommendations

**MUST**
- Ship the owned pool (IPSEITY `Pool` lineage) as the swap that is "inside" the token, with
  `swapExactOut` added and all existing invariants kept. Rationale: it is the only venue that
  is serverless, sells with the token, and earns the holder fees. (Pool.sol header; §3.)
- Ship an ownerless vault router with a constructor-pinned venue set (Uniswap v3 pools, v4
  PoolManager with `hooks == address(0)` only, optionally Aerodrome), codehash checks, balance
  delta verification, exact-approve-then-zero, per-token budgets, and 6551-account-only access.
  Rationale: Aerodrome + Uniswap ≈ 77% of Base volume (DefiLlama 2026-10-02); ANIMA router's
  properties; 0x Settler's no-allowance model.
- Quote by execution (`QuoteLens` revert pattern) on every external route; show the owned-pool
  quote beside it. Rationale: 0x 2026-09-14 report.
- Keep `minOut`/`maxIn`, `deadline`, `sqrtPriceLimitX96` mandatory at our layer. Rationale:
  v4-periphery deprecations; arXiv 2609.28115 (Base is sandwichable).
- Fuzz pool rounding at dust balances and under price manipulation; make "rounding favours the
  pool" an INVARIANTS.md entry enforced by a named test. Rationale: Bunni.

**SHOULD**
- Prefer Permit2 `SignatureTransfer` on the site's swap page for visitor-side approvals, with
  plain `approve` as a fallback; never ask a visitor for an unlimited allowance to our contracts.
- Implement ERC-1271 on the account for the holder key only; expose `state()`; allow the holder
  to `setPreSignature` a CoW order from the account (gasless, batch-priced exits for the vault)
  while making clear the order must be posted to CoW's off-chain book by the visitor's browser.
- Add a time-decaying sniper fee (Zora pattern: linear from a high initial fee to the base fee
  over the first N seconds after `openMarket`/`deposit`) as a holder-settable option on the
  owned pool. No oracle required.
- Record an on-chain venue manifest in the hooklist shape (address, codehash, permission bits,
  upgradeable?, audit URL) so the page can print it and a visitor can verify.
- Design the owned pool's `quote`/`swap` so a future `BaseCustomCurve` adapter could expose it to
  v4 without changing the pool.

**COULD**
- Expose a `resolve(bytes payload) view returns (ResolvedOrder)` on the owned market describing
  a pending holder order in the ERC-7683-redux vocabulary, so programmable fillers can discover
  it once that model ships (zero risk: it is a view).
- Offer sudoswap-style GDA pricing or an `IPropertyChecker` predicate for owned pools that trade
  ERC-1155/721 inventory.
- Use UniswapX Priority orders on Base from the visitor's wallet (not from our contracts) as a
  "best effort" MEV-protected path for ordinary assets, labelled as depending on Uniswap's API.

**AVOID**
- Any HTTP aggregator dependency in a page that is bytecode (Odos precedent).
- Routing into v4 pools with non-zero hooks unless the hook's codehash is constructor-pinned and
  it has been audited to the Foundation's High tier.
- Making the owned pool a v4 hook in v1 (§3.3).
- Live-reading the artwork's orientation inside `swap` (renter exploit).
- Adding an oracle/TWAP surface to the owned pool; its curve is holder-movable by design and
  "has no business being read as a price feed by anything else".
- Building to ERC-7683's superseded `IOriginSettler`/`IDestinationSettler` selectors.
- An owner or `diamondCut` over the router's venue table (ANIMA's immutability rule applies).

---

## 7. Special ideas

1. **"Quote is a settlement."** Make the page's every external quote an `eth_call` that executes
   the real path and reverts with the result. Advertise it: the NFT's swap literally cannot show
   you a price it could not have settled at that block. No aggregator can honestly say this
   after the 0x report.
2. **The curve is the artwork, and the bond is a promise the art keeps.** Keep the orientation-
   derived curve, keep `syncCurve` holder-gated, and surface `bondedUntil` on the token's
   metadata so marketplaces display "market frozen until <date>" as a trait. (Pool.sol; EIP-6551
   state-binding advice.)
3. **The NFT can place an intent.** With ERC-1271 for the holder key and a `setPreSignature`
   helper, the token's vault can exit a position through CoW's batch auction at a uniform
   clearing price — an NFT whose treasury trades MEV-protected, gaslessly, without handing a
   key to anyone.
4. **Hook deployment from a serverless page.** Keep `Kiln.mine` as a view; add a page that walks
   salt windows and shows the resulting permission bits decoded (`address & ALL_HOOK_MASK`) so a
   holder can launch a token with a *reviewed* hook (sniper-tax only) from the token's own site.
5. **Per-token venue manifest.** Each token's site prints the router's immutable venue table with
   codehashes and permission bits in the hooklist schema; a buyer can diff it against Uniswap's
   published deployments without trusting us.
6. **Sniper tax on the owned pool.** The Zora decay (99% → base fee over 10 s) adapted to
   `openMarket`/`deposit`: the holder's fresh inventory cannot be sniped by a bot the second a
   market opens, with no oracle and no server.
7. **Resolver view for programmable fillers.** A `resolve(bytes)` that explains a holder's resting
   order in ERC-7683-redux terms costs nothing and positions the token to be filled by any
   future OIF filler.
8. **Property-checked inventory pools.** Borrow sudoswap's `IPropertyChecker` so a token's market
   can accept only ids/traits the holder specifies — a curated shop inside the NFT.

---

## 8. Open questions

1. **Posting intents.** CoW/UniswapX orders need an off-chain order book. A visitor's browser can
   POST to CoW's API, but that is a client-side dependency on a third party we do not control.
   Is "the page may talk to CoW's API, our contracts never do" within the project's "no server"
   rule, or is it out?
2. **Aerodrome in the venue set.** Aerodrome is ~49% of Base volume today, but its router and
   pools were not examined in this pass (upgradeability, codehash stability, Slipstream
   interface). Needs a primary read before it is pinned in an immutable allowlist.
3. **Which v3/v4 addresses on Base are immutable?** `PoolManager` and v3 pools are non-upgradeable;
   the Universal Router and PositionManager have had multiple versions. The router should talk to
   `PoolManager`/pools directly (MASTER pattern) — confirm there is no case where we need the
   Universal Router.
4. **Hook adapter later?** If the owned pool is ever exposed as a v4 custom-curve hook, who pays
   for the two audits the Foundation tier demands, and does the bond freeze the adapter?
5. **Exact-out on a holder-movable curve.** `swapExactOut` with `maxIn` is sound, but the
   interaction between exact-out quoting and `syncCurve` mid-block needs a fuzz target.
6. **Multi-chain bands.** Satellites (Pool, router) do not exist on every chain; `ConsoleRead`'s
   try/catch + `extcodesize` degradation must extend to the swap pages. Which chains get a
   router at all?
7. **NFTX v3 numbers and Angstrom/CoW/Odos dates** are from secondary sources; a final doc
   should re-measure or cite primary pages.
8. **The rsETH/Safe attribution** is contested in secondary reporting; do not cite it as a hook
   exploit without a primary post-mortem.

---

## 9. Sources (date read 2026-10-02; publication date where known)

Primary [P]:
- ERC-7683 current text — https://eips.ethereum.org/EIPS/eip-7683 (Draft; created 2024-04-11; requires EIP-7930)
- ERC-7683 Redux: Programmable Fillers — https://ethereum-magicians.org/t/erc-7683-redux-programmable-fillers/27674 (2026-02-06)
- Uniswap v4-core Hooks.sol — https://github.com/Uniswap/v4-core/blob/main/src/libraries/Hooks.sol
- Uniswap v4 hooks concept — https://developers.uniswap.org/docs/protocols/v4/concepts/hooks
- Uniswap v4 custom accounting guide — https://developers.uniswap.org/contracts/v4/guides/custom-accounting
- Uniswap Hooks Security Framework — https://developers.uniswap.org/docs/protocols/v4/security
- Uniswap hooklist — https://github.com/Uniswap/hooklist
- Universal Router Commands.sol — https://github.com/Uniswap/universal-router/blob/main/contracts/libraries/Commands.sol
- v4-periphery Actions.sol — https://github.com/Uniswap/v4-periphery/blob/main/src/libraries/Actions.sol
- Permit2 — https://github.com/Uniswap/permit2 ; address label https://arbiscan.io/address/0x000000000022d473030f116ddee9f6b43ac78ba3
- UniswapX — https://github.com/Uniswap/UniswapX
- OpenZeppelin uniswap-hooks — https://docs.openzeppelin.com/uniswap-hooks
- Trail of Bits, Building secure Uniswap v4 hooks — https://blog.trailofbits.com/2026/07/30/building-secure-uniswap-v4-hooks/ (2026-07-30)
- Dedaub, Cork Protocol hack — https://dedaub.com/blog/the-11m-cork-protocol-hack-a-critical-lesson-in-uniswap-v4-hook-security/ (incident 2025-05-28)
- BlockSec, Bunni incident — https://blocksec.com/blog/bunni-incident-repeated-small-withdrawals-compound-a-rounding-error-into-an-8.4m-drain (incident 2025-09-02)
- 0x, Uniswap v4 hooks were a mistake — https://0x.org/post/uniswap-v4-hooks-were-a-mistake (2026-09-14)
- CoW Protocol batch auctions — https://docs.cow.fi/cow-protocol/concepts/introduction/batch-auctions
- CoW GPv2Settlement reference — https://docs.cow.fi/cow-protocol/reference/contracts/core/settlement
- 1inch Limit Order Protocol — https://github.com/1inch/limit-order-protocol
- 0x Settler — https://github.com/0xProject/0x-settler
- sudoswap lssvm2 — https://github.com/sudoswap/lssvm2
- NFTX v3 docs — https://docs.nftx.io/
- Doppler docs — https://docs.doppler.lol/ ; source https://github.com/whetstoneresearch/doppler
- Zora V4 coin hook — https://docs.zora.co/coins/contracts/hook
- DefiLlama Base DEXs — https://defillama.com/dexs/chain/base ; Uniswap v4 — https://defillama.com/protocol/uniswap-v4 ; sudoswap — https://defillama.com/protocol/sudoswap
- Heimbach et al., No Place to Hide — https://arxiv.org/abs/2609.28115 (2026-09-23)
- EIP-6551 — https://eips.ethereum.org/EIPS/eip-6551

Secondary [S]:
- Crypto Briefing on the 0x report and Adams' reply — https://cryptobriefing.com/0x-criticizes-uniswap-v4-hooks-malicious/ (2026-09-15)
- Digital Coin Journal (rsETH attribution, UF framework) — https://digitalcoinjournal.com/uniswap-v4-hooks-face-security-scrutiny/ (2026-09-16)
- Halborn, Bunni explained — https://www.halborn.com/blog/post/explained-the-bunni-hack-september-2025
- Odos shutdown — https://cryptobriefing.com/odos-wind-down-operations-shutdown/ ; https://crypto.news/odos-shuts-down-july-30-as-defi-aggregator-ends-all-services/ ; https://odos.xyz/
- Angstrom live — https://www.chaincatcher.com/en/article/2193421
- CoW on Base / 2025 volume — https://coinmarketcap.com/cmc-ai/cow-protocol/latest-updates/
- Doppler share of Base launches — https://yellow.com/news/doppler-which-hosts-90-of-base-token-launches-moves-into-solana-with-a-native-rebuild
- Clanker fees — https://pool.fans/clank
- Uniswap v4 cumulative volume — https://www.datawallet.com/crypto/uniswap-v4-explained
- Flashbots Protect scope — https://docs.flashbots.net/flashbots-protect/overview
- EIP-7702 activation — https://eco.com/support/en/articles/14796249-eip-7702-explained-account-abstraction-for-eoas
- NFTX v3 TVL — https://markaicode.com/nft-yield-farming-fractional-ownership-strategies/
