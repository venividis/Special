// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDiamond, IDiamondLoupe} from "../interfaces/Standards.sol";
import {IIntact} from "../interfaces/IIntact.sol";
import {IntactStorage} from "./IntactStorage.sol";

/*───────────────────────────────────────────────────────────────────────────
  IntactDiamond — an EIP-2535 diamond with the cut welded shut

  Origin: ANIMA contracts/diamond/AnimaDiamond.sol and AnimaLoupeFacet.sol,
  adapted for INTACT U1: the loupe is folded into the diamond itself (so
  the diamond form stays at the inventory's count of deployables), the
  constructor takes the cut and the initial price and writes the initial
  namespaced storage ITSELF — there is no initialiser contract and no
  delegatecall at construction — and every wired facet must answer
  `intactConfigHash()`, not merely the ones that do.

  Why immutable. The usual reason to build a diamond is upgradeability,
  which is precisely the property this hub must not have: a buyer's
  guarantee that a sale revokes the seller's keys is worth exactly as much
  as the admin key that could remove it. So the facets are wired here,
  once; there is no `diamondCut`, no owner over the routing table, and no
  `delegatecall` reachable after construction other than through the
  frozen table. EIP-2535 provides for this: "A diamond that has no external
  function for adding, replacing or removing functions is immutable."

  Verifying that claim needs no trust in the deployer: `facets()` must
  resolve no selector to `diamondCut`, each facet's code must be the
  expected bytes, and test/Diamond.t.sol scans every facet's runtime for
  the four bytes of the selector besides.
───────────────────────────────────────────────────────────────────────────*/
contract IntactDiamond is IDiamond, IDiamondLoupe {
    error FunctionNotFound(bytes4 selector);
    error NoFacets();
    error NotAnAddition(FacetCutAction action);
    error FacetHasNoCode(address facet);
    error EmptyFacetCut(address facet);
    error SelectorAlreadyBound(bytes4 selector, address boundTo);
    error CutRoutesDiamondCut();
    error NoConfiguredFacet(address facet);
    error FacetConfigMismatch(address facet, bytes32 expected, bytes32 found);
    error RoutingTampered(bytes4 selector, address expected, address found);

    /// @dev keccak256("diamondCut((address,uint8,bytes4[])[],address,bytes)")[0:4].
    ///      A cut that names it is refused here; `tools/facets.mjs` refuses
    ///      it before a deployer gets this far and scans the facets' bytes.
    bytes4 internal constant DIAMOND_CUT_SELECTOR = 0x1f931c1c;

    event PriceSet(uint256 price);

    /// @param cuts         every facet, all `Add`, every selector unique across
    ///                     the set — a diamond in which two facets claim
    ///                     `balanceOf` has no principled answer to which runs
    /// @param initialPrice the one piece of initial state, written here
    constructor(FacetCut[] memory cuts, uint256 initialPrice) {
        if (cuts.length == 0) revert NoFacets();
        IntactStorage.Diamond storage $ = IntactStorage.diamond();
        bytes32 expected;

        for (uint256 i; i < cuts.length; ++i) {
            FacetCut memory cut = cuts[i];
            if (cut.action != FacetCutAction.Add) revert NotAnAddition(cut.action);
            if (cut.facetAddress.code.length == 0) revert FacetHasNoCode(cut.facetAddress);
            if (cut.functionSelectors.length == 0) revert EmptyFacetCut(cut.facetAddress);

            if ($.selectorsOf[cut.facetAddress].length == 0) {
                // Every facet carries the pinned world as its own immutables
                // (free under delegatecall). The price of per-facet immutables
                // is facets deployed disagreeing, which would give the token
                // accounts whose address depends on which function you asked.
                // So it is checked here, once, permanently.
                bytes32 found = _configHashOf(cut.facetAddress);
                if (expected == bytes32(0)) expected = found;
                else if (found != expected) revert FacetConfigMismatch(cut.facetAddress, expected, found);
                $.facetAddresses.push(cut.facetAddress);
            }
            for (uint256 j; j < cut.functionSelectors.length; ++j) {
                bytes4 selector = cut.functionSelectors[j];
                if (selector == DIAMOND_CUT_SELECTOR) revert CutRoutesDiamondCut();
                address bound = $.facetOf[selector];
                if (bound != address(0)) revert SelectorAlreadyBound(selector, bound);
                $.facetOf[selector] = cut.facetAddress;
                $.selectorsOf[cut.facetAddress].push(selector);
            }
        }

        // The initial state, written by the constructor and nobody else: no
        // initialiser, so nothing ever runs by delegatecall outside the table.
        IntactStorage.layout().price = initialPrice;
        emit PriceSet(initialPrice);

        // EIP-2535: required for every cut, "including cuts in the
        // constructor". For an immutable diamond it is the only one that
        // will ever be emitted — the permanent, indexable record of what
        // this address is.
        emit DiamondCut(cuts, address(0), "");

        // Re-read the table against the cut the event announced, so that the
        // event is true by construction and verifying a deployment is a
        // matter of reading the chain rather than trusting the deployer.
        for (uint256 i; i < cuts.length; ++i) {
            bytes4[] memory selectors = cuts[i].functionSelectors;
            for (uint256 j; j < selectors.length; ++j) {
                address bound = $.facetOf[selectors[j]];
                if (bound != cuts[i].facetAddress) revert RoutingTampered(selectors[j], cuts[i].facetAddress, bound);
            }
        }
    }

    function _configHashOf(address facet) private view returns (bytes32) {
        (bool ok, bytes memory data) = facet.staticcall(abi.encodeCall(IIntact.intactConfigHash, ()));
        if (!ok || data.length != 32) revert NoConfiguredFacet(facet);
        return abi.decode(data, (bytes32));
    }

    /*═══════════════════ the loupe, natively ═══════════════════*/

    /*  EIP-2535 requires a diamond to report its immutable functions —
        those defined on the diamond contract itself, whose facet address is
        the diamond's own. These four views are exactly that set, and they
        are the only functions this contract has besides `fallback`.      */

    function facets() external view returns (Facet[] memory facets_) {
        IntactStorage.Diamond storage $ = IntactStorage.diamond();
        uint256 n = $.facetAddresses.length;
        facets_ = new Facet[](n);
        for (uint256 i; i < n; ++i) {
            address facet = $.facetAddresses[i];
            facets_[i] = Facet({facetAddress: facet, functionSelectors: $.selectorsOf[facet]});
        }
    }

    function facetFunctionSelectors(address facet) external view returns (bytes4[] memory) {
        return IntactStorage.diamond().selectorsOf[facet];
    }

    function facetAddresses() external view returns (address[] memory) {
        return IntactStorage.diamond().facetAddresses;
    }

    function facetAddress(bytes4 selector) external view returns (address) {
        return IntactStorage.diamond().facetOf[selector];
    }

    /*═══════════════════ the only other code ═══════════════════*/

    /// @dev `payable` so a facet function may accept value (`mint`). A bare
    ///      ETH transfer still reverts: empty calldata is selector
    ///      `0x00000000`, which is bound to nothing — exactly as the
    ///      monolith, which has no `receive`, refuses it.
    fallback() external payable {
        address facet = IntactStorage.diamond().facetOf[msg.sig];
        if (facet == address(0)) revert FunctionNotFound(msg.sig);
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
