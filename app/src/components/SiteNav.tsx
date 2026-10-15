import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Logo } from './Brand'
import { GitHubIcon, REPO_URL, docsLink } from './Nav'
import { isDemo } from '../lib/network'

/* The marketing header follows the brokerage pattern (Robinhood, Public, Webull, Ondo): it describes the
   company — products, pricing, safety, learning, developers — and leaves trading tasks to the app, which
   is one button away. */

type Item = { label: string; desc?: string; href: string; icon?: ReactNode }
type Menu = { label: string; href?: string; items?: Item[]; footer?: Item }

const icon = { width: 22, height: 22, viewBox: '0 0 22 22', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
const I = {
  tag: <svg {...icon}><path d="M19 11.5L11.5 19 3 10.5V3h7.5L19 11.5z" /><circle cx="7" cy="7" r="1.3" fill="currentColor" /></svg>,
  upfront: <svg {...icon}><circle cx="11" cy="11" r="8" /><path d="M11 6.5v9M7.5 10l3.5-3.5 3.5 3.5" /></svg>,
  stream: <svg {...icon}><path d="M3 15c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4" /><path d="M3 8c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3" /></svg>,
  pool: <svg {...icon}><path d="M4 8h14l-1.5 9h-11L4 8z" /><path d="M8 8V6a3 3 0 0 1 6 0v2" /></svg>,
  split: <svg {...icon}><circle cx="11" cy="11" r="8" /><path d="M11 3v16M11 11l5.5-5.5" /></svg>,
  faq: <svg {...icon}><circle cx="11" cy="11" r="8" /><path d="M8.8 8.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 1.9-2.2 3.3M11 15.5v.01" /></svg>,
  book: <svg {...icon}><path d="M4 4.5h5a2 2 0 0 1 2 2V18a1.5 1.5 0 0 0-1.5-1.5H4v-12zM18 4.5h-5a2 2 0 0 0-2 2V18a1.5 1.5 0 0 1 1.5-1.5H18v-12z" /></svg>,
  abc: <svg {...icon}><path d="M4 16l3-9 3 9M5 13h4M13 7h3a2 2 0 0 1 0 4h-3V7zm0 4h3.5a2.5 2.5 0 0 1 0 5H13v-5z" /></svg>,
  code: <svg {...icon}><path d="M8 7l-4 4 4 4M14 7l4 4-4 4" /></svg>,
  chain: <svg {...icon}><rect x="3" y="8" width="7" height="6" rx="3" /><rect x="12" y="8" width="7" height="6" rx="3" /><path d="M9 11h4" /></svg>,
  github: <GitHubIcon size={20} />,
}

const MENUS: Menu[] = [
  {
    label: 'Products',
    items: [
      { label: 'Buy at a discount', desc: 'Own stocks for less than the market price', href: '/#discount', icon: I.tag },
      { label: 'Dividends upfront', desc: "Get next year's dividends today, keep your shares", href: '/#upfront', icon: I.upfront },
      { label: 'Dividend trading', desc: "Trade a stock's dividend stream on its own", href: docsLink('guides/trade-dividends'), icon: I.stream },
      { label: 'Liquidity', desc: 'Earn trading fees and dividends', href: docsLink('guides/provide-liquidity'), icon: I.pool },
    ],
    footer: { label: "See today's prices", href: '/markets' },
  },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Security', href: '/security' },
  {
    label: 'Learn',
    items: [
      { label: 'How Xero works', desc: 'One share, two parts', href: '/#split', icon: I.split },
      { label: 'Guides', desc: 'Step-by-step walkthroughs', href: docsLink('quickstart'), icon: I.book },
      { label: 'FAQ', desc: 'Answers to common questions', href: '/#faq', icon: I.faq },
      { label: 'Glossary', desc: 'Every term in plain English', href: docsLink('resources/glossary'), icon: I.abc },
    ],
  },
  {
    label: 'Developers',
    items: [
      { label: 'Documentation', desc: 'Architecture and contract reference', href: docsLink('developers/overview'), icon: I.code },
      { label: 'Contract addresses', desc: 'Deployments on Base', href: docsLink('developers/deployments'), icon: I.chain },
      { label: 'GitHub', desc: 'Source code, tests and scripts', href: REPO_URL, icon: I.github },
    ],
  },
]

const isExternal = (href: string) => /^https?:/.test(href)

function NavItemLink({ item, onNavigate, className }: { item: Item; onNavigate: () => void; className?: string }) {
  const body = (
    <>
      {item.icon && <span className="menu-icon">{item.icon}</span>}
      <span className="menu-text">
        <b>
          {item.label}
          {isExternal(item.href) && <span className="menu-ext" aria-hidden="true">↗</span>}
        </b>
        {item.desc && <small>{item.desc}</small>}
      </span>
    </>
  )
  return isExternal(item.href) ? (
    <a className={className} href={item.href} target="_blank" rel="noreferrer" onClick={onNavigate}>{body}</a>
  ) : (
    <Link className={className} to={item.href} onClick={onNavigate}>{body}</Link>
  )
}

export function SiteNav() {
  const [open, setOpen] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [sheetTop, setSheetTop] = useState(68)
  const root = useRef<HTMLElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const { pathname, hash } = useLocation()

  useEffect(() => {
    setOpen(null)
    setSheet(false)
  }, [pathname, hash])

  useEffect(() => {
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(null)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (setOpen(null), setSheet(false))
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : ''
    return () => void (document.body.style.overflow = '')
  }, [sheet])

  // hover opens on pointer devices; a short delay lets the cursor cross the gap into the panel
  const hover = (label: string | null) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(label), label ? 60 : 160)
  }
  const close = () => setOpen(null)

  return (
    <>
      {isDemo && (
        <div className="announce">
          Xero is live on Base Sepolia with free test tokens. <Link to="/app">Try it</Link>
        </div>
      )}
      <header className="nav nav-site" ref={root}>
        <div className="nav-inner">
          <Logo />
          <nav aria-label="Main">
            <ul className="site-menu">
              {MENUS.map((m) =>
                m.items ? (
                  <li key={m.label} onPointerEnter={(e) => e.pointerType === 'mouse' && hover(m.label)} onPointerLeave={(e) => e.pointerType === 'mouse' && hover(null)}>
                    <button className="menu-trigger" aria-expanded={open === m.label} aria-controls={`menu-${m.label}`} onClick={() => setOpen((o) => (o === m.label ? null : m.label))}>
                      {m.label}
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3.5l3 3 3-3" /></svg>
                    </button>
                    <div id={`menu-${m.label}`} className={`menu-panel ${m.items.length > 3 ? 'menu-wide' : ''}`} hidden={open !== m.label}>
                      <div className="menu-grid">
                        {m.items.map((it) => <NavItemLink key={it.label} item={it} onNavigate={close} className="menu-item" />)}
                      </div>
                      {m.footer && (
                        <Link className="menu-footer" to={m.footer.href} onClick={close}>
                          {m.footer.label} <span aria-hidden="true">→</span>
                        </Link>
                      )}
                    </div>
                  </li>
                ) : (
                  <li key={m.label}>
                    <Link className="menu-trigger" to={m.href!} aria-current={pathname === m.href ? 'page' : undefined}>{m.label}</Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
          <div className="nav-right">
            <a className="icon-link hide-md" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Xero on GitHub" title="GitHub">
              <GitHubIcon />
            </a>
            <Link to="/app" className="btn btn-primary">Open app</Link>
            <button className="menu-toggle" aria-expanded={sheet} aria-controls="site-sheet" aria-label={sheet ? 'Close menu' : 'Open menu'} onClick={() => {
              setSheetTop(root.current?.getBoundingClientRect().bottom ?? 68)
              setSheet((s) => !s)
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                {sheet ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3.5 7h15M3.5 11h15M3.5 15h15" />}
              </svg>
            </button>
          </div>
        </div>

      </header>
      <div id="site-sheet" className="site-sheet" hidden={!sheet} style={{ ['--sheet-top' as string]: `${sheetTop}px` }}>
        {MENUS.map((m) =>
          m.items ? (
            <section key={m.label}>
              <h4>{m.label}</h4>
              {m.items.map((it) => <NavItemLink key={it.label} item={it} onNavigate={() => setSheet(false)} className="sheet-item" />)}
            </section>
          ) : (
            <Link key={m.label} className="sheet-top" to={m.href!} onClick={() => setSheet(false)}>{m.label}</Link>
          ),
        )}
        <Link to="/app" className="btn btn-primary btn-lg btn-block" onClick={() => setSheet(false)}>Open app</Link>
      </div>
    </>
  )
}
