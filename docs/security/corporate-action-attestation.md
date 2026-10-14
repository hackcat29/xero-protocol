---
description: Cryptographic attestation engine, multi-reporter quorum, and corporate action validation rules.
---

# Corporate Action Attestation Engine

The [`CorporateActionEngine.sol`](https://github.com/hackcat29/xero-protocol/blob/main/contracts/src/CorporateActionEngine.sol) contract serves as an authenticated, append-only registry that validates corporate actions on underlying equities before they affect vault mechanics.

---

## 🏛️ Why Attestation is Required

In equity markets, companies execute diverse corporate actions:
* **Forward and Reverse Stock Splits**
* **Cash Dividends and Stock Dividends**
* **Special One-Time Distributions**
* **Spinoffs, Mergers, and Cash Buyouts**

Because B20 token contracts represent multiple corporate action types through the single scalar `uiMultiplier()`, Xero requires multi-reporter cryptographic attestation to decouple structural actions from real dividend yields.

---

## 🔐 Multi-Reporter Quorum Architecture

Attestations are submitted by independent oracle nodes possessing the `REPORTER_ROLE`:

```
Reporter Node 1 ──┐
Reporter Node 2 ──┼──► [CorporateActionEngine.report()] ──► Quorum Check (2 of N) ──► Action Effective!
Reporter Node 3 ──┘
```

1. **Deterministic Action Payload:**
   ```solidity
   bytes32 payloadHash = keccak256(
       abi.encode(token, kind, effectiveAt, value, value2, ref)
   );
   ```
2. **Quorum Verification:** An action only becomes effective once `quorum` (default: 2) distinct reporter accounts attest the identical payload hash.
3. **Replay Protection:** Every action carries a unique `ref` (sourced from the official corporate action ID). Once used, a `ref` cannot be re-submitted.

---

## 🛡️ Time Bounds & Sanity Limits

To prevent frontrunning or malicious reporter manipulation, `CorporateActionEngine` enforces strict bounds:

| Parameter | Limit | Purpose |
| :--- | :--- | :--- |
| **`MAX_BACKDATE`** | `1 day` | Cash dividends must be reported promptly around payment date |
| **`MAX_BACKDATE_STRUCTURAL`** | `30 days` | Allows resolving historical splits while vaults remain safely frozen |
| **`MAX_LEAD`** | `120 days` | Prevents scheduling actions arbitrarily far into the future |
| **`MAX_STRUCTURAL_RATIO`** | `100:1` | Upper bound on forward/reverse split multipliers |
| **`MAX_DIVIDEND_GROWTH`** | `50% (0.5e18)` | Upper bound on dividend growth authorized in a single distribution |

---

## 🚨 Non-Deterministic Actions & Auto-Halt

Certain corporate actions cannot be mathematically mapped onto standard PT/YT tokens:
* Cash buyouts (take-private transactions)
* Spinoffs into new unlisted ticker symbols
* Stock-for-stock mergers with third-party companies

When such actions are reported:
1. The engine emits a notification and flags the action.
2. During the next `_sync()`, [`XeroVault.sol`](../developers/smart-contract-reference.md#xerovaultsol) automatically enters **Halted** status (`halted = true`).
3. **User Protections While Halted:**
   * New `strip()` deposits are blocked to prevent misallocated capital.
   * Existing holders can always safely call `recombine()` to exit with their underlying shares intact.
