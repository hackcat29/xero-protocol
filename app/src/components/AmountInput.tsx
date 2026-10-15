import { amount, toInput } from '../lib/format'
import { TokenIcon } from './TokenIcon'

type Props = {
  label: string
  value: string
  onChange?: (v: string) => void
  /** Token symbol used for the icon. */
  symbol: string
  /** What the person reads next to the amount; defaults to the symbol. */
  tokenLabel?: string
  kind?: 'stock' | 'pt' | 'yt' | 'lp'
  balance?: bigint
  usd?: string
  readOnly?: boolean
  error?: boolean
}

export function AmountInput({ label, value, onChange, symbol, tokenLabel, kind = 'stock', balance, usd, readOnly, error }: Props) {
  const shown = tokenLabel ?? symbol
  return (
    <div className={`amount ${readOnly ? 'amount-ro' : ''} ${error ? 'amount-err' : ''}`}>
      <div className="amount-top">
        <span>{label}</span>
        {balance !== undefined && <span className="amount-bal">Balance {amount(balance)}</span>}
      </div>
      <div className="amount-row">
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          readOnly={readOnly}
          aria-label={`${label} (${shown})`}
          onChange={(e) => onChange?.(e.target.value.replace(/[^0-9.]/g, ''))}
        />
        <span className="amount-token" title={shown}>
          <TokenIcon symbol={symbol} kind={kind} size={24} />
          {shown}
        </span>
      </div>
      <div className="amount-foot">
        <span className="amount-usd">{usd ?? ''}</span>
        {!readOnly && balance !== undefined && balance > 0n && (
          <span className="amount-chips">
            {[25n, 50n, 75n, 100n].map((p) => (
              <button key={String(p)} type="button" className="chip-btn" onClick={() => onChange?.(toInput((balance * p) / 100n))}>
                {p === 100n ? 'Max' : `${p}%`}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}
