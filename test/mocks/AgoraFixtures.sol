// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgora} from "../../src/interfaces/IAgora.sol";

/*───────────────────────────────────────────────────────────────────────────
  AgoraFixtures — the world as Agora sees it, beyond the hub (INTACT V2 W5)

  Agora asks three things of the world besides the hub, which
  test/mocks/SocialHub.sol stands in for: whether the Studio launched a
  collection (`isCollection`), who holds a token of any collection
  (`ownerOf`) and whether that collection reports a custody epoch
  (`custodyEpoch`). These are exactly those, plus the two payees a tipped
  reaction has to survive: one that refuses money and one that calls back
  while it is being paid. A collection from elsewhere, with no epoch and
  no registration, is test/mocks/MockERC721.sol, unchanged.

  Nothing is authorised beyond what the suites need; these are fixtures.
───────────────────────────────────────────────────────────────────────────*/

/// @dev The Studio's one answer Agora reads. `register` is open: the real
///      Studio registers what it launches, and a fixture only has to say so.
contract AgoraStudio {
    mapping(address => bool) public isCollection;
    function register(address collection) external { isCollection[collection] = true; }
    function unregister(address collection) external { isCollection[collection] = false; }
}

/// @dev A Studio that refuses to answer: the register must read as empty,
///      never as a revert that silences the hub's own commons with it.
contract AgoraRevertingStudio {
    error Refused();
    function isCollection(address) external pure returns (bool) { revert Refused(); }
}

/// @dev A Studio that answers a word that is neither yes nor no.
contract AgoraMumblingStudio {
    function isCollection(address) external pure returns (uint256) { return 2; }
}

/// @dev A Studio collection as Agora sees it: an ERC-721 whose `ownerOf`
///      reverts for a token that does not exist, and which reports a
///      custody epoch that moves on every transfer — so its stamp moves on a
///      buy-back, as the hub's does.
contract AgoraCollection {
    mapping(uint256 => address) private _owner;
    mapping(uint256 => uint64) public custodyEpoch;
    uint256 public minted;

    error NoSuchToken();
    error NotHolder();

    function mint(address to) external returns (uint256 id) {
        id = ++minted;
        _owner[id] = to;
        custodyEpoch[id] = 1;
    }

    function ownerOf(uint256 id) public view returns (address o) {
        o = _owner[id];
        if (o == address(0)) revert NoSuchToken();
    }

    function transferFrom(address from, address to, uint256 id) external {
        if (ownerOf(id) != from || msg.sender != from) revert NotHolder();
        _owner[id] = to;
        custodyEpoch[id] += 1;
    }
}

/// @dev A holder that takes no money: no `receive`, no `fallback`.
contract AgoraRefusingHolder {}

/// @dev A holder that, while a tip to it is being pushed, tries to speak
///      and to react again through Agora as the persona it holds, and
///      writes down how each attempt was refused. It accepts the tip either
///      way, so the outer reaction lands and the record can be read.
contract AgoraReentrantHolder {
    IAgora public immutable agora;
    uint256 public me;
    uint256 public room;
    uint64 public seq;
    bytes4 public reactRefusal;
    bytes4 public speakRefusal;
    bool public called;

    constructor(IAgora agora_) { agora = agora_; }

    function aim(uint256 me_, uint256 room_, uint64 seq_) external {
        me = me_;
        room = room_;
        seq = seq_;
    }

    receive() external payable {
        called = true;
        try agora.react(room, me, seq, me, bytes4("+")) {} catch (bytes memory e) { reactRefusal = bytes4(e); }
        try agora.speak(room, me, 0, 0, 0, "while I am being paid") {} catch (bytes memory e) { speakRefusal = bytes4(e); }
    }
}
