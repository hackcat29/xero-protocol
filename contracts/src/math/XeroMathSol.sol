// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IXeroMath} from "../interfaces/IXeroMath.sol";
import {XeroMathLib} from "./XeroMathLib.sol";

/// @title XeroMathSol
/// @notice EVM implementation of the Xero pricing engine. Used on chains without Stylus and in tests;
///         on Arbitrum the Stylus build of `stylus/xero-math` is deployed behind the same interface.
contract XeroMathSol is IXeroMath {
    function lnWad(int256 x) external pure returns (int256) {
        return XeroMathLib.lnWad(x);
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
    ) external pure returns (uint256, int256) {
        return XeroMathLib.swapExactYtIn(x, y, refPrice, lastRate, scalar, tau, fee, ytIn);
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
    ) external pure returns (uint256, int256) {
        return XeroMathLib.swapExactQuoteIn(x, y, refPrice, lastRate, scalar, tau, fee, quoteIn);
    }

    function forwardRates(uint256[] calldata taus, uint256[] calldata values)
        external
        pure
        returns (int256[] memory)
    {
        return XeroMathLib.forwardRates(taus, values);
    }
}
