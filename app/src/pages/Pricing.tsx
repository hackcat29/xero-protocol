import { Link } from 'react-router'
import { Guilloche } from '../components/Brand'
import { docsLink } from '../components/Nav'
import { usd } from '../lib/format'
import { FLAGSHIP, ticker } from '../lib/assets'
import { useProtocol } from '../lib/protocol'

const SPLIT = 0.0005
const POOL = 0.003
const DIVIDEND = 0.03

export function PricingPage() {
  const { data } = useProtocol()
  const ex = data?.markets.find((m) => m.live && m.symbol === FLAGSHIP && m.label === '1Y')
  const d = ex ? ex.ptDiscountPct / 100 : 0.007
  const name = ticker(FLAGSHIP)
  const order = 10_000

  // Buying at a discount splits about order / (1 − d) of shares and sells the dividend part of them;
  // taking dividends upfront splits the order and sells its dividend part.
  const discountFees = SPLIT * (order / (1 - d)) + POOL * ((order * d) / (1 - d))
  const upfrontFees = SPLIT * order + POOL * order * d
  const dividendFees = POOL * 1_000

  return (
    <div className="landing">
      <section className="page-hero">
        <Guilloche size={640} />
        <div className="section-h">
          <span className="eyebrow">Pricing</span>
          <h1 className="display">Simple, transparent fees</h1>
          <p>No account fees, no subscription and no markup hidden in the price. You pay a small fee only when you use Xero, and every fee has a ceiling written into the code.</p>
        </div>
      </section>

      <section className="section section-tight">
        <div className="fee-grid">
          <Fee figure="0.05%" title="To split a share" body="When shares go into Xero: buying at a discount or taking dividends upfront." />
          <Fee figure="0.3%" title="Per dividend trade" body="Paid in full to the people providing liquidity. Xero keeps none of it." />
          <Fee figure="3%" title="Of dividends collected" body="Only from dividend-token holders. Discount buyers and upfront sellers never pay it." />
          <Fee figure="Free" title="To redeem or rejoin" body="Getting your shares back costs nothing beyond the network fee." />
        </div>
      </section>

      <section className="section">
        <div className="section-h">
          <span className="eyebrow">In practice</span>
          <h2>What a typical order costs</h2>
          <p>Estimates at today's 1-year {name} price, with a {(d * 100).toFixed(2)}% discount. The app shows the exact amount before you confirm.</p>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Order</th><th className="r">Xero fees</th><th className="r">Share of order</th></tr>
              </thead>
              <tbody>
                <Row order={`Buy ${usd(order, 0)} of ${name} at a discount`} fee={discountFees} base={order} />
                <Row order={`Take dividends upfront on ${usd(order, 0)} of ${name}`} fee={upfrontFees} base={order} />
                <Row order={`Buy ${usd(1_000, 0)} of ${name} dividend tokens`} fee={dividendFees} base={1_000} note={`plus ${DIVIDEND * 100}% of the dividends they collect`} />
                <tr><td><b>Redeem your shares at maturity</b></td><td className="r"><b>$0.00</b></td><td className="r">0%</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          Base network fees are usually under one cent per transaction. Large orders also move the market price; the app shows the price impact and lets you cap it.
        </p>
      </section>

      <section className="section">
        <div className="split-copy">
          <div className="section-h">
            <span className="eyebrow">Limits</span>
            <h2>Fees can't creep up</h2>
          </div>
          <div className="fact-list">
            <p><b>Hard ceilings in the contracts.</b> The split and redemption fees can never exceed 1%, the dividend fee can never exceed 10%, and each market's trading fee is fixed when the market is created, at no more than 1%.</p>
            <p><b>Changes in public.</b> On mainnet, fee changes go through a multisig and a 48-hour public timelock, so anyone can see them coming.</p>
            <p><b>Where fees go.</b> Trading fees go to liquidity providers. Split and dividend fees go to the Xero treasury. See the <a className="link" href={docsLink('resources/fees')} target="_blank" rel="noreferrer">full fee schedule</a>.</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div>
          <Guilloche size={620} />
          <div>
            <h2>Try it free on the test network</h2>
            <p>Test tokens cost nothing, so you can see every fee in action before mainnet.</p>
          </div>
          <Link to="/discount" className="btn btn-lg">Open the app</Link>
        </div>
      </section>
    </div>
  )
}

function Fee({ figure, title, body }: { figure: string; title: string; body: string }) {
  return (
    <div className="fee">
      <strong>{figure}</strong>
      <b>{title}</b>
      <p>{body}</p>
    </div>
  )
}

function Row({ order, fee, base, note }: { order: string; fee: number; base: number; note?: string }) {
  return (
    <tr>
      <td><b>{order}</b>{note && <small>{note}</small>}</td>
      <td className="r"><b>≈ {usd(fee)}</b></td>
      <td className="r">{((fee / base) * 100).toFixed(3)}%</td>
    </tr>
  )
}
