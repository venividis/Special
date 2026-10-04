# Token launchpads 2025–2026: what to put inside an NFT so its holder can launch tokens

Research memo for the unified on-chain NFT protocol (swap + messaging + launchpad + vault, served from chain, no server, no IPFS). Written 2026-10-02. Forty web searches; thirty-six pages read, of which the load-bearing ones are primary (protocol docs, repository source and READMEs, whitepapers, audit pages, post-mortems). Where a number comes only from news or an aggregator it is marked **(secondary)**; where it could not be checked at all it is marked **unverified**. No EIP numbers, addresses or dates below are invented: every address is copied from a protocol's own deployed-contracts page or README.

The four local repositories were also read for what already exists: IPSEITY's `Kiln.sol` / `Facet.sol` (on-chain CREATE2 hook-address mining, fixed-supply `Coin`, a dynamic-fee hook that refuses `beforeSwapReturnDelta`), ANIMA's `AgentLaunchpad.sol` / `AgentToken.sol` / `ILiquidityDeployer.sol` (bonding curve with fair window, decaying snipe tax, LP recipient fixed at creation, ERC-7641-style redemption floor), MASTER-NFT-PROJECT's `integrations/official-launch` (Uniswap CCA v2.1.0 and Doppler vendored and hash-pinned, with lifecycle tests on Anvil), and Pixel-Garden's `LaunchpadCartridge` / `LaunchToken` / Locks / VestingSales (NFT-signed token and hook creation, beneficiary-authorised vesting sales). The recommendations at the end are written against that inventory.

---

## 1. State of the art in one page

Between mid-2024 and today the launchpad market settled into four mechanism families, and the leaders of each are now well documented:

| Family | Leading examples | Price discovery | Where liquidity ends up |
|---|---|---|---|
| Constant-product bonding curve → "graduation" | pump.fun (Solana), Virtuals (Base), ANIMA `AgentLaunchpad` | virtual-reserve AMM, closes at a target raise | migrated atomically into an AMM pool, LP locked or protocol-owned |
| Single-sided Uniswap v4 position at launch, hooks do the rest | Clanker, Zora Coins, Bankr Launcher, Flaunch | the pool *is* the curve (multi-position ranges) | never leaves the pool; fees collected by a locker on every swap |
| Dutch-auction dynamic bonding curve (v4 hook) | Doppler (Whetstone) — under Zora, Base App, Bankr, Paragraph | descending tick schedule that ramps back up on demand | migrated by an Airlock module to v2/v3/v4, slice time-locked |
| Continuous clearing auction | Uniswap CCA + Liquidity Launcher (Aztec was first) | uniform clearing price recomputed every block over a release schedule | v4 pool seeded at the final clearing price |

Three things changed decisively in 2025:

1. **Creator fee streams became the product.** pump.fun turned on creator fees on 13 May 2025 and then rebuilt them as a market-cap-tiered schedule; Zora pays creators 50% of every swap fee; Clanker pays creators 80% of LP fees by default; Flaunch tokenises the stream as an NFT; Bankr pays 95% of the 0.7% pool fee to the creator. The launch is no longer the business; the perpetual fee stream is.
2. **Anti-sniping moved on-chain and into hooks.** Decaying launch fees (Zora: 99%→1% over 10 s; Clanker: up to 80% decaying over ≤2 min; Virtuals: 99%→1% over up to 98 min), block delays, sniper auctions, fixed-price windows (Flaunch, 30 min) and continuous clearing (CCA) all exist as deployed code.
3. **Liquidity locking stopped being optional.** Every serious platform now locks or permanently custodies the LP position by construction (Clanker lockers, Virtuals 10-year LP lock, Uniswap `FeeSplitter` "irrecoverable by design", Doppler migrators with a locked slice, Flaunch positions owned by its PositionManager).

The incidents of the period (Section 6) are almost all about the seams: migration transactions that could be front-run by pre-creating the destination pair, hooks callable by anyone, lockers with re-entrancy, insiders with admin keys, and bots given launch authority with no scope.

---

## 2. The leading projects in detail

### 2.1 pump.fun and PumpSwap (Solana)

**Mechanism (primary: pump.fun/docs/bonding-curve, /docs/fees).** Every coin starts on a constant-product curve over two *virtual* reserves (SOL and the coin). "Once a coin's market cap on the bonding curve hits the graduation threshold, the curve is closed and the entire liquidity pool is migrated atomically to PumpSwap… Graduation is automatic and irreversible. There's no human step." After migration "the pool is owned by the protocol"; pump.fun neither seeds nor removes liquidity afterwards. The commonly quoted parameters (≈30 SOL virtual SOL, ≈793M of 1B tokens sellable on the curve, ≈85 SOL raised at graduation, ≈$69k graduation market cap) are reproduced across many secondary sources but are **not on the official docs page**, so treat them as unverified-from-primary.

**Fees (primary).** Creating a coin costs 0; graduation to PumpSwap costs 0.015 SOL. On the curve the total fee is **1.25%**: 0.30% creator, 0.95% protocol, 0% LP. On PumpSwap *canonical* pools the fee is **dynamic by market cap**: at 0–420 SOL market cap it is 1.25% (0.30/0.93/0.02 creator/protocol/LP); from 420–1,470 SOL the creator share jumps to **0.95%** with protocol 0.05% and LP 0.20% (1.20% total), then the creator share tapers in steps down to **0.05%** at ≥98,240 SOL market cap (0.30% total: 0.05/0.05/0.20). Non-canonical PumpSwap pools charge 0.30% (0/0.05/0.25). Creator fees apply to coins present since 13 May 2025; USDC pairing was added 21 May 2026. The "Project Ascend" rebuild of creator fees dates from September 2025 **(secondary: Blockworks)** and paid out roughly $2M to creators in its first 24 hours **(secondary)**.

