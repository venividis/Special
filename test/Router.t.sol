// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {
    MockReachImpl, MockGripImpl, MockRenderer, MockPool, MockLocks, MockLaunchpad, MockSteward, MockRoles
} from "./helpers/HubMocks.sol";
import {IIntact} from "../src/interfaces/IIntact.sol";
import {IReach, IReachEvents, AssetLimit, AssetCap, TypedCall} from "../src/interfaces/IReach.sol";
import {IRouter, IRouterEvents, Venue, PoolKey, SwapRequest, VenueInfo} from "../src/interfaces/IRouter.sol";
import {IntactConfig} from "../src/hub/IntactBase.sol";
import {AccountBinding} from "../src/lib/AccountBinding.sol";
import {Reach} from "../src/Reach.sol";
import {Grip} from "../src/Grip.sol";
import {Pool} from "../src/Pool.sol";
import {Router} from "../src/Router.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockWETH} from "./mocks/MockWETH.sol";
import {MockSwapRouter02} from "./mocks/MockSwapRouter02.sol";
import {MockPoolManagerV4} from "./mocks/MockPoolManagerV4.sol";
import {UpgradedVenue} from "./mocks/UpgradedVenue.sol";
import {UnderDeliveringVenue} from "./mocks/UnderDeliveringVenue.sol";
import {ReentryRouter} from "./mocks/ReentryRouter.sol";

/*───────────────────────────────────────────────────────────────────────────
  The Router, driven the only way it can be driven: through a real Reach
  of a real hub (INTACT U8; DESIGN.md §6.2, §14 row C4)

  The world is the real `Intact` (either build, by INTACT_IMPL), the real
  `Reach` and `Grip` implementations behind the canonical registry, the
  real `Pool` with an owned gold/ether market, and three venue stand-ins:
  an honest SwapRouter02, a ledger-keeping v4 PoolManager, and WETH. Every
  swap in this file goes `alice → Reach.executeTyped → Router.swap →
  venue`, which is the shape the page builds and the shape an agent's
  session key is allowed.

  Sentences proved: an EOA cannot use the router; a foreign Reach cannot;
  an upgraded venue fails closed; an under-delivering venue is caught; no
  allowance survives a call; a pre-existing router balance is not
  refunded; a quote equals the swap in the same block; a hooked key is
  refused unless it is our hook; a bad v3 path is refused.
───────────────────────────────────────────────────────────────────────────*/

/// @dev Two instances share a codehash; that is all a hook needs to be here.
contract HookStandIn {
    function beforeSwap() external pure returns (bytes4) { return this.beforeSwap.selector; }
}

/// @dev A manager that takes the unlock and never calls back.
contract SilentManager {
    function unlock(bytes calldata) external pure returns (bytes memory) { return ""; }
}

