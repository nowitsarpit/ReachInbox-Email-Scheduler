import crypto from 'crypto';

/**
 * Generate a deterministic idempotency key for a campaign recipient.
 * SHA-256(campaignId:normalizedEmail)
 */
export function generateIdempotencyKey(campaignId: string, normalizedEmail: string): string {
  return crypto
    .createHash('sha256')
    .update(`${campaignId}:${normalizedEmail}`)
    .digest('hex');
}

/**
 * Normalize an email address for consistent comparison and deduplication.
 * Lowercases, trims, and handles Gmail dot-trick.
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return trimmed;

  // Handle Gmail dot trick
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const normalizedLocal = local.replace(/\./g, '').split('+')[0] ?? local;
    return `${normalizedLocal}@${domain}`;
  }

  // Handle plus addressing for other providers
  const baseLocal = local.split('+')[0] ?? local;
  return `${baseLocal}@${domain}`;
}

/**
 * Validate email format using RFC 5322 compliant regex.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim()) && email.length <= 254;
}

/**
 * Generate a secure API key with prefix.
 * Returns the full key (display once) and the hash for storage.
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const rawKey = `gm_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = rawKey.substring(0, 10);
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { key: rawKey, prefix, hash };
}

/**
 * Hash an API key for storage lookup.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a BullMQ job ID from an idempotency key.
 */
export function toBullJobId(idempotencyKey: string): string {
  return `gomail:${idempotencyKey}`;
}
