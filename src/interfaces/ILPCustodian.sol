// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  ILPCustodian and ILaunchHook — the Uniswap v4 launch path

  DESIGN.md §8.3 (`Target.UniswapV4`), §8.4 (hooks and the custodian), §3
  rows 23–24. Added in wave 4 (U14), additive: a new file beside the frozen
  ones. The v4 shapes a hook and a position need are declared here once,
  BY FIELD TYPE, because v4 matches a hook's callbacks by selector and a
  selector is the hash of the whole signature: `Currency` and `IHooks` are
  user-defined value types over `address` in v4's own source and ABI-encode
  as `address`, so these produce byte-identical selectors (the same rule
  src/Kiln.sol states for the Gate).

  The terms of a launch's hook are written once, at `Launchpad.createV4`,
  into the custodian's registry; the hook reads them at its birth and has
  no setter. The salt that places the hook is mined off chain through
  `Kiln.mine` (a view) and may be replaced by the launcher with `resalt`
  until the pool is seeded.
───────────────────────────────────────────────────────────────────────────*/

struct PoolKey {
    address currency0;
    address currency1;
    uint24  fee;
    int24   tickSpacing;
    address hooks;
}

struct ModifyLiquidityParams {
    int24   tickLower;
    int24   tickUpper;
    int256  liquidityDelta;
    bytes32 salt;
}

struct SwapParams {
    bool    zeroForOne;
    int256  amountSpecified;
    uint160 sqrtPriceLimitX96;
}

/// @notice v4-core `Hooks.Permissions`, the fourteen flags in address-bit
///         order (most significant first).
struct HookPermissions {
    bool beforeInitialize;
    bool afterInitialize;
    bool beforeAddLiquidity;
    bool afterAddLiquidity;
    bool beforeRemoveLiquidity;
    bool afterRemoveLiquidity;
    bool beforeSwap;
    bool afterSwap;
    bool beforeDonate;
    bool afterDonate;
    bool beforeSwapReturnDelta;
    bool afterSwapReturnDelta;
    bool afterAddLiquidityReturnDelta;
    bool afterRemoveLiquidityReturnDelta;
}

/// @notice One launch's hook terms, fixed at `createV4`. Both times count
///         from the moment the custodian seeds the pool — a raise graduates
///         when its target is met, not on a date. Fees are in hundredths
///         of a basis point (v4's unit: 10,000 = 1 %).
struct HookTerms {
    uint32 opensIn;     // no swap before seededAt + opensIn (0 = at once)
    uint32 lockFor;     // no negative liquidity delta before seededAt + lockFor; the custodian's ratchet starts there
    uint24 startFee;    // the fee when trading opens
    uint24 floorFee;    // the fee the ramp decays to
    uint32 decay;       // seconds from the opening to `floorFee` (0 = the floor from the start)
}

/// @notice What the custodian holds for one launch.
struct Custody {
    address coin;
    uint64  unlocksAt;  // the ratchet: principal leaves only after this; set at seeding
    bool    released;
    address hook;
    uint64  seededAt;   // zero until the pool is seeded
    bytes32 salt;
    uint256 id;         // the launching Intact
    uint256 tokenId;    // the PositionManager position, once seeded
}

interface ILaunchHook {
    error NotTheManager();
    error NotOpenYet(uint64 opens);
    error StillLocked(uint64 unlocks);
    error ForeignKey();
    error WrongFlags(uint16 wanted, uint16 got);
    error Unregistered(address coin);

    function beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96) external returns (bytes4);
    function beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external returns (bytes4, int256, uint24);
    function beforeRemoveLiquidity(address sender, PoolKey calldata key, ModifyLiquidityParams calldata params, bytes calldata hookData)
        external returns (bytes4);
    function getHookPermissions() external pure returns (HookPermissions memory);

    function MANAGER() external view returns (address);
    function CUSTODIAN() external view returns (address);
    function COIN() external view returns (address);
    function SEEDED_AT() external view returns (uint64);
    function OPENS() external view returns (uint64);        // seededAt + OPENS_IN; zero before seeding
    function UNLOCKS() external view returns (uint64);      // seededAt + LOCK_FOR; zero before seeding
    function OPENS_IN() external view returns (uint32);
    function LOCK_FOR() external view returns (uint32);
    function START_FEE() external view returns (uint24);
    function FLOOR_FEE() external view returns (uint24);
    function DECAY() external view returns (uint32);
    function FLAGS() external view returns (uint16);
    function poolKey() external view returns (PoolKey memory);
    function feeAt(uint64 t) external view returns (uint24);
    function status() external view returns (bool tradingOpen, bool liquidityFree);
}

