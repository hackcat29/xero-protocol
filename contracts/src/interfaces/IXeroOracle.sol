// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IXeroOracle {
    /// @return price USD per raw Stock Token (WAD), multiplier included @return updatedAt observation time
    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt);
}
