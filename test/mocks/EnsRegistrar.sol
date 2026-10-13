// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEnsRegistryForRegistrar {
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external returns (bytes32);
}

/// @dev The .eth BaseRegistrar, in the shape of the real one
///      (BaseRegistrarImplementation.sol): an ERC-721 whose token id is the
///      keccak of the label; `nameExpires` keyed by that id; a 90-day
///      GRACE_PERIOD; `ownerOf` that reverts once the registration has
///      lapsed; `register` and `renew` for a controller; `reclaim`, by which
///      a registrant retakes registry control of its node; and the approval
///      family, so a wrapper can take the token. The deployer is the first
///      controller. Fixture for U18: the clock the Nameplate reads.
contract EnsRegistrar {
    IEnsRegistryForRegistrar public immutable ens;
    /// @notice namehash("eth").
    bytes32 public immutable baseNode;
    uint256 public constant GRACE_PERIOD = 90 days;

    mapping(uint256 => uint256) public nameExpires;
    mapping(uint256 => address) private owners;
    mapping(uint256 => address) private approvals;
    mapping(address => mapping(address => bool)) private operators;
    mapping(address => bool) public controllers;

    event NameRegistered(uint256 indexed id, address indexed owner, uint256 expires);
    event NameRenewed(uint256 indexed id, uint256 expires);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    error NotController();
    error Expired();
    error NotAuthorised();
    error Unavailable();

    constructor(address ens_, bytes32 baseNode_) {
        ens = IEnsRegistryForRegistrar(ens_);
        baseNode = baseNode_;
        controllers[msg.sender] = true;
    }

    function addController(address c) external {
        if (!controllers[msg.sender]) revert NotController();
        controllers[c] = true;
    }

    /// @notice Past the grace period, anyone may register the name again.
    function available(uint256 id) public view returns (bool) {
        return nameExpires[id] + GRACE_PERIOD < block.timestamp;
    }

    /// @dev The real one: `require(expiries[tokenId] > block.timestamp)`.
    function ownerOf(uint256 id) public view returns (address) {
        if (nameExpires[id] <= block.timestamp) revert Expired();
        return owners[id];
    }

    function register(uint256 id, address to, uint256 duration) external returns (uint256 expires) {
        if (!controllers[msg.sender]) revert NotController();
        if (!available(id)) revert Unavailable();
        expires = block.timestamp + duration;
        nameExpires[id] = expires;
        if (owners[id] != address(0)) emit Transfer(owners[id], address(0), id);
        owners[id] = to;
        delete approvals[id];
        emit Transfer(address(0), to, id);
        ens.setSubnodeOwner(baseNode, bytes32(id), to);
        emit NameRegistered(id, to, expires);
    }

    /// @dev Allowed through the grace period, as the real one is.
    function renew(uint256 id, uint256 duration) external returns (uint256 expires) {
        if (!controllers[msg.sender]) revert NotController();
        if (nameExpires[id] + GRACE_PERIOD < block.timestamp) revert Expired();
        expires = nameExpires[id] + duration;
        nameExpires[id] = expires;
        emit NameRenewed(id, expires);
    }

    /// @notice The registrant retakes registry control of its node.
    function reclaim(uint256 id, address to) external {
        if (!_authorised(id, msg.sender)) revert NotAuthorised();
        ens.setSubnodeOwner(baseNode, bytes32(id), to);
    }

    function transferFrom(address from, address to, uint256 id) public {
        if (!_authorised(id, msg.sender) || owners[id] != from) revert NotAuthorised();
        owners[id] = to;
        delete approvals[id];
        emit Transfer(from, to, id);
    }

    function approve(address to, uint256 id) external {
        address o = ownerOf(id);
        if (o != msg.sender && !operators[o][msg.sender]) revert NotAuthorised();
        approvals[id] = to;
        emit Approval(o, to, id);
    }

    function setApprovalForAll(address op, bool approved) external {
        operators[msg.sender][op] = approved;
        emit ApprovalForAll(msg.sender, op, approved);
    }

    function getApproved(uint256 id) external view returns (address) { return approvals[id]; }
    function isApprovedForAll(address o, address op) external view returns (bool) { return operators[o][op]; }

    function _authorised(uint256 id, address who) private view returns (bool) {
        address o = ownerOf(id);
        return who == o || approvals[id] == who || operators[o][who];
    }
}
