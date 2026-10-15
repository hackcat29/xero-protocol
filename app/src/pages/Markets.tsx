import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { StockMark } from '../components/Brand'
import { Info, Skeleton, Stat } from '../components/Info'
import { ChevronIcon, StarIcon } from '../components/icons'
import { WatchButton } from '../components/Watch'
import { usePrefs } from '../lib/prefs'
import { company, stockInfo, term, ticker } from '../lib/assets'
import { compactUsd, date, pct, toNum, usd } from '../lib/format'
import { useProtocol, type Asset, type Market } from '../lib/protocol'

type Filter = 'all' | 'watchlist' | 'stock' | 'etf'
type View = 'stocks' | 'maturities'
type SortKey = 'discount' | 'maturity' | 'symbol' | 'upfront' | 'liquidity'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'stock', label: 'Stocks' },
  { id: 'etf', label: 'ETFs' },
]

export function Markets() {
  const { data, isLoading, error } = useProtocol()
  const watch = usePrefs((p) => p.watchlist)
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('stocks')
  const [q, setQ] = useState('')
  const [showMatured, setShowMatured] = useState(false)

  const keep = (symbol: string) => {
    const s = q.trim().toLowerCase()
    if (filter === 'watchlist' && !watch.includes(symbol)) return false
    if ((filter === 'stock' || filter === 'etf') && stockInfo(symbol).kind !== filter) return false
    return !s || ticker(symbol).toLowerCase().includes(s) || company(symbol).toLowerCase().includes(s)
  }
  const markets = useMemo(() => (data?.markets ?? []).filter((m) => (showMatured || m.live) && keep(m.symbol)), [data, filter, q, showMatured, watch])
  const assets = useMemo(() => (data?.assets ?? []).filter((a) => keep(a.symbol)), [data, filter, q, watch])

  const live = data?.markets.filter((m) => m.live) ?? []
  const best = live.reduce<Market | undefined>((b, m) => (!b || m.ptDiscountPct > b.ptDiscountPct ? m : b), undefined)
  const bestUp = live.reduce<Market | undefined>((b, m) => (!b || m.ytUsd > b.ytUsd ? m : b), undefined)
  const empty = view === 'stocks' ? assets.length === 0 : markets.length === 0

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <h1>Markets</h1>
          <p className="sub">Every stock on Xero, with today's discount and upfront payout for each maturity.</p>
        </div>
        <div className="stats">
          <Stat label="Best discount" value={best ? <span className="up">{best.ptDiscountPct.toFixed(2)}%</span> : <Skeleton w={70} h={24} />} sub={best ? `${ticker(best.symbol)} · ${term(best.label)}` : undefined} />
          <Stat label="Most paid upfront" value={bestUp ? <span className="gold">{usd(bestUp.ytUsd * 100)}</span> : <Skeleton w={70} h={24} />} sub={bestUp ? `per 100 ${ticker(bestUp.symbol)} · ${term(bestUp.label)}` : undefined} />
          <Stat label="Open markets" value={data ? live.length : <Skeleton w={40} h={24} />} sub={data ? `${data.assets.length} stocks · 4 dates` : undefined} />
        </div>
      </header>

      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} role="radio" aria-checked={filter === f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
              {f.id === 'watchlist' && <StarIcon size={14} filled={filter === 'watchlist'} />}
              {f.label}
            </button>
          ))}
        </div>
        <input className="search" placeholder="Filter by name or ticker" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter markets" />
        <div className="seg seg-sm" role="radiogroup" aria-label="View">
          <button role="radio" aria-checked={view === 'stocks'} className={view === 'stocks' ? 'on' : ''} onClick={() => setView('stocks')}>By stock</button>
          <button role="radio" aria-checked={view === 'maturities'} className={view === 'maturities' ? 'on' : ''} onClick={() => setView('maturities')}>All maturities</button>
        </div>
        {view === 'maturities' && (
          <label className="check">
            <input type="checkbox" checked={showMatured} onChange={(e) => setShowMatured(e.target.checked)} /> Show ended
          </label>
        )}
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>We can't reach the network right now</h3>
          <p className="sub">Check your connection and try again in a moment.</p>
        </div>
      ) : isLoading || !data ? (
        <div className="card card-pad"><Skeleton h={280} /></div>
      ) : empty ? (
        <div className="card empty-state">
          <h3>{filter === 'watchlist' && !q ? 'Your watchlist is empty' : 'No markets match'}</h3>
          <p className="sub">{filter === 'watchlist' && !q ? 'Star a stock to add it here.' : 'Try another name or filter.'}</p>
          {filter !== 'all' && <button className="btn" onClick={() => { setFilter('all'); setQ('') }}>Show all stocks</button>}
        </div>
      ) : view === 'stocks' ? (
        <StockList assets={assets} />
      ) : (
        <MarketsTable markets={markets} assets={data.assets} />
      )}
    </div>
  )
}

