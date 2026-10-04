// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IParley — speech that the chain itself indexes

  DESIGN.md §7.1-7.3, signatures verbatim; frozen after wave 0. Rooms: the
  commons (0), home rooms `keccak(3, token)`, groups `keccak(1, index)`,
  pairs `keccak(2, min, max)`. Bodies are logs only. `mayActAs` is `acts`.
  IPSEITY's `inRoom`, `invited`, `nameOf`, `groups`, `roomsOf`, `roomCount`
  and `lastSpoke` are kept where DESIGN is silent.
───────────────────────────────────────────────────────────────────────────*/

interface IParleyEvents {
    event Said(uint256 indexed room, uint256 indexed from, uint64 prev, uint64 prevFrom, uint64 seq, uint8 kind, uint64 reBlock, uint64 reSeq, bytes body);
    event Founded(uint256 indexed room, uint256 indexed by, uint256 index, bool open, string name);
    event Invited(uint256 indexed room, uint256 indexed token, uint256 by);
    event Entered(uint256 indexed room, uint256 indexed token);
    event Departed(uint256 indexed room, uint256 indexed token);
    event KeyBound(uint256 indexed token, address indexed owner, uint64 epoch, uint16 keyType, bytes32 keyId);
    event CooldownSet(uint256 indexed room, uint32 seconds_);
    event Hidden(uint256 indexed room, uint64 seq);

    error NotYours();
    error NoSuchToken();
    error NoSuchRoom();
    error NotAMember();
    error NotTheSteward();
    error NotInvited();
    error AlreadyIn();
    error BadBody();
    error BadKind();
    error BadName();
    error TalkingToYourself();
    error UseWhisper();
    error Cooldown(uint64 until);
    error TooLong();
    error KeyMoved();
    error NoKey();
    error NotHolder();
    error Reentrancy();
    /*── added in the wave-1 integration (docs/INTERFACE-CHANGES.md, additive) ──*/
    /// @notice The recipient prices its inbox and the sender came without a stamp.
    error PostageDue(uint256 to, uint128 postage);
    /// @notice A reply pointer that names no message in this room.
    error BadReply();
}

interface IParley is IParleyEvents {
    /*── constants ──*/
    function COMMONS() external view returns (uint256);
    function MAX_BODY() external view returns (uint256);        // 1,024 for PLAIN
    function MAX_SEALED() external view returns (uint256);      // 4,096 for SEALED
    function MAX_NAME() external view returns (uint256);        // 48
    function MAX_COOLDOWN() external view returns (uint32);     // 7 days
    function PLAIN() external view returns (uint8);
    function SEALED() external view returns (uint8);
    function IS_COMMONS() external view returns (uint8);
    function IS_GROUP() external view returns (uint8);
    function IS_PAIR() external view returns (uint8);
    function IS_HOME() external view returns (uint8);

    /*── predicates and keys ──*/
    function mayActAs(uint256 token, address who) external view returns (bool);
    function groupKey(uint256 index) external pure returns (uint256);
    function pairKey(uint256 a, uint256 b) external pure returns (uint256);
    function homeKey(uint256 token) external pure returns (uint256);                   // keccak(3, token)

    /*── speaking ──*/
    function speak(uint256 room, uint256 from, uint8 kind, uint64 reBlock, uint64 reSeq, bytes calldata body) external;
    function whisper(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body) external;
    function whisperStamped(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body, address expectedFeeToken, uint128 maxPostage) external payable;

    /*── rooms ──*/
    function found(uint256 by, string calldata name, bool openDoor) external returns (uint256 key);
    function invite(uint256 room, uint256 by, uint256 token) external;
    function join(uint256 room, uint256 token) external;
    function leave(uint256 room, uint256 token) external;
    function evict(uint256 room, uint256 by, uint256 token) external;
    function setCooldown(uint256 room, uint256 by, uint32 seconds_) external;        // steward, ≤ 7 d
    function hide(uint256 room, uint256 by, uint64 seq) external;                    // steward; presentation bit, never deletion

    /*── keys ──*/
    function bindKey(uint256 token) external;                                        // holds
    function keyOf(uint256 token) external view returns (uint16 keyType, bytes32 keyId, bytes memory publicKey);   // zero unless owner and epoch unchanged

    /*── reading ──*/
    function stateOf(uint256 room) external view returns (uint64 last, uint64 count, uint64 opened, uint32 members, uint8 kind, bool open, uint256 steward, uint256 index, uint32 cooldown, uint64[4] memory headBlocks, uint64[4] memory headSeqs);
    function heads(uint256[] calldata rooms) external view returns (uint64[] memory);
    function topics() external pure returns (bytes32 said, bytes32 founded, bytes32 invited, bytes32 entered, bytes32 departed);
    function groups() external view returns (uint256);
    function nameOf(uint256 room) external view returns (string memory);
    function inRoom(uint256 room, uint256 token) external view returns (bool);
    function invited(uint256 room, uint256 token) external view returns (bool);
    function hidden(uint256 room, uint64 seq) external view returns (bool);
    function roomsOf(uint256 token) external view returns (uint256[] memory keys, bool[] memory member);
    function roomCount(uint256 token) external view returns (uint256);
    function lastSpoke(uint256 room, uint256 token) external view returns (uint64);

    function HUB() external view returns (address);
    function KEYS() external view returns (address);
    function POSTAGE() external view returns (address);
}

/// @notice Roster — 256-bit membership windows over Parley (IPSEITY Roster.sol verbatim).
interface IRoster {
    function kindOf(uint256 room) external view returns (uint8);
    function inWindow(uint256 room, uint256 from) external view returns (uint256 bits);
    function invitedInWindow(uint256 room, uint256 from) external view returns (uint256 bits);
    function membersOf(uint256 room, uint256 from) external view returns (uint256[] memory ids, uint256 next);
    function stewardedBy(uint256 token, uint256 fromIndex, uint256 count) external view returns (uint256[] memory rooms);
    function heldBy(uint256 token) external view returns (address);
    function PARLEY() external view returns (address);
    function HUB() external view returns (address);
}
