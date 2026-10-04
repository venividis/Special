// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  ERC721Minimal — ownership, balances and the per-owner index, as a library
  over one storage struct

  Origin: hand-rolled from IPSEITY src/Ipseity.sol `_add` / `_remove` /
  `ownerOf` / `balanceOf` / `tokenOfOwnerByIndex` (lines 945-1043). No
  OpenZeppelin, no Solady: the whole of what an ERC-721 stores is five
  mappings, and the swap-and-pop index is twelve lines.

  Why a library over a struct rather than an abstract contract: the hub
  exists in two builds, and in the diamond build no facet may declare a
  plain state variable — every slot is ERC-7201 namespaced. A base contract
  with `mapping ... _ownerOf` would put slot 0 under every facet. So the
  storage is a struct the hub embeds as the FIRST member of its namespaced
  `Layout` (DESIGN.md §4.2 lists exactly these five mappings in exactly
  this order), and the functions take that struct. The slot layout is
  identical to the flat listing; only the spelling differs.

  What is deliberately not here: approvals-for-all (the hub's are keyed by
  an epoch and live beside this, in `Layout`), transfer authorisation (the
  hub's `_update` is sealed and does its own), events (the hub emits them
  so the two builds log from one definition), and burn (there is none).
───────────────────────────────────────────────────────────────────────────*/

interface IERC721ReceiverMinimal {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external returns (bytes4);
}

library ERC721Minimal {
    struct Store {
        mapping(uint256 => address) owner;
        mapping(address => uint256) balance;
        mapping(address => mapping(uint256 => uint256)) ownedAt;    // owner → index → id
        mapping(uint256 => uint256) ownedIndex;                     // id → index in its owner's list
        mapping(uint256 => address) approved;                       // the single ERC-721 approval
    }

    error NoSuchToken();
    error ZeroAddress();
    error BadIndex();
    error WrongReceiver();

    /*═══════════════════ reading ═══════════════════*/

    function ownerOf(Store storage s, uint256 id) internal view returns (address o) {
        o = s.owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function balanceOf(Store storage s, address a) internal view returns (uint256) {
        if (a == address(0)) revert ZeroAddress();
        return s.balance[a];
    }

    function tokenOfOwnerByIndex(Store storage s, address o, uint256 i) internal view returns (uint256) {
        if (i >= s.balance[o]) revert BadIndex();
        return s.ownedAt[o][i];
    }

    function exists(Store storage s, uint256 id) internal view returns (bool) {
        return s.owner[id] != address(0);
    }

    /*═══════════════════ enumeration bookkeeping ═══════════════════*/

    function add(Store storage s, address to, uint256 id) internal {
        uint256 n = s.balance[to];
        s.ownedAt[to][n] = id;
        s.ownedIndex[id] = n;
        unchecked { s.balance[to] = n + 1; }
        s.owner[id] = to;
    }

    function remove(Store storage s, address from, uint256 id) internal {
        uint256 n;
        unchecked { n = s.balance[from] - 1; }
        uint256 i = s.ownedIndex[id];
        if (i != n) {
            uint256 moved = s.ownedAt[from][n];
            s.ownedAt[from][i] = moved;
            s.ownedIndex[moved] = i;
        }
        delete s.ownedAt[from][n];
        delete s.ownedIndex[id];
        s.balance[from] = n;
    }

    /// @notice The bare move: index out of `from` (when there is one), index
    ///         into `to`, clear the single approval. No authorisation, no
    ///         events, no callback — the hub's sealed `_update` owns those.
    function move(Store storage s, address from, address to, uint256 id) internal {
        if (to == address(0)) revert ZeroAddress();
        if (from != address(0)) remove(s, from, id);
        add(s, to, id);
        delete s.approved[id];
    }

    /// @notice The ERC-721 receiver check, for the hub to run LAST in a mint
    ///         or a safe transfer — after every write, so a contract that
    ///         re-enters from the callback sees a complete token.
    function checkOnERC721Received(address operator, address from, address to, uint256 id, bytes memory data)
        internal
    {
        if (to.code.length == 0) return;
        if (IERC721ReceiverMinimal(to).onERC721Received(operator, from, id, data)
            != IERC721ReceiverMinimal.onERC721Received.selector) revert WrongReceiver();
    }
}
