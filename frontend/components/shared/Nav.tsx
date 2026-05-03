'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWallet } from '@/lib/wallet/WalletContext'
import { Wallet, LogOut } from 'lucide-react'
import styles from './Nav.module.css'

const navItems = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Runs',        href: '/runs' },
]

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function Nav() {
  const pathname = usePathname()
  const { address, connecting, connect, disconnect } = useWallet()

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        <span className="logo-mark">O</span>
        <span>Orcha<span className="text-yellow">net</span></span>
      </Link>

      <div className="nav-links">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${pathname?.startsWith(item.href) ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {address ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              href="/marketplace/my-agents"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 9999,
                background: 'rgba(240,180,41,0.08)',
                border: '1px solid rgba(240,180,41,0.2)',
                color: 'var(--yellow)', fontSize: 12, fontFamily: 'var(--font-mono)',
                textDecoration: 'none', transition: 'all 0.15s',
              }}
            >
              <Wallet size={11} />
              {truncateAddress(address)}
            </Link>
            <button
              onClick={disconnect}
              title="Disconnect wallet"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: '50%',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            onClick={connect}
            disabled={connecting}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            {connecting
              ? <><div className="loading-spinner" style={{ width: 13, height: 13 }} /> Connecting…</>
              : <><Wallet size={13} /> Connect Wallet</>
            }
          </button>
        )}
        <Link href="/spawn" className="btn btn-primary btn-sm">
          Open Studio
        </Link>
      </div>
    </nav>
  )
}
