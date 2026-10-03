#!/usr/bin/env bash
# Deploys the Xero demo to a public testnet and builds the app, which carries every deployment in app/src/deployments.
#
#   ./scripts/deploy-testnet.sh robinhood     # Robinhood Chain testnet (46630), the default
#   ./scripts/deploy-testnet.sh arbitrum      # Arbitrum Sepolia (421614)
#
# One-time setup (your key never leaves your machine; Foundry stores it encrypted):
#   cast wallet new                                   # or use an existing testnet-only key
#   cast wallet import xero-testnet --interactive     # paste the private key, set a password
#   (optional) put the password in ~/.foundry/xero-testnet.password (chmod 600) to skip the prompt
# Fund the deployer:
#   robinhood  https://faucet.testnet.chain.robinhood.com  (~0.01 ETH)
#   arbitrum   a faucet, or bridge Ethereum Sepolia ETH at https://bridge.arbitrum.io  (~0.01 ETH)
#
# The address book app/src/deployments/<chainId>.json is the live deployment, so an existing one is never
# overwritten by accident: set XERO_REDEPLOY=1 to replace it. If a run stops part-way, finish it with
#   cd contracts && forge script script/DeployDemo.s.sol --rpc-url <rpc> --resume --account xero-testnet
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK=${1:-robinhood}
case "$NETWORK" in
  robinhood)
    CHAIN_ID=46630; MIN_ETH=0.005
    RPC=${ROBINHOOD_TESTNET_RPC:-https://rpc.testnet.chain.robinhood.com/rpc}
    FUND="https://faucet.testnet.chain.robinhood.com" ;;
  arbitrum)
    CHAIN_ID=421614; MIN_ETH=0.01
    RPC=${ARBITRUM_SEPOLIA_RPC:-https://sepolia-rollup.arbitrum.io/rpc}
    FUND="a faucet or https://bridge.arbitrum.io (Ethereum Sepolia ETH)" ;;
  *) echo "usage: $0 [robinhood|arbitrum]"; exit 1 ;;
esac
ACCOUNT=${XERO_ACCOUNT:-xero-testnet}
PWFILE=${XERO_PASSWORD_FILE:-$HOME/.foundry/$ACCOUNT.password}
SIGNER=(--account "$ACCOUNT"); [ -f "$PWFILE" ] && SIGNER+=(--password-file "$PWFILE")
BOOK="$ROOT/app/src/deployments/$CHAIN_ID.json"

[ "$(cast chain-id --rpc-url "$RPC")" = "$CHAIN_ID" ] || { echo "RPC is not chain $CHAIN_ID ($NETWORK)"; exit 1; }
if [ -f "$BOOK" ] && [ "${XERO_REDEPLOY:-}" != "1" ]; then
  echo "$BOOK already exists: that is the live $NETWORK deployment. Set XERO_REDEPLOY=1 to replace it."; exit 1
fi
ADDR=$(cast wallet address "${SIGNER[@]}")
BAL=$(cast balance "$ADDR" --rpc-url "$RPC" --ether)
echo "deployer $ADDR on $NETWORK, balance $BAL ETH"
awk "BEGIN{exit !($BAL >= $MIN_ETH)}" || { echo "need $MIN_ETH ETH: fund $ADDR via $FUND"; exit 1; }

cd "$ROOT/contracts"
forge build --silent
forge script script/DeployDemo.s.sol --rpc-url "$RPC" --broadcast --slow "${SIGNER[@]}" --sender "$ADDR" | grep -E "written|SUCCESS|Error"

cd "$ROOT/app"
node scripts/export-abis.mjs
pnpm build
echo
echo "Deployed to $NETWORK. The app build, with every network's address book, is in app/dist."
echo "Preview it with:  cd app && pnpm dev   (switch networks from the header, or open ?chain=$([ "$NETWORK" = arbitrum ] && echo arbitrum-sepolia || echo robinhood-testnet))"
echo "Mock price feeds go stale after 4 days; keep them fresh with ./scripts/testnet-feeds.sh $NETWORK"
