import type { NextFunction, Request, Response } from 'express';

/** An error with an HTTP status and optional field-level details. */
export class AppError extends Error {
  status: number;
  details?: Record<string, string>;
  /** Contexto livre para o log estruturado (não vai para a resposta do client). */
  context?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    details?: Record<string, string>,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
    this.context = context;
  }
}

/** Wrap an async route handler so thrown/rejected errors reach the error middleware. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
