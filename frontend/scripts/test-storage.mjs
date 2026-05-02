#!/usr/bin/env node
/**
 * test-storage.mjs
 * ─────────────────
 * Tests 0G Storage download using the correct SDK method.
 * Usage: node scripts/test-storage.mjs [rootHash]
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

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

const INDEXER = process.env.ZG_INDEXER_RPC || 'https://indexer-storage-testnet-turbo.0g.ai'
const ROOT_HASH = process.argv[2] || '0x08cba70f6872eda460d113586229f3228c9ba64261528616ac84056e381e525b'

async function main() {
  console.log('\n🔍 0G Storage Download Test')
  console.log(`   Indexer:  ${INDEXER}`)
  console.log(`   RootHash: ${ROOT_HASH}\n`)

  const sdk = await import('@0gfoundation/0g-storage-ts-sdk')
  const indexer = new sdk.Indexer(INDEXER)

  // ── Method 1: downloadToBlob ─────────────────────────────────────────────
  console.log('─── Method 1: indexer.downloadToBlob() ───')
  try {
    const result = await Promise.race([
      indexer.downloadToBlob(ROOT_HASH, { proof: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 15s')), 15000)),
    ])

    let blob = null, err = null
    if (Array.isArray(result)) {
      ;[blob, err] = result
    } else if (result && typeof result === 'object' && result.arrayBuffer) {
      blob = result
    }

    if (err)  { console.log('❌ Error:', err); }
    else if (!blob) { console.log('❌ null blob returned') }
    else {
      const buf  = await blob.arrayBuffer()
      const text = Buffer.from(buf).toString('utf8')
      console.log('✅ Success! Size:', buf.byteLength, 'bytes')
      console.log('Preview:', text.slice(0, 300))
      try {
        const json = JSON.parse(text)
        console.log('✅ Valid JSON. Keys:', Object.keys(json))
        if (json.runId) console.log('   runId:', json.runId)
      } catch { console.log('⚠️  Not valid JSON') }
    }
  } catch (e) {
    console.log('❌ Threw:', e.message)
  }

  // ── Method 2: Direct storage node JSON-RPC ───────────────────────────────
  console.log('\n─── Method 2: Storage node JSON-RPC (zgs_downloadSegment) ───')
  const nodes = [
    'http://34.83.53.209:5678',
    'http://34.169.28.106:5678',
    'http://34.19.125.196:5678',
  ]

  for (const node of nodes) {
    console.log(`Testing ${node}...`)
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'zgs_downloadSegment',
          params: [ROOT_HASH, 0, 10],
          id: 1,
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) { console.log(`  ❌ HTTP ${res.status}`); continue }
      const rpc = await res.json()
      if (rpc.error) { console.log('  ❌ RPC error:', JSON.stringify(rpc.error)); continue }
      if (!rpc.result) { console.log('  ❌ No result field'); continue }
      const raw  = Buffer.from(rpc.result, 'base64').toString('utf8')
      const text = raw.replace(/\0+$/, '').trim()
      console.log(`  ✅ Got ${rpc.result.length} base64 chars → ${text.length} text chars`)
      console.log('  Preview:', text.slice(0, 200))
      break
    } catch (e) {
      console.log('  ❌', e.message)
    }
  }

  // ── Method 3: StorageScan REST API ──────────────────────────────────────
  console.log('\n─── Method 3: StorageScan public API ───')
  const scanUrls = [
    `https://storagescan.0g.ai/api/files/${ROOT_HASH}`,
    `https://storagescan-galileo.0g.ai/api/v1/file?hash=${ROOT_HASH}`,
  ]
  for (const url of scanUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      console.log(`${url}: HTTP ${res.status}`)
      if (res.ok) {
        const t = await res.text()
        console.log('  Result:', t.slice(0, 200))
      }
    } catch (e) {
      console.log(`${url}: ❌ ${e.message}`)
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
