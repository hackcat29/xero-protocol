// Copies contract ABIs from the Foundry build into the app (run `forge build` in ../contracts first).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const names = [
  'XeroVault', 'XeroFactory', 'XeroComponentToken', 'XeroYieldMarket', 'YieldMarketFactory', 'CurveLens', 'XeroRouter',
  'CorporateActionEngine', 'RiskGuardian', 'XeroOracle', 'MockStockToken', 'MockAggregator', 'MockUSDG',
]
const out = {}
for (const n of names) {
  const p = new URL(`../../contracts/out/${n}.sol/${n}.json`, import.meta.url)
  if (!existsSync(p)) throw new Error(`missing ${p.pathname} — run \`forge build\` in contracts/`)
  out[n] = JSON.parse(readFileSync(p, 'utf8')).abi
}
writeFileSync(new URL('../src/lib/abis.json', import.meta.url), JSON.stringify(out))
console.log(`exported ${names.length} ABIs`)
