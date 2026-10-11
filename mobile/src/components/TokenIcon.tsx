import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { THEME } from '../constants/theme'

export const TokenIcon: React.FC<{
  symbol: string
  kind?: 'stock' | 'pt' | 'yt' | 'lp'
  size?: number
}> = ({ symbol, kind = 'stock', size = 32 }) => {
  const text = symbol.replace(/^x/, '').split('-')[0].slice(0, 4)

  const borderColor =
    kind === 'yt'
      ? THEME.colors.amber
      : kind === 'pt'
      ? THEME.colors.pt
      : kind === 'lp'
      ? THEME.colors.lp
      : THEME.colors.cardBorder

  const bgColor =
    kind === 'yt'
      ? 'rgba(245, 178, 41, 0.12)'
      : kind === 'pt'
      ? 'rgba(226, 232, 240, 0.10)'
      : THEME.colors.cardElevated

  return (
    <View
      style={[
        styles.icon,
        {
          width: size,
          height: size,
          borderRadius: size * 0.35,
          borderColor,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: size * (text.length > 3 ? 0.26 : 0.32),
            color: kind === 'yt' ? THEME.colors.amber : THEME.colors.text,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

export const MarketIcon: React.FC<{ symbol: string; size?: number }> = ({ symbol, size = 36 }) => {
  return (
    <View style={[styles.marketWrap, { width: size + 10, height: size }]}>
      <TokenIcon symbol={symbol} size={size} />
      <View
        style={[
          styles.ytDot,
          {
            width: size * 0.44,
            height: size * 0.44,
            borderRadius: (size * 0.44) / 2,
            right: 0,
            bottom: 0,
          },
        ]}
      >
        <Text style={[styles.ytDotText, { fontSize: size * 0.2 }]}>Y</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  icon: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    fontFamily: 'System',
    textAlign: 'center',
  },
  marketWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  ytDot: {
    position: 'absolute',
    backgroundColor: THEME.colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.background,
  },
  ytDotText: {
    color: '#0B0D10',
    fontWeight: '800',
  },
})
