'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/lib/wallet/WalletContext'
import { Wallet, ArrowLeft, Edit2, ExternalLink, RefreshCw, CheckCircle2, X, ChevronRight } from 'lucide-react'

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

function shortHash(hash: string) {
  return hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : '—'
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({ agent, onClose, onSaved }: { agent: Agent; onClose: () => void; onSaved: () => void }) {
  const [newPrompt, setNewPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function save() {
    if (!newPrompt.trim()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/marketplace/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: agent.tokenId, systemPrompt: newPrompt }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Update failed')
      setDone(true)
      setTimeout(() => { onSaved(); onClose() }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 580, padding: 28, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={16} />
        </button>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Edit Agent — {agent.agentType}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Updates the system prompt stored in 0G Storage and updates the on-chain root hash.
          </p>
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          New System Prompt
        </label>
        <textarea
          className="input"
          value={newPrompt}
          onChange={e => setNewPrompt(e.target.value)}
          rows={8}
          style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
          placeholder={`You are ${agent.agentType}. Your role is to…`}
        />
        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 12 }}>
            {error}
          </div>
        )}
        {done && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={13} /> Agent updated successfully!
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !newPrompt.trim() || done} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? <><div className="loading-spinner" style={{ width: 13, height: 13 }} /> Saving…</> : <><RefreshCw size={13} /> Update Agent</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Agent row (same pattern as MarketplacePage) ───────────────────────────────

function AgentRow({ agent, onEdit }: { agent: Agent; onEdit: () => void }) {
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
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{agent.agentType}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.ensName || '—'}</div>
      </td>

      {/* iNFT ID removed per request */}

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
          <button
            className="btn btn-ghost btn-sm"
            onClick={onEdit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 9px' }}
          >
            <Edit2 size={11} /> Edit
          </button>
          <a
            href={agent.explorerUrl}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 9px' }}
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={10} />
          </a>
          <Link
            href={`/marketplace/agents/${agent.tokenId}`}
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 9px' }}
            onClick={e => e.stopPropagation()}
          >
            View <ChevronRight size={11} />
          </Link>
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyAgentsPage() {
  const { address, connect, connected } = useWallet()
  const [allAgents, setAllAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)

  function fetchAgents() {
    setLoading(true)
    fetch('/api/agents')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllAgents(data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAgents() }, [])

  const myAgents = allAgents.filter(a => a.owner?.toLowerCase() === address?.toLowerCase())

  if (!connected) {
    return (
      <div className="page-content">
        <div className="page-container" style={{ paddingTop: 80 }}>
          <div style={{ textAlign: 'center', maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(240,180,41,0.10)', border: '1px solid rgba(240,180,41,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={22} color="var(--yellow)" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Connect Your Wallet</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Connect your wallet to view and manage the agents registered under your address.
              </p>
            </div>
            <button className="btn btn-primary" onClick={connect} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wallet size={14} /> Connect Wallet
            </button>
            <Link href="/marketplace" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Browse all agents</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      {editingAgent && (
        <EditModal agent={editingAgent} onClose={() => setEditingAgent(null)} onSaved={fetchAgents} />
      )}

      <div className="page-container" style={{ paddingTop: 32, paddingBottom: 80 }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Link href="/marketplace" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, textDecoration: 'none' }}>
            <ArrowLeft size={12} /> Marketplace
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>My Agents</h1>
              <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4 }}>
                {address}
              </code>
            </div>
            <Link href="/marketplace?register=1" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              + Register New Agent
            </Link>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', padding: '60px 0' }}>
            <div className="loading-spinner" /> Loading your agents…
          </div>
        ) : myAgents.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Wallet size={36} strokeWidth={1.25} style={{ opacity: 0.4 }} />
            <p>No agents registered under this wallet.</p>
            <Link href="/marketplace?register=1" className="btn btn-secondary" style={{ fontSize: 13 }}>
              Register your first agent
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Agent', 'Spawns', 'System Prompt', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myAgents.map(agent => (
                  <AgentRow key={agent.tokenId} agent={agent} onEdit={() => setEditingAgent(agent)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
