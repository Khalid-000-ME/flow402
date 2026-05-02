import type { Metadata } from 'next'
import RunsTable from '@/components/runs/RunsTable'

export const metadata: Metadata = {
  title: 'Run History — Orcha-net',
  description: 'Full history of all agent network runs with on-chain proof links.',
}

export default function RunsPage() {
  return (
    <div className="page-content">
      <div className="page-container" style={{ paddingBottom: 80 }}>
        <div style={{ paddingTop: 32, marginBottom: 40 }}>
          <div className="section-label">Run History</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
            All Network Runs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
            Every run is permanently stored on 0G Storage and committed to chain.
          </p>
        </div>
        <RunsTable />
      </div>
    </div>
  )
}
