---
description: An overview of the token types and financial primitives unlocked by Xero Protocol.
---

# Core Primitives Overview

Xero deconstructs yield-bearing equities into two standardized tokens: **Principal Tokens (PT)** and **Yield Tokens (YT)**. These two building blocks give rise to three primary financial primitives:

```
                                  ┌───────────────────────────┐
                                  │   XERO PROTOCOL ENGINE    │
                                  └─────────────┬─────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
    ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
    │       PRIMITIVE 1        │  │       PRIMITIVE 2        │  │       PRIMITIVE 3        │
    │   Fixed Yield Sourcing   │  │ Discounted Stock Buying  │  │   Dividend Speculation   │
    │     (Sell YT upfront)    │  │       (Buy PT cheap)     │  │       (Buy YT cheap)     │
    └──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘
```

---

## 📊 Summary Comparison

| Metric / Parameter | Principal Token (PT) | Yield Token (YT) |
| :--- | :--- | :--- |
| **Token Entitlement** | 1:1 baseline stock share at maturity $T$ | Continuous multiplier growth delta ($\Delta M$) |
| **Price Behavior** | Trades at a discount ($P_{PT} < P_{spot}$), converging to spot price at maturity | Trades at a fraction of spot, decaying to zero at maturity |
| **Dividend Exposure** | **0%** (Stripped of all dividend volatility) | **100%** (Captures all dividend distributions) |
| **Primary Use Case** | Fixed-yield capital accumulation & discounted equity acquisition | Upfront income monetization & leveraged dividend speculation |
| **Target Audience** | Conservative investors, DAOs, fixed-income funds | Yield seekers, equity income treasuries, macro hedge funds |

---

## 🧩 The Recombination Invariant

At all times prior to maturity $T$:

$$\text{Value}(1 \text{ PT}) + \text{Value}(1 \text{ YT}) = \text{Value}(1 \text{ Underlying Stock Token})$$

Because equal units of PT and YT can be burned at any moment via `recombine()` to withdraw the underlying stock token, **arbitrageurs strictly enforce this parity**:
* If $P_{PT} + P_{YT} < P_{spot}$, arbitrageurs buy PT and YT on the AMM, recombine them, and sell the stock for risk-free profit.
* If $P_{PT} + P_{YT} > P_{spot}$, arbitrageurs buy the stock, strip it in the vault into PT + YT, and sell both on the market.
