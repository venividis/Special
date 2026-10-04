// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {KeyValue, IDecentralizedApp} from "./Standards.sol";

/*───────────────────────────────────────────────────────────────────────────
  The site's view of the collection.

  Origin: IPSEITY src/interfaces/Site.sol, adapted. Five contracts render
  this site and they read the same things; a page that declares its own
  copy of an interface keeps compiling after the contract it reads has
  changed shape, and then serves a number that means something else.

  DESIGN.md §5 names the surfaces (Engine shards and panels, Renderer
  faces, Crest, Catalog state block, Premises route table, AgentCard) but
  not every signature. Where it is silent the shapes below are U0 choices
  in the IPSEITY style; Site.sol is NOT in the cross-wave frozen set, so
  U7 may extend it (never rename what is here) with a note in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

/// @notice What `Catalog.stateOf` gathers for one token, each satellite
///         read behind `extcodesize` AND `try/catch`. A clear `reported`
///         bit means "not reported", never "0".
struct TokenState {
    uint256 id;
    address owner;
    address reach;
    address grip;
    uint64  epoch;
    uint8   status;
    uint64  sealedUntil;
    uint64  marketSealedUntil;
    uint64  userExpires;
    uint64  transferSealUntil;
    bool    locked;
    bool    marketOpen;
    bytes32 fingerprint;
    /// @dev bit per satellite actually answered: 1 reach, 2 pool, 4 parley,
    ///      8 postage, 16 locks, 32 launchpad, 64 steward, 128 router,
    ///      256 market, 512 roles, 1024 keys, 2048 nameplate, 4096 agentcard
    uint32  reported;
}

interface IEngine {
    function headBytes() external view returns (bytes memory);
    function bodyBytes() external view returns (bytes memory);
    function panel(uint256 i) external view returns (bytes memory);          // gzip bytes of panel i
    function panelHash(uint256 i) external view returns (bytes32);           // keccak of the inflated panel
    function panelCount() external pure returns (uint256);                   // 6
    function inflatedSize() external view returns (uint32);
    function engineHash() external view returns (bytes32);                   // keccak of the inflated shell
    function frozen() external view returns (bool);
    function sizes() external view returns (uint256 headSize, uint256 bodySize);
    function shardCount() external view returns (uint256 headShards, uint256 bodyShards);
    /// @dev U7 addition: keccak of every stored shard (head, body, panels) for /manifest.
    function shardHashes() external view returns (bytes32[] memory);
}

interface IRenderer {
    /// @dev The document before it is base64'd into a data: URI — the same
    ///      bytes `/token/<id>/live` serves, one step earlier.
    function document(uint256 id) external view returns (bytes memory);
    function tokenURIAt(uint256 id, uint8 face) external view returns (string memory);
    function faceCount() external pure returns (uint256);                    // 3
    function collectionURI() external view returns (string memory);
    function collectionDocument() external view returns (bytes memory);      // the `/` page
    function traitMetadataURI() external pure returns (string memory);
    function HUB() external view returns (address);
    function ENGINE() external view returns (address);
    function CREST() external view returns (address);
    function CATALOG() external view returns (address);
    function AGENTCARD() external view returns (address);                    // U7 addition; codeless until U17
}

interface ICrest {
    /// @notice A deterministic ≤ 4 KB SVG still; every label escaped.
    function svg(uint256 id, uint64 epoch, uint8 status, uint64 sealedUntil) external view returns (bytes memory);
}

interface ICatalog {
    function state(uint256 id) external view returns (bytes memory);           // the `window.INTACT={…}` script body
    function stateOf(uint256 id) external view returns (TokenState memory);
    function services() external view returns (bytes memory);                  // services.json
    function servicesOf(uint256 id) external view returns (bytes memory);      // /token/<id>/services.json
    function open(uint256 from) external view returns (bytes memory);          // /open, 48 per page
    function venues() external view returns (bytes memory);                    // hooklist shape, from Router.venues()
    function knownDelegates() external pure returns (bytes32[] memory codehashes, string[] memory names);
    function verbWord(uint8 verb) external pure returns (string memory);
    function catalogHash() external view returns (bytes32);
    function bands() external pure returns (uint8[] memory band, uint256[] memory chainId, uint256[] memory lo, uint256[] memory hi);
    function routes() external pure returns (bytes memory);                   // U7 addition: the route templates as a JSON array
    function HUB() external view returns (address);
}

interface IPremises is IDecentralizedApp {
    function resolveMode() external pure returns (bytes32);                    // "5219", never removed
    function manifest() external view returns (bytes memory);                  // /manifest
    function HUB() external view returns (address);
    function RENDERER() external view returns (address);
    function ENGINE() external view returns (address);
    function CATALOG() external view returns (address);
    function AGENTCARD() external view returns (address);                      // may be codeless until U17
    function CREST() external view returns (address);                          // U7 addition: /token/<id>/crest.svg is drawn here
}

interface IAgentCard {
    function registration(uint256 id) external view returns (bytes memory);   // ERC-8004 registration-v1, face 2
    function card(uint256 id) external view returns (bytes memory);           // A2A agent card
    function llms(uint256 id) external view returns (bytes memory);
    function llmsCollection() external view returns (bytes memory);
    function manifestHash(uint256 id) external view returns (bytes32);
}
