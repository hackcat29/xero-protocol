#!/usr/bin/env bash
# One-command local demo (the app otherwise targets Robinhood Chain testnet): anvil + full Xero deployment + simulated market history + app on http://localhost:5173
#   ./scripts/dev.sh            (add --no-sim to skip the ~5-week market simulation)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC=http://127.0.0.1:8545
KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 # anvil #0, public dev key

if ! cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "▸ starting anvil"
  anvil --silent > "$ROOT/.anvil.log" 2>&1 &
  trap 'kill $! 2>/dev/null' EXIT
  for _ in $(seq 1 30); do cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 && break; sleep 0.3; done
fi

echo "▸ deploying Xero (mock ERC-8056 Stock Tokens, 16 markets)"
cd "$ROOT/contracts" && forge build --silent
forge script script/DeployDemo.s.sol --rpc-url "$RPC" --broadcast --slow --private-key "$KEY" | grep -E "written|SUCCESS"

cd "$ROOT/app"
[ -d node_modules ] || pnpm install
node scripts/export-abis.mjs
if [[ "${1:-}" != "--no-sim" ]]; then echo "▸ simulating market history"; node scripts/simulate.mjs 120; fi
echo "▸ app on http://localhost:5173  (connect → 'Devnet personas')"
VITE_CHAIN_ID=31337 pnpm exec vite --port 5173
