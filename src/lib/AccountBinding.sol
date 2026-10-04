// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  AccountBinding — the ERC-6551 registry, its proxy footer, and what an
  address proves about itself

  Origin: Pixel-Garden src/accounts/AccountBinding.sol, verbatim, with the
  salts renamed `intact.reach.v1` / `intact.grip.v1` and one helper added
  (`canonical`, the CREATE2-plus-codehash check DESIGN.md §2 requires of
  every transfer recipient and §4.3 requires of every freshly minted
  account). The `IGardenIdentity` interface is not carried over; INTACT's
  equivalent is `IIntact.isCanonicalAccount`.

  `token(account)` parses the 173-byte ERC-6551 forwarder footer only when
  the code length is exactly 173, so a contract that merely *claims* a
  `token()` is never believed: a Reach is whatever CREATE2 says it is.
───────────────────────────────────────────────────────────────────────────*/
library AccountBinding {
    /// @dev The canonical registry, deployed at the same address on every
    ///      chain INTACT runs on. Its runtime hash is checked by the hub's
    ///      constructor; a chain without it cannot host a band.
    address internal constant REGISTRY = 0x000000006551c19487814612e58FE06813775758;
    bytes32 internal constant REGISTRY_HASH =
        0xda1d5b06e579f9e42e59b00fbc22939896ecb38dc8830d40de0a2508fecd6735;
    bytes32 internal constant REACH_SALT = keccak256("intact.reach.v1");
    bytes32 internal constant GRIP_SALT = keccak256("intact.grip.v1");

    /// @dev The length of every ERC-6551 forwarder: 45 bytes of proxy plus
    ///      four 32-byte words of footer (salt, chain, collection, id).
    uint256 internal constant FORWARDER_LENGTH = 173;

    function runtime(
        address implementation,
        bytes32 salt,
        uint256 chain,
        address collection,
        uint256 id
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                hex"363d3d373d3d3d363d73",
                implementation,
                hex"5af43d82803e903d91602b57fd5bf3",
                abi.encode(salt, chain, collection, id)
            );
    }

    function predict(
        address implementation,
        bytes32 salt,
        uint256 chain,
        address collection,
        uint256 id
    ) internal pure returns (address) {
        bytes32 initHash = keccak256(
            abi.encodePacked(
                hex"3d60ad80600a3d3981f3",
                runtime(implementation, salt, chain, collection, id)
            )
        );
        return
            address(
                uint160(uint256(keccak256(abi.encodePacked(hex"ff", REGISTRY, salt, initHash))))
            );
    }

    function token(
        address account
    ) internal view returns (uint256 chain, address collection, uint256 id) {
        if (account.code.length != FORWARDER_LENGTH) return (0, address(0), 0);
        bytes memory footer = new bytes(96);
        assembly ("memory-safe") {
            extcodecopy(account, add(footer, 32), 77, 96)
        }
        assembly ("memory-safe") {
            chain := mload(add(footer, 32))
            collection := and(mload(add(footer, 64)), 0xffffffffffffffffffffffffffffffffffffffff)
            id := mload(add(footer, 96))
        }
    }

    /// @notice Whether `candidate` is exactly the account CREATE2 derives
    ///         for these inputs AND carries the forwarder's runtime hash.
    /// @dev    Both halves, because each alone is a lie waiting to happen:
    ///         the address check without the codehash accepts an address
    ///         that was never deployed (no code, so every call "succeeds"),
    ///         and the codehash without the address accepts any forwarder
    ///         whose footer the caller did not read. (INTACT U0 addition.)
    function canonical(
        address candidate,
        address implementation,
        bytes32 salt,
        uint256 chain,
        address collection,
        uint256 id
    ) internal view returns (bool) {
        if (candidate != predict(implementation, salt, chain, collection, id)) return false;
        return candidate.codehash == keccak256(runtime(implementation, salt, chain, collection, id));
    }
}

interface IAccountRegistry {
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chain,
        address collection,
        uint256 id
    ) external returns (address);

    function account(
        address implementation,
        bytes32 salt,
        uint256 chain,
        address collection,
        uint256 id
    ) external view returns (address);
}
