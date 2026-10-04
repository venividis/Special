// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IParley, IRoster} from "./interfaces/IParley.sol";

interface IRosterHub {
    function ownerOf(uint256 id) external view returns (address);
    function BAND_LO() external view returns (uint256);
    function minted() external view returns (uint256);
}

/*───────────────────────────────────────────────────────────────────────────
  Roster — who is actually in the room

  Origin: IPSEITY src/Roster.sol, verbatim in mechanism (INTACT U4). What
  moved: the hub's ids live in a band (`BAND_LO + minted` are the ones that
  exist, never `1..totalSupply`); Parley has a fourth kind, the home room,
  whose members are followers; `membersOf` hands back where the next
  window starts; `stewardedBy` returns keys alone (indices are derivable
  from them by nobody, so the caller is given what it asked for). The
  no-such-room number moved from 3 to 4 because 3 is now a room.

  Parley can tell you a room holds nine tokens. It cannot tell you which
  nine, and that is not an oversight: membership is a mapping, and a mapping
  is not a list. Enumerating it the usual way means replaying `Entered` and
  `Departed` from the beginning of the chain — a range scan, which this
  collection does without on purpose, because a range scan is the thing that
  needs an indexer and an indexer is a server.

  So the answer is asked the other way round. The collection is finite and
  its tokens are numbered, so a reader can simply ask about a window of them
  at once: two hundred and fifty-six memberships come back packed into a
  single word, from a single `eth_call`, over state that was already public.
  Nothing is stored here, nothing is written here, and nothing about the
  protocol had to change to make it true — which is the whole point. The
  archive that exists keeps existing; this only reads it.

  ── why this is a separate contract ──

  The messages are the collection's memory, and the contract that holds them
  is kept across every redeploy of this site, because replacing it would not
  migrate a conversation, it would end one. A question that can be answered
  by reading public state should therefore never be a reason to replace it.
  This contract can be thrown away and rewritten every week; the archive
  underneath it does not notice.
───────────────────────────────────────────────────────────────────────────*/
contract Roster is IRoster {
    address public immutable PARLEY;
    address public immutable HUB;

    /// @dev One word of answers per call window. Chosen because a `uint256`
    ///      is the largest thing a client with no ABI decoder can read back
    ///      without counting: it is the return value, whole.
    uint256 public constant WINDOW = 256;

    /*  Parley's four kinds, and a fifth this contract needs. A room that
        was never opened reads back with kind zero, and kind zero is also
        the commons — so a reader asking about a key nobody founded would be
        told it is looking at the room that holds everybody. That is the
        exact confusion this contract exists to remove, so the no-such-room
        case is given a number of its own here.                          */
    uint256 public constant COMMONS    = 0;
    uint8   public constant IS_COMMONS = 0;
    uint8   public constant IS_GROUP   = 1;
    uint8   public constant IS_PAIR    = 2;
    uint8   public constant IS_HOME    = 3;
    uint8   public constant NO_ROOM    = 4;

    constructor(address parley, address hub) {
        PARLEY = parley;
        HUB = hub;
    }

    /*═══════════════════ who is in a room ═══════════════════*/

    /// @notice Which of the five this key names. A caller that does not ask
    ///         cannot tell an empty group from the commons, and those two
    ///         answers are opposites.
    function kindOf(uint256 room) public view returns (uint8) {
        if (room == COMMONS) return IS_COMMONS;
        (, , , , uint8 k, , , , , ,) = IParley(PARLEY).stateOf(room);
        return k == IS_COMMONS ? NO_ROOM : k;
    }

    /*  Membership is not one question, because Parley does not store it one
        way. A group or a home room keeps a mapping and the mapping is the
        authority. The commons keeps nothing, because everyone is in it —
        `speak` waves every token through by key alone, so a roster that
        consulted the mapping would report a room of thousands as empty. A
        pair keeps nothing either, and for a better reason: its key is the
        hash of its two members, so holding the key *is* the proof, and
        there is no third token to ask about.                            */
    function _in(uint256 room, uint8 k, uint256 id) private view returns (bool) {
        if (k == IS_COMMONS) return true;
        if (k == IS_GROUP || k == IS_HOME) return IParley(PARLEY).inRoom(room, id);
        return false;
    }

    /// @dev The ids that exist on this band: `BAND_LO` up to but not
    ///      including `BAND_LO + minted`. There is no burn, so the range
    ///      has no holes.
    function _bounds() private view returns (uint256 lo, uint256 hi) {
        lo = IRosterHub(HUB).BAND_LO();
        hi = lo + IRosterHub(HUB).minted();
    }

    /// @notice Membership for tokens `from` … `from + 255`, one bit each,
    ///         bit 0 being `from`. A set bit is a token in the room.
    /// @dev    The client shifts; the chain counts. Reading 256 tokens costs
    ///         one call and roughly 256 cold storage reads — about 550k gas
    ///         of `eth_call`, which is free to the reader and never mined.
    function inWindow(uint256 room, uint256 from)
        external view returns (uint256 bits)
    {
        (uint256 lo, uint256 hi) = _bounds();
        uint8 k = kindOf(room);
        for (uint256 i; i < WINDOW; ++i) {
            uint256 id = from + i;
            if (id < lo || id >= hi) continue;
            if (_in(room, k, id)) bits |= (1 << i);
        }
    }

    /// @notice The same window, for tokens that were invited and have not
    ///         walked in yet. A steward who cannot see this cannot tell an
    ///         ignored invitation from one never sent.
    function invitedInWindow(uint256 room, uint256 from)
        external view returns (uint256 bits)
    {
        (uint256 lo, uint256 hi) = _bounds();
        uint8 k = kindOf(room);
        for (uint256 i; i < WINDOW; ++i) {
            uint256 id = from + i;
            if (id < lo || id >= hi) continue;
            if (!_in(room, k, id) && IParley(PARLEY).invited(room, id)) bits |= (1 << i);
        }
    }

    /// @notice Membership as a list rather than as bits, for a caller that
    ///         would rather not shift. Bounded by the same window; `next` is
    ///         where the following window starts, or zero when this one
    ///         reached the end of the band. For a home room this is the
    ///         follower list.
    function membersOf(uint256 room, uint256 from)
        external view returns (uint256[] memory ids, uint256 next)
    {
        (uint256 lo, uint256 hi) = _bounds();
        uint8 k = kindOf(room);
        uint256[] memory buf = new uint256[](WINDOW);
        uint256 n;
        for (uint256 i; i < WINDOW; ++i) {
            uint256 id = from + i;
            if (id < lo || id >= hi) continue;
            if (_in(room, k, id)) { buf[n] = id; unchecked { ++n; } }
        }
        ids = new uint256[](n);
        for (uint256 i; i < n; ++i) ids[i] = buf[i];
        next = from + WINDOW < hi ? from + WINDOW : 0;
    }

    /*═══════════════════ a token's own rooms ═══════════════════*/

    /// @notice Every group this token is the steward of — the rooms that
    ///         are *its* rooms, and that change hands when it does. Its home
    ///         room is not listed: that one is `homeKey(token)`, derivable
    ///         by anyone.
    /// @dev    Group keys are `keccak(1, index)` and the indices run from
    ///         one, so the whole set is derivable: no event replay, no
    ///         registry, nothing to keep in sync. Paged, because a
    ///         collection that founds ten thousand rooms should not punish
    ///         the reader who wants the first ten.
    function stewardedBy(uint256 token, uint256 fromIndex, uint256 count)
        external view returns (uint256[] memory rooms)
    {
        uint256 total = IParley(PARLEY).groups();
        if (fromIndex == 0) fromIndex = 1;
        uint256 end = fromIndex + count;
        if (end > total + 1) end = total + 1;

        uint256[] memory kb = new uint256[](count);
        uint256 n;
        for (uint256 i = fromIndex; i < end; ++i) {
            uint256 key = IParley(PARLEY).groupKey(i);
            (, , , , , , uint256 steward, , , ,) = IParley(PARLEY).stateOf(key);
            if (steward == token) {
                kb[n] = key;
                unchecked { ++n; }
            }
        }
        rooms = new uint256[](n);
        for (uint256 i; i < n; ++i) rooms[i] = kb[i];
    }

    /// @notice Whether a token still exists, for a page that lists members
    ///         and would rather not print a number nobody holds.
    function heldBy(uint256 token) external view returns (address) {
        try IRosterHub(HUB).ownerOf(token) returns (address o) { return o; } catch { return address(0); }
    }
}
