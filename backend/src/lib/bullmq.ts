import { Queue, QueueEvents } from 'bullmq';
import { createBullMQConnection } from './redis.js';
import { QUEUE_NAMES } from '@gomail/shared';
import { env } from '../config/env.js';

// Queue factory — creates BullMQ queues with proper connection settings
const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    const connection = createBullMQConnection();
    const q = new Queue(name, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 5000 },
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });
    queues.set(name, q);
  }
  return queues.get(name)!;
}

export function getDeliveryQueue(): Queue {
  return getQueue(QUEUE_NAMES.DELIVERY);
}

export function getWebhookQueue(): Queue {
  return getQueue(QUEUE_NAMES.WEBHOOK);
}

export async function closeAllQueues(): Promise<void> {
  for (const [, queue] of queues) {
    await queue.close();
  }
  queues.clear();
}

// Enqueue a delivery job with idempotency key as BullMQ job ID
export async function enqueueDeliveryJob(
  jobId: string,
  data: Record<string, unknown>,
  opts: { delay?: number; priority?: number } = {}
): Promise<string> {
  const queue = getDeliveryQueue();
  const safeJobId = `gomail-${jobId.replace(/:/g, '-')}`;
  const job = await queue.add('send-email', data, {
    jobId: safeJobId, // deterministic job ID for idempotency (no colons for BullMQ v5)
    ...(opts.delay !== undefined ? { delay: opts.delay } : {}),
    ...(opts.priority !== undefined ? { priority: opts.priority } : {}),
  });
  return job.id ?? safeJobId;
}
