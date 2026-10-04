// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactBase} from "./IntactBase.sol";
import {IntactStorage} from "./IntactStorage.sol";
import {Core, Traits} from "../interfaces/IIntact.sol";
import {IReach} from "../interfaces/IReach.sol";
import {IPool} from "../interfaces/IPool.sol";
import {ILocks} from "../interfaces/ILocks.sol";
import {ILaunchpad} from "../interfaces/ILaunchpad.sol";
import {ISteward} from "../interfaces/ISteward.sol";
import {IRenderer} from "../interfaces/Site.sol";
import {ERC721Minimal} from "../vendor/ERC721Minimal.sol";
import {LibNum} from "../lib/LibNum.sol";

/*───────────────────────────────────────────────────────────────────────────
  SiteLogic — what a marketplace, an indexer and a buyer read

  DESIGN.md §3 row 5, §4.5, §4.6. Origin: IPSEITY src/Ipseity.sol
  (ERC-7160 faces with the holder's pin stored as index+1, ERC-7496
  traits, the renderer boundary) and ANIMA AnimaAgentFacet.sol
  `getStateFingerprint` (ERC-5646 over the whole normative struct),
  adapted for INTACT U1: the fingerprint reaches into the Reach and four
  satellites through guarded reads, the traits are `curve` and `name`
  (holder-set) plus five read-only mirrors flagged `validateOnSale`.

  The bytes themselves live in the Renderer (U7): this facet owns the pin,
  the traits and the hash, and asks the Renderer for every face. Face 0 is
  the whole document, so `tokenURIAt` exists for anyone who wants one face
  without pulling a hundred kilobytes to read it.
───────────────────────────────────────────────────────────────────────────*/
abstract contract SiteLogic is IntactBase {
    using ERC721Minimal for ERC721Minimal.Store;

    /// @dev Face 0 the document, face 1 the Crest alone, face 2 the agent
    ///      card (face 1 until AGENTCARD has code — the Renderer decides).
    uint8 internal constant FACES = 3;

    /*═══════════════════ ERC-721Metadata / 7160 / 7572 / 5169 ═══════════════════*/

    function tokenURI(uint256 id) external view returns (string memory) {
        uint8 p = _s().core[id].pinnedFace;
        return _face(id, p == 0 ? 0 : p - 1);
    }

    function tokenURIAt(uint256 id, uint8 face) external view returns (string memory) {
        return _face(id, face);
    }

    function _face(uint256 id, uint8 face) internal view returns (string memory) {
        _s().nft.ownerOf(id);
        if (face >= FACES) revert BadFace();
        return IRenderer(_RENDERER).tokenURIAt(id, face);
    }

    /// @notice ERC-7160: every face, and which one the holder pinned.
    function tokenURIs(uint256 id) external view returns (uint256 index, string[] memory uris, bool pinned) {
        _s().nft.ownerOf(id);
        uris = new string[](FACES);
        for (uint256 i; i < FACES; ++i) uris[i] = IRenderer(_RENDERER).tokenURIAt(id, uint8(i));
        uint8 p = _s().core[id].pinnedFace;
        return (p == 0 ? 0 : p - 1, uris, p != 0);
    }

    function pinTokenURI(uint256 id, uint256 index) external {
        _requireHolds(id);
        if (index >= FACES) revert BadFace();
        _s().core[id].pinnedFace = uint8(index + 1);
        emit TokenUriPinned(id, index);
        emit MetadataUpdate(id);
        emit ClearPathCache(_paths(id));
    }

    function unpinTokenURI(uint256 id) external {
        _requireHolds(id);
        _s().core[id].pinnedFace = 0;
        emit TokenUriUnpinned(id);
        emit MetadataUpdate(id);
        emit ClearPathCache(_paths(id));
    }

    function hasPinnedTokenURI(uint256 id) external view returns (bool) {
        return _s().core[id].pinnedFace != 0;
    }

    function contractURI() external view returns (string memory) {
        return IRenderer(_RENDERER).collectionURI();
    }

    /// @notice ERC-5169: the script is the site, and the site is a contract.
    function scriptURI() external view returns (string[] memory s) {
        s = new string[](1);
        s[0] = string.concat("web3://", LibNum.hexAddr(_PREMISES), ":", LibNum.str(block.chainid), "/");
    }

    /*═══════════════════ ERC-7496 traits ═══════════════════*/

    /// @dev `curve` and `name` are the holder's; the rest mirror state so a
    ///      SIP-15 marketplace can pin them at listing (`validateOnSale`).
    ///      An unknown key reads as zero, as in IPSEITY.
    function getTraitValue(uint256 id, bytes32 key) public view returns (bytes32) {
        IntactStorage.Layout storage $ = _s();
        $.nft.ownerOf(id);
        Core storage c = $.core[id];
        if (key == Traits.CURVE) return c.curve;
        if (key == Traits.NAME) return _packName(bytes($.nameTrait[id]));
        if (key == Traits.CUSTODY_EPOCH) return bytes32(uint256(c.custodyEpoch));
        if (key == Traits.SEALED_UNTIL) return _guarded32(_account(id), abi.encodeCall(IReach.sealedUntil, ()));
        if (key == Traits.MARKET_SEALED_UNTIL) return bytes32(uint256(_marketSealUntil(id)));
        if (key == Traits.FINGERPRINT) return getStateFingerprint(id);
        if (key == Traits.LOCKED) return bytes32(uint256(_locked(id) ? 1 : 0));
        return bytes32(0);
    }

    function getTraitValues(uint256 id, bytes32[] calldata keys) external view returns (bytes32[] memory out) {
        out = new bytes32[](keys.length);
        for (uint256 i; i < keys.length; ++i) out[i] = getTraitValue(id, keys[i]);
    }

    function getTraitMetadataURI() external view returns (string memory) {
        return IRenderer(_RENDERER).traitMetadataURI();
    }

    /// @notice Strict holder: the trait race of design A is closed because
    ///         no renter, operator or session has a pricing lever. `curve`
    ///         is applied to the market only by `Pool.syncCurve(id, bps,
    ///         expected)`; `name` is ≤ 32 bytes of valid UTF-8 and is
    ///         escaped by every consumer on the way out.
    function setTrait(uint256 id, bytes32 key, bytes32 value) external {
        _requireHolds(id);
        IntactStorage.Layout storage $ = _s();
        Core storage c = $.core[id];
        if (key == Traits.CURVE) {
            if (uint256(value) > Traits.MAX_CURVE_BPS) revert BadTrait();
            c.curve = value;
        } else if (key == Traits.NAME) {
            bytes memory b = _unpackName(value);
            if (!_validName(b)) revert BadName();
            $.nameTrait[id] = string(b);
            c.nameHash = b.length == 0 ? bytes32(0) : keccak256(b);
        } else {
            revert BadTrait();
        }
        emit TraitUpdated(key, id, value);
        emit MetadataUpdate(id);
        emit ClearPathCache(_paths(id));
    }

    /// @dev The Pool's seal for the owned market, zero when there is no
    ///      Pool or no market. `sealUntil` is the tenth field of `Market`
    ///      (IPool.sol, frozen); reading the word costs 400 bytes less than
    ///      decoding the struct, and the interface cannot move under it.
    function _marketSealUntil(uint256 id) internal view returns (uint64 v) {
        if (_POOL.code.length == 0) return 0;
        (bool ok, bytes memory ret) = _POOL.staticcall(abi.encodeCall(IPool.marketOf, (id)));
        if (!ok || ret.length < 32 * 16) return 0;
        assembly ("memory-safe") { v := mload(add(ret, 0x140)) }     // 32 + 9 * 32
    }

    /// @dev A ≤ 32-byte name travels as one word, left-aligned, zero-padded.
    function _packName(bytes memory b) internal pure returns (bytes32 w) {
        if (b.length == 0) return 0;
        assembly ("memory-safe") { w := mload(add(b, 32)) }
    }

    /// @dev The inverse: bytes up to the first zero; a non-zero byte after a
    ///      zero is not a name but a smuggled payload, and is refused.
    function _unpackName(bytes32 w) internal pure returns (bytes memory b) {
        uint256 n;
        while (n < 32 && w[n] != 0) ++n;
        for (uint256 i = n; i < 32; ++i) if (w[i] != 0) revert BadName();
        b = new bytes(n);
        for (uint256 i; i < n; ++i) b[i] = w[i];
    }

    /// @dev Structurally valid UTF-8 (no overlongs, no surrogates, nothing
    ///      past U+10FFFF) with no C0 control and no DEL. Consumers still
    ///      escape it; this only keeps a name from being something else.
    function _validName(bytes memory b) internal pure returns (bool) {
        uint256 n = b.length;
        uint256 i;
        while (i < n) {
            uint8 c = uint8(b[i]);
            if (c < 0x20 || c == 0x7F) return false;
            uint256 extra;
            if (c < 0x80) extra = 0;
            else if (c >= 0xC2 && c <= 0xDF) extra = 1;
            else if (c >= 0xE0 && c <= 0xEF) extra = 2;
            else if (c >= 0xF0 && c <= 0xF4) extra = 3;
            else return false;
            if (i + extra >= n) return false;
            for (uint256 j = 1; j <= extra; ++j) {
                uint8 d = uint8(b[i + j]);
                if (d < 0x80 || d > 0xBF) return false;
            }
            if (extra != 0) {
                uint8 d = uint8(b[i + 1]);
                if (c == 0xE0 && d < 0xA0) return false;      // overlong 3-byte
                if (c == 0xED && d > 0x9F) return false;      // UTF-16 surrogates
                if (c == 0xF0 && d < 0x90) return false;      // overlong 4-byte
                if (c == 0xF4 && d > 0x8F) return false;      // past U+10FFFF
            }
            i += extra + 1;
        }
        return true;
    }

    /*═══════════════════ ERC-5646 ═══════════════════*/

    /// @notice One hash over everything about this token that can change
    ///         without the token moving: the holder, the whole normative
    ///         `Core`, the traits, the Reach's state, seal and open-approval
    ///         ledger, the owned market, the locks committed to the Reach,
    ///         the launches and the steward's plan. Balances are excluded —
    ///         an inbound transfer must not break a trade; `Market` orders
    ///         carry explicit floors. Reverts for an unminted id so a
    ///         fingerprint is never confused with zero.
    /// @dev    A missing satellite contributes zero here and flips a
    ///         `reported` bit in `Catalog.stateOf(id)`.
    function getStateFingerprint(uint256 id) public view returns (bytes32) {
        IntactStorage.Layout storage $ = _s();
        address owner_ = $.nft.owner[id];
        if (owner_ == address(0)) revert NoSuchToken();
        Core memory c = $.core[id];
        address reach = _account(id);
        return keccak256(abi.encode(
            owner_,
            c,
            keccak256(abi.encode(c.curve, c.nameHash)),
            _guarded32(reach, abi.encodeCall(IReach.state, ())),
            _guarded32(reach, abi.encodeCall(IReach.sealedUntil, ())),
            _guarded32(reach, abi.encodeCall(IReach.openApprovalsRoot, ())),
            _guarded32(_POOL, abi.encodeCall(IPool.marketHash, (id))),
            _guarded32(_LOCKS, abi.encodeCall(ILocks.commitmentOf, (reach))),
            _guarded32(_LAUNCHPAD, abi.encodeCall(ILaunchpad.launchRoot, (id))),
            _guarded32(_STEWARD, abi.encodeCall(ISteward.planHash, (id)))
        ));
    }

    function coreOf(uint256 id) external view returns (Core memory) {
        IntactStorage.Layout storage $ = _s();
        $.nft.ownerOf(id);
        return $.core[id];
    }
}
