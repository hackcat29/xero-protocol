import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Sparkline } from '../components/Charts'
import { Info, Skeleton, Stat } from '../components/Info'
import { MarketIcon } from '../components/TokenIcon'
import { WAD, compactUsd, date, duration, pct, toNum, usd } from '../lib/format'
import { useProtocol, useTrades, type Asset, type Market } from '../lib/protocol'

const ETFS = new Set(['SCHD', 'SGOV', 'SPY', 'VTI', 'QQQ', 'BND', 'SHY', 'SPMO', 'VOO', 'IWM'])
type Filter = 'all' | 'stocks' | 'etfs'
type SortKey = 'yield' | 'maturity' | 'liquidity' | 'symbol'

export function Markets() {
  const { data, isLoading, error } = useProtocol()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [showMatured, setShowMatured] = useState(false)

  const markets = useMemo(() => {
    const all = data?.markets ?? []
    return all.filter((m) => {
      if (!showMatured && !m.live) return false
      if (filter === 'etfs' && !ETFS.has(m.symbol)) return false
      if (filter === 'stocks' && ETFS.has(m.symbol)) return false
      const s = q.trim().toLowerCase()
      return !s || m.symbol.toLowerCase().includes(s) || m.assetName.toLowerCase().includes(s)
    })
  }, [data, filter, q, showMatured])

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <h1>Markets</h1>
          <p className="sub">Trade the reinvested dividends of Stock Tokens, by maturity.</p>
        </div>
        <div className="page-stats">
          <Stat label="Value stripped" value={data ? compactUsd(data.tvlUsd) : <Skeleton w={80} h={22} />} />
          <Stat label="Liquidity" value={data ? compactUsd(data.liquidityUsd) : <Skeleton w={80} h={22} />} />
          <Stat label="Markets" value={data ? data.markets.filter((m) => m.live).length : <Skeleton w={40} h={22} />} />
        </div>
      </header>

      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Filter">
          {(['all', 'stocks', 'etfs'] as Filter[]).map((f) => (
            <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'stocks' ? 'Stocks' : 'ETFs'}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={showMatured} onChange={(e) => setShowMatured(e.target.checked)} /> Show matured
        </label>
        <input className="search" placeholder="Search ticker or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search markets" />
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>Can't reach the network</h3>
          <p className="sub">{(error as Error).message}</p>
        </div>
      ) : isLoading || !data ? (
        <div className="card"><TableSkeleton /></div>
      ) : markets.length === 0 ? (
        <div className="card empty-state"><h3>No markets match</h3></div>
      ) : (
        <MarketsTable markets={markets} assets={data.assets} now={data.now} />
      )}
    </div>
  )
}

export function MarketsTable({ markets, assets, now, compact }: { markets: Market[]; assets: Asset[]; now: number; compact?: boolean }) {
  const nav = useNavigate()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'yield', dir: -1 })
  const rows = useMemo(() => {
    const v = (m: Market) =>
      sort.key === 'yield' ? toNum(m.impliedYield) : sort.key === 'maturity' ? Number(m.maturity) : sort.key === 'liquidity' ? m.liquidityUsd : 0
    return [...markets].sort((a, b) =>
      sort.key === 'symbol' ? a.symbol.localeCompare(b.symbol) * sort.dir : (v(a) - v(b)) * sort.dir || Number(a.maturity - b.maturity),
    )
  }, [markets, sort])
  const th = (key: SortKey, label: React.ReactNode, cls = 'num') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}>
        {label}
        {sort.key === key && <span aria-hidden="true">{sort.dir === 1 ? '↑' : '↓'}</span>}
      </button>
    </th>
  )

  return (
    <div className="card table-card">
      <div className="table-wrap">
        <table className="markets-table">
          <thead>
            <tr>
              {th('symbol', 'Market', '')}
              {th('maturity', 'Maturity')}
              {th('yield', <Info tip="Annualised reinvested-dividend yield implied by the YT price, in share terms.">Implied yield</Info>)}
              {!compact && <th className="num">Trend</th>}
              <th className="num"><Info tip="Price of the Yield Token: the market value of one unit's dividends until maturity.">YT price</Info></th>
              <th className="num"><Info tip="Price of the Principal Token and its fixed annual return in shares if held to maturity.">PT price</Info></th>
              {th('liquidity', 'Liquidity')}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const asset = assets.find((a) => a.token === m.token)!
              const px = toNum(asset.priceUsd)
              return (
                <tr key={m.vault} onClick={() => nav(`/markets/${m.symbol}?m=${m.label}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nav(`/markets/${m.symbol}?m=${m.label}`)}>
                  <td>
                    <div className="mkt">
                      <MarketIcon symbol={m.symbol} size={30} />
                      <div>
                        <b>{m.symbol}</b>
                        <span>{asset.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    <b>{date(m.maturity, { day: 'numeric', month: 'short', year: '2-digit' })}</b>
                    <span>{m.matured ? 'matured' : duration(Number(m.maturity) - now)}</span>
                  </td>
                  <td className="num">
                    <b className="amber">{m.live ? pct(m.impliedYield) : '—'}</b>
                    {(m.frozen || m.halted) && <span className="tag tag-warn">{m.halted ? 'halted' : 'frozen'}</span>}
                  </td>
                  {!compact && <td className="num"><Trend market={m} /></td>}
                  <td className="num">
                    <b>{asset.priceFresh ? usd(toNum(m.ytPrice) * px) : `${toNum(m.ytPrice).toFixed(4)}`}</b>
                    <span>{pct((m.ytPrice * WAD) / (m.parValue || 1n), 2)} of unit</span>
                  </td>
                  <td className="num">
                    <b>{asset.priceFresh ? usd(toNum(m.ptPrice) * px) : '—'}</b>
                    <span>{m.live ? `${pct(m.ptFixedYield)} fixed` : ''}</span>
                  </td>
                  <td className="num"><b>{compactUsd(m.liquidityUsd)}</b></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Trend({ market }: { market: Market }) {
  const { data } = useTrades(market.live ? market.market : undefined)
  const values = (data ?? [])
    .slice()
    .reverse()
    .map((t) => toNum((t.impliedRate * market.dividendIndex) / WAD))
  values.push(toNum(market.impliedYield))
  return <Sparkline values={values.slice(-30)} />
}

function TableSkeleton() {
  return (
    <div className="stack" style={{ padding: 16 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} h={36} />
      ))}
    </div>
  )
}
