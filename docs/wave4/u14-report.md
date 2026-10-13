# U14 — the Uniswap v4 launch path: `LaunchHook` and `LPCustodian`

Branch `wave4/u14` from the integrated head 40a678f. DESIGN.md §8.3–8.4, §3
rows 23–24, §12 (pinned constants), §14 D2/D6; BUILD-PLAN.md U14.

## What was built

| File | Role |
|---|---|
| `src/LaunchHook.sol` (NEW) | one contract per launch: `beforeInitialize` admits only its own `PoolKey` (native quote, the launch's coin, `DYNAMIC_FEE`, spacing 60, itself) and asserts its bits equal the address; `beforeSwap` refuses before OPENS and returns `floor + (start − floor)·max(0, 1 − elapsed/DECAY)` with `OVERRIDE_FEE`; `beforeRemoveLiquidity` refuses a negative delta before UNLOCKS and admits zero-delta pokes; `onlyManager` on every entry; `hookData` never read; no delta-returning flag; `getHookPermissions()` names the three bits |
| `src/LPCustodian.sol` (NEW) | registry of each v4 launch's hook terms and salt (`register`, LAUNCHPAD only, at `createV4`); `seed` (LAUNCHPAD only, at graduation): deploys the hook through `Kiln.deployHook` if nobody did, the 1 % pre-init check against `extsload`'d slot0 (`PriceOff(terminal, found)`), `initialize` otherwise, the Permit2 chain with a real expiry, the full-range position minted to itself through `modifyLiquidities` (`MINT_POSITION, SETTLE_PAIR, SWEEP`), both approvals zeroed and re-read, dust home to the Reach; `resalt` (acts, before seeding); permissionless `collect` → `hub.feeSink(id)` (`DECREASE_LIQUIDITY(0), TAKE_PAIR`, CEI, `nonReentrant`); `release` (acts, after `unlocksAt`, only to `account(id)`; `BURN_POSITION, TAKE_PAIR`); `extend` (acts; `Ratchet.raise`, ≤ 10 y, only lengthens); no admin |
| `src/interfaces/ILPCustodian.sol` (NEW) | the v4 shapes by field type (`PoolKey`, `ModifyLiquidityParams`, `SwapParams`, `HookPermissions`), `HookTerms`, `Custody`, `ILaunchHook`, `ILPCustodian` + events/errors |
| `src/Kiln.sol` | `_recipe` kind 1 = `LaunchHook` creation code ++ `abi.encode(POOL_MANAGER, ILaunchpad(LAUNCHPAD).CUSTODIAN(), coin)` with `BEFORE_INITIALIZE|BEFORE_SWAP|BEFORE_REMOVE_LIQUIDITY`; `UnknownRecipe(1)` where no custodian is pinned |
| `src/Launchpad.sol` | `CUSTODIAN` is an immutable (5th constructor argument; `address(0)` keeps `Target.UniswapV4` at `NotYet`); `createV4(p, h, salt)` / `createV4Checked(p, h, salt, expectedHash)` / `v4TermsHash(p, h, salt)`; `create`/`createChecked` with the v4 target revert `WrongTarget` (the wrong door) when a custodian exists; `graduate` lands in `LPCustodian.seed{value: raised}(launchId, amountBase)` for the v4 target, `Graduated(launchId, poolId, terminal, poolSpot)` emits both prices; `create`/`createChecked` share one private `_checked` path (the optimiser copies `_create` once per call site: two sites measured 2,000 B less than three, U14's size ladder) |
| `src/interfaces/ILaunchpad.sol` | additive: the three functions above; the `CUSTODIAN()` comment |
| `test/Hook.t.sol` (NEW), `test/mocks/V4Fixtures.sol` (NEW) | the suite and the fixtures: `MockV4Manager` (U0's by-selector hook dispatch + `initialize` returning the tick + slot0 at `keccak(poolId ‖ 6)` served by `extsload` + a reserve/fee ledger + an exact-input `swap` that charges the hook's fee), `MockPositionManager` (`modifyLiquidities(bytes,uint256)` decoding the real action bytes and parameter layouts, `nextTokenId`, `ownerOf`, `getPositionLiquidity`, `CurrencyNotSettled` at the end), `MockPermit2` (the real expiry rule: zero is stored as `block.timestamp`; counts every zero it is handed), `V4Wiring` (Locks, Pool fixture, Kiln, custodian, Launchpad, predicted and asserted) |
| `tools/verify-launch.mjs` | the hook half (the second half of the file) |
| `test/mocks/LaunchFixtures.sol`, `test/helpers/Deploy.sol` | the minimal compile-keeping edit: the Launchpad's fifth constructor argument, `address(0)` (no custodian in the MVB wiring and bundle) |

### Design decisions, each with its reason

- **The hook's times are durations from seeding, not dates.** A raise graduates when its target is met — any moment inside its deadline — so a date written at `create` either idles a pool that could trade or promises a lock shorter than meant. `HookTerms{opensIn, lockFor, startFee, floorFee, decay}`; the moment they count from is `Custody.seededAt`, written by the custodian in `seed`, read once by the hook from `LPCustodian.seededAt(coin)` and cached. `OPENS()`/`UNLOCKS()` are the absolute views DESIGN names (zero before seeding). A pool a stranger initialised early under the hook is shut both ways until the launch seeds (`NotOpenYet(0)`, `StillLocked(0)`); nothing a stranger does can start the clock.
- **Nothing in the hook is a Solidity `immutable`.** The Router pins ONE `LAUNCH_HOOK_CODEHASH` for every launch's hook (DESIGN §6.2, U8). An immutable lands in the runtime bytes, so two launches' hooks would differ; the terms are storage written once by the constructor with no setter, and `keccak256(type(LaunchHook).runtimeCode)` is one number — the same on every band, computable from the artifact with no deployment. Cost: `beforeSwap` reads two slots.
- **The hook's terms live in the custodian's registry, keyed by the coin.** `Kiln.recipeHash(1, bytes32(coin))` therefore depends on nothing but the coin, so a launcher mines the salt BEFORE `createV4` (the recipe's initcode is `creationCode ++ (POOL_MANAGER, CUSTODIAN, coin)`), and one transaction pins terms and salt beside the launch. The constructor refuses an unregistered coin (`Unregistered`), so a deployment racing the registration finds nothing; after it, anyone's deployment is the same hook (CREATE2).
- **The Kiln reads `ILaunchpad(LAUNCHPAD).CUSTODIAN()` in `_recipe`** rather than growing a constructor argument; a band with no custodian has no kind-1 recipe (`UnknownRecipe`).
- **`seed(launchId, amountBase)` rather than DESIGN's `seed(launchId, sqrtPriceX96)`**: the custodian derives the terminal sqrt price, `sqrt(amountBase · 2^192 / msg.value)` — the position's own ratio — from the two amounts it is handed (the Launchpad, at 17,500 B of budget, carries no root; the custodian already had one for the corner check), initialises the pool at it, and then uses the pool's LIVE slot0 price for the liquidity it mints (the IPSEITY branch's "mint from live StateView" rule), so a pool a stranger set within 1 % is used as it is and the side the price did not need goes home to the Reach. The second branch of the root (prices above 2^64 coin per wei) takes the root of the quotient at 2^128 and scales by 2^32 afterwards, never shifting a 2^255 word.
- **Tick spacing 60 is a protocol constant** (`LaunchHook.TICK_SPACING`, `LPCustodian.TICK_SPACING`), the full-range grid is ±887220, and the two sqrt bounds are hardcoded (`SQRT_LOWER`, `SQRT_UPPER`) and asserted equal to `Tick.sqrtAt(±887220)` in verify-launch, so the custodian carries no TickMath.
- **The 1 % band is checked in sqrt-price space with `BAND_LO = 994_988`, `BAND_HI = 1_004_987` (per 1e6)**: sqrt(0.99) rounded up and sqrt(1.01) rounded down, so a pool inside the band is inside 1 % of the PRICE and never a hair outside.
- **The curve's price corners are checked at `register`**: coin per wei runs from `liquidity²/k` to `(curve+liquidity)²/k`; both must be inside v4's representable range, or a launch could be stuck between a target met and a price the pool refuses (`PriceOutOfRange`). The three numbers are read raw from `launchOf`'s return (words 4, 5, 7) — the whole struct's decoder is a kilobyte.
- **Permit2 expiry 0 is never written.** The seeding approval carries `block.timestamp + PERMIT_WINDOW`; the revocation carries `block.timestamp`; the allowance is re-read as zero in the same call. `MockPermit2` normalises zero to `block.timestamp` as the real one does and counts every zero it was handed; the suite and verifier assert zero.
- **`MAX_START_FEE = 900_000`** (90 %, the Pool's `MAX_SNIPER_BPS` in v4's unit); `floorFee ≤ startFee`; `lockFor, opensIn ≤ Ratchet.LOCK_CAP`.

## Sizes (measured, `node tools/compile.mjs` on this tree, solc 0.8.36 viaIR 800, `bytecodeHash: "none"`)

| Contract | Budget (DESIGN §3) | Before U14 | Measured | Note |
|---|---|---|---|---|
| `LaunchHook` | ≤ 4,000 | — | **3,156 B** | under; no immutables, two storage slots read per swap |
| `LPCustodian` | ≤ 9,000 | — | **13,589 B** | **over the estimate by 4,589 B**; see the ladder below — the estimate predates the PositionManager action encoding, the Permit2 chain, the registry and the corner check; 10,987 B under EIP-170 |
| `Launchpad` | ≤ 17,500 | 15,983 | **17,176 B** | under; +1,193 for the v4 doors, the custodian seam and the `Graduated` branch, after the two-site restructure |
| `Kiln` | ≤ 14,500 | 9,904 | **14,047 B** | under; +4,143 is the `LaunchHook` creation code it carries as kind 1 (+ the recipe) |
| `Coin`, `Gate` | — | 3,145 / 967 | 3,145 / 967 | unchanged |
| `Intact` (monolith) | measured only | 25,402 | 25,402 | unchanged; the ship rule still says diamond |

**The custodian's size ladder** (each row removes one piece from the real contract and re-measures; `tools/compile.mjs` settings; the full copy, cache off):
removing the post-mint re-reads (Permit2 allowance, `ownerOf`, `getPositionLiquidity`) −646 B; the curve's corner check −531 B; `_liquidityFor` −385 B; `custodyOf` −324 B; the hook deployment through the Kiln −213 B; `poolKeyOf` −151 B; the flattened MINT encode −107 B; the event amounts −99 B; the three locks −83 B; `priceFromSqrt` −31 B; all six events −815 B. Nothing single is large; the contract is ~25 external call sites (each an encoder, a decoder and an `extcodesize` check), six events, fifteen errors, eleven views and the 512-bit `Mul.mulDiv` the full-range liquidity needs. Getting under 9,000 B would mean dropping `resalt`, `extend` or the reads a page needs; this report leaves that call to the integrator and the next size pass, with the ladder as the map.

**The Launchpad's size ladder**: the v4 doors (`createV4`, `createV4Checked`, `v4TermsHash`, `_createV4` and the `register` call) measure 2,815 B as first written and 1,193 B after `create`/`createChecked` were routed through one private `_checked`: the optimiser emits one copy of `_create` per call site (two sites: 17,782 B; three: 19,782 B; four, whether through a thin wrapper or directly: 22,402 B; a recursion barrier in `_create`: 18,282–18,323 B), so the number of sites is the lever. The square root moved to the custodian (−606 B here, +459 B there).

## Runs

Iteration runs, in copies of this tree (CLAUDE.md's recipe: a pruned clone for the forge runner, a full clone for the verifier), on the final sources:

| Run | Result |
|---|---|
| `node tools/forge.mjs --match Hook` (pruned copy: `src/{Coin,Kiln,Launchpad,LaunchHook,LPCustodian}.sol` + libs + interfaces, `test/{Hook,Launchpad,Transient}.t.sol`, the three mocks) | **20 passed, 0 failed** |
| `node tools/forge.mjs --match Launchpad` (the same pruned copy; U6's suite against the five-argument constructor) | **35 passed, 0 failed** |
| `node tools/verify-launch.mjs` (full copy) | **307 passed, 0 failed** — the 123 of the coin half unchanged in count (two sentences reworded for the wiring that pins no custodian), 184 in the hook half |
| `node tools/static-audit.mjs` (this tree) | passed — 10 Solidity rules, 4 JS rules |
| `node tools/compile.mjs` (this tree) | all gated contracts under EIP-170; the sizes above; ship rule diamond, unchanged |

Final runs, in this worktree (the proof the commit cites):

| Run | Result |
|---|---|
| `node tools/verify-launch.mjs` | **307 passed, 0 failed** (123 + 184); gas measured on that run: `createV4` 956,753, `graduate` into v4 (hook deployment through the Kiln included) 1,931,657, a stranger's `deployHook` 1,793,838, `resalt` 59,861, `collect` 388,334, `extend` 44,885 |
| `node tools/compile.mjs` | all gated contracts under EIP-170; the sizes above; ship rule diamond |
| `node tools/static-audit.mjs` | passed (10 Solidity rules, 4 JS rules) |
| `INTACT_IMPL=monolith node tools/forge.mjs --match Hook` | **22 passed, 0 failed** (the 20 of `test/Hook.t.sol` and the two `*Hooked*` tests elsewhere that the match catches); this run paid the cold `src` + `test` compile, the five below reused its cache |
| `INTACT_IMPL=monolith node tools/forge.mjs --match Launchpad` | **36 passed, 0 failed** (U6's 35 and one matched elsewhere) |
| `INTACT_IMPL=monolith node tools/forge.mjs --match Bundle` | **7 passed, 0 failed** |
| `INTACT_IMPL=diamond node tools/forge.mjs --match Hook` / `--match Launchpad` / `--match Bundle` | **22 / 36 / 7 passed, 0 failed** — the diamond build was run, not skipped |
| `--match Transient` | not run: no transient slot was registered (the registry's `CUSTODIAN_LOCK`, already there since U0, is the custodian's lock) |

## Mutation evidence

One-token mutations of the real sources, each aimed at one guard, applied in a copy and restored (`scratchpad/mutate.mjs`, the recipe of CLAUDE.md's gate). Two provers: `node tools/forge.mjs --match Hook` in the pruned copy (20 tests) and `node tools/verify-launch.mjs` in a full copy (307 sentences). A row is **killed** when a named test or sentence fails, or when the verifier cannot reach its summary because the graduation itself reverts (named by the last sentence that passed).

| Guard | Mutation (file: before → after) | `test/Hook.t.sol` | `tools/verify-launch.mjs` |
|---|---|---|---|
| the manager check | `LaunchHook.sol`: `if (msg.sender != _manager) revert NotTheManager();` → `==` | killed: 12 of 20 fail — `test_everyHookEntryRefusesACallerThatIsNotTheManager`, `test_getHookPermissionsEqualsTheAddressBits`, `test_aForeignPoolKeyIsRefusedAtInitialize`, `test_theGraduationJourneyAgainstTheV4Target`, `test_noSwapBeforeOpensAndTheFeeDecaysFromStartToFloor`, `test_negativeDeltasAreBlockedUntilUnlocksAndZeroDeltaPokesPass`, `test_collectPaysTheReachAndPrincipalWaitsForTheUnlock`, `test_aPreInitialisedPoolAtTheWrongPriceIsRefusedAndResaltGivesANewKey`, `test_aPreInitialisedPoolWithinOnePercentIsUsedAsItIs`, `test_theUnlockIsARatchetOfAtMostTenYears`, `test_oneCodehashForEveryLaunchHook`, `test_aFeeWithoutTheOverrideFlagWouldBeIgnoredByThePool` | killed: the run aborts at the stranger's `initialize` of the launch pool, right after *"and no opening time: the clock has not started"* — the manager's own call is refused `NotTheManager()` (0x1f972375), so no pool can ever be made and the 307 cannot be reached |
| the own-key check | `LaunchHook.sol`: `key.currency1 != _coin ||` → `==` | killed: the same 12 (no launch can seed: its own key is now the foreign one) | killed: aborts at the same `initialize` with `ForeignKey()` (0x1bc16506) — the launch's own key is now the foreign one |
| the OPENS comparison | `LaunchHook.sol`: `if (block.timestamp < opens) revert NotOpenYet(opens);` → `>` | killed: `test_noSwapBeforeOpensAndTheFeeDecaysFromStartToFloor` | killed: *"before the opening hour the pool will not swap"*, *"not a second early"*, then aborts at *"at the opening second the start fee: 50 %"* with `NotOpenYet` (the pool is now shut after it opens) |
| the override flag | `LaunchHook.sol`: `_feeAt(…) \| Hook.OVERRIDE_FEE` → `\| 0` | killed: `test_aFeeWithoutTheOverrideFlagWouldBeIgnoredByThePool`, `test_noSwapBeforeOpensAndTheFeeDecaysFromStartToFloor`, `test_collectPaysTheReachAndPrincipalWaitsForTheUnlock`, `test_everyHookEntryRefusesACallerThatIsNotTheManager` | killed: 10 sentences — *"the first swap after seeding pays the start fee: 10 %, with the override flag honoured by the pool"*, *"the fee pot holds it"*, *"a stranger's collect pays the Reach the whole fee"*, *"at the opening second the start fee: 50 %"*, *"halfway down the ramp: 25.15 %"*, *"at the ramp's end the floor: 0.3 %"* and four more (297 passed, 10 failed) |
| the UNLOCKS comparison | `LaunchHook.sol`: `if (block.timestamp < unlocks) revert StillLocked(unlocks);` → `>` | killed: `test_negativeDeltasAreBlockedUntilUnlocksAndZeroDeltaPokesPass` | killed: *"a withdrawal through the manager is StillLocked"*, then aborts at the holder's `release` after *"a stranger cannot release"* with `StillLocked` (the pool is now locked after it unlocks) |
| the 1 % band | `LPCustodian.sol`: `_within`: `&&` → `\|\|` | killed: `test_aPreInitialisedPoolAtTheWrongPriceIsRefusedAndResaltGivesANewKey`, `test_aPreInitialisedPoolWithinOnePercentIsUsedAsItIs` | killed: *"a pre-initialised pool at the wrong price is refused"*, *"with both prices in the refusal: the terminal"*, *"and the stranger's"* (304 passed, 3 failed) |
| the ratchet | `LPCustodian.sol`: `c.unlocksAt = Ratchet.raise(c.unlocksAt, until, Ratchet.LOCK_CAP);` → `= until` | killed: `test_theUnlockIsARatchetOfAtMostTenYears` | killed: *"the lock cannot shorten"*, *"nor reach past ten years"* (305 passed, 2 failed) |
| the bits-equal-the-address assertion | `LaunchHook.sol`: `if (got != FLAGS) revert WrongFlags(FLAGS, got);` → `==` | killed: the same 12 as the manager row (a correctly mined hook now refuses its first use) | killed: aborts at the same `initialize` with `WrongFlags(0x2280, 0x2280)` — a correctly mined hook refuses its first use |
| the zero-delta admission | `LaunchHook.sol`: `if (p.liquidityDelta < 0) {` → `<= 0` | killed: `test_negativeDeltasAreBlockedUntilUnlocksAndZeroDeltaPokesPass`, `test_collectPaysTheReachAndPrincipalWaitsForTheUnlock`, `test_everyHookEntryRefusesACallerThatIsNotTheManager` | — |
| the Permit2 expiry | `LPCustodian.sol`: `uint48(block.timestamp) + PERMIT_WINDOW)` → `uint48(0))` | — | killed: *"the custodian never wrote a Permit2 approval with expiry 0"* (306 passed, 1 failed) |
| seed/register LAUNCHPAD-only | `LPCustodian.sol`: `if (msg.sender != LAUNCHPAD) revert NotLaunchpad();` → `==` | — | killed: *"a start fee above 90 % is refused"*, *"a floor above the start is refused"*, *"a lock past ten years is refused"*, *"a salt the miner did not bless is refused"* (each now `NotLaunchpad` instead of `BadTerms`/`BadSalt`), then aborts at `createV4Checked` |
| the salt's bits check | `LPCustodian.sol`: `uint16 got = Hook.flags(hook);` → `uint16 got = flags;` (the address bits never read) | killed: `test_badHookTermsAndABadSaltAreRefusedAtCreate`, `test_aPreInitialisedPoolAtTheWrongPriceIsRefusedAndResaltGivesANewKey` (18 passed, 2 failed) | killed: *"a salt the miner did not bless is refused"* (the unblessed salt now registers the launch, and the checked create that follows meets `WrongCoin`: the run aborts after *"`createV4Checked` refuses terms that moved"*) |

A first salt mutation (`\|\|` → `&&` in `_hookAt`) survived the verifier (307 passed) and is an **equivalent mutant**: the Kiln's recipe flags and `HOOK_FLAGS` are the same constant, so `got != flags && got != HOOK_FLAGS` is `got != flags`; the row above replaces it with a mutation that changes behaviour.

## The constants pinned, for the deployment record

| Constant | Value | Source |
|---|---|---|
| `LaunchHook` address bits | `0x2280` = `BEFORE_INITIALIZE (1<<13) | BEFORE_REMOVE_LIQUIDITY (1<<9) | BEFORE_SWAP (1<<7)` | v4-core `src/libraries/Hooks.sol` (the fourteen flags in `src/lib/Hook.sol`, verbatim) |
| `DYNAMIC_FEE` / `OVERRIDE_FEE` | `0x800000` / `0x400000` | v4-core `LPFeeLibrary` |
| `POOLS_SLOT` | `6` — slot0 of pool `id` is `extsload(keccak256(abi.encodePacked(id, bytes32(6))))`, low 160 bits the sqrt price | v4-core `StateLibrary` (the Router already pins the same) |
| `initialize(PoolKey,uint160) returns (int24)` | selector of the final v4-core release (no `hookData`) | v4-core v1.0 `IPoolManager` |
| action bytes | `DECREASE_LIQUIDITY 0x01`, `MINT_POSITION 0x02`, `BURN_POSITION 0x03`, `SETTLE_PAIR 0x0d`, `TAKE_PAIR 0x11`, `SWEEP 0x14` | v4-periphery `src/libraries/Actions.sol` at commit `dce236d4e2057422d0791d9a973a58765eb46f65` (the commit MASTER's `v4-position-encoder.mjs` pins); mint = `0x020d14` for a native pair, collect = `0x0111`, release = `0x0311` |
| parameter layouts | MINT `(PoolKey, int24, int24, uint256, uint128, uint128, address, bytes)`; DECREASE `(uint256, uint256, uint128, uint128, bytes)`; BURN `(uint256, uint128, uint128, bytes)`; SETTLE_PAIR `(Currency, Currency)`; TAKE_PAIR `(Currency, Currency, address)`; SWEEP `(Currency, address)`; `unlockData = abi.encode(bytes actions, bytes[] params)` | v4-periphery `CalldataDecoder` / `PositionManager.modifyLiquidities(bytes,uint256)` |
| Permit2 | `approve(address,address,uint160,uint48)` = `0x87517c45`; `allowance(address,address,address)`; `transferFrom(address,address,uint160,address)` | Permit2 at commit `cc56ad0f3439c502c246fc5cfcc3db92bb8b7219` (MASTER's pin) |
| tick spacing / range | `60`; ticks `−887220 … 887220` | the outermost multiples of 60 inside `TickMath.MIN_TICK/MAX_TICK` |
| `SQRT_LOWER` / `SQRT_UPPER` | `4306310044` / `1457652066949847389969617340386294118487833376468` | `TickMath.getSqrtPriceAtTick(±887220)`, reproduced by `src/lib/Tick.sol` and asserted in verify-launch |
| the 1 % band | `BAND_LO 994_988`, `BAND_HI 1_004_987` per 1e6 in sqrt space | sqrt(0.99)·1e6 rounded up, sqrt(1.01)·1e6 rounded down |
| `MAX_START_FEE` | `900_000` | the Pool's `MAX_SNIPER_BPS` (9,000 bps) in v4's hundredths of a bip |
| `PERMIT_WINDOW` | `3600` s | the approval lives one call; never zero |
| `LAUNCH_HOOK_CODEHASH` (for the Router) | `keccak256(LaunchHook.deployedBytecode)` — the compiled runtime's own hash, no immutables to splice | this unit; asserted equal for two launches' hooks in verify-launch |

## Constructor-shape changes the integrator must mirror (`tools/deploy.mjs`, `tools/site.mjs`, `test/helpers/Deploy.sol`'s world)

- `Launchpad(address hub, address kiln, address pool, address locks, address custodian)` — a fifth argument. On a band where the custodian is deployed later, pass its CREATE3 prediction (`keccak("intact.v1.custodian")` under the factory) the way `POOL ↔ LAUNCHPAD` is predicted; on a band without one, `address(0)` (then `Target.UniswapV4` reverts `NotYet`, `Kiln.recipeHash(1, …)` reverts `UnknownRecipe`). `deploy.mjs` line 718 today: `encodeParams("address,address,address,address", [got.hub, got.kiln, got.pool, got.locks])` → add the fifth.
- `LPCustodian(address hub, address launchpad, address kiln, address poolManager, address positionManager, address permit2)` — NEW, post-MVB, under salt key `custodian`; `positionManager` and `permit2` join the per-band venue table beside `poolManager` (probed for code on a dated commit, never recalled). It pins nothing that must exist first: the Launchpad and the Kiln are already deployed by then. **What admits a chain to the v4 target:** a probed PoolManager (already the Kiln's and the Router's), a probed PositionManager and a probed Permit2 — all three with code on the dated commit that fills the venue row. Without any one of them, deploy no custodian and pass `address(0)` to the Launchpad: the v4 target then reverts `NotYet` and nothing else changes. The hub's `IntactConfig` is untouched (the custodian is not a hub module); `Catalog` learns it under a new letter (below).
- For `tools/site.mjs` (the harness's world): the same fifth argument on its Launchpad deployment, `address(0)` until it deploys a custodian; when it does, the order is Kiln → custodian (with the Launchpad predicted, as `test/mocks/V4Fixtures.sol` `V4Wiring` does) → Launchpad, or Launchpad (custodian predicted) → custodian — either prediction works, the pins are asserted after construction (`pad.CUSTODIAN() == cust`, `cust.LAUNCHPAD() == pad`, the first two sentences of the verifier's hook half). The `recover-record` fields to add: `custodian`, `positionManager`, `permit2`, `launchHookCodehash`, and the constants table below.
- The Router's `launchHookCodehash` = `keccak256` of `LaunchHook`'s compiled `deployedBytecode` (no immutables; the same on every band). Until the custodian is deployed on a band the Router may keep zero (hookless keys only).
- `Kiln` and `Pool` constructors are unchanged.
- `test/helpers/Deploy.sol` and `test/mocks/LaunchFixtures.sol` pass `address(0)` (minimal compile-keeping edit); the bundle stays the MVB bundle.

## INVARIANTS rows (proposed text; U12 owns the file)

- **D2** — `tools/verify-launch.mjs` · *"a pre-initialised pool at the wrong price is refused"*, *"with both prices in the refusal: the terminal"*, *"and the stranger's"*, *"and resalt gives a new key: a new hook address"*, *"a pre-initialised pool within 1 % is used as it is: the stranger's price stands"*; `test/Hook.t.sol` · `test_aPreInitialisedPoolAtTheWrongPriceIsRefusedAndResaltGivesANewKey`, `test_aPreInitialisedPoolWithinOnePercentIsUsedAsItIs` — **live (U14)**: the band mutation (`&&` → `||` in `_within`) is killed by exactly the first three of those sentences in the verifier (304 passed, 3 failed) and by both named tests in the suite (18 passed, 2 failed).
- **D6** — `tools/verify-launch.mjs` · *"every hook entry refuses a caller that is not the manager"*, *"`getHookPermissions` equals the address bits"*, *"a foreign PoolKey is refused at initialize"*; `test/Hook.t.sol` · `test_everyHookEntryRefusesACallerThatIsNotTheManager`, `test_getHookPermissionsEqualsTheAddressBits`, `test_aForeignPoolKeyIsRefusedAtInitialize` — **live (U14)**: the manager-check, own-key and bits mutations each fail 12 of the suite's 20 tests, the three named ones among them; in the verifier each one aborts the run before its summary at the graduation that can no longer seed (the sentence it stops after is in the mutation table).
- A new row is proposed, **D7** — *Principal leaves the custodian only after `unlocksAt`, only to the Reach, on `acts`; the unlock is a ratchet ≤ 10 y; `collect` pays `feeSink(id)` and nothing passes through the custodian* — `tools/verify-launch.mjs` · *"collect pays the Reach and principal waits for the unlock"*, *"negative deltas are blocked until UNLOCKS and zero-delta pokes pass"*; `test/Hook.t.sol` · `test_collectPaysTheReachAndPrincipalWaitsForTheUnlock`, `test_theUnlockIsARatchetOfAtMostTenYears`, `test_negativeDeltasAreBlockedUntilUnlocksAndZeroDeltaPokesPass`; and `test/Ratchet.t.sol` could add the custodian's `extend` to `test_everyRatchetOnlyLengthens` (U5's file; request).

## `docs/INTERFACE-CHANGES.md` entry (proposed text)

### U14 — the v4 launch path (additive)

| File | Change | Why |
|---|---|---|
| `ILaunchpad.sol` | `function createV4(LaunchParams calldata p, HookTerms calldata h, bytes32 hookSalt) external returns (uint256 launchId);` (acts), `function createV4Checked(LaunchParams calldata p, HookTerms calldata h, bytes32 hookSalt, bytes32 expectedTermsHash) external returns (uint256 launchId);`, `function v4TermsHash(LaunchParams calldata p, HookTerms calldata h, bytes32 hookSalt) external pure returns (bytes32);` | `LaunchParams` is frozen and carries no hook terms; the v4 target needs the hook's terms and the mined salt pinned beside the launch, once, before any buy. `create`/`createChecked` with `Target.UniswapV4` revert `WrongTarget` (an error the interface already had) where a custodian is pinned and `NotYet` where none is. |
| `ILaunchpad.sol` | `CUSTODIAN()` comment: `address(0)` on a band without an LPCustodian | was "until U14" |
| `ILPCustodian.sol` (new file) | `PoolKey`, `ModifyLiquidityParams`, `SwapParams`, `HookPermissions`, `HookTerms`, `Custody`; `ILaunchHook`; `ILPCustodianEvents`; `ILPCustodian` | the v4 shapes declared by field type once, beside `Kiln.sol`'s (which keep its `Gate` compiling) |
| `IKiln.sol` | unchanged; `deployHook(1, salt, bytes32(uint160(coin)))` and `recipeHash(1, bytes32(uint160(coin)))` are the kind-1 recipe | — |

No error was added to `Launchpad`'s or `Kiln`'s ABI (the Catalog's error table, `tools/verify.mjs`'s drift gate, is untouched); the custodian's and the hook's errors are new contracts' and need Catalog rows only when the Catalog learns the custodian (below).

## Catalog service rows requested (`src/Catalog.sol`, U7/integration)

The Catalog's `LETTERS = "HPRYTSKNLCOWXEGQ"` and `address[16] byLetter` have no slot for the custodian; a 17th letter (proposed `U`) is a `CatalogRows` constructor change the integrator owns. Rows, in the file's own grammar (`name|letter|signature|kind|right|note;`):

```
"createV4|L|createV4((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8),(uint32,uint32,uint24,uint24,uint32),bytes32)|w|a|the v4 target: hook terms and the mined salt pinned beside the launch;"
"createV4Checked|L|createV4Checked((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8),(uint32,uint32,uint24,uint24,uint32),bytes32,bytes32)|w|a|pins the terms, the hook terms and the salt the page showed;"
"v4TermsHash|L|v4TermsHash((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8),(uint32,uint32,uint24,uint24,uint32),bytes32)|r|d|;"
"collect|U|collect(uint256)|w|d|anyone - every fee to feeSink(id);"
"release|U|release(uint256)|w|a|after unlocksAt, to the Reach only;"
"extend|U|extend(uint256,uint64)|w|a|only later, at most ten years;"
"resalt|U|resalt(uint256,bytes32)|w|a|a new hook salt before seeding - a new pool;"
"custodyOf|U|custodyOf(uint256)|r|d|;"
"hookTermsOf|U|hookTermsOf(address)|r|d|keyed by the coin;"
"hookOf|U|hookOf(uint256)|r|d|;"
"hookAt|U|hookAt(address,bytes32)|r|d|where a salt would put the coin's hook;"
"poolKeyOf|U|poolKeyOf(uint256)|r|d|;"
"poolIdOf|U|poolIdOf(uint256)|r|d|;"
"unlocksAt|U|unlocksAt(uint256)|r|d|the ratchet;"
"seededAt|U|seededAt(address)|r|d|zero before the pool is seeded;"
"spotOf|U|spotOf(uint256)|r|d|wei per 1e18 of the coin, off the pool;"
"launchOfCoin|U|launchOfCoin(address)|r|d|;"
```
and the Kiln's existing `mine`/`deployHook`/`recipeHash` rows serve kind 1 as they are. The err table gains the custodian's and the hook's errors (`ILPCustodianEvents`, `ILaunchHook`) when the letter lands; the topics table gains `Registered`, `Resalted`, `Seeded`, `Collected`, `Released`, `Extended`.

## Observations and residuals

- **A stranger can still pre-initialise the launch pool** once the terms are registered: `Kiln.deployHook(1, salt, coin)` is open (any deployment is the same hook), `PoolManager.initialize` is open, and the hook's `beforeInitialize` admits any sender with its own key, as DESIGN §8.4 has it. The custodian's 1 % check and `resalt` are the answer the design chose; a griefer who re-pre-initialises after every resalt costs the launcher a mine (free) and one transaction each time and gains nothing. A stricter hook that admitted only the custodian as initialiser would close the loop and make D2's check unreachable by construction; left as the design has it, and noted for the next review.
- **The hook's `beforeSwap` and `beforeRemoveLiquidity` are not `view`:** the first callback after seeding caches `seededAt` (one SSTORE, once). v4 calls hooks with `call`, never `staticcall`, so this is fine on chain; a mock that dispatched with `staticcall` would see the first swap revert.
- **The fee ramp and the opening count from seeding**, so a launch whose hook terms say `opensIn = 0` opens the moment it graduates and pays the start fee from that block. The page should print "opens N after graduation", not a date, until the launch has seeded.
- **Dust goes home.** The position takes `min(L0, L1)`; the side the price did not need (a few wei when the custodian set the price, up to the band's width when a stranger did) is sent to the Reach in the same call, so the custodian holds nothing of any launch but the position. `receive` admits ether only from the PositionManager (the sweep).
- **Three locks were dropped as unnecessary**: `register`, `resalt` and `extend` make no external call that can re-enter (views into the Kiln, the hub and the Launchpad); `seed`, `collect` and `release` keep `CUSTODIAN_LOCK`. No transient slot was added, so `test/Transient.t.sol` is untouched.
- **The custodian measures 13,589 B against a 9,000 B estimate** (the ladder above); the Launchpad fits its budget only after the two-site restructure, which the integrator should know when touching `create`/`createChecked` again: a third call site of `_create` costs two kilobytes.
- **The mocks are not v4.** `MockV4Manager` dispatches hooks by the real signatures and keeps slot0 where StateLibrary reads it, but prices by x·y = k over real reserves and removes liquidity pro rata — faithful for a single full-range position, not for concentrated ranges or for a second LP. The PositionManager mock decodes the real action bytes and parameter layouts and settles through Permit2 as the real one does; it does not implement `INCREASE_LIQUIDITY`, the swap actions or ERC-6909. A fork test against the deployed contracts is the next step (U19's audits; `tools/testnet.mjs` once a band's venue row is probed).
- **`test/Launchpad.t.sol` still asserts `pad.CUSTODIAN() == address(0)` and `NotYet`** for its wiring — true, that wiring pins no custodian; the test's message says "no custodian until U14", which U6 may reword.
- **The Launchpad's `WrongTarget` error is now reachable** (`create`/`createChecked` with the v4 target where a custodian is pinned); it was declared unused in the interface.
- **Equivalent mutant**: the `||`→`&&` salt mutation (above) — the two operands are the same constant on every path; recorded rather than hidden.
