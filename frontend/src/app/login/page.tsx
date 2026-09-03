'use client';

import { useEffect, useState } from 'react';
import { Mail, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getAuthStatus } from '@/lib/api';

export default function LoginPage() {
  const [status, setStatus] = useState<{
    oauthConfigured: boolean;
    configurationUrl: string | null;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

  useEffect(() => {
    getAuthStatus()
      .then(setStatus)
      .catch(() => setStatus({ oauthConfigured: false, configurationUrl: null }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface-0)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '20px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
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
          <span style={{ fontWeight: 700, fontSize: '16px' }}>GoMAil</span>
        </Link>
      </header>

      {/* Login card */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '40px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginBottom: '8px',
              }}
            >
              Welcome to GoMAil
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Plan. Deliver. Observe.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
              Checking configuration...
            </div>
          ) : !status?.oauthConfigured ? (
            <div
              style={{
                padding: '16px',
                background: 'var(--color-warning-dim)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <AlertCircle size={16} color="var(--color-warning)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)', marginBottom: '6px' }}>
                    OAuth Not Configured
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    Set{' '}
                    <code
                      style={{
                        background: 'var(--color-surface-3)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      GOOGLE_CLIENT_ID
                    </code>{' '}
                    and{' '}
                    <code
                      style={{
                        background: 'var(--color-surface-3)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      GOOGLE_CLIENT_SECRET
                    </code>{' '}
                    in your{' '}
                    <code
                      style={{
                        background: 'var(--color-surface-3)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      .env
                    </code>{' '}
                    file.
                  </p>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: 'var(--color-accent-text)', marginTop: '8px', display: 'block' }}
                  >
                    Create Google OAuth Credentials →
                  </a>
                  {status?.configurationUrl && (
                    <p
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        marginTop: '6px',
                        fontFamily: 'var(--font-mono)',
                        wordBreak: 'break-all',
                      }}
                    >
                      Callback URL: {API_URL}/api/v1/auth/google/callback
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <a
            href={`${API_URL}/api/v1/auth/google`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              padding: '13px 20px',
              background: status?.oauthConfigured ? 'white' : 'var(--color-surface-3)',
              color: status?.oauthConfigured ? '#1a1a1a' : 'var(--color-text-muted)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              textDecoration: 'none',
              border: '1px solid transparent',
              cursor: status?.oauthConfigured ? 'pointer' : 'not-allowed',
              pointerEvents: status?.oauthConfigured ? 'auto' : 'none',
              transition: 'opacity 0.15s, transform 0.1s',
            }}
            aria-label="Sign in with Google"
            id="google-signin-btn"
          >
            {/* Google logo SVG */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.07 17.64 11.867 17.64 9.2z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </a>

          <p
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              marginTop: '20px',
            }}
          >
            By signing in, you agree to our{' '}
            <Link href="/terms" style={{ color: 'var(--color-text-secondary)' }}>
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" style={{ color: 'var(--color-text-secondary)' }}>
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
