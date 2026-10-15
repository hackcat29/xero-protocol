import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { keccak256, toHex, type Address } from 'viem'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { StockMark } from './Brand'
import { WalletButton } from './Nav'
import { BASE_FAUCET_URL, abis, book, isDevnet, publicClient, read } from '../lib/network'
import { company, ticker } from '../lib/assets'
import { useProtocol } from '../lib/protocol'
import { PERSONAS } from '../lib/wagmi'
import { useTx } from '../lib/tx'
import { WAD, parse, toNum, usd } from '../lib/format'

const ACTION = { FORWARD_SPLIT: 2 } as const
const ref = () => keccak256(toHex(`${Date.now()}-${Math.random()}`))

/** Testnet only: claim free test stock, and (for the issuer key) simulate dividends, splits and prices. */
export function TestTokensButton({ label = 'Test tokens', className = 'btn btn-sm btn-gold hide-md' }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className={className}>{label}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <Dialog.Title className="dialog-title">Get test tokens</Dialog.Title>
          <TestTokens />
          <Dialog.Close className="dialog-x" aria-label="Close">×</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function TestTokens() {
  const { data } = useProtocol()
  const { address } = useAccount()
  const { run, pending } = useTx()

  if (!data || !book) return <p className="hint">Loading markets…</p>
  return (
    <div className="console">
      <p className="hint">
        Xero is running on Base Sepolia, a free test network. Claim test versions of each stock (about $100 worth per claim) and try every
        feature with no real money. You also need a little Base Sepolia ETH for gas,{' '}
        <a className="link" href={BASE_FAUCET_URL} target="_blank" rel="noreferrer">free from the Coinbase faucet</a>.
      </p>
      {!address ? (
        <WalletButton block label="Connect wallet to claim" />
      ) : (
        <div className="console-stocks">
          {data.assets.map((a) => (
            <button
              key={a.token}
              disabled={pending}
              onClick={() => run(`Claim test ${ticker(a.symbol)}`, [{ address: a.token, abi: abis.MockStockToken, functionName: 'faucet' }])}
            >
              <StockMark symbol={a.symbol} size={32} />
              <div>
                <b>{ticker(a.symbol)}</b>
                <span>Claim</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <IssuerControls />
    </div>
  )
}

/** Controls for the test issuer key: reinvest a dividend, split, move the price. Hidden for everyone else. */
function IssuerControls() {
  const { data } = useProtocol()
  const { address } = useAccount()
  const { run, pending } = useTx()
  const qc = useQueryClient()
  const [sym, setSym] = useState<string | undefined>()
  const [cash, setCash] = useState('0.50')
  const issuer = (book?.deployer ?? PERSONAS.find((p) => p.issuer)!.address).toLowerCase()
  if (!data || !book || address?.toLowerCase() !== issuer) return null

  const asset = data.assets.find((a) => a.symbol === sym) ?? data.assets[0]
  const feed = book.feeds?.[book.stocks.indexOf(asset.token)]
  const engine = book.engine
  const now = async () => BigInt((await publicClient.getBlock()).timestamp)
  const setFeed = (answer: bigint) =>
    feed && run('Update price feed', [{ address: feed as Address, abi: abis.MockAggregator, functionName: 'setAnswer', args: [answer] }])
  const nudge = async (pct: bigint) => setFeed(((await read<bigint>(feed as Address, abis.MockAggregator, 'answer')) * pct) / 100n)

  async function timeTravel(days: number) {
    const id = toast.loading(`Advancing ${days} days…`)
    try {
      await publicClient.request({ method: 'evm_increaseTime' as never, params: [days * 86400] as never })
      await publicClient.request({ method: 'evm_mine' as never, params: [] as never })
      toast.success(`Advanced ${days} days`, { id })
      await qc.invalidateQueries()
    } catch (e) {
      toast.error('Time travel failed', { id, description: String(e) })
    }
  }

  return (
    <details>
      <summary>Issuer controls</summary>
      <div className="console-grid">
        <div className="seg seg-sm" role="radiogroup" aria-label="Stock">
          {data.assets.map((a) => (
            <button key={a.symbol} role="radio" aria-checked={a.symbol === asset.symbol} className={a.symbol === asset.symbol ? 'on' : ''} onClick={() => setSym(a.symbol)}>
              {ticker(a.symbol)}
            </button>
          ))}
        </div>
        <section>
          <h4>Pay a dividend</h4>
          <p className="hint">Reinvests a cash dividend into {company(asset.symbol)} holders' balances. Dividend-token holders earn it.</p>
          <label className="field">
            Dividend per share (USD)
            <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
          </label>
          <button
            className="btn btn-block"
            disabled={pending || parse(cash) === 0n}
            onClick={() => run(`${ticker(asset.symbol)} pays $${cash}`, [{ address: asset.token, abi: abis.MockStockToken, functionName: 'reinvestDividend', args: [parse(cash), asset.sharePriceUsd] }])}
          >
            Pay ${cash} per share
          </button>
        </section>
        <section>
          <h4>Stock split</h4>
          <button
            className="btn btn-block"
            disabled={pending}
            onClick={async () =>
              run(`${ticker(asset.symbol)} 2-for-1 split`, [
                { address: asset.token, abi: abis.MockStockToken, functionName: 'split', args: [2n, 1n], label: 'Apply split' },
                { address: engine, abi: abis.CorporateActionEngine, functionName: 'report', args: [asset.token, ACTION.FORWARD_SPLIT, await now(), 2n * WAD, WAD, ref()], label: 'Report split' },
              ])
            }
          >
            2-for-1 split, reported
          </button>
          <button className="btn btn-block" disabled={pending} onClick={() => run(`${ticker(asset.symbol)} unreported split`, [{ address: asset.token, abi: abis.MockStockToken, functionName: 'split', args: [2n, 1n] }])}>
            2-for-1 split, unreported (pauses the vault)
          </button>
        </section>
        <section>
          <h4>Price · {usd(asset.sharePriceUsd)} · multiplier {toNum(asset.multiplier).toFixed(4)}</h4>
          <div className="row-btns" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-sm" disabled={pending || !feed} onClick={() => nudge(95n)}>−5%</button>
            <button className="btn btn-sm" disabled={pending || !feed} onClick={() => nudge(105n)}>+5%</button>
            <button
              className="btn btn-sm"
              disabled={pending}
              onClick={async () =>
                run('Refresh all price feeds', await Promise.all((book!.feeds ?? []).map(async (f) => ({ address: f, abi: abis.MockAggregator, functionName: 'setAnswer', args: [await read<bigint>(f, abis.MockAggregator, 'answer')] }))))
              }
            >
              Refresh all feeds
            </button>
          </div>
        </section>
        {isDevnet && (
          <section>
            <h4>Time</h4>
            <div className="row-btns" style={{ justifyContent: 'flex-start' }}>
              {[1, 7, 30, 90].map((d) => <button key={d} className="btn btn-sm" onClick={() => timeTravel(d)}>+{d}d</button>)}
            </div>
          </section>
        )}
      </div>
    </details>
  )
}
