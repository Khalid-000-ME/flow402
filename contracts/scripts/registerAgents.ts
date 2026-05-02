/**
 * Orcha-net — Agent Seed Script
 *
 * This script:
 *  1. Uploads each agent's system prompt + metadata to 0G Storage
 *  2. Registers each agent on the deployed AgentRegistry contract
 *
 * Run AFTER deploying the contract:
 *   npm run register
 *
 * Requires in .env:
 *   NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=<deployed address>
 *   ZG_PRIVATE_KEY=<private key with testnet A0GI>
 *   ZG_RPC_URL=https://evmrpc-testnet.0g.ai            (default)
 *   ZG_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai (default)
 */

import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'

// Load env from contracts/.env or sibling frontend/.env.local
dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') })

// ── 0G Storage upload (inline, avoids circular deps) ─────────────────────────

async function uploadToZGStorage(data: object): Promise<string> {
  const sdk = await import('@0gfoundation/0g-storage-ts-sdk')
  const rpcUrl    = process.env.ZG_RPC_URL     || 'https://evmrpc-testnet.0g.ai'
  const indexerRpc = process.env.ZG_INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai'
  const privateKey = process.env.ZG_PRIVATE_KEY!

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const signer   = new ethers.Wallet(privateKey, provider)
  const indexer  = new sdk.Indexer(indexerRpc)

  const bytes   = new TextEncoder().encode(JSON.stringify(data))
  const memData = new sdk.MemData(bytes)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, err]: [any, any] = await indexer.upload(memData, rpcUrl, signer)
  if (err) throw new Error(`0G Storage upload failed: ${err}`)

  return typeof result === 'string'
    ? result
    : (result?.rootHash ?? result?.root ?? result?.hash ?? JSON.stringify(result))
}

// ── Agent definitions ─────────────────────────────────────────────────────────

const AGENTS = [
  {
    agentType: 'DeFi Analyst',
    ensName:   'defi-analyst.orchanet.eth',
    systemPrompt: `You are a DeFi protocol analyst for Orcha-net. When given a task, produce a structured analysis covering: 
    (1) protocol mechanics, (2) liquidity risk, (3) incentive alignment, (4) competitive positioning.
    Be specific. Cite on-chain observable properties. Return JSON with fields: findings[], risks[], score (0-10).`,
    capabilities: ['defi-analysis', 'liquidity-modeling', 'protocol-review'],
    version: '1.0.0',
  },
  {
    agentType: 'Smart Contract Auditor',
    ensName:   'auditor.orchanet.eth',
    systemPrompt: `You are a smart contract security auditor for Orcha-net. When given a task, analyze: 
    (1) reentrancy risks, (2) integer overflow/underflow, (3) access control, (4) oracle manipulation vectors.
    Return JSON with fields: vulnerabilities[], severity[] (critical/high/medium/low), recommendations[].`,
    capabilities: ['security-audit', 'vulnerability-detection', 'formal-verification'],
    version: '1.0.0',
  },
  {
    agentType: 'Tokenomics Modeler',
    ensName:   'tokenomics.orchanet.eth',
    systemPrompt: `You are a tokenomics modeler for Orcha-net. Analyze: (1) supply schedule, (2) vesting cliffs, 
    (3) inflation/deflation mechanisms, (4) stakeholder incentive alignment.
    Return JSON with fields: model{}, projections{}, red_flags[].`,
    capabilities: ['tokenomics', 'supply-modeling', 'vesting-analysis'],
    version: '1.0.0',
  },
  {
    agentType: 'Critic',
    ensName:   'critic.orchanet.eth',
    systemPrompt: `You are an adversarial critic for Orcha-net. You receive outputs from multiple specialist agents.
    Your job: (1) identify the weakest or most unsupported claim across all outputs, 
    (2) challenge it with a specific counter-argument, (3) assign a confidence score to each agent's output.
    Return JSON with fields: weakest_claim, challenge, agent_scores{}, consensus_reached (bool).`,
    capabilities: ['adversarial-debate', 'consensus', 'quality-assurance'],
    version: '1.0.0',
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const registryAddress = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS
  if (!registryAddress) {
    throw new Error(
      'NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS not set.\n' +
      'Deploy the contract first: npm run deploy'
    )
  }

  if (!process.env.ZG_PRIVATE_KEY) {
    throw new Error('ZG_PRIVATE_KEY not set')
  }

  const [deployer] = await ethers.getSigners()
  console.log('🔑 Registering with account:', deployer.address)
  console.log('📋 Registry:', registryAddress)
  console.log()

  const registry = await ethers.getContractAt('AgentRegistry', registryAddress)

  for (const agent of AGENTS) {
    console.log(`\n📤 Uploading system prompt for ${agent.agentType} to 0G Storage…`)

    let storageRootHash = 'PENDING'
    try {
      const agentData = {
        agentType:    agent.agentType,
        ensName:      agent.ensName,
        systemPrompt: agent.systemPrompt,
        capabilities: agent.capabilities,
        version:      agent.version,
        uploadedAt:   new Date().toISOString(),
        network:      '0G Galileo Testnet',
      }
      storageRootHash = await uploadToZGStorage(agentData)
      console.log(`   ✅ Uploaded — rootHash: ${storageRootHash}`)
      console.log(`   🔍 https://storagescan.0g.ai/file?rootHash=${storageRootHash}`)
    } catch (err) {
      console.warn(`   ⚠️  0G Storage upload failed: ${err}`)
      console.warn(`   ⚠️  Using placeholder rootHash — re-run after fixing storage config`)
    }

    console.log(`\n📝 Registering ${agent.agentType} on-chain…`)
    try {
      const tx = await registry.registerAgent(
        agent.agentType,
        agent.ensName,
        storageRootHash
      )
      const receipt = await tx.wait()
      console.log(`   ✅ Registered — tx: https://chainscan-galileo.0g.ai/tx/${receipt.hash}`)
    } catch (err) {
      // May fail if already registered
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already')) {
        console.log(`   ⏭️  ${agent.agentType} already registered, skipping`)
      } else {
        console.error(`   ❌ Failed to register ${agent.agentType}: ${msg}`)
      }
    }
  }

  const total = await registry.totalAgents()
  const runCount = await registry.getRunCount()
  console.log(`\n✅ Done. Registry state:`)
  console.log(`   Total agents: ${total}`)
  console.log(`   Total runs:   ${runCount}`)
  console.log(`\n🔗 Registry: https://chainscan-galileo.0g.ai/address/${registryAddress}`)
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
