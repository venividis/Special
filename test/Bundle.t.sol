// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BundleFixture} from "./helpers/Deploy.sol";
import {IIntact, IIntactEvents, Status, Traits} from "../src/interfaces/IIntact.sol";
import {IERC5169} from "../src/interfaces/Standards.sol";
import {IReachEvents, AssetCap, OpenApproval} from "../src/interfaces/IReach.sol";
import {IPool, IPoolEvents, Market} from "../src/interfaces/IPool.sol";
import {ILaunchpadEvents, LaunchParams, Launch, LaunchState, Target} from "../src/interfaces/ILaunchpad.sol";
import {IKilnEvents, ICoin} from "../src/interfaces/IKiln.sol";
import {IParley, IParleyEvents} from "../src/interfaces/IParley.sol";
import {Inbox} from "../src/interfaces/IPostage.sol";
import {Rights} from "../src/lib/Rights.sol";
import {Reach} from "../src/Reach.sol";
import {Grip} from "../src/Grip.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/*───────────────────────────────────────────────────────────────────────────
  The bundle, end to end (wave-1 integration)

  Every suite before this one proved a unit against stand-ins for the
  others. This one deploys the real hub (in the build INTACT_IMPL names)
  with the real Reach, Grip, Pool, Parley, Roster, Postage, KeyRegistry,
  Locks, Steward, Timelock, Kiln and Launchpad, all pinned to one another,
  and walks the holder's journey across them: a mint makes two hands and
  an empty bundle; one token opens a market, speaks and launches; a
  graduation leaves a sealed market whose fees reach the Reach; a sale
  carries the market, the voice and the fee stream to the buyer and kills
  every delegated right; a buy-back revives nothing; a panic reaches every
  satellite; the steward moves the whole bundle to the heir.

  The sentences are DESIGN.md §2's "what sale revokes" and "what survives",
  read against six contracts at once rather than one.
