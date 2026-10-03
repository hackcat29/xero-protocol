import { amount, toInput } from '../lib/format'
import { TokenIcon } from './TokenIcon'

type Props = {
  label: string
  value: string
  onChange?: (v: string) => void
  symbol: string
  kind?: 'stock' | 'pt' | 'yt' | 'lp'
  balance?: bigint
  usd?: string
  readOnly?: boolean
  error?: boolean
}

export function AmountInput({ label, value, onChange, symbol, kind = 'stock', balance, usd, readOnly, error }: Props) {
  return (
    <div className={`amount ${readOnly ? 'amount-ro' : ''} ${error ? 'amount-err' : ''}`}>
      <div className="amount-top">
        <span>{label}</span>
        {balance !== undefined && (
          <span className="amount-bal">
            Balance {amount(balance)}
            {!readOnly && balance > 0n && (
              <button type="button" className="chip-btn" onClick={() => onChange?.(toInput(balance))}>
                Max
              </button>
            )}
          </span>
        )}
      </div>
      <div className="amount-row">
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          readOnly={readOnly}
          aria-label={`${label} (${symbol})`}
          onChange={(e) => onChange?.(e.target.value.replace(/[^0-9.]/g, ''))}
        />
        <span className="amount-token">
          <TokenIcon symbol={symbol} kind={kind} size={22} />
          {symbol}
        </span>
      </div>
      {usd && <div className="amount-usd">{usd}</div>}
    </div>
  )
}
