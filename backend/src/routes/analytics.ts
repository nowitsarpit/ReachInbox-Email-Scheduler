import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('analytics.view'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  // Aggregate real delivery event counts from DB
  const [campaignStats, deliveryStats, recentEvents] = await Promise.all([
    prisma.campaign.groupBy({
      by: ['status'],
      where: { organizationId: orgId, deletedAt: null },
      _count: { id: true },
    }),
    prisma.deliveryJob.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { id: true },
    }),
    prisma.deliveryEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      include: { job: { select: { id: true } } },
    }),
  ]);

  // Throughput: sent in last 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sentLast24h = await prisma.deliveryJob.count({
    where: { organizationId: orgId, status: 'SENT', sentAt: { gte: since24h } },
  });

  // Campaign aggregate totals
  const totals = await prisma.campaign.aggregate({
    where: { organizationId: orgId, deletedAt: null },
    _sum: { sentCount: true, failedCount: true, totalRecipients: true, deferredCount: true },
  });

  res.json({
    data: {
      campaigns: {
        byStatus: campaignStats.reduce((acc: Record<string, number>, s) => ({ ...acc, [s.status]: s._count.id }), {}),
        total: campaignStats.reduce((sum: number, s) => sum + s._count.id, 0),
      },
      deliveries: {
        byStatus: deliveryStats.reduce((acc: Record<string, number>, s) => ({ ...acc, [s.status]: s._count.id }), {}),
        total: deliveryStats.reduce((sum: number, s) => sum + s._count.id, 0),
      },
      summary: {
        totalSent: totals._sum.sentCount ?? 0,
        totalFailed: totals._sum.failedCount ?? 0,
        totalDeferred: totals._sum.deferredCount ?? 0,
        totalRecipients: totals._sum.totalRecipients ?? 0,
        sentLast24h,
      },
      note: 'Open/click/bounce tracking unavailable from current provider (Ethereal test SMTP)',
    },
  });
});

router.get('/campaigns/:campaignId', requirePermission('analytics.view'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const { campaignId } = req.params as { campaignId: string };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId: orgId, deletedAt: null },
    select: {
      id: true, name: true, status: true,
      totalRecipients: true, sentCount: true, failedCount: true,
      deferredCount: true, pendingCount: true, processingCount: true,
      cancelledCount: true, scheduledCount: true,
      startedAt: true, completedAt: true,
    },
  });

  if (!campaign) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } }); return; }

  // Delivery events timeline for this campaign
  const events = await prisma.deliveryEvent.groupBy({
    by: ['event'],
    where: { campaignId, organizationId: orgId },
    _count: { id: true },
  });

  // Delivery latency stats
  const sentJobs = await prisma.deliveryJob.findMany({
    where: { campaignId, organizationId: orgId, status: 'SENT' },
    select: { createdAt: true, sentAt: true },
    take: 500,
  });

  const avgLatencyMs = sentJobs.length > 0
    ? sentJobs.reduce((sum: number, j) => sum + ((j.sentAt?.getTime() ?? 0) - j.createdAt.getTime()), 0) / sentJobs.length
    : null;

  res.json({
    data: {
      campaign,
      events: events.reduce((acc: Record<string, number>, e) => ({ ...acc, [e.event]: e._count.id }), {}),
      latency: avgLatencyMs !== null ? { avgMs: Math.round(avgLatencyMs) } : null,
    },
  });
});

export default router;
