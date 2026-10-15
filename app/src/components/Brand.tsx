import { Link } from 'react-router'
import { ticker } from '../lib/assets'

/** Xero mark: a share cut into four, with the brass slice (its dividends) set apart. */
export function Mark({ size = 28, principal = 'currentColor', yieldColor = 'var(--gold-bright)' }: { size?: number; principal?: string; yieldColor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        fill={principal}
        d="M32 34.97L48.84 51.81A26 26 0 0 1 15.16 51.81ZM29.03 32L12.19 48.84A26 26 0 0 1 12.19 15.16ZM32 29.03L15.16 12.19A26 26 0 0 1 48.84 12.19Z"
      />
      <path fill={yieldColor} d="M38.37 32L55.21 15.16A26 26 0 0 1 55.21 48.84Z" />
    </svg>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Xero home">
      <Mark size={28} />
      <span className="logo-word">xero</span>
    </Link>
  )
}

/** Engraved rosette, the pattern printed on share certificates and banknotes. Drawn from an epitrochoid. */
export function Guilloche({ size = 560, className = '' }: { size?: number; className?: string }) {
  const rings = [0.98, 0.84, 0.7, 0.56]
  const paths = rings.map((k, ri) => {
    const R = 200 * k
    const r = 200 * k * 0.18
    const d = 200 * k * 0.22
    const pts: string[] = []
    for (let i = 0; i <= 1440; i++) {
      const t = (i / 1440) * Math.PI * 2 * 5
      const x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t + ri)
      const y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t + ri)
      pts.push(`${(x + 250).toFixed(1)},${(y + 250).toFixed(1)}`)
    }
    return `M${pts.join('L')}`
  })
  return (
    <svg className={`guilloche ${className}`} width={size} height={size} viewBox="0 0 500 500" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={0.6} />
      ))}
    </svg>
  )
}

const TONES = ['#0e4a37', '#7a4b17', '#2c4a6b', '#6b2f3a', '#3f5a2a', '#4b3b6b']

/** Square monogram for a stock: a ticker set in a toned tile, no third-party logos. */
export function StockMark({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const t = ticker(symbol)
  const tone = TONES[[...t].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
  return (
    <span className="stock-mark" style={{ width: size, height: size, background: tone, fontSize: size * (t.length > 4 ? 0.22 : t.length > 3 ? 0.27 : 0.32), borderRadius: size * 0.28 }} aria-hidden="true">
      {t}
    </span>
  )
}
