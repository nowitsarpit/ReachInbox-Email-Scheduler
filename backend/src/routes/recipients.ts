import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { writeAuditLog } from '../lib/audit.js';
import { isValidEmail, normalizeEmail, generateIdempotencyKey } from '../lib/idempotency.js';
import Papa from 'papaparse';
import multer from 'multer';

const router = Router();
router.use(requireAuth);

// Multer for file uploads — memory storage, 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'text/plain', 'application/csv'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and TXT files are allowed'));
    }
  },
});

// ─── Import Recipients ───────────────────────────────────────────────────────

const recipientRowSchema = z.object({
  email: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
}).passthrough();

router.post(
  '/campaigns/:campaignId/recipients/import',
  requirePermission('campaign.update'),
  upload.single('file') as any,
  async (req: Request, res: Response): Promise<void> => {
    const orgId = req.user!.organizationId;
    const { campaignId } = req.params as { campaignId: string };

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: orgId, deletedAt: null },
    });
    if (!campaign) throw new NotFoundError('Campaign');

    if (!['DRAFT', 'READY'].includes(campaign.status)) {
      res.status(409).json({
        error: { code: 'CAMPAIGN_NOT_EDITABLE', message: `Campaign is ${campaign.status}` },
      });
      return;
    }

    // Parse CSV/TXT
    let rawRows: Record<string, string>[] = [];

    if (req.file) {
      const content = req.file.buffer.toString('utf-8');
      const parsed = Papa.parse<Record<string, string>>(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      rawRows = parsed.data;
    } else if (req.body['emails'] as string | undefined) {
      // Paste mode: one email per line
      const lines = (req.body['emails'] as string).split('\n').map((l: string) => l.trim()).filter(Boolean);
      rawRows = lines.map((email: string) => ({ email }));
    } else {
      res.status(400).json({ error: { code: 'NO_INPUT', message: 'No file or emails provided' } });
      return;
    }

    // Validate, normalize, deduplicate
    const seen = new Set<string>();
    const valid: Array<{ email: string; normalized: string; firstName?: string; lastName?: string; company?: string }> = [];
    const invalid: Array<{ row: number; email: string; reason: string }> = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i]!;
      const raw = (row['email'] ?? '').trim();

      if (!raw) {
        invalid.push({ row: i + 1, email: raw, reason: 'Empty email' });
        continue;
      }

      if (!isValidEmail(raw)) {
        invalid.push({ row: i + 1, email: raw, reason: 'Invalid email format' });
        continue;
      }

      const normalized = normalizeEmail(raw);

      if (seen.has(normalized)) {
        continue; // Deduplicate
      }

      seen.add(normalized);
      valid.push({
        email: raw.toLowerCase().trim(),
        normalized,
        firstName: row['firstname'] ?? row['first_name'],
        lastName: row['lastname'] ?? row['last_name'],
        company: row['company'],
      });
    }

    // Suppression check
    const emails = valid.map((v) => v.normalized);
    const suppressions = await prisma.suppression.findMany({
      where: { organizationId: orgId, email: { in: emails } },
      select: { email: true },
    });
    const suppressedSet = new Set(suppressions.map((s) => s.email));

    // Batch upsert recipients
    const toInsert = valid.filter((v) => !suppressedSet.has(v.normalized));
    const suppressedCount = valid.length - toInsert.length;

    let inserted = 0;
    const BATCH = 500;

    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const result = await prisma.$transaction(
        batch.map((r) =>
          prisma.campaignRecipient.upsert({
            where: { idempotencyKey: generateIdempotencyKey(campaignId, r.normalized) },
            create: {
              campaignId,
              organizationId: orgId,
              email: r.email,
              firstName: r.firstName,
              lastName: r.lastName,
              company: r.company,
              status: 'PENDING',
              idempotencyKey: generateIdempotencyKey(campaignId, r.normalized),
            },
            update: {
              email: r.email,
              firstName: r.firstName,
              lastName: r.lastName,
              company: r.company,
            },
          })
        )
      );
      inserted += result.length;
    }

    // Also mark suppressed recipients
    for (const r of valid.filter((v) => suppressedSet.has(v.normalized))) {
      await prisma.campaignRecipient.upsert({
        where: { idempotencyKey: generateIdempotencyKey(campaignId, r.normalized) },
        create: {
          campaignId,
          organizationId: orgId,
          email: r.email,
          status: 'SUPPRESSED',
          idempotencyKey: generateIdempotencyKey(campaignId, r.normalized),
        },
        update: { status: 'SUPPRESSED' },
      });
    }

    // Update campaign total count
    const total = await prisma.campaignRecipient.count({ where: { campaignId, organizationId: orgId } });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: total },
    });

    await writeAuditLog({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'recipient.imported',
      resourceType: 'campaign',
      resourceId: campaignId,
      metadata: { inserted, suppressedCount, invalid: invalid.length },
    });

    res.json({
      data: {
        inserted,
        suppressed: suppressedCount,
        invalid: invalid.length,
        invalidRows: invalid.slice(0, 20), // Show first 20 for feedback
        total,
      },
    });
  }
);

export default router;
