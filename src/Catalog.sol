// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIntact, Core, Traits} from "./interfaces/IIntact.sol";
import {IPool, Market} from "./interfaces/IPool.sol";
import {IReach} from "./interfaces/IReach.sol";
import {IParley} from "./interfaces/IParley.sol";
import {IPostage, Inbox} from "./interfaces/IPostage.sol";
import {ILocks} from "./interfaces/ILocks.sol";
import {ILaunchpad} from "./interfaces/ILaunchpad.sol";
import {ISteward} from "./interfaces/ISteward.sol";
import {IRouter, VenueInfo} from "./interfaces/IRouter.sol";
import {IRoles} from "./interfaces/IRoles.sol";
import {IKeyRegistry} from "./interfaces/IKeyRegistry.sol";
import {IKiln} from "./interfaces/IKiln.sol";
import {IMarket} from "./interfaces/IMarket.sol";
import {IKeepsake} from "./interfaces/IKeepsake.sol";
import {IJournal} from "./interfaces/IJournal.sol";
import {IBazaar} from "./interfaces/IBazaar.sol";
import {IBridges} from "./interfaces/IBridges.sol";
import {IStudio} from "./interfaces/IStudio.sol";
import {IAgora} from "./interfaces/IAgora.sol";
import {IEngine, IAgentCard, TokenState} from "./interfaces/Site.sol";
import {SSTORE2} from "./lib/SSTORE2.sol";
import {LibNum} from "./lib/LibNum.sol";
import {Web} from "./lib/Web.sol";

/// @dev The one question the Catalog asks band 0's ENS resolver (U18,
///      `src/Nameplate.sol`): does it answer at all. Declared here and not
///      in `src/interfaces/` because nothing else asks it.
interface INameplateProbe {
    function APEX() external view returns (bytes32);
}

/*═══════════════════════════════════════════════════════════════════════════

  CATALOG — one call, and it cannot revert on you

  Origin: IPSEITY src/ConsoleRead.sol (the `reported` bits), src/Desk.sol
  (`_sel`: every selector the browser sends, computed on chain) and
  src/PageManifest.sol (the services half), folded into one surface for
  INTACT U7 (DESIGN.md §3 row 12, §5.1, §5.5, §10).

  The shell renders in a single response. That response reads the hub and
  then a dozen satellites, and the satellites are the problem: this
  collection is deployed on three bands and no two of them carry the same
  set. A Router exists on Base and does not on a fresh testnet. A Market
  is post-MVB and its address is a prediction until U15 lands.

  A page that reads them directly does not degrade on those chains. It
  REVERTS — one absent contract and the whole document is a 500, and the
  holder is told nothing at all about the token in front of them because a
  service they were not asking about is missing.

  So every satellite read is wrapped, and a wrapped read that fails is
  recorded as failed rather than as empty. That distinction is the entire
  reason this contract exists:

      a clear bit means NOBODY ANSWERED
      a set bit with a zero value means THE ANSWER WAS ZERO

  The shell prints those differently — "not reported" against "0" —
  because they are different facts and a holder deciding whether to trust
  a number needs to know which one they are looking at.

  `try` is not enough on its own, and finding that out is the reason the
  donor had a test. Solidity inserts an `extcodesize` check before any
  external call that returns data, and that check reverts BEFORE the call
  is made — so it is not the call failing, and `catch` never sees it.
  Every read here is a raw staticcall behind an explicit code-length
  check, and the answer is decoded by hand against its expected length.

  ── what is still not shipped to the browser ──

  No ABI coder and no keccak-256 for the calldata the shell builds. Every
  selector, every custom-error selector and every event topic the panels
  need is computed on chain from a signature table (`CatalogText`) and
  arrives in the state gap beside the addresses. The client's whole
  encoding job is padding a number to thirty-two bytes, and a visitor can
  read every selector in the page source and check it against the ABI.
  The same table renders `services.json` for a program (DESIGN §10): the
  manifest cannot drift from what the site sends because it is not a
  second source of truth — it is the same table, serialised differently,
  and `catalogHash()` is the keccak of that serialisation so an MCP bridge
  can refuse a catalog that is not this one.

  ── three contracts, and why ──

  The first draft of this file was one contract and measured 54,023
  bytes of runtime; with the tables moved out of the code, 36,159; with
  the values in memory arrays, 28,164; with the values packed by one
  `abi.encode`, 22,928. Under viaIR every site that formats a value,
  decodes a getter or fills a template costs 40–170 bytes, and the state
  block has a hundred of them, so the surface is three contracts that one
  deployer deploys in turn and nobody else ever addresses:

      Catalog        the immutables, the gather (`stateOf`), the façade
      CatalogRows    the service table, rendered ONCE at construction
                     into SSTORE2 shards: the `sel` map and the rows
                     (CatalogRowsPost and CatalogRowsV2 are two more
                     tables of the same shape, each its own transaction)
      CatalogText    the error and event tables, likewise; the routes,
                     the bands, `services.json` assembled from them
      CatalogState   every JSON skeleton as a TEMPLATE with typed markers
                     (\x01 address, \x02 number, \x03 bool, \x04 bytes)
                     filled by one loop, and the satellite sub-objects

  The words a template needs arrive as ONE `abi.encode` (a run of plain
  MSTOREs, nothing checked) and the bytes as a list. The companions are
  deployed before the Catalog, which pins them: a Catalog whose
  constructor created them carried their init codes inside its own and
  measured 53,268 bytes of initcode, over EIP-3860's 49,152.

  ── V2 (wave 2, W6) ──

  The world learns the seven V2 contracts (keepsake, journal, bazaar,
  bridges, studio, agora, and seaport, a venue), `stateOf` probes the six
  that are satellites under bits 8192..262144, and their rows go in a
  THIRD table, CatalogRowsV2, its own transaction, so neither existing
  table's construction grows (the MVB table renders at 89 % of the 2^24
  cap). The V2 letters: V keepsake (the vault's bundle), J journal,
  B bazaar, b bridges (the Timelock's door record, beside the Bazaar in
  W3), Z studio, c a
  collection (a per-address family, as C is a coin, zero in the table's
  addresses), F agora (the forum). B, F, J, V and Z were the free capitals
  of HPRYTSKNLCOWXEGQMDAUI; the two lower-case letters extend the
  alphabet, and `word()` names every letter of both.

  ── the escaping rule ──

  The state block is written into a `<script>` in the gap between the
  engine's head and body, and it is served raw as `/token/<id>/state.json`.
  Every string from chain or from a holder — an ERC-20 symbol on a market
  the holder chose, the `name` trait — passes `Web.jsonEsc`, which escapes
  `<` and `>` as well as the two characters JSON requires, so a coin whose
  symbol is `</script>` cannot end the block. The keys are all quoted, so
  the block is valid JSON and a valid JavaScript object literal at once.

═══════════════════════════════════════════════════════════════════════════*/

/// @notice What every page needs about the world, built once by the
///         Catalog from its immutables and the hub's.
struct World {
    uint256 id;
    uint256 band;
    uint256 bandLo;
    uint256 bandHi;
    address hub;
    address router;
    address roster;
    address postage;
    address keys;
    address kiln;
    address catalog;
    address engine;
    address agentCard;
    address nameplate;      // band 0's ENS resolver; a codeless pin elsewhere
    address[14] h;          // the hub's immutables, in H_ order
    // V2 (wave 2, W6): the V2 contracts the hub does not pin
    address bazaar;
    address bridges;
    address studio;
    address agora;
    address seaport;        // a venue, not a satellite: an address and no bit
}

/// @dev The hub's immutables, in the order `Catalog._hub()` reads them.
library H {
    uint256 internal constant REACH_IMPL = 0;
    uint256 internal constant GRIP_IMPL = 1;
    uint256 internal constant POOL = 2;
    uint256 internal constant PARLEY = 3;
    uint256 internal constant LAUNCHPAD = 4;
    uint256 internal constant LOCKS = 5;
    uint256 internal constant STEWARD = 6;
    uint256 internal constant MARKET = 7;
    uint256 internal constant ROLES = 8;
    uint256 internal constant TIMELOCK = 9;
    uint256 internal constant PREMISES = 10;
    uint256 internal constant RENDERER = 11;
    uint256 internal constant KEEPSAKE = 12;    // V2 (W6)
    uint256 internal constant JOURNAL = 13;     // V2 (W6)
}

/*───────────────────────────────────────────────────────────────────────────
  Template filling and guarded reads, shared by the two renderers.
───────────────────────────────────────────────────────────────────────────*/
abstract contract Templated {
    using LibNum for uint256;

    error BufferOverflow();
    error TemplateMismatch();

    /// @dev One loop, one site per kind of value. The words are an
    ///      `abi.encode` in marker order; the bytes a list in marker order.
    function _fill(bytes memory tpl, bytes memory W, bytes[] memory B) internal pure returns (bytes memory o) {
        uint256 total = tpl.length + (W.length / 32) * 78;
        for (uint256 i; i < B.length; ++i) total += B[i].length;
        o = new bytes(total);
        uint256 n;
        uint256 p;
        uint256 k;
        uint256 b;
        while (p < tpl.length) {
            uint256 m = _marker(tpl, p);
            n = _slice(o, n, tpl, p, m - p);
            if (m == tpl.length) break;
            bytes1 ch = tpl[m];
            if (ch == 0x04) {
                n = _put(o, n, B[b++]);
            } else {
                if (k >= W.length) revert TemplateMismatch();
                uint256 w;
                assembly ("memory-safe") { w := mload(add(add(W, 32), k)) }
                k += 32;
                if (ch == 0x01) n = _writeHex(o, n, w & type(uint160).max, 20);
                else if (ch == 0x02) n = _put(o, n, bytes(w.str()));
                else n = _put(o, n, w != 0 ? bytes("true") : bytes("false"));
            }
            p = m + 1;
        }
        if (k != W.length || b != B.length) revert TemplateMismatch();
        assembly ("memory-safe") { mstore(o, n) }
    }

    /// @dev Everything is written into a pre-sized buffer with a cursor,
    ///      never by `concat` in a loop: the donor's `_quote` copied the
    ///      growing output once per byte, which was fine for a 300-byte
    ///      state and is quadratic for a nine-kilobyte one. `BufferOverflow`
    ///      rather than a silent scribble past the end.
    function _put(bytes memory o, uint256 n, bytes memory b) internal pure returns (uint256) {
        uint256 len = b.length;
        if (n + len > o.length) revert BufferOverflow();
        assembly ("memory-safe") { mcopy(add(add(o, 32), n), add(b, 32), len) }
        return n + len;
    }

    function _slice(bytes memory o, uint256 n, bytes memory t, uint256 start, uint256 len) internal pure returns (uint256) {
        if (n + len > o.length) revert BufferOverflow();
        assembly ("memory-safe") { mcopy(add(add(o, 32), n), add(add(t, 32), start), len) }
        return n + len;
    }

    /// @dev The exact zero-byte mask: 0x80 in every byte of `x` that is
    ///      zero and nothing anywhere else. `(x & 0x7f..) + 0x7f..` cannot
    ///      carry across a byte, so unlike the subtract-and-borrow trick
    ///      this one has no false positives, and the FIRST match in memory
    ///      order is the mask's most significant set bit.
    function _zeros(uint256 x) private pure returns (uint256 m) {
        assembly ("memory-safe") {
            let lows := 0x7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f
            m := and(not(or(or(add(and(x, lows), lows), x), lows)),
                     0x8080808080808080808080808080808080808080808080808080808080808080)
        }
    }

    /// @dev The byte index (0 = first in memory) of the most significant
    ///      mark in a mask from `_zeros`; `m` must be non-zero.
    function _firstMark(uint256 m) private pure returns (uint256 k) {
        assembly ("memory-safe") {
            let r := 7
            if shr(128, m) { m := shr(128, m) r := add(r, 128) }
            if shr(64, m)  { m := shr(64, m)  r := add(r, 64) }
            if shr(32, m)  { m := shr(32, m)  r := add(r, 32) }
            if shr(16, m)  { m := shr(16, m)  r := add(r, 16) }
            if shr(8, m)   { r := add(r, 8) }
            k := sub(31, div(r, 8))
        }
    }

    /// @dev The next marker (any byte below 0x05) at or after `from`, or the
    ///      end. A word at a time: a byte is below five iff its top five
    ///      bits are clear, so the exact mask of `x & 0xf8f8…` finds it. A
    ///      byte-at-a-time loop cost ~45 gas per byte and the tables are
    ///      fourteen kilobytes; measured, the word scan is what makes the
    ///      state block affordable.
    function _marker(bytes memory t, uint256 from) internal pure returns (uint256 i) {
        uint256 len = t.length;
        uint256 p = from;
        while (p < len) {
            uint256 x;
            assembly ("memory-safe") { x := and(mload(add(add(t, 32), p)), 0xf8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8) }
            uint256 m = _zeros(x);
            if (m != 0) {
                uint256 hit = p + _firstMark(m);
                return hit < len ? hit : len;
            }
            p += 32;
        }
        return len;
    }

    /// @dev The next `sep` at or after `from`, or the end; the same mask on
    ///      `x xor sep·ones`.
    function _find(bytes memory t, uint256 from, bytes1 sep) internal pure returns (uint256 i) {
        uint256 len = t.length;
        uint256 rep;
        assembly ("memory-safe") { rep := mul(shr(248, sep), 0x0101010101010101010101010101010101010101010101010101010101010101) }
        uint256 p = from;
        while (p < len) {
            uint256 x;
            assembly ("memory-safe") { x := xor(mload(add(add(t, 32), p)), rep) }
            uint256 m = _zeros(x);
            if (m != 0) {
                uint256 hit = p + _firstMark(m);
                return hit < len ? hit : len;
            }
            p += 32;
        }
        return len;
    }

    function _sub(bytes memory t, uint256 start, uint256 len) internal pure returns (bytes memory o) {
        o = new bytes(len);
        assembly ("memory-safe") { mcopy(add(o, 32), add(add(t, 32), start), len) }
    }

    /// @dev `0x` and the low `nBytes` bytes of `v` as hex, written at the
    ///      cursor: 20 for an address, 32 for a word, 4 for a selector
    ///      (passed as `uint256(h) >> 224`). An address or a word is two
    ///      words of characters (`hex16`, sixteen bytes at a time); a
    ///      selector is two MSTORE8s per byte against a table held in one
    ///      word. Measured (V2, W6, cold, as tools/gas.mjs measures): the
    ///      state block's world, which names 33 addresses, cost 143,933 gas
    ///      with the byte loop for every width and 68,063 with this.
    function _writeHex(bytes memory o, uint256 n, uint256 v, uint256 nBytes) internal pure returns (uint256) {
        if (n + 2 + nBytes * 2 > o.length) revert BufferOverflow();
        assembly ("memory-safe") {
            /*  Sixteen bytes (x < 2^128) as thirty-two characters in one
                word: every nibble spread into its own byte, the most
                significant first (five halvings), then '0' added to every
                byte and 39 more to each one holding ten or above — bit 4
                of nibble + 6 is set exactly then. No byte carries.     */
            function hex16(x) -> y {
                x := or(and(x, 0xffffffffffffffff), shl(64, and(x, 0xffffffffffffffff0000000000000000)))
                x := or(and(x, 0x000000000000000000000000ffffffff000000000000000000000000ffffffff),
                        shl(32, and(x, 0x0000000000000000ffffffff000000000000000000000000ffffffff00000000)))
                x := or(and(x, 0x000000000000ffff000000000000ffff000000000000ffff000000000000ffff),
                        shl(16, and(x, 0x00000000ffff000000000000ffff000000000000ffff000000000000ffff0000)))
                x := or(and(x, 0x000000ff000000ff000000ff000000ff000000ff000000ff000000ff000000ff),
                        shl(8, and(x, 0x0000ff000000ff000000ff000000ff000000ff000000ff000000ff000000ff00)))
                x := or(and(x, 0x000f000f000f000f000f000f000f000f000f000f000f000f000f000f000f000f),
                        shl(4, and(x, 0x00f000f000f000f000f000f000f000f000f000f000f000f000f000f000f000f0)))
                let ten := and(shr(4, add(x, 0x0606060606060606060606060606060606060606060606060606060606060606)),
                               0x0101010101010101010101010101010101010101010101010101010101010101)
                y := add(add(x, 0x3030303030303030303030303030303030303030303030303030303030303030), mul(ten, 0x27))
            }
            let ptr := add(add(o, 32), n)
            mstore8(ptr, 0x30)
            mstore8(add(ptr, 1), 0x78)
            ptr := add(ptr, 2)
            switch gt(nBytes, 16)
            case 1 {
                /*  The high nBytes - 16 bytes' characters, left-aligned in
                    the first word; then the low sixteen bytes' thirty-two
                    characters, written over that word's zero tail and
                    ending exactly at the last character: nothing past the
                    2·nBytes characters the bound above admitted is written. */
                let h := sub(nBytes, 16)
                mstore(ptr, shl(mul(8, sub(32, mul(2, h))), hex16(and(shr(128, v), sub(shl(mul(8, h), 1), 1)))))
                mstore(add(ptr, mul(2, h)), hex16(and(v, 0xffffffffffffffffffffffffffffffff)))
            }
            default {
                let table := 0x3031323334353637383961626364656600000000000000000000000000000000
                for { let i := 0 } lt(i, nBytes) { i := add(i, 1) } {
                    let b := and(shr(mul(8, sub(sub(nBytes, 1), i)), v), 0xff)
                    mstore8(add(ptr, mul(2, i)), byte(shr(4, b), table))
                    mstore8(add(add(ptr, mul(2, i)), 1), byte(and(b, 15), table))
                }
            }
        }
        return n + 2 + nBytes * 2;
    }

    /// @dev `0x` and `width` bytes of a hash as hex — 4 for a selector
    ///      (the hash's first four bytes), 32 for a topic or a word.
    function _hex(bytes32 h, uint256 width) internal pure returns (bytes memory o) {
        o = new bytes(2 + width * 2);
        _writeHex(o, 0, width == 32 ? uint256(h) : uint256(h) >> (256 - width * 8), width);
    }

    function _keccak(bytes memory t, uint256 start, uint256 len) internal pure returns (bytes32 h) {
        assembly ("memory-safe") { h := keccak256(add(add(t, 32), start), len) }
    }

    /// @dev `extcodesize` AND a raw staticcall, and the answer must be at
    ///      least `minLen` bytes: a bool, a word, a struct and a dynamic
    ///      array each have a shape, and a shorter answer is no answer.
    function _probe(address target, bytes memory data, uint256 minLen)
        internal view returns (bool ok, bytes memory ret)
    {
        if (target.code.length == 0) return (false, ret);
        (ok, ret) = target.staticcall(data);
        if (ok && ret.length < minLen) ok = false;
    }
}

