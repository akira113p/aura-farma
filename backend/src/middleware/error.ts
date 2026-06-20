import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/http';
import { logger } from '../lib/logger';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Rota não encontrada' });
}

/** Contexto comum logado em todo erro (sem segredos). */
function errorContext(req: Request) {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    userId: req.session?.userId,
  };
}

// 4-arg signature is required for Express to treat this as an error handler.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Validation errors → 400 with field-level messages
  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'form';
      if (!details[key]) details[key] = issue.message;
    }
    logger.warn('erro de validacao', { ...errorContext(req), details });
    res.status(400).json({ error: 'Dados inválidos', details });
    return;
  }

  if (err instanceof AppError) {
    // Erros de negócio esperados: nível conforme severidade do status.
    const level = err.status >= 500 ? 'error' : 'warn';
    logger[level]('erro de aplicacao', {
      ...errorContext(req),
      status: err.status,
      message: err.message,
      details: err.details,
      stack: err.status >= 500 ? err.stack : undefined,
    });
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  // Erro desconhecido: loga stack trace completo + contexto (regra 2),
  // mas NUNCA vaza o stack na resposta HTTP.
  const stack = err instanceof Error ? err.stack : undefined;
  const message = err instanceof Error ? err.message : String(err);
  logger.error('erro interno nao tratado', {
    ...errorContext(req),
    message,
    stack,
  });
  res.status(500).json({ error: 'Erro interno do servidor' });
}
