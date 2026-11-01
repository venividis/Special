// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IJournal} from "./interfaces/IJournal.sol";
import {Rights} from "./lib/Rights.sol";
import {Transient} from "./lib/Transient.sol";

/// @dev The one question the Journal asks a collection beyond `ownerOf`.
///      The hub answers it (the epoch every sale and every panic moves), so
///      does every Studio collection; a collection from elsewhere may not.
interface IJournalCustody {
    function custodyEpoch(uint256 id) external view returns (uint64);
}

/*═══════════════════════════════════════════════════════════════════════════

  JOURNAL — memories written into a token

  NEW for INTACT V2 (unit W2; docs/V2.md §3.2; the frozen surface is
  src/interfaces/IJournal.sol, and every comment there binds this file).

  A token that has been somewhere has a story, and today the story lives
  in a marketplace's database: the note under the listing, the line the
  first owner wrote, the reason it was never sold. Sell the token and the
  story stays behind with the account that wrote it; turn the database off
  and it was never there. This contract writes the story into the token
  instead. A memory is a log keyed by `(collection, id)`, and the log is
  wherever the chain is.

  ── who writes ──

  For the hub, `acts`: the holder or the token's own Reach — the token
  acting for itself, which is how "swap, lock, inscribe" becomes one
  batch. For any other ERC-721, `holds`: its holder alone. Both words are
  Rights', so the Journal means "holder" exactly as Parley, the Steward and
  the Market mean it. Never the renter: a lease buys the instrument's use
  for a while, and a memory is written in the token's name and outlives the
  lease. Never an approved operator: an approval is permission to move the
  token, and a phished one must not also be a pen. A session key writes
  only AS the Reach, through the Reach's own checks.

  A foreign collection's `account(id)`, should it have one, is not asked.
  The hub's Reach is canonical by CREATE2 and codehash; anybody else's is
  a word.

  ── any ERC-721, and the one that lies ──

  The Journal takes any collection, registered or not, because memories on
  every NFT are the provenance V2 is about (§5.6). `ownerOf` is asked
  through a guarded staticcall, so a collection with no code, one that
  reverts and one that answers short have no holder, and nobody writes
  into them. A collection that lies about `ownerOf` — "everyone holds token
  1" — is believed, but only about itself: pages are keyed by
  `(collection, id)`, so a liar fills its own namespace and no other. The
  viewer trusts a memory as far as it trusts the collection it is in.

  ── the root, which is why no body is stored ──

  Storage keeps two words per token: how many memories it has, and a
  rolling root over them,

      root' = keccak256(abi.encode(root, n, kind, keccak256(body), ref, author, epoch))

  The body lives only in the `Inscribed` log. Whoever holds the logs folds
  them into a root and compares it with `rootOf`, so a log an indexer
  dropped, edited or reordered fails the comparison and the archive needs
  no trusted copy. The hub's fingerprint reads `rootOf(HUB, id)` (V2 W6): a
  listing pins the memories its buyer read, and a memory written after the
  order was signed breaks the order instead of slipping into the sale.

  ── the epoch ──

  Each memory carries the custody epoch it was written under, so a reader
  tells one custody from the next even when an address comes back (a
  buy-back is a new epoch, and so is a panic). The hub's epoch is read with
  a typed call: the hub is the one address this contract trusts, and a hub
  that cannot answer must stop the write rather than record a zero no hub
  token ever had. A foreign collection's `custodyEpoch(uint256)` is read
  through a guarded staticcall, where no code, a revert, a short answer or
  a word wider than 64 bits is 0: "this collection keeps no epoch".

  ── sealed ──

  A SEALED body is ciphertext its author sealed to their own KeyRegistry
  key before it reached the chain (the console's P-256 envelope). The
  contract checks its length and nothing else, because it cannot read it
  and must not need to. The key is the author's, not the token's, so a
  sale passes the page to the buyer and not the means to open it. An
  envelope carries a point, a salt and two copies, so it is allowed four
  times the room of a plain body.

  ── what is not here ──

  No function edits, hides or deletes a memory, and there is no admin to
  add one. The questions `inscribe` asks a collection are static calls, so
  none of them can write; the registered lock is held around them anyway,
  so a collection that calls back into `inscribe` from inside its `ownerOf`
  meets `Reentrancy()` by name.

═══════════════════════════════════════════════════════════════════════════*/
contract Journal is IJournal {
    /// @notice The hub: the one collection whose Reach writes for its tokens
    ///         and whose custody epoch is read without a guard.
    address public immutable HUB;

    /*───────────────────── shape ─────────────────────*/

    uint8 private constant _NOTE      = 0;
    uint8 private constant _TRADE     = 1;
    uint8 private constant _GIFT      = 2;
    uint8 private constant _MILESTONE = 3;
    uint8 private constant _SEALED    = 4;   // the only kind whose body is ciphertext

    /// @dev Long enough for something worth saying, short enough that a log
    ///      is a log — Parley's bounds, so one envelope fits both.
    uint256 private constant _MAX_PLAIN  = 1024;
    uint256 private constant _MAX_SEALED = 4096;

    /// @dev Two words per token: the number of its newest memory, and the
    ///      root folded over every memory in order. Nothing else is kept.
    struct Page {
        uint256 count;
        bytes32 root;
    }

    mapping(address collection => mapping(uint256 id => Page)) private _pages;

    constructor(address hub) {
        HUB = hub;
    }

    /*═══════════════════ writing ═══════════════════*/

    /// @notice Write a memory into `(collection, id)`; returns its number,
    ///         counting from 1. The body is in the `Inscribed` log only.
    function inscribe(address collection, uint256 id, uint8 kind, bytes calldata body, bytes32 ref)
        external returns (uint256 n)
    {
        Transient.enter(Transient.JOURNAL_LOCK);
        if (!mayInscribe(collection, id, msg.sender)) revert NotYours();
        if (kind > _SEALED) revert UnknownKind(kind);
        if (body.length == 0) revert Empty();
        uint256 max = kind == _SEALED ? _MAX_SEALED : _MAX_PLAIN;
        if (body.length > max) revert TooLong(body.length, max);

        uint64 epoch = _epochOf(collection, id);
        Page storage p = _pages[collection][id];
        unchecked { n = p.count + 1; }          // a uint256 of memories does not wrap
        p.count = n;
        bytes32 root = keccak256(abi.encode(p.root, n, kind, keccak256(body), ref, msg.sender, epoch));
        p.root = root;

        emit Inscribed(collection, id, n, kind, msg.sender, epoch, ref, root, body);
        Transient.exit(Transient.JOURNAL_LOCK);
    }

    /*═══════════════════ reading ═══════════════════*/

    function countOf(address collection, uint256 id) external view returns (uint256) {
        return _pages[collection][id].count;
    }

    /// @notice The rolling root over every memory of `(collection, id)`;
    ///         zero before the first. What the hub's fingerprint reads.
    function rootOf(address collection, uint256 id) external view returns (bytes32) {
        return _pages[collection][id].root;
    }

    /// @notice Whether `who` may write into `(collection, id)` now: for the
    ///         hub its holder or its Reach, for any other collection its
    ///         holder, as that collection's own guarded `ownerOf` names it.
    function mayInscribe(address collection, uint256 id, address who) public view returns (bool) {
        return collection == HUB ? Rights.acts(HUB, id, who) : Rights.holds(collection, id, who);
    }

    /// @dev The kinds and the bounds as the interface's pure functions, so
    ///      the ABI says `pure` where IJournal does (a public constant's
    ///      getter compiles as `view`).
    function NOTE() external pure returns (uint8) { return _NOTE; }
    function TRADE() external pure returns (uint8) { return _TRADE; }
    function GIFT() external pure returns (uint8) { return _GIFT; }
    function MILESTONE() external pure returns (uint8) { return _MILESTONE; }
    function SEALED() external pure returns (uint8) { return _SEALED; }
    function MAX_PLAIN() external pure returns (uint256) { return _MAX_PLAIN; }
    function MAX_SEALED() external pure returns (uint256) { return _MAX_SEALED; }

    /*═══════════════════ internals ═══════════════════*/

    /// @dev The custody epoch a memory is written under. `Persona.epochOf`
    ///      asks the same question of a packed persona, but a page here is
    ///      any `(collection, id)`, ids at or above 2^96 included (an ENS
    ///      name's id is a hash), so the guarded read is spelled out with
    ///      the same rules: no code, a revert, a short answer or a word over
    ///      64 bits is 0.
    function _epochOf(address collection, uint256 id) private view returns (uint64) {
        if (collection == HUB) return IJournalCustody(HUB).custodyEpoch(id);
        (bool ok, bytes memory ret) = collection.staticcall(abi.encodeCall(IJournalCustody.custodyEpoch, (id)));
        if (!ok || ret.length < 32) return 0;
        uint256 word = abi.decode(ret, (uint256));
        return word > type(uint64).max ? 0 : uint64(word);
    }
}