/*───────────────────────────────────────────────────────────────────────────
  CatalogRows — the service table, rendered once, served forever

  The table is text in this contract's INIT code only. The constructor
  keccaks every signature and renders the two documents built from it —
  the `sel` map and the service rows of `services.json` — as SSTORE2
  shards; the runtime reads them with EXTCODECOPY. "Every selector
  computed on chain" (DESIGN §5.1) is satisfied by the chain that
  deployed it, and `servicesHash` (the keccak of the raw table) is what a
  reader recomputes from this source to check the rendering was of this
  table. Measured before this: rendering the rows on every call cost 9 M
  gas, which is a `/services.json` nobody can fetch; rendering them in
  the same constructor as the other tables cost 17.25 M, over the 2^24
  transaction cap, which is a deployment nobody can make. Two contracts,
  one transaction each.

  The sixteen contract addresses are constructor arguments (the deployer
  knows every prediction by then), so a row carries its contract.
───────────────────────────────────────────────────────────────────────────*/
abstract contract RowTable is Templated {
    address private immutable _SEL;
    address private immutable _R0;
    address private immutable _R1;
    address private immutable _R2;
    /// @notice keccak256 of the raw table.
    bytes32 public immutable servicesHash;

    /*  `name|contract|signature|kind|via|note;` — one row per call the
        shell or an agent can make. Contract letters: H hub, P pool,
        R reach, Y parley, T roster, S postage, K keys, N kiln,
        L launchpad, C a coin, O locks, W steward, X router, E any ERC-20,
        G engine, Q the catalog; and, post-MVB (wave 4, rendered by the
        second table so the first stays under the 2^24 transaction cap),
        M market, D roles, A the agent card, U the LP custodian, I the
        nameplate; and, in V2 (rendered by the third table, CatalogRowsV2,
        which names them), V keepsake, J journal, B bazaar, b bridges,
        Z studio, c a collection, F agora. Kind: r read, w write, p payable. Via: d
        direct from the holder's wallet, a `acts` (holder or the token's
        Reach), r the Reach only. The selector is keccak'd from the
        signature at construction; nothing hex is written by hand.

        A note may not contain `|`, `;` or `"` (they are the row and field
        separators and the JSON quote) and must be ASCII (a Solidity string
        literal admits nothing else) - which is why the knownDelegates row
        says "0xef0100 designation" where the design brief wrote a double
        bar. Rows added in U9 for the MVB screens (DESIGN §1): the Reach's
        pieces, the Postage stamp, the four Launchpad clocks, the Steward's
        instrument heir, the engine hash and the known delegates; Parley's
        steward tools, `revokeEncryptionKey`, `guardNFT`/`unguardNFT` and
        ERC-7409 reactions are deliberately NOT here (struck from the MVB
        panels by the same decision - no row, no control). Each
        names a public function its contract's ABI serves - the drift gate
        in tools/verify.mjs fails the build on one that does not.        */

    /// @dev The sixteen letters, in the order the constructor takes their addresses.
    bytes internal constant LETTERS = "HPRYTSKNLCOWXEGQMDAUI";

    error RowsTooLong();

    /// @param t the raw table this contract renders (the concrete contract's
    ///        own constant: the MVB rows, or the post-MVB rows).
    /// @param byLetter the address for each of LETTERS: zero for the
    ///        per-asset families (a coin, any ERC-20), the Reach, whose
    ///        address is per token — `account(id)` — and a satellite no
    ///        band has yet.
    constructor(bytes memory t, address[21] memory byLetter) {
        servicesHash = keccak256(t);
        _SEL = SSTORE2.write(_renderSelectors(t));
        bytes memory rows_ = _renderRows(t, byLetter);
        uint256 cut = SSTORE2.MAX_SHARD;
        if (rows_.length > cut * 3) revert RowsTooLong();
        _R0 = SSTORE2.write(_window(rows_, 0, cut));
        _R1 = rows_.length > cut ? SSTORE2.write(_window(rows_, cut, cut)) : address(0);
        _R2 = rows_.length > cut * 2 ? SSTORE2.write(_window(rows_, cut * 2, cut)) : address(0);
    }

    function _window(bytes memory b, uint256 from, uint256 len) private pure returns (bytes memory o) {
        if (from + len > b.length) len = b.length - from;
        o = _sub(b, from, len);
    }

    /// @notice `{"hub.mint":"0x…",…}`.
    function selectors() external view returns (bytes memory) { return SSTORE2.read(_SEL); }

    /// @notice The service rows, as the JSON array's inside.
    function rows() external view returns (bytes memory o) {
        o = SSTORE2.read(_R0);
        if (_R1 != address(0)) o = bytes.concat(o, SSTORE2.read(_R1));
        if (_R2 != address(0)) o = bytes.concat(o, SSTORE2.read(_R2));
    }

    /*═══════════════════ the rendering, at construction ═══════════════════*/

    /// @dev `{"hub.mint":"0x…",…}`: every row as `contract.name` →
    ///      selector. Keyed by both because `claim`, `execute`, `release`
    ///      and `state` each exist on two contracts.
    function _renderSelectors(bytes memory t) private pure returns (bytes memory o) {
        o = new bytes(t.length * 2 + 64);
        uint256 n = _put(o, 0, "{");
        uint256 p;
        while (p < t.length) {
            uint256 e = _find(t, p, ";");
            uint256 f1 = _find(t, p, "|");
            uint256 f2 = _find(t, f1 + 1, "|");
            uint256 f3 = _find(t, f2 + 1, "|");
            if (p != 0) n = _put(o, n, ",");
            n = _put(o, n, '"');
            n = _put(o, n, bytes(word(t[f1 + 1])));
            n = _put(o, n, ".");
            n = _slice(o, n, t, p, f1 - p);
            n = _put(o, n, '":"');
            n = _writeHex(o, n, uint256(_keccak(t, f2 + 1, f3 - f2 - 1)) >> 224, 4);
            n = _put(o, n, '"');
            p = e + 1;
        }
        n = _put(o, n, "}");
        assembly ("memory-safe") { mstore(o, n) }
    }

    /// @dev One JSON object per row, written straight into one buffer:
    ///      `{name, on, contract, sig, selector, kind, via, args[], notes}`.
    ///      `args` is the signature's own parameter list split at the top
    ///      level, so a tuple is one argument, as the ABI sees it.
    function _renderRows(bytes memory t, address[21] memory byLetter) private pure returns (bytes memory o) {
        o = new bytes(t.length * 6 + 64);
        uint256 n;
        uint256 p;
        while (p < t.length) {
            uint256 e = _find(t, p, ";");
            uint256 f1 = _find(t, p, "|");
            uint256 f2 = _find(t, f1 + 1, "|");
            uint256 f3 = _find(t, f2 + 1, "|");
            uint256 f4 = _find(t, f3 + 1, "|");
            uint256 f5 = _find(t, f4 + 1, "|");
            if (p != 0) n = _put(o, n, ",");
            n = _put(o, n, '{"name":"');
            n = _slice(o, n, t, p, f1 - p);
            n = _put(o, n, '","on":"');
            n = _put(o, n, bytes(word(t[f1 + 1])));
            n = _put(o, n, '","contract":"');
            n = _writeHex(o, n, uint160(byLetter[_index(t[f1 + 1])]), 20);
            n = _put(o, n, '","sig":"');
            n = _slice(o, n, t, f2 + 1, f3 - f2 - 1);
            n = _put(o, n, '","selector":"');
            n = _writeHex(o, n, uint256(_keccak(t, f2 + 1, f3 - f2 - 1)) >> 224, 4);
            n = _put(o, n, '","kind":"');
            n = _put(o, n, t[f3 + 1] == "r" ? bytes("read") : t[f3 + 1] == "p" ? bytes("payable") : bytes("write"));
            n = _put(o, n, '","via":"');
            n = _put(o, n, t[f4 + 1] == "d" ? bytes("direct") : t[f4 + 1] == "r" ? bytes("reach") : bytes("acts"));
            n = _put(o, n, '","args":[');
            n = _args(o, n, t, f2 + 1, f3 - f2 - 1);
            n = _put(o, n, '],"notes":"');
            n = _slice(o, n, t, f5 + 1, e - f5 - 1);
            n = _put(o, n, '"}');
            p = e + 1;
        }
        assembly ("memory-safe") { mstore(o, n) }
    }

    /// @dev The parameter list inside the signature's outer parentheses,
    ///      split at depth-zero commas, each piece quoted, written at `n`.
    function _args(bytes memory o, uint256 n, bytes memory t, uint256 start, uint256 len) private pure returns (uint256) {
        uint256 i = _find(t, start, "(") + 1;
        uint256 end = start + len - 1;            // the closing paren
        if (i >= end) return n;
        uint256 depth;
        uint256 from = i;
        bool first = true;
        for (; i <= end; ++i) {
            bytes1 ch = t[i];
            if (ch == "(") ++depth;
            else if (ch == ")" && i != end) --depth;
            if ((ch == "," && depth == 0) || i == end) {
                n = _put(o, n, first ? bytes('"') : bytes(',"'));
                first = false;
                n = _slice(o, n, t, from, i - from);
                n = _put(o, n, '"');
                from = i + 1;
            }
        }
        return n;
    }

    /// @dev The slot of `byLetter` a row's letter names. Virtual for
    ///      CatalogRowsV2, whose letters are its own; the two tables above
    ///      it use this one, unchanged.
    function _index(bytes1 c) internal pure virtual returns (uint256) {
        bytes memory l = LETTERS;
        for (uint256 i; i < l.length; ++i) if (l[i] == c) return i;
        return 15;
    }

    /// @notice The contract a letter names. CatalogRowsV2 names the V2
    ///         letters before these.
    function word(bytes1 c) public pure virtual returns (string memory) {
        if (c == "H") return "hub";
        if (c == "P") return "pool";
        if (c == "R") return "reach";
        if (c == "Y") return "parley";
        if (c == "T") return "roster";
        if (c == "S") return "postage";
        if (c == "K") return "keys";
        if (c == "N") return "kiln";
        if (c == "L") return "launchpad";
        if (c == "C") return "coin";
        if (c == "O") return "locks";
        if (c == "W") return "steward";
        if (c == "X") return "router";
        if (c == "E") return "erc20";
        if (c == "G") return "engine";
        if (c == "M") return "market";
        if (c == "D") return "roles";
        if (c == "A") return "agentCard";
        if (c == "U") return "custodian";
        if (c == "I") return "nameplate";
        return "catalog";
    }

}

