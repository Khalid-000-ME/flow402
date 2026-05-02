'use client'

import { useEffect, useState } from 'react'
import { Inbox, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import RootHashBadge from '@/components/shared/RootHashBadge'
import StatusPill from '@/components/shared/StatusPill'

interface RunRecord {
  runId: string
  prompt: string
  status: string
  agentsSpawned: number
  inferenceCalls: number
  rootHash: string
  storageTxHash?: string
  duration: number
  timestamp: number
}

export default function RunsTable() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/runs')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRuns(data)
        else setError('Could not retrieve runs from 0G Storage.')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', padding: '40px 0' }}>
        <div className="loading-spinner" />
        <span>Fetching run history from 0G Storage…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 14 }}>
        {error}
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <Inbox size={32} strokeWidth={1.25} />
        No runs yet. Start one in the{' '}
        <Link href="/chat" style={{ color: 'var(--yellow)' }}>chat interface</Link>.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Run ID', 'Prompt', 'Status', 'Agents', 'Inferences', 'Artifact', 'Duration', 'Date', ''].map((col) => (
              <th
                key={col}
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.runId}
              style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '14px 16px' }}>
                <Link href={`/runs/${run.runId}`} className="mono" style={{ fontSize: 12, color: 'var(--yellow)' }}>
                  {run.runId.slice(0, 12)}…
                </Link>
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 12, maxWidth: 200 }}>
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {run.prompt || '—'}
                </span>
              </td>
              <td style={{ padding: '14px 16px' }}>
                <StatusPill status={(run.status as Parameters<typeof StatusPill>[0]['status']) || 'complete'} />
              </td>
              <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {run.agentsSpawned}
              </td>
              <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {run.inferenceCalls}
              </td>
              <td style={{ padding: '14px 16px' }}>
                {run.rootHash
                  ? <RootHashBadge rootHash={run.rootHash} />
                  : <span style={{ color: 'var(--text-muted)' }}>—</span>
                }
              </td>
              <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: 12 }}>
                {run.duration ? `${Math.round(run.duration / 1000)}s` : '—'}
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date(run.timestamp).toLocaleDateString()}
              </td>
              <td style={{ padding: '14px 16px' }}>
                <Link href={`/runs/${run.runId}`} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
