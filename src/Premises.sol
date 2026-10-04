// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIntact} from "./interfaces/IIntact.sol";
import {KeyValue} from "./interfaces/Standards.sol";
import {IEngine, IRenderer, ICrest, ICatalog, IAgentCard, TokenState} from "./interfaces/Site.sol";
import {LibNum} from "./lib/LibNum.sol";

/*═══════════════════════════════════════════════════════════════════════════

  THE PREMISES

  Origin: IPSEITY src/Premises.sol, adapted for INTACT U7 (DESIGN.md §3
  row 11, §5.3). The twenty-three page contracts are gone — the site is
  one document and six panels now — and what remains is the part the
  donor said it would never give up.

  Every token in this collection is already a website. `tokenURI` returns
  the console, held in contract code and handed back as a `data:` URI.
  Nothing is fetched. That part was never the problem. A `data:` document
  gets an opaque origin, and wallet extensions do not inject into one — so
  the console in a marketplace frame renders perfectly and cannot connect
  to anything. It can be looked at and not used. Served here it has a real
  origin under `web3://`, EIP-6963 discovery works, and every control
  renders.

  ── the line this contract will not cross ──

  **Premises serves the artwork itself, from the renderer, and stores none
  of it.** `/token/<id>/live` is `Renderer.document(id)` — exactly what
  `tokenURI` base64s, one step earlier, read from the same renderer the
  token itself uses. `/raw` is `tokenURI`. No page contract sits on the
  path between a viewer and the bytes they came for, because there is no
  page contract. If this contract is never deployed, every token renders.
  If it is replaced, every token renders identically. `tools/verify-
  premises.mjs` checks that the deployed code holds none of the engine's
  bytes.

  ── ERC-5219: the contract is the origin ──

  `request(resource, params)` is an HTTP handler written in Solidity. An
  ERC-4804 / ERC-6860 client reaches it over `web3://` with no DNS:

      /                            the collection document
      /token/<id>/live             the console, on a real origin
      /token/<id>/raw              that token's tokenURI, plain
      /token/<id>/face/<n>         one ERC-7160 face, plain
      /token/<id>/crest.svg        the still, as an image
      /token/<id>/state.json       the state block, as JSON
      /token/<id>/hash             keccaks of the document and its parts
      /token/<id>/services.json    the token, for a program
      /panel/<name>.js             a lane's script, gzip, ETag = its keccak
      /services.json               the catalog, for a program
      /open  /open/<from>          every open market, 48 per page
      /manifest                    every hash a client pins, over templates
      /k/<id>/<key>                301 into session mode
      /c/<id>  /token/<id>         301 to the console
      /.well-known/*  /llms.*      the agent surface (404 until AgentCard)

  Rules kept from the donor: `resolveMode()` is never removed; one
  resource, one URL (a trailing slash is dropped, a leading zero refused,
  a mixed-case key is sent to its lower-case spelling); a 404 is an answer
  and never a revert, and it never echoes the path — the one thing on this
  page an attacker could have chosen is the one thing that would be
  rendered. Zero state: every function is a view.

═══════════════════════════════════════════════════════════════════════════*/
contract Premises {
    using LibNum for uint256;

    address public immutable HUB;
    address public immutable RENDERER;
    address public immutable ENGINE;
    address public immutable CATALOG;
    address public immutable CREST;
    /// @dev May be codeless until U17: every agent route is a 404 until then.
    address public immutable AGENTCARD;

    string private constant HTML = "text/html; charset=utf-8";
    string private constant TEXT = "text/plain; charset=utf-8";
    string private constant JSON = "application/json";
    string private constant SVG  = "image/svg+xml";
    string private constant JS   = "text/javascript; charset=utf-8";

    /// @dev Short, because half of what this site reports is a live clock
    ///      and a cached market is a market that quotes last minute's
    ///      price. The immutable bytes — panels, the manifest — get a day.
    string private constant CACHE = "public, max-age=15";
    string private constant CACHE_LONG = "public, max-age=86400";

    constructor(address hub, address renderer, address engine, address catalog, address crest, address agentCard) {
        HUB = hub;
        RENDERER = renderer;
        ENGINE = engine;
        CATALOG = catalog;
        CREST = crest;
        AGENTCARD = agentCard;
    }

    /*═══════════════════ ERC-6860 ═══════════════════*/

    /// @notice Declares that this contract answers in ERC-5219 mode.
    /// @dev    Not optional, and its absence is silent. ERC-6860 resolves
    ///         the mode by calling this and treating a revert as "auto" —
    ///         and in auto mode `web3://<addr>/` is an empty call to a
    ///         contract with no fallback, and `web3://<addr>/token/1` is a
    ///         call to a method named `token` taking a uint256. Neither
    ///         exists here, so both revert. Without these four bytes the
    ///         site is reachable only from a gateway that happens to
    ///         hard-code ERC-5219 for this address. Which is a server,
    ///         which is the thing this contract exists not to need.
    function resolveMode() external pure returns (bytes32) {
        return "5219";
    }

    /*═══════════════════ ERC-5219 ═══════════════════*/

    function request(string[] memory resource, KeyValue[] memory params)
        external view
        returns (uint16 statusCode, string memory body, KeyValue[] memory headers)
    {
        params;   // no query parameters are read; the path is the whole API

        /*  One resource, one URL. A trailing slash arrives as an empty last
            segment, so `/token/1/` is dropped to `/token/1` rather than
            404ing while `/token/1` succeeds; and past that, a leaf handler
            that ignores whatever follows it would serve the same page at
            unboundedly many addresses. Every response carries a
            Cache-Control, so "the same page at any URL you like" is an
            invitation to fill a gateway's cache with distinct entries for
            one document until the real ones are evicted.                 */
        uint256 n = resource.length;
        if (n > 0 && bytes(resource[n - 1]).length == 0) --n;

        if (n == 0) return (200, string(IRenderer(RENDERER).collectionDocument()), _headers(HTML, CACHE));

        string memory r0 = resource[0];

        if (_eq(r0, "token")) return _token(resource, n);

        if (_eq(r0, "panel")) {
            if (n != 2) return _notFound();
            (bool okP, uint256 i) = _panelIndex(resource[1]);
            if (!okP) return _notFound();
            bytes memory gz = IEngine(ENGINE).panel(i);
            if (gz.length == 0) return _notFound();
            /*  Stored gzip, served gzip: the header lets a gateway hand the
                browser bytes it inflates itself, and the ETag is the keccak
                of the INFLATED script — the number the shell compares with
                `INTACT.panels[name]` before it injects anything.        */
            KeyValue[] memory h = new KeyValue[](4);
            h[0] = KeyValue("Content-Type", JS);
            h[1] = KeyValue("Content-Encoding", "gzip");
            h[2] = KeyValue("ETag", string.concat("\"", LibNum.hex32(IEngine(ENGINE).panelHash(i)), "\""));
            h[3] = KeyValue("Cache-Control", CACHE_LONG);
            return (200, string(gz), h);
        }

        if (_eq(r0, "services.json")) {
            if (n != 1) return _notFound();
            return (200, string(ICatalog(CATALOG).services()), _headers(JSON, CACHE_LONG));
        }

        if (_eq(r0, "open")) {
            if (n > 2) return _notFound();
            uint256 from;
            if (n == 2) {
                (bool okO, uint256 v) = _toUint(resource[1]);
                if (!okO) return _notFound();
                from = v;
            }
            return (200, string(ICatalog(CATALOG).open(from)), _headers(JSON, CACHE));
        }

        if (_eq(r0, "manifest")) {
            if (n != 1) return _notFound();
            return (200, string(manifest()), _headers(JSON, CACHE_LONG));
        }

        /*  /k/<id>/<key> — the session key's own front door, the one surface
            where the actor is not the holder. It is a redirect into the
            same document booted in session mode: the id is in the path
            because a bare key cannot find the account that granted it
            without an indexer; whoever hands out a key hands out this
            address with it. Exactly three segments — the pair IS the page. */
        if (_eq(r0, "k")) {
            if (n != 3) return _notFound();
            (bool okI, uint256 kid) = _toUint(resource[1]);
            if (!okI || !_exists(kid)) return _notFound();
            (bool okK, address key) = _toAddr(resource[2]);
            if (!okK) return _notFound();
            return _moved(string.concat("/token/", resource[1], "/live?as=", LibNum.hexAddr(key)));
        }

        if (_eq(r0, "c")) {
            if (n != 2) return _notFound();
            (bool okC, uint256 cid) = _toUint(resource[1]);
            if (!okC || !_exists(cid)) return _notFound();
            return _moved(string.concat("/token/", resource[1], "/live"));
        }

        /*───── the agent surface: a 404 until an AgentCard has code ─────*/

        if (_eq(r0, ".well-known")) {
            if (n != 2 || AGENTCARD.code.length == 0) return _notFound();
            if (_eq(resource[1], "agent-registration.json")) return _card(abi.encodeCall(IAgentCard.registration, (0)), JSON);
            if (_eq(resource[1], "agent-card.json")) return _card(abi.encodeCall(IAgentCard.card, (0)), JSON);
            return _notFound();
        }
        if (_eq(r0, "llms.txt") || _eq(r0, "llms.md")) {
            if (n != 1 || AGENTCARD.code.length == 0) return _notFound();
            return _card(abi.encodeCall(IAgentCard.llmsCollection, ()), TEXT);
        }

        return _notFound();
    }

    /*───── one token ─────*/

    function _token(string[] memory resource, uint256 n)
        private view returns (uint16, string memory, KeyValue[] memory)
    {
        if (n < 2) return _notFound();
        (bool valid, uint256 id) = _toUint(resource[1]);
        if (!valid || !_exists(id)) return _notFound();

        if (n == 2) return _moved(string.concat("/token/", resource[1], "/live"));

        string memory leaf = resource[2];

        /*  `face` is the only route that takes a fourth segment, and it
            *requires* one — the gate has to be an exact length per leaf
            rather than "three, or four if it is face", because the latter
            lets `/token/1/face` through to read `resource[3]` and panic.
            A 404 and an out-of-bounds panic look nothing alike to a
            client: one is an answer, the other is a broken origin.     */
        if (_eq(leaf, "face")) {
            if (n != 4) return _notFound();
            (bool okf, uint256 face) = _toUint(resource[3]);
            /*  `tokenURIAt` reverts BadFace past the last face, and a revert
                is not an answer. Asking for face 9 of 3 is the same kind of
                mistake as asking for token 9999, and deserves the same reply. */
            if (!okf || face >= IRenderer(RENDERER).faceCount()) return _notFound();
            return (200, IIntact(HUB).tokenURIAt(id, uint8(face)), _headers(TEXT, CACHE));
        }
        if (n != 3) return _notFound();

        /*  The two routes that hand over the artwork itself: the hub's own
            tokenURI, and the renderer's document one step before base64. */
        if (_eq(leaf, "raw")) return (200, IIntact(HUB).tokenURI(id), _headers(TEXT, CACHE));

        if (_eq(leaf, "live")) {
            KeyValue[] memory h = new KeyValue[](3);
            h[0] = KeyValue("Content-Type", HTML);
            h[1] = KeyValue("Cache-Control", CACHE);
            h[2] = KeyValue("Link", string.concat("</token/", resource[1], "/services.json>; rel=\"service-desc\""));
            return (200, string(IRenderer(RENDERER).document(id)), h);
        }

        if (_eq(leaf, "crest.svg")) {
            TokenState memory s = ICatalog(CATALOG).stateOf(id);
            return (200, string(ICrest(CREST).svg(id, s.epoch, s.status, s.sealedUntil)), _headers(SVG, CACHE));
        }

        if (_eq(leaf, "state.json")) return (200, string(ICatalog(CATALOG).state(id)), _headers(JSON, CACHE));

        /*  What a client re-hashes: the document it was served, the two
            runs of engine bytes, the state block, and the block it was
            all read at. The crest's footer prints "verified against chain
            at block N" after comparing its own inflated bytes to these.  */
        if (_eq(leaf, "hash")) {
            bytes memory doc = IRenderer(RENDERER).document(id);
            return (200, string(abi.encodePacked(
                '{"document":"', LibNum.hex32(keccak256(doc)),
                '","head":"', LibNum.hex32(keccak256(IEngine(ENGINE).headBytes())),
                '","body":"', LibNum.hex32(keccak256(IEngine(ENGINE).bodyBytes())),
                '","state":"', LibNum.hex32(keccak256(ICatalog(CATALOG).state(id))),
                '","engine":"', LibNum.hex32(IEngine(ENGINE).engineHash()),
                '","block":', block.number.str(), '}'
            )), _headers(JSON, CACHE));
        }

        if (_eq(leaf, "services.json")) return (200, string(ICatalog(CATALOG).servicesOf(id)), _headers(JSON, CACHE));

        if (_eq(leaf, "llms.txt")) {
            if (AGENTCARD.code.length == 0) return _notFound();
            return _card(abi.encodeCall(IAgentCard.llms, (id)), TEXT);
        }

        return _notFound();
    }

    /*═══════════════════ /manifest ═══════════════════*/

    /// @notice Every hash a client pins, over route TEMPLATES rather than
    ///         4,096 ids. Each route names the keccak a client checks that
    ///         route's bytes against: the engine for the documents, the six
    ///         panel hashes (as one keccak over them) for the panels, the
    ///         catalog for the JSON routes, the Crest's own code for the
    ///         image, and zero for the two routes that are only a hash or a
    ///         redirect.
    function manifest() public view returns (bytes memory) {
        IEngine e = IEngine(ENGINE);
        bytes32 engineHash = e.engineHash();
        bytes32 catalogHash = ICatalog(CATALOG).catalogHash();
        bytes32[] memory shards = e.shardHashes();
        bytes memory shardList;
        for (uint256 i; i < shards.length; ++i) {
            shardList = abi.encodePacked(shardList, i == 0 ? "" : ",", '"', LibNum.hex32(shards[i]), '"');
        }
        bytes memory panelList;
        bytes memory panelsPacked;
        for (uint256 i; i < 6; ++i) {
            bytes32 ph = e.panelHash(i);
            panelsPacked = abi.encodePacked(panelsPacked, ph);
            panelList = abi.encodePacked(panelList, i == 0 ? "" : ",",
                '"', ICatalog(CATALOG).verbWord(uint8(i + 2)), '":"', LibNum.hex32(ph), '"');
        }
        bytes32 panelsHash = keccak256(panelsPacked);
        bytes32 crestHash = CREST.codehash;
        return abi.encodePacked(
            '{"engineHash":"', LibNum.hex32(engineHash),
            '","inflatedSize":', uint256(e.inflatedSize()).str(),
            ',"shardHashes":[', shardList,
            '],"panelHashes":{', panelList,
            '},"catalogHash":"', LibNum.hex32(catalogHash),
            '","crestCodehash":"', LibNum.hex32(crestHash),
            '","routes":[',
                _route("/", engineHash), ",",
                _route("/token/<id>/live", engineHash), ",",
                _route("/token/<id>/raw", engineHash), ",",
                _route("/token/<id>/face/<n>", engineHash), ",",
                _route("/token/<id>/crest.svg", crestHash), ",",
                _route("/token/<id>/state.json", catalogHash), ",",
                _route("/token/<id>/hash", 0), ",",
                _route("/token/<id>/services.json", catalogHash), ",",
                _route("/panel/<name>.js", panelsHash), ",",
                _route("/services.json", catalogHash), ",",
                _route("/open", catalogHash), ",",
                _route("/open/<from>", catalogHash), ",",
                _route("/manifest", 0), ",",
                _route("/k/<id>/<key>", 0), ",",
                _route("/c/<id>", 0), ",",
                _route("/token/<id>", 0),
            ']}'
        );
    }

    function _route(string memory template, bytes32 h) private pure returns (bytes memory) {
        return abi.encodePacked('{"template":"', template, '","keccak":"', LibNum.hex32(h), '"}');
    }

    /*═══════════════════ answers that are not pages ═══════════════════*/

    /// @dev The agent card's answer, or a 404 if the card will not give one.
    function _card(bytes memory data, string memory contentType)
        private view returns (uint16, string memory, KeyValue[] memory)
    {
        (bool ok, bytes memory ret) = AGENTCARD.staticcall(data);
        if (!ok || ret.length < 64) return _notFound();
        return (200, string(abi.decode(ret, (bytes))), _headers(contentType, CACHE));
    }

    /// @dev A 301 to the canonical spelling. Cached hard, because where a
    ///      resource lives does not change and a gateway that re-asked on
    ///      every request would have turned a de-duplication into a second
    ///      round trip.
    function _moved(string memory to) private pure returns (uint16, string memory, KeyValue[] memory) {
        KeyValue[] memory h = new KeyValue[](3);
        h[0] = KeyValue("Content-Type", HTML);
        h[1] = KeyValue("Cache-Control", CACHE_LONG);
        h[2] = KeyValue("Location", to);
        return (
            301,
            string.concat(
                "<!doctype html><meta charset=utf-8><title>moved</title>"
                "<body style=\"background:#07080c;color:#8b95ad;font:14px ui-monospace,monospace;padding:3rem\">"
                "<p>That resource lives at one address.</p>"
                "<p><a style=\"color:#7fd4ff\" href=\"", to, "\">", to, "</a></p>"),
            h
        );
    }

    /// @dev A 404 rather than a revert, and the path is never echoed back.
    function _notFound() private pure returns (uint16, string memory, KeyValue[] memory) {
        return (
            404,
            "<!doctype html><meta charset=utf-8><title>no such resource</title>"
            "<body style=\"background:#07080c;color:#8b95ad;font:14px ui-monospace,monospace;padding:3rem\">"
            "<p>There is nothing at that address of the collection.</p>"
            "<p><a style=\"color:#7fd4ff\" href=\"/\">back to the collection</a></p>",
            _headers(HTML, CACHE)
        );
    }

    function _headers(string memory contentType, string memory cache) private pure returns (KeyValue[] memory h) {
        h = new KeyValue[](2);
        h[0] = KeyValue("Content-Type", contentType);
        h[1] = KeyValue("Cache-Control", cache);
    }

    /*═══════════════════ small things ═══════════════════*/

    function _exists(uint256 id) private view returns (bool) {
        (bool ok, bytes memory out) = HUB.staticcall(abi.encodeCall(IIntact.ownerOf, (id)));
        return ok && out.length >= 32 && abi.decode(out, (address)) != address(0);
    }

    function _eq(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    /// @dev `<name>.js` → the panel's index, by the Catalog's own words.
    function _panelIndex(string memory s) private view returns (bool ok, uint256 i) {
        for (i = 0; i < 6; ++i) {
            if (_eq(s, string.concat(ICatalog(CATALOG).verbWord(uint8(i + 2)), ".js"))) return (true, i);
        }
        return (false, 0);
    }

    /// @dev A path segment is text. Anything that is not a plain decimal
    ///      number is not an id, and saying so is a 404 rather than a
    ///      revert. A leading zero is refused, so `/token/0000000001` is
    ///      not a second address for token 1: the manifest and every
    ///      cache in front of this contract assume one URL per resource.
    function _toUint(string memory s) private pure returns (bool ok, uint256 v) {
        bytes memory b = bytes(s);
        if (b.length == 0 || b.length > 10) return (false, 0);
        if (b.length > 1 && b[0] == "0") return (false, 0);
        for (uint256 i; i < b.length; ++i) {
            uint8 ch = uint8(b[i]);
            if (ch < 0x30 || ch > 0x39) return (false, 0);
            v = v * 10 + (ch - 0x30);
        }
        return (true, v);
    }

    /// @dev 42 characters of hex to an address, refusing anything else. A
    ///      mixed-case key is accepted and redirected to the lower-case
    ///      spelling the door writes, so one key has one door.
    function _toAddr(string memory s) private pure returns (bool ok, address a) {
        bytes memory b = bytes(s);
        if (b.length != 42 || b[0] != "0" || (b[1] != "x" && b[1] != "X")) return (false, address(0));
        uint256 v;
        for (uint256 i = 2; i < 42; ++i) {
            uint8 ch = uint8(b[i]);
            uint256 d;
            if (ch >= 0x30 && ch <= 0x39) d = ch - 0x30;
            else if (ch >= 0x61 && ch <= 0x66) d = ch - 0x61 + 10;
            else if (ch >= 0x41 && ch <= 0x46) d = ch - 0x41 + 10;
            else return (false, address(0));
            v = v * 16 + d;
        }
        return (true, address(uint160(v)));
    }
}
