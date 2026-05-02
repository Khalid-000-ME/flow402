'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Nav.module.css'

const navItems = [
  { label: 'Network', href: '/network' },
  { label: 'Agents', href: '/agents' },
  { label: 'Runs', href: '/runs' },
]

export default function Nav() {
  const pathname = usePathname()

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
            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Link href="/chat" className="btn btn-primary btn-sm">
        Open Network →
      </Link>
    </nav>
  )
}
