// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {MockReachImpl, MockGripImpl, MockRenderer, SlotReader} from "./helpers/HubMocks.sol";
import {IIntact, IIntactEvents, Status, Traits, Core} from "../src/interfaces/IIntact.sol";
import {IDiamond, IDiamondLoupe} from "../src/interfaces/Standards.sol";
import {IntactConfig} from "../src/hub/IntactBase.sol";
import {IntactStorage} from "../src/hub/IntactStorage.sol";
import {IntactDiamond} from "../src/hub/IntactDiamond.sol";
import {CoreFacet} from "../src/hub/facets/CoreFacet.sol";
import {RightsFacet} from "../src/hub/facets/RightsFacet.sol";
import {MintFacet} from "../src/hub/facets/MintFacet.sol";
import {SiteFacet} from "../src/hub/facets/SiteFacet.sol";
import {LibNum} from "../src/lib/LibNum.sol";

/*  DESIGN.md §4.1 "Rules enforced by tests" and §14 A8: the facets
    partition the monolith's ABI, nothing routes `diamondCut`, no facet
    owns a plain slot, the facets agree on one world, a facet alone is
    inert, the fingerprint is the same in both builds, and the diamond
    refuses what the monolith refuses. Both builds are deployed here
    whatever INTACT_IMPL says. */
