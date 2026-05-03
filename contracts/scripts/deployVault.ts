/**
 * Deploy SpawnFeeVault to 0G Galileo Testnet
 *
 * Usage:
 *   cd contracts
 *   npx hardhat run scripts/deployVault.ts --network zgTestnet
 *
 * Automatically writes SPAWN_FEE_VAULT_ADDRESS to frontend/.env.local
 */

import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') })

async function main() {
  const [deployer] = await ethers.getSigners()
  const orchestratorAddress = deployer.address

  console.log('\n🔑 Deployer / Orchestrator:', orchestratorAddress)

  const balance = await ethers.provider.getBalance(orchestratorAddress)
  console.log('💰 Balance:', ethers.formatEther(balance), 'OG')

  if (balance < ethers.parseEther('0.05')) {
    throw new Error('Insufficient balance — need at least 0.05 OG to deploy + seed vault')
  }

  console.log('\n📦 Deploying SpawnFeeVault…')
  const Factory = await ethers.getContractFactory('SpawnFeeVault')
  const vault = await Factory.deploy(orchestratorAddress)
  await vault.waitForDeployment()

  const vaultAddress = await vault.getAddress()
  const deployTx = vault.deploymentTransaction()
  console.log('✅ SpawnFeeVault deployed:', vaultAddress)
  console.log('   TX:', deployTx?.hash)

  // ── Seed the vault with 0.01 OG so credits can be issued immediately ───────
  const seedAmount = ethers.parseEther('0.01')
  console.log('\n💸 Seeding vault with 0.01 OG…')
  const seedTx = await deployer.sendTransaction({
    to: vaultAddress,
    value: seedAmount,
  })
  await seedTx.wait()
  console.log('✅ Vault seeded — TX:', seedTx.hash)
  console.log('   Vault balance:', ethers.formatEther(await ethers.provider.getBalance(vaultAddress)), 'OG')

  // ── Write address to frontend/.env.local ──────────────────────────────────
  const envPath = path.resolve(__dirname, '../../frontend/.env.local')
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''

  const key = 'SPAWN_FEE_VAULT_ADDRESS'
  if (envContent.includes(key)) {
    envContent = envContent.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${vaultAddress}`)
  } else {
    envContent += `\n${key}=${vaultAddress}`
  }

  // Also ensure SPAWN_FEE_ENABLED=true and SPAWN_FEE_OG is set
  if (!envContent.includes('SPAWN_FEE_ENABLED')) {
    envContent += '\nSPAWN_FEE_ENABLED=true'
  } else {
    envContent = envContent.replace(/^SPAWN_FEE_ENABLED=.*$/m, 'SPAWN_FEE_ENABLED=true')
  }
  if (!envContent.includes('SPAWN_FEE_OG')) {
    envContent += '\nSPAWN_FEE_OG=0.001'
  }

  fs.writeFileSync(envPath, envContent, 'utf8')
  console.log('\n📝 Written to frontend/.env.local:')
  console.log(`   SPAWN_FEE_VAULT_ADDRESS=${vaultAddress}`)
  console.log('   SPAWN_FEE_ENABLED=true')
  console.log('   SPAWN_FEE_OG=0.001')

  console.log('\n🎉 Done! SpawnFeeVault is live. Restart the dev server to pick up env changes.')
  console.log('\n   Explorer:', `https://chainscan-galileo.0g.ai/address/${vaultAddress}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
