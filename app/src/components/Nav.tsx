import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router'
import { Logo } from './Brand'
import { chain, isDemo, isDevnet, networks, switchNetwork } from '../lib/network'
import { TestTokensButton } from './DevConsole'

export const REPO_URL = 'https://github.com/hackcat29/xero-protocol'
const HOSTED_DOCS: string | undefined = import.meta.env.VITE_DOCS_URL
export const DOCS_URL: string = HOSTED_DOCS ?? `${REPO_URL}/tree/main/docs`
/** A docs page by its Mintlify path ("guides/buy-at-a-discount"): the hosted site when configured, else the source on GitHub. */
export const docsLink = (path: string) => (HOSTED_DOCS ? `${HOSTED_DOCS.replace(/\/$/, '')}/${path}` : `${REPO_URL}/blob/main/docs/${path}.mdx`)

/** App header: what you can do, your holdings, network and wallet. */
export function AppNav() {
  return (
    <>
      <header className="nav nav-app">
        <div className="nav-inner">
          <Logo />
          <nav className="app-tabs" aria-label="App">
            <NavLink to="/markets">Markets</NavLink>
            <NavLink to="/discount">Buy at a discount</NavLink>
            <NavLink to="/upfront">Dividends upfront</NavLink>
            <NavLink to="/portfolio">Portfolio</NavLink>
          </nav>
          <div className="nav-right">
            {isDemo && <TestTokensButton />}
            <NetworkSwitch />
            <WalletButton />
          </div>
        </div>
      </header>
      <nav className="tabbar" aria-label="App">
        <NavLink to="/markets"><MarketsIcon />Markets</NavLink>
        <NavLink to="/discount"><DiscountIcon />Discount</NavLink>
        <NavLink to="/upfront"><UpfrontIcon />Upfront</NavLink>
        <NavLink to="/portfolio"><PortfolioIcon />Portfolio</NavLink>
      </nav>
    </>
  )
}

function NetworkSwitch() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const dot = <i className={chain.testnet || isDevnet ? 'dot dot-test' : 'dot'} />
  if (networks.length < 2) {
    return (
      <span className="chain-pill" title={`Network: ${chain.name}`}>
        {dot}
        <span className="net-name">{chain.name}</span>
      </span>
    )
  }
  return (
    <div className="net" ref={root}>
      <button className="chain-pill chain-pill-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Switch network">
        {dot}
        <span className="net-name">{chain.name}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <ul className="net-menu" role="listbox" aria-label="Network">
          {networks.map((n) => (
            <li key={n.id} role="option" aria-selected={n.id === chain.id}>
              <button onClick={() => switchNetwork(n.id)}>
                {n.name}
                {n.id === chain.id && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function WalletButton({ block = false, label = 'Connect wallet' }: { block?: boolean; label?: string }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain: c, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const cls = `btn ${block ? 'btn-block btn-lg' : ''}`
        if (!mounted) return <button className={`${cls} btn-primary`} aria-hidden disabled>{block ? label : 'Connect'}</button>
        if (!account) {
          return (
            <button className={`${cls} btn-primary`} onClick={openConnectModal}>
              {block ? label : 'Connect'}
            </button>
          )
        }
        if (c?.unsupported) {
          return <button className={`${cls} btn-danger`} onClick={openChainModal}>Switch network</button>
        }
        return (
          <button className={`${cls} btn-account`} onClick={openAccountModal}>
            <span className="avatar" style={{ background: `hsl(${parseInt(account.address.slice(2, 6), 16) % 360} 40% 42%)` }} />
            {account.displayName}
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}

// ------------------------------------------------------------------ icons

const icon = { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

const MarketsIcon = () => (
  <svg {...icon}><path d="M3 15l4.5-5 3.5 3L17 6" /><path d="M13 6h4v4" /></svg>
)
const DiscountIcon = () => (
  <svg {...icon}><path d="M17 10.5L10.5 17 3 9.5V3h6.5L17 10.5z" /><circle cx="6.5" cy="6.5" r="1.2" fill="currentColor" /></svg>
)
const UpfrontIcon = () => (
  <svg {...icon}><circle cx="10" cy="10" r="7" /><path d="M10 6v8M7 9l3-3 3 3" /></svg>
)
const PortfolioIcon = () => (
  <svg {...icon}><rect x="3" y="6" width="14" height="11" rx="2" /><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6" /></svg>
)

export const GitHubIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
)
