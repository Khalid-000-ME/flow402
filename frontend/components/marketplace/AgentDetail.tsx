'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWallet } from '@/lib/wallet/WalletContext'
import {
  ArrowLeft, ExternalLink, Download, Pencil, Zap,
  User, CircuitBoard, FileCode,
} from 'lucide-react'

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

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{value}</div>
      </div>
    </div>
  )
}

export default function AgentDetail({ tokenId }: { tokenId: string }) {
  const { address } = useWallet()
  const [agent, setAgent]   = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then((data: Agent[]) => {
        if (!Array.isArray(data)) { setError('Could not load agents.'); return }
        const found = data.find(a => a.tokenId === tokenId)
        if (!found) setError(`Agent #${tokenId} not found.`)
        else setAgent(found)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tokenId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--text-muted)' }}>
        <div className="loading-spinner" /> Loading agent…
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="page-content">
        <div className="page-container" style={{ paddingTop: 40 }}>
          <div style={{ padding: 20, borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 13 }}>
            {error ?? 'Agent not found.'}
          </div>
        </div>
      </div>
    )
  }

  const isOwner = !!address && address.toLowerCase() === agent.owner?.toLowerCase()

  return (
    <div className="page-content">
      <div className="page-container" style={{ paddingTop: 28, paddingBottom: 80 }}>

        {/* Back */}
        <Link href="/marketplace" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
          <ArrowLeft size={12} /> Marketplace
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <h1 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
                  {agent.agentType}
                </h1>
                {isOwner && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--yellow)', background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.2)', borderRadius: 4, padding: '2px 6px' }}>
                    Your Agent
                  </span>
                )}
              </div>
              <code style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {agent.ensName || 'No ENS name'}
              </code>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {agent.systemPromptRootHash && (
              <a
                href={`/api/storage/download?rootHash=${encodeURIComponent(agent.systemPromptRootHash)}`}
                download={`agent-${agent.tokenId}-prompt.json`}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <Download size={13} /> System Prompt
              </a>
            )}
            {isOwner && (
              <Link href="/marketplace/my-agents" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Pencil size={13} /> Edit Agent
              </Link>
            )}
            <a
              href={agent.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              ChainScan <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* Left: details card */}
          <div className="card" style={{ padding: '4px 20px 16px' }}>

            <MetaRow
              icon={<CircuitBoard size={14} />}
              label="Agent Type"
              value={agent.agentType}
            />

            <MetaRow
              icon={<FileCode size={14} />}
              label="ENS Name"
              value={<span style={{ fontFamily: 'var(--font-mono)' }}>{agent.ensName || '—'}</span>}
            />

            <MetaRow
              icon={<User size={14} />}
              label="Owner"
              value={
                <a
                  href={agent.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--yellow)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                >
                  {agent.owner || '—'}
                  <ExternalLink size={10} style={{ opacity: 0.6 }} />
                </a>
              }
            />

            <MetaRow
              icon={<Zap size={14} />}
              label="Total Spawns"
              value={
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {agent.spawnCount ?? 0}
                </span>
              }
            />

            <MetaRow
              icon={<FileCode size={14} />}
              label="System Prompt Root Hash"
              value={
                agent.systemPromptRootHash ? (
                  <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#2DD4BF', background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.18)', borderRadius: 4, padding: '2px 8px', wordBreak: 'break-all' }}>
                    {agent.systemPromptRootHash}
                  </code>
                ) : '—'
              }
            />

            <MetaRow
              icon={<CircuitBoard size={14} />}
              label="Registry Contract"
              value={
                <a
                  href={`https://chainscan-galileo.0g.ai/address/${agent.registryAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}
                >
                  {agent.registryAddress || '—'}
                  <ExternalLink size={9} style={{ opacity: 0.5 }} />
                </a>
              }
            />
          </div>

          {/* Right: stats + actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Spawn count card */}
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--yellow)', lineHeight: 1 }}>
                {agent.spawnCount ?? 0}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Total Spawns
              </div>
            </div>

            {/* Prompt stored badge */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 8 }}>
                Storage
              </div>
              {agent.systemPromptRootHash ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#2DD4BF', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2DD4BF', flexShrink: 0 }} />
                    Prompt stored on 0G
                  </span>
                  <a
                    href={`/api/storage/download?rootHash=${encodeURIComponent(agent.systemPromptRootHash)}`}
                    download={`agent-${agent.tokenId}-prompt.json`}
                    style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#2DD4BF', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    <Download size={11} />
                    {agent.systemPromptRootHash.slice(0, 10)}…{agent.systemPromptRootHash.slice(-6)}
                  </a>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No prompt stored</span>
              )}
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/spawn" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
                <Zap size={14} /> Spawn in Studio
              </Link>
              {isOwner && (
                <Link href="/marketplace/my-agents" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
                  <Pencil size={13} /> Edit Configuration
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
