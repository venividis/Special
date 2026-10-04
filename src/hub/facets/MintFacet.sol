// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactBase, IntactConfig} from "../IntactBase.sol";
import {MintLogic} from "../MintLogic.sol";

/// @title MintFacet — the deployable wrapper over MintLogic for the diamond build
/// @notice Nothing is declared here: no state variable (ERC-7201 only), no
///         function (the ABI is the mixin's, which `tools/facets.mjs` routes),
///         no `diamondCut`. The constructor only pins the same configuration
///         every other facet pins; `IntactDiamond` refuses to construct unless
///         all four report one `intactConfigHash()`.
contract MintFacet is MintLogic {
    constructor(IntactConfig memory c) IntactBase(c) {}
}
