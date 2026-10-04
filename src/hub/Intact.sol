// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IntactBase, IntactConfig} from "./IntactBase.sol";
import {CoreLogic} from "./CoreLogic.sol";
import {RightsLogic} from "./RightsLogic.sol";
import {MintLogic} from "./MintLogic.sol";
import {SiteLogic} from "./SiteLogic.sol";

/*───────────────────────────────────────────────────────────────────────────
  Intact — the hub, as one contract

  The same four mixins the facets wrap, assembled into a monolith. It is
  always built, always run against the whole suite (INTACT_IMPL=monolith),
  and measured on every compile: DESIGN.md §0's ship rule says it ships
  when its runtime is ≤ 24,000 bytes and the diamond ships otherwise. The
  choice is a flag at deployment, never a rewrite — every satellite holds
  `HUB` as an immutable and every selector is identical in both builds,
  which `tools/facets.mjs` derives from THIS contract's ABI.

  `tools/compile.mjs` lists this contract alone as measured-not-gated:
  over EIP-170 it is still compiled and tested, and the ship rule decides.
───────────────────────────────────────────────────────────────────────────*/
contract Intact is CoreLogic, RightsLogic, MintLogic, SiteLogic {
    /// @param c            the pinned world (one struct, so nothing is transposed)
    /// @param initialPrice the mint price from the first block, so there is
    ///                     no free window between deployment and the
    ///                     Timelock's first `setPrice` seven days later
    constructor(IntactConfig memory c, uint256 initialPrice) IntactBase(c) {
        _s().price = initialPrice;
        emit PriceSet(initialPrice);
    }
}
