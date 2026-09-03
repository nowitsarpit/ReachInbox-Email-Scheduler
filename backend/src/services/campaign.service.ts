import { prisma } from '../lib/prisma.js';
import { createOutboxEvent } from '../lib/outbox.js';
import { writeAuditLog } from '../lib/audit.js';
import { AppError, NotFoundError } from '../middleware/errorHandler.js';
import { enqueueDeliveryJob } from '../lib/bullmq.js';
import { findUnknownPersonalizationVars } from '../lib/sanitize.js';
import { PERSONALIZATION_VARS } from '@gomail/shared';
import type { AuthenticatedUser } from '../middleware/auth.js';

type Campaign = Awaited<ReturnType<typeof prisma.campaign.findFirst>> & object;

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

export class CampaignService {
  private assertTransition(from: string, to: string): void {
    const valid = VALID_TRANSITIONS[from] ?? [];
    if (!valid.includes(to)) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION',
        `Cannot transition campaign from ${from} to ${to}`);
    }
  }

  private async getCampaignForOrg(campaignId: string, organizationId: string): Promise<Campaign> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId, deletedAt: null },
    });
    if (!campaign) throw new NotFoundError('Campaign');
    return campaign;
  }

  /**
   * Launch a campaign. Validates readiness, enqueues delivery jobs via outbox.
   */
  async launch(campaignId: string, user: AuthenticatedUser): Promise<Campaign> {
    const campaign = await this.getCampaignForOrg(campaignId, user.organizationId);

    // Validate campaign readiness
    if (!campaign.subject || !campaign.htmlBody) {
      throw new AppError(422, 'CAMPAIGN_INCOMPLETE', 'Campaign must have a subject and HTML body before launching');
    }
    if (!campaign.senderId) {
      throw new AppError(422, 'CAMPAIGN_INCOMPLETE', 'Campaign must have a sender selected before launching');
    }

    // Verify sender exists and is active
    const sender = await prisma.sender.findFirst({
      where: { id: campaign.senderId, organizationId: user.organizationId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!sender) {
      throw new AppError(422, 'SENDER_INVALID', 'Selected sender is not active or does not exist');
    }

    // Check recipient count
    const recipientCount = await prisma.campaignRecipient.count({
      where: { campaignId, status: 'PENDING' },
    });
    if (recipientCount === 0) {
      throw new AppError(422, 'NO_RECIPIENTS', 'Campaign has no pending recipients');
    }

    // Validate personalization variables
    const unknownVars = findUnknownPersonalizationVars(
      campaign.htmlBody + ' ' + campaign.subject,
      PERSONALIZATION_VARS as unknown as string[]
    );
    if (unknownVars.length > 0) {
      throw new AppError(422, 'INVALID_PERSONALIZATION',
        `Unknown personalization variables: ${unknownVars.join(', ')}`);
    }

    // Determine delivery mode and schedule
    const now = new Date();
    const isFixedGap = campaign.deliveryMode === 'FIXED_GAP';
    const delayMs = campaign.delayMs ?? 0;

    // State transition: DRAFT/READY → RUNNING (or SCHEDULED)
    const allowedFrom = ['DRAFT', 'READY'];
    if (!allowedFrom.includes(campaign.status)) {
      this.assertTransition(campaign.status, 'RUNNING');
    }

    // All recipients that are PENDING
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId, status: 'PENDING' },
      select: { id: true, idempotencyKey: true },
    });

    // Transactional: update campaign status + create outbox events
    const launched = await prisma.$transaction(async (tx) => {
      const updated = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'RUNNING',
          startedAt: now,
          scheduledAt: now,
          pendingCount: recipients.length,
          totalRecipients: recipients.length,
        },
      });

      // Create outbox events for all recipients
      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i]!;
        const delay = isFixedGap ? i * delayMs : 0;
        const scheduledAt = delay > 0 ? new Date(now.getTime() + delay) : now;

        // Update recipient status
        await tx.campaignRecipient.update({
          where: { id: r.id },
          data: { status: delay > 0 ? 'SCHEDULED' : 'PENDING', scheduledAt },
        });

        await createOutboxEvent(tx as typeof prisma, {
          type: 'ENQUEUE_DELIVERY',
          jobId: r.idempotencyKey,
          campaignId,
          recipientId: r.id,
          organizationId: user.organizationId,
          ...(delay > 0 ? { delay } : {}),
        }, campaignId);
      }

      return updated;
    });

    await writeAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'campaign.launched',
      resourceType: 'campaign',
      resourceId: campaignId,
      metadata: { recipientCount, deliveryMode: campaign.deliveryMode, delayMs },
    });

    return launched;
  }

  /**
   * Pause a running campaign.
   * Sets authoritative DB state. Workers must check this before new deliveries.
   */
  async pause(campaignId: string, user: AuthenticatedUser): Promise<Campaign> {
    const campaign = await this.getCampaignForOrg(campaignId, user.organizationId);
    this.assertTransition(campaign.status, 'PAUSED');

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED', pausedAt: new Date() },
    });

    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id, action: 'campaign.paused',
      resourceType: 'campaign', resourceId: campaignId,
    });

    return updated;
  }

  /**
   * Resume a paused campaign.
   * Re-enqueues any PENDING/SCHEDULED recipients that lost their queue jobs.
   */
  async resume(campaignId: string, user: AuthenticatedUser): Promise<Campaign> {
    const campaign = await this.getCampaignForOrg(campaignId, user.organizationId);
    this.assertTransition(campaign.status, 'RUNNING');

    // Find recipients not yet sent/failed/cancelled
    const remaining = await prisma.campaignRecipient.findMany({
      where: {
        campaignId,
        status: { in: ['PENDING', 'SCHEDULED', 'DEFERRED'] },
      },
      select: { id: true, idempotencyKey: true, scheduledAt: true },
    });

    const now = new Date();

    const resumed = await prisma.$transaction(async (tx) => {
      const updated = await tx.campaign.update({
        where: { id: campaignId },
        data: { status: 'RUNNING', pausedAt: null },
      });

      // Re-create outbox events (idempotent — same job IDs mean BullMQ deduplicates)
      for (const r of remaining) {
        const delay = r.scheduledAt && r.scheduledAt > now
          ? r.scheduledAt.getTime() - now.getTime()
          : 0;

        await createOutboxEvent(tx as typeof prisma, {
          type: 'ENQUEUE_DELIVERY',
          jobId: r.idempotencyKey,
          campaignId,
          recipientId: r.id,
          organizationId: user.organizationId,
          delay: delay > 0 ? delay : undefined,
        }, campaignId);
      }

      return updated;
    });

    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id, action: 'campaign.resumed',
      resourceType: 'campaign', resourceId: campaignId,
      metadata: { remainingRecipients: remaining.length },
    });

    return resumed;
  }

  /**
   * Cancel a campaign. Authoritative in PostgreSQL.
   * Workers must refuse cancelled work before sending.
   * Already-accepted SMTP messages cannot be recalled.
   */
  async cancel(campaignId: string, user: AuthenticatedUser): Promise<Campaign> {
    const campaign = await this.getCampaignForOrg(campaignId, user.organizationId);
    this.assertTransition(campaign.status, 'CANCELLED');

    const updated = await prisma.$transaction(async (tx) => {
      // Cancel all non-sent/non-failed recipients
      const cancelResult = await tx.campaignRecipient.updateMany({
        where: { campaignId, status: { in: ['PENDING', 'SCHEDULED', 'DEFERRED'] } },
        data: { status: 'CANCELLED' },
      });

      // Cancel corresponding delivery jobs
      await tx.deliveryJob.updateMany({
        where: { campaignId, status: { in: ['QUEUED', 'SCHEDULED', 'DEFERRED'] } },
        data: { status: 'CANCELLED' },
      });

      // Update campaign aggregates
      const campaign = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledCount: cancelResult.count,
        },
      });

      return campaign;
    });

    await writeAuditLog({
      organizationId: user.organizationId, userId: user.id, action: 'campaign.cancelled',
      resourceType: 'campaign', resourceId: campaignId,
    });

    return updated;
  }
}
