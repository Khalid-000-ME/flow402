'use client'

import Link from 'next/link'
import styles from './TxHashLink.module.css'

interface TxHashLinkProps {
  hash: string
  chain: '0g' | 'ethereum' | 'arbitrum'
  label?: string
}

const explorerBase: Record<TxHashLinkProps['chain'], string> = {
  '0g': 'https://chainscan-galileo.0g.ai/tx',
  ethereum: 'https://etherscan.io/tx',
  arbitrum: 'https://arbiscan.io/tx',
}

function truncate(hash: string) {
  if (hash.length <= 14) return hash
  return `${hash.slice(0, 7)}...${hash.slice(-5)}`
}

export default function TxHashLink({ hash, chain, label }: TxHashLinkProps) {
  const url = `${explorerBase[chain]}/${hash}`
  const display = label ?? truncate(hash)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="tx-hash-link"
      title={hash}
    >
      <span className="mono">{display}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="external-icon">
        <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <style>{`
        .tx-hash-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--yellow);
          font-family: var(--font-mono);
          font-size: 12px;
          text-decoration: none;
          border-bottom: 1px dashed var(--yellow-border);
          transition: all var(--transition-fast);
          padding-bottom: 1px;
        }
        .tx-hash-link:hover {
          color: var(--yellow-bright);
          border-bottom-color: var(--yellow);
        }
        .external-icon {
          opacity: 0.7;
          flex-shrink: 0;
        }
      `}</style>
    </a>
  )
}
