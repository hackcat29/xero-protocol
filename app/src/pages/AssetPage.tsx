import * as Tabs from '@radix-ui/react-tabs'
import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useAccount } from 'wagmi'
import { HistoryChart, YieldCurveChart, type Point } from '../components/Charts'
import { Info, Skeleton, Stat } from '../components/Info'
import { MarketIcon } from '../components/TokenIcon'
import { TradeTicket } from '../components/TradeTicket'
import { WAD, amount, compactUsd, date, duration, pct, short, timeAgo, toNum, usd } from '../lib/format'
import { explorer } from '../lib/network'
import { usePortfolio, useProtocol, useTrades, type Asset, type Market } from '../lib/protocol'

export function AssetPage() {
  const { symbol } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, isLoading } = useProtocol()
  const asset = data?.assets.find((a) => a.symbol.toLowerCase() === symbol?.toLowerCase())
  const markets = asset?.markets ?? []
  const market = markets.find((m) => m.label === params.get('m')) ?? markets.find((m) => m.live) ?? markets[0]

  if (isLoading || !data) {
    return (
      <div className="page">
        <Skeleton w={280} h={40} />
        <div style={{ height: 24 }} />
        <Skeleton h={320} />
      </div>
    )
  }
  if (!asset || !market) {
    return (
      <div className="page">
        <div className="card empty-state">
          <h3>No Xero markets for {symbol?.toUpperCase()}</h3>
          <Link to="/markets" className="btn">Back to markets</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/markets">Markets</Link> <span>/</span> {asset.symbol}
      </nav>
      <header className="asset-h">
        <div className="asset-title">
          <MarketIcon symbol={asset.symbol} size={44} />
          <div>
            <h1>{asset.symbol}</h1>
            <p className="sub">{asset.name} · Stock Token</p>
          </div>
        </div>
        <div className="page-stats">
          <Stat label="Share price" value={asset.priceFresh ? usd(asset.sharePriceUsd) : 'stale'} tip="Underlying share price: the Chainlink total-return price divided by the token multiplier." />
          <Stat label="Multiplier" value={toNum(asset.multiplier).toFixed(6)} tip="Shares per Stock Token (uiMultiplier). Grows as dividends are reinvested; jumps on splits." />
          <Stat label="Value stripped" value={compactUsd(asset.tvlUsd)} />
        </div>
      </header>

      <div className="maturity-tabs" role="tablist" aria-label="Maturity">
        {markets.map((m) => (
          <button
            key={m.vault}
            role="tab"
            aria-selected={m.vault === market.vault}
            className={m.vault === market.vault ? 'on' : ''}
            onClick={() => setParams({ m: m.label }, { replace: true })}
          >
            <b>{m.label}</b>
            <span>{m.live ? pct(m.impliedYield) : m.matured ? 'matured' : '—'}</span>
          </button>
        ))}
      </div>

      {market.frozen && <div className="banner banner-warn">This vault is paused while a corporate action is attested. Recombination and claims remain open.</div>}
      {market.halted && <div className="banner banner-warn">Stripping is halted after an unsupported corporate action. Existing positions can always exit.</div>}
      {market.matured && <div className="banner">This maturity has settled. Principal Tokens redeem for their Stock Tokens.</div>}

      <div className="asset-grid">
        <div className="col">
          <ChartCard asset={asset} market={market} />
          <section className="card stats-grid">
            <Stat label="Implied yield" value={<span className="amber">{pct(market.impliedYield)}</span>} tip="Annualised reinvested-dividend yield implied by this market." />
            <Stat label="YT price" value={asset.priceFresh ? usd(toNum(market.ytPrice) * toNum(asset.priceUsd)) : amount(market.ytPrice)} sub={`${amount(market.ytPrice)} ${asset.symbol}`} />
            <Stat label="PT price" value={asset.priceFresh ? usd(toNum(market.ptPrice) * toNum(asset.priceUsd)) : amount(market.ptPrice)} sub={`${pct(market.ptFixedYield)} fixed in shares`} />
            <Stat label="Maturity" value={date(market.maturity)} sub={market.matured ? 'settled' : `${duration(Number(market.maturity) - data.now)} left`} />
            <Stat label="Liquidity" value={compactUsd(market.liquidityUsd)} sub={`${amount(market.reserveYt)} YT · ${amount(market.reserveQuote)} ${asset.symbol}`} />
            <Stat label="Units outstanding" value={amount(market.totalUnits)} sub={`Dividend index ${toNum(market.dividendIndex).toFixed(6)}`} tip="Each unit is one PT plus one YT. The dividend index is the multiplier with splits divided out." />
          </section>
          <Trades asset={asset} market={market} />
        </div>
        <aside className="col side">
          <TradeTicket asset={asset} market={market} now={data.now} />
          <PositionCard asset={asset} market={market} />
          <section className="card about">
            <h3>About this market</h3>
            <p>
              <b>{market.ytSymbol}</b> accrues the extra {asset.symbol} shares created by reinvested dividends on one unit until{' '}
              {date(market.maturity)}, claimable as Stock Tokens. <b>{market.ptSymbol}</b> redeems at maturity for the original
              share exposure. Together they always equal the deposited Stock Token.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function ChartCard({ asset, market }: { asset: Asset; market: Market }) {
  const { data: trades } = useTrades(market.live ? market.market : undefined)
  const history: Point[] = useMemo(() => {
    const pts = (trades ?? []).map((t) => ({ time: t.time, value: toNum((t.impliedRate * market.dividendIndex) / WAD) * 100 }))
    return pts.length ? [...pts, { time: Math.max(...pts.map((p) => p.time)) + 1, value: toNum(market.impliedYield) * 100 }] : []
  }, [trades, market])
  const live = asset.markets.filter((m) => m.live && m.tau > 0n)
  const curve: Point[] = live.map((m) => ({ time: Number(m.maturity), value: toNum(m.impliedYield) * 100 }))
  const forwards: Point[] = asset.forwards.map((f, i) => ({ time: Number(live[i]?.maturity ?? 0), value: toNum(f) * 100 })).filter((p) => p.time > 0)

  return (
    <section className="card chart-card">
      <Tabs.Root defaultValue="history">
        <div className="card-h">
          <div>
            <h3><Info tip="Implied yield after every trade in this market.">Implied yield</Info></h3>
            <div className="big amber">{pct(market.impliedYield)}</div>
          </div>
          <Tabs.List className="seg seg-sm" aria-label="Chart">
            <Tabs.Trigger value="history">{market.label} history</Tabs.Trigger>
            <Tabs.Trigger value="curve">Dividend curve</Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="history">
          {history.length > 1 ? <HistoryChart data={history} /> : <div className="chart-empty">No trades yet. The market opened at {pct(market.impliedYield)}.</div>}
        </Tabs.Content>
        <Tabs.Content value="curve">
          {curve.length > 0 ? <YieldCurveChart curve={curve} forwards={forwards} /> : <div className="chart-empty">No live maturities.</div>}
          <p className="chart-note">Implied yield by maturity (amber) and the forward yield between maturities (dashed).</p>
        </Tabs.Content>
      </Tabs.Root>
    </section>
  )
}

function Trades({ asset, market }: { asset: Asset; market: Market }) {
  const { data, isLoading } = useTrades(market.market)
  const rows = (data ?? []).slice(0, 12)
  const now = Date.now() / 1000
  return (
    <section className="card">
      <div className="card-h"><h3>Recent trades</h3></div>
      {isLoading ? (
        <Skeleton h={120} />
      ) : rows.length === 0 ? (
        <p className="sub">No trades yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="trades">
            <thead>
              <tr>
                <th>Side</th>
                <th className="num">YT</th>
                <th className="num">{asset.symbol}</th>
                <th className="num">Implied yield</th>
                <th className="num">Trader</th>
                <th className="num">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.hash + t.time}>
                  <td><span className={t.side === 'buy' ? 'up' : 'down'}>{t.side === 'buy' ? 'Buy' : 'Sell'}</span></td>
                  <td className="num">{amount(t.yt)}</td>
                  <td className="num">{amount(t.quote)}</td>
                  <td className="num">{pct((t.impliedRate * market.dividendIndex) / WAD)}</td>
                  <td className="num mono">{short(t.trader)}</td>
                  <td className="num">
                    {explorer ? <a href={`${explorer}/tx/${t.hash}`} target="_blank" rel="noreferrer">{timeAgo(t.time, Math.max(now, t.time))}</a> : new Date(t.time * 1000).toLocaleDateString()}
                  </td>
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
  const p = data?.positions.find((x) => x.market.vault === market.vault)
  return (
    <section className="card position">
      <h3>Your position</h3>
      <div className="rows">
        <div className="row"><span>Principal</span><b>{amount(p?.pt ?? 0n)} PT</b></div>
        <div className="row"><span>Yield</span><b className="amber">{amount(p?.yt ?? 0n)} YT</b></div>
        <div className="row"><span>Liquidity</span><b>{amount(p?.lp ?? 0n)} XLP</b></div>
        <div className="row"><span>Claimable</span><b>{amount(p?.claimable ?? 0n)} {asset.symbol}</b></div>
        <div className="row total"><span>Value</span><b>{usd(p?.valueUsd ?? 0)}</b></div>
      </div>
    </section>
  )
}
