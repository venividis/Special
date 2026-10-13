// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactFixture} from "./helpers/Deploy.sol";
import {
    MockReachImpl, MockGripImpl, MockRenderer, MockPool, MockLocks, MockLaunchpad, MockSteward
} from "./helpers/HubMocks.sol";
import {IntactConfig} from "../src/hub/IntactBase.sol";
import {IIntact, IIntactEvents, Status, Traits} from "../src/interfaces/IIntact.sol";
import {IRoles} from "../src/interfaces/IRoles.sol";
import {IERC7432} from "../src/interfaces/Standards.sol";
import {Rights} from "../src/lib/Rights.sol";
import {Roles} from "../src/Roles.sol";

/*───────────────────────────────────────────────────────────────────────────
  Roles against the real hub (U16)

  DESIGN.md §2 "Role holder" and §3 row 29; BUILD-PLAN.md U16. ANIMA's
  fourteen Roles.test.ts cases rewritten as sentences for a registry that
  is revocable-only, strict-holds and epoch-stamped, plus the ones INTACT
  adds: a live role locks, a stale one unlocks for anyone, panic makes
  every role stale, the ERC-4907 shim reads the USER role, `rightsOf`
  sets and clears R_ROLE and R_USE, a buyer grants afresh, the hub is
  never asked to unlock at zero, and sixteen ids bound the walk.

  The hub is the real one, in the build INTACT_IMPL names, with the real
  Roles in its `IntactConfig.roles` (the mutual pin is settled by the
  nonce probe of test/helpers/Deploy.sol's bundle fixture): `rightsOf`,
  `userOf`, `userExpires`, `moduleLock`, `moduleUnlock`, `panic` and the
  transfer rule are exercised against real code, the other satellites
  being the hub suite's stand-ins.
───────────────────────────────────────────────────────────────────────────*/
contract RolesProbe {}

