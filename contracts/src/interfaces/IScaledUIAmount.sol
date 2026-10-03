// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IScaledUIAmount (ERC-8056)
/// @notice Interface of Robinhood Stock Tokens. Raw ERC-20 balances never change on corporate actions;
///         instead `uiMultiplier()` (WAD, shares per raw token) moves: up when dividends are reinvested,
///         up or down on splits. Underlying shares = raw amount * uiMultiplier / 1e18.
/// @dev Verified against AAPL/TSLA/NVDA on Robinhood Chain mainnet (chain 4663).
interface IScaledUIAmount is IERC20 {
    function uiMultiplier() external view returns (uint256);
    function newUIMultiplier() external view returns (uint256);
    function effectiveAt() external view returns (uint256);
    function balanceOfUI(address account) external view returns (uint256);
    function totalSupplyUI() external view returns (uint256);
}

/// @notice Additional Robinhood Stock Token flags used during corporate-action processing.
interface IRobinhoodStockToken is IScaledUIAmount {
    /// @dev True while Robinhood is staging a large multiplier update (e.g. a split). Chainlink holds
    ///      its last price while this is set; Xero freezes index accrual.
    function oraclePaused() external view returns (bool);
    function paused() external view returns (bool);
}
