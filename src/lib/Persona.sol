// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Rights} from "./Rights.sol";

/*───────────────────────────────────────────────────────────────────────────
  Persona — any ERC-721 token as one word: who it is, who acts as it, and
  who is paid for it

  V2 (docs/V2.md §3.4-3.5). Agora speaks, follows and reacts as a persona;
  the Studio launches a collection from one; a Collection pays its creator
  and its referrers as personas. A persona is one token of one ERC-721
  packed into a uint256, the collection in the high 160 bits and the id in
  the low 96:

      persona = uint256(uint160(collection)) << 96 | id

  It reverses with no registry and no hash, so every event that carries a
  persona carries the token. An id at or above 2^96, or the zero
  collection, is not a persona (NotAPersona): hash-id collections, ENS
  names among them, speak through a token whose id is small.

  The three questions every V2 contract asks about a persona are answered
  here, once, so no contract spells them differently:

  - actsFor(hub, p, who) — the hub's `acts` for a hub token (its holder or
    its canonical Reach, never a renter, an operator or a session key
    directly); `holds` for any other collection, read by a guarded
    staticcall, where no code, a revert or a short answer is "no".
  - payeeOf(hub, p) — for a hub token `feeSink(id)` (its Reach, or its Grip
    when the holder chose so), else `account(id)`; for any other token its
    holder; address(0) when nobody can be named. Money is paid to the
    payee at the moment it is paid, so it follows the token.
  - stampOf(p) — keccak256(abi.encode(holder, epoch)): the bucket a
    cooldown, a key binding or any delegated thing is keyed by, so a sale
    silences the seller. The epoch is `custodyEpoch(id)` where the
    collection answers it (the hub, every Studio collection), else 0, and
    then the holder alone moves the stamp.

  A collection that lies about `ownerOf` can only lie about its own
  personas: every answer here is about the collection that gave it.

  Origin: NEW for INTACT V2.
───────────────────────────────────────────────────────────────────────────*/
library Persona {
    error NotAPersona(address collection, uint256 id);

    uint256 internal constant ID_BITS = 96;
    uint256 internal constant ID_MASK = (uint256(1) << 96) - 1;

    function pack(address collection, uint256 id) internal pure returns (uint256) {
        if (collection == address(0) || id > ID_MASK) revert NotAPersona(collection, id);
        return (uint256(uint160(collection)) << ID_BITS) | id;
    }

    function split(uint256 p) internal pure returns (address collection, uint256 id) {
        collection = address(uint160(p >> ID_BITS));
        id = p & ID_MASK;
    }

    /// @notice The token's holder, or address(0) when the collection will
    ///         not name one.
    function holderOf(uint256 p) internal view returns (address) {
        (address c, uint256 id) = split(p);
        return _word(c, abi.encodeWithSignature("ownerOf(uint256)", id));
    }

    function actsFor(address hub, uint256 p, address who) internal view returns (bool) {
        if (who == address(0)) return false;
        (address c, uint256 id) = split(p);
        if (c == address(0)) return false;
        if (c == hub) return Rights.acts(hub, id, who);
        return holderOf(p) == who;
    }

    function payeeOf(address hub, uint256 p) internal view returns (address) {
        (address c, uint256 id) = split(p);
        if (c == address(0)) return address(0);
        if (c != hub) return holderOf(p);
        if (holderOf(p) == address(0)) return address(0);   // no such token
        address sink = _word(hub, abi.encodeWithSignature("feeSink(uint256)", id));
        return sink != address(0) ? sink : _word(hub, abi.encodeWithSignature("account(uint256)", id));
    }

    function epochOf(uint256 p) internal view returns (uint64) {
        (address c, uint256 id) = split(p);
        if (c.code.length == 0) return 0;
        (bool ok, bytes memory ret) = c.staticcall(abi.encodeWithSignature("custodyEpoch(uint256)", id));
        if (!ok || ret.length < 32) return 0;
        uint256 e = abi.decode(ret, (uint256));
        return e > type(uint64).max ? 0 : uint64(e);
    }

    function stampOf(uint256 p) internal view returns (bytes32) {
        return keccak256(abi.encode(holderOf(p), epochOf(p)));
    }

    /// @dev One address-shaped word from a guarded staticcall: no code, a
    ///      revert, a short answer or a word with high bits set is zero.
    function _word(address target, bytes memory data) private view returns (address a) {
        if (target.code.length == 0) return address(0);
        (bool ok, bytes memory ret) = target.staticcall(data);
        if (!ok || ret.length < 32) return address(0);
        uint256 w = abi.decode(ret, (uint256));
        if (w >> 160 != 0) return address(0);
        a = address(uint160(w));
    }
}
