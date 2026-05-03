'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ShieldCheck, Cpu, Database, Link2, GitBranch, CheckCircle, ChevronRight, Zap } from 'lucide-react'

// ─── Grainy gradient hero background ─────────────────────────────────────────
// Pure CSS: SVG noise + multi-stop radial gradients in amber + white/cream tones

function GrainyHero({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Colour blobs — amber + warm white + soft neutral */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: `
          radial-gradient(ellipse 90% 70% at 50% -5%,  rgba(240,180,41,0.22)  0%, transparent 65%),
          radial-gradient(ellipse 60% 50% at 20% 30%,  rgba(255,255,255,0.06) 0%, transparent 55%),
          radial-gradient(ellipse 50% 60% at 80% 20%,  rgba(255,248,220,0.08) 0%, transparent 55%),
          radial-gradient(ellipse 70% 50% at 50% 100%, rgba(240,180,41,0.07)  0%, transparent 60%),
          #080808
        `,
      }} />
      {/* Grain overlay — SVG data-URI noise */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, opacity: 0.45, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize: '300px 300px',
        mixBlendMode: 'overlay',
      }} />
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )
}

// ─── Animated agent-graph canvas (abstract nodes + edges, no text) ────────────

interface GraphNode { x: number; y: number; vx: number; vy: number; r: number; phase: number }

function AgentGraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let raf: number, t = 0

    const NODES: GraphNode[] = []
    const EDGES = [[0,1],[1,2],[1,3],[2,4],[3,4],[0,3]]

    const setup = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const w = canvas.width, h = canvas.height
      NODES.length = 0
      const cx = w/2, cy = h/2
      const pts = [
        [cx, cy],
        [cx - w*0.22, cy - h*0.15],
        [cx + w*0.20, cy - h*0.18],
        [cx - w*0.15, cy + h*0.18],
        [cx + w*0.18, cy + h*0.15],
      ]
      pts.forEach(([x,y],i) => NODES.push({ x, y, vx:(Math.random()-0.5)*0.18, vy:(Math.random()-0.5)*0.18, r: i===0?14:10, phase: Math.random()*Math.PI*2 }))
    }
    setup()

    const Y = '#F0B429', W = 'rgba(255,255,255,0.7)', DIM = 'rgba(255,255,255,0.12)'

    const draw = () => {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0,0,w,h)
      t += 0.012

      // Gently drift nodes
      NODES.forEach(n => {
        n.x += n.vx; n.y += n.vy
        if (n.x < 60 || n.x > w-60) n.vx *= -1
        if (n.y < 40 || n.y > h-40) n.vy *= -1
      })

      // Animated dash offset
      const dash = (t * 18) % 20

      // Edges
      EDGES.forEach(([a,b], i) => {
        const na = NODES[a], nb = NODES[b]
        const active = (Math.floor(t/0.8 + i) % EDGES.length) === i
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(na.x, na.y)
        ctx.lineTo(nb.x, nb.y)
        ctx.strokeStyle = active ? 'rgba(240,180,41,0.55)' : DIM
        ctx.lineWidth   = active ? 1.5 : 1
        if (active) {
          ctx.setLineDash([6, 8])
          ctx.lineDashOffset = -dash
        } else {
          ctx.setLineDash([3, 10])
          ctx.lineDashOffset = 0
        }
        ctx.stroke()
        ctx.restore()

        // Arrowhead
        if (active) {
          const dx = nb.x - na.x, dy = nb.y - na.y
          const len = Math.sqrt(dx*dx+dy*dy)
          const ux = dx/len, uy = dy/len
          const tx = nb.x - ux*(nb.r+6), ty = nb.y - uy*(nb.r+6)
          const perpX = -uy*4, perpY = ux*4
          ctx.beginPath()
          ctx.moveTo(tx, ty)
          ctx.lineTo(tx - ux*8 + perpX, ty - uy*8 + perpY)
          ctx.lineTo(tx - ux*8 - perpX, ty - uy*8 - perpY)
          ctx.closePath()
          ctx.fillStyle = 'rgba(240,180,41,0.7)'
          ctx.fill()
        }
      })

      // Nodes
      NODES.forEach((n, i) => {
        const pulse = Math.sin(t*1.5 + n.phase) * 0.25 + 0.75
        const isHub = i === 0
        // Glow
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.5)
        grd.addColorStop(0, isHub ? 'rgba(240,180,41,0.18)' : 'rgba(255,255,255,0.07)')
        grd.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r*3.5, 0, Math.PI*2)
        ctx.fillStyle = grd; ctx.fill()
        // Ring
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI*2)
        ctx.strokeStyle = isHub ? Y : W
        ctx.lineWidth   = isHub ? 2 : 1.5
        ctx.globalAlpha = pulse
        ctx.stroke()
        // Dot
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r*0.35, 0, Math.PI*2)
        ctx.fillStyle   = isHub ? Y : W
        ctx.fill()
        ctx.globalAlpha = 1
      })

      raf = requestAnimationFrame(draw)
    }
    draw()
    const ro = new ResizeObserver(setup)
    ro.observe(canvas)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

