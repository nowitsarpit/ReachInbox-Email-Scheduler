import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES, JOB_NAMES } from '@gomail/shared';

// Inline env for worker (no shared config module to avoid circular deps)
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const WORKER_CONCURRENCY = parseInt(process.env['WORKER_CONCURRENCY'] ?? '5');
const DATABASE_URL = process.env['DATABASE_URL'];
const LEASE_TIMEOUT_MS = parseInt(process.env['LEASE_TIMEOUT_MS'] ?? '60000');

if (!DATABASE_URL) {
  console.error('[Worker] DATABASE_URL is required');
  process.exit(1);
}

// Import processor (lazy to allow env to load first)
import('./processors/delivery.processor.js').then(({ processDeliveryJob }) => {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  connection.on('error', (err) => console.error('[Worker Redis]', err.message));
  connection.on('connect', () => console.info('[Worker Redis] Connected'));
  connection.on('reconnecting', () => console.warn('[Worker Redis] Reconnecting...'));

  const worker = new Worker(
    QUEUE_NAMES.DELIVERY,
    async (job: Job) => {
      if (job.name === JOB_NAMES.SEND_EMAIL) {
        return processDeliveryJob(job);
      }
      console.warn(`[Worker] Unknown job name: ${job.name}`);
    },
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
      // Prevent a job from being abandoned silently
      lockDuration: LEASE_TIMEOUT_MS,
      stalledInterval: LEASE_TIMEOUT_MS / 2,
      maxStalledCount: 2,
    }
  );

  worker.on('completed', (job) => {
    console.info(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled — will be retried`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.info(`[Worker] GoMAil delivery worker started`);
  console.info(`[Worker] Queue: ${QUEUE_NAMES.DELIVERY}`);
  console.info(`[Worker] Concurrency: ${WORKER_CONCURRENCY}`);

  // ─── Crash Recovery on Startup ────────────────────────────────────────────
  import('./recovery.js').then(({ reconcileStaleJobs }) => {
    reconcileStaleJobs().catch((err) => console.error('[Recovery] Error:', err));
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    console.info(`\n[Worker] Received ${signal}. Shutting down...`);

    // Stop accepting new jobs
    await worker.close();
    console.info('[Worker] Worker closed — no new jobs will be accepted');

    // Close Redis
    await connection.quit();
    console.info('[Worker] Redis connection closed');

    console.info('[Worker] Shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}).catch((err) => {
  console.error('[Worker] Failed to start:', err);
  process.exit(1);
});
