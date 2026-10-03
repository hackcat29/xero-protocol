import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { keccak256, toHex, type Address } from 'viem'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { ROBINHOOD_FAUCET, abis, book, isDevnet, isRealStock, isTestnet, publicClient, read } from '../lib/network'
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
        <button className="btn btn-ghost btn-sm" title="Demo controls">{isTestnet ? 'Testnet' : 'Devnet'}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <Dialog.Title className="dialog-title">{isTestnet ? 'Testnet console' : 'Devnet console'}</Dialog.Title>
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
  const [sym, setSym] = useState('SCHD')
  const [cash, setCash] = useState('0.27')
  const asset = data?.assets.find((a) => a.symbol === sym) ?? data?.assets[0]
  const feed = asset && book?.feeds?.[book.stocks.indexOf(asset.token)]
  // The deployer is the mock issuer and reporter on both the devnet and the testnet demo.
  const isIssuer = !!address && address.toLowerCase() === (book?.deployer ?? PERSONAS.find((p) => p.issuer)!.address).toLowerCase()
  if (!data || !asset || !book) return <p className="hint">{isTestnet ? 'Waiting for the testnet…' : 'Waiting for the devnet…'}</p>
  const engine = book.engine
  const real = isRealStock(asset.token)

  const now = async () => BigInt((await publicClient.getBlock()).timestamp)
  const sharePrice = asset.sharePriceUsd

  async function setFeed(answer: bigint) {
    if (!feed) return
    await run('Update price feed', [{ address: feed as Address, abi: abis.MockAggregator, functionName: 'setAnswer', args: [answer] }])
  }

  async function timeTravel(days: number) {
    const id = toast.loading(`Advancing ${days} days…`)
    try {
      await publicClient.request({ method: 'evm_increaseTime' as never, params: [days * 86400] as never })
      await publicClient.request({ method: 'evm_mine' as never, params: [] as never })
      toast.success(`Advanced ${days} days`, { id, description: 'Refresh price feeds as the Issuer to keep them fresh.' })
      await qc.invalidateQueries()
    } catch (e) {
      toast.error('Time travel failed', { id, description: String(e) })
    }
  }

  async function refreshFeeds() {
    if (!book?.feeds) return
    await run(
      'Refresh all price feeds',
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
      <p className="hint">
        {real ? (
          <>{asset.symbol} is Robinhood's own testnet Stock Token: it can't be minted and its multiplier moves only when Robinhood moves it. Price updates need the deployer wallet{isIssuer ? ' (connected)' : ''}.</>
        ) : (
          <>Mock ERC-8056 Stock Token with live mainnet prices and multipliers, so dividends and splits can be simulated. Issuer actions need the {isDevnet ? <b>Issuer · devnet</b> : 'deployer'} wallet{isIssuer ? ' (connected)' : ''}.</>
        )}
      </p>
      <section className="console-faucet">
        <div>
          <h4>Test tokens</h4>
          <p className="hint">{real ? `Robinhood's testnet faucet hands out ${asset.symbol}.` : `Claim about $10k of ${asset.symbol} once a day.`}</p>
        </div>
        {real ? (
          <a className="btn btn-primary" href={ROBINHOOD_FAUCET} target="_blank" rel="noreferrer">Robinhood faucet ↗</a>
        ) : (
          <button className="btn btn-primary" disabled={!address || pending} onClick={() => run(`Claim test ${asset.symbol}`, [{ address: asset.token, abi: abis.MockStockToken, functionName: 'faucet' }])}>
            Get {asset.symbol}
          </button>
        )}
      </section>
      <div className="seg" role="radiogroup" aria-label="Asset">
        {data.assets.map((a) => (
          <button key={a.symbol} role="radio" aria-checked={a.symbol === asset.symbol} className={a.symbol === asset.symbol ? 'on' : ''} onClick={() => setSym(a.symbol)}>
            {a.symbol}
          </button>
        ))}
      </div>
      <div className="console-grid">
        {!real && <section>
          <h4>Dividend reinvestment</h4>
          <p className="hint">Robinhood reinvests cash dividends: the token multiplier grows by cash ÷ price. YT holders accrue it.</p>
          <label className="field">
            Cash dividend per share (USD)
            <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
          </label>
          <button
            className="btn btn-primary btn-block"
            disabled={!isIssuer || pending || parse(cash) === 0n}
            onClick={() =>
              run(`${asset.symbol} reinvests $${cash}`, [
                { address: asset.token, abi: abis.MockStockToken, functionName: 'reinvestDividend', args: [parse(cash), sharePrice], label: 'Reinvest dividend' },
              ])
            }
          >
            Pay & reinvest dividend
          </button>
        </section>}
        {!real && <section>
          <h4>Corporate actions</h4>
          <p className="hint">Splits move the same multiplier. Attested splits are filtered out; unattested ones freeze the vault.</p>
          <button
            className="btn btn-block"
            disabled={!isIssuer || pending}
            onClick={async () =>
              run(`${asset.symbol} 2-for-1 split (attested)`, [
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
            onClick={() => run(`${asset.symbol} split without attestation`, [{ address: asset.token, abi: abis.MockStockToken, functionName: 'split', args: [2n, 1n] }])}
          >
            2:1 split, unattested
          </button>
          <button
            className="btn btn-block"
            disabled={!isIssuer || pending}
            onClick={async () =>
              run(`Attest ${asset.symbol} split`, [
                { address: engine, abi: abis.CorporateActionEngine, functionName: 'report', args: [asset.token, ACTION.FORWARD_SPLIT, await now(), 2n * WAD, WAD, ref()] },
              ])
            }
          >
            Attest pending split
          </button>
        </section>}
        <section>
          <h4>Oracle · {usd(asset.sharePriceUsd)}</h4>
          <div className="row-btns">
            <button className="btn" disabled={!isIssuer || pending || !feed} onClick={async () => setFeed(((await read<bigint>(feed as Address, abis.MockAggregator, 'answer')) * 95n) / 100n)}>−5%</button>
            <button className="btn" disabled={!isIssuer || pending || !feed} onClick={async () => setFeed(((await read<bigint>(feed as Address, abis.MockAggregator, 'answer')) * 105n) / 100n)}>+5%</button>
            <button className="btn" disabled={!isIssuer || pending} onClick={refreshFeeds}>Refresh all</button>
          </div>
          <p className="hint">Multiplier {toNum(asset.multiplier).toFixed(6)}</p>
        </section>
        {isDevnet && <section>
          <h4>Time</h4>
          <div className="row-btns">
            {[1, 7, 30, 90].map((d) => (
              <button key={d} className="btn" onClick={() => timeTravel(d)}>+{d}d</button>
            ))}
          </div>
          <p className="hint">Chain time {new Date(data.now * 1000).toLocaleString()}</p>
        </section>}
      </div>
    </div>
  )
}
