#!/usr/bin/env bash
# Deploys the Xero demo to Robinhood Chain testnet (chain 46630) and builds the app for it.
#
# One-time setup (your key never leaves your machine; Foundry stores it encrypted):
#   cast wallet new                                   # or use an existing testnet-only key
#   cast wallet import xero-testnet --interactive     # paste the private key, set a password
#   (optional) put the password in ~/.foundry/xero-testnet.password (chmod 600) to skip the prompt
#   fund it: https://faucet.testnet.chain.robinhood.com  (~0.01 testnet ETH is plenty)
#
#   ./scripts/deploy-testnet.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC=${ROBINHOOD_TESTNET_RPC:-https://rpc.testnet.chain.robinhood.com/rpc}
ACCOUNT=${XERO_ACCOUNT:-xero-testnet}
PWFILE=${XERO_PASSWORD_FILE:-$HOME/.foundry/$ACCOUNT.password}
SIGNER=(--account "$ACCOUNT"); [ -f "$PWFILE" ] && SIGNER+=(--password-file "$PWFILE")

[ "$(cast chain-id --rpc-url "$RPC")" = "46630" ] || { echo "RPC is not Robinhood Chain testnet"; exit 1; }
ADDR=$(cast wallet address "${SIGNER[@]}")
BAL=$(cast balance "$ADDR" --rpc-url "$RPC" --ether)
echo "deployer $ADDR balance $BAL ETH"
awk "BEGIN{exit !($BAL >= 0.005)}" || { echo "fund $ADDR at https://faucet.testnet.chain.robinhood.com first"; exit 1; }

cd "$ROOT/contracts"
forge build --silent
forge script script/DeployDemo.s.sol --rpc-url "$RPC" --broadcast --slow "${SIGNER[@]}" --sender "$ADDR" | grep -E "written|SUCCESS|Error"

cd "$ROOT/app"
node scripts/export-abis.mjs
VITE_CHAIN_ID=46630 pnpm build
echo
echo "Deployed. App build for testnet is in app/dist (deploy it to any static host, or preview with:"
echo "  cd app && pnpm dev)"
echo "Mock price feeds go stale after 4 days; keep them fresh with ./scripts/testnet-feeds.sh"
