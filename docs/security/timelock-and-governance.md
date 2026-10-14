---
description: Governance structure, 48-hour timelock delay, multi-signature controls, and emergency circuit breakers.
---

# Timelock & Multi-Sig Governance

Xero Protocol is designed with an immutable core and institutional security controls, enforcing a strict separation of administrative powers and time delays.

---

## 🏛️ Governance Hierarchy

```
┌─────────────────────────────────┐
│     Community / DAO Multisig    │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│      48-Hour Timelock Safe      │  (172,800 seconds delay)
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  XeroFactory  |  CorporateActionEngine  |  RiskGuardian Config  │
└─────────────────────────────────────────────────────────────────┘
```

1. **Protocol Multi-Sig Safe:** A high-threshold Safe multi-signature wallet representing core protocol contributors and community signers.
2. **Timelock Safe (`timelockDelay = 172,800s`):** All sensitive protocol parameters (fee updates, contract additions, reporter quorum modifications) must pass through a mandatory **48-hour timelock delay**.
3. **Emergency Guardian Safe:** A rapid-response multi-sig equipped with time-sensitive pause powers to freeze vaults in the event of an unannounced black swan corporate event.

---

## 🔒 Immutability Guarantees

* **Core Vaults are Immutable:** Deployed [`XeroVault`](../developers/smart-contract-reference.md#xerovaultsol) and [`XeroYieldMarket`](../developers/smart-contract-reference.md#xeroyieldmarket-amm) contracts are non-upgradeable. There are no proxy upgrade pointers that could modify balance ledgers or alter redemption math.
* **Non-Custodial Architecture:** Neither governance nor guardians can seize collateral from vaults. Even during a vault halt or freeze, users retain the unalterable right to `recombine()` and exit with their collateral.
* **Hardcoded Fee Caps:** Protocol fees are bounded by immutably enforced on-chain constants:
  * Maximum strip fee: `100 bps` (1.0%)
  * Maximum yield fee: `1,000 bps` (10.0%)
  * Maximum AMM swap fee: `100 bps` (1.0%)

---

## 🛡️ The Guardian Emergency Powers

The [`RiskGuardian.sol`](../developers/smart-contract-reference.md#riskguardiansol) contract serves as the circuit breaker for unexpected stock anomalies:

```solidity
interface IRiskGuardian {
    function freezeVault(address vault) external;
    function unfreezeVault(address vault) external;
    function checkStrip(address token, address vault) external view;
    function checkSwap(address pool, uint256 quoteIn, uint256 ytOut) external view;
}
```

* **Triggering a Freeze:** Can be triggered immediately by the Guardian Safe if a major equity undergoes an unannounced corporate spin-off or regulatory delisting.
* **Effect of Freeze:** Halts new `strip()` deposits and AMM swaps to prevent predatory arbitrage.
* **Unfreezing:** Requires multi-sig verification that the corporate action has been attested and the `dividendIndex` properly normalized.
