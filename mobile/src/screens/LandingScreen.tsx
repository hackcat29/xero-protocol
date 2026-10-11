import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { THEME } from '../constants/theme'
import { Mark } from '../components/Mark'
import { TokenIcon, MarketIcon } from '../components/TokenIcon'
import { DecompositionCard } from '../components/DecompositionCard'
import { useProtocol } from '../context/ProtocolContext'
import { compactUsd, pct, toNum, usd, date } from '../services/api'
import type { Market, Asset } from '../types'

export const LandingScreen: React.FC<{
  onNavigateToMarkets: () => void
  onSelectMarket: (market: Market) => void
}> = ({ onNavigateToMarkets, onSelectMarket }) => {
  const { protocol } = useProtocol()

  const live = protocol?.markets.filter((m: Market) => m.live) || []
  const featured = live.slice().sort((a: Market, b: Market) => toNum(b.impliedYield) - toNum(a.impliedYield))[0]
  const featuredAsset = featured && protocol?.assets.find((a: Asset) => a.token === featured.token)

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Live on Robinhood Chain</Text>
        </View>
        <Text style={styles.heroTitle}>Keep the stock.</Text>
        <Text style={[styles.heroTitle, styles.heroTitleAccent]}>Trade the dividends.</Text>

        <Text style={styles.heroSub}>
          Robinhood Stock Tokens turn every dividend into more shares. Xero splits each token into a{' '}
          <Text style={{ color: THEME.colors.text, fontWeight: '700' }}>Principal Token</Text> (shares you hold) and a{' '}
          <Text style={{ color: THEME.colors.amber, fontWeight: '700' }}>Yield Token</Text> (dividends they buy).
        </Text>

        <View style={styles.heroBtns}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onNavigateToMarkets} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Explore Markets →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Featured Decomposition Card */}
      {featured && featuredAsset && (
        <View style={styles.section}>
          <DecompositionCard asset={featuredAsset} market={featured} />
        </View>
      )}

      {/* Protocol KPIs */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Value Stripped</Text>
          <Text style={styles.kpiValue}>
            {protocol ? compactUsd(protocol.tvlUsd) : '—'}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Market Liquidity</Text>
          <Text style={styles.kpiValue}>
            {protocol ? compactUsd(protocol.liquidityUsd) : '—'}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Live Markets</Text>
          <Text style={styles.kpiValue}>{live.length}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Top Implied Yield</Text>
          <Text style={[styles.kpiValue, { color: THEME.colors.amber }]}>
            {featured ? pct(featured.impliedYield) : '—'}
          </Text>
        </View>
      </View>

      {/* Product Mechanism */}
      <View style={styles.section}>
        <Text style={styles.eyebrow}>PRODUCT</Text>
        <Text style={styles.sectionTitle}>One Stock Token. Two returns. Fully backed.</Text>
        <Text style={styles.sectionSub}>
          Robinhood Stock Tokens never pay cash. Dividends are reinvested on-chain as a rising multiplier. Xero separates that growth from the shares.
        </Text>

        <View style={styles.steps}>
          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Deposit a Stock Token</Text>
              <Text style={styles.stepBody}>Choose a maturity. Vault holds your tokens in non-custodial smart contracts.</Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Receive PT + YT</Text>
              <Text style={styles.stepBody}>PT is your original share count at maturity. YT accrues every reinvested dividend until then.</Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Trade, Hold or Recombine</Text>
              <Text style={styles.stepBody}>Sell YT to take dividends upfront, buy YT for income without price risk, or recombine PT + YT any time.</Text>
            </View>
          </View>
        </View>

        <View style={styles.formulaBox}>
          <Text style={styles.formulaText}>
            PT redemption = units ÷ I_maturity
            {'\n'}+ YT accrual = units × (1/I_prev − 1/I_now)
            {'\n'}= Stock Token deposited, always.
          </Text>
        </View>
      </View>

      {/* 4 Use Cases */}
      <View style={styles.section}>
        <Text style={styles.eyebrow}>USE CASES</Text>
        <Text style={styles.sectionTitle}>Take a view on dividends, not just prices.</Text>

        <View style={styles.usesGrid}>
          <View style={styles.useCard}>
            <Text style={styles.useTag}>Fix</Text>
            <Text style={styles.useTitle}>Sell dividends today</Text>
            <Text style={styles.useBody}>Keep full share exposure and take up to 2 years of expected dividends upfront in 1 transaction.</Text>
          </View>

          <View style={styles.useCard}>
            <Text style={styles.useTag}>Yield</Text>
            <Text style={styles.useTitle}>Own dividends without price risk</Text>
            <Text style={styles.useBody}>YT pays the reinvested dividends of a stock or ETF until maturity, at a fraction of the share price.</Text>
          </View>

          <View style={styles.useCard}>
            <Text style={styles.useTag}>Curve</Text>
            <Text style={styles.useTitle}>Trade the dividend curve</Text>
            <Text style={styles.useBody}>Maturities at 1W to 2Y form an on-chain implied dividend term structure with implied forwards.</Text>
          </View>

          <View style={styles.useCard}>
            <Text style={styles.useTag}>Pool</Text>
            <Text style={styles.useTitle}>Provide liquidity</Text>
            <Text style={styles.useBody}>Earn 0.3% swap fees plus the dividends of the YT your pool holds. Prices decay smoothly to zero at maturity.</Text>
          </View>
        </View>
      </View>

      {/* Live Markets Teaser */}
      {live.length > 0 && (
        <View style={styles.section}>
          <View style={styles.rowHeader}>
            <View>
              <Text style={styles.eyebrow}>MARKETS</Text>
              <Text style={styles.sectionTitle}>Top Implied Yields</Text>
            </View>
            <TouchableOpacity onPress={onNavigateToMarkets}>
              <Text style={styles.allLink}>All markets →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.marketList}>
            {live.slice(0, 4).map((m: Market) => {
              const asset = protocol?.assets.find((a: Asset) => a.token === m.token)
              return (
                <TouchableOpacity
                  key={m.vault}
                  style={styles.marketItem}
                  onPress={() => onSelectMarket(m)}
                  activeOpacity={0.7}
                >
                  <View style={styles.mktLeft}>
                    <MarketIcon symbol={m.symbol} size={32} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.mktSymbol}>{m.symbol} · {m.label}</Text>
                      <Text style={styles.mktName}>{asset?.name}</Text>
                    </View>
                  </View>
                  <View style={styles.mktRight}>
                    <Text style={styles.mktYield}>{pct(m.impliedYield)}</Text>
                    <Text style={styles.mktDate}>matures {date(m.maturity)}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      )}

      {/* Security */}
      <View style={[styles.section, { marginBottom: 40 }]}>
        <Text style={styles.eyebrow}>SECURITY</Text>
        <Text style={styles.sectionTitle}>Built so the numbers always add up.</Text>

        <View style={styles.safeGrid}>
          <View style={styles.safeItem}>
            <Text style={styles.safeTitle}>Collateralised by construction</Text>
            <Text style={styles.safeBody}>PT claims + YT accruals always equal deposited tokens. Fuzzed across thousands of random sequences.</Text>
          </View>
          <View style={styles.safeItem}>
            <Text style={styles.safeTitle}>Split-aware accounting</Text>
            <Text style={styles.safeBody}>Splits move the same multiplier as dividends. Attested splits are factored out; unexpected jumps freeze the vault.</Text>
          </View>
          <View style={styles.safeItem}>
            <Text style={styles.safeTitle}>Exits never pause</Text>
            <Text style={styles.safeBody}>The guardian can pause new deposits and swaps, but can NEVER block recombination, redemption or claims.</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  hero: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.xl,
    paddingBottom: THEME.spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 178, 41, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 178, 41, 0.3)',
    borderRadius: THEME.radii.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: THEME.spacing.md,
  },
  badgeText: {
    color: THEME.colors.amber,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: THEME.colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroTitleAccent: {
    color: THEME.colors.amber,
  },
  heroSub: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: THEME.spacing.md,
  },
  heroBtns: {
    flexDirection: 'row',
    marginTop: THEME.spacing.lg,
  },
  primaryBtn: {
    backgroundColor: THEME.colors.amber,
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryBtnText: {
    color: '#0B0D10',
    fontSize: 15,
    fontWeight: '800',
  },
  section: {
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.xl,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: THEME.spacing.lg,
    gap: 10,
    marginTop: THEME.spacing.lg,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  kpiLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  kpiValue: {
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  eyebrow: {
    color: THEME.colors.amber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: THEME.colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  sectionSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  steps: {
    marginTop: THEME.spacing.lg,
    gap: 14,
  },
  step: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
    gap: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  stepNumText: {
    color: THEME.colors.amber,
    fontSize: 13,
    fontWeight: '800',
  },
  stepTitle: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  stepBody: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  formulaBox: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.md,
    padding: THEME.spacing.md,
    marginTop: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  formulaText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'System',
  },
  usesGrid: {
    marginTop: THEME.spacing.md,
    gap: 10,
  },
  useCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  useTag: {
    color: THEME.colors.amber,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  useTitle: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  useBody: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: THEME.spacing.md,
  },
  allLink: {
    color: THEME.colors.amber,
    fontSize: 13,
    fontWeight: '700',
  },
  marketList: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    overflow: 'hidden',
  },
  marketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.cardBorder,
  },
  mktLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mktSymbol: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  mktName: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  mktRight: {
    alignItems: 'flex-end',
  },
  mktYield: {
    color: THEME.colors.amber,
    fontSize: 15,
    fontWeight: '800',
  },
  mktDate: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
    marginTop: 2,
  },
  safeGrid: {
    marginTop: THEME.spacing.md,
    gap: 10,
  },
  safeItem: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  safeTitle: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  safeBody: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
})
