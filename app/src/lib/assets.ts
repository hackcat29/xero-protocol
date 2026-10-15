/** Human names for the tokenized stocks. On-chain names are long issuer strings; people know tickers and companies. */
const INFO: Record<string, { ticker: string; name: string; kind: 'stock' | 'etf'; paysDividend: boolean }> = {
  NVDAc: { ticker: 'NVDA', name: 'NVIDIA', kind: 'stock', paysDividend: true },
  AAPLc: { ticker: 'AAPL', name: 'Apple', kind: 'stock', paysDividend: true },
  COINc: { ticker: 'COIN', name: 'Coinbase', kind: 'stock', paysDividend: false },
  TSLAc: { ticker: 'TSLA', name: 'Tesla', kind: 'stock', paysDividend: false },
  SPYc: { ticker: 'SPY', name: 'SPDR S&P 500 ETF', kind: 'etf', paysDividend: true },
  SCHDc: { ticker: 'SCHD', name: 'Schwab U.S. Dividend Equity ETF', kind: 'etf', paysDividend: true },
}

export function stockInfo(symbol: string) {
  return INFO[symbol] ?? { ticker: symbol.replace(/c$/, ''), name: symbol, kind: 'stock' as const, paysDividend: true }
}

export const ticker = (symbol: string) => stockInfo(symbol).ticker
export const company = (symbol: string) => stockInfo(symbol).name

/** "1Y" -> "1 year" for people, keeping the short label for tight spaces. */
export const TERM: Record<string, string> = { '1W': '1 week', '3M': '3 months', '6M': '6 months', '1Y': '1 year' }
export const term = (label: string) => TERM[label] ?? label

const monthYear = (ts: bigint | number) => new Date(Number(ts) * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

/** The principal token, in words: it becomes the share at maturity. */
export const ptName = (m: { symbol: string; maturity: bigint }) => `${ticker(m.symbol)} share token · ${monthYear(m.maturity)}`
/** The yield token, in words: it collects the share's dividends until maturity. */
export const ytName = (m: { symbol: string; maturity: bigint }) => `${ticker(m.symbol)} dividend token · ${monthYear(m.maturity)}`
