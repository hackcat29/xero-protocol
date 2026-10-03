import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link, NavLink } from 'react-router'
import { Logo } from './Brand'
import { chain, isDemo, isDevnet } from '../lib/network'
import { DevConsoleButton } from './DevConsole'

export const REPO_URL = 'https://github.com/UncleTom29/xero-protocol'
export const DOCS_URL = `${REPO_URL}#readme`

/** Marketing header: product sections and a way into the app. No wallet or network chrome here. */
export function SiteNav() {
  return (
    <header className="nav nav-site">
      <div className="nav-inner">
        <Logo />
        <nav className="site-links" aria-label="Site">
          <a href="#product">Product</a>
          <a href="#use-cases">Use cases</a>
          <a href="#security">Security</a>
          <a href={DOCS_URL} target="_blank" rel="noreferrer">Docs</a>
        </nav>
        <div className="nav-right">
          <a className="icon-link" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Xero on GitHub" title="GitHub">
            <GitHubIcon />
          </a>
          <Link to="/markets" className="btn btn-primary">Launch app</Link>
        </div>
      </div>
    </header>
  )
}

/** App header: the app's sections sit with the network and wallet they act on. */
export function AppNav() {
  return (
    <>
      <header className="nav nav-app">
        <div className="nav-inner">
          <Logo />
          <div className="nav-right">
            <nav className="app-tabs" aria-label="App">
              <NavLink to="/markets"><MarketsIcon />Markets</NavLink>
              <NavLink to="/portfolio"><PortfolioIcon />Portfolio</NavLink>
            </nav>
            <span className="nav-sep" aria-hidden="true" />
            {isDemo && <DevConsoleButton />}
            <span className="chain-pill" title={`Connected network: ${chain.name}`}>
              <i className={isDevnet ? 'dot dot-dev' : 'dot'} />
              {chain.name}
            </span>
            <WalletButton />
          </div>
        </div>
      </header>
      <nav className="tabbar" aria-label="App">
        <NavLink to="/markets"><MarketsIcon />Markets</NavLink>
        <NavLink to="/portfolio"><PortfolioIcon />Portfolio</NavLink>
      </nav>
    </>
  )
}

export function WalletButton({ block = false }: { block?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain: c, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        if (!mounted) return <button className="btn btn-primary" aria-hidden disabled>Connect</button>
        if (!account) {
          return (
            <button className={`btn btn-primary ${block ? 'btn-block' : ''}`} onClick={openConnectModal}>
              Connect wallet
            </button>
          )
        }
        if (c?.unsupported) {
          return (
            <button className={`btn btn-danger ${block ? 'btn-block' : ''}`} onClick={openChainModal}>
              Switch network
            </button>
          )
        }
        return (
          <button className={`btn btn-account ${block ? 'btn-block' : ''}`} onClick={openAccountModal}>
            <span className="avatar" style={{ background: `hsl(${parseInt(account.address.slice(2, 6), 16) % 360} 40% 45%)` }} />
            {account.displayName}
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}

const MarketsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12.5l3.5-4 3 2.5L14 4" />
    <path d="M10.5 4H14v3.5" />
  </svg>
)

const PortfolioIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <rect x="2" y="4.5" width="12" height="9" rx="2" />
    <path d="M5.5 4.5V3.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v1" />
  </svg>
)

export const GitHubIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
)
