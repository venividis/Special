// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Locks} from "../src/Locks.sol";
import {ILocksEvents, Lock} from "../src/interfaces/ILocks.sol";
import {Ratchet} from "../src/lib/Ratchet.sol";
import {Transient} from "../src/lib/Transient.sol";
import {ExactERC20} from "../src/lib/ExactERC20.sol";
import {AccountBinding, IAccountRegistry} from "../src/lib/AccountBinding.sol";
import {MockHubForVault, StubAccountImpl} from "./mocks/MockHubForVault.sol";
import {MockRegistry6551} from "./mocks/MockRegistry6551.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @dev A beneficiary that tries to release again from inside its own
///      payout. The nested call must be refused and the outer must land.
contract ReentrantBeneficiary {
    Locks immutable L;
    uint256 public id;
    bool public tried;
    bool public refused;
    constructor(Locks l) { L = l; }
    function arm(uint256 id_) external { id = id_; }
    receive() external payable {
        tried = true;
        (bool ok, bytes memory why) = address(L).call(abi.encodeCall(Locks.release, (id)));
        refused = !ok && bytes4(why) == Transient.Reentrancy.selector;
    }
}

/*  DESIGN.md §9.3 "Locks" and §3 row 25: fixed beneficiary, exact pulls,
    permissionless release, forward-only extend, give only into a Reach. */
