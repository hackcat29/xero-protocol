---
description: Mathematical proof and architectural mechanics of the Structural Factor (S) that protects PT and YT from stock split dilution.
---

# Stock Split Immunity (S-Factor)

This document details one of Xero Protocol's most critical innovations: **Stock Split Immunity**, proving how the protocol isolates real dividend cash flows from structural corporate actions (such as forward and reverse stock splits).

---

## ⚠️ The Naive Multiplier Vulnerability

Under the Coinbase B20 tokenized stock standard on Base, both cash dividends and stock splits are expressed through the single global multiplier $M_t$:

* **Cash Dividend (e.g., $1.00 dividend on $100 stock):** $M_t$ increments by $+1.0\%$.
* **Forward Stock Split (e.g., 10-for-1 split):** $M_t$ jumps by $+1,000.0\%$.

### The Catastrophic Failure Mode
If a yield protocol blindly treats all multiplier increases as dividend yield:
1. NVIDIA executes a 10-for-1 stock split.
2. The B20 contract increases $M_t$ tenfold.
3. The protocol mistakes this corporate recapitalization for a **1,000% dividend yield**.
4. Yield Token (YT) holders are granted claims to 90%+ of the vault's underlying collateral.
5. Principal Token (PT) holders are wiped out upon maturity.

{% hint style="danger" %}
**Why Standard ERC-5115 (Pendle) Cannot Be Used As-Is:** Standard SY wrappers assume any yield-bearing token multiplier represents pure yield. Applying standard SY wrappers to B20 equities would cause immediate insolvency during any corporate split.
{% endhint %}

---

## 🛡️ The Xero Solution: Structural Factor ($S_t$)

Xero Protocol decouples structural recapitalizations from economic dividends by introducing a stateful **Structural Factor ($S_t$)** inside [`XeroVault.sol`](../developers/smart-contract-reference.md#xerovaultsol):

$$I_t = \frac{M_t \times 10^{18}}{S_t}$$

Where:
* $M_t$ is the on-chain B20 multiplier from `uiMultiplier()`.
* $S_t$ is the cumulative structural divisor initialized at $10^{18}$ (1.0).
* $I_t$ is the sanitized **Dividend Index**.

---

## 📐 Mathematical Proof of Split Immunity

Assume a company executes an $n$-for-1 forward stock split (e.g., $n = 10$).

### 1. Multiplier Jump:
The B20 contract adjusts the multiplier:

$$M_{t^+} = M_{t^-} \times n$$

### 2. Structural Factor Update:
The [`CorporateActionEngine.sol`](../developers/smart-contract-reference.md#corporateactionenginesol) receives cryptographic attestations from authorized oracle reporters confirming the split with ratio $n : 1$. During `_sync()`, the vault updates:

$$S_{t^+} = S_{t^-} \times n$$

### 3. Invariance Proof:
We evaluate the new dividend index $I_{t^+}$:

$$I_{t^+} = \frac{M_{t^+} \times 10^{18}}{S_{t^+}} = \frac{(M_{t^-} \times n) \times 10^{18}}{(S_{t^-} \times n)} = \frac{M_{t^-} \times 10^{18}}{S_{t^-}} = I_{t^-}$$

$$\therefore \Delta I = I_{t^+} - I_{t^-} = 0$$

### Conclusion:
Because $\Delta I = 0$:
1. **Accrued Yield for YT Holders is Exactly 0:** No phantom yield is generated.
2. **PT Collateral Remains 100% Intact:** Baseline capital is completely shielded.
3. **Continuous Trading:** Markets continue uninterrupted without mispricing.

---

## ⚡ Corporate Action Types Handled

| Corporate Action | B20 Multiplier Move | Xero Structural Adjustment | Net Dividend Impact |
| :--- | :--- | :--- | :--- |
| **Cash Dividend** | Increases by $\delta$ | None ($S_{t^+} = S_{t^-}$) | **Full Yield Credited to YT** |
| **Forward Split ($A:B$)** | Increases by $A/B$ | $S_{t^+} = S_{t^-} \times \frac{A}{B}$ | **$\Delta I = 0$ (Immune)** |
| **Reverse Split ($B:A$)** | Decreases by $B/A$ | $S_{t^+} = S_{t^-} \times \frac{B}{A}$ | **$\Delta I = 0$ (Immune)** |
| **Stock Dividend** | Increases by ratio | Adjusted proportionally | **$\Delta I = 0$ (Immune)** |
| **Merger / Spin-Off** | Non-standard | Vault halted for new strips; safe recombination preserved | Controlled Risk Guardian pause |

---

## 🚨 Circuit Breakers & Invariant Guards

If an unannounced multiplier increase occurs that has **not** been attested by the `CorporateActionEngine`:
* The vault compares candidate index growth against `maxGrowthPerSync` (default: 5.0% maximum unbacked leap per sync).
* If the multiplier jumps beyond this threshold without an approved corporate action allowance, the vault **automatically freezes**:
  ```solidity
  if (candidate < current || candidate > ceiling) {
      _freeze(m, candidate);
  }
  ```
* While frozen, new `strip()` deposits are halted, preventing economic exploits until governance or reporters resolve the attestation.
