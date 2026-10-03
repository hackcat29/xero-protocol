// Client for Robinhood's public Stock Token APIs (https://docs.robinhood.com/chain/stock-token-apis/).
// No auth; 60 req/s; corporate actions are cached for 1 hour upstream.

const BASE = process.env.ROBINHOOD_API ?? 'https://api.robinhood.com/rhj'

export type Deployment = { contractAddress: string; chainId: number; networkName: string }

export type CorporateActionType =
  | 'FORWARD_SPLIT' | 'REVERSE_SPLIT' | 'CASH_DIVIDEND' | 'STOCK_DIVIDEND' | 'SPIN_OFF' | 'CASH_MERGER'
  | 'STOCK_MERGER' | 'STOCK_AND_CASH_MERGER' | 'REDEMPTION' | 'NAME_CHANGE' | 'WORTHLESS_REMOVAL'
  | 'RIGHTS_DISTRIBUTION' | 'UNIT_SPLIT'

export type RhCorporateAction = {
  id: string
  type: `CORPORATE_ACTION_TYPE_${CorporateActionType}`
  status: 'CORPORATE_ACTION_STATUS_IN_PROGRESS' | 'CORPORATE_ACTION_STATUS_COMPLETED'
  processDate?: { year: number; month: number; day: number }
  tokenSymbol: string
  deployments: Deployment[]
  details: Record<string, Record<string, string>>
}

export type RhAsset = {
  id: string
  tokenSymbol: string
  deployments: Deployment[]
  currentMultiplier: string
  pendingMultiplier: string
  pendingMultiplierEffectiveTime?: string
  status: string
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Robinhood API ${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function fetchCorporateActions(): Promise<RhCorporateAction[]> {
  return (await get<{ corpActions: RhCorporateAction[] }>('/corporate-actions')).corpActions ?? []
}

export async function fetchAssets(): Promise<RhAsset[]> {
  return (await get<{ assets: RhAsset[] }>('/assets')).assets ?? []
}

export type RhQuote = {
  tokenSymbol: string
  bid: string
  ask: string
  /** Multiplier-adjusted (per raw token) quotes. */
  tokenBid?: string
  tokenAsk?: string
  isTradingHalt: boolean
  generatedAt: string
}

export async function fetchQuote(symbol: string): Promise<RhQuote> {
  // The live endpoint wraps quotes as { quotes: [...] }.
  const r = await get<{ quotes?: RhQuote[] } & Partial<RhQuote>>(`/prices/${encodeURIComponent(symbol)}`)
  const q = r.quotes?.[0] ?? (r as RhQuote)
  if (!q?.bid) throw new Error(`no price for ${symbol}`)
  return q
}

/** Mid of the raw underlying bid/ask (per share, not multiplier-adjusted), in USD. */
export async function fetchMidPrice(symbol: string): Promise<number> {
  const q = await fetchQuote(symbol)
  const bid = Number(q.bid)
  const ask = Number(q.ask)
  if (!(bid > 0 && ask > 0)) throw new Error(`no price for ${symbol}`)
  return (bid + ask) / 2
}
