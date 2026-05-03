/**
 * POST /api/deploy-vault
 *
 * Deploys SpawnFeeVault to 0G Galileo Testnet using the server-side
 * orchestrator wallet (ZG_PRIVATE_KEY).
 *
 * - Deploys the contract
 * - Seeds it with 0.01 OG
 * - Persists SPAWN_FEE_VAULT_ADDRESS + SPAWN_FEE_ENABLED in .env.local
 * - Returns the deployed address + tx hashes
 *
 * Call once from the browser:  POST /api/deploy-vault
 */

import { NextResponse } from 'next/server'
import { ethers }       from 'ethers'
import fs               from 'fs'
import path             from 'path'

const RPC_URL    = process.env.ZG_RPC_URL    || 'https://evmrpc-testnet.0g.ai'
const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY || ''

// eslint-disable-next-line @typescript-eslint/no-require-imports
const artifact = require('@/lib/orchestrator/SpawnFeeVault.artifact.json') as {
  abi: ethers.InterfaceAbi
  bytecode: string
}

export async function POST() {
  if (!PRIVATE_KEY) {
    return NextResponse.json({ error: 'ZG_PRIVATE_KEY not set' }, { status: 400 })
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider)

  const balance = await provider.getBalance(wallet.address)
  if (balance < ethers.parseEther('0.001')) {
    return NextResponse.json({
      error: `Insufficient balance: ${ethers.formatEther(balance)} OG (need ≥ 0.001 OG for gas)`,
    }, { status: 400 })
  }

  // ── Deploy ──────────────────────────────────────────────────────────────────
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)
  const contract = await factory.deploy(wallet.address)
  await contract.waitForDeployment()

  const vaultAddress = await contract.getAddress()
  const deployTxHash = contract.deploymentTransaction()?.hash ?? ''

  console.log('[deploy-vault] SpawnFeeVault deployed:', vaultAddress, 'tx:', deployTxHash)

  // ── Persist to .env.local ───────────────────────────────────────────────────
  const envPath = path.join(process.cwd(), '.env.local')
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''

  const upsert = (key: string, value: string) => {
    if (envContent.includes(`${key}=`)) {
      envContent = envContent.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`)
    } else {
      envContent += `\n${key}=${value}`
    }
  }

  upsert('SPAWN_FEE_VAULT_ADDRESS', vaultAddress)
  upsert('SPAWN_FEE_ENABLED', 'true')
  if (!envContent.includes('SPAWN_FEE_OG=')) envContent += '\nSPAWN_FEE_OG=0.001'

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8')
  console.log('[deploy-vault] Written SPAWN_FEE_VAULT_ADDRESS to .env.local')

  return NextResponse.json({
    success: true,
    vaultAddress,
    deployTxHash,
    orchestrator: wallet.address,
    explorerUrl: `https://chainscan-galileo.0g.ai/address/${vaultAddress}`,
    message: 'SpawnFeeVault (direct-pay) deployed. Restart the dev server to activate.',
  })
}