/** One row per stock, like a brokerage watchlist; each expands into its maturities. */
function StockList({ assets }: { assets: Asset[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="card stock-list">
      <div className="stock-row stock-head" aria-hidden="true">
        <span />
        <span>Stock</span>
        <span className="r">Price</span>
        <span className="r">Best discount</span>
        <span className="r hide-sm">Upfront per 100</span>
        <span />
      </div>
      {assets.map((a) => {
        const live = a.markets.filter((m) => m.live)
        const best = live.reduce<Market | undefined>((b, m) => (!b || m.ptDiscountPct > b.ptDiscountPct ? m : b), undefined)
        const isOpen = open === a.symbol
        return (
          <div key={a.token} className={`stock-item ${isOpen ? 'open' : ''}`}>
            <div className="stock-row" role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : a.symbol)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(isOpen ? null : a.symbol))}>
              <WatchButton symbol={a.symbol} size={16} />
              <div className="stock">
                <StockMark symbol={a.symbol} size={40} />
                <div><b>{ticker(a.symbol)}</b><small>{company(a.symbol)}</small></div>
              </div>
              <div className="r num"><b>{a.priceFresh ? usd(a.sharePriceUsd) : '—'}</b></div>
              <div className="r num">{best ? <><b className="up">{best.ptDiscountPct.toFixed(2)}%</b><small>{term(best.label)}</small></> : '—'}</div>
              <div className="r num hide-sm">{best ? <><b className="gold">{usd(best.ytUsd * 100)}</b><small>{term(best.label)}</small></> : '—'}</div>
              <span className="chev"><ChevronIcon size={18} /></span>
            </div>
            {isOpen && (
              <div className="stock-detail">
                <div className="maturity-grid">
                  {live.map((m) => (
                    <div key={m.vault} className="maturity-card">
                      <div className="maturity-top"><b>{date(m.maturity)}</b><span className="tag">{term(m.label)}</span></div>
                      <div className="maturity-figs">
                        <div><small>Discount price</small><b>{usd(m.ptUsd)}</b><span className="up">{m.ptDiscountPct.toFixed(2)}% off · {pct(m.ptFixedYield / 100, 1)}/yr</span></div>
                        <div><small>Upfront per 100</small><b className="gold">{usd(m.ytUsd * 100)}</b><span>{m.ptDiscountPct.toFixed(2)}% of position</span></div>
                      </div>
                      <div className="maturity-actions">
                        <Link className="btn btn-sm btn-primary" to={`/discount?s=${a.symbol}&m=${m.label}`}>Buy at discount</Link>
                        <Link className="btn btn-sm" to={`/upfront?s=${a.symbol}&m=${m.label}`}>Upfront</Link>
                      </div>
                    </div>
                  ))}
                </div>
                <Link className="link" to={`/markets/${a.symbol}`}>Open {ticker(a.symbol)} market →</Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function MarketsTable({ markets, assets, compact }: { markets: Market[]; assets: Asset[]; compact?: boolean }) {
  const nav = useNavigate()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'discount', dir: -1 })

  const rows = useMemo(() => {
    const v = (m: Market) =>
      sort.key === 'discount' ? m.ptDiscountPct : sort.key === 'upfront' ? m.ytUsd : sort.key === 'maturity' ? Number(m.maturity) : sort.key === 'liquidity' ? m.liquidityUsd : 0
    return [...markets].sort((a, b) =>
      sort.key === 'symbol' ? ticker(a.symbol).localeCompare(ticker(b.symbol)) * sort.dir : (v(a) - v(b)) * sort.dir || Number(a.maturity - b.maturity),
    )
  }, [markets, sort])

  const th = (key: SortKey, label: React.ReactNode, cls = 'r') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}>
        {label}
        {sort.key === key && <span aria-hidden="true">{sort.dir === 1 ? '↑' : '↓'}</span>}
      </button>
    </th>
  )
  const go = (m: Market) => nav(`/markets/${m.symbol}?m=${m.label}`)

  return (
    <div className="card">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {th('symbol', 'Stock', '')}
              {th('maturity', 'Matures', '')}
              <th className="r">Price today</th>
              {th('discount', <Info tip="What one share costs on Xero today, delivered at maturity, and how much less that is than the market price.">Discount price</Info>)}
              {!compact && <th className="r"><Info tip="Your discount spread over the time to maturity, if the share price stays the same.">Return / yr</Info></th>}
              {th('upfront', <Info tip="What 100 shares' dividends until maturity are worth today, paid upfront.">Dividends upfront</Info>)}
              {!compact && th('liquidity', 'Liquidity')}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const asset = assets.find((a) => a.token === m.token)!
              return (
                <tr key={m.vault} className="clickable" onClick={() => go(m)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(m)}>
                  <td>
                    <div className="stock">
                      <StockMark symbol={m.symbol} size={36} />
                      <div>
                        <b>{ticker(m.symbol)}</b>
                        <small>{company(m.symbol)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <b>{date(m.maturity)}</b>
                    <small>{m.matured ? 'Ended' : term(m.label)}</small>
                  </td>
                  <td className="r"><b>{asset.priceFresh ? usd(m.unitUsd) : '—'}</b></td>
                  <td className="r">
                    <b>{asset.priceFresh ? usd(m.ptUsd) : '—'}</b>
                    {m.live && <span className="pill-discount">{m.ptDiscountPct.toFixed(2)}% off</span>}
                  </td>
                  {!compact && <td className="r"><b className="up">{m.live ? pct(m.ptFixedYield / 100) : '—'}</b></td>}
                  <td className="r">
                    <b className="gold">{asset.priceFresh && m.live ? usd(m.ytUsd * 100) : '—'}</b>
                    <small>per 100 shares</small>
                  </td>
                  {!compact && <td className="r"><b>{compactUsd(m.liquidityUsd)}</b></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
