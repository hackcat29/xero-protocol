import React, { createContext, useContext, useState, useEffect } from 'react'
import { NETWORKS } from '../constants/networks'
import { apiService } from '../services/api'
import type { ProtocolSnapshot } from '../types'

type ProtocolContextType = {
  chainId: number
  setChainId: (id: number) => void
  networkName: string
  protocol: ProtocolSnapshot | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  toastMessage: string | null
  showToast: (msg: string) => void
}

const ProtocolContext = createContext<ProtocolContextType | null>(null)

export const ProtocolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chainId, setChainId] = useState<number>(46630)
  const [protocol, setProtocol] = useState<ProtocolSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const activeNet = NETWORKS.find((n) => n.id === chainId) || NETWORKS[0]

  const refresh = async () => {
    try {
      const data = await apiService.getProtocol(chainId)
      setProtocol(data)
      setError(null)
    } catch (e: any) {
      console.error('Failed to load protocol:', e)
      setError(e.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    const interval = setInterval(refresh, 8000)
    return () => clearInterval(interval)
  }, [chainId])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  return (
    <ProtocolContext.Provider
      value={{
        chainId,
        setChainId,
        networkName: activeNet.name,
        protocol,
        loading,
        error,
        refresh,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </ProtocolContext.Provider>
  )
}

export const useProtocol = () => {
  const ctx = useContext(ProtocolContext)
  if (!ctx) throw new Error('useProtocol must be used inside ProtocolProvider')
  return ctx
}
