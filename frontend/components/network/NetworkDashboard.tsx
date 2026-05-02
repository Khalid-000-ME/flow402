'use client'

import {
  Users,
  Activity,
  Link2,
  HardDrive,
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

interface NetworkStats {
  totalAgents: number
  activeRuns: number
  totalInferenceSettlements: number
  totalStorageBytes: number
  providers: Array<{ address: string; model: string; txCount: number }>
  recentEvents: Array<{ type: string; runId?: string; agentType?: string; timestamp: number }>
}

const STAT_CARDS = [
  { key: 'totalAgents' as const,               label: 'Registered Agents',      color: 'var(--yellow)', Icon: Users,    format: null as null | ((v: number) => string) },
  { key: 'activeRuns' as const,                label: 'Active Runs',             color: '#A78BFA',       Icon: Activity, format: null as null | ((v: number) => string) },
  { key: 'totalInferenceSettlements' as const, label: 'Inference Settlements',   color: '#2DD4BF',       Icon: Link2,    format: null as null | ((v: number) => string) },
  { key: 'totalStorageBytes' as const,         label: 'Storage Committed',        color: '#4ADE80',       Icon: HardDrive, format: ((v: number) => `${Math.round(v / 1024)}KB`) as ((v: number) => string) },
]

export default function NetworkDashboard() {
  const [stats, setStats] = useState<NetworkStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/network')
      const data = await res.json()
      setStats(data)
      setLastUpdate(new Date())
    } catch {
      // Silent — keep stale data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const EVENT_COLORS: Record<string, string> = {
    AgentSpawned: '#2563EB',
    RunCompleted: '#4ADE80',
    StorageCommitted: '#2DD4BF',
    RunStarted: '#F0B429',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Live counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {STAT_CARDS.map(({ key, label, color, Icon, format }) => {
          const raw = stats?.[key as keyof NetworkStats]
          const value = typeof raw === 'number'
            ? (format ? (format as (v: number) => string)(raw) : raw.toLocaleString())
            : '—'
          return (
            <div key={key} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.5 }} />
              <div style={{ marginBottom: 8 }}>
                <Icon size={22} color={color} strokeWidth={1.5} style={{ opacity: 0.85 }} />
              </div>
              <div className="mono" style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>
                {loading ? '—' : value}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
            </div>
          )
        })}
      </div>

      {/* Providers + Events */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Provider table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
            0G Compute Providers
          </div>
          {loading ? (
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
              <div className="loading-spinner" style={{ width: 16, height: 16 }} />
              Loading…
            </div>
          ) : !stats?.providers?.length ? (
            <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
              No provider data. Configure <span className="mono">ZG_PROVIDER_DEFAULT</span>.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Address', 'Model', 'Settlements'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.providers.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <a
                        href={`https://chainscan-galileo.0g.ai/address/${p.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--yellow)' }}
                      >
                        {p.address.slice(0, 8)}…{p.address.slice(-6)}
                      </a>
                    </td>
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{p.model}</td>
                    <td className="mono" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{p.txCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Event feed */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Recent Events</span>
            {lastUpdate && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div style={{ padding: '8px 0', maxHeight: 320, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
                <div className="loading-spinner" style={{ width: 16, height: 16 }} />
                Syncing events…
              </div>
            ) : !stats?.recentEvents?.length ? (
              <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                No recent events.
              </div>
            ) : (
              stats.recentEvents.map((evt, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: EVENT_COLORS[evt.type] || '#888', flexShrink: 0 }} />
                  <div>
                    <span style={{ color: EVENT_COLORS[evt.type] || 'var(--text-secondary)', fontWeight: 600, fontSize: 12 }}>
                      {evt.type}
                    </span>
                    {evt.agentType && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>· {evt.agentType}</span>
                    )}
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {new Date(evt.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
