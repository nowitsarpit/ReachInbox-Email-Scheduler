import type { Request, Response, NextFunction } from 'express';
import { ROLE_PERMISSIONS } from '@gomail/shared';
import type { Permission } from '@gomail/shared';
import type { OrganizationRole } from '@gomail/shared';

/**
 * Server-side RBAC permission check.
 * Frontend permission checks are for UX only — authorization happens here.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
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

    const role = req.user.role as OrganizationRole;
    const permissions = ROLE_PERMISSIONS[role] ?? [];

    if (!permissions.includes(permission)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Permission denied: ${permission}`,
          requestId: req.requestId,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Enforce tenant isolation: ensure the requested resource's organizationId
 * matches the authenticated user's organizationId.
 */
export function enforceOrganizationScope(
  getResourceOrgId: (req: Request) => string | null | undefined
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resourceOrgId = getResourceOrgId(req);
    const userOrgId = req.user?.organizationId;

    if (!userOrgId || !resourceOrgId || resourceOrgId !== userOrgId) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this resource',
          requestId: req.requestId,
        },
      });
      return;
    }

    next();
  };
}
