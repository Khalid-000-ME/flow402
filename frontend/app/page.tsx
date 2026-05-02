import type { Metadata } from 'next'
import LandingHero from '@/components/landing/LandingHero'
import LandingMetrics from '@/components/landing/LandingMetrics'
import LandingSequence from '@/components/landing/LandingSequence'
import LandingFeatures from '@/components/landing/LandingFeatures'
import LandingCTA from '@/components/landing/LandingCTA'

export const metadata: Metadata = {
  title: 'Orcha-net — Decentralized Agent Orchestration Network',
  description:
    'Describe what needs to be done. Watch a network of specialized agents spawn, compete, and prove every step on-chain.',
}

export default function HomePage() {
  return (
    <main>
      <LandingHero />
      <LandingMetrics />
      <LandingFeatures />
      <LandingSequence />
      <LandingCTA />
    </main>
  )
}
