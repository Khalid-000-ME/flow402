// Shared TypeScript types for Orcha-net

export interface SSEEvent {
  event: string
  data: Record<string, unknown>
}

export interface AgentDefinition {
  ensName: string
  description: string
  systemPrompt: string
  providerAddress: string
  color: string
}

/** Resolved on-chain iNFT identity for an agent (read-only, zero gas) */
export interface iNFTIdentity {
  /** ERC-7857-style token ID */
  tokenId: number
  /** ENS subname e.g. "defi-analyst.orchanet.eth" */
  ensName: string
  /** keccak256(agentType + ensName + storageRootHash) */
  metadataHash: string
  /** 0G Storage root hash of the agent's system prompt JSON */
  storageRootHash: string
  /** Whether the on-chain hash verified successfully */
  verified: boolean
  /** Lifetime spawn count from the contract */
  spawnCount: number
  /** Owner wallet that registered this agent */
  owner: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface RunEvent {
  type: string
  agentType?: string
  agentId?: string
  ensName?: string
  content?: string
  txHash?: string
  rootHash?: string
  label?: string
  round?: number
  vote?: string
  provider?: string
  timestamp: number
  /** iNFT identity resolved from AgentRegistry (zero gas, read-only) */
  iNFT?: iNFTIdentity
  /** TEE signature verification result from processResponse (inference events only) */
  teeVerified?: boolean
}

export interface RunRecord {
  runId: string
  prompt: string
  status: 'running' | 'complete' | 'failed'
  agentsSpawned: number
  inferenceCalls: number
  storageBytesCommitted: number
  duration: number
  timestamp: number
  rootHash: string
  /** Flow contract EVM txHash from the 0G Storage upload — links to chainscan-galileo */
  storageTxHash?: string
  finalOutput: string
  events: RunEvent[]
}

export interface RunsIndex {
  runs: Array<{
    runId: string
    rootHash: string
    status: string
    agentsSpawned: number
    inferenceCalls: number
    storageCid: string
    duration: number
    timestamp: number
  }>
}
