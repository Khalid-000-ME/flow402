import type { Metadata } from 'next'
import MyAgentsPage from '@/components/marketplace/MyAgentsPage'

export const metadata: Metadata = {
  title: 'My Agents — Orcha-net',
  description: 'Manage and configure your registered agents on Orcha-net.',
}

export default function Page() {
  return <MyAgentsPage />
}
