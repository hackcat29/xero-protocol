import { Link } from 'react-router'
import { useAccount } from 'wagmi'
import { Skeleton, Stat } from '../components/Info'
import { WalletButton } from '../components/Nav'
import { MarketIcon, TokenIcon } from '../components/TokenIcon'
import { amount, date, pct, toNum, usd } from '../lib/format'
import { abis } from '../lib/network'
import { usePortfolio, useProtocol } from '../lib/protocol'
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
          <h3>Connect a wallet to see your positions</h3>
          <p className="sub">Principal Tokens, Yield Tokens, liquidity and claimable dividends, in one place.</p>
          <WalletButton />
        </div>
      </div>
    )
  }

  const claimable = data?.positions.filter((p) => p.claimable > 0n) ?? []
  const stockValue = protocol && data ? protocol.assets.reduce((a, s) => a + toNum(data.stocks[s.token] ?? 0n) * toNum(s.priceUsd), 0) : 0

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <h1>Portfolio</h1>
          <p className="sub">Your Xero positions and Stock Token balances.</p>
        </div>
        {claimable.length > 0 && (
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              run(
                'Claim all yield',
                claimable.map((p) => ({ address: p.market.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [ACCOUNT_PLACEHOLDER], label: `Claim ${p.market.id}` })),
              )
            }
          >
            Claim all · {usd(data!.claimableUsd)}
          </button>
        )}
      </header>

      <section className="kpis kpis-page">
        <div className="kpi"><span>Xero positions</span><b>{data ? usd(data.valueUsd) : <Skeleton w={90} h={26} />}</b></div>
        <div className="kpi"><span>Claimable yield</span><b className="amber">{data ? usd(data.claimableUsd) : <Skeleton w={90} h={26} />}</b></div>
        <div className="kpi"><span>Stock Tokens</span><b>{data ? usd(stockValue) : <Skeleton w={90} h={26} />}</b></div>
        <div className="kpi"><span>Open positions</span><b>{data ? data.positions.length : <Skeleton w={30} h={26} />}</b></div>
      </section>

      <section className="card table-card">
        <div className="card-h pad"><h3>Positions</h3></div>
        {isLoading || !data ? (
          <div style={{ padding: 16 }}><Skeleton h={120} /></div>
        ) : data.positions.length === 0 ? (
          <div className="empty-state">
            <p className="sub">No positions yet.</p>
            <Link to="/markets" className="btn btn-primary">Explore markets</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="markets-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th className="num">Principal</th>
                  <th className="num">Yield</th>
                  <th className="num">Liquidity</th>
                  <th className="num">Claimable</th>
                  <th className="num">Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.positions.map((p) => (
                  <tr key={p.market.vault}>
                    <td>
                      <div className="mkt">
                        <MarketIcon symbol={p.market.symbol} size={28} />
                        <div>
                          <b>{p.market.symbol} · {p.market.label}</b>
                          <span>{p.market.matured ? 'Matured' : `${pct(p.market.impliedYield)} implied`} · {date(p.market.maturity)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num">{amount(p.pt)}</td>
                    <td className="num amber">{amount(p.yt)}</td>
                    <td className="num">{p.lp > 0n ? amount(p.lp) : '—'}</td>
                    <td className="num">{p.claimable > 0n ? `${amount(p.claimable)} ${p.market.symbol}` : '—'}</td>
                    <td className="num"><b>{usd(p.valueUsd)}</b></td>
                    <td className="num">
                      <div className="row-btns">
                        {p.claimable > 0n && (
                          <button className="btn btn-sm" disabled={pending} onClick={() => run(`Claim ${p.market.id} yield`, [{ address: p.market.vault, abi: abis.XeroVault, functionName: 'claimYield', args: [ACCOUNT_PLACEHOLDER] }])}>
                            Claim
                          </button>
                        )}
                        <Link className="btn btn-sm btn-ghost" to={`/markets/${p.market.symbol}?m=${p.market.label}`}>Manage</Link>
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
        <section className="card">
          <div className="card-h"><h3>Stock Tokens</h3></div>
          <div className="balances">
            {protocol.assets.map((a) => (
              <Link to={`/markets/${a.symbol}`} className="bal" key={a.token}>
                <TokenIcon symbol={a.symbol} size={28} />
                <div>
                  <b>{amount(data.stocks[a.token] ?? 0n)} {a.symbol}</b>
                  <span>{usd(toNum(data.stocks[a.token] ?? 0n) * toNum(a.priceUsd))}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
