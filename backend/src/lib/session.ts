import crypto from 'crypto';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';

const SESSION_DURATION_MS = env.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

function generateSessionToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface SessionData {
  id: string;
  userId: string;
  organizationId: string;
  expiresAt: Date;
  lastSeenAt: Date;
}

export interface CreateSessionOptions {
  userId: string;
  organizationId: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function createSession(opts: CreateSessionOptions): Promise<{
  token: string;
  session: SessionData;
}> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const session = await prisma.session.create({
    data: {
      userId: opts.userId,
      organizationId: opts.organizationId,
      sessionTokenHash: tokenHash,
      expiresAt,
      userAgent: opts.userAgent,
      ipAddress: opts.ipAddress,
    },
  });

  return {
    token,
    session: {
      id: session.id,
      userId: session.userId,
      organizationId: session.organizationId,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt,
    },
  };
}

export async function validateSession(token: string): Promise<SessionData | null> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const session = await prisma.session.findFirst({
    where: {
      sessionTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });

  if (!session) return null;

  // Update lastSeenAt (non-blocking)
  prisma.session
    .update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    })
    .catch(() => {/* non-critical */});

  return {
    id: session.id,
    userId: session.userId,
    organizationId: session.organizationId,
    expiresAt: session.expiresAt,
    lastSeenAt: now,
  };
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.updateMany({
    where: {
      sessionTokenHash: tokenHash,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

// Cookie configuration
export const SESSION_COOKIE_NAME = 'gomail_session';
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_MS / 1000, // seconds
};
