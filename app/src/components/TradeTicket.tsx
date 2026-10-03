import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { AmountInput } from './AmountInput'
import { Info } from './Info'
import { WalletButton } from './Nav'
import { WAD, amount, date, duration, parse, pct, toNum, usd } from '../lib/format'
import { abis, book, read } from '../lib/network'
import type { Asset, Market } from '../lib/protocol'
import { ACCOUNT_PLACEHOLDER, useTx } from '../lib/tx'

type Props = { asset: Asset; market: Market; now: number }

function useBalance(token: Address | undefined) {
  const { address } = useAccount()
  const { data } = useReadContract({
    address: token,
    abi: abis.XeroComponentToken,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!token, refetchInterval: 6_000 },
  })
  return (data as bigint | undefined) ?? 0n
}

/** On-chain quote. The previous result stays visible while refetching, but `fresh` is only true once the
 *  quote matches the current input and chain state; submissions must use fresh quotes only. */
function useQuote<T>(key: unknown[], enabled: boolean, fn: () => Promise<T>) {
  const q = useQuery({ queryKey: ['quote', ...key], queryFn: fn, enabled, retry: false, staleTime: 3_000, placeholderData: (p) => p })
  return { ...q, fresh: enabled && q.data !== undefined && !q.isPlaceholderData && !q.isFetching }
}

const SLIPPAGES = [10n, 50n, 100n] // bps

