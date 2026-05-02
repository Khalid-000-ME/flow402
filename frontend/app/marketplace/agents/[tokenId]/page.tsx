import type { Metadata } from 'next'
import AgentDetail from '@/components/marketplace/AgentDetail'

export const metadata: Metadata = {
  title: 'Agent Detail — Orcha-net',
  description: 'In-depth details for a registered Orcha-net agent.',
}

export default async function AgentDetailPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params
  return <AgentDetail tokenId={tokenId} />
}
