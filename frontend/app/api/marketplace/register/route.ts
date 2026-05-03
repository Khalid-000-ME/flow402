import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { uploadToStorage } from '@/lib/0g/storage'

const REGISTRY_ABI = [
  'function registerAgent(string calldata agentType, string calldata ensName, string calldata storageRootHash) external returns (uint256 tokenId)',
  'function totalAgents() external view returns (uint256)',
  'function getAllAgents() external view returns (tuple(uint256 tokenId, string agentType, string ensName, bytes32 metadataHash, string storageRootHash, address owner, uint256 spawnCount, uint256 registeredAt, bool active)[])',
]

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS!
const PRIVATE_KEY      = process.env.ZG_PRIVATE_KEY!
const RPC_URL          = process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai'

/**
 * POST /api/marketplace/register
 * Body: { agentType, ensName, systemPrompt, capabilities, skills, authorizedWallet }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      agentType: string
      ensName: string
      systemPrompt: string
      capabilities: string[]
      skills: string[]
      description: string
      authorizedWallet?: string
    }

    const { agentType, ensName, systemPrompt, capabilities, skills, description } = body

    if (!agentType || !ensName || !systemPrompt) {
      return NextResponse.json({ error: 'agentType, ensName, and systemPrompt are required.' }, { status: 400 })
    }

    if (!REGISTRY_ADDRESS || !PRIVATE_KEY) {
      return NextResponse.json({ error: 'Registry not configured on server.' }, { status: 503 })
    }

    // ── 1. Upload agent blob to 0G Storage ───────────────────────────────────
    const agentBlob = {
      agentType,
      ensName,
      systemPrompt,
      capabilities: capabilities ?? [],
      skills: skills ?? [],
      description: description ?? '',
      registeredAt: new Date().toISOString(),
    }

    const { rootHash, txHash: storageTxHash } = await uploadToStorage(agentBlob)

    // ── 2. Register on AgentRegistry contract ─────────────────────────────────
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const signer   = new ethers.Wallet(PRIVATE_KEY, provider)
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer)

    const tx  = await registry.registerAgent(agentType, ensName, rootHash)
    const receipt = await tx.wait()

    // Parse tokenId from event logs
    const iface = new ethers.Interface([
      'event AgentRegistered(uint256 indexed tokenId, string agentType, string ensName, bytes32 metadataHash, string storageRootHash)',
    ])
    let tokenId: string | null = null
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log)
        if (parsed?.name === 'AgentRegistered') {
          tokenId = parsed.args.tokenId.toString()
        }
      } catch { /* skip non-matching logs */ }
    }

    return NextResponse.json({
      success: true,
      tokenId,
      rootHash,
      storageTxHash,
      registryTxHash: receipt.hash,
      registryUrl: `https://chainscan-galileo.0g.ai/tx/${receipt.hash}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
