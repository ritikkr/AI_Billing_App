import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);
    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const id = newId();
    const passwordHash = await hashPassword(password);
    db.prepare(`INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`).run(
      id,
      name,
      email.toLowerCase(),
      passwordHash
    );

    const token = signToken({ userId: id, email: email.toLowerCase() });
    res.status(201).json({ token, user: { id, name, email: email.toLowerCase() } });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase()) as any;
    if (!user || !user.is_active) throw new ApiError(401, 'Invalid email or password');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid email or password');

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const memberships = db
      .prepare(
        `SELECT ucr.company_id as companyId, ucr.role, c.name as companyName
         FROM user_company_roles ucr JOIN companies c ON c.id = ucr.company_id
         WHERE ucr.user_id = ? ORDER BY c.name`
      )
      .all(req.user!.id);
    res.json({ user: req.user, memberships });
  })
);
