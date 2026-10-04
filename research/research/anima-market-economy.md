# ANIMA (Cutting-edge-technologically-advanced-NFT) — market, launchpad, swap, economy, work

Reader area: `contracts/market/*`, `contracts/economy/RevenueRouter.sol`, `contracts/work/*`, plus the two shared libraries every one of these contracts depends on (`contracts/libraries/ExactERC20.sol`, `contracts/libraries/ERC6492.sol`). Checkout: `/home/user/Cutting-edge-technologically-advanced-NFT` at `main` (`e345828`). All line numbers below refer to that checkout. Everything was read in full; nothing was built or run (the `artifacts/` directory already present in the checkout was used to measure bytecode).

Goal this dossier serves: one unified fully on-chain ERC-721 whose holder gets a swap, a messaging/social layer, a launchpad and a vault inside the NFT, with the token's own metadata / `web3://` surface serving a web app that gates on NFT ownership. Every reuse verdict below is relative to that goal, not to ANIMA's own goal (an agent-native protocol).

---

## 0. Headline facts

- 10 Solidity files in the area, 2,671 lines. Toolchain: Hardhat 3 + viem, solc 0.8.28, optimizer runs 200, **viaIR**, evmVersion **cancun** (`hardhat.config.ts:16-27`). Every contract in the area uses OpenZeppelin 5.6 `ReentrancyGuardTransient` (transient storage, Cancun-only).
- The area contracts are **peripheral modules**, not part of the token. They talk to the ANIMA token through tiny locally-declared interfaces (`IAnimaMarketHooks`, `IAnimaAccounts`, `IAnimaSwapView`, `IAnimaDeskView`, `IRevenueAgentView`, `IAnimaLocking`, `IAnimaMeterView`) rather than importing the 300-line `IAnima`. This is why the whole suite runs unchanged against both the monolith and the EIP-2535 diamond build of the token.
- Measured deployed bytecode (from `artifacts/contracts/**.json`, `deployedBytecode` length): AgentMarket 9,083 B; AgentLaunchpad 16,396 B; AgentToken 5,369 B; AgentSwapRouter 5,519 B; AgentDerivativesDesk 6,706 B; FiatMintGateway 3,842 B; RevenueRouter 5,811 B; WorkEscrow 11,346 B; InferenceMeter 6,037 B. All are far below EIP-170 (24,576 B). The two libraries are `internal`-only (57 B stubs), i.e. inlined.
- Tests: 279 total in the suite (268 `it(` in `test/*.test.ts` + 11 `test(` in the three `*.test.mjs`; `CLAUDE.md` says 268 because it counts only the Hardhat files; README/SPEC/SECURITY/DEPLOYMENT say 279). Area-specific: Market 11, Launchpad 15 (incl. AgentToken), SwapRouter 11, Derivatives 12, FiatMintGateway 3, RevenueRouter 4, Meter 9, Accountability 23 (6 BondVault + 6 WorkEscrow + 7 disputes + 4 reputation), ExactERC20 2, and 8 regression tests in `test/Regressions.test.ts` that target this area. The whole suite is re-run against the diamond via `ANIMA_IMPL=diamond`.
- No branch changes the area's contracts relative to `main` except two: `origin/codex/fix-high-priority-bug-in-revenuerouter.sol` (an earlier, 5-argument variant of `routeExpected` that `main` superseded with the XOR-commitment design) and `origin/claude/nft-standard-ai-agents-2y8ngz` (adds a `client == agent account` self-hire check to `WorkEscrow.acceptJob` that `main` does not have — see §10).

---

## 1. Cross-cutting facts

### 1.1 `ExactERC20` — value-conserving ERC-20 transfers (`contracts/libraries/ExactERC20.sol`, 33 lines)

```solidity
library ExactERC20 {
    error InexactERC20Transfer(address token, uint256 expected, uint256 received);
    function transferFromExact(IERC20 token, address from, address to, uint256 amount) internal;
    function transferExact(IERC20 token, address to, uint256 amount) internal;
}
```

Each wrapper measures the receiver's `balanceOf` before and after `safeTransfer(From)` and reverts unless the delta equals `amount` (lines 16-32). Early-returns on `amount == 0 || from == to` (and `to == address(this)` for `transferExact`). Introduced in commit `ef22afa` ("fix: enforce value-conserving ERC20 settlement", 2026-09-02); SECURITY invariant 28: "Every ERC-20 settlement is value-conserving... fee-on-transfer and rebasing transfers fail atomically instead of creating bad debt." Tested by `test/ExactERC20.test.ts` with `MockTaxERC20` (burns 10%/transfer): "refuses to create treasury liabilities from nominal fee-on-transfer amounts", "reverts atomically when a redemption recipient would be short-paid". Gas cost: two extra `balanceOf` staticcalls per transfer. **Reuse verbatim.**

### 1.2 `ERC6492` — signature validation for undeployed signers (`contracts/libraries/ERC6492.sol`, 73 lines)

`isValidSignatureNow(address signer, bytes32 hash, bytes memory signature) internal returns (bool)` — NOT `view`: it may deploy the signer. If the signature ends with the 32-byte magic `0x6492…6492` and the signer has no code, it decodes `(factory, factoryCalldata, innerSignature)`, calls the factory, then requires `signer.code.length != 0` *before* checking the inner signature (lines 65-86) — the comment explains the guard: "An EOA is indistinguishable from a counterfactual account before preparation. Require the wrapper to actually deploy the signer before checking the inner signature; otherwise an EOA could attach an arbitrary privileged call and still pass below with its ordinary ECDSA signature." If the signer is already deployed the wrapper is stripped and `SignatureChecker` is used. Why it exists (lines 43-56): "counterfactual accounts are not an edge case here — they are the design... a `staticcall` to an address with no code succeeds and returns nothing, which reads as 'invalid signature' rather than 'not deployed yet'." Tests: `test/Regressions.test.ts:567-639` ("accepts a wrapped signature and deploys the signer on the way", "leaves ordinary signatures untouched", "rejects a wrapped EOA signature when preparation does not deploy the signer"), via `ERC6492Harness` in `contracts/mocks/Mocks.sol:174-186`. **Reuse verbatim** wherever signed orders from ERC-6551 accounts are accepted.

### 1.3 Module wiring (who may lock, reserve, slash, attest)

`test/helpers.ts:269-278` is the authoritative wiring, mirrored in `docs/DEPLOYMENT.md:97-101`:

```
anima.setModule(escrow, true);        // may lock agents and set them Disputed
anima.setModule(market, true);        // may lock agents and set ERC-4907 users
bonds.setModule(escrow, true);        // may reserve and release collateral
bonds.setArbiter(escrow, true);       // may TAKE collateral
reputation.setSettlementModule(escrow, true);  // may mark feedback as customer-attested
validation.setValidator(validator, true);
```

The token side (`contracts/core/AnimaAgent.sol:650-716`) exposes `moduleSetUser`, `lockAgent`, `unlockAgent`, `setDisputed` under `onlyModule`; `lockAgent` increments a `lockCount`, so locks from several modules stack and `locked(id) == lockCount != 0 || disputeCount != 0`. `mintAgent` (`AnimaAgent.sol:215-225`) has **no access modifier** — minting is permissionless, which is why `FiatMintGateway` needs no allowlisting on the token.

### 1.4 Fee ceilings governance cannot exceed (`docs/DEPLOYMENT.md:166-172` and the constants)

| Contract | Ceiling | Constant |
|---|---|---|
| `WorkEscrow` | 10% | `MAX_FEE_BPS = 1000` (`WorkEscrow.sol:90`) |
| `AgentMarket` | 5% | `MAX_FEE_BPS = 500` (`AgentMarket.sol:100`) |
| `AgentLaunchpad` | 3% across protocol+treasury+agent legs | `MAX_TOTAL_FEE_BPS = 300` (`AgentLaunchpad.sol:91`) |
| `FiatMintGateway` | 10% | `MAX_FEE_BPS = 1_000` (`FiatMintGateway.sol:41`) |
| `RevenueRouter` | ≥50% must stay operating; referral ≤5% | `MIN_OPERATING_BPS = 5_000`, `MAX_REFERRAL_BPS = 500` (`RevenueRouter.sol:34-35`) |

Every contract with an owner uses `Ownable2Step`; `RevenueRouter`, `AgentToken` and `InferenceMeter` have **no owner at all**.

### 1.5 One settlement asset

`docs/DEPLOYMENT.md:109`: "Bonds, escrow, metering and launches all denominate in **one ERC-20**, chosen at deployment." `AgentMarket` is the exception (native or any ERC-20 per order); `InferenceMeter` takes a token per channel.

---

## 2. `AgentMarket` — `contracts/market/AgentMarket.sol` (383 lines, 9,083 B)

**Purpose.** Off-chain-signed, on-chain-settled marketplace for ANIMA agents: outright **sale** or time-boxed **rental** (ERC-4907 lease plus a transfer lock). Its differentiator is that every order binds to the agent's *substance*, not its id. Contract comment, lines 33-55:

> "An agent is not a static asset. Between the moment you decide to buy one and the moment your transaction lands, the seller can empty its wallet, wipe its memory, or pull its bond — and on a generic marketplace your fill would still succeed... So every order here binds to the agent's *substance*, not just its id: `expectedAccountState` the ERC-6551 account nonce... `expectedBrainRoot` the commitment to the agent's private state... `minBondCoverage` free slashable collateral that must still be standing... Each check is opt-out (sentinel `type(uint256).max` / zero) so plain collectible trades stay cheap, but the defaults in the SDK turn them all on."

Royalties (lines 57-59): "honoured where ERC-2981 declares them. They are not enforced, because as of 2026 nothing enforces them without also making the asset untradeable on half the market."

**Inheritance.** `EIP712("AnimaMarket","1")`, `Ownable2Step`, `ReentrancyGuardTransient`.

