---
description: Developer guide and API reference for the BaseB20YieldLens read-only analytical aggregation contract.
---

# BaseB20YieldLens Reference

The [`BaseB20YieldLens.sol`](https://github.com/hackcat29/xero-protocol/blob/main/contracts/src/lens/BaseB20YieldLens.sol) contract provides consolidated read-only analytical data for front-end dashboards, trading bots, and portfolio aggregators on Base.

---

## 📊 Core Data Structures

### `B20EquityMetrics`
Aggregates on-chain B20 multiplier, balance, and spot price feeds:
```solidity
struct B20EquityMetrics {
    address token;
    string name;
    string symbol;
    uint256 currentMultiplier;
    uint256 spotPriceUsd;       // 18 decimals WAD
    uint256 totalSupplyRaw;
    uint256 totalSupplyUI;
    uint256 userRawBalance;
    uint256 userUIBalance;
    bool isPaused;
}
```

### `DiscountedStockQuote`
Returns the exact discount and fixed APY for purchasing Principal Tokens (PT):
```solidity
struct DiscountedStockQuote {
    uint256 spotPriceUsd;
    uint256 ptPriceUsd;
    uint256 discountUsd;
    uint256 discountBps;        // e.g. 420 = 4.20% discount
    uint256 fixedApyBps;        // e.g. 862 = 8.62% annualized APY
}
```

### `FixedYieldQuote`
Computes the upfront cash yield obtained by stripping stock and selling the Yield Token:
```solidity
struct FixedYieldQuote {
    uint256 spotPriceUsd;
    uint256 ytPriceUsd;
    uint256 upfrontCashBps;     // Upfront cash return as percentage of spot price
    uint256 fixedApyBps;        // Annualized return locked in on Day 1
}
```

### `DividendSpeculationMetrics`
Calculates leverage multipliers and breakeven dividend thresholds:
```solidity
struct DividendSpeculationMetrics {
    uint256 spotPriceUsd;
    uint256 ytPriceUsd;
    uint256 leverageMultiplierWad; // e.g. 80e18 = 80x capital leverage
    uint256 breakevenYieldBps;     // Dividend yield required over tenor to break even
}
```

---

## 🔍 Analytical View Functions

### `getDiscountedStockQuote(address vault, address market)`
Returns full pricing and APY metrics for purchasing PT from the AMM market.

### `getFixedYieldQuote(address vault, address market)`
Calculates the upfront cash monetization metrics for stripping and selling YT.

### `getDividendSpeculationMetrics(address vault, address market)`
Returns the capital efficiency leverage and breakeven hurdle rate for buying YT.

---

## 💻 Integration Example (TypeScript / Viem)

```typescript
import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});

const LENS_ADDRESS = '0x...'; // Lens deployed address on Base
const VAULT_ADDRESS = '0x...';
const MARKET_ADDRESS = '0x...';

const lensAbi = parseAbi([
  'function getDiscountedStockQuote(address vault, address market) view returns ((uint256 spotPriceUsd, uint256 ptPriceUsd, uint256 discountUsd, uint256 discountBps, uint256 fixedApyBps))',
]);

async function fetchQuote() {
  const quote = await client.readContract({
    address: LENS_ADDRESS,
    abi: lensAbi,
    functionName: 'getDiscountedStockQuote',
    args: [VAULT_ADDRESS, MARKET_ADDRESS],
  });

  console.log(`Spot Price: $${Number(quote.spotPriceUsd) / 1e18}`);
  console.log(`PT Discount: ${Number(quote.discountBps) / 100}%`);
  console.log(`Fixed APY: ${Number(quote.fixedApyBps) / 100}%`);
}

fetchQuote();
```
