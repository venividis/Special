// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Bridges} from "../src/Bridges.sol";
import {IBridgesEvents} from "../src/interfaces/IBridges.sol";
import {Timelock} from "../src/Timelock.sol";

/*───────────────────────────────────────────────────────────────────────────
  Bridges — the off-chain doors, written on chain (V2, unit W3)

  The real Timelock is the only writer: a door is queued, waits its seven
  days in public, and lands when anyone executes it. The URL rules are
  walked one refusal at a time, each with the byte on either side of its
  boundary, so a rule that moves by one character is a test that fails.
  Hosts in this file are under `.example` (RFC 2606): no real endpoint is
  named in a file.
───────────────────────────────────────────────────────────────────────────*/
contract BridgesTest is Test, IBridgesEvents {
    Timelock lock;
    Bridges bridges;

    address admin = address(0xAD);
    address stranger = address(0x57A);
    bytes32 constant DOOR = keccak256("opensea.v2");
    bytes32 constant B = keccak256("b.v1");
    bytes32 constant C = keccak256("c.v1");
    string constant URL = "https://orders.example/api/v2";
    uint64 constant T0 = 1_800_000_000;

    function setUp() public {
        vm.warp(T0);
        lock = new Timelock(admin);
        bridges = new Bridges(address(lock));
    }

    function _set(bytes32 name, bytes memory url) internal returns (bool ok, bytes memory ret) {
        bytes memory data = abi.encodeCall(Bridges.setEndpoint, (name, string(url)));
        vm.prank(address(lock));
        (ok, ret) = address(bridges).call(data);
    }

    function _refused(bytes memory url, string memory why) internal {
        (bool ok, bytes memory ret) = _set(DOOR, url);
        assertFalse(ok, why);
        assertEq(ret, abi.encodeWithSelector(BadEndpoint.selector), why);
    }

    function _accepted(bytes memory url, string memory why) internal {
        (bool ok, ) = _set(DOOR, url);
        assertTrue(ok, why);
        (string memory got, ) = bridges.endpointOf(DOOR);
        assertEq(bytes(got), url, why);
    }

    function _repeat(bytes1 c, uint256 n) internal pure returns (bytes memory out) {
        out = new bytes(n);
        for (uint256 i; i < n; ++i) out[i] = c;
    }

    /*═══════════════════ who writes ═══════════════════*/

    function test_theConstructorRefusesAZeroTimelock() public {
        try new Bridges(address(0)) { assertTrue(false, "a zero Timelock was accepted"); }
        catch (bytes memory e) {
            assertEq(e, abi.encodeWithSelector(Bridges.ZeroAddress.selector), "a zero Timelock is refused with ZeroAddress");
        }
        assertEq(bridges.TIMELOCK(), address(lock), "Bridges names its Timelock");
        assertEq(bridges.MAX_URL(), 256, "a URL is at most 256 bytes");
    }

    function test_onlyTheTimelockWritesADoor() public {
        bytes memory data = abi.encodeCall(Bridges.setEndpoint, (DOOR, URL));
        vm.prank(stranger);
        (bool ok, bytes memory ret) = address(bridges).call(data);
        assertFalse(ok, "a stranger cannot write a door");
        assertEq(ret, abi.encodeWithSelector(NotTimelock.selector), "a direct call from a stranger is refused with NotTimelock");
        vm.prank(admin);
        (ok, ret) = address(bridges).call(data);
        assertEq(ret, abi.encodeWithSelector(NotTimelock.selector), "the Timelock's own admin calling directly is refused with NotTimelock");
        (string memory url, uint64 at) = bridges.endpointOf(DOOR);
        assertTrue(bytes(url).length == 0 && at == 0, "nothing was written");
    }

    function test_aDoorSetThroughTheTimelocksQueueIsReadBackAfterSevenDays() public {
        bytes memory data = abi.encodeCall(Bridges.setEndpoint, (DOOR, URL));
        bytes32 salt = keccak256("door");
        vm.prank(admin);
        lock.queue(address(bridges), 0, data, salt);
        vm.expectRevert(Timelock.TooEarly.selector);
        lock.execute(address(bridges), 0, data, salt);
        (string memory before, ) = bridges.endpointOf(DOOR);
        assertEq(bytes(before).length, 0, "a queued door is not open before its delay");
        vm.warp(T0 + 7 days);
        vm.prank(stranger);
        lock.execute(address(bridges), 0, data, salt);
        (string memory url, uint64 at) = bridges.endpointOf(DOOR);
        assertEq(bytes(url), bytes(URL), "the door the Timelock queued is the door that is read back");
        assertEq(uint256(at), uint256(T0 + 7 days), "the door records when it was written");
        bytes32[] memory all = bridges.names();
        assertEq(all.length, 1, "one name holds a record");
        assertEq(all[0], DOOR, "and it is the door's name");
    }

    function test_anEmptyUrlRemovesTheRecordAndRemembersWhen() public {
        (bool ok, ) = _set(DOOR, bytes(URL));
        assertTrue(ok, "a door is written");
        vm.warp(T0 + 1 days);
        (ok, ) = _set(DOOR, "");
        assertTrue(ok, "an empty URL is accepted");
        (string memory url, uint64 at) = bridges.endpointOf(DOOR);
        assertEq(bytes(url).length, 0, "an empty URL removes the record");
        assertEq(uint256(at), uint256(T0 + 1 days), "a removed record still says when it was removed");
        assertEq(bridges.names().length, 0, "a removed name holds no record and is not listed");
        (string memory never, uint64 n) = bridges.endpointOf(B);
        assertTrue(bytes(never).length == 0 && n == 0, "a name never written reads empty at time zero");
    }

    function test_namesListOnlyHeldRecordsInFirstSetOrder() public {
        _set(DOOR, bytes(URL));
        _set(B, "https://b.example");
        _set(C, "https://c.example");
        _set(B, "https://b2.example");
        bytes32[] memory all = bridges.names();
        assertEq(all.length, 3, "rewriting a door does not list it twice");
        assertTrue(all[0] == DOOR && all[1] == B && all[2] == C, "names are listed in the order first set, not last set");
        _set(DOOR, "");
        all = bridges.names();
        assertTrue(all.length == 2 && all[0] == B && all[1] == C, "a removed name drops out of the list");
        _set(DOOR, bytes(URL));
        all = bridges.names();
        assertTrue(all.length == 3 && all[0] == DOOR && all[1] == B && all[2] == C,
                   "a name set again returns to the place it was first set");
    }

    /*═══════════════════ what a door may say ═══════════════════*/

    function test_aUrlOverMaxUrlBytesIsRefused() public {
        bytes memory at256 = bytes.concat("https://", _repeat("a", 248));
        bytes memory at257 = bytes.concat("https://", _repeat("a", 249));
        assertEq(at256.length, 256, "the boundary is 256 bytes");
        _accepted(at256, "a URL of exactly 256 bytes is accepted");
        _refused(at257, "a URL of 257 bytes is refused with BadEndpoint");
    }

    function test_aUrlThatDoesNotBeginHttpsIsRefused() public {
        _refused("http://a.example", "an http URL is refused with BadEndpoint");
        _refused("HTTPS://a.example", "the scheme is lower-case https://");
        _refused("https:/a.example", "a URL missing a slash of the scheme is refused");
        _refused(" https://a.example", "a URL that does not begin with the scheme is refused");
        _refused("ftp://a.example/x", "another scheme is refused");
        _refused("javascript:alert(1)", "a script URL is refused");
        _accepted("https://a.example", "an https URL is accepted");
    }

    function test_theSchemeAloneIsRefused() public {
        _refused("https://", "the scheme alone names no host and is refused with BadEndpoint");
        _accepted("https://a", "the scheme and one byte is accepted");
    }

    function test_aSpaceIsRefused() public {
        _refused("https://a.example/a b", "a space is refused with BadEndpoint");
    }

    function test_aQuoteOfEitherKindIsRefused() public {
        _refused(bytes.concat("https://a.example/", bytes1(0x22)), "a double quote is refused with BadEndpoint");
        _refused(bytes.concat("https://a.example/", bytes1(0x27)), "a single quote is refused with BadEndpoint");
    }

    function test_aBackslashIsRefused() public {
        _refused(bytes.concat("https://a.example/", bytes1(0x5c)), "a backslash is refused with BadEndpoint");
    }

    function test_anAngleBracketIsRefused() public {
        // each bracket alone, so neither rule can stand in for the other
        _refused(bytes.concat("https://a.example/", bytes1(0x3c)), "a < is refused with BadEndpoint");
        _refused(bytes.concat("https://a.example/", bytes1(0x3e)), "a > is refused with BadEndpoint");
        _refused("https://a.example/<script>", "a tag is refused with BadEndpoint");
    }

    function test_aControlByteDeleteOrNonAsciiByteIsRefused() public {
        bytes1[7] memory bad = [bytes1(0x00), bytes1(0x09), bytes1(0x0a), bytes1(0x1f), bytes1(0x7f), bytes1(0x80), bytes1(0xff)];
        for (uint256 i; i < bad.length; ++i) {
            _refused(bytes.concat("https://a.example/", bad[i]), "a control byte, DEL or a non-ASCII byte is refused with BadEndpoint");
        }
        _refused(bytes.concat("https://a.example/caf", hex"c3a9"), "UTF-8 beyond ASCII is refused with BadEndpoint");
    }

    function test_everyOtherPrintableByteIsAccepted() public {
        bytes memory url = "https://";
        for (uint256 c = 0x21; c <= 0x7e; ++c) {
            if (c == 0x22 || c == 0x27 || c == 0x5c || c == 0x3c || c == 0x3e) continue;
            url = bytes.concat(url, bytes1(uint8(c)));
        }
        assertEq(url.length, 8 + 89, "eighty-nine printable bytes remain");
        _accepted(url, "every printable byte but the space, the quotes, the backslash and the angle brackets is accepted");
    }
}
