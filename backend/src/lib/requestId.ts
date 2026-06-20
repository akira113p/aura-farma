import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

/** Header padrão de propagação do request ID entre serviços/proxies. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Gera um request ID único (UUID v4).
 */
export function generateRequestId(): string {
  return randomUUID();
}

/** UUID v4 ou formato similar — usado para validar IDs vindos de fora. */
const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Extrai o request ID de entrada (cabeçalho `X-Request-Id`) se presente e
 * dentro de um formato seguro; caso contrário gera um novo.
 * Evita aceitar valores arbitrários/poluídos no log.
 */
export function resolveRequestId(req: Request): string {
  const header = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(header) ? header[0] : header;
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (SAFE_ID.test(trimmed)) return trimmed;
  }
  return generateRequestId();
}
