// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {MockReachImpl} from "./helpers/HubMocks.sol";
import {MockERC721} from "./mocks/MockERC721.sol";
import {IIntact, IIntactEvents, Status, Traits} from "../src/interfaces/IIntact.sol";
import {Rights} from "../src/lib/Rights.sol";
import {Ratchet} from "../src/lib/Ratchet.sol";
import {AccountBinding, IAccountRegistry} from "../src/lib/AccountBinding.sol";

/*  DESIGN.md §14 A1, A2, A5: what a custody change does, what a lock
    forbids, and where an Intact may never go. Runs against either build. */
contract UpdateTest is IntactFixture {
    address op = address(0x0A);
    address renter = address(0x2E);
    address key = address(0x5E55);
    address wallet = address(0x3A11E7);

    function setUp() public { setUpWorld(); }

    function test_sellingTheTokenRevokesEverySellerAuthority() public {
        uint256 id = mintTo(alice);
        vm.startPrank(alice);
        hub.approve(carol, id);
        hub.setApprovalForAll(op, true);
        hub.setUser(id, renter, T0 + 30 days);
        hub.setGuardian(id, guardian);
        hub.proposeAgentWallet(id, wallet);
        hub.pinTokenURI(id, 1);
        hub.setFeesToGrip(id, true);
        vm.stopPrank();
        vm.prank(wallet);
        hub.acceptAgentWallet(id);
        reachOf(id).grant(key);

        // every authority is live before the sale, so nothing below is vacuous
        assertEq(bitsOf(id, alice), Rights.R_HOLD);
        assertEq(bitsOf(id, carol), Rights.R_CUSTODY);
        assertEq(bitsOf(id, op), Rights.R_CUSTODY);
        assertEq(bitsOf(id, renter), Rights.R_USE);
        assertEq(bitsOf(id, guardian), Rights.R_GUARDIAN);
        assertEq(bitsOf(id, key), Rights.R_SESSION);
        assertEq(hub.agentWalletOf(id), wallet);
        assertTrue(hub.hasPinnedTokenURI(id));
        assertEq(hub.feeSink(id), hub.grip(id));
        assertTrue(hub.statusOf(id) == Status.Active);
        assertEq(hub.custodyEpoch(id), 1);

        vm.prank(alice);
        hub.transferFrom(alice, bob, id);

        assertEq(hub.ownerOf(id), bob);
        assertEq(hub.custodyEpoch(id), 2);
        assertEq(hub.getApproved(id), address(0));
        assertEq(hub.userOf(id), address(0));
        assertEq(hub.userExpires(id), 0);
        assertEq(hub.guardianOf(id), address(0));
        assertEq(hub.agentWalletOf(id), hub.account(id), "the wallet is unbound; the Reach answers again");
        assertFalse(hub.hasPinnedTokenURI(id));
        assertEq(hub.feeSink(id), hub.account(id));
        assertTrue(hub.statusOf(id) == Status.Paused);
        assertEq(bitsOf(id, alice), 0, "the seller holds nothing the block after the sale");
        assertEq(bitsOf(id, carol), 0);
        assertEq(bitsOf(id, op), 0, "the seller's operator is nobody to the buyer");
        assertEq(bitsOf(id, renter), 0);
        assertEq(bitsOf(id, guardian), 0);
        assertEq(bitsOf(id, key), 0, "a session dies by reading the epoch, not by being cleared");
        assertFalse(reachOf(id).sessionCurrent(key));
        assertEq(bitsOf(id, wallet), 0);
        assertEq(bitsOf(id, bob), Rights.R_HOLD);
        // operator approvals are per owner: the seller's grant is untouched and covers nothing of theirs
        assertTrue(hub.isApprovedForAll(alice, op));
        assertEq(hub.approvalEpoch(alice), 0);
        // and none of the seller's keys can act
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(1)));
        vm.prank(op);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.transferFrom(bob, alice, id);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.transferFrom(bob, alice, id);
    }

    function test_selfTransferBumpsTheEpochAndRevivesNothing() public {
        uint256 id = mintTo(alice);
        vm.startPrank(alice);
        hub.setUser(id, renter, T0 + 30 days);
        hub.approve(carol, id);
        vm.stopPrank();
        reachOf(id).grant(key);
        assertTrue(reachOf(id).sessionCurrent(key));

        vm.prank(alice);
        hub.transferFrom(alice, alice, id);

        assertEq(hub.ownerOf(id), alice);
        assertEq(hub.custodyEpoch(id), 2, "a self-transfer is a custody change");
        assertEq(hub.userOf(id), address(0));
        assertEq(hub.getApproved(id), address(0));
        assertFalse(reachOf(id).sessionCurrent(key));
        assertEq(bitsOf(id, key), 0);
        assertTrue(hub.statusOf(id) == Status.Paused);
        assertEq(hub.balanceOf(alice), 1);
        assertEq(hub.tokenOfOwnerByIndex(alice, 0), id);
    }

    function test_buyBackRevivesNoSession() public {
        uint256 id = mintTo(alice);
        reachOf(id).grant(key);
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        vm.prank(bob);
        hub.transferFrom(bob, alice, id);
        assertEq(hub.ownerOf(id), alice);
        assertEq(hub.custodyEpoch(id), 3);
        assertFalse(reachOf(id).sessionCurrent(key), "away and back revives nothing");
        assertEq(bitsOf(id, key), 0);
        // a fresh grant under the new epoch is live, so the assertion above was about the epoch
        reachOf(id).grant(key);
        assertTrue(reachOf(id).sessionCurrent(key));
        assertEq(bitsOf(id, key), Rights.R_SESSION);
    }

    function test_aLockedTokenCannotMove() public {
        uint256 id = mintTo(alice);
        vm.prank(address(steward));
        hub.moduleLock(id);
        assertTrue(hub.locked(id));
        assertFalse(hub.isTransferable(id, alice, bob));
        assertEq(hub.getTraitValue(id, Traits.LOCKED), bytes32(uint256(1)));

        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, bob, id);
        // nor through the modules' own doors
        vm.prank(market);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.moduleTransfer(id, bob);
        vm.prank(address(steward));
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.stewardTransfer(id, bob);

        // two locks, one release: still held — a count, not a flag
        vm.prank(market);
        hub.moduleLock(id);
        vm.prank(address(steward));
        hub.moduleUnlock(id);
        assertTrue(hub.locked(id));
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, bob, id);

        vm.prank(market);
        hub.moduleUnlock(id);
        assertFalse(hub.locked(id));
        assertTrue(hub.isTransferable(id, alice, bob));
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.ownerOf(id), bob);
    }

    function test_onlyPinnedModulesMayLock() public {
        uint256 id = mintTo(alice);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotModule.selector);
        hub.moduleLock(id);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotModule.selector);
        hub.moduleLock(id);
        vm.prank(hub.account(id));
        vm.expectRevert(IIntactEvents.NotModule.selector);
        hub.moduleLock(id);
        vm.prank(timelock);
        vm.expectRevert(IIntactEvents.NotModule.selector);
        hub.moduleLock(id);

        address[3] memory modules = [address(steward), market, address(roles)];
        for (uint256 i; i < modules.length; ++i) {
            vm.prank(modules[i]);
            hub.moduleLock(id);
            assertTrue(hub.locked(id));
            vm.prank(modules[i]);
            hub.moduleUnlock(id);
            assertFalse(hub.locked(id));
        }
        // and never on a token that does not exist
        vm.prank(market);
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        hub.moduleLock(id + 1);
    }

    function test_unlockingAtZeroReverts() public {
        uint256 id = mintTo(alice);
        vm.prank(market);
        vm.expectRevert(IIntactEvents.NotLocked.selector);
        hub.moduleUnlock(id);
        vm.prank(market);
        hub.moduleLock(id);
        vm.prank(market);
        hub.moduleUnlock(id);
        vm.prank(market);
        vm.expectRevert(IIntactEvents.NotLocked.selector);
        hub.moduleUnlock(id);
        assertFalse(hub.locked(id));
    }

    function test_noIntactCanEnterAnyIntactsAccounts() public {
        uint256 a = mintTo(alice);
        uint256 b = mintTo(alice);
        // an account of an id nobody has minted, deployed by anyone through the registry
        address preDeployed = IAccountRegistry(REGISTRY).createAccount(
            address(reachImpl), AccountBinding.REACH_SALT, block.chainid, address(hub), 2000);
        address preDeployedGrip = IAccountRegistry(REGISTRY).createAccount(
            address(gripImpl), AccountBinding.GRIP_SALT, block.chainid, address(hub), 2000);

        address[9] memory refused = [
            hub.account(a), hub.grip(a), hub.account(b), hub.grip(b),
            address(hub), address(reachImpl), address(gripImpl), preDeployed, preDeployedGrip
        ];
        for (uint256 i; i < refused.length; ++i) {
            assertFalse(hub.isTransferable(a, alice, refused[i]));
            vm.prank(alice);
            vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
            hub.transferFrom(alice, refused[i], a);
            vm.prank(alice);
            vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
            hub.safeTransferFrom(alice, refused[i], a);
            vm.prank(alice);
            vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
            hub.mint{value: PRICE}(refused[i]);
        }
        assertEq(hub.ownerOf(a), alice);
        assertEq(hub.minted(), 2);

        // a forwarder of ANOTHER collection, even one using our implementation and salt, is an ordinary recipient
        address foreign = IAccountRegistry(REGISTRY).createAccount(
            address(reachImpl), AccountBinding.REACH_SALT, block.chainid, address(0xF0E), 1);
        assertTrue(hub.isTransferable(a, alice, foreign));
        vm.prank(alice);
        hub.transferFrom(alice, foreign, a);
        assertEq(hub.ownerOf(a), foreign);
    }

    function test_aGripNeverStrandsAnIntact() public {
        uint256 a = mintTo(alice);
        uint256 b = mintTo(alice);
        address gripA = hub.grip(a);
        address gripB = hub.grip(b);
        // the Grip has no function that sends anything, including a token: an Intact inside it would be lost for ever
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
        hub.transferFrom(alice, gripA, a);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
        hub.transferFrom(alice, gripB, a);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
        hub.safeTransferFrom(alice, gripB, a, "");
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
        hub.mint{value: PRICE}(gripA);
        assertFalse(hub.isTransferable(a, alice, gripB));
        // other collections' tokens may enter either hand freely
        MockERC721 other = new MockERC721();
        other.mint(hub.grip(a), 1);
        other.mint(hub.account(a), 2);
        assertEq(other.ownerOf(1), hub.grip(a));
        assertEq(other.ownerOf(2), hub.account(a));
    }

    function test_sellingJLeavesKNoSellerSession() public {
        uint256 j = mintTo(alice);
        uint256 k = mintTo(alice);
        reachOf(j).grant(key);
        reachOf(k).grant(key);
        assertEq(bitsOf(j, key), Rights.R_SESSION);
        assertEq(bitsOf(k, key), Rights.R_SESSION);

        // k can never ride inside j: the one way a sale of j could carry k's sessions is closed
        address reachJ = hub.account(j);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
        hub.transferFrom(alice, reachJ, k);

        vm.prank(alice);
        hub.transferFrom(alice, bob, j);
        assertEq(bitsOf(j, key), 0, "the sold token's session is dead");
        assertEq(bitsOf(k, key), Rights.R_SESSION, "the kept token's session is the seller's own and stands");
        assertEq(hub.custodyEpoch(k), 1);
        assertEq(bitsOf(k, bob), 0, "the buyer of j has nothing on k");
        assertEq(bitsOf(j, alice), 0);
    }

    function test_stewardTransferRespectsASeal() public {
        uint256 id = mintTo(alice);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.sealTransfer(id, T0 + 30 days);
        vm.prank(alice);
        hub.sealTransfer(id, T0 + 30 days);
        assertEq(hub.transferSealUntil(id), T0 + 30 days);
        // the seal is a ratchet
        vm.prank(alice);
        vm.expectRevert(Ratchet.RatchetOnly.selector);
        hub.sealTransfer(id, T0 + 29 days);
        vm.prank(alice);
        vm.expectRevert(Ratchet.TooLong.selector);
        hub.sealTransfer(id, T0 + 366 days);

        // nobody moves it under the seal: not the steward, not the market, not the holder
        vm.prank(address(steward));
        vm.expectRevert(IIntactEvents.IsTransferSealed.selector);
        hub.stewardTransfer(id, bob);
        vm.prank(market);
        vm.expectRevert(IIntactEvents.IsTransferSealed.selector);
        hub.moduleTransfer(id, bob);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsTransferSealed.selector);
        hub.transferFrom(alice, bob, id);
        assertFalse(hub.isTransferable(id, alice, bob));

        // and only the pinned modules may use their doors at all
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotSteward.selector);
        hub.stewardTransfer(id, bob);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotMarket.selector);
        hub.moduleTransfer(id, bob);

        vm.warp(T0 + 30 days + 1);
        assertTrue(hub.isTransferable(id, alice, bob));
        vm.prank(address(steward));
        hub.stewardTransfer(id, bob);
        assertEq(hub.ownerOf(id), bob);
        assertEq(hub.custodyEpoch(id), 2, "the steward's move is a custody change like any other");
        assertTrue(hub.statusOf(id) == Status.Paused);
        // the market's door is the same path
        vm.prank(market);
        hub.moduleTransfer(id, carol);
        assertEq(hub.ownerOf(id), carol);
        assertEq(hub.custodyEpoch(id), 3);
    }
}