**Numbers (secondary).** Lifetime revenue passed $800M by September 2025 (The Block headline); 2025 gross protocol revenue ≈ $971M; PumpSwap did ≈ $11.2B volume in April 2025 (The Block) and a record ≈ $2.03B single day on 6 Jan 2026. Graduation rates are brutal: roughly 0.8–2% of created coins ever graduate (multiple trackers; "42,000 launches in 24 hours, under 2% graduate"). LetsBONK briefly overtook pump.fun in July 2025 (≈64–84% share depending on the metric). The PUMP token sale in July 2025 is reported as $500M by some outlets and $600M by others — **unverified**, cite as "≈$500–600M".

**Lesson for us.** The dynamic schedule is the interesting part: small coins pay creators a lot (0.95%), large ones almost nothing, and the LP always gets 0.20%. The protocol never holds a mutable admin over graduated liquidity.

### 2.2 Zora Coins (Base)

**Mechanism (primary: docs.zora.co/coins/contracts/{architecture,hook,rewards}).** Three coin types, all 1B supply, all on Uniswap v4 through one unified hook, `ZoraV4CoinHook` (v2.3.0 merged the older `ContentCoinHook`/`CreatorCoinHook`). The hook uses `afterInitialize` (creates "discovery" and "market" positions via Doppler multi-curve positioning), `beforeSwap` (dynamic fee incl. sniper tax) and `afterSwap` (collect LP fees from every position, multi-hop-swap them to the backing currency, distribute). `ZoraFactoryImpl` exposes `deploy()`, `deployCreatorCoin()`, `deployTrendCoin()` and address prediction (`coinAddress()`, `trendCoinAddress()`).

- **Creator Coin**: one per creator, backed by ZORA; 500M vest linearly to the creator over **5 years**, 500M tradable.
- **Content Coin**: one per post, backed by the creator's coin; 10M to the creator instantly, 990M to market.
- **Trend Coin**: 100% to the pool, 0.01% fee, 100% to protocol, unique case-insensitive tickers enforced on-chain.

**Fees (primary).** 1% swap fee on creator/content coins. 20% of the fee is "LP remint" (single-sided positions placed outside the trading range to deepen the pool); 80% is market rewards split creator 62.5% / platform referral 25% / trade referral 5% / Doppler 1.25% / protocol 6.25% — i.e. **50% / 20% / 4% / 1% / 5% of the total fee**. Sniper tax: `fee = 99% − (elapsed_seconds / 10) × (99% − 1%)`, so 99%→1% over the first **10 seconds**; initial supply purchases bypass it. 6 June 2025 marked universal V4 adoption.

**Numbers (secondary).** Over 2M coins created through 2025, ≈$376M trading volume and ≈$27.7M creator rewards paid (coinlaw aggregator, unverified). The "Base is for everyone" content coin (April 2025) hit ≈$17M market cap and fell >90% within minutes; three wallets bought before the announcement and netted ≈$666k; ZORA's own market cap later fell ≈95% from peak (all secondary).

**Lesson for us.** A single hook that *collects, converts and pays on every swap* removes the "claim" step and the escrow; a 10-second 99% tax is enough to kill same-block sniping on an L2 without punishing humans; 5-year creator vesting is the strongest alignment signal in the market.

### 2.3 Clanker (Base, Arbitrum, Unichain, Ethereum, BNB, Monad)

**Mechanism (primary: clanker.gitbook.io v4 pages, `IClanker.sol`).** Clanker v4 is a modular factory. Non-upgradeable core: `Clanker` (factory), `ClankerFeeLocker` (one contract accrues fees for every v4 token), `ClankerToken` (super-chain-compatible ERC-20, fresh contract per `deployToken()`). Four interfaces: `IClankerLpLocker`, `IClankerExtensions`, `IClankerMevModule`, `IClankerHook`. **All implementations must be allowlisted on the factory by the team** — that is the admin surface we must not copy.

`deployToken(DeploymentConfig)` takes `TokenConfig {tokenAdmin, name, symbol, salt, image, metadata, context, originatingChainId}`, `PoolConfig {hook, pairedToken, tickIfToken0IsClanker, tickSpacing, poolData}`, `LockerConfig {locker, rewardAdmins[], rewardRecipients[], rewardBps[], tickLower[], tickUpper[], positionBps[], lockerData}`, `MevModuleConfig {mevModule, mevModuleData}`, and `ExtensionConfig[] {extension, msgValue, extensionBps, extensionData}`. The locker `ClankerLpLockerFeeConversion` supports **up to 7 reward recipients and 7 initial LP positions**, each able to choose which token to accrue fees in; reward BPS are immutable, recipient addresses are updatable by their admin.

Extensions: `ClankerVault` (vault a share of supply; **minimum lockup 7 days**; optional linear vest), `ClankerAirdrop` (merkle root; **minimum lockup 1 day**; optional vest), `ClankerAirdropV2` (root updatable post-launch), `ClankerUniv4EthDevBuy` (dev buys in the deploy tx), `ClankerPresaleEthToCreator` (presale whose proceeds go to the creator, min/max ETH goals). MEV modules: `ClankerMevModule2BlockDelay` (pool unswappable for 2 blocks), `ClankerSniperAuctionV0` (auctions the first swaps per block on priority-ordered L2s, proceeds to creators), `ClankerMevDescendingFees` (v4.1: start fee up to **80%**, parabolic decay over at most **2 minutes**), `ClankerSniperAuctionV2`. Hooks: static (asymmetric buy/sell fee allowed) or dynamic (volatility-accumulator fee, e.g. 1% base / 5% max), plus V2 variants with pool extensions.

**Fees (primary).** "The Clanker fee is fixed at 20% of LP fees… in addition to creator LP fees": creator 1% → protocol 0.2% → 1.2% total; 3% → 0.6% → 3.6%. Via the Farcaster bot the creator receives 80% of rewards; via Bankr the default was 80% creator / 20% interface (secondary).

