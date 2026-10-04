// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// INTACT U6 fixtures for the launch unit: a hub, a Pool, a Locks and the
// mutual-immutable wiring. Wave 1 units build in parallel, so the Kiln and
// Launchpad are exercised against the FROZEN interfaces of their partners
// (IIntact, IPool.openSealed, ILocks.lock) through these stand-ins, which
// implement exactly the calls U6 makes and nothing else. verify-launch.mjs
// and test/Launchpad.t.sol share them.

import {Market} from "../../src/interfaces/IPool.sol";
import {Lock} from "../../src/interfaces/ILocks.sol";
import {Kiln} from "../../src/Kiln.sol";
import {Launchpad} from "../../src/Launchpad.sol";

interface IERC20Min {
    function balanceOf(address) external view returns (uint256);
    function transferFrom(address, address, uint256) external returns (bool);
}

/*───────────────────────────────────────────────────────────────────────────
  LaunchHub — the slice of IIntact the launch unit reads

  `ownerOf`, `account`, `grip`, `feeSink`, `guardianOf`, `custodyEpoch`,
  `holds`, `acts`. `transfer` bumps the custody epoch and clears the
  guardian the way the real `_update` does (DESIGN.md §4.4), so the tests
  can show a guardian's first-launch approval dying with a sale. The Reach
  and Grip are derived, codeless addresses: enough for `acts` (a test
  pranks them) and for a fee leg to land (a plain transfer succeeds).
───────────────────────────────────────────────────────────────────────────*/
contract LaunchHub {
    uint256 public minted;
    mapping(uint256 => address) private _owner;
    mapping(uint256 => uint64) public custodyEpoch;
    mapping(uint256 => address) public guardianOf;
    mapping(uint256 => bool) public feesToGrip;

    error NoSuchToken();
    error NotHolder();

    function mint(address to) external returns (uint256 id) {
        id = ++minted;
        _owner[id] = to;
        custodyEpoch[id] = 1;
    }

    function ownerOf(uint256 id) external view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function account(uint256 id) public view returns (address) {
        return address(uint160(uint256(keccak256(abi.encode("intact.reach.v1", address(this), id)))));
    }

    function grip(uint256 id) public view returns (address) {
        return address(uint160(uint256(keccak256(abi.encode("intact.grip.v1", address(this), id)))));
    }

    function feeSink(uint256 id) external view returns (address) {
        return feesToGrip[id] ? grip(id) : account(id);
    }

    function holds(uint256 id, address who) public view returns (bool) {
        return who != address(0) && _owner[id] == who;
    }

    function acts(uint256 id, address who) external view returns (bool) {
        return holds(id, who) || (who != address(0) && who == account(id));
    }

    function setGuardian(uint256 id, address g) external {
        if (_owner[id] != msg.sender) revert NotHolder();
        guardianOf[id] = g;
    }

    function setFeesToGrip(uint256 id, bool toGrip) external {
        if (_owner[id] != msg.sender) revert NotHolder();
        feesToGrip[id] = toGrip;
    }

    /// @dev A sale: new holder, epoch += 1, guardian cleared.
    function transfer(uint256 id, address to) external {
        if (_owner[id] != msg.sender) revert NotHolder();
        _owner[id] = to;
        custodyEpoch[id] += 1;
        delete guardianOf[id];
    }
}