**Types.**
```solidity
enum OrderKind { Sale, Rental }
struct Order {
    OrderKind kind; address maker; address taker;          // taker zero = open order
    uint256 agentId; address payToken;                       // zero = native
    uint256 price; uint64 start; uint64 expiry; uint64 duration;  // duration: rental seconds
    uint256 nonce; uint256 makerEpoch;
    uint256 expectedAccountState;                            // type(uint256).max to skip
    bytes32 expectedBrainRoot; uint64 expectedBrainEpoch;    // root zero to skip
    uint256 minBondCoverage;                                 // zero to skip
}
struct Rental { address tenant; uint64 endsAt; bool active; }
```
EIP-712 typehash string (line 95-97): `Order(uint8 kind,address maker,address taker,uint256 agentId,address payToken,uint256 price,uint64 start,uint64 expiry,uint64 duration,uint256 nonce,uint256 makerEpoch,uint256 expectedAccountState,bytes32 expectedBrainRoot,uint64 expectedBrainEpoch,uint256 minBondCoverage)`. The SDK mirrors it as `ORDER_TYPES` / `orderDomain` / `SKIP_STATE_CHECK` (`sdk/src/index.ts:524-549`).

**Public API.**
```solidity
constructor(IAnima anima_, BondVault bonds_, address owner_, uint16 feeBps_, address feeRecipient_)
function setFee(uint16 feeBps_, address recipient) external onlyOwner
function hashOrder(Order calldata order) public view returns (bytes32)
function cancelOrder(Order calldata order) external                      // maker only
function bumpMakerEpoch() external                                       // cancel-all
function fillOrder(Order calldata order, bytes calldata signature) external payable nonReentrant
function endRental(uint256 agentId) external nonReentrant                // permissionless after term
function currentIntegrity(uint256 agentId) external view
    returns (uint256 accountState, bytes32 root, uint64 epoch, uint256 coverage)
// constants / public state
uint256 constant SKIP_STATE_CHECK = type(uint256).max; uint16 constant MAX_FEE_BPS = 500;
IAnima immutable ANIMA; BondVault immutable BONDS; uint16 feeBps; address feeRecipient;
mapping(bytes32 => bool) cancelledOrFilled; mapping(address => uint256) makerEpoch;
mapping(uint256 => Rental) rentalOf;
```

**Storage layout** (declaration order, after OZ bases): `feeBps` (uint16) + `feeRecipient` (address) share one slot; `cancelledOrFilled`; `makerEpoch`; `rentalOf`. Immutables `ANIMA`, `BONDS` are in code.

**Events / errors.** `OrderFilled(orderHash, agentId, taker, maker, kind, price, fee, royalty)`, `OrderCancelled`, `MakerEpochBumped`, `RentalEnded`, `FeeSet`. Errors: `OrderNotStarted, OrderExpired, OrderAlreadySettled, BadSignature, NotTheTaker, MakerNotOwner, AgentStateChanged, BrainChanged, InsufficientCoverage, WrongPayment, AgentIsLocked, RentalStillActive, NoActiveRental, BadDuration, FeeTooHigh, ZeroAddress`.

**Fill algorithm (`fillOrder`, lines 238-274).** Hash → not settled → `start ≤ now ≤ expiry` → taker check → `order.makerEpoch == makerEpoch[maker]` → `ERC6492.isValidSignatureNow(maker, hash, sig)` → `ownerOf(agentId) == maker` → mark filled → `_checkIntegrity` → **deliver first** (`safeTransferFrom(maker, msg.sender)` for sale; `_startRental` for rental) → `_settlePayment` → emit. The load-bearing comment (lines 258-264):

> "Deliver the asset BEFORE paying. Paying first hands control to the maker — via an ETH push, or an ERC-777/1363 transfer hook — at a moment when they are still `ownerOf(agentId)`, and an owner can drain the bound account, queue the entire bond for withdrawal to themselves, and wipe the brain. Every integrity check above would have passed on the pre-callback state and the fill would still succeed... Once the token has moved, the maker is no longer a controller and none of those calls authorise."

This was CRITICAL finding #1 in `docs/SECURITY.md:132` and commit `f724b82`; the regression is `test/Market.test.ts:284-353` ("gives a malicious seller no window to strip the agent during settlement") using `contracts/mocks/MaliciousSeller.sol`, an ERC-1271 maker whose `receive()` tries drain / `requestUnbond` / `updateBrain` and records that all three failed.

`_checkIntegrity` (lines 277-299): account state read as `account.code.length == 0 ? 0 : IERC6551Account(account).state()` ("An undeployed account has never executed anything, so its state is zero"); brain root **and** epoch must match; `BONDS.availableCoverage(agentId) ≥ minBondCoverage`.

`_settlePayment` (lines 301-326): `fee = price*feeBps/10_000`; royalty from `IERC2981(ANIMA).royaltyInfo(agentId, price)`, zeroed if receiver is zero; clamp `fee + royalty ≤ price` ("a misconfigured collection must never make the seller pay to sell"); native path requires `msg.value == price` and pushes with `Address.sendValue`; ERC-20 path requires `msg.value == 0` and uses `transferFromExact` from the taker to fee recipient, royalty receiver and maker. Note: royalty is charged on **rentals too** (the same function runs for both kinds).

`bumpMakerEpoch` (lines 219-232) and the recorded past bug: "An earlier version took it from the taker to stop a maker front-running an in-flight fill — but that made the mechanism inert, since a taker could simply pass whatever the current value was. Cancelling your own resting order before it fills is normal marketplace behaviour and not an attack; an unusable cancel-all is a real one." (MEDIUM in commit `ea9ee59`.)

Rental (lines 332-363): `_startRental` requires `duration != 0`, agent not locked, then `moduleSetUser(agentId, tenant, endsAt)` and `lockAgent`. Why lock (lines 332-335): "Without the lock the lessor could sell the agent mid-lease and the tenant's paid-for access would evaporate — ERC-4907 clears `user` on transfer, which is correct for a free lease and a rug for a paid one." `endRental` is permissionless after `endsAt`, clears the lease and unlocks.

**Access control.** `setFee` owner; `cancelOrder` maker; everything else permissionless (fill is gated by signature + ownership). Requires `anima.setModule(market, true)` for rentals.

**Invariants.** Each order hash settles at most once; a maker epoch bump invalidates every signed order; asset moves before payment; `fee + royalty ≤ price`; a paid rental locks the token for the term.

**ERCs.** EIP-712, ERC-1271 + ERC-6492 (maker signatures), ERC-2981 (royalty read), ERC-721 `safeTransferFrom`, ERC-6551 `state()`, ERC-4907 via the token's `moduleSetUser`.

**Tests** (`test/Market.test.ts`, 11): "fills a sale, splitting protocol fee and declared royalty" (2.5% fee + 5% royalty → maker receives 0.925 ETH of 1 ETH), "rejects a replayed order", "lets a maker invalidate every order they ever signed", "rejects a forged signature", "reverts when the seller drained the bound account after quoting", "fills when the bound account is untouched", "reverts when the seller wipes the agent's memory after quoting", "reverts when the bond a buyer is paying for is already on its way out", "grants the tenant control and locks the agent for the term", "returns control to the owner when the term ends", "gives a malicious seller no window to strip the agent during settlement". Regression (`Regressions.test.ts:69`): "bumps ERC-6551 state when the allowlist changes, so an integrity pin catches it".

**On chain.** Base Sepolia (historical, burner key destroyed) `0x280296FEaA460354e1d86dAF0f3afCA631927cD0`; second Base Sepolia record `0x20291F8ea4554eFcC1C115a4834C3f6D2594d3cC` (same address on Unichain Sepolia 1301); Sepolia/BSC testnet/Robinhood testnet `0xB768d0ad7F8b7f0Fa79Af38da682F389538cb673`. Live evidence (`docs/LIVE_FUNCTION_MATRIX_2026-08-31.md:65-76`): agent #11 "was sold by a signed EIP-712 market order and then rented by its new owner" — fill tx `0xc74a7390…be714`, rental tx `0x3388a561…ce985`. The matrix adds: "There is no consignment contract or custody-based market listing in this repository. `AgentMarket` uses non-custodial signed EIP-712 orders."

**Weaknesses / gaps.**
1. Orders live off-chain; there is no on-chain order book or `postOrder`. For a "no server" product, order distribution must be wallet-to-wallet or posted as calldata/events by the maker.
2. Native payouts use `Address.sendValue` to three addresses; a reverting fee recipient or royalty receiver bricks every native fill (a `RevertingReceiver` mock exists but no market test covers it).
3. `cancelOrder` requires `msg.sender == maker`, so an ERC-1271/6551 maker must cancel through its own `execute`.
4. Rental does not check agent `status` (a Paused agent can be rented); sale on a locked agent only fails inside the token's `_update`.
5. The buyer is always `msg.sender` — no "buy for" or sponsored fills.
6. Depends on `BondVault`, brain root/epoch and ERC-6551 `state()`; outside ANIMA those checks must be replaced by the unified token's own ERC-5646-style fingerprint (the commit body for `1496c15` argues the fingerprint "strictly dominates the ERC-6551 state() nonce").

**Verdict: adapt.** The settlement core (EIP-712 + ERC-6492 + deliver-before-pay + epoch cancel-all + opt-out integrity pins + paid-rental lock) is worth lifting; replace the three ANIMA-specific pins with a single `getStateFingerprint`-style pin, and add an on-chain listing event so no server is needed to discover orders.

---

## 3. `AgentLaunchpad` — `contracts/market/AgentLaunchpad.sol` (459 lines, 16,396 B)

**Purpose.** Bonding-curve issuance of a per-agent `AgentToken`, graduating into locked AMM liquidity via an abstract `ILiquidityDeployer`. Contract comment (lines 25-46) names three departures from the standard launchpad:

> "1. **A fair window with a per-address cap.** ... This does not defeat a determined sybil, and pretending otherwise would be a lie — it raises the cost from 'one bot, one transaction' to 'many funded addresses', which is the honest amount of protection a permissionless curve can offer. 2. **Fees route into the token's redemption treasury.** A share of every trade goes to `AgentToken.contribute`, which raises the floor every holder can redeem at. 3. **Graduation liquidity is locked by construction.** The LP recipient is fixed when the launch is created and is visible to every buyer before they buy... Curve mechanics are constant-product over augmented reserves, with every rounding decision made against the trader. A curve that rounds in the trader's favour can be drained a wei at a time by a loop."

