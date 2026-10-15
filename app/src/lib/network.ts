import { createPublicClient, defineChain, fallback, http, type Abi, type Address, type Chain, type PublicClient, type Transport } from 'viem'
import abisJson from './abis.json'

export const baseMainnet = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_BASE_RPC ?? 'https://mainnet.base.org'] } },
  blockExplorers: { default: { name: 'BaseScan', url: 'https://basescan.org' } },
})

export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_BASE_SEPOLIA_RPC ?? 'https://base-sepolia-rpc.publicnode.com'] } },
  blockExplorers: { default: { name: 'BaseScan Sepolia', url: 'https://sepolia.basescan.org' } },
  testnet: true,
})

export const localChain = defineChain({
  id: 31337,
  name: 'Base Local Devnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_LOCAL_RPC ?? 'http://127.0.0.1:8545'] } },
})

export type AddressBook = {
  chainId: number
  startBlock?: number
  deployer: Address
  usdc: Address
  guardian: Address
  engine: Address
  factory: Address
  math: Address
  markets: Address
  oracle: Address
  lens: Address
  baseLens?: Address
  router: Address
  stocks: Address[]
  feeds?: Address[]
  actors?: Address[]
}

const books = Object.fromEntries(
  Object.values(import.meta.glob<AddressBook>('../deployments/*.json', { eager: true, import: 'default' })).map(
    (b) => [b.chainId, b],
  ),
) as Record<number, AddressBook>

const CHAINS: Record<number, Chain> = {
  8453: baseMainnet,
  84532: baseSepolia,
  31337: localChain,
}

const SLUGS: Record<string, number> = {
  'base': 8453,
  'base-sepolia': 84532,
  'local': 31337,
}

const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 84532)

export const networks: Chain[] =
  DEFAULT_CHAIN_ID === 31337
    ? [localChain]
    : [...new Set([DEFAULT_CHAIN_ID, ...Object.keys(books).map(Number).filter((id) => id !== 31337)])]
        .map((id) => CHAINS[id])
        .filter((c): c is Chain => !!c)

const STORAGE_KEY = 'xero.base.chainId'
const selectable = (id: number) => networks.some((n) => n.id === id)

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
export const chain: Chain = CHAINS[chainId] ?? baseSepolia
export const book: AddressBook | undefined = books[chainId] ?? books[84532] ?? (Object.values(books)[0] as AddressBook)
export const isDevnet: boolean = chainId === 31337
export const isTestnet: boolean = chainId === 84532
export const isDemo: boolean = isDevnet || isTestnet
export const explorer = chain.blockExplorers?.default.url
export const BASE_FAUCET_URL = 'https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet'
export const isRealStock = (_token?: Address): boolean => false

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

/** Backup endpoints per chain. Public RPCs drop or rate-limit requests under load, so reads and simulations
 *  fall through to the next endpoint instead of failing the user's action. */
const BACKUP_RPCS: Record<number, string[]> = {
  8453: ['https://base-rpc.publicnode.com'],
  84532: ['https://sepolia.base.org'],
}
export const transport: Transport = fallback(
  [chain.rpcUrls.default.http[0], ...(BACKUP_RPCS[chain.id] ?? [])].map((url) => http(url, { retryCount: 2 })),
)
export const publicClient: PublicClient = createPublicClient({ chain, transport })
/** Event queries stay on the primary endpoint: backups can have much smaller block-range limits. */
export const logClient: PublicClient = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0], { retryCount: 3 }) })

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
  | 'MockUSDG'
  | 'MockB20StockToken'
  | 'BaseB20YieldLens',
  Abi
>

export function read<T>(address: Address, abi: Abi, functionName: string, args: readonly unknown[] = []): Promise<T> {
  return publicClient.readContract({ address, abi, functionName, args }) as Promise<T>
}
