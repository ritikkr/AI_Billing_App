import type { NextFunction, Request, Response } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/** Wraps an async route handler so rejected promises are forwarded to Express's error middleware. */
export function asyncHandler(fn: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
