//! Fixed-point pricing math for Xero Yield Token markets.
//!
//! This is a line-by-line port of `contracts/src/math/XeroMathLib.sol`. Every operation keeps the
//! Solidity evaluation order and truncation (unsigned floor division, signed division truncating
//! toward zero) so both engines return bit-identical results; `tests/parity.rs` writes shared
//! vectors that the Foundry suite replays against the Solidity implementation.
//!
//! Solidity reverts with `Panic(0x11/0x12)` on overflow or division by zero; here the same inputs
//! return `E_ARITHMETIC`. Both revert, only the error payload differs.

use alloy_primitives::{I256, U256};

pub const E_LN_DOMAIN: u8 = 1;
pub const E_EXPIRED: u8 = 2;
pub const E_ZERO: u8 = 3;
pub const E_PROPORTION: u8 = 4;
pub const E_RATE: u8 = 5;
pub const E_LIQUIDITY: u8 = 6;
pub const E_CURVE: u8 = 7;
pub const E_PARAM: u8 = 8;
pub const E_ARITHMETIC: u8 = 0xff;

pub type MathResult<T> = Result<T, u8>;

const WAD_U64: u64 = 1_000_000_000_000_000_000;
const WAD_U128: u128 = WAD_U64 as u128;
const WAD_I128: i128 = WAD_U64 as i128;
const LN2: i128 = 693_147_180_559_945_309;
const MAX_ITERS: usize = 128;

#[inline]
fn uwad() -> U256 {
    U256::from(WAD_U64)
}

#[inline]
fn swad() -> I256 {
    I256::from_raw(uwad())
}

#[inline]
fn min_p() -> U256 {
    U256::from(20_000_000_000_000_000u64) // 0.02e18
}

#[inline]
fn max_p() -> U256 {
    U256::from(980_000_000_000_000_000u64) // 0.98e18
}

#[inline]
fn rel_tol() -> U256 {
    U256::from(1_000_000_000_000u64) // 1e12
}

// ---------------------------------------------------------------- checked helpers (Solidity 0.8 semantics)

#[inline]
fn add(a: U256, b: U256) -> MathResult<U256> {
    a.checked_add(b).ok_or(E_ARITHMETIC)
}
#[inline]
fn sub(a: U256, b: U256) -> MathResult<U256> {
    a.checked_sub(b).ok_or(E_ARITHMETIC)
}
#[inline]
fn mul(a: U256, b: U256) -> MathResult<U256> {
    a.checked_mul(b).ok_or(E_ARITHMETIC)
}
#[inline]
fn div(a: U256, b: U256) -> MathResult<U256> {
    a.checked_div(b).ok_or(E_ARITHMETIC)
}
#[inline]
fn sadd(a: I256, b: I256) -> MathResult<I256> {
    a.checked_add(b).ok_or(E_ARITHMETIC)
}
#[inline]
fn ssub(a: I256, b: I256) -> MathResult<I256> {
    a.checked_sub(b).ok_or(E_ARITHMETIC)
}
#[inline]
fn smul(a: I256, b: I256) -> MathResult<I256> {
    a.checked_mul(b).ok_or(E_ARITHMETIC)
}
#[inline]
fn sdiv(a: I256, b: I256) -> MathResult<I256> {
    a.checked_div(b).ok_or(E_ARITHMETIC)
}

// ---------------------------------------------------------------- core functions

/// ln(x) for WAD `x`: reduce to m in [1, 2) then ln(m) = 2 * atanh((m - 1) / (m + 1)).
pub fn ln_wad(x: I256) -> MathResult<I256> {
    if x <= I256::ZERO {
        return Err(E_LN_DOMAIN);
    }
    let w = uwad();
    let two_w = w * U256::from(2u8);
    let mut ux = x.into_raw();
    let mut k: i128 = 0;
    while ux >= two_w {
        ux >>= 1;
        k += 1;
    }
    while ux < w {
        ux <<= 1;
        k -= 1;
    }
    // ux is now in [1e18, 2e18), so every intermediate below fits in 128 bits.
    let u: u128 = ux.to::<u128>();
    let z: i128 = ((u - WAD_U128) * WAD_U128 / (u + WAD_U128)) as i128;
    let z2 = z * z / WAD_I128;
    let mut term = z;
    let mut sum: i128 = 0;
    let mut d: i128 = 1;
    while term != 0 {
        sum += term / d;
        term = term * z2 / WAD_I128;
        d += 2;
    }
    Ok(I256::try_from(k * LN2 + 2 * sum).map_err(|_| E_ARITHMETIC)?)
}

pub fn logit(p: U256) -> MathResult<I256> {
    let w = uwad();
    ln_wad(I256::from_raw(div(mul(p, w)?, sub(w, p)?)?))
}

