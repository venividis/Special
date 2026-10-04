// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  Rights — the bits `rightsOf` answers with, and the two words every
  satellite is allowed to use

  DESIGN.md §2. One predicate on the hub, `rightsOf(id, actor)`, says what
  an address may do with a token; every contract consumes it and none
  re-derives it. The bits are constants here so the hub, the Catalog (which
  mirrors them into `services.json`) and the page agree on the numbering by
  construction rather than by copying.

  Satellites do not read the bits for authority. They use one of two words:

      holds(id, who)   ownerOf(id) == who
      acts(id, who)    holds || who == account(id)   — the holder or the
                       token's own Reach, never a renter, operator, approvee
                       or session key directly (a session acts only AS the
                       Reach, through executeAsSession)

  Both are here as helpers over the hub so no satellite spells them out
  differently. Strict `holds` is required for grants, seals, the steward,
  key binding, guardian/user/wallet, a token's first launch, and listing.

  Origin: NEW for INTACT (design B's `Rights` library).
───────────────────────────────────────────────────────────────────────────*/

interface IRightsHub {
    function ownerOf(uint256 id) external view returns (address);
    function account(uint256 id) external view returns (address);
}

library Rights {
    uint16 internal constant R_HOLD     = 1;    // ownerOf
    uint16 internal constant R_ACCOUNT  = 2;    // account(id), the Reach — never a browser wallet
    uint16 internal constant R_USE      = 4;    // live ERC-4907 user (or Roles.recipientOf(USER))
    uint16 internal constant R_CUSTODY  = 8;    // getApproved or an epoch-keyed operator: transfer only
    uint16 internal constant R_ROLE     = 16;   // any live ERC-7432 role (guarded read)
    uint16 internal constant R_DELEGATE = 32;   // delegate.xyz v2, viewing right only
    uint16 internal constant R_GUARDIAN = 64;   // guardianOf(id)
    uint16 internal constant R_SESSION  = 128;  // Reach.sessionCurrent(actor): a hint, the Reach enforces

    /// @dev `ownerOf` reverts for a token that does not exist; a satellite
    ///      asking about one gets `false`, not a revert, so a page can ask
    ///      about any id.
    function holds(address hub, uint256 id, address who) internal view returns (bool) {
        if (who == address(0)) return false;
        (bool ok, bytes memory ret) =
            hub.staticcall(abi.encodeWithSelector(IRightsHub.ownerOf.selector, id));
        if (!ok || ret.length < 32) return false;
        return abi.decode(ret, (address)) == who;
    }

    function acts(address hub, uint256 id, address who) internal view returns (bool) {
        if (holds(hub, id, who)) return true;
        return who != address(0) && IRightsHub(hub).account(id) == who;
    }

    function has(uint16 bits, uint16 bit) internal pure returns (bool) {
        return bits & bit != 0;
    }
}