contract LocksTest is Test {
    uint64 constant T0 = 1_733_000_000;
    address constant REGISTRY = AccountBinding.REGISTRY;

    MockHubForVault hub;
    Locks locks;
    MockERC20 token;
    MockERC20 feeToken;
    StubAccountImpl impl;
    address reach;                       // the canonical Reach of token 1
    address stranger = address(0x5712);
    address bene = address(0xBE11E);

    function setUp() public {
        vm.warp(T0);
        vm.etch(REGISTRY, type(MockRegistry6551).runtimeCode);
        impl = new StubAccountImpl();
        hub = new MockHubForVault(address(impl), address(impl));
        hub.mint(address(this));
        reach = hub.createReach(1);
        locks = new Locks(address(hub));
        token = new MockERC20("Token", "TKN", 18, 0, false);
        token.mint(address(this), 1e24);
        token.approve(address(locks), type(uint256).max);
        feeToken = new MockERC20("Fee", "FEE", 18, 1_000, false);
        feeToken.mint(address(this), 1e24);
        feeToken.approve(address(locks), type(uint256).max);
        vm.deal(stranger, 1 ether);
    }

    function _cliff(address to, uint64 at) internal returns (uint256) {
        return locks.lock{value: 1 ether}(address(0), 1 ether, to, 0, at, at, false);
    }

    function test_releaseGoesOnlyToTheBeneficiary() public {
        // a native cliff lock whose beneficiary is the token's Reach
        uint256 id = _cliff(reach, T0 + 10 days);
        assertEq(locks.lockCount(), 1);
        assertEq(locks.liability(address(0)), 1 ether);
        assertEq(locks.releasable(id), 0, "nothing before the cliff");
        vm.expectRevert(ILocksEvents.NothingReleasable.selector);
        locks.release(id);

        // a stranger presses the button; the Reach is paid, the stranger is not
        vm.warp(T0 + 10 days);
        uint256 strangerBefore = stranger.balance;
        vm.prank(stranger);
        uint256 paid = locks.release(id);
        assertEq(paid, 1 ether);
        assertEq(reach.balance, 1 ether, "the committed beneficiary received it");
        assertEq(stranger.balance, strangerBefore, "the caller received nothing");
        assertEq(address(locks).balance, 0);
        assertEq(locks.liability(address(0)), 0);
        assertEq(locks.lockOf(id).released, 1 ether);
        vm.expectRevert(ILocksEvents.NothingReleasable.selector);
        locks.release(id);

        // an ERC-20 linear vest pays by the clock, always to `bene`
        uint256 v = locks.lock(address(token), 1_000e18, bene, 0, 0, T0 + 10 days + 100 days, true);
        assertEq(locks.liability(address(token)), 1_000e18);
        vm.warp(T0 + 10 days + 50 days);
        assertEq(locks.releasable(v), 500e18);
        vm.prank(stranger);
        locks.release(v);
        assertEq(token.balanceOf(bene), 500e18);
        assertEq(token.balanceOf(stranger), 0);
        assertEq(locks.releasable(v), 0, "paid up to the minute");
        vm.expectRevert(ILocksEvents.NothingReleasable.selector);
        locks.release(v);
        vm.warp(T0 + 10 days + 100 days);
        locks.release(v);
        assertEq(token.balanceOf(bene), 1_000e18, "the whole amount by the end");
        assertEq(locks.liability(address(token)), 0);
        assertEq(token.balanceOf(address(locks)), 0, "the vault holds nothing it does not owe");
    }

    function test_extendOnlyLengthens() public {
        uint256 id = _cliff(address(this), T0 + 30 days);
        bytes32 c0 = locks.commitmentOf(address(this));

        vm.prank(stranger);
        vm.expectRevert(ILocksEvents.NotBeneficiary.selector);
        locks.extend(id, T0 + 60 days);

        // the same moment is not longer, an earlier one is shorter, the cap is the cap
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        locks.extend(id, T0 + 30 days);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        locks.extend(id, T0 + 29 days);
        vm.expectRevert(Ratchet.TooLong.selector);
        locks.extend(id, T0 + Ratchet.LOCK_CAP + 1);
        assertEq(locks.lockOf(id).end, T0 + 30 days, "a refused extension leaves the promise standing");
        assertEq(locks.commitmentOf(address(this)), c0, "and the commitment untouched");

        locks.extend(id, T0 + 60 days);
        Lock memory l = locks.lockOf(id);
        assertEq(l.end, T0 + 60 days);
        assertEq(l.cliff, T0 + 60 days, "a cliff lock's cliff moves with its end");
        assertTrue(locks.commitmentOf(address(this)) != c0, "the commitment moved");
        vm.warp(T0 + 30 days);
        assertEq(locks.releasable(id), 0, "the old date no longer releases");

        // a linear vest flattens its slope and claws nothing back
        uint256 v = locks.lock(address(token), 100e18, address(this), T0 + 30 days, 0, T0 + 130 days, true);
        vm.warp(T0 + 80 days);
        locks.release(v);
        assertEq(locks.lockOf(v).released, 50e18);
        locks.extend(v, T0 + 230 days);
        assertEq(locks.lockOf(v).start, T0 + 30 days, "the start does not move");
        assertEq(locks.lockOf(v).cliff, T0 + 30 days, "nor the cliff");
        assertEq(locks.releasable(v), 0, "vested is now 25, released is 50: nothing to pay, nothing taken back");
        vm.warp(T0 + 130 days);
        assertEq(locks.releasable(v), 0, "the new line catches up at 50");
        vm.warp(T0 + 180 days);
        assertEq(locks.releasable(v), 25e18, "and then pays again");

        // a promise already kept cannot be lengthened into a new one
        vm.warp(T0 + 60 days);
        vm.expectRevert(ILocksEvents.UnsupportedSchedule.selector);
        locks.extend(id, T0 + 90 days);
    }

    function test_giveOnlyIntoACanonicalReach() public {
        uint256 id = _cliff(address(this), T0 + 10 days);
        IAccountRegistry reg = IAccountRegistry(REGISTRY);

        // an EOA, a forwarder of another collection, a forwarder of this
        // collection on a foreign implementation, and the token's Grip: none
        // is a Reach, whatever it says about itself
        vm.expectRevert(abi.encodeWithSelector(ILocksEvents.NotCanonicalReach.selector, stranger));
        locks.give(id, stranger);

        address foreign = reg.createAccount(address(impl), AccountBinding.REACH_SALT, block.chainid, address(0xC011), 1);
        vm.expectRevert(abi.encodeWithSelector(ILocksEvents.NotCanonicalReach.selector, foreign));
        locks.give(id, foreign);

        StubAccountImpl other = new StubAccountImpl();
        address impostor = reg.createAccount(address(other), AccountBinding.REACH_SALT, block.chainid, address(hub), 1);
        vm.expectRevert(abi.encodeWithSelector(ILocksEvents.NotCanonicalReach.selector, impostor));
        locks.give(id, impostor);

        address grip = reg.createAccount(address(impl), AccountBinding.GRIP_SALT, block.chainid, address(hub), 1);
        assertEq(grip, hub.grip(1));
        vm.expectRevert(abi.encodeWithSelector(ILocksEvents.NotCanonicalReach.selector, grip));
        locks.give(id, grip);

        vm.expectRevert(abi.encodeWithSelector(ILocksEvents.NotCanonicalReach.selector, address(0)));
        locks.give(id, address(0));

        // only the beneficiary may hand it on
        vm.prank(stranger);
        vm.expectRevert(ILocksEvents.NotBeneficiary.selector);
        locks.give(id, reach);

        bytes32 mine = locks.commitmentOf(address(this));
        assertEq(locks.commitmentOf(reach), bytes32(0));
        locks.give(id, reach);
        assertEq(locks.lockOf(id).beneficiary, reach);
        assertEq(locks.lockCountOf(reach), 1);
        assertEq(locks.lockIdOf(reach, 0), id);
        assertEq(locks.lockCountOf(address(this)), 1, "the old index keeps its entry: a finding aid, not the truth");
        assertTrue(locks.commitmentOf(address(this)) != mine, "the giver's estate changed");
        assertTrue(locks.commitmentOf(reach) != bytes32(0), "and so did the Reach's");

        vm.expectRevert(ILocksEvents.NotBeneficiary.selector);
        locks.give(id, reach);

        vm.warp(T0 + 10 days);
        locks.release(id);
        assertEq(reach.balance, 1 ether, "the Reach is paid, the giver is not");
    }

    function test_lockRecordsExactlyWhatArrived() public {
        // a token that skims is refused outright, never recorded short
        vm.expectRevert(abi.encodeWithSelector(ExactERC20.InexactERC20Transfer.selector, address(feeToken), 100e18, 90e18));
        locks.lock(address(feeToken), 100e18, bene, 0, 0, T0 + 10 days, true);
        assertEq(locks.lockCount(), 0);

        vm.expectRevert(ILocksEvents.WrongValue.selector);
        locks.lock{value: 0.5 ether}(address(0), 1 ether, bene, 0, T0 + 1 days, T0 + 1 days, false);
        vm.expectRevert(ILocksEvents.WrongValue.selector);
        locks.lock{value: 1}(address(token), 1e18, bene, 0, T0 + 1 days, T0 + 1 days, false);
        vm.expectRevert(ILocksEvents.ZeroAmount.selector);
        locks.lock(address(token), 0, bene, 0, T0 + 1 days, T0 + 1 days, false);
        vm.expectRevert(ILocksEvents.ZeroAddress.selector);
        locks.lock(address(token), 1e18, address(0), 0, T0 + 1 days, T0 + 1 days, false);
        vm.expectRevert(ILocksEvents.ZeroAddress.selector);
        locks.lock(address(token), 1e18, address(locks), 0, T0 + 1 days, T0 + 1 days, false);

        // the end is a time promise: future, and within ten years
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        locks.lock(address(token), 1e18, bene, 0, 0, T0, false);
        vm.expectRevert(Ratchet.TooLong.selector);
        locks.lock(address(token), 1e18, bene, 0, 0, T0 + Ratchet.LOCK_CAP + 1, true);
        assertEq(locks.MAX_TERM(), 3650 days);

        // the schedule must make sense
        vm.expectRevert(ILocksEvents.UnsupportedSchedule.selector);
        locks.lock(address(token), 1e18, bene, 0, T0 + 1 days, T0 + 2 days, false);      // cliff != end on a cliff lock
        vm.expectRevert(ILocksEvents.UnsupportedSchedule.selector);
        locks.lock(address(token), 1e18, bene, T0 + 5 days, T0 + 1 days, T0 + 9 days, true); // cliff before start
        vm.expectRevert(ILocksEvents.UnsupportedSchedule.selector);
        locks.lock(address(token), 1e18, bene, T0 - 1, 0, T0 + 9 days, true);               // start in the past
        vm.expectRevert(ILocksEvents.UnsupportedSchedule.selector);
        locks.lock(address(token), 1e18, bene, T0 + 9 days, 0, T0 + 9 days, true);          // end not after start

        // an honest token lands, to the wei, and the vault's books match its balance
        uint256 id = locks.lock(address(token), 123e18, bene, 0, T0 + 3 days, T0 + 3 days, false);
        assertEq(locks.lockOf(id).amount, 123e18);
        assertEq(locks.liability(address(token)), 123e18);
        assertEq(token.balanceOf(address(locks)), 123e18);
        assertEq(locks.lockOf(id).depositor, address(this));
    }

    function test_aNestedReleaseIsRefused() public {
        ReentrantBeneficiary r = new ReentrantBeneficiary(locks);
        uint256 id = _cliff(address(r), T0 + 1 days);
        r.arm(id);
        vm.warp(T0 + 1 days);
        locks.release(id);
        assertTrue(r.tried(), "the beneficiary tried to re-enter");
        assertTrue(r.refused(), "and was refused with Reentrancy");
        assertEq(address(r).balance, 1 ether, "the outer release still landed, once");
        assertEq(locks.liability(address(0)), 0);
    }

    function test_commitmentMovesOnEveryChange() public {
        bytes32 c = locks.commitmentOf(address(this));
        uint256 id = locks.lock(address(token), 10e18, address(this), 0, 0, T0 + 100 days, true);
        bytes32 c1 = locks.commitmentOf(address(this));
        assertTrue(c1 != c, "lock");
        vm.warp(T0 + 50 days);
        locks.release(id);
        bytes32 c2 = locks.commitmentOf(address(this));
        assertTrue(c2 != c1, "release");
        locks.extend(id, T0 + 200 days);
        bytes32 c3 = locks.commitmentOf(address(this));
        assertTrue(c3 != c2, "extend");
        locks.give(id, reach);
        assertTrue(locks.commitmentOf(address(this)) != c3, "give, on the giver");
        assertTrue(locks.commitmentOf(reach) != bytes32(0), "give, on the receiver");
        // an untouched estate stays where it was
        assertEq(locks.commitmentOf(bene), bytes32(0));
    }
}
