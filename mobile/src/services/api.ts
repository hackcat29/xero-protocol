import { Platform } from 'react-native'
import type { ProtocolSnapshot, PortfolioData, Trade } from '../types'

const getApiBase = () => {
  const g = globalThis as any
  if (typeof g.window !== 'undefined' && g.window?.location?.hostname) {
    return `${g.window.location.protocol}//${g.window.location.hostname}:4000`
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://127.0.0.1:4000'
}

const API_BASE = getApiBase()



export const apiService = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/api/health`)
    return res.json()
  },

  async getNetworks() {
    const res = await fetch(`${API_BASE}/api/networks`)
    return res.json()
  },

  async getProtocol(chainId: number): Promise<ProtocolSnapshot> {
    const res = await fetch(`${API_BASE}/api/protocol?chainId=${chainId}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch protocol`)
    return res.json()
  },

  async getMarkets(chainId: number, filter = 'all', sort = 'yield', search = '', showMatured = false) {
    const query = new URLSearchParams({
      chainId: String(chainId),
      filter,
      sort,
      search,
      showMatured: String(showMatured),
    })
    const res = await fetch(`${API_BASE}/api/markets?${query}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch markets`)
    return res.json()
  },

  async getMarketDetail(id: string, chainId: number) {
    const res = await fetch(`${API_BASE}/api/markets/${id}?chainId=${chainId}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch market`)
    return res.json()
  },

  async getTrades(marketAddress: string, chainId: number): Promise<{ trades: Trade[] }> {
    const res = await fetch(`${API_BASE}/api/trades/${marketAddress}?chainId=${chainId}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch trades`)
    return res.json()
  },

  async getQuote(params: {
    chainId: number
    action: 'yield_buy' | 'yield_sell' | 'fix' | 'strip' | 'redeem'
    marketAddress?: string
    vaultAddress?: string
    amount: string
  }) {
    const res = await fetch(`${API_BASE}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  },

  async getPortfolio(address: string, chainId: number): Promise<PortfolioData> {
    const res = await fetch(`${API_BASE}/api/portfolio/${address}?chainId=${chainId}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch portfolio`)
    return res.json()
  },
}

// ------------------------------------------------------------------ Formatting Utilities
export const WAD = 10n ** 18n

export function toNum(v: string | bigint | number, decimals = 18): number {
  if (typeof v === 'number') return v
  const s = String(v)
  if (!s || s === '0') return 0
  try {
    const b = BigInt(s)
    const factor = 10 ** decimals
    return Number(b) / factor
  } catch {
    return Number(s) || 0
  }
}

export function num(v: number, dp = 2): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function amount(v: string | bigint | number, decimals = 18): string {
  const n = toNum(v, decimals)
  if (n === 0) return '0'
  const a = Math.abs(n)
  if (a >= 1000) return num(n, 0)
  if (a >= 1) return num(n, 2)
  if (a >= 0.0001) return num(n, 4)
  return n.toExponential(2)
}

export function usd(v: string | bigint | number, dp?: number): string {
  const n = toNum(v)
  const a = Math.abs(n)
  const d = dp ?? (a > 0 && a < 1 ? 4 : 2)
  return `${n < 0 ? '−' : ''}$${num(a, d)}`
}

export function compactUsd(v: string | bigint | number): string {
  const n = toNum(v)
  return `$${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n)}`
}

export function pct(v: string | bigint | number, dp = 2): string {
  const n = toNum(v)
  return `${num(n * 100, dp)}%`
}

export function date(ts: string | number): string {
  const t = Number(ts) * 1000
  return new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function duration(secs: number | string): string {
  const n = Number(secs)
  if (!n || isNaN(n)) return '0d'
  let s: number
  if (n > 1e15) {
    // WAD fraction of years (tau * 1e18)
    s = Math.max(0, (n / 1e18) * 31536000)
  } else if (n > 1e8) {
    // Unix timestamp
    s = Math.max(0, n - Math.floor(Date.now() / 1000))
  } else {
    // Raw seconds
    s = Math.max(0, n)
  }
  const d = Math.floor(s / 86400)
  if (d >= 365) return `${(d / 365).toFixed(1)}y`
  if (d >= 30) return `${Math.round(d / 30)}mo`
  if (d >= 1) return `${d}d`
  const h = Math.floor(s / 3600)
  return h >= 1 ? `${h}h` : `${Math.floor(s / 60)}m`
}


export function short(a: string): string {
  if (!a || a.length < 10) return a || ''
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}
