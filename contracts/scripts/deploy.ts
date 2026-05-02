import { ethers } from 'hardhat'
import * as dotenv from 'dotenv'
import path from 'path'

// Load from contracts/.env first, then fall back to frontend/.env.local
dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') })

async function main() {
  const [deployer] = await ethers.getSigners()

  if (!deployer) {
    throw new Error(
      'No signer found. Set ZG_PRIVATE_KEY in contracts/.env or frontend/.env.local\n' +
      'Get testnet A0GI from: https://faucet.0g.ai'
    )
  }

  console.log('🔑 Deploying with account:', deployer.address)

  const balance = await deployer.provider.getBalance(deployer.address)
  console.log('💰 Balance:', ethers.formatEther(balance), 'A0GI')

  if (balance === 0n) {
    console.warn('⚠️  Wallet has 0 A0GI — get testnet tokens from https://faucet.0g.ai')
  }

  const AgentRegistry = await ethers.getContractFactory('AgentRegistry')
  const registry = await AgentRegistry.deploy()
  await registry.waitForDeployment()

  const address = await registry.getAddress()

  console.log('\n✅ AgentRegistry deployed!')
  console.log('📋 Address:  ', address)
  console.log('🔍 Explorer: ', `https://chainscan-galileo.0g.ai/address/${address}`)
  console.log('\n📝 Add to frontend/.env.local:')
  console.log(`   NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=${address}`)
  console.log('\n📝 Then seed agents:')
  console.log('   npm run register')
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message ?? err)
  process.exit(1)
})
