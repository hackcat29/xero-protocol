// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {XeroYieldMarket} from "./XeroYieldMarket.sol";
import {IXeroMath} from "../interfaces/IXeroMath.sol";
import {IXeroVault} from "../interfaces/IXeroVault.sol";
import {IRiskGuardian} from "../interfaces/IRiskGuardian.sol";

interface IVaultRegistry {
    function isVault(address) external view returns (bool);
}

/// @title YieldMarketFactory
/// @notice Deploys the canonical XeroYieldMarket for each Xero vault and selects the pricing engine
///         (Stylus or Solidity) that new markets bind to.
contract YieldMarketFactory is Ownable2Step {
    IVaultRegistry public immutable registry;
    IRiskGuardian public immutable guardian;
    IXeroMath public math;

    mapping(address vault => address pool) public poolOf;
    address[] public allPools;

    event PoolCreated(address indexed vault, address pool, uint256 refPrice, int256 scalar, uint256 fee);
    event MathSet(address math);

    error UnknownVault();
    error PoolExists();

    constructor(address owner_, IVaultRegistry registry_, IRiskGuardian guardian_, IXeroMath math_) Ownable(owner_) {
        registry = registry_;
        guardian = guardian_;
        math = math_;
        emit MathSet(address(math_));
    }

    /// @notice Point new pools at a different pricing engine (e.g. the Stylus deployment).
    function setMath(IXeroMath math_) external onlyOwner {
        math = math_;
        emit MathSet(address(math_));
    }

    function createPool(address vault, uint256 refPrice, int256 scalar, uint256 fee)
        external
        onlyOwner
        returns (address pool)
    {
        if (!registry.isVault(vault)) revert UnknownVault();
        if (poolOf[vault] != address(0)) revert PoolExists();
        pool = address(new XeroYieldMarket(IXeroVault(vault), math, guardian, refPrice, scalar, fee, msg.sender));
        poolOf[vault] = pool;
        allPools.push(pool);
        emit PoolCreated(vault, pool, refPrice, scalar, fee);
    }

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }
}
