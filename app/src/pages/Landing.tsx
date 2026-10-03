import { motion } from 'motion/react'
import { Link } from 'react-router'
import { Mark } from '../components/Brand'
import { MarketIcon, TokenIcon } from '../components/TokenIcon'
import { MarketsTable } from './Markets'
import { compactUsd, date, pct, toNum, usd } from '../lib/format'
import { DOCS_URL } from '../components/Nav'
import { useProtocol, type Asset, type Market } from '../lib/protocol'

export function Landing() {
  const { data } = useProtocol()
  const live = data?.markets.filter((m) => m.live) ?? []
  const featured = live.slice().sort((a, b) => toNum(b.impliedYield) - toNum(a.impliedYield))[0]
  const featuredAsset = featured && data?.assets.find((a) => a.token === featured.token)

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <h1>
            Keep the stock.
            <br />
            <em>Trade the dividends.</em>
          </h1>
          <p className="lede">
            Robinhood Stock Tokens turn every dividend into more shares. Xero splits each token into a <b>Principal Token</b>,
            the shares you hold, and a <b>Yield Token</b>, the shares those dividends will buy, so you can sell, buy or lock
            in either one.
          </p>
          <div className="hero-ctas">
            <Link to="/markets" className="btn btn-primary btn-lg">Launch app</Link>
            <a href={DOCS_URL} target="_blank" rel="noreferrer" className="btn btn-lg">Read the docs</a>
          </div>
        </div>
        <div className="hero-visual">{featured && featuredAsset ? <DecompositionCard asset={featuredAsset} market={featured} /> : <HeroMark />}</div>
      </section>

      <section className="kpis">
        <Kpi label="Total value stripped" value={data ? compactUsd(data.tvlUsd) : '—'} />
        <Kpi label="Market liquidity" value={data ? compactUsd(data.liquidityUsd) : '—'} />
        <Kpi label="Live markets" value={data ? String(live.length) : '—'} />
        <Kpi label="Top implied dividend yield" value={featured ? pct(featured.impliedYield) : '—'} accent />
      </section>

      <section className="section" id="product">
        <header className="section-h">
          <span className="eyebrow">Product</span>
          <h2>One Stock Token. Two returns. Fully backed.</h2>
          <p>
            Robinhood Stock Tokens never pay cash. Dividends are reinvested and show up as a rising{' '}
            <code>uiMultiplier</code>: each token comes to represent more shares. Xero separates that growth from the shares themselves.
          </p>
        </header>
        <div className="steps">
          <Step n="1" title="Deposit a Stock Token" body="Choose a maturity. The vault holds your tokens; nothing is lent out or rehypothecated." icon={<TokenIcon symbol="SCHD" size={40} />} />
          <Step n="2" title="Receive PT + YT" body="PT is your original share count, redeemable at maturity. YT accrues every reinvested dividend until then." icon={<span className="pair"><TokenIcon symbol="PT" kind="pt" size={34} /><TokenIcon symbol="YT" kind="yt" size={34} /></span>} />
          <Step n="3" title="Trade, hold or recombine" body="Sell YT to take dividends upfront, buy YT for income without price risk, or recombine PT + YT into the token any time." icon={<Mark size={40} />} />
        </div>
        <div className="formula">
          <code>PT redemption</code><span>=</span><code>units ÷ I<sub>maturity</sub></code>
          <span className="plus">+</span>
          <code className="y">YT accrual</code><span>=</span><code className="y">units × (1/I<sub>prev</sub> − 1/I<sub>now</sub>)</code>
          <span className="eq">= the Stock Token you deposited, always</span>
        </div>
      </section>

      <section className="section" id="use-cases">
        <header className="section-h">
          <span className="eyebrow">Use cases</span>
          <h2>Take a view on dividends, not just prices.</h2>
        </header>
        <div className="uses">
          <Use tag="Fix" title="Sell your dividends today" body="Keep full exposure to the share price and take a year of expected dividends upfront, in one transaction." />
          <Use tag="Yield" title="Own dividends without price risk" body="YT pays the reinvested dividends of a stock or ETF until maturity, at a fraction of the share price." />
          <Use tag="Curve" title="Trade the dividend curve" body="Markets at 3, 6, 12 and 24 months form an onchain implied dividend term structure, with forwards." />
          <Use tag="Pool" title="Provide liquidity" body="Earn swap fees plus the dividends of the YT your pool holds. Markets are time-aware, so prices decay smoothly to maturity." />
        </div>
      </section>

      {data && live.length > 0 && (
        <section className="section">
          <header className="section-h row-h">
            <div>
              <span className="eyebrow">Markets</span>
              <h2>Live implied dividend yields</h2>
            </div>
            <Link to="/markets" className="btn">All markets →</Link>
          </header>
          <MarketsTable markets={live.slice().sort((a, b) => toNum(b.impliedYield) - toNum(a.impliedYield)).slice(0, 6)} assets={data.assets} now={data.now} compact />
        </section>
      )}

      <section className="section" id="security">
        <header className="section-h">
          <span className="eyebrow">Security</span>
          <h2>Built so the numbers always add up.</h2>
        </header>
        <div className="safety">
          <Safe title="Collateralised by construction" body="PT claims plus YT accruals always equal the deposited tokens. Fuzzed across thousands of random sequences of dividends, splits and transfers." />
          <Safe title="Split-aware accounting" body="Splits move the same multiplier as dividends. A quorum of reporters attests them from Robinhood's corporate-action feed; an unexplained jump freezes accrual instead of paying phantom yield." />
          <Safe title="Exits never pause" body="The guardian can stop new deposits and trading. It can never move funds or block recombination, redemption or claims." />
          <Safe title="Tested against mainnet" body="Fork tests run Xero against the live Robinhood Stock Token contracts, including a real 4:1 split. Governance sits behind a timelock and a Safe." />
        </div>
      </section>

      <section className="cta">
        <Mark size={56} />
        <h2>Separate the stock from its dividends.</h2>
        <Link to="/markets" className="btn btn-primary btn-lg">Explore markets</Link>
      </section>
    </div>
  )
}

