---
description: Acquire blue-chip equities at a programmatic discount to spot price by purchasing Principal Tokens.
---

# 2. Discounted Stock Buying

**Discounted Stock Buying** is the second primary primitive of Xero Protocol. It allows value investors, long-term accumulators, and DAOs to buy blue-chip tokenized stocks at a substantial discount compared to spot market prices.

---

## 🎯 The Core Concept

When an equity pays dividends, its spot price incorporates the expectation of those upcoming payouts. However, many long-term investors do not need or want quarterly cash distributions; they simply want to accumulate maximum equity ownership over time.

By purchasing **Principal Tokens (PT)** on Xero's AMM, investors purchase pure capital value:

```
Spot Stock Price: $130.00
Stripped Dividend Value (YT): $3.50
-----------------------------------------
Principal Token Price (PT): $126.50  (2.7% Discount!)
```

At the specified maturity date $T$, every 1 PT converts directly into **1 full underlying stock share**.

---

## 💡 Why This Discount Exists

Because the PT holder forgoes dividend distributions for the duration of the tenor, the market prices PT at an arbitrage-enforced discount:

$$P_{PT} = P_{spot} - P_{YT}$$

The discount represents the time value of money and the fair market value of the expected dividend yield. The further away the maturity date $T$, the wider the discount.

---

## 📊 Worked Numerical Example

Consider an investor looking to build a position in `COINc` (Coinbase tokenized equity):

| Parameter | Value |
| :--- | :--- |
| **Asset** | Coinbase Global Inc (`COINc`) |
| **Spot Stock Price ($P_{spot}$)** | $220.00 |
| **Tenor Selected** | 6 Months (182 days) |
| **Principal Token Price ($P_{PT}$)** | **$211.20** |
| **Discount per Share** | **$8.80 (4.00%)** |
| **Investment Capital** | $21,120.00 |

### Outcome at Maturity:
1. **Initial Acquisition:**
   $$\frac{\$21,120}{\$211.20} = \mathbf{100 \text{ Units of } xCOINc\text{-PT-6M}}$$
2. **At Maturity ($T$):**
   $$100 \text{ PT} \xrightarrow{\text{Redeem}} \mathbf{100 \text{ full } COINc \text{ shares}}$$
3. **If Spot Price is Unchanged ($220.00):**
   $$\text{Final Value} = 100 \times \$220.00 = \mathbf{\$22,000.00}$$
   $$\text{Fixed APY} = \left(\frac{220 - 211.20}{211.20}\right) \times \left(\frac{365}{182}\right) \times 100\% = \mathbf{8.35\%}$$

{% hint style="success" %}
**Asymmetrical Advantage:** Even if the spot stock stays completely flat, the investor earns an **8.35% annualized return** purely through the convergence of the PT discount to spot par value at maturity.
{% endhint %}

---

## 🛡️ Early Exit & Secondary Market Liquidity

Investors are **not locked in** until maturity:
* PT tokens trade on secondary DEX liquidity pools on Base.
* If the underlying stock appreciates significantly before maturity, the holder can sell their PT back to the pool at any time to realize capital gains early.
* As maturity approaches, the price of PT naturally converges upward toward spot ($P_{PT} \to P_{spot}$).
