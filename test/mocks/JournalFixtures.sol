// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IJournal, IJournalEvents} from "../../src/interfaces/IJournal.sol";

/*───────────────────────────────────────────────────────────────────────────
  JournalFixtures — the hub and the collections the Journal suite writes
  into (INTACT V2 W2, NEW)

  The Journal asks the hub three things — `ownerOf`, `account` and
  `custodyEpoch` — and any other collection one or two: `ownerOf`, and
  `custodyEpoch(uint256)` where it answers. JournalHub is exactly the hub's
  three, plus the hands the suite has to prove are NOT believed (an
  ERC-4907 user, a single approval, an operator), a `transferFrom` that
  moves the epoch and clears the user and the approval as `_update` does,
  a `panic` that moves the epoch in place, and a switch that makes its
  epoch unreadable. JournalReach relays one call for the token's holder
  only, as the real Reach's `execute` does (`onlySigner`). Nothing is
  authorised beyond what the suite needs; it is a fixture, not the hub.

  The collections are the ways a foreign ERC-721 can answer: honestly
  (test/mocks/MockERC721.sol), in any of five shapes (JournalForeign), with
  a lie (JournalLiar: anyone may claim any id), or by calling back into the
  Journal from inside `ownerOf` (JournalReentrant). JournalProbe measures
  what a contract pays to read `rootOf`, the call the hub's fingerprint
  will make (V2 W6).
───────────────────────────────────────────────────────────────────────────*/

interface IJournalOwnerOf {
    function ownerOf(uint256 id) external view returns (address);
}

/// @dev The token's own hand: relays a call for whoever holds the token now.
contract JournalReach {
    address public immutable HUB;
    uint256 public immutable ID;

    error NotSigner();

    constructor(address hub, uint256 id) {
        HUB = hub;
        ID = id;
    }

    function execute(address to, bytes calldata data) external returns (bytes memory ret) {
        if (msg.sender != IJournalOwnerOf(HUB).ownerOf(ID)) revert NotSigner();
        bool ok;
        (ok, ret) = to.call(data);
        if (!ok) assembly ("memory-safe") { revert(add(ret, 32), mload(ret)) }
    }
}

contract JournalHub {
    uint256 public minted;
    bool public epochBroken;

    mapping(uint256 => address) private _owner;
    mapping(uint256 => uint64) private _epoch;
    mapping(uint256 => address) private _account;
    mapping(uint256 => address) private _user;
    mapping(uint256 => uint64) private _userExpires;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    error NoSuchToken();
    error NotHolder();
    error NotAuthorized();
    error EpochUnreadable();

    /// @dev Ids from 1; every token is born at epoch 1 with a Reach of its own.
    function mint(address to) external returns (uint256 id) {
        id = ++minted;
        _owner[id] = to;
        _epoch[id] = 1;
        _account[id] = address(new JournalReach(address(this), id));
    }

    function ownerOf(uint256 id) public view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function account(uint256 id) external view returns (address) {
        return _account[id];
    }

    function custodyEpoch(uint256 id) external view returns (uint64) {
        if (epochBroken) revert EpochUnreadable();
        return _epoch[id];
    }

    function userOf(uint256 id) external view returns (address) {
        return _userExpires[id] >= block.timestamp ? _user[id] : address(0);
    }

    function setUser(uint256 id, address user, uint64 expires) external {
        if (ownerOf(id) != msg.sender) revert NotHolder();
        _user[id] = user;
        _userExpires[id] = expires;
    }

    function approve(address to, uint256 id) external {
        if (ownerOf(id) != msg.sender) revert NotHolder();
        getApproved[id] = to;
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }

    /// @dev What `_update` does to the parts the Journal can see: the holder
    ///      changes, the epoch moves by one, the approval and the user die.
    function transferFrom(address from, address to, uint256 id) external {
        address o = ownerOf(id);
        if (o != from) revert NotHolder();
        if (msg.sender != o && msg.sender != getApproved[id] && !isApprovedForAll[o][msg.sender]) revert NotAuthorized();
        _owner[id] = to;
        _epoch[id] += 1;
        _strip(id);
    }

    /// @dev The epoch moves in place: same holder, a new custody.
    function panic(uint256 id) external {
        if (ownerOf(id) != msg.sender) revert NotHolder();
        _epoch[id] += 1;
        _strip(id);
    }

    function breakEpoch(bool broken) external {
        epochBroken = broken;
    }

    function _strip(uint256 id) private {
        delete getApproved[id];
        delete _user[id];
        delete _userExpires[id];
    }
}

