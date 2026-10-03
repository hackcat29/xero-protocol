import { connectorsForWallets, type Wallet, type WalletList } from '@rainbow-me/rainbowkit'
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createConfig, createConnector, http } from 'wagmi'
import { mock } from 'wagmi/connectors'
import type { Address } from 'viem'
import { chain, isDevnet } from './network'

const projectId: string | undefined = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

/** Devnet personas: anvil's unlocked dev accounts, exposed as wallets inside the connect modal. */
export const PERSONAS: { name: string; blurb: string; address: Address; issuer?: boolean }[] = [
  { name: 'Alice', blurb: 'Holds stock, sells her future dividends', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
  { name: 'Bob', blurb: 'Buys dividend yield without price risk', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
  { name: 'Carol', blurb: 'Trades the dividend curve', address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' },
  { name: 'Issuer', blurb: 'Reinvests dividends, splits, attests', address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', issuer: true },
]

const PERSONA_KEY = 'xero.devnetPersona'

const personaIcon = (letter: string, bg: string, fg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" rx="14" fill="${bg}"/><text x="28" y="37" text-anchor="middle" font-family="Geist,Arial" font-weight="700" font-size="26" fill="${fg}">${letter}</text></svg>`,
  )}`

function personaWallet(p: (typeof PERSONAS)[number]): () => Wallet {
  return () => ({
    id: `devnet-${p.name.toLowerCase()}`,
    name: `${p.name} · devnet`,
    iconUrl: personaIcon(p.name[0], p.issuer ? '#F5B229' : '#1D2229', p.issuer ? '#0B0D10' : '#F4F2EC'),
    iconBackground: '#0B0D10',
    installed: true,
    createConnector: (details) =>
      createConnector((config) => {
        const id = `devnet-${p.name.toLowerCase()}`
        const base = mock({ accounts: [p.address], features: { reconnect: true } })(config)
        // wagmi's mock connector keeps "connected" in memory only; remember the persona so a page
        // reload restores the session like a real injected wallet would.
        const remember = (v: string | null) => {
          try {
            if (v) localStorage.setItem(PERSONA_KEY, v)
            else localStorage.removeItem(PERSONA_KEY)
          } catch {}
        }
        return {
          ...base,
          id,
          name: `${p.name} · devnet`,
          async connect(params) {
            const res = await base.connect(params as never)
            remember(id)
            return res as never
          },
          async disconnect() {
            remember(null)
            await base.disconnect()
          },
          async isAuthorized() {
            try {
              return localStorage.getItem(PERSONA_KEY) === id
            } catch {
              return false
            }
          },
          ...details,
        }
      }),
  })
}

const groups: WalletList = [
  {
    groupName: 'Recommended',
    wallets: projectId
      ? [metaMaskWallet, rabbyWallet, coinbaseWallet, rainbowWallet, walletConnectWallet, injectedWallet]
      : [injectedWallet, rabbyWallet],
  },
]
if (isDevnet) groups.push({ groupName: 'Devnet personas', wallets: PERSONAS.map(personaWallet) })

const connectors = connectorsForWallets(groups, {
  appName: 'Xero',
  appDescription: 'Keep the stock. Trade the dividends.',
  appUrl: 'https://xeroprotocol.com',
  appIcon: 'https://xeroprotocol.com/xero-icon-192.png',
  projectId: projectId ?? 'xero-devnet',
})

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors,
  transports: { [chain.id]: http() },
  ssr: false,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
