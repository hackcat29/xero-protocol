import React, { createContext, useContext, useState, useEffect } from 'react'
import { PERSONAS } from '../constants/networks'
import { apiService } from '../services/api'
import type { PortfolioData } from '../types'

export type TxStep = {
  id: string
  label: string
  status: 'pending' | 'success' | 'error'
  hash?: string
}

type Web3ContextType = {
  currentPersona: (typeof PERSONAS)[0]
  setPersona: (p: (typeof PERSONAS)[0]) => void
  address: string
  isIssuer: boolean
  portfolio: PortfolioData | null
  portfolioLoading: boolean
  refreshPortfolio: () => Promise<void>
  activeTx: {
    title: string
    steps: TxStep[]
    isOpen: boolean
  } | null
  executeTx: (title: string, steps: string[]) => Promise<boolean>
  closeTxModal: () => void
}

const Web3Context = createContext<Web3ContextType | null>(null)

export const Web3Provider: React.FC<{ children: React.ReactNode; chainId: number }> = ({ children, chainId }) => {
  const [currentPersona, setPersona] = useState<(typeof PERSONAS)[0]>(PERSONAS[0])
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [activeTx, setActiveTx] = useState<{
    title: string
    steps: TxStep[]
    isOpen: boolean
  } | null>(null)

  const isIssuer = !!currentPersona.issuer

  const refreshPortfolio = async () => {
    try {
      setPortfolioLoading(true)
      const data = await apiService.getPortfolio(currentPersona.address, chainId)
      setPortfolio(data)
    } catch (e) {
      console.error('Failed to load portfolio:', e)
    } finally {
      setPortfolioLoading(false)
    }
  }

  useEffect(() => {
    refreshPortfolio()
  }, [currentPersona.address, chainId])

  const executeTx = async (title: string, stepLabels: string[]): Promise<boolean> => {
    const initialSteps: TxStep[] = stepLabels.map((l, i) => ({
      id: `step-${i}`,
      label: l,
      status: 'pending',
    }))

    setActiveTx({
      title,
      steps: initialSteps,
      isOpen: true,
    })

    // Simulate multi-step approval + execution pipeline with realistic timing
    for (let i = 0; i < initialSteps.length; i++) {
      await new Promise((r) => setTimeout(r, 900))
      setActiveTx((prev) => {
        if (!prev) return null
        const updated = [...prev.steps]
        const mockHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
        updated[i] = { ...updated[i], status: 'success', hash: mockHash }
        return { ...prev, steps: updated }
      })
    }

    await new Promise((r) => setTimeout(r, 600))
    await refreshPortfolio()
    return true
  }

  const closeTxModal = () => {
    setActiveTx((prev) => (prev ? { ...prev, isOpen: false } : null))
  }

  return (
    <Web3Context.Provider
      value={{
        currentPersona,
        setPersona,
        address: currentPersona.address,
        isIssuer,
        portfolio,
        portfolioLoading,
        refreshPortfolio,
        activeTx,
        executeTx,
        closeTxModal,
      }}
    >
      {children}
    </Web3Context.Provider>
  )
}

export const useWeb3 = () => {
  const ctx = useContext(Web3Context)
  if (!ctx) throw new Error('useWeb3 must be used inside Web3Provider')
  return ctx
}