**Deployed (primary, Base 8453, v4.0.0).** `Clanker` 0xE85A59c628F7d27878ACeB4bf3b35733630083a9; `ClankerFeeLocker` 0xF3622742b1E446D92e45E22923Ef11C2fcD55D68; `ClankerLpLockerFeeConversion` 0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496; `ClankerVault` 0x8E845EAd15737bF71904A30BdDD3aEE76d6ADF6C; `ClankerAirdrop` 0x56Fa0Da89eD94822e46734e736d34Cab72dF344F; `ClankerMevBlockDelay` 0xE143f9872A33c955F23cF442BB4B1EFB3A7402A2; v4.1.0 `ClankerHookDynamicFeeV2` 0xd60D6B218116cFd801E28F78d011a203D2b068Cc, `ClankerHookStaticFeeV2` 0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC.

**Audit (primary: Cantina).** Review 20 May–4 June 2025: 26 findings — 6 medium (5 fixed, 1 acknowledged: precision loss in presale distribution, incorrect protocol-fee calculation, airdrop/presale incompatibility), 8 low (incl. "incorrect startingTick when placing initial liquidity", fee drainage via tokens that transfer less than requested), 8 informational, 4 gas.

**Numbers.** By April 2025: >200,000 tokens, ≈$2.7B swap volume, ≈$27M fees, >$13M team revenue (The Block, fetched). pool.fans later quotes 585K+ tokens, $5.0B volume and $49.7M creator fees **(secondary, undated)**. Farcaster acquired Clanker in October 2025 and two-thirds of protocol fees now buy back CLANKER **(secondary)**. One personnel incident: a developer was identified as a former Velodrome thief and departed (secondary) — not a contract exploit.

**Lesson for us.** The *shape* of Clanker v4 — factory + fee locker + token + four small interfaces + a struct that fully describes a launch — is the right shape. The team allowlist and updatable airdrop roots are the parts to leave out.

### 2.4 Doppler (Whetstone Research)

**Mechanism (primary: `Airlock.sol`, whitepaper Jan 2024, docs corpus).** The `Airlock` is the single entry point. `create(CreateParams)` validates four module addresses against `getModuleState` (`TokenFactory`, `GovernanceFactory`, `PoolInitializer`, `LiquidityMigrator`), deploys the asset through the token factory (DERC20 with `vestingDuration`, `cliffDuration`, `yearlyMintRate`, `tokenURI`), deploys governance + timelock, approves `numTokensToSell` to the initializer, initialises the bonding pool, initialises the migration pool, and **locks the asset's migration pool** (`ILockablePoolToken(asset).lockPool(migrationPool)`) so nobody can trade it early. `migrate(asset)` is permissionless: it unlocks, transfers token ownership to the timelock, calls `poolInitializer.exitLiquidity`, splits fees, forwards balances to the migrator and calls `migrate(sqrtPriceX96, …)`.

Fee rule in `_handleFees`: protocol takes `max(fees/20, (balance − fees)/1000)` capped at `fees/5`; the integrator gets the rest of the trading fees. The docs state the live protocol share as **5% of trading fees on EVM, 7.5% on Solana**; beneficiary fees can be configured to **decay from 80% to 1%** over N seconds; a `StreamableFeesLocker` (v4 migrations only) streams fees to beneficiaries whose shares must sum to `1e18`, protocol owner minimum 5%, with a `lockDuration`. Three pool initialisers: **dynamic** (v4 dutch auction: `startTick`, `endTick`, `epochLength`, `gamma`, `minimumProceeds`, `maximumProceeds`, `duration`; early exit on max proceeds), **static** (v3 fixed-slope curve), **multicurve** (contiguous segments with `shares` summing to 1e18 and an optional tail). Migrations: `noOp`, `uniswapV2`, `uniswapV3`, `uniswapV4`. MASTER-NFT-PROJECT's integration notes that the official v2 migrator "locks 5% of LP for one year, gives the remaining LP to the selected recipient" and caps proceeds splitting at 50%.

The whitepaper's auction maths (Adams, Czernik, Lakhal, Zipfel): the target tick decays linearly in log-space with `maxDelta = (maxTick − minTick)/(endingTime − startingTime) · epochLength`; each epoch compares expected sold λ_t to realised net-sold λ̂_t and adds a `tickDelta` to a `tickAccumulator`; the active bonding curve is `b_c(t) = γ·(t/t_max) + τ_t` with price `1.0001^b_c(t)`; because the curve is set in `beforeSwap`, "a manipulator would lose funds from the shifting of the bonding curve, functioning as limit orders". Under-raise refunds pro-rata; the paper also argues for a **token factory with known bytecode** so "swappers and integrators can trust that any arbitrary user-deployed contracts that emerge from the factory will meet certain standards".

**Numbers (secondary: The Block, Yellow).** Doppler reportedly powers >90% of new DEX pool launches on Base, ≈40,000 asset creations per day, >$1B cumulative volume, and raised a $9M seed (Q2 2025); native Solana rebuild in early 2026. Audits: a Cantina competition on commit `338d39d…` (≈2,300 LoC) is listed; detailed findings not fetched. **License: BUSL-1.1** — MASTER-NFT-PROJECT's README already flags that production use needs a grant from `doppler-license-grants.whetstoneresearch.eth`.

**Lesson for us.** The Airlock pattern (lock the destination pool at creation; permissionless `migrate`) is the direct fix for the Four.meme/Virtuals class of bug. The `Ownable` + `setModuleState` admin is the part we cannot adopt.

### 2.5 Uniswap Continuous Clearing Auction + Liquidity Launcher

**Mechanism (primary: GitHub README, `IContinuousClearingAuction.sol`, technical documentation, whitepaper Nov 2025).** A CCA "generalizes the uniform-price auction into continuous time". The auctioneer commits before start to `AuctionParameters {currency, tokensRecipient, fundsRecipient, startBlock, endBlock, claimBlock, tickSpacing (Q96), validationHook, floorPrice (Q96), requiredCurrencyRaised, auctionStepsData}`. The issuance schedule is packed `uint64` steps: 24-bit per-block rate in **MPS (milli-bips, 1e7 = 100%)** + 40-bit block count, stored in SSTORE2. Bidders call `submitBid(maxPriceQ96, amount, owner, prevTickPriceQ96, hookData)`; each bid is **spread across the remaining schedule**; at every `checkpoint()` the contract computes the lowest clearing price at which all remaining supply clears; bids above it fill fully, at it partially, below not at all. Demand rolls forward, so the clearing price is monotone and "latent demand keeps lifting the price even after the originating blocks have passed". `isGraduated()` is `currencyRaised ≥ requiredCurrencyRaised`; if never graduated, `exitBid` refunds in full and tokens return. `exitPartiallyFilledBid(bidId, lastFullyFilledCheckpointBlock, outbidBlock)` uses checkpoint accumulators for O(1) fills. `lbpInitializationParams()` hands the final price/tokens/currency (net of fee) to an `ILBPInitializer` strategy. Optional `IValidationHook.validate` is called on every bid and must revert to reject; hooks should implement ERC-165 (CIP-1).

