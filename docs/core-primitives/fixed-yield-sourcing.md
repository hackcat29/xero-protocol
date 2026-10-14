---
description: Lock in guaranteed upfront cash returns on tokenized equities with zero dividend volatility.
---

# 1. Fixed Yield Sourcing

**Fixed Yield Sourcing** is a core primitive of Xero Protocol designed for institutional investors, treasury managers, and equity holders who want to monetize future dividend cash flows **today**, eliminating corporate payout uncertainty.

---

## 🎯 The Core Concept

In traditional equity markets, an investor holding shares in dividend-paying stocks must wait for scheduled quarterly distributions. If management cuts the dividend, the investor suffers cash-flow degradation.

With Xero Protocol, equity holders can **pre-sell their future dividends** on day one:

```
Step 1: Deposit B20 Stock Token (e.g. 100 SCHDc)
   ↓
Step 2: Vault strips into 100 PT + 100 YT
   ↓
Step 3: Sell 100 YT immediately on Xero AMM
   ↓
Result: Pocket instant cash today + Keep 100 PT to redeem 100 full shares at maturity!
```

---

## 🔄 Step-by-Step Execution

### 1. Deposit & Strip
The user deposits their raw B20 token (e.g., `SCHDc`) into the maturity-specific vault via [`strip()`](../developers/smart-contract-reference.md#strip).
* Input: `100.0` raw B20 shares
* Protocol fee: 5 bps (0.05%)
* Output minted: `99.95` `xSCHDc-PT-1Y` and `99.95` `xSCHDc-YT-1Y`

### 2. Sell the YT
The user immediately sells their `xSCHDc-YT-1Y` tokens into the [`XeroYieldMarket.sol`](../developers/smart-contract-reference.md#xeroyieldmarket-amm) liquidity pool.
* Sale proceeds: Instant cash (paid in underlying stock shares or routed to USDC via DEX aggregators).

### 3. Hold PT to Maturity
The investor holds the PT tokens in their cold storage or DeFi wallet. At the maturity date $T$, the investor calls [`redeem()`](../developers/smart-contract-reference.md#redeem) and receives their exact principal of stock shares back.

---

## 📊 Worked Numerical Example

| Parameter | Value |
| :--- | :--- |
| **Asset** | Schwab US Dividend Equity ETF (`SCHDc`) |
| **Spot Stock Price** | $82.00 |
| **Deposit Amount** | 100 shares ($8,200.00) |
| **Tenor** | 1 Year (365 days) |
| **Market Implied Yield ($r$)** | 3.50% annualized |
| **YT Sale Price ($P_{YT}$)** | $2.87 per unit |

### Execution Breakdown:
1. **Upfront Cash Collected:**
   $$100 \text{ YT} \times \$2.87 = \mathbf{\$287.00 \text{ in immediate cash}}$$
2. **Capital Retained:**
   $$100 \text{ PT} \xrightarrow{\text{at maturity } T} \mathbf{100 \text{ full } SCHDc \text{ shares}}$$
3. **Guaranteed Return:**
   $$\text{Fixed Cash Yield} = \frac{\$287.00}{\$8,200.00} = \mathbf{3.50\% \text{ upfront}}$$

{% hint style="info" %}
**Zero Dividend Risk:** Even if the underlying company reduces or skips dividends during the next 12 months, the investor's upfront cash is already locked in their wallet.
{% endhint %}

---

## ⚖️ Fixed Yield vs. Buy-and-Hold

| Feature | TradFi / Spot Holding | Xero Fixed Yield Sourcing |
| :--- | :--- | :--- |
| **Timing of Yield** | Dripped quarterly over 12 months | **100% upfront on Day 1** |
| **Dividend Cut Risk** | Investor absorbs loss | **Zero risk** (buyer of YT absorbs volatility) |
| **Reinvestment Risk** | Must manually reinvest small payments | Upfront lump sum can be redeployed immediately |
| **Final Stock Ownership** | 100 shares | **100 shares (1:1 PT redemption)** |
