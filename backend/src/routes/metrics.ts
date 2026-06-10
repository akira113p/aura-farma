import { Router } from 'express';
import { getMetrics } from '../lib/metrics';

export const metricsRouter = Router();

// GET /api/metrics — snapshot de métricas de performance/saúde do processo.
// Protegido por auth (montado com requireAuth em index.ts).
metricsRouter.get('/', (_req, res) => {
  res.json(getMetrics());
});
