import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  description: z.string().optional(),
});

router.get('/', requirePermission('webhook.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const webhooks = await prisma.webhook.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true, url: true, events: true, active: true, description: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: webhooks });
});

router.post('/', requirePermission('webhook.manage'), async (req: Request, res: Response): Promise<void> => {
  const data = webhookSchema.parse(req.body);
  const orgId = req.user!.organizationId;

  // Generate signing secret
  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

  const webhook = await prisma.webhook.create({
    data: { organizationId: orgId, url: data.url, events: data.events, description: data.description, secret },
    select: { id: true, url: true, events: true, active: true, description: true, createdAt: true },
  });

  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'webhook.created',
    resourceType: 'webhook', resourceId: webhook.id,
  });

  // Return secret only at creation
  res.status(201).json({ data: { ...webhook, secret, warning: 'Copy this signing secret now. It will not be shown again.' } });
});

router.patch('/:id', requirePermission('webhook.manage'), async (req: Request, res: Response): Promise<void> => {
  const data = webhookSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body);
  const orgId = req.user!.organizationId;
  const webhook = await prisma.webhook.findFirst({ where: { id: req.params['id']!, organizationId: orgId, deletedAt: null } });
  if (!webhook) throw new NotFoundError('Webhook');

  const updated = await prisma.webhook.update({
    where: { id: req.params['id']! }, data,
    select: { id: true, url: true, events: true, active: true, description: true, updatedAt: true },
  });
  res.json({ data: updated });
});

router.delete('/:id', requirePermission('webhook.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const webhook = await prisma.webhook.findFirst({ where: { id: req.params['id']!, organizationId: orgId, deletedAt: null } });
  if (!webhook) throw new NotFoundError('Webhook');
  await prisma.webhook.update({ where: { id: req.params['id']! }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'webhook.deleted',
    resourceType: 'webhook', resourceId: webhook.id,
  });
  res.json({ success: true });
});

router.get('/:id/deliveries', requirePermission('webhook.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const webhook = await prisma.webhook.findFirst({ where: { id: req.params['id']!, organizationId: orgId } });
  if (!webhook) throw new NotFoundError('Webhook');

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: req.params['id']! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ data: deliveries });
});

export default router;