**Types.**
```solidity
struct Launch {
    address token; address creator; uint256 agentId;
    uint128 quoteReserve;   // augmented quote reserve (starts at the virtual amount)
    uint128 baseReserve;    // augmented base reserve (starts at totalSupply)
    uint128 initialQuote;   // the virtual seed, so raised = quoteReserve - initialQuote
    uint128 curveSupply;    // maximum tokens the curve may ever sell
    uint128 baseSold; uint128 graduationTarget;
    uint64 startsAt; uint64 fairWindowEnds; uint128 maxBuyInWindow;
    uint16 snipeTaxStartBps; // decays linearly to zero across the fair window
    address lpRecipient;     // fixed at creation
    ILiquidityDeployer deployer; // fixed at creation (see below)
    bool graduated;
}
struct FeeSplit { uint16 protocolBps; uint16 treasuryBps; uint16 agentBps; }
struct LaunchParams {
    uint256 agentId; string name; string symbol; uint256 totalSupply; uint256 curveSupply;
    uint256 virtualQuote; uint256 graduationTarget; uint64 startsAt; uint64 fairWindow;
    uint256 maxBuyInWindow; uint16 snipeTaxStartBps; address lpRecipient;
}
```
Why the deployer is pinned per launch (lines 74-77): "A mutable deployer receives approvals for the entire raise and the whole unsold supply at graduation, so leaving it swappable would make the LP-recipient guarantee buyers verified before buying worth nothing." (HIGH in `SECURITY.md:142`, commit `f7f86cc`; regression `Regressions.test.ts:357` "pins the liquidity deployer, so it cannot be swapped after buyers commit".)

**Public API.**
```solidity
constructor(IERC20 quote_, IERC721 agents_, IAnimaAccounts anima_, address owner_,
            address protocolFeeRecipient_, FeeSplit memory split_)
function setFeeSplit(FeeSplit calldata split_, address recipient) external onlyOwner
function setLiquidityDeployer(ILiquidityDeployer deployer) external onlyOwner   // future launches only
function launchOf(uint256 launchId) external view returns (Launch memory)
function createLaunch(LaunchParams calldata p) external nonReentrant returns (uint256 launchId, address token)
function buy(uint256 launchId, uint256 quoteIn, uint256 minBaseOut) external nonReentrant returns (uint256 baseOut)
function sell(uint256 launchId, uint256 baseIn, uint256 minQuoteOut) external nonReentrant returns (uint256 quoteOut)
function snipeTaxBps(uint256 launchId) public view returns (uint256)
function graduate(uint256 launchId) external nonReentrant                       // permissionless
function quoteBuy(uint256 launchId, uint256 quoteIn) external view returns (uint256 baseOut, uint256 fee)
function quoteSell(uint256 launchId, uint256 baseIn) external view returns (uint256 quoteOut, uint256 fee)
function raisedOf(uint256 launchId) external view returns (uint256)
// constants / state
uint16 constant MAX_TOTAL_FEE_BPS = 300; uint64 constant MAX_FAIR_WINDOW = 1 days; uint16 constant MAX_SNIPE_TAX_BPS = 9900;
IERC20 immutable QUOTE; IERC721 immutable AGENTS; IAnimaAccounts immutable ANIMA;
ILiquidityDeployer liquidityDeployer; address protocolFeeRecipient; FeeSplit feeSplit;
mapping(uint256 => uint256) launchOfAgent; mapping(uint256 => mapping(address => uint256)) boughtInWindow;
```

**Storage.** `liquidityDeployer` (slot), `protocolFeeRecipient` + `feeSplit` (packed: address 20 + 3×uint16), `_nextLaunchId = 1`, `_launches`, `launchOfAgent`, `boughtInWindow`.

**Events / errors.** `LaunchCreated(launchId, agentId, token, creator, curveSupply, graduationTarget, lpRecipient)`, `Bought(launchId, buyer, quoteIn, baseOut, fee)`, `Sold(...)`, `Graduated(launchId, pool, tokenAmount, quoteAmount, lpAmount)`, `FeeSplitSet`, `LiquidityDeployerSet`. Errors: `NotAgentOwner, AlreadyLaunched, NoSuchLaunch, NotStarted, AlreadyGraduated, NotGraduatable, FairWindowCapExceeded, CurveExhausted, SlippageExceeded, FeeTooHigh, FairWindowTooLong, BadCurveParameters, SnipeTaxTooHigh, StartsInThePast, NoDeployerConfigured, GraduationFailed, ZeroAmount, ZeroAddress`.

**`createLaunch` (lines 208-256).** Only the agent's ERC-721 owner; one launch per agent; `fairWindow ≤ 1 day`; non-zero `lpRecipient`; `startsAt` must not be in the past ("A backdated start puts `fairWindowEnds` in the past, so the per-address cap is never consulted and the creator can take the entire cheap end of the curve in one call" — MEDIUM in `f7f86cc`; regression "refuses a backdated start that would skip the fair window entirely"); `snipeTaxStartBps ≤ 9900`; a deployer must be configured; `curveSupply ∈ (0, totalSupply)`, `virtualQuote != 0`, `graduationTarget != 0` ("The curve must never be able to drain the base reserve to zero: constant product sends price to infinity there"). Deploys `new AgentToken{salt: bytes32(launchId)}(name, symbol, QUOTE, AGENTS, agentId, totalSupply, address(this))` — **the launchpad holds the whole supply**: "Nothing is pre-allocated to the creator, so there is no insider bag to dump into the launch."

**Curve maths.** `buy` (lines 262-299): pull `quoteIn` exactly; `fee = _takeFee(l, quoteIn)`; `k = q*b`; `newQuote = q + netIn`; `newBase = ceilDiv(k, newQuote)` ("Round the reserve UP so the trader receives less, never more, than the curve owes"); `baseOut = b - newBase`; revert if `baseSold + baseOut > curveSupply`; slippage; during the fair window accumulate `boughtInWindow[launch][buyer] += netIn ≤ maxBuyInWindow`. `sell` (lines 301-329): mirror image, fee taken on the gross quote out. Both update `uint128` reserves with `SafeCast`.

**Anti-snipe tax** (`_snipeTaxBps`, lines 339-346): `start * remaining / window`, linear decay from `snipeTaxStartBps` at `startsAt` to 0 at `fairWindowEnds`. "Priced by time rather than by identity, which is why splitting across addresses does not help — the defect in every per-address cap." Commit `5d21694` attributes the mechanism to Zora Coins and Virtuals and records the bug it introduced: "a 99% tax stacking on top of the base fee tried to pay out 102% of the trade, and because launches share one contract balance the overspill would have come out of another launch's raise rather than reverting." Hence the clamp in `_takeFee` (lines 358-364): `if (baseBps + snipeBps > MAX_SNIPE_TAX_BPS) snipeBps = MAX_SNIPE_TAX_BPS - baseBps`. The whole tax goes to the redemption treasury: "value a sniper gives up should land with the people they were trying to take it from."

**Fee routing** (`_takeFee`, lines 352-378): protocol cut → `protocolFeeRecipient`; treasury cut (+ snipe tax) → `QUOTE.forceApprove(token, cut); AgentToken(token).contribute(cut)`; agent cut → `ANIMA.accountOf(agentId)` (works for a counterfactual account because it is a plain ERC-20 transfer).

**Graduation** (lines 386-416): permissionless once `raised ≥ graduationTarget || baseSold ≥ curveSupply`; sends the launchpad's **entire** balance of the token plus `raised` quote to `deployer.deployLiquidity(token, QUOTE, tokenAmount, quoteAmount, lpRecipient)`; zeroes both approvals afterwards ("Leftover allowance would be a standing claim on the next launch's raise, since launches share this contract's balance"); reverts `GraduationFailed` if `pool == 0 || lpAmount == 0`.

**Invariants** (`SECURITY.md:45-50`): curve rounding always favours the pool; LP recipient and deployer fixed at creation; fees+tax never reach 100%; graduation does not depend on the creator.

**Tests** (`test/Launchpad.test.ts`, 15). Fixture: `totalSupply = 1e9 tokens`, `curveSupply = 800M`, `virtualQuote = 1,000 USDC`, `graduationTarget = 3,000 USDC`, fee split 1%/1%/1%, LP recipient `0x…dEaD`. The fixture comment records a measured bound: "With virtualQuote = $1,000 and 800M of a 1B supply on the curve, the maximum the curve can ever raise is $4,000 — at that point baseSold hits curveSupply." Tests: "refuses a launch from anyone but the agent's owner, and refuses a second one", "rejects curve parameters that would let the base reserve reach zero", "prices later buyers higher than earlier ones", "never lets a round trip extract more than was put in", "honours a slippage floor", "caps per-address buying during the fair window, then lifts the cap", "refuses to graduate before the target is met", "moves the raise and the unsold supply into locked liquidity, permissionlessly", "charges 99% at the opening block and decays it to nothing", "cannot be escaped by splitting across addresses, unlike a per-address cap", "refuses a tax that would leave a buyer with nothing" (+4 AgentToken tests, §4).

**On chain.** Base Sepolia (second record) launchpad `0x5ed9230C9eF2e53B0D26128902e59b02ca701624`, `MockLiquidityDeployer` `0x8f2D580F72bdf54b3B595C545Ced39Aa79583aa0`; live txs (`LIVE_FUNCTION_MATRIX:38-49`): create `0x0d8757a1…0903`, buy `0xb6bb0e03…6e35`, sell `0x4f95fda9…33a2`, redeem floor `0x8b26a026…e895`, sync revenue `0x81ee920f…5884`, graduate `0x315e08c5…12cc`. README (line 432) is candid: "Not run on chain, and deliberately: the launchpad, swap router and derivatives desk each need a venue... on a testnet those are mocks whichever chain they sit on" — the later run above used mocks and `deployments/84532-0xc591….json` records it under `extended`.

