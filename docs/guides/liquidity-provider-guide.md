---
description: Guide to providing liquidity on Xero Yield Markets, earning swap fees, and auto-compounding stock dividends.
---

# Liquidity Provider (LP) Guide

Liquidity Providers (LPs) supply depth to [`XeroYieldMarket.sol`](../developers/smart-contract-reference.md#xeroyieldmarket-amm) pools, enabling smooth swaps between Yield Tokens (YT) and underlying Stock Tokens while collecting protocol swap fees and auto-harvested dividend yields.

---

## 💎 The LP Value Proposition

Providing liquidity on Xero offers distinct structural advantages over traditional constant-product (Uniswap) pools:

```
                  ┌──────────────────────────────┐
                  │      Dual Income Engine      │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
  Swap Trading Fees                              Auto-Harvested Yield
  (30 bps on every swap)                         (Reinvested pool dividends)
```

1. **Immunity to Time-Decay Arbitrage:** Because the pool pricing engine evaluates the implied rate $r$ multiplied by $\tau = \frac{T - t}{365}$, the pool's quote naturally decays with time. LPs are **not** arbitraged by the simple passage of time.
2. **Auto-Compounding Dividend Growth:** The pool's YT reserve generates real dividend distributions from the underlying stock. These payouts are harvested directly into the pool's quote asset reserve, increasing the intrinsic value of every LP token.
3. **Swap Fees:** A 30 bps (0.30%) swap fee is retained entirely by liquidity providers.

---

## 🛠️ How to Provide Liquidity

### Step 1: Open the Pools Interface
Navigate to [xeroprotocol.com](https://xeroprotocol.com) and click on **Liquidity Pools**.

### Step 2: Choose a Market
Select the pool corresponding to the asset and tenor (e.g., `NVDAc / xNVDAc-YT-6M`).

### Step 3: Deposit Assets
You can provide liquidity in two ways:
* **Dual-Sided Deposit:** Supply equal values of Yield Tokens (YT) and Quote Stock Tokens.
* **Single-Asset Deposit (Auto-Strip):** Supply raw B20 stock tokens; the UI automatically strips a portion into YT to balance the pool ratio.

### Step 4: Receive LP Tokens (`XLP`)
Upon deposit, the contract mints LP shares:

$$\text{XLP-x}[SYMBOL]\text{-YT-}[TENOR]$$

These LP tokens represent your pro-rata claim on both token reserves and all accumulated harvested dividends.

---

## 🌾 Harvesting Pool Dividends

Anyone can trigger the auto-harvesting function on the pool:

```solidity
XeroYieldMarket(poolAddress).harvestYield();
```

* Claims accrued stock dividends from [`XeroVault.sol`](../developers/smart-contract-reference.md#xerovaultsol).
* Deposits the received stock shares directly into `reserveQuote`.
* Increases the redemption value of all LP shares.

---

## 📤 Withdrawing Liquidity

You can withdraw your liquidity at any time prior to or after maturity:
1. Navigate to your **Active LP Positions**.
2. Click **Remove Liquidity** and choose the withdrawal percentage.
3. Confirm the transaction to burn your `XLP` shares and receive your pro-rata share of YT and Stock Tokens.
