// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IAgora — one social layer for every token (V2, unit W5; Parley's successor)

  docs/V2.md §3.5. Parley's rooms and rules, with identity widened from
  "a hub token" to a persona (lib/Persona): any ERC-721 token, packed into
  one word, `collection << 96 | id`. Whoever acts as the persona speaks as
  it (the hub's `acts` for a hub token, `holds` for any other).

  Rooms (keys as Parley's, `uint256(keccak256(abi.encodePacked(uint8 kind, …)))`,
  plus one):
    COMMONS 0                     personas of a registered collection — the
                                  hub and every Studio collection (`isRegistered`)
    groupKey(i)       (1, uint256 i)          founded by a persona; open or by invitation
    pairKey(a,b)      (2, uint256 lo, uint256 hi)  sealed whispers between two personas
    homeKey(p)        (3, uint256 p)          the persona's own room, opened by its first word
    collectionKey(c)  (4, address c)          the holders of collection c, any ERC-721
  A Collection's `room()` is `collectionKey(address(this))`, computed by the
  same formula without a call.

  Bodies are logs only, as in Parley: PLAIN ≤ MAX_BODY bytes, SEALED ≤
  MAX_SEALED bytes of P-256 ciphertext to keys bound through KeyRegistry.
  Cooldowns, key bindings and memberships that are delegated things are
  keyed by the persona's stamp (keccak(holder, custody epoch)), so a sale
  silences the seller; follows are keyed by the persona itself, so a
  token's followers follow the token to its next holder.

  A reaction is a glyph (≤ 4 bytes of UTF-8) on one message, and may carry
  a tip: `msg.value` is paid to the payee of the persona the reactor
  names as the message's author, in the same call. The contract does not
  store authors; the viewer checks the name against the `Said` log, and a
  reactor who names the wrong author has misdirected only their own money.

  Frozen after V2 wave 0: additive changes only, recorded in
  docs/INTERFACE-CHANGES.md.
───────────────────────────────────────────────────────────────────────────*/

interface IAgoraEvents {
    event Said(uint256 indexed room, uint256 indexed from, uint64 prev, uint64 prevFrom, uint64 seq, uint8 kind, uint64 reBlock, uint64 reSeq, bytes body);
    event Reacted(uint256 indexed room, uint256 indexed from, uint256 indexed to, uint64 seq, bytes4 glyph, uint256 tip);
    event Followed(uint256 indexed from, uint256 indexed to, bool on);
    event Founded(uint256 indexed room, uint256 indexed by, uint256 index, bool open, string name);
    event Invited(uint256 indexed room, uint256 indexed persona, uint256 by);
    event Entered(uint256 indexed room, uint256 indexed persona);
    event Departed(uint256 indexed room, uint256 indexed persona);
    event KeyBound(uint256 indexed persona, address indexed holder, bytes32 stamp, uint16 keyType, bytes32 keyId);
    event CooldownSet(uint256 indexed room, uint32 seconds_);
    event Hidden(uint256 indexed room, uint64 seq);

    error NotYours();
    error NoSuchRoom();
    error NotAMember();
    error NotTheSteward();
    error NotInvited();
    error AlreadyIn();
    error BadBody();
    error BadKind();
    error BadName();
    error BadReply();
    error BadGlyph();
    error TalkingToYourself();
    error UseWhisper();
    error Cooldown(uint64 until);
    error TooLong();
    error KeyMoved();
    error NoKey();
    error Unregistered(address collection);
    error NotOfCollection(uint256 persona, address collection);
    error NoPayee(uint256 persona);
    error TipFailed();
    error Reentrancy();
}

interface IAgora is IAgoraEvents {
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
    function IS_COLLECTION() external view returns (uint8);

    /*── personas and keys ──*/
    function persona(address collection, uint256 id) external pure returns (uint256);
    function split(uint256 persona_) external pure returns (address collection, uint256 id);
    function mayActAs(uint256 persona_, address who) external view returns (bool);
    function isRegistered(address collection) external view returns (bool);
    function groupKey(uint256 index) external pure returns (uint256);
    function pairKey(uint256 a, uint256 b) external pure returns (uint256);
    function homeKey(uint256 persona_) external pure returns (uint256);
    function collectionKey(address collection) external pure returns (uint256);

    /*── speaking ──*/
    function speak(uint256 room, uint256 from, uint8 kind, uint64 reBlock, uint64 reSeq, bytes calldata body) external;
    function whisper(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body) external;
    function react(uint256 room, uint256 from, uint64 seq, uint256 author, bytes4 glyph) external payable;
    function follow(uint256 from, uint256 to, bool on) external;

    /*── rooms ──*/
    function found(uint256 by, string calldata name, bool openDoor) external returns (uint256 key);
    function invite(uint256 room, uint256 by, uint256 persona_) external;
    function join(uint256 room, uint256 persona_) external;
    function leave(uint256 room, uint256 persona_) external;
    function setCooldown(uint256 room, uint256 by, uint32 seconds_) external;   // steward, ≤ MAX_COOLDOWN
    function hide(uint256 room, uint256 by, uint64 seq) external;               // steward; presentation, never deletion
    /*── added in the V2 wave-1 integration (docs/INTERFACE-CHANGES.md, additive) ──*/
    function evict(uint256 room, uint256 by, uint256 persona_) external;        // steward

    /*── keys ──*/
    function bindKey(uint256 persona_) external;
    function keyOf(uint256 persona_) external view returns (uint16 keyType, bytes32 keyId, bytes memory publicKey);

    /*── reading ──*/
    function stateOf(uint256 room) external view returns (uint64 last, uint64 count, uint64 opened, uint32 members, uint8 kind, bool open, uint256 steward, uint256 index, uint32 cooldown, uint64[4] memory headBlocks, uint64[4] memory headSeqs);
    function nameOf(uint256 room) external view returns (string memory);
    function inRoom(uint256 room, uint256 persona_) external view returns (bool);
    function invited(uint256 room, uint256 persona_) external view returns (bool);
    function hidden(uint256 room, uint64 seq) external view returns (bool);
    function lastSpoke(uint256 room, uint256 persona_) external view returns (uint64);
    function follows(uint256 from, uint256 to) external view returns (bool);
    function followerCount(uint256 persona_) external view returns (uint256);
    function followingCount(uint256 persona_) external view returns (uint256);
    function groups() external view returns (uint256);
    /*── added in the V2 wave-1 integration (docs/INTERFACE-CHANGES.md, additive) ──*/
    /// @notice Each room's newest block, in one call (Parley's `heads`).
    function heads(uint256[] calldata rooms) external view returns (uint64[] memory last);
    /// @notice Every room this persona has taken a seat in, and whether its
    ///         current holder is seated in each.
    function roomsOf(uint256 persona_) external view returns (uint256[] memory keys, bool[] memory member);
    function roomCount(uint256 persona_) external view returns (uint256);
    /// @notice The topic0 of the events a page filters on; Parley's five first.
    function topics() external pure returns (
        bytes32 said, bytes32 founded, bytes32 invited_, bytes32 entered, bytes32 departed,
        bytes32 reacted, bytes32 followed
    );

    function HUB() external view returns (address);
    function KEYS() external view returns (address);
    function STUDIO() external view returns (address);
}
