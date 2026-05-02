'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Link2,
  HardDrive,
  Swords,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Hexagon,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import TxHashLink from '@/components/shared/TxHashLink'
import StatusPill from '@/components/shared/StatusPill'
import RunFlowGraph from '@/components/runs/RunFlowGraph'

type AgentColor = Record<string, string>
const AGENT_COLORS: AgentColor = {
  Orchestrator: '#7C3AED',
  'DeFi Analyst': '#2563EB',
  'Smart Contract Auditor': '#DC2626',
  'Tokenomics Modeler': '#0891B2',
  Critic: '#EA580C',
  Storage: '#0D9488',
}

interface ChatEvent {
  id: string
  type: string
  data: Record<string, string | number | boolean>
  timestamp: number
}

interface GraphNode {
  id: string
  agentType: string
  status: 'spawning' | 'running' | 'complete' | 'debating'
}

export default function ChatInterface() {
  const [prompt, setPrompt] = useState('')
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [finalOutput, setFinalOutput] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [events])

  async function submit() {
    if (!prompt.trim() || running) return
    setRunning(true)
    setEvents([])
    setNodes([])
    setFinalOutput(null)

    const userPrompt = prompt
    setPrompt('')

    try {
      const res = await fetch('/api/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim()
          } else if (line === '' && currentEvent && currentData) {
            try {
              const parsed = JSON.parse(currentData)
              const evt: ChatEvent = {
                id: crypto.randomUUID(),
                type: currentEvent,
                data: parsed,
                timestamp: Date.now(),
              }

              setEvents((prev) => [...prev, evt])

              if (currentEvent === 'run_started') {
                setRunId(parsed.runId as string)
              }

              if (currentEvent === 'agent_spawned') {
                const agentType = parsed.agentType as string
                setNodes((prev) => [
                  ...prev.filter((n) => n.id !== agentType),
                  { id: agentType, agentType, status: 'spawning' },
                ])
              }

              if (currentEvent === 'agent_message') {
                const agentType = parsed.agentType as string
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === agentType ? { ...n, status: 'running' } : n
                  )
                )
              }

              if (currentEvent === 'debate_round') {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === 'Critic' ? { ...n, status: 'debating' } : n
                  )
                )
              }

              if (currentEvent === 'run_complete') {
                setFinalOutput(parsed.finalOutput as string)
                setNodes((prev) => prev.map((n) => ({ ...n, status: 'complete' })))
              }
            } catch {}
            currentEvent = ''
            currentData = ''
          }
        }
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'run_error',
          data: { error: String(err) },
          timestamp: Date.now(),
        },
      ])
    } finally {
      setRunning(false)
    }
  }

  function renderEvent(evt: ChatEvent) {
    const agentType = (evt.data.agentType as string) || 'System'
    const color = AGENT_COLORS[agentType] || 'var(--text-secondary)'

    switch (evt.type) {
      case 'run_started':
        return (
          <div key={evt.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="pill pill-running" style={{ fontSize: 11 }}>
              <span className="pill-dot" />
              Run started · {evt.data.runId as string}
            </span>
          </div>
        )

      case 'agent_spawned':
        return (
          <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, animation: 'pulse-yellow 1.5s infinite' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Spawned <span style={{ color, fontWeight: 600 }}>{agentType}</span>
              {evt.data.ensName ? (
                <span className="mono" style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>
                  {evt.data.ensName as string}
                </span>
              ) : null}
            </span>
          </div>
        )

      case 'agent_message':
        return (
          <div
            key={evt.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${color}`,
              borderRadius: '0 10px 10px 0',
              padding: '16px',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: `${color}20`,
                border: `1px solid ${color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
              }}>
                {agentType.charAt(0)}
              </div>
              <span style={{ fontWeight: 600, fontSize: 13, color }}>{agentType}</span>
              <span className="badge badge-yellow" style={{ marginLeft: 'auto', fontSize: 10 }}>0G Compute · TEE</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {(evt.data.content as string)?.slice(0, 400)}
              {(evt.data.content as string)?.length > 400 ? '…' : ''}
            </div>
          </div>
        )

      case 'inference_settled':
        return (
          <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text-muted)' }}>
            <Link2 size={12} style={{ color, flexShrink: 0 }} />
            <span>{agentType} inference settled</span>
            {evt.data.teeVerified === true && (
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: '#4ADE80',
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.2)',
                borderRadius: 4, padding: '1px 6px',
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <CheckCircle2 size={9} /> TEE
              </span>
            )}
          </div>
        )

      case 'storage_committed':
        return (
          <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <HardDrive size={12} style={{ flexShrink: 0 }} />
            <span>{evt.data.label as string}</span>
            {evt.data.rootHash ? (
              <span className="badge badge-teal mono" style={{ fontSize: 10 }}>
                {(evt.data.rootHash as string).slice(0, 12)}…
              </span>
            ) : null}
            {evt.data.txHash && typeof evt.data.txHash === 'string' && evt.data.txHash.startsWith('0x') ? (
              <TxHashLink hash={evt.data.txHash as string} chain="0g" label="Flow tx" />
            ) : null}
          </div>
        )

      case 'debate_round':
        return (
          <div
            key={evt.id}
            style={{
              background: 'rgba(234,88,12,0.06)',
              border: '1px solid rgba(234,88,12,0.2)',
              borderRadius: 10,
              padding: '14px',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Swords size={13} color="#EA580C" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#EA580C' }}>Critic · Round {evt.data.round}</span>
              <span className="pill pill-debating" style={{ fontSize: 10 }}>Debating</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {(evt.data.content as string)?.slice(0, 300)}
              {(evt.data.content as string)?.length > 300 ? '…' : ''}
            </div>
          </div>
        )

      case 'run_complete':
        return (
          <div key={evt.id} style={{
            background: 'rgba(22,163,74,0.06)',
            border: '1px solid rgba(22,163,74,0.2)',
            borderRadius: 12,
            padding: '20px',
          }}>
            <div style={{ fontWeight: 700, color: '#4ADE80', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={15} color="#4ADE80" />
              Run complete
              {runId && (
                <a href={`/runs/${runId}`} style={{ fontSize: 12, color: 'var(--yellow)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View audit trail <ExternalLink size={11} />
                </a>
              )}
            </div>
            {evt.data.rootHash ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Artifact stored:</span>
                <span className="badge badge-teal mono" style={{ fontSize: 10 }}>
                  {(evt.data.rootHash as string).slice(0, 16)}…
                </span>
              </div>
            ) : null}
          </div>
        )

      case 'run_error':
        return (
          <div key={evt.id} style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10,
            padding: '14px',
            color: '#FCA5A5',
            fontSize: 13,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {evt.data.error as string}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: 64 }}>
      {/* Split pane */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
        {/* Left: thread */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Agent Thread</span>
            {running && <div className="loading-spinner" style={{ width: 16, height: 16 }} />}
            {runId && !running && (
              <a href={`/runs/${runId}`} className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: 12 }}>
                Full audit →
              </a>
            )}
          </div>

          <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {events.length === 0 && !running && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40, fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Globe size={28} strokeWidth={1.25} />
                Type a task below to spawn agents
              </div>
            )}
            {events.map(renderEvent)}
          </div>

          {/* Input */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <textarea
                id="chat-prompt"
                className="input"
                style={{ minHeight: 60, resize: 'none', flex: 1 }}
                placeholder="e.g. Analyze the tokenomics of a ve-token DeFi protocol and identify the top 3 risks…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
                disabled={running}
              />
              <button
                id="chat-submit-btn"
                className="btn btn-primary"
                onClick={submit}
                disabled={running || !prompt.trim()}
                style={{ alignSelf: 'flex-end', padding: '12px 20px' }}
              >
                {running
                  ? <div className="loading-spinner" style={{ width: 16, height: 16 }} />
                  : <ArrowRight size={16} />}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Enter to submit · Shift+Enter for newline
            </div>
          </div>
        </div>

        {/* Right: flow graph */}
        <div style={{ flex: 1, position: 'relative', background: 'var(--bg-secondary)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Live Agent Graph</span>
          </div>
          <RunFlowGraph nodes={nodes} />
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, top: 57,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12, color: 'var(--text-muted)', fontSize: 14,
            }}>
              <Hexagon size={36} strokeWidth={1} />
              <span>Agent nodes appear here as they spawn</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
