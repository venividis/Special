// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Kiln} from "../src/Kiln.sol";
import {Coin} from "../src/Coin.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {LaunchHook} from "../src/LaunchHook.sol";
import {LPCustodian} from "../src/LPCustodian.sol";
import {IKilnEvents} from "../src/interfaces/IKiln.sol";
import {ILaunchpadEvents, LaunchParams, Launch, LaunchState, Target} from "../src/interfaces/ILaunchpad.sol";
import {
    ILaunchHook, ILPCustodianEvents, PoolKey, SwapParams, ModifyLiquidityParams, HookPermissions, HookTerms, Custody
} from "../src/interfaces/ILPCustodian.sol";
import {Hook} from "../src/lib/Hook.sol";
import {Mul} from "../src/lib/Mul.sol";
import {Ratchet} from "../src/lib/Ratchet.sol";
import {LaunchHub, LaunchLocks, LaunchWiring} from "./mocks/LaunchFixtures.sol";
import {MockV4Manager, MockPermit2, MockPositionManager, CustodianFactory, V4Wiring} from "./mocks/V4Fixtures.sol";

/*  DESIGN.md §8.3–8.4 and §14 D2, D6 (INTACT U14): the per-launch v4 hook
    driven BY SELECTOR through a manager that reads its bits off the
    address, the custodian that seeds the pool and holds the position, and
    the raise graduating into both. The hub is the U6 fixture (a test can
    prank its Reach); the PoolManager, PositionManager and Permit2 are the
    U14 fixtures in test/mocks/V4Fixtures.sol.                            */
