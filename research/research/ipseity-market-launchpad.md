# IPSEITY (`Most-Advanced-NFT-Possible`) — market, pool, launchpad, hooks

Reader report for the merge programme. Repository checkout: `/home/user/Most-Advanced-NFT-Possible` (default branch, HEAD `297e936`, 103 commits, 2026-08-20 → 2026-09-24). Area: `src/Pool.sol`, `src/lib/Curve.sol`, `src/Venue.sol`, `src/Kiln.sol` (Coin, Kiln, Gate), `src/Facet.sol`, `src/LaunchView.sol`, `src/lib/Hook.sol`, `src/V4PositionPlanner.sol`, the supporting `lib/Tick.sol`, `lib/Mul.sol`, `lib/Types.sol`, `lib/Trig.sol`, `lib/Assets.sol`, the pages and desks that serve this area over `web3://` (`PageMarket`, `PagePool`, `PageSwap`, `PageLaunch`, `PageHook`, `DeskTrade`, `DeskLaunch`, `DeskUni`, `Desk` pool client), the Market instrument inside `engine/ipseity.html`, the tests (`test/Pool.t.sol`, `test/V4PositionPlanner.t.sol`, `test/Mul.t.sol`, mocks), the Node verifiers (`tools/verify-pool.mjs`, `verify-curve.mjs`, `verify-launch.mjs`, `fuzz.mjs`, `verify-findings.mjs`, `agents.mjs`, `verify-site.mjs` market/launch sections) and the market entries of `INVARIANTS.md`.

Everything below was read from source (not skimmed). All byte sizes come from the environment's existing `out/solc.json` (solc 0.8.36, viaIR, optimizer 800, cancun — the settings `foundry.toml` pins); no build or test was run, per the rules. Where the docs quote a number from an earlier run I say so.

---

## 0. Headline

IPSEITY's market layer is **one AMM per NFT, inside one contract (`Pool`)**, keyed by token id, where **`ownerOf(id)` is the sole liquidity provider and the only authority** — so selling the NFT sells the exchange (reserves, fee income, curve) with no migration. The price curve is constant product with **anchored virtual reserves** whose concentration is a deterministic function of the token's on-chain 4-D "section word" (the artwork), copied into the market only when the holder calls `syncCurve()`. A **ratcheting bond** freezes every exit and every term for up to a year and survives transfer — the mechanism that makes "selling the token sells the market" a promise a buyer can check.

