// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Keepsake} from "../src/Keepsake.sol";
import {KeepsakeArt} from "../src/KeepsakeArt.sol";
import {
    IKeepsake, IKeepsakeEvents, Asset, Schedule, DripTerms, Wrap, SwapAndWrap, KeepsakeView
} from "../src/interfaces/IKeepsake.sol";
import {IERC165, IERC721, IERC721Metadata} from "../src/interfaces/Standards.sol";
import {Pool} from "../src/Pool.sol";
import {IPoolEvents} from "../src/interfaces/IPool.sol";
import {Ratchet} from "../src/lib/Ratchet.sol";
import {Transient} from "../src/lib/Transient.sol";
import {ExactERC20} from "../src/lib/ExactERC20.sol";
import {ERC721Base} from "../src/lib/ERC721Base.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {HostileToken} from "./mocks/HostileToken.sol";
import {PoolHub} from "./mocks/PoolFixtures.sol";
import {KeepsakeHolder, KeepsakeShortPool} from "./mocks/KeepsakeFixtures.sol";

/*───────────────────────────────────────────────────────────────────────────
  The keepsake: bundles you keep or give, that free slowly and sell slowly.

  INTACT V2 W1 (docs/V2.md §3.1). Written to break src/Keepsake.sol, guard
  by guard; docs/v2/W1-keepsake.md holds the mutation table that proves
  each named test fails when its guard is removed. The Pool is the real
  one, on PoolFixtures' hub stand-in (the Keepsake asks the hub nothing;
  the Pool asks it `ownerOf`, `account` and `feeSink` only).

  This runner is not forge (CLAUDE.md): `expectRevert(bytes)` matches any
  revert, so every refusal whose arguments matter is asserted through a
  raw call that returns the data, byte for byte; there is no log capture,
  so an event is asserted through the state it changed.
───────────────────────────────────────────────────────────────────────────*/
contract KeepsakeTest is Test {
    uint64 constant T0 = 1_733_000_000;
    uint64 constant FOREVER = 4102444800;
    uint256 constant MAX = type(uint256).max;

    uint256 constant TOKM = 1;          // tok (base) against native ETH (quote): 1,000,000 : 100
    uint256 constant USDM = 2;          // usdc (base, 6 decimals) against dai (quote): 1 : 1
    uint256 constant SPOT = 1e14;       // TOKM's opening price: ETH-wei per 1e18 tok-wei

    PoolHub hub;
    Pool pool;
    KeepsakeArt art;
    Keepsake ks;
    MockERC20 tok;
    MockERC20 usdc;
    MockERC20 dai;
    MockERC20 fot;

    address lp = address(0x11A1);
    address alice = address(0xA11CE);
    address bob = address(0xB0B0);
    address carol = address(0xCA201);
    address keeper = address(0x6EE9);

    function setUp() public {
        vm.warp(T0);
        hub = new PoolHub();
        pool = new Pool(address(hub), address(0x1A0C));
        art = new KeepsakeArt();
        ks = new Keepsake(address(hub), address(pool), address(art));
        tok = new MockERC20("Token", "TOK", 18, 0, false);
        usdc = new MockERC20("USD Coin", "USDC", 6, 0, false);
        dai = new MockERC20("Dai", "DAI", 18, 0, false);
        fot = new MockERC20("Fee", "FOT", 18, 100, false);

        vm.deal(lp, 10_000 ether);
        vm.deal(alice, 1_000 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(keeper, 1 ether);

        assertEq(hub.mint(lp), TOKM);
        assertEq(hub.mint(lp), USDM);
        tok.mint(lp, 1e30);
        usdc.mint(lp, 1e30);
        dai.mint(lp, 1e30);
        vm.startPrank(lp);
        tok.approve(address(pool), MAX);
        usdc.approve(address(pool), MAX);
        dai.approve(address(pool), MAX);
        pool.openMarket(TOKM, address(tok), address(0), 30, 0, 0, 0);
        pool.deposit{value: 100 ether}(TOKM, 1_000_000e18, 100 ether);
        pool.openMarket(USDM, address(usdc), address(dai), 30, 0, 0, 0);
        pool.deposit(USDM, 1_000_000e6, 1_000_000e18);
        vm.stopPrank();

        MockERC20[4] memory ts = [tok, usdc, dai, fot];
        for (uint256 i; i < ts.length; ++i) {
            ts[i].mint(alice, 1e27);
            ts[i].mint(carol, 1e27);
            vm.prank(alice);
            ts[i].approve(address(ks), MAX);
            vm.prank(carol);
            ts[i].approve(address(ks), MAX);
            vm.prank(carol);
            ts[i].approve(address(pool), MAX);
        }
    }

    /*═════════ helpers ═════════*/

    function _one(address token, uint256 amount) internal pure returns (Asset[] memory a) {
        a = new Asset[](1);
        a[0] = Asset(token, amount);
    }

    function _bundle() internal view returns (Asset[] memory a) {
        a = new Asset[](3);
        a[0] = Asset(address(0), 2 ether);
        a[1] = Asset(address(tok), 1_000e18);
        a[2] = Asset(address(usdc), 500e6);
    }

    function _w(Asset[] memory a, Schedule memory s, address to, string memory message)
        internal pure returns (Wrap memory w)
    {
        w.assets = a;
        w.schedule = s;
        w.to = to;
        w.message = message;
    }

    function _wrapAs(address from, Wrap memory w, uint256 value) internal returns (uint256 id) {
        vm.prank(from);
        id = ks.wrap{value: value}(w);
    }

    /// @dev A plain linear keepsake of `amount` tok, from now to `days_` out.
    function _tokTo(address to, uint256 amount, uint64 days_) internal returns (uint256) {
        return _wrapAs(alice, _w(_one(address(tok), amount), Schedule(0, 0, T0 + days_ * 1 days), to, ""), 0);
    }

    function _raw(address from, uint256 value, bytes memory data) internal returns (bool ok, bytes memory ret) {
        vm.prank(from);
        (ok, ret) = address(ks).call{value: value}(data);
    }

    function _refused(address from, uint256 value, bytes memory data, bytes memory want, string memory why) internal {
        (bool ok, bytes memory ret) = _raw(from, value, data);
        assertFalse(ok, why);
        assertEq(ret, want, why);
    }

    function _drip(uint256 market, uint256 floor, uint256 most) internal pure returns (DripTerms memory) {
        return DripTerms(0, market, floor, most);
    }

    function _terms(uint256 id) internal view returns (bytes32) {
        KeepsakeView memory v = ks.keepsakeOf(id);
        return keccak256(abi.encode(
            v.schedule.start, v.schedule.cliff, v.schedule.end, v.drip.asset, v.drip.market, v.drip.floor, v.drip.maxPerDrip));
    }

    function _free(uint256 id, uint256 i) internal view returns (uint256) {
        (Asset[] memory f, ) = ks.claimable(id);
        return f[i].amount;
    }

    function _ceil(uint256 x, uint256 f) internal pure returns (uint256) {
        return (x * f + 1e18 - 1) / 1e18;
    }

    /*═════════ wrapping, and giving ═════════*/

    function test_aGiftIsMintedToTheRecipientWithItsMessage() public {
        uint256 aliceEth = alice.balance;
        uint256 id = _wrapAs(alice, _w(_bundle(), Schedule(0, 0, T0 + 100 days), bob, "for the long road"), 2 ether);

        assertEq(id, 1, "ids start at one");
        assertEq(ks.keepsakeCount(), 1, "one keepsake exists");
        assertEq(ks.ownerOf(id), bob, "the recipient holds the gift");
        assertEq(ks.balanceOf(bob), 1, "and it is counted to the recipient");
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.holder, bob, "the view names the holder");
        assertEq(v.creator, alice, "and the giver");
        assertEq(v.createdAt, T0, "and when it was made");
        assertEq(v.schedule.start, T0, "a zero start is now");
        assertEq(v.schedule.cliff, T0, "a zero cliff is the start");
        assertEq(v.schedule.end, T0 + 100 days, "the end is the one asked for");
        assertEq(v.assets.length, 3, "three assets were wrapped");
        assertEq(v.assets[0].token, address(0), "native ETH is address zero");
        assertEq(v.assets[0].amount, 2 ether, "the ETH asset is recorded to the wei");
        assertEq(v.assets[1].token, address(tok), "the first ERC-20 is recorded");
        assertEq(v.assets[2].amount, 500e6, "the second ERC-20 is recorded in its own decimals");
        assertEq(bytes(v.message), bytes("for the long road"), "the message is on its face");
        assertEq(v.drip.floor, 0, "a gift carries no drip");
        assertEq(v.proceeds.length, 0, "and no proceeds");
        assertEq(address(ks).balance, 2 ether, "the ETH arrived to the wei");
        assertEq(tok.balanceOf(address(ks)), 1_000e18, "the first ERC-20 arrived exactly");
        assertEq(usdc.balanceOf(address(ks)), 500e6, "the second ERC-20 arrived exactly");
        assertEq(alice.balance, aliceEth - 2 ether, "the giver paid exactly the ETH asset");
        assertEq(_wrapAs(alice, _w(_one(address(dai), 1), Schedule(0, 0, T0 + 1 days), bob, ""), 0), 2, "ids count up");
    }

    function test_aGiftIsNeverRefusedByTheRecipientsCode() public {
        // a contract with no onERC721Received, refusing ETH for good measure
        KeepsakeHolder h = new KeepsakeHolder();
        h.setRefuseEth(true);
        uint256 id = _wrapAs(alice, _w(_bundle(), Schedule(0, 0, T0 + 10 days), address(h), "no callback"), 2 ether);
        assertEq(ks.ownerOf(id), address(h), "the mint asked the recipient's code nothing");
    }

    function test_aGiftDoesNotMoveTheRecipientsCommitment() public {
        assertEq(ks.commitmentOf(bob), bytes32(0), "an empty estate starts at zero");
        uint256 id = _wrapAs(alice, _w(_bundle(), Schedule(0, 0, T0 + 10 days), bob, "a gift"), 2 ether);
        assertEq(ks.commitmentOf(bob), bytes32(0), "a gift wrapped to the account does not move its commitment");
        assertEq(ks.commitmentOf(alice), bytes32(0), "nor the giver's: nothing left the giver as a keepsake");

        // a transfer IN is something a stranger can do too
        uint256 other = _tokTo(carol, 1e18, 10);
        vm.prank(carol);
        ks.transferFrom(carol, bob, other);
        assertEq(ks.commitmentOf(bob), bytes32(0), "a keepsake transferred to the account does not move its commitment");
        assertEq(ks.ownerOf(id), bob, "and the account holds both");
        assertEq(ks.ownerOf(other), bob, "the second one too");
    }

    function test_aTransferOutMovesTheSendersCommitment() public {
        uint256 id = _wrapAs(alice, _w(_bundle(), Schedule(0, 0, T0 + 10 days), bob, ""), 2 ether);
        bytes32 terms = _terms(id);
        vm.prank(bob);
        ks.transferFrom(bob, carol, id);
        assertEq(ks.commitmentOf(bob), keccak256(abi.encode(bytes32(0), id, terms)),
            "a keepsake leaving the account folds its id and terms into the sender's commitment");
        assertEq(ks.commitmentOf(carol), bytes32(0), "and the receiver's stays where it was");

        // an operator moving it moves the owner's commitment, not the operator's
        bytes32 before = ks.commitmentOf(carol);
        vm.prank(carol);
        ks.setApprovalForAll(keeper, true);
        vm.prank(keeper);
        ks.transferFrom(carol, bob, id);
        assertEq(ks.commitmentOf(carol), keccak256(abi.encode(before, id, terms)), "the owner's estate is what changed");
        assertEq(ks.commitmentOf(keeper), bytes32(0), "the operator owns nothing and nothing of theirs moved");
    }

    function test_aKeepsakeCannotBeGivenToTheKeepsakeItself() public {
        uint256 id = _tokTo(bob, 1e18, 10);
        address self = address(ks);
        (bool ok, bytes memory ret) = _raw(bob, 0, abi.encodeCall(ERC721Base.transferFrom, (bob, self, id)));
        assertFalse(ok, "the Keepsake is never a holder: it could claim nothing");
        assertEq(ret, abi.encodeWithSelector(ERC721Base.ERC721InvalidReceiver.selector, self), "refused by ERC-6093's own word");
        assertEq(ks.ownerOf(id), bob, "and the keepsake stays where it was");
    }

    function test_theCommitmentMovesOnTheHoldersTermsAndNeverOnAStrangersActs() public {
        uint256 id = _tokTo(alice, 100_000e18, 100);
        assertEq(ks.commitmentOf(alice), bytes32(0), "wrapping to oneself is a keepsake arriving");

        vm.prank(alice);
        ks.setDrip(id, _drip(TOKM, SPOT / 2, 1_000e18));
        bytes32 c1 = ks.commitmentOf(alice);
        assertEq(c1, keccak256(abi.encode(bytes32(0), id, _terms(id))), "setting a drip folds the new terms");

        // what a stranger can do: gift, claim, drip
        _wrapAs(carol, _w(_one(address(dai), 5e18), Schedule(0, 0, T0 + 1 days), alice, "dust"), 0);
        vm.warp(T0 + 50 days);
        vm.prank(keeper);
        ks.drip(id);
        vm.prank(carol);
        ks.claim(id);
        assertEq(ks.commitmentOf(alice), c1, "a gift, a claim and a drip by strangers leave the commitment standing");

        vm.prank(alice);
        ks.extend(id, T0 + 200 days);
        bytes32 c2 = ks.commitmentOf(alice);
        assertEq(c2, keccak256(abi.encode(c1, id, _terms(id))), "an extension folds the lengthened terms");

        vm.prank(alice);
        ks.clearDrip(id);
        bytes32 c3 = ks.commitmentOf(alice);
        assertEq(c3, keccak256(abi.encode(c2, id, _terms(id))), "clearing the drip folds the terms without it");
        assertTrue(c3 != c2 && c2 != c1, "each of the holder's acts moved it");
    }

    function test_wrapRefusesAWrongEthValue() public {
        Wrap memory w = _w(_bundle(), Schedule(0, 0, T0 + 10 days), bob, "");
        bytes memory call = abi.encodeCall(Keepsake.wrap, (w));
        _refused(alice, 3 ether, call,
            abi.encodeWithSelector(IKeepsakeEvents.WrongValue.selector, 2 ether, 3 ether), "an overpayment is refused, naming both values");
        _refused(alice, 2 ether - 1, call,
            abi.encodeWithSelector(IKeepsakeEvents.WrongValue.selector, 2 ether, 2 ether - 1), "an underpayment by a wei is refused");
        bytes memory noEth = abi.encodeCall(Keepsake.wrap, (_w(_one(address(tok), 1e18), Schedule(0, 0, T0 + 10 days), bob, "")));
        _refused(alice, 1, noEth,
            abi.encodeWithSelector(IKeepsakeEvents.WrongValue.selector, 0, 1), "value with no ETH asset is refused");
        assertEq(ks.keepsakeCount(), 0, "nothing was wrapped");
        assertEq(address(ks).balance, 0, "and no ETH stayed behind");
    }

    function test_wrapRefusesADuplicateAsset() public {
        Asset[] memory a = new Asset[](3);
        a[0] = Asset(address(usdc), 1e6);
        a[1] = Asset(address(tok), 1e18);
        a[2] = Asset(address(usdc), 2e6);
        _refused(alice, 0, abi.encodeCall(Keepsake.wrap, (_w(a, Schedule(0, 0, T0 + 10 days), bob, ""))),
            abi.encodeWithSelector(IKeepsakeEvents.DuplicateAsset.selector, address(usdc)), "the same token twice is refused by name");
        Asset[] memory e = new Asset[](2);
        e[0] = Asset(address(0), 1 ether);
        e[1] = Asset(address(0), 1 ether);
        _refused(alice, 2 ether, abi.encodeCall(Keepsake.wrap, (_w(e, Schedule(0, 0, T0 + 10 days), bob, ""))),
            abi.encodeWithSelector(IKeepsakeEvents.DuplicateAsset.selector, address(0)), "ETH twice is refused too");
    }

    function test_wrapTakesEightAssetsAndRefusesNine() public {
        Asset[] memory a = new Asset[](9);
        for (uint256 i; i < 9; ++i) {
            MockERC20 t = new MockERC20("T", "T", 18, 0, false);
            t.mint(alice, 1e18);
            vm.prank(alice);
            t.approve(address(ks), MAX);
            a[i] = Asset(address(t), 1e18);
        }
        Wrap memory w = _w(a, Schedule(0, 0, T0 + 10 days), bob, "");
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.TooManyAssets.selector);
        ks.wrap(w);

        assembly { mstore(a, 8) }
        uint256 id = _wrapAs(alice, w, 0);
        assertEq(ks.keepsakeOf(id).assets.length, 8, "eight assets is the most, and it is allowed");
        assertEq(ks.MAX_ASSETS(), 8, "the cap is eight");

        assembly { mstore(a, 0) }
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.NoAssets.selector);
        ks.wrap(w);
    }

    function test_wrapRefusesAZeroAmountAZeroRecipientAndALongMessage() public {
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.ZeroAmount.selector);
        ks.wrap(_w(_one(address(tok), 0), Schedule(0, 0, T0 + 10 days), bob, ""));

        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.ZeroRecipient.selector);
        ks.wrap(_w(_one(address(tok), 1), Schedule(0, 0, T0 + 10 days), address(0), ""));
        address self = address(ks);
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.ZeroRecipient.selector);
        ks.wrap(_w(_one(address(tok), 1), Schedule(0, 0, T0 + 10 days), self, ""));

        bytes memory long = new bytes(281);
        for (uint256 i; i < long.length; ++i) long[i] = "a";
        _refused(alice, 0, abi.encodeCall(Keepsake.wrap, (_w(_one(address(tok), 1), Schedule(0, 0, T0 + 10 days), bob, string(long)))),
            abi.encodeWithSelector(IKeepsakeEvents.MessageTooLong.selector, 281), "a message of 281 bytes is refused, naming its length");
        assembly { mstore(long, 280) }
        uint256 id = _wrapAs(alice, _w(_one(address(tok), 1), Schedule(0, 0, T0 + 10 days), bob, string(long)), 0);
        assertEq(bytes(ks.keepsakeOf(id).message).length, 280, "280 bytes is the longest message, and it is kept whole");
    }

    function test_theScheduleTakesItsDefaultsAndRefusesWhatIsNotASchedule() public {
        Asset[] memory a = _one(address(tok), 1e18);
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.BadSchedule.selector);
        ks.wrap(_w(a, Schedule(T0 - 1, 0, T0 + 10 days), bob, ""));          // a start in the past
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.BadSchedule.selector);
        ks.wrap(_w(a, Schedule(T0 + 5 days, T0 + 1 days, T0 + 10 days), bob, ""));   // a cliff before the start
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.BadSchedule.selector);
        ks.wrap(_w(a, Schedule(0, T0 + 11 days, T0 + 10 days), bob, ""));    // an end before the cliff
        vm.prank(alice);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        ks.wrap(_w(a, Schedule(0, 0, T0), bob, ""));                         // an end that is now
        vm.prank(alice);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        ks.wrap(_w(a, Schedule(0, 0, 0), bob, ""));                          // no end at all
        vm.prank(alice);
        vm.expectRevert(Ratchet.TooLong.selector);
        ks.wrap(_w(a, Schedule(0, 0, T0 + 3650 days + 1), bob, ""));         // past ten years
        assertTrue(IKeepsakeEvents.TooLong.selector == Ratchet.TooLong.selector, "the cap's refusal is the interface's TooLong");
        assertTrue(IKeepsakeEvents.RatchetOnly.selector == Ratchet.RatchetOnly.selector, "and the past's is its RatchetOnly");

        uint256 id = _wrapAs(alice, _w(a, Schedule(0, 0, T0 + 3650 days), bob, ""), 0);
        assertEq(ks.keepsakeOf(id).schedule.end, T0 + 3650 days, "ten years to the second is allowed");
        uint256 once = _wrapAs(alice, _w(a, Schedule(T0 + 7 days, T0 + 7 days, T0 + 7 days), bob, ""), 0);
        assertEq(ks.keepsakeOf(once).schedule.cliff, T0 + 7 days, "three equal dates are one moment, and allowed");
        uint256 future = _wrapAs(alice, _w(a, Schedule(T0 + 3 days, 0, T0 + 9 days), bob, ""), 0);
        assertEq(ks.keepsakeOf(future).schedule.cliff, T0 + 3 days, "a zero cliff is a future start too");
    }

    function test_aFeeOnTransferTokenIsRefusedNeverRecordedShort() public {
        _refused(alice, 0, abi.encodeCall(Keepsake.wrap, (_w(_one(address(fot), 100e18), Schedule(0, 0, T0 + 10 days), bob, ""))),
            abi.encodeWithSelector(ExactERC20.InexactERC20Transfer.selector, address(fot), 100e18, 99e18),
            "a token that takes a cut is refused, naming what arrived");
        assertEq(fot.balanceOf(address(ks)), 0, "and nothing of it is held");
    }

    function test_aDripAtWrapIsOnlyForAKeepsakeYouKeep() public {
        Wrap memory w = _w(_one(address(tok), 1_000e18), Schedule(0, 0, T0 + 10 days), bob, "");
        w.drip = _drip(TOKM, SPOT / 2, 100e18);
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.BadDrip.selector);
        ks.wrap(w);

        w.to = alice;
        uint256 id = _wrapAs(alice, w, 0);
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.drip.floor, SPOT / 2, "a drip on a keepsake you keep is set at wrap");
        assertEq(v.drip.market, TOKM, "into the market it names");
        assertEq(v.proceeds.length, 1, "and the market's other side is a proceeds token");
        assertEq(v.proceeds[0].token, address(0), "here native ETH");
    }

    /*═════════ releasing ═════════*/

    function test_nothingFreesBeforeTheCliffAndTheLineStartsFromTheStart() public {
        // start in 10 days, cliff in 20, end in 110: a hundred-day line with its first ten behind a cliff
        uint256 id = _wrapAs(alice, _w(_one(address(tok), 1_000e18),
            Schedule(T0 + 10 days, T0 + 20 days, T0 + 110 days), bob, ""), 0);

        vm.warp(T0 + 20 days - 1);
        assertEq(_free(id, 0), 0, "nothing frees a second before the cliff");
        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NothingFreed.selector);
        ks.claim(id);

        vm.warp(T0 + 20 days);
        assertEq(_free(id, 0), 100e18, "at the cliff the line stands where it would have, ten days from the start");
        vm.warp(T0 + 60 days);
        assertEq(_free(id, 0), 500e18, "halfway along the line, half is free");
        vm.warp(T0 + 110 days - 1);
        assertEq(_free(id, 0), uint256(1_000e18) * (100 days - 1) / 100 days, "a second before the end, the line rounded down");
        vm.warp(T0 + 110 days);
        assertEq(_free(id, 0), 1_000e18, "at the end, everything");
    }

    function test_claimableGrowsLinearlyAndAClaimPaysTheHolderAndNobodyElse() public {
        uint256 id = _wrapAs(alice, _w(_bundle(), Schedule(0, 0, T0 + 100 days), bob, ""), 2 ether);
        vm.warp(T0 + 25 days);
        (Asset[] memory f, Asset[] memory p) = ks.claimable(id);
        assertEq(f[0].amount, 0.5 ether, "a quarter of the ETH is free at a quarter of the way");
        assertEq(f[1].amount, 250e18, "a quarter of the first token");
        assertEq(f[2].amount, 125e6, "a quarter of the second, in its own decimals");
        assertEq(p.length, 0, "no proceeds");

        uint256 bobEth = bob.balance;
        uint256 carolEth = carol.balance;
        uint256 carolTok = tok.balanceOf(carol);
        vm.prank(carol);
        Asset[] memory paid = ks.claim(id);
        assertEq(paid.length, 3, "a claim reports what it paid");
        assertEq(paid[1].amount, 250e18, "and how much of each");
        assertEq(bob.balance, bobEth + 0.5 ether, "the holder received the free ETH");
        assertEq(tok.balanceOf(bob), 250e18, "and the free tokens");
        assertEq(usdc.balanceOf(bob), 125e6, "all of them");
        assertEq(carol.balance, carolEth, "the stranger who pressed received no ETH");
        assertEq(tok.balanceOf(carol), carolTok, "and no tokens");
        assertEq(_free(id, 0), 0, "paid up to the second");

        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NothingFreed.selector);
        ks.claim(id);

        vm.warp(T0 + 75 days);
        assertEq(_free(id, 1), 500e18, "the next half-way share is the line minus what was paid");
        vm.warp(T0 + 100 days);
        ks.claim(id);
        assertEq(tok.balanceOf(bob), 1_000e18, "by the end the holder has everything");
        assertEq(usdc.balanceOf(bob), 500e6, "of every asset");
        assertEq(address(ks).balance, 0, "and the contract holds no ETH it does not owe");
        assertEq(tok.balanceOf(address(ks)), 0, "nor any token");
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.paid[0], 2 ether, "the ledger says all of the ETH was paid");
        assertEq(v.paid[2], 500e6, "and all of the rest");
    }

    function test_everythingFreesAtOnceWhenTheThreeDatesAreEqual() public {
        uint256 id = _wrapAs(alice, _w(_one(address(tok), 7e18), Schedule(T0 + 30 days, T0 + 30 days, T0 + 30 days), bob, ""), 0);
        vm.warp(T0 + 30 days - 1);
        assertEq(_free(id, 0), 0, "nothing a second before the moment");
        vm.warp(T0 + 30 days);
        assertEq(_free(id, 0), 7e18, "everything at it");
    }

    function test_aTransferredKeepsakePaysItsNewHolder() public {
        uint256 id = _tokTo(bob, 100e18, 10);
        vm.warp(T0 + 5 days);
        vm.prank(bob);
        ks.claim(id);
        vm.prank(bob);
        ks.transferFrom(bob, carol, id);
        uint256 carolTok = tok.balanceOf(carol);
        vm.warp(T0 + 10 days);
        vm.prank(keeper);
        ks.claim(id);
        assertEq(tok.balanceOf(bob), 50e18, "the old holder kept what it was paid while it held");
        assertEq(tok.balanceOf(carol), carolTok + 50e18, "and the new holder is paid the rest");
    }

    function test_aRefusingTokenNeverLocksTheRestOfTheBundle() public {
        HostileToken h = new HostileToken();
        h.mint(alice, 100e18);
        vm.prank(alice);
        h.approve(address(ks), MAX);
        Asset[] memory a = new Asset[](3);
        a[0] = Asset(address(0), 1 ether);
        a[1] = Asset(address(h), 100e18);
        a[2] = Asset(address(dai), 100e18);
        uint256 id = _wrapAs(alice, _w(a, Schedule(0, 0, T0 + 10 days), bob, ""), 1 ether);
        vm.warp(T0 + 10 days);

        uint256 bobEth = bob.balance;
        h.setMode(2);                                         // every transfer reverts: a frozen token
        vm.prank(carol);
        Asset[] memory paid = ks.claim(id);
        assertEq(paid.length, 2, "the claim paid the two assets that would move");
        assertEq(bob.balance, bobEth + 1 ether, "the ETH beside a frozen token was paid");
        assertEq(dai.balanceOf(bob), 100e18, "and so was the other token");
        assertEq(_free(id, 1), 100e18, "the frozen token's amount stays freed and owed");
        assertEq(ks.keepsakeOf(id).paid[1], 0, "and the ledger did not count it paid");

        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.TransferFailed.selector);
        ks.claim(id);                                         // owed, and nothing would move: refused

        h.setMode(5);                                         // balanceOf reverts: the token is blind
        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.TransferFailed.selector);
        ks.claim(id);
        assertEq(_free(id, 1), 100e18, "a token that cannot say what moved is not counted paid");

        h.setMode(0);                                         // the token moves again
        vm.prank(carol);
        ks.claim(id);
        assertEq(h.balanceOf(bob), 100e18, "a later claim pays it once the token moves");
        assertEq(ks.keepsakeOf(id).paid[1], 100e18, "and only then is it counted paid");
    }

    function test_aTokenThatMovesAndAnswersFalseIsCountedByWhatMoved() public {
        HostileToken h = new HostileToken();
        h.mint(alice, 100e18);
        vm.prank(alice);
        h.approve(address(ks), MAX);
        uint256 id = _wrapAs(alice, _w(_one(address(h), 100e18), Schedule(0, 0, T0 + 10 days), bob, ""), 0);
        vm.warp(T0 + 10 days);
        h.setMode(3);                                         // moves the tokens, then answers false
        vm.prank(carol);
        ks.claim(id);
        assertEq(h.balanceOf(bob), 100e18, "the tokens moved to the holder");
        assertEq(ks.keepsakeOf(id).paid[0], 100e18, "and the ledger counts what left, not what the token said");
        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NothingFreed.selector);
        ks.claim(id);                                         // so nothing is paid twice
    }

    function test_aHolderThatRefusesEthRevertsTheClaim() public {
        KeepsakeHolder h = new KeepsakeHolder();
        h.setRefuseEth(true);
        uint256 id = _wrapAs(alice, _w(_bundle(), Schedule(0, 0, T0 + 10 days), address(h), ""), 2 ether);
        vm.warp(T0 + 10 days);
        _refused(carol, 0, abi.encodeCall(Keepsake.claim, (id)),
            abi.encodeWithSelector(IKeepsakeEvents.TransferFailed.selector), "a holder that refuses ETH refuses the whole claim");
        assertEq(tok.balanceOf(address(h)), 0, "nothing at all was paid");

        // the holder takes it somewhere that accepts ETH
        h.act(address(ks), abi.encodeCall(ERC721Base.transferFrom, (address(h), bob, id)));
        uint256 bobEth = bob.balance;
        ks.claim(id);
        assertEq(bob.balance, bobEth + 2 ether, "an address that accepts ETH is paid");
    }

    /*═════════ the lock ═════════*/

    function test_aHostileTokenCannotReenterClaimFromInsideAPull() public {
        uint256 victim = _wrapAs(alice, _w(_one(address(0), 1 ether), Schedule(0, 0, T0 + 1 days), bob, ""), 1 ether);
        vm.warp(T0 + 1 days);
        HostileToken h = new HostileToken();
        h.mint(alice, 1e18);
        vm.prank(alice);
        h.approve(address(ks), MAX);
        h.arm(address(ks), abi.encodeCall(Keepsake.claim, (victim)));

        uint256 bobEth = bob.balance;
        _wrapAs(alice, _w(_one(address(h), 1e18), Schedule(0, 0, T0 + 10 days), carol, ""), 0);
        assertTrue(h.reentered(), "the token called back into the Keepsake from inside the pull");
        assertEq(bob.balance, bobEth, "the nested claim paid nobody: the lock refused it");
        assertEq(ks.keepsakeOf(victim).paid[0], 0, "and wrote nothing");

        ks.claim(victim);
        assertEq(bob.balance, bobEth + 1 ether, "outside the lock the same claim lands");
    }

    function test_aHostileTokenCannotReenterADripFromInsideAPull() public {
        uint256 victim = _tokTo(alice, 10_000e18, 1);
        vm.prank(alice);
        ks.setDrip(victim, _drip(TOKM, SPOT / 2, 1_000e18));
        vm.warp(T0 + 1 days);
        HostileToken h = new HostileToken();
        h.mint(carol, 1e18);
        vm.prank(carol);
        h.approve(address(ks), MAX);
        h.arm(address(ks), abi.encodeCall(Keepsake.drip, (victim)));
        _wrapAs(carol, _w(_one(address(h), 1e18), Schedule(0, 0, T0 + 10 days), carol, ""), 0);
        assertTrue(h.reentered(), "the token called back into the Keepsake from inside the pull");
        assertEq(ks.keepsakeOf(victim).sold[0], 0, "the nested drip sold nothing: the lock refused it");
    }

    function test_aHolderReenteringFromInsideItsOwnClaimIsRefused() public {
        KeepsakeHolder h = new KeepsakeHolder();
        uint256 id = _wrapAs(alice, _w(_one(address(0), 3 ether), Schedule(0, 0, T0 + 1 days), address(h), ""), 3 ether);
        h.arm(address(ks), abi.encodeCall(Keepsake.claim, (id)));
        vm.warp(T0 + 1 days);
        vm.prank(carol);
        ks.claim(id);
        assertTrue(h.tried(), "the holder tried to claim again from inside the ETH it was paid");
        assertFalse(h.nestedOk(), "and was refused");
        assertEq(h.nestedData(), abi.encodeWithSelector(Transient.Reentrancy.selector), "with Reentrancy, by the lock");
        assertEq(address(h).balance, 3 ether, "the outer claim landed, once");
    }

    function test_unsolicitedEthIsRefused() public {
        (bool ok, bytes memory ret) = address(ks).call{value: 1}("");
        assertFalse(ok, "ETH sent straight to the Keepsake is refused");
        assertEq(ret, abi.encodeWithSelector(IKeepsakeEvents.WrongValue.selector, 0, 1), "as a value nobody is owed");
        vm.prank(address(pool));
        (ok, ) = address(ks).call{value: 1}("");
        assertFalse(ok, "even from the Pool, outside a swap the Keepsake is making");
        assertEq(address(ks).balance, 0, "so nothing is ever stranded here");
    }

    /*═════════ extend ═════════*/

    function test_onlyTheHolderMayExtendAndNeverAnOperator() public {
        uint256 id = _tokTo(bob, 100e18, 10);
        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NotHolder.selector);
        ks.extend(id, T0 + 20 days);

        vm.prank(bob);
        ks.setApprovalForAll(carol, true);
        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NotHolder.selector);
        ks.extend(id, T0 + 20 days);

        vm.prank(bob);
        ks.approve(keeper, id);
        vm.prank(keeper);
        vm.expectRevert(IKeepsakeEvents.NotHolder.selector);
        ks.extend(id, T0 + 20 days);
        assertEq(ks.keepsakeOf(id).schedule.end, T0 + 10 days, "nobody but the holder moved the end");

        vm.prank(bob);
        ks.extend(id, T0 + 20 days);
        assertEq(ks.keepsakeOf(id).schedule.end, T0 + 20 days, "the holder lengthened it");

        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NoSuchKeepsake.selector);
        ks.extend(99, T0 + 20 days);
    }

    function test_extendOnlyLengthens() public {
        uint256 id = _tokTo(bob, 100e18, 100);
        bytes32 c0 = ks.commitmentOf(bob);
        vm.prank(bob);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        ks.extend(id, T0 + 100 days);
        vm.prank(bob);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        ks.extend(id, T0 + 50 days);
        vm.prank(bob);
        vm.expectRevert(Ratchet.TooLong.selector);
        ks.extend(id, T0 + 3650 days + 1);
        assertEq(ks.keepsakeOf(id).schedule.end, T0 + 100 days, "a refused extension leaves the promise standing");
        assertEq(ks.commitmentOf(bob), c0, "and the commitment untouched");

        // the slope flattens and nothing already paid is clawed back
        vm.warp(T0 + 50 days);
        ks.claim(id);
        assertEq(tok.balanceOf(bob), 50e18, "half was paid at half-way");
        vm.prank(bob);
        ks.extend(id, T0 + 200 days);
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.schedule.start, T0, "the start does not move");
        assertEq(v.schedule.cliff, T0, "nor a cliff that is not the end");
        assertEq(_free(id, 0), 0, "freed is now 25 and 50 was paid: nothing owed, nothing taken back");
        vm.warp(T0 + 100 days);
        assertEq(_free(id, 0), 0, "the new line catches up at 50");
        vm.warp(T0 + 150 days);
        assertEq(_free(id, 0), 25e18, "and then pays again");

        // a promise already kept cannot be lengthened into a new one
        vm.warp(T0 + 200 days);
        vm.prank(bob);
        vm.expectRevert(IKeepsakeEvents.BadSchedule.selector);
        ks.extend(id, T0 + 300 days);
    }

    function test_aKeepsakeThatFreesAtOnceStillFreesAtOnceWhenExtended() public {
        uint256 id = _wrapAs(alice, _w(_one(address(tok), 9e18), Schedule(0, T0 + 30 days, T0 + 30 days), bob, ""), 0);
        vm.prank(bob);
        ks.extend(id, T0 + 60 days);
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.schedule.cliff, T0 + 60 days, "a cliff on the end moves with the end");
        vm.warp(T0 + 59 days);
        assertEq(_free(id, 0), 0, "nothing frees before the new moment");
        vm.warp(T0 + 60 days);
        assertEq(_free(id, 0), 9e18, "everything at it");
    }

    /*═════════ the drip: who may set it ═════════*/

    function test_onlyTheHolderMaySetOrClearADrip() public {
        uint256 id = _tokTo(bob, 10_000e18, 10);
        DripTerms memory d = _drip(TOKM, SPOT / 2, 100e18);
        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NotHolder.selector);
        ks.setDrip(id, d);
        vm.prank(bob);
        ks.setApprovalForAll(carol, true);
        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NotHolder.selector);
        ks.setDrip(id, d);
        assertEq(ks.keepsakeOf(id).drip.floor, 0, "a stranger and an operator set no drip");

        vm.prank(bob);
        ks.setDrip(id, d);
        assertEq(ks.keepsakeOf(id).drip.floor, SPOT / 2, "the holder sets one");

        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.NotHolder.selector);
        ks.clearDrip(id);
        vm.prank(bob);
        ks.clearDrip(id);
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.drip.floor, 0, "the holder clears it");
        assertEq(v.drip.market, 0, "every term with it");
        vm.prank(bob);
        vm.expectRevert(IKeepsakeEvents.NoDrip.selector);
        ks.clearDrip(id);
        vm.prank(keeper);
        vm.expectRevert(IKeepsakeEvents.NoDrip.selector);
        ks.drip(id);
    }

    function test_aDripNeedsAFloorAMostAndAMarketThatTradesTheAsset() public {
        uint256 id = _tokTo(bob, 10_000e18, 10);
        vm.startPrank(bob);
        vm.expectRevert(IKeepsakeEvents.BadDrip.selector);
        ks.setDrip(id, _drip(TOKM, 0, 100e18));
        vm.expectRevert(IKeepsakeEvents.BadDrip.selector);
        ks.setDrip(id, _drip(TOKM, SPOT, 0));
        vm.expectRevert(IKeepsakeEvents.BadDrip.selector);
        ks.setDrip(id, DripTerms(1, TOKM, SPOT, 100e18));
        vm.stopPrank();
        _refused(bob, 0, abi.encodeCall(Keepsake.setDrip, (id, _drip(USDM, SPOT, 100e18))),
            abi.encodeWithSelector(IKeepsakeEvents.WrongMarket.selector, USDM), "a market that does not trade the asset is refused by key");
        _refused(bob, 0, abi.encodeCall(Keepsake.setDrip, (id, _drip(77, SPOT, 100e18))),
            abi.encodeWithSelector(IKeepsakeEvents.WrongMarket.selector, 77), "and so is a market that is not open");
        assertEq(ks.keepsakeOf(id).proceeds.length, 0, "a refused drip registers no proceeds token");
    }

    /*═════════ the drip: what it does ═════════*/

    function test_aDripSellsWhatHasFreedAtOrAboveTheFloor() public {
        uint256 id = _tokTo(alice, 100_000e18, 100);
        vm.prank(alice);
        ks.setDrip(id, _drip(TOKM, SPOT * 95 / 100, 1_000e18));
        vm.prank(keeper);
        vm.expectRevert(IKeepsakeEvents.NothingFreed.selector);
        ks.drip(id);                                          // nothing has freed at the start

        vm.warp(T0 + 10 days);                                // 10,000 freed
        uint256 quote = pool.quote(TOKM, true, 1_000e18);
        uint256 keeperEth = keeper.balance;
        vm.prank(keeper);
        (uint256 sold, uint256 got) = ks.drip(id);
        assertEq(sold, 1_000e18, "a drip sells at most its most");
        assertEq(got, quote, "and receives what the market paid");
        assertGe(got, _ceil(sold, SPOT * 95 / 100), "which is at or above the floor");
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.sold[0], 1_000e18, "the ledger counts it sold");
        assertEq(v.proceeds[0].amount, got, "and the proceeds are the keepsake's");
        assertEq(v.lastDripBlock, block.number, "the block is remembered");
        assertEq(keeper.balance, keeperEth, "the keeper who pressed received nothing");
        assertEq(_free(id, 0), 9_000e18, "what was sold is no longer free to claim");

        uint256 aliceEth = alice.balance;
        uint256 aliceTok = tok.balanceOf(alice);
        vm.prank(keeper);
        ks.claim(id);
        assertEq(alice.balance, aliceEth + got, "a claim pays the holder the proceeds");
        assertEq(tok.balanceOf(alice), aliceTok + 9_000e18, "beside what is free and unsold");
        assertEq(ks.keepsakeOf(id).proceeds[0].amount, 0, "and the proceeds are paid out");
    }

    function test_aDripNeverSellsMoreThanHasFreedAndIsUnpaid() public {
        uint256 id = _tokTo(alice, 100_000e18, 100);
        vm.prank(alice);
        ks.setDrip(id, _drip(TOKM, SPOT / 2, 50_000e18));
        vm.warp(T0 + 1 days);                                 // 1,000 freed
        vm.prank(keeper);
        (uint256 sold, ) = ks.drip(id);
        assertEq(sold, 1_000e18, "a drip with room for more sells exactly what has freed");
        // block numbers from storage: the optimiser may re-read NUMBER after a roll
        uint256 b0 = ks.keepsakeOf(id).lastDripBlock;
        vm.roll(b0 + 1);
        vm.prank(keeper);
        vm.expectRevert(IKeepsakeEvents.NothingFreed.selector);
        ks.drip(id);                                          // the same second: nothing new is free

        vm.warp(T0 + 3 days);                                 // 3,000 freed, 1,000 sold
        ks.claim(id);                                         // 2,000 paid
        vm.roll(b0 + 2);
        vm.prank(keeper);
        vm.expectRevert(IKeepsakeEvents.NothingFreed.selector);
        ks.drip(id);
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.sold[0] + v.paid[0], 3_000e18, "sold and paid together are exactly what has freed");
    }

    function test_oneDripPerBlockPerKeepsake() public {
        uint256 id = _tokTo(alice, 100_000e18, 100);
        uint256 other = _tokTo(alice, 100_000e18, 100);
        vm.startPrank(alice);
        ks.setDrip(id, _drip(TOKM, SPOT / 2, 100e18));
        ks.setDrip(other, _drip(TOKM, SPOT / 2, 100e18));
        vm.stopPrank();
        vm.warp(T0 + 10 days);
        vm.prank(keeper);
        ks.drip(id);
        // block numbers from storage: the optimiser may re-read NUMBER after a roll
        uint256 b0 = ks.keepsakeOf(id).lastDripBlock;
        vm.prank(carol);
        vm.expectRevert(IKeepsakeEvents.OnePerBlock.selector);
        ks.drip(id);
        vm.prank(carol);
        ks.drip(other);
        assertEq(ks.keepsakeOf(other).sold[0], 100e18, "another keepsake drips in the same block");
        assertEq(ks.keepsakeOf(id).sold[0], 100e18, "but each keepsake once");

        vm.roll(b0 + 1);
        vm.prank(carol);
        ks.drip(id);
        assertEq(ks.keepsakeOf(id).sold[0], 200e18, "and again in the next block");
        assertEq(ks.keepsakeOf(id).lastDripBlock, b0 + 1, "which is the block it remembers");
    }

    function test_theFloorRoundsTheMinimumUp() public {
        uint256 id = _tokTo(alice, 100_000e18, 100);
        uint256 most = 1_000e18 + 333;                        // a most whose product with the floor is not whole
        uint256 floor = SPOT * 101 / 100 + 7;                 // above what the market pays
        vm.prank(alice);
        ks.setDrip(id, _drip(TOKM, floor, most));
        vm.warp(T0 + 10 days);
        uint256 wanted = _ceil(most, floor);
        assertTrue(most * floor % 1e18 != 0, "the product has a remainder to round");
        _refused(keeper, 0, abi.encodeCall(Keepsake.drip, (id)),
            abi.encodeWithSelector(IPoolEvents.Slippage.selector, pool.quote(TOKM, true, most), wanted),
            "the Pool is asked for ceil(sold x floor / 1e18) and refuses to pay less");
        assertEq(ks.keepsakeOf(id).sold[0], 0, "a refused drip sells nothing");
    }

    function test_aDripBelowTheFloorIsRefusedEvenIfTheVenueWouldFillIt() public {
        KeepsakeShortPool venue = new KeepsakeShortPool();
        Keepsake k2 = new Keepsake(address(hub), address(venue), address(art));
        venue.setMarket(address(tok), address(dai));
        dai.mint(address(venue), 1e24);
        vm.prank(alice);
        tok.approve(address(k2), MAX);
        Wrap memory w = _w(_one(address(tok), 10_000e18), Schedule(0, 0, T0 + 10 days), alice, "");
        uint256 most = 1_000e18 + 1;
        uint256 floor = 3e17 + 1;                             // 0.3 DAI per TOK and a wei: a remainder to round
        w.drip = _drip(9, floor, most);
        vm.prank(alice);
        uint256 id = k2.wrap(w);
        vm.warp(T0 + 10 days);

        uint256 wanted = _ceil(most, floor);
        venue.setDeliver(wanted - 1);                         // a venue that ignores minOut, short by one wei
        vm.prank(keeper);
        (bool ok, bytes memory ret) = address(k2).call(abi.encodeCall(Keepsake.drip, (id)));
        assertFalse(ok, "a fill a wei under the floor is refused by the Keepsake itself");
        assertEq(ret, abi.encodeWithSelector(IKeepsakeEvents.BelowFloor.selector, wanted - 1, wanted), "naming what arrived and the floor");

        venue.setDeliver(wanted);
        vm.prank(keeper);
        (uint256 sold, uint256 got) = k2.drip(id);
        assertEq(sold, most, "at the floor exactly the drip lands");
        assertEq(got, wanted, "and what arrived is credited");
    }

    function test_aDripIntoAMarketWhosePairMovedIsRefused() public {
        uint256 id = _tokTo(alice, 100_000e18, 100);
        vm.prank(alice);
        ks.setDrip(id, _drip(TOKM, SPOT / 2, 100e18));
        vm.warp(T0 + 10 days);

        // the market's holder empties it, closes it, and reopens it as DAI against TOK:
        // the asset still trades there, but against another token than its proceeds
        vm.startPrank(lp);
        pool.withdraw(TOKM, 1_000_000e18, 100 ether, lp);
        pool.closeMarket(TOKM);
        pool.openMarket(TOKM, address(dai), address(tok), 30, 0, 0, 0);
        pool.deposit(TOKM, 1_000_000e18, 1_000_000e18);
        vm.stopPrank();
        _refused(keeper, 0, abi.encodeCall(Keepsake.drip, (id)),
            abi.encodeWithSelector(IKeepsakeEvents.WrongMarket.selector, TOKM),
            "a drip whose market no longer trades its asset against its proceeds token is refused");
        assertEq(ks.keepsakeOf(id).sold[0], 0, "and sells nothing");
    }

    function test_aDripOfNativeEthSellsTheKeepsakesOwnEth() public {
        Wrap memory w = _w(_one(address(0), 10 ether), Schedule(0, 0, T0 + 10 days), alice, "");
        w.drip = _drip(TOKM, 9_500e18, 1 ether);              // at least 9,500 TOK per ETH
        uint256 id = _wrapAs(alice, w, 10 ether);
        vm.warp(T0 + 10 days);
        uint256 quote = pool.quote(TOKM, false, 1 ether);
        vm.prank(keeper);
        (uint256 sold, uint256 got) = ks.drip(id);
        assertEq(sold, 1 ether, "the drip sold one ETH");
        assertEq(got, quote, "for what the market paid in TOK");
        assertEq(address(ks).balance, 9 ether, "the ETH that left was the keepsake's own");
        assertEq(tok.balanceOf(address(ks)), got, "and the TOK that arrived is held for it");
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.proceeds[0].token, address(tok), "the proceeds token is the market's other side");
        assertEq(v.proceeds[0].amount, got, "credited in full");

        uint256 aliceEth = alice.balance;
        ks.claim(id);
        assertEq(alice.balance, aliceEth + 9 ether, "a claim pays the unsold ETH");
        assertEq(tok.balanceOf(address(ks)), 0, "and the proceeds, leaving nothing behind");
    }

    function test_aKeepsakeHoldsAtMostEightProceedsTokens() public {
        uint256 id = _tokTo(alice, 1_000e18, 10);
        for (uint256 i; i < 9; ++i) {
            MockERC20 t = new MockERC20("X", "X", 18, 0, false);
            uint256 m = hub.mint(lp);
            vm.prank(lp);
            pool.openMarket(m, address(tok), address(t), 30, 0, 0, 0);
            vm.prank(alice);
            if (i < 8) {
                ks.setDrip(id, _drip(m, 1, 1));
            } else {
                vm.expectRevert(IKeepsakeEvents.TooManyAssets.selector);
                ks.setDrip(id, _drip(m, 1, 1));
            }
        }
        assertEq(ks.keepsakeOf(id).proceeds.length, 8, "eight proceeds tokens is the most a keepsake carries");
        vm.prank(alice);
        ks.setDrip(id, _drip(3, 1, 1));
        assertEq(ks.keepsakeOf(id).drip.market, 3, "a market into a token already registered is still allowed");
    }

    /*═════════ swap and wrap ═════════*/

    function test_swapAndWrapLocksExactlyWhatTheSwapDelivered() public {
        uint256 quote = pool.quote(TOKM, false, 1 ether);
        uint256 aliceEth = alice.balance;
        SwapAndWrap memory p;
        p.market = TOKM;
        p.baseIn = false;                                    // pay ETH, the quote; receive TOK, the base
        p.amountIn = 1 ether;
        p.minOut = quote;
        p.deadline = FOREVER;
        p.schedule = Schedule(0, 0, T0 + 30 days);
        p.to = alice;
        p.message = "locked what I bought";
        vm.prank(alice);
        (uint256 id, uint256 out) = ks.swapAndWrap{value: 1 ether}(p);
        assertEq(out, quote, "the swap delivered what the market quoted");
        assertEq(tok.balanceOf(address(ks)), out, "and exactly that is held");
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.assets.length, 1, "one asset: the output");
        assertEq(v.assets[0].token, address(tok), "the output token");
        assertEq(v.assets[0].amount, out, "the output amount, by balance delta");
        assertEq(alice.balance, aliceEth - 1 ether, "the input was the value, exactly");
        assertEq(address(ks).balance, 0, "and none of it stayed");

        // the other way: an ERC-20 in, ETH out and locked
        uint256 back = pool.quote(TOKM, true, 1_000e18);
        uint256 aliceTok = tok.balanceOf(alice);
        p.baseIn = true;
        p.amountIn = 1_000e18;
        p.minOut = 0;
        vm.prank(alice);
        (uint256 id2, uint256 out2) = ks.swapAndWrap(p);
        assertEq(out2, back, "ETH out is measured the same way");
        assertEq(address(ks).balance, back, "and held");
        assertEq(ks.keepsakeOf(id2).assets[0].token, address(0), "as native ETH");
        assertEq(tok.balanceOf(alice), aliceTok - 1_000e18, "the ERC-20 was pulled exactly");
        assertEq(tok.allowance(address(ks), address(pool)), 0, "and the Pool's allowance is back to zero");
    }

    function test_swapAndWrapRefusesTheWrongValue() public {
        SwapAndWrap memory p;
        p.market = TOKM;
        p.baseIn = true;
        p.amountIn = 1_000e18;
        p.deadline = FOREVER;
        p.schedule = Schedule(0, 0, T0 + 30 days);
        p.to = alice;
        _refused(alice, 1, abi.encodeCall(Keepsake.swapAndWrap, (p)),
            abi.encodeWithSelector(IKeepsakeEvents.WrongValue.selector, 0, 1), "value beside an ERC-20 input is refused");
        p.baseIn = false;
        p.amountIn = 1 ether;
        _refused(alice, 1 ether - 1, abi.encodeCall(Keepsake.swapAndWrap, (p)),
            abi.encodeWithSelector(IKeepsakeEvents.WrongValue.selector, 1 ether, 1 ether - 1), "a native input must be the value exactly");
    }

    function test_swapAndWrapRespectsMinOutAndTheDeadline() public {
        uint256 quote = pool.quote(TOKM, false, 1 ether);
        SwapAndWrap memory p;
        p.market = TOKM;
        p.amountIn = 1 ether;
        p.minOut = quote + 1;
        p.deadline = FOREVER;
        p.schedule = Schedule(0, 0, T0 + 30 days);
        p.to = alice;
        _refused(alice, 1 ether, abi.encodeCall(Keepsake.swapAndWrap, (p)),
            abi.encodeWithSelector(IPoolEvents.Slippage.selector, quote, quote + 1), "the Pool refuses less than the minimum");
        p.minOut = 0;
        p.deadline = T0 - 1;
        vm.prank(alice);
        vm.expectRevert(IPoolEvents.Expired.selector);
        ks.swapAndWrap{value: 1 ether}(p);
        assertEq(ks.keepsakeCount(), 0, "a refused swap wraps nothing");
    }

    function test_swapAndWrapSetsADripOnlyOnItsOutputAndOnlyForYou() public {
        SwapAndWrap memory p;
        p.market = TOKM;
        p.amountIn = 1 ether;
        p.deadline = FOREVER;
        p.schedule = Schedule(0, 0, T0 + 30 days);
        p.to = alice;
        p.drip = DripTerms(1, TOKM, SPOT / 2, 100e18);
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.BadDrip.selector);
        ks.swapAndWrap{value: 1 ether}(p);
        p.drip.asset = 0;
        p.to = bob;
        vm.prank(alice);
        vm.expectRevert(IKeepsakeEvents.BadDrip.selector);
        ks.swapAndWrap{value: 1 ether}(p);

        p.to = alice;
        vm.prank(alice);
        (uint256 id, ) = ks.swapAndWrap{value: 1 ether}(p);
        KeepsakeView memory v = ks.keepsakeOf(id);
        assertEq(v.drip.floor, SPOT / 2, "lock what I receive, then sell it slowly: one signature");
        assertEq(v.proceeds[0].token, address(0), "selling the output back for ETH");
    }

    /*═════════ reading ═════════*/

    function test_anUnknownKeepsakeIsRefusedByName() public {
        vm.expectRevert(IKeepsakeEvents.NoSuchKeepsake.selector);
        ks.keepsakeOf(1);
        vm.expectRevert(IKeepsakeEvents.NoSuchKeepsake.selector);
        ks.claimable(1);
        vm.expectRevert(IKeepsakeEvents.NoSuchKeepsake.selector);
        ks.claim(1);
        vm.expectRevert(IKeepsakeEvents.NoSuchKeepsake.selector);
        ks.drip(1);
        (bool ok, bytes memory ret) = address(ks).call(abi.encodeCall(Keepsake.claim, (5)));
        assertFalse(ok, "a claim of nothing is refused");
        assertEq(ret, abi.encodeWithSelector(IKeepsakeEvents.NoSuchKeepsake.selector, 5), "naming the id");
        (ok, ret) = address(ks).call(abi.encodeCall(Keepsake.tokenURI, (5)));
        assertFalse(ok, "and its face does not exist");
        assertEq(ret, abi.encodeWithSelector(ERC721Base.ERC721NonexistentToken.selector, 5), "by ERC-6093's own word");
    }

    function test_tokenURIIsABase64JsonDocument() public {
        HostileToken h = new HostileToken();                  // symbol "<script>alert(1)</script>"
        h.mint(alice, 1e18);
        vm.prank(alice);
        h.approve(address(ks), MAX);
        Asset[] memory a = _bundle();
        Asset[] memory b = new Asset[](4);
        for (uint256 i; i < 3; ++i) b[i] = a[i];
        b[3] = Asset(address(h), 1e18);
        uint256 id = _wrapAs(alice, _w(b, Schedule(0, 0, T0 + 10 days), bob, 'a "quoted" <b>gift</b>'), 2 ether);
        vm.warp(T0 + 5 days);
        bytes memory uri = bytes(ks.tokenURI(id));
        bytes memory prefix = bytes("data:application/json;base64,");
        assertGt(uri.length, prefix.length, "the face is a document");
        for (uint256 i; i < prefix.length; ++i) assertTrue(uri[i] == prefix[i], "a base64 JSON data URI");
        h.setMode(6);                                         // a token that burns the gas of any call
        assertGt(bytes(ks.tokenURI(id)).length, 0, "a hostile token's symbol never stops the face from rendering");
    }

    function test_theConstantsAndThePins() public view {
        assertEq(ks.MAX_ASSETS(), 8, "eight assets at most");
        assertEq(ks.MAX_TERM(), 3650 days, "ten years at most");
        assertEq(ks.MAX_MESSAGE(), 280, "280 bytes of message at most");
        assertEq(ks.POOL(), address(pool), "the Pool is pinned");
        assertEq(ks.HUB(), address(hub), "the hub is pinned");
        assertEq(ks.ART(), address(art), "the renderer is pinned");
        assertEq(bytes(ks.name()), bytes("Keepsake"), "the collection's name");
        assertTrue(ks.supportsInterface(type(IKeepsake).interfaceId), "it says it is a keepsake");
        assertTrue(ks.supportsInterface(type(IERC721).interfaceId), "and an ERC-721");
        assertTrue(ks.supportsInterface(type(IERC721Metadata).interfaceId), "with metadata");
        assertTrue(ks.supportsInterface(type(IERC165).interfaceId), "that answers ERC-165");
        assertFalse(ks.supportsInterface(0xffffffff), "and nothing it is not");
    }

    function test_aZeroPinIsRefusedAtConstruction() public {
        address[3][3] memory pins = [
            [address(0), address(pool), address(art)],
            [address(hub), address(0), address(art)],
            [address(hub), address(pool), address(0)]
        ];
        for (uint256 i; i < 3; ++i) {
            try new Keepsake(pins[i][0], pins[i][1], pins[i][2]) returns (Keepsake) {
                assertTrue(false, "a Keepsake with a zero pin was built");
            } catch (bytes memory why) {
                assertEq(why, abi.encodeWithSelector(Keepsake.ZeroAddress.selector), "a zero pin is refused at construction");
            }
        }
    }

    /*═════════ fuzzed ═════════*/

    /// @dev Any schedule, any two moments: what a claim has paid is the line
    ///      at that moment, rounded down, and by the end it is everything.
    function testFuzz_aClaimPaysTheLineAndEverythingByTheEnd(
        uint256 amount, uint256 lead, uint256 cliffAt, uint256 span, uint256 t1, uint256 t2
    ) public {
        amount = bound(amount, 1, 1e30);
        lead = bound(lead, 0, 365 days);
        span = bound(span, 0, 3000 days);
        cliffAt = bound(cliffAt, 0, span);
        uint256 start = T0 + lead;
        uint256 end = start + span;
        uint256 cliff = start + cliffAt;
        if (span == 0) end = cliff = start + 1;               // one moment, strictly after now
        if (span == 0) start = cliff;
        tok.mint(alice, amount);
        uint256 id = _wrapAs(alice, _w(_one(address(tok), amount),
            Schedule(uint64(start), uint64(cliff), uint64(end)), bob, ""), 0);

        t1 = bound(t1, T0, end + 10 days);
        t2 = bound(t2, t1, end + 10 days);
        uint256[3] memory at = [t1, t2, end];
        for (uint256 k; k < 3; ++k) {
            vm.warp(at[k]);
            uint256 line = at[k] < cliff ? 0 : at[k] >= end ? amount : amount * (at[k] - start) / (end - start);
            try ks.claim(id) {} catch {}
            assertEq(tok.balanceOf(bob), line, "the holder has been paid the line at that moment, rounded down");
            assertEq(tok.balanceOf(address(ks)), amount - line, "and the Keepsake still holds the rest");
        }
        assertEq(tok.balanceOf(bob), amount, "by the end it is everything");
    }

    /// @dev Any floor around the price, any price move first, any most: a
    ///      drip either lands at or above its floor or sells nothing.
    function testFuzz_aDripNeverExecutesBelowItsFloor(uint256 pct, uint256 most, uint256 push) public {
        pct = bound(pct, 50, 150);
        most = bound(most, 1e15, 40_000e18);
        push = bound(push, 0, 300_000e18);
        uint256 floor = SPOT * pct / 100;
        uint256 id = _tokTo(alice, 100_000e18, 10);
        vm.prank(alice);
        ks.setDrip(id, _drip(TOKM, floor, most));
        vm.warp(T0 + 10 days);
        if (push != 0) {
            vm.prank(carol);
            try pool.swapExactIn(TOKM, true, push, 0, carol, FOREVER) {} catch {}
        }
        vm.prank(keeper);
        try ks.drip(id) returns (uint256 sold, uint256 got) {
            assertGe(got, _ceil(sold, floor), "a drip that lands lands at or above its floor");
            assertEq(ks.keepsakeOf(id).proceeds[0].amount, got, "and is credited what arrived");
        } catch {
            assertEq(ks.keepsakeOf(id).sold[0], 0, "a drip that is refused sells nothing");
            assertEq(ks.keepsakeOf(id).proceeds[0].amount, 0, "and earns nothing");
        }
    }
}
