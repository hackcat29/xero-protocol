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
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <div className="badge-chain-row">
            <span className="base-tag">BUILT ON BASE</span>
            <span className="b20-standard-tag">Coinbase B20 Tokenized Equities</span>
          </div>
          <h1>
            Deconstruct the stock.
            <br />
            <em>Trade the dividends.</em>
          </h1>
          <p className="lede">
            Coinbase B20 tokenized stocks wrap dividend compounding directly into an escalating <code>uiMultiplier</code>.
            Xero deconstructs each token into a <b>Principal Token (PT)</b> for discounted stock ownership and a{' '}
            <b>Yield Token (YT)</b> for high-leverage dividend cash flow on Base.
          </p>
          <div className="hero-ctas">
            <Link to="/markets" className="btn btn-primary btn-lg">Launch App</Link>
            <Link to="/strip" className="btn btn-lg">Strip Vault</Link>
            <Link to="/architecture" className="btn btn-lg btn-ghost">Architecture</Link>
          </div>
        </div>
        <div className="hero-visual">
          {featured && featuredAsset ? (
            <DecompositionCard asset={featuredAsset} market={featured} />
          ) : (
            <HeroMark />
          )}
        </div>
      </section>

      {/* KPI Stats */}
      <section className="kpis">
        <Kpi label="Total value stripped" value={data ? compactUsd(data.tvlUsd) : '—'} />
        <Kpi label="Base pool liquidity" value={data ? compactUsd(data.liquidityUsd) : '—'} />
        <Kpi label="B20 equities live" value={data ? String(data.assets.length) : '6'} />
        <Kpi label="Top dividend leverage" value={featured ? `${featured.ytLeverage.toFixed(0)}x` : '85x'} accent />
      </section>

      {/* Section 1: The B20 Multiplier Deconstruction */}
      <section className="section" id="product">
        <header className="section-h">
          <span className="eyebrow">Architecture</span>
          <h2>Deconstructing the B20 Multiplier (M<sub>t</sub>)</h2>
          <p>
            Standard Pendle ERC-5115 Yield-Bearing Tokens assume recurring ERC-20 transfers.
            Coinbase B20 tokenized equities instead escalate a continuous multiplier. Xero isolates that growth into pure financial primitives.
          </p>
        </header>

        <div className="steps">
          <Step
            n="1"
            title="Deposit B20 Stock Token"
            body="Choose NVDAc, AAPLc, COINc, TSLAc, SPYc, or SCHDc. The vault locks the token securely on Base without rehypothecation."
            icon={<TokenIcon symbol="NVDAc" size={40} />}
          />
          <Step
            n="2"
            title="Mint PT + YT Units"
            body="PT captures baseline share capital at maturity. YT entitles holders to continuous multiplier growth (ΔM) via the streaming delta index."
            icon={
              <span className="pair">
                <TokenIcon symbol="PT" kind="pt" size={34} />
                <TokenIcon symbol="YT" kind="yt" size={34} />
              </span>
            }
          />
          <Step
            n="3"
            title="Trade, Lock, or Speculate"
            body="Sell YT upfront for guaranteed fixed APY, buy PT at a deep discount to spot price, or trade YT for up to 120x dividend cash flow leverage."
            icon={<Mark size={40} />}
          />
        </div>

        <div className="formula">
          <code>PT Redemption Baseline</code>
          <span>=</span>
          <code>{'Units ÷ I_maturity'}</code>
          <span className="plus">+</span>
          <code className="y">Streaming Yield (ΔM)</code>
          <span>=</span>
          <code className="y">{'Units × (M_current / M_last − 1)'}</code>
          <span className="eq">= Full Underlying B20 Stock</span>
        </div>
      </section>

      {/* Section 2: Three Core Financial Primitives */}
      <section className="section" id="pillars">
        <header className="section-h">
          <span className="eyebrow">Financial Primitives</span>
          <h2>Three Powerful Ways to Trade Equities on Base</h2>
        </header>
        <div className="uses">
          <Use
            tag="Primitive 1"
            title="Fixed Yield Sourcing"
            body="Strip your B20 stock and sell the Yield Token (YT) upfront on our AMM. Lock in a guaranteed fixed annual APY today with zero dividend volatility."
            link="/strip"
          />
          <Use
            tag="Primitive 2"
            title="Discounted Stock Buying"
            body="Buy Principal Tokens (PT) at an upfront discount to spot price (e.g. NVDAc at 8.4% off). Hold to maturity and redeem 1:1 for the full underlying share."
            link="/discount"
          />
          <Use
            tag="Primitive 3"
            title="Leveraged Dividend Speculation"
            body="Buy cheap YT tokens for 50x–120x cash flow leverage on dividend hikes, unexpected corporate payout increases, and special distributions."
            link="/speculate"
          />
          <Use
            tag="Core Defense"
            title="Stock Split Immunity"
            body="Corporate forward splits (2:1, 4:1) scale the structural factor S simultaneously, ensuring the Dividend Index I = M/S remains invariant (ΔI = 0)."
            link="/architecture"
          />
        </div>
      </section>

      {/* Section 3: Live Markets Table Preview */}
      {data && live.length > 0 && (
        <section className="section">
          <header className="section-h row-h">
            <div>
              <span className="eyebrow">Live on Base</span>
              <h2>B20 Tokenized Equities Markets</h2>
            </div>
            <Link to="/markets" className="btn">All Markets →</Link>
          </header>
          <MarketsTable
            markets={live.slice().sort((a, b) => toNum(b.impliedYield) - toNum(a.impliedYield)).slice(0, 6)}
            assets={data.assets}
            now={data.now}
            compact
          />
        </section>
      )}

      {/* Section 4: Security & Verifiability */}
      <section className="section" id="security">
        <header className="section-h">
          <span className="eyebrow">Security</span>
          <h2>Formal Invariant Guarantees & Base Scalability</h2>
        </header>
        <div className="safety">
          <Safe
            title="Solvency by Mathematical Construction"
            body="PT redemption claims plus YT streaming payouts mathematically equal deposited B20 collateral at every block. Fuzzed across thousands of random corporate action sequences."
          />
          <Safe
            title="Attested Split Invariance"
            body="Forward stock splits scale both the multiplier and structural factor S in tandem. Dividend index I = M/S remains unchanged, preventing vault insolvency."
          />
          <Safe
            title="Non-Custodial Redemption"
            body="Emergency pauses can halt new deposits but can never freeze token recombination, maturity redemption, or already-accrued yield withdrawals."
          />
          <Safe
            title="Low Latency, Low Fee Execution"
            body="Deployed on Base (OP Stack L2) with sub-second finality and sub-cent gas fees, enabling frequent dividend delta claims and high-frequency AMM arbitrage."
          />
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="cta">
        <Mark size={56} />
        <h2>Experience the Future of RWA Fixed Income on Base</h2>
        <div className="hero-ctas">
          <Link to="/markets" className="btn btn-primary btn-lg">Explore B20 Markets</Link>
          <Link to="/architecture" className="btn btn-lg">Read Technical Specs</Link>
        </div>
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
          <b>{asset.symbol} · {market.label} Tenor</b>
          <span>{asset.name} · Matures {date(market.maturity)}</span>
        </div>
        <span className="base-tag">BASE</span>
      </div>

      <div className="decomp-bar" aria-label="Value split">
        <motion.div
          className="bar-pt"
          initial={{ width: '100%' }}
          animate={{ width: `${(ptUsd / total) * 100}%` }}
          transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="bar-yt"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(4, (ytUsd / total) * 100)}%` }}
          transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="decomp-rows">
        <div>
          <span><TokenIcon symbol="PT" kind="pt" size={20} /> Principal Token</span>
          <b>{usd(ptUsd)}</b>
          <small className="up">−{market.ptDiscountPct.toFixed(1)}% Discount</small>
        </div>
        <div className="y">
          <span><TokenIcon symbol="YT" kind="yt" size={20} /> Yield Token</span>
          <b>{usd(ytUsd)}</b>
          <small className="amber">{market.ytLeverage.toFixed(0)}x Leverage</small>
        </div>
        <div className="decomp-total">
          <span>1 B20 Unit</span>
          <b>{usd(total)}</b>
          <small>Multiplier: {toNum(asset.multiplier).toFixed(4)}x</small>
        </div>
      </div>

      <div className="decomp-foot">
        <div>
          <span>Implied Dividend APY</span>
          <b className="amber">{pct(market.impliedYield)}</b>
        </div>
        <div>
          <span>PT Fixed Return</span>
          <b className="up">{market.ptFixedYield.toFixed(2)}%</b>
        </div>
      </div>

      <div className="decomp-cta-row">
        <Link to={`/markets/${asset.symbol}?m=${market.label}`} className="btn btn-primary btn-block">
          Trade {asset.symbol} Primitives
        </Link>
      </div>
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

function Use({ tag, title, body, link }: { tag: string; title: string; body: string; link: string }) {
  return (
    <Link to={link} className="use card-link-use">
      <span className="tag">{tag}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <span className="use-cta-link">Explore →</span>
    </Link>
  )
}

function Safe({ title, body }: { title: string; body: string }) {
  return (
    <div className="safe">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 2l6 2.5v5c0 4-2.7 6.8-6 8.5-3.3-1.7-6-4.5-6-8.5v-5L10 2z" fill="none" stroke="var(--base-blue, #0052FF)" strokeWidth="1.6" />
        <path d="M7 10l2 2 4-4" fill="none" stroke="var(--base-blue, #0052FF)" strokeWidth="1.6" />
      </svg>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}
