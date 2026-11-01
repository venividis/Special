// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Template} from "../../src/lib/Template.sol";

/*───────────────────────────────────────────────────────────────────────────
  StudioFixtures — the world the Studio and its collections see (V2 W4)

  lib/Persona asks a hub four things — `ownerOf`, `account`, `feeSink`
  and (for stamps) `custodyEpoch` — and any other collection one,
  `ownerOf`. `StudioHub` is exactly that hub, with the two sale rules the
  real `_update` applies that a payee can see: the custody epoch moves and
  `feesToGrip` is cleared (src/hub/IntactBase.sol). test/mocks/SocialHub.sol
  has the same reads, but importing it compiles Parley and Postage into
  every Studio run; these suites need neither.

  `StudioNFT` is any other ERC-721 (with a burn, so a persona can lose its
  payee); `StudioAccount` a Reach or Grip that receives, refuses on
  request and relays a call; the journals answer, revert and answer short;
  `StudioReentrant` re-enters from inside its own payout; the probe
  exposes lib/Template; `StudioCodec` decodes what tokenURI encodes.
  Fixtures, not contracts: nothing here is authorised beyond what the
  suites need.
───────────────────────────────────────────────────────────────────────────*/

/// @dev A stand-in Reach or Grip: receives (or refuses), and relays one
///      call so a test can make the account act — launch, claim, mint.
contract StudioAccount {
    bool public refuse;
    error Refused();

    function setRefuse(bool r) external { refuse = r; }

    receive() external payable {
        if (refuse) revert Refused();
    }

    function exec(address to, uint256 value, bytes calldata data) external payable returns (bytes memory ret) {
        bool ok;
        (ok, ret) = to.call{value: value}(data);
        if (!ok) assembly ("memory-safe") { revert(add(ret, 32), mload(ret)) }
    }
}

/// @dev The hub as lib/Persona reads it. Each token gets two real accounts.
contract StudioHub {
    uint256 public minted;
    mapping(uint256 => address) private _owner;
    mapping(uint256 => uint64) public custodyEpoch;
    mapping(uint256 => address) private _account;
    mapping(uint256 => address) private _grip;
    mapping(uint256 => bool) public feesToGrip;

    error NoSuchToken();
    error NotHolder();

    function mint(address to) external returns (uint256 id) {
        id = ++minted;
        _owner[id] = to;
        custodyEpoch[id] = 1;
        _account[id] = address(new StudioAccount());
        _grip[id] = address(new StudioAccount());
    }

    function ownerOf(uint256 id) public view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function account(uint256 id) external view returns (address) { return _account[id]; }
    function grip(uint256 id) external view returns (address) { return _grip[id]; }

    function feeSink(uint256 id) external view returns (address) {
        ownerOf(id);
        return feesToGrip[id] ? _grip[id] : _account[id];
    }

    function setFeesToGrip(uint256 id, bool on) external {
        if (ownerOf(id) != msg.sender) revert NotHolder();
        feesToGrip[id] = on;
    }

    /// @dev What a sale does that a payee can see: the epoch moves and the
    ///      fees come back to the Reach.
    function transferFrom(address from, address to, uint256 id) external {
        if (ownerOf(id) != from || msg.sender != from) revert NotHolder();
        _owner[id] = to;
        custodyEpoch[id] += 1;
        feesToGrip[id] = false;
    }
}

/// @dev Any other ERC-721, as far as a persona needs one: an owner per id.
contract StudioNFT {
    mapping(uint256 => address) private _owner;

    error NoSuchToken();
    error NotHolder();

    function mint(address to, uint256 id) external { _owner[id] = to; }

    function ownerOf(uint256 id) external view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function transferFrom(address from, address to, uint256 id) external {
        if (_owner[id] != from || msg.sender != from) revert NotHolder();
        _owner[id] = to;
    }

    function burn(uint256 id) external {
        if (_owner[id] != msg.sender) revert NotHolder();
        delete _owner[id];
    }
}

/// @dev A Journal that answers `countOf` with whatever it was told.
contract StudioJournal {
    mapping(address => mapping(uint256 => uint256)) public countOf;

    function set(address collection, uint256 id, uint256 n) external { countOf[collection][id] = n; }
}

/// @dev A Journal whose `countOf` reverts.
contract StudioBrokenJournal {
    error Broken();

    function countOf(address, uint256) external pure returns (uint256) { revert Broken(); }
}

