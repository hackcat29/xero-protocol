import * as Tabs from '@radix-ui/react-tabs'
import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useAccount } from 'wagmi'
import { StockMark } from '../components/Brand'
import { HistoryChart, YieldCurveChart, type Point } from '../components/Charts'
import { Info, Skeleton, Stat } from '../components/Info'
import { TradeTicket, type TicketTab } from '../components/TradeTicket'
import { company, ptName, stockInfo, term, ticker, ytName } from '../lib/assets'
import { WAD, amount, compactUsd, date, duration, pct, short, timeAgo, toNum, usd } from '../lib/format'
import { explorer } from '../lib/network'
import { usePortfolio, useProtocol, useTrades, type Asset, type Market, type Position, type Trade } from '../lib/protocol'

export function AssetPage() {
  const { symbol } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, isLoading } = useProtocol()
  const asset = data?.assets.find((a) => a.symbol.toLowerCase() === symbol?.toLowerCase())
  const markets = asset?.markets ?? []
  const market = markets.find((m) => m.label === params.get('m')) ?? markets.find((m) => m.live && m.label === '1Y') ?? markets.find((m) => m.live) ?? markets[0]
  const tab = (params.get('do') as TicketTab | null) ?? 'discount'

  if (isLoading || !data) {
    return (
      <div className="page">
        <Skeleton w={320} h={44} />
        <div style={{ height: 24 }} />
        <Skeleton h={360} />
      </div>
    )
  }
  if (!asset || !market) {
    return (
      <div className="page">
        <div className="card empty-state">
          <h3>We don't list {symbol?.toUpperCase()} yet</h3>
          <Link to="/markets" className="btn">Back to markets</Link>
        </div>
      </div>
    )
  }
  const info = stockInfo(asset.symbol)

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/markets">Markets</Link> <span>/</span> {ticker(asset.symbol)}
      </nav>
      <header className="asset-h">
        <div className="asset-title">
          <StockMark symbol={asset.symbol} size={56} />
          <div>
            <h1>{company(asset.symbol)}</h1>
            <p>{ticker(asset.symbol)} · {info.kind === 'etf' ? 'ETF' : 'Stock'} · tokenized on Base as {asset.symbol}</p>
          </div>
        </div>
        <div className="asset-price">
          <b>{asset.priceFresh ? usd(asset.sharePriceUsd) : '—'}</b>
          <span>{asset.priceFresh ? 'Price per share' : 'Price feed is updating'}</span>
        </div>
      </header>

      <div className="maturity-tabs" role="tablist" aria-label="Maturity">
        {markets.map((m) => (
          <button key={m.vault} role="tab" aria-selected={m.vault === market.vault} className={m.vault === market.vault ? 'on' : ''} onClick={() => setParams({ m: m.label }, { replace: true })}>
            <b>{date(m.maturity)}</b>
            <span>{m.live ? `${term(m.label)} · ${m.ptDiscountPct.toFixed(2)}% off` : m.matured ? 'Ended' : '—'}</span>
          </button>
        ))}
      </div>

      {market.frozen && <div className="banner banner-warn">Paused while a corporate action for {ticker(asset.symbol)} is confirmed. You can still rejoin, redeem and claim.</div>}
      {market.halted && <div className="banner banner-warn">New deposits are paused for {ticker(asset.symbol)}. Existing positions can always exit.</div>}
      {market.matured && <div className="banner">This maturity ended on {date(market.maturity)}. Share tokens now redeem for shares.</div>}

      <div className="asset-grid">
        <div className="col">
          {market.live && (
            <div className="choices">
              <div>
                <small>Buy at a discount</small>
                <strong className="up">{market.ptDiscountPct.toFixed(2)}% off</strong>
                <p>Pay {usd(market.ptUsd)} today for one share delivered on {date(market.maturity)}. That's {pct(market.ptFixedYield / 100)} a year if the price holds.</p>
              </div>
              <div className="y">
                <small>Dividends upfront</small>
                <strong className="gold">{usd(market.ytUsd * 100)}</strong>
                <p>Paid today for every 100 shares you hold, for their dividends until {date(market.maturity)}. Your shares come back on that date.</p>
              </div>
            </div>
          )}
          <ChartCard asset={asset} market={market} />
          <section className="card card-pad">
            <div className="card-h"><h3>Market details</h3></div>
            <div className="stat-grid">
              <Stat label="Expected dividend yield" value={<span className="gold">{pct(market.impliedYield)}</span>} tip="The yearly dividend rate this market is pricing in until maturity, in shares." />
              <Stat label="Share token" value={asset.priceFresh ? usd(market.ptUsd) : '—'} sub={ptName(market)} />
              <Stat label="Dividend token" value={asset.priceFresh ? usd(market.ytUsd) : '—'} sub={ytName(market)} />
              <Stat label="Time left" value={market.matured ? 'Ended' : duration(Number(market.maturity) - data.now)} sub={date(market.maturity)} />
              <Stat label="Liquidity" value={compactUsd(market.liquidityUsd)} tip="Value held in the pool that prices this market's dividends." />
              <Stat label="Shares in the vault" value={amount(market.totalUnits)} tip="Shares deposited into this maturity's vault. Every share token and dividend token is backed by them." />
            </div>
          </section>
          <Trades asset={asset} market={market} />
        </div>
        <aside className="col">
          <TradeTicket key={market.vault + tab} asset={asset} market={market} now={data.now} tab={tab} />
          <PositionCard asset={asset} market={market} />
        </aside>
      </div>
    </div>
  )
}

