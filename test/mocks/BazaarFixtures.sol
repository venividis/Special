// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    Order, OrderParameters, OrderComponents, OfferItem, ConsiderationItem, SpentItem, ReceivedItem,
    ZoneParameters, ItemType, OrderType, ISeaportZone
} from "../../src/interfaces/ISeaport.sol";
import {Market} from "../../src/interfaces/IPool.sol";

/*───────────────────────────────────────────────────────────────────────────
  The fixtures test/Bazaar.t.sol runs the Bazaar against (V2, unit W3)

  Every name starts with Bazaar. The hub here is a mock whose fingerprint
  hashes the terms the real one hashes (src/hub/SiteLogic.sol
  `getStateFingerprint`): the holder, the custody epoch, the user, and its
  `residueOf` — the traits, the Reach's `state()` and `sealedUntil()`, the
  owned market's `marketHash`, the Journal's root and the launch root (V2
  wave 2, W6) — read through guarded staticcalls, as the hub reads them,
  so a Reach, a Pool, a Journal or a Launchpad that stops answering, or was
  never set, contributes zero rather than a revert. A transfer does what
  the real `_update` does to those terms: the epoch moves, the single
  approval and the user die, and the residue survives whole.

  The Seaport here is the standard path of Seaport 1.6 (seaport-core
  OrderFulfiller.sol `_validateAndFulfillAdvancedOrder`): the zone's
  `authorizeOrder` before any item moves, then the offer, then the
  consideration, then `validateOrder`. With the order's `conduitKey`
  non-zero it does what Seaport does through a conduit: native currency is
  pushed to each recipient at once, and every token transfer is
  accumulated and run at the end — so a seller paid in ether is called
  while it still holds the token. The real Seaport 1.6 runtime, and the
  real conduit, are what tools/verify-bazaar.mjs runs the same zone against.
───────────────────────────────────────────────────────────────────────────*/

interface IBazaarTransferable {
    function transferFrom(address from, address to, uint256 idOrAmount) external;
}

/// @dev An ERC-20 that can stop answering `balanceOf`.
contract BazaarToken {
    error BazaarMuted();
    error BazaarShort();

    mapping(address => uint256) internal _balance;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public mute;

    function balanceOf(address who) external view returns (uint256) {
        if (mute) revert BazaarMuted();
        return _balance[who];
    }

    function mint(address to, uint256 amount) external { _balance[to] += amount; }
    function setMute(bool m) external { mute = m; }
    /// @dev A balance taken from under its holder (a rebase, a seizure):
    ///      it moves no fingerprint term, only the balance a floor reads.
    function burn(address from, uint256 amount) external { _balance[from] -= amount; }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a < amount) revert BazaarShort();
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        if (_balance[from] < amount) revert BazaarShort();
        _balance[from] -= amount;
        _balance[to] += amount;
    }
}

/// @dev Any ERC-721 that is not INTACT.
contract BazaarNFT {
    error BazaarNotAllowed();

    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    function mint(address to, uint256 id) external { ownerOf[id] = to; }
    function setApprovalForAll(address op, bool ok) external { isApprovedForAll[msg.sender][op] = ok; }

    function transferFrom(address from, address to, uint256 id) external {
        if (ownerOf[id] != from) revert BazaarNotAllowed();
        if (msg.sender != from && getApproved[id] != msg.sender && !isApprovedForAll[from][msg.sender]) revert BazaarNotAllowed();
        ownerOf[id] = to;
        delete getApproved[id];
    }
}

/// @dev The owned markets: `marketOf` and `marketHash` as IPool shapes them.
contract BazaarPool {
    error BazaarMuted();

    mapping(uint256 => Market) internal _m;
    bool public mute;

    function marketOf(uint256 key) external view returns (Market memory) {
        if (mute) revert BazaarMuted();
        return _m[key];
    }

    /// @dev The terms src/Pool.sol `marketHash` commits to.
    function marketHash(uint256 key) external view returns (bytes32) {
        Market storage m = _m[key];
        return keccak256(abi.encode(m.base, m.quote, m.rBase, m.rQuote, m.feeBps, m.sealUntil, m.curveBps, m.vBase, m.vQuote));
    }

    function open(uint256 id) external {
        Market storage m = _m[id];
        m.open = true;
        m.rBase = 1_000_000;
        m.rQuote = 1_000_000;
    }

    function close(uint256 id) external { delete _m[id]; }
    function sealMarket(uint256 id, uint64 until) external { _m[id].sealUntil = until; }

    /// @dev A swap: anyone's, as on the real Pool, and it moves the reserves.
    function trade(uint256 id) external {
        _m[id].rBase += 7;
        _m[id].rQuote -= 7;
    }

    function setMute(bool m) external { mute = m; }
}

