import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { writeAuditLog } from '../lib/audit.js';
import { AppError } from '../middleware/errorHandler.js';
import type { OrganizationRole } from '@gomail/shared';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('team.read'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: orgId, removedAt: null },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, lastLoginAt: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  res.json({ data: members });
});

router.patch('/:memberId/role', requirePermission('team.manage'), async (req: Request, res: Response): Promise<void> => {
  const schema = z.object({ role: z.enum(['ADMIN', 'OPERATOR', 'MEMBER', 'VIEWER']) });
  const data = schema.parse(req.body);
  const orgId = req.user!.organizationId;

  const member = await prisma.organizationMember.findFirst({
    where: { id: req.params['memberId']!, organizationId: orgId, removedAt: null },
  });
  if (!member) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Member not found' } }); return; }

  // Cannot change OWNER role
  if (member.role === 'OWNER') throw new AppError(403, 'FORBIDDEN', 'Cannot change the role of the organization owner');
  // Cannot assign OWNER
  if ((data.role as string) === 'OWNER') throw new AppError(403, 'FORBIDDEN', 'Cannot assign OWNER role');

  const updated = await prisma.organizationMember.update({
    where: { id: req.params['memberId']! },
    data: { role: data.role as OrganizationRole },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'team.role_changed',
    resourceId: member.userId, metadata: { from: member.role, to: data.role },
  });

  res.json({ data: updated });
});

router.delete('/:memberId', requirePermission('team.manage'), async (req: Request, res: Response): Promise<void> => {
  const orgId = req.user!.organizationId;
  const member = await prisma.organizationMember.findFirst({
    where: { id: req.params['memberId']!, organizationId: orgId, removedAt: null },
  });
  if (!member) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Member not found' } }); return; }
  if (member.role === 'OWNER') throw new AppError(403, 'FORBIDDEN', 'Cannot remove the organization owner');
  if (member.userId === req.user!.id) throw new AppError(400, 'SELF_REMOVAL', 'Cannot remove yourself');

  await prisma.organizationMember.update({ where: { id: req.params['memberId']! }, data: { removedAt: new Date() } });
  await writeAuditLog({
    organizationId: orgId, userId: req.user!.id, action: 'team.member_removed', resourceId: member.userId,
  });
  res.json({ success: true });
});

export default router;
