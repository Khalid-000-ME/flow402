import type { Metadata } from 'next'
import ChatInterface from '@/components/chat/ChatInterface'

export const metadata: Metadata = {
  title: 'Chat — Orcha-net',
  description: 'Type a task. Watch specialized agents spawn and prove every step on-chain.',
}

export default function ChatPage() {
  return <ChatInterface />
}
