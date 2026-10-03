// Generates realistic devnet market history: ~5 weeks of chain time with trading in every live market,
// dividend reinvestments on each asset's schedule and oracle random walks.
//   node scripts/simulate.mjs [steps=120]
import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http, maxUint256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'

const RPC = process.env.RPC_URL ?? 'http://127.0.0.1:8545'
const STEPS = Number(process.argv[2] ?? 120)
const book = JSON.parse(readFileSync(new URL('../src/deployments/31337.json', import.meta.url)))
const abis = JSON.parse(readFileSync(new URL('../src/lib/abis.json', import.meta.url)))
const KEYS = {
  issuer: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  alice: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  bob: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  carol: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
}
const pub = createPublicClient({ chain: foundry, transport: http(RPC) })
const wallets = Object.fromEntries(
  Object.entries(KEYS).map(([k, key]) => [k, createWalletClient({ account: privateKeyToAccount(key), chain: foundry, transport: http(RPC) })]),
)
const traders = ['alice', 'bob', 'carol']
const WAD = 10n ** 18n
let seed = 0x5eed
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const read = (address, abi, functionName, args = []) => pub.readContract({ address, abi: abis[abi], functionName, args })
async function send(who, address, abi, functionName, args = []) {
  const w = wallets[who]
  const { request } = await pub.simulateContract({ account: w.account, address, abi: abis[abi], functionName, args })
  const hash = await w.writeContract(request)
  await pub.waitForTransactionReceipt({ hash })
}
const tryy = async (f) => { try { await f() } catch (e) { /* skip trades that hit limits */ } }
const advance = async (secs) => {
  await pub.request({ method: 'evm_increaseTime', params: [Math.floor(secs)] })
  await pub.request({ method: 'evm_mine', params: [] })
}

// ---- discover markets
const markets = []
for (const [i, token] of book.stocks.entries()) {
  const curve = await read(book.lens, 'CurveLens', 'getCurve', [token])
  for (const p of curve.points) {
    if (p.matured || p.reserveYt === 0n) continue
    markets.push({ token, symbol: curve.symbol, feed: book.feeds[i], vault: p.vault, market: p.market, yt: p.yieldToken, target: p.impliedRate })
  }
}
console.log(`simulating ${STEPS} steps across ${markets.length} markets`)

// ---- every trader strips a slice of each asset into the 1Y-ish vaults and approves markets
for (const who of traders) {
  for (const m of markets) {
    await send(who, m.token, 'MockStockToken', 'approve', [m.vault, maxUint256])
    await send(who, m.token, 'MockStockToken', 'approve', [m.market, maxUint256])
    await send(who, m.yt, 'XeroComponentToken', 'approve', [m.market, maxUint256])
    const bal = await read(m.token, 'MockStockToken', 'balanceOf', [wallets[who].account.address])
    await send(who, m.vault, 'XeroVault', 'strip', [bal / 40n, wallets[who].account.address])
  }
}

// ---- dividend schedule (cash per share, USD WAD) and last price per asset
const DIVIDENDS = { AAPL: [0.26, 91], SCHD: [0.2665, 91], XOM: [1.03, 91], SGOV: [0.3005, 30] }
const lastDividend = {}
const t0 = Number((await pub.getBlock()).timestamp)

for (let s = 0; s < STEPS; s++) {
  await advance(4 * 3600 + rand() * 6 * 3600)
  const now = Number((await pub.getBlock()).timestamp)

  // trades: 2-3 per step, mean-reverting around each market's opening rate
  for (let k = 0; k < 2 + Math.floor(rand() * 2); k++) {
    const m = markets[Math.floor(rand() * markets.length)]
    const who = traders[Math.floor(rand() * traders.length)]
    const [rate, ry, rq] = await Promise.all([
      read(m.market, 'XeroYieldMarket', 'lastRate'), read(m.market, 'XeroYieldMarket', 'reserveYt'), read(m.market, 'XeroYieldMarket', 'reserveQuote'),
    ])
    const drift = Number(rate - m.target) / Number(m.target)
    const buy = rand() < 0.5 - drift * 4
    const size = BigInt(Math.floor((0.002 + rand() * 0.02) * 1e6))
    await tryy(() =>
      buy
        ? send(who, m.market, 'XeroYieldMarket', 'swapExactQuoteForYt', [(rq * size) / 1_000_000n, 0n, wallets[who].account.address])
        : send(who, m.market, 'XeroYieldMarket', 'swapExactYtForQuote', [(ry * size) / 1_000_000n, 0n, wallets[who].account.address]),
    )
  }

  // oracle random walk + keep feeds fresh
  if (s % 3 === 0) {
    for (const feed of book.feeds) {
      const a = await read(feed, 'MockAggregator', 'answer')
      const bps = BigInt(Math.round((rand() - 0.48) * 300))
      await send('issuer', feed, 'MockAggregator', 'setAnswer', [(a * (10_000n + bps)) / 10_000n])
    }
  }

  // dividends: reinvested into the multiplier on schedule
  for (const [i, token] of book.stocks.entries()) {
    const sym = markets.find((m) => m.token === token)?.symbol
    const [cash, every] = DIVIDENDS[sym] ?? []
    if (!cash || (lastDividend[sym] ?? t0 - every * 86400 * rand()) + every * 86400 > now) continue
    lastDividend[sym] = now
    const answer = await read(book.feeds[i], 'MockAggregator', 'answer')
    const mult = await read(token, 'MockStockToken', 'uiMultiplier')
    const sharePrice = (answer * 10n ** 10n * WAD) / mult
    await send('issuer', token, 'MockStockToken', 'reinvestDividend', [BigInt(Math.round(cash * 1e6)) * 10n ** 12n, sharePrice])
    console.log(`  ${new Date(now * 1000).toISOString().slice(0, 10)} ${sym} reinvested $${cash}`)
  }
  if (s % 20 === 0) console.log(`  step ${s}/${STEPS}`)
}
console.log('done; chain time', new Date(Number((await pub.getBlock()).timestamp) * 1000).toISOString())
