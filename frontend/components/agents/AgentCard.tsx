'use client'

import { useState } from 'react'
import { Hexagon, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react'
import RootHashBadge from '@/components/shared/RootHashBadge'
import StatusPill from '@/components/shared/StatusPill'
import Link from 'next/link'

const AGENT_COLORS: Record<string, string> = {
  'DeFi Analyst': '#2563EB',
  'Smart Contract Auditor': '#DC2626',
  'Tokenomics Modeler': '#0891B2',
  Critic: '#EA580C',
  Orchestrator: '#7C3AED',
}

interface Agent {
  tokenId: string
  agentType: string
  ensName: string
  systemPromptRootHash: string
  spawnCount: number
  /** Wallet that registered this agent — unique per agent */
  owner: string
  /** Shared AgentRegistry contract address */
  registryAddress: string
  explorerUrl: string
}

export default function AgentCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false)
  const color = AGENT_COLORS[agent.agentType] || '#888'

  function truncateAddress(addr: string) {
    if (!addr || addr.length < 10) return addr
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  return (
    <div
      className="card"
      style={{
        borderLeft: `3px solid ${color}`,
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
            }} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>{agent.agentType}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Hexagon size={10} strokeWidth={1.5} style={{ opacity: 0.6 }} />
            {agent.ensName}
          </div>
        </div>
        <StatusPill status="idle" />
      </div>

      {/* Token ID */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <a
          href={agent.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="badge badge-purple"
          title={`Token #${agent.tokenId}`}
        >
          <span>iNFT</span>
          <span className="mono">#{agent.tokenId}</span>
        </a>
        <span className="badge badge-yellow">
          <span className="mono">{agent.spawnCount}</span> spawns
        </span>
      </div>

      {/* Expand toggle */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {expanded
          ? <><ChevronUp size={13} /> Collapse</>
          : <><ChevronDown size={13} /> Details</>}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 16,
            borderTop: '1px solid var(--border)',
            paddingTop: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Intelligence Blob
            </div>
            {agent.systemPromptRootHash ? (
              <RootHashBadge rootHash={agent.systemPromptRootHash} />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not uploaded to 0G Storage yet</span>
            )}
          </div>

          {agent.owner && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Owner Wallet
              </div>
              <a
                href={`https://chainscan-galileo.0g.ai/address/${agent.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                style={{ fontSize: 12, color: 'var(--yellow)', borderBottom: '1px dashed var(--yellow-border)' }}
              >
                {truncateAddress(agent.owner)}
              </a>
            </div>
          )}

          {agent.registryAddress && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Registry Contract
              </div>
              <a
                href={`https://chainscan-galileo.0g.ai/address/${agent.registryAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                style={{ fontSize: 12, color: 'var(--text-muted)' }}
              >
                {truncateAddress(agent.registryAddress)}
              </a>
            </div>
          )}

          <Link
            href={`/runs?agent=${encodeURIComponent(agent.agentType)}`}
            style={{ fontSize: 13, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View runs with this agent <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}
