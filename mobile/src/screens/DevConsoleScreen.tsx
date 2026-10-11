import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { THEME } from '../constants/theme'
import { useWeb3 } from '../context/Web3Context'
import { useProtocol } from '../context/ProtocolContext'
import { usd, toNum } from '../services/api'

export const DevConsoleScreen: React.FC = () => {
  const { isIssuer, executeTx } = useWeb3()
  const { protocol, showToast } = useProtocol()

  const [selectedSym, setSelectedSym] = useState('SCHD')
  const [cash, setCash] = useState('0.27')

  const asset = protocol?.assets.find((a) => a.symbol === selectedSym) || protocol?.assets[0]

  const handleFaucet = async () => {
    if (!asset) return
    const success = await executeTx(`Claim Test ${asset.symbol}`, [
      `Mint 10,000 ${asset.symbol} from mock faucet`,
    ])
    if (success) {
      showToast(`Received 10,000 ${asset.symbol} test tokens`)
    }
  }

  const handleReinvest = async () => {
    if (!asset) return
    const success = await executeTx(`${asset.symbol} Reinvests $${cash}`, [
      `Submit $${cash}/share cash dividend`,
      `Update uiMultiplier on ${asset.symbol}`,
    ])
    if (success) {
      showToast(`Reinvested $${cash} dividend into ${asset.symbol}`)
    }
  }

  const handleAttestedSplit = async () => {
    if (!asset) return
    const success = await executeTx(`${asset.symbol} 2:1 Split (Attested)`, [
      'Apply 2-for-1 forward split on token',
      'Attest split via CorporateActionEngine',
    ])
    if (success) {
      showToast(`2:1 split attested for ${asset.symbol}`)
    }
  }

  const handleUnattestedSplit = async () => {
    if (!asset) return
    const success = await executeTx(`${asset.symbol} 2:1 Split (Unattested)`, [
      'Apply 2-for-1 forward split on token without attestation',
      'Trigger vault freeze safety mechanism',
    ])
    if (success) {
      showToast(`Unattested split triggered! Vault frozen for safety.`)
    }
  }

  const handleAttestPending = async () => {
    if (!asset) return
    const success = await executeTx(`Attest Pending ${asset.symbol} Split`, [
      'Submit reporter attestation to CorporateActionEngine',
      'Unfreeze vault & restore normal operations',
    ])
    if (success) {
      showToast(`Pending split attested! Vault unfrozen.`)
    }
  }

  const handleOracleMove = async (dir: 'up' | 'down' | 'refresh') => {
    if (!asset) return
    const title = dir === 'up' ? `Price Feed +5%` : dir === 'down' ? `Price Feed -5%` : `Refresh Feeds`
    const success = await executeTx(title, [
      `Update mock Chainlink aggregator for ${asset.symbol}`,
    ])
    if (success) {
      showToast(`Price feed updated for ${asset.symbol}`)
    }
  }

  const handleTimeTravel = async (days: number) => {
    const success = await executeTx(`Advance Time +${days}d`, [
      `evm_increaseTime(${days * 86400})`,
      'evm_mine() new block',
    ])
    if (success) {
      showToast(`Advanced chain time by ${days} days`)
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Developer & Issuer Console</Text>
        <Text style={styles.sub}>
          Simulate corporate actions, reinvest dividends, test vault freezes, and time travel.
        </Text>
      </View>

      {/* Asset Selector */}
      {protocol && (
        <View style={styles.assetScroll}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symScroll}>
            {protocol.assets.map((a) => {
              const active = a.symbol === selectedSym
              return (
                <TouchableOpacity
                  key={a.symbol}
                  style={[styles.symChip, active && styles.symChipActive]}
                  onPress={() => setSelectedSym(a.symbol)}
                >
                  <Text style={[styles.symText, active && styles.symTextActive]}>{a.symbol}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* Faucet Section */}
      <View style={styles.section}>
        <View style={styles.faucetCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.secTitle}>Test Tokens Faucet</Text>
            <Text style={styles.secSub}>Claim about $10,000 of {selectedSym} once a day.</Text>
          </View>
          <TouchableOpacity style={styles.faucetBtn} onPress={handleFaucet}>
            <Text style={styles.faucetBtnText}>Get {selectedSym}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dividend Reinvestment */}
      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.secTitle}>Dividend Reinvestment</Text>
          <Text style={styles.secSub}>
            Robinhood reinvests cash dividends: the token multiplier grows by cash ÷ price. YT holders accrue it.
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Cash dividend per share (USD)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={cash}
              onChangeText={setCash}
            />
          </View>

          <TouchableOpacity style={styles.actionBtn} onPress={handleReinvest}>
            <Text style={styles.actionBtnText}>Pay & Reinvest Dividend</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Corporate Actions & Split Safety */}
      <View style={styles.section}>
        <View style={styles.card}>
          <Text style={styles.secTitle}>Corporate Actions & Splits</Text>
          <Text style={styles.secSub}>
            Splits move the same multiplier. Attested splits are filtered out; unattested ones freeze the vault to prevent phantom yield.
          </Text>

          <View style={styles.btnStack}>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleAttestedSplit}>
              <Text style={styles.btnSecondaryText}>2:1 Split (Attested)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnSecondary, styles.btnWarn]} onPress={handleUnattestedSplit}>
              <Text style={[styles.btnSecondaryText, { color: THEME.colors.red }]}>
                2:1 Split (Unattested - Triggers Freeze)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSecondary} onPress={handleAttestPending}>
              <Text style={styles.btnSecondaryText}>Attest Pending Split (Unfreeze)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Oracle Feed Controls */}
      <View style={styles.section}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.secTitle}>Oracle Manipulation</Text>
            <Text style={styles.oraclePx}>{asset ? usd(asset.sharePriceUsd) : '—'}</Text>
          </View>
          <Text style={styles.secSub}>
            Simulate Chainlink price feed movements (+5%, -5%) or refresh staleness.
          </Text>

          <View style={styles.rowBtns}>
            <TouchableOpacity style={styles.rowBtn} onPress={() => handleOracleMove('down')}>
              <Text style={styles.rowBtnText}>−5%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rowBtn} onPress={() => handleOracleMove('up')}>
              <Text style={styles.rowBtnText}>+5%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rowBtn} onPress={() => handleOracleMove('refresh')}>
              <Text style={styles.rowBtnText}>Refresh All</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.metaSub}>Multiplier {asset ? toNum(asset.multiplier).toFixed(4) : '1.0000'}</Text>
        </View>
      </View>

      {/* Time Travel */}
      <View style={[styles.section, { marginBottom: 40 }]}>
        <View style={styles.card}>
          <Text style={styles.secTitle}>Time Travel</Text>
          <Text style={styles.secSub}>Advance chain timestamp to mature vaults and accrue yield.</Text>

          <View style={styles.rowBtns}>
            {[1, 7, 30, 90].map((d) => (
              <TouchableOpacity key={d} style={styles.rowBtn} onPress={() => handleTimeTravel(d)}>
                <Text style={styles.rowBtnText}>+{d}d</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.metaSub}>
            Chain Time: {protocol ? new Date(protocol.now * 1000).toLocaleString() : '—'}
          </Text>
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
  header: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
  },
  title: {
    color: THEME.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  sub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  assetScroll: {
    marginTop: THEME.spacing.md,
  },
  symScroll: {
    paddingHorizontal: THEME.spacing.lg,
    gap: 8,
  },
  symChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  symChipActive: {
    borderColor: THEME.colors.amber,
    backgroundColor: 'rgba(245, 178, 41, 0.12)',
  },
  symText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  symTextActive: {
    color: THEME.colors.amber,
  },
  section: {
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  oraclePx: {
    color: THEME.colors.amber,
    fontSize: 15,
    fontWeight: '800',
  },
  faucetCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.lg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  faucetBtn: {
    backgroundColor: THEME.colors.amber,
    borderRadius: THEME.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  faucetBtnText: {
    color: '#0B0D10',
    fontSize: 13,
    fontWeight: '800',
  },
  secTitle: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  secSub: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  field: {
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  fieldLabel: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    color: THEME.colors.text,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBtn: {
    backgroundColor: THEME.colors.amber,
    borderRadius: THEME.radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#0B0D10',
    fontSize: 14,
    fontWeight: '800',
  },
  btnStack: {
    marginTop: THEME.spacing.md,
    gap: 8,
  },
  btnSecondary: {
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnWarn: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  btnSecondaryText: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 8,
    marginTop: THEME.spacing.md,
  },
  rowBtn: {
    flex: 1,
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.md,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rowBtnText: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  metaSub: {
    color: THEME.colors.textSubtle,
    fontSize: 11,
    marginTop: 8,
  },
})
