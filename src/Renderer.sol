// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "./lib/Base64.sol";
import {LibNum} from "./lib/LibNum.sol";
import {Web} from "./lib/Web.sol";
import {IIntact, Traits} from "./interfaces/IIntact.sol";
import {IEngine, ICrest, ICatalog, IAgentCard, TokenState} from "./interfaces/Site.sol";

/*═══════════════════════════════════════════════════════════════════════════

  RENDERER — everything a marketplace is ever handed

  Origin: IPSEITY src/Renderer.sol lines 50-116 (the gzip loader, the
  document assembly, the JSON), adapted for INTACT U7: `$IPSE` is
  `$INTACT`, the state script comes from the Catalog rather than being
  built here, the art faces and the trigonometry are gone, and face 2 is
  the agent card once one is deployed.

  Three faces, per ERC-7160, and the holder pins whichever one the market
  shows:

    0  The document     the whole shell, with this token's state written
                        into the gap between its head and its body
    1  The crest        the still — no script, no animation, nothing to run
    2  The card         the ERC-8004 registration (post-MVB; until an
                        AgentCard has code, face 1 again)

  Face 1 exists because face 0 is tens of kilobytes of base64 and some
  clients will not touch that. A token that becomes invisible when a
  client is cautious is not really on chain.

  The property DESIGN.md §0 calls singular — one byte-stream served twice —
  lives in `document(id)`: `tokenURI` base64s what it returns, and
  `Premises` serves it as `text/html` one step earlier. `tools/verify.mjs`
  asserts the two are equal on every run.

═══════════════════════════════════════════════════════════════════════════*/
contract Renderer {
    using LibNum for uint256;

    address public immutable HUB;
    address public immutable ENGINE;
    address public immutable CREST;
    address public immutable CATALOG;
    /// @dev May be codeless until U17: face 2 then answers as face 1.
    address public immutable AGENTCARD;

    error BadFace();

    /// @dev DecompressionStream has been in every shipping browser since
    ///      2023; it is part of the platform, not a library, so using it
    ///      fetches nothing.
    ///
    ///      The loader declares nothing in global scope, and that is not
    ///      tidiness. document.open() clears the document but keeps the
    ///      Window, and a lexical declaration made before the write is
    ///      still there after it - so a `const D` here and a `const D`
    ///      anywhere at the top level of the document being written are
    ///      the same binding, and the write throws before a pixel is
    ///      drawn. The engine is minified, and a minifier hands out short
    ///      top-level names; the collision is not hypothetical. The payload
    ///      arrives on one property instead, and the property is deleted
    ///      as soon as it has been read.
    ///
    ///      The same fact carries the state. IPSEITY quoted the state
    ///      script into the loader's payload and spliced it before the
    ///      inflated `</head>`; INTACT writes `<script>window.INTACT={…}
    ///      </script>` as the sibling BEFORE the loader, where it runs on
    ///      the served document, and the property survives the rewrite
    ///      exactly as a stray `const` would have. The state is then the
    ///      same bytes in the document, in `/token/<id>/state.json` and
    ///      under `/token/<id>/hash`, and a 14 KB block is not escaped
    ///      byte by byte on every `tokenURI` (measured: 13 M gas of the
    ///      first draft's 27 M were that quoting).
    ///
    ///      `window.INTACT.$doc=t` is the one line U9 added. Until then the
    ///      inflated text was a `const` inside the IIFE, dropped after the
    ///      write, and the shell had no byte-exact copy of itself: after
    ///      `document.open()/write()/close()` the only text in reach is
    ///      `documentElement.outerHTML`, a re-serialisation that is not
    ///      byte-equal to `t` in general (doctype casing, attribute quoting,
    ///      entity forms). So DESIGN §5.4's "verified against chain at
    ///      block N" had no bytes to hash. The payload now rides as a
    ///      property on the state object the sibling script already made —
    ///      a property assignment, not a binding, so the rule above still
    ///      holds and `tools/build-app.mjs checkLoader` still passes — and
    ///      the shell keccaks it once after first paint, compares with the
    ///      baked `engineHash` and with a LIVE `engine.engineHash()`, then
    ///      deletes it.
    string internal constant INFLATE =
        '<script>(async()=>{try{'
        'const D=self.$INTACT;delete self.$INTACT;'
        'const b=Uint8Array.from(atob(D),c=>c.charCodeAt(0));'
        'const t=await new Response(new Blob([b]).stream()'
        '.pipeThrough(new DecompressionStream("gzip"))).text();'
        'window.INTACT.$doc=t;document.open();document.write(t);document.close();'
        '}catch(e){document.body.textContent='
        '"INTACT could not inflate itself in this browser.\\n\\n"+e;}})()</script>';

    string internal constant DESCRIPTION =
        "One token that is a website, a swap, a social identity, a launchpad and a vault, "
        "entirely on chain, and that moves intact: a sale carries every asset, position, "
        "stream and seal to the buyer in one transaction and strips every authority the "
        "seller ever delegated in that same transaction. The document in animation_url is "
        "the token's own console, held in this chain's state as contract bytecode; the "
        "same bytes are served at external_url on an origin a wallet will talk to. "
        "Nothing is fetched. No IPFS, no gateway, no CDN, no font, no library.";

    constructor(address hub, address engine, address crest, address catalog, address agentCard) {
        HUB = hub;
        ENGINE = engine;
        CREST = crest;
        CATALOG = catalog;
        AGENTCARD = agentCard;
    }

    function faceCount() external pure returns (uint256) {
        return 3;
    }

    /*───────────────────── the document ─────────────────────*/

    /// @notice The complete page, byte for byte: the prologue, this
    ///         token's state as `window.INTACT`, then the gzip shell and
    ///         the loader that inflates it. `id == 0` is the collection's
    ///         own page (`/`).
    function document(uint256 id) public view returns (bytes memory) {
        return abi.encodePacked(
            IEngine(ENGINE).headBytes(),
            "<script>window.INTACT=", ICatalog(CATALOG).state(id), "</script>",
            "<script>self.$INTACT=\"", Base64.encode(IEngine(ENGINE).bodyBytes()), "\";</script>",
            INFLATE
        );
    }

    function collectionDocument() external view returns (bytes memory) {
        return document(0);
    }

    /*───────────────────── the faces ─────────────────────*/

    function tokenURIAt(uint256 id, uint8 face) external view returns (string memory) {
        if (face == 0) return _face0(id);
        if (face == 1) return _face1(id);
        if (face == 2) return _face2(id);
        revert BadFace();
    }

    function _face0(uint256 id) internal view returns (string memory) {
        TokenState memory s = ICatalog(CATALOG).stateOf(id);
        return _json(id, s, abi.encodePacked(
            '"animation_url":"data:text/html;base64,', Base64.encode(document(id)), '",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(_crest(s)), '",'
        ), 0);
    }

    function _face1(uint256 id) internal view returns (string memory) {
        TokenState memory s = ICatalog(CATALOG).stateOf(id);
        return _json(id, s, abi.encodePacked(
            '"image":"data:image/svg+xml;base64,', Base64.encode(_crest(s)), '",'
        ), 1);
    }

    /// @dev Face 1 until an AgentCard answers: a face that reverts on a
    ///      band without the card would make `tokenURIs` revert with it.
    function _face2(uint256 id) internal view returns (string memory) {
        if (AGENTCARD.code.length != 0) {
            (bool ok, bytes memory ret) = AGENTCARD.staticcall(abi.encodeCall(IAgentCard.registration, (id)));
            if (ok && ret.length >= 64) {
                return string.concat("data:application/json;base64,", Base64.encode(abi.decode(ret, (bytes))));
            }
        }
        return _face1(id);
    }

    function _crest(TokenState memory s) internal view returns (bytes memory) {
        return ICrest(CREST).svg(s.id, s.epoch, s.status, s.sealedUntil);
    }

    /*───────────────────── the JSON ─────────────────────*/

    function _json(uint256 id, TokenState memory s, bytes memory media, uint256 face)
        internal view returns (string memory)
    {
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(abi.encodePacked(
                '{"name":"INTACT #', id.str(), face == 1 ? " - The crest" : "", '",',
                '"description":"', DESCRIPTION, '",',
                media,
                '"external_url":"', _origin(), "/token/", id.str(), '/live",',
                '"attributes":', _attributes(id, s),
                '}'
            ))
        ));
    }

    /// @dev The ERC-7496 traits a SIP-15 marketplace pins at listing, and
    ///      the facts a buyer reads: what survives the sale and what does
    ///      not is the whole of what this token is.
    function _attributes(uint256 id, TokenState memory s) internal view returns (bytes memory) {
        IIntact hub = IIntact(HUB);
        string memory name_ = Web.jsonEsc(_name(hub.getTraitValue(id, Traits.NAME)));
        return abi.encodePacked(
            '[',
              _num("Custody epoch", s.epoch),
              ',', _trait("Status", s.status == 0 ? "Active" : "Paused"),
              ',', _trait("Sealed until", _clock(s.sealedUntil, s.reported & 1 != 0)),
              ',', _trait("Market", s.marketOpen ? _clock(s.marketSealedUntil, true) : (s.reported & 2 != 0 ? "closed" : "not reported")),
              ',', _trait("Locked", s.locked ? "yes" : "no"),
              ',', _num("Curve", uint256(hub.getTraitValue(id, Traits.CURVE))),
              ',', _trait("Name", bytes(name_).length == 0 ? "-" : name_),
              ',', _trait("Reach", LibNum.hexAddr(s.reach)),
              ',', _trait("Grip", LibNum.hexAddr(s.grip)),
              ',', _trait("Fingerprint", LibNum.hex32(s.fingerprint)),
            ']'
        );
    }

    /// @dev "0" and "not reported" are different facts here too.
    function _clock(uint64 until, bool reported) internal pure returns (string memory) {
        if (!reported) return "not reported";
        if (until == 0) return "unsealed";
        return string.concat("sealed until ", uint256(until).str());
    }

    function _trait(string memory k, string memory val) internal pure returns (bytes memory) {
        return abi.encodePacked('{"trait_type":"', k, '","value":"', val, '"}');
    }

    function _num(string memory k, uint256 val) internal pure returns (bytes memory) {
        return abi.encodePacked('{"trait_type":"', k, '","display_type":"number","value":', val.str(), "}");
    }

    function _name(bytes32 w) internal pure returns (string memory) {
        uint256 len;
        while (len < 32 && w[len] != 0) ++len;
        bytes memory b = new bytes(len);
        for (uint256 i; i < len; ++i) b[i] = w[i];
        return string(b);
    }

    /// @dev `web3://<premises>:<chainid>` — the origin a wallet injects into.
    function _origin() internal view returns (string memory) {
        return string.concat("web3://", LibNum.hexAddr(IIntact(HUB).PREMISES()), ":", block.chainid.str());
    }

    /*───────────────────── the collection · ERC-7572 ─────────────────────*/

    /// @notice The collection: the hashes a client pins, the route table,
    ///         the band map, and the crest of no token in particular.
    function collectionURI() external view returns (string memory) {
        ICatalog cat = ICatalog(CATALOG);
        (uint8[] memory band, uint256[] memory chainId, uint256[] memory lo, uint256[] memory hi) = cat.bands();
        bytes memory bands_;
        for (uint256 i; i < band.length; ++i) {
            bands_ = abi.encodePacked(bands_, i == 0 ? "" : ",",
                '{"band":', uint256(band[i]).str(), ',"chainId":', chainId[i].str(),
                ',"lo":', lo[i].str(), ',"hi":', hi[i].str(), '}');
        }
        (uint256 h, uint256 b) = IEngine(ENGINE).sizes();
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(abi.encodePacked(
                '{"name":"INTACT","description":"4096 tokens, each a whole thing: a website, a swap, '
                'a social identity, a launchpad and a vault, entirely on chain, that moves intact. '
                'The console is ', (h + b).str(), ' bytes of gzip held as contract bytecode and inflated '
                'by the browser\'s own decompressor. Nothing is fetched.",',
                '"image":"data:image/svg+xml;base64,', Base64.encode(ICrest(CREST).svg(0, 1, 0, 0)), '",',
                '"external_link":"', _origin(), '/",',
                '"engineHash":"', LibNum.hex32(IEngine(ENGINE).engineHash()), '",',
                '"catalogHash":"', LibNum.hex32(cat.catalogHash()), '",',
                '"routes":', cat.routes(), ',',
                '"bands":[', bands_, '],',
                '"collaborators":[]}'
            ))
        ));
    }

    /*───────────────────── the traits · ERC-7496 ─────────────────────*/

    function traitMetadataURI() external pure returns (string memory) {
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(
                '{"traits":{'
                '"curve":{"displayName":"Curve","dataType":{"type":"decimal","signed":false,"decimals":0,'
                  '"minValue":"0","maxValue":"80000"}},'
                '"name":{"displayName":"Name","dataType":{"type":"string","maxLength":32}},'
                '"custodyEpoch":{"displayName":"Custody epoch","dataType":{"type":"decimal","signed":false,"decimals":0},"validateOnSale":"requireEq"},'
                '"sealedUntil":{"displayName":"Sealed until","dataType":{"type":"decimal","signed":false,"decimals":0},"validateOnSale":"requireUintGte"},'
                '"marketSealedUntil":{"displayName":"Market sealed until","dataType":{"type":"decimal","signed":false,"decimals":0},"validateOnSale":"requireUintGte"},'
                '"fingerprint":{"displayName":"Fingerprint","dataType":{"type":"string"},"validateOnSale":"requireEq"},'
                '"locked":{"displayName":"Locked","dataType":{"type":"decimal","signed":false,"decimals":0,'
                  '"minValue":"0","maxValue":"1"},"validateOnSale":"requireEq"}'
                "}}"
            ))
        ));
    }
}
