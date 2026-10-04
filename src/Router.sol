// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRouter, Venue, PoolKey, SwapRequest, VenueInfo} from "./interfaces/IRouter.sol";
import {IIntact} from "./interfaces/IIntact.sol";
import {IPool, Market} from "./interfaces/IPool.sol";
import {AccountBinding} from "./lib/AccountBinding.sol";
import {ExactERC20, IERC20Exact} from "./lib/ExactERC20.sol";
import {Transient} from "./lib/Transient.sol";

/*═══════════════════════════════════════════════════════════════════════════

  ROUTER — the only door a Reach trades through, and nobody else's

  Origin: ANIMA contracts/market/AgentSwapRouter.sol (the pre-call
  snapshots segregated from any pre-existing balance — PR #13 —, the
  exact-approve-then-zero, the balance-delta `minOut`), Pixel-Garden
  src/cartridges/MarketCartridge.sol (the v3 path validator and the v4
  `unlock`/`unlockCallback` commitment) and MASTER integrations/official-
  launch/src/OfficialV4QuoteLens.sol, MIT (quote-by-revert), adapted for
  INTACT (DESIGN.md §3 row 15, §6.2; BUILD-PLAN.md U8).

  What was dropped, and why each drop is the design:

  · `Ownable2Step`, `setVenue`, `setLimit`, `revokeToken`. ANIMA's router
    had an owner who could add a venue, and per-token budgets of its own.
    Here the venues are constructor immutables pinned with their
    `extcodehash` — the table can never grow, and a venue whose code is
    not the code that was pinned is refused on every call (a metamorphic
    redeploy, a CREATE2 resurrection, a chain that swapped a predeploy).
    Budgets live in one place, the Reach's session policy (MUST 15): a
    router that kept its own would be a second ledger for the holder to
    keep in step with the first.

  · opaque `venueCalldata`. ANIMA forwarded whatever bytes the caller
    handed it, which is how `validateTradeCalldata` became a thing to get
    wrong. The Router builds every venue call from typed parameters: a
    market key, a v3 path it has parsed to both ends, a v4 key it has
    checked for a hook. There is no byte in a venue call the caller chose.

  · `agentId` as a parameter. `msg.sender` must BE a canonical Reach:
    `AccountBinding.token(msg.sender)` reads the forwarder footer only when
    the code is exactly 173 bytes, and `HUB.isCanonicalAccount` recomputes
    the CREATE2 address and compares the codehash. An EOA, a contract
    claiming `token()`, a Reach of another collection on the same chain and
    a forged forwarder with the right footer at the wrong address are all
    `NotReach`. So the holder swaps THROUGH their Reach — `execute` or,
    better, `executeTyped` with a receive floor — and an agent's session
    key swaps under the caps the holder granted on the Reach.

  What was kept exactly, because each clause is a drained integration:

  · OUTPUT IS VERIFIED, NOT TRUSTED. The Router measures its own balance
    of `tokenOut` before and after the venue call and requires the delta
    to clear `minOut`. A venue that lies about its return value, or a
    route that silently part-fills, fails here. test/Router.t.sol's
    `UnderDeliveringVenue` returns the number it was asked for and pays
    less.

  · APPROVALS NEVER OUTLIVE THE CALL. Exactly `amountIn` is approved to
    the venue, and the allowance is zeroed and READ BACK as zero before
    the call returns (`AllowanceStuck` otherwise). A compromised venue
    cannot come back later for the rest.

  · PRE-EXISTING BALANCES ARE NOT THIS SWAP'S. The snapshots are taken
    before the pull, so a stray transfer or venue residue sitting in the
    Router is neither a windfall for this caller nor refunded to it (A PR
    #13). Only this call's unconsumed input goes back.

  Native legs: `address(0)` on either side. The owned Pool and v4 quote
  ether directly; v3 does not, so the Router wraps into `WETH` before a v3
  leg and unwraps after it (Pixel-Garden `_swapV3`), and the path is
  validated with WETH substituted at the native end.

  "Quote is a settlement." `quoteExactIn` runs the venue's real path and
  reverts `QuoteResult(spent, received, sqrtPriceAfter)`: the owned Pool
  through its own pure pricing (the one function its swap uses), v4 by
  the MASTER lens — unlock, swap, read the price, revert before settling,
  so nothing is ever owed. v3 has no path that can be dry-run without the
  pool's callback paying, so the Router says `NoQuote` rather than guess;
  the page shows a v3 quote only when a quoter is wired to it.

═══════════════════════════════════════════════════════════════════════════*/

