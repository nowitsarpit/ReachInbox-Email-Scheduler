import type { Request, Response, NextFunction } from 'express';
import { validateSession } from '../lib/session.js';
import { prisma } from '../lib/prisma.js';
import { SESSION_COOKIE_NAME } from '../lib/session.js';
import type { OrganizationRole } from '@gomail/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  organizationId: string;
  role: OrganizationRole;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Validates the session cookie and attaches user to req.user.
 * Does not reject unauthenticated requests — use requireAuth for that.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (!token) {
      next();
      return;
    }

    const session = await validateSession(token);
    if (!session) {
      next();
      return;
    }

    // Load user + membership in a single query
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.userId,
        organizationId: session.organizationId,
        removedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            deactivatedAt: true,
          },
        },
      },
    });

    if (!membership || membership.user.deactivatedAt) {
      next();
      return;
    }

    req.user = {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      avatarUrl: membership.user.avatarUrl,
      organizationId: session.organizationId,
      role: membership.role,
      sessionId: session.id,
    };
  } catch {
    // Authentication errors should not crash the server
  }

  next();
}

/**
 * Requires an authenticated user. Returns 401 if not authenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.requestId,
      },
    });
    return;
  }
  next();
}
