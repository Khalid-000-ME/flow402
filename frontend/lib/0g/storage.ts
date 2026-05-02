/**
 * 0G Storage Network — upload / download wrapper
 *
 * Uses @0gfoundation/0g-storage-ts-sdk (correct package name as of 2026).
 *
 * Key APIs:
 *   new Indexer(indexerRpc)              — indexer client
 *   indexer.upload(file, rpcUrl, signer) — returns [rootHash, error]
 *   indexer.download(rootHash, destPath, verify) — downloads to disk
 *
 * For server-side (Node.js) usage we download to a tmp path and read back.
 * For in-memory blobs we upload using the MemData helper.
 *
 * Docs: https://build.0g.ai/storage/
 */

import { ethers } from 'ethers'

// os, path, fs not needed anymore — using in-memory download

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL     = process.env.ZG_RPC_URL      || 'https://evmrpc-testnet.0g.ai'
const PRIVATE_KEY = process.env.ZG_PRIVATE_KEY  || ''
const INDEXER_RPC = process.env.ZG_INDEXER_RPC  || 'https://indexer-storage-testnet-turbo.0g.ai'

// ── SDK lazy loader (avoids SSR/CJS conflicts) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSdk(): Promise<any> {
  // @ts-ignore — package types may not fully resolve via exports map
  return import('@0gfoundation/0g-storage-ts-sdk')
}

async function getIndexer() {
  const sdk = await getSdk()
  return new sdk.Indexer(INDEXER_RPC)
}

// ── Upload ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  rootHash: string
  /** Flow contract txHash — real on-chain transaction, linkable on chainscan-galileo.0g.ai */
  txHash: string
  bytes: number
  indexerRpc: string
  scanUrl: string
}

/**
 * Upload a JSON-serialisable object to 0G Storage.
 * Returns the Merkle root hash which serves as the permanent content address.
 */
export async function uploadToStorage(data: object): Promise<UploadResult> {
  if (!PRIVATE_KEY) {
    throw new Error('ZG_PRIVATE_KEY is required for 0G Storage uploads')
  }

  const sdk        = await getSdk()
  const zgProvider = new ethers.JsonRpcProvider(RPC_URL)
  const signer     = new ethers.Wallet(PRIVATE_KEY, zgProvider)
  const indexer    = new sdk.Indexer(INDEXER_RPC)

  const bytes   = new TextEncoder().encode(JSON.stringify(data))
  const memData = new sdk.MemData(bytes)

  // upload returns [{ txHash, rootHash, txSeq } | result, error]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, err]: [any, any] = await indexer.upload(memData, RPC_URL, signer)
  if (err) throw new Error(`0G Storage upload failed: ${err}`)

  // Normalise: result is { txHash, rootHash, txSeq } for single-file uploads
  const rootHash: string =
    typeof result === 'string'
      ? result
      : (result?.rootHash ?? result?.root ?? result?.hash ?? '')

  const txHash: string = result?.txHash ?? ''

  return {
    rootHash,
    txHash,
    bytes: bytes.length,
    indexerRpc: INDEXER_RPC,
    scanUrl: `https://storagescan-galileo.0g.ai/tx/${rootHash}`,
  }
}

// ── Download ──────────────────────────────────────────────────────────────────

/**
 * Download a JSON blob from 0G Storage by its root hash.
 * Uses downloadToBlob (in-memory, no disk I/O) — correct for server-side use.
 */
export async function downloadFromStorage<T = object>(rootHash: string): Promise<T> {
  const indexer = await getIndexer()

  try {
    // downloadToBlob(rootHash, opts) returns [Blob, Error | null]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await indexer.downloadToBlob(rootHash, { proof: true })

    // Handle both [blob, err] tuple and direct blob return
    let blob: Blob | null = null
    let dlErr: unknown = null

    if (Array.isArray(result)) {
      ;[blob, dlErr] = result
    } else if (result && typeof result === 'object' && result.arrayBuffer) {
      blob = result
    }

    if (dlErr) throw new Error(`0G Storage download error: ${dlErr}`)
    if (!blob)  throw new Error('0G Storage: downloadToBlob returned null')

    // Decode Blob → text → JSON
    const buf  = await blob.arrayBuffer()
    const text = Buffer.from(buf).toString('utf8')
    return JSON.parse(text) as T

  } catch (err) {
    // Fallback: try storage node JSON-RPC directly
    console.warn('[0G Storage] Indexer download failed, trying node fallback:', err instanceof Error ? err.message : err)
    return downloadFromNodeFallback<T>(rootHash)
  }
}

/**
 * Fallback: download data directly from a known storage node via JSON-RPC.
 * The 0G storage nodes expose zgs_downloadSegment at port 5678.
 */
async function downloadFromNodeFallback<T>(rootHash: string): Promise<T> {
  // Storage nodes seen in upload logs
  const nodes = [
    'http://34.83.53.209:5678',
    'http://34.169.28.106:5678',
    'http://34.19.125.196:5678',
  ]

  for (const node of nodes) {
    try {
      // zgs_downloadSegment(rootHash, segmentIndex, maxChunks)
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'zgs_downloadSegment',
          params: [rootHash, 0, 10],
          id: 1,
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) continue

      const rpc = await res.json() as { result?: string; error?: unknown }
      if (rpc.error || !rpc.result) continue

      // result is base64-encoded segment data
      const raw  = Buffer.from(rpc.result, 'base64').toString('utf8')
      // The raw data may have trailing null bytes from chunk padding
      const text = raw.replace(/\0+$/, '').trim()
      return JSON.parse(text) as T
    } catch {
      continue
    }
  }

  throw new Error(`0G Storage: could not retrieve rootHash ${rootHash} from any node`)
}

// ── Storage scan helper ───────────────────────────────────────────────────────

export function storageScanUrl(rootHash: string): string {
  return `https://storagescan-galileo.0g.ai/tx/${rootHash}`
}

// ── Verify ────────────────────────────────────────────────────────────────────

/**
 * Check whether a file with the given rootHash is available on 0G Storage.
 * Hits the StorageScan API (public, no auth required).
 */
export async function verifyStorageFile(rootHash: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://storagescan-galileo.0g.ai/api/v1/file?hash=${rootHash}`,
      { signal: AbortSignal.timeout(5000) }
    )
    return res.ok
  } catch {
    return false
  }
}
