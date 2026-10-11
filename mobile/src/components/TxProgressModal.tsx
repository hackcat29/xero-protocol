import React from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { THEME } from '../constants/theme'
import { useWeb3 } from '../context/Web3Context'
import { short } from '../services/api'

export const TxProgressModal: React.FC = () => {
  const { activeTx, closeTxModal } = useWeb3()

  if (!activeTx || !activeTx.isOpen) return null

  const allSuccess = activeTx.steps.every((s) => s.status === 'success')

  return (
    <Modal visible={activeTx.isOpen} transparent animationType="fade" onRequestClose={closeTxModal}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>{activeTx.title}</Text>
          <Text style={styles.sub}>
            {allSuccess ? 'Transaction confirmed on chain.' : 'Confirming in wallet & on-chain…'}
          </Text>

          <View style={styles.steps}>
            {activeTx.steps.map((step, i) => {
              return (
                <View key={step.id} style={styles.stepRow}>
                  <View style={styles.iconCol}>
                    {step.status === 'pending' ? (
                      <ActivityIndicator size="small" color={THEME.colors.amber} />
                    ) : step.status === 'success' ? (
                      <Text style={styles.successIcon}>✓</Text>
                    ) : (
                      <Text style={styles.errorIcon}>✕</Text>
                    )}
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepLabel}>
                      Step {i + 1}: {step.label}
                    </Text>
                    {step.hash && (
                      <Text style={styles.stepHash}>Tx: {short(step.hash)}</Text>
                    )}
                  </View>
                </View>
              )
            })}
          </View>

          {allSuccess && (
            <TouchableOpacity style={styles.doneBtn} onPress={closeTxModal} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    maxWidth: 360,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radii.xl,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: THEME.spacing.xl,
  },
  title: {
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: THEME.spacing.lg,
  },
  steps: {
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCol: {
    width: 24,
    alignItems: 'center',
  },
  successIcon: {
    color: THEME.colors.green,
    fontSize: 18,
    fontWeight: '800',
  },
  errorIcon: {
    color: THEME.colors.red,
    fontSize: 18,
    fontWeight: '800',
  },
  stepInfo: {
    flex: 1,
  },
  stepLabel: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  stepHash: {
    color: THEME.colors.textSubtle,
    fontSize: 11,
    fontFamily: 'System',
    marginTop: 2,
  },
  doneBtn: {
    marginTop: THEME.spacing.xl,
    backgroundColor: THEME.colors.amber,
    borderRadius: THEME.radii.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#0B0D10',
    fontSize: 15,
    fontWeight: '700',
  },
})