**Weaknesses / gaps.**
1. **No AMM of its own.** Graduation hands liquidity to an external `ILiquidityDeployer`; only a mock exists. For a fully on-chain NFT the pool must be in-protocol.
2. **Shared balance across launches** — the code mitigates (clamp, zeroed approvals) but a single accounting slip drains other launches' raises. `ceilDiv` dust also accumulates in the contract with no sweep.
3. Owner can change `feeSplit` mid-launch (up to 3%); `setLiquidityDeployer` affects only new launches but is still governance.
4. One launch per agent, ever; no cancel/refund path for a launch that never graduates (the curve just stays open; `sell` always works).
5. `boughtInWindow` is in net quote, not gross; `quoteBuy`/`quoteSell` ignore `curveSupply` exhaustion and `startsAt`.
6. `uint128` reserves cap quote and base at ~3.4e38 base units (fine for 18-decimal supplies up to 3.4e20 tokens).
7. The agent-leg fee goes to the agent's 6551 account — in the unified design this should go to the NFT's vault.

**Verdict: adapt.** Keep the constant-product-over-virtual-reserves maths, the rounding discipline, the time-priced anti-snipe tax with the fee clamp, the "launchpad holds the whole supply" rule, and fee routing into a redemption treasury. Replace `ILiquidityDeployer` with the unified token's own per-NFT pool (IPSEITY-style), isolate per-launch balances (or per-launch contract via CREATE2), and pin fees at creation instead of `Ownable2Step`.

---

## 4. `AgentToken` — `contracts/market/AgentToken.sol` (149 lines, 5,369 B)

**Purpose.** Fixed-supply ERC-20 + ERC-20 Permit with an ERC-7641-style burn-to-redeem treasury. Lines 16-32:

> "A pump.fun-style token is backed by nothing... This token's price cannot go below `treasury / totalSupply`, because at any lower price anyone can buy tokens, burn them, and take out more than they put in. The floor is not a promise or a buyback programme someone has to remember to run — it is an arbitrage that enforces itself... Burning is pro-rata over `totalSupply`, so redeeming never dilutes the remaining holders: the floor per token is invariant across a redemption, and strictly increasing in revenue."

**API.**
```solidity
constructor(string name_, string symbol_, IERC20 quote_, address anima_, uint256 agentId_,
            uint256 supply_, address supplyRecipient_)   // mints supply_ once; no mint function
function contribute(uint256 amount) external nonReentrant          // permissionless, pulls QUOTE
function sync() external nonReentrant returns (uint256 recognised) // recognise plain transfers
function redeem(uint256 amount) external nonReentrant returns (uint256 payout)
function floorPerToken() external view returns (uint256)           // quote units per WHOLE token, ×1e18
function previewRedeem(uint256 amount) external view returns (uint256)
IERC20 immutable QUOTE; address immutable ANIMA; uint256 immutable AGENT_ID; uint256 treasury;
```
Events `RevenueReceived(from, amount, treasury)`, `Redeemed(holder, burned, received, treasury)`; errors `ZeroAmount`, `NothingToRedeem`.

**Design decisions quoted.** QUOTE is an ERC-20 by design (lines 41-43): "supporting native currency here would mean a payable surface on a token contract, and every chain has a wrapped equivalent." Treasury is tracked explicitly (lines 50-52): "so a stray transfer of the quote asset cannot silently move the floor and a donation-based rounding attack has nothing to grip." `redeem` computes `payout = treasury * amount / supplyBeforeBurn` (lines 117-130). `floorPerToken` (lines 132-143) records a real bug: "A naive `treasury * 1e18 / totalSupply` silently truncates to zero for realistic parameters — a 6-decimal quote like USDC against a 1e27 supply puts the per-base-unit floor at 1e-20... Quoting per whole token instead of per base unit recovers the missing 18 decimals. `mulDiv` carries the 512-bit intermediate." (`SECURITY.md:116-120`, commit `128c078`.)

**Invariants** (`SECURITY.md:46-48`): no mint function; treasury explicit; redemption neutral for remaining holders (floor per token never decreases — rounding is in their favour).

**Tests** (`test/Launchpad.test.ts:167-228`): "routes a share of every trade into the treasury, raising the floor" (1,000 USDC buy → 10 USDC treasury, 10 to agent account, 10 to protocol), "pays out pro-rata on burn and leaves the floor per token unchanged" (asserts `floorAfter ≥ floorBefore` and drift < 1e-6 relative), "recognises revenue sent by a plain transfer only when synced", "has no mint function, so the floor cannot be diluted" (ABI assertion). Plus the two `ExactERC20` tests and 4 RevenueRouter tests use it as the treasury.

**Weaknesses.** Dust holders cannot exit while `payout == 0`; `ERC20Permit` domain uses the token name (fine); no `burn` without redeem; no hooks for the unified NFT's vault (treasury is the token's own balance). The token is deployed at a CREATE2 address with `salt = launchId` from the launchpad, so addresses are predictable.

**Verdict: reuse-verbatim** (as the launchpad's issued token) — it is self-contained, ownerless and small. The only edit for the unified protocol is cosmetic (`ANIMA`/`AGENT_ID` naming → token contract / tokenId).

---

## 5. `ILiquidityDeployer` — `contracts/market/ILiquidityDeployer.sol` (23 lines)

```solidity
interface ILiquidityDeployer {
    function deployLiquidity(address token, address quote, uint256 tokenAmount, uint256 quoteAmount,
                             address lpRecipient) external returns (address pool, uint256 lpAmount);
}
```
Comment: "Kept abstract on purpose. Uniswap v2, v3, v4 hooks, Balancer and every L2's local fork all want different call shapes... The launchpad's job ends at 'here are the tokens and the quote, put them in a pool and send the LP position somewhere it cannot be pulled'." Only implementation: `MockLiquidityDeployer` (`contracts/mocks/Mocks.sol:78-98`), which pulls both legs and returns `(address(this), tokenAmount + quoteAmount)`. **Verdict: rewrite** — in the unified design this seam should point at the protocol's own in-NFT pool; keep the "verify the outcome, zero the approvals" caller discipline.

---

## 6. `AgentSwapRouter` — `contracts/market/AgentSwapRouter.sol` (227 lines, 5,519 B)

**Purpose.** Not an AMM. A budgeted, venue-allowlisted *router* that an agent's ERC-6551 account calls to swap through an external DEX under per-token caps its owner set, with output verified by balance delta. Lines 25-45:

> "those limits cap `msg.value`, i.e. *native* currency. An agent calling `swap(USDC -> anything)` moves a million dollars with `value == 0` and sails straight through a native-denominated cap. Token budgets have to be denominated in the token... **Output is verified, not trusted.** The router measures the recipient's balance before and after the venue call and requires the delta to clear `minOut`... Reading a DEX's return value instead is how integrations get drained by a venue that was later upgraded. **Approvals never outlive the call.** ... Dangling approvals are the single most exploited pattern in DeFi."

**Types / API.**
```solidity
struct TokenLimit { uint128 perSwap; uint128 daily; uint128 spentToday; uint64 day; }  // perSwap 0 = not tradeable
struct SwapRequest { uint256 agentId; address tokenIn; address tokenOut; uint256 amountIn; uint256 minOut;
                     uint256 deadline; address venue; bytes venueCalldata; }
constructor(IERC721 agents_, IAnimaSwapView anima_, address owner_)
function setVenue(address venue, bool allowed) external onlyOwner
function limitOf(uint256 agentId, address token) external view returns (TokenLimit memory)
function setLimit(uint256 agentId, address token, uint128 perSwap, uint128 daily) external   // NFT owner
function revokeToken(uint256 agentId, address token) external                                // owner OR guardian
function swap(SwapRequest calldata r) external nonReentrant returns (uint256 amountOut)      // only agent's 6551 account
function remainingToday(uint256 agentId, address token) external view returns (uint256)
IERC721 immutable AGENTS; IAnimaSwapView immutable ANIMA; mapping(address => bool) isVenue;
```
Events `VenueSet`, `LimitSet(agentId, token, perSwap, daily)`, `Swapped(agentId, tokenIn, tokenOut, amountIn, amountOut, venue)`. Errors `NotAgentAccount, NotAgentOwner, AgentNotActive, VenueNotAllowed, TokenNotTradeable, PerSwapCapExceeded, DailyCapExceeded, SlippageExceeded, Expired, SameToken, VenueCallFailed(bytes), ZeroAmount`.

**`swap` (lines 164-204).** Caller must equal `ANIMA.accountOf(agentId)`; deadline; non-zero; `tokenIn != tokenOut`; venue allowlisted; `statusOf == Active` ("A paused or disputed agent must not be able to move funds, or the guardian's kill switch is decorative"); `_chargeLimit`; snapshot `inputBefore = tokenIn.balanceOf(this)`; pull `amountIn` from the account; snapshot `before = tokenOut.balanceOf(this)`; `forceApprove(venue, amountIn)`; raw `venue.call(venueCalldata)`; `forceApprove(venue, 0)` unconditionally; `amountOut = delta ≥ minOut`; send output to the account; return only `balanceOf(this) - inputBefore` of unspent input. The pre-call snapshot fixes a testnet finding (`docs/TESTNET_AUDIT_2026-09-02.md:29-33`): "`AgentSwapRouter` previously refunded its entire input-token balance to the next successful caller... The router now snapshots its pre-call input balance and refunds only input attributable to the current swap."

`_chargeLimit` (lines 206-218): `today = block.timestamp / 1 days`; spent resets when the day index changes. Note: the struct comment says "rolling per-day" but the implementation is a **UTC calendar-day bucket**, not a rolling 24 h window.

**Access control.** Venue list: contract owner (governance). Limits: NFT owner. Emergency revoke: owner or guardian. Swap: only the agent's own account (so the account's session-key leash applies upstream).

**Tests** (`test/SwapRouter.test.ts`, 11): "swaps within the limit and delivers the output to the agent's account", "caps a single swap — the gap that a native-only spending limit leaves wide open", "caps daily volume across several swaps and resets the next day", "refuses a token the owner never allowed", "refuses an unlisted venue", "catches a venue that under-delivers, by measuring the balance rather than trusting it" (`MockVenue.setShortChange`), "leaves no standing approval, and returns unspent input" (`partialSwap`), "does not gift a pre-existing router balance to the next swapping agent", "stops trading entirely while the agent is paused", "refuses a caller that is not the agent's own account", "lets a guardian cut off a token without waking the owner".