/// @dev The acting account: a seal, a state counter bumped on every act,
///      and `execute` for its holder (value refused while sealed, as the
///      real Reach refuses it; an asset off the manifest is unrestricted).
contract BazaarReach {
    error BazaarNotHolder();
    error BazaarValueWhileSealed();
    error BazaarMuted();

    BazaarHub public immutable hub;
    uint256 public immutable id;
    uint64 internal _sealedUntil;
    uint256 public state;
    bool public mute;

    constructor(BazaarHub h, uint256 i) {
        hub = h;
        id = i;
    }

    modifier holder() {
        if (msg.sender != hub.ownerOf(id)) revert BazaarNotHolder();
        _;
    }

    function sealedUntil() external view returns (uint64) {
        if (mute) revert BazaarMuted();
        if (dirty) {
            // a word no uint64 getter returns: 2^64 + the seal
            uint256 w = (uint256(1) << 64) + _sealedUntil;
            assembly ("memory-safe") { mstore(0, w) return(0, 32) }
        }
        return _sealedUntil;
    }

    /// @dev A Reach that answers `sealedUntil` with a word wider than uint64.
    bool public dirty;
    function setDirty(bool d) external { dirty = d; }

    function seal(uint64 until) external holder {
        if (until > _sealedUntil) _sealedUntil = until;
        ++state;
    }

    function execute(address to, uint256 value, bytes calldata data) external holder returns (bytes memory ret) {
        if (value != 0 && block.timestamp < _sealedUntil) revert BazaarValueWhileSealed();
        ++state;
        bool ok;
        (ok, ret) = to.call{value: value}(data);
        if (!ok) assembly ("memory-safe") { revert(add(ret, 0x20), mload(ret)) }
    }

    /// @dev A Reach that stops answering `sealedUntil`.
    function setMute(bool m) external { mute = m; }

    receive() external payable {}
}

/// @dev The launch root the hub's fingerprint and residue read, moved by
///      the holder's launch as the real Launchpad's `recordLaunch` moves it
///      when the Kiln makes a coin for the token.
contract BazaarLaunchpad {
    error BazaarNotHolder();

    BazaarHub public immutable hub;
    mapping(uint256 => bytes32) public launchRoot;

    constructor(BazaarHub h) { hub = h; }

    function launch(uint256 id) external {
        if (msg.sender != hub.ownerOf(id)) revert BazaarNotHolder();
        launchRoot[id] = keccak256(abi.encode(launchRoot[id], id, hub.custodyEpoch(id), block.timestamp));
    }
}

