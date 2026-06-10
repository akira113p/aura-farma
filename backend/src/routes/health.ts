import { Router } from 'express';
import mongoose from 'mongoose';
import pkg from '../../package.json' with { type: 'json' };

export const healthRouter = Router();

// GET /api/health — LIVENESS. Sempre 200 enquanto o processo viver (sem auth).
// Mantém `ok: true` por retrocompatibilidade (Render usa este path como healthCheck).
healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    status: 'ok',
    uptime: process.uptime(),
    version: pkg.version,
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    mongo: mongoose.connection.readyState,
  });
});

// GET /api/health/ready — READINESS. 200 só quando o Mongo está conectado (1);
// caso contrário 503 para o orquestrador segurar tráfego até o banco subir.
healthRouter.get('/ready', (_req, res) => {
  const state = mongoose.connection.readyState;
  if (state === 1) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, mongo: state });
  }
});
