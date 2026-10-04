// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  The standards INTACT answers to.

  Origin: IPSEITY src/interfaces/Standards.sol, adapted (INTACT U0): the
  sealed-kernel interfaces are dropped (ANIMA's brain/seal/verifier line is
  not carried into INTACT — DESIGN.md §3 "Dropped as code"), and ERC-5169,
  ERC-5646, ERC-7774, ERC-1155Receiver, ERC-1271, ERC-6551 account shapes,
  ERC-20 and ERC-2612 are added.

  Every identifier is recomputed from the function selectors by
  `type(I).interfaceId` wherever the hub claims one; nothing is copied from
  a document. ERC-4906 is the one exception: its interface is events only,
  so Solidity's `interfaceId` would be zero and the EIP fixes the value by
  fiat at 0x49064906.

  Claimed by the hub (DESIGN.md §4.6): 165, 721, 721Metadata, 721Enumerable
  (the lite reading: `tokenByIndex` is arithmetic over a contiguous band),
  2981, 4906, 4907, 5169, 5192, 5646, 6454, 7160, 7496, 7572, 7774.

  NOT claimed, and why:
    · ERC-7857 (AI-agent NFTs with private metadata). Its normative entry
      points are iTransfer/iClone with TransferValidityProof[]; INTACT has
      no sealed payload and no verifier, so a client written against the
      standard would find nothing. Claiming it in an immutable contract
      would be a false statement that can never be corrected.
    · ERC-721C (creator-enforceable royalties). Needs a transfer validator
      the collection's admin can swap. INTACT has no admin after
      deployment; royalties are ERC-2981 advice, sealed by `sealPricing()`.
    · ERC-7631 (dual-nature ERC-20/721). The Intact is not fungible with
      anything.
───────────────────────────────────────────────────────────────────────────*/

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC721 is IERC165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

interface IERC721Metadata is IERC721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

interface IERC721Enumerable is IERC721 {
    function totalSupply() external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external returns (bytes4);
}

interface IERC1155Receiver {
    function onERC1155Received(address operator, address from, uint256 id, uint256 value, bytes calldata data)
        external returns (bytes4);
    function onERC1155BatchReceived(
        address operator, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data
    ) external returns (bytes4);
}

/*── ERC-20 and ERC-2612 · what a Coin is, and what the Reach measures ──*/
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

interface IERC20Permit {
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/*── ERC-1271 · a contract says whether a signature is its own ──*/
interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4);
}

/*── ERC-2981 · royalties ──*/
interface IERC2981 is IERC165 {
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external view returns (address receiver, uint256 royaltyAmount);
}

/*── ERC-4906 · tell the indexers the metadata moved · id 0x49064906 by fiat ──*/
interface IERC4906 is IERC165 {
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}

/*── ERC-4907 · a user who is not the owner ──*/
interface IERC4907 {
    event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);

    function setUser(uint256 tokenId, address user, uint64 expires) external;
    function userOf(uint256 tokenId) external view returns (address);
    function userExpires(uint256 tokenId) external view returns (uint256);
}

/*── ERC-5169 · where the client script lives ──
  INTACT answers with the `web3://` origin of the Premises: the script is
  the site, and the site is a contract. */
interface IERC5169 {
    event ScriptUpdate(string[] newScriptURI);

    function scriptURI() external view returns (string[] memory);
    function setScriptURI(string[] memory newScriptURI) external;
}

/*── ERC-5192 · minimal soulbound ──*/
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

/*── ERC-5646 · one hash for the whole state a trade depends on ──*/
interface IERC5646 is IERC165 {
    function getStateFingerprint(uint256 tokenId) external view returns (bytes32);
}

/*── ERC-6454 · ask before assuming a token can move ──*/
interface IERC6454 is IERC165 {
    function isTransferable(uint256 tokenId, address from, address to) external view returns (bool);
}

/*── ERC-7572 · metadata for the collection itself ──*/
interface IERC7572 {
    event ContractURIUpdated();

    function contractURI() external view returns (string memory);
}

/*── ERC-7160 · one token, several faces, holder picks ──*/
interface IERC721MultiMetadata is IERC165 {
    event TokenUriPinned(uint256 indexed tokenId, uint256 indexed index);
    event TokenUriUnpinned(uint256 indexed tokenId);

    function tokenURIs(uint256 tokenId)
        external view returns (uint256 index, string[] memory uris, bool pinned);
    function pinTokenURI(uint256 tokenId, uint256 index) external;
    function unpinTokenURI(uint256 tokenId) external;
    function hasPinnedTokenURI(uint256 tokenId) external view returns (bool);
}

/*── ERC-7496 · on-chain traits an indexer can read directly ──*/
interface IERC7496 is IERC165 {
    event TraitUpdated(bytes32 indexed traitKey, uint256 tokenId, bytes32 traitValue);
    event TraitUpdatedRange(bytes32 indexed traitKey, uint256 fromTokenId, uint256 toTokenId);
    event TraitUpdatedRangeUniformValue(
        bytes32 indexed traitKey, uint256 fromTokenId, uint256 toTokenId, bytes32 traitValue);
    event TraitUpdatedList(bytes32 indexed traitKey, uint256[] tokenIds);
    event TraitUpdatedListUniformValue(bytes32 indexed traitKey, uint256[] tokenIds, bytes32 traitValue);
    event TraitMetadataURIUpdated();

