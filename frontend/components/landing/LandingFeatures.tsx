import {
  Zap,
  Link2,
  Archive,
  Swords,
  BadgeCheck,
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Intent-driven spawning',
    desc: 'Describe a task in plain language. The orchestrator determines which specialist agents to spin up — no configuration required.',
    color: 'var(--yellow)',
  },
  {
    icon: Link2,
    title: 'On-chain inference settlement',
    desc: 'Every AI inference is settled on 0G Compute via TEE-verified providers. Every settlement returns a real transaction hash.',
    color: '#A78BFA',
  },
  {
    icon: Archive,
    title: 'Immutable audit trail',
    desc: 'Full run records are committed to 0G Storage. Every reasoning step, agent message, and debate round is permanently verifiable.',
    color: '#2DD4BF',
  },
  {
    icon: Swords,
    title: 'Adversarial critic layer',
    desc: 'A dedicated critic agent challenges the weakest findings from specialist agents and forces a defended consensus.',
    color: '#FB923C',
  },
  {
    icon: BadgeCheck,
    title: 'ENS agent identities',
    desc: 'Each agent type carries a human-readable ENS subname (e.g. defi-analyst.orchanet.eth) and an on-chain iNFT token ID.',
    color: '#4ADE80',
  },
]

export default function LandingFeatures() {
  return (
    <section style={{ padding: '80px 0' }}>
      <div className="page-container">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            How it works
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em' }}>
            A fully autonomous pipeline
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 12, fontSize: 16, maxWidth: 480, margin: '12px auto 0' }}>
            From a single prompt to an immutable, verifiable multi-agent result.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="card"
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: `${f.color}15`,
                  border: `1px solid ${f.color}25`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon size={20} color={f.color} strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{f.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
