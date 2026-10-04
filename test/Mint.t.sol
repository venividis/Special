// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {MockReachImpl, ReentrantMinter} from "./helpers/HubMocks.sol";
import {IIntact, IIntactEvents, Status, Core} from "../src/interfaces/IIntact.sol";
import {IntactConfig, IntactBase} from "../src/hub/IntactBase.sol";
import {Intact} from "../src/hub/Intact.sol";
import {ERC721Minimal} from "../src/vendor/ERC721Minimal.sol";
import {Transient} from "../src/lib/Transient.sol";

/*  DESIGN.md §14 A6 and §4.3: counters before the callback, the band's
    edge, both hands made and checked, Active at birth. */
contract MintTest is IntactFixture {
    function setUp() public { setUpWorld(); }

    function test_aReentrantMinterSeesACompleteToken() public {
        ReentrantMinter m = new ReentrantMinter(hub);
        vm.deal(address(m), 1 ether);
        uint256 id = m.mint{value: PRICE}();
        assertEq(m.seenId(), id);
        assertTrue(m.complete(), "every fact about the token was final before the callback ran");
        assertFalse(m.reentered(), "a second mint from inside the callback is refused");
        assertEq(sel32(m.reentryError()), sel32(Transient.Reentrancy.selector));
        assertEq(hub.minted(), 1);
        assertEq(hub.ownerOf(id), address(m));
        // the lock is clear once the transaction is: the next mint goes through
        uint256 id2 = m.mint{value: PRICE}();
        assertEq(id2, id + 1);
        assertEq(hub.minted(), 2);
    }

    function test_theBandIsExhaustedNotWrapped() public {
        IntactConfig memory c = config();
        c.bandLo = 5;
        c.bandHi = 7;
        IIntact h = diamondBuild ? deployDiamond(c, PRICE) : deployMonolith(c, PRICE);
        for (uint256 i; i < 3; ++i) {
            vm.prank(alice);
            assertEq(h.mint{value: PRICE}(alice), 5 + i);
        }
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.BandExhausted.selector);
        h.mint{value: PRICE}(alice);
        assertEq(h.minted(), 3);
        assertEq(h.totalSupply(), 3);
        assertEq(h.tokenByIndex(2), 7);
        vm.expectRevert(ERC721Minimal.BadIndex.selector);
        h.tokenByIndex(3);
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        h.ownerOf(8);
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        h.ownerOf(4);
        assertEq(h.BAND_LO(), 5);
        assertEq(h.BAND_HI(), 7);
        // a band may not start at the reserved id 0 nor run backwards
        c.bandLo = 0;
        try new Intact(c, PRICE) { revert("band 0 accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactBase.BadBand.selector)); }
        c.bandLo = 9;
        try new Intact(c, PRICE) { revert("inverted band accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactBase.BadBand.selector)); }
    }

    function test_mintSetsActiveAndSaleSetsPaused() public {
        uint256 id = mintTo(alice);
        assertTrue(hub.statusOf(id) == Status.Active, "a fresh minter's keys work immediately");
        assertEq(hub.custodyEpoch(id), 1);
        Core memory c = hub.coreOf(id);
        assertEq(c.createdAt, T0);
        assertEq(uint256(c.lockCount), 0);

        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertTrue(hub.statusOf(id) == Status.Paused, "every custody change pauses");
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotActor.selector);
        hub.setStatus(id, Status.Active);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotActor.selector);
        hub.setStatus(id, Status.Active);

        // the buyer re-arms in person
        vm.prank(bob);
        hub.setStatus(id, Status.Active);
        assertTrue(hub.statusOf(id) == Status.Active);
        // the token's own Reach may act on its status
        reachOf(id).act(address(hub), abi.encodeCall(IIntact.setStatus, (id, Status.Paused)));
        assertTrue(hub.statusOf(id) == Status.Paused);
        // a guardian may pause and never arm
        vm.prank(bob);
        hub.setGuardian(id, guardian);
        vm.prank(bob);
        hub.setStatus(id, Status.Active);
        vm.prank(guardian);
        hub.pause(id);
        assertTrue(hub.statusOf(id) == Status.Paused);
        vm.prank(guardian);
        vm.expectRevert(IIntactEvents.NotActor.selector);
        hub.setStatus(id, Status.Active);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotGuardian.selector);
        hub.pause(id);
    }

    function test_mintIsExactlyPricedAndMakesBothHands() public {
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.WrongPrice.selector);
        hub.mint{value: PRICE - 1}(alice);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.WrongPrice.selector);
        hub.mint{value: PRICE + 1}(alice);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.ZeroAddress.selector);
        hub.mint{value: PRICE}(address(0));

        uint256 id = mintTo(alice);
        address r = hub.account(id);
        address g = hub.grip(id);
        assertEq(r.code.length, 173);
        assertEq(g.code.length, 173);
        assertTrue(r != g);
        assertTrue(hub.isCanonicalAccount(r, id, false));
        assertTrue(hub.isCanonicalAccount(g, id, true));
        assertFalse(hub.isCanonicalAccount(r, id, true));
        assertFalse(hub.isCanonicalAccount(g, id, false));
        assertFalse(hub.isCanonicalAccount(r, id + 1, false));
        assertFalse(hub.isCanonicalAccount(hub.account(id + 1), id + 1, false), "an address nobody deployed is not an account");
        (uint256 chain, address collection, uint256 tid) = MockReachImpl(payable(r)).token();
        assertEq(chain, block.chainid);
        assertEq(collection, address(hub));
        assertEq(tid, id);
        assertEq(MockReachImpl(payable(r)).owner(), alice);
        assertEq(hub.balanceOf(alice), 1);
        assertEq(hub.tokenOfOwnerByIndex(alice, 0), id);
        assertEq(hub.tokenByIndex(0), id);
        assertEq(address(hub).balance, PRICE);
        assertEq(hub.feeSink(id), r);
    }

    function test_theTimelockIsTheOnlyCurator() public {
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotTimelock.selector);
        hub.setPrice(1);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotTimelock.selector);
        hub.setRoyalty(alice, 1);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotTimelock.selector);
        hub.withdraw(alice);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotTimelock.selector);
        hub.sealPricing();

        vm.prank(timelock);
        hub.setPrice(2 ether);
        assertEq(hub.price(), 2 ether);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.WrongPrice.selector);
        hub.mint{value: PRICE}(alice);
        vm.prank(timelock);
        vm.expectRevert(IIntactEvents.RoyaltyTooHigh.selector);
        hub.setRoyalty(carol, 501);
        vm.prank(timelock);
        hub.setRoyalty(carol, 500);
        (address receiver, uint256 amount) = hub.royaltyInfo(1, 1 ether);
        assertEq(receiver, carol);
        assertEq(amount, 0.05 ether);

        vm.prank(timelock);
        hub.setPrice(PRICE);
        mintTo(alice);
        uint256 before = carol.balance;
        vm.prank(timelock);
        hub.withdraw(carol);
        assertEq(carol.balance, before + PRICE);
        assertEq(address(hub).balance, 0);

        vm.prank(timelock);
        hub.sealPricing();
        assertTrue(hub.pricingSealed());
        vm.prank(timelock);
        vm.expectRevert(IIntactEvents.IsPricingSealed.selector);
        hub.setPrice(1);
        vm.prank(timelock);
        vm.expectRevert(IIntactEvents.IsPricingSealed.selector);
        hub.setRoyalty(carol, 1);
        // withdraw outlives the seal
        mintTo(bob);
        vm.prank(timelock);
        hub.withdraw(carol);
        assertEq(carol.balance, before + 2 * PRICE);
    }
}
