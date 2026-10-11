export type LensPoint = {
  vault: string
  market: string
  principalToken: string
  yieldToken: string
  maturity: string
  matured: boolean
  frozen: boolean
  halted: boolean
  tau: string
  impliedRate: string
  impliedYield: string
  ytPrice: string
  ptPrice: string
  ytPriceUsd: string
  ptPriceUsd: string
  dividendIndex: string
  structuralFactor: string
  totalUnits: string
  reserveYt: string
  reserveQuote: string
}

export type Market = LensPoint & {
  id: string
  label: string
  symbol: string
  assetName: string
  token: string
  ptSymbol: string
  ytSymbol: string
  parValue: string
  liquidityUsd: number
  tvlUsd: number
  ptFixedYield: number
  live: boolean
}

export type Asset = {
  token: string
  symbol: string
  name: string
  multiplier: string
  priceUsd: string
  sharePriceUsd: string
  priceFresh: boolean
  forwards: string[]
  markets: Market[]
  tvlUsd: number
  liquidityUsd: number
  bestYield: number
}

export type ProtocolSnapshot = {
  now: number
  assets: Asset[]
  markets: Market[]
  tvlUsd: number
  liquidityUsd: number
  liveCount: number
}

export type Position = {
  market: Market
  pt: string
  yt: string
  lp: string
  claimable: string
  valueUsd: number
}

export type PortfolioData = {
  stocks: Record<string, string>
  positions: Position[]
  valueUsd: number
  claimableUsd: number
}

export type Trade = {
  time: number
  side: 'buy' | 'sell'
  yt: string
  quote: string
  impliedRate: string
  hash: string
  trader: string
}
