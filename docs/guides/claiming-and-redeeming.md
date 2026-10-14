---
description: Comprehensive instructions on claiming accumulated dividend cash flows and redeeming Principal Tokens for stock shares.
---

# Claiming & Redeeming

This guide explains how to claim streaming dividend distributions accrued by Yield Tokens (YT) and how to redeem Principal Tokens (PT) for full stock shares upon reaching maturity.

---

## 🌾 Claiming Dividend Cash Flows

Yield Tokens (YT) continuously earn dividend payouts whenever the underlying B20 stock's multiplier increments. You can claim your accumulated dividends at any time.

### Through the Web Interface:
1. Visit [xeroprotocol.com](https://xeroprotocol.com) and go to the **Portfolio** tab.
2. Under **Accrued Dividends**, review your claimable stock tokens.
3. Click **Claim Dividends**.
4. Confirm the transaction in your Web3 wallet. The accrued stock tokens will be transferred directly to your address.

### Via Smart Contract:
Anyone can trigger yield claiming for any address without permissions:

```solidity
// Claims accrued dividends for `userAddress` and sends them to `userAddress`
uint256 receivedRaw = XeroVault(vaultAddress).claimYield(userAddress);
```

{% hint style="info" %}
**Permissionless Claiming:** You can claim dividends on behalf of a friend or multi-sig vault; the resulting funds are always securely transferred to the token holder's address.
{% endhint %}

---

## 🏁 Redeeming Principal Tokens at Maturity

When the maturity timestamp $T$ is reached, the vault locks the final dividend index as the **Maturity Index** ($I_{mat}$). At this point, Principal Tokens can be converted directly back into the underlying equity shares.

### Step 1: Verify Maturity Status
In the **Portfolio** tab, check that the vault status displays as **Matured**.

### Step 2: Settle Maturity (If Not Yet Settled)
The first user or automated keeper bot interacting with the vault after timestamp $T$ will settle the final maturity index:

```solidity
XeroVault(vaultAddress).sync();
```

### Step 3: Redeem Stock Shares
1. Enter the number of PT tokens to redeem.
2. Click **Redeem Stock**.
3. Sign the transaction in your wallet.
4. Your PT tokens are burned, and **1 full underlying stock share per PT** is transferred to your wallet.

```solidity
// Burn `units` of PT and receive underlying stock tokens back
uint256 rawReceived = XeroVault(vaultAddress).redeem(units, recipientAddress);
```

---

## 🔄 Early Exit: Pre-Maturity Recombination

If you hold **both** PT and YT and wish to exit before the maturity date $T$:
* You can call [`recombine()`](../developers/smart-contract-reference.md#recombine) at any time.
* The vault burns equal units of PT and YT together and returns your raw stock tokens immediately:

```solidity
uint256 rawReturned = XeroVault(vaultAddress).recombine(units, recipientAddress);
```

---

## ⏳ Post-Maturity Rules Summary

| Token | Status After Maturity ($t \ge T$) | Action Available |
| :--- | :--- | :--- |
| **Yield Token (YT)** | Expired (Zero terminal value) | Any unclaimed dividends earned prior to $T$ can still be claimed via `claimYield()`. |
| **Principal Token (PT)** | Fully Redeemable | Can be redeemed for underlying stock shares at any time. **There is no expiration deadline for redeeming PT.** |