/// @dev The hub's surface the Bazaar reads, and a transfer that revokes
///      what the real one revokes.
contract BazaarHub {
    error NoSuchToken();
    error NotHolder();
    error NotAuthorized();

    /// @dev Over a wire, an id comes from this log, never a read after the write.
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    address public immutable POOL;
    uint256 public minted;
    address public royaltyReceiver;
    uint16 public royaltyBps;

    mapping(uint256 => address) internal _owner;
    mapping(uint256 => BazaarReach) internal _reach;
    mapping(uint256 => uint64) public custodyEpoch;
    mapping(uint256 => address) public userOf;
    mapping(uint256 => bytes32) public traitsRoot;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    /// @dev The two V2 satellites whose terms the residue reads (W6): unset,
    ///      each reads zero, as an absent satellite does on the real hub.
    address public journal;
    address public launchpad;

    constructor(address pool) { POOL = pool; }

    /// @dev The real hub pins its satellites at construction; this one is told.
    function setSatellites(address journal_, address launchpad_) external {
        journal = journal_;
        launchpad = launchpad_;
    }

    function mint(address to) external returns (uint256 id) {
        id = ++minted;
        _owner[id] = to;
        _reach[id] = new BazaarReach(this, id);
        custodyEpoch[id] = 1;
        emit Transfer(address(0), to, id);
    }

    function ownerOf(uint256 id) public view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function account(uint256 id) external view returns (address) { return address(_reach[id]); }

    /// @dev The real terms, in the real hub's spirit: holder, Core fields
    ///      (epoch, user), then everything a sale leaves standing.
    function getStateFingerprint(uint256 id) external view returns (bytes32) {
        address o = ownerOf(id);
        return keccak256(abi.encode(o, custodyEpoch[id], userOf[id], residueOf(id)));
    }

    /// @dev The real hub's `residueOf`, in this mock's terms: the traits, the
    ///      Reach's state and seal, the market, the memories, the launches —
    ///      what a sale does not move and a seller inside the fill could.
    function residueOf(uint256 id) public view returns (bytes32) {
        ownerOf(id);
        address r = address(_reach[id]);
        return keccak256(abi.encode(
            traitsRoot[id],
            _guarded(r, abi.encodeWithSignature("state()")),
            _guarded(r, abi.encodeWithSignature("sealedUntil()")),
            _guarded(POOL, abi.encodeWithSignature("marketHash(uint256)", id)),
            _guarded(journal, abi.encodeWithSignature("rootOf(address,uint256)", address(this), id)),
            _guarded(launchpad, abi.encodeWithSignature("launchRoot(uint256)", id))
        ));
    }

    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
        return (royaltyReceiver, salePrice * royaltyBps / 10_000);
    }

    /// @dev The Timelock's, on the real hub.
    function setRoyalty(address receiver, uint16 bps) external {
        royaltyReceiver = receiver;
        royaltyBps = bps;
    }

    function setTrait(uint256 id, bytes32 key, bytes32 value) external {
        if (msg.sender != ownerOf(id)) revert NotHolder();
        traitsRoot[id] = keccak256(abi.encode(traitsRoot[id], key, value));
    }

    function setUser(uint256 id, address user) external {
        if (msg.sender != ownerOf(id)) revert NotHolder();
        userOf[id] = user;
    }

    function approve(address to, uint256 id) external {
        if (msg.sender != ownerOf(id)) revert NotHolder();
        getApproved[id] = to;
    }

    function setApprovalForAll(address op, bool ok) external { isApprovedForAll[msg.sender][op] = ok; }

    function transferFrom(address from, address to, uint256 id) external {
        address o = ownerOf(id);
        if (o != from) revert NotHolder();
        if (msg.sender != o && getApproved[id] != msg.sender && !isApprovedForAll[o][msg.sender]) revert NotAuthorized();
        _owner[id] = to;
        delete getApproved[id];
        delete userOf[id];
        custodyEpoch[id] += 1;
        emit Transfer(o, to, id);
    }

    function _guarded(address target, bytes memory data) internal view returns (bytes32 v) {
        if (target.code.length == 0) return 0;
        (bool ok, bytes memory ret) = target.staticcall(data);
        if (ok && ret.length == 32) v = abi.decode(ret, (bytes32));
    }
}

