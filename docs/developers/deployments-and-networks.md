---
description: Official network configurations, smart contract deployment addresses, and protocol parameters.
---

# Deployments & Network Addresses

Xero Protocol is live on Base Sepolia testnet. The Base Mainnet launch is prepared (configuration below) but not yet deployed: it is waiting on the governance Safes, reporter keys, and the Coinbase B20 token and price feed addresses in `deploy/base-mainnet.json`.

---

## 🔵 Base Mainnet (`8453`): planned

| Parameter | Configuration | Notes |
| :--- | :--- | :--- |
| **Network Name** | Base Mainnet | L2 Rollup on Ethereum |
| **Chain ID** | `8453` | Standard EVM |
| **Public RPC** | `https://mainnet.base.org` | Official Coinbase RPC |
| **Block Explorer** | [basescan.org](https://basescan.org) | Etherscan-compatible |
| **Native USDC** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Circle Native USDC on Base |
| **Chainlink L2 Sequencer Feed** | `0xBCF85224fc0756B9Fa45aA7892530B47e10b6433` | 1-hour grace period enforcement |

### Governance & Timelock
* **Timelock Delay:** `172,800 seconds` (48 hours)
* **Reporter Quorum:** `2` independent signers required for corporate action attestations

### Protocol Fee Parameters
* **Strip Fee (`stripFeeBps`):** `5 bps` (0.05%)
* **Redemption Fee (`redeemFeeBps`):** `0 bps` (Free 1:1 principal redemption)
* **Yield Fee (`yieldFeeBps`):** `300 bps` (3.0% of harvested dividends)
* **AMM Swap Fee (`fee`):** `30 bps` (0.30% retained by LPs)

---

## 🧪 Base Sepolia Testnet (`84532`)

| Parameter | Configuration |
| :--- | :--- |
| **Network Name** | Base Sepolia |
| **Chain ID** | `84532` |
| **Public RPC** | `https://base-sepolia-rpc.publicnode.com` (the app's default; `sepolia.base.org` limits log queries to 200 blocks) |
| **Block Explorer** | [sepolia.basescan.org](https://sepolia.basescan.org) |
| **Deployment block** | `48125882` |

### Contracts

| Contract | Address |
| :--- | :--- |
| Router | [`0x7E0599870feCb35d7eeF423a3FEA8c8d69f8FB9b`](https://sepolia.basescan.org/address/0x7E0599870feCb35d7eeF423a3FEA8c8d69f8FB9b) |
| Vault factory (XeroFactory) | [`0x5CFD7B8c0309049c2663761275989eAcF5970d13`](https://sepolia.basescan.org/address/0x5CFD7B8c0309049c2663761275989eAcF5970d13) |
| Yield market factory | [`0x6846bB0d38f21Dff15B4113Ecfa8E2C2AeD4AD78`](https://sepolia.basescan.org/address/0x6846bB0d38f21Dff15B4113Ecfa8E2C2AeD4AD78) |
| Oracle | [`0x40d03034EDDB056B2Feb6E1937c4eEdC1c09b8Ac`](https://sepolia.basescan.org/address/0x40d03034EDDB056B2Feb6E1937c4eEdC1c09b8Ac) |
| Curve lens | [`0x651665e9416D4edeE40394559EEd6AF3808b02eb`](https://sepolia.basescan.org/address/0x651665e9416D4edeE40394559EEd6AF3808b02eb) |
| B20 yield lens | [`0x68Fcf90e3Ca514b4eE531C3E154868C86EE80Bc2`](https://sepolia.basescan.org/address/0x68Fcf90e3Ca514b4eE531C3E154868C86EE80Bc2) |
| Corporate action engine | [`0x97Be23dC9fE8bbCF3a2aff489F4Fa09c9b6D0510`](https://sepolia.basescan.org/address/0x97Be23dC9fE8bbCF3a2aff489F4Fa09c9b6D0510) |
| Risk guardian | [`0x3d491EcA91b7847e6CE3f549378EAa88DcD2739B`](https://sepolia.basescan.org/address/0x3d491EcA91b7847e6CE3f549378EAa88DcD2739B) |
| Math | [`0x7fA85040d72b8488762fCadDebf644f226c259bE`](https://sepolia.basescan.org/address/0x7fA85040d72b8488762fCadDebf644f226c259bE) |
| Mock USDC | [`0xC978bc986C8D5B64264229Dd362F425A1fb25D1d`](https://sepolia.basescan.org/address/0xC978bc986C8D5B64264229Dd362F425A1fb25D1d) |

### Assets

The stocks are mock B20 tokens with a public faucet, priced by mock Chainlink-style feeds. Each has 1W, 3M, 6M and 1Y markets (24 in total).

| Symbol | Token | Price feed |
| :--- | :--- | :--- |
| **`NVDAc`** | [`0x36A51ed210A17B22fc99DC668220832CFAD91e89`](https://sepolia.basescan.org/address/0x36A51ed210A17B22fc99DC668220832CFAD91e89) | [`0x439DCBc8f8b9874c93698057a642Ac0187BB1280`](https://sepolia.basescan.org/address/0x439DCBc8f8b9874c93698057a642Ac0187BB1280) |
| **`AAPLc`** | [`0xe8Ea1f6DB779ED3C95A217F1e12c5Df2C11C23cD`](https://sepolia.basescan.org/address/0xe8Ea1f6DB779ED3C95A217F1e12c5Df2C11C23cD) | [`0x6bB866b8A5023b98F568A9EA0FD5FBAd6ECA3821`](https://sepolia.basescan.org/address/0x6bB866b8A5023b98F568A9EA0FD5FBAd6ECA3821) |
| **`COINc`** | [`0x31a1e495C9E1b814B5c2ff6d4Ba032abE4C18B98`](https://sepolia.basescan.org/address/0x31a1e495C9E1b814B5c2ff6d4Ba032abE4C18B98) | [`0xD0aF9bDD799F6d2464393C457bBB396e93f395da`](https://sepolia.basescan.org/address/0xD0aF9bDD799F6d2464393C457bBB396e93f395da) |
| **`TSLAc`** | [`0xF809b376106c57565b0dd0A9383CdE550D952770`](https://sepolia.basescan.org/address/0xF809b376106c57565b0dd0A9383CdE550D952770) | [`0x7c9c7e008667696c9204aE236f4E3Cfd120517e7`](https://sepolia.basescan.org/address/0x7c9c7e008667696c9204aE236f4E3Cfd120517e7) |
| **`SPYc`** | [`0x53EB0F8F278A422cC194476Af24dc062Ae1386D4`](https://sepolia.basescan.org/address/0x53EB0F8F278A422cC194476Af24dc062Ae1386D4) | [`0x6683408257FE6B5C534A7ABb5c0792E1B84B02eD`](https://sepolia.basescan.org/address/0x6683408257FE6B5C534A7ABb5c0792E1B84B02eD) |
| **`SCHDc`** | [`0x7907723540f90dbEdFfe7F39dA23FC022D0dd81f`](https://sepolia.basescan.org/address/0x7907723540f90dbEdFfe7F39dA23FC022D0dd81f) | [`0x744039067b51a7B9BE699fe1ECa897F3FA982141`](https://sepolia.basescan.org/address/0x744039067b51a7B9BE699fe1ECa897F3FA982141) |

---

## 📋 Planned Asset Registry (Base Mainnet)

| Symbol | Underlying Stock / ETF | Initial Multiplier | Maturity Tenors |
| :--- | :--- | :--- | :--- |
| **`NVDAc`** | NVIDIA Corporation | `1.0000e18` | `1W`, `3M`, `6M`, `1Y` |
| **`AAPLc`** | Apple Inc. | `1.0000e18` | `1W`, `3M`, `6M`, `1Y` |
| **`COINc`** | Coinbase Global Inc. | `1.0000e18` | `1W`, `3M`, `6M`, `1Y` |
| **`TSLAc`** | Tesla Inc. | `1.0000e18` | `1W`, `3M`, `6M`, `1Y` |
| **`SPYc`** | SPDR S&P 500 ETF Trust | `1.0000e18` | `1W`, `3M`, `6M`, `1Y` |
| **`SCHDc`** | Schwab US Dividend Equity ETF | `1.0000e18` | `1W`, `3M`, `6M`, `1Y` |

{% hint style="info" %}
Mainnet token, feed and contract addresses will be published here after deployment. Configuration lives in [`deploy/base-mainnet.json`](https://github.com/hackcat29/xero-protocol/blob/main/deploy/base-mainnet.json).
{% endhint %}
