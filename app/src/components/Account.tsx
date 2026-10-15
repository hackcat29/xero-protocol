import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useAccount, useBalance, useDisconnect, useSwitchChain } from 'wagmi'
import { ActivityIcon, CheckIcon, ChevronIcon, CopyIcon, ExternalIcon, LogoutIcon, MonitorIcon, MoonIcon, PortfolioIcon, SunIcon } from './icons'
import { chain, explorer } from '../lib/network'
import { prefs, usePrefs, type Theme } from '../lib/prefs'
import { short } from '../lib/format'

/** Close a popover on outside click or Escape. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [ref, open, close])
}

export const avatarColor = (address: string) => `hsl(${parseInt(address.slice(2, 6), 16) % 360} 40% 42%)`

export function AccountButton() {
  const { address, chainId, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: switching } = useSwitchChain()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useDismiss(root, open, () => setOpen(false))

  if (!isConnected || !address) {
    return <button className="btn btn-primary" onClick={openConnectModal}>Connect</button>
  }
  if (chainId !== chain.id) {
    return (
      <button className="btn btn-danger" disabled={switching} onClick={() => switchChain({ chainId: chain.id })}>
        {switching ? 'Switching…' : `Switch to ${chain.name}`}
      </button>
    )
  }
  return (
    <div className="popover-root" ref={root}>
      <button className="btn btn-account" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" style={{ background: avatarColor(address) }} />
        <span className="hide-sm">{short(address)}</span>
        <ChevronIcon size={14} />
      </button>
      {open && <AccountMenu address={address} close={() => setOpen(false)} />}
    </div>
  )
}

function AccountMenu({ address, close }: { address: `0x${string}`; close: () => void }) {
  const { data: eth } = useBalance({ address, query: { refetchInterval: 15_000 } })
  const { disconnect } = useDisconnect()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy the address')
    }
  }
  const ethBalance = eth ? Number(eth.value) / 1e18 : undefined

  return (
    <div className="popover account-menu" role="menu">
      <div className="account-head">
        <span className="avatar avatar-lg" style={{ background: avatarColor(address) }} />
        <div>
          <b>{short(address)}</b>
          <span>{chain.name}</span>
        </div>
        <button className="icon-btn" onClick={copy} aria-label="Copy address" title="Copy address">
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        </button>
      </div>
      <div className="account-balance">
        <span>Gas balance</span>
        <b>{ethBalance === undefined ? '—' : `${ethBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })} ETH`}</b>
      </div>
      <nav className="menu-list">
        <Link to="/portfolio" onClick={close}><PortfolioIcon size={18} />Portfolio</Link>
        <Link to="/activity" onClick={close}><ActivityIcon size={18} />Activity</Link>
        {explorer && (
          <a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" onClick={close}>
            <ExternalIcon size={18} />View on explorer
          </a>
        )}
      </nav>
      <div className="account-theme">
        <span>Theme</span>
        <ThemeSwitch />
      </div>
      <button className="menu-danger" onClick={() => { disconnect(); close() }}>
        <LogoutIcon size={18} />Disconnect
      </button>
    </div>
  )
}

const THEMES: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: 'system', label: 'System', icon: <MonitorIcon size={16} /> },
  { id: 'light', label: 'Light', icon: <SunIcon size={16} /> },
  { id: 'dark', label: 'Dark', icon: <MoonIcon size={16} /> },
]

export function ThemeSwitch() {
  const theme = usePrefs((p) => p.theme)
  return (
    <div className="seg seg-sm seg-icons" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button key={t.id} role="radio" aria-checked={theme === t.id} className={theme === t.id ? 'on' : ''} onClick={() => prefs.setTheme(t.id)} title={t.label} aria-label={t.label}>
          {t.icon}
        </button>
      ))}
    </div>
  )
}
