import { useEffect, useRef } from 'react'
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts'

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function baseChart(el: HTMLElement): IChartApi {
  return createChart(el, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: css('--muted'),
      fontFamily: 'Geist, system-ui, sans-serif',
      fontSize: 11,
      attributionLogo: true,
    },
    grid: { vertLines: { visible: false }, horzLines: { color: css('--line-soft') } },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.18, bottom: 0.12 } },
    timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
    crosshair: {
      mode: CrosshairMode.Magnet,
      vertLine: { color: css('--line'), labelBackgroundColor: css('--text') },
      horzLine: { color: css('--line'), labelBackgroundColor: css('--text') },
    },
    handleScroll: false,
    handleScale: false,
  })
}

const pctFormat = { type: 'custom' as const, formatter: (v: number) => `${v.toFixed(2)}%`, minMove: 0.0001 }

export type Point = { time: number; value: number }

/** Implied dividend yield by maturity (line with points) and forward yields (steps). */
export function YieldCurveChart({ curve, forwards, height = 260 }: { curve: Point[]; forwards: Point[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || curve.length === 0) return
    const chart = baseChart(ref.current)
    chart.applyOptions({ timeScale: { tickMarkFormatter: (t: number) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) } })
    if (forwards.length) {
      const f = chart.addSeries(LineSeries, {
        color: css('--muted'),
        lineWidth: 1,
        lineStyle: 2,
        lineType: LineType.WithSteps,
        priceFormat: pctFormat,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: 'between dates',
      })
      f.setData(forwards.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })))
    }
    const s = chart.addSeries(LineSeries, {
      color: css('--gold-bright'),
      lineWidth: 3,
      pointMarkersVisible: true,
      pointMarkersRadius: 4,
      priceFormat: pctFormat,
      priceLineVisible: false,
      title: 'expected',
    })
    s.setData(curve.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })))
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [curve, forwards])
  return <div ref={ref} className="chart" style={{ height }} />
}

/** Time series of the implied yield (area). */
export function HistoryChart({ data, height = 260 }: { data: Point[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || data.length === 0) return
    const chart = baseChart(ref.current)
    chart.applyOptions({ timeScale: { timeVisible: true, secondsVisible: false } })
    const amber = css('--gold-bright')
    const s = chart.addSeries(AreaSeries, {
      lineColor: amber,
      lineWidth: 2,
      topColor: 'rgba(245,178,41,0.28)',
      bottomColor: 'rgba(245,178,41,0)',
      priceFormat: pctFormat,
      priceLineVisible: false,
    })
    // lightweight-charts needs strictly increasing times
    const dedup: Point[] = []
    for (const p of [...data].sort((a, b) => a.time - b.time)) {
      if (dedup.length && dedup[dedup.length - 1].time >= p.time) dedup[dedup.length - 1] = { ...p, time: dedup[dedup.length - 1].time }
      else dedup.push(p)
    }
    s.setData(dedup.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })))
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [data])
  return <div ref={ref} className="chart" style={{ height }} />
}

/** Tiny inline trend line for tables. */
export function Sparkline({ values, width = 84, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || hi * 0.02 || 1
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 3 - ((v - lo) / span) * (height - 6)).toFixed(1)}`)
  const up = values[values.length - 1] >= values[0]
  return (
    <svg width={width} height={height} aria-hidden="true" className="sparkline">
      <polyline points={pts.join(' ')} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
