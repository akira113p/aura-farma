// Alertas por threshold (regra 9). Compara o snapshot corrente de métricas com
// limites configuráveis (env) e emite log estruturado JSON no stdout quando
// excede. Debounce simples por tipo para não floodar o log.
import { env } from '../config/env';
import type { Metrics } from './metrics';

/** Janela de debounce: não repete o MESMO alerta antes deste intervalo. */
const DEBOUNCE_MS = 60_000;

/** Último timestamp (ms epoch) em que cada tipo de alerta foi logado. */
const lastFired = new Map<string, number>();

/** Emite o log estruturado de alerta, respeitando o debounce por tipo. */
function fire(tipo: string, value: number, threshold: number): void {
  const now = Date.now();
  const last = lastFired.get(tipo) ?? 0;
  if (now - last < DEBOUNCE_MS) return;
  lastFired.set(tipo, now);

  // Mesmo shape do logger estruturado (lib/logger.ts da Unit 1, ausente aqui):
  // { ts, level, msg, ...contexto }. Replicado inline de propósito.
  const entry = {
    ts: new Date(now).toISOString(),
    level: 'warn',
    msg: `alert.${tipo}`,
    value,
    threshold,
  };
  console.log(JSON.stringify(entry));
}

/**
 * Avalia o snapshot e dispara alertas para: p95 de latência (ms), error rate e
 * memória RSS (MB). Os thresholds vêm de `env`. Chamado após cada request.
 */
export function checkAlerts(snapshot: Metrics): void {
  if (snapshot.latency.p95 > env.alertP95Ms) {
    fire('latency_p95', snapshot.latency.p95, env.alertP95Ms);
  }

  if (snapshot.errorRate > env.alertErrorRate) {
    fire('error_rate', snapshot.errorRate, env.alertErrorRate);
  }

  const rssMb = snapshot.memory.rss / (1024 * 1024);
  if (rssMb > env.alertMemMb) {
    fire('memory_rss_mb', Math.round(rssMb), env.alertMemMb);
  }
}
