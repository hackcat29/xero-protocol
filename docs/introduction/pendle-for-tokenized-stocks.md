---
description: How Xero adapts Pendle's yield-stripping architecture to real-world tokenized equities.
---

# The Pendle for Tokenized Stocks

**Pendle Finance** revolutionized crypto fixed-income by splitting yield-bearing assets (like stETH, sUSDe, and aTokens) into Principal Tokens (PT) and Yield Tokens (YT) via their **ERC-5115 (Standardized Yield / SY)** interface.

However, applying this framework to **real-world tokenized stocks** requires a fundamental architectural evolution.

---

## 🔍 Why Standard Pendle (ERC-5115 SY) Fails on Tokenized Stocks

In traditional crypto yield assets, yield is distributed in one of two ways:
1. **Rebasing Tokens:** Token balances increase periodically (e.g. stETH).
2. **Reward Streaming / Accrual:** A secondary reward token is streamed or claimable as ERC-20 cash transfers (e.g. AAVE rewards, CRV).

Pendle's ERC-5115 standard is designed around these assumptions.

### The Coinbase B20 Reality
In contrast, **Coinbase B20 tokenized stocks on Base do not pay out recurring cash tokens, nor do their raw ERC-20 balances rebase**:
* When a company like Apple or Schwab pays a quarterly cash dividend, the broker/custodian automatically reinvests the cash into more shares (DRIP).
* On-chain, this dividend growth appears exclusively as an **escalating scalar multiplier (`uiMultiplier`)**.
* An investor's raw ERC-20 balance remains completely unchanged, while their scaled user-interface balance increases:
  $$\text{Balance}_{UI} = \frac{\text{Balance}_{raw} \times \text{uiMultiplier}}{10^{18}}$$

```
Standard Pendle (SY) Expectation:
  [Vault] ─── periodic cash ERC-20 payouts ───► [YT Holder]

Coinbase B20 Reality:
  [Underlying Stock] ─── M_t multiplier rises on-chain ───► (No token transfers occur!)
```

{% hint style="warning" %}
**The Stock Split Vulnerability in Standard SY:**  
If a protocol naively treats the B20 multiplier as a simple yield index, a **2:1 or 4:1 forward stock split** (which doubles or quadruples the multiplier) would be mistakenly treated as an astronomical dividend payout, instantly draining the protocol's reserves!
{% endhint %}

---

## 🏛️ How Xero Bridges the Gap

Xero preserves the core elegance of Pendle—the **PT / YT separation**—while completely re-engineering the underlying accounting engine for the B20 standard:

| Feature | Standard Pendle (SY) | Xero Protocol (B20 Engine) |
| :--- | :--- | :--- |
| **Asset Class** | Crypto yield tokens (stETH, aUSDC) | Coinbase B20 tokenized equities (`NVDAc`, `AAPLc`) |
| **Yield Mechanism** | Rebase or cash token transfers | Continuous multiplier growth ($\Delta M$) |
| **Yield Accrual** | Exchange rate indexing | **Yield Streaming Delta Index ($Y$)** |
| **Corporate Splits** | N/A (crypto tokens don't split) | **Structural Factor ($S$) Attestation** |
| **Pricing Engine** | Logit-based Yield-Space curve | **Maturity-Aware Yield-Space AMM ($P_{YT} = r \times \tau$)** |

By introducing the **Dividend Index ($I = M / S$)**, Xero creates a pure mathematical filter that isolates authentic corporate dividend growth from structural stock splits, enabling institutional yield-stripping for real-world assets on Base.
