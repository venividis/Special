// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {MockReachImpl} from "./helpers/HubMocks.sol";
import {IIntact, IIntactEvents, Status, Traits, Core} from "../src/interfaces/IIntact.sol";
import {IntactConfig} from "../src/hub/IntactBase.sol";

/*  DESIGN.md §14 A4: `Core` is append-only and the ERC-5646 fingerprint
    moves for every field — one mutation per field, and for every input
    outside `Core` the hash reaches into. */
contract FingerprintTest is IntactFixture {
    address renter = address(0x2E);
    address wallet = address(0x3A11E7);

    function setUp() public { setUpWorld(); }

    function _moved(uint256 id, bytes32 prev, string memory what) internal view returns (bytes32 now_) {
        now_ = hub.getStateFingerprint(id);
        assertTrue(now_ != prev, what);
        assertEq(hub.getTraitValue(id, Traits.FINGERPRINT), now_, "the trait mirrors the hash");
    }

    function test_everyFieldMovesTheFingerprint() public {
        uint256 id = mintTo(alice);
        bytes32 fp = hub.getStateFingerprint(id);
        assertTrue(fp != bytes32(0));
        assertEq(hub.getStateFingerprint(id), fp, "a pure function of state");
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        hub.getStateFingerprint(id + 1);

        /*  Core, field by field, in declaration order. `createdAt` is
            written once at mint and has no setter; `launchCount` has no
            writer in the hub at all in v1 (the field is reserved in the
            normative layout). Every other field moves below.          */
        vm.prank(alice); hub.setStatus(id, Status.Paused);                     fp = _moved(id, fp, "status");
        vm.prank(alice); hub.pinTokenURI(id, 2);                                fp = _moved(id, fp, "pinnedFace");
        vm.prank(market); hub.moduleLock(id);                                   fp = _moved(id, fp, "lockCount");
        vm.prank(alice); hub.sealTransfer(id, T0 + 10 days);                    fp = _moved(id, fp, "transferSealUntil");
        vm.prank(alice); hub.setGuardian(id, guardian);                         fp = _moved(id, fp, "guardian");
        vm.prank(alice); hub.setFeesToGrip(id, true);                           fp = _moved(id, fp, "feesToGrip");
        vm.prank(alice); hub.setUser(id, renter, T0 + 5 days);                  fp = _moved(id, fp, "user, userExpires");
        vm.prank(alice); hub.proposeAgentWallet(id, wallet);                    fp = _moved(id, fp, "proposedWallet");
        vm.prank(wallet); hub.acceptAgentWallet(id);                            fp = _moved(id, fp, "agentWallet");
        vm.prank(alice); hub.setTrait(id, Traits.CURVE, bytes32(uint256(5_000))); fp = _moved(id, fp, "curve");
        vm.prank(alice); hub.setTrait(id, Traits.NAME, bytes32("Intact One"));  fp = _moved(id, fp, "nameHash");

        // the Reach's three contributions
        MockReachImpl reach = reachOf(id);
        reach.bump();                                                           fp = _moved(id, fp, "Reach.state");
        reach.sealMax();                                                        fp = _moved(id, fp, "Reach.sealedUntil");
        reach.setRoot(keccak256("ledger"));                                     fp = _moved(id, fp, "Reach.openApprovalsRoot");

        // the four satellites
        pool.set(id, keccak256("market"), 0);                                   fp = _moved(id, fp, "Pool.marketHash");
        locks.set(address(reach), keccak256("locks"));                          fp = _moved(id, fp, "Locks.commitmentOf(reach)");
        launchpad.set(id, keccak256("launch"));                                 fp = _moved(id, fp, "Launchpad.launchRoot");
        steward.set(id, keccak256("plan"));                                     fp = _moved(id, fp, "Steward.planHash");

        // custodyEpoch and guardianHold (the guardian's panic moves both; release moves the hold back)
        vm.prank(guardian); hub.panic(id);                                      fp = _moved(id, fp, "custodyEpoch, guardianHold");
        assertTrue(hub.coreOf(id).guardianHold);
        vm.prank(alice); hub.release(id);                                       fp = _moved(id, fp, "guardianHold cleared");

        // the holder
        vm.prank(market); hub.moduleUnlock(id);                                 fp = _moved(id, fp, "lockCount back to zero");
        vm.warp(T0 + 10 days + 1);
        vm.prank(alice); hub.transferFrom(alice, bob, id);                      fp = _moved(id, fp, "owner");

        // and something that is deliberately NOT in it: a balance
        vm.deal(address(reach), 5 ether);
        assertEq(hub.getStateFingerprint(id), fp, "an inbound transfer must not break a trade");
    }

    function test_anAbsentSatelliteContributesZeroNotARevert() public {
        IntactConfig memory c = config();
        c.pool = address(0x1001);        // no code at any of these
        c.locks = address(0x1002);
        c.launchpad = address(0x1003);
        c.steward = address(0x1004);
        c.roles = address(0);
        IIntact h = diamondBuild ? deployDiamond(c, PRICE) : deployMonolith(c, PRICE);
        vm.prank(alice);
        uint256 id = h.mint{value: PRICE}(alice);
        bytes32 fp = h.getStateFingerprint(id);
        assertTrue(fp != bytes32(0));
        assertEq(h.getTraitValue(id, Traits.MARKET_SEALED_UNTIL), bytes32(0));
        assertEq(h.getTraitValue(id, Traits.SEALED_UNTIL), bytes32(0));
        assertEq(h.getTraitValue(id, Traits.CUSTODY_EPOCH), bytes32(uint256(1)));
        assertEq(h.userOf(id), address(0));
        assertEq(h.userExpires(id), 0);
        (uint16 bits, , ) = h.rightsOf(id, alice);
        assertEq(bits, 1);
        // and with the satellites present, the market seal is read from the Pool
        uint256 id2 = mintTo(alice);
        pool.set(id2, keccak256("m"), T0 + 99 days);
        assertEq(hub.getTraitValue(id2, Traits.MARKET_SEALED_UNTIL), bytes32(uint256(T0 + 99 days)));
    }

    function test_theNameTraitIsBoundedValidUtf8() public {
        uint256 id = mintTo(alice);
        vm.prank(alice);
        hub.setTrait(id, Traits.NAME, bytes32("Intact One"));
        assertEq(hub.getTraitValue(id, Traits.NAME), bytes32("Intact One"));
        assertEq(hub.coreOf(id).nameHash, keccak256("Intact One"));
        // valid multi-byte UTF-8 passes; a control byte, a lone continuation byte, a surrogate and a smuggled byte do not
        vm.prank(alice);
        hub.setTrait(id, Traits.NAME, bytes32(bytes(unicode"Entier — Ωmega")));
        bytes32[4] memory bad = [
            bytes32(abi.encodePacked("tab\there")),
            bytes32(hex"80"),
            bytes32(hex"eda080"),
            bytes32(abi.encodePacked(bytes("a"), bytes1(0), bytes("b")))
        ];
        for (uint256 i; i < bad.length; ++i) {
            vm.prank(alice);
            vm.expectRevert(IIntactEvents.BadName.selector);
            hub.setTrait(id, Traits.NAME, bad[i]);
        }
        // clearing the name clears its hash
        vm.prank(alice);
        hub.setTrait(id, Traits.NAME, bytes32(0));
        assertEq(hub.coreOf(id).nameHash, bytes32(0));
        assertEq(hub.getTraitValue(id, Traits.NAME), bytes32(0));
        // the batch read agrees with the single read, and an unknown key reads as zero
        bytes32[] memory keys = new bytes32[](3);
        keys[0] = Traits.CURVE; keys[1] = Traits.CUSTODY_EPOCH; keys[2] = keccak256("unknown");
        bytes32[] memory vals = hub.getTraitValues(id, keys);
        assertEq(vals[0], hub.getTraitValue(id, Traits.CURVE));
        assertEq(vals[1], bytes32(uint256(1)));
        assertEq(vals[2], bytes32(0));
    }
}
