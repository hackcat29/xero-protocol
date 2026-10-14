import { Link } from 'react-router'
import { Logo } from './Brand'
import { DOCS_URL, GitHubIcon, REPO_URL } from './Nav'

export const TAGLINE = 'Deconstruct the B20 Multiplier. Fixed Yield & Leveraged Dividends on Base.'

const LEGAL =
  'Xero Protocol is an independent decentralized protocol built on Base and is not affiliated with, endorsed by, or sponsored by Coinbase. B20 Tokenized Equities, Principal Tokens (PT), and Yield Tokens (YT) carry smart contract and market risk. Yield Token value depends on corporate dividend actions, which are declared by equity issuers and are not guaranteed. Not financial advice.'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>{TAGLINE}</p>
          <div className="footer-base-pill">
            <span className="dot dot-base" /> Powered by Base (OP Stack L2)
          </div>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Protocol</h4>
            <Link to="/markets">B20 Markets</Link>
            <Link to="/strip">Strip Vault</Link>
            <Link to="/discount">Discounted Stock</Link>
            <Link to="/speculate">Dividend Speculation</Link>
            <Link to="/portfolio">Portfolio</Link>
          </div>
          <div>
            <h4>Architecture</h4>
            <Link to="/architecture">B20 Math & Formulas</Link>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">Documentation</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub Repository</a>
            <a href="#security">Formal Verification</a>
          </div>
          <div>
            <h4>Base Ecosystem</h4>
            <a href="https://basescan.org" target="_blank" rel="noreferrer">BaseScan Explorer</a>
            <a href="https://docs.base.org" target="_blank" rel="noreferrer">Base Documentation</a>
            <a href="https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet" target="_blank" rel="noreferrer">Base Sepolia Faucet</a>
            <a href="https://docs.chain.link" target="_blank" rel="noreferrer">Chainlink Feeds on Base</a>
          </div>
        </div>
      </div>
      <p className="footer-legal">{LEGAL}</p>
    </footer>
  )
}

/** In-app footer: concise status line with Base indicators */
export function AppFooter() {
  return (
    <footer className="footer footer-app">
      <div className="footer-app-inner">
        <span className="footer-app-base">
          <span className="dot dot-base" /> Base L2 · Coinbase B20 Yield-Stripping Primitives
        </span>
        <span className="footer-app-links">
          <Link to="/architecture">Architecture</Link>
          <a href={DOCS_URL} target="_blank" rel="noreferrer">Docs</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub"><GitHubIcon size={15} /></a>
        </span>
      </div>
    </footer>
  )
}
