import type { Metadata } from 'next'
import AgentsGrid from '@/components/agents/AgentsGrid'

export const metadata: Metadata = {
  title: 'Agents — Orcha-net',
  description: 'All registered autonomous agent types on the Orcha-net with their on-chain identities.',
}

export default function AgentsPage() {
  return (
    <div className="page-content">
      <div className="page-container" style={{ paddingBottom: 80 }}>
        <div style={{ paddingTop: 32, marginBottom: 40 }}>
          <div className="section-label">Agent Registry</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
            The Network's Agents
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 480 }}>
            Each agent is an autonomous entity with an on-chain iNFT identity, an ENS subname, and intelligence stored on 0G Storage.
          </p>
        </div>
        <AgentsGrid />
      </div>
    </div>
  )
}
