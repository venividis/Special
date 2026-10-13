// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEnsRegistryForWrapper {
    function owner(bytes32 node) external view returns (address);
    function setResolver(bytes32 node, address resolver) external;
}

interface IEnsRegistrarForWrapper {
    function GRACE_PERIOD() external view returns (uint256);
    function nameExpires(uint256 id) external view returns (uint256);
    function ownerOf(uint256 id) external view returns (address);
    function getApproved(uint256 id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function register(uint256 id, address to, uint256 duration) external returns (uint256);
    function renew(uint256 id, uint256 duration) external returns (uint256);
    function reclaim(uint256 id, address to) external;
    function transferFrom(address from, address to, uint256 id) external;
}

/// @dev The NameWrapper, in the shape of the real one (NameWrapper.sol) for
///      everything the Nameplate reads and the operator's steps use:
///
///        · `ownerOf` / `getData` with the real expiry rule — a name whose
///          wrapper expiry has passed and whose PARENT_CANNOT_CONTROL fuse
///          is set reads as held by nobody; for a .eth name that expiry is
///          the registrar's plus the grace period, so the wrapper goes
///          silent ninety days after the registrar does;
///        · `names(node)`, the wire-format name stored at wrap;
///        · `wrapETH2LD` (the registrant's own wrap of an unwrapped name:
///          the registrar's token is taken, the wrapper made the registry
///          owner, a resolver set if asked) and `registerAndWrapETH2LD`
///          (what the ETHRegistrarController does for a new registration);
///        · `setResolver` and `setFuses` by the wrapped owner, `renew` and
///          `unwrapETH2LD`;
///        · ERC-1155 `safeTransferFrom` of exactly one, with the acceptance
///          check a contract recipient must pass — the Reach and the Grip
///          do, which is how a name enters an Intact.
///
///      The deployer is the first controller (the real one is the
///      ETHRegistrarController). Fixture for U18.
contract EnsNameWrapper {
    uint32 public constant CANNOT_UNWRAP          = 1;
    uint32 public constant CANNOT_BURN_FUSES      = 2;
    uint32 public constant CANNOT_TRANSFER        = 4;
    uint32 public constant CANNOT_SET_RESOLVER    = 8;
    uint32 public constant PARENT_CANNOT_CONTROL  = 1 << 16;
    uint32 public constant IS_DOT_ETH             = 1 << 17;

    bytes32 private constant ETH_NODE = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
    bytes4 private constant ERC1155_RECEIVED = 0xf23a6e61;

    IEnsRegistryForWrapper public immutable ens;
    IEnsRegistrarForWrapper public immutable registrar;

    /// @dev Packed as the real one packs it: owner | fuses << 160 | expiry << 192.
    mapping(uint256 => uint256) private tokens;
    mapping(bytes32 => bytes) public names;
    mapping(address => mapping(address => bool)) private operators;
    mapping(address => bool) public controllers;

    event NameWrapped(bytes32 indexed node, bytes name, address owner, uint32 fuses, uint64 expiry);
    event NameUnwrapped(bytes32 indexed node, address owner);
    event FusesSet(bytes32 indexed node, uint32 fuses);
    event ExpiryExtended(bytes32 indexed node, uint64 expiry);
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);

    error Unauthorised(bytes32 node, address addr);
    error OperationProhibited(bytes32 node);
    error IncorrectTargetOwner(address owner);
    error InvalidReceiver(address to);
    error NotController();
    error LabelTooLong(string label);

    constructor(address ens_, address registrar_) {
        ens = IEnsRegistryForWrapper(ens_);
        registrar = IEnsRegistrarForWrapper(registrar_);
        controllers[msg.sender] = true;
    }

    modifier onlyController() {
        if (!controllers[msg.sender]) revert NotController();
        _;
    }

    function setController(address c, bool active) external onlyController { controllers[c] = active; }

    /*═══════════════════ reads ═══════════════════*/

