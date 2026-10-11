import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { THEME } from '../constants/theme'
import { MarketIcon, TokenIcon } from '../components/TokenIcon'
import { useWeb3 } from '../context/Web3Context'
import { useProtocol } from '../context/ProtocolContext'
import { usd, amount, pct, date, toNum } from '../services/api'
import type { Market } from '../types'

export const PortfolioScreen: React.FC<{
  onSelectMarket: (market: Market) => void
  onClaimMarket: (vault: string, symbol: string) => void
}> = ({ onSelectMarket, onClaimMarket }) => {
  const { portfolio, portfolioLoading, executeTx } = useWeb3()
  const { protocol, showToast } = useProtocol()

  const handleClaimAll = async () => {
    if (!portfolio || portfolio.positions.length === 0) return
    const claimable = portfolio.positions.filter((p) => toNum(p.claimable) > 0)
    if (claimable.length === 0) {
      showToast('No accrued dividends to claim')
      return
    }

    const steps = claimable.map((p) => `Claim ${p.market.symbol} ${p.market.label} yield`)
    const success = await executeTx('Claim All Accrued Yield', steps)
    if (success) {
      showToast('All dividends claimed successfully!')
    }
  }

  const stockValue = protocol && portfolio
    ? protocol.assets.reduce((sum, a) => {
        const bal = toNum(portfolio.stocks[a.token] || '0')
        const px = toNum(a.priceUsd)
        return sum + bal * px
      }, 0)
    : 0

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Portfolio Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Portfolio</Text>
          <Text style={styles.sub}>Your Xero positions and Stock Token balances.</Text>
        </View>

        {portfolio && portfolio.claimableUsd > 0 && (
          <TouchableOpacity style={styles.claimAllBtn} onPress={handleClaimAll} activeOpacity={0.8}>
            <Text style={styles.claimAllBtnText}>
              Claim All · {usd(portfolio.claimableUsd)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Xero Positions</Text>
          <Text style={styles.kpiVal}>{portfolio ? usd(portfolio.valueUsd) : '—'}</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Claimable Yield</Text>
          <Text style={[styles.kpiVal, { color: THEME.colors.amber }]}>
            {portfolio ? usd(portfolio.claimableUsd) : '—'}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Stock Tokens</Text>
          <Text style={styles.kpiVal}>{portfolio ? usd(stockValue) : '—'}</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Open Positions</Text>
          <Text style={styles.kpiVal}>{portfolio ? portfolio.positions.length : 0}</Text>
        </View>
      </View>

      {/* Open Positions List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Open Positions</Text>

        {portfolioLoading && !portfolio ? (
          <ActivityIndicator color={THEME.colors.amber} style={{ marginVertical: 30 }} />
        ) : !portfolio || portfolio.positions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No open Xero positions</Text>
            <Text style={styles.emptySub}>
              Strip a Stock Token or buy Yield Tokens from the markets tab to start earning.
            </Text>
          </View>
        ) : (
          <View style={styles.posList}>
            {portfolio.positions.map((p) => {
              const hasClaim = toNum(p.claimable) > 0
              return (
                <View key={p.market.vault} style={styles.posCard}>
                  <View style={styles.posTop}>
                    <View style={styles.mktLeft}>
                      <MarketIcon symbol={p.market.symbol} size={32} />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.posSymbol}>
                          {p.market.symbol} · {p.market.label}
                        </Text>
                        <Text style={styles.posDate}>
                          Matures {date(p.market.maturity)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.posValTotal}>{usd(p.valueUsd)}</Text>
                  </View>

                  <View style={styles.posGrid}>
                    <View style={styles.posItem}>
                      <Text style={styles.itemKey}>Principal</Text>
                      <Text style={styles.itemVal}>{amount(p.pt)} PT</Text>
                    </View>

                    <View style={styles.posItem}>
                      <Text style={styles.itemKey}>Yield</Text>
                      <Text style={[styles.itemVal, { color: THEME.colors.amber }]}>
                        {amount(p.yt)} YT
                      </Text>
                    </View>

                    <View style={styles.posItem}>
                      <Text style={styles.itemKey}>Liquidity</Text>
                      <Text style={styles.itemVal}>
                        {toNum(p.lp) > 0 ? `${amount(p.lp)} XLP` : '—'}
                      </Text>
                    </View>

                    <View style={styles.posItem}>
                      <Text style={styles.itemKey}>Claimable</Text>
                      <Text style={[styles.itemVal, hasClaim ? { color: THEME.colors.green } : {}]}>
                        {hasClaim ? `${amount(p.claimable)} ${p.market.symbol}` : '—'}
                      </Text>
                    </View>
                  </View>

                  {/* Action buttons */}
                  <View style={styles.posActions}>
                    {hasClaim && (
                      <TouchableOpacity
                        style={styles.claimBtn}
                        onPress={() => onClaimMarket(p.market.vault, p.market.symbol)}
                      >
                        <Text style={styles.claimBtnText}>Claim Yield</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.manageBtn}
                      onPress={() => onSelectMarket(p.market)}
                    >
                      <Text style={styles.manageBtnText}>Manage Market →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* Stock Token Balances */}
      {protocol && (
        <View style={[styles.section, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>Stock Tokens Held</Text>
          <View style={styles.stockList}>
            {protocol.assets.map((a) => {
              const rawBal = portfolio?.stocks[a.token] || '0'
              const balNum = toNum(rawBal)
              const px = toNum(a.priceUsd)
              return (
                <View key={a.token} style={styles.stockItem}>
                  <View style={styles.stockLeft}>
                    <TokenIcon symbol={a.symbol} size={30} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.stockSymbol}>{a.symbol}</Text>
                      <Text style={styles.stockName}>{a.name}</Text>
                    </View>
                  </View>
                  <View style={styles.stockRight}>
                    <Text style={styles.stockBal}>
                      {amount(rawBal)} {a.symbol}
                    </Text>
                    <Text style={styles.stockUsd}>{usd(balNum * px)}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      )}
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
    paddingTop: THEME.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: THEME.colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  sub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  claimAllBtn: {
    backgroundColor: THEME.colors.amber,
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  claimAllBtnText: {
    color: '#0B0D10',
    fontSize: 13,
    fontWeight: '800',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: THEME.spacing.lg,
    gap: 8,
    marginTop: THEME.spacing.lg,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  kpiLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  kpiVal: {
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.xl,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  emptySub: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  posList: {
    gap: 12,
  },
  posCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  posTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingBottom: 10,
  },
  mktLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  posSymbol: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  posDate: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  posValTotal: {
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  posGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  posItem: {
    flex: 1,
  },
  itemKey: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
  },
  itemVal: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  posActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  claimBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: THEME.colors.green,
    borderRadius: THEME.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  claimBtnText: {
    color: THEME.colors.green,
    fontSize: 12,
    fontWeight: '700',
  },
  manageBtn: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  manageBtnText: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  stockList: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    overflow: 'hidden',
  },
  stockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.cardBorder,
  },
  stockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockSymbol: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stockName: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  stockRight: {
    alignItems: 'flex-end',
  },
  stockBal: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  stockUsd: {
    color: THEME.colors.textSubtle,
    fontSize: 11,
    marginTop: 2,
  },
})