The launchpad (`Kiln`) deploys ownerless fixed-supply ERC-20s by CREATE2 (sender mixed into the salt), **mines Uniswap v4 hook salts inside a `view` so a browser with no keccak can deploy a hook under `eth_call`**, and ships two hooks: `Gate` (trading opens at T1, liquidity locked until T2, both immutable) and `Facet` (a dynamic LP fee read from the token's section, owner-snapshotted). A read-only `V4PositionManager` planner (`V4PositionPlanner`) ABI-encodes canonical `modifyLiquidities` action plans so the client never needs an ABI coder. `Venue` is a defensive, no-write reader of Uniswap v3 used for a side-by-side comparison page and a generic swap page.

All of it is served from chain twice over: the token's own `tokenURI` HTML (the "instrument", which carries its own keccak/ABI encoder and a Market panel) and the ERC-5219 `web3://` site (`Premises` → Solidity string-built pages → JS held as contract string constants, with every selector computed on chain). There is **no login**: pages are public; the UI compares the connected EIP-6963 account to `ownerOf(id)` and the contracts enforce `onlyHolder` / `mayActAs`.

Two things a design team must know before reusing: (1) the whole market is **unaudited** and the repo says so everywhere; (2) I found an **unguarded re-entrancy path through `closeMarket`** that the repo itself sketched (`test/mocks/PoolReenter.sol`, an unfinished 512-byte `tools/poc-pool.mjs`) but never ran or refuted — details in §13.

---

## 1. Repository context that matters for this area

- **No external Solidity dependencies, ever** (`CLAUDE.md`). Uniswap's `TickMath`, `FullMath`, `Hooks` flag constants, `LPFeeLibrary` flags, the v4 `PoolKey`/`SwapParams`/`ModifyLiquidityParams` structs and the PositionManager `Actions` bytes are all **reproduced locally**. The v4 structs are deliberately duplicated in `Kiln.sol` and `Facet.sol` "for selector identity — do not deduplicate them."
- **EIP-170 is the design force.** `tools/compile.mjs` fails any contract over 24,576 bytes. `LaunchView.sol` exists only because `PageLaunch` hit the ceiling.
- **Tests run without Foundry**: `tools/forge.mjs` executes the `.t.sol` suites on `@ethereumjs/vm` with a cheatcode precompile (`prank`, `expectRevert`, `warp`, `roll`, `deal`, `etch`). No invariant campaigns. The Node verifiers (`tools/verify-*.mjs`, `fuzz.mjs`, `agents.mjs`) run on the same in-process EVM (`tools/evm.mjs`).
- **Custom errors only**, terse nouns. **Comments are load-bearing**: box headers argue the design and record past bugs in past tense; I quote them below where they are the argument.
- **Deployed**: Ethereum Sepolia (`deployments/eth-sepolia.json`) and Base Sepolia (`deployments/base-sepolia.json`); a 2026-09-24 Sepolia "exercise" drove the market end to end (`deployments/eth-sepolia-exercise-2026-09-24.json`).

---

## 2. `src/Pool.sol` — every token is its own exchange (714 lines)

### 2.1 Purpose

A single contract holding one market per token id of the IPSEITY hub. From the header (`Pool.sol:22-33`):

> One market per token. The holder of token #7 is the sole liquidity provider of market #7: they put both sides in, they set the fee, they take the fee, and they can take the inventory back out. Anyone at all may trade against it.
>
> Because the right to that inventory is "whoever ownerOf() says", selling the NFT sells the market — the reserves, the fee income and the price curve go with it in the same transaction, with no migration and no wrapper. That is the whole reason this is a separate contract keyed by token id rather than a fork of Uniswap with an NFT bolted on.

Deliberately not built (`Pool.sol:41-51`): no LP shares ("A single provider per market removes share accounting, the first-depositor donation attack, and every rounding question … It also means this cannot aggregate deep liquidity, which is a real limitation and the honest cost of the design"), no oracle, no TWAP, no flash loan ("A pool whose curve its owner can move on demand has no business being read as a price feed").

### 2.2 Public API (full signatures)

Constructor: `constructor(IIpseity collection_, uint256 maxDeposit_, address admin_, bool enforce)` (`:258`). Reverts `ZeroAddress` on zero admin.

Local interfaces (`:6-18`): `IIpseity { ownerOf(uint256); sectionOf(uint256); userOf(uint256) }` — note `userOf` is declared and **never called** in Pool; `IERC20 { transfer; transferFrom; balanceOf; decimals; symbol }`.

Constants/immutables:
- `IIpseity public immutable collection`
- `uint256 public immutable maxDeposit` — "A ceiling on what any one market can hold, so an unaudited contract cannot quietly accumulate a life-changing amount of somebody's money. Raise it only after review." (`:118-121`)
- `uint256 public constant MAX_OUT_BPS = 5_000` (half the real outgoing reserve), `MAX_FEE_BPS = 500` (5%), `uint64 MAX_BOND = 365 days`, `BPS = 10_000`.

Administration (all `onlyAdmin`, "Everything here is meant to sit behind a Timelock. None of it can move an asset" `:268-272`):
- `function setPaused(bool p) external`
- `function bless(address token, bool ok) external`
- `function setAllowlistEnforced(bool enforce) external`
- `function proposeAdmin(address next) external` / `function acceptAdmin() external` (two-step: "a one-step handover to a mistyped address is a permanent loss of every switch above").

Enumeration (`:302-352`):
- `function openCount() external view returns (uint256)`
- `function openIds(uint256 from, uint256 count) external view returns (uint256[] memory ids)` — a window of ids with an open market, unordered (swap-and-pop on close; the comment records the bug this fixed: a directory that walked ids showed "nothing for its first hundred and twenty pages" when the only markets sat on tokens 3000+).

Market lifecycle (holder only):
- `function openMarket(uint256 id, address base, address quote, uint16 feeBps) external onlyHolder(id)` — refuses `MarketAlreadyOpen`, `ZeroAddress`, `SameToken`, `FeeTooHigh`, `NotBlessed(token)` when `allowlistEnforced`; copies `collection.sectionOf(id)` into `curveWord`; `_reanchor`; `_remember`; emits `MarketOpened`, `CurveSynced`.
- `function closeMarket(uint256 id) external onlyHolder(id)` — requires open, unbonded, **both reserves zero** (`MarketNotEmpty`); `delete marketOf[id]`; `_forget`. "Take the inventory out first; this will not do it for you, because a function that both closes and pays out is a function that can fail halfway." (`:380-383`)
- `function setFee(uint256 id, uint16 feeBps) external onlyHolder(id)` — `FeeTooHigh` above 500 bps; refused while bonded.
- `function bond(uint256 id, uint64 until) external onlyHolder(id)` — `RatchetOnly` if `until <= now` or `until <= bondUntil`; `BondTooLong` past `now + 365 days`.
- `function bondedUntil(uint256 id) external view returns (uint64)`; `function isBonded(uint256 id) public view returns (bool)`.

Liquidity (holder only):
- `function deposit(uint256 id, uint256 amountBase, uint256 amountQuote) external onlyHolder(id) nonReentrant notPaused` — pulls each side with `_pull` and credits **what arrived**; caps only the side being added to (`DepositCap`); `ReserveOverflow` above `Curve.MAX_RESERVE`; `_reanchor` (a no-op under a live bond — see §2.6).
- `function withdraw(uint256 id, uint256 amountBase, uint256 amountQuote, address to) external onlyHolder(id) nonReentrant` — **no `notPaused`** ("Deliberately absent from withdraw()"); refused while bonded; `MoreThanHeld`; state first then `_push`.

Trading (anyone):
- `function quote(uint256 id, bool baseIn, uint256 amountIn) public view returns (uint256 out)` — reverts `TradeTooLarge` when `out > rOut * 5000 / 10000`.
- `function swap(uint256 id, bool baseIn, uint256 amountIn, uint256 minOut, address to, uint256 deadline) external before(deadline) nonReentrant notPaused returns (uint256 out)` — pulls measured input; prices with the **stored** `vBase/vQuote` ("the offsets are read, never rewritten: a trade moves along the curve and does not move the curve"); `TradeTooLarge`; `ZeroAmount`; `ReserveOverflow`; fee stays in the reserve and is tallied in `feesBase/feesQuote`; output is **pushed and measured** (`_pushMeasured`) and `minOut` is checked against what the recipient actually received (`Slippage(got, wanted)`); emits `Swapped`.

Curve:
- `function syncCurve(uint256 id) external onlyHolder(id)` — refused while bonded; copies `sectionOf(id)`; `_reanchor`; emits `CurveSynced(id, word, concentrationBps)`.
- `function pendingCurve(uint256 id) external view returns (bool drifted, uint256 nowBps, uint256 wouldBeBps)` — `(false,0,0)` when not open.

Read:
- `function market(uint256 id) external view returns (address base, address quote, uint112 rBase, uint112 rQuote, uint16 feeBps, bool open, uint256 concentrationBps, uint256 spotBaseInQuote, uint256 maxBaseOut, uint256 maxQuoteOut, uint256 trades, uint64 bondUntil)` — twelve values; "Everything a front end needs in one call." Reports concentration 0 when not open (see pitfall in §2.7). The last two were renamed from `maxBaseIn/maxQuoteIn`: "These are OUTPUT caps and were named as though they were input limits … Renamed rather than repurposed." (`:646-659`)
- Auto-getters: `marketOf(uint256)` (returns the 10 struct fields in declaration order: base, quote, rBase, rQuote, feeBps, open, bondUntil, curveWord, vBase, vQuote), `feesBase`, `feesQuote`, `tradeCount`, `admin`, `pendingAdmin`, `paused`, `allowlistEnforced`, `blessed(address)`, `collection`, `maxDeposit`.

### 2.3 Storage layout

Declaration order (`:116-321`), immutables/constants excluded:

| slot | variable |
|---|---|
| 0 | `mapping(uint256 => Market) marketOf` |
| 1 | `mapping(uint256 => uint256) feesBase` |
| 2 | `mapping(uint256 => uint256) feesQuote` |
| 3 | `mapping(uint256 => uint256) tradeCount` |
| 4 | `address admin` |
| 5 | `address pendingAdmin` |
| 6 | `bool paused`, `bool allowlistEnforced` (packed) |
| 7 | `mapping(address => bool) blessed` |
| 8 | `uint256 _lock` (= 1; 2 while entered) |
| 9 | `uint256[] _openMarkets` |
| 10 | `mapping(uint256 => uint256) _openAt` (index + 1; 0 = absent) |

`struct Market` (`:132-163`): `address base; address quote; uint112 rBase; uint112 rQuote; uint16 feeBps; bool open; uint64 bondUntil; uint256 curveWord; uint128 vBase; uint128 vQuote;` — six storage slots per market (base | quote | rBase+rQuote+feeBps+open | bondUntil | curveWord | vBase+vQuote). The `uint128` width of the offsets is argued in a comment: "An offset is up to eight times a reserve, and a reserve is already a uint112 — so `uint112(rBase * 8)` truncates silently … a cast that can quietly produce a different curve than the one committed is worth four bytes to remove rather than an argument to have." (`:153-160`)

### 2.4 Events and errors

Events: `MarketOpened(id, base, quote, feeBps)`, `MarketClosed(id)`, `Deposited(id, amountBase, amountQuote)`, `Withdrawn(id, amountBase, amountQuote)`, `FeeSet(id, feeBps)`, `CurveSynced(id, word, concentrationBps)`, `CurveAnchored(vBase, vQuote)` ("Emitted wherever the curve is re-anchored, so the one thing a trade must never do is visible in the log when it happens"), `BondSet(id, bondUntil)`, `PausedSet(bool)`, `Blessed(token, ok)`, `AllowlistEnforced(bool)`, `AdminHandover(from, to)`, `Swapped(id indexed, trader indexed, baseIn, amountIn, amountOut, rBase, rQuote)`.

Errors (`:190-211`): `NotHolder, MarketNotOpen, MarketAlreadyOpen, MarketNotEmpty, SameToken, ZeroAddress, ZeroAmount, MoreThanHeld, FeeTooHigh, DepositCap, ReserveOverflow, TradeTooLarge, Slippage(uint256 got, uint256 wanted), Expired, TransferFailed, Reentrancy, Bonded(uint64 until), RatchetOnly, BondTooLong, Paused, NotAdmin, NotBlessed(address token)`.

### 2.5 Access control

- `onlyHolder(id)`: `collection.ownerOf(id) == msg.sender` — "Liquidity is the holder's alone. A renter may operate the artwork (ERC-4907) but must never be able to move the inventory." Note: approved operators and the token's own ERC-6551 account are **not** holders here (contrast `Kiln.mayActAs`, which admits the Reach).
- `onlyAdmin`: five switches; the suite asserts against the compiled ABI that none of them takes a `uint` argument, "so none of them can name a thing to move" (`verify-pool.mjs:461-475`, invariant 27).
- `notPaused` on `deposit` and `swap` only. `withdraw` is never pausable (invariant 28).
- `nonReentrant` on `deposit`, `withdraw`, `swap` **only** — not on `openMarket`, `closeMarket`, `setFee`, `bond`, `syncCurve`. See §13.

### 2.6 Invariants (as the repo states and tests them)

`INVARIANTS.md` 15–26, 27–29, 56, 62, 63, 65, 77, 78 cover this contract. The ones that keep money in:

- **15. The invariant never falls, measured against the anchored offsets** — `(x+vx)(y+vy)` with the *stored* offsets. "That qualifier is the whole invariant, and it was learned the hard way … At eight-times concentration and a trade worth a third of the reserve, 400 units in came back as 718. Both suites 'verified' the old behaviour because both recomputed the offsets the same wrong way, and the 200-trade walk caps every trade at 2.5% of the reserve, where the fee covers the leak."
- **16. A round trip never profits** (up to 40% of reserve, every concentration, every fee).
- **16b. A trade moves along the curve and never moves the curve** — offsets written by `openMarket/deposit/withdraw/syncCurve` and nothing else.
- **17. Never pays out more than it holds** — `MAX_OUT_BPS`.
- **20. The curve is a copy, never a live read.**
- **23/24. A bond only ratchets, survives sale, has a one-year ceiling.**
- **25/26. Credited reserve is what arrived; floor applies to what the recipient receives.**
- **56. A bond freezes the curve through every door, including deposit** (`_reanchor` is a no-op under a live bond: "Deposits still land; the curve simply does not follow them, which is what 'frozen' was always supposed to mean." `:494-513`).
- **62. The deposit cap bounds only the side being deposited into** (fixes a holder lock-out found by review: trading can push a reserve past `maxDeposit`, and the old both-sides check then refused a one-wei top-up on the other side, "under a live bond it left them with no operable function at all").
- **63. Two markets on one token never claim more than the pool holds** — *a monitor, not a guard* (`tools/agents.mjs`); "The real defence against a token whose balance moves out of band is `bless`."

### 2.7 Design decisions and why (verbatim where load-bearing)

- Curve copy, not live read (`:53-65`): "a token can be rented out under ERC-4907, a renter may operate the artwork, and a live read would therefore let a renter re-shape a curve holding somebody else's inventory — concentrate it, trade through it at the improved rate, and hand the token back."
- The holder can move the curve (`:67-74`): "This is not preventable in a design where the art and the curve are the same numbers — so it is bounded instead: every swap carries a minOut that the trader sets, checked after the fact. A trader who sets it is unharmed. A trader who passes zero has chosen to be."
- The bond (`:76-98`): "Taken from the Dave Held core, where a stall bonds to the covenant's seal and 'bondUntil never decreases, and no exit path exists while it holds'. It ratchets. A bond can be extended and never shortened, by anyone, including the holder, including through a transfer … While bonded, only additive operations are allowed."
- The pause (`:100-105`): "A pause that traps money is not a safety measure, it is a slower theft."
- Market view for an unopened market (`:665-674`): "an unset curveWord is zero, and zero is not the rest word: `offsetW` 0 is the far edge of w, not the centre, so the honest reading of word zero is a steep curve" — commit `9b7ba68` found `market()`/`pendingCurve()` reporting a 6.3686× concentration for markets that do not exist.
- ERC-20 defensiveness (`:686-713`): accept empty return, reject explicit `false`; measure balance deltas on pull **and** on push.

### 2.8 Gas and size

- Runtime bytecode **11,626 B** (headroom 12,950 B) in the current `out/solc.json`; the README's older table says 9,619 B (39%) — the docs drift, the build measures.
- A `Market` is six slots; `swap` writes two reserve fields (one slot), one fee tally, `tradeCount`, and emits one event. No per-swap running total across markets (deliberately: invariant 63 "a running total on the swap path is gas on the hot path for a number any observer can compute").
- No gas figure for `swap` is recorded in the docs; `verify-pool.mjs` prints the gas of `openMarket/deposit/commit` at the end of a run (not run here).

### 2.9 ERC standards

None formally. Consumes ERC-721 `ownerOf` and the hub's `sectionOf`; declares ERC-4907 `userOf` in its interface but does not use it. Handles ERC-20 variants (silent-return USDT style, fee-on-transfer). The hub exposes `pool()` (set by curator `setPool` until `sealRenderer()` freezes it, `Ipseity.sol:1048-1052`) so the renderer can write the pool address into the token's HTML.

### 2.10 How it is tested

- `test/Pool.t.sol` (28 tests: 6 `testFuzz_`, 22 `test_`): the three "that matter" — `testFuzz_invariantNeverFalls`, `testFuzz_roundTripNeverProfits`, `testFuzz_neverPaysMoreThanItHolds`; then `test_renterCannotRepriceSomeoneElsesLiquidity`, `test_turningThroughWConcentratesTheCurve`, `test_theCurveIsTheSolid`, `test_sellingTheTokenSellsTheMarket`, `test_onlyHolderMayOpenDepositWithdrawOrSetFee`, `test_slippageFloorIsHonoured`, `test_deadlineIsHonoured`, `test_feeCap`, `test_depositCap`, `test_marketMustBeEmptyToClose`, `test_feeOnTransferTokenIsCreditedOnlyWhatArrived`, `test_feeOnTransferOutputCannotDefeatSlippageFloor`, `test_silentTokenIsAccepted`, `testFuzz_bondOnlyRatchets`, `test_bondFreezesEveryExitAndEveryTerm`, `test_bondSurvivesTheSaleAndBindsTheBuyer`, `test_bondExpiresAndReleases`, `test_bondHasACeiling`, `test_pauseHaltsTradeButNeverCustody`, `test_allowlistGatesNewMarkets`, `test_onlyAdminMayFlipTheSwitches`, `test_adminHandoverTakesTwoSteps`, `testFuzz_concentrationIsBounded`, `testFuzz_outputIsMonotonicInInput`, `testFuzz_outputStaysUnderThePricedReserve`. The fixture deploys the full hub (Engine/Renderer/Sigil/Ipseity/IpseityAccount/GripVault + a `vm.etch`'d ERC-6551 registry), a Pool with cap 1e24 and admin = test contract, and `MockERC20`s (one fee-on-transfer at 100 bps, one silent).
- `tools/verify-pool.mjs` (README: 62 assertions): deploy; open market WETH/USDC at 30 bps with 100/300,000; a stranger trades and is paid exactly the quote; 200-trade random walk (each ≤ 2.5% of reserve) with k read from `marketOf` words 8 and 9; four round trips never profit; quarter-turn re-pricing (anchors baseline first — a measurement error the suite caught); refusals; awkward tokens; sale transfers the market; renter cannot reprice; the bond (every exit, ratchet, ceiling, survives sale); pause; allowlist; admin ABI proof; two-step handover.
- `tools/fuzz.mjs` (9 of its 14 properties are market/curve): pure — "concentration is bounded, at every word there is", "the three planes that do not contain w never move the price", "more in never means less out", "the quote never exceeds the reserve it is priced against", "k never falls, measured against the offsets the market anchored", "a round trip never profits, at any concentration, at any size" (the one that caught the 400→718 leak); live — "a live swap never lowers the invariant, at any curve a holder can commit", "buying and selling straight back never comes out ahead", "the pool never pays out more than it holds". Seeded, shrinking.
- `tools/verify-findings.mjs`: claim 1 (bond drained through the curve via deposit's re-anchor — fixed, invariant 56), claim 6 (`Hooked.sol` ERC-777-style token re-anchoring inside a swap — the hook's `commit`/`syncCurve` fail because the token is not the holder), claim 13 (deposit cap both sides — fixed, invariant 62).
- `tools/agents.mjs`: seven agents (holder, arbitrageur, whale, shrimp, sandwicher, griefer, renter) for 220 ticks against the real contracts with monitors: ERC-20 conservation, invariant across each trade, offsets never move on a swap, payout cap, bond (by *trying every exit*), "a bond is not a slower withdrawal", two markets on one token never over-claim.
- `tools/verify-site.mjs` "driving the swap card" (typed `1` → card quote equals `Pool.quote` to displayed precision → approve → swap → balance moved ≥ floor; flip; nonsense refused; wrong-chain wallet refused), "the market picker", "the directory", "driving the holder's side" (`1.5` typed → exactly 1,500,000,000,000,000,000 base units arrive).
- Live: Sepolia exercise 2026-09-24 ran `openMarket` (block 11769176), `deposit`, `swap`, `swap back`, `setFee`, `withdraw`, `syncCurve`, `setPaused` ×2, `proposeAdmin/acceptAdmin` ×2, `bond` (11769189) on markets `gld 0x7075f840…` / `slv 0xcd96e4b6…`.

### 2.11 Known weaknesses / TODOs (repo-stated)

- Unaudited; `maxDeposit` cap; "raise it only after review" (INVARIANTS C, README).
- B: holder can re-shape an unbonded curve against a pending trade (bounded by `minOut`).
- Single provider: cannot aggregate liquidity.
- 63: cross-market balance over-claim with misbehaving tokens is monitored, not guarded; `bless` is the defence, and **testnet deployments pass `enforce=false` and `admin=deployer EOA`** (`tools/testnet.mjs:144-145`: `w(10n**27n)` cap, `w(0)` enforce) — the Timelock is only used in `verify-timelock.mjs`.
- `MAINNET_READINESS.md` lists stateful invariant campaigns for Pool and an independent audit as blocking gates.

### 2.12 Reuse verdict: **adapt**

The core (holder-as-LP keyed by token id, anchored virtual reserves, measured transfers, ratcheting bond, unpausable withdrawal, enumerable open set) is exactly the "swap inside the NFT" the GOAL asks for and is better argued than anything comparable. Adapt because: (a) the curve source is hard-wired to `sectionOf` — make the concentration source pluggable (a per-token word from whatever the unified token exposes, or a holder-set parameter); (b) fix the re-entrancy guard coverage (§13) and reset reserves on `openMarket`; (c) decide whether `onlyHolder` should admit the token's ERC-6551 account (Kiln does; Pool does not); (d) consider native ETH pairs (today ERC-20 only); (e) re-point `IIpseity` at the unified hub and drop the unused `userOf`.

---

## 3. `src/lib/Curve.sol` — the shape of the solid is the shape of the market (313 lines)

### 3.1 Purpose

An internal library giving `Pool` (and `Facet`/`Kiln.band`) a pricing invariant `(x + vx)(y + vy) = k` where `vx, vy` are virtual reserves proportional to the real reserves by a **concentration** in bps derived from the token's section word. The header argues the whole thing (`Curve.sol:7-110`), including what it replaced:

> This used to be the sum of the three w-plane angles' distance from rest. Two things were wrong with that … It ignored the solid and the offset entirely … a Tesseract and a Ditorus and a Julia produced a byte-identical market. "The curve is the solid" was false; all eight were the same slider. And a sum of angles is not a function of the cut … angles (π,π,0) … the artwork renders completely unturned while the market sits at two thirds of maximum … Under the rule that a control never lies, that was a control that lied.

And why this family: "An invariant has to be monotonic and convex or a trader can walk the curve back on itself and take the reserves for nothing. This family is constant product with a change of origin, so it inherits constant product's proof."

### 3.2 API

- `uint256 internal constant MAX_RESERVE = type(uint112).max`
- `uint256 internal constant MAX_CONCENTRATION = 80_000` (8.0000×, bps); `BPS = 10_000`
- `bytes internal constant SLICE` — 8 solids × 16 bytes (4 buckets of `m = max|uᵢ|` × 4 of `p = u_z² + u_w²`), 255 at rest → 0 at the most-deviating cut; "Measured off the engine's own distance functions." Values per solid at `:153-160` (Tesseract `0000101015100b0b7a404560e44045ff`, 16-cell, 24-cell, Duocylinder, Clifford, Tiger, Ditorus, Julia).
- `bytes internal constant FALLOFF` — 8 × 4 bytes, slice size vs offset along w at 0, 0.45, 0.90, 1.35.
- `function cutDirection(uint256 word) internal pure returns (int256 ux, int256 uy, int256 uz, int256 uw)` — closed form `u = R·e_w = (−s₃, −s₄c₃, −s₅c₄c₃, c₅c₄c₃)` in 1e9 fixed point from the three w-plane angles (planes 3,4,5 of the word); the non-w planes never touch index 3.
- `function concentration(uint256 word) internal pure returns (uint256 bps)` — bucket `m` (rebased from [0.5,1]) and `p`, look up `SLICE[f*16 + mi*4 + pi]`, fold the offset to a distance from centre 32768 and linearly interpolate `FALLOFF`, combine: `open_ = open*fall/255; return (255 − open_) * MAX_CONCENTRATION / 255`. "DEVIATION, not size, and the difference is the whole design … a tesseract cut square across an axis gives the SMALLEST slice it has, so under that rule every freshly minted tesseract would open at maximum concentration." Rest = 0 bps on every solid.
- `function anchor(uint256 word, uint256 rBase, uint256 rQuote) internal pure returns (uint256 vBase, uint256 vQuote)` — `v = r * c / BPS`. "ANCHORING, not deriving … It used to be called on every quote, from the live reserves, and that was a critical bug … At 8x concentration and a trade worth a third of the reserve, 400 units in came back as 718. The fuzz suite found it."
- `function amountOut(uint256 amountIn, uint256 rIn, uint256 rOut, uint256 vIn, uint256 vOut, uint256 feeBps) internal pure returns (uint256 out)` — `x = rIn+vIn; y = rOut+vOut; k = x*y; inAfterFee = amountIn*(BPS−fee)/BPS; yNew = ceil(k / (x+inAfterFee)); out = y − yNew` (rounds toward the pool). Errors `ZeroInput`, `NoLiquidity`.
- `function spot(uint256 rIn, uint256 rOut, uint256 vIn, uint256 vOut) internal pure returns (uint256)` — `(rOut+vOut)*1e18/(rIn+vIn)`, display only.
- `function invariant(uint256 rIn, uint256 rOut, uint256 vIn, uint256 vOut) internal pure returns (uint256)`.
- Errors: `ReserveOverflow` (unused inside the library itself), `NoLiquidity`, `ZeroInput`.

Dependencies: `lib/Types.sol` `Section` (bit layout of the 256-bit word: six 16-bit angles at bits 0..95, `offsetW` at 96..111, `form` at 112..119, `hue` at 120..127; `valid()` requires `form < 8` and bits ≥128 zero), `lib/Trig.sol` (sin/cos in 1e9 fixed point, 13-term Taylor; worst error 3e-9; `fromU16` maps a 16-bit angle to radians).

### 3.3 Tests and measured numbers

- `tools/verify-curve.mjs` (18 assertions through `test/mocks/CurveProbe.sol`): π in two w-planes prices as rest; the mirror plane prices as rest; spinning the non-w planes leaves the market alone, at any turn; all eight solids are 0 bps unturned and centred; ≥ 6 distinct prices across the eight solids at the same cut; off-centre concentrates monotonically and symmetrically (±12000 from 32768 price identically); over `8 × 10 × 3 = 240` orientations concentration stays in [0, 80000]; the contract's cut direction matches the engine's `rot4` to 1e-6.
- `test/Pool.t.sol`: `test_turningThroughWConcentratesTheCurve` (flat = 0, spun = 0, half = flat, quarter > flat, off-w > flat), `test_theCurveIsTheSolid` (eight distinct values), `testFuzz_concentrationIsBounded`, `testFuzz_outputIsMonotonicInInput`, `testFuzz_outputStaysUnderThePricedReserve`.
- INVARIANTS 132–135.
- Table sizes: SLICE 128 B, FALLOFF 32 B; R² figures quoted in the header (Tesseract 0.86, 16-cell 0.71 for `m`; Ditorus 0.81, Tiger 0.58 for `p`; 24-cell flat 238..255).

### 3.4 Reuse verdict: **adapt**

`anchor`/`amountOut`/`spot`/`invariant` and the "anchored, never derived" discipline are reusable verbatim for any virtual-reserve CPMM. `concentration(word)` — the SLICE/FALLOFF tables and `cutDirection` — only makes sense if the unified token keeps IPSEITY's 4-D section. If it does not, keep the signature `concentration(bytes32 something) → bps ≤ 80_000` and feed it from whatever per-token signal the merged design chooses (or a holder-set number).

---

## 4. `src/Venue.sol` — the rest of the chain, read carefully (526 lines)

### 4.1 Purpose

"This is the one contract in the collection that knows Uniswap exists. It holds the addresses, it does the reading, and it has no function that moves anything." (`Venue.sol:39-41`). Two jobs (`:43-63`): on a token's market page it is a *comparison* ("Routing that page's trades to Uniswap would delete all of it … the button still trades the token's own market"); under `/swap`, `/pools`, `/explore`, `/earn`, `/vote` it serves ordinary assets routed to Uniswap v3 from the visitor's wallet directly.

### 4.2 API

- `struct Wiring { address factory; address quoter; address router; uint8 routerKind; address positions; address wrapped; address governor; address govToken; address poolManager; address v4Positions; address permit2; }` — "Seven addresses as seven arguments is seven chances to transpose two of them".
- `constructor(Wiring memory w)` — reverts `UnknownRouterKind` if `routerKind > 1`.
- Immutables (all `public`): `FACTORY, QUOTER, ROUTER, ROUTER_KIND, POSITIONS, WRAPPED, GOVERNOR, GOV_TOKEN, POOL_MANAGER, V4_POSITIONS, PERMIT2`; constants `KIND_V3 = 0` (v3-periphery SwapRouter: 8-word `exactInputSingle` with deadline at index 4), `KIND_02 = 1` (SwapRouter02: 7 words, no deadline). The comment on `ROUTER_KIND` (`:114-145`) is the most important safety note in the file: "Send one shape to the other router and it does not fail. It shifts `recipient` and every amount by one word and executes something nobody asked for."
- `function hasV4() external view returns (bool)`; `function present() external view returns (bool)` (factory set and has code).
- `function tiers() external pure returns (uint24[4] memory)` → `[100, 500, 3000, 10000]`.
- `function best(address base, address quote, uint8 baseDecimals) external view returns (Look memory)` — deepest by in-range `liquidity()`, skipping pools with zero liquidity at the tick.
- `function survey(address base, address quote, uint8 baseDecimals) public view returns (Look[4] memory)` — all four tiers, found or not.
- `function poolAt(address a, address b, uint24 fee) public view returns (address)` — `staticcall{gas: 60_000}` to `getPool`, returns 0 for codeless results.
- `function state(address p) public view returns (PoolState memory)` — `slot0` (length ≥ 224 checked; price sanity-checked ≤ `Tick.MAX_SQRT`; tick in range), `liquidity`, `token0/1`, `fee`, `tickSpacing`, and **asks the pool for its `factory()` and requires it equal `FACTORY`** ("a page that will describe any address as 'a Uniswap pool' is a page that can be used to describe a fake one").
- `function enabled(uint24 fee) public view returns (int24)`; `function spacings() external view returns (int24[4] memory)` — read from the factory, since the 0.01% tier exists only where `enableFeeAmount` was called.
- `function history(address p, uint32 window, uint8 points) external view returns (bool ok, int24[] memory ticks, uint32 step)` — reads the pool's own oracle ring (`observe`), `points ≤ 48`, window trimmed to whole steps (a chart bug recorded at `:407-415`), `staticcall{gas: 2_000_000}`, **decoded by hand** with every bound checked ("`abi.decode` on a length this contract did not choose will happily try to allocate whatever the callee claimed, and memory is charged quadratically").
- `function oldest(address p) external view returns (bool ok, uint32 secondsAgo)` — Uniswap's `getOldestObservationSecondsAgo` logic.
- `function sqrtAt(int24 tick) external pure returns (uint160)`; `function priceAt(int24 tick, uint256 unit, bool baseIsToken0) external pure returns (uint256)`; `function spacing(uint24 fee) external pure returns (int24)`; `function usable(int24 tick, int24 sp) external pure returns (int24)` — "Approximate to choose, exact to display."
- Structs `Look { found, pool, fee, liquidity, sqrtPriceX96, tick, spot }` and `PoolState { ok, sqrtPriceX96, tick, liquidity, token0, token1, fee, spacing, cardinality }` live in `src/interfaces/Site.sol:155-181`.

Storage: none (all immutable). Size: 8,245 B runtime. Access control: none (read-only). Errors: `UnknownRouterKind`.

### 4.3 Supporting libraries

- `src/lib/Tick.sol`: `MIN_TICK/MAX_TICK = ±887272`, `MIN_SQRT = 4295128739`, `MAX_SQRT = 1461446703485210103287273052203988822378723970342`; `sqrtAt(int24)` is Uniswap's `getSqrtRatioAtTick` binary decomposition (19 magic constants), rounding up on the Q128→Q96 shift so the pool's inverse lands on the same tick; `spacing(fee)` → 1/10/60/200; `usable(tick, sp)` rounds to nearest; `meanTick(before, after, elapsed)` with the toward-−∞ correction from OracleLibrary.
- `src/lib/Mul.sol`: Remco Bloemen 512-bit `mulDiv` (errors `MulOverflow`, `DivByZero`) and `priceFromSqrt(sqrtPriceX96, unit, baseIsToken0)` done in two halves. Tested by `test/Mul.t.sol` (11 tests, incl. `test_aRealPoolPrice` pinning `sqrtPriceX96 = 4339505179874779489431521` → 3000 USDC ± 2, and a negative control `test_theExpectationIsAgainstTheActualError`); exact-value checks against BigInt live in `verify-site.mjs`.

### 4.4 Tests

No `.t.sol` for Venue. `tools/verify-site.mjs` "driving the Uniswap card" and "the same page wired to the other router" (sends the wrong calldata shape on purpose to a mock router and requires it to arrive mangled, invariant 98); `test/mocks/UniV3.sol` (27 KB) is the v3 mock. Wiring table for Ethereum, Base, Base Sepolia, Ethereum Sepolia in `tools/site.mjs:266-318` (all `routerKind: 1`), `NO_VENUE` zeros elsewhere.

### 4.5 Reuse verdict: **reuse-verbatim** (optional)

Chain-agnostic, no state, no writes, every read defensive. Needed only if the unified product wants a Uniswap comparison / generic swap page; the GOAL's "swap inside the NFT" is the `Pool`, not this. If kept, re-verify the v3 addresses per target chain and keep the `ROUTER_KIND`+address pairing.

---

## 5. `src/Kiln.sol` — Coin, Kiln, Gate (493 lines)

### 5.1 `Coin` (`:64-113`) — "A token that cannot be used against the people who hold it."

Fixed-supply ERC-20: `name`, `symbol` (storage strings), `decimals` and `totalSupply` immutable, `balanceOf`, `allowance`, `Transfer`/`Approval` events, `transfer`, `approve`, `transferFrom` (infinite allowance short-circuit), `error NotEnough`. No mint, burn-from, pause, blacklist, owner, upgrade, EIP-2612 permit. Constructor mints the whole supply to `to`. Runtime 1,492 B. INVARIANT 97: "A launched coin has no owner because its ABI has none."

### 5.2 `Kiln` (`:115-377`)

Immutables: `address POOL_MANAGER` ("A hook that trusted the wrong manager would let anybody call its callbacks directly, which for a hook that gates withdrawals means anybody can ask it to allow one"), `IHolds HUB` (`ownerOf`, `account`, `sectionOf`).

Storage: `address[] coins` (slot 0), `mapping(address => address) launcher` (1), `mapping(address => uint256) launchedBy` (2), `mapping(address => uint256) launchedAt` (3). No admin, no privileged caller anywhere.

API:
- `function mayActAs(uint256 token, address who) public view returns (bool)` — owner **or the token's ERC-6551 account** (`HUB.account(token)`), never a renter; `try/catch` on `ownerOf`.
- `function launch(uint256 token, string memory name_, string memory symbol_, uint8 decimals_, uint256 supply, bytes32 salt) external returns (address coin)` — `NotYours` unless `mayActAs`; `NothingToLaunch` on zero supply; CREATE2 with `salt' = keccak256(abi.encode(msg.sender, salt))` ("Without this, watching the mempool for a `launch` and re-sending it with more gas takes the address"); supply to `msg.sender`; records; emits `Launched(coin, by, token, symbol, supply)`.
- `function coinCount() external view returns (uint256)`; `function recent(uint256 from, uint256 count) external view returns (address[] memory)` (newest first, paged).
- `function coinAt(address by, string memory name_, string memory symbol_, uint8 decimals_, uint256 supply, bytes32 salt) external view returns (address)` — predicted address via `Hook.at`.
- `function mine(bytes32 initCodeHash, uint16 flags, uint256 from, uint256 tries) external view returns (bool found, bytes32 salt, address at)` — assembly loop laying out `0xff ++ deployer ++ salt ++ initCodeHash` (85 bytes) once and moving only the salt word; exact match of the low 14 bits ("an address with a *spare* bit set is one the PoolManager will hand a callback the hook does not implement"). "Bounded rather than looping to success, because an `eth_call` has a gas ceiling." The client asks 60,000 per window, up to 12 windows (`DeskLaunch.sol:218-245`); expected ~2^14 ≈ 16,384 tries.
- `function deployHook(uint8 kind, bytes32 salt, bytes32 arg) external returns (address hook)` — `create2(0, code, salt)`; `DeployFailed`; then **`Hook.flags(hook) == flags` or `WrongFlags(wanted, got)`** ("A lock that is never consulted looks exactly like a lock"); emits `HookDeployed(hook, by, flags)`.
- `function band(uint256 token, uint24 floor_, uint24 ceiling_) external view returns (uint256 section, uint256 concentration, uint24 feeNow)` — the live Facet reading before a hook exists, "computed by the same `Curve` the hook will use"; `BadBand` if `floor > ceiling` or `ceiling > Hook.MAX_FEE`.
- `function facetArg(uint256 token, uint24 floor_, uint24 ceiling_) external pure returns (bytes32)` — packs `token << 48 | floor << 24 | ceiling` (token ≤ 2^64−1); "the contract that unpacks it is the one that packs it."
- `function recipeHash(uint8 kind, bytes32 arg) external view returns (bytes32 hash, uint16 flags)`.
- `_recipe(kind, arg)`: kind 0 → `Gate(POOL_MANAGER, uint64(arg >> 64) opens, uint64(arg) unlocks)`, flags `BEFORE_REMOVE_LIQUIDITY | BEFORE_SWAP` (= 0x280); kind 1 → `Facet(POOL_MANAGER, HUB, token, floor, ceiling)`, flags `BEFORE_INITIALIZE | BEFORE_SWAP` (= 0x2080); otherwise `NothingToLaunch`.

Errors: `DeployFailed, AlreadyLaunched (unused), NothingToLaunch, NotYours, BadBand, WrongFlags(uint16 wanted, uint16 got)`. Events: `Launched`, `HookDeployed`. Runtime 13,709 B.

Structs `PoolKey`, `ModifyLiquidityParams`, `SwapParams` are declared at file level (`:391-410`) "because a hook's callbacks are matched BY SELECTOR … `Currency` and `IHooks` in v4's own source are user-defined types wrapping `address`, and a user-defined value type ABI-encodes as the type it wraps."

The header's thesis (`:41-58`): "A browser cannot do that here: the client this collection ships has no keccak-256, on purpose. This contract does. `mine` is a `view` function that walks salts … That is the whole trick, and it is the reason a launchpad with hooks can exist on a page with no server: the expensive, keccak-shaped part of deploying a hook is a read, and reads are free."

### 5.3 `Gate` (`:441-493`) — "the one hook a launchpad actually needs"

Immutables `MANAGER`, `OPENS`, `UNLOCKS`; errors `NotTheManager`, `NotOpenYet(uint64)`, `StillLocked(uint64)`; `onlyManager`.
- `function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata) external view onlyManager returns (bytes4, int256, uint24)` — reverts before `OPENS`; returns `(selector, 0, 0)` ("a nonzero fee override on a pool that is not dynamic-fee reverts").
- `function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external view onlyManager returns (bytes4)` — reverts before `UNLOCKS`.
- `function status() external view returns (bool tradingOpen, bool liquidityFree)`.

"**These are exactly the bits a trap has.** A hook that refuses withdrawals until Friday and a hook that refuses them forever have the same address shape … What makes *this* hook safe is not the shape. It is that both timestamps are `immutable`." Runtime 1,008 B.

### 5.4 Tests

- `tools/verify-launch.mjs` (49 assertions at commit `9b7ba68`; more added by `375917e` and `6b89a86`): drives everything **through `test/mocks/MockPoolManager.sol`**, a manager that dispatches by selector against the real signatures, checks the selector echo, ignores a fee without `OVERRIDE_FEE`, and consults a hook only for the bits its address carries (hooks are `putCode`'d at addresses with the mask cleared then flags set). Gate: shut before the hour, add-liquidity never gated, remove refused while locked, opens after `warp`, releases on the date. "a dynamic-fee pool behind a gate charges nothing, for ever" (demonstrated, two swaps charged 0). One mined salt → same address on every chain (CREATE2 recomputed independently; `MineProbe.sol` compares the assembly to the plain version). Band packing round-trips through `facetArg` → `deployHook` → `TOKEN()/FLOOR()/CEILING()` on the deployed hook; `band()` preview equals the hook's own `fee()`. Served-text regexes against `DeskLaunch.launch()` for the dynamic-fee guards and the planner wiring.
- `tools/verify-site.mjs` "driving the launchpad": `/launch` mounted with a DOM shim and injected wallet; token you do not hold cannot sign; launch lands exactly where `coinAt` said; supply in launcher's wallet; ten-year bar; mine under eth_call; deploy at the mined address with low 14 bits `0x280`; `initialize` reaches the recording PoolManager with sorted currencies, fee 3000, spacing 60, the mined hook, and the venue's `sqrtAt(snapped tick)`; `/hook/<gate>` lists both powers. INVARIANT 100.
- Live: Kiln deployed on Base Sepolia (`0x2daaf1c6…`) and Sepolia (`0x29de13b7…`); the 2026-09-24 Sepolia exercise record contains no `launch`/`deployHook` transaction; `DEPLOYMENTS.md` (2026-08-21) says the Facet "needs its CREATE2 salt mined against a real v4 PoolManager" and had no deploy path at that date.

### 5.5 Reuse verdict: **adapt**

The pattern (ownerless coin, CREATE2 with sender-mixed salt, view-mined hook salts, post-deploy flag check, Gate) is directly the GOAL's "launchpad inside the NFT". Adapt: re-point `IHolds` at the unified hub; decide whether the unified launch wants a bonding-curve/ETH raise phase (none here — liquidity goes straight to v4 via the planner); consider recording the coin's pool key so pages can find it without a user re-entering it; add the missing `AlreadyLaunched` semantics or delete the dead error.

---

## 6. `src/Facet.sol` — the pool charges what the solid is doing (197 lines)

Immutables: `MANAGER`, `IHubSection HUB` (`sectionOf`, `ownerOf`), `TOKEN`, `INITIAL_SECTION` (snapshot at deploy "Kept in bytecode so selector-faithful test placement preserves it"), `FLOOR`, `CEILING` (hundredths of a bp; `BadBand` if backwards or > `Hook.MAX_FEE` = 1,000,000 = 100%). Storage: `uint256 _section` (slot 0), `bool _synced` (slot 1).

API:
- `function section() public view returns (uint256)` — `_synced ? _section : INITIAL_SECTION`.
- `function syncFee() external` — **`msg.sender == HUB.ownerOf(TOKEN)` or `NotTokenOwner`**; copies `sectionOf(TOKEN)`. Added by commit `375917e` "Prevent renters from controlling Facet fees" (before that the hook read the section live on every swap, which handed an ERC-4907 renter control of the LP fee — the same bug Pool fixed with `syncCurve`).
- `function fee() public view returns (uint24)` — `FLOOR + (CEILING − FLOOR) * Curve.concentration(section()) / 80_000`. At rest exactly `FLOOR` on every solid.
- `function reading() external view returns (uint256 section_, uint256 concentration, uint24 now_, uint24 floor_, uint24 ceiling_)`.
- `function beforeInitialize(address, PoolKey calldata key, uint160) external view onlyManager returns (bytes4)` — `NotDynamic` unless `key.fee == 0x800000`. "Without that check the hook deploys, the pool works, every swap charges the key's static fee, and the returned override is discarded in silence."
- `function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata) external view onlyManager returns (bytes4, int256, uint24)` — returns `fee() | OVERRIDE_FEE (0x400000)`.
- `function flags() external pure returns (uint16)` — `BEFORE_INITIALIZE | BEFORE_SWAP`.

Errors: `NotTheManager, NotTokenOwner, NotDynamic, BadBand`. Runtime 3,722 B.

Why a fee and not a curve (`:44-64`): "A hook that returns its own delta is a hook that has to be right about the invariant on every path, in a contract nobody has audited, holding other people's liquidity … A custom v4 curve has no such backstop, because the pool's own accounting is what the hook replaced. A dynamic fee cannot do that … The worst a bug here can do is charge the wrong fee inside a band that was fixed at deployment."

Tests: `verify-launch.mjs` "the fee a pool charges is copied from the artwork by its owner" (rest = floor; turning alone does not move it; owner sync raises it ≤ ceiling; renter cannot move or sync; back to rest = floor), "and the pool actually charges it" (through the manager: `lastFeeCharged` = floor, then raised after sync), "the failure a dynamic-fee hook actually ships with" (static-fee pool refused at init), "only the endpoint of the protocol may call it", "a hook is only consulted for the bits its address carries" (same code at a flagless address: key's fee stands).

Reuse verdict: **adapt** — keep if the unified token has any per-token on-chain signal worth making a fee follow; otherwise drop. The owner-snapshot (`syncFee`) and `beforeInitialize` dynamic-fee refusal are the reusable parts.

---

## 7. `src/lib/Hook.sol` — what a v4 hook's address already tells you (174 lines)

Constants reproduced from `v4-core/src/libraries/Hooks.sol`: `BEFORE_INITIALIZE = 1<<13` … `AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA = 1<<0`; `MASK = (1<<14)−1`; `DYNAMIC_FEE = 0x800000`; `MAX_FEE = 1_000_000`; `OVERRIDE_FEE = 0x400000`; `FEE_MASK = 0x3fffff`.
Functions: `flags(address) → uint16`, `has(address, uint160)`, `inert(address)` (no bits: "a hook the PoolManager never calls — which is a legitimate thing to be (v4 allows address(0)) and also the shape of a 'hook' that does nothing while its author says otherwise"), `touchesSwaps(address)` (any of the four swap bits), `guardsExits(address)` (any of the three remove-liquidity bits), `name(i)`, `meaning(i)` (fourteen plain-English strings, the dangerous ones in caps: "CAN REFUSE LIQUIDITY BEING TAKEN OUT", "CAN REFUSE OR REPRICE EVERY SWAP", "CAN TAKE A CUT OF THE INPUT OF EVERY SWAP" …), `bit(i)`, `at(deployer, salt, initCodeHash)` (CREATE2 address).

Used by `Kiln`, `Facet`, `PageHook`, `PageLaunch`. Reuse verdict: **reuse-verbatim** (re-check constants against the v4-core version you target).

---

## 8. `src/V4PositionPlanner.sol` — canonical, non-custodial v4 position plans (233 lines)

Added 2026-09-18 (`6b89a86` "Complete non-custodial Uniswap v4 launch liquidity"). "The browser deliberately has no recursive ABI encoder. This contract is the narrow replacement: Solidity encodes the two-action plans and the caller's wallet sends the returned bytes straight to the official PositionManager. Position ownership is the authority over liquidity and accrued LP fees; that owner is always an explicit input."

Immutables: `ILaunchLedger KILN` (`launchedBy`, `launcher`, `mayActAs`), `POSITION_MANAGER`, `PERMIT2`. Constants: `INCREASE_LIQUIDITY = 0x00, DECREASE_LIQUIDITY = 0x01, MINT_POSITION = 0x02, BURN_POSITION = 0x03, SETTLE_PAIR = 0x0d, TAKE_PAIR = 0x11`; `MODIFY = keccak256("modifyLiquidities(bytes,uint256)")[:4]`.

Structs: `PoolKey`, `MintRequest { PoolKey key; int24 tickLower; int24 tickUpper; uint160 sqrtPriceX96; uint128 amount0Max; uint128 amount1Max; address positionOwner; uint256 deadline; bytes hookData; }`.

API (all `view`/`pure`):
- `function mintPlan(uint256 token, address coin, MintRequest calldata r) external view returns (uint256 liquidity, uint256 value, bytes memory data)` — `WrongCoin` unless `KILN.launchedBy(coin) == token` and `coin` is one of the key's currencies; `NotLaunchOwner` unless `KILN.launcher(coin) == msg.sender && KILN.mayActAs(token, msg.sender)`; `_validate` (position manager set, owner non-zero, `currency0 < currency1`, spacing > 0, ticks on grid, price in range, deadline not passed); liquidity from `liquidityForAmounts`; `data = MODIFY(abi.encode(actions=[0x02,0x0d], params=[abi.encode(key, lower, upper, liquidity, max0, max1, owner, hookData), abi.encode(c0, c1)]), deadline)`; `value` = the native side's max when a currency is `address(0)`.
- `function increasePlan(PoolKey calldata key, uint256 positionId, uint256 liquidity, uint128 amount0Max, uint128 amount1Max, uint256 deadline, bytes calldata hookData) external view returns (uint256 value, bytes memory data)` — `[0x00, 0x0d]`.
- `function decreasePlan(PoolKey calldata key, uint256 positionId, uint256 liquidity, uint128 amount0Min, uint128 amount1Min, address recipient, uint256 deadline, bytes calldata hookData) external view returns (bytes memory data)` — `[0x01, 0x11]`.
- `function collectPlan(PoolKey calldata key, uint256 positionId, address recipient, uint256 deadline, bytes calldata hookData) external view returns (bytes memory data)` — decrease with zero liquidity + take pair.
- `function burnPlan(PoolKey calldata key, uint256 positionId, uint128 amount0Min, uint128 amount1Min, address recipient, uint256 deadline, bytes calldata hookData) external view returns (bytes memory data)` — `[0x03, 0x11]`.
- `function liquidityForAmounts(uint160 sqrtPriceX96, int24 tickLower, int24 tickUpper, uint128 amount0Max, uint128 amount1Max) public pure returns (uint256 liquidity)` — Uniswap `LiquidityAmounts` logic via `Mul.mulDiv` and `Tick.sqrtAt`.

Errors: `NotLaunchOwner, WrongCoin, BadCurrencyOrder, BadRange, BadSpacing, BadPrice, ZeroLiquidity, ZeroAddress, DeadlinePassed`. No storage. Runtime 5,928 B.

Tests: `test/V4PositionPlanner.t.sol` (6 tests) — `test_mintPlanIsCanonicalAndOwnerControlsPositionAndFees` (decodes the whole plan: selector, `actions == hex"020d"`, params, owner), `test_onlyCurrentLaunchTokenAuthorityCanBuildAdvertisedMint`, `test_nativePairReturnsExactlyTheMaximumAsCallValue`, `test_decreaseChoosesWherePrincipalAndFeesGo` (`hex"0111"`), `test_collectPokesWithZeroLiquidityAndRoutesFees`, `test_invalidRangeAndExpiredPlanAreRefused`. The client flow is asserted in `verify-launch.mjs` (`I.call(K.planner, planData(f))`, `I.send(K.positionManager, liqPlan.data, liqPlan.value)`, Permit2 approvals).

Reuse verdict: **adapt** (lightly) — the encoder is reusable verbatim; the `KILN` gate on `mintPlan` is IPSEITY-specific (and only protects "the advertised launch flow"; it "cannot prevent strangers from making unrelated permissionless pools"). Re-verify the `Actions` byte values against the v4-periphery release you target before shipping.

---

## 9. `src/LaunchView.sol` (36 lines)

"Static launchpad markup split out solely to stay below EIP-170." One `pure` function `liquidity()` returning step-4 HTML (tick inputs, amount caps, position owner, deadline, hook data, three buttons, and prose stating the planner is read-only and that funding goes through Permit2). Runtime 2,226 B; `PageLaunch` is at 23,494 B (1,082 B headroom), which is why this exists. Reuse verdict: **drop** (rewrite whatever markup the unified page system needs; nothing load-bearing here).

---

## 10. The web surface for this area

### 10.1 Routing (`src/Premises.sol`)

`Premises.request(string[] resource, KeyValue[] params)` is the ERC-5219 handler; `resolveMode()` returns `"5219"` (ERC-6860 — "Without these four bytes the site is reachable only from a gateway that hard-codes ERC-5219"). Routes in this area (`Premises.sol:104-132, 339-357, 435-450, 569-570`): `/swap` → `PageSwap.swap()`, `/launch` → `PageLaunch.launch()`, `/hook/<address>` → `PageHook.hook(addr)` (EIP-55 input is 301'd to lowercase), `/open` and `/open/<n>` → `PageMarket.open(page)`, `/token/<id>/market` → `PageMarket.market(id)`, `/token/<id>/pool` → `PagePool.pool(id)`. Pages are immutable constructor arguments of Premises: "adding a page means a new Premises."

### 10.2 Pages (Solidity string builders, `view`)

- `PageMarket` (313 lines, 18,917 B): the swap card for one token plus the `/open` directory (24 rows/page, `PICK = 40` markets in the `<select>`). Design note `:84-99`: the picker lists *markets* enumerated by `Pool.openIds`, not a hosted token list — "a dropdown offering ten thousand tokens of which four are tradeable is not a convenience, it is a lie told four thousand nine hundred and ninety-six times." `_caution()` states the guarantees in prose.
- `PagePool` (206 lines, 11,961 B): the holder's side — position, add/remove, fee, bond, curve (`pendingCurve` asked of the pool, "a page that recomputes a contract's own derivation is a page that will one day disagree with it"), open-market form. `_who()` prints `ownerOf(id)` and says the controls render for everyone and the contract refuses non-holders.
- `PageSwap` (285 lines, 17,523 B): generic Uniswap v3 card; `<select>` seeded from `Assets.derive(POOL, 0, 32)` plus a paste box; prints every address it will send to; explains which router shape the deployment uses (SwapRouter02 has no deadline reachable without an ABI coder).
- `PageLaunch` (460 lines, 23,494 B): emits a second JSON block `id="K"` with `kiln, manager, planner, positionManager, permit2, v4, wrapped, dynamicFee, maxFee, gateFlags, facetFlags` and selectors for `launch, coinAt, mine, recipeHash, band, facetArg, deployHook, initV4 (initialize((address,address,uint24,int24,address),uint160)), mintPlan, permitApprove (approve(address,address,uint160,uint48))` — all computed on chain by `_sel`. Four steps, the hook picker (Gate/Facet), the inspector, the recent list (symbols/names through `Web.esc`), and the addresses.
- `PageHook` (125 lines, 6,620 B): renders the fourteen bits with `Hook.name/meaning`, a verdict (`touchesSwaps`, `guardsExits`), and the "same address shape" caveat — "a thing you send to somebody … a link that renders with JavaScript switched off because a contract assembled it."

### 10.3 Desks (JavaScript held as Solidity string constants)

- `Desk.config(id)` (`Desk.sol:67-98`) emits `<script type="application/json" id="D">` with chain, id, hub, pool, open, fee, feeCap 500, spot, maxBaseOut/maxQuoteOut, reserves, base/quote `{a,s,d}` (symbols through `Web.symbolOfJson`), `sel` (every selector from `_sel(signature)`), lease. `CORE_JS` defines `window.IP` with `pad/W/S/SW/AD`, `TK` ticker whitelist, `parse/fmt` (BigInt decimal, no floats), `call/tryCall/send/connect`, `chainOk`. `POOL_JS` (`:437-465`) drives add (approve-if-needed then `deposit`), remove (`withdraw` to `I.acct()`), `setFee`, `bond` (days → `until`), `syncCurve`, `openMarket`, `closeMarket`. `SWAP_JS` drives the token-market card (quote via `Pool.quote`, floor = quote × (10000 − slip)/10000, deadline minutes, approve-then-swap button).
- `DeskUni` (349 lines, 17,328 B): the Uniswap config block (`D.uni`: venue/factory/quoter/router/kind/positions/governor/gov/wrapped/tiers (spacing read from the factory)/assets/sel) and `BASE_JS` (`window.UNI`: `meta` resolves a pasted address by `decimals()`/`symbol()`, `pools` queries the factory at four tiers and sorts by liquidity, `slot0`, `picker`, `goChain` EIP-3326/3085). Selectors for both router shapes, QuoterV2 in struct order ("Hash the comment's order instead and you get a selector for a function that does not exist"), NonfungiblePositionManager, ERC-4626, Governor Bravo.
- `DeskTrade` (205 lines, 7,669 B): `SWAP_JS` for the Uniswap card — quotes every tier that has a pool via `eth_call` to QuoterV2 with a 30M gas limit, takes the best or the tier the visitor pressed, builds `exactInputSingle` in the shape `U.kind` names, refuses `amountIn == 0` ("on SwapRouter02 zero is … the CONTRACT_BALANCE sentinel") and recipients `0x…01/02`.
- `DeskLaunch` (383 lines, 17,079 B): the launchpad client — encodes two `string` args by hand (printable ASCII only), log sliders, `coinAt` preview, `launch`, Gate/Facet arg building (`facetArg` through the Kiln), `recipeHash`, the 60,000-wide `mine` loop, `deployHook` with the chosen kind, the two-way dynamic-fee guard, `initialize` with sorted currencies and `Venue.sqrtAt(snapped tick)`, then `mintPlan` → `approve(Permit2)` + `Permit2.approve(token, PositionManager, amount, deadline)` → `send(positionManager, data, value)`.

### 10.4 `src/lib/Assets.sol`

`derive(IPoolRead pool, uint256 from, uint256 count) → (address[] list, uint256[] ids)` — the token list, "derived instead of fetched": every distinct ERC-20 traded by an open market in the window. Used by `PageSwap` and `DeskUni` (separate 24 kB budgets).

### 10.5 The Market instrument inside `tokenURI` (`engine/ipseity.html:3371-3655`)

The token's own HTML (face 0, ~104 KB) carries a 12-node instrument ring; node **MARKET** (bit 10, "sealed" at birth — `BORN_OPEN = 0x987`, the constant that "read 0x587 for its whole life" and shipped the money panel open, invariant 128) reads `S.pool` from the `window.IPSE={…pool:"0x…"…}` state block the Renderer writes between Engine's head and body (`Renderer.sol:99-116`). `readMarket()` calls `market(uint256)` and `pendingCurve(uint256)` by `eth_call`; the panel shows pair/price/reserves/fee/trades/concentration/bond/drift; the trade form quotes via `quote(uint256,bool,uint256)` with a 220 ms debounce, checks the quote against `maxOut` on the **far** side (a bug fixed by invariant 65), computes the floor from a slippage slider, and `propose()`s `swap(...)` with a 30-minute deadline. Holder-only sections (bond, deposit, withdraw, sync) appear when `mine = NET.account === S.owner` and every handler calls `needWallet(); needOwner();` before encoding. Unlike the site client, the instrument **ships its own keccak-256** (`keccak256` at `:1892`) and `encodeCall` (`:1986`), so it can build any call. Every transaction goes through `propose()` (`:2226`), which prints the plain-English intent, the target, the function, the selector, every calldata word decoded, and the raw bytes before "Sign and send".

---

## 11. How the UI is delivered, and how NFT ownership is verified for access (explicit answer)

**Delivery — entirely from chain, two surfaces:**

1. **The token's own metadata.** `Ipseity.tokenURI(id)` → `Renderer.facetURI` → JSON whose `animation_url` is the whole WebGL2 application as a nested `data:` URI. The HTML is stored as SSTORE2 shards (gzip, 39,501 B on chain for a 113,379 B minified document per the README), and `tokenURI` writes a state block `window.IPSE={id, collection, chainId, owner, account, grip, reachImpl, gripImpl, pool, seed, word, …}` between head and body. The Market instrument is one panel of that document. No server, IPFS, fonts, libraries or fetches.
2. **The ERC-5219 site.** `Premises` answers `web3://<premises>:<chainId>/…`; every page is Solidity returning HTML; page JS is contract string constants (`Chrome.WALLET_JS`, `Desk.CORE_JS`, `Desk.POOL_JS/SWAP_JS`, `DeskUni.BASE_JS`, `DeskTrade.SWAP_JS`, `DeskLaunch.LAUNCH_JS`); every selector is `keccak256(signature)` computed on chain and emitted in a JSON block, so the browser client "has no keccak, no ABI coder, and no floating point for any amount" and only pads words. An HTTP gateway (`tools/gateway.mjs`, w3link) is "a convenience, not a lock": every GET is an `eth_call`.

**Ownership verification — there is no authentication layer; the chain is the authority:**

- Reads are public. `Chrome.sol:177-180`: "The gate is a courtesy, not a secret: everything behind it is public data on a public chain. What ownership actually gates is writing, and that is gated by the contract." The site toggles `body.held` / `.gate` / `.only` CSS classes once the client has compared the connected account to the holder; `PagePool._who()` prints the holder and warns non-holders the contract will refuse them.
- The wallet is chosen by EIP-6963 (all announcers collected, keyed by rdns; the stored choice, the only wallet, or a picker — "taking the first announcement defeats the standard"), the chain is checked (`chainOk`), and the same provider that supplied the terms signs them (invariant 79).
- In the instrument, `refresh()` re-reads `ownerOf(id)` and `sectionOf(id)` from the collection on every refresh and sets `S.owner`; `mine = NET.account.toLowerCase() === S.owner.toLowerCase()`; `needOwner()` throws "Only the holder can change this token. It is held by …" before any holder-only calldata is built (`engine/ipseity.html:2585-2589, 3436`).
- On chain: `Pool.onlyHolder` (strict `ownerOf == msg.sender`; neither operators nor the token's 6551 account nor ERC-4907 users), `Kiln.mayActAs` (owner **or** the token's Reach — so a session key on the Reach can launch, never a renter), `Facet.syncFee` (owner only), `V4PositionPlanner.mintPlan` (launcher and `mayActAs`). Delegated authority exists only through the ERC-6551 Reach (`IpseityAccount` session keys with expiry/spend cap/target+selector allowlists — outside this area). Renters are deliberately excluded from every money path (invariants 13, 20, 21; Facet commit `375917e`).

For the GOAL ("visitor connects a wallet, the app verifies they hold the NFT, then they can use all of the above"): this repo's answer is *client-side courtesy gating + contract-side enforcement*, with the holder test being `ownerOf(id) == account` (plus the token's own account for the launchpad). There is no signed-session, no SIWE, no token-gated *read*; nothing in the design needs one because every read is public and every write is checked by the contract that executes it.

---

## 12. Measured numbers (all from this checkout)

Bytecode (runtime, `out/solc.json`, solc 0.8.36 viaIR 800 cancun; EIP-170 limit 24,576):

| contract | runtime B | headroom B |
|---|---|---|
| Pool | 11,626 | 12,950 |
| Venue | 8,245 | 16,331 |
| Kiln | 13,709 | 10,867 |
| Coin | 1,492 | 23,084 |
| Gate | 1,008 | 23,568 |
| Facet | 3,722 | 20,854 |
| LaunchView | 2,226 | 22,350 |
| V4PositionPlanner | 5,928 | 18,648 |
| PageMarket | 18,917 | 5,659 |
| PagePool | 11,961 | 12,615 |
| PageSwap | 17,523 | 7,053 |
| PageLaunch | 23,494 | 1,082 |
| PageHook | 6,620 | 17,956 |
| DeskTrade | 7,669 | 16,907 |
| DeskLaunch | 17,079 | 7,497 |
| DeskUni | 17,328 | 7,248 |
| Ipseity (hub) | 19,316 | 5,260 |
| Premises | 15,372 | 9,204 |

(README's older table: Pool 9,619 B, PageMarket 18,254 B, PagePool 11,882 B, Ipseity 18,718 B — drift documented by the repo.)

Constants: `MAX_OUT_BPS 5,000`; `MAX_FEE_BPS 500`; `MAX_BOND 365 days`; `MAX_RESERVE 2^112−1`; `MAX_CONCENTRATION 80,000 bps (8×)`; SLICE 128 B, FALLOFF 32 B; `Hook.MASK 0x3fff`; Gate flags `0x280`; Facet flags `0x2080`; `DYNAMIC_FEE 0x800000 (8,388,608)`; `OVERRIDE_FEE 0x400000`; `MAX_FEE 1,000,000`; Tick `±887272`, `MIN_SQRT 4295128739`; Venue stipends 60,000 / 40,000 / 2,000,000 gas, `history` ≤ 48 points; `PageMarket.PAGE 24`, `PICK 40`; `DeskUni.SCAN 32`; mine window 60,000 × 12 in the client, 120,000 and 600,000 in the suites; expected 2^14 tries per full pattern.

Tests: `Pool.t.sol` 28 (6 fuzz), `V4PositionPlanner.t.sol` 6, `Mul.t.sol` 11; `verify-pool.mjs` 62 (README); `verify-curve.mjs` 18; `verify-launch.mjs` 49 at `9b7ba68` (+ later additions); `fuzz.mjs` 14 properties (9 market/curve); `verify-findings.mjs` 15 refuted claims (3 pool-related); `agents.mjs` 220 ticks, 7 agents; `verify-site.mjs` 557 at `9b7ba68` (README quotes 395 from an earlier run); `forge.mjs` 158 Solidity tests (README; `c56e12a` says 140 — drift).

Bugs with measured magnitude: round trip 400 → 718 units at 8× concentration and a trade of a third of the reserve; unopened-market concentration misreported as 6.3686×; OffsetBomb token 2,151M gas of memory expansion (invariant 69); Trig four-term drift 7 ppm → six terms 7 ppb.

Live addresses: Ethereum Sepolia `pool 0x16fb4cd550d59c4da2cfe86f62a92e3ee92b999f`, `kiln 0x29de13b746781ce42210c05565ee67f3072fffcd`, `v4Planner 0xd4ac9d6faee235f0ae2d2e5a66afffda6dcf8b8d`, `venue 0xca489562cea6fb4d5497231dcb3d0e1289cc5ec1`, `launchView 0x1dfa13480df3c39d478ca7958e0ea47d91e7a483`, `deskU 0x3d7c8d08…`, `deskT 0xef8331ac…`, `deskL 0xb0f2655a…`, `pSwap 0xc71c090e…`, `pMarket 0x8fa901db7add5e17b5341f02c38cbed1fde5daa0`, `pPool 0x1894efa437e9d538d5a4606d3ad03b845ebc2356`, `pLaunch 0x499f5fe37ac984c1bf8b85e3b985df9f74c5227a`, `pHook 0x416e2038eb6a3d65999387c4d3840e2153088519`, `premises 0x7e1bdcd82e2a1d197f5792ff41e6548e01ad7a31`, hub `0x11e79cdf3e84a49d4fd2c12fb8a3be7936e5cb3b`. Base Sepolia `pool 0x8b699b46edb8e8bd156347d73c8eaa2a0abe80f4`, `kiln 0x2daaf1c6f30ab2908bc5b3758ec95a7c7e60ebc8`, `venue 0xe0208e28235b4a45ef0b72275c1d8f344ab90f42`, `premises 0xc59f75d298ebf81551aab8d0aa8026b19bf83161` (no planner — predates `6b89a86`). Uniswap v4 PoolManagers wired: Ethereum `0x000000000004444c5dc75cB358380D2e3dE08A90`, Base `0x498581fF718922c3f8e6A244956aF099B2652b2b`, Base Sepolia `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`, Sepolia `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`; Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`.

Sepolia exercise 2026-09-24 (`deployments/eth-sepolia-exercise-2026-09-24.json`): `openMarket` block 11769176, `deposit` 11769177, `swap` 11769178, `swap back` 11769179, `setFee` 11769180, `withdraw` 11769181, `syncCurve` 11769182, `setPaused` 11769183/4, admin handover 11769185–8, `bond` 11769189.

---

## 13. Weaknesses, TODOs and pitfalls (repo-stated and found)

**Found by this reading, unresolved in the repo:**

1. **Re-entrancy through `closeMarket` can leave stale reserves and drain other markets.** `deposit` holds `_lock` but `closeMarket`, `openMarket`, `setFee`, `bond`, `syncCurve` do not. A holder who is also a hostile ERC-20 (exactly `test/mocks/PoolReenter.sol`, committed 2026-08-20 in `3d36eda` alongside a 9-line, 512-byte **unfinished** `tools/poc-pool.mjs` that no script runs and no suite references) can: open a market with itself as `base`; call `deposit` (first deposit, reserves 0); from `transferFrom` re-enter `closeMarket` (passes: holder, unbonded, both reserves zero) which `delete`s the market; `deposit` then continues and writes `rBase = amt` into the now-closed struct (`Pool.sol:464`); `openMarket` on a different pair sets `base/quote/open` but **never resets `rBase/rQuote`** (`:369-374`); `withdraw` then pays out the real token the pool holds for other markets. Precondition: `allowlistEnforced == false` or the attacker's token blessed — and every testnet deployment passed `enforce=false`. Invariant 63's monitor would catch the over-claim after the fact; nothing prevents it. Fix: `nonReentrant` on every state-changing function (one global lock) and/or `delete`/zero reserves in `openMarket`. The repo's own fuzz/agents never opened a market with a malicious *holder-controlled* token.
2. `swap` reads `vIn/vOut` **after** `_pull` (`:560-565`). A holder whose `tokenIn` calls back can `syncCurve` inside the pull (no guard on `syncCurve`), re-anchoring the curve the trade is about to use. `verify-findings` claim 6 tests this only with a token that is *not* the holder (so `syncCurve` reverts `NotHolder`). Still bounded by `minOut` (weakness B), but it makes the atomic version of B possible; read the offsets before pulling, or guard `syncCurve`.
3. `IIpseity.userOf` declared and unused; `Kiln.AlreadyLaunched` declared and unused.

**Repo-stated (INVARIANTS "Known and not fixed", README, MAINNET_READINESS):**

4. Nothing audited; `Pool.sol` holds other people's money (C). Blocking gates: stateful invariant campaigns, independent audit, multisig+timelock, conservative caps, bug bounty.
5. B: an unbonded curve can be reshaped against a pending trade; `minOut` is the only protection; a bond removes it.
6. 63: two markets sharing a token balance can over-claim with rebasing/fee/sweeping tokens; monitor only; `bless` is "a centralisation trade-off stated rather than hidden".
7. Single LP per market; no liquidity aggregation; no oracle/TWAP.
8. `/swap` is single-hop only (no `bytes` path without an ABI coder); SwapRouter02 deployments have no reachable deadline.
9. Facet had no deploy path on a public chain as of 2026-08-21; Facet/Gate have only been executed against `MockPoolManager`, never a real v4 PoolManager (the mock "is not v4", `MockPoolManager.sol:4-20`).
10. `forge test` itself has never run (Foundry unreachable); `tools/forge.mjs` has no invariant campaigns.

**Pitfalls recorded in comments and commit messages (each cost real debugging time):**

- Virtual reserves derived from live reserves re-anchor the curve per trade → 400 in, 718 out (`Curve.sol:240-247`).
- `deposit` re-anchored under a bond (claim 1 → invariant 56); deposit cap checked on the untouched side locked holders out (claim 13 → 62).
- `maxBaseIn` was the output cap; the instrument compared input to the near side's cap (65).
- `market()`/`pendingCurve()` priced non-existent markets at 6.37× because word 0's offset is the far edge of w, not the centre 32768.
- Test fixtures certified the old curve: half-turn "edge on" is the same plane as rest; offset 0 is not the centre (`Pool.t.sol:186-199`, `verify-pool.mjs:232-243`).
- The hooks had never executed; callbacks are matched by selector, so a type drift means "never called" not "wrong"; a fee without `OVERRIDE_FEE` is silently ignored; "pretty" test addresses already carry permission bits (`0xef…00` asserts BEFORE_INITIALIZE); trailing `bytes` offsets were 7 words instead of 9/10 and the swap case passed by accident; `mine` returns three words; `recipeHash` returns two (`f453881`).
- Dynamic fee + Gate = a pool priced at nothing forever and unrepairable; the guard asked `!mined` instead of `mined.sets`; `deployHook` was hard-coded to kind 0 (`9b7ba68`).
- A `const` in the temporal dead zone killed every button on `/launch` while six regex assertions on the served text passed.
- Two routers' `exactInputSingle` differ by one word and the wrong shape does not revert; QuoterV2's NatSpec parameter order differs from its struct; `amountIn = 0` is SwapRouter02's CONTRACT_BALANCE sentinel; recipients `0x1/0x2` are router sentinels; negative ticks need two's-complement words (`I.S`).
- Hostile ERC-20s: a `symbol()` that is a script tag; `bytes32` symbols (MKR); 200 decimals; 8 KB answers; ABI offsets pointing megabytes past the buffer (2,151M gas of memory expansion in the *page's* frame — the staticcall stipend protects nothing).
- `Venue.history` window not trimmed to whole steps scaled the newest bar wrong.
- `BORN_OPEN` shipped with the money panel open and the picture sealed; the assertion pinned the wrong constant.
- `eth_gasPrice` on Base Sepolia misled a cost estimate by ~70×; public RPCs lag (hence the deploy script's lag defences).

---

## 14. Reuse verdicts relative to the GOAL

| component | path | verdict | why |
|---|---|---|---|
| Pool | `src/Pool.sol` | **adapt** | The per-NFT exchange the GOAL wants, with the best-argued safety properties in any of the four repos (anchored offsets, measured transfers, ratcheting bond, unpausable withdrawal, ABI-proven admin). Needs: global re-entrancy lock + reserve reset on open (§13.1), pluggable curve source, hub re-pointing, decision on Reach/operator authority, native-ETH support. |
| Curve | `src/lib/Curve.sol` | **adapt** | `anchor/amountOut/spot/invariant` reusable verbatim; `concentration(word)` + SLICE/FALLOFF only if the 4-D section survives the merge. |
| Section/Trig | `src/lib/Types.sol`, `src/lib/Trig.sol` | adapt | Only needed with the section word. |
| Venue | `src/Venue.sol` | **reuse-verbatim** (optional) | Stateless defensive v3 reader; only if a Uniswap comparison/generic swap page is wanted. |
| Tick, Mul | `src/lib/Tick.sol`, `src/lib/Mul.sol` | **reuse-verbatim** | Faithful TickMath/FullMath reproductions with tests. |
| Coin | `src/Kiln.sol` | **reuse-verbatim** | Ownerless fixed-supply ERC-20; add EIP-2612 only if the merged design wants it. |
| Kiln | `src/Kiln.sol` | **adapt** | The launchpad: CREATE2 + sender-salted, view-mined hook salts, `WrongFlags` check, `band`/`facetArg`. Re-point `IHolds`; decide raise mechanics. |
| Gate | `src/Kiln.sol` | **reuse-verbatim** | Two immutable timestamps, two callbacks; executed through a selector-faithful mock manager. |
| Facet | `src/Facet.sol` | **adapt** or drop | Owner-snapshotted dynamic fee from a per-token word; keep only with a per-token signal. |
| Hook lib | `src/lib/Hook.sol` | **reuse-verbatim** | v4 flag constants, inspector strings, CREATE2 address. |
| V4PositionPlanner | `src/V4PositionPlanner.sol` | **adapt** (light) | Canonical v4 position encoder as a view; the Kiln gate is IPSEITY-specific; re-verify Actions bytes. |
| LaunchView | `src/LaunchView.sol` | **drop** | EIP-170 overflow markup. |
| PageMarket / PagePool / PageSwap / PageLaunch / PageHook | `src/Page*.sol` | **adapt** | The on-chain-rendered-page + on-chain-selector pattern is the GOAL's "mint a website"; the specific chrome/routes are IPSEITY's. |
| Desk pool/swap JS, DeskUni, DeskTrade, DeskLaunch | `src/Desk*.sol` | **adapt** | No-keccak/no-ABI/no-float client pattern; EIP-6963 picker; wrong-shape router defence. |
| Assets | `src/lib/Assets.sol` | **reuse-verbatim** | Derived token list. |
| Engine Market instrument | `engine/ipseity.html:3371-3655` | **adapt** | The in-tokenURI wallet client with `propose()` bytes-first confirmation. |
| MockPoolManager, CurveProbe, MineProbe, PoolReenter, Hooked, MockERC20, Nasty | `test/mocks/*` | **reuse-verbatim** | Selector-faithful v4 harness and hostile tokens; finish the PoolReenter PoC. |
| verify-pool / verify-curve / verify-launch / fuzz / agents | `tools/*.mjs` | **adapt** | Portable to any `@ethereumjs/vm` harness; the properties are the spec. |

---

## 15. Unique ideas worth carrying forward

1. **Market keyed by token id with `ownerOf` as the only LP authority** — "selling the NFT sells the exchange" with no LP shares, no migration, no wrapper.
2. **The ratcheting bond** (`bondUntil` only moves out, ≤ 1 year, survives transfer, freezes exits *and* terms, additive operations stay open) — the thing that makes the above a promise a buyer can read.
3. **Anchored virtual reserves written only on liquidity/curve change, never by a trade**, with a `CurveAnchored` event as the audit signal, and the fuzz property that caught the alternative leaking.
4. **Curve copy vs live read** to keep ERC-4907 renters off other people's money; `pendingCurve` so a UI can offer the sync.
5. **Admin that provably cannot move assets** (asserted against the compiled ABI), **withdrawal that can never be paused**, two-step handover.
6. **Enumerable open-market set** → indexer-free directories and a **derived token list**.
7. **Hook-salt mining as a `view`**, so a keccak-less client deploys v4 hooks under `eth_call`; **post-deploy `WrongFlags` check**; sender-mixed CREATE2 salts.
8. **`/hook/<address>`**: hook powers read off the address bits, rendered by a contract, with the "a lock and a trap have the same address shape" caveat.
9. **Facet**: LP fee driven by an on-chain per-token word, owner-snapshotted; `beforeInitialize` refusing non-dynamic pools; a `band()` preview computed by the same library the hook uses.
10. **Non-custodial Solidity "planner"** that returns canonical PositionManager calldata so the browser never needs an ABI coder.
11. **Measured transfers on both sides** (fee-on-transfer safe `minOut`).
12. **Venue's defensive reading**: gas stipends, hand-decoded dynamic returns, `factory()` cross-check, router kind pinned beside the router address.
13. **On-chain selector computation into JSON config blocks**; a client with no keccak, no ABI coder, no floats.
14. **Site-driving tests** that mount the served HTML, run the served JS against a DOM shim and the in-process EVM, and assert on balances — the discipline that caught the dead-zone bug and the `paint()` bug.

---

## 16. File:line index

- `src/Pool.sol`: header 20–112; struct 132–163; events 171–188; errors 190–211; admin 268–300; enumeration 302–352; `openMarket` 356–378; `closeMarket` 384–392; `setFee` 394–401; `bond` 407–416; `deposit` 432–468; `withdraw` 470–487; `_reanchor` 489–519; `quote` 526–539; `swap` 543–604; `syncCurve` 609–619; `pendingCurve` 623–633; `market` 638–684; ERC-20 helpers 686–713.
- `src/lib/Curve.sol`: header 7–110; constants 112–119; SLICE 152–160; FALLOFF 167–169; `cutDirection` 174–187; `concentration` 194–231; `anchor` 252–258; `amountOut` 271–293; `spot` 297–302; `invariant` 308–312.
- `src/Venue.sol`: header 35–103; immutables/`Wiring` 104–190; constructor 194–212; `best/survey` 242–286; `poolAt/state/enabled` 296–367; `history` 398–454; `oldest` 469–486; tick helpers 503–525.
- `src/Kiln.sol`: header 14–59; `Coin` 64–113; `Kiln` 115–377 (`mayActAs` 137–142, `launch` 172–189, `mine` 250–275, `deployHook` 285–296, `band` 309–318, `facetArg` 325–331, `_recipe` 345–375); structs 391–410; `Gate` 412–493.
- `src/Facet.sol`: header 30–95; constructor 119–129; `syncFee` 146–150; `fee` 153–157; callbacks 177–191.
- `src/lib/Hook.sol`: constants 35–75; readers 79–159; `at` 167–173.
- `src/V4PositionPlanner.sol`: `mintPlan` 77–101; plans 105–181; `liquidityForAmounts` 185–203; `_validate` 210–224.
- `src/LaunchView.sol`: 5–36. `src/lib/Assets.sol`: `derive` 59–79. `src/lib/Tick.sol`: `sqrtAt` 61–98; `usable` 121–139; `meanTick` 151–164. `src/lib/Mul.sol`: `mulDiv` 38–87; `priceFromSqrt` 97–109.
- Pages: `PageMarket.sol` picker 100–140, card 144–165, `/open` 248–312; `PagePool.sol` 45–71, `_curve` 167–188; `PageSwap.sol` 86–109, `_options` 171–183, `_routerNote` 227–243; `PageLaunch.sol` `_config` 133–168, steps 197–382; `PageHook.sol` `_inspect` 62–96.
- Desks: `Desk.sol` config 67–98, CORE_JS 211+, POOL_JS 437–465; `DeskUni.sol` config 86–105, selectors 158–276, BASE_JS 298–347; `DeskTrade.sol` SWAP_JS 45–164; `DeskLaunch.sol` LAUNCH_JS 45–382 (mine loop 204–245, pool init 286–326, position 329–373).
- `engine/ipseity.html`: state 496–523; keccak 1878–1892; `encodeCall` 1986; `propose` 2226; `needWallet/needOwner` 2580–2589; Market 3371–3655; `refresh` 3736–3765. `src/Renderer.sol` state block 99–116.
- `src/Ipseity.sol`: `BORN_OPEN` 110–130; `pool` pointer 232–235; `commit` 409–420; `setPool` 1048–1052; `sealRenderer` 1063–1066.
- `src/Premises.sol`: route table 104–132; `/swap` 339–341; `/launch` 355–357; `/hook` 435–450; token leaves 569–570.
- Tests: `test/Pool.t.sol` (setUp 39–80, `_k` 88–91, the three 97–156, bond 364–435, privilege 441–493, maths 497–524); `test/V4PositionPlanner.t.sol`; `test/Mul.t.sol`; mocks `CurveProbe`, `PoolReenter`, `Hooked`, `MineProbe`, `MockPoolManager`, `MockERC20`, `Nasty`.
- Tools: `tools/verify-pool.mjs`; `tools/verify-curve.mjs`; `tools/verify-launch.mjs`; `tools/fuzz.mjs` 255–510; `tools/verify-findings.mjs` claims 1, 6, 13; `tools/agents.mjs` 196–236, 280–380; `tools/verify-site.mjs` 715–784 (picker/directory), 1097–1205 (swap card), 2300–2480 (launchpad), 2918–2950 (holder's side); `tools/site.mjs` UNISWAP 266–318, Kiln/Planner/Venue deploys 504–532; `tools/testnet.mjs` Pool 144–146; `tools/poc-pool.mjs` (stub).
- Docs: `INVARIANTS.md` 15–26 (135–218), 27–29 (408–424), 56/62/63/65 (1166–1276), 77–78 (1398–1419), 97–100 (557–590), 132–135 (918–954), Known A–D (1442–1560); `README.md` 95–150 (the market), 436–468 (launchpad), 1031–1052 (sizes), 1300–1340 (what was run); `DEPLOYMENTS.md` 146–200, 420–510; `MAINNET_READINESS.md`.
