// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev A contract that claims to be the NameWrapper: it answers `ownerOf`
///      and `names` with whatever it was told, and can be made the
///      registry owner of any node its deployer controls. The resolver's
///      job is to disbelieve it, because the registry names it and not the
///      canonical wrapper. Fixture for U18.
contract EnsCounterfeitWrapper {
    mapping(uint256 => address) public ownerOf;
    mapping(bytes32 => bytes) public names;

    function setOwner(uint256 node, address to) external { ownerOf[node] = to; }
    function setName(bytes32 node, bytes calldata name) external { names[node] = name; }

    /// @dev So the registry's `setOwner` by this contract works in a test
    ///      that hands it a node and then lets it pass the node on.
    function call(address to, bytes calldata data) external returns (bytes memory ret) {
        bool ok;
        (ok, ret) = to.call(data);
        if (!ok) revert();
    }
}

/// @dev A contract that claims, through ERC-6551's `token()`, to be some
///      token's account. It is not: the hub derives a different address
///      for that token, and that is the only opinion that counts. It
///      accepts ERC-1155 tokens so the real wrapper can hand it a name.
///      Fixture for U18.
contract EnsImpostorAccount {
    uint256 public immutable chainId;
    address public immutable coll;
    uint256 public immutable id;

    constructor(uint256 c, address k, uint256 i) { chainId = c; coll = k; id = i; }

    function token() external view returns (uint256, address, uint256) {
        return (chainId, coll, id);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
