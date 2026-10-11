import express from 'express'
import cors from 'cors'
import {
  createPublicClient,
  defineChain,
  http,
  zeroAddress,
  formatUnits,
  parseUnits,
  type Address,
  type Abi,
  type PublicClient,
} from 'viem'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())

const PORT = Number(process.env.PORT || 4000)

// ------------------------------------------------------------------ Chains & Deployments
export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.VITE_ROBINHOOD_RPC || 'https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Robinhood Chain Explorer', url: 'https://robin.etherscan.io' } },
})

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.VITE_ROBINHOOD_TESTNET_RPC || 'https://rpc.testnet.chain.robinhood.com/rpc'] } },
  blockExplorers: { default: { name: 'Robinhood Testnet Explorer', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
})

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.VITE_ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc'] } },
  blockExplorers: { default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' } },
  testnet: true,
})

export const localChain = defineChain({
  id: 31337,
  name: 'Local devnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.VITE_LOCAL_RPC || 'http://127.0.0.1:8545'] } },
})

const CHAINS: Record<number, any> = {
  4663: robinhoodChain,
  46630: robinhoodTestnet,
  421614: arbitrumSepolia,
  31337: localChain,
}

// Load deployment books
export type AddressBook = {
  chainId: number
  startBlock?: number
  deployer: Address
  usdg: Address
  guardian: Address
  engine: Address
  factory: Address
  math: Address
  markets: Address
  oracle: Address
  lens: Address
  router: Address
  stocks: Address[]
  feeds?: Address[]
  actors?: Address[]
  realStocks?: Address[]
}

const books: Record<number, AddressBook> = {}
try {
  const dep46630 = JSON.parse(fs.readFileSync(path.join(__dirname, '46630.json'), 'utf8'))
  books[46630] = dep46630
} catch {}
try {
  const dep421614 = JSON.parse(fs.readFileSync(path.join(__dirname, '421614.json'), 'utf8'))
  books[421614] = dep421614
} catch {}
try {
  const dep31337 = JSON.parse(fs.readFileSync(path.join(__dirname, '31337.json'), 'utf8'))
  books[31337] = dep31337
} catch {}

const abis: Record<string, Abi> = JSON.parse(fs.readFileSync(path.join(__dirname, 'abis.json'), 'utf8'))

const clients: Record<number, PublicClient> = {}
function getClient(chainId: number): PublicClient {
  if (!clients[chainId]) {
    const chain = CHAINS[chainId] || robinhoodTestnet
    clients[chainId] = createPublicClient({ chain, transport: http() })
  }
  return clients[chainId]
}

// ------------------------------------------------------------------ Math & Serialization Helpers
const WAD = 10n ** 18n
const toNum = (v: bigint, decimals = 18) => Number(formatUnits(v, decimals))

function replacer(_key: string, value: any) {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return value
}

// ------------------------------------------------------------------ Protocol Loader
type LensPoint = {
  vault: Address
  market: Address
  principalToken: Address
  yieldToken: Address
  maturity: bigint
  matured: boolean
  frozen: boolean
  halted: boolean
  tau: bigint
  impliedRate: bigint
  impliedYield: bigint
  ytPrice: bigint
  ptPrice: bigint
  ytPriceUsd: bigint
  ptPriceUsd: bigint
  dividendIndex: bigint
  structuralFactor: bigint
  totalUnits: bigint
  reserveYt: bigint
  reserveQuote: bigint
}

type Market = LensPoint & {
  id: string
  label: string
  symbol: string
  assetName: string
  token: Address
  ptSymbol: string
  ytSymbol: string
  parValue: bigint
  liquidityUsd: number
  tvlUsd: number
  ptFixedYield: number
  live: boolean
}

type Asset = {
  token: Address
  symbol: string
  name: string
  multiplier: bigint
  priceUsd: bigint
  sharePriceUsd: bigint
  priceFresh: boolean
  forwards: bigint[]
  markets: Market[]
  tvlUsd: number
  liquidityUsd: number
  bestYield: number
}

// In-memory protocol state cache per chain
const cache: Record<number, { timestamp: number; data: any }> = {}

