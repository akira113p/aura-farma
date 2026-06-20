import type { NextFunction, Request, Response } from 'express';
import { als, logger } from '../lib/logger';
import { REQUEST_ID_HEADER, resolveRequestId } from '../lib/requestId';
import { getMetrics, recordRequest } from '../lib/metrics';
import { checkAlerts, checkRequestLatency } from '../lib/alerts';

/**
 * Os alertas de sistema (memória + taxa de erro) montam um snapshot de métricas
 * (cópia+ordenação da janela de latências + syscalls). Avaliar isso a cada
 * resposta sairia caro sob alto RPS, e os alertas têm cooldown próprio de toda
 * forma — então limitamos a no máximo uma avaliação a cada SYSTEM_CHECK_MS.
 */
const SYSTEM_CHECK_MS = 5_000;
let lastSystemCheck = 0;

/**
 * Middleware de contexto de requisição (regras 1, 3, 7, 9):
 * - gera/propaga o request ID (cabeçalho `X-Request-Id`);
 * - anexa `req.requestId` e expõe o ID via AsyncLocalStorage (sem prop-drilling);
 * - mede a latência com `process.hrtime.bigint()`;
 * - ao finalizar a resposta, registra métricas, avalia alertas e loga uma
 *   linha JSON `{ requestId, method, path, status, ms }`.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req);
  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const start = process.hrtime.bigint();

  // 'finish' = resposta enviada com sucesso; 'close' = conexão encerrada
  // (cliente abortou / socket caiu). Sem o fallback de 'close', requisições
  // abortadas sumiriam das métricas/logs. `finalize` roda uma única vez.
  let finalized = false;
  const finalize = (aborted: boolean) => {
    if (finalized) return;
    finalized = true;

    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const rounded = Math.round(ms * 10) / 10;

    recordRequest(res.statusCode, rounded);

    logger.info('requisicao concluida', {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      ms: rounded,
      ...(aborted ? { aborted: true } : {}),
    });

    // Alerta barato de latência por requisição.
    checkRequestLatency(rounded);

    // Alerta de sistema (memória/taxa de erro): limitado no tempo.
    const now = Date.now();
    if (now - lastSystemCheck >= SYSTEM_CHECK_MS) {
      lastSystemCheck = now;
      checkAlerts(getMetrics());
    }
  };

  res.on('finish', () => finalize(false));
  res.on('close', () => finalize(!res.writableFinished));

  // Roda o restante da cadeia dentro do contexto async para que o logger e o
  // errorHandler enxerguem o requestId automaticamente.
  als.run({ requestId }, () => next());
}
