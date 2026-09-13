import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { db } from '../db/connection.js';
import { ApiError } from '../utils/asyncHandler.js';

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
      companyId?: string;
      companyRole?: 'admin' | 'accountant' | 'viewer';
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header');
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    const user = db.prepare(`SELECT id, email, name, is_active FROM users WHERE id = ?`).get(payload.userId) as any;
    if (!user || !user.is_active) {
      throw new ApiError(401, 'User not found or inactive');
    }
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'Invalid or expired token');
  }
}

/**
 * Resolves the active company from the X-Company-Id header (or :companyId
 * route param) and verifies the authenticated user is a member, attaching
 * their role for this company onto the request.
 */
export function requireCompany(req: Request, res: Response, next: NextFunction) {
  const companyId = (req.params.companyId as string) || (req.headers['x-company-id'] as string);
  if (!companyId) throw new ApiError(400, 'X-Company-Id header (or :companyId param) is required');
  const membership = db
    .prepare(`SELECT role FROM user_company_roles WHERE user_id = ? AND company_id = ?`)
    .get(req.user!.id, companyId) as any;
  if (!membership) throw new ApiError(403, 'You do not have access to this company');
  req.companyId = companyId;
  req.companyRole = membership.role;
  next();
}

export function requireRole(...roles: Array<'admin' | 'accountant' | 'viewer'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.companyRole || !roles.includes(req.companyRole)) {
      throw new ApiError(403, `This action requires one of the following roles: ${roles.join(', ')}`);
    }
    next();
  };
}