async function fetchProtocolSnapshot(chainId: number) {
  const book = books[chainId]
  if (!book) throw new Error(`No deployment address book for chain ${chainId}`)
  const client = getClient(chainId)

  const [block, curves] = await Promise.all([
    client.getBlock(),
    Promise.all(
      book.stocks.map(async (t) => {
        try {
          return await client.readContract({
            address: book.lens,
            abi: abis.CurveLens,
            functionName: 'getCurve',
            args: [t],
          }) as {
            token: Address
            symbol: string
            name: string
            multiplier: bigint
            priceUsd: bigint
            priceFresh: boolean
            points: readonly LensPoint[]
            forwards: readonly bigint[]
          }
        } catch (e) {
          console.error(`Failed to getCurve for ${t}:`, e)
          return null
        }
      }),
    ),
  ])

  const validCurves = curves.filter((c): c is NonNullable<typeof c> => c !== null)

  const symbolsOf = async (p: LensPoint) => {
    try {
      const [ptSymbol, ytSymbol] = await Promise.all([
        client.readContract({ address: p.principalToken, abi: abis.XeroComponentToken, functionName: 'symbol' }) as Promise<string>,
        client.readContract({ address: p.yieldToken, abi: abis.XeroComponentToken, functionName: 'symbol' }) as Promise<string>,
      ])
      return [ptSymbol, ytSymbol]
    } catch {
      return ['xPT', 'xYT']
    }
  }

  const assets: Asset[] = await Promise.all(
    validCurves.map(async (c) => {
      const price = c.priceFresh ? toNum(c.priceUsd) : 0
      const markets = await Promise.all(
        c.points.map(async (p): Promise<Market> => {
          const [ptSymbol, ytSymbol] = await symbolsOf(p)
          const label = ytSymbol.split('-YT-')[1] || ''
          const parValue = p.ptPrice + p.ytPrice
          const liquidityUsd = toNum(p.reserveQuote) * price + toNum(p.reserveYt) * toNum(p.ytPrice) * price
          const tvlUsd = toNum(p.totalUnits) * toNum(parValue) * price
          const tau = toNum(p.tau)
          const ptFixedYield = p.ptPrice > 0n && tau > 0 ? Math.pow(toNum(parValue) / toNum(p.ptPrice), 1 / tau) - 1 : 0
          return {
            ...p,
            id: `${c.symbol}-${label}`,
            label,
            symbol: c.symbol,
            assetName: c.name,
            token: c.token,
            ptSymbol,
            ytSymbol,
            parValue,
            liquidityUsd,
            tvlUsd,
            ptFixedYield,
            live: !p.matured && p.market !== zeroAddress && p.reserveYt > 0n,
          }
        }),
      )
      const live = markets.filter((m) => m.live)
      return {
        token: c.token,
        symbol: c.symbol,
        name: c.name.replace(/\s*\((Mock )?Stock Token\)\s*$/i, ''),
        multiplier: c.multiplier,
        priceUsd: c.priceUsd,
        sharePriceUsd: c.multiplier > 0n ? (c.priceUsd * WAD) / c.multiplier : 0n,
        priceFresh: c.priceFresh,
        forwards: [...c.forwards],
        markets,
        tvlUsd: markets.reduce((a, m) => a + m.tvlUsd, 0),
        liquidityUsd: markets.reduce((a, m) => a + m.liquidityUsd, 0),
        bestYield: Math.max(0, ...live.map((m) => toNum(m.impliedYield))),
      }
    }),
  )

  const markets = assets.flatMap((a) => a.markets)
  return {
    now: Number(block.timestamp),
    assets,
    markets,
    tvlUsd: assets.reduce((a, x) => a + x.tvlUsd, 0),
    liquidityUsd: assets.reduce((a, x) => a + x.liquidityUsd, 0),
    liveCount: markets.filter((m) => m.live).length,
  }
}

async function getCachedProtocol(chainId: number) {
  const cached = cache[chainId]
  if (cached && Date.now() - cached.timestamp < 6000) {
    return cached.data
  }
  const data = await fetchProtocolSnapshot(chainId)
  cache[chainId] = { timestamp: Date.now(), data }
  return data
}

// ------------------------------------------------------------------ API Routes

// Health & Network
app.get('/api/health', async (_req, res) => {
  try {
    const client = getClient(46630)
    const block = await client.getBlockNumber()
    res.json({
      status: 'ok',
      service: 'Xero Mobile Protocol Engine',
      latestBlock: block.toString(),
      chainsAvailable: Object.keys(books).map(Number),
      defaultChainId: 46630,
      timestamp: Date.now(),
    })
  } catch (e: any) {
    res.status(500).json({ status: 'error', message: e.message })
  }
})

app.get('/api/networks', (_req, res) => {
  res.json({
    networks: [
      { id: 46630, name: 'Robinhood Chain Testnet', testnet: true, explorer: 'https://explorer.testnet.chain.robinhood.com' },
      { id: 421614, name: 'Arbitrum Sepolia', testnet: true, explorer: 'https://sepolia.arbiscan.io' },
      { id: 4663, name: 'Robinhood Chain', testnet: false, explorer: 'https://robin.etherscan.io' },
      { id: 31337, name: 'Local Devnet', testnet: true, explorer: null },
    ],
    defaultChainId: 46630,
  })
})