/// @dev Seaport 1.6's standard path, for the zone's sake. `validate`,
///      `cancel`, `getOrderHash`, `getCounter`, `getOrderStatus` and
///      `fulfillOrder` take Seaport's shapes. A "signature" here is
///      abi.encode(orderHash): the mock checks that one was supplied, not
///      whose it is (Seaport's own check is tools/verify-bazaar.mjs's).
contract BazaarSeaport {
    error BazaarBadSignature();
    error BazaarCancelled(bytes32 orderHash);
    error BazaarFilled(bytes32 orderHash);
    error BazaarInactive();
    error BazaarLength();
    error BazaarNotMagic();
    error BazaarPushFailed();
    error BazaarCannotCancel();

    event OrderValidated(bytes32 orderHash, OrderParameters orderParameters);

    struct Status { bool validated; bool cancelled; bool filled; }

    mapping(bytes32 => Status) internal _status;
    mapping(address => uint256) public getCounter;
    /// @dev Test knobs: a `validate` that validates nothing, a status forced
    ///      to what Seaport never reports, and a `validate` that re-enters
    ///      the caller with the call it was handed.
    bool public lazy;
    mapping(bytes32 => bool) public forcedCancelled;
    address public reenter;
    bytes public reenterData;

    struct Move { ItemType kind; address token; address from; address to; uint256 idOrAmount; }

    function setLazy(bool l) external { lazy = l; }
    function forceCancelled(bytes32 h) external { forcedCancelled[h] = true; }
    function setReenter(address target, bytes calldata data) external { (reenter, reenterData) = (target, data); }
    function incrementCounter() external returns (uint256) { return ++getCounter[msg.sender]; }

    function getOrderHash(OrderComponents calldata c) external pure returns (bytes32) {
        return keccak256(abi.encode(c));
    }

    function _hash(OrderParameters calldata p) internal view returns (bytes32) {
        OrderComponents memory c = OrderComponents({
            offerer: p.offerer, zone: p.zone, offer: p.offer, consideration: p.consideration,
            orderType: p.orderType, startTime: p.startTime, endTime: p.endTime, zoneHash: p.zoneHash,
            salt: p.salt, conduitKey: p.conduitKey, counter: getCounter[p.offerer]
        });
        return keccak256(abi.encode(c));
    }

    function getOrderStatus(bytes32 h) external view returns (bool, bool, uint256, uint256) {
        Status storage s = _status[h];
        return (s.validated, s.cancelled || forcedCancelled[h], s.filled ? 1 : 0, s.filled ? 1 : 0);
    }

    function validate(Order[] calldata orders) external returns (bool) {
        address again = reenter;
        if (again != address(0)) {
            reenter = address(0);            // one shot: a missing lock shows as a success, not a recursion
            (bool ok, bytes memory ret) = again.call(reenterData);
            if (!ok) assembly ("memory-safe") { revert(add(ret, 0x20), mload(ret)) }
        }
        if (lazy) return true;
        for (uint256 i; i < orders.length; ++i) {
            OrderParameters calldata p = orders[i].parameters;
            bytes32 h = _hash(p);
            Status storage s = _status[h];
            if (s.cancelled) revert BazaarCancelled(h);
            if (s.filled) revert BazaarFilled(h);
            if (s.validated) continue;
            if (p.consideration.length != p.totalOriginalConsiderationItems) revert BazaarLength();
            if (msg.sender != p.offerer && keccak256(orders[i].signature) != keccak256(abi.encode(h))) revert BazaarBadSignature();
            s.validated = true;
            emit OrderValidated(h, p);
        }
        return true;
    }

    function cancel(OrderComponents[] calldata orders) external returns (bool) {
        for (uint256 i; i < orders.length; ++i) {
            if (msg.sender != orders[i].offerer && msg.sender != orders[i].zone) revert BazaarCannotCancel();
            bytes32 h = keccak256(abi.encode(orders[i]));
            _status[h].validated = false;
            _status[h].cancelled = true;
        }
        return true;
    }

    function fulfillOrder(Order calldata order, bytes32 fulfillerConduitKey) external payable returns (bool) {
        OrderParameters calldata p = order.parameters;
        bytes32 h = _hash(p);
        Status storage s = _status[h];
        if (s.cancelled) revert BazaarCancelled(h);
        if (s.filled) revert BazaarFilled(h);
        if (!s.validated && keccak256(order.signature) != keccak256(abi.encode(h))) revert BazaarBadSignature();
        if (block.timestamp < p.startTime || block.timestamp >= p.endTime) revert BazaarInactive();

        ZoneParameters memory zp = _zoneParameters(h, p);
        bool restricted = (p.orderType == OrderType.FULL_RESTRICTED || p.orderType == OrderType.PARTIAL_RESTRICTED)
            && msg.sender != p.zone;
        if (restricted) _ask(p.zone, abi.encodeCall(ISeaportZone.authorizeOrder, (zp)), ISeaportZone.authorizeOrder.selector);
        s.filled = true;
        _transferEach(p, fulfillerConduitKey);
        if (restricted) _ask(p.zone, abi.encodeCall(ISeaportZone.validateOrder, (zp)), ISeaportZone.validateOrder.selector);
        return true;
    }

    function _zoneParameters(bytes32 h, OrderParameters calldata p) internal view returns (ZoneParameters memory zp) {
        SpentItem[] memory offer = new SpentItem[](p.offer.length);
        for (uint256 i; i < offer.length; ++i) {
            OfferItem calldata o = p.offer[i];
            offer[i] = SpentItem(o.itemType, o.token, o.identifierOrCriteria, o.startAmount);
        }
        ReceivedItem[] memory consideration = new ReceivedItem[](p.consideration.length);
        for (uint256 i; i < consideration.length; ++i) {
            ConsiderationItem calldata c = p.consideration[i];
            consideration[i] = ReceivedItem(c.itemType, c.token, c.identifierOrCriteria, c.startAmount, c.recipient);
        }
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = h;
        zp = ZoneParameters({
            orderHash: h, fulfiller: msg.sender, offerer: p.offerer, offer: offer, consideration: consideration,
            extraData: "", orderHashes: hashes, startTime: p.startTime, endTime: p.endTime, zoneHash: p.zoneHash
        });
    }

    function _ask(address zone, bytes memory data, bytes4 magic) internal {
        (bool ok, bytes memory ret) = zone.call(data);
        if (!ok) assembly ("memory-safe") { revert(add(ret, 0x20), mload(ret)) }
        if (ret.length < 32 || abi.decode(ret, (bytes4)) != magic) revert BazaarNotMagic();
    }

    /// @dev The offer, then the consideration; through a "conduit" every
    ///      token transfer waits for the end while native currency goes at once.
    function _transferEach(OrderParameters calldata p, bytes32 fulfillerConduitKey) internal {
        Move[] memory later = new Move[](p.offer.length + p.consideration.length);
        uint256 n;
        for (uint256 i; i < p.offer.length; ++i) {
            OfferItem calldata o = p.offer[i];
            Move memory m = Move(o.itemType, o.token, p.offerer, msg.sender,
                                 o.itemType == ItemType.ERC721 ? o.identifierOrCriteria : o.startAmount);
            if (p.conduitKey == bytes32(0)) _move(m);
            else later[n++] = m;
        }
        for (uint256 i; i < p.consideration.length; ++i) {
            ConsiderationItem calldata c = p.consideration[i];
            if (c.itemType == ItemType.NATIVE) {
                (bool ok, ) = c.recipient.call{value: c.startAmount}("");
                if (!ok) revert BazaarPushFailed();
                continue;
            }
            Move memory m = Move(c.itemType, c.token, msg.sender, c.recipient,
                                 c.itemType == ItemType.ERC721 ? c.identifierOrCriteria : c.startAmount);
            if (fulfillerConduitKey == bytes32(0)) _move(m);
            else later[n++] = m;
        }
        for (uint256 i; i < n; ++i) _move(later[i]);
        if (address(this).balance != 0) {
            (bool ok, ) = msg.sender.call{value: address(this).balance}("");
            if (!ok) revert BazaarPushFailed();
        }
    }

    function _move(Move memory m) internal {
        IBazaarTransferable(m.token).transferFrom(m.from, m.to, m.idOrAmount);
    }
}

/// @dev A holder that is a contract, with one act armed for the moment
///      Seaport pays it. The act is attempted, never required: `acted`
///      records whether it landed, so a fill can be shown to offer the
///      seller no moment at all as well as a moment it used.
contract BazaarSeller {
    error BazaarNotOwner();

    address public immutable owner;
    address public target;
    bytes public data;
    bool public armed;
    bool public attempted;
    bool public acted;

    constructor() { owner = msg.sender; }

    function run(address to, uint256 value, bytes calldata payload) external payable returns (bytes memory ret) {
        if (msg.sender != owner) revert BazaarNotOwner();
        bool ok;
        (ok, ret) = to.call{value: value}(payload);
        if (!ok) assembly ("memory-safe") { revert(add(ret, 0x20), mload(ret)) }
    }

    function arm(address to, bytes calldata payload) external {
        if (msg.sender != owner) revert BazaarNotOwner();
        (target, data, armed) = (to, payload, true);
    }

    /// @dev The real hub mints with the receiver check; a seller can hold.
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {
        if (!armed) return;
        armed = false;
        attempted = true;
        (acted, ) = target.call(data);
    }
}
