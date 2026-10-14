import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { Sparkline } from '../components/Charts'
import { Info, Skeleton, Stat } from '../components/Info'
import { MarketIcon } from '../components/TokenIcon'
import { WAD, compactUsd, date, duration, pct, toNum, usd } from '../lib/format'
import { useProtocol, useTrades, type Asset, type Market, type Trade } from '../lib/protocol'

const ETFS = new Set(['SPYc', 'SCHDc', 'SPY', 'SCHD', 'QQQ', 'VOO', 'IWM', 'VTI'])
type Filter = 'all' | 'stocks' | 'etfs'
type SortKey = 'yield' | 'maturity' | 'liquidity' | 'symbol' | 'discount'

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
          <div className="badge-chain-row">
            <span className="base-tag">BASE</span>
            <span className="b20-standard-tag">Coinbase B20 Equities</span>
          </div>
          <h1>B20 Tokenized Stock Markets</h1>
          <p className="sub">
            Trade yield-stripped tokenized stocks on Base. Capture discounted stock capital (PT) or leveraged dividend yields (YT).
          </p>
        </div>
        <div className="page-stats">
          <Stat label="Total stripped" value={data ? compactUsd(data.tvlUsd) : <Skeleton w={80} h={22} />} />
          <Stat label="Base liquidity" value={data ? compactUsd(data.liquidityUsd) : <Skeleton w={80} h={22} />} />
          <Stat label="Live markets" value={data ? data.markets.filter((m) => m.live).length : <Skeleton w={40} h={22} />} />
        </div>
      </header>

      {/* Quick Access Primitives Ribbon */}
      <div className="markets-primitive-ribbon card">
        <Link to="/strip" className="ribbon-item">
          <span className="ribbon-icon">✂️</span>
          <div>
            <b>Strip Vault</b>
            <span>Mint PT + YT from B20 Stocks</span>
          </div>
        </Link>
        <Link to="/discount" className="ribbon-item">
          <span className="ribbon-icon">🏷️</span>
          <div>
            <b>Discounted Stocks</b>
            <span>Buy PT up to 12% off spot</span>
          </div>
        </Link>
        <Link to="/speculate" className="ribbon-item">
          <span className="ribbon-icon">⚡</span>
          <div>
            <b>Dividend Speculation</b>
            <span>Up to 120x dividend cash flow</span>
          </div>
        </Link>
      </div>

      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Filter">
          {(['all', 'stocks', 'etfs'] as Filter[]).map((f) => (
            <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All B20 Equities' : f === 'stocks' ? 'Tech & Equities' : 'Index & ETFs'}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={showMatured} onChange={(e) => setShowMatured(e.target.checked)} /> Show matured
        </label>
        <input className="search" placeholder="Search NVDAc, AAPLc, COINc…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search markets" />
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>Can't reach Base Network</h3>
          <p className="sub">{(error as Error).message}</p>
        </div>
      ) : isLoading || !data ? (
        <div className="card"><TableSkeleton /></div>
      ) : markets.length === 0 ? (
        <div className="card empty-state"><h3>No markets match your criteria</h3></div>
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
      sort.key === 'yield'
        ? toNum(m.impliedYield)
        : sort.key === 'discount'
        ? m.ptDiscountPct
        : sort.key === 'maturity'
        ? Number(m.maturity)
        : sort.key === 'liquidity'
        ? m.liquidityUsd
        : 0

    return [...markets].sort((a, b) =>
      sort.key === 'symbol'
        ? a.symbol.localeCompare(b.symbol) * sort.dir
        : (v(a) - v(b)) * sort.dir || Number(a.maturity - b.maturity),
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
              {th('symbol', 'B20 Asset', '')}
              {th('maturity', 'Tenor')}
              {th('yield', <Info tip="Annualized reinvested-dividend yield implied by the YT price on Base.">Implied yield</Info>)}
              {!compact && <th className="num">Trend</th>}
              <th className="num"><Info tip="Yield Token price and effective dividend leverage.">YT price (Leverage)</Info></th>
              {th('discount', <Info tip="Principal Token price, spot discount %, and guaranteed fixed APY at maturity.">PT price (Discount)</Info>)}
              {th('liquidity', 'Base Liquidity')}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const asset = assets.find((a) => a.token === m.token)!
              const px = toNum(asset.priceUsd)
              return (
                <tr
                  key={m.vault}
                  onClick={() => nav(`/markets/${m.symbol}?m=${m.label}`)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && nav(`/markets/${m.symbol}?m=${m.label}`)}
                >
                  <td>
                    <div className="mkt">
                      <MarketIcon symbol={m.symbol} size={30} />
                      <div>
                        <b>{m.symbol}</b>
                        <span>{asset.name} · {toNum(asset.multiplier).toFixed(4)}x</span>
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    <b>{m.label} ({date(m.maturity, { day: 'numeric', month: 'short' })})</b>
                    <span>{m.matured ? 'matured' : duration(Number(m.maturity) - now)}</span>
                  </td>
                  <td className="num">
                    <b className="amber">{m.live ? pct(m.impliedYield) : '—'}</b>
                    {(m.frozen || m.halted) && <span className="tag tag-warn">{m.halted ? 'halted' : 'frozen'}</span>}
                  </td>
                  {!compact && <td className="num"><Trend market={m} /></td>}
                  <td className="num">
                    <b>{asset.priceFresh ? usd(toNum(m.ytPrice) * px) : `${toNum(m.ytPrice).toFixed(4)}`}</b>
                    <span className="amber">{m.ytLeverage.toFixed(0)}x leverage</span>
                  </td>
                  <td className="num">
                    <b>{asset.priceFresh ? usd(toNum(m.ptPrice) * px) : '—'}</b>
                    <span className="up">−{m.ptDiscountPct.toFixed(1)}% ({m.ptFixedYield.toFixed(1)}% fixed)</span>
                  </td>
                  <td className="num"><b>{compactUsd(m.liquidityUsd)}</b></td>
                  <td className="num">
                    <span className="btn btn-sm btn-ghost table-action-btn">Trade</span>
                  </td>
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
    .map((t: Trade) => toNum((t.impliedRate * market.dividendIndex) / WAD))
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
