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

const CHAINS: Record<number, Chain> = { 4663: robinhoodChain, 46630: robinhoodTestnet, 31337: localChain }

/** Target network: VITE_CHAIN_ID, else Robinhood Chain testnet. Mainnet builds set VITE_CHAIN_ID=4663, the local devnet 31337. */
export const chainId: number = Number(import.meta.env.VITE_CHAIN_ID ?? 46630)
export const chain: Chain = CHAINS[chainId] ?? robinhoodTestnet
export const book: AddressBook | undefined = books[chainId]
export const isDevnet = chainId === 31337
export const isTestnet = chainId === 46630
/** Networks running the demo deployment (mock Stock Tokens with issuer controls and a faucet). */
export const isDemo = isDevnet || isTestnet
export const explorer = chain.blockExplorers?.default.url
export const ROBINHOOD_FAUCET = 'https://faucet.testnet.chain.robinhood.com'
export const isRealStock = (token: Address) => !!book?.realStocks?.some((t) => t.toLowerCase() === token.toLowerCase())

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
