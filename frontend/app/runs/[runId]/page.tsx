import type { Metadata } from 'next'
import RunDetail from '@/components/runs/RunDetail'

export const metadata: Metadata = {
  title: 'Run Detail — Orcha-net',
  description: 'Full audit trail for an Orcha-net run — every inference, debate, and storage commitment.',
}

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  return <RunDetail runId={runId} />
}