Integration rules worth copying verbatim: minimum tick spacing 2, recommended ≥1 bp of floor ("1% or 10% is also reasonable"); max total supply 2^100 wei; minimum floor price 2^32+1; "the last block of the auction MUST sell a significant amount of tokens" or the final price is manipulable; no fee-on-transfer tokens; no tokens with <6 decimals; extra tokens sent directly are unrecoverable; "we strongly recommend that the currency is chosen to be more valuable than the token".

Fees: each auction binds an immutable `IProtocolFeeController`; **fees are read at the time they are applied, not at creation**, so a controller upgrade affects in-flight auctions; `address(0)` disables fees entirely.

Liquidity Launcher: `createToken` / `depositToken` (Permit2) / `distributeToken` / `distributeWithNative`, batched in one `multicall` ("tokens left in the launcher between transactions can be distributed by any caller"). `InstantLaunchStrategy`: exactly 1e9 × 1e18 supply, native-ETH pair, 25 bps, tick spacing 60, no hook, single-sided position, dust burned to `0xdead`, LP NFT sent to a singleton `FeeSplitter` that "locks it permanently and permissionlessly splits its fees". `LBPStrategy`: `migrationBlock`, `reservedTokenAmountForLP`, `positionDefinitions`, `lpAllocationSchedule`, `poolParameters`; the pool id is **reserved at registration** so no other initializer can claim it. Periphery: `TimelockedPositionRecipient`, `VestingClaimRecipient`, `MerkleClaimFactory` (MerkleDistributorWithDeadline), `BeneficiaryVault` (a transferable ERC-721 that *is* the fee beneficiary), `BuybackAndBurnClaimRecipient`, `CompoundingClaimRecipient`. Explicit warning: a malicious launcher can configure an auction that can never migrate so raised funds return to `recipient`.

**Deployed (primary).** `ContinuousClearingAuctionFactory` v2.1.0 at 0x000000001F26a0044BaA66024e7b6599c61963F8 (canonical across select EVM chains; v2.0.0 0x00cCa200BF124dBfA848937c553864f4B4CE0632); `CCALens` v2.0.0 0xc3C65F5453A3674aDb693cbdA3C842545cD30f53. Audits: Spearbit, OpenZeppelin, ABDK; v2.0.0 reports dated 06/16/2026. MIT.

**Numbers (primary: Uniswap blog).** Aztec ran the first CCA in November 2025, raising **$60M from more than 17,000 bidders "with no instances of sniping or automated manipulation detected"**; the Auctions tab in the Uniswap app went live 2 February 2026. The whitepaper's own risk list: uniform-price auctions "are not strategy-proof in general and may still admit residual bid shading"; poor release schedules create manipulation near the end; on-chain latency games remain.

### 2.6 Flaunch (Base)

**Mechanism (primary: repo README, docs, protocol-fee-switch page, GitBook answer).** Every coin gets a **30-minute Fixed Price Fair Launch**: "a designated token supply is offered at one fixed price. The Uniswap V4 hook intercepts swaps to fill the fair-launch position"; afterwards "raised ETH backs a buy position below spot; remaining tokens move into a full-range position", so fair-launch buyers "can sell at their entry price, minus fees". Fees are 1% on buys and sells, paid out exclusively in ETH (via `flETH`, which earns Aave yield). Default split **80% creator / 20% community**; the community share funds the **Progressive Bid Wall** ("each 0.1 ETH of fees creates a bid wall one tick below spot; a hook moves it upward as price rises") or, if the wall is disabled, the `MemecoinTreasury`. A protocol fee is optional, FLAY-governed and capped at 10% of the swap fee, applied as a waterfall (example on the docs page: 1 ETH fee → 0.0475 protocol, 0.722 creator, 0.1805 bid wall). Flaunching fee: **0.1% of the configured market cap in ETH**; launches under ≈$10k market cap pay nothing (secondary). Creator revenue belongs to the holder of the **revenue ("Memestream") NFT**, which can be a wallet, multisig, `RevenueManager` or `TreasuryManager`. Sniper protection during fair launch is **app-level CAPTCHA and per-wallet caps** — i.e. not on-chain. Contracts on Base: `PositionManager` 0x23321f11a6d44fd1ab790044fdfde5758c902fdc, `BidWall` 0x7f22353d1634223a802d1c1ea5308ddf5dd0ef9c, `FeeEscrow` 0x72e6f7948b1B1A343B477F39aAbd2E35E6D27dde, `flETH` 0x000000000d564d5be76f7f0d28fe52605afc7cf8. The docs state 4,755 tokens on `PositionManager1` at time of writing.

**Numbers (secondary, inconsistent across sources).** "2,000+ tokens and ≈$75M volume since February 2025" (Alchemy listing, likely stale); DefiLlama-style figures of ≈$3.6M cumulative fees, ≈$1.98M creator earnings — unverified.

### 2.7 Virtuals Protocol (Base, Solana)

