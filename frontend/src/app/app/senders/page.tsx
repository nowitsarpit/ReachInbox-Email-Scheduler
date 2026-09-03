'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSenders, createSender, deleteSender } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Mail, Loader2 } from 'lucide-react';

export default function SendersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', replyTo: '', hourlyLimit: '' });

  const { data, isLoading } = useQuery({ queryKey: ['senders'], queryFn: getSenders });
  const senders = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => createSender({
      name: form.name.trim(), email: form.email.trim(),
      replyTo: form.replyTo.trim() || undefined,
      hourlyLimit: form.hourlyLimit ? Number(form.hourlyLimit) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['senders'] }); toast.success('Sender created'); setShowForm(false); setForm({ name: '', email: '', replyTo: '', hourlyLimit: '' }); },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create sender'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSender,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['senders'] }); toast.success('Sender deleted'); },
    onError: (e: any) => toast.error(e?.message ?? 'Cannot delete sender in use'),
  });

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Senders</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Manage From addresses for your campaigns</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '7px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          <Plus size={15} /> Add Sender
        </button>
      </div>

      <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading senders...
          </div>
        ) : senders.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Mail size={32} color="var(--color-text-disabled)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 500, marginBottom: '6px' }}>No senders yet</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Add a sender address to use in campaigns</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Name', 'Email', 'Reply-To', 'Hourly Limit', 'Status', ''].map(c => (
                  <th key={c} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {senders.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < senders.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{s.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{s.replyTo ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{s.hourlyLimit ? `${s.hourlyLimit}/hr` : 'Unlimited'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: s.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'var(--color-surface-3)', color: s.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => { if (confirm('Delete this sender?')) deleteMutation.mutate(s.id); }} style={{ padding: '5px', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', display: 'flex' }} title="Delete sender">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '440px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Add Sender</h2>
            {[
              { key: 'name', label: 'Display Name', placeholder: 'e.g. GoMAil Newsletter', required: true },
              { key: 'email', label: 'Email Address', placeholder: 'newsletter@yourdomain.com', required: true },
              { key: 'replyTo', label: 'Reply-To (optional)', placeholder: 'replies@yourdomain.com' },
              { key: 'hourlyLimit', label: 'Hourly Limit (optional)', placeholder: 'e.g. 1000 (blank = unlimited)' },
            ].map(({ key, label, placeholder, required }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {label}
                </label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  type={key === 'hourlyLimit' ? 'number' : key === 'email' || key === 'replyTo' ? 'email' : 'text'}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || !form.email.trim() || createMutation.isPending}
                style={{ padding: '9px 18px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: !form.name.trim() || !form.email.trim() || createMutation.isPending ? 0.7 : 1 }}>
                {createMutation.isPending ? 'Creating...' : 'Add Sender'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