**On chain.** Base Sepolia swapRouter `0x6DF966056DB85F39A97F0EC8a6928c0E281edeb8`, venue `0x8dA10Ebb…773c` (a `MockVenue`), test tokens `0xea4CF66B…ECB1` / `0x37af9513…d401`; txs "Bounded account swap" `0x24aea6cc…7cb42`, "Revoke token permission" `0x932bd9ba…2ff18`.

**Weaknesses.** (1) Needs an external DEX; none is on-chain in this repo. (2) Governance-owned venue allowlist is a central chokepoint — contrary to the unified goal's "no admin" leaning. (3) `minOut` is chosen by the (possibly session-keyed) caller; with `minOut = 0` and venue calldata that routes output elsewhere, the delta check passes with zero output and the budgeted `amountIn` leaves — the budget bounds the loss but does not prevent it. (4) ERC-20 only; no native-ETH leg. (5) Inactive (never activated) agents cannot swap.

**Verdict: adapt.** For the unified NFT the *swap itself* should be an in-protocol per-token pool; this router's ideas — per-token budgets, delta-verified output, same-tx approval zeroing, guardian revoke, pre-call balance segregation — belong in the NFT's vault/account spending policy rather than in a separate governance-owned contract.

---

## 7. `AgentDerivativesDesk` — `contracts/market/AgentDerivativesDesk.sol` (289 lines, 6,706 B)

**Purpose.** A leverage leash: lets an agent's account trade perps through a governance-allowlisted venue adapter under per-market `maxNotional`, `maxMarginAtRisk`, `maxLeverageX100` and a portfolio-wide `maxTotalMarginAtRisk`, all checked **after** the venue call against what the position actually became. Lines 38-63 argue the gap ("An agent with a $1,000 daily budget can post $1,000 of margin and carry $50,000 of notional exposure") and the trust model: "`marginAtRisk` is measured, not declared... `positionNotional` is read from an allowlisted adapter after the venue call. It is only as honest as the adapter... Leverage is derived from those two." And the limit: "It does not prevent a loss, monitor a position between trades, or liquidate anything."

**Types / API.**
```solidity
interface IPerpVenueAdapter {
    function executeTrade(address account, bytes32 market, bytes calldata venueData) external;
    function positionNotional(address account, bytes32 market) external view returns (uint256);
}
struct MarketLimit { uint128 maxNotional; uint128 maxMarginAtRisk; uint16 maxLeverageX100; bool allowed; }
struct Position { uint128 marginAtRisk; uint128 lastNotional; uint64 lastTradeAt; }
struct TradeRequest { uint256 agentId; bytes32 market; address venue; uint256 marginIn; uint256 deadline; bytes venueCalldata; }
constructor(IERC20 quote_, IERC721 agents_, IAnimaDeskView anima_, address owner_)
function setVenue(address venue, IPerpVenueAdapter adapter) external onlyOwner   // zero adapter removes
function limitOf(uint256, bytes32) external view returns (MarketLimit memory)
function positionOf(uint256, bytes32) external view returns (Position memory)
function setLimit(uint256 agentId, bytes32 market, uint128 maxNotional, uint128 maxMarginAtRisk, uint16 maxLeverageX100) external // NFT owner; 100 = 1x; 0 closes; <100 rejected
function setPortfolioLimit(uint256 agentId, uint128 maxTotal) external
function haltMarket(uint256 agentId, bytes32 market) external          // owner or guardian
function trade(TradeRequest calldata r) external nonReentrant returns (uint256 notionalAfter)  // only agent account
function leverageX100(uint256 agentId, bytes32 market) external view returns (uint256)
mapping(address => IPerpVenueAdapter) adapterOf; mapping(uint256 => uint128) totalMarginAtRisk, maxTotalMarginAtRisk;
```
Events `VenueSet`, `LimitSet`, `PortfolioLimitSet`, `Traded(agentId, market, venue, marginIn, marginOut, notionalAfter, marginAtRisk)`. Errors `NotAgentAccount, NotAgentOwner, AgentNotActive, MarketNotAllowed, VenueNotAllowed, NotionalCapExceeded, MarginCapExceeded, PortfolioCapExceeded, LeverageCapExceeded, VenueCallFailed, Expired, BadLeverage`.

**`trade` (lines 217-281).** Pull `marginIn`, approve the venue, `try adapter.executeTrade(account, market, calldata)` (routing through the adapter is what binds the checked market to the executed one — `docs/TESTNET_AUDIT_2026-08-31.md:28-30`), zero approval, return whatever came back, compute `consumed`/`refunded`, update `marginAtRisk` and `total`, read `notionalAfter`, enforce caps; refuse a position with notional but zero measured margin ("either cross-margined from elsewhere or an adapter reporting nonsense. Either way it is unbounded leverage... refused rather than divided by zero"). Note the desk uses `try/catch` here only to re-wrap the revert reason — it does not swallow failures, so the gas-estimation trap (§10) does not apply.

**Tests** (`test/Derivatives.test.ts`, 12, with `MockPerpVenue`): "refuses a market the owner never opened", "permits a trade inside the notional and leverage caps" ($100 margin → $1,000 notional at 10x), "binds adapter execution to the market whose limits are checked", "catches leverage the agent did not declare, by asking the venue what happened", "caps absolute notional independently of leverage", "caps the collateral that can be put at risk", "caps collateral across the whole portfolio, not just per market", "refuses a position the desk cannot see collateral behind", "returns unconsumed collateral to the agent rather than holding it", "stops trading when the agent is paused, and when a guardian halts the market", "refuses an unlisted venue and a caller that is not the agent's account", "rejects a leverage limit below 1x as a configuration error".

**On chain.** Base Sepolia desk `0x1177cFBe651AcC4920B64a2c002739b3fbCf85f6`, `MockPerpVenue` `0x686B2a229C568b1292C7EFB4A6621E06C71feB1D`; txs open `0x805be0dc…ba11`, close `0x52c24819…9ff0`, halt/disable `0x5088cf56…fdb5` / `0xf67e6585…5e34`.

**Weaknesses.** Entirely dependent on a trusted, governance-set adapter; positions liquidated or moved outside `trade` are invisible until the next trade; `marginAtRisk` is approximate when the venue returns PnL. No real adapter exists.

**Verdict: drop** for the unified goal (no perps venue in scope, requires trusted adapters and governance). Keep only as a documented pattern ("verify against what the position became") if a leveraged venue is ever added.

---

## 8. `FiatMintGateway` — `contracts/market/FiatMintGateway.sol` (150 lines, 3,842 B)

**Purpose.** Lets an allowlisted off-chain payment processor settle a completed card/bank payment by minting an ANIMA, deploying its ERC-6551 account and funding it with a dollar stablecoin from a reserve wallet, atomically. Lines 15-21: "Card and bank payments cannot be verified by the EVM. A deliberately explicit processor role is therefore the trust boundary... Unique settlement ids make webhook retries harmless, and `minimumNetAmount` protects the customer's quote." Commit `f3881d7` ("fix: require dedicated fiat payment processor") hardened the role.

**API.**
```solidity
struct Purchase { bytes32 settlementId; address recipient; uint256 cashAmountUsdCents; uint256 stableAmount;
                  uint256 minimumNetAmount; uint16 feeBps; string agentURI; bytes32 manifestHash;
                  ModelIdentity model; BrainShard[] shards; SealPolicy seal; MetadataEntry[] metadata; }
constructor(IAnima anima_, IERC20 ausd_, address fundingSource_, address feeRecipient_, address owner_)
function setProcessor(address processor, bool allowed) external onlyOwner
function setFeeRecipient(address recipient) external onlyOwner
function settleAndMint(Purchase calldata purchase) external onlyProcessor nonReentrant
    returns (uint256 agentId, address agentAccount, uint256 netAmount)
uint16 constant MAX_FEE_BPS = 1_000; IAnima immutable ANIMA; IERC20 immutable AUSD; address immutable FUNDING_SOURCE;
address feeRecipient; mapping(address => bool) isProcessor; mapping(bytes32 => bool) settled;
```
Event `FiatPurchaseSettled(settlementId, agentId, recipient, cashAmountUsdCents, grossStableAmount, feeAmount, netStableAmount, agentAccount)`; errors `NotProcessor, InvalidSettlementId, SettlementAlreadyUsed, InvalidAmount, FeeTooHigh, NetAmountBelowMinimum, ZeroAddress`. Flow (lines 105-149): validate, compute `fee = stable*feeBps/10_000`, `net ≥ minimumNetAmount`, mark settled ("Effects precede external calls; any downstream revert rolls this marker back"), `ANIMA.mintAgent(...)`, `ANIMA.deployAccount(agentId)`, `AUSD.transferFromExact(FUNDING_SOURCE, agentAccount, net)` and `(…, feeRecipient, fee)`.

**Tests** (`test/FiatMintGateway.test.ts`, 3, run with `impl: "monolith"` explicitly): "atomically mints to the buyer and puts net aUSD in its account" ($1,000 → 975 aUSD net at 250 bps, 25 fee, account has code), "rejects replayed settlements and unauthorized callers", "enforces the customer minimum and permanent fee ceiling". No deployment address recorded on any chain.

**Verdict: drop.** It is a server-trusting bridge by definition (README §14: "The contract does **not** pretend a blockchain can verify a bank payment"), which contradicts the unified goal's "no server". The only reusable idea is the idempotent `settlementId` + `minimumNetAmount` pattern for any sponsored mint.

---

## 9. `RevenueRouter` — `contracts/economy/RevenueRouter.sol` (203 lines, 5,811 B; ownerless)

**Purpose.** A per-agent revenue waterfall (operating account / redemption treasury / bond / referrer / commons) whose policy cannot be changed under an obligation already accepted. Lines 20-27: "Integrations quote `revenueCommitment`, commit it in their order/voucher, then call `routeExpected`. A pending policy has a mandatory delay, and a token transfer makes the old owner's policy stale immediately. The operating share receives every rounding remainder so configured peripheral shares can never silently exceed the gross amount." Added in `86879ee` and fixed in `9c70c68` ("fix: preserve committed revenue policies") following `docs/MICROECONOMY_RESEARCH_2026-09-02.md:24-27` ("The highest-priority engineering gap is revenue routing... only the launchpad treasury leg automatically calls `contribute`").

