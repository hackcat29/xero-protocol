import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { StockMark } from '../components/Brand'
import { Info, Skeleton, Stat } from '../components/Info'
import { company, stockInfo, term, ticker } from '../lib/assets'
import { compactUsd, date, pct, toNum, usd } from '../lib/format'
import { useProtocol, type Asset, type Market } from '../lib/protocol'

type Filter = 'all' | 'stock' | 'etf'
type SortKey = 'discount' | 'maturity' | 'symbol' | 'upfront' | 'liquidity'

export function Markets() {
  const { data, isLoading, error } = useProtocol()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [showMatured, setShowMatured] = useState(false)

  const markets = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data?.markets ?? []).filter((m) => {
      if (!showMatured && !m.live) return false
      if (filter !== 'all' && stockInfo(m.symbol).kind !== filter) return false
      return !s || ticker(m.symbol).toLowerCase().includes(s) || company(m.symbol).toLowerCase().includes(s)
    })
  }, [data, filter, q, showMatured])

  const live = data?.markets.filter((m) => m.live) ?? []
  const best = live.reduce<Market | undefined>((b, m) => (!b || m.ptDiscountPct > b.ptDiscountPct ? m : b), undefined)

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <h1>Markets</h1>
          <p className="sub">Every stock and maturity on Xero. Pick one to buy it below today's price, or to take its dividends upfront.</p>
        </div>
        <div className="stats">
          <Stat label="Open markets" value={data ? live.length : <Skeleton w={40} h={24} />} />
          <Stat label="Best discount today" value={best ? <span className="up">{best.ptDiscountPct.toFixed(2)}%</span> : <Skeleton w={70} h={24} />} sub={best ? `${ticker(best.symbol)}, ${term(best.label)}` : undefined} />
        </div>
      </header>

      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Filter">
          {(['all', 'stock', 'etf'] as Filter[]).map((f) => (
            <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'stock' ? 'Stocks' : 'ETFs'}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={showMatured} onChange={(e) => setShowMatured(e.target.checked)} /> Show ended
        </label>
        <input className="search" placeholder="Search Apple, SPY…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search markets" />
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>We can't reach the network right now</h3>
          <p className="sub">Check your connection and try again in a moment.</p>
        </div>
      ) : isLoading || !data ? (
        <div className="card card-pad"><Skeleton h={280} /></div>
      ) : markets.length === 0 ? (
        <div className="card empty-state"><h3>No markets match your search</h3></div>
      ) : (
        <MarketsTable markets={markets} assets={data.assets} />
      )}
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
