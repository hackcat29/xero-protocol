import { StarIcon } from './icons'
import { ticker } from '../lib/assets'
import { prefs, usePrefs } from '../lib/prefs'

/** Star a stock to follow it on Home and filter it in Markets. */
export function WatchButton({ symbol, size = 18, label }: { symbol: string; size?: number; label?: boolean }) {
  const on = usePrefs((p) => p.watchlist.includes(symbol))
  const name = `${on ? 'Remove' : 'Add'} ${ticker(symbol)} ${on ? 'from' : 'to'} watchlist`
  return (
    <button
      className={`watch ${on ? 'on' : ''} ${label ? 'btn btn-sm' : 'icon-btn'}`}
      aria-pressed={on}
      aria-label={name}
      title={name}
      onClick={(e) => {
        e.stopPropagation()
        prefs.toggleWatch(symbol)
      }}
    >
      <StarIcon filled={on} size={size} />
      {label && (on ? 'Watching' : 'Watch')}
    </button>
  )
}
