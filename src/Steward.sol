// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISteward, Will} from "./interfaces/ISteward.sol";
import {IIntact, Core} from "./interfaces/IIntact.sol";
import {Transient} from "./lib/Transient.sol";
import {AccountBinding} from "./lib/AccountBinding.sol";

/*───────────────────────────────────────────────────────────────────────────
  Steward — what happens to the token when nothing happens to it, and what
  happens when the key is gone but the holder is not

  Origin: IPSEITY src/Succession.sol, ADAPTED (BUILD-PLAN.md U5; DESIGN.md
  §3 row 26, §9.4): the two clocks, the public knock, the owner-only sign of
  life and the status codes are the donor's. NEW for INTACT: the heir is a
  hash (so a will names nobody in public until the day it is read), two to
  five guardians can open the door without the silence (recovery for a lost
  key, never for a zero-guardian setup), a duress heartbeat that quietly
  stretches the notice to a year, a plan stamped with the custody epoch
  rather than an owner address, and one power — `hub.stewardTransfer` —
  in place of the standing ERC-721 approval the donor needed.

  Everything a token accumulates is attached to the token and not to the
  wallet. That is the good property, and it has a bad corollary: lose the
  key and all of it is gone in the strong sense. A multisig is the usual
  answer and it is the wrong shape — it makes somebody else a co-owner today
  in exchange for cover on a day that may never come. This is the other
  shape. Name where the token should go and how long a silence should mean
  you are gone; use the token and nothing happens; stop for that long and
  the person you named may knock; the knock is public and starts a second
  clock; touch the token during that clock and the knock is cancelled.

  ── two lessons kept from the donor, in past tense ──

  `embody` was not life. Succession once read the hub's operation stamp so
  that ordinary use kept the switch alive with nothing to remember. The
  stamp was reachable by strangers (`embody` is nobody's privilege) and by
  operators and renters, so a passer-by could hold an heir off forever for
  the price of gas, and a phished approval could hold the switch open for
  as long as it went unnoticed. The only signal counted here is the holder's
  own, through `arrange`, `stillHere` and `stillHereUnderDuress`, behind the
  strict door (`ownerOf`, never the Reach, never an operator). Measured in
  tools/verify-steward.mjs: a stranger's hub calls leave SUMMONABLE where
  it stands.

  A second knock could move the deadline. Letting any later `summon`
  overwrite the first gave every stranger a free veto — re-summon just
  before the door opened, forever — so the first knock stands until the
  holder cancels it (`AlreadyCalled`), and the holder already has the
  deliberate reset in `stillHere`.

  ── what this contract can and cannot do ──

  Its single power is `hub.stewardTransfer(id, dest)` for a plan whose
  notice has run out. That call walks the hub's ordinary sealed `_update`:
  another module's lock, a guardian hold or the holder's own transfer seal
  stops it exactly as they stop any transfer, so an heir waits out a seal
  and nothing here bypasses a ratchet. The hub refuses any canonical
  account of the collection as a destination; `wouldPass` says BAD_HANDS
  first so the page can.

  It cannot survive a sale. The plan carries the custody epoch at which it
  was arranged and reads the live one on every path: a transfer, a
  `panic`, a steward move — anything that bumps the epoch — voids it. The
  buyer never agreed to it. A void plan whose notice was running still
  holds this module's lock, so `cancel` of a VOID plan is open to anyone:
  nothing can execute it, and the lock only hurts whoever holds the token
  now.

  It cannot know that you died. It knows the token was not used.

  ── the frozen signature and the instrument heir ──

  Heirs may be "whoever holds token N" so estates chain through
  instruments and survive the heir changing wallets. `summon(id, heir,
  salt)` carries one address, so an instrument heir is summoned with
  `heir = address(uint160(N))` and both preimage shapes are tried in
  order; the id is kept aside and resolved live at `execute`, not frozen at
  the knock. `heirHashOf`/`heirHashOfToken` are the two shapes, spelled out.
───────────────────────────────────────────────────────────────────────────*/
contract Steward is ISteward {
    address public immutable HUB;

    /*  A month is the shortest silence that is not an accident, and ten
        years is the same ceiling the vault uses. Two weeks is the shortest
        notice in which a holder who is merely travelling can be expected to
        notice a public knock; a year is the duress setting.             */
    uint64 public constant MIN_QUIET  = 30 days;
    uint64 public constant MAX_QUIET  = 3650 days;
    uint64 public constant MIN_NOTICE = 14 days;
    uint64 public constant MAX_NOTICE = 365 days;
    uint8  public constant MAX_GUARDIANS = 5;

    /*  Status codes rather than a bool, because "this will not work" is
        useless to somebody who arranged their estate and would like to
        know which part of it to fix.                                    */
    uint8 public constant NO_PLAN    = 0;
    uint8 public constant SOLD       = 1;
    uint8 public constant SPEAKING   = 2;
    uint8 public constant SUMMONABLE = 3;
    uint8 public constant WAITING    = 4;
    uint8 public constant LOCKED     = 5;
    uint8 public constant BAD_HANDS  = 6;
    uint8 public constant OK         = 7;

    mapping(uint256 => Will) private _will;
    /// @dev The instrument an heir hash names, when it names one; resolved
    ///      live at `execute`. Cleared whenever a notice ends.
    mapping(uint256 => uint256) private _heirToken;
    /// @dev id → nonce → guardian: one count per guardian per nonce.
    mapping(uint256 => mapping(uint32 => mapping(address => bool))) private _attested;
    /// @dev id → nonce → dest → count; the threshold is per destination, so
    ///      guardians who disagree about where the token goes open nothing.
    mapping(uint256 => mapping(uint32 => mapping(address => uint8))) private _votes;
    /// @dev id → nonce → how many guardians have spoken at all (the obit).
    mapping(uint256 => mapping(uint32 => uint8)) private _spoken;

    constructor(address hub) {
        if (hub == address(0)) revert BadDestination();
        HUB = hub;
    }

    /*  The strict door, and it has to be the strict one (DESIGN.md §2:
        arranging the steward is `holds`). An arrangement an operator, a
        renter or even the token's own Reach could rewrite is one a phished
        approval or a leaked session key redirects — the thief would not
        steal the token, they would become the heir and wait.            */
    function _onlyHolder(uint256 id) private view {
        if (msg.sender != IIntact(HUB).ownerOf(id)) revert NotHolder();
    }

    /*═══════════════════ arranging ═══════════════════*/

    /// @notice Name, by hash, where this token goes if it goes quiet; how
    ///         long a quiet counts; and, optionally, who may open the door
    ///         early together. Re-arranging resets the silence, ends any
    ///         running notice and invalidates every attestation.
    function arrange(
        uint256 id, bytes32 heirHash, uint64 quiet, uint64 notice,
        address[] calldata guardians, uint8 threshold
    ) external {
        _onlyHolder(id);
        if (heirHash == bytes32(0)) revert BadDestination();
        if (quiet  < MIN_QUIET)  revert TooShort();
        if (quiet  > MAX_QUIET)  revert TooLong();
        if (notice < MIN_NOTICE) revert TooShort();
        if (notice > MAX_NOTICE) revert TooLong();
        uint256 n = guardians.length;
        if (n == 1 || n > MAX_GUARDIANS) revert BadGuardians();
        for (uint256 i; i < n; ++i) {
            if (guardians[i] == address(0)) revert BadGuardians();
            for (uint256 j; j < i; ++j) if (guardians[j] == guardians[i]) revert BadGuardians();
        }
        if (n == 0 ? threshold != 0 : (threshold < 2 || threshold > n)) revert BadThreshold();

        Will storage w = _will[id];
        uint64 epoch = IIntact(HUB).custodyEpoch(id);
        /*  The notice is a ratchet while the plan is live (DESIGN.md §9.3):
            a holder re-arranging under duress cannot be made to shorten the
            year the duress heartbeat bought, and the flag itself survives.
            A plan voided by a sale starts fresh with the buyer.          */
        bool live = w.heirHash != bytes32(0) && w.epoch == epoch;
        if (live && notice < w.notice) revert TooShort();
        if (w.due != 0) _endNotice(id, w);

        w.heirHash  = heirHash;
        w.quiet     = quiet;
        w.notice    = notice;
        w.lastLife  = uint64(block.timestamp);
        w.dest      = address(0);
        w.epoch     = epoch;
        w.guardians = guardians;
        w.threshold = threshold;
        w.nonce    += 1;
        if (!live) w.duress = false;
        emit Arranged(id, epoch, heirHash, quiet, notice, threshold);
    }

    /// @notice Say you are here. The only sign of life this contract reads:
    ///         resets the silence, cancels any running notice, invalidates
    ///         every attestation.
    function stillHere(uint256 id) external {
        _onlyHolder(id);
        _life(id);
    }

    /// @notice The same words, under duress: the silence resets, and the
    ///         notice quietly becomes a year, so whoever is holding the key
    ///         to your head buys themselves nothing but a long wait. The
    ///         event is the ordinary one; only the heir's page reads the
    ///         flag.
    function stillHereUnderDuress(uint256 id) external {
        _onlyHolder(id);
        Will storage w = _life(id);
        w.notice = MAX_NOTICE;
        w.duress = true;
    }

    /// @notice End a running notice. The holder's door while the plan is
    ///         live; anyone's once the plan is void, because a void plan's
    ///         lock protects nobody and the token has a new holder to serve.
    function cancel(uint256 id) external {
        Will storage w = _will[id];
        if (w.heirHash == bytes32(0)) revert NoPlan();
        if (w.due == 0) revert NotCalled();
        if (w.epoch == IIntact(HUB).custodyEpoch(id) && msg.sender != IIntact(HUB).ownerOf(id)) revert NotHolder();
        _endNotice(id, w);
        w.lastLife = uint64(block.timestamp);
        w.nonce += 1;
        emit Cancelled(id, msg.sender);
    }

    /*═══════════════════ the two doors ═══════════════════*/

    /// @notice Knock, with the heir's preimage. Anybody may — the heir is
    ///         written down and does not change because of who rang the
    ///         bell. The first knock stands until the holder cancels it.
    function summon(uint256 id, address heir, bytes32 salt) external {
        Will storage w = _live(id);
        if (w.due != 0) revert AlreadyCalled();
        uint64 when = w.lastLife + w.quiet;
        if (block.timestamp < when) revert StillSpeaking(when);

        address dest;
        uint256 tokenN;
        if (keccak256(abi.encode(heir, salt)) == w.heirHash) {
            dest = heir;
        } else if (keccak256(abi.encode(address(0), uint256(uint160(heir)), salt)) == w.heirHash) {
            tokenN = uint256(uint160(heir));
            dest = _holderOf(tokenN);
        } else {
            revert WrongHeir();
        }
        _checkHands(id, dest);
        _heirToken[id] = tokenN;
        _startNotice(id, w, dest);
        emit Summoned(id, msg.sender, dest, w.due);
    }

    /// @notice A named guardian's word that the token should go to `dest`.
    ///         One count per guardian per nonce; when `threshold` of them
    ///         agree on the same destination the notice starts, exactly as
    ///         a knock would have — the holder can still cancel it.
    function attest(uint256 id, address dest, uint32 nonce) external {
        Will storage w = _live(id);
        if (!_isGuardian(w, msg.sender)) revert NotGuardian();
        if (nonce != w.nonce) revert StaleNonce();
        if (w.due != 0) revert AlreadyCalled();
        _checkHands(id, dest);
        if (_attested[id][nonce][msg.sender]) revert AlreadyAttested();
        _attested[id][nonce][msg.sender] = true;
        _spoken[id][nonce] += 1;
        uint8 votes = ++_votes[id][nonce][dest];
        emit Attested(id, msg.sender, dest, nonce);
        if (votes >= w.threshold) {
            _heirToken[id] = 0;
            _startNotice(id, w, dest);
        }
    }

    /// @notice Hand the token over. Anybody may press the button; only the
    ///         resolved destination can receive it, and only through the
    ///         hub's own sealed transfer.
    function execute(uint256 id) external {
        Transient.enter(Transient.STEWARD_LOCK);
        Will storage w = _live(id);
        if (w.due == 0) revert NotCalled();
        if (block.timestamp < w.due) revert NotYet(w.due);
        address dest = _destOf(id);
        _checkHands(id, dest);
        address from = IIntact(HUB).ownerOf(id);

        /*  Effects before the interaction: the plan is spent whatever the
            hub says next, so a revert on a seal or a foreign lock leaves
            the whole call reverted and the plan standing — the heir waits
            it out and presses again.                                    */
        _endNotice(id, w);
        uint32 nonce = w.nonce;
        delete _will[id];
        _will[id].nonce = nonce + 1;

        IIntact(HUB).stewardTransfer(id, dest);
        emit Passed(id, from, dest);
        Transient.exit(Transient.STEWARD_LOCK);
    }

    /*═══════════════════ reading it ═══════════════════*/

    /// @notice What would happen if `execute` were called right now, and if
    ///         the answer is "nothing", exactly why not.
    function wouldPass(uint256 id) public view returns (uint8) {
        Will storage w = _will[id];
        if (w.heirHash == bytes32(0)) return NO_PLAN;
        if (w.epoch != IIntact(HUB).custodyEpoch(id)) return SOLD;
        if (w.due == 0) return block.timestamp < w.lastLife + w.quiet ? SPEAKING : SUMMONABLE;
        if (block.timestamp < w.due) return WAITING;

        /*  Our own notice holds one module lock; anything beyond it — another
            module's lock, a guardian hold, the holder's transfer seal — is
            what would stop `stewardTransfer` at the hub's door.          */
        Core memory c = IIntact(HUB).coreOf(id);
        if (c.lockCount > 1 || c.guardianHold || c.transferSealUntil > block.timestamp) return LOCKED;

        if (_badHands(id, _destOf(id))) return BAD_HANDS;
        return OK;
    }

    function getWill(uint256 id) external view returns (Will memory) { return _will[id]; }

    /// @notice The ERC-7878-legible summary: the status in one byte, when
    ///         the door opens, where the token would go (an instrument heir
    ///         resolved as of now), the nonce guardians must quote, and how
    ///         many of them have spoken at it.
    function getObit(uint256 id)
        external view
        returns (uint8 status, uint64 due, address dest, uint32 nonce, uint8 attestations)
    {
        Will storage w = _will[id];
        return (wouldPass(id), w.due, _destOf(id), w.nonce, _spoken[id][w.nonce]);
    }

    /// @notice What `getStateFingerprint` reads: zero when no live plan
    ///         exists, so a void plan and no plan hash alike.
    function planHash(uint256 id) external view returns (bytes32) {
        Will storage w = _will[id];
        if (w.heirHash == bytes32(0) || w.epoch != IIntact(HUB).custodyEpoch(id)) return bytes32(0);
        return keccak256(abi.encode(
            w.heirHash, w.quiet, w.notice, w.lastLife, w.due, w.dest, w.epoch,
            w.guardians, w.threshold, w.nonce, w.duress, _heirToken[id]));
    }

    function heirHashOf(address heir, bytes32 salt) external pure returns (bytes32) {
        return keccak256(abi.encode(heir, salt));
    }

    function heirHashOfToken(uint256 tokenN, bytes32 salt) external pure returns (bytes32) {
        return keccak256(abi.encode(address(0), tokenN, salt));
    }

    /*═══════════════════ internals ═══════════════════*/

    /// @dev A plan that exists and was arranged under the current custody.
    function _live(uint256 id) private view returns (Will storage w) {
        w = _will[id];
        if (w.heirHash == bytes32(0)) revert NoPlan();
        if (w.epoch != IIntact(HUB).custodyEpoch(id)) revert Void();
    }

    function _life(uint256 id) private returns (Will storage w) {
        w = _live(id);
        if (w.due != 0) _endNotice(id, w);
        w.lastLife = uint64(block.timestamp);
        w.nonce += 1;
        emit StillHere(id, w.lastLife);
    }

    /// @dev `due != 0` if and only if this contract holds one module lock on
    ///      the token. Every path that sets one takes the lock; every path
    ///      that clears one releases it.
    function _startNotice(uint256 id, Will storage w, address dest) private {
        w.dest = dest;
        w.due = uint64(block.timestamp) + w.notice;
        IIntact(HUB).moduleLock(id);
        emit NoticeStarted(id, dest, w.due);
    }

    function _endNotice(uint256 id, Will storage w) private {
        w.due = 0;
        w.dest = address(0);
        _heirToken[id] = 0;
        IIntact(HUB).moduleUnlock(id);
    }

    function _isGuardian(Will storage w, address who) private view returns (bool) {
        uint256 n = w.guardians.length;
        for (uint256 i; i < n; ++i) if (w.guardians[i] == who) return true;
        return false;
    }

    /// @dev Where the token would go as of now: the address written at the
    ///      knock, or the live holder of the instrument the heir hash named.
    function _destOf(uint256 id) private view returns (address) {
        uint256 tokenN = _heirToken[id];
        return tokenN == 0 ? _will[id].dest : _holderOf(tokenN);
    }

    function _holderOf(uint256 tokenN) private view returns (address) {
        try IIntact(HUB).ownerOf(tokenN) returns (address o) { return o; } catch { return address(0); }
    }

    function _checkHands(uint256 id, address dest) private view {
        if (dest == address(0)) revert BadDestination();
        if (_badHands(id, dest)) revert BadHands();
    }

    /// @dev The hub refuses the holder's own hands and every canonical
    ///      account of the collection (DESIGN.md §2, the cycle guard); this
    ///      is the same question asked early, so the page can say so before
    ///      a notice is started that could never pass.
    function _badHands(uint256 id, address dest) private view returns (bool) {
        if (dest == HUB || dest == IIntact(HUB).ownerOf(id)) return true;
        (uint256 chain, address collection, uint256 k) = AccountBinding.token(dest);
        if (chain != block.chainid || collection != HUB) return false;
        return IIntact(HUB).isCanonicalAccount(dest, k, false) || IIntact(HUB).isCanonicalAccount(dest, k, true);
    }
}
