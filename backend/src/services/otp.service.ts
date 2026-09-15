import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { ApiError } from '../utils/asyncHandler.js';
import { sendOtpEmail } from './email.service.js';

export type OtpPurpose = 'register' | 'login' | 'reset';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_WINDOW_MS = 60 * 1000;

function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Creates an OTP for `email`, rate-limits resends to once per minute, and
 * delivers it by email. Returns the OTP so callers can log it in dev.
 */
export async function issueOtp(email: string, purpose: OtpPurpose): Promise<string> {
  const emailKey = email.toLowerCase();
  const existing = (await db
    .prepare(`SELECT id, created_at FROM email_otps WHERE email = ? AND purpose = ?`)
    .get(emailKey, purpose)) as any;

  if (existing) {
    const createdAt = Date.parse(`${existing.created_at.replace(' ', 'T')}Z`);
    if (Number.isFinite(createdAt) && Date.now() - createdAt < RESEND_WINDOW_MS) {
      throw new ApiError(429, 'Please wait a minute before requesting another code');
    }
    await db.prepare(`DELETE FROM email_otps WHERE id = ?`).run(existing.id);
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  await db
    .prepare(`INSERT INTO email_otps (id, email, otp, purpose, expires_at) VALUES (?, ?, ?, ?, ?)`)
    .run(newId(), emailKey, otp, purpose, expiresAt);

  await sendOtpEmail(emailKey, otp);
  return otp;
}

/** Validates an OTP for `email`. Throws on anything invalid/expired. */
export async function consumeOtp(email: string, otp: string, purpose: OtpPurpose): Promise<void> {
  const emailKey = email.toLowerCase();
  const row = (await db
    .prepare(
      `SELECT id FROM email_otps
       WHERE email = ? AND purpose = ? AND otp = ? AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(emailKey, purpose, otp, new Date().toISOString())) as any;

  if (!row) throw new ApiError(400, 'Invalid or expired verification code');
  await db.prepare(`DELETE FROM email_otps WHERE id = ?`).run(row.id);
}