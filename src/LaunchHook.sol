// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Origin: IPSEITY src/Kiln.sol `Gate` (the clock-gated swap and the
// liquidity lock) + the IPSEITY branch `codex/…-hciyvv` `GateFacet` (the
// own-key `beforeInitialize`, zero-delta fee pokes admitted during the
// lock, `OVERRIDE_FEE` on the returned fee) + MASTER
// contracts/src/kingdom/PhoenixLaunchHook.sol (the linear fee ramp,
// principal-only lock). Adapted for INTACT U14: the ramp is static per
// launch (no `syncFee`), the terms come from the custodian's registry at
// birth and have no setter, the clock starts when the custodian seeds the
// pool, and nothing here is a Solidity immutable.

import {
    ILaunchHook, ILPCustodian, PoolKey, SwapParams, ModifyLiquidityParams, HookPermissions, HookTerms
} from "./interfaces/ILPCustodian.sol";
import {Hook} from "./lib/Hook.sol";

/*───────────────────────────────────────────────────────────────────────────
  LaunchHook — one per launch, three promises kept by the pool

    "trading opens OPENS_IN after graduation" — `beforeSwap` refuses earlier;
    "the fee starts high and decays to a floor" — `beforeSwap` returns it,
                                     with the override flag the pool needs;
    "liquidity is locked LOCK_FOR after graduation" — `beforeRemoveLiquidity`
                                     refuses a negative delta earlier, and
                                     admits a zero-delta poke so the fees the
                                     lock earns can still be collected.

  And one rule from the Cork incident: `beforeInitialize` admits exactly
  one PoolKey — the launch's coin against the native quote, dynamic fee,
  this hook — so nobody can hang this hook on another pool and borrow its
  reputation.

  ── the clock ──

  A raise graduates when its target is met, which is any moment inside its
  deadline, so "opens at" and "unlocks at" cannot be dates written before
  the raise begins without either idling a pool that could trade or
  promising a lock shorter than the one meant. The terms are durations;
  the moment they count from is the one the custodian wrote when it seeded
  the pool, `seededAt`, read once from the custodian and kept. Until the
  custodian has seeded, nothing opens and nothing unlocks — a pool a
  stranger initialised early under this hook trades and pays out only
  once the launch does.

  ── why nothing here is `immutable` ──

  A Solidity immutable is written into the runtime bytecode at deployment,
  so two hooks with different terms would have different code and
  different codehashes. The Router pins ONE codehash for every launch's
  hook (`LAUNCH_HOOK_CODEHASH`, DESIGN.md §6.2): that pin is only possible
  if every launch's hook has the same runtime bytes. So the terms live in
  storage, written once by the constructor, with no setter anywhere — fixed
  at birth exactly as an immutable would be, and `keccak256(runtimeCode)` is
  one number for every band.

  ── what the address says ──

  The three permissions are the low fourteen bits of this contract's
  address (src/lib/Hook.sol). `getHookPermissions` says the same three;
  the first callback the pool makes (`beforeInitialize`) asserts they agree,
  so a hook mined to the wrong bits never gets a pool. The Kiln's
  `deployHook` already refuses such a deployment (`WrongFlags`); this is the
  second lock on the same door.
───────────────────────────────────────────────────────────────────────────*/
contract LaunchHook is ILaunchHook {
    /// @notice The three bits this hook holds, and no delta-returning flag.
    uint16 public constant FLAGS = uint16(Hook.BEFORE_INITIALIZE | Hook.BEFORE_SWAP | Hook.BEFORE_REMOVE_LIQUIDITY);
    /// @notice Every launch pool's grid (DESIGN.md §12: pinned per band).
    int24 public constant TICK_SPACING = 60;

    /*  Three slots, written by the constructor and — the seeding moment
        only — once by the first callback after the custodian seeded. The
        first slot is what every swap reads; the second holds the lock and
        the key; the third is consulted until the moment is known.       */
    address private _manager;
    uint32  private _opensIn;
    uint24  private _startFee;
    uint32  private _decay;
    address private _coin;
    uint32  private _lockFor;
    uint24  private _floorFee;
    uint40  private _seededAt;
    address private _custodian;

    constructor(address manager, address custodian, address coin) {
        /*  Terms are registered before any hook of theirs can be born: a
            deployment racing the registration — a salt seen in a mempool —
            finds nothing and reverts, so no hook ever carries blank terms. */
        if (ILPCustodian(custodian).launchOfCoin(coin) == 0) revert Unregistered(coin);
        HookTerms memory t = ILPCustodian(custodian).hookTermsOf(coin);
        _manager = manager;
        _opensIn = t.opensIn;
        _startFee = t.startFee;
        _decay = t.decay;
        _coin = coin;
        _lockFor = t.lockFor;
        _floorFee = t.floorFee;
        _custodian = custodian;
    }

    modifier onlyManager() {
        if (msg.sender != _manager) revert NotTheManager();
        _;
    }

    /*═══════════════════ the callbacks ═══════════════════*/

    /// @notice The pool is being created: it must be THIS launch's pool.
    /// @dev    The sender is not consulted — v4's `initialize` is open, and a
    ///         stranger creating the right pool early is handled by the
    ///         custodian's 1 % check at seeding (DESIGN.md §8.3), not here.
    function beforeInitialize(address, PoolKey calldata key, uint160) external view onlyManager returns (bytes4) {
        uint16 got = Hook.flags(address(this));
        if (got != FLAGS) revert WrongFlags(FLAGS, got);
        if (key.currency0 != address(0) || key.currency1 != _coin || key.fee != Hook.DYNAMIC_FEE
            || key.tickSpacing != TICK_SPACING || key.hooks != address(this)) revert ForeignKey();
        return ILaunchHook.beforeInitialize.selector;
    }

    /// @notice No swap before OPENS; after it, the fee of the moment with
    ///         the override flag set — without the flag the pool keeps its
    ///         stored fee and ignores this number without a word.
    /// @dev    `hookData` and the swap's parameters are never read: the fee
    ///         is a function of the clock alone, the same for every trader.
    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external onlyManager returns (bytes4, int256, uint24)
    {
        uint64 s = _anchor();
        if (s == 0) revert NotOpenYet(0);
        uint64 opens = s + _opensIn;
        if (block.timestamp < opens) revert NotOpenYet(opens);
        return (ILaunchHook.beforeSwap.selector, int256(0), _feeAt(uint64(block.timestamp), opens) | Hook.OVERRIDE_FEE);
    }

    /// @notice Principal stays until UNLOCKS; a zero-delta poke — how the
    ///         PositionManager collects fees — is not a withdrawal and passes.
    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata p, bytes calldata)
        external onlyManager returns (bytes4)
    {
        if (p.liquidityDelta < 0) {
            uint64 s = _anchor();
            if (s == 0) revert StillLocked(0);
            uint64 unlocks = s + _lockFor;
            if (block.timestamp < unlocks) revert StillLocked(unlocks);
        }
        return ILaunchHook.beforeRemoveLiquidity.selector;
    }

    /// @notice The three bits, as v4's `Hooks.validateHookPermissions` reads them.
    function getHookPermissions() external pure returns (HookPermissions memory p) {
        p.beforeInitialize = true;
        p.beforeSwap = true;
        p.beforeRemoveLiquidity = true;
    }

    /*═══════════════════ the clock ═══════════════════*/

    /// @dev The seeding moment: kept once known, zero until then. Before the
    ///      custodian has seeded, the pool is shut both ways — the callers
    ///      say `NotOpenYet(0)` (no opening time exists yet) and
    ///      `StillLocked(0)` (no unlock time exists yet).
    function _anchor() private returns (uint64 s) {
        s = _seededAt;
        if (s == 0) {
            s = ILPCustodian(_custodian).seededAt(_coin);
            if (s != 0) _seededAt = uint40(s);
        }
    }

    function _seeded() private view returns (uint64 s) {
        s = _seededAt;
        if (s == 0) s = ILPCustodian(_custodian).seededAt(_coin);
    }

    /// @notice `floor + (start − floor) · max(0, 1 − elapsed / DECAY)`.
    function _feeAt(uint64 t, uint64 opens) private view returns (uint24) {
        uint256 start = _startFee;
        uint256 floor = _floorFee;
        uint256 decay = _decay;
        if (t <= opens) return uint24(start);
        uint256 elapsed = t - opens;
        if (elapsed >= decay) return uint24(floor);
        return uint24(floor + (start - floor) * (decay - elapsed) / decay);
    }

    /*═══════════════════ the terms, for a page to print ═══════════════════*/

    /// @notice The fee at `t`, once the pool is seeded; the start fee before.
    function feeAt(uint64 t) external view returns (uint24) {
        uint64 s = _seeded();
        return s == 0 ? _startFee : _feeAt(t, s + _opensIn);
    }

    function poolKey() external view returns (PoolKey memory) {
        return PoolKey(address(0), _coin, Hook.DYNAMIC_FEE, TICK_SPACING, address(this));
    }

    function status() external view returns (bool tradingOpen, bool liquidityFree) {
        uint64 s = _seeded();
        if (s == 0) return (false, false);
        return (block.timestamp >= s + _opensIn, block.timestamp >= s + _lockFor);
    }

    /// @notice The opening moment: zero until the custodian has seeded.
    function OPENS() external view returns (uint64) {
        uint64 s = _seeded();
        return s == 0 ? 0 : s + _opensIn;
    }

    /// @notice The unlock moment: zero until the custodian has seeded.
    function UNLOCKS() external view returns (uint64) {
        uint64 s = _seeded();
        return s == 0 ? 0 : s + _lockFor;
    }

    function MANAGER() external view returns (address) { return _manager; }
    function CUSTODIAN() external view returns (address) { return _custodian; }
    function COIN() external view returns (address) { return _coin; }
    function SEEDED_AT() external view returns (uint64) { return _seeded(); }
    function OPENS_IN() external view returns (uint32) { return _opensIn; }
    function LOCK_FOR() external view returns (uint32) { return _lockFor; }
    function START_FEE() external view returns (uint24) { return _startFee; }
    function FLOOR_FEE() external view returns (uint24) { return _floorFee; }
    function DECAY() external view returns (uint32) { return _decay; }
}
