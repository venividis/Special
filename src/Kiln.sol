// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Origin: IPSEITY src/Kiln.sol (`Kiln`, `Gate`), adapted (INTACT U6): the Coin
// is minted to the launching token's Reach with a raise share to the
// Launchpad, the per-token launch clock and first-launch rule are consulted
// in the Launchpad, `band`/`facetArg` and the Facet recipe are dropped
// (the fee hook of v1 is U14's LaunchHook), and `mayActAs` is `Rights.acts`.
// Load-bearing comments kept.

import {IKiln, LaunchRecord} from "./interfaces/IKiln.sol";
import {ILaunchpad} from "./interfaces/ILaunchpad.sol";
import {Rights, IRightsHub} from "./lib/Rights.sol";
import {Hook} from "./lib/Hook.sol";
import {Transient} from "./lib/Transient.sol";
import {Coin} from "./Coin.sol";

/*  The half of the Launchpad the Kiln speaks to — `recordLaunch`, one
    keeper for the per-token launch clock, the first-launch rule and the
    launch root (DESIGN.md §8.1 "both rate-limited per token, both named in
    the token's launchRoot") — was a local `ILaunchClock` until the wave-1
    integration added it to ILaunchpad (docs/INTERFACE-CHANGES.md).      */

/*───────────────────────────────────────────────────────────────────────────
  Kiln — where a launch is made

  A launchpad is four transactions with a lot of choices in front of them:
  make a token, choose what may intercept its pool, create the pool, put
  liquidity in it. This contract owns the first two. The raise and the
  market are the Launchpad's and the Pool's.

  ── the token has no owner, and that is the point ──

  `Coin` is a fixed-supply ERC-20 with no mint, no pause, no blacklist, no
  owner and no upgrade path. The entire supply exists at deployment and
  goes where the launcher said: the launching token's Reach — the vault
  holds it from block one and it travels with the token — and, for the
  share that will be raised, the Launchpad directly, so no Reach approval
  exists anywhere (the standing-approval flaw of design C, closed; a
  sealed Reach can still raise).

  Everything a person might actually want to vary — supply, decimals, the
  split between the vault and the raise — is varied at the launch, not
  smuggled into the token as a permission.

  ── who may launch ──

  `acts(id, msg.sender)`: the holder or the token's own Reach, never a
  renter, operator or approvee. A session key launches only through the
  Reach, and the Launchpad's clock adds the two rules an agent's launch
  needs: the first launch of a token wants the holder (or the guardian's
  epoch-stamped co-sign), and launches are seven days apart per token.

  ── mining a hook's address ──

  Uniswap v4 encodes a hook's permissions in the low fourteen bits of its
  address. So a hook that wants `beforeSwap` must *be deployed at* an
  address with that bit set, which means trying CREATE2 salts until one
  lands. Roughly 2^14 attempts for a full pattern.

  A browser cannot do that here: the client this collection ships has no
  keccak-256, on purpose. This contract does. `mine` is a `view` function
  that walks salts and returns the first that lands — run by the visitor's
  own node under `eth_call`, which executes and discards, so the search
  costs nobody anything and commits nothing. Sixty thousand candidates fit
  comfortably in one call; the page asks for a window at a time and says how
  many it has tried.

  That is the whole trick, and it is the reason a launchpad with hooks can
  exist on a page with no server: the expensive, keccak-shaped part of
  deploying a hook is a read, and reads are free.
───────────────────────────────────────────────────────────────────────────*/
contract Kiln is IKiln {
    /// @notice The collection. A launch is signed by a token of it; what
    ///         this contract deploys carries the collection's name, so the
    ///         collection's tokens are what may deploy it. It confers no
    ///         other power; there is no privileged caller anywhere here.
    address public immutable HUB;
    /// @notice Where a raise share is minted, and the keeper of the clock.
    ///         A mutual immutable: the Launchpad pins this Kiln back, so
    ///         the deployer predicts this address before either exists.
    address public immutable LAUNCHPAD;
    /// @notice The PoolManager the shipped hooks will accept calls from.
    /// @dev    A constructor argument, like every other address in this
    ///         collection. A hook that trusted the wrong manager would let
    ///         anybody call its callbacks directly, which for a hook that
    ///         gates withdrawals means anybody can ask it to allow one.
    address public immutable POOL_MANAGER;

    /// @notice A coin with more decimals than this cannot price its own
    ///         floor: `10 ** decimals` must stay far inside a word.
    uint8 public constant MAX_DECIMALS = 36;

    /*  `BadDecimals` (decimals above MAX_DECIMALS) was this contract's own
        until the wave-1 integration moved it into IKilnEvents.          */

    /// @dev Every coin this contract has made, in order, so the page can
    ///      list them without an indexer.
    address[] private _coins;
    /// @dev Per launching token, the record the fingerprint and the page
    ///      read.
    mapping(uint256 => LaunchRecord[]) private _records;
    /// @notice Which token of the collection signed each coin. Zero for a
    ///         coin this Kiln did not make.
    mapping(address => uint256) public launchedBy;

    constructor(address hub, address launchpad, address poolManager) {
        HUB = hub;
        LAUNCHPAD = launchpad;
        POOL_MANAGER = poolManager;
    }

    /*═══════════════════ making a token ═══════════════════*/

    /// @notice Deploy a fixed-supply token to a deterministic address.
    /// @dev    CREATE2 so the address is known before the transaction is
    ///         sent and cannot be changed by a reorder — a launch that
    ///         announces its address in advance can be checked against what
    ///         actually appeared.
    /// @param raiseShare how much of `supply` goes to the Launchpad for a
    ///                   raise (`Launchpad.create` completes it); the rest
    ///                   goes to the token's Reach.
    function launch(
        uint256 id, string calldata name_, string calldata symbol_,
        uint8 decimals_, uint256 supply, bytes32 salt, uint256 raiseShare
    ) external returns (address coin) {
        Transient.enter(Transient.KILN_LOCK);
        if (!Rights.acts(HUB, id, msg.sender)) revert NotActor();
        if (supply == 0) revert NothingToLaunch();
        if (raiseShare > supply) revert ShareTooLarge();
        if (decimals_ > MAX_DECIMALS) revert BadDecimals();
        if (!_label(name_) || !_label(symbol_)) revert BadName();

        address reach = IRightsHub(HUB).account(id);
        /*  The launcher is mixed into the salt, so two people using the same
            vanity salt do not collide and neither can front-run the other's
            address. Without this, watching the mempool for a `launch` and
            re-sending it with more gas takes the address.                */
        bytes32 s = keccak256(abi.encode(msg.sender, salt));
        bytes memory code = _coinCode(name_, symbol_, decimals_, supply, raiseShare, reach, id);
        assembly ("memory-safe") {
            coin := create2(0, add(code, 32), mload(code), s)
        }
        if (coin == address(0)) revert DeployFailed();

        _coins.push(coin);
        _records[id].push(LaunchRecord({
            coin: coin, launchedAt: uint64(block.timestamp), supply: supply, raiseShare: raiseShare
        }));
        launchedBy[coin] = id;

        /*  The clock lives in one place for both kinds of launch. The
            Launchpad applies the first-launch rule and the seven-day
            spacing, extends the token's launch root, and remembers the
            raise share this coin brought it — so `create` can only ever
            spend a share the Kiln minted, once.                           */
        ILaunchpad(LAUNCHPAD).recordLaunch(id, msg.sender, coin, raiseShare);

        emit Launched(coin, id, msg.sender, symbol_, supply, raiseShare);
        Transient.exit(Transient.KILN_LOCK);
    }

    /// @notice Where `launch` would put a token, before sending it.
    /// @dev    Mirrors exactly what CREATE2 hashes: the sender-mixed salt
    ///         and the creation code with every constructor argument, the
    ///         Reach looked up the same way `launch` looks it up.
    function coinAt(
        uint256 id, address by, string calldata name_, string calldata symbol_,
        uint8 decimals_, uint256 supply, bytes32 salt, uint256 raiseShare
    ) external view returns (address) {
        return Hook.at(
            address(this),
            keccak256(abi.encode(by, salt)),
            keccak256(_coinCode(name_, symbol_, decimals_, supply, raiseShare, IRightsHub(HUB).account(id), id))
        );
    }

    function _coinCode(
        string calldata name_, string calldata symbol_, uint8 decimals_,
        uint256 supply, uint256 raiseShare, address reach, uint256 id
    ) private view returns (bytes memory) {
        return abi.encodePacked(
            type(Coin).creationCode,
            abi.encode(name_, symbol_, decimals_, supply, raiseShare, reach, LAUNCHPAD, id)
        );
    }

    /// @dev The whitelist a name must pass: one to thirty-two bytes, every
    ///      one printable ASCII. The five HTML metacharacters are allowed —
    ///      a coin may be named `</script>` — because every page escapes
    ///      labels on the way out (`Web.esc`), and a whitelist here is only
    ///      a bound on what the escaper has to handle, never the escaping.
    function _label(string calldata s) private pure returns (bool) {
        bytes calldata b = bytes(s);
        if (b.length == 0 || b.length > 32) return false;
        for (uint256 i; i < b.length; ++i) {
            uint8 c = uint8(b[i]);
            if (c < 0x20 || c > 0x7E) return false;
        }
        return true;
    }

    /*═══════════════════ records ═══════════════════*/

    function recordsOf(uint256 id) external view returns (LaunchRecord[] memory) {
        return _records[id];
    }

    function launchCount(uint256 id) external view returns (uint256) {
        return _records[id].length;
    }

    function coinCount() external view returns (uint256) {
        return _coins.length;
    }

    /// @notice A window of the launched tokens, newest first.
    /// @dev    Newest first because a launchpad's list is read for what just
    ///         happened. Paged, because reading all of them in one
    ///         `eth_call` is a call no node will finish.
    function recent(uint256 from, uint256 count) external view returns (address[] memory out) {
        uint256 n = _coins.length;
        if (from >= n) return new address[](0);
        uint256 take = n - from;
        if (take > count) take = count;
        out = new address[](take);
        for (uint256 i; i < take; ++i) out[i] = _coins[n - 1 - from - i];
    }

    /*═══════════════════ mining a hook's address ═══════════════════*/

    /// @notice Walk CREATE2 salts until one lands on an address whose low
    ///         fourteen bits are exactly `flags`.
    /// @dev    A `view`, so a browser runs it with `eth_call` — it executes
    ///         and commits nothing, and costs the searcher nothing but their
    ///         own node's time. This is the only reason a client with no
    ///         keccak can deploy a v4 hook at all.
    ///
    ///         Bounded rather than looping to success, because an `eth_call`
    ///         has a gas ceiling and a function that ignored it would simply
    ///         fail at some size with no partial answer. The caller asks for
    ///         a window, gets told whether it landed, and moves the window
    ///         along — so the page can say "tried 180,000" instead of
    ///         hanging.
    ///
    ///         `flags` must be matched exactly, not merely contained: v4
    ///         requires a hook's address bits to equal its declared
    ///         permissions, so an address with a *spare* bit set is one the
    ///         PoolManager will hand a callback the hook does not implement.
    /// @param initCodeHash keccak of the hook's creation code plus its
    ///                     constructor arguments — the thing CREATE2 hashes
    /// @param flags        the fourteen-bit pattern wanted
    /// @param from         the first salt to try, as a number
    /// @param tries        how many to try before giving up
    function mine(bytes32 initCodeHash, uint16 flags, uint256 from, uint256 tries)
        external view returns (bool found, bytes32 salt, address at)
    {
        uint160 want = uint160(flags) & Hook.MASK;
        address self = address(this);
        assembly ("memory-safe") {
            let p := mload(0x40)
            // 0xff ++ deployer(20) ++ salt(32) ++ initCodeHash(32) = 85 bytes.
            // Laid out once; only the salt word moves between attempts.
            mstore8(p, 0xff)
            mstore(add(p, 1), shl(96, self))
            mstore(add(p, 53), initCodeHash)
            let mask := 0x3fff
            for { let i := 0 } lt(i, tries) { i := add(i, 1) } {
                let s := add(from, i)
                mstore(add(p, 21), s)
                let a := and(keccak256(p, 85), 0xffffffffffffffffffffffffffffffffffffffff)
                if eq(and(a, mask), want) {
                    found := 1
                    salt := s
                    at := a
                    break
                }
            }
        }
    }

    /// @notice Deploy one of the hooks this contract ships, at a salt that
    ///         `mine` found, and refuse to hand back an address that does
    ///         not carry the permissions the hook declares.
    /// @dev    The check is not ceremony. A hook deployed to an address
    ///         missing one of its bits is a hook whose callback the pool
    ///         will simply never invoke — the code is there, it compiles, it
    ///         is verified on the explorer, and it never runs. A lock that
    ///         is never consulted looks exactly like a lock.
    function deployHook(uint8 kind, bytes32 salt, bytes32 arg) external returns (address hook) {
        (bytes memory code, uint16 flags) = _recipe(kind, arg);
        assembly ("memory-safe") {
            hook := create2(0, add(code, 32), mload(code), salt)
        }
        if (hook == address(0)) revert DeployFailed();
        uint16 got = Hook.flags(hook);
        if (got != flags) revert WrongFlags(flags, got);
        emit HookDeployed(hook, msg.sender, flags);
    }

    /// @notice The creation-code hash for a shipped hook, which is what
    ///         `mine` needs and what a reader can recompute themselves —
    ///         and the permissions that recipe needs, so a caller never
    ///         guesses them.
    function recipeHash(uint8 kind, bytes32 arg) external view returns (bytes32 initCodeHash, uint16 flags) {
        bytes memory code;
        (code, flags) = _recipe(kind, arg);
        initCodeHash = keccak256(code);
    }

    /// @dev The catalogue. Kind 0 is the Gate — the header of `Gate` below
    ///      says why it is the one most launches want. Kind 1 is reserved
    ///      for the per-launch `LaunchHook` of DESIGN.md §8.4 (U14); until
    ///      it ships, every other kind is `UnknownRecipe`.
    function _recipe(uint8 kind, bytes32 arg) private view returns (bytes memory code, uint16 flags) {
        if (kind == 0) {
            return (
                abi.encodePacked(type(Gate).creationCode, abi.encode(
                    POOL_MANAGER,
                    uint64(uint256(arg) >> 64),      // trading opens
                    uint64(uint256(arg))             // liquidity unlocks
                )),
                uint16(Hook.BEFORE_REMOVE_LIQUIDITY | Hook.BEFORE_SWAP)
            );
        }
        revert UnknownRecipe(kind);
    }
}

