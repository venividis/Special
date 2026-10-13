// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev The ENS registry, in the shape of the real one (ENSRegistry.sol):
///      a record per node, the `authorised` rule (the node's owner or one
///      of its operators), `setSubnodeOwner` as the parent's write, and the
///      root handed to the deployer. The Nameplate reads `owner(node)`; a
///      web3:// client reads `resolver(node)` on its way to the Nameplate;
///      the operator's steps in docs/DEPLOYMENT.md write only through the
///      registrar and the wrapper, which are the two callers the real
///      registry sees for a wrapped .eth name. Fixture for U18.
contract EnsRegistry {
    struct Record { address owner; address resolver; uint64 ttl; }

    mapping(bytes32 => Record) private records;
    mapping(address => mapping(address => bool)) private operators;

    event NewOwner(bytes32 indexed node, bytes32 indexed label, address owner);
    event Transfer(bytes32 indexed node, address owner);
    event NewResolver(bytes32 indexed node, address resolver);
    event NewTTL(bytes32 indexed node, uint64 ttl);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    error Unauthorised();

    modifier authorised(bytes32 node) {
        address o = records[node].owner;
        if (o != msg.sender && !operators[o][msg.sender]) revert Unauthorised();
        _;
    }

    constructor() {
        records[bytes32(0)].owner = msg.sender;
    }

    /// @dev The real registry reports a node it owns itself as unowned.
    function owner(bytes32 node) external view returns (address) {
        address o = records[node].owner;
        return o == address(this) ? address(0) : o;
    }

    function resolver(bytes32 node) external view returns (address) { return records[node].resolver; }
    function ttl(bytes32 node) external view returns (uint64) { return records[node].ttl; }
    function recordExists(bytes32 node) external view returns (bool) { return records[node].owner != address(0); }

    function setOwner(bytes32 node, address o) external authorised(node) {
        records[node].owner = o;
        emit Transfer(node, o);
    }

    function setSubnodeOwner(bytes32 node, bytes32 label, address o) public authorised(node) returns (bytes32 sub) {
        sub = keccak256(abi.encodePacked(node, label));
        records[sub].owner = o;
        emit NewOwner(node, label, o);
    }

    function setSubnodeRecord(bytes32 node, bytes32 label, address o, address r, uint64 t) external authorised(node) {
        bytes32 sub = setSubnodeOwner(node, label, o);
        records[sub].resolver = r;
        records[sub].ttl = t;
        emit NewResolver(sub, r);
        emit NewTTL(sub, t);
    }

    function setResolver(bytes32 node, address r) external authorised(node) {
        records[node].resolver = r;
        emit NewResolver(node, r);
    }

    function setTTL(bytes32 node, uint64 t) external authorised(node) {
        records[node].ttl = t;
        emit NewTTL(node, t);
    }

    function setApprovalForAll(address op, bool approved) external {
        operators[msg.sender][op] = approved;
        emit ApprovalForAll(msg.sender, op, approved);
    }

    function isApprovedForAll(address o, address op) external view returns (bool) { return operators[o][op]; }
}
