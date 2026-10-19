// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Metadata, IERC2981} from "./Standards.sol";

/*───────────────────────────────────────────────────────────────────────────
  ICollection — a collection whose every token is a website (V2, unit W4)

  docs/V2.md §3.4. The Studio deploys one per launch. A token's
  `tokenURI` is JSON whose `image` is the art template filled for that
  token and whose `animation_url` is the page template filled for that
  token, both `data:` URIs built on chain, so every marketplace and wallet
  that renders `animation_url` renders the token's site, its room and its
  "mint yours" with no server.

  Templates are bytes with holes, filled by exact match; every value is
  printed as plain ASCII (decimal or 0x-hex), never markup:
      {{id}} {{seed}} {{holder}} {{epoch}} {{memories}} {{minted}}
      {{supply}} {{price}} {{collection}} {{creator}} {{room}} {{chain}}
  `{{memories}}` is `Journal.countOf(this, id)`; `{{room}}` is Agora's
  `collectionKey(this)`; `{{creator}}` the creator persona (lib/Persona).

  Money. A mint pays exactly `price`. Of it, `referralBps` is owed to the
  `via` persona (when `via` names a token whose payee is neither the
  minter nor `to`; otherwise the share stays with the creator) and the
  rest to the creator persona. Nothing is pushed: `claim(persona)` is
  anyone's and pays that persona's payee — for a hub token its fee sink,
  so the money follows the token — what it is owed. ERC-2981 names the
  creator's payee at the moment it is asked.

  The custody epoch starts at 1 at mint and moves on every transfer;
  Agora and the Journal key what they stamp by it.

  Frozen after V2 wave 0: additive changes only, recorded in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

/// @notice What a creator launches. Checked once, by the Studio.
struct CollectionSpec {
    string  name;          // 1..48 bytes
    string  symbol;        // 1..12 bytes
    string  description;   // ≤ 1,024 bytes
    uint32  supply;        // 1..1,000,000
    uint128 price;         // wei per mint; 0 = free
    uint64  opensAt;       // 0 = at launch
    uint64  closesAt;      // 0 = never; else > the opening
    uint32  perWallet;     // 0 = no limit; counted per minting address
    uint16  referralBps;   // ≤ 2,000 of each mint, to the referring persona
    uint16  royaltyBps;    // ≤ 1,000, ERC-2981, to the creator's payee
    bytes   page;          // the site template: HTML with holes, 1..24,000 bytes, ≤ 256 holes
    bytes   art;           // the image template: SVG with holes, ≤ 12,000 bytes, ≤ 256 holes; empty = the default orb
}

interface ICollectionEvents {
    event Minted(uint256 indexed id, address indexed to, uint256 indexed via, uint256 paid, uint256 referral);
    event Claimed(uint256 indexed persona, address indexed payee, uint256 amount);

    error NotOpen(uint64 opensAt);
    error Closed(uint64 closesAt);
    error SoldOut();
    error WrongPrice(uint256 expected, uint256 provided);
    error WalletLimit(uint32 limit);
    error NothingOwed();
    error NoPayee(uint256 persona);
    error TransferFailed();
    error Reentrancy();
}

interface ICollection is ICollectionEvents, IERC721Metadata, IERC2981 {
    /// @notice Mint the next token to `to`. `via` is the referring persona,
    ///         or 0 for none.
    function mint(address to, uint256 via) external payable returns (uint256 id);
    function claim(uint256 persona) external returns (uint256 amount);
    function owed(uint256 persona) external view returns (uint256);
    function custodyEpoch(uint256 id) external view returns (uint64);
    function seedOf(uint256 id) external view returns (bytes32);
    function mintedBy(address minter) external view returns (uint32);
    function totalSupply() external view returns (uint256);
    function spec() external view returns (CollectionSpec memory);
    function creator() external view returns (uint256 persona);
    function room() external view returns (uint256);
    function contractURI() external view returns (string memory);
    function STUDIO() external view returns (address);
}