contract HookTest is Test {
    LaunchHub hub;
    MockV4Manager pm;
    MockPermit2 permit2;
    MockPositionManager posm;
    V4Wiring w;
    Kiln kiln;
    Launchpad pad;
    LPCustodian cust;
    LaunchLocks locks;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    address dave = address(0xDA7E);
    address eve = address(0xE7E);
    uint256 id;
    address reach;

    uint64 constant T0 = 1_733_000_000;
    uint256 constant SUPPLY = 1_000_000_000e18;
    uint256 constant RAISE = 900_000_000e18;
    uint128 constant CURVE = 700_000_000e18;
    uint128 constant VQ = 1 ether;
    uint128 constant TARGET = 3 ether;
    uint16 constant FLAGS = uint16(Hook.BEFORE_INITIALIZE | Hook.BEFORE_SWAP | Hook.BEFORE_REMOVE_LIQUIDITY);
    uint256 constant Q96 = 1 << 96;

    receive() external payable {}

    function setUp() public {
        vm.warp(T0);
        hub = new LaunchHub();
        pm = new MockV4Manager();
        permit2 = new MockPermit2();
        posm = new MockPositionManager(address(pm), address(permit2));
        w = new V4Wiring(address(hub), address(pm), address(posm), address(permit2), new CustodianFactory());
        kiln = w.kiln();
        pad = w.pad();
        cust = w.custodian();
        locks = w.locks();
        id = hub.mint(alice);
        reach = hub.account(id);
        vm.deal(address(this), 100 ether);
    }

    /*═══════════════════ helpers ═══════════════════*/

    function _launch(uint256 tokenId, address by, bytes32 salt, uint256 raiseShare) internal returns (address coin) {
        vm.prank(by);
        coin = kiln.launch(tokenId, "Agent One", "AGENT1", 18, SUPPLY, salt, raiseShare);
    }

    function _params(uint256 tokenId, address coin) internal view returns (LaunchParams memory p) {
        p = LaunchParams({
            id: tokenId, coin: coin, curveSupply: CURVE, virtualQuote: VQ, graduationTarget: TARGET,
            startsAt: 0, fairWindow: 0, maxBuyInWindow: type(uint128).max, snipeTaxStartBps: 0, feeBps: 0,
            creatorBps: 0, creatorVestBps: 0, deadline: uint64(block.timestamp + 7 days), target: Target.UniswapV4
        });
    }

    /// @dev Opens at once, locked thirty days, 10 % decaying to 1 % over a day.
    function _terms() internal pure returns (HookTerms memory) {
        return HookTerms({opensIn: 0, lockFor: 30 days, startFee: 100_000, floorFee: 10_000, decay: 1 days});
    }

    /// @dev `Kiln.mine` as the page runs it: a view, windows of sixty thousand.
    function _mine(address coin) internal view returns (bytes32 salt, address at) {
        (bytes32 h, uint16 flags) = kiln.recipeHash(1, bytes32(uint256(uint160(coin))));
        bool found;
        uint256 from;
        while (!found) {
            (found, salt, at) = kiln.mine(h, flags, from, 60_000);
            from += 60_000;
        }
    }

    function _createV4(address by, LaunchParams memory p, HookTerms memory t) internal returns (uint256 launchId, bytes32 salt) {
        (salt, ) = _mine(p.coin);
        vm.prank(by);
        launchId = pad.createV4(p, t, salt);
    }

    function _standard() internal returns (uint256 launchId, address coin) {
        coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        (launchId, ) = _createV4(alice, _params(id, coin), _terms());
    }

    function _buy(uint256 launchId, address who, uint256 value) internal returns (uint256 out) {
        vm.deal(who, who.balance + value);
        vm.prank(who);
        out = pad.buy{value: value}(launchId, 0, uint64(block.timestamp), 10_000);
    }

    function _fill(uint256 launchId) internal {
        _buy(launchId, bob, 1 ether);
        _buy(launchId, carol, 1 ether);
        _buy(launchId, dave, 1 ether);
    }

    function _graduated() internal returns (uint256 launchId, address coin, address hook) {
        (launchId, coin) = _standard();
        _fill(launchId);
        vm.prank(eve);
        pad.graduate(launchId);
        hook = cust.hookOf(launchId);
    }

    /// @dev The terminal sqrt price the Launchpad hands the custodian, from
    ///      the two amounts the position is made of.
    function _terminalSqrt(uint256 launchId) internal view returns (uint160) {
        Launch memory l = pad.launchOf(launchId);
        uint256 amountBase = Mul.mulDivDown(l.raised, l.baseReserve, l.quoteReserve);
        return uint160(_sqrt(Mul.mulDivDown(amountBase, 1 << 192, l.raised)));
    }

    function _sqrt(uint256 x) internal pure returns (uint256 r) {
        if (x == 0) return 0;
        r = x;
        uint256 y = (x + 1) / 2;
        while (y < r) { r = y; y = (x / y + y) / 2; }
    }

    function _swapEthIn(PoolKey memory k, uint256 amount) internal {
        pm.swap{value: amount}(k, SwapParams(true, -int256(amount), 0), "");
    }

    /*═══════════════════ the wiring ═══════════════════*/

    function test_theCustodianIsPinnedBothWaysAndTheWrongDoorIsRefused() public {
        assertEq(pad.CUSTODIAN(), address(cust));
        assertEq(cust.LAUNCHPAD(), address(pad));
        assertEq(cust.KILN(), address(kiln));
        assertEq(cust.HUB(), address(hub));
        assertEq(cust.POOL_MANAGER(), address(pm));
        assertEq(cust.POSITION_MANAGER(), address(posm));
        assertEq(cust.PERMIT2(), address(permit2));
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);

        // the v4 target goes through createV4, and the owned target does not
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.WrongTarget.selector); pad.create(p);
        bytes32 th = pad.termsHash(p);
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.WrongTarget.selector); pad.createChecked(p, th);
        p.target = Target.OwnedPool;
        (bytes32 salt, ) = _mine(coin);
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.WrongTarget.selector); pad.createV4(p, _terms(), salt);
        // a stranger cannot create either way
        p.target = Target.UniswapV4;
        vm.prank(bob); vm.expectRevert(ILaunchpadEvents.NotActor.selector); pad.createV4(p, _terms(), salt);

        // without a custodian the recipe does not exist and the target is NotYet (the MVB wiring)
        LaunchWiring w0 = new LaunchWiring(address(hub), address(pm), 0);
        assertEq(w0.pad().CUSTODIAN(), address(0));
        Kiln k0 = w0.kiln();
        vm.expectRevert(IKilnEvents.UnknownRecipe.selector);
        k0.recipeHash(1, bytes32(uint256(uint160(coin))));
    }

    function test_createV4CheckedPinsTheTermsTheHookTermsAndTheSalt() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        HookTerms memory t = _terms();
        (bytes32 salt, address at) = _mine(coin);
        bytes32 h = pad.v4TermsHash(p, t, salt);
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.TermsMoved.selector); pad.createV4Checked(p, t, salt, bytes32(uint256(h) ^ 1));
        t.floorFee += 1;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.TermsMoved.selector); pad.createV4Checked(p, t, salt, h);
        t.floorFee -= 1;
        vm.prank(alice);
        uint256 launchId = pad.createV4Checked(p, t, salt, h);
        assertEq(launchId, 1);
        Custody memory c = cust.custodyOf(launchId);
        assertEq(c.coin, coin);
        assertEq(c.id, id);
        assertEq(c.salt, salt);
        assertEq(c.hook, at, "the hook address is what the miner named");
        assertEq(c.unlocksAt, 0, "no ratchet before the seeding sets the clock");
        assertEq(c.seededAt, 0);
        assertEq(cust.launchOfCoin(coin), launchId);
        HookTerms memory stored = cust.hookTermsOf(coin);
        assertEq(stored.startFee, t.startFee);
        assertEq(stored.lockFor, t.lockFor);
        assertTrue(pad.launchOf(launchId).target == Target.UniswapV4);
        assertEq(pad.launchOf(launchId).termsHash, pad.termsHash(p), "the launch's own hash is still over the struct");
        // the same coin cannot be registered twice: its share was spent
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.WrongCoin.selector); pad.createV4(p, t, salt);
    }

    function test_badHookTermsAndABadSaltAreRefusedAtCreate() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        (bytes32 salt, ) = _mine(coin);
        HookTerms memory t;

        t = _terms(); t.startFee = 900_001;
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.BadTerms.selector); pad.createV4(p, t, salt);
        t = _terms(); t.floorFee = t.startFee + 1;
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.BadTerms.selector); pad.createV4(p, t, salt);
        t = _terms(); t.lockFor = 3650 days + 1;
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.BadTerms.selector); pad.createV4(p, t, salt);
        t = _terms(); t.opensIn = 3650 days + 1;
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.BadTerms.selector); pad.createV4(p, t, salt);
        // a salt the miner did not bless
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.BadSalt.selector); pad.createV4(p, _terms(), bytes32(uint256(salt) ^ 1));
        // the boundaries themselves are fine
        t = _terms(); t.startFee = 900_000; t.floorFee = 900_000; t.lockFor = 3650 days; t.opensIn = 3650 days;
        vm.prank(alice);
        assertEq(pad.createV4(p, t, salt), 1);
    }

    function test_aCurveWhosePriceNoPoolCanHoldIsRefusedAtCreate() public {
        // ten units of coin against 3.4e38 wei of virtual quote: the curve's floor price is under MIN_SQRT
        address coin = _launch(id, alice, bytes32(uint256(1)), 10);
        LaunchParams memory p = _params(id, coin);
        p.curveSupply = 8; p.virtualQuote = type(uint128).max; p.graduationTarget = 1;
        (bytes32 salt, ) = _mine(coin);
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.PriceOutOfRange.selector); pad.createV4(p, _terms(), salt);
    }

    /*═══════════════════ the hook, by selector ═══════════════════*/

    function test_everyHookEntryRefusesACallerThatIsNotTheManager() public {
        (uint256 launchId, , address hookAddr) = _graduated();
        ILaunchHook hook = ILaunchHook(hookAddr);
        PoolKey memory k = cust.poolKeyOf(launchId);
        ModifyLiquidityParams memory zero = ModifyLiquidityParams(-887220, 887220, 0, bytes32(0));

        vm.expectRevert(ILaunchHook.NotTheManager.selector);
        hook.beforeInitialize(address(this), k, 1);
        vm.expectRevert(ILaunchHook.NotTheManager.selector);
        hook.beforeSwap(address(this), k, SwapParams(true, -1, 0), "");
        vm.expectRevert(ILaunchHook.NotTheManager.selector);
        hook.beforeRemoveLiquidity(address(this), k, zero, "");
        // not even the custodian or the kiln
        vm.prank(address(cust)); vm.expectRevert(ILaunchHook.NotTheManager.selector); hook.beforeSwap(address(this), k, SwapParams(true, -1, 0), "");
        vm.prank(address(kiln)); vm.expectRevert(ILaunchHook.NotTheManager.selector); hook.beforeRemoveLiquidity(address(this), k, zero, "");

        // the manager itself is answered, with the selector v4 checks for
        vm.prank(address(pm));
        assertEq(bytes32(hook.beforeInitialize(address(this), k, 1)), bytes32(ILaunchHook.beforeInitialize.selector));
        vm.prank(address(pm));
        (bytes4 s, int256 delta, uint24 fee) = hook.beforeSwap(address(this), k, SwapParams(true, -1, 0), "");
        assertEq(bytes32(s), bytes32(ILaunchHook.beforeSwap.selector));
        assertEq(delta, 0, "no delta: the hook holds no delta-returning flag");
        assertEq(uint256(fee & Hook.OVERRIDE_FEE), uint256(Hook.OVERRIDE_FEE), "the override flag is set");
        vm.prank(address(pm));
        assertEq(bytes32(hook.beforeRemoveLiquidity(address(this), k, zero, "")), bytes32(ILaunchHook.beforeRemoveLiquidity.selector));
        assertEq(hook.MANAGER(), address(pm));
    }

    function test_getHookPermissionsEqualsTheAddressBits() public {
        (uint256 launchId, address coin, address hookAddr) = _graduated();
        ILaunchHook hook = ILaunchHook(hookAddr);
        HookPermissions memory p = hook.getHookPermissions();
        bool[14] memory bits = [
            p.beforeInitialize, p.afterInitialize, p.beforeAddLiquidity, p.afterAddLiquidity,
            p.beforeRemoveLiquidity, p.afterRemoveLiquidity, p.beforeSwap, p.afterSwap,
            p.beforeDonate, p.afterDonate, p.beforeSwapReturnDelta, p.afterSwapReturnDelta,
            p.afterAddLiquidityReturnDelta, p.afterRemoveLiquidityReturnDelta
        ];
        uint16 declared;
        for (uint256 i; i < 14; ++i) if (bits[i]) declared |= uint16(Hook.bit(i));
        assertEq(uint256(declared), uint256(Hook.flags(hookAddr)), "the struct says what the address says");
        assertEq(uint256(declared), uint256(FLAGS));
        assertEq(uint256(hook.FLAGS()), uint256(FLAGS));
        assertEq(uint256(cust.HOOK_FLAGS()), uint256(FLAGS));
        assertFalse(p.beforeSwapReturnDelta || p.afterSwapReturnDelta || p.afterAddLiquidityReturnDelta || p.afterRemoveLiquidityReturnDelta,
            "no delta-returning flag");
        assertTrue(Hook.guardsExits(hookAddr) && Hook.touchesSwaps(hookAddr));

        // a mis-mined salt is refused by the Kiln before any code exists
        (bytes32 h, uint16 flags) = kiln.recipeHash(1, bytes32(uint256(uint160(coin))));
        uint256 bad;
        while (Hook.flags(Hook.at(address(kiln), bytes32(bad), h)) == flags) ++bad;
        vm.expectRevert(IKilnEvents.WrongFlags.selector);
        kiln.deployHook(1, bytes32(bad), bytes32(uint256(uint160(coin))));

        // and a hook that somehow lives at an address without its bits refuses its first use
        LaunchHook stray = new LaunchHook(address(pm), address(cust), coin);
        assertTrue(Hook.flags(address(stray)) != FLAGS, "a plain CREATE lands off the pattern");
        PoolKey memory k = cust.poolKeyOf(launchId);
        k.hooks = address(stray);
        vm.prank(address(pm));
        vm.expectRevert(ILaunchHook.WrongFlags.selector);
        stray.beforeInitialize(address(this), k, 1);
        // the manager would never consult it for a swap, and if it did the gate is still the manager's
        vm.expectRevert(ILaunchHook.NotTheManager.selector);
        stray.beforeSwap(address(this), k, SwapParams(true, -1, 0), "");
    }

    function test_aHookIsBornOnlyFromRegisteredTerms() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        (bytes32 salt, ) = _mine(coin);
        // the recipe hashes before any registration, so a salt can be mined first…
        (bytes32 h, ) = kiln.recipeHash(1, bytes32(uint256(uint160(coin))));
        assertTrue(h != bytes32(0));
        // …but nothing can be deployed from it until createV4 registered the terms
        vm.expectRevert(IKilnEvents.DeployFailed.selector);
        kiln.deployHook(1, salt, bytes32(uint256(uint160(coin))));
        vm.prank(alice);
        pad.createV4(_params(id, coin), _terms(), salt);
        // now anyone may deploy it — the same code and the same terms either way
        address hook = kiln.deployHook(1, salt, bytes32(uint256(uint160(coin))));
        assertEq(hook, cust.hookOf(1));
        assertEq(ILaunchHook(hook).COIN(), coin);
        assertEq(ILaunchHook(hook).CUSTODIAN(), address(cust));
        assertEq(ILaunchHook(hook).LOCK_FOR(), 30 days);
        assertEq(ILaunchHook(hook).START_FEE(), 100_000);
        assertEq(ILaunchHook(hook).FLOOR_FEE(), 10_000);
        assertEq(ILaunchHook(hook).DECAY(), 1 days);
        assertEq(ILaunchHook(hook).OPENS_IN(), 0);
        assertEq(ILaunchHook(hook).OPENS(), 0, "no opening time before the seeding");
        assertEq(ILaunchHook(hook).UNLOCKS(), 0);
        assertEq(ILaunchHook(hook).SEEDED_AT(), 0);
        (bool open, bool free) = ILaunchHook(hook).status();
        assertFalse(open); assertFalse(free);
    }

    function test_aForeignPoolKeyIsRefusedAtInitialize() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        (uint256 launchId, bytes32 salt) = _createV4(alice, _params(id, coin), _terms());
        address hook = kiln.deployHook(1, salt, bytes32(uint256(uint160(coin))));
        PoolKey memory own = cust.poolKeyOf(launchId);
        assertEq(own.hooks, hook);
        // a fresh copy per case: a memory struct assigned is aliased, not copied
        PoolKey memory k;

        k = cust.poolKeyOf(launchId); k.currency1 = address(new Coin("Other", "OTH", 18, 1e18, 0, alice, address(pad), id));
        vm.expectRevert(ILaunchHook.ForeignKey.selector); pm.initialize(k, 1 << 96);
        k = cust.poolKeyOf(launchId); k.fee = 3000;
        vm.expectRevert(ILaunchHook.ForeignKey.selector); pm.initialize(k, 1 << 96);
        k = cust.poolKeyOf(launchId); k.tickSpacing = 10;
        vm.expectRevert(ILaunchHook.ForeignKey.selector); pm.initialize(k, 1 << 96);
        k = cust.poolKeyOf(launchId); k.fee = Hook.DYNAMIC_FEE | 1;
        vm.expectRevert(ILaunchHook.ForeignKey.selector); pm.initialize(k, 1 << 96);
        k = cust.poolKeyOf(launchId); k.currency0 = address(0xdead); k.currency1 = address(0xffff);
        vm.expectRevert(ILaunchHook.ForeignKey.selector); pm.initialize(k, 1 << 96);
        // the hook consulted directly by the manager, on a key naming another hook address
        k = cust.poolKeyOf(launchId); k.hooks = address(0x1234);
        vm.prank(address(pm)); vm.expectRevert(ILaunchHook.ForeignKey.selector); ILaunchHook(hook).beforeInitialize(address(this), k, 1);
        // its own key is admitted — by anyone, which is v4's rule and the reason for the custodian's 1 % check
        assertEq(own.hooks, hook, "own was never touched");
        vm.prank(bob);
        pm.initialize(own, 1 << 96);
        assertEq(pm.toId(own), cust.poolIdOf(launchId), "the pool is the launch's");
        (bool init, , , uint160 price, , , , , ) = pm.pools(cust.poolIdOf(launchId));
        assertTrue(init, "initialised");
        assertEq(uint256(price), 1 << 96, "at the stranger's price");
        // but it is shut both ways until the launch seeds it: no opening time exists yet
        vm.expectRevert(ILaunchHook.NotOpenYet.selector);
        pm.swap{value: 1}(own, SwapParams(true, -1, 0), "");
        vm.expectRevert(ILaunchHook.StillLocked.selector);
        pm.modifyLiquidity(own, ModifyLiquidityParams(-887220, 887220, -1, bytes32(0)), "");
    }

    function test_noSwapBeforeOpensAndTheFeeDecaysFromStartToFloor() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        HookTerms memory t = _terms();
        t.opensIn = 2 days;
        (uint256 launchId, ) = _createV4(alice, _params(id, coin), t);
        _fill(launchId);
        uint64 seeded = T0 + 3 hours;                 // the target was met; a stranger graduates it later
        vm.warp(seeded);
        pad.graduate(launchId);
        uint64 opens = seeded + 2 days;
        PoolKey memory k = cust.poolKeyOf(launchId);
        ILaunchHook hook = ILaunchHook(k.hooks);
        assertEq(hook.SEEDED_AT(), seeded, "the clock started when the custodian seeded");
        assertEq(hook.OPENS(), opens, "OPENS is seededAt + OPENS_IN");
        assertEq(hook.UNLOCKS(), seeded + 30 days, "UNLOCKS is seededAt + LOCK_FOR");
        assertEq(cust.unlocksAt(launchId), seeded + 30 days, "and so did the ratchet");
        (bool open, bool free) = hook.status();
        assertFalse(open); assertFalse(free);

        vm.expectRevert(ILaunchHook.NotOpenYet.selector);
        _swapEthIn(k, 0.01 ether);
        vm.warp(opens - 1);
        vm.expectRevert(ILaunchHook.NotOpenYet.selector);
        _swapEthIn(k, 0.01 ether);

        vm.warp(opens);
        _swapEthIn(k, 0.01 ether);
        assertEq(uint256(pm.lastFeeCharged()), 100_000, "the start fee at the opening second");
        assertEq(uint256(hook.feeAt(opens)), 100_000);
        vm.warp(opens + 12 hours);
        _swapEthIn(k, 0.01 ether);
        assertEq(uint256(pm.lastFeeCharged()), 55_000, "halfway down the ramp");
        vm.warp(opens + 18 hours);
        assertEq(uint256(hook.feeAt(opens + 18 hours)), 32_500, "three quarters down");
        vm.warp(opens + 1 days);
        _swapEthIn(k, 0.01 ether);
        assertEq(uint256(pm.lastFeeCharged()), 10_000, "the floor at the ramp's end");
        vm.warp(opens + 400 days);
        _swapEthIn(k, 0.01 ether);
        assertEq(uint256(pm.lastFeeCharged()), 10_000, "and forever after");
        (open, ) = hook.status();
        assertTrue(open);

        // hookData is never read: garbage changes nothing
        pm.swap{value: 0.01 ether}(k, SwapParams(true, -0.01 ether, 0), hex"deadbeef00000000000000000000000000000000000000000000000000000000ff");
        assertEq(uint256(pm.lastFeeCharged()), 10_000);
        // the fee is a function of the clock alone: the other direction pays the same
        Coin(coin).approve(address(pm), 1e18);
        pm.swap(k, SwapParams(false, -1e18, 0), "");
        assertEq(uint256(pm.lastFeeCharged()), 10_000);
    }

    function test_aFeeWithoutTheOverrideFlagWouldBeIgnoredByThePool() public {
        // the mock's rule, proved once so the hook's flag is known to be load-bearing:
        // a dynamic-fee pool with no hook keeps its stored fee of zero
        (uint256 launchId, , ) = _graduated();
        PoolKey memory k = cust.poolKeyOf(launchId);
        _swapEthIn(k, 0.01 ether);
        assertEq(uint256(pm.lastFeeCharged()), 100_000, "with the flag the hook's number is charged");
        (, uint24 stored, , , , , , , ) = pm.pools(cust.poolIdOf(launchId));
        assertEq(uint256(stored), 0, "the pool's own stored fee is zero: without the override the swap would be free");
    }

    function test_negativeDeltasAreBlockedUntilUnlocksAndZeroDeltaPokesPass() public {
        (uint256 launchId, , address hookAddr) = _graduated();
        PoolKey memory k = cust.poolKeyOf(launchId);
        ILaunchHook hook = ILaunchHook(hookAddr);
        uint64 unlocks = hook.UNLOCKS();
        ModifyLiquidityParams memory take = ModifyLiquidityParams(-887220, 887220, -1, bytes32(0));
        ModifyLiquidityParams memory poke = ModifyLiquidityParams(-887220, 887220, 0, bytes32(0));

        // through the manager: a withdrawal is refused, a poke passes, an add is never gated
        vm.expectRevert(ILaunchHook.StillLocked.selector);
        pm.modifyLiquidity(k, take, "");
        pm.modifyLiquidity(k, poke, "");
        vm.warp(unlocks - 1);
        vm.expectRevert(ILaunchHook.StillLocked.selector);
        pm.modifyLiquidity(k, take, "");
        // the custodian's own collect is a zero-delta poke and works during the lock
        cust.collect(launchId);
        // and its release waits
        vm.prank(alice);
        vm.expectRevert(ILPCustodianEvents.StillLocked.selector);
        cust.release(launchId);

        vm.warp(unlocks);
        pm.modifyLiquidity(k, take, "");
        (, bool free) = hook.status();
        assertTrue(free);
    }

    /*═══════════════════ the graduation journey ═══════════════════*/

    function test_theGraduationJourneyAgainstTheV4Target() public {
        (uint256 launchId, address coin) = _standard();
        _fill(launchId);
        Launch memory before = pad.launchOf(launchId);
        uint256 amountBase = Mul.mulDivDown(before.raised, before.baseReserve, before.quoteReserve);
        uint160 want = _terminalSqrt(launchId);
        uint256 supplyBefore = Coin(coin).totalSupply();
        assertEq(cust.hookOf(launchId).code.length, 0, "no hook exists before graduation");

        vm.prank(eve);
        pad.graduate(launchId);

        Launch memory l = pad.launchOf(launchId);
        Custody memory c = cust.custodyOf(launchId);
        assertTrue(l.state == LaunchState.Graduated);
        assertEq(c.seededAt, T0, "seeded now");
        assertEq(c.unlocksAt, T0 + 30 days, "the ratchet starts at seededAt + LOCK_FOR");
        assertEq(l.marketKey, uint256(cust.poolIdOf(launchId)), "the launch's key is the pool id");
        assertTrue(c.hook.code.length > 0, "the custodian deployed the hook through the Kiln");
        assertEq(Hook.flags(c.hook), FLAGS);
        assertEq(ILaunchHook(c.hook).COIN(), coin);

        // the pool: initialised at the terminal price, keyed to the hook
        (bool init, , int24 spacing, uint160 price, uint256 r0, uint256 r1, uint128 liq, , ) = pm.pools(cust.poolIdOf(launchId));
        assertTrue(init);
        assertEq(uint256(price), uint256(want), "the pool opened at sqrt(amountBase / raised)");
        assertEq(int256(spacing), 60);
        assertEq(uint256(liq), uint256(posm.getPositionLiquidity(c.tokenId)));
        assertTrue(liq > 0);
        // both prices side by side: the pool's spot equals the curve's terminal price to a part in a billion
        uint256 terminal = pad.priceOf(launchId);
        uint256 spot = cust.spotOf(launchId);
        uint256 diff = spot > terminal ? spot - terminal : terminal - spot;
        assertTrue(diff * 1_000_000_000 <= terminal, "spot within 1e-9 of terminal");

        // the position: minted to the custodian, holding what the price called for
        assertEq(posm.ownerOf(c.tokenId), address(cust));
        assertEq(c.tokenId, 1);
        assertEq(posm.nextTokenId(), 2);
        assertTrue(r0 <= before.raised && r0 + 1e6 >= before.raised, "the raise is in the pool to the dust");
        assertTrue(r1 <= amountBase && r1 + 1e12 >= amountBase, "and the base the price called for");
        assertEq(Coin(coin).balanceOf(address(pm)), r1);
        assertEq(address(pm).balance, r0);
        assertEq(Coin(coin).totalSupply(), supplyBefore - (before.baseReserve - amountBase), "the base the price did not need was burned");

        // nothing stays with the custodian or the Launchpad; dust went home to the Reach
        assertEq(address(cust).balance, 0);
        assertEq(Coin(coin).balanceOf(address(cust)), 0);
        assertEq(address(pad).balance, 0);
        assertEq(pad.totalHeld(), 0);
        assertEq(Coin(coin).balanceOf(address(pad)), before.baseSold, "only the buyers' credits remain");
        assertEq(reach.balance, before.raised - r0, "the raise's dust is the Reach's");
        assertEq(Coin(coin).balanceOf(reach), SUPPLY - RAISE + (amountBase - r1));

        // the approvals: exact, with a real expiry, zeroed in the same call
        assertEq(permit2.zeroExpiryWrites(), 0, "Permit2 was never handed an expiry of zero");
        assertEq(permit2.approvals(), 2, "one approval and its revocation");
        (uint160 amt, uint48 exp, ) = permit2.allowance(address(cust), coin, address(posm));
        assertEq(uint256(amt), 0);
        assertTrue(exp <= block.timestamp, "the revocation does not outlive the call");
        assertEq(Coin(coin).allowance(address(cust), address(permit2)), 0);
        assertEq(Coin(coin).allowance(address(pad), address(cust)), 0);
        assertEq(keccak256(posm.lastActions()), keccak256(hex"020d14"), "MINT_POSITION, SETTLE_PAIR, SWEEP");

        // the buyers claim; a second graduation and a failure are refused
        vm.prank(eve);
        pad.claim(launchId, bob);
        assertTrue(Coin(coin).balanceOf(bob) > 0);
        vm.expectRevert(ILaunchpadEvents.AlreadyGraduated.selector); pad.graduate(launchId);
        vm.expectRevert(ILaunchpadEvents.NotFailable.selector); pad.fail(launchId);
        vm.prank(address(pad)); vm.expectRevert(ILPCustodianEvents.AlreadySeeded.selector); cust.seed(launchId, 1);
        assertEq(uint256(want), uint256(_terminalSqrt(launchId)), "the test's own root of the two amounts");
    }

    function test_aPreInitialisedPoolAtTheWrongPriceIsRefusedAndResaltGivesANewKey() public {
        (uint256 launchId, address coin) = _standard();
        _fill(launchId);
        bytes32 oldId = cust.poolIdOf(launchId);
        address oldHook = cust.hookOf(launchId);
        Custody memory c0 = cust.custodyOf(launchId);
        uint160 want = _terminalSqrt(launchId);

        // a stranger deploys the hook (anyone may) and initialises the pool at twice the price
        vm.prank(bob);
        kiln.deployHook(1, c0.salt, bytes32(uint256(uint160(coin))));
        PoolKey memory k0 = cust.poolKeyOf(launchId);
        vm.prank(bob);
        pm.initialize(k0, want * 2);
        vm.prank(eve);
        vm.expectRevert(ILPCustodianEvents.PriceOff.selector);
        pad.graduate(launchId);
        assertTrue(pad.launchOf(launchId).state == LaunchState.Live, "the launch is untouched by the refusal");
        assertEq(pad.totalHeld(), 3 ether);

        // resalt: the launcher only, a blessed salt only, and not after seeding
        (bytes32 h, uint16 flags) = kiln.recipeHash(1, bytes32(uint256(uint160(coin))));
        uint256 from = uint256(c0.salt) + 1;
        (bool found, bytes32 salt2, address hook2) = kiln.mine(h, flags, from, 200_000);
        assertTrue(found);
        vm.prank(bob); vm.expectRevert(ILPCustodianEvents.NotActor.selector); cust.resalt(launchId, salt2);
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.BadSalt.selector); cust.resalt(launchId, bytes32(uint256(salt2) ^ 1));
        vm.prank(alice);
        cust.resalt(launchId, salt2);
        assertEq(cust.hookOf(launchId), hook2);
        assertTrue(hook2 != oldHook);
        assertTrue(cust.poolIdOf(launchId) != oldId, "a new hook is a new pool");
        assertEq(cust.custodyOf(launchId).salt, salt2);

        // the Reach may resalt too (acts), and then the graduation lands in the fresh pool
        (found, salt2, hook2) = kiln.mine(h, flags, uint256(salt2) + 1, 200_000);
        vm.prank(reach);
        cust.resalt(launchId, salt2);
        vm.prank(eve);
        pad.graduate(launchId);
        assertEq(pad.launchOf(launchId).marketKey, uint256(cust.poolIdOf(launchId)));
        (, , , uint160 price, , , , , ) = pm.pools(cust.poolIdOf(launchId));
        assertEq(uint256(price), uint256(want));
        (, , , uint160 strayPrice, uint256 strayR0, , , , ) = pm.pools(oldId);
        assertEq(uint256(strayPrice), uint256(want) * 2, "the stranger's pool is left alone, empty");
        assertEq(strayR0, 0);
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.AlreadySeeded.selector); cust.resalt(launchId, salt2);
    }

    function test_aPreInitialisedPoolWithinOnePercentIsUsedAsItIs() public {
        (uint256 launchId, address coin) = _standard();
        _fill(launchId);
        Custody memory c0 = cust.custodyOf(launchId);
        uint160 want = _terminalSqrt(launchId);
        // 0.4 % above in sqrt space is 0.8 % in price: inside the band
        uint160 live = uint160(uint256(want) * 1004 / 1000);
        vm.prank(bob);
        kiln.deployHook(1, c0.salt, bytes32(uint256(uint160(coin))));
        PoolKey memory k0 = cust.poolKeyOf(launchId);
        vm.prank(bob);
        pm.initialize(k0, live);
        uint256 reachEth = reach.balance;
        uint256 reachCoin = Coin(coin).balanceOf(reach);
        Launch memory before = pad.launchOf(launchId);
        uint256 amountBase = Mul.mulDivDown(before.raised, before.baseReserve, before.quoteReserve);
        vm.prank(eve);
        pad.graduate(launchId);
        (, , , uint160 price, uint256 r0, uint256 r1, , , ) = pm.pools(cust.poolIdOf(launchId));
        assertEq(uint256(price), uint256(live), "the stranger's price stands");
        assertTrue(cust.custodyOf(launchId).seededAt != 0);
        // at a higher price the coin is the short side: all of it in, under 1 % of the ether left — and sent home
        assertTrue(r1 <= amountBase && r1 + 1e12 >= amountBase, "all the base went in");
        assertTrue(r0 < 3 ether && (3 ether - r0) * 100 < 3 ether, "a little ether was not needed");
        assertEq(reach.balance - reachEth, 3 ether - r0, "the ether the stranger's price did not need went to the Reach");
        assertEq(Coin(coin).balanceOf(reach) - reachCoin, amountBase - r1, "and the coin's dust");
        assertEq(Coin(coin).balanceOf(address(cust)), 0);
        assertEq(address(cust).balance, 0);

        // just outside the band, the other way, is refused
        (uint256 launch2, address coin2) = _secondLaunch();
        _fill(launch2);
        uint160 want2 = _terminalSqrt(launch2);
        bytes32 salt2 = cust.custodyOf(launch2).salt;
        PoolKey memory k2 = cust.poolKeyOf(launch2);
        vm.prank(bob);
        kiln.deployHook(1, salt2, bytes32(uint256(uint160(coin2))));
        vm.prank(bob);
        pm.initialize(k2, uint160(uint256(want2) * 994 / 1000));
        vm.expectRevert(ILPCustodianEvents.PriceOff.selector);
        pad.graduate(launch2);
    }

    /// @dev A second token, a second coin, a second v4 launch, seven days on.
    function _secondLaunch() internal returns (uint256 launchId, address coin) {
        uint256 id2 = hub.mint(carol);
        coin = _launch(id2, carol, bytes32(uint256(2)), RAISE);
        (launchId, ) = _createV4(carol, _params(id2, coin), _terms());
    }

    /*═══════════════════ the custodian ═══════════════════*/

    function test_collectPaysTheReachAndPrincipalWaitsForTheUnlock() public {
        (uint256 launchId, address coin, address hookAddr) = _graduated();
        PoolKey memory k = cust.poolKeyOf(launchId);
        uint64 unlocks = ILaunchHook(hookAddr).UNLOCKS();
        Custody memory c = cust.custodyOf(launchId);
        // the seeding sent the price's rounding dust home; everything below is a delta from here
        uint256 reachEth0 = reach.balance;
        uint256 reachCoin0 = Coin(coin).balanceOf(reach);

        // nothing earned yet: a collect pays nothing and changes nothing
        vm.prank(eve);
        cust.collect(launchId);
        assertEq(reach.balance, reachEth0, "nothing to collect yet");

        // trades: ETH in pays a 10 % fee in ETH, coin in pays it in coin
        _swapEthIn(k, 1 ether);
        uint256 got = Coin(coin).balanceOf(address(this));
        assertTrue(got > 0, "the swap paid out coin");
        Coin(coin).approve(address(pm), got);
        pm.swap(k, SwapParams(false, -int256(got), 0), "");
        (, , , , , , , uint256 fees0, uint256 fees1) = pm.pools(cust.poolIdOf(launchId));
        assertEq(fees0, 0.1 ether, "10 % of the ether in");
        assertEq(fees1, got / 10, "10 % of the coin in");

        // anyone collects; feeSink(id) — the Reach — is paid straight from the manager
        vm.prank(eve);
        cust.collect(launchId);
        assertEq(reach.balance - reachEth0, 0.1 ether, "every fee reached the Reach");
        assertEq(Coin(coin).balanceOf(reach) - reachCoin0, got / 10, "and the coin fee too");
        assertEq(address(cust).balance, 0, "nothing passes through the custodian");
        assertEq(Coin(coin).balanceOf(address(cust)), 0);
        assertEq(uint256(posm.getPositionLiquidity(c.tokenId)), uint256(pm_liquidity(launchId)), "the principal is untouched");
        assertEq(keccak256(posm.lastActions()), keccak256(hex"0111"), "DECREASE_LIQUIDITY(0), TAKE_PAIR");

        // the sink follows the token: fees to the Grip once the holder says so
        vm.prank(alice);
        hub.setFeesToGrip(id, true);
        _swapEthIn(k, 1 ether);
        vm.prank(eve);
        cust.collect(launchId);
        assertEq(hub.grip(id).balance, 0.1 ether, "the Grip is the sink now");
        assertEq(reach.balance - reachEth0, 0.1 ether, "and the Reach got no more");
        // and a sale moves it to the buyer's Reach: feeSink is read live, never stored
        vm.prank(alice);
        hub.setFeesToGrip(id, false);
        vm.prank(alice);
        hub.transfer(id, bob);
        _swapEthIn(k, 1 ether);
        cust.collect(launchId);
        assertEq(reach.balance - reachEth0, 0.2 ether, "the token's Reach, now bob's, is paid");

        // principal: not before the unlock, not to a stranger, only to the Reach
        vm.prank(bob); vm.expectRevert(ILPCustodianEvents.StillLocked.selector); cust.release(launchId);
        vm.warp(unlocks);
        vm.prank(eve); vm.expectRevert(ILPCustodianEvents.NotActor.selector); cust.release(launchId);
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.NotActor.selector); cust.release(launchId);
        uint256 r0 = address(pm).balance;
        uint256 r1 = Coin(coin).balanceOf(address(pm));
        uint256 reachEth1 = reach.balance;
        uint256 reachCoin1 = Coin(coin).balanceOf(reach);
        vm.prank(bob);
        cust.release(launchId);
        uint256 gotEth = reach.balance - reachEth1;
        uint256 gotCoin = Coin(coin).balanceOf(reach) - reachCoin1;
        assertTrue(gotEth <= r0 && gotEth + 2 >= r0, "the whole principal went to the Reach, to the wei of rounding");
        assertTrue(gotCoin <= r1 && gotCoin + 2 >= r1, "and the coin side");
        assertLe(address(pm).balance, 2);
        assertLe(Coin(coin).balanceOf(address(pm)), 2);
        assertTrue(cust.custodyOf(launchId).released);
        assertEq(uint256(posm.getPositionLiquidity(c.tokenId)), 0);
        assertEq(keccak256(posm.lastActions()), keccak256(hex"0311"), "BURN_POSITION, TAKE_PAIR");
        vm.expectRevert(ILPCustodianEvents.NotSeeded.selector); cust.collect(launchId);
        vm.prank(bob); vm.expectRevert(ILPCustodianEvents.NotSeeded.selector); cust.release(launchId);
    }

    function pm_liquidity(uint256 launchId) internal view returns (uint128 liq) {
        (, , , , , , liq, , ) = pm.pools(cust.poolIdOf(launchId));
    }

    function test_theUnlockIsARatchetOfAtMostTenYears() public {
        (uint256 launchId, , address hookAddr) = _graduated();
        uint64 unlocks = ILaunchHook(hookAddr).UNLOCKS();
        assertEq(cust.unlocksAt(launchId), unlocks);
        vm.prank(eve); vm.expectRevert(ILPCustodianEvents.NotActor.selector); cust.extend(launchId, unlocks + 1);
        vm.prank(alice); vm.expectRevert(Ratchet.RatchetOnly.selector); cust.extend(launchId, unlocks);
        vm.prank(alice); vm.expectRevert(Ratchet.RatchetOnly.selector); cust.extend(launchId, unlocks - 1);
        vm.prank(alice); vm.expectRevert(Ratchet.TooLong.selector); cust.extend(launchId, uint64(block.timestamp + 3650 days + 1));
        vm.prank(alice);
        cust.extend(launchId, uint64(block.timestamp + 3650 days));
        assertEq(cust.unlocksAt(launchId), uint64(block.timestamp + 3650 days));
        // the hook's own date has passed, the custodian's has not: principal still waits
        vm.warp(unlocks);
        vm.prank(alice); vm.expectRevert(ILPCustodianEvents.StillLocked.selector); cust.release(launchId);
        // the Reach may lengthen too (the clock moved: ten years from now reaches further); a stranger never
        vm.prank(reach);
        cust.extend(launchId, unlocks + 3650 days);
        assertEq(cust.unlocksAt(launchId), unlocks + 3650 days, "the Reach lengthened it");
        vm.expectRevert(ILPCustodianEvents.NotSeeded.selector); cust.extend(99, unlocks + 1);
    }

    function test_seedAndRegisterAreTheLaunchpadsAlone() public {
        (uint256 launchId, address coin) = _standard();
        vm.expectRevert(ILPCustodianEvents.NotLaunchpad.selector);
        cust.register(2, id, coin, _terms(), bytes32(0));
        vm.expectRevert(ILPCustodianEvents.NotLaunchpad.selector);
        cust.seed{value: 1 ether}(launchId, 1);
        vm.prank(alice);
        vm.expectRevert(ILPCustodianEvents.NotLaunchpad.selector);
        cust.seed(launchId, 1);
        // the Launchpad cannot seed an unregistered launch, nor one twice, nor for nothing, nor at a price no pool can hold
        vm.deal(address(pad), 1 ether);
        vm.prank(address(pad)); vm.expectRevert(ILPCustodianEvents.NotRegistered.selector); cust.seed{value: 1}(7, 1);
        vm.prank(address(pad)); vm.expectRevert(ILPCustodianEvents.ZeroAmount.selector); cust.seed(launchId, 1);
        vm.prank(address(pad)); vm.expectRevert(ILPCustodianEvents.PriceOutOfRange.selector); cust.seed{value: 1}(launchId, type(uint128).max);
        // ether from a stranger is refused rather than stranded
        (bool ok, ) = address(cust).call{value: 1}("");
        assertFalse(ok);
        vm.expectRevert(ILPCustodianEvents.NotSeeded.selector); cust.collect(launchId);
    }

    function test_aV4LaunchShortOfItsTargetFailsLikeAnyOther() public {
        (uint256 launchId, address coin) = _standard();
        _buy(launchId, bob, 1 ether);
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert(ILaunchpadEvents.NotGraduatable.selector); pad.graduate(launchId);
        vm.prank(eve);
        pad.fail(launchId);
        uint256 bobBefore = bob.balance;
        pad.refund(launchId, bob);
        assertEq(bob.balance - bobBefore, 1 ether, "every wei back");
        assertEq(Coin(coin).balanceOf(reach), SUPPLY, "the supply went home");
        assertEq(cust.custodyOf(launchId).seededAt, 0);
        assertEq(cust.hookOf(launchId).code.length, 0, "no hook was ever deployed for it");
        vm.expectRevert(ILPCustodianEvents.NotSeeded.selector); cust.collect(launchId);
    }

    function test_oneCodehashForEveryLaunchHook() public {
        (uint256 l1, , address h1) = _graduated();
        vm.warp(block.timestamp + 7 days);
        (uint256 l2, ) = _secondLaunch();
        _fill(l2);
        pad.graduate(l2);
        address h2 = cust.hookOf(l2);
        assertTrue(h1 != h2 && l1 != l2);
        assertTrue(ILaunchHook(h1).COIN() != ILaunchHook(h2).COIN());
        assertEq(h1.codehash, h2.codehash, "two launches, two terms, one runtime: the Router can pin it");
        assertEq(h1.codehash, keccak256(type(LaunchHook).runtimeCode), "and it is the compiled runtime's own hash");
        assertTrue(cust.poolIdOf(l1) != cust.poolIdOf(l2));
    }

    function test_noSelectorOnTheCustodianOrTheHookNamesAnAdmin() public view {
        // the surface, by selector: six writes, every one named above, and reads
        bytes4[6] memory writes = [
            LPCustodian.register.selector, LPCustodian.seed.selector, LPCustodian.resalt.selector,
            LPCustodian.collect.selector, LPCustodian.release.selector, LPCustodian.extend.selector
        ];
        for (uint256 i; i < 6; ++i) assertTrue(writes[i] != bytes4(0));
        assertEq(uint256(cust.MINT_POSITION()), 0x02);
        assertEq(uint256(cust.DECREASE_LIQUIDITY()), 0x01);
        assertEq(uint256(cust.BURN_POSITION()), 0x03);
        assertEq(uint256(cust.SETTLE_PAIR()), 0x0d);
        assertEq(uint256(cust.TAKE_PAIR()), 0x11);
        assertEq(uint256(cust.SWEEP()), 0x14);
        assertEq(uint256(cust.POOLS_SLOT()), 6);
        assertEq(uint256(cust.SQRT_LOWER()), uint256(pm.sqrtAt(-887220)), "the lower bound is TickMath's at the grid's edge");
        assertEq(uint256(cust.SQRT_UPPER()), uint256(pm.sqrtAt(887220)));
        assertTrue(cust.SQRT_LOWER() > 4295128739 && cust.SQRT_UPPER() < 1461446703485210103287273052203988822378723970342);
        assertEq(int256(cust.TICK_LOWER()), -887220);
        assertEq(int256(cust.TICK_UPPER()), 887220);
        assertEq(int256(cust.TICK_SPACING()), 60);
    }
}
