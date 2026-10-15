import { Link } from 'react-router'
import { useAccount } from 'wagmi'
import { ActivityIcon, DiscountIcon, ExternalIcon, PortfolioIcon, UpfrontIcon } from '../components/icons'
import { WalletButton } from '../components/Nav'
import { short, timeAgo } from '../lib/format'
import { chainId, explorer } from '../lib/network'
import { usePrefs, type ActivityEntry } from '../lib/prefs'

const kindIcon = (title: string) =>
  /discount/i.test(title) ? <DiscountIcon size={18} /> : /upfront/i.test(title) ? <UpfrontIcon size={18} /> : /redeem|rejoin|claim/i.test(title) ? <PortfolioIcon size={18} /> : <ActivityIcon size={18} />

const day = (t: number) => {
  const d = new Date(t * 1000)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
}

export function Activity() {
  const { address } = useAccount()
  const all = usePrefs((p) => p.activity)
  const items = all.filter((a) => a.chainId === chainId && (!address || a.account.toLowerCase() === address.toLowerCase()))
  const groups = items.reduce<Record<string, ActivityEntry[]>>((g, a) => ((g[day(a.time)] ??= []).push(a), g), {})

  return (
    <div className="page page-narrow">
      <header className="page-h">
        <div>
          <h1>Activity</h1>
          <p className="sub">Transactions you've made with Xero in this browser.</p>
        </div>
        {address && explorer && (
          <a className="btn" href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer">
            Full history on explorer <ExternalIcon size={16} />
          </a>
        )}
      </header>

      {!address && items.length === 0 ? (
        <div className="card empty-state">
          <h3>Connect a wallet to see your activity</h3>
          <WalletButton />
        </div>
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <h3>No activity yet</h3>
          <p className="sub">Your trades, redemptions and claims will appear here.</p>
          <Link to="/discount" className="btn btn-primary">Make your first trade</Link>
        </div>
      ) : (
        Object.entries(groups).map(([d, list]) => (
          <section key={d} className="activity-day">
            <h2 className="activity-date">{d}</h2>
            <div className="card">
              <ul className="activity-list">
                {list.map((a) => (
                  <li key={a.hash}>
                    <span className="activity-icon">{kindIcon(a.title)}</span>
                    <div>
                      <b>{a.title}</b>
                      <small>{new Date(a.time * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {timeAgo(a.time)} · {short(a.hash)}</small>
                    </div>
                    <span className="tag tag-ok">Confirmed</span>
                    {explorer && (
                      <a className="icon-btn" href={`${explorer}/tx/${a.hash}`} target="_blank" rel="noreferrer" aria-label="View on explorer" title="View on explorer">
                        <ExternalIcon size={16} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))
      )}
    </div>
  )
}