interface ILPCustodianEvents {
    event Registered(uint256 indexed launchId, uint256 indexed id, address indexed coin, address hook, bytes32 salt);
    event Resalted(uint256 indexed launchId, address indexed hook, bytes32 salt);
    event Seeded(uint256 indexed launchId, bytes32 indexed poolId, address indexed hook, uint256 tokenId,
                 uint160 terminalSqrtPriceX96, uint160 poolSqrtPriceX96, uint256 liquidity);
    event Collected(uint256 indexed launchId, address indexed to, uint256 amount0, uint256 amount1);
    event Released(uint256 indexed launchId, address indexed to, uint256 amount0, uint256 amount1);
    event Extended(uint256 indexed launchId, uint64 unlocksAt);

    error NotLaunchpad();
    error NotActor();
    error AlreadyRegistered(uint256 launchId);
    error NotRegistered(uint256 launchId);
    error AlreadySeeded(uint256 launchId);
    error NotSeeded(uint256 launchId);
    error BadTerms();
    error BadSalt(address hook, uint16 got);
    error HookMismatch(address wanted, address got);
    error PriceOutOfRange(uint160 sqrtPriceX96);
    /// @notice A stranger initialised the pool more than 1 % from the terminal price: both, side by side.
    error PriceOff(uint160 terminalSqrtPriceX96, uint160 poolSqrtPriceX96);
    error StillLocked(uint64 unlocksAt);
    error ZeroAmount();
    error PositionNotHeld(uint256 tokenId);
    error TransferFailed();
    error UnexpectedEther();
}

interface ILPCustodian is ILPCustodianEvents {
    /// @notice The Launchpad registers a v4 launch's hook terms and salt at `createV4`.
    function register(uint256 launchId, uint256 id, address coin, HookTerms calldata terms, bytes32 salt) external;   // LAUNCHPAD
    /// @notice The Launchpad graduates: the raise as value, the base it has approved exactly. The terminal sqrt
    ///         price is sqrt(amountBase / msg.value) in Q64.96 — the position's own ratio; initialise the pool
    ///         at it (or accept one within 1 %), mint the full-range position.
    function seed(uint256 launchId, uint256 amountBase) external payable
        returns (uint256 key, uint256 poolSpot);                                                                       // LAUNCHPAD
    function resalt(uint256 launchId, bytes32 salt) external;                                                          // acts, before seeding
    function collect(uint256 launchId) external;                                                                       // anyone → feeSink(id)
    function release(uint256 launchId) external;                                                                       // acts, after unlocksAt → account(id)
    function extend(uint256 launchId, uint64 until) external;                                                          // acts; only lengthens, ≤ 10 y

    /*── reading ──*/
    function custodyOf(uint256 launchId) external view returns (Custody memory);
    function hookTermsOf(address coin) external view returns (HookTerms memory);
    function launchOfCoin(address coin) external view returns (uint256);
    function seededAt(address coin) external view returns (uint64);
    function hookOf(uint256 launchId) external view returns (address);
    function poolKeyOf(uint256 launchId) external view returns (PoolKey memory);
    function poolIdOf(uint256 launchId) external view returns (bytes32);
    function unlocksAt(uint256 launchId) external view returns (uint64);
    function spotOf(uint256 launchId) external view returns (uint256);
    function hookAt(address coin, bytes32 salt) external view returns (address);

    function HUB() external view returns (address);
    function LAUNCHPAD() external view returns (address);
    function KILN() external view returns (address);
    function POOL_MANAGER() external view returns (address);
    function POSITION_MANAGER() external view returns (address);
    function PERMIT2() external view returns (address);
}