**Types / API.**
```solidity
struct Policy { address configuredBy; address treasury; address commons; uint16 treasuryBps; uint16 bondBps; uint16 referralBps; uint16 commonsBps; }
struct PendingPolicy { Policy policy; uint64 activatesAt; }
constructor(IERC20 asset_, IERC721 agents_, IRevenueAgentView anima_, BondVault bonds_)
function policyOf(uint256 agentId) public view returns (Policy memory)        // deleted (all-zero) if configuredBy != current owner
function pendingPolicyOf(uint256 agentId) external view returns (PendingPolicy memory)
function policyHash(uint256 agentId) public view returns (bytes32)             // keccak(abi.encode(policyOf))
function revenueCommitment(uint256 agentId, address referrer) public view returns (bytes32)
function proposePolicy(uint256 agentId, address treasury, address commons, uint16 treasuryBps, uint16 bondBps, uint16 referralBps, uint16 commonsBps) external // NFT owner
function activatePolicy(uint256 agentId) external                              // anyone, after POLICY_DELAY, owner unchanged
function routeExpected(uint256 agentId, uint256 amount, address referrer, bytes32 expectedCommitment) external nonReentrant
uint16 constant BPS = 10_000; MIN_OPERATING_BPS = 5_000; MAX_REFERRAL_BPS = 500; uint64 constant POLICY_DELAY = 2 days;
```
Storage: `_policies`, `_pending`, `_policyVersions[agentId][policyHash]`. Events `PolicyProposed(agentId, policyHash, activatesAt)`, `PolicyActivated`, `RevenueRouted(agentId, payer, policyHash, gross, operating, treasury, bond, referral, commons, referrer)`; errors `NotAgentOwner, PolicyNotReady, InvalidPolicy, StalePolicy(expected, actual), ZeroAmount, MissingReferrer, ZeroAddress`.

**Commitment scheme** (lines 198-202): `commitment = policyHash XOR keccak256(abi.encode(chainid, address(this), agentId, referrer))`. "XOR keeps the policy hash recoverable at settlement while the domain, agent and referrer remain cryptographically bound to the commitment." `routeExpected` recovers `expectedPolicyHash = expectedCommitment ^ _commitment(0, agentId, referrer)`, loads `_policyVersions[agentId][hash]`, and accepts iff the stored version re-hashes to that hash and (`configuredBy == 0` — the implicit default — or `configuredBy == current owner`). Comment (lines 163-164): "The all-zero policy is the implicit default and therefore has no stored version. Configured policies remain usable after replacement, but not after ownership transfer." Then: pull `amount` exactly; treasury leg via `forceApprove(treasury) + IRevenueTreasury(treasury).contribute()`; bond leg via `BONDS.deposit(agentId, amount)`; referral and commons by direct transfer; `operating = amount - legs` to `ANIMA.accountOf(agentId)`.

**Validation** (`proposePolicy`): `treasury+bond+referral+commons ≤ 5,000 bps`, `referral ≤ 500`, non-zero addresses where a leg is non-zero.

**Tests** (`test/RevenueRouter.test.ts`, 4): "timelocks a policy and conserves every unit across the waterfall" (20/10/5/5% → 60 to account, 20 treasury, 10 bond, 5 referrer, 5 commons), "invalidates the seller's policy on transfer and rejects a stale quote", "routes an accepted commitment after a replacement policy activates", "enforces an operating majority and caps referral extraction".

**Branch note.** `origin/codex/fix-high-priority-bug-in-revenuerouter.sol` holds the first attempt at the same fix: a 5-argument `routeExpected(agentId, amount, referrer, committedPolicyHash, expectedCommitment)` with `_activatedPolicies` and a plain keccak commitment. `main` replaced it with the XOR design so the commitment stays one `bytes32`. Nothing to merge.

**Weaknesses.** (1) Not deployed anywhere; 4 tests only. (2) Any historic activated policy of the *current* owner is accepted for any new payment — a settlement caller who prefers an old policy with a higher `referralBps` can use it; the design relies on the integrating escrow snapshotting the commitment when the obligation is created, which no contract in this repo currently does (WorkEscrow and InferenceMeter pay the account directly). (3) `IRevenueTreasury.contribute` must pull via `transferFrom` — matches `AgentToken` only. (4) Ties to `BondVault` and the 6551 account as the operating sink.

**Verdict: adapt.** The pattern (owner-proposed, timelocked, transfer-staled, commitment-bound split with a guaranteed operating majority and rounding to the operator) is a good fit for routing a unified NFT's revenue (pool fees, launchpad fees, messaging postage) into its vault/treasury. Replace the bond leg with the unified vault and the 6551 account with the NFT's account.

---

## 10. `WorkEscrow` — `contracts/work/WorkEscrow.sol` (517 lines, 11,346 B)

**Purpose.** Hire-an-agent escrow with reserved collateral, delivery commitment, an independent validator and customer-attested feedback. State machine (`docs/ARCHITECTURE.md:170-186`): `Offered → Active → Delivered → Settled`, with `Cancelled` (before acceptance) and `Disputed → Settled`. Contract comment (lines 32-48): "in any two-party escrow, *both* sides can grief the other by simply doing nothing. So every wait has a timer and every timer has a default winner."

**Types.**
```solidity
enum JobState { None, Offered, Active, Delivered, Disputed, Settled, Cancelled }
struct Job { uint256 agentId; address client; address payee; uint128 amount; uint128 coverage; uint64 deadline;
             uint64 reviewWindow; uint64 deliveredAt; JobState state; address validator; bytes32 specHash;
             bytes32 deliveryHash; bytes32 validationRequest; }
```

**API.**
```solidity
constructor(IERC20 asset_, IAnima anima_, BondVault bonds_, ReputationRegistry reputation_, ValidationRegistry validation_, address owner_, uint16 feeBps_, address feeRecipient_)
function setFee(uint16, address) external onlyOwner
function jobOf(uint256 jobId) external view returns (Job memory)
function offerJob(uint256 agentId, uint256 amount, uint256 coverage, uint64 deadline, uint64 reviewWindow, address validator, bytes32 specHash, string calldata specURI) external nonReentrant returns (uint256 jobId)
function cancelOffer(uint256 jobId) external nonReentrant                       // client, while Offered
function acceptJob(uint256 jobId) external nonReentrant                         // owner (bonded) / owner or operator (unbonded)
function deliver(uint256 jobId, bytes32 deliveryHash, string calldata deliveryURI) external   // any controller
function acceptDelivery(uint256 jobId, int128 rating, uint8 ratingDecimals, string calldata tag, string calldata feedbackURI, bytes32 feedbackHash) external nonReentrant  // client
function claimUnreviewed(uint256 jobId) external nonReentrant                   // anyone, after review window
function claimMissedDeadline(uint256 jobId) external nonReentrant               // anyone, after deadline while Active
function dispute(uint256 jobId, bytes32 contentHash, string calldata reasonURI) external nonReentrant  // client, in window
function resolveDispute(uint256 jobId) external nonReentrant                    // anyone, once answered
function resolveStaleDispute(uint256 jobId) external nonReentrant               // anyone, after validator expiry
uint64 constant MIN_REVIEW_WINDOW = 1 hours; MAX_REVIEW_WINDOW = 30 days; uint16 constant MAX_FEE_BPS = 1000;
mapping(bytes32 => uint256) jobOfValidation;
```
Events `JobOffered(jobId, agentId, client, amount, coverage, deadline, validator, specHash, specURI)`, `JobAccepted(jobId, agentId, payee)`, `JobCancelled`, `JobDelivered(jobId, deliveryHash, deliveryURI)`, `JobSettled(jobId, paidTo, amount, fee, agentPaid)`, `JobDisputed(jobId, validationRequest, reasonURI)`, `JobSlashed(jobId, agentId, coverage)`, `FeeSet`, `FeedbackSkipped`. Errors: `BadState, NotClient, NotAgentController, DeadlinePassed, DeadlineNotPassed, ReviewOpen, ReviewClosed, BadReviewWindow, FeeTooHigh, ZeroAmount, ZeroAddress, VerdictPending, NotAgentPrincipal, ValidatorOwnsAgent, OnlyOwnerMayPledge, SelfHire, ValidatorNotRegistered, ClientIsValidator`.

**Load-bearing rules and their comments.**
- `offerJob` reserves nothing (lines 244-247): "otherwise anyone could pin an agent's entire bond with a stream of offers it never wanted — a denial-of-service on the agent's ability to earn." Bonded jobs require a registry-recognised validator (lines 208-212): "A freshly-generated key is indistinguishable on-chain from an independent validator... Unbonded jobs stay permissionless: there is nothing to steal."
- `acceptJob` (lines 254-263): "Pledging capital is the owner's decision alone. A tenant is a controller for the purpose of *operating* an agent, and an operator is the owner's staff — but letting either bind the bond means anyone who rents an agent for an hour, or any insider, can accept a one-wei job pinning the whole stake as coverage and then let it fail." (CRITICAL/HIGH in `7949094` and `f7f86cc`; regressions "refuses a job accepted by a rental tenant", "refuses a job whose named validator holds the agent".) Self-hire refused; payee snapshotted ("Reading it at settlement would let an owner redirect a job's proceeds after the work was already commissioned").
- `_fileFeedbackSafely` (lines 319-351) — the famous bug: "Filing feedback is deliberately NOT wrapped in try/catch... `eth_estimateGas` binary-searches for the *cheapest* gas at which the call succeeds, and with a swallowing catch the cheapest success is the one where the inner call runs out of gas and the feedback is skipped. Every wallet-estimated settlement would silently lose its reputation record, and nothing would look wrong. A test caught it; a production deployment might not have." This is `CLAUDE.md` security invariant 5 and `SECURITY.md:109-115`.
- `dispute` (lines 390-394): registry key `VALIDATION.requestKeyOf(address(this), keccak256(abi.encode(jobId, contentHash)))` — "The registry namespaces by opener, so this key cannot be squatted by a third party watching the mempool" (HIGH in `f724b82`; regression "cannot be blocked by a third party squatting the validation request key"). Validator expiry is hard-coded `block.timestamp + 14 days`; verdicts pass at `ValidationRegistry.PASS_THRESHOLD = 50`.
- `_refundClient` (lines 472-474): "Slashing happens after the reservation is released so the vault draws from free collateral first, leaving other clients' reserved coverage intact." `_releaseHold` (lines 488-490): "Both calls are clamped to the vault's actual state... releasing more than exists would revert and strand the escrowed payment forever."
- Feedback weight (lines 509-512): `min(amount, coverage)` — "Otherwise a self-hire with a flash-loaned amount and no coverage buys a maximally-weighted 'customer-attested' score for the cost of the protocol fee."

