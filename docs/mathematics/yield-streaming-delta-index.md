---
description: Mathematical derivation of continuous dividend streaming, gas-efficient checkpointing, and accrued yield.
---

# Yield Streaming Delta Index

This document presents the mathematical derivation of Xero Protocol's dividend streaming engine, demonstrating how yield is continuously tracked and claimed without iterating through token holders.

---

## 💡 The Dividend Accrual Problem

In conventional staking systems, paying dividends to hundreds of thousands of individual token holders via a `for` loop would exceed Ethereum and Base block gas limits.

Xero Protocol solves this by implementing an **O(1) Checkpointed Index Model**.

---

## 📐 Mathematical Derivation of Interest

Let:
* $I_{prev}$ be the vault's dividend index recorded during the user's previous checkpoint.
* $I_{curr}$ be the current accrual index: $I_{curr} = \frac{M_t \times 10^{18}}{S_t}$.
* $B_{YT}$ be the user's Yield Token balance.

### 1. Capital Conversion Invariant
Recall that 1 unit of PT requires:
* At $I_{prev}$: $\frac{10^{18}}{I_{prev}}$ raw underlying stock shares.
* At $I_{curr}$: $\frac{10^{18}}{I_{curr}}$ raw underlying stock shares.

Because the underlying multiplier grew from dividend payments, **fewer raw shares** are needed to redeem the fixed baseline capital. The difference between these two states constitutes the **freed dividend cash flow** ($\Delta R$):

$$\Delta R = \frac{10^{18}}{I_{prev}} - \frac{10^{18}}{I_{curr}} = 10^{18} \times \left( \frac{I_{curr} - I_{prev}}{I_{prev} \times I_{curr}} \right)$$

### 2. User Accrual Formula
Multiplying the freed dividend shares per unit by the user's token balance $B_{YT}$:

$$\text{Gross Interest} = B_{YT} \times \left( \frac{I_{curr} - I_{prev}}{I_{prev}} \right) \times \left( \frac{10^{18}}{I_{curr}} \right)$$

In Solidity, this is computed using OpenZeppelin's `Math.mulDiv` to maintain 18-decimal precision and prevent overflow:

```solidity
uint256 interest = Math.mulDiv(
    Math.mulDiv(bal, idx - prev, prev), 
    WAD, 
    idx
);
```

---

## 🏛️ Protocol Yield Fee

A portion of accrued dividend yields is collected as a protocol fee (default: 300 bps or 3.0%):

$$\text{Fee} = \left\lfloor \frac{\text{Gross Interest} \times f_{yield}}{10,000} \right\rfloor$$

$$\text{Net User Accrual} = \text{Gross Interest} - \text{Fee}$$

* The net interest is added to `accrued[user]`.
* The fee is added to `accrued[factory.treasury()]`.
* The user's index is updated: `ytUserIndex[user] = I_{curr}`.

---

## ⚡ Transfer Hook Settlement (`onYieldTransfer`)

To prevent flash-loan exploits or double-dipping, whenever Yield Tokens are transferred between accounts:
1. The token contract executes an on-transfer hook:
   ```solidity
   vault.onYieldTransfer(from, to);
   ```
2. The vault synchronizes the global index: `_sync()`.
3. The vault updates both `from` and `to` checkpoints **before** token balances change:
   * Accrues all past earned yield to `from`.
   * Fast-forwards `to`'s index to $I_{curr}$ to prevent retroactive yield harvesting.

---

## 🛡️ Solvency Invariant

At any given block, the total collateral held in the vault ($C$) must strictly cover:
1. Total raw tokens required to redeem all existing PT units:
   $$\text{PT Liability} = \left\lceil \frac{\text{Supply}_{PT} \times 10^{18}}{I_{accrual}} \right\rceil$$
2. Total outstanding yield owed to all YT holders and the treasury:
   $$\text{Yield Liability} = \text{totalYieldOwed}$$

$$\text{Collateral} + \epsilon \ge \text{PT Liability} + \text{Yield Liability}$$

This formal invariant is continuously asserted on-chain by `invariantHolds()` in [`XeroVault.sol`](../developers/smart-contract-reference.md#xerovaultsol).
