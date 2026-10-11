import React from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import { THEME } from '../constants/theme'
import { PERSONAS } from '../constants/networks'
import { useWeb3 } from '../context/Web3Context'
import { short } from '../services/api'

export const WalletModal: React.FC<{
  visible: boolean
  onClose: () => void
}> = ({ visible, onClose }) => {
  const { currentPersona, setPersona } = useWeb3()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Connect Wallet</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>
            Switch personas or connect an unlocked devnet account.
          </Text>

          <View style={styles.list}>
            {PERSONAS.map((p) => {
              const selected = p.address.toLowerCase() === currentPersona.address.toLowerCase()
              return (
                <TouchableOpacity
                  key={p.address}
                  style={[styles.item, selected && styles.itemSelected]}
                  onPress={() => {
                    setPersona(p)
                    onClose()
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <View style={[styles.avatar, { backgroundColor: p.color }]}>
                      <Text style={styles.avatarLetter}>{p.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.name, selected && styles.nameSelected]}>{p.name}</Text>
                        {p.issuer && <Text style={styles.issuerTag}>Issuer</Text>}
                      </View>
                      <Text style={styles.blurb} numberOfLines={1}>
                        {p.blurb}
                      </Text>
                      <Text style={styles.addr}>{short(p.address)}</Text>
                    </View>
                  </View>
                  {selected && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    color: THEME.colors.textMuted,
    fontSize: 16,
    padding: 4,
  },
  modalSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: THEME.spacing.md,
  },
  list: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: THEME.spacing.md,
    borderRadius: THEME.radii.lg,
    backgroundColor: THEME.colors.cardElevated,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  itemSelected: {
    borderColor: THEME.colors.amber,
    backgroundColor: 'rgba(245, 178, 41, 0.08)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0B0D10',
    fontSize: 14,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  nameSelected: {
    color: THEME.colors.amber,
  },
  issuerTag: {
    backgroundColor: 'rgba(245, 178, 41, 0.15)',
    color: THEME.colors.amber,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blurb: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  addr: {
    color: THEME.colors.textSubtle,
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'System',
  },
  check: {
    color: THEME.colors.amber,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
})
