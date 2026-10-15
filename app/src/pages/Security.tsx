import { Guilloche } from '../components/Brand'
import { REPO_URL, docsLink } from '../components/Nav'

const s = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
const ICONS = {
  wallet: <svg {...s}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M16 12.5h2M3 9.5h18" /></svg>,
  scale: <svg {...s}><path d="M12 4v16M6 20h12M5 8h14M7 8l-3 6a3 3 0 0 0 6 0L7 8zm10 0l-3 6a3 3 0 0 0 6 0l-3-6z" /></svg>,
  door: <svg {...s}><path d="M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15M4 20h16" /><path d="M14 12h.01" /></svg>,
  check: <svg {...s}><path d="M9 4h6M8 4a2 2 0 0 0-2 2v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a2 2 0 0 0-2-2" /><path d="M9 13l2 2 4-4" /></svg>,
  gauge: <svg {...s}><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /></svg>,
  code: <svg {...s}><path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" /></svg>,
}

const PILLARS = [
  { icon: ICONS.wallet, title: 'You hold your tokens', body: 'There are no Xero accounts. Your share and dividend tokens sit in your own wallet, and the shares behind them sit in public vault contracts that only you can withdraw your part from.' },
  { icon: ICONS.scale, title: 'Fully backed, every block', body: 'What a vault owes share-token and dividend-token holders always adds up to the shares it holds. The contracts never lend, stake or move them.' },
  { icon: ICONS.door, title: 'Exits can’t be blocked', body: 'Emergency controls can stop new deposits and trades. They have no power to move funds or stop anyone rejoining, redeeming, claiming or withdrawing liquidity.' },
  { icon: ICONS.check, title: 'Corporate actions, double-checked', body: 'Stock splits must be reported by independent keepers before they count. If a token changes in a way nobody has explained, its vault pauses new deposits instead of guessing.' },
  { icon: ICONS.gauge, title: 'Prices can’t move your money', body: 'Dollar prices are for display only. No trade, payout or redemption depends on a price feed, so a faulty feed can’t cause a bad settlement.' },
  { icon: ICONS.code, title: 'Open source and tested', body: 'Every contract is public. Over 70 automated tests, including fuzzing and invariant tests across thousands of random sequences of deposits, dividends and splits, run on every change.' },
]

export function SecurityPage() {
  return (
    <div className="landing">
      <section className="page-hero">
        <Guilloche size={640} />
        <div className="section-h">
          <span className="eyebrow">Security</span>
          <h1 className="display">Your shares stay yours</h1>
          <p>Xero is built so that nobody, including the Xero team, can take, freeze or lend out what you hold. Here's how, and what risks remain.</p>
        </div>
      </section>

      <section className="section section-tight">
        <div className="pillars">
          {PILLARS.map((p) => (
            <div key={p.title}>
              <span className="pillar-icon">{p.icon}</span>
              <b>{p.title}</b>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="split-copy">
          <div className="section-h">
            <span className="eyebrow">Governance</span>
            <h2>Who can change what</h2>
          </div>
          <div className="fact-list">
            <p><b>Admin changes are slow and public.</b> On mainnet, listing stocks and changing fees requires a multisig Safe and a 48-hour timelock, so every change is visible before it takes effect.</p>
            <p><b>Emergency powers are narrow.</b> A separate guardian can pause new deposits and trades in an emergency. It can't touch funds or block exits.</p>
            <p><b>On the test network,</b> a single test key holds these roles so we can simulate dividends, splits and price moves.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="split-copy">
          <div className="section-h">
            <span className="eyebrow">Be aware</span>
            <h2>What could still go wrong</h2>
          </div>
          <div className="fact-list">
            <p><b>Software risk.</b> The contracts are tested but have not been independently audited. Bugs in Xero, in the tokenized stocks or in the Base network could cause losses.</p>
            <p><b>Issuer risk.</b> A tokenized stock is only as good as its issuer's backing. Xero doesn't change that.</p>
            <p><b>Market risk.</b> Share tokens rise and fall with the stock, and dividend tokens depend on what companies actually pay.</p>
            <p>Read the full <a className="link" href={docsLink('resources/risks')} target="_blank" rel="noreferrer">risk disclosure</a>.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="report card card-pad">
          <div>
            <h3>Found a vulnerability?</h3>
            <p className="sub">Please report it privately through GitHub's security page rather than opening a public issue.</p>
          </div>
          <a className="btn" href={`${REPO_URL}/security`} target="_blank" rel="noreferrer">Report privately</a>
        </div>
      </section>

      <section className="cta-band">
        <div>
          <Guilloche size={620} />
          <div>
            <h2>See it for yourself</h2>
            <p>Every contract, test and deployment script is public.</p>
          </div>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn btn-lg">View the code</a>
        </div>
      </section>
    </div>
  )
}