/// @notice The MVB rows (waves 0–2): the table U7 and U9 wrote, measured
///         at 14.94 M gas to render and store on 31337 — 89 % of the 2^24
///         transaction cap, which is why nothing is appended to it.
contract CatalogRows is RowTable {
    string internal constant SERVICES =
        "mint|H|mint(address)|p|d|value is price() exactly - the id is in the Transfer log;"
        "transferFrom|H|transferFrom(address,address,uint256)|w|d|;"
        "safeTransferFrom|H|safeTransferFrom(address,address,uint256)|w|d|;"
        "approve|H|approve(address,uint256)|w|d|;"
        "setApprovalForAll|H|setApprovalForAll(address,bool)|w|d|;"
        "setApprovalForAllUntil|H|setApprovalForAllUntil(address,uint64)|w|d|;"
        "revokeAllApprovals|H|revokeAllApprovals()|w|d|one write drops every operator;"
        "sealTransfer|H|sealTransfer(uint256,uint64)|w|d|ratchet, 365 d;"
        "panic|H|panic(uint256)|w|d|holder or guardian - kills every delegated right;"
        "release|H|release(uint256)|w|d|;"
        "setUser|H|setUser(uint256,address,uint64)|w|d|;"
        "setGuardian|H|setGuardian(uint256,address)|w|d|;"
        "setStatus|H|setStatus(uint256,uint8)|w|a|sessions act only while Active;"
        "pause|H|pause(uint256)|w|d|holder or guardian;"
        "proposeAgentWallet|H|proposeAgentWallet(uint256,address)|w|d|;"
        "acceptAgentWallet|H|acceptAgentWallet(uint256)|w|d|sent by the wallet itself;"
        "setFeesToGrip|H|setFeesToGrip(uint256,bool)|w|d|income into the Grip is permanently unspendable;"
        "setTrait|H|setTrait(uint256,bytes32,bytes32)|w|d|curve or name;"
        "pinTokenURI|H|pinTokenURI(uint256,uint256)|w|d|;"
        "unpinTokenURI|H|unpinTokenURI(uint256)|w|d|;"
        "rightsOf|H|rightsOf(uint256,address)|r|d|;"
        "ownerOf|H|ownerOf(uint256)|r|d|;"
        "custodyEpoch|H|custodyEpoch(uint256)|r|d|re-read before every send;"
        "statusOf|H|statusOf(uint256)|r|d|;"
        "coreOf|H|coreOf(uint256)|r|d|;"
        "getStateFingerprint|H|getStateFingerprint(uint256)|r|d|;"
        "feeSink|H|feeSink(uint256)|r|d|;"
        "account|H|account(uint256)|r|d|;"
        "grip|H|grip(uint256)|r|d|;"
        "price|H|price()|r|d|;"
        "tokenURIAt|H|tokenURIAt(uint256,uint8)|r|d|;"
        "getTraitValue|H|getTraitValue(uint256,bytes32)|r|d|;"
        "isCanonicalAccount|H|isCanonicalAccount(address,uint256,bool)|r|d|;"
        "openMarket|P|openMarket(uint256,address,address,uint16,uint24,uint16,uint32)|w|a|the sniper fee is set here and nowhere else;"
        "deposit|P|deposit(uint256,uint256,uint256)|p|a|;"
        "withdraw|P|withdraw(uint256,uint256,uint256,address)|w|a|never pausable;"
        "closeMarket|P|closeMarket(uint256)|w|a|;"
        "swapExactIn|P|swapExactIn(uint256,bool,uint256,uint256,address,uint64)|p|d|;"
        "swapExactOut|P|swapExactOut(uint256,bool,uint256,uint256,address,uint64)|p|d|;"
        "quote|P|quote(uint256,bool,uint256)|r|d|;"
        "quoteExactOut|P|quoteExactOut(uint256,bool,uint256)|r|d|;"
        "syncCurve|P|syncCurve(uint256,uint24,uint24)|w|a|refused under seal - reverts CurveMoved;"
        "setFee|P|setFee(uint256,uint16)|w|a|;"
        "sealMarket|P|sealMarket(uint256,uint64)|w|a|ratchet, 365 d;"
        "collect|P|collect(uint256)|w|d|anyone - pays feeSink(beneficiary);"
        "writeDown|P|writeDown(uint256)|w|a|;"
        "marketOf|P|marketOf(uint256)|r|d|;"
        "spot|P|spot(uint256)|r|d|;"
        "openIds|P|openIds(uint256,uint256)|r|d|;"
        "sealedIds|P|sealedIds(uint256,uint256)|r|d|;"
        "marketHash|P|marketHash(uint256)|r|d|;"
        "execute|R|execute(address,uint256,bytes,uint8)|p|d|operation 0 only;"
        "executeBatch|R|executeBatch((address,uint256,bytes)[])|p|d|;"
        "executeTyped|R|executeTyped((address,uint256,bytes,(address,uint256)[],(address,uint256)[],uint64))|w|d|signer or session - spend caps and receive floors;"
        "seal|R|seal(uint64)|w|d|ratchet, 365 d;"
        "sealMax|R|sealMax()|w|d|;"
        "guard|R|guard(address)|w|d|;"
        "unguard|R|unguard(address)|w|d|;"
        "pieces|R|pieces()|r|d|the guarded NFTs - (collection,tokenId)[];"
        "grantSession|R|grantSession(address,uint64,uint128,(address,uint128)[],address[],bytes4[],uint32,uint32)|w|d|;"
        "grantRecipe|R|grantRecipe(address,uint64,address,bytes32,uint256,uint32,uint32)|w|d|;"
        "revokeSession|R|revokeSession(address)|w|d|;"
        "revokeAllSessions|R|revokeAllSessions()|w|d|;"
        "executeAsSession|R|executeAsSession(address,uint256,bytes)|w|d|the key's path;"
        "sessionAllows|R|sessionAllows(address,address,bytes4)|r|d|check before act;"
        "sessionOf|R|sessionOf(address)|r|d|;"
        "sessionExposure|R|sessionExposure(address)|r|d|;"
        "revokeOpenApprovals|R|revokeOpenApprovals()|w|d|;"
        "openApprovals|R|openApprovals()|r|d|;"
        "holdings|R|holdings()|r|d|;"
        "manifest|R|manifest()|r|d|;"
        "sealedUntil|R|sealedUntil()|r|d|;"
        "state|R|state()|r|d|;"
        "attestationDigest|R|attestationDigest(string,bytes32,uint64)|r|d|;"
        "speak|Y|speak(uint256,uint256,uint8,uint64,uint64,bytes)|w|a|;"
        "whisper|Y|whisper(uint256,uint256,uint8,bytes32,bytes)|w|a|re-read keyOf before every send;"
        "whisperStamped|Y|whisperStamped(uint256,uint256,uint8,bytes32,bytes,address,uint128)|p|a|;"
        "found|Y|found(uint256,string,bool)|w|a|;"
        "join|Y|join(uint256,uint256)|w|a|follow is join of the home room;"
        "leave|Y|leave(uint256,uint256)|w|a|;"
        "invite|Y|invite(uint256,uint256,uint256)|w|a|;"
        "bindKey|Y|bindKey(uint256)|w|d|;"
        "keyOf|Y|keyOf(uint256)|r|d|;"
        "stateOf|Y|stateOf(uint256)|r|d|;"
        "heads|Y|heads(uint256[])|r|d|;"
        "roomsOf|Y|roomsOf(uint256)|r|d|;"
        "membersOf|T|membersOf(uint256,uint256)|r|d|followers are the home room's members;"
        "configureInbox|S|configureInbox(uint256,address,uint128,uint64,bool)|w|d|stale after sale;"
        "inboxOf|S|inboxOf(uint256)|r|d|;"
        "expire|S|expire(uint256)|w|d|;"
        "claimRefund|S|claimRefund(uint256)|w|d|;"
        "claimSettled|S|claimSettled(uint256,address)|w|d|;"
        "owed|S|owed(address,address)|r|d|;"
        "pendingOf|S|pendingOf(uint256)|r|d|;"
        "stampOf|S|stampOf(uint256)|r|d|a sent stamp - replyBy and whether it was refunded;"
        "setEncryptionKey|K|setEncryptionKey(uint16,bytes)|w|d|;"
        "getPublicKeys|K|getPublicKeys(address)|r|d|;"
        "keyIdOf|K|keyIdOf(address)|r|d|;"
        "launch|N|launch(uint256,string,string,uint8,uint256,bytes32,uint256)|w|a|a first launch needs the holder or the guardian;"
        "coinAt|N|coinAt(uint256,address,string,string,uint8,uint256,bytes32,uint256)|r|d|;"
        "recordsOf|N|recordsOf(uint256)|r|d|;"
        "recent|N|recent(uint256,uint256)|r|d|;"
        "create|L|create((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8))|w|a|;"
        "createChecked|L|createChecked((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8),bytes32)|w|a|pins the terms the page showed;"
        "approveFirstLaunch|L|approveFirstLaunch(uint256)|w|d|the guardian;"
        "buy|L|buy(uint256,uint256,uint64,uint16)|p|d|;"
        "sell|L|sell(uint256,uint256,uint256,uint64)|w|d|;"
        "graduate|L|graduate(uint256)|w|d|anyone;"
        "fail|L|fail(uint256)|w|d|anyone, after the deadline;"
        "refund|L|refund(uint256,address)|w|d|;"
        "claim|L|claim(uint256,address)|w|d|;"
        "launchOf|L|launchOf(uint256)|r|d|;"
        "launchesOf|L|launchesOf(uint256)|r|d|;"
        "quoteBuy|L|quoteBuy(uint256,uint256)|r|d|;"
        "quoteSell|L|quoteSell(uint256,uint256)|r|d|;"
        "snipeTaxBps|L|snipeTaxBps(uint256)|r|d|;"
        "creditOf|L|creditOf(uint256,address)|r|d|;"
        "graduationTargetOf|L|graduationTargetOf(uint256)|r|d|raised X of Y - the Y, which the Launch struct lacks;"
        "boughtInWindow|L|boughtInWindow(uint256,address)|r|d|against maxBuyInWindow while the fair window runs;"
        "lastLaunchAt|L|lastLaunchAt(uint256)|r|d|the next launch is this plus LAUNCH_SPACING;"
        "firstLaunchApproved|L|firstLaunchApproved(uint256)|r|d|live only under the current epoch;"
        "termsHash|L|termsHash((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8))|r|d|;"
        "contribute|C|contribute()|p|d|raises every holder's floor;"
        "redeem|C|redeem(uint256)|w|d|;"
        "floorPerToken|C|floorPerToken()|r|d|;"
        "lock|O|lock(address,uint112,address,uint64,uint64,uint64,bool)|p|d|beneficiary defaults to the Reach;"
        "release|O|release(uint256)|w|d|anyone;"
        "extend|O|extend(uint256,uint64)|w|d|;"
        "give|O|give(uint256,address)|w|d|only into a canonical Reach;"
        "lockOf|O|lockOf(uint256)|r|d|;"
        "releasable|O|releasable(uint256)|r|d|;"
        "lockCountOf|O|lockCountOf(address)|r|d|;"
        "lockIdOf|O|lockIdOf(address,uint256)|r|d|;"
        "arrange|W|arrange(uint256,bytes32,uint64,uint64,address[],uint8)|w|d|;"
        "stillHere|W|stillHere(uint256)|w|d|;"
        "stillHereUnderDuress|W|stillHereUnderDuress(uint256)|w|d|;"
        "cancel|W|cancel(uint256)|w|d|;"
        "summon|W|summon(uint256,address,bytes32)|w|d|anyone with the heir's preimage;"
        "attest|W|attest(uint256,address,uint32)|w|d|a named guardian;"
        "execute|W|execute(uint256)|w|d|anyone, once due;"
        "wouldPass|W|wouldPass(uint256)|r|d|;"
        "getWill|W|getWill(uint256)|r|d|;"
        "getObit|W|getObit(uint256)|r|d|;"
        "heirHashOf|W|heirHashOf(address,bytes32)|r|d|;"
        "heirHashOfToken|W|heirHashOfToken(uint256,bytes32)|r|d|an instrument heir - whoever holds token N when the plan matures;"
        "swap|X|swap((uint8,address,address,uint256,uint256,uint64,uint256,bytes,(address,address,uint24,int24,address),uint160))|p|r|only a canonical Reach;"
        "quoteExactIn|X|quoteExactIn((uint8,address,address,uint256,uint256,uint64,uint256,bytes,(address,address,uint24,int24,address),uint160))|r|d|reverts QuoteResult(spent,received,sqrtPriceAfter);"
        "venues|X|venues()|r|d|;"
        "approve|E|approve(address,uint256)|w|d|exact amounts, never unlimited;"
        "allowance|E|allowance(address,address)|r|d|;"
        "balanceOf|E|balanceOf(address)|r|d|;"
        "symbol|E|symbol()|r|d|;"
        "decimals|E|decimals()|r|d|;"
        "panel|G|panel(uint256)|r|d|gzip - keccak the inflated bytes against panels;"
        "engineHash|G|engineHash()|r|d|keccak of the inflated shell - the shell compares its own bytes to this, live;"
        "state|Q|state(uint256)|r|d|;"
        "stateOf|Q|stateOf(uint256)|r|d|;"
        "services|Q|services()|r|d|;"
        "knownDelegates|Q|knownDelegates()|r|d|keccak of the 23-byte 0xef0100 designation per known 7702 delegate;";

    constructor(address[21] memory byLetter) RowTable(bytes(SERVICES), byLetter) {}
}

