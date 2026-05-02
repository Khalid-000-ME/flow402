import { NextResponse } from 'next/server'
import { listRunsFromIndex } from '@/lib/orchestrator/runStore'

/**
 * GET /api/runs
 *
 * Returns all run metadata from the persistent local index (data/runs-index.json).
 * Newest runs are listed first.
 *
 * Falls back to 0G Storage index if RUNS_INDEX_ROOT_HASH is configured
 * (not implemented yet — disk index is the primary source).
 */
export async function GET() {
  try {
    const runs = listRunsFromIndex()
    return NextResponse.json(runs)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