**Mechanism (primary: whitepaper pages "Virtuals Launch Mechanics", "Anti-Sniper Protection", "60 Days", FAQ).** Creating an agent is free; modules are toggled independently (Launch Radar 100 VIRTUAL, Capital Formation 10 VIRTUAL). Trading opens on a bonding curve immediately — "no presales, whitelists, or gated allocations". **Anti-sniper (default on, free):** buy-side tax starts at **99% and decays to 1%** over a founder-chosen window of 0 s / 60 s / 10 min / 98 min (the 98-minute preset may be applied buy-side, sell-side or both); the collected tax buys back the agent token gradually over 24 hours and the bought tokens go to the **team wallet with a 3-month cliff and 9-month linear vest**. Base trading fee 1%: 70% creator, 30% treasury. Graduation at **42,000 VIRTUAL** creates a Uniswap **V2** pool; "all LP tokens generated during agent graduation are automatically staked under a long-term lock of ten (10) years". "Hyperboost" releases previously idle supply as 14 daily reward tranches to traders (by volume share) and content creators after graduation, justified by the observation that "over 75% of tokens record their highest-volume 24 hours at graduation". The **60 Days** module is a trial: founder fees are escrowed; at day 60 the founder must Commit or Not Commit; on Not Commit "all funds accumulated will be refunded", Growth Allocation USDC is returned in full, and the founder's locked fee share goes to the refund pool; a stipend of 10% of collected funds (cap $5,000) is paid at day 30 and 60. Unicorn (Oct 2025) replaced the points-based Genesis because "fairness turned into farming" (secondary: Bankless/X). Automated Capital Formation executes linear limit-sells of the team allocation between $2M and $160M FDV, paid in USDC (secondary summary of whitepaper).

**Incidents (secondary).** January 2025: researcher "jinu" disclosed that attackers could pre-create the Uniswap V2 pair ahead of Virtuals' graduation; patched with a new contract; Discord compromised 8 Jan 2025; Code4rena review April–May 2025 reported 32 unique findings (Blockworks transparency filing).

**Numbers (secondary).** 18,000+ agents deployed, >$8B DEX volume, ≈$59M annual revenue by early 2026.

### 2.8 Bankr

**Mechanism (primary: docs.bankr.bot).** Bankr originally deployed through Clanker (80/20 creator/interface) and on 10 Feb 2026 launched its own launcher (secondary); the current docs describe a **Doppler-based** stack: 0.7% pool fee of which **95% goes to the creator (0.665% of volume)**; the hook adds a 0.285% LP fee that "automatically compounds as permanently locked liquidity", a 0.475% Bankr protocol fee, a 0.2375% BNKR buyback and ≈0.0875% to Doppler — **1.75% all-in**. Supply 100B, 85% to the pool, **15% vests to the creator over 1 year with a 30-day cliff**. Rate limits: 50 deploys/day (100 for Club), one per minute, gas sponsored for the first 3–10; an optional **24-hour wallet-age gate** as anti-sybil; spam detection on the X path. "Fee schedules are fixed at launch and never change retroactively."

**Incident (primary: The Block, March 2025).** Grok, asked for token names, replied in-thread and Bankr's bot deployed them: 17 tokens, the flagship DRB peaking above $40M market cap, Grok's associated wallet accruing >$500k in fees. Bankr's response: "Grok was not built to responsibly manage its own wallet and safeguard its funds" — interactions with Grok were disabled. This is the single most relevant incident for an *agent-native* NFT.

---

## 3. Mechanism-by-mechanism comparison

### 3.1 Bonding curves and graduation

| | pump.fun | Virtuals | ANIMA `AgentLaunchpad` | Doppler dynamic |
|---|---|---|---|---|
| Curve | constant product, virtual reserves | bonding curve to 42k VIRTUAL | constant product over augmented reserves, rounding against trader | dutch-auction tick schedule + dynamic curve |
| Close | market-cap threshold, atomic | 42,000 VIRTUAL | `raised ≥ graduationTarget` or curve sold out | `maximumProceeds` or `duration`; refund under `minimumProceeds` |
| Destination | PumpSwap, protocol-owned pool | Uniswap V2, LP locked 10 y | `ILiquidityDeployer`, `lpRecipient` fixed at creation | module-selected v2/v3/v4, slice locked |
| Pre-allocation | none | team 50% under Unicorn (vested/ACF) | none ("no insider bag") | DERC20 vesting + yearly mint cap |

The recurring graduation bug is **destination-pool pre-creation**: Four.meme (Feb 2025, ≈$183k) lost because migration used `createAndInitializePoolIfNecessary` against a pair the attacker had already created at a wrong price; Virtuals (Jan 2025) had the same class of issue on V2; Four.meme again (Mar 2025, ≈$120–130k) was sandwiched around a leaked migration transaction. Doppler's `lockPool(migrationPool)` at creation and Uniswap's "pool id reserved at registration" are the two structural fixes; a Uniswap v4 pool keyed to *our own hook* cannot be initialised by anyone else at all, which is the cleanest of the three.

### 3.2 LP locking versus burning

Industry practice has converged: lock, do not burn. Burning LP (sending to `0xdead`) makes fees unclaimable and prevents migration; on v4 a "burned" position NFT is simply dead fees. The strong form is a **zero-admin custodian with permissionless fee collection**: Uniswap's `FeeSplitter` ("positions sent to it are irrecoverable by design"; `collectFees(uint256[])` is permissionless, splits immutable), Clanker's lockers (fees auto-collected on every swap into `ClankerFeeLocker`), Virtuals' 10-year stake, Doppler's locked slice with `StreamableFeesLocker`. The December 2024 GemPad incident ($1.8M, Base) is the cautionary tale for lockers: `collectFees()` → Uniswap `collect()` → malicious token's `transfer()` re-entered `multipleLock()`; there was no `nonReentrant` and accounting happened after external calls.

### 3.3 Anti-sniping

| Technique | Who | Parameters | Where it runs |
|---|---|---|---|
| Decaying launch fee | Zora, Clanker, Virtuals, Doppler beneficiaries, ANIMA | 99%→1% over 10 s (Zora); ≤80% parabolic ≤2 min (Clanker); 99%→1% over 60 s–98 min (Virtuals); 80%→1% (Doppler); 9900 bps cap (ANIMA) | hook `beforeSwap` / curve |
| Block delay | Clanker | 2 blocks unswappable | MEV module |
| Sniper auction | Clanker | first swaps per block auctioned, ≤5 rounds, proceeds to creator | MEV module on priority-ordered L2s |
| Fixed-price window | Flaunch | 30 min, exit at entry price minus fee | hook fills a position |
| Per-address cap | ANIMA, Flaunch | `maxBuyInWindow`; per-wallet caps | contract / app |
| Continuous clearing | CCA | bids spread over schedule; uniform price | auction contract |
| Dutch auction | Doppler | price descends until demand appears | hook |
| Minimum evaluation period | Virtuals Unicorn | 24 h between page and trading (secondary) | platform |
| CAPTCHA / wallet age | Flaunch, Bankr | app CAPTCHA; 24 h wallet age | off-chain |

