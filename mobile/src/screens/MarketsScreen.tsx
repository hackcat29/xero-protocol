import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { THEME } from '../constants/theme'
import { MarketIcon } from '../components/TokenIcon'
import { Sparkline } from '../components/Sparkline'
import { DecompositionCard } from '../components/DecompositionCard'
import { useProtocol } from '../context/ProtocolContext'
import { compactUsd, pct, toNum, usd, date, duration } from '../services/api'
import type { Market } from '../types'

const ETFS = new Set(['SCHD', 'SGOV', 'SPY', 'VTI', 'QQQ', 'BND', 'SHY', 'SPMO', 'VOO', 'IWM'])
type Filter = 'all' | 'stocks' | 'etfs'
type SortKey = 'yield' | 'maturity' | 'liquidity' | 'symbol'

export const MarketsScreen: React.FC<{
  onSelectMarket: (market: Market) => void
  onQuickTrade: (market: Market) => void
}> = ({ onSelectMarket, onQuickTrade }) => {
  const { protocol, loading } = useProtocol()
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('yield')
  const [search, setSearch] = useState('')
  const [showMatured, setShowMatured] = useState(false)
  const [showDecomp, setShowDecomp] = useState(false)

  const topYield = useMemo(() => {
    if (!protocol?.markets?.length) return 0
    return Math.max(...protocol.markets.map((m) => toNum(m.impliedYield)))
  }, [protocol])

  const featuredMarket = protocol?.markets[0] || null
  const featuredAsset = featuredMarket
    ? protocol?.assets.find((a) => a.token.toLowerCase() === featuredMarket.token.toLowerCase()) || null
    : null



  const markets = useMemo(() => {
    const all = protocol?.markets || []
    return all.filter((m) => {
      if (!showMatured && !m.live) return false
      if (filter === 'etfs' && !ETFS.has(m.symbol)) return false
      if (filter === 'stocks' && ETFS.has(m.symbol)) return false
      const q = search.trim().toLowerCase()
      if (q && !m.symbol.toLowerCase().includes(q) && !m.assetName.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [protocol, filter, search, showMatured])

  const sortedMarkets = useMemo(() => {
    const list = [...markets]
    list.sort((a, b) => {
      if (sortKey === 'symbol') return a.symbol.localeCompare(b.symbol)
      if (sortKey === 'maturity') return Number(BigInt(a.maturity) - BigInt(b.maturity))
      if (sortKey === 'liquidity') return b.liquidityUsd - a.liquidityUsd
      return toNum(b.impliedYield) - toNum(a.impliedYield)
    })
    return list
  }, [markets, sortKey])

  return (
    <View style={styles.container}>
      {/* Protocol Metrics Ribbon */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>TOTAL STRIPPED</Text>
          <Text style={styles.kpiVal}>{protocol ? compactUsd(protocol.tvlUsd) : '—'}</Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>LIQUIDITY</Text>
          <Text style={styles.kpiVal}>{protocol ? compactUsd(protocol.liquidityUsd) : '—'}</Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>LIVE MARKETS</Text>
          <Text style={styles.kpiVal}>{protocol ? protocol.liveCount : '—'}</Text>
        </View>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiLabel}>TOP YIELD</Text>
          <Text style={[styles.kpiVal, { color: THEME.colors.amber }]}>
            {topYield > 0 ? pct(topYield) : '—'}
          </Text>
        </View>

      </View>


      {/* Yield Decomposition Mechanics Collapsible Banner */}
      {featuredAsset && featuredMarket && (
        <View style={styles.decompWrapper}>
          <TouchableOpacity
            style={styles.decompToggle}
            onPress={() => setShowDecomp((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.decompToggleLeft}>
              <Text style={styles.decompToggleIcon}>⚡</Text>
              <Text style={styles.decompToggleTitle}>
                How Yield Stripping Works (1 Stock = 1 PT + 1 YT)
              </Text>
            </View>
            <Text style={styles.decompToggleArrow}>{showDecomp ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showDecomp && (
            <View style={styles.decompContent}>
              <DecompositionCard asset={featuredAsset} market={featuredMarket} />
            </View>
          )}
        </View>
      )}

      {/* Top Controls */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>

          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search ticker or name"
            placeholderTextColor={THEME.colors.textSubtle}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Chips & Show Matured */}
        <View style={styles.filterRow}>
          <View style={styles.chipGroup}>
            {(['all', 'stocks', 'etfs'] as Filter[]).map((f) => {
              const active = filter === f
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {f === 'all' ? 'All' : f === 'stocks' ? 'Stocks' : 'ETFs'}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={[styles.toggleBtn, showMatured && styles.toggleBtnActive]}
            onPress={() => setShowMatured((v) => !v)}
          >
            <Text style={[styles.toggleText, showMatured && styles.toggleTextActive]}>
              {showMatured ? '✓ Matured' : '+ Matured'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sort Bar */}
        <View style={styles.sortBar}>
          <Text style={styles.sortLabel}>Sort by:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortOptions}>
            {(
              [
                { key: 'yield', label: 'Yield' },
                { key: 'maturity', label: 'Maturity' },
                { key: 'liquidity', label: 'Liquidity' },
                { key: 'symbol', label: 'Ticker' },
              ] as const
            ).map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.sortBtn, sortKey === s.key && styles.sortBtnActive]}
                onPress={() => setSortKey(s.key)}
              >
                <Text style={[styles.sortBtnText, sortKey === s.key && styles.sortBtnTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Markets List */}
      {loading && !protocol ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={THEME.colors.amber} />
          <Text style={styles.loadingText}>Syncing on-chain markets…</Text>
        </View>
      ) : sortedMarkets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matching markets</Text>
          <Text style={styles.emptySub}>Try adjusting search criteria or filter</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {sortedMarkets.map((m) => {
            const asset = protocol?.assets.find((a) => a.token === m.token)
            const px = asset ? toNum(asset.priceUsd) : 0
            const ytUsd = toNum(m.ytPrice) * px
            const ptUsd = toNum(m.ptPrice) * px

            // Mock recent history points for sparkline
            const currentYld = toNum(m.impliedYield) * 100
            const sparkValues = [
              currentYld * 0.94,
              currentYld * 0.97,
              currentYld * 0.95,
              currentYld * 0.99,
              currentYld * 0.98,
              currentYld,
            ]

            return (
              <TouchableOpacity
                key={m.vault}
                style={styles.card}
                onPress={() => onSelectMarket(m)}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <MarketIcon symbol={m.symbol} size={36} />
                    <View style={styles.names}>
                      <View style={styles.symbolRow}>
                        <Text style={styles.symbol}>{m.symbol}</Text>
                        <Text style={styles.labelTag}>{m.label}</Text>
                        {m.frozen && <Text style={styles.warnTag}>FROZEN</Text>}
                        {m.halted && <Text style={styles.warnTag}>HALTED</Text>}
                      </View>
                      <Text style={styles.assetName} numberOfLines={1}>
                        {asset?.name}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.yieldBox}>
                    <Text style={styles.yieldVal}>
                      {m.live ? pct(m.impliedYield) : 'Matured'}
                    </Text>
                    <Text style={styles.yieldLabel}>Implied Yield</Text>
                  </View>
                </View>

                {/* Mid row: prices & sparkline */}
                <View style={styles.cardMid}>
                  <View style={styles.priceCol}>
                    <Text style={styles.priceSub}>YT Price</Text>
                    <Text style={styles.priceMain}>{usd(ytUsd)}</Text>
                  </View>

                  <View style={styles.priceCol}>
                    <Text style={styles.priceSub}>PT Price</Text>
                    <Text style={styles.priceMain}>{usd(ptUsd)}</Text>
                  </View>

                  <View style={styles.sparkCol}>
                    <Sparkline values={sparkValues} width={74} height={24} />
                    <Text style={styles.fixedReturn}>{pct(m.ptFixedYield)} fixed</Text>
                  </View>
                </View>

                {/* Footer: maturity, liquidity, trade button */}
                <View style={styles.cardFoot}>
                  <View style={styles.footMeta}>
                    <Text style={styles.metaItem}>
                      Matures {date(m.maturity)} ({m.matured ? 'settled' : duration(m.maturity)})
                    </Text>

                    <Text style={styles.metaItem}>
                      Liq: {compactUsd(m.liquidityUsd)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.tradeBtn}
                    onPress={() => onQuickTrade(m)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tradeBtnText}>Trade</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  topBar: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.sm,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.cardBorder,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearch: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  chipGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  chipActive: {
    borderColor: THEME.colors.amber,
    backgroundColor: 'rgba(245, 178, 41, 0.1)',
  },
  chipText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: THEME.colors.amber,
    fontWeight: '700',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  toggleBtnActive: {
    borderColor: THEME.colors.text,
    backgroundColor: THEME.colors.cardElevated,
  },
  toggleText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: THEME.colors.text,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  sortLabel: {
    color: THEME.colors.textSubtle,
    fontSize: 11,
    marginRight: 8,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radii.sm,
  },
  sortBtnActive: {
    backgroundColor: 'rgba(245, 178, 41, 0.12)',
  },
  sortBtnText: {
    color: THEME.colors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: THEME.colors.amber,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    padding: THEME.spacing.lg,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  names: {
    marginLeft: 10,
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symbol: {
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  labelTag: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: THEME.colors.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warnTag: {
    color: THEME.colors.amber,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(245, 178, 41, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  assetName: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  yieldBox: {
    alignItems: 'flex-end',
  },
  yieldVal: {
    color: THEME.colors.amber,
    fontSize: 17,
    fontWeight: '800',
  },
  yieldLabel: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
    marginTop: 2,
  },
  cardMid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  priceCol: {
    flex: 1,
  },
  priceSub: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
    fontWeight: '500',
  },
  priceMain: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  sparkCol: {
    alignItems: 'flex-end',
  },
  fixedReturn: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  footMeta: {
    flex: 1,
  },
  metaItem: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  tradeBtn: {
    backgroundColor: THEME.colors.amber,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.radii.md,
  },
  tradeBtnText: {
    color: '#0B0D10',
    fontSize: 12,
    fontWeight: '800',
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.card,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: THEME.radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    justifyContent: 'space-between',
  },
  kpiItem: {
    alignItems: 'center',
    flex: 1,
  },
  kpiLabel: {
    color: THEME.colors.textSubtle,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiVal: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  decompWrapper: {
    marginHorizontal: 16,
    marginBottom: 6,
  },
  decompToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 178, 41, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 178, 41, 0.25)',
    borderRadius: THEME.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  decompToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  decompToggleIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  decompToggleTitle: {
    color: THEME.colors.amber,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  decompToggleArrow: {
    color: THEME.colors.amber,
    fontSize: 10,
    fontWeight: '800',
  },
  decompContent: {
    marginTop: 8,
  },
})

