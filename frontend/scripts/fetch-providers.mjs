#!/usr/bin/env node
/**
 * fetch-providers.mjs
 * -------------------
 * Fetches all live 0G Compute inference providers from the testnet
 * using the read-only broker (no wallet or private key required).
 *
 * Usage:
 *   node scripts/fetch-providers.mjs
 *   node scripts/fetch-providers.mjs --auto-update   # writes best to .env.local
 *   node scripts/fetch-providers.mjs --json          # raw JSON output
 *
 * Requirements:
 *   ZG_RPC_URL in .env.local (defaults to https://evmrpc-testnet.0g.ai)
 */

import { createReadOnlyInferenceBroker } from '@0gfoundation/0g-compute-ts-sdk'
import { readFileSync, writeFileSync }   from 'fs'
import { resolve, dirname }              from 'path'
import { fileURLToPath }                 from 'url'

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
    // .env.local not present — use system env
  }
}

loadEnv()

// ── Args ──────────────────────────────────────────────────────────────────────

const args         = process.argv.slice(2)
const AUTO_UPDATE  = args.includes('--auto-update')
const JSON_OUTPUT  = args.includes('--json')
const PING_CHECK   = !args.includes('--no-ping')   // default: check endpoints live

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(raw) {
  if (!raw) return 'unknown'
  try {
    // Price is in neuron (1e18) per token — convert to sensible unit
    const n = BigInt(raw.toString())
    if (n === 0n) return 'free'
    const perMillion = Number(n) / 1e12  // neuron per token → µA0GI per million tokens
    return `${perMillion.toFixed(4)} µA0GI/M tokens`
  } catch {
    return raw.toString()
  }
}

function trimAddr(addr) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

async function pingEndpoint(url, timeoutMs = 4000) {
  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res   = await fetch(`${url}/models`, { signal: ctrl.signal })
    clearTimeout(timer)
    // 200 = open access, 401/403 = auth required (provider IS live), 404 = path wrong but host up
    return res.status < 500
  } catch {
    // connection refused or DNS failure = truly unreachable
    return false
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!JSON_OUTPUT) {
    console.log('\n🔍 0G Compute — Provider Discovery')
    console.log(`   RPC: ${RPC_URL}`)
    console.log(`   Testnet Chain ID: 16602\n`)
  }

  // Connect read-only broker (no private key needed)
  // createReadOnlyInferenceBroker takes an RPC URL string, chain ID is auto-detected
  const broker = await createReadOnlyInferenceBroker(RPC_URL)

  let services
  try {
    // listServiceWithDetail returns richer data (endpoint, model, pricing)
    services = await broker.listServiceWithDetail()
  } catch (err) {
    // fallback to basic listService
    services = await broker.listService()
  }

  if (!services || services.length === 0) {
    if (JSON_OUTPUT) {
      console.log(JSON.stringify({ providers: [] }))
    } else {
      console.log('⚠️  No providers found on testnet.')
      console.log('   Try again later or check: https://build.0g.ai/compute/providers')
    }
    return
  }

  // Normalise field names across SDK versions
  const normalised = services.map((s) => ({
    address:  s.providerAddress ?? s.provider ?? s.serviceAddress ?? '',
    endpoint: s.url            ?? s.endpoint  ?? '',
    model:    s.model          ?? s.modelName ?? 'unknown',
    price:    s.inputPrice     ?? s.pricePerToken ?? s.price ?? 0,
    type:     s.serviceType    ?? s.type      ?? 'inference',
    raw:      s,
  }))

  // Ping endpoints in parallel (optional liveness check)
  const results = await Promise.all(
    normalised.map(async (p) => ({
      ...p,
      live: PING_CHECK && p.endpoint ? await pingEndpoint(p.endpoint) : null,
    }))
  )

  // Sort: live first → text models preferred for Orcha-net → price ascending
  const isTextModel = (m) => !m.toLowerCase().includes('image') && !m.toLowerCase().includes('vision')
  results.sort((a, b) => {
    if (a.live && !b.live) return -1
    if (!a.live && b.live) return 1
    // Prefer text models
    if (isTextModel(a.model) && !isTextModel(b.model)) return -1
    if (!isTextModel(a.model) && isTextModel(b.model)) return 1
    try {
      return Number(BigInt(a.price.toString()) - BigInt(b.price.toString()))
    } catch {
      return 0
    }
  })

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ providers: results.map(({ raw, ...r }) => r) }, null, 2))
    return
  }

  // ── Pretty print ─────────────────────────────────────────────────────────

  const liveCount   = results.filter((r) => r.live === true).length
  const isText      = (m) => !m.toLowerCase().includes('image') && !m.toLowerCase().includes('vision')
  const status      = (r) => {
    if (r.live === true)  return '🟢'
    if (r.live === false) return '🔴'
    return '⚪'
  }

  console.log(`Found ${results.length} provider(s)${PING_CHECK ? ` · ${liveCount} live` : ''}:\n`)

  results.forEach((p, i) => {
    const isBest   = i === 0
    const isGoodModel = isText(p.model)
    const tag = isBest ? ' ← BEST' : ''
    const rec = isGoodModel ? ' ★ text' : ' (image)'
    console.log(`  ${status(p)} [${i + 1}] ${p.address}${tag}`)
    console.log(`       Model:    ${p.model}${rec}`)
    console.log(`       Endpoint: ${p.endpoint || '(hidden)'}`)
    console.log(`       Price:    ${formatPrice(p.price)}`)
    console.log()
  })

  if (liveCount === 0 && PING_CHECK) {
    console.log('  ℹ️  All providers show 🔴 — this is expected.')
    console.log('     0G Compute endpoints require signed auth headers; they reject')
    console.log('     unauthenticated /models pings. The providers above ARE reachable.')
    console.log()
  }

  // ── Best pick ─────────────────────────────────────────────────────────────

  // Pick the best TEXT model provider for Orcha-net (we do chat, not image editing)
  const bestText = results.find((r) => isText(r.model)) ?? results[0]
  if (!bestText) return

  console.log('─'.repeat(60))
  console.log(`✅ Recommended for Orcha-net: ${bestText.address}`)
  console.log(`   Model:    ${bestText.model}`)
  console.log(`   Endpoint: ${bestText.endpoint}`)
  console.log(`   Price:    ${formatPrice(bestText.price)}`)
  console.log(`   Note:     🔴 ping = expected (endpoint requires signed auth headers)`)

  // ── Auto-update .env.local ────────────────────────────────────────────────

  if (AUTO_UPDATE) {
    const envPath = resolve(__dir, '../.env.local')
    try {
      let content = readFileSync(envPath, 'utf8')
      const re = /^ZG_PROVIDER_DEFAULT=.*/m

      if (re.test(content)) {
        content = content.replace(re, `ZG_PROVIDER_DEFAULT=${bestText.address}`)
      } else {
        content += `\nZG_PROVIDER_DEFAULT=${bestText.address}\n`
      }

      writeFileSync(envPath, content, 'utf8')
      console.log(`\n📝 Updated .env.local → ZG_PROVIDER_DEFAULT=${bestText.address}`)
    } catch (err) {
      console.error(`\n❌ Could not update .env.local: ${err.message}`)
    }
  } else {
    console.log('\n💡 To auto-update .env.local, run:')
    console.log(`   npm run providers:update`)
    console.log('\n   Or manually set in .env.local:')
    console.log(`   ZG_PROVIDER_DEFAULT=${bestText.address}`)
  }
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message ?? err)
  process.exit(1)
})
