type StatusVariant = 'spawning' | 'running' | 'debating' | 'complete' | 'failed' | 'active' | 'idle'

const variantMap: Record<StatusVariant, string> = {
  active: 'pill-active',
  running: 'pill-running',
  spawning: 'pill-spawning',
  debating: 'pill-debating',
  complete: 'pill-complete',
  failed: 'pill-failed',
  idle: 'pill-complete',
}

const labelMap: Record<StatusVariant, string> = {
  active: 'Active',
  running: 'Running',
  spawning: 'Spawning',
  debating: 'Debating',
  complete: 'Complete',
  failed: 'Failed',
  idle: 'Available',
}

export default function StatusPill({ status }: { status: StatusVariant }) {
  return (
    <span className={`pill ${variantMap[status]}`}>
      <span className="pill-dot" />
      {labelMap[status]}
    </span>
  )
}