contract RouterTest is IntactFixture {
    uint256 constant WAD = 1e18;
    uint160 constant MIN_SQRT = 4295128739;
    uint160 constant MAX_SQRT = 1461446703485210103287273052203988822378723970342;

    Reach reachI;
    Grip gripI;
    Pool realPool;
    MockERC20 gold;
    MockERC20 silver;
    MockWETH weth;
    MockSwapRouter02 v3;
    MockPoolManagerV4 v4;
    Router router;

    uint256 id;
    address reachAddr;
    IReach reach;
    address bot = address(0xB07);

    receive() external payable {}

    function setUp() public {
        vm.warp(T0);
        vm.etch(REGISTRY, REGISTRY_RUNTIME);
        reachI = new Reach();
        gripI = new Grip();
        renderer = new MockRenderer();
        pool = new MockPool();
        locks = new MockLocks();
        launchpad = new MockLaunchpad();
        steward = new MockSteward();
        roles = new MockRoles();
        diamondBuild = keccak256(bytes(vm.envOr("INTACT_IMPL", "monolith"))) == keccak256("diamond");
        hub = diamondBuild ? deployDiamond(cfg(), PRICE) : deployMonolith(cfg(), PRICE);
        realPool = new Pool(address(hub), address(launchpad));

        gold = new MockERC20("Gold", "GOLD", 18, 0, false);
        silver = new MockERC20("Silver", "SLVR", 18, 0, false);
        weth = new MockWETH();
        v3 = new MockSwapRouter02();
        v4 = new MockPoolManagerV4();
        router = new Router(address(hub), address(realPool), address(v3), address(v4), address(weth), bytes32(0));

        vm.deal(alice, 2000 ether);
        vm.deal(bob, 100 ether);
        vm.deal(address(this), 2000 ether);
        id = mintTo(alice);
        reachAddr = hub.account(id);
        reach = IReach(payable(reachAddr));
        gold.mint(reachAddr, 1000 * WAD);
        silver.mint(reachAddr, 1000 * WAD);
        vm.deal(reachAddr, 100 ether);

        // the owned market: gold against ether, 30 bps, flat curve
        gold.mint(alice, 1000 * WAD);
        vm.startPrank(alice);
        gold.approve(address(realPool), type(uint256).max);
        realPool.openMarket(id, address(gold), address(0), 30, 0, 0, 0);
        realPool.deposit{value: 500 ether}(id, 500 * WAD, 500 ether);
        vm.stopPrank();

        // v3 stock in every token a path can end in
        gold.mint(address(v3), 1000 * WAD);
        silver.mint(address(v3), 1000 * WAD);
        weth.deposit{value: 500 ether}();
        weth.transfer(address(v3), 500 ether);

        // two v4 pools: gold/silver and ether/silver
        gold.mint(address(this), 1000 * WAD);
        silver.mint(address(this), 2000 * WAD);
        gold.approve(address(v4), type(uint256).max);
        silver.approve(address(v4), type(uint256).max);
        v4.seed(mk4(address(gold), address(silver), address(0)), 500 * WAD, 500 * WAD);
        v4.seed{value: 500 ether}(mk4(address(0), address(silver), address(0)), 500 ether, 500 * WAD);
    }

    /*═══════════════════ helpers ═══════════════════*/

    function cfg() internal view returns (IntactConfig memory c) {
        c = IntactConfig({
            reachImpl: address(reachI), gripImpl: address(gripI),
            band: BAND, bandLo: LO, bandHi: HI,
            steward: address(steward), market: market, roles: address(roles), pool: address(pool),
            parley: parley, launchpad: address(launchpad), locks: address(locks),
            renderer: address(renderer), catalog: catalog, premises: premises, timelock: timelock
        });
    }

    function sorted(address a, address b) internal pure returns (address, address) {
        return a < b ? (a, b) : (b, a);
    }

    function mk4(address a, address b, address hooks) internal pure returns (MockPoolManagerV4.PoolKey memory k) {
        (k.currency0, k.currency1) = sorted(a, b);
        k.fee = 3000;
        k.tickSpacing = 60;
        k.hooks = hooks;
    }

    function key4(address tin, address tout, address hooks) internal pure returns (PoolKey memory k) {
        (k.currency0, k.currency1) = sorted(tin, tout);
        k.fee = 3000;
        k.tickSpacing = 60;
        k.hooks = hooks;
    }

    /// @dev One request shape for every venue: the owned market keyed by
    ///      the token id, a one-hop v3 path with WETH at a native end, a
    ///      hookless sorted v4 key with a real limit in the trade's direction.
    function req(Venue v, address tin, address tout, uint256 amountIn, uint256 minOut)
        internal view returns (SwapRequest memory r)
    {
        r.venue = v;
        r.tokenIn = tin;
        r.tokenOut = tout;
        r.amountIn = amountIn;
        r.minOut = minOut;
        r.deadline = uint64(block.timestamp + 60);
        r.poolKey = id;
        r.path = abi.encodePacked(
            tin == address(0) ? address(weth) : tin, uint24(3000), tout == address(0) ? address(weth) : tout
        );
        r.v4Key = key4(tin, tout, address(0));
        r.sqrtPriceLimitX96 = r.v4Key.currency0 == tin ? MIN_SQRT + 1 : MAX_SQRT - 1;
    }

    function typed(Router rt, SwapRequest memory r, uint256 floor) internal view returns (TypedCall memory c) {
        AssetLimit[] memory s = new AssetLimit[](1);
        s[0] = AssetLimit(r.tokenIn, r.amountIn);
        AssetLimit[] memory m = new AssetLimit[](1);
        m[0] = AssetLimit(r.tokenOut, floor);
        c = TypedCall(
            address(rt), r.tokenIn == address(0) ? r.amountIn : 0,
            abi.encodeCall(IRouter.swap, (r)), s, m, uint64(block.timestamp + 60)
        );
    }

    /// @dev alice → Reach.executeTyped → rt.swap, with the Reach's own receive floor.
    ///      A swap returns one word. The one call that returns none is a revert the
    ///      test armed `expectRevert` for: forge, and tools/forge.mjs after it, hand
    ///      the caller a block of zeroes in place of the revert, which decodes as an
    ///      empty `bytes` — and a word read out of nothing is a second revert, from
    ///      THIS frame, with no data, that the runner reported as the test failing.
    ///      Ten sentences in this file read red under a correct Router that way, in
    ///      the wave-1 integration. The expectation itself is the harness's to
    ///      enforce (a call that returns instead fails the test); every consumer of
    ///      `out` asserts on it, and a zero satisfies none of them.
    function viaReachOn(Router rt, SwapRequest memory r, uint256 floor) internal returns (uint256 out) {
        TypedCall memory c = typed(rt, r, floor);
        vm.prank(alice);
        bytes memory ret = reach.executeTyped(c);
        if (ret.length == 0) return 0;
        out = abi.decode(ret, (uint256));
    }

    function viaReach(SwapRequest memory r, uint256 floor) internal returns (uint256) {
        return viaReachOn(router, r, floor);
    }

    /// @dev `quoteExactIn` always reverts; read the three words out of `QuoteResult`.
    function quoteOf(Router rt, SwapRequest memory r) internal returns (uint256 spent, uint256 received, uint160 price) {
        (bool ok, bytes memory ret) = address(rt).call(abi.encodeCall(IRouter.quoteExactIn, (r)));
        assertFalse(ok, "a quote returned instead of reverting");
        assertEq(bytes32(bytes4(ret)), bytes32(IRouterEvents.QuoteResult.selector), "not a QuoteResult");
        assembly ("memory-safe") {
            spent := mload(add(ret, 36))
            received := mload(add(ret, 68))
            price := mload(add(ret, 100))
        }
    }

    function bal(address token, address who) internal view returns (uint256) {
        return token == address(0) ? who.balance : MockERC20(token).balanceOf(who);
    }

    /*═══════════════════ who may call ═══════════════════*/

    function test_anEoaCannotUseTheRouter() public {
        SwapRequest memory r = req(Venue.OwnPool, address(gold), address(0), WAD, 0);
        vm.prank(alice);
        vm.expectRevert(IRouterEvents.NotReach.selector);
        router.swap(r);
        // nor a contract that is not a forwarder
        vm.expectRevert(IRouterEvents.NotReach.selector);
        router.swap(r);
        // and the holder's Reach is the door
        assertGt(viaReach(r, 0), 0);
    }

    function test_aForeignReachCannotUseTheRouter() public {
        // a canonical Reach of ANOTHER collection: same implementation, same registry, other hub
        IIntact hub2 = deployMonolith(cfg(), PRICE);
        vm.prank(bob);
        uint256 id2 = hub2.mint{value: PRICE}(bob);
        address reach2 = hub2.account(id2);
        assertTrue(hub2.isCanonicalAccount(reach2, id2, false));
        assertFalse(hub.isCanonicalAccount(reach2, id2, false));
        gold.mint(reach2, 10 * WAD);
        SwapRequest memory r = req(Venue.OwnPool, address(gold), address(0), WAD, 0);
        TypedCall memory c = typed(router, r, 0);
        vm.prank(bob);
        vm.expectRevert(IRouterEvents.NotReach.selector);
        IReach(payable(reach2)).executeTyped(c);

        // a forged forwarder: this hub and this id in the footer, the wrong code behind it
        MockReachImpl fakeImpl = new MockReachImpl();
        address fake = address(0xFA4E);
        vm.etch(fake, AccountBinding.runtime(address(fakeImpl), AccountBinding.REACH_SALT, block.chainid, address(hub), id));
        (, address claimed, uint256 claimedId) = AccountBinding.token(fake);
        assertEq(claimed, address(hub));
        assertEq(claimedId, id);
        gold.mint(fake, 10 * WAD);
        vm.expectRevert(IRouterEvents.NotReach.selector);
        MockReachImpl(payable(fake)).act(address(router), abi.encodeCall(IRouter.swap, (r)));
    }

    /*═══════════════════ the venues ═══════════════════*/

    function test_anUpgradedVenueFailsClosed() public {
        SwapRequest memory r = req(Venue.UniswapV3, address(gold), address(silver), 10 * WAD, 10 * WAD);
        assertEq(viaReach(r, 10 * WAD), 10 * WAD);
        uint256 goldBefore = gold.balanceOf(reachAddr);

        // the code behind the pinned address changes; the hash the router pinned does not
        vm.etch(address(v3), type(UpgradedVenue).runtimeCode);
        assertTrue(address(v3).codehash != router.SWAP_ROUTER02_HASH());
        vm.expectRevert(IRouterEvents.VenueDrifted.selector);
        viaReach(r, 10 * WAD);
        assertEq(gold.balanceOf(reachAddr), goldBefore, "the upgraded venue took the input");
        assertEq(gold.allowance(reachAddr, address(router)), 0);
    }

    function test_anUnderDeliveringVenueIsCaught() public {
        UnderDeliveringVenue bad = new UnderDeliveringVenue();
        silver.mint(address(bad), 1000 * WAD);
        Router rt = new Router(address(hub), address(realPool), address(bad), address(0), address(weth), bytes32(0));
        SwapRequest memory r = req(Venue.UniswapV3, address(gold), address(silver), 10 * WAD, 10 * WAD);
        uint256 goldBefore = gold.balanceOf(reachAddr);
        // the venue RETURNS 10 and PAYS 10 - 1 wei; the router believes its own balance
        vm.expectRevert(IRouterEvents.Slippage.selector);
        viaReachOn(rt, r, 0);
        assertEq(gold.balanceOf(reachAddr), goldBefore);
        // with no floor at the router, the Reach's own floor is the last line
        r.minOut = 0;
        vm.expectRevert(IReachEvents.Shortfall.selector);
        viaReachOn(rt, r, 10 * WAD);
        // and what it actually paid is what the Reach receives when neither floor is set
        assertEq(viaReachOn(rt, r, 0), 10 * WAD - 1);
    }

    function test_anAbsentVenueIsRefused() public {
        Router rt = new Router(address(hub), address(realPool), address(0), address(0), address(weth), bytes32(0));
        SwapRequest memory r = req(Venue.UniswapV3, address(gold), address(silver), WAD, 0);
        vm.expectRevert(IRouterEvents.VenueAbsent.selector);
        viaReachOn(rt, r, 0);
        r = req(Venue.UniswapV4, address(gold), address(silver), WAD, 0);
        vm.expectRevert(IRouterEvents.VenueAbsent.selector);
        viaReachOn(rt, r, 0);
        (bool ok, bytes memory ret) = address(rt).call(abi.encodeCall(IRouter.quoteExactIn, (r)));
        assertFalse(ok);
        assertEq(bytes32(bytes4(ret)), bytes32(IRouterEvents.VenueAbsent.selector));
        // a venue address with no code behind it is refused at construction
        vm.expectRevert(IRouterEvents.VenueAbsent.selector);
        new Router(address(hub), address(realPool), address(0xDEAD), address(0), address(weth), bytes32(0));
        vm.expectRevert(IRouterEvents.VenueAbsent.selector);
        new Router(address(hub), address(realPool), address(0), address(0xDEAD), address(weth), bytes32(0));
    }

    function test_venuesPrintsTheTable() public view {
        VenueInfo[] memory t = router.venues();
        assertEq(t.length, 3);
        assertEq(t[0].at, address(realPool));
        assertEq(t[0].codehash, address(realPool).codehash);
        assertEq(t[1].at, address(v3));
        assertEq(t[1].codehash, address(v3).codehash);
        assertEq(t[2].at, address(v4));
        assertEq(t[2].codehash, address(v4).codehash);
        assertFalse(t[0].upgradeable);
        assertEq(router.POOL_HASH(), address(realPool).codehash);
        assertEq(router.HUB(), address(hub));
        assertEq(router.WETH(), address(weth));
    }

    /*═══════════════════ allowances and balances ═══════════════════*/

    function test_noAllowanceSurvivesACall() public {
        viaReach(req(Venue.OwnPool, address(gold), address(0), WAD, 0), 0);
        assertEq(gold.allowance(address(router), address(realPool)), 0);
        viaReach(req(Venue.UniswapV3, address(gold), address(silver), WAD, 0), 0);
        assertEq(gold.allowance(address(router), address(v3)), 0);
        viaReach(req(Venue.UniswapV4, address(gold), address(silver), WAD, 0), 0);
        assertEq(gold.allowance(address(router), address(v4)), 0);
        assertEq(gold.allowance(reachAddr, address(router)), 0, "the Reach left an allowance to the router");

        // a venue that tries, from inside the swap, both the parent's standing approval
        // and one wei over the exact one: neither exists
        ReentryRouter rr = new ReentryRouter(address(gold), reachAddr, bob);
        silver.mint(address(rr), 1000 * WAD);
        Router rt = new Router(address(hub), address(realPool), address(rr), address(0), address(weth), bytes32(0));
        uint256 out = viaReachOn(rt, req(Venue.UniswapV3, address(gold), address(silver), 10 * WAD, 20 * WAD), 20 * WAD);
        assertEq(out, 20 * WAD);
        assertFalse(rr.parentTransferSucceeded(), "the venue moved the Reach's gold on a standing approval");
        assertFalse(rr.overspendSucceeded(), "the venue pulled more than the exact approval");
        assertEq(gold.allowance(address(rt), address(rr)), 0);
        assertEq(gold.allowance(reachAddr, address(rt)), 0);
    }

    function test_aPreExistingRouterBalanceIsNotRefunded() public {
        gold.mint(address(router), 7 * WAD);
        silver.mint(address(router), 5 * WAD);
        vm.deal(address(router), 3 ether);
        uint256 silverBefore = silver.balanceOf(reachAddr);
        uint256 goldBefore = gold.balanceOf(reachAddr);

        assertEq(viaReach(req(Venue.UniswapV3, address(gold), address(silver), 10 * WAD, 10 * WAD), 10 * WAD), 10 * WAD);
        assertEq(silver.balanceOf(reachAddr), silverBefore + 10 * WAD, "the router's own silver was handed out");
        assertEq(gold.balanceOf(reachAddr), goldBefore - 10 * WAD, "the router's own gold was refunded");
        assertEq(gold.balanceOf(address(router)), 7 * WAD);
        assertEq(silver.balanceOf(address(router)), 5 * WAD);

        SwapRequest memory r = req(Venue.OwnPool, address(gold), address(0), WAD, 0);
        (, uint256 quoted, ) = quoteOf(router, r);
        uint256 ethBefore = reachAddr.balance;
        assertEq(viaReach(r, quoted), quoted);
        assertEq(reachAddr.balance, ethBefore + quoted, "the router's own ether was handed out");
        assertEq(address(router).balance, 3 ether);
        // the opposite direction: a native input never refunds the stray ether either
        r = req(Venue.OwnPool, address(0), address(gold), 1 ether, 0);
        ethBefore = reachAddr.balance;
        uint256 got = viaReach(r, 0);
        assertGt(got, 0);
        assertEq(reachAddr.balance, ethBefore - 1 ether);
        assertEq(address(router).balance, 3 ether);
    }

    function test_theRouterKeepsNothingFromANativeLegOnAnyVenue() public {
        uint256 goldStart = gold.balanceOf(reachAddr);
        uint256 silverStart = silver.balanceOf(reachAddr);
        uint256 ethStart = reachAddr.balance;

        // the owned market, both ways
        uint256 a = viaReach(req(Venue.OwnPool, address(0), address(gold), 1 ether, 0), 0);
        uint256 b = viaReach(req(Venue.OwnPool, address(gold), address(0), WAD, 0), 0);
        // v3 through WETH, both ways
        uint256 c = viaReach(req(Venue.UniswapV3, address(0), address(silver), 1 ether, 1 ether), 1 ether);
        uint256 d = viaReach(req(Venue.UniswapV3, address(silver), address(0), WAD, WAD), WAD);
        // v4 native currency0, both ways
        uint256 e = viaReach(req(Venue.UniswapV4, address(0), address(silver), 1 ether, 0), 0);
        uint256 f = viaReach(req(Venue.UniswapV4, address(silver), address(0), WAD, 0), 0);

        assertEq(gold.balanceOf(reachAddr), goldStart + a - WAD);
        assertEq(silver.balanceOf(reachAddr), silverStart + c - WAD + e - WAD);
        assertEq(reachAddr.balance, ethStart - 1 ether + b - 1 ether + d - 1 ether + f);
        assertEq(address(router).balance, 0, "ether stayed in the router");
        assertEq(weth.balanceOf(address(router)), 0, "wrapped ether stayed in the router");
        assertEq(gold.balanceOf(address(router)), 0);
        assertEq(silver.balanceOf(address(router)), 0);
        assertGt(a, 0); assertGt(b, 0); assertGt(e, 0); assertGt(f, 0);
        assertEq(c, 1 ether); assertEq(d, WAD);
    }

    /*═══════════════════ quotes ═══════════════════*/

    function test_quoteEqualsSwapInTheSameBlock() public {
        SwapRequest memory r = req(Venue.OwnPool, address(gold), address(0), 3 * WAD, 0);
        (uint256 spent, uint256 quoted, uint160 price) = quoteOf(router, r);
        assertEq(spent, 3 * WAD);
        assertEq(price, 0, "the owned market has no sqrt price; the page reads Pool.spot");
        assertEq(viaReach(r, quoted), quoted, "the pool paid other than its quote");

        r = req(Venue.UniswapV4, address(gold), address(silver), 3 * WAD, 0);
        uint160 priceBefore;
        (spent, quoted, priceBefore) = quoteOf(router, r);
        assertEq(spent, 3 * WAD);
        assertGt(priceBefore, 0);
        assertEq(viaReach(r, quoted), quoted, "v4 paid other than its quote");
        (, uint256 again, uint160 priceAfter) = quoteOf(router, r);
        assertLt(again, quoted, "the second quote did not move with the pool");
        assertTrue(priceAfter != priceBefore, "the price word did not move");
        // the quote settled nothing: the manager is locked again and owes nobody
        assertFalse(v4.unlocked());

        r = req(Venue.UniswapV3, address(gold), address(silver), WAD, 0);
        (bool ok, bytes memory ret) = address(router).call(abi.encodeCall(IRouter.quoteExactIn, (r)));
        assertFalse(ok);
        assertEq(bytes32(bytes4(ret)), bytes32(Router.NoQuote.selector), "v3 pretended to quote");
    }

    /*═══════════════════ v4 keys and the callback ═══════════════════*/

    function test_aHookedKeyIsRefusedUnlessItIsOurHook() public {
        HookStandIn ours = new HookStandIn();
        HookStandIn twin = new HookStandIn();
        assertEq(address(ours).codehash, address(twin).codehash);

        // this router pins no hook (U14 has not shipped): every hooked key is refused
        SwapRequest memory r = req(Venue.UniswapV4, address(gold), address(silver), WAD, 0);
        r.v4Key.hooks = address(ours);
        vm.expectRevert(IRouterEvents.HookedKey.selector);
        viaReach(r, 0);
        r.v4Key.hooks = address(0xBEEF);          // no code: codehash 0, which must never equal "no hook pinned"
        vm.expectRevert(IRouterEvents.HookedKey.selector);
        viaReach(r, 0);

        // a router that pins the hook's codehash admits any address carrying it, and only those
        Router rt = new Router(address(hub), address(realPool), address(v3), address(v4), address(weth), address(ours).codehash);
        v4.seed(mk4(address(gold), address(silver), address(twin)), 100 * WAD, 100 * WAD);
        r.v4Key.hooks = address(twin);
        assertGt(viaReachOn(rt, r, 0), 0, "our hook's twin was refused");
        r.v4Key.hooks = address(this);
        vm.expectRevert(IRouterEvents.HookedKey.selector);
        viaReachOn(rt, r, 0);
        r.v4Key.hooks = address(0);
        assertGt(viaReachOn(rt, r, 0), 0, "a hookless key was refused");

        // the empty-account codehash can never be "our hook"
        vm.expectRevert(IRouterEvents.HookedKey.selector);
        new Router(address(hub), address(realPool), address(v3), address(v4), address(weth), keccak256(""));
    }

    function test_aV4KeyMustNameThePairWithARealLimit() public {
        SwapRequest memory r = req(Venue.UniswapV4, address(gold), address(silver), WAD, 0);
        r.v4Key.currency1 = address(weth);          // neither end is the pair
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        r = req(Venue.UniswapV4, address(gold), address(silver), WAD, 0);
        (r.v4Key.currency0, r.v4Key.currency1) = (r.v4Key.currency1, r.v4Key.currency0);   // unsorted
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        r = req(Venue.UniswapV4, address(gold), address(silver), WAD, 0);
        r.sqrtPriceLimitX96 = 0;
        vm.expectRevert(IRouterEvents.BadPriceLimit.selector);
        viaReach(r, 0);
        r.sqrtPriceLimitX96 = type(uint160).max;
        vm.expectRevert(IRouterEvents.BadPriceLimit.selector);
        viaReach(r, 0);
        r.sqrtPriceLimitX96 = MIN_SQRT;
        vm.expectRevert(IRouterEvents.BadPriceLimit.selector);
        viaReach(r, 0);
        r.sqrtPriceLimitX96 = MAX_SQRT;
        vm.expectRevert(IRouterEvents.BadPriceLimit.selector);
        viaReach(r, 0);
        r.sqrtPriceLimitX96 = MIN_SQRT + 1;
        assertGt(viaReach(r, 0), 0);
    }

    function test_theV4CommitmentIsSingleUseAndManagerOnly() public {
        vm.expectRevert(IRouterEvents.NotPoolManager.selector);
        router.unlockCallback("");
        // the manager calling back with nothing committed
        vm.expectRevert(IRouterEvents.WrongCommitment.selector);
        v4.poke(address(router), "");
        SwapRequest memory r = req(Venue.UniswapV4, address(gold), address(silver), WAD, 0);
        bytes memory data = abi.encode(uint8(1), r.v4Key, true, r.amountIn, r.sqrtPriceLimitX96, r.minOut);
        vm.expectRevert(IRouterEvents.WrongCommitment.selector);
        v4.poke(address(router), data);
        // a manager that takes the unlock and never calls back leaves the commitment standing
        SilentManager silent = new SilentManager();
        Router rt = new Router(address(hub), address(realPool), address(0), address(silent), address(weth), bytes32(0));
        vm.expectRevert(IRouterEvents.WrongCommitment.selector);
        viaReachOn(rt, r, 0);
        // and after a real swap nothing is left committed: the same bytes are refused again
        viaReach(r, 0);
        vm.expectRevert(IRouterEvents.WrongCommitment.selector);
        v4.poke(address(router), data);
    }

    /*═══════════════════ v3 paths ═══════════════════*/

    function test_aBadV3PathIsRefused() public {
        SwapRequest memory r = req(Venue.UniswapV3, address(gold), address(silver), WAD, 0);
        bytes memory good = r.path;
        assertEq(good.length, 43);

        r.path = abi.encodePacked(address(gold), uint24(3000), address(silver), hex"00");   // 44: bad modulus
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        r.path = abi.encodePacked(address(gold), uint24(3000));                             // 23: too short
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        r.path = abi.encodePacked(good, uint24(500), address(gold), uint24(500), address(silver), uint24(500), address(gold), uint24(500), address(silver));   // 135: too long
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        r.path = abi.encodePacked(address(silver), uint24(3000), address(silver));          // wrong first end
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        r.path = abi.encodePacked(address(gold), uint24(3000), address(gold));              // wrong last end
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        r.path = abi.encodePacked(address(gold), uint24(3000), address(weth), uint24(500), address(silver));   // two hops, well-formed
        assertEq(viaReach(r, WAD), WAD);

        // a native end must be WETH on the path, not address(0) and not the token
        r = req(Venue.UniswapV3, address(0), address(silver), 1 ether, 0);
        r.path = abi.encodePacked(address(0), uint24(3000), address(silver));
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        r.path = abi.encodePacked(address(gold), uint24(3000), address(silver));
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
        // WETH in and ether out is the same token twice
        r = req(Venue.UniswapV3, address(weth), address(0), WAD, 0);
        weth.deposit{value: WAD}();
        weth.transfer(reachAddr, WAD);
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
    }

    /*═══════════════════ the request's own rules ═══════════════════*/

    function test_aStaleDeadlineIsRefused() public {
        SwapRequest memory r = req(Venue.OwnPool, address(gold), address(0), WAD, 0);
        r.deadline = uint64(block.timestamp - 1);
        vm.expectRevert(IRouterEvents.Expired.selector);
        viaReach(r, 0);
        r.deadline = uint64(block.timestamp);
        assertGt(viaReach(r, 0), 0);
    }

    function test_theSameTokenAndZeroInAreRefused() public {
        SwapRequest memory r = req(Venue.OwnPool, address(gold), address(gold), WAD, 0);
        vm.expectRevert(IRouterEvents.SameToken.selector);
        viaReach(r, 0);
        r = req(Venue.OwnPool, address(gold), address(0), 0, 0);
        vm.expectRevert(IRouterEvents.ZeroAmount.selector);
        viaReach(r, 0);
        // the owned market is gold/ether; a silver request names a pair it does not have
        r = req(Venue.OwnPool, address(silver), address(gold), WAD, 0);
        vm.expectRevert(IRouterEvents.BadPath.selector);
        viaReach(r, 0);
    }

    function test_theValueMustMatchTheNativeLeg() public {
        SwapRequest memory r = req(Venue.OwnPool, address(0), address(gold), 1 ether, 0);
        TypedCall memory c = typed(router, r, 0);
        c.value = 0;                                  // a native input sent without the ether
        vm.prank(alice);
        vm.expectRevert(IRouterEvents.WrongValue.selector);
        reach.executeTyped(c);
        r = req(Venue.OwnPool, address(gold), address(0), WAD, 0);
        c = typed(router, r, 0);
        c.value = 1;                                  // ether with a token input
        vm.prank(alice);
        vm.expectRevert(IRouterEvents.WrongValue.selector);
        reach.executeTyped(c);
        // and the router refuses stray ether: only WETH, the Pool and the manager may send it
        (bool ok, ) = address(router).call{value: 1}("");
        assertFalse(ok, "the router accepted ether from a stranger");
    }

    /*═══════════════════ the shape the page and the agent use ═══════════════════*/

    function test_executeTypedDrivesASwapWithAReceiveFloor() public {
        SwapRequest memory r = req(Venue.OwnPool, address(gold), address(0), 5 * WAD, 0);
        (, uint256 quoted, ) = quoteOf(router, r);
        uint256 goldBefore = gold.balanceOf(reachAddr);
        uint256 ethBefore = reachAddr.balance;

        // the Reach's floor above the market: the swap is undone, in one transaction
        vm.expectRevert(IReachEvents.Shortfall.selector);
        viaReach(r, quoted + 1);
        assertEq(gold.balanceOf(reachAddr), goldBefore);
        assertEq(reachAddr.balance, ethBefore);

        // at the floor: exactly this for at least that
        uint256 stateBefore = reach.state();
        assertEq(viaReach(r, quoted), quoted);
        assertEq(gold.balanceOf(reachAddr), goldBefore - 5 * WAD);
        assertEq(reachAddr.balance, ethBefore + quoted);
        assertEq(reach.state(), stateBefore + 1, "the 6551 state counter did not move");
        assertEq(gold.allowance(reachAddr, address(router)), 0);
    }

    function test_aSessionKeyDrivesASwapUnderItsCaps() public {
        AssetCap[] memory caps = new AssetCap[](1);
        caps[0] = AssetCap(address(gold), uint128(10 * WAD));
        address[] memory targets = new address[](1);
        targets[0] = address(router);
        bytes4[] memory sels = new bytes4[](1);
        sels[0] = IRouter.swap.selector;
        vm.prank(alice);
        reach.grantSession(bot, uint64(block.timestamp + 1 days), 0, caps, targets, sels, 0, 0);

        SwapRequest memory r = req(Venue.UniswapV3, address(gold), address(silver), 6 * WAD, 6 * WAD);
        TypedCall memory c = typed(router, r, 6 * WAD);
        vm.prank(bot);
        reach.executeTyped(c);
        assertEq(silver.balanceOf(reachAddr), 1006 * WAD);
        // the cap is charged by what actually left, and the second six is over it
        vm.prank(bot);
        vm.expectRevert(IReachEvents.AssetCapExceeded.selector);
        reach.executeTyped(c);
        // the key cannot reach any other target through the same shape
        c.to = address(v3);
        vm.prank(bot);
        vm.expectRevert(IReachEvents.TargetNotAllowed.selector);
        reach.executeTyped(c);
        // and the key is not a Reach: calling the router directly is NotReach
        vm.prank(bot);
        vm.expectRevert(IRouterEvents.NotReach.selector);
        router.swap(r);
    }

    function test_aSwapThroughTheReachIsBounded() public {
        SwapRequest memory r = req(Venue.OwnPool, address(gold), address(0), WAD, 0);
        TypedCall memory c = typed(router, r, 0);
        vm.prank(alice);
        uint256 g = gasleft();
        reach.executeTyped(c);
        g -= gasleft();
        assertLt(g, 400_000, "a swap through the Reach costs more than 400k");
    }
}
