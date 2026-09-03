import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Zap, BarChart3, Shield, Users, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'GoMAil — Plan. Deliver. Observe.',
  description: 'Professional email campaign orchestration and delivery platform.',
};

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--color-surface-0)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Nav */}
      <nav
        style={{
          borderBottom: '1px solid var(--color-border-subtle)',
          padding: '0 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '60px',
          position: 'sticky',
          top: 0,
          background: 'rgba(10, 11, 13, 0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              background: 'var(--color-accent)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail size={18} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>GoMAil</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/login"
            style={{
              padding: '8px 16px',
              background: 'var(--color-accent)',
              color: 'white',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '120px 2rem 80px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--color-accent-dim)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '100px',
            fontSize: '12px',
            color: 'var(--color-accent-text)',
            fontWeight: 500,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            marginBottom: '32px',
          }}
        >
          Email Campaign Orchestration
        </div>

        <h1
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #e8eaf0 0%, #8892a4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Plan. Deliver. Observe.
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: 'var(--color-text-secondary)',
            maxWidth: '560px',
            margin: '0 auto 48px',
            lineHeight: 1.6,
          }}
        >
          GoMAil is a professional email campaign platform built on a real delivery pipeline.
          Every status reflects actual delivery state. No estimates. No guesses.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              padding: '13px 28px',
              background: 'var(--color-accent)',
              color: 'white',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            Get Started
            <span style={{ fontSize: '16px' }}>→</span>
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 2rem 100px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1px',
            background: 'var(--color-border-subtle)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {[
            {
              icon: <Zap size={20} color="var(--color-accent)" />,
              title: 'Real Queue Engine',
              desc: 'BullMQ + Redis coordinates delivery across multiple workers. Rate limits enforced atomically.',
            },
            {
              icon: <BarChart3 size={20} color="var(--color-success)" />,
              title: 'Honest Analytics',
              desc: 'Every metric is derived from real delivery events stored in PostgreSQL. No fabricated data.',
            },
            {
              icon: <Shield size={20} color="var(--color-warning)" />,
              title: 'Idempotent Delivery',
              desc: 'Deterministic SHA-256 job IDs prevent duplicate sends across worker restarts and crashes.',
            },
            {
              icon: <Users size={20} color="var(--color-info)" />,
              title: 'Multi-Tenant RBAC',
              desc: 'Organization isolation enforced server-side. OWNER, ADMIN, OPERATOR, MEMBER, VIEWER roles.',
            },
            {
              icon: <Clock size={20} color="var(--color-accent-text)" />,
              title: 'Flexible Scheduling',
              desc: 'Send immediately or set a fixed time gap between deliveries. BullMQ handles delayed jobs.',
            },
            {
              icon: <Mail size={20} color="var(--color-error)" />,
              title: 'Campaign State Machine',
              desc: 'Explicit legal transitions only. RUNNING → PAUSED → RUNNING. No invalid state mutations.',
            },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                padding: '32px',
                background: 'var(--color-surface-1)',
              }}
            >
              <div style={{ marginBottom: '12px' }}>{f.icon}</div>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: 'var(--color-text-primary)',
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          padding: '24px 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '13px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <span>© 2026 GoMAil. Plan. Deliver. Observe.</span>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Link href="/privacy" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Privacy
          </Link>
          <Link href="/terms" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Terms
          </Link>
        </div>
      </footer>
    </main>
  );
}
