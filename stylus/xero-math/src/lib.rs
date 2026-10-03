//! Xero Protocol pricing engine for Arbitrum Stylus.
//!
//! Exposes the `IXeroMath` interface (see `contracts/src/interfaces/IXeroMath.sol`) so Solidity
//! pools can call it like any other contract. The bisection solver used when buying Yield Tokens
//! evaluates dozens of fixed-point logarithms per swap; running it as WASM makes that substantially
//! cheaper than the equivalent EVM bytecode.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

pub mod math;

use alloc::vec::Vec;
use alloy_sol_types::sol;
use stylus_sdk::{
    alloy_primitives::{I256, U256},
    prelude::*,
};

sol! {
    /// Same error as `IXeroMath.MathError`; codes are listed in `math.rs`.
    error MathError(uint8 code);
}

#[derive(SolidityError)]
pub enum XeroMathError {
    MathError(MathError),
}

impl From<u8> for XeroMathError {
    fn from(code: u8) -> Self {
        XeroMathError::MathError(MathError { code })
    }
}

#[storage]
#[entrypoint]
pub struct XeroMath {}

#[public]
impl XeroMath {
    /// Natural logarithm of a WAD value.
    pub fn ln_wad(x: I256) -> Result<I256, XeroMathError> {
        Ok(math::ln_wad(x)?)
    }

    /// Sell `yt_in` Yield Tokens; returns (quote_out, new_rate).
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
    ) -> Result<(U256, I256), XeroMathError> {
        Ok(math::swap_exact_yt_in(x, y, ref_price, last_rate, scalar, tau, fee, yt_in)?)
    }

    /// Spend `quote_in` buying Yield Tokens; returns (yt_out, new_rate).
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
    ) -> Result<(U256, I256), XeroMathError> {
        Ok(math::swap_exact_quote_in(x, y, ref_price, last_rate, scalar, tau, fee, quote_in)?)
    }

    /// Forward dividend rates between consecutive maturities of an implied dividend curve.
    pub fn forward_rates(taus: Vec<U256>, values: Vec<U256>) -> Result<Vec<I256>, XeroMathError> {
        Ok(math::forward_rates(&taus, &values)?)
    }
}
