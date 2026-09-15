import jwt from 'jsonwebtoken';
import type { OtpPurpose } from '../services/otp.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-env';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const VERIFY_EXPIRES_IN = '15m';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface VerificationPayload {
  email: string;
  purpose: OtpPurpose;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/** Short-lived token proving the email was verified via OTP, used during signup. */
export function signVerificationToken(payload: VerificationPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: VERIFY_EXPIRES_IN });
}

export function verifyVerificationToken(token: string): VerificationPayload {
  return jwt.verify(token, JWT_SECRET) as VerificationPayload;
}