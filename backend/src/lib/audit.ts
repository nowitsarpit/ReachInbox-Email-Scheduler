import { prisma } from './prisma.js';
import type { AuditAction } from '@gomail/shared';

export interface AuditLogEntry {
  organizationId: string;
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Persist an audit log entry.
 * Non-blocking — errors are logged but don't fail the request.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata as object | undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (err) {
    // Audit logging must never break the application
    console.error('[Audit] Failed to write audit log:', err);
  }
}
