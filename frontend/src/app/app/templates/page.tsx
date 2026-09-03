'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTemplates, createTemplate } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, FileText, Loader2 } from 'lucide-react';

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', htmlBody: '', description: '' });

  const { data, isLoading } = useQuery({ queryKey: ['templates'], queryFn: getTemplates });
  const templates = (data?.data as any[]) ?? [];

  const createMutation = useMutation({
    mutationFn: () => createTemplate(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created');
      setShowForm(false);
      setForm({ name: '', subject: '', htmlBody: '', description: '' });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create template'),
  });

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Templates</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Reusable email templates with version history</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '7px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          <Plus size={15} /> New Template
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '60px', textAlign: 'center' }}>
          <FileText size={32} color="var(--color-text-disabled)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontWeight: 500, marginBottom: '6px' }}>No templates yet</p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>Create reusable email templates for your campaigns</p>
          <button onClick={() => setShowForm(true)} style={{ padding: '9px 18px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Create Template
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {templates.map((t: any) => (
            <div key={t.id} style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>{t.name}</h3>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', background: 'var(--color-surface-3)', padding: '2px 7px', borderRadius: '100px' }}>
                  v{t._count?.versions ?? 1}
                </span>
              </div>
              {t.description && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '10px' }}>{t.description}</p>}
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Subject: {t.subject ?? '—'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-disabled)', marginTop: '8px' }}>
                Updated {new Date(t.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>New Template</h2>
            {[
              { key: 'name', label: 'Template Name', placeholder: 'e.g. Welcome Email', required: true, type: 'input' },
              { key: 'description', label: 'Description', placeholder: 'What is this template for?', type: 'input' },
              { key: 'subject', label: 'Subject', placeholder: 'Welcome, {{firstName}}!', required: true, type: 'input' },
            ].map(({ key, label, placeholder, required, type }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}{required ? ' *' : ''}</label>
                <input value={form[key as keyof typeof form]} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }} />
              </div>
            ))}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>HTML Body *</label>
              <textarea value={form.htmlBody} onChange={(e) => setForm(f => ({ ...f, htmlBody: e.target.value }))} rows={10} placeholder="<p>Hello {{firstName}},</p>"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px', fontFamily: 'var(--font-mono)', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || !form.subject.trim() || !form.htmlBody.trim() || createMutation.isPending}
                style={{ padding: '9px 18px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                {createMutation.isPending ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
