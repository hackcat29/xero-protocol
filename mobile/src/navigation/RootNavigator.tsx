import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { THEME } from '../constants/theme'
import { Header } from '../components/Header'
import { NetworkModal } from '../components/NetworkModal'
import { WalletModal } from '../components/WalletModal'
import { TradeTicketModal } from '../components/TradeTicketModal'
import { TxProgressModal } from '../components/TxProgressModal'
import { MarketsScreen } from '../screens/MarketsScreen'
import { AssetDetailScreen } from '../screens/AssetDetailScreen'
import { PortfolioScreen } from '../screens/PortfolioScreen'
import { DevConsoleScreen } from '../screens/DevConsoleScreen'
import { useProtocol } from '../context/ProtocolContext'
import type { Market } from '../types'

const Tab = createBottomTabNavigator()

export const RootNavigator: React.FC = () => {
  const { protocol, toastMessage } = useProtocol()

  const [networkModalOpen, setNetworkModalOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [tradeAction, setTradeAction] = useState<'yield' | 'fix' | 'strip' | 'redeem' | 'pool'>('yield')

  // Selected market for Trade view
  const defaultMarket = protocol?.markets[0] || null
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(defaultMarket)

  const activeMarket = selectedMarket || defaultMarket
  const activeAsset = activeMarket
    ? protocol?.assets.find((a) => a.token.toLowerCase() === activeMarket.token.toLowerCase()) || null
    : null

  const handleSelectMarket = (m: Market, navigation: any) => {
    setSelectedMarket(m)
    navigation.navigate('Trade')
  }

  const handleQuickTrade = (m: Market, action: 'yield' | 'fix' | 'strip' | 'redeem' | 'pool' = 'yield') => {
    setSelectedMarket(m)
    setTradeAction(action)
    setTradeModalOpen(true)
  }

  return (
    <View style={styles.container}>
      <Header
        onOpenNetwork={() => setNetworkModalOpen(true)}
        onOpenWallet={() => setWalletModalOpen(true)}
      />

      {/* Floating Notification Toast */}
      {toastMessage && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <Tab.Navigator
        initialRouteName="Markets"
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: THEME.colors.amber,
          tabBarInactiveTintColor: THEME.colors.textMuted,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tab.Screen
          name="Markets"
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>↗</Text>,
          }}
        >
          {({ navigation }) => (
            <MarketsScreen
              onSelectMarket={(m) => handleSelectMarket(m, navigation)}
              onQuickTrade={(m) => handleQuickTrade(m, 'yield')}
            />
          )}
        </Tab.Screen>


        <Tab.Screen
          name="Trade"
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⇄</Text>,
          }}
        >
          {({ navigation }) =>
            activeMarket ? (
              <AssetDetailScreen
                market={activeMarket}
                onOpenTradeModal={(action = 'yield') => handleQuickTrade(activeMarket, action)}
                onBack={() => navigation.navigate('Markets')}
              />
            ) : (
              <View style={styles.emptyCenter}>
                <Text style={styles.emptyText}>Select a market to trade</Text>
              </View>
            )
          }
        </Tab.Screen>

        <Tab.Screen
          name="Portfolio"
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>⊞</Text>,
          }}
        >
          {({ navigation }) => (
            <PortfolioScreen
              onSelectMarket={(m) => handleSelectMarket(m, navigation)}
              onClaimMarket={(_vault, symbol) => {
                const m = protocol?.markets.find((x) => x.symbol === symbol)
                if (m) handleQuickTrade(m, 'redeem')
              }}
            />
          )}
        </Tab.Screen>

        <Tab.Screen
          name="Console"
          component={DevConsoleScreen}
          options={{
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>⚙</Text>,
          }}
        />
      </Tab.Navigator>

      {/* Global Modals */}
      <NetworkModal visible={networkModalOpen} onClose={() => setNetworkModalOpen(false)} />
      <WalletModal visible={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      <TradeTicketModal
        visible={tradeModalOpen}
        asset={activeAsset}
        market={activeMarket}
        initialAction={tradeAction}
        onClose={() => setTradeModalOpen(false)}
      />
      <TxProgressModal />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  tabBar: {
    backgroundColor: THEME.colors.tabBarBackground,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.tabBarBorder,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
  },
  emptyText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
  },
  toast: {
    position: 'absolute',
    top: 64,
    left: 20,
    right: 20,
    zIndex: 999,
    backgroundColor: THEME.colors.cardElevated,
    borderRadius: THEME.radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: THEME.colors.amber,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
})
