// Xero keeper: (1) attests Robinhood corporate actions to the CorporateActionEngine as a reporter,
// (2) maintains vaults: settles maturity, syncs indexes, and trips the guardian on invariant breaches.
import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem'
import { STRUCTURAL, SUPPORTED, toAttestation, typeOf, type Attestation } from './actions.js'
import { clients, engineAbi, factoryAbi, guardianAbi, loadBook, tokenAbi, vaultAbi } from './chain.js'
import { fetchCorporateActions, fetchMidPrice, type RhCorporateAction } from './robinhood.js'

const env = (k: string, d?: string) => process.env[k] ?? d
const DRY_RUN = env('DRY_RUN', 'true') !== 'false'
const AUTO_HALT = env('AUTO_HALT', 'true') !== 'false'
const POLL = Number(env('POLL_SECONDS', '60')) * 1000
const book = loadBook(env('DEPLOYMENT', '../../deploy/out/4663.json')!)
const { publicClient, reporter, keeper } = clients(
  env('RPC_URL', 'https://rpc.mainnet.chain.robinhood.com')!,
  book.chainId,
  env('REPORTER_PRIVATE_KEY') as Hex | undefined,
  env('KEEPER_PRIVATE_KEY') as Hex | undefined,
)

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }, (_, v) => (typeof v === 'bigint' ? v.toString() : v)))

async function alert(text: string) {
  log('ALERT', { text })
  const url = env('ALERT_WEBHOOK_URL')
  if (url) await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }) }).catch(() => {})
}

// ------------------------------------------------------------------ reporter

async function tokensWithVaults(): Promise<Map<string, Address>> {
  const out = new Map<string, Address>()
  for (const token of book.stocks) {
    const vaults = await publicClient.readContract({ address: book.factory, abi: factoryAbi, functionName: 'vaultsOf', args: [token] })
    if (vaults.length > 0) out.set(token.toLowerCase(), token)
  }
  return out
}

async function effectiveTimeFor(a: RhCorporateAction, token: Address): Promise<bigint | undefined> {
  // A scheduled multiplier change exposes its exact effective time on-chain.
  const [cur, pending, at] = await Promise.all([
    publicClient.readContract({ address: token, abi: tokenAbi, functionName: 'uiMultiplier' }),
    publicClient.readContract({ address: token, abi: tokenAbi, functionName: 'newUIMultiplier' }),
    publicClient.readContract({ address: token, abi: tokenAbi, functionName: 'effectiveAt' }),
  ])
  if (STRUCTURAL.has(typeOf(a)) && pending !== cur && at > 0n) return at
  return undefined
}

async function lastEffectiveAt(token: Address): Promise<bigint> {
  const n = await publicClient.readContract({ address: book.engine, abi: engineAbi, functionName: 'actionCount', args: [token] })
  if (n === 0n) return 0n
  const a = await publicClient.readContract({ address: book.engine, abi: engineAbi, functionName: 'getAction', args: [token, n - 1n] })
  return a.effectiveAt
}

function payloadHash(token: Address, at: Attestation): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint8' }, { type: 'uint64' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'bytes32' }],
      [token, at.kind, at.effectiveAt, at.value, at.value2, at.ref],
    ),
  )
}

