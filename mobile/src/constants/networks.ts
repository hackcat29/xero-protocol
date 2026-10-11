export type NetworkConfig = {
  id: number
  name: string
  testnet: boolean
  rpcUrl: string
  explorer?: string
}

export const NETWORKS: NetworkConfig[] = [
  {
    id: 46630,
    name: 'Robinhood Chain Testnet',
    testnet: true,
    rpcUrl: 'https://rpc.testnet.chain.robinhood.com/rpc',
    explorer: 'https://explorer.testnet.chain.robinhood.com',
  },
  {
    id: 421614,
    name: 'Arbitrum Sepolia',
    testnet: true,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
  },
  {
    id: 4663,
    name: 'Robinhood Chain',
    testnet: false,
    rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
    explorer: 'https://robin.etherscan.io',
  },
  {
    id: 31337,
    name: 'Local Devnet',
    testnet: true,
    rpcUrl: 'http://127.0.0.1:8545',
  },
]

export const PERSONAS = [
  {
    name: 'Alice',
    blurb: 'Holds stock, sells her future dividends',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    color: '#3B82F6',
  },
  {
    name: 'Bob',
    blurb: 'Buys dividend yield without price risk',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    color: '#10B981',
  },
  {
    name: 'Carol',
    blurb: 'Trades the dividend curve',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    color: '#8B5CF6',
  },
  {
    name: 'Issuer',
    blurb: 'Reinvests dividends, splits, attests',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    color: '#F5B229',
    issuer: true,
  },
]
