// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Minimal} from "../vendor/ERC721Minimal.sol";
import {Core} from "../interfaces/IIntact.sol";

/*───────────────────────────────────────────────────────────────────────────
  IntactStorage — the hub's two ERC-7201 namespaces

  Origin: ANIMA contracts/diamond/{AnimaStorage,DiamondStorage}.sol, adapted
  (INTACT U1): one library, two roots, no OpenZeppelin regions beside them.

  The hub exists in two builds from one source. In the diamond build no
  facet may declare a plain state variable — a `mapping` at slot 0 under
  one facet is a `mapping` at slot 0 under every facet, and they would
  corrupt each other in silence. So there are no state variables anywhere
  in src/hub/: every read and write goes through one of the two structs
  below, each at a root

      keccak256(abi.encode(uint256(keccak256(name)) - 1)) & ~0xff

  which no compiler-assigned slot and no other namespace can reach. The
  trailing byte is masked so a struct can be extended without walking into
  a neighbour. test/Diamond.t.sol asserts slots 0–2 of a working diamond
  are empty and the two roots are where this file says they are.

  The routing table is a separate namespace from the token state on
  purpose: infrastructure and product. A future field appended to `Layout`
  can never land on the facet map.

  `Layout` is DESIGN.md §4.2 in exactly that order. `Core` (the per-token
  word) is declared in IIntact.sol because `coreOf` returns it and the
  ERC-5646 fingerprint ABI-encodes it wholesale: its field order is
  normative and append-only, and it is not this file's to change.
───────────────────────────────────────────────────────────────────────────*/
library IntactStorage {
    /// @custom:storage-location erc7201:intact.storage.core
    struct Layout {
        ERC721Minimal.Store nft;                     // owner, balance, ownedAt, ownedIndex, approved (slots +0..+4)
        mapping(address => uint64) approvalEpoch;    // +5  bumped by revokeAllApprovals and holder panic
        mapping(bytes32 => uint64) operatorUntil;    // +6  keccak(owner, epoch, operator) → expiry; uint64.max = forever
        mapping(uint256 => Core) core;               // +7  the per-token word
        uint256 minted;                              // +8  ids are BAND_LO + index, never reused
        uint256 price;                               // +9  mint price, Timelock-set until sealPricing()
        address royaltyReceiver;                     // +10 ┐ ERC-2981, packed
        uint16  royaltyBps;                          //     │ ≤ 500
        bool    pricingSealed;                       //     ┘ one-way
        mapping(uint256 => string) nameTrait;        // +11 the `name` trait, ≤ 32 bytes; Core.nameHash is its keccak
    }

    /// @custom:storage-location erc7201:intact.storage.diamond
    struct Diamond {
        mapping(bytes4 => address) facetOf;
        mapping(address => bytes4[]) selectorsOf;
        address[] facetAddresses;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("intact.storage.core")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant CORE_SLOT = 0x8a04a4ff5fe2301a94986cdbfe1b6efa6476b574bcfce009276bfd71a69ba900;
    /// @dev keccak256(abi.encode(uint256(keccak256("intact.storage.diamond")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant DIAMOND_SLOT = 0x8b06ae41a12d1998e10925b8c35d8ec893156f7e7b79f14fc95ddd76211ea200;

    function layout() internal pure returns (Layout storage $) {
        assembly ("memory-safe") { $.slot := CORE_SLOT }
    }

    function diamond() internal pure returns (Diamond storage $) {
        assembly ("memory-safe") { $.slot := DIAMOND_SLOT }
    }
}
