import { StockMark } from './Brand'
import { ticker } from '../lib/assets'

/** Round chip for a token: the stock itself, its principal (green), its dividends (brass), or a pool share. */
export function TokenIcon({ symbol, kind = 'stock', size = 32 }: { symbol: string; kind?: 'stock' | 'pt' | 'yt' | 'lp'; size?: number }) {
  if (kind === 'stock') return <StockMark symbol={symbol} size={size} />
  const text = kind === 'lp' ? 'LP' : ticker(symbol.replace(/^x/, '').split('-')[0])
  return (
    <span className={`token-icon token-${kind}`} style={{ width: size, height: size, fontSize: size * (text.length > 3 ? 0.27 : 0.33) }} aria-hidden="true">
      {text}
    </span>
  )
}
