import type { Metadata } from 'next'
import NetworkDashboard from '@/components/network/NetworkDashboard'

export const metadata: Metadata = {
  title: 'Network — Orcha-net',
  description: 'Real-time view of the Orcha-net agent network state.',
}

export default function NetworkPage() {
  return (
    <div className="page-content">
      <div className="page-container" style={{ paddingBottom: 80 }}>
        <div style={{ paddingTop: 32, marginBottom: 40 }}>
          <div className="section-label">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yellow)', animation: 'pulse-yellow 1.5s infinite', display: 'inline-block' }} />
            Live Network State
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
            Network Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
            Real-time stats, compute providers, and on-chain event feed. Polling every 10s.
          </p>
        </div>
        <NetworkDashboard />
      </div>
    </div>
  )
}
