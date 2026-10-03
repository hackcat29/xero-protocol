// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IXeroVault} from "../interfaces/IXeroVault.sol";
import {IXeroMath} from "../interfaces/IXeroMath.sol";
import {IRiskGuardian} from "../interfaces/IRiskGuardian.sol";

/// @title XeroYieldMarket
/// @notice Maturity-aware market for one vault's Yield Token (YT) against its own Stock Token.
///
/// The pool quotes an implied rate r: Stock Tokens per YT unit per year. YT price = r * timeToMaturity,
/// so quotes decay toward zero as the dividend window closes, and traders move the rate itself.
/// Multiplying r by the vault's dividend index gives the market-implied dividend yield in share terms,
/// e.g. 0.004e18 = 0.4% a year. Pricing is delegated to an IXeroMath engine (Stylus on Arbitrum
/// chains, Solidity elsewhere). The pool's own YT accrues reinvested dividends, which are harvested
/// into the Stock Token reserve for LPs.
/// @dev This ERC-20 is the LP share. Both reserves are 18-decimal tokens.
contract XeroYieldMarket is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant YEAR = 365 days;
    uint256 internal constant MIN_LIQUIDITY = 1e3;
    uint256 internal constant MIN_P = 0.02e18;
    uint256 internal constant MAX_P = 0.98e18;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IXeroVault public immutable vault;
    IERC20 public immutable yt;
    /// @notice The vault's Stock Token, used as the quote asset.
    IERC20 public immutable quote;
    IXeroMath public immutable math;
    IRiskGuardian public immutable guardian;
    uint64 public immutable maturity;
    /// @notice Reference YT price (Stock Tokens, WAD) used to measure the pool proportion in value terms.
    uint256 public immutable refPrice;
    /// @notice Curve steepness: a larger scalar means less rate impact per unit of proportion change.
    int256 public immutable scalar;
    /// @notice Swap fee as a WAD fraction; retained by LPs.
    uint256 public immutable fee;
    address public immutable creator;

    bool public initialized;
    uint256 public reserveYt;
    uint256 public reserveQuote;
    /// @notice Last traded implied rate: Stock Tokens (WAD) per YT unit per year.
    int256 public lastRate;

    struct PoolState {
        uint256 reserveYt;
        uint256 reserveQuote;
        int256 impliedRate;
        uint256 tau;
        uint256 ytPrice;
        uint256 lpSupply;
        uint64 maturity;
        bool initialized;
    }

    event Initialized(address indexed to, uint256 ytAmount, uint256 quoteAmount, int256 initialRate, uint256 lp);
    event Swap(
        address indexed sender,
        address indexed to,
        uint256 ytIn,
        uint256 quoteIn,
        uint256 ytOut,
        uint256 quoteOut,
        int256 impliedRate
    );
    event LiquidityAdded(address indexed sender, address indexed to, uint256 ytAmount, uint256 quoteAmount, uint256 lp);
    event LiquidityRemoved(address indexed sender, address indexed to, uint256 ytAmount, uint256 quoteAmount, uint256 lp);
    event YieldHarvested(uint256 amount);

    error OnlyCreator();
    error AlreadyInitialized();
    error NotInitialized();
    error Expired();
    error InvalidParams();
    error Slippage();
    error ZeroAmount();

    constructor(
        IXeroVault vault_,
        IXeroMath math_,
        IRiskGuardian guardian_,
        uint256 refPrice_,
        int256 scalar_,
        uint256 fee_,
        address creator_
    )
        ERC20(
            string.concat("Xero LP ", IERC20Metadata(vault_.yieldToken()).symbol()),
            string.concat("XLP-", IERC20Metadata(vault_.yieldToken()).symbol())
        )
    {
        if (refPrice_ == 0 || scalar_ <= 0 || fee_ > 0.01e18) revert InvalidParams();
        vault = vault_;
        yt = IERC20(vault_.yieldToken());
        quote = IERC20(vault_.underlying());
        math = math_;
        guardian = guardian_;
        maturity = vault_.maturity();
        refPrice = refPrice_;
        scalar = scalar_;
        fee = fee_;
        creator = creator_;
    }

    // ================================================================ liquidity

    /// @notice Seed the pool and set the opening implied dividend rate.
    function initialize(uint256 ytAmount, uint256 quoteAmount, int256 initialRate, address to)
        external
        nonReentrant
        returns (uint256 lp)
    {
        if (msg.sender != creator) revert OnlyCreator();
        if (initialized) revert AlreadyInitialized();
        if (block.timestamp >= maturity) revert Expired();
        if (initialRate <= 0) revert InvalidParams();

        uint256 xv = ytAmount * refPrice / WAD;
        uint256 y = quoteAmount;
        if (xv + y == 0) revert ZeroAmount();
        uint256 p = xv * WAD / (xv + y);
        if (p < MIN_P || p > MAX_P) revert InvalidParams();

        yt.safeTransferFrom(msg.sender, address(this), ytAmount);
        quote.safeTransferFrom(msg.sender, address(this), quoteAmount);
        reserveYt = ytAmount;
        reserveQuote = quoteAmount;
        lastRate = initialRate;
        initialized = true;

        lp = xv + y - MIN_LIQUIDITY;
        _mint(DEAD, MIN_LIQUIDITY);
        _mint(to, lp);
        emit Initialized(to, ytAmount, quoteAmount, initialRate, lp);
    }

    /// @notice Add liquidity at the current reserve ratio (implied rate unchanged).
    function addLiquidity(uint256 ytMax, uint256 quoteMax, uint256 minLp, address to)
        external
        nonReentrant
        returns (uint256 lp, uint256 ytUsed, uint256 quoteUsed)
    {
        if (!initialized) revert NotInitialized();
        guardian.checkTrade(address(this));
        _harvest();
        uint256 supply = totalSupply();
        uint256 rYt = reserveYt;
        uint256 rQ = reserveQuote;
        uint256 lpYt = ytMax * supply / rYt;
        uint256 lpQ = quoteMax * supply / rQ;
        lp = lpYt < lpQ ? lpYt : lpQ;
        if (lp == 0) revert ZeroAmount();
        if (lp < minLp) revert Slippage();
        ytUsed = _ceilDiv(lp * rYt, supply);
        quoteUsed = _ceilDiv(lp * rQ, supply);

        yt.safeTransferFrom(msg.sender, address(this), ytUsed);
        quote.safeTransferFrom(msg.sender, address(this), quoteUsed);
        reserveYt = rYt + ytUsed;
        reserveQuote = rQ + quoteUsed;
        _mint(to, lp);
        emit LiquidityAdded(msg.sender, to, ytUsed, quoteUsed, lp);
    }

    /// @notice Withdraw liquidity pro rata. Always available, including when paused or matured.
    function removeLiquidity(uint256 lp, uint256 minYt, uint256 minQuote, address to)
        external
        nonReentrant
        returns (uint256 ytOut, uint256 quoteOut)
    {
        if (lp == 0) revert ZeroAmount();
        _harvest();
        uint256 supply = totalSupply();
        ytOut = lp * reserveYt / supply;
        quoteOut = lp * reserveQuote / supply;
        if (ytOut < minYt || quoteOut < minQuote) revert Slippage();
        _burn(msg.sender, lp);
        reserveYt -= ytOut;
        reserveQuote -= quoteOut;
        yt.safeTransfer(to, ytOut);
        quote.safeTransfer(to, quoteOut);
        emit LiquidityRemoved(msg.sender, to, ytOut, quoteOut, lp);
    }

    // ================================================================ swaps

    /// @notice Sell Yield Tokens for Stock Tokens.
    function swapExactYtForQuote(uint256 ytIn, uint256 minQuoteOut, address to)
        external
        nonReentrant
        returns (uint256 quoteOut)
    {
        _preTrade();
        (uint256 outWad, int256 newRate) =
            math.swapExactYtIn(reserveYt, reserveQuote, refPrice, lastRate, scalar, tau(), fee, ytIn);
        quoteOut = outWad;
        if (quoteOut == 0) revert ZeroAmount();
        if (quoteOut < minQuoteOut) revert Slippage();

        yt.safeTransferFrom(msg.sender, address(this), ytIn);
        reserveYt += ytIn;
        reserveQuote -= quoteOut;
        lastRate = newRate;
        quote.safeTransfer(to, quoteOut);
        emit Swap(msg.sender, to, ytIn, 0, 0, quoteOut, newRate);
    }

    /// @notice Buy Yield Tokens with Stock Tokens.
    function swapExactQuoteForYt(uint256 quoteIn, uint256 minYtOut, address to)
        external
        nonReentrant
        returns (uint256 ytOut)
    {
        _preTrade();
        int256 newRate;
        (ytOut, newRate) = math.swapExactQuoteIn(
            reserveYt, reserveQuote, refPrice, lastRate, scalar, tau(), fee, quoteIn
        );
        if (ytOut < minYtOut) revert Slippage();

        quote.safeTransferFrom(msg.sender, address(this), quoteIn);
        reserveQuote += quoteIn;
        reserveYt -= ytOut;
        lastRate = newRate;
        yt.safeTransfer(to, ytOut);
        emit Swap(msg.sender, to, 0, quoteIn, ytOut, 0, newRate);
    }

    /// @notice Pull yield accrued by the pool's YT into the Stock Token reserve.
    function harvest() external nonReentrant {
        _harvest();
    }

    // ================================================================ views

    /// @notice Time to maturity in years (WAD).
    function tau() public view returns (uint256) {
        return block.timestamp >= maturity ? 0 : (maturity - block.timestamp) * WAD / YEAR;
    }

    /// @notice Current YT price in Stock Tokens (WAD) implied by the last traded rate.
    function ytPrice() public view returns (uint256) {
        return lastRate > 0 ? uint256(lastRate) * tau() / WAD : 0;
    }

    function quoteYtForQuote(uint256 ytIn) external view returns (uint256 quoteOut, int256 newRate) {
        uint256 outWad;
        (outWad, newRate) =
            math.swapExactYtIn(reserveYt, reserveQuote, refPrice, lastRate, scalar, tau(), fee, ytIn);
        quoteOut = outWad;
    }

    function quoteQuoteForYt(uint256 quoteIn) external view returns (uint256 ytOut, int256 newRate) {
        (ytOut, newRate) = math.swapExactQuoteIn(
            reserveYt, reserveQuote, refPrice, lastRate, scalar, tau(), fee, quoteIn
        );
    }

    function getState() external view returns (PoolState memory s) {
        s = PoolState(reserveYt, reserveQuote, lastRate, tau(), ytPrice(), totalSupply(), maturity, initialized);
    }

    // ================================================================ internals

    function _preTrade() internal {
        if (!initialized) revert NotInitialized();
        if (block.timestamp >= maturity) revert Expired();
        guardian.checkTrade(address(this));
        _harvest();
    }

    function _harvest() internal {
        if (!initialized) return;
        uint256 amount = vault.claimYield(address(this));
        if (amount > 0) {
            reserveQuote += amount;
            emit YieldHarvested(amount);
        }
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
