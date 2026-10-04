// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  SafeLike — the contract-signature path of Safe 1.4.1 and 1.5.0, for the
  Reach to be tested as an owner against (INTACT U2, NEW; a fixture)

  Two things are copied faithfully from Safe, because they are the whole
  point of the test:

    · the transaction hash: `SafeTx(...)` under a domain of
      `EIP712Domain(uint256 chainId,address verifyingContract)`, as bytes
      (`encodeTransactionData`) and as its keccak;
    · the contract-signature layout of `checkNSignatures`: r = the owner
      address, s = the offset of the dynamic part, v = 0, and at that
      offset a length word followed by the owner's own signature bytes.

  Safe 1.3.0 and 1.4.1 then call the LEGACY ERC-1271 shape,
  `isValidSignature(bytes data, bytes sig)` expecting `0x20c13b0b`, with
  `data` the 66-byte `encodeTransactionData`; Safe 1.5.0 calls
  `isValidSignature(bytes32 hash, bytes sig)` expecting `0x1626ba7e`. Both
  shapes are here, so the Reach's answer is tested under each.
───────────────────────────────────────────────────────────────────────────*/
interface IValidatorLegacy {
    function isValidSignature(bytes memory data, bytes memory signature) external view returns (bytes4);
}
interface IValidator {
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4);
}

contract SafeLike {
    error NotContractSignature();
    error NotOwner();
    error BadOffset();
    error InvalidSignature();

    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");
    bytes32 private constant SAFE_TX_TYPEHASH = keccak256(
        "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
    );
    bytes4 private constant LEGACY_MAGIC = 0x20c13b0b;
    bytes4 private constant MAGIC = 0x1626ba7e;

    uint256 public nonce;
    mapping(address => bool) public isOwner;

    constructor(address owner_) {
        isOwner[owner_] = true;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, block.chainid, address(this)));
    }

    function encodeTransactionData(address to, uint256 value, bytes memory data, uint8 operation, uint256 _nonce)
        public view returns (bytes memory)
    {
        bytes32 safeTxHash = keccak256(abi.encode(
            SAFE_TX_TYPEHASH, to, value, keccak256(data), operation, 0, 0, 0, address(0), address(0), _nonce));
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator(), safeTxHash);
    }

    function getTransactionHash(address to, uint256 value, bytes memory data, uint8 operation, uint256 _nonce)
        public view returns (bytes32)
    {
        return keccak256(encodeTransactionData(to, value, data, operation, _nonce));
    }

    /// @dev One contract signature, split as Safe splits it.
    function _split(bytes memory signatures) private pure returns (address owner_, uint256 offset, bytes memory inner) {
        uint8 v; bytes32 r; bytes32 s;
        assembly {
            r := mload(add(signatures, 0x20))
            s := mload(add(signatures, 0x40))
            v := byte(0, mload(add(signatures, 0x60)))
        }
        if (v != 0) revert NotContractSignature();
        owner_ = address(uint160(uint256(r)));
        offset = uint256(s);
        if (offset < 65 || offset + 32 > signatures.length) revert BadOffset();
        uint256 len;
        assembly { len := mload(add(add(signatures, offset), 0x20)) }
        if (offset + 32 + len > signatures.length) revert BadOffset();
        inner = new bytes(len);
        for (uint256 i; i < len; ++i) inner[i] = signatures[offset + 32 + i];
    }

    /// @notice Safe 1.4.1: `checkNSignatures(dataHash, data, signatures, 1)`
    ///         for a contract owner — the legacy bytes shape.
    function checkSignatures141(bytes memory data, bytes memory signatures) public view {
        (address owner_, , bytes memory inner) = _split(signatures);
        if (!isOwner[owner_]) revert NotOwner();
        if (IValidatorLegacy(owner_).isValidSignature(data, inner) != LEGACY_MAGIC) revert InvalidSignature();
    }

    /// @notice Safe 1.5.0: the same check through `isValidSignature(bytes32, bytes)`.
    function checkSignatures150(bytes32 dataHash, bytes memory signatures) public view {
        (address owner_, , bytes memory inner) = _split(signatures);
        if (!isOwner[owner_]) revert NotOwner();
        if (IValidator(owner_).isValidSignature(dataHash, inner) != MAGIC) revert InvalidSignature();
    }

    /// @notice The 1.4.1 execution path: hash with the CURRENT nonce, bump it,
    ///         check. A replayed signature meets a different hash.
    function execTransaction(address to, uint256 value, bytes calldata data, bytes calldata signatures)
        external returns (bool)
    {
        bytes memory txData = encodeTransactionData(to, value, data, 0, nonce);
        nonce += 1;
        checkSignatures141(txData, signatures);
        return true;
    }

    /// @notice Builds the contract-signature blob for `owner_` the way a
    ///         Safe client does: r = owner, s = 65, v = 0, then len ‖ sig.
    function contractSignature(address owner_, bytes memory inner) external pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(owner_))), bytes32(uint256(65)), uint8(0), inner.length, inner);
    }
}
