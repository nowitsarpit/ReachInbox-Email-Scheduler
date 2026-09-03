'use client';

import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '@/lib/api';
import { BarChart3, CheckCircle, AlertCircle, Clock, TrendingUp, Loader2 } from 'lucide-react';

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: getAnalytics });
  const analytics = (data?.data as any) ?? {};

  const cards = [
    { label: 'Total Sent', value: analytics.summary?.totalSent ?? 0, icon: <CheckCircle size={18} color="var(--color-success)" />, color: 'var(--color-success)' },
    { label: 'Total Failed', value: analytics.summary?.totalFailed ?? 0, icon: <AlertCircle size={18} color="var(--color-error)" />, color: 'var(--color-error)' },
    { label: 'Total Deferred', value: analytics.summary?.totalDeferred ?? 0, icon: <Clock size={18} color="var(--color-warning)" />, color: 'var(--color-warning)' },
    { label: 'Sent (24h)', value: analytics.summary?.sentLast24h ?? 0, icon: <TrendingUp size={18} color="var(--color-accent)" />, color: 'var(--color-accent)' },
  ];

  const campaignsByStatus = analytics.campaigns?.byStatus ?? {};
  const deliveriesByStatus = analytics.deliveries?.byStatus ?? {};

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Analytics</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          All metrics are derived from real delivery events — no estimates
        </p>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Loading analytics...
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {cards.map((c) => (
              <div key={c.label} style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</span>
                  {c.icon}
                </div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: c.color, letterSpacing: '-0.02em' }}>
                  {c.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Breakdown panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' }}>
            <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Campaigns by Status</h3>
              {Object.entries(campaignsByStatus).length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No campaign data yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(campaignsByStatus).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{status}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{String(count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '20px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Delivery Jobs by Status</h3>
              {Object.entries(deliveriesByStatus).length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No delivery data yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(deliveriesByStatus).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{status}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{String(count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Note about limitations */}
          <div style={{ padding: '14px 16px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text-secondary)' }}>Note:</strong> Open rate, click rate, and bounce tracking require webhook endpoints configured with your email provider. Current provider (Ethereal SMTP) is a test-only transport — messages are intercepted and not actually delivered to inboxes.
          </div>
        </>
      )}
    </div>
  );
}
