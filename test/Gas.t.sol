// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {IIntact, Status, Traits} from "../src/interfaces/IIntact.sol";
import {IntactConfig} from "../src/hub/IntactBase.sol";
import {LibNum} from "../src/lib/LibNum.sol";

/*  What the diamond actually costs, and what a mint costs — measured, and
    failed on drift (DESIGN.md §4.1, §4.3; ANIMA test/Gas.test.ts:25-27).

    The README will claim the price of removing EIP-170's ceiling is "one
    DELEGATECALL". A claim about gas nobody measured is a guess. This
    measures every probed call on both builds in one world, in one order
    (so warm and cold states match), and bounds the diamond's excess at
    25 % relative or 6,000 gas absolute — the latter because a cold facet
    address (2,600) plus a cold routing slot (2,100) is a large fraction of
    a cheap view and a small one of a write.

    The harness's console is a no-op; INTACT_GAS_REPORT=1 makes the two
    tests revert with their measurements so the numbers can be read. */
contract GasTest is IntactFixture {
    IIntact mono;
    IIntact dia;

    function setUp() public {
        setUpWorld();
        IntactConfig memory c = config();
        mono = deployMonolith(c, PRICE);
        dia = deployDiamond(c, PRICE);
    }

    function _gas(IIntact h, address from, bytes memory data, uint256 value) internal returns (uint256 used) {
        vm.prank(from);
        uint256 g0 = gasleft();
        (bool ok, bytes memory ret) = address(h).call{value: value}(data);
        used = g0 - gasleft();
        if (!ok) assembly { revert(add(ret, 32), mload(ret)) }
    }

    function _report(string memory text) internal view {
        if (keccak256(bytes(vm.envOr("INTACT_GAS_REPORT", ""))) == keccak256("1")) revert(text);
    }

    function test_theDiamondOverheadIsBounded() public {
        IIntact[2] memory hs = [mono, dia];
        for (uint256 b; b < 2; ++b) {
            vm.prank(alice);
            hs[b].mint{value: PRICE}(alice);
            vm.prank(alice);
            hs[b].setGuardian(LO, guardian);
        }

        uint256 n = 21;
        string[] memory names = new string[](n);
        bytes[] memory calls = new bytes[](n);
        address[] memory froms = new address[](n);
        uint256[] memory values = new uint256[](n);
        uint256 i;
        // the hot path every marketplace touches
        names[i] = "ownerOf";              calls[i] = abi.encodeCall(IIntact.ownerOf, (LO));                       froms[i++] = alice;
        names[i] = "balanceOf";            calls[i] = abi.encodeCall(IIntact.balanceOf, (alice));                  froms[i++] = alice;
        names[i] = "supportsInterface";    calls[i] = abi.encodeCall(IIntact.supportsInterface, (0x80ac58cd));     froms[i++] = alice;
        names[i] = "locked";               calls[i] = abi.encodeCall(IIntact.locked, (LO));                        froms[i++] = alice;
        names[i] = "isApprovedForAll";     calls[i] = abi.encodeCall(IIntact.isApprovedForAll, (alice, bob));      froms[i++] = alice;
        names[i] = "tokenURI";             calls[i] = abi.encodeCall(IIntact.tokenURI, (LO));                      froms[i++] = alice;
        // the reads an integrator makes before buying or hiring
        names[i] = "statusOf";             calls[i] = abi.encodeCall(IIntact.statusOf, (LO));                      froms[i++] = alice;
        names[i] = "account";              calls[i] = abi.encodeCall(IIntact.account, (LO));                       froms[i++] = alice;
        names[i] = "custodyEpoch";         calls[i] = abi.encodeCall(IIntact.custodyEpoch, (LO));                  froms[i++] = alice;
        names[i] = "feeSink";              calls[i] = abi.encodeCall(IIntact.feeSink, (LO));                       froms[i++] = alice;
        names[i] = "rightsOf";             calls[i] = abi.encodeCall(IIntact.rightsOf, (LO, alice));               froms[i++] = alice;
        names[i] = "getStateFingerprint";  calls[i] = abi.encodeCall(IIntact.getStateFingerprint, (LO));           froms[i++] = alice;
        names[i] = "coreOf";               calls[i] = abi.encodeCall(IIntact.coreOf, (LO));                        froms[i++] = alice;
        // writes, including the two that touch the most storage
        names[i] = "setApprovalForAll";    calls[i] = abi.encodeCall(IIntact.setApprovalForAll, (bob, true));      froms[i++] = alice;
        names[i] = "setTrait";             calls[i] = abi.encodeCall(IIntact.setTrait, (LO, Traits.CURVE, bytes32(uint256(5)))); froms[i++] = alice;
        names[i] = "approve";              calls[i] = abi.encodeCall(IIntact.approve, (carol, LO));                froms[i++] = alice;
        names[i] = "setStatus";            calls[i] = abi.encodeCall(IIntact.setStatus, (LO, Status.Paused));      froms[i++] = alice;
        names[i] = "transferFrom";         calls[i] = abi.encodeCall(IIntact.transferFrom, (alice, bob, LO));      froms[i++] = alice;
        names[i] = "sealTransfer";         calls[i] = abi.encodeCall(IIntact.sealTransfer, (LO, uint64(T0 + 1 days))); froms[i++] = bob;
        names[i] = "panic";                calls[i] = abi.encodeCall(IIntact.panic, (LO));                         froms[i++] = bob;
        names[i] = "mint";                 calls[i] = abi.encodeCall(IIntact.mint, (carol));                       values[i] = PRICE; froms[i++] = carol;
        assertEq(i, n);

        // Warm every address the views touch on both builds first: the mocks
        // are shared, so whichever build is measured second would otherwise
        // find the Roles, delegate and renderer addresses already warm.
        for (uint256 k; k < 13; ++k) {
            _gas(mono, froms[k], calls[k], 0);
            _gas(dia, froms[k], calls[k], 0);
        }
        string memory report = "call mono dia over\n";
        for (uint256 k; k < n; ++k) {
            uint256 m = _gas(mono, froms[k], calls[k], values[k]);
            uint256 d = _gas(dia, froms[k], calls[k], values[k]);
            uint256 over = d > m ? d - m : 0;
            assertTrue(over <= 6_000 || over * 100 <= m * 25, string.concat("diamond overhead drifted on ", names[k]));
            report = string.concat(report, names[k], " ", LibNum.str(m), " ", LibNum.str(d), " ", LibNum.str(over), "\n");
        }
        _report(report);
    }

    function test_mintIsUnderFourHundredThousand() public {
        uint256 first = _gas(hub, alice, abi.encodeCall(IIntact.mint, (alice)), PRICE);
        uint256 second = _gas(hub, bob, abi.encodeCall(IIntact.mint, (bob)), PRICE);
        assertLt(first, 400_000, "the first mint of a world");
        assertLt(second, 400_000, "a mint with the registry warm");
        assertEq(hub.account(LO).code.length, 173);
        assertEq(hub.grip(LO + 1).code.length, 173);
        _report(string.concat("mint first=", LibNum.str(first), " second=", LibNum.str(second),
            diamondBuild ? " (diamond)" : " (monolith)"));
    }
}
