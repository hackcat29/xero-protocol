import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { useAccount, useReadContract } from 'wagmi'
import { AmountInput } from '../components/AmountInput'
import { Info, Skeleton, Stat } from '../components/Info'
import { MarketIcon, TokenIcon } from '../components/TokenIcon'
import { WalletButton } from '../components/Nav'
import { WAD, amount, compactUsd, date, duration, parse, pct, toNum, usd } from '../lib/format'
import { abis, book, read } from '../lib/network'
import { useProtocol, type Asset, type Market } from '../lib/protocol'
import { ACCOUNT_PLACEHOLDER, useTx } from '../lib/tx'
import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

type Tab = 'strip' | 'claim' | 'recombine' | 'redeem'

export function StripVault() {
  const { data, isLoading } = useProtocol()
  const [selectedSym, setSelectedSym] = useState<string>('NVDAc')
  const [selectedTenor, setSelectedTenor] = useState<string>('3M')
  const [tab, setTab] = useState<Tab>('strip')

  const asset = data?.assets.find((a) => a.symbol === selectedSym) ?? data?.assets[0]
  const market = asset?.markets.find((m) => m.label === selectedTenor) ?? asset?.markets.find((m) => m.live) ?? asset?.markets[0]

  if (isLoading || !data || !asset || !market) {
    return (
      <div className="page">
        <Skeleton w={320} h={36} />
        <div style={{ height: 24 }} />
        <Skeleton h={380} />
      </div>
    )
  }

  return (
    <div className="page strip-page">
      <header className="page-h">
        <div>
          <div className="badge-chain-row">
            <span className="base-tag">BASE</span>
            <span className="b20-standard-tag">B20 Yield-Stripping Engine</span>
          </div>
          <h1>B20 Strip & Yield Vault</h1>
          <p className="sub">
            Deconstruct Coinbase B20 tokenized equities into baseline Principal Tokens (PT) and streaming Yield Tokens (YT).
          </p>
        </div>
        <div className="page-stats">
          <Stat label="Total stripped" value={compactUsd(data.tvlUsd)} />
          <Stat label="Spot price" value={usd(asset.priceUsd)} />
          <Stat label="B20 multiplier" value={`${toNum(asset.multiplier).toFixed(4)}x`} />
        </div>
      </header>

      {/* Asset & Tenor Pickers */}
      <div className="vault-selectors-card card">
        <div className="selector-group">
          <span className="selector-label">1. Select B20 Equity</span>
          <div className="seg seg-wrap" role="radiogroup" aria-label="B20 Equity">
            {data.assets.map((a) => (
              <button
                key={a.symbol}
                role="radio"
                aria-checked={a.symbol === asset.symbol}
                className={a.symbol === asset.symbol ? 'on' : ''}
                onClick={() => setSelectedSym(a.symbol)}
              >
                <TokenIcon symbol={a.symbol} size={20} />
                <b>{a.symbol}</b>
                <small>{usd(a.priceUsd)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="selector-group">
          <span className="selector-label">2. Select Tenor</span>
          <div className="seg" role="radiogroup" aria-label="Tenor">
            {asset.markets.map((m) => (
              <button
                key={m.label}
                role="radio"
                aria-checked={m.label === market.label}
                className={m.label === market.label ? 'on' : ''}
                onClick={() => setSelectedTenor(m.label)}
              >
                <b>{m.label}</b>
                <small>{m.matured ? 'Matured' : duration(Number(m.maturity) - data.now)}</small>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Interactive Workstation */}
      <div className="vault-workspace-grid">
        <div className="card vault-action-card">
          <div className="seg seg-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'strip'} className={tab === 'strip' ? 'on' : ''} onClick={() => setTab('strip')}>
              Strip (Mint PT+YT)
            </button>
            <button role="tab" aria-selected={tab === 'claim'} className={tab === 'claim' ? 'on' : ''} onClick={() => setTab('claim')}>
              Claim Streaming Yield
            </button>
            <button role="tab" aria-selected={tab === 'recombine'} className={tab === 'recombine' ? 'on' : ''} onClick={() => setTab('recombine')}>
              Recombine
            </button>
            <button role="tab" aria-selected={tab === 'redeem'} className={tab === 'redeem' ? 'on' : ''} onClick={() => setTab('redeem')}>
              Redeem PT
            </button>
          </div>

          <div className="vault-tab-body">
            {tab === 'strip' && <StripAction asset={asset} market={market} />}
            {tab === 'claim' && <ClaimAction asset={asset} market={market} />}
            {tab === 'recombine' && <RecombineAction asset={asset} market={market} />}
            {tab === 'redeem' && <RedeemAction asset={asset} market={market} now={data.now} />}
          </div>
        </div>

        {/* Informative Side Panel */}
        <aside className="vault-sidebar">
          <div className="card math-explainer-card">
            <h3>Multiplier Deconstruction Math</h3>
            <p className="hint">
              When depositing <code>{asset.symbol}</code>, the vault locks the B20 asset and issues two distinct ERC-20 tokens maturing on{' '}
              <b>{date(market.maturity)}</b>:
            </p>
            <div className="equation-box">
              <div className="eq-line">
                <span className="eq-lhs">1 {asset.symbol}</span>
                <span className="eq-op">➔</span>
                <span className="eq-rhs">1 PT + 1 YT</span>
              </div>
              <div className="eq-sub">PT = Baseline Capital · YT = Escalating Multiplier Growth (ΔM)</div>
            </div>

            <ul className="math-bullets">
              <li>
                <b>PT (Principal Token):</b> Entitles holder to 1:1 baseline stock value at maturity, stripped of all dividend growth.
              </li>
              <li>
                <b>YT (Yield Token):</b> Streams all multiplier compounding updates ($\Delta M = M_{'{current}'} - M_{'{last}'}$) until maturity.
              </li>
              <li>
                <b>Split Immunity:</b> Attested stock splits scale structural factor $S$, leaving dividend index $I = M/S$ invariant.
              </li>
            </ul>

            <div className="vault-metric-rows">
              <div className="row">
                <span>Vault Contract</span>
                <span className="mono">{market.vault.slice(0, 8)}…{market.vault.slice(-6)}</span>
              </div>
              <div className="row">
                <span>Current Dividend Index (I)</span>
                <b>{toNum(market.dividendIndex).toFixed(6)}</b>
              </div>
              <div className="row">
                <span>Structural Factor (S)</span>
                <b>{toNum(market.structuralFactor).toFixed(4)}x</b>
              </div>
              <div className="row">
                <span>Implied Dividend APY</span>
                <b className="amber">{pct(market.impliedYield)}</b>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function StripAction({ asset, market }: { asset: Asset; market: Market }) {
  const { address } = useAccount()
  const { run, pending } = useTx()
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))

  const { data: rawStockBal } = useReadContract({
    address: asset.token,
    abi: abis.MockStockToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 6_000 },
  })
  const stockBal = (rawStockBal as bigint | undefined) ?? 0n

  const preview = useQuery({
    queryKey: ['previewStrip', market.vault, value.toString()],
    enabled: value > 0n,
    queryFn: () => read<bigint>(market.vault, abis.XeroVault, 'previewStrip', [value]),
  })

  const units = preview.data ?? value
  const insufficient = value > stockBal

  return (
    <div className="stack">
      <p className="hint">
        Deposit <code>{asset.symbol}</code> to split into <b>{market.ptSymbol}</b> and <b>{market.ytSymbol}</b>. Keep the principal or sell future dividends upfront on Base.
      </p>

      <AmountInput
        label="Deposit B20 Stock"
        value={input}
        onChange={setInput}
        symbol={asset.symbol}
        balance={stockBal}
        usd={value > 0n ? usd(toNum(value) * toNum(asset.priceUsd)) : undefined}
        error={insufficient}
      />

      <div className="split-out-grid">
        <div className="split-card pt-split">
          <span className="split-tag">Principal Token (PT)</span>
          <b>{units > 0n ? amount(units) : '—'}</b>
          <small>{market.ptSymbol}</small>
          <div className="split-usd">{units > 0n ? usd(toNum(units) * toNum(market.ptPrice) * toNum(asset.priceUsd)) : '—'}</div>
        </div>

        <div className="split-card yt-split">
          <span className="split-tag">Yield Token (YT)</span>
          <b>{units > 0n ? amount(units) : '—'}</b>
          <small>{market.ytSymbol}</small>
          <div className="split-usd">{units > 0n ? usd(toNum(units) * toNum(market.ytPrice) * toNum(asset.priceUsd)) : '—'}</div>
        </div>
      </div>

      <div className="rows">
        <div className="row">
          <span><Info tip="Annualized fixed discount you can capture by selling YT today.">PT Fixed APY</Info></span>
          <b>{market.ptFixedYield.toFixed(2)}%</b>
        </div>
        <div className="row">
          <span><Info tip="Effective leverage for speculative dividend buyers.">YT Dividend Leverage</Info></span>
          <b className="amber">{market.ytLeverage.toFixed(1)}x</b>
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
            const ok = await run(
              `Strip ${amount(value)} ${asset.symbol}`,
              [{ address: market.vault, abi: abis.XeroVault, functionName: 'strip', args: [value, ACCOUNT_PLACEHOLDER], label: 'Strip B20' }],
              [{ token: asset.token, spender: market.vault, amount: value, symbol: asset.symbol }],
            )
            if (ok) setInput('')
          }}
        >
          {pending ? 'Confirming on Base…' : insufficient ? 'Insufficient balance' : `Strip ${asset.symbol}`}
        </button>
      )}
    </div>
  )
}

function ClaimAction({ asset, market }: { asset: Asset; market: Market }) {
  const { address } = useAccount()
  const { run, pending } = useTx()

  const { data: claimable = 0n, refetch } = useQuery({
    queryKey: ['claimableYield', market.vault, address],
    enabled: !!address,
    queryFn: () => read<bigint>(market.vault, abis.XeroVault, 'claimable', [address!]),
    refetchInterval: 5_000,
  })

  const { data: rawYtBal } = useReadContract({
    address: market.yieldToken,
    abi: abis.XeroComponentToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5_000 },
  })
  const ytBal = (rawYtBal as bigint | undefined) ?? 0n

  return (
    <div className="stack">
      <div className="streaming-delta-box card">
        <div className="delta-header">
          <div>
            <span className="eyebrow">Streaming Yield Formula</span>
            <h4>Continuous Multiplier Delta Accrual</h4>
          </div>
          <span className="badge-live">Live Stream</span>
        </div>
        <div className="delta-formula-display">
          <code>Y = Tokens Held × (M_{'{current}'} / M_{'{last_claim}'} − 1)</code>
        </div>
        <p className="hint">
          Every time Coinbase B20 updates the dividend multiplier via DRIP reinvestment, your claimable <code>{asset.symbol}</code> balance grows automatically without impermanent loss.
        </p>
      </div>

      <div className="claim-hero card">
        <div className="claim-hero-metric">
          <span>Claimable Accrued Yield</span>
          <b className="claim-value amber">{amount(claimable)} {asset.symbol}</b>
          <small>{usd(toNum(claimable) * toNum(asset.priceUsd))}</small>
        </div>

        <div className="claim-hero-stats">
          <div className="row">
            <span>Your YT Holdings</span>
            <b>{amount(ytBal)} {market.ytSymbol}</b>
          </div>
          <div className="row">
            <span>Current Multiplier (M_t)</span>
            <b>{toNum(asset.multiplier).toFixed(6)}x</b>
          </div>
        </div>
      </div>

      {!address ? (
        <WalletButton block />
      ) : (
        <button
          className="btn btn-primary btn-block btn-lg"
          disabled={claimable === 0n || pending}
          onClick={async () => {
            const ok = await run(`Claim ${amount(claimable)} ${asset.symbol}`, [
              { address: market.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [ACCOUNT_PLACEHOLDER], label: 'Claim Yield' },
            ])
            if (ok) refetch()
          }}
        >
          {pending ? 'Confirming claim…' : claimable === 0n ? 'No yield accrued yet' : `Claim ${amount(claimable)} ${asset.symbol}`}
        </button>
      )}
    </div>
  )
}

