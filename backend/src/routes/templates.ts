import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { writeAuditLog } from '../lib/audit.js';
import { sanitizeHtml } from '../lib/sanitize.js';

const router = Router();
router.use(requireAuth);

const templateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  subject: z.string().min(1).max(500),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  note: z.string().optional(),
});

router.get('/', requirePermission('template.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const templates = await prisma.template.findMany({
    where: { organizationId: orgId, deletedAt: null },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ data: templates });
});

router.post('/', requirePermission('template.manage'), async (req: Request, res: Response): Promise<void> => {
  const data = templateSchema.parse(req.body);
  const orgId = req.user!.organizationId;
  const sanitized = sanitizeHtml(data.htmlBody);

  const template = await prisma.template.create({
    data: {
      organizationId: orgId,
      name: data.name,
      description: data.description,
      subject: data.subject,
      versions: {
        create: {
          version: 1,
          subject: data.subject,
          htmlBody: sanitized,
          textBody: data.textBody,
          note: data.note,
          createdById: req.user!.id,
        },
      },
    },
    include: { versions: true },
  });

  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'template.created',
    resourceType: 'template', resourceId: template.id,
  });
  res.status(201).json({ data: template });
});

router.get('/:id', requirePermission('template.read'), async (req: Request, res: Response): Promise<void> => {
  const template = await prisma.template.findFirst({
    where: { id: req.params['id']!, organizationId: req.user!.organizationId, deletedAt: null },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  if (!template) throw new NotFoundError('Template');
  res.json({ data: template });
});

router.patch('/:id', requirePermission('template.manage'), async (req: Request, res: Response): Promise<void> => {
  const data = templateSchema.partial().parse(req.body);
  const orgId = req.user!.organizationId;

  const template = await prisma.template.findFirst({
    where: { id: req.params['id']!, organizationId: orgId, deletedAt: null },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!template) throw new NotFoundError('Template');

  const versions = (template as any).versions ?? [];
  const currentVersion = versions[0]?.version ?? 0;

  // Create a new version if content changed
  const updated = await prisma.template.update({
    where: { id: req.params['id']! },
    data: {
      name: data.name,
      description: data.description,
      subject: data.subject ?? template.subject,
      ...(data.htmlBody || data.subject ? {
        versions: {
          create: {
            version: currentVersion + 1,
            subject: data.subject ?? versions[0]?.subject ?? '',
            htmlBody: data.htmlBody ? sanitizeHtml(data.htmlBody) : versions[0]?.htmlBody ?? '',
            textBody: data.textBody ?? versions[0]?.textBody,
            note: data.note,
            createdById: req.user!.id,
          },
        },
      } : {}),
    },
    include: { versions: { orderBy: { version: 'desc' }, take: 5 } },
  });

  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'template.updated',
    resourceType: 'template', resourceId: template.id,
  });
  res.json({ data: updated });
});

router.delete('/:id', requirePermission('template.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const template = await prisma.template.findFirst({
    where: { id: req.params['id']!, organizationId: orgId, deletedAt: null },
  });
  if (!template) throw new NotFoundError('Template');
  await prisma.template.update({ where: { id: req.params['id']! }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'template.deleted',
    resourceType: 'template', resourceId: template.id,
  });
  res.json({ success: true });
});

export default router;