/*═══════════════════ the shapes v4 hands a hook ═══════════════════*/

/*  Declared here, once, because a hook's callbacks are matched BY SELECTOR
    and a selector is the hash of the whole signature. Get one field's type
    wrong and the PoolManager calls a function this contract does not have —
    which, with no fallback, reverts every swap and every withdrawal on any
    pool that trusted it.

    `Currency` and `IHooks` in v4's own source are user-defined types
    wrapping `address`, and a user-defined value type ABI-encodes as the type
    it wraps — so `address` here produces byte-identical selectors. The
    MockPoolManager in test/mocks dispatches by exactly these strings.    */
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

/*───────────────────────────────────────────────────────────────────────────
  Gate — the one hook a launchpad actually needs

  Two promises every token launch makes and almost none of them can keep:

    "trading opens at <time>"   and   "liquidity is locked until <date>".

  Both are normally kept by a third-party locker holding the LP position, or
  by nothing at all. Under v4 they are kept by the pool: this hook holds
  `beforeSwap` and `beforeRemoveLiquidity`, and the PoolManager will not
  process either without asking it first.

  So the lock is not a promise about what somebody will do later. It is a
  pool that cannot pay the liquidity out, enforced by the same contract that
  would have paid it. And the two bits are readable off the hook's address
  before anyone buys, without trusting a word of this file.

  ── the half of that which is not reassuring ──

  **These are exactly the bits a trap has.** A hook that refuses withdrawals
  until Friday and a hook that refuses them forever have the same address
  shape, and no amount of reading the address distinguishes them. The page
  says so beside every hook it shows, this one included.

  What makes *this* hook safe is not the shape. It is that both timestamps
  are `immutable`, fixed at deployment, readable by anyone, and have no
  setter, no owner and no upgrade path — so the only thing that can open the
  gate is the clock, and the only thing that can keep it shut is the clock.
───────────────────────────────────────────────────────────────────────────*/
contract Gate {
    /// @notice The PoolManager, and the only address these callbacks accept.
    address public immutable MANAGER;
    /// @notice No swap goes through before this.
    uint64 public immutable OPENS;
    /// @notice No liquidity leaves before this.
    uint64 public immutable UNLOCKS;

    error NotTheManager();
    error NotOpenYet(uint64 opens);
    error StillLocked(uint64 unlocks);

    constructor(address manager, uint64 opens, uint64 unlocks) {
        MANAGER = manager;
        OPENS = opens;
        UNLOCKS = unlocks;
    }

    modifier onlyManager() {
        if (msg.sender != MANAGER) revert NotTheManager();
        _;
    }

    /*  Both arguments lists are ignored, deliberately. This hook's decision
        depends on the clock and nothing else — not on who is trading, not on
        how much, not on which pool. A hook that read more than it needs is a
        hook with more ways to be wrong, and every field it touches is a
        field whose layout it has to be right about.

        `beforeSwap` returns three values: the selector, a delta, and a fee
        override. Zero for the last two is "change nothing", which is the
        only honest thing for a hook that merely gates to say — a nonzero fee
        override on a pool that is not dynamic-fee reverts.              */

    function beforeSwap(
        address, PoolKey calldata, SwapParams calldata, bytes calldata
    ) external view onlyManager returns (bytes4, int256, uint24) {
        if (block.timestamp < OPENS) revert NotOpenYet(OPENS);
        return (Gate.beforeSwap.selector, int256(0), uint24(0));
    }

    function beforeRemoveLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata
    ) external view onlyManager returns (bytes4) {
        if (block.timestamp < UNLOCKS) revert StillLocked(UNLOCKS);
        return Gate.beforeRemoveLiquidity.selector;
    }

    /// @notice What the gate is doing right now, for a page to print.
    function status() external view returns (bool tradingOpen, bool liquidityFree) {
        return (block.timestamp >= OPENS, block.timestamp >= UNLOCKS);
    }
}