function RecombineAction({ asset, market }: { asset: Asset; market: Market }) {
  const { address } = useAccount()
  const { run, pending } = useTx()
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))

  const { data: rawPtBal } = useReadContract({
    address: market.principalToken,
    abi: abis.XeroComponentToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 6_000 },
  })
  const ptBal = (rawPtBal as bigint | undefined) ?? 0n

  const { data: rawYtBal } = useReadContract({
    address: market.yieldToken,
    abi: abis.XeroComponentToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 6_000 },
  })
  const ytBal = (rawYtBal as bigint | undefined) ?? 0n

  const maxRecombine = ptBal < ytBal ? ptBal : ytBal
  const insufficient = value > maxRecombine

  return (
    <div className="stack">
      <p className="hint">
        Burn equal units of <b>PT</b> and <b>YT</b> before maturity to restore your original <code>{asset.symbol}</code> token.
      </p>

      <AmountInput
        label="Units to Recombine"
        value={input}
        onChange={setInput}
        symbol={`${asset.symbol} PT+YT`}
        kind="pt"
        balance={maxRecombine}
        error={insufficient}
      />

      <div className="rows">
        <div className="row">
          <span>PT Balance</span>
          <b>{amount(ptBal)} {market.ptSymbol}</b>
        </div>
        <div className="row">
          <span>YT Balance</span>
          <b>{amount(ytBal)} {market.ytSymbol}</b>
        </div>
        <div className="row">
          <span>You Receive Back</span>
          <b className="up">{value > 0n ? amount(value) : '—'} {asset.symbol}</b>
        </div>
      </div>

      {!address ? (
        <WalletButton block />
      ) : (
        <button
          className="btn btn-primary btn-block btn-lg"
          disabled={value === 0n || insufficient || pending}
          onClick={async () => {
            const ok = await run(`Recombine ${amount(value)} ${asset.symbol}`, [
              { address: market.vault, abi: abis.XeroVault, functionName: 'recombine', args: [value, ACCOUNT_PLACEHOLDER], label: 'Recombine' },
            ])
            if (ok) setInput('')
          }}
        >
          {pending ? 'Recombining…' : insufficient ? 'Insufficient PT/YT pairs' : `Recombine ${asset.symbol}`}
        </button>
      )}
    </div>
  )
}

