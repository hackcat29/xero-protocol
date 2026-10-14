# Production Deployment Guides

This directory contains configuration files and deployment artifacts for mainnet releases.

---

## 🔵 Base Mainnet Deployment (`base-mainnet.json`)

`deploy/base-mainnet.json` drives `contracts/script/DeployBaseProduction.s.sol` on Base Mainnet (Chain ID `8453`).

### Configuration Checklist

Before broadcasting to Base Mainnet, fill in the following fields in `deploy/base-mainnet.json`:

| Field | Description | Target / Requirement |
| :--- | :--- | :--- |
| `governance.safe` | Gnosis Safe multi-sig on Base that proposes and executes timelocked actions | **Required** (Safe{Wallet} on Base) |
| `governance.guardianSafe` | Fast emergency-pause Safe (can halt deposits, but cannot move user funds) | **Required** |
| `governance.treasury` | Protocol fee recipient address | **Required** |
| `governance.timelockDelay` | Delay in seconds for timelocked admin changes (default `172800` = 48 hours) | **Required** |
| `reporters.addresses` | Off-chain keeper addresses authorized to attest corporate actions / splits | **Required** (At least `quorum` keys) |
| `assets.tokens` | Addresses of Coinbase B20 tokenized equities (`NVDAc`, `AAPLc`, `COINc`, etc.) | **Required** |
| `assets.feeds` | Chainlink tokenized-equity price feed per asset on Base | Recommended |
| `assets.openingYieldsWad` | Initial implied dividend yields (WAD), agreed with market makers | Review |

---

## 🛠️ Step-by-Step Mainnet Runbook

### Step 1: Rehearse on a Live Base Mainnet Fork
Dry-run the complete deployment, post-condition assertions, and role transfers locally against a fork of Base Mainnet:
```bash
# Terminal 1: Spin up local fork of Base Mainnet
anvil --fork-url https://mainnet.base.org --chain-id 8453

# Terminal 2: Run rehearsal deployment
cd contracts
XERO_CONFIG=../deploy/base-mainnet.json XERO_REHEARSAL=true forge script script/DeployBaseProduction.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast --slow --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```
This writes `deploy/out/rehearsal-base-8453.json` and verifies that all post-conditions pass without modifying production address books.

---

### Step 2: Mainnet Broadcast & BaseScan Verification
Once config fields in `deploy/base-mainnet.json` are populated:
```bash
cd contracts

# Set your deployer key and BaseScan API key
export BASE_RPC_URL="https://mainnet.base.org"
export BASESCAN_API_KEY="your-basescan-api-key"

forge script script/DeployBaseProduction.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast --slow \
  --verify \
  --account deployer
```
*Note: Using Foundry's keystore `--account <name>` is recommended over passing raw private keys.*

---

### Step 3: Complete 2-Step Ownership Transfer in Safe{Wallet}
The deployment script renounces deployer roles and initiates a 2-step ownership transfer to the `TimelockController`.
The script automatically exports the batch file:
`deploy/out/8453-safe-accept-ownership.json`

1. Open **[Safe{Wallet} on Base](https://app.safe.global/home?safe=base:<YOUR_SAFE_ADDRESS>)**.
2. Open the **Transaction Builder** app.
3. Drag & drop `deploy/out/8453-safe-accept-ownership.json`.
4. Sign and execute the **schedule** call.
5. After the 48-hour timelock delay expires, sign and execute the **execute** call.

---

### Step 4: Seed Initial AMM Liquidity
For each live B20 market pool, seed initial liquidity depth via `SeedMarket.s.sol`:
```bash
cd contracts
MARKET=<MARKET_ADDRESS> UNITS=10000e18 OPENING_YIELD=0.038e18 forge script script/SeedMarket.s.sol \
  --rpc-url $BASE_RPC_URL --broadcast --account deployer
```

---

### Step 5: Start Off-Chain Reporter Keepers
Deploy `services/keeper` with the reporter keys configured in `reporters.addresses` to continuously listen to dividend declarations and stock split attestations.

---

### Step 6: Deploy Production UI (`xeroprotocol.com`)
1. Verify contract addresses in `app/src/deployments/8453.json`.
2. Build and publish the frontend to Cloudflare Pages:
```bash
cd app
npm run build
npx wrangler pages deploy dist --project-name xero-protocol
```
