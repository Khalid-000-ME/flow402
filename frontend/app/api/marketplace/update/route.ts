import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { uploadToStorage } from '@/lib/0g/storage'

const REGISTRY_ABI = [
  'function updateStorageRootHash(uint256 tokenId, string calldata newRootHash) external',
  'function getAgent(uint256 tokenId) external view returns (tuple(uint256 tokenId, string agentType, string ensName, bytes32 metadataHash, string storageRootHash, address owner, uint256 spawnCount, uint256 registeredAt, bool active))',
]

const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS!
const PRIVATE_KEY      = process.env.ZG_PRIVATE_KEY!
const RPC_URL          = process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai'

/**
 * POST /api/marketplace/update
 * Body: { tokenId, systemPrompt }
 */
export async function POST(req: NextRequest) {
  try {
    const { tokenId, systemPrompt } = await req.json() as { tokenId: string; systemPrompt: string }

    if (!tokenId || !systemPrompt?.trim()) {
      return NextResponse.json({ error: 'tokenId and systemPrompt are required.' }, { status: 400 })
    }
    if (!REGISTRY_ADDRESS || !PRIVATE_KEY) {
      return NextResponse.json({ error: 'Registry not configured.' }, { status: 503 })
    }

    // Fetch current agent data to preserve other fields
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const signer   = new ethers.Wallet(PRIVATE_KEY, provider)
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer)

    const current = await registry.getAgent(BigInt(tokenId))

    // Upload updated blob
    const blob = {
      agentType:   current.agentType,
      ensName:     current.ensName,
      systemPrompt,
      updatedAt:   new Date().toISOString(),
    }

    const { rootHash, txHash: storageTxHash } = await uploadToStorage(blob)

    // Update on-chain
    const tx      = await registry.updateStorageRootHash(BigInt(tokenId), rootHash)
    const receipt = await tx.wait()

    return NextResponse.json({
      success: true,
      rootHash,
      storageTxHash,
      registryTxHash: receipt.hash,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