/// @dev A collection that answers in any of five shapes, for `ownerOf` and
///      for `custodyEpoch` separately; and an `account(id)` that names
///      whoever it was told to, which the Journal must never ask.
contract JournalForeign {
    uint8 public constant HONEST  = 0;   // the word it was given
    uint8 public constant REVERTS = 1;   // reverts, carrying the word: a revert is no answer, whatever it says
    uint8 public constant SHORT   = 2;   // 31 bytes of the word
    uint8 public constant SILENT  = 3;   // success, nothing returned
    uint8 public constant WIDE    = 4;   // the word with bit 255 set

    mapping(uint256 => address) private _owner;
    uint8 public ownerMode;
    uint8 public epochMode;
    uint256 public epochWord;
    address public accountAnswer;

    function mint(address to, uint256 id) external { _owner[id] = to; }
    function setOwnerMode(uint8 mode) external { ownerMode = mode; }
    function setEpoch(uint8 mode, uint256 word) external { epochMode = mode; epochWord = word; }
    function setAccount(address a) external { accountAnswer = a; }

    function ownerOf(uint256 id) external view returns (address) {
        _answer(ownerMode, uint256(uint160(_owner[id])));
    }

    function custodyEpoch(uint256) external view returns (uint64) {
        _answer(epochMode, epochWord);
    }

    function account(uint256) external view returns (address) {
        return accountAnswer;
    }

    /// @dev Every mode leaves from here, so neither caller reaches its end.
    ///      The revert carries the whole word, so a reader that decoded
    ///      revert data as an answer would read the right-looking value.
    function _answer(uint8 mode, uint256 word) private pure {
        if (mode == WIDE) word |= uint256(1) << 255;
        uint256 size = mode == SHORT ? 31 : mode == SILENT ? 0 : 32;
        if (mode == REVERTS) {
            assembly ("memory-safe") {
                mstore(0, word)
                revert(0, 32)
            }
        }
        assembly ("memory-safe") {
            mstore(0, word)
            return(0, size)
        }
    }
}

/// @dev A collection that lies: anyone may claim any id, at any time. It
///      also keeps an epoch, and lies about that the same way.
contract JournalLiar {
    mapping(uint256 => address) public ownerOf;
    uint64 public constant EPOCH = 7;

    function claim(uint256 id) external { ownerOf[id] = msg.sender; }
    function custodyEpoch(uint256) external pure returns (uint64) { return EPOCH; }
}

/// @dev A collection whose `ownerOf(1)` calls back into `inscribe` for id 2
///      and names `writer` only if the Journal refused that inner call with
///      `Reentrancy()` by name. Id 2 names this contract, so without the
///      lock the inner write would pass the holder check and die on its
///      first store in the static frame instead — with no data, which
///      names nobody.
contract JournalReentrant {
    IJournal public immutable JOURNAL;
    address public writer;

    constructor(IJournal journal) { JOURNAL = journal; }

    function setWriter(address w) external { writer = w; }

    function ownerOf(uint256 id) external view returns (address) {
        if (id == 2) return address(this);
        (bool ok, bytes memory ret) = address(JOURNAL).staticcall(
            abi.encodeCall(IJournal.inscribe, (address(this), 2, 0, bytes("from inside ownerOf"), bytes32(0))));
        if (!ok && ret.length == 4 && bytes4(ret) == IJournalEvents.Reentrancy.selector) return writer;
        return address(0);
    }
}

/// @dev What a contract pays to read a root: the gas between the two
///      `gasleft()`s around one typed `rootOf` call, cold or warm as the
///      caller's transaction left the Journal.
contract JournalProbe {
    function measure(IJournal journal, address collection, uint256 id)
        external view returns (uint256 used, bytes32 root)
    {
        uint256 g = gasleft();
        root = journal.rootOf(collection, id);
        used = g - gasleft();
    }
}
