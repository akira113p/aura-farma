import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/http';
import { env } from '../config/env';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Rota não encontrada' });
}

/**
 * Log estruturado (NDJSON) inline — mesmo shape do logger compartilhado da
 * iniciativa de observabilidade. Não importa lib/logger.ts (não existe neste branch).
 */
function logError(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

// 4-arg signature is required for Express to treat this as an error handler.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const e = err as { name?: string; message?: string; stack?: string } | undefined;

  // Resolve status + corpo de resposta por tipo de erro.
  let status = 500;
  let body: { error: string; details?: Record<string, string> };

  if (err instanceof ZodError) {
    status = 400;
    const details: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'form';
      if (!details[key]) details[key] = issue.message;
    }
    body = { error: 'Dados inválidos', details };
  } else if (err instanceof AppError) {
    status = err.status;
    body = { error: err.message, details: err.details };
  } else {
    status = 500;
    body = { error: 'Erro interno do servidor' };
  }

  // Log estruturado para TODO erro: stack completo sempre vai para o stdout.
  logError({
    level: status >= 500 ? 'error' : 'warn',
    msg: 'http.error',
    requestId: (req as { id?: string }).id,
    method: req.method,
    path: req.path,
    userId: req.session?.userId,
    status,
    name: e?.name,
    errorMessage: e?.message,
    details: body.details,
    stack: e?.stack,
  });

  // Em dev, expõe o stack no corpo do 500 para facilitar debug local.
  // Em produção, nunca vaza stack para o client.
  if (status >= 500 && !env.isProd && e?.stack) {
    res.status(status).json({ ...body, stack: e.stack });
    return;
  }

  res.status(status).json(body);
}
