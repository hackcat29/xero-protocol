#!/usr/bin/env bash
# Re-publishes every mock price feed on a testnet demo so the oracle's 4-day staleness limit never trips
# (stale feeds show USD values as 0 in the app). Same signer setup as deploy-testnet.sh. Run every day or two:
#   ./scripts/testnet-feeds.sh [base-sepolia|robinhood|arbitrum]      (default: base-sepolia)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NETWORK=${1:-base-sepolia}
case "$NETWORK" in
  base-sepolia) CHAIN_ID=84532; RPC=${BASE_SEPOLIA_RPC:-https://sepolia.base.org} ;;
  robinhood) CHAIN_ID=46630; RPC=${ROBINHOOD_TESTNET_RPC:-https://rpc.testnet.chain.robinhood.com/rpc} ;;
  arbitrum) CHAIN_ID=421614; RPC=${ARBITRUM_SEPOLIA_RPC:-https://sepolia-rollup.arbitrum.io/rpc} ;;
  *) echo "usage: $0 [base-sepolia|robinhood|arbitrum]"; exit 1 ;;
esac
ACCOUNT=${XERO_ACCOUNT:-xero-testnet}
PWFILE=${XERO_PASSWORD_FILE:-$HOME/.foundry/$ACCOUNT.password}
SIGNER=(--account "$ACCOUNT"); [ -f "$PWFILE" ] && SIGNER+=(--password-file "$PWFILE")

for FEED in $(node -e 'console.log(require(process.argv[1]).feeds.join(" "))' "$ROOT/app/src/deployments/$CHAIN_ID.json"); do
  ANSWER=$(cast call "$FEED" "answer()(int256)" --rpc-url "$RPC" | cut -d" " -f1)
  cast send "$FEED" "setAnswer(int256)" "$ANSWER" --rpc-url "$RPC" "${SIGNER[@]}" >/dev/null
  echo "refreshed $FEED at $ANSWER on $NETWORK"
done