/// @notice The post-MVB rows (wave 4): the Market, the Roles, the agent
///         card, the LP custodian and the nameplate. A second contract and a
///         second transaction, so the MVB table's gas does not grow; the
///         text layer serves both as one `sel` map and one `services`
///         array. Every row names a function its contract's interface
///         serves (the drift gate in tools/verify.mjs holds it to the ABI
///         of the interface until the contract lands, then to both).
contract CatalogRowsPost is RowTable {
    string internal constant SERVICES =
        "list|M|list(uint256,uint256,uint64,bytes32,(address,uint256)[])|w|d|holds - both seals must reach expiresAt - the fingerprint is getStateFingerprint read live - a floor is (asset,min), asset 0 is ether;"
        "delist|M|delist(uint256)|w|d|holds while live - anyone once expired or stale;"
        "buy|M|buy(uint256,uint256,bytes32)|p|d|value is the price exactly - the fingerprint is listingOf(id).fingerprint - re-read the epoch and the fingerprint before Sign;"
        "claim|M|claim()|w|d|pull what a sale owes you;"
        "listingOf|M|listingOf(uint256)|r|d|seller price expiresAt epoch fingerprint floors - seller 0 means unlisted;"
        "owed|M|owed(address)|r|d|;"
        "grantRole|D|grantRole((bytes32,address,uint256,address,uint64,bool,bytes))|w|d|holder only - revocable only - one recipient per role id - locks the token;"
        "revokeRole|D|revokeRole(address,uint256,bytes32)|w|d|the holder or the recipient of a live role, anyone for an expired or stale record;"
        "unlockToken|D|unlockToken(address,uint256)|w|d|anyone, once every role is expired or stale;"
        "hasRole|D|hasRole(uint256,bytes32,address)|r|d|;"
        "hasAnyRole|D|hasAnyRole(uint256,address)|r|d|what the hub reads R_ROLE from;"
        "recipientOf|D|recipientOf(address,uint256,bytes32)|r|d|zero unless live;"
        "roleExpirationDate|D|roleExpirationDate(address,uint256,bytes32)|r|d|zero unless live;"
        "roleData|D|roleData(address,uint256,bytes32)|r|d|empty unless live - the rights a page reads;"
        "roleEpoch|D|roleEpoch(uint256,bytes32)|r|d|the custody epoch at grant, live or not;"
        "liveRoleCount|D|liveRoleCount(uint256)|r|d|walks at most 16 ids;"
        "USER|D|USER()|r|d|keccak256 of USER;"
        "registration|A|registration(uint256)|r|d|ERC-8004 registration-v1, face 2 - RFC 8785 canonical bytes, id 0 the collection;"
        "card|A|card(uint256)|r|d|the A2A agent card, id 0 the collection;"
        "llms|A|llms(uint256)|r|d|llms.txt for one token;"
        "llmsCollection|A|llmsCollection()|r|d|/llms.txt and /llms.md;"
        "manifestHash|A|manifestHash(uint256)|r|d|keccak256 of registration(id) - what a reader pins;"
        "nameHeldBy|I|heldBy(bytes32)|r|d|the token holding a wrapped ENS name, and whether it sits in the Grip;"
        "nameFor|I|tokenForName(bytes)|r|d|the token a DNS-wire name means - held, or <id>.intact.eth while the apex is held and live;"
        "nameExpiry|I|expiry(bytes32)|r|d|when the .eth registration under a label hash lapses, by the registrar;"
        "contentcontract|I|contentcontract()|r|d|the site as eth:0x..., ERC-6821 in ERC-3770 form;"
        "createV4|L|createV4((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8),(uint32,uint32,uint24,uint24,uint32),bytes32)|w|a|the v4 target: hook terms and the mined salt pinned beside the launch;"
        "createV4Checked|L|createV4Checked((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8),(uint32,uint32,uint24,uint24,uint32),bytes32,bytes32)|w|a|pins the terms, the hook terms and the salt the page showed;"
        "v4TermsHash|L|v4TermsHash((uint256,address,uint128,uint128,uint128,uint64,uint64,uint128,uint16,uint16,uint16,uint16,uint64,uint8),(uint32,uint32,uint24,uint24,uint32),bytes32)|r|d|;"
        "collect|U|collect(uint256)|w|d|anyone - every fee to feeSink(id);"
        "release|U|release(uint256)|w|a|after unlocksAt, to the Reach only;"
        "extend|U|extend(uint256,uint64)|w|a|only later, at most ten years;"
        "resalt|U|resalt(uint256,bytes32)|w|a|a new hook salt before seeding - a new pool;"
        "custodyOf|U|custodyOf(uint256)|r|d|;"
        "hookTermsOf|U|hookTermsOf(address)|r|d|keyed by the coin;"
        "hookOf|U|hookOf(uint256)|r|d|;"
        "hookAt|U|hookAt(address,bytes32)|r|d|where a salt would put the coin's hook;"
        "poolKeyOf|U|poolKeyOf(uint256)|r|d|;"
        "poolIdOf|U|poolIdOf(uint256)|r|d|;"
        "unlocksAt|U|unlocksAt(uint256)|r|d|the ratchet;"
        "seededAt|U|seededAt(address)|r|d|zero before the pool is seeded;"
        "spotOf|U|spotOf(uint256)|r|d|wei per 1e18 of the coin, off the pool;"
        "launchOfCoin|U|launchOfCoin(address)|r|d|;";

    constructor(address[21] memory byLetter) RowTable(bytes(SERVICES), byLetter) {}
}

/// @notice The V2 rows (wave 2, W6): the Keepsake, the Journal, the Bazaar,
///         Bridges, the Studio, a Studio collection and Agora — a third
///         contract and a third transaction, so neither table above it
///         grows; the text layer serves all three as one `sel` map and one
///         `services` array. Each row is taken from its unit's proposal
///         (docs/v2/W1..W5) and names a function its CONTRACT serves: the
///         drift gate in tools/verify.mjs holds the V2 rows to the compiled
///         contracts' ABIs, which carry the frozen interfaces and the
///         additions the units recorded (Agora's `evict`, `heads`,
///         `roomsOf`; a Collection's `pageOf`).
///
///         Its letters are its own (`_index`): V keepsake, J journal,
///         B bazaar, b bridges, Z studio, c a collection — a per-address
///         family like C, pinned as address(0) — and F agora; `word` names
///         them and, through RowTable's, every letter of the two tables
///         above, so it is total over the whole alphabet.
contract CatalogRowsV2 is RowTable {
    string internal constant SERVICES =
        "wrap|V|wrap(((address,uint256)[],(uint64,uint64,uint64),address,string,(uint8,uint256,uint256,uint256)))|p|d|value is the ETH asset exactly, 0 when none - each ERC-20 needs an exact approval to the Keepsake - a drip only when to is you;"
        "swapAndWrap|V|swapAndWrap((uint256,bool,uint256,uint256,uint64,(uint64,uint64,uint64),address,string,(uint8,uint256,uint256,uint256)))|p|d|native input: value is amountIn - what is locked is the balance delta - a drip only on asset 0 and only for you;"
        "claim|V|claim(uint256)|w|d|anyone - pays ownerOf(id) only - a token that will not move stays owed;"
        "claimable|V|claimable(uint256)|r|d|per asset what a claim pays now - then every proceed;"
        "extend|V|extend(uint256,uint64)|w|d|holder only - only later - never once the end has passed - moves the commitment;"
        "setDrip|V|setDrip(uint256,(uint8,uint256,uint256,uint256))|w|d|holder only - floor is output per 1e18 input, never 0 - moves the commitment;"
        "clearDrip|V|clearDrip(uint256)|w|d|holder only - moves the commitment;"
        "drip|V|drip(uint256)|w|d|anyone - once per block - never below the floor;"
        "transferFrom|V|transferFrom(address,address,uint256)|w|d|a gift by transfer - moves the sender's commitment;"
        "keepsakeOf|V|keepsakeOf(uint256)|r|d|holder creator createdAt schedule assets paid sold proceeds message drip lastDripBlock;"
        "commitmentOf|V|commitmentOf(address)|r|d|moves only on a keepsake leaving and on its holder's own term changes - a hub fingerprint term;"
        "keepsakeCount|V|keepsakeCount()|r|d|;"
        "inscribe|J|inscribe(address,uint256,uint8,bytes,bytes32)|w|a|kind 0-4, body 1-1024 B, sealed 1-4096 B - the root moves;"
        "countOf|J|countOf(address,uint256)|r|d|;"
        "rootOf|J|rootOf(address,uint256)|r|d|a hub fingerprint term;"
        "mayInscribe|J|mayInscribe(address,uint256,address)|r|d|;"
        "publish|B|publish(((address,address,(uint8,address,uint256,uint256,uint256)[],(uint8,address,uint256,uint256,uint256,address)[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256),bytes),(address,uint256)[])|w|d|anyone - validates the order on Seaport and indexes it - an INTACT order zoned here carries zoneHash = pinHash(id, getStateFingerprint(id), floors);"
        "check|B|check(bytes32,uint256)|r|d|zero while a fill would pass, else the refusal's selector - offer buy only on zero;"
        "pinHash|B|pinHash(uint256,bytes32,(address,uint256)[])|r|d|;"
        "pinOf|B|pinOf(bytes32)|r|d|id fingerprint floors - a zero fingerprint pins nothing;"
        "endpointOf|b|endpointOf(bytes32)|r|d|the url and when the Timelock wrote it - off by default, nothing is sent until the viewer turns it on;"
        "names|b|names()|r|d|every name that holds a record, in first-set order;"
        "launch|Z|launch(uint256,(string,string,string,uint32,uint128,uint64,uint64,uint32,uint16,uint16,bytes,bytes),bytes32)|w|a|the holder or the Reach of the creator token - the address is predict(creator, salt) - name 1..48 symbol 1..12 description <= 1024 supply 1..1000000 referral <= 2000 royalty <= 1000 page 1..24000 art <= 12000 bytes - <= 256 holes per template;"
        "predict|Z|predict(uint256,bytes32)|r|d|the collection's address before the launch;"
        "collectionsOf|Z|collectionsOf(uint256)|r|d|every collection a token launched;"
        "parentOf|Z|parentOf(address)|r|d|the creator token's collection - the family tree;"
        "isCollection|Z|isCollection(address)|r|d|launched by this Studio;"
        "mint|c|mint(address,uint256)|p|d|value is the price exactly - via is a persona or 0 - the share is withheld when via's payee is the minter or the recipient;"
        "claim|c|claim(uint256)|w|d|anyone - pays the persona's payee at the moment of the claim;"
        "owed|c|owed(uint256)|r|d|;"
        "spec|c|spec()|r|d|the terms and both templates;"
        "pageOf|c|pageOf(uint256)|r|d|the token's site, filled now;"
        "speak|F|speak(uint256,uint256,uint8,uint64,uint64,bytes)|w|a|from is a persona, the collection shifted left 96 bits plus the id - never a bare id;"
        "whisper|F|whisper(uint256,uint256,uint8,bytes32,bytes)|w|a|re-read keyOf before every send - a sealed whisper needs both sides bound;"
        "react|F|react(uint256,uint256,uint64,uint256,bytes4)|p|a|the tip goes to the payee of the author named - name the author the Said log names;"
        "follow|F|follow(uint256,uint256,bool)|w|a|a follow stays with the token through a sale;"
        "found|F|found(uint256,string,bool)|w|a|;"
        "invite|F|invite(uint256,uint256,uint256)|w|a|;"
        "join|F|join(uint256,uint256)|w|a|;"
        "leave|F|leave(uint256,uint256)|w|a|;"
        "evict|F|evict(uint256,uint256,uint256)|w|a|the steward - a seat a sale left stale too;"
        "setCooldown|F|setCooldown(uint256,uint256,uint32)|w|a|the steward - at most 7 days;"
        "hide|F|hide(uint256,uint256,uint64)|w|a|the steward - presentation, never deletion;"
        "bindKey|F|bindKey(uint256)|w|d|holder only - the binding dies with the stamp;"
        "stateOf|F|stateOf(uint256)|r|d|opened 0 is a room that never came into being - kind 4 is a collection room;"
        "keyOf|F|keyOf(uint256)|r|d|zero the moment the stamp moves;"
        "heads|F|heads(uint256[])|r|d|the one-call poll;"
        "roomsOf|F|roomsOf(uint256)|r|d|every room the token took a seat in - member says whether its holder holds it now;";

    /// @dev The seven V2 letters, in the order the constructor takes their addresses.
    bytes internal constant LETTERS_V2 = "VJBbZcF";

    /// @param byLetter the address for each of LETTERS_V2: the Keepsake, the
    ///        Journal, the Bazaar, Bridges, the Studio, zero for a collection
    ///        (each is its own address), Agora.
    constructor(address[7] memory byLetter) RowTable(bytes(SERVICES), _spread(byLetter)) {}

    /// @dev RowTable's constructor takes twenty-one slots; the V2 letters use the first seven.
    function _spread(address[7] memory a) private pure returns (address[21] memory b) {
        for (uint256 i; i < 7; ++i) b[i] = a[i];
    }

    function _index(bytes1 c) internal pure override returns (uint256) {
        bytes memory l = LETTERS_V2;
        for (uint256 i; i < l.length; ++i) if (l[i] == c) return i;
        return 20;                                 // a letter this table does not name: no contract
    }

    function word(bytes1 c) public pure override returns (string memory) {
        if (c == "V") return "keepsake";
        if (c == "J") return "journal";
        if (c == "B") return "bazaar";
        if (c == "b") return "bridges";
        if (c == "Z") return "studio";
        if (c == "c") return "collection";
        if (c == "F") return "agora";
        return super.word(c);
    }
}

