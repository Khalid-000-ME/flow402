import Link from 'next/link'

export default function LandingCTA() {
  return (
    <section style={{ padding: '80px 0 120px' }}>
      <div className="page-container">
        <div
          style={{
            position: 'relative',
            borderRadius: 24,
            padding: '72px 48px',
            textAlign: 'center',
            overflow: 'hidden',
            background: 'var(--bg-card)',
            border: '1px solid var(--yellow-border)',
          }}
        >
          {/* Glow */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 500,
            height: 300,
            background: 'radial-gradient(ellipse, rgba(240,180,41,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div className="section-label" style={{ justifyContent: 'center', marginBottom: 24 }}>
            Start Now
          </div>

          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 52px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 16,
          }}>
            Describe intent.{' '}
            <span className="gradient-text">Watch it happen.</span>
          </h2>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 17,
            marginBottom: 40,
            maxWidth: 480,
            margin: '0 auto 40px',
          }}>
            Orcha-net takes a single sentence and returns a fully proven, multi-agent analysis — on-chain at every step.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/chat" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 36px', animation: 'glow-pulse 3s ease-in-out infinite' }}>
              Open the Network →
            </Link>
            <Link href="/runs" className="btn btn-secondary" style={{ fontSize: 16, padding: '14px 32px' }}>
              Browse Past Runs
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
