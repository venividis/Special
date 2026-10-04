// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPostage, Inbox, Stamp} from "./interfaces/IPostage.sol";
import {ExactERC20} from "./lib/ExactERC20.sol";
import {Transient} from "./lib/Transient.sol";

interface IPostageHub {
    function ownerOf(uint256 id) external view returns (address);
    function account(uint256 id) external view returns (address);
    function custodyEpoch(uint256 id) external view returns (uint64);
    function feeSink(uint256 id) external view returns (address);
}

/*═══════════════════════════════════════════════════════════════════════════

  POSTAGE — a market for a token's attention

  Origin: ANIMA contracts/comms/AgentComms.sol, adapted (INTACT U4). What
  ANIMA argued still holds and is kept in its words:

      "Priced attention with a refund. An agent sets its own postage. A
       sender escrows it, and the agent collects it *only by replying* —
       if the reply window lapses, the sender takes the money back. Spam
       becomes expensive and ignoring paid mail becomes unprofitable,
       without anyone running a moderation service."

      "Those last two [expectedFeeToken, maxPostage] are not ceremony.
       Postage is read from live inbox configuration the recipient
       controls, so without a caller-supplied bound a recipient could
       watch a pending send, raise its postage to the sender's entire
       allowance, reply immediately, and collect it."

  What changed, and why:

  · The message itself is not here. ANIMA put a payload hash and a
    transport URI on chain; INTACT's archive is Parley's logs, so this
    contract holds only the money. `stamp` and `settle` are callable by
    PARLEY alone: a stamp is created by `Parley.whisperStamped` and
    settled by the recipient's `Parley.whisper` back — the reply IS the
    message, there is no second verb to forget.

  · Settlement is PULLED. ANIMA pushed the postage into the agent's
    account from inside `reply`. Here `settle` only credits a ledger,
    `owed[feeSink(to)][feeToken]`, and the money moves when somebody calls
    `claimSettled`. The reason is the call graph: a reply arrives through
    Parley, Parley calls `settle`, and a push to a fee token with a
    transfer hook would hand control to a stranger in the middle of a
    whisper. A credit hands control to nobody.

  · Native postage exists (`feeToken == address(0)`), carried as
    `msg.value` through Parley.

  · The payer of record is the token's own account, `HUB.account(from)`.
    Postage never learns which wallet stood behind Parley's call — only
    that Parley vouched for `from` — and the token's account is the one
    address every actor of the token can reach. So ERC-20 postage is pulled
    from the Reach (an agent session acting through it spends under its
    own caps, never the holder's wallet allowance), and every refund lands
    in the Reach, whoever paid. A holder who paid native postage from a
    browser wallet gets it back inside an account that is theirs.

  · The inbox configuration is stamped with the custody epoch and read
    through `inboxOf`, which returns the default (open, free) the moment
    the token changes hands. A buyer inherits no price list.

  · The address and agent-id allowlists are gone. A closed inbox means:
    only a token the holder has already written to may write back. That
    rule lives in Parley, where the archive is; this contract's `open`
    bit only says whether stamped mail is accepted at all.

  · Exactly one of {settled, refunded} ever becomes true for a stamp, and
    one stamp per pair is pending at a time, so `settle(pairRoom)` names
    one obligation and no other.

═══════════════════════════════════════════════════════════════════════════*/
contract Postage is IPostage {
    using ExactERC20 for address;

    uint64 public constant MIN_REPLY_WINDOW = 5 minutes;
    uint64 public constant MAX_REPLY_WINDOW = 30 days;

    address public immutable PARLEY;
    address public immutable HUB;

    mapping(uint256 token => Inbox) private _inbox;
    mapping(uint256 stampId => Stamp) private _stamps;
    /// @notice The unanswered stamp in a pair room, or zero.
    mapping(uint256 pairRoom => uint256) public pendingOf;
    /// @notice The pull ledger: what a payee may claim, per fee token.
    mapping(address payee => mapping(address feeToken => uint256)) public owed;
    uint256 private _nextStamp = 1;

    constructor(address hub, address parley) {
        HUB = hub;
        PARLEY = parley;
    }

    /*═══════════════════ the inbox ═══════════════════*/

    /// @notice Price your attention. `holds` only, stamped with the custody
    ///         epoch so a sale returns the inbox to open and free.
    function configureInbox(uint256 token, address feeToken, uint128 postage, uint64 replyWindow, bool open)
        external
    {
        if (IPostageHub(HUB).ownerOf(token) != msg.sender) revert NotHolder();
        if (replyWindow < MIN_REPLY_WINDOW || replyWindow > MAX_REPLY_WINDOW) revert BadReplyWindow(replyWindow);
        uint64 epoch = IPostageHub(HUB).custodyEpoch(token);
        _inbox[token] = Inbox({feeToken: feeToken, postage: postage, replyWindow: replyWindow, open: open, epoch: epoch});
        emit InboxConfigured(token, epoch, feeToken, postage, replyWindow, open);
    }

    /// @notice The live configuration: what the holder set, if the holder
    ///         who set it still holds the token; otherwise open and free.
    function inboxOf(uint256 token) public view returns (Inbox memory box) {
        box = _inbox[token];
        if (box.epoch == 0 || box.epoch != IPostageHub(HUB).custodyEpoch(token)) {
            return Inbox({feeToken: address(0), postage: 0, replyWindow: 0, open: true, epoch: 0});
        }
    }

    /*═══════════════════ a stamp ═══════════════════*/

    /// @notice Escrow the recipient's postage for one message. PARLEY only.
    /// @return stampId Zero when the inbox is free: nothing was escrowed and
    ///         there is nothing to settle or refund.
    function stamp(uint256 pairRoom, uint256 from, uint256 to, address expectedFeeToken, uint128 maxPostage)
        external payable returns (uint256 stampId)
    {
        if (msg.sender != PARLEY) revert NotParley();
        Transient.enter(Transient.POSTAGE_LOCK);

        Inbox memory box = inboxOf(to);
        if (!box.open) revert InboxClosed(to);
        if (box.postage > maxPostage) revert PostageAboveMax(box.postage, maxPostage);
        if (box.postage == 0) {
            if (msg.value != 0) revert WrongValue();
            Transient.exit(Transient.POSTAGE_LOCK);
            return 0;
        }
        if (box.feeToken != expectedFeeToken) revert UnexpectedFeeToken(expectedFeeToken, box.feeToken);
        uint256 pending = pendingOf[pairRoom];
        if (pending != 0) revert StampPending(pending);

        address payer = IPostageHub(HUB).account(from);
        if (box.feeToken == address(0)) {
            if (msg.value != box.postage) revert WrongValue();
        } else {
            if (msg.value != 0) revert WrongValue();
            box.feeToken.transferFromExact(payer, address(this), box.postage);
        }

        stampId = _nextStamp++;
        uint64 replyBy = uint64(block.timestamp) + box.replyWindow;
        _stamps[stampId] = Stamp({
            pairRoom: pairRoom,
            from: from,
            to: to,
            sender: payer,
            feeToken: box.feeToken,
            postage: box.postage,
            sentAt: uint64(block.timestamp),
            replyBy: replyBy,
            settled: false,
            refunded: false
        });
        pendingOf[pairRoom] = stampId;
        emit Stamped(stampId, pairRoom, from, to, box.feeToken, box.postage, replyBy);

        Transient.exit(Transient.POSTAGE_LOCK);
    }

    /// @notice The recipient answered inside the window: credit the postage
    ///         to the token's fee sink. PARLEY only; a credit, never a push.
    function settle(uint256 pairRoom) external {
        if (msg.sender != PARLEY) revert NotParley();
        uint256 stampId = pendingOf[pairRoom];
        if (stampId == 0) revert NoSuchStamp(0);
        Stamp storage s = _stamps[stampId];
        if (block.timestamp > s.replyBy) revert ReplyWindowClosed(s.replyBy);

        s.settled = true;
        delete pendingOf[pairRoom];
        address payee = IPostageHub(HUB).feeSink(s.to);
        owed[payee][s.feeToken] += s.postage;
        emit Settled(stampId, payee, s.feeToken, s.postage);
    }

    /// @notice The window lapsed with no answer: the postage is the sender's
    ///         again. Permissionless, so a sender is never left chasing an
    ///         unresponsive token for their own money.
    function expire(uint256 stampId) external {
        Stamp storage s = _stamps[stampId];
        if (s.sender == address(0)) revert NoSuchStamp(stampId);
        if (s.settled) revert AlreadySettled(stampId);
        if (s.refunded) revert AlreadyRefunded(stampId);
        if (block.timestamp <= s.replyBy) revert ReplyWindowOpen(s.replyBy);

        s.refunded = true;
        delete pendingOf[s.pairRoom];
        owed[s.sender][s.feeToken] += s.postage;
        emit Expired(stampId);
    }

    /*═══════════════════ pulling the money ═══════════════════*/

    /// @notice Pay an expired stamp's sender everything it is owed in that
    ///         fee token. Anyone may call: the money has one destination.
    function claimRefund(uint256 stampId) external {
        Stamp storage s = _stamps[stampId];
        if (s.sender == address(0)) revert NoSuchStamp(stampId);
        if (s.settled) revert AlreadySettled(stampId);
        if (!s.refunded) revert StampPending(stampId);
        uint256 amount = _pay(s.sender, s.feeToken);
        emit Refunded(stampId, s.sender, s.feeToken, uint128(amount));
    }

    /// @notice Pay a token's fee sink what its correspondence earned.
    function claimSettled(uint256 token, address feeToken) external {
        _pay(IPostageHub(HUB).feeSink(token), feeToken);
    }

    /// @notice Pay the caller its own ledger balance.
    function claim(address feeToken) external {
        _pay(msg.sender, feeToken);
    }

    function _pay(address payee, address feeToken) private returns (uint256 amount) {
        Transient.enter(Transient.POSTAGE_LOCK);
        amount = owed[payee][feeToken];
        if (amount == 0) revert NothingOwed();
        owed[payee][feeToken] = 0;
        if (feeToken == address(0)) {
            (bool ok,) = payee.call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            feeToken.transferExact(payee, amount);
        }
        emit Claimed(payee, feeToken, amount);
        Transient.exit(Transient.POSTAGE_LOCK);
    }

    /*═══════════════════ reading ═══════════════════*/

    function stampOf(uint256 stampId) external view returns (Stamp memory) {
        return _stamps[stampId];
    }
}
