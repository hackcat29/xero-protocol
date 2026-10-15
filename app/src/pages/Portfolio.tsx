import { Link } from 'react-router'
import { useAccount } from 'wagmi'
import { StockMark } from '../components/Brand'
import { TestTokensButton } from '../components/DevConsole'
import { Skeleton } from '../components/Info'
import { WalletButton } from '../components/Nav'
import { company, term, ticker } from '../lib/assets'
import { amount, date, toNum, usd } from '../lib/format'
import { abis, isDemo } from '../lib/network'
import { usePortfolio, useProtocol, type Position } from '../lib/protocol'
import { ACCOUNT_PLACEHOLDER, useTx } from '../lib/tx'

export function Portfolio() {
  const { address } = useAccount()
  const { data: protocol } = useProtocol()
  const { data, isLoading } = usePortfolio(address)
  const { run, pending } = useTx()

  if (!address) {
    return (
      <div className="page">
        <div className="card empty-state">
          <h3>Connect a wallet to see your portfolio</h3>
          <p className="sub">Shares you've bought at a discount, dividends you've taken upfront, and anything waiting to be claimed.</p>
          <WalletButton />
        </div>
      </div>
    )
  }

  const claimable = data?.positions.filter((p: Position) => p.claimable > 0n) ?? []
  const redeemable = data?.positions.filter((p: Position) => p.market.matured && p.pt > 0n) ?? []
  const stockValue = protocol && data ? protocol.assets.reduce((a, s) => a + toNum(data.stocks[s.token] ?? 0n) * toNum(s.priceUsd), 0) : 0

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <h1>Portfolio</h1>
          <p className="sub">Everything you hold on Xero.</p>
        </div>
        {claimable.length > 0 && (
          <button
            className="btn btn-gold"
            disabled={pending}
            onClick={() =>
              run('Claim all dividends', claimable.map((p: Position) => ({ address: p.market.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [ACCOUNT_PLACEHOLDER], label: `Claim ${ticker(p.market.symbol)}` })))
            }
          >
            Claim {usd(data!.claimableUsd)} in dividends
          </button>
        )}
      </header>

      <section className="kpis">
        <div><span>Positions on Xero</span><b>{data ? usd(data.valueUsd) : <Skeleton w={90} h={26} />}</b></div>
        <div><span>Dividends to claim</span><b className="gold">{data ? usd(data.claimableUsd) : <Skeleton w={90} h={26} />}</b></div>
        <div><span>Shares in your wallet</span><b>{data ? usd(stockValue) : <Skeleton w={90} h={26} />}</b></div>
        <div><span>Ready to redeem</span><b>{data ? redeemable.length : <Skeleton w={30} h={26} />}</b></div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-h card-pad" style={{ marginBottom: 0, paddingBottom: 6 }}><h3>Positions</h3></div>
        {isLoading || !data ? (
          <div className="card-pad"><Skeleton h={120} /></div>
        ) : data.positions.length === 0 ? (
          <div className="empty-state">
            <p className="sub">Nothing here yet. Buy a stock at a discount or take your dividends upfront to get started.</p>
            <div className="row-btns" style={{ justifyContent: 'center' }}>
              <Link to="/discount" className="btn btn-primary">Buy at a discount</Link>
              <Link to="/upfront" className="btn">Dividends upfront</Link>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th className="r">Shares due</th>
                  <th className="r">Dividend tokens</th>
                  <th className="r">To claim</th>
                  <th className="r">Value today</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.positions.map((p: Position) => (
                  <tr key={p.market.vault}>
                    <td>
                      <div className="stock">
                        <StockMark symbol={p.market.symbol} size={34} />
                        <div>
                          <b>{ticker(p.market.symbol)} · {term(p.market.label)}</b>
                          <small>{p.market.matured ? 'Ended' : 'Matures'} {date(p.market.maturity)}</small>
                        </div>
                      </div>
                    </td>
                    <td className="r">{p.pt > 0n ? amount(p.pt) : '—'}</td>
                    <td className="r gold">{p.yt > 0n ? amount(p.yt) : '—'}</td>
                    <td className="r">{p.claimable > 0n ? `${amount(p.claimable)} ${p.market.symbol}` : '—'}</td>
                    <td className="r"><b>{usd(p.valueUsd)}</b></td>
                    <td className="r">
                      <div className="row-btns">
                        {p.claimable > 0n && (
                          <button className="btn btn-sm" disabled={pending} onClick={() => run(`Claim ${ticker(p.market.symbol)} dividends`, [{ address: p.market.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [ACCOUNT_PLACEHOLDER] }])}>
                            Claim
                          </button>
                        )}
                        <Link className="btn btn-sm btn-ghost" to={`/markets/${p.market.symbol}?m=${p.market.label}${p.market.matured ? '&do=redeem' : ''}`}>
                          {p.market.matured ? 'Redeem' : 'Manage'}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {protocol && data && (
        <section className="card card-pad">
          <div className="card-h">
            <h3>Shares in your wallet</h3>
            {isDemo && <TestTokensButton label="Get test tokens" className="btn btn-sm" />}
          </div>
          <div className="balances">
            {protocol.assets.map((a) => (
              <Link to={`/markets/${a.symbol}`} key={a.token}>
                <StockMark symbol={a.symbol} size={32} />
                <div>
                  <b>{amount(data.stocks[a.token] ?? 0n)} {a.symbol}</b>
                  <span>{company(a.symbol)} · {usd(toNum(data.stocks[a.token] ?? 0n) * toNum(a.priceUsd))}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
