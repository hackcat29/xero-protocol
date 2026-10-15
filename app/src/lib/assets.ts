/** The Coinbase B20 stocks on Base (base.org/stocks), by token symbol. On-chain names are legal entity names;
 *  people know tickers and short company names. */
const INFO: Record<string, { ticker: string; name: string }> = {
  AAPLc: { ticker: 'AAPL', name: 'Apple' },
  AMZNc: { ticker: 'AMZN', name: 'Amazon' },
  GOOGLc: { ticker: 'GOOGL', name: 'Alphabet' },
  METAc: { ticker: 'META', name: 'Meta' },
  MSFTc: { ticker: 'MSFT', name: 'Microsoft' },
  MSTRc: { ticker: 'MSTR', name: 'Strategy' },
  NVDAc: { ticker: 'NVDA', name: 'NVIDIA' },
  SNDKc: { ticker: 'SNDK', name: 'SanDisk' },
  SPCXc: { ticker: 'SPCX', name: 'SpaceX' },
  TSLAc: { ticker: 'TSLA', name: 'Tesla' },
}

/** The example used across the site: the largest dividend payer among the Base stocks. */
export const FLAGSHIP = 'MSFTc'
/** Stocks shown first in the hero and suggested for new watchlists: the dividend payers. */
export const FEATURED = ['MSFTc', 'AAPLc', 'METAc', 'GOOGLc']

export function stockInfo(symbol: string) {
  return INFO[symbol] ?? { ticker: symbol.replace(/c$/, ''), name: symbol }
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
