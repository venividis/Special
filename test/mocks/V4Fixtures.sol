// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// INTACT U14 fixtures for the v4 launch path: the manager that drives a
// hook BY SELECTOR (U0's MockPoolManager, extended with the pool state the
// custodian reads and a ledger the position needs), a PositionManager that
// decodes the real `modifyLiquidities` action encoding, a Permit2 with the
// real expiry rule, and the wiring that predicts the mutual immutables.
// test/Hook.t.sol and tools/verify-launch.mjs share them.

import {PoolKey, ModifyLiquidityParams, SwapParams} from "../../src/interfaces/ILPCustodian.sol";
import {Kiln} from "../../src/Kiln.sol";
import {Launchpad} from "../../src/Launchpad.sol";
import {LPCustodian} from "../../src/LPCustodian.sol";
import {Mul} from "../../src/lib/Mul.sol";
import {Tick} from "../../src/lib/Tick.sol";
import {LaunchLocks, LaunchPool} from "./LaunchFixtures.sol";

interface IERC20V4 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

/*───────────────────────────────────────────────────────────────────────────
  MockV4Manager — the half of v4 a launch hook and a custodian can tell apart

  Kept from U0's MockPoolManager, verbatim in rule: callbacks dispatched by
  the real signature strings, the returned selector checked, a returned
  fee IGNORED without OVERRIDE_FEE, a hook called only for the bits its
  address carries. Added for U14:

    · `initialize` returns the tick and refuses a second initialisation,
      an unsorted key, and a hook address v4 would refuse — and it is open
      to anyone, which is what makes a stranger's pre-initialisation real;
    · slot0 lives where v4-core's StateLibrary reads it: the word at
      keccak(poolId ‖ 6), low 160 bits the sqrt price, served by `extsload`;
    · `modifyLiquidity` keeps a ledger per pool — reserves, liquidity, the
      LP's fees — so a position can be minted, poked for its fees, and
      burned, with the amounts v4's full-range maths would move;
    · `swap` is exact-input, charges the fee the hook returned (or the
      stored one) INTO the LP's fee pot, trades x·y = k over the reserves
      and moves slot0, so a collect afterwards pays something real.
───────────────────────────────────────────────────────────────────────────*/
contract MockV4Manager {
    uint24 internal constant DYNAMIC_FEE  = 0x800000;
    uint24 internal constant OVERRIDE_FEE = 0x400000;
    uint24 internal constant FEE_MASK     = 0x3fffff;
    uint160 internal constant BEFORE_INITIALIZE       = 1 << 13;
    uint160 internal constant BEFORE_ADD_LIQUIDITY    = 1 << 11;
    uint160 internal constant BEFORE_REMOVE_LIQUIDITY = 1 << 9;
    uint160 internal constant BEFORE_SWAP             = 1 << 7;
    uint160 internal constant MASK = (1 << 14) - 1;
    uint256 internal constant Q96 = 1 << 96;

    struct Pool {
        bool initialised;
        uint24 storedFee;
        int24 tickSpacing;
        uint160 sqrtPriceX96;
        uint256 reserve0;
        uint256 reserve1;
        uint128 liquidity;
        uint256 fees0;
        uint256 fees1;
    }

    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => bytes32) private _slots;
    /// @dev What a liquidity change left the caller owing (negative delta)
    ///      or owed (positive), per currency — v4's transient ledger, kept
    ///      in storage here so a test can read it.
    mapping(address => mapping(address => int256)) public deltaOf;
    uint24 public lastFeeCharged;
    uint256 public swaps;

    error BadSelector();
    error NotInitialised();
    error PoolAlreadyInitialized();
    error CurrenciesOutOfOrderOrEqual();
    error HookAddressNotValid(address hooks);
    error TickSpacingTooSmall();
    error ExactInputOnly();
    error WrongValue();
    error Insolvent();

    receive() external payable {}

    function toId(PoolKey memory k) public pure returns (bytes32) { return keccak256(abi.encode(k)); }

    /// @dev v4-core StateLibrary: the pool's state word lives at keccak(id ‖ POOLS_SLOT=6).
    function stateSlot(bytes32 id) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(id, bytes32(uint256(6))));
    }

    function extsload(bytes32 slot) external view returns (bytes32) { return _slots[slot]; }

    function sqrtAt(int24 tick) external pure returns (uint160) { return Tick.sqrtAt(tick); }

    function _has(address h, uint160 f) private pure returns (bool) { return uint160(h) & f != 0; }

    function _bubble(bool ok, bytes memory ret) private pure {
        if (!ok) assembly { revert(add(ret, 0x20), mload(ret)) }
    }

    /*═══════════════════ initialize ═══════════════════*/

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick) {
        if (key.currency0 >= key.currency1) revert CurrenciesOutOfOrderOrEqual();
        if (key.tickSpacing < 1) revert TickSpacingTooSmall();
        uint160 bits = uint160(key.hooks) & MASK;
        // v4 Hooks.isValidHookAddress: no hook needs a static fee; a hook needs a bit or a dynamic fee
        if ((key.hooks == address(0) && key.fee == DYNAMIC_FEE) || (key.hooks != address(0) && bits == 0 && key.fee != DYNAMIC_FEE)) {
            revert HookAddressNotValid(key.hooks);
        }
        bytes32 pid = toId(key);
        if (pools[pid].initialised) revert PoolAlreadyInitialized();
        if (_has(key.hooks, BEFORE_INITIALIZE)) {
            (bool ok, bytes memory ret) = key.hooks.call(
                abi.encodeWithSignature(
                    "beforeInitialize(address,(address,address,uint24,int24,address),uint160)",
                    msg.sender, key, sqrtPriceX96));
            _bubble(ok, ret);
            if (bytes4(ret) != bytes4(keccak256(
                "beforeInitialize(address,(address,address,uint24,int24,address),uint160)")))
                revert BadSelector();
        }
        Pool storage p = pools[pid];
        p.initialised = true;
        p.storedFee = key.fee == DYNAMIC_FEE ? 0 : key.fee;
        p.tickSpacing = key.tickSpacing;
        p.sqrtPriceX96 = sqrtPriceX96;
        _writeSlot0(pid);
        tick = 0;
    }

    /*═══════════════════ swap ═══════════════════*/

    /// @notice An exact-input swap by whoever calls: native in as value,
    ///         ERC-20 in pulled by allowance; the output paid out at once.
    /// @return packed the BalanceDelta (amount0 high 128, amount1 low 128)
    function swap(PoolKey memory key, SwapParams memory params, bytes memory hookData)
        external payable returns (int256 packed)
    {
        bytes32 pid = toId(key);
        Pool storage p = pools[pid];
        if (!p.initialised) revert NotInitialised();
        if (params.amountSpecified >= 0) revert ExactInputOnly();
        uint24 charged = p.storedFee;

        if (_has(key.hooks, BEFORE_SWAP)) {
            (bool ok, bytes memory ret) = key.hooks.call(
                abi.encodeWithSignature(
                    "beforeSwap(address,(address,address,uint24,int24,address),(bool,int256,uint160),bytes)",
                    msg.sender, key, params, hookData));
            _bubble(ok, ret);
            (bytes4 s, , uint24 back) = abi.decode(ret, (bytes4, int256, uint24));
            if (s != bytes4(keccak256(
                "beforeSwap(address,(address,address,uint24,int24,address),(bool,int256,uint160),bytes)")))
                revert BadSelector();
            /*  The whole point of this mock. A hook that forgets the flag
                is ignored here exactly as it would be on chain.        */
            if (back & OVERRIDE_FEE != 0) charged = back & FEE_MASK;
        }
        lastFeeCharged = charged;
        swaps += 1;

        uint256 amountIn = uint256(-params.amountSpecified);
        (address cin, address cout) = params.zeroForOne ? (key.currency0, key.currency1) : (key.currency1, key.currency0);
        if (cin == address(0)) { if (msg.value != amountIn) revert WrongValue(); }
        else { if (msg.value != 0) revert WrongValue(); IERC20V4(cin).transferFrom(msg.sender, address(this), amountIn); }

        uint256 fee = amountIn * charged / 1_000_000;
        uint256 net = amountIn - fee;
        (uint256 rIn, uint256 rOut) = params.zeroForOne ? (p.reserve0, p.reserve1) : (p.reserve1, p.reserve0);
        uint256 out = rOut * net / (rIn + net);
        if (params.zeroForOne) { p.reserve0 = rIn + net; p.reserve1 = rOut - out; p.fees0 += fee; }
        else { p.reserve1 = rIn + net; p.reserve0 = rOut - out; p.fees1 += fee; }
        p.sqrtPriceX96 = uint160(_sqrt(Mul.mulDivDown(p.reserve1, 1 << 192, p.reserve0)));
        _writeSlot0(pid);
        _pay(cout, msg.sender, out);

        int128 a0 = params.zeroForOne ? -int128(int256(amountIn)) : int128(int256(out));
        int128 a1 = params.zeroForOne ? int128(int256(out)) : -int128(int256(amountIn));
        assembly ("memory-safe") { packed := or(shl(128, a0), and(sub(shl(128, 1), 1), a1)) }
    }

    /*═══════════════════ liquidity ═══════════════════*/

    /// @notice v4's `modifyLiquidity` with the ledger behind it: the hook is
    ///         asked by selector for the bit the delta's sign names, the
    ///         amounts are the full-range ones at the current price, and
    ///         fees are paid to the caller on any non-positive delta — a
    ///         zero-delta call is exactly how fees are collected.
    /// @dev    Returns the principal the caller owes (a positive delta) or
    ///         is owed (otherwise) in each currency, then the fees paid out
    ///         with a non-positive delta.
    function modifyLiquidity(PoolKey memory key, ModifyLiquidityParams memory mp, bytes memory hookData)
        external returns (uint256 amount0, uint256 amount1, uint256 fees0, uint256 fees1)
    {
        bytes32 pid = toId(key);
        Pool storage p = pools[pid];
        if (!p.initialised) revert NotInitialised();
        bool adding = mp.liquidityDelta > 0;
        uint160 flag = adding ? BEFORE_ADD_LIQUIDITY : BEFORE_REMOVE_LIQUIDITY;
        if (_has(key.hooks, flag)) {
            string memory sig = adding
                ? "beforeAddLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)"
                : "beforeRemoveLiquidity(address,(address,address,uint24,int24,address),(int24,int24,int256,bytes32),bytes)";
            (bool ok, bytes memory ret) = key.hooks.call(abi.encodeWithSignature(sig, msg.sender, key, mp, hookData));
            _bubble(ok, ret);
            if (bytes4(ret) != bytes4(keccak256(bytes(sig)))) revert BadSelector();
        }
        uint256 l = adding ? uint256(mp.liquidityDelta) : uint256(-mp.liquidityDelta);
        if (adding) {
            (amount0, amount1) = amountsFor(p.sqrtPriceX96, mp.tickLower, mp.tickUpper, l, true);
            p.reserve0 += amount0;
            p.reserve1 += amount1;
            p.liquidity += uint128(l);
            deltaOf[msg.sender][key.currency0] -= int256(amount0);
            deltaOf[msg.sender][key.currency1] -= int256(amount1);
        } else {
            /*  Removal is pro rata over the reserves the pool really holds:
                for a full-range pool that is what the position is worth,
                and it keeps this ledger exact where the concentrated-
                liquidity formula and x·y = k differ by the range's offsets
                (hundreds of wei on an ether).                           */
            if (l != 0) {
                amount0 = p.reserve0 * l / p.liquidity;
                amount1 = p.reserve1 * l / p.liquidity;
            }
            p.reserve0 -= amount0;
            p.reserve1 -= amount1;
            p.liquidity -= uint128(l);
            (fees0, fees1) = (p.fees0, p.fees1);
            (p.fees0, p.fees1) = (0, 0);
            deltaOf[msg.sender][key.currency0] += int256(amount0 + fees0);
            deltaOf[msg.sender][key.currency1] += int256(amount1 + fees1);
        }
    }

    /// @notice Settle what the caller owes in `currency`: value for native,
    ///         a balance already transferred here for an ERC-20.
    function settle(address currency, uint256 amount) external payable {
        if (currency == address(0)) { if (msg.value != amount) revert WrongValue(); }
        deltaOf[msg.sender][currency] += int256(amount);
    }

    /// @notice Pay out what the caller is owed in `currency`, to `to`.
    function take(address currency, address to, uint256 amount) external {
        if (deltaOf[msg.sender][currency] < int256(amount)) revert Insolvent();
        deltaOf[msg.sender][currency] -= int256(amount);
        _pay(currency, to, amount);
    }

    /// @notice v4-periphery LiquidityAmounts over the pool's range: what `l`
    ///         units of liquidity are worth at `s`, rounded against the LP
    ///         when adding (up) and for the pool when removing (down).
    function amountsFor(uint160 s, int24 tickLower, int24 tickUpper, uint256 l, bool roundUp)
        public pure returns (uint256 amount0, uint256 amount1)
    {
        uint160 a = Tick.sqrtAt(tickLower);
        uint160 b = Tick.sqrtAt(tickUpper);
        if (s <= a) s = a;
        if (s >= b) s = b;
        // amount0 = l · (b − s) · Q96 / (s · b);  amount1 = l · (s − a) / Q96
        uint256 n0 = Mul.mulDivDown(l, uint256(b) - s, s);
        amount0 = roundUp ? Mul.mulDivUp(n0, Q96, b) : Mul.mulDivDown(n0, Q96, b);
        amount1 = roundUp ? Mul.mulDivUp(l, uint256(s) - a, Q96) : Mul.mulDivDown(l, uint256(s) - a, Q96);
    }

    function _writeSlot0(bytes32 pid) private {
        _slots[stateSlot(pid)] = bytes32(uint256(pools[pid].sqrtPriceX96));
    }

    function _pay(address currency, address to, uint256 amount) private {
        if (amount == 0) return;
        if (currency == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok);
        } else {
            IERC20V4(currency).transfer(to, amount);
        }
    }

    function _sqrt(uint256 x) private pure returns (uint256 r) {
        if (x == 0) return 0;
        r = x;
        uint256 y = (x + 1) / 2;
        while (y < r) { r = y; y = (x / y + y) / 2; }
    }
}

