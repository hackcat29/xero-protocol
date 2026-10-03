// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IRiskGuardian} from "./interfaces/IRiskGuardian.sol";
import {IXeroVault} from "./interfaces/IXeroVault.sol";

/// @title RiskGuardian
/// @notice Protocol-level circuit breakers. The guardian can stop *new risk* (stripping, trading) but
///         has no ability to move funds or block exits: recombination, redemption, dividend claims and
///         LP withdrawals remain available in every state.
contract RiskGuardian is IRiskGuardian, AccessControl {
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant ENGINE_ROLE = keccak256("ENGINE_ROLE");

    bool public globalPaused;
    mapping(address target => bool) public paused;
    mapping(address asset => bool) public assetAllowed;
    mapping(address asset => bool) public assetHalted;

    event GlobalPause(bool paused);
    event TargetPause(address indexed target, bool paused);
    event AssetAllowed(address indexed asset, bool allowed);
    event AssetHalted(address indexed asset, bool halted);
    event InvariantBreach(address indexed vault);

    error ProtocolPaused();
    error TargetPaused();
    error AssetNotAllowed();
    error AssetHaltedForAction();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);
    }

    // ---------------------------------------------------------------- checks

    function checkStrip(address underlying, address vault) external view {
        if (globalPaused) revert ProtocolPaused();
        if (paused[vault]) revert TargetPaused();
        if (!assetAllowed[underlying]) revert AssetNotAllowed();
        if (assetHalted[underlying]) revert AssetHaltedForAction();
    }

    function checkTrade(address pool) external view {
        if (globalPaused) revert ProtocolPaused();
        if (paused[pool]) revert TargetPaused();
    }

    function isAssetAllowed(address underlying) external view returns (bool) {
        return assetAllowed[underlying] && !assetHalted[underlying];
    }

    // ---------------------------------------------------------------- controls

    function setGlobalPause(bool p) external onlyRole(GUARDIAN_ROLE) {
        globalPaused = p;
        emit GlobalPause(p);
    }

    function setPaused(address target, bool p) external onlyRole(GUARDIAN_ROLE) {
        paused[target] = p;
        emit TargetPause(target, p);
    }

    /// @notice Asset listing is an admin (timelock) decision, not an emergency power.
    function setAssetAllowed(address asset, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assetAllowed[asset] = allowed;
        emit AssetAllowed(asset, allowed);
    }

    /// @notice Called by the CorporateActionEngine on unsupported corporate actions.
    function haltAsset(address underlying) external {
        if (!hasRole(ENGINE_ROLE, msg.sender) && !hasRole(GUARDIAN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, ENGINE_ROLE);
        }
        assetHalted[underlying] = true;
        emit AssetHalted(underlying, true);
    }

    function resumeAsset(address underlying) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assetHalted[underlying] = false;
        emit AssetHalted(underlying, false);
    }

    /// @notice Permissionless keeper hook: pauses a vault whose collateral invariant does not hold.
    function enforceInvariant(address vault) external returns (bool ok) {
        ok = IXeroVault(vault).invariantHolds();
        if (!ok && !paused[vault]) {
            paused[vault] = true;
            emit InvariantBreach(vault);
            emit TargetPause(vault, true);
        }
    }
}