Where the tax goes matters: Zora and Clanker route it to the creator (so a creator who snipes their own launch is paid for it); Virtuals routes it to buybacks that end in the *team* wallet; ANIMA's goes through the normal fee split including the token's redemption treasury. For a protocol that advertises "a token that cannot be used against the people who hold it", the tax should end in the pool or the holders, never the launcher.

### 3.4 Fee streams, vesting, airdrops

- **Who gets what**: pump.fun creator 0.30–0.95% + LP 0–0.20% + protocol 0.05–0.95%; Zora creator 50% / LP 20% / referrals 24% / protocol 5% / Doppler 1%; Clanker creator ≈80% of LP fee + protocol 20% on top; Flaunch creator 0–100% with 80/20 default, protocol ≤10% optional; Bankr creator 95% of 0.7% + 0.285% permanently-locked LP; Virtuals 70/30; Doppler protocol 5% (EVM).
- **Stream as an asset**: Flaunch Memestream NFT; Uniswap `BeneficiaryVault` ERC-721; pool.fans "fee tokens" (100 tokens = 100% of a stream, sold via an "Initial Revenue Offering") — secondary.
- **Vesting**: Zora creator 5 years linear; Bankr 1 year with 30-day cliff; Virtuals snipe-tax buybacks 3-month cliff + 9-month linear; Clanker vault ≥7 days + linear; Doppler DERC20 `vestingDuration`/`cliffDuration` + `yearlyMintRate`; Uniswap `VestingClaimRecipient`; Pixel-Garden's Locks + beneficiary-authorised `VestingSales` (an exact-terms sale anyone can execute at maturity).
- **Airdrops**: Clanker merkle airdrop with ≥1-day lockup (V2 root updatable — avoid); Uniswap `MerkleClaimFactory` (owner can withdraw unclaimed after `endTime`); Virtuals' points airdrops were abandoned for "farming"; the CCA whitepaper cites research that "up to two-thirds of distributed tokens are sold rapidly post-claim".

---

## 4. Security lessons and incidents (2024–2026)

