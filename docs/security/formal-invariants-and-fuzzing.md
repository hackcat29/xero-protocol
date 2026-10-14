---
description: Formal mathematical invariants, stateful property fuzzing, and security proofs verified with Foundry.
---

# Formal Invariants & Fuzz Testing

Security is foundational to Xero Protocol. The core contracts undergo rigorous property-based fuzz testing and formal invariant verification via Foundry to mathematically prove solvency, conservation of value, and monotonic index growth.

---

## 🛡️ The 4 Core Protocol Invariants

The protocol's state machine is continuously audited against four formal invariants defined in [`contracts/test/invariant/VaultInvariant.t.sol`](https://github.com/hackcat29/xero-protocol/blob/main/contracts/test/invariant/VaultInvariant.t.sol):

### 1. Invariant: Strict Solvency (`invariant_VaultIsSolvent`)
At any block height and after any arbitrary sequence of transactions:
* The raw B20 stock tokens held as vault collateral must cover 100% of the raw shares required to redeem all outstanding Principal Tokens, plus all accrued but unclaimed Yield Token dividends:

$$\text{Collateral} + \epsilon \ge \left\lceil \frac{\text{Supply}_{PT} \times 10^{18}}{I_{accrual}} \right\rceil + \text{totalYieldOwed}$$

### 2. Invariant: Conservation of Capital (`invariant_Conservation`)
No tokens can ever be created out of thin air or leaked from the vault:

$$\text{Raw Tokens Withdrawn} \le \text{Raw Tokens Deposited}$$

$$\text{Raw Deposited} - \text{Raw Withdrawn} \equiv \text{Vault Collateral}$$

### 3. Invariant: Paired Legs Symmetry (`invariant_LegsMatchBeforeMaturity`)
Prior to the maturity timestamp $T$, the total supply of Principal Tokens must strictly equal the total supply of Yield Tokens:

$$\forall t < T: \quad \text{Supply}(PT) \equiv \text{Supply}(YT)$$

### 4. Invariant: Monotonic Index Growth (`invariant_DividendIndexMonotone`)
The internal sanitized dividend index $I_t$ must never decrease, regardless of fluctuations, drops, or jumps in the external multiplier:

$$I(t_2) \ge I(t_1) \quad \forall t_2 \ge t_1$$

---

## ⚡ Property Fuzz Testing (`VaultHandler`)

The Foundry invariant test suite runs extensive stateful property fuzz campaigns subjecting `XeroVault` to pseudorandom adversarial permutations:

* Random bursts of `strip()`, `recombine()`, and `redeem()`
* High-frequency token transfers (`transferYt` and `transferPt`) across distinct actors
* Unannounced corporate splits and dividend multiplier changes
* Arbitrary warp jumps across time boundaries ($t < T$ and $t \ge T$)
* Reentrancy attack vectors and zero-amount edge cases

### Execution Command:
```bash
cd contracts
forge test --match-contract VaultInvariantTest -vvv
```

All invariants hold across hundreds of thousands of runs with zero invariant violations.
