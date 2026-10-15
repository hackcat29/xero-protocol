import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { AccountButton } from './Account'
import { Logo } from './Brand'
import { TestTokensButton } from './DevConsole'
import { ActivityIcon, DiscountIcon, DocsIcon, GiftIcon, HomeIcon, MarketsIcon, PoolIcon, PortfolioIcon, TradeIcon, UpfrontIcon } from './icons'
import { DOCS_URL, GitHubIcon, NetworkSwitch, REPO_URL } from './Nav'
import { SearchButton } from './Search'
import { chain, isDemo } from '../lib/network'

/* The app follows the layout of brokerage web apps (Public, Coinbase, Schwab): a sidebar for where you
   are, a top bar for search and your account, and a tab bar on phones. */

const NAV: { group?: string; items: { to: string; label: string; icon: ReactNode; end?: boolean }[] }[] = [
  {
    items: [
      { to: '/app', label: 'Home', icon: <HomeIcon />, end: true },
      { to: '/markets', label: 'Markets', icon: <MarketsIcon /> },
    ],
  },
  {
    group: 'Trade',
    items: [
      { to: '/discount', label: 'Buy at a discount', icon: <DiscountIcon /> },
      { to: '/upfront', label: 'Dividends upfront', icon: <UpfrontIcon /> },
    ],
  },
  {
    group: 'Earn',
    items: [{ to: '/liquidity', label: 'Liquidity', icon: <PoolIcon /> }],
  },
  {
    group: 'Account',
    items: [
      { to: '/portfolio', label: 'Portfolio', icon: <PortfolioIcon /> },
      { to: '/activity', label: 'Activity', icon: <ActivityIcon /> },
    ],
  },
]

/** Phones get five tabs, as brokerage apps do: Trade opens a sheet with both trade flows, Earn is liquidity. */
const TRADE = [
  { to: '/discount', label: 'Buy at a discount', desc: "Pay less than today's price for shares delivered later", icon: <DiscountIcon size={22} /> },
  { to: '/upfront', label: 'Dividends upfront', desc: 'Get paid now for the dividends your shares will earn', icon: <UpfrontIcon size={22} /> },
]

function TabBar() {
  const { pathname } = useLocation()
  const [trade, setTrade] = useState(false)
  const onTrade = TRADE.some((t) => pathname.startsWith(t.to))
  useEffect(() => setTrade(false), [pathname])
  useEffect(() => {
    if (!trade) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setTrade(false)
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [trade])

  return (
    <>
      {trade && (
        <div className="trade-sheet-root">
          <div className="trade-sheet-overlay" onClick={() => setTrade(false)} />
          <div className="trade-sheet" role="dialog" aria-label="Trade">
            <div className="trade-sheet-grab" aria-hidden="true" />
            {TRADE.map((t) => (
              <Link key={t.to} to={t.to} className={pathname.startsWith(t.to) ? 'on' : ''}>
                <span className="menu-icon">{t.icon}</span>
                <span className="menu-text"><b>{t.label}</b><small>{t.desc}</small></span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="tabbar" aria-label="App">
        <NavLink to="/app" end><HomeIcon size={22} />Home</NavLink>
        <NavLink to="/markets"><MarketsIcon size={22} />Markets</NavLink>
        <button className={onTrade || trade ? 'active' : ''} aria-expanded={trade} aria-haspopup="dialog" onClick={() => setTrade((o) => !o)}>
          <TradeIcon size={22} />Trade
        </button>
        <NavLink to="/liquidity"><PoolIcon size={22} />Earn</NavLink>
        <NavLink to="/portfolio"><PortfolioIcon size={22} />Portfolio</NavLink>
      </nav>
    </>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="App">
        <div className="sidebar-logo"><Logo /></div>
        <nav className="side-nav">
          {NAV.map((g, i) => (
            <div key={i} className="side-group">
              {g.group && <div className="side-label">{g.group}</div>}
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end}>
                  {it.icon}
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          {isDemo && (
            <div className="faucet-card">
              <GiftIcon size={22} />
              <b>Free test stock</b>
              <p>Claim test versions of the stocks on Base to try Xero.</p>
              <TestTokensButton label="Get test tokens" className="btn btn-sm btn-gold btn-block" />
            </div>
          )}
          <a className="side-link" href={DOCS_URL} target="_blank" rel="noreferrer"><DocsIcon size={18} />Help and docs</a>
          <div className="side-meta">
            <Link to="/">About Xero</Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub"><GitHubIcon size={15} /></a>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-logo"><Logo /></div>
          <div className="topbar-search"><SearchButton /></div>
          <div className="topbar-right">
            <span className="show-sm"><SearchButton compact /></span>
            {isDemo && <span className="show-md"><TestTokensButton label={<><GiftIcon size={16} /><span className="hide-sm">Test tokens</span></>} className="btn btn-sm btn-gold" /></span>}
            <NetworkSwitch />
            <AccountButton />
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="app-foot">
          <span>Xero on {chain.name}{isDemo ? ' · test tokens only, no real value' : ''}</span>
          <span>Not financial advice.</span>
        </footer>
      </div>

      <TabBar />
    </div>
  )
}
