/**
 * Orcha-net Orchestrator — multi-agent pipeline
 *
 * Pipeline:
 *  1. Planning pass  — orchestrator agent decides which specialists to spawn
 *  2. Parallel spawn — specialist agents run concurrently via 0G Compute
 *  3. Critic debate  — adversarial agent challenges weakest findings
 *  4. Storage commit — full run record uploaded to 0G Storage (immutable)
 *  5. Chain commit   — AgentRegistry.commitRun() called directly on 0G Chain
 *  6. KeeperHub      — optional guaranteed settlement (if configured)
 *  7. Memory store   — run persisted in-process for fast retrieval
 */

import { ethers }        from 'ethers'
import { runInference }  from '@/lib/0g/compute'
import { uploadToStorage, downloadFromStorage } from '@/lib/0g/storage'
import { resolveAllIdentities, invalidateIdentityCache } from '@/lib/0g/agentIdentity'
import type { AgentIdentity } from '@/lib/0g/agentIdentity'
import {
  AGENT_REGISTRY,
  AVAILABLE_AGENT_TYPES,
  ORCHESTRATOR_SYSTEM_PROMPT,
  CRITIC_SYSTEM_PROMPT,
} from './agents'
import { setRunRecord } from './runStore'
import { distributeInferenceFees } from './fees'
import { parseSwapIntent, executeSwap } from './swap'
import type { RunEvent } from '@/lib/types'

// ── AgentRegistry ABI (minimal — only commitRun) ──────────────────────────────

const REGISTRY_ABI = [
  'function commitRun(string runId, bytes32 rootHash, string[] agentTypesSpawned) external',
  'function getRunCount() external view returns (uint256)',
]

// ── Config ────────────────────────────────────────────────────────────────────

const ORCHESTRATOR_PROVIDER =
  process.env.ZG_PROVIDER_DEFAULT || '0xa48f01287233509FD694a22Bf840225062E67836'

const RPC_URL     = process.env.ZG_RPC_URL    || 'https://evmrpc-testnet.0g.ai'
const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY || ''
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || ''

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/** Parse a JSON array from LLM output — tolerates markdown fences */
function parseAgentListFromLLM(raw: string): string[] | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').trim()
    const parsed  = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed as string[]
  } catch { /* fall through */ }

  // Try extracting the first [...] block
  const match = raw.match(/\[[\s\S]*?\]/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) return parsed as string[]
    } catch { /* fall through */ }
  }
  return null
}

// ── Direct on-chain commitment ────────────────────────────────────────────────

