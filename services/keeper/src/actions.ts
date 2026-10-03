// Pure mapping from Robinhood corporate actions to CorporateActionEngine.report() arguments.
import { parseUnits, type Hex } from 'viem'
import type { CorporateActionType, RhCorporateAction } from './robinhood.js'

/** Must match ICorporateActionEngine.ActionType ordering. */
export const ACTION_TYPES: CorporateActionType[] = [
  'CASH_DIVIDEND', 'STOCK_DIVIDEND', 'FORWARD_SPLIT', 'REVERSE_SPLIT', 'UNIT_SPLIT', 'SPIN_OFF', 'CASH_MERGER',
  'STOCK_MERGER', 'STOCK_AND_CASH_MERGER', 'REDEMPTION', 'WORTHLESS_REMOVAL', 'RIGHTS_DISTRIBUTION', 'NAME_CHANGE',
]
export const STRUCTURAL = new Set<CorporateActionType>(['FORWARD_SPLIT', 'REVERSE_SPLIT', 'STOCK_DIVIDEND'])
export const SUPPORTED = new Set<CorporateActionType>([...STRUCTURAL, 'CASH_DIVIDEND', 'NAME_CHANGE'])

const WAD = 10n ** 18n
/** Contract cap on the multiplier growth a single cash dividend may authorise. */
const MAX_ALLOWANCE = WAD / 2n

export type Attestation = {
  kind: number
  kindName: CorporateActionType
  effectiveAt: bigint
  value: bigint
  value2: bigint
  ref: Hex
}

export const typeOf = (a: RhCorporateAction): CorporateActionType =>
  a.type.replace('CORPORATE_ACTION_TYPE_', '') as CorporateActionType

const wad = (decimal: string) => parseUnits(decimal as `${number}`, 18)

/** Midnight UTC of the process date: when Robinhood's multiplier change takes effect. */
export function processTimestamp(a: RhCorporateAction): bigint | null {
  if (!a.processDate) return null
  const { year, month, day } = a.processDate
  return BigInt(Date.UTC(year, month - 1, day) / 1000)
}

/**
 * Builds the attestation for one action.
 * @param effectiveAt on-chain effective time when known (token.effectiveAt() for a pending multiplier),
 *                    otherwise the process date is used.
 * @param priceUsd    underlying mid price, required for CASH_DIVIDEND to size the growth allowance.
 */
export function toAttestation(
  a: RhCorporateAction,
  opts: { effectiveAt?: bigint; priceUsd?: number } = {},
): Attestation | null {
  const kindName = typeOf(a)
  const kind = ACTION_TYPES.indexOf(kindName)
  if (kind < 0) return null
  const effectiveAt = opts.effectiveAt ?? processTimestamp(a)
  if (effectiveAt === null) return null
  const ref = normaliseRef(a.id)
  const d = Object.values(a.details)[0] ?? {}

  let value = 0n
  let value2 = 0n
  switch (kindName) {
    case 'FORWARD_SPLIT':
    case 'REVERSE_SPLIT':
      value = wad(d.newRate)
      value2 = wad(d.oldRate)
      break
    case 'STOCK_DIVIDEND':
      value = WAD + wad(d.rate) // rate is shares per share
      value2 = WAD
      break
    case 'CASH_DIVIDEND': {
      if (!opts.priceUsd || opts.priceUsd <= 0) return null
      value = wad(d.rate)
      // Reinvesting cash/price grows the multiplier by that fraction; authorise 1.5x plus 20 bps headroom.
      const growth = (value * WAD) / wad(opts.priceUsd.toFixed(8))
      value2 = (growth * 3n) / 2n + WAD / 500n
      if (value2 > MAX_ALLOWANCE) value2 = MAX_ALLOWANCE
      break
    }
    default:
      break // unsupported/no-op actions carry no values
  }
  return { kind, kindName, effectiveAt, value, value2, ref }
}

export function normaliseRef(id: string): Hex {
  const hex = id.toLowerCase().replace(/^0x/, '')
  if (!/^[0-9a-f]{1,64}$/.test(hex)) throw new Error(`unexpected corporate action id ${id}`)
  return `0x${hex.padStart(64, '0')}`
}
