// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC7432} from "./Standards.sol";

/*───────────────────────────────────────────────────────────────────────────
  IRoles — ERC-7432 roles that lock the token instead of escrowing it
  (post-MVB, U16)

  DESIGN.md §2 ("Role holder"), §3 row 29; from ANIMA AnimaRoles.sol.
  Revocable-only in v1: `revocable == false` reverts `IrrevocableUnsupported`.
  Grants are stamped with the custody epoch; `unlockToken` is permissionless
  once every role is expired or stale; `recipientOf(USER)` feeds the hub's
  ERC-4907 shim. The `USER` role id is `keccak256("USER")` (U0 choice).
───────────────────────────────────────────────────────────────────────────*/
interface IRoles is IERC7432 {
    error UnsupportedCollection(address tokenAddress);
    error NotOwnerOrApproved(uint256 tokenId, address caller);
    error ExpirationInThePast(uint64 expirationDate);
    error IrrevocableUnsupported();
    error StillLocked(uint256 tokenId, uint64 until);
    error ZeroRecipient();
    error NotLocked(uint256 tokenId);

    function USER() external view returns (bytes32);                                  // keccak256("USER")
    function hasRole(uint256 tokenId, bytes32 roleId, address account) external view returns (bool);
    function liveRoleCount(uint256 tokenId) external view returns (uint256);
    function roleEpoch(uint256 tokenId, bytes32 roleId) external view returns (uint64);
    function supportsInterface(bytes4 interfaceId) external pure returns (bool);
    function HUB() external view returns (address);
}
