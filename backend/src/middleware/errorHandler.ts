import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { ApiError } from '../utils/asyncHandler.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large (max 10MB)' });
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A record with this value already exists' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
