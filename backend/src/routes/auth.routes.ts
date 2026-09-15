import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken, signVerificationToken, verifyVerificationToken } from '../utils/jwt.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { issueOtp, consumeOtp, type OtpPurpose } from '../services/otp.service.js';

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
  verificationToken: z.string().min(1),
});

const otpSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(['register', 'login', 'reset']).default('register'),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
  purpose: z.enum(['register', 'login', 'reset']).default('register'),
});

/** Validates the OTP verification token was minted for this email + purpose. */
function requireVerifiedEmail(purpose: OtpPurpose, email: string, verificationToken: string) {
  const claimed = verifyVerificationToken(verificationToken);
  if (claimed.purpose !== purpose || claimed.email.toLowerCase() !== email.toLowerCase()) {
    throw new ApiError(400, 'Email has not been verified for this action');
  }
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create an account (email must be OTP-verified first)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, verificationToken]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               verificationToken: { type: string, description: Token returned by POST /api/auth/verify-otp }
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string }
 *       400: { description: Email not verified or invalid payload }
 *       409: { description: Email already registered }
 */
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, verificationToken } = registerSchema.parse(req.body);
    requireVerifiedEmail('register', email, verificationToken);

    const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const id = newId();
    const passwordHash = await hashPassword(password);
    await db.prepare(`INSERT INTO users (id, name, email, password_hash, email_verified) VALUES (?, ?, ?, ?, 1)`).run(
      id,
      name,
      email.toLowerCase(),
      passwordHash
    );

    const token = signToken({ userId: id, email: email.toLowerCase() });
    res.status(201).json({ token, user: { id, name, email: email.toLowerCase() } });
  })
);

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Email a 6-digit verification code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               purpose: { type: string, enum: [register, login, reset], default: register }
 *     responses:
 *       200: { description: Code sent }
 *       409: { description: Email already registered (register purpose) }
 *       429: { description: Please wait before requesting another code }
 */
authRouter.post(
  '/send-otp',
  asyncHandler(async (req, res) => {
    const { email, purpose } = otpSchema.parse(req.body);

    if (purpose === 'register') {
      const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
      if (existing) throw new ApiError(409, 'An account with this email already exists');
    }

    await issueOtp(email, purpose as OtpPurpose);
    res.json({ message: 'Verification code sent' });
  })
);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Validate a code and get a short-lived verification token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, description: 6-digit code, pattern: '^[0-9]{6}$' }
 *               purpose: { type: string, enum: [register, login, reset], default: register }
 *     responses:
 *       200:
 *         description: Code accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verificationToken: { type: string }
 *       400: { description: Invalid or expired code }
 */
authRouter.post(
  '/verify-otp',
  asyncHandler(async (req, res) => {
    const { email, otp, purpose } = verifyOtpSchema.parse(req.body);
    await consumeOtp(email, otp, purpose as OtpPurpose);
    const verificationToken = signVerificationToken({ email: email.toLowerCase(), purpose: purpose as OtpPurpose });
    res.json({ verificationToken });
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
    const user = (await db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase())) as any;
    if (!user || !user.is_active) throw new ApiError(401, 'Invalid email or password');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid email or password');

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  })
);

const loginOtpSchema = z.object({
  email: z.string().email(),
  verificationToken: z.string().min(1),
});

/**
 * @swagger
 * /api/auth/login-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in with an OTP code (alternative to password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, verificationToken]
 *             properties:
 *               email: { type: string, format: email }
 *               verificationToken: { type: string, description: Token returned by POST /api/auth/verify-otp with purpose=login }
 *     responses:
 *       200:
 *         description: Signed in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string }
 *       401: { description: No account for this email }
 *       400: { description: Email not verified for this action }
 */
authRouter.post(
  '/login-otp',
  asyncHandler(async (req, res) => {
    const { email, verificationToken } = loginOtpSchema.parse(req.body);
    const emailKey = email.toLowerCase();
    requireVerifiedEmail('login', emailKey, verificationToken);

    const user = (await db.prepare(`SELECT * FROM users WHERE email = ?`).get(emailKey)) as any;
    if (!user || !user.is_active) throw new ApiError(401, 'No account is linked to this email');

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  })
);

const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(6),
  verificationToken: z.string().min(1),
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set a new password after verifying email via OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, newPassword, verificationToken]
 *             properties:
 *               email: { type: string, format: email }
 *               newPassword: { type: string, minLength: 6 }
 *               verificationToken: { type: string, description: Token returned by POST /api/auth/verify-otp with purpose=reset }
 *     responses:
 *       200: { description: Password updated }
 *       404: { description: No account for this email }
 *       400: { description: Email not verified for this action }
 */
authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { email, newPassword, verificationToken } = resetPasswordSchema.parse(req.body);
    const emailKey = email.toLowerCase();
    requireVerifiedEmail('reset', emailKey, verificationToken);

    const user = (await db.prepare(`SELECT id FROM users WHERE email = ?`).get(emailKey)) as any;
    if (!user) throw new ApiError(404, 'No account is linked to this email');

    const passwordHash = await hashPassword(newPassword);
    await db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, user.id);
    res.json({ message: 'Password updated' });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const memberships = await db
      .prepare(
        `SELECT ucr.company_id as companyId, ucr.role, c.name as companyName
         FROM user_company_roles ucr JOIN companies c ON c.id = ucr.company_id
         WHERE ucr.user_id = ? ORDER BY c.name`
      )
      .all(req.user!.id);
    res.json({ user: req.user, memberships });
  })
);
