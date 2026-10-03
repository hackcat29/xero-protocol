// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRiskGuardian {
    function checkStrip(address underlying, address vault) external view;
    function checkTrade(address pool) external view;
    function haltAsset(address underlying) external;
    function isAssetAllowed(address underlying) external view returns (bool);
}
