import { createPublicClient, defineChain, http, type Abi, type Address, type Chain, type PublicClient } from 'viem'
import abisJson from './abis.json'

export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_ROBINHOOD_RPC ?? 'https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Robinhood Chain Explorer', url: 'https://robin.etherscan.io' } },
})

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_ROBINHOOD_TESTNET_RPC ?? 'https://rpc.testnet.chain.robinhood.com/rpc'] } },
  blockExplorers: { default: { name: 'Robinhood Testnet Explorer', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
})

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_ARBITRUM_SEPOLIA_RPC ?? 'https://sepolia-rollup.arbitrum.io/rpc'] } },
  blockExplorers: { default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' } },
  testnet: true,
})

export const localChain = defineChain({
  id: 31337,
  name: 'Local devnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_LOCAL_RPC ?? 'http://127.0.0.1:8545'] } },
})

export type AddressBook = {
  chainId: number
  startBlock?: number
  deployer: Address
  usdg: Address
  guardian: Address
  engine: Address
  factory: Address
  math: Address
  markets: Address
  oracle: Address
  lens: Address
  router: Address
  stocks: Address[]
  feeds?: Address[]
  actors?: Address[]
  /** Robinhood-issued Stock Tokens (testnet): no mock faucet or issuer controls. */
  realStocks?: Address[]
}

const books = Object.fromEntries(
  Object.values(import.meta.glob<AddressBook>('../deployments/*.json', { eager: true, import: 'default' })).map(
    (b) => [b.chainId, b],
  ),
) as Record<number, AddressBook>

const CHAINS: Record<number, Chain> = {
  4663: robinhoodChain,
  46630: robinhoodTestnet,
  421614: arbitrumSepolia,
  31337: localChain,
}
/** Short names for `?chain=` links, e.g. https://xeroprotocol.com/markets?chain=arbitrum-sepolia */
const SLUGS: Record<string, number> = { 'robinhood-testnet': 46630, 'arbitrum-sepolia': 421614, robinhood: 4663, local: 31337 }
const TESTNETS = [46630, 421614]

/** Build-time default network: VITE_CHAIN_ID, else Robinhood Chain testnet. Mainnet builds set 4663, `scripts/dev.sh` 31337. */
const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 46630)

/** Networks a visitor can choose between: every deployment shipped in this build. A local-devnet build is pinned to it. */
export const networks: Chain[] =
  DEFAULT_CHAIN_ID === 31337
    ? [localChain]
    : [...new Set([DEFAULT_CHAIN_ID, ...Object.keys(books).map(Number).filter((id) => id !== 31337)])]
        .map((id) => CHAINS[id])
        .filter((c): c is Chain => !!c)

const STORAGE_KEY = 'xero.chainId'
const selectable = (id: number) => networks.some((n) => n.id === id)

/** `?chain=` in the URL wins (and is remembered), then the visitor's last choice, then the build default. */
function pickChainId(): number {
  try {
    const q = new URLSearchParams(window.location.search).get('chain')
    const fromUrl = q ? (SLUGS[q] ?? Number(q)) : NaN
    if (selectable(fromUrl)) {
      localStorage.setItem(STORAGE_KEY, String(fromUrl))
      return fromUrl
    }
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    if (selectable(saved)) return saved
  } catch {}
  return DEFAULT_CHAIN_ID
}

export const chainId: number = pickChainId()
export const chain: Chain = CHAINS[chainId] ?? robinhoodTestnet
export const book: AddressBook | undefined = books[chainId]
export const isDevnet = chainId === 31337
export const isTestnet = TESTNETS.includes(chainId)
/** Networks running the demo deployment (mock Stock Tokens with issuer controls and a faucet). */
export const isDemo = isDevnet || isTestnet
export const explorer = chain.blockExplorers?.default.url
export const ROBINHOOD_FAUCET = 'https://faucet.testnet.chain.robinhood.com'
export const isRealStock = (token: Address) => !!book?.realStocks?.some((t) => t.toLowerCase() === token.toLowerCase())

/** Remembers the choice and reloads: chain, address book, clients and wallet config are all fixed at startup. */
export function switchNetwork(id: number) {
  if (id === chainId || !selectable(id)) return
  try {
    localStorage.setItem(STORAGE_KEY, String(id))
    const url = new URL(window.location.href)
    url.searchParams.delete('chain')
    window.history.replaceState(null, '', url)
  } catch {}
  window.location.reload()
}

export const publicClient: PublicClient = createPublicClient({ chain, transport: http() })

export const abis = abisJson as unknown as Record<
  | 'XeroVault'
  | 'XeroFactory'
  | 'XeroComponentToken'
  | 'XeroYieldMarket'
  | 'YieldMarketFactory'
  | 'CurveLens'
  | 'XeroRouter'
  | 'CorporateActionEngine'
  | 'RiskGuardian'
  | 'XeroOracle'
  | 'MockStockToken'
  | 'MockAggregator'
  | 'MockUSDG',
  Abi
>

export function read<T>(address: Address, abi: Abi, functionName: string, args: readonly unknown[] = []): Promise<T> {
  return publicClient.readContract({ address, abi, functionName, args }) as Promise<T>
}
