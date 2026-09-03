'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeam } from '@/lib/api';
import { Users, Loader2, UserCircle } from 'lucide-react';

export default function TeamPage() {
  const { data, isLoading } = useQuery({ queryKey: ['team'], queryFn: getTeam });
  const members = (data?.data as any[]) ?? [];

  const ROLE_COLORS: Record<string, string> = {
    OWNER: 'var(--color-accent)',
    ADMIN: 'var(--color-warning)',
    OPERATOR: 'var(--color-info)',
    MEMBER: 'var(--color-success)',
    VIEWER: 'var(--color-text-muted)',
  };

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Team</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading team...
          </div>
        ) : (
          <div>
            {members.map((m: any, i: number) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px',
                borderBottom: i < members.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}>
                {m.user?.avatarUrl ? (
                  <img src={m.user.avatarUrl} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
                ) : (
                  <UserCircle size={36} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>
                    {m.user?.name ?? 'Unnamed'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {m.user?.email}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
                    background: `${ROLE_COLORS[m.role] ?? 'var(--color-text-muted)'}22`,
                    color: ROLE_COLORS[m.role] ?? 'var(--color-text-muted)',
                  }}>
                    {m.role}
                  </span>
                  {m.user?.lastLoginAt && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-disabled)' }}>
                      Last login {new Date(m.user.lastLoginAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RBAC info */}
      <div style={{ marginTop: '24px', padding: '16px 20px', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Role Permissions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '12px' }}>
          {[
            { role: 'OWNER', desc: 'Full access, billing' },
            { role: 'ADMIN', desc: 'All except billing' },
            { role: 'OPERATOR', desc: 'Launch & manage campaigns' },
            { role: 'MEMBER', desc: 'Create & edit' },
            { role: 'VIEWER', desc: 'Read-only access' },
          ].map(({ role, desc }) => (
            <div key={role} style={{ padding: '10px 12px', background: 'var(--color-surface-2)', borderRadius: '6px' }}>
              <div style={{ fontWeight: 600, color: ROLE_COLORS[role], marginBottom: '3px' }}>{role}</div>
              <div style={{ color: 'var(--color-text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
