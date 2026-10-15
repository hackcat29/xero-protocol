import { Link } from 'react-router'
import { Logo } from './Brand'
import { DOCS_URL, REPO_URL, docsLink } from './Nav'
import { BASE_FAUCET_URL, explorer } from '../lib/network'

const LEGAL =
  'Xero is open-source software running on the Base network. It is not a broker, bank or investment adviser, and is not affiliated with the issuers of the stocks shown. ' +
  'The current version runs on Base Sepolia, a test network: tokens there have no monetary value. Tokenized stocks, share tokens and dividend tokens carry market and smart-contract risk, ' +
  'and future dividends are never guaranteed. Nothing on this site is financial advice.'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>Buy stocks at a discount, or get your dividends in advance.</p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Products</h4>
            <Link to="/#discount">Buy at a discount</Link>
            <Link to="/#upfront">Dividends upfront</Link>
            <Link to="/markets">Markets</Link>
            <Link to="/pricing">Pricing</Link>
          </div>
          <div>
            <h4>Learn</h4>
            <Link to="/#split">How Xero works</Link>
            <a href={docsLink('quickstart')} target="_blank" rel="noreferrer">Guides</a>
            <Link to="/#faq">FAQ</Link>
            <Link to="/security">Security</Link>
          </div>
          <div>
            <h4>Developers</h4>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">Documentation</a>
            <a href={docsLink('developers/deployments')} target="_blank" rel="noreferrer">Contract addresses</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
            {explorer && <a href={explorer} target="_blank" rel="noreferrer">Block explorer</a>}
            <a href={BASE_FAUCET_URL} target="_blank" rel="noreferrer">Test ETH faucet</a>
          </div>
        </div>
      </div>
      <p className="footer-legal">{LEGAL}</p>
    </footer>
  )
}
