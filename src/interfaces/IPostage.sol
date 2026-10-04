// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*───────────────────────────────────────────────────────────────────────────
  IPostage — priced first contact

  DESIGN.md §7.4; from ANIMA AgentComms.sol. Frozen after wave 0. Native
  or ERC-20 escrow bounded by `maxPostage` / `expectedFeeToken`; reply-or-
  refund; settlement PULLED to `feeSink(to)`, never pushed inside a
  whisper. `stamp` / `settle` are PARLEY-only. Exactly one of {settled,
  refunded} ever becomes true. The `owed` ledger is keyed by payee AND fee
  token (U0 choice: an inbox may be repriced into another token, and a
  balance in one token is not a balance in another).
───────────────────────────────────────────────────────────────────────────*/

struct Inbox {
    address feeToken;      // address(0) = native
    uint128 postage;
    uint64  replyWindow;   // 5 min .. 30 d
    bool    open;          // defaults open and free
    uint64  epoch;         // custody epoch at configuration; stale after sale
}

struct Stamp {
    uint256 pairRoom;
    uint256 from;
    uint256 to;
    address sender;        // who paid, for the refund
    address feeToken;
    uint128 postage;
    uint64  sentAt;
    uint64  replyBy;
    bool    settled;
    bool    refunded;
}

interface IPostageEvents {
    event InboxConfigured(uint256 indexed token, uint64 epoch, address feeToken, uint128 postage, uint64 replyWindow, bool open);
    event Stamped(uint256 indexed stampId, uint256 indexed pairRoom, uint256 from, uint256 to, address feeToken, uint128 postage, uint64 replyBy);
    event Settled(uint256 indexed stampId, address indexed payee, address feeToken, uint128 amount);
    event Expired(uint256 indexed stampId);
    event Refunded(uint256 indexed stampId, address indexed to, address feeToken, uint128 amount);
    event Claimed(address indexed payee, address feeToken, uint256 amount);

    error NotParley();
    error NotHolder();
    error InboxClosed(uint256 token);
    error PostageAboveMax(uint128 postage, uint128 maxPostage);
    error UnexpectedFeeToken(address expected, address actual);
    error BadReplyWindow(uint64 window);
    error ReplyWindowClosed(uint64 replyBy);
    error ReplyWindowOpen(uint64 replyBy);
    error AlreadySettled(uint256 stampId);
    error AlreadyRefunded(uint256 stampId);
    error NoSuchStamp(uint256 stampId);
    error StampPending(uint256 stampId);
    error WrongValue();
    error NothingOwed();
    error TransferFailed();
    error Reentrancy();
}

interface IPostage is IPostageEvents {
    function configureInbox(uint256 token, address feeToken, uint128 postage, uint64 replyWindow, bool open) external;   // holds
    function inboxOf(uint256 token) external view returns (Inbox memory);         // live: zeroed (open, free) when stale
    function stamp(uint256 pairRoom, uint256 from, uint256 to, address expectedFeeToken, uint128 maxPostage) external payable returns (uint256 stampId);   // PARLEY
    function settle(uint256 pairRoom) external;                                   // PARLEY; credits owed[feeSink(to)][feeToken]
    function expire(uint256 stampId) external;                                    // anyone after replyBy
    function claimRefund(uint256 stampId) external;                               // the sender, after expire
    function claimSettled(uint256 token, address feeToken) external;              // pays feeSink(token)
    function claim(address feeToken) external;                                    // msg.sender's own owed balance
    function owed(address payee, address feeToken) external view returns (uint256);
    function stampOf(uint256 stampId) external view returns (Stamp memory);
    function pendingOf(uint256 pairRoom) external view returns (uint256 stampId); // the unanswered stamp, or 0
    function MIN_REPLY_WINDOW() external view returns (uint64);
    function MAX_REPLY_WINDOW() external view returns (uint64);
    function PARLEY() external view returns (address);
    function HUB() external view returns (address);
}
