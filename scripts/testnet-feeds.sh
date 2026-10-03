#!/usr/bin/env bash
# Re-publishes every mock price feed on the testnet demo so the oracle's 4-day staleness limit never trips
# (stale feeds show USD values as 0 in the app). Same signer setup as deploy-testnet.sh. Run every day or two:
#   ./scripts/testnet-feeds.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC=${ROBINHOOD_TESTNET_RPC:-https://rpc.testnet.chain.robinhood.com/rpc}
ACCOUNT=${XERO_ACCOUNT:-xero-testnet}
PWFILE=${XERO_PASSWORD_FILE:-$HOME/.foundry/$ACCOUNT.password}
SIGNER=(--account "$ACCOUNT"); [ -f "$PWFILE" ] && SIGNER+=(--password-file "$PWFILE")

for FEED in $(node -e 'console.log(require(process.argv[1]).feeds.join(" "))' "$ROOT/app/src/deployments/46630.json"); do
  ANSWER=$(cast call "$FEED" "answer()(int256)" --rpc-url "$RPC" | cut -d" " -f1)
  cast send "$FEED" "setAnswer(int256)" "$ANSWER" --rpc-url "$RPC" "${SIGNER[@]}" >/dev/null
  echo "refreshed $FEED at $ANSWER"
done
