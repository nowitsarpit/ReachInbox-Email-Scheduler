import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectDatabase, disconnectDatabase } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';
import { closeAllQueues } from './lib/bullmq.js';
import { processOutboxEvents } from './lib/outbox.js';

// Routes
import authRouter from './routes/auth.js';
import campaignsRouter from './routes/campaigns.js';
import recipientsRouter from './routes/recipients.js';
import sendersRouter from './routes/senders.js';
import templatesRouter from './routes/templates.js';
import contactsRouter from './routes/contacts.js';
import analyticsRouter from './routes/analytics.js';
import activityRouter from './routes/activity.js';
import operationsRouter from './routes/operations.js';
import apiKeysRouter from './routes/apiKeys.js';
import webhooksRouter from './routes/webhooks.js';
import teamRouter from './routes/team.js';

const app = express();

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Let Next.js handle this for the frontend
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ─── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// ─── Request ID ──────────────────────────────────────────────────────────────
app.use(requestId);

// ─── Authentication ───────────────────────────────────────────────────────────
// Runs on every request — attaches user if cookie is valid
app.use(authenticate);

// ─── Health Endpoints ────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'gomail-api' });
});

app.get('/liveness', (_req, res) => {
  res.json({ alive: true, pid: process.pid, uptime: process.uptime() });
});

app.get('/readiness', async (_req, res) => {
  try {
    const { prisma } = await import('./lib/prisma.js');
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false, reason: 'Database not ready' });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const v1 = '/api/v1';

app.use(`${v1}/auth`, authRouter);
app.use('/api/auth', authRouter); // Callback alias for Google OAuth configured with /api/auth/google/callback
app.use(`${v1}/campaigns`, campaignsRouter);
app.use(`${v1}/campaigns`, recipientsRouter);  // nested: /campaigns/:id/recipients
app.use(`${v1}/senders`, sendersRouter);
app.use(`${v1}/templates`, templatesRouter);
app.use(`${v1}/contacts`, contactsRouter);
app.use(`${v1}/analytics`, analyticsRouter);
app.use(`${v1}/activity`, activityRouter);
app.use(`${v1}/operations`, operationsRouter);
app.use(`${v1}/api-keys`, apiKeysRouter);
app.use(`${v1}/webhooks`, webhooksRouter);
app.use(`${v1}/team`, teamRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Outbox Processor ────────────────────────────────────────────────────────
// Polls the outbox table and dispatches to BullMQ
function startOutboxProcessor(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const processed = await processOutboxEvents(100);
      if (processed > 0) {
        console.info(`[Outbox] Processed ${processed} events`);
      }
    } catch (err) {
      console.error('[Outbox] Processor error:', err);
    }
  }, env.OUTBOX_POLL_INTERVAL_MS);
}

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await connectDatabase();
  console.info('[DB] Connected to PostgreSQL');

  const outboxTimer = startOutboxProcessor();

  const server = app.listen(env.API_PORT, () => {
    console.info(`[API] GoMAil API running on http://localhost:${env.API_PORT}`);
    console.info(`[API] Environment: ${env.NODE_ENV}`);
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    console.info(`\n[API] Received ${signal}. Shutting down gracefully...`);
    clearInterval(outboxTimer);

    server.close(async () => {
      console.info('[API] HTTP server closed');
      await closeAllQueues();
      await disconnectRedis();
      await disconnectDatabase();
      console.info('[API] Shutdown complete');
      process.exit(0);
    });

    // Force exit after 15 seconds
    setTimeout(() => {
      console.error('[API] Forced shutdown after timeout');
      process.exit(1);
    }, 15_000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[API] Failed to start:', err);
  process.exit(1);
});

export default app;
