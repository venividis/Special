// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  ILaunchpad — the credits raise and its graduation

  DESIGN.md §8.1-8.3; from ANIMA AgentLaunchpad.sol. Frozen after wave 0.
  Buyers hold credits, not tokens, until graduation; `graduate` and `fail`
  are permissionless; per-launch balances are isolated; fee legs are
  immutable per launch; the first launch of a token needs `holds` or the
  guardian's epoch-stamped co-sign. `Target.UniswapV4` reverts `NotYet`
  until U14. Field names follow ANIMA where DESIGN is silent.
───────────────────────────────────────────────────────────────────────────*/

enum Target { OwnedPool, UniswapV4 }
enum LaunchState { None, Live, Graduated, Failed }

struct LaunchParams {
    uint256 id;                 // the launching token
    address coin;               // a Coin the Kiln minted with a raise share to the Launchpad
    uint128 curveSupply;        // sold on the curve
    uint128 virtualQuote;       // curve seed; sets the opening price
    uint128 graduationTarget;   // raised amount that closes the curve
    uint64  startsAt;           // ≥ now
    uint64  fairWindow;         // ≤ 1 d
    uint128 maxBuyInWindow;     // per address, during the fair window
    uint16  snipeTaxStartBps;   // ≤ 9,900, decays linearly to zero over fairWindow
    uint16  feeBps;             // ≤ 100
    uint16  creatorBps;         // ≤ 1,500 of the fee → feeSink(id)
    uint16  creatorVestBps;     // ≤ 1,500 of supply → Locks, beneficiary account(id)
    uint64  deadline;           // ≤ now + 30 d; `fail` opens after it
    Target  target;
}

struct Launch {
    uint256 id;
    address coin;
    Target  target;
    LaunchState state;
    uint128 quoteReserve;       // augmented reserve: starts at virtualQuote
    uint128 baseReserve;        // augmented reserve: starts at curveSupply
    uint128 curveSupply;
    uint128 liquiditySupply;    // what graduates into the market
    uint128 baseSold;
    uint128 raised;             // real quote held for this launch
    uint64  startsAt;
    uint64  fairWindowEnds;
    uint64  deadline;
    uint128 maxBuyInWindow;
    uint16  snipeTaxStartBps;
    uint16  feeBps;
    uint16  creatorBps;
    bytes32 termsHash;          // keccak256(abi.encode(LaunchParams))
    uint64  epoch;              // custody epoch at creation
    uint256 marketKey;          // the sealed market after graduation (OwnedPool)
}

interface ILaunchpadEvents {
    event LaunchCreated(uint256 indexed launchId, uint256 indexed id, address indexed coin, Target target, bytes32 termsHash);
    event Bought(uint256 indexed launchId, address indexed buyer, uint256 quoteIn, uint256 baseOut, uint256 fee, uint256 snipe);
    event Sold(uint256 indexed launchId, address indexed seller, uint256 baseIn, uint256 quoteOut, uint256 fee);
    event Graduated(uint256 indexed launchId, uint256 indexed key, uint256 terminalPrice, uint256 poolSpot);
    event LaunchFailed(uint256 indexed launchId);
    event Refunded(uint256 indexed launchId, address indexed buyer, uint256 amount);
    event Claimed(uint256 indexed launchId, address indexed buyer, uint256 amount);
    event FirstLaunchApproved(uint256 indexed id, address indexed guardian, uint64 epoch);

    error NotActor();
    error NotHolder();
    error NotGuardian();
    error FirstLaunchNeedsHolderOrGuardian(uint256 id);
    error TooSoon(uint64 until);
    error TermsMoved(bytes32 expected, bytes32 actual);
    error NoSuchLaunch(uint256 launchId);
    error NotLive(uint256 launchId);
    error NotStarted(uint64 startsAt);
    error StartsInThePast(uint64 startsAt);
    error DeadlinePassed(uint64 deadline);
    error DeadlineTooFar(uint64 deadline);
    error NotGraduatable(uint256 launchId);
    error NotFailable(uint256 launchId);
    error AlreadyGraduated(uint256 launchId);
    error FairWindowCapExceeded(uint256 attempted, uint256 cap);
    error FairWindowTooLong(uint64 window);
    error CurveExhausted(uint256 requested, uint256 available);
    error SlippageExceeded(uint256 got, uint256 min);
    error FeeTooHigh(uint16 bps);
    error CreatorShareTooHigh(uint16 bps);
    error SnipeTaxTooHigh(uint16 bps);
    error BadCurveParameters();
    error WrongCoin(address coin);
    error WrongTarget();
    error NotYet();
    error ZeroAmount();
    error WrongValue();
    error NothingToClaim();
    error TransferFailed();
    error Reentrancy();
    error Expired();
}

interface ILaunchpad is ILaunchpadEvents {
    function create(LaunchParams calldata p) external returns (uint256 launchId);                              // acts (first: holds or guardian co-sign)
    function createChecked(LaunchParams calldata p, bytes32 expectedTermsHash) external returns (uint256 launchId);
    function approveFirstLaunch(uint256 id) external;                                                           // the token's guardian; epoch-stamped
    function buy(uint256 launchId, uint256 minBaseOut, uint64 deadline, uint16 maxFeeBps) external payable returns (uint256 baseOut);
    function sell(uint256 launchId, uint256 baseIn, uint256 minQuoteOut, uint64 deadline) external returns (uint256 quoteOut);
    function graduate(uint256 launchId) external;                                                               // anyone, once the target is met
    function fail(uint256 launchId) external;                                                                   // anyone, after deadline short of target
    function refund(uint256 launchId, address buyer) external;                                                  // anyone; recipient fixed
    function claim(uint256 launchId, address buyer) external;                                                   // anyone; recipient fixed

    /*── reading ──*/
    function launchOf(uint256 launchId) external view returns (Launch memory);
    function creditOf(uint256 launchId, address buyer) external view returns (uint256);
    function boughtInWindow(uint256 launchId, address buyer) external view returns (uint256);
    function launchesOf(uint256 id) external view returns (uint256[] memory);
    function launchRoot(uint256 id) external view returns (bytes32);              // in the fingerprint
    function lastLaunchAt(uint256 id) external view returns (uint64);
    function firstLaunchApproved(uint256 id) external view returns (bool);         // live only under the current epoch
    function termsHash(LaunchParams calldata p) external pure returns (bytes32);
    function quoteBuy(uint256 launchId, uint256 quoteIn) external view returns (uint256 baseOut, uint256 fee, uint256 snipe);
    function quoteSell(uint256 launchId, uint256 baseIn) external view returns (uint256 quoteOut, uint256 fee);
    function snipeTaxBps(uint256 launchId) external view returns (uint256);
    function raisedOf(uint256 launchId) external view returns (uint256);
    function launchCount() external view returns (uint256);

    function MAX_FAIR_WINDOW() external view returns (uint64);      // 1 days
    function MAX_SNIPE_TAX_BPS() external view returns (uint16);    // 9,900
    function MAX_FEE_BPS() external view returns (uint16);          // 100
    function MAX_CREATOR_BPS() external view returns (uint16);      // 1,500 of the fee
    function MAX_CREATOR_VEST_BPS() external view returns (uint16); // 1,500 of supply
    function MAX_DEADLINE() external view returns (uint64);         // 30 days
    function LAUNCH_SPACING() external view returns (uint64);       // 7 days
    function HUB() external view returns (address);
    function KILN() external view returns (address);
    function POOL() external view returns (address);
    function LOCKS() external view returns (address);
    function CUSTODIAN() external view returns (address);           // address(0) until U14
}
