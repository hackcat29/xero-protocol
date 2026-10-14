---
description: Comprehensive list of supported tokenized equities on Base, dividend profiles, and vault tenors.
---

# Supported Assets & Tenors

Xero Protocol launches on Base Mainnet with support for 6 premier tokenized equities, covering high-growth tech leaders, index ETFs, and high-yield dividend funds across 4 standardized maturity tenors.

---

## 📈 Supported Equity Assets

| Symbol | Company / Fund Name | Sector | Baseline Dividend Yield | Primary Use Case on Xero |
| :--- | :--- | :--- | :--- | :--- |
| **`NVDAc`** | NVIDIA Corporation | AI / Semiconductors | ~0.12% | Discounted Stock Buying / Split Immunity |
| **`AAPLc`** | Apple Inc. | Consumer Tech | ~0.52% | Stable Fixed Yield Sourcing |
| **`COINc`** | Coinbase Global Inc. | Crypto Infrastructure | 0.00% | High-Beta Discounted Stock Accumulation |
| **`TSLAc`** | Tesla Inc. | Electric Vehicles / Tech | 0.00% | Capital Preservation & Spot Arbitrage |
| **`SPYc`** | SPDR S&P 500 ETF Trust | Broad Market US Index | ~1.25% | Institutional Fixed-Income Benchmarking |
| **`SCHDc`** | Schwab US Dividend Equity ETF | High-Dividend Equities | ~3.45% | Maximum Fixed Yield & Leveraged Dividend Trading |

{% hint style="info" %}
**Asset Expansion:** Additional equities and thematic ETFs (such as `MSFTc`, `AMZNc`, `GOOGLc`, `QQQc`, and `TLTc`) will be onboarded via governance votes through [`XeroFactory.sol`](../developers/smart-contract-reference.md#xerofactorysol).
{% endhint %}

---

## ⏳ Standardized Tenors & Maturities

To concentrate on-chain liquidity and create predictable term structures, Xero utilizes 4 standardized vault tenors:

| Tenor Code | Duration | Seconds | Target Market / Investor Profile |
| :--- | :--- | :--- | :--- |
| **`1W`** | 7 Days | `604,800` | Tactical earnings traders & special dividend plays |
| **`3M`** | 91 Days | `7,862,400` | Quarterly equity dividend capture cycles |
| **`6M`** | 182 Days | `15,724,800` | Semi-annual term hedging & options replication |
| **`1Y`** | 365 Days | `31,536,000` | Institutional treasury lock-in & long-term accumulators |

---

## 🏷️ Token Identification Scheme

Every asset-tenor pair produces unique, standard ERC-20 tokens for both Principal and Yield components:

```
[Asset] + [Maturity] ───┬──► Principal Token (PT): x[Asset]-PT-[Maturity]
                        └──► Yield Token (YT):     x[Asset]-YT-[Maturity]
```

### Examples:
* **`xNVDAc-PT-3M`**: Principal Token for NVIDIA maturing in 91 days.
* **`xNVDAc-YT-3M`**: Yield Token for NVIDIA maturing in 91 days.
* **`xSCHDc-PT-1Y`**: Principal Token for Schwab US Dividend Equity maturing in 365 days.
* **`xSCHDc-YT-1Y`**: Yield Token for Schwab US Dividend Equity maturing in 365 days.
