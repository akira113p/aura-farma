import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/http';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// 4-arg signature is required for Express to treat this as an error handler.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Validation errors → 400 with field-level messages
  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'form';
      if (!details[key]) details[key] = issue.message;
    }
    res.status(400).json({ error: 'Dados inválidos', details });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
}
