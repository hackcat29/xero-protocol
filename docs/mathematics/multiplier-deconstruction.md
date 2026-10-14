---
description: Formal mathematical derivation of unit stripping, baseline capital conservation, and redemption.
---

# Multiplier Deconstruction Math

This section provides the rigorous mathematical framework behind Xero Protocol's deconstruction of Coinbase B20 tokenized equity multipliers into Principal and Yield components.

---

## 🏛️ The B20 Multiplier Representation

Under the Coinbase B20 tokenized stock standard on Base:
* A user's internal ERC-20 ledger balance is stored as **raw balance** ($B_{raw}$).
* The user-facing equity share balance is scaled dynamically via a global multiplier $M_t$:

$$\text{Balance}_{UI}(t) = \frac{B_{raw} \times M_t}{10^{18}}$$

As corporate cash dividends are paid out, $M_t$ increases monotonically:

$$M_t = M_0 \times \prod_{k=1}^N (1 + \delta_k)$$

where $\delta_k$ is the dividend yield percentage of the $k$-th corporate distribution.

---

## ✂️ The Unit Stripping Equation

When a user deposits $R$ raw B20 stock tokens into [`XeroVault.sol`](../developers/smart-contract-reference.md#xerovaultsol), the protocol strips the asset into equal units of Principal Tokens (PT) and Yield Tokens (YT).

### Protocol Ingestion & Fee
Let $f_{strip}$ be the protocol stripping fee in basis points (default: 5 bps or 0.05%):

$$R_{net} = R \times \left( 1 - \frac{f_{strip}}{10,000} \right)$$

### Units Minted
The vault converts the raw deposited stock into standardized units ($U$) indexed against the current dividend index ($I_t$):

$$U = \left\lfloor \frac{R_{net} \times I_t}{10^{18}} \right\rfloor$$

The vault executes:
1. $\text{pt.mint}(to, U)$
2. $\text{yt.mint}(to, U)$

---

## 🔄 Recombination Invariant (Before Maturity $t < T$)

At any point prior to the maturity timestamp $T$, a user holding $U$ units of PT and $U$ units of YT can recombine them to retrieve their underlying stock tokens.

The raw tokens returned are:

$$R_{return} = \left\lfloor \frac{U \times 10^{18}}{I_t} \right\rfloor$$

### Mathematical Invariant:
Since $U = R \times \frac{I_0}{10^{18}}$, at time $t$:

$$R_{return}(t) = R \times \left( \frac{I_0}{I_t} \right)$$

Because $I_t \ge I_0$, the raw units of stock needed to satisfy the baseline capital decrease, while the difference in raw tokens has been continuously allocated to the Yield Token's dividend claim pool.

---

## 🏁 Redemption Invariant (At Maturity $t \ge T$)

Upon reaching the maturity timestamp $T$, the vault permanently records the final dividend index as the **Maturity Index** ($I_{mat}$):

$$I_{mat} = I(T)$$

Once matured:
* Yield Tokens cease to accrue any further yield.
* Principal Token holders can burn $U$ units of PT to redeem their baseline equity shares:

$$R_{redeem} = \left\lfloor \frac{U \times 10^{18}}{I_{mat}} \right\rfloor - \text{fee}_{redeem}$$

### Solvency Proof:
Let $C$ be the total raw stock held as collateral in the vault:

$$C \ge \sum_{i} \frac{U_{PT, i} \times 10^{18}}{I_{mat}} + \sum_{j} \text{accruedYield}_j$$

Because all fees and claims are calculated through fixed-point integer math rounding in favor of the vault, $C$ strictly satisfies the solvency bound under all market conditions:

$$\text{Collateralization Ratio} \ge 100.00\%$$
