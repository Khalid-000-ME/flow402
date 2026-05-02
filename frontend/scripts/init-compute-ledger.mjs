#!/usr/bin/env node
/**
 * init-compute-ledger.mjs
 * -----------------------
 * Initialises your 0G Compute payment ledger so the Orcha-net orchestrator
 * can make inference calls.
 *
 * The error "Sub-account not found" means your wallet has A0GI but hasn't
 * opened a compute payment channel. This script does it in two steps:
 *
 *   1. addLedger(balance)              — creates the on-chain ledger (min 3 A0GI)
 *   2. transferFund(provider, amount)  — allocates funds to the provider sub-account
 *
 * Usage:
 *   node scripts/init-compute-ledger.mjs                  # default: 3 A0GI ledger, 1 A0GI to provider
 *   node scripts/init-compute-ledger.mjs --ledger 5       # deposit 5 A0GI total
 *   node scripts/init-compute-ledger.mjs --transfer 2     # transfer 2 A0GI to provider
 *   node scripts/init-compute-ledger.mjs --status         # check current ledger status only
 *
 * Requirements:
 *   ZG_PRIVATE_KEY and ZG_PROVIDER_DEFAULT in .env.local
 */

import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk'
import { JsonRpcProvider, Wallet, formatEther } from 'ethers'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Env loading ───────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(__dir, '../.env.local')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...rest] = trimmed.split('=')
      if (key && !process.env[key]) {
        process.env[key] = rest.join('=')
      }
    }
  } catch {
    // use system env
  }
}

loadEnv()

// ── Args ──────────────────────────────────────────────────────────────────────

const args          = process.argv.slice(2)
const STATUS_ONLY   = args.includes('--status')
const ledgerIdx     = args.indexOf('--ledger')
const transferIdx   = args.indexOf('--transfer')

const LEDGER_AMOUNT   = ledgerIdx   >= 0 ? parseFloat(args[ledgerIdx + 1])   : 3   // A0GI
const TRANSFER_AMOUNT = transferIdx >= 0 ? parseFloat(args[transferIdx + 1]) : 1   // A0GI

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL       = process.env.ZG_RPC_URL           || 'https://evmrpc-testnet.0g.ai'
const PRIVATE_KEY   = process.env.ZG_PRIVATE_KEY        || ''
const PROVIDER_ADDR = process.env.ZG_PROVIDER_DEFAULT  || '0xa48f01287233509FD694a22Bf840225062E67836'

