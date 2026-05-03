/**
 * Agent Owner Fee Distribution — via SpawnFeeVault (direct-pay model)
 *
 * After each run the orchestrator calls SpawnFeeVault.depositAndBatchPay()
 * which deposits OG and IMMEDIATELY forwards each agent owner's share to
 * their wallet in a single atomic transaction.
 *
 * On-chain result:
 *   - FeeDistributed event emitted per agent  (owner, amount, agentType, runId)
 *   - RunFeeSettled  event emitted per run    (runId, totalAmount, agentCount)
 *   - OG lands in each owner's wallet immediately — no claim step needed
 *
 * Env vars:
 *   SPAWN_FEE_ENABLED       — "true" to activate (default off)
 *   SPAWN_FEE_OG            — total OG to distribute per run (default "0.001")
 *   SPAWN_FEE_VAULT_ADDRESS — deployed SpawnFeeVault contract address
 *
 * Deploy the vault:  POST /api/deploy-vault   (after updating the contract)
 */

import { ethers } from 'ethers'
import { getOrchestratorWallet } from './wallet'
import type { AgentIdentity } from '@/lib/0g/agentIdentity'

// ── Vault ABI (direct-pay model) ─────────────────────────────────────────────
const VAULT_ABI = [
  // Core: deposit + immediately pay all owners
  'function depositAndBatchPay(address[] owners, uint256[] amounts, string[] agentTypes, string runId) external payable',
  // View
  'function vaultBalance() external view returns (uint256)',
  'function totalRuns() external view returns (uint256)',
  'function totalPaidWei() external view returns (uint256)',
  // Events
  'event FeeDistributed(address indexed owner, uint256 amount, string agentType, string runId)',
  'event RunFeeSettled(string indexed runId, uint256 totalAmount, uint256 agentCount)',
]

// ── Config ────────────────────────────────────────────────────────────────────
const SPAWN_FEE_OG      = process.env.SPAWN_FEE_OG           || '0.001'
const SPAWN_FEE_ENABLED = process.env.SPAWN_FEE_ENABLED       === 'true'
const VAULT_ADDRESS     = process.env.SPAWN_FEE_VAULT_ADDRESS || ''

// ── Public types ──────────────────────────────────────────────────────────────
export interface FeeDistributionResult {
  enabled: boolean
  vaultAddress?: string
  txHash?: string
  totalFeeOG: string
  payments: Array<{
    owner: string
    agentType: string
    amountOG: string
    txHash?: string
    error?: string
  }>
}

/**
 * Distribute inference fees to agent owners via SpawnFeeVault.depositAndBatchPay().
 *
 * A single tx deposits the total fee OG and immediately forwards each agent
 * owner's share to their wallet. Every agent gets its own FeeDistributed event.
 */
export async function distributeInferenceFees(
  identityMap: Map<string, AgentIdentity | null>,
  agentTypes: string[],
  runId: string = 'unknown',
): Promise<FeeDistributionResult> {
  if (!SPAWN_FEE_ENABLED) {
    return { enabled: false, totalFeeOG: SPAWN_FEE_OG, payments: [] }
  }
  if (!VAULT_ADDRESS) {
    console.warn('[fees] SPAWN_FEE_VAULT_ADDRESS not set — deploy vault first via POST /api/deploy-vault')
    return { enabled: true, totalFeeOG: SPAWN_FEE_OG, payments: [] }
  }

  // ── Build per-agent pay arrays ────────────────────────────────────────────
  // Each agent gets its own FeeDistributed event even if owners repeat.
  const owners:      string[] = []
  const amounts:     bigint[] = []
  const agentLabels: string[] = []

  const totalFeeWei         = ethers.parseEther(SPAWN_FEE_OG)
  const participatingAgents = agentTypes.filter(t => identityMap.get(t)?.owner)

  if (participatingAgents.length === 0) {
    console.log('[fees] No agent owners resolved — skipping fee distribution')
    return { enabled: true, totalFeeOG: SPAWN_FEE_OG, vaultAddress: VAULT_ADDRESS, payments: [] }
  }

  const shareWei = totalFeeWei / BigInt(participatingAgents.length)

  for (const agentType of participatingAgents) {
    const identity = identityMap.get(agentType)!
    owners.push(identity.owner)   // may repeat — each still gets its own tx log entry
    amounts.push(shareWei)
    agentLabels.push(agentType)
  }

  // ── Send single depositAndBatchPay tx ─────────────────────────────────────
  try {
    const wallet   = getOrchestratorWallet()
    const vault    = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, wallet)
    const totalWei = shareWei * BigInt(owners.length)

    console.log(`[fees] Sending depositAndBatchPay — ${owners.length} agents, ${ethers.formatEther(totalWei)} OG total, runId=${runId}`)

    const tx      = await vault.depositAndBatchPay(owners, amounts, agentLabels, runId, {
      value: totalWei,
    })
    const receipt = await tx.wait()
    const txHash: string = receipt?.hash ?? tx.hash

    console.log(`[fees] Fee payment confirmed — txHash=${txHash}`)

    // Each payment shares the same batch txHash (it's one tx, not per-agent)
    const payments = owners.map((owner, i) => ({
      owner,
      agentType: agentLabels[i],
      amountOG:  ethers.formatEther(amounts[i]),
      // Don't set per-agent txHash — only vault_credited summary row shows it
    }))

    return {
      enabled:     true,
      vaultAddress: VAULT_ADDRESS,
      txHash,                          // top-level batch tx hash
      totalFeeOG:  ethers.formatEther(totalWei),
      payments,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[fees] depositAndBatchPay failed:', msg)
    return {
      enabled:     true,
      vaultAddress: VAULT_ADDRESS,
      totalFeeOG:  SPAWN_FEE_OG,
      payments: owners.map((owner, i) => ({
        owner,
        agentType: agentLabels[i],
        amountOG:  ethers.formatEther(amounts[i]),
        error:     msg.slice(0, 120),
      })),
    }
  }
}
