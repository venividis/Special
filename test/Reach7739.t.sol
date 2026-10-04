// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ReachFixture} from "./Reach.t.sol";
import {Reach} from "../src/Reach.sol";
import {IReachEvents} from "../src/interfaces/IReach.sol";
import {SafeLike} from "./mocks/SafeLike.sol";

/// @dev A session key that is a contract and says yes to every signature.
///      If the Reach ever consulted a session key, this one would be heard.
contract YesSigner {
    function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4) { return 0x1626ba7e; }
}

/*───────────────────────────────────────────────────────────────────────────
  DESIGN.md §9.1 — ERC-7739-wrapped, attestation-only ERC-1271; §14 B3, H2.

  No signing cheatcode exists in tools/forge.mjs, so the suite signs the
  other way round: it fixes (v, r, s) first, computes the digest the Reach
  will ask about, and derives the holder as `ecrecover(digest, v, r, s)`.
  Whoever that address is, (v, r, s) IS their signature over that digest
  and nothing else — which is exactly what the tests need: the same bytes
  recover to somebody else over any other digest.

  The digest is recomputed here from the type strings, independently of
  the contract, and asserted equal to `attestationDigest`, so the format
  is pinned as well as the behaviour.
───────────────────────────────────────────────────────────────────────────*/
contract Reach7739Test is ReachFixture {
    bytes32 constant R = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;   // a point's x: always recoverable
    bytes32 constant S = 0x0000000000000000000000000000000000000000000000000000000000001234;
    bytes32 constant S2 = 0x0000000000000000000000000000000000000000000000000000000000005678;
    uint8 constant V = 27;
    bytes32 constant PROBE = 0x7739773977397739773977397739773977397739773977397739773977397739;
    bytes4 constant MAGIC = 0x1626ba7e;
    bytes4 constant FAIL = 0xffffffff;

    string constant ATTESTATION_TYPE =
        "Attestation(string purpose,bytes32 payload,uint256 nonce,uint64 deadline,address account,uint256 tokenId,uint64 custodyEpoch)";

    function _digest(address account, uint256 id, uint64 epoch, uint256 nonce, uint256 chainId,
        string memory purpose, bytes32 payload, uint64 deadline) internal pure returns (bytes32)
    {
        bytes32 nameHash = keccak256("INTACT_ATTESTATION");
        bytes32 versionHash = keccak256("1");
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            nameHash, versionHash, chainId, account));
        bytes32 contents = keccak256(abi.encode(
            keccak256(bytes(ATTESTATION_TYPE)), keccak256(bytes(purpose)), payload, nonce, deadline, account, id, epoch));
        bytes32 wrapped = keccak256(abi.encode(
            keccak256(abi.encodePacked(
                "TypedDataSign(Attestation contents,string name,string version,uint256 chainId,address verifyingContract)",
                ATTESTATION_TYPE)),
            contents, nameHash, versionHash, chainId, account));
        return keccak256(abi.encodePacked("\x19\x01", domain, wrapped));
    }

    function _envelope(string memory purpose, bytes32 payload, uint64 deadline, bytes32 s) internal pure returns (bytes memory) {
        return abi.encode(purpose, payload, deadline, abi.encodePacked(R, s, V));
    }

    /// @dev The next token's Reach, before it exists: the digest needs it.
    function _next() internal view returns (uint256 id, address account) {
        id = hub.minted() + 1;
        account = hub.account(id);
    }

    function test_attestationVerifiesAsASafeOwnerWithoutReplay() public {
        (uint256 id, address account) = _next();
        SafeLike safe = new SafeLike(account);
        bytes memory call_ = abi.encodeWithSignature("minted()");
        bytes32 txHash = safe.getTransactionHash(address(hub), 0, call_, 0, 0);

        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 d = _digest(account, id, 1, 0, block.chainid, "safe-owner", txHash, deadline);
        address holder = ecrecover(d, V, R, S);
        assertTrue(holder != address(0));
        hub.mint(holder);
        Reach r = Reach(payable(account));
        assertEq(r.attestationDigest("safe-owner", txHash, deadline), d, "the on-chain digest is the documented one");

        bytes memory envelope = _envelope("safe-owner", txHash, deadline, S);
        bytes memory sigs = safe.contractSignature(account, envelope);

        // Safe 1.4.1 asks through the legacy bytes shape; 1.5.0 through the hash
        assertTrue(safe.execTransaction(address(hub), 0, call_, sigs), "the Reach is a Safe 1.4.1 owner");
        safe.checkSignatures150(txHash, sigs);
        assertSel(r.isValidSignature(txHash, envelope), MAGIC, "the verifier's hash, bound unmutated as the payload");

        // replay: the Safe's nonce moved, so the hash it asks about is not the payload
        vm.expectRevert(SafeLike.InvalidSignature.selector);
        safe.execTransaction(address(hub), 0, call_, sigs);
        bytes32 other = safe.getTransactionHash(address(hub), 0, call_, 0, 1);
        assertSel(r.isValidSignature(other, envelope), FAIL);

        // another Reach of the same holder is another verifyingContract and another tokenId
        uint256 id2 = hub.mint(holder);
        Reach r2 = Reach(payable(hub.account(id2)));
        assertSel(r2.isValidSignature(txHash, envelope), FAIL, "worth nothing on the holder's other Intact");

        // retiring every signature: one bump
        vm.prank(holder);
        r.retireAttestations();
        assertEq(r.attestationNonce(), 1);
        assertSel(r.isValidSignature(txHash, envelope), FAIL, "retired");
        vm.expectRevert(SafeLike.InvalidSignature.selector);
        safe.checkSignatures150(txHash, sigs);

        // and the sale: a new epoch is a new struct
        bytes32 d1 = _digest(account, id, 1, 1, block.chainid, "safe-owner", txHash, deadline);
        address holder1 = ecrecover(d1, V, R, S);
        // (the token cannot be re-pointed at holder1 without a sale, which moves the epoch;
        //  so the check is that the stale holder's bytes do not survive the epoch move)
        vm.prank(holder);
        hub.transferFrom(holder, holder1, id);
        assertSel(r.isValidSignature(txHash, _envelope("safe-owner", txHash, deadline, S)), FAIL, "sold on");

        // the deadline is signed, and it is a wall
        vm.warp(deadline + 1);
        assertSel(r.isValidSignature(txHash, envelope), FAIL);
    }

    function test_aSessionKeyNeverSigns() public {
        (uint256 id, address account) = _next();
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 payload = keccak256("a statement");
        bytes32 d = _digest(account, id, 1, 0, block.chainid, "who i am", payload, deadline);
        address holder = ecrecover(d, V, R, S);
        address key = ecrecover(d, V, R, S2);          // (R, S2, V) is THIS address's signature over d
        assertTrue(key != holder && key != address(0));
        hub.mint(holder);
        Reach r = Reach(payable(account));

        assertSel(r.isValidSignature(d, _envelope("who i am", payload, deadline, S)), MAGIC, "the holder's signature is the voice");
        vm.prank(holder);
        r.grantSession(key, deadline, 0, _noCaps(), _addrs(address(gold)), _sels(XFER), 0, 0);
        assertTrue(r.sessionCurrent(key));
        assertSel(r.isValidSignature(d, _envelope("who i am", payload, deadline, S2)), FAIL, "a live session key's signature is not");
        assertSel(r.isValidSigner(key, ""), bytes4(0));
        assertSel(r.isValidSigner(holder, ""), r.isValidSigner.selector);

        // a session key that is a contract and says yes to everything is never asked
        YesSigner yes = new YesSigner();
        vm.prank(holder);
        r.grantSession(address(yes), deadline, 0, _noCaps(), _addrs(address(gold)), _sels(XFER), 0, 0);
        assertSel(r.isValidSignature(d, abi.encode("who i am", payload, deadline, hex"deadbeef")), FAIL);
    }

    function test_aSignatureFromOneBandIsInvalidOnAnother() public {
        (uint256 id, address account) = _next();
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 payload = keccak256("a statement");
        bytes32 d = _digest(account, id, 1, 0, block.chainid, "band", payload, deadline);
        address holder = ecrecover(d, V, R, S);
        hub.mint(holder);
        Reach r = Reach(payable(account));
        bytes memory envelope = _envelope("band", payload, deadline, S);
        assertSel(r.isValidSignature(d, envelope), MAGIC);

        // the domain carries the chain: the same bytes on another band recover to a stranger
        assertEq(r.domainSeparator(), keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("INTACT_ATTESTATION"), keccak256("1"), block.chainid, account)));
        bytes32 dOther = _digest(account, id, 1, 0, block.chainid + 1, "band", payload, deadline);
        assertTrue(dOther != d);
        assertTrue(ecrecover(dOther, V, R, S) != holder, "another band's digest is somebody else's signature");
        assertSel(r.isValidSignature(dOther, envelope), FAIL, "and the account will not answer for it");

        // the struct carries the epoch and the token: both are in the digest
        assertTrue(_digest(account, id, 2, 0, block.chainid, "band", payload, deadline) != d);
        assertTrue(_digest(account, id + 1, 1, 0, block.chainid, "band", payload, deadline) != d);
        assertTrue(_digest(account, id, 1, 1, block.chainid, "band", payload, deadline) != d);
    }

    function test_theProbeAnswersAndGarbageIsAPlainNo() public {
        (uint256 id, address account) = _next();
        hub.mint(alice);
        Reach r = Reach(payable(account));
        id;
        assertSel(r.isValidSignature(PROBE, ""), bytes4(0x77390001), "the ERC-7739 capability probe");
        assertSel(r.isValidSignature(PROBE, hex"00"), FAIL);
        assertSel(r.isValidSignature(keccak256("x"), ""), FAIL);
        assertSel(r.isValidSignature(keccak256("x"), hex"deadbeef"), FAIL);
        // a well-formed head whose offsets point past the blob
        assertSel(r.isValidSignature(keccak256("x"), abi.encodePacked(uint256(4096), bytes32(0), uint256(0), uint256(128))), FAIL);
        assertSel(r.isValidSignature(keccak256("x"), abi.encodePacked(uint256(128), bytes32(0), uint256(0), uint256(4096))), FAIL);
        // and the legacy shape is a plain no too
        assertSel(r.isValidSignature(bytes("hello"), hex"deadbeef"), FAIL);
    }

    function test_aSealedAccountCannotSignAVenueOrder() public {
        (uint256 id, address account) = _next();
        uint64 deadline = uint64(block.timestamp + 1 days);
        bytes32 orderHash = keccak256("Seaport order, under Seaport's domain");
        bytes32 d = _digest(account, id, 1, 0, block.chainid, "an order", orderHash, deadline);
        address holder = ecrecover(d, V, R, S);
        hub.mint(holder);
        Reach r = Reach(payable(account));
        bytes memory envelope = _envelope("an order", orderHash, deadline, S);

        assertSel(r.isValidSignature(orderHash, envelope), MAGIC, "unsealed, the account stands behind a venue's hash");
        vm.prank(holder);
        r.seal(uint64(block.timestamp + 30 days));
        assertSel(r.isValidSignature(orderHash, envelope), FAIL, "sealed, it is arithmetically incapable");
        assertSel(r.isValidSignature(d, envelope), MAGIC, "but it can still say who it is");
        assertSel(r.isValidSignature(bytes32(0), abi.encodePacked(R, S, V)), FAIL, "and a raw signature over anything is nothing");
    }
}
