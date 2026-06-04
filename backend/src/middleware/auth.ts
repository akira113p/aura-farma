import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/http';

/** Block the request unless there's an authenticated session. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    next(new AppError(401, 'Não autenticado'));
    return;
  }
  next();
}
