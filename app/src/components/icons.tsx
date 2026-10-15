import type { ReactNode, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})
const icon = (paths: ReactNode) => ({ size, ...rest }: P) => <svg {...base(size)} {...rest}>{paths}</svg>

export const HomeIcon = icon(<><path d="M3 9l7-5.5L17 9v7.5a1 1 0 0 1-1 1h-3.5V12h-5v5.5H4a1 1 0 0 1-1-1V9z" /></>)
export const MarketsIcon = icon(<><path d="M3 15l4.5-5 3.5 3L17 6" /><path d="M13 6h4v4" /></>)
export const DiscountIcon = icon(<><path d="M17 10.5L10.5 17 3 9.5V3h6.5L17 10.5z" /><circle cx="6.5" cy="6.5" r="1.2" fill="currentColor" /></>)
export const UpfrontIcon = icon(<><circle cx="10" cy="10" r="7" /><path d="M10 6v8M7 9l3-3 3 3" /></>)
export const PortfolioIcon = icon(<><rect x="3" y="6" width="14" height="11" rx="2" /><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6" /></>)
export const PoolIcon = icon(<><path d="M3 13c1.5 0 1.5-1.5 3.5-1.5S8 13 10 13s2-1.5 3.5-1.5S15 13 17 13" /><path d="M3 16.5c1.5 0 1.5-1.5 3.5-1.5S8 16.5 10 16.5s2-1.5 3.5-1.5 1.5 1.5 3.5 1.5" /><path d="M10 3v6M7.5 6.5L10 9l2.5-2.5" /></>)
export const TradeIcon = icon(<><path d="M4 7h11l-3-3M16 13H5l3 3" /></>)
export const ActivityIcon = icon(<><path d="M3 10h3l2-5 4 10 2-5h3" /></>)
export const SearchIcon = icon(<><circle cx="9" cy="9" r="5.5" /><path d="M13 13l4 4" /></>)
export const DocsIcon = icon(<><path d="M5 2.5h7l3 3v12H5z" /><path d="M12 2.5v3h3M8 10h4M8 13h4" /></>)
export const GiftIcon = icon(<><rect x="3" y="8" width="14" height="9" rx="1.5" /><path d="M2.5 5.5h15V8h-15zM10 5.5V17M10 5.5C8.5 2 5.5 3 6.5 5.5M10 5.5c1.5-3.5 4.5-2.5 3.5 0" /></>)
export const CopyIcon = icon(<><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" /></>)
export const ExternalIcon = icon(<><path d="M11 3h6v6M17 3l-8 8M14 12v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" /></>)
export const LogoutIcon = icon(<><path d="M8 17H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M13 14l4-4-4-4M17 10H8" /></>)
export const SunIcon = icon(<><circle cx="10" cy="10" r="3.5" /><path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.3 4.3l1 1M14.7 14.7l1 1M4.3 15.7l1-1M14.7 5.3l1-1" /></>)
export const MoonIcon = icon(<><path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9z" /></>)
export const MonitorIcon = icon(<><rect x="2.5" y="3.5" width="15" height="10" rx="1.5" /><path d="M7 17h6M10 13.5V17" /></>)
export const ChevronIcon = icon(<><path d="M5 7.5l5 5 5-5" /></>)
export const CheckIcon = icon(<><path d="M4 10.5l4 4 8-9" /></>)
export const CloseIcon = icon(<><path d="M5 5l10 10M15 5L5 15" /></>)
export const ArrowIcon = icon(<><path d="M4 10h12M11 5l5 5-5 5" /></>)
export const ClockIcon = icon(<><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2.5" /></>)

export function StarIcon({ filled, size = 18 }: { filled?: boolean; size?: number }) {
  return (
    <svg {...base(size)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7L10 2.8z" />
    </svg>
  )
}
