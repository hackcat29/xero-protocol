import React from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { THEME } from './src/constants/theme'
import { ProtocolProvider, useProtocol } from './src/context/ProtocolContext'
import { Web3Provider } from './src/context/Web3Context'
import { RootNavigator } from './src/navigation/RootNavigator'

function MainContent() {
  const { chainId } = useProtocol()
  return (
    <Web3Provider chainId={chainId}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar style="light" backgroundColor={THEME.colors.background} />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaView>
    </Web3Provider>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ProtocolProvider>
        <MainContent />
      </ProtocolProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
})
