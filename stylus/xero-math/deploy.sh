#!/usr/bin/env bash
# Deploys and activates the Xero pricing engine on a Stylus-enabled chain.
# Robinhood Chain mainnet reports stylusVersion() = 3 (ArbWasm precompile 0x...71), so Stylus is available.
#
#   RPC_URL=https://rpc.mainnet.chain.robinhood.com ./deploy.sh --private-key-path ~/.keys/deployer
#
# Requires: cargo install --locked cargo-stylus   (large build; needs several GB free disk)
set -euo pipefail
cd "$(dirname "$0")"
: "${RPC_URL:?set RPC_URL}"

cargo test --release --quiet                       # engine tests + parity vectors
cargo stylus check --endpoint "$RPC_URL"            # validates WASM size, opcodes, activation
cargo stylus deploy --endpoint "$RPC_URL" --no-verify "$@"
echo
echo "Next: set \"xeroMath\" in deploy/<network>.json to the address above, then run DeployProduction."
echo "Before relying on it, replay the parity vectors against the deployed contract:"
echo "  XERO_MATH=<address> forge test --match-contract MathParityTest --fork-url \$RPC_URL"