/*───────────────────────────────────────────────────────────────────────────
  MockPermit2 — the allowance-transfer half of Permit2, with the one rule
  that bit Pixel-Garden: an expiration of ZERO is stored as `block.timestamp`
  ("expires at this block"), and `transferFrom` refuses once the block has
  passed. The mock also counts every zero it was ever handed, so a verifier
  can say "the custodian never wrote one".
───────────────────────────────────────────────────────────────────────────*/
contract MockPermit2 {
    struct PackedAllowance { uint160 amount; uint48 expiration; uint48 nonce; }
    mapping(address => mapping(address => mapping(address => PackedAllowance))) private _allowance;
    uint256 public zeroExpiryWrites;
    uint48 public lastExpirationWritten;
    uint256 public approvals;

    error AllowanceExpired(uint256 deadline);
    error InsufficientAllowance(uint256 amount);
    error TransferFailed();

    /// @notice 0x87517c45 — the Permit2 shape.
    function approve(address token, address spender, uint160 amount, uint48 expiration) external {
        if (expiration == 0) zeroExpiryWrites += 1;
        lastExpirationWritten = expiration;
        approvals += 1;
        PackedAllowance storage a = _allowance[msg.sender][token][spender];
        a.amount = amount;
        a.expiration = expiration == 0 ? uint48(block.timestamp) : expiration;
    }

    function allowance(address owner, address token, address spender) external view returns (uint160, uint48, uint48) {
        PackedAllowance storage a = _allowance[owner][token][spender];
        return (a.amount, a.expiration, a.nonce);
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        PackedAllowance storage a = _allowance[from][token][msg.sender];
        if (block.timestamp > a.expiration) revert AllowanceExpired(a.expiration);
        if (a.amount < amount) revert InsufficientAllowance(a.amount);
        if (a.amount != type(uint160).max) a.amount -= amount;
        if (!IERC20V4(token).transferFrom(from, to, amount)) revert TransferFailed();
    }
}