    function getTraitValue(uint256 tokenId, bytes32 traitKey) external view returns (bytes32);
    function getTraitValues(uint256 tokenId, bytes32[] calldata traitKeys)
        external view returns (bytes32[] memory);
    function getTraitMetadataURI() external view returns (string memory);
    function setTrait(uint256 tokenId, bytes32 traitKey, bytes32 newValue) external;
}

/*── ERC-7774 · cache invalidation for ERC-5219 resources ──
  The hub emits this on every state change so a gateway that advertised
  `Cache-Control: evm-events` drops the affected paths. Events only, so
  there is no interface id to claim; the `Cache-Control` header is the
  claim. */
interface IERC7774 {
    event ClearPathCache(string[] paths);
}

/*── ERC-6551 · the registry and the account ──*/
interface IERC6551Registry {
    event ERC6551AccountCreated(
        address account, address indexed implementation, bytes32 salt,
        uint256 chainId, address indexed tokenContract, uint256 indexed tokenId
    );

    function createAccount(
        address implementation, bytes32 salt, uint256 chainId,
        address tokenContract, uint256 tokenId
    ) external returns (address);

    function account(
        address implementation, bytes32 salt, uint256 chainId,
        address tokenContract, uint256 tokenId
    ) external view returns (address);
}

/// @dev interfaceId 0x6faff5f1
interface IERC6551Account {
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function state() external view returns (uint256);
    function isValidSigner(address signer, bytes calldata context) external view returns (bytes4);
}

/// @dev interfaceId 0x51945447. The Grip deliberately does not advertise it.
interface IERC6551Executable {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external payable returns (bytes memory);
}

/*── ERC-7432 · roles that lock rather than escrow · id 0xd00ca5cf ──*/
interface IERC7432 {
    struct Role {
        bytes32 roleId;
        address tokenAddress;
        uint256 tokenId;
        address recipient;
        uint64 expirationDate;
        bool revocable;
        bytes data;
    }

    event TokenLocked(address indexed _owner, address indexed _tokenAddress, uint256 _tokenId);
    event RoleGranted(
        address indexed _tokenAddress,
        uint256 indexed _tokenId,
        bytes32 indexed _roleId,
        address _owner,
        address _recipient,
        uint64 _expirationDate,
        bool _revocable,
        bytes _data
    );
    event RoleRevoked(address indexed _tokenAddress, uint256 indexed _tokenId, bytes32 indexed _roleId);
    event TokenUnlocked(address indexed _owner, address indexed _tokenAddress, uint256 indexed _tokenId);
    event RoleApprovalForAll(address indexed _tokenAddress, address indexed _operator, bool indexed _isApproved);

    function grantRole(Role calldata _role) external;
    function revokeRole(address _tokenAddress, uint256 _tokenId, bytes32 _roleId) external;
    function unlockToken(address _tokenAddress, uint256 _tokenId) external;
    function setRoleApprovalForAll(address _tokenAddress, address _operator, bool _approved) external;
    function ownerOf(address _tokenAddress, uint256 _tokenId) external view returns (address owner_);
    function recipientOf(address _tokenAddress, uint256 _tokenId, bytes32 _roleId)
        external view returns (address recipient_);
    function roleData(address _tokenAddress, uint256 _tokenId, bytes32 _roleId)
        external view returns (bytes memory data_);
    function roleExpirationDate(address _tokenAddress, uint256 _tokenId, bytes32 _roleId)
        external view returns (uint64 expirationDate_);
    function isRoleRevocable(address _tokenAddress, uint256 _tokenId, bytes32 _roleId)
        external view returns (bool revocable_);
    function isRoleApprovedForAll(address _tokenAddress, address _owner, address _operator)
        external view returns (bool);
}

/*── EIP-2535 · the diamond's vocabulary, without the verb ──
  The `DiamondCut` event is required for every cut including the one in
  the constructor; a `diamondCut` function is not, and INTACT has none.
  `IDiamondCut` is deliberately absent from the codebase. */
interface IDiamond {
    enum FacetCutAction { Add, Replace, Remove }

    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
}

/// @dev interfaceId 0x48e2b093. Implemented natively by IntactDiamond.
interface IDiamondLoupe {
    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    function facets() external view returns (Facet[] memory facets_);
    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory);
    function facetAddresses() external view returns (address[] memory);
    function facetAddress(bytes4 _functionSelector) external view returns (address);
}

/*── ERC-5219 · the contract is the origin ──*/
struct KeyValue { string key; string value; }

interface IDecentralizedApp {
    function request(string[] memory resource, KeyValue[] memory params)
        external view returns (uint16 statusCode, string memory body, KeyValue[] memory headers);
}

/*── delegate.xyz v2 · a viewing right, never a write ──*/
interface IDelegateRegistryV2 {
    function checkDelegateForERC721(address to, address from, address contract_, uint256 tokenId, bytes32 rights)
        external view returns (bool);
}

/*── ERC-7409 · reactions, the singleton every band shares ──*/
interface IERC7409 {
    function emote(address collectionAddress, uint256 tokenId, string memory emoji, bool state) external;
    function emoteCountOf(address collectionAddress, uint256 tokenId, string memory emoji)
        external view returns (uint256);
}
