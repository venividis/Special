// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Origin: NEW for INTACT (U14; brief MUST 17; DESIGN.md §8.3–8.4, §3 row 24).
// Ideas from MASTER `GenesisV4Position` (a position held by a contract
// that pays its fees onward), the IPSEITY branch `V4PositionPlanner` (the
// PositionManager action encoding in Solidity, liquidity from live price)
// and MASTER integrations/console/lib/v4-position-encoder.mjs (the native
// mint is `MINT_POSITION, SETTLE_PAIR, SWEEP`); the Permit2 expiry lesson is
// Pixel-Garden's (src/cartridges/MarketCartridge.sol).

import {
    ILPCustodian, PoolKey, HookTerms, Custody
} from "./interfaces/ILPCustodian.sol";
import {IKiln} from "./interfaces/IKiln.sol";
import {ILaunchpad} from "./interfaces/ILaunchpad.sol";
import {IIntact} from "./interfaces/IIntact.sol";
import {Rights, IRightsHub} from "./lib/Rights.sol";
import {Hook} from "./lib/Hook.sol";
import {Mul} from "./lib/Mul.sol";
import {Ratchet} from "./lib/Ratchet.sol";
import {Transient} from "./lib/Transient.sol";
import {IERC20Exact} from "./lib/ExactERC20.sol";

/*  The three v4 surfaces this contract touches, declared by selector.
    v4-core PoolManager: `initialize` (the final release, no hookData) and
    `extsload`, through which StateLibrary reads slot0. v4-periphery
    PositionManager: `modifyLiquidities` and the ERC-721 views of the
    position. Permit2 AllowanceTransfer: `approve` (0x87517c45) and
    `allowance`.                                                           */
interface IPoolManagerV4 {
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
    function extsload(bytes32 slot) external view returns (bytes32);
}

interface IPositionManagerV4 {
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function nextTokenId() external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getPositionLiquidity(uint256 tokenId) external view returns (uint128);
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
    function allowance(address owner, address token, address spender) external view returns (uint160, uint48, uint48);
}

