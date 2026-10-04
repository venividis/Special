// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Curve} from "./lib/Curve.sol";
import {Mul} from "./lib/Mul.sol";
import {Ratchet} from "./lib/Ratchet.sol";
import {Rights} from "./lib/Rights.sol";
import {Transient} from "./lib/Transient.sol";
import {IPool, Market} from "./interfaces/IPool.sol";

/// @dev The one thing the Pool asks the hub beyond `ownerOf`/`account`
///      (which Rights reads): where a sealed market's fees go.
interface IPoolHub {
    function feeSink(uint256 id) external view returns (address);
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/*═══════════════════════════════════════════════════════════════════════════

  POOL — every token is its own exchange, and every launch leaves one behind

  Origin: IPSEITY src/Pool.sol + src/lib/Curve.sol, adapted for INTACT
  (DESIGN.md §6.1). What is kept is the whole idea and all of the pricing:
  one market per token, the holder of token #7 is the sole liquidity
  provider of market #7, anyone may trade, and because the right to that
  inventory is "whoever ownerOf() says", selling the NFT sells the market —
  the reserves, the fee income and the price curve go with it in the same
  transaction, with no migration and no wrapper.

  What changed, and why, each with the finding it answers:

  · ONE LOCK ON EVERY DOOR (C1). IPSEITY guarded deposit, withdraw and
    swap and nothing else. A holder who was also a hostile ERC-20 could,
    from inside deposit's pull, re-enter closeMarket — unguarded, holder,
    unbonded, reserves still zero — delete the market, and let deposit
    finish writing a reserve into a closed struct; openMarket on a new pair
    then inherited that reserve and withdraw paid it out of another
    market's inventory. The repository sketched it (test/mocks/PoolReenter
    .sol, a nine-line tools/poc-pool.mjs) and never ran it. Now every
    state-changing function takes the same Transient lock, closeMarket
    requires both reserves zero, and openMarket refuses a struct with
    anything in it before it writes. test/PoolReenter.t.sol drives the
    four steps and asserts step two is refused.

  · READS BEFORE THE PULL (C2). swap read vIn/vOut AFTER pulling the input,
    so a token that called out during transferFrom was a window in which
    the one actor allowed to move the curve could flatten it mid-trade.
    Reserves, offsets and the fee are read into memory before anything
    external is called; and syncCurve is under the lock, so the attempt
    reverts Reentrancy regardless.

  · THE POOL NEVER PAYS ONE MARKET WITH ANOTHER'S RESERVES (C5). Two
    markets on the same token share one balance. IPSEITY monitored the
    over-claim after the fact (its invariant 63) and leaned on an admin
    allowlist. Here `totalReserved[token]` is every claim this contract
    carries in that token — reserves and, on sealed markets, fees owed —
    and every payout is capped at `balance − (totalReserved − this market's
    claim)`, with checked arithmetic. A token that rebases downward makes
    the cap zero and the market fails CLOSED: withdraw and swap revert
    Insolvent until the holder calls writeDown(id), which lowers that one
    market's books to what the balance can honour. Whoever writes down
    first books the loss; no market ever books another's money.

  · NO ADMIN. setPaused, bless, setAllowlistEnforced, proposeAdmin and
    acceptAdmin are gone, and so is the deposit cap they justified. There
    is no owner, no pause, no allowlist and no selector that takes a
    switch. tools/verify-pool.mjs reads the ABI and says so.

  · `acts`, NOT `ownerOf`. Every holder operation admits the holder or
    the token's own Reach (Rights.acts), so a session key can feed its
    token's market through the Reach, and never a renter, operator,
    approvee or session key directly.

  · THE CURVE IS A NUMBER THE HOLDER KEEPS. The concentration is the
    ERC-7496 `curve` trait (holds-only on the hub), applied here only by
    syncCurve(id, bps, expected) — `expected` is the value the holder saw,
    and a sync against a moved curve reverts CurveMoved (B2), so nobody
    races the holder's own sync and no renter has a pricing lever.

  · NATIVE ETH on either side (address(0)); the native leg must equal
    msg.value exactly (WrongValue), pushes are call{value} reverting
    TransferFailed, and ERC-20 legs are measured on arrival so a token
    that takes a cut cannot overstate a reserve.

  · swapExactOut, inverting the same pure function with the input rounded
    up (Curve.amountIn), and a native-in exact-out returns the unspent
    part of msg.value in the same call.

  · THE SNIPER FEE: an additive surcharge set only in openMarket, decaying
    linearly to feeBps over at most 98 minutes. deposit never touches it,
    so a holder cannot re-arm it against standing traders. There is no
    exemption list, because there is no list.

  · SEALED MARKETS. Launchpad.graduate opens a market keyed by
    keccak("intact.sealed", launchKey) whose reserves are principal nobody
    can withdraw, ever — no setFee, no sync, no seal, no close. Its fees
    accrue to feeBaseOwed/feeQuoteOwed and anyone may collect them to
    HUB.feeSink(beneficiary): the token's Reach, or its Grip when the
    holder set the bit. Selling the Intact sells the launch's fee stream,
    with no v4 dependency and no second NFT.

  ── kept from IPSEITY, verbatim in spirit ──

  There are no LP shares. A single provider per market removes share
  accounting, the first-depositor donation attack, and every rounding
  question that comes with dividing a pool between people. It also means
  this cannot aggregate deep liquidity, which is a real limitation and the
  honest cost of the design. There is no oracle, no TWAP and no flash
  loan: a pool whose curve its owner can move on demand has no business
  being read as a price feed by anything else.

  The holder can move the curve. A holder can watch a pending swap and
  re-shape the curve to take more of it. This is not preventable in a
  design where the holder owns the curve — so it is bounded instead: every
  swap carries a minOut (or maxIn) that the trader sets, checked after the
  fact against what actually arrived. A trader who sets it is unharmed. A
  trader who passes zero has chosen to be.

  THE SEAL (IPSEITY's bond, renamed). "Selling the token sells the market"
  is mechanically true the moment ownerOf changes and worth nothing to a
  buyer on its own: the seller can empty it between the handshake and the
  settlement. So a holder may seal a market: a timestamp before which no
  inventory leaves and no term is changed. It ratchets through
  Ratchet.raise (365 days, never shorter, never the past) and survives
  transfer, because it is a promise to whoever reads it and not to whoever
  made it. While sealed only additive operations are allowed — deposit,
  trade — and the curve does not re-anchor on a deposit, because an
  adversarial review once reshaped a bonded curve through that one open
  door (IPSEITY invariant 56).

  Unaudited. It holds other people's money.

═══════════════════════════════════════════════════════════════════════════*/
contract Pool is IPool {
    uint16 public constant MAX_FEE_BPS = 500;            // 5 %
    /// @dev A pool priced against virtual reserves can quote more than it
    ///      holds. Rather than pretend otherwise, no single trade may take
    ///      more than this share of the real outgoing reserve.
    uint16 public constant MAX_OUT_BPS = 5_000;          // half the reserve
    uint24 public constant MAX_CURVE_BPS = 80_000;       // = Curve.MAX_CONCENTRATION
    uint16 public constant MAX_SNIPER_BPS = 9_000;
    uint32 public constant MAX_SNIPER_SECONDS = 98 minutes;
    uint256 private constant BPS = 10_000;

    address public immutable HUB;
    address public immutable LAUNCHPAD;

    mapping(uint256 => Market) private _marketOf;

    /// @notice Every claim this contract carries in `token`: the reserves
    ///         of every market on it plus the fees owed by sealed markets.
    ///         The balance must cover it; a payout that would leave it
    ///         uncovered is refused (C5).
    mapping(address => uint256) public totalReserved;

    /// @dev The sniper window's length, kept beside the struct because the
    ///      struct carries only the moment it ends and a linear decay needs
    ///      both. Zero for a market opened without one, and for every
    ///      sealed market.
    mapping(uint256 => uint32) private _sniperWindow;

    /*  Membership is exactly `open && !sealedMarket` for the owned list and
        `sealedMarket` for the sealed one, each changing in exactly two
        places, so both can be enumerated for one push and one swap-and-pop.
        Without this the only way to find markets is to walk token ids, and
        a band of 3,072 with three markets on it is a directory that shows
        nothing for its first hundred pages. Order is not stable: closing a
        market moves the last entry into its place, which is the standard
        cost of swap-and-pop and is written down rather than discovered. */
    uint256[] private _open;
    mapping(uint256 => uint256) private _openAt;      // index + 1; zero means absent
    uint256[] private _sealed;
    mapping(uint256 => uint256) private _sealedAt;

    /// @dev What a trade is priced against, read into memory BEFORE any
    ///      external call (C2).
    struct Legs { uint256 rIn; uint256 rOut; uint256 vIn; uint256 vOut; uint256 fee; }

    constructor(address hub, address launchpad) {
        HUB = hub;
        LAUNCHPAD = launchpad;
    }

    /*═══════════════════ the one lock ═══════════════════*/

    /// @dev Every state-changing function, including the ones that move no
    ///      asset (C1). A revert anywhere under it releases it through the
    ///      transient journal; `exit` is for the success path.
    modifier locked() {
        Transient.enter(Transient.POOL_LOCK);
        _;
        Transient.exit(Transient.POOL_LOCK);
    }

    /*═══════════════════ authority ═══════════════════*/

    /// @dev The holder or the token's Reach. Never a renter: a renter may
    ///      use the token under ERC-4907 but must never move its inventory.
    function _acts(uint256 id) private view {
        if (!Rights.acts(HUB, id, msg.sender)) revert NotActor();
    }

    /// @dev An owned market the caller may operate: open, not graduation
    ///      liquidity, and the caller acts for the id.
    function _owned(uint256 id) private view returns (Market storage m) {
        m = _marketOf[id];
        if (!m.open) revert MarketNotOpen();
        if (m.sealedMarket) revert SealedMarket();
        _acts(id);
    }

    function _unsealed(Market storage m) private view {
        if (Ratchet.live(m.sealUntil)) revert Sealed(m.sealUntil);
    }

    /*═══════════════════ the owned market ═══════════════════*/

    function openMarket(
        uint256 id, address base, address quote_, uint16 feeBps,
        uint24 curveBps, uint16 sniperBps, uint32 sniperSeconds
    ) external locked {
        _acts(id);
        Market storage m = _marketOf[id];
        if (m.open) revert MarketAlreadyOpen();
        if (base == quote_) revert SameToken();
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (curveBps > MAX_CURVE_BPS) revert CurveTooSteep();
        if (sniperBps > MAX_SNIPER_BPS || sniperSeconds > MAX_SNIPER_SECONDS) revert SniperTooHigh();

        /*  C1. IPSEITY's openMarket wrote base, quote, fee and open into
            whatever struct was there, so a reserve left behind by the
            re-entered close was inherited by the next pair. A closed
            struct cannot hold a reserve any more (closeMarket requires
            both zero and runs under the lock), so this is a refusal that
            can never fire — kept because refusing is the right answer if
            it ever could, where a silent delete would also desynchronise
            totalReserved. Then the struct is cleared whole, so no field
            of an earlier market — a seal, an anchor, a curve — survives
            into this one.                                               */
        if (m.rBase != 0 || m.rQuote != 0) revert MarketNotEmpty();
        delete _marketOf[id];

        m.base = base;
        m.quote = quote_;
        m.feeBps = feeBps;
        m.curveBps = curveBps;
        m.open = true;
        /*  The sniper fee is armed here and nowhere else. A deposit cannot
            re-arm it against traders who priced the market without it. */
        if (sniperBps != 0 && sniperSeconds != 0) {
            m.sniperBps = sniperBps;
            m.sniperUntil = uint64(block.timestamp) + sniperSeconds;
            _sniperWindow[id] = sniperSeconds;
        } else {
            delete _sniperWindow[id];
        }
        _remember(id);
        _anchor(id, m);
        emit MarketOpened(id, base, quote_, feeBps, curveBps);
    }

    /// @notice Close a market so the pair can be changed. Take the inventory
    ///         out first; this will not do it for you, because a function
    ///         that both closes and pays out is a function that can fail
    ///         halfway.
    function closeMarket(uint256 id) external locked {
        Market storage m = _owned(id);
        _unsealed(m);
        if (m.rBase != 0 || m.rQuote != 0) revert MarketNotEmpty();
        delete _marketOf[id];
        delete _sniperWindow[id];
        _forget(id);
        emit MarketClosed(id);
    }

    function setFee(uint256 id, uint16 feeBps) external locked {
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        Market storage m = _owned(id);
        _unsealed(m);
        m.feeBps = feeBps;
        emit FeeSet(id, feeBps);
    }

    /// @notice Apply the holder's `curve` trait to the market.
    /// @param  expected the concentration the caller saw. A sync against a
    ///         curve that has moved since reverts CurveMoved, so a holder's
    ///         sync and the Reach's cannot race each other (B2).
    function syncCurve(uint256 id, uint24 curveBps, uint24 expected) external locked {
        Market storage m = _owned(id);
        // a seal that let its maker re-price would promise the inventory
        // and then hand it away through the curve: the same rug, more steps
        _unsealed(m);
        if (m.curveBps != expected) revert CurveMoved();
        if (curveBps > MAX_CURVE_BPS) revert CurveTooSteep();
        m.curveBps = curveBps;
        _anchor(id, m);
        emit CurveSynced(id, curveBps);
    }

    /// @notice Promise that nothing leaves this market and no term moves
    ///         before `until`. Ratchet-only, ≤ 365 days, survives the sale.
    function sealMarket(uint256 id, uint64 until) external locked {
        Market storage m = _owned(id);
        m.sealUntil = Ratchet.raise(m.sealUntil, until, Ratchet.SEAL_CAP);
        emit MarketSealed(id, until);
    }

    /*═══════════════════ liquidity ═══════════════════*/

    function deposit(uint256 id, uint256 amountBase, uint256 amountQuote) external payable locked {
        Market storage m = _owned(id);
        if (amountBase == 0 && amountQuote == 0) revert ZeroAmount();
        uint256 due = m.base == address(0) ? amountBase : (m.quote == address(0) ? amountQuote : 0);
        if (msg.value != due) revert WrongValue();

        // measure what actually arrived: a token that takes a cut on
        // transfer must not be able to overstate the reserve
        uint256 gotBase = amountBase == 0 ? 0 : _take(m.base, amountBase);
        uint256 gotQuote = amountQuote == 0 ? 0 : _take(m.quote, amountQuote);

        uint256 nb = uint256(m.rBase) + gotBase;
        uint256 nq = uint256(m.rQuote) + gotQuote;
        if (nb > Curve.MAX_RESERVE || nq > Curve.MAX_RESERVE) revert ReserveOverflow();

        m.rBase = uint112(nb);
        m.rQuote = uint112(nq);
        totalReserved[m.base] += gotBase;
        totalReserved[m.quote] += gotQuote;
        _anchor(id, m);
        emit Deposited(id, gotBase, gotQuote);
    }

    /// @notice Take inventory out. Never pausable: there is no switch in
    ///         this contract and no path by which anyone can halt custody.
    function withdraw(uint256 id, uint256 amountBase, uint256 amountQuote, address to) external locked {
        Market storage m = _owned(id);
        _unsealed(m);
        if (to == address(0)) revert TransferFailed();
        if (amountBase == 0 && amountQuote == 0) revert ZeroAmount();
        // more than the market holds is a payout the market cannot make
        if (amountBase > m.rBase || amountQuote > m.rQuote) revert Insolvent();

        // state first, then the outside world
        m.rBase = uint112(uint256(m.rBase) - amountBase);
        m.rQuote = uint112(uint256(m.rQuote) - amountQuote);
        totalReserved[m.base] -= amountBase;
        totalReserved[m.quote] -= amountQuote;
        _anchor(id, m);

        if (amountBase != 0) _pay(m.base, to, amountBase, totalReserved[m.base] - m.rBase);
        if (amountQuote != 0) _pay(m.quote, to, amountQuote, totalReserved[m.quote] - m.rQuote);
        emit Withdrawn(id, amountBase, amountQuote, to);
    }

    /// @notice Lower this market's books to what the balance can honour,
    ///         after a token rebased or was otherwise taken out from under
    ///         the pool (C5). The holder's own recovery; it cannot touch
    ///         what other markets are owed.
    function writeDown(uint256 id) external locked {
        Market storage m = _owned(id);
        uint256 nb = _solventShare(m.base, m.rBase);
        uint256 nq = _solventShare(m.quote, m.rQuote);
        if (nb == m.rBase && nq == m.rQuote) revert ZeroAmount();   // nothing to write down
        if (nb < m.rBase) {
            totalReserved[m.base] -= m.rBase - nb;
            m.rBase = uint112(nb);
        }
        if (nq < m.rQuote) {
            totalReserved[m.quote] -= m.rQuote - nq;
            m.rQuote = uint112(nq);
        }
        _anchor(id, m);
        emit WrittenDown(id, m.rBase, m.rQuote);
    }

    /// @dev Re-anchor the curve to the reserves as they now stand. Called
    ///      from every path that changes liquidity or the curve, and from no
    ///      path that trades — which is the entire distinction that makes
    ///      the pricing sound.
    function _anchor(uint256 key, Market storage m) private {
        /*  A seal freezes the curve, and that has to include the doors
            nobody thought of as doors. Deposits still land under a live
            seal; the curve simply does not follow them, which is what
            "frozen" was always supposed to mean. The effect on a depositor
            is that their new liquidity prices wider than the committed
            shape — worse for them, never for a trader, and it ends when
            the seal does.                                               */
        if (Ratchet.live(m.sealUntil)) return;
        (uint256 vb, uint256 vq) = Curve.anchor(m.curveBps, m.rBase, m.rQuote);
        m.vBase = uint128(vb);
        m.vQuote = uint128(vq);
        emit CurveAnchored(key, uint128(vb), uint128(vq));
    }

    /*═══════════════════ trading ═══════════════════*/

    /// @notice What this market would pay for `amountIn` right now.
    /// @dev    A view, and only a view: the holder may re-shape the curve in
    ///         the next block. Never trade on this without a minOut.
    function quote(uint256 key, bool baseIn, uint256 amountIn) external view returns (uint256 out) {
        Market storage m = _marketOf[key];
        if (!m.open) revert MarketNotOpen();
        if (amountIn == 0) revert ZeroAmount();
        out = _out(_legs(key, m, baseIn), amountIn);
    }

    /// @notice What `amountOut` would cost right now.
    function quoteExactOut(uint256 key, bool baseIn, uint256 amountOut) external view returns (uint256 inNeeded) {
        Market storage m = _marketOf[key];
        if (!m.open) revert MarketNotOpen();
        if (amountOut == 0) revert ZeroAmount();
        inNeeded = _in(_legs(key, m, baseIn), amountOut);
    }

    /// @notice Trade against a market.
    /// @param  minOut the least that may reach `to`. Setting zero is a decision.
    function swapExactIn(
        uint256 key, bool baseIn, uint256 amountIn, uint256 minOut, address to, uint64 deadline
    ) external payable locked returns (uint256 out) {
        if (block.timestamp > deadline) revert Expired();
        Market storage m = _marketOf[key];
        if (!m.open) revert MarketNotOpen();
        if (amountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert TransferFailed();         // an output to nobody is a burn
        (address tokenIn, address tokenOut) = baseIn ? (m.base, m.quote) : (m.quote, m.base);

        // C2: everything the price depends on, read before the pull
        Legs memory L = _legs(key, m, baseIn);
        if (msg.value != (tokenIn == address(0) ? amountIn : 0)) revert WrongValue();
        uint256 got = _take(tokenIn, amountIn);        // what actually arrived

        // the offsets are read, never rewritten: a trade moves along the
        // curve and does not move the curve
        uint256 grossOut = _out(L, got);
        uint256 feeAmt = Mul.mulDivUp(got, L.fee, BPS);
        _settle(m, baseIn, tokenIn, tokenOut, got, feeAmt, grossOut);

        /*  `minOut` is a promise about what reaches the recipient, not what
            leaves this contract. Fee-on-transfer output tokens otherwise let
            a swap pass its floor while delivering less than the trader
            authorised. Measure the same way inputs are measured. The
            reserve still falls by `grossOut`: any transfer tax is imposed
            after the pool has paid and cannot remain available to another
            trader.                                                        */
        out = _pay(tokenOut, to, grossOut, _others(m, tokenOut, baseIn));
        if (out < minOut) revert Slippage(out, minOut);
        if (out == 0) revert ZeroAmount();
        emit Swapped(key, msg.sender, baseIn, got, out, feeAmt);
    }

    /// @notice Buy exactly `amountOut`, spending at most `maxIn`.
    /// @dev    A native input sends `maxIn` as msg.value and receives the
    ///         unspent part back in the same call; an ERC-20 input is pulled
    ///         for exactly what the curve asks.
    function swapExactOut(
        uint256 key, bool baseIn, uint256 amountOut, uint256 maxIn, address to, uint64 deadline
    ) external payable locked returns (uint256 inUsed) {
        if (block.timestamp > deadline) revert Expired();
        Market storage m = _marketOf[key];
        if (!m.open) revert MarketNotOpen();
        if (amountOut == 0) revert ZeroAmount();
        if (to == address(0)) revert TransferFailed();
        (address tokenIn, address tokenOut) = baseIn ? (m.base, m.quote) : (m.quote, m.base);

        Legs memory L = _legs(key, m, baseIn);
        inUsed = _in(L, amountOut);
        if (inUsed > maxIn) revert Slippage(inUsed, maxIn);
        if (msg.value != (tokenIn == address(0) ? maxIn : 0)) revert WrongValue();
        if (tokenIn != address(0)) {
            // an input that arrives short (a transfer tax) cannot buy an
            // exact amount; an input that arrives long is credited whole
            uint256 got = _pull(tokenIn, inUsed);
            if (got < inUsed) revert Slippage(got, inUsed);
            inUsed = got;
        }

        uint256 feeAmt = Mul.mulDivUp(inUsed, L.fee, BPS);
        _settle(m, baseIn, tokenIn, tokenOut, inUsed, feeAmt, amountOut);

        uint256 out = _pay(tokenOut, to, amountOut, _others(m, tokenOut, baseIn));
        // exact means exact at the recipient, not at this contract's door
        if (out < amountOut) revert Slippage(out, amountOut);

        if (tokenIn == address(0) && maxIn > inUsed) _push(address(0), msg.sender, maxIn - inUsed);
        emit Swapped(key, msg.sender, baseIn, inUsed, out, feeAmt);
    }

    /// @dev The books of a trade: the fee stays in the reserve of an owned
    ///      market (the holder's income travels with the token) and is set
    ///      aside on a sealed one (collected to feeSink). Either way the
    ///      incoming reserve rises by at least what the pricing assumed, so
    ///      k never falls — Curve.amountOut priced net of floor(in·(1−f))
    ///      and ceil(in·f) is exactly its complement.
    function _settle(
        Market storage m, bool baseIn, address tokenIn, address tokenOut,
        uint256 got, uint256 feeAmt, uint256 grossOut
    ) private {
        uint256 toReserve = got;
        if (m.sealedMarket) {
            toReserve = got - feeAmt;
            if (baseIn) m.feeBaseOwed = _u112(uint256(m.feeBaseOwed) + feeAmt);
            else m.feeQuoteOwed = _u112(uint256(m.feeQuoteOwed) + feeAmt);
        }
        uint256 rIn = baseIn ? m.rBase : m.rQuote;
        uint256 rOut = baseIn ? m.rQuote : m.rBase;
        uint256 newIn = rIn + toReserve;
        if (newIn > Curve.MAX_RESERVE) revert ReserveOverflow();
        uint256 newOut = rOut - grossOut;
        if (baseIn) { m.rBase = uint112(newIn); m.rQuote = uint112(newOut); }
        else        { m.rQuote = uint112(newIn); m.rBase = uint112(newOut); }
        totalReserved[tokenIn] += got;
        totalReserved[tokenOut] -= grossOut;
    }

    function _legs(uint256 key, Market storage m, bool baseIn) private view returns (Legs memory L) {
        (L.rIn, L.rOut, L.vIn, L.vOut) = baseIn
            ? (uint256(m.rBase), uint256(m.rQuote), uint256(m.vBase), uint256(m.vQuote))
            : (uint256(m.rQuote), uint256(m.rBase), uint256(m.vQuote), uint256(m.vBase));
        L.fee = _feeNow(key, m);
    }

    /// @dev feeBps plus the sniper surcharge, which falls linearly from
    ///      sniperBps at open to nothing at sniperUntil. Rounded up: the
    ///      fee is the pool's.
    function _feeNow(uint256 key, Market storage m) private view returns (uint256 fee) {
        fee = m.feeBps;
        uint64 until = m.sniperUntil;
        if (m.sniperBps == 0 || block.timestamp >= until) return fee;
        uint256 window = _sniperWindow[key];
        if (window == 0) return fee;
        fee += Mul.mulDivUp(m.sniperBps, until - block.timestamp, window);
    }

    function _out(Legs memory L, uint256 amountIn) private pure returns (uint256 grossOut) {
        // an empty side can pay nothing, so every trade is too large for it
        if (L.rIn == 0 || L.rOut == 0) revert TradeTooLarge();
        grossOut = Curve.amountOut(amountIn, L.rIn, L.rOut, L.vIn, L.vOut, L.fee);
        // the curve prices against liquidity the pool does not hold, so the
        // pool states its maximum trade rather than promising what it cannot pay
        if (grossOut > Mul.mulDivDown(L.rOut, MAX_OUT_BPS, BPS)) revert TradeTooLarge();
        if (grossOut == 0) revert ZeroAmount();
    }

    function _in(Legs memory L, uint256 amountOut) private pure returns (uint256 inNeeded) {
        if (L.rIn == 0 || L.rOut == 0) revert TradeTooLarge();
        if (amountOut > Mul.mulDivDown(L.rOut, MAX_OUT_BPS, BPS)) revert TradeTooLarge();
        inNeeded = Curve.amountIn(amountOut, L.rIn, L.rOut, L.vIn, L.vOut, L.fee);
    }

    /*═══════════════════ sealed markets ═══════════════════*/

    /// @notice Graduation liquidity. Only the Launchpad opens one; its
    ///         principal never leaves; its fees are collected by anyone to
    ///         the beneficiary token's feeSink.
    /// @dev    The quote leg is the raise, and the raise is native: `quote`
    ///         must be address(0) and msg.value is the quote reserve. The
    ///         base leg is pulled from the Launchpad and measured. The curve
    ///         is plain constant product, so the opening spot price is the
    ///         launch's terminal price exactly.
    function openSealed(
        bytes32 launchKey, address base, address quote_, uint16 feeBps, uint256 amountBase, uint256 beneficiary
    ) external payable locked returns (uint256 key) {
        if (msg.sender != LAUNCHPAD) revert NotLaunchpad();
        key = sealedKey(launchKey);
        Market storage m = _marketOf[key];
        if (m.open) revert MarketAlreadyOpen();
        if (base == quote_) revert SameToken();
        if (quote_ != address(0)) revert WrongValue();
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (amountBase == 0 || msg.value == 0) revert ZeroAmount();

        uint256 gotBase = _pull(base, amountBase);
        if (gotBase > Curve.MAX_RESERVE || msg.value > Curve.MAX_RESERVE) revert ReserveOverflow();

        m.base = base;
        m.quote = quote_;
        m.feeBps = feeBps;
        m.open = true;
        m.sealedMarket = true;
        m.beneficiary = beneficiary;
        m.rBase = uint112(gotBase);
        m.rQuote = uint112(msg.value);
        totalReserved[base] += gotBase;
        totalReserved[address(0)] += msg.value;
        _sealedRemember(key);
        emit SealedOpened(key, launchKey, base, quote_, beneficiary);
        emit CurveAnchored(key, 0, 0);
    }

    /// @notice Pay a sealed market's accumulated fees to the beneficiary
    ///         token's feeSink. Anyone may call; nobody chooses where it goes.
    function collect(uint256 key) external locked {
        Market storage m = _marketOf[key];
        if (!m.open) revert MarketNotOpen();
        uint256 b = m.feeBaseOwed;
        uint256 q = m.feeQuoteOwed;
        if (b == 0 && q == 0) revert ZeroAmount();     // an owned market owes nothing here
        address to = IPoolHub(HUB).feeSink(m.beneficiary);
        m.feeBaseOwed = 0;
        m.feeQuoteOwed = 0;
        if (b != 0) {
            totalReserved[m.base] -= b;
            _pay(m.base, to, b, totalReserved[m.base] - m.rBase);
        }
        if (q != 0) {
            totalReserved[m.quote] -= q;
            _pay(m.quote, to, q, totalReserved[m.quote] - m.rQuote);
        }
        emit Collected(key, to, b, q);
    }

    function sealedKey(bytes32 launchKey) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked("intact.sealed", launchKey)));
    }

    /*═══════════════════ reading ═══════════════════*/

    function marketOf(uint256 key) external view returns (Market memory) {
        return _marketOf[key];
    }

    /// @notice The terms and reserves a fingerprint commits to: base, quote,
    ///         reserves, fee, seal, curve, anchors.
    function marketHash(uint256 key) external view returns (bytes32) {
        Market storage m = _marketOf[key];
        return keccak256(abi.encode(
            m.base, m.quote, m.rBase, m.rQuote, m.feeBps, m.sealUntil, m.curveBps, m.vBase, m.vQuote
        ));
    }

    /// @notice One base in quote, scaled by 1e18. Display only.
    function spot(uint256 key) external view returns (uint256) {
        Market storage m = _marketOf[key];
        return Curve.spot(m.rBase, m.rQuote, m.vBase, m.vQuote);
    }

    function openCount() external view returns (uint256) { return _open.length; }
    function sealedCount() external view returns (uint256) { return _sealed.length; }

    /// @notice A window of the ids that have an owned market, in no
    ///         particular order.
    function openIds(uint256 from, uint256 count) external view returns (uint256[] memory) {
        return _window(_open, from, count);
    }

    /// @notice A window of the sealed market keys, in no particular order.
    function sealedIds(uint256 from, uint256 count) external view returns (uint256[] memory) {
        return _window(_sealed, from, count);
    }

    function _window(uint256[] storage list, uint256 from, uint256 count)
        private view returns (uint256[] memory ids)
    {
        uint256 len = list.length;
        if (from >= len) return new uint256[](0);
        if (from + count > len) count = len - from;
        ids = new uint256[](count);
        for (uint256 i; i < count; ++i) ids[i] = list[from + i];
    }

    function _remember(uint256 id) private {
        _open.push(id);
        _openAt[id] = _open.length;
    }

    function _forget(uint256 id) private {
        uint256 idx = _openAt[id];
        if (idx == 0) return;
        uint256 last = _open[_open.length - 1];
        _open[idx - 1] = last;
        _openAt[last] = idx;
        _open.pop();
        delete _openAt[id];
    }

    function _sealedRemember(uint256 key) private {
        _sealed.push(key);
        _sealedAt[key] = _sealed.length;
    }

    /*═══════════════════ money, defensively ═══════════════════*/

    /// @dev Other markets' claims in `token`, which a payout from `m` may
    ///      never touch (C5). `m`'s own claim on that side is its reserve
    ///      plus, on a sealed market, the fees owed in it.
    function _others(Market storage m, address token, bool baseIn) private view returns (uint256) {
        uint256 claim = baseIn
            ? uint256(m.rQuote) + m.feeQuoteOwed
            : uint256(m.rBase) + m.feeBaseOwed;
        return totalReserved[token] - claim;
    }

    /// @dev What the balance can honour for one market on `token` once every
    ///      other market is made whole, capped at its own books.
    function _solventShare(address token, uint256 reserve) private view returns (uint256) {
        uint256 others = totalReserved[token] - reserve;
        uint256 bal = _balance(token);
        uint256 share = bal > others ? bal - others : 0;
        return share < reserve ? share : reserve;
    }

    function _balance(address token) private view returns (uint256) {
        return token == address(0) ? address(this).balance : IERC20(token).balanceOf(address(this));
    }

    /// @dev The one payout path. Refuses, with checked arithmetic, any
    ///      amount the balance cannot cover after everyone else's claim: a
    ///      token that rebased downward makes the cap zero and the market
    ///      fails closed until its holder writes it down. Measures what
    ///      arrived, so a floor is about the recipient.
    function _pay(address token, address to, uint256 amount, uint256 others) private returns (uint256 received) {
        uint256 bal = _balance(token);
        if (bal < others || amount > bal - others) revert Insolvent();
        if (token == address(0)) {
            _push(token, to, amount);
            return amount;
        }
        uint256 before_ = IERC20(token).balanceOf(to);
        _push(token, to, amount);
        uint256 after_ = IERC20(token).balanceOf(to);
        if (after_ < before_) revert TransferFailed();
        received = after_ - before_;
    }

    /// @dev Plenty of real tokens return nothing at all from transfer.
    ///      Accept an empty return, reject an explicit false.
    function _push(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            if (!ok) revert TransferFailed();
            return;
        }
        (bool ok2, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok2 || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    /// @dev A native leg is msg.value, already checked against the amount by
    ///      the caller; an ERC-20 leg is pulled and measured.
    function _take(address token, uint256 amount) private returns (uint256) {
        return token == address(0) ? amount : _pull(token, amount);
    }

    function _pull(address token, uint256 amount) private returns (uint256 received) {
        // a codeless "token" answers every call with nothing, which a raw
        // call reads as success; it has to be refused before it is trusted
        if (token.code.length == 0) revert TransferFailed();
        uint256 before_ = IERC20(token).balanceOf(address(this));
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, msg.sender, address(this), amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
        uint256 after_ = IERC20(token).balanceOf(address(this));
        if (after_ <= before_) revert ZeroAmount();
        received = after_ - before_;
    }

    function _u112(uint256 v) private pure returns (uint112) {
        if (v > Curve.MAX_RESERVE) revert ReserveOverflow();
        return uint112(v);
    }
}