| Date | Project | Loss | Root cause | Transferable rule |
|---|---|---|---|---|
| May 2024 | pump.fun | ≈$1.9M (12.3k SOL) | ex-employee used a withdraw authority + flash loans to fill curves and dump at graduation (secondary) | no human withdraw authority over curve funds; graduation must not be profitable to force |
| Dec 2024 | GemPad lock | $1.8M | reentrancy in `GemPadLock.collectFees()` via malicious token transfer (primary: Decurity) | lockers: `nonReentrant`, CEI, no trust in token callbacks |
| Jan 2025 | Virtuals | 0 (disclosed) | destination V2 pair could be pre-created ahead of graduation (secondary) | claim/lock destination pool at creation |
| Feb 2025 | LIBRA / Meteora | ≈$107M extracted | insiders sniped and drained single-sided pools (secondary) | insiders should be unable to buy before the public (no privileged first block), vesting for team supply |
| Feb/Mar 2025 | Four.meme | ≈$183k + ≈$125k | pre-created pair at wrong price; sandwiched migration tx (secondary) | atomic migration priced from the curve, never from spot; v4 pool keyed to our hook |
| Feb 2025 | pump.fun X account | n/a | social account hijack promoting fake PUMP (secondary) | announcements signed on-chain (Parley), never only on social |
| Mar 2025 | Bankr × Grok | n/a (17 unintended tokens) | bot deployed tokens on another AI's say-so (primary: The Block) | launch authority must be a scoped, bounded, revocable permission |
| Apr 2025 | "Base is for everyone" on Zora | >$15M mcap wiped | front-run by three wallets before announcement (secondary) | announce on-chain and open trading in the same block, or use a fair window / CCA |
| May 2025 | Cork Protocol (v4 hook) | $11M | `beforeSwap` lacked `onlyPoolManager`; attacker called it with a fake pool and crafted hook data (primary: Dedaub) | every hook callback checks `msg.sender == POOL_MANAGER` and validates the `PoolKey` |
| May–Jun 2025 | Clanker (audit) | 0 | precision loss, fee calc, extension incompatibilities (primary: Cantina) | fuzz extension combinations; mutate once to prove assertions bite |
| Sep 2025 | Bunni (v4 hook) | ≈$8.4M | rounding in liquidity-distribution withdraw (secondary) | rounding must favour the pool; invariant tests on round trips (IPSEITY's `testFuzz_roundTripNeverProfits`) |
| 2025–2026 | pump.fun RICO suit | legal | class action alleging an unlicensed casino; Jito dismissed Sept 2025, second amended complaint allowed (secondary) | in-page, on-chain disclaimers; no protocol-run promotion of specific launches |

Two further primary-source warnings are worth quoting directly. Uniswap: "It is trivially easy to create an LBPStrategy distribution and corresponding auction with malicious parameters… Malicious deployers can design such parameters so a failed migration returns the raised currency and reserved LP tokens to the configured `recipient`." And on fees: "Fees are read at the time they are applied, not at the time the auction was created, so a controller upgrade affects all in-flight auctions."

---

## 5. Recommendations for our project

Context: the NFT already has an ERC-6551 account (IPSEITY "Reach", ANIMA `accountOf`), a per-token AMM, Parley messaging, a receive-only vault (Grip), an existing fixed-supply token factory with on-chain hook-address mining (Kiln), a bonding-curve launchpad with fair window and redemption floor (ANIMA), hash-pinned CCA + Doppler integrations with lifecycle tests (MASTER-NFT-PROJECT), and NFT-signed token/hook creation with vesting sales (Pixel-Garden). The job is to choose, not to invent.

**MUST**

1. **The launch is signed by the NFT, and the fee stream belongs to the NFT.** Keep Kiln's rule (`mayActAs`: owner or the token's own 6551 account, never a renter) and ANIMA's rule (selling the agent revokes all operator authority). Route every creator fee from every launch to the token's account, so the stream transfers with the NFT exactly as Flaunch's Memestream NFT and Uniswap's `BeneficiaryVault` ERC-721 do — but without a second NFT. *Rationale:* this is the one feature no external launchpad can offer, and it makes "mint the NFT, get the launchpad" literally true.
2. **Fixed-supply, ownerless token from a known factory.** Keep Kiln's `Coin` / Pixel-Garden's `LaunchToken`. Doppler's whitepaper and Clanker's "not mintable after deployment" agree; Kiln's comment ("a launchpad that offers those levers… is a rug factory with a form") is the right doctrine. Deterministic CREATE2 with the launcher mixed into the salt (Kiln) and address prediction before sending (Zora `coinAddress`, Pixel-Garden `predictToken`).
3. **Pool claimed at creation, liquidity locked by construction, zero admin.** Initialise the Uniswap v4 pool keyed to our hook in the same transaction as the launch (no one else can create that `PoolKey`), and send the LP position to an immutable custodian with permissionless `collect` that pays the NFT's account — the `FeeSplitter` pattern. Copy GemPad's lesson into the custodian: `nonReentrant`, effects before interactions, no arbitrary token callbacks. Record the custodian address in the launch struct so buyers can verify it before buying (ANIMA's `lpRecipient` fixed at creation).
4. **Anti-sniping on-chain, with the tax going to holders.** Ship a decaying launch fee in `beforeSwap` (parameters: start ≤ 9900 bps, duration ≤ 2 minutes default, ≤ 98 minutes maximum), optionally a 2-block no-swap delay, and route the tax to the pool's locked liquidity or to the token's redemption treasury (ANIMA `AgentToken.contribute`) — never to the launcher. Reject Flaunch's CAPTCHA (needs a server) and Virtuals' team-wallet buyback (extractive).
5. **Hook hygiene.** Every callback checks `msg.sender == POOL_MANAGER` (Cork), validates the `PoolKey` against the launch record, address bits are checked after deployment (Kiln `deployHook` `WrongFlags`), and no hook returns deltas (Facet's refusal, Bunni's lesson). Rounding always favours the pool; keep the round-trip fuzz invariant.
6. **Fee schedule immutable per launch, total ≤ 1.25%.** Industry centre of gravity is 1% (Zora, Flaunch, Virtuals, Clanker creator leg); pump.fun's ceiling is 1.25%; Bankr's 1.75% is an outlier. Split creator (NFT account) / locked-LP compounding / protocol, with BPS immutable and recipient addresses updatable only by the NFT (Clanker's immutable-BPS pattern). Bankr's rule "fixed at launch and never change retroactively" should be a tested invariant.
7. **Scoped launch authority for agents.** An agent (ANIMA session key) may launch only through a session scoped to the launch selector, with an expiry and a spend cap, and only on a pool whose quote is ETH or USDC — the Grok incident is exactly an unscoped bot. Add a per-NFT rate limit (one launch per block, N per day) like Bankr's 1/min, 50/day.
8. **Atomic, price-faithful graduation.** For curve launches, migrate at the curve's final price in one transaction (pump.fun, ANIMA `graduate`), never read spot; for auctions, seed at the clearing price (CCA `lbpInitializationParams`). Never compute the curve per-trade (IPSEITY's anchored curve bug).

**SHOULD**

9. **Offer three mechanisms behind one `ILiquidityDeployer`-style seam: instant pool, bonding curve, CCA.** MASTER-NFT-PROJECT already pins CCA v2.1.0 (MIT) and the Liquidity Launcher and has lifecycle tests; expose CCA for "serious" launches with our own factory bound to `address(0)` or an immutable fee controller (the governance-owned controller is mutable mid-auction). Enforce the CCA integration rules in the UI and the contract: tick spacing ≥ 1 bp of floor, last step sells a significant share, currency more valuable than token, no fee-on-transfer, ≥ 6 decimals.
10. **NFT-gated bidding via `IValidationHook`.** Implement `validate` as "the bid owner is an NFT holder (or an authorised account of one), with per-NFT bid caps" and ERC-165 per CIP-1. Scarcity of the NFT (4,096 edition) is a sybil cost no CAPTCHA can match; ANIMA's bond/reputation can raise it further.
11. **Creator vault with vesting, visible before the first buy.** Default creator allocation ≤ 15% vesting ≥ 1 year with a 30-day cliff (Bankr), optionally 5 years (Zora); lockup minimum 7 days (Clanker). Reuse Pixel-Garden's Locks and `VestingSales` so the creator can pre-authorise exact-terms exits (the self-custodial version of Virtuals' ACF limit-sells).
12. **Merkle airdrops with an immutable root and a minimum lockup.** Clanker v4.0 semantics (root fixed, ≥ 1 day lock, optional linear vest); never AirdropV2's updatable root; an `endTime` sweep only back to the pool or treasury, not to the launcher.
13. **Dynamic creator fee by market cap** (pump.fun Ascend: 0.95% small → 0.05% large, LP constant 0.20%) as an optional schedule — it rewards early builders and lets mature tokens trade cheaply. Keep the schedule in the launch struct, not in protocol state.
14. **Trial launches.** Virtuals' 60-Days pattern fits a no-governance design: creator fees escrowed in the token's contract until `commit()`; `abandon()` or a deadline routes escrow and unsold supply to a refund pool claimable pro-rata by holders.

**COULD**

15. Progressive bid wall as an optional hook action funded by the community share of fees (Flaunch: one wall per 0.1 ETH, one tick below spot).
16. Post-graduation "Hyperboost": unsold curve supply released over 14 days to traders pro-rata to volume measured in `afterSwap` — on-chain, no points.
17. Super-chain same-address tokens (Clanker `ClankerToken`, Uniswap `USUPERC20Factory`) so a launch from an id band on one chain owns the same address on the other four.
18. Referral legs in the fee split (Zora: platform 20% + trade 4%) to let other on-chain front ends route to our pools.

