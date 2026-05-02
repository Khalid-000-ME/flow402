import type { Metadata } from 'next'
import { Space_Grotesk, Space_Mono } from 'next/font/google'
import './globals.css'
import Nav from '@/components/shared/Nav'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  weight: ['300', '400', '500', '600', '700'],
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-mono-var',
  weight: ['400', '700'],
})

export const metadata: Metadata = {
  title: 'Orcha-net — Decentralized Agent Orchestration Network',
  description:
    'Describe what needs to be done. Watch a network of specialized agents spawn, compete, and prove every step on-chain.',
  keywords: ['AI agents', 'autonomous agents', 'blockchain', '0G Network', 'decentralized'],
  openGraph: {
    title: 'Orcha-net',
    description: 'Autonomous agent orchestration. Every step proven on-chain.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body>
        <Nav />
        {children}
      </body>
    </html>
  )
}
