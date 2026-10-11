import React from 'react'
import Svg, { Path } from 'react-native-svg'
import { THEME } from '../constants/theme'

export const Mark: React.FC<{ size?: number; principalColor?: string }> = ({
  size = 28,
  principalColor = THEME.colors.text,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        fill={principalColor}
        d="M32 34.97L48.84 51.81A26 26 0 0 1 15.16 51.81ZM29.03 32L12.19 48.84A26 26 0 0 1 12.19 15.16ZM32 29.03L15.16 12.19A26 26 0 0 1 48.84 12.19Z"
      />
      <Path fill={THEME.colors.amber} d="M38.37 32L55.21 15.16A26 26 0 0 1 55.21 48.84Z" />
    </Svg>
  )
}