**AVOID**

19. Team-allowlisted module registries (Clanker `SetHook/SetLocker/SetExtension`, Doppler `setModuleState`, upgradeable controllers) — they contradict the diamond-without-`diamondCut` doctrine; ship an immutable module set and deploy a new launchpad for new modules, as Premises does for pages.
20. Burning LP positions; off-chain anti-bot (CAPTCHA, wallet-age checks on a server); points-based airdrops; fee-on-transfer or rebasing quote tokens; reading spot price at migration; routing sniper tax to the launcher.
21. Shipping Doppler core in production without resolving BUSL-1.1 (the local integration README already refuses to claim a grant).

---

## 6. Concrete spec sketch (names provisional)

```solidity
struct LaunchTerms {
    uint256 nftId;               // the signing token; fees route to accountOf(nftId)
    address token;               // CREATE2 Coin, salt mixes launcher
    uint8   mechanism;           // 0 instant pool, 1 curve, 2 CCA
    address quote;               // ETH or USDC only
    uint24  lpFeePips;           // ≤ 12_500 (1.25%)
    uint16  creatorBps; uint16 lpCompoundBps; uint16 protocolBps; // sum == 10_000, immutable
    uint16  snipeStartBps;       // ≤ 9_900
    uint32  snipeDecaySeconds;   // ≤ 5_880 (98 min); default 120
    uint8   noSwapBlocks;        // default 2
    uint16  creatorVaultBps;     // ≤ 1_500
    uint32  vaultCliff; uint32 vaultDuration;   // ≥ 30 d cliff, ≥ 365 d
    bytes32 airdropRoot; uint32 airdropLock;    // root immutable, lock ≥ 1 d
    address custodian;           // immutable LP custodian, permissionless collect
}
```

Launch flow (one transaction from the NFT's account): `launch(LaunchTerms)` → deploy `Coin` → initialise v4 pool keyed to our hook → place positions (multi-range, Clanker-style up to 7) → send LP NFT to `custodian` → record terms → emit; `collect(poolId)` permissionless; `graduate(launchId)` permissionless for curves; CCA launches reuse the pinned factory with our immutable fee controller and an NFT-gated `IValidationHook`.

---

## 7. Special ideas

1. **"The NFT is the KYC."** A CCA validation hook that admits only NFT holders and caps bids per NFT turns a 4,096-piece edition into the sybil barrier Aztec needed ZK Passport for.
2. **Sniper tax raises the floor.** Route the decaying launch tax into the token's ERC-7641-style redemption treasury: every bot that snipes makes every holder's redeemable floor higher — a mechanism nobody else ships.
3. **Sell the NFT, sell the streams.** Because creator fees pay the token's account and selling the NFT revokes all prior authority, the whole launch portfolio changes hands with one ERC-721 transfer; ANIMA's `_update` hook makes this automatic.
4. **Bonded launches.** The launcher's slashable bond (ANIMA `BondVault`) is first-loss for a launch: a violated term (e.g. a custodian swap) slashes it to holders; buyers can read the bond before buying.
5. **The artwork prices the launch.** IPSEITY's `Facet` already sets a pool fee from the 4D section; let the decaying launch fee curve be a function of the same orientation word — the launch's economics are the art.
6. **Launch rooms in Parley.** Each launch gets a back-linked log room; the launch announcement and the pool initialisation are the same transaction, closing the "announce then get front-run" window ("Base is for everyone").
7. **On-chain hook recipes.** Kiln's `mine` view already lets a server-less page deploy v4 hooks; ship three audited recipes (decaying fee, fixed-price window, bid wall) selectable from the NFT's site.
8. **Commit-or-refund trials with no governance**: escrowed fees and a pro-rata refund pool enforced by the token contract.
9. **Same address on all five id-band chains** via salts bound to chain + kernel + id (Pixel-Garden's `deploymentSalt`).
10. **Self-custodial ACF:** Pixel-Garden's `VestingSales` lets a creator pre-authorise exact-terms exits at maturity that anyone can execute — Virtuals' automated capital formation without a keeper.

## 8. Open questions

1. Doppler is BUSL-1.1; CCA and the Liquidity Launcher are MIT. Do we ship Doppler at all, or only CCA + our own curve?
2. CCA's `IProtocolFeeController` is mutable mid-auction when governance-owned. Deploy our own factory with `address(0)` (no fee) or an immutable controller — and does that forfeit canonical addresses?
3. Which chains in our id bands have Cancun + a v4 `PoolManager` + priority ordering (Clanker's sniper auction only works on priority-ordered L2s)?
4. Can the CCA bid book UI (tick linked list, checkpoints, partial-exit hints >2,048 hops) be served from chain within EIP-170 pages? MASTER-NFT-PROJECT has a working desk; what is its contract-size cost?
5. Quote currencies: ETH only, or ETH + USDC (pump.fun added USDC in May 2026; CCA says the currency should be more valuable than the token)?
6. Target total fee: 1.00% (Zora/Flaunch/Virtuals) or 1.25% (pump.fun curve)? And is the LP-compounding leg (Bankr 0.285%) worth its gas on L2?
7. Per-NFT launch limits: with ~1–2% graduation rates industry-wide, should an NFT be bounded to N live launches so the on-chain registry stays readable without an indexer?
8. Legal framing: Zora/Coinbase called coins "collectibles… not investments"; pump.fun faces a RICO suit. What on-chain disclaimer text does the site render, and does the protocol ever promote a specific launch?
9. The Grok lesson for ANIMA: should agent-initiated launches require a human co-signature (guardian) for the first launch of an agent?
10. Several headline numbers (Clanker $5.0B / $49.7M, Zora $376M / $27.7M, Flaunch $75M, PUMP sale $500M vs $600M) come from aggregators or conflict; none should appear in our docs without re-measurement.
