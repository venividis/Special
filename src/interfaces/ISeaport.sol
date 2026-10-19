// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC165} from "./Standards.sol";

/*───────────────────────────────────────────────────────────────────────────
  ISeaport — the subset of Seaport 1.6 that INTACT calls, or is called with

  docs/V2.md §3.3. The Bazaar does not invent an order book: it is Seaport,
  the protocol OpenSea settles on, deployed by its keyless CREATE2 factory
  at one address on every chain V2 targets (the venue table holds it, with
  a probe, like every venue). The shapes below are Seaport 1.6's
  `ConsiderationStructs.sol` / `ConsiderationEnums.sol` field for field,
  so their ABI is Seaport's: a struct's name never enters a selector, its
  field types do. Declared here by hand (src/ has no external dependency).

  Two facts the Bazaar is built on:
  - `validate(orders)` from the offerer needs no signature, and emits
    `OrderValidated(orderHash, orderParameters)` carrying the whole order,
    so a listing published that way is found from logs with no API and is
    fillable by anyone without its signature.
  - A restricted order names a zone. Seaport 1.6 calls the zone's
    `authorizeOrder` before any token moves and `validateOrder` after
    (both skipped only when the zone itself is the caller), and refuses
    the fill unless each returns its own selector.

  Frozen after V2 wave 0: additive changes only, recorded in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

enum ItemType { NATIVE, ERC20, ERC721, ERC1155, ERC721_WITH_CRITERIA, ERC1155_WITH_CRITERIA }

enum OrderType { FULL_OPEN, PARTIAL_OPEN, FULL_RESTRICTED, PARTIAL_RESTRICTED, CONTRACT }

enum Side { OFFER, CONSIDERATION }

struct OfferItem {
    ItemType itemType;
    address  token;
    uint256  identifierOrCriteria;
    uint256  startAmount;
    uint256  endAmount;
}

struct ConsiderationItem {
    ItemType itemType;
    address  token;
    uint256  identifierOrCriteria;
    uint256  startAmount;
    uint256  endAmount;
    address payable recipient;
}

struct SpentItem {
    ItemType itemType;
    address  token;
    uint256  identifier;
    uint256  amount;
}

struct ReceivedItem {
    ItemType itemType;
    address  token;
    uint256  identifier;
    uint256  amount;
    address payable recipient;
}

/// @notice What an offerer signs (the EIP-712 `OrderComponents` type).
struct OrderComponents {
    address offerer;
    address zone;
    OfferItem[] offer;
    ConsiderationItem[] consideration;
    OrderType orderType;
    uint256 startTime;
    uint256 endTime;
    bytes32 zoneHash;
    uint256 salt;
    bytes32 conduitKey;
    uint256 counter;
}

/// @notice What travels: the components less the counter, plus the
///         consideration count the offerer signed.
struct OrderParameters {
    address offerer;
    address zone;
    OfferItem[] offer;
    ConsiderationItem[] consideration;
    OrderType orderType;
    uint256 startTime;
    uint256 endTime;
    bytes32 zoneHash;
    uint256 salt;
    bytes32 conduitKey;
    uint256 totalOriginalConsiderationItems;
}

struct Order {
    OrderParameters parameters;
    bytes signature;
}

struct AdvancedOrder {
    OrderParameters parameters;
    uint120 numerator;
    uint120 denominator;
    bytes signature;
    bytes extraData;
}

struct CriteriaResolver {
    uint256 orderIndex;
    Side    side;
    uint256 index;
    uint256 identifier;
    bytes32[] criteriaProof;
}

/// @notice What a zone is shown: the order as it will execute.
struct ZoneParameters {
    bytes32 orderHash;
    address fulfiller;
    address offerer;
    SpentItem[] offer;
    ReceivedItem[] consideration;
    bytes extraData;
    bytes32[] orderHashes;
    uint256 startTime;
    uint256 endTime;
    bytes32 zoneHash;
}

struct Schema {
    uint256 id;
    bytes metadata;
}

interface ISeaportEvents {
    event OrderFulfilled(bytes32 orderHash, address indexed offerer, address indexed zone, address recipient, SpentItem[] offer, ReceivedItem[] consideration);
    event OrderCancelled(bytes32 orderHash, address indexed offerer, address indexed zone);
    event OrderValidated(bytes32 orderHash, OrderParameters orderParameters);
    event CounterIncremented(uint256 newCounter, address indexed offerer);
}

interface ISeaport is ISeaportEvents {
    function fulfillOrder(Order calldata order, bytes32 fulfillerConduitKey) external payable returns (bool fulfilled);
    function fulfillAdvancedOrder(
        AdvancedOrder calldata advancedOrder,
        CriteriaResolver[] calldata criteriaResolvers,
        bytes32 fulfillerConduitKey,
        address recipient
    ) external payable returns (bool fulfilled);
    function cancel(OrderComponents[] calldata orders) external returns (bool cancelled);
    function validate(Order[] calldata orders) external returns (bool validated);
    function incrementCounter() external returns (uint256 newCounter);
    function getOrderHash(OrderComponents calldata order) external view returns (bytes32 orderHash);
    function getOrderStatus(bytes32 orderHash)
        external view returns (bool isValidated, bool isCancelled, uint256 totalFilled, uint256 totalSize);
    function getCounter(address offerer) external view returns (uint256 counter);
    function information() external view returns (string memory version, bytes32 domainSeparator, address conduitController);
    function name() external view returns (string memory contractName);
}

/// @notice Seaport 1.6's `ZoneInterface`, as frozen in V2 wave 0 (ERC-165 id
///         0x3822a094: `supportsInterface` is inherited, so not counted).
interface ISeaportZone is IERC165 {
    /// @notice Before any transfer. Returns `this.authorizeOrder.selector` to admit.
    function authorizeOrder(ZoneParameters calldata zoneParameters) external returns (bytes4 authorizedOrderMagicValue);
    /// @notice After every transfer. Returns `this.validateOrder.selector` to admit.
    function validateOrder(ZoneParameters calldata zoneParameters) external returns (bytes4 validOrderMagicValue);
    function getSeaportMetadata() external view returns (string memory name, Schema[] memory schemas);
}

/// @notice Seaport 1.6's own `ZoneInterface` (seaport-types 1.6.3,
///         src/interfaces/ZoneInterface.sol), mirrored: it re-declares
///         `supportsInterface` inside the interface, so the id a Seaport
///         integrator computes from it is ISeaportZone's XOR 0x01ffc9a7,
///         0x39dd6933. Declared so the compiler computes that id rather than
///         a document stating it. V2 wave 2 (W6), additive.
interface ISeaportZoneInterface is IERC165 {
    function authorizeOrder(ZoneParameters calldata zoneParameters) external returns (bytes4 authorizedOrderMagicValue);
    function validateOrder(ZoneParameters calldata zoneParameters) external returns (bytes4 validOrderMagicValue);
    function getSeaportMetadata() external view returns (string memory name, Schema[] memory schemas);
    function supportsInterface(bytes4 interfaceId) external view override returns (bool);
}
