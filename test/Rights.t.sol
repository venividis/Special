// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {MockDelegateRegistry, CodeHolder} from "./helpers/HubMocks.sol";
import {MockERC721} from "./mocks/MockERC721.sol";
import {IIntact, IIntactEvents, Status, Traits, Core} from "../src/interfaces/IIntact.sol";
import {Rights} from "../src/lib/Rights.sol";

/*  DESIGN.md §14 A7, C5, G1 and §2's "each actor stated": a holder with
    code still holds, a renter has a sentence and no lever, receiving
    grants nothing, and the agent wallet proves control by accepting. */
contract RightsTest is IntactFixture {
    address renter = address(0x2E);
    address wallet = address(0x3A11E7);

    function setUp() public { setUpWorld(); }

    function test_aDelegatedHolderStillHolds() public {
        // A holder whose address carries code — a smart account, or an EOA
        // under EIP-7702 delegation — meets no "EOA-only" gate anywhere.
        CodeHolder h = new CodeHolder();
        vm.deal(address(h), 1 ether);
        bytes memory ret = h.call{value: PRICE}(address(hub), abi.encodeCall(IIntact.mint, (address(h))));
        uint256 id = abi.decode(ret, (uint256));
        assertEq(hub.ownerOf(id), address(h));
        assertEq(bitsOf(id, address(h)), Rights.R_HOLD);
        assertTrue(hub.holds(id, address(h)));
        assertTrue(hub.acts(id, address(h)));
        h.call(address(hub), abi.encodeCall(IIntact.setTrait, (id, Traits.CURVE, bytes32(uint256(77)))));
        assertEq(hub.getTraitValue(id, Traits.CURVE), bytes32(uint256(77)));
        h.call(address(hub), abi.encodeCall(IIntact.sealTransfer, (id, uint64(T0 + 1 days))));
        h.call(address(hub), abi.encodeCall(IIntact.setGuardian, (id, guardian)));
        h.call(address(hub), abi.encodeCall(IIntact.approve, (carol, id)));
        assertEq(hub.getApproved(id), carol);

        // delegate.xyz, when present, is a viewing right and nothing more
        vm.etch(DELEGATE_REGISTRY, address(new MockDelegateRegistry()).code);
        MockDelegateRegistry(DELEGATE_REGISTRY).set(bob, address(h), address(hub), id, true);
        assertEq(bitsOf(id, bob), Rights.R_DELEGATE);
        vm.prank(bob);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(1)));
        assertFalse(hub.acts(id, bob));
        // under the seal every mover is refused before authorisation is even asked (DESIGN §4.4 order)
        vm.prank(bob);
        vm.expectRevert(IIntactEvents.IsTransferSealed.selector);
        hub.transferFrom(address(h), bob, id);

        vm.warp(T0 + 1 days + 1);
        vm.prank(bob);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.transferFrom(address(h), bob, id);
        h.call(address(hub), abi.encodeCall(IIntact.transferFrom, (address(h), bob, id)));
        assertEq(hub.ownerOf(id), bob);
        // the viewing right was the previous holder's grant: bob holds in his own right now, and only that
        assertEq(bitsOf(id, bob), Rights.R_HOLD);
        MockDelegateRegistry(DELEGATE_REGISTRY).set(carol, bob, address(hub), id, true);
        assertEq(bitsOf(id, carol), Rights.R_DELEGATE, "the bit follows the current holder's delegation");
    }

    function test_aRenterCannotSetATrait() public {
        uint256 id = mintTo(alice);
        vm.prank(alice);
        hub.setUser(id, renter, uint64(T0 + 30 days));
        assertEq(hub.userOf(id), renter);
        assertEq(hub.userExpires(id), T0 + 30 days);
        assertEq(bitsOf(id, renter), Rights.R_USE);
        assertFalse(hub.acts(id, renter));
        assertFalse(hub.holds(id, renter));

        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(1)));
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setTrait(id, Traits.NAME, bytes32("mine"));
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotActor.selector);
        hub.setStatus(id, Status.Paused);
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.pinTokenURI(id, 1);
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.transferFrom(alice, renter, id);
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.sealTransfer(id, uint64(T0 + 2 days));
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setUser(id, renter, uint64(T0 + 300 days));
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotAuthorized.selector);
        hub.approve(renter, id);

        // the sentence ends with the lease
        vm.warp(T0 + 30 days + 1);
        assertEq(hub.userOf(id), address(0));
        assertEq(bitsOf(id, renter), 0);

        // a USER named by a Roles satellite is reported the same way, and has the same nothing
        roles.set(id, carol, uint64(T0 + 60 days));
        assertEq(hub.userOf(id), carol);
        assertEq(hub.userExpires(id), T0 + 60 days);
        assertEq(bitsOf(id, carol), Rights.R_USE | Rights.R_ROLE);
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(1)));

        // the holder sets the curve, within the bound
        vm.prank(alice);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(80_000)));
        assertEq(hub.getTraitValue(id, Traits.CURVE), bytes32(uint256(80_000)));
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.BadTrait.selector);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(80_001)));
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.BadTrait.selector);
        hub.setTrait(id, keccak256("other"), bytes32(uint256(1)));
    }

    function test_receivingATokenGrantsNothing() public {
        uint256 id = mintTo(alice);
        address r = hub.account(id);
        address g = hub.grip(id);
        // a stranger pays ether and a foreign NFT into both hands
        MockERC721 other = new MockERC721();
        other.mint(carol, 7);
        other.mint(carol, 8);
        vm.prank(carol);
        other.transferFrom(carol, r, 7);
        vm.prank(carol);
        other.transferFrom(carol, g, 8);
        vm.prank(carol);
        (bool ok, ) = r.call{value: 1 ether}("");
        assertTrue(ok);
        vm.prank(carol);
        (ok, ) = g.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(other.ownerOf(7), r);
        assertEq(other.ownerOf(8), g);
        assertEq(r.balance, 1 ether);
        assertEq(bitsOf(id, carol), 0, "paying into the hands grants the payer nothing");
        assertEq(bitsOf(id, address(other)), 0);
        assertEq(bitsOf(id, r), Rights.R_ACCOUNT, "the hand itself gains nothing it did not have");
        assertEq(bitsOf(id, g), 0);
        assertFalse(reachOf(id).sessionCurrent(carol));
        assertEq(hub.custodyEpoch(id), 1);
        assertTrue(hub.statusOf(id) == Status.Active);
        assertEq(hub.ownerOf(id), alice);

        // the hub never receives, and neither hand may receive an Intact: refused before any callback
        uint256 id2 = mintTo(alice);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
        hub.safeTransferFrom(alice, address(hub), id2);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.CanonicalAccount.selector);
        hub.safeTransferFrom(alice, r, id2);

        // receiving an Intact by safe transfer is custody of that token and of nothing else
        CodeHolder h = new CodeHolder();
        vm.prank(alice);
        hub.safeTransferFrom(alice, address(h), id2);
        assertEq(bitsOf(id2, address(h)), Rights.R_HOLD);
        assertEq(bitsOf(id, address(h)), 0);
        assertEq(bitsOf(id2, alice), 0);
    }

    function test_theWalletProvesControlByAccepting() public {
        uint256 id = mintTo(alice);
        assertEq(hub.agentWalletOf(id), hub.account(id), "unbound: the Reach is the agent wallet");
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.proposeAgentWallet(id, wallet);
        vm.prank(alice);
        hub.proposeAgentWallet(id, wallet);
        assertEq(hub.agentWalletOf(id), hub.account(id), "a proposal binds nothing");
        Core memory c = hub.coreOf(id);
        assertEq(c.proposedWallet, wallet);
        assertEq(c.agentWallet, address(0));

        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotWallet.selector);
        hub.acceptAgentWallet(id);
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.NotWallet.selector);
        hub.acceptAgentWallet(id);                            // not even the holder: the WALLET proves control
        vm.prank(wallet);
        hub.acceptAgentWallet(id);
        assertEq(hub.agentWalletOf(id), wallet);
        c = hub.coreOf(id);
        assertEq(c.proposedWallet, address(0));
        vm.prank(wallet);
        vm.expectRevert(IIntactEvents.NotWallet.selector);
        hub.acceptAgentWallet(id);                            // once
        assertEq(bitsOf(id, wallet), 0, "the wallet is an identity, not a right");

        // proposing nobody withdraws and unbinds
        vm.prank(alice);
        hub.proposeAgentWallet(id, address(0));
        assertEq(hub.agentWalletOf(id), hub.account(id));

        // a sale clears a bound wallet and a pending proposal alike
        vm.prank(alice);
        hub.proposeAgentWallet(id, wallet);
        vm.prank(wallet);
        hub.acceptAgentWallet(id);
        vm.prank(alice);
        hub.proposeAgentWallet(id, carol);
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        c = hub.coreOf(id);
        assertEq(c.agentWallet, address(0));
        assertEq(c.proposedWallet, address(0));
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotWallet.selector);
        hub.acceptAgentWallet(id);
    }

    function test_feeSinkFollowsTheBitAndTheToken() public {
        uint256 id = mintTo(alice);
        assertEq(hub.feeSink(id), hub.account(id));
        vm.prank(carol);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setFeesToGrip(id, true);
        vm.prank(alice);
        hub.setFeesToGrip(id, true);
        assertEq(hub.feeSink(id), hub.grip(id));
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.feeSink(id), hub.account(id), "the bit is the seller's choice and dies with the sale");
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        hub.feeSink(id + 1);
        // the two words, and the Reach as an actor
        assertTrue(hub.acts(id, hub.account(id)));
        assertFalse(hub.holds(id, hub.account(id)));
        assertFalse(hub.acts(id, address(0)));
        (uint16 bits, uint64 epoch, address holder) = hub.rightsOf(id, address(0));
        assertEq(bits, 0);
        assertEq(epoch, 2);
        assertEq(holder, bob);
    }
}
