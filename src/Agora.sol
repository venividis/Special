// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgora} from "./interfaces/IAgora.sol";
import {IKeyRegistry} from "./interfaces/IKeyRegistry.sol";
import {IStudio} from "./interfaces/IStudio.sol";
import {Persona} from "./lib/Persona.sol";
import {Transient} from "./lib/Transient.sol";

/*═══════════════════════════════════════════════════════════════════════════

  AGORA — every token talks to every other

  Origin: src/Parley.sol, generalized (INTACT V2, unit W5; docs/V2.md §3.5).
  Parley's archive is kept exactly: bodies live in logs only, every message
  points at the block of the one before it in its room (`prev`), at the
  block of its author's last word anywhere (`prevFrom`) and, as a reply, at
  the message it answers (`reBlock`, `reSeq`); a room stores the block of
  its newest message and a ring of its last four heads. A client reads
  `last`, asks the node for exactly that one block, and walks: the chain is
  the index, and no range scan happens at any point. Parley's header argues
  that at length and this one does not repeat it.

  What changed is who speaks. Parley's speaker was a token of one hub;
  Agora's is a persona (lib/Persona): any ERC-721 token in one word,
  `collection << 96 | id`, so one set of rooms and one set of rules serves
  every collection at once, and the page that reads one room reads them all.

  ── who speaks as a persona ──

  Whoever `Persona.actsFor` names: for a hub token its holder or its own
  Reach (the hub's `acts`), for any other token its holder, read by a
  guarded staticcall in which no code, a revert or a short answer is
  nobody. Never a renter: a lease buys the instrument's use, not its name.
  A collection that lies about `ownerOf` lies only about its own personas,
  and a persona of a lying collection enters only the rooms a real token of
  that collection could: the lie buys nothing a holder would not have.

  ── the rooms ──

      the commons     key 0: personas of a registered collection — the hub
                      and every Studio collection — and of nothing else
      a collection    collectionKey(c), one per ERC-721, never founded: only
                      c's own personas speak there, so a collection from
                      anywhere has a room on chain the moment one of its
                      holders says something
      a home          homeKey(p), one per persona, opened by its first act;
                      the persona is its steward
      a group         founded by a persona; open, or by invitation
      a pair          two personas, derived from both, never founded: the
                      sealed whispers, unchanged in crypto

  The commons is registered-only because it is the one room every page
  shows, and a collection anyone can deploy in a minute is a collection
  whose holders could flood it in the next. The register is the hub and
  the Studio's collections, read live; a Studio that is absent or reverts
  registers nothing, and then the hub alone speaks there — V1's commons.
  A collection room has no steward to set a cooldown, so it brakes as the
  commons does: two blocks between two words of one persona.

  ── what a sale ends, and what it passes on ──

  Cooldown clocks, seats in a room, invitations and key bindings are what a
  holder was given, not what the token is. Each is keyed by the persona's
  stamp (`Persona.stampOf`: keccak of the holder and the custody epoch), so
  a sale silences the seller, gives the buyer an empty brake, voids the
  seller's seats and invitations and kills the seller's key — as Parley's
  (token, custody epoch) bucket did. What belongs to the token
  passes to the buyer: the stewardship of its home and of the groups it
  founded, the back-link through everything it has said, and its follows.

  Follows are the token's by design. A token's followers follow the token
  to its next holder, which is what makes a token worth following; what the
  token follows passes with it too, for the buyer to keep or to undo.

  ── reactions, and the money in them ──

  A reaction is a glyph — one to four bytes of UTF-8 — on one message, and
  it may carry a tip: `msg.value`, pushed in the same call to the payee of
  the persona the reactor names as the author (for a hub token its fee
  sink, the Reach or the Grip; for any other token its holder). Authors are
  not stored, so nothing here can check the name: the viewer checks it
  against the `Said` log, and a reactor who names the wrong author has
  misdirected only their own money. The push is the only value this
  contract ever moves; it holds nothing before the call and nothing after.

  ── what Parley had that Agora does not ──

  Postage. A priced inbox and its escrowed stamps were Parley's satellite,
  and IAgora names neither, so every whisper here is admitted and free; a
  price on a persona's attention is a later satellite, not a field here.
  And Roster, whose 256-wide windows read one band of small ids, which
  personas are not: `stateOf`, `inRoom` and `roomsOf` are the reads left.

═══════════════════════════════════════════════════════════════════════════*/
contract Agora is IAgora {
    address public immutable HUB;
    address public immutable KEYS;
    address public immutable STUDIO;

    /*───────────────────── shape ─────────────────────*/

    uint256 public constant COMMONS = 0;

    /// @dev Long enough for something worth saying, short enough that a log
    ///      is a log. A sealed envelope carries two copies (one per key),
    ///      a salt and a point, so it is allowed four times the room.
    uint256 public constant MAX_BODY = 1024;
    uint256 public constant MAX_SEALED = 4096;
    uint256 public constant MAX_NAME = 48;
    uint32 public constant MAX_COOLDOWN = 7 days;
    /// @dev The commons brake, and every collection room's, is counted in
    ///      blocks: "not twice in the same block or the next", whatever the
    ///      chain's pace.
    uint64 private constant COMMONS_BLOCKS = 2;

    uint8 public constant PLAIN  = 0;   // UTF-8, readable by anyone
    uint8 public constant SEALED = 1;   // an envelope only the two keys open

    /// @dev Each kind is also the prefix its room key is hashed under, so
    ///      two kinds can never derive the same key.
    uint8 public constant IS_COMMONS    = 0;
    uint8 public constant IS_GROUP      = 1;
    uint8 public constant IS_PAIR       = 2;
    uint8 public constant IS_HOME       = 3;
    uint8 public constant IS_COLLECTION = 4;

    /// @dev Thirty-two bytes exactly in the first slot. `members` is 32 bits
    ///      where Parley's was 16: Parley's edition of 4,096 bounded a room,
    ///      and an open group of personas has no edition. To pay for it,
    ///      `opened` is stored in 48 bits — written once, read only by
    ///      `stateOf`, and 2^48 blocks is two million years of quarter-second
    ///      blocks. `index` numbers a group and, for a collection room, holds
    ///      its collection: the one thing a page names that room by, and the
    ///      thing a refusal to an outsider must name. `headBlocks` and
    ///      `headSeqs` are four 64-bit lanes each, newest in the low lane.
    struct Room {
        uint64  last;       // block of the newest message here, 0 while silent
        uint64  count;      // messages ever said here
        uint48  opened;     // block the room came into being; 0 = never opened
        uint32  cooldown;   // seconds between two words by one persona; 0 = none
        uint32  members;    // seats taken in a group or home; see `_take`
        uint8   kind;       // IS_COMMONS · IS_GROUP · IS_PAIR · IS_HOME · IS_COLLECTION
        bool    open;       // a room anyone may walk into
        uint256 steward;    // the persona that founded it, or whose home it is
        uint256 index;      // a group's number; a collection room's collection
        uint256 headBlocks; // the last four blocks with a message, newest low
        uint256 headSeqs;   // the seq of the newest message in each of them
    }

    mapping(uint256 => Room) private _room;
    mapping(uint256 => string) public nameOf;

    /// @dev A seat is (room, persona) and records the stamp of the holder
    ///      who took it. "In the room" is "the seat's stamp is the persona's
    ///      live stamp", so a sale empties the seat without a write and the
    ///      buyer has to take it for itself. An invitation is recorded the
    ///      same way and dies the same way: the steward invited a holder.
    mapping(uint256 => mapping(uint256 => bytes32)) private _seat;
    mapping(uint256 => mapping(uint256 => bytes32)) private _invite;

    /// @dev Every room a persona has ever taken a seat in, appended once.
    ///      Leaving does not remove the entry — the seat is the authority on
    ///      membership and this is only the list of places worth asking
    ///      about. Nobody but the persona's own actor can make it longer,
    ///      which is the reason `invite` records permission and `join` is the
    ///      persona's own call: an array a stranger can grow is an array a
    ///      stranger can fill.
    mapping(uint256 => uint256[]) private _seen;

    /// @dev The block a persona last spoke in, anywhere: `prevFrom`. Keyed
    ///      by the persona, not its stamp, so "everything this token has ever
    ///      said" is one walk across all its holders.
    mapping(uint256 => uint256) private _lastAnywhere;

    /// @dev When a persona last spoke in a room, keyed by (persona, stamp):
    ///      the cooldown bucket. The commons and collection rooms store a
    ///      block number, every other room a timestamp.
    mapping(uint256 => mapping(bytes32 => uint256)) private _last;

    /// @dev Presentation bits set by a steward. A hidden message is still
    ///      in the archive; nothing here can unsay anything.
    mapping(uint256 => mapping(uint256 => uint256)) private _hidden;

    /// @notice How many groups have ever been founded. Also the index the
    ///         next one will take.
    uint256 public groups;

    /// @dev The stamp a key was bound under. One word: the stamp already
    ///      commits to the holder and the custody epoch, so comparing it with
    ///      the live stamp is comparing both.
    mapping(uint256 => bytes32) private _bound;

    /// @notice The follow graph, keyed by the personas themselves.
    mapping(uint256 => mapping(uint256 => bool)) public follows;
    mapping(uint256 => uint256) public followerCount;
    mapping(uint256 => uint256) public followingCount;

    constructor(address hub, address keys, address studio) {
        HUB = hub;
        KEYS = keys;
        STUDIO = studio;
        Room storage r = _room[COMMONS];
        r.kind = IS_COMMONS;
        r.opened = uint48(block.number);
    }

    /*═══════════════════ personas ═══════════════════*/

    function persona(address collection, uint256 id) external pure returns (uint256) {
        return Persona.pack(collection, id);
    }

    function split(uint256 persona_) external pure returns (address collection, uint256 id) {
        return Persona.split(persona_);
    }

    /// @notice The hub's `acts` for a hub token (holder or Reach), `holds`
    ///         for any other. Deliberately not the renter.
    function mayActAs(uint256 persona_, address who) public view returns (bool) {
        return Persona.actsFor(HUB, persona_, who);
    }

    /// @notice Whether a collection's personas speak in the commons: the hub,
    ///         and whatever the Studio says it launched.
    /// @dev    The Studio is read with EXTCODESIZE and a low-level staticcall,
    ///         never a typed call, which on a codeless address reverts before
    ///         it is made: an absent Studio, a reverting one, a short answer
    ///         or a word that is neither 0 nor 1 is "no", and the hub alone is
    ///         registered.
    function isRegistered(address collection) public view returns (bool) {
        if (collection == HUB) return true;
        if (STUDIO.code.length == 0) return false;
        (bool ok, bytes memory ret) =
            STUDIO.staticcall(abi.encodeWithSelector(IStudio.isCollection.selector, collection));
        return ok && ret.length >= 32 && abi.decode(ret, (uint256)) == 1;
    }

    function _asPersona(uint256 p) private view {
        if (!mayActAs(p, msg.sender)) revert NotYours();
    }

    /// @dev Parley refused a whisper or an invitation to a token that did
    ///      not exist (`NoSuchToken`). IAgora froze no such error, and a
    ///      token nobody holds is not "one token of one ERC-721", so the
    ///      refusal is Persona's own, which `persona()` already raises.
    function _mustBeHeld(uint256 p) private view {
        if (Persona.holderOf(p) == address(0)) {
            (address c, uint256 id) = Persona.split(p);
            revert Persona.NotAPersona(c, id);
        }
    }

    /// @dev The (persona, stamp) bucket a cooldown clock is keyed by. The
    ///      stamp alone commits to (holder, epoch), which two personas of one
    ///      holder can share; the persona makes the bucket the token's.
    function _bucket(uint256 p, bytes32 stamp) private pure returns (bytes32) {
        return keccak256(abi.encode(p, stamp));
    }

    /*═══════════════════ where rooms live ═══════════════════*/

    /// @notice The key of the nth group. Groups are numbered from 1.
    /// @dev    Hashed rather than sequential so that no two kinds of room can
    ///         ever share a key — each hashes a different prefix — and so that
    ///         a key says nothing about how many rooms exist.
    function groupKey(uint256 index) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(IS_GROUP, index)));
    }

    /// @notice The room two personas share. It exists the moment either of
    ///         them uses it, and nobody has to create it.
    function pairKey(uint256 a, uint256 b) public pure returns (uint256) {
        (uint256 lo, uint256 hi) = a < b ? (a, b) : (b, a);
        return uint256(keccak256(abi.encodePacked(IS_PAIR, lo, hi)));
    }

    /// @notice A persona's home room. Derived, so it costs nothing until the
    ///         persona's first act in it; the persona is its steward.
    function homeKey(uint256 persona_) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(IS_HOME, persona_)));
    }

    /// @notice The room of a collection's holders. Every ERC-721 has one and
    ///         nobody founds it; a Collection computes its own `room()` by
    ///         this formula without a call.
    function collectionKey(address collection) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(IS_COLLECTION, collection)));
    }

    /// @dev A home room comes into being with its steward's first act in it —
    ///      a word, an invitation, a cooldown. A key cannot be inverted, so
    ///      until then there is nothing to join and `join` says so.
    function _openHome(Room storage r, uint256 p) private {
        r.kind = IS_HOME;
        r.open = true;
        r.opened = uint48(block.number);
        r.steward = p;
    }

    /// @dev A collection room comes into being with the first word of one of
    ///      its collection's personas, for the same reason: until then its
    ///      key is a number nobody can invert, and an outsider who names it
    ///      is told there is no such room, as for an unopened home.
    function _openCollection(Room storage r, address c) private {
        r.kind = IS_COLLECTION;
        r.opened = uint48(block.number);
        r.index = uint256(uint160(c));
    }

    /// @dev The rooms a steward governs: a group it founded or its own home.
    function _stewarded(uint256 room, uint256 by) private returns (Room storage r) {
        _asPersona(by);
        r = _room[room];
        if (r.kind == IS_COMMONS && room == homeKey(by)) _openHome(r, by);
        if (r.kind != IS_GROUP && r.kind != IS_HOME) revert NoSuchRoom();
        if (r.steward != by) revert NotTheSteward();
    }

    /*═══════════════════ saying something ═══════════════════*/

    /// @notice Say something in the commons, a collection room, a group or a
    ///         home room.
    function speak(uint256 room, uint256 from, uint8 kind, uint64 reBlock, uint64 reSeq, bytes calldata body)
        external
    {
        Transient.enter(Transient.AGORA_LOCK);
        _asPersona(from);
        Room storage r = _room[room];
        (address c,) = Persona.split(from);
        bytes32 stamp = Persona.stampOf(from);

        if (room == COMMONS) {
            if (!isRegistered(c)) revert Unregistered(c);
        } else if (r.kind == IS_GROUP || r.kind == IS_HOME) {
            /*  The steward speaks in its own room by right, as Parley's home
                steward did. A group's founder also takes a seat, but a seat
                is the holder's and the stewardship is the token's: a buyer
                inherits the group with no live seat in it, and must not be
                locked out of the room it governs.                        */
            if (r.steward != from && _seat[room][from] != stamp) revert NotAMember();
        } else if (r.kind == IS_PAIR) {
            /*  A pair room is reachable only through the derivation, and the
                derivation is where its membership is proved. Letting a raw
                key in here would mean checking membership against something
                stored, which is the storage this design does without. */
            revert UseWhisper();
        } else if (r.kind == IS_COLLECTION) {
            if (room != collectionKey(c)) revert NotOfCollection(from, address(uint160(r.index)));
        } else if (room == collectionKey(c)) {
            _openCollection(r, c);
        } else if (room == homeKey(from)) {
            _openHome(r, from);
        } else {
            revert NoSuchRoom();
        }

        if ((reBlock == 0) != (reSeq == 0) || reSeq > r.count) revert BadReply();
        (uint64 prev, uint64 prevFrom, uint64 seq) = _say(r, room, from, stamp, kind, body);
        emit Said(room, from, prev, prevFrom, seq, kind, reBlock, reSeq, body);
        Transient.exit(Transient.AGORA_LOCK);
    }

    /// @notice Say something to exactly one other persona.
    /// @param expectedKeyId For a SEALED body, the key id the client sealed
    ///        to; the send fails if the recipient's key is not that one.
    /// @dev   A sealed envelope carries a copy for each side, so both sides
    ///        need a live key: a sender with none could seal only to the
    ///        recipient and never read its own words back. And the sender's
    ///        copy is sealed to the sender's live binding, which a sale kills,
    ///        so a page can never seal a buyer's words to the seller's key.
    function whisper(uint256 from, uint256 to, uint8 kind, bytes32 expectedKeyId, bytes calldata body)
        external
    {
        Transient.enter(Transient.AGORA_LOCK);
        _asPersona(from);
        if (from == to) revert TalkingToYourself();
        _mustBeHeld(to);
        if (kind == SEALED) {
            (, bytes32 mine,) = keyOf(from);
            (, bytes32 theirs,) = keyOf(to);
            if (mine == bytes32(0) || theirs == bytes32(0)) revert NoKey();
            if (theirs != expectedKeyId) revert KeyMoved();
        }
        uint256 room = pairKey(from, to);
        Room storage r = _room[room];
        if (r.kind != IS_PAIR) {
            r.kind = IS_PAIR;
            r.opened = uint48(block.number);
        }
        /*  A whisper answers nothing by pointer: the pair is the thread.   */
        (uint64 prev, uint64 prevFrom, uint64 seq) = _say(r, room, from, Persona.stampOf(from), kind, body);
        emit Said(room, from, prev, prevFrom, seq, kind, 0, 0, body);
        Transient.exit(Transient.AGORA_LOCK);
    }

    /// @dev The writes that make the archive walkable. The caller emits the
    ///      log, with the pointers this hands back.
    function _say(Room storage r, uint256 room, uint256 from, bytes32 stamp, uint8 kind, bytes calldata body)
        private returns (uint64 prev, uint64 prevFrom, uint64 seq)
    {
        if (kind > SEALED) revert BadKind();
        if (body.length == 0 || body.length > (kind == SEALED ? MAX_SEALED : MAX_BODY)) revert BadBody();

        /*  The brake, in the unit the room counts in. The bucket is the
            persona AND its stamp, so a buyer starts with an empty one and
            the seller's last word rate-limits nobody.                    */
        bytes32 bucket = _bucket(from, stamp);
        uint256 prevHere = _last[room][bucket];
        (uint256 clock, uint256 wait) = room == COMMONS || r.kind == IS_COLLECTION
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

    /*═══════════════════ reacting, and following ═══════════════════*/

    /// @notice Put a glyph on message `seq` of `room`, optionally with a tip
    ///         for the persona the reactor names as its `author`.
    /// @dev    Open to any persona in any room with the message in it: a
    ///         reaction says four bytes about one message and may carry money
    ///         to its author, and whom a holder may pay is not a room's to
    ///         decide. A page that shows a closed room's reactions can show
    ///         its members' only (`inRoom`). A reaction writes no storage: the
    ///         event is written, then the push is the last thing the call
    ///         does, under the lock, so a payee that calls back finds speech,
    ///         whispers and reactions shut and nothing of this call to corrupt.
    function react(uint256 room, uint256 from, uint64 seq, uint256 author, bytes4 glyph) external payable {
        Transient.enter(Transient.AGORA_LOCK);
        _asPersona(from);
        if (!_isGlyph(glyph)) revert BadGlyph();
        if (seq == 0 || seq > _room[room].count) revert BadReply();
        emit Reacted(room, from, author, seq, glyph, msg.value);
        if (msg.value != 0) {
            address payee = Persona.payeeOf(HUB, author);
            if (payee == address(0)) revert NoPayee(author);
            bool ok;
            /*  Value only, no calldata, and the answer is not copied: a payee
                that returns a megabyte of data costs this call nothing.    */
            assembly ("memory-safe") { ok := call(gas(), payee, callvalue(), 0, 0, 0, 0) }
            if (!ok) revert TipFailed();
        }
        Transient.exit(Transient.AGORA_LOCK);
    }

    /// @dev One to four bytes of well-formed UTF-8 (RFC 3629: no overlong
    ///      form, no surrogate, nothing above U+10FFFF), left-aligned, every
    ///      byte after the glyph zero. A zero byte ends the glyph, so U+0000
    ///      is no glyph, and neither is a gap: "A\0B" would render as "A" and
    ///      carry a "B" no page shows.
    function _isGlyph(bytes4 g) private pure returns (bool) {
        uint256 w = uint32(g);
        if (w == 0) return false;
        uint256 i;
        while (i < 4) {
            uint256 b = (w >> (24 - 8 * i)) & 0xff;
            if (b == 0) break;
            uint256 n;                       // continuation bytes this lead needs
            uint256 lo = 0x80;               // the range of the first continuation
            uint256 hi = 0xbf;
            if (b < 0x80) n = 0;
            else if (b < 0xc2) return false;            // a continuation, or an overlong lead
            else if (b < 0xe0) n = 1;
            else if (b < 0xf0) { n = 2; if (b == 0xe0) lo = 0xa0; if (b == 0xed) hi = 0x9f; }
            else if (b < 0xf5) { n = 3; if (b == 0xf0) lo = 0x90; if (b == 0xf4) hi = 0x8f; }
            else return false;
            if (i + n > 3) return false;                // the character does not fit
            for (uint256 k = 1; k <= n; ++k) {
                uint256 cb = (w >> (24 - 8 * (i + k))) & 0xff;
                if (cb < (k == 1 ? lo : 0x80) || cb > (k == 1 ? hi : 0xbf)) return false;
            }
            i += n + 1;
        }
        return i == 4 || (w << (8 * i)) & 0xffffffff == 0;
    }

    /// @notice Follow (or stop following) a persona as a persona. Keyed by
    ///         the two personas, so it outlives every sale on either side.
    /// @dev    Idempotent: following twice is following once, and undoing a
    ///         follow that is not there is nothing. A new follow needs a
    ///         persona somebody holds — a raw id passed where a persona was
    ///         meant names collection zero, and is refused rather than kept —
    ///         and undoing one never needs anything.
    function follow(uint256 from, uint256 to, bool on) external {
        _asPersona(from);
        if (from == to) revert TalkingToYourself();
        if (follows[from][to] == on) return;
        if (on) _mustBeHeld(to);
        follows[from][to] = on;
        unchecked {
            if (on) { ++followingCount[from]; ++followerCount[to]; }
            else    { --followingCount[from]; --followerCount[to]; }
        }
        emit Followed(from, to, on);
    }

    /*═══════════════════ groups and home rooms ═══════════════════*/

    function found(uint256 by, string calldata name, bool openDoor)
        external returns (uint256 key)
    {
        _asPersona(by);
        uint256 n = bytes(name).length;
        if (n == 0 || n > MAX_NAME) revert BadName();

        uint256 index;
        unchecked { index = ++groups; }
        key = groupKey(index);

        Room storage r = _room[key];
        r.kind = IS_GROUP;
        r.opened = uint48(block.number);
        r.steward = by;
        r.open = openDoor;
        r.index = index;
        nameOf[key] = name;

        emit Founded(key, by, index, openDoor, name);
        _take(key, r, by, Persona.stampOf(by));
    }

    /// @notice The steward names a persona that may join. It still has to,
    ///         and the invitation is to its holder: a sale voids it.
    function invite(uint256 room, uint256 by, uint256 persona_) external {
        _stewarded(room, by);
        _mustBeHeld(persona_);
        _invite[room][persona_] = Persona.stampOf(persona_);
        emit Invited(room, persona_, by);
    }

    /// @notice Take a seat in a group, or in a persona's home room.
    function join(uint256 room, uint256 persona_) external {
        _asPersona(persona_);
        Room storage r = _room[room];
        if (r.kind != IS_GROUP && r.kind != IS_HOME) revert NoSuchRoom();
        bytes32 stamp = Persona.stampOf(persona_);
        if (_seat[room][persona_] == stamp || r.steward == persona_) revert AlreadyIn();
        if (!r.open && _invite[room][persona_] != stamp) revert NotInvited();
        _take(room, r, persona_, stamp);
    }

    function leave(uint256 room, uint256 persona_) external {
        _asPersona(persona_);
        if (_seat[room][persona_] != Persona.stampOf(persona_)) revert NotAMember();
        _depart(room, persona_);
    }

    /// @notice The steward can show a persona the door — including a seat a
    ///         sale left behind, which nobody else can clear. It cannot delete
    ///         what that persona said; nothing here can.
    function evict(uint256 room, uint256 by, uint256 persona_) external {
        _stewarded(room, by);
        if (_seat[room][persona_] == bytes32(0)) revert NotAMember();
        delete _invite[room][persona_];
        _depart(room, persona_);
    }

    /// @notice How long a persona must wait between two words here. Up to a
    ///         week; the commons and collection rooms have no steward to ask.
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

    /// @dev `members` counts seats, one per persona. A seat a sale left
    ///      behind is still counted until the persona's new holder takes it —
    ///      which re-records the stamp and counts nothing twice — or the
    ///      steward clears it; no write happens at a sale, so no exact count
    ///      of live seats can exist without one.
    function _take(uint256 room, Room storage r, uint256 p, bytes32 stamp) private {
        if (_seat[room][p] == bytes32(0)) {
            unchecked { r.members += 1; }
        }
        _seat[room][p] = stamp;

        uint256[] storage list = _seen[p];
        uint256 n = list.length;
        for (uint256 i; i < n; ++i) if (list[i] == room) { emit Entered(room, p); return; }
        list.push(room);
        emit Entered(room, p);
    }

    function _depart(uint256 room, uint256 p) private {
        delete _seat[room][p];
        Room storage r = _room[room];
        unchecked { if (r.members != 0) r.members -= 1; }
        emit Departed(room, p);
    }

    /*═══════════════════ sealing keys ═══════════════════*/

    /// @notice Use the key you published in the KeyRegistry for this persona.
    ///         `holds` only — never the Reach, so no session key can point a
    ///         persona's inbox at a key of its own — and recorded under the
    ///         persona's stamp, so the binding dies with the sale.
    function bindKey(uint256 persona_) external {
        address holder = Persona.holderOf(persona_);
        if (holder != msg.sender) revert NotYours();
        bytes32 stamp = Persona.stampOf(persona_);
        _bound[persona_] = stamp;
        // written first so one reader serves both; a missing key unwinds it
        (uint16 keyType, bytes32 keyId,) = keyOf(persona_);
        if (keyId == bytes32(0)) revert NoKey();
        emit KeyBound(persona_, holder, stamp, keyType, keyId);
    }

    /// @notice The key a client seals to, read live from the registry: the
    ///         holder's current key, as long as the persona's stamp is the one
    ///         it was bound under. Zero otherwise — after a sale, after a
    ///         buy-back on any collection that reports a custody epoch, after
    ///         the registry entry is revoked. A collection that reports none
    ///         is stamped by its holder alone, so there a buy-back by the
    ///         binder finds its binding where it left it.
    function keyOf(uint256 persona_) public view returns (uint16 keyType, bytes32 keyId, bytes memory publicKey) {
        bytes32 b = _bound[persona_];
        if (b == bytes32(0) || b != Persona.stampOf(persona_)) return (0, bytes32(0), "");
        (uint16 kt, bytes memory pk,) = IKeyRegistry(KEYS).getPublicKeys(Persona.holderOf(persona_));
        if (pk.length == 0) return (0, bytes32(0), "");
        return (kt, keccak256(pk), pk);
    }

    /*═══════════════════ what a client asks before it walks ═══════════════════*/

    /// @notice A room's head, counters and shape. `opened == 0` is a room
    ///         that has never come into being — and since an unopened room
    ///         reads kind 0, which is also the commons' kind, `opened` is how
    ///         a page tells "nothing here yet" from "everybody is here".
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

    /// @notice Whether the persona's current holder holds its seat here.
    function inRoom(uint256 room, uint256 persona_) external view returns (bool) {
        return _seat[room][persona_] == Persona.stampOf(persona_);
    }

    /// @notice Whether the persona's current holder is invited here.
    function invited(uint256 room, uint256 persona_) external view returns (bool) {
        return _invite[room][persona_] == Persona.stampOf(persona_);
    }

    /// @notice When a persona last spoke in a room as its current holder: a
    ///         block for the commons and collection rooms, a timestamp
    ///         elsewhere, zero never.
    function lastSpoke(uint256 room, uint256 persona_) external view returns (uint64) {
        return uint64(_last[room][_bucket(persona_, Persona.stampOf(persona_))]);
    }

    /// @notice Every room this persona has ever taken a seat in, and whether
    ///         its current holder is in each.
    function roomsOf(uint256 persona_)
        external view returns (uint256[] memory keys, bool[] memory member)
    {
        uint256[] storage list = _seen[persona_];
        uint256 n = list.length;
        bytes32 stamp = Persona.stampOf(persona_);
        keys = new uint256[](n);
        member = new bool[](n);
        for (uint256 i; i < n; ++i) {
            keys[i] = list[i];
            member[i] = _seat[list[i]][persona_] == stamp;
        }
    }

    function roomCount(uint256 persona_) external view returns (uint256) {
        return _seen[persona_].length;
    }

    /*═══════════════════ the topics, so a browser needs no keccak ═══════════════════*/

    /// @notice The `topic0` of the events a page filters on, derived by the
    ///         compiler from the same signatures it logs under. The first five
    ///         are Parley's, in Parley's order, so a reader written for
    ///         Parley's five words reads these the same.
    /// @dev    The client that reads this chat has no keccak — deliberately,
    ///         because a hash function shipped in a page is a hash function
    ///         nobody checked. It cannot compute a topic filter, so it asks
    ///         the contract that emits the events what they are.
    function topics()
        external pure
        returns (
            bytes32 said, bytes32 founded, bytes32 invited_, bytes32 entered, bytes32 departed,
            bytes32 reacted, bytes32 followed
        )
    {
        said = Said.selector;
        founded = Founded.selector;
        invited_ = Invited.selector;
        entered = Entered.selector;
        departed = Departed.selector;
        reacted = Reacted.selector;
        followed = Followed.selector;
    }
}
