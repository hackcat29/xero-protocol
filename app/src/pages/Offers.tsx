import { Link, useSearchParams } from 'react-router'
import { StockMark } from '../components/Brand'
import { Skeleton } from '../components/Info'
import { DiscountForm, SlippagePicker, UpfrontForm, useSlippage } from '../components/TradeTicket'
import { company, term, ticker } from '../lib/assets'
import { date, pct, usd } from '../lib/format'
import { useProtocol, type Asset, type Market } from '../lib/protocol'

type Mode = 'discount' | 'upfront'

const COPY = {
  discount: {
    title: 'Buy stocks at a discount',
    sub: "Pay less than today's price for a share delivered on a date you choose. The longer you wait, the bigger the discount.",
    ticket: (t: string) => `Buy ${t} at a discount`,
    explainTitle: 'Where the discount comes from',
    explain: [
      'A share is worth its price because of two things: owning it, and the dividends it pays along the way. Xero lets people trade those separately.',
      "When you buy at a discount, you buy the share without the dividends it pays until your chosen date. Someone else has taken those dividends upfront, so you pay less. On the date, you receive the full share, and from then on its dividends are yours too.",
      "Your discount is fixed when you buy. You still gain or lose with the share price, just as if you'd bought the share today.",
    ],
  },
  upfront: {
    title: 'Get your dividends upfront',
    sub: "Turn the dividends your shares will pay into money today. Your shares come back to you on the date you choose.",
    ticket: (t: string) => `${t} dividends, paid today`,
    explainTitle: 'What you give up, and what you keep',
    explain: [
      "You sell the dividends your shares would pay until a date you choose, at today's market price, and get paid right away in shares of the same stock.",
      'Your shares stay locked in the Xero vault until that date, then come back to you in full. You keep all of the price movement in the meantime, up or down.',
      "If the company raises its dividend, the buyer keeps the extra. If it cuts it, you've already been paid. Either way, there's no loan, no interest and nothing to liquidate.",
    ],
  },
} as const

export function DiscountPage() {
  return <Offers mode="discount" />
}
export function UpfrontPage() {
  return <Offers mode="upfront" />
}

function Offers({ mode }: { mode: Mode }) {
  const { data, isLoading } = useProtocol()
  const [params, setParams] = useSearchParams()
  const [slip, setSlip] = useSlippage()
  const c = COPY[mode]

  const assets = data?.assets ?? []
  const asset = assets.find((a) => a.symbol === params.get('s')) ?? assets.find((a) => a.symbol === 'SCHDc') ?? assets[0]
  const live = asset?.markets.filter((m) => m.live) ?? []
  const market = live.find((m) => m.label === params.get('m')) ?? live.find((m) => m.label === '1Y') ?? live[live.length - 1]
  const choose = (s: string, m = market?.label) => setParams(m ? { s, m } : { s }, { replace: true })

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <h1>{c.title}</h1>
          <p className="sub">{c.sub}</p>
        </div>
      </header>

      {isLoading || !data ? (
        <div className="workspace">
          <Skeleton h={420} />
          <Skeleton h={520} />
        </div>
      ) : (
        <div className="workspace">
          <div className="offers" role="radiogroup" aria-label="Stock">
            {assets.map((a) => (
              <OfferCard key={a.token} asset={a} label={market?.label} mode={mode} on={a.token === asset?.token} onPick={() => choose(a.symbol)} />
            ))}
          </div>
          <section className="card explain">
            <h3>{c.explainTitle}</h3>
            {c.explain.map((p) => <p key={p}>{p}</p>)}
            <p>
              <Link className="link" to={asset ? `/markets/${asset.symbol}?m=${market?.label ?? ''}` : '/markets'}>
                See the full {asset ? ticker(asset.symbol) : ''} market →
              </Link>
            </p>
          </section>

          <aside>
            {asset && market ? (
              <section className="card ticket">
                <div className="ticket-head">
                  <div className="stock">
                    <StockMark symbol={asset.symbol} size={40} />
                    <div>
                      <h2>{c.ticket(ticker(asset.symbol))}</h2>
                      <small className="muted">{company(asset.symbol)} · {usd(asset.sharePriceUsd)} a share today</small>
                    </div>
                  </div>
                </div>
                <div className="stack">
                  <div>
                    <div className="field-label" style={{ marginBottom: 8 }}>{mode === 'discount' ? 'Receive your shares on' : 'Get your shares back on'}</div>
                    <div className={`terms ${mode === 'upfront' ? 'is-gold' : ''}`} role="radiogroup" aria-label="Maturity">
                      {live.map((m) => (
                        <button key={m.vault} role="radio" aria-checked={m.vault === market.vault} className={m.vault === market.vault ? 'on' : ''} onClick={() => choose(asset.symbol, m.label)} title={date(m.maturity)}>
                          <b>{m.label === '1W' ? '1 wk' : m.label === '3M' ? '3 mo' : m.label === '6M' ? '6 mo' : '1 yr'}</b>
                          <span>{mode === 'discount' ? `${m.ptDiscountPct.toFixed(1)}% off` : usd(m.ytUsd * 100, 0)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {mode === 'discount' ? <DiscountForm key={market.vault} asset={asset} market={market} slip={slip} /> : <UpfrontForm key={market.vault} asset={asset} market={market} slip={slip} />}
                </div>
                <SlippagePicker slip={slip} setSlip={setSlip} />
              </section>
            ) : (
              <div className="card empty-state"><h3>No open markets for this stock</h3></div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function OfferCard({ asset, label, mode, on, onPick }: { asset: Asset; label?: string; mode: Mode; on: boolean; onPick: () => void }) {
  const m: Market | undefined = asset.markets.find((x) => x.live && x.label === label) ?? asset.markets.find((x) => x.live)
  return (
    <button className={`offer ${mode === 'upfront' ? 'is-gold' : ''} ${on ? 'on' : ''}`} role="radio" aria-checked={on} onClick={onPick}>
      <div className="offer-h">
        <StockMark symbol={asset.symbol} size={40} />
        <div>
          <b>{ticker(asset.symbol)}</b>
          <span>{company(asset.symbol)}</span>
        </div>
      </div>
      {m ? (
        mode === 'discount' ? (
          <div className="offer-figs">
            <div><small>Price today</small><strong>{usd(m.unitUsd)}</strong></div>
            <div><small>Your price, {term(m.label)}</small><strong className="up">{usd(m.ptUsd)}</strong></div>
            <div className="key"><small>Discount</small><strong className="up">{m.ptDiscountPct.toFixed(2)}%</strong></div>
            <div><small>Return / yr</small><strong>{pct(m.ptFixedYield / 100)}</strong></div>
          </div>
        ) : (
          <div className="offer-figs">
            <div className="key"><small>Per 100 shares, {term(m.label)}</small><strong className="gold">{usd(m.ytUsd * 100)}</strong></div>
            <div><small>Of your position</small><strong>{m.ptDiscountPct.toFixed(2)}%</strong></div>
            <div><small>Shares back on</small><strong style={{ fontSize: 15 }}>{date(m.maturity)}</strong></div>
            <div><small>Share price</small><strong style={{ fontSize: 15 }}>{usd(m.unitUsd)}</strong></div>
          </div>
        )
      ) : (
        <span className="muted">No open maturities</span>
      )}
    </button>
  )
}
