import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { generateApiKey, hashApiKey } from '../lib/idempotency.js';
import { writeAuditLog } from '../lib/audit.js';
import { NotFoundError } from '../middleware/errorHandler.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('api_key.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const keys = await prisma.apiKey.findMany({
    where: { organizationId: orgId, revokedAt: null },
    select: { id: true, name: true, prefix: true, scopes: true, expiresAt: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: keys });
});

router.post('/', requirePermission('api_key.manage'), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.string()).default([]),
    expiresAt: z.string().datetime().optional(),
  });
  const data = schema.parse(req.body);
  const orgId = req.user!.organizationId;

  const { key, prefix, hash } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId: orgId,
      name: data.name,
      prefix,
      keyHash: hash,
      scopes: data.scopes,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'api_key.created',
    resourceType: 'api_key', resourceId: apiKey.id, metadata: { name: apiKey.name },
  });

  // Return the FULL key only once — never again
  res.status(201).json({
    data: {
      id: apiKey.id, name: apiKey.name, prefix, scopes: apiKey.scopes,
      key, // displayed once — not stored in plaintext
      warning: 'Copy this key now. It will not be shown again.',
    },
  });
});

router.delete('/:id', requirePermission('api_key.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: req.params['id']!, organizationId: orgId, revokedAt: null },
  });
  if (!apiKey) throw new NotFoundError('API Key');

  await prisma.apiKey.update({ where: { id: req.params['id']! }, data: { revokedAt: new Date() } });
  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'api_key.revoked',
    resourceType: 'api_key', resourceId: apiKey.id,
  });
  res.json({ success: true });
});

export default router;
