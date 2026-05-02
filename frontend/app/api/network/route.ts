import { NextResponse } from 'next/server'
import { ethers } from 'ethers'

const REGISTRY_ABI = [
  'function totalAgents() external view returns (uint256)',
  'function getRunCount() external view returns (uint256)',
  'event AgentSpawned(uint256 indexed tokenId, string runId, uint256 timestamp)',
  'event RunCommitted(uint256 indexed runIndex, string runId, bytes32 rootHash, uint256 timestamp)',
]

export async function GET() {
  const registryAddress = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS
  const rpcUrl = process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai'

  try {
    let totalAgents = 0
    let activeRuns = 0
    let totalInferenceSettlements = 0
    let totalStorageBytes = 0
    let providers: Array<{ address: string; model: string; txCount: number }> = []
    let recentEvents: Array<{ type: string; runId?: string; agentType?: string; timestamp: number }> = []

    if (registryAddress) {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider)

      const [agentsTotal, runCount] = await Promise.all([
        registry.totalAgents().catch(() => BigInt(0)),
        registry.getRunCount().catch(() => BigInt(0)),
      ])

      totalAgents = Number(agentsTotal)
      totalInferenceSettlements = Number(runCount)

      // Fetch recent AgentSpawned events
      const currentBlock = await provider.getBlockNumber()
      const fromBlock = Math.max(0, currentBlock - 1000)

      const spawnFilter = registry.filters.AgentSpawned()
      const spawnEvents = await registry.queryFilter(spawnFilter, fromBlock).catch(() => [])

      const runFilter = registry.filters.RunCommitted()
      const runEvents = await registry.queryFilter(runFilter, fromBlock).catch(() => [])

      recentEvents = [
        ...spawnEvents.map((e: ethers.EventLog | ethers.Log) => {
          const el = e as ethers.EventLog
          return {
            type: 'AgentSpawned',
            runId: el.args?.[1],
            timestamp: Number(el.args?.[2] || 0),
          }
        }),
        ...runEvents.map((e: ethers.EventLog | ethers.Log) => {
          const el = e as ethers.EventLog
          return {
            type: 'RunCompleted',
            runId: el.args?.[1],
            timestamp: Number(el.args?.[3] || 0),
          }
        }),
      ]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20)
    }

    return NextResponse.json({
      totalAgents,
      activeRuns,
      totalInferenceSettlements,
      totalStorageBytes,
      providers,
      recentEvents,
    })
  } catch (err) {
    return NextResponse.json({
      totalAgents: 0,
      activeRuns: 0,
      totalInferenceSettlements: 0,
      totalStorageBytes: 0,
      providers: [],
      recentEvents: [],
      error: String(err),
    })
  }
}