const NEURON_PER_AGOI = BigInt(10 ** 18)

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!PRIVATE_KEY) {
    console.error('❌ ZG_PRIVATE_KEY not set in .env.local')
    process.exit(1)
  }

  const rpcProvider = new JsonRpcProvider(RPC_URL)
  const wallet      = new Wallet(PRIVATE_KEY, rpcProvider)

  console.log('\n🔐 0G Compute — Ledger Initialisation')
  console.log(`   Wallet:   ${wallet.address}`)
  console.log(`   Provider: ${PROVIDER_ADDR}`)
  console.log(`   RPC:      ${RPC_URL}\n`)

  // Check wallet balance first
  const walletBalance = await rpcProvider.getBalance(wallet.address)
  console.log(`💰 Wallet balance: ${formatEther(walletBalance)} A0GI`)

  if (walletBalance === 0n) {
    console.error('\n❌ Wallet has 0 A0GI. Get testnet tokens at: https://faucet.0g.ai')
    process.exit(1)
  }

  // Create the FULL broker (ZGComputeNetworkBroker) — exposes broker.ledger
  // This auto-detects chain ID 16602 → uses testnet contract addresses
  console.log('\n⏳ Connecting to 0G Compute Network…')
  const broker = await createZGComputeNetworkBroker(wallet)
  console.log('   ✅ Connected')

  // ── Status check ────────────────────────────────────────────────────────────

  let ledgerExists = false
  console.log('\n📊 Current ledger status:')

  try {
    const detail = await broker.ledger.getLedgerWithDetail()
    ledgerExists = true

    const total     = detail.ledgerInfo[0]
    const locked    = detail.ledgerInfo[1]
    const available = detail.ledgerInfo[2]

    console.log(`   Total balance:      ${Number(total)     / Number(NEURON_PER_AGOI)} A0GI`)
    console.log(`   Locked in accounts: ${Number(locked)    / Number(NEURON_PER_AGOI)} A0GI`)
    console.log(`   Available:          ${Number(available) / Number(NEURON_PER_AGOI)} A0GI`)

    if (detail.infers && detail.infers.length > 0) {
      console.log('\n   Provider sub-accounts:')
      detail.infers.forEach(([addr, bal, pending]) => {
        const balA = Number(bal) / Number(NEURON_PER_AGOI)
        console.log(`     ${addr}: ${balA} A0GI (pending refund: ${Number(pending) / Number(NEURON_PER_AGOI)} A0GI)`)
      })
    } else {
      console.log('   Provider sub-accounts: none (transfer-fund step needed)')
    }
  } catch (err) {
    const msg = err?.message ?? String(err)
    if (msg.toLowerCase().includes('not found') || msg.includes('revert') || msg.includes('sub-account')) {
      console.log('   No ledger found for this wallet yet.')
    } else {
      console.log(`   Could not read ledger: ${msg}`)
    }
  }

  if (STATUS_ONLY) {
    if (!ledgerExists) {
      console.log('\n⚠️  Run without --status to initialise.')
      console.log('   Command: npm run ledger:init')
    } else {
      console.log('\n✅ Ledger is active.')
    }
    return
  }

  // ── Step 1: Create ledger if it doesn't exist ────────────────────────────

  if (!ledgerExists) {
    console.log(`\n⚙️  Step 1: Creating ledger with ${LEDGER_AMOUNT} A0GI…`)
    console.log(`   Min required: 3 A0GI | You are depositing: ${LEDGER_AMOUNT} A0GI`)

    if (LEDGER_AMOUNT < 3) {
      console.error(`\n❌ Ledger amount ${LEDGER_AMOUNT} A0GI is below minimum (3 A0GI).`)
      process.exit(1)
    }

    try {
      // addLedger takes a plain number (A0GI), not BigInt
      await broker.ledger.addLedger(LEDGER_AMOUNT)
      console.log(`   ✅ Ledger created with ${LEDGER_AMOUNT} A0GI`)
    } catch (err) {
      const msg = err?.message ?? String(err)
      if (msg.includes('already exists')) {
        console.log('   ℹ️  Ledger already exists — skipping creation.')
        ledgerExists = true
      } else {
        console.error(`\n❌ addLedger failed: ${msg}`)
        process.exit(1)
      }
    }
  } else {
    console.log(`\n✅ Step 1: Ledger already exists — skipping.`)
  }

  // ── Step 2: Transfer funds to provider sub-account ───────────────────────

  console.log(`\n⚙️  Step 2: Transferring ${TRANSFER_AMOUNT} A0GI to provider sub-account…`)
  console.log(`   Provider:  ${PROVIDER_ADDR}`)
  console.log(`   Service:   inference`)
  console.log(`   Amount:    ${TRANSFER_AMOUNT} A0GI (min: 1 A0GI)`)

  if (TRANSFER_AMOUNT < 1) {
    console.error('\n❌ Transfer amount must be at least 1 A0GI.')
    process.exit(1)
  }

  try {
    // transferFund(providerAddress, serviceTypeString, amountInNeuron: BigInt)
    const amountNeuron = BigInt(Math.floor(TRANSFER_AMOUNT * Number(NEURON_PER_AGOI)))
    await broker.ledger.transferFund(PROVIDER_ADDR, 'inference', amountNeuron)
    console.log(`   ✅ Transferred ${TRANSFER_AMOUNT} A0GI to provider sub-account`)
  } catch (err) {
    const msg = err?.message ?? String(err)
    console.error(`\n❌ transferFund failed: ${msg}`)
    console.error('\n   Possible causes:')
    console.error('   • Ledger has insufficient available balance')
    console.error('   • Provider address is wrong (check ZG_PROVIDER_DEFAULT)')
    console.error('   • Try running: npm run providers:update  then retry')
    process.exit(1)
  }

  // ── Final status ─────────────────────────────────────────────────────────

  console.log('\n🏁 Final ledger state:')
  try {
    const detail = await broker.ledger.getLedgerWithDetail()
    const total     = detail.ledgerInfo[0]
    const available = detail.ledgerInfo[2]
    console.log(`   Total:     ${Number(total)     / Number(NEURON_PER_AGOI)} A0GI`)
    console.log(`   Available: ${Number(available) / Number(NEURON_PER_AGOI)} A0GI`)
    if (detail.infers?.length > 0) {
      console.log('\n   Provider sub-accounts:')
      detail.infers.forEach(([addr, bal]) => {
        console.log(`     ${addr}: ${Number(bal) / Number(NEURON_PER_AGOI)} A0GI ✅`)
      })
    }
  } catch {
    // silent — we already succeeded
  }

  console.log('\n🚀 Compute ledger ready! Agents can now make on-chain settled inference calls.')
  console.log('   Head to http://localhost:3000/chat and submit a prompt.')
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err?.message ?? err)
  process.exit(1)
})
