import { useDeferredValue, useState } from 'react'
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

export function DividendSpeculation() {
  const { data, isLoading } = useProtocol()
  const [selectedSym, setSelectedSym] = useState<string>('SCHD')
  const [selectedTenor, setSelectedTenor] = useState<string>('3M')
  const [hikePct, setHikePct] = useState<number>(25) // simulated dividend hike %

  const asset = data?.assets.find((a) => a.symbol === selectedSym) ?? data?.assets[0]
  const market = asset?.markets.find((m) => m.label === selectedTenor) ?? asset?.markets.find((m) => m.live) ?? asset?.markets[0]

  const spotUsd = asset ? toNum(asset.priceUsd) : 0
  const ytPriceRatio = market ? toNum(market.ytPrice) : 0.015
  const ytUsd = spotUsd * ytPriceRatio
  const leverage = ytPriceRatio > 0 ? Math.min(200, 1 / ytPriceRatio) : 80

  // Projected returns on dividend hike
  const baselineYield = market ? toNum(market.impliedYield) : 0.04
  const simulatedYield = baselineYield * (1 + hikePct / 100)
  const projectedReturnPct = ((simulatedYield / baselineYield) - 1) * leverage

  return (
    <div className="page speculate-page">
      <header className="page-h">
        <div>
          <div className="badge-chain-row">
            <span className="base-tag">BASE</span>
            <span className="b20-standard-tag">Core Primitive #3</span>
          </div>
          <h1>Leveraged Dividend Speculation</h1>
          <p className="sub">
            Capture 50x–120x cash flow leverage on dividend hikes and corporate payout catalysts with Coinbase B20 Yield Tokens (YT).
          </p>
        </div>
        <div className="page-stats">
          <Stat label="Max leverage" value={`${market?.ytLeverage.toFixed(1) ?? '85.4'}x`} />
          <Stat label="YT cost basis" value={`${((market ? toNum(market.ytPrice) : 0.012) * 100).toFixed(2)}% of stock`} />
          <Stat label="Implied dividend APY" value={market ? pct(market.impliedYield) : '3.8%'} />
        </div>
      </header>

      {/* Equity & Tenor Selection */}
      <div className="vault-selectors-card card">
        <div className="selector-group">
          <span className="selector-label">1. Select Equity for Speculation</span>
          <div className="seg seg-wrap" role="radiogroup" aria-label="B20 Stock">
            {data?.assets.map((a) => {
              const m = a.markets.find((x) => x.live) ?? a.markets[0]
              return (
                <button
                  key={a.symbol}
                  role="radio"
                  aria-checked={a.symbol === asset?.symbol}
                  className={a.symbol === asset?.symbol ? 'on' : ''}
                  onClick={() => setSelectedSym(a.symbol)}
                >
                  <TokenIcon symbol={a.symbol} size={20} />
                  <b>{a.symbol}</b>
                  <small className="amber">{m.ytLeverage.toFixed(0)}x Lev</small>
                </button>
              )
            })}
          </div>
        </div>

        <div className="selector-group">
          <span className="selector-label">2. Select Tenor Window</span>
          <div className="seg" role="radiogroup" aria-label="Tenor">
            {asset?.markets.map((m) => (
              <button
                key={m.label}
                role="radio"
                aria-checked={m.label === market?.label}
                className={m.label === market?.label ? 'on' : ''}
                onClick={() => setSelectedTenor(m.label)}
              >
                <b>{m.label}</b>
                <small>{pct(m.impliedYield)} APY</small>
              </button>
            ))}
          </div>
        </div>
      </div>

      {asset && market && (
        <div className="vault-workspace-grid">
          {/* Main Trade Ticket */}
          <div className="card ticket-box">
            <div className="ticket-head">
              <div>
                <h3>Buy {market.ytSymbol}</h3>
                <span className="hint">Leveraged exposure to {asset.symbol} dividends until {date(market.maturity)}</span>
              </div>
              <span className="leverage-chip amber">{market.ytLeverage.toFixed(1)}x Leverage</span>
            </div>

            <SpeculateBuyTerminal asset={asset} market={market} />
          </div>

          {/* Interactive Dividend Hike Simulator */}
          <aside className="vault-sidebar">
            <div className="card hike-simulator-card">
              <div className="simulator-header">
                <div>
                  <span className="eyebrow">Interactive Simulator</span>
                  <h3>Dividend Hike Calculator</h3>
                </div>
                <span className="badge-math">ΔM Engine</span>
              </div>

              <p className="hint">
                Simulate an unexpected dividend increase or special distribution before <b>{date(market.maturity)}</b>:
              </p>

              <div className="slider-container">
                <div className="slider-label-row">
                  <span>Simulated Dividend Hike</span>
                  <b className="amber">+{hikePct}%</b>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={hikePct}
                  onChange={(e) => setHikePct(Number(e.target.value))}
                  className="base-slider"
                />
                <div className="slider-ticks">
                  <span>0%</span>
                  <span>+50%</span>
                  <span>+100%</span>
                  <span>+150%</span>
                </div>
              </div>

              <div className="simulated-outcome-box">
                <div className="sim-row">
                  <span>Current Implied Dividend</span>
                  <b>{pct(market.impliedYield)}</b>
                </div>
                <div className="sim-row">
                  <span>Simulated Dividend Yield</span>
                  <b className="amber">{pct(simulatedYield)}</b>
                </div>
                <div className="sim-row">
                  <span>Effective Capital Leverage</span>
                  <b>{market.ytLeverage.toFixed(1)}x</b>
                </div>
                <div className="sim-row total-sim">
                  <span>Projected YT Return</span>
                  <b className="up">+{projectedReturnPct.toFixed(1)}%</b>
                </div>
              </div>

              <div className="explainer-callout">
                <span className="callout-icon">💡</span>
                <div>
                  <b>Why Does YT Have High Leverage?</b>
                  <p>
                    Since 1 YT costs only ~{usd(ytUsd)} while spot {asset.symbol} is {usd(spotUsd)}, you capture 100% of the dividend flow for a tiny fraction of the principal capital.
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

function SpeculateBuyTerminal({ asset, market }: { asset: Asset; market: Market }) {
  const { address } = useAccount()
  const { run, pending } = useTx()
  const [inputYt, setInputYt] = useState('100')
  const value = parse(useDeferredValue(inputYt))

  const { data: rawStockBal } = useReadContract({
    address: asset.token,
    abi: abis.MockStockToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 6_000 },
  })
  const stockBal = (rawStockBal as bigint | undefined) ?? 0n

  const quote = useQuery({
    queryKey: ['quoteBuyYt', market.market, value.toString()],
    enabled: value > 0n && market.live,
    queryFn: () => read<readonly [bigint, bigint]>(market.market, abis.XeroYieldMarket, 'quoteYtForQuote', [value]),
  })

  const costStock = quote.data?.[0] ?? (value * market.ytPrice) / WAD
  const spotPx = toNum(asset.priceUsd)
  const ytUsd = toNum(costStock) * spotPx
  const insufficient = costStock > stockBal

  return (
    <div className="stack">
      <AmountInput
        label="YT Tokens to Buy"
        value={inputYt}
        onChange={setInputYt}
        symbol={market.ytSymbol}
        kind="yt"
        balance={stockBal}
        usd={usd(ytUsd)}
      />

      <div className="split-out-grid">
        <div className="split-card yt-split">
          <span className="split-tag">Dividend Exposure</span>
          <b>{amount(value)} Shares</b>
          <small>{usd(toNum(value) * spotPx)} Capital Equivalent</small>
        </div>

        <div className="split-card up-split">
          <span className="split-tag">Upfront Cost</span>
          <b className="amber">{amount(costStock)} {asset.symbol}</b>
          <small>{usd(ytUsd)} Total Outlay</small>
        </div>
      </div>

      <div className="rows">
        <div className="row">
          <span>Capital Efficiency</span>
          <b className="amber">{market.ytLeverage.toFixed(1)}x Dividend Multiplier</b>
        </div>
        <div className="row">
          <span>Current Implied Dividend Rate</span>
          <b>{pct(market.impliedYield)}</b>
        </div>
        <div className="row">
          <span>Maturity Expiration</span>
          <b>{date(market.maturity)}</b>
        </div>
      </div>

      {!address ? (
        <WalletButton block />
      ) : (
        <button
          className="btn btn-primary btn-block btn-lg"
          disabled={value === 0n || insufficient || pending || !market.live}
          onClick={async () => {
            const ok = await run(`Buy ${amount(value)} ${market.ytSymbol}`, [
              {
                address: market.market,
                abi: abis.XeroYieldMarket,
                functionName: 'swapExactQuoteForYt',
                args: [costStock, 0n, ACCOUNT_PLACEHOLDER],
                label: 'Buy Yield Token',
              },
            ])
            if (ok) setInputYt('')
          }}
        >
          {pending ? 'Executing on Base…' : !market.live ? 'Market paused' : insufficient ? 'Insufficient balance' : `Buy ${market.ytSymbol}`}
        </button>
      )}
    </div>
  )
}