function DecompositionCard({ asset, market }: { asset: Asset; market: Market }) {
  const px = toNum(asset.priceUsd)
  const ptUsd = toNum(market.ptPrice) * px
  const ytUsd = toNum(market.ytPrice) * px
  const total = ptUsd + ytUsd
  return (
    <motion.div className="decomp" initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.6 }}>
      <div className="decomp-head">
        <MarketIcon symbol={asset.symbol} />
        <div>
          <b>{asset.symbol} · {market.label}</b>
          <span>{asset.name} · matures {date(market.maturity)}</span>
        </div>
      </div>
      <div className="decomp-bar" aria-label="Value split">
        <motion.div className="bar-pt" initial={{ width: '100%' }} animate={{ width: `${(ptUsd / total) * 100}%` }} transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }} />
        <motion.div className="bar-yt" initial={{ width: 0 }} animate={{ width: `${Math.max(3, (ytUsd / total) * 100)}%` }} transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }} />
      </div>
      <div className="decomp-rows">
        <div>
          <span><TokenIcon symbol="PT" kind="pt" size={20} /> Principal</span>
          <b>{usd(ptUsd)}</b>
        </div>
        <div className="y">
          <span><TokenIcon symbol="YT" kind="yt" size={20} /> Yield</span>
          <b>{usd(ytUsd)}</b>
        </div>
        <div className="decomp-total">
          <span>1 {asset.symbol} unit</span>
          <b>{usd(total)}</b>
        </div>
      </div>
      <div className="decomp-foot">
        <span>Implied dividend yield</span>
        <b className="amber">{pct(market.impliedYield)}</b>
      </div>
      <Link to={`/markets/${asset.symbol}?m=${market.label}`} className="btn btn-primary btn-block">Trade {asset.symbol} yield</Link>
    </motion.div>
  )
}

function HeroMark() {
  return (
    <motion.div className="hero-mark" initial={{ rotate: -8 }} animate={{ rotate: 0 }} transition={{ duration: 0.8 }}>
      <Mark size={260} />
    </motion.div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <b className={accent ? 'amber' : undefined}>{value}</b>
    </div>
  )
}

function Step({ n, title, body, icon }: { n: string; title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="step">
      <div className="step-icon">{icon}</div>
      <span className="step-n">{n}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}

function Use({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div className="use">
      <span className="tag">{tag}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}

function Safe({ title, body }: { title: string; body: string }) {
  return (
    <div className="safe">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l6 2.5v5c0 4-2.7 6.8-6 8.5-3.3-1.7-6-4.5-6-8.5v-5L10 2z" fill="none" stroke="var(--amber)" strokeWidth="1.6" /><path d="M7 10l2 2 4-4" fill="none" stroke="var(--amber)" strokeWidth="1.6" /></svg>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}
