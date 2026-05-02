import { NextResponse } from 'next/server'
import { ethers } from 'ethers'

const REGISTRY_ABI = [
  'function totalAgents() external view returns (uint256)',
  'function getAgent(uint256 tokenId) external view returns (tuple(uint256 tokenId, string agentType, string ensName, bytes32 metadataHash, string storageRootHash, address owner, uint256 spawnCount))',
]

export async function GET() {
  const registryAddress = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS
  const rpcUrl = process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai'

  if (!registryAddress) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS not configured' },
      { status: 503 }
    )
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider)

    const total: bigint = await registry.totalAgents()
    const agents = []

    const totalNum = Number(total)
    for (let i = 0; i < totalNum; i++) {
      const agent = await registry.getAgent(i)
      agents.push({
        tokenId: agent.tokenId.toString(),
        agentType: agent.agentType,
        ensName: agent.ensName,
        systemPromptRootHash: agent.storageRootHash,
        spawnCount: Number(agent.spawnCount),
        contractAddress: registryAddress,
        explorerUrl: `https://chainscan-galileo.0g.ai/address/${registryAddress}`,
      })
    }

    return NextResponse.json(agents)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
