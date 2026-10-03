import { Link } from 'react-router'

/** Xero mark: a token cut by an X, the yield wedge (amber) separating east. Geometry from brand/generate.py. */
export function Mark({ size = 28, principal = 'var(--paper)' }: { size?: number; principal?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        fill={principal}
        d="M32 34.97L48.84 51.81A26 26 0 0 1 15.16 51.81ZM29.03 32L12.19 48.84A26 26 0 0 1 12.19 15.16ZM32 29.03L15.16 12.19A26 26 0 0 1 48.84 12.19Z"
      />
      <path fill="var(--amber)" d="M38.37 32L55.21 15.16A26 26 0 0 1 55.21 48.84Z" />
    </svg>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Xero home">
      <Mark size={26} />
      <span className="logo-word">xero</span>
    </Link>
  )
}
