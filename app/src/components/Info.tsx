import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export function Info({ children, tip }: { children?: ReactNode; tip: ReactNode }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <span className="info" tabIndex={0}>
          {children}
          <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 7.2v4M8 4.8v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6} collisionPadding={12}>
          {tip}
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function Stat({ label, value, sub, tip }: { label: string; value: ReactNode; sub?: ReactNode; tip?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{tip ? <Info tip={tip}>{label}</Info> : label}</div>
      <div className="stat-value">{value}</div>
      {sub !== undefined && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Skeleton({ w = '100%', h = 16 }: { w?: number | string; h?: number }) {
  return <span className="skeleton" style={{ width: w, height: h }} />
}