/// @dev Uniswap v3 periphery `SwapRouter02.exactInput` — no deadline in
///      the struct (SwapRouter02 takes it through `multicall`); the Router
///      checks its own.
interface ISwapRouter02 {
    struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

/// @dev The six v4-core PoolManager entries a swap needs, declared here
///      rather than imported (no dependency outside src/). `BalanceDelta`
///      is an `int256`: amount0 in the upper 128 bits, amount1 in the lower.
interface IPoolManagerV4 {
    struct SwapParams { bool zeroForOne; int256 amountSpecified; uint160 sqrtPriceLimitX96; }
    function unlock(bytes calldata data) external returns (bytes memory);
    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData) external returns (int256);
    function sync(address currency) external;
    function settle() external payable returns (uint256 paid);
    function take(address currency, address to, uint256 amount) external;
    function extsload(bytes32 slot) external view returns (bytes32);
}

contract Router is IRouter {
    /*═══════════════════ the pinned world ═══════════════════*/

    address public immutable HUB;
    address public immutable POOL;
    address public immutable SWAP_ROUTER02;
    address public immutable POOL_MANAGER;
    address public immutable WETH;
    bytes32 public immutable POOL_HASH;
    bytes32 public immutable SWAP_ROUTER02_HASH;
    bytes32 public immutable POOL_MANAGER_HASH;
    /// @dev Zero until U14 deploys the LaunchHook template; while it is zero
    ///      ONLY hookless keys pass, because a codeless hook address also
    ///      reports a zero codehash and must never match.
    bytes32 public immutable LAUNCH_HOOK_CODEHASH;

    /*  v4-core TickMath bounds. A limit at either bound is "no limit" in
        every practical sense, and 0 / max are what a copy-paste leaves
        behind; the design asks for a real limit, so the open interval. */
    uint160 internal constant MIN_SQRT_PRICE = 4295128739;
    uint160 internal constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;
    /// @dev v4-core StateLibrary.POOLS_SLOT: `pools` is the manager's 7th
    ///      declared slot; a pool's state word is keccak(poolId ‖ 6) and
    ///      its slot0 packs sqrtPriceX96 into the low 160 bits.
    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));

    uint8 internal constant MODE_SWAP = 1;
    uint8 internal constant MODE_QUOTE = 2;

    /*── errors beyond IRouterEvents (additive; U0's list had no v4 settlement words) ──*/
    /// @notice The venue's delta had the wrong sign or size for an exact-input swap.
    error BadDelta(int128 din, int128 dout);
    /// @notice This venue cannot be dry-run from here; the page quotes it elsewhere.
    error NoQuote(Venue venue);
    /// @notice v4 deltas are int128; an input above that cannot be an exact-input swap.
    error AmountTooLarge(uint256 amountIn);

    constructor(
        address hub, address pool, address swapRouter02, address poolManager, address weth, bytes32 launchHookCodehash
    ) {
        if (pool.code.length == 0) revert VenueAbsent(Venue.OwnPool);
        if (swapRouter02 != address(0) && (swapRouter02.code.length == 0 || weth.code.length == 0)) {
            revert VenueAbsent(Venue.UniswapV3);
        }
        if (poolManager != address(0) && poolManager.code.length == 0) revert VenueAbsent(Venue.UniswapV4);
        /*  keccak256("") is the codehash of an existing account with no
            code. Pinning it as "our hook" would admit every such address
            as a hook, and v4 would then call into nothing.              */
        if (launchHookCodehash == keccak256("")) revert HookedKey(address(0));
        HUB = hub;
        POOL = pool;
        SWAP_ROUTER02 = swapRouter02;
        POOL_MANAGER = poolManager;
        WETH = weth;
        POOL_HASH = pool.codehash;
        SWAP_ROUTER02_HASH = swapRouter02 == address(0) ? bytes32(0) : swapRouter02.codehash;
        POOL_MANAGER_HASH = poolManager == address(0) ? bytes32(0) : poolManager.codehash;
        LAUNCH_HOOK_CODEHASH = launchHookCodehash;
    }

    /// @dev Ether arrives only from the three places a swap can make it
    ///      arrive: WETH unwrapping, the Pool paying a native leg, the
    ///      PoolManager's `take`. Anything else is refused rather than
    ///      stranded, since no path ever refunds a pre-existing balance.
    receive() external payable {
        if (msg.sender != WETH && msg.sender != POOL && msg.sender != POOL_MANAGER) revert WrongValue();
    }

    /*═══════════════════ the swap ═══════════════════*/

    /// @notice Swap exactly `amountIn` of `tokenIn` for at least `minOut`
    ///         of `tokenOut` at the named venue. `msg.sender` must be a
    ///         canonical Reach of `HUB`; output and unspent input are
    ///         pushed back to it.
    function swap(SwapRequest calldata r) external payable returns (uint256 amountOut) {
        Transient.enter(Transient.ROUTER_LOCK);
        _onlyReach();
        if (block.timestamp > r.deadline) revert Expired(r.deadline);
        if (r.amountIn == 0) revert ZeroAmount();
        if (r.tokenIn == r.tokenOut) revert SameToken();
        bool nativeIn = r.tokenIn == address(0);
        if (msg.value != (nativeIn ? r.amountIn : 0)) revert WrongValue();

        /*  Snapshots BEFORE the pull, net of this call's own value: what
            was here already is not this swap's to spend or to refund.    */
        uint256 inBefore = _held(r.tokenIn) - msg.value;
        uint256 outBefore = _held(r.tokenOut);
        if (!nativeIn) ExactERC20.transferFromExact(r.tokenIn, msg.sender, address(this), r.amountIn);

        if (r.venue == Venue.OwnPool) _viaPool(r, nativeIn);
        else if (r.venue == Venue.UniswapV3) _viaV3(r, nativeIn);
        else _viaV4(r);

        /*  Trust the ledger, not the venue's return value. A venue that
            consumed less than it was approved leaves the difference here,
            and only that difference goes back.                            */
        uint256 unspent = _held(r.tokenIn) - inBefore;
        amountOut = _held(r.tokenOut) - outBefore;
        if (amountOut < r.minOut) revert Slippage(amountOut, r.minOut);

        _push(r.tokenOut, msg.sender, amountOut);
        if (unspent != 0) _push(r.tokenIn, msg.sender, unspent);
        emit Swapped(msg.sender, r.venue, r.tokenIn, r.tokenOut, r.amountIn - unspent, amountOut);
        Transient.exit(Transient.ROUTER_LOCK);
    }

    /*═══════════════════ the venues ═══════════════════*/

    /// @dev The owned Pool prices in its own two tokens; the request's
    ///      pair must be exactly the market's pair, in either direction.
    function _viaPool(SwapRequest calldata r, bool nativeIn) private {
        _pinned(Venue.OwnPool);
        bool baseIn = _poolDirection(r);
        _grant(r.tokenIn, POOL, r.amountIn);
        IPool(POOL).swapExactIn{value: nativeIn ? r.amountIn : 0}(
            r.poolKey, baseIn, r.amountIn, r.minOut, address(this), r.deadline
        );
        _zero(r.tokenIn, POOL);
    }

    function _poolDirection(SwapRequest calldata r) private view returns (bool baseIn) {
        Market memory m = IPool(POOL).marketOf(r.poolKey);
        if (m.base == r.tokenIn && m.quote == r.tokenOut) return true;
        if (m.quote == r.tokenIn && m.base == r.tokenOut) return false;
        revert BadPath();
    }

    /*  Pixel-Garden's validator, kept to the byte: 43–112 bytes (one to
        four hops of 20 + 3 + 20), the modulus that makes every hop
        well-formed, and both ends read from the path and compared with the
        request's pair — WETH standing in at a native end. A path that
        begins or ends elsewhere would make the venue spend one token and
        deliver another, and the balance deltas would catch it only after
        the gas was spent.                                                */
    function _viaV3(SwapRequest calldata r, bool nativeIn) private {
        _pinned(Venue.UniswapV3);
        bytes calldata path = r.path;
        if (path.length < 43 || path.length > 112 || (path.length - 20) % 23 != 0) revert BadPath();
        address first;
        address last;
        assembly ("memory-safe") {
            first := shr(96, calldataload(path.offset))
            last := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
        bool nativeOut = r.tokenOut == address(0);
        address input = nativeIn ? WETH : r.tokenIn;
        address output = nativeOut ? WETH : r.tokenOut;
        if (first != input || last != output || input == output) revert BadPath();

        // a native end is wrapped for the venue and unwrapped after it;
        // the WETH delta is measured so no wrapped ether is left behind
        uint256 wethBefore = (nativeIn || nativeOut) ? IERC20Exact(WETH).balanceOf(address(this)) : 0;
        if (nativeIn) IWETH(WETH).deposit{value: r.amountIn}();
        _grant(input, SWAP_ROUTER02, r.amountIn);
        ISwapRouter02(SWAP_ROUTER02).exactInput(
            ISwapRouter02.ExactInputParams(path, address(this), r.amountIn, r.minOut)
        );
        _zero(input, SWAP_ROUTER02);
        if (nativeIn || nativeOut) {
            uint256 w = IERC20Exact(WETH).balanceOf(address(this));
            if (w > wethBefore) IWETH(WETH).withdraw(w - wethBefore);
        }
    }

    /*  v4 is one call and one callback. The callback can be invoked by the
        manager for any reason in any transaction, so it is bound to this
        swap by a single-use commitment in transient storage: the hash of
        the exact bytes `unlock` was given, written before the call, read
        and cleared by the callback, and checked clear afterwards. A
        callback that arrives without a commitment, with other bytes, or
        twice, is refused.                                                 */
    function _viaV4(SwapRequest calldata r) private {
        bytes memory data = _v4Data(r, MODE_SWAP);
        Transient.commit(Transient.ROUTER_COMMIT, keccak256(data));
        IPoolManagerV4(POOL_MANAGER).unlock(data);
        if (Transient.peek(Transient.ROUTER_COMMIT) != bytes32(0)) revert WrongCommitment();
    }

    function _v4Data(SwapRequest calldata r, uint8 mode) private view returns (bytes memory) {
        _pinned(Venue.UniswapV4);
        PoolKey calldata k = r.v4Key;
        bool zeroForOne;
        if (k.currency0 == r.tokenIn && k.currency1 == r.tokenOut) zeroForOne = true;
        else if (k.currency1 == r.tokenIn && k.currency0 == r.tokenOut) zeroForOne = false;
        else revert BadPath();
        if (k.currency0 >= k.currency1) revert BadPath();       // v4 keys are sorted; anything else is no pool
        if (k.hooks != address(0) &&
            (LAUNCH_HOOK_CODEHASH == bytes32(0) || k.hooks.codehash != LAUNCH_HOOK_CODEHASH)) {
            revert HookedKey(k.hooks);
        }
        if (r.sqrtPriceLimitX96 <= MIN_SQRT_PRICE || r.sqrtPriceLimitX96 >= MAX_SQRT_PRICE) revert BadPriceLimit();
        if (r.amountIn > type(uint128).max) revert AmountTooLarge(r.amountIn);
        return abi.encode(mode, k, zeroForOne, r.amountIn, r.sqrtPriceLimitX96, r.minOut);
    }

    /// @notice The v4 unlock callback: swap, require an exact-input shape,
    ///         then settle the input and take the output — or, when
    ///         quoting, revert with the result before anything is owed.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != POOL_MANAGER) revert NotPoolManager();
        bytes32 c = Transient.peek(Transient.ROUTER_COMMIT);
        if (c == bytes32(0) || c != keccak256(data)) revert WrongCommitment();
        Transient.commit(Transient.ROUTER_COMMIT, bytes32(0));

        (uint8 mode, PoolKey memory k, bool zeroForOne, uint256 amountIn, uint160 limit, uint256 minOut) =
            abi.decode(data, (uint8, PoolKey, bool, uint256, uint160, uint256));
        IPoolManagerV4 pm = IPoolManagerV4(POOL_MANAGER);
        int256 delta = pm.swap(k, IPoolManagerV4.SwapParams(zeroForOne, -int256(amountIn), limit), "");
        int128 d0;
        int128 d1;
        assembly ("memory-safe") {
            d0 := sar(128, delta)
            d1 := signextend(15, delta)
        }
        (int128 din, int128 dout) = zeroForOne ? (d0, d1) : (d1, d0);
        if (din >= 0 || dout <= 0) revert BadDelta(din, dout);
        uint256 spent = uint256(uint128(-din));
        uint256 received = uint256(uint128(dout));
        uint160 priceAfter = uint160(uint256(
            pm.extsload(keccak256(abi.encodePacked(keccak256(abi.encode(k)), POOLS_SLOT)))
        ));
        if (mode == MODE_QUOTE) revert QuoteResult(spent, received, priceAfter);
        if (spent > amountIn) revert BadDelta(din, dout);
        if (received < minOut) revert Slippage(received, minOut);

        (address input, address output) = zeroForOne ? (k.currency0, k.currency1) : (k.currency1, k.currency0);
        pm.sync(input);
        if (input != address(0)) ExactERC20.transferExact(input, POOL_MANAGER, spent);
        if (pm.settle{value: input == address(0) ? spent : 0}() != spent) revert TransferFailed();
        pm.take(output, address(this), received);
        return abi.encode(spent, received, priceAfter);
    }

    /*═══════════════════ the quote ═══════════════════*/

    /// @notice Always reverts: `QuoteResult(spent, received, sqrtPriceAfter)`
    ///         with the venue's real result, or the reason there is none.
    ///         `sqrtPriceAfter` is 0 for the owned Pool, which has no sqrt
    ///         price (the page reads `Pool.spot`).
    function quoteExactIn(SwapRequest calldata r) external {
        if (r.amountIn == 0) revert ZeroAmount();
        if (r.tokenIn == r.tokenOut) revert SameToken();
        if (r.venue == Venue.OwnPool) {
            _pinned(Venue.OwnPool);
            bool baseIn = _poolDirection(r);
            revert QuoteResult(r.amountIn, IPool(POOL).quote(r.poolKey, baseIn, r.amountIn), 0);
        }
        if (r.venue == Venue.UniswapV4) {
            bytes memory data = _v4Data(r, MODE_QUOTE);
            Transient.commit(Transient.ROUTER_COMMIT, keccak256(data));
            IPoolManagerV4(POOL_MANAGER).unlock(data);   // the callback reverts QuoteResult through it
            revert NoQuote(Venue.UniswapV4);             // a manager that never called back
        }
        revert NoQuote(Venue.UniswapV3);
    }

    /*═══════════════════ the manifest ═══════════════════*/

    /// @notice The venue table, in `hooklist` shape. A row with `at == 0`
    ///         is a venue this band does not have; the page says so.
    function venues() external view returns (VenueInfo[] memory v) {
        v = new VenueInfo[](3);
        v[0] = VenueInfo("Intact Pool", POOL, POOL_HASH, 0, false, "");
        v[1] = VenueInfo("Uniswap v3 SwapRouter02", SWAP_ROUTER02, SWAP_ROUTER02_HASH, 0, false, "");
        v[2] = VenueInfo("Uniswap v4 PoolManager", POOL_MANAGER, POOL_MANAGER_HASH, 0, false, "");
    }

    /*═══════════════════ guards and primitives ═══════════════════*/

    /// @dev A canonical Reach of this hub on this chain: the footer says
    ///      so AND CREATE2 agrees AND the codehash is the forwarder's.
    function _onlyReach() private view {
        (uint256 chain, address collection, uint256 id) = AccountBinding.token(msg.sender);
        if (chain != block.chainid || collection != HUB || !IIntact(HUB).isCanonicalAccount(msg.sender, id, false)) {
            revert NotReach(msg.sender);
        }
    }

    /// @dev Present, and still the code that was pinned.
    function _pinned(Venue v) private view {
        (address at, bytes32 want) = v == Venue.OwnPool ? (POOL, POOL_HASH)
            : v == Venue.UniswapV3 ? (SWAP_ROUTER02, SWAP_ROUTER02_HASH)
            : (POOL_MANAGER, POOL_MANAGER_HASH);
        if (at == address(0)) revert VenueAbsent(v);
        bytes32 found = at.codehash;
        if (found != want) revert VenueDrifted(at, want, found);
    }

    function _held(address token) private view returns (uint256) {
        return token == address(0) ? address(this).balance : IERC20Exact(token).balanceOf(address(this));
    }

    function _grant(address token, address venue, uint256 amount) private {
        if (token != address(0)) ExactERC20.approveExact(token, venue, amount);
    }

    /// @dev Zero it unconditionally and prove it: a venue that consumed less
    ///      than the allowance would otherwise keep a standing claim on this
    ///      contract's balance, and a token whose `approve(0)` does not take
    ///      must fail the swap rather than leave one behind.
    function _zero(address token, address venue) private {
        if (token == address(0)) return;
        (bool ok, ) = token.call(abi.encodeCall(IERC20Exact.approve, (venue, 0)));
        ok;   // the read-back is the check, not the call's answer
        if (IERC20Exact(token).allowance(address(this), venue) != 0) revert AllowanceStuck(token, venue);
    }

    function _push(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
            return;
        }
        ExactERC20.transferExact(token, to, amount);
    }
}