**Tests** (`test/Accountability.test.ts`): WorkEscrow — "lets a client withdraw an offer the agent never took", "reserves collateral and locks the agent on acceptance", "cannot be forced to lock collateral by an offer it never wanted", "pays the agent's own account and files customer-attested feedback on acceptance" (1% fee; attested score 9500 weighted by 100 USDC), "refunds the client and takes coverage when a deadline is missed" (client receives 100 + 200), "pays the agent when the client simply never reviews"; disputes — "locks the agent into Disputed while a verdict is pending", "pays the agent when the validator passes the work", "refunds the client and slashes when the validator fails the work", "returns everyone's money untouched when the validator never answers" (after 15 days), "refuses a second verdict on the same request", "cannot be blocked by a third party squatting the validation request key", "refuses a verdict from anyone but the named validator". Regression: "caps attested weight at the coverage that actually stood behind the job".

**On chain.** Escrow addresses on every testnet record (Base Sepolia `0xFBA84694…af4A` and `0xB768d0ad…b673`; Sepolia/BSC/Robinhood `0xC6bF11De…4AB9`); `scripts/testnet-scenario.ts:191-233` ran offer (500 aUSD, 1,000 coverage) → accept → attempted mid-job sale refused with `AgentLocked` → deliver → accept with rating 92.00 → attested reputation.

**Branch note.** `origin/claude/nft-standard-ai-agents-2y8ngz` adds, in `acceptJob`, `if (j.client == payee) revert SelfHire(jobId, j.client);` with the comment "The same circle through the agent's own wallet: a job whose client is the account the payout goes to is the agent hiring itself, whoever signed the transactions." `main` lacks this; on `main` the agent's own 6551 account can be the client of a job its owner accepts (money circulates; feedback is weighted by real coverage, and commit `f7f86cc` concedes "a self-hire with genuine collateral still works, and it is visible on-chain as an agent grading itself").

**Weaknesses.** Heavy dependency graph (BondVault, ReputationRegistry, ValidationRegistry, token lock hooks); the agent's own account cannot accept a bonded job autonomously (only the ERC-721 owner may pledge); `offerJob` never checks the agent exists or is Active; URIs (`specURI`, `deliveryURI`, `feedbackURI`) are off-chain pointers (the tests use `ipfs://`); refunds carry no fee while payouts do.

**Verdict: adapt (optional module).** The timer-with-default-winner state machine, deliver-before-review, validator-named-at-open, squat-proof request keys and the no-try/catch rule are all reusable for any "services for hire" layer the unified NFT might offer; the bond/reputation/validation registries would need to be collapsed into the unified vault or dropped.

---

## 11. `InferenceMeter` — `contracts/work/InferenceMeter.sol` (271 lines, 6,037 B; ownerless)

**Purpose.** Prepaid unidirectional payment channels with cumulative EIP-712 vouchers, settling batches of signed receipts. Lines 21-39: "a settlement per call is absurd: the transaction costs more than the inference... The client escrows once; the agent accumulates signed vouchers off-chain, each stating a *cumulative* total; the agent settles on-chain whenever it likes, redeeming only the latest... **The receipts are the interesting part.** Every settlement carries the batch of receipts it covers — request hash, response hash, model hash, and any attestation — and the voucher the client signed commits to exactly that batch. So the record is *bilateral*... **Closing is delayed on purpose.**"

**Types / API.**
```solidity
struct Channel { address client; address token; uint256 agentId; uint128 deposited; uint128 claimed; uint64 closesAt; }
struct Receipt { bytes32 requestHash; bytes32 responseHash; bytes32 modelHash; uint64 units; uint8 attestationKind; bytes32 attestation; }
constructor(IAnimaMeterView anima_, uint64 challengeWindow_)   // EIP712("AnimaInferenceMeter","1")
function channelOf(uint256) external view returns (Channel memory)
function remaining(uint256) external view returns (uint256)
function openChannel(uint256 agentId, address token, uint256 amount) external nonReentrant returns (uint256 channelId)
function topUp(uint256 channelId, uint256 amount) external nonReentrant        // anyone, while not closing
function settle(uint256 channelId, uint256 cumulativeAmount, uint256 deadline, bytes calldata signature, Receipt[] calldata receipts) external nonReentrant returns (uint256 paid)  // any agent controller
function voucherDigest(uint256 channelId, uint256 cumulativeAmount, bytes32 workRoot, uint256 deadline) external view returns (bytes32)
function workRootOf(Receipt[] calldata receipts) external pure returns (bytes32)   // keccak256(abi.encode(receipts))
function requestClose(uint256 channelId) external                               // client
function close(uint256 channelId) external nonReentrant returns (uint256 refunded)   // anyone after window
uint64 immutable CHALLENGE_WINDOW; mapping(uint256 => bytes32) workLog;  // per-agent hash chain
```
Voucher typehash: `Voucher(uint256 channelId,uint256 cumulativeAmount,bytes32 workRoot,uint256 deadline)`; SDK mirrors `VOUCHER_TYPES`, `voucherDomain`, `workRoot` (`sdk/src/index.ts:457-518`). Events `ChannelOpened`, `ChannelFunded`, `CloseRequested`, `ChannelClosed`, `Settled(channelId, agentId, cumulativeAmount, paid, workRoot, workLogRoot)`, one `WorkReceipt(agentId, channelId, requestHash, responseHash, modelHash, units, attestationKind, attestation)` per receipt. Errors `NoSuchChannel, NotClient, NotAgentController, ChannelClosing, ChannelNotClosing, ChallengeWindowOpen, VoucherExpired, NotMonotonic, ExceedsDeposit, WorkRootMismatch (declared, unused), InvalidSignature, ZeroAmount`.

**`settle` (lines 185-222).** Controller-only; deadline; `cumulative > claimed` and `≤ deposited`; `workRoot = keccak256(abi.encode(receipts))`; verify the client's signature with `SignatureChecker` (ERC-1271 aware, not ERC-6492); pay the delta to `ANIMA.accountOf(agentId)` ("an agent that funds itself can pay for its own inference, top up its own bond, and buy its own tools"); advance `workLog[agentId] = keccak256(abi.encode(prev, channelId, workRoot, cumulativeAmount))`; emit receipts. `close` sets `deposited = claimed` so later settlements fail `ExceedsDeposit`.

**Tests** (`test/Meter.test.ts`, 9; fixture `CHALLENGE_WINDOW = 3 days`): "pays the delta between cumulative vouchers, into the agent's own account", "makes a superseded voucher worthless without any nonce bookkeeping", "refuses to pay beyond what the client actually escrowed", "binds the voucher to the exact batch, so an agent cannot invent work", "refuses a settlement from anyone but the agent's controller", "rejects an expired voucher", "advances a per-agent work log that binds every settled batch" (recomputes the chain off-chain), "makes the client wait out a challenge window before refunding", "refuses a close request from anyone but the client".

**On chain.** Meter at `0x3657704749d06d38B222024393cB35d3D83c7A58` (Base Sepolia historical), `0x6b15AD51…0879` (Base/Unichain second record), `0xA9c0f8ae…4d8f` (Sepolia/BSC/Robinhood). `scripts/testnet-modules.ts:167-220` opened a 1,000 aUSD channel and settled cumulative 120 then 300 aUSD; replay of the 120 voucher refused. Txs: open `0x8445846b…cc34`, settle `0xc74c6281…9cc3`.

**Weaknesses.** `openChannel` validates neither the agent's existence nor the token; `requestClose` cannot be cancelled; receipts are emitted as events (O(n) logs per settlement); client signature cannot be ERC-6492 (counterfactual client accounts cannot sign); `WorkRootMismatch` is dead code; `CHALLENGE_WINDOW` is immutable and "MUST exceed an agent's settlement batching interval, or honest work goes unpaid" (`DEPLOYMENT.md:179`).

**Verdict: adapt.** This is the cleanest generic building block in the area: a token-agnostic, ownerless payment channel with bilateral receipts. For the unified NFT it could meter paid messaging, API access or any per-call service, paying into the NFT's vault instead of the 6551 account; the only ANIMA coupling is `isController`/`accountOf`.

---

## 12. Web UI delivery and ownership verification

Two surfaces exist, and **neither exposes any function from this area** (no market, launchpad, swap, escrow or meter UI exists anywhere in the repo — only the machine-readable function index `public/anima-functions.json`, 233,748 bytes covering 29 contracts incl. all eight area contracts, served to agents via `llms.txt`).

1. **"Sanctuary" — a static Vite site on GitHub Pages** (`index.html`, `src/main.js`, `src/style.css`; `vite.config.js` sets `base: './'` "so the same build works on localhost, an IPFS directory, and GitHub Pages"). It is served from GitHub Pages (`package.json` homepage `https://venividis.github.io/Cutting-edge-technologically-advanced-NFT/`; README §"Put the Sanctuary online from GitHub"), hard-codes the collection address `0xb3d92c766e3cb356db381feb21958a9ebb974365` and the RPC `https://sepolia.base.org` (`src/main.js:120,141`), and loads Google Fonts. Ownership verification is **client-side and read-only**: `connect()` calls `walletClient.requestAddresses()` and switches/adds Base Sepolia; `discover()` reads `totalMinted` then calls `ownerOf(id)` for every id and keeps those equal to the wallet address (`src/main.js:178`). Nothing is gated server-side (there is no server); writes (`mintAgent`, `deployAccount`, `setStatus`) are `simulateContract` + `writeContract` and are authorised by the token contract itself. Metadata minted from the Sanctuary is a self-contained `data:application/json` + inline SVG URI (`metadataURI`, `src/main.js:147-154`) so wallets need no server or IPFS.

