import { Link } from 'react-router'
import { useAccount, useBalance } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { StockMark } from '../components/Brand'
import { TestTokensButton } from '../components/DevConsole'
import { CheckIcon, ClockIcon } from '../components/icons'
import { Skeleton } from '../components/Info'
import { WatchButton } from '../components/Watch'
import { company, term, ticker } from '../lib/assets'
import { date, duration, toNum, usd } from '../lib/format'
import { BASE_FAUCET_URL, isDemo } from '../lib/network'
import { usePrefs } from '../lib/prefs'
import { usePortfolio, useProtocol, type Market, type Position } from '../lib/protocol'

export function Home() {
  const { address } = useAccount()
  const { data } = useProtocol()
  const { data: book } = usePortfolio(address)
  const live = data?.markets.filter((m) => m.live) ?? []
  const bestDiscount = live.reduce<Market | undefined>((b, m) => (!b || m.ptDiscountPct > b.ptDiscountPct ? m : b), undefined)
  const bestUpfront = live.reduce<Market | undefined>((b, m) => (!b || m.ytUsd > b.ytUsd ? m : b), undefined)

  return (
    <div className="page">
      <div className="home-grid">
        <div className="col">
          <Summary />
          <section>
            <div className="section-title"><h2>Today's best offers</h2><Link to="/markets" className="link">All markets</Link></div>
            <div className="offer-pair">
              {bestDiscount ? (
                <Link className="best best-discount" to={`/discount?s=${bestDiscount.symbol}&m=${bestDiscount.label}`}>
                  <span className="best-tag">Buy at a discount</span>
                  <div className="stock"><StockMark symbol={bestDiscount.symbol} size={36} /><div><b>{ticker(bestDiscount.symbol)}</b><small>{company(bestDiscount.symbol)}</small></div></div>
                  <strong className="up">{bestDiscount.ptDiscountPct.toFixed(2)}% off</strong>
                  <p>{usd(bestDiscount.ptUsd)} instead of {usd(bestDiscount.unitUsd)}, delivered {date(bestDiscount.maturity)}</p>
                </Link>
              ) : <Skeleton h={180} />}
              {bestUpfront ? (
                <Link className="best best-upfront" to={`/upfront?s=${bestUpfront.symbol}&m=${bestUpfront.label}`}>
                  <span className="best-tag">Dividends upfront</span>
                  <div className="stock"><StockMark symbol={bestUpfront.symbol} size={36} /><div><b>{ticker(bestUpfront.symbol)}</b><small>{company(bestUpfront.symbol)}</small></div></div>
                  <strong className="gold">{usd(bestUpfront.ytUsd * 100)}</strong>
                  <p>Paid today per 100 shares, for dividends until {date(bestUpfront.maturity)}</p>
                </Link>
              ) : <Skeleton h={180} />}
            </div>
          </section>
          <Upcoming positions={book?.positions} markets={live} connected={!!address} />
        </div>
        <aside className="col">
          {isDemo && <Checklist />}
          <Watchlist />
        </aside>
      </div>
    </div>
  )
}

function Summary() {
  const { address } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { data: protocol } = useProtocol()
  const { data, isLoading } = usePortfolio(address)

  if (!address) {
    return (
      <section className="card summary summary-welcome">
        <span className="eyebrow">Welcome to Xero</span>
        <h1>Buy stocks below market price, or take your dividends today.</h1>
        <p className="sub">Connect a wallet to see your portfolio. {isDemo ? 'Everything here uses free test tokens.' : ''}</p>
        <div className="row-btns" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-primary btn-lg" onClick={openConnectModal}>Connect wallet</button>
          <Link to="/markets" className="btn btn-lg">Browse markets</Link>
        </div>
      </section>
    )
  }
  const wallet = protocol && data ? protocol.assets.reduce((a, s) => a + toNum(data.stocks[s.token] ?? 0n) * toNum(s.priceUsd), 0) : 0
  const total = data ? data.valueUsd + wallet : 0
  return (
    <section className="card summary">
      <span className="summary-label">Total value</span>
      <div className="summary-value">{data ? usd(total) : <Skeleton w={220} h={48} />}</div>
      <div className="summary-split">
        <div><span>On Xero</span><b>{isLoading || !data ? '—' : usd(data.valueUsd)}</b></div>
        <div><span>Shares in wallet</span><b>{isLoading || !data ? '—' : usd(wallet)}</b></div>
        <div><span>Dividends to claim</span><b className="gold">{isLoading || !data ? '—' : usd(data.claimableUsd)}</b></div>
      </div>
      <div className="row-btns" style={{ justifyContent: 'flex-start' }}>
        <Link to="/discount" className="btn btn-primary">Buy at a discount</Link>
        <Link to="/upfront" className="btn">Dividends upfront</Link>
        <Link to="/portfolio" className="btn btn-ghost">Portfolio</Link>
      </div>
    </section>
  )
}

