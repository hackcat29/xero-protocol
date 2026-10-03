// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IXeroMath} from "../interfaces/IXeroMath.sol";

/// @title XeroMathLib
/// @notice Fixed-point math for maturity-aware Yield Token markets.
///
/// Pricing model
/// -------------
/// A Yield Token (YT) entitles its holder to the reinvested dividends earned by one vault unit until
/// maturity. The pool quotes an *implied rate* `r` (quote asset per YT per year); the YT price is
/// `r * tau` where `tau` is the time to maturity in years. The rate moves with the pool's YT proportion `p`:
///
///     r(p) = anchor - ln(p / (1 - p)) / scalar
///
/// so selling YT into the pool (raising `p`) lowers the implied rate, and buying YT raises it.
/// Because price = r * tau, the strip's value decays towards zero as maturity approaches even when
/// nobody trades, so LPs are not arbitraged by the passage of time (unlike a constant-product pool).
/// `anchor` is re-derived before every trade so the rate is continuous with the last traded rate.
/// Following Pendle, the execution rate is evaluated at the post-trade proportion measured against
/// the pre-trade pool size. The proportion is measured in value at a fixed per-pool `refPrice`.
///
/// Every operation below is mirrored exactly (same order, same truncation) by the Stylus engine in
/// `stylus/xero-math`, and the two are checked against shared test vectors.
library XeroMathLib {
    int256 internal constant WAD = 1e18;
    uint256 internal constant UWAD = 1e18;
    int256 internal constant LN2 = 693147180559945309;

    uint256 internal constant MIN_P = 0.02e18;
    uint256 internal constant MAX_P = 0.98e18;
    uint256 internal constant MAX_ITERS = 128;
    uint256 internal constant REL_TOL = 1e12;

    uint8 internal constant E_LN_DOMAIN = 1;
    uint8 internal constant E_EXPIRED = 2;
    uint8 internal constant E_ZERO = 3;
    uint8 internal constant E_PROPORTION = 4;
    uint8 internal constant E_RATE = 5;
    uint8 internal constant E_LIQUIDITY = 6;
    uint8 internal constant E_CURVE = 7;
    uint8 internal constant E_PARAM = 8;

    /// @dev ln(x) for WAD x via range reduction to [1, 2) and the atanh series
    ///      ln(m) = 2 * (z + z^3/3 + z^5/5 + ...), z = (m - 1) / (m + 1) <= 1/3.
    function lnWad(int256 x) internal pure returns (int256) {
        if (x <= 0) revert IXeroMath.MathError(E_LN_DOMAIN);
        uint256 ux = uint256(x);
        int256 k = 0;
        while (ux >= 2 * UWAD) {
            ux >>= 1;
            k++;
        }
        while (ux < UWAD) {
            ux <<= 1;
            k--;
        }
        int256 z = int256((ux - UWAD) * UWAD / (ux + UWAD));
        int256 z2 = z * z / WAD;
        int256 term = z;
        int256 sum = 0;
        int256 d = 1;
        while (term != 0) {
            sum += term / d;
            term = term * z2 / WAD;
            d += 2;
        }
        return k * LN2 + 2 * sum;
    }

    function logit(uint256 p) internal pure returns (int256) {
        return lnWad(int256(p * UWAD / (UWAD - p)));
    }

    function rateAt(int256 anchor, int256 scalar, uint256 p) internal pure returns (int256) {
        return anchor - logit(p) * WAD / scalar;
    }

    function anchorOf(uint256 x, uint256 y, uint256 refPrice, int256 lastRate, int256 scalar)
        internal
        pure
        returns (int256 anchor, uint256 denom)
    {
        if (scalar <= 0 || refPrice == 0) revert IXeroMath.MathError(E_PARAM);
        uint256 xv = x * refPrice / UWAD;
        denom = xv + y;
        if (xv == 0 || y == 0) revert IXeroMath.MathError(E_LIQUIDITY);
        uint256 p0 = xv * UWAD / denom;
        anchor = lastRate + logit(p0) * WAD / scalar;
    }

    function postRate(int256 anchor, int256 scalar, uint256 x1, uint256 y1, uint256 refPrice)
        internal
        pure
        returns (int256)
    {
        uint256 xv = x1 * refPrice / UWAD;
        return rateAt(anchor, scalar, xv * UWAD / (xv + y1));
    }

    function swapExactYtIn(
        uint256 x,
        uint256 y,
        uint256 refPrice,
        int256 lastRate,
        int256 scalar,
        uint256 tau,
        uint256 fee,
        uint256 ytIn
    ) internal pure returns (uint256 quoteOut, int256 newRate) {
        if (tau == 0) revert IXeroMath.MathError(E_EXPIRED);
        if (ytIn == 0) revert IXeroMath.MathError(E_ZERO);
        if (fee >= UWAD) revert IXeroMath.MathError(E_PARAM);
        Ctx memory c;
        (c.anchor, c.denom) = anchorOf(x, y, refPrice, lastRate, scalar);
        (c.scalar, c.x, c.refPrice, c.tau) = (scalar, x, refPrice, tau);
        quoteOut = _sellProceeds(c, ytIn, fee);
        if (quoteOut >= y) revert IXeroMath.MathError(E_LIQUIDITY);
        newRate = postRate(c.anchor, scalar, x + ytIn, y - quoteOut, refPrice);
    }

    function swapExactQuoteIn(
        uint256 x,
        uint256 y,
        uint256 refPrice,
        int256 lastRate,
        int256 scalar,
        uint256 tau,
        uint256 fee,
        uint256 quoteIn
    ) internal pure returns (uint256 ytOut, int256 newRate) {
        if (tau == 0) revert IXeroMath.MathError(E_EXPIRED);
        if (quoteIn == 0) revert IXeroMath.MathError(E_ZERO);
        if (fee >= UWAD) revert IXeroMath.MathError(E_PARAM);
        Ctx memory c;
        (c.anchor, c.denom) = anchorOf(x, y, refPrice, lastRate, scalar);
        (c.scalar, c.x, c.refPrice, c.tau) = (scalar, x, refPrice, tau);
        ytOut = _solveBuy(c, quoteIn * (UWAD - fee) / UWAD);
        newRate = postRate(c.anchor, scalar, x - ytOut, y + quoteIn, refPrice);
    }

    /// @dev Largest `d` with cost(d) <= net, keeping the YT proportion at or above MIN_P.
    ///      cost(d) is strictly increasing in d, so bisection converges.
    function _solveBuy(Ctx memory c, uint256 net) private pure returns (uint256 lo) {
        uint256 xMin = MIN_P * c.denom / UWAD * UWAD / c.refPrice + 1;
        if (c.x <= xMin) revert IXeroMath.MathError(E_LIQUIDITY);
        uint256 hi = c.x - xMin;
        if (_cost(c, hi) < net) revert IXeroMath.MathError(E_LIQUIDITY);
        for (uint256 i = 0; i < MAX_ITERS; ++i) {
            uint256 width = hi - lo;
            if (width <= 1 || width <= hi / REL_TOL) break;
            uint256 mid = lo + width / 2;
            if (_cost(c, mid) <= net) lo = mid;
            else hi = mid;
        }
        if (lo == 0) revert IXeroMath.MathError(E_ZERO);
    }

    function forwardRates(uint256[] memory taus, uint256[] memory values)
        internal
        pure
        returns (int256[] memory forwards)
    {
        uint256 n = taus.length;
        if (n == 0 || values.length != n || taus[0] == 0) revert IXeroMath.MathError(E_CURVE);
        forwards = new int256[](n);
        forwards[0] = int256(values[0] * UWAD / taus[0]);
        for (uint256 i = 1; i < n; ++i) {
            if (taus[i] <= taus[i - 1]) revert IXeroMath.MathError(E_CURVE);
            forwards[i] = (int256(values[i]) - int256(values[i - 1])) * WAD / int256(taus[i] - taus[i - 1]);
        }
    }

    struct Ctx {
        int256 anchor;
        int256 scalar;
        uint256 x;
        uint256 refPrice;
        uint256 denom;
        uint256 tau;
    }

    /// @dev Quote paid for `ytIn` YT, executed at the rate of the post-trade proportion.
    function _sellProceeds(Ctx memory c, uint256 ytIn, uint256 fee) private pure returns (uint256) {
        uint256 p1 = (c.x + ytIn) * c.refPrice / UWAD * UWAD / c.denom;
        if (p1 > MAX_P) revert IXeroMath.MathError(E_PROPORTION);
        int256 r1 = rateAt(c.anchor, c.scalar, p1);
        if (r1 <= 0) revert IXeroMath.MathError(E_RATE);
        uint256 gross = ytIn * uint256(r1) / UWAD * c.tau / UWAD;
        return gross * (UWAD - fee) / UWAD;
    }

    /// @dev Quote cost (before fee) of buying `d` YT: d * r(p(d)) * tau.
    function _cost(Ctx memory c, uint256 d) private pure returns (uint256) {
        uint256 p = (c.x - d) * c.refPrice / UWAD * UWAD / c.denom;
        int256 r = rateAt(c.anchor, c.scalar, p);
        if (r <= 0) revert IXeroMath.MathError(E_RATE);
        return d * uint256(r) / UWAD * c.tau / UWAD;
    }
}
