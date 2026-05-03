import type { Metadata } from 'next'
import { Suspense } from 'react'
import SpawnStudio from '@/components/spawn/SpawnStudio'

export const metadata: Metadata = {
  title: 'Spawn Studio — Orcha-net',
  description: 'Launch multi-agent orchestration runs with a live agent flow graph and real-time inference feed.',
}

export default function SpawnPage() {
  return (
    <Suspense>
      <SpawnStudio />
    </Suspense>
  )
}