function Upcoming({ positions, markets, connected }: { positions?: Position[]; markets: Market[]; connected: boolean }) {
  const now = Date.now() / 1000
  const mine = (positions ?? []).filter((p) => p.pt > 0n).sort((a, b) => Number(a.market.maturity - b.market.maturity)).slice(0, 5)
  const dates = [...new Set(markets.map((m) => Number(m.maturity)))].sort((a, b) => a - b)
  return (
    <section>
      <div className="section-title"><h2>{connected && mine.length ? 'Your upcoming dates' : 'Upcoming maturity dates'}</h2></div>
      <div className="card">
        {connected && mine.length ? (
          <ul className="timeline-list">
            {mine.map((p) => {
              const due = Number(p.market.maturity)
              const ready = p.market.matured || due <= now
              return (
                <li key={p.market.vault}>
                  <span className="timeline-dot"><ClockIcon size={16} /></span>
                  <div>
                    <b>{toNum(p.pt).toLocaleString('en-US', { maximumFractionDigits: 2 })} {ticker(p.market.symbol)} shares</b>
                    <small>{ready ? `Ready since ${date(due)}` : `Due ${date(due)} · in ${duration(due - now)}`}</small>
                  </div>
                  <Link className={`btn btn-sm ${ready ? 'btn-primary' : ''}`} to={`/markets/${p.market.symbol}?m=${p.market.label}${ready ? '&do=redeem' : ''}`}>
                    {ready ? 'Redeem' : 'View'}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="timeline-list">
            {dates.slice(0, 4).map((d) => {
              const label = markets.find((m) => Number(m.maturity) === d)?.label ?? ''
              return (
                <li key={d}>
                  <span className="timeline-dot"><ClockIcon size={16} /></span>
                  <div><b>{date(d)}</b><small>{term(label)} markets · in {duration(d - now)}</small></div>
                  <Link className="btn btn-sm" to={`/discount?m=${label}`}>Browse</Link>
                </li>
              )
            })}
            {dates.length === 0 && <li className="sub">Loading…</li>}
          </ul>
        )}
      </div>
    </section>
  )
}

function Checklist() {
  const { address } = useAccount()
  const { data: eth } = useBalance({ address, query: { enabled: !!address, refetchInterval: 15_000 } })
  const { data: book } = usePortfolio(address)
  const activity = usePrefs((p) => p.activity)
  const hasStock = !!book && Object.values(book.stocks).some((b) => b > 0n)
  const traded = (book?.positions.length ?? 0) > 0 || activity.some((a) => a.account.toLowerCase() === address?.toLowerCase())
  const steps = [
    { done: !!address, title: 'Connect a wallet', action: null },
    { done: !!eth && eth.value > 0n, title: 'Get test ETH for gas', action: <a className="link" href={BASE_FAUCET_URL} target="_blank" rel="noreferrer">Faucet ↗</a> },
    { done: hasStock, title: 'Claim test stock', action: <TestTokensButton label="Claim" className="link-btn" /> },
    { done: traded, title: 'Make your first trade', action: <Link className="link" to="/discount">Start</Link> },
  ]
  const left = steps.filter((s) => !s.done).length
  if (address && left === 0) return null
  return (
    <section className="card card-pad checklist">
      <div className="card-h"><h3>Get started</h3><span className="tag">{steps.length - left} of {steps.length}</span></div>
      <div className="progress"><span style={{ width: `${((steps.length - left) / steps.length) * 100}%` }} /></div>
      <ol>
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? 'done' : ''}>
            <span className="check">{s.done ? <CheckIcon size={14} /> : i + 1}</span>
            <span>{s.title}</span>
            {!s.done && address && s.action}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Watchlist() {
  const { data } = useProtocol()
  const watch = usePrefs((p) => p.watchlist)
  const assets = (data?.assets ?? []).filter((a) => watch.includes(a.symbol))
  return (
    <section className="card card-pad">
      <div className="card-h"><h3>Watchlist</h3><Link to="/markets" className="link">Add stocks</Link></div>
      {!data ? (
        <Skeleton h={120} />
      ) : assets.length === 0 ? (
        <p className="sub">Star stocks in Markets to follow them here.</p>
      ) : (
        <ul className="watch-list">
          {assets.map((a) => {
            const best = a.markets.filter((m) => m.live).reduce((x, m) => Math.max(x, m.ptDiscountPct), 0)
            return (
              <li key={a.token}>
                <Link to={`/markets/${a.symbol}`} className="stock">
                  <StockMark symbol={a.symbol} size={34} />
                  <div><b>{ticker(a.symbol)}</b><small>{company(a.symbol)}</small></div>
                </Link>
                <div className="watch-figs"><b>{usd(a.sharePriceUsd)}</b><small className="up">up to {best.toFixed(2)}% off</small></div>
                <WatchButton symbol={a.symbol} size={16} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