function RedeemAction({ asset, market, now }: { asset: Asset; market: Market; now: number }) {
  const { address } = useAccount()
  const { run, pending } = useTx()
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))
  const matured = market.matured || now >= Number(market.maturity)

  const { data: rawPtBal } = useReadContract({
    address: market.principalToken,
    abi: abis.XeroComponentToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 6_000 },
  })
  const ptBal = (rawPtBal as bigint | undefined) ?? 0n

  const preview = useQuery({
    queryKey: ['previewRedeem', market.vault, value.toString()],
    enabled: value > 0n && matured,
    queryFn: () => read<bigint>(market.vault, abis.XeroVault, 'previewRedeem', [value]),
  })

  const out = preview.data ?? value
  const insufficient = value > ptBal

  return (
    <div className="stack">
      <p className="hint">
        {matured
          ? `This vault matured on ${date(market.maturity)}. Burn your Principal Tokens (PT) to redeem full underlying ${asset.symbol} shares.`
          : `This vault matures on ${date(market.maturity)}. Redemption opens automatically upon maturity.`}
      </p>

      <AmountInput
        label="Redeem PT"
        value={input}
        onChange={setInput}
        symbol={market.ptSymbol}
        kind="pt"
        balance={ptBal}
        error={insufficient}
      />

      <div className="rows">
        <div className="row">
          <span>Vault Status</span>
          <b className={matured ? 'up' : 'amber'}>{matured ? 'Matured (Ready to Redeem)' : 'Active (Pre-Maturity)'}</b>
        </div>
        <div className="row">
          <span>You Receive</span>
          <b>{out > 0n ? amount(out) : '—'} {asset.symbol}</b>
        </div>
      </div>

      {!address ? (
        <WalletButton block />
      ) : (
        <button
          className="btn btn-primary btn-block btn-lg"
          disabled={!matured || value === 0n || insufficient || pending}
          onClick={async () => {
            const ok = await run(`Redeem ${amount(value)} ${market.ptSymbol}`, [
              { address: market.vault, abi: abis.XeroVault, functionName: 'redeem', args: [value, ACCOUNT_PLACEHOLDER], label: 'Redeem PT' },
            ])
            if (ok) setInput('')
          }}
        >
          {pending ? 'Redeeming…' : !matured ? 'Locked until maturity' : insufficient ? 'Insufficient PT' : `Redeem for ${asset.symbol}`}
        </button>
      )}
    </div>
  )
}
