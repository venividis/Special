// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  Transient — every EIP-1153 slot this protocol uses, named in one place

  Cancun gave contracts a second storage that lives for one transaction
  and costs 100 gas to touch. It is the right medium for a re-entrancy
  lock and for a single-use commitment, and the wrong medium for anything
  else, because two purposes sharing a slot by accident is a bug no test
  of either purpose will find — each is correct alone and they fail only
  when composed, in a transaction that touches both.

  So the slots are not chosen by the contracts that use them. They are
  listed here, one per purpose, each derived from a name by one formula
  (`keccak256(name) - 1`, the ERC-7201 habit: a hash minus one is never
  the preimage of any Solidity-chosen storage slot), and test/Transient.t.sol
  proves that every registered slot equals the formula, that no two
  purposes share one, and that every lock is released on exit — including
  the exit that is a revert, which the EVM's own journal handles and which
  the test asserts rather than assumes.

  A contract that needs a slot adds a line to the registry below. A slot
  that is not in the registry is not a slot this protocol uses.

  Origin: NEW for INTACT (design B's `Transient` library; the single Pool
  lock of C1 was its first use). Replaces OpenZeppelin's
  ReentrancyGuardTransient in every contract ported from ANIMA.
───────────────────────────────────────────────────────────────────────────*/
library Transient {
    /// @notice The slot was already held: a call re-entered a locked path.
    error Reentrancy();
    /// @notice A commitment was consumed that was never made, or made twice.
    error NoCommitment();

    /*═══════════════════ the registry ═══════════════════*/

    bytes32 internal constant HUB_LOCK        = bytes32(uint256(keccak256("intact.hub.lock")) - 1);
    bytes32 internal constant POOL_LOCK       = bytes32(uint256(keccak256("intact.pool.lock")) - 1);
    bytes32 internal constant REACH_LOCK      = bytes32(uint256(keccak256("intact.reach.lock")) - 1);
    bytes32 internal constant PARLEY_LOCK     = bytes32(uint256(keccak256("intact.parley.lock")) - 1);
    bytes32 internal constant POSTAGE_LOCK    = bytes32(uint256(keccak256("intact.postage.lock")) - 1);
    bytes32 internal constant KILN_LOCK       = bytes32(uint256(keccak256("intact.kiln.lock")) - 1);
    bytes32 internal constant LAUNCHPAD_LOCK  = bytes32(uint256(keccak256("intact.launchpad.lock")) - 1);
    bytes32 internal constant LOCKS_LOCK      = bytes32(uint256(keccak256("intact.locks.lock")) - 1);
    bytes32 internal constant STEWARD_LOCK    = bytes32(uint256(keccak256("intact.steward.lock")) - 1);
    bytes32 internal constant ROUTER_LOCK     = bytes32(uint256(keccak256("intact.router.lock")) - 1);
    /// @dev The v4 `unlock` commitment: `keccak256(data)` written before
    ///      `PoolManager.unlock` and consumed in `unlockCallback`.
    bytes32 internal constant ROUTER_COMMIT   = bytes32(uint256(keccak256("intact.router.commitment")) - 1);
    bytes32 internal constant MARKET_LOCK     = bytes32(uint256(keccak256("intact.market.lock")) - 1);
    bytes32 internal constant CUSTODIAN_LOCK  = bytes32(uint256(keccak256("intact.custodian.lock")) - 1);
    bytes32 internal constant TIMELOCK_LOCK   = bytes32(uint256(keccak256("intact.timelock.lock")) - 1);

    /// @notice Every slot above, with the name it was derived from, so a
    ///         test can check the formula and the distinctness of the whole
    ///         set rather than of whichever slots it happened to think of.
    function registry() internal pure returns (bytes32[] memory slots, string[] memory names) {
        slots = new bytes32[](14);
        names = new string[](14);
        slots[0]  = HUB_LOCK;        names[0]  = "intact.hub.lock";
        slots[1]  = POOL_LOCK;       names[1]  = "intact.pool.lock";
        slots[2]  = REACH_LOCK;      names[2]  = "intact.reach.lock";
        slots[3]  = PARLEY_LOCK;     names[3]  = "intact.parley.lock";
        slots[4]  = POSTAGE_LOCK;    names[4]  = "intact.postage.lock";
        slots[5]  = KILN_LOCK;       names[5]  = "intact.kiln.lock";
        slots[6]  = LAUNCHPAD_LOCK;  names[6]  = "intact.launchpad.lock";
        slots[7]  = LOCKS_LOCK;      names[7]  = "intact.locks.lock";
        slots[8]  = STEWARD_LOCK;    names[8]  = "intact.steward.lock";
        slots[9]  = ROUTER_LOCK;     names[9]  = "intact.router.lock";
        slots[10] = ROUTER_COMMIT;   names[10] = "intact.router.commitment";
        slots[11] = MARKET_LOCK;     names[11] = "intact.market.lock";
        slots[12] = CUSTODIAN_LOCK;  names[12] = "intact.custodian.lock";
        slots[13] = TIMELOCK_LOCK;   names[13] = "intact.timelock.lock";
    }

    /// @notice The formula every registered slot is derived by.
    function slot(string memory purpose) internal pure returns (bytes32) {
        return bytes32(uint256(keccak256(bytes(purpose))) - 1);
    }

    /*═══════════════════ locks ═══════════════════*/

    /// @notice Take the lock, or revert if it is held. Pair with `exit`.
    /// @dev    A revert anywhere under the lock releases it through the
    ///         EVM's transient-storage journal; `exit` is for the success
    ///         path, so the slot is clear for the next call in the same
    ///         transaction.
    function enter(bytes32 s) internal {
        uint256 held_;
        assembly ("memory-safe") { held_ := tload(s) }
        if (held_ != 0) revert Reentrancy();
        assembly ("memory-safe") { tstore(s, 1) }
    }

    function exit(bytes32 s) internal {
        assembly ("memory-safe") { tstore(s, 0) }
    }

    function held(bytes32 s) internal view returns (bool h) {
        uint256 v;
        assembly ("memory-safe") { v := tload(s) }
        h = v != 0;
    }

    /*═══════════════════ commitments ═══════════════════*/

    /// @notice Write a value that one later call in this transaction must
    ///         present back. Used across the Uniswap v4 `unlock` boundary.
    function commit(bytes32 s, bytes32 value) internal {
        assembly ("memory-safe") { tstore(s, value) }
    }

    /// @notice Read and clear a commitment; reverts if none was made or if
    ///         the presented value is not the committed one.
    function consume(bytes32 s, bytes32 presented) internal {
        bytes32 v;
        assembly ("memory-safe") { v := tload(s) }
        if (v == bytes32(0) || v != presented) revert NoCommitment();
        assembly ("memory-safe") { tstore(s, 0) }
    }

    function peek(bytes32 s) internal view returns (bytes32 v) {
        assembly ("memory-safe") { v := tload(s) }
    }
}