    function getData(uint256 id) public view returns (address owner, uint32 fuses, uint64 expiry) {
        uint256 t = tokens[id];
        owner = address(uint160(t));
        fuses = uint32(t >> 160);
        expiry = uint64(t >> 192);
        /*  The real `_clearOwnerAndFuses`: past its expiry a name whose
            parent cannot control it is held by nobody, and its fuses are
            gone either way.                                            */
        if (expiry < block.timestamp) {
            if (fuses & PARENT_CANNOT_CONTROL == PARENT_CANNOT_CONTROL) owner = address(0);
            fuses = 0;
        }
    }

    function ownerOf(uint256 id) public view returns (address owner) {
        (owner, , ) = getData(id);
    }

    function balanceOf(address a, uint256 id) external view returns (uint256) {
        return a != address(0) && ownerOf(id) == a ? 1 : 0;
    }

    function isWrapped(bytes32 node) external view returns (bool) {
        return ownerOf(uint256(node)) != address(0) && ens.owner(node) == address(this);
    }

    function canModifyName(bytes32 node, address who) public view returns (bool) {
        (address owner, , uint64 expiry) = getData(uint256(node));
        return (owner == who || operators[owner][who]) && expiry >= block.timestamp;
    }

    function isApprovedForAll(address a, address op) external view returns (bool) { return operators[a][op]; }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == 0xd9b67a26;
    }

    /*═══════════════════ wrapping ═══════════════════*/

    /// @notice The registrant wraps an unwrapped .eth name: the registrar's
    ///         token is taken (approve this contract first), this contract
    ///         becomes the registry owner, the wrapped owner receives the
    ///         ERC-1155.
    function wrapETH2LD(string calldata label, address wrappedOwner, uint16 ownerControlledFuses, address resolver)
        external returns (uint64 expiry)
    {
        uint256 tokenId = uint256(keccak256(bytes(label)));
        address registrant = registrar.ownerOf(tokenId);
        if (registrant != msg.sender && !registrar.isApprovedForAll(registrant, msg.sender)
            && registrar.getApproved(tokenId) != msg.sender) revert Unauthorised(bytes32(tokenId), msg.sender);
        registrar.transferFrom(registrant, address(this), tokenId);
        registrar.reclaim(tokenId, address(this));
        return _wrapETH2LD(label, wrappedOwner, ownerControlledFuses, resolver);
    }

    /// @notice What the controller does for a fresh registration.
    function registerAndWrapETH2LD(string calldata label, address wrappedOwner, uint256 duration, address resolver, uint16 ownerControlledFuses)
        external onlyController returns (uint256 registrarExpiry)
    {
        uint256 tokenId = uint256(keccak256(bytes(label)));
        registrarExpiry = registrar.register(tokenId, address(this), duration);
        _wrapETH2LD(label, wrappedOwner, ownerControlledFuses, resolver);
    }

    function _wrapETH2LD(string calldata label, address wrappedOwner, uint16 ownerControlledFuses, address resolver)
        private returns (uint64 expiry)
    {
        bytes memory l = bytes(label);
        if (l.length > 255) revert LabelTooLong(label);
        bytes32 labelhash = keccak256(l);
        bytes32 node = keccak256(abi.encodePacked(ETH_NODE, labelhash));
        expiry = uint64(registrar.nameExpires(uint256(labelhash)) + registrar.GRACE_PERIOD());
        uint32 fuses = uint32(ownerControlledFuses) | PARENT_CANNOT_CONTROL | IS_DOT_ETH;
        names[node] = abi.encodePacked(uint8(l.length), l, "\x03eth\x00");
        if (resolver != address(0)) ens.setResolver(node, resolver);
        _setData(uint256(node), wrappedOwner, fuses, expiry);
        emit TransferSingle(msg.sender, address(0), wrappedOwner, uint256(node), 1);
        _acceptance(address(0), wrappedOwner, uint256(node), "");
        emit NameWrapped(node, names[node], wrappedOwner, fuses, expiry);
    }

    /// @notice The controller renews: the registrar's clock moves and so does this one.
    function renew(uint256 tokenId, uint256 duration) external onlyController returns (uint64 expiry) {
        bytes32 node = keccak256(abi.encodePacked(ETH_NODE, bytes32(tokenId)));
        uint256 registrarExpiry = registrar.renew(tokenId, duration);
        expiry = uint64(registrarExpiry + registrar.GRACE_PERIOD());
        (address owner, uint32 fuses, ) = getData(uint256(node));
        _setData(uint256(node), owner, fuses, expiry);
        emit ExpiryExtended(node, expiry);
    }

    function unwrapETH2LD(bytes32 labelhash, address registrant, address controller) external {
        bytes32 node = keccak256(abi.encodePacked(ETH_NODE, labelhash));
        if (!canModifyName(node, msg.sender)) revert Unauthorised(node, msg.sender);
        (address owner, uint32 fuses, ) = getData(uint256(node));
        if (fuses & CANNOT_UNWRAP != 0) revert OperationProhibited(node);
        if (registrant == address(0) || registrant == address(this)) revert IncorrectTargetOwner(registrant);
        delete tokens[uint256(node)];
        emit TransferSingle(msg.sender, owner, address(0), uint256(node), 1);
        emit NameUnwrapped(node, registrant);
        registrar.reclaim(uint256(labelhash), controller);
        registrar.transferFrom(address(this), registrant, uint256(labelhash));
    }

    /*═══════════════════ the wrapped owner's writes ═══════════════════*/

    function setResolver(bytes32 node, address resolver) external {
        if (!canModifyName(node, msg.sender)) revert Unauthorised(node, msg.sender);
        (, uint32 fuses, ) = getData(uint256(node));
        if (fuses & CANNOT_SET_RESOLVER != 0) revert OperationProhibited(node);
        ens.setResolver(node, resolver);
    }

    /// @notice Burn owner-controlled fuses; they only ever accumulate.
    function setFuses(bytes32 node, uint16 ownerControlledFuses) external returns (uint32) {
        if (!canModifyName(node, msg.sender)) revert Unauthorised(node, msg.sender);
        (address owner, uint32 fuses, uint64 expiry) = getData(uint256(node));
        if (fuses & CANNOT_BURN_FUSES != 0) revert OperationProhibited(node);
        fuses |= uint32(ownerControlledFuses);
        _setData(uint256(node), owner, fuses, expiry);
        emit FusesSet(node, fuses);
        return fuses;
    }

    function setApprovalForAll(address op, bool approved) external {
        operators[msg.sender][op] = approved;
        emit ApprovalForAll(msg.sender, op, approved);
    }

    /*═══════════════════ ERC-1155 transfer ═══════════════════*/

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external {
        if (from != msg.sender && !operators[from][msg.sender]) revert Unauthorised(bytes32(id), msg.sender);
        if (amount != 1 || to == address(0)) revert InvalidReceiver(to);
        (address owner, uint32 fuses, uint64 expiry) = getData(id);
        if (owner != from) revert Unauthorised(bytes32(id), from);
        if (fuses & CANNOT_TRANSFER != 0) revert OperationProhibited(bytes32(id));
        _setData(id, to, fuses, expiry);
        emit TransferSingle(msg.sender, from, to, id, 1);
        _acceptance(from, to, id, data);
    }

    function _setData(uint256 id, address owner, uint32 fuses, uint64 expiry) private {
        tokens[id] = uint256(uint160(owner)) | (uint256(fuses) << 160) | (uint256(expiry) << 192);
    }

    /// @dev ERC-1155's acceptance check: a contract recipient must answer
    ///      `onERC1155Received` with its selector, or the transfer reverts.
    function _acceptance(address from, address to, uint256 id, bytes memory data) private {
        if (to.code.length == 0) return;
        (bool ok, bytes memory ret) = to.call(
            abi.encodeWithSelector(ERC1155_RECEIVED, msg.sender, from, id, uint256(1), data));
        if (!ok || ret.length < 32 || abi.decode(ret, (bytes4)) != ERC1155_RECEIVED) revert InvalidReceiver(to);
    }
}
