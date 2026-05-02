'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import TxHashLink from '@/components/shared/TxHashLink'
import StatusPill from '@/components/shared/StatusPill'

const AGENT_COLORS: Record<string, string> = {
  Orchestrator: '#7C3AED',
  'DeFi Analyst': '#2563EB',
  'Smart Contract Auditor': '#DC2626',
  'Tokenomics Modeler': '#0891B2',
  Critic: '#EA580C',
  Storage: '#0D9488',
  KeeperHub: '#16A34A',
  System: '#6B7280',
}

interface RunEvent {
  type: string
  agentType?: string
  content?: string
  txHash?: string
  rootHash?: string
  label?: string
  round?: number
  timestamp: number
  teeVerified?: boolean
}

interface RunRecord {
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
  finalOutput: string
  events: RunEvent[]
}

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--text-muted)',
    }}>
      {children}
    </span>
  )
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <Label>{label}</Label>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}

// Event type → short human label
function eventLabel(type: string) {
  const map: Record<string, string> = {
    agent_spawned: 'Spawned',
    inference_started: 'Inference',
    inference_settled: 'Settled',
    agent_message: 'Message',
    debate_round: 'Debate',
    storage_committed: 'Stored',
    chain_committed: 'On-chain',
    run_started: 'Started',
    run_complete: 'Complete',
  }
  return map[type] ?? type.replace(/_/g, ' ')
}

// Only show events with meaningful content in the timeline
function isSignificant(evt: RunEvent) {
  return (
    evt.type === 'agent_message' ||
    evt.type === 'debate_round' ||
    evt.type === 'storage_committed' ||
    evt.type === 'chain_committed' ||
    (evt.type === 'inference_settled' && evt.teeVerified === true)
  )
}

export default function RunDetail({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then((data) => { if (data.error) setError(data.error); else setRun(data) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [runId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--text-muted)' }}>
        <div className="loading-spinner" />
        <span>Loading run…</span>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="page-content">
        <div className="page-container" style={{ paddingTop: 40 }}>
          <div style={{ padding: 20, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 13 }}>
            {error ?? 'Run not found.'}
          </div>
        </div>
      </div>
    )
  }

  const timeline = (run.events ?? []).filter(isSignificant)
  const storageTx = run.storageTxHash?.startsWith('0x') ? run.storageTxHash : null
  const downloadHref = run.rootHash
    ? `/api/runs/${runId}/download`
    : null

  return (
    <div className="page-content">
      <div className="page-container" style={{ paddingTop: 28, paddingBottom: 80 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <Link
            href="/runs"
            style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
          >
            <ArrowLeft size={12} /> All Runs
          </Link>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
                {run.prompt.length > 72 ? run.prompt.slice(0, 72) + '…' : run.prompt}
              </h1>
              <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4 }}>
                {runId}
              </code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <StatusPill status={run.status as Parameters<typeof StatusPill>[0]['status'] ?? 'complete'} />
              {downloadHref && (
                <a
                  href={downloadHref}
                  download={`run-${runId.slice(0, 8)}.json`}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={12} />
                  Download
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── Body: metadata + timeline ───────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Left: meta card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '16px 18px' }}>
              <MetaRow label="Status"     value={<StatusPill status={run.status as Parameters<typeof StatusPill>[0]['status'] ?? 'complete'} />} />
              <MetaRow label="Agents"     value={run.agentsSpawned ?? '—'} />
              <MetaRow label="Inferences" value={run.inferenceCalls ?? '—'} />
              <MetaRow label="Duration"   value={run.duration ? `${Math.round(run.duration / 1000)}s` : '—'} />
              <MetaRow label="Size"       value={run.storageBytesCommitted ? `${(run.storageBytesCommitted / 1024).toFixed(1)} KB` : '—'} />
              <MetaRow label="Date"       value={new Date(run.timestamp).toLocaleString()} />

              {/* Artifact row */}
              {run.rootHash && (
                <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <Label>Artifact</Label>
                  <div style={{ marginTop: 6 }}>
                    <code style={{
                      fontSize: 10, fontFamily: 'var(--font-mono)', color: '#2DD4BF',
                      background: 'rgba(13,148,136,0.10)', border: '1px solid rgba(13,148,136,0.2)',
                      padding: '2px 7px', borderRadius: 4, display: 'inline-block',
                    }}>
                      {run.rootHash.slice(0, 10)}…{run.rootHash.slice(-6)}
                    </code>
                  </div>
                </div>
              )}

              {/* Storage tx */}
              {storageTx && (
                <div style={{ paddingTop: 8 }}>
                  <Label>Flow Tx</Label>
                  <div style={{ marginTop: 6 }}>
                    <TxHashLink hash={storageTx} chain="0g" label="View on ChainScan" />
                  </div>
                </div>
              )}
            </div>

            {/* StorageScan link */}
            <a
              href="https://storagescan-galileo.0g.ai/submissions"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: 11, textAlign: 'center', justifyContent: 'center', padding: '8px 0', opacity: 0.65, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              StorageScan <ExternalLink size={10} />
            </a>
          </div>

          {/* Right: event timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Event Timeline
            </div>

            {timeline.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
                No events recorded.
              </div>
            )}

            {timeline.map((evt, i) => {
              const agentType = evt.agentType ?? 'System'
              const color = AGENT_COLORS[agentType] ?? '#6B7280'
              const isStorage = evt.type === 'storage_committed' || evt.type === 'chain_committed'

              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '3px 1fr',
                    gap: '0 14px',
                    position: 'relative',
                  }}
                >
                  {/* Left accent line */}
                  <div style={{
                    background: isStorage ? '#2DD4BF' : color,
                    borderRadius: 2,
                    opacity: 0.6,
                    minHeight: 40,
                    marginBottom: 4,
                  }} />

                  {/* Event body */}
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 4,
                  }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: evt.content ? 8 : 0 }}>
                      {/* Agent avatar */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: '50%',
                        background: `${color}20`, border: `1px solid ${color}50`,
                        fontSize: 9, fontWeight: 800, color, fontFamily: 'var(--font-mono)',
                        flexShrink: 0,
                      }}>
                        {agentType.charAt(0)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{agentType}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {eventLabel(evt.type)}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                      {evt.teeVerified === true && (
                        <span style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4ADE80',
                          background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                          borderRadius: 3, padding: '1px 5px',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          <CheckCircle2 size={8} /> TEE
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    {evt.content && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {evt.content.length > 420 ? evt.content.slice(0, 420) + '…' : evt.content}
                      </p>
                    )}

                    {/* Hashes */}
                    {(evt.rootHash || (evt.txHash?.startsWith('0x'))) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {evt.txHash?.startsWith('0x') && <TxHashLink hash={evt.txHash} chain="0g" />}
                        {evt.rootHash && (
                          <a
                            href={`/api/storage/download?rootHash=${encodeURIComponent(evt.rootHash)}`}
                            download
                            style={{
                              fontSize: 10, fontFamily: 'var(--font-mono)', color: '#2DD4BF',
                              background: 'rgba(13,148,136,0.10)', border: '1px solid rgba(13,148,136,0.2)',
                              padding: '2px 7px', borderRadius: 4, textDecoration: 'none',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                            title={evt.rootHash}
                          >
                            <Download size={9} /> {evt.rootHash.slice(0, 8)}…
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
