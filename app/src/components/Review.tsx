import * as Dialog from '@radix-ui/react-dialog'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Hash } from 'viem'
import { StockMark } from './Brand'
import { CheckIcon, ExternalIcon } from './icons'
import { company, ticker } from '../lib/assets'
import { explorer, isDemo } from '../lib/network'

export type Summary = {
  title: string
  symbol: string
  pay: ReactNode
  get: ReactNode
  getLabel: string
  rows: { k: string; v: ReactNode; tone?: 'up' | 'gold' }[]
  note?: string
  confirm: string
  gold?: boolean
  done: { title: string; body: ReactNode }
}

/** Brokerage-style order review: check the order, sign it, then see a receipt. */
export function ReviewDialog({ open, onOpenChange, summary, onConfirm }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  summary: Summary
  onConfirm: () => Promise<Hash | undefined>
}) {
  const [stage, setStage] = useState<'review' | 'pending' | 'done'>('review')
  const [frozen, setFrozen] = useState<Summary>(summary)
  const [hash, setHash] = useState<Hash>()
  const s = stage === 'review' ? summary : frozen

  const close = (o: boolean) => {
    if (stage === 'pending') return // the wallet prompt is open; keep the sheet until it resolves
    onOpenChange(o)
    if (!o) setTimeout(() => setStage('review'), 200)
  }

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog review" aria-describedby={undefined}>
          {stage === 'done' ? (
            <div className="review-done">
              <span className="done-check"><CheckIcon size={28} /></span>
              <Dialog.Title className="dialog-title">{s.done.title}</Dialog.Title>
              <p className="sub">{s.done.body}</p>
              <div className="review-actions">
                {explorer && hash && (
                  <a className="btn" href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">View transaction <ExternalIcon size={15} /></a>
                )}
                <Link className="btn btn-primary" to="/portfolio" onClick={() => close(false)}>Go to portfolio</Link>
              </div>
              <button className="link-btn" onClick={() => close(false)}>Done</button>
            </div>
          ) : (
            <>
              <Dialog.Title className="dialog-title">{s.title}</Dialog.Title>
              <div className="review-stock">
                <StockMark symbol={s.symbol} size={36} />
                <div><b>{ticker(s.symbol)}</b><small>{company(s.symbol)}</small></div>
              </div>
              <div className="review-flow">
                <div><small>You pay</small><b>{s.pay}</b></div>
                <div className={s.gold ? 'is-gold' : ''}><small>{s.getLabel}</small><b>{s.get}</b></div>
              </div>
              <div className="rows">
                {s.rows.map((r) => (
                  <div className="row" key={r.k}><span>{r.k}</span><b className={r.tone}>{r.v}</b></div>
                ))}
              </div>
              {(s.note || isDemo) && <p className="review-note">{s.note ?? ''}{isDemo ? `${s.note ? ' ' : ''}This is the Base Sepolia test network; tokens have no real value.` : ''}</p>}
              <div className="review-actions">
                <button className="btn btn-lg" disabled={stage === 'pending'} onClick={() => close(false)}>Cancel</button>
                <button
                  className={`btn btn-lg ${s.gold ? 'btn-gold' : 'btn-primary'}`}
                  disabled={stage === 'pending'}
                  onClick={async () => {
                    setFrozen(summary)
                    setStage('pending')
                    const h = await onConfirm()
                    if (h) {
                      setHash(h)
                      setStage('done')
                    } else setStage('review')
                  }}
                >
                  {stage === 'pending' ? 'Confirm in your wallet…' : s.confirm}
                </button>
              </div>
            </>
          )}
          {stage !== 'pending' && <Dialog.Close className="dialog-x" aria-label="Close">×</Dialog.Close>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
