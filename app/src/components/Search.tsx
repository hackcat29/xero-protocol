import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { StockMark } from './Brand'
import { ActivityIcon, ArrowIcon, DiscountIcon, DocsIcon, HomeIcon, MarketsIcon, PortfolioIcon, SearchIcon, UpfrontIcon } from './icons'
import { DOCS_URL } from './Nav'
import { company, ticker } from '../lib/assets'
import { usd } from '../lib/format'
import { useProtocol } from '../lib/protocol'

type Result = { id: string; group: 'Stocks' | 'Go to'; label: string; sub?: string; right?: ReactNode; icon: ReactNode; keywords: string; go: () => void }

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Search button for the top bar; ⌘K / Ctrl+K or "/" opens it from anywhere in the app. */
export function SearchButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        {compact ? (
          <button className="icon-btn icon-btn-lg" aria-label="Search"><SearchIcon /></button>
        ) : (
          <button className="search-trigger">
            <SearchIcon size={18} />
            <span>Search stocks</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="palette" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Palette close={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Palette({ close }: { close: () => void }) {
  const nav = useNavigate()
  const { data } = useProtocol()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const go = (to: string) => () => {
    close()
    if (to.startsWith('http')) window.open(to, '_blank', 'noreferrer')
    else nav(to)
  }

  const all: Result[] = useMemo(() => {
    const stocks: Result[] = (data?.assets ?? []).map((a) => {
      const best = a.markets.filter((m) => m.live).reduce((x, m) => Math.max(x, m.ptDiscountPct), 0)
      return {
        id: a.symbol,
        group: 'Stocks',
        label: ticker(a.symbol),
        sub: company(a.symbol),
        right: <span className="palette-figs"><b>{usd(a.sharePriceUsd)}</b><small className="up">up to {best.toFixed(2)}% off</small></span>,
        icon: <StockMark symbol={a.symbol} size={32} />,
        keywords: `${ticker(a.symbol)} ${company(a.symbol)} ${a.symbol}`.toLowerCase(),
        go: go(`/markets/${a.symbol}`),
      }
    })
    const pages: Result[] = [
      { id: 'home', label: 'Home', icon: <HomeIcon />, to: '/app', k: 'home dashboard overview' },
      { id: 'markets', label: 'Markets', icon: <MarketsIcon />, to: '/markets', k: 'markets prices all stocks' },
      { id: 'discount', label: 'Buy at a discount', icon: <DiscountIcon />, to: '/discount', k: 'buy discount cheap principal' },
      { id: 'upfront', label: 'Dividends upfront', icon: <UpfrontIcon />, to: '/upfront', k: 'sell dividends upfront payout advance' },
      { id: 'portfolio', label: 'Portfolio', icon: <PortfolioIcon />, to: '/portfolio', k: 'portfolio positions holdings redeem claim' },
      { id: 'activity', label: 'Activity', icon: <ActivityIcon />, to: '/activity', k: 'activity history transactions' },
      { id: 'docs', label: 'Documentation', icon: <DocsIcon />, to: DOCS_URL, k: 'docs help guides learn' },
    ].map((p) => ({ id: p.id, group: 'Go to' as const, label: p.label, icon: <span className="palette-icon">{p.icon}</span>, keywords: `${p.label} ${p.k}`.toLowerCase(), go: go(p.to) }))
    return [...stocks, ...pages]
  }, [data])

  const s = q.trim().toLowerCase()
  const results = s ? all.filter((r) => r.keywords.includes(s)) : all
  useEffect(() => setActive(0), [s])

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
        if (e.key === 'Enter' && results[active]) { e.preventDefault(); results[active].go() }
      }}
    >
      <div className="palette-input">
        <SearchIcon size={20} />
        <input autoFocus placeholder="Search stocks or pages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <kbd>Esc</kbd>
      </div>
      <div className="palette-list" role="listbox" aria-label="Results">
        {results.length === 0 && <p className="palette-empty">No results for “{q}”.</p>}
        {(['Stocks', 'Go to'] as const).map((g) => {
          const items = results.filter((r) => r.group === g)
          if (!items.length) return null
          return (
            <div key={g}>
              <div className="palette-group">{g}</div>
              {items.map((r) => {
                const i = results.indexOf(r)
                return (
                  <button
                    key={r.id}
                    role="option"
                    aria-selected={i === active}
                    className={`palette-item ${i === active ? 'on' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={r.go}
                  >
                    {r.icon}
                    <span className="palette-text"><b>{r.label}</b>{r.sub && <small>{r.sub}</small>}</span>
                    {r.right ?? <ArrowIcon size={16} />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
