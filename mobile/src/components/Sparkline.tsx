import React from 'react'
import Svg, { Polyline } from 'react-native-svg'
import { THEME } from '../constants/theme'

export const Sparkline: React.FC<{
  values: number[]
  width?: number
  height?: number
}> = ({ values, width = 76, height = 24 }) => {
  if (!values || values.length < 2) {
    return <Svg width={width} height={height} />
  }

  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || hi * 0.02 || 1

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 4) + 2
      const y = height - 3 - ((v - lo) / span) * (height - 6)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const isUp = values[values.length - 1] >= values[0]
  const color = isUp ? THEME.colors.green : THEME.colors.red

  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  )
}
