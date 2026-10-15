import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowIcon } from './icons'
import type { Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { AmountInput } from './AmountInput'
import { TestTokensButton } from './DevConsole'
import { Info } from './Info'
import { ReviewDialog } from './Review'
import { WalletButton } from './Nav'
import { WAD, amount, date, parse, pct, toNum, usd } from '../lib/format'
import { ptName, ticker, ytName } from '../lib/assets'
import { abis, book, isDemo, read } from '../lib/network'
import type { Asset, Market } from '../lib/protocol'
import { ACCOUNT_PLACEHOLDER, useTx } from '../lib/tx'
import { prefs, usePrefs } from '../lib/prefs'

/** Stands for the connected account in call arguments; useTx substitutes it before simulating. */
const ACCOUNT = ACCOUNT_PLACEHOLDER

export function useBalance(token: Address | undefined) {
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
export function useQuote<T>(key: unknown[], enabled: boolean, fn: () => Promise<T>) {
  const q = useQuery({
    queryKey: ['quote', ...key],
    queryFn: fn,
    enabled,
    // retry dropped RPC requests, but not reverts (e.g. a trade larger than the pool)
    retry: (n, e) => n < 3 && !/revert/i.test(String((e as Error)?.message)),
    retryDelay: 600,
    staleTime: 3_000,
    placeholderData: (p) => p,
  })
  return { ...q, fresh: enabled && q.data !== undefined && !q.isPlaceholderData && !q.isFetching }
}

export const minOut = (v: bigint, slip: bigint) => (v * (10_000n - slip)) / 10_000n
export const usdOf = (raw: bigint, asset: Asset) => (asset.priceFresh ? usd(toNum(raw) * toNum(asset.priceUsd)) : undefined)
export const shares = (units: bigint) => toNum(units).toLocaleString('en-US', { maximumFractionDigits: 4 })

// ------------------------------------------------------------------ shared bits

export const SLIPPAGES = [10n, 50n, 100n] // bps

/** Price protection is remembered between visits. */
export function useSlippage(): [bigint, (s: bigint) => void] {
  const bps = usePrefs((p) => p.slippageBps)
  return [BigInt(bps), (s: bigint) => prefs.setSlippage(Number(s))]
}

export function SlippagePicker({ slip, setSlip }: { slip: bigint; setSlip: (s: bigint) => void }) {
  return (
    <div className="ticket-foot">
      <Info tip="The most the price may move against you between quoting and confirming. The trade cancels if it moves further.">Price protection</Info>
      <div className="seg seg-sm" role="radiogroup" aria-label="Price protection">
        {SLIPPAGES.map((s) => (
          <button key={s} role="radio" aria-checked={slip === s} className={slip === s ? 'on' : ''} onClick={() => setSlip(s)}>
            {Number(s) / 100}%
          </button>
        ))}
      </div>
    </div>
  )
}

export function Row({ k, v, tip, tone }: { k: string; v: ReactNode; tip?: ReactNode; tone?: 'up' | 'down' | 'gold' }) {
  return (
    <div className="row">
      <span>{tip ? <Info tip={tip}>{k}</Info> : k}</span>
      <b className={tone}>{v}</b>
    </div>
  )
}

export function Submit({ label, disabled, onClick, pending, gold }: { label: string; disabled?: boolean; onClick: () => void; pending: boolean; gold?: boolean }) {
  const { address } = useAccount()
  if (!address) return <WalletButton block />
  return (
    <button className={`btn btn-lg btn-block ${gold ? 'btn-gold' : 'btn-primary'}`} disabled={disabled || pending} onClick={onClick}>
      {pending ? 'Confirm in your wallet…' : label}
    </button>
  )
}

/** On testnet, an empty wallet gets a one-click way to claim test stock instead of a dead end. */
export function NeedTokens({ asset, balance }: { asset: Asset; balance: bigint }) {
  const { address } = useAccount()
  if (!isDemo || !address || balance > 0n) return null
  return (
    <p className="need-tokens">
      No {asset.symbol} in this wallet yet. <TestTokensButton label="Get free test tokens" className="" />
    </p>
  )
}

export function Closed({ market }: { market: Market }) {
  if (market.matured) return <p className="banner">This maturity has ended. Use Redeem to collect your shares.</p>
  if (market.frozen) return <p className="banner banner-warn">Paused while a corporate action is confirmed. Existing positions can still exit.</p>
  if (market.halted) return <p className="banner banner-warn">New deposits are paused for this stock. Existing positions can still exit.</p>
  return null
}

// ------------------------------------------------------------------ Buy at a discount

/** Mirrors XeroRouter.buyPrincipal: strip, sell the dividends, reinvest the proceeds, up to four rounds. */
async function quoteBuyPrincipal(market: Market, raw: bigint) {
  let units = 0n
  let left = raw
  for (let i = 0; i < 4 && left * 10_000n >= raw; i++) {
    const u = await read<bigint>(market.vault, abis.XeroVault, 'previewStrip', [left])
    if (u === 0n) break
    units += u
    ;[left] = await read<readonly [bigint, bigint]>(market.market, abis.XeroYieldMarket, 'quoteYtForQuote', [u])
  }
  return { units, refund: left }
}

export function DiscountForm({ asset, market, slip }: { asset: Asset; market: Market; slip: bigint }) {
  const [input, setInput] = useState('')
  const [review, setReview] = useState(false)
  const value = parse(useDeferredValue(input))
  const bal = useBalance(asset.token)
  const { run, pending } = useTx()
  const open = market.live && !market.frozen && !market.halted
  const q = useQuote(['discount', market.vault, value.toString()], open && value > 0n, () => quoteBuyPrincipal(market, value))
  const units = q.data?.units ?? 0n
  const spent = value - (q.data?.refund ?? 0n)
  const worthToday = toNum(units) * toNum(asset.sharePriceUsd)
  const costUsd = toNum(spent) * toNum(asset.priceUsd)
  const discount = units > 0n && worthToday > 0 ? 1 - costUsd / worthToday : market.ptDiscountPct / 100
  const years = toNum(market.tau)
  const annual = years > 0 && discount < 1 ? discount / (1 - discount) / years : 0
  const insufficient = value > bal

  return (
    <div className="stack">
      <Closed market={market} />
      <AmountInput label="You pay" value={input} onChange={setInput} symbol={asset.symbol} tokenLabel={asset.symbol} balance={bal} usd={usdOf(value, asset)} error={insufficient} />
      <NeedTokens asset={asset} balance={bal} />
      <div className="result">
        <small>You receive on {date(market.maturity)}</small>
        <strong>{units > 0n ? `${shares(units)} ${ticker(asset.symbol)} shares` : '—'}</strong>
        <span>{units > 0n ? `Worth ${usd(worthToday)} at today's price` : `Shares of ${ticker(asset.symbol)}, delivered at maturity`}</span>
      </div>
      <div className="rows">
        <Row k="Discount to today's price" v={pct(discount)} tone="up" tip="How much less you pay than the shares are worth today. Your price is locked in now." />
        <Row k="Return if held to maturity" v={`${pct(annual)} a year`} tip="Your discount spread over the time to maturity, if the share price stays where it is today. You still gain or lose with the share price." />
        <Row k="Minimum shares" v={units > 0n ? shares(minOut(units, slip)) : '—'} tip="The trade cancels rather than give you fewer shares than this." />
        <Row k={`1 ${asset.symbol}`} v={`${toNum(asset.multiplier).toFixed(4)} shares`} tip={`Each tokenized share has reinvested the dividends it paid before today, so it holds a little more than one ${ticker(asset.symbol)} share.`} />
      </div>
      <Submit
        label={!open ? 'Not available' : insufficient ? `Not enough ${asset.symbol}` : 'Review order'}
        disabled={!open || !q.fresh || insufficient || !book}
        pending={pending}
        onClick={() => setReview(true)}
      />
      <ReviewDialog
        open={review}
        onOpenChange={setReview}
        summary={{
          title: `Buy ${ticker(asset.symbol)} at a discount`,
          symbol: asset.symbol,
          pay: <>{amount(value)} {asset.symbol}<small>{usdOf(value, asset)}</small></>,
          getLabel: `You receive on ${date(market.maturity)}`,
          get: <>{shares(units)} shares<small>worth {usd(worthToday)} today</small></>,
          rows: [
            { k: "Discount to today's price", v: pct(discount), tone: 'up' },
            { k: 'Return if held to maturity', v: `${pct(annual)} a year` },
            { k: 'Minimum shares', v: shares(minOut(units, slip)) },
            { k: 'Price protection', v: `${Number(slip) / 100}%` },
          ],
          note: `You'll hold a share token until ${date(market.maturity)}, then redeem it for the shares.`,
          confirm: 'Confirm purchase',
          done: { title: 'Purchase complete', body: <>You'll receive {shares(units)} {ticker(asset.symbol)} shares on {date(market.maturity)}. Your share token is in your portfolio.</> },
        }}
        onConfirm={async () => {
          const h = await run(
            `Buy ${ticker(asset.symbol)} at a discount`,
            [{ address: book!.router, abi: abis.XeroRouter, functionName: 'buyPrincipal', args: [market.vault, market.market, value, minOut(units, slip), ACCOUNT], label: 'Buy at a discount' }],
            [{ token: asset.token, spender: book!.router, amount: value, symbol: asset.symbol }],
          )
          if (h) setInput('')
          return h
        }}
      />
      <p className="hint">
        Until {date(market.maturity)} you hold a share token, then you redeem it for the shares. You skip the dividends paid until then;
        that is where the discount comes from.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ Dividends upfront

export function UpfrontForm({ asset, market, slip }: { asset: Asset; market: Market; slip: bigint }) {
  const [input, setInput] = useState('')
  const [review, setReview] = useState(false)
  const value = parse(useDeferredValue(input))
  const bal = useBalance(asset.token)
  const { run, pending } = useTx()
  const open = market.live && !market.frozen && !market.halted
  const q = useQuote(['upfront', market.vault, value.toString()], open && value > 0n, async () => {
    const units = await read<bigint>(market.vault, abis.XeroVault, 'previewStrip', [value])
    const [paid] = await read<readonly [bigint, bigint]>(market.market, abis.XeroYieldMarket, 'quoteYtForQuote', [units])
    return { units, paid }
  })
  const paid = q.data?.paid ?? 0n
  const share = value > 0n && paid > 0n ? toNum(paid) / toNum(value) : market.ptDiscountPct / 100
  const years = toNum(market.tau)
  const insufficient = value > bal

  return (
    <div className="stack">
      <Closed market={market} />
      <AmountInput label="Shares you hold" value={input} onChange={setInput} symbol={asset.symbol} tokenLabel={asset.symbol} balance={bal} usd={usdOf(value, asset)} error={insufficient} />
      <NeedTokens asset={asset} balance={bal} />
      <div className="result is-gold">
        <small>Paid to you today</small>
        <strong>{paid > 0n ? usdOf(paid, asset) ?? `${amount(paid)} ${asset.symbol}` : '—'}</strong>
        <span>{paid > 0n ? `${amount(paid)} ${asset.symbol}, yours to keep or sell` : `Paid in ${asset.symbol}, straight to your wallet`}</span>
      </div>
      <div className="rows">
        <Row k="Your shares back on" v={date(market.maturity)} tip="Your shares stay in the Xero vault until then and return in full. You still gain or lose with the share price." />
        <Row k="Shares returned" v={q.data ? shares(q.data.units) : '—'} />
        <Row k="Upfront payout" v={`${pct(share)} of your position`} tone="gold" tip="The market's price today for every dividend these shares would pay until maturity." />
        <Row k="Per year" v={years > 0 ? pct(share / years) : '—'} />
        <Row k="Minimum payout" v={paid > 0n ? `${amount(minOut(paid, slip))} ${asset.symbol}` : '—'} />
        <Row k={`1 ${asset.symbol}`} v={`${toNum(asset.multiplier).toFixed(4)} shares`} tip={`Each tokenized share has reinvested the dividends it paid before today, so it holds a little more than one ${ticker(asset.symbol)} share.`} />
      </div>
      <Submit
        gold
        label={!open ? 'Not available' : insufficient ? `Not enough ${asset.symbol}` : 'Review order'}
        disabled={!open || !q.fresh || insufficient || !book}
        pending={pending}
        onClick={() => setReview(true)}
      />
      <ReviewDialog
        open={review}
        onOpenChange={setReview}
        summary={{
          title: `Get ${ticker(asset.symbol)} dividends upfront`,
          symbol: asset.symbol,
          gold: true,
          pay: <>{amount(value)} {asset.symbol}<small>locked until {date(market.maturity)}</small></>,
          getLabel: 'Paid to you today',
          get: <>{usdOf(paid, asset) ?? amount(paid)}<small>{amount(paid)} {asset.symbol}</small></>,
          rows: [
            { k: 'Upfront payout', v: `${pct(share)} of your position`, tone: 'gold' },
            { k: 'Your shares back on', v: date(market.maturity) },
            { k: 'Shares returned', v: q.data ? shares(q.data.units) : '—' },
            { k: 'Minimum payout', v: `${amount(minOut(paid, slip))} ${asset.symbol}` },
            { k: 'Price protection', v: `${Number(slip) / 100}%` },
          ],
          note: 'If dividends turn out higher than expected, the buyer keeps the difference; if lower, you keep your payout.',
          confirm: 'Confirm and get paid',
          done: { title: "You've been paid", body: <>{usdOf(paid, asset) ? `${usdOf(paid, asset)} (${amount(paid)} ${asset.symbol})` : `${amount(paid)} ${asset.symbol}`} is in your wallet. Your {q.data ? shares(q.data.units) : ''} shares come back on {date(market.maturity)}.</> },
        }}
        onConfirm={async () => {
          const h = await run(
            `Get ${ticker(asset.symbol)} dividends upfront`,
            [{ address: book!.router, abi: abis.XeroRouter, functionName: 'stripAndSellYield', args: [market.vault, market.market, value, minOut(paid, slip), ACCOUNT], label: 'Take dividends upfront' }],
            [{ token: asset.token, spender: book!.router, amount: value, symbol: asset.symbol }],
          )
          if (h) setInput('')
          return h
        }}
      />
      <p className="hint">
        You hold a share token until {date(market.maturity)}, then redeem it for your shares. If dividends turn out higher than expected, the
        buyer keeps the difference; if lower, you already have your payout.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ Trade dividend tokens

function DividendsForm({ asset, market, slip }: { asset: Asset; market: Market; slip: bigint }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))
  const stockBal = useBalance(asset.token)
  const ytBal = useBalance(market.yieldToken)
  const { run, pending } = useTx()
  const q = useQuote(['yield', market.market, side, value.toString()], market.live && value > 0n, () =>
    read<readonly [bigint, bigint]>(market.market, abis.XeroYieldMarket, side === 'buy' ? 'quoteQuoteForYt' : 'quoteYtForQuote', [value]),
  )
  const out = q.data?.[0] ?? 0n
  const newYield = q.data ? (q.data[1] * market.dividendIndex) / WAD : market.impliedYield
  const avg = out > 0n && value > 0n ? (side === 'buy' ? (value * WAD) / out : (out * WAD) / value) : 0n
  const impact = avg > 0n && market.ytPrice > 0n ? Math.abs(toNum(avg) / toNum(market.ytPrice) - 1) : 0
  const bal = side === 'buy' ? stockBal : ytBal
  const insufficient = value > bal
  const yt = { symbol: market.ytSymbol, tokenLabel: ytName(market), kind: 'yt' as const }
  const stock = { symbol: asset.symbol, tokenLabel: asset.symbol, kind: 'stock' as const }

  return (
    <div className="stack">
      <div className="seg" role="radiogroup" aria-label="Side">
        <button role="radio" aria-checked={side === 'buy'} className={side === 'buy' ? 'on' : ''} onClick={() => { setSide('buy'); setInput('') }}>Buy dividends</button>
        <button role="radio" aria-checked={side === 'sell'} className={side === 'sell' ? 'on' : ''} onClick={() => { setSide('sell'); setInput('') }}>Sell dividends</button>
      </div>
      <p className="hint">
        {side === 'buy'
          ? `Collect every dividend one ${ticker(asset.symbol)} share pays until ${date(market.maturity)}, for a fraction of the share price. You profit if dividends beat the ${pct(market.impliedYield)} a year the market expects.`
          : 'Sell dividend tokens you hold back to the market.'}
      </p>
      <AmountInput label="You pay" value={input} onChange={setInput} {...(side === 'buy' ? stock : yt)} balance={bal} usd={side === 'buy' ? usdOf(value, asset) : usdOf((value * market.ytPrice) / WAD, asset)} error={insufficient} />
      <AmountInput label="You receive" value={out > 0n ? amount(out) : ''} {...(side === 'buy' ? yt : stock)} readOnly usd={side === 'buy' ? usdOf((out * market.ytPrice) / WAD, asset) : usdOf(out, asset)} />
      {q.isError && <p className="warn">That trade is larger than the market can take right now.</p>}
      <div className="rows">
        <Row k="Expected dividend yield" v={q.data ? <>{pct(market.impliedYield)} → {pct(newYield)}</> : pct(market.impliedYield)}
          tip="The yearly dividend rate the market is pricing in for this maturity. Buying pushes it up; selling pushes it down." />
        <Row k="Price impact" v={value > 0n ? pct(impact) : '—'} tone={impact > 0.01 ? 'down' : undefined} />
        <Row k="Minimum received" v={out > 0n ? amount(minOut(out, slip)) : '—'} />
        <Row k="Pool fee" v="0.3%" tip="Paid to the people providing liquidity." />
      </div>
      <Submit
        label={!market.live ? 'Not available' : insufficient ? 'Not enough balance' : side === 'buy' ? 'Buy dividends' : 'Sell dividends'}
        disabled={!market.live || !q.fresh || insufficient}
        pending={pending}
        onClick={async () => {
          const ok = await run(
            side === 'buy' ? `Buy ${ytName(market)}` : `Sell ${ytName(market)}`,
            [{ address: market.market, abi: abis.XeroYieldMarket, functionName: side === 'buy' ? 'swapExactQuoteForYt' : 'swapExactYtForQuote', args: [value, minOut(out, slip), ACCOUNT], label: side === 'buy' ? 'Buy dividends' : 'Sell dividends' }],
            [{ token: side === 'buy' ? asset.token : market.yieldToken, spender: market.market, amount: value, symbol: side === 'buy' ? asset.symbol : 'dividend tokens' }],
          )
          if (ok) setInput('')
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------------ Redeem, rejoin, claim

function RedeemForm({ asset, market, now }: { asset: Asset; market: Market; now: number }) {
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
          ? `This maturity ended on ${date(market.maturity)}. Each share token now redeems for its ${ticker(asset.symbol)} shares.`
          : `Before ${date(market.maturity)}, you can rejoin a share token and a dividend token to get the share back straight away.`}
      </p>
      <AmountInput label={matured ? 'Share tokens' : 'Pairs to rejoin'} value={input} onChange={setInput} symbol={market.ptSymbol} tokenLabel={ptName(market)} kind="pt" balance={max} error={value > max} />
      <div className="rows">
        <Row k="You receive" v={q.data ? `${amount(q.data)} ${asset.symbol}` : '—'} />
      </div>
      <Submit
        label={value > max ? 'Not enough balance' : matured ? 'Redeem for shares' : 'Rejoin into shares'}
        disabled={!q.fresh || value > max}
        pending={pending}
        onClick={async () => {
          if (await run(matured ? `Redeem ${ptName(market)}` : `Rejoin ${ticker(asset.symbol)}`, [{ address: market.vault, abi: abis.XeroVault, functionName: matured ? 'redeem' : 'recombine', args: [value, ACCOUNT] }])) setInput('')
        }}
      />
      <div className="claim-box">
        <div>
          <span>Dividends earned by your dividend tokens</span>
          <b>{amount(claim.data ?? 0n)} {asset.symbol}</b>
        </div>
        <button className="btn btn-sm" disabled={!claim.data || pending} onClick={() => run(`Claim ${ticker(asset.symbol)} dividends`, [{ address: market.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [ACCOUNT] }])}>
          Claim
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Advanced: split, liquidity

function AdvancedForm({ asset, market }: { asset: Asset; market: Market }) {
  return (
    <div className="stack">
      <Link className="pool-cta" to={`/liquidity?s=${asset.symbol}&m=${market.label}`}>
        <span><b>Earn from liquidity</b><small>Deposit {asset.symbol} in one step and earn the 0.3% trading fee. Your shares stay invested.</small></span>
        <ArrowIcon size={18} />
      </Link>
      <SplitForm asset={asset} market={market} />
    </div>
  )
}

function SplitForm({ asset, market }: { asset: Asset; market: Market }) {
  const [input, setInput] = useState('')
  const value = parse(useDeferredValue(input))
  const bal = useBalance(asset.token)
  const { run, pending } = useTx()
  const q = useQuote(['strip', market.vault, value.toString()], value > 0n, () => read<bigint>(market.vault, abis.XeroVault, 'previewStrip', [value]))
  const open = market.live && !market.frozen && !market.halted
  return (
    <>
      <p className="hint">Split shares into a share token and a dividend token and keep both, for example to provide liquidity. Rejoin them any time before maturity.</p>
      <AmountInput label="Shares to split" value={input} onChange={setInput} symbol={asset.symbol} tokenLabel={asset.symbol} balance={bal} usd={usdOf(value, asset)} error={value > bal} />
      <div className="split-out">
        <div><span>Share tokens</span><b>{q.data ? amount(q.data) : '—'}</b><small>{q.data ? usdOf((q.data * market.ptPrice) / WAD, asset) : ''}</small></div>
        <div className="y"><span>Dividend tokens</span><b>{q.data ? amount(q.data) : '—'}</b><small>{q.data ? usdOf((q.data * market.ytPrice) / WAD, asset) : ''}</small></div>
      </div>
      <div className="rows"><Row k="Split fee" v="0.05%" /></div>
      <Submit
        label={!open ? 'Not available' : value > bal ? 'Not enough balance' : 'Split'}
        disabled={!open || !q.fresh || value > bal}
        pending={pending}
        onClick={async () => {
          if (await run(`Split ${ticker(asset.symbol)}`, [{ address: market.vault, abi: abis.XeroVault, functionName: 'strip', args: [value, ACCOUNT], label: 'Split' }], [{ token: asset.token, spender: market.vault, amount: value, symbol: asset.symbol }])) setInput('')
        }}
      />
    </>
  )
}

// ------------------------------------------------------------------ tabbed ticket (asset page)

export type TicketTab = 'discount' | 'upfront' | 'dividends' | 'redeem' | 'advanced'

export function TradeTicket({ asset, market, now, tab: initial = 'discount' }: { asset: Asset; market: Market; now: number; tab?: TicketTab }) {
  const [tab, setTab] = useState<TicketTab>(initial)
  const [slip, setSlip] = useSlippage()
  const active = market.matured && tab !== 'redeem' && tab !== 'advanced' ? 'redeem' : tab
  return (
    <section className="card ticket">
      <Tabs.Root value={active} onValueChange={(v) => setTab(v as TicketTab)}>
        <Tabs.List className="ticket-tabs" aria-label="What would you like to do?">
          <Tabs.Trigger value="discount" disabled={market.matured}>Discount</Tabs.Trigger>
          <Tabs.Trigger value="upfront" disabled={market.matured}>Upfront</Tabs.Trigger>
          <Tabs.Trigger value="dividends" disabled={market.matured}>Dividends</Tabs.Trigger>
          <Tabs.Trigger value="redeem">Redeem</Tabs.Trigger>
          <Tabs.Trigger value="advanced">More</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="discount"><DiscountForm {...{ asset, market, slip }} /></Tabs.Content>
        <Tabs.Content value="upfront"><UpfrontForm {...{ asset, market, slip }} /></Tabs.Content>
        <Tabs.Content value="dividends"><DividendsForm {...{ asset, market, slip }} /></Tabs.Content>
        <Tabs.Content value="redeem"><RedeemForm {...{ asset, market, now }} /></Tabs.Content>
        <Tabs.Content value="advanced"><AdvancedForm {...{ asset, market }} /></Tabs.Content>
      </Tabs.Root>
      {(active === 'discount' || active === 'upfront' || active === 'dividends') && <SlippagePicker slip={slip} setSlip={setSlip} />}
    </section>
  )
}
