const steps = [
  { actor: 'User', label: 'Intent submitted', desc: 'Describe your task in the chat interface', color: '#F0B429' },
  { actor: 'Orchestrator', label: 'Planning inference', desc: 'Determines which agent types to spawn via 0G Compute', color: '#7C3AED' },
  { actor: 'Network', label: 'Parallel spawn', desc: 'DeFi Analyst · Auditor · Tokenomics Modeler — all in parallel', color: '#2563EB' },
  { actor: '0G Compute', label: 'TEE inference settle', desc: 'Each agent call returns a real on-chain txHash', color: '#F0B429' },
  { actor: 'Critic', label: 'Adversarial debate', desc: 'Challenges weakest findings · forces defended consensus', color: '#EA580C' },
  { actor: '0G Storage', label: 'Artifact committed', desc: 'Full run record stored · rootHash returned', color: '#0D9488' },
  { actor: 'KeeperHub', label: 'On-chain proof', desc: 'commitRun() called with guaranteed settlement', color: '#16A34A' },
  { actor: 'User', label: 'Audit trail ready', desc: 'Every hash, every step, every vote — clickable and verifiable', color: '#F0B429' },
]

export default function LandingSequence() {
  return (
    <section style={{ padding: '80px 0 100px' }}>
      <div className="page-container">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            Spawn Lifecycle
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em' }}>
            Every step on the open graph
          </h2>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          maxWidth: 720,
          margin: '0 auto',
        }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 20,
                animation: `fadeInUp 0.5s ease ${i * 0.07}s both`,
              }}
            >
              {/* Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: `${step.color}18`,
                  border: `2px solid ${step.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: step.color,
                  flexShrink: 0,
                  zIndex: 1,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    width: 2,
                    flex: 1,
                    minHeight: 32,
                    background: `linear-gradient(to bottom, ${step.color}40, ${steps[i + 1].color}20)`,
                    margin: '4px 0',
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: step.color,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    [{step.actor}]
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{step.label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
