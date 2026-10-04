// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  Ratchet — the one rule for every time promise in INTACT

  Five things in this protocol are promises about time: the Reach's seal,
  the market's seal, the hub's transfer seal, a Locks entry's end, and the
  LPCustodian's unlock. Every one of them had, in the donor collections, its
  own three-line check — and one of them (IPSEITY's session expiry) had no
  ceiling at all, accepted 2^64-1, and produced a key that outlived everyone
  who could have revoked it. An adversarial review found it because it was
  the odd one out. The fix is to make there be no odd one out.

  So this is the rule, stated once:

      proposed > current          a promise only ever lengthens
      proposed > now              a promise about the past is not a promise
      proposed <= now + cap       and no promise outlives the system

  Two errors, `RatchetOnly` and `TooLong`, used by every caller, so a page
  can render one sentence ("sealed until") for every kind of seal and a test
  file (test/Ratchet.t.sol) can prove the property for all of them at once.

  Origin: NEW for INTACT, from design B's "one ratchet rule"; the caps are
  the measured donors' (IPSEITY MAX_SEAL / MAX_BOND = 365 days, MASTER
  TimeVault = 3650 days).
───────────────────────────────────────────────────────────────────────────*/
library Ratchet {
    /// @notice A proposal that does not lengthen the promise, or that names
    ///         a moment already past.
    error RatchetOnly();
    /// @notice A proposal past the cap: longer than any promise here may be.
    error TooLong();

    /// @dev The cap on every seal: the Reach, the market, the transfer.
    uint64 internal constant SEAL_CAP = 365 days;
    /// @dev The cap on every lock: Locks entries and LPCustodian unlocks.
    uint64 internal constant LOCK_CAP = 3650 days;

    /// @notice The only way a time promise moves.
    /// @param current  the promise as it stands (zero when none was made)
    /// @param proposed the promise wanted
    /// @param cap      how far past now a promise may reach
    /// @return proposed, unchanged, once every check has passed — so a
    ///         caller writes `x = Ratchet.raise(x, until, cap)` and cannot
    ///         forget to store it.
    function raise(uint64 current, uint64 proposed, uint64 cap) internal view returns (uint64) {
        if (proposed <= current) revert RatchetOnly();
        if (proposed <= block.timestamp) revert RatchetOnly();
        if (proposed > block.timestamp + cap) revert TooLong();
        return proposed;
    }

    /// @notice Whether a promise is in force right now.
    function live(uint64 until) internal view returns (bool) {
        return until > block.timestamp;
    }
}
