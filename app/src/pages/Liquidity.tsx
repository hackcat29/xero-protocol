import * as Tabs from '@radix-ui/react-tabs'
import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAccount } from 'wagmi'
import { AmountInput } from '../components/AmountInput'
import { StockMark } from '../components/Brand'
import { Skeleton, Stat } from '../components/Info'
import { ReviewDialog } from '../components/Review'
import { Closed, NeedTokens, Row, SlippagePicker, Submit, minOut, shares, useBalance, useQuote, usdOf, useSlippage } from '../components/TradeTicket'
import { FLAGSHIP, company, term, ticker } from '../lib/assets'
import { amount, compactUsd, date, parse, pct, toNum, usd } from '../lib/format'
import { abis, book, read } from '../lib/network'
import { usePortfolio, useProtocol, type Asset, type Market, type Position } from '../lib/protocol'
import { ACCOUNT_PLACEHOLDER, useTx } from '../lib/tx'

const ACCOUNT = ACCOUNT_PLACEHOLDER

export function Liquidity() {
  const { data, isLoading } = useProtocol()
  const { address } = useAccount()
  const { data: folio } = usePortfolio(address)
  const [params, setParams] = useSearchParams()
  const [slip, setSlip] = useSlippage()

  const pools = (data?.markets ?? []).filter((m) => m.live)
  const mine = (folio?.positions ?? []).filter((p: Position) => p.lp > 0n)
  const market = pools.find((m) => m.symbol === params.get('s') && m.label === params.get('m')) ?? pools.find((m) => m.symbol === FLAGSHIP && m.label === '1Y') ?? pools[0]
  const asset = data?.assets.find((a) => a.token === market?.token)
  const pick = (m: Market) => setParams({ s: m.symbol, m: m.label }, { replace: true })
  const total = pools.reduce((a, m) => a + m.liquidityUsd, 0)
  const yours = mine.reduce((a, p) => a + p.lpUsd, 0)

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <h1>Liquidity</h1>
          <p className="sub">Put your shares to work. Deposit a stock and it stays fully invested, while earning the 0.3% fee on every trade in its dividend market.</p>
        </div>
        <div className="stats">
          <Stat label="In all pools" value={data ? compactUsd(total) : <Skeleton w={70} h={24} />} sub={data ? `${pools.length} pools` : undefined} />
          <Stat label="Your liquidity" value={address ? (folio ? usd(yours) : <Skeleton w={70} h={24} />) : '—'} sub={address ? `${mine.length} pool${mine.length === 1 ? '' : 's'}` : 'Connect to see yours'} />
        </div>
      </header>

      {isLoading || !data ? (
        <div className="workspace"><Skeleton h={420} /><Skeleton h={520} /></div>
      ) : (
        <div className="workspace">
          <div className="offers-col">
            {mine.length > 0 && (
              <section className="card pool-mine">
                <div className="card-h card-pad" style={{ marginBottom: 0, paddingBottom: 4 }}><h3>Your liquidity</h3></div>
                <ul className="pool-list">
                  {mine.map((p) => (
                    <li key={p.market.vault}>
                      <button className={p.market.vault === market?.vault ? 'on' : ''} onClick={() => pick(p.market)}>
                        <div className="stock"><StockMark symbol={p.market.symbol} size={34} /><div><b>{ticker(p.market.symbol)} · {term(p.market.label)}</b><small>{pct(p.lpShare, 2)} of the pool · matures {date(p.market.maturity)}</small></div></div>
                        <b className="num">{usd(p.lpUsd)}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Pool</th><th>Matures</th><th className="r">Pool size</th><th className="r">Expected dividend yield</th></tr>
                  </thead>
                  <tbody>
                    {pools.map((m) => (
                      <tr key={m.vault} className={`clickable ${m.vault === market?.vault ? 'row-on' : ''}`} onClick={() => pick(m)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && pick(m)}>
                        <td><div className="stock"><StockMark symbol={m.symbol} size={32} /><div><b>{ticker(m.symbol)}</b><small>{company(m.symbol)}</small></div></div></td>
                        <td><b>{date(m.maturity)}</b><small>{term(m.label)}</small></td>
                        <td className="r"><b>{compactUsd(m.liquidityUsd)}</b></td>
                        <td className="r"><b className="gold">{pct(m.impliedYield)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="card explain">
            <h3>How liquidity works</h3>
            <p>Each dividend market has a pool of dividend tokens and shares that people trade against. When you deposit, Xero splits part of your shares so the pool gets dividend tokens and shares in the right mix, and you keep the matching share tokens. Together, that's still all of your shares.</p>
            <p>You earn the 0.3% fee on every trade in the pool, plus the dividends collected by the pool's dividend tokens. Withdraw any time, before or after maturity; before maturity it comes back as shares in one step.</p>
            <p>If the market's dividend expectations move, the pool's mix shifts, which can leave you slightly ahead of or behind simply holding the shares.</p>
          </section>

          <aside>
            {asset && market ? (
              <section className="card ticket">
                <div className="ticket-head">
                  <div className="stock">
                    <StockMark symbol={asset.symbol} size={40} />
                    <div>
                      <h2>{ticker(asset.symbol)} · {term(market.label)} pool</h2>
                      <small className="muted">{company(asset.symbol)} · matures {date(market.maturity)}</small>
                    </div>
                  </div>
                </div>
                <Tabs.Root defaultValue="deposit" key={market.vault}>
                  <Tabs.List className="ticket-tabs" aria-label="Liquidity">
                    <Tabs.Trigger value="deposit" disabled={!market.live}>Deposit</Tabs.Trigger>
                    <Tabs.Trigger value="withdraw">Withdraw</Tabs.Trigger>
                  </Tabs.List>
                  <Tabs.Content value="deposit"><DepositForm asset={asset} market={market} slip={slip} /></Tabs.Content>
                  <Tabs.Content value="withdraw"><WithdrawForm asset={asset} market={market} slip={slip} /></Tabs.Content>
                </Tabs.Root>
                <SlippagePicker slip={slip} setSlip={setSlip} />
              </section>
            ) : (
              <div className="card empty-state"><h3>No open pools</h3></div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function useSupply(market: Market) {
  return useQuery({ queryKey: ['lpSupply', market.market], queryFn: () => read<bigint>(market.market, abis.XeroYieldMarket, 'totalSupply'), refetchInterval: 10_000 })
}

/** Mirrors XeroRouter.addLiquidityFromStock: split x so units(x) : (raw − x) matches the pool's reserves. */
async function quoteDeposit(market: Market, raw: bigint, supply: bigint) {
  const full = await read<bigint>(market.vault, abis.XeroVault, 'previewStrip', [raw])
  const a = raw * market.reserveYt
  const x = (raw * a) / (a + full * market.reserveQuote)
  const units = await read<bigint>(market.vault, abis.XeroVault, 'previewStrip', [x])
  const byYt = (units * supply) / market.reserveYt
  const byQuote = ((raw - x) * supply) / market.reserveQuote
  return { units, lp: byYt < byQuote ? byYt : byQuote, pooled: raw - x }
}

function DepositForm({ asset, market, slip }: { asset: Asset; market: Market; slip: bigint }) {
  const [input, setInput] = useState('')
  const [review, setReview] = useState(false)
  const value = parse(useDeferredValue(input))
  const bal = useBalance(asset.token)
  const supply = useSupply(market)
  const { run, pending } = useTx()
  const open = market.live && !market.frozen && !market.halted
  const q = useQuote(['lp-deposit', market.vault, value.toString(), String(supply.data)], open && value > 0n && !!supply.data, () => quoteDeposit(market, value, supply.data!))
  const share = q.data && supply.data ? toNum(q.data.lp) / (toNum(supply.data) + toNum(q.data.lp)) : 0
  const insufficient = value > bal

  return (
    <div className="stack">
      <Closed market={market} />
      <AmountInput label="Deposit" value={input} onChange={setInput} symbol={asset.symbol} tokenLabel={asset.symbol} balance={bal} usd={usdOf(value, asset)} error={insufficient} />
      <NeedTokens asset={asset} balance={bal} />
      <div className="split-out">
        <div><span>In the pool</span><b>{q.data ? usdOf(q.data.pooled + (q.data.units * market.ytPrice) / 10n ** 18n, asset) : '—'}</b><small>{q.data ? `${pct(share, 3)} of the pool` : 'shares + dividend tokens'}</small></div>
        <div className="y"><span>You keep</span><b>{q.data ? `${shares(q.data.units)} share tokens` : '—'}</b><small>redeem on {date(market.maturity)}</small></div>
      </div>
      <div className="rows">
        <Row k="You earn" v="0.3% of every trade" tip="Your share of the pool's trading fees, plus the dividends its dividend tokens collect." />
        <Row k="Pool size" v={usd(market.liquidityUsd, 0)} />
        <Row k="Minimum pool shares" v={q.data ? amount(minOut(q.data.lp, slip)) : '—'} />
      </div>
      <Submit
        label={!open ? 'Not available' : insufficient ? `Not enough ${asset.symbol}` : 'Review deposit'}
        disabled={!open || !q.fresh || insufficient || !book}
        pending={pending}
        onClick={() => setReview(true)}
      />
      <ReviewDialog
        open={review}
        onOpenChange={setReview}
        summary={{
          title: `Add liquidity to ${ticker(asset.symbol)} · ${term(market.label)}`,
          symbol: asset.symbol,
          pay: <>{amount(value)} {asset.symbol}<small>{usdOf(value, asset)}</small></>,
          getLabel: 'You receive',
          get: <>{pct(share, 3)} of the pool<small>plus {q.data ? shares(q.data.units) : ''} share tokens</small></>,
          rows: [
            { k: 'You earn', v: '0.3% of every trade' },
            { k: 'Share tokens redeem on', v: date(market.maturity) },
            { k: 'Price protection', v: `${Number(slip) / 100}%` },
          ],
          note: 'You can withdraw at any time. Before maturity it comes back as shares in one step.',
          confirm: 'Confirm deposit',
          done: { title: 'Liquidity added', body: <>You now own {pct(share, 3)} of the {ticker(asset.symbol)} {term(market.label)} pool and earn its trading fees.</> },
        }}
        onConfirm={async () => {
          const h = await run(
            `Add ${ticker(asset.symbol)} liquidity`,
            [{ address: book!.router, abi: abis.XeroRouter, functionName: 'addLiquidityFromStock', args: [market.vault, market.market, value, minOut(q.data!.lp, slip), ACCOUNT], label: 'Add liquidity' }],
            [{ token: asset.token, spender: book!.router, amount: value, symbol: asset.symbol }],
          )
          if (h) setInput('')
          return h
        }}
      />
    </div>
  )
}

function WithdrawForm({ asset, market, slip }: { asset: Asset; market: Market; slip: bigint }) {
  const [input, setInput] = useState('')
  const [review, setReview] = useState(false)
  const value = parse(useDeferredValue(input))
  const lpBal = useBalance(market.market)
  const ptBal = useBalance(market.principalToken)
  const supply = useSupply(market)
  const { run, pending } = useTx()
  const asShares = !market.matured // before maturity the router rejoins the pool's dividend tokens with your share tokens
  const q = useQuote(['lp-withdraw', market.vault, value.toString(), String(supply.data), ptBal.toString()], value > 0n && !!supply.data, async () => {
    const ytOut = (value * market.reserveYt) / supply.data!
    const quoteOut = (value * market.reserveQuote) / supply.data!
    const units = asShares ? (ytOut < ptBal ? ytOut : ptBal) : 0n
    const rejoined = units > 0n ? await read<bigint>(market.vault, abis.XeroVault, 'previewRedeem', [units]) : 0n
    return { ytOut, quoteOut, units, raw: rejoined + quoteOut, leftover: ytOut - units }
  })
  const insufficient = value > lpBal
  const label = asShares ? 'You receive' : 'You receive (shares and dividend tokens)'

  return (
    <div className="stack">
      <AmountInput label="Pool shares" value={input} onChange={setInput} symbol="LP" tokenLabel="Pool shares" kind="lp" balance={lpBal} error={insufficient} />
      <div className="result">
        <small>{label}</small>
        <strong>{q.data ? `${amount(q.data.raw)} ${asset.symbol}` : '—'}</strong>
        <span>{q.data ? usdOf(q.data.raw, asset) ?? '' : asShares ? 'Rejoined with your share tokens, paid as shares' : ''}</span>
      </div>
      <div className="rows">
        {q.data && q.data.leftover > 0n && <Row k="Dividend tokens returned" v={amount(q.data.leftover)} tip="You don't hold enough matching share tokens to rejoin these, so they come back as dividend tokens." />}
        <Row k="Share tokens used" v={q.data ? amount(q.data.units) : '—'} tip="Rejoined with the pool's dividend tokens to give you back whole shares." />
        <Row k="Minimum received" v={q.data ? `${amount(minOut(q.data.raw, slip))} ${asset.symbol}` : '—'} />
      </div>
      <Submit
        label={insufficient ? 'Not enough pool shares' : 'Review withdrawal'}
        disabled={value === 0n || !q.fresh || insufficient || !book}
        pending={pending}
        onClick={() => setReview(true)}
      />
      <ReviewDialog
        open={review}
        onOpenChange={setReview}
        summary={{
          title: `Withdraw ${ticker(asset.symbol)} · ${term(market.label)} liquidity`,
          symbol: asset.symbol,
          pay: <>{amount(value)} pool shares</>,
          getLabel: label,
          get: <>{q.data ? amount(q.data.raw) : '—'} {asset.symbol}<small>{q.data ? usdOf(q.data.raw, asset) : ''}</small></>,
          rows: [
            ...(q.data && q.data.leftover > 0n ? [{ k: 'Dividend tokens returned', v: amount(q.data.leftover) }] : []),
            { k: 'Price protection', v: `${Number(slip) / 100}%` },
          ],
          confirm: 'Confirm withdrawal',
          done: { title: 'Liquidity withdrawn', body: <>{q.data ? amount(q.data.raw) : ''} {asset.symbol} is back in your wallet.</> },
        }}
        onConfirm={async () => {
          const d = q.data!
          const h = asShares
            ? await run(
                `Withdraw ${ticker(asset.symbol)} liquidity`,
                [{ address: book!.router, abi: abis.XeroRouter, functionName: 'removeLiquidityToStock', args: [market.vault, market.market, value, minOut(d.raw, slip), ACCOUNT], label: 'Withdraw liquidity' }],
                [
                  { token: market.market, spender: book!.router, amount: value, symbol: 'pool shares' },
                  ...(d.units > 0n ? [{ token: market.principalToken, spender: book!.router, amount: d.units, symbol: 'share tokens' }] : []),
                ],
              )
            : await run(`Withdraw ${ticker(asset.symbol)} liquidity`, [
                { address: market.market, abi: abis.XeroYieldMarket, functionName: 'removeLiquidity', args: [value, minOut(d.ytOut, slip), minOut(d.quoteOut, slip), ACCOUNT], label: 'Withdraw liquidity' },
              ])
          if (h) setInput('')
          return h
        }}
      />
    </div>
  )
}

