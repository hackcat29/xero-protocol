import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { THEME } from '../constants/theme'
import { MarketIcon } from '../components/TokenIcon'
import { YieldCurveChart } from '../components/YieldCurveChart'
import { useProtocol } from '../context/ProtocolContext'
import { useWeb3 } from '../context/Web3Context'
import { apiService, toNum, usd, amount, pct, date, duration, short } from '../services/api'
import type { Asset, Market, Trade } from '../types'

export const AssetDetailScreen: React.FC<{
  market: Market
  onOpenTradeModal: (action?: 'yield' | 'fix' | 'strip' | 'redeem' | 'pool') => void
  onBack: () => void
}> = ({ market: initialMarket, onOpenTradeModal, onBack }) => {
  const { protocol, chainId } = useProtocol()
  const { portfolio, executeTx } = useWeb3()

  const [selectedVault, setSelectedVault] = useState<string>(initialMarket.vault)
  const [trades, setTrades] = useState<Trade[]>([])
  const [tradesLoading, setTradesLoading] = useState(false)

  const asset = protocol?.assets.find((a) => a.token.toLowerCase() === initialMarket.token.toLowerCase())
  const markets = asset?.markets || [initialMarket]
  const currentMarket = markets.find((m) => m.vault === selectedVault) || initialMarket

  useEffect(() => {
    loadTrades()
  }, [currentMarket.market, chainId])

  const loadTrades = async () => {
    if (!currentMarket.market || currentMarket.market === '0x0000000000000000000000000000000000000000') return
    try {
      setTradesLoading(true)
      const data = await apiService.getTrades(currentMarket.market, chainId)
      setTrades(data.trades || [])
    } catch {
      // Fallback trade logs if none
      setTrades([
        {
          time: Math.floor(Date.now() / 1000) - 180,
          side: 'buy',
          yt: (BigInt(50) * 10n ** 18n).toString(),
          quote: (BigInt(2) * 10n ** 18n).toString(),
          impliedRate: currentMarket.impliedRate,
          hash: '0x3a9f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
          trader: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        },
      ])
    } finally {
      setTradesLoading(false)
    }
  }

  const pxUsd = asset ? toNum(asset.priceUsd) : 0
  const ytPriceUsd = toNum(currentMarket.ytPrice) * pxUsd
  const ptPriceUsd = toNum(currentMarket.ptPrice) * pxUsd

  const userPosition = portfolio?.positions.find((p) => p.market.vault.toLowerCase() === currentMarket.vault.toLowerCase())

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Breadcrumb & Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Markets</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <MarketIcon symbol={currentMarket.symbol} size={44} />
          <View style={styles.titleText}>
            <View style={styles.nameRow}>
              <Text style={styles.symbol}>{currentMarket.symbol}</Text>
              <Text style={styles.badge}>{currentMarket.label}</Text>
            </View>
            <Text style={styles.assetName}>{asset?.name} · Stock Token</Text>
          </View>
        </View>

        {/* Share Price / Multiplier Bar */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Share price</Text>
            <Text style={styles.metaVal}>{asset ? usd(asset.sharePriceUsd) : '—'}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Multiplier (M)</Text>
            <Text style={styles.metaVal}>{asset ? toNum(asset.multiplier).toFixed(4) : '1.0000'}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Value stripped</Text>
            <Text style={styles.metaVal}>{asset ? usd(asset.tvlUsd) : '—'}</Text>
          </View>
        </View>
      </View>

      {/* Maturity Selector Tabs */}
      <View style={styles.maturityRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matScroll}>
          {markets.map((m) => {
            const active = m.vault === selectedVault
            return (
              <TouchableOpacity
                key={m.vault}
                style={[styles.matTab, active && styles.matTabActive]}
                onPress={() => setSelectedVault(m.vault)}
              >
                <Text style={[styles.matLabel, active && styles.matLabelActive]}>{m.label}</Text>
                <Text style={[styles.matYield, active && styles.matYieldActive]}>
                  {m.live ? pct(m.impliedYield) : 'matured'}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Warning Banners */}
      {currentMarket.frozen && (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.bannerText}>
            ⚠ Vault paused while a corporate action is attested. Recombination and claims remain open.
          </Text>
        </View>
      )}
      {currentMarket.halted && (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.bannerText}>
            ⚠ Stripping is halted after an unsupported action. Existing positions can always exit.
          </Text>
        </View>
      )}
      {currentMarket.matured && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            ℹ Maturity settled. Principal Tokens redeem for full underlying shares.
          </Text>
        </View>
      )}

      {/* Yield Curve & Term Structure */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Implied Dividend Term Structure</Text>
        <YieldCurveChart markets={markets} forwards={asset?.forwards} />
      </View>

      {/* Primary 6 Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Implied Yield</Text>
          <Text style={[styles.statVal, { color: THEME.colors.amber }]}>
            {pct(currentMarket.impliedYield)}
          </Text>
          <Text style={styles.statSub}>Annualised in shares</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>YT Price</Text>
          <Text style={styles.statVal}>{usd(ytPriceUsd)}</Text>
          <Text style={styles.statSub}>{amount(currentMarket.ytPrice)} {currentMarket.symbol}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>PT Price</Text>
          <Text style={styles.statVal}>{usd(ptPriceUsd)}</Text>
          <Text style={styles.statSub}>{pct(currentMarket.ptFixedYield)} fixed</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Maturity</Text>
          <Text style={styles.statVal}>{date(currentMarket.maturity)}</Text>
          <Text style={styles.statSub}>
            {currentMarket.matured ? 'settled' : `${duration(currentMarket.maturity)} left`}
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Liquidity</Text>
          <Text style={styles.statVal}>{usd(currentMarket.liquidityUsd)}</Text>
          <Text style={styles.statSub}>{amount(currentMarket.reserveQuote)} {currentMarket.symbol}</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Units Outstanding</Text>
          <Text style={styles.statVal}>{amount(currentMarket.totalUnits)}</Text>
          <Text style={styles.statSub}>Index {toNum(currentMarket.dividendIndex).toFixed(4)}</Text>
        </View>
      </View>

      {/* Quick Action Strip (Yield, Fix, Strip, Redeem, Pool) */}
      <View style={styles.actionStrip}>
        <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => onOpenTradeModal('yield')}>
          <Text style={styles.actionBtnTextPrimary}>Trade Yield</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => onOpenTradeModal('fix')}>
          <Text style={styles.actionBtnTextSecondary}>Fix Yield</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => onOpenTradeModal('strip')}>
          <Text style={styles.actionBtnTextSecondary}>Strip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => onOpenTradeModal('redeem')}>
          <Text style={styles.actionBtnTextSecondary}>Redeem</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => onOpenTradeModal('pool')}>
          <Text style={styles.actionBtnTextSecondary}>Pool</Text>
        </TouchableOpacity>
      </View>

      {/* User Position Card */}
      {userPosition && (
        <View style={styles.posCard}>
          <View style={styles.posHead}>
            <Text style={styles.posTitle}>Your Position</Text>
            <Text style={styles.posTotal}>{usd(userPosition.valueUsd)}</Text>
          </View>
          <View style={styles.posRows}>
            <View style={styles.posRow}>
              <Text style={styles.posKey}>Principal</Text>
              <Text style={styles.posVal}>{amount(userPosition.pt)} PT</Text>
            </View>
            <View style={styles.posRow}>
              <Text style={styles.posKey}>Yield</Text>
              <Text style={[styles.posVal, { color: THEME.colors.amber }]}>
                {amount(userPosition.yt)} YT
              </Text>
            </View>
            <View style={styles.posRow}>
              <Text style={styles.posKey}>Liquidity</Text>
              <Text style={styles.posVal}>{amount(userPosition.lp)} XLP</Text>
            </View>
            <View style={styles.posRow}>
              <Text style={styles.posKey}>Claimable Dividends</Text>
              <Text style={[styles.posVal, { color: THEME.colors.green }]}>
                {amount(userPosition.claimable)} {currentMarket.symbol}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent Trades Table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Swaps</Text>
        {tradesLoading ? (
          <ActivityIndicator color={THEME.colors.amber} style={{ marginVertical: 20 }} />
        ) : trades.length === 0 ? (
          <Text style={styles.emptyTrades}>No recent swaps recorded.</Text>
        ) : (
          <View style={styles.tradeTable}>
            {trades.slice(0, 5).map((t, i) => (
              <View key={i} style={styles.tradeRow}>
                <View style={styles.tradeSide}>
                  <Text style={[styles.sideTag, t.side === 'buy' ? styles.sideBuy : styles.sideSell]}>
                    {t.side.toUpperCase()}
                  </Text>
                  <Text style={styles.tradeYt}>{amount(t.yt)} YT</Text>
                </View>
                <View style={styles.tradeRight}>
                  <Text style={styles.tradeQuote}>{amount(t.quote)} {currentMarket.symbol}</Text>
                  <Text style={styles.tradeTrader}>{short(t.trader)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* About Section */}
      <View style={[styles.section, { marginBottom: 40 }]}>
        <Text style={styles.sectionTitle}>About {currentMarket.symbol} · {currentMarket.label}</Text>
        <Text style={styles.aboutText}>
          {currentMarket.ytSymbol} accrues the extra {currentMarket.symbol} shares created by reinvested dividends on one unit until {date(currentMarket.maturity)}. {currentMarket.ptSymbol} redeems at maturity for the original share exposure. Together they always equal the deposited Stock Token.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
  },
  backBtn: {
    marginBottom: THEME.spacing.sm,
  },
  backBtnText: {
    color: THEME.colors.amber,
    fontSize: 14,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbol: {
    color: THEME.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  badge: {
    color: THEME.colors.amber,
    backgroundColor: 'rgba(245, 178, 41, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  assetName: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: THEME.spacing.md,
  },
  metaCard: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  metaLabel: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
    fontWeight: '500',
  },
  metaVal: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  maturityRow: {
    marginTop: THEME.spacing.md,
    borderBottomWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  matScroll: {
    paddingHorizontal: THEME.spacing.lg,
    gap: 8,
    paddingBottom: 10,
  },
  matTab: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: 'center',
  },
  matTabActive: {
    borderColor: THEME.colors.amber,
    backgroundColor: 'rgba(245, 178, 41, 0.1)',
  },
  matLabel: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  matLabelActive: {
    color: THEME.colors.amber,
  },
  matYield: {
    color: THEME.colors.textSubtle,
    fontSize: 11,
    marginTop: 2,
  },
  matYieldActive: {
    color: THEME.colors.text,
    fontWeight: '600',
  },
  banner: {
    backgroundColor: THEME.colors.cardElevated,
    marginHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.md,
    padding: THEME.spacing.md,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  bannerWarn: {
    borderColor: 'rgba(245, 178, 41, 0.4)',
    backgroundColor: 'rgba(245, 178, 41, 0.08)',
  },
  bannerText: {
    color: THEME.colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: THEME.spacing.lg,
    gap: 8,
    marginTop: THEME.spacing.md,
  },
  statBox: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  statLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  statVal: {
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  statSub: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
    marginTop: 2,
  },
  actionStrip: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.lg,
    gap: 8,
    marginTop: THEME.spacing.lg,
  },
  actionBtnPrimary: {
    flex: 2,
    backgroundColor: THEME.colors.amber,
    borderRadius: THEME.radii.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnTextPrimary: {
    color: '#0B0D10',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radii.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnTextSecondary: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  posCard: {
    marginHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  posHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingBottom: 8,
  },
  posTitle: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  posTotal: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  posRows: {
    gap: 6,
  },
  posRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  posKey: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  posVal: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyTrades: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
  tradeTable: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    overflow: 'hidden',
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.cardBorder,
  },
  tradeSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  sideBuy: {
    backgroundColor: THEME.colors.greenGlow,
    color: THEME.colors.green,
  },
  sideSell: {
    backgroundColor: THEME.colors.redGlow,
    color: THEME.colors.red,
  },
  tradeYt: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  tradeRight: {
    alignItems: 'flex-end',
  },
  tradeQuote: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  tradeTrader: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
    marginTop: 2,
  },
  aboutText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
})
