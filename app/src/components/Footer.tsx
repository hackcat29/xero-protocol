import { Link } from 'react-router'
import { Logo } from './Brand'
import { DOCS_URL, GitHubIcon, REPO_URL } from './Nav'

export const TAGLINE = 'Keep the stock. Trade the dividends.'

const LEGAL =
  'Xero is an independent protocol and is not affiliated with, endorsed by, or sponsored by Robinhood. Stock Tokens, Principal Tokens and Yield Tokens carry market risk; Yield Token value depends on future dividends, which are not guaranteed. Not available to persons in restricted jurisdictions. Nothing here is investment advice.'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>{TAGLINE}</p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>App</h4>
            <Link to="/markets">Markets</Link>
            <Link to="/portfolio">Portfolio</Link>
          </div>
          <div>
            <h4>Protocol</h4>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">Docs</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
            <a href="#security">Security</a>
          </div>
          <div>
            <h4>Build</h4>
            <a href="https://docs.robinhood.com/chain/" target="_blank" rel="noreferrer">Robinhood Chain docs</a>
            <a href="https://docs.chain.link/data-feeds/tokenized-equity-feeds/robinhood" target="_blank" rel="noreferrer">Chainlink equity feeds</a>
          </div>
        </div>
      </div>
      <p className="footer-legal">{LEGAL}</p>
    </footer>
  )
}

/** In-app footer: one line, so trading screens stay the focus. */
export function AppFooter() {
  return (
    <footer className="footer footer-app">
      <div className="footer-app-inner">
        <span>Independent of Robinhood. Yield Tokens depend on future dividends, which are not guaranteed. Not investment advice.</span>
        <span className="footer-app-links">
          <a href={DOCS_URL} target="_blank" rel="noreferrer">Docs</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub"><GitHubIcon size={15} /></a>
        </span>
      </div>
    </footer>
  )
}