/*───────────────────────────────────────────────────────────────────────────
  CatalogText — the error and event tables, the routes, the bands, and
  `services.json` assembled from them and the rows
───────────────────────────────────────────────────────────────────────────*/
contract CatalogText is Templated {
    CatalogRows public immutable ROWS;
    CatalogRowsPost public immutable ROWS_POST;
    /// @notice The V2 rows (wave 2, W6), the third table.
    CatalogRowsV2 public immutable ROWS_V2;
    address private immutable _ERR;
    address private immutable _TOP;
    /// @dev The three tables' `sel` maps joined once, at construction (V2,
    ///      W6): the state block reads one shard instead of three tables
    ///      (measured cold: `selectors()` 35,950 gas joined per call, 7,721
    ///      read from the shard).
    address private immutable _SEL;
    /// @notice keccak256 over the five raw tables' keccaks, for the
    ///         deployment record: (services, post-MVB services, V2 services,
    ///         errors, events).
    bytes32 public immutable tableHash;

    string public constant SCHEMA = "intact.services/1";

    /// @dev Every custom error the panels decode from an estimateGas revert.
    string internal constant ERRORS =
        "NoSuchToken();NotHolder();NotActor();NotAuthorized();NotModule();NotSteward();NotMarket();NotGuardian();"
        "NotTimelock();NotWallet();ZeroAddress();WrongPrice();BandExhausted();NotCanonical();CanonicalAccount(address);"
        "IsLocked(uint256);NotLocked();GuardianHeld(uint256);IsTransferSealed(uint256);NoBurn();RatchetOnly();TooLong();"
        "Expired();IsPricingSealed();RoyaltyTooHigh();BadFace();BadTrait();BadName();WrongReceiver();Reentrancy();"
        "FunctionNotFound(bytes4);MarketNotOpen();MarketAlreadyOpen();MarketNotEmpty();SameToken();ZeroAmount();"
        "FeeTooHigh();TradeTooLarge();Slippage(uint256,uint256);WrongValue();TransferFailed();Sealed(uint64);"
        "CurveMoved();CurveTooSteep();SniperTooHigh();Insolvent();NotLaunchpad();SealedMarket();ReserveOverflow();"
        "NotSigner();NotSignerOrGuardian();OnlyCall();EmptyBatch();ListTooLong();IsSealed();NotSafeWhileSealed(bytes4);"
        "ValueWhileSealed();Shrank(address,uint256,uint256);WentBlind(address);BlindTarget(address);ManifestFull();"
        "OwnershipCycle();NoSession();SessionExpired();SessionTooLong();SoldOn(uint64,uint64);NotActive();"
        "TargetNotAllowed(address);SelectorNotAllowed(bytes4);SpenderNotAllowed(address);SpendCapExceeded(uint256,uint256);"
        "AssetCapExceeded(address,uint256,uint256);Shortfall(address,uint256,uint256);Overspend(address,uint256,uint256);"
        "RecipeMismatch();NoUsesLeft();TooSoon(uint64);NoPrivilegeEscalation();AllowanceNotZero(address,address);LedgerFull();"
        "NotYours();NoSuchRoom();NotAMember();NotTheSteward();NotInvited();AlreadyIn();BadBody();BadKind();"
        "TalkingToYourself();UseWhisper();Cooldown(uint64);KeyMoved();NoKey();PostageDue(uint256,uint128);BadReply();"
        "NotParley();InboxClosed(uint256);PostageAboveMax(uint128,uint128);UnexpectedFeeToken(address,address);"
        "ReplyWindowClosed(uint64);ReplyWindowOpen(uint64);AlreadySettled(uint256);AlreadyRefunded(uint256);NothingOwed();"
        "NothingToLaunch();ShareTooLarge();DeployFailed();WrongFlags(uint16,uint16);FirstLaunchNeedsHolderOrGuardian(uint256);"
        "TermsMoved(bytes32,bytes32);NoSuchLaunch(uint256);NotLive(uint256);NotStarted(uint64);DeadlinePassed(uint64);"
        "NotGraduatable(uint256);NotFailable(uint256);FairWindowCapExceeded(uint256,uint256);CurveExhausted(uint256,uint256);"
        "SlippageExceeded(uint256,uint256);SnipeTaxTooHigh(uint16);WrongCoin(address);NotYet();NothingToClaim();NotEnough();"
        "NothingReleasable();NotBeneficiary();NotCanonicalReach(address);NoPlan();TooShort();BadGuardians();WrongHeir();"
        "BadDestination();StillSpeaking(uint64);AlreadyCalled();NotCalled();NotYet(uint64);AlreadyAttested();StaleNonce();Void();"
        "NotReach(address);VenueDrifted(address,bytes32,bytes32);VenueAbsent(uint8);BadPath();HookedKey(address);"
        "QuoteResult(uint256,uint256,uint160);NotListed(uint256);AlreadyListed(uint256);FingerprintMoved(bytes32,bytes32);"
        "FloorBroken(address,uint256,uint256);SealsTooShort(uint64,uint64,uint64);NotCurator();IsFrozen();BadPanel();"
        /*  Added in U7 after tools/verify.mjs learned to diff this table
            against the compiled ABIs of every contract a panel calls: the
            fifty-eight below were declared by those contracts and absent
            here, so a panel decoding an estimateGas revert would have shown
            a bare selector. The gate now fails the build on the next one. */
        "AllowanceStuck(address,address);AlreadyGraduated(uint256);AlreadyListed();AmountTooLarge(uint256);"
        "ApproveFailed(address,address,uint256);BadCurveParameters();BadDecimals();BadDelta(int128,int128);BadExpiry();"
        "BadHands();BadIndex();BadKeyType();BadPriceLimit();BadReplyWindow(uint64);BadSignature();BadThreshold();"
        "CreatorShareTooHigh(uint16);DeadlineTooFar(uint64);DivByZero();ERC20CallFailed(address);EmptyKey();"
        "ExpirationInThePast(uint64);Expired(uint64);FairWindowTooLong(uint64);FeeTooHigh(uint16);HubUnreadable();"
        "InexactERC20Transfer(address,uint256,uint256);IrrevocableUnsupported();ManifestBusy();MulOverflow();NoLiquidity();"
        "NoQuote(uint8);NoSuchStamp(uint256);NotEnoughCredit(uint256,uint256);NotEntitled();NotHeld();NotKiln();NotListed();"
        "NotLocked(uint256);NotOwnerOrApproved(uint256,address);NotPoolManager();PieceLeft(address,uint256);PiecesFull();"
        "Reentered();Stale(uint256);StampPending(uint256);StartsInThePast(uint64);StillLocked(uint256,uint64);TooManyFloors();TooManyRoles(uint256);ApprovalsUnsupported();"
        "NotTheManager();NotOpenYet(uint64);StillLocked(uint64);ForeignKey();Unregistered(address);AlreadyRegistered(uint256);"
        "NotRegistered(uint256);AlreadySeeded(uint256);NotSeeded(uint256);BadTerms();BadSalt(address,uint16);HookMismatch(address,address);"
        "PriceOutOfRange(uint160);PriceOff(uint160,uint160);PositionNotHeld(uint256);UnexpectedEther();"
        "UnknownRecipe(uint8);UnsupportedCollection(address);UnsupportedSchedule();WrongChain();WrongCommitment();"
        "WrongPrice(uint256,uint256);WrongTarget();ZeroInput();ZeroRecipient();"
        /*  V2 (wave 2, W6): every error the seven V2 contracts declare that
            the table lacked — the Keepsake, ERC721Base's ERC-6093 six-and-two,
            the Journal, the Bazaar (its Unpriced now IBazaarEvents'), Bridges,
            the Studio and lib/SSTORE2's two, a Collection, Agora (Persona's
            NotAPersona among them). The drift gate holds the table to their
            ABIs as it holds it to every V1 contract's.                    */
        "BadDrip();BadSchedule();BelowFloor(uint256,uint256);DuplicateAsset(address);MessageTooLong(uint256);NoAssets();"
        "NoDrip();NoSuchKeepsake(uint256);NothingFreed();OnePerBlock();TooManyAssets();WrongMarket(uint256);"
        "WrongValue(uint256,uint256);ERC721IncorrectOwner(address,uint256,address);ERC721InsufficientApproval(address,uint256);"
        "ERC721InvalidApprover(address);ERC721InvalidOperator(address);ERC721InvalidOwner(address);ERC721InvalidReceiver(address);"
        "ERC721InvalidSender(address);ERC721NonexistentToken(uint256);Empty();TooLong(uint256,uint256);UnknownKind(uint8);"
        "BadPin(bytes32,bytes32);FloorsWithoutZone();MarketSealShort(uint64,uint256);NoNFT();NotIntact();NotPinned(bytes32);"
        "NotRestricted();NotSeaport();NotValidated(bytes32);ReachSealShort(uint64,uint256);RoyaltyShort(address,uint256,uint256);"
        "Unpriced();WrongToken(uint256,uint256);BadEndpoint();BadArt();BadDescription();BadPage();BadShare();BadSupply();"
        "BadSymbol();BadWindow();SaltUsed(address);ShardEmpty();ShardTooLarge();Closed(uint64);NoPayee(uint256);NotOpen(uint64);"
        "SoldOut();WalletLimit(uint32);BadGlyph();NotAPersona(address,uint256);NotOfCollection(uint256,address);TipFailed()";

    /// @dev `name=signature;` — the topics the panels filter logs with.
    string internal constant EVENTS =
        "said=Said(uint256,uint256,uint64,uint64,uint64,uint8,uint64,uint64,bytes);"
        "founded=Founded(uint256,uint256,uint256,bool,string);entered=Entered(uint256,uint256);"
        "keyBound=KeyBound(uint256,address,uint64,uint16,bytes32);"
        "registered=Registered(uint256,uint256,address,address,bytes32);resalted=Resalted(uint256,address,bytes32);"
        "seeded=Seeded(uint256,bytes32,address,uint256,uint160,uint160,uint256);collected=Collected(uint256,address,uint256,uint256);"
        "released=Released(uint256,address,uint256,uint256);extended=Extended(uint256,uint64);"
        "orderPosted=OrderPosted(uint256,address,uint256,uint64,bytes32);delisted=Delisted(uint256);"
        "sold=Sold(uint256,address,address,uint256,uint256);claimed=Claimed(address,uint256);"
        "transfer=Transfer(address,address,uint256);minted=Minted(uint256,address,address,uint8);"
        "custodyEpoch=CustodyEpoch(uint256,uint64);panicked=Panicked(uint256,uint64,address);"
        "statusChanged=StatusChanged(uint256,uint8,uint8);"
        "marketOpened=MarketOpened(uint256,address,address,uint16,uint24);"
        "swapped=Swapped(uint256,address,bool,uint256,uint256,uint256);collected=Collected(uint256,address,uint256,uint256);"
        "launched=Launched(address,uint256,address,string,uint256,uint256);"
        "launchCreated=LaunchCreated(uint256,uint256,address,uint8,bytes32);"
        "bought=Bought(uint256,address,uint256,uint256,uint256,uint256);graduated=Graduated(uint256,uint256,uint256,uint256);"
        "stamped=Stamped(uint256,uint256,uint256,uint256,address,uint128,uint64);settled=Settled(uint256,address,address,uint128);"
        "sessionGranted=SessionGranted(address,uint8,uint64,uint128,uint64);sessionRevoked=SessionRevoked(address);"
        "locked=Locked(uint256,address,address,address,uint256,uint64,uint64,uint64,bool);"
        "arranged=Arranged(uint256,uint64,bytes32,uint64,uint64,uint8);summoned=Summoned(uint256,address,address,uint64);"
        /*  V2 (wave 2, W6): what the V2 lanes filter on. Agora's Said,
            Founded and Entered are Parley's signatures, so their topics are
            the ones above; its KeyBound carries the stamp and differs. A
            name that would collide with a V1 key says whose it is.      */
        "inscribed=Inscribed(address,uint256,uint256,uint8,address,uint64,bytes32,bytes32,bytes);"
        "wrapped=Wrapped(uint256,address,address,uint64,uint64,uint64,uint256,string);paid=Paid(uint256,address,address,uint256);"
        "dripped=Dripped(uint256,address,address,uint256,address,uint256);dripSet=DripSet(uint256,uint8,uint256,uint256,uint256);"
        "dripCleared=DripCleared(uint256);keepsakeExtended=Extended(uint256,uint64,uint64);"
        "published=Published(address,uint256,bytes32,address,uint8,uint8,address,uint256,uint256);pinned=Pinned(bytes32,uint256,bytes32,uint256);"
        "orderValidated=OrderValidated(bytes32,(address,address,(uint8,address,uint256,uint256,uint256)[],(uint8,address,uint256,uint256,uint256,address)[],uint8,uint256,uint256,bytes32,uint256,bytes32,uint256));"
        "orderFulfilled=OrderFulfilled(bytes32,address,address,address,(uint8,address,uint256,uint256)[],(uint8,address,uint256,uint256,address)[]);"
        "endpointSet=EndpointSet(bytes32,string);collectionLaunched=Launched(address,uint256,address,string,string,uint32,uint128);"
        "collectionMinted=Minted(uint256,address,uint256,uint256,uint256);collectionClaimed=Claimed(uint256,address,uint256);"
        "reacted=Reacted(uint256,uint256,uint256,uint64,bytes4,uint256);followed=Followed(uint256,uint256,bool);"
        "agoraKeyBound=KeyBound(uint256,address,bytes32,uint16,bytes32)";

    /// @dev The route table, over templates (DESIGN §5.3).
    string internal constant ROUTES =
        '["/","/token/<id>/live","/token/<id>/raw","/token/<id>/face/<n>","/token/<id>/crest.svg",'
        '"/token/<id>/state.json","/token/<id>/hash","/token/<id>/services.json","/panel/<name>.js",'
        '"/services.json","/open","/open/<from>","/manifest","/k/<id>/<key>","/c/<id>","/token/<id>"]';

    string internal constant TPL_SERVICES =
        '{"schema":"\x04",\x04"bands":\x04,"routes":\x04,'
        '"walk":"stateOf(room).last is the block of the newest message; eth_getLogs for exactly that block '
        'with topics [said, room]; follow the oldest log\'s prev; the home room of token N is '
        'keccak256(abi.encodePacked(uint8(3), N))","door":"/token/<id>/live?as=<key>",'
        '"services":[\x04\x04\x04\x04\x04],"errors":\x04,"topics":\x04}';

    string internal constant TPL_BAND = '{"band":\x02,"chainId":\x02,"lo":\x02,"hi":\x02}';

    constructor(CatalogRows rows_, CatalogRowsPost post_, CatalogRowsV2 v2_) {
        bytes memory errors_ = bytes(ERRORS);
        bytes memory events_ = bytes(EVENTS);
        ROWS = rows_;
        ROWS_POST = post_;
        ROWS_V2 = v2_;
        tableHash = keccak256(abi.encode(rows_.servicesHash(), post_.servicesHash(), v2_.servicesHash(), keccak256(errors_), keccak256(events_)));
        _ERR = SSTORE2.write(_renderErrors(errors_));
        _TOP = SSTORE2.write(_renderTopics(events_));
        _SEL = SSTORE2.write(_joinSelectors(rows_.selectors(), post_.selectors(), v2_.selectors()));
    }

    /*═══════════════════ served ═══════════════════*/

    /// @notice `{"hub.mint":"0x…",…}` — the three tables' maps as one
    ///         object, joined at construction.
    function selectors() external view returns (bytes memory) { return SSTORE2.read(_SEL); }

    /// @dev The three maps as one object, written into one buffer (an empty
    ///      map, `{}`, adds nothing).
    function _joinSelectors(bytes memory a, bytes memory b, bytes memory c) private pure returns (bytes memory o) {
        o = new bytes(a.length + b.length + c.length);
        uint256 n = _put(o, 0, "{");
        n = _inner(o, n, a);
        n = _inner(o, n, b);
        n = _inner(o, n, c);
        n = _put(o, n, "}");
        assembly ("memory-safe") { mstore(o, n) }
    }

    /// @dev A map's inside, after a comma when something precedes it.
    function _inner(bytes memory o, uint256 n, bytes memory m) private pure returns (uint256) {
        if (m.length <= 2) return n;
        if (n > 1) n = _put(o, n, ",");
        return _slice(o, n, m, 1, m.length - 2);
    }

    function errors() public view returns (bytes memory) { return SSTORE2.read(_ERR); }
    function topics() public view returns (bytes memory) { return SSTORE2.read(_TOP); }
    function routes() external pure returns (bytes memory) { return bytes(ROUTES); }

    /// @notice The whole catalog document, given the world block the
    ///         Catalog rendered.
    /// @dev The three tables' rows go into the one output buffer as three
    ///      pieces with a comma between non-empty ones, never first into a
    ///      joined copy, whose memory grows quadratically with the 79 KB
    ///      document. Measured (V2, W6, tools/gas.mjs): with this and the
    ///      word-at-a-time hex writer, `/services.json` went from 965,160
    ///      gas to 796,932, and `/token/1/state.json` from 995,363 to 814,332.
    function services(bytes calldata world) external view returns (bytes memory) {
        bytes[] memory B = new bytes[](11);
        B[0] = bytes(SCHEMA);
        B[1] = world;
        B[2] = bandsJson();
        B[3] = bytes(ROUTES);
        B[4] = ROWS.rows();
        B[6] = ROWS_POST.rows();
        B[8] = ROWS_V2.rows();
        B[5] = B[4].length != 0 && B[6].length != 0 ? bytes(",") : bytes("");
        B[7] = (B[4].length != 0 || B[6].length != 0) && B[8].length != 0 ? bytes(",") : bytes("");
        B[9] = errors();
        B[10] = topics();
        return _fill(bytes(TPL_SERVICES), "", B);
    }

    /*═══════════════════ the rendering, at construction ═══════════════════*/

    /// @dev `{"0x12345678":"NotHolder()","0x…":"Slippage(uint256,uint256)",…}`
    ///      — the WHOLE signature, not the name. U7 cut each entry at `(`,
    ///      which served a name the slab could print and nothing it could
    ///      decode: a `Slippage(uint256,uint256)` revert carries "got 9,
    ///      wanted 10" in its data and the panel had no types to read it
    ///      with. The name is the prefix before `(`; the argument list is
    ///      what the shell decodes a revert's data against (U9, D6). The
    ///      buffer is three times the table because a short entry
    ///      (`Void();`, 7 bytes) renders to 22.
    function _renderErrors(bytes memory t) private pure returns (bytes memory o) {
        o = new bytes(t.length * 3 + 64);
        uint256 n = _put(o, 0, "{");
        uint256 p;
        while (p < t.length) {
            uint256 e = _find(t, p, ";");
            if (p != 0) n = _put(o, n, ",");
            n = _put(o, n, '"');
            n = _writeHex(o, n, uint256(_keccak(t, p, e - p)) >> 224, 4);
            n = _put(o, n, '":"');
            n = _slice(o, n, t, p, e - p);
            n = _put(o, n, '"');
            p = e + 1;
        }
        n = _put(o, n, "}");
        assembly ("memory-safe") { mstore(o, n) }
    }

    /// @dev `{"said":"0x…32 bytes…",…}`.
    function _renderTopics(bytes memory t) private pure returns (bytes memory o) {
        o = new bytes(t.length * 2 + 64);
        uint256 n = _put(o, 0, "{");
        uint256 p;
        while (p < t.length) {
            uint256 e = _find(t, p, ";");
            uint256 eq = _find(t, p, "=");
            if (p != 0) n = _put(o, n, ",");
            n = _put(o, n, '"');
            n = _slice(o, n, t, p, eq - p);
            n = _put(o, n, '":"');
            n = _writeHex(o, n, uint256(_keccak(t, eq + 1, e - eq - 1)), 32);
            n = _put(o, n, '"');
            p = e + 1;
        }
        n = _put(o, n, "}");
        assembly ("memory-safe") { mstore(o, n) }
    }

    /// @notice The edition's partition (DESIGN §12) as JSON.
    function bandsJson() public pure returns (bytes memory o) {
        (uint8[] memory b, uint256[] memory c, uint256[] memory lo, uint256[] memory hi) = bands();
        o = "[";
        for (uint256 i; i < b.length; ++i) {
            o = abi.encodePacked(o, i == 0 ? "" : ",",
                _fill(bytes(TPL_BAND), abi.encode(b[i], c[i], lo[i], hi[i]), new bytes[](0)));
        }
        o = abi.encodePacked(o, "]");
    }

    /// @notice 4,096 ids, three bands, no bridge. Band 1 launches first.
    function bands() public pure returns (uint8[] memory band, uint256[] memory chainId, uint256[] memory lo, uint256[] memory hi) {
        band = new uint8[](3); chainId = new uint256[](3); lo = new uint256[](3); hi = new uint256[](3);
        band[0] = 1; chainId[0] = 8453; lo[0] = 1;    hi[0] = 3072;
        band[1] = 0; chainId[1] = 1;    lo[1] = 3073; hi[1] = 3584;
        band[2] = 2; chainId[2] = 10;   lo[2] = 3585; hi[2] = 4096;
    }
}

