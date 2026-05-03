'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  CheckCircle2,
  Play,
} from 'lucide-react'
import TxHashLink from '@/components/shared/TxHashLink'
import StatusPill from '@/components/shared/StatusPill'
import AgentResponseCard from '@/components/shared/AgentResponseCard'

const NEUTRAL_COLOR  = 'rgba(255,255,255,0.55)'
const NEUTRAL_BG     = 'rgba(255,255,255,0.06)'
const NEUTRAL_BORDER = 'rgba(255,255,255,0.14)'

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

              {/* Open run in Spawn Studio */}
              <Link
                href={`/spawn?runId=${runId}`}
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Play size={11} /> Open in Studio
              </Link>

              {/* Download run record */}
              {downloadHref && (
                <a
                  href={downloadHref}
                  download={`run-${runId.slice(0, 8)}.json`}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={12} /> Download
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
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <a
                      href={`/api/runs/${runId}/download`}
                      download={`run-${runId.slice(0, 8)}.json`}
                      style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', color: '#2DD4BF',
                        background: 'rgba(13,148,136,0.10)', border: '1px solid rgba(13,148,136,0.2)',
                        padding: '3px 8px', borderRadius: 4, textDecoration: 'none',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Download size={9} />
                      {run.rootHash.slice(0, 10)}…{run.rootHash.slice(-6)}
                    </a>
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
              const isStorage = evt.type === 'storage_committed' || evt.type === 'chain_committed'

              // Agent message / debate: use rich card
              if ((evt.type === 'agent_message' || evt.type === 'debate_round') && evt.content) {
                return (
                  <AgentResponseCard
                    key={i}
                    agentType={agentType}
                    agentColor={NEUTRAL_COLOR}
                    content={evt.content}
                    eventLabel={eventLabel(evt.type)}
                    timestamp={evt.timestamp}
                    teeVerified={evt.teeVerified}
                    txHash={evt.txHash}
                    rootHash={evt.rootHash}
                    runId={runId}
                  />
                )
              }


              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '3px 1fr', gap: '0 14px' }}>
                  <div style={{ background: isStorage ? 'rgba(45,212,191,0.5)' : NEUTRAL_BORDER, borderRadius: 2, minHeight: 36, marginBottom: 4 }} />
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL_COLOR }}>{agentType}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{eventLabel(evt.type)}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {(evt.rootHash || evt.txHash?.startsWith('0x')) && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                        {evt.txHash?.startsWith('0x') && <TxHashLink hash={evt.txHash} chain="0g" />}
                        {evt.rootHash && (
                          <a
                            href={`/api/runs/${runId}/download`}
                            download
                            style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#2DD4BF', background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.18)', borderRadius: 6, padding: '2px 8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title={evt.rootHash}
                          >
                            Root: {evt.rootHash.slice(0,10)}…{evt.rootHash.slice(-6)}
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
