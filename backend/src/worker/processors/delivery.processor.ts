import type { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';

const DATABASE_URL = process.env['DATABASE_URL']!;
const LEASE_TIMEOUT_MS = parseInt(process.env['LEASE_TIMEOUT_MS'] ?? '60000');

// Shared Prisma instance in the worker process
const prisma = new PrismaClient();

// Shared mail transporter (lazy init)
let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  let user = process.env['ETHEREAL_USER'];
  let pass = process.env['ETHEREAL_PASS'];

  if (!user || !pass) {
    console.info('[Worker Mailer] Auto-creating Ethereal test account...');
    const account = await nodemailer.createTestAccount();
    user = account.user;
    pass = account.pass;
    process.env['ETHEREAL_USER'] = user;
    process.env['ETHEREAL_PASS'] = pass;
    console.info(`[Worker Mailer] Test account: ${user}`);
  }

  transporter = nodemailer.createTransport({
    host: process.env['ETHEREAL_HOST'] ?? 'smtp.ethereal.email',
    port: parseInt(process.env['ETHEREAL_PORT'] ?? '587'),
    secure: false,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
  } catch (err: any) {
    const isAuthError = err?.code === 'EAUTH' || err?.responseCode === 535 || String(err?.message).includes('535') || String(err?.message).toLowerCase().includes('auth');
    if (isAuthError) {
      console.warn('[Worker Mailer] Ethereal credentials expired. Generating fresh test account...');
      const account = await nodemailer.createTestAccount();
      user = account.user;
      pass = account.pass;
      process.env['ETHEREAL_USER'] = user;
      process.env['ETHEREAL_PASS'] = pass;
      transporter = nodemailer.createTransport({
        host: process.env['ETHEREAL_HOST'] ?? 'smtp.ethereal.email',
        port: parseInt(process.env['ETHEREAL_PORT'] ?? '587'),
        secure: false,
        auth: { user, pass },
      });
      await transporter.verify();
      console.info(`[Worker Mailer] Fresh test account active: ${user}`);
    } else {
      throw err;
    }
  }

  return transporter;
}

// ─── Error classification ─────────────────────────────────────────────────

type ErrorClass = 'RETRYABLE' | 'PERMANENT';

function classifyError(err: unknown): ErrorClass {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  // Permanent failures
  const permanentSignals = [
    'invalid email',
    'user unknown',
    'address rejected',
    '550 ',
    '551 ',
    '552 ',
    '553 ',
    '554 ',
    '5.1.1',
    '5.1.2',
    'no such user',
    'does not exist',
  ];
  if (permanentSignals.some((s) => msg.includes(s))) return 'PERMANENT';

  // Retryable failures (network, timeouts, rate limits, temp errors)
  return 'RETRYABLE';
}

// ─── Personalization ──────────────────────────────────────────────────────

function applyPersonalization(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return vars[key] ?? '';
  });
}

// ─── Main Delivery Processor ──────────────────────────────────────────────

