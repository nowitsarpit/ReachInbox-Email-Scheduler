import crypto from 'crypto';
import { prisma } from './prisma.js';
import { enqueueDeliveryJob } from './bullmq.js';

/**
 * Transactional Outbox Pattern implementation.
 *
 * Problem: If we commit a DB state change and then insert to BullMQ separately,
 * a crash between those two operations means the queue job is lost.
 *
 * Solution: Write an OutboxEvent in the same DB transaction as the state change.
 * A separate outbox processor reads pending OutboxEvents and enqueues to BullMQ.
 * The processor marks events processed only after successful queue insertion.
 * This provides at-least-once delivery semantics.
 */

export interface OutboxEventPayload {
  type: 'ENQUEUE_DELIVERY';
  jobId: string;           // idempotencyKey
  campaignId: string;
  recipientId: string;
  organizationId: string;
  delay?: number;
}

/**
 * Create an outbox event as part of a DB transaction.
 * Use this inside prisma.$transaction() calls.
 */
export async function createOutboxEvent(
  tx: typeof prisma,
  payload: OutboxEventPayload,
  campaignId?: string
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      campaignId: campaignId ?? payload.campaignId,
      eventType: payload.type,
      payload: payload as object,
    },
  });
}

/**
 * Process pending outbox events.
 * Called by the outbox processor on a polling interval.
 */
export async function processOutboxEvents(batchSize = 100): Promise<number> {
  // Fetch unprocessed events (no processedAt, not failed after 3 attempts)
  const events = await prisma.outboxEvent.findMany({
    where: {
      processedAt: null,
      OR: [
        { failedAt: null },
        { attempts: { lt: 3 } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  let processed = 0;

  for (const event of events) {
    try {
      if (event.eventType === 'ENQUEUE_DELIVERY') {
        const payload = event.payload as unknown as OutboxEventPayload;
        await enqueueDeliveryJob(payload.jobId, {
          campaignId: payload.campaignId,
          recipientId: payload.recipientId,
          organizationId: payload.organizationId,
          idempotencyKey: payload.jobId,
        }, { ...(payload.delay !== undefined ? { delay: payload.delay } : {}) });
      }

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });

      processed++;
    } catch (err) {
      console.error(`[Outbox] Failed to process event ${event.id}:`, err);
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          failedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    }
  }

  return processed;
}
