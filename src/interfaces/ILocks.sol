// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  ILocks — cliff and linear locks with a fixed beneficiary

  DESIGN.md §9.3; from MASTER protocol/TimeVault.sol (custom errors, the
  world-ledger dropped) plus IPSEITY Locker.give. Frozen after wave 0.
  `lock` pulls by exact delta; `release` is permissionless and pays only
  the committed beneficiary; `extend` is forward-only (the Ratchet rule
  with the 10-year cap); `give` moves the beneficiary only INTO a canonical
  Reach of this collection; `commitmentOf` is the rolling hash the
  fingerprint reads.
───────────────────────────────────────────────────────────────────────────*/

struct Lock {
    address depositor;
    address beneficiary;
    address asset;         // address(0) = native
    uint112 amount;
    uint112 released;
    uint64  start;
    uint64  cliff;
    uint64  end;
    bool    linear;
}

interface ILocksEvents {
    event Locked(uint256 indexed id, address indexed beneficiary, address indexed asset, address depositor, uint256 amount, uint64 start, uint64 cliff, uint64 end, bool linear);
    event Released(uint256 indexed id, address indexed beneficiary, uint256 amount);
    event Extended(uint256 indexed id, uint64 previousEnd, uint64 newEnd);
    event Given(uint256 indexed id, address indexed from, address indexed to);

    error NothingReleasable();
    error UnsupportedSchedule();
    error ZeroAmount();
    error ZeroAddress();
    error WrongValue();
    error NotBeneficiary();
    error RatchetOnly();
    error TooLong();
    error NotCanonicalReach(address to);
    error TransferFailed();
    error Reentrancy();
}

interface ILocks is ILocksEvents {
    function lock(address asset, uint112 amount, address beneficiary, uint64 start, uint64 cliff, uint64 end, bool linear)
        external payable returns (uint256 id);                              // anyone
    function release(uint256 id) external returns (uint256 amount);        // anyone → the beneficiary
    function releasable(uint256 id) external view returns (uint256);
    function extend(uint256 id, uint64 newEnd) external;                   // beneficiary; forward only
    function give(uint256 id, address newBeneficiary) external;            // beneficiary; only into a canonical Reach
    function commitmentOf(address beneficiary) external view returns (bytes32);
    function lockOf(uint256 id) external view returns (Lock memory);
    function lockCount() external view returns (uint256);
    function lockCountOf(address beneficiary) external view returns (uint256);
    function lockIdOf(address beneficiary, uint256 index) external view returns (uint256);
    function liability(address asset) external view returns (uint256);
    function MAX_TERM() external view returns (uint64);                    // 3650 days
    function HUB() external view returns (address);
}