function ChartCard({ asset, market }: { asset: Asset; market: Market }) {
  const { data: trades } = useTrades(market.live ? market.market : undefined)
  const history: Point[] = useMemo(() => {
    const pts = (trades ?? []).map((t: Trade) => ({ time: t.time, value: toNum((t.impliedRate * market.dividendIndex) / WAD) * 100 }))
    return pts.length ? [...pts, { time: Math.max(...pts.map((p: Point) => p.time)) + 1, value: toNum(market.impliedYield) * 100 }] : []
  }, [trades, market])
  const live = asset.markets.filter((m) => m.live && m.tau > 0n)
  const curve: Point[] = live.map((m) => ({ time: Number(m.maturity), value: toNum(m.impliedYield) * 100 }))
  const forwards: Point[] = asset.forwards.map((f, i) => ({ time: Number(live[i]?.maturity ?? 0), value: toNum(f) * 100 })).filter((p) => p.time > 0)

  return (
    <section className="card chart-card">
      <Tabs.Root defaultValue="curve">
        <div className="card-h">
          <div>
            <h3><Info tip="The yearly dividend rate the market expects, taken from what people pay for the dividends.">Expected dividend yield</Info></h3>
            <div className="big gold">{pct(market.impliedYield)}</div>
          </div>
          <Tabs.List className="seg seg-sm" aria-label="Chart">
            <Tabs.Trigger value="curve">By maturity</Tabs.Trigger>
            <Tabs.Trigger value="history">History</Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="curve">
          {curve.length > 0 ? <YieldCurveChart curve={curve} forwards={forwards} /> : <div className="chart-empty">No open maturities.</div>}
          <p className="chart-note">Expected yield for each maturity (solid) and between maturities (dashed).</p>
        </Tabs.Content>
        <Tabs.Content value="history">
          {history.length > 1 ? <HistoryChart data={history} /> : <div className="chart-empty">No trades in the last week. The market opened at {pct(market.impliedYield)}.</div>}
        </Tabs.Content>
      </Tabs.Root>
    </section>
  )
}

function Trades({ asset, market }: { asset: Asset; market: Market }) {
  const { data, isLoading } = useTrades(market.live ? market.market : undefined)
  const rows = (data ?? []).slice(0, 12)
  const now = Date.now() / 1000
  return (
    <section className="card card-pad">
      <div className="card-h"><h3>Recent dividend trades</h3></div>
      {isLoading ? (
        <Skeleton h={120} />
      ) : rows.length === 0 ? (
        <p className="sub">No trades in the last week.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Side</th>
                <th className="r">Dividend tokens</th>
                <th className="r">{asset.symbol}</th>
                <th className="r">Expected yield</th>
                <th className="r">Trader</th>
                <th className="r">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t: Trade) => (
                <tr key={t.hash + t.time}>
                  <td><span className={t.side === 'buy' ? 'up' : 'down'}>{t.side === 'buy' ? 'Bought' : 'Sold'}</span></td>
                  <td className="r">{amount(t.yt)}</td>
                  <td className="r">{amount(t.quote)}</td>
                  <td className="r">{pct((t.impliedRate * market.dividendIndex) / WAD)}</td>
                  <td className="r mono">{short(t.trader)}</td>
                  <td className="r">{explorer ? <a className="link" href={`${explorer}/tx/${t.hash}`} target="_blank" rel="noreferrer">{timeAgo(t.time, Math.max(now, t.time))}</a> : timeAgo(t.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PositionCard({ asset, market }: { asset: Asset; market: Market }) {
  const { address } = useAccount()
  const { data } = usePortfolio(address)
  if (!address) return null
  const p = data?.positions.find((x: Position) => x.market.vault === market.vault)
  if (!p) return null
  return (
    <section className="card card-pad">
      <div className="card-h"><h3>Your position</h3></div>
      <div className="rows">
        <div className="row"><span>Shares due {date(market.maturity)}</span><b>{amount(p.pt)}</b></div>
        <div className="row"><span>Dividend tokens</span><b className="gold">{amount(p.yt)}</b></div>
        {p.lp > 0n && <div className="row"><span>Pool shares</span><b>{amount(p.lp)}</b></div>}
        <div className="row"><span>Dividends to claim</span><b>{amount(p.claimable)} {asset.symbol}</b></div>
        <div className="row total"><span>Value today</span><b>{usd(p.valueUsd)}</b></div>
      </div>
    </section>
  )
}
