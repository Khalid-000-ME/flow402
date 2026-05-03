import type { Metadata } from 'next'
import { Space_Grotesk, DM_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Nav from '@/components/shared/Nav'
import { WalletProvider } from '@/lib/wallet/WalletContext'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-var',
  weight: ['400', '500', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument',
  style: ['normal', 'italic'],
  weight: '400',
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
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${dmSans.variable} ${instrumentSerif.variable}`}
    >
      <body>
        <WalletProvider>
          <Nav />
          {children}
        </WalletProvider>
      </body>
    </html>
  )
}
