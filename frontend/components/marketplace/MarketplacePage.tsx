'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWallet } from '@/lib/wallet/WalletContext'
import AgentRegistrationFlow from './AgentRegistrationFlow'
import { Plus, Users, Hexagon, Zap, Archive, ExternalLink, ChevronRight, Pencil } from 'lucide-react'

interface Agent {
  tokenId: string
  agentType: string
  ensName: string
  owner: string
  registryAddress: string
  spawnCount: number
  systemPromptRootHash: string
  explorerUrl: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—'
}

function shortHash(hash: string) {
  return hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : '—'
}

// ── Row ───────────────────────────────────────────────────────────────────────

function AgentRow({ agent, isOwner }: { agent: Agent; isOwner: boolean }) {
  const router = useRouter()
  return (
    <tr
      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.12s' }}
      onClick={() => router.push(`/marketplace/agents/${agent.tokenId}`)}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >

        {/* Agent type + ENS */}
        <td style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
            {agent.agentType}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {agent.ensName || '—'}
          </div>
        </td>

        {/* Owner */}
        <td style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isOwner && (
              <span style={{
                fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: 'var(--yellow)', background: 'rgba(240,180,41,0.08)',
                border: '1px solid rgba(240,180,41,0.2)', borderRadius: 3, padding: '1px 5px', flexShrink: 0,
              }}>
                You
              </span>
            )}
            <a
              href={agent.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
            >
              {shortAddr(agent.owner)}
              <ExternalLink size={9} style={{ opacity: 0.5 }} />
            </a>
          </div>
        </td>

        {/* Spawns */}
        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
          {agent.spawnCount ?? 0}
        </td>

        {/* System prompt root hash */}
        <td style={{ padding: '14px 16px' }}>
          {agent.systemPromptRootHash ? (
            <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#2DD4BF', background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.18)', borderRadius: 4, padding: '2px 7px' }}>
              {shortHash(agent.systemPromptRootHash)}
            </code>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
          )}
        </td>

        {/* Actions */}
        <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isOwner && (
              <Link
                href="/marketplace/my-agents"
                className="btn btn-ghost btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 9px' }}
              >
                <Pencil size={11} /> Edit
              </Link>
            )}
            <Link
              href={`/marketplace/agents/${agent.tokenId}`}
              className="btn btn-ghost btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 9px' }}
            >
              View <ChevronRight size={11} />
            </Link>
          </div>
        </td>
      </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { address, connect } = useWallet()
  const [agents, setAgents]       = useState<Agent[]>([])
  const [loading, setLoading]     = useState(true)
  const [showRegister, setShowRegister] = useState(false)

  const searchParams = useSearchParams()

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAgents(data) })
      .finally(() => setLoading(false))
  }, [])

  // Auto-open registration flow when ?register=1 is in the URL
  useEffect(() => {
    if (searchParams?.get('register') === '1') setShowRegister(true)
  }, [searchParams])

  if (showRegister) {
    return <AgentRegistrationFlow onClose={() => setShowRegister(false)} onSuccess={() => { setShowRegister(false); window.location.reload() }} />
  }

  const totalSpawns = agents.reduce((s, a) => s + (a.spawnCount ?? 0), 0)
  const withStorage = agents.filter(a => a.systemPromptRootHash).length

  return (
    <div className="page-content">
      <div className="page-container" style={{ paddingTop: 32, paddingBottom: 80 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="section-label">Agent Marketplace</div>
            <h1 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
              Registered Agents
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 480 }}>
              All agents registered on the Orcha-net AgentRegistry contract.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {address ? (
              <>
                <Link href="/marketplace/my-agents" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <Users size={14} /> My Agents
                </Link>
                <button className="btn btn-primary" onClick={() => setShowRegister(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <Plus size={14} /> Register Agent
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={connect} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                Connect Wallet to Register
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { icon: <Hexagon size={15} />, label: 'Total Agents',    value: loading ? '—' : agents.length },
            { icon: <Zap size={15} />,     label: 'Total Spawns',    value: loading ? '—' : totalSpawns },
            { icon: <Archive size={15} />, label: 'On 0G Storage',   value: loading ? '—' : withStorage },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--text-muted)' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* List table */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', padding: '60px 0' }}>
            <div className="loading-spinner" /> Loading agents from chain…
          </div>
        ) : agents.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '80px 0' }}>
            <Hexagon size={36} strokeWidth={1} style={{ marginBottom: 14, opacity: 0.35 }} />
            <p>No agents registered yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Agent', 'Owner', 'Spawns', 'Prompt Hash', ''].map(col => (
                    <th key={col} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.07em', color: 'var(--text-muted)', whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map(agent => (
                  <AgentRow
                    key={agent.tokenId}
                    agent={agent}
                    isOwner={!!address && address.toLowerCase() === agent.owner?.toLowerCase()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
