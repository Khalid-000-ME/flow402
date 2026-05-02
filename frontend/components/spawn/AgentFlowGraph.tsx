'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export interface FlowNode {
  id: string
  agentType: string
  status: 'idle' | 'spawning' | 'running' | 'complete' | 'debating' | 'error'
  lastMessage?: string
}

interface Props {
  nodes: FlowNode[]
  running: boolean
  selectedId: string | null
  onNodeClick: (id: string) => void
}

const NODE_W = 136, NODE_H = 54, RX = 13
const COL_GAP = 200  // horizontal gap between columns
const ROW_GAP = 110  // vertical gap between rows in same column
const FONT   = "var(--font-dm-sans,'DM Sans','Inter',sans-serif)"

const C = {
  nodeBg:     'rgba(255,255,255,0.03)',
  borderIdle: 'rgba(255,255,255,0.09)',
  borderLive: 'rgba(255,255,255,0.22)',
  borderDone: 'rgba(255,255,255,0.16)',
  text:       'rgba(255,255,255,0.52)',
  textBright: 'rgba(255,255,255,0.88)',
  dotIdle:    'rgba(255,255,255,0.18)',
  dotLive:    '#F0B429',
  dotDone:    '#4ADE80',
  edgeIdle:   'rgba(255,255,255,0.07)',
  edgeActive: 'rgba(255,255,255,0.20)',
}

function colOf(t: string) {
  if (t === 'Orchestrator') return 0
  if (t === 'Critic')       return 2
  return 1
}

function initPositions(nodes: FlowNode[], svgW: number, svgH: number) {
  const vis = nodes.filter(n => n.agentType !== 'Storage')
  const byCol: Record<number, FlowNode[]> = {}
  for (const n of vis) { const c = colOf(n.agentType); byCol[c] = [...(byCol[c]??[]), n] }
  const keys = Object.keys(byCol).map(Number).sort()
  const totalW = (keys.length - 1) * (NODE_W + COL_GAP)
  const maxRows = Math.max(...keys.map(k => byCol[k].length), 1)
  const startX = svgW / 2 - totalW / 2
  const startY = svgH / 2

  const out: Record<string, { cx: number; cy: number }> = {}
  keys.forEach((col, ci) => {
    const grp = byCol[col]
    const grpH = (grp.length - 1) * ROW_GAP
    grp.forEach((n, ri) => {
      out[n.id] = { cx: startX + ci * (NODE_W + COL_GAP), cy: startY - grpH / 2 + ri * ROW_GAP }
    })
  })
  return out
}

function buildEdges(nodes: FlowNode[], pos: Record<string, { cx: number; cy: number }>) {
  const vis = nodes.filter(n => n.agentType !== 'Storage' && pos[n.id])
  const byCol: Record<number, FlowNode[]> = {}
  for (const n of vis) { const c = colOf(n.agentType); byCol[c] = [...(byCol[c]??[]), n] }
  const keys = Object.keys(byCol).map(Number).sort()
  const edges: Array<{ from: FlowNode; to: FlowNode; active: boolean }> = []
  for (let i = 0; i < keys.length - 1; i++)
    for (const f of byCol[keys[i]])
      for (const t of byCol[keys[i+1]])
        edges.push({ from: f, to: t, active: f.status === 'complete' || t.status !== 'idle' })
  return edges
}

