// ─── Campaign Types ───────────────────────────────────────────────────────────
export type CampaignStatus =
  | 'DRAFT'
  | 'READY'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type DeliveryMode = 'IMMEDIATE' | 'FIXED_GAP';

// ─── Recipient Types ──────────────────────────────────────────────────────────
export type RecipientStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'DEFERRED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'SUPPRESSED';

// ─── Suppression Types ────────────────────────────────────────────────────────
export type SuppressionReason =
  | 'UNSUBSCRIBED'
  | 'BOUNCED'
  | 'BLOCKED'
  | 'MANUAL'
  | 'COMPLAINT';

// ─── RBAC Types ───────────────────────────────────────────────────────────────
export type OrganizationRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'MEMBER' | 'VIEWER';

export type Permission =
  | 'campaign.read'
  | 'campaign.create'
  | 'campaign.update'
  | 'campaign.launch'
  | 'campaign.pause'
  | 'campaign.resume'
  | 'campaign.cancel'
  | 'campaign.delete'
  | 'contacts.read'
  | 'contacts.manage'
  | 'sender.read'
  | 'sender.manage'
  | 'template.read'
  | 'template.manage'
  | 'analytics.view'
  | 'operations.view'
  | 'activity.view'
  | 'team.read'
  | 'team.manage'
  | 'settings.read'
  | 'settings.manage'
  | 'api_key.read'
  | 'api_key.manage'
  | 'webhook.read'
  | 'webhook.manage';

export const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  OWNER: [
    'campaign.read', 'campaign.create', 'campaign.update', 'campaign.launch',
    'campaign.pause', 'campaign.resume', 'campaign.cancel', 'campaign.delete',
    'contacts.read', 'contacts.manage',
    'sender.read', 'sender.manage',
    'template.read', 'template.manage',
    'analytics.view', 'operations.view', 'activity.view',
    'team.read', 'team.manage',
    'settings.read', 'settings.manage',
    'api_key.read', 'api_key.manage',
    'webhook.read', 'webhook.manage',
  ],
  ADMIN: [
    'campaign.read', 'campaign.create', 'campaign.update', 'campaign.launch',
    'campaign.pause', 'campaign.resume', 'campaign.cancel', 'campaign.delete',
    'contacts.read', 'contacts.manage',
    'sender.read', 'sender.manage',
    'template.read', 'template.manage',
    'analytics.view', 'operations.view', 'activity.view',
    'team.read', 'team.manage',
    'settings.read',
    'api_key.read', 'api_key.manage',
    'webhook.read', 'webhook.manage',
  ],
  OPERATOR: [
    'campaign.read', 'campaign.create', 'campaign.update', 'campaign.launch',
    'campaign.pause', 'campaign.resume', 'campaign.cancel',
    'contacts.read', 'contacts.manage',
    'sender.read',
    'template.read', 'template.manage',
    'analytics.view', 'operations.view', 'activity.view',
    'team.read',
    'api_key.read',
    'webhook.read',
  ],
  MEMBER: [
    'campaign.read', 'campaign.create', 'campaign.update',
    'contacts.read',
    'sender.read',
    'template.read', 'template.manage',
    'analytics.view', 'activity.view',
    'team.read',
  ],
  VIEWER: [
    'campaign.read',
    'contacts.read',
    'sender.read',
    'template.read',
    'analytics.view', 'activity.view',
    'team.read',
  ],
};

// ─── Audit Log Types ──────────────────────────────────────────────────────────
export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'campaign.created'
  | 'campaign.updated'
  | 'campaign.launched'
  | 'campaign.paused'
  | 'campaign.resumed'
  | 'campaign.cancelled'
  | 'campaign.deleted'
  | 'recipient.imported'
  | 'sender.created'
  | 'sender.updated'
  | 'sender.deleted'
  | 'template.created'
  | 'template.updated'
  | 'template.deleted'
  | 'team.member_invited'
  | 'team.member_removed'
  | 'team.role_changed'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'webhook.created'
  | 'webhook.updated'
  | 'webhook.deleted'
  | 'settings.updated';

// ─── Webhook Event Types ──────────────────────────────────────────────────────
export type WebhookEventType =
  | 'campaign.created'
  | 'campaign.started'
  | 'campaign.completed'
  | 'campaign.paused'
  | 'campaign.cancelled'
  | 'delivery.sent'
  | 'delivery.failed'
  | 'delivery.deferred';

// ─── Delivery Job Types ───────────────────────────────────────────────────────
export type DeliveryJobStatus =
  | 'QUEUED'
  | 'SCHEDULED'
  | 'DEFERRED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED';

// ─── API Response Types ───────────────────────────────────────────────────────
export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ─── Personalization ──────────────────────────────────────────────────────────
export const PERSONALIZATION_VARS = ['firstName', 'lastName', 'company', 'email'] as const;
export type PersonalizationVar = (typeof PERSONALIZATION_VARS)[number];

// ─── Queue Names ──────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  DELIVERY: 'gomail:delivery',
  WEBHOOK: 'gomail:webhook',
  OUTBOX: 'gomail:outbox',
} as const;

// ─── BullMQ Job Names ─────────────────────────────────────────────────────────
export const JOB_NAMES = {
  SEND_EMAIL: 'send-email',
  DELIVER_WEBHOOK: 'deliver-webhook',
  PROCESS_OUTBOX: 'process-outbox',
} as const;
