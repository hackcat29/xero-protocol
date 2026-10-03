// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IXeroVault} from "./interfaces/IXeroVault.sol";
import {IRobinhoodStockToken} from "./interfaces/IScaledUIAmount.sol";
import {ICorporateActionEngine} from "./interfaces/ICorporateActionEngine.sol";
import {IRiskGuardian} from "./interfaces/IRiskGuardian.sol";
import {XeroComponentToken} from "./tokens/XeroComponentToken.sol";

interface IXeroFactoryConfig {
    function treasury() external view returns (address);
    function stripFeeBps() external view returns (uint16);
    function redeemFeeBps() external view returns (uint16);
    function yieldFeeBps() external view returns (uint16);
}

/// @title XeroVault
/// @notice Splits one ERC-8056 Stock Token (e.g. a Robinhood Stock Token) for one maturity into
///         a Principal Token (PT) and a Yield Token (YT).
///
/// Economics
///   A Stock Token's `uiMultiplier` M grows when dividends are reinvested and jumps on splits. Xero
///   divides out the structural factor S (splits and stock dividends attested by the
///   CorporateActionEngine) to get the dividend index  I = M / S, which only grows with dividends.
///
///   Deposit `raw` tokens at index I0  ->  units = raw * I0  PT and YT.
///     * PT redeems at maturity for  units / I_maturity  raw tokens: the original share exposure.
///     * YT accrues  units * (1/I_prev - 1/I_now)  raw tokens: the extra shares created by reinvested
///       dividends until maturity, claimable at any time.
///   PT claim + YT accrual always sum to the deposited raw tokens, so the vault is fully collateralised
///   by construction. Growth after maturity stays inside PT's raw tokens.
///
/// Safety
///   The index only moves when the multiplier change is explained: it may not fall, and it may not rise
///   by more than `maxGrowthPerSync` plus any growth authorised by attested cash dividends. Otherwise
///   (an unattested split, or the token's oraclePaused flag) the vault *freezes*: no new deposits and
///   no YT accrual until the action is attested. Recombination always works, at the last good index,
///   which is exact for a PT+YT pair regardless of how the frozen change is eventually classified.
contract XeroVault is IXeroVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;
    /// @dev Rounding tolerance for the solvency check (1e-12 of a token).
    uint256 internal constant DUST = 1e6;
    /// @dev Relative tolerance (1 / 1e12) for multiplier rounding after structural actions.
    uint256 internal constant ROUNDING_TOLERANCE = 1e12;

    IXeroFactoryConfig public immutable factory;
    IRobinhoodStockToken internal immutable _token;
    ICorporateActionEngine public immutable engine;
    IRiskGuardian public immutable guardian;
    uint64 public immutable maturity;
    uint64 public immutable start;
    /// @notice Largest unexplained dividend-index rise accepted in one sync (WAD fraction).
    uint256 public immutable maxGrowthPerSync;

    XeroComponentToken public pt;
    XeroComponentToken public yt;

    uint256 public structuralFactor = WAD;
    uint256 public dividendIndex;
    /// @notice Dividend index fixed at maturity; 0 until the first healthy sync at or after maturity.
    uint256 public maturityIndex;
    /// @notice Extra growth authorised by attested cash dividends, consumed by the next index update.
    uint256 public growthAllowance;
    uint256 public actionCursor;
    bool public halted;
    bool public frozen;

    /// @notice Upper bound on raw tokens owed to YT holders and the treasury (accrued, not yet claimed).
    uint256 public totalYieldOwed;
    mapping(address => uint256) public ytUserIndex;
    mapping(address => uint256) public accrued;

    event Stripped(address indexed caller, address indexed to, uint256 raw, uint256 fee, uint256 units);
    event Recombined(address indexed owner, address indexed to, uint256 units, uint256 raw);
    event Redeemed(address indexed owner, address indexed to, uint256 units, uint256 raw);
    event YieldClaimed(address indexed user, uint256 raw);
    event IndexUpdated(uint256 multiplier, uint256 structuralFactor, uint256 dividendIndex);
    event StructuralFactorUpdated(uint256 structuralFactor);
    event MaturitySettled(uint256 maturityIndex);
    event Frozen(uint256 multiplier, uint256 candidateIndex);
    event VaultHalted(uint256 actionIndex);

    error OnlyFactory();
    error OnlyYieldToken();
    error AlreadyInitialized();
    error Matured();
    error NotMatured();
    error MaturityNotSettled();
    error VaultHaltedForAction();
    error VaultFrozen();
    error ZeroAmount();
    error BadMultiplier();

    constructor(
        IRobinhoodStockToken token_,
        ICorporateActionEngine engine_,
        IRiskGuardian guardian_,
        uint64 maturity_,
        uint256 maxGrowthPerSync_,
        IXeroFactoryConfig factory_
    ) {
        _token = token_;
        engine = engine_;
        guardian = guardian_;
        maturity = maturity_;
        start = uint64(block.timestamp);
        maxGrowthPerSync = maxGrowthPerSync_;
        factory = factory_;

        uint256 m = token_.uiMultiplier();
        if (m == 0) revert BadMultiplier();
        dividendIndex = m;

        // Actions already in effect are reflected in the starting multiplier.
        uint256 c = engine_.actionCount(address(token_));
        while (c > 0 && engine_.getAction(address(token_), c - 1).effectiveAt > block.timestamp) c--;
        actionCursor = c;
    }

    function initialize(XeroComponentToken pt_, XeroComponentToken yt_) external {
        if (msg.sender != address(factory)) revert OnlyFactory();
        if (address(pt) != address(0)) revert AlreadyInitialized();
        pt = pt_;
        yt = yt_;
    }

    // ================================================================ user actions

    /// @notice Deposit `raw` Stock Tokens and mint equal PT and YT units to `to`.
    function strip(uint256 raw, address to) external nonReentrant returns (uint256 units) {
        if (block.timestamp >= maturity) revert Matured();
        guardian.checkStrip(address(_token), address(this));
        _sync();
        if (halted) revert VaultHaltedForAction();
        if (frozen) revert VaultFrozen();
        _checkpoint(to);

        IERC20 t = IERC20(address(_token));
        uint256 bal0 = t.balanceOf(address(this));
        t.safeTransferFrom(msg.sender, address(this), raw);
        uint256 received = t.balanceOf(address(this)) - bal0;

        uint256 fee = received * factory.stripFeeBps() / BPS;
        if (fee > 0) t.safeTransfer(factory.treasury(), fee);
        units = Math.mulDiv(received - fee, dividendIndex, WAD);
        if (units == 0) revert ZeroAmount();

        pt.mint(to, units);
        yt.mint(to, units);
        emit Stripped(msg.sender, to, received, fee, units);
    }

    /// @notice Before maturity: burn `units` of PT and YT and receive the Stock Tokens back.
    function recombine(uint256 units, address to) external nonReentrant returns (uint256 raw) {
        if (block.timestamp >= maturity) revert Matured();
        if (units == 0) revert ZeroAmount();
        _sync();
        _checkpoint(msg.sender);
        raw = Math.mulDiv(units, WAD, dividendIndex);
        pt.burn(msg.sender, units);
        yt.burn(msg.sender, units);
        raw = _payOut(raw, to);
        emit Recombined(msg.sender, to, units, raw);
    }

    /// @notice At or after maturity: burn `units` of PT and receive their Stock Tokens.
    function redeem(uint256 units, address to) external nonReentrant returns (uint256 raw) {
        if (block.timestamp < maturity) revert NotMatured();
        if (units == 0) revert ZeroAmount();
        _sync();
        if (maturityIndex == 0) revert MaturityNotSettled();
        raw = Math.mulDiv(units, WAD, maturityIndex);
        pt.burn(msg.sender, units);
        raw = _payOut(raw, to);
        emit Redeemed(msg.sender, to, units, raw);
    }

    /// @notice Pay `user` the Stock Tokens their YT has accrued. Callable by anyone; funds go to `user`.
    function claimYield(address user) external nonReentrant returns (uint256 raw) {
        _sync();
        _checkpoint(user);
        raw = accrued[user];
        if (raw > 0) {
            accrued[user] = 0;
            totalYieldOwed = totalYieldOwed > raw ? totalYieldOwed - raw : 0;
            IERC20(address(_token)).safeTransfer(user, raw);
            emit YieldClaimed(user, raw);
        }
    }

    /// @notice Read the multiplier, apply newly effective corporate actions and settle maturity.
    function sync() external nonReentrant {
        _sync();
    }

    /// @notice YT transfer hook: settles both parties' accrual before balances move.
    function onYieldTransfer(address from, address to) external nonReentrant {
        if (msg.sender != address(yt)) revert OnlyYieldToken();
        _sync();
        _checkpoint(from);
        _checkpoint(to);
    }

    // ================================================================ views

    function underlying() external view returns (address) {
        return address(_token);
    }

    function principalToken() external view returns (address) {
        return address(pt);
    }

    function yieldToken() external view returns (address) {
        return address(yt);
    }

    function isMatured() public view returns (bool) {
        return block.timestamp >= maturity;
    }

    function timeToMaturity() external view returns (uint256) {
        return isMatured() ? 0 : maturity - block.timestamp;
    }

    function totalUnits() external view returns (uint256) {
        return pt.totalSupply();
    }

    function collateral() public view returns (uint256) {
        return IERC20(address(_token)).balanceOf(address(this));
    }

    /// @notice Index YT accrues against: frozen at maturity once settled.
    function accrualIndex() public view returns (uint256) {
        return maturityIndex != 0 ? maturityIndex : dividendIndex;
    }

    function previewStrip(uint256 raw) external view returns (uint256) {
        return Math.mulDiv(raw - raw * factory.stripFeeBps() / BPS, dividendIndex, WAD);
    }

    /// @notice Stock Tokens returned for `units` (recombination before maturity, PT redemption after).
    function previewRedeem(uint256 units) external view returns (uint256 raw) {
        raw = Math.mulDiv(units, WAD, accrualIndex());
        raw -= raw * factory.redeemFeeBps() / BPS;
    }

    /// @notice Accrued yield of `user` as of the last sync, net of the protocol fee.
    function claimable(address user) external view returns (uint256) {
        uint256 prev = ytUserIndex[user];
        uint256 idx = accrualIndex();
        if (prev == 0 || idx <= prev) return accrued[user];
        uint256 interest = Math.mulDiv(Math.mulDiv(yt.balanceOf(user), idx - prev, prev), WAD, idx);
        return accrued[user] + interest - interest * factory.yieldFeeBps() / BPS;
    }

    /// @notice Solvency: raw tokens held cover every PT claim plus every YT accrual.
    function invariantHolds() public view returns (bool) {
        uint256 need = Math.mulDiv(pt.totalSupply(), WAD, accrualIndex(), Math.Rounding.Ceil) + totalYieldOwed;
        return collateral() + DUST >= need;
    }

    // ================================================================ internals

    function _payOut(uint256 raw, address to) internal returns (uint256) {
        IERC20 t = IERC20(address(_token));
        uint256 fee = raw * factory.redeemFeeBps() / BPS;
        if (fee > 0) t.safeTransfer(factory.treasury(), fee);
        t.safeTransfer(to, raw - fee);
        return raw - fee;
    }

    function _sync() internal {
        _processActions();

        if (_tokenOraclePaused()) {
            _freeze(0, 0);
            return;
        }
        uint256 m = _token.uiMultiplier();
        uint256 candidate = Math.mulDiv(m, WAD, structuralFactor);
        uint256 current = dividendIndex;

        // Multipliers are rounded to 18 decimals, so a structural rescale can land a few wei below the
        // previous index. Treat drops within 1e-12 as unchanged rather than as an unexplained decrease.
        if (candidate < current && current - candidate <= current / ROUNDING_TOLERANCE) candidate = current;

        if (candidate != current) {
            uint256 ceiling = Math.mulDiv(current, WAD + maxGrowthPerSync + growthAllowance, WAD);
            if (candidate < current || candidate > ceiling) {
                _freeze(m, candidate);
                return;
            }
            if (maturityIndex == 0) _accrueGlobal(current, candidate);
            dividendIndex = candidate;
            growthAllowance = 0;
            emit IndexUpdated(m, structuralFactor, candidate);
        }
        frozen = false;

        if (maturityIndex == 0 && block.timestamp >= maturity) {
            maturityIndex = dividendIndex;
            emit MaturitySettled(dividendIndex);
        }
    }

    function _processActions() internal {
        address token = address(_token);
        uint256 n = engine.actionCount(token);
        uint256 cursor = actionCursor;
        if (cursor >= n) return;

        uint256 s = structuralFactor;
        uint256 allowance = growthAllowance;
        while (cursor < n) {
            ICorporateActionEngine.CorporateAction memory a = engine.getAction(token, cursor);
            if (a.effectiveAt > block.timestamp) break;
            ICorporateActionEngine.ActionType k = a.kind;
            // Effects from before this vault existed are already inside its starting multiplier. (An action
            // effective in the creation second itself is applied; if it was in fact already reflected,
            // the index drops and the vault freezes rather than misattributing anything.)
            if (a.effectiveAt < start && _isPricedAction(k)) {
                ++cursor;
                continue;
            }
            if (
                k == ICorporateActionEngine.ActionType.FORWARD_SPLIT
                    || k == ICorporateActionEngine.ActionType.REVERSE_SPLIT
                    || k == ICorporateActionEngine.ActionType.STOCK_DIVIDEND
            ) {
                s = Math.mulDiv(s, a.value, a.value2);
            } else if (k == ICorporateActionEngine.ActionType.CASH_DIVIDEND) {
                allowance += a.value2;
            } else if (k != ICorporateActionEngine.ActionType.NAME_CHANGE) {
                halted = true;
                emit VaultHalted(cursor);
            }
            ++cursor;
        }
        actionCursor = cursor;
        growthAllowance = allowance;
        if (s != structuralFactor) {
            structuralFactor = s;
            emit StructuralFactorUpdated(s);
        }
    }

    function _isPricedAction(ICorporateActionEngine.ActionType k) internal pure returns (bool) {
        return k == ICorporateActionEngine.ActionType.CASH_DIVIDEND
            || k == ICorporateActionEngine.ActionType.FORWARD_SPLIT
            || k == ICorporateActionEngine.ActionType.REVERSE_SPLIT
            || k == ICorporateActionEngine.ActionType.STOCK_DIVIDEND;
    }

    function _freeze(uint256 m, uint256 candidate) internal {
        if (!frozen) {
            frozen = true;
            emit Frozen(m, candidate);
        }
    }

    /// @dev Adds the yield all YT earned between two indexes to the liability bound (rounded up).
    function _accrueGlobal(uint256 from, uint256 to) internal {
        uint256 supply = yt.totalSupply();
        if (supply == 0) return;
        totalYieldOwed += Math.mulDiv(
            Math.mulDiv(supply, to - from, from, Math.Rounding.Ceil), WAD, to, Math.Rounding.Ceil
        );
    }

    function _checkpoint(address user) internal {
        uint256 idx = accrualIndex();
        uint256 prev = ytUserIndex[user];
        ytUserIndex[user] = idx;
        if (prev == 0 || idx <= prev) return;
        uint256 bal = yt.balanceOf(user);
        if (bal == 0) return;
        uint256 interest = Math.mulDiv(Math.mulDiv(bal, idx - prev, prev), WAD, idx);
        uint256 fee = interest * factory.yieldFeeBps() / BPS;
        accrued[user] += interest - fee;
        if (fee > 0) accrued[factory.treasury()] += fee;
    }

    function _tokenOraclePaused() internal view returns (bool) {
        try _token.oraclePaused() returns (bool p) {
            return p;
        } catch {
            return false;
        }
    }
}
