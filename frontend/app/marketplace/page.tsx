import type { Metadata } from 'next'
import MarketplacePage from '@/components/marketplace/MarketplacePage'

export const metadata: Metadata = {
  title: 'Agent Marketplace — Orcha-net',
  description: 'Browse, register, and manage autonomous agents on the Orcha-net decentralized orchestration network.',
}

export default function Page() {
  return <MarketplacePage />
}
