import { useQuery } from '@tanstack/react-query'
import { zeroAddress, type Address } from 'viem'
import { abis, book, chainId, isDevnet, publicClient, read } from './network'
import { WAD, toNum } from './format'

const REFRESH = isDevnet ? 4_000 : 12_000

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

export type Market = LensPoint & {
  id: string // `${symbol}-${label}`
  label: string
  symbol: string
  assetName: string
  token: Address
  ptSymbol: string
  ytSymbol: string
  /** Stock Tokens one unit is worth today (PT + YT). */
  parValue: bigint
  liquidityUsd: number
  tvlUsd: number
  /** PT's annualised return, in shares, if bought now and held to maturity. */
  ptFixedYield: number
  live: boolean
}

export type Asset = {
  token: Address
  symbol: string
  name: string
  multiplier: bigint
  priceUsd: bigint // per raw token, multiplier included
  sharePriceUsd: bigint // per underlying share
  priceFresh: boolean
  forwards: bigint[]
  markets: Market[]
  tvlUsd: number
  liquidityUsd: number
  bestYield: number
}

export type Protocol = {
  now: number
  assets: Asset[]
  markets: Market[]
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
  const symbolsOf = async (p: LensPoint) =>
    Promise.all([
      read<string>(p.principalToken, abis.XeroComponentToken, 'symbol'),
      read<string>(p.yieldToken, abis.XeroComponentToken, 'symbol'),
    ])

  const assets: Asset[] = await Promise.all(
    curves.map(async (c) => {
      const price = c.priceFresh ? toNum(c.priceUsd) : 0
      const markets = await Promise.all(
        c.points.map(async (p): Promise<Market> => {
          const [ptSymbol, ytSymbol] = await symbolsOf(p)
          const label = ytSymbol.split('-YT-')[1] ?? ''
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
  }
}

export function useProtocol() {
  return useQuery({ queryKey: ['protocol', chainId], queryFn: loadProtocol, refetchInterval: REFRESH, enabled: !!book })
}

// ------------------------------------------------------------------ positions

export type Position = {
  market: Market
  pt: bigint
  yt: bigint
  lp: bigint
  claimable: bigint
  valueUsd: number
}

export type Portfolio = {
  stocks: Record<Address, bigint>
  positions: Position[]
  valueUsd: number
  claimableUsd: number
}

async function loadPortfolio(account: Address, p: Protocol): Promise<Portfolio> {
  const stockBalances = await Promise.all(
    p.assets.map((a) => read<bigint>(a.token, abis.XeroComponentToken, 'balanceOf', [account])),
  )
  const positions = await Promise.all(
    p.markets.map(async (m): Promise<Position> => {
      const [pt, yt, lp, claimable] = await Promise.all([
        read<bigint>(m.principalToken, abis.XeroComponentToken, 'balanceOf', [account]),
        read<bigint>(m.yieldToken, abis.XeroComponentToken, 'balanceOf', [account]),
        m.market === zeroAddress ? 0n : read<bigint>(m.market, abis.XeroYieldMarket, 'balanceOf', [account]),
        // Static call of claimYield syncs the vault first, so this is the exact claimable amount.
        publicClient
          .simulateContract({ account, address: m.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [account] })
          .then((r) => r.result as bigint)
          .catch(() => read<bigint>(m.vault, abis.XeroVault, 'claimable', [account])),
      ])
      const asset = p.assets.find((a) => a.token === m.token)!
      const px = toNum(asset.priceUsd)
      let lpUsd = 0
      if (lp > 0n) {
        const supply = await read<bigint>(m.market, abis.XeroYieldMarket, 'totalSupply')
        lpUsd = supply > 0n ? (toNum(lp) / toNum(supply)) * m.liquidityUsd : 0
      }
      const valueUsd =
        (toNum(pt) * toNum(m.ptPrice) + toNum(yt) * toNum(m.ytPrice) + toNum(claimable)) * px + lpUsd
      return { market: m, pt, yt, lp, claimable, valueUsd }
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
    queryKey: ['portfolio', chainId, account, protocol?.now],
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

async function loadTrades(market: Address): Promise<Trade[]> {
  const logs = await publicClient.getContractEvents({
    address: market,
    abi: abis.XeroYieldMarket,
    eventName: 'Swap',
    fromBlock: BigInt(book?.startBlock ?? 0),
  })
  const blocks = new Map<bigint, number>()
  await Promise.all(
    [...new Set(logs.map((l) => l.blockNumber!))].map(async (n) =>
      blocks.set(n, Number((await publicClient.getBlock({ blockNumber: n })).timestamp)),
    ),
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
    queryKey: ['trades', chainId, market],
    queryFn: () => loadTrades(market!),
    enabled: !!market && market !== zeroAddress && !!swapEvent,
    refetchInterval: REFRESH * 2,
  })
}