// ─── Neobrutalist card (round corners, black border, amber/white/black only) ──

function BrutalCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? '#0e0e0e' : '#080808',
        border: '2px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        padding: '30px 26px',
        boxShadow: hov ? '0 0 0 1px rgba(240,180,41,0.18), 0 8px 32px rgba(240,180,41,0.07)' : 'none',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'all 0.18s ease',
        cursor: 'default',
      }}
    >
      <div style={{ color: '#F0B429', marginBottom: 18 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#F5F5F5', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#525252', lineHeight: 1.75 }}>{body}</div>
    </div>
  )
}

// ─── Metric ──────────────────────────────────────────────────────────────────

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 'clamp(36px,5vw,58px)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#F0B429', letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 7 }}>{label}</div>
    </div>
  )
}

// ─── Step ─────────────────────────────────────────────────────────────────────

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, border: '1.5px solid rgba(240,180,41,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#F0B429', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{n}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: '#F5F5F5' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#525252', lineHeight: 1.7 }}>{desc}</div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main style={{ background: '#080808', color: '#F5F5F5', overflowX: 'hidden' }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <GrainyHero>
        <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px', gap: 28 }}>

          {/* Glowing Logo */}
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            borderRadius: 24,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(240,180,41,0.2)',
            boxShadow: '0 0 50px 10px rgba(240,180,41,0.15), inset 0 0 20px rgba(240,180,41,0.05)'
          }}>
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={90} 
              height={96} 
              priority
              style={{
                borderRadius: 20,
                objectFit: 'contain'
              }}
            />
          </div>

          {/* Tagline — Instrument Sans italic */}
          <h1 style={{
            fontFamily: "var(--font-instrument, 'Instrument Serif', Georgia, serif)",
            fontStyle: 'italic',
            fontSize: 'clamp(42px, 7vw, 92px)',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.06,
            maxWidth: 860,
          }}>
            Verifiable Intelligence.<br />
            <span style={{ color: '#F0B429' }}>Seamless Execution.</span>
          </h1>

          <p style={{ fontSize: 'clamp(14px,1.8vw,17px)', color: '#737373', maxWidth: 540, lineHeight: 1.8 }}>
            Transform natural language into autonomous on-chain action. Orchestrate a verifiable multi-agent committee backed by the 0G Network.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/spawn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F0B429', color: '#080808', fontWeight: 800, fontSize: 14, padding: '13px 28px', textDecoration: 'none', borderRadius: 999, transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Open Spawn Studio <ArrowRight size={14} />
            </Link>
            <Link href="/marketplace?register=1"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1.5px solid rgba(255,255,255,0.14)', color: '#A3A3A3', fontSize: 14, padding: '13px 24px', textDecoration: 'none', borderRadius: 999, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#F5F5F5' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#A3A3A3' }}>
              Register an Agent <ChevronRight size={14} />
            </Link>
          </div>

          {/* Abstract animated graph */}
          <div style={{ marginTop: 40, width: '100%', maxWidth: 680, height: 260, opacity: 0.9 }}>
            <AgentGraphCanvas />
          </div>
        </section>
      </GrainyHero>

      {/* ── METRICS STRIP ────────────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #141414', borderBottom: '1px solid #141414', padding: '56px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 40 }}>
          <Metric value="5+" label="Agent Types" />
          <Metric value="0G" label="Storage & Chain" />
          <Metric value="TEE" label="Verified Inference" />
          <Metric value="∞" label="Composable Flows" />
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 24px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#F0B429', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 24, height: 1, background: '#F0B429' }} />
              How it works
              <span style={{ display: 'inline-block', width: 24, height: 1, background: '#F0B429' }} />
            </div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,46px)', fontWeight: 800, letterSpacing: '-0.03em' }}>
              From prompt to proof<br />
              <span style={{ color: '#525252' }}>in one run.</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 20 }}>
            {/* Steps card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 30, padding: '36px 30px', background: '#0a0a0a', border: '1px solid #181818', borderRadius: 20 }}>
              <Step n="01" title="Describe your task" desc="Type any objective. The orchestrator interprets intent and selects the optimal specialist team." />
              <Step n="02" title="Agents spawn & execute" desc="Specialists run in parallel on 0G Compute — DeFi Analyst, SC Auditor, Tokenomics Modeler and more." />
              <Step n="03" title="Critic debates" desc="An adversarial Critic challenges every conclusion, forcing evidence-based revisions." />
              <Step n="04" title="Proven on-chain" desc="Every inference is settled on 0G. The full run record is committed to AgentRegistry." />
            </div>

            {/* Graph preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ flex: 1, background: '#0a0a0a', border: '1px solid #181818', borderRadius: 20, overflow: 'hidden', minHeight: 240 }}>
                <AgentGraphCanvas />
              </div>
              <div style={{ background: 'rgba(240,180,41,0.04)', border: '1px solid rgba(240,180,41,0.15)', borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <ShieldCheck size={17} style={{ color: '#F0B429', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>TEE-verified inference</div>
                    <div style={{ fontSize: 12, color: '#525252', lineHeight: 1.7 }}>Every agent call runs inside a Trusted Execution Environment and is cryptographically attested before being committed on-chain.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ────────────────────────────────────────────────── */}
      <section style={{ padding: '100px 24px', background: '#050505', borderTop: '1px solid #111' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#F0B429', marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 24, height: 1, background: '#F0B429' }} />
              Architecture
              <span style={{ display: 'inline-block', width: 24, height: 1, background: '#F0B429' }} />
            </div>
            <h2 style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.03em' }}>
              Built for verifiability,<br /><span style={{ color: '#525252' }}>not trust.</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
            <BrutalCard icon={<Cpu size={22} />} title="Multi-Agent Orchestration" body="An LLM orchestrator assembles the right specialists for each task — no hardcoded pipelines, fully dynamic at runtime." />
            <BrutalCard icon={<ShieldCheck size={22} />} title="Cryptographic Proof" body="TEE attestation on every inference. You don't trust the agent — you verify it with on-chain evidence." />
            <BrutalCard icon={<Database size={22} />} title="Permanent Storage on 0G" body="Run records, system prompts, and outputs are stored permanently via 0G Storage with a verifiable root hash." />
            <BrutalCard icon={<Link2 size={22} />} title="On-Chain Identity (iNFT)" body="Every agent holds a token — ID, owner, ENS name, and spawn count committed to the AgentRegistry contract." />
            <BrutalCard icon={<GitBranch size={22} />} title="Critic Debate Layer" body="An adversarial Critic stress-tests every finding before the final output is produced — automated peer review." />
            <BrutalCard icon={<CheckCircle size={22} />} title="Full Audit Trail" body="Every event — spawn, inference, debate, commit — is emitted and queryable. Nothing is hidden or abstracted away." />
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <GrainyHero>
        <section style={{ padding: '120px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <h2 style={{
            fontFamily: "var(--font-instrument, 'Instrument Serif', Georgia, serif)",
            fontStyle: 'italic',
            fontSize: 'clamp(30px, 5vw, 66px)',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            maxWidth: 680,
          }}>
            Ready to run your first<br />
            <span style={{ color: '#F0B429' }}>agent swarm?</span>
          </h2>
          <p style={{ color: '#525252', fontSize: 15, maxWidth: 460, lineHeight: 1.8 }}>
            Spawn Studio is live. Type a task, watch agents spawn in real-time,
            and get a verifiable output — all in one interface.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/spawn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F0B429', color: '#080808', fontWeight: 800, fontSize: 14, padding: '14px 30px', textDecoration: 'none', borderRadius: 999, transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Open Spawn Studio <ArrowRight size={14} />
            </Link>
            <Link href="/marketplace?register=1"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1.5px solid #222', color: '#737373', fontSize: 14, padding: '14px 24px', textDecoration: 'none', borderRadius: 999, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a3a3a'; e.currentTarget.style.color = '#F5F5F5' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#737373' }}>
              Register an Agent
            </Link>
          </div>

          {/* Footer note */}
          <div style={{ marginTop: 60, display: 'flex', alignItems: 'center', gap: 10, color: '#2a2a2a', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            <span style={{ display: 'inline-block', width: 40, height: 1, background: '#2a2a2a' }} />
            Orcha-net · 0G Network · MIT · 2025
            <span style={{ display: 'inline-block', width: 40, height: 1, background: '#2a2a2a' }} />
          </div>
        </section>
      </GrainyHero>

    </main>
  )
}
