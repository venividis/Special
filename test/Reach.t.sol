// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Reach} from "../src/Reach.sol";
import {Grip} from "../src/Grip.sol";
import {
    IReachEvents, Session, SessionKind, AssetCap, AssetLimit, TypedCall, Call, Piece, OpenApproval
} from "../src/interfaces/IReach.sol";
import {Status} from "../src/interfaces/IIntact.sol";
import {Ratchet} from "../src/lib/Ratchet.sol";
import {AccountsHub} from "./mocks/AccountsHub.sol";
import {MockRegistry6551} from "./mocks/MockRegistry6551.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC721} from "./mocks/MockERC721.sol";
import {Drainer} from "./mocks/Drainer.sol";
import {Breakable} from "./mocks/Breakable.sol";
import {Trap} from "./mocks/Trap.sol";
import {SealBreaker} from "./mocks/SealBreaker.sol";

/*───────────────────────────────────────────────────────────────────────────
  The accounts fixture, shared by Reach / Sessions / Ledger / Reach7739.

  The canonical ERC-6551 registry is etched at its real address so every
  Reach and Grip is derived the way DESIGN.md §4.3 derives it, through
  `AccountsHub`, which answers the four hub reads the Reach makes and moves
  custody the way the hub's `_update` does. One token per test, held by
  `alice`, with `gold` and `silver` in the Reach.
───────────────────────────────────────────────────────────────────────────*/
abstract contract ReachFixture is Test {
    address constant REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    uint64 constant T0 = 1_733_000_000;
    uint256 constant WAD = 1e18;
    bytes4 constant XFER = 0xa9059cbb;
    bytes4 constant XFER_FROM = 0x23b872dd;
    bytes4 constant APPROVE = 0x095ea7b3;
    bytes4 constant APPROVE_ALL = 0xa22cb465;

    AccountsHub hub;
    Reach reachImpl;
    Grip gripImpl;
    MockERC20 gold;
    MockERC20 silver;
    Drainer drainer;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address agent = address(0xA9E07);
    address guardian = address(0x6A4D);

    function setUp() public virtual {
        vm.warp(T0);
        vm.etch(REGISTRY, address(new MockRegistry6551()).code);
        reachImpl = new Reach();
        gripImpl = new Grip();
        hub = new AccountsHub(address(reachImpl), address(gripImpl));
        gold = new MockERC20("Gold", "GOLD", 18, 0, false);
        silver = new MockERC20("Silver", "SLVR", 18, 0, false);
        drainer = new Drainer();
    }

    /// @dev The shim's assertEq knows no bytes4, and a same-named overload in
    ///      a derived contract makes every assertEq ambiguous (measured), so
    ///      selectors and magic values are compared under another name.
    function assertSel(bytes4 a, bytes4 b) internal pure { if (a != b) revert("assertSel"); }
    function assertSel(bytes4 a, bytes4 b, string memory m) internal pure { if (a != b) revert(m); }

    function _mint(address to) internal returns (uint256 id, Reach r) {
        id = hub.mint(to);
        r = Reach(payable(hub.account(id)));
        gold.mint(address(r), 1000 * WAD);
        silver.mint(address(r), 1000 * WAD);
        vm.deal(address(r), 10 ether);
    }

    function _xfer(address to, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(XFER, to, amount);
    }

    function _approve(address spender, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(APPROVE, spender, amount);
    }

    function _exec(Reach r, address who, address to, uint256 value, bytes memory data) internal returns (bytes memory) {
        vm.prank(who);
        return r.execute(to, value, data, 0);
    }

    function _seal(Reach r, address who, uint64 until) internal {
        vm.prank(who);
        r.seal(until);
    }

    function _guard(Reach r, address who, address asset) internal {
        vm.prank(who);
        r.guard(asset);
    }

    function _addrs(address a) internal pure returns (address[] memory l) { l = new address[](1); l[0] = a; }
    function _addrs(address a, address b) internal pure returns (address[] memory l) {
        l = new address[](2); l[0] = a; l[1] = b;
    }
    function _sels(bytes4 a) internal pure returns (bytes4[] memory l) { l = new bytes4[](1); l[0] = a; }
    function _sels(bytes4 a, bytes4 b) internal pure returns (bytes4[] memory l) {
        l = new bytes4[](2); l[0] = a; l[1] = b;
    }
    function _noCaps() internal pure returns (AssetCap[] memory l) { l = new AssetCap[](0); }
    function _cap(address asset, uint128 cap) internal pure returns (AssetCap[] memory l) {
        l = new AssetCap[](1); l[0] = AssetCap(asset, cap);
    }
    function _limit(address asset, uint256 amount) internal pure returns (AssetLimit[] memory l) {
        l = new AssetLimit[](1); l[0] = AssetLimit(asset, amount);
    }
    function _noLimits() internal pure returns (AssetLimit[] memory l) { l = new AssetLimit[](0); }

    /// @dev A plain allowlist session on `gold.transfer`, one day, no caps.
    function _grantTransfer(Reach r, address who, address key) internal {
        vm.prank(who);
        r.grantSession(key, uint64(block.timestamp + 1 days), 0, _noCaps(), _addrs(address(gold)), _sels(XFER), 0, 0);
    }
}

