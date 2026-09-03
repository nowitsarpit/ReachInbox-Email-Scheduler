'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCampaigns, createCampaign, deleteCampaign, launchCampaign, pauseCampaign, resumeCampaign, cancelCampaign } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Search, Send, Pause, Play, X, Trash2, Eye, Loader2 } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--color-text-muted)',
  READY: 'var(--color-info)',
  RUNNING: 'var(--color-accent)',
  PAUSED: 'var(--color-warning)',
  COMPLETED: 'var(--color-success)',
  CANCELLED: 'var(--color-text-disabled)',
  FAILED: 'var(--color-error)',
  SCHEDULED: 'var(--color-info)',
};

export default function CampaignsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', { search, status: statusFilter, page }],
    queryFn: () => getCampaigns({ search, status: statusFilter, page, pageSize: 20 }),
  });

  const campaigns = data?.data ?? [];
  const pagination = data?.pagination;

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign created');
      setShowNew(false);
      setNewName('');
      setNewDesc('');
      router.push(`/app/campaigns/${res.data.id}`);
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      if (action === 'launch') return launchCampaign(id);
      if (action === 'pause') return pauseCampaign(id);
      if (action === 'resume') return resumeCampaign(id);
      if (action === 'cancel') return cancelCampaign(id);
      if (action === 'delete') return deleteCampaign(id);
      throw new Error('Unknown action');
    },
    onSuccess: (_r, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Campaign ${action}ed successfully`);
    },
    onError: (err: any) => toast.error(err?.message ?? 'Action failed'),
  });

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Campaigns</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {pagination?.total ?? 0} campaigns total
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 16px',
            background: 'var(--color-accent)', color: 'white',
            border: 'none', borderRadius: '7px', fontWeight: 600, fontSize: '13px',
            cursor: 'pointer',
          }}
          id="new-campaign-btn"
        >
          <Plus size={15} /> New Campaign
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search campaigns..."
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
              borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 12px', background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)', borderRadius: '6px',
            color: 'var(--color-text-primary)', fontSize: '13px', minWidth: '140px',
          }}
        >
          <option value="">All statuses</option>
          {['DRAFT','READY','RUNNING','PAUSED','COMPLETED','CANCELLED','FAILED'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 10px', display: 'block' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Send size={32} color="var(--color-text-disabled)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 500, marginBottom: '6px' }}>No campaigns found</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {search || statusFilter ? 'Try adjusting your filters' : 'Create your first campaign'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Campaign', 'Status', 'Recipients', 'Progress', 'Created', 'Actions'].map(col => (
                  <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const pct = c.totalRecipients > 0
                  ? Math.round((c.sentCount + c.failedCount) / c.totalRecipients * 100)
                  : 0;
                return (
                  <tr key={c.id} style={{ borderBottom: i < campaigns.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/app/campaigns/${c.id}`} style={{ color: 'var(--color-text-primary)', textDecoration: 'none', fontWeight: 500, fontSize: '13px' }}>
                        {c.name}
                      </Link>
                      {c.description && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{c.description}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
                        background: `${STATUS_COLOR[c.status]}22`, color: STATUS_COLOR[c.status],
                      }}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {c.totalRecipients.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', minWidth: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: 'var(--color-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-accent)', borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', minWidth: '28px' }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Link href={`/app/campaigns/${c.id}`} title="View" style={{ padding: '5px', color: 'var(--color-text-muted)', display: 'flex', borderRadius: '4px' }}>
                          <Eye size={14} />
                        </Link>
                        {c.status === 'RUNNING' && (
                          <button onClick={() => actionMutation.mutate({ id: c.id, action: 'pause' })} title="Pause" style={{ padding: '5px', color: 'var(--color-warning)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}>
                            <Pause size={14} />
                          </button>
                        )}
                        {c.status === 'PAUSED' && (
                          <button onClick={() => actionMutation.mutate({ id: c.id, action: 'resume' })} title="Resume" style={{ padding: '5px', color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}>
                            <Play size={14} />
                          </button>
                        )}
                        {['RUNNING', 'PAUSED', 'SCHEDULED', 'READY'].includes(c.status) && (
                          <button onClick={() => { if (confirm('Cancel this campaign?')) actionMutation.mutate({ id: c.id, action: 'cancel' }); }} title="Cancel" style={{ padding: '5px', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}>
                            <X size={14} />
                          </button>
                        )}
                        {['DRAFT', 'COMPLETED', 'CANCELLED', 'FAILED'].includes(c.status) && (
                          <button onClick={() => { if (confirm('Delete this campaign?')) actionMutation.mutate({ id: c.id, action: 'delete' }); }} title="Delete" style={{ padding: '5px', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '6px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
            Previous
          </button>
          <span style={{ padding: '6px 12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Page {page} of {pagination.totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
            style={{ padding: '6px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer', opacity: page === pagination.totalPages ? 0.5 : 1 }}>
            Next
          </button>
        </div>
      )}

      {/* New Campaign Modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>New Campaign</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Campaign Name *
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Q3 Product Launch"
                autoFocus
                style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }}
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Description (optional)
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                placeholder="What's this campaign about?"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({ name: newName.trim(), description: newDesc.trim() || undefined })}
                disabled={!newName.trim() || createMutation.isPending}
                style={{ padding: '9px 18px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: !newName.trim() || createMutation.isPending ? 0.7 : 1 }}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
