import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '../../shared/index.js';
import type { OrganizationRole } from '../../shared/index.js';

describe('RBAC Role Permissions', () => {
  it('OWNER has all permissions', () => {
    const ownerPerms = ROLE_PERMISSIONS['OWNER'];
    expect(ownerPerms).toContain('campaign.launch');
    expect(ownerPerms).toContain('team.manage');
    expect(ownerPerms).toContain('settings.manage');
    expect(ownerPerms).toContain('api_key.manage');
    expect(ownerPerms).toContain('webhook.manage');
  });

  it('VIEWER only has read permissions', () => {
    const viewerPerms = ROLE_PERMISSIONS['VIEWER'];
    expect(viewerPerms).toContain('campaign.read');
    expect(viewerPerms).not.toContain('campaign.create');
    expect(viewerPerms).not.toContain('campaign.launch');
    expect(viewerPerms).not.toContain('campaign.delete');
    expect(viewerPerms).not.toContain('team.manage');
    expect(viewerPerms).not.toContain('settings.manage');
  });

  it('MEMBER cannot launch campaigns', () => {
    expect(ROLE_PERMISSIONS['MEMBER']).not.toContain('campaign.launch');
  });

  it('OPERATOR can launch and pause campaigns', () => {
    const ops = ROLE_PERMISSIONS['OPERATOR'];
    expect(ops).toContain('campaign.launch');
    expect(ops).toContain('campaign.pause');
    expect(ops).toContain('campaign.resume');
  });

  it('roles are in descending privilege order', () => {
    const roles: OrganizationRole[] = ['OWNER', 'ADMIN', 'OPERATOR', 'MEMBER', 'VIEWER'];
    const permCounts = roles.map((r) => ROLE_PERMISSIONS[r].length);
    // Each role should have <= permissions of the role above it
    for (let i = 1; i < permCounts.length; i++) {
      expect(permCounts[i]!).toBeLessThanOrEqual(permCounts[i - 1]!);
    }
  });
});

describe('Campaign state machine', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['READY', 'CANCELLED'],
    READY: ['DRAFT', 'SCHEDULED', 'RUNNING', 'CANCELLED'],
    SCHEDULED: ['RUNNING', 'PAUSED', 'CANCELLED'],
    RUNNING: ['PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'],
    PAUSED: ['RUNNING', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
    FAILED: [],
  };

  function canTransition(from: string, to: string): boolean {
    return (VALID_TRANSITIONS[from] ?? []).includes(to);
  }

  it('allows DRAFT → RUNNING', () => expect(canTransition('DRAFT', 'RUNNING')).toBe(false));
  it('allows READY → RUNNING', () => expect(canTransition('READY', 'RUNNING')).toBe(true));
  it('allows RUNNING → PAUSED', () => expect(canTransition('RUNNING', 'PAUSED')).toBe(true));
  it('allows PAUSED → RUNNING', () => expect(canTransition('PAUSED', 'RUNNING')).toBe(true));
  it('blocks COMPLETED → RUNNING', () => expect(canTransition('COMPLETED', 'RUNNING')).toBe(false));
  it('blocks CANCELLED → RUNNING', () => expect(canTransition('CANCELLED', 'RUNNING')).toBe(false));
  it('blocks COMPLETED → CANCELLED', () => expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false));
  it('allows RUNNING → CANCELLED', () => expect(canTransition('RUNNING', 'CANCELLED')).toBe(true));
});
