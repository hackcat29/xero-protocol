import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { THEME } from '../constants/theme'
import { useWeb3 } from '../context/Web3Context'
import { useProtocol } from '../context/ProtocolContext'
import { apiService, toNum, usd, amount, pct, date, duration } from '../services/api'
import type { Asset, Market } from '../types'

type TradeAction = 'yield' | 'fix' | 'strip' | 'redeem' | 'pool'

export const TradeTicketModal: React.FC<{
  visible: boolean
  asset: Asset | null
  market: Market | null
  initialAction?: TradeAction
  onClose: () => void
}> = ({ visible, asset, market, initialAction = 'yield', onClose }) => {
  if (!asset || !market) return null

  const { executeTx } = useWeb3()
  const { chainId, showToast } = useProtocol()

  const [action, setAction] = useState<TradeAction>(market.matured ? 'redeem' : initialAction)
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [poolMode, setPoolMode] = useState<'add' | 'remove'>('add')
  const [slip, setSlip] = useState<number>(50) // bps = 0.5%
  const [input, setInput] = useState<string>('1')
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [quoteOut, setQuoteOut] = useState<string>('')
  const [ptUnitsOut, setPtUnitsOut] = useState<string>('')

  const SLIPPAGES = [10, 50, 100]

  useEffect(() => {
    fetchQuote()
  }, [action, side, poolMode, input, market.vault])

  const fetchQuote = async () => {
    const val = parseFloat(input)
    if (isNaN(val) || val <= 0) {
      setQuoteOut('')
      setPtUnitsOut('')
      return
    }

    try {
      setLoadingQuote(true)
      const rawAmt = BigInt(Math.floor(val * 1e6)) * 10n ** 12n

      if (action === 'yield') {
        const q = await apiService.getQuote({
          chainId,
          action: side === 'buy' ? 'yield_buy' : 'yield_sell',
          marketAddress: market.market,
          amount: rawAmt.toString(),
        })
        setQuoteOut(q.out)
      } else if (action === 'fix') {
        const q = await apiService.getQuote({
          chainId,
          action: 'fix',
          vaultAddress: market.vault,
          marketAddress: market.market,
          amount: rawAmt.toString(),
        })
        setQuoteOut(q.upfrontQuote)
        setPtUnitsOut(q.ptUnits)
      } else if (action === 'strip') {
        const q = await apiService.getQuote({
          chainId,
          action: 'strip',
          vaultAddress: market.vault,
          amount: rawAmt.toString(),
        })
        setQuoteOut(q.units)
      } else if (action === 'redeem') {
        const q = await apiService.getQuote({
          chainId,
          action: 'redeem',
          vaultAddress: market.vault,
          amount: rawAmt.toString(),
        })
        setQuoteOut(q.quoteOut)
      } else if (action === 'pool') {
        // Pool math
        setQuoteOut(rawAmt.toString())
      }
    } catch (e) {
      // Fallback local estimation if network error
      const px = toNum(market.ytPrice)
      if (action === 'yield') {
        const est = side === 'buy' ? (px > 0 ? (val / px) * 1e18 : 0) : val * px * 1e18
        setQuoteOut(BigInt(Math.floor(est)).toString())
      } else if (action === 'fix') {
        const estUpfront = val * px * 1e18
        setQuoteOut(BigInt(Math.floor(estUpfront)).toString())
        setPtUnitsOut(BigInt(Math.floor(val * 1e18)).toString())
      } else if (action === 'strip') {
        setQuoteOut(BigInt(Math.floor(val * 1e18)).toString())
      } else if (action === 'redeem') {
        setQuoteOut(BigInt(Math.floor(val * 1e18)).toString())
      }
    } finally {
      setLoadingQuote(false)
    }
  }

  const handleSubmit = async () => {
    let title = ''
    let steps: string[] = []

    if (action === 'yield') {
      title = side === 'buy' ? `Buy ${market.ytSymbol}` : `Sell ${market.ytSymbol}`
      steps = [`Approve ${side === 'buy' ? asset.symbol : market.ytSymbol}`, `Swap on ${asset.symbol} Yield Market`]
    } else if (action === 'fix') {
      title = `Fix ${asset.symbol} Dividends`
      steps = [`Approve ${asset.symbol} for Router`, 'Strip & sell yield upfront']
    } else if (action === 'strip') {
      title = `Strip ${asset.symbol}`
      steps = [`Approve ${asset.symbol}`, `Mint ${market.ptSymbol} + ${market.ytSymbol}`]
    } else if (action === 'redeem') {
      title = market.matured ? `Redeem ${market.ptSymbol}` : `Recombine ${asset.symbol}`
      steps = market.matured
        ? [`Redeem ${market.ptSymbol} for ${asset.symbol} shares`]
        : [`Burn ${market.ptSymbol} + ${market.ytSymbol}`, `Unlock ${asset.symbol}`]
    } else if (action === 'pool') {
      title = poolMode === 'add' ? `Add ${asset.symbol} Liquidity` : `Remove ${asset.symbol} Liquidity`
      steps = poolMode === 'add'
        ? [`Approve ${market.ytSymbol}`, `Approve ${asset.symbol}`, 'Add pool reserves']
        : ['Burn LP tokens', 'Receive reserves']
    }

    onClose()
    const success = await executeTx(title, steps)
    if (success) {
      showToast(`${title} confirmed successfully!`)
    }
  }

  const valNum = parseFloat(input) || 0
  const pxUsd = toNum(asset.priceUsd)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.assetHeader}>
                {asset.symbol} · {market.label}
              </Text>
              <Text style={styles.assetSub}>
                Matures {date(market.maturity)} · {duration(market.maturity)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Action Tabs */}
          <View style={styles.tabBar}>
            {(['yield', 'fix', 'strip', 'redeem', 'pool'] as TradeAction[]).map((tab) => {
              const active = action === tab
              const disabled = market.matured && tab !== 'redeem' && tab !== 'pool'
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, active && styles.tabActive, disabled && styles.tabDisabled]}
                  disabled={disabled}
                  onPress={() => setAction(tab)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {tab.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Sub-modes if applicable */}
            {action === 'yield' && (
              <View style={styles.sideToggle}>
                <TouchableOpacity
                  style={[styles.sideBtn, side === 'buy' && styles.sideBtnBuy]}
                  onPress={() => setSide('buy')}
                >
                  <Text style={[styles.sideBtnText, side === 'buy' && styles.sideBtnTextActive]}>
                    Buy Yield
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sideBtn, side === 'sell' && styles.sideBtnSell]}
                  onPress={() => setSide('sell')}
                >
                  <Text style={[styles.sideBtnText, side === 'sell' && styles.sideBtnTextActive]}>
                    Sell Yield
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {action === 'pool' && (
              <View style={styles.sideToggle}>
                <TouchableOpacity
                  style={[styles.sideBtn, poolMode === 'add' && styles.sideBtnBuy]}
                  onPress={() => setPoolMode('add')}
                >
                  <Text style={[styles.sideBtnText, poolMode === 'add' && styles.sideBtnTextActive]}>
                    Add Liquidity
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sideBtn, poolMode === 'remove' && styles.sideBtnSell]}
                  onPress={() => setPoolMode('remove')}
                >
                  <Text style={[styles.sideBtnText, poolMode === 'remove' && styles.sideBtnTextActive]}>
                    Remove Liquidity
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Explanation Hint */}
            <Text style={styles.hint}>
              {action === 'yield' &&
                (side === 'buy'
                  ? `Own the reinvested dividends of ${asset.symbol} until maturity without price risk.`
                  : `Sell future dividends your YT will earn and take the cash today.`)}
              {action === 'fix' &&
                `Lock in dividend yield: keep your share exposure and get a full year of dividends upfront.`}
              {action === 'strip' &&
                `Split ${asset.symbol} into 1 Principal Token (PT) and 1 Yield Token (YT).`}
              {action === 'redeem' &&
                (market.matured
                  ? `Maturity settled. Redeem Principal Tokens (PT) for full underlying shares.`
                  : `Burn 1 PT + 1 YT pair to unlock your deposited ${asset.symbol}.`)}
              {action === 'pool' &&
                `Provide liquidity to earn 0.3% swap fees + the dividends of the YT held in pool.`}
            </Text>

            {/* Input Amount Box */}
            <View style={styles.inputBox}>
              <View style={styles.inputTop}>
                <Text style={styles.inputLabel}>
                  {action === 'yield'
                    ? side === 'buy'
                      ? 'You pay (Stock)'
                      : 'You pay (YT)'
                    : action === 'fix'
                    ? 'Deposit'
                    : action === 'strip'
                    ? 'Deposit'
                    : action === 'redeem'
                    ? market.matured
                      ? 'Redeem PT'
                      : 'Recombine PT+YT'
                    : 'Amount'}
                </Text>
                <Text style={styles.inputUsd}>≈ {usd(valNum * pxUsd)}</Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={input}
                  onChangeText={setInput}
                  placeholder="0.0"
                  placeholderTextColor={THEME.colors.textSubtle}
                />
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencyText}>
                    {action === 'yield' && side === 'sell'
                      ? market.ytSymbol
                      : action === 'redeem' && market.matured
                      ? market.ptSymbol
                      : asset.symbol}
                  </Text>
                </View>
              </View>
            </View>

            {/* Output Amount Box */}
            <View style={styles.outputBox}>
              <View style={styles.inputTop}>
                <Text style={styles.inputLabel}>
                  {action === 'yield'
                    ? side === 'buy'
                      ? 'You receive (YT)'
                      : 'You receive (Stock)'
                    : action === 'fix'
                    ? 'Dividends upfront'
                    : action === 'strip'
                    ? 'Minted (PT + YT)'
                    : action === 'redeem'
                    ? 'You receive'
                    : 'Matched pool reserves'}
                </Text>
                {loadingQuote && <ActivityIndicator size="small" color={THEME.colors.amber} />}
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.outputVal}>
                  {quoteOut ? amount(quoteOut) : '0.00'}
                </Text>
                <View style={[styles.currencyBadge, { backgroundColor: THEME.colors.card }]}>
                  <Text style={[styles.currencyText, { color: THEME.colors.amber }]}>
                    {action === 'yield' && side === 'buy'
                      ? market.ytSymbol
                      : action === 'strip'
                      ? 'PT+YT'
                      : asset.symbol}
                  </Text>
                </View>
              </View>
              {action === 'fix' && ptUnitsOut ? (
                <Text style={styles.ptBonus}>
                  + {amount(ptUnitsOut)} {market.ptSymbol} (redeemable at maturity)
                </Text>
              ) : null}
            </View>

            {/* Trade Details Grid */}
            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Implied dividend yield</Text>
                <Text style={[styles.detailVal, { color: THEME.colors.amber }]}>
                  {pct(market.impliedYield)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>PT price (fixed share return)</Text>
                <Text style={styles.detailVal}>
                  {usd(toNum(market.ptPrice) * pxUsd)} ({pct(market.ptFixedYield)})
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>YT price</Text>
                <Text style={styles.detailVal}>{usd(toNum(market.ytPrice) * pxUsd)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Pool fee</Text>
                <Text style={styles.detailVal}>0.30%</Text>
              </View>
            </View>

            {/* Slippage Selector */}
            <View style={styles.slipRow}>
              <Text style={styles.slipLabel}>Slippage Tolerance</Text>
              <View style={styles.slipBtns}>
                {SLIPPAGES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.slipBtn, slip === s && styles.slipBtnActive]}
                    onPress={() => setSlip(s)}
                  >
                    <Text style={[styles.slipBtnText, slip === s && styles.slipBtnTextActive]}>
                      {(s / 100).toFixed(1)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Action Submit Button */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.8}>
              <Text style={styles.submitBtnText}>
                {action === 'yield'
                  ? side === 'buy'
                    ? `Buy ${market.ytSymbol}`
                    : `Sell ${market.ytSymbol}`
                  : action === 'fix'
                  ? 'Sell Future Dividends'
                  : action === 'strip'
                  ? `Strip ${asset.symbol}`
                  : action === 'redeem'
                  ? market.matured
                    ? 'Redeem PT'
                    : 'Recombine Units'
                  : poolMode === 'add'
                  ? 'Add Liquidity'
                  : 'Remove Liquidity'}
              </Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: THEME.colors.card,
    borderTopLeftRadius: THEME.radii.xl,
    borderTopRightRadius: THEME.radii.xl,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingTop: THEME.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.cardBorder,
  },
  assetHeader: {
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  assetSub: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    color: THEME.colors.textMuted,
    fontSize: 18,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardElevated,
    marginHorizontal: THEME.spacing.lg,
    marginVertical: THEME.spacing.md,
    borderRadius: THEME.radii.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.radii.sm,
  },
  tabActive: {
    backgroundColor: THEME.colors.amber,
  },
  tabDisabled: {
    opacity: 0.35,
  },
  tabText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#0B0D10',
    fontWeight: '800',
  },
  body: {
    paddingHorizontal: THEME.spacing.lg,
  },
  sideToggle: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.md,
    padding: 4,
    marginBottom: THEME.spacing.md,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: THEME.radii.sm,
  },
  sideBtnBuy: {
    backgroundColor: THEME.colors.green,
  },
  sideBtnSell: {
    backgroundColor: THEME.colors.red,
  },
  sideBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  sideBtnTextActive: {
    color: '#0B0D10',
  },
  hint: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: THEME.spacing.md,
  },
  inputBox: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: THEME.spacing.md,
  },
  outputBox: {
    backgroundColor: 'rgba(245, 178, 41, 0.05)',
    borderRadius: THEME.radii.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 178, 41, 0.25)',
    marginBottom: THEME.spacing.md,
  },
  inputTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  inputUsd: {
    color: THEME.colors.textSubtle,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 2,
  },
  outputVal: {
    flex: 1,
    color: THEME.colors.amber,
    fontSize: 22,
    fontWeight: '700',
  },
  currencyBadge: {
    backgroundColor: THEME.colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radii.full,
  },
  currencyText: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  ptBonus: {
    color: THEME.colors.pt,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  details: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.md,
    padding: THEME.spacing.md,
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailKey: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  detailVal: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  slipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
  },
  slipLabel: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  slipBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  slipBtn: {
    backgroundColor: THEME.colors.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radii.sm,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  slipBtnActive: {
    borderColor: THEME.colors.amber,
    backgroundColor: 'rgba(245, 178, 41, 0.1)',
  },
  slipBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  slipBtnTextActive: {
    color: THEME.colors.amber,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: THEME.colors.amber,
    borderRadius: THEME.radii.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#0B0D10',
    fontSize: 16,
    fontWeight: '800',
  },
})
