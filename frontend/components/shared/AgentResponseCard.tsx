'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Download, ExternalLink } from 'lucide-react'

// ── Sentiment config ──────────────────────────────────────────────────────────

type Sentiment = 'BULLISH' | 'BEARISH' | 'RISKY' | 'SAFE' | 'CRITICAL' | 'GOOD' | 'NEUTRAL'

const SENTIMENT_MAP: Record<Sentiment, { color: string; bg: string; border: string }> = {
  BULLISH:  { color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.22)'  },
  SAFE:     { color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.22)'  },
  GOOD:     { color: '#34D399', bg: 'rgba(52,211,153,0.08)',   border: 'rgba(52,211,153,0.22)'  },
  NEUTRAL:  { color: '#A3A3A3', bg: 'rgba(163,163,163,0.08)', border: 'rgba(163,163,163,0.22)' },
  BEARISH:  { color: '#FB923C', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.22)'  },
  RISKY:    { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.22)'  },
  CRITICAL: { color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.22)' },
}

// ── Extract sentiment from content string ─────────────────────────────────────

export function extractSentiment(content: string): Sentiment | null {
  if (!content) return null
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    ?? content.match(/(\{[\s\S]*\})/)
  const raw = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : content
  try {
    const parsed = JSON.parse(raw.trim())
    const s = (parsed?.sentiment as string)?.toUpperCase()
    if (s && s in SENTIMENT_MAP) return s as Sentiment
  } catch { /* not JSON */ }
  const upper = content.toUpperCase()
  for (const key of ['CRITICAL', 'BEARISH', 'RISKY', 'BULLISH', 'SAFE', 'GOOD', 'NEUTRAL'] as Sentiment[]) {
    if (upper.includes(key)) return key
  }
  return null
}

// ── Render content: formatted JSON or processed markdown ──────────────────────

function renderContent(content: string): React.ReactNode {
  if (!content) return null
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonCandidate = fenceMatch ? fenceMatch[1] : content.trim()
  try {
    const parsed = JSON.parse(jsonCandidate)
    return <JsonViewer data={parsed} />
  } catch { /* not JSON */ }
  return <MarkdownContent text={content} />
}

// ── JSON tree viewer ──────────────────────────────────────────────────────────

function JsonViewer({ data }: { data: unknown }) {
  return (
    <pre style={{
      fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.7, color: '#A3A3A3',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '14px 16px', overflowX: 'auto',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
    }}>
      {colorizeJson(JSON.stringify(data, null, 2))}
    </pre>
  )
}

function colorizeJson(text: string): React.ReactNode[] {
  const tokens = text.split(/("(?:[^"\\]|\\.)*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g)
  return tokens.map((tok, i) => {
    if (tok.endsWith(':'))            return <span key={i} style={{ color: '#93C5FD' }}>{tok}</span>
    if (tok.startsWith('"'))          return <span key={i} style={{ color: '#86EFAC' }}>{tok}</span>
    if (tok === 'true' || tok === 'false') return <span key={i} style={{ color: '#FDE68A' }}>{tok}</span>
    if (tok === 'null')               return <span key={i} style={{ color: '#F87171' }}>{tok}</span>
    if (/^-?\d/.test(tok))            return <span key={i} style={{ color: '#C4B5FD' }}>{tok}</span>
    return <span key={i} style={{ color: '#525252' }}>{tok}</span>
  })
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function MarkdownContent({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.8, color: '#A3A3A3' }}>
      {text.split('\n').map((line, i) => {
        const h3 = line.match(/^### (.+)/); if (h3) return <div key={i} style={{ fontWeight: 700, color: '#F5F5F5', fontSize: 14, marginTop: 14, marginBottom: 4 }}>{h3[1]}</div>
        const h2 = line.match(/^## (.+)/);  if (h2) return <div key={i} style={{ fontWeight: 800, color: '#F5F5F5', fontSize: 15, marginTop: 16, marginBottom: 4 }}>{h2[1]}</div>
        const h1 = line.match(/^# (.+)/);   if (h1) return <div key={i} style={{ fontWeight: 800, color: '#F5F5F5', fontSize: 17, marginTop: 18, marginBottom: 6 }}>{h1[1]}</div>
        const bullet = line.match(/^[-*] (.+)/); if (bullet) return <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 4, marginBottom: 2 }}><span style={{ color: '#F0B429', flexShrink: 0 }}>·</span><span>{inlineFormat(bullet[1])}</span></div>
        const num = line.match(/^\d+\. (.+)/); if (num) return <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 4, marginBottom: 2 }}><span style={{ color: '#F0B429', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{line.match(/^(\d+)/)?.[1]}.</span><span>{inlineFormat(num[1])}</span></div>
        if (/^---/.test(line)) return <hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '10px 0' }} />
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />
        return <div key={i} style={{ marginBottom: 2 }}>{inlineFormat(line)}</div>
      })}
    </div>
  )
}

