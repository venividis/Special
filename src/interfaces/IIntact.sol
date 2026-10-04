// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IIntact — the hub token's whole public surface

  DESIGN.md §2 (authority), §3 rows 1-5, §4 (the hub in detail). This file
  is the specification every satellite compiles against and the ABI
  `tools/facets.mjs` partitions across the four facets. It is frozen after
  wave 0: a change needs a note in docs/INTERFACE-CHANGES.md and a rerun of
  every wave-1 suite (BUILD-PLAN.md "Cross-wave contract").

  The interface is flat on purpose — every function and event is spelled
  here rather than inherited from Standards.sol — so a reader sees the
  whole hub in one file and an implementation is free to inherit the ERC
  interfaces from Standards.sol (for `type(I).interfaceId`) without
  override-resolution noise. Standards.sol remains the canonical text of
  each ERC; the two are kept equal by the compiler, since the hub
  implements both.

  `Core` and `Status` are declared at file level because `coreOf(id)`
  returns the struct and `getStateFingerprint` ABI-encodes it WHOLESALE:
  the field order is normative and append-only. Reordering a field would
  silently change every token's ERC-5646 fingerprint.

  Where DESIGN.md is silent on a name the donor's existing signature is
  used (ANIMA `approvalExpiryOf`; IPSEITY's ERC-7160 verbs); where the
  donor has none, the name is chosen here and marked `(U0 choice)`.
───────────────────────────────────────────────────────────────────────────*/

/// @notice Mint sets Active; every custody change sets Paused. Sessions and
///         recipes act only while Active; the holder always can.
enum Status { Active, Paused }

/// @notice The per-token word (DESIGN §4.2). NEVER REORDER — append only.
struct Core {
    Status  status;             // Active | Paused                       (1)
    uint8   pinnedFace;         // ERC-7160 pin, reset on sale          (1)
    uint32  lockCount;          // module locks                         (4)
    uint64  custodyEpoch;       // from 1, checked increments           (8)
    uint64  transferSealUntil;  // holder ratchet ≤ 365 d               (8)
    uint64  createdAt;          //                                      (8)  = 30/32
    address guardian;           // slot 2 ─┐
    bool    guardianHold;       //         │
    bool    feesToGrip;         //         │
    uint32  launchCount;        //         ┘
    address user;               // slot 3 ─┐ ERC-4907
    uint64  userExpires;        //         ┘
    address agentWallet;        // slot 4
    address proposedWallet;     // slot 5
    bytes32 curve;              // slot 6: the ERC-7496 `curve` trait word (concentration bps in the low 17 bits)
    bytes32 nameHash;           // slot 7: keccak of the `name` trait
}

/// @notice ERC-7496 trait keys, keccak256 of the trait name (the OpenSea
///         convention the indexers read). Pinned here so the hub, the
///         Catalog and the page agree without copying hex.
library Traits {
    bytes32 internal constant CURVE              = keccak256("curve");
    bytes32 internal constant NAME               = keccak256("name");
    // validateOnSale traits (SIP-15): read-only mirrors of state
    bytes32 internal constant CUSTODY_EPOCH      = keccak256("custodyEpoch");
    bytes32 internal constant SEALED_UNTIL       = keccak256("sealedUntil");
    bytes32 internal constant MARKET_SEALED_UNTIL = keccak256("marketSealedUntil");
    bytes32 internal constant FINGERPRINT        = keccak256("fingerprint");
    bytes32 internal constant LOCKED             = keccak256("locked");
    /// @dev `curve` is a concentration in bps in the low 17 bits, 0..80,000.
    uint256 internal constant MAX_CURVE_BPS      = 80_000;
    uint256 internal constant MAX_NAME_BYTES     = 32;
}

/**
 * @title IIntactEvents — the observable surface, split out so a facet can
 *        speak the vocabulary without implementing the whole interface.
 */
interface IIntactEvents {
    /*── ERC-721 / 4906 / 4907 / 5192 / 7160 / 7496 / 7572 / 7774 / 5169 ──*/
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
    event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    event TokenUriPinned(uint256 indexed tokenId, uint256 indexed index);
    event TokenUriUnpinned(uint256 indexed tokenId);
    event TraitUpdated(bytes32 indexed traitKey, uint256 tokenId, bytes32 traitValue);
    event TraitMetadataURIUpdated();
    event ContractURIUpdated();
    event ClearPathCache(string[] paths);
    event ScriptUpdate(string[] newScriptURI);

    /*── INTACT ──*/
    event Minted(uint256 indexed id, address indexed reach, address indexed grip, uint8 band);
    event CustodyEpoch(uint256 indexed id, uint64 epoch);
    event Panicked(uint256 indexed id, uint64 epoch, address indexed by);
    event GuardianHoldSet(uint256 indexed id, bool held);
    event GuardianSet(uint256 indexed id, address indexed guardian);
    event StatusChanged(uint256 indexed id, Status previous, Status current);
    event AgentWalletProposed(uint256 indexed id, address indexed wallet);
    event AgentWalletSet(uint256 indexed id, address indexed wallet);
    event FeesToGripSet(uint256 indexed id, bool toGrip);
    event TransferSealed(uint256 indexed id, uint64 until);
    event ModuleLocked(uint256 indexed id, address indexed module, uint32 count);
    event ModuleUnlocked(uint256 indexed id, address indexed module, uint32 count);
    /// @dev ANIMA's `OperatorApprovalTimed`; `type(uint64).max` is an unbounded grant.
    event OperatorApprovalTimed(address indexed owner, address indexed operator, uint64 expiresAt);
    event AllApprovalsRevoked(address indexed owner, uint64 epoch);
    event PriceSet(uint256 price);
    event RoyaltySet(address receiver, uint16 bps);
    event PricingSealed();
    event Withdrawn(address indexed to, uint256 amount);

    /*── errors ──*/
    error NoSuchToken();
    error NotHolder();
    error NotActor();
    error NotAuthorized();
    error NotModule();
    error NotSteward();
    error NotMarket();
    error NotGuardian();
    error NotTimelock();
    error NotWallet();
    error ZeroAddress();
    error WrongPrice();
    error BandExhausted();
    error NotCanonical();
    error CanonicalAccount(address to);
    error IsLocked(uint256 id);          // DESIGN §4.4 writes `Locked(id)`; the ERC-5192 EVENT owns that name
    error NotLocked();
    error GuardianHeld(uint256 id);
    error IsTransferSealed(uint256 id);  // likewise: the event `TransferSealed(id, until)` owns the name
    error NoBurn();
    error RatchetOnly();
    error TooLong();
    error Expired();
    error IsPricingSealed();
    error RoyaltyTooHigh();
    error BadFace();
    error BadTrait();
    error BadName();
    error WrongReceiver();
    error Reentrancy();
    error FunctionNotFound(bytes4 selector);
}

interface IIntact is IIntactEvents {
    /*═══════════════════ ERC-165 / 721 / 721Metadata / 721Enumerable ═══════════════════*/
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 id) external view returns (address);
    function getApproved(uint256 id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function approve(address to, uint256 id) external;
    function setApprovalForAll(address operator, bool approved) external;
    function transferFrom(address from, address to, uint256 id) external;
    function safeTransferFrom(address from, address to, uint256 id) external;
    function safeTransferFrom(address from, address to, uint256 id, bytes calldata data) external;
    function totalSupply() external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);

    /*═══════════════════ epoch-keyed approvals (§2) ═══════════════════*/
    function approvalEpoch(address owner) external view returns (uint64);
    function setApprovalForAllUntil(address operator, uint64 expiresAt) external;
    function revokeAllApprovals() external;
    function approvalExpiryOf(address owner, address operator) external view returns (uint64);

    /*═══════════════════ custody, locks, seals (§2, §4.4) ═══════════════════*/
    function custodyEpoch(uint256 id) external view returns (uint64);
    function locked(uint256 id) external view returns (bool);                               // ERC-5192
    function isTransferable(uint256 id, address from, address to) external view returns (bool);  // ERC-6454
    function moduleLock(uint256 id) external;
    function moduleUnlock(uint256 id) external;
    function sealTransfer(uint256 id, uint64 until) external;
    function transferSealUntil(uint256 id) external view returns (uint64);
    function stewardTransfer(uint256 id, address to) external;
    function moduleTransfer(uint256 id, address to) external;
    function panic(uint256 id) external;
    function release(uint256 id) external;
    function royaltyInfo(uint256 id, uint256 salePrice) external view returns (address receiver, uint256 amount);

    /*═══════════════════ rights (§2) ═══════════════════*/
    function rightsOf(uint256 id, address actor) external view returns (uint16 bits, uint64 epoch, address holder);
    function holds(uint256 id, address who) external view returns (bool);
    function acts(uint256 id, address who) external view returns (bool);

    /*═══════════════════ ERC-4907, guardian, status, wallet, fees (§3 row 3) ═══════════════════*/
    function setUser(uint256 id, address user, uint64 expires) external;
    function userOf(uint256 id) external view returns (address);
    function userExpires(uint256 id) external view returns (uint256);
    function setGuardian(uint256 id, address guardian) external;
    function guardianOf(uint256 id) external view returns (address);
    function setStatus(uint256 id, Status status) external;
    function pause(uint256 id) external;
    function statusOf(uint256 id) external view returns (Status);
    function proposeAgentWallet(uint256 id, address wallet) external;
    function acceptAgentWallet(uint256 id) external;
    function agentWalletOf(uint256 id) external view returns (address);
    function setFeesToGrip(uint256 id, bool toGrip) external;
    function feeSink(uint256 id) external view returns (address);

    /*═══════════════════ mint and accounts (§4.3) ═══════════════════*/
    function mint(address to) external payable returns (uint256 id);
    function price() external view returns (uint256);
    function minted() external view returns (uint256);
    function account(uint256 id) external view returns (address);
    function grip(uint256 id) external view returns (address);
    function isCanonicalAccount(address candidate, uint256 id, bool gripRole) external view returns (bool);
    function setPrice(uint256 newPrice) external;
    function setRoyalty(address receiver, uint16 bps) external;
    function withdraw(address to) external;
    function sealPricing() external;
    function pricingSealed() external view returns (bool);

    /*═══════════════════ site and metadata (§4.6) ═══════════════════*/
    function tokenURI(uint256 id) external view returns (string memory);
    function tokenURIAt(uint256 id, uint8 face) external view returns (string memory);
    function tokenURIs(uint256 id) external view returns (uint256 index, string[] memory uris, bool pinned);
    function pinTokenURI(uint256 id, uint256 index) external;
    function unpinTokenURI(uint256 id) external;
    function hasPinnedTokenURI(uint256 id) external view returns (bool);
    function contractURI() external view returns (string memory);
    function scriptURI() external view returns (string[] memory);
    function getTraitValue(uint256 id, bytes32 traitKey) external view returns (bytes32);
    function getTraitValues(uint256 id, bytes32[] calldata traitKeys) external view returns (bytes32[] memory);
    function getTraitMetadataURI() external view returns (string memory);
    function setTrait(uint256 id, bytes32 traitKey, bytes32 newValue) external;
    function getStateFingerprint(uint256 id) external view returns (bytes32);
    function coreOf(uint256 id) external view returns (Core memory);

    /*═══════════════════ the pinned world (§4.1 immutables) ═══════════════════*/
    function REGISTRY() external view returns (address);
    function REACH_IMPL() external view returns (address);
    function GRIP_IMPL() external view returns (address);
    function REACH_SALT() external view returns (bytes32);
    function GRIP_SALT() external view returns (bytes32);
    function BAND() external view returns (uint8);
    function BAND_LO() external view returns (uint256);
    function BAND_HI() external view returns (uint256);
    function STEWARD() external view returns (address);
    function MARKET() external view returns (address);
    function ROLES() external view returns (address);
    function POOL() external view returns (address);
    function PARLEY() external view returns (address);
    function LAUNCHPAD() external view returns (address);
    function LOCKS() external view returns (address);
    function RENDERER() external view returns (address);
    function CATALOG() external view returns (address);
    function PREMISES() external view returns (address);
    function TIMELOCK() external view returns (address);
    /// @notice keccak256 of every immutable above; every facet must agree.
    function intactConfigHash() external view returns (bytes32);
}
