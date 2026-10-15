import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { maxUint256, type Abi, type Address, type Hash } from 'viem'
import { useAccount } from 'wagmi'
import { readContract, simulateContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { abis, explorer } from './network'
import { wagmiConfig } from './wagmi'
import { errMsg } from './format'

/** Use in call args to mean "the connected account"; replaced at send time. */
export const ACCOUNT_PLACEHOLDER = '0x00000000000000000000000000000000000ACC00' as Address

export type Call = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; label?: string }
export type Approval = { token: Address; spender: Address; amount: bigint; symbol: string }

/**
 * Runs approvals (only where allowance is short) followed by the calls, each simulated before signing.
 * Shows one toast that tracks every step, links the explorer, and refreshes all cached chain data.
 */
export function useTx() {
  const { address } = useAccount()
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)

  const run = useCallback(
    async (title: string, calls: Call[], approvals: Approval[] = []): Promise<boolean> => {
      if (!address) {
        toast.error('Connect a wallet first')
        return false
      }
      setPending(true)
      const id = toast.loading(title, { description: 'Preparing…' })
      try {
        const steps: Call[] = []
        for (const a of approvals) {
          const allowance = (await readContract(wagmiConfig, {
            address: a.token,
            abi: abis.MockUSDG,
            functionName: 'allowance',
            args: [address, a.spender],
          })) as bigint
          if (allowance < a.amount) {
            steps.push({ address: a.token, abi: abis.MockUSDG, functionName: 'approve', args: [a.spender, maxUint256], label: `Approve ${a.symbol}` })
          }
        }
        steps.push(...calls)

        let last: Hash | undefined
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i]
          const prefix = steps.length > 1 ? `Step ${i + 1}/${steps.length} · ` : ''
          toast.loading(title, { id, description: `${prefix}${s.label ?? 'Confirm in your wallet'}` })
          const simulate = () =>
            simulateContract(wagmiConfig, {
              account: address,
              address: s.address,
              abi: s.abi,
              functionName: s.functionName,
              args: (s.args ?? []).map((a) => (a === ACCOUNT_PLACEHOLDER ? address : a)),
            } as never)
          // Public RPCs are load-balanced: right after the previous step confirms, the node serving this
          // simulation may not have seen it yet (an approval looks missing). Give it a few blocks to catch up.
          let request: unknown
          for (let attempt = 0; ; attempt++) {
            try {
              ;({ request } = await simulate())
              break
            } catch (e) {
              if (i === 0 || attempt >= 4) throw e
              await new Promise((r) => setTimeout(r, 1500))
            }
          }
          last = await writeContract(wagmiConfig, request as never)
          toast.loading(title, { id, description: `${prefix}Waiting for confirmation…` })
          const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: last })
          if (receipt.status !== 'success') throw new Error('Transaction reverted')
        }
        toast.success(title, {
          id,
          description: 'Confirmed',
          action: explorer && last ? { label: 'View', onClick: () => window.open(`${explorer}/tx/${last}`, '_blank') } : undefined,
        })
        // Refresh in the background: callers reset their inputs on success, and waiting for every query to
        // refetch (seconds on a public RPC) would wipe whatever the user typed for the next trade meanwhile.
        void qc.invalidateQueries()
        return true
      } catch (e) {
        console.error(`[xero tx] ${title}`, e)
        toast.error(title, { id, description: errMsg(e) })
        return false
      } finally {
        setPending(false)
      }
    },
    [address, qc],
  )

  return { run, pending }
}