export default function AgentFlowGraph({ nodes, running, selectedId, onNodeClick }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const vpRef   = useRef({ tx: 0, ty: 0, scale: 1 })
  const [vp, _setVp] = useState({ tx: 0, ty: 0, scale: 1 })
  const setVp = useCallback((fn: (p: typeof vp) => typeof vp) => {
    _setVp(prev => { const n = fn(prev); vpRef.current = n; return n })
  }, [])

  const [pos, setPos] = useState<Record<string, { cx: number; cy: number }>>({})
  const dragRef = useRef<{ type: 'pan' | 'node'; id?: string; sx: number; sy: number; stx?: number; sty?: number; wox?: number; woy?: number } | null>(null)

  const svgRect = () => svgRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 800, height: 500 }
  const toWorld = (cx: number, cy: number) => {
    const r = svgRect(); const { tx, ty, scale } = vpRef.current
    return { x: (cx - r.left - tx) / scale, y: (cy - r.top - ty) / scale }
  }

  // Always recompute ALL positions when node list changes.
  // Using a stale/incremental approach causes nodes to be placed at
  // positions that were computed from different layout snapshots.
  // After run_complete, no more nodes spawn so dragged positions are stable.
  useEffect(() => {
    const r = svgRect()
    const init = initPositions(nodes, r.width || 900, r.height || 500)
    // Preserve positions for nodes already in state (drag positions kept
    // across status updates), but fully recompute if a new node is added.
    setPos(prev => {
      const prevIds  = new Set(Object.keys(prev))
      const nextIds  = new Set(nodes.filter(n => n.agentType !== 'Storage').map(n => n.id))
      const hasNewNode = [...nextIds].some(id => !prevIds.has(id))
      if (!hasNewNode) {
        // Only status updates — don't touch positions
        const next = { ...prev }
        for (const id of prevIds) { if (!nextIds.has(id)) delete next[id] }
        return next
      }
      // New node appeared — recompute full layout (reset drag state during spawn)
      return init
    })
  }, [nodes])

  // Wheel zoom — passive: false to prevent page scroll
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const r = svg.getBoundingClientRect()
      const mx = e.clientX - r.left, my = e.clientY - r.top
      const f = e.deltaY > 0 ? 0.92 : 1.08
      setVp(prev => {
        const ns = Math.max(0.2, Math.min(4, prev.scale * f))
        return { tx: mx - (mx - prev.tx) * ns / prev.scale, ty: my - (my - prev.ty) * ns / prev.scale, scale: ns }
      })
    }
    svg.addEventListener('wheel', handler, { passive: false })
    return () => svg.removeEventListener('wheel', handler)
  }, [setVp])

  const onBgDown = (e: React.PointerEvent) => {
    dragRef.current = { type: 'pan', sx: e.clientX, sy: e.clientY, stx: vpRef.current.tx, sty: vpRef.current.ty }
  }
  const onNodeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    const { x, y } = toWorld(e.clientX, e.clientY)
    const p = pos[id]!
    dragRef.current = { type: 'node', id, sx: e.clientX, sy: e.clientY, wox: x - p.cx, woy: y - p.cy }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return
    if (d.type === 'pan') {
      setVp(prev => ({ ...prev, tx: d.stx! + e.clientX - d.sx, ty: d.sty! + e.clientY - d.sy }))
    } else if (d.type === 'node' && d.id) {
      const { x, y } = toWorld(e.clientX, e.clientY)
      setPos(prev => ({ ...prev, [d.id!]: { cx: x - d.wox!, cy: y - d.woy! } }))
    }
  }
  const onUp = () => { dragRef.current = null }

  const vis   = nodes.filter(n => n.agentType !== 'Storage' && pos[n.id])
  const edges = buildEdges(nodes, pos)
  const transform = `translate(${vp.tx},${vp.ty}) scale(${vp.scale})`

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: '100%', touchAction: 'none', cursor: dragRef.current?.type === 'pan' ? 'grabbing' : 'default' }}
      onPointerDown={onBgDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      <defs>
        <marker id="arr-a" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0,6 2.5,0 5" fill={C.edgeActive}/>
        </marker>
        <marker id="arr-i" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0,6 2.5,0 5" fill={C.edgeIdle}/>
        </marker>
      </defs>

      <g transform={transform}>
        {/* Invisible background for pan events */}
        <rect x={-50000} y={-50000} width={100000} height={100000} fill="transparent"/>

        {/* Edges */}
        {edges.map((e, i) => {
          const fp = pos[e.from.id]!, tp = pos[e.to.id]!
          const x1 = fp.cx + NODE_W/2, y1 = fp.cy
          const x2 = tp.cx - NODE_W/2, y2 = tp.cy
          const cp = Math.abs(x2 - x1) * 0.45
          const d  = `M${x1} ${y1} C${x1+cp} ${y1},${x2-cp} ${y2},${x2} ${y2}`
          return (
            <g key={i} style={{ pointerEvents: 'none' }}>
              <path d={d} fill="none" stroke={C.edgeIdle} strokeWidth={1}/>
              {e.active
                ? <path d={d} fill="none" stroke={C.edgeActive} strokeWidth={1} strokeDasharray="4 7" markerEnd="url(#arr-a)">
                    <animate attributeName="stroke-dashoffset" from="0" to="-22" dur="1.6s" repeatCount="indefinite"/>
                  </path>
                : <path d={d} fill="none" stroke={C.edgeIdle} strokeWidth={1} markerEnd="url(#arr-i)"/>
              }
            </g>
          )
        })}

        {/* Nodes */}
        {vis.map(n => {
          const { cx, cy } = pos[n.id]!
          const isLive = n.status === 'running' || n.status === 'spawning' || n.status === 'debating'
          const isDone = n.status === 'complete'
          const isSel  = selectedId === n.id
          const x = cx - NODE_W/2, y = cy - NODE_H/2
          const border  = isDone ? C.borderDone : (isLive||isSel) ? C.borderLive : C.borderIdle
          const textCol = (isLive||isDone||isSel) ? C.textBright : C.text
          const dotFill = isDone ? C.dotDone : isLive ? C.dotLive : C.dotIdle
          const label   = n.agentType === 'Smart Contract Auditor' ? 'SC Auditor'
                        : n.agentType === 'Tokenomics Modeler'    ? 'Tokenomics'
                        : n.agentType
          const status  = n.status === 'spawning' ? 'spawning…' : n.status === 'running' ? 'running'
                        : n.status === 'debating' ? 'debating' : n.status === 'complete' ? 'complete' : 'idle'
          return (
            <g key={n.id} onPointerDown={e => onNodeDown(e, n.id)} onClick={e => { e.stopPropagation(); onNodeClick(n.id) }} style={{ cursor: 'grab' }}>
              {(isLive||isSel) && (
                <rect x={x-8} y={y-8} width={NODE_W+16} height={NODE_H+16} rx={RX+6} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10}>
                  <animate attributeName="opacity" values="1;0.15;1" dur="2s" repeatCount="indefinite"/>
                </rect>
              )}
              <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={RX} fill={C.nodeBg} stroke={border} strokeWidth={(isLive||isSel||isDone)?1:0.75}/>
              <circle cx={x+NODE_W-14} cy={y+14} r={3.5} fill={dotFill}>
                {isLive && <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/>}
              </circle>
              <text x={cx-6} y={cy-8} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="600" fill={textCol} fontFamily={FONT} style={{ pointerEvents: 'none' }}>{label}</text>
              <text x={cx-6} y={cy+9}  textAnchor="middle" dominantBaseline="middle" fontSize={9}  fill="rgba(255,255,255,0.28)" fontFamily={FONT} style={{ pointerEvents: 'none' }}>{status}</text>
            </g>
          )
        })}
      </g>

      {/* Zoom hint */}
      <text x={12} y={20} fontSize={9.5} fill="rgba(255,255,255,0.18)" fontFamily={FONT} style={{ pointerEvents: 'none' }}>
        scroll to zoom · drag to pan · click node for details
      </text>
    </svg>
  )
}