/// @dev A Journal whose `countOf` answers with nothing at all.
contract StudioShortJournal {
    fallback() external {}
}

/// @dev A payee that, inside its own payout, tries to claim again and to
///      mint; it keeps the refusals and returns normally, so the outer
///      claim lands and the test can read what the inner calls met.
contract StudioReentrant {
    address public target;
    uint256 public persona;
    bool public tried;
    bytes4 public claimRefusal;
    bytes4 public mintRefusal;

    function arm(address collection, uint256 persona_) external {
        target = collection;
        persona = persona_;
    }

    receive() external payable {
        if (target == address(0) || tried) return;
        tried = true;
        (bool ok, bytes memory why) = target.call(abi.encodeWithSignature("claim(uint256)", persona));
        if (!ok && why.length >= 4) claimRefusal = bytes4(why);
        (ok, why) = target.call{value: msg.value}(abi.encodeWithSignature("mint(address,uint256)", address(this), uint256(0)));
        if (!ok && why.length >= 4) mintRefusal = bytes4(why);
    }
}

/// @dev lib/Template from outside, for the filler's own suite.
contract StudioTemplateProbe {
    function fill(bytes memory t, bytes[12] memory vals) public pure returns (bytes memory out, uint256 holes) {
        Template.Values memory v = Template.Values(
            vals[0], vals[1], vals[2], vals[3], vals[4], vals[5],
            vals[6], vals[7], vals[8], vals[9], vals[10], vals[11]);
        return Template.fill(t, v);
    }

    /// @notice `t` cut to its first `len` bytes in place: the bytes after
    ///         the new end are still what `t` held there, so a matcher that
    ///         reads past the end would find them.
    function fillCut(bytes memory t, uint256 len, bytes[12] memory vals) external pure returns (bytes memory, uint256) {
        assembly ("memory-safe") { mstore(t, len) }
        return fill(t, vals);
    }
}

/// @dev What a test needs to read a tokenURI: base64 back to bytes, and
///      finding a run of bytes in another.
library StudioCodec {
    function decode64(bytes memory s) internal pure returns (bytes memory out) {
        out = new bytes(s.length / 4 * 3 + 3);
        uint256 o;
        uint256 acc;
        uint256 bits;
        for (uint256 i; i < s.length; ++i) {
            uint8 c = uint8(s[i]);
            uint256 v;
            if (c >= 65 && c <= 90) v = c - 65;
            else if (c >= 97 && c <= 122) v = c - 71;
            else if (c >= 48 && c <= 57) v = c + 4;
            else if (c == 43) v = 62;
            else if (c == 47) v = 63;
            else break;
            acc = ((acc << 6) | v) & 0xffff;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out[o++] = bytes1(uint8(acc >> bits));
            }
        }
        assembly ("memory-safe") { mstore(out, o) }
    }

    /// @notice The index of the first `needle` in `hay` at or after `from`,
    ///         or `type(uint256).max`.
    function find(bytes memory hay, bytes memory needle, uint256 from) internal pure returns (uint256) {
        if (needle.length == 0 || hay.length < needle.length) return type(uint256).max;
        for (uint256 i = from; i + needle.length <= hay.length; ++i) {
            bool same = true;
            for (uint256 j; j < needle.length; ++j) {
                if (hay[i + j] != needle[j]) { same = false; break; }
            }
            if (same) return i;
        }
        return type(uint256).max;
    }

    function has(bytes memory hay, bytes memory needle) internal pure returns (bool) {
        return find(hay, needle, 0) != type(uint256).max;
    }

    function slice(bytes memory b, uint256 from, uint256 to) internal pure returns (bytes memory out) {
        out = new bytes(to - from);
        for (uint256 i; i < out.length; ++i) out[i] = b[from + i];
    }

    /// @notice The string value of `"key":"…"` in a JSON document (no escapes).
    function field(bytes memory json, bytes memory key) internal pure returns (bytes memory) {
        bytes memory k = abi.encodePacked('"', key, '":"');
        uint256 pos = find(json, k, 0);
        if (pos == type(uint256).max) return "";
        uint256 start = pos + k.length;
        uint256 end = find(json, '"', start);
        return slice(json, start, end);
    }

    /// @notice The bytes after `prefix` in `uri`, base64-decoded.
    function payload(bytes memory uri, bytes memory prefix) internal pure returns (bytes memory) {
        if (uri.length < prefix.length || find(uri, prefix, 0) != 0) return "";
        return decode64(slice(uri, prefix.length, uri.length));
    }
}