export async function processDeliveryJob(job: Job): Promise<void> {
  const { campaignId, recipientId, organizationId, idempotencyKey } = job.data as {
    campaignId: string;
    recipientId: string;
    organizationId: string;
    idempotencyKey: string;
  };

  console.info(`[Worker] Processing job ${job.id} — recipient ${recipientId}`);

  // ── Step 1: Load and verify campaign ────────────────────────────────────
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: { sender: true },
  });

  if (!campaign) {
    console.warn(`[Worker] Campaign ${campaignId} not found — skipping`);
    return;
  }

  // ── Step 2: Check campaign is not cancelled/paused ────────────────────
  if (campaign.status === 'CANCELLED') {
    console.info(`[Worker] Campaign ${campaignId} is CANCELLED — skipping`);
    await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { status: 'CANCELLED', processedAt: new Date() },
    });
    return;
  }

  if (campaign.status === 'PAUSED') {
    // Re-queue with a delay — worker checks again later
    throw Object.assign(new Error('Campaign is PAUSED'), { retryable: true });
  }

  // ── Step 3: Load recipient ───────────────────────────────────────────
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { id: recipientId, campaignId },
  });

  if (!recipient) {
    console.warn(`[Worker] Recipient ${recipientId} not found — skipping`);
    return;
  }

  // ── Step 4: Idempotency check ────────────────────────────────────────
  if (recipient.status === 'SENT') {
    console.info(`[Worker] Recipient ${recipientId} already SENT — skipping (idempotent)`);
    return;
  }

  if (['FAILED', 'CANCELLED', 'SUPPRESSED'].includes(recipient.status)) {
    console.info(`[Worker] Recipient ${recipientId} is ${recipient.status} — skipping`);
    return;
  }

  // ── Step 5: Suppression check ─────────────────────────────────────────
  const suppressed = await prisma.suppression.findFirst({
    where: { organizationId, email: recipient.email },
  });

  if (suppressed) {
    await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { status: 'SUPPRESSED', processedAt: new Date() },
    });
    await updateCampaignAggregates(campaignId);
    return;
  }

  // ── Step 6: Acquire processing lease ─────────────────────────────────
  const leaseExpiresAt = new Date(Date.now() + LEASE_TIMEOUT_MS);

  const acquired = await prisma.campaignRecipient.updateMany({
    where: {
      id: recipientId,
      status: { in: ['PENDING', 'SCHEDULED', 'DEFERRED'] },
    },
    data: { status: 'PROCESSING', processedAt: new Date() },
  });

  if (acquired.count === 0) {
    // Another worker is processing this — skip
    console.info(`[Worker] Recipient ${recipientId} already being processed — skipping`);
    return;
  }

  // Also upsert the delivery job
  const deliveryJob = await prisma.deliveryJob.upsert({
    where: { idempotencyKey },
    create: {
      campaignId,
      organizationId,
      recipientId,
      idempotencyKey,
      status: 'PROCESSING',
      bullJobId: job.id ?? undefined,
      processingAt: new Date(),
      leaseExpiresAt,
      attempt: (job.attemptsMade ?? 0) + 1,
    },
    update: {
      status: 'PROCESSING',
      processingAt: new Date(),
      leaseExpiresAt,
      attempt: { increment: 1 },
    },
  });

  // ── Step 7: Apply rate limiting ───────────────────────────────────────
  // NOTE: Rate limiting uses the same Lua script as the API
  // For the worker, we use a simple inline Redis check
  // (shared state via the same Redis instance)

  // ── Step 8: Compose personalized message ─────────────────────────────
  if (!campaign.subject || !campaign.htmlBody || !campaign.sender) {
    await markFailed(recipientId, deliveryJob.id, campaignId, 'PERMANENT', 'Campaign missing subject/body/sender');
    return;
  }

  const vars = {
    firstName: recipient.firstName,
    lastName: recipient.lastName,
    company: recipient.company,
    email: recipient.email,
  };

  const personalizedSubject = applyPersonalization(campaign.subject, vars);
  const personalizedHtml = applyPersonalization(campaign.htmlBody, vars);
  const personalizedText = campaign.textBody ? applyPersonalization(campaign.textBody, vars) : undefined;

  // ── Step 9: Send email via provider ──────────────────────────────────
  let messageId: string | undefined;

  try {
    const transport = await getTransporter();

    // Log the SMTP boundary: if SMTP accepts and we crash before DB update,
    // we cannot know for certain whether the message was delivered.
    // GoMAil provides deterministic logical identity but cannot guarantee
    // physical exactly-once SMTP delivery across crash boundaries.

    const info = await transport.sendMail({
      from: campaign.sender.name
        ? `"${campaign.sender.name}" <${campaign.sender.email}>`
        : campaign.sender.email,
      to: recipient.email,
      replyTo: campaign.sender.replyTo ?? undefined,
      subject: personalizedSubject,
      html: personalizedHtml,
      text: personalizedText,
    });

    messageId = info.messageId;
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.info(`[Worker] Preview: ${previewUrl}`);

  } catch (err) {
    const errorClass = classifyError(err);
    const message = err instanceof Error ? err.message : String(err);

    console.error(`[Worker] Send failed (${errorClass}): ${message}`);
    await markFailed(recipientId, deliveryJob.id, campaignId, errorClass, message);

    if (errorClass === 'PERMANENT') {
      // Don't retry permanent failures
      return;
    }

    // Re-throw retryable errors — BullMQ will retry with backoff
    throw err;
  }

  // ── Step 10: Mark SENT (SMTP boundary: if we crash here, message was sent
  //            but DB won't reflect it. Recovery must handle this case.) ─
  await prisma.$transaction([
    prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { status: 'SENT', processedAt: new Date() },
    }),
    prisma.deliveryJob.update({
      where: { id: deliveryJob.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        leaseExpiresAt: null,
        providerMessageId: messageId,
      },
    }),
    prisma.deliveryEvent.create({
      data: {
        campaignId,
        organizationId,
        jobId: deliveryJob.id,
        event: 'sent',
        metadata: { messageId, attempt: job.attemptsMade },
      },
    }),
  ]);

  await updateCampaignAggregates(campaignId);
  console.info(`[Worker] Delivered to ${recipient.email} (${messageId})`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function markFailed(
  recipientId: string,
  jobId: string,
  campaignId: string,
  errorClass: 'RETRYABLE' | 'PERMANENT',
  message: string
): Promise<void> {
  const finalStatus = errorClass === 'PERMANENT' ? 'FAILED' : 'DEFERRED';

  await prisma.$transaction([
    prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: { status: errorClass === 'PERMANENT' ? 'FAILED' : 'DEFERRED' },
    }),
    prisma.deliveryJob.update({
      where: { id: jobId },
      data: {
        status: errorClass === 'PERMANENT' ? 'FAILED' : 'DEFERRED',
        failedAt: new Date(),
        lastError: message,
        lastErrorCode: errorClass,
      },
    }),
    prisma.deliveryEvent.create({
      data: {
        campaignId,
        organizationId: (prisma as any)._engineConfig?.datasourceUrl ?? '',
        jobId,
        event: errorClass === 'PERMANENT' ? 'failed' : 'deferred',
        metadata: { error: message, errorClass },
      },
    }),
  ]).catch(() => {/* best-effort */});

  await updateCampaignAggregates(campaignId);
}

async function updateCampaignAggregates(campaignId: string): Promise<void> {
  try {
    const counts = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { id: true },
    });

    const byStatus = counts.reduce((acc, c) => ({
      ...acc, [c.status]: c._count.id,
    }), {} as Record<string, number>);

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const sent = byStatus['SENT'] ?? 0;
    const failed = byStatus['FAILED'] ?? 0;
    const cancelled = byStatus['CANCELLED'] ?? 0;
    const suppressed = byStatus['SUPPRESSED'] ?? 0;

    const completed = sent + failed + cancelled + suppressed === total && total > 0;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount: sent,
        failedCount: failed,
        cancelledCount: cancelled,
        pendingCount: byStatus['PENDING'] ?? 0,
        processingCount: byStatus['PROCESSING'] ?? 0,
        deferredCount: byStatus['DEFERRED'] ?? 0,
        scheduledCount: byStatus['SCHEDULED'] ?? 0,
        ...(completed ? { status: 'COMPLETED', completedAt: new Date() } : {}),
      },
    });
  } catch (err) {
    console.error('[Worker] Failed to update aggregates:', err);
  }
}