/*───────────────────────────────────────────────────────────────────────────
  MockPositionManager — `modifyLiquidities(bytes,uint256)` decoded the way
  v4-periphery decodes it

  `unlockData` is abi.encode(bytes actions, bytes[] params); one byte per
  action, one params blob per action, in order. The six actions a custodian
  uses are implemented with the real parameter layouts (CalldataDecoder):

    0x02 MINT_POSITION   (PoolKey, int24, int24, uint256 liquidity, uint128, uint128, address owner, bytes)
    0x01 DECREASE_LIQUIDITY (uint256 tokenId, uint256 liquidity, uint128 min0, uint128 min1, bytes)
    0x03 BURN_POSITION   (uint256 tokenId, uint128 min0, uint128 min1, bytes)
    0x0d SETTLE_PAIR     (Currency, Currency)     — paid by the caller: native from value, ERC-20 through Permit2
    0x11 TAKE_PAIR       (Currency, Currency, address recipient)
    0x14 SWEEP           (Currency, address to)

  Positions are ERC-721-shaped as far as a custodian reads them: `ownerOf`,
  `getPositionLiquidity`, `nextTokenId`. Anything owed and not settled by
  the end reverts `CurrencyNotSettled`, as the real manager's unlock would.
───────────────────────────────────────────────────────────────────────────*/
contract MockPositionManager {
    struct Position { address owner; PoolKey key; int24 tickLower; int24 tickUpper; uint128 liquidity; }

    MockV4Manager public immutable manager;
    MockPermit2 public immutable permit2;
    uint256 public nextTokenId = 1;
    mapping(uint256 => Position) private _positions;
    uint256 public calls;
    bytes public lastActions;

    error DeadlinePassed();
    error InputLengthMismatch();
    error UnsupportedAction(uint256 action);
    error NotApproved(address caller);
    error MaximumAmountExceeded(uint128 maximumAmount, uint128 amountRequested);
    error MinimumAmountInsufficient(uint128 minimumAmount, uint128 amountReceived);
    error CurrencyNotSettled(address currency);
    error NoSuchPosition(uint256 tokenId);

    constructor(address manager_, address permit2_) {
        manager = MockV4Manager(payable(manager_));
        permit2 = MockPermit2(permit2_);
    }

    receive() external payable {}

    function poolManager() external view returns (address) { return address(manager); }
    function ownerOf(uint256 tokenId) external view returns (address o) {
        o = _positions[tokenId].owner;
        if (o == address(0)) revert NoSuchPosition(tokenId);
    }
    function getPositionLiquidity(uint256 tokenId) external view returns (uint128) { return _positions[tokenId].liquidity; }
    function positionOf(uint256 tokenId) external view returns (Position memory) { return _positions[tokenId]; }

    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable {
        if (block.timestamp > deadline) revert DeadlinePassed();
        (bytes memory actions, bytes[] memory params) = abi.decode(unlockData, (bytes, bytes[]));
        if (actions.length != params.length) revert InputLengthMismatch();
        calls += 1;
        lastActions = actions;
        // the currencies this call touched, so the end can prove they were settled
        address[] memory touched = new address[](2 * actions.length);
        uint256 nt;
        for (uint256 i; i < actions.length; ++i) {
            uint8 action = uint8(actions[i]);
            if (action == 0x02) {
                (PoolKey memory key, int24 tl, int24 tu, uint256 liquidity, uint128 max0, uint128 max1, address owner, bytes memory hookData) =
                    abi.decode(params[i], (PoolKey, int24, int24, uint256, uint128, uint128, address, bytes));
                uint256 tokenId = nextTokenId++;
                _positions[tokenId] = Position(owner, key, tl, tu, uint128(liquidity));
                (uint256 a0, uint256 a1, , ) = manager.modifyLiquidity(key, ModifyLiquidityParams(tl, tu, int256(liquidity), bytes32(tokenId)), hookData);
                if (a0 > max0) revert MaximumAmountExceeded(max0, uint128(a0));
                if (a1 > max1) revert MaximumAmountExceeded(max1, uint128(a1));
                touched[nt++] = key.currency0; touched[nt++] = key.currency1;
            } else if (action == 0x01 || action == 0x03) {
                uint256 tokenId; uint256 liquidity; uint128 min0; uint128 min1; bytes memory hookData;
                if (action == 0x01) (tokenId, liquidity, min0, min1, hookData) = abi.decode(params[i], (uint256, uint256, uint128, uint128, bytes));
                else { (tokenId, min0, min1, hookData) = abi.decode(params[i], (uint256, uint128, uint128, bytes)); liquidity = _positions[tokenId].liquidity; }
                Position storage pos = _positions[tokenId];
                if (pos.owner != msg.sender) revert NotApproved(msg.sender);
                (uint256 a0, uint256 a1, , ) = manager.modifyLiquidity(
                    pos.key, ModifyLiquidityParams(pos.tickLower, pos.tickUpper, -int256(liquidity), bytes32(tokenId)), hookData);
                if (a0 < min0) revert MinimumAmountInsufficient(min0, uint128(a0));
                if (a1 < min1) revert MinimumAmountInsufficient(min1, uint128(a1));
                pos.liquidity -= uint128(liquidity);
                touched[nt++] = pos.key.currency0; touched[nt++] = pos.key.currency1;
                if (action == 0x03) delete _positions[tokenId];
            } else if (action == 0x0d) {
                (address c0, address c1) = abi.decode(params[i], (address, address));
                _settle(c0); _settle(c1);
            } else if (action == 0x11) {
                (address c0, address c1, address to) = abi.decode(params[i], (address, address, address));
                _take(c0, to); _take(c1, to);
            } else if (action == 0x14) {
                (address c, address to) = abi.decode(params[i], (address, address));
                if (c == address(0)) { uint256 bal = address(this).balance; if (bal != 0) { (bool ok, ) = to.call{value: bal}(""); require(ok); } }
                else { uint256 bal = IERC20V4(c).balanceOf(address(this)); if (bal != 0) IERC20V4(c).transfer(to, bal); }
            } else {
                revert UnsupportedAction(action);
            }
        }
        for (uint256 i; i < nt; ++i) if (manager.deltaOf(address(this), touched[i]) != 0) revert CurrencyNotSettled(touched[i]);
    }

    /// @dev What this contract owes the manager in `c`: native from the
    ///      value it was sent, an ERC-20 pulled from the caller through
    ///      Permit2 — the real manager's `_settle` with `payer = msgSender`.
    function _settle(address c) private {
        int256 d = manager.deltaOf(address(this), c);
        if (d >= 0) return;
        uint256 owed = uint256(-d);
        if (c == address(0)) manager.settle{value: owed}(c, owed);
        else { permit2.transferFrom(msg.sender, address(manager), uint160(owed), c); manager.settle(c, owed); }
    }

    function _take(address c, address to) private {
        int256 d = manager.deltaOf(address(this), c);
        if (d <= 0) return;
        manager.take(c, to, uint256(d));
    }
}

