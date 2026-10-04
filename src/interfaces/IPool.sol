// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IPool — the owned market and the sealed markets

  DESIGN.md §6.1, signatures verbatim. Frozen after wave 0. `marketOf` is
  declared as a function returning the struct (so the Catalog and the
  fingerprint read one value), which means the implementation keeps the
  mapping private and writes the getter — a public mapping would return a
  flat tuple with a different ABI. `openCount`, `sealedCount`, the
  immutables and the constants are U0 choices in the IPSEITY shape.
───────────────────────────────────────────────────────────────────────────*/

struct Market {
    address base; address quote;              // address(0) = native ETH on either side
    uint112 rBase; uint112 rQuote;            // real reserves
    uint16  feeBps;                           // ≤ 500
    uint16  sniperBps; uint64 sniperUntil;    // decaying post-open fee ≤ 9,000 bps over ≤ 98 min
    bool    open; bool sealedMarket;          // sealedMarket = graduation liquidity, no LP authority
    uint64  sealUntil;                        // ratchet ≤ 365 d, survives sale
    uint24  curveBps;                         // concentration 0..80,000, anchored
    uint128 vBase; uint128 vQuote;            // ANCHORED virtual offsets (never written by a trade)
    uint112 feeBaseOwed; uint112 feeQuoteOwed;// sealed markets only
    uint256 beneficiary;                      // sealed markets: the token whose feeSink is paid
}

interface IPoolEvents {
    event MarketOpened(uint256 indexed id, address base, address quote, uint16 feeBps, uint24 curveBps);
    event SealedOpened(uint256 indexed key, bytes32 indexed launchKey, address base, address quote, uint256 beneficiary);
    event MarketClosed(uint256 indexed id);
    event Deposited(uint256 indexed id, uint256 amountBase, uint256 amountQuote);
    event Withdrawn(uint256 indexed id, uint256 amountBase, uint256 amountQuote, address to);
    event Swapped(uint256 indexed key, address indexed trader, bool baseIn, uint256 amountIn, uint256 amountOut, uint256 fee);
    event FeeSet(uint256 indexed id, uint16 feeBps);
    event CurveSynced(uint256 indexed id, uint24 curveBps);
    event CurveAnchored(uint256 indexed key, uint128 vBase, uint128 vQuote);
    event MarketSealed(uint256 indexed id, uint64 until);
    event Collected(uint256 indexed key, address indexed to, uint256 base, uint256 quote);
    event WrittenDown(uint256 indexed id, uint256 base, uint256 quote);

    error NotActor();
    error MarketNotOpen();
    error MarketAlreadyOpen();
    error MarketNotEmpty();
    error SameToken();
    error ZeroAmount();
    error FeeTooHigh();
    error TradeTooLarge();
    error Slippage(uint256 got, uint256 wanted);
    error Expired();
    error WrongValue();
    error TransferFailed();
    error Reentrancy();
    error Sealed(uint64 until);
    error RatchetOnly();
    error TooLong();
    error CurveMoved();
    error CurveTooSteep();
    error SniperTooHigh();
    error Insolvent();
    error NotLaunchpad();
    error SealedMarket();
    error ReserveOverflow();
}

interface IPool is IPoolEvents {
    function openMarket(uint256 id, address base, address quote, uint16 feeBps, uint24 curveBps, uint16 sniperBps, uint32 sniperSeconds) external;  // acts
    function deposit(uint256 id, uint256 amountBase, uint256 amountQuote) external payable;              // acts
    function withdraw(uint256 id, uint256 amountBase, uint256 amountQuote, address to) external;          // acts; never pausable
    function closeMarket(uint256 id) external;                                                            // acts; both reserves zero; deletes
    function swapExactIn(uint256 key, bool baseIn, uint256 amountIn, uint256 minOut, address to, uint64 deadline) external payable returns (uint256 out);
    function swapExactOut(uint256 key, bool baseIn, uint256 amountOut, uint256 maxIn, address to, uint64 deadline) external payable returns (uint256 inUsed);
    function quote(uint256 key, bool baseIn, uint256 amountIn) external view returns (uint256 out);
    function quoteExactOut(uint256 key, bool baseIn, uint256 amountOut) external view returns (uint256 inNeeded);
    function syncCurve(uint256 id, uint24 curveBps, uint24 expected) external;     // acts; refused under seal; reverts CurveMoved
    function setFee(uint256 id, uint16 feeBps) external;                           // acts; refused under seal
    function sealMarket(uint256 id, uint64 until) external;                        // acts; Ratchet.raise(cur, until, 365 days)
    function openSealed(bytes32 launchKey, address base, address quote, uint16 feeBps, uint256 amountBase, uint256 beneficiary) external payable returns (uint256 key);  // LAUNCHPAD only
    function collect(uint256 key) external;                                        // anyone; pays HUB.feeSink(beneficiary)
    function writeDown(uint256 id) external;                                       // acts; reserves := min(reserves, solvent share)
    function marketHash(uint256 key) external view returns (bytes32);
    function openIds(uint256 from, uint256 count) external view returns (uint256[] memory);
    function sealedIds(uint256 from, uint256 count) external view returns (uint256[] memory);

    /*── reading ──*/
    function marketOf(uint256 key) external view returns (Market memory);
    function totalReserved(address token) external view returns (uint256);
    function openCount() external view returns (uint256);
    function sealedCount() external view returns (uint256);
    function sealedKey(bytes32 launchKey) external pure returns (uint256);          // uint256(keccak256("intact.sealed", launchKey))
    function spot(uint256 key) external view returns (uint256 baseInQuote);
    function MAX_FEE_BPS() external view returns (uint16);
    function MAX_OUT_BPS() external view returns (uint16);
    function MAX_CURVE_BPS() external view returns (uint24);
    function MAX_SNIPER_BPS() external view returns (uint16);
    function MAX_SNIPER_SECONDS() external view returns (uint32);
    function HUB() external view returns (address);
    function LAUNCHPAD() external view returns (address);
}
