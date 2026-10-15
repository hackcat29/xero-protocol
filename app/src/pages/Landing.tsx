import { useState } from 'react'
import { Link } from 'react-router'
import { Guilloche, StockMark } from '../components/Brand'
import { DOCS_URL } from '../components/Nav'
import { MarketsTable } from './Markets'
import { FEATURED, FLAGSHIP, company, term, ticker } from '../lib/assets'
import { date, pct, usd } from '../lib/format'
import { useProtocol, type Asset, type Market } from '../lib/protocol'


/** The 1-year market for a stock: the longest maturity, so the clearest example of each benefit. */
const yearMarket = (a: Asset) => a.markets.find((m) => m.live && m.label === '1Y') ?? a.markets.filter((m) => m.live).at(-1)

export function Landing() {
  const { data } = useProtocol()
  const assets = (data?.assets ?? []).filter((a) => FEATURED.includes(a.symbol)).sort((a, b) => FEATURED.indexOf(a.symbol) - FEATURED.indexOf(b.symbol))
  const flagship = data?.assets.find((a) => a.symbol === FLAGSHIP)
  const flagYear = flagship && yearMarket(flagship)
  const live = data?.markets.filter((m) => m.live) ?? []
  const best = live.reduce<Market | undefined>((b, m) => (!b || m.ptDiscountPct > b.ptDiscountPct ? m : b), undefined)
  const bestUpfront = live.reduce<Market | undefined>((b, m) => (!b || m.ytUsd > b.ytUsd ? m : b), undefined)

  return (
    <div className="landing">
      <section className="hero">
        <Guilloche size={760} />
        <div className="hero-inner">
          <div>
            <span className="eyebrow">The first dividend-splitting platform for tokenized stocks</span>
            <h1 className="display" style={{ marginTop: 16 }}>
              Stocks at a discount.
              <br />
              Dividends in advance.
            </h1>
            <p className="lede">
              Xero splits a tokenized share into two parts you can trade on their own: the share, and the dividends it will pay. Investors buy
              shares for less than today's price. Shareholders take next year's dividends today and keep their stock.
            </p>
            <div className="hero-ctas">
              <Link to="/discount" className="btn btn-primary btn-lg">Buy at a discount</Link>
              <Link to="/upfront" className="btn btn-lg">Get dividends upfront</Link>
            </div>
            <p className="hero-note">No account and no borrowing. Your wallet holds everything.</p>
          </div>
          <QuoteCard assets={assets} />
        </div>
      </section>

      <section className="proof" aria-label="Today on Xero">
        <div className="proof-inner">
          <div><span>Best discount today</span><b>{best ? `${best.ptDiscountPct.toFixed(2)}%` : '—'}</b></div>
          <div><span>Paid upfront today on 100 {bestUpfront ? ticker(bestUpfront.symbol) : 'shares'}</span><b>{bestUpfront ? usd(bestUpfront.ytUsd * 100) : '—'}</b></div>
          <div><span>Stocks on Base</span><b>{data ? data.assets.length : '—'}</b></div>
          <div><span>Maturities</span><b>1 week to 1 year</b></div>
        </div>
      </section>

      {/* Benefit 1 */}
      <section className="section" id="discount">
        <div className="benefit">
          <div className="benefit-copy">
            <span className="eyebrow">Buy at a discount</span>
            <h2>Own great companies for less than the market price</h2>
            <p>
              Pick a stock and a date. You pay less than today's price, and on that date the full share is yours. The discount is what the dividends
              until then are worth: someone else has already been paid for them.
            </p>
            <ul className="benefit-points">
              <Point title="Know your discount on day one" body="Your price is locked when you buy. Hold to the date and the discount is yours." />
              <Point title="The real share at the end" body="On the date, you redeem for the full share, and its dividends are yours from then on." />
              <Point title="Made for long-term investors" body="If you don't need dividend income this year, why pay for it?" />
            </ul>
            <Link to="/discount" className="btn btn-primary">See today's discounts</Link>
          </div>
          {flagship && flagYear ? <DiscountExample asset={flagship} market={flagYear} /> : <ExampleSkeleton />}
        </div>
      </section>

      {/* Benefit 2 */}
      <section className="section" id="upfront">
        <div className="benefit flip benefit-gold">
          <div className="benefit-copy">
            <span className="eyebrow">Dividends upfront</span>
            <h2>Get next year's dividends today. Keep your shares.</h2>
            <p>
              If you already own a dividend stock, you can sell the dividends it will pay until a date you choose and get paid now. Your shares come
              back to you in full on that date.
            </p>
            <ul className="benefit-points">
              <Point title="Money now, not in quarterly drips" body="A full year of expected dividends, paid upfront to your wallet." />
              <Point title="Keep the upside" body="You still own the price movement of every share, up or down." />
              <Point title="No loan, no liquidation" body="Nothing to repay and no margin calls. If the dividend is cut, you've already been paid." />
            </ul>
            <Link to="/upfront" className="btn btn-gold">See what your shares pay</Link>
          </div>
          {flagship && flagYear ? <UpfrontExample asset={flagship} market={flagYear} /> : <ExampleSkeleton />}
        </div>
      </section>

      {/* How the split works */}
      <section className="section" id="split">
        <div className="anatomy">
          <div className="section-h" style={{ marginBottom: 0 }}>
            <span className="eyebrow">One share, two parts</span>
            <h2>Why the share and its dividends can be priced apart</h2>
            <p>
              A share's price already includes the dividends people expect it to pay. Xero holds the share and issues two tokens against it: one that
              becomes the share on a set date, and one that collects every dividend until then. Together they are always worth exactly one share,
              and anyone holding both can rejoin them into the share before that date.
            </p>
          </div>
          {flagship && flagYear ? <Anatomy asset={flagship} market={flagYear} /> : <ExampleSkeleton />}
        </div>
        <div className="also">
          <Link to="/markets">
            <b>Trade the dividends themselves</b>
            <span>Think a company will raise its payout? Buy its dividend stream for a fraction of the share price.</span>
          </Link>
          <Link to="/markets">
            <b>Earn from providing liquidity</b>
            <span>Pool providers earn trading fees plus the dividends held in the pool.</span>
          </Link>
        </div>
      </section>

      {/* Live markets */}
      {data && live.length > 0 && (
        <section className="section">
          <div className="section-h section-row">
            <div>
              <span className="eyebrow">Live prices</span>
              <h2>Today's best discounts</h2>
            </div>
            <Link to="/markets" className="btn">All markets</Link>
          </div>
          <MarketsTable markets={live.slice().sort((a, b) => b.ptDiscountPct - a.ptDiscountPct).slice(0, 6)} assets={data.assets} compact />
        </section>
      )}

      {/* Safety */}
      <section className="section" id="safety">
        <div className="section-h">
          <span className="eyebrow">Security</span>
          <h2>Built to be boring with your money</h2>
          <p>The rules are written into public smart contracts on Base. Nobody at Xero can move, freeze or lend out your shares.</p>
          <Link to="/security" className="link section-link">How we keep your shares safe →</Link>
        </div>
        <div className="safety">
          <Safe title="Fully backed" body="Every share token and dividend token is backed by real tokenized shares held in the vault, one for one." />
          <Safe title="You can always leave" body="Emergency pauses can stop new deposits, but never stop you redeeming, rejoining or claiming." />
          <Safe title="Splits handled for you" body="Stock splits are reported and applied automatically, so your position keeps its value." />
          <Safe title="Open source and tested" body="Every contract is public on GitHub and tested against thousands of random scenarios." />
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="faq">
          <div className="section-h">
            <span className="eyebrow">Questions</span>
            <h2>Good to know</h2>
            <p>Still curious? The <a className="link" href={DOCS_URL} target="_blank" rel="noreferrer">docs</a> go deeper.</p>
          </div>
          <div className="faq-list">
            <Faq q="What is a tokenized stock?">
              A token on a blockchain that tracks one share of a real company, like Apple or Microsoft. On Base, Coinbase issues them as B20 tokens and dividends are reinvested into the
              token automatically, so each token slowly grows into more than one share.
            </Faq>
            <Faq q="Where does the discount come from?">
              From the dividends. When you buy at a discount, you buy the share without its dividends until your chosen date. The person who sold
              those dividends upfront was paid for them, which is why your price is lower.
            </Faq>
            <Faq q="What happens on the maturity date?">
              Discount buyers redeem for their shares. Shareholders who took dividends upfront redeem for the shares they deposited. Dividend-token
              holders keep everything they've collected.
            </Faq>
            <Faq q="What if the company cuts or raises its dividend?">
              Discount buyers and upfront sellers are unaffected: their numbers were fixed on day one. Whoever holds the dividend tokens gains if
              dividends rise and loses if they fall.
            </Faq>
            <Faq q="Can I sell before the date?">
              You can rejoin a share token with a dividend token at any time to get the share back. A market for selling share tokens on their own
              is coming; until then, plan to hold to the date.
            </Faq>
            <Faq q="What does it cost?">
              Splitting a share costs 0.05%. Trades pay a 0.3% pool fee to liquidity providers. Xero keeps 3% of the dividends collected by dividend
              tokens. Base network fees are usually under a cent.
            </Faq>
            <Faq q="Is my money at risk?">
              Yes. Share prices move, smart contracts can have bugs, and dividends are never guaranteed. Xero currently runs on Base Sepolia, a test
              network, using test tokens with no real value.
            </Faq>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div>
          <Guilloche size={620} />
          <div>
            <h2>Try Xero with free test tokens</h2>
            <p>Claim test versions of the stocks on Base, then buy at a discount or take dividends upfront. It takes about a minute.</p>
          </div>
          <Link to="/discount" className="btn btn-lg">Open the app</Link>
        </div>
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ hero quote

function QuoteCard({ assets }: { assets: Asset[] }) {
  const [mode, setMode] = useState<'discount' | 'upfront'>('discount')
  const [sym, setSym] = useState(FLAGSHIP)
  const asset = assets.find((a) => a.symbol === sym) ?? assets[0]
  const m = asset && yearMarket(asset)

  return (
    <div className="quote" aria-live="polite">
      <div className="quote-tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'discount'} className={mode === 'discount' ? 'on' : ''} onClick={() => setMode('discount')}>Buy at a discount</button>
        <button role="tab" aria-selected={mode === 'upfront'} className={`gold-tab ${mode === 'upfront' ? 'on' : ''}`} onClick={() => setMode('upfront')}>Dividends upfront</button>
      </div>
      <div className="quote-body">
        <div className="quote-stocks" role="radiogroup" aria-label="Stock">
          {assets.map((a) => (
            <button key={a.symbol} role="radio" aria-checked={a.symbol === asset?.symbol} className={a.symbol === asset?.symbol ? 'on' : ''} onClick={() => setSym(a.symbol)}>
              {ticker(a.symbol)}
            </button>
          ))}
        </div>
        {asset && m ? (
          <>
            <div className="quote-company">
              <StockMark symbol={asset.symbol} size={40} />
              <div>
                <b>{company(asset.symbol)}</b>
                <span>{ticker(asset.symbol)} · {term(m.label)}, until {date(m.maturity)}</span>
              </div>
            </div>
            {mode === 'discount' ? (
              <>
                <div className="quote-prices">
                  <div><small>Market price</small><span className="was">{usd(m.unitUsd)}</span></div>
                  <span className="arrow" aria-hidden="true">→</span>
                  <div><small>Your price</small><span className="now">{usd(m.ptUsd)}</span></div>
                </div>
                <div className="quote-facts">
                  <div><span>You save</span><b className="up">{m.ptDiscountPct.toFixed(2)}%</b></div>
                  <div><span>You receive</span><b>1 share on {date(m.maturity)}</b></div>
                  <div><span>Return if the price holds</span><b>{pct(m.ptFixedYield / 100)} a year</b></div>
                </div>
                <Link to={`/discount?s=${asset.symbol}&m=${m.label}`} className="btn btn-primary btn-block btn-lg">Buy {ticker(asset.symbol)} at {usd(m.ptUsd)}</Link>
              </>
            ) : (
              <>
                <div className="quote-paid">
                  <small>Paid today for 100 shares</small>
                  <strong>{usd(m.ytUsd * 100)}</strong>
                </div>
                <div className="quote-facts">
                  <div><span>For their dividends until</span><b>{date(m.maturity)}</b></div>
                  <div><span>Your shares back on</span><b>{date(m.maturity)}</b></div>
                  <div><span>Upfront, as a share of your position</span><b className="gold">{m.ptDiscountPct.toFixed(2)}%</b></div>
                </div>
                <Link to={`/upfront?s=${asset.symbol}&m=${m.label}`} className="btn btn-gold btn-block btn-lg">Get {ticker(asset.symbol)} dividends now</Link>
              </>
            )}
          </>
        ) : (
          <ExampleSkeleton />
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ worked examples (live numbers)

function DiscountExample({ asset, market: m }: { asset: Asset; market: Market }) {
  const n = 10
  return (
    <div className="example">
      <div className="example-h"><b>Example: {n} shares of {ticker(asset.symbol)}</b><span className="tag">Live price</span></div>
      <Step n="1" title="Today, you pay" sub={`${n} × ${usd(m.ptUsd)} instead of ${usd(m.unitUsd)}`} v={usd(m.ptUsd * n)} />
      <Step n="2" title="Until the date" sub="You hold a token that becomes your shares" v="—" />
      <Step n="3" title={`On ${date(m.maturity)}, you own`} sub={`Worth ${usd(m.unitUsd * n)} at today's price`} v={`${n} shares`} />
      <div className="example-foot">You saved <b className="up">{usd((m.unitUsd - m.ptUsd) * n)}</b> versus buying today, a {pct(m.ptFixedYield / 100)} yearly return if the price holds.</div>
    </div>
  )
}

function UpfrontExample({ asset, market: m }: { asset: Asset; market: Market }) {
  const n = 100
  return (
    <div className="example">
      <div className="example-h"><b>Example: you own {n} {ticker(asset.symbol)}</b><span className="tag">Live price</span></div>
      <Step n="1" title="Today, you're paid" sub={`For their dividends until ${date(m.maturity)}`} v={usd(m.ytUsd * n)} />
      <Step n="2" title="Until the date" sub="Your shares rise and fall with the market, as before" v="—" />
      <Step n="3" title={`On ${date(m.maturity)}, you get back`} sub="Every share you deposited" v={`${n} shares`} />
      <div className="example-foot">That's <b className="gold">{m.ptDiscountPct.toFixed(2)}%</b> of your position paid upfront, with no loan and nothing to repay.</div>
    </div>
  )
}

function Anatomy({ asset, market: m }: { asset: Asset; market: Market }) {
  const ytShare = Math.max(8, (m.ytUsd / m.unitUsd) * 100)
  return (
    <div>
      <div className="anatomy-bar" role="img" aria-label={`One ${ticker(asset.symbol)} share: ${usd(m.ptUsd)} share token plus ${usd(m.ytUsd)} dividend token`}>
        <div className="pt" style={{ flex: `${100 - ytShare} 1 0` }}>Share · {usd(m.ptUsd)}</div>
        <div className="yt" style={{ flex: `${ytShare} 1 0` }}>{usd(m.ytUsd)}</div>
      </div>
      <div className="anatomy-legend">
        <div>
          <span className="k"><i className="swatch swatch-pt" /> Share token</span>
          <b>{usd(m.ptUsd)}</b>
          <span>Becomes one {ticker(asset.symbol)} share on {date(m.maturity)}</span>
        </div>
        <div>
          <span className="k"><i className="swatch swatch-yt" /> Dividend token</span>
          <b>{usd(m.ytUsd)}</b>
          <span>Collects every dividend until then</span>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 14 }}>
        Live, for {company(asset.symbol)}: {usd(m.ptUsd)} + {usd(m.ytUsd)} = {usd(m.unitUsd)}, the price of one share.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ small parts

function Step({ n, title, sub, v }: { n: string; title: string; sub: string; v: string }) {
  return (
    <div className="timeline-step">
      <i>{n}</i>
      <div><b>{title}</b><span>{sub}</span></div>
      <strong>{v}</strong>
    </div>
  )
}

function Point({ title, body }: { title: string; body: string }) {
  return (
    <li>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        <path d="M6.5 10.2l2.4 2.3 4.6-4.8" />
      </svg>
      <div><b>{title}</b><span>{body}</span></div>
    </li>
  )
}

function Safe({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.5l7.5 3v6c0 5-3.4 8.4-7.5 10-4.1-1.6-7.5-5-7.5-10v-6l7.5-3z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" strokeLinecap="round" />
      </svg>
      <b>{title}</b>
      <p>{body}</p>
    </div>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details>
      <summary>{q}</summary>
      <p>{children}</p>
    </details>
  )
}

function ExampleSkeleton() {
  return <div className="example"><span className="skeleton" style={{ width: '100%', height: 220 }} /></div>
}
