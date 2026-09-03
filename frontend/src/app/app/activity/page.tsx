'use client';

import { useQuery } from '@tanstack/react-query';
import { getActivity } from '@/lib/api';
import { Activity, Loader2 } from 'lucide-react';
import { useState } from 'react';

const EVENT_COLOR: Record<string, string> = {
  sent: 'var(--color-success)',
  failed: 'var(--color-error)',
  deferred: 'var(--color-warning)',
  opened: 'var(--color-accent)',
  clicked: 'var(--color-info)',
  bounced: 'var(--color-error)',
  recovery: 'var(--color-warning)',
};

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['activity', page],
    queryFn: () => getActivity({ page: String(page), pageSize: '50' }),
    refetchInterval: 10_000, // refresh every 10s
  });

  const events = (data?.data as any[]) ?? [];
  const pagination = data?.pagination;

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Activity</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Real-time delivery event stream — refreshes every 10s</p>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Loading activity...
        </div>
      ) : events.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <Activity size={32} color="var(--color-text-disabled)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontWeight: 500, marginBottom: '6px' }}>No activity yet</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Launch a campaign to see delivery events here</p>
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Event', 'Campaign', 'Recipient', 'Timestamp', 'Details'].map(c => (
                  <th key={c} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e: any, i: number) => (
                <tr key={e.id} style={{ borderBottom: i < events.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: `${EVENT_COLOR[e.event] ?? 'var(--color-text-muted)'}22`, color: EVENT_COLOR[e.event] ?? 'var(--color-text-muted)' }}>
                      {e.event}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {e.campaign?.name ?? e.campaignId?.slice(0, 8) + '...'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                    {e.job?.recipient?.email ?? '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {new Date(e.occurredAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.metadata ? JSON.stringify(e.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', cursor: 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
            Previous
          </button>
          <span style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {page} / {pagination.totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
            style={{ padding: '6px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', cursor: 'pointer', opacity: page === pagination.totalPages ? 0.5 : 1 }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
