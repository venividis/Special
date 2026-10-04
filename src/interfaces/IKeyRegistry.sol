// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IKeyRegistry — where an address publishes the key sealed content is
  encrypted to

  DESIGN.md §7.3; ANIMA EncryptionKeyRegistry.sol verbatim plus the
  ERC-7627-shaped `getPublicKeys` view (a shape, not a conformance claim —
  ERC-7627 is a messaging protocol; this is its directory half only).
  Address-keyed; the token-level binding is Parley's `bindKey`.
───────────────────────────────────────────────────────────────────────────*/

struct KeyRecord {
    uint16 keyType;
    uint64 updatedAt;
    bytes  publicKey;
}

interface IKeyRegistry {
    event EncryptionKeyRegistered(address indexed account, bytes32 indexed keyId, uint16 keyType);
    event EncryptionKeyRevoked(address indexed account);

    error EmptyKey();
    error BadKeyType();

    function KEY_TYPE_X25519() external view returns (uint16);          // 1
    function KEY_TYPE_SECP256K1_ECIES() external view returns (uint16); // 2
    function KEY_TYPE_P256_ECIES() external view returns (uint16);      // 3
    function KEY_TYPE_ML_KEM_768() external view returns (uint16);      // 4 (reserved)
    function KEY_TYPE_MLS() external view returns (uint16);             // 5

    function setEncryptionKey(uint16 keyType, bytes calldata publicKey) external;
    function revokeEncryptionKey() external;
    function keyOf(address account) external view returns (KeyRecord memory);
    function publicKeyOf(address account) external view returns (bytes memory);
    function keyIdOf(address account) external view returns (bytes32);   // keccak256(publicKey), or zero
    function getPublicKeys(address account) external view returns (uint16 keyType, bytes memory publicKey, uint64 updatedAt);
}
