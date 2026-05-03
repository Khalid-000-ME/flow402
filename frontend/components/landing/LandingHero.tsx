'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

export default function LandingHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* Mesh gradient blobs */}
      <div className="mesh-gradient">
        <div
          className="mesh-blob"
          style={{
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, rgba(240,180,41,0.18) 0%, transparent 70%)',
            top: '-10%',
            left: '-5%',
            animationDelay: '0s',
            animationDuration: '10s',
          }}
        />
        <div
          className="mesh-blob"
          style={{
            width: 500,
            height: 500,
            background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
            top: '20%',
            right: '-5%',
            animationDelay: '-3s',
            animationDuration: '12s',
          }}
        />
        <div
          className="mesh-blob"
          style={{
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)',
            bottom: '10%',
            left: '30%',
            animationDelay: '-6s',
            animationDuration: '9s',
          }}
        />
        <div
          className="mesh-blob"
          style={{
            width: 300,
            height: 300,
            background: 'radial-gradient(circle, rgba(240,180,41,0.10) 0%, transparent 70%)',
            bottom: '30%',
            right: '15%',
            animationDelay: '-2s',
            animationDuration: '14s',
          }}
        />
      </div>

      {/* Grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(240,180,41,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(240,180,41,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        maxWidth: 800,
        padding: '0 24px',
        animation: 'fadeInUp 0.8s ease forwards',
      }}>
        <div className="section-label" style={{ justifyContent: 'center', marginBottom: 24 }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--yellow)',
            animation: 'pulse-yellow 1.5s infinite',
          }} />
          Decentralized Agent Orchestration
        </div>

        <h1 style={{
          fontSize: 'clamp(48px, 7vw, 88px)',
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: '-0.04em',
          marginBottom: 28,
        }}>
          Agents that spawn,{' '}
          <span className="gradient-text">compete,</span>
          {' '}and prove.
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginBottom: 48,
          maxWidth: 560,
          margin: '0 auto 48px',
        }}>
          Describe your intent. Orcha-net spawns a swarm of specialized agents,
          settles every inference on-chain, and surfaces an immutable audit trail — automatically.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/chat" className="btn btn-primary" style={{ fontSize: 16, padding: '14px 32px' }}>
            Open the Network →
          </Link>
          <Link href="/agents" className="btn btn-secondary" style={{ fontSize: 16, padding: '14px 32px' }}>
            View Agents
          </Link>
        </div>

        {/* Floating badges */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          marginTop: 56,
          flexWrap: 'wrap',
        }}>
          {[
            { label: '0G Compute', color: '#F0B429', bg: 'rgba(240,180,41,0.08)', border: 'rgba(240,180,41,0.2)' },
            { label: '0G Storage', color: '#2DD4BF', bg: 'rgba(13,148,136,0.08)', border: 'rgba(13,148,136,0.2)' },
            { label: 'ENS Identity', color: '#A78BFA', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
            { label: 'TEE Verified', color: '#FB923C', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.2)' },
          ].map((badge) => (
            <span
              key={badge.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                color: badge.color,
                background: badge.bg,
                border: `1px solid ${badge.border}`,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: badge.color }} />
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
        background: 'linear-gradient(to bottom, transparent, var(--bg-primary))',
        pointerEvents: 'none',
      }} />
    </section>
  )
}
