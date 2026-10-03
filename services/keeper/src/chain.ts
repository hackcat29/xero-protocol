import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export type AddressBook = {
  chainId: number
  engine: Address
  factory: Address
  guardian: Address
  stocks: Address[]
  vaults?: Address[]
}

export const engineAbi = parseAbi([
  'function report(address token,uint8 kind,uint64 effectiveAt,uint128 value,uint128 value2,bytes32 ref) returns (bool)',
  'function refUsed(bytes32) view returns (bool)',
  'function confirmedBy(bytes32,address) view returns (bool)',
  'function actionCount(address) view returns (uint256)',
  'function getAction(address,uint256) view returns ((uint8 kind,uint64 effectiveAt,uint64 attestedAt,uint128 value,uint128 value2,bytes32 ref))',
])
export const factoryAbi = parseAbi(['function vaultsOf(address) view returns (address[])'])
export const tokenAbi = parseAbi([
  'function symbol() view returns (string)',
  'function uiMultiplier() view returns (uint256)',
  'function newUIMultiplier() view returns (uint256)',
  'function effectiveAt() view returns (uint256)',
  'function oraclePaused() view returns (bool)',
])
export const vaultAbi = parseAbi([
  'function sync()',
  'function frozen() view returns (bool)',
  'function halted() view returns (bool)',
  'function maturity() view returns (uint64)',
  'function maturityIndex() view returns (uint256)',
  'function dividendIndex() view returns (uint256)',
  'function structuralFactor() view returns (uint256)',
  'function invariantHolds() view returns (bool)',
  'function yieldToken() view returns (address)',
])
export const guardianAbi = parseAbi(['function enforceInvariant(address) returns (bool)'])

export function loadBook(path: string): AddressBook {
  return JSON.parse(readFileSync(path, 'utf8')) as AddressBook
}

export function clients(rpcUrl: string, chainId: number, reporterKey?: Hex, keeperKey?: Hex) {
  const chain = defineChain({
    id: chainId,
    name: chainId === 4663 ? 'Robinhood Chain' : `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
  const mk = (k?: Hex) =>
    k ? createWalletClient({ account: privateKeyToAccount(k), chain, transport: http(rpcUrl) }) : undefined
  return { publicClient, reporter: mk(reporterKey), keeper: mk(keeperKey ?? reporterKey) }
}
