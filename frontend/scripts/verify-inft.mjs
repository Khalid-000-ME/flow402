#!/usr/bin/env node
/**
 * verify-inft.mjs
 * ───────────────
 * Verifies iNFT identity for all registered agents from AgentRegistry.
 * Zero gas — all eth_call (read-only).
 *
 * Usage:
 *   node scripts/verify-inft.mjs
 */

import { ethers } from 'ethers'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// Load .env.local
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dir, '../.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const [k, ...v] = t.split('=')
      if (k && !process.env[k]) process.env[k] = v.join('=')
    }
  } catch { /* use system env */ }
}
loadEnv()

const RPC_URL          = process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai'
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || ''

const ABI = [
  'function totalAgents() external view returns (uint256)',
  'function getAgent(uint256 tokenId) external view returns (tuple(uint256 tokenId, string agentType, string ensName, bytes32 metadataHash, string storageRootHash, address owner, uint256 spawnCount, uint256 registeredAt, bool active))',
]

async function main() {
  if (!REGISTRY_ADDRESS) {
    console.error('❌ NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS not set in .env.local')
    process.exit(1)
  }

  console.log('\n🔍 Orcha-net iNFT Identity Verification')
  console.log(`   Registry: ${REGISTRY_ADDRESS}`)
  console.log(`   Network:  0G Galileo Testnet (chainId 16602)`)
  console.log(`   Explorer: https://chainscan-galileo.0g.ai/address/${REGISTRY_ADDRESS}\n`)

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const registry = new ethers.Contract(REGISTRY_ADDRESS, ABI, provider)

  const total = Number(await registry.totalAgents())
  console.log(`📦 Total registered agents: ${total}\n`)

  let allVerified = true

  for (let i = 0; i < total; i++) {
    const a = await registry.getAgent(i)

    // Replicate the contract's metadataHash computation
    const computedHash = ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'string', 'string'],
        [a.agentType, a.ensName, a.storageRootHash]
      )
    )
    const verified = computedHash.toLowerCase() === a.metadataHash.toLowerCase()
    if (!verified) allVerified = false

    const status = verified ? '✅' : '❌'
    console.log(`${status} Token #${a.tokenId} — ${a.agentType}`)
    console.log(`   ENS:         ${a.ensName}`)
    console.log(`   metadataHash:${a.metadataHash}`)
    console.log(`   computed:    ${computedHash}`)
    console.log(`   verified:    ${verified ? 'PASS — on-chain hash matches' : 'FAIL — TAMPERED'}`)
    console.log(`   spawnCount:  ${a.spawnCount}`)
    console.log(`   storageHash: ${a.storageRootHash}`)
    console.log(`   storageScan: https://storagescan.0g.ai/file?rootHash=${a.storageRootHash}`)
    console.log(`   active:      ${a.active}`)
    console.log(`   owner:       ${a.owner}`)
    console.log(`   registered:  ${new Date(Number(a.registeredAt) * 1000).toISOString()}`)
    console.log()
  }

  console.log('─'.repeat(60))
  if (allVerified) {
    console.log(`✅ All ${total} agents verified. Identity chain is intact.`)
  } else {
    console.log(`❌ Some agents failed verification. Check logs above.`)
  }
  console.log()
}

main().catch((err) => {
  console.error('❌ Fatal:', err?.message ?? err)
  process.exit(1)
})
