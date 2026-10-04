// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Kiln, Gate, PoolKey, ModifyLiquidityParams} from "../src/Kiln.sol";
import {Coin} from "../src/Coin.sol";
import {Launchpad} from "../src/Launchpad.sol";
import {IKilnEvents, ICoin} from "../src/interfaces/IKiln.sol";
import {
    ILaunchpadEvents, LaunchParams, Launch, LaunchState, Target
} from "../src/interfaces/ILaunchpad.sol";
import {Market} from "../src/interfaces/IPool.sol";
import {Lock} from "../src/interfaces/ILocks.sol";
import {Hook} from "../src/lib/Hook.sol";
import {LaunchHub, LaunchPool, LaunchLocks, LaunchWiring} from "./mocks/LaunchFixtures.sol";
import {MockPoolManager} from "./mocks/MockPoolManager.sol";

/*  DESIGN.md §8 and §14 D1–D5, plus ANIMA's Launchpad.test.ts (15)
    rewritten as sentences. The hub, Pool and Locks are the fixtures in
    test/mocks/LaunchFixtures.sol: wave-1 units build in parallel, so the
    Launchpad is proved against the frozen interfaces, not the siblings. */
contract LaunchpadTest is Test {
    LaunchHub hub;
    MockPoolManager pm;
    LaunchWiring w;
    Kiln kiln;
    Launchpad pad;
    LaunchPool pool;
    LaunchLocks locks;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA201);
    address dave = address(0xDA7E);
    address guardian = address(0x6A0D);
    uint256 id;
    address reach;

    uint64 constant T0 = 1_733_000_000;
    uint256 constant SUPPLY = 1_000_000_000e18;
    uint256 constant RAISE = 900_000_000e18;
    uint128 constant CURVE = 700_000_000e18;      // liquidity = 200M; max raisable = 1 · 700/200 = 3.5 ETH
    uint128 constant VQ = 1 ether;
    uint128 constant TARGET = 3 ether;

    function setUp() public {
        vm.warp(T0);
        hub = new LaunchHub();
        pm = new MockPoolManager();
        w = new LaunchWiring(address(hub), address(pm), 0);
        kiln = w.kiln();
        pad = w.pad();
        pool = w.pool();
        locks = w.locks();
        id = hub.mint(alice);
        reach = hub.account(id);
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
            creatorBps: 0, creatorVestBps: 0, deadline: uint64(block.timestamp + 7 days), target: Target.OwnedPool
        });
    }

    function _create(address by, LaunchParams memory p) internal returns (uint256) {
        vm.prank(by);
        return pad.create(p);
    }

    /// @dev The standard launch: alice's coin, 900M raised, no fee, no tax.
    function _standard() internal returns (uint256 launchId, address coin) {
        coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        launchId = _create(alice, _params(id, coin));
    }

    function _buy(uint256 launchId, address who, uint256 value) internal returns (uint256 out) {
        vm.deal(who, who.balance + value);
        vm.prank(who);
        out = pad.buy{value: value}(launchId, 0, uint64(block.timestamp), 10_000);
    }

    function _sell(uint256 launchId, address who, uint256 amount) internal returns (uint256 out) {
        vm.prank(who);
        out = pad.sell(launchId, amount, 0, uint64(block.timestamp));
    }

    /// @dev Three one-ether buys reach the 3-ether target exactly (no fee).
    function _fill(uint256 launchId) internal {
        _buy(launchId, bob, 1 ether);
        _buy(launchId, carol, 1 ether);
        _buy(launchId, dave, 1 ether);
    }

    /*═══════════════════ the Kiln ═══════════════════*/

    function test_theKilnRefusesAStranger() public {
        vm.prank(bob);
        vm.expectRevert(IKilnEvents.NotActor.selector);
        kiln.launch(id, "x", "X", 18, SUPPLY, bytes32(0), 0);

        vm.prank(alice);
        vm.expectRevert(IKilnEvents.NothingToLaunch.selector);
        kiln.launch(id, "x", "X", 18, 0, bytes32(0), 0);

        vm.prank(alice);
        vm.expectRevert(IKilnEvents.ShareTooLarge.selector);
        kiln.launch(id, "x", "X", 18, SUPPLY, bytes32(0), SUPPLY + 1);

        vm.prank(alice);
        vm.expectRevert(Kiln.BadDecimals.selector);
        kiln.launch(id, "x", "X", 37, SUPPLY, bytes32(0), 0);

        vm.prank(alice);
        vm.expectRevert(IKilnEvents.BadName.selector);
        kiln.launch(id, "", "X", 18, SUPPLY, bytes32(0), 0);
        vm.prank(alice);
        vm.expectRevert(IKilnEvents.BadName.selector);
        kiln.launch(id, "x", "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456", 18, SUPPLY, bytes32(0), 0);   // 33 bytes
        vm.prank(alice);
        vm.expectRevert(IKilnEvents.BadName.selector);
        kiln.launch(id, unicode"café", "X", 18, SUPPLY, bytes32(0), 0);
        vm.prank(alice);
        vm.expectRevert(IKilnEvents.BadName.selector);
        kiln.launch(id, "line\nbreak", "X", 18, SUPPLY, bytes32(0), 0);

        // the five HTML metacharacters are printable ASCII and allowed —
        // escaping is the page's job, not the Kiln's (U7's test names a
        // coin `</script>`)
        vm.prank(alice);
        address coin = kiln.launch(id, "</script>", "<&>\"'", 18, SUPPLY, bytes32(0), 0);
        assertEq(Coin(coin).balanceOf(reach), SUPPLY, "no raise share: the whole supply is the Reach's");
        assertEq(Coin(coin).totalSupply(), SUPPLY);
        assertEq(Coin(coin).LAUNCHER(), id);
        assertEq(Coin(coin).KILN(), address(kiln));
        assertEq(Coin(coin).decimals(), 18);
    }

    function test_coinAtPredictsTheAddress() public {
        bytes32 salt = keccak256("vanity");
        address predicted = kiln.coinAt(id, alice, "Agent One", "AGENT1", 18, SUPPLY, salt, RAISE);
        address other = kiln.coinAt(id, bob, "Agent One", "AGENT1", 18, SUPPLY, salt, RAISE);
        assertTrue(predicted != other, "the launcher is mixed into the salt: a watcher cannot take the address");
        assertEq(predicted.code.length, 0, "nothing lives there before the launch");

        address coin = _launch(id, alice, salt, RAISE);
        assertEq(coin, predicted, "the kiln built it at exactly the address it named");
        assertGt(coin.code.length, 0);

        assertEq(kiln.launchedBy(coin), id);
        assertEq(kiln.launchCount(id), 1);
        assertEq(kiln.coinCount(), 1);
        assertEq(kiln.recordsOf(id)[0].coin, coin);
        assertEq(kiln.recordsOf(id)[0].supply, SUPPLY);
        assertEq(kiln.recordsOf(id)[0].raiseShare, RAISE);
        assertEq(uint256(kiln.recordsOf(id)[0].launchedAt), uint256(T0));
        assertEq(kiln.recent(0, 10)[0], coin);
        assertEq(kiln.recent(1, 10).length, 0);

        // the same salt again is the same address, which is taken
        vm.warp(T0 + 7 days);
        vm.prank(alice);
        vm.expectRevert(IKilnEvents.DeployFailed.selector);
        kiln.launch(id, "Agent One", "AGENT1", 18, SUPPLY, salt, RAISE);
    }

    function test_theSupplyNeverNeedsAReachApproval() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        assertEq(Coin(coin).balanceOf(reach), SUPPLY - RAISE, "the vault holds its share from block one");
        assertEq(Coin(coin).balanceOf(address(pad)), RAISE, "the raise share lands in the Launchpad directly");
        assertEq(Coin(coin).allowance(reach, address(pad)), 0, "no approval from the Reach exists anywhere");

        LaunchParams memory p = _params(id, coin);
        p.creatorVestBps = 1_000;                       // 10 % of the share → Locks
        uint256 launchId = _create(alice, p);
        uint256 vest = RAISE / 10;

        assertEq(Coin(coin).balanceOf(address(locks)), vest, "the creator vest went to Locks");
        assertEq(Coin(coin).allowance(address(pad), address(locks)), 0, "and the allowance was zeroed in the same call");
        assertEq(Coin(coin).balanceOf(address(pad)), RAISE - vest);
        Lock memory l = locks.lockOf(1);
        assertEq(l.beneficiary, reach, "the vest's beneficiary is the Reach: it travels with the token");
        assertEq(uint256(l.amount), vest);
        assertEq(uint256(l.cliff), uint256(T0 + 30 days));
        assertEq(uint256(l.end), uint256(T0 + 365 days));
        assertTrue(l.linear);
        assertEq(uint256(pad.launchOf(launchId).liquiditySupply), RAISE - CURVE - vest);
    }

    /*═══════════════════ create ═══════════════════*/

    function test_aStrangerCannotCreateAndACoinRaisesOnce() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);

        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.NotActor.selector);
        pad.create(p);

        assertEq(_create(alice, p), 1);
        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.WrongCoin.selector);
        pad.create(p);                                   // the share was spent

        // a coin another token launched, and a coin with no raise share
        uint256 id2 = hub.mint(bob);
        address theirs = _launch(id2, bob, bytes32(uint256(2)), RAISE);
        p.coin = theirs;
        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.WrongCoin.selector);
        pad.create(p);

        vm.warp(T0 + 7 days);
        address instant = _launch(id, alice, bytes32(uint256(3)), 0);
        p.coin = instant;
        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.WrongCoin.selector);
        pad.create(p);
    }

    function test_badCurveParametersAreRefused() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);

        p.curveSupply = uint128(RAISE);                  // selling the entire reserve is a division by zero
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.BadCurveParameters.selector); pad.create(p);
        p.curveSupply = 0;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.BadCurveParameters.selector); pad.create(p);
        p = _params(id, coin); p.virtualQuote = 0;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.BadCurveParameters.selector); pad.create(p);
        p = _params(id, coin); p.graduationTarget = 0;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.BadCurveParameters.selector); pad.create(p);
        p = _params(id, coin); p.curveSupply = 800_000_000e18; p.creatorVestBps = 1_500;   // 800M + 135M ≥ 900M
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.BadCurveParameters.selector); pad.create(p);
        p.curveSupply = 700_000_000e18;                  // 700M + 135M < 900M
        assertEq(_create(alice, p), 1);
    }

    function test_termsAreBounded() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p;

        p = _params(id, coin); p.fairWindow = 1 days + 1;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.FairWindowTooLong.selector); pad.create(p);
        p = _params(id, coin); p.feeBps = 101;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.FeeTooHigh.selector); pad.create(p);
        p = _params(id, coin); p.creatorBps = 1_501;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.CreatorShareTooHigh.selector); pad.create(p);
        p = _params(id, coin); p.creatorVestBps = 1_501;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.CreatorShareTooHigh.selector); pad.create(p);
        p = _params(id, coin); p.startsAt = T0 - 1;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.StartsInThePast.selector); pad.create(p);
        p = _params(id, coin); p.startsAt = T0 + 1 hours; p.deadline = T0 + 1 hours;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.DeadlinePassed.selector); pad.create(p);
        p = _params(id, coin); p.deadline = T0 + 30 days + 1;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.DeadlineTooFar.selector); pad.create(p);
        p = _params(id, coin); p.target = Target.UniswapV4;
        vm.prank(alice); vm.expectRevert(ILaunchpadEvents.NotYet.selector); pad.create(p);
        assertEq(pad.CUSTODIAN(), address(0), "no custodian until U14");

        // the boundaries themselves are fine
        p = _params(id, coin);
        p.fairWindow = 1 days; p.feeBps = 100; p.creatorBps = 1_500; p.creatorVestBps = 1_500;
        p.startsAt = T0 + 1 hours; p.deadline = T0 + 30 days; p.snipeTaxStartBps = 9_900;
        assertEq(_create(alice, p), 1);
        Launch memory l = pad.launchOf(1);
        assertEq(uint256(l.startsAt), uint256(T0 + 1 hours));
        assertEq(uint256(l.fairWindowEnds), uint256(T0 + 1 hours + 1 days));
        assertEq(uint256(l.epoch), 1);
        assertTrue(l.state == LaunchState.Live);

        // and nothing trades before the start
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.NotStarted.selector);
        pad.buy{value: 1 ether}(1, 0, uint64(block.timestamp), 10_000);
    }

    function test_aTaxAboveTheCeilingIsRefused() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.fairWindow = 100;
        p.snipeTaxStartBps = 10_000;                     // a trade that returns nothing is a broken contract
        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.SnipeTaxTooHigh.selector);
        pad.create(p);
        p.snipeTaxStartBps = 9_900;
        assertEq(_create(alice, p), 1);
        assertEq(pad.MAX_SNIPE_TAX_BPS(), 9_900);
    }

    function test_createCheckedPinsTheTerms() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        bytes32 h = pad.termsHash(p);
        assertEq(h, keccak256(abi.encode(p)));

        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.TermsMoved.selector);
        pad.createChecked(p, h ^ bytes32(uint256(1)));

        vm.prank(alice);
        assertEq(pad.createChecked(p, h), 1);
        assertEq(pad.launchOf(1).termsHash, h);
    }

    /*═══════════════════ the curve ═══════════════════*/

    function test_laterBuyersPayMore() public {
        (uint256 launchId, ) = _standard();
        uint256 first = _buy(launchId, bob, 0.5 ether);
        uint256 second = _buy(launchId, carol, 0.5 ether);
        assertLt(second, first, "a constant-product curve must get more expensive as it fills");
        assertEq(pad.creditOf(launchId, bob), first);
        assertEq(pad.creditOf(launchId, carol), second);
        assertEq(uint256(pad.launchOf(launchId).baseSold), first + second);
        assertEq(pad.raisedOf(launchId), 1 ether);
    }

    function test_aRoundTripNeverProfits() public {
        (uint256 launchId, ) = _standard();
        vm.deal(bob, 0);
        uint256 held = _buy(launchId, bob, 0.5 ether);
        assertEq(bob.balance, 0);
        _sell(launchId, bob, held);
        assertLe(bob.balance, 0.5 ether, "rounding alone never pays a round trip");
        assertEq(pad.creditOf(launchId, bob), 0);

        // with a fee the loss is strict
        vm.warp(T0 + 7 days);
        address coin = _launch(id, alice, bytes32(uint256(2)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.feeBps = 100;
        uint256 taxed = _create(alice, p);
        vm.deal(carol, 0);
        held = _buy(taxed, carol, 0.5 ether);
        _sell(taxed, carol, held);
        assertLt(carol.balance, 0.5 ether, "round trip must lose to fees and rounding");
    }

    function testFuzz_aRoundTripNeverProfits(uint96 amount, uint16 feeBps) public {
        amount = uint96(bound(amount, 1_000, 1 ether));
        feeBps = uint16(bound(feeBps, 0, 100));
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.feeBps = feeBps;
        uint256 launchId = _create(alice, p);
        vm.deal(bob, 0);
        uint256 held = _buy(launchId, bob, amount);
        assertGt(held, 0);
        _sell(launchId, bob, held);
        assertLe(bob.balance, amount);
        // and the launch still holds everything it says it holds
        assertGe(address(pad).balance, pad.totalHeld());
    }

    function test_aSlippageFloorIsHonoured() public {
        (uint256 launchId, ) = _standard();
        vm.deal(bob, 2 ether);
        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.SlippageExceeded.selector);
        pad.buy{value: 1 ether}(launchId, type(uint256).max, uint64(block.timestamp), 10_000);

        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.Expired.selector);
        pad.buy{value: 1 ether}(launchId, 0, uint64(block.timestamp - 1), 10_000);

        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.ZeroAmount.selector);
        pad.buy{value: 0}(launchId, 0, uint64(block.timestamp), 10_000);

        uint256 held = _buy(launchId, bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.SlippageExceeded.selector);
        pad.sell(launchId, held, type(uint256).max, uint64(block.timestamp));

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Launchpad.NotEnoughCredit.selector, held, held + 1));
        pad.sell(launchId, held + 1, 0, uint64(block.timestamp));

        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.NoSuchLaunch.selector);
        pad.sell(99, 1, 0, uint64(block.timestamp));
    }

    function test_theFairWindowCapsEachAddressThenLifts() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.fairWindow = 3600;
        p.maxBuyInWindow = 0.1 ether;
        uint256 launchId = _create(alice, p);

        _buy(launchId, bob, 0.1 ether);
        assertEq(pad.boughtInWindow(launchId, bob), 0.1 ether);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.FairWindowCapExceeded.selector);
        pad.buy{value: 0.05 ether}(launchId, 0, uint64(block.timestamp), 10_000);

        _buy(launchId, carol, 0.1 ether);                // the cap is per address
        vm.warp(T0 + 3601);
        _buy(launchId, bob, 1 ether);                    // the cap no longer applies
        assertEq(pad.boughtInWindow(launchId, bob), 0.1 ether, "only window buys are counted");
    }

    /*═══════════════════ the tax ═══════════════════*/

    function test_theTaxStartsAtNinetyNinePercentAndDecaysToNothing() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.fairWindow = 100;
        p.snipeTaxStartBps = 9_900;
        uint256 launchId = _create(alice, p);

        assertEq(pad.snipeTaxBps(launchId), 9_900);
        (uint256 out, uint256 fee, uint256 snipe) = pad.quoteBuy(launchId, 1 ether);
        assertEq(fee, 0);
        assertEq(snipe, 0.99 ether, "99 % at the opening block");
        assertGt(out, 0, "and the buyer still gets something");

        // a sniper in the first block keeps almost nothing...
        uint256 sniped = _buy(launchId, bob, 1 ether);
        assertEq(sniped, out, "the quote is the trade");
        (, uint256 floorOwed) = pad.feesHeld(launchId);
        assertEq(floorOwed, 0.99 ether, "...and what they gave up is held for the floor, not for a fee wallet");

        vm.warp(T0 + 50);
        assertEq(pad.snipeTaxBps(launchId), 4_950, "linear decay");
        vm.warp(T0 + 101);
        assertEq(pad.snipeTaxBps(launchId), 0);

        uint256 patient = _buy(launchId, carol, 1 ether);
        // Waiting out the window beats sniping, even though the curve got more expensive.
        assertGt(patient, sniped);
    }

    function test_theTaxHasNoExemptionList() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.fairWindow = 1000;
        p.snipeTaxStartBps = 9_900;
        p.graduationTarget = 0.002 ether;
        uint256 launchId = _create(alice, p);

        // the holder, the token's own Reach and a stranger: the tax is priced
        // by the clock, so every one of them pays it — there is no list to
        // be on
        address[3] memory everyone = [alice, reach, bob];
        for (uint256 i; i < everyone.length; ++i) {
            (, , uint256 snipe) = pad.quoteBuy(launchId, 0.1 ether);
            assertEq(snipe, 0.099 ether);
            _buy(launchId, everyone[i], 0.1 ether);
        }
        (, uint256 floorOwed) = pad.feesHeld(launchId);
        assertEq(floorOwed, 0.297 ether, "three sybils, three taxes");

        pad.graduate(launchId);
        assertEq(Coin(coin).redemptionPool(), 0.297 ether, "every sniper raised every holder's floor");
    }

    function test_aPayoutNeverExceedsOneHundredPercent() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.fairWindow = 1000;
        p.snipeTaxStartBps = 9_900;
        p.feeBps = 100;
        uint256 launchId = _create(alice, p);

        // 1 % base + 99 % tax would be 100 %: the tax is clamped so the
        // whole take is 99 % and the buyer keeps 1 %
        (uint256 out, uint256 fee, uint256 snipe) = pad.quoteBuy(launchId, 1 ether);
        assertEq(fee, 0.01 ether);
        assertEq(snipe, 0.98 ether, "the tax yields to the base fee under the ceiling");
        assertEq(fee + snipe, 0.99 ether);
        assertGt(out, 0);

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.FeeTooHigh.selector);
        pad.buy{value: 1 ether}(launchId, 0, uint64(block.timestamp), 9_899);   // the page's countdown bound
        vm.prank(bob);
        pad.buy{value: 1 ether}(launchId, 0, uint64(block.timestamp), 9_900);

        (uint256 creatorOwed, uint256 floorOwed) = pad.feesHeld(launchId);
        assertEq(creatorOwed + floorOwed, 0.99 ether);
        assertEq(pad.raisedOf(launchId), 0.01 ether);
        assertEq(pad.totalHeld(), 1 ether, "the launch holds exactly what it was given");
        assertEq(address(pad).balance, 1 ether);

        // a dust buy the rounding would eat whole is refused, not priced at nothing
        vm.deal(carol, 1);
        vm.prank(carol);
        vm.expectRevert(ILaunchpadEvents.ZeroAmount.selector);
        pad.buy{value: 1}(launchId, 0, uint64(block.timestamp), 10_000);
    }

    function test_feeTermsCannotChangeMidLaunch() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.feeBps = 100;
        p.creatorBps = 1_500;
        uint256 a = _create(alice, p);
        (, uint256 fee1, ) = pad.quoteBuy(a, 1 ether);
        assertEq(fee1, 0.01 ether);
        _buy(a, bob, 1 ether);

        // another token's launch with other terms changes nothing here
        uint256 id2 = hub.mint(carol);
        address coin2 = _launch(id2, carol, bytes32(uint256(2)), RAISE);
        LaunchParams memory q = _params(id2, coin2);
        q.feeBps = 0;
        _create(carol, q);

        (, uint256 fee2, ) = pad.quoteBuy(a, 1 ether);
        assertEq(fee2, 0.01 ether, "the fee is a term of the launch, written once");
        _buy(a, bob, 1 ether);
        Launch memory l = pad.launchOf(a);
        assertEq(uint256(l.feeBps), 100);
        assertEq(uint256(l.creatorBps), 1_500);
        (uint256 creatorOwed, uint256 floorOwed) = pad.feesHeld(a);
        assertEq(creatorOwed, 0.003 ether, "15 % of the fee");
        assertEq(floorOwed, 0.017 ether, "the rest to the floor");

        // and there is no setter: the ABI has no such selector
        (bool ok, ) = address(pad).call(abi.encodeWithSignature("setFeeSplit(uint16,uint16)", 0, 0));
        assertFalse(ok);
        (ok, ) = address(pad).call(abi.encodeWithSignature("setFee(uint256,uint16)", a, 0));
        assertFalse(ok);
    }

    /*═══════════════════ custody of curve funds ═══════════════════*/

    function test_nobodyCanWithdrawCurveFunds() public {
        (uint256 launchId, ) = _standard();
        _buy(launchId, bob, 1 ether);
        _buy(launchId, carol, 0.5 ether);
        assertEq(address(pad).balance, 1.5 ether);
        assertEq(pad.totalHeld(), 1.5 ether);

        string[10] memory sigs = [
            "withdraw()", "withdraw(address)", "withdraw(uint256)", "pause()", "unpause()",
            "rescue(address)", "sweep(address)", "setPaused(bool)", "transferOwnership(address)", "owner()"
        ];
        for (uint256 i; i < sigs.length; ++i) {
            vm.prank(alice);
            (bool ok, ) = address(pad).call(abi.encodeWithSignature(sigs[i], alice));
            assertFalse(ok, sigs[i]);
        }

        // the holder cannot fail a live launch, graduate a short one, or
        // sell credits they do not hold
        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.NotFailable.selector);
        pad.fail(launchId);
        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.NotGraduatable.selector);
        pad.graduate(launchId);
        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.NothingToClaim.selector);
        pad.refund(launchId, bob);
        vm.prank(alice);
        vm.expectRevert(Launchpad.NotEnoughCredit.selector);
        pad.sell(launchId, 1, 0, uint64(block.timestamp));
        assertEq(address(pad).balance, 1.5 ether, "every wei is still there");
    }

    function test_noTokenMovesBeforeGraduation() public {
        (uint256 launchId, address coin) = _standard();
        uint256 credit = _buy(launchId, bob, 1 ether);
        assertGt(credit, 0);
        assertEq(Coin(coin).balanceOf(bob), 0, "a buyer holds credits, not tokens");
        assertEq(Coin(coin).balanceOf(address(pad)), RAISE, "nothing ERC-20 moved");
        assertEq(pad.creditOf(launchId, bob), credit);

        vm.expectRevert(ILaunchpadEvents.NothingToClaim.selector);
        pad.claim(launchId, bob);

        _buy(launchId, carol, 1 ether);
        _buy(launchId, dave, 1 ether);
        pad.graduate(launchId);

        pad.claim(launchId, bob);                        // anyone pays the gas; the recipient is fixed
        assertEq(Coin(coin).balanceOf(bob), credit);
        assertEq(pad.creditOf(launchId, bob), 0);
        vm.expectRevert(ILaunchpadEvents.NothingToClaim.selector);
        pad.claim(launchId, bob);
        vm.expectRevert(ILaunchpadEvents.NothingToClaim.selector);
        pad.claim(launchId, alice);
    }

    /*═══════════════════ graduation ═══════════════════*/

    function test_graduationWaitsForTheTarget() public {
        (uint256 launchId, ) = _standard();
        _buy(launchId, bob, 1 ether);
        vm.expectRevert(ILaunchpadEvents.NotGraduatable.selector);
        pad.graduate(launchId);
        _buy(launchId, carol, 1 ether);
        _buy(launchId, dave, 0.5 ether);
        assertEq(pad.raisedOf(launchId), 2.5 ether);
        vm.expectRevert(ILaunchpadEvents.NotGraduatable.selector);
        pad.graduate(launchId);
        _buy(launchId, dave, 0.5 ether);
        assertEq(pad.raisedOf(launchId), 3 ether);
        pad.graduate(launchId);
        assertTrue(pad.launchOf(launchId).state == LaunchState.Graduated);
    }

    function test_anyoneMayGraduate() public {
        (uint256 launchId, ) = _standard();
        _fill(launchId);

        // Anyone may graduate: it must not depend on the creator showing up.
        vm.prank(address(0x5717A96E7));
        pad.graduate(launchId);
        assertTrue(pad.launchOf(launchId).state == LaunchState.Graduated);
        assertTrue(pad.launchOf(launchId).marketKey != 0);

        vm.expectRevert(ILaunchpadEvents.AlreadyGraduated.selector);
        pad.graduate(launchId);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.AlreadyGraduated.selector);
        pad.buy{value: 1 ether}(launchId, 0, uint64(block.timestamp), 10_000);
        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.AlreadyGraduated.selector);
        pad.sell(launchId, 1, 0, uint64(block.timestamp));
        vm.warp(T0 + 8 days);
        vm.expectRevert(ILaunchpadEvents.NotFailable.selector);
        pad.fail(launchId);
    }

    function test_graduationOpensASealedMarketAtTheTerminalPrice() public {
        (uint256 launchId, address coin) = _standard();
        _fill(launchId);
        Launch memory before = pad.launchOf(launchId);
        uint256 terminal = pad.priceOf(launchId);
        // q = 4 ETH, b = 9e44 / 4e18 = 225M: terminal = 4e36 / 2.25e26
        assertEq(terminal, uint256(4e36) / 2.25e26);

        pad.graduate(launchId);

        uint256 key = pool.sealedKey(pad.launchKey(launchId));
        assertEq(pad.launchOf(launchId).marketKey, key);
        assertEq(pool.sealedCount(), 1);
        Market memory m = pool.marketOf(key);
        assertTrue(m.sealedMarket);
        assertEq(m.base, coin);
        assertEq(m.quote, address(0));
        assertEq(uint256(m.feeBps), 100);
        assertEq(m.beneficiary, id, "fees of the sealed market pay this token's feeSink");
        assertEq(uint256(m.rQuote), 3 ether, "the whole raise is the quote principal");

        // exactly as much base as the terminal price calls for, and the spot
        // is the terminal price — the number buyers paid at the end
        uint256 amountBase = (3 ether * uint256(before.baseReserve)) / uint256(before.quoteReserve);
        assertEq(uint256(m.rBase), amountBase);
        uint256 spot = pool.spot(key);
        uint256 diff = spot > terminal ? spot - terminal : terminal - spot;
        assertLe(diff * 1e9, terminal, "terminal and spot agree to a part in a billion");
        assertEq(pad.priceOf(launchId), terminal, "the curve is frozen at its terminal price");

        // the base the price did not need was burned, never bagged
        uint256 leftover = uint256(before.baseReserve) - amountBase;
        assertGt(leftover, 0);
        assertEq(Coin(coin).totalSupply(), SUPPLY - leftover);
        assertEq(Coin(coin).balanceOf(address(pad)), uint256(before.baseSold), "only the buyers' credits remain here");
        assertEq(Coin(coin).balanceOf(address(pool)), amountBase);
        assertEq(Coin(coin).allowance(address(pad), address(pool)), 0, "approvals zeroed in the same call");
        assertEq(address(pad).balance, 0);
        assertEq(pad.totalHeld(), 0);
    }

    function test_aPoolThatPullsTheWrongAmountIsRefused() public {
        LaunchWiring w2 = new LaunchWiring(address(hub), address(pm), 1);
        Kiln k2 = w2.kiln();
        Launchpad p2 = w2.pad();
        vm.prank(alice);
        address coin = k2.launch(id, "Agent One", "AGENT1", 18, SUPPLY, bytes32(0), RAISE);
        LaunchParams memory p = _params(id, coin);
        vm.prank(alice);
        uint256 launchId = p2.create(p);
        for (uint256 i; i < 3; ++i) {
            vm.deal(bob, 1 ether);
            vm.prank(bob);
            p2.buy{value: 1 ether}(launchId, 0, uint64(block.timestamp), 10_000);
        }
        // a pool that took one wei less than it was told would open at a
        // different price than the curve ended at: the graduation refuses
        vm.expectRevert(ILaunchpadEvents.TransferFailed.selector);
        p2.graduate(launchId);
        assertTrue(p2.launchOf(launchId).state == LaunchState.Live);
    }

    function test_theFeeLegsPayTheSinkAndTheFloorAtGraduation() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.feeBps = 100;
        p.creatorBps = 1_500;
        uint256 launchId = _create(alice, p);

        _buy(launchId, bob, 1 ether);
        (uint256 creatorOwed, uint256 floorOwed) = pad.feesHeld(launchId);
        assertEq(creatorOwed, 0.0015 ether, "15 % of a 1 % fee");
        assertEq(floorOwed, 0.0085 ether);
        assertEq(reach.balance, 0, "nothing is paid while the curve is live");
        assertEq(Coin(coin).redemptionPool(), 0);
        assertEq(Coin(coin).floorPerToken(), 0);

        _buy(launchId, carol, 1 ether);
        _buy(launchId, dave, 1 ether);
        _buy(launchId, dave, 0.1 ether);                 // net 3.069 ≥ 3
        assertEq(pad.raisedOf(launchId), 3.069 ether);
        pad.graduate(launchId);

        assertEq(reach.balance, 0.00465 ether, "the creator leg lands in feeSink(id): the Reach");
        assertEq(Coin(coin).redemptionPool(), 0.02635 ether, "the floor leg lands in the coin");
        assertGt(Coin(coin).floorPerToken(), 0);
        (creatorOwed, floorOwed) = pad.feesHeld(launchId);
        assertEq(creatorOwed + floorOwed, 0, "nothing held once earned");
        assertEq(address(pad).balance, 0);
    }

    function test_sellingTheTokenMovesTheFeeStream() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.feeBps = 100;
        p.creatorBps = 1_500;
        uint256 launchId = _create(alice, p);
        _buy(launchId, bob, 1 ether);
        _buy(launchId, carol, 1 ether);
        _buy(launchId, dave, 1 ether);
        _buy(launchId, dave, 0.1 ether);

        // alice sells the Intact to carol before the graduation
        vm.prank(alice);
        hub.transfer(id, carol);
        assertEq(hub.ownerOf(id), carol);
        assertEq(hub.feeSink(id), reach, "the sink is the token's Reach, whoever holds the token");

        vm.prank(dave);
        pad.graduate(launchId);
        assertEq(reach.balance, 0.00465 ether, "the creator leg paid the Reach, now carol's");

        // the seller kept no authority: carol launches next, alice cannot
        vm.warp(T0 + 7 days);
        vm.prank(alice);
        vm.expectRevert(IKilnEvents.NotActor.selector);
        kiln.launch(id, "Two", "TWO", 18, SUPPLY, bytes32(uint256(2)), 0);
        vm.prank(carol);
        kiln.launch(id, "Two", "TWO", 18, SUPPLY, bytes32(uint256(2)), 0);
        assertEq(kiln.launchCount(id), 2);

        // and the buyer may send the next launch's fee leg to the Grip
        vm.prank(carol);
        hub.setFeesToGrip(id, true);
        assertEq(hub.feeSink(id), hub.grip(id));
    }

    /*═══════════════════ the floor ═══════════════════*/

    function test_theSnipeTaxRaisesTheFloor() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.fairWindow = 1000;
        p.snipeTaxStartBps = 9_900;
        p.graduationTarget = 0.005 ether;
        uint256 launchId = _create(alice, p);

        _buy(launchId, bob, 1 ether);                    // 0.99 taxed, 0.01 to the curve
        assertEq(Coin(coin).floorPerToken(), 0, "the floor rises at graduation, not before");
        pad.graduate(launchId);
        assertEq(Coin(coin).redemptionPool(), 0.99 ether, "the entire tax is the floor's");
        uint256 floor = Coin(coin).floorPerToken();
        assertEq(floor, (0.99 ether * 1e18) / Coin(coin).totalSupply());
        assertGt(floor, 0);

        // the same buy on an untaxed launch raises no floor at all
        uint256 id2 = hub.mint(carol);
        address plain = _launch(id2, carol, bytes32(uint256(2)), RAISE);
        LaunchParams memory q = _params(id2, plain);
        q.graduationTarget = 0.005 ether;
        uint256 other = _create(carol, q);
        _buy(other, bob, 1 ether);
        pad.graduate(other);
        assertEq(Coin(plain).redemptionPool(), 0);
        assertEq(Coin(plain).floorPerToken(), 0);
    }

    function test_redeemPaysProRataAndLeavesTheFloorUnchanged() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.feeBps = 100;
        p.creatorBps = 1_000;
        uint256 launchId = _create(alice, p);
        _buy(launchId, bob, 1 ether);
        _buy(launchId, carol, 1 ether);
        _buy(launchId, dave, 1 ether);
        _buy(launchId, dave, 0.1 ether);
        pad.graduate(launchId);
        pad.claim(launchId, bob);

        Coin c = Coin(coin);
        uint256 floorBefore = c.floorPerToken();
        assertGt(floorBefore, 0);
        uint256 held = c.balanceOf(bob);
        uint256 preview = (c.redemptionPool() * (held / 2)) / c.totalSupply();
        uint256 ethBefore = bob.balance;

        vm.prank(bob);
        uint256 paid = c.redeem(held / 2);
        assertEq(paid, preview);
        assertEq(bob.balance - ethBefore, paid);
        assertEq(c.balanceOf(bob), held - held / 2);

        uint256 floorAfter = c.floorPerToken();
        // The invariant that matters: redeeming never dilutes the holders who
        // stayed. Rounding is in their favour, so the floor may tick up by
        // dust but never down.
        assertGe(floorAfter, floorBefore, "floor fell");
        assertLt((floorAfter - floorBefore) * 1_000_000, floorBefore, "floor drift should be dust");

        vm.prank(bob);
        vm.expectRevert(ICoin.ZeroAmount.selector);
        c.redeem(0);
        vm.prank(alice);                                 // no balance
        vm.expectRevert(ICoin.NotEnough.selector);
        c.redeem(1e18);
    }

    function test_contributeRaisesTheFloorForEveryHolder() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), 0);
        Coin c = Coin(coin);
        vm.deal(dave, 2 ether);
        vm.prank(dave);
        c.contribute{value: 1 ether}();
        assertEq(c.redemptionPool(), 1 ether);
        assertEq(c.floorPerToken(), 1e9, "1 ETH over 1e9 whole tokens");

        vm.prank(dave);
        vm.expectRevert(ICoin.ZeroAmount.selector);
        c.contribute{value: 0}();

        // the only way in is `contribute`: a plain transfer has nowhere to land
        vm.prank(dave);
        (bool ok, ) = coin.call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(c.redemptionPool(), 1 ether);
    }

    function test_theCoinHasNoMintSelector() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), 0);
        Coin c = Coin(coin);
        (bool ok, ) = coin.call(abi.encodeWithSignature("mint(address,uint256)", bob, 1e18));
        assertFalse(ok, "there is no mint");
        (ok, ) = coin.call(abi.encodeWithSignature("mint(uint256)", 1e18));
        assertFalse(ok);
        assertEq(c.totalSupply(), SUPPLY);

        // burning is the only way the supply moves, and it only raises the floor
        vm.deal(dave, 1 ether);
        vm.prank(dave);
        c.contribute{value: 1 ether}();
        uint256 floorBefore = c.floorPerToken();
        vm.prank(reach);
        c.burn(SUPPLY / 2);
        assertEq(c.totalSupply(), SUPPLY / 2);
        assertEq(c.floorPerToken(), floorBefore * 2);
        vm.prank(reach);
        vm.expectRevert(ICoin.NotEnough.selector);
        c.burn(SUPPLY);
    }

    /*═══════════════════ failure ═══════════════════*/

    function test_aFailedRaiseRefundsEveryWei() public {
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        LaunchParams memory p = _params(id, coin);
        p.fairWindow = 1000;
        p.snipeTaxStartBps = 9_900;
        p.feeBps = 100;
        p.creatorBps = 1_500;
        p.deadline = T0 + 1 days;
        uint256 launchId = _create(alice, p);

        vm.deal(bob, 0);
        _buy(launchId, bob, 1 ether);                    // 99 % of it is tax and fee
        assertEq(bob.balance, 0);
        (uint256 creatorOwed, uint256 floorOwed) = pad.feesHeld(launchId);
        assertEq(creatorOwed + floorOwed + pad.raisedOf(launchId), 1 ether);

        vm.warp(T0 + 1 days);
        vm.expectRevert(ILaunchpadEvents.NotFailable.selector);
        pad.fail(launchId);                              // the deadline is inclusive
        vm.warp(T0 + 1 days + 1);
        vm.expectRevert(ILaunchpadEvents.NotGraduatable.selector);
        pad.graduate(launchId);

        uint256 reachBefore = Coin(coin).balanceOf(reach);
        vm.prank(dave);
        pad.fail(launchId);
        assertTrue(pad.launchOf(launchId).state == LaunchState.Failed);
        assertEq(Coin(coin).balanceOf(reach) - reachBefore, RAISE, "the supply went home to the Reach");
        assertEq(Coin(coin).balanceOf(address(pad)), 0);

        vm.prank(dave);
        pad.refund(launchId, bob);                       // anyone pays the gas; the recipient is fixed
        assertEq(bob.balance, 1 ether, "every wei, fees and tax included: a failed launch earned nothing");
        assertEq(address(pad).balance, 0);
        assertEq(pad.totalHeld(), 0);
        assertEq(Coin(coin).redemptionPool(), 0, "the floor leg was never paid");

        vm.expectRevert(ILaunchpadEvents.NothingToClaim.selector);
        pad.refund(launchId, bob);
        vm.expectRevert(ILaunchpadEvents.NothingToClaim.selector);
        pad.claim(launchId, bob);
        vm.expectRevert(ILaunchpadEvents.NotFailable.selector);
        pad.fail(launchId);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.NotLive.selector);
        pad.buy{value: 1 ether}(launchId, 0, uint64(block.timestamp), 10_000);

        // two buyers at two prices liquidate the pot pro-rata over credits
        vm.warp(T0 + 7 days);
        address coin2 = _launch(id, alice, bytes32(uint256(2)), RAISE);
        LaunchParams memory q = _params(id, coin2);
        q.feeBps = 100;
        q.deadline = uint64(block.timestamp + 1 days);
        uint256 second = _create(alice, q);
        vm.deal(bob, 0);
        vm.deal(carol, 0);
        _buy(second, bob, 1 ether);
        _buy(second, carol, 0.5 ether);
        vm.warp(block.timestamp + 1 days + 1);
        pad.fail(second);
        pad.refund(second, bob);
        pad.refund(second, carol);
        assertGe(bob.balance + carol.balance, 1.5 ether - 1, "the pot is paid out to the wei of rounding");
        assertLe(bob.balance + carol.balance, 1.5 ether);
        assertLe(address(pad).balance, 1);
    }

    /*═══════════════════ the launch rules ═══════════════════*/

    function test_anAgentsFirstLaunchNeedsTheGuardian() public {
        // the Reach (an agent's session acts only as the Reach) may not make
        // the token's first launch alone
        vm.prank(reach);
        vm.expectRevert(ILaunchpadEvents.FirstLaunchNeedsHolderOrGuardian.selector);
        kiln.launch(id, "Agent One", "AGENT1", 18, SUPPLY, bytes32(0), 0);

        vm.prank(bob);
        vm.expectRevert(ILaunchpadEvents.NotGuardian.selector);
        pad.approveFirstLaunch(id);                      // a stranger is not the guardian
        vm.prank(guardian);
        vm.expectRevert(ILaunchpadEvents.NotGuardian.selector);
        pad.approveFirstLaunch(id);                      // nor is anyone while none is set

        vm.prank(alice);
        hub.setGuardian(id, guardian);
        vm.prank(guardian);
        pad.approveFirstLaunch(id);
        assertTrue(pad.firstLaunchApproved(id));

        // a sale voids the co-sign: it is stamped with the custody epoch
        vm.prank(alice);
        hub.transfer(id, carol);
        assertFalse(pad.firstLaunchApproved(id));
        vm.prank(reach);
        vm.expectRevert(ILaunchpadEvents.FirstLaunchNeedsHolderOrGuardian.selector);
        kiln.launch(id, "Agent One", "AGENT1", 18, SUPPLY, bytes32(0), 0);

        vm.prank(carol);
        hub.setGuardian(id, guardian);
        vm.prank(guardian);
        pad.approveFirstLaunch(id);
        // the co-sign lets the Reach launch, not a stranger
        vm.prank(bob);
        vm.expectRevert(IKilnEvents.NotActor.selector);
        kiln.launch(id, "Agent One", "AGENT1", 18, SUPPLY, bytes32(0), 0);
        vm.prank(reach);
        address coin = kiln.launch(id, "Agent One", "AGENT1", 18, SUPPLY, bytes32(0), RAISE);
        assertEq(kiln.launchedBy(coin), id);
        assertFalse(pad.firstLaunchApproved(id), "one-time: consumed by the launch");

        // the raise half is the Reach's too, with no further co-sign
        vm.prank(reach);
        uint256 launchId = pad.create(_params(id, coin));
        assertEq(launchId, 1);

        // thereafter the Reach launches under the spacing alone
        vm.warp(T0 + 7 days);
        vm.prank(reach);
        kiln.launch(id, "Two", "TWO", 18, SUPPLY, bytes32(uint256(2)), 0);
        assertEq(kiln.launchCount(id), 2);

        // and a holder's first launch never needed anyone
        uint256 id2 = hub.mint(bob);
        vm.prank(bob);
        kiln.launch(id2, "Mine", "MINE", 18, SUPPLY, bytes32(0), 0);
    }

    function test_launchesAreSevenDaysApart() public {
        assertEq(pad.LAUNCH_SPACING(), 7 days);
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        assertEq(uint256(pad.lastLaunchAt(id)), uint256(T0));

        // the raise is the second half of the same launch, not a new one
        _create(alice, _params(id, coin));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ILaunchpadEvents.TooSoon.selector, uint64(T0 + 7 days)));
        kiln.launch(id, "Two", "TWO", 18, SUPPLY, bytes32(uint256(2)), 0);
        vm.warp(T0 + 7 days - 1);
        vm.prank(alice);
        vm.expectRevert(ILaunchpadEvents.TooSoon.selector);
        kiln.launch(id, "Two", "TWO", 18, SUPPLY, bytes32(uint256(2)), 0);
        vm.warp(T0 + 7 days);
        vm.prank(alice);
        kiln.launch(id, "Two", "TWO", 18, SUPPLY, bytes32(uint256(2)), 0);
        assertEq(uint256(pad.lastLaunchAt(id)), uint256(T0 + 7 days));

        // the clock is per token
        uint256 id2 = hub.mint(bob);
        vm.prank(bob);
        kiln.launch(id2, "Mine", "MINE", 18, SUPPLY, bytes32(0), 0);
    }

    function test_launchRootMovesOnEveryLaunchEvent() public {
        assertEq(pad.launchRoot(id), bytes32(0));
        address coin = _launch(id, alice, bytes32(uint256(1)), RAISE);
        bytes32 r1 = pad.launchRoot(id);
        assertTrue(r1 != bytes32(0), "the coin is in the root");
        uint256 launchId = _create(alice, _params(id, coin));
        bytes32 r2 = pad.launchRoot(id);
        assertTrue(r2 != r1, "the raise is in the root");
        _fill(launchId);
        pad.graduate(launchId);
        bytes32 r3 = pad.launchRoot(id);
        assertTrue(r3 != r2, "the graduation is in the root");

        assertEq(pad.launchesOf(id).length, 1);
        assertEq(pad.launchesOf(id)[0], launchId);
        assertEq(pad.launchCount(), 1);
        assertEq(pad.launchOf(launchId).id, id);
        assertEq(pad.launchOf(launchId).coin, coin);
    }

    /*═══════════════════ hooks ═══════════════════*/

    function test_miningSixtyThousandSaltsFitsAnEthCall() public {
        uint64 opens = T0 + 1 hours;
        uint64 unlocks = T0 + 1 days;
        bytes32 arg = bytes32((uint256(opens) << 64) | uint256(unlocks));
        (bytes32 initCodeHash, uint16 flags) = kiln.recipeHash(0, arg);
        assertEq(uint256(flags), uint256(Hook.BEFORE_REMOVE_LIQUIDITY | Hook.BEFORE_SWAP),
                 "the kiln names the permissions the recipe needs");

        vm.expectRevert(abi.encodeWithSelector(IKilnEvents.UnknownRecipe.selector, uint8(7)));
        kiln.recipeHash(7, arg);

        bool found; bytes32 salt; address at;
        uint256 from;
        uint256 g = gasleft();
        (found, salt, at) = kiln.mine(initCodeHash, flags, from, 60_000);
        uint256 used = g - gasleft();
        assertLt(used, 16_777_216, "sixty thousand salts fit under the eth_call cap");
        while (!found && from < 600_000) {
            from += 60_000;
            (found, salt, at) = kiln.mine(initCodeHash, flags, from, 60_000);
        }
        assertTrue(found, "an address carrying exactly those two permissions exists");
        assertEq(uint256(Hook.flags(at)), uint256(flags));
        assertEq(at, Hook.at(address(kiln), salt, initCodeHash), "the miner is CREATE2 and nothing else");

        // a salt the miner did not bless lands on the wrong bits
        bytes32 bad;
        while (Hook.flags(Hook.at(address(kiln), bad, initCodeHash)) == flags) bad = bytes32(uint256(bad) + 1);
        vm.expectRevert(IKilnEvents.WrongFlags.selector);
        kiln.deployHook(0, bad, arg);

        address hook = kiln.deployHook(0, salt, arg);
        assertEq(hook, at, "built at exactly the address the miner named");
        assertEq(Gate(hook).MANAGER(), address(pm));
        assertEq(uint256(Gate(hook).OPENS()), uint256(opens));
        assertEq(uint256(Gate(hook).UNLOCKS()), uint256(unlocks));

        // the gate, through the manager, by selector
        MockPoolManager.PoolKey memory key = MockPoolManager.PoolKey(address(0x11), address(0x22), 3000, 60, hook);
        pm.initialize(key, 1);
        MockPoolManager.SwapParams memory swap = MockPoolManager.SwapParams(false, 1000, 0);
        vm.expectRevert(Gate.NotOpenYet.selector);
        pm.swap(key, swap, "");
        MockPoolManager.ModifyLiquidityParams memory remove = MockPoolManager.ModifyLiquidityParams(-100, 100, -1000, 0);
        vm.expectRevert(Gate.StillLocked.selector);
        pm.modifyLiquidity(key, remove, "");
        vm.warp(opens);
        pm.swap(key, swap, "");
        vm.expectRevert(Gate.StillLocked.selector);
        pm.modifyLiquidity(key, remove, "");
        vm.warp(unlocks);
        pm.modifyLiquidity(key, remove, "");
        (bool tradingOpen, bool liquidityFree) = Gate(hook).status();
        assertTrue(tradingOpen && liquidityFree);

        // only the manager may drive the callbacks
        vm.prank(bob);
        vm.expectRevert(Gate.NotTheManager.selector);
        Gate(hook).beforeRemoveLiquidity(bob, _key(hook), _remove(), "");
    }

    function _key(address hook) private pure returns (PoolKey memory) {
        return PoolKey(address(0x11), address(0x22), 3000, 60, hook);
    }

    function _remove() private pure returns (ModifyLiquidityParams memory) {
        return ModifyLiquidityParams(-100, 100, -1000, 0);
    }
}
