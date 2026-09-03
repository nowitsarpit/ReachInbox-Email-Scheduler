'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiKeys, createApiKey, revokeApiKey, getWebhooks } from '@/lib/api';
import toast from 'react-hot-toast';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Loader2, Webhook } from 'lucide-react';

export default function SettingsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'api-keys' | 'webhooks'>('api-keys');
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const { data: keysData, isLoading: keysLoading } = useQuery({ queryKey: ['api-keys'], queryFn: getApiKeys });
  const { data: webhooksData, isLoading: webhooksLoading } = useQuery({ queryKey: ['webhooks'], queryFn: getWebhooks });

  const apiKeys = (keysData?.data as any[]) ?? [];
  const webhooks = (webhooksData?.data as any[]) ?? [];

  const createKeyMutation = useMutation({
    mutationFn: () => createApiKey({ name: keyName.trim(), scopes: [] }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKeyValue((res.data as any).key);
      setShowKeyForm(false);
      setKeyName('');
      toast.success('API key created — copy it now!');
    },
    onError: () => toast.error('Failed to create API key'),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast.success('Key revoked'); },
    onError: () => toast.error('Failed to revoke key'),
  });

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Manage API keys and webhook integrations</p>
      </div>

      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '24px' }}>
        {(['api-keys', 'webhooks'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: activeTab === tab ? 600 : 400, fontSize: '13px', marginBottom: '-1px',
          }}>
            {tab === 'api-keys' ? 'API Keys' : 'Webhooks'}
          </button>
        ))}
      </div>

      {/* One-time key display */}
      {newKeyValue && (
        <div style={{ padding: '16px 20px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)', marginBottom: '10px' }}>
            ⚠ Copy your API key now — it will not be shown again
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <code style={{ flex: 1, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: showKey ? 'var(--color-text-primary)' : 'transparent', textShadow: showKey ? 'none' : '0 0 10px var(--color-text-primary)', userSelect: 'all' }}>
              {newKeyValue}
            </code>
            <button onClick={() => setShowKey(s => !s)} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }} title={showKey ? 'Hide' : 'Show'}>
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={() => { navigator.clipboard.writeText(newKeyValue); toast.success('Copied!'); }} style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)' }} title="Copy to clipboard">
              <Copy size={16} />
            </button>
          </div>
          <button onClick={() => setNewKeyValue(null)} style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Dismiss (key will no longer be shown)
          </button>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button onClick={() => setShowKeyForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '7px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              <Plus size={15} /> Create API Key
            </button>
          </div>

          <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            {keysLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                Loading...
              </div>
            ) : apiKeys.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <Key size={28} color="var(--color-text-disabled)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontWeight: 500 }}>No API keys</p>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Create a key to access the GoMAil API programmatically</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    {['Name', 'Prefix', 'Scopes', 'Last Used', 'Expires', ''].map(c => (
                      <th key={c} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k: any, i: number) => (
                    <tr key={k.id} style={{ borderBottom: i < apiKeys.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 500 }}>{k.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{k.prefix}...</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>{k.scopes?.join(', ') || 'All'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-text-muted)' }}>{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => { if (confirm('Revoke this API key? This cannot be undone.')) revokeKeyMutation.mutate(k.id); }}
                          style={{ padding: '5px', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px', display: 'flex' }} title="Revoke key">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div>
          <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            {webhooksLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
            ) : webhooks.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <Webhook size={28} color="var(--color-text-disabled)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontWeight: 500 }}>No webhooks configured</p>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Webhook creation coming soon</p>
              </div>
            ) : (
              <div style={{ padding: '16px' }}>
                {webhooks.map((w: any) => (
                  <div key={w.id} style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{w.url}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Events: {w.events.join(', ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Key Modal */}
      {showKeyForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Create API Key</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Key Name</label>
              <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. CI/CD Deployment" autoFocus
                style={{ width: '100%', padding: '9px 12px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowKeyForm(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => createKeyMutation.mutate()} disabled={!keyName.trim() || createKeyMutation.isPending}
                style={{ padding: '9px 18px', background: 'var(--color-accent)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: !keyName.trim() ? 0.7 : 1 }}>
                {createKeyMutation.isPending ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
