/** Neutral monogram for a Stock Token; PT gets a paper ring, YT an amber ring (amber always means yield). */
export function TokenIcon({ symbol, kind = 'stock', size = 32 }: { symbol: string; kind?: 'stock' | 'pt' | 'yt' | 'lp'; size?: number }) {
  const text = symbol.replace(/^x/, '').split('-')[0].slice(0, 4)
  return (
    <span
      className={`token-icon token-${kind}`}
      style={{ width: size, height: size, fontSize: size * (text.length > 3 ? 0.27 : 0.32) }}
      aria-hidden="true"
    >
      {text}
    </span>
  )
}

export function MarketIcon({ symbol, size = 36 }: { symbol: string; size?: number }) {
  return (
    <span className="market-icon" style={{ width: size + 10, height: size }}>
      <TokenIcon symbol={symbol} size={size} />
      <span className="market-icon-yt" style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  )
}
