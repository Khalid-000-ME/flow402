import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'
import path from 'path'

// Load contracts/.env first, then fall back to sibling frontend/.env.local
dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../frontend/.env.local') })

const privateKey = process.env.ZG_PRIVATE_KEY

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    zgTestnet: {
      url: process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai',
      chainId: 16602, // 0G Galileo Testnet (updated May 2026)
      accounts: privateKey ? [privateKey] : [],
    },
  },
  paths: {
    sources: './contracts',
    tests:   './test',
    cache:   './cache',
    artifacts: './artifacts',
  },
}

export default config