function inlineFormat(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} style={{ color: '#F5F5F5', fontWeight: 700 }}>{p.slice(2,-2)}</strong>
    if (p.startsWith('`') && p.endsWith('`'))   return <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4, color: '#93C5FD' }}>{p.slice(1,-1)}</code>
    return p
  })
}

// ── Sentiment badge ───────────────────────────────────────────────────────────

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const cfg = SENTIMENT_MAP[sentiment]
  return (
    <span style={{
      fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em',
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 999, padding: '2px 8px',
      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {sentiment}
    </span>
  )
}

// ── Hash chips (always visible) ───────────────────────────────────────────────

function HashChips({ txHash, rootHash, runId }: { txHash?: string; rootHash?: string; runId?: string }) {
  if (!txHash && !rootHash) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {txHash?.startsWith('0x') && (
        <a
          href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', color: '#F0B429',
            background: 'rgba(240,180,41,0.06)', border: '1px solid rgba(240,180,41,0.2)',
            borderRadius: 6, padding: '2px 8px', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <ExternalLink size={9} />
          Tx {txHash.slice(0,8)}…{txHash.slice(-5)}
        </a>
      )}
      {rootHash && (
        <a
          href={runId ? `/api/runs/${runId}/download` : `/api/storage/download?rootHash=${encodeURIComponent(rootHash)}`}
          download
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', color: '#2DD4BF',
            background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)',
            borderRadius: 6, padding: '2px 8px', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
          title={rootHash}
        >
          <Download size={9} />
          {rootHash.slice(0,8)}…{rootHash.slice(-5)}
        </a>
      )}
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface AgentResponseCardProps {
  agentType: string
  agentColor?: string   // kept for compat but not used for avatar
  content: string
  eventLabel?: string
  timestamp?: number
  teeVerified?: boolean
  txHash?: string
  rootHash?: string
  runId?: string
}

export default function AgentResponseCard({
  agentType, content, eventLabel,
  timestamp, teeVerified, txHash, rootHash, runId,
}: AgentResponseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const sentiment = useMemo(() => extractSentiment(content), [content])
  const PREVIEW_CHARS = 240
  const hasHashes = !!(txHash || rootHash)

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 4,
    }}>

      {/* ── Header (always visible, clickable to expand) ─── */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', textAlign: 'left',
        }}
      >
        {/* Agent name */}
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{agentType}</span>

        {eventLabel && (
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 400 }}>{eventLabel}</span>
        )}

        {/* Sentiment */}
        {sentiment && <SentimentBadge sentiment={sentiment} />}

        {/* TEE */}
        {teeVerified && (
          <span style={{
            fontSize: 8.5, fontFamily: 'var(--font-mono)', color: '#4ADE80',
            background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: 999, padding: '1px 6px',
          }}>TEE</span>
        )}

        {/* Timestamp */}
        {timestamp != null && (
          <span style={{ marginLeft: 'auto', fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}

        {/* Expand icon */}
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>

      {/* ── Tx/Root hashes — ALWAYS visible under header ── */}
      {hasHashes && (
        <div style={{ padding: '0 14px 8px' }}>
          <HashChips txHash={txHash} rootHash={rootHash} runId={runId} />
        </div>
      )}

      {/* ── Collapsed preview ── */}
      {!expanded && content && (
        <div style={{ padding: `0 14px ${hasHashes ? 6 : 12}px`, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {content.replace(/```[\s\S]*?```/g, '[JSON]').replace(/[#*`]/g, '').trim().slice(0, PREVIEW_CHARS)}
          {content.length > PREVIEW_CHARS ? '…' : ''}
        </div>
      )}

      {/* ── Expanded full content ── */}
      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {renderContent(content)}
        </div>
      )}
    </div>
  )
}
