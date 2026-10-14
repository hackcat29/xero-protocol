---
description: Step-by-step guide to depositing B20 tokenized stocks into Xero Vaults and minting PT and YT tokens.
---

# How to Strip a B20 Stock

Stripping a tokenized stock separates its baseline capital value from its future dividend stream, giving you independent **Principal Tokens (PT)** and **Yield Tokens (YT)**.

---

## 📋 Prerequisites

Before stripping, ensure you have:
1. **A Web3 Wallet:** Coinbase Wallet, MetaMask, or Rainbow connected to **Base** (Chain ID: `8453`).
2. **Gas Funds:** A fractional amount of ETH on Base (~$0.02) for transaction fees.
3. **B20 Stock Tokens:** Underlying tokenized stocks (e.g., `NVDAc`, `SCHDc`, `SPYc`) in your wallet.

---

## 🖥️ Step-by-Step Walkthrough

### Step 1: Navigate to the Strip Interface
Visit [xeroprotocol.com](https://xeroprotocol.com) and click on **Vaults & Stripping** in the navigation header.

### Step 2: Select Your Asset & Maturity
Choose the equity and tenor that matches your strategy:
* Asset: e.g., `SCHDc` (Schwab US Dividend Equity)
* Maturity: e.g., `1Y` (365 days)

### Step 3: Approve Contract Allowance
If this is your first time interacting with the vault, click **Approve** to authorize [`XeroVault.sol`](../developers/smart-contract-reference.md#xerovaultsol) to transfer your B20 tokens.

### Step 4: Enter Deposit Amount & Confirm
1. Enter the number of raw stock shares to deposit (e.g., `10.0 SCHDc`).
2. Review the preview:
   * **Strip Fee:** 5 bps (0.05%)
   * **Principal Tokens Received:** `9.995 xSCHDc-PT-1Y`
   * **Yield Tokens Received:** `9.995 xSCHDc-YT-1Y`
3. Click **Strip Stock** and sign the transaction in your wallet.

```solidity
// Direct contract call equivalent
XeroVault(vaultAddress).strip(rawAmount, userAddress);
```

---

## 🎯 What to Do Next?

Once your PT and YT are minted, you can execute three primary strategies:

{% tabs %}
{% tab title="Strategy A: Lock In Upfront Cash" %}
Head to the **Market** tab and sell your newly minted `xSCHDc-YT-1Y` for instant cash. You retain 100% of your PT to redeem your original stock shares at maturity!
{% endtab %}

{% tab title="Strategy B: Provide LP Liquidity" %}
Deposit both your YT and some stock tokens into the `XeroYieldMarket` pool to earn swap fees and automated dividend compound yields.
{% endtab %}

{% tab title="Strategy C: Recombine Anytime" %}
Changed your mind? Call `recombine(units, to)` anytime before maturity to burn your PT and YT and retrieve your original stock tokens.
{% endtab %}
{% endtabs %}
