import { useSyncExternalStore } from 'react'

/** Per-browser preferences: theme, watchlist, price protection and a log of transactions sent from this app.
 *  Everything degrades to defaults when storage is unavailable (private windows, blocked site data). */

export type Theme = 'system' | 'light' | 'dark'
export type ActivityEntry = { hash: string; title: string; time: number; chainId: number; account: string }
type Prefs = { theme: Theme; watchlist: string[]; slippageBps: number; activity: ActivityEntry[] }

const KEY = 'xero.prefs.v1'
const DEFAULTS: Prefs = { theme: 'system', watchlist: ['MSFTc', 'AAPLc'], slippageBps: 50, activity: [] }

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

let state: Prefs = load()
const listeners = new Set<() => void>()

function set(patch: Partial<Prefs>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function usePrefs<T>(pick: (p: Prefs) => T): T {
  return useSyncExternalStore(subscribe, () => pick(state), () => pick(DEFAULTS))
}

export const prefs = {
  get: () => state,
  setTheme: (theme: Theme) => set({ theme }),
  setSlippage: (slippageBps: number) => set({ slippageBps }),
  toggleWatch: (symbol: string) =>
    set({ watchlist: state.watchlist.includes(symbol) ? state.watchlist.filter((s) => s !== symbol) : [...state.watchlist, symbol] }),
  logActivity: (e: ActivityEntry) => set({ activity: [e, ...state.activity.filter((a) => a.hash !== e.hash)].slice(0, 200) }),
}

// ------------------------------------------------------------------ theme

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined

function applyTheme() {
  const t = state.theme
  if (t === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}
if (typeof document !== 'undefined') {
  applyTheme()
  listeners.add(applyTheme)
}

const subscribeMedia = (l: () => void) => {
  media?.addEventListener('change', l)
  const off = subscribe(l)
  return () => {
    media?.removeEventListener('change', l)
    off()
  }
}

/** The theme actually on screen, following the system when the preference is "system". */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribeMedia,
    () => (state.theme === 'system' ? (media?.matches ? 'dark' : 'light') : state.theme),
    () => 'light',
  )
}
