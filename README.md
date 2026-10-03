# Xero Protocol

**Keep the stock. Trade the dividends.**

Robinhood Stock Tokens never pay cash dividends. Dividends are reinvested, and the token's on-chain `uiMultiplier()` grows: each token comes to represent more shares. Xero splits a Stock Token into two independently tradable claims:

```
1 SCHD Stock Token  ──strip──▶  xSCHD-PT-1Y   Principal: the shares you deposited, redeemable at maturity
                             +  xSCHD-YT-1Y   Yield: the extra shares reinvested dividends create until maturity
```

PT plus YT always equals the deposited token, and they recombine at any time. Markets at several maturities form an **onchain implied dividend curve**.

| Directory | What's in it |
|---|---|
| [`contracts/`](contracts/) | Solidity protocol (Foundry): vault, PT/YT, corporate-action engine, risk guardian, oracle, yield market, curve lens, router. Unit, fuzz, invariant, parity and **mainnet-fork** tests |
| [`stylus/xero-math/`](stylus/xero-math/) | Pricing engine in Rust for Arbitrum Stylus, bit-identical to the Solidity engine |
| [`services/keeper/`](services/keeper/) | Reporter + keeper: attests Robinhood corporate actions from Robinhood's public API, maintains vaults |
| [`app/`](app/) | Web app (React, wagmi, RainbowKit, TanStack Query, TradingView Lightweight Charts) |
| [`deploy/`](deploy/) | Production config for Robinhood Chain mainnet, plus rehearsal outputs |
| [`brand/`](brand/) | Logo, icons, social card, colour and type tokens |

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

**Splits never become phantom yield.** If the multiplier jumps without an attestation, or falls, or the token's `oraclePaused()` flag is set, the vault **freezes**. It stops accruing yield and blocks new deposits until a quorum of reporters attests the action. Recombination stays open throughout, and a PT+YT pair exit is exact however the frozen change is eventually classified. CRWD's live 4× multiplier from its 4:1 split is exercised in the fork tests.

**Yield market.** YT trades against its own Stock Token. The pool quotes an implied rate `r`, and the YT price is `r × τ` (τ = time to maturity), so prices decay toward zero at maturity without anyone trading. `r × I` is the implied dividend yield in share terms. LPs earn swap fees plus the yield of the YT the pool holds.

**Pricing engine.** The bisection solver used for buys is the expensive part (~500k gas in Solidity). It is implemented twice behind `IXeroMath`: once in Solidity and once in Rust for Stylus, which is enabled on Robinhood Chain (`stylusVersion() = 3`). 717 shared vectors check that the two engines agree bit for bit. `MathParityTest` can also replay those vectors against a deployed engine.

**Safety.**
- The guardian can pause new deposits and trading, but can never move funds or block exits.
- Admin powers sit behind a `TimelockController` run by a Safe.
- The oracle reads Chainlink's tokenized-equity feeds (price × multiplier, 8 decimals) with per-asset staleness limits. Prices are informational only; no settlement depends on them.

---

## Robinhood Chain testnet

The app targets Robinhood Chain testnet (chain 46630) by default. The deployment there ([address book](app/src/deployments/46630.json)) has 25 markets on two kinds of asset:

