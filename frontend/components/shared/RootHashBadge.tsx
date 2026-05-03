'use client'

interface RootHashBadgeProps {
  rootHash: string
  label?: string
}

function truncate(hash: string) {
  if (hash.length <= 14) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}

/**
 * RootHashBadge
 *
 * Clicking downloads the artifact JSON from our API, which fetches it from
 * 0G Storage using the rootHash as the content address.
 *
 * Note: storagescan-galileo.0g.ai has no per-file deep-link URL (the SPA's
 * /tx/* route always redirects to chainscan). The Flow contract txHash is
 * the correct chain explorer link, handled separately by TxHashLink.
 */
export default function RootHashBadge({ rootHash, label }: RootHashBadgeProps) {
  const display = label ?? truncate(rootHash)
  // Download the artifact via our API which fetches it from 0G Storage
  const downloadHref = `/api/storage/download?rootHash=${encodeURIComponent(rootHash)}`

  return (
    <a
      href={downloadHref}
      className="root-hash-badge"
      title={`Root hash: ${rootHash}\nClick to download artifact`}
      download
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <span className="mono">{display}</span>
      <style>{`
        .root-hash-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          background: rgba(13, 148, 136, 0.12);
          border: 1px solid rgba(13, 148, 136, 0.25);
          border-radius: 4px;
          color: #2DD4BF;
          font-family: var(--font-mono);
          font-size: 11px;
          text-decoration: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .root-hash-badge:hover {
          background: rgba(13, 148, 136, 0.2);
          border-color: rgba(13, 148, 136, 0.4);
        }
      `}</style>
    </a>
  )
}
