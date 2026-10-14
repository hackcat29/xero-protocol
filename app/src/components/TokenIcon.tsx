/** Base B20 Token Monogram: Stock, PT, YT, or LP tokens */
export function TokenIcon({
  symbol,
  kind = 'stock',
  size = 32,
}: {
  symbol: string
  kind?: 'stock' | 'pt' | 'yt' | 'lp' | 'b20'
  size?: number
}) {
  const text = symbol.replace(/^x/, '').split('-')[0].slice(0, 5)
  return (
    <span
      className={`token-icon token-${kind}`}
      style={{ width: size, height: size, fontSize: size * (text.length > 4 ? 0.24 : text.length > 3 ? 0.28 : 0.33) }}
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
      <span className="market-icon-yt" style={{ width: size * 0.48, height: size * 0.48 }} title="B20 Yield Stream" />
    </span>
  )
}
