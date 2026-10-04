// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IParley} from "./interfaces/IParley.sol";
import {IPostage, IPostageEvents} from "./interfaces/IPostage.sol";
import {IKeyRegistry} from "./interfaces/IKeyRegistry.sol";
import {Transient} from "./lib/Transient.sol";

interface IParleyHub {
    function ownerOf(uint256 id) external view returns (address);
    function account(uint256 id) external view returns (address);
    function custodyEpoch(uint256 id) external view returns (uint64);
}

/*═══════════════════════════════════════════════════════════════════════════

  PARLEY — the tokens talk to each other

  Origin: IPSEITY src/Parley.sol, adapted (INTACT U4). The archive
  mechanism is kept exactly; the argument for it is kept in its words.

  Every other messaging system for NFTs is a server with a wallet button on
  it. The message goes to a database, the database decides who may read it,
  and the token is a login. Turn the database off and the conversation was
  never there.

  This one has no database. A message is a log, the log is the archive, and
  the archive is wherever the chain is. There are four kinds of room:

      the commons     one room, key 0, every token in the collection
      a home room     one per token, derived from its id, the token is steward;
                      joining it is following, and its members are followers
      a group         founded by a token, joined by invitation or open door
      a pair          two tokens, derived from their two ids, never founded

  ── the part that is actually hard ──

  Logs are cheap to write and famously miserable to read. `eth_getLogs`
  over a range wide enough to hold a conversation is the request every
  public endpoint rate-limits first, and the usual answer is an indexer:
  a server, which is the thing this collection exists not to need.

  So every message carries a pointer to the block of the message before it,
  and the room stores the block of the most recent one. A client reads
  `last`, asks for exactly that one block, gets the message and the pointer
  to the block before, and walks. Fifty messages is fifty single-block
  queries — the narrowest request `eth_getLogs` accepts — and no range scan
  at any point. The chain is the index.

  The same back-link runs through a token (`prevFrom`), so "everything this
  token has ever said, anywhere" is the same walk down a different chain;
  and a third one runs through a thread (`reBlock`, `reSeq`): a reply names
  the message it answers, so a thread is walkable with the same single-
  block queries and nothing is stored to make it so. Per room the contract
  also keeps a ring of the last four (block, seq) heads: once EIP-4444
  prunes old logs from non-archive nodes, a client that cannot follow a
  pointer past the pruning line still has four entry points, and the page
  says "older messages need an archive node".

  ── who is allowed to be a token ──

  The owner, and the token's own ERC-6551 account. Not the renter. Leasing
  the instrument buys its use for a while; it does not buy the right to
  speak in its name, and a reputation is not a thing you can hand back at
  the end of the day. The bound account is included because it is the token
  acting for itself — its session keys are the owner's own delegation, made
  narrowly and revocably, which is the whole point of that account.

  ── spam, without a server ──

  Three brakes, none of them a moderator. Speaking needs a token of a
  4,096-piece edition with a secondary price. Each room has a cooldown —
  the commons a fixed two blocks, groups and home rooms whatever their
  steward sets up to seven days — keyed by (token, custody epoch), so a
  buyer is not rate-limited by the seller's last word and the seller's bucket
  dies with the sale. And a token that prices its inbox is written to only
  with a stamp (`whisperStamped`, escrowed in Postage, refunded if ignored)
  until it has written back; a reply is consent, and consent is per custody
  epoch like everything else delegated.

  ── what is public, and what is not ──

  Everything here is a log on a public chain. The commons is public because
  it is a commons. A group is public to read and closed to write. A pair is
  addressed, and addressed is not the same as private: anyone who knows two
  token ids can derive their room key and read every byte of it.

  That is why `bindKey` exists. A holder publishes a key in the KeyRegistry
  and binds it to the token; a client that finds one on both sides of a
  pair seals the body before it ever reaches this contract. The binding
  answers only while the holder and the custody epoch are unchanged — a
  sold token has no key until the buyer binds one, so a page can never
  promise privacy to a departed holder (IPSEITY `4fa41d0`). And a sealed
  send names the key it sealed to: a rotation in the mempool makes the
  transaction fail (`KeyMoved`) instead of recording a message nobody can
  open, and a send to a token with no key is refused (`NoKey`) for the same
  reason.

═══════════════════════════════════════════════════════════════════════════*/
contract Parley is IParley {
    address public immutable HUB;
    address public immutable KEYS;
    address public immutable POSTAGE;

    /*───────────────────── shape ─────────────────────*/

    uint256 public constant COMMONS = 0;

    /// @dev Long enough for something worth saying, short enough that a log
    ///      is a log. A sealed envelope carries two copies (one per key),
    ///      a salt and a point, so it is allowed four times the room.
    uint256 public constant MAX_BODY = 1024;
    uint256 public constant MAX_SEALED = 4096;
    uint256 public constant MAX_NAME = 48;
    uint32 public constant MAX_COOLDOWN = 7 days;
    /// @dev The commons brake is counted in blocks, not seconds: it is "not
    ///      twice in the same block or the next", whatever the chain's pace.
    uint64 private constant COMMONS_BLOCKS = 2;

    uint8 public constant PLAIN  = 0;   // UTF-8, readable by anyone
    uint8 public constant SEALED = 1;   // an envelope only the two keys open

    uint8 public constant IS_COMMONS = 0;
    uint8 public constant IS_GROUP   = 1;
    uint8 public constant IS_PAIR    = 2;
    uint8 public constant IS_HOME    = 3;

    /// @dev Thirty-two bytes exactly: last, count and opened as blocks,
    ///      the cooldown in seconds, members as a uint16 (an edition of
    ///      4,096 cannot overflow it), kind and the door. `headBlocks` and
    ///      `headSeqs` are four 64-bit lanes each, newest in the low lane.
    struct Room {
        uint64  last;       // block of the newest message here, 0 while silent
        uint64  count;      // messages ever said here
        uint64  opened;     // block the room came into being
        uint32  cooldown;   // seconds between two words by one token; 0 = none
        uint16  members;    // groups and home rooms; the commons is everyone
        uint8   kind;       // IS_COMMONS · IS_GROUP · IS_PAIR · IS_HOME
        bool    open;       // a room anyone may walk into
        uint256 steward;    // the token that founded it, or whose home it is
        uint256 index;      // groups are numbered, so they have short URLs
        uint256 headBlocks; // the last four blocks with a message, newest low
        uint256 headSeqs;   // the seq of the newest message in each of them
    }

    mapping(uint256 => Room) private _room;
    mapping(uint256 => string) public nameOf;

    mapping(uint256 => mapping(uint256 => bool)) public inRoom;
    mapping(uint256 => mapping(uint256 => bool)) public invited;

    /// @dev Every room a token has ever entered, appended once. Leaving does
    ///      not remove the entry — `inRoom` is the authority on membership
    ///      and this is only the list of places worth asking about. Nobody
    ///      but the token itself can make it longer, which is the reason
    ///      `invite` records permission and `join` is the token's own call:
    ///      an array a stranger can grow is an array a stranger can fill.
    mapping(uint256 => uint256[]) private _seen;

    /// @dev The block a token last spoke in, anywhere: `prevFrom`.
    ///      Full words, not uint64s: a packed value costs masking code at
    ///      every read and write and buys nothing in a slot of its own.
    mapping(uint256 => uint256) private _lastAnywhere;

    /// @dev When a token last spoke in a room, keyed by (token, custody
    ///      epoch): the cooldown bucket and the consent record. The commons
    ///      stores a block number, every other room a timestamp.
    mapping(uint256 => mapping(bytes32 => uint256)) private _last;

    /// @dev Presentation bits set by a steward. A hidden message is still
    ///      in the archive; nothing here can unsay anything.
    mapping(uint256 => mapping(uint256 => uint256)) private _hidden;

    /// @notice How many groups have ever been founded. Also the index the
    ///         next one will take.
    uint256 public groups;

    struct Binding { address owner; uint64 epoch; }
    mapping(uint256 => Binding) private _bound;

    /*  `PostageDue` and `BadReply` were this contract's own until the wave-1
        integration moved them into IParleyEvents, so the Catalog's error
        table sees them (docs/INTERFACE-CHANGES.md).                      */

    constructor(address hub, address keys, address postage) {
        HUB = hub;
        KEYS = keys;
        POSTAGE = postage;
        Room storage r = _room[COMMONS];
        r.kind = IS_COMMONS;
        r.opened = uint64(block.number);
    }

    /*═══════════════════ who may speak as a token ═══════════════════*/

    /// @notice The owner, or the token's own bound account. Deliberately not
    ///         the renter: a lease buys the instrument's use, not its name.
    function mayActAs(uint256 token, address who) public view returns (bool) {
        if (who == address(0)) return false;
        address o = _ownerOrZero(token);
        if (o == address(0)) return false;
        return who == o || who == IParleyHub(HUB).account(token);
    }

    function _ownerOrZero(uint256 token) private view returns (address) {
        try IParleyHub(HUB).ownerOf(token) returns (address o) { return o; } catch { return address(0); }
    }

    function _asToken(uint256 token) private view {
        if (!mayActAs(token, msg.sender)) revert NotYours();
    }

    /// @dev The (token, custody epoch) bucket every delegated thing is keyed by.
    function _bucket(uint256 token) private view returns (bytes32) {
        return keccak256(abi.encode(token, IParleyHub(HUB).custodyEpoch(token)));
    }

    /*═══════════════════ where rooms live ═══════════════════*/

    /// @notice The key of the nth group. Groups are numbered from 1.
    /// @dev    Hashed rather than sequential so that a group key, a pair key
    ///         and a home key can never be the same number — each hashes a
    ///         different prefix — and so that a room's key says nothing
    ///         about how many rooms exist.
    function groupKey(uint256 index) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(IS_GROUP, index)));
    }

    /// @notice The room two tokens share. It exists the moment either of
    ///         them uses it, and nobody has to create it.
    function pairKey(uint256 a, uint256 b) public pure returns (uint256) {
        (uint256 lo, uint256 hi) = a < b ? (a, b) : (b, a);
        return uint256(keccak256(abi.encodePacked(IS_PAIR, lo, hi)));
    }

    /// @notice A token's home room. Derived, so it costs nothing until the
    ///         token's first act in it; the token is its steward.
    function homeKey(uint256 token) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(IS_HOME, token)));
    }

    /// @dev A home room comes into being with its steward's first act in it —
    ///      a word, an invitation, a cooldown. A key cannot be inverted, so
    ///      until then there is nothing to follow and `join` says so.
    function _openHome(Room storage r, uint256 token) private {
        r.kind = IS_HOME;
        r.open = true;
        r.opened = uint64(block.number);
        r.steward = token;
    }

    /// @dev The rooms a steward governs: a group it founded or its own home.
    function _stewarded(uint256 room, uint256 by) private returns (Room storage r) {
        _asToken(by);
        r = _room[room];
        if (r.kind == IS_COMMONS && room == homeKey(by)) _openHome(r, by);
        if (r.kind != IS_GROUP && r.kind != IS_HOME) revert NoSuchRoom();
        if (r.steward != by) revert NotTheSteward();
    }

    /*═══════════════════ saying something ═══════════════════*/

    /// @notice Say something in the commons, a group, or a home room.
    function speak(uint256 room, uint256 from, uint8 kind, uint64 reBlock, uint64 reSeq, bytes calldata body)
        external
    {
        Transient.enter(Transient.PARLEY_LOCK);
        _asToken(from);
        Room storage r = _room[room];

        if (room == COMMONS) {
            // every token in the collection is already here
        } else if (r.kind == IS_GROUP) {
            if (!inRoom[room][from]) revert NotAMember();
        } else if (r.kind == IS_HOME) {
            if (r.steward != from && !inRoom[room][from]) revert NotAMember();
        } else if (r.kind == IS_PAIR) {
            /*  A pair room is reachable only through the derivation, and the
                derivation is where its membership is proved. Letting a raw
                key in here would mean checking membership against something
                stored, which is the storage this design does without. */
            revert UseWhisper();
        } else if (room == homeKey(from)) {
            _openHome(r, from);
        } else {
            revert NoSuchRoom();
        }

        if ((reBlock == 0) != (reSeq == 0) || reSeq > r.count) revert BadReply();
        (uint64 prev, uint64 prevFrom, uint64 seq) = _say(r, room, from, kind, body);
        emit Said(room, from, prev, prevFrom, seq, kind, reBlock, reSeq, body);
        Transient.exit(Transient.PARLEY_LOCK);
    }

    /// @notice Say something to exactly one other token.
    /// @param expectedKeyId For a SEALED body, the key id the client sealed
    ///        to; the send fails if the recipient's key is not that one.
    function whisper(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body)
        external
    {
        Transient.enter(Transient.PARLEY_LOCK);
        _asToken(from);
        (uint256 room, Room storage r) = _pair(from, to, kind, expectedKeyId);
        _admit(room, to);
        _whisperSay(r, room, from, kind, body);
        _settleIfReply(room, from);
        Transient.exit(Transient.PARLEY_LOCK);
    }

    /// @notice Whisper with the recipient's postage escrowed in Postage: the
    ///         way to a priced inbox. The stamp is refunded if the window
    ///         lapses without a reply, and settled by the reply itself.
    function whisperStamped(
        uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body,
        address expectedFeeToken, uint128 maxPostage
    ) external payable {
        Transient.enter(Transient.PARLEY_LOCK);
        _asToken(from);
        (uint256 room, Room storage r) = _pair(from, to, kind, expectedKeyId);
        IPostage(POSTAGE).stamp{value: msg.value}(room, from, to, expectedFeeToken, maxPostage);
        _whisperSay(r, room, from, kind, body);
        Transient.exit(Transient.PARLEY_LOCK);
    }

    /// @dev A whisper answers nothing by pointer: the pair is the thread.
    ///      Kept as one site so the writer below is never handed a literal
    ///      — the optimiser specialises a function per literal argument
    ///      pattern, and a second copy of `_say` measured 378 bytes.
    function _whisperSay(Room storage r, uint256 room, uint256 from, uint8 kind, bytes calldata body) private {
        (uint64 prev, uint64 prevFrom, uint64 seq) = _say(r, room, from, kind, body);
        emit Said(room, from, prev, prevFrom, seq, kind, 0, 0, body);
    }

    /// @dev The checks both whispers share, and the pair room they land in.
    function _pair(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId)
        private returns (uint256 room, Room storage r)
    {
        if (from == to) revert TalkingToYourself();
        if (_ownerOrZero(to) == address(0)) revert NoSuchToken();
        if (kind == SEALED) {
            (, bytes32 keyId,) = keyOf(to);
            if (keyId == bytes32(0)) revert NoKey();
            if (keyId != expectedKeyId) revert KeyMoved();
        }
        room = pairKey(from, to);
        r = _room[room];
        if (r.kind != IS_PAIR) {
            r.kind = IS_PAIR;
            r.opened = uint64(block.number);
        }
    }

    /// @dev The inbox rule for an unstamped whisper. A recipient that has
    ///      written in this pair as its current holder has consented, and
    ///      nothing else is asked. Otherwise its live inbox decides: closed
    ///      refuses strangers outright, priced sends them to `whisperStamped`.
    ///      `Inbox` is five static words; `postage` (word 1) and `open`
    ///      (word 3) are read out of the return data directly, as `Stamp`
    ///      is below, for the same reason.
    function _admit(uint256 room, uint256 to) private view {
        if (_last[room][_bucket(to)] != 0) return;
        (bool ok, bytes memory ret) = POSTAGE.staticcall(abi.encodeCall(IPostage.inboxOf, (to)));
        if (!ok || ret.length < 160) revert IPostageEvents.InboxClosed(to);
        uint256 postage;
        uint256 open;
        assembly ("memory-safe") {
            postage := mload(add(ret, 0x40))
            open := mload(add(ret, 0x80))
        }
        if (open == 0) revert IPostageEvents.InboxClosed(to);
        if (postage != 0) revert PostageDue(to, uint128(postage));
    }

    /// @dev If the whisperer is answering a pending stamp inside its window,
    ///      the reply collects. Postage only credits a ledger here; nothing
    ///      is pushed inside a whisper.
    /// @dev `Stamp` is ten static words; the two this needs (`to` at word 2,
    ///      `replyBy` at word 7) are read straight out of the return data
    ///      rather than through a decoder for a struct this contract never
    ///      otherwise holds — that decoder measured ~700 bytes of runtime.
    function _settleIfReply(uint256 room, uint256 from) private {
        uint256 stampId = IPostage(POSTAGE).pendingOf(room);
        if (stampId == 0) return;
        (bool ok, bytes memory ret) = POSTAGE.staticcall(abi.encodeCall(IPostage.stampOf, (stampId)));
        if (!ok || ret.length < 320) return;
        uint256 to;
        uint256 replyBy;
        assembly ("memory-safe") {
            to := mload(add(ret, 0x60))
            replyBy := mload(add(ret, 0x100))
        }
        if (to == from && block.timestamp <= replyBy) IPostage(POSTAGE).settle(room);
    }

    /// @dev The writes that make the archive walkable. The caller emits the
    ///      log, with the pointers this hands back.
    function _say(Room storage r, uint256 room, uint256 from, uint8 kind, bytes calldata body)
        private returns (uint64 prev, uint64 prevFrom, uint64 seq)
    {
        if (kind > SEALED) revert BadKind();
        if (body.length == 0 || body.length > (kind == SEALED ? MAX_SEALED : MAX_BODY)) revert BadBody();

        /*  The brake, in the unit the room counts in. The bucket is the
            token AND its custody epoch, so a buyer starts with an empty
            one and the seller's last word rate-limits nobody.           */
        bytes32 bucket = _bucket(from);
        uint256 prevHere = _last[room][bucket];
        (uint256 clock, uint256 wait) = room == COMMONS
            ? (block.number, uint256(COMMONS_BLOCKS))
            : (block.timestamp, uint256(r.cooldown));
        if (prevHere != 0 && wait != 0 && clock < prevHere + wait) revert Cooldown(uint64(prevHere + wait));
        _last[room][bucket] = clock;

        prev = r.last;
        prevFrom = uint64(_lastAnywhere[from]);
        unchecked { seq = r.count + 1; }
        r.count = seq;

        /*  The ring: a new block shifts the four lanes and enters at the
            low end; a second message in the same block only moves that
            lane's seq. Two slots, warm after the first touch.           */
        if (prev != uint64(block.number)) {
            r.last = uint64(block.number);
            r.headBlocks = (r.headBlocks << 64) | block.number;
            r.headSeqs = (r.headSeqs << 64) | seq;
        } else {
            r.headSeqs = (r.headSeqs & ~uint256(type(uint64).max)) | seq;
        }
        _lastAnywhere[from] = block.number;
    }

    /*═══════════════════ groups and home rooms ═══════════════════*/

    function found(uint256 by, string calldata name, bool openDoor)
        external returns (uint256 key)
    {
        _asToken(by);
        uint256 n = bytes(name).length;
        if (n == 0 || n > MAX_NAME) revert BadName();

        uint256 index;
        unchecked { index = ++groups; }
        key = groupKey(index);

        Room storage r = _room[key];
        r.kind = IS_GROUP;
        r.opened = uint64(block.number);
        r.steward = by;
        r.open = openDoor;
        r.index = index;
        nameOf[key] = name;

        emit Founded(key, by, index, openDoor, name);
        _enter(key, r, by);
    }

    /// @notice The steward names a token that may join. It still has to.
    function invite(uint256 room, uint256 by, uint256 token) external {
        _stewarded(room, by);
        if (_ownerOrZero(token) == address(0)) revert NoSuchToken();
        invited[room][token] = true;
        emit Invited(room, token, by);
    }

    /// @notice Walk into a group, or follow a token by walking into its home.
    function join(uint256 room, uint256 token) external {
        _asToken(token);
        Room storage r = _room[room];
        if (r.kind != IS_GROUP && r.kind != IS_HOME) revert NoSuchRoom();
        if (inRoom[room][token] || r.steward == token) revert AlreadyIn();
        if (!r.open && !invited[room][token]) revert NotInvited();
        _enter(room, r, token);
    }

    function leave(uint256 room, uint256 token) external {
        _asToken(token);
        if (!inRoom[room][token]) revert NotAMember();
        _depart(room, token);
    }

    /// @notice The steward can show a token the door. It cannot delete what
    ///         that token said — nothing here can.
    function evict(uint256 room, uint256 by, uint256 token) external {
        _stewarded(room, by);
        if (!inRoom[room][token]) revert NotAMember();
        invited[room][token] = false;
        _depart(room, token);
    }

    /// @notice How long a token must wait between two words here. Up to a
    ///         week; the commons is fixed and has no steward to ask.
    function setCooldown(uint256 room, uint256 by, uint32 seconds_) external {
        Room storage r = _stewarded(room, by);
        if (seconds_ > MAX_COOLDOWN) revert TooLong();
        r.cooldown = seconds_;
        emit CooldownSet(room, seconds_);
    }

    /// @notice Mark a message as not worth showing. A presentation bit a
    ///         client honours; the log it names is as permanent as the chain.
    function hide(uint256 room, uint256 by, uint64 seq) external {
        _stewarded(room, by);
        _hidden[room][seq >> 8] |= uint256(1) << (seq & 255);
        emit Hidden(room, seq);
    }

    function hidden(uint256 room, uint64 seq) external view returns (bool) {
        return _hidden[room][seq >> 8] & (uint256(1) << (seq & 255)) != 0;
    }

    function _enter(uint256 room, Room storage r, uint256 token) private {
        inRoom[room][token] = true;
        unchecked { r.members += 1; }

        uint256[] storage list = _seen[token];
        uint256 n = list.length;
        for (uint256 i; i < n; ++i) if (list[i] == room) { emit Entered(room, token); return; }
        list.push(room);
        emit Entered(room, token);
    }

    function _depart(uint256 room, uint256 token) private {
        inRoom[room][token] = false;
        Room storage r = _room[room];
        unchecked { if (r.members != 0) r.members -= 1; }
        emit Departed(room, token);
    }

    /*═══════════════════ sealing keys ═══════════════════*/

    /// @notice Use the key you published in the KeyRegistry for this token.
    ///         `holds` only — never the Reach, so no session key can point
    ///         a token's inbox at a key of its own — and recorded with the
    ///         custody epoch, so the binding dies with the sale.
    function bindKey(uint256 token) external {
        address o = _ownerOrZero(token);
        if (o != msg.sender) revert NotHolder();
        uint64 epoch = IParleyHub(HUB).custodyEpoch(token);
        _bound[token] = Binding(o, epoch);
        // written first so one reader serves both; a missing key unwinds it
        (uint16 keyType, bytes32 keyId,) = keyOf(token);
        if (keyId == bytes32(0)) revert NoKey();
        emit KeyBound(token, o, epoch, keyType, keyId);
    }

    /// @notice The key a client seals to, read live from the registry: the
    ///         holder's current key, as long as the holder who bound it still
    ///         holds the token under the same epoch. Zero otherwise — after
    ///         a sale, after a buy-back, after the registry entry is revoked.
    function keyOf(uint256 token) public view returns (uint16 keyType, bytes32 keyId, bytes memory publicKey) {
        Binding memory b = _bound[token];
        if (b.owner == address(0) || b.owner != _ownerOrZero(token)) return (0, bytes32(0), "");
        if (b.epoch != IParleyHub(HUB).custodyEpoch(token)) return (0, bytes32(0), "");
        (uint16 kt, bytes memory pk,) = IKeyRegistry(KEYS).getPublicKeys(b.owner);
        if (pk.length == 0) return (0, bytes32(0), "");
        return (kt, keccak256(pk), pk);
    }

    /*═══════════════════ what a client asks before it walks ═══════════════════*/

    function stateOf(uint256 room)
        external view
        returns (
            uint64 last, uint64 count, uint64 opened, uint32 members, uint8 kind, bool open,
            uint256 steward, uint256 index, uint32 cooldown,
            uint64[4] memory headBlocks, uint64[4] memory headSeqs
        )
    {
        Room storage r = _room[room];
        uint256 hb = r.headBlocks;
        uint256 hs = r.headSeqs;
        for (uint256 i; i < 4; ++i) {
            headBlocks[i] = uint64(hb >> (64 * i));
            headSeqs[i] = uint64(hs >> (64 * i));
        }
        return (r.last, r.count, r.opened, r.members, r.kind, r.open, r.steward, r.index, r.cooldown, headBlocks, headSeqs);
    }

    /// @notice Where every room's newest message is, in one call: the
    ///         9-second poll. A head that moved is a block to ask for; one
    ///         that did not is nothing to do.
    function heads(uint256[] calldata rooms) external view returns (uint64[] memory last) {
        uint256 n = rooms.length;
        last = new uint64[](n);
        for (uint256 i; i < n; ++i) last[i] = _room[rooms[i]].last;
    }

    /// @notice When a token last spoke in a room as its current holder: a
    ///         block for the commons, a timestamp elsewhere, zero never.
    function lastSpoke(uint256 room, uint256 token) external view returns (uint64) {
        return uint64(_last[room][_bucket(token)]);
    }

    /// @notice Every room this token has ever entered, and whether it is
    ///         still in each.
    function roomsOf(uint256 token)
        external view returns (uint256[] memory keys, bool[] memory member)
    {
        uint256[] storage list = _seen[token];
        uint256 n = list.length;
        keys = new uint256[](n);
        member = new bool[](n);
        for (uint256 i; i < n; ++i) {
            keys[i] = list[i];
            member[i] = inRoom[list[i]][token];
        }
    }

    function roomCount(uint256 token) external view returns (uint256) {
        return _seen[token].length;
    }

    /*═══════════════════ the topics, so a browser needs no keccak ═══════════════════*/

    /// @notice The `topic0` of every event this contract emits, derived by
    ///         the compiler from the same signatures it logs under.
    /// @dev    The client that reads this chat has no keccak — deliberately,
    ///         because a hash function shipped in a page is a hash function
    ///         nobody checked. It cannot compute a topic filter, so it asks
    ///         the contract that emits the events what they are.
    function topics()
        external pure
        returns (bytes32 said, bytes32 founded, bytes32 invited_, bytes32 entered, bytes32 departed)
    {
        said = Said.selector;
        founded = Founded.selector;
        invited_ = Invited.selector;
        entered = Entered.selector;
        departed = Departed.selector;
    }
}
