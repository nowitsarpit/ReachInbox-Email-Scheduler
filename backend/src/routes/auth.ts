import { Router, type Request, type Response } from 'express';
import {
  generateOAuthState,
  buildAuthorizationUrl,
  consumeOAuthState,
  exchangeCodeForIdentity,
  OAuthNotConfiguredError,
} from '../lib/oauth.js';
import { prisma } from '../lib/prisma.js';
import { createSession, revokeSession, SESSION_COOKIE_NAME, COOKIE_OPTIONS } from '../lib/session.js';
import { requireAuth } from '../middleware/auth.js';
import { writeAuditLog } from '../lib/audit.js';
import { env } from '../config/env.js';
import { ROLE_PERMISSIONS } from '@gomail/shared';

const router = Router();

/**
 * GET /api/v1/auth/google
 * Initiate Google OAuth flow. Generates state, nonce, PKCE verifier.
 */
router.get('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const stateData = await generateOAuthState(
      (req.query['redirect'] as string) || '/app'
    );
    const authUrl = await buildAuthorizationUrl(stateData);
    res.redirect(authUrl);
  } catch (err) {
    if (err instanceof OAuthNotConfiguredError) {
      res.status(503).json({
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message: err.message,
          requestId: req.requestId,
        },
      });
      return;
    }
    throw err;
  }
});

/**
 * GET /api/v1/auth/google/callback
 * Google OAuth callback. Validates code, creates/updates user, creates session.
 */
router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error: oauthError } = req.query as Record<string, string>;

  // Handle user denial
  if (oauthError) {
    res.redirect(`${env.FRONTEND_URL}/login?error=access_denied`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${env.FRONTEND_URL}/login?error=invalid_callback`);
    return;
  }

  // Consume the state from Redis (one-time use)
  const stateData = await consumeOAuthState(state);
  if (!stateData) {
    res.redirect(`${env.FRONTEND_URL}/login?error=invalid_state`);
    return;
  }

  let identity;
  try {
    identity = await exchangeCodeForIdentity(code, stateData);
  } catch (err) {
    console.error('[Auth] Token exchange failed:', err);
    res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
    return;
  }

  // Find or create user + organization in a transaction
  const { user, organizationId } = await prisma.$transaction(async (tx) => {
    // Find existing OAuth identity
    let oauthIdentity = await tx.oAuthIdentity.findUnique({
      where: { provider_providerSub: { provider: 'google', providerSub: identity.sub } },
      include: { user: true },
    });

    let existingUser = oauthIdentity?.user;

    if (!existingUser) {
      // Check if email already exists (different provider)
      existingUser = await tx.user.findUnique({ where: { email: identity.email } }) ?? undefined;

      if (!existingUser) {
        // Create new user
        existingUser = await tx.user.create({
          data: {
            email: identity.email,
            name: identity.name,
            avatarUrl: identity.picture,
          },
        });
      }

      // Create OAuth identity linked to user
      oauthIdentity = await tx.oAuthIdentity.create({
        data: {
          userId: existingUser.id,
          provider: 'google',
          providerSub: identity.sub,
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.picture,
        },
        include: { user: true },
      });
    }

    // Update last login
    await tx.user.update({
      where: { id: existingUser.id },
      data: { lastLoginAt: new Date(), avatarUrl: identity.picture },
    });

    // Find or create organization for this user
    let membership = await tx.organizationMember.findFirst({
      where: { userId: existingUser.id, removedAt: null },
      include: { organization: true },
    });

    let orgId: string;

    if (!membership) {
      // First login — create a personal organization
      const slug = identity.email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const uniqueSlug = `${slug}-${Date.now()}`;

      const org = await tx.organization.create({
        data: {
          name: identity.name ? `${identity.name}'s Organization` : 'My Organization',
          slug: uniqueSlug,
        },
      });

      membership = await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: existingUser.id,
          role: 'OWNER',
          joinedAt: new Date(),
        },
        include: { organization: true },
      });

      orgId = org.id;
    } else {
      orgId = membership.organizationId;
    }

    return { user: existingUser, organizationId: orgId };
  });

  // Create session
  const { token } = await createSession({
    userId: user.id,
    organizationId,
    ...(req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : {}),
    ...(req.ip ? { ipAddress: req.ip } : {}),
  });

  // Write audit log
  await writeAuditLog({
    organizationId,
    userId: user.id,
    action: 'user.login',
    ...(req.ip ? { ipAddress: req.ip } : {}),
    ...(req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : {}),
  });

  // Set HttpOnly cookie — NEVER put token in URL
  res.cookie(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
  res.redirect(`${env.FRONTEND_URL}${stateData.redirectAfter ?? '/app'}`);
});

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile and permissions.
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: user.organizationId, removedAt: null },
    include: {
      organization: { select: { id: true, name: true, slug: true, avatarUrl: true } },
    },
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    organization: membership?.organization,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  });
});

/**
 * POST /api/v1/auth/logout
 * Revokes the current session.
 */
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string;

  if (token) {
    await revokeSession(token);
    await writeAuditLog({
      organizationId: req.user!.organizationId,
      userId: req.user!.id,
      action: 'user.logout',
    });
  }

  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

/**
 * GET /api/v1/auth/status
 * Simple check for OAuth configuration status (for login page to display helpful messages).
 */
router.get('/status', (_req: Request, res: Response): void => {
  const configured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  res.json({
    oauthConfigured: configured,
    provider: 'google',
    configurationUrl: configured ? null :
      'https://console.cloud.google.com/apis/credentials — Create OAuth 2.0 Client ID, set callback to ' +
      env.GOOGLE_CALLBACK_URL,
  });
});

export default router;
