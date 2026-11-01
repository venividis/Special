// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    IKeepsake, Asset, Schedule, DripTerms, Wrap, SwapAndWrap, KeepsakeView
} from "./interfaces/IKeepsake.sol";
import {IPool, Market} from "./interfaces/IPool.sol";
import {IERC20, IERC165} from "./interfaces/Standards.sol";
import {ERC721Base} from "./lib/ERC721Base.sol";
import {Ratchet} from "./lib/Ratchet.sol";
import {Transient} from "./lib/Transient.sol";
import {ExactERC20} from "./lib/ExactERC20.sol";
import {Mul} from "./lib/Mul.sol";
import {KeepsakeArt} from "./KeepsakeArt.sol";

/*───────────────────────────────────────────────────────────────────────────
  Keepsake — bundles you keep or give, that free slowly and sell slowly

  Origin: NEW for INTACT V2 (docs/V2.md §3.1, unit W1), in the shape of
  src/Locks.sol — the schedule, the exact pulls, the one Ratchet rule, the
  rolling commitment, a release anyone may press that pays only the
  holder — and of src/Market.sol: one transient lock on every door, and no
  owner, fee, pause, setter or upgrade anywhere.

  A keepsake is an ERC-721 whose token holds up to eight assets — native
  ETH and ERC-20s — under one schedule. Nothing frees before the cliff;
  from the cliff the line runs from the start to the end; at the end
  everything is free. Whoever holds the token is paid what has freed.
  Giving one is transferring it, or wrapping it to someone else with a
  message on its face. The mint calls no code of the recipient's
  (ERC721Base `_mint`, never a safe mint), so a gift is never refused by
  the code it is given to — a Reach, a multisig, a 7702 account alike.

  ── what arrives is what is recorded ──

  ERC-20s are pulled by exact delta (`ExactERC20`): a token that delivers
  less than asked is refused outright, never recorded short, so this
  contract never promises more than it holds. Native ETH is `msg.value`,
  equal to the ETH asset's amount to the wei (zero when there is none). The
  only other ETH this contract accepts is a swap's output, from the Pool,
  inside its own lock; anything else is refused rather than stranded,
  because no function here could ever hand a stray balance back. A swap's
  output is measured by balance delta, never taken from the venue's word.
  Rebasing tokens are not accounted for, and a page must say so.

  ── nothing opens early ──

  There is no function that frees anything before the schedule says so —
  not for the creator, not for the holder, not for anyone, because no
  such function exists to call. `extend` only lengthens, through
  `Ratchet.raise` with the ten-year cap, the same rule as every seal and
  lock in INTACT, so a page prints one sentence for all of them. A
  keepsake whose end has passed cannot be extended: that would be a new
  promise wearing an old id, and a new promise is a new keepsake. A
  schedule whose cliff is its end (everything at once) keeps its cliff on
  its end, as a Locks cliff lock does; any other keeps its start and
  cliff, so its slope flattens and nothing already paid is clawed back.
  `extend` is the holder's alone — an approved operator may move the
  token but may not re-write its promise.

  ── the claim rots for nobody ──

  `claim` is anyone's and pays only `ownerOf(id)`: a release that needs
  its holder awake, watching and holding gas on the right day is a
  release that rots (Locks' rule). It pays every freed amount and every
  drip proceed in one call. A holder that refuses ETH reverts the whole
  claim with `TransferFailed` — the holder can always take ETH somewhere,
  by moving the keepsake to an address that does. A token that refuses
  to move is different: it may be paused, or may have frozen this very
  contract, and no holder can fix that. So an ERC-20 is sent by a raw
  call whose answer is not believed — what left this contract's balance
  is what is paid. A refusing token's amount stays freed and owed for a
  later claim, and it never locks the bundle beside it: a stablecoin that
  freezes this address does not freeze the ETH wrapped with it. A token
  that moves and answers `false` is counted by what moved, so nothing is
  ever paid twice out of what other keepsakes hold.

  ── the drip: slow selling with one guard ──

  A drip lets anyone sell what has freed of one asset through a Pool
  market, at most `maxPerDrip` and never more than is freed and neither
  paid nor sold, into the keepsake's proceeds, which the holder is paid by
  the next claim. There is no oracle, so the floor is the whole price
  guard and a drip without one is refused: the minimum output is
  `ceil(sold × floor / 1e18)`, rounded up so that the floor is never
  missed by a wei, handed to the Pool as `minOut` and checked again here
  against what actually arrived. A sandwich can cost the drip nothing
  below the price its holder named. One drip per block per keepsake, so a
  keeper cannot chop one block's price into many sales. The market's pair
  is read at every drip — an owned market can close and reopen as a
  different pair — and a drip refuses any market that no longer trades
  exactly its asset against its proceeds token. Only the holder sets or
  clears a drip, and at `wrap` only on a keepsake you keep: a giver never
  sells a recipient's gift. A keepsake carries at most eight proceeds
  tokens, registered when a drip names them.

  ── the commitment: what a listing pins ──

  `commitmentOf(account)` is a rolling hash that moves when a keepsake
  leaves the account and when the terms of one it holds change (extend, a
  drip set or cleared), each time folding the keepsake's id and its terms.
  It never moves on what a stranger can do — a wrap or a transfer TO the
  account, a claim, a drip — so a gift of dust cannot break a listing,
  exactly as the hub's fingerprint already excludes balances. W6's hub
  folds `commitmentOf(account(id))` into the fingerprint, so listing a
  token pins the keepsakes in its Reach.

  ── what this contract has no function to do ──

  There is no owner, no fee, no pause, no setter, no sweep, no burn and no
  upgrade: two immutables and three constants. `HUB` is a pin for pages
  and for the Catalog; nothing here asks the hub anything. Money leaves
  only through `claim`, to the holder, and through `drip`, into the Pool
  at no less than the floor.
───────────────────────────────────────────────────────────────────────────*/
contract Keepsake is ERC721Base, IKeepsake {
    /// @notice A pin was zero at construction.
    error ZeroAddress();

    uint256 public constant MAX_ASSETS = 8;
    /// @notice Ten years, the ceiling on every lock (`Ratchet.LOCK_CAP`).
    uint64 public constant MAX_TERM = Ratchet.LOCK_CAP;
    uint256 public constant MAX_MESSAGE = 280;

    address public immutable HUB;
    address public immutable POOL;
    /// @notice The renderer `tokenURI` hands its facts to. Stateless, pinned.
    address public immutable ART;

    uint256 public keepsakeCount;

    /// @dev One asset's ledger. `amount` is what was wrapped; `paid` went to
    ///      holders, `sold` went into the Pool by drips. What is owed is
    ///      `amount − paid − sold`, and `paid + sold` never exceeds what the
    ///      schedule has freed.
    struct Holding {
        address token;
        uint256 amount;
        uint256 paid;
        uint256 sold;
    }

    /// @dev What drips earned in one token, owed to the next claim.
    struct Proceed {
        address token;
        uint256 amount;
    }

    struct Record {
        address creator;          // never zero for a keepsake that exists
        uint64  createdAt;
        uint8   n;                // assets
        uint8   m;                // proceeds tokens registered
        uint8   dripAsset;        // index into `holdings`
        uint8   dripOut;          // index into `proceeds`
        uint64  start;
        uint64  cliff;
        uint64  end;
        uint64  lastDripBlock;
        uint256 market;           // the drip's Pool market key
        uint256 floor;            // 0 = no drip
        uint256 maxPerDrip;
        string  message;
        Holding[MAX_ASSETS] holdings;
        Proceed[MAX_ASSETS] proceeds;
    }

    mapping(uint256 => Record) private _rec;
    mapping(address => bytes32) private _commitment;

    constructor(address hub, address pool, address art) {
        if (hub == address(0) || pool == address(0) || art == address(0)) revert ZeroAddress();
        HUB = hub;
        POOL = pool;
        ART = art;
    }

    /*═══════════════════ the one lock ═══════════════════*/

    /// @dev Every door that writes, including the ones that move nothing
    ///      (the Pool's discipline, C1). A revert anywhere under it releases
    ///      it through the transient journal; `exit` is for the success path.
    modifier locked() {
        Transient.enter(Transient.KEEPSAKE_LOCK);
        _;
        Transient.exit(Transient.KEEPSAKE_LOCK);
    }

    /// @notice ETH arrives only as a swap's output: from the Pool, inside
    ///         this contract's own lock. Anything else is refused rather than
    ///         stranded — no path here could ever return it.
    receive() external payable {
        if (msg.sender != POOL || !Transient.held(Transient.KEEPSAKE_LOCK)) revert WrongValue(0, msg.value);
    }

    /*═══════════════════ wrapping ═══════════════════*/

    function wrap(Wrap calldata w) external payable locked returns (uint256 id) {
        uint256 n = w.assets.length;
        if (n == 0) revert NoAssets();
        if (n > MAX_ASSETS) revert TooManyAssets();
        Record storage r;
        (id, r) = _open(w.schedule, w.to, w.message, n);

        uint256 eth;
        for (uint256 i; i < n; ++i) {
            address token = w.assets[i].token;
            uint256 amount = w.assets[i].amount;
            if (amount == 0) revert ZeroAmount();
            // distinct tokens: one asset is one line of the schedule
            for (uint256 j; j < i; ++j) {
                if (w.assets[j].token == token) revert DuplicateAsset(token);
            }
            if (token == address(0)) {
                eth = amount;
            } else {
                ExactERC20.transferFromExact(token, msg.sender, address(this), amount);
                r.holdings[i].token = token;
            }
            r.holdings[i].amount = amount;
        }
        // exactly the ETH asset, to the wei: a surplus would be a balance
        // nobody is owed and nothing here could ever return
        if (msg.value != eth) revert WrongValue(eth, msg.value);

        if (w.drip.floor != 0) {
            // a giver never sells a recipient's gift
            if (w.to != msg.sender) revert BadDrip();
            _setDrip(id, r, w.drip);
        }
        _seal(id, r, w.to);
    }

    /// @notice "Lock what I receive": swap on the Pool, wrap the output.
    function swapAndWrap(SwapAndWrap calldata p) external payable locked returns (uint256 id, uint256 out) {
        if (p.drip.floor != 0 && (p.drip.asset != 0 || p.to != msg.sender)) revert BadDrip();
        Record storage r;
        (id, r) = _open(p.schedule, p.to, p.message, 1);

        Market memory mk = IPool(POOL).marketOf(p.market);
        (address tokenIn, address tokenOut) = p.baseIn ? (mk.base, mk.quote) : (mk.quote, mk.base);
        if (tokenIn == address(0)) {
            if (msg.value != p.amountIn) revert WrongValue(p.amountIn, msg.value);
        } else {
            if (msg.value != 0) revert WrongValue(0, msg.value);
            ExactERC20.transferFromExact(tokenIn, msg.sender, address(this), p.amountIn);
        }
        out = _swap(p.market, p.baseIn, tokenIn, tokenOut, p.amountIn, p.minOut, p.deadline);
        // the Pool refuses both already; what is locked is what arrived
        if (out == 0) revert ZeroAmount();
        if (out < p.minOut) revert BelowFloor(out, p.minOut);

        if (tokenOut != address(0)) r.holdings[0].token = tokenOut;
        r.holdings[0].amount = out;
        if (p.drip.floor != 0) _setDrip(id, r, p.drip);
        _seal(id, r, p.to);
    }

    /// @dev The checks every keepsake passes before anything is pulled, and
    ///      the record's first two words.
    function _open(Schedule calldata s, address to, string calldata message, uint256 n)
        private returns (uint256 id, Record storage r)
    {
        // a keepsake held by this contract is a keepsake nobody holds
        if (to == address(0) || to == address(this)) revert ZeroRecipient();
        uint256 len = bytes(message).length;
        if (len > MAX_MESSAGE) revert MessageTooLong(len);

        uint64 start = s.start == 0 ? uint64(block.timestamp) : s.start;
        uint64 cliff = s.cliff == 0 ? start : s.cliff;
        /*  `end` is the time promise, so it goes through the one rule: in
            the future, and no further than ten years out. Ratchet's two
            errors are this interface's `RatchetOnly` and `TooLong`, the
            same selectors, so the page prints the one sentence it prints
            for every seal. The order of the three dates is a schedule
            question: start ≥ now and start ≤ cliff ≤ end. Then `end > start`
            unless all three are equal (everything frees at once), since
            `end == start` squeezes the cliff between them.             */
        uint64 end = Ratchet.raise(0, s.end, MAX_TERM);
        if (start < block.timestamp || cliff < start || end < cliff) revert BadSchedule();

        id = ++keepsakeCount;
        r = _rec[id];
        r.creator = msg.sender;
        r.createdAt = uint64(block.timestamp);
        r.n = uint8(n);
        r.start = start;
        r.cliff = cliff;
        r.end = end;
        if (len != 0) r.message = message;
    }

    /// @dev The mint, last. No receiver is asked, and no commitment moves:
    ///      a keepsake arriving is something a stranger can do.
    function _seal(uint256 id, Record storage r, address to) private {
        _mint(to, id);
        emit Wrapped(id, msg.sender, to, r.start, r.cliff, r.end, r.n, r.message);
    }

    /*═══════════════════ releasing ═══════════════════*/

    /// @notice Anyone; pays the holder every freed amount and every proceed.
    function claim(uint256 id) external locked returns (Asset[] memory paid) {
        address holder = _holder(id);
        Record storage r = _rec[id];
        uint256 n = r.n;
        uint256 m = r.m;
        paid = new Asset[](n + m);
        uint256 k;
        bool owed;
        for (uint256 i; i < n; ++i) {
            Holding storage h = r.holdings[i];
            uint256 a = _available(r, h);
            if (a == 0) continue;
            owed = true;
            address token = h.token;
            h.paid += a;                                    // state first, then the outside world
            if (_send(token, holder, a)) {
                paid[k++] = Asset(token, a);
                emit Paid(id, holder, token, a);
            } else {
                h.paid -= a;                                // still freed, still owed
            }
        }
        for (uint256 j; j < m; ++j) {
            Proceed storage q = r.proceeds[j];
            uint256 a = q.amount;
            if (a == 0) continue;
            owed = true;
            address token = q.token;
            q.amount = 0;
            if (_send(token, holder, a)) {
                paid[k++] = Asset(token, a);
                emit Paid(id, holder, token, a);
            } else {
                q.amount = a;
            }
        }
        if (!owed) revert NothingFreed();
        // something was owed and every token refused to move it
        if (k == 0) revert TransferFailed();
        assembly ("memory-safe") { mstore(paid, k) }
    }

    /// @notice What a claim would pay now: per asset, freed and neither paid
    ///         nor sold; and every proceed.
    function claimable(uint256 id) external view returns (Asset[] memory freed, Asset[] memory proceeds) {
        _holder(id);
        Record storage r = _rec[id];
        freed = _claimable(r);
        proceeds = _proceedsOf(r);
    }

    function _claimable(Record storage r) private view returns (Asset[] memory freed) {
        uint256 n = r.n;
        freed = new Asset[](n);
        for (uint256 i; i < n; ++i) {
            Holding storage h = r.holdings[i];
            freed[i] = Asset(h.token, _available(r, h));
        }
    }

    /*═══════════════════ the holder's terms ═══════════════════*/

    /// @notice Push the end further out. Never nearer, never past ten years,
    ///         and never once the end has passed.
    function extend(uint256 id, uint64 newEnd) external locked {
        if (_holder(id) != msg.sender) revert NotHolder();
        Record storage r = _rec[id];
        uint64 previous = r.end;
        /*  A kept promise cannot be lengthened: once `end` has passed
            everything is free, and re-locking it would be a new keepsake
            under an old id, which is what `wrap` is for.               */
        if (block.timestamp >= previous) revert BadSchedule();
        uint64 end = Ratchet.raise(previous, newEnd, MAX_TERM);
        // everything-at-once stays everything-at-once, later
        if (r.cliff == previous) r.cliff = end;
        r.end = end;
        _touch(msg.sender, id);
        emit Extended(id, previous, end);
    }

    function setDrip(uint256 id, DripTerms calldata terms) external locked {
        if (_holder(id) != msg.sender) revert NotHolder();
        _setDrip(id, _rec[id], terms);
        _touch(msg.sender, id);
    }

    function clearDrip(uint256 id) external locked {
        if (_holder(id) != msg.sender) revert NotHolder();
        Record storage r = _rec[id];
        if (r.floor == 0) revert NoDrip();
        r.floor = 0;
        r.market = 0;
        r.maxPerDrip = 0;
        r.dripAsset = 0;
        r.dripOut = 0;
        _touch(msg.sender, id);
        emit DripCleared(id);
    }

    /// @dev A drip names an asset, a market with that asset on one side, a
    ///      floor and a most-per-drip. The market's other side becomes a
    ///      proceeds token — at most eight per keepsake, never forgotten.
    function _setDrip(uint256 id, Record storage r, DripTerms calldata t) private {
        if (t.floor == 0 || t.maxPerDrip == 0 || t.asset >= r.n) revert BadDrip();
        address tokenIn = r.holdings[t.asset].token;
        Market memory mk = IPool(POOL).marketOf(t.market);
        address tokenOut;
        if (!mk.open) revert WrongMarket(t.market);
        if (mk.base == tokenIn) tokenOut = mk.quote;
        else if (mk.quote == tokenIn) tokenOut = mk.base;
        else revert WrongMarket(t.market);

        uint256 m = r.m;
        uint256 j;
        while (j < m && r.proceeds[j].token != tokenOut) ++j;
        if (j == m) {
            if (m == MAX_ASSETS) revert TooManyAssets();
            if (tokenOut != address(0)) r.proceeds[j].token = tokenOut;
            r.m = uint8(m + 1);
        }
        r.dripAsset = t.asset;
        r.dripOut = uint8(j);
        r.market = t.market;
        r.floor = t.floor;
        r.maxPerDrip = t.maxPerDrip;
        emit DripSet(id, t.asset, t.market, t.floor, t.maxPerDrip);
    }

    /*═══════════════════ the drip ═══════════════════*/

    /// @notice Anyone; sells what has freed of the drip's asset and is not
    ///         yet paid or sold, at most `maxPerDrip`, never below the floor.
    function drip(uint256 id) external locked returns (uint256 sold, uint256 got) {
        Record storage r = _rec[id];
        if (r.creator == address(0)) revert NoSuchKeepsake(id);
        uint256 floor = r.floor;
        if (floor == 0) revert NoDrip();
        // one block's price is one sale, however many keepers are watching
        if (r.lastDripBlock == block.number) revert OnePerBlock();

        Holding storage h = r.holdings[r.dripAsset];
        uint256 a = _available(r, h);
        uint256 most = r.maxPerDrip;
        sold = a < most ? a : most;
        if (sold == 0) revert NothingFreed();

        Proceed storage q = r.proceeds[r.dripOut];
        address tokenIn = h.token;
        address tokenOut = q.token;
        uint256 market = r.market;
        /*  The pair is read now, not trusted from when the drip was set: an
            owned market can be closed and reopened as another pair, and
            the floor is a price between exactly these two tokens.       */
        Market memory mk = IPool(POOL).marketOf(market);
        bool baseIn = mk.base == tokenIn && mk.quote == tokenOut;
        if (!baseIn && (mk.quote != tokenIn || mk.base != tokenOut)) revert WrongMarket(market);

        // rounded up: the floor is never missed by a wei
        uint256 minOut = Mul.mulDivUp(sold, floor, 1e18);
        r.lastDripBlock = uint64(block.number);
        h.sold += sold;
        got = _swap(market, baseIn, tokenIn, tokenOut, sold, minOut, uint64(block.timestamp));
        // defence in depth beside the Pool's own Slippage: what arrived here
        if (got < minOut) revert BelowFloor(got, minOut);
        q.amount += got;
        emit Dripped(id, msg.sender, tokenIn, sold, tokenOut, got);
    }

    /// @dev Pay `amountIn` into the Pool, exactly: native as value, an
    ///      ERC-20 by an exact approval that is proved spent and proved zero
    ///      after. The output is this contract's balance delta.
    function _swap(
        uint256 market, bool baseIn, address tokenIn, address tokenOut,
        uint256 amountIn, uint256 minOut, uint64 deadline
    ) private returns (uint256 got) {
        uint256 before = _balance(tokenOut);
        if (tokenIn == address(0)) {
            IPool(POOL).swapExactIn{value: amountIn}(market, baseIn, amountIn, minOut, address(this), deadline);
        } else {
            uint256 held = IERC20(tokenIn).balanceOf(address(this));
            ExactERC20.approveExact(tokenIn, POOL, amountIn);
            IPool(POOL).swapExactIn(market, baseIn, amountIn, minOut, address(this), deadline);
            uint256 left = IERC20(tokenIn).balanceOf(address(this));
            // what left is what was sold, or other keepsakes paid for it
            if (left > held || held - left != amountIn) revert TransferFailed();
            if (IERC20(tokenIn).allowance(address(this), POOL) != 0) ExactERC20.approveExact(tokenIn, POOL, 0);
        }
        uint256 after_ = _balance(tokenOut);
        got = after_ > before ? after_ - before : 0;
    }

    /*═══════════════════ the commitment ═══════════════════*/

    /// @dev Before every change of owner (ERC721Base). A keepsake leaving
    ///      `from` moves `from`'s commitment; the mint (`from` zero) and the
    ///      arrival at `to` move nothing, because a stranger can cause both.
    ///      This contract is never a holder: it could claim nothing, so a
    ///      keepsake sent to it would be lost to everyone (`wrap` refuses it
    ///      as a recipient for the same reason).
    function _beforeMove(address from, address to, uint256 id) internal override {
        if (to == address(this)) revert ERC721InvalidReceiver(to);
        if (from != address(0)) _touch(from, id);
    }

    /// @dev Fold the keepsake's id and its terms — the schedule as it now
    ///      stands and the drip — into the account's rolling hash. The assets
    ///      are fixed under the id for ever, so the id stands for them.
    function _touch(address account, uint256 id) private {
        Record storage r = _rec[id];
        bytes32 terms = keccak256(abi.encode(r.start, r.cliff, r.end, r.dripAsset, r.market, r.floor, r.maxPerDrip));
        _commitment[account] = keccak256(abi.encode(_commitment[account], id, terms));
    }

    function commitmentOf(address account) external view returns (bytes32) {
        return _commitment[account];
    }

    /*═══════════════════ reading ═══════════════════*/

    function keepsakeOf(uint256 id) external view returns (KeepsakeView memory) {
        return _view(id);
    }

    function _view(uint256 id) private view returns (KeepsakeView memory v) {
        v.holder = _holder(id);
        Record storage r = _rec[id];
        v.creator = r.creator;
        v.createdAt = r.createdAt;
        v.schedule = Schedule(r.start, r.cliff, r.end);
        uint256 n = r.n;
        v.assets = new Asset[](n);
        v.paid = new uint256[](n);
        v.sold = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            Holding storage h = r.holdings[i];
            v.assets[i] = Asset(h.token, h.amount);
            v.paid[i] = h.paid;
            v.sold[i] = h.sold;
        }
        v.proceeds = _proceedsOf(r);
        v.message = r.message;
        if (r.floor != 0) v.drip = DripTerms(r.dripAsset, r.market, r.floor, r.maxPerDrip);
        v.lastDripBlock = r.lastDripBlock;
    }

    function name() external pure returns (string memory) { return "Keepsake"; }
    function symbol() external pure returns (string memory) { return "KEEPSAKE"; }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Base, IERC165) returns (bool) {
        return interfaceId == type(IKeepsake).interfaceId || super.supportsInterface(interfaceId);
    }

    /*═══════════════════ the schedule ═══════════════════*/

    /// @dev Nothing before the cliff; everything from the end; between, the
    ///      line from the start, rounded down. `end > start` wherever the
    ///      line is reached: now ≥ cliff ≥ start and now < end.
    function _freed(uint256 amount, uint64 start, uint64 cliff, uint64 end) private view returns (uint256) {
        if (block.timestamp < cliff) return 0;
        if (block.timestamp >= end) return amount;
        return Mul.mulDivDown(amount, block.timestamp - start, end - start);
    }

    /// @dev Freed and neither paid nor sold. A lengthened schedule frees
    ///      less than was already taken until its line catches up: zero
    ///      then, never a claw-back.
    function _available(Record storage r, Holding storage h) private view returns (uint256) {
        uint256 freed = _freed(h.amount, r.start, r.cliff, r.end);
        uint256 used = h.paid + h.sold;
        return freed > used ? freed - used : 0;
    }

    /*═══════════════════ internals ═══════════════════*/

    function _holder(uint256 id) private view returns (address holder) {
        holder = _ownerOrZero(id);
        if (holder == address(0)) revert NoSuchKeepsake(id);
    }

    function _proceedsOf(Record storage r) private view returns (Asset[] memory out) {
        uint256 m = r.m;
        out = new Asset[](m);
        for (uint256 j; j < m; ++j) out[j] = Asset(r.proceeds[j].token, r.proceeds[j].amount);
    }

    function _balance(address token) private view returns (uint256) {
        return token == address(0) ? address(this).balance : IERC20(token).balanceOf(address(this));
    }

    /// @dev ETH by call, and a refusal reverts: the holder chose code that
    ///      refuses, and can move the keepsake to an address that does not.
    ///      An ERC-20 by a raw `transfer` whose answer is not believed: what
    ///      left this contract's balance is what is paid. A token that will
    ///      not move — reverting, answering false, frozen, blind — leaves the
    ///      amount owed and the claim goes on; one that moves and answers
    ///      false is counted by what moved, so it is never paid twice out of
    ///      what other keepsakes hold; one that moves less than asked leaves
    ///      this contract holding more than it owes, never less.
    function _send(address token, address to, uint256 amount) private returns (bool) {
        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
            return true;
        }
        (bool seen, uint256 before) = _held(token);
        if (!seen) return false;
        assembly ("memory-safe") {
            let p := mload(0x40)
            mstore(p, shl(224, 0xa9059cbb))                 // transfer(address,uint256)
            mstore(add(p, 0x04), to)
            mstore(add(p, 0x24), amount)
            pop(call(gas(), token, 0, p, 0x44, 0, 0))       // no answer is copied, none believed
        }
        (bool seenAfter, uint256 after_) = _held(token);
        return seenAfter && after_ < before;
    }

    /// @dev This contract's balance of `token`, or `seen == false` when the
    ///      token will not say. One word of answer is read, whatever is sent,
    ///      under a stipend no honest `balanceOf` comes near. The call is
    ///      bound before `returndatasize` is read: Yul evaluates arguments
    ///      right to left, so the one-line `and(staticcall(…), gt(…))` reads
    ///      the size of the call before it.
    function _held(address token) private view returns (bool seen, uint256 bal) {
        assembly ("memory-safe") {
            mstore(0x00, shl(224, 0x70a08231))              // balanceOf(address)
            mstore(0x04, address())
            let ok := staticcall(100000, token, 0x00, 0x24, 0x00, 0x20)
            seen := and(ok, gt(returndatasize(), 0x1f))
            bal := mload(0x00)
        }
    }

    /*═══════════════════ the face ═══════════════════*/

    /// @notice The keepsake's face, drawn by `ART` from the facts below: an
    ///         orb of its assets with the freed share of its schedule as an
    ///         arc, and an HTML page of what it holds and how it frees.
    /// @dev    ERC-721's own refusal for an unknown id (ERC-6093).
    function tokenURI(uint256 id) external view returns (string memory) {
        ownerOf(id);
        Record storage r = _rec[id];
        return KeepsakeArt(ART).render(id, _view(id), _claimable(r), _freed(1000, r.start, r.cliff, r.end));
    }
}
