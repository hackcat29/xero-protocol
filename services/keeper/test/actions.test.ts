import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ACTION_TYPES, normaliseRef, processTimestamp, toAttestation } from '../src/actions.js'
import type { RhCorporateAction } from '../src/robinhood.js'

const base = {
  status: 'CORPORATE_ACTION_STATUS_COMPLETED',
  processDate: { year: 2026, month: 10, day: 29 },
  tokenSymbol: 'MU',
  deployments: [{ contractAddress: '0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD', chainId: 4663, networkName: 'Robinhood Chain' }],
} as const

test('enum order matches ICorporateActionEngine.ActionType', () => {
  assert.equal(ACTION_TYPES[0], 'CASH_DIVIDEND')
  assert.equal(ACTION_TYPES[2], 'FORWARD_SPLIT')
  assert.equal(ACTION_TYPES[12], 'NAME_CHANGE')
})

test('cash dividend: USD rate and bounded growth allowance (live API sample)', () => {
  const a = { ...base, id: '0x000000000000000000000000000000007757415150a94b50a879cdc04dc90664', type: 'CORPORATE_ACTION_TYPE_CASH_DIVIDEND', details: { cashDividend: { underlyingSymbol: 'MU', rate: '0.15' } } } as unknown as RhCorporateAction
  const at = toAttestation(a, { priceUsd: 100 })!
  assert.equal(at.kind, 0)
  assert.equal(at.value, 150000000000000000n)
  // growth 0.15% -> allowance 0.225% + 0.2% headroom
  assert.equal(at.value2, 4250000000000000n)
  assert.equal(at.effectiveAt, processTimestamp(a))
  assert.equal(toAttestation(a), null, 'cash dividends need a price')
})

test('forward split uses new/old rates; stock dividend is 1 + rate', () => {
  const split = { ...base, id: '0x01', type: 'CORPORATE_ACTION_TYPE_FORWARD_SPLIT', details: { forwardSplit: { underlyingSymbol: 'CRWD', oldRate: '1', newRate: '4' } } } as unknown as RhCorporateAction
  const s = toAttestation(split)!
  assert.equal(s.value, 4n * 10n ** 18n)
  assert.equal(s.value2, 10n ** 18n)
  const sd = { ...base, id: '0x02', type: 'CORPORATE_ACTION_TYPE_STOCK_DIVIDEND', details: { stockDividend: { underlyingSymbol: 'X', rate: '0.05' } } } as unknown as RhCorporateAction
  assert.equal(toAttestation(sd)!.value, 1_050_000_000_000_000_000n)
})

test('on-chain effective time overrides the process date', () => {
  const split = { ...base, id: '0x03', type: 'CORPORATE_ACTION_TYPE_REVERSE_SPLIT', details: { reverseSplit: { underlyingSymbol: 'X', oldRate: '10', newRate: '1' } } } as unknown as RhCorporateAction
  assert.equal(toAttestation(split, { effectiveAt: 1_800_000_000n })!.effectiveAt, 1_800_000_000n)
})

test('refs are bytes32', () => {
  assert.equal(normaliseRef('0x7757'), `0x${'7757'.padStart(64, '0')}`)
  assert.throws(() => normaliseRef('not-hex'))
})
