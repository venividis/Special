// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Metadata} from "./Standards.sol";

/*───────────────────────────────────────────────────────────────────────────
  IKeepsake — bundles you keep or give, that free slowly (V2, unit W1)

  docs/V2.md §3.1. A keepsake is an ERC-721 whose token holds up to
  MAX_ASSETS assets (native ETH as address(0), ERC-20s pulled by exact
  delta) under one schedule: nothing frees before `cliff`, then a linear
  release from `start` to `end`, everything at `end`. Its holder is paid
  what has freed; anyone may press `claim`, and it pays only the holder (a
  claim that needs the holder awake on the right day is a claim that
  rots). Giving one is transferring it, or wrapping it to someone else
  with a message on its face.

  `swapAndWrap` swaps on the Pool and wraps the output in the same call:
  "lock what I receive". A drip lets anyone sell what has freed of one
  asset through a Pool market, at most `maxPerDrip` and never below the
  holder's floor, into the keepsake's proceeds, which the holder is paid
  with the next claim: "sell slowly as it frees". There is no oracle: the
  floor is the whole price guard, and a drip without one is refused.

  Nothing opens a keepsake early. `extend` only lengthens (the Ratchet
  rule, MAX_TERM cap). `commitmentOf(account)` moves when a keepsake
  leaves `account` and when the terms of one it holds change (extend, a
  drip set or cleared). It never moves on what a stranger can do — a wrap
  or a transfer TO the account, a claim, a drip — so a gift cannot break a
  listing, as the hub's fingerprint already excludes balances. The hub's
  fingerprint reads `commitmentOf(account(id))` (V2 W6), so a listing pins
  the keepsakes in the token's Reach. Locks (V1) stays beside this for the
  Launchpad's creator vests.

  Frozen after V2 wave 0: additive changes only, recorded in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

/// @notice One asset of a bundle. `token == address(0)` is native ETH.
struct Asset {
    address token;
    uint256 amount;
}

/// @notice When a keepsake frees. `start == 0` means now, and a start in
///         the past is refused; `cliff == 0` means `start`; `end >= cliff`;
///         `end > start` unless all three are equal (everything frees at
///         once, at `cliff`).
struct Schedule {
    uint64 start;
    uint64 cliff;
    uint64 end;
}

/// @notice A standing order to sell one asset slowly as it frees.
///         `floor == 0` is "no drip". The floor is output units per 1e18
///         input units, so `minOut = ceil(sold × floor / 1e18)`.
struct DripTerms {
    uint8   asset;        // index into the keepsake's assets
    uint256 market;       // the Pool market key it sells into; one side must be the asset
    uint256 floor;        // output per 1e18 input, at the least; never 0 for a live drip
    uint256 maxPerDrip;   // the most one drip sells, > 0
}

/// @notice `wrap`'s arguments.
struct Wrap {
    Asset[]   assets;     // 1..MAX_ASSETS, distinct tokens, every amount > 0
    Schedule  schedule;
    address   to;         // who holds the keepsake; a gift is to != msg.sender
    string    message;    // ≤ MAX_MESSAGE bytes, printed on the keepsake's face
    DripTerms drip;       // floor 0 = none; a drip is set at wrap only when to == msg.sender
}

/// @notice `swapAndWrap`'s arguments: a Pool swap whose output is wrapped.
struct SwapAndWrap {
    uint256   market;     // the Pool market key
    bool      baseIn;     // true: pay the market's base, receive its quote
    uint256   amountIn;   // pulled exactly from msg.sender, or msg.value for native
    uint256   minOut;
    uint64    deadline;
    Schedule  schedule;
    address   to;
    string    message;
    DripTerms drip;       // floor 0 = none; drip.asset must be 0 (the output)
}

/// @notice Everything about one keepsake, for a page or an agent.
struct KeepsakeView {
    address   holder;
    address   creator;
    uint64    createdAt;
    Schedule  schedule;
    Asset[]   assets;     // as wrapped
    uint256[] paid;       // per asset, paid to holders so far
    uint256[] sold;       // per asset, sold by drips so far
    Asset[]   proceeds;   // what drips earned and no holder has been paid yet
    string    message;
    DripTerms drip;       // floor 0 = none
    uint64    lastDripBlock;
}

interface IKeepsakeEvents {
    event Wrapped(uint256 indexed id, address indexed creator, address indexed to, uint64 start, uint64 cliff, uint64 end, uint256 assets, string message);
    event Paid(uint256 indexed id, address indexed holder, address indexed token, uint256 amount);
    event Extended(uint256 indexed id, uint64 previousEnd, uint64 newEnd);
    event DripSet(uint256 indexed id, uint8 asset, uint256 market, uint256 floor, uint256 maxPerDrip);
    event DripCleared(uint256 indexed id);
    event Dripped(uint256 indexed id, address indexed by, address tokenIn, uint256 sold, address tokenOut, uint256 got);

    error NoAssets();
    error TooManyAssets();
    error ZeroAmount();
    error DuplicateAsset(address token);
    error BadSchedule();
    error TooLong();
    error MessageTooLong(uint256 length);
    error WrongValue(uint256 expected, uint256 provided);
    error ZeroRecipient();
    error NotHolder();
    error NothingFreed();
    error RatchetOnly();
    error NoDrip();
    error BadDrip();
    error WrongMarket(uint256 market);
    error OnePerBlock();
    error BelowFloor(uint256 got, uint256 floorOut);
    error NoSuchKeepsake(uint256 id);
    error TransferFailed();
    error Reentrancy();
}

interface IKeepsake is IKeepsakeEvents, IERC721Metadata {
    /// @notice Wrap `w.assets` under `w.schedule` into a new keepsake held by
    ///         `w.to`. Native ETH is `msg.value`, which must equal the ETH
    ///         asset's amount exactly (0 when there is none).
    function wrap(Wrap calldata w) external payable returns (uint256 id);
    /// @notice Swap on the Pool and wrap the output in one call. `out` is
    ///         what the keepsake holds, measured by balance delta.
    function swapAndWrap(SwapAndWrap calldata p) external payable returns (uint256 id, uint256 out);
    /// @notice Anyone; pays the keepsake's holder every freed amount and
    ///         every drip proceed. Reverts NothingFreed when there is none.
    function claim(uint256 id) external returns (Asset[] memory paid);
    function claimable(uint256 id) external view returns (Asset[] memory freed, Asset[] memory proceeds);
    /// @notice The holder lengthens the schedule's end. It never shortens.
    function extend(uint256 id, uint64 newEnd) external;
    function setDrip(uint256 id, DripTerms calldata terms) external;   // holder
    function clearDrip(uint256 id) external;                           // holder
    /// @notice Anyone sells what has freed of the drip's asset and is not
    ///         yet paid or sold, at most `maxPerDrip`, never below the
    ///         floor, at most once per block per keepsake.
    function drip(uint256 id) external returns (uint256 sold, uint256 got);
    function keepsakeOf(uint256 id) external view returns (KeepsakeView memory);
    function commitmentOf(address account) external view returns (bytes32);
    function keepsakeCount() external view returns (uint256);
    function MAX_ASSETS() external view returns (uint256);    // 8
    function MAX_TERM() external view returns (uint64);       // 3,650 days
    function MAX_MESSAGE() external view returns (uint256);   // 280
    function POOL() external view returns (address);
    function HUB() external view returns (address);
}
