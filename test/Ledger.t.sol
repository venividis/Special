// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ReachFixture} from "./Reach.t.sol";
import {Reach} from "../src/Reach.sol";
import {IReachEvents, OpenApproval} from "../src/interfaces/IReach.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC721} from "./mocks/MockERC721.sol";
import {Permit2ish} from "./mocks/Permit2ish.sol";
import {HostileToken} from "./mocks/HostileToken.sol";
import {OffsetBombToken} from "./mocks/Nasty.sol";

/*  DESIGN.md §9.1 — the open-approval ledger. Measurement sees what left;
    this sees what MAY leave, and lets the holder take it all back in one
    call that no foreign token can block.                                 */
contract LedgerTest is ReachFixture {
    function test_permit2ApproveIsRecorded() public {
        (, Reach r) = _mint(alice);
        Permit2ish permit2 = new Permit2ish();
        bytes4 approve4 = bytes4(keccak256("approve(address,address,uint160,uint48)"));
        assertEq(r.openApprovalsRoot(), bytes32(0));

        _exec(r, alice, address(permit2), 0, abi.encodeWithSelector(approve4, address(gold), bob, uint160(100), uint48(0)));
        OpenApproval[] memory list = r.openApprovals();
        assertEq(list.length, 1);
        assertEq(list[0].asset, address(gold), "the token Permit2 was told about, not Permit2");
        assertEq(list[0].spender, bob);
        bytes32 root1 = r.openApprovalsRoot();
        assertTrue(root1 != bytes32(0), "the root moves with the ledger");

        // every shape: approve, setApprovalForAll, and the same pair twice is one entry
        _exec(r, alice, address(gold), 0, _approve(bob, 5));
        _exec(r, alice, address(gold), 0, _approve(bob, 7));
        MockERC721 punk = new MockERC721();
        _exec(r, alice, address(punk), 0, abi.encodeWithSelector(APPROVE_ALL, bob, true));
        assertEq(r.openApprovals().length, 3);
        assertTrue(r.openApprovalsRoot() != root1);

        // the revoking shapes prune rather than grow
        _exec(r, alice, address(punk), 0, abi.encodeWithSelector(APPROVE_ALL, bob, false));
        assertEq(r.openApprovals().length, 2);
        _exec(r, alice, address(gold), 0, _approve(bob, 0));
        assertEq(r.openApprovals().length, 1);
        assertEq(r.openApprovalsRoot(), root1, "the same ledger is the same root");

        // one click
        _exec(r, alice, address(gold), 0, _approve(bob, 9));
        vm.prank(alice);
        r.revokeOpenApprovals();
        assertEq(permit2.allowance(address(r), bob), 0, "Permit2's own allowance was zeroed through it");
        assertEq(gold.allowance(address(r), bob), 0);
        assertEq(r.openApprovals().length, 0);
        assertEq(r.openApprovalsRoot(), bytes32(0));
    }

    function test_aRevertingAssetDoesNotBlockRevokeAll() public {
        (, Reach r) = _mint(alice);
        HostileToken hostile = new HostileToken();
        _exec(r, alice, address(hostile), 0, _approve(bob, 1));
        _exec(r, alice, address(gold), 0, _approve(bob, 1));
        _exec(r, alice, address(silver), 0, _approve(bob, 1));
        assertEq(r.openApprovals().length, 3);

        hostile.setMode(1);                     // approve reverts
        vm.prank(alice);
        r.revokeOpenApprovals();
        OpenApproval[] memory left = r.openApprovals();
        assertEq(left.length, 1, "every entry a token would let go of is gone");
        assertEq(left[0].asset, address(hostile), "the one that refused is still named");
        assertEq(gold.allowance(address(r), bob), 0);
        assertEq(silver.allowance(address(r), bob), 0);

        hostile.setMode(6);                     // burns all gas it is given
        vm.prank(alice);
        r.revokeOpenApprovals();
        assertEq(r.openApprovals().length, 1, "a gas burner is capped, not obeyed");

        hostile.setMode(0);
        vm.prank(alice);
        r.revokeOpenApprovals();
        assertEq(r.openApprovals().length, 0, "and once it answers, it is cleared");
        assertEq(hostile.allowance(address(r), bob), 0);
    }

    function test_theLedgerIsBounded() public {
        (, Reach r) = _mint(alice);
        for (uint256 i = 1; i <= 32; ++i) {
            _exec(r, alice, address(gold), 0, _approve(address(uint160(i)), 1));
        }
        assertEq(r.openApprovals().length, 32);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.LedgerFull.selector);
        r.execute(address(gold), 0, _approve(address(33), 1), 0);
        // room is made by revoking, not by forgetting
        vm.prank(alice);
        r.revokeOpenApprovals();
        assertEq(r.openApprovals().length, 0);
        _exec(r, alice, address(gold), 0, _approve(address(33), 1));
        assertEq(r.openApprovals().length, 1);
    }

    function test_onlyTheHolderTheGuardianOrTheHubRevokes() public {
        (uint256 id, Reach r) = _mint(alice);
        _exec(r, alice, address(gold), 0, _approve(bob, 1));
        vm.prank(bob);
        vm.expectRevert(IReachEvents.NotSignerOrGuardian.selector);
        r.revokeOpenApprovals();
        vm.prank(alice);
        hub.setGuardian(id, guardian);
        vm.prank(guardian);
        r.revokeOpenApprovals();
        assertEq(gold.allowance(address(r), bob), 0);
        _exec(r, alice, address(gold), 0, _approve(bob, 1));
        vm.prank(address(hub));
        r.revokeOpenApprovals();
        assertEq(gold.allowance(address(r), bob), 0);
    }

    function test_aSealedAccountRecordsNoApprovalOnAPromisedAsset() public {
        (, Reach r) = _mint(alice);
        _guard(r, alice, address(gold));
        _seal(r, alice, T0 + 30 days);
        vm.prank(alice);
        vm.expectRevert(IReachEvents.NotSafeWhileSealed.selector);
        r.execute(address(gold), 0, _approve(bob, 1), 0);
        assertEq(r.openApprovals().length, 0);
        // an unpromised asset may still be approved, and that IS recorded —
        // the buyer reads the ledger beside the manifest
        _exec(r, alice, address(silver), 0, _approve(bob, 1));
        assertEq(r.openApprovals().length, 1);
        assertEq(r.openApprovals()[0].asset, address(silver));
        // a permit for someone else's tokens records nothing of ours; one for
        // ours does (the target answers anything, so only the ledger decides)
        OffsetBombToken any = new OffsetBombToken(32);
        _exec(r, alice, address(any), 0, abi.encodeWithSelector(0xd505accf, bob, alice, uint256(1), uint256(0), uint8(0), bytes32(0), bytes32(0)));
        assertEq(r.openApprovals().length, 1);
        _exec(r, alice, address(any), 0, abi.encodeWithSelector(0xd505accf, address(r), bob, uint256(1), uint256(0), uint8(0), bytes32(0), bytes32(0)));
        assertEq(r.openApprovals().length, 2);
        assertEq(r.openApprovals()[1].spender, bob);
    }
}