/*───────────────────────────────────────────────────────────────────────────
  LaunchPool — `openSealed` and the reads `graduate` makes afterwards

  Pulls the base from the Launchpad by `transferFrom`, measured on
  arrival; takes the native quote as `msg.value`; records the market in
  the interface's own `Market` struct. `shortBy` makes it pull less than it
  was told, which the Launchpad must refuse (TransferFailed), because a
  market seeded with a different amount is a market at a different price.
───────────────────────────────────────────────────────────────────────────*/
contract LaunchPool {
    address public immutable LAUNCHPAD;
    uint256 public immutable shortBy;
    mapping(uint256 => Market) private _m;
    uint256[] private _sealed;
    uint256 public opens;

    event SealedOpened(uint256 indexed key, bytes32 indexed launchKey, address base, address quote, uint256 beneficiary);

    error NotLaunchpad();
    error WrongValue();
    error NotNative();
    error ZeroAmount();

    constructor(address launchpad, uint256 shortBy_) {
        LAUNCHPAD = launchpad;
        shortBy = shortBy_;
    }

    function sealedKey(bytes32 launchKey) public pure returns (uint256) {
        return uint256(keccak256(abi.encode("intact.sealed", launchKey)));
    }

    function openSealed(bytes32 launchKey, address base, address quote, uint16 feeBps, uint256 amountBase, uint256 beneficiary)
        external payable returns (uint256 key)
    {
        if (msg.sender != LAUNCHPAD) revert NotLaunchpad();
        if (quote != address(0)) revert NotNative();
        if (amountBase == 0 || msg.value == 0) revert ZeroAmount();
        key = sealedKey(launchKey);
        uint256 before = IERC20Min(base).balanceOf(address(this));
        IERC20Min(base).transferFrom(msg.sender, address(this), amountBase - shortBy);
        uint256 got = IERC20Min(base).balanceOf(address(this)) - before;
        Market storage m = _m[key];
        m.base = base;
        m.quote = quote;
        m.rBase = uint112(got);
        m.rQuote = uint112(msg.value);
        m.feeBps = feeBps;
        m.open = true;
        m.sealedMarket = true;
        m.beneficiary = beneficiary;
        _sealed.push(key);
        opens += 1;
        emit SealedOpened(key, launchKey, base, quote, beneficiary);
    }

    function marketOf(uint256 key) external view returns (Market memory) {
        return _m[key];
    }

    function sealedCount() external view returns (uint256) {
        return _sealed.length;
    }

    /// @notice Quote per 1e18 base, over the anchored reserves.
    function spot(uint256 key) external view returns (uint256) {
        Market memory m = _m[key];
        uint256 base = uint256(m.rBase) + m.vBase;
        return base == 0 ? 0 : ((uint256(m.rQuote) + m.vQuote) * 1e18) / base;
    }
}

/*───────────────────────────────────────────────────────────────────────────
  LaunchLocks — `lock` by exact delta, and the reads the tests make
───────────────────────────────────────────────────────────────────────────*/
contract LaunchLocks {
    mapping(uint256 => Lock) private _locks;
    mapping(address => uint256[]) private _of;
    uint256 public lockCount;

    error WrongValue();
    error Inexact();

    function lock(address asset, uint112 amount, address beneficiary, uint64 start, uint64 cliff, uint64 end, bool linear)
        external payable returns (uint256 id)
    {
        if (asset == address(0)) {
            if (msg.value != amount) revert WrongValue();
        } else {
            uint256 before = IERC20Min(asset).balanceOf(address(this));
            IERC20Min(asset).transferFrom(msg.sender, address(this), amount);
            if (IERC20Min(asset).balanceOf(address(this)) - before != amount) revert Inexact();
        }
        id = ++lockCount;
        _locks[id] = Lock(msg.sender, beneficiary, asset, amount, 0, start, cliff, end, linear);
        _of[beneficiary].push(id);
    }

    function lockOf(uint256 id) external view returns (Lock memory) { return _locks[id]; }
    function lockCountOf(address beneficiary) external view returns (uint256) { return _of[beneficiary].length; }
    function lockIdOf(address beneficiary, uint256 i) external view returns (uint256) { return _of[beneficiary][i]; }
}

/*───────────────────────────────────────────────────────────────────────────
  LaunchWiring — the mutual immutables, predicted then asserted

  The Kiln pins the Launchpad and the Launchpad pins the Kiln (and the
  Pool pins the Launchpad for `openSealed`), so one of them has to be
  constructed against an address that does not exist yet. DESIGN.md §12
  has tools/deploy.mjs predict it and refuse to publish on a miss; this
  does the same in one constructor, with CREATE's own arithmetic: a
  contract's nonce starts at 1 (EIP-161), so its fourth `new` lands at
  rlp(this, 4). Order: Locks (1), Pool (2), Kiln (3), Launchpad (4).
───────────────────────────────────────────────────────────────────────────*/
contract LaunchWiring {
    LaunchLocks public locks;
    LaunchPool public pool;
    Kiln public kiln;
    Launchpad public pad;

    error Mispredicted(address predicted, address actual);

    constructor(address hub, address poolManager, uint256 poolShortBy) {
        address predicted = predict(address(this), 4);
        locks = new LaunchLocks();
        pool = new LaunchPool(predicted, poolShortBy);
        kiln = new Kiln(hub, predicted, poolManager);
        pad = new Launchpad(hub, address(kiln), address(pool), address(locks));
        if (address(pad) != predicted) revert Mispredicted(predicted, address(pad));
    }

    /// @dev CREATE address for a nonce in 1..127: keccak(0xd6 0x94 ‖ deployer ‖ nonce)[12:].
    function predict(address deployer, uint8 nonce) public pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, bytes1(nonce))))));
    }
}
