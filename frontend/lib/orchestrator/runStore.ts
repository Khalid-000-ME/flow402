/**
 * Persistent run store
 *
 * Keeps runs in two places:
 *  1. In-memory map  — instant lookup for the current server process
 *  2. Local JSON file — survives server restarts (written on every new run)
 *
 * The file lives at <projectRoot>/data/runs-index.json.
 * It is git-ignored and never uploaded to 0G Storage.
 */

import type { RunRecord } from '@/lib/types'
import fs from 'fs'
import path from 'path'

// ── File path ────────────────────────────────────────────────────────────────

function indexFilePath(): string {
  // __dirname resolves to the compiled .next/server directory at runtime,
  // so we walk up to find the project root via cwd().
  const dataDir = path.join(process.cwd(), 'data')
  return path.join(dataDir, 'runs-index.json')
}

interface IndexEntry {
  runId: string
  prompt: string
  status: string
  agentsSpawned: number
  inferenceCalls: number
  storageBytesCommitted: number
  duration: number
  timestamp: number
  rootHash: string
  storageTxHash?: string
}

// ── In-memory store ───────────────────────────────────────────────────────────

const store = new Map<string, RunRecord>()

// ── File helpers ──────────────────────────────────────────────────────────────

function readIndex(): IndexEntry[] {
  try {
    const raw = fs.readFileSync(indexFilePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.runs) ? parsed.runs : []
  } catch {
    return []
  }
}

function writeIndex(entries: IndexEntry[]) {
  try {
    const filePath = indexFilePath()
    // Ensure the data/ directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify({ runs: entries }, null, 2), 'utf8')
  } catch (err) {
    console.warn('[runStore] Failed to write runs index:', err instanceof Error ? err.message : err)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Save a completed run record (in-memory + disk) */
export function setRunRecord(runId: string, record: RunRecord) {
  store.set(runId, record)

  // Prune old runs from memory (keep last 50)
  if (store.size > 50) {
    const firstKey = store.keys().next().value
    if (firstKey) store.delete(firstKey)
  }

  // Persist to disk index (prepend newest first)
  const existing = readIndex().filter((e) => e.runId !== runId)
  const entry: IndexEntry = {
    runId: record.runId,
    prompt: record.prompt,
    status: record.status,
    agentsSpawned: record.agentsSpawned,
    inferenceCalls: record.inferenceCalls,
    storageBytesCommitted: record.storageBytesCommitted,
    duration: record.duration,
    timestamp: record.timestamp,
    rootHash: record.rootHash,
    storageTxHash: record.storageTxHash,
  }
  writeIndex([entry, ...existing].slice(0, 200)) // keep last 200 on disk
}

/** Get a full run record by ID (memory first, then undefined) */
export function getRunRecord(runId: string): RunRecord | undefined {
  return store.get(runId)
}

/** List all runs from disk index (newest first) */
export function listRunsFromIndex(): IndexEntry[] {
  return readIndex()
}
