// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// Origin: ANIMA contracts/market/AgentLaunchpad.sol, adapted (INTACT U6):
// buyers hold credits instead of tokens until graduation, the quote is
// native ether, fee legs are immutable per launch and earned only by a
// graduation, `graduate` seeds a sealed market in the Pool at the terminal
// price, `fail`/`refund`/`claim` are new, the first-launch rule and the
// seven-day spacing are new, and OpenZeppelin's Ownable2Step/SafeERC20/
// ReentrancyGuardTransient/Math are replaced by nothing, ExactERC20,
// Transient and Mul. Load-bearing comments kept.

import {
    ILaunchpad, LaunchParams, Launch, LaunchState, Target
} from "./interfaces/ILaunchpad.sol";
import {IIntact} from "./interfaces/IIntact.sol";
import {IPool, Market} from "./interfaces/IPool.sol";
import {ILocks} from "./interfaces/ILocks.sol";
import {ICoin} from "./interfaces/IKiln.sol";
import {Rights, IRightsHub} from "./lib/Rights.sol";
import {Transient} from "./lib/Transient.sol";
import {ExactERC20, IERC20Exact} from "./lib/ExactERC20.sol";
import {Mul} from "./lib/Mul.sol";

/*───────────────────────────────────────────────────────────────────────────
  Launchpad — a fair-ish launch that leaves something behind

  Bonding-curve issuance for a Coin the Kiln made, graduating into a sealed
  market in the Pool once the curve fills. Four deliberate departures from
  the standard bonding-curve launchpad, each aimed at a specific way those
  launches extract from buyers:

    1. **A fair window with a per-address cap, and a tax priced by time.**
       The first blocks of a launch are where snipers take the entire
       cheap end of the curve and sell it back to everyone else. For a
       configurable opening period no address may buy more than
       `maxBuyInWindow`, and every buy pays a tax that starts at
       `snipeTaxStartBps` and decays linearly to zero at the window's end.
       The cap does not defeat a determined sybil, and pretending otherwise
       would be a lie — it raises the cost from "one bot, one transaction"
       to "many funded addresses". The tax does defeat the sybil, because it
       is priced by the clock and not by the address: splitting across
       wallets pays it once per wallet. It has no exemption list because
       there is no list.

    2. **Fee legs route into the token itself, and only at graduation.**
       `creatorBps` of a fee that is at most 1 % goes to `feeSink(id)` —
       the launching token's Reach, or its Grip if the holder said so —
       and the remainder plus the ENTIRE snipe tax goes to
       `Coin.contribute`, which raises the floor every holder can redeem
       at. There is no protocol leg: the mint price is the protocol's only
       revenue (brief MUST 34). Both legs are held here until the launch
       graduates, so a launch that fails returns every wei it was ever
       given — fees are earned by a graduation, not by a buy.

    3. **Buyers hold credits, not tokens.** Nothing ERC-20 moves while the
       curve is live: a buy writes `creditOf`, a sell burns it, `claim`
       hands over the coin after graduation and `refund` the ether after a
       failure. So there is no pre-launch transfer to a predicted pair
       (Four.meme, March 2025), nothing anyone can pre-initialise against,
       and a refund is exact.

    4. **Graduation is permissionless, price-faithful and locked.** Once
       `raised ≥ graduationTarget` anyone may `graduate`: the raise and
       exactly as much base as the curve's terminal price calls for seed a
       sealed market whose principal nobody can ever withdraw, the base
       that price does not need is burned (never a bag), and the two prices
       are emitted side by side. No withdraw or pause authority exists over
       curve funds — read the ABI: there is no such selector.

  Curve mechanics are constant-product over augmented reserves, with every
  rounding decision made against the trader. A curve that rounds in the
  trader's favour can be drained a wei at a time by a loop.

  ── one keeper for both kinds of launch ──

  The Kiln's instant coin and this contract's raise are two halves of one
  thing: a launch. The Kiln minting a coin IS the launch event — it calls
  `recordLaunch` here, which applies the first-launch rule and the
  seven-day spacing, extends the token's `launchRoot` (read by the
  fingerprint) and remembers the raise share the coin brought. `create`
  then spends that share, once. A coin whose share was spent, or that
  another token launched, is `WrongCoin`.

  ── per-launch isolation ──

  Every launch's ether is accounted separately (`raised` plus the two fee
  legs), `totalHeld` is their sum, and every payout path asserts
  `address(this).balance ≥ totalHeld` afterwards — so no launch can ever
  pay with another launch's raise (ANIMA 5d21694's class, which was a 102 %
  payout spilling into a neighbour's balance).
───────────────────────────────────────────────────────────────────────────*/
contract Launchpad is ILaunchpad {
    using ExactERC20 for address;

    /*═══════════════════ terms ═══════════════════*/

    uint64  public constant MAX_FAIR_WINDOW      = 1 days;
    /// @notice Not 100 %: a trade that returns nothing is indistinguishable
    ///         from a broken contract, and buyers should always get something.
    uint16  public constant MAX_SNIPE_TAX_BPS    = 9_900;
    uint16  public constant MAX_FEE_BPS          = 100;
    uint16  public constant MAX_CREATOR_BPS      = 1_500;
    uint16  public constant MAX_CREATOR_VEST_BPS = 1_500;
    uint64  public constant MAX_DEADLINE         = 30 days;
    uint64  public constant LAUNCH_SPACING       = 7 days;
    /// @notice The sealed market's fee (DESIGN.md §8.3).
    uint16  public constant SEALED_FEE_BPS       = 100;
    /// @notice The creator vest: cliff then linear, beneficiary the Reach.
    uint64  public constant VEST_CLIFF           = 30 days;
    uint64  public constant VEST_TERM            = 365 days;
    uint256 private constant BPS                 = 10_000;
    uint256 private constant ONE                 = 1e18;

    address public immutable HUB;
    address public immutable KILN;
    address public immutable POOL;
    address public immutable LOCKS;
    /// @notice `Target.UniswapV4` lands in an LPCustodian (DESIGN.md §8.4);
    ///         none exists in the MVB, so that target is `NotYet`.
    address public constant CUSTODIAN = address(0);

    /*  `NotKiln`, `NotEnoughCredit` and `Insolvent` were this contract's own
        until the wave-1 integration moved them into ILaunchpadEvents, so the
        Catalog's error table sees them (docs/INTERFACE-CHANGES.md).      */

    /*═══════════════════ storage ═══════════════════*/

    /// @dev The two fee legs a launch has accrued and not yet earned.
    struct Fees { uint128 creatorOwed; uint128 floorOwed; }
    /// @dev What a failed launch liquidates at: the whole pot (raise and
    ///      fees) over every credit outstanding, frozen at `fail`.
    struct Pot { uint128 pot; uint128 credits; }

    uint256 private _count;
    mapping(uint256 => Launch) private _launches;
    mapping(uint256 => Fees) private _fees;
    mapping(uint256 => Pot) private _pots;
    mapping(uint256 => mapping(address => uint256)) public creditOf;
    mapping(uint256 => mapping(address => uint256)) public boughtInWindow;
    mapping(uint256 => uint256[]) private _launchesOf;
    /// @notice Rolling hash of every launch event of a token; in the
    ///         fingerprint.
    mapping(uint256 => bytes32) public launchRoot;
    mapping(uint256 => uint64) public lastLaunchAt;
    /// @dev The custody epoch a guardian approved a first launch under.
    mapping(uint256 => uint64) private _firstLaunchEpoch;
    /// @dev coin → the raise share the Kiln minted here and `create` has
    ///      not yet spent; and coin → the token that launched it.
    mapping(address => uint256) private _pending;
    mapping(address => uint256) private _coinOf;
    /// @notice Σ over every launch of what this contract holds for it.
    uint256 public totalHeld;
    /// @notice The raised amount that closes a launch's curve. Beside the
    ///         record rather than in it: the interface's `Launch` struct is
    ///         frozen, and this is the one term it does not carry.
    mapping(uint256 => uint128) public graduationTargetOf;

    constructor(address hub, address kiln, address pool, address locks) {
        HUB = hub;
        KILN = kiln;
        POOL = pool;
        LOCKS = locks;
    }

    /*═══════════════════ the clock (called by the Kiln) ═══════════════════*/

    /// @notice The Kiln made a coin for `id`; apply the launch rules and
    ///         remember the share it minted here.
    /// @dev    `by` already passed `acts` in the Kiln; it is re-checked
    ///         because this is the function that grants the launch, and a
    ///         rule enforced in one place is a rule.
    function recordLaunch(uint256 id, address by, address coin, uint256 raiseShare) external {
        if (msg.sender != KILN) revert NotKiln();
        if (!Rights.acts(HUB, id, by)) revert NotActor();

        /*  The first launch of any token wants the holder — or, when the
            call comes from the Reach (an agent's session) and the token has
            a guardian, that guardian's one-time, epoch-stamped co-sign
            (brief §6.12). Thereafter scoped sessions with the spacing
            suffice.                                                      */
        if (launchRoot[id] == bytes32(0) && !Rights.holds(HUB, id, by)) {
            if (by != IRightsHub(HUB).account(id) || !firstLaunchApproved(id)) {
                revert FirstLaunchNeedsHolderOrGuardian(id);
            }
            delete _firstLaunchEpoch[id];
        }
        uint64 last = lastLaunchAt[id];
        if (last != 0 && block.timestamp < last + LAUNCH_SPACING) revert TooSoon(last + LAUNCH_SPACING);

        lastLaunchAt[id] = uint64(block.timestamp);
        launchRoot[id] = keccak256(abi.encode(
            launchRoot[id], coin, raiseShare, IIntact(HUB).custodyEpoch(id), block.timestamp
        ));
        if (raiseShare != 0) {
            _pending[coin] = raiseShare;
            _coinOf[coin] = id;
        }
    }

    /// @notice The token's guardian lets the Reach make the token's first
    ///         launch. Stamped with the custody epoch, so a sale voids it.
    function approveFirstLaunch(uint256 id) external {
        address guardian = IIntact(HUB).guardianOf(id);
        if (guardian == address(0) || msg.sender != guardian) revert NotGuardian();
        uint64 epoch = IIntact(HUB).custodyEpoch(id);
        _firstLaunchEpoch[id] = epoch;
        emit FirstLaunchApproved(id, guardian, epoch);
    }

    function firstLaunchApproved(uint256 id) public view returns (bool) {
        uint64 e = _firstLaunchEpoch[id];
        return e != 0 && e == IIntact(HUB).custodyEpoch(id);
    }

    /*═══════════════════ create ═══════════════════*/

    function create(LaunchParams calldata p) external returns (uint256 launchId) {
        return _create(p);
    }

    /// @notice `create`, refusing to proceed unless the terms are the ones
    ///         the page showed. The hash is over the whole parameter
    ///         struct, so a relay that rewrote one field (a session key
    ///         forwarding a form, a wallet that re-encoded it) is caught
    ///         before anything is written.
    function createChecked(LaunchParams calldata p, bytes32 expectedTermsHash) external returns (uint256 launchId) {
        bytes32 actual = termsHash(p);
        if (actual != expectedTermsHash) revert TermsMoved(expectedTermsHash, actual);
        return _create(p);
    }

    function _create(LaunchParams calldata p) private returns (uint256 launchId) {
        Transient.enter(Transient.LAUNCHPAD_LOCK);
        if (!Rights.acts(HUB, p.id, msg.sender)) revert NotActor();
        if (p.target != Target.OwnedPool) revert NotYet();

        uint256 share = _pending[p.coin];
        if (share == 0 || _coinOf[p.coin] != p.id) revert WrongCoin(p.coin);
        if (p.fairWindow > MAX_FAIR_WINDOW) revert FairWindowTooLong(p.fairWindow);
        if (p.snipeTaxStartBps > MAX_SNIPE_TAX_BPS) revert SnipeTaxTooHigh(p.snipeTaxStartBps);
        if (p.feeBps > MAX_FEE_BPS) revert FeeTooHigh(p.feeBps);
        if (p.creatorBps > MAX_CREATOR_BPS) revert CreatorShareTooHigh(p.creatorBps);
        if (p.creatorVestBps > MAX_CREATOR_VEST_BPS) revert CreatorShareTooHigh(p.creatorVestBps);

        // A backdated start puts `fairWindowEnds` in the past, so the
        // per-address cap is never consulted and the creator can take the
        // entire cheap end of the curve in one call — exactly what the fair
        // window exists to prevent. Zero means "now".
        uint64 startsAt = p.startsAt == 0 ? uint64(block.timestamp) : p.startsAt;
        if (startsAt < block.timestamp) revert StartsInThePast(p.startsAt);
        if (p.deadline <= startsAt) revert DeadlinePassed(p.deadline);
        if (p.deadline > block.timestamp + MAX_DEADLINE) revert DeadlineTooFar(p.deadline);

        // The curve must never be able to drain the base reserve to zero:
        // constant product sends price to infinity there, and integer
        // division would start returning nothing. The liquidity supply is
        // what stays in the reserve when the curve has sold everything it
        // may, and it must be positive.
        uint256 vest = Mul.mulDivDown(share, p.creatorVestBps, BPS);
        if (p.curveSupply == 0 || p.virtualQuote == 0 || p.graduationTarget == 0
            || uint256(p.curveSupply) + vest >= share) revert BadCurveParameters();
        uint256 liquidity = share - p.curveSupply - vest;

        delete _pending[p.coin];
        launchId = ++_count;

        Launch storage l = _launches[launchId];
        l.id = p.id;
        l.coin = p.coin;
        l.target = p.target;
        l.state = LaunchState.Live;
        l.quoteReserve = p.virtualQuote;
        l.baseReserve = _u128(uint256(p.curveSupply) + liquidity);
        l.curveSupply = p.curveSupply;
        l.liquiditySupply = _u128(liquidity);
        l.startsAt = startsAt;
        l.fairWindowEnds = startsAt + p.fairWindow;
        l.deadline = p.deadline;
        l.maxBuyInWindow = p.maxBuyInWindow;
        l.snipeTaxStartBps = p.snipeTaxStartBps;
        l.feeBps = p.feeBps;
        l.creatorBps = p.creatorBps;
        l.termsHash = termsHash(p);
        l.epoch = IIntact(HUB).custodyEpoch(p.id);
        graduationTargetOf[launchId] = p.graduationTarget;

        _launchesOf[p.id].push(launchId);
        launchRoot[p.id] = keccak256(abi.encode(launchRoot[p.id], launchId, l.termsHash));

        /*  The creator's vest is a lock, never a tax exemption: cliff then
            linear, to the token's Reach, pulled by Locks by exact delta.
            The allowance is exact and zeroed in the same call — a standing
            allowance would be a claim on the next launch's share.        */
        if (vest != 0) {
            if (vest > type(uint112).max) revert BadCurveParameters();
            address reach = IRightsHub(HUB).account(p.id);
            uint64 now_ = uint64(block.timestamp);
            p.coin.approveExact(LOCKS, vest);
            ILocks(LOCKS).lock(p.coin, uint112(vest), reach, now_, now_ + VEST_CLIFF, now_ + VEST_TERM, true);
            p.coin.approveExact(LOCKS, 0);
        }

        emit LaunchCreated(launchId, p.id, p.coin, p.target, l.termsHash);
        Transient.exit(Transient.LAUNCHPAD_LOCK);
    }

    /*═══════════════════ trading ═══════════════════*/

    function buy(uint256 launchId, uint256 minBaseOut, uint64 deadline, uint16 maxFeeBps)
        external payable returns (uint256 baseOut)
    {
        Transient.enter(Transient.LAUNCHPAD_LOCK);
        Launch storage l = _live(launchId);
        if (block.timestamp > deadline) revert Expired();
        uint256 quoteIn = msg.value;
        if (quoteIn == 0) revert ZeroAmount();

        (uint256 fee, uint256 snipe, uint256 effBps) = _buyFee(l, quoteIn);
        if (effBps > maxFeeBps) revert FeeTooHigh(uint16(effBps));
        // The clamp keeps the bps under 99 %; rounding both legs up can
        // still eat a dust-sized buy whole, and a buy that leaves nothing
        // for the curve is refused rather than priced at nothing.
        if (fee + snipe >= quoteIn) revert ZeroAmount();
        uint256 netIn = quoteIn - fee - snipe;

        uint256 q = l.quoteReserve;
        uint256 b = l.baseReserve;
        uint256 newQuote = q + netIn;
        // Round the reserve UP so the trader receives less, never more, than
        // the curve owes.
        uint256 newBase = Mul.mulDivUp(q, b, newQuote);
        baseOut = b - newBase;
        if (baseOut == 0) revert ZeroAmount();
        if (baseOut < minBaseOut) revert SlippageExceeded(baseOut, minBaseOut);

        uint256 sold = uint256(l.baseSold) + baseOut;
        if (sold > l.curveSupply) revert CurveExhausted(sold, l.curveSupply);

        if (block.timestamp < l.fairWindowEnds) {
            uint256 already = boughtInWindow[launchId][msg.sender] + netIn;
            if (already > l.maxBuyInWindow) revert FairWindowCapExceeded(already, l.maxBuyInWindow);
            boughtInWindow[launchId][msg.sender] = already;
        }

        l.quoteReserve = _u128(newQuote);
        l.baseReserve = uint128(newBase);
        l.baseSold = uint128(sold);
        l.raised = _u128(uint256(l.raised) + netIn);
        creditOf[launchId][msg.sender] += baseOut;
        _accrue(launchId, l, fee, snipe);
        totalHeld += quoteIn;

        emit Bought(launchId, msg.sender, quoteIn, baseOut, fee, snipe);
        Transient.exit(Transient.LAUNCHPAD_LOCK);
    }

    function sell(uint256 launchId, uint256 baseIn, uint256 minQuoteOut, uint64 deadline)
        external returns (uint256 quoteOut)
    {
        Transient.enter(Transient.LAUNCHPAD_LOCK);
        Launch storage l = _live(launchId);
        if (block.timestamp > deadline) revert Expired();
        if (baseIn == 0) revert ZeroAmount();
        uint256 have = creditOf[launchId][msg.sender];
        if (have < baseIn) revert NotEnoughCredit(have, baseIn);

        uint256 q = l.quoteReserve;
        uint256 b = l.baseReserve;
        uint256 newBase = b + baseIn;
        // Same direction of rounding: the reserve keeps the dust.
        uint256 newQuote = Mul.mulDivUp(q, b, newBase);
        uint256 gross = q - newQuote;
        uint256 fee = Mul.mulDivUp(gross, l.feeBps, BPS);
        if (gross <= fee) revert ZeroAmount();
        quoteOut = gross - fee;
        if (quoteOut < minQuoteOut) revert SlippageExceeded(quoteOut, minQuoteOut);

        creditOf[launchId][msg.sender] = have - baseIn;
        l.quoteReserve = uint128(newQuote);
        l.baseReserve = _u128(newBase);
        l.baseSold = uint128(uint256(l.baseSold) - baseIn);
        l.raised = uint128(uint256(l.raised) - gross);
        _accrue(launchId, l, fee, 0);
        totalHeld -= quoteOut;

        _push(msg.sender, quoteOut);
        _solvent();
        emit Sold(launchId, msg.sender, baseIn, quoteOut, fee);
        Transient.exit(Transient.LAUNCHPAD_LOCK);
    }

    /// @dev Fees are skimmed from the quote leg: the base fee split between
    ///      the creator leg and the floor leg, plus the decaying opening tax
    ///      which goes entirely to the floor — value a sniper gives up
    ///      should land with the people they were trying to take it from.
    ///      Both legs round up (against the trader) and are HELD, not paid:
    ///      see `graduate` and `fail`.
    function _buyFee(Launch storage l, uint256 amount)
        private view returns (uint256 fee, uint256 snipe, uint256 effBps)
    {
        uint256 baseBps = l.feeBps;
        uint256 snipeBps = _snipeTaxBps(l);
        // Clamp the opening tax so base fee plus tax can never reach 100 %.
        // Without this a 99 % tax on top of a 1 % base would try to pay out
        // 100 % of the trade, and with 3 % it paid 102 % — out of another
        // launch's raise, since launches share this contract's balance.
        if (baseBps + snipeBps > MAX_SNIPE_TAX_BPS) snipeBps = MAX_SNIPE_TAX_BPS - baseBps;
        fee = Mul.mulDivUp(amount, baseBps, BPS);
        snipe = Mul.mulDivUp(amount, snipeBps, BPS);
        effBps = baseBps + snipeBps;
    }

    function _accrue(uint256 launchId, Launch storage l, uint256 fee, uint256 snipe) private {
        if (fee == 0 && snipe == 0) return;
        uint256 creatorCut = Mul.mulDivDown(fee, l.creatorBps, BPS);
        Fees storage f = _fees[launchId];
        f.creatorOwed = _u128(uint256(f.creatorOwed) + creatorCut);
        f.floorOwed = _u128(uint256(f.floorOwed) + (fee - creatorCut) + snipe);
    }

    /// @notice The anti-snipe tax in force right now: `snipeTaxStartBps` at
    ///         the opening block, decaying linearly to zero at the end of
    ///         the fair window.
    /// @dev Priced by time rather than by identity, which is why splitting
    ///      across addresses does not help — the defect in every per-address
    ///      cap.
    function snipeTaxBps(uint256 launchId) external view returns (uint256) {
        return _snipeTaxBps(_launches[launchId]);
    }

    function _snipeTaxBps(Launch storage l) private view returns (uint256) {
        uint16 start = l.snipeTaxStartBps;
        if (start == 0 || block.timestamp >= l.fairWindowEnds) return 0;
        if (block.timestamp <= l.startsAt) return start;
        uint256 window = uint256(l.fairWindowEnds) - l.startsAt;
        uint256 remaining = uint256(l.fairWindowEnds) - block.timestamp;
        return (uint256(start) * remaining) / window;
    }

    /*═══════════════════ graduation and failure ═══════════════════*/

    /// @notice Close the curve and move the raise into a sealed market.
    ///         Permissionless once the target is met — graduation must not
    ///         depend on the creator showing up.
    /// @dev The market opens at the curve's terminal price: `raised` ether
    ///      against exactly `raised · b / q` base, where `q / b` is the
    ///      curve's last price. Any base the free reserve holds beyond that
    ///      is burned, so nobody — not the launcher, not this contract — is
    ///      left holding a bag priced by a market they did not pay into.
    ///      The sealed market's principal can never be withdrawn and its
    ///      fees pay `feeSink(id)` through `Pool.collect`, so selling the
    ///      Intact sells the launch's fee stream.
    function graduate(uint256 launchId) external {
        Transient.enter(Transient.LAUNCHPAD_LOCK);
        Launch storage l = _exists(launchId);
        if (l.state == LaunchState.Graduated) revert AlreadyGraduated(launchId);
        if (l.state != LaunchState.Live) revert NotLive(launchId);
        if (!_graduatable(launchId, l)) revert NotGraduatable(launchId);
        if (l.target != Target.OwnedPool) revert NotYet();

        l.state = LaunchState.Graduated;
        Fees memory f = _fees[launchId];
        delete _fees[launchId];

        uint256 raised = l.raised;
        uint256 q = l.quoteReserve;
        uint256 b = l.baseReserve;
        address coin = l.coin;
        totalHeld -= raised + f.creatorOwed + f.floorOwed;

        uint256 amountBase = Mul.mulDivDown(raised, b, q);
        if (amountBase == 0) revert NotGraduatable(launchId);

        /*  The Pool pulls the base by exact amount, measured on arrival. The
            allowance is exact, zeroed in the same call, and the delta is
            re-measured here: a leftover allowance would be a standing claim
            on the next launch's share, and a pool that pulled a different
            amount than it was told would price the market off the curve. */
        uint256 before = IERC20Exact(coin).balanceOf(address(this));
        coin.approveExact(POOL, amountBase);
        uint256 key = IPool(POOL).openSealed{value: raised}(
            _launchKey(launchId), coin, address(0), SEALED_FEE_BPS, amountBase, l.id
        );
        coin.approveExact(POOL, 0);
        if (before - IERC20Exact(coin).balanceOf(address(this)) != amountBase) revert TransferFailed();
        l.marketKey = key;

        uint256 leftover = b - amountBase;
        if (leftover != 0) ICoin(coin).burn(leftover);

        // The fee legs, now earned.
        if (f.creatorOwed != 0) _push(IIntact(HUB).feeSink(l.id), f.creatorOwed);
        if (f.floorOwed != 0) ICoin(coin).contribute{value: f.floorOwed}();
        _solvent();

        launchRoot[l.id] = keccak256(abi.encode(launchRoot[l.id], launchId, LaunchState.Graduated, key));
        emit Graduated(launchId, key, Mul.mulDivDown(q, ONE, b), _spotOf(key));
        Transient.exit(Transient.LAUNCHPAD_LOCK);
    }

    /// @notice The deadline passed short of the target: open refunds and
    ///         send the supply home to the token's Reach. Anyone.
    function fail(uint256 launchId) external {
        Transient.enter(Transient.LAUNCHPAD_LOCK);
        Launch storage l = _exists(launchId);
        if (l.state != LaunchState.Live || block.timestamp <= l.deadline || _graduatable(launchId, l)) {
            revert NotFailable(launchId);
        }
        l.state = LaunchState.Failed;
        Fees memory f = _fees[launchId];
        delete _fees[launchId];

        /*  The whole pot — the raise and both fee legs — against every
            credit outstanding. Credits are the only claims on a failed
            launch, and pro-rata over them is the one rule that pays out
            exactly the pot: a per-buyer "what you paid" ledger goes
            negative for a seller who profited from a later buyer, and a
            ledger clamped at zero promises more than the pot holds.    */
        _pots[launchId] = Pot({
            pot: _u128(uint256(l.raised) + f.creatorOwed + f.floorOwed),
            credits: l.baseSold
        });
        uint256 back = uint256(l.curveSupply) + l.liquiditySupply;
        l.coin.transferExact(IRightsHub(HUB).account(l.id), back);

        launchRoot[l.id] = keccak256(abi.encode(launchRoot[l.id], launchId, LaunchState.Failed, uint256(0)));
        emit LaunchFailed(launchId);
        Transient.exit(Transient.LAUNCHPAD_LOCK);
    }

    /// @notice Pay a failed launch's buyer their share of the pot. Anyone
    ///         may pay the gas; the recipient is fixed.
    function refund(uint256 launchId, address buyer) external {
        Transient.enter(Transient.LAUNCHPAD_LOCK);
        Launch storage l = _exists(launchId);
        if (l.state != LaunchState.Failed) revert NothingToClaim();
        uint256 credit = creditOf[launchId][buyer];
        if (credit == 0) revert NothingToClaim();
        Pot memory p = _pots[launchId];
        uint256 amount = Mul.mulDivDown(p.pot, credit, p.credits);

        creditOf[launchId][buyer] = 0;
        totalHeld -= amount;
        _push(buyer, amount);
        _solvent();
        emit Refunded(launchId, buyer, amount);
        Transient.exit(Transient.LAUNCHPAD_LOCK);
    }

    /// @notice Hand a graduated launch's buyer the coin their credits name.
    ///         Anyone may pay the gas; the recipient is fixed.
    function claim(uint256 launchId, address buyer) external {
        Transient.enter(Transient.LAUNCHPAD_LOCK);
        Launch storage l = _exists(launchId);
        if (l.state != LaunchState.Graduated) revert NothingToClaim();
        uint256 credit = creditOf[launchId][buyer];
        if (credit == 0) revert NothingToClaim();

        creditOf[launchId][buyer] = 0;
        l.coin.transferExact(buyer, credit);
        emit Claimed(launchId, buyer, credit);
        Transient.exit(Transient.LAUNCHPAD_LOCK);
    }

    /*═══════════════════ reading ═══════════════════*/

    function launchOf(uint256 launchId) external view returns (Launch memory) {
        return _launches[launchId];
    }

    function launchesOf(uint256 id) external view returns (uint256[] memory) {
        return _launchesOf[id];
    }

    function launchCount() external view returns (uint256) {
        return _count;
    }

    function raisedOf(uint256 launchId) external view returns (uint256) {
        return _launches[launchId].raised;
    }

    /// @notice What the page hashes to pin a form: the whole struct.
    function termsHash(LaunchParams calldata p) public pure returns (bytes32) {
        return keccak256(abi.encode(p));
    }

    function quoteBuy(uint256 launchId, uint256 quoteIn)
        external view returns (uint256 baseOut, uint256 fee, uint256 snipe)
    {
        Launch storage l = _launches[launchId];
        (fee, snipe, ) = _buyFee(l, quoteIn);
        if (fee + snipe >= quoteIn) return (0, fee, snipe);
        uint256 q = l.quoteReserve;
        uint256 b = l.baseReserve;
        baseOut = b - Mul.mulDivUp(q, b, q + (quoteIn - fee - snipe));
    }

    function quoteSell(uint256 launchId, uint256 baseIn) external view returns (uint256 quoteOut, uint256 fee) {
        Launch storage l = _launches[launchId];
        uint256 q = l.quoteReserve;
        uint256 b = l.baseReserve;
        uint256 gross = q - Mul.mulDivUp(q, b, b + baseIn);
        fee = Mul.mulDivUp(gross, l.feeBps, BPS);
        quoteOut = gross > fee ? gross - fee : 0;
    }

    /// @notice The curve's price right now, in wei per 1e18 base units —
    ///         after graduation, the terminal price the market opened at.
    function priceOf(uint256 launchId) external view returns (uint256) {
        Launch storage l = _launches[launchId];
        return l.baseReserve == 0 ? 0 : Mul.mulDivDown(l.quoteReserve, ONE, l.baseReserve);
    }

    /// @notice The two fee legs a live launch has accrued and not yet earned.
    function feesHeld(uint256 launchId) external view returns (uint256 creatorOwed, uint256 floorOwed) {
        Fees storage f = _fees[launchId];
        return (f.creatorOwed, f.floorOwed);
    }

    /// @notice The key `graduate` names a launch's sealed market by.
    function launchKey(uint256 launchId) external view returns (bytes32) {
        return _launchKey(launchId);
    }

    /*═══════════════════ internals ═══════════════════*/

    function _launchKey(uint256 launchId) private view returns (bytes32) {
        return keccak256(abi.encode(address(this), launchId));
    }

    function _graduatable(uint256 launchId, Launch storage l) private view returns (bool) {
        return l.raised >= graduationTargetOf[launchId] || l.baseSold >= l.curveSupply;
    }

    function _exists(uint256 launchId) private view returns (Launch storage l) {
        l = _launches[launchId];
        if (l.coin == address(0)) revert NoSuchLaunch(launchId);
    }

    function _live(uint256 launchId) private view returns (Launch storage l) {
        l = _exists(launchId);
        if (l.state == LaunchState.Graduated) revert AlreadyGraduated(launchId);
        if (l.state != LaunchState.Live) revert NotLive(launchId);
        if (block.timestamp < l.startsAt) revert NotStarted(l.startsAt);
        if (block.timestamp > l.deadline) revert DeadlinePassed(l.deadline);
    }

    /// @dev The market's spot the way the page computes it: quote per 1e18
    ///      base over the anchored reserves.
    function _spotOf(uint256 key) private view returns (uint256) {
        Market memory m = IPool(POOL).marketOf(key);
        uint256 base = uint256(m.rBase) + m.vBase;
        return base == 0 ? 0 : Mul.mulDivDown(uint256(m.rQuote) + m.vQuote, ONE, base);
    }

    function _push(address to, uint256 amount) private {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @dev Isolation, asserted: this contract can never hold less than the
    ///      sum of what it holds for every launch.
    function _solvent() private view {
        if (address(this).balance < totalHeld) revert Insolvent();
    }

    function _u128(uint256 v) private pure returns (uint128) {
        if (v > type(uint128).max) revert BadCurveParameters();
        return uint128(v);
    }
}
