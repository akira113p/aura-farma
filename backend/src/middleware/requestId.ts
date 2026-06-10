import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from '../lib/requestContext';

/**
 * Helper de log estruturado (NDJSON) replicada inline: o logger compartilhado
 * (`lib/logger.ts`) ainda não existe neste branch. Mesmo shape de campos:
 * `{ ts, level, msg, requestId?, ...contexto }`, uma linha JSON por evento.
 */
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

const configuredLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
const threshold = LOG_LEVELS.includes(configuredLevel as LogLevel)
  ? LOG_LEVELS.indexOf(configuredLevel as LogLevel)
  : LOG_LEVELS.indexOf('info');

function log(level: LogLevel, msg: string, ctx: Record<string, unknown>): void {
  if (LOG_LEVELS.indexOf(level) < threshold) return;
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...ctx }));
}

/**
 * Atribui um id a cada request (do header `X-Request-Id` de entrada ou gerado),
 * ecoa no header de resposta, propaga via AsyncLocalStorage e emite um access
 * log estruturado quando a resposta termina.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.trim() !== ''
      ? incoming.trim().slice(0, 200)
      : randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log('info', 'http.request', {
      requestId: id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Math.round(ms * 1000) / 1000,
    });
  });

  requestContext.run({ requestId: id }, next);
}
