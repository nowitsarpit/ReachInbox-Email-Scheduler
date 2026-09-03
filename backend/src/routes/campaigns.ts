import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../lib/audit.js';
import { AppError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { sanitizeHtml, findUnknownPersonalizationVars, applyPersonalization } from '../lib/sanitize.js';
import { PERSONALIZATION_VARS } from '@gomail/shared';

const router = Router();

// All campaign routes require authentication
router.use(requireAuth);

// ─── Campaign State Machine ────────────────────────────────────────────────

type CampaignStatus = 'DRAFT' | 'READY' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['READY', 'CANCELLED'],
  READY: ['DRAFT', 'SCHEDULED', 'RUNNING', 'CANCELLED'],
  SCHEDULED: ['RUNNING', 'PAUSED', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

function assertValidTransition(from: CampaignStatus, to: CampaignStatus): void {
  const valid = VALID_TRANSITIONS[from] ?? [];
  if (!valid.includes(to)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `Cannot transition campaign from ${from} to ${to}`);
  }
}

// ─── List Campaigns ─────────────────────────────────────────────────────────

router.get('/', requirePermission('campaign.read'), async (req: Request, res: Response): Promise<void> => {
  const querySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.string().optional(),
    search: z.string().optional(),
    sort: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  });

  const query = querySchema.parse(req.query);
  const orgId = req.user!.organizationId;
  const skip = (query.page - 1) * query.pageSize;

  const where = {
    organizationId: orgId,
    deletedAt: null,
    ...(query.status ? { status: query.status as CampaignStatus } : {}),
    ...(query.search ? {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { [query.sort]: query.order },
      skip,
      take: query.pageSize,
      include: {
        sender: { select: { id: true, name: true, email: true } },
        _count: { select: { recipients: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  res.json({
    data: campaigns,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  });
});

// ─── Create Campaign ─────────────────────────────────────────────────────────

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

router.post('/', requirePermission('campaign.create'), async (req: Request, res: Response): Promise<void> => {
  const data = createCampaignSchema.parse(req.body);
  const orgId = req.user!.organizationId;

  const campaign = await prisma.campaign.create({
    data: {
      organizationId: orgId,
      name: data.name,
      description: data.description,
      status: 'DRAFT',
    },
  });

  await writeAuditLog({
    organizationId: orgId,
    userId: req.user!.id,
    action: 'campaign.created',
    resourceType: 'campaign',
    resourceId: campaign.id,
    metadata: { name: campaign.name },
  });

  res.status(201).json({ data: campaign });
});

// ─── Get Campaign ─────────────────────────────────────────────────────────────

router.get('/:id', requirePermission('campaign.read'), async (req: Request, res: Response): Promise<void> => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params['id'], organizationId: req.user!.organizationId, deletedAt: null },
    include: {
      sender: true,
      _count: { select: { recipients: true, deliveryJobs: true } },
    },
  });

  if (!campaign) throw new NotFoundError('Campaign');
  res.json({ data: campaign });
});

// ─── Update Campaign ─────────────────────────────────────────────────────────

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlBody: z.string().optional(),
  textBody: z.string().optional(),
  senderId: z.string().optional(),
  deliveryMode: z.enum(['IMMEDIATE', 'FIXED_GAP']).optional(),
  delayMs: z.number().int().positive().optional(),
  scheduledAt: z.string().datetime().optional(),
});

