# Xero

**Stocks at a discount. Dividends in advance.**

Xero is the first platform to split tokenized stocks into the share and its dividends. Investors buy shares below today's price; shareholders take their future dividends upfront and keep their stock.

**Live on Base Sepolia: [xeroprotocol.com](https://xeroprotocol.com)** · Docs: [`docs/`](docs/) (Mintlify)

Tokenized stocks never pay cash dividends. Dividends are reinvested, and the token's on-chain `uiMultiplier()` grows: each token comes to represent more shares. Xero splits a tokenized stock into two independently tradable tokens:

```
1 MSFTc  ──split──▶  share token     xMSFTc-PT-1Y   becomes the share at maturity
                  +  dividend token  xMSFTc-YT-1Y   collects every dividend until then
```

The two always add up to one share and can be rejoined before maturity. Buying only the share token is **buying at a discount**; selling the dividend token is **getting dividends upfront**. Markets at several maturities form an **on-chain implied dividend curve**.

| Directory | What's in it |
|---|---|
| [`contracts/`](contracts/) | Solidity protocol (Foundry): vault, PT/YT, corporate-action engine, risk guardian, oracle, yield market, curve lens, router. Unit, fuzz, invariant, parity and **mainnet-fork** tests |
| [`stylus/xero-math/`](stylus/xero-math/) | The pricing engine in Rust (Arbitrum Stylus), kept bit-identical to the Solidity engine Base uses |
| [`services/keeper/`](services/keeper/) | Reporter + keeper: attests corporate actions and maintains vaults (its data source still targets the earlier Robinhood Chain deployment; see Before mainnet) |
| [`app/`](app/) | Web app (React, wagmi, RainbowKit, TanStack Query, TradingView Lightweight Charts) |
| [`deploy/`](deploy/) | Production config for Base mainnet ([`base-mainnet.json`](deploy/base-mainnet.json)), plus earlier configs and rehearsal outputs |
| [`docs/`](docs/) | User and developer documentation ([Mintlify](https://mintlify.com)); preview with `cd docs && npx mint dev` |
| [`brand/`](brand/) | Logo and colour sources; `node brand/render.mjs` renders the app icons, social card and docs logos |

---

## How it works

**Indexes.** A Stock Token's multiplier `M` moves for two different reasons: reinvested dividends (yield) and splits (structural). The vault keeps a structural factor `S`, built from splits and stock dividends attested by the `CorporateActionEngine`. From that it derives a **dividend index**, `I = M / S`, which only grows with dividends.

**Accounting** (the Pendle PT/YT model, applied to ERC-8056):

| | |
|---|---|
| Strip `raw` tokens at index `I₀` | mint `units = raw × I₀` of PT and YT |
| PT at maturity | redeems for `units ÷ I_maturity` raw tokens. Growth after maturity stays inside those tokens |
| YT accrual | `units × (1/I_prev − 1/I_now)` raw tokens, claimable at any time, less a protocol yield fee |
| Recombine | `units ÷ I` raw tokens for a PT + YT pair, at any time before maturity |

**Splits never become phantom yield.** If the multiplier jumps without an attestation, or falls, or the token's `oraclePaused()` flag is set, the vault **freezes**. It stops accruing yield and blocks new deposits until a quorum of reporters attests the action. Recombination stays open throughout, and a PT+YT pair exit is exact however the frozen change is eventually classified.

**Yield market.** YT trades against its own Stock Token. The pool quotes an implied rate `r`, and the YT price is `r × τ` (τ = time to maturity), so prices decay toward zero at maturity without anyone trading. `r × I` is the implied dividend yield in share terms. LPs earn swap fees plus the yield of the YT the pool holds.

**Pricing engine.** The bisection solver used for buys is the expensive part (~500k gas in Solidity). It is implemented twice behind `IXeroMath`: once in Solidity (used on Base) and once in Rust for Arbitrum Stylus. 717 shared vectors check that the two engines agree bit for bit. `MathParityTest` can also replay those vectors against a deployed engine.

**Safety.**
- The guardian can pause new deposits and trading, but can never move funds or block exits.
- Admin powers sit behind a `TimelockController` run by a Safe.
- The oracle reads Chainlink's tokenized-equity feeds (price × multiplier, 8 decimals) with per-asset staleness limits. Prices are informational only; no settlement depends on them.

---

## The stocks

Xero lists the **Coinbase B20 stocks on Base** ([base.org/stocks](https://www.base.org/stocks)): Apple, Amazon, Alphabet, Meta, Microsoft, Strategy, NVIDIA, SanDisk, SpaceX and Tesla. B20 tokens carry dividends in a multiplier (`multiplier()`, with `uiMultiplier()` as the ERC-8056 alias), which is what the vault reads. Five pay a dividend (Microsoft, Apple, Meta, Alphabet, NVIDIA) and get markets; the other five have nothing to split and are listed for reference.

## Testnet (Base Sepolia)

The live app runs on Base Sepolia ([address book](app/src/deployments/84532.json)) with test versions of all ten B20 stocks at mainnet prices and multipliers (read on-chain on 15 Oct 2026), and 1W/3M/6M/1Y markets for the five dividend payers. Each test stock has a public faucet (once a day per address); the deployer wallet is also the test issuer, and the app's **Get test tokens** dialog gives it controls to pay dividends, split stocks and move prices. Price feeds are deployer-owned mocks.

Requires Foundry, Node 20+ and pnpm.

```sh
cast wallet import xero-testnet --interactive    # a testnet-only key, stored encrypted by Foundry
# fund it with ~0.01 Base Sepolia ETH (a full deploy costs ~0.0025 ETH)
cd contracts && DEMO_ACTORS=<address> forge script script/DeployBase.s.sol \
  --rpc-url https://base-sepolia-rpc.publicnode.com --account xero-testnet --sender <address> --broadcast --slow
                                                 # writes app/src/deployments/84532.json; add --resume if the RPC drops a request
cd app && VITE_CHAIN_ID=84532 pnpm dev           # app on :5173
./scripts/testnet-feeds.sh base-sepolia          # every day or two: mock feeds go stale after 4 days
```

Put the keystore password in `~/.foundry/xero-testnet.password` (chmod 600) to skip the prompts.

The app deploys to Cloudflare Workers ([`app/wrangler.jsonc`](app/wrangler.jsonc)) from GitHub Actions on every push to `main`, after the contract, Stylus, keeper and app checks pass. It serves `xeroprotocol.com` and `www.xeroprotocol.com`. CI needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets and reads `VITE_WALLETCONNECT_PROJECT_ID` from the repository variables; to deploy by hand, run `cd app && VITE_CHAIN_ID=84532 pnpm build && npx wrangler deploy`.

```sh
cd app && node scripts/smoke.mjs                             # every page, desktop + mobile, no console errors or overflow
cd app && E2E_ACCOUNT=xero-testnet node scripts/e2e.mjs      # real UI + real testnet txs: discount, upfront, dividends, split, rejoin, LP
```

The e2e run injects a browser wallet that signs inside the test process with that keystore account, so the key never reaches the page.

## Local devnet

For fast iteration, and for things testnet can't do, such as time travel: start `anvil`, run `DeployBase.s.sol` against it (see [local development](docs/developers/local-development.mdx)), then `cd app && VITE_CHAIN_ID=31337 pnpm dev`.

```sh
cd contracts && forge test                                   # 74 tests: unit, fuzz, invariant, parity
cd stylus/xero-math && cargo test --release                  # Rust engine + parity vectors
cd services/keeper && pnpm test                              # corporate-action mapping
```

## Mainnet runbook (Base, 8453)

See [`deploy/README.md`](deploy/README.md) for the full runbook: fill in [`deploy/base-mainnet.json`](deploy/base-mainnet.json) (the B20 token and Chainlink feed addresses are already filled in and checked on-chain; governance Safes, treasury and reporters are not), rehearse on a Base mainnet fork, deploy with `DeployBaseProduction.s.sol`, accept ownership through the Safe, seed markets, and ship the app with `VITE_CHAIN_ID=8453`.

### Before mainnet

- **8-decimal tokens.** B20 stocks use 8 decimals; the vault and market assume 18. This needs a decimals-aware vault (or a wrapper) before any mainnet deployment.
- **Corporate-action data.** The keeper's data source targets the earlier Robinhood Chain deployment. On Base it needs to follow Coinbase's corporate actions and the B20 oracle registry (`0x3f3E8cf41cdd3b1D118c16471aB0113DfDDd5CaD`), whose `paused` flag is set during corporate actions.
- **Independent audit** of `contracts/src` and the keeper. Not yet done.
- **Legal review.** These are claims on tokenized securities. Coinbase offers B20 stocks only to eligible users outside the US, and the app's footer and geo-restrictions need counsel's sign-off.
- **Ops rule:** don't create a vault in the same second an unattested split takes effect. The vault would freeze; it would not misprice anything.
