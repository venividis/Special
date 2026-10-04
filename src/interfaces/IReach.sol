// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IReach — the acting ERC-6551 account

  DESIGN.md §9.1 (seal, manifest, execute, attestation) and §9.2 (sessions
  — one system). Frozen after wave 0. Where DESIGN is silent the IPSEITY
  IpseityAccount signature is kept (guard/unguard/guardNFT/unguardNFT,
  manifest/pieces/holdings/unmeasurable, domainSeparator/attestationDigest/
  retireAttestations, the `Call` struct); `openApprovals`, `sessionOf` and
  the `OpenApproval` struct are U0 choices.

  `onlySigner` = `HUB.ownerOf(id)` exactly. Session keys act only through
  `executeAsSession` / `executeTyped`, only while `HUB.statusOf(id) ==
  Active`, only under the custody epoch they were granted in, and never
  sign ERC-1271.
───────────────────────────────────────────────────────────────────────────*/

enum SessionKind { Allowlist, Recipe }

struct Session {
    SessionKind kind;
    uint64  expires;
    uint64  epoch;            // HUB.custodyEpoch(id) at grant; dead when it moves
    uint128 nativeCap;
    uint128 nativeSpent;
    uint32  usesLeft;         // Recipe: 1..1024; Allowlist: 0 = unlimited
    uint32  minInterval;
    uint64  lastUsed;
    bytes32 dataHash;         // Recipe only
    bytes32 targetCodeHash;   // Recipe only
    address target;           // Recipe only
    uint256 exactValue;       // Recipe only
    uint32  listEpoch;        // Allowlist: epoch-keyed target/selector/spender sets ≤ 16
    bool    active;
}

/// @notice An ERC-20 cap measured by balance delta: `before − after ≤ cap`.
struct AssetCap { address asset; uint128 cap; }

struct AssetLimit { address asset; uint256 amount; }

/// @notice "Swap exactly this for at least that" — the agent's one shape.
struct TypedCall {
    address to;
    uint256 value;
    bytes   data;
    AssetLimit[] spend;       // ≤ 4: balances may fall by at most `amount`
    AssetLimit[] receiveMin;  // ≤ 4: balances must rise by at least `amount`
    uint64  deadline;
}

struct Call { address to; uint256 value; bytes data; }

struct Piece { address collection; uint256 tokenId; }

struct OpenApproval { address asset; address spender; }

interface IReachEvents {
    event Sealed(uint64 until);
    event ManifestAdded(address indexed asset);
    event ManifestRemoved(address indexed asset);
    event PieceGuarded(address indexed collection, uint256 indexed tokenId);
    event PieceReleased(address indexed collection, uint256 indexed tokenId);
    event Executed(address indexed to, uint256 value, bytes4 selector, bool sealedNow);
    event SessionGranted(address indexed key, SessionKind kind, uint64 expires, uint128 nativeCap, uint64 epoch);
    event SessionRevoked(address indexed key);
    event AllSessionsRevoked(address indexed by);
    event SessionActed(address indexed key, address indexed to, uint256 value, bytes4 selector);
    event ApprovalRecorded(address indexed asset, address indexed spender);
    event ApprovalRevoked(address indexed asset, address indexed spender, bool ok);
    event AuditEntry(bytes32 indexed root, bytes32 previous, address signer, address to, uint256 value, bytes4 selector, bytes32 dataHash, uint256 state);
    event AttestationsRetired(uint256 nonce);