router.patch('/:id', requirePermission('campaign.update'), async (req: Request, res: Response): Promise<void> => {
  const data = updateCampaignSchema.parse(req.body);
  const orgId = req.user!.organizationId;

  const existing = await prisma.campaign.findFirst({
    where: { id: req.params['id'], organizationId: orgId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError('Campaign');

  // Can only update DRAFT or READY campaigns
  if (!['DRAFT', 'READY'].includes(existing.status)) {
    throw new AppError(409, 'CAMPAIGN_NOT_EDITABLE',
      `Campaign in ${existing.status} state cannot be edited`);
  }

  // Sanitize HTML body if provided
  const sanitizedHtml = data.htmlBody ? sanitizeHtml(data.htmlBody) : undefined;

  // Validate sender belongs to org if changed
  if (data.senderId) {
    const sender = await prisma.sender.findFirst({
      where: { id: data.senderId, organizationId: orgId, deletedAt: null },
    });
    if (!sender) throw new NotFoundError('Sender');
  }

  const updated = await prisma.campaign.update({
    where: { id: req.params['id'] },
    data: {
      ...data,
      htmlBody: sanitizedHtml,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    },
  });

  res.json({ data: updated });
});

// ─── Delete Campaign ─────────────────────────────────────────────────────────

router.delete('/:id', requirePermission('campaign.delete'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;

  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params['id'], organizationId: orgId, deletedAt: null },
  });
  if (!campaign) throw new NotFoundError('Campaign');

  if (['RUNNING', 'SCHEDULED'].includes(campaign.status)) {
    throw new AppError(409, 'CAMPAIGN_ACTIVE', 'Cannot delete a running or scheduled campaign. Cancel it first.');
  }

  await prisma.campaign.update({
    where: { id: req.params['id'] },
    data: { deletedAt: new Date() },
  });

  await writeAuditLog({
    organizationId: orgId,
    userId: req.user!.id,
    action: 'campaign.deleted',
    resourceType: 'campaign',
    resourceId: campaign.id,
  });

  res.json({ success: true });
});

// ─── Launch Campaign ─────────────────────────────────────────────────────────

router.post('/:id/launch', requirePermission('campaign.launch'), async (req: Request, res: Response): Promise<void> => {
  const { CampaignService } = await import('../services/campaign.service.js');
  const service = new CampaignService();
  const result = await service.launch(String(req.params['id']), req.user!);
  res.json({ data: result });
});

// ─── Pause Campaign ──────────────────────────────────────────────────────────

router.post('/:id/pause', requirePermission('campaign.pause'), async (req: Request, res: Response): Promise<void> => {
  const { CampaignService } = await import('../services/campaign.service.js');
  const service = new CampaignService();
  const result = await service.pause(String(req.params['id']), req.user!);
  res.json({ data: result });
});

// ─── Resume Campaign ─────────────────────────────────────────────────────────

router.post('/:id/resume', requirePermission('campaign.resume'), async (req: Request, res: Response): Promise<void> => {
  const { CampaignService } = await import('../services/campaign.service.js');
  const service = new CampaignService();
  const result = await service.resume(String(req.params['id']), req.user!);
  res.json({ data: result });
});

// ─── Cancel Campaign ─────────────────────────────────────────────────────────

router.post('/:id/cancel', requirePermission('campaign.cancel'), async (req: Request, res: Response): Promise<void> => {
  const { CampaignService } = await import('../services/campaign.service.js');
  const service = new CampaignService();
  const result = await service.cancel(String(req.params['id']), req.user!);
  res.json({ data: result });
});

// ─── SSE Progress Stream ──────────────────────────────────────────────────────

router.get('/:id/progress', requirePermission('campaign.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const campaignId = req.params['id']!;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId: orgId, deletedAt: null },
  });
  if (!campaign) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendProgress = async () => {
    try {
      const current = await prisma.campaign.findFirst({
        where: { id: campaignId },
        select: {
          status: true,
          totalRecipients: true,
          pendingCount: true,
          sentCount: true,
          failedCount: true,
          deferredCount: true,
          processingCount: true,
          cancelledCount: true,
          scheduledCount: true,
        },
      });

      if (current) {
        res.write(`data: ${JSON.stringify(current)}\n\n`);
      }
    } catch {
      // Client disconnected
    }
  };

  // Send initial state
  await sendProgress();

  // Poll every 2 seconds
  const interval = setInterval(sendProgress, 2000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// ─── Get Campaign Recipients ──────────────────────────────────────────────────

router.get('/:id/recipients', requirePermission('campaign.read'), async (req: Request, res: Response): Promise<void> => {
  const querySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    status: z.string().optional(),
  });

  const query = querySchema.parse(req.query);
  const orgId = req.user!.organizationId;
  const skip = (query.page - 1) * query.pageSize;

  const where = {
    campaignId: req.params['id']!,
    organizationId: orgId,
    ...(query.status ? { status: query.status as any } : {}),
  };

  const [recipients, total] = await Promise.all([
    prisma.campaignRecipient.findMany({
      where,
      orderBy: { importedAt: 'asc' },
      skip,
      take: query.pageSize,
    }),
    prisma.campaignRecipient.count({ where }),
  ]);

  res.json({
    data: recipients,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  });
});

export default router;
