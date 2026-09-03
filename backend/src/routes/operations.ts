import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';
import { getMailProvider } from '../providers/mail/index.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('operations.view'), async (req: Request, res: Response): Promise<void> => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkMailProvider(),
  ]);

  const [db, redis, mail] = checks.map((r) =>
    r.status === 'fulfilled' ? r.value : { healthy: false, error: String((r as PromiseRejectedResult).reason) }
  );

  const allHealthy = [db, redis, mail].every((c) => (c as { healthy: boolean }).healthy);

  res.status(allHealthy ? 200 : 503).json({
    data: {
      status: allHealthy ? 'operational' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: { healthy: true, name: 'API', description: 'Express HTTP API' },
        database: { ...db, name: 'PostgreSQL', description: 'Primary datastore' },
        redis: { ...redis, name: 'Redis', description: 'Queue coordination & rate limiting' },
        mailProvider: { ...mail, name: 'Mail Provider (Ethereal)', description: 'Email delivery' },
      },
    },
  });
});

async function checkDatabase() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { healthy: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkRedis() {
  const start = Date.now();
  try {
    const result = await getRedis().ping();
    return { healthy: result === 'PONG', latencyMs: Date.now() - start };
  } catch (err) {
    return { healthy: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkMailProvider() {
  const start = Date.now();
  try {
    const provider = getMailProvider();
    const result = await provider.healthCheck();
    return { ...result, latencyMs: Date.now() - start };
  } catch (err) {
    return { healthy: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

export default router;