pub fn rate_at(anchor: I256, scalar: I256, p: U256) -> MathResult<I256> {
    ssub(anchor, sdiv(smul(logit(p)?, swad())?, scalar)?)
}

/// Returns the curve anchor that makes `rate(p0) == last_rate`, and the pool size in value terms.
pub fn anchor_of(x: U256, y: U256, ref_price: U256, last_rate: I256, scalar: I256) -> MathResult<(I256, U256)> {
    if scalar <= I256::ZERO || ref_price.is_zero() {
        return Err(E_PARAM);
    }
    let w = uwad();
    let xv = div(mul(x, ref_price)?, w)?;
    let denom = add(xv, y)?;
    if xv.is_zero() || y.is_zero() {
        return Err(E_LIQUIDITY);
    }
    let p0 = div(mul(xv, w)?, denom)?;
    let anchor = sadd(last_rate, sdiv(smul(logit(p0)?, swad())?, scalar)?)?;
    Ok((anchor, denom))
}

pub fn post_rate(anchor: I256, scalar: I256, x1: U256, y1: U256, ref_price: U256) -> MathResult<I256> {
    let w = uwad();
    let xv = div(mul(x1, ref_price)?, w)?;
    rate_at(anchor, scalar, div(mul(xv, w)?, add(xv, y1)?)?)
}

struct Ctx {
    anchor: I256,
    scalar: I256,
    x: U256,
    ref_price: U256,
    denom: U256,
    tau: U256,
}

#[allow(clippy::too_many_arguments)]
pub fn swap_exact_yt_in(
    x: U256,
    y: U256,
    ref_price: U256,
    last_rate: I256,
    scalar: I256,
    tau: U256,
    fee: U256,
    yt_in: U256,
) -> MathResult<(U256, I256)> {
    if tau.is_zero() {
        return Err(E_EXPIRED);
    }
    if yt_in.is_zero() {
        return Err(E_ZERO);
    }
    if fee >= uwad() {
        return Err(E_PARAM);
    }
    let (anchor, denom) = anchor_of(x, y, ref_price, last_rate, scalar)?;
    let c = Ctx { anchor, scalar, x, ref_price, denom, tau };
    let out = sell_proceeds(&c, yt_in, fee)?;
    if out >= y {
        return Err(E_LIQUIDITY);
    }
    let new_rate = post_rate(anchor, scalar, add(x, yt_in)?, sub(y, out)?, ref_price)?;
    Ok((out, new_rate))
}

#[allow(clippy::too_many_arguments)]
pub fn swap_exact_quote_in(
    x: U256,
    y: U256,
    ref_price: U256,
    last_rate: I256,
    scalar: I256,
    tau: U256,
    fee: U256,
    quote_in: U256,
) -> MathResult<(U256, I256)> {
    if tau.is_zero() {
        return Err(E_EXPIRED);
    }
    if quote_in.is_zero() {
        return Err(E_ZERO);
    }
    let w = uwad();
    if fee >= w {
        return Err(E_PARAM);
    }
    let (anchor, denom) = anchor_of(x, y, ref_price, last_rate, scalar)?;
    let c = Ctx { anchor, scalar, x, ref_price, denom, tau };
    let yt_out = solve_buy(&c, div(mul(quote_in, sub(w, fee)?)?, w)?)?;
    let new_rate = post_rate(anchor, scalar, sub(x, yt_out)?, add(y, quote_in)?, ref_price)?;
    Ok((yt_out, new_rate))
}

pub fn forward_rates(taus: &[U256], values: &[U256]) -> MathResult<Vec<I256>> {
    let n = taus.len();
    if n == 0 || values.len() != n || taus[0].is_zero() {
        return Err(E_CURVE);
    }
    let mut out = Vec::with_capacity(n);
    out.push(I256::from_raw(div(mul(values[0], uwad())?, taus[0])?));
    for i in 1..n {
        if taus[i] <= taus[i - 1] {
            return Err(E_CURVE);
        }
        let dv = ssub(I256::from_raw(values[i]), I256::from_raw(values[i - 1]))?;
        out.push(sdiv(smul(dv, swad())?, I256::from_raw(sub(taus[i], taus[i - 1])?))?);
    }
    Ok(out)
}

// ---------------------------------------------------------------- internals

fn sell_proceeds(c: &Ctx, yt_in: U256, fee: U256) -> MathResult<U256> {
    let w = uwad();
    let p1 = div(mul(div(mul(add(c.x, yt_in)?, c.ref_price)?, w)?, w)?, c.denom)?;
    if p1 > max_p() {
        return Err(E_PROPORTION);
    }
    let r1 = rate_at(c.anchor, c.scalar, p1)?;
    if r1 <= I256::ZERO {
        return Err(E_RATE);
    }
    let gross = div(mul(div(mul(yt_in, r1.into_raw())?, w)?, c.tau)?, w)?;
    div(mul(gross, sub(w, fee)?)?, w)
}