/*───────────────────────────────────────────────────────────────────────────
  CatalogState — the state block's skeletons and the satellites' sub-objects
───────────────────────────────────────────────────────────────────────────*/
contract CatalogState is Templated {
    using LibNum for uint256;

    CatalogText public immutable TEXT;

    uint256 public constant PAGE = 48;

    string internal constant TPL_WORLD =
        '"id":\x02,"chainId":\x02,"band":\x02,"bandLo":\x02,"bandHi":\x02,'
        '"hub":"\x01","reachImpl":"\x01","gripImpl":"\x01","pool":"\x01","router":"\x01","parley":"\x01",'
        '"roster":"\x01","postage":"\x01","keys":"\x01","kiln":"\x01","launchpad":"\x01","locks":"\x01",'
        '"steward":"\x01","market":"\x01","roles":"\x01","timelock":"\x01","catalog":"\x01","premises":"\x01",'
        '"engine":"\x01","renderer":"\x01","agentCard":"\x01","nameplate":"\x01",'
        '"keepsake":"\x01","journal":"\x01","bazaar":"\x01","bridges":"\x01","studio":"\x01","agora":"\x01","seaport":"\x01",'
        '"rights":{"HOLD":1,"ACCOUNT":2,"USE":4,"CUSTODY":8,"ROLE":16,"DELEGATE":32,"GUARDIAN":64,"SESSION":128},'
        '"bits":{"reach":1,"pool":2,"parley":4,"postage":8,"locks":16,"launchpad":32,"steward":64,"router":128,'
        '"market":256,"roles":512,"keys":1024,"nameplate":2048,"agentcard":4096,'
        '"keepsake":8192,"journal":16384,"bazaar":32768,"studio":65536,"agora":131072,"bridges":262144},';

    /*  Four of the token-level keys were once `market`, `locks`, `steward`
        and `roles` — the names TPL_WORLD above already uses for ADDRESSES.
        The block was valid JSON and `JSON.parse` kept the last key, so
        the Locks and Steward addresses were unreachable from every state
        surface (the gap, `/state.json`, an agent's read) and a panel that
        wanted `S.locks` got a count. The token-level facts are now
        `ownedMarket` (the 16-field market object), `reachLocks`
        (`Locks.lockCountOf(reach)`), `stewardStatus` (`wouldPass`) and
        `roleCount`; the world-level four stay the addresses (U9, D1).  */
    string internal constant TPL_TOKEN =
        '"price":"\x02","owner":"\x01","reach":"\x01","grip":"\x01","guardian":"\x01","user":"\x01",'
        '"agentWallet":"\x01","proposedWallet":"\x01","feeSink":"\x01","epoch":\x02,"status":\x02,'
        '"locked":\x03,"lockCount":\x02,"guardianHold":\x03,"feesToGrip":\x03,"pinnedFace":\x02,'
        '"launchCount":\x02,"curve":\x02,"name":"\x04","fingerprint":"\x04",'
        '"clocks":{"sealedUntil":\x02,"marketSealedUntil":\x02,"userExpires":\x02,"transferSealUntil":\x02,"createdAt":\x02},'
        '"ownedMarket":\x04,"inbox":\x04,"home":\x04,"commons":\x04,"key":\x04,"launches":\x04,"reachLocks":\x04,'
        '"stewardStatus":\x04,"roleCount":\x04,"holderKeyId":\x04,"reported":\x02,"absent":\x02,';

    string internal constant TPL_COLLECTION =
        '"price":"\x02","minted":\x02,"open":\x04,"recent":\x04,"commons":\x04,';

    string internal constant TPL_TAIL =
        '"sel":\x04,"err":\x04,"topics":\x04,"panels":{"swap":"\x04","social":"\x04","launch":"\x04","vault":"\x04",'
        '"identity":"\x04","agent":"\x04"},"engineHash":"\x04","catalogHash":"\x04","block":\x02,"time":\x02}';

    string internal constant TPL_MARKET =
        '{"open":\x03,"sealed":\x03,"base":"\x01","quote":"\x01","baseSymbol":"\x04","quoteSymbol":"\x04",'
        '"baseDecimals":\x02,"quoteDecimals":\x02,"rBase":"\x02","rQuote":"\x02","feeBps":\x02,"curveBps":\x02,'
        '"sniperBps":\x02,"sniperUntil":\x02,"sealUntil":\x02,"spot":"\x02"}';

    string internal constant TPL_INBOX =
        '{"feeToken":"\x01","postage":"\x02","replyWindow":\x02,"open":\x03}';

    string internal constant TPL_ROOM =
        '{"room":"\x02","last":\x02,"count":\x02,"members":\x02,"kind":\x02,"open":\x03}';

    string internal constant TPL_KEY = '{"type":\x02,"id":"\x04"}';

    string internal constant TPL_SERVICES_OF =
        '{"schema":"intact.services/1","token":\x02,"chainId":\x02,"hub":"\x01","holder":"\x01","reach":"\x01","grip":"\x01",'
        '"epoch":\x02,"status":\x02,"reported":\x02,"absent":\x02,"fingerprint":"\x04","live":"/token/\x02/live",'
        '"state":"/token/\x02/state.json","door":"/token/\x02/live?as=\\u003ckey\\u003e","catalog":"/services.json"}';

    string internal constant TPL_OPEN =
        '{"from":\x02,"pageSize":\x02,"markets":\x04,"next":\x04}';

    string internal constant TPL_OPEN_ROW =
        '{"id":\x02,"base":"\x01","quote":"\x01","feeBps":\x02,"sealUntil":\x02}';

    string internal constant TPL_VENUE =
        '{"name":"\x04","at":"\x01","codehash":"\x04","permissionBits":\x02,"upgradeable":\x03,"auditURI":"\x04"}';

    constructor(CatalogText text) {
        TEXT = text;
    }

    /*═══════════════════ the state block's parts ═══════════════════*/

    function world(World calldata w) external view returns (bytes memory) {
        return _fill(bytes(TPL_WORLD), bytes.concat(abi.encode(
            w.id, block.chainid, w.band, w.bandLo, w.bandHi,
            w.hub, w.h[H.REACH_IMPL], w.h[H.GRIP_IMPL], w.h[H.POOL], w.router, w.h[H.PARLEY], w.roster, w.postage,
            w.keys, w.kiln, w.h[H.LAUNCHPAD], w.h[H.LOCKS], w.h[H.STEWARD], w.h[H.MARKET], w.h[H.ROLES],
            w.h[H.TIMELOCK], w.catalog, w.h[H.PREMISES], w.engine, w.h[H.RENDERER], w.agentCard, w.nameplate
        ), abi.encode(
            w.h[H.KEEPSAKE], w.h[H.JOURNAL], w.bazaar, w.bridges, w.studio, w.agora, w.seaport
        )), new bytes[](0));
    }

    /// @notice One token: the facts, the clocks, and what each satellite
    ///         said. `nameWord` is the raw trait; it is escaped here.
    function token(World calldata w, TokenState calldata s, Core calldata c, uint256 price, address feeSink, bytes32 nameWord)
        external view returns (bytes memory)
    {
        bytes[] memory B = new bytes[](12);
        B[0] = bytes(Web.jsonEsc(_name(nameWord)));
        B[1] = _hex(s.fingerprint, 32);
        B[2] = _market(w.h[H.POOL], s.id);
        B[3] = _inbox(w.postage, s.id);
        B[4] = _room(w.h[H.PARLEY], _homeKey(s.id));
        B[5] = _room(w.h[H.PARLEY], 0);
        B[6] = _key(w.h[H.PARLEY], s.id);
        B[7] = _ids(w.h[H.LAUNCHPAD], abi.encodeCall(ILaunchpad.launchesOf, (s.id)));
        B[8] = _word(w.h[H.LOCKS], abi.encodeCall(ILocks.lockCountOf, (s.reach)));
        B[9] = _word(w.h[H.STEWARD], abi.encodeCall(ISteward.wouldPass, (s.id)));
        B[10] = _word(w.h[H.ROLES], abi.encodeCall(IRoles.liveRoleCount, (s.id)));
        B[11] = _hash(w.keys, abi.encodeCall(IKeyRegistry.keyIdOf, (s.owner)));
        return _fill(bytes(TPL_TOKEN), abi.encode(
            price, s.owner, s.reach, s.grip, c.guardian, c.user, c.agentWallet, c.proposedWallet, feeSink,
            s.epoch, s.status, s.locked, c.lockCount, c.guardianHold, c.feesToGrip, c.pinnedFace, c.launchCount, c.curve,
            s.sealedUntil, s.marketSealedUntil, s.userExpires, s.transferSealUntil, c.createdAt, s.reported, s.absent
        ), B);
    }

    /// @notice The `/` page's block: the open markets, the newest coins and
    ///         the commons, each behind the same guard.
    function collection(World calldata w, uint256 price, uint256 minted) external view returns (bytes memory) {
        bytes[] memory B = new bytes[](3);
        B[0] = _ids(w.h[H.POOL], abi.encodeCall(IPool.openIds, (0, PAGE)));
        B[1] = _addrs(w.kiln, abi.encodeCall(IKiln.recent, (0, 12)));
        B[2] = _room(w.h[H.PARLEY], 0);
        return _fill(bytes(TPL_COLLECTION), abi.encode(price, minted), B);
    }

    /// @notice The tables, the panel hashes, the engine hash and the clock.
    function tail(address engine, bytes32 catalogHash) external view returns (bytes memory) {
        bytes[] memory B = new bytes[](11);
        B[0] = TEXT.selectors();
        B[1] = TEXT.errors();
        B[2] = TEXT.topics();
        for (uint256 i; i < 6; ++i) {
            (bool ok, bytes memory ret) = _probe(engine, abi.encodeCall(IEngine.panelHash, (i)), 32);
            B[3 + i] = _hex(ok ? bytes32(ret) : bytes32(0), 32);
        }
        (bool okE, bytes memory retE) = _probe(engine, abi.encodeCall(IEngine.engineHash, ()), 32);
        B[9] = _hex(okE ? bytes32(retE) : bytes32(0), 32);
        B[10] = _hex(catalogHash, 32);
        return _fill(bytes(TPL_TAIL), abi.encode(block.number, block.timestamp), B);
    }

    /// @notice `/token/<id>/services.json`: the token's own addresses and
    ///         where the rest is.
    function servicesOf(address hub, TokenState calldata s) external view returns (bytes memory) {
        bytes[] memory B = new bytes[](1);
        B[0] = _hex(s.fingerprint, 32);
        return _fill(bytes(TPL_SERVICES_OF), abi.encode(
            s.id, block.chainid, hub, s.owner, s.reach, s.grip, s.epoch, s.status, s.reported, s.absent, s.id, s.id, s.id
        ), B);
    }

    /*═══════════════════ the satellites' sub-objects ═══════════════════*/

    /// @dev One owned market as the Swap lane reads it, or `null`.
    function _market(address pool, uint256 id) private view returns (bytes memory) {
        (bool ok, bytes memory ret) = _probe(pool, abi.encodeCall(IPool.marketOf, (id)), 32 * 16);
        if (!ok) return "null";
        Market memory m = abi.decode(ret, (Market));
        (ok, ret) = _probe(pool, abi.encodeCall(IPool.spot, (id)), 32);
        bytes[] memory B = new bytes[](2);
        B[0] = bytes(m.base == address(0) ? "ETH" : Web.symbolOfJson(m.base));
        B[1] = bytes(m.quote == address(0) ? "ETH" : Web.symbolOfJson(m.quote));
        return _fill(bytes(TPL_MARKET), abi.encode(
            m.open, m.sealedMarket, m.base, m.quote,
            m.base == address(0) ? 18 : Web.decimalsOf(m.base),
            m.quote == address(0) ? 18 : Web.decimalsOf(m.quote),
            m.rBase, m.rQuote, m.feeBps, m.curveBps, m.sniperBps, m.sniperUntil, m.sealUntil,
            ok ? uint256(bytes32(ret)) : 0
        ), B);
    }

    function _inbox(address postage, uint256 id) private view returns (bytes memory) {
        (bool ok, bytes memory ret) = _probe(postage, abi.encodeCall(IPostage.inboxOf, (id)), 32 * 5);
        if (!ok) return "null";
        Inbox memory b = abi.decode(ret, (Inbox));
        return _fill(bytes(TPL_INBOX), abi.encode(b.feeToken, b.postage, b.replyWindow, b.open), new bytes[](0));
    }

    /// @dev A Parley room's head: the newest block, the count, the members.
    function _room(address parley, uint256 key) private view returns (bytes memory) {
        (bool ok, bytes memory ret) = _probe(parley, abi.encodeCall(IParley.stateOf, (key)), 32 * 17);
        if (!ok) return "null";
        (uint64 last, uint64 count, , uint32 members, uint8 kind, bool openDoor) =
            abi.decode(ret, (uint64, uint64, uint64, uint32, uint8, bool));
        return _fill(bytes(TPL_ROOM), abi.encode(key, last, count, members, kind, openDoor), new bytes[](0));
    }

    /// @dev The token's bound key, zero unless the holder bound one under
    ///      the current epoch — which is the point of the binding.
    function _key(address parley, uint256 id) private view returns (bytes memory) {
        (bool ok, bytes memory ret) = _probe(parley, abi.encodeCall(IParley.keyOf, (id)), 32 * 4);
        if (!ok) return "null";
        (uint16 keyType, bytes32 keyId) = abi.decode(ret, (uint16, bytes32));
        bytes[] memory B = new bytes[](1);
        B[0] = _hex(keyId, 32);
        return _fill(bytes(TPL_KEY), abi.encode(keyType), B);
    }

    /// @dev A `uint256[]` answer as a JSON array, or null when nobody answered.
    function _ids(address target, bytes memory data) private view returns (bytes memory o) {
        (bool ok, bytes memory ret) = _probe(target, data, 64);
        if (!ok) return "null";
        uint256[] memory ids = abi.decode(ret, (uint256[]));
        o = "[";
        for (uint256 i; i < ids.length; ++i) o = abi.encodePacked(o, i == 0 ? "" : ",", ids[i].str());
        o = abi.encodePacked(o, "]");
    }

    function _addrs(address target, bytes memory data) private view returns (bytes memory o) {
        (bool ok, bytes memory ret) = _probe(target, data, 64);
        if (!ok) return "null";
        address[] memory a = abi.decode(ret, (address[]));
        o = "[";
        for (uint256 i; i < a.length; ++i) o = abi.encodePacked(o, i == 0 ? '"' : ',"', LibNum.hexAddr(a[i]), '"');
        o = abi.encodePacked(o, "]");
    }

    /// @dev One word, as a number, or null.
    function _word(address target, bytes memory data) private view returns (bytes memory) {
        (bool ok, bytes memory ret) = _probe(target, data, 32);
        return ok ? bytes(uint256(bytes32(ret)).str()) : bytes("null");
    }

    /// @dev One word, as hex, or null.
    function _hash(address target, bytes memory data) private view returns (bytes memory) {
        (bool ok, bytes memory ret) = _probe(target, data, 32);
        return ok ? abi.encodePacked('"', _hex(bytes32(ret), 32), '"') : bytes("null");
    }

    /*═══════════════════ the directories ═══════════════════*/

    /// @notice A page of the open-market directory, 48 at a time.
    function open(address pool, uint256 from) external view returns (bytes memory) {
        bytes[] memory B = new bytes[](2);
        (bool ok, bytes memory ret) = _probe(pool, abi.encodeCall(IPool.openIds, (from, PAGE)), 64);
        if (!ok) {
            B[0] = "null";
            B[1] = "null";
        } else {
            uint256[] memory ids = abi.decode(ret, (uint256[]));
            bytes memory list = "[";
            for (uint256 i; i < ids.length; ++i) {
                Market memory m = IPool(pool).marketOf(ids[i]);
                list = abi.encodePacked(list, i == 0 ? "" : ",",
                    _fill(bytes(TPL_OPEN_ROW), abi.encode(ids[i], m.base, m.quote, m.feeBps, m.sealUntil), new bytes[](0)));
            }
            B[0] = abi.encodePacked(list, "]");
            B[1] = ids.length == PAGE ? bytes((from + PAGE).str()) : bytes("null");
        }
        return _fill(bytes(TPL_OPEN), abi.encode(from, PAGE), B);
    }

    /// @notice The Router's venue table in `hooklist` shape, or `null` on a
    ///         band with no Router — an absent key and an empty one mean
    ///         different things to a program.
    function venues(address router) external view returns (bytes memory o) {
        (bool ok, bytes memory ret) = _probe(router, abi.encodeCall(IRouter.venues, ()), 64);
        if (!ok) return "null";
        VenueInfo[] memory list = abi.decode(ret, (VenueInfo[]));
        o = "[";
        for (uint256 i; i < list.length; ++i) {
            bytes[] memory B = new bytes[](3);
            B[0] = bytes(Web.jsonEsc(list[i].name));
            B[1] = _hex(list[i].codehash, 32);
            B[2] = bytes(Web.jsonEsc(list[i].auditURI));
            o = abi.encodePacked(o, i == 0 ? "" : ",",
                _fill(bytes(TPL_VENUE), abi.encode(list[i].at, list[i].permissionBits, list[i].upgradeable), B));
        }
        o = abi.encodePacked(o, "]");
    }

    /// @dev Parley's `homeKey`, recomputed: keccak256(abi.encodePacked(uint8(3), token)).
    function _homeKey(uint256 id) private pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(uint8(3), id)));
    }

    /// @dev The ≤ 32-byte name trait travels as one word, left-aligned.
    function _name(bytes32 w) private pure returns (string memory) {
        uint256 len;
        while (len < 32 && w[len] != 0) ++len;
        bytes memory b = new bytes(len);
        for (uint256 i; i < len; ++i) b[i] = w[i];
        return string(b);
    }
}