contract DiamondTest is IntactFixture {
    IIntact mono;
    IIntact dia;
    IDiamondLoupe loupe;
    address[4] facets;
    address renter = address(0x2E);

    function setUp() public {
        setUpWorld();
        IntactConfig memory c = config();
        mono = deployMonolith(c, PRICE);
        facets = [address(new CoreFacet(c)), address(new RightsFacet(c)), address(new MintFacet(c)), address(new SiteFacet(c))];
        dia = IIntact(address(new IntactDiamond(cut(facets[0], facets[1], facets[2], facets[3]), PRICE)));
        loupe = IDiamondLoupe(address(dia));
    }

    function _parts() internal pure returns (bytes4[][4] memory p) {
        p[0] = coreSelectors();
        p[1] = rightsSelectors();
        p[2] = mintSelectors();
        p[3] = siteSelectors();
    }

    function test_partitionsTheMonolithAbiEveryFunctionRoutedOnce() public {
        bytes4[] memory all = allSelectors();
        assertEq(all.length, 93, "IIntact declares 93 functions");
        bytes4[][4] memory parts = _parts();

        // every function of the interface is routed, to the facet the design assigns it
        for (uint256 p; p < 4; ++p) {
            for (uint256 j; j < parts[p].length; ++j) assertEq(loupe.facetAddress(parts[p][j]), facets[p], "routed to the assigned facet");
            assertEq(loupe.facetFunctionSelectors(facets[p]).length, parts[p].length, "facetFunctionSelectors count");
        }
        // once: the loupe's total equals the interface's count and no selector repeats
        IDiamondLoupe.Facet[] memory fs = loupe.facets();
        assertEq(fs.length, 4, "four facets");
        uint256 total;
        for (uint256 i; i < fs.length; ++i) {
            assertEq(fs[i].facetAddress, facets[i], "facets() order");
            total += fs[i].functionSelectors.length;
        }
        assertEq(total, all.length, "routed total equals the interface");
        for (uint256 i; i < all.length; ++i) for (uint256 j; j < i; ++j) assertTrue(all[i] != all[j]);
        address[] memory addrs = loupe.facetAddresses();
        assertEq(addrs.length, 4, "facetAddresses count");

        // and every routed selector is served by real code — through the
        // diamond, by the monolith, and by the assigned facet itself
        for (uint256 i; i < all.length; ++i) {
            assertTrue(served(address(dia), all[i]), "the diamond serves it");
            assertTrue(served(address(mono), all[i]), "the monolith serves it");
        }
        for (uint256 p; p < 4; ++p) {
            for (uint256 j; j < parts[p].length; ++j) assertTrue(served(facets[p], parts[p][j]), "the facet serves what it is routed");
        }
        // a selector the interface does not have is served by nobody
        assertFalse(served(address(dia), 0xdeadbeef));
        assertFalse(served(facets[0], 0xdeadbeef));

        // a duplicate refuses the whole cut
        IDiamond.FacetCut[] memory bad = cut(facets[0], facets[1], facets[2], facets[3]);
        bad[1].functionSelectors[0] = IIntact.ownerOf.selector;
        try new IntactDiamond(bad, PRICE) { revert("a duplicate was accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactDiamond.SelectorAlreadyBound.selector), string.concat("SelectorAlreadyBound, got ", LibNum.hex32(selOf(err)))); }
        // and so does an empty one (the toolchain hands back no data for an
        // empty top-level array argument — the refusal is what matters), a
        // facet with no selectors, a non-addition, and a facet without code
        try new IntactDiamond(new IDiamond.FacetCut[](0), PRICE) { revert("an empty cut was accepted"); }
        catch {}
        IDiamond.FacetCut[] memory one = new IDiamond.FacetCut[](1);
        one[0] = IDiamond.FacetCut(facets[0], IDiamond.FacetCutAction.Add, new bytes4[](0));
        try new IntactDiamond(one, PRICE) { revert("a selector-less facet was accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactDiamond.EmptyFacetCut.selector), string.concat("EmptyFacetCut, got ", LibNum.hex32(selOf(err)))); }
        bad = cut(facets[0], facets[1], facets[2], facets[3]);
        bad[2].action = IDiamond.FacetCutAction.Replace;
        try new IntactDiamond(bad, PRICE) { revert("Replace accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactDiamond.NotAnAddition.selector), string.concat("NotAnAddition, got ", LibNum.hex32(selOf(err)))); }
        bad = cut(facets[0], facets[1], address(0xC0DE1E55), facets[3]);
        try new IntactDiamond(bad, PRICE) { revert("codeless accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactDiamond.FacetHasNoCode.selector), string.concat("FacetHasNoCode, got ", LibNum.hex32(selOf(err)))); }
    }

    function _contains(bytes memory hay, bytes4 needle) internal pure returns (bool) {
        if (hay.length < 4) return false;
        for (uint256 i; i + 4 <= hay.length; ++i) {
            if (hay[i] == needle[0] && hay[i + 1] == needle[1] && hay[i + 2] == needle[2] && hay[i + 3] == needle[3]) return true;
        }
        return false;
    }

    function test_routesNoDiamondCutAnywhere() public {
        bytes4 cutSel = bytes4(keccak256("diamondCut((address,uint8,bytes4[])[],address,bytes)"));
        assertEq(sel32(cutSel), sel32(0x1f931c1c));
        assertEq(loupe.facetAddress(cutSel), address(0));
        // the four bytes appear in no facet's runtime, nor in either hub's
        for (uint256 p; p < 4; ++p) assertFalse(_contains(facets[p].code, cutSel), "a facet carries the selector");
        assertFalse(_contains(address(dia).code, cutSel));
        assertFalse(_contains(address(mono).code, cutSel));
        // the scanner is not blind: it finds the selector where it is
        assertTrue(_contains(abi.encodePacked(hex"6080", cutSel, hex"00"), cutSel));
        // a cut that names it is refused at construction
        IDiamond.FacetCut[] memory bad = cut(facets[0], facets[1], facets[2], facets[3]);
        bad[3].functionSelectors[0] = cutSel;
        try new IntactDiamond(bad, PRICE) { revert("a mutable diamond was accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactDiamond.CutRoutesDiamondCut.selector), string.concat("CutRoutesDiamondCut, got ", LibNum.hex32(selOf(err)))); }
        // and the live diamond refuses it like any unknown selector
        (bool ok, bytes memory ret) = address(dia).call(abi.encodeWithSelector(cutSel));
        assertFalse(ok);
        assertEq(selOf(ret), sel32(IIntactEvents.FunctionNotFound.selector));
    }

    function test_slotsZeroToTwoAreEmpty() public {
        // a TEST diamond with a fifth facet that reads raw slots of whatever delegatecalls it
        SlotReader reader = new SlotReader(IIntact(facets[0]).intactConfigHash());
        IDiamond.FacetCut[] memory four = cut(facets[0], facets[1], facets[2], facets[3]);
        IDiamond.FacetCut[] memory five = new IDiamond.FacetCut[](5);
        for (uint256 i; i < 4; ++i) five[i] = four[i];
        bytes4[] memory sel = new bytes4[](1);
        sel[0] = SlotReader.readSlot.selector;
        five[4] = IDiamond.FacetCut(address(reader), IDiamond.FacetCutAction.Add, sel);
        IIntact d = IIntact(address(new IntactDiamond(five, PRICE)));

        // put it to work so every namespace has something in it
        vm.prank(alice);
        uint256 id = d.mint{value: PRICE}(alice);
        vm.startPrank(alice);
        d.setApprovalForAll(bob, true);
        d.setTrait(id, Traits.NAME, bytes32("slots"));
        d.setUser(id, renter, uint64(T0 + 1 days));
        d.transferFrom(alice, carol, id);
        vm.stopPrank();

        SlotReader r = SlotReader(address(d));
        for (uint256 s; s < 3; ++s) assertEq(r.readSlot(s), bytes32(0), "a compiler-assigned slot is in use");
        // the namespaces are where IntactStorage says: price at core+9, minted at core+8, facet count at diamond+2
        uint256 core = uint256(IntactStorage.CORE_SLOT);
        assertEq(uint256(r.readSlot(core + 9)), PRICE);
        assertEq(uint256(r.readSlot(core + 8)), 1);
        assertEq(uint256(r.readSlot(uint256(IntactStorage.DIAMOND_SLOT) + 2)), 5);
        // and the roots are the ERC-7201 formula
        assertEq(IntactStorage.CORE_SLOT,
            keccak256(abi.encode(uint256(keccak256("intact.storage.core")) - 1)) & ~bytes32(uint256(0xff)));
        assertEq(IntactStorage.DIAMOND_SLOT,
            keccak256(abi.encode(uint256(keccak256("intact.storage.diamond")) - 1)) & ~bytes32(uint256(0xff)));
        assertTrue(IntactStorage.CORE_SLOT != IntactStorage.DIAMOND_SLOT);
        // a reader asked about a token sees the diamond's world, not its own
        assertEq(d.ownerOf(id), carol);
        assertEq(d.custodyEpoch(id), 2);
    }

    function test_refusesAFacetBuiltAgainstAnotherConfiguration() public {
        IntactConfig memory other = config();
        other.gripImpl = address(new MockGripImpl());          // every Grip address would differ
        RightsFacet stranger = new RightsFacet(other);
        assertTrue(IIntact(address(stranger)).intactConfigHash() != IIntact(facets[1]).intactConfigHash());
        IDiamond.FacetCut[] memory cuts = cut(facets[0], address(stranger), facets[2], facets[3]);
        try new IntactDiamond(cuts, PRICE) { revert("a facet from another world was accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactDiamond.FacetConfigMismatch.selector), string.concat("FacetConfigMismatch, got ", LibNum.hex32(selOf(err)))); }

        // a facet that cannot say what it was built against is refused too
        cuts = cut(facets[0], facets[1], facets[2], address(new MockRenderer()));
        try new IntactDiamond(cuts, PRICE) { revert("an unconfigured facet was accepted"); }
        catch (bytes memory err) { assertEq(selOf(err), sel32(IntactDiamond.NoConfiguredFacet.selector), string.concat("NoConfiguredFacet, got ", LibNum.hex32(selOf(err)))); }

        // the four honest facets agree with each other and with the monolith
        bytes32 h = mono.intactConfigHash();
        for (uint256 p; p < 4; ++p) assertEq(IIntact(facets[p]).intactConfigHash(), h);
        assertEq(dia.intactConfigHash(), h);
        assertEq(dia.REACH_IMPL(), mono.REACH_IMPL());
        assertEq(dia.account(1), mono.account(1) == dia.account(1) ? mono.account(1) : dia.account(1));
        assertTrue(dia.account(1) != mono.account(1), "the collection is part of the derivation");
    }

    function test_everyFacetIsInertWhenCalledDirectly() public {
        vm.prank(alice);
        uint256 id = dia.mint{value: PRICE}(alice);
        bytes32 before = dia.getStateFingerprint(id);
        uint256 mintedBefore = dia.minted();

        // writes aimed at a facet land in the facet's own storage, which no diamond reads
        IIntact m = IIntact(facets[2]);
        vm.prank(bob);
        uint256 own = m.mint{value: 0}(bob);                    // its own price is zero; its own counter moves
        assertEq(own, LO);
        assertEq(m.minted(), 1);
        assertEq(dia.minted(), mintedBefore);
        assertEq(dia.ownerOf(id), alice);
        IIntact core = IIntact(facets[0]);
        vm.prank(alice);
        core.setApprovalForAll(bob, true);
        assertTrue(core.isApprovedForAll(alice, bob));
        assertFalse(dia.isApprovedForAll(alice, bob), "nothing done to a facet reaches the diamond");

        // reads aimed at a facet see nothing of the diamond's world
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        core.ownerOf(id);
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        IIntact(facets[1]).rightsOf(id, alice);
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        IIntact(facets[3]).getStateFingerprint(id);
        assertEq(dia.getStateFingerprint(id), before);

        // the loupe is the diamond's own immutable code, not a routed facet
        assertEq(loupe.facetAddress(IDiamondLoupe.facets.selector), address(0));
    }

    function test_theFingerprintIsIdenticalAcrossBuilds() public {
        IIntact[2] memory builds = [mono, dia];
        bytes32[2] memory fps;
        for (uint256 b; b < 2; ++b) {
            IIntact h = builds[b];
            vm.prank(alice);
            uint256 id = h.mint{value: PRICE}(alice);
            assertEq(id, LO);
            vm.startPrank(alice);
            h.setTrait(id, Traits.CURVE, bytes32(uint256(1234)));
            h.setTrait(id, Traits.NAME, bytes32("Intact One"));
            h.setGuardian(id, guardian);
            h.sealTransfer(id, uint64(T0 + 7 days));
            h.setUser(id, renter, uint64(T0 + 3 days));
            h.pinTokenURI(id, 1);
            vm.stopPrank();
            MockReachImpl(payable(h.account(id))).bump();
            MockReachImpl(payable(h.account(id))).setRoot(keccak256("ledger"));
            locks.set(h.account(id), keccak256("locks"));
            fps[b] = h.getStateFingerprint(id);
        }
        pool.set(LO, keccak256("market"), uint64(T0 + 9 days));
        launchpad.set(LO, keccak256("launch"));
        steward.set(LO, keccak256("plan"));
        assertEq(mono.getStateFingerprint(LO), dia.getStateFingerprint(LO), "byte-identical across builds");
        assertEq(fps[0], fps[1]);
        // they diverge together: one more move on one side only
        vm.prank(alice);
        mono.setTrait(LO, Traits.CURVE, bytes32(uint256(1235)));
        assertTrue(mono.getStateFingerprint(LO) != dia.getStateFingerprint(LO));
        vm.prank(alice);
        dia.setTrait(LO, Traits.CURVE, bytes32(uint256(1235)));
        assertEq(mono.getStateFingerprint(LO), dia.getStateFingerprint(LO));
        // the whole public word and the string surface read the same too
        assertEq(keccak256(abi.encode(mono.coreOf(LO))), keccak256(abi.encode(dia.coreOf(LO))));
        assertEq(mono.tokenURI(LO), dia.tokenURI(LO));
        assertEq(mono.scriptURI()[0], dia.scriptURI()[0]);
        assertEq(mono.getTraitValue(LO, Traits.MARKET_SEALED_UNTIL), dia.getTraitValue(LO, Traits.MARKET_SEALED_UNTIL));
        assertEq(mono.contractURI(), dia.contractURI());
        assertTrue(mono.supportsInterface(0x80ac58cd) && dia.supportsInterface(0x80ac58cd));
    }

    function test_rejectsAnUnknownSelectorAndBareEth() public {
        (bool ok, bytes memory ret) = address(dia).call(hex"deadbeef");
        assertFalse(ok);
        assertEq(keccak256(ret), keccak256(abi.encodeWithSelector(IIntactEvents.FunctionNotFound.selector, bytes4(0xdeadbeef))));
        (ok, ret) = address(dia).call{value: 1 ether}("");
        assertFalse(ok, "bare ether is selector 0x00000000, bound to nothing");
        assertEq(selOf(ret), sel32(IIntactEvents.FunctionNotFound.selector));
        assertEq(address(dia).balance, 0);
        // exactly as the monolith, which has no receive
        (ok, ) = address(mono).call{value: 1 ether}("");
        assertFalse(ok);
        (ok, ) = address(mono).call(hex"deadbeef");
        assertFalse(ok);
        assertEq(address(mono).balance, 0);
        // value reaches a payable routed function and nothing else
        vm.prank(alice);
        dia.mint{value: PRICE}(alice);
        assertEq(address(dia).balance, PRICE);
        (ok, ) = address(dia).call{value: 1}(abi.encodeCall(IIntact.ownerOf, (LO)));
        assertFalse(ok, "value on a non-payable routed function is refused by the facet");
        assertEq(address(dia).balance, PRICE);
    }
}
