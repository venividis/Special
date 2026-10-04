// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  MockPoolManagerV4 — the unlock/swap/sync/settle/take choreography of
  Uniswap v4, with a constant-product pool behind it (INTACT U8, NEW; a
  fixture)

  U0's MockPoolManager is for HOOKS: it dispatches callbacks by selector
  and ignores a returned fee without the override flag. A swap through the
  Router needs the other half of the manager — the half that keeps a
  ledger. This one reproduces exactly the mechanics the Router's
  correctness depends on, and no more:

    · `unlock` admits one locker at a time, calls `unlockCallback` with
      the bytes it was given, and refuses to finish while any currency the
      callback touched has a non-zero delta (`CurrencyNotSettled`) — the
      rule that makes "take without paying" impossible on the real thing;
    · `swap` is exact-input only, prices by x·y = k on reserves this
      contract really holds, credits the locker's deltas, and returns the
      packed `BalanceDelta` (amount0 high, amount1 low, both signed) the
      Router decodes with `sar`/`signextend`;
    · `sync` → transfer → `settle` is how an ERC-20 input is paid: settle
      is the balance delta since sync, and `msg.value` for native;
    · `take` pushes an output and debits the delta;
    · `extsload(keccak(poolId ‖ 6))` returns a slot0-shaped word whose low
      160 bits move with the price, so a quote and a swap in the same block
      read the same number and the field is not decorative.

  A revert inside the callback (the Router's own quote-by-revert) unwinds
  the lock with everything else, exactly as on chain.
───────────────────────────────────────────────────────────────────────────*/
interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}

interface IERC20PM {
    function balanceOf(address who) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MockPoolManagerV4 {
    struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }
    struct SwapParams { bool zeroForOne; int256 amountSpecified; uint160 sqrtPriceLimitX96; }

    error AlreadyUnlocked();
    error ManagerLocked();
    error NotLocker();
    error NotInitialised();
    error ExactInputOnly();
    error CurrencyNotSettled(address currency);
    error Unsorted();

    bool public unlocked;
    address public locker;
    address private _synced;
    uint256 private _syncedBalance;
    address[] private _touched;

    mapping(bytes32 => uint256) public reserve0;
    mapping(bytes32 => uint256) public reserve1;
    mapping(bytes32 => bool) public initialised;
    mapping(address => int256) public deltaOf;
    mapping(bytes32 => bytes32) private _slots;

    receive() external payable {}

    function toId(PoolKey memory k) public pure returns (bytes32) { return keccak256(abi.encode(k)); }

    /// @dev v4-core StateLibrary: the pool's state word lives at keccak(id ‖ POOLS_SLOT=6).
    function stateSlot(bytes32 id) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(id, bytes32(uint256(6))));
    }

    /// @notice Create a pool with real reserves pulled from the caller
    ///         (native through `msg.value` when currency0 is address(0)).
    function seed(PoolKey memory k, uint256 a0, uint256 a1) external payable {
        if (k.currency0 >= k.currency1) revert Unsorted();
        bytes32 id = toId(k);
        if (k.currency0 == address(0)) require(msg.value == a0);
        else IERC20PM(k.currency0).transferFrom(msg.sender, address(this), a0);
        IERC20PM(k.currency1).transferFrom(msg.sender, address(this), a1);
        reserve0[id] += a0;
        reserve1[id] += a1;
        initialised[id] = true;
        _writePrice(id);
    }

    function unlock(bytes calldata data) external returns (bytes memory result) {
        if (unlocked) revert AlreadyUnlocked();
        unlocked = true;
        locker = msg.sender;
        result = IUnlockCallback(msg.sender).unlockCallback(data);
        for (uint256 i; i < _touched.length; ++i) {
            address c = _touched[i];
            if (deltaOf[c] != 0) revert CurrencyNotSettled(c);
        }
        delete _touched;
        unlocked = false;
        locker = address(0);
    }

    function swap(PoolKey memory k, SwapParams memory p, bytes calldata) external returns (int256 packed) {
        if (!unlocked) revert ManagerLocked();
        if (msg.sender != locker) revert NotLocker();
        bytes32 id = toId(k);
        if (!initialised[id]) revert NotInitialised();
        if (p.amountSpecified >= 0) revert ExactInputOnly();
        uint256 amountIn = uint256(-p.amountSpecified);
        (uint256 rIn, uint256 rOut) = p.zeroForOne ? (reserve0[id], reserve1[id]) : (reserve1[id], reserve0[id]);
        uint256 out = rOut * amountIn / (rIn + amountIn);
        if (p.zeroForOne) { reserve0[id] = rIn + amountIn; reserve1[id] = rOut - out; }
        else { reserve1[id] = rIn + amountIn; reserve0[id] = rOut - out; }
        _writePrice(id);
        (address input, address output) = p.zeroForOne ? (k.currency0, k.currency1) : (k.currency1, k.currency0);
        _touch(input);
        _touch(output);
        deltaOf[input] -= int256(amountIn);
        deltaOf[output] += int256(out);
        int128 a0 = p.zeroForOne ? -int128(int256(amountIn)) : int128(int256(out));
        int128 a1 = p.zeroForOne ? int128(int256(out)) : -int128(int256(amountIn));
        assembly ("memory-safe") {
            packed := or(shl(128, a0), and(sub(shl(128, 1), 1), a1))
        }
    }

    function sync(address currency) external {
        _synced = currency;
        _syncedBalance = currency == address(0) ? 0 : IERC20PM(currency).balanceOf(address(this));
    }

    function settle() external payable returns (uint256 paid) {
        address c = _synced;
        paid = c == address(0) ? msg.value : IERC20PM(c).balanceOf(address(this)) - _syncedBalance;
        _touch(c);
        deltaOf[c] += int256(paid);
        _synced = address(0);
    }

    function take(address currency, address to, uint256 amount) external {
        if (!unlocked || msg.sender != locker) revert NotLocker();
        _touch(currency);
        deltaOf[currency] -= int256(amount);
        if (currency == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok);
        } else {
            IERC20PM(currency).transfer(to, amount);
        }
    }

    function extsload(bytes32 slot) external view returns (bytes32) { return _slots[slot]; }

    /// @notice Test helper: call a target's `unlockCallback` as the manager
    ///         would, outside any `unlock` — what an unsolicited callback
    ///         looks like to the Router.
    function poke(address target, bytes calldata data) external returns (bytes memory) {
        return IUnlockCallback(target).unlockCallback(data);
    }

    /// @dev A slot0-shaped word: the "sqrt price" in the low 160 bits is
    ///      the reserve ratio scaled by 2^96 — monotone in the real thing's
    ///      direction, and different after every trade.
    function _writePrice(bytes32 id) private {
        uint256 r0 = reserve0[id];
        uint256 price = r0 == 0 ? 0 : (reserve1[id] << 96) / r0;
        _slots[stateSlot(id)] = bytes32(price & type(uint160).max);
    }

    function _touch(address c) private {
        for (uint256 i; i < _touched.length; ++i) if (_touched[i] == c) return;
        _touched.push(c);
    }
}
