// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {XeroYieldMarket} from "./XeroYieldMarket.sol";
import {XeroVault} from "../XeroVault.sol";
import {IXeroMath} from "../interfaces/IXeroMath.sol";
import {IXeroOracle} from "../interfaces/IXeroOracle.sol";
import {IScaledUIAmount} from "../interfaces/IScaledUIAmount.sol";

interface IXeroFactoryView {
    function vaultsOf(address underlying) external view returns (address[] memory);
}

interface IYieldMarketFactoryView {
    function poolOf(address vault) external view returns (address);
}

/// @title CurveLens
/// @notice Read-only aggregator for frontends and integrators. For one Stock Token it returns every
///         maturity (live and matured) with its implied dividend yield, PT and YT prices, and the
///         forward yields between live maturities: the onchain implied dividend curve.
contract CurveLens {
    uint256 internal constant WAD = 1e18;

    IXeroFactoryView public immutable factory;
    IYieldMarketFactoryView public immutable markets;
    IXeroOracle public immutable oracle;
    IXeroMath public immutable math;

    struct CurvePoint {
        address vault;
        address market;
        address principalToken;
        address yieldToken;
        uint64 maturity;
        bool matured;
        bool frozen;
        bool halted;
        uint256 tau;
        /// @dev Stock Tokens per YT unit per year implied by the market.
        int256 impliedRate;
        /// @dev Implied dividend yield in share terms (WAD fraction per year): impliedRate * dividendIndex.
        int256 impliedYield;
        /// @dev YT and PT prices in Stock Tokens per unit.
        uint256 ytPrice;
        uint256 ptPrice;
        /// @dev USD values per unit (0 when the oracle price is stale or missing).
        uint256 ytPriceUsd;
        uint256 ptPriceUsd;
        uint256 dividendIndex;
        uint256 structuralFactor;
        uint256 totalUnits;
        uint256 reserveYt;
        uint256 reserveQuote;
    }

    struct Curve {
        address token;
        string symbol;
        string name;
        uint256 multiplier;
        uint256 priceUsd;
        bool priceFresh;
        CurvePoint[] points;
        /// @dev forwards[i]: implied dividend yield between live maturity i-1 and i (first: spot to 0).
        int256[] forwards;
    }

    constructor(IXeroFactoryView factory_, IYieldMarketFactoryView markets_, IXeroOracle oracle_, IXeroMath math_) {
        factory = factory_;
        markets = markets_;
        oracle = oracle_;
        math = math_;
    }

    function getCurve(address token) external view returns (Curve memory c) {
        c.token = token;
        c.symbol = IERC20Metadata(token).symbol();
        c.name = IERC20Metadata(token).name();
        c.multiplier = IScaledUIAmount(token).uiMultiplier();
        try oracle.getPrice(token) returns (uint256 p, uint256) {
            c.priceUsd = p;
            c.priceFresh = true;
        } catch {}

        address[] memory vaults = factory.vaultsOf(token);
        CurvePoint[] memory pts = new CurvePoint[](vaults.length);
        for (uint256 i; i < vaults.length; ++i) {
            pts[i] = _point(XeroVault(vaults[i]), c.priceFresh ? c.priceUsd : 0);
        }
        _sortByMaturity(pts);
        c.points = pts;
        c.forwards = _forwards(pts);
    }

    function _point(XeroVault v, uint256 priceUsd) internal view returns (CurvePoint memory p) {
        p.vault = address(v);
        p.market = markets.poolOf(address(v));
        p.principalToken = v.principalToken();
        p.yieldToken = v.yieldToken();
        p.maturity = v.maturity();
        p.matured = v.isMatured();
        p.frozen = v.frozen();
        p.halted = v.halted();
        p.dividendIndex = v.accrualIndex();
        p.structuralFactor = v.structuralFactor();
        p.totalUnits = v.totalUnits();

        uint256 parValue = Math.mulDiv(WAD, WAD, p.dividendIndex); // Stock Tokens per unit today
        if (p.market != address(0)) {
            XeroYieldMarket.PoolState memory s = XeroYieldMarket(p.market).getState();
            if (s.initialized) {
                p.tau = s.tau;
                p.impliedRate = s.impliedRate;
                p.impliedYield = s.impliedRate * int256(p.dividendIndex) / int256(WAD);
                p.ytPrice = s.ytPrice;
                p.reserveYt = s.reserveYt;
                p.reserveQuote = s.reserveQuote;
            }
        }
        p.ptPrice = parValue > p.ytPrice ? parValue - p.ytPrice : 0;
        if (priceUsd > 0) {
            p.ytPriceUsd = Math.mulDiv(p.ytPrice, priceUsd, WAD);
            p.ptPriceUsd = Math.mulDiv(p.ptPrice, priceUsd, WAD);
        }
    }

    function _sortByMaturity(CurvePoint[] memory pts) internal pure {
        for (uint256 i = 1; i < pts.length; ++i) {
            CurvePoint memory key = pts[i];
            uint256 j = i;
            while (j > 0 && pts[j - 1].maturity > key.maturity) {
                pts[j] = pts[j - 1];
                --j;
            }
            pts[j] = key;
        }
    }

    /// @dev Forward yields across live, priced maturities; cumulative value = impliedYield * tau.
    function _forwards(CurvePoint[] memory pts) internal view returns (int256[] memory out) {
        uint256 n;
        for (uint256 i; i < pts.length; ++i) {
            if (!pts[i].matured && pts[i].tau > 0 && pts[i].impliedYield > 0) ++n;
        }
        if (n == 0) return out;
        uint256[] memory taus = new uint256[](n);
        uint256[] memory values = new uint256[](n);
        uint256 k;
        for (uint256 i; i < pts.length; ++i) {
            CurvePoint memory p = pts[i];
            if (p.matured || p.tau == 0 || p.impliedYield <= 0) continue;
            taus[k] = p.tau;
            values[k] = Math.mulDiv(uint256(p.impliedYield), p.tau, WAD);
            ++k;
        }
        try math.forwardRates(taus, values) returns (int256[] memory f) {
            out = f;
        } catch {}
    }
}
