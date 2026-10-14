import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAccount, useReadContract } from 'wagmi'
import { AmountInput } from '../components/AmountInput'
import { Info, Skeleton, Stat } from '../components/Info'
import { MarketIcon, TokenIcon } from '../components/TokenIcon'
import { WalletButton } from '../components/Nav'
import { WAD, amount, compactUsd, date, duration, parse, pct, toNum, usd } from '../lib/format'
import { abis, read } from '../lib/network'
import { useProtocol, type Asset, type Market } from '../lib/protocol'
import { ACCOUNT_PLACEHOLDER, useTx } from '../lib/tx'
import { useQuery } from '@tanstack/react-query'

export function DiscountedStock() {
  const { data, isLoading } = useProtocol()
  const [selectedSym, setSelectedSym] = useState<string>('NVDAc')
  const [selectedTenor, setSelectedTenor] = useState<string>('3M')
  const [inputUnits, setInputUnits] = useState('10')
  const [slip, setSlip] = useState(50n)

  const asset = data?.assets.find((a) => a.symbol === selectedSym) ?? data?.assets[0]
  const market = asset?.markets.find((m) => m.label === selectedTenor) ?? asset?.markets.find((m) => m.live) ?? asset?.markets[0]

  const spotUsd = asset ? toNum(asset.priceUsd) : 0
  const ptUsd = market && spotUsd > 0 ? toNum(market.ptPrice) * spotUsd : 0
  const discountUsd = Math.max(0, spotUsd - ptUsd)
  const discountPct = spotUsd > 0 ? (discountUsd / spotUsd) * 100 : 0

  return (
    <div className="page discount-page">
      <header className="page-h">
        <div>
          <div className="badge-chain-row">
            <span className="base-tag">BASE</span>
            <span className="b20-standard-tag">Core Primitive #2</span>
          </div>
          <h1>Buy Tokenized Stocks at a Discount</h1>
          <p className="sub">
            Acquire Coinbase B20 Principal Tokens (PT) at an upfront discount. Hold to maturity and redeem 1:1 for the full underlying stock share.
          </p>
        </div>
        <div className="page-stats">
          <Stat label="Top discount" value={`${(data?.markets.reduce((m, x) => Math.max(m, x.ptDiscountPct), 0) ?? 8.5).toFixed(2)}%`} />
          <Stat label="Fixed APY range" value="4.2% – 12.8%" />
          <Stat label="Redemption ratio" value="1 PT = 1 Share" />
        </div>
      </header>

      {/* Asset Grid Showcase */}
      <section className="discount-showcase-grid">
        {data?.assets.map((a) => {
          const m = a.markets.find((x) => x.live) ?? a.markets[0]
          const isSelected = a.symbol === asset?.symbol
          return (
            <div
              key={a.symbol}
              className={`card discount-asset-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedSym(a.symbol)}
              tabIndex={0}
              role="button"
            >
              <div className="discount-card-head">
                <MarketIcon symbol={a.symbol} size={32} />
                <div>
                  <b>{a.symbol}</b>
                  <span>{a.name}</span>
                </div>
                <span className="discount-badge up">−{m.ptDiscountPct.toFixed(1)}% OFF</span>
              </div>

              <div className="discount-price-comparison">
                <div className="px-col">
                  <span className="lbl">Spot Price</span>
                  <b>{usd(a.priceUsd)}</b>
                </div>
                <div className="px-arrow">➔</div>
                <div className="px-col">
                  <span className="lbl">PT Discount Price</span>
                  <b className="up">{usd(toNum(m.ptPrice) * toNum(a.priceUsd))}</b>
                </div>
              </div>

              <div className="discount-card-foot">
                <span>Fixed APY: <b className="up">{m.ptFixedYield.toFixed(2)}%</b></span>
                <small>Matures {m.label}</small>
              </div>
            </div>
          )
        })}
      </section>

      {/* Workstation for selected PT asset */}
      {asset && market && (
        <div className="vault-workspace-grid">
          <div className="card ticket-box">
            <div className="ticket-head">
              <h3>Buy {market.ptSymbol}</h3>
              <div className="seg seg-sm">
                {asset.markets.map((m) => (
                  <button
                    key={m.label}
                    className={m.label === market.label ? 'on' : ''}
                    onClick={() => setSelectedTenor(m.label)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <DiscountBuyTerminal asset={asset} market={market} slip={slip} />
          </div>

          <aside className="vault-sidebar">
            <div className="card discount-calculator-card">
              <h3>Discount Mechanics</h3>
              <p className="hint">
                Because future dividends until <b>{date(market.maturity)}</b> are stripped out into Yield Tokens, the Principal Token sells below spot:
              </p>

              <div className="calculator-metrics">
                <div className="metric-row">
                  <span>Current Spot Price</span>
                  <b>{usd(spotUsd)}</b>
                </div>
                <div className="metric-row">
                  <span>PT Purchase Price</span>
                  <b className="up">{usd(ptUsd)}</b>
                </div>
                <div className="metric-row">
                  <span>Instant Capital Discount</span>
                  <b className="up">{usd(discountUsd)} ({discountPct.toFixed(2)}%)</b>
                </div>
                <div className="metric-row highlight">
                  <span>Guaranteed Fixed Return</span>
                  <b className="up">{market.ptFixedYield.toFixed(2)}% APY</b>
                </div>
                <div className="metric-row">
                  <span>Maturity Redemption</span>
                  <b>1 PT ➔ 1 {asset.symbol} Share</b>
                </div>
              </div>

              <div className="explainer-callout">
                <span className="callout-icon">🛡️</span>
                <div>
                  <b>Zero Dividend Volatility</b>
                  <p>
                    Regardless of whether quarterly dividends rise, fall, or pause, your 1 PT guarantees 1 full underlying share upon maturity.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function DiscountBuyTerminal({ asset, market, slip }: { asset: Asset; market: Market; slip: bigint }) {
  const { address } = useAccount()
  const { run, pending } = useTx()
  const [input, setInput] = useState('1')
  const value = parse(useDeferredValue(input))

  const { data: rawStockBal } = useReadContract({
    address: asset.token,
    abi: abis.MockStockToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 6_000 },
  })
  const stockBal = (rawStockBal as bigint | undefined) ?? 0n

  const spotPx = toNum(asset.priceUsd)
  const ptDiscountRatio = toNum(market.ptPrice)
  const costStock = (value * market.ptPrice) / WAD
  const insufficient = costStock > stockBal

  return (
    <div className="stack">
      <AmountInput
        label="PT Units to Buy"
        value={input}
        onChange={setInput}
        symbol={market.ptSymbol}
        kind="pt"
        usd={value > 0n ? usd(toNum(value) * ptDiscountRatio * spotPx) : undefined}
      />

      <div className="split-out-grid">
        <div className="split-card pt-split">
          <span className="split-tag">Redeemable at Maturity</span>
          <b>{value > 0n ? amount(value) : '—'} Shares</b>
          <small>{usd(toNum(value) * spotPx)} Spot Value</small>
        </div>

        <div className="split-card up-split">
          <span className="split-tag">Discount Savings</span>
          <b className="up">{value > 0n ? usd(toNum(value) * (1 - ptDiscountRatio) * spotPx) : '—'}</b>
          <small>{((1 - ptDiscountRatio) * 100).toFixed(2)}% Off Spot</small>
        </div>
      </div>

      <div className="rows">
        <div className="row">
          <span>Cost in {asset.symbol}</span>
          <b>{value > 0n ? amount(costStock) : '—'} {asset.symbol}</b>
        </div>
        <div className="row">
          <span>Your Fixed Annual Return</span>
          <b className="up">{market.ptFixedYield.toFixed(2)}% APY</b>
        </div>
        <div className="row">
          <span>Maturity Date</span>
          <b>{date(market.maturity)} ({duration(Number(market.maturity) - Math.floor(Date.now() / 1000))})</b>
        </div>
      </div>

      {!address ? (
        <WalletButton block />
      ) : (
        <button
          className="btn btn-primary btn-block btn-lg"
          disabled={value === 0n || insufficient || pending}
          onClick={async () => {
            // Purchases PT at discount
            const ok = await run(`Buy ${amount(value)} ${market.ptSymbol}`, [
              {
                address: market.market,
                abi: abis.XeroYieldMarket,
                functionName: 'swapExactQuoteForYt',
                args: [costStock, 0n, ACCOUNT_PLACEHOLDER],
                label: 'Buy at discount',
              },
            ])
            if (ok) setInput('')
          }}
        >
          {pending ? 'Confirming transaction…' : insufficient ? 'Insufficient balance' : `Buy ${market.ptSymbol} at Discount`}
        </button>
      )}
    </div>
  )
}
