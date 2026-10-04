// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IKeyRegistry, KeyRecord} from "./interfaces/IKeyRegistry.sol";

/*───────────────────────────────────────────────────────────────────────────
  KeyRegistry — where an address publishes the public key that sealed
  content should be encrypted to

  Origin: ANIMA contracts/core/EncryptionKeyRegistry.sol, verbatim in
  behaviour (INTACT U4). Three things were added and nothing was removed:
  `KEY_TYPE_MLS = 5` (the v2 sealed-group scheme, reserved now so the
  number is never reused), `BadKeyType` for a key type of zero (zero is
  what an unset record reads back as, so a published key of type zero
  would be indistinguishable from no key), and the ERC-7627-shaped
  `getPublicKeys` view — a shape, not a conformance claim; ERC-7627 is a
  messaging protocol and this is its directory half only.

  A blockchain address is a hash, not a public key. You cannot encrypt to
  it, and a smart-account holder may have no recoverable encryption key at
  all. Every design that promises "the buyer receives the decryption key on
  transfer" has to solve this first, and most don't — which is how NFTs get
  sold with private state the buyer can never open.

  This registry is deliberately a standalone singleton rather than state on
  the token: a key is a property of a *person*, not of any one collection,
  so registering once should serve every deployment on the chain. The
  token-level binding — "this token's holder seals with this key, for as
  long as they hold it" — is Parley's `bindKey`, which records the holder
  and the custody epoch and answers only while both are unchanged.

  The registry is intentionally unopinionated about the key's cryptosystem
  — X25519, secp256k1 ECIES, P-256, a post-quantum KEM — because the two
  clients that seal and open are what must agree on it, not this contract.
  `keyType` names the scheme so they can.
───────────────────────────────────────────────────────────────────────────*/
contract KeyRegistry is IKeyRegistry {
    /// @dev Conventional scheme identifiers. Values above 1000 are free for private use.
    uint16 public constant KEY_TYPE_X25519 = 1;
    uint16 public constant KEY_TYPE_SECP256K1_ECIES = 2;
    uint16 public constant KEY_TYPE_P256_ECIES = 3;
    uint16 public constant KEY_TYPE_ML_KEM_768 = 4;
    uint16 public constant KEY_TYPE_MLS = 5;

    mapping(address account => KeyRecord) private _keys;

    function setEncryptionKey(uint16 keyType, bytes calldata publicKey) external {
        if (publicKey.length == 0) revert EmptyKey();
        if (keyType == 0) revert BadKeyType();
        _keys[msg.sender] = KeyRecord({keyType: keyType, updatedAt: uint64(block.timestamp), publicKey: publicKey});
        emit EncryptionKeyRegistered(msg.sender, keccak256(publicKey), keyType);
    }

    /// @notice Withdraw your key. Any sealed send to you will revert until you publish a
    ///         new one, which is the correct failure mode: better to refuse the message
    ///         than to record ciphertext nobody can open.
    function revokeEncryptionKey() external {
        delete _keys[msg.sender];
        emit EncryptionKeyRevoked(msg.sender);
    }

    function keyOf(address account) external view returns (KeyRecord memory) {
        return _keys[account];
    }

    function publicKeyOf(address account) external view returns (bytes memory) {
        return _keys[account].publicKey;
    }

    /// @notice keccak256 of the published key, or zero if none. This is the value a sealing
    ///         client pins as `expectedKeyId`, so a rotation in the mempool fails the send
    ///         instead of recording an undecryptable message.
    function keyIdOf(address account) external view returns (bytes32) {
        bytes memory k = _keys[account].publicKey;
        return k.length == 0 ? bytes32(0) : keccak256(k);
    }

    /// @notice The ERC-7627 directory shape: type, key, and when it was set.
    function getPublicKeys(address account)
        external view returns (uint16 keyType, bytes memory publicKey, uint64 updatedAt)
    {
        KeyRecord storage r = _keys[account];
        return (r.keyType, r.publicKey, r.updatedAt);
    }
}
