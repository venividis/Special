// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IJournal — memories written into a token (V2, unit W2)

  docs/V2.md §3.2. A memory is a short entry bound to one token,
  `(collection, id)`, of ANY ERC-721: the hub, a Studio collection, or a
  collection from anywhere. Only the token's holder writes — for the hub,
  its holder or its canonical Reach (`acts`), never a renter, an operator
  or a session key directly. A collection whose `ownerOf` has no code,
  reverts or answers short has no holder, and nobody writes into it. A
  collection that lies about `ownerOf` can only pollute its own namespace,
  and the viewer trusts its memories as far as it trusts the collection.

  Bodies live in events. A plain body is UTF-8, 1..MAX_PLAIN bytes. A
  sealed body is P-256 ciphertext to the author's KeyRegistry key,
  1..MAX_SEALED bytes, readable by the author forever and by no later
  holder. `epoch` is the token's custody epoch where the collection answers
  `custodyEpoch(uint256)` (the hub, every Studio collection), else 0.

  Storage keeps a count and a rolling root per token:
    root' = keccak256(abi.encode(root, n, kind, keccak256(body), ref, author, epoch))
  The hub's fingerprint reads `rootOf(HUB, id)` (V2 W6), so a listing pins
  the token's memories and a buyer receives the history they read. `ref`
  binds a memory to what it is about — a trade, a keepsake
  (keccak(Keepsake, id)), a sale — and is the author's claim: the viewer
  marks a TRADE memory "same transaction" only when the receipt that
  carries `Inscribed` also carries the swap it names.

  Frozen after V2 wave 0: additive changes only, recorded in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

interface IJournalEvents {
    event Inscribed(address indexed collection, uint256 indexed id, uint256 indexed n, uint8 kind, address author, uint64 epoch, bytes32 ref, bytes32 root, bytes body);

    error NotYours();
    error Empty();
    error TooLong(uint256 length, uint256 max);
    error UnknownKind(uint8 kind);
    error Reentrancy();
}

interface IJournal is IJournalEvents {
    /// @notice Write a memory into `(collection, id)`. Returns its number,
    ///         counting from 1.
    function inscribe(address collection, uint256 id, uint8 kind, bytes calldata body, bytes32 ref)
        external returns (uint256 n);
    function countOf(address collection, uint256 id) external view returns (uint256);
    function rootOf(address collection, uint256 id) external view returns (bytes32);
    /// @notice Whether `who` may write into `(collection, id)` now.
    function mayInscribe(address collection, uint256 id, address who) external view returns (bool);

    /// @notice The kinds. SEALED is the only kind whose body is ciphertext.
    function NOTE() external pure returns (uint8);       // 0
    function TRADE() external pure returns (uint8);      // 1
    function GIFT() external pure returns (uint8);       // 2
    function MILESTONE() external pure returns (uint8);  // 3
    function SEALED() external pure returns (uint8);     // 4

    function MAX_PLAIN() external pure returns (uint256);   // 1,024
    function MAX_SEALED() external pure returns (uint256);  // 4,096
    function HUB() external view returns (address);
}
