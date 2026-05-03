'use client'

import { useState } from 'react'
import { useWallet } from '@/lib/wallet/WalletContext'
import {
  ArrowLeft, ArrowRight, CheckCircle2, X,
  Hexagon, Cpu, Database, Zap, ShieldCheck
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1 — Identity
  agentType: string
  ensName: string
  description: string
  // Step 2 — Skills
  systemPrompt: string
  capabilities: string[]
  skills: string[]
  // Step 3 — Review (no extra fields)
}

interface AgentRegistrationFlowProps {
  onClose: () => void
  onSuccess: (result: { tokenId: string; rootHash: string; registryTxHash: string }) => void
}

// ── Step config ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'identity',  label: 'Identity',  icon: Hexagon, desc: 'ENS name & iNFT allocation' },
  { id: 'skills',    label: 'Skills',    icon: Cpu,     desc: 'System prompt & capabilities' },
  { id: 'storage',   label: 'Storage',   icon: Database, desc: 'Fund & commit to 0G Storage' },
  { id: 'review',    label: 'Review',    icon: ShieldCheck, desc: 'Confirm & register on-chain' },
]

const SUGGESTED_CAPABILITIES = [
  'DeFi analysis', 'Smart contract auditing', 'Tokenomics modeling',
  'Market research', 'Risk assessment', 'Portfolio optimization',
  'Sentiment analysis', 'Protocol governance', 'Security analysis',
  'On-chain data', 'MEV analysis', 'Liquidity analysis',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentRegistrationFlow({ onClose, onSuccess }: AgentRegistrationFlowProps) {
  const { address } = useWallet()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ tokenId: string; rootHash: string; registryTxHash: string } | null>(null)

  const [form, setForm] = useState<FormData>({
    agentType: '',
    ensName: '',
    description: '',
    systemPrompt: '',
    capabilities: [],
    skills: [],
  })

  // ── Helpers ──────────────────────────────────────────────────────────────

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleCapability(cap: string) {
    set('capabilities', form.capabilities.includes(cap)
      ? form.capabilities.filter((c) => c !== cap)
      : [...form.capabilities, cap]
    )
  }

  function autoFillEns() {
    if (form.agentType && !form.ensName) {
      const slug = form.agentType.toLowerCase().replace(/\s+/g, '-')
      set('ensName', `${slug}.orchanet.eth`)
    }
  }

  function canAdvance() {
    if (step === 0) return form.agentType.trim() && form.ensName.trim()
    if (step === 1) return form.systemPrompt.trim().length > 20
    return true
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/marketplace/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: form.agentType,
          ensName: form.ensName,
          systemPrompt: form.systemPrompt,
          capabilities: form.capabilities,
          skills: form.skills,
          description: form.description,
          authorizedWallet: address,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Registration failed')
      setResult(data)
      setStep(4) // success screen
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">
      <div className="page-container" style={{ paddingTop: 32, paddingBottom: 80, maxWidth: 780 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
          >
            <ArrowLeft size={13} /> Marketplace
          </button>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            Register a New Agent
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Your agent will be committed to 0G Storage and minted as an iNFT on the AgentRegistry contract.
          </p>
        </div>

        {/* Step progress */}
        {step < 4 && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 36 }}>
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done  = i < step
              const active = i === step
              const color  = done ? '#4ADE80' : active ? 'var(--yellow)' : 'var(--text-muted)'
              return (
                <div key={s.id} style={{ flex: 1, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: done ? 'rgba(74,222,128,0.12)' : active ? 'rgba(240,180,41,0.12)' : 'var(--bg-secondary)',
                      border: `2px solid ${color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      {done ? <CheckCircle2 size={16} color="#4ADE80" /> : <Icon size={15} color={color} />}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color, whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{
                      position: 'absolute', top: 17, left: '60%', right: '-40%', height: 2,
                      background: done ? '#4ADE8040' : 'var(--border)',
                      transition: 'background 0.3s',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Step 0: Identity ────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Agent Identity</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Give your agent a unique type name and an ENS subname. These are immutable after registration.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Agent Type *
              </label>
              <input
                className="input"
                placeholder="e.g. Yield Optimizer"
                value={form.agentType}
                onChange={(e) => set('agentType', e.target.value)}
                onBlur={autoFillEns}
                style={{ width: '100%' }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Human-readable name (e.g. "DeFi Analyst", "Risk Modeler")
              </p>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ENS Name *
              </label>
              <input
                className="input"
                placeholder="e.g. yield-optimizer.orchanet.eth"
                value={form.ensName}
                onChange={(e) => set('ensName', e.target.value)}
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Auto-filled from agent type. Must be unique in the registry.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Description
              </label>
              <textarea
                className="input"
                placeholder="What does this agent specialize in?"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
                style={{ width: '100%', resize: 'none' }}
              />
            </div>

            {/* iNFT info box */}
            <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#A78BFA', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={12} /> iNFT Auto-Allocated
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Upon registration, a unique iNFT token ID is minted via the AgentRegistry contract. This is your agent's on-chain identity and cannot be transferred.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 1: Skills ──────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Skills & System Prompt</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Define your agent's intelligence. The system prompt is uploaded to 0G Storage and its hash is committed on-chain.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                System Prompt *
              </label>
              <textarea
                className="input"
                placeholder={`You are a specialized ${form.agentType || 'agent'}. Your role is to...\n\nAlways structure your response with:\n1. Analysis\n2. Key Findings\n3. Risk Assessment`}
                value={form.systemPrompt}
                onChange={(e) => set('systemPrompt', e.target.value)}
                rows={8}
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Min 20 characters</p>
                <span style={{ fontSize: 11, color: form.systemPrompt.length > 20 ? '#4ADE80' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {form.systemPrompt.length} chars
                </span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Capabilities
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTED_CAPABILITIES.map((cap) => {
                  const selected = form.capabilities.includes(cap)
                  return (
                    <button
                      key={cap}
                      onClick={() => toggleCapability(cap)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: selected ? 'rgba(240,180,41,0.12)' : 'var(--bg-secondary)',
                        border: `1px solid ${selected ? 'rgba(240,180,41,0.4)' : 'var(--border)'}`,
                        color: selected ? 'var(--yellow)' : 'var(--text-secondary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {selected ? '✓ ' : ''}{cap}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Storage ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>0G Storage Commitment</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Your agent blob (system prompt + capabilities) will be uploaded to 0G Storage. The root hash is then committed to the AgentRegistry contract.
              </p>

              {/* What gets stored */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Agent Type',    value: form.agentType },
                  { label: 'ENS Name',      value: form.ensName, mono: true },
                  { label: 'System Prompt', value: `${form.systemPrompt.slice(0, 80)}…`, mono: true },
                  { label: 'Capabilities',  value: form.capabilities.join(', ') || 'None selected' },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 110 }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontFamily: row.mono ? 'var(--font-mono)' : undefined, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      {row.value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#2DD4BF', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={12} /> How it works
              </div>
              <ol style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
                <li>Agent JSON blob uploaded to 0G Storage → returns <code style={{ fontFamily: 'var(--font-mono)' }}>rootHash</code></li>
                <li><code style={{ fontFamily: 'var(--font-mono)' }}>registerAgent(agentType, ensName, rootHash)</code> called on AgentRegistry</li>
                <li>iNFT token minted, metadata hash computed on-chain</li>
                <li>Agent appears in marketplace immediately</li>
              </ol>
            </div>

            <div style={{ background: 'rgba(240,180,41,0.06)', border: '1px solid rgba(240,180,41,0.15)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
              Server wallet (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>ZG_PRIVATE_KEY</code>) pays the gas. Registration is free for you.
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Submit ─────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Final Review</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Agent Type',    value: form.agentType },
                  { label: 'ENS Name',      value: form.ensName,        mono: true },
                  { label: 'Description',   value: form.description || '—' },
                  { label: 'System Prompt', value: `${form.systemPrompt.slice(0, 120)}…` },
                  { label: 'Capabilities',  value: form.capabilities.join(', ') || 'None' },
                  { label: 'Registered by', value: address || 'Not connected', mono: true },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 120, flexShrink: 0 }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontFamily: row.mono ? 'var(--font-mono)' : undefined, color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Success ─────────────────────────────────────────────── */}
        {step === 4 && result && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 0', gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(74,222,128,0.12)', border: '2px solid #4ADE80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={28} color="#4ADE80" />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Agent Registered!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                <strong>{form.agentType}</strong> is now live on the AgentRegistry.
              </p>
            </div>

            <div className="card" style={{ padding: 20, width: '100%', maxWidth: 520, textAlign: 'left' }}>
              {[
                { label: 'Token ID',    value: `#${result.tokenId}` },
                { label: 'Root Hash',   value: result.rootHash, mono: true },
                { label: 'Registry Tx', value: result.registryTxHash, mono: true, link: `https://chainscan-galileo.0g.ai/tx/${result.registryTxHash}` },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 100 }}>{row.label}</span>
                  {row.link ? (
                    <a href={row.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--yellow)', wordBreak: 'break-all' }}>
                      {row.value.length > 40 ? `${row.value.slice(0, 18)}…${row.value.slice(-10)}` : row.value}
                    </a>
                  ) : (
                    <span style={{ fontSize: row.mono ? 11 : 12, fontFamily: row.mono ? 'var(--font-mono)' : undefined, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      {row.value.length > 40 ? `${row.value.slice(0, 18)}…${row.value.slice(-10)}` : row.value}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={onClose}>Back to Marketplace</button>
              <a href="/marketplace/my-agents" className="btn btn-primary">View My Agents</a>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step < 4 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button
              className="btn btn-ghost"
              onClick={() => step === 0 ? onClose() : setStep(step - 1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button
                className="btn btn-primary"
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={submit}
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {submitting
                  ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Registering…</>
                  : <><ShieldCheck size={14} /> Register Agent</>
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
