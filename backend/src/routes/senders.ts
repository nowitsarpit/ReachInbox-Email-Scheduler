import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { writeAuditLog } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

const senderSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  replyTo: z.string().email().optional(),
  hourlyLimit: z.number().int().positive().optional(),
  minGapMs: z.number().int().positive().optional(),
});

router.get('/', requirePermission('sender.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const senders = await prisma.sender.findMany({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: senders });
});

router.post('/', requirePermission('sender.manage'), async (req: Request, res: Response): Promise<void> => {
  const data = senderSchema.parse(req.body);
  const orgId = req.user!.organizationId;

  const existing = await prisma.sender.findFirst({
    where: { organizationId: orgId, email: data.email, deletedAt: null },
  });
  if (existing) throw new ConflictError(`Sender with email ${data.email} already exists`);

  const sender = await prisma.sender.create({
    data: { ...data, organizationId: orgId },
  });

  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'sender.created',
    resourceType: 'sender', resourceId: sender.id, metadata: { email: sender.email },
  });

  res.status(201).json({ data: sender });
});

router.get('/:id', requirePermission('sender.read'), async (req: Request, res: Response): Promise<void> => {
  const sender = await prisma.sender.findFirst({
    where: { id: req.params['id']!, organizationId: req.user!.organizationId, deletedAt: null },
  });
  if (!sender) throw new NotFoundError('Sender');
  res.json({ data: sender });
});

router.patch('/:id', requirePermission('sender.manage'), async (req: Request, res: Response): Promise<void> => {
  const data = senderSchema.partial().parse(req.body);
  const orgId = req.user!.organizationId;

  const sender = await prisma.sender.findFirst({
    where: { id: req.params['id']!, organizationId: orgId, deletedAt: null },
  });
  if (!sender) throw new NotFoundError('Sender');

  const updated = await prisma.sender.update({ where: { id: req.params['id']! }, data });
  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'sender.updated',
    resourceType: 'sender', resourceId: sender.id,
  });
  res.json({ data: updated });
});

router.delete('/:id', requirePermission('sender.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const sender = await prisma.sender.findFirst({
    where: { id: req.params['id']!, organizationId: orgId, deletedAt: null },
  });
  if (!sender) throw new NotFoundError('Sender');

  // Check no active campaigns use this sender
  const active = await prisma.campaign.count({
    where: { senderId: sender.id, status: { in: ['RUNNING', 'SCHEDULED', 'PAUSED'] } },
  });
  if (active > 0) throw new ConflictError('Cannot delete sender used by active campaigns');

  await prisma.sender.update({ where: { id: req.params['id']! }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'sender.deleted',
    resourceType: 'sender', resourceId: sender.id,
  });
  res.json({ success: true });
});

export default router;
