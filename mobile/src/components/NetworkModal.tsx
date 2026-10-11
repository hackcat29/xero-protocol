import React from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import { THEME } from '../constants/theme'
import { NETWORKS } from '../constants/networks'
import { useProtocol } from '../context/ProtocolContext'

export const NetworkModal: React.FC<{
  visible: boolean
  onClose: () => void
}> = ({ visible, onClose }) => {
  const { chainId, setChainId } = useProtocol()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Network</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>Switch network to trade assets on that chain.</Text>

          <View style={styles.list}>
            {NETWORKS.map((net) => {
              const selected = net.id === chainId
              return (
                <TouchableOpacity
                  key={net.id}
                  style={[styles.item, selected && styles.itemSelected]}
                  onPress={() => {
                    setChainId(net.id)
                    onClose()
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemLeft}>
                    <View style={[styles.dot, { backgroundColor: net.testnet ? THEME.colors.amber : THEME.colors.green }]} />
                    <View>
                      <Text style={[styles.name, selected && styles.nameSelected]}>{net.name}</Text>
                      <Text style={styles.chainDesc}>
                        Chain ID: {net.id} {net.testnet ? '· Testnet' : '· Mainnet'}
                      </Text>
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
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  nameSelected: {
    color: THEME.colors.amber,
  },
  chainDesc: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  check: {
    color: THEME.colors.amber,
    fontSize: 16,
    fontWeight: '700',
  },
})