/*═══════════════════════════════════════════════════════════════════════════
  Catalog — the façade: the immutables, the gather, the assembly

  The world's addresses are this contract's own immutables, handed in at
  construction from the deployer's predictions, not read from the hub on
  every call: `services()` is then a pure function of the deployment and
  `CATALOG_HASH` is computed once, here, in the constructor. `agrees()`
  compares every one of them with what the hub actually pinned, for the
  deployment record and the verifiers — a Catalog that disagrees with its
  hub is a deployment that mispredicted, and `tools/deploy.mjs` refuses
  to publish one.
═══════════════════════════════════════════════════════════════════════════*/

/// @notice Everything the Catalog is pinned to, as one struct so the
///         twenty-odd values cannot be passed in the wrong order.
struct CatalogConfig {
    address hub;
    address engine;
    address router;
    address roster;
    address postage;
    address keys;
    address kiln;
    address agentCard;
    address reachImpl;
    address gripImpl;
    address pool;
    address parley;
    address launchpad;
    address locks;
    address steward;
    address market;
    address roles;
    address timelock;
    address premises;
    address renderer;
    uint8   band;
    uint256 bandLo;
    uint256 bandHi;
    CatalogText text;
    CatalogState state;
    address nameplate;      // post-MVB, appended: band 0's predicted resolver, the codeless placeholder elsewhere
    // V2 (wave 2, W6), appended: the Keepsake and the Journal the hub pins, and
    // the other V2 contracts the world names — predictions, codeless until each lands
    address keepsake;
    address journal;
    address bazaar;
    address bridges;
    address studio;
    address agora;
    address seaport;        // a venue, not a satellite: an address and no bit
}

