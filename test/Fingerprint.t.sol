// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture, NonceProbe} from "./helpers/Deploy.sol";
import {MockReachImpl} from "./helpers/HubMocks.sol";
import {IIntact, IIntactEvents, Status, Traits, Core} from "../src/interfaces/IIntact.sol";
import {IntactConfig} from "../src/hub/IntactBase.sol";
import {Keepsake} from "../src/Keepsake.sol";
import {KeepsakeArt} from "../src/KeepsakeArt.sol";
import {Journal} from "../src/Journal.sol";
import {Asset, Schedule, DripTerms, Wrap} from "../src/interfaces/IKeepsake.sol";

/*  DESIGN.md §14 A4: `Core` is append-only and the ERC-5646 fingerprint
    moves for every field — one mutation per field, and for every input
    outside `Core` the hash reaches into.

    V2 (wave 2, W6): the fingerprint gains two terms, appended after the
    steward's plan — the Keepsake's commitment of the Reach and the
    Journal's root for the token — shown moving with a REAL Keepsake and a
    REAL Journal, each deployed at the CREATE address the hub's config
    named before it existed. And `residueOf`: every term a sale does not
    move, proved both ways — each of its terms moves it (and it is keccak
    of exactly those terms), and a sale moves none of them, nor is
    anything a sale moves or voids in it. */
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

    /*═══════════════════ V2: the two new terms, and the residue ═══════════════════*/

    error NoNonce();

    /// @dev This contract's next CREATE nonce, found by deploying a probe
    ///      (the runner installs the suite at nonce 0; BundleFixture's rule).
    function _nonce() internal returns (uint256 n) {
        address probe = address(new NonceProbe());
        for (n = 0; n < 1 << 16; ++n) if (_created(address(this), n) == probe) return n + 1;
        revert NoNonce();
    }

    /// @dev keccak256(rlp([d, nonce]))[12:], for nonces under 2^16.
    function _created(address d, uint256 nonce) internal pure returns (address) {
        bytes memory rlp;
        if (nonce == 0) rlp = abi.encodePacked(bytes1(0xd6), bytes1(0x94), d, bytes1(0x80));
        else if (nonce <= 0x7f) rlp = abi.encodePacked(bytes1(0xd6), bytes1(0x94), d, uint8(nonce));
        else if (nonce <= 0xff) rlp = abi.encodePacked(bytes1(0xd7), bytes1(0x94), d, bytes1(0x81), uint8(nonce));
        else rlp = abi.encodePacked(bytes1(0xd8), bytes1(0x94), d, bytes1(0x82), uint16(nonce));
        return address(uint160(uint256(keccak256(rlp))));
    }

    /// @dev A hub, in the build INTACT_IMPL names, pinned to a real Keepsake
    ///      and a real Journal: both addresses predicted before the hub is
    ///      built, both asserted after they land.
    function _v2Hub() internal returns (IIntact h, Keepsake k, Journal j) {
        uint256 at = _nonce() + (diamondBuild ? 4 : 0);             // the diamond lands after its four facets
        IntactConfig memory c = config();
        c.keepsake = _created(address(this), at + 2);                // after the hub and the KeepsakeArt
        c.journal = _created(address(this), at + 3);
        h = diamondBuild ? deployDiamond(c, PRICE) : deployMonolith(c, PRICE);
        KeepsakeArt art = new KeepsakeArt();
        k = new Keepsake(address(h), address(pool), address(art));
        j = new Journal(address(h));
        assertEq(address(h), _created(address(this), at), "the hub landed where it was predicted");
        assertEq(h.KEEPSAKE(), address(k), "the hub pins the Keepsake that landed at its prediction");
        assertEq(h.JOURNAL(), address(j), "the hub pins the Journal that landed at its prediction");
        vm.deal(address(this), 10 ether);
    }

    /// @dev One ether wrapped for `to`, freeing in thirty days.
    function _gift(address to) internal view returns (Wrap memory w) {
        Asset[] memory a = new Asset[](1);
        a[0] = Asset(address(0), 1 ether);
        w = Wrap({assets: a, schedule: Schedule(0, 0, uint64(block.timestamp + 30 days)), to: to,
                  message: "for the token", drip: DripTerms(0, 0, 0, 0)});
    }

    function _movedOn(IIntact h, uint256 id, bytes32 prev, string memory what) internal view returns (bytes32 now_) {
        now_ = h.getStateFingerprint(id);
        assertTrue(now_ != prev, what);
        assertEq(h.getTraitValue(id, Traits.FINGERPRINT), now_, "the trait mirrors the hash");
    }

    /// @dev The residue recomputed from the public reads, term by term, in
    ///      residueOf's order: Core's six, then the eight satellite words.
    function _residueByFormula(IIntact h, Keepsake k, Journal j, uint256 id) internal view returns (bytes32) {
        Core memory c = h.coreOf(id);
        MockReachImpl r = MockReachImpl(payable(h.account(id)));
        return keccak256(bytes.concat(
            abi.encode(c.lockCount, c.transferSealUntil, c.createdAt, c.launchCount, c.curve, c.nameHash),
            abi.encode(bytes32(r.state()), bytes32(uint256(r.sealedUntil())), r.openApprovalsRoot(),
                       pool.marketHash(id), locks.commitmentOf(address(r)), launchpad.launchRoot(id),
                       k.commitmentOf(address(r)), j.rootOf(address(h), id))
        ));
    }

    /// @dev The fingerprint moved and the residue did not.
    function _fingerprintOnly(IIntact h, uint256 id, bytes32 r, bytes32 prev, string memory what)
        internal view returns (bytes32 now_)
    {
        now_ = h.getStateFingerprint(id);
        assertTrue(now_ != prev, string.concat(what, ": the fingerprint moved"));
        assertEq(h.residueOf(id), r, what);
    }

    function _residueMoved(IIntact h, Keepsake k, Journal j, uint256 id, bytes32 prev, string memory what)
        internal view returns (bytes32 now_)
    {
        now_ = h.residueOf(id);
        assertTrue(now_ != prev, what);
        assertEq(now_, _residueByFormula(h, k, j, id), "the residue is keccak of its fourteen terms");
    }

    function test_theKeepsakeAndTheJournalMoveTheFingerprint() public {
        (IIntact h, Keepsake k, Journal j) = _v2Hub();
        vm.prank(alice);
        uint256 id = h.mint{value: PRICE}(alice);
        MockReachImpl reach = MockReachImpl(payable(h.account(id)));
        bytes32 fp = h.getStateFingerprint(id);

        // a keepsake given to the Reach moves nothing: a gift cannot break a listing
        uint256 kid = k.wrap{value: 1 ether}(_gift(address(reach)));
        assertEq(k.ownerOf(kid), address(reach), "the keepsake is the Reach's");
        assertEq(h.getStateFingerprint(id), fp, "a keepsake given to the Reach does not move the fingerprint");

        // the Reach gives it away: the Keepsake's commitment of the Reach moves the fingerprint
        reach.act(address(k), abi.encodeCall(k.transferFrom, (address(reach), bob, kid)));
        assertEq(k.ownerOf(kid), bob, "the keepsake left the Reach");
        fp = _movedOn(h, id, fp, "Keepsake.commitmentOf(reach): a keepsake transferred out of the Reach");

        // a memory: the Journal's root for the token moves it, by the holder or by the Reach
        vm.prank(alice);
        j.inscribe(address(h), id, 0, "the day it was minted", bytes32(0));
        assertEq(j.countOf(address(h), id), 1, "the memory is the token's first");
        fp = _movedOn(h, id, fp, "Journal.rootOf(hub, id): a memory inscribed by the holder");
        reach.act(address(j), abi.encodeCall(j.inscribe, (address(h), id, 3, "a milestone", bytes32(0))));
        fp = _movedOn(h, id, fp, "Journal.rootOf(hub, id): a memory the token's Reach inscribed");

        // what a stranger can do moves neither term: a second gift, and its claim paying the Reach
        uint256 kid2 = k.wrap{value: 1 ether}(_gift(address(reach)));
        vm.warp(block.timestamp + 31 days);
        uint256 before = address(reach).balance;
        vm.prank(carol);
        k.claim(kid2);
        assertEq(address(reach).balance - before, 1 ether, "a stranger's claim pays the Reach");
        assertEq(h.getStateFingerprint(id), fp, "a gift to the Reach and a stranger's claim move nothing");
    }

    function test_theV2TermsOfAnAbsentKeepsakeAndJournalAreZeroNotARevert() public {
        // the fixture's hub pins a codeless Keepsake and Journal: both hashes read, and stand still
        uint256 id = mintTo(alice);
        assertTrue(hub.KEEPSAKE().code.length == 0 && hub.JOURNAL().code.length == 0, "both pins are codeless here");
        bytes32 fp = hub.getStateFingerprint(id);
        bytes32 r = hub.residueOf(id);
        assertTrue(fp != bytes32(0) && r != bytes32(0), "both hashes read with the two satellites absent");
        assertEq(hub.residueOf(id), r, "and the residue is a pure function of state");
    }

    function test_everyTermOfTheResidueMovesIt() public {
        (IIntact h, Keepsake k, Journal j) = _v2Hub();
        vm.prank(alice);
        uint256 id = h.mint{value: PRICE}(alice);
        MockReachImpl reach = MockReachImpl(payable(h.account(id)));
        bytes32 r = h.residueOf(id);
        assertEq(r, _residueByFormula(h, k, j, id), "residueOf is keccak of its fourteen terms, createdAt and launchCount among them");
        assertTrue(h.coreOf(id).createdAt != 0, "the creation time it hashes is the mint's");
        vm.expectRevert(IIntactEvents.NoSuchToken.selector);
        h.residueOf(id + 1);

        /*  Core's four movable terms. `createdAt` is written once at mint and
            `launchCount` has no writer in the hub: the formula above holds
            them, as the fingerprint's test says of the same two fields.   */
        vm.prank(market); h.moduleLock(id);                                         r = _residueMoved(h, k, j, id, r, "lockCount");
        vm.prank(market); h.moduleUnlock(id);                                       r = _residueMoved(h, k, j, id, r, "lockCount back to zero");
        vm.prank(alice); h.sealTransfer(id, T0 + 10 days);                          r = _residueMoved(h, k, j, id, r, "transferSealUntil");
        vm.prank(alice); h.setTrait(id, Traits.CURVE, bytes32(uint256(5_000)));     r = _residueMoved(h, k, j, id, r, "curve");
        vm.prank(alice); h.setTrait(id, Traits.NAME, bytes32("Intact One"));        r = _residueMoved(h, k, j, id, r, "nameHash");

        // the Reach's three
        reach.bump();                                                               r = _residueMoved(h, k, j, id, r, "Reach.state");
        reach.sealMax();                                                            r = _residueMoved(h, k, j, id, r, "Reach.sealedUntil");
        reach.setRoot(keccak256("ledger"));                                         r = _residueMoved(h, k, j, id, r, "Reach.openApprovalsRoot");

        // the market, the locks, the launches
        pool.set(id, keccak256("market"), 0);                                       r = _residueMoved(h, k, j, id, r, "Pool.marketHash");
        locks.set(address(reach), keccak256("locks"));                              r = _residueMoved(h, k, j, id, r, "Locks.commitmentOf(reach)");
        launchpad.set(id, keccak256("launch"));                                     r = _residueMoved(h, k, j, id, r, "Launchpad.launchRoot");

        // V2's two, through the real contracts
        uint256 kid = k.wrap{value: 1 ether}(_gift(address(reach)));
        assertEq(h.residueOf(id), r, "a keepsake given to the Reach moves no term of the residue");
        reach.act(address(k), abi.encodeCall(k.transferFrom, (address(reach), bob, kid)));
        r = _residueMoved(h, k, j, id, r, "Keepsake.commitmentOf(reach)");
        vm.prank(alice); j.inscribe(address(h), id, 0, "a memory", bytes32(0));
        r = _residueMoved(h, k, j, id, r, "Journal.rootOf(hub, id)");
    }

    function test_aSaleMovesNoTermOfTheResidue() public {
        (IIntact h, Keepsake k, Journal j) = _v2Hub();
        vm.prank(alice);
        uint256 id = h.mint{value: PRICE}(alice);
        MockReachImpl reach = MockReachImpl(payable(h.account(id)));

        // every term set to something other than its default before the sale
        vm.startPrank(alice);
        h.sealTransfer(id, T0 + 10 days);
        h.setTrait(id, Traits.CURVE, bytes32(uint256(5_000)));
        h.setTrait(id, Traits.NAME, bytes32("Intact One"));
        vm.stopPrank();
        reach.bump();
        reach.sealMax();
        reach.setRoot(keccak256("ledger"));
        pool.set(id, keccak256("market"), 0);
        locks.set(address(reach), keccak256("locks"));
        launchpad.set(id, keccak256("launch"));
        uint256 kid = k.wrap{value: 1 ether}(_gift(address(reach)));
        reach.act(address(k), abi.encodeCall(k.transferFrom, (address(reach), bob, kid)));
        vm.prank(alice);
        j.inscribe(address(h), id, 0, "before the sale", bytes32(0));
        bytes32 r = h.residueOf(id);
        bytes32 fp = h.getStateFingerprint(id);

        // what a sale moves or voids is not in it: each moves the fingerprint and leaves the residue
        vm.prank(alice); h.setStatus(id, Status.Paused);        fp = _fingerprintOnly(h, id, r, fp, "the status is not in the residue");
        vm.prank(alice); h.pinTokenURI(id, 2);                  fp = _fingerprintOnly(h, id, r, fp, "nor the pinned face");
        vm.prank(alice); h.setGuardian(id, guardian);           fp = _fingerprintOnly(h, id, r, fp, "nor the guardian");
        vm.prank(alice); h.setFeesToGrip(id, true);             fp = _fingerprintOnly(h, id, r, fp, "nor feesToGrip");
        vm.prank(alice); h.setUser(id, renter, T0 + 5 days);    fp = _fingerprintOnly(h, id, r, fp, "nor the user");
        vm.prank(alice); h.proposeAgentWallet(id, wallet);      fp = _fingerprintOnly(h, id, r, fp, "nor the proposed agent wallet");
        vm.prank(wallet); h.acceptAgentWallet(id);              fp = _fingerprintOnly(h, id, r, fp, "nor the agent wallet");
        steward.set(id, keccak256("plan"));                     fp = _fingerprintOnly(h, id, r, fp, "nor the steward's plan");

        // the sale
        vm.warp(T0 + 10 days + 1);
        vm.prank(alice);
        h.transferFrom(alice, bob, id);
        assertEq(h.ownerOf(id), bob, "the token is the buyer's");
        assertTrue(h.getStateFingerprint(id) != fp, "the sale moved the fingerprint");
        assertEq(h.residueOf(id), r, "a sale moves no term of the residue");
        assertEq(r, _residueByFormula(h, k, j, id), "every one of its fourteen terms reads as it did before the sale");
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
