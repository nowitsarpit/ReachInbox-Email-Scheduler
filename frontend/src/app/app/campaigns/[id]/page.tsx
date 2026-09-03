'use client';

import { useState, useEffect, useRef } from 'react';
import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCampaign, updateCampaign, launchCampaign, pauseCampaign, resumeCampaign,
  cancelCampaign, getSenders, importRecipients, getCampaignRecipients
} from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Send, Pause, Play, X, Save, Upload,
  ChevronDown, AlertCircle, CheckCircle, Clock, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'var(--color-text-muted)', READY: 'var(--color-info)', RUNNING: 'var(--color-accent)',
  PAUSED: 'var(--color-warning)', COMPLETED: 'var(--color-success)',
  CANCELLED: 'var(--color-text-disabled)', FAILED: 'var(--color-error)',
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'content' | 'recipients' | 'progress'>('content');
  const [localForm, setLocalForm] = useState({ name: '', subject: '', htmlBody: '', textBody: '', senderId: '', deliveryMode: 'IMMEDIATE' as string, delayMs: 0 });
  const [importMode, setImportMode] = useState<'paste' | 'file'>('paste');
  const [pastedEmails, setPastedEmails] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const sseRef = useRef<EventSource | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id),
  });

  const campaign = data?.data;

  const { data: sendersData } = useQuery({ queryKey: ['senders'], queryFn: getSenders });
  const senders = sendersData?.data ?? [];

  const { data: recipientsData } = useQuery({
    queryKey: ['campaign-recipients', id],
    queryFn: () => getCampaignRecipients(id),
    enabled: activeTab === 'recipients',
  });

  useEffect(() => {
    if (campaign) {
      setLocalForm({
        name: campaign.name,
        subject: campaign.subject ?? '',
        htmlBody: campaign.htmlBody ?? '',
        textBody: '',
        senderId: campaign.senderId ?? '',
        deliveryMode: campaign.deliveryMode ?? 'IMMEDIATE',
        delayMs: campaign.delayMs ?? 1000,
      });
    }
  }, [campaign?.id]);

  // SSE for live progress
  useEffect(() => {
    if (activeTab !== 'progress' || !campaign || !['RUNNING', 'PAUSED'].includes(campaign.status)) return;
    const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
    const es = new EventSource(`${API}/api/v1/campaigns/${id}/progress`, { withCredentials: true });
    es.onmessage = (e) => { try { setProgress(JSON.parse(e.data)); } catch {} };
    sseRef.current = es;
    return () => { es.close(); sseRef.current = null; };
  }, [activeTab, campaign?.status]);

  const saveMutation = useMutation({
    mutationFn: () => updateCampaign(id, {
      name: localForm.name, subject: localForm.subject,
      htmlBody: localForm.htmlBody,
      senderId: localForm.senderId || undefined,
      deliveryMode: localForm.deliveryMode as any,
      delayMs: localForm.delayMs > 0 ? localForm.delayMs : undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['campaign', id] }); toast.success('Campaign saved'); },
    onError: (e: any) => toast.error(e?.message ?? 'Save failed'),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'launch') return launchCampaign(id);
      if (action === 'pause') return pauseCampaign(id);
      if (action === 'resume') return resumeCampaign(id);
      if (action === 'cancel') return cancelCampaign(id);
      throw new Error('Unknown');
    },
    onSuccess: (_r, action) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Campaign ${action}ed`);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Action failed'),
  });

  const importMutation = useMutation({
    mutationFn: () => importRecipients(id, importMode === 'file' ? importFile : null, importMode === 'paste' ? pastedEmails : undefined),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-recipients', id] });
      const d = res.data;
      toast.success(`Imported ${d.inserted} recipients${d.suppressed > 0 ? `, ${d.suppressed} suppressed` : ''}${d.invalid > 0 ? `, ${d.invalid} invalid` : ''}`);
      setPastedEmails('');
      setImportFile(null);
    },
    onError: (e: any) => toast.error(e?.message ?? 'Import failed'),
  });

  if (isLoading) return (
    <div style={{ padding: '32px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Loading campaign...
    </div>
  );

  if (!campaign) return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <AlertCircle size={32} color="var(--color-error)" style={{ margin: '0 auto 12px', display: 'block' }} />
      <p>Campaign not found</p>
      <Link href="/app/campaigns" style={{ color: 'var(--color-accent)', fontSize: '13px' }}>← Back to campaigns</Link>
    </div>
  );

  const isEditable = ['DRAFT', 'READY'].includes(campaign.status);
  const pct = campaign.totalRecipients > 0
    ? Math.round((campaign.sentCount + campaign.failedCount + campaign.cancelledCount) / campaign.totalRecipients * 100)
    : 0;

  return (
    <div style={{ padding: '32px', maxWidth: '1000px' }}>
      {/* Back + Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link href="/app/campaigns" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)', fontSize: '13px', textDecoration: 'none', marginBottom: '12px' }}>
          <ArrowLeft size={14} /> Campaigns
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>{campaign.name}</h1>
            <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 600, background: `${STATUS_COLOR[campaign.status]}22`, color: STATUS_COLOR[campaign.status] }}>
              {campaign.status}
            </span>
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {isEditable && (
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', cursor: 'pointer' }}>
                <Save size={13} /> {saveMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            )}
            {['DRAFT', 'READY'].includes(campaign.status) && (
              <button onClick={() => actionMutation.mutate('launch')} disabled={actionMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                <Send size={13} /> Launch
              </button>
            )}
            {campaign.status === 'RUNNING' && (
              <button onClick={() => actionMutation.mutate('pause')} disabled={actionMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--color-warning-dim)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: 'var(--color-warning)', fontSize: '13px', cursor: 'pointer' }}>
                <Pause size={13} /> Pause
              </button>
            )}
            {campaign.status === 'PAUSED' && (
              <button onClick={() => actionMutation.mutate('resume')} disabled={actionMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', cursor: 'pointer' }}>
                <Play size={13} /> Resume
              </button>
            )}
            {['RUNNING', 'PAUSED', 'SCHEDULED'].includes(campaign.status) && (
              <button onClick={() => { if (confirm('Cancel this campaign? This cannot be undone.')) actionMutation.mutate('cancel'); }} disabled={actionMutation.isPending}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--color-error-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: 'var(--color-error)', fontSize: '13px', cursor: 'pointer' }}>
                <X size={13} /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {campaign.totalRecipients > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
              <span>{(campaign.sentCount + campaign.failedCount).toLocaleString()} / {campaign.totalRecipients.toLocaleString()} processed ({pct}%)</span>
              <span style={{ color: 'var(--color-success)' }}>{campaign.sentCount.toLocaleString()} sent</span>
            </div>
            <div style={{ height: '6px', background: 'var(--color-surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-accent)', borderRadius: '3px', transition: 'width 0.5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '24px' }}>
        {(['content', 'recipients', 'progress'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: activeTab === tab ? 600 : 400, fontSize: '13px', marginBottom: '-1px',
            textTransform: 'capitalize',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Content */}
      {activeTab === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</label>
            <input disabled={!isEditable} value={localForm.name} onChange={(e) => setLocalForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px', opacity: isEditable ? 1 : 0.7 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sender</label>
            <select disabled={!isEditable} value={localForm.senderId} onChange={(e) => setLocalForm(f => ({ ...f, senderId: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px', opacity: isEditable ? 1 : 0.7 }}>
              <option value="">Select a sender...</option>
              {senders.map((s) => <option key={s.id} value={s.id}>{s.name} &lt;{s.email}&gt;</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject</label>
            <input disabled={!isEditable} value={localForm.subject} onChange={(e) => setLocalForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Hello {{firstName}}, here's your update" style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px', opacity: isEditable ? 1 : 0.7 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              HTML Body — supports {'{{firstName}}, {{lastName}}, {{email}}, {{company}}'}
            </label>
            <textarea disabled={!isEditable} value={localForm.htmlBody} onChange={(e) => setLocalForm(f => ({ ...f, htmlBody: e.target.value }))}
              rows={14} placeholder="<p>Hello {{firstName}},</p><p>Your message here...</p>"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', fontFamily: 'var(--font-mono)', resize: 'vertical', opacity: isEditable ? 1 : 0.7 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivery Mode</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select disabled={!isEditable} value={localForm.deliveryMode} onChange={(e) => setLocalForm(f => ({ ...f, deliveryMode: e.target.value }))}
                style={{ flex: 1, padding: '9px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px', opacity: isEditable ? 1 : 0.7 }}>
                <option value="IMMEDIATE">Immediate (burst)</option>
                <option value="FIXED_GAP">Fixed Gap (throttled)</option>
              </select>
              {localForm.deliveryMode === 'FIXED_GAP' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" min={100} step={100} disabled={!isEditable} value={localForm.delayMs}
                    onChange={(e) => setLocalForm(f => ({ ...f, delayMs: Number(e.target.value) }))}
                    style={{ width: '100px', padding: '9px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }} />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>ms gap</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Recipients */}
      {activeTab === 'recipients' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Import Recipients</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button onClick={() => setImportMode('paste')} style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${importMode === 'paste' ? 'var(--color-accent)' : 'var(--color-border)'}`, background: importMode === 'paste' ? 'var(--color-accent-dim)' : 'none', color: importMode === 'paste' ? 'var(--color-accent-text)' : 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                Paste emails
              </button>
              <button onClick={() => setImportMode('file')} style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${importMode === 'file' ? 'var(--color-accent)' : 'var(--color-border)'}`, background: importMode === 'file' ? 'var(--color-accent-dim)' : 'none', color: importMode === 'file' ? 'var(--color-accent-text)' : 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                Upload CSV
              </button>
            </div>
            {importMode === 'paste' ? (
              <textarea value={pastedEmails} onChange={(e) => setPastedEmails(e.target.value)}
                rows={6} placeholder="one@example.com&#10;two@example.com&#10;three@example.com"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', fontFamily: 'var(--font-mono)', resize: 'vertical' }} />
            ) : (
              <div style={{ border: '2px dashed var(--color-border)', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
                <Upload size={24} color="var(--color-text-muted)" style={{ margin: '0 auto 8px', display: 'block' }} />
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                  CSV file with email, firstName, lastName, company columns
                </p>
                <input type="file" accept=".csv,.txt" id="csv-upload"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  style={{ display: 'none' }} />
                <label htmlFor="csv-upload" style={{ padding: '7px 14px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                  {importFile ? importFile.name : 'Choose File'}
                </label>
              </div>
            )}
            <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || (importMode === 'paste' ? !pastedEmails.trim() : !importFile)}
              style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: importMutation.isPending ? 0.7 : 1 }}>
              <Upload size={13} /> {importMutation.isPending ? 'Importing...' : 'Import'}
            </button>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            {campaign.totalRecipients.toLocaleString()} total recipients
          </div>
          {recipientsData?.data && (recipientsData.data as any[]).length > 0 && (
            <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {['Email', 'Name', 'Status'].map(c => (
                      <th key={c} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(recipientsData.data as any[]).slice(0, 50).map((r: any, i: number) => (
                    <tr key={r.id} style={{ borderBottom: i < 49 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                      <td style={{ padding: '9px 14px', fontSize: '13px' }}>{r.email}</td>
                      <td style={{ padding: '9px 14px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: `${STATUS_COLOR[r.status] ?? 'var(--color-text-muted)'}22`, color: STATUS_COLOR[r.status] ?? 'var(--color-text-muted)' }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Progress */}
      {activeTab === 'progress' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Sent', value: (progress ?? campaign).sentCount, color: 'var(--color-success)' },
              { label: 'Failed', value: (progress ?? campaign).failedCount, color: 'var(--color-error)' },
              { label: 'Pending', value: (progress ?? campaign).pendingCount, color: 'var(--color-text-muted)' },
              { label: 'Deferred', value: (progress ?? campaign).deferredCount, color: 'var(--color-warning)' },
              { label: 'Cancelled', value: (progress ?? campaign).cancelledCount, color: 'var(--color-text-disabled)' },
              { label: 'Total', value: campaign.totalRecipients, color: 'var(--color-text-primary)' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>{s.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{(s.value ?? 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
          {['RUNNING', 'PAUSED'].includes(campaign.status) && (
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Live — updating every 2 seconds
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
