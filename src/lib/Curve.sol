// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Mul} from "./Mul.sol";

/*───────────────────────────────────────────────────────────────────────────
  CURVE — a hyperbola with a change of origin

  Origin: IPSEITY src/lib/Curve.sol, adapted for INTACT (U3). The pricing
  half is kept exactly; the half that read a 4-D section word (the SLICE
  and FALLOFF tables, `cutDirection`, `concentration(word)`) is gone,
  because INTACT's curve is not the artwork: it is a concentration the
  holder sets as the ERC-7496 `curve` trait and applies to the market with
  `Pool.syncCurve(id, bps, expected)` (DESIGN.md §6.1, decision 9). What
  was a function of the picture is now a number in basis points, and the
  rest of this file never cared which.

  A pool needs an invariant: a rule saying what combinations of the two
  reserves are equivalent, so that any trade can be priced by moving along
  it. The plain constant product is x·y = k. This one is

      (x + vx)·(y + vy) = k

  where vx and vy are *virtual* reserves — liquidity the curve prices
  against but does not actually hold. Adding them flattens the curve near
  the current price, which is what a market maker means by "concentrating"
  liquidity: trades near the middle move the price less, and the same
  inventory does more work.

      concentration 0        →  vx, vy = 0      →  plain constant product
      concentration 80,000   →  vx, vy = 8×real →  a tight market that
                                                    holds its price

  ── why this family and not a prettier one ──

  An invariant has to be monotonic and convex or a trader can walk the
  curve back on itself and take the reserves for nothing. This family is
  constant product with a change of origin, so it inherits constant
  product's proof: the invariant is a hyperbola for every legal parameter,
  and no concentration the holder can set will bend it into a shape that
  leaks.

  The one thing virtual reserves do break is the guarantee that the pool
  can pay. A curve that prices against liquidity it does not hold will
  happily quote an output larger than the real balance. That is not fixed
  by cleverness, it is fixed by refusing the trade — see MAX_OUT_BPS in
  Pool.sol. The pool has a maximum trade size, and says so.

  ── anchoring, not deriving ──

  `anchor` is called when liquidity or the curve changes and the result is
  stored; it is never called from a trade. It used to be called on every
  quote, from the live reserves, and that was a critical bug: virtual
  reserves proportional to live reserves re-anchor the curve after every
  trade, so k is conserved *within* a trade and not *across* two, and
  buying then selling straight back extracted the difference. At 8×
  concentration and a trade worth a third of the reserve, 400 units in
  came back as 718. The fuzz suite found it (tools/fuzz.mjs, "a round trip
  never profits"). Held as an offset, the curve stays where it was put.

  ── rounding ──

  Every division here goes through Mul.mulDivDown or Mul.mulDivUp so the
  direction is written at the call site: the pool's remaining balance
  rounds UP (the trader never gains the dust), the input a trader must
  supply rounds UP, the net-of-fee input rounds DOWN. `amountIn` is the
  inverse of `amountOut` under those roundings, and the proof that it
  never under-charges is in the comment above it.
───────────────────────────────────────────────────────────────────────────*/
library Curve {
    /// @dev Reserves are uint112 as in Uniswap v2, so x + vx stays under
    ///      2^116 and the product under 2^232 with room to spare.
    uint256 internal constant MAX_RESERVE = type(uint112).max;

    /// @dev Virtual reserves cap at 8x real. Beyond that the curve is so
    ///      flat that the maximum payable trade becomes uselessly small.
    uint256 internal constant MAX_CONCENTRATION = 80_000;   // 8.0000x, in bps
    uint256 internal constant BPS = 10_000;

    error NoLiquidity();
    error ZeroInput();
    error CurveTooSteep();

    /// @notice The offsets a market anchors to, computed once from the
    ///         reserves as they stand at that moment.
    /// @dev    ANCHORING, not deriving: called when liquidity or the curve
    ///         changes and the result is stored; never called from a trade.
    ///         The offsets fit a uint128 with room: 8 × (2^112 − 1) < 2^116.
    function anchor(uint256 curveBps, uint256 rBase, uint256 rQuote)
        internal pure returns (uint256 vBase, uint256 vQuote)
    {
        if (curveBps > MAX_CONCENTRATION) revert CurveTooSteep();
        vBase = Mul.mulDivDown(rBase, curveBps, BPS);
        vQuote = Mul.mulDivDown(rQuote, curveBps, BPS);
    }

    /*───────────────── pricing ─────────────────*/

    /// @notice How much comes out for `amountIn` going in.
    /// @dev    The fee is taken off the amount used for pricing but the whole
    ///         input still lands in the reserves, so k rises on every trade
    ///         and the fee accrues to whoever holds the token. Rounding is
    ///         always toward the pool.
    /// @param vIn  the anchored offset on the incoming side
    /// @param vOut the anchored offset on the outgoing side
    /// @dev   Both are passed in rather than derived. The caller holds them;
    ///        see `anchor` for why that distinction is the whole ballgame.
    function amountOut(
        uint256 amountIn_,
        uint256 rIn,
        uint256 rOut,
        uint256 vIn,
        uint256 vOut,
        uint256 feeBps
    ) internal pure returns (uint256 out) {
        if (amountIn_ == 0) revert ZeroInput();
        if (rIn == 0 || rOut == 0) revert NoLiquidity();

        uint256 x = rIn + vIn;
        uint256 y = rOut + vOut;

        uint256 inAfterFee = Mul.mulDivDown(amountIn_, BPS - feeBps, BPS);
        uint256 xNew = x + inAfterFee;

        // round the pool's remaining balance up, so the trader never gains
        // the rounding dust: yNew = ceil(x·y / xNew)
        uint256 yNew = Mul.mulDivUp(x, y, xNew);
        out = y > yNew ? y - yNew : 0;
    }

    /// @notice How much must go in for exactly `amountOut` to come out.
    /// @dev    The inverse of `amountOut` under the same roundings, and it
    ///         never under-charges. Proof: let xNew = ceil(x·y / (y − out)),
    ///         netIn = xNew − x and in = ceil(netIn · BPS / (BPS − fee)).
    ///         Then floor(in · (BPS − fee) / BPS) ≥ netIn, so pricing `in`
    ///         through `amountOut` reaches x' ≥ xNew, and ceil(x·y / x') ≤
    ///         y − out, which pays at least `out`. The reserves after the
    ///         trade satisfy (x + in)(y − out) ≥ xNew · (y − out) ≥ x·y, so
    ///         k never falls on this path either.
    function amountIn(
        uint256 amountOut_,
        uint256 rIn,
        uint256 rOut,
        uint256 vIn,
        uint256 vOut,
        uint256 feeBps
    ) internal pure returns (uint256 inNeeded) {
        if (amountOut_ == 0) revert ZeroInput();
        if (rIn == 0 || rOut == 0) revert NoLiquidity();

        uint256 x = rIn + vIn;
        uint256 y = rOut + vOut;
        // the priced reserve cannot be emptied; the Pool's MAX_OUT_BPS guard
        // refuses long before this, so this is the library's own floor
        if (amountOut_ >= y) revert NoLiquidity();

        uint256 yNew = y - amountOut_;
        // the incoming side after the trade, rounded up: the trader covers
        // the dust. xNew > x strictly, because x·y / yNew > x.
        uint256 xNew = Mul.mulDivUp(x, y, yNew);
        uint256 netIn = xNew - x;
        // gross up for the fee, again rounding against the trader
        inNeeded = Mul.mulDivUp(netIn, BPS, BPS - feeBps);
    }

    /// @notice What one unit of the input side is worth right now, scaled by
    ///         1e18. For display only — a real trade moves the price.
    function spot(uint256 rIn, uint256 rOut, uint256 vIn, uint256 vOut)
        internal pure returns (uint256)
    {
        if (rIn == 0 || rOut == 0) return 0;
        return Mul.mulDivDown(rOut + vOut, 1e18, rIn + vIn);
    }

    /// @notice The invariant, for tests that need to prove it never falls.
    /// @dev    Takes the anchored offsets, so what it measures is the
    ///         quantity trading actually conserves rather than a quantity
    ///         that moves underneath it.
    function invariant(uint256 rIn, uint256 rOut, uint256 vIn, uint256 vOut)
        internal pure returns (uint256)
    {
        return (rIn + vIn) * (rOut + vOut);
    }
}