/// @dev An operator the holder once approved on a collection. Called from
///      the Reach, it moves a guarded piece out through a target the word
///      list does not police — so only `ownerOf` measurement can catch it.
contract PieceTaker {
    function take(address collection, address from, address to, uint256 id) external {
        MockERC721(collection).transferFrom(from, to, id);
    }
}

/*  DESIGN.md §9.1 — the measured seal, kept whole from IPSEITY, and the
    INTACT changes to the acting paths: CALL only, EmptyBatch, audit root,
    state, the manifest frozen while the account is inside a call.         */
contract ReachTest is ReachFixture {
    function test_operationOneIsRefused() public {
        (, Reach r) = _mint(alice);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.OnlyCall.selector);
        r.execute(address(gold), 0, _xfer(bob, WAD), 1);
        // the control: operation 0 is the one the account performs
        _exec(r, alice, address(gold), 0, _xfer(bob, WAD));
        assertEq(gold.balanceOf(bob), WAD, "a CALL moved the gold");
        assertEq(r.state(), 1, "and counted");
    }

    function test_onlyTheHolderActs() public {
        (uint256 id, Reach r) = _mint(alice);
        vm.prank(bob);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.execute(address(gold), 0, _xfer(bob, WAD), 0);
        // an operator on the hub is not the signer either
        vm.prank(alice);
        hub.setApprovalForAll(bob, true);
        vm.prank(bob);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.execute(address(gold), 0, _xfer(bob, WAD), 0);
        vm.prank(bob);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.seal(uint64(block.timestamp + 1 days));
        assertSel(r.isValidSigner(alice, ""), r.isValidSigner.selector);
        assertSel(r.isValidSigner(bob, ""), bytes4(0));
        (, address tc, uint256 tid) = r.token();
        assertEq(tc, address(hub));
        assertEq(tid, id);
        assertEq(r.HUB(), address(hub));
        assertEq(r.owner(), alice);
    }

    /// @dev Drainer.take is a word no selector list has, and never will:
    ///      only measurement sees it. The control runs the same call before
    ///      the seal, so the refusal is the seal's and not an accident.
    function test_aDrainerWithAnUnknownWordStillShrinks() public {
        (, Reach r) = _mint(alice);
        _exec(r, alice, address(gold), 0, _approve(address(drainer), type(uint256).max));
        _exec(r, alice, address(drainer), 0, abi.encodeWithSelector(Drainer.take.selector, address(gold), WAD));
        assertEq(gold.balanceOf(address(drainer)), WAD, "unsealed, the drainer drains");

        _guard(r, alice, address(gold));
        _seal(r, alice, T0 + 30 days);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.Shrank.selector);
        r.execute(address(drainer), 0, abi.encodeWithSelector(Drainer.take.selector, address(gold), WAD), 0);
        assertEq(gold.balanceOf(address(r)), 999 * WAD, "not one wei left under the seal");

        // and ether is refused outright: it is on no manifest
        vm.prank(alice);
        vm.expectRevert(IReachEvents.ValueWhileSealed.selector);
        r.execute(bob, 1, "", 0);
    }

    function test_theSealOnlyLengthensAndSurvivesTheSale() public {
        (uint256 id, Reach r) = _mint(alice);
        _guard(r, alice, address(gold));
        _seal(r, alice, T0 + 30 days);
        assertEq(r.sealedUntil(), T0 + 30 days);
        assertTrue(r.isSealed());

        vm.prank(alice);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        r.seal(T0 + 10 days);
        vm.prank(alice);
        vm.expectRevert(Ratchet.TooLong.selector);
        r.seal(T0 + 400 days);

        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertEq(r.owner(), bob, "the Reach follows the token");
        assertEq(r.sealedUntil(), T0 + 30 days, "the seal is untouched by the sale");

        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSigner.selector);
        r.execute(address(gold), 0, _xfer(alice, WAD), 0);
        vm.prank(bob);
        vm.expectRevert(IReachEvents.Shrank.selector);
        r.execute(address(gold), 0, _xfer(bob, WAD), 0);

        vm.warp(T0 + 31 days);
        assertFalse(r.isSealed());
        _exec(r, bob, address(gold), 0, _xfer(bob, WAD));
        assertEq(gold.balanceOf(bob), WAD, "and then it lifts, for the buyer");
    }

    function test_sealMaxIsForTheHolderTheGuardianAndTheHub() public {
        (uint256 id, Reach r) = _mint(alice);
        vm.prank(bob);
        vm.expectRevert(IReachEvents.NotSignerOrGuardian.selector);
        r.sealMax();
        vm.prank(alice);
        hub.setGuardian(id, guardian);
        vm.prank(guardian);
        r.sealMax();
        assertEq(r.sealedUntil(), T0 + 365 days);
        // idempotent at the cap: a panic must never fail on an already-maxed seal
        vm.prank(address(hub));
        r.sealMax();
        assertEq(r.sealedUntil(), T0 + 365 days);
        vm.warp(T0 + 1 days);
        vm.prank(alice);
        r.sealMax();
        assertEq(r.sealedUntil(), T0 + 1 days + 365 days, "only ever later");
    }

    function test_aPromisedAssetHearsOnlyTransferWords() public {
        (, Reach r) = _mint(alice);
        _guard(r, alice, address(gold));
        _seal(r, alice, T0 + 30 days);

        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSafeWhileSealed.selector);
        r.execute(address(gold), 0, _approve(bob, type(uint256).max), 0);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSafeWhileSealed.selector);
        r.execute(address(gold), 0, abi.encodeWithSelector(0xd505accf), 0);          // permit
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSafeWhileSealed.selector);
        r.execute(address(gold), 0, abi.encodeWithSignature("balanceOf(address)", address(r)), 0);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSafeWhileSealed.selector);
        r.execute(address(gold), 0, "", 0);

        // a transfer that leaves it no poorer is the allowed word, and passes measurement
        _exec(r, alice, address(gold), 0, _xfer(address(r), WAD));
        // an unpromised asset is unpoliced — by design, and why manifest() is public
        _exec(r, alice, address(silver), 0, _xfer(bob, WAD));
        assertEq(silver.balanceOf(bob), WAD);
        // and the collection itself is never promised, so the account still acts
        _exec(r, alice, address(hub), 0, abi.encodeWithSignature("minted()"));
    }

    function test_aBatchIsOneActOrNone() public {
        (, Reach r) = _mint(alice);
        Call[] memory none = new Call[](0);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.EmptyBatch.selector);
        r.executeBatch(none);
        assertEq(r.state(), 0, "an empty batch moved nothing, not even the counter");

        Call[] memory two = new Call[](2);
        two[0] = Call(address(gold), 0, _xfer(bob, WAD));
        two[1] = Call(address(silver), 0, _xfer(bob, WAD));
        vm.prank(alice);
        r.executeBatch(two);
        assertEq(gold.balanceOf(bob), WAD);
        assertEq(silver.balanceOf(bob), WAD);
        assertEq(r.state(), 2, "one bump per call");

        _exec(r, alice, address(gold), 0, _approve(address(drainer), type(uint256).max));
        _guard(r, alice, address(gold));
        _seal(r, alice, T0 + 30 days);

        vm.prank(alice);
        vm.expectRevert(IReachEvents.Shrank.selector);
        r.executeBatch(two);
        assertEq(silver.balanceOf(bob), WAD, "the whole batch unwound, the silver did not move either");

        Call[] memory sneaky = new Call[](2);
        sneaky[0] = Call(address(silver), 0, _xfer(bob, WAD));
        sneaky[1] = Call(address(gold), 0, _approve(bob, type(uint256).max));
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSafeWhileSealed.selector);
        r.executeBatch(sneaky);

        // poorer in the middle, whole at the end: the ordinary shape of real work
        Call[] memory dip = new Call[](2);
        dip[0] = Call(address(gold), 0, _xfer(address(drainer), WAD));
        dip[1] = Call(address(drainer), 0, abi.encodeWithSelector(Drainer.give.selector, address(gold), address(r), WAD));
        vm.prank(alice);
        r.executeBatch(dip);
        assertEq(gold.balanceOf(address(r)), 999 * WAD, "dipped and came back whole");
    }

    /// @dev The SealBreaker attack: a contract holder re-enters `unguard` on
    ///      a blind asset from inside a sealed batch, renumbering the manifest
    ///      under the arrays the measurement took. The account refuses to let
    ///      the manifest move while it is inside any call.
    function test_theManifestCannotMoveInsideACall() public {
        Breakable brk = new Breakable();
        SealBreaker breaker = new SealBreaker();
        breaker.setup(address(hub), address(brk), address(gold));
        address acct = breaker.acct();
        gold.mint(acct, 1000 * WAD);
        brk.mint(acct, 5 * WAD);
        breaker.sealIt(T0 + 30 days);
        assertEq(Reach(payable(acct)).manifest().length, 2);

        // the control, with both assets readable: the manifest is frozen inside
        // any call the account makes, so the re-entered unguard is refused there
        vm.expectRevert(IReachEvents.ManifestBusy.selector);
        breaker.drain(address(gold), 100 * WAD, bob);

        brk.setBreakBalance(true);
        assertEq(Reach(payable(acct)).unmeasurable().length, 1, "one asset is blind, and says so");
        vm.expectRevert(IReachEvents.ManifestBusy.selector);
        breaker.drain(address(gold), 1000 * WAD, bob);
        assertEq(gold.balanceOf(acct), 1000 * WAD, "the gold never moved");
        assertEq(Reach(payable(acct)).manifest().length, 2, "and the manifest is intact");
    }

    function test_goingBlindDuringACallIsRefused() public {
        (, Reach r) = _mint(alice);
        Trap trap = new Trap();
        trap.mint(address(r), 5 * WAD);
        _guard(r, alice, address(trap));
        _seal(r, alice, T0 + 30 days);

        trap.watch(address(r));
        _exec(r, alice, address(silver), 0, abi.encodeWithSignature("balanceOf(address)", address(r)));

        // armed: it answers the snapshot pass and refuses the verify pass
        trap.arm(address(r));
        vm.prank(alice);
        vm.expectRevert(IReachEvents.WentBlind.selector);
        r.execute(address(silver), 0, abi.encodeWithSignature("balanceOf(address)", address(r)), 0);
    }

    function test_aBlindAssetCanBeLetGoAVisibleOneCannot() public {
        (, Reach r) = _mint(alice);
        Breakable brk = new Breakable();
        brk.mint(address(r), 5 * WAD);
        _guard(r, alice, address(brk));
        _guard(r, alice, address(gold));
        _seal(r, alice, T0 + 30 days);
        assertEq(r.unmeasurable().length, 0);

        brk.setBreakBalance(true);
        address[] memory blind = r.unmeasurable();
        assertEq(blind.length, 1);
        assertEq(blind[0], address(brk));
        (, address[] memory assets, , bool[] memory measured) = r.holdings();
        assertEq(assets.length, 2);
        assertFalse(measured[0], "zero and no answer are different facts");
        assertTrue(measured[1]);

        // a blind asset bricks nothing: the account still acts, and still holds what it can see
        _exec(r, alice, address(silver), 0, _xfer(bob, WAD));
        vm.prank(alice);
        vm.expectRevert(IReachEvents.Shrank.selector);
        r.execute(address(gold), 0, _xfer(bob, WAD), 0);
        // and it will not poke the asset it cannot see
        vm.prank(alice);
        vm.expectRevert(IReachEvents.BlindTarget.selector);
        r.execute(address(brk), 0, _xfer(address(r), 0), 0);

        vm.prank(alice);
        r.unguard(address(brk));
        assertEq(r.manifest().length, 1, "a token that stopped answering can be released mid-seal");
        vm.prank(alice);
        vm.expectRevert(IReachEvents.IsSealed.selector);
        r.unguard(address(gold));
    }

    function test_aGuardedPieceCannotBeDroppedFromInsideTheCallThatMovesIt() public {
        (, Reach r) = _mint(alice);
        MockERC721 punk = new MockERC721();
        punk.mint(address(r), 7);
        vm.prank(alice);
        r.guardNFT(address(punk), 7);
        _seal(r, alice, T0 + 30 days);
        assertEq(r.pieces().length, 1);

        bytes memory move = abi.encodeWithSelector(XFER_FROM, address(r), bob, 7);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.PieceLeft.selector);
        r.execute(address(punk), 0, move, 0);

        Call[] memory batch = new Call[](2);
        batch[0] = Call(address(punk), 0, move);
        batch[1] = Call(address(r), 0, abi.encodeWithSignature("unguardNFT(uint256)", 0));
        vm.prank(alice);
        vm.expectRevert();
        r.executeBatch(batch);
        assertEq(punk.ownerOf(7), address(r), "the piece is still held");
        assertEq(r.pieces().length, 1, "and still named");

        // a swap for a worthless piece: the collection of a guarded piece hears
        // only transfer words while sealed, so `trade` never runs
        punk.mint(bob, 8);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSafeWhileSealed.selector);
        r.execute(address(punk), 0, abi.encodeWithSelector(MockERC721.trade.selector, 7, 8, bob), 0);

        // and a word on an UNPOLICED target that moves the piece through an
        // operator approval is caught by ownerOf — a count is not an identity
        (, Reach r2) = _mint(alice);
        PieceTaker taker = new PieceTaker();
        punk.mint(address(r2), 9);
        _exec(r2, alice, address(punk), 0, abi.encodeWithSelector(APPROVE_ALL, address(taker), true));
        vm.prank(alice);
        r2.guardNFT(address(punk), 9);
        _seal(r2, alice, T0 + 30 days);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.PieceLeft.selector);
        r2.execute(address(taker), 0, abi.encodeWithSelector(PieceTaker.take.selector, address(punk), address(r2), bob, 9), 0);
        assertEq(punk.ownerOf(9), address(r2));
    }

    function test_auditRootChainsEveryCall() public {
        (, Reach r) = _mint(alice);
        assertEq(r.auditRoot(), bytes32(0));
        bytes memory data = _xfer(bob, WAD);
        _exec(r, alice, address(gold), 0, data);
        bytes32 expected = keccak256(abi.encode(
            bytes32(0), block.chainid, address(r), alice, address(gold), uint256(0), XFER, keccak256(data),
            uint8(0), uint256(1), block.timestamp));
        assertEq(r.auditRoot(), expected, "the link is exactly the documented tuple");
        _exec(r, alice, address(gold), 0, data);
        assertTrue(r.auditRoot() != expected, "and every call extends it");
    }

    function test_receivingNeverGrantsAndTheCycleIsRefusedAtTheDoor() public {
        (uint256 id, Reach r) = _mint(alice);
        assertSel(r.onERC721Received(alice, alice, 99, ""), r.onERC721Received.selector);
        vm.prank(address(hub));
        vm.expectRevert(IReachEvents.OwnershipCycle.selector);
        r.onERC721Received(alice, alice, id, "");
        assertSel(r.onERC1155Received(alice, alice, 1, 1, ""), r.onERC1155Received.selector);
        assertTrue(r.supportsInterface(0x6faff5f1));
        assertTrue(r.supportsInterface(0x51945447));
        assertTrue(r.supportsInterface(0x1626ba7e));
        assertFalse(r.supportsInterface(0xffffffff));
        assertEq(r.MAX_SEAL(), 365 days);
        assertEq(r.MAX_MANIFEST(), 16);
        assertEq(r.MAX_PIECES(), 8);
        assertEq(r.MAX_LIST(), 16);
        assertEq(r.MAX_BATCH(), 16);
        assertEq(r.MAX_LEDGER(), 32);
        assertEq(r.MAX_SESSION(), 365 days);
    }
}
