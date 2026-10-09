// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Create3Factory} from "../src/lib/Create3Factory.sol";
import {Timelock} from "../src/Timelock.sol";

/*───────────────────────────────────────────────────────────────────────────
  The CREATE3 factory, held to its one promise: an address is a function
  of (factory, salt) and of nothing else (INTACT U10; DESIGN.md §12).

  The hand formula `_create3` below is written independently of the
  factory's own `predict`, so the two implementations check each other;
  tools/deploy.mjs carries a third, in JavaScript, and asserts it against
  the chain after every step.

  And to its second promise, added after a reviewer took a token through
  the ungated first version: only the burner that made the factory and the
  address the Timelock salt lands at may deploy through it, so no stranger
  can become the hub's MARKET, ROLES or AGENTCARD by landing first, nor
  burn a public salt on a fresh band. The gate moves no address — the
  last test below lands a real Timelock through its own queue at exactly
  the address the ungated arithmetic predicts.
───────────────────────────────────────────────────────────────────────────*/

/// @dev Three contracts with three different initcodes and one shared salt.
contract Small {
    uint256 public immutable X;
    constructor(uint256 x) { X = x; }
}

contract Big {
    string public name;
    uint256[] public table;
    constructor(string memory n) {
        name = n;
        for (uint256 i; i < 8; ++i) table.push(i * 7);
    }
}

contract Refuses {
    error Never();
    constructor() { revert Never(); }
}

contract Paid {
    uint256 public immutable GOT;
    constructor() payable { GOT = msg.value; }
}

