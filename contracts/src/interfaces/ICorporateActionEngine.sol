// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICorporateActionEngine {
    /// @dev Mirrors the `type` field of Robinhood's /rhj/corporate-actions API.
    enum ActionType {
        CASH_DIVIDEND,
        STOCK_DIVIDEND,
        FORWARD_SPLIT,
        REVERSE_SPLIT,
        UNIT_SPLIT,
        SPIN_OFF,
        CASH_MERGER,
        STOCK_MERGER,
        STOCK_AND_CASH_MERGER,
        REDEMPTION,
        WORTHLESS_REMOVAL,
        RIGHTS_DISTRIBUTION,
        NAME_CHANGE
    }

    /// @param effectiveAt When the Stock Token's multiplier changes for this action.
    /// @param value  Splits / stock dividends: new rate (WAD). CASH_DIVIDEND: USD per share (WAD).
    /// @param value2 Splits / stock dividends: old rate (WAD); the structural factor is value / value2.
    ///               CASH_DIVIDEND: maximum multiplier growth this payment may cause (WAD fraction).
    struct CorporateAction {
        ActionType kind;
        uint64 effectiveAt;
        uint64 attestedAt;
        uint128 value;
        uint128 value2;
        bytes32 ref;
    }

    function actionCount(address token) external view returns (uint256);
    function getAction(address token, uint256 index) external view returns (CorporateAction memory);
}
