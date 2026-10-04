// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Pool} from "../src/Pool.sol";
import {IPoolEvents, Market} from "../src/interfaces/IPool.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {PoolHub} from "./mocks/PoolFixtures.sol";
import {PoolReenter} from "./mocks/PoolReenter.sol";
import {SyncInsidePull} from "./mocks/SyncInsidePull.sol";
import {RebasingToken} from "./mocks/RebasingToken.sol";
import {HostileToken} from "./mocks/HostileToken.sol";

/*───────────────────────────────────────────────────────────────────────────
  The Pool against hostile tokens: the C1, C2 and C5 regressions.

  Each of these is a finding from the IPSEITY reading
  (research/research/ipseity-market-launchpad.md §13) or from design B's
  review, replayed against INTACT's Pool with the mock the finding named.
  tools/poc-pool.mjs — the nine-line proof of concept IPSEITY committed
  and never ran — is finished here as the first test. Every test is
  written to fail on the old code: the inner call that the old guard let
  through is asserted refused, and the state the old code corrupted is
  asserted intact.
───────────────────────────────────────────────────────────────────────────*/
contract PoolReenterTest is Test {
    PoolHub   hub;
    Pool      pool;
    MockERC20 usdc;
    MockERC20 weth;

    address holder    = address(0xB0B1);
    address other     = address(0x0C0C);
    address trader    = address(0x7EAD);
    address launchpad = address(0x1A0C);

    uint256 constant WAD = 1e18;
    uint64  constant FOREVER = 4102444800;
    uint64  constant T0 = 1_733_000_000;

    function setUp() public {
        vm.warp(T0);
        hub = new PoolHub();
        pool = new Pool(address(hub), launchpad);
        usdc = new MockERC20("USD Coin", "USDC", 18, 0, false);
        weth = new MockERC20("Wrapped Ether", "WETH", 18, 0, false);
        usdc.mint(holder, 1e24);
        usdc.mint(other, 1e24);
        usdc.mint(trader, 1e24);
        weth.mint(holder, 1e24);
        weth.mint(trader, 1e24);
        vm.deal(holder, 100 ether);
        vm.deal(trader, 100 ether);
        vm.startPrank(holder);
        usdc.approve(address(pool), type(uint256).max);
        weth.approve(address(pool), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(other);
        usdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(trader);
        usdc.approve(address(pool), type(uint256).max);
        weth.approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    /*═════════ C1 ═════════*/

    /// @dev IPSEITY's PoolReenter: a holder that is also a hostile ERC-20.
    ///      Old code: deposit (guarded) pulls the token; the token's
    ///      transferFrom re-enters closeMarket (unguarded: holder, unbonded,
    ///      reserves still zero), which deletes the market; deposit then
    ///      writes the reserve into the closed struct; openMarket on a new
    ///      pair inherits it; withdraw pays out another market's inventory.
    ///      New code: step two's inner call reverts Reentrancy, the market
    ///      stays open with its reserve, and the reopen is refused.
    function test_aMarketCannotBeReopenedOverAPhantomReserve() public {
        // an honest market on USDC, the inventory the old attack drained
        uint256 victim = hub.mint(other);
        vm.startPrank(other);
        pool.openMarket(victim, address(weth), address(usdc), 30, 0, 0, 0);
        weth.mint(other, 1e24);
        weth.approve(address(pool), type(uint256).max);
        pool.deposit(victim, 10 * WAD, 30_000 * WAD);
        vm.stopPrank();

        PoolReenter mali = new PoolReenter();
        uint256 id = hub.mint(address(mali));
        mali.wire(address(pool), id);

        mali.step1_open(address(mali), address(usdc));
        assertTrue(pool.marketOf(id).open);

        // step 2: deposit, and from inside the pull, close
        mali.step2_depositAndClose(1000 * WAD);
        assertFalse(mali.reentrySucceeded(), "closeMarket was re-entered from inside deposit's pull");
        assertFalse(mali.armed(), "the mock did not fire - the test proves nothing");

        Market memory m = pool.marketOf(id);
        assertTrue(m.open, "the market was closed under the holder's own deposit");
        assertEq(uint256(m.rBase), 1000 * WAD, "the deposit did not land");
        assertEq(pool.totalReserved(address(mali)), 1000 * WAD);

        // step 3: the reopen on the pair with the real inventory is refused
        vm.expectRevert(IPoolEvents.MarketAlreadyOpen.selector);
        mali.step3_reopen(address(usdc), address(weth));

        // step 4: nothing to drain. The market's base is the mock's own token,
        // it holds exactly what was deposited, and its quote reserve is zero
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        mali.step4_drain(1000 * WAD + 1, address(mali));
        vm.prank(address(mali));
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.withdraw(id, 0, 1, address(mali));
        assertEq(usdc.balanceOf(address(mali)), 0, "the attacker holds somebody's USDC");
        assertEq(usdc.balanceOf(address(pool)), 30_000 * WAD, "the victim's inventory moved");

        // and the honest route — withdraw everything, close, reopen — carries
        // nothing across: the struct is cleared whole before it is rewritten
        vm.prank(address(mali));
        pool.withdraw(id, 1000 * WAD, 0, address(mali));
        vm.prank(address(mali));
        pool.closeMarket(id);
        mali.step3_reopen(address(usdc), address(weth));
        m = pool.marketOf(id);
        assertEq(uint256(m.rBase) + m.rQuote, 0, "a reopened market inherited a reserve");
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        mali.step4_drain(1, address(mali));
    }

    /*═════════ C2 ═════════*/

    /// @dev The pull is a window. IPSEITY read vIn/vOut after `_pull`, so a
    ///      token that calls out during transferFrom let the one actor
    ///      allowed to move the curve flatten it mid-trade. Here the token is
    ///      pinned as the id's Reach — so it IS allowed to sync, and only the
    ///      lock refuses it. The reserves and offsets were also read before
    ///      the pull, so even a sync that landed would price nothing.
    function test_aSyncInsideThePullReverts() public {
        SyncInsidePull tok = new SyncInsidePull();
        uint256 id = hub.mint(holder);
        hub.setAccount(id, address(tok));                  // the token acts as the Reach
        tok.mint(holder, 1e24);
        tok.mint(trader, 1e24);

        vm.startPrank(holder);
        tok.approve(address(pool), type(uint256).max);
        pool.openMarket(id, address(tok), address(usdc), 30, 40_000, 0, 0);
        pool.deposit(id, 100 * WAD, 300_000 * WAD);
        vm.stopPrank();

        // outside a trade the token's sync is accepted: it is the Reach
        vm.prank(address(tok));
        pool.syncCurve(id, 40_000, 40_000);

        uint256 quoted = pool.quote(id, true, WAD);
        Market memory before_ = pool.marketOf(id);

        tok.arm(address(pool), id, 40_000);                // sync to 0 from inside the pull
        vm.startPrank(trader);
        tok.approve(address(pool), type(uint256).max);
        uint256 out = pool.swapExactIn(id, true, WAD, 0, trader, FOREVER);
        vm.stopPrank();

        assertFalse(tok.armed(), "the mock did not fire - the test proves nothing");
        assertFalse(tok.syncSucceeded(), "syncCurve ran inside the pull");
        assertEq(tok.lastRevert(), abi.encodeWithSelector(IPoolEvents.Reentrancy.selector), "refused for another reason than the lock");
        assertEq(out, quoted, "the trade was priced on a curve other than the one quoted");

        Market memory after_ = pool.marketOf(id);
        assertEq(after_.curveBps, before_.curveBps, "the curve moved during a trade");
        assertEq(after_.vBase, before_.vBase, "the anchors moved during a trade");
        assertEq(after_.vQuote, before_.vQuote, "the anchors moved during a trade");
    }

    /// @dev The one lock is on every door, not only the three IPSEITY
    ///      guarded. A hostile token re-enters each state-changing selector
    ///      from inside a swap's pull, as the id's own Reach so that
    ///      authority is not what refuses it; afterwards every term and
    ///      every reserve is what it was.
    function test_theOneLockHoldsEveryDoor() public {
        for (uint256 i; i < 11; ++i) {
            // a fresh hostile token and market per door: the mock fires once
            HostileToken tok = new HostileToken();
            uint256 id = hub.mint(holder);
            uint256 spare = hub.mint(holder);
            hub.setAccount(id, address(tok));
            hub.setAccount(spare, address(tok));
            tok.mint(holder, 1e24);
            tok.mint(trader, 1e24);
            usdc.mint(holder, 300_000 * WAD);
            vm.startPrank(holder);
            tok.approve(address(pool), type(uint256).max);
            pool.openMarket(id, address(tok), address(usdc), 30, 1000, 0, 0);
            pool.deposit(id, 100 * WAD, 300_000 * WAD);
            vm.stopPrank();
            vm.prank(trader);
            tok.approve(address(pool), type(uint256).max);

            bytes memory door =
                i == 0 ? abi.encodeCall(pool.openMarket, (spare, address(tok), address(usdc), 0, 0, 0, 0)) :
                i == 1 ? abi.encodeCall(pool.deposit, (id, 1, 0)) :
                i == 2 ? abi.encodeCall(pool.withdraw, (id, 1, 0, address(tok))) :
                i == 3 ? abi.encodeCall(pool.closeMarket, (id)) :
                i == 4 ? abi.encodeCall(pool.swapExactIn, (id, true, 1, 0, address(tok), FOREVER)) :
                i == 5 ? abi.encodeCall(pool.swapExactOut, (id, true, 1, 1e30, address(tok), FOREVER)) :
                i == 6 ? abi.encodeCall(pool.syncCurve, (id, 0, 1000)) :
                i == 7 ? abi.encodeCall(pool.setFee, (id, 0)) :
                i == 8 ? abi.encodeCall(pool.sealMarket, (id, T0 + 1 days)) :
                i == 9 ? abi.encodeCall(pool.writeDown, (id)) :
                         abi.encodeCall(pool.collect, (id));

            Market memory before_ = pool.marketOf(id);
            uint256 claimBefore = pool.totalReserved(address(tok));
            tok.arm(address(pool), door);
            vm.prank(trader);
            uint256 out = pool.swapExactIn(id, true, WAD, 0, trader, FOREVER);
            assertTrue(tok.reentered(), "the mock did not fire");
            assertGt(out, 0);
            Market memory after_ = pool.marketOf(id);
            assertEq(after_.feeBps, before_.feeBps, "a door opened: setFee");
            assertEq(after_.curveBps, before_.curveBps, "a door opened: syncCurve");
            assertEq(after_.sealUntil, before_.sealUntil, "a door opened: sealMarket");
            assertEq(after_.vBase, before_.vBase, "a door opened: an anchor moved");
            assertTrue(after_.open, "a door opened: closeMarket");
            assertEq(uint256(after_.rBase), uint256(before_.rBase) + WAD, "a door opened: a reserve moved by other than the trade");
            assertEq(uint256(after_.rQuote), uint256(before_.rQuote) - out, "a door opened: a reserve moved by other than the trade");
            assertEq(pool.totalReserved(address(tok)), claimBefore + WAD, "a door opened: the claim moved");
            assertFalse(pool.marketOf(spare).open, "a door opened: openMarket");
        }
    }

    /*═════════ C5 ═════════*/

    /// @dev Two markets on one rebasing token share one balance. After the
    ///      token halves everyone's balance, neither market may pay with the
    ///      other's reserves: the first to withdraw is refused outright, not
    ///      paid out of the second's money; after the first writes itself
    ///      down, the second is still whole.
    function test_aMarketCannotPayWithAnotherMarketsReserves() public {
        RebasingToken rbs = new RebasingToken();
        rbs.mint(holder, 1e24);
        rbs.mint(other, 1e24);
        uint256 a = hub.mint(holder);
        uint256 b = hub.mint(other);
        vm.startPrank(holder);
        rbs.approve(address(pool), type(uint256).max);
        pool.openMarket(a, address(weth), address(rbs), 30, 0, 0, 0);
        pool.deposit(a, 100 * WAD, 100 * WAD);
        vm.stopPrank();
        vm.startPrank(other);
        rbs.approve(address(pool), type(uint256).max);
        pool.openMarket(b, address(weth), address(rbs), 30, 0, 0, 0);
        weth.mint(other, 1e24);
        weth.approve(address(pool), type(uint256).max);
        pool.deposit(b, 100 * WAD, 100 * WAD);
        vm.stopPrank();
        assertEq(pool.totalReserved(address(rbs)), 200 * WAD);

        rbs.rebase(0.5e18);
        assertEq(rbs.balanceOf(address(pool)), 100 * WAD, "the rebase did not take");

        // A's full claim would be paid with B's money: refused
        vm.prank(holder);
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.withdraw(a, 0, 100 * WAD, holder);
        // and so would any part of it — the cap is balance minus B's claim, zero
        vm.prank(holder);
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.withdraw(a, 0, 1, holder);
        // a trade that pays RBS out of A is refused for the same reason
        vm.prank(trader);
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.swapExactIn(a, true, WAD, 0, trader, FOREVER);
        // the other side of A is untouched by the rebase and still pays
        vm.prank(holder);
        pool.withdraw(a, WAD, 0, holder);

        // A writes down: its RBS books fall to what is left after B is whole — nothing
        vm.prank(holder);
        pool.writeDown(a);
        assertEq(uint256(pool.marketOf(a).rQuote), 0, "A booked money that belongs to B");
        assertEq(pool.totalReserved(address(rbs)), 100 * WAD);

        // B is whole: every wei of its claim is still payable
        vm.prank(other);
        pool.withdraw(b, 0, 100 * WAD, other);
        assertEq(rbs.balanceOf(address(pool)), 0);
        // and B has nothing to write down
        vm.prank(other);
        vm.expectRevert(IPoolEvents.ZeroAmount.selector);
        pool.writeDown(b);
    }

    /// @dev A single market on a rebasing token: after a downward rebase it
    ///      fails closed — withdraw and every payout revert Insolvent — until
    ///      the holder writes it down to the solvent share, after which it
    ///      trades and withdraws again at the honest number.
    function test_aDownwardRebaseFailsClosedUntilWriteDown() public {
        RebasingToken rbs = new RebasingToken();
        rbs.mint(holder, 1e24);
        rbs.mint(trader, 1e24);
        uint256 id = hub.mint(holder);
        vm.startPrank(holder);
        rbs.approve(address(pool), type(uint256).max);
        pool.openMarket(id, address(rbs), address(usdc), 30, 0, 0, 0);
        pool.deposit(id, 100 * WAD, 300_000 * WAD);
        vm.stopPrank();

        rbs.rebase(0.5e18);

        vm.prank(holder);
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.withdraw(id, 100 * WAD, 0, holder);
        vm.prank(holder);
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.withdraw(id, 60 * WAD, 0, holder);
        // up to the balance is payable: the market pays what it holds, never more
        vm.prank(holder);
        pool.withdraw(id, 50 * WAD, 0, holder);
        assertEq(rbs.balanceOf(address(pool)), 0);
        // the books still say 50 RBS; the balance says none: a trade paying RBS is refused
        vm.prank(trader);
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.swapExactIn(id, false, 100 * WAD, 0, trader, FOREVER);
        // buying RBS in is fine — it only adds
        vm.startPrank(trader);
        rbs.approve(address(pool), type(uint256).max);
        pool.swapExactIn(id, true, WAD, 0, trader, FOREVER);
        vm.stopPrank();

        // the holder writes it down: books := min(books, balance − others)
        Market memory before_ = pool.marketOf(id);
        vm.prank(holder);
        pool.writeDown(id);
        Market memory after_ = pool.marketOf(id);
        assertEq(uint256(after_.rBase), rbs.balanceOf(address(pool)), "the write-down did not land on the balance");
        assertLt(uint256(after_.rBase), uint256(before_.rBase));
        assertEq(after_.rQuote, before_.rQuote, "the write-down touched the side that did not rebase");
        assertEq(pool.totalReserved(address(rbs)), after_.rBase);
        assertTrue(after_.vBase != before_.vBase || after_.curveBps == 0, "the curve did not re-anchor to the honest reserves");

        // and the market is alive again: it pays RBS, at the honest number
        vm.prank(trader);
        uint256 out = pool.swapExactIn(id, false, 100 * WAD, 0, trader, FOREVER);
        assertGt(out, 0);
        assertLe(out * 2, uint256(after_.rBase));
    }

    /// @dev Native ether cannot rebase, but the same cap guards it: a
    ///      native market can never pay out ether another market put in.
    function test_aNativeMarketNeverPaysAnotherMarketsEther() public {
        uint256 a = hub.mint(holder);
        uint256 b = hub.mint(holder);
        vm.startPrank(holder);
        pool.openMarket(a, address(weth), address(0), 30, 0, 0, 0);
        pool.deposit{value: 10 ether}(a, 10 * WAD, 10 ether);
        pool.openMarket(b, address(usdc), address(0), 30, 0, 0, 0);
        pool.deposit{value: 10 ether}(b, 10 * WAD, 10 ether);
        assertEq(pool.totalReserved(address(0)), 20 ether);
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.withdraw(a, 0, 10 ether + 1, holder);
        pool.withdraw(a, 0, 10 ether, holder);
        assertEq(address(pool).balance, 10 ether);
        vm.expectRevert(IPoolEvents.Insolvent.selector);
        pool.withdraw(a, 0, 1, holder);
        pool.withdraw(b, 0, 10 ether, holder);
        vm.stopPrank();
        assertEq(address(pool).balance, 0);
    }
}
