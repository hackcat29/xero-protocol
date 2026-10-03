// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Chainlink AggregatorV3 stand-in (8 decimals) for local and testnet deployments.
contract MockAggregator {
    uint8 public constant decimals = 8;
    int256 public answer;
    uint256 public updatedAt;
    uint80 public roundId;
    address public immutable owner;

    constructor(int256 answer_) {
        owner = msg.sender;
        _set(answer_);
    }

    function setAnswer(int256 answer_) external {
        require(msg.sender == owner, "owner");
        _set(answer_);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }

    function _set(int256 a) internal {
        answer = a;
        updatedAt = block.timestamp;
        ++roundId;
    }
}
