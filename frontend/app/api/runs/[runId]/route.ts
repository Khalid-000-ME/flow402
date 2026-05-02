import { NextResponse } from 'next/server'
import { downloadFromStorage } from '@/lib/0g/storage'
import { getRunRecord, listRunsFromIndex } from '@/lib/orchestrator/runStore'

export async function GET(
  req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params

  // ── 1. In-memory store (fastest, same server process) ─────────────────
  const inMemory = getRunRecord(runId)
  if (inMemory) {
    return NextResponse.json(inMemory)
  }

  // ── 2. Disk index → 0G Storage (survives server restarts) ─────────────
  const diskIndex = listRunsFromIndex()
  const meta = diskIndex.find((r) => r.runId === runId)
  if (meta?.rootHash) {
    try {
      const runRecord = await downloadFromStorage(meta.rootHash)
      return NextResponse.json(runRecord)
    } catch (err) {
      // 0G Storage unavailable — return the index metadata as a partial record
      console.warn('[runs API] 0G Storage fetch failed, returning index metadata:', err instanceof Error ? err.message : err)
      return NextResponse.json(meta)
    }
  }

  // ── 3. Legacy: RUNS_INDEX_ROOT_HASH env var ────────────────────────────
  const indexRootHash = process.env.RUNS_INDEX_ROOT_HASH
  if (indexRootHash) {
    try {
      const index = await downloadFromStorage(indexRootHash) as { runs: Array<{ runId: string; rootHash: string }> }
      const storageMeta = index.runs?.find((r) => r.runId === runId)
      if (storageMeta?.rootHash) {
        const runRecord = await downloadFromStorage(storageMeta.rootHash)
        return NextResponse.json(runRecord)
      }
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Run not found.' }, { status: 404 })
}