/*───────────────────────────────────────────────────────────────────────────
  LPCustodian — where a v4 launch's liquidity lives, and who it answers to

  A raise that graduates into Uniswap v4 has to put its liquidity somewhere
  a holder can trust and a buyer of the Intact can inherit. This contract
  is that somewhere: every launch's full-range position is minted TO IT,
  and what it does with a position is the whole of its ABI —

    `collect`  anyone, any time: every fee the position earned goes to
               `feeSink(id)`, whoever holds the token that launched it;
    `release`  the holder or the Reach, only after `unlocksAt`, only to the
               Reach: the principal goes home, never anywhere else;
    `extend`   the holder's own ratchet on `unlocksAt` — only later, never
               past ten years (src/lib/Ratchet.sol, the one rule).

  No admin, no setter, no rescue. The hook's `beforeRemoveLiquidity` keeps
  the pool from paying principal out before the hook's UNLOCKS; this
  contract keeps itself from asking before its own `unlocksAt`, which
  starts at the hook's date and only lengthens.

  ── seeding ──

  The Launchpad graduates a v4 launch by calling `seed` with the raise as
  value and an exact allowance of the coin. The pool is keyed to the
  launch's own hook, which this contract deploys through the Kiln if
  nobody did already (a salt mined off chain, registered at `createV4`).
  If a stranger initialised that pool first — v4's `initialize` is open —
  its price must be within 1 % of the terminal price or seeding refuses
  with both prices in the error, and the launcher may `resalt`: a new hook
  address is a new PoolKey, so a new pool nobody has touched.

  The coin reaches the PositionManager the only way it accepts an ERC-20:
  through Permit2, with an approval that names a real expiry. Permit2 reads
  an expiry of zero as "expires at this block" (Pixel-Garden's lesson), so
  zero is never written here, and both approvals are zeroed and re-read in
  the same call.

  The coin is always a Kiln `Coin` — a plain ERC-20 that returns `true` —
  so its transfers are checked by return value and, where it matters, by
  balance delta, without the generic library's tolerance for tokens that
  return nothing.
───────────────────────────────────────────────────────────────────────────*/
contract LPCustodian is ILPCustodian {
    address public immutable HUB;
    address public immutable LAUNCHPAD;
    address public immutable KILN;
    address public immutable POOL_MANAGER;
    address public immutable POSITION_MANAGER;
    address public immutable PERMIT2;

    /*  The constants a deployment record pins per band and verify-launch
        asserts (DESIGN.md §12). Action bytes: v4-periphery
        src/libraries/Actions.sol at dce236d4e2057422d0791d9a973a58765eb46f65.
        POOLS_SLOT: v4-core StateLibrary. The grid: tick spacing 60, the
        outermost usable ticks and their sqrt prices from TickMath.        */
    uint8  public constant HOOK_KIND          = 1;
    uint16 public constant HOOK_FLAGS         = uint16(Hook.BEFORE_INITIALIZE | Hook.BEFORE_SWAP | Hook.BEFORE_REMOVE_LIQUIDITY);
    uint8  public constant DECREASE_LIQUIDITY = 0x01;
    uint8  public constant MINT_POSITION      = 0x02;
    uint8  public constant BURN_POSITION      = 0x03;
    uint8  public constant SETTLE_PAIR        = 0x0d;
    uint8  public constant TAKE_PAIR          = 0x11;
    uint8  public constant SWEEP              = 0x14;
    bytes32 public constant POOLS_SLOT        = bytes32(uint256(6));
    int24  public constant TICK_SPACING       = 60;
    int24  public constant TICK_LOWER         = -887220;
    int24  public constant TICK_UPPER         = 887220;
    uint160 public constant SQRT_LOWER        = 4306310044;
    uint160 public constant SQRT_UPPER        = 1457652066949847389969617340386294118487833376468;
    /// @notice The 1 % band in sqrt-price space: sqrt(0.99)·1e6 rounded up,
    ///         sqrt(1.01)·1e6 rounded down, so a pool inside the band is
    ///         inside 1 % of the terminal PRICE, never a hair outside it.
    uint256 public constant BAND_LO           = 994_988;
    uint256 public constant BAND_HI           = 1_004_987;
    /// @notice The start fee's ceiling, the Pool's MAX_SNIPER_BPS in v4's
    ///         unit: a trade that returns nothing is a broken contract.
    uint24 public constant MAX_START_FEE      = 900_000;
    /// @notice How long the seeding approval lives — one call needs it, and
    ///         zero would mean "this block" to Permit2.
    uint48 public constant PERMIT_WINDOW      = 1 hours;
    uint256 private constant Q96              = 1 << 96;
    uint256 private constant ONE              = 1e18;

    mapping(uint256 => Custody) private _custody;
    mapping(address => HookTerms) private _terms;
    mapping(address => uint256) public launchOfCoin;

    constructor(address hub, address launchpad, address kiln, address poolManager, address positionManager, address permit2) {
        HUB = hub;
        LAUNCHPAD = launchpad;
        KILN = kiln;
        POOL_MANAGER = poolManager;
        POSITION_MANAGER = positionManager;
        PERMIT2 = permit2;
    }

    modifier onlyLaunchpad() {
        if (msg.sender != LAUNCHPAD) revert NotLaunchpad();
        _;
    }

    /// @dev Ether arrives only as the PositionManager's sweep of what a
    ///      mint did not need; anything else is refused rather than stranded.
    receive() external payable {
        if (msg.sender != POSITION_MANAGER) revert UnexpectedEther();
    }

    /*═══════════════════ the Launchpad's two calls ═══════════════════*/

    /// @notice A v4 launch was created: pin its hook terms and the salt
    ///         that places its hook. Terms are keyed by the coin — one
    ///         launch per coin — because the hook is born knowing only its
    ///         coin, and reads the rest from here.
    /// @dev    No lock: the only calls out are views into the Kiln and the
    ///         Launchpad, which is the caller.
    function register(uint256 launchId, uint256 id, address coin, HookTerms calldata t, bytes32 salt)
        external onlyLaunchpad
    {
        Custody storage c = _custody[launchId];
        if (c.coin != address(0) || launchOfCoin[coin] != 0) revert AlreadyRegistered(launchId);
        // the lock and the opening within ten years of the seeding — the cap every lock obeys
        if (t.startFee > MAX_START_FEE || t.floorFee > t.startFee
            || t.lockFor > Ratchet.LOCK_CAP || t.opensIn > Ratchet.LOCK_CAP) revert BadTerms();
        address hook = _hookAt(coin, salt);

        /*  The terminal price is bounded by the curve: coin per wei runs from
            liquidity²/k (the curve sold out) to (curve+liquidity)²/k (nothing
            sold), k = virtualQuote · (curve + liquidity). Both corners must
            be prices a v4 pool can hold, or a graduation could be stuck
            between a target met and a price the pool refuses. The three
            numbers are the Launch struct's words 4, 5 and 7, read raw: the
            whole twenty-word struct's decoder is a kilobyte this contract
            does not have.                                                 */
        (bool ok, bytes memory ret) = LAUNCHPAD.staticcall(abi.encodeCall(ILaunchpad.launchOf, (launchId)));
        if (!ok || ret.length < 0x280) revert NotRegistered(launchId);
        uint256 q; uint256 b; uint256 liq;
        assembly ("memory-safe") {
            q := mload(add(ret, 0xa0))
            b := mload(add(ret, 0xc0))
            liq := mload(add(ret, 0x100))
        }
        uint256 sqrtK = _sqrt(q * b);
        if (Mul.mulDivDown(liq, Q96, sqrtK) <= SQRT_LOWER || Mul.mulDivDown(b, Q96, sqrtK) >= SQRT_UPPER) revert PriceOutOfRange(0);

        _terms[coin] = t;
        launchOfCoin[coin] = launchId;
        c.coin = coin;
        c.id = id;
        c.salt = salt;
        c.hook = hook;
        emit Registered(launchId, id, coin, hook, salt);
    }

    /// @notice Graduation: the pool at the terminal price, the position to
    ///         this contract. The raise is `msg.value`; `amountBase` is the
    ///         coin the Launchpad has approved exactly; their ratio is the
    ///         price, as a square root in Q64.96.
    function seed(uint256 launchId, uint256 amountBase)
        external payable onlyLaunchpad returns (uint256 key, uint256 poolSpot)
    {
        Transient.enter(Transient.CUSTODIAN_LOCK);
        Custody storage c = _custody[launchId];
        if (c.coin == address(0)) revert NotRegistered(launchId);
        if (c.seededAt != 0) revert AlreadySeeded(launchId);
        uint256 raised = msg.value;
        if (raised == 0 || amountBase == 0) revert ZeroAmount();
        uint160 sqrtPriceX96 = _sqrtPriceOf(amountBase, raised);
        if (sqrtPriceX96 <= SQRT_LOWER || sqrtPriceX96 >= SQRT_UPPER) revert PriceOutOfRange(sqrtPriceX96);
        address coin = c.coin;

        /*  The hook: deployed through the Kiln at the registered salt unless
            somebody already did — the same code and terms either way, which
            is the point of CREATE2 — and asserted to be the address the
            salt names.                                                   */
        address hook = c.hook;
        if (hook.code.length == 0) {
            address got = IKiln(KILN).deployHook(HOOK_KIND, c.salt, bytes32(uint256(uint160(coin))));
            if (got != hook) revert HookMismatch(hook, got);
        }
        PoolKey memory k = PoolKey(address(0), coin, Hook.DYNAMIC_FEE, TICK_SPACING, hook);
        bytes32 poolId = keccak256(abi.encode(k));

        /*  DESIGN.md §8.3: a stranger may have initialised this pool first.
            Within 1 % of the terminal price it is simply used; further off
            it is refused with both prices, and `resalt` is the way out.  */
        uint160 live = _slot0(poolId);
        if (live == 0) {
            IPoolManagerV4(POOL_MANAGER).initialize(k, sqrtPriceX96);
            live = sqrtPriceX96;
        } else if (!_within(live, sqrtPriceX96)) {
            revert PriceOff(sqrtPriceX96, live);
        }

        uint256 before = IERC20Exact(coin).balanceOf(address(this));
        if (!IERC20Exact(coin).transferFrom(LAUNCHPAD, address(this), amountBase)
            || IERC20Exact(coin).balanceOf(address(this)) - before != amountBase) revert TransferFailed();
        uint256 liquidity = _liquidityFor(live, raised, amountBase);
        if (liquidity == 0 || liquidity > type(uint128).max) revert ZeroAmount();

        /*  The approval chain the PositionManager needs: the coin to Permit2,
            Permit2 to the PositionManager, with a real expiry — then both
            back to zero and re-read, so nothing survives the call.       */
        _approve(coin, amountBase);
        IPermit2(PERMIT2).approve(coin, POSITION_MANAGER, uint160(amountBase), uint48(block.timestamp) + PERMIT_WINDOW);
        uint256 tokenId = IPositionManagerV4(POSITION_MANAGER).nextTokenId();
        bytes[] memory params = new bytes[](3);
        // MINT_POSITION (PoolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, owner, hookData): twelve words, then the empty bytes
        params[0] = abi.encode(
            address(0), coin, uint256(Hook.DYNAMIC_FEE), int256(TICK_SPACING), hook,
            int256(TICK_LOWER), int256(TICK_UPPER), liquidity, raised, amountBase, address(this), uint256(0x180), uint256(0));
        params[1] = abi.encode(address(0), coin);              // SETTLE_PAIR
        params[2] = abi.encode(address(0), address(this));     // SWEEP: the ether the price did not need, back here
        _modify(abi.encodePacked(MINT_POSITION, SETTLE_PAIR, SWEEP), params, raised);
        IPermit2(PERMIT2).approve(coin, POSITION_MANAGER, 0, uint48(block.timestamp));
        _approve(coin, 0);
        (uint160 left, , ) = IPermit2(PERMIT2).allowance(address(this), coin, POSITION_MANAGER);
        if (left != 0) revert TransferFailed();
        if (IPositionManagerV4(POSITION_MANAGER).ownerOf(tokenId) != address(this)
            || IPositionManagerV4(POSITION_MANAGER).getPositionLiquidity(tokenId) != liquidity) revert PositionNotHeld(tokenId);

        /*  The clock starts here: the hook counts its opening and its lock
            from this moment, and so does the ratchet.                   */
        c.seededAt = uint64(block.timestamp);
        c.unlocksAt = uint64(block.timestamp) + _terms[coin].lockFor;
        c.tokenId = tokenId;
        key = uint256(poolId);
        poolSpot = Mul.priceFromSqrt(live, ONE, false);
        emit Seeded(launchId, poolId, hook, tokenId, sqrtPriceX96, live, liquidity);

        /*  What the position did not need — dust from the price's rounding,
            or up to the band's width when a stranger set the price — goes
            home to the Reach: it is the launch's own value, and it is not
            this contract's to keep.                                       */
        address reach = IRightsHub(HUB).account(c.id);
        uint256 dust = IERC20Exact(coin).balanceOf(address(this));
        if (dust != 0 && !IERC20Exact(coin).transfer(reach, dust)) revert TransferFailed();
        if (address(this).balance != 0) _push(reach, address(this).balance);
        Transient.exit(Transient.CUSTODIAN_LOCK);
    }

    /*═══════════════════ the launcher's calls ═══════════════════*/

    /// @notice A fresh salt, so a fresh hook address and a fresh pool.
    function resalt(uint256 launchId, bytes32 salt) external {
        Custody storage c = _custody[launchId];
        if (c.coin == address(0)) revert NotRegistered(launchId);
        if (c.seededAt != 0) revert AlreadySeeded(launchId);
        if (!Rights.acts(HUB, c.id, msg.sender)) revert NotActor();
        address hook = _hookAt(c.coin, salt);
        c.salt = salt;
        c.hook = hook;
        emit Resalted(launchId, hook, salt);
    }

    /// @notice Only later, never past ten years from now.
    function extend(uint256 launchId, uint64 until) external {
        Custody storage c = _custody[launchId];
        if (c.seededAt == 0 || c.released) revert NotSeeded(launchId);
        if (!Rights.acts(HUB, c.id, msg.sender)) revert NotActor();
        c.unlocksAt = Ratchet.raise(c.unlocksAt, until, Ratchet.LOCK_CAP);
        emit Extended(launchId, c.unlocksAt);
    }

    /// @notice Every fee the position has earned, to `feeSink(id)`. Anyone
    ///         may pay the gas; the recipient is whoever holds the token now.
    /// @dev    A zero-liquidity decrease is how the PositionManager collects:
    ///         the hook admits it during the lock, and TAKE_PAIR pays the
    ///         sink straight from the PoolManager — nothing passes through
    ///         here. Checks, effects, then the one interaction.
    function collect(uint256 launchId) external {
        Transient.enter(Transient.CUSTODIAN_LOCK);
        Custody storage c = _custody[launchId];
        if (c.seededAt == 0 || c.released) revert NotSeeded(launchId);
        address to = IIntact(HUB).feeSink(c.id);
        (uint256 e0, uint256 c0) = _balances(to, c.coin);
        bytes[] memory params = new bytes[](2);
        // DECREASE_LIQUIDITY (tokenId, liquidity 0, amount0Min 0, amount1Min 0, hookData ""): four words, then the empty bytes
        params[0] = abi.encode(c.tokenId, uint256(0), uint256(0), uint256(0), uint256(0xa0), uint256(0));
        params[1] = abi.encode(address(0), c.coin, to);        // TAKE_PAIR
        _modify(abi.encodePacked(DECREASE_LIQUIDITY, TAKE_PAIR), params, 0);
        (uint256 e1, uint256 c1) = _balances(to, c.coin);
        emit Collected(launchId, to, e1 - e0, c1 - c0);
        Transient.exit(Transient.CUSTODIAN_LOCK);
    }

    /// @notice The principal — and whatever fees ride with it — home to the
    ///         Reach, once `unlocksAt` has passed. The holder or the Reach.
    function release(uint256 launchId) external {
        Transient.enter(Transient.CUSTODIAN_LOCK);
        Custody storage c = _custody[launchId];
        if (c.seededAt == 0 || c.released) revert NotSeeded(launchId);
        if (!Rights.acts(HUB, c.id, msg.sender)) revert NotActor();
        if (block.timestamp < c.unlocksAt) revert StillLocked(c.unlocksAt);
        address reach = IRightsHub(HUB).account(c.id);
        c.released = true;
        (uint256 e0, uint256 c0) = _balances(reach, c.coin);
        bytes[] memory params = new bytes[](2);
        // BURN_POSITION (tokenId, amount0Min 0, amount1Min 0, hookData ""): three words, then the empty bytes
        params[0] = abi.encode(c.tokenId, uint256(0), uint256(0), uint256(0x80), uint256(0));
        params[1] = abi.encode(address(0), c.coin, reach);     // TAKE_PAIR
        _modify(abi.encodePacked(BURN_POSITION, TAKE_PAIR), params, 0);
        (uint256 e1, uint256 c1) = _balances(reach, c.coin);
        emit Released(launchId, reach, e1 - e0, c1 - c0);
        Transient.exit(Transient.CUSTODIAN_LOCK);
    }

    /*═══════════════════ reading ═══════════════════*/

    function custodyOf(uint256 launchId) external view returns (Custody memory) { return _custody[launchId]; }
    function hookTermsOf(address coin) external view returns (HookTerms memory) { return _terms[coin]; }
    function hookOf(uint256 launchId) external view returns (address) { return _custody[launchId].hook; }
    function seededAt(address coin) external view returns (uint64) { return _custody[launchOfCoin[coin]].seededAt; }
    function unlocksAt(uint256 launchId) external view returns (uint64) { return _custody[launchId].unlocksAt; }

    function poolKeyOf(uint256 launchId) public view returns (PoolKey memory) {
        Custody storage c = _custody[launchId];
        return PoolKey(address(0), c.coin, Hook.DYNAMIC_FEE, TICK_SPACING, c.hook);
    }

    function poolIdOf(uint256 launchId) public view returns (bytes32) {
        return keccak256(abi.encode(poolKeyOf(launchId)));
    }

    /// @notice The pool's price the way the Launchpad states one: wei per
    ///         1e18 of the coin. Zero before the pool exists.
    function spotOf(uint256 launchId) external view returns (uint256) {
        return Mul.priceFromSqrt(_slot0(poolIdOf(launchId)), ONE, false);
    }

    /// @notice Where the Kiln would put this coin's hook at `salt`.
    function hookAt(address coin, bytes32 salt) external view returns (address) {
        (bytes32 h, ) = IKiln(KILN).recipeHash(HOOK_KIND, bytes32(uint256(uint160(coin))));
        return Hook.at(KILN, salt, h);
    }

    /*═══════════════════ internals ═══════════════════*/

    function _hookAt(address coin, bytes32 salt) private view returns (address hook) {
        (bytes32 h, uint16 flags) = IKiln(KILN).recipeHash(HOOK_KIND, bytes32(uint256(uint160(coin))));
        hook = Hook.at(KILN, salt, h);
        uint16 got = Hook.flags(hook);
        if (got != flags || got != HOOK_FLAGS) revert BadSalt(hook, got);
    }

    /// @dev v4-core StateLibrary.getSlot0: the pool's state word is at
    ///      keccak(poolId ‖ POOLS_SLOT) and sqrtPriceX96 is its low 160 bits.
    function _slot0(bytes32 poolId) private view returns (uint160) {
        return uint160(uint256(IPoolManagerV4(POOL_MANAGER).extsload(keccak256(abi.encodePacked(poolId, POOLS_SLOT)))));
    }

    function _within(uint256 live, uint256 want) private pure returns (bool) {
        return live * 1e6 >= want * BAND_LO && live * 1e6 <= want * BAND_HI;
    }

    /// @dev v4-periphery LiquidityAmounts.getLiquidityForAmounts over the
    ///      full range: the lesser of what each side affords at `s`.
    function _liquidityFor(uint160 s, uint256 amount0, uint256 amount1) private pure returns (uint256) {
        uint256 l0 = Mul.mulDivDown(amount0, Mul.mulDivDown(s, SQRT_UPPER, Q96), uint256(SQRT_UPPER) - s);
        uint256 l1 = Mul.mulDivDown(amount1, Q96, uint256(s) - SQRT_LOWER);
        return l0 < l1 ? l0 : l1;
    }

    /// @dev One door to the PositionManager: `modifyLiquidities(abi.encode(actions, params), now)`.
    function _modify(bytes memory actions, bytes[] memory params, uint256 value) private {
        IPositionManagerV4(POSITION_MANAGER).modifyLiquidities{value: value}(abi.encode(actions, params), block.timestamp);
    }

    /// @dev An exact allowance of the coin to Permit2, read back.
    function _approve(address coin, uint256 amount) private {
        if (!IERC20Exact(coin).approve(PERMIT2, amount) || IERC20Exact(coin).allowance(address(this), PERMIT2) != amount) {
            revert TransferFailed();
        }
    }

    /// @dev The v4 pool's price is currency1 per currency0 — coin per wei —
    ///      as a square root in Q64.96: sqrt(amountBase · 2^192 / raised).
    ///      The 512-bit product fits a quotient under 2^256 while the price
    ///      is under 2^64 coin per wei; beyond that the root is taken of the
    ///      quotient at 2^128 and scaled by 2^32 afterwards, exact to the
    ///      root's own floor — and any price a registered launch can reach
    ///      is under 2^128, the corner check's bound.
    function _sqrtPriceOf(uint256 amountBase, uint256 raised) private pure returns (uint160) {
        if (amountBase / raised < 1 << 64) return uint160(_sqrt(Mul.mulDivDown(amountBase, 1 << 192, raised)));
        return uint160(_sqrt(Mul.mulDivDown(amountBase, 1 << 128, raised)) << 32);
    }

    function _balances(address who, address coin) private view returns (uint256, uint256) {
        return (who.balance, IERC20Exact(coin).balanceOf(who));
    }

    function _push(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @dev floor(sqrt(x)), Babylonian from a power-of-two seed above the root.
    function _sqrt(uint256 x) private pure returns (uint256 r) {
        if (x == 0) return 0;
        uint256 e = 1;
        uint256 y = x;
        if (y >= 1 << 128) { y >>= 128; e <<= 64; }
        if (y >= 1 << 64) { y >>= 64; e <<= 32; }
        if (y >= 1 << 32) { y >>= 32; e <<= 16; }
        if (y >= 1 << 16) { y >>= 16; e <<= 8; }
        if (y >= 1 << 8) { y >>= 8; e <<= 4; }
        if (y >= 1 << 4) { y >>= 4; e <<= 2; }
        if (y >= 1 << 2) { e <<= 1; }
        r = e << 1;
        for (uint256 i; i < 8; ++i) r = (r + x / r) >> 1;
        uint256 r1 = x / r;
        return r < r1 ? r : r1;
    }
}
