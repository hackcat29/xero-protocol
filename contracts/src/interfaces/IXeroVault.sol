// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IXeroVault {
    function underlying() external view returns (address);
    function principalToken() external view returns (address);
    function yieldToken() external view returns (address);
    function maturity() external view returns (uint64);
    function dividendIndex() external view returns (uint256);
    function structuralFactor() external view returns (uint256);
    function claimYield(address user) external returns (uint256);
    function onYieldTransfer(address from, address to) external;
    function invariantHolds() external view returns (bool);
}
