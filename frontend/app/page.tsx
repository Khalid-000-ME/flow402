import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'Orcha-net — Decentralized Agent Orchestration',
  description: 'Autonomous agents. Verifiable reasoning. Every step proven on-chain.',
}

export default function HomePage() {
  return <LandingPage />
}
