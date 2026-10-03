# Deployment configs

`robinhood-mainnet.json` drives `contracts/script/DeployProduction.s.sol`. Before a mainnet run, fill in:

| Field | What | Status |
|---|---|---|
| `governance.safe` | Safe that proposes and executes timelocked admin actions | **required** |
| `governance.guardianSafe` | Safe holding the fast emergency-pause role (can't move funds) | **required** |
| `governance.treasury` | Fee recipient | **required** |
| `reporters.addresses` | Corporate-action reporter keys, at least `quorum` of them (run `services/keeper`) | **required** |
| `xeroMath` | Stylus pricing engine address (`stylus/xero-math/deploy.sh`); zero deploys the Solidity engine | optional |
| `assets.feeds` | Chainlink tokenized-equity feed per asset (Chainlink provides Robinhood Chain addresses on request) | recommended |
| `assets.openingYieldsWad` | Opening implied dividend yield per asset, used to size new markets; confirm with market makers | review |

Token addresses come from Robinhood's asset registry (`GET https://api.robinhood.com/rhj/assets`) and were checked on-chain. The script refuses to run on mainnet while any required field is zero, and re-verifies every token, the USDG contract and every feed before deploying.
