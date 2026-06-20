import { Router } from 'express';
import mongoose from 'mongoose';
import { getMetrics } from '../lib/metrics';

/**
 * Health check detalhado e legível para leigos, em JSON pt-BR (regra 4).
 *
 * IMPORTANTE: mantém `ok: true` para compatibilidade com o smoke test, que
 * checa esse campo. Acrescenta status geral, estado do Mongo, uptime,
 * memória, versão e timestamp.
 *
 * Esta rota é pública (montada antes do `requireAuth`, e usada pelo health
 * check do Render). Por isso NÃO expõe perfil de tráfego/erros (total de
 * requisições, taxa de erro, latência), que ajudaria a mirar capacidade/DoS.
 * Essas métricas ficam disponíveis internamente via `getMetrics()`.
 */
export const healthRouter = Router();

/** Estados de conexão do Mongoose mapeados para texto legível. */
const MONGO_STATES: Record<number, string> = {
  0: 'desconectado',
  1: 'conectado',
  2: 'conectando',
  3: 'desconectando',
};

const VERSION = process.env.npm_package_version ?? process.env.APP_VERSION ?? '0.0.0';

healthRouter.get('/', (_req, res) => {
  const metrics = getMetrics();
  const mongoState = mongoose.connection.readyState;
  const mongoOk = mongoState === 1;

  // "ok" reflete a saúde operacional; mantido true salvo se o Mongo cair.
  const ok = mongoOk;

  res.json({
    ok,
    status: ok ? 'saudavel' : 'degradado',
    versao: VERSION,
    timestamp: new Date().toISOString(),
    uptimeSegundos: metrics.uptimeSec,
    banco: {
      conectado: mongoOk,
      estado: MONGO_STATES[mongoState] ?? 'desconhecido',
    },
    memoria: {
      rssMb: metrics.memoria.rssMb,
      heapUsadoMb: metrics.memoria.heapUsadoMb,
    },
  });
});