contract Create3Test is Test {
    bytes32 constant SALT = keccak256("intact.v1.example");
    bytes32 constant PROXY_INITCODE_HASH = keccak256(hex"67363d3d37363d34f03d5260086018f3");

    Create3Factory factory;

    function setUp() public {
        factory = new Create3Factory();
    }

    /// @dev keccak(0xff ‖ factory ‖ salt ‖ keccak(proxy initcode)) is the
    ///      proxy; keccak(rlp([proxy, 1])) is what the proxy creates first.
    function _create3(address f, bytes32 salt) internal pure returns (address) {
        address proxy = address(uint160(uint256(
            keccak256(abi.encodePacked(bytes1(0xff), f, salt, PROXY_INITCODE_HASH)))));
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"d6", hex"94", proxy, hex"01")))));
    }

    function test_theProxyInitcodeHashIsTheConstantThePredictionUses() public view {
        assertEq(factory.PROXY_INITCODE_HASH(), PROXY_INITCODE_HASH);
    }

    function test_predictEqualsDeploy() public {
        address predicted = factory.predict(SALT);
        assertEq(predicted, _create3(address(factory), SALT), "two formulas, one address");
        assertEq(predicted.code.length, 0, "nothing there yet");
        address got = factory.deploy(SALT, abi.encodePacked(type(Small).creationCode, abi.encode(uint256(42))));
        assertEq(got, predicted, "the deploy landed where predict said");
        assertGt(got.code.length, 0, "and left code");
        assertEq(Small(got).X(), 42, "with its constructor argument honoured");
    }

    function test_theSameSaltGivesTheSameAddressWhateverTheCode() public {
        // a second factory, so the same salt can be used twice in one test;
        // each factory's answer must be the hand formula over (factory, salt)
        Create3Factory other = new Create3Factory();
        address p1 = factory.predict(SALT);
        address p2 = other.predict(SALT);
        assertTrue(p1 != p2, "a different factory is a different address");

        // a small contract with a uint argument under one, a big one with a
        // string argument under the other: initcode differs in length and
        // content and neither prediction moves
        address a = factory.deploy(SALT, abi.encodePacked(type(Small).creationCode, abi.encode(uint256(1))));
        address b = other.deploy(SALT, abi.encodePacked(type(Big).creationCode, abi.encode("intact")));
        assertEq(a, p1, "small code landed on the prediction made before any code was known");
        assertEq(b, p2, "big code landed on its factory's prediction too");
        assertEq(a, _create3(address(factory), SALT));
        assertEq(b, _create3(address(other), SALT));
        assertEq(factory.predict(SALT), p1, "predict does not change after the fact");
        assertEq(Big(b).table(3), 21);
    }

    function test_aSaltCannotBeUsedTwice() public {
        factory.deploy(SALT, abi.encodePacked(type(Small).creationCode, abi.encode(uint256(1))));
        vm.expectRevert(Create3Factory.SaltUsed.selector);
        factory.deploy(SALT, abi.encodePacked(type(Small).creationCode, abi.encode(uint256(2))));
        // and not even with different code
        vm.expectRevert(Create3Factory.SaltUsed.selector);
        factory.deploy(SALT, abi.encodePacked(type(Big).creationCode, abi.encode("again")));
    }

    function test_aRevertingConstructorFailsClosed() public {
        address predicted = factory.predict(SALT);
        vm.expectRevert(Create3Factory.DeploymentFailed.selector);
        factory.deploy(SALT, type(Refuses).creationCode);
        assertEq(predicted.code.length, 0, "nothing landed");
        // the salt is still free: the whole transaction reverted, proxy included
        address got = factory.deploy(SALT, abi.encodePacked(type(Small).creationCode, abi.encode(uint256(3))));
        assertEq(got, predicted, "the salt was not burned by the failure");
    }

    function test_emptyCodeIsADeploymentFailure() public {
        // initcode that returns nothing: STOP. CREATE succeeds and leaves an
        // empty account, which the factory refuses to call a deployment.
        vm.expectRevert(Create3Factory.DeploymentFailed.selector);
        factory.deploy(SALT, hex"00");
    }

    function test_valueReachesTheConstructor() public {
        address got = factory.deploy{value: 1 ether}(SALT, type(Paid).creationCode);
        assertEq(Paid(got).GOT(), 1 ether);
        assertEq(got.balance, 1 ether);
        assertEq(address(factory).balance, 0, "the factory keeps nothing");
    }

    /*──────────── who may deploy ────────────*/

    function test_theFactoryNamesItsDeployerAndThePredictedTimelock() public view {
        assertEq(factory.DEPLOYER(), address(this), "the constructor's msg.sender is the deployer");
        assertEq(factory.TIMELOCK_SALT(), keccak256("intact.v1.timelock"));
        assertEq(factory.TIMELOCK(), _create3(address(factory), keccak256("intact.v1.timelock")),
                 "the Timelock's address is known before the Timelock exists");
        assertEq(factory.TIMELOCK().code.length, 0, "and it has no code yet");
    }

    function test_aStrangerCannotDeployThroughTheFactory() public {
        address mallory = address(0xBAD);
        address predicted = factory.predict(SALT);
        bytes memory code = abi.encodePacked(type(Small).creationCode, abi.encode(uint256(7)));
        vm.prank(mallory);
        vm.expectRevert(Create3Factory.NotDeployer.selector);
        factory.deploy(SALT, code);
        assertEq(predicted.code.length, 0, "nothing landed");
        // the salt is untouched: the deployer lands it afterwards where predicted
        assertEq(factory.deploy(SALT, code), predicted, "the stranger burned nothing");
    }

    function test_aStrangerCannotTakeAPostMvbSaltEither() public {
        // the three salts the hub pins while they are still codeless
        bytes32[3] memory salts = [keccak256("intact.v1.market"), keccak256("intact.v1.roles"), keccak256("intact.v1.agentCard")];
        for (uint256 i; i < 3; ++i) {
            vm.prank(address(0xBAD));
            vm.expectRevert(Create3Factory.NotDeployer.selector);
            factory.deploy(salts[i], abi.encodePacked(type(Small).creationCode, abi.encode(i)));
            assertEq(factory.predict(salts[i]).code.length, 0, "the pin stays codeless");
        }
    }

    function test_theTimelockDeploysThroughItsOwnQueueOnceTheBurnerIsGone() public {
        // the deployer lands the Timelock under its salt, admin = this test
        bytes32 tsalt = factory.TIMELOCK_SALT();
        address payable tl = payable(factory.deploy(tsalt, abi.encodePacked(type(Timelock).creationCode, abi.encode(address(this)))));
        assertEq(tl, factory.TIMELOCK(), "the Timelock landed where the factory said it would");
        assertEq(Timelock(tl).admin(), address(this));

        // the burner is gone: a later satellite is queued, waits a week, and
        // is executed by a stranger — exactly DESIGN §12's post-MVB path
        bytes memory code = abi.encodePacked(type(Small).creationCode, abi.encode(uint256(99)));
        bytes memory call = abi.encodeCall(Create3Factory.deploy, (SALT, code));
        address predicted = factory.predict(SALT);
        Timelock(tl).queue(address(factory), 0, call, bytes32("market"));
        vm.warp(block.timestamp + 7 days);
        vm.prank(address(0xC0FFEE));
        Timelock(tl).execute(address(factory), 0, call, bytes32("market"));
        assertEq(predicted.code.length > 0, true, "the queued deployment landed");
        assertEq(Small(predicted).X(), 99);
    }

    function test_theTimelockAddressMayDeployEvenBeforeItHasCode() public {
        // msg.sender is what the gate reads; a prank from the predicted
        // address proves the gate is an address check and nothing wider
        address predicted = factory.predict(SALT);
        vm.prank(factory.TIMELOCK());
        address got = factory.deploy(SALT, abi.encodePacked(type(Small).creationCode, abi.encode(uint256(5))));
        assertEq(got, predicted);
    }

    function test_twoSaltsAreTwoAddressesAndTwoDeployments() public {
        bytes32 s2 = keccak256("intact.v1.other");
        address a = factory.deploy(SALT, abi.encodePacked(type(Small).creationCode, abi.encode(uint256(1))));
        address b = factory.deploy(s2, abi.encodePacked(type(Small).creationCode, abi.encode(uint256(2))));
        assertTrue(a != b);
        assertEq(Small(a).X(), 1);
        assertEq(Small(b).X(), 2);
    }
}