// Protocol Snapshot
app.get('/api/protocol', async (req, res) => {
  try {
    const chainId = Number(req.query.chainId || 46630)
    const data = await getCachedProtocol(chainId)
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify(data, replacer))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// Markets with Filtering & Sorting
app.get('/api/markets', async (req, res) => {
  try {
    const chainId = Number(req.query.chainId || 46630)
    const data = await getCachedProtocol(chainId)
    const filter = (req.query.filter as string) || 'all'
    const sort = (req.query.sort as string) || 'yield'
    const search = ((req.query.search as string) || '').toLowerCase().trim()
    const showMatured = req.query.showMatured === 'true'

    const ETFS = new Set(['SCHD', 'SGOV', 'SPY', 'VTI', 'QQQ', 'BND', 'SHY', 'SPMO', 'VOO', 'IWM'])

    let list = (data.markets as Market[]).filter((m) => {
      if (!showMatured && !m.live) return false
      if (filter === 'etfs' && !ETFS.has(m.symbol)) return false
      if (filter === 'stocks' && ETFS.has(m.symbol)) return false
      if (search && !m.symbol.toLowerCase().includes(search) && !m.assetName.toLowerCase().includes(search)) return false
      return true
    })

    list.sort((a, b) => {
      if (sort === 'symbol') return a.symbol.localeCompare(b.symbol)
      if (sort === 'maturity') return Number(a.maturity - b.maturity)
      if (sort === 'liquidity') return b.liquidityUsd - a.liquidityUsd
      // default yield
      return toNum(BigInt(b.impliedYield)) - toNum(BigInt(a.impliedYield))
    })

    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ markets: list, total: list.length, stats: { tvlUsd: data.tvlUsd, liquidityUsd: data.liquidityUsd, liveCount: data.liveCount } }, replacer))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// Single Market Detail
app.get('/api/markets/:id', async (req, res) => {
  try {
    const chainId = Number(req.query.chainId || 46630)
    const data = await getCachedProtocol(chainId)
    const market = data.markets.find((m: Market) => m.id.toLowerCase() === req.params.id.toLowerCase())
    if (!market) return res.status(404).json({ error: 'Market not found' })
    const asset = data.assets.find((a: Asset) => a.token.toLowerCase() === market.token.toLowerCase())
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ market, asset }, replacer))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// Trade history for a market
app.get('/api/trades/:market', async (req, res) => {
  try {
    const chainId = Number(req.query.chainId || 46630)
    const market = req.params.market as Address
    const client = getClient(chainId)
    const book = books[chainId]

    const logs = await client.getContractEvents({
      address: market,
      abi: abis.XeroYieldMarket,
      eventName: 'Swap',
      fromBlock: BigInt(book?.startBlock || 0),
    })

    const blocks = new Map<bigint, number>()
    await Promise.all(
      [...new Set(logs.map((l) => l.blockNumber!))].map(async (n) =>
        blocks.set(n, Number((await client.getBlock({ blockNumber: n })).timestamp)),
      ),
    )

    const trades = logs
      .map((l) => {
        const a = (l as any).args
        const buy = BigInt(a.ytOut) > 0n
        return {
          time: blocks.get(l.blockNumber!) || 0,
          side: buy ? 'buy' : 'sell',
          yt: (buy ? a.ytOut : a.ytIn).toString(),
          quote: (buy ? a.quoteIn : a.quoteOut).toString(),
          impliedRate: a.impliedRate.toString(),
          hash: l.transactionHash,
          trader: a.sender,
        }
      })
      .sort((x, y) => y.time - x.time)

    res.json({ trades })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// On-chain Interactive Quotes
app.post('/api/quote', async (req, res) => {
  try {
    const { chainId = 46630, action, marketAddress, vaultAddress, amount } = req.body
    const client = getClient(chainId)
    const rawAmount = BigInt(amount || '0')
    if (rawAmount <= 0n) return res.status(400).json({ error: 'Amount must be > 0' })

    if (action === 'yield_buy') {
      // Pay quote (stock), receive YT
      const [ytOut, newImpliedRate] = (await client.readContract({
        address: marketAddress,
        abi: abis.XeroYieldMarket,
        functionName: 'quoteQuoteForYt',
        args: [rawAmount],
      })) as [bigint, bigint]
      return res.json({ out: ytOut.toString(), newImpliedRate: newImpliedRate.toString() })
    }

    if (action === 'yield_sell') {
      // Pay YT, receive quote (stock)
      const [quoteOut, newImpliedRate] = (await client.readContract({
        address: marketAddress,
        abi: abis.XeroYieldMarket,
        functionName: 'quoteYtForQuote',
        args: [rawAmount],
      })) as [bigint, bigint]
      return res.json({ out: quoteOut.toString(), newImpliedRate: newImpliedRate.toString() })
    }

    if (action === 'fix') {
      // Strip stock -> get units of PT, sell YT units -> receive quote upfront
      const units = (await client.readContract({
        address: vaultAddress,
        abi: abis.XeroVault,
        functionName: 'previewStrip',
        args: [rawAmount],
      })) as bigint
      const [quoteOut] = (await client.readContract({
        address: marketAddress,
        abi: abis.XeroYieldMarket,
        functionName: 'quoteYtForQuote',
        args: [units],
      })) as [bigint, bigint]
      return res.json({ ptUnits: units.toString(), upfrontQuote: quoteOut.toString() })
    }

    if (action === 'strip') {
      const units = (await client.readContract({
        address: vaultAddress,
        abi: abis.XeroVault,
        functionName: 'previewStrip',
        args: [rawAmount],
      })) as bigint
      return res.json({ units: units.toString() })
    }

    if (action === 'redeem') {
      const quoteOut = (await client.readContract({
        address: vaultAddress,
        abi: abis.XeroVault,
        functionName: 'previewRedeem',
        args: [rawAmount],
      })) as bigint
      return res.json({ quoteOut: quoteOut.toString() })
    }

    res.status(400).json({ error: 'Unsupported action' })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// User Portfolio Aggregator
app.get('/api/portfolio/:address', async (req, res) => {
  try {
    const chainId = Number(req.query.chainId || 46630)
    const account = req.params.address as Address
    const client = getClient(chainId)
    const data = await getCachedProtocol(chainId)

    const stockBalances = await Promise.all(
      data.assets.map(async (a: Asset) => {
        try {
          return await client.readContract({
            address: a.token,
            abi: abis.XeroComponentToken,
            functionName: 'balanceOf',
            args: [account],
          }) as bigint
        } catch {
          return 0n
        }
      }),
    )

    const positions = await Promise.all(
      data.markets.map(async (m: Market) => {
        try {
          const [pt, yt, lp, claimable] = await Promise.all([
            client.readContract({ address: m.principalToken, abi: abis.XeroComponentToken, functionName: 'balanceOf', args: [account] }) as Promise<bigint>,
            client.readContract({ address: m.yieldToken, abi: abis.XeroComponentToken, functionName: 'balanceOf', args: [account] }) as Promise<bigint>,
            m.market === zeroAddress
              ? 0n
              : (client.readContract({ address: m.market, abi: abis.XeroYieldMarket, functionName: 'balanceOf', args: [account] }) as Promise<bigint>),
            client
              .simulateContract({ account, address: m.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [account] })
              .then((r) => r.result as bigint)
              .catch(() => client.readContract({ address: m.vault, abi: abis.XeroVault, functionName: 'claimable', args: [account] }) as Promise<bigint>),
          ])

          const asset = data.assets.find((a: Asset) => a.token.toLowerCase() === m.token.toLowerCase())!
          const px = toNum(BigInt(asset.priceUsd))
          let lpUsd = 0
          if (lp > 0n) {
            const supply = (await client.readContract({ address: m.market, abi: abis.XeroYieldMarket, functionName: 'totalSupply' })) as bigint
            lpUsd = supply > 0n ? (toNum(lp) / toNum(supply)) * m.liquidityUsd : 0
          }
          const valueUsd =
            (toNum(pt) * toNum(BigInt(m.ptPrice)) + toNum(yt) * toNum(BigInt(m.ytPrice)) + toNum(claimable)) * px + lpUsd
          return { market: m, pt, yt, lp, claimable, valueUsd }
        } catch (e) {
          return null
        }
      }),
    )

    const stocks: Record<string, string> = {}
    data.assets.forEach((a: Asset, i: number) => {
      stocks[a.token] = stockBalances[i].toString()
    })

    const held = positions
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => x.pt > 0n || x.yt > 0n || x.lp > 0n || x.claimable > 0n)

    const valueUsd = held.reduce((a, x) => a + x.valueUsd, 0)
    const claimableUsd = held.reduce((a, x) => {
      const asset = data.assets.find((s: Asset) => s.token.toLowerCase() === x.market.token.toLowerCase())!
      return a + toNum(x.claimable) * toNum(BigInt(asset.priceUsd))
    }, 0)

    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ stocks, positions: held, valueUsd, claimableUsd }, replacer))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Xero Mobile Server] running on http://0.0.0.0:${PORT}`)
})
