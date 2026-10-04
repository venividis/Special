// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IGrip — the hand that only closes

  DESIGN.md §9.3; IPSEITY GripVault.sol verbatim, salt only. Read the ABI:
  there is no function on this contract that moves an asset out of it, for
  anybody, ever. `tools/verify-vault.mjs` enumerates every selector of the
  compiled contract against this interface and asserts none moves an
  asset; `supportsInterface` declines 0x51945447 (IERC6551Executable) so a
  client that checks before calling `execute` is told the truth up front.
───────────────────────────────────────────────────────────────────────────*/
interface IGrip {
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function owner() external view returns (address);
    function holdings(address[] calldata assets) external view returns (uint256 ether_, uint256[] memory balances);
    function isOneWay() external pure returns (bool);
    function state() external pure returns (uint256);                                   // always 0
    function isValidSigner(address, bytes calldata) external pure returns (bytes4);     // always 0
    function isValidSignature(bytes32, bytes calldata) external pure returns (bytes4);  // always 0xffffffff
    function supportsInterface(bytes4 id) external pure returns (bool);
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4);
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4);
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4);
}
