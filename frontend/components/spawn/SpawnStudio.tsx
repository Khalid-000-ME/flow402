'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle2, AlertTriangle, ChevronRight, ExternalLink, HardDrive } from 'lucide-react'
import AgentFlowGraph, { FlowNode } from './AgentFlowGraph'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatEvent {
  id: string
  type: string
  data: Record<string, string | number | boolean>
  timestamp: number
}

// ── Persistence key ───────────────────────────────────────────────────────────
const LS_KEY = 'spawn_studio_last_run'

interface SavedRun {
  runId: string
  nodes: FlowNode[]
  feedEvents: ChatEvent[]
}

// ── Uniform neutral palette for left panel ────────────────────────────────────
const TEXT_MUTED   = 'rgba(255,255,255,0.35)'
const TEXT_DIM     = 'rgba(255,255,255,0.55)'
const TEXT_BRIGHT  = 'rgba(255,255,255,0.80)'
const ACCENT       = '#F0B429'
const GREEN        = '#4ADE80'
const TEAL         = '#2DD4BF'

// ── Inference card (left feed) ────────────────────────────────────────────────

function InferenceCard({ evt, expanded, onToggle }: {
  evt: ChatEvent; expanded: boolean; onToggle: () => void
}) {
  const agentType = (evt.data.agentType as string) ?? 'System'
  const content   = (evt.data.content as string) ?? ''
  const time      = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div style={{ borderLeft: '1.5px solid rgba(255,255,255,0.10)', borderRadius: '0 7px 7px 0', overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', textAlign: 'left' }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: TEXT_MUTED, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, color: TEXT_BRIGHT, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agentType}
        </span>
        <span style={{ fontSize: 9, color: TEXT_MUTED, flexShrink: 0 }}>{time}</span>
        <ChevronRight size={10} style={{ color: TEXT_MUTED, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s', flexShrink: 0 }} />
      </button>

      {expanded && (
        <div style={{ padding: '0 10px 9px 22px', fontSize: 11, color: TEXT_DIM, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {content.slice(0, 500)}{content.length > 500 ? '…' : ''}
        </div>
      )}
    </div>
  )
}

// ── Status / hash rows ────────────────────────────────────────────────────────

function FeedRow({ evt }: { evt: ChatEvent }) {
  if (evt.type === 'inference_settled') {
    const agentType = (evt.data.agentType as string) ?? ''
    const txHash    = typeof evt.data.txHash === 'string' && evt.data.txHash.startsWith('0x') ? evt.data.txHash : null
    return (
      <div style={{ padding: '3px 10px 3px 22px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: TEXT_MUTED }}>
          <ExternalLink size={8} style={{ flexShrink: 0 }} />
          <span>{agentType} · settled</span>
          {evt.data.teeVerified === true && (
            <span style={{ fontSize: 8, color: GREEN, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.18)', borderRadius: 3, padding: '0 3px', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <CheckCircle2 size={7} /> TEE
            </span>
          )}
        </div>
        {txHash && (
          <a
            href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontFamily: 'var(--font-mono)', color: ACCENT, opacity: 0.75, textDecoration: 'none' }}
          >
            <ExternalLink size={8} />
            {txHash.slice(0, 14)}…{txHash.slice(-6)}
          </a>
        )}
      </div>
    )
  }

  if (evt.type === 'storage_committed') {
    const rootHash = typeof evt.data.rootHash === 'string' ? evt.data.rootHash : null
    const txHash   = typeof evt.data.txHash === 'string' && (evt.data.txHash as string).startsWith('0x') ? evt.data.txHash as string : null
    const label    = (evt.data.label as string) || 'artifact stored'
    return (
      <div style={{ padding: '3px 10px 4px 22px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: TEXT_MUTED }}>
          <HardDrive size={8} style={{ flexShrink: 0 }} />
          <span>{label}</span>
        </div>
        {rootHash && (
          <a
            href={`/api/storage/download?rootHash=${encodeURIComponent(rootHash)}`}
            download={`artifact-${rootHash.slice(2, 10)}.json`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontFamily: 'var(--font-mono)', color: TEAL, textDecoration: 'none' }}
          >
            <HardDrive size={8} />
            {rootHash.slice(0, 14)}…{rootHash.slice(-6)}
          </a>
        )}
        {txHash && (
          <a
            href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontFamily: 'var(--font-mono)', color: ACCENT, opacity: 0.75, textDecoration: 'none' }}
          >
            <ExternalLink size={8} />
            {txHash.slice(0, 14)}…{txHash.slice(-6)}
          </a>
        )}
      </div>
    )
  }

  if (evt.type === 'run_error') {
    return (
      <div style={{ padding: '4px 10px 4px 22px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#FCA5A5' }}>
        <AlertTriangle size={9} style={{ flexShrink: 0 }} />
        {evt.data.error as string}
      </div>
    )
  }

  return null
}

// ── Feed event filter ─────────────────────────────────────────────────────────
const FEED_TYPES = new Set(['agent_message', 'debate_round', 'inference_settled', 'storage_committed', 'run_error'])

// ── Main Studio ───────────────────────────────────────────────────────────────

export default function SpawnStudio() {
  const [prompt, setPrompt]             = useState('')
  const [events, setEvents]             = useState<ChatEvent[]>([])
  const [nodes, setNodes]               = useState<FlowNode[]>([])
  const [running, setRunning]           = useState(false)
  const [runId, setRunId]               = useState<string | null>(null)
  const [complete, setComplete]         = useState(false)
  const [expandedFeedId, setExpandedFeedId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const feedRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const searchParams = useSearchParams()

  // ── On mount: only restore if ?runId= is set (navigated from audit trail) ─
  useEffect(() => {
    const queryRunId = searchParams?.get('runId')

    if (queryRunId) {
      fetch(`/api/runs/${queryRunId}`)
        .then(r => r.json())
        .then((data: { runId: string; events: Array<{ type: string; agentType?: string; content?: string; timestamp: number }> }) => {
          if (!data.runId) return

          const nodeMap = new Map<string, FlowNode>()
          nodeMap.set('Orchestrator', { id: 'Orchestrator', agentType: 'Orchestrator', status: 'complete' })

          for (const evt of (data.events ?? [])) {
            if (evt.type === 'agent_spawned' && evt.agentType && evt.agentType !== 'Storage') {
              if (!nodeMap.has(evt.agentType))
                nodeMap.set(evt.agentType, { id: evt.agentType, agentType: evt.agentType, status: 'complete' })
            }
            if (evt.type === 'agent_message' && evt.agentType) {
              const existing = nodeMap.get(evt.agentType)
              if (existing)
                nodeMap.set(evt.agentType, { ...existing, status: 'complete', lastMessage: evt.content ?? existing.lastMessage })
            }
          }

          const feedEvts: ChatEvent[] = (data.events ?? [])
            .filter(e => FEED_TYPES.has(e.type))
            .map(e => ({ id: crypto.randomUUID(), type: e.type, data: e as unknown as Record<string, string | number | boolean>, timestamp: e.timestamp }))

          setRunId(data.runId)
          setNodes([...nodeMap.values()])
          setEvents(feedEvts)
          setComplete(true)
        })
        .catch(() => { /* silently ignore — open fresh */ })
    }

    inputRef.current?.focus()
  }, [searchParams])

  // ── Auto-scroll feed ──────────────────────────────────────────────────────
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [events])

  const submit = useCallback(async () => {
    if (!prompt.trim() || running) return
    const userPrompt = prompt.trim()
    setPrompt('')
    setRunning(true)
    setEvents([])
    setNodes([])
    setComplete(false)
    setRunId(null)
    setExpandedFeedId(null)
    setSelectedNodeId(null)

    const eventsAcc: ChatEvent[] = []
    let   nodesAcc:  FlowNode[]  = []
    let   runIdAcc   = ''

    function updateNodes(fn: (prev: FlowNode[]) => FlowNode[]) {
      nodesAcc = fn(nodesAcc)
      setNodes([...nodesAcc])
    }

    try {
      const res = await fetch('/api/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt }),
      })
      if (!res.body) throw new Error('No response body')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', ev = '', dat = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event:'))     ev  = line.slice(6).trim()
          else if (line.startsWith('data:')) dat = line.slice(5).trim()
          else if (line === '' && ev && dat) {
            try {
              const p = JSON.parse(dat) as Record<string, unknown>
              const evt: ChatEvent = {
                id: crypto.randomUUID(), type: ev,
                data: p as Record<string, string | number | boolean>,
                timestamp: Date.now(),
              }

              // Track in accumulator for persistence
              if (FEED_TYPES.has(ev)) {
                eventsAcc.push(evt)
                setEvents([...eventsAcc])
              }

              // ── Node state machine ────────────────────────────────────
              if (ev === 'run_started') {
                runIdAcc = p.runId as string
                setRunId(runIdAcc)
                updateNodes(() => [{ id: 'Orchestrator', agentType: 'Orchestrator', status: 'running' }])
              }

              if (ev === 'agent_spawned') {
                const t = p.agentType as string
                if (t !== 'Storage') {
                  updateNodes(prev => [...prev.filter(n => n.id !== t), { id: t, agentType: t, status: 'spawning' }])
                }
              }

              if (ev === 'inference_started') {
                const t = p.agentType as string
                updateNodes(prev => prev.map(n => n.id === t ? { ...n, status: 'running' } : n))
              }

              if (ev === 'agent_message') {
                const t   = p.agentType as string
                const msg = p.content   as string
                updateNodes(prev => prev.map(n => {
                  if (n.id === t) return { ...n, status: 'running', lastMessage: msg ?? n.lastMessage }
                  if (n.id === 'Orchestrator' && t !== 'Orchestrator') return { ...n, status: 'complete' }
                  return n
                }))
              }

              if (ev === 'inference_settled') {
                const t = p.agentType as string
                updateNodes(prev => prev.map(n => n.id === t ? { ...n, status: 'complete' } : n))
              }

              if (ev === 'debate_round') {
                const summary = (p.summary ?? p.content) as string
                updateNodes(prev => prev.map(n => n.id === 'Critic' ? { ...n, status: 'debating', lastMessage: summary ?? n.lastMessage } : n))
              }

              if (ev === 'storage_committed' || ev === 'chain_committed') {
                // No Storage node — just mark all done
                updateNodes(prev => prev.map(n => ({ ...n, status: 'complete' })))
              }

              if (ev === 'run_complete') {
                updateNodes(prev => prev.map(n => ({ ...n, status: 'complete' })))
                setComplete(true)
              }
            } catch { /* skip malformed */ }
            ev = ''; dat = ''
          }
        }
      }
    } catch (err) {
      const errEvt: ChatEvent = { id: crypto.randomUUID(), type: 'run_error', data: { error: String(err) }, timestamp: Date.now() }
      eventsAcc.push(errEvt)
      setEvents([...eventsAcc])
    } finally {
      setRunning(false)
    }
  }, [prompt, running])

  const feedEvents = events.filter(e => FEED_TYPES.has(e.type))

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', paddingTop: 64 }}>

      {/* Top bar */}
      <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 20, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Spawn Studio</span>
        {runId && (
          <code style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 4 }}>
            {runId.slice(0, 20)}…
          </code>
        )}
        {running && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: ACCENT }}>
            <div className="loading-spinner" style={{ width: 10, height: 10 }} /> Running
          </span>
        )}
        {complete && !running && (
          <span style={{ fontSize: 9.5, color: GREEN, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={10} /> Complete
          </span>
        )}
        {complete && runId && (
          <Link href={`/runs/${runId}`} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: GREEN, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.16)', borderRadius: 6, padding: '3px 10px', textDecoration: 'none' }}>
            View audit trail
          </Link>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left feed */}
        <div style={{ width: 264, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Feed</span>
            {feedEvents.length > 0 && (
              <span style={{ fontSize: 8.5, padding: '0 5px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
                {feedEvents.length}
              </span>
            )}
          </div>

          <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {feedEvents.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>
                Agent activity appears here
              </div>
            ) : feedEvents.map((evt) => (
              <div key={evt.id} style={{ paddingLeft: 6, paddingRight: 6 }}>
                {(evt.type === 'agent_message' || evt.type === 'debate_round') ? (
                  <InferenceCard
                    evt={evt}
                    expanded={expandedFeedId === evt.id}
                    onToggle={() => setExpandedFeedId(p => p === evt.id ? null : evt.id)}
                  />
                ) : (
                  <FeedRow evt={evt} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Center graph + detail overlay */}
        <div
          style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        >
          {nodes.length === 0 ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'rgba(255,255,255,0.15)', fontSize: 11.5, userSelect: 'none' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.5 }}>
                <rect x="1" y="10" width="16" height="20" rx="4" stroke="currentColor" strokeWidth="1"/>
                <rect x="23" y="1" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1"/>
                <rect x="23" y="23" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1"/>
                <path d="M17 20h6" stroke="currentColor" strokeWidth="1"/>
                <path d="M17 20 C 17 9, 31 9, 31 9" stroke="currentColor" strokeWidth="1" fill="none"/>
                <path d="M17 20 C 17 31, 31 31, 31 31" stroke="currentColor" strokeWidth="1" fill="none"/>
              </svg>
              <span>Type a task below to spawn agents</span>
            </div>
          ) : (
            <AgentFlowGraph
              nodes={nodes}
              running={running}
              selectedId={selectedNodeId}
              onNodeClick={(id) => setSelectedNodeId(p => p === id ? null : id)}
            />
          )}

          {/* Node detail panel — HTML overlay, appears on node click */}
          {(() => {
            const sel = nodes.find(n => n.id === selectedNodeId)
            if (!sel) return null
            // Find all agent messages for this agent from the events feed
            const agentEvts = events.filter(e =>
              (e.type === 'agent_message' || e.type === 'debate_round') &&
              (e.data.agentType as string) === sel.agentType
            )
            const statusColor = sel.status === 'complete' ? GREEN
              : sel.status === 'running' || sel.status === 'debating' ? ACCENT
              : 'rgba(255,255,255,0.3)'
            return (
              <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0,
                width: 300,
                background: 'rgba(8,8,16,0.97)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column',
                backdropFilter: 'blur(12px)',
                zIndex: 10,
              }}>
                {/* Panel header */}
                <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginBottom: 4 }}>
                      {sel.agentType}
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 600, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}30`, borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {sel.status}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
                  >×</button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {agentEvts.length === 0 ? (
                    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 40 }}>No output yet</p>
                  ) : agentEvts.map((e, i) => {
                    const content = (e.data.content as string) ?? ''
                    const time    = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    const isDebate = e.type === 'debate_round'
                    return (
                      <div key={e.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>{time}</span>
                          {isDebate && (
                            <span style={{ fontSize: 8.5, color: ACCENT, background: 'rgba(240,180,41,0.10)', border: '1px solid rgba(240,180,41,0.2)', borderRadius: 3, padding: '0 4px' }}>debate</span>
                          )}
                          {i === agentEvts.length - 1 && <span style={{ fontSize: 8.5, color: GREEN, marginLeft: 'auto' }}>latest</span>}
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.72, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                          {content}
                        </p>
                        {i < agentEvts.length - 1 && (
                          <div style={{ marginTop: 12, height: 1, background: 'rgba(255,255,255,0.05)' }}/>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>

      {/* Body end */}
      </div>

      {/* Bottom input */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '12px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ width: '100%', maxWidth: 660, display: 'flex', gap: 9, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            id="spawn-prompt"
            className="input"
            placeholder="Describe a task — e.g. Analyse the tokenomics of ETH and identify the top 3 risks…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            disabled={running}
            rows={1}
            style={{ flex: 1, resize: 'none', minHeight: 40, maxHeight: 112, fontSize: 13, lineHeight: 1.6, overflow: 'auto' }}
          />
          <button
            id="spawn-submit"
            className="btn btn-primary"
            onClick={submit}
            disabled={running || !prompt.trim()}
            style={{ alignSelf: 'flex-end', padding: '10px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {running
              ? <div className="loading-spinner" style={{ width: 14, height: 14 }} />
              : <><span style={{ fontSize: 13 }}>Spawn</span><ArrowRight size={13} /></>
            }
          </button>
        </div>
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.2)' }}>Enter to spawn · Shift+Enter for newline</span>
      </div>
    </div>
  )
}
