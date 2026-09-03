import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { isValidEmail, normalizeEmail } from '../lib/idempotency.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('contacts.read'), async (req: Request, res: Response): Promise<void> => {
  const querySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    tag: z.string().optional(),
  });
  const query = querySchema.parse(req.query);
  const orgId = req.user!.organizationId;
  const skip = (query.page - 1) * query.pageSize;

  const where = {
    organizationId: orgId,
    deletedAt: null as null,
    ...(query.search ? {
      OR: [
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { firstName: { contains: query.search, mode: 'insensitive' as const } },
        { lastName: { contains: query.search, mode: 'insensitive' as const } },
        { company: { contains: query.search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(query.tag ? { tags: { has: query.tag } } : {}),
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({ where, skip, take: query.pageSize, orderBy: { createdAt: 'desc' } }),
    prisma.contact.count({ where }),
  ]);

  res.json({
    data: contacts,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  });
});

router.post('/', requirePermission('contacts.manage'), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    company: z.string().optional(),
    tags: z.array(z.string()).default([]),
  });
  const data = schema.parse(req.body);
  const orgId = req.user!.organizationId;

  if (!isValidEmail(data.email)) {
    res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'Invalid email address' } });
    return;
  }

  const normalized = normalizeEmail(data.email);
  const contact = await prisma.contact.upsert({
    where: { organizationId_email: { organizationId: orgId, email: normalized } },
    create: { ...data, email: normalized, organizationId: orgId },
    update: { firstName: data.firstName, lastName: data.lastName, company: data.company, tags: data.tags },
  });
  res.status(201).json({ data: contact });
});

router.delete('/:id', requirePermission('contacts.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const contact = await prisma.contact.findFirst({ where: { id: req.params['id']!, organizationId: orgId } });
  if (!contact) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Contact not found' } }); return; }
  await prisma.contact.update({ where: { id: req.params['id']! }, data: { deletedAt: new Date() } });
  res.json({ success: true });
});

// Suppression management
router.get('/suppressions', requirePermission('contacts.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const suppressions = await prisma.suppression.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ data: suppressions });
});

router.post('/suppressions', requirePermission('contacts.manage'), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    email: z.string().email(),
    reason: z.enum(['UNSUBSCRIBED', 'BOUNCED', 'BLOCKED', 'MANUAL', 'COMPLAINT']),
    note: z.string().optional(),
  });
  const data = schema.parse(req.body);
  const orgId = req.user!.organizationId;
  const normalized = normalizeEmail(data.email);

  const suppression = await prisma.suppression.upsert({
    where: { organizationId_email: { organizationId: orgId, email: normalized } },
    create: { organizationId: orgId, email: normalized, reason: data.reason, note: data.note },
    update: { reason: data.reason, note: data.note },
  });
  res.status(201).json({ data: suppression });
});

export default router;
