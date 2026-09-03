'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Mail, LayoutDashboard, Send, Users, Settings,
  Activity, BarChart3, Server, Key, Webhook,
  ChevronDown, LogOut, UserCircle, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/campaigns', label: 'Campaigns', icon: Send },
  { href: '/app/contacts', label: 'Contacts', icon: Users },
  { href: '/app/senders', label: 'Senders', icon: Mail },
  { href: '/app/templates', label: 'Templates', icon: Mail },
  { href: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/app/activity', label: 'Activity', icon: Activity },
  { href: '/app/operations', label: 'Operations', icon: Server },
  { href: '/app/team', label: 'Team', icon: Users },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, organization, role } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace('/login');
      toast.success('Signed out successfully');
    },
    onError: () => toast.error('Failed to sign out'),
  });

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          width: '28px', height: '28px',
          background: 'var(--color-accent)',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Mail size={14} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.01em' }}>GoMAil</div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
            PLAN · DELIVER · OBSERVE
          </div>
        </div>
      </div>

      {/* Org context */}
      {organization && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: '12px',
        }}>
          <div style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>Organization</div>
          <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {organization.name}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-accent-text)', marginTop: '2px' }}>{role}</div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                marginBottom: '1px',
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: active ? 'var(--color-surface-3)' : 'transparent',
                fontWeight: active ? 500 : 400,
                fontSize: '13px',
                textDecoration: 'none',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              <Icon size={15} />
              {item.label}
              {active && (
                <div style={{
                  width: '4px', height: '4px',
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  marginLeft: 'auto',
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--color-border-subtle)', position: 'relative' }}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-primary)',
          }}
          aria-label="User menu"
          id="user-menu-btn"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
          ) : (
            <UserCircle size={28} color="var(--color-text-muted)" />
          )}
          <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name ?? user?.email ?? 'User'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <ChevronDown size={14} color="var(--color-text-muted)" />
        </button>

        {userMenuOpen && (
          <div style={{
            position: 'absolute',
            bottom: '56px',
            left: '8px',
            right: '8px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            zIndex: 50,
          }}>
            <Link href="/app/settings" onClick={() => setUserMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', fontSize: '13px',
              color: 'var(--color-text-secondary)', textDecoration: 'none',
            }}>
              <Settings size={14} /> Settings
            </Link>
            <button
              onClick={() => { setUserMenuOpen(false); logoutMutation.mutate(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', fontSize: '13px',
                color: 'var(--color-error)', background: 'none',
                border: 'none', cursor: 'pointer', borderTop: '1px solid var(--color-border-subtle)',
              }}
              id="logout-btn"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: '220px',
        flexShrink: 0,
        background: 'var(--color-surface-1)',
        borderRight: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
        }}>
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
          }} onClick={() => setSidebarOpen(false)} />
          <aside style={{
            position: 'relative', width: '260px',
            background: 'var(--color-surface-1)',
            borderRight: '1px solid var(--color-border)',
            zIndex: 1,
          }}>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'absolute', top: '12px', right: '12px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)',
              }}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile top bar */}
        <div style={{
          display: 'none', // shown on mobile via media query; handled by CSS
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--color-surface-1)',
        }} className="mobile-header">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>GoMAil</span>
          <div style={{ width: '20px' }} />
        </div>

        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--color-surface-0)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
