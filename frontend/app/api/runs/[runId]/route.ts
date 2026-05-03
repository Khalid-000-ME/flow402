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
      const runRecord = await downloadFromStorage(meta.rootHash) as Record<string, unknown>

      // ── Inject persisted tx hashes as synthetic events ─────────────────
      // The run record was uploaded BEFORE storage_committed and chain_committed
      // events fired, so those events are absent from the stored blob.
      // We persist the tx hashes on disk and splice them back in here.
      const events = (runRecord.events as Array<Record<string, unknown>>) ?? []

      // ── Find storage tx hash ────────────────────────────────────────────
      const storageTxHash = meta.storageTxHash ||
        (events.find(e =>
          e.type === 'storage_committed' &&
          typeof e.txHash === 'string' &&
          (e.txHash as string).startsWith('0x') &&
          // Exclude the commitRun event (has label containing 'commitRun')
          !String(e.label ?? '').includes('commitRun')
        )?.txHash as string | undefined)

      // ── Find commitRun (chain) tx hash — two formats ─────────────────────
      // New format: type = 'chain_committed'
      // Old format (bug): type = 'storage_committed', label contains 'commitRun'
      const chainTxHash = meta.chainTxHash ||
        (events.find(e =>
          e.type === 'chain_committed' ||
          (e.type === 'storage_committed' && String(e.label ?? '').toLowerCase().includes('commitrun'))
        )?.txHash as string | undefined)

      const hasStorageTx = storageTxHash && events.some(e =>
        e.type === 'storage_committed' &&
        e.txHash === storageTxHash &&
        !String(e.label ?? '').includes('commitRun')
      )
      const hasChainTx = chainTxHash && events.some(e =>
        (e.type === 'chain_committed' || String(e.label ?? '').toLowerCase().includes('commitrun')) &&
        e.txHash === chainTxHash
      )

      const synthetic: Array<Record<string, unknown>> = []

      if (!hasStorageTx && storageTxHash?.startsWith('0x')) {
        synthetic.push({
          type: 'storage_committed',
          label: 'Full run record — 0G Storage',
          rootHash: meta.rootHash,
          txHash: storageTxHash,
          timestamp: (runRecord.timestamp as number ?? Date.now()) + 1,
        })
      }
      if (!hasChainTx && chainTxHash?.startsWith('0x')) {
        synthetic.push({
          type: 'chain_committed',
          label: 'AgentRegistry.commitRun (on-chain)',
          txHash: chainTxHash,
          timestamp: (runRecord.timestamp as number ?? Date.now()) + 2,
        })
      }

      if (synthetic.length > 0) {
        runRecord.events = [...events, ...synthetic]
      }

      // Backfill top-level tx hashes if missing
      if (!runRecord.storageTxHash && storageTxHash) runRecord.storageTxHash = storageTxHash

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
