import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { keccak256, toHex, type Address } from 'viem'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { BASE_FAUCET_URL, abis, book, isDevnet, isTestnet, publicClient, read } from '../lib/network'
import { useProtocol } from '../lib/protocol'
import { PERSONAS } from '../lib/wagmi'
import { useTx } from '../lib/tx'
import { WAD, parse, toNum, usd } from '../lib/format'

const ACTION = { CASH_DIVIDEND: 0, FORWARD_SPLIT: 2 } as const
const ref = () => keccak256(toHex(`${Date.now()}-${Math.random()}`))

export function DevConsoleButton() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn btn-ghost btn-sm base-console-trigger" title="Base B20 Demo controls">
          <span className="dot dot-base" />
          <span className="label-wide">Console</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog base-console-dialog" aria-describedby={undefined}>
          <Dialog.Title className="dialog-title">
            <span className="base-tag">BASE</span> {isTestnet ? 'Base Sepolia Console' : 'Base Devnet Console'}
          </Dialog.Title>
          <DevConsole />
          <Dialog.Close className="dialog-x" aria-label="Close">×</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DevConsole() {
  const { data } = useProtocol()
  const { address } = useAccount()
  const { run, pending } = useTx()
  const qc = useQueryClient()
  const [sym, setSym] = useState('NVDAc')
  const [cash, setCash] = useState('0.50')
  const asset = data?.assets.find((a) => a.symbol === sym) ?? data?.assets[0]
  const feed = asset && book?.feeds?.[book.stocks.indexOf(asset.token)]
  const isIssuer = !!address && address.toLowerCase() === (book?.deployer ?? PERSONAS.find((p) => p.issuer)!.address).toLowerCase()

  if (!data || !asset || !book) return <p className="hint">{isTestnet ? 'Connecting to Base Sepolia…' : 'Connecting to Base Devnet…'}</p>
  const engine = book.engine
  const sharePrice = asset.sharePriceUsd

  const now = async () => BigInt((await publicClient.getBlock()).timestamp)

  async function setFeed(answer: bigint) {
    if (!feed) return
    await run('Update Base Chainlink feed', [{ address: feed as Address, abi: abis.MockAggregator, functionName: 'setAnswer', args: [answer] }])
  }

  async function timeTravel(days: number) {
    const id = toast.loading(`Advancing ${days} days on Base…`)
    try {
      await publicClient.request({ method: 'evm_increaseTime' as never, params: [days * 86400] as never })
      await publicClient.request({ method: 'evm_mine' as never, params: [] as never })
      toast.success(`Advanced ${days} days`, { id, description: 'Refreshed Base block timestamp.' })
      await qc.invalidateQueries()
    } catch (e) {
      toast.error('Time travel failed', { id, description: String(e) })
    }
  }

  async function refreshFeeds() {
    if (!book?.feeds) return
    await run(
      'Refresh Base oracle feeds',
      await Promise.all(
        book.feeds.map(async (f) => ({
          address: f,
          abi: abis.MockAggregator,
          functionName: 'setAnswer',
          args: [await read<bigint>(f, abis.MockAggregator, 'answer')],
        })),
      ),
    )
  }

  return (
    <div className="console">
      <div className="console-b20-banner">
        <div>
          <b>Coinbase B20 Tokenized Equities on Base</b>
          <p className="hint">
            B20 standard wraps dividend compounding directly into an escalating <code>uiMultiplier</code>. Use this console to inject cash dividends, test split immunity, and mint test stock tokens.
          </p>
        </div>
        <a className="btn btn-ghost btn-sm" href={BASE_FAUCET_URL} target="_blank" rel="noreferrer">
          Base Sepolia ETH ↗
        </a>
      </div>

      <section className="console-faucet">
        <div>
          <h4>Mint B20 Stock Tokens</h4>
          <p className="hint">Mint 50 {asset.symbol} tokens (~{usd(toNum(asset.priceUsd) * 50)}) to your connected wallet.</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={!address || pending}
          onClick={() => run(`Mint 50 ${asset.symbol}`, [{ address: asset.token, abi: abis.MockStockToken, functionName: 'faucet' }])}
        >
          Mint {asset.symbol}
        </button>
      </section>

      <div className="seg" role="radiogroup" aria-label="Asset">
        {data.assets.map((a) => (
          <button
            key={a.symbol}
            role="radio"
            aria-checked={a.symbol === asset.symbol}
            className={a.symbol === asset.symbol ? 'on' : ''}
            onClick={() => setSym(a.symbol)}
          >
            {a.symbol}
          </button>
        ))}
      </div>

      <div className="console-grid">
        <section>
          <h4>DRIP Dividend Reinvestment</h4>
          <p className="hint">
            Simulate a quarterly cash dividend. Escalates the B20 <code>uiMultiplier</code>: YT holders instantly accrue the yield delta.
          </p>
          <label className="field">
            Cash dividend per share (USD)
            <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
          </label>
          <button
            className="btn btn-primary btn-block"
            disabled={!isIssuer || pending || parse(cash) === 0n}
            onClick={() =>
              run(`${asset.symbol} reinvests $${cash} dividend`, [
                { address: asset.token, abi: abis.MockStockToken, functionName: 'reinvestDividend', args: [parse(cash), sharePrice], label: 'Reinvest dividend' },
              ])
            }
          >
            Reinvest ${cash} dividend
          </button>
        </section>

        <section>
          <h4>Stock Split Attestation</h4>
          <p className="hint">
            Forward splits increase the multiplier. Corporate Action Engine attests splits so dividend index remains invariant.
          </p>
          <button
            className="btn btn-block"
            disabled={!isIssuer || pending}
            onClick={async () =>
              run(`${asset.symbol} 2:1 split (attested)`, [
                { address: asset.token, abi: abis.MockStockToken, functionName: 'split', args: [2n, 1n], label: 'Apply split' },
                { address: engine, abi: abis.CorporateActionEngine, functionName: 'report', args: [asset.token, ACTION.FORWARD_SPLIT, await now(), 2n * WAD, WAD, ref()], label: 'Attest split' },
              ])
            }
          >
            2:1 split + attest
          </button>
          <button
            className="btn btn-block"
            disabled={!isIssuer || pending}
            onClick={() => run(`${asset.symbol} unattested split (vault freeze)`, [{ address: asset.token, abi: abis.MockStockToken, functionName: 'split', args: [2n, 1n] }])}
          >
            2:1 unattested split
          </button>
        </section>

        <section>
          <h4>Base Oracle · {usd(asset.sharePriceUsd)}</h4>
          <div className="row-btns">
            <button className="btn" disabled={!isIssuer || pending || !feed} onClick={async () => setFeed(((await read<bigint>(feed as Address, abis.MockAggregator, 'answer')) * 95n) / 100n)}>−5%</button>
            <button className="btn" disabled={!isIssuer || pending || !feed} onClick={async () => setFeed(((await read<bigint>(feed as Address, abis.MockAggregator, 'answer')) * 105n) / 100n)}>+5%</button>
            <button className="btn" disabled={!isIssuer || pending} onClick={refreshFeeds}>Refresh all</button>
          </div>
          <p className="hint">Current Multiplier: {toNum(asset.multiplier).toFixed(6)}x</p>
        </section>

        {isDevnet && (
          <section>
            <h4>EVM Time Travel</h4>
            <div className="row-btns">
              {[1, 7, 30, 90].map((d) => (
                <button key={d} className="btn" onClick={() => timeTravel(d)}>+{d}d</button>
              ))}
            </div>
            <p className="hint">Base Devnet time: {new Date(data.now * 1000).toLocaleString()}</p>
          </section>
        )}
      </div>
    </div>
  )
}