    error NotSigner();
    error NotSignerOrGuardian();
    error OnlyCall();
    error EmptyBatch();
    error ListTooLong();
    error RatchetOnly();
    error TooLong();
    error IsSealed();
    error NotSafeWhileSealed(bytes4 selector);
    error ValueWhileSealed();
    error Shrank(address asset, uint256 before_, uint256 after_);
    error WentBlind(address asset);
    error BlindTarget(address asset);
    error PieceLeft(address collection, uint256 tokenId);
    error ManifestFull();
    error ManifestBusy();
    error PiecesFull();
    error AlreadyListed();
    error NotListed();
    error NotHeld();
    error Reentered();
    error OwnershipCycle();
    error WrongChain();
    error NoSession();
    error SessionExpired();
    error SessionTooLong();
    error SoldOn(uint64 granted, uint64 now_);
    error NotActive();
    error TargetNotAllowed(address target);
    error SelectorNotAllowed(bytes4 selector);
    error SpenderNotAllowed(address spender);
    error SpendCapExceeded(uint256 cap, uint256 wanted);
    error AssetCapExceeded(address asset, uint256 cap, uint256 spent);
    error Shortfall(address asset, uint256 wanted, uint256 got);
    error Overspend(address asset, uint256 cap, uint256 spent);
    error RecipeMismatch();
    error NoUsesLeft();
    error TooSoon(uint64 until);
    error Expired();
    error NoPrivilegeEscalation();
    error AllowanceNotZero(address asset, address spender);
    error LedgerFull();
    error NotEntitled();
}

interface IReach is IReachEvents {
    /*═══════════════════ ERC-6551 ═══════════════════*/
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function owner() external view returns (address);
    function state() external view returns (uint256);
    function isValidSigner(address signer, bytes calldata context) external view returns (bytes4);
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external payable returns (bytes memory);
    function executeBatch(Call[] calldata calls) external payable returns (bytes[] memory);

    /*═══════════════════ the measured seal (§9.1) ═══════════════════*/
    function seal(uint64 until) external;
    function sealMax() external;                       // signer, hub (panic) or guardian
    function sealedUntil() external view returns (uint64);
    function isSealed() external view returns (bool);
    function guard(address asset) external;
    function unguard(address asset) external;
    function guardNFT(address collection, uint256 tokenId) external;
    function unguardNFT(uint256 index) external;
    function manifest() external view returns (address[] memory);
    function pieces() external view returns (Piece[] memory);
    function holdings() external view returns (uint256 ether_, address[] memory assets, uint256[] memory balances, bool[] memory measured);
    function unmeasurable() external view returns (address[] memory);
    function MAX_SEAL() external view returns (uint64);
    function MAX_MANIFEST() external view returns (uint256);
    function MAX_PIECES() external view returns (uint256);

    /*═══════════════════ sessions — one system (§9.2) ═══════════════════*/
    function grantSession(
        address key, uint64 expires, uint128 nativeCap, AssetCap[] calldata caps,
        address[] calldata targets, bytes4[] calldata selectors, uint32 minInterval, uint32 uses
    ) external;
    function grantRecipe(
        address key, uint64 expires, address target, bytes32 dataHash, uint256 exactValue, uint32 uses, uint32 minInterval
    ) external;
    function revokeSession(address key) external;      // signer or guardian
    function revokeAllSessions() external;             // signer, hub (panic) or guardian
    function executeAsSession(address to, uint256 value, bytes calldata data) external returns (bytes memory);
    function executeTyped(TypedCall calldata c) external returns (bytes memory);   // signer or session
    function sessionAllows(address key, address to, bytes4 selector) external view returns (bool);
    function sessionExposure(address key) external view returns (uint256 nativeWorst, AssetCap[] memory);
    function sessionCurrent(address key) external view returns (bool);
    function sessionOf(address key) external view returns (Session memory);
    function sessionCaps(address key) external view returns (AssetCap[] memory);
    function MAX_SESSION() external view returns (uint64);
    function MAX_LIST() external view returns (uint256);
    function MAX_BATCH() external view returns (uint256);

    /*═══════════════════ the open-approval ledger (§9.1) ═══════════════════*/
    function openApprovals() external view returns (OpenApproval[] memory);
    function openApprovalsRoot() external view returns (bytes32);
    function revokeOpenApprovals() external;
    function MAX_LEDGER() external view returns (uint256);

    /*═══════════════════ audit and attestation (§9.1) ═══════════════════*/
    function auditRoot() external view returns (bytes32);
    function attestationNonce() external view returns (uint256);
    function retireAttestations() external;
    function domainSeparator() external view returns (bytes32);
    function attestationDigest(string memory purpose, bytes32 payload, uint64 deadline) external view returns (bytes32);
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4);
    function supportsInterface(bytes4 id) external pure returns (bool);

    /*═══════════════════ receiving ═══════════════════*/
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4);
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4);
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external returns (bytes4);

    function HUB() external view returns (address);
}
