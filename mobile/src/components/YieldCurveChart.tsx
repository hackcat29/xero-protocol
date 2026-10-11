import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Line, Circle, Polyline, Text as SvgText } from 'react-native-svg'
import { THEME } from '../constants/theme'
import { toNum, pct } from '../services/api'
import type { Market } from '../types'

export const YieldCurveChart: React.FC<{
  markets: Market[]
  forwards?: string[]
  height?: number
}> = ({ markets, forwards = [], height = 180 }) => {
  const live = markets.filter((m) => m.live && Number(m.tau) > 0)
  if (live.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No live maturities on yield curve</Text>
      </View>
    )
  }

  const yields = live.map((m) => toNum(m.impliedYield) * 100)
  const minY = Math.max(0, Math.min(...yields) * 0.8)
  const maxY = Math.max(...yields, 5) * 1.25
  const rangeY = maxY - minY || 1

  const width = 310
  const padX = 35
  const padY = 25
  const chartW = width - padX * 2
  const chartH = height - padY * 2

  const points = live.map((m, i) => {
    const x = padX + (i / Math.max(1, live.length - 1)) * chartW
    const yVal = toNum(m.impliedYield) * 100
    const y = padY + chartH - ((yVal - minY) / rangeY) * chartH
    return { x, y, label: m.label, rate: m.impliedYield }
  })

  const polylineStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  return (
    <View style={styles.wrap}>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: THEME.colors.amber }]} />
          <Text style={styles.legendText}>Implied yield curve</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDash, { borderColor: THEME.colors.textMuted }]} />
          <Text style={styles.legendText}>Forward yields</Text>
        </View>
      </View>

      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio, i) => {
          const y = padY + chartH * ratio
          const val = maxY - ratio * rangeY
          return (
            <React.Fragment key={i}>
              <Line
                x1={padX}
                y1={y}
                x2={width - padX + 15}
                y2={y}
                stroke={THEME.colors.cardBorder}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={padX - 8}
                y={y + 4}
                fill={THEME.colors.textSubtle}
                fontSize={9}
                textAnchor="end"
                fontFamily="System"
              >
                {val.toFixed(1)}%
              </SvgText>
            </React.Fragment>
          )
        })}

        {/* Implied Yield Line */}
        <Polyline points={polylineStr} fill="none" stroke={THEME.colors.amber} strokeWidth={3} strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={p.x} cy={p.y} r={5} fill={THEME.colors.amber} />
            <Circle cx={p.x} cy={p.y} r={2} fill="#0B0D10" />
            <SvgText
              x={p.x}
              y={height - 6}
              fill={THEME.colors.textMuted}
              fontSize={10}
              fontWeight="600"
              textAnchor="middle"
              fontFamily="System"
            >
              {p.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.lg,
    padding: THEME.spacing.md,
    marginVertical: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDash: {
    width: 14,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.md,
  },
  emptyText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
})
