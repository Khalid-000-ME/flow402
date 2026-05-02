'use client'

import { useEffect, useState } from 'react'
import AgentCard from './AgentCard'

interface Agent {
  tokenId: string
  agentType: string
  ensName: string
  systemPromptRootHash: string
  spawnCount: number
  owner: string
  registryAddress: string
  explorerUrl: string
}

export default function AgentsGrid() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAgents(data)
        else setError('No agent data returned from contract.')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', padding: '40px 0' }}>
        <div className="loading-spinner" />
        <span>Loading agents from AgentRegistry contract…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: 24,
        borderRadius: 12,
        background: 'rgba(239,68,68,0.06)',
        border: '1px solid rgba(239,68,68,0.2)',
        color: '#FCA5A5',
        fontSize: 14,
      }}>
        <strong>Contract read error:</strong> {error}
        <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12 }}>
          Set <span className="mono">NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS</span> and ensure contract is deployed.
        </div>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center', fontSize: 14 }}>
        No agents registered yet. Run <span className="mono">scripts/registerAgents.ts</span> to seed the registry.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: 20,
    }}>
      {agents.map((agent) => (
        <AgentCard key={agent.tokenId} agent={agent} />
      ))}
    </div>
  )
}
