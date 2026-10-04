// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Pool} from "../src/Pool.sol";
import {IPoolEvents, Market} from "../src/interfaces/IPool.sol";
import {Curve} from "../src/lib/Curve.sol";
import {Ratchet} from "../src/lib/Ratchet.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {PoolHub} from "./mocks/PoolFixtures.sol";

/*───────────────────────────────────────────────────────────────────────────
  The market.

  Origin: IPSEITY test/Pool.t.sol (28 tests, 6 fuzz), ported to INTACT's
  Pool. These are written to break it. The properties that actually keep
  the money in the pool are the fuzzed ones at the top: the invariant
  never falls, a round trip never profits — now in both directions, through
  exact-out, over native legs and at dust — and the pool never pays out
  more than it holds. Everything below them is access control, the seal,
  the sniper fee, native legs and the sealed markets. The C1/C2/C5
  regressions with hostile tokens live in test/PoolReenter.t.sol.

  Dropped from the port, with the reason: the section-word geometry tests
  (`turningThroughW…`, `theCurveIsTheSolid`) — the curve is a number now;
  `depositCap` — there is no cap; `allowlistGatesNewMarkets`,
  `onlyAdminMayFlipTheSwitches`, `adminHandoverTakesTwoSteps` — there is
  no admin, which tools/verify-pool.mjs proves against the ABI.
───────────────────────────────────────────────────────────────────────────*/
contract PoolTest is Test {
    PoolHub   hub;
    Pool      pool;
    MockERC20 weth;
    MockERC20 usdc;

    address holder    = address(0xB0B1);
    address trader    = address(0x7EAD);
    address stranger  = address(0x8E17);
    address launchpad = address(0x1A0C);
    address reach;                       // hub.account(1)

    uint256 constant WAD = 1e18;
    uint64  constant FOREVER = 4102444800;
    uint64  constant T0 = 1_733_000_000;
    uint256 constant ID = 1;             // the ERC-20/ERC-20 market
    uint256 constant NID = 2;            // the WETH/native market

    function setUp() public {
        vm.warp(T0);
        hub = new PoolHub();
        pool = new Pool(address(hub), launchpad);
        weth = new MockERC20("Wrapped Ether", "WETH", 18, 0, false);
        usdc = new MockERC20("USD Coin", "USDC", 18, 0, false);

        vm.deal(holder, 1000 ether);
        vm.deal(trader, 1000 ether);
        vm.deal(stranger, 10 ether);

        assertEq(hub.mint(holder), ID);
        assertEq(hub.mint(holder), NID);
        reach = hub.account(ID);
        vm.deal(reach, 10 ether);

        weth.mint(holder, 1e24);
        usdc.mint(holder, 1e24);
        weth.mint(trader, 1e24);
        usdc.mint(trader, 1e24);
        weth.mint(reach, 1e24);

        vm.startPrank(holder);
        weth.approve(address(pool), type(uint256).max);
        usdc.approve(address(pool), type(uint256).max);
        pool.openMarket(ID, address(weth), address(usdc), 30, 0, 0, 0);
        pool.deposit(ID, 100 * WAD, 300_000 * WAD);
        // the native market: WETH against ETH itself, 1:1
        pool.openMarket(NID, address(weth), address(0), 30, 0, 0, 0);
        pool.deposit{value: 100 ether}(NID, 100 * WAD, 100 ether);
        vm.stopPrank();

        vm.startPrank(trader);
        weth.approve(address(pool), type(uint256).max);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
        vm.prank(reach);
        weth.approve(address(pool), type(uint256).max);
    }

    /// @dev Read out of the market's own storage rather than recomputed
    ///      from the live reserves. Recomputing was the mistake: virtual
    ///      reserves proportional to live reserves re-anchor the curve after
    ///      every trade, so k measured that way is not the quantity trading
    ///      conserves — and a round trip could extract the difference. The
    ///      offsets are anchored now; this reads what was anchored.
    function _k(uint256 id) internal view returns (uint256) {
        Market memory m = pool.marketOf(id);
        return (uint256(m.rBase) + m.vBase) * (uint256(m.rQuote) + m.vQuote);
    }

    function _sync(uint256 id, uint24 bps) internal {
        Market memory m = pool.marketOf(id);
        vm.prank(holder);
        pool.syncCurve(id, bps, m.curveBps);
    }

    /*═════════ the three that matter ═════════*/

    /// @dev If k can be made to fall, the pool can be drained one trade at a
    ///      time. Every legal trade must leave it the same or larger.
    function testFuzz_invariantNeverFalls(uint256 amount, bool baseIn, uint24 curve, bool exactOut) public {
        curve = uint24(bound(curve, 0, Curve.MAX_CONCENTRATION));
        _sync(ID, curve);

        Market memory m = pool.marketOf(ID);
        amount = bound(amount, 1, baseIn ? uint256(m.rBase) / 3 : uint256(m.rQuote) / 3);

        uint256 before_ = _k(ID);
        vm.prank(trader);
        if (exactOut) {
            uint256 want = bound(amount, 1, (baseIn ? uint256(m.rQuote) : uint256(m.rBase)) / 3);
            try pool.swapExactOut(ID, baseIn, want, type(uint256).max, trader, FOREVER) {
                assertGe(_k(ID), before_, "the invariant fell: the pool leaks (exact out)");
            } catch {
                assertEq(_k(ID), before_, "a refused trade changed the reserves");
            }
        } else {
            try pool.swapExactIn(ID, baseIn, amount, 0, trader, FOREVER) {
                assertGe(_k(ID), before_, "the invariant fell: the pool leaks");
            } catch {
                assertEq(_k(ID), before_, "a refused trade changed the reserves");
            }
        }
    }

    /// @dev Buy then immediately sell back. If this can ever come out ahead,
    ///      the curve is free money and the pool is a faucet. Extended from
    ///      IPSEITY's: both markets (one with a native leg), every shape of
    ///      round trip (in/in, out/in, in/out, out/out), and dust — 1, 2 and
    ///      9 wei are forced in a quarter of the runs, since a rounding
    ///      leak lives at the bottom of the range, not the middle.
    function testFuzz_roundTripNeverProfits(uint256 amount, uint24 curve, uint8 shape, bool nativeMarket) public {
        curve = uint24(bound(curve, 0, Curve.MAX_CONCENTRATION));
        uint256 id = nativeMarket ? NID : ID;
        _sync(id, curve);

        Market memory m = pool.marketOf(id);
        uint8 dust = shape >> 4;
        if (dust % 4 == 0) amount = [uint256(1), 2, 9, 2 ** 64][dust / 4 % 4];
        else amount = bound(amount, 1, uint256(m.rBase) / 4);

        uint256 start = weth.balanceOf(trader);
        uint256 startEth = trader.balance;
        uint256 got;
        vm.startPrank(trader);
        bool outFirst = shape & 1 == 1;
        bool outSecond = shape & 2 == 2;

        // leg one: WETH (base) in, quote out
        if (outFirst) {
            // ask for the quote a straight swap of `amount` would give
            uint256 want;
            try pool.quote(id, true, amount) returns (uint256 q) { want = q; } catch { vm.stopPrank(); return; }
            if (want == 0) { vm.stopPrank(); return; }
            try pool.swapExactOut(id, true, want, amount, trader, FOREVER) returns (uint256) { got = want; }
            catch { vm.stopPrank(); return; }
        } else {
            try pool.swapExactIn(id, true, amount, 0, trader, FOREVER) returns (uint256 o) { got = o; }
            catch { vm.stopPrank(); return; }
        }
        if (got == 0) { vm.stopPrank(); return; }

        // leg two: quote back in, WETH out
        uint256 value = nativeMarket ? got : 0;
        if (outSecond) {
            uint256 back;
            try pool.quote(id, false, got) returns (uint256 q) { back = q; } catch { vm.stopPrank(); return; }
            if (back == 0) { vm.stopPrank(); return; }
            try pool.swapExactOut{value: value}(id, false, back, got, trader, FOREVER) {} catch { vm.stopPrank(); return; }
        } else {
            try pool.swapExactIn{value: value}(id, false, got, 0, trader, FOREVER) {} catch { vm.stopPrank(); return; }
        }
        vm.stopPrank();

        assertLe(weth.balanceOf(trader), start, "a round trip made money out of nothing");
        if (nativeMarket) assertLe(trader.balance, startEth, "a native round trip made ether out of nothing");
    }

    /// @dev The curve prices against virtual reserves, so it will happily
    ///      quote more than the pool holds. The guard is the only thing
    ///      standing between that and an insolvent market.
    function testFuzz_neverPaysMoreThanItHolds(uint256 amount, bool baseIn, uint24 curve) public {
        curve = uint24(bound(curve, 0, Curve.MAX_CONCENTRATION));
        _sync(ID, curve);
        Market memory m = pool.marketOf(ID);
        amount = bound(amount, 1, 1e26);
        uint256 held = baseIn ? uint256(m.rQuote) : uint256(m.rBase);

        vm.prank(trader);
        try pool.swapExactIn(ID, baseIn, amount, 0, trader, FOREVER) returns (uint256 out) {
            assertLe(out * 2, held, "the pool paid out more than half of what it had");
        } catch {
            // refusing an oversized trade is the correct outcome
        }
        vm.prank(trader);
        try pool.swapExactOut(ID, baseIn, amount, type(uint256).max, trader, FOREVER) {
            assertLe(amount * 2, held, "exact-out paid more than half of what it had");
        } catch {}
    }

    /*═════════ the curve is a number the holder keeps ═════════*/

    /// @dev B2. The holder's sync names the value they saw; the Reach moved
    ///      it in between; the stale sync must not land on top.
    function test_aMovedCurveRefusesTheSync() public {
        vm.prank(holder);
        pool.syncCurve(ID, 1000, 0);
        assertEq(pool.marketOf(ID).curveBps, 1000);

        // the Reach moves it
        vm.prank(reach);
        pool.syncCurve(ID, 2000, 1000);

        // the holder's transaction, built against 1000, is refused
        vm.prank(holder);
        vm.expectRevert(IPoolEvents.CurveMoved.selector);
        pool.syncCurve(ID, 500, 1000);
        assertEq(pool.marketOf(ID).curveBps, 2000, "a stale sync moved the curve");

        // and the anchors followed the sync, so the price moved
        uint256 before_ = pool.quote(ID, true, WAD);
        vm.prank(holder);
        pool.syncCurve(ID, uint24(Curve.MAX_CONCENTRATION), 2000);
        assertGt(pool.quote(ID, true, WAD), before_, "a tighter curve should quote better for the same size");

        vm.prank(holder);
        vm.expectRevert(IPoolEvents.CurveTooSteep.selector);
        pool.syncCurve(ID, uint24(Curve.MAX_CONCENTRATION + 1), uint24(Curve.MAX_CONCENTRATION));
    }

    /// @dev `acts`, not `ownerOf`: a session key feeds its token's market
    ///      through the Reach. A stranger still cannot.
    function test_theReachMayDepositIntoItsOwnMarket() public {
        Market memory before_ = pool.marketOf(ID);
        vm.prank(reach);
        pool.deposit(ID, WAD, 0);
        assertEq(uint256(pool.marketOf(ID).rBase), uint256(before_.rBase) + WAD, "the Reach's deposit did not land");

        vm.prank(reach);
        pool.setFee(ID, 10);
        assertEq(pool.marketOf(ID).feeBps, 10);

        // but only its OWN market: the Reach of #1 is nobody to #2
        vm.prank(reach);
        vm.expectRevert(IPoolEvents.NotActor.selector);
        pool.deposit(NID, WAD, 0);

        vm.prank(stranger);
        vm.expectRevert(IPoolEvents.NotActor.selector);
        pool.deposit(ID, WAD, 0);
    }

    /*═════════ the market travels with the token ═════════*/

    function test_sellingTheTokenSellsTheMarket() public {
        address buyer = address(0xB0197A);
        vm.prank(holder);
        hub.transferFrom(holder, buyer, ID);

        Market memory m = pool.marketOf(ID);
        assertGt(uint256(m.rBase), 0);
        assertGt(uint256(m.rQuote), 0);

        vm.prank(holder);
        vm.expectRevert(IPoolEvents.NotActor.selector);
        pool.withdraw(ID, 1, 0, holder);

        uint256 before_ = weth.balanceOf(buyer);
        vm.prank(buyer);
        pool.withdraw(ID, WAD, 0, buyer);
        assertEq(weth.balanceOf(buyer) - before_, WAD, "the new owner owns the inventory");
    }

    /*═════════ access and limits ═════════*/

    function test_onlyAnActorMayOpenDepositWithdrawOrSetTerms() public {
        vm.startPrank(stranger);
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.openMarket(ID, address(weth), address(usdc), 30, 0, 0, 0);
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.deposit(ID, 1, 1);
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.withdraw(ID, 1, 0, stranger);
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.setFee(ID, 10);
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.syncCurve(ID, 1, 0);
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.sealMarket(ID, T0 + 1 days);
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.closeMarket(ID);
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.writeDown(ID);
        // a token that does not exist has no actor at all
        vm.expectRevert(IPoolEvents.NotActor.selector); pool.openMarket(999, address(weth), address(usdc), 30, 0, 0, 0);
        vm.stopPrank();
    }

    function test_slippageFloorIsHonoured() public {
        vm.startPrank(trader);
        vm.expectRevert();
        pool.swapExactIn(ID, true, WAD, type(uint128).max, trader, FOREVER);

        // and the ceiling, on the other side
        uint256 need = pool.quoteExactOut(ID, true, 1000 * WAD);
        vm.expectRevert(abi.encodeWithSelector(IPoolEvents.Slippage.selector, need, need - 1));
        pool.swapExactOut(ID, true, 1000 * WAD, need - 1, trader, FOREVER);

        // exactly the quote is accepted, and exactly the quote is charged
        uint256 before_ = weth.balanceOf(trader);
        uint256 used = pool.swapExactOut(ID, true, 1000 * WAD, need, trader, FOREVER);
        assertEq(used, need);
        assertEq(before_ - weth.balanceOf(trader), need, "charged other than the quote");
        vm.stopPrank();
    }

    function test_deadlineIsHonoured() public {
        vm.startPrank(trader);
        vm.expectRevert(IPoolEvents.Expired.selector);
        pool.swapExactIn(ID, true, WAD, 0, trader, T0 - 1);
        vm.expectRevert(IPoolEvents.Expired.selector);
        pool.swapExactOut(ID, true, WAD, type(uint256).max, trader, T0 - 1);
        // the deadline is inclusive
        pool.swapExactIn(ID, true, WAD, 0, trader, T0);
        vm.stopPrank();
    }

    function test_theFeeTheCurveAndTheSniperHaveCeilings() public {
        vm.startPrank(holder);
        vm.expectRevert(IPoolEvents.FeeTooHigh.selector);
        pool.setFee(ID, 501);
        pool.setFee(ID, 500);

        uint256 id = hub.mint(holder);
        vm.expectRevert(IPoolEvents.FeeTooHigh.selector);
        pool.openMarket(id, address(weth), address(usdc), 501, 0, 0, 0);
        vm.expectRevert(IPoolEvents.CurveTooSteep.selector);
        pool.openMarket(id, address(weth), address(usdc), 30, 80_001, 0, 0);
        vm.expectRevert(IPoolEvents.SniperTooHigh.selector);
        pool.openMarket(id, address(weth), address(usdc), 30, 0, 9_001, 60);
        vm.expectRevert(IPoolEvents.SniperTooHigh.selector);
        pool.openMarket(id, address(weth), address(usdc), 30, 0, 100, 98 minutes + 1);
        vm.expectRevert(IPoolEvents.SameToken.selector);
        pool.openMarket(id, address(weth), address(weth), 30, 0, 0, 0);
        // the largest of everything is accepted
        pool.openMarket(id, address(weth), address(usdc), 500, 80_000, 9_000, 98 minutes);
        vm.expectRevert(IPoolEvents.MarketAlreadyOpen.selector);
        pool.openMarket(id, address(weth), address(usdc), 30, 0, 0, 0);
        vm.stopPrank();
    }

    function test_marketMustBeEmptyToClose() public {
        vm.startPrank(holder);
        vm.expectRevert(IPoolEvents.MarketNotEmpty.selector);
        pool.closeMarket(ID);
        Market memory m = pool.marketOf(ID);
        pool.withdraw(ID, m.rBase, 0, holder);
        vm.expectRevert(IPoolEvents.MarketNotEmpty.selector);
        pool.closeMarket(ID);
        pool.withdraw(ID, 0, m.rQuote, holder);
        pool.closeMarket(ID);
        assertFalse(pool.marketOf(ID).open);
        assertEq(pool.openCount(), 1, "the directory still lists the closed market");
        assertEq(pool.openIds(0, 10)[0], NID);
        vm.expectRevert(IPoolEvents.MarketNotOpen.selector);
        pool.deposit(ID, 1, 0);
        vm.expectRevert(IPoolEvents.MarketNotOpen.selector);
        pool.closeMarket(ID);
        vm.stopPrank();
        vm.prank(trader);
        vm.expectRevert(IPoolEvents.MarketNotOpen.selector);
        pool.swapExactIn(ID, true, WAD, 0, trader, FOREVER);
    }

    /// @dev Close, then reopen on another pair: nothing — no reserve, no
    ///      anchor, no seal, no curve — crosses from the old market to the
    ///      new one. (Kept apart from the test above on purpose: the
    ///      ethereumjs harness zeroes a frame's gas-refund counter when a
    ///      child call reverts, so an expectRevert between a slot being
    ///      cleared and the same slot being re-set trips REFUND_EXHAUSTED
    ///      in the runner, where a real node restores the counter.)
    function test_aReopenedMarketInheritsNothing() public {
        vm.prank(trader);
        pool.swapExactIn(ID, true, WAD, 0, trader, FOREVER);
        vm.startPrank(holder);
        pool.syncCurve(ID, 40_000, 0);
        pool.sealMarket(ID, T0 + 1 days);
        vm.warp(T0 + 1 days);
        Market memory m = pool.marketOf(ID);
        assertGt(m.vBase, 0, "sanity: the old market had anchors");
        pool.withdraw(ID, m.rBase, m.rQuote, holder);
        pool.closeMarket(ID);
        pool.openMarket(ID, address(usdc), address(weth), 10, 0, 0, 0);
        vm.stopPrank();
        m = pool.marketOf(ID);
        assertEq(uint256(m.rBase) + m.rQuote + m.vBase + m.vQuote + m.sealUntil + m.curveBps, 0, "a reopened market inherited something");
        assertEq(m.base, address(usdc));
        assertEq(m.feeBps, 10);
        assertEq(pool.openCount(), 2);
        assertEq(pool.totalReserved(address(weth)), 100 * WAD, "the claim did not follow the withdrawal (the native market's 100 WETH remain)");
    }

    function test_feeOnTransferTokenIsCreditedOnlyWhatArrived() public {
        MockERC20 fot = new MockERC20("FeeOnTransfer", "FOT", 18, 100, false);
        fot.mint(holder, 1e24);
        uint256 id = hub.mint(holder);

        vm.startPrank(holder);
        pool.openMarket(id, address(fot), address(usdc), 30, 0, 0, 0);
        fot.approve(address(pool), type(uint256).max);
        pool.deposit(id, 1000 * WAD, 0);
        vm.stopPrank();

        assertEq(uint256(pool.marketOf(id).rBase), 990 * WAD, "credited more than arrived");
        assertEq(pool.totalReserved(address(fot)), 990 * WAD, "the claim is not what arrived");
    }

    /// @dev A floor is about what the recipient receives. Checking the
    ///      pool's gross debit instead lets an output-side transfer tax take
    ///      the trade below the caller's explicit minimum.
    function test_feeOnTransferOutputCannotDefeatSlippageFloor() public {
        MockERC20 fot = new MockERC20("FeeOnTransfer", "FOT", 18, 100, false);
        fot.mint(holder, 1e24);
        uint256 id = hub.mint(holder);

        vm.startPrank(holder);
        pool.openMarket(id, address(weth), address(fot), 30, 0, 0, 0);
        fot.approve(address(pool), type(uint256).max);
        pool.deposit(id, 100 * WAD, 100 * WAD);
        vm.stopPrank();

        uint256 gross = pool.quote(id, true, WAD);
        vm.prank(trader);
        vm.expectRevert();
        pool.swapExactIn(id, true, WAD, gross, trader, FOREVER);

        uint256 before_ = fot.balanceOf(trader);
        vm.prank(trader);
        uint256 received = pool.swapExactIn(id, true, WAD, gross * 99 / 100, trader, FOREVER);
        assertEq(received, fot.balanceOf(trader) - before_, "return was not net output");
        assertLt(received, gross, "the transfer tax was not observed");

        // exact-out means exact at the recipient: a taxed output cannot be exact
        vm.prank(trader);
        vm.expectRevert();
        pool.swapExactOut(id, true, WAD, type(uint256).max, trader, FOREVER);
    }

    function test_silentTokenIsAccepted() public {
        MockERC20 usdt = new MockERC20("Tether", "USDT", 6, 0, true);
        usdt.mint(holder, 1e12);
        uint256 id = hub.mint(holder);

        vm.startPrank(holder);
        pool.openMarket(id, address(usdt), address(usdc), 30, 0, 0, 0);
        usdt.approve(address(pool), type(uint256).max);
        pool.deposit(id, 1e9, 0);
        vm.stopPrank();

        assertEq(uint256(pool.marketOf(id).rBase), 1e9, "a token that returns nothing was rejected");
    }

    function test_aTradeLargerThanHalfTheReserveIsRefused() public {
        Market memory m = pool.marketOf(ID);
        vm.startPrank(trader);
        vm.expectRevert(IPoolEvents.TradeTooLarge.selector);
        pool.swapExactIn(ID, true, 1000 * WAD, 0, trader, FOREVER);          // would take > 90 % of the quote
        vm.expectRevert(IPoolEvents.TradeTooLarge.selector);
        pool.swapExactOut(ID, true, uint256(m.rQuote) / 2 + 1, type(uint256).max, trader, FOREVER);
        // exactly half is the largest trade there is
        pool.swapExactOut(ID, true, uint256(m.rQuote) / 2, type(uint256).max, trader, FOREVER);
        vm.stopPrank();
    }

    function test_theReserveHasACeiling() public {
        MockERC20 big = new MockERC20("Big", "BIG", 18, 0, false);
        uint256 id = hub.mint(holder);
        big.mint(holder, 2 ** 113);
        vm.startPrank(holder);
        big.approve(address(pool), type(uint256).max);
        pool.openMarket(id, address(big), address(usdc), 30, 0, 0, 0);
        vm.expectRevert(IPoolEvents.ReserveOverflow.selector);
        pool.deposit(id, 2 ** 112, 0);
        pool.deposit(id, 2 ** 112 - 1, 0);
        vm.expectRevert(IPoolEvents.ReserveOverflow.selector);
        pool.deposit(id, 1, 0);
        vm.stopPrank();
    }

    /*═════════ the seal ═════════*/

    /// @dev "Selling the token sells the market" is mechanically true the
    ///      moment ownerOf changes, and worth nothing to a buyer on its own:
    ///      the seller can empty it between the handshake and the settlement.
    ///      The seal is what turns it into a promise, and the only property
    ///      that makes a promise worth reading is that it cannot be walked
    ///      back.
    function testFuzz_sealOnlyRatchets(uint64 a, uint64 b) public {
        a = uint64(bound(a, T0 + 1, T0 + 300 days));
        b = uint64(bound(b, T0 + 1, T0 + 300 days));

        vm.prank(holder);
        pool.sealMarket(ID, a);
        assertEq(pool.marketOf(ID).sealUntil, a);

        vm.prank(holder);
        if (b > a) {
            pool.sealMarket(ID, b);
            assertEq(pool.marketOf(ID).sealUntil, b);
        } else {
            vm.expectRevert(IPoolEvents.RatchetOnly.selector);
            pool.sealMarket(ID, b);
            assertEq(pool.marketOf(ID).sealUntil, a, "the ratchet turned backwards");
        }
    }

    function test_sealFreezesEveryExitAndEveryTerm() public {
        uint64 until = T0 + 30 days;
        vm.startPrank(holder);
        pool.sealMarket(ID, until);

        vm.expectRevert(abi.encodeWithSelector(IPoolEvents.Sealed.selector, until));
        pool.withdraw(ID, 1, 0, holder);
        vm.expectRevert(abi.encodeWithSelector(IPoolEvents.Sealed.selector, until));
        pool.closeMarket(ID);
        vm.expectRevert(abi.encodeWithSelector(IPoolEvents.Sealed.selector, until));
        pool.setFee(ID, 100);
        vm.expectRevert(abi.encodeWithSelector(IPoolEvents.Sealed.selector, until));
        pool.syncCurve(ID, 1000, 0);

        // additive operations must survive, or a sealed market cannot be fed —
        // and the curve does not follow the deposit (IPSEITY invariant 56)
        Market memory before_ = pool.marketOf(ID);
        pool.deposit(ID, WAD, 0);
        Market memory after_ = pool.marketOf(ID);
        assertEq(after_.vBase, before_.vBase, "a deposit re-anchored a sealed curve");
        assertEq(uint256(after_.rBase), uint256(before_.rBase) + WAD);
        vm.stopPrank();

        vm.prank(trader);
        pool.swapExactIn(ID, true, WAD / 100, 0, trader, FOREVER);
    }

    function test_sealSurvivesTheSaleAndBindsTheBuyer() public {
        address buyer = address(0xB0197A);
        uint64 until = T0 + 30 days;

        vm.startPrank(holder);
        pool.sealMarket(ID, until);
        hub.transferFrom(holder, buyer, ID);
        vm.stopPrank();

        assertEq(pool.marketOf(ID).sealUntil, until, "the seal did not survive the sale");
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(IPoolEvents.Sealed.selector, until));
        pool.withdraw(ID, 1, 0, buyer);
    }

    function test_sealExpiresAndReleases() public {
        uint64 until = T0 + 30 days;
        vm.prank(holder);
        pool.sealMarket(ID, until);

        // the last second of the promise
        vm.warp(until - 1);
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(IPoolEvents.Sealed.selector, until));
        pool.withdraw(ID, WAD, 0, holder);

        // Ratchet.live is `until > now`: at `until` the seal has released
        vm.warp(until);
        vm.prank(holder);
        pool.withdraw(ID, WAD, 0, holder);
    }

    function test_sealHasACeiling() public {
        vm.startPrank(holder);
        vm.expectRevert(IPoolEvents.TooLong.selector);
        pool.sealMarket(ID, T0 + 365 days + 1);
        vm.expectRevert(IPoolEvents.RatchetOnly.selector);
        pool.sealMarket(ID, T0);
        pool.sealMarket(ID, T0 + 365 days);
        vm.stopPrank();
    }

    /*═════════ privilege ═════════*/

    /// @dev There is no switch. Withdrawal is reachable in every state this
    ///      contract can be put in — after trades, after a sync, after a
    ///      sale, during a sniper window, with a seal expired — because no
    ///      function exists that could close it. tools/verify-pool.mjs
    ///      proves the absence against the ABI; this proves the presence.
    function test_withdrawCannotBePaused() public {
        vm.prank(trader);
        pool.swapExactIn(ID, true, WAD, 0, trader, FOREVER);
        _sync(ID, 40_000);
        vm.prank(holder);
        pool.sealMarket(ID, T0 + 1 days);
        vm.warp(T0 + 1 days + 1);

        uint256 before_ = weth.balanceOf(holder);
        vm.prank(holder);
        pool.withdraw(ID, WAD, 0, holder);
        assertEq(weth.balanceOf(holder) - before_, WAD);

        // a sniper window is a fee, not a lock
        uint256 id = hub.mint(holder);
        vm.startPrank(holder);
        pool.openMarket(id, address(weth), address(usdc), 30, 0, 9000, 98 minutes);
        pool.deposit(id, WAD, WAD);
        pool.withdraw(id, WAD, WAD, holder);
        vm.stopPrank();

        // after a sale, the buyer
        address buyer = address(0xB0197A);
        vm.prank(holder);
        hub.transferFrom(holder, buyer, ID);
        vm.prank(buyer);
        pool.withdraw(ID, WAD, 0, buyer);
        assertEq(weth.balanceOf(buyer), WAD);
    }

    /*═════════ the sniper fee ═════════*/

    function test_theSniperFeeDecaysToTheBaseFee() public {
        uint256 id = hub.mint(holder);
        vm.startPrank(holder);
        pool.openMarket(id, address(weth), address(usdc), 30, 0, 5000, 1000);
        pool.deposit(id, 100 * WAD, 300_000 * WAD);
        vm.stopPrank();

        uint256 atOpen = pool.quote(id, true, WAD);
        uint256 plain = pool.quote(ID, true, WAD);     // the same reserves, no sniper
        assertLt(atOpen, plain, "the sniper fee was not charged at open");

        vm.warp(T0 + 500);
        uint256 half = pool.quote(id, true, WAD);
        assertGt(half, atOpen, "the fee did not decay");
        assertLt(half, plain, "the fee decayed too fast");

        vm.warp(T0 + 1000);
        assertEq(pool.quote(id, true, WAD), plain, "the fee did not reach the base fee at the window's end");

        // and the surcharge is what the trader actually paid
        vm.warp(T0);
        vm.prank(trader);
        uint256 out = pool.swapExactIn(id, true, WAD, 0, trader, FOREVER);
        assertEq(out, atOpen);
    }

    function test_theSniperFeeCannotBeReArmedByADeposit() public {
        uint256 id = hub.mint(holder);
        vm.startPrank(holder);
        pool.openMarket(id, address(weth), address(usdc), 30, 0, 5000, 600);
        pool.deposit(id, 100 * WAD, 300_000 * WAD);
        vm.stopPrank();
        Market memory armed = pool.marketOf(id);
        assertEq(armed.sniperUntil, T0 + 600);

        vm.warp(T0 + 601);
        uint256 plain = pool.quote(id, true, WAD);

        vm.prank(holder);
        pool.deposit(id, 10 * WAD, 30_000 * WAD);
        Market memory after_ = pool.marketOf(id);
        assertEq(after_.sniperUntil, armed.sniperUntil, "a deposit moved the sniper window");
        assertEq(after_.sniperBps, armed.sniperBps);
        // the quote at the new reserves carries no surcharge: compare against
        // a sibling market opened without one at the same reserves
        uint256 sib = hub.mint(holder);
        vm.startPrank(holder);
        pool.openMarket(sib, address(weth), address(usdc), 30, 0, 0, 0);
        pool.deposit(sib, 110 * WAD, 330_000 * WAD);
        vm.stopPrank();
        assertEq(pool.quote(id, true, WAD), pool.quote(sib, true, WAD), "the deposit re-armed the sniper fee");
        assertGt(pool.quote(id, true, WAD), plain * 99 / 100, "sanity: deeper reserves quote no worse");
    }

    /*═════════ native legs ═════════*/

    function test_aNativeLegMustEqualTheValueSent() public {
        vm.startPrank(holder);
        vm.expectRevert(IPoolEvents.WrongValue.selector);
        pool.deposit{value: 1 ether}(NID, WAD, 2 ether);
        vm.expectRevert(IPoolEvents.WrongValue.selector);
        pool.deposit{value: 1 ether}(NID, WAD, 0);
        // an ERC-20 pair takes no value at all
        vm.expectRevert(IPoolEvents.WrongValue.selector);
        pool.deposit{value: 1}(ID, WAD, 0);
        vm.stopPrank();

        vm.startPrank(trader);
        vm.expectRevert(IPoolEvents.WrongValue.selector);
        pool.swapExactIn{value: 1 ether - 1}(NID, false, 1 ether, 0, trader, FOREVER);
        vm.expectRevert(IPoolEvents.WrongValue.selector);
        pool.swapExactIn{value: 1}(NID, true, WAD, 0, trader, FOREVER);
        vm.expectRevert(IPoolEvents.WrongValue.selector);
        pool.swapExactOut{value: 1 ether - 1}(NID, false, WAD / 2, 1 ether, trader, FOREVER);
        vm.expectRevert(IPoolEvents.WrongValue.selector);
        pool.swapExactIn{value: 1}(ID, true, WAD, 0, trader, FOREVER);
        vm.stopPrank();
    }

    function test_aNativeMarketTradesBothWaysAndRefundsExactOut() public {
        // ETH in, WETH out
        uint256 q = pool.quote(NID, false, 1 ether);
        uint256 w0 = weth.balanceOf(trader);
        uint256 e0 = trader.balance;
        vm.prank(trader);
        uint256 out = pool.swapExactIn{value: 1 ether}(NID, false, 1 ether, q, trader, FOREVER);
        assertEq(out, q);
        assertEq(weth.balanceOf(trader) - w0, q);
        assertEq(e0 - trader.balance, 1 ether);
        assertEq(pool.totalReserved(address(0)), 101 ether, "the native claim did not follow the trade");

        // WETH in, ETH out: the pool pays ether
        uint256 q2 = pool.quote(NID, true, WAD);
        e0 = trader.balance;
        vm.prank(trader);
        pool.swapExactIn(NID, true, WAD, q2, trader, FOREVER);
        assertEq(trader.balance - e0, q2, "the native output did not arrive");

        // exact-out with a native input: send maxIn, get the change back
        uint256 need = pool.quoteExactOut(NID, false, WAD / 2);
        e0 = trader.balance;
        vm.prank(trader);
        uint256 used = pool.swapExactOut{value: 2 ether}(NID, false, WAD / 2, 2 ether, trader, FOREVER);
        assertEq(used, need);
        assertEq(e0 - trader.balance, need, "the unspent value was not returned");
        assertEq(address(pool).balance, pool.totalReserved(address(0)), "the pool kept more ether than its books");

        // and the holder takes ether out
        e0 = holder.balance;
        vm.prank(holder);
        pool.withdraw(NID, 0, 1 ether, holder);
        assertEq(holder.balance - e0, 1 ether);
    }

    /*═════════ sealed markets ═════════*/

    function _graduate(uint256 beneficiary, uint256 coinAmount, uint256 raised) internal returns (uint256 key, MockERC20 coin) {
        coin = new MockERC20("Coin", "COIN", 18, 0, false);
        coin.mint(launchpad, coinAmount);
        vm.deal(launchpad, raised);
        vm.startPrank(launchpad);
        coin.approve(address(pool), coinAmount);
        key = pool.openSealed{value: raised}(keccak256("launch-1"), address(coin), address(0), 100, coinAmount, beneficiary);
        vm.stopPrank();
    }

    function test_onlyTheLaunchpadMayOpenASealedMarket() public {
        MockERC20 coin = new MockERC20("Coin", "COIN", 18, 0, false);
        coin.mint(holder, 1e24);
        vm.startPrank(holder);
        coin.approve(address(pool), type(uint256).max);
        vm.expectRevert(IPoolEvents.NotLaunchpad.selector);
        pool.openSealed{value: 1 ether}(keccak256("x"), address(coin), address(0), 100, 1e24, ID);
        vm.stopPrank();

        // the launchpad, but with the wrong shape
        coin.mint(launchpad, 1e24);
        vm.deal(launchpad, 10 ether);
        vm.startPrank(launchpad);
        coin.approve(address(pool), type(uint256).max);
        vm.expectRevert(IPoolEvents.WrongValue.selector);
        pool.openSealed{value: 1 ether}(keccak256("x"), address(coin), address(usdc), 100, 1e24, ID);
        vm.expectRevert(IPoolEvents.ZeroAmount.selector);
        pool.openSealed(keccak256("x"), address(coin), address(0), 100, 1e24, ID);
        vm.expectRevert(IPoolEvents.FeeTooHigh.selector);
        pool.openSealed{value: 1 ether}(keccak256("x"), address(coin), address(0), 501, 1e24, ID);
        uint256 key = pool.openSealed{value: 1 ether}(keccak256("x"), address(coin), address(0), 100, 1e24, ID);
        assertEq(key, pool.sealedKey(keccak256("x")));
        vm.expectRevert(IPoolEvents.MarketAlreadyOpen.selector);
        pool.openSealed{value: 1 ether}(keccak256("x"), address(coin), address(0), 100, 1e24, ID);
        vm.stopPrank();

        Market memory m = pool.marketOf(key);
        assertTrue(m.open && m.sealedMarket);
        assertEq(m.beneficiary, ID);
        assertEq(uint256(m.rBase), 1e24);
        assertEq(uint256(m.rQuote), 1 ether);
        assertEq(pool.spot(key), 1 ether * 1e18 / 1e24, "the opening price is not the terminal price");
    }

    function test_aSealedMarketNeverWithdrawsPrincipal() public {
        (uint256 key, ) = _graduate(ID, 1e24, 10 ether);
        // the beneficiary's holder, its Reach, the launchpad and a stranger:
        // nobody has LP authority over graduation liquidity
        address[4] memory who = [holder, reach, launchpad, stranger];
        for (uint256 i; i < who.length; ++i) {
            vm.startPrank(who[i]);
            vm.expectRevert(IPoolEvents.SealedMarket.selector); pool.withdraw(key, 1, 0, who[i]);
            vm.expectRevert(IPoolEvents.SealedMarket.selector); pool.closeMarket(key);
            vm.expectRevert(IPoolEvents.SealedMarket.selector); pool.setFee(key, 0);
            vm.expectRevert(IPoolEvents.SealedMarket.selector); pool.syncCurve(key, 1000, 0);
            vm.expectRevert(IPoolEvents.SealedMarket.selector); pool.sealMarket(key, T0 + 1 days);
            vm.expectRevert(IPoolEvents.SealedMarket.selector); pool.deposit(key, 1, 0);
            vm.expectRevert(IPoolEvents.SealedMarket.selector); pool.writeDown(key);
            vm.stopPrank();
        }
        // the directories keep them apart
        assertEq(pool.sealedCount(), 1);
        assertEq(pool.sealedIds(0, 10)[0], key);
        uint256[] memory owned = pool.openIds(0, 10);
        for (uint256 i; i < owned.length; ++i) assertTrue(owned[i] != key, "a sealed market in the owned directory");
        // and trading is open to anyone
        vm.prank(trader);
        pool.swapExactIn{value: 1 ether}(key, false, 1 ether, 0, trader, FOREVER);
    }

    /// @dev Reserves plus fees owed plus what was collected equals what
    ///      ever came in: nothing is minted and nothing is lost on the way
    ///      to the feeSink, and the principal is untouched by a collect.
    function test_collectConservesValue() public {
        uint256 poolEth0 = address(pool).balance;          // the native market's ether, not this test's
        (uint256 key, MockERC20 coin) = _graduate(ID, 1e24, 10 ether);
        uint256 ethIn = 10 ether;
        uint256 coinIn = 1e24;

        vm.startPrank(trader);
        coin.approve(address(pool), type(uint256).max);
        uint256 got = pool.swapExactIn{value: 1 ether}(key, false, 1 ether, 0, trader, FOREVER);
        ethIn += 1 ether;
        pool.swapExactIn(key, true, got / 2, 0, trader, FOREVER);
        coinIn += got / 2;
        uint256 paid = pool.swapExactOut{value: 1 ether}(key, false, got / 4, 1 ether, trader, FOREVER);
        ethIn += paid;
        vm.stopPrank();
        // what left: every quote/coin output to the trader
        uint256 ethOut = poolEth0 + ethIn - address(pool).balance;
        uint256 coinOut = coinIn - coin.balanceOf(address(pool));

        Market memory m = pool.marketOf(key);
        assertGt(uint256(m.feeQuoteOwed), 0, "no quote fee accrued");
        assertGt(uint256(m.feeBaseOwed), 0, "no base fee accrued");
        assertEq(uint256(m.rQuote) + m.feeQuoteOwed + ethOut, ethIn, "ether was created or lost");
        assertEq(uint256(m.rBase) + m.feeBaseOwed + coinOut, coinIn, "coin was created or lost");
        assertEq(pool.totalReserved(address(0)), poolEth0 + m.rQuote + m.feeQuoteOwed, "the native claim excludes the fee owed");

        // anyone collects; the beneficiary's feeSink is paid exactly the owed
        address sink = hub.feeSink(ID);
        uint256 e0 = sink.balance;
        uint256 c0 = coin.balanceOf(sink);
        vm.prank(stranger);
        pool.collect(key);
        assertEq(sink.balance - e0, m.feeQuoteOwed);
        assertEq(coin.balanceOf(sink) - c0, m.feeBaseOwed);

        Market memory after_ = pool.marketOf(key);
        assertEq(after_.feeQuoteOwed + after_.feeBaseOwed, 0, "owed was not zeroed");
        assertEq(after_.rQuote, m.rQuote, "a collect touched the principal");
        assertEq(after_.rBase, m.rBase, "a collect touched the principal");
        assertEq(address(pool).balance, pool.totalReserved(address(0)), "the books and the balance disagree after collect");
        assertEq(pool.totalReserved(address(0)), poolEth0 + after_.rQuote, "the native claim is the two markets' reserves and nothing else");

        vm.expectRevert(IPoolEvents.ZeroAmount.selector);
        pool.collect(key);
        // an owned market has nothing to collect: its fees are its reserves
        vm.expectRevert(IPoolEvents.ZeroAmount.selector);
        pool.collect(ID);
    }

    function test_collectPaysTheGripWhenTheBitIsSet() public {
        (uint256 key, ) = _graduate(ID, 1e24, 10 ether);
        vm.prank(trader);
        pool.swapExactIn{value: 1 ether}(key, false, 1 ether, 0, trader, FOREVER);

        address grip = hub.grip(ID);
        address reach_ = hub.account(ID);
        uint256 owed = pool.marketOf(key).feeQuoteOwed;
        uint256 g0 = grip.balance;
        uint256 r0 = reach_.balance;

        hub.setFeesToGrip(ID, true);
        pool.collect(key);
        assertEq(grip.balance - g0, owed, "the Grip was not paid");
        assertEq(reach_.balance, r0, "the Reach was paid with the bit set");

        // the bit cleared: the next stream goes to the Reach
        vm.prank(trader);
        pool.swapExactIn{value: 1 ether}(key, false, 1 ether, 0, trader, FOREVER);
        owed = pool.marketOf(key).feeQuoteOwed;
        hub.setFeesToGrip(ID, false);
        pool.collect(key);
        assertEq(reach_.balance - r0, owed, "the Reach was not paid");
        assertEq(grip.balance - g0, pool.marketOf(key).feeQuoteOwed + (grip.balance - g0), "sanity");

        // selling the Intact sells the stream: the sink follows the token
        address buyer = address(0xB0197A);
        vm.prank(holder);
        hub.transferFrom(holder, buyer, ID);
        assertEq(hub.feeSink(ID), reach_, "the Reach is the token's, not the holder's");
    }

    /*═════════ the fingerprint ═════════*/

    function test_theMarketHashMovesWithEveryTerm() public {
        bytes32 h0 = pool.marketHash(ID);
        vm.prank(trader);
        pool.swapExactIn(ID, true, WAD, 0, trader, FOREVER);
        bytes32 h1 = pool.marketHash(ID);
        assertTrue(h1 != h0, "a trade did not move the hash");
        vm.prank(holder);
        pool.setFee(ID, 31);
        bytes32 h2 = pool.marketHash(ID);
        assertTrue(h2 != h1, "a fee did not move the hash");
        _sync(ID, 1000);
        bytes32 h3 = pool.marketHash(ID);
        assertTrue(h3 != h2, "a sync did not move the hash");
        vm.prank(holder);
        pool.sealMarket(ID, T0 + 1 days);
        assertTrue(pool.marketHash(ID) != h3, "a seal did not move the hash");
        assertEq(pool.marketHash(999), pool.marketHash(998), "two markets that do not exist hash differently");
    }

    /*═════════ the maths on its own ═════════*/

    /// @dev More in must never mean less out, at any curve.
    function testFuzz_outputIsMonotonicInInput(uint256 a, uint256 b, uint24 bps, uint16 fee) public pure {
        uint256 rIn = 1000 * 1e18;
        uint256 rOut = 3_000_000 * 1e18;
        a = bound(a, 1e6, rIn / 4);
        b = bound(b, a, rIn / 3);
        bps = uint24(bound(bps, 0, Curve.MAX_CONCENTRATION));
        fee = uint16(bound(fee, 0, 9500));
        (uint256 vIn, uint256 vOut) = Curve.anchor(bps, rIn, rOut);
        assertLe(
            Curve.amountOut(a, rIn, rOut, vIn, vOut, fee),
            Curve.amountOut(b, rIn, rOut, vIn, vOut, fee),
            "a larger trade got less out"
        );
    }

    /// @dev The output must always be strictly under the priced reserve, or
    ///      the arithmetic itself is unsound before any guard is applied.
    function testFuzz_outputStaysUnderThePricedReserve(uint256 amount, uint24 bps) public pure {
        uint256 rIn = 1000 * 1e18;
        uint256 rOut = 3_000_000 * 1e18;
        amount = bound(amount, 1, 1e30);
        bps = uint24(bound(bps, 0, Curve.MAX_CONCENTRATION));
        (uint256 vIn, uint256 vOut) = Curve.anchor(bps, rIn, rOut);
        assertLt(Curve.amountOut(amount, rIn, rOut, vIn, vOut, 30), rOut + vOut);
    }

    /// @dev amountIn is the inverse of amountOut and never under-charges:
    ///      the input it names buys at least the output asked, and no input
    ///      smaller than what a straight swap spent could have bought what
    ///      that swap got. Reserves from 1 wei to 2^112.
    function testFuzz_exactOutIsTheInverseOfExactIn(uint256 x, uint256 rIn, uint256 rOut, uint24 bps, uint16 fee, uint8 tier) public pure {
        uint256[6] memory tiers = [uint256(1), 2, 9, 2 ** 64, 2 ** 112 - 1, 0];
        rIn = tier % 6 == 5 ? bound(rIn, 1, 2 ** 112 - 1) : tiers[tier % 6];
        rOut = (tier / 6) % 6 == 5 ? bound(rOut, 1, 2 ** 112 - 1) : tiers[(tier / 6) % 6];
        bps = uint24(bound(bps, 0, Curve.MAX_CONCENTRATION));
        fee = uint16(bound(fee, 0, 9500));
        x = bound(x, 1, rIn);
        (uint256 vIn, uint256 vOut) = Curve.anchor(bps, rIn, rOut);

        uint256 out = Curve.amountOut(x, rIn, rOut, vIn, vOut, fee);
        if (out == 0) return;
        uint256 back = Curve.amountIn(out, rIn, rOut, vIn, vOut, fee);
        assertLe(back, x, "exact-out charges more than the swap that produced this output");
        assertGe(Curve.amountOut(back, rIn, rOut, vIn, vOut, fee), out, "the inverse input buys less than it names");
    }

    function test_theAnchorIsBounded() public pure {
        (uint256 vb, uint256 vq) = Curve.anchor(Curve.MAX_CONCENTRATION, 2 ** 112 - 1, 1);
        assertEq(vb, (2 ** 112 - 1) * 8);
        assertEq(vq, 8, "one wei at 8x anchors to eight");
        assertLt(vb, 2 ** 128);
        (vb, vq) = Curve.anchor(5, 1, 1999);
        assertEq(vb, 0, "a fraction of a wei anchors to nothing, rounding down");
        assertEq(vq, 0, "1999 x 5 / 10000 is under one wei");
        (vb, vq) = Curve.anchor(0, 2 ** 112 - 1, 2 ** 112 - 1);
        assertEq(vb + vq, 0, "concentration zero is plain constant product");
    }
}
