// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BundleFixture} from "./helpers/Deploy.sol";
import {MockRenderer} from "./helpers/HubMocks.sol";
import {IntactConfig} from "../src/hub/IntactBase.sol";
import {IIntactEvents, Status, Traits} from "../src/interfaces/IIntact.sol";
import {IReach, IReachEvents, AssetCap} from "../src/interfaces/IReach.sol";
import {IPoolEvents} from "../src/interfaces/IPool.sol";
import {IMarket, IMarketEvents, Floor, Listing} from "../src/interfaces/IMarket.sol";
import {Rights} from "../src/lib/Rights.sol";
import {Reach} from "../src/Reach.sol";
import {Grip} from "../src/Grip.sol";
import {Pool} from "../src/Pool.sol";
import {Market} from "../src/Market.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {HostileToken} from "./mocks/HostileToken.sol";
import {RebasingToken} from "./mocks/RebasingToken.sol";
import {MaliciousSeller} from "./mocks/MaliciousSeller.sol";
import {MarketClaimant} from "./mocks/MarketClaimant.sol";

/*───────────────────────────────────────────────────────────────────────────
  Market — listing is a seal (U15; DESIGN.md §3 row 28, §11.3, §14 C6)

  The real hub, in the build INTACT_IMPL names, pinned at construction to
  the address the Market lands at one creation later; the real Reach and
  Grip behind the canonical registry; the real Pool. The pinning is the
  Bundle's: the test contract's next nonce is discovered by a probe, the
  Market and the hub are predicted from it, and both predictions are
  asserted after the fact.

  The sentences are the seven BUILD-PLAN names and what §2 says a sale
  revokes, read against the Market's own doors: a listing needs both seals,
  pins a fingerprint, holds the hub's lock, dies by the epoch, fills only
  at the exact price against the exact state with every floor standing,
  pays the royalty first into a ledger the payees pull from, and never
  hands the seller a moment in which it is still the holder.
───────────────────────────────────────────────────────────────────────────*/
contract MarketTest is BundleFixture {
    Market theMarket;
    MockERC20 weth;

    address pad = address(0x9AD);              // the Pool's LAUNCHPAD pin; never called here
    address royalties = address(0x2071);
    address agent = address(0xA6E7);
    address op = address(0x0A);
    address renter = address(0x2E);
    address trader = address(0x72ADE2);
    address stranger = address(0x57A);

    uint64 constant FOREVER = type(uint64).max;
    uint64 constant EXP = T0 + 30 days;
    uint256 constant ASK = 10 ether;
    bytes4 constant XFER = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 constant APPROVE = bytes4(keccak256("approve(address,uint256)"));

    function setUp() public {
        vm.warp(T0);
        vm.roll(1000);
        vm.etch(REGISTRY, REGISTRY_RUNTIME);
        diamondBuild = keccak256(bytes(vm.envOr("INTACT_IMPL", "monolith"))) == keccak256("diamond");

        theReach = new Reach();
        theGrip = new Grip();
        renderer = new MockRenderer();
        weth = new MockERC20("Wrapped Ether", "WETH", 18, 0, false);

        // from here every creation is counted: the Pool, the Market, then the hub
        uint256 n = _nextNonce();
        address marketP = _predict(address(this), n + 1);
        address hubP = _predict(address(this), n + 2 + (diamondBuild ? 4 : 0));
        thePool = new Pool(hubP, pad);                                                // n
        theMarket = new Market(hubP, address(thePool));                               // n + 1
        IntactConfig memory c = marketConfig(marketP);
        hub = diamondBuild ? deployDiamond(c, PRICE) : deployMonolith(c, PRICE);     // n + 2 (+ 4)
        if (address(theMarket) != marketP) revert Mispredicted("Market", marketP, address(theMarket));
        if (address(hub) != hubP) revert Mispredicted("hub", hubP, address(hub));

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(trader, 100 ether);
        vm.deal(stranger, 10 ether);
    }

    function marketConfig(address marketP) internal view returns (IntactConfig memory c) {
        c = IntactConfig({
            reachImpl: address(theReach), gripImpl: address(theGrip),
            band: BAND, bandLo: LO, bandHi: HI,
            steward: address(0), market: marketP, roles: address(0), pool: address(thePool),
            parley: address(0), launchpad: address(0), locks: address(0),
            renderer: address(renderer), catalog: address(0), premises: address(0), timelock: timelock
        });
    }

    /*═══════════════════ helpers ═══════════════════*/

    /// @dev A token whose Reach the holder sealed to `until`.
    function _sealed(address who, uint64 until) internal returns (uint256 id) {
        id = mintTo(who);
        Reach r = reachAt(id);          // hoisted: a view call inside the pranked statement would eat the prank
        vm.prank(who);
        r.seal(until);
    }

    /// @dev The fingerprint is read before the prank: a view call inside a
    ///      pranked statement's arguments would consume it.
    function _list(uint256 id, address by, uint256 price, uint64 expiresAt, Floor[] memory floors) internal {
        bytes32 fp = hub.getStateFingerprint(id);
        vm.prank(by);
        theMarket.list(id, price, expiresAt, fp, floors);
    }

    function _list(uint256 id, address by) internal {
        _list(id, by, ASK, EXP, _noFloors());
    }

    function _relist(uint256 id, address by) internal {
        vm.prank(by);
        theMarket.delist(id);
        _list(id, by);
    }

    /// @dev What a buyer's page does: read the pinned fingerprint and the price, pay exactly.
    function _buy(uint256 id, address by) internal {
        Listing memory l = theMarket.listingOf(id);
        vm.prank(by);
        theMarket.buy{value: l.price}(id, l.price, l.fingerprint);
    }

    function _noFloors() internal pure returns (Floor[] memory f) {
        f = new Floor[](0);
    }

    function _floor(address asset, uint256 min) internal pure returns (Floor[] memory f) {
        f = new Floor[](1);
        f[0] = Floor(asset, min);
    }

    /// @dev The holder's owned market: 100 WETH against 10 ETH, no sniper fee.
    function _openMarket(uint256 id, address by) internal {
        weth.mint(by, 1_000e18);
        vm.startPrank(by);
        weth.approve(address(thePool), type(uint256).max);
        thePool.openMarket(id, address(weth), address(0), 30, 0, 0, 0);
        thePool.deposit{value: 10 ether}(id, 100e18, 10 ether);
        vm.stopPrank();
    }

    function _sealMarket(uint256 id, address by, uint64 until) internal {
        vm.prank(by);
        thePool.sealMarket(id, until);
    }

    /// @dev The runner's `expectRevert(bytes)` matches any revert; where an
    ///      error's arguments are the evidence, the call is made by hand and
    ///      its revert data compared whole.
    function _revertsWith(address who, uint256 value, bytes memory data, bytes memory want) internal {
        vm.prank(who);
        (bool ok, bytes memory ret) = address(theMarket).call{value: value}(data);
        assertFalse(ok, "the call was expected to revert");
        assertEq(ret, want, "the revert data");
    }

    function _sealsTooShort(uint64 reachUntil, uint64 marketUntil, uint64 expiresAt) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IMarketEvents.SealsTooShort.selector, reachUntil, marketUntil, expiresAt);
    }

    function _floorBroken(address asset, uint256 min, uint256 actual) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IMarketEvents.FloorBroken.selector, asset, min, actual);
    }

    function _moved(bytes32 expected, bytes32 actual) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IMarketEvents.FingerprintMoved.selector, expected, actual);
    }

    function _wrongPrice(uint256 expected, uint256 provided) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(IMarketEvents.WrongPrice.selector, expected, provided);
    }

    function _buyCall(uint256 id, uint256 agreed, bytes32 fp) internal pure returns (bytes memory) {
        return abi.encodeCall(IMarket.buy, (id, agreed, fp));
    }

    function _listCall(uint256 id, uint256 price, uint64 expiresAt, bytes32 fp, Floor[] memory floors)
        internal pure returns (bytes memory)
    {
        return abi.encodeCall(IMarket.list, (id, price, expiresAt, fp, floors));
    }

    /*═══════════════════ the pinned world ═══════════════════*/

    function test_theMarketAndTheHubArePinnedToEachOther() public {
        assertEq(hub.MARKET(), address(theMarket));
        assertEq(theMarket.HUB(), address(hub));
        assertEq(theMarket.POOL(), address(thePool));
        assertEq(hub.POOL(), address(thePool));
        assertEq(thePool.HUB(), address(hub));
        assertEq(theMarket.MAX_FLOORS(), 64);
        assertEq(uint256(theMarket.MAX_LISTING()), 365 days);

        uint256 id = mintTo(alice);
        // the market's door is the pinned Market's alone, and only pinned modules lock
        vm.prank(stranger);
        vm.expectRevert(IIntactEvents.NotMarket.selector);
        hub.moduleTransfer(id, stranger);
        vm.prank(stranger);
        vm.expectRevert(IIntactEvents.NotModule.selector);
        hub.moduleLock(id);
        // a token nobody listed reads as unlisted, never as a revert; a stranger is owed nothing
        Listing memory l = theMarket.listingOf(id);
        assertEq(l.seller, address(0));
        assertEq(l.price, 0);
        assertEq(l.floors.length, 0);
        assertEq(theMarket.owed(alice), 0);
        assertFalse(hub.locked(id));
    }

    /*═══════════════════ the seven sentences ═══════════════════*/

    function test_listWithoutBothSealsReverts() public {
        uint256 id = mintTo(alice);
        Reach r = reachAt(id);
        Floor[] memory f = _noFloors();

        // no Reach seal at all
        bytes32 fp = hub.getStateFingerprint(id);
        _revertsWith(alice, 0, _listCall(id, ASK, EXP, fp, f), _sealsTooShort(0, 0, EXP));
        // a Reach seal one second short of the listing
        vm.prank(alice);
        r.seal(EXP - 1);
        fp = hub.getStateFingerprint(id);
        _revertsWith(alice, 0, _listCall(id, ASK, EXP, fp, f), _sealsTooShort(EXP - 1, 0, EXP));
        assertFalse(hub.locked(id), "nothing was listed");
        // exactly covering, with no owned market: the Reach's seal alone is enough
        vm.prank(alice);
        r.seal(EXP);
        _list(id, alice);
        assertTrue(hub.locked(id));
        vm.prank(alice);
        theMarket.delist(id);

        // an open, unsealed owned market: the second seal is now required too
        _openMarket(id, alice);
        fp = hub.getStateFingerprint(id);
        _revertsWith(alice, 0, _listCall(id, ASK, EXP, fp, f), _sealsTooShort(EXP, 0, EXP));
        // sealed one second short
        _sealMarket(id, alice, EXP - 1);
        fp = hub.getStateFingerprint(id);
        _revertsWith(alice, 0, _listCall(id, ASK, EXP, fp, f), _sealsTooShort(EXP, EXP - 1, EXP));
        assertFalse(hub.locked(id));
        // both covering
        _sealMarket(id, alice, EXP);
        _list(id, alice);
        Listing memory l = theMarket.listingOf(id);
        assertEq(l.seller, alice);
        assertEq(l.price, ASK);
        assertEq(uint256(l.expiresAt), uint256(EXP));
        assertEq(uint256(l.epoch), 1);
        assertEq(l.fingerprint, hub.getStateFingerprint(id), "the pinned fingerprint is the live one, lock included");
        assertEq(l.floors.length, 0);
        assertTrue(hub.locked(id));
        // and a listing that outlasts either seal is refused even with both standing
        vm.prank(alice);
        theMarket.delist(id);
        fp = hub.getStateFingerprint(id);
        _revertsWith(alice, 0, _listCall(id, ASK, EXP + 1, fp, f), _sealsTooShort(EXP, EXP, EXP + 1));
        assertFalse(hub.locked(id));
    }

    function test_buyRevertsOnAnyFingerprintChange() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        _openMarket(id, alice);
        _sealMarket(id, alice, EXP);

        // a fingerprint the buyer made up, with nothing moved
        _list(id, alice);
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        bytes32 wrong = keccak256("not what the chain says");
        _revertsWith(bob, ASK, _buyCall(id, ASK, wrong), _moved(pinned, wrong));
        // the seller lists what the seller saw: a stale fingerprint is refused at the listing too
        vm.prank(alice);
        theMarket.delist(id);
        _revertsWith(alice, 0, _listCall(id, ASK, EXP, wrong, _noFloors()), _moved(wrong, hub.getStateFingerprint(id)));
        _list(id, alice);

        // the Core: the seller sets a trait
        vm.prank(alice);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(5_000)));
        _refused(id, bob, alice);
        _relist(id, alice);

        // the Reach: its seal lengthened, so its state and its seal both moved
        vm.prank(alice);
        r.seal(EXP + 1 days);
        _refused(id, bob, alice);
        _relist(id, alice);

        // the Reach's ledger: an approval its hand gave is recorded, and the state bumped
        vm.prank(alice);
        r.execute(address(weth), 0, abi.encodeWithSelector(APPROVE, address(thePool), 1), 0);
        _refused(id, bob, alice);
        _relist(id, alice);

        // the owned market: a stranger's trade moved the reserves, so the market hash
        vm.prank(trader);
        thePool.swapExactIn{value: 0.1 ether}(id, false, 0.1 ether, 0, trader, FOREVER);
        _refused(id, bob, alice);
        _relist(id, alice);

        // and the fingerprint the chain says, on a listing nothing touched, fills
        _buy(id, bob);
        assertEq(hub.ownerOf(id), bob);
    }

    /// @dev After something moved: the pinned fingerprint is refused against
    ///      the live one, and presenting the live one is refused against the
    ///      pinned one — the listing offers what was offered, nothing else.
    function _refused(uint256 id, address buyer, address seller) internal {
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        bytes32 live = hub.getStateFingerprint(id);
        assertTrue(live != pinned, "the change moved the fingerprint");
        _revertsWith(buyer, ASK, _buyCall(id, ASK, pinned), _moved(pinned, live));
        _revertsWith(buyer, ASK, _buyCall(id, ASK, live), _moved(pinned, live));
        assertEq(hub.ownerOf(id), seller);
        assertEq(theMarket.owed(seller), 0);
    }

    function test_aBrokenFloorRefusesTheSale() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        RebasingToken rbs = new RebasingToken();
        rbs.mint(address(r), 10e18);
        bytes32 fp = hub.getStateFingerprint(id);

        // a floor the Reach does not meet is a typo, not a promise: refused at the listing
        _revertsWith(alice, 0, _listCall(id, ASK, EXP, fp, _floor(address(rbs), 11e18)),
            _floorBroken(address(rbs), 11e18, 10e18));
        assertFalse(hub.locked(id));
        _list(id, alice, ASK, EXP, _floor(address(rbs), 10e18));
        Listing memory l = theMarket.listingOf(id);
        assertEq(l.floors.length, 1);
        assertEq(l.floors[0].asset, address(rbs));
        assertEq(l.floors[0].min, 10e18);

        // the balance falls by the token's own hand — a rebase, as stETH or AMPL would do it — so the
        // Reach's state, its seal and the fingerprint all stand, and only the floor can see it
        rbs.rebase(0.9e18);
        assertEq(rbs.balanceOf(address(r)), 9e18);
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        assertEq(hub.getStateFingerprint(id), pinned, "nothing the fingerprint covers moved");
        _revertsWith(bob, ASK, _buyCall(id, ASK, pinned), _floorBroken(address(rbs), 10e18, 9e18));
        assertEq(hub.ownerOf(id), alice);
        assertEq(theMarket.owed(alice), 0);
        assertEq(address(theMarket).balance, 0, "a refused fill keeps nothing");

        // back above the floor it fills, and the buyer's Reach holds what was promised
        rbs.rebase(1e18);
        _buy(id, bob);
        assertEq(hub.ownerOf(id), bob);
        assertEq(rbs.balanceOf(address(r)), 10e18);
    }

    function test_aMaliciousSellerHasNoWindow() public {
        address beneficiary = address(0xBAD);
        MaliciousSeller seller = new MaliciousSeller(address(hub), address(weth), beneficiary);
        uint256 id = hub.mint{value: PRICE}(address(seller));
        Reach r = reachAt(id);
        weth.mint(address(r), 100e18);
        seller.act(address(r), abi.encodeCall(IReach.seal, (EXP)));
        bytes32 fp = hub.getStateFingerprint(id);
        seller.act(address(theMarket), _listCall(id, ASK, EXP, fp, _floor(address(weth), 100e18)));
        assertEq(theMarket.listingOf(id).seller, address(seller));
        // the donor's shape: an approval the fill will never need
        seller.arm(id, address(theMarket));
        assertTrue(hub.isApprovedForAll(address(seller), address(theMarket)));

        // the fill pays the seller nothing and calls it never: there is no callback to attack from
        _buy(id, bob);
        assertTrue(seller.armed(), "the seller was not called during the fill");
        assertEq(hub.ownerOf(id), bob);
        assertEq(r.owner(), bob);
        assertEq(weth.balanceOf(address(r)), 100e18);
        assertEq(theMarket.owed(address(seller)), ASK);
        assertEq(address(seller).balance, 0);

        // when the seller pulls its money it is a stranger to the token: every attempt from the callback fails
        seller.act(address(theMarket), abi.encodeCall(IMarket.claim, ()));
        assertFalse(seller.armed(), "the callback ran");
        assertFalse(seller.drainSucceeded(), "the drain");
        assertFalse(seller.sessionSucceeded(), "the session");
        assertFalse(seller.userSucceeded(), "the user");
        assertEq(address(seller).balance, ASK, "paid in full, by pull");
        assertEq(weth.balanceOf(address(r)), 100e18);
        assertEq(weth.balanceOf(beneficiary), 0);
        assertFalse(r.sessionCurrent(beneficiary));
        assertEq(hub.userOf(id), address(0));
        assertEq(bitsOf(id, address(seller)), 0);
        assertEq(bitsOf(id, bob), Rights.R_HOLD);
        // and the standing approval it gave the Market bought it nothing: the token moved through the hub's door, not an approval
        vm.expectRevert(IReachEvents.NotSigner.selector);
        seller.act(address(r), abi.encodeCall(IReach.execute, (address(weth), 0, abi.encodeWithSelector(XFER, beneficiary, 1e18), 0)));
        assertEq(weth.balanceOf(address(r)), 100e18);
    }

    function test_royaltyIsPaidFirstAndProceedsArePulled() public {
        vm.prank(timelock);
        hub.setRoyalty(royalties, 500);
        uint256 id = _sealed(alice, EXP);
        _list(id, alice);
        uint256 a0 = alice.balance;
        uint256 b0 = bob.balance;
        _buy(id, bob);

        // nothing was pushed: the buyer paid the Market and the ledger holds it, royalty first, out of the price
        assertEq(bob.balance, b0 - ASK);
        assertEq(alice.balance, a0, "the seller was paid nothing during the fill");
        assertEq(address(theMarket).balance, ASK);
        assertEq(theMarket.owed(royalties), 0.5 ether, "five percent, first");
        assertEq(theMarket.owed(alice), ASK - 0.5 ether, "the proceeds are the price less the royalty");
        assertEq(theMarket.owed(bob), 0);
        // each payee pulls its own, in any order, and neither can take the other's
        vm.prank(royalties);
        theMarket.claim();
        assertEq(royalties.balance, 0.5 ether);
        assertEq(theMarket.owed(royalties), 0);
        assertEq(theMarket.owed(alice), ASK - 0.5 ether);
        vm.prank(alice);
        theMarket.claim();
        assertEq(alice.balance, a0 + ASK - 0.5 ether);
        assertEq(address(theMarket).balance, 0, "the ledger and the balance agree to the wei");
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.NothingOwed.selector);
        theMarket.claim();

        // with no royalty receiver the whole price is the seller's
        vm.prank(timelock);
        hub.setRoyalty(address(0), 500);
        uint256 id2 = _sealed(carol, EXP);
        _list(id2, carol);
        _buy(id2, bob);
        assertEq(theMarket.owed(carol), ASK);
        assertEq(theMarket.owed(address(0)), 0);
    }

    function test_delistUnlocks() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.NotListed.selector);
        theMarket.delist(id);
        _list(id, alice);
        assertTrue(hub.locked(id));
        assertFalse(hub.isTransferable(id, alice, bob));

        // not the Reach, not an operator, not a stranger: the holder, in person, while the listing is live
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.NotHolder.selector);
        r.execute(address(theMarket), 0, abi.encodeCall(IMarket.delist, (id)), 0);
        vm.prank(alice);
        hub.setApprovalForAll(op, true);
        vm.prank(op);
        vm.expectRevert(IMarketEvents.NotHolder.selector);
        theMarket.delist(id);
        vm.prank(stranger);
        vm.expectRevert(IMarketEvents.NotHolder.selector);
        theMarket.delist(id);
        assertTrue(hub.locked(id));

        vm.prank(alice);
        theMarket.delist(id);
        assertFalse(hub.locked(id));
        assertTrue(hub.isTransferable(id, alice, bob));
        assertEq(theMarket.listingOf(id).seller, address(0));
        bytes32 fp = hub.getStateFingerprint(id);
        vm.prank(bob);
        vm.expectRevert(IMarketEvents.NotListed.selector);
        theMarket.buy{value: ASK}(id, ASK, fp);
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.NotListed.selector);
        theMarket.delist(id);
        // the lock was the listing's and nobody else's: the holder moves the token freely now
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.ownerOf(id), bob);
    }

    function test_aListingIsStaleAfterPanic() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        _list(id, alice);
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        vm.prank(alice);
        hub.panic(id);
        assertEq(hub.custodyEpoch(id), 2);
        assertEq(r.sealedUntil(), T0 + 365 days);

        // the epoch moved: Stale, before any other question is asked, whichever fingerprint is presented
        vm.prank(bob);
        vm.expectRevert(IMarketEvents.Stale.selector);
        theMarket.buy{value: ASK}(id, ASK, pinned);
        bytes32 live = hub.getStateFingerprint(id);
        vm.prank(bob);
        vm.expectRevert(IMarketEvents.Stale.selector);
        theMarket.buy{value: ASK}(id, ASK, live);
        assertEq(hub.ownerOf(id), alice);
        assertTrue(hub.locked(id), "a stale listing still holds its lock until it is cleared");
        // the holder still holds: the holder delists, and the lock goes with the listing
        vm.prank(alice);
        theMarket.delist(id);
        assertFalse(hub.locked(id));
        // and relists under the new epoch, under the seal the panic set, for a buyer who reads again
        _list(id, alice);
        assertEq(uint256(theMarket.listingOf(id).epoch), 2);
        _buy(id, bob);
        assertEq(hub.ownerOf(id), bob);
        assertEq(hub.custodyEpoch(id), 3);

        // the guardian's panic does the same; its hold outlives the listing until the holder releases it
        uint256 id2 = _sealed(carol, EXP);
        vm.prank(carol);
        hub.setGuardian(id2, guardian);
        _list(id2, carol);
        bytes32 pinned2 = theMarket.listingOf(id2).fingerprint;
        vm.prank(guardian);
        hub.panic(id2);
        vm.prank(bob);
        vm.expectRevert(IMarketEvents.Stale.selector);
        theMarket.buy{value: ASK}(id2, ASK, pinned2);
        vm.prank(carol);
        theMarket.delist(id2);
        assertEq(theMarket.listingOf(id2).seller, address(0));
        assertTrue(hub.locked(id2), "the guardian's hold is not the listing's lock");
        vm.prank(carol);
        hub.release(id2);
        assertFalse(hub.locked(id2));
    }

    /*═══════════════════ what a sale revokes ═══════════════════*/

    function test_theSaleRevokesTheSellerEverywhere() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        weth.mint(address(r), 10e18);
        // what the seller had delegated before listing: a session, a guardian, a user, an approvee, an operator
        address[] memory targets = new address[](1);
        targets[0] = address(weth);
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = XFER;
        AssetCap[] memory caps;
        vm.startPrank(alice);
        r.grantSession(agent, uint64(T0 + 1 days), 0, caps, targets, selectors, 0, 0);
        hub.setGuardian(id, guardian);
        hub.setUser(id, renter, uint64(T0 + 10 days));
        hub.approve(carol, id);
        hub.setApprovalForAll(op, true);
        vm.stopPrank();
        vm.prank(agent);
        r.executeAsSession(address(weth), 0, abi.encodeWithSelector(XFER, agent, 1e18));
        assertEq(weth.balanceOf(agent), 1e18, "the session works before the sale");
        assertTrue(r.sessionCurrent(agent));
        _list(id, alice);
        assertEq(bitsOf(id, alice), Rights.R_HOLD);
        _buy(id, bob);

        // custody, and everything that hung off it
        assertEq(hub.ownerOf(id), bob);
        assertEq(r.owner(), bob);
        assertEq(hub.custodyEpoch(id), 2);
        assertTrue(hub.statusOf(id) == Status.Paused);
        assertFalse(hub.locked(id), "the sale released the listing's lock");
        assertEq(bitsOf(id, alice), 0, "the seller carries no right");
        assertEq(bitsOf(id, bob), Rights.R_HOLD);
        assertEq(hub.guardianOf(id), address(0));
        assertEq(hub.userOf(id), address(0));
        assertEq(hub.getApproved(id), address(0));
        assertEq(bitsOf(id, carol) | bitsOf(id, renter) | bitsOf(id, guardian) | bitsOf(id, agent), 0);
        // the operator approval is alice's, per owner: it reaches nothing bob holds
        assertTrue(hub.isApprovedForAll(alice, op));
        assertEq(bitsOf(id, op), 0);
        assertFalse(r.sessionCurrent(agent), "the session named epoch 1");
        vm.prank(agent);
        vm.expectRevert(IReachEvents.SoldOn.selector);
        r.executeAsSession(address(weth), 0, abi.encodeWithSelector(XFER, agent, 1e18));
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.execute(address(weth), 0, abi.encodeWithSelector(XFER, alice, 1e18), 0);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.transferFrom(bob, alice, id);
        // the seal survived the sale: the buyer's protection, never the seller's lever
        assertEq(r.sealedUntil(), EXP);
        assertEq(weth.balanceOf(address(r)), 9e18);
        vm.prank(bob);
        vm.expectRevert(IReachEvents.ValueWhileSealed.selector);
        r.execute(bob, 1, "", 0);
    }

    function test_theBuyerCanRelist() public {
        uint256 id = _sealed(alice, EXP);
        _openMarket(id, alice);
        _sealMarket(id, alice, EXP);
        _list(id, alice);
        _buy(id, bob);
        // what survived: both seals and the market; what did not: the listing, its lock, the seller
        assertEq(reachAt(id).sealedUntil(), EXP);
        assertEq(uint256(thePool.marketOf(id).sealUntil), uint256(EXP));
        assertTrue(thePool.marketOf(id).open);
        assertFalse(hub.locked(id));
        assertEq(theMarket.listingOf(id).seller, address(0));

        // the buyer lists on the same seals under its own epoch; the seller cannot touch it
        _list(id, bob, 20 ether, EXP, _noFloors());
        assertEq(theMarket.listingOf(id).seller, bob);
        assertEq(uint256(theMarket.listingOf(id).epoch), 2);
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.NotHolder.selector);
        theMarket.delist(id);
        _buy(id, carol);
        assertEq(hub.ownerOf(id), carol);
        assertEq(hub.custodyEpoch(id), 3);
        assertEq(theMarket.owed(alice), ASK);
        assertEq(theMarket.owed(bob), 20 ether);
        assertEq(address(theMarket).balance, ASK + 20 ether);
        // the owned market went with the token twice: its sole LP is carol now
        vm.prank(bob);
        vm.expectRevert(IPoolEvents.NotActor.selector);
        thePool.deposit{value: 1 ether}(id, 0, 1 ether);
        vm.prank(carol);
        thePool.deposit{value: 1 ether}(id, 0, 1 ether);
    }

    /*═══════════════════ the doors ═══════════════════*/

    function test_theReachCannotList() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        bytes32 fp = hub.getStateFingerprint(id);
        bytes memory data = _listCall(id, ASK, EXP, fp, _noFloors());
        // the token's own hand acts in every other satellite; listing is `holds`, so here it is a stranger
        assertTrue(hub.acts(id, address(r)));
        assertFalse(hub.holds(id, address(r)));
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.NotHolder.selector);
        r.execute(address(theMarket), 0, data, 0);
        assertFalse(hub.locked(id));
        assertEq(theMarket.listingOf(id).seller, address(0));
        // nor through a session key, which only ever acts as the Reach
        address[] memory targets = new address[](1);
        targets[0] = address(theMarket);
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = IMarket.list.selector;
        AssetCap[] memory caps;
        vm.prank(alice);
        r.grantSession(agent, uint64(T0 + 1 days), 0, caps, targets, selectors, 0, 0);
        vm.prank(agent);
        vm.expectRevert(IMarketEvents.NotHolder.selector);
        r.executeAsSession(address(theMarket), 0, data);
        assertFalse(hub.locked(id));
    }

    function test_aNonHolderCannotListOrDelist() public {
        uint256 id = _sealed(alice, EXP);
        vm.startPrank(alice);
        hub.setApprovalForAll(op, true);
        hub.approve(carol, id);
        hub.setUser(id, renter, uint64(T0 + 10 days));
        hub.setGuardian(id, guardian);
        vm.stopPrank();
        bytes32 fp = hub.getStateFingerprint(id);
        Floor[] memory f = _noFloors();
        address[5] memory nots = [op, carol, renter, guardian, stranger];
        for (uint256 i; i < nots.length; ++i) {
            vm.prank(nots[i]);
            vm.expectRevert(IMarketEvents.NotHolder.selector);
            theMarket.list(id, ASK, EXP, fp, f);
        }
        assertFalse(hub.locked(id));
        _list(id, alice);
        for (uint256 i; i < nots.length; ++i) {
            vm.prank(nots[i]);
            vm.expectRevert(IMarketEvents.NotHolder.selector);
            theMarket.delist(id);
        }
        assertTrue(hub.locked(id));
        assertEq(theMarket.listingOf(id).seller, alice);
        // an unminted id is nobody's: the hub says so before the Market can
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        theMarket.list(id + 1, ASK, EXP, fp, f);
    }

    function test_aListedTokenCannotBeListedAgain() public {
        uint256 id = _sealed(alice, EXP);
        _list(id, alice);
        bytes32 fp = hub.getStateFingerprint(id);
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.AlreadyListed.selector);
        theMarket.list(id, ASK + 1, EXP, fp, _noFloors());
        assertEq(theMarket.listingOf(id).price, ASK);
        assertEq(hub.coreOf(id).lockCount, 1, "one listing, one lock");
    }

    function test_aListedTokenCannotBeTransferredByItsHolder() public {
        uint256 id = _sealed(alice, EXP);
        vm.prank(alice);
        hub.setApprovalForAll(op, true);
        _list(id, alice);
        assertEq(hub.getTraitValue(id, Traits.LOCKED), bytes32(uint256(1)));
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, bob, id);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.safeTransferFrom(alice, bob, id);
        vm.prank(op);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.ownerOf(id), alice);
        vm.prank(alice);
        theMarket.delist(id);
        assertEq(hub.getTraitValue(id, Traits.LOCKED), bytes32(0));
        vm.prank(op);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.ownerOf(id), bob);
    }

    function test_theHoldersTransferSealStopsTheSaleToo() public {
        uint256 id = _sealed(alice, EXP);
        vm.prank(alice);
        hub.sealTransfer(id, T0 + 7 days);
        _list(id, alice);
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        // every check of the Market's passes and the hub's own door refuses the move: nothing bypasses a ratchet
        uint256 b0 = bob.balance;
        vm.prank(bob);
        vm.expectRevert(IIntactEvents.IsTransferSealed.selector);
        theMarket.buy{value: ASK}(id, ASK, pinned);
        assertEq(bob.balance, b0, "the refused fill cost the buyer nothing");
        assertEq(theMarket.owed(alice), 0);
        assertEq(hub.ownerOf(id), alice);
        assertTrue(hub.locked(id), "the listing stands");
        vm.warp(T0 + 7 days + 1);
        _buy(id, bob);
        assertEq(hub.ownerOf(id), bob);
    }

    /*═══════════════════ the terms ═══════════════════*/

    function test_theExactPriceIsRequired() public {
        uint256 id = _sealed(alice, EXP);
        _list(id, alice);
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        _revertsWith(bob, ASK - 1, _buyCall(id, ASK - 1, pinned), _wrongPrice(ASK, ASK - 1));   // a price nobody asked
        _revertsWith(bob, ASK - 1, _buyCall(id, ASK, pinned), _wrongPrice(ASK, ASK - 1));       // underpaid
        _revertsWith(bob, ASK + 1, _buyCall(id, ASK, pinned), _wrongPrice(ASK, ASK + 1));       // overpaid: refused, never kept
        _revertsWith(bob, ASK, _buyCall(id, ASK + 1, pinned), _wrongPrice(ASK, ASK + 1));       // agreed above the ask
        _revertsWith(bob, 0, _buyCall(id, ASK, pinned), _wrongPrice(ASK, 0));
        assertEq(hub.ownerOf(id), alice);
        assertEq(address(theMarket).balance, 0);
        _buy(id, bob);
        assertEq(address(theMarket).balance, ASK);
        assertEq(theMarket.owed(alice), ASK);
    }

    function test_sixtyFiveFloorsAreRefused() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        Floor[] memory f = new Floor[](65);
        for (uint256 i; i < 65; ++i) f[i] = Floor(address(0), 0);
        bytes32 fp = hub.getStateFingerprint(id);
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.TooManyFloors.selector);
        theMarket.list(id, ASK, EXP, fp, f);
        assertFalse(hub.locked(id));
        // sixty-four, on real balances of two kinds, list and fill
        weth.mint(address(r), 64e18);
        vm.deal(address(r), 1 ether);
        Floor[] memory g = new Floor[](64);
        for (uint256 i; i < 64; ++i) {
            g[i] = i % 2 == 0 ? Floor(address(weth), (i + 1) * 1e18) : Floor(address(0), 1 ether);
        }
        _list(id, alice, ASK, EXP, g);
        assertEq(theMarket.listingOf(id).floors.length, 64);
        _buy(id, bob);
        assertEq(hub.ownerOf(id), bob);
        assertEq(theMarket.listingOf(id).floors.length, 0, "the floors went with the listing");
    }

    function test_anExpiryPastAYearIsRefused() public {
        uint256 id = _sealed(alice, T0 + 365 days);
        bytes32 fp = hub.getStateFingerprint(id);
        Floor[] memory f = _noFloors();
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.BadExpiry.selector);
        theMarket.list(id, ASK, T0 + 365 days + 1, fp, f);
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.BadExpiry.selector);
        theMarket.list(id, ASK, T0, fp, f);              // now is not the future
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.BadExpiry.selector);
        theMarket.list(id, ASK, 0, fp, f);
        assertFalse(hub.locked(id));
        // a year exactly, under a seal of a year exactly
        _list(id, alice, ASK, T0 + 365 days, f);
        assertEq(uint256(theMarket.listingOf(id).expiresAt), uint256(T0 + 365 days));
    }

    function test_anExpiredOrStaleListingCannotFillAndAnyoneMayClearIt() public {
        uint256 id = _sealed(alice, EXP);
        _list(id, alice);
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        vm.warp(EXP - 1);
        vm.prank(stranger);
        vm.expectRevert(IMarketEvents.NotHolder.selector);
        theMarket.delist(id);                                   // live: the holder's to end
        vm.warp(EXP);
        vm.prank(bob);
        vm.expectRevert(IMarketEvents.Expired.selector);
        theMarket.buy{value: ASK}(id, ASK, pinned);
        assertTrue(hub.locked(id));
        vm.prank(stranger);
        theMarket.delist(id);                                   // dead: anyone's, because its lock protects nobody
        assertFalse(hub.locked(id));
        assertEq(theMarket.listingOf(id).seller, address(0));
        assertEq(hub.ownerOf(id), alice, "clearing a dead listing moves nothing");

        // stale by a panic, the same rule: an heir must never wait for ever on a listing a lost key posted
        uint64 later = uint64(block.timestamp) + 30 days;
        uint256 id2 = _sealed(carol, later);
        _list(id2, carol, ASK, later, _noFloors());
        vm.prank(stranger);
        vm.expectRevert(IMarketEvents.NotHolder.selector);
        theMarket.delist(id2);
        vm.prank(carol);
        hub.panic(id2);
        vm.prank(stranger);
        theMarket.delist(id2);
        assertFalse(hub.locked(id2));
        assertEq(hub.ownerOf(id2), carol);
    }

    /*═══════════════════ the floors ═══════════════════*/

    function test_aNativeFloorIsCheckedOnTheReachsBalance() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        vm.deal(address(r), 1 ether);
        _list(id, alice, ASK, EXP, _floor(address(0), 1 ether));
        // the balance falls under the floor (the seal refuses value while sealed, so this is the test's hand, not the seller's)
        vm.deal(address(r), 0.5 ether);
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        _revertsWith(bob, ASK, _buyCall(id, ASK, pinned), _floorBroken(address(0), 1 ether, 0.5 ether));
        assertEq(hub.ownerOf(id), alice);
        // made whole again it fills, and the ether is in the buyer's Reach
        vm.deal(address(r), 1 ether);
        _buy(id, bob);
        assertEq(hub.ownerOf(id), bob);
        assertEq(r.owner(), bob);
        assertEq(address(r).balance, 1 ether);
    }

    function test_anAssetThatDoesNotAnswerReadsAsZeroOnTheFloor() public {
        uint256 id = _sealed(alice, EXP);
        Reach r = reachAt(id);
        bytes32 fp = hub.getStateFingerprint(id);
        // no code at the asset: zero, not a revert and not a pass
        address codeless = address(0xDEAD);
        _revertsWith(alice, 0, _listCall(id, ASK, EXP, fp, _floor(codeless, 1)), _floorBroken(codeless, 1, 0));
        // a token that answers at the listing and goes blind before the fill
        HostileToken h = new HostileToken();
        h.mint(address(r), 5e18);
        _list(id, alice, ASK, EXP, _floor(address(h), 5e18));
        h.setMode(5);
        bytes32 pinned = theMarket.listingOf(id).fingerprint;
        _revertsWith(bob, ASK, _buyCall(id, ASK, pinned), _floorBroken(address(h), 5e18, 0));
        assertEq(hub.ownerOf(id), alice);
        // seeing again, it fills
        h.setMode(0);
        _buy(id, bob);
        assertEq(hub.ownerOf(id), bob);
    }

    /*═══════════════════ the ledger ═══════════════════*/

    function test_claimWithNothingOwedReverts() public {
        vm.prank(stranger);
        vm.expectRevert(IMarketEvents.NothingOwed.selector);
        theMarket.claim();
        uint256 id = _sealed(alice, EXP);
        _list(id, alice);
        _buy(id, bob);
        vm.prank(bob);
        vm.expectRevert(IMarketEvents.NothingOwed.selector);
        theMarket.claim();                        // the buyer is owed nothing
        uint256 a0 = alice.balance;
        vm.prank(alice);
        theMarket.claim();
        assertEq(alice.balance, a0 + ASK);
        vm.prank(alice);
        vm.expectRevert(IMarketEvents.NothingOwed.selector);
        theMarket.claim();                        // and only once
    }

    function test_aReenteringClaimantIsRefused() public {
        MarketClaimant payee = new MarketClaimant(address(theMarket));
        vm.prank(timelock);
        hub.setRoyalty(address(payee), 500);
        uint256 id = _sealed(alice, EXP);
        _list(id, alice);
        _buy(id, bob);
        assertEq(theMarket.owed(address(payee)), 0.5 ether);
        payee.setMode(1);
        payee.claim();
        assertEq(address(payee).balance, 0.5 ether, "paid exactly once");
        assertEq(payee.received(), 0.5 ether);
        assertFalse(payee.innerOk(), "the re-entry was refused");
        assertEq(bytes32(payee.innerError()), bytes32(IMarketEvents.Reentrancy.selector), "it met the lock, not an empty ledger");
        assertEq(theMarket.owed(address(payee)), 0);
        assertEq(address(theMarket).balance, ASK - 0.5 ether, "the seller's share is untouched");
    }

    function test_aRefusedPaymentStaysOwed() public {
        MarketClaimant payee = new MarketClaimant(address(theMarket));
        vm.prank(timelock);
        hub.setRoyalty(address(payee), 500);
        uint256 id = _sealed(alice, EXP);
        _list(id, alice);
        _buy(id, bob);
        payee.setMode(2);
        vm.expectRevert(IMarketEvents.TransferFailed.selector);
        payee.claim();
        assertEq(theMarket.owed(address(payee)), 0.5 ether, "a refused send leaves the ledger as it was");
        assertEq(address(theMarket).balance, ASK);
        payee.setMode(0);
        payee.claim();
        assertEq(address(payee).balance, 0.5 ether);
        // the seller's share was never at risk from the payee's wallet
        vm.prank(alice);
        theMarket.claim();
        assertEq(address(theMarket).balance, 0);
    }
}