contract Catalog {
    address public immutable HUB;
    address public immutable ENGINE;
    address public immutable ROUTER;
    address public immutable ROSTER;
    address public immutable POSTAGE;
    address public immutable KEYS;
    address public immutable KILN;
    address public immutable AGENTCARD;
    address public immutable NAMEPLATE;
    address public immutable REACH_IMPL;
    address public immutable GRIP_IMPL;
    address public immutable POOL;
    address public immutable PARLEY;
    address public immutable LAUNCHPAD;
    address public immutable LOCKS;
    address public immutable STEWARD;
    address public immutable MARKET;
    address public immutable ROLES;
    address public immutable TIMELOCK;
    address public immutable PREMISES;
    address public immutable RENDERER;
    /// @dev V2 (wave 2, W6): the hub's two V2 pins, then the V2 contracts it does not pin.
    address public immutable KEEPSAKE;
    address public immutable JOURNAL;
    address public immutable BAZAAR;
    address public immutable BRIDGES;
    address public immutable STUDIO;
    address public immutable AGORA;
    address public immutable SEAPORT;
    uint8   public immutable BAND;
    uint256 public immutable BAND_LO;
    uint256 public immutable BAND_HI;
    /// @dev The two companions, deployed first and pinned here.
    CatalogText public immutable TEXT;
    CatalogState public immutable STATE;
    /// @notice keccak256 of `services()`, computed once at construction.
    bytes32 public immutable CATALOG_HASH;

    error NoCompanion();

    /// @dev One bit per satellite actually CALLED. The Nameplate's is 2048
    ///      (the console round): it is asked `APEX()`, so the identity lane
    ///      can tell band 0's resolver from a codeless pin, and its ENS row
    ///      exists only where the bit says one answered or was there to ask.
    ///      V2 (W6) continues the run: keepsake 8192 (`commitmentOf(reach)`),
    ///      journal 16384 (`countOf(hub, id)`), bazaar 32768 (`HUB()`), studio
    ///      65536 (`collectionsOf(persona)`), agora 131072
    ///      (`followerCount(persona)`), bridges 262144 (`names()`). Seaport is
    ///      a venue, not a satellite: the world names it and no bit does.
    uint32 internal constant BIT_REACH     = 1;
    uint32 internal constant BIT_POOL      = 2;
    uint32 internal constant BIT_PARLEY    = 4;

    constructor(CatalogConfig memory c) {
        if (address(c.text).code.length == 0 || address(c.state).code.length == 0 || address(c.state.TEXT()) != address(c.text)) revert NoCompanion();
        HUB = c.hub;
        ENGINE = c.engine;
        ROUTER = c.router;
        ROSTER = c.roster;
        POSTAGE = c.postage;
        KEYS = c.keys;
        KILN = c.kiln;
        AGENTCARD = c.agentCard;
        NAMEPLATE = c.nameplate;
        REACH_IMPL = c.reachImpl;
        GRIP_IMPL = c.gripImpl;
        POOL = c.pool;
        PARLEY = c.parley;
        LAUNCHPAD = c.launchpad;
        LOCKS = c.locks;
        STEWARD = c.steward;
        MARKET = c.market;
        ROLES = c.roles;
        TIMELOCK = c.timelock;
        PREMISES = c.premises;
        RENDERER = c.renderer;
        KEEPSAKE = c.keepsake;
        JOURNAL = c.journal;
        BAZAAR = c.bazaar;
        BRIDGES = c.bridges;
        STUDIO = c.studio;
        AGORA = c.agora;
        SEAPORT = c.seaport;
        BAND = c.band;
        BAND_LO = c.bandLo;
        BAND_HI = c.bandHi;
        TEXT = c.text;
        STATE = c.state;
        CATALOG_HASH = keccak256(c.text.services(c.state.world(_worldFrom(c, 0, address(this)))));
    }

    /*═══════════════════ the world ═══════════════════*/

    function _worldFrom(CatalogConfig memory c, uint256 id, address self) private pure returns (World memory w) {
        w.id = id;
        w.band = c.band;
        w.bandLo = c.bandLo;
        w.bandHi = c.bandHi;
        w.hub = c.hub;
        w.router = c.router;
        w.roster = c.roster;
        w.postage = c.postage;
        w.keys = c.keys;
        w.kiln = c.kiln;
        w.catalog = self;
        w.engine = c.engine;
        w.agentCard = c.agentCard;
        w.nameplate = c.nameplate;
        w.h = [c.reachImpl, c.gripImpl, c.pool, c.parley, c.launchpad, c.locks, c.steward, c.market, c.roles,
               c.timelock, c.premises, c.renderer, c.keepsake, c.journal];
        w.bazaar = c.bazaar;
        w.bridges = c.bridges;
        w.studio = c.studio;
        w.agora = c.agora;
        w.seaport = c.seaport;
    }

    function _world(uint256 id) private view returns (World memory w) {
        w.id = id;
        w.band = BAND;
        w.bandLo = BAND_LO;
        w.bandHi = BAND_HI;
        w.hub = HUB;
        w.router = ROUTER;
        w.roster = ROSTER;
        w.postage = POSTAGE;
        w.keys = KEYS;
        w.kiln = KILN;
        w.catalog = address(this);
        w.engine = ENGINE;
        w.agentCard = AGENTCARD;
        w.nameplate = NAMEPLATE;
        w.h = [REACH_IMPL, GRIP_IMPL, POOL, PARLEY, LAUNCHPAD, LOCKS, STEWARD, MARKET, ROLES, TIMELOCK, PREMISES, RENDERER,
               KEEPSAKE, JOURNAL];
        w.bazaar = BAZAAR;
        w.bridges = BRIDGES;
        w.studio = STUDIO;
        w.agora = AGORA;
        w.seaport = SEAPORT;
    }

    /// @notice Whether the hub pinned what this Catalog was told it would:
    ///         every address and the band bounds, one loop over the hub's
    ///         getters. `which` is the first getter that disagreed, or empty.
    function agrees() external view returns (bool ok, bytes4 which) {
        bytes4[17] memory S = [IIntact.REACH_IMPL.selector, IIntact.GRIP_IMPL.selector, IIntact.POOL.selector,
                               IIntact.PARLEY.selector, IIntact.LAUNCHPAD.selector, IIntact.LOCKS.selector,
                               IIntact.STEWARD.selector, IIntact.MARKET.selector, IIntact.ROLES.selector,
                               IIntact.TIMELOCK.selector, IIntact.PREMISES.selector, IIntact.RENDERER.selector,
                               IIntact.CATALOG.selector, IIntact.BAND_LO.selector, IIntact.BAND_HI.selector,
                               IIntact.KEEPSAKE.selector, IIntact.JOURNAL.selector];
        address[14] memory h = _world(0).h;
        for (uint256 i; i < 17; ++i) {
            (bool got, bytes memory ret) = _probe(HUB, abi.encodeWithSelector(S[i]), 32);
            uint256 want = i < 12 ? uint160(h[i]) : i == 12 ? uint160(address(this)) : i == 13 ? BAND_LO
                         : i == 14 ? BAND_HI : uint160(h[i - 3]);
            if (!got || uint256(bytes32(ret)) != want) return (false, S[i]);
        }
        return (true, 0);
    }

    /*═══════════════════ the gather ═══════════════════*/

    /// @notice Everything the shell's first paint needs, each satellite
    ///         behind `extcodesize` AND a raw staticcall. A clear `reported`
    ///         bit means "not reported", never "0" — and `absent` says WHY:
    ///         its bit is set when there was no code at the address, clear
    ///         when there was code and the call still gave no answer. The
    ///         shell prints the first as "not deployed on this chain" and
    ///         the second as "could not be read at block N" (DESIGN §5.5);
    ///         one word per satellite could not have told them apart.
    function stateOf(uint256 id) public view returns (TokenState memory s) {
        IIntact hub = IIntact(HUB);
        s.id = id;
        s.owner = hub.ownerOf(id);                       // reverts NoSuchToken for an unminted id: the one honest revert
        s.reach = hub.account(id);
        s.grip = hub.grip(id);
        Core memory c = hub.coreOf(id);
        s.epoch = c.custodyEpoch;
        s.status = uint8(c.status);
        s.userExpires = c.userExpires;
        s.transferSealUntil = c.transferSealUntil;
        s.locked = c.lockCount != 0 || c.guardianHold;
        s.fingerprint = hub.getStateFingerprint(id);

        if (s.reach.code.length == 0) s.absent |= BIT_REACH;
        (bool ok, bytes memory ret) = _probe(s.reach, abi.encodeCall(IReach.sealedUntil, ()), 32);
        if (ok) { s.sealedUntil = uint64(uint256(bytes32(ret))); s.reported |= BIT_REACH; }

        if (POOL.code.length == 0) s.absent |= BIT_POOL;
        (ok, ret) = _probe(POOL, abi.encodeCall(IPool.marketOf, (id)), 32 * 16);
        if (ok) {
            Market memory m = abi.decode(ret, (Market));
            s.marketSealedUntil = m.sealUntil;
            s.marketOpen = m.open;
            s.reported |= BIT_POOL;
        }

        /*  The rest answer a shape or nothing; one loop, one call site.
            Every probe is sent its argument and then the id: a function of
            one argument (or none, `HUB()`) ignores calldata past what it
            reads. The V2 six continue the bits after the agent card's 4096
            and are asked their cheapest word, an immutable (`HUB()`, and
            Bridges' `TIMELOCK()`): the state block carries no V2 datum,
            only whether each answered, and every face that reads stateOf
            pays for these six, so none of them loads a slot.            */
        address[17] memory T = [PARLEY, POSTAGE, LOCKS, LAUNCHPAD, STEWARD, ROUTER, MARKET, ROLES, KEYS, NAMEPLATE, AGENTCARD,
                                KEEPSAKE, JOURNAL, BAZAAR, STUDIO, AGORA, BRIDGES];
        bytes4[17] memory F = [IParley.stateOf.selector, IPostage.inboxOf.selector, ILocks.lockCountOf.selector,
                               ILaunchpad.launchRoot.selector, ISteward.wouldPass.selector, IRouter.HUB.selector,
                               IMarket.listingOf.selector, IRoles.liveRoleCount.selector, IKeyRegistry.keyIdOf.selector,
                               INameplateProbe.APEX.selector, IAgentCard.manifestHash.selector,
                               IKeepsake.HUB.selector, IJournal.HUB.selector, IBazaar.HUB.selector,
                               IStudio.HUB.selector, IAgora.HUB.selector, IBridges.TIMELOCK.selector];
        uint256[17] memory G = [uint256(keccak256(abi.encodePacked(uint8(3), id))), id, uint256(uint160(s.reach)), id, id,
                                0, id, id, uint256(uint160(s.owner)), 0, id,
                                0, 0, 0, 0, 0, 0];
        uint8[17] memory L = [17, 5, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        uint32 bit = BIT_PARLEY;
        for (uint256 i; i < 17; ++i) {
            if (T[i].code.length == 0) s.absent |= bit;
            (ok, ) = _probe(T[i], abi.encodeWithSelector(F[i], G[i], id), uint256(L[i]) * 32);
            if (ok) s.reported |= bit;
            bit <<= 1;
        }
    }

    /// @dev `extcodesize` AND a raw staticcall; see Templated._probe.
    function _probe(address target, bytes memory data, uint256 minLen)
        private view returns (bool ok, bytes memory ret)
    {
        if (target.code.length == 0) return (false, ret);
        (ok, ret) = target.staticcall(data);
        if (ok && ret.length < minLen) ok = false;
    }

    /*═══════════════════ the state block ═══════════════════*/

    /// @notice The object `window.INTACT` is set to: valid JSON, valid JS.
    ///         `id == 0` is the collection's own block for the `/` page.
    function state(uint256 id) external view returns (bytes memory) {
        return id == 0 ? _collectionState() : _state(id, stateOf(id));
    }

    /// @notice `state(id)` from a TokenState already read: the Renderer reads
    ///         `stateOf(id)` once for face 0's JSON and crest and builds the
    ///         document from the same reading, so every satellite is probed
    ///         once per tokenURI rather than twice (the card builds its whole
    ///         registration to answer its probe). The bytes equal `state(id)`'s
    ///         in the same block, which the equality step holds.
    function stateFrom(uint256 id, TokenState calldata s) external view returns (bytes memory) {
        return id == 0 ? _collectionState() : _state(id, s);
    }

    /// @dev Id 0 is the collection page: no token state is read for it.
    function _collectionState() internal view returns (bytes memory) {
        IIntact hub = IIntact(HUB);
        World memory w = _world(0);
        return abi.encodePacked("{", STATE.world(w), STATE.collection(w, hub.price(), hub.minted()), STATE.tail(ENGINE, CATALOG_HASH));
    }

    function _state(uint256 id, TokenState memory s) internal view returns (bytes memory) {
        IIntact hub = IIntact(HUB);
        World memory w = _world(id);
        return abi.encodePacked("{", STATE.world(w),
            STATE.token(w, s, hub.coreOf(id), hub.price(), hub.feeSink(id), hub.getTraitValue(id, Traits.NAME)),
            STATE.tail(ENGINE, CATALOG_HASH));
    }

    /*═══════════════════ services.json and the directories ═══════════════════*/

    /// @notice The collection for a program: every call with its selector,
    ///         every error, every topic, the band table and the routes.
    ///         A pure function of the deployment — no block, no price, no
    ///         count — so `catalogHash()` names it and a bridge can refuse
    ///         any other.
    function services() external view returns (bytes memory) {
        return TEXT.services(STATE.world(_world(0)));
    }

    /// @notice keccak256 of `services()` — what a bridge pins.
    function catalogHash() external view returns (bytes32) {
        return CATALOG_HASH;
    }

    /// @notice `/token/<id>/services.json`: the token's own addresses and
    ///         where the rest is.
    function servicesOf(uint256 id) external view returns (bytes memory) {
        return STATE.servicesOf(HUB, stateOf(id));
    }

    /// @notice A page of the open-market directory, 48 at a time.
    function open(uint256 from) external view returns (bytes memory) {
        return STATE.open(POOL, from);
    }

    /// @notice The Router's venue table in `hooklist` shape, or `null`.
    function venues() external view returns (bytes memory) {
        return STATE.venues(ROUTER);
    }

    /// @notice The route table as a JSON array of templates.
    function routes() external view returns (bytes memory) {
        return TEXT.routes();
    }

    /// @notice The edition's partition (DESIGN §12): 4,096 ids, three
    ///         bands, no bridge. Band 1 launches first.
    function bands() external view returns (uint8[] memory, uint256[] memory, uint256[] memory, uint256[] memory) {
        return TEXT.bands();
    }

    /// @notice The EIP-7702 delegates the page treats as known: the keccak
    ///         of the 23-byte designation `0xef0100‖address` — exactly what
    ///         `extcodehash(holder)` is for an EOA delegated there, and what
    ///         the shell computes from `eth_getCode(holder)`.
    /// @dev    One entry. Only an address verified against its publisher's
    ///         own deployment page belongs here: a wrong entry would mark
    ///         an unknown delegate as known, which is the opposite of the
    ///         feature. The others DESIGN §5.4 names are added when their
    ///         addresses are read off chain by the deployment that pins
    ///         this contract's band.
    function knownDelegates() external pure returns (bytes32[] memory codehashes, string[] memory names) {
        codehashes = new bytes32[](1);
        names = new string[](1);
        codehashes[0] = keccak256(abi.encodePacked(hex"ef0100", 0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B));
        names[0] = "MetaMask EIP7702StatelessDeleGator";
    }

    /// @notice The seven lanes, numbered as the shell's hash router does;
    ///         panels 0..5 are verbs 2..7.
    function verbWord(uint8 verb) external pure returns (string memory) {
        if (verb == 1) return "home";
        if (verb == 2) return "swap";
        if (verb == 3) return "social";
        if (verb == 4) return "launch";
        if (verb == 5) return "vault";
        if (verb == 6) return "identity";
        if (verb == 7) return "agent";
        return "";
    }
}