export function TradeTicket({ asset, market, now }: Props) {
  const [tab, setTab] = useState(market.matured ? 'redeem' : 'yield')
  const [slip, setSlip] = useState(50n)
  return (
    <section className="card ticket">
      <Tabs.Root value={market.matured && tab !== 'redeem' && tab !== 'pool' ? 'redeem' : tab} onValueChange={setTab}>
        <Tabs.List className="ticket-tabs" aria-label="Actions">
          <Tabs.Trigger value="yield" disabled={market.matured}>Yield</Tabs.Trigger>
          <Tabs.Trigger value="fix" disabled={market.matured}>Fix</Tabs.Trigger>
          <Tabs.Trigger value="strip" disabled={market.matured}>Strip</Tabs.Trigger>
          <Tabs.Trigger value="redeem">Redeem</Tabs.Trigger>
          <Tabs.Trigger value="pool">Pool</Tabs.Trigger>
        </Tabs.List>
        <div className="ticket-body">
          <Tabs.Content value="yield"><YieldTab {...{ asset, market, slip }} /></Tabs.Content>
          <Tabs.Content value="fix"><FixTab {...{ asset, market, slip }} /></Tabs.Content>
          <Tabs.Content value="strip"><StripTab {...{ asset, market }} /></Tabs.Content>
          <Tabs.Content value="redeem"><RedeemTab {...{ asset, market, now }} /></Tabs.Content>
          <Tabs.Content value="pool"><PoolTab {...{ asset, market }} /></Tabs.Content>
        </div>
      </Tabs.Root>
      <div className="ticket-foot">
        <span>Slippage</span>
        <div className="seg seg-sm" role="radiogroup" aria-label="Slippage tolerance">
          {SLIPPAGES.map((s) => (
            <button key={s} role="radio" aria-checked={slip === s} className={slip === s ? 'on' : ''} onClick={() => setSlip(s)}>
              {Number(s) / 100}%
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ shared bits

function Row({ k, v, tip, tone }: { k: string; v: ReactNode; tip?: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="row">
      <span>{tip ? <Info tip={tip}>{k}</Info> : k}</span>
      <b className={tone}>{v}</b>
    </div>
  )
}

function Submit({ label, disabled, onClick, pending }: { label: string; disabled?: boolean; onClick: () => void; pending: boolean }) {
  const { address } = useAccount()
  if (!address) return <WalletButton block />
  return (
    <button className="btn btn-primary btn-block btn-lg" disabled={disabled || pending} onClick={onClick}>
      {pending ? 'Confirm in wallet…' : label}
    </button>
  )
}

const usdOf = (raw: bigint, asset: Asset) => (asset.priceFresh ? usd(toNum(raw) * toNum(asset.priceUsd)) : undefined)
const minOut = (v: bigint, slip: bigint) => (v * (10_000n - slip)) / 10_000n

// ------------------------------------------------------------------ Yield: buy / sell YT

function YieldTab({ asset, market, slip }: { asset: Asset; market: Market; slip: bigint }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))
  const stockBal = useBalance(asset.token)
  const ytBal = useBalance(market.yieldToken)
  const { run, pending } = useTx()

  const q = useQuote(['yield', market.market, side, value.toString()], value > 0n, () =>
    read<readonly [bigint, bigint]>(market.market, abis.XeroYieldMarket, side === 'buy' ? 'quoteQuoteForYt' : 'quoteYtForQuote', [value]),
  )
  const out = q.data?.[0] ?? 0n
  const newYield = q.data ? (q.data[1] * market.dividendIndex) / WAD : market.impliedYield
  const avg = out > 0n && value > 0n ? (side === 'buy' ? (value * WAD) / out : (out * WAD) / value) : 0n
  const impact = avg > 0n && market.ytPrice > 0n ? Math.abs(toNum(avg) / toNum(market.ytPrice) - 1) : 0
  const bal = side === 'buy' ? stockBal : ytBal
  const insufficient = value > bal

  return (
    <div className="stack">
      <div className="seg" role="radiogroup" aria-label="Side">
        <button role="radio" aria-checked={side === 'buy'} className={side === 'buy' ? 'on on-up' : ''} onClick={() => { setSide('buy'); setInput('') }}>Buy yield</button>
        <button role="radio" aria-checked={side === 'sell'} className={side === 'sell' ? 'on on-down' : ''} onClick={() => { setSide('sell'); setInput('') }}>Sell yield</button>
      </div>
      <p className="hint">
        {side === 'buy'
          ? `Own the reinvested dividends of ${asset.symbol} until ${date(market.maturity)}, without holding the stock.`
          : `Sell the dividends your YT will earn and take the value today.`}
      </p>
      <AmountInput
        label="You pay"
        value={input}
        onChange={setInput}
        symbol={side === 'buy' ? asset.symbol : market.ytSymbol}
        kind={side === 'buy' ? 'stock' : 'yt'}
        balance={bal}
        usd={side === 'buy' ? usdOf(value, asset) : usdOf((value * market.ytPrice) / WAD, asset)}
        error={insufficient}
      />
      <AmountInput
        label="You receive"
        value={out > 0n ? amount(out) : ''}
        symbol={side === 'buy' ? market.ytSymbol : asset.symbol}
        kind={side === 'buy' ? 'yt' : 'stock'}
        readOnly
        usd={side === 'buy' ? usdOf((out * market.ytPrice) / WAD, asset) : usdOf(out, asset)}
      />
      {q.isError && <p className="warn">Trade too large for current liquidity.</p>}
      <div className="rows">
        <Row k="Implied yield" v={q.data ? <>{pct(market.impliedYield)} → {pct(newYield)}</> : pct(market.impliedYield)} tone={q.data ? (newYield >= market.impliedYield ? 'up' : 'down') : undefined}
          tip="Annualised dividend yield the market implies for this maturity, in share terms. Buying yield raises it; selling lowers it." />
        <Row k="Average price" v={avg > 0n ? `${amount(avg)} ${asset.symbol}` : '—'} />
        <Row k="Price impact" v={value > 0n ? pct(impact) : '—'} tone={impact > 0.01 ? 'down' : undefined} />
        <Row k="Minimum received" v={out > 0n ? amount(minOut(out, slip)) : '—'} />
        <Row k="Pool fee" v={pct(0.003, 1)} tip="Paid to liquidity providers." />
      </div>
      <Submit
        label={insufficient ? 'Insufficient balance' : side === 'buy' ? `Buy ${market.ytSymbol}` : `Sell ${market.ytSymbol}`}
        disabled={!q.fresh || insufficient}
        pending={pending}
        onClick={async () => {
          const ok = await run(
            side === 'buy' ? `Buy ${market.ytSymbol}` : `Sell ${market.ytSymbol}`,
            [
              {
                address: market.market,
                abi: abis.XeroYieldMarket,
                functionName: side === 'buy' ? 'swapExactQuoteForYt' : 'swapExactYtForQuote',
                args: [value, minOut(out, slip), ACCOUNT],
                label: side === 'buy' ? 'Buy yield' : 'Sell yield',
              },
            ],
            [{ token: side === 'buy' ? asset.token : market.yieldToken, spender: market.market, amount: value, symbol: side === 'buy' ? asset.symbol : market.ytSymbol }],
          )
          if (ok) setInput('')
        }}
      />
    </div>
  )
}

/** Stands for the connected account in call arguments; useTx substitutes it before simulating. */
const ACCOUNT = ACCOUNT_PLACEHOLDER

// ------------------------------------------------------------------ Fix: strip + sell YT via router

function FixTab({ asset, market, slip }: { asset: Asset; market: Market; slip: bigint }) {
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))
  const stockBal = useBalance(asset.token)
  const { run, pending } = useTx()
  const q = useQuote(['fix', market.vault, value.toString()], value > 0n, async () => {
    const units = await read<bigint>(market.vault, abis.XeroVault, 'previewStrip', [value])
    const [quoteOut] = await read<readonly [bigint, bigint]>(market.market, abis.XeroYieldMarket, 'quoteYtForQuote', [units])
    return { units, quoteOut }
  })
  const insufficient = value > stockBal
  const upfront = q.data?.quoteOut ?? 0n
  const tau = toNum(market.tau)
  const sharesNow = toNum(value) * toNum(asset.multiplier)

  return (
    <div className="stack">
      <p className="hint">
        Keep your {asset.symbol} exposure and sell the dividends it would earn until {date(market.maturity)}. You get the dividend
        value today, in {asset.symbol}, plus a Principal Token that redeems for your shares at maturity.
      </p>
      <AmountInput label="Deposit" value={input} onChange={setInput} symbol={asset.symbol} balance={stockBal} usd={usdOf(value, asset)} error={insufficient} />
      <div className="split-out">
        <div>
          <span>Principal Token</span>
          <b>{q.data ? amount(q.data.units) : '—'} {market.ptSymbol}</b>
          <small>≈ {num(sharesNow)} shares at maturity</small>
        </div>
        <div className="split-yield">
          <span>Dividends, paid now</span>
          <b>{upfront > 0n ? amount(upfront) : '—'} {asset.symbol}</b>
          <small>{usdOf(upfront, asset) ?? ''}</small>
        </div>
      </div>
      <div className="rows">
        <Row k="Upfront yield" v={value > 0n && upfront > 0n ? pct(toNum(upfront) / toNum(value)) : '—'}
          tip={`Share of your position paid out today for ${duration(market.tau)} of future dividends.`} />
        <Row k="Annualised" v={value > 0n && upfront > 0n && tau > 0 ? pct(toNum(upfront) / toNum(value) / tau) : '—'} />
        <Row k="Minimum received" v={upfront > 0n ? amount(minOut(upfront, slip)) : '—'} />
      </div>
      <Submit
        label={insufficient ? 'Insufficient balance' : 'Sell future dividends'}
        disabled={!q.fresh || insufficient || !book}
        pending={pending}
        onClick={async () => {
          const ok = await run(
            `Fix ${asset.symbol} dividends`,
            [{ address: book!.router, abi: abis.XeroRouter, functionName: 'stripAndSellYield', args: [market.vault, market.market, value, minOut(upfront, slip), ACCOUNT], label: 'Strip and sell yield' }],
            [{ token: asset.token, spender: book!.router, amount: value, symbol: asset.symbol }],
          )
          if (ok) setInput('')
        }}
      />
    </div>
  )
}

const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

// ------------------------------------------------------------------ Strip

function StripTab({ asset, market }: { asset: Asset; market: Market }) {
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))
  const stockBal = useBalance(asset.token)
  const { run, pending } = useTx()
  const q = useQuote(['strip', market.vault, value.toString()], value > 0n, () => read<bigint>(market.vault, abis.XeroVault, 'previewStrip', [value]))
  const insufficient = value > stockBal
  const blocked = market.frozen ? 'Vault paused for a corporate action' : market.halted ? 'Stripping halted' : undefined

  return (
    <div className="stack">
      <p className="hint">Split {asset.symbol} into a Principal Token and a Yield Token. Recombine them any time before maturity.</p>
      <AmountInput label="Deposit" value={input} onChange={setInput} symbol={asset.symbol} balance={stockBal} usd={usdOf(value, asset)} error={insufficient} />
      <div className="split-out">
        <div>
          <span>Principal</span>
          <b>{q.data ? amount(q.data) : '—'} PT</b>
          <small>{q.data ? usdOf((q.data * market.ptPrice) / WAD, asset) : ''}</small>
        </div>
        <div className="split-yield">
          <span>Yield</span>
          <b>{q.data ? amount(q.data) : '—'} YT</b>
          <small>{q.data ? usdOf((q.data * market.ytPrice) / WAD, asset) : ''}</small>
        </div>
      </div>
      <div className="rows">
        <Row k="Strip fee" v="0.05%" tip="Protocol fee on deposits, paid in the Stock Token." />
      </div>
      <Submit
        label={blocked ?? (insufficient ? 'Insufficient balance' : 'Strip')}
        disabled={!q.fresh || insufficient || !!blocked}
        pending={pending}
        onClick={async () => {
          if (await run(`Strip ${asset.symbol}`, [{ address: market.vault, abi: abis.XeroVault, functionName: 'strip', args: [value, ACCOUNT], label: 'Strip' }], [{ token: asset.token, spender: market.vault, amount: value, symbol: asset.symbol }])) setInput('')
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------------ Redeem / recombine / claim

function RedeemTab({ asset, market, now }: { asset: Asset; market: Market; now: number }) {
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))
  const ptBal = useBalance(market.principalToken)
  const ytBal = useBalance(market.yieldToken)
  const { address } = useAccount()
  const { run, pending } = useTx()
  const matured = market.matured || now >= Number(market.maturity)
  const max = matured ? ptBal : ptBal < ytBal ? ptBal : ytBal
  const q = useQuote(['redeem', market.vault, value.toString()], value > 0n, () => read<bigint>(market.vault, abis.XeroVault, 'previewRedeem', [value]))
  const claim = useQuery({
    queryKey: ['claimable', market.vault, address],
    enabled: !!address,
    refetchInterval: 6_000,
    queryFn: () => read<bigint>(market.vault, abis.XeroVault, 'claimable', [address!]),
  })

  return (
    <div className="stack">
      <p className="hint">
        {matured
          ? `Matured ${date(market.maturity)}. Each Principal Token redeems for its share of ${asset.symbol}.`
          : 'Burn equal Principal and Yield Tokens to get your Stock Tokens back (PT + YT → Stock).'}
      </p>
      <AmountInput label={matured ? 'Redeem PT' : 'Recombine units'} value={input} onChange={setInput} symbol={matured ? market.ptSymbol : `${market.symbol} PT+YT`} kind="pt" balance={max} error={value > max} />
      <div className="rows">
        <Row k="You receive" v={q.data ? `${amount(q.data)} ${asset.symbol}` : '—'} />
      </div>
      <Submit
        label={value > max ? 'Insufficient balance' : matured ? 'Redeem' : 'Recombine'}
        disabled={!q.fresh || value > max}
        pending={pending}
        onClick={async () => {
          if (await run(matured ? `Redeem ${market.ptSymbol}` : `Recombine ${asset.symbol}`, [{ address: market.vault, abi: abis.XeroVault, functionName: matured ? 'redeem' : 'recombine', args: [value, ACCOUNT] }])) setInput('')
        }}
      />
      <div className="claim-box">
        <div>
          <span>Accrued yield</span>
          <b>{amount(claim.data ?? 0n)} {asset.symbol}</b>
        </div>
        <button className="btn btn-ghost" disabled={!claim.data || pending} onClick={() => run(`Claim ${asset.symbol} yield`, [{ address: market.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [ACCOUNT] }])}>
          Claim
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Pool: add / remove liquidity

function PoolTab({ asset, market }: { asset: Asset; market: Market }) {
  const [mode, setMode] = useState<'add' | 'remove'>('add')
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))
  const ytBal = useBalance(market.yieldToken)
  const stockBal = useBalance(asset.token)
  const lpBal = useBalance(market.market)
  const { run, pending } = useTx()
  const supply = useQuery({ queryKey: ['lpSupply', market.market], queryFn: () => read<bigint>(market.market, abis.XeroYieldMarket, 'totalSupply'), refetchInterval: 8_000 })
  const quoteNeeded = market.reserveYt > 0n ? (value * market.reserveQuote) / market.reserveYt + 1n : 0n
  const share = supply.data && supply.data > 0n ? toNum(lpBal) / toNum(supply.data) : 0
  const out = useMemo(() => {
    if (!supply.data || supply.data === 0n) return { yt: 0n, quote: 0n }
    return { yt: (value * market.reserveYt) / supply.data, quote: (value * market.reserveQuote) / supply.data }
  }, [value, supply.data, market.reserveYt, market.reserveQuote])
  const addShort = value > ytBal || quoteNeeded > stockBal

  return (
    <div className="stack">
      <div className="seg" role="radiogroup" aria-label="Liquidity action">
        <button role="radio" aria-checked={mode === 'add'} className={mode === 'add' ? 'on' : ''} onClick={() => { setMode('add'); setInput('') }}>Add</button>
        <button role="radio" aria-checked={mode === 'remove'} className={mode === 'remove' ? 'on' : ''} onClick={() => { setMode('remove'); setInput('') }}>Remove</button>
      </div>
      <p className="hint">LPs earn swap fees plus the reinvested dividends of the YT held by the pool.</p>
      {mode === 'add' ? (
        <>
          <AmountInput label="YT" value={input} onChange={setInput} symbol={market.ytSymbol} kind="yt" balance={ytBal} error={value > ytBal} />
          <AmountInput label={`${asset.symbol} (matched)`} value={value > 0n ? amount(quoteNeeded) : ''} symbol={asset.symbol} readOnly balance={stockBal} error={quoteNeeded > stockBal} />
        </>
      ) : (
        <>
          <AmountInput label="LP tokens" value={input} onChange={setInput} symbol="XLP" kind="lp" balance={lpBal} error={value > lpBal} />
          <div className="rows">
            <Row k="You receive" v={value > 0n ? `${amount(out.yt)} YT + ${amount(out.quote)} ${asset.symbol}` : '—'} />
          </div>
        </>
      )}
      <div className="rows">
        <Row k="Pool liquidity" v={usd(market.liquidityUsd, 0)} />
        <Row k="Your share" v={pct(share)} />
      </div>
      <Submit
        label={mode === 'add' ? (addShort ? 'Insufficient balance' : 'Add liquidity') : value > lpBal ? 'Insufficient balance' : 'Remove liquidity'}
        disabled={value === 0n || (mode === 'add' ? addShort : value > lpBal)}
        pending={pending}
        onClick={async () => {
          const ok =
            mode === 'add'
              ? await run(
                  'Add liquidity',
                  [{ address: market.market, abi: abis.XeroYieldMarket, functionName: 'addLiquidity', args: [value, quoteNeeded, 0n, ACCOUNT] }],
                  [
                    { token: market.yieldToken, spender: market.market, amount: value, symbol: 'YT' },
                    { token: asset.token, spender: market.market, amount: quoteNeeded, symbol: asset.symbol },
                  ],
                )
              : await run('Remove liquidity', [{ address: market.market, abi: abis.XeroYieldMarket, functionName: 'removeLiquidity', args: [value, (out.yt * 995n) / 1000n, (out.quote * 995n) / 1000n, ACCOUNT] }])
          if (ok) setInput('')
        }}
      />
    </div>
  )
}