async function commitRunOnChain(
  runId: string,
  rootHash: string,
  agentTypes: string[]
): Promise<string> {
  if (!REGISTRY_ADDRESS || !PRIVATE_KEY) {
    throw new Error('NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS and ZG_PRIVATE_KEY required for on-chain commit')
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider)
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet)

  // Convert string rootHash to bytes32
  const rootHashBytes32 = ethers.zeroPadValue(
    ethers.toUtf8Bytes(rootHash).length <= 32
      ? ethers.toUtf8Bytes(rootHash)
      : ethers.getBytes(rootHash.startsWith('0x') ? rootHash : `0x${rootHash}`),
    32
  )

  const tx = await registry.commitRun(runId, rootHashBytes32, agentTypes)
  const receipt = await tx.wait()
  return receipt.hash as string
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function orchestrate(
  prompt: string,
  runId: string,
  emit: (event: string, data: Record<string, unknown>) => void
): Promise<void> {
  const startTime = Date.now()
  const events: RunEvent[] = []
  let inferenceCalls = 0

  function track(evt: RunEvent) {
    events.push(evt)
    emit(evt.type, evt as unknown as Record<string, unknown>)
  }

  // ── Step 1: Planning pass ────────────────────────────────────────────────
  let agentTypes: string[] = AVAILABLE_AGENT_TYPES

  track({
    type: 'agent_message',
    agentType: 'Orchestrator',
    content: `Planning agent selection for: "${prompt}"`,
    timestamp: Date.now(),
  })

  try {
    const plan = await runInference(
      ORCHESTRATOR_PROVIDER,
      [{ role: 'user', content: `Task: "${prompt}"\nReturn a JSON array of agent types to spawn from: ${AVAILABLE_AGENT_TYPES.join(', ')}` }],
      ORCHESTRATOR_SYSTEM_PROMPT,
      { maxTokens: 256 }
    )
    inferenceCalls++

    track({
      type: 'inference_settled',
      agentType: 'Orchestrator',
      teeVerified: plan.verified,
      timestamp: Date.now(),
    })

    const parsed = parseAgentListFromLLM(plan.content)
    if (parsed && parsed.length > 0) {
      const valid = parsed.filter((t) => AVAILABLE_AGENT_TYPES.includes(t))
      if (valid.length > 0) agentTypes = valid
    }

    track({
      type: 'agent_message',
      agentType: 'Orchestrator',
      content: `Spawning: ${agentTypes.join(', ')}`,
      timestamp: Date.now(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    track({
      type: 'agent_message',
      agentType: 'Orchestrator',
      content: PRIVATE_KEY
        ? `Planning inference failed (${msg}). Spawning all agents.`
        : 'ZG_PRIVATE_KEY not configured. Configure .env.local to enable 0G Compute inference.',
      timestamp: Date.now(),
    })
  }

  // ── Step 2: Resolve iNFT identities (zero gas, parallel eth_call) ────────
  //   Runs concurrently with nothing — all eth_call, never blocks inference.
  //   Result: a map of agentType → on-chain identity (or null if not registered).
  const identityMap = await resolveAllIdentities([...agentTypes, 'Critic'])

  // ── Step 3: Spawn specialist agents in parallel ─────────────────────────
  const agentResults = await Promise.all(
    agentTypes.map(async (agentType) => {
      const agentDef  = AGENT_REGISTRY[agentType]
      if (!agentDef) return null

      const identity: AgentIdentity | null = identityMap.get(agentType) ?? null

      // Emit spawn event WITH iNFT identity fields
      track({
        type: 'agent_spawned',
        agentType,
        ensName: identity?.ensName ?? agentDef.ensName,
        timestamp: Date.now(),
        // iNFT identity (zero-gas, from chain)
        iNFT: identity ? {
          tokenId:        identity.tokenId,
          ensName:        identity.ensName,
          metadataHash:   identity.metadataHash,
          storageRootHash: identity.storageRootHash,
          verified:       identity.verified,
          spawnCount:     identity.spawnCount,
          owner:          identity.owner,
        } : undefined,
      })

      const providerAddr = agentDef.providerAddress || ORCHESTRATOR_PROVIDER

      if (!PRIVATE_KEY) {
        track({
          type: 'agent_message',
          agentType,
          content: `[${agentType}] Simulated response — set ZG_PRIVATE_KEY for live inference.`,
          timestamp: Date.now(),
        })
        return { agentType, content: `Simulated output from ${agentType}`, verified: false }
      }

      track({ type: 'inference_started', agentType, timestamp: Date.now() })

      let lastErr: unknown
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await runInference(
            providerAddr,
            [{ role: 'user', content: prompt }],
            agentDef.systemPrompt,
            { maxTokens: 1024 }
          )

          if (result.content) {
            inferenceCalls++
            // Emit TEE verification status (no on-chain txHash for inference—
            // compute uses locked-fund model, settlement is per-provider not per-call)
            track({
              type: 'inference_settled',
              agentType,
              teeVerified: result.verified,
              timestamp: Date.now(),
            })
            track({ type: 'agent_message', agentType, content: result.content, timestamp: Date.now() })
            return { agentType, content: result.content, verified: result.verified }
          }

          throw new Error('Provider returned empty response')
        } catch (err) {
          lastErr = err
          if (attempt < 2) await sleep(1500 * (attempt + 1))
        }
      }

      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
      track({ type: 'agent_message', agentType, content: `Inference failed after 3 attempts: ${msg}`, timestamp: Date.now() })
      return { agentType, content: '', verified: false }
    })
  )

  const validResults = agentResults.filter(Boolean) as Array<{
    agentType: string
    content: string
    verified: boolean
  }>

  // ── Step 3: Critic debate ───────────────────────────────────────────────
  let criticContent = ''
  const criticDef = AGENT_REGISTRY['Critic']

  if (PRIVATE_KEY && criticDef && validResults.filter((r) => r.content).length > 0) {
    track({ type: 'agent_spawned', agentType: 'Critic', ensName: criticDef.ensName, timestamp: Date.now() })

    const criticInput = validResults
      .filter((r) => r.content)
      .map((r) => `[${r.agentType}]: ${r.content}`)
      .join('\n\n')

    try {
      const criticResult = await runInference(
        criticDef.providerAddress || ORCHESTRATOR_PROVIDER,
        [{ role: 'user', content: criticInput }],
        CRITIC_SYSTEM_PROMPT,
        { maxTokens: 1024 }
      )
      if (criticResult.content) {
        inferenceCalls++
        criticContent = criticResult.content
        track({
          type: 'inference_settled',
          agentType: 'Critic',
          teeVerified: criticResult.verified,
          timestamp: Date.now(),
        })
        track({ type: 'debate_round', agentType: 'Critic', round: 1, content: criticContent, timestamp: Date.now() })
      }
    } catch (err) {
      track({ type: 'agent_message', agentType: 'Critic', content: `Critic inference failed: ${err instanceof Error ? err.message : String(err)}`, timestamp: Date.now() })
    }
  }

  // ── Step 4: Compile final output ────────────────────────────────────────
  const finalOutput = [
    `## Orcha-net Analysis Report`,
    `**Run ID:** \`${runId}\``,
    `**Prompt:** ${prompt}`,
    '',
    ...validResults
      .filter((r) => r.content)
      .map((r) => `### ${r.agentType}\n${r.content}`),
    criticContent ? `### Critic Analysis\n${criticContent}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  // ── Step 4.5: Uniswap swap — execute if trade intent in prompt ─────────────
  if (process.env.SWAP_ENABLED === 'true' && process.env.UNISWAP_API_KEY) {
    const intent = parseSwapIntent(prompt)
    if (intent) {
      track({
        type: 'agent_message',
        agentType: 'Orchestrator',
        content: `Trade signal detected: swap ${intent.amountIn} ${intent.tokenIn} → ${intent.tokenOut} (chain ${intent.chainId ?? 11155111})`,
        timestamp: Date.now(),
      })
      try {
        const swapResult = await executeSwap(intent)
        track({
          type:       'swap_executed' as RunEvent['type'],
          agentType:  'Orchestrator',
          tokenIn:    intent.tokenIn,
          tokenOut:   intent.tokenOut,
          amountIn:   swapResult.amountIn,
          amountOut:  swapResult.amountOut,
          txHash:     swapResult.txHash,
          explorerUrl: swapResult.explorerUrl,
          routing:    swapResult.routing,
          chainId:    String(swapResult.chainId),
          success:    swapResult.success,
          error:      swapResult.error,
          timestamp:  Date.now(),
        } as unknown as RunEvent)
      } catch (err) {
        track({
          type:      'swap_executed' as RunEvent['type'],
          agentType: 'Orchestrator',
          tokenIn:   intent.tokenIn,
          tokenOut:  intent.tokenOut,
          amountIn:  intent.amountIn,
          amountOut: '0',
          success:   false,
          error:     err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        } as unknown as RunEvent)
      }
    }
  }

  // ── Step 5: Upload to 0G Storage ────────────────────────────────────────
  let rootHash = ''
  const storageBytesCommitted = new TextEncoder().encode(finalOutput).length

  // Build iNFT identity snapshot for the run record artifact
  const iNFTSnapshot: Record<string, object> = {}
  for (const [type, identity] of identityMap.entries()) {
    if (identity) {
      iNFTSnapshot[type] = {
        tokenId:        identity.tokenId,
        ensName:        identity.ensName,
        metadataHash:   identity.metadataHash,
        storageRootHash: identity.storageRootHash,
        spawnCount:     identity.spawnCount,
        verified:       identity.verified,
        owner:          identity.owner,
      }
    }
  }

  const runRecord: import('@/lib/types').RunRecord & { iNFTIdentities?: Record<string, object> } = {
    runId,
    prompt,
    status: 'complete' as const,
    agentsSpawned: agentTypes.length,
    inferenceCalls,
    storageBytesCommitted,
    duration: Date.now() - startTime,
    timestamp: startTime,
    rootHash: '',
    storageTxHash: '',
    finalOutput,
    events,
    iNFTIdentities: iNFTSnapshot,
  }

  if (PRIVATE_KEY) {
    try {
      const upload = await uploadToStorage(runRecord as object)
      rootHash = upload.rootHash
      runRecord.rootHash = rootHash
      runRecord.storageTxHash = upload.txHash || ''

      track({
        type: 'storage_committed',
        label: 'Full run record — 0G Storage',
        rootHash,
        // Real Flow contract txHash from the 0G Storage upload
        txHash: upload.txHash || undefined,
        timestamp: Date.now(),
      })

      emit('storage_info', {
        rootHash,
        txHash: upload.txHash,
        bytes: upload.bytes,
        scanUrl: upload.scanUrl,
        timestamp: Date.now(),
      })
    } catch (err) {
      track({
        type: 'agent_message',
        agentType: 'Storage',
        content: `0G Storage upload failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      })
    }
  }

  // ── Step 6a: Direct AgentRegistry.commitRun on 0G Chain ─────────────────
  if (rootHash && REGISTRY_ADDRESS && PRIVATE_KEY) {
    try {
      const txHash = await commitRunOnChain(runId, rootHash, [...new Set([...agentTypes, 'Critic'])])
      track({
        type: 'chain_committed',
        label: 'AgentRegistry.commitRun (on-chain)',
        txHash,
        timestamp: Date.now(),
      })
      emit('chain_committed', {
        txHash,
        contractAddress: REGISTRY_ADDRESS,
        explorerUrl: `https://chainscan-galileo.0g.ai/tx/${txHash}`,
        timestamp: Date.now(),
      })
      // Invalidate iNFT identity cache so the next run reads fresh spawnCounts
      // from chain. Zero gas — just forces eth_call to bypass module cache.
      invalidateIdentityCache()
    } catch (err) {
      track({
        type: 'agent_message',
        agentType: 'Chain',
        content: `AgentRegistry.commitRun failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      })
    }
  }

  // ── Step 6b: Fee distribution — always emit events for every run ─────────
  // Fires regardless of vault/SPAWN_FEE_ENABLED state so the fee section is
  // always visible in Studio + run records. Marks events as simulated=true
  // when vault is not configured (no real on-chain payment).
  {
    // Use a Set to prevent duplicates — Critic may already be in agentTypes
    const allAgents  = [...new Set([...agentTypes, 'Critic'])]
    const feePerAgent = (parseFloat(process.env.SPAWN_FEE_OG || '0.001') / allAgents.length).toFixed(6)
    const vaultAddr   = process.env.SPAWN_FEE_VAULT_ADDRESS || ''
    const vaultReady  = !!vaultAddr && process.env.SPAWN_FEE_ENABLED === 'true'

    let feeResult: Awaited<ReturnType<typeof distributeInferenceFees>> | null = null

    // Attempt real payment if vault is configured
    if (vaultReady) {
      try {
        feeResult = await distributeInferenceFees(identityMap, allAgents, runId)
      } catch (err) {
        console.warn('[orchestrator] Fee distribution failed:', err instanceof Error ? err.message : err)
      }
    }

    // Emit per-agent fee events (real or simulated)
    for (const agentType of allAgents) {
      const identity  = identityMap.get(agentType) ?? null
      const owner     = identity?.owner ?? 'unregistered'
      const payment   = feeResult?.payments?.find(p => p.agentType === agentType)

      const evt = {
        type:      'fee_distributed' as RunEvent['type'],
        agentType,
        owner,
        amountOG:  payment?.amountOG ?? feePerAgent,
        txHash:    payment?.txHash,
        error:     payment?.error ?? (vaultReady ? undefined : 'vault not deployed'),
        simulated: !vaultReady,
        timestamp: Date.now(),
      }
      track(evt)                   // → persisted in run record events[]
      emit('fee_distributed', evt) // → SSE to Studio feed
    }

    // Vault credited summary (only when real payment happened)
    if (feeResult?.txHash) {
      const summaryEvt = {
        type:         'vault_credited' as RunEvent['type'],
        vaultAddress: feeResult.vaultAddress,
        txHash:       feeResult.txHash,
        totalFeeOG:   feeResult.totalFeeOG,
        agentCount:   feeResult.payments.length,
        timestamp:    Date.now(),
      }
      track(summaryEvt)
      emit('vault_credited', summaryEvt)
    }
  }


  // ── Step 7: Persist in memory ────────────────────────────────────────────
  setRunRecord(runId, runRecord)

  emit('run_complete', {
    runId,
    rootHash,
    finalOutput,
    agentsSpawned: agentTypes.length,
    inferenceCalls,
    duration: Date.now() - startTime,
    timestamp: Date.now(),
  })
}