contract RolesTest is IntactFixture {
    Roles theRoles;
    bytes32 USER;
    bytes32 constant OPERATOR = keccak256("OPERATOR");
    bytes32 constant PAYER = keccak256("PAYER");
    bytes32 constant AUDITOR = keccak256("AUDITOR");
    bytes32 constant TRAINER = keccak256("TRAINER");
    address renter = address(0x2E);
    address op = address(0x0A);
    address stranger = address(0x57A);
    address dave = address(0xDA7E);
    address other = address(0x07E2C011EC7);            // a collection this registry does not represent

    error Mispredicted(address predicted, address actual);
    error NonceNotFound();

    function setUp() public {
        vm.warp(T0);
        vm.etch(REGISTRY, REGISTRY_RUNTIME);
        reachImpl = new MockReachImpl();
        gripImpl = new MockGripImpl();
        renderer = new MockRenderer();
        pool = new MockPool();
        locks = new MockLocks();
        launchpad = new MockLaunchpad();
        steward = new MockSteward();
        diamondBuild = keccak256(bytes(vm.envOr("INTACT_IMPL", "monolith"))) == keccak256("diamond");

        // the mutual pin: Roles takes the hub's address, the hub takes Roles'
        uint256 n = _nextNonce();
        address hubP = _predict(address(this), n + 1 + (diamondBuild ? 4 : 0));
        theRoles = new Roles(hubP);                                                   // n
        IntactConfig memory c = config();
        c.roles = address(theRoles);
        hub = diamondBuild ? deployDiamond(c, PRICE) : deployMonolith(c, PRICE);     // n + 1 (after four facets on the diamond)
        if (address(hub) != hubP) revert Mispredicted(hubP, address(hub));
        USER = theRoles.USER();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);
    }

    /*═══════════════════ helpers ═══════════════════*/

    function _role(uint256 id, bytes32 roleId, address to, uint64 until, bytes memory data)
        internal view returns (IERC7432.Role memory)
    {
        return IERC7432.Role({
            roleId: roleId, tokenAddress: address(hub), tokenId: id, recipient: to,
            expirationDate: until, revocable: true, data: data
        });
    }

    function _grant(address by, uint256 id, bytes32 roleId, address to, uint64 until) internal {
        IERC7432.Role memory r = _role(id, roleId, to, until, "");
        vm.prank(by);
        theRoles.grantRole(r);
    }

    function _lockCount(uint256 id) internal view returns (uint32) {
        return hub.coreOf(id).lockCount;
    }

    /// @dev The runner's `expectRevert(bytes)` matches any revert, so the
    ///      exact data of a refusal is read from a raw call instead.
    function _refusal(bytes memory data) internal returns (bytes memory ret) {
        bool ok;
        (ok, ret) = address(theRoles).call(data);
        assertFalse(ok, "expected a refusal");
    }

    /// @dev The test contract's next CREATE nonce (test/helpers/Deploy.sol's
    ///      bundle fixture): deploy a probe, find the nonce it landed at, add one.
    function _nextNonce() internal returns (uint256 n) {
        address probe = address(new RolesProbe());
        for (n = 0; n < 1 << 16; ++n) if (_predict(address(this), n) == probe) return n + 1;
        revert NonceNotFound();
    }

    function _predict(address d, uint256 nonce) internal pure returns (address) {
        bytes memory rlp;
        if (nonce == 0) rlp = abi.encodePacked(bytes1(0xd6), bytes1(0x94), d, bytes1(0x80));
        else if (nonce <= 0x7f) rlp = abi.encodePacked(bytes1(0xd6), bytes1(0x94), d, uint8(nonce));
        else if (nonce <= 0xff) rlp = abi.encodePacked(bytes1(0xd7), bytes1(0x94), d, bytes1(0x81), uint8(nonce));
        else if (nonce <= 0xffff) rlp = abi.encodePacked(bytes1(0xd8), bytes1(0x94), d, bytes1(0x82), uint16(nonce));
        else rlp = abi.encodePacked(bytes1(0xd9), bytes1(0x94), d, bytes1(0x83), uint24(nonce));
        return address(uint160(uint256(keccak256(rlp))));
    }

    /*═══════════════════ A's fourteen, as sentences ═══════════════════*/

    function test_advertisesTheInterfaceIdTheSpecPublishes() public view {
        assertTrue(theRoles.supportsInterface(0xd00ca5cf), "ERC-7432");
        assertEq(bytes32(type(IERC7432).interfaceId), bytes32(bytes4(0xd00ca5cf)), "Standards.sol spells the spec's id");
        assertTrue(theRoles.supportsInterface(0x01ffc9a7), "ERC-165");
        assertTrue(theRoles.supportsInterface(type(IRoles).interfaceId), "the frozen surface");
        assertFalse(theRoles.supportsInterface(0xffffffff));
        assertEq(theRoles.HUB(), address(hub));
        assertEq(hub.ROLES(), address(theRoles), "the hub pins this registry");
        assertEq(theRoles.USER(), keccak256("USER"));
        assertEq(theRoles.MAX_ROLES(), 16);
    }

    function test_holdsFourDistinctRolesAtOnce() public {
        // the thing ERC-4907 cannot express
        uint256 id = mintTo(alice);
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));
        _grant(alice, id, PAYER, carol, uint64(T0 + 7 days));
        _grant(alice, id, AUDITOR, dave, uint64(T0 + 90 days));
        _grant(alice, id, TRAINER, guardian, uint64(T0 + 60 days));

        assertEq(theRoles.recipientOf(address(hub), id, OPERATOR), bob);
        assertEq(theRoles.recipientOf(address(hub), id, PAYER), carol);
        assertEq(theRoles.recipientOf(address(hub), id, AUDITOR), dave);
        assertEq(theRoles.recipientOf(address(hub), id, TRAINER), guardian);
        assertTrue(theRoles.hasRole(id, OPERATOR, bob));
        assertTrue(theRoles.hasRole(id, PAYER, carol));
        assertTrue(theRoles.hasRole(id, AUDITOR, dave));
        assertTrue(theRoles.hasRole(id, TRAINER, guardian));
        assertFalse(theRoles.hasRole(id, OPERATOR, carol), "a role names one recipient");
        assertFalse(theRoles.hasRole(id, PAYER, bob));
        assertEq(theRoles.liveRoleCount(id), 4);
        assertEq(_lockCount(id), 1, "four roles, one lock");

        // ERC-4907's single user slot holds none of these
        assertEq(hub.userOf(id), address(0));
        assertEq(hub.userExpires(id), 0);

        // a role that is not USER is R_ROLE and nothing else: the page reads what the role's data says
        assertEq(bitsOf(id, bob), Rights.R_ROLE);
        assertEq(bitsOf(id, carol), Rights.R_ROLE);
        assertEq(bitsOf(id, dave), Rights.R_ROLE);
        assertEq(bitsOf(id, guardian), Rights.R_ROLE);
        assertTrue(theRoles.hasAnyRole(id, bob));
        assertFalse(theRoles.hasAnyRole(id, stranger));
        assertFalse(theRoles.hasAnyRole(id, address(0)));
        assertFalse(hub.acts(id, bob));
        assertFalse(hub.holds(id, bob));
    }

    function test_freezesTheTokenInPlaceRatherThanTakingCustody() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));

        // the owner still holds it: visible to every marketplace and indexer
        assertEq(hub.ownerOf(id), alice);
        assertEq(theRoles.ownerOf(address(hub), id), alice);
        assertEq(hub.balanceOf(alice), 1);
        assertEq(bitsOf(id, alice), Rights.R_HOLD);
        // it just cannot be sold out from under the grantee
        assertTrue(hub.locked(id));
        assertFalse(hub.isTransferable(id, alice, carol));
        assertEq(hub.getTraitValue(id, Traits.LOCKED), bytes32(uint256(1)));
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, carol, id);
        // nor by an operator, nor through the modules' own doors
        vm.prank(alice);
        hub.setApprovalForAll(op, true);
        vm.prank(op);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, carol, id);
        vm.prank(address(steward));
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.stewardTransfer(id, carol);
        vm.prank(market);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.moduleTransfer(id, carol);
        assertEq(hub.ownerOf(id), alice);
    }

    function test_returnsTheTokenToCirculationOnceRolesAreCleared() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));
        assertTrue(hub.locked(id));

        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        // the last live role went with the revoke, and so did the lock: nobody has to unlock
        assertFalse(hub.locked(id));
        assertEq(_lockCount(id), 0);
        assertEq(theRoles.liveRoleCount(id), 0);
        assertFalse(theRoles.hasRole(id, OPERATOR, bob));
        assertEq(theRoles.recipientOf(address(hub), id, OPERATOR), address(0));
        assertEq(theRoles.roleEpoch(id, OPERATOR), 0, "the record is gone");
        vm.prank(stranger);
        vm.expectRevert(IRoles.NotLocked.selector);
        theRoles.unlockToken(address(hub), id);

        assertTrue(hub.isTransferable(id, alice, carol));
        vm.prank(alice);
        hub.transferFrom(alice, carol, id);
        assertEq(hub.ownerOf(id), carol);
    }

    function test_doesNotUnlockWhileARevocableRoleIsStillActive() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));

        vm.prank(stranger);
        vm.expectRevert(IRoles.StillLocked.selector);
        theRoles.unlockToken(address(hub), id);
        // the exact answer: locked until the role's expiry
        assertEq(_refusal(abi.encodeCall(IERC7432.unlockToken, (address(hub), id))),
                 abi.encodeWithSelector(IRoles.StillLocked.selector, id, uint64(T0 + 30 days)));
        // the owner cannot unlock around a live role either: revoking is the only early end
        vm.prank(alice);
        vm.expectRevert(IRoles.StillLocked.selector);
        theRoles.unlockToken(address(hub), id);
        assertTrue(hub.locked(id));
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, carol, id);

        vm.warp(T0 + 30 days + 1);
        assertFalse(theRoles.hasRole(id, OPERATOR, bob));
        assertEq(theRoles.liveRoleCount(id), 0);
        assertTrue(hub.locked(id), "expiry is a clock, not an event: the hub's lock waits for a call");
        // permissionless: an owner should not need a grantee's cooperation to sell
        vm.prank(stranger);
        theRoles.unlockToken(address(hub), id);
        assertFalse(hub.locked(id));
        assertEq(_lockCount(id), 0);
        vm.prank(alice);
        hub.transferFrom(alice, carol, id);
        assertEq(hub.ownerOf(id), carol);
    }

    function test_keepsTheLockThroughTheLongestLiveRoleAfterAnotherIsRevoked() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));
        _grant(alice, id, PAYER, bob, uint64(T0 + 60 days));
        assertEq(theRoles.liveRoleCount(id), 2);

        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, PAYER);
        assertEq(theRoles.liveRoleCount(id), 1);
        assertTrue(hub.locked(id));
        assertEq(_refusal(abi.encodeCall(IERC7432.unlockToken, (address(hub), id))),
                 abi.encodeWithSelector(IRoles.StillLocked.selector, id, uint64(T0 + 30 days)));

        // the other way round: the longer role is the one that remains
        _grant(alice, id, PAYER, bob, uint64(T0 + 60 days));
        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        assertEq(theRoles.liveRoleCount(id), 1);
        assertEq(_refusal(abi.encodeCall(IERC7432.unlockToken, (address(hub), id))),
                 abi.encodeWithSelector(IRoles.StillLocked.selector, id, uint64(T0 + 60 days)));
        assertEq(_lockCount(id), 1);
    }

    function test_doesNotUnlockAfterAShorterRoleExpiresWhileALongerOneIsLive() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, AUDITOR, bob, uint64(T0 + 10 days));
        _grant(alice, id, OPERATOR, carol, uint64(T0 + 30 days));
        assertEq(theRoles.liveRoleCount(id), 2);

        vm.warp(T0 + 10 days + 1);
        assertEq(theRoles.liveRoleCount(id), 1);
        assertFalse(theRoles.hasRole(id, AUDITOR, bob));
        assertEq(theRoles.recipientOf(address(hub), id, AUDITOR), address(0));
        assertTrue(theRoles.hasRole(id, OPERATOR, carol));
        vm.prank(stranger);
        vm.expectRevert(IRoles.StillLocked.selector);
        theRoles.unlockToken(address(hub), id);
        assertEq(_refusal(abi.encodeCall(IERC7432.unlockToken, (address(hub), id))),
                 abi.encodeWithSelector(IRoles.StillLocked.selector, id, uint64(T0 + 30 days)));
        assertTrue(hub.locked(id));

        vm.warp(T0 + 30 days + 1);
        vm.prank(stranger);
        theRoles.unlockToken(address(hub), id);
        assertFalse(hub.locked(id));
    }

    function test_anIrrevocableRoleIsRefused() public {
        uint256 id = mintTo(alice);
        IERC7432.Role memory r = _role(id, OPERATOR, bob, uint64(T0 + 10 days), "");
        r.revocable = false;
        vm.prank(alice);
        vm.expectRevert(IRoles.IrrevocableUnsupported.selector);
        theRoles.grantRole(r);
        assertFalse(hub.locked(id), "a refused grant takes no lock");
        assertEq(theRoles.liveRoleCount(id), 0);
        assertFalse(theRoles.hasRole(id, OPERATOR, bob));

        // a revocable role may run as long as the owner likes: the owner can end it
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 3650 days));
        assertTrue(theRoles.isRoleRevocable(address(hub), id, OPERATOR));
        assertEq(theRoles.roleExpirationDate(address(hub), id, OPERATOR), T0 + 3650 days);
        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        assertFalse(hub.locked(id));
    }

    function test_aLiveRoleMayBeRegrantedToAnotherRecipient() public {
        // one recipient per (tokenId, roleId), as the standard keys it
        uint256 id = mintTo(alice);
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));
        _grant(alice, id, OPERATOR, carol, uint64(T0 + 7 days));
        assertEq(theRoles.recipientOf(address(hub), id, OPERATOR), carol);
        assertFalse(theRoles.hasRole(id, OPERATOR, bob));
        assertTrue(theRoles.hasRole(id, OPERATOR, carol));
        assertEq(theRoles.roleExpirationDate(address(hub), id, OPERATOR), T0 + 7 days);
        assertEq(theRoles.liveRoleCount(id), 1);
        assertEq(_lockCount(id), 1);
        assertEq(bitsOf(id, bob), 0);
        assertEq(bitsOf(id, carol), Rights.R_ROLE);

        // and to the same recipient, moving the expiry
        _grant(alice, id, OPERATOR, carol, uint64(T0 + 60 days));
        assertEq(theRoles.roleExpirationDate(address(hub), id, OPERATOR), T0 + 60 days);
        assertEq(theRoles.liveRoleCount(id), 1);
    }

    function test_theRecipientMayWalkAwayFromTheirOwnRole() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));
        _grant(alice, id, PAYER, carol, uint64(T0 + 30 days));

        // nobody else ends a live role: not a stranger, not another recipient, not the Reach
        vm.prank(stranger);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        vm.prank(carol);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        address reach = hub.account(id);
        vm.prank(reach);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.revokeRole(address(hub), id, OPERATOR);

        vm.prank(bob);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        assertEq(theRoles.recipientOf(address(hub), id, OPERATOR), address(0));
        assertFalse(theRoles.hasRole(id, OPERATOR, bob));
        assertEq(theRoles.liveRoleCount(id), 1);
        assertTrue(hub.locked(id), "carol's role still holds the lock");

        vm.prank(carol);
        theRoles.revokeRole(address(hub), id, PAYER);
        assertFalse(hub.locked(id));
        assertEq(_lockCount(id), 0);
    }

    function test_lapsesARoleOnItsOwnExpiry() public {
        uint256 id = mintTo(alice);
        IERC7432.Role memory r = _role(id, TRAINER, bob, uint64(T0 + 3600), bytes("lora-v3"));
        vm.prank(alice);
        theRoles.grantRole(r);
        assertTrue(theRoles.hasRole(id, TRAINER, bob));
        assertEq(theRoles.roleData(address(hub), id, TRAINER), bytes("lora-v3"));
        assertTrue(theRoles.isRoleRevocable(address(hub), id, TRAINER));
        assertEq(theRoles.roleExpirationDate(address(hub), id, TRAINER), T0 + 3600);
        assertEq(theRoles.roleEpoch(id, TRAINER), 1);
        assertEq(hub.custodyEpoch(id), 1);
        assertEq(bitsOf(id, bob), Rights.R_ROLE);

        vm.warp(T0 + 3599);
        assertTrue(theRoles.hasRole(id, TRAINER, bob), "live until the last second");
        vm.warp(T0 + 3600);
        // at its expiry a role is absent to every read, though its stamp stays until the record is cleared
        assertFalse(theRoles.hasRole(id, TRAINER, bob));
        assertFalse(theRoles.hasAnyRole(id, bob));
        assertEq(theRoles.recipientOf(address(hub), id, TRAINER), address(0));
        assertEq(theRoles.roleData(address(hub), id, TRAINER), bytes(""));
        assertEq(theRoles.roleExpirationDate(address(hub), id, TRAINER), 0);
        assertFalse(theRoles.isRoleRevocable(address(hub), id, TRAINER));
        assertEq(theRoles.liveRoleCount(id), 0);
        assertEq(theRoles.roleEpoch(id, TRAINER), 1);
        assertEq(bitsOf(id, bob), 0);
    }

    function test_anOperatorCannotGrant() public {
        uint256 id = mintTo(alice);
        IERC7432.Role memory r = _role(id, PAYER, bob, uint64(T0 + 30 days), "");

        vm.prank(carol);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.grantRole(r);

        // an ERC-721 operator and an approvee may transfer; neither acts (DESIGN §2)
        vm.startPrank(alice);
        hub.setApprovalForAll(op, true);
        hub.approve(dave, id);
        vm.stopPrank();
        assertEq(bitsOf(id, op), Rights.R_CUSTODY);
        assertEq(bitsOf(id, dave), Rights.R_CUSTODY);
        vm.prank(op);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.grantRole(r);
        vm.prank(dave);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.grantRole(r);
        // nor the token's own Reach: a grant is `holds`, not `acts`
        address reach = hub.account(id);
        assertTrue(hub.acts(id, reach));
        vm.prank(reach);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.grantRole(r);
        // and there is no way to be approved for roles: the donor's operator path is closed
        vm.prank(alice);
        vm.expectRevert(IRoles.ApprovalsUnsupported.selector);
        theRoles.setRoleApprovalForAll(address(hub), op, true);
        assertFalse(theRoles.isRoleApprovedForAll(address(hub), alice, op));
        assertFalse(hub.locked(id), "nothing was granted");

        // the holder, and only the holder
        vm.prank(alice);
        theRoles.grantRole(r);
        assertTrue(theRoles.hasRole(id, PAYER, bob));
    }

    function test_aRoleOnATokenOfAnotherCollectionIsRefused() public {
        uint256 id = mintTo(alice);
        IERC7432.Role memory r = _role(id, OPERATOR, bob, uint64(T0 + 1 days), "");
        r.tokenAddress = other;
        vm.prank(alice);
        vm.expectRevert(IRoles.UnsupportedCollection.selector);
        theRoles.grantRole(r);
        vm.expectRevert(IRoles.UnsupportedCollection.selector);
        theRoles.revokeRole(other, id, OPERATOR);
        vm.expectRevert(IRoles.UnsupportedCollection.selector);
        theRoles.unlockToken(other, id);
        vm.expectRevert(IRoles.UnsupportedCollection.selector);
        theRoles.ownerOf(other, id);
        assertFalse(hub.locked(id));

        // a live role here is nobody's role there
        _grant(alice, id, USER, renter, uint64(T0 + 30 days));
        assertEq(theRoles.recipientOf(address(hub), id, USER), renter);
        assertEq(theRoles.recipientOf(other, id, USER), address(0));
        assertEq(theRoles.roleExpirationDate(other, id, USER), 0);
        assertFalse(theRoles.isRoleRevocable(other, id, USER));
        assertEq(theRoles.roleData(other, id, USER), bytes(""));
    }

    function test_rejectsAnExpiryAlreadyInThePast() public {
        uint256 id = mintTo(alice);
        IERC7432.Role memory r = _role(id, OPERATOR, bob, 1, "");
        vm.prank(alice);
        vm.expectRevert(IRoles.ExpirationInThePast.selector);
        theRoles.grantRole(r);
        // now is not the future either
        r.expirationDate = uint64(block.timestamp);
        vm.prank(alice);
        vm.expectRevert(IRoles.ExpirationInThePast.selector);
        theRoles.grantRole(r);
        // and nobody is a recipient
        r.expirationDate = uint64(block.timestamp + 1);
        r.recipient = address(0);
        vm.prank(alice);
        vm.expectRevert(IRoles.ZeroRecipient.selector);
        theRoles.grantRole(r);
        assertFalse(hub.locked(id));

        r.recipient = bob;
        vm.prank(alice);
        theRoles.grantRole(r);
        assertTrue(theRoles.hasRole(id, OPERATOR, bob));
    }

    /*═══════════════════ what INTACT adds ═══════════════════*/

    function test_aLiveRoleLocksTheToken() public {
        uint256 id = mintTo(alice);
        assertFalse(hub.locked(id));
        assertEq(_lockCount(id), 0);

        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));
        assertTrue(hub.locked(id));
        assertEq(_lockCount(id), 1, "the first grant takes the module lock");
        // one lock per token, not per role: a second role and a re-grant take no second one
        _grant(alice, id, PAYER, carol, uint64(T0 + 60 days));
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 45 days));
        assertEq(_lockCount(id), 1);
        assertEq(theRoles.liveRoleCount(id), 2);

        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, carol, id);
        vm.prank(address(steward));
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.stewardTransfer(id, carol);

        // the lock is this module's one count beside any other module's
        vm.prank(address(steward));
        hub.moduleLock(id);
        assertEq(_lockCount(id), 2);
        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, PAYER);
        assertEq(_lockCount(id), 1, "the steward's lock remains");
        assertTrue(hub.locked(id));
        vm.prank(address(steward));
        hub.moduleUnlock(id);
        assertFalse(hub.locked(id));
    }

    function test_aStaleRoleUnlocksForAnyone() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, USER, renter, uint64(T0 + 30 days));
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 60 days));
        assertEq(hub.custodyEpoch(id), 1);
        assertEq(theRoles.roleEpoch(id, USER), 1);
        assertEq(bitsOf(id, renter), Rights.R_USE | Rights.R_ROLE);

        // the holder's panic: the custody epoch moves under the lock, the only way it can
        vm.prank(alice);
        hub.panic(id);
        assertEq(hub.custodyEpoch(id), 2);

        // every role is stale: absent to every read, though its stamp remains
        assertFalse(theRoles.hasRole(id, USER, renter));
        assertFalse(theRoles.hasRole(id, OPERATOR, bob));
        assertFalse(theRoles.hasAnyRole(id, renter));
        assertEq(theRoles.recipientOf(address(hub), id, USER), address(0));
        assertEq(theRoles.roleExpirationDate(address(hub), id, OPERATOR), 0);
        assertEq(theRoles.liveRoleCount(id), 0);
        assertEq(theRoles.roleEpoch(id, USER), 1, "stamped with the epoch it was granted in");
        assertEq(hub.userOf(id), address(0));
        assertEq(bitsOf(id, renter), 0);
        assertEq(bitsOf(id, bob), 0);
        assertTrue(hub.locked(id), "the module's lock is still counted");
        assertEq(_lockCount(id), 1);

        // a stale lock is nobody's: a stranger lifts it
        vm.prank(stranger);
        theRoles.unlockToken(address(hub), id);
        assertFalse(hub.locked(id));
        assertEq(_lockCount(id), 0);
        assertEq(theRoles.roleEpoch(id, USER), 0, "the stale table is cleared with the lock");
        vm.prank(stranger);
        vm.expectRevert(IRoles.NotLocked.selector);
        theRoles.unlockToken(address(hub), id);

        // and the token moves again
        vm.prank(alice);
        hub.transferFrom(alice, carol, id);
        assertEq(hub.ownerOf(id), carol);
    }

    function test_panicMakesEveryRoleStale() public {
        uint256 id = mintTo(alice);
        vm.prank(alice);
        hub.setGuardian(id, guardian);
        _grant(alice, id, USER, renter, uint64(T0 + 30 days));
        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));
        _grant(alice, id, PAYER, carol, uint64(T0 + 30 days));
        _grant(alice, id, AUDITOR, dave, uint64(T0 + 30 days));
        assertEq(theRoles.liveRoleCount(id), 4);
        assertEq(bitsOf(id, renter), Rights.R_USE | Rights.R_ROLE);
        assertEq(bitsOf(id, bob), Rights.R_ROLE);

        // the guardian's panic: the epoch moves and the hub's own hold goes on
        vm.prank(guardian);
        hub.panic(id);
        assertEq(hub.custodyEpoch(id), 2);
        assertEq(theRoles.liveRoleCount(id), 0);
        assertFalse(theRoles.hasRole(id, USER, renter));
        assertFalse(theRoles.hasRole(id, OPERATOR, bob));
        assertFalse(theRoles.hasRole(id, PAYER, carol));
        assertFalse(theRoles.hasRole(id, AUDITOR, dave));
        assertFalse(theRoles.hasAnyRole(id, renter));
        assertFalse(theRoles.hasAnyRole(id, bob));
        assertFalse(theRoles.hasAnyRole(id, carol));
        assertFalse(theRoles.hasAnyRole(id, dave));
        assertEq(bitsOf(id, renter), 0);
        assertEq(bitsOf(id, bob), 0);
        assertEq(bitsOf(id, carol), 0);
        assertEq(bitsOf(id, dave), 0);
        assertEq(bitsOf(id, guardian), Rights.R_GUARDIAN, "panic keeps the guardian");
        assertEq(hub.userOf(id), address(0));
        assertEq(hub.userExpires(id), 0);

        // this module's lock lifts for anyone; the guardian's hold is the hub's own and stays
        vm.prank(stranger);
        theRoles.unlockToken(address(hub), id);
        assertEq(_lockCount(id), 0);
        assertTrue(hub.locked(id), "the guardian hold is a different lock");
        vm.prank(alice);
        hub.release(id);
        assertFalse(hub.locked(id));

        // the holder re-arms with a fresh grant, stamped with the new epoch
        _grant(alice, id, USER, renter, uint64(T0 + 30 days));
        assertEq(theRoles.roleEpoch(id, USER), 2);
        assertTrue(theRoles.hasRole(id, USER, renter));
        assertEq(theRoles.liveRoleCount(id), 1);
        assertEq(bitsOf(id, renter), Rights.R_USE | Rights.R_ROLE);
        assertTrue(hub.locked(id));
    }

    function test_theUserShimReadsTheRole() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, USER, renter, uint64(T0 + 60 days));
        assertEq(hub.userOf(id), renter);
        assertEq(hub.userExpires(id), T0 + 60 days);
        assertEq(bitsOf(id, renter), Rights.R_USE | Rights.R_ROLE);
        assertFalse(hub.acts(id, renter));
        assertFalse(hub.holds(id, renter));

        // the renter has the sentence and nothing else
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotHolder.selector);
        hub.setTrait(id, Traits.CURVE, bytes32(uint256(1)));
        vm.prank(renter);
        vm.expectRevert(IIntactEvents.NotActor.selector);
        hub.setStatus(id, Status.Paused);
        IERC7432.Role memory r = _role(id, OPERATOR, renter, uint64(T0 + 60 days), "");
        vm.prank(renter);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.grantRole(r);

        // the hub's own field wins while it is live; the role holder keeps the role
        vm.prank(alice);
        hub.setUser(id, carol, uint64(T0 + 10 days));
        assertEq(hub.userOf(id), carol);
        assertEq(hub.userExpires(id), T0 + 10 days);
        assertEq(bitsOf(id, carol), Rights.R_USE);
        assertEq(bitsOf(id, renter), Rights.R_ROLE);
        vm.warp(T0 + 10 days + 1);
        assertEq(hub.userOf(id), renter, "the shim falls through to the role again");
        assertEq(hub.userExpires(id), T0 + 60 days);
        assertEq(bitsOf(id, renter), Rights.R_USE | Rights.R_ROLE);

        // both bits go when the role expires
        vm.warp(T0 + 60 days);
        assertEq(hub.userOf(id), address(0));
        assertEq(hub.userExpires(id), 0);
        assertEq(bitsOf(id, renter), 0);
    }

    function test_rightsClearWhenTheRoleIsRevoked() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, USER, renter, uint64(T0 + 60 days));
        assertEq(bitsOf(id, renter), Rights.R_USE | Rights.R_ROLE);
        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, USER);
        assertEq(bitsOf(id, renter), 0);
        assertEq(hub.userOf(id), address(0));
        assertEq(hub.userExpires(id), 0);
        assertFalse(hub.locked(id));

        // revoked by the recipient: the same
        _grant(alice, id, USER, renter, uint64(T0 + 60 days));
        assertEq(bitsOf(id, renter), Rights.R_USE | Rights.R_ROLE);
        vm.prank(renter);
        theRoles.revokeRole(address(hub), id, USER);
        assertEq(bitsOf(id, renter), 0);
        assertEq(hub.userOf(id), address(0));
        assertFalse(hub.locked(id));
    }

    function test_aSaleKillsTheRoleAndABuyersFreshGrantWorks() public {
        uint256 id = mintTo(alice);
        _grant(alice, id, USER, renter, uint64(T0 + 30 days));
        // the seller cannot sell under a live role: lock, not escrow
        vm.prank(alice);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(alice, bob, id);
        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, USER);
        vm.prank(alice);
        hub.transferFrom(alice, bob, id);
        assertEq(hub.custodyEpoch(id), 2);
        assertEq(bitsOf(id, renter), 0);
        assertEq(hub.userOf(id), address(0));

        // the seller is nobody now
        IERC7432.Role memory r = _role(id, USER, renter, uint64(T0 + 30 days), "");
        vm.prank(alice);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.grantRole(r);

        // the buyer's fresh grant is stamped with the new epoch and live
        _grant(bob, id, USER, carol, uint64(T0 + 45 days));
        assertEq(theRoles.roleEpoch(id, USER), 2);
        assertTrue(theRoles.hasRole(id, USER, carol));
        assertEq(hub.userOf(id), carol);
        assertEq(hub.userExpires(id), T0 + 45 days);
        assertEq(bitsOf(id, carol), Rights.R_USE | Rights.R_ROLE);
        assertEq(bitsOf(id, renter), 0);
        assertTrue(hub.locked(id));
        vm.prank(bob);
        vm.expectRevert(IIntactEvents.IsLocked.selector);
        hub.transferFrom(bob, dave, id);
    }

    function test_moduleUnlockIsNeverCalledAtZero() public {
        uint256 id = mintTo(alice);
        // nothing to unlock: refused here, before the hub is asked (its own NotLocked() never shows)
        vm.prank(stranger);
        vm.expectRevert(IRoles.NotLocked.selector);
        theRoles.unlockToken(address(hub), id);
        assertEq(_refusal(abi.encodeCall(IERC7432.unlockToken, (address(hub), id))),
                 abi.encodeWithSelector(IRoles.NotLocked.selector, id));
        // a revoke of nothing touches nothing
        vm.prank(stranger);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        assertEq(_lockCount(id), 0);

        _grant(alice, id, OPERATOR, bob, uint64(T0 + 30 days));
        assertEq(_lockCount(id), 1);
        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        assertEq(_lockCount(id), 0);
        assertEq(_refusal(abi.encodeCall(IERC7432.unlockToken, (address(hub), id))),
                 abi.encodeWithSelector(IRoles.NotLocked.selector, id));
        vm.prank(bob);
        theRoles.revokeRole(address(hub), id, OPERATOR);
        assertEq(_lockCount(id), 0);

        // the lock is taken again by the next first grant, and released once again
        _grant(alice, id, PAYER, carol, uint64(T0 + 30 days));
        assertEq(_lockCount(id), 1);
        vm.warp(T0 + 30 days + 1);
        vm.prank(stranger);
        theRoles.unlockToken(address(hub), id);
        assertEq(_lockCount(id), 0);
        assertEq(_refusal(abi.encodeCall(IERC7432.unlockToken, (address(hub), id))),
                 abi.encodeWithSelector(IRoles.NotLocked.selector, id));
        assertFalse(hub.locked(id));
    }

    function test_sixteenDistinctRoleIdsAreTheBound() public {
        uint256 id = mintTo(alice);
        for (uint256 i = 1; i <= 16; ++i) {
            _grant(alice, id, bytes32(i), bob, uint64(T0 + i * 1 days));
        }
        assertEq(theRoles.liveRoleCount(id), 16);
        assertTrue(theRoles.hasAnyRole(id, bob));
        assertEq(_lockCount(id), 1);

        IERC7432.Role memory r = _role(id, bytes32(uint256(17)), bob, uint64(T0 + 50 days), "");
        vm.prank(alice);
        vm.expectRevert(IRoles.TooManyRoles.selector);
        theRoles.grantRole(r);
        // an id the token already carries may still be re-granted
        _grant(alice, id, bytes32(uint256(3)), carol, uint64(T0 + 100 days));
        assertEq(theRoles.liveRoleCount(id), 16);
        assertEq(theRoles.recipientOf(address(hub), id, bytes32(uint256(3))), carol);
        // a revoke frees the slot
        vm.prank(alice);
        theRoles.revokeRole(address(hub), id, bytes32(uint256(5)));
        assertEq(theRoles.liveRoleCount(id), 15);
        vm.prank(alice);
        theRoles.grantRole(r);
        assertEq(theRoles.liveRoleCount(id), 16);

        // the count is honest about the clock: after eight days the six short ids are dead
        vm.warp(T0 + 8 days + 1);
        assertEq(theRoles.liveRoleCount(id), 10);
        assertTrue(theRoles.hasAnyRole(id, bob));
        assertTrue(theRoles.hasAnyRole(id, carol));
        assertFalse(theRoles.hasRole(id, bytes32(uint256(1)), bob));
        assertTrue(theRoles.hasRole(id, bytes32(uint256(9)), bob));
        assertEq(_refusal(abi.encodeCall(IERC7432.unlockToken, (address(hub), id))),
                 abi.encodeWithSelector(IRoles.StillLocked.selector, id, uint64(T0 + 100 days)));
        // anyone may clear a dead record; nobody but the owner or the recipient a live one
        vm.prank(stranger);
        theRoles.revokeRole(address(hub), id, bytes32(uint256(1)));
        assertEq(theRoles.liveRoleCount(id), 10);
        vm.prank(stranger);
        vm.expectRevert(IRoles.NotOwnerOrApproved.selector);
        theRoles.revokeRole(address(hub), id, bytes32(uint256(9)));

        // once every role is dead the table empties with the lock and the walk starts over
        vm.warp(T0 + 100 days + 1);
        assertEq(theRoles.liveRoleCount(id), 0);
        assertFalse(theRoles.hasAnyRole(id, bob));
        vm.prank(stranger);
        theRoles.unlockToken(address(hub), id);
        assertEq(_lockCount(id), 0);
        assertEq(theRoles.roleEpoch(id, bytes32(uint256(9))), 0);
        _grant(alice, id, bytes32(uint256(1)), bob, uint64(T0 + 200 days));
        assertEq(theRoles.liveRoleCount(id), 1);
        assertEq(_lockCount(id), 1);
    }
}
