// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IMarket — listing is a seal (post-MVB, U15)

  DESIGN.md §3 row 28, §11.3, BUILD-PLAN U15. `list` takes the module
  lock and requires `Reach.sealedUntil ≥ expiresAt` and (market closed or
  `Pool.sealUntil ≥ expiresAt`); `buy` recomputes the fingerprint, checks
  the floors, pays the royalty first, credits `owed[seller]` and calls
  `moduleTransfer`. The floors live on the listing (BUILD-PLAN U15's
  `list(..., floors[])` over §3's `buy(..., floors)`): the seller commits
  to what the Reach will hold, and the buyer verifies against the chain,
  not against a venue's promise. U0 choice, flagged for U15.
───────────────────────────────────────────────────────────────────────────*/

struct Floor { address asset; uint256 min; }

struct Listing {
    address seller;
    uint256 price;
    uint64  expiresAt;
    uint64  epoch;
    bytes32 fingerprint;
    Floor[] floors;          // ≤ 64 balance floors on the Reach
}

interface IMarketEvents {
    event OrderPosted(uint256 indexed id, address indexed seller, uint256 price, uint64 expiresAt, bytes32 fingerprint);
    event Delisted(uint256 indexed id);
    event Sold(uint256 indexed id, address indexed seller, address indexed buyer, uint256 price, uint256 royalty);
    event Claimed(address indexed to, uint256 amount);

    error NotHolder();
    error NotListed(uint256 id);
    error AlreadyListed(uint256 id);
    error Expired(uint64 expiresAt);
    error BadExpiry();
    error WrongPrice(uint256 expected, uint256 provided);
    error FingerprintMoved(bytes32 expected, bytes32 actual);
    error FloorBroken(address asset, uint256 min, uint256 actual);
    error SealsTooShort(uint64 reachSealedUntil, uint64 marketSealedUntil, uint64 expiresAt);
    error TooManyFloors();
    error Stale(uint256 id);
    error NothingOwed();
    error TransferFailed();
    error Reentrancy();
}

interface IMarket is IMarketEvents {
    function list(uint256 id, uint256 price, uint64 expiresAt, bytes32 fingerprint, Floor[] calldata floors) external;   // holds
    function delist(uint256 id) external;                                                                             // holds; unlocks
    function buy(uint256 id, uint256 agreed, bytes32 fingerprint) external payable;                                    // anyone
    function claim() external;                                                                                        // pull owed
    function listingOf(uint256 id) external view returns (Listing memory);
    function owed(address payee) external view returns (uint256);
    function MAX_FLOORS() external view returns (uint256);        // 64
    function MAX_LISTING() external view returns (uint64);        // 365 days
    function HUB() external view returns (address);
    function POOL() external view returns (address);
}