- **Robinhood's own testnet Stock Tokens** (TSLA, AMZN, PLTR, NFLX, AMD), listed in [`deploy/robinhood-testnet.json`](deploy/robinhood-testnet.json). Each has a 1-year market seeded from the deployer's balance. Get more at the [Robinhood faucet](https://faucet.testnet.chain.robinhood.com). None of them pays dividends, so their YT accrues nothing unless Robinhood moves the multiplier, and the opening yields are a nominal 0.5%.
- **ERC-8056 mocks of dividend payers** (AAPL, SCHD, XOM, SGOV) using the prices, multipliers and trailing dividends observed on mainnet on 2 Oct 2026, at five maturities from 1 week to 2 years. They have a public faucet (about $10k a day) and issuer controls for the deployer wallet: reinvest dividends, and split with or without attestation. This is where the dividend mechanics can be seen working.

**Testnet** in the nav opens the console. Price feeds are deployer-owned mocks for both kinds, because Chainlink has no feeds on testnet.

Requires Foundry, Node 20+ and pnpm.

```sh
cast wallet import xero-testnet --interactive    # a testnet-only key, stored encrypted by Foundry
# fund it with ~0.01 ETH and a few of each real token: https://faucet.testnet.chain.robinhood.com
# (a full deploy costs ~0.002 ETH)
./scripts/deploy-testnet.sh                      # deploys, writes app/src/deployments/46630.json, builds app/dist
cd app && pnpm dev                               # app on :5173 against testnet
./scripts/testnet-feeds.sh                       # every day or two: mock feeds go stale after 4 days
```

Put the keystore password in `~/.foundry/xero-testnet.password` (chmod 600) to skip the prompts.

```sh
cd app && node scripts/smoke.mjs                             # every page, desktop + mobile, no console errors or overflow
cd app && E2E_ACCOUNT=xero-testnet node scripts/e2e.mjs      # real UI + real testnet txs: buy, sell, fix, strip, recombine, LP
```

The e2e run injects a browser wallet that signs inside the test process with that keystore account, so the key never reaches the page.

## Local devnet

For fast iteration, and for things testnet can't do, such as time travel:

```sh
./scripts/dev.sh            # anvil + deploy + ~5 weeks of simulated market history + app at :5173 on chain 31337
```

In the app, **Connect wallet → Devnet personas** gives you Alice, Bob, Carol and Issuer as wallets. **Devnet** in the nav opens the issuer console, which adds time travel.

```sh
cd contracts && forge test                                   # 64 tests: unit, fuzz, invariant, parity
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com \
  forge test --match-path "test/fork/*"                      # against the real Stock Token contracts
cd stylus/xero-math && cargo test --release                  # Rust engine + parity vectors
cd services/keeper && pnpm test                              # corporate-action mapping
cd app && node scripts/e2e.mjs                               # same UI flows, as the Alice persona
```

## Mainnet runbook (Robinhood Chain, 4663)

1. **Config.** Fill in [`deploy/robinhood-mainnet.json`](deploy/robinhood-mainnet.json): governance Safe, guardian Safe, treasury, reporter addresses, Chainlink feeds, and review the opening yields. The token addresses are already verified against Robinhood's asset registry and on-chain.
2. **Stylus engine (optional).** Run `RPC_URL=… stylus/xero-math/deploy.sh`, set `xeroMath`, then replay the parity vectors against the deployed engine.
3. **Rehearse on a fork.** `anvil --fork-url https://rpc.mainnet.chain.robinhood.com`, then `XERO_REHEARSAL=true forge script script/DeployProduction.s.sol …`. This has already been done: 24 vaults and markets on the real AAPL, SCHD, XOM, SGOV, SPY and MSFT tokens, all post-conditions passing, about 0.015 ETH of gas. The timelock and Safe acceptance flow was also simulated.
4. **Deploy** with `forge script script/DeployProduction.s.sol --broadcast --verify --account deployer`. The script preflights every dependency, hands all admin roles to the timelock and the pause role to the guardian Safe, renounces every deployer role, and writes `deploy/out/4663-safe-accept-ownership.json` for the Safe.
5. **Run reporters.** Start `services/keeper` with each reporter key (`DRY_RUN=false`). It attests Robinhood corporate actions in effective-time order and syncs vaults at maturity. Already verified against the live API on a mainnet fork: two reporters reaching quorum on SGOV and SPY dividends.
6. **Seed markets.** `MARKET=… UNITS=… OPENING_YIELD=… forge script script/SeedMarket.s.sol`.
7. **Ship the app** with `VITE_CHAIN_ID=4663` and `VITE_WALLETCONNECT_PROJECT_ID` set, then `pnpm build`.

### Before mainnet

- **Independent audit** of `contracts/src` and the keeper. Not yet done.
- **Legal review.** These are claims on tokenized securities. Robinhood Stock Tokens are offered only in certain jurisdictions, and the app's footer and geo-restrictions need counsel's sign-off.
- **Chainlink feed addresses** for Robinhood Chain must be obtained from Chainlink. There is no Chainlink sequencer-uptime feed on Robinhood Chain today, so the oracle supports one but runs without it.
- **Ops rule:** don't create a vault in the same second an unattested split takes effect. The vault would freeze; it would not misprice anything.
