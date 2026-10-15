import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { AccountButton } from './Account'
import { Logo } from './Brand'
import { TestTokensButton } from './DevConsole'
import { ActivityIcon, DiscountIcon, DocsIcon, GiftIcon, HomeIcon, MarketsIcon, PortfolioIcon, UpfrontIcon } from './icons'
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
    group: 'Account',
    items: [
      { to: '/portfolio', label: 'Portfolio', icon: <PortfolioIcon /> },
      { to: '/activity', label: 'Activity', icon: <ActivityIcon /> },
    ],
  },
]

const TABS = [
  { to: '/app', label: 'Home', icon: <HomeIcon size={22} />, end: true },
  { to: '/markets', label: 'Markets', icon: <MarketsIcon size={22} /> },
  { to: '/discount', label: 'Discount', icon: <DiscountIcon size={22} /> },
  { to: '/upfront', label: 'Upfront', icon: <UpfrontIcon size={22} /> },
  { to: '/portfolio', label: 'Portfolio', icon: <PortfolioIcon size={22} /> },
]

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

      <nav className="tabbar" aria-label="App">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>{t.icon}{t.label}</NavLink>
        ))}
      </nav>
    </div>
  )
}
