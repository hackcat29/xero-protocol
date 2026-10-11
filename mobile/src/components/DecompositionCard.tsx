import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { THEME } from '../constants/theme'
import { MarketIcon, TokenIcon } from './TokenIcon'
import { toNum, usd, pct, date } from '../services/api'
import type { Asset, Market } from '../types'

export const DecompositionCard: React.FC<{
  asset: Asset
  market: Market
}> = ({ asset, market }) => {
  const px = toNum(asset.priceUsd)
  const ptUsd = toNum(market.ptPrice) * px
  const ytUsd = toNum(market.ytPrice) * px
  const total = ptUsd + ytUsd || 1

  const ptPercent = Math.max(10, Math.min(95, (ptUsd / total) * 100))
  const ytPercent = 100 - ptPercent

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MarketIcon symbol={asset.symbol} size={38} />
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {asset.symbol} · {market.label}
          </Text>
          <Text style={styles.sub}>
            {asset.name} · matures {date(market.maturity)}
          </Text>
        </View>
      </View>

      {/* Visual decomposition bar */}
      <View style={styles.barContainer}>
        <View style={[styles.barPt, { flex: ptPercent }]} />
        <View style={[styles.barYt, { flex: ytPercent }]} />
      </View>

      <View style={styles.rows}>
        <View style={styles.row}>
          <View style={styles.labelGroup}>
            <TokenIcon symbol="PT" kind="pt" size={20} />
            <Text style={styles.rowLabel}>Principal (Shares)</Text>
          </View>
          <Text style={styles.rowVal}>{usd(ptUsd)}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.labelGroup}>
            <TokenIcon symbol="YT" kind="yt" size={20} />
            <Text style={[styles.rowLabel, { color: THEME.colors.amber }]}>Yield (Dividends)</Text>
          </View>
          <Text style={[styles.rowVal, { color: THEME.colors.amber }]}>{usd(ytUsd)}</Text>
        </View>

        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>1 {asset.symbol} unit total</Text>
          <Text style={styles.totalVal}>{usd(total)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footLabel}>Implied dividend yield</Text>
        <Text style={styles.footYield}>{pct(market.impliedYield)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.lg,
    marginVertical: THEME.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  headerText: {
    marginLeft: THEME.spacing.md,
    flex: 1,
  },
  title: {
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  barContainer: {
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.cardElevated,
    flexDirection: 'row',
    overflow: 'hidden',
    marginVertical: THEME.spacing.sm,
  },
  barPt: {
    backgroundColor: THEME.colors.pt,
    height: '100%',
  },
  barYt: {
    backgroundColor: THEME.colors.amber,
    height: '100%',
  },
  rows: {
    marginTop: THEME.spacing.sm,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  rowVal: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.cardBorder,
  },
  totalLabel: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  totalVal: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardElevated,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 10,
    borderRadius: THEME.radii.md,
  },
  footLabel: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  footYield: {
    color: THEME.colors.amber,
    fontSize: 15,
    fontWeight: '800',
  },
})
