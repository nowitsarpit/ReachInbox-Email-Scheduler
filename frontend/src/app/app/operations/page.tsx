'use client';

import { useQuery } from '@tanstack/react-query';
import { getOperationsStatus } from '@/lib/api';
import { Server, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function OperationsPage() {
  const qc = useQueryClient();
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['operations'],
    queryFn: getOperationsStatus,
    refetchInterval: 30_000, // poll every 30s
  });

  const ops = (data?.data as any) ?? {};

  const ServiceCard = ({ name, info }: { name: string; info: any }) => {
    if (!info) return null;
    return (
      <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{info.name ?? name}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{info.description}</div>
          </div>
          {info.healthy
            ? <CheckCircle size={20} color="var(--color-success)" />
            : <XCircle size={20} color="var(--color-error)" />}
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Status: </span>
            <span style={{ color: info.healthy ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
              {info.healthy ? 'Healthy' : 'Unhealthy'}
            </span>
          </div>
          {info.latencyMs !== undefined && (
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Latency: </span>
              <span style={{ fontWeight: 500 }}>{info.latencyMs}ms</span>
            </div>
          )}
        </div>
        {info.error && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--color-error-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', fontSize: '12px', color: 'var(--color-error)', fontFamily: 'var(--font-mono)' }}>
            {info.error}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Operations</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Real health checks — {dataUpdatedAt ? `Last checked ${new Date(dataUpdatedAt).toLocaleTimeString()}` : 'Checking...'}
          </p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['operations'] })} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Overall status banner */}
      {ops.status && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 20px', borderRadius: '10px', marginBottom: '24px',
          background: ops.status === 'operational' ? 'rgba(34,197,94,0.08)' : 'var(--color-error-dim)',
          border: `1px solid ${ops.status === 'operational' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {ops.status === 'operational'
            ? <CheckCircle size={20} color="var(--color-success)" />
            : <XCircle size={20} color="var(--color-error)" />}
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: ops.status === 'operational' ? 'var(--color-success)' : 'var(--color-error)' }}>
              {ops.status === 'operational' ? 'All Systems Operational' : 'System Degraded'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {ops.timestamp ? new Date(ops.timestamp).toLocaleString() : ''}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Running health checks...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {Object.entries(ops.services ?? {}).map(([name, info]) => (
            <ServiceCard key={name} name={name} info={info} />
          ))}
        </div>
      )}
    </div>
  );
}