2. **`AnimaWeb3Renderer` — an ERC-4804 `web3://` manual-mode contract** (`contracts/web/AnimaWeb3Renderer.sol`, 138 lines; deployed on Base Sepolia at `0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd`, history `0xbD714258…3A29`, `0x1E07De29…5bC8`; reachable as `https://<renderer>.sep.w3link.io/token/<id>/live` per `docs/DEPLOYMENT.md:148-152`). `resolveMode()` returns `"manual"`; the `fallback(bytes calldata path)` serves `/` (usage page), `/token/{id}/live` (the console) or a not-found page, built with `string.concat` from `ANIMA.ownerOf` / `accountOf` reads (lines 37-47). The page embeds a `<script type="module">` that imports viem from **`https://esm.sh/viem@2.55.19`** and uses hard-coded public RPCs (`sepolia.base.org`, `ethereum-sepolia-rpc.publicnode.com`) — i.e. the HTML is on chain but the JS runtime and RPC are external. **It does not gate on ownership at all**: anyone can open any token's page; "CONNECT WALLET" just enables writes, every write is simulated first, and the token contract's own `onlyOwner`/controller checks are the only access control. It shows owner, 6551 account, status, fingerprint, model, brain root/epoch, seal, manifest URI, lock state; offers deploy-account, status, guardian and operator buttons; and an "ADVANCED" console that can simulate and send **any function on the ANIMA address only** (`parseAbiItem` of a user-typed signature). Tests: `test/Web3Renderer.test.ts` ("serves an ERC-4804 manual-mode live page from token state", "serves usage and not-found pages without reverting"). The renderer is immutable and separate from the token ("lets an existing collection gain a browser without changing token logic").

Summary for the design team: ANIMA's token-side `tokenURI` is a plain off-chain URI (or a `data:` URI the minter supplies); the on-chain website is a *separate* ERC-4804 contract; wallet connection is EIP-1193 via viem; ownership "verification" is a client-side `ownerOf` scan with no page-level gating; and the market/launchpad/swap/escrow/meter modules have no human UI at all.

---

## 13. Branch survey (area-relevant)

47 remote branches. `git diff --stat main...<branch> -- contracts/market contracts/economy contracts/work` is empty for every branch except: `codex/fix-high-priority-bug-in-revenuerouter.sol` (+25/−5 in `RevenueRouter.sol`; superseded, see §9) and `claude/nft-standard-ai-agents-2y8ngz` (+7/−1 in `WorkEscrow.sol`; the `client == payee` self-hire check, see §10). The `build/idfbi-isolated-toolchain-20260904`, `fix/utility-workflows-20260904`, `rebuild/human-interface-20260904` and `upgrade/sanctuary-commons-3d-20260904` branches change tooling/UI only.

---

## 14. Measured numbers (consolidated)

- Bytecode (deployed/init bytes): AgentMarket 9,083/10,663; AgentLaunchpad 16,396/17,260; AgentToken 5,369/7,512; AgentSwapRouter 5,519/5,839; AgentDerivativesDesk 6,706/7,073; FiatMintGateway 3,842/4,355; RevenueRouter 5,811/6,174; WorkEscrow 11,346/12,138; InferenceMeter 6,037/7,251.
- Source lines: AgentMarket 383, AgentLaunchpad 459, AgentToken 149, AgentSwapRouter 227, AgentDerivativesDesk 289, FiatMintGateway 150, ILiquidityDeployer 23, RevenueRouter 203, WorkEscrow 517, InferenceMeter 271 (2,671 total).
- Tests: 279 suite-wide (268 + 11); area files: Market 11, Launchpad 15, SwapRouter 11, Derivatives 12, FiatMintGateway 3, RevenueRouter 4, Meter 9, Accountability 23, ExactERC20 2; 8 area regressions in Regressions.test.ts. README says "25 review findings fixed"; SECURITY says "Twenty-three held up".
- Constants: market fee cap 500 bps; launchpad fee cap 300 bps, fair window ≤ 86,400 s, snipe tax ≤ 9,900 bps; escrow fee cap 1,000 bps, review window 1 h–30 d, validator expiry 14 d; revenue router operating ≥ 5,000 bps, referral ≤ 500 bps, delay 2 d; fiat fee cap 1,000 bps; fixtures: market 250 bps fee + 500 bps royalty, escrow 100 bps, meter challenge window 3 d, bond unbonding 7 d, launch fees 100/100/100 bps.
- Launch fixture bound: virtualQuote 1,000 USDC with 800M of 1B on the curve ⇒ max raise 4,000 USDC.
- Base Sepolia addresses (record `84532-0xc591…json`): market `0x20291F8ea4554eFcC1C115a4834C3f6D2594d3cC`, escrow `0xB768d0ad7F8b7f0Fa79Af38da682F389538cb673`, meter `0x6b15AD51344C178FDfc58e231171D18e18050879`, launchpad `0x5ed9230C9eF2e53B0D26128902e59b02ca701624`, liquidityDeployer (mock) `0x8f2D580F72bdf54b3B595C545Ced39Aa79583aa0`, swapRouter `0x6DF966056DB85F39A97F0EC8a6928c0E281edeb8`, swapVenue (mock) `0x8dA10Ebb9Bbb522af79f5Acd76Dff7e67730773c`, derivatives `0x1177cFBe651AcC4920B64a2c002739b3fbCf85f6`, perpVenue (mock) `0x686B2a229C568b1292C7EFB4A6621E06C71feB1D`, web3Renderer `0x9160bE4d943516a2463Ac5f3ABAc5F5cce7975Cd`. Historical record `84532.json` (burner key destroyed): market `0x280296FEaA460354e1d86dAF0f3afCA631927cD0`, escrow `0xFBA84694C5F0Ee5A33fad6D732f327db7644af4A`, meter `0x3657704749d06d38B222024393cB35d3D83c7A58`, token `0x0aeb6f783ebade8fd5ffca74317266d4ea3e71b3`. RevenueRouter and FiatMintGateway: no recorded deployment.
- Gas: no per-function gas numbers are recorded for this area; `test/Gas.test.ts` bounds only the token (diamond ≤ 25% / ≤ 6,000 gas over the monolith) and `deployments/*.json` hold no `gasUsed`.

---

## 15. Reuse verdicts against the GOAL

| Component | Verdict | Why |
|---|---|---|
| `ExactERC20` | reuse-verbatim | 33 lines, ownerless, closes fee-on-transfer bad-debt; already used by every settlement path. |
| `ERC6492` | reuse-verbatim | Needed the moment an ERC-6551 account signs an order or voucher before it is deployed. |
| `AgentToken` | reuse-verbatim | Ownerless fixed-supply ERC-20 with a self-enforcing redemption floor; rename the two immutables. |
| `AgentLaunchpad` | adapt | Keep curve maths, rounding, snipe tax + clamp, whole-supply custody, treasury routing; replace `ILiquidityDeployer` with the in-NFT pool; isolate per-launch balances; pin fees. |
| `ILiquidityDeployer` | rewrite | Seam should target the protocol's own pool, not an external AMM. |
| `AgentMarket` | adapt | Keep EIP-712/6492 settlement, deliver-before-pay, epoch cancel-all, paid-rental lock; swap the three ANIMA pins for one state fingerprint; add on-chain order publication. |
| `AgentSwapRouter` | adapt | Not a swap; its budget/delta/approval-zeroing/guardian ideas belong in the NFT's spending policy. Governance venue list should go. |
| `RevenueRouter` | adapt | Timelocked, transfer-staled, commitment-bound waterfall is the right way to route the NFT's revenue into its vault/treasury. |
| `InferenceMeter` | adapt | Generic ownerless payment channel with bilateral receipts; good for paid messaging/services; pay into the vault. |
| `WorkEscrow` | adapt (optional) | Excellent state machine, heavy registry dependencies; only if "hire the NFT" is in scope. |
| `AgentDerivativesDesk` | drop | Needs trusted perp adapters and governance; out of scope. |
| `FiatMintGateway` | drop | Trusts an off-chain processor by design; contradicts "no server". |

---

## 16. Pitfalls recorded for the design team

1. Never pay a maker before moving the asset; `nonReentrant` does not protect state that lives in other contracts (`AgentMarket.sol:258-264`).
2. Never wrap an optional side effect in `try/catch` on a path wallets gas-estimate (`WorkEscrow.sol:319-332`).
3. Scaled ratios truncate to zero at realistic decimals — quote per whole token with `mulDiv` (`AgentToken.sol:132-143`).
4. A punitive tax stacked on a base fee can exceed 100% and, with a shared contract balance, drains *other* launches — clamp it (`AgentLaunchpad.sol:358-364`).
5. A backdated `startsAt` silently disables a fair window (`AgentLaunchpad.sol:213-216`).
6. Any pluggable that receives approvals for the whole raise must be pinned at creation and its approvals zeroed afterwards (`AgentLaunchpad.sol:74-77, 408-413`).
7. Cancel-all epochs must be part of the signed payload, not a fill-time argument (`AgentMarket.sol:219-225`).
8. Measure venue output by balance delta, snapshot pre-existing balances, and zero approvals in the same transaction (`AgentSwapRouter.sol:179-201`).
9. Registry keys derived from public data get squatted; namespace by opener (`WorkEscrow.sol:390-394`).
10. Only the asset owner may pledge collateral; tenants and operators may operate but not commit capital (`WorkEscrow.sol:254-263`).
11. Weight reputation by capital at risk, not headline price (`WorkEscrow.sol:509-512`).
12. Value-conserving ERC-20 transfers everywhere, or fee-on-transfer tokens create unbacked liabilities (`ExactERC20.sol`).
13. Counterfactual ERC-6551 signers need ERC-6492, and the wrapper must be required to actually deploy the signer before the inner signature counts (`ERC6492.sol:78-85`).
14. "Rolling daily" limits implemented as `timestamp / 1 days` are calendar-day buckets; say which one you mean (`AgentSwapRouter.sol:211`).
15. An on-chain HTML page that imports its JS from a CDN and hard-codes public RPCs is not "no external dependency" (`AnimaWeb3Renderer.sol:128-129`).
