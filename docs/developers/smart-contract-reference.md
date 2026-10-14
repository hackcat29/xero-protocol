---
description: Comprehensive technical reference for core Xero Protocol smart contracts, interfaces, and function signatures.
---

# Smart Contract Reference

This document provides function-level technical specifications for all core Xero Protocol smart contracts.

---

## 🏛️ `XeroVault.sol`

The primary custody and asset-stripping contract. Each deployed vault corresponds to a single B20 stock token and a specific maturity timestamp $T$.

### State Variables & Configuration
* `token`: The underlying B20 stock token (`IRobinhoodStockToken`).
* `pt`: Principal Token ERC-20 contract (`XeroComponentToken`).
* `yt`: Yield Token ERC-20 contract (`XeroComponentToken`).
* `maturity`: Unix timestamp marking vault expiration (`uint64`).
* `dividendIndex`: Sanitized cumulative dividend growth index (`uint256`, 18 decimals).
* `structuralFactor`: Cumulative corporate split adjustment divisor (`uint256`, 18 decimals).
* `maturityIndex`: Locked dividend index settled at maturity (`uint256`).

### Core Write Functions

#### `strip(uint256 raw, address to)`
Deposits `raw` stock tokens, deducts protocol strip fee (5 bps), and mints equal units of PT and YT to `to`.
```solidity
function strip(uint256 raw, address to) external returns (uint256 units);
```

#### `recombine(uint256 units, address to)`
Callable **before** maturity: burns `units` of PT and YT from caller, returning underlying stock tokens to `to`.
```solidity
function recombine(uint256 units, address to) external returns (uint256 raw);
```

#### `redeem(uint256 units, address to)`
Callable **at or after** maturity: burns `units` of PT from caller, returning baseline stock shares to `to`.
```solidity
function redeem(uint256 units, address to) external returns (uint256 raw);
```

#### `claimYield(address user)`
Claims all accumulated dividend stock shares for `user` and transfers them directly to `user`. Permissionless.
```solidity
function claimYield(address user) external returns (uint256 raw);
```

#### `sync()`
Synchronizes the vault against newly effective corporate actions, checks for unexpected multiplier movements, and settles the maturity index if expired.
```solidity
function sync() external;
```

---

## 📈 `XeroYieldMarket.sol` (Yield-Space AMM)

The maturity-aware AMM pool for trading Yield Tokens (YT) against the underlying stock token.

### Core Write Functions

#### `swap(uint256 ytIn, uint256 quoteIn, uint256 minOut, address to)`
Executes a swap along the Yield-Space curve:
* If `ytIn > 0`: Sells YT for quote stock tokens (lowers implied rate $r$).
* If `quoteIn > 0`: Sells quote stock tokens for YT (raises implied rate $r$).
```solidity
function swap(uint256 ytIn, uint256 quoteIn, uint256 minOut, address to) external returns (uint256 out);
```

#### `addLiquidity(uint256 ytAmount, uint256 quoteAmount, uint256 minLp, address to)`
Deposits paired reserves into the pool and mints pro-rata LP shares (`XLP`).
```solidity
function addLiquidity(uint256 ytAmount, uint256 quoteAmount, uint256 minLp, address to) external returns (uint256 lp);
```

#### `removeLiquidity(uint256 lpAmount, uint256 minYT, uint256 minQuote, address to)`
Burns `lpAmount` of LP tokens and returns pro-rata YT and quote stock tokens to `to`.
```solidity
function removeLiquidity(uint256 lpAmount, uint256 minYT, uint256 minQuote, address to) external returns (uint256 ytOut, uint256 quoteOut);
```

#### `harvestYield()`
Claims accrued dividends from the pool's own YT balance in `XeroVault` and deposits the received stock tokens directly into `reserveQuote`.
```solidity
function harvestYield() external returns (uint256 harvested);
```

---

## 🛡️ `CorporateActionEngine.sol`

Multi-sig oracle attestation contract for logging stock splits and cash dividend allowances.

### Core Functions

#### `report(address token, ActionType kind, uint64 effectiveAt, uint128 value, uint128 value2, bytes32 ref)`
Callable by addresses with `REPORTER_ROLE`. Attests an upcoming or effective corporate action:
* `ActionType.FORWARD_SPLIT`: Split ratio $v_1 : v_2$ (e.g., 10 for 1).
* `ActionType.REVERSE_SPLIT`: Reverse split ratio $v_2 : v_1$.
* `ActionType.CASH_DIVIDEND`: Approved dividend growth allowance.
```solidity
function report(
    address token,
    ActionType kind,
    uint64 effectiveAt,
    uint128 value,
    uint128 value2,
    bytes32 ref
) external returns (bool effective);
```

#### `setQuorum(uint8 quorum_)`
Configures the number of distinct reporter attestations required before an action becomes active. Restricted to `DEFAULT_ADMIN_ROLE`.
```solidity
function setQuorum(uint8 quorum_) external;
```
