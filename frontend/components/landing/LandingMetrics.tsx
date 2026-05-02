'use client'

import { useEffect, useState } from 'react'

interface Metric {
  label: string
  value: string
  suffix: string
  description: string
  color: string
}

const METRICS: Metric[] = [
  {
    label: 'Agent Spawns',
    value: '—',
    suffix: '',
    description: 'Total agent spawns from AgentRegistry',
    color: 'var(--yellow)',
  },
  {
    label: 'Storage Committed',
    value: '—',
    suffix: 'MB',
    description: 'Total bytes on 0G Storage',
    color: '#2DD4BF',
  },
  {
    label: 'On-chain Settlements',
    value: '—',
    suffix: '',
    description: 'Inference settlements via 0G Compute',
    color: '#A78BFA',
  },
]

function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  return (
    <div
      className="card"
      style={{
        flex: 1,
        minWidth: 220,
        animation: `fadeInUp 0.6s ease ${index * 0.1 + 0.3}s both`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: metric.color,
          opacity: 0.6,
        }}
      />
      <div
        className="mono"
        style={{
          fontSize: 'clamp(32px, 4vw, 48px)',
          fontWeight: 700,
          color: metric.color,
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {metric.value}
        {metric.suffix && (
          <span style={{ fontSize: '0.4em', color: 'var(--text-secondary)', marginLeft: 4 }}>
            {metric.suffix}
          </span>
        )}
      </div>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{metric.label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{metric.description}</div>
    </div>
  )
}

export default function LandingMetrics() {
  const [metrics, setMetrics] = useState(METRICS)

  useEffect(() => {
    // Fetch real metrics — gracefully degrade if API unavailable
    fetch('/api/agents')
      .then((r) => r.json())
      .then((agents: { spawnCount?: number }[]) => {
        const totalSpawns = agents.reduce((acc, a) => acc + (a.spawnCount ?? 0), 0)
        setMetrics((prev) =>
          prev.map((m, i) =>
            i === 0 ? { ...m, value: totalSpawns.toString() } : m
          )
        )
      })
      .catch(() => {
        // If API not ready, keep placeholder dashes
      })
  }, [])

  return (
    <section style={{ padding: '0 0 80px' }}>
      <div className="page-container">
        <div
          style={{
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          {metrics.map((m, i) => (
            <MetricCard key={m.label} metric={m} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
