// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IScaledUIAmount (ERC-8056)
/// @notice Multiplier interface of tokenized stocks such as Coinbase's B20 stocks on Base. Raw ERC-20
///         balances never change on corporate actions; instead `uiMultiplier()` (WAD, shares per raw token)
///         moves: up when cash dividends are converted into shares, up or down on splits.
///         Underlying shares = raw amount * uiMultiplier / 1e18.
/// @dev B20 exposes `multiplier()` with `uiMultiplier()` as its ERC-8056 alias; checked against NVDAc, AAPLc
///      and TSLAc on Base mainnet (October 2026).
interface IScaledUIAmount is IERC20 {
    function uiMultiplier() external view returns (uint256);
    function newUIMultiplier() external view returns (uint256);
    function effectiveAt() external view returns (uint256);
    function balanceOfUI(address account) external view returns (uint256);
    function totalSupplyUI() external view returns (uint256);
}

/// @notice Optional issuer flags used during corporate-action processing. Tokens that don't implement them
///         (B20 keeps its pause in Coinbase's oracle registry instead) are read as "not paused".
interface IStockToken is IScaledUIAmount {
    /// @dev True while the issuer is staging a large multiplier update (e.g. a split). Chainlink holds
    ///      its last price while this is set; Xero freezes index accrual.
    function oraclePaused() external view returns (bool);
    function paused() external view returns (bool);
}
