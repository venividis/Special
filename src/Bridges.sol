// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBridges} from "./interfaces/IBridges.sol";

/*───────────────────────────────────────────────────────────────────────────
  Bridges — the off-chain doors, written on chain (V2, unit W3; docs/V2.md §3.3)

  The engine's bytes name no host (tools/build-app.mjs refuses one in
  dist/), and an engine frozen at deployment could never follow an API
  that moves. Yet the viewer may open exactly one door off chain:
  OpenSea's order book, behind a switch that is off by default. So the
  door is a record here, under a name (keccak256("opensea.v2"), say), and
  only the Timelock writes it — after its seven-day public queue, so a
  page's door can never be swapped faster than a watcher can read the
  `Queued` event that announces it. The page reads the record, prints it
  beside the switch, and sends nothing anywhere until the viewer turns the
  switch on.

  What a record may hold is decided here, not by the page that reads it:
  1..MAX_URL bytes, beginning `https://` with at least one byte after it
  (the scheme alone names no host), printable ASCII only, with no space,
  no quote of either kind, no backslash, no `<` and no `>` — so a URL can
  sit inside a JSON string or an HTML attribute, quoted either way, with
  no escaping and no way out of it. Anything else is BadEndpoint, and an
  empty string removes the record.

  Decisions, and why:
    · `names()` returns every name that holds a record now, in the order
      each was FIRST set (the interface's sentence). A removed name is not
      returned; set again, it returns to its first place, because the list
      of names ever set only grows — the order is a fact about history and
      a removal does not rewrite history. The list grows only by Timelock
      operations, each a week apart, so it stays short.
    · `endpointOf` returns the time of the record's last write, a removal
      included: a removed record reads ("", when it was removed), a name
      never written reads ("", 0), so a page can say "closed on <date>"
      rather than pretending the door never existed.

  There is no owner but the Timelock, no other setter, no fee and no
  upgrade. The Timelock's own admin rotates only through its own queue.
───────────────────────────────────────────────────────────────────────────*/
contract Bridges is IBridges {
    /// @notice The Timelock was zero at construction.
    error ZeroAddress();

    address public immutable TIMELOCK;
    uint256 public constant MAX_URL = 256;

    struct Record {
        string url;
        uint64 updatedAt;
    }

    mapping(bytes32 => Record) private _records;
    /// @dev Every name ever set, in first-set order; `names()` filters it.
    bytes32[] private _everSet;
    mapping(bytes32 => bool) private _seen;

    constructor(address timelock) {
        if (timelock == address(0)) revert ZeroAddress();
        TIMELOCK = timelock;
    }

    /// @notice Write, replace or (with "") remove the record under `name`.
    function setEndpoint(bytes32 name, string calldata url) external {
        if (msg.sender != TIMELOCK) revert NotTimelock();
        bytes calldata u = bytes(url);
        if (u.length != 0) {
            _requireUrl(u);
            if (!_seen[name]) {
                _seen[name] = true;
                _everSet.push(name);
            }
        }
        Record storage r = _records[name];
        r.url = url;
        r.updatedAt = uint64(block.timestamp);
        emit EndpointSet(name, url);
    }

    function endpointOf(bytes32 name) external view returns (string memory url, uint64 updatedAt) {
        Record storage r = _records[name];
        return (r.url, r.updatedAt);
    }

    /// @notice Every name that holds a record, in the order first set.
    function names() external view returns (bytes32[] memory out) {
        uint256 n = _everSet.length;
        uint256 held;
        for (uint256 i; i < n; ++i) if (bytes(_records[_everSet[i]].url).length != 0) ++held;
        out = new bytes32[](held);
        uint256 k;
        for (uint256 i; i < n; ++i) {
            bytes32 name = _everSet[i];
            if (bytes(_records[name].url).length != 0) out[k++] = name;
        }
    }

    /// @dev The URL rules, one refusal each, all BadEndpoint.
    function _requireUrl(bytes calldata u) private pure {
        uint256 n = u.length;
        if (n > MAX_URL) revert BadEndpoint();
        // "https://" and at least one byte after it
        if (n <= 8 || bytes8(u[0:8]) != bytes8("https://")) revert BadEndpoint();
        for (uint256 i = 8; i < n; ++i) {
            bytes1 c = u[i];
            // printable ASCII without the space (0x21..0x7e)…
            if (c < 0x21 || c > 0x7e) revert BadEndpoint();
            // …and without the five that could leave a quoted string or a tag
            if (c == 0x22 || c == 0x27 || c == 0x5c || c == 0x3c || c == 0x3e) revert BadEndpoint();
        }
    }
}
