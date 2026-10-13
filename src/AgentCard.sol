// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIntact} from "./interfaces/IIntact.sol";
import {ICatalog} from "./interfaces/Site.sol";
import {LibNum} from "./lib/LibNum.sol";

/*═══════════════════════════════════════════════════════════════════════════

  AGENT CARD — the token, for something that cannot read a page

  Origin: IPSEITY src/PageManifest.sol (the llms half, the door written
  into a machine document) and ANIMA sdk/src/index.ts (the manifest hashing
  rule: the commitment is over the bytes actually served, canonicalised as
  RFC 8785 so an independent client reproduces one byte representation),
  adapted for INTACT U17 (DESIGN.md §3 row 13, §4.6, §5.3, §10).

  Three documents, each generated from the chain in the block it is read:

    registration(id)   ERC-8004 `registration-v1` — face 2 of tokenURI and
                       /.well-known/agent-registration.json (id 0, the
                       collection's own). agentId == tokenId; agentWallet is
                       account(id), the Reach; services[] are the token's
                       web3:// routes and its /k/<id>/{key} door;
                       supportedTrust names the two facts this protocol can
                       actually prove — the custody epoch and the ERC-5646
                       fingerprint; x402Support is false because nothing here
                       takes a payment over HTTP.
    card(id)           the A2A agent card (/.well-known/agent-card.json)
    llms(id)           llms.txt for one token; llmsCollection() for the site

  ── the hashing rule ──

  `manifestHash(id)` is keccak256 of `registration(id)`'s bytes — the
  number Catalog.stateOf probes (bit 4096) and the lane compares against
  the bytes it was served. The document is written in RFC 8785 (JCS)
  canonical form so a reader can recompute it from the parsed object:
  object keys in byte order at every level, no whitespace, integers as
  plain digits, strings with only `"` and `\` escaped and nothing but
  printable ASCII inside. `canonicalize(JSON.parse(bytes)) === bytes` holds
  for every document this contract emits; the door template is written as
  an RFC 6570 URI template (`{key}`) rather than `<key>`, so the bytes carry
  no angle bracket in either spelling. Nothing a holder types is in the
  registration — the name trait is a face-0 attribute, not an identity
  fact — so the hash moves only with the facts an agent must re-read
  anyway: the status, the custody epoch, the catalogue.

  ── reads that may not answer ──

  Every read of the hub and the catalog is `extcodesize` AND a raw
  staticcall (`try` alone reverts before the call on a codeless address;
  CLAUDE.md). An unminted id is a document whose `active` is false; an
  absent catalog is a `null` catalogHash, never a zero hash. Zero state;
  every function is a view.

═══════════════════════════════════════════════════════════════════════════*/
contract AgentCard {
    using LibNum for uint256;

    address public immutable HUB;
    address public immutable CATALOG;
    address public immutable PREMISES;

    string internal constant TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
    string internal constant DESCRIPTION =
        "One token that is a website, a swap, a social identity, a launchpad and a vault, entirely on chain. "
        "Its agent is a holder-granted session key on its ERC-6551 Reach and nothing more: read sessionAllows "
        "before any send, act only through executeAsSession or executeTyped, and expect every key to die with a sale.";
    string internal constant TAIL =
        '"supportedTrust":["custody-epoch","erc-5646"],"type":"https://eips.ethereum.org/EIPS/eip-8004#registration-v1","x402Support":false}';

    constructor(address hub, address catalog, address premises) {
        HUB = hub;
        CATALOG = catalog;
        PREMISES = premises;
    }

    /*═══════════════════ ERC-8004 registration-v1 ═══════════════════*/

    /// @notice Face 2: the registration document, JCS-canonical bytes.
    ///         `id == 0` is the collection's own document.
    function registration(uint256 id) public view returns (bytes memory) {
        string memory o = _origin();
        string memory reg = _registry();
        if (id == 0) {
            return abi.encodePacked(
                '{"active":true,"agentRegistry":"', reg, '","catalogHash":', _catalogHash(),
                ',"description":"', DESCRIPTION, '","name":"INTACT","registrations":[],"services":[',
                _svc(o, "/", "web"), ",", _svc(o, "/.well-known/agent-card.json", "A2A"),
                ",", _svc(o, "/services.json", "services"), ",", _svc(o, "/llms.txt", "llms"),
                ",", _svc(o, "/open", "open"), ",", _svc(o, "/manifest", "manifest"),
                ",", _svc(o, "/token/{id}/face/2", "registration"), ",", _svc(o, "/k/{id}/{key}", "door"),
                "],", TAIL
            );
        }
        (address reach, uint64 epoch, bool active) = _facts(id);
        string memory n = id.str();
        string memory t = string.concat("/token/", n);
        return abi.encodePacked(
            '{"active":', active ? "true" : "false", ',"agentId":', n, ',"agentWallet":"', LibNum.hexAddr(reach),
            '","catalogHash":', _catalogHash(), ',"custodyEpoch":', uint256(epoch).str(),
            ',"description":"', DESCRIPTION, '","image":"', o, t, '/crest.svg","name":"INTACT #', n,
            '","registrations":[{"agentId":', n, ',"agentRegistry":"', reg, '"}],"services":[',
            _svc(o, string.concat(t, "/live"), "web"), ",", _svc(o, "/.well-known/agent-card.json", "A2A"),
            ",", _svc(o, string.concat(t, "/services.json"), "services"), ",", _svc(o, string.concat(t, "/state.json"), "state"),
            ",", _svc(o, string.concat(t, "/llms.txt"), "llms"), ",", _svc(o, string.concat(t, "/face/2"), "registration"),
            ",", _svc(o, string.concat("/k/", n, "/{key}"), "door"),
            "],", TAIL
        );
    }

    /// @notice keccak256 of `registration(id)`'s bytes: what a reader pins.
    function manifestHash(uint256 id) external view returns (bytes32) {
        return keccak256(registration(id));
    }

    /*═══════════════════ the A2A card ═══════════════════*/

    /// @notice /.well-known/agent-card.json (id 0) or one token's card. Not
    ///         hash-pinned, written in the same canonical order anyway.
    function card(uint256 id) external view returns (bytes memory) {
        string memory o = _origin();
        string memory n = id.str();
        string memory who = id == 0 ? "" : string.concat(" #", n);
        bytes memory meta = id == 0
            ? abi.encodePacked('"agentRegistry":"', _registry(), '"')
            : abi.encodePacked('"agentId":', n, ',"agentRegistry":"', _registry(), '","agentWallet":"', LibNum.hexAddr(_reach(id)), '"');
        return abi.encodePacked(
            '{"capabilities":{"pushNotifications":false,"streaming":false},"defaultInputModes":["application/json"],'
            '"defaultOutputModes":["application/json"],"description":"', DESCRIPTION, '","metadata":{', meta,
            '},"name":"INTACT', who, '","protocolVersion":"1.0","provider":{"organization":"INTACT","url":"', o, '/"},'
            '"skills":[{"description":"a read: sessionAllows on the Reach, then a dry eth_call of the same executeAsSession; '
            'nothing is sent","id":"propose","name":"propose","tags":["read"]},'
            '{"description":"one executeAsSession(to, value, data) from the key\'s own wallet, only what propose allowed",'
            '"id":"act","name":"act","tags":["write"]}],"url":"', o,
            id == 0 ? "/" : string.concat("/token/", n, "/live"), '","version":"1"}'
        );
    }

    /*═══════════════════ llms.txt ═══════════════════*/

    function llms(uint256 id) external view returns (bytes memory) {
        if (id == 0) return _llmsCollection();
        (address reach, uint64 epoch, bool active) = _facts(id);
        string memory o = _origin();
        string memory n = id.str();
        string memory t = string.concat(o, "/token/", n);
        return abi.encodePacked(
            "# INTACT #", n, "\n\n> ", DESCRIPTION, "\n\n"
            "- agentId ", n, " in the registry ", _registry(), "; agentWallet ", LibNum.hexAddr(reach),
            " (the Reach); custody epoch ", uint256(epoch).str(), "; ", active ? "active" : "paused: no key acts until the holder re-arms it",
            "\n- manifestHash(", n, ") on the AgentCard is keccak256 of face 2's bytes\n"
            "- catalogHash ", _catalogHash(), ": pin it; refuse a catalogue that answers with another\n\n"
            "## Routes\n\n"
            "- [console](", t, "/live): the document\n"
            "- [state](", t, "/state.json): the state block\n"
            "- [services](", t, "/services.json): every call with its selector\n"
            "- [registration](", t, "/face/2): ERC-8004 registration-v1\n"
            "- [card](", o, "/.well-known/agent-card.json): A2A\n"
            "- [door](", o, "/k/", n, "/{key}): a session key's own page\n\n",
            _authority()
        );
    }

    function llmsCollection() external view returns (bytes memory) {
        return _llmsCollection();
    }

    function _llmsCollection() private view returns (bytes memory) {
        string memory o = _origin();
        return abi.encodePacked(
            "# INTACT\n\n> ", DESCRIPTION, "\n\n"
            "- the registry is ", _registry(), ": every token's agentId is its tokenId, its agentWallet its Reach\n"
            "- catalogHash ", _catalogHash(), ": pin it; refuse a catalogue that answers with another\n\n"
            "## Routes\n\n"
            "- [collection](", o, "/): the collection document\n"
            "- [services](", o, "/services.json): every call with its selector, every error, every topic\n"
            "- [open](", o, "/open): every open market, 48 per page\n"
            "- [manifest](", o, "/manifest): every hash a client pins\n"
            "- [registration](", o, "/.well-known/agent-registration.json): this collection, as an ERC-8004 document\n"
            "- [card](", o, "/.well-known/agent-card.json): A2A\n"
            "- [token](", o, "/token/{id}/live): one token; /token/{id}/face/2 its registration, /token/{id}/llms.txt its page\n"
            "- [door](", o, "/k/{id}/{key}): a session key's own page\n\n",
            _authority()
        );
    }

    function _authority() private pure returns (bytes memory) {
        return
            "## Authority\n\n"
            "- a session key the holder granted on the Reach is the only agent authority; holding or receiving a token grants nothing\n"
            "- read sessionAllows(key, target, selector) before any send; executeAsSession or executeTyped is the only path; a sale ends every key\n"
            "- never pass a wallet or session key through a bridge, a prompt or a log\n";
    }

    /*═══════════════════ pieces ═══════════════════*/

    /// @dev One service entry, keys in byte order; `A2A` carries its version.
    function _svc(string memory o, string memory path, string memory name) private pure returns (bytes memory) {
        return abi.encodePacked('{"endpoint":"', o, path, '","name":"', name, '"',
            keccak256(bytes(name)) == keccak256("A2A") ? ',"version":"1.0"' : "", "}");
    }

    /// @dev `web3://<premises>:<chainid>` — the origin a wallet injects into.
    function _origin() private view returns (string memory) {
        return string.concat("web3://", LibNum.hexAddr(PREMISES), ":", block.chainid.str());
    }

    /// @dev `eip155:<chainid>:<hub>` — this collection as its own registry.
    function _registry() private view returns (string memory) {
        return string.concat("eip155:", block.chainid.str(), ":", LibNum.hexAddr(HUB));
    }

    /// @dev A quoted hash, or `null` when the catalog did not answer.
    function _catalogHash() private view returns (string memory) {
        (bool ok, uint256 h) = _word(CATALOG, abi.encodeCall(ICatalog.catalogHash, ()));
        return ok ? string.concat('"', LibNum.hex32(bytes32(h)), '"') : "null";
    }

    function _reach(uint256 id) private view returns (address) {
        (, uint256 a) = _word(HUB, abi.encodeCall(IIntact.account, (id)));
        return address(uint160(a));
    }

    /// @dev The facts a registration carries: the Reach, the epoch, and
    ///      whether the token exists AND is Active (an unminted id reads a
    ///      zero status, which is Active's value, so existence is checked).
    function _facts(uint256 id) private view returns (address reach, uint64 epoch, bool active) {
        (bool okO, uint256 owner_) = _word(HUB, abi.encodeCall(IIntact.ownerOf, (id)));
        (, uint256 a) = _word(HUB, abi.encodeCall(IIntact.account, (id)));
        (bool okE, uint256 e) = _word(HUB, abi.encodeCall(IIntact.custodyEpoch, (id)));
        (bool okS, uint256 s) = _word(HUB, abi.encodeCall(IIntact.statusOf, (id)));
        reach = address(uint160(a));
        epoch = okE ? uint64(e) : 0;
        active = okO && owner_ != 0 && okS && s == 0;
    }

    /// @dev `extcodesize` AND a raw staticcall; one word back, or no answer.
    function _word(address target, bytes memory data) private view returns (bool ok, uint256 w) {
        if (target.code.length == 0) return (false, 0);
        (bool s, bytes memory r) = target.staticcall(data);
        if (!s || r.length < 32) return (false, 0);
        return (true, uint256(bytes32(r)));
    }
}