async function reportPass() {
  const tracked = await tokensWithVaults()
  const actions = (await fetchCorporateActions())
    .map((a) => ({ a, token: tracked.get(a.deployments.find((d) => d.chainId === book.chainId)?.contractAddress.toLowerCase() ?? '') }))
    .filter((x): x is { a: RhCorporateAction; token: Address } => !!x.token)

  const now = BigInt(Math.floor(Date.now() / 1000))
  const plans: { token: Address; at: Attestation; a: RhCorporateAction }[] = []
  for (const { a, token } of actions) {
    const kind = typeOf(a)
    if (!SUPPORTED.has(kind) && !AUTO_HALT) {
      await alert(`Unsupported ${kind} for ${a.tokenSymbol} (${a.id}); AUTO_HALT disabled, manual review needed`)
      continue
    }
    // Structural actions are attested once the token schedules or applies them.
    if (STRUCTURAL.has(kind) && a.status === 'CORPORATE_ACTION_STATUS_IN_PROGRESS') {
      const onchain = await effectiveTimeFor(a, token)
      if (onchain === undefined) continue
    }
    const at = toAttestation(a, {
      effectiveAt: await effectiveTimeFor(a, token),
      priceUsd: kind === 'CASH_DIVIDEND' ? await fetchMidPrice(a.tokenSymbol).catch(() => undefined) : undefined,
    })
    if (!at) continue
    if (at.effectiveAt + (STRUCTURAL.has(kind) ? 30n : 1n) * 86400n < now) continue // beyond the engine's backdating window
    if (await publicClient.readContract({ address: book.engine, abi: engineAbi, functionName: 'refUsed', args: [at.ref] })) continue
    plans.push({ token, at, a })
  }

  // The engine requires non-decreasing effective times per token.
  plans.sort((x, y) => (x.at.effectiveAt < y.at.effectiveAt ? -1 : x.at.effectiveAt > y.at.effectiveAt ? 1 : 0))
  for (const { token, at, a } of plans) {
    const last = await lastEffectiveAt(token)
    if (at.effectiveAt < last) {
      await alert(`${a.tokenSymbol} ${at.kindName} ${a.id} is older than the last attested action; needs manual review`)
      continue
    }
    if (reporter) {
      const mine = await publicClient.readContract({
        address: book.engine, abi: engineAbi, functionName: 'confirmedBy', args: [payloadHash(token, at), reporter.account!.address],
      })
      if (mine) continue
    }
    const args = [token, at.kind, at.effectiveAt, at.value, at.value2, at.ref] as const
    if (DRY_RUN || !reporter) {
      log('would attest', { symbol: a.tokenSymbol, type: at.kindName, id: a.id, args })
      continue
    }
    const { request } = await publicClient.simulateContract({ account: reporter.account!, address: book.engine, abi: engineAbi, functionName: 'report', args })
    const hash = await reporter.writeContract(request)
    await publicClient.waitForTransactionReceipt({ hash })
    log('attested', { symbol: a.tokenSymbol, type: at.kindName, id: a.id, hash })
    if (!SUPPORTED.has(at.kindName)) await alert(`${a.tokenSymbol}: ${at.kindName} attested; stripping halted`)
  }
}

// ------------------------------------------------------------------ keeper

async function send(address: Address, abi: typeof vaultAbi | typeof guardianAbi, functionName: string, args: readonly unknown[], why: string) {
  if (DRY_RUN || !keeper) return log(`would ${functionName}`, { address, why })
  const { request } = await publicClient.simulateContract({ account: keeper.account!, address, abi, functionName, args } as never)
  const hash = await keeper.writeContract(request as never)
  await publicClient.waitForTransactionReceipt({ hash })
  log(functionName, { address, why, hash })
}

async function keeperPass() {
  const now = BigInt(Math.floor(Date.now() / 1000))
  for (const token of book.stocks) {
    const vaults = await publicClient.readContract({ address: book.factory, abi: factoryAbi, functionName: 'vaultsOf', args: [token] })
    const m = await publicClient.readContract({ address: token, abi: tokenAbi, functionName: 'uiMultiplier' })
    for (const vault of vaults) {
      const read = <T>(fn: string) => publicClient.readContract({ address: vault, abi: vaultAbi, functionName: fn } as never) as Promise<T>
      const [frozen, maturity, mIndex, idx, s, ok] = await Promise.all([
        read<boolean>('frozen'), read<bigint>('maturity'), read<bigint>('maturityIndex'),
        read<bigint>('dividendIndex'), read<bigint>('structuralFactor'), read<boolean>('invariantHolds'),
      ])
      if (!ok) {
        await alert(`Invariant breach in vault ${vault}; pausing via guardian`)
        await send(book.guardian, guardianAbi, 'enforceInvariant', [vault], 'invariant breach')
        continue
      }
      if (frozen) await alert(`Vault ${vault} is frozen: unexplained multiplier change or corporate action in progress`)
      const stale = (m * 10n ** 18n) / s !== idx
      if (now >= maturity && mIndex === 0n) await send(vault, vaultAbi, 'sync', [], 'settle maturity')
      else if (stale && !frozen) await send(vault, vaultAbi, 'sync', [], 'multiplier moved')
    }
  }
}

async function tick() {
  try { await reportPass() } catch (e) { await alert(`report pass failed: ${(e as Error).message}`) }
  try { await keeperPass() } catch (e) { await alert(`keeper pass failed: ${(e as Error).message}`) }
}

log('xero keeper starting', { chainId: book.chainId, dryRun: DRY_RUN, reporter: reporter?.account?.address, keeper: keeper?.account?.address })
await tick()
if (!process.argv.includes('--once')) setInterval(tick, POLL)
