---
description: Overview of the Coinbase B20 tokenized stock standard on Base, legal custody, and smart contract architecture.
---

# Coinbase B20 Equities on Base

Xero Protocol is built natively on **Base** to support the emerging ecosystem of tokenized equities issued under the **B20 Token Standard**.

---

## 🏛️ What is the B20 Standard?

The **B20 standard** is an ERC-20 compliant specification created for tokenized Real World Assets (RWAs) and publicly listed equities. 

Unlike synthetic stock perps or CFD derivatives, each B20 token represents **1:1 legal ownership** of underlying shares custodied in the traditional financial system.

### Key Pillars of B20 Tokens:
1. **1:1 Institutional Custody:** Fully backed by physical US stock shares held by regulated broker-dealers (such as Alpaca Securities LLC and Coinbase Custody), protected by SIPC insurance up to $500,000.
2. **Bankruptcy-Remote SPV:** Issued via regulated Special Purpose Vehicles (SPVs) under ADGM (Abu Dhabi Global Market) / Reg S frameworks, ensuring equity holders have direct legal recourse independent of the issuing entity.
3. **Continuous On-Chain Attestation:** Reserves and custody balances are attested through automated Proof of Reserve feeds.

---

## ⚙️ The Multiplier Architecture (`IScaledUIAmount`)

A defining characteristic of the B20 standard is how corporate actions and dividend reinvestments are delivered. Instead of distributing physical cash dividends in separate ERC-20 stablecoins, the B20 token utilizes a dynamic **UI Multiplier**:

```solidity
interface IScaledUIAmount {
    function uiMultiplier() external view returns (uint256);
    function scaledBalanceOf(address account) external view returns (uint256);
    function rawBalanceOf(address account) external view returns (uint256);
}
```

* **Raw Balance (`rawBalanceOf`):** The fixed ERC-20 internal ledger balance of the account.
* **UI Multiplier (`uiMultiplier`):** An 18-decimal fixed-point scalar that starts at $1.0 \times 10^{18}$ and scales upward as cash dividends are distributed.
* **Display Balance (`scaledBalanceOf`):** The real economic shares owned:
  $$\text{Scaled Balance} = \frac{\text{Raw Balance} \times \text{uiMultiplier}()}{10^{18}}$$

---

## 🔵 Why Base?

Xero Protocol is deployed natively on Base (Coinbase's Ethereum Layer 2) due to several structural synergies:

1. **Sub-Cent Gas Fees:** Executing yield stripping, automated LP harvests, and streaming claims costs less than $0.005 per transaction.
2. **2-Second Block Times:** Near-instant transaction settlement enables high-frequency dividend trading and efficient arbitrage.
3. **Ecosystem Liquidity:** Base hosts deep native USDC liquidity and direct on-ramps from Coinbase's 100M+ user base.
4. **Native B20 Integration:** Blue-chip tokenized equities (`NVDAc`, `AAPLc`, `COINc`, `SPYc`) originate natively on Base, eliminating cross-chain bridge risks.
