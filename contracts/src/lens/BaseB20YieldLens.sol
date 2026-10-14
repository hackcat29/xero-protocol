// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IScaledUIAmount} from "../interfaces/IScaledUIAmount.sol";
import {IXeroOracle} from "../interfaces/IXeroOracle.sol";
import {IXeroVault} from "../interfaces/IXeroVault.sol";
import {XeroVault} from "../XeroVault.sol";

/// @title BaseB20YieldLens
/// @notice Analytical lens for Coinbase B20 tokenized stocks on Base.
///         Deconstructs the B20 Multiplier into Principal Token (PT) and Yield Token (YT) metrics,
///         powers Fixed Yield Sourcing, Dividend Speculation leverage, and Discounted Stock Buying.
contract BaseB20YieldLens {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    IXeroOracle public immutable oracle;

    struct B20EquityMetrics {
        address token;
        string name;
        string symbol;
        uint256 currentMultiplier;
        uint256 spotPriceUsd; // WAD (18 decimals)
        uint256 totalSupplyRaw;
        uint256 totalSupplyUI;
        uint256 userRawBalance;
        uint256 userUIBalance;
        bool isPaused;
    }

    struct B20VaultOverview {
        address vault;
        address b20Token;
        address ptToken;
        address ytToken;
        uint64 maturity;
        uint64 timeToMaturity;
        bool isMatured;
        uint256 dividendIndex;
        uint256 maturityIndex;
        uint256 userPtBalance;
        uint256 userYtBalance;
        uint256 userClaimableYieldRaw;
        uint256 ptRedemptionBaselineRaw; // raw stock per PT unit at maturity
    }

    struct DiscountedStockQuote {
        uint256 spotPriceUsd;
        uint256 ptPriceUsd;
        uint256 discountUsd;
        uint256 discountBps;
        uint256 fixedApyBps; // Annualized return holding PT to maturity
    }

    struct FixedYieldQuote {
        uint256 spotPriceUsd;
        uint256 ytPriceUsd;
        uint256 upfrontCashBps; // Upfront cash return as percentage of spot stock price
        uint256 fixedApyBps;    // Guaranteed upfront APY locked in by stripping and selling YT
    }

    struct DividendSpeculationMetrics {
        uint256 spotPriceUsd;
        uint256 ytPriceUsd;
        uint256 leverageMultiplierWad; // Spot price / YT price (e.g. 80x capital efficiency)
        uint256 breakevenYieldBps;     // Dividend yield required over tenor to break even on YT
    }

    constructor(IXeroOracle oracle_) {
        oracle = oracle_;
    }

    /// @notice Returns full B20 asset metrics including multiplier, balances, and Chainlink oracle price.
    function getB20Metrics(address token, address user) external view returns (B20EquityMetrics memory m) {
        IScaledUIAmount s = IScaledUIAmount(token);
        uint256 mult = s.uiMultiplier();
        (uint256 price, ) = oracle.getPrice(token);

        string memory name = "";
        string memory symbol = "";
        try IERC20Metadata(token).name() returns (string memory n) { name = n; } catch {}
        try IERC20Metadata(token).symbol() returns (string memory sy) { symbol = sy; } catch {}

        uint256 rawBal = user != address(0) ? IERC20(token).balanceOf(user) : 0;
        uint256 uiBal = Math.mulDiv(rawBal, mult, WAD);
        uint256 totalRaw = IERC20(token).totalSupply();
        uint256 totalUI = Math.mulDiv(totalRaw, mult, WAD);

        m = B20EquityMetrics({
            token: token,
            name: name,
            symbol: symbol,
            currentMultiplier: mult,
            spotPriceUsd: price,
            totalSupplyRaw: totalRaw,
            totalSupplyUI: totalUI,
            userRawBalance: rawBal,
            userUIBalance: uiBal,
            isPaused: false
        });
    }

    function getVaultOverview(address vaultAddr, address user) external view returns (B20VaultOverview memory v) {
        XeroVault vault = XeroVault(vaultAddr);
        v.vault = vaultAddr;
        v.b20Token = vault.underlying();
        v.ptToken = address(vault.pt());
        v.ytToken = address(vault.yt());
        v.maturity = vault.maturity();
        v.isMatured = block.timestamp >= v.maturity;
        v.timeToMaturity = v.isMatured ? 0 : uint64(v.maturity - block.timestamp);
        v.dividendIndex = vault.dividendIndex();
        v.maturityIndex = vault.maturityIndex();

        if (user != address(0)) {
            if (v.ptToken != address(0)) v.userPtBalance = IERC20(v.ptToken).balanceOf(user);
            if (v.ytToken != address(0)) v.userYtBalance = IERC20(v.ytToken).balanceOf(user);
            v.userClaimableYieldRaw = vault.claimable(user);
        }

        uint256 effIdx = v.maturityIndex > 0 ? v.maturityIndex : v.dividendIndex;
        v.ptRedemptionBaselineRaw = effIdx > 0 ? Math.mulDiv(WAD, WAD, effIdx) : WAD;
    }

    /// @notice Computes Discounted Stock Buying economics for purchasing PT at a discount.
    function getDiscountedStockQuote(
        address token,
        uint256 ptPriceUsd,
        uint64 timeToMaturity
    ) external view returns (DiscountedStockQuote memory q) {
        (uint256 spotPrice, ) = oracle.getPrice(token);
        if (spotPrice == 0 || ptPriceUsd >= spotPrice || timeToMaturity == 0) {
            return DiscountedStockQuote({
                spotPriceUsd: spotPrice,
                ptPriceUsd: ptPriceUsd,
                discountUsd: 0,
                discountBps: 0,
                fixedApyBps: 0
            });
        }

        uint256 discountUsd = spotPrice - ptPriceUsd;
        uint256 discountBps = Math.mulDiv(discountUsd, BPS, spotPrice);

        uint256 annualizedReturn = Math.mulDiv(discountUsd, BPS, ptPriceUsd);
        uint256 fixedApyBps = Math.mulDiv(annualizedReturn, SECONDS_PER_YEAR, timeToMaturity);

        q = DiscountedStockQuote({
            spotPriceUsd: spotPrice,
            ptPriceUsd: ptPriceUsd,
            discountUsd: discountUsd,
            discountBps: discountBps,
            fixedApyBps: fixedApyBps
        });
    }

    /// @notice Computes Fixed Yield Sourcing economics when an investor strips B20 and sells YT upfront.
    function getFixedYieldQuote(
        address token,
        uint256 ytPriceUsd,
        uint64 timeToMaturity
    ) external view returns (FixedYieldQuote memory q) {
        (uint256 spotPrice, ) = oracle.getPrice(token);
        if (spotPrice == 0 || ytPriceUsd == 0 || timeToMaturity == 0) {
            return FixedYieldQuote({
                spotPriceUsd: spotPrice,
                ytPriceUsd: ytPriceUsd,
                upfrontCashBps: 0,
                fixedApyBps: 0
            });
        }

        uint256 upfrontCashBps = Math.mulDiv(ytPriceUsd, BPS, spotPrice);
        uint256 fixedApyBps = Math.mulDiv(upfrontCashBps, SECONDS_PER_YEAR, timeToMaturity);

        q = FixedYieldQuote({
            spotPriceUsd: spotPrice,
            ytPriceUsd: ytPriceUsd,
            upfrontCashBps: upfrontCashBps,
            fixedApyBps: fixedApyBps
        });
    }

    /// @notice Evaluates Dividend Speculation leverage and breakeven requirements for YT buyers.
    function getDividendSpeculationMetrics(
        address token,
        uint256 ytPriceUsd,
        uint64 timeToMaturity
    ) external view returns (DividendSpeculationMetrics memory m) {
        (uint256 spotPrice, ) = oracle.getPrice(token);
        if (spotPrice == 0 || ytPriceUsd == 0 || timeToMaturity == 0) {
            return DividendSpeculationMetrics({
                spotPriceUsd: spotPrice,
                ytPriceUsd: ytPriceUsd,
                leverageMultiplierWad: 0,
                breakevenYieldBps: 0
            });
        }

        uint256 leverageWad = Math.mulDiv(spotPrice, WAD, ytPriceUsd);
        uint256 rawBreakevenBps = Math.mulDiv(ytPriceUsd, BPS, spotPrice);
        uint256 annualizedBreakevenBps = Math.mulDiv(rawBreakevenBps, SECONDS_PER_YEAR, timeToMaturity);

        m = DividendSpeculationMetrics({
            spotPriceUsd: spotPrice,
            ytPriceUsd: ytPriceUsd,
            leverageMultiplierWad: leverageWad,
            breakevenYieldBps: annualizedBreakevenBps
        });
    }

    /// @notice Helper to project accumulated yield from multiplier growth delta:
    ///         Y = Tokens Held * (M_current / M_last - 1)
    function calculateAccumulatedYield(
        uint256 tokensHeld,
        uint256 currentMultiplier,
        uint256 lastClaimMultiplier
    ) external pure returns (uint256 yieldDeltaRaw) {
        if (currentMultiplier <= lastClaimMultiplier || lastClaimMultiplier == 0) return 0;
        uint256 growthDelta = currentMultiplier - lastClaimMultiplier;
        uint256 yieldInUnits = Math.mulDiv(tokensHeld, growthDelta, lastClaimMultiplier);
        yieldDeltaRaw = Math.mulDiv(yieldInUnits, WAD, currentMultiplier);
    }
}