───────────────────────────────────────────────────────────────────────────*/
contract BundleTest is BundleFixture {
    address dave = address(0xDA7E);
    address heir = address(0x4E12);
    address agent = address(0xA6E7);
    address op = address(0x0A);
    address renter = address(0x2E);
    address trader = address(0x72ADE2);
    address stranger = address(0x57A);

    uint256 constant SUPPLY = 1_000_000_000e18;
    uint256 constant RAISE = 900_000_000e18;
    uint128 constant CURVE = 700_000_000e18;
    uint128 constant VQ = 1 ether;
    uint128 constant TARGET = 3 ether;
    uint64 constant FOREVER = type(uint64).max;
    uint64 constant QUIET = 30 days;
    uint64 constant NOTICE = 14 days;
    bytes32 constant SALT = keccak256("the heir's salt");
    bytes4 constant XFER = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 constant APPROVE = bytes4(keccak256("approve(address,uint256)"));

    MockERC20 weth;

    function setUp() public {
        setUpBundle();
        weth = new MockERC20("Wrapped Ether", "WETH", 18, 0, false);
        vm.deal(dave, 100 ether);
        vm.deal(heir, 10 ether);
        vm.deal(trader, 100 ether);
        vm.deal(stranger, 10 ether);
    }

    /*═══════════════════ helpers ═══════════════════*/

    /// @dev The holder's owned market: 100 WETH against 10 ETH, no sniper fee.
    function _openMarket(uint256 id, address by) internal {
        weth.mint(by, 1_000e18);
        vm.startPrank(by);
        weth.approve(address(thePool), type(uint256).max);
        thePool.openMarket(id, address(weth), address(0), 30, 0, 0, 0);
        thePool.deposit{value: 10 ether}(id, 100e18, 10 ether);
        vm.stopPrank();
    }

    function _params(uint256 id, address coin) internal view returns (LaunchParams memory p) {
        p = LaunchParams({
            id: id, coin: coin, curveSupply: CURVE, virtualQuote: VQ, graduationTarget: TARGET,
            startsAt: 0, fairWindow: 0, maxBuyInWindow: type(uint128).max, snipeTaxStartBps: 0, feeBps: 0,
            creatorBps: 0, creatorVestBps: 0, deadline: uint64(block.timestamp + 7 days), target: Target.OwnedPool
        });
    }

    function _buy(uint256 launchId, address who, uint256 value) internal {
        vm.prank(who);
        theLaunchpad.buy{value: value}(launchId, 0, uint64(block.timestamp), 10_000);
    }

    /// @dev A standard launch: the Kiln mints to the Reach, three one-ether
    ///      buys meet the target, a stranger graduates it into a sealed market.
    function _launchAndGraduate(uint256 id, address by) internal returns (uint256 launchId, address coin, uint256 key) {
        vm.prank(by);
        coin = theKiln.launch(id, "Agent One", "AGENT1", 18, SUPPLY, bytes32(uint256(1)), RAISE);
        vm.prank(by);
        launchId = theLaunchpad.create(_params(id, coin));
        _buy(launchId, bob, 1 ether);
        _buy(launchId, carol, 1 ether);
        _buy(launchId, dave, 1 ether);
        vm.prank(stranger);
        theLaunchpad.graduate(launchId);
        key = thePool.sealedKey(theLaunchpad.launchKey(launchId));
    }

    /// @dev A buy and a half-sell on the sealed market, so both fee legs accrue.
    function _tradeSealed(uint256 key, address coin) internal {
        vm.startPrank(trader);
        uint256 got = thePool.swapExactIn{value: 1 ether}(key, false, 1 ether, 0, trader, FOREVER);
        ICoin(coin).approve(address(thePool), got);
        thePool.swapExactIn(key, true, got / 2, 0, trader, FOREVER);
        vm.stopPrank();
    }

    /// @dev A session for `agent`: WETH transfers from the Reach, one day.
    function _grantAgent(uint256 id, address by) internal {
        Reach r = reachAt(id);
        weth.mint(address(r), 100e18);
        address[] memory targets = new address[](1);
        targets[0] = address(weth);
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = XFER;
        AssetCap[] memory caps;
        vm.prank(by);
        r.grantSession(agent, uint64(block.timestamp + 1 days), 0, caps, targets, selectors, 0, 0);
    }

    /// @dev The holder publishes an X25519 key and binds it to the token under the current epoch.
    function _bindKey(uint256 id, address by) internal {
        vm.startPrank(by);
        theKeys.setEncryptionKey(1, abi.encodePacked(keccak256(abi.encode("pubkey", by, block.timestamp))));
        theParley.bindKey(id);
        vm.stopPrank();
    }

    function _arrange(uint256 id, address by) internal {
        address[] memory none;
        bytes32 h = theSteward.heirHashOf(heir, SALT);     // before the prank: a view call would consume it
        vm.prank(by);
        theSteward.arrange(id, h, QUIET, NOTICE, none, 0);
    }

    /// @dev The commons and a home room, derived locally: a view call inside
    ///      a pranked statement's arguments would consume the prank (forge
    ///      and this runner agree), so the keys are computed here and pinned
    ///      against Parley's own derivation in the first test.
    uint256 constant COMMONS = 0;
    function _home(uint256 id) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(uint8(3), id)));
    }

    function _keyIdOf(uint256 id) internal view returns (bytes32 keyId) {
        (, keyId, ) = theParley.keyOf(id);
    }

    function _homeCount(uint256 id) internal view returns (uint64 count) {
        (, count, , , , , , , , , ) = theParley.stateOf(_home(id));
    }

    /*═══════════════════ the seven sentences ═══════════════════*/

    function test_mintMakesBothHandsAndAnEmptyBundle() public {
        // the pinned world agrees in both directions, before any token exists
        assertEq(hub.POOL(), address(thePool));
        assertEq(thePool.HUB(), address(hub));
        assertEq(thePool.LAUNCHPAD(), address(theLaunchpad));
        assertEq(hub.PARLEY(), address(theParley));
        assertEq(theParley.HUB(), address(hub));
        assertEq(theParley.KEYS(), address(theKeys));
        assertEq(theParley.POSTAGE(), address(thePostage));
        assertEq(thePostage.PARLEY(), address(theParley));
        assertEq(thePostage.HUB(), address(hub));
        assertEq(theRoster.PARLEY(), address(theParley));
        assertEq(theRoster.HUB(), address(hub));
        assertEq(hub.LAUNCHPAD(), address(theLaunchpad));
        assertEq(theLaunchpad.HUB(), address(hub));
        assertEq(theLaunchpad.KILN(), address(theKiln));
        assertEq(theLaunchpad.POOL(), address(thePool));
        assertEq(theLaunchpad.LOCKS(), address(theLocks));
        assertEq(theKiln.HUB(), address(hub));
        assertEq(theKiln.LAUNCHPAD(), address(theLaunchpad));
        assertEq(hub.LOCKS(), address(theLocks));
        assertEq(theLocks.HUB(), address(hub));
        assertEq(hub.STEWARD(), address(theSteward));
        assertEq(theSteward.HUB(), address(hub));
        assertEq(hub.TIMELOCK(), address(theTimelock));
        assertEq(theTimelock.admin(), admin);
        assertEq(hub.REACH_IMPL(), address(theReach));
        assertEq(hub.GRIP_IMPL(), address(theGrip));

        uint256 id = mintTo(alice);
        Reach r = reachAt(id);
        Grip g = gripAt(id);

        // two hands, both the 173-byte forwarder, both verified by the hub
        assertEq(address(r).code.length, 173);
        assertEq(address(g).code.length, 173);
        assertTrue(hub.isCanonicalAccount(address(r), id, false));
        assertTrue(hub.isCanonicalAccount(address(g), id, true));
        (uint256 chain, address collection, uint256 bound) = r.token();
        assertEq(chain, block.chainid);
        assertEq(collection, address(hub));
        assertEq(bound, id);
        assertEq(r.HUB(), address(hub));
        assertEq(r.owner(), alice);
        assertEq(g.owner(), alice);
        assertTrue(g.isOneWay());
        assertEq(g.state(), 0);
        assertEq(r.state(), 0);
        assertEq(r.sealedUntil(), 0);
        assertEq(hub.feeSink(id), address(r));
        assertEq(hub.agentWalletOf(id), address(r));
        assertTrue(hub.statusOf(id) == Status.Active);
        assertEq(hub.custodyEpoch(id), 1);
        assertEq(bitsOf(id, alice), Rights.R_HOLD);
        assertEq(bitsOf(id, address(r)), Rights.R_ACCOUNT);
        assertEq(bitsOf(id, address(g)), 0, "the Grip acts nowhere");

        // the room keys this suite derives locally are Parley's own
        assertEq(theParley.COMMONS(), COMMONS);
        assertEq(theParley.homeKey(id), _home(id));

        // every satellite reports nothing for a token that has done nothing
        assertFalse(thePool.marketOf(id).open);
        assertEq(_homeCount(id), 0);
        assertEq(_keyIdOf(id), bytes32(0));
        assertEq(theRoster.heldBy(id), alice);
        assertEq(theLaunchpad.launchesOf(id).length, 0);
        assertEq(theLaunchpad.launchRoot(id), bytes32(0));
        assertEq(theKiln.launchCount(id), 0);
        assertFalse(theLaunchpad.firstLaunchApproved(id));
        assertEq(theLocks.commitmentOf(address(r)), bytes32(0));
        assertEq(theLocks.lockCountOf(address(r)), 0);
        assertEq(theSteward.wouldPass(id), theSteward.NO_PLAN());
        assertEq(theSteward.planHash(id), bytes32(0));
        Inbox memory ib = thePostage.inboxOf(id);
        assertTrue(ib.open);
        assertEq(ib.postage, 0);

        // the fingerprint reads the whole bundle and is stable while nothing moves
        bytes32 fp = hub.getStateFingerprint(id);
        assertTrue(fp != bytes32(0));
        assertEq(hub.getStateFingerprint(id), fp);
        assertEq(hub.getTraitValue(id, Traits.MARKET_SEALED_UNTIL), bytes32(0));
        assertEq(hub.getTraitValue(id, Traits.SEALED_UNTIL), bytes32(0));

        // ERC-5169 is claimed honestly: the setter exists and refuses everyone, the curator included
        assertTrue(hub.supportsInterface(type(IERC5169).interfaceId));
        string[] memory uri = hub.scriptURI();
        assertEq(uri.length, 1);
        vm.prank(address(theTimelock));
        vm.expectRevert(IIntactEvents.NotTimelock.selector);
        hub.setScriptURI(uri);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotTimelock.selector);
        hub.setScriptURI(uri);

        // and the curated surface answers only to the Timelock
        vm.prank(admin);
        vm.expectRevert(IIntactEvents.NotTimelock.selector);
        hub.setPrice(1);
    }

    function test_theHolderOpensAMarketSpeaksAndLaunchesFromOneToken() public {
        uint256 id = mintTo(alice);
        Reach r = reachAt(id);
        bytes32 fp0 = hub.getStateFingerprint(id);

        // the market
        _openMarket(id, alice);
        Market memory m = thePool.marketOf(id);
        assertTrue(m.open);
        assertEq(uint256(m.rBase), 100e18);
        assertEq(uint256(m.rQuote), 10 ether);
        bytes32 fp1 = hub.getStateFingerprint(id);
        assertTrue(fp1 != fp0, "the market is in the fingerprint");
        vm.prank(trader);
        uint256 got = thePool.swapExactIn{value: 1 ether}(id, false, 1 ether, 0, trader, FOREVER);
        assertGt(got, 0);
        assertEq(weth.balanceOf(trader), got);

        // the token's own hand acts in its market (acts, not holds): approve, then deposit, through execute
        weth.mint(address(r), 10e18);
        vm.deal(address(r), 5 ether);
        vm.prank(alice);
        r.execute(address(weth), 0, abi.encodeWithSelector(APPROVE, address(thePool), 10e18), 0);
        vm.prank(alice);
        r.execute(address(thePool), 1 ether, abi.encodeCall(IPool.deposit, (id, 10e18, 1 ether)), 0);
        assertEq(uint256(thePool.marketOf(id).rQuote), 12 ether, "the trade's ether and the Reach's deposit");
        OpenApproval[] memory ledger = r.openApprovals();
        assertEq(ledger.length, 1, "the approval the Reach gave is on its ledger");
        assertEq(ledger[0].asset, address(weth));
        assertEq(ledger[0].spender, address(thePool));
        bytes32 fp2 = hub.getStateFingerprint(id);
        assertTrue(fp2 != fp1, "the Reach's state and ledger are in the fingerprint");

        // the voice: the commons, then the home room, which opens on the first word
        vm.prank(alice);
        theParley.speak(COMMONS, id, 0, 0, 0, "hello, commons");
        vm.roll(block.number + 2);
        vm.prank(alice);
        theParley.speak(_home(id), id, 0, 0, 0, "the first word at home");
        assertEq(_homeCount(id), 1);
        assertEq(theRoster.kindOf(_home(id)), theParley.IS_HOME());
        vm.prank(bob);
        vm.expectRevert(IParleyEvents.NotYours.selector);
        theParley.speak(COMMONS, id, 0, 0, 0, "as alice");
        uint256 other = mintTo(bob);
        vm.prank(bob);
        theParley.join(_home(id), other);                 // follow = join of the home room
        assertTrue(theParley.inRoom(_home(id), other));
        (uint256[] memory members, ) = theRoster.membersOf(_home(id), 0);
        assertEq(members.length, 1);
        assertEq(members[0], other);
        vm.roll(block.number + 2);
        vm.prank(alice);
        r.execute(address(theParley), 0,
            abi.encodeCall(IParley.speak, (COMMONS, id, 0, 0, 0, bytes("from my own hand"))), 0);

        // a key bound to the token under this epoch
        _bindKey(id, alice);
        (uint16 keyType, bytes32 keyId, ) = theParley.keyOf(id);
        assertEq(keyType, 1);
        assertTrue(keyId != bytes32(0));

        // the launch: the coin lands in the Reach, the raise share in the Launchpad, the launch in the root
        vm.prank(alice);
        address coin = theKiln.launch(id, "Agent One", "AGENT1", 18, SUPPLY, bytes32(uint256(1)), RAISE);
        assertEq(ICoin(coin).balanceOf(address(r)), SUPPLY - RAISE);
        assertEq(ICoin(coin).balanceOf(address(theLaunchpad)), RAISE);
        assertEq(ICoin(coin).LAUNCHER(), id);
        vm.prank(alice);
        uint256 launchId = theLaunchpad.create(_params(id, coin));
        assertEq(theLaunchpad.launchesOf(id).length, 1);
        assertEq(theLaunchpad.launchesOf(id)[0], launchId);
        assertEq(theKiln.launchCount(id), 1);
        assertTrue(theLaunchpad.launchRoot(id) != bytes32(0));
        assertTrue(hub.getStateFingerprint(id) != fp2, "the launch is in the fingerprint");
        assertTrue(theLaunchpad.launchOf(launchId).state == LaunchState.Live);
    }

    function test_aGraduationOpensASealedMarketWhoseCollectPaysTheReach() public {
        uint256 id = mintTo(alice);
        Reach r = reachAt(id);
        (uint256 launchId, address coin, uint256 key) = _launchAndGraduate(id, alice);

        Launch memory l = theLaunchpad.launchOf(launchId);
        assertTrue(l.state == LaunchState.Graduated);
        assertEq(l.marketKey, key);
        Market memory m = thePool.marketOf(key);
        assertTrue(m.open && m.sealedMarket);
        assertEq(m.beneficiary, id, "the sealed market pays this token's feeSink");
        assertEq(m.base, coin);
        assertEq(m.quote, address(0));
        assertEq(uint256(m.rQuote), 3 ether, "the whole raise is principal");
        assertEq(thePool.sealedCount(), 1);
        assertEq(address(theLaunchpad).balance, 0);

        // nobody withdraws principal, not even the holder
        vm.prank(alice);
        vm.expectRevert(IPoolEvents.SealedMarket.selector);
        thePool.withdraw(key, 1, 0, alice);

        // trades accrue fees beside the reserves, and anyone collects them to the Reach
        _tradeSealed(key, coin);
        m = thePool.marketOf(key);
        assertGt(uint256(m.feeQuoteOwed), 0);
        assertGt(uint256(m.feeBaseOwed), 0);
        uint256 e0 = address(r).balance;
        uint256 c0 = ICoin(coin).balanceOf(address(r));
        vm.prank(stranger);
        thePool.collect(key);
        assertEq(address(r).balance - e0, uint256(m.feeQuoteOwed), "the quote fee reached the Reach");
        assertEq(ICoin(coin).balanceOf(address(r)) - c0, uint256(m.feeBaseOwed), "the base fee reached the Reach");
        assertEq(uint256(thePool.marketOf(key).feeQuoteOwed), 0);

        // the holder may route the stream into the Grip instead, where it is permanently unspendable
        vm.prank(alice);
        hub.setFeesToGrip(id, true);
        assertEq(hub.feeSink(id), address(gripAt(id)));
        _tradeSealed(key, coin);
        m = thePool.marketOf(key);
        uint256 g0 = address(gripAt(id)).balance;
        thePool.collect(key);
        assertEq(address(gripAt(id)).balance - g0, uint256(m.feeQuoteOwed));

        // buyers claim what they bought; the Reach spends what it was paid, on the holder's word
        vm.prank(stranger);
        theLaunchpad.claim(launchId, bob);
        assertGt(ICoin(coin).balanceOf(bob), 0);
        uint256 paid = address(r).balance;
        assertGt(paid, 0);
        vm.prank(alice);
        r.execute(alice, paid, "", 0);
        assertEq(address(r).balance, 0);
    }

    function test_sellingTheTokenSellsTheMarketTheVoiceTheLaunchFeesAndKillsEverySession() public {
        uint256 id = mintTo(alice);
        Reach r = reachAt(id);
        _openMarket(id, alice);
        (, address coin, uint256 key) = _launchAndGraduate(id, alice);
        _bindKey(id, alice);
        vm.prank(alice);
        thePostage.configureInbox(id, address(0), 0.1 ether, 1 days, true);
        assertEq(thePostage.inboxOf(id).postage, 0.1 ether);
        vm.prank(alice);
        theParley.speak(_home(id), id, 0, 0, 0, "home");
        _grantAgent(id, alice);
        vm.prank(agent);
        r.executeAsSession(address(weth), 0, abi.encodeWithSelector(XFER, agent, 1e18));
        assertEq(weth.balanceOf(agent), 1e18, "the session works before the sale");
        vm.prank(alice);
        r.seal(uint64(T0 + 30 days));
        vm.startPrank(alice);
        hub.setGuardian(id, guardian);
        hub.approve(carol, id);
        hub.setUser(id, renter, uint64(T0 + 10 days));
        vm.stopPrank();
        Market memory before = thePool.marketOf(id);
        bytes32 fpBefore = hub.getStateFingerprint(id);

        // the sale
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.ownerOf(id), bob);
        assertEq(hub.custodyEpoch(id), 2);
        assertTrue(hub.statusOf(id) == Status.Paused);
        assertEq(hub.guardianOf(id), address(0));
        assertEq(hub.getApproved(id), address(0));
        assertEq(hub.userOf(id), address(0));
        assertTrue(hub.getStateFingerprint(id) != fpBefore);

        // the market went with it: reserves untouched, the buyer its sole LP, the seller a stranger to it
        Market memory after_ = thePool.marketOf(id);
        assertEq(uint256(after_.rBase), uint256(before.rBase));
        assertEq(uint256(after_.rQuote), uint256(before.rQuote));
        vm.prank(alice);
        vm.expectRevert(IPoolEvents.NotActor.selector);
        thePool.withdraw(id, 1e18, 0, alice);
        vm.prank(bob);
        thePool.withdraw(id, 1e18, 0, bob);
        assertEq(weth.balanceOf(bob), 1e18);

        // the voice: the seller cannot speak as it, the buyer can; the key binding is stale; the inbox is open and free again
        vm.roll(block.number + 2);
        vm.prank(alice);
        vm.expectRevert(IParleyEvents.NotYours.selector);
        theParley.speak(_home(id), id, 0, 0, 0, "still me?");
        vm.prank(bob);
        theParley.speak(_home(id), id, 0, 0, 0, "new holder");
        assertEq(_homeCount(id), 2, "the archive is the token's, not the seller's");
        assertEq(_keyIdOf(id), bytes32(0));
        Inbox memory ib = thePostage.inboxOf(id);
        assertTrue(ib.open);
        assertEq(ib.postage, 0);

        // the launch's fee stream: collect still pays the Reach, and the Reach now answers to the buyer
        _tradeSealed(key, coin);
        Market memory sm = thePool.marketOf(key);
        uint256 e0 = address(r).balance;
        thePool.collect(key);
        assertEq(address(r).balance - e0, uint256(sm.feeQuoteOwed));
        assertEq(r.owner(), bob);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.execute(alice, 1, "", 0);

        // every session died with the epoch; the seal survived the sale (the buyer's protection)
        assertFalse(r.sessionCurrent(agent));
        assertEq(bitsOf(id, agent), 0);
        vm.prank(agent);
        vm.expectRevert(IReachEvents.SoldOn.selector);
        r.executeAsSession(address(weth), 0, abi.encodeWithSelector(XFER, agent, 1e18));
        assertEq(r.sealedUntil(), T0 + 30 days);
        vm.prank(bob);
        vm.expectRevert(IReachEvents.ValueWhileSealed.selector);
        r.execute(bob, 1, "", 0);

        // the seller cannot launch from it; the buyer can, once the spacing and the seal have run
        vm.prank(alice);
        vm.expectRevert(IKilnEvents.NotActor.selector);
        theKiln.launch(id, "Two", "TWO", 18, SUPPLY, bytes32(uint256(2)), 0);
        vm.warp(T0 + 31 days);
        vm.prank(bob);
        theKiln.launch(id, "Two", "TWO", 18, SUPPLY, bytes32(uint256(2)), 0);
        assertEq(theKiln.launchCount(id), 2);
        uint256 held = address(r).balance;
        vm.prank(bob);
        r.execute(bob, held, "", 0);
        assertEq(address(r).balance, 0, "what the stream paid is the buyer's to take");
    }

    function test_aBuyBackRevivesNothingAnywhere() public {
        uint256 id = mintTo(alice);
        Reach r = reachAt(id);
        _bindKey(id, alice);
        _grantAgent(id, alice);
        vm.startPrank(alice);
        thePostage.configureInbox(id, address(0), 0.1 ether, 1 days, true);
        hub.setGuardian(id, guardian);
        hub.setApprovalForAll(op, true);
        vm.stopPrank();
        vm.prank(guardian);
        theLaunchpad.approveFirstLaunch(id);
        assertTrue(theLaunchpad.firstLaunchApproved(id));
        _arrange(id, alice);
        assertEq(theSteward.wouldPass(id), theSteward.SPEAKING());
        assertTrue(r.sessionCurrent(agent));

        // away and back
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        vm.prank(bob);
        hub.transferFrom(bob, alice, id);
        assertEq(hub.ownerOf(id), alice);
        assertEq(hub.custodyEpoch(id), 3);

        assertFalse(r.sessionCurrent(agent), "the session named epoch 1");
        assertEq(bitsOf(id, agent), 0);
        vm.prank(agent);
        vm.expectRevert(IReachEvents.SoldOn.selector);
        r.executeAsSession(address(weth), 0, abi.encodeWithSelector(XFER, agent, 1e18));
        assertEq(_keyIdOf(id), bytes32(0), "the key binding named epoch 1");
        assertEq(thePostage.inboxOf(id).postage, 0, "the inbox price named epoch 1");
        assertEq(theSteward.wouldPass(id), theSteward.SOLD(), "the plan named epoch 1");
        assertEq(theSteward.planHash(id), bytes32(0));
        assertFalse(theLaunchpad.firstLaunchApproved(id), "the co-sign named epoch 1");
        assertEq(hub.guardianOf(id), address(0));
        assertTrue(hub.statusOf(id) == Status.Paused);
        assertEq(bitsOf(id, alice), Rights.R_HOLD);
        // operator approvals are per owner, not per token: alice's grant never left alice (DESIGN §2)
        assertTrue(hub.isApprovedForAll(alice, op));
        assertEq(bitsOf(id, op), Rights.R_CUSTODY);

        // nothing revives by itself; everything is re-armed by the holder, under the new epoch
        vm.prank(alice);
        hub.setStatus(id, Status.Active);
        _grantAgent(id, alice);
        assertTrue(r.sessionCurrent(agent));
        vm.prank(agent);
        r.executeAsSession(address(weth), 0, abi.encodeWithSelector(XFER, agent, 1e18));
        _bindKey(id, alice);
        assertTrue(_keyIdOf(id) != bytes32(0));
        _arrange(id, alice);
        assertEq(theSteward.wouldPass(id), theSteward.SPEAKING());
        vm.prank(alice);
        thePostage.configureInbox(id, address(0), 0.2 ether, 1 days, true);
        assertEq(thePostage.inboxOf(id).postage, 0.2 ether);
    }

    function test_panicRevokesAcrossEverySatellite() public {
        uint256 id = mintTo(alice);
        Reach r = reachAt(id);
        vm.deal(address(r), 1 ether);
        _bindKey(id, alice);
        _grantAgent(id, alice);
        vm.startPrank(alice);
        thePostage.configureInbox(id, address(0), 0.1 ether, 1 days, true);
        hub.setGuardian(id, guardian);
        hub.setApprovalForAll(op, true);
        hub.approve(carol, id);
        hub.setUser(id, renter, uint64(T0 + 10 days));
        vm.stopPrank();
        vm.prank(guardian);
        theLaunchpad.approveFirstLaunch(id);
        _arrange(id, alice);

        // the holder's panic: both epochs move, the Reach seals to its maximum, every satellite goes stale
        vm.prank(alice);
        hub.panic(id);
        assertEq(hub.custodyEpoch(id), 2);
        assertEq(hub.approvalEpoch(alice), 1);
        assertTrue(hub.statusOf(id) == Status.Paused);
        assertEq(r.sealedUntil(), T0 + 365 days);
        assertFalse(r.sessionCurrent(agent));
        assertEq(_keyIdOf(id), bytes32(0));
        assertEq(thePostage.inboxOf(id).postage, 0);
        assertEq(theSteward.wouldPass(id), theSteward.SOLD());
        assertFalse(theLaunchpad.firstLaunchApproved(id));
        assertFalse(hub.isApprovedForAll(alice, op));
        assertEq(hub.getApproved(id), address(0));
        assertEq(hub.userOf(id), address(0));
        assertEq(bitsOf(id, op) | bitsOf(id, carol) | bitsOf(id, renter) | bitsOf(id, agent), 0);
        assertEq(bitsOf(id, guardian), Rights.R_GUARDIAN, "panic keeps the guardian: appointed, not delegated");
        assertEq(bitsOf(id, alice), Rights.R_HOLD);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.ValueWhileSealed.selector);
        r.execute(alice, 1, "", 0);

        // a second panic in the same block, by the guardian: the seal is a fixed point at its cap, the token goes under hold
        vm.prank(guardian);
        hub.panic(id);
        assertEq(hub.custodyEpoch(id), 3);
        assertEq(r.sealedUntil(), T0 + 365 days);
        assertTrue(hub.locked(id));
        assertTrue(hub.coreOf(id).guardianHold);
        assertEq(theSteward.wouldPass(id), theSteward.SOLD());
        assertFalse(r.sessionCurrent(agent));

        // under the hold only the holder in person moves it, and only the holder releases
        vm.prank(guardian);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.release(id);
        vm.prank(alice);
        hub.release(id);
        assertFalse(hub.locked(id));
        assertEq(hub.guardianOf(id), guardian);

        // and a third, by the holder again, in the same block
        vm.prank(alice);
        hub.panic(id);
        assertEq(hub.custodyEpoch(id), 4);
        assertEq(r.sealedUntil(), T0 + 365 days);
    }

    function test_theStewardMovesTheWholeBundle() public {
        uint256 id = mintTo(alice);
        Reach r = reachAt(id);
        _openMarket(id, alice);
        (, address coin, uint256 key) = _launchAndGraduate(id, alice);
        _bindKey(id, alice);
        _grantAgent(id, alice);
        vm.prank(alice);
        uint256 lockId = theLocks.lock{value: 1 ether}(address(0), 1 ether, address(r), 0, uint64(T0 + 60 days), uint64(T0 + 60 days), false);
        assertTrue(theLocks.commitmentOf(address(r)) != bytes32(0));
        _arrange(id, alice);
        bytes32 fp = hub.getStateFingerprint(id);
        Market memory before = thePool.marketOf(id);

        // silence, then the summons: the Steward's lock holds the token through the notice
        vm.warp(T0 + QUIET);
        assertEq(theSteward.wouldPass(id), theSteward.SUMMONABLE());
        vm.prank(stranger);
        theSteward.summon(id, heir, SALT);
        assertEq(theSteward.wouldPass(id), theSteward.WAITING());
        assertTrue(hub.locked(id));
        assertFalse(hub.isTransferable(id, alice, bob));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IIntactEvents.IsLocked.selector, id));
        hub.transferFrom(alice, bob, id);

        // the notice runs out unanswered; anyone presses
        vm.warp(T0 + QUIET + NOTICE);
        assertEq(theSteward.wouldPass(id), theSteward.OK());
        vm.prank(stranger);
        theSteward.execute(id);
        assertEq(hub.ownerOf(id), heir);
        assertFalse(hub.locked(id));
        assertEq(hub.custodyEpoch(id), 2);
        assertTrue(hub.statusOf(id) == Status.Paused);
        assertTrue(hub.getStateFingerprint(id) != fp);

        // the heir holds the whole bundle: the hands, the market, the voice, the fee stream, the lock
        assertEq(r.owner(), heir);
        assertEq(gripAt(id).owner(), heir);
        assertEq(theRoster.heldBy(id), heir);
        Market memory m = thePool.marketOf(id);
        assertTrue(m.open);
        assertEq(uint256(m.rBase), uint256(before.rBase));
        vm.prank(alice);
        vm.expectRevert(IPoolEvents.NotActor.selector);
        thePool.withdraw(id, 1e18, 0, alice);
        vm.prank(heir);
        thePool.withdraw(id, 1e18, 0, heir);
        assertEq(weth.balanceOf(heir), 1e18);
        vm.roll(block.number + 2);
        vm.prank(heir);
        theParley.speak(_home(id), id, 0, 0, 0, "the heir speaks");
        assertEq(_homeCount(id), 1);
        _tradeSealed(key, coin);
        uint256 e0 = address(r).balance;
        thePool.collect(key);
        assertGt(address(r).balance, e0);
        vm.prank(heir);
        r.execute(heir, address(r).balance, "", 0);
        assertEq(address(r).balance, 0);
        vm.warp(T0 + 61 days);
        vm.prank(stranger);
        theLocks.release(lockId);
        assertEq(address(r).balance, 1 ether, "the lock was committed to the Reach, whoever holds the token");
        assertEq(theLaunchpad.launchesOf(id).length, 1);

        // and nothing the previous holder delegated came along
        assertFalse(r.sessionCurrent(agent));
        assertEq(_keyIdOf(id), bytes32(0));
        assertEq(theSteward.wouldPass(id), theSteward.NO_PLAN());
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.execute(alice, 0, "", 0);
    }
}
