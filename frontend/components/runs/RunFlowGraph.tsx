'use client'

const AGENT_COLORS: Record<string, string> = {
  Orchestrator: '#7C3AED',
  'DeFi Analyst': '#2563EB',
  'Smart Contract Auditor': '#DC2626',
  'Tokenomics Modeler': '#0891B2',
  Critic: '#EA580C',
  Storage: '#0D9488',
}

interface GraphNode {
  id: string
  agentType: string
  status: 'spawning' | 'running' | 'complete' | 'debating'
}

const STATUS_LABELS: Record<string, string> = {
  spawning: 'Spawning…',
  running: 'Running',
  complete: 'Complete',
  debating: 'Debating',
}

const POSITIONS: Record<string, { x: number; y: number }> = {
  Orchestrator: { x: 50, y: 15 },
  'DeFi Analyst': { x: 15, y: 50 },
  'Smart Contract Auditor': { x: 50, y: 50 },
  'Tokenomics Modeler': { x: 85, y: 50 },
  Critic: { x: 50, y: 78 },
  Storage: { x: 50, y: 90 },
}

function getPos(agentType: string, index: number, total: number) {
  if (POSITIONS[agentType]) return POSITIONS[agentType]
  const angle = (index / total) * Math.PI * 2
  return {
    x: 50 + 35 * Math.cos(angle),
    y: 50 + 30 * Math.sin(angle),
  }
}

export default function RunFlowGraph({ nodes }: { nodes: GraphNode[] }) {
  const svgWidth = 600
  const svgHeight = 500
  const r = 28

  const positioned = nodes.map((n, i) => ({
    ...n,
    pos: getPos(n.agentType, i, nodes.length),
  }))

  const orchestrator = positioned.find((n) => n.agentType === 'Orchestrator')

  return (
    <div style={{ width: '100%', height: 'calc(100% - 57px)', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(240,180,41,0.5)" />
          </marker>
        </defs>

        {/* Edges from orchestrator to specialist agents */}
        {orchestrator &&
          positioned
            .filter((n) => n.agentType !== 'Orchestrator' && n.agentType !== 'Storage')
            .map((n) => {
              const x1 = (orchestrator.pos.x / 100) * svgWidth
              const y1 = (orchestrator.pos.y / 100) * svgHeight
              const x2 = (n.pos.x / 100) * svgWidth
              const y2 = (n.pos.y / 100) * svgHeight
              const dx = x2 - x1
              const dy = y2 - y1
              const len = Math.sqrt(dx * dx + dy * dy)
              const nx = dx / len
              const ny = dy / len
              return (
                <line
                  key={n.id}
                  x1={x1 + nx * r}
                  y1={y1 + ny * r}
                  x2={x2 - nx * r}
                  y2={y2 - ny * r}
                  stroke="rgba(240,180,41,0.25)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  markerEnd="url(#arrowhead)"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-20"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </line>
              )
            })}

        {/* Nodes */}
        {positioned.map((n) => {
          const cx = (n.pos.x / 100) * svgWidth
          const cy = (n.pos.y / 100) * svgHeight
          const color = AGENT_COLORS[n.agentType] || '#888'
          const isActive = n.status === 'running' || n.status === 'spawning' || n.status === 'debating'

          return (
            <g key={n.id}>
              {/* Pulse ring for active */}
              {isActive && (
                <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke={color} strokeWidth={1} opacity={0.3}>
                  <animate attributeName="r" values={`${r + 4};${r + 16};${r + 4}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Node circle */}
              <circle cx={cx} cy={cy} r={r} fill={`${color}18`} stroke={color} strokeWidth={n.status === 'complete' ? 2 : 1.5} />

              {/* Label inside */}
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fontWeight="700"
                fill={color}
                fontFamily="var(--font-mono)"
              >
                {n.agentType.split(' ')[0]}
              </text>

              {/* Status label below node */}
              <text
                x={cx}
                y={cy + r + 14}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(255,255,255,0.45)"
                fontFamily="var(--font-mono)"
              >
                {STATUS_LABELS[n.status]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
