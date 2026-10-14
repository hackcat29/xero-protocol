---
description: Deep-dive into Principal Tokens (PT), redemption mechanics, and fixed returns.
---

# Principal Tokens (PT)

A **Principal Token (PT)** represents ownership of the underlying tokenized stock's baseline capital, redeemable upon maturity date $T$.

---

## 🏷️ Naming Convention

Xero Principal Tokens are issued as standard ERC-20 tokens following the format:

$$\text{x}[SYMBOL]\text{-PT-}[TENOR]$$

* Example: `xNVDAc-PT-3M` (Principal Token for NVIDIA Corp, maturing in 3 months)
* Example: `xSCHDc-PT-1Y` (Principal Token for Schwab US Dividend Equity ETF, maturing in 1 year)

---

## 💰 How PT Works

When you buy or hold a Principal Token:
1. **Dividend-Free Capital:** The token does not receive any quarterly dividend distributions during its lifecycle.
2. **Upfront Discount:** Because future dividends are stripped out, the market prices PT at a discount to the spot stock price:
   $$P_{PT} = P_{spot} - P_{YT}$$
3. **Guaranteed 1:1 Redemption:** When the vault reaches its maturity timestamp $T$, the holder burns 1 PT to redeem **1 full underlying stock share**.

---

## 📈 Calculating Fixed APY

Because the discount is locked in at purchase and the redemption value at maturity is fixed, holding PT yields a **guaranteed fixed annual percentage yield (APY)**:

$$\text{Fixed APY} = \left( \frac{P_{spot} - P_{PT}}{P_{PT}} \right) \times \left( \frac{365}{\text{Days to Maturity}} \right) \times 100\%$$

### Example Calculation
* Spot Price of `NVDAc`: **$128.50**
* Market Price of `xNVDAc-PT-6M` (182 days): **$123.10**
* Discount: **$5.40 (4.2%)**
* **Fixed APY:**
  $$\text{Fixed APY} = \left( \frac{128.50 - 123.10}{123.10} \right) \times \left( \frac{365}{182} \right) \times 100\% = \mathbf{8.79\%}$$

An investor who purchases `xNVDAc-PT-6M` locks in an **8.79% annualized fixed return** in share terms, immune to any dividend cuts or corporate payment volatility.

---

## 🛡️ Risk Profile

* **Dividend Risk:** **Zero.** Even if the company completely eliminates its dividend payout, the PT still redeems for 1 full share at maturity.
* **Underlying Stock Price Risk:** **Yes.** At maturity, the investor receives the underlying stock share. If the stock's market price drops, the dollar value of the position decreases accordingly.
* **Smart Contract Risk:** The investor relies on the solvency of [`XeroVault.sol`](../developers/smart-contract-reference.md#xerovaultsol), which is collateralized 1:1 by underlying B20 assets.
