// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {XeroVault} from "../XeroVault.sol";
import {XeroYieldMarket} from "../market/XeroYieldMarket.sol";

interface IVaultRegistryView {
    function isVault(address) external view returns (bool);
}

/// @title XeroRouter
/// @notice Stateless convenience flows that combine vault and market calls in one transaction.
///         Holds no funds between calls; every flow ends with zero router balances.
contract XeroRouter is Multicall, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IVaultRegistryView public immutable registry;

    /// @dev Upper bound on strip-and-sell rounds in `buyPrincipal`; each round reinvests the previous round's
    ///      YT proceeds, which shrink geometrically with the PT discount.
    uint256 internal constant BUY_ROUNDS = 4;

    error UnknownVault();
    error MarketMismatch();
    error InsufficientOutput();

    constructor(IVaultRegistryView registry_) {
        registry = registry_;
    }

    /// @notice Strip `raw` Stock Tokens, keep the Principal Token, and sell the Yield Token for Stock
    ///         Tokens: a holder monetises expected dividends upfront and keeps the share exposure.
    /// @return units PT delivered to `to` @return quoteOut Stock Tokens received for the YT
    function stripAndSellYield(XeroVault vault, XeroYieldMarket market, uint256 raw, uint256 minQuoteOut, address to)
        external
        nonReentrant
        returns (uint256 units, uint256 quoteOut)
    {
        _checkPair(vault, market);
        IERC20 token = IERC20(vault.underlying());
        token.safeTransferFrom(msg.sender, address(this), raw);
        token.forceApprove(address(vault), raw);
        units = vault.strip(raw, address(this));

        IERC20(address(vault.yt())).forceApprove(address(market), units);
        quoteOut = market.swapExactYtForQuote(units, minQuoteOut, to);
        IERC20(address(vault.pt())).safeTransfer(to, units);
    }

    /// @notice Buy Principal Tokens with `raw` Stock Tokens: strip, sell the YT for Stock Tokens, and strip the
    ///         proceeds again, so `raw` buys roughly raw / (1 - discount) worth of PT. Stops once a round's
    ///         proceeds fall under 1 bp of `raw` and returns the remainder to `to`.
    /// @return units PT delivered to `to` @return refund Stock Tokens returned to `to`
    function buyPrincipal(XeroVault vault, XeroYieldMarket market, uint256 raw, uint256 minUnitsOut, address to)
        external
        nonReentrant
        returns (uint256 units, uint256 refund)
    {
        _checkPair(vault, market);
        IERC20 token = IERC20(vault.underlying());
        IERC20 yt = IERC20(address(vault.yt()));
        token.safeTransferFrom(msg.sender, address(this), raw);

        refund = raw;
        for (uint256 i; i < BUY_ROUNDS && refund * 10_000 >= raw; ++i) {
            token.forceApprove(address(vault), refund);
            uint256 u = vault.strip(refund, address(this));
            units += u;
            yt.forceApprove(address(market), u);
            refund = market.swapExactYtForQuote(u, 0, address(this));
        }
        if (units < minUnitsOut) revert InsufficientOutput();

        IERC20(address(vault.pt())).safeTransfer(to, units);
        if (refund > 0) token.safeTransfer(to, refund);
    }

    /// @notice Provide liquidity from Stock Tokens alone. Splits just enough of `raw` that its YT and the rest of
    ///         the stock match the pool's reserve ratio, adds both, and sends the LP shares, the PT and any unused
    ///         tokens to `to`. PT + pooled YT + pooled stock keep the depositor's full share exposure.
    /// @return lp LP shares minted to `to` @return units PT delivered to `to`
    function addLiquidityFromStock(XeroVault vault, XeroYieldMarket market, uint256 raw, uint256 minLp, address to)
        external
        nonReentrant
        returns (uint256 lp, uint256 units)
    {
        _checkPair(vault, market);
        IERC20 token = IERC20(vault.underlying());
        token.safeTransferFrom(msg.sender, address(this), raw);

        // split x so that units(x) : (raw - x) = reserveYt : reserveQuote, with units(x) linear in x
        uint256 a = raw * market.reserveYt();
        uint256 x = Math.mulDiv(raw, a, a + vault.previewStrip(raw) * market.reserveQuote());
        token.forceApprove(address(vault), x);
        units = vault.strip(x, address(this));

        lp = _addAndRefund(vault, market, token, units, raw - x, minLp, to);
        IERC20(address(vault.pt())).safeTransfer(to, units);
    }

    function _addAndRefund(
        XeroVault vault,
        XeroYieldMarket market,
        IERC20 token,
        uint256 units,
        uint256 quote,
        uint256 minLp,
        address to
    ) internal returns (uint256 lp) {
        IERC20 yt = IERC20(address(vault.yt()));
        yt.forceApprove(address(market), units);
        token.forceApprove(address(market), quote);
        (uint256 minted, uint256 ytUsed, uint256 quoteUsed) = market.addLiquidity(units, quote, minLp, to);
        if (units > ytUsed) yt.safeTransfer(to, units - ytUsed);
        if (quote > quoteUsed) token.safeTransfer(to, quote - quoteUsed);
        return minted;
    }

    /// @notice Withdraw liquidity back into Stock Tokens before maturity: remove `lp`, rejoin the pool's YT with
    ///         the caller's PT, and send the stock (plus any YT the caller has no PT for) to `to`. Approve the router
    ///         for the LP shares and the PT first.
    /// @return raw Stock Tokens delivered to `to`
    function removeLiquidityToStock(XeroVault vault, XeroYieldMarket market, uint256 lp, uint256 minRaw, address to)
        external
        nonReentrant
        returns (uint256 raw)
    {
        _checkPair(vault, market);
        IERC20 pt = IERC20(address(vault.pt()));
        IERC20(address(market)).safeTransferFrom(msg.sender, address(this), lp);
        (uint256 ytOut, uint256 quoteOut) = market.removeLiquidity(lp, 0, 0, address(this));

        uint256 held = pt.balanceOf(msg.sender);
        uint256 units = ytOut < held ? ytOut : held;
        if (units > 0) {
            pt.safeTransferFrom(msg.sender, address(this), units);
            raw = vault.recombine(units, address(this));
        }
        raw += quoteOut;
        if (raw < minRaw) revert InsufficientOutput();

        IERC20(vault.underlying()).safeTransfer(to, raw);
        if (ytOut > units) IERC20(address(vault.yt())).safeTransfer(to, ytOut - units);
    }

    /// @notice Strip `raw` Stock Tokens and deliver both PT and YT to `to`.
    function strip(XeroVault vault, uint256 raw, address to) external nonReentrant returns (uint256 units) {
        if (!registry.isVault(address(vault))) revert UnknownVault();
        IERC20 token = IERC20(vault.underlying());
        token.safeTransferFrom(msg.sender, address(this), raw);
        token.forceApprove(address(vault), raw);
        units = vault.strip(raw, address(this));
        IERC20(address(vault.pt())).safeTransfer(to, units);
        IERC20(address(vault.yt())).safeTransfer(to, units);
    }

    /// @notice Exit a full position before maturity: recombine PT+YT and claim accrued yield.
    function exit(XeroVault vault, uint256 units, address to) external nonReentrant returns (uint256 raw, uint256 yield_) {
        if (!registry.isVault(address(vault))) revert UnknownVault();
        yield_ = vault.claimYield(msg.sender);
        IERC20(address(vault.pt())).safeTransferFrom(msg.sender, address(this), units);
        IERC20(address(vault.yt())).safeTransferFrom(msg.sender, address(this), units);
        raw = vault.recombine(units, to);
    }

    /// @notice Permit helper for multicall; ignores failures so a front-run permit can't block the batch.
    function selfPermit(IERC20Permit token, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        try token.permit(msg.sender, address(this), value, deadline, v, r, s) {} catch {}
    }

    function _checkPair(XeroVault vault, XeroYieldMarket market) internal view {
        if (!registry.isVault(address(vault))) revert UnknownVault();
        if (address(market.vault()) != address(vault)) revert MarketMismatch();
    }
}
