---
description: Oracle architecture, Chainlink Total Return Equity feeds, L2 Sequencer uptime protection, and weekend market handling.
---

# Chainlink Total Return Feeds

Xero Protocol integrates decentralized price oracles to compute real-time equity spot prices, Principal Token discounts, Yield Token leverage multiples, and protocol collateral valuation.

---

## 🏛️ Oracle Architecture

The oracle layer is centered on [`XeroOracle.sol`](../developers/smart-contract-reference.md#xerooraclesol) and [`BaseB20YieldLens.sol`](../developers/smart-contract-reference.md#baseb20yieldlenssol), which consume official **Chainlink Total Return Equity Feeds**.

Unlike simple equity spot price feeds, Total Return feeds track both the share price appreciation and the compounding effect of corporate dividend distributions:

```
[Chainlink Feed] ──► [XeroOracle] ──► [BaseB20YieldLens] ──► [Front-End UI / Keepers]
                             ▲
                             │ Checks Sequencer Status
                             │
     [Chainlink L2 Sequencer Uptime Feed]
```

---

## 🛡️ Base L2 Sequencer Uptime Protection

Because Base is an Optimistic Rollup, oracle consumers must protect against potential sequencer outages. If the sequencer goes offline while equity markets continue trading off-chain, re-starting the sequencer could expose protocols to stale-price MEV exploitation.

Xero integrates the official **Chainlink L2 Sequencer Uptime Feed**:
* **Base Mainnet Contract:** `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433`

### Sequencer Protection Rules:
1. **Downtime Check:** If `status == 1` (sequencer is down), all price queries revert.
2. **Grace Period Enforcement:** After the sequencer restarts, Xero enforces a mandatory **3,600-second (1-hour) grace period**:
   $$\text{block.timestamp} - \text{startedAt} < \text{GRACE\_PERIOD\_TIME} \implies \text{Revert}$$
3. **Exploit Prevention:** No swaps, liquidations, or rate updates can occur until oracle feeds have safely caught up with off-chain stock market prints.

---

## ⏳ Handling Weekend Market Closes

Traditional equity markets operate Monday through Friday from 9:30 AM to 4:00 PM EST, closing over weekends and federal market holidays. During market closures, equity price feeds do not produce heartbeat updates.

To accommodate market closures without triggering false-positive staleness errors:
* **Default Maximum Age (`defaultMaxAge`):** Configured to **345,600 seconds (4 days)** in [`deploy/base-mainnet.json`](../developers/deployments-and-networks.md).
* **Weekend Staleness Tolerance:** Allows vaults and UI lenses to safely quote the Friday closing price throughout Saturday and Sunday.
* **Monday Open Resumption:** Tight staleness checks resume within 15 minutes of the Monday market bell.

---

## 🔍 Analytical Yield Lens Integration

The analytical engine [`BaseB20YieldLens.sol`](../developers/smart-contract-reference.md#baseb20yieldlenssol) uses Chainlink feeds to dynamically compute:

1. **PT Fixed APY:**
   $$\text{Fixed APY} = \left(\frac{P_{spot} - P_{PT}}{P_{PT}}\right) \times \left(\frac{365 \text{ days}}{\text{timeToMaturity}}\right)$$
2. **Upfront Cash Return:**
   $$\text{Upfront Cash} = \frac{P_{YT}}{P_{spot}} \times 100\%$$
3. **Dividend Leverage Multiplier:**
   $$\text{Leverage} = \frac{P_{spot}}{P_{YT}}$$
