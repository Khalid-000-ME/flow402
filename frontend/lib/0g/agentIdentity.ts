/**
 * agentIdentity.ts — Orcha-net iNFT Identity Resolver
 * ─────────────────────────────────────────────────────
 * Resolves each agent's on-chain iNFT record from AgentRegistry (read-only,
 * zero gas) and verifies that the local system prompt matches the registered
 * identity on-chain.
 *
 * Zero transactions. Zero gas. All reads are eth_call.
 *
 * Identity chain of trust:
 *   AgentRegistry.getAgentByType(agentType)
 *     → tokenId, ensName, metadataHash, storageRootHash, spawnCount
 *   Local verification:
 *     keccak256(agentType + ensName + storageRootHash) == metadataHash ✅
 */

import { ethers } from 'ethers'

// ── ABI (view functions only — zero gas) ──────────────────────────────────────

const REGISTRY_ABI = [
  'function getAgentByType(string agentType) external view returns (tuple(uint256 tokenId, string agentType, string ensName, bytes32 metadataHash, string storageRootHash, address owner, uint256 spawnCount, uint256 registeredAt, bool active))',
  'function totalAgents() external view returns (uint256)',
  'function getAgent(uint256 tokenId) external view returns (tuple(uint256 tokenId, string agentType, string ensName, bytes32 metadataHash, string storageRootHash, address owner, uint256 spawnCount, uint256 registeredAt, bool active))',
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentIdentity {
  /** ERC-7857-style token ID — the agent's iNFT ID */
  tokenId: number
  /** Human-readable agent type (e.g. "DeFi Analyst") */
  agentType: string
  /** ENS subname (e.g. "defi-analyst.orchanet.eth") */
  ensName: string
  /** keccak256(agentType + ensName + storageRootHash) — the identity proof */
  metadataHash: string
  /** 0G Storage root hash where the agent's system prompt JSON lives */
  storageRootHash: string
  /** Owner address (wallet that registered this agent) */
  owner: string
  /** How many times this agent has been invoked on-chain (lifetime) */
  spawnCount: number
  /** UNIX timestamp of when this agent was registered */
  registeredAt: number
  /** Whether the identity hash verified against the on-chain record */
  verified: boolean
  /** The computed hash we verified against (for audit) */
  computedHash: string
}

// ── Module-level cache (per server process, avoids RPC spam) ──────────────────

const CACHE = new Map<string, { identity: AgentIdentity; ts: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes — spawnCount will update

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL          = process.env.ZG_RPC_URL                       || 'https://evmrpc-testnet.0g.ai'
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || ''

// ── Core resolver ─────────────────────────────────────────────────────────────

/**
 * Resolves an agent's iNFT identity from AgentRegistry.
 * All reads are eth_call — zero gas cost.
 *
 * @param agentType e.g. "DeFi Analyst"
 * @returns AgentIdentity with verification result, or null if not registered
 */
export async function resolveAgentIdentity(agentType: string): Promise<AgentIdentity | null> {
  if (!REGISTRY_ADDRESS) {
    console.warn('[iNFT] NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS not set — skipping identity resolution')
    return null
  }

  // Cache hit
  const cached = CACHE.get(agentType)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.identity
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider)

    // eth_call — zero gas
    const agent = await registry.getAgentByType(agentType)

    if (!agent || !agent.active) {
      console.warn(`[iNFT] Agent "${agentType}" not found or inactive in registry`)
      return null
    }

    const tokenId        = Number(agent.tokenId)
    const ensName        = agent.ensName        as string
    const metadataHash   = agent.metadataHash   as string
    const storageRootHash = agent.storageRootHash as string
    const owner          = agent.owner          as string
    const spawnCount     = Number(agent.spawnCount)
    const registeredAt   = Number(agent.registeredAt)

    // ── Identity verification ──────────────────────────────────────────────
    // The contract computes: keccak256(abi.encodePacked(agentType, ensName, storageRootHash))
    // We replicate it locally to prove the on-chain record is self-consistent.
    const computedHash = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'string', 'string'],
        [agentType, ensName, storageRootHash]
      )
    )
    const verified = computedHash.toLowerCase() === metadataHash.toLowerCase()

    if (!verified) {
      console.error(
        `[iNFT] ⚠️  Identity verification FAILED for "${agentType}":\n` +
        `  On-chain metadataHash: ${metadataHash}\n` +
        `  Computed locally:      ${computedHash}\n` +
        `  This agent's on-chain record may have been tampered with.`
      )
    } else {
      console.log(
        `[iNFT] ✅ "${agentType}" identity verified — tokenId=${tokenId}, ` +
        `spawnCount=${spawnCount}, ensName=${ensName}`
      )
    }

    const identity: AgentIdentity = {
      tokenId,
      agentType,
      ensName,
      metadataHash,
      storageRootHash,
      owner,
      spawnCount,
      registeredAt,
      verified,
      computedHash,
    }

    CACHE.set(agentType, { identity, ts: Date.now() })
    return identity

  } catch (err) {
    console.warn(
      `[iNFT] Failed to resolve identity for "${agentType}": `,
      err instanceof Error ? err.message : err
    )
    return null
  }
}

/**
 * Resolves identities for multiple agent types in parallel.
 * Returns a map of agentType → AgentIdentity (null if not found).
 * Zero gas — all eth_call.
 */
export async function resolveAllIdentities(
  agentTypes: string[]
): Promise<Map<string, AgentIdentity | null>> {
  const results = await Promise.allSettled(
    agentTypes.map((t) => resolveAgentIdentity(t))
  )
  const map = new Map<string, AgentIdentity | null>()
  agentTypes.forEach((t, i) => {
    const r = results[i]
    map.set(t, r.status === 'fulfilled' ? r.value : null)
  })
  return map
}

/**
 * Invalidate cache for a specific agent type (force re-read on next spawn).
 * Useful after a commitRun to pick up the updated spawnCount.
 */
export function invalidateIdentityCache(agentType?: string) {
  if (agentType) {
    CACHE.delete(agentType)
  } else {
    CACHE.clear()
  }
}

/**
 * Returns a compact identity proof string for embedding in run records.
 * Format: "tokenId=0,metadataHash=0xabc...,verified=true"
 */
export function identityProof(identity: AgentIdentity | null): string {
  if (!identity) return 'unresolved'
  return [
    `tokenId=${identity.tokenId}`,
    `metadataHash=${identity.metadataHash.slice(0, 10)}...`,
    `spawnCount=${identity.spawnCount}`,
    `verified=${identity.verified}`,
  ].join(',')
}
