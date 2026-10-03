// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICorporateActionEngine} from "./interfaces/ICorporateActionEngine.sol";
import {IRiskGuardian} from "./interfaces/IRiskGuardian.sol";

/// @title CorporateActionEngine
/// @notice Authenticated, append-only log of corporate actions per Stock Token.
///
/// Robinhood Stock Tokens express dividends *and* splits through the same `uiMultiplier()`. Xero must
/// only credit dividend growth to Yield Tokens, so structural changes (splits, stock dividends) are
/// attested here and divided out of the multiplier by every vault. An action becomes effective once
/// `quorum` distinct reporters attest the identical payload; reporters source it from Robinhood's public
/// corporate-actions API (see services/keeper) and cross-check the token's pending multiplier.
///
/// Actions Xero cannot represent deterministically (mergers, spin-offs, redemptions, ...) halt new
/// stripping of the token through the RiskGuardian. Existing holders can always recombine.
contract CorporateActionEngine is ICorporateActionEngine, AccessControl {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    uint256 internal constant WAD = 1e18;
    /// @notice Cash dividends must be attested promptly; structural actions may be attested late so a
    ///         missed split can always be resolved (vaults stay frozen, never misattribute, meanwhile).
    uint64 public constant MAX_BACKDATE = 1 days;
    uint64 public constant MAX_BACKDATE_STRUCTURAL = 30 days;
    uint64 public constant MAX_LEAD = 120 days;
    uint256 public constant MAX_STRUCTURAL_RATIO = 100;
    /// @notice Upper bound on the multiplier growth a single cash dividend may authorise (50%).
    uint128 public constant MAX_DIVIDEND_GROWTH = 0.5e18;

    IRiskGuardian public immutable guardian;
    uint8 public quorum;

    mapping(address token => CorporateAction[]) private _actions;
    mapping(bytes32 payloadHash => uint8) public confirmations;
    mapping(bytes32 payloadHash => mapping(address reporter => bool)) public confirmedBy;
    mapping(bytes32 ref => bool) public refUsed;

    event ActionAttested(bytes32 indexed payloadHash, address indexed reporter, uint8 confirmations);
    event ActionEffective(
        address indexed token,
        uint256 indexed index,
        ActionType kind,
        uint64 effectiveAt,
        uint128 value,
        uint128 value2,
        bytes32 ref
    );
    event QuorumSet(uint8 quorum);

    error InvalidAction();
    error StaleAction();
    error ActionTooFar();
    error ActionOutOfOrder();
    error DuplicateRef();
    error AlreadyConfirmed();

    constructor(address admin, IRiskGuardian guardian_, uint8 quorum_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        guardian = guardian_;
        _setQuorum(quorum_);
    }

    function setQuorum(uint8 quorum_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setQuorum(quorum_);
    }

    /// @notice Attest a corporate action. It becomes effective once `quorum` reporters attest the same payload.
    /// @param ref Unique identifier; reporters use the Robinhood corporate-action id.
    function report(address token, ActionType kind, uint64 effectiveAt, uint128 value, uint128 value2, bytes32 ref)
        external
        onlyRole(REPORTER_ROLE)
        returns (bool effective)
    {
        if (refUsed[ref]) revert DuplicateRef();
        _validate(token, kind, effectiveAt, value, value2);

        bytes32 h = keccak256(abi.encode(token, kind, effectiveAt, value, value2, ref));
        if (confirmedBy[h][msg.sender]) revert AlreadyConfirmed();
        confirmedBy[h][msg.sender] = true;
        uint8 c = ++confirmations[h];
        emit ActionAttested(h, msg.sender, c);
        if (c < quorum) return false;

        refUsed[ref] = true;
        CorporateAction[] storage list = _actions[token];
        list.push(CorporateAction(kind, effectiveAt, uint64(block.timestamp), value, value2, ref));
        emit ActionEffective(token, list.length - 1, kind, effectiveAt, value, value2, ref);

        if (!isSupported(kind)) guardian.haltAsset(token);
        return true;
    }

    function actionCount(address token) external view returns (uint256) {
        return _actions[token].length;
    }

    function getAction(address token, uint256 index) external view returns (CorporateAction memory) {
        return _actions[token][index];
    }

    /// @notice Structural actions rescale the token without transferring value to holders.
    function isStructural(ActionType kind) public pure returns (bool) {
        return kind == ActionType.FORWARD_SPLIT || kind == ActionType.REVERSE_SPLIT || kind == ActionType.STOCK_DIVIDEND;
    }

    function isSupported(ActionType kind) public pure returns (bool) {
        return kind == ActionType.CASH_DIVIDEND || kind == ActionType.NAME_CHANGE || isStructural(kind);
    }

    function _validate(address token, ActionType kind, uint64 effectiveAt, uint128 value, uint128 value2)
        internal
        view
    {
        if (token == address(0)) revert InvalidAction();
        uint64 backdate = isStructural(kind) ? MAX_BACKDATE_STRUCTURAL : MAX_BACKDATE;
        if (effectiveAt + backdate < block.timestamp) revert StaleAction();
        if (effectiveAt > block.timestamp + MAX_LEAD) revert ActionTooFar();
        CorporateAction[] storage list = _actions[token];
        if (list.length > 0 && effectiveAt < list[list.length - 1].effectiveAt) revert ActionOutOfOrder();

        if (kind == ActionType.CASH_DIVIDEND) {
            if (value == 0 || value2 == 0 || value2 > MAX_DIVIDEND_GROWTH) revert InvalidAction();
        } else if (isStructural(kind)) {
            if (value == 0 || value2 == 0 || value == value2) revert InvalidAction();
            if (value > value2 * MAX_STRUCTURAL_RATIO || value2 > value * MAX_STRUCTURAL_RATIO) {
                revert InvalidAction();
            }
        }
    }

    function _setQuorum(uint8 quorum_) internal {
        if (quorum_ == 0) revert InvalidAction();
        quorum = quorum_;
        emit QuorumSet(quorum_);
    }
}
