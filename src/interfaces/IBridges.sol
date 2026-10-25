// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IBridges — the off-chain doors, written on chain (V2, unit W3)

  docs/V2.md §3.3. The engine's bytes name no host (tools/build-app.mjs
  refuses one in dist/), and a frozen engine could never follow an API
  that moves. So the one door the viewer may open off chain — OpenSea's
  order book, behind a switch that is off by default — is a record here,
  under a name (keccak256("opensea.v2"), say), that only the Timelock
  writes, after its seven-day public queue. The page reads it, prints it
  beside the switch, and sends nothing anywhere until the viewer turns
  the switch on.

  A URL is 1..MAX_URL bytes, begins `https://`, and holds printable ASCII
  only, with no space, quote, backslash, `<` or `>` — so it can sit in a
  JSON string or an attribute without escaping. "" removes the record.

  Frozen after V2 wave 0: additive changes only, recorded in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

interface IBridgesEvents {
    event EndpointSet(bytes32 indexed name, string url);

    error NotTimelock();
    error BadEndpoint();
}

interface IBridges is IBridgesEvents {
    function endpointOf(bytes32 name) external view returns (string memory url, uint64 updatedAt);
    function setEndpoint(bytes32 name, string calldata url) external;   // TIMELOCK only
    /// @notice Every name that holds a record, in the order first set.
    function names() external view returns (bytes32[] memory);
    function MAX_URL() external view returns (uint256);                 // 256
    function TIMELOCK() external view returns (address);
}
