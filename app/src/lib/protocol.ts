import { useQuery } from '@tanstack/react-query'
import { zeroAddress, type Address } from 'viem'
import { abis, book, chainId, isDevnet, logClient, publicClient, read } from './network'
import { WAD, toNum } from './format'

const REFRESH = isDevnet ? 4_000 : 10_000

// ------------------------------------------------------------------ types

export type LensPoint = {
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

export type B20Market = LensPoint & {
  id: string // `${symbol}-${label}`
  label: string
  symbol: string
  assetName: string
  token: Address
  ptSymbol: string
  ytSymbol: string
  liquidityUsd: number
  tvlUsd: number
  ptFixedYield: number // annualised return from buying principal at today's discount, %
  ptDiscountPct: number // discount to today's share price; also the share of value paid out upfront, %
  ytLeverage: number // share price per dividend token
  unitUsd: number // one share's worth today
  ptUsd: number
  ytUsd: number
  live: boolean
  parValue: bigint
}

export type B20Asset = {
  token: Address
  symbol: string
  name: string
  multiplier: bigint
  priceUsd: bigint // per raw token, multiplier included
  sharePriceUsd: bigint // per underlying share
  priceFresh: boolean
  forwards: bigint[]
  markets: B20Market[]
  tvlUsd: number
  liquidityUsd: number
  bestYield: number
  maxPtDiscount: number
}

export type Asset = B20Asset
export type Market = B20Market

export type Protocol = {
  now: number
  assets: B20Asset[]
  markets: B20Market[]
  tvlUsd: number
  liquidityUsd: number
}

// ------------------------------------------------------------------ protocol snapshot

async function loadProtocol(): Promise<Protocol> {
  if (!book) throw new Error(`No Xero deployment for chain ${chainId}`)
  const [block, curves] = await Promise.all([
    publicClient.getBlock(),
    Promise.all(
      book.stocks.map((t) =>
        read<{
          token: Address
          symbol: string
          name: string
          multiplier: bigint
          priceUsd: bigint
          priceFresh: boolean
          points: readonly LensPoint[]
          forwards: readonly bigint[]
        }>(book!.lens, abis.CurveLens, 'getCurve', [t]),
      ),
    ),
  ])

  const now = Number(block.timestamp)
  const allMarkets: B20Market[] = []

  const assets: B20Asset[] = curves.map((c) => {
    const rawPriceUsd = toNum(c.priceUsd)
    const sharePrice = c.multiplier > 0n ? (c.priceUsd * WAD) / c.multiplier : c.priceUsd

    const markets: B20Market[] = c.points.map((p) => {
      const remainingSecs = Math.max(0, Number(p.maturity) - now)
      const label = remainingSecs <= 8 * 86400 ? '1W' : remainingSecs <= 95 * 86400 ? '3M' : remainingSecs <= 185 * 86400 ? '6M' : '1Y'
      const id = `${c.symbol}-${label}`

      // One unit (1 PT + 1 YT) is one share's worth of the stock today, so the discount and the upfront payout are
      // both the YT's share of the unit's value. Comparing against the raw token price would count dividends already
      // reinvested into the token and overstate the discount.
      const ptUsd = toNum(p.ptPriceUsd)
      const ytUsd = toNum(p.ytPriceUsd)
      const unitUsd = ptUsd + ytUsd
      const years = Math.max(remainingSecs, 1) / (365 * 86400)
      const ptDiscountPct = unitUsd > 0 ? (ytUsd / unitUsd) * 100 : 0
      const ptFixedYield = ptUsd > 0 ? (ytUsd / ptUsd / years) * 100 : 0
      const ytLeverage = ytUsd > 0 ? Math.min(250, unitUsd / ytUsd) : 0
      const ytPrice = ytUsd

      const ptSymbol = `x${c.symbol}-PT-${label}`
      const ytSymbol = `x${c.symbol}-YT-${label}`

      const reserveYtUnits = toNum(p.reserveYt)
      const reserveStock = toNum(p.reserveQuote)
      const liquidityUsd = (reserveYtUnits * ytPrice) + (reserveStock * rawPriceUsd)
      const tvlUsd = toNum(p.totalUnits) * unitUsd

      const parValue = p.ptPrice + p.ytPrice > 0n ? p.ptPrice + p.ytPrice : WAD

      const m: B20Market = {
        ...p,
        id,
        label,
        symbol: c.symbol,
        assetName: c.name,
        token: c.token,
        ptSymbol,
        ytSymbol,
        liquidityUsd,
        tvlUsd,
        ptFixedYield,
        ptDiscountPct,
        ytLeverage,
        unitUsd,
        ptUsd,
        ytUsd,
        live: !p.matured && p.market !== zeroAddress,
        parValue,
      }
      allMarkets.push(m)
      return m
    })

    const tvlUsd = markets.reduce((acc, m) => acc + m.tvlUsd, 0)
    const liquidityUsd = markets.reduce((acc, m) => acc + m.liquidityUsd, 0)
    const bestYield = markets.reduce((acc, m) => Math.max(acc, toNum(m.impliedYield)), 0)
    const maxPtDiscount = markets.reduce((acc, m) => Math.max(acc, m.ptDiscountPct), 0)

    return {
      token: c.token,
      symbol: c.symbol,
      name: c.name,
      multiplier: c.multiplier,
      priceUsd: c.priceUsd,
      sharePriceUsd: sharePrice,
      priceFresh: c.priceFresh,
      forwards: [...c.forwards],
      markets,
      tvlUsd,
      liquidityUsd,
      bestYield,
      maxPtDiscount,
    }
  })

  const tvlUsd = assets.reduce((acc, a) => acc + a.tvlUsd, 0)
  const liquidityUsd = assets.reduce((acc, a) => acc + a.liquidityUsd, 0)

  return {
    now,
    assets,
    markets: allMarkets,
    tvlUsd,
    liquidityUsd,
  }
}

export function useProtocol() {
  return useQuery({
    queryKey: ['xero', 'base', chainId, book?.deployer],
    queryFn: loadProtocol,
    refetchInterval: REFRESH,
    staleTime: REFRESH / 2,
    enabled: !!book,
  })
}

// ------------------------------------------------------------------ positions

export type Position = {
  market: Market
  pt: bigint
  yt: bigint
  lp: bigint
  claimable: bigint
  valueUsd: number
  lpUsd: number // value of this market's pool shares
  lpShare: number // fraction of the pool
}

export type Portfolio = {
  stocks: Record<Address, bigint>
  positions: Position[]
  valueUsd: number
  claimableUsd: number
}

async function loadPortfolio(account: Address, p: Protocol): Promise<Portfolio> {
  const stockBalances = await Promise.all(
    p.assets.map((a) => read<bigint>(a.token, abis.MockStockToken, 'balanceOf', [account])),
  )
  const positions = await Promise.all(
    p.markets.map(async (m): Promise<Position> => {
      const [pt, yt, lp, claimable] = await Promise.all([
        read<bigint>(m.principalToken, abis.XeroComponentToken, 'balanceOf', [account]),
        read<bigint>(m.yieldToken, abis.XeroComponentToken, 'balanceOf', [account]),
        m.market === zeroAddress ? 0n : read<bigint>(m.market, abis.XeroYieldMarket, 'balanceOf', [account]),
        publicClient
          .simulateContract({ account, address: m.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [account] })
          .then((r) => r.result as bigint)
          .catch(() => read<bigint>(m.vault, abis.XeroVault, 'claimable', [account])),
      ])
      const asset = p.assets.find((a) => a.token === m.token)!
      const px = toNum(asset.priceUsd)
      let lpUsd = 0
      let lpShare = 0
      if (lp > 0n) {
        const supply = await read<bigint>(m.market, abis.XeroYieldMarket, 'totalSupply')
        lpShare = supply > 0n ? toNum(lp) / toNum(supply) : 0
        lpUsd = lpShare * m.liquidityUsd
      }
      const valueUsd =
        (toNum(pt) * toNum(m.ptPrice) + toNum(yt) * toNum(m.ytPrice) + toNum(claimable)) * px + lpUsd
      return { market: m, pt, yt, lp, claimable, valueUsd, lpUsd, lpShare }
    }),
  )
  const stocks: Record<Address, bigint> = {}
  p.assets.forEach((a, i) => (stocks[a.token] = stockBalances[i]))
  const held = positions.filter((x) => x.pt > 0n || x.yt > 0n || x.lp > 0n || x.claimable > 0n)
  return {
    stocks,
    positions: held,
    valueUsd: held.reduce((a, x) => a + x.valueUsd, 0),
    claimableUsd: held.reduce((a, x) => {
      const asset = p.assets.find((s) => s.token === x.market.token)!
      return a + toNum(x.claimable) * toNum(asset.priceUsd)
    }, 0),
  }
}

export function usePortfolio(account: Address | undefined) {
  const { data: protocol } = useProtocol()
  return useQuery({
    queryKey: ['portfolio', 'base', chainId, account, protocol?.now],
    queryFn: () => loadPortfolio(account!, protocol!),
    enabled: !!account && !!protocol,
    placeholderData: (prev) => prev,
  })
}

// ------------------------------------------------------------------ market history

export type Trade = {
  time: number
  side: 'buy' | 'sell'
  yt: bigint
  quote: bigint
  impliedRate: bigint
  hash: `0x${string}`
  trader: Address
}

const swapEvent = (abis.XeroYieldMarket as readonly { type: string; name?: string }[]).find(
  (x) => x.type === 'event' && x.name === 'Swap',
)

// Public RPCs cap eth_getLogs ranges (sepolia.base.org: 200 blocks, PublicNode: 50k), and Base makes a block
// every 2s. So history is scanned backwards in chunks, bounded by a lookback window and a trade count, and each
// market remembers how far it has scanned so refetches only ask for new blocks.
const LOOKBACK_BLOCKS = isDevnet ? 10n ** 12n : 302_400n // ~7 days of Base blocks
const MAX_TRADES = 60
let logRange = 50_000n
type SwapLog = Awaited<ReturnType<typeof getSwapLogs>>[number]
const scanned = new Map<Address, { to: bigint; logs: SwapLog[] }>()
const blocks = new Map<bigint, number>() // block number -> timestamp

function getSwapLogs(market: Address, fromBlock: bigint, toBlock: bigint) {
  return logClient.getContractEvents({ address: market, abi: abis.XeroYieldMarket, eventName: 'Swap', fromBlock, toBlock })
}

async function swapLogsBetween(market: Address, from: bigint, to: bigint, newestFirst: SwapLog[], limit: number) {
  let hi = to
  while (hi >= from && newestFirst.length < limit) {
    const lo = hi - logRange + 1n > from ? hi - logRange + 1n : from
    try {
      const chunk = await getSwapLogs(market, lo, hi)
      newestFirst.push(...chunk.reverse())
      hi = lo - 1n
    } catch (e) {
      if (logRange <= 100n || !/range/i.test(String((e as Error)?.message))) throw e
      logRange /= 2n // provider rejected the block range: narrow it and retry
    }
  }
  return newestFirst
}

async function loadTrades(market: Address): Promise<Trade[]> {
  const head = await publicClient.getBlockNumber()
  const start = BigInt(book?.startBlock ?? 0)
  const prev = scanned.get(market)
  let logs: SwapLog[]
  if (prev) {
    const fresh = prev.to < head ? await swapLogsBetween(market, prev.to + 1n, head, [], Infinity) : []
    logs = [...fresh, ...prev.logs].slice(0, MAX_TRADES)
  } else {
    const floor = head - LOOKBACK_BLOCKS > start ? head - LOOKBACK_BLOCKS : start
    logs = await swapLogsBetween(market, floor, head, [], MAX_TRADES)
  }
  scanned.set(market, { to: head, logs })
  await Promise.all(
    [...new Set(logs.map((l) => l.blockNumber!))]
      .filter((n) => !blocks.has(n))
      .map(async (n) => blocks.set(n, Number((await publicClient.getBlock({ blockNumber: n })).timestamp))),
  )
  return logs
    .map((l) => {
      const a = (l as unknown as { args: Record<string, bigint | Address> }).args
      const buy = (a.ytOut as bigint) > 0n
      return {
        time: blocks.get(l.blockNumber!) ?? 0,
        side: buy ? 'buy' : 'sell',
        yt: (buy ? a.ytOut : a.ytIn) as bigint,
        quote: (buy ? a.quoteIn : a.quoteOut) as bigint,
        impliedRate: a.impliedRate as bigint,
        hash: l.transactionHash!,
        trader: a.sender as Address,
      } satisfies Trade
    })
    .sort((x, y) => y.time - x.time)
}

export function useTrades(market: Address | undefined) {
  return useQuery({
    queryKey: ['trades', 'base', chainId, market],
    queryFn: () => loadTrades(market!),
    enabled: !!market && market !== zeroAddress && !!swapEvent,
    refetchInterval: REFRESH * 2,
  })
}
