import type { NextFunction, Request, Response } from 'express';
import { recordRequest, getMetrics } from '../lib/metrics';
import { checkAlerts } from '../lib/alerts';

/**
 * Mede a duração de cada request (hrtime) e, ao finalizar a resposta, registra
 * a métrica (rota, status, ms) e avalia os alertas por threshold. Deve ser
 * montado cedo no pipeline para cobrir o máximo de requests.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    // `req.route?.path` só existe quando uma rota casou; cai para `req.path`.
    const route = req.route?.path ?? req.path;
    recordRequest({ route, status: res.statusCode, ms });
    checkAlerts(getMetrics());
  });

  next();
}
