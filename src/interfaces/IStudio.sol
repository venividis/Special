// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CollectionSpec} from "./ICollection.sol";

/*───────────────────────────────────────────────────────────────────────────
  IStudio — collections launched from tokens (V2, unit W4)

  docs/V2.md §3.4, beside the coin launchpad, which stays. The creator is
  a token, not a wallet: `launch(creator, spec, salt)` is called by
  whoever acts as the `creator` persona (lib/Persona: for a hub token its
  holder or its Reach; for any other ERC-721 its holder). It deploys one
  Collection at an address that depends on the Studio, the creator and
  the salt alone (`predict`), so a mint link can be shared before the
  launch lands. The collection is registered here (`isCollection`), which
  is what admits its tokens to Agora's commons.

  Lineage. A collection launched from a token of another collection has
  that collection as its parent (`parentOf`); its room links the
  parent's, and a page draws the family tree from `Launched` logs.

  There is no admin and no fee: the Studio holds nothing after `launch`
  returns, and a Collection's money is owed to personas only.

  Frozen after V2 wave 0: additive changes only, recorded in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

interface IStudioEvents {
    event Launched(address indexed collection, uint256 indexed creator, address indexed parent, string name, string symbol, uint32 supply, uint128 price);

    error NotYours();
    error BadName();
    error BadSymbol();
    error BadDescription();
    error BadSupply();
    error BadWindow();
    error BadShare();
    error BadPage();
    error BadArt();
    error SaltUsed(address collection);
    error DeployFailed();
    error Reentrancy();
}

interface IStudio is IStudioEvents {
    function launch(uint256 creator, CollectionSpec calldata spec, bytes32 salt) external returns (address collection);
    function predict(uint256 creator, bytes32 salt) external view returns (address);
    function isCollection(address collection) external view returns (bool);
    function parentOf(address collection) external view returns (address);
    function collectionCount() external view returns (uint256);
    function collectionAt(uint256 index) external view returns (address);
    function collectionsOf(uint256 creator) external view returns (address[] memory);
    function HUB() external view returns (address);
    function JOURNAL() external view returns (address);
    function AGORA() external view returns (address);
}
