import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('activity.view'), async (req: Request, res: Response): Promise<void> => {
  const querySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    campaignId: z.string().optional(),
    event: z.string().optional(),
  });
  const query = querySchema.parse(req.query);
  const orgId = req.user!.organizationId;
  const skip = (query.page - 1) * query.pageSize;

  const where = {
    organizationId: orgId,
    ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    ...(query.event ? { event: query.event } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.deliveryEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip,
      take: query.pageSize,
      include: {
        campaign: { select: { id: true, name: true } },
        job: { select: { id: true, recipient: { select: { email: true } } } },
      },
    }),
    prisma.deliveryEvent.count({ where }),
  ]);

  res.json({
    data: events,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  });
});

// Audit log timeline
router.get('/audit', requirePermission('settings.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { occurredAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json({ data: logs });
});

export default router;
