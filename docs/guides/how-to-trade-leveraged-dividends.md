---
description: How to buy Yield Tokens (YT) for high-beta dividend exposure, claim real-time dividends, and trade dividend cycles.
---

# How to Trade Leveraged Dividends

Trading **Yield Tokens (YT)** allows you to take leveraged, directional positions on corporate dividend policies, earnings dividend hikes, and high-yield ETF payouts using fractional capital.

---

## 🖥️ Step-by-Step Walkthrough

### Step 1: Access the Dividend Markets
Navigate to [xeroprotocol.com](https://xeroprotocol.com) and click on **Dividend Markets (YT)**.

### Step 2: Analyze Yields & Leverage Multipliers
Review the live analytical metrics provided by the [`BaseB20YieldLens`](../developers/smart-contract-reference.md#baseb20yieldlenssol):

* **Spot Stock Price ($P_{spot}$)**
* **Yield Token Price ($P_{YT}$)**
* **Implied Annualized Dividend Rate ($r$)**
* **Capital Leverage Multiplier ($P_{spot} / P_{YT}$)**

```
Example: xSCHDc-YT-1Y
Spot Price: $82.00  |  YT Price: $2.85  |  Leverage: 28.8x
```

### Step 3: Execute Purchase
1. Enter the amount of YT to buy (or amount of USDC to spend).
2. For example, spending **$285.00 USDC** buys **100 `xSCHDc-YT-1Y`** tokens, giving you dividend rights over **$8,200.00 worth of stock**!
3. Confirm the swap and sign the transaction.

---

## 🌾 Claiming Accrued Dividend Payouts

Whenever the underlying stock's corporate dividend distribution is processed:
1. The vault's internal dividend index automatically increments.
2. In the **Portfolio** tab, your "Claimable Dividends" balance updates in real-time.
3. Click **Claim Yield** to trigger [`claimYield()`](../developers/smart-contract-reference.md#claimyield).
4. The accrued dividend shares are transferred directly into your wallet.

{% hint style="info" %}
**No Need to Wait:** You do not have to wait until maturity to receive dividends. You can claim earned dividends after every quarterly distribution, or leave them in the contract to save gas.
{% endhint %}

---

## 🚪 Exiting Before Maturity

If dividend expectations rise, or if a company announces a dividend hike sooner than expected:
* The market price of your YT token will increase on the AMM.
* You can sell your YT tokens back into [`XeroYieldMarket.sol`](../developers/smart-contract-reference.md#xeroyieldmarket-amm) at any time prior to maturity to lock in trading profits.
