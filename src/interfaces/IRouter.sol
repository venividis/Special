// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IRouter — ownerless routing to constructor-pinned venues

  DESIGN.md §6.2; from ANIMA AgentSwapRouter.sol, Garden MarketCartridge
  (v3 path validation, v4 unlock commitment) and MASTER OfficialV4QuoteLens
  (quote-by-revert). `msg.sender` must be a canonical Reach. Calldata is
  built by the router from typed parameters, never opaque bytes. The
  `SwapRequest` layout is a U0 choice: one struct, one venue selector,
  with the fields each venue reads.
───────────────────────────────────────────────────────────────────────────*/

enum Venue { OwnPool, UniswapV3, UniswapV4 }

struct PoolKey {
    address currency0;
    address currency1;
    uint24  fee;
    int24   tickSpacing;
    address hooks;
}

struct SwapRequest {
    Venue    venue;
    address  tokenIn;             // address(0) = native
    address  tokenOut;
    uint256  amountIn;
    uint256  minOut;
    uint64   deadline;
    uint256  poolKey;             // OwnPool: the market key
    bytes    path;                // UniswapV3: 43–112 B, (len−20) % 23 == 0, endpoints = in/out (WETH for native)
    PoolKey  v4Key;               // UniswapV4: hookless, or hooks.codehash == LAUNCH_HOOK_CODEHASH
    uint160  sqrtPriceLimitX96;   // UniswapV4: a real limit, never 0 / max
}

/// @notice One row of the venue manifest, in `hooklist` shape.
struct VenueInfo {
    string  name;
    address at;
    bytes32 codehash;
    uint16  permissionBits;
    bool    upgradeable;
    string  auditURI;
}

interface IRouterEvents {
    event Swapped(address indexed reach, Venue venue, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);

    /// @notice "Quote is a settlement": the real path's result, surfaced by revert.
    error QuoteResult(uint256 spent, uint256 received, uint160 sqrtPriceAfter);

    error NotReach(address caller);
    error VenueDrifted(address venue, bytes32 expected, bytes32 found);
    error VenueAbsent(Venue venue);
    error Expired(uint64 deadline);
    error SameToken();
    error ZeroAmount();
    error Slippage(uint256 received, uint256 minOut);
    error BadPath();
    error HookedKey(address hooks);
    error BadPriceLimit();
    error NotPoolManager();
    error WrongCommitment();
    error WrongValue();
    error TransferFailed();
    error AllowanceStuck(address token, address venue);
    error Reentrancy();
}

interface IRouter is IRouterEvents {
    function swap(SwapRequest calldata r) external payable returns (uint256 amountOut);
    function quoteExactIn(SwapRequest calldata r) external;                // always reverts QuoteResult
    function unlockCallback(bytes calldata data) external returns (bytes memory);
    function venues() external view returns (VenueInfo[] memory);

    function HUB() external view returns (address);
    function POOL() external view returns (address);
    function SWAP_ROUTER02() external view returns (address);
    function POOL_MANAGER() external view returns (address);
    function WETH() external view returns (address);
    function POOL_HASH() external view returns (bytes32);
    function SWAP_ROUTER02_HASH() external view returns (bytes32);
    function POOL_MANAGER_HASH() external view returns (bytes32);
    function LAUNCH_HOOK_CODEHASH() external view returns (bytes32);
}
