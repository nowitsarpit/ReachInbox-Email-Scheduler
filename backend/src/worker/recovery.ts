import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES } from '@gomail/shared';

const prisma = new PrismaClient();
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const LEASE_TIMEOUT_MS = parseInt(process.env['LEASE_TIMEOUT_MS'] ?? '60000');

/**
 * On worker startup: reconcile DB state with BullMQ queue.
 *
 * Finds recipients in PROCESSING state with expired leases (stale from crashed workers).
 * Resets them to PENDING so they get re-queued.
 *
 * Also finds PENDING/SCHEDULED recipients with no corresponding queue job
 * and re-creates their outbox events.
 */
export async function reconcileStaleJobs(): Promise<void> {
  console.info('[Recovery] Starting crash recovery reconciliation...');

  const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const queue = new Queue(QUEUE_NAMES.DELIVERY, { connection });

  try {
    // ── Reset stale PROCESSING records ──────────────────────────────────
    const staleLeaseTime = new Date(Date.now() - LEASE_TIMEOUT_MS);

    const staleJobs = await prisma.deliveryJob.findMany({
      where: {
        status: 'PROCESSING',
        processingAt: { lt: staleLeaseTime },
      },
      select: { id: true, recipientId: true, idempotencyKey: true, campaignId: true, organizationId: true },
      take: 500,
    });

    if (staleJobs.length > 0) {
      console.info(`[Recovery] Found ${staleJobs.length} stale PROCESSING jobs — resetting`);

      for (const job of staleJobs) {
        // Check if BullMQ still has this job (worker may still be active)
        const bullJobId = `gomail:${job.idempotencyKey}`;
        const bullJob = await queue.getJob(bullJobId);

        if (bullJob && (await bullJob.isActive())) {
          // Job is still active in BullMQ — skip, real worker is handling it
          continue;
        }

        // Reset to PENDING for re-processing
        await prisma.$transaction([
          prisma.campaignRecipient.update({
            where: { id: job.recipientId },
            data: { status: 'PENDING' },
          }),
          prisma.deliveryJob.update({
            where: { id: job.id },
            data: { status: 'QUEUED', processingAt: null, leaseExpiresAt: null },
          }),
          prisma.deliveryEvent.create({
            data: {
              campaignId: job.campaignId,
              organizationId: job.organizationId,
              jobId: job.id,
              event: 'recovery',
              metadata: { reason: 'Stale lease detected on startup' },
            },
          }),
          // Re-enqueue via outbox
          prisma.outboxEvent.create({
            data: {
              campaignId: job.campaignId,
              eventType: 'ENQUEUE_DELIVERY',
              payload: {
                type: 'ENQUEUE_DELIVERY',
                jobId: job.idempotencyKey,
                campaignId: job.campaignId,
                recipientId: job.recipientId,
                organizationId: job.organizationId,
              },
            },
          }),
        ]);
      }
    }

    // ── Find PENDING/SCHEDULED with no queue job ─────────────────────────
    const activeRecipients = await prisma.campaignRecipient.findMany({
      where: {
        status: { in: ['PENDING', 'SCHEDULED'] },
        campaign: { status: { in: ['RUNNING'] } },
      },
      select: { id: true, idempotencyKey: true, scheduledAt: true, campaign: { select: { id: true, organizationId: true } } },
      take: 1000,
    });

    let requeued = 0;
    for (const r of activeRecipients) {
      const bullJobId = `gomail:${r.idempotencyKey}`;
      const bullJob = await queue.getJob(bullJobId);
      if (!bullJob) {
        // Job is missing from queue — re-create
        const now = new Date();
        const delay = r.scheduledAt && r.scheduledAt > now
          ? r.scheduledAt.getTime() - now.getTime()
          : 0;

        await prisma.outboxEvent.create({
          data: {
            campaignId: r.campaign.id,
            eventType: 'ENQUEUE_DELIVERY',
            payload: {
              type: 'ENQUEUE_DELIVERY',
              jobId: r.idempotencyKey,
              campaignId: r.campaign.id,
              recipientId: r.id,
              organizationId: r.campaign.organizationId,
              delay: delay > 0 ? delay : undefined,
            },
          },
        });
        requeued++;
      }
    }

    if (requeued > 0) {
      console.info(`[Recovery] Re-queued ${requeued} missing jobs`);
    }

    console.info('[Recovery] Reconciliation complete');
  } finally {
    await queue.close();
    await connection.quit();
    await prisma.$disconnect();
  }
}
