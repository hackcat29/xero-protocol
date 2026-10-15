import { formatUnits, parseUnits } from 'viem'

export const WAD = 10n ** 18n

export const toNum = (v: bigint, decimals = 18) => Number(formatUnits(v, decimals))

export function num(v: number, dp = 2) {
  return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

/** Token amount with sensible precision for its size. */
export function amount(v: bigint, decimals = 18) {
  const n = toNum(v, decimals)
  if (n === 0) return '0'
  const a = Math.abs(n)
  if (a >= 1000) return num(n, 0)
  if (a >= 1) return num(n, 2)
  if (a >= 0.0001) return num(n, 4)
  return n.toExponential(2)
}

export function usd(v: bigint | number, dp?: number) {
  const n = typeof v === 'bigint' ? toNum(v) : v
  const a = Math.abs(n)
  const d = dp ?? (a > 0 && a < 1 ? 4 : 2)
  return `${n < 0 ? '−' : ''}$${num(a, d)}`
}

export function compactUsd(v: bigint | number) {
  const n = typeof v === 'bigint' ? toNum(v) : v
  return `$${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n)}`
}

/** WAD fraction (0.0326e18) -> "3.26%". */
export function pct(v: bigint | number, dp = 2) {
  const n = typeof v === 'bigint' ? toNum(v) : v
  return `${num(n * 100, dp)}%`
}

export function parse(s: string, decimals = 18): bigint {
  try {
    const t = s.trim().replace(/,/g, '')
    return t === '' || t === '.' ? 0n : parseUnits(t as `${number}`, decimals)
  } catch {
    return 0n
  }
}

export const toInput = (v: bigint, decimals = 18) => {
  const s = formatUnits(v, decimals)
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

export function date(ts: bigint | number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', opts)
}

export function duration(secs: bigint | number) {
  const s = Math.max(0, Number(secs))
  const d = Math.floor(s / 86400)
  if (d >= 365) return `${(d / 365).toFixed(1)}y`
  if (d >= 1) return `${d}d`
  const h = Math.floor(s / 3600)
  return h >= 1 ? `${h}h` : `${Math.floor(s / 60)}m`
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function timeAgo(ts: number, now = Date.now() / 1000) {
  const s = Math.max(0, now - ts)
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function errMsg(e: unknown): string {
  const x = e as { shortMessage?: string; message?: string; details?: string; cause?: { data?: { errorName?: string }; reason?: string } }
  if (x?.cause?.data?.errorName) return humanError(x.cause.data.errorName)
  const m = x?.shortMessage ?? x?.message ?? String(e)
  if (/User rejected|denied/i.test(m)) return 'Transaction rejected in wallet'
  const custom = /reverted with the following reason:\s*(.+)|error (\w+)\(/.exec(m)
  if (custom) return humanError(custom[1] ?? custom[2])
  const selector = /signature:\s*(0x[0-9a-f]{8})/i.exec(m + ' ' + (x?.details ?? ''))?.[1]
  if (selector) return SELECTORS[selector.toLowerCase()] ?? 'The network rejected this transaction. Please try again.'
  if (/reverted/i.test(m)) return 'The network rejected this transaction. Please try again.'
  return m.split('\n')[0]
}

const ERRORS: Record<string, string> = {
  Slippage: 'Price moved beyond your slippage tolerance',
  VaultFrozen: 'Vault is paused while a corporate action is attested',
  VaultHaltedForAction: 'Stripping is halted for this asset after a corporate action',
  Matured: 'This market has matured',
  NotMatured: 'Redemption opens at maturity',
  MaturityNotSettled: 'Maturity is being settled; try again shortly',
  Expired: 'Trading has closed for this maturity',
  ProtocolPaused: 'Protocol is paused by the guardian',
  TargetPaused: 'This market is paused by the guardian',
  ZeroAmount: 'Amount is too small',
  MathError: 'Trade size exceeds available liquidity',
  InsufficientOutput: 'Price moved beyond your price protection',
  ERC20InsufficientAllowance: 'Token approval not confirmed yet. Please try again in a moment',
  ERC20InsufficientBalance: 'Not enough balance for this trade',
}
const SELECTORS: Record<string, string> = {
  '0xfb8f41b2': 'Token approval not confirmed yet. Please try again in a moment',
  '0xe450d38c': 'Not enough balance for this trade',
}
const humanError = (name: string) => ERRORS[name] ?? name
