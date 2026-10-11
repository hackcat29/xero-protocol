import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { THEME } from '../constants/theme'
import { Mark } from './Mark'
import { useProtocol } from '../context/ProtocolContext'
import { useWeb3 } from '../context/Web3Context'
import { short } from '../services/api'

export const Header: React.FC<{
  onOpenNetwork: () => void
  onOpenWallet: () => void
}> = ({ onOpenNetwork, onOpenWallet }) => {
  const { networkName } = useProtocol()
  const { currentPersona } = useWeb3()

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Mark size={26} />
        <Text style={styles.brandTitle}>xero</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.netPill} onPress={onOpenNetwork} activeOpacity={0.7}>
          <View style={styles.greenDot} />
          <Text style={styles.netText} numberOfLines={1}>
            {networkName.replace(' Chain', '')}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.walletPill} onPress={onOpenWallet} activeOpacity={0.7}>
          <View style={[styles.avatar, { backgroundColor: currentPersona.color }]}>
            <Text style={styles.avatarLetter}>{currentPersona.name[0]}</Text>
          </View>
          <Text style={styles.walletText}>{currentPersona.name}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    paddingHorizontal: THEME.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.cardBorder,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    color: THEME.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  netPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radii.full,
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.green,
  },
  netText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 105,
  },
  chevron: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: THEME.radii.full,
    gap: 6,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0B0D10',
    fontSize: 11,
    fontWeight: '800',
  },
  walletText: {
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
})