/*───────────────────────────────────────────────────────────────────────────
  CustodianFactory — `new LPCustodian` behind a call

  The wiring below would otherwise carry the custodian's creation code
  beside the Kiln's and the Launchpad's, and its own initcode would pass
  EIP-3860's 49,152 bytes. The custodian needs no prediction — only the
  Launchpad is pinned before it exists — so it is made by this factory,
  which the wiring calls, and the wiring's nonce is untouched.
───────────────────────────────────────────────────────────────────────────*/
contract CustodianFactory {
    function make(address hub, address launchpad, address kiln, address poolManager, address positionManager, address permit2)
        external returns (LPCustodian)
    {
        return new LPCustodian(hub, launchpad, kiln, poolManager, positionManager, permit2);
    }
}

/*───────────────────────────────────────────────────────────────────────────
  V4Wiring — the launch world with a custodian, predicted then asserted

  Order: Locks (1), Pool (2), Kiln (3), the custodian through the factory,
  Launchpad (4). The Pool, the Kiln and the custodian all pin the Launchpad
  before it exists; the Launchpad pins the three of them and the custodian
  back.
───────────────────────────────────────────────────────────────────────────*/
contract V4Wiring {
    LaunchLocks public locks;
    LaunchPool public pool;
    Kiln public kiln;
    LPCustodian public custodian;
    Launchpad public pad;

    error Mispredicted(address predicted, address actual);

    constructor(address hub, address poolManager, address positionManager, address permit2, CustodianFactory factory) {
        address predicted = predict(address(this), 4);
        locks = new LaunchLocks();
        pool = new LaunchPool(predicted, 0);
        kiln = new Kiln(hub, predicted, poolManager);
        custodian = factory.make(hub, predicted, address(kiln), poolManager, positionManager, permit2);
        pad = new Launchpad(hub, address(kiln), address(pool), address(locks), address(custodian));
        if (address(pad) != predicted) revert Mispredicted(predicted, address(pad));
    }

    function predict(address deployer, uint8 nonce) public pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, bytes1(nonce))))));
    }
}