fn cost(c: &Ctx, d: U256) -> MathResult<U256> {
    let w = uwad();
    let p = div(mul(div(mul(sub(c.x, d)?, c.ref_price)?, w)?, w)?, c.denom)?;
    let r = rate_at(c.anchor, c.scalar, p)?;
    if r <= I256::ZERO {
        return Err(E_RATE);
    }
    div(mul(div(mul(d, r.into_raw())?, w)?, c.tau)?, w)
}

/// Largest `d` with cost(d) <= net while keeping the YT proportion at or above MIN_P.
fn solve_buy(c: &Ctx, net: U256) -> MathResult<U256> {
    let w = uwad();
    let x_min = add(div(mul(div(mul(min_p(), c.denom)?, w)?, w)?, c.ref_price)?, U256::from(1u8))?;
    if c.x <= x_min {
        return Err(E_LIQUIDITY);
    }
    let mut hi = c.x - x_min;
    if cost(c, hi)? < net {
        return Err(E_LIQUIDITY);
    }
    let mut lo = U256::ZERO;
    let one = U256::from(1u8);
    for _ in 0..MAX_ITERS {
        let width = hi - lo;
        if width <= one || width <= hi / rel_tol() {
            break;
        }
        let mid = lo + width / U256::from(2u8);
        if cost(c, mid)? <= net {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    if lo.is_zero() {
        return Err(E_ZERO);
    }
    Ok(lo)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wad(v: f64) -> U256 {
        U256::from((v * 1e18) as u128)
    }

    fn to_f(x: I256) -> f64 {
        let s: i128 = x.try_into().unwrap();
        s as f64 / 1e18
    }

    #[test]
    fn ln_matches_float_reference() {
        for v in [0.0417, 0.1, 0.5, 1.0, 1.5, 2.0, 2.718281828, 10.0, 24.0, 49.0, 1e6] {
            let got = to_f(ln_wad(I256::from_raw(wad(v))).unwrap());
            assert!((got - v.ln()).abs() < 1e-12, "ln({v}) = {got}, want {}", v.ln());
        }
        assert_eq!(ln_wad(I256::from_raw(uwad())).unwrap(), I256::ZERO);
        assert_eq!(ln_wad(I256::ZERO), Err(E_LN_DOMAIN));
    }

    #[test]
    fn rate_is_continuous_at_zero_trade() {
        let (x, y, r) = (wad(1000.0), wad(1000.0), I256::from_raw(wad(1.0)));
        let (anchor, denom) = anchor_of(x, y, wad(1.0), r, I256::from_raw(wad(4.0))).unwrap();
        let p0 = x * uwad() / denom;
        assert_eq!(rate_at(anchor, I256::from_raw(wad(4.0)), p0).unwrap(), r);
    }

    #[test]
    fn selling_lowers_rate_and_buying_raises_it() {
        let args = (wad(1000.0), wad(1000.0), wad(1.0), I256::from_raw(wad(2.0)), I256::from_raw(wad(3.0)), wad(1.0), wad(0.003));
        let (out, r_sell) = swap_exact_yt_in(args.0, args.1, args.2, args.3, args.4, args.5, args.6, wad(10.0)).unwrap();
        assert!(r_sell < args.3);
        assert!(out < wad(20.0) && out > wad(19.0));
        let (dt, r_buy) = swap_exact_quote_in(args.0, args.1, args.2, args.3, args.4, args.5, args.6, wad(20.0)).unwrap();
        assert!(r_buy > args.3);
        assert!(dt < wad(10.0) && dt > wad(9.5));
    }

    #[test]
    fn expired_market_rejects_trades() {
        let r = swap_exact_yt_in(wad(1.0), wad(1.0), wad(1.0), I256::ONE, I256::ONE, U256::ZERO, U256::ZERO, wad(1.0));
        assert_eq!(r, Err(E_EXPIRED));
    }

    #[test]
    fn forward_curve() {
        let f = forward_rates(&[wad(0.25), wad(0.5), wad(1.0)], &[wad(0.25), wad(0.5), wad(1.2)]).unwrap();
        assert_eq!(f[0], I256::from_raw(wad(1.0)));
        assert_eq!(f[1], I256::from_raw(wad(1.0)));
        assert!((to_f(f[2]) - 1.4).abs() < 1e-12);
        assert_eq!(forward_rates(&[wad(1.0), wad(0.5)], &[U256::ZERO, U256::ZERO]), Err(E_CURVE));
    }
}
