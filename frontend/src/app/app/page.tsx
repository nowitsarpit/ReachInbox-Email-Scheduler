'use client';

import { useQuery } from '@tanstack/react-query';
import { getCampaigns, getAnalytics } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Send, CheckCircle, AlertCircle, Clock, Plus, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const { user, organization } = useAuth();

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns', { pageSize: 5 }],
    queryFn: () => getCampaigns({ pageSize: 5 }),
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalytics,
  });

  const analytics = (analyticsData?.data as any) ?? {};
  const recentCampaigns = campaignsData?.data ?? [];

  const statusColor: Record<string, string> = {
    RUNNING: 'var(--color-accent)',
    COMPLETED: 'var(--color-success)',
    FAILED: 'var(--color-error)',
    PAUSED: 'var(--color-warning)',
    DRAFT: 'var(--color-text-muted)',
    CANCELLED: 'var(--color-text-disabled)',
    SCHEDULED: 'var(--color-info)',
  };

  const statCards = [
    {
      label: 'Total Sent',
      value: (analytics.summary?.totalSent ?? 0).toLocaleString(),
      icon: <CheckCircle size={18} color="var(--color-success)" />,
      sub: 'All time',
    },
    {
      label: 'Sent (24h)',
      value: (analytics.summary?.sentLast24h ?? 0).toLocaleString(),
      icon: <Clock size={18} color="var(--color-accent)" />,
      sub: 'Last 24 hours',
    },
    {
      label: 'Total Failed',
      value: (analytics.summary?.totalFailed ?? 0).toLocaleString(),
      icon: <AlertCircle size={18} color="var(--color-error)" />,
      sub: 'All time',
    },
    {
      label: 'Campaigns',
      value: (analytics.campaigns?.total ?? 0).toLocaleString(),
      icon: <Send size={18} color="var(--color-warning)" />,
      sub: `${analytics.campaigns?.byStatus?.RUNNING ?? 0} active`,
    },
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>
          {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          {organization?.name} — GoMAil Campaign Platform
        </p>
      </div>

      {/* Stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '32px',
      }}>
        {statCards.map((card) => (
          <div key={card.label} style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {card.label}
              </span>
              {card.icon}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent campaigns */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600 }}>Recent Campaigns</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              href="/app/campaigns/new"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px',
                background: 'var(--color-accent)',
                color: 'white',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <Plus size={13} /> New Campaign
            </Link>
            <Link
              href="/app/campaigns"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '6px 10px',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                textDecoration: 'none',
              }}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {recentCampaigns.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <Send size={32} color="var(--color-text-disabled)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>No campaigns yet</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Create your first campaign to get started
            </p>
            <Link
              href="/app/campaigns/new"
              style={{
                padding: '9px 18px',
                background: 'var(--color-accent)',
                color: 'white',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Create Campaign
            </Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Name', 'Status', 'Recipients', 'Sent', 'Failed', 'Created'].map((col) => (
                  <th key={col} style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentCampaigns.map((c, i) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: i < recentCampaigns.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      href={`/app/campaigns/${c.id}`}
                      style={{ color: 'var(--color-text-primary)', textDecoration: 'none', fontWeight: 500, fontSize: '13px' }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 8px',
                      borderRadius: '100px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: `${statusColor[c.status] ?? 'var(--color-text-muted)'}20`,
                      color: statusColor[c.status] ?? 'var(--color-text-muted)',
                    }}>
                      {c.status === 'RUNNING' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />}
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {c.totalRecipients.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-success)' }}>
                    {c.sentCount.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: c.failedCount > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                    {c.failedCount.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
