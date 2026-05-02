import { NextResponse } from 'next/server'
import { downloadFromStorage } from '@/lib/0g/storage'
import { getRunRecord } from '@/lib/orchestrator/runStore'

/**
 * GET /api/runs/[runId]/download
 *
 * Downloads the raw JSON run-record artifact from 0G Storage and returns it
 * as an attachment so the browser saves it as a .json file.
 *
 * Priority:
 *   1. In-memory store (recent runs in the same server process)
 *   2. 0G Storage by rootHash stored in the run record
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params

  // ── 1. Try in-memory first ─────────────────────────────────────────────
  const inMemory = getRunRecord(runId)
  if (inMemory) {
    const body = JSON.stringify(inMemory, null, 2)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="run-${runId.slice(0, 8)}.json"`,
        'Content-Length': String(Buffer.byteLength(body)),
      },
    })
  }

  // ── 2. Fetch from 0G Storage by rootHash ──────────────────────────────
  // The run record stored in 0G Storage contains its own rootHash field,
  // but we need the rootHash to look it up. Check env for a runs index.
  const indexRootHash = process.env.RUNS_INDEX_ROOT_HASH
  if (!indexRootHash) {
    return NextResponse.json(
      { error: 'Run not found in memory and no storage index configured (RUNS_INDEX_ROOT_HASH).' },
      { status: 404 }
    )
  }

  try {
    const index = await downloadFromStorage(indexRootHash) as {
      runs: Array<{ runId: string; rootHash: string }>
    }
    const meta = index.runs?.find((r) => r.runId === runId)
    if (!meta?.rootHash) {
      return NextResponse.json({ error: 'Run not found in storage index.' }, { status: 404 })
    }

    const runRecord = await downloadFromStorage(meta.rootHash)
    const body = JSON.stringify(runRecord, null, 2)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="run-${runId.slice(0, 8)}.json"`,
        'Content-Length': String(Buffer.byteLength(body)),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
