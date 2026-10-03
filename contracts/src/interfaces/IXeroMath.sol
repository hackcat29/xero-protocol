// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IXeroMath
/// @notice Pricing engine for maturity-aware Yield Token markets and implied dividend curves.
/// @dev Implemented twice with bit-identical results:
///      - `XeroMathSol` (Solidity, runs on any EVM, used in Foundry tests), and
///      - `stylus/xero-math` (Rust/WASM on Arbitrum Stylus, cheaper for the iterative solver).
///      All values are 18-decimal fixed point ("WAD"). Errors are reported as `MathError(code)`.
interface IXeroMath {
    error MathError(uint8 code);

    /// @notice Natural logarithm of a WAD value.
    function lnWad(int256 x) external pure returns (int256);

    /// @notice Sell `ytIn` Yield Tokens into the pool.
    /// @param x YT reserve (WAD) @param y quote reserve (WAD) @param refPrice reference YT price used for proportion
    /// @param lastRate last implied rate (quote per YT per year, WAD) @param scalar curve steepness (WAD)
    /// @param tau time to maturity in years (WAD) @param fee fee fraction (WAD)
    /// @return quoteOut quote paid to the trader (WAD) @return newRate implied rate after the trade
    function swapExactYtIn(
        uint256 x,
        uint256 y,
        uint256 refPrice,
        int256 lastRate,
        int256 scalar,
        uint256 tau,
        uint256 fee,
        uint256 ytIn
    ) external pure returns (uint256 quoteOut, int256 newRate);

    /// @notice Spend `quoteIn` buying Yield Tokens (solved by bisection).
    function swapExactQuoteIn(
        uint256 x,
        uint256 y,
        uint256 refPrice,
        int256 lastRate,
        int256 scalar,
        uint256 tau,
        uint256 fee,
        uint256 quoteIn
    ) external pure returns (uint256 ytOut, int256 newRate);

    /// @notice Forward dividend rates between consecutive maturities of an implied dividend curve.
    /// @param taus strictly increasing times to maturity (WAD years)
    /// @param values market value of the yield through each maturity (WAD, per unit)
    /// @return forwards annualised dividend rate implied for each segment (WAD)
    function forwardRates(uint256[] calldata taus, uint256[] calldata values)
        external
        pure
        returns (int256[] memory forwards);
}
