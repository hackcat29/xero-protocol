---
description: Mathematical derivation of Yield-Space pricing, rate anchoring, logarithmic curves, and time-decay protection for LPs.
---

# Yield-Space AMM Invariant

This document details the pricing equations and mathematical invariant powering [`XeroYieldMarket.sol`](../developers/smart-contract-reference.md#xeroyieldmarket-amm), explaining why standard constant-product AMMs fail for decaying yield assets and how Xero provides zero-time-arbitrage market making.

---

## 🛑 Why Constant-Product AMMs ($x \cdot y = k$) Fail for YT

A Yield Token (YT) has a fixed expiration date $T$. As time passes, the remaining dividend collection window shrinks, and the token's intrinsic value naturally decays toward zero ($P_{YT} \to 0$).

In a standard Uniswap-style AMM:
1. The pricing curve assumes tokens have eternal duration and symmetric value drift.
2. As time passes without trades, arbitrageurs sell decaying YT into the pool and siphon off the valuable Stock Token reserve.
3. Liquidity Providers (LPs) suffer catastrophic, irreversible **divergence loss**.

---

## 📐 The Yield-Space Market Invariant

To eliminate time-decay arbitrage, Xero quotes an **Implied Annualized Rate ($r$)** rather than an absolute token price:

$$P_{YT} = r \times \tau$$

Where:
* $r$ is the market-implied dividend rate (expressed in quote Stock Tokens per YT unit per year).
* $\tau$ is the normalized time-to-maturity in years:
  $$\tau = \frac{T - t}{365 \text{ days}}$$

{% hint style="info" %}
**Zero Arbitrage from Time Decay:** Because the AMM pricing function multiplies the rate $r$ by $\tau$, the spot price $P_{YT}$ decays continuously toward zero as time elapses without any trade occurring. Arbitrageurs cannot profit simply from the passage of time!
{% endhint %}

---

## 📈 Logarithmic Rate Bonding Curve

The pool relates the implied rate $r$ to the proportion $p$ of Yield Tokens in the pool:

$$r(p) = r_{\text{anchor}} - \frac{1}{\text{scalar}} \times \ln\left( \frac{p}{1 - p} \right)$$

### Proportion ($p$) Definition
The proportion $p$ is measured in value terms using a fixed pool reference price ($\text{refPrice}$):

$$p = \frac{\text{reserve}_{YT} \times \text{refPrice}}{(\text{reserve}_{YT} \times \text{refPrice}) + \text{reserve}_{Quote}}$$

Bounded strictly within:
$$0.02 \le p \le 0.98$$

### Market Dynamics:
* **Selling YT into the pool:** Increases $\text{reserve}_{YT} \implies p \uparrow \implies \ln\left(\frac{p}{1-p}\right) \uparrow \implies r \downarrow$. (Higher supply lowers the market-implied dividend rate).
* **Buying YT from the pool:** Decreases $\text{reserve}_{YT} \implies p \downarrow \implies \ln\left(\frac{p}{1-p}\right) \downarrow \implies r \uparrow$. (Higher demand raises the market-implied dividend rate).

---

## ⚓ Continuous Rate Anchoring

To ensure path independence and prevent price gaps between swaps, the parameter $r_{\text{anchor}}$ is re-anchored on every trade to match the last traded rate ($r_{\text{last}}$):

$$r_{\text{anchor}} = r_{\text{last}} + \frac{1}{\text{scalar}} \times \ln\left( \frac{p_0}{1 - p_0} \right)$$

This guarantees that:
$$r(p_0) = r_{\text{last}}$$

---

## 🌾 LP Dividend Auto-Harvesting

Unlike standard DEX pools where LPs forfeit secondary token cash flows, the `XeroYieldMarket` pool holds YT tokens in its own reserve.

1. As underlying dividends are paid, the pool's YT balance accrues dividend shares via `XeroVault.sol`.
2. Anyone (including keeper bots) can invoke `harvestYield()`.
3. Accrued stock dividends are claimed and added directly into the pool's `reserveQuote`.
4. **Result:** The underlying value of each LP share (`XLP`) compounds automatically over time, generating organic yield for liquidity providers.

---

## 💻 Computational Implementation

Pricing and swap root-finding are executed via fixed-point arithmetic in:
* **Solidity:** [`XeroMathLib.sol`](../developers/smart-contract-reference.md#xeromathlibsol) on Base and EVM chains.
* **Rust / Stylus:** `stylus/xero-math` on Arbitrum Stylus for ultra-low gas execution.

Natural logarithms are computed via range reduction to $[1, 2)$ followed by the hyperbolic arctangent series ($\text{atanh}$):

$$\ln(m) = 2 \left( z + \frac{z^3}{3} + \frac{z^5}{5} + \dots \right), \quad z = \frac{m - 1}{m + 1}$$
