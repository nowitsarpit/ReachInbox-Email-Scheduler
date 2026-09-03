'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getContacts } from '@/lib/api';
import { Users, Search, Loader2 } from 'lucide-react';

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', { search, page }],
    queryFn: () => getContacts({ search, page: String(page) }),
  });

  const contacts = (data?.data as any[]) ?? [];
  const pagination = data?.pagination;

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Contacts</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {pagination?.total ?? 0} contacts in this organization
        </p>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search contacts..."
          style={{ width: '100%', maxWidth: '360px', padding: '8px 12px 8px 32px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '13px' }} />
      </div>

      <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <Users size={32} color="var(--color-text-disabled)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 500, marginBottom: '6px' }}>No contacts yet</p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Contacts are created automatically when you import campaign recipients
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                {['Email', 'Name', 'Company', 'Tags', 'Added'].map(c => (
                  <th key={c} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c: any, i: number) => (
                <tr key={c.id} style={{ borderBottom: i < contacts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{c.email}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>{c.company ?? '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    {c.tags?.length > 0 ? c.tags.map((t: string) => (
                      <span key={t} style={{ padding: '2px 7px', borderRadius: '100px', fontSize: '11px', background: 'var(--color-surface-3)', color: 'var(--color-text-secondary)', marginRight: '4px' }}>{t}</span>
                    )) : <span style={{ fontSize: '12px', color: 'var(--color-text-disabled)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
