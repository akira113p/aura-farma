import { logger } from './logger';
import type { MetricsSnapshot } from './metrics';

/**
 * Alertas configuráveis por thresholds (regra 9 de observabilidade).
 *
 * Cada threshold vem de uma env var; quando cruzado, emite um log
 * `level:'warn'` com `{ alert, value, threshold }`. Sem dependências
 * externas/pagas — apenas um log estruturado que um agregador pode capturar.
 */

function numFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  // Aceita 0 (ex.: ALERT_ERROR_RATE=0 para alertar a qualquer erro); rejeita
  // apenas NaN/negativo.
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const alertThresholds = {
  /** Latência (ms) de uma requisição acima da qual avisa "requisicao_lenta". */
  slowMs: numFromEnv('ALERT_SLOW_MS', 1000),
  /** Memória RSS (MB) acima da qual avisa "memoria_alta". */
  memMb: numFromEnv('ALERT_MEM_MB', 512),
  /** Taxa de erro (0..1) acima da qual avisa "taxa_erro_alta". */
  errorRate: Math.min(1, numFromEnv('ALERT_ERROR_RATE', 0.5)),
  /** Nº mínimo de requisições antes de avaliar a taxa de erro (evita falso positivo). */
  errorRateMinSamples: numFromEnv('ALERT_ERROR_MIN_SAMPLES', 20),
} as const;

/** Antirruído: não repete o mesmo alerta antes deste intervalo (ms). */
const ALERT_COOLDOWN_MS = numFromEnv('ALERT_COOLDOWN_MS', 30_000);
const lastFired = new Map<string, number>();

function fire(alert: string, value: number, threshold: number, extra?: Record<string, unknown>): void {
  const now = Date.now();
  const last = lastFired.get(alert) ?? 0;
  if (now - last < ALERT_COOLDOWN_MS) return;
  lastFired.set(alert, now);
  logger.warn('alerta de anomalia', { alert, value, threshold, ...extra });
}

/**
 * Alerta barato por requisição: avalia só a latência da requisição recém-
 * finalizada. Pode ser chamado a cada resposta sem custo relevante.
 */
export function checkRequestLatency(requestMs: number): void {
  if (Number.isFinite(requestMs) && requestMs > alertThresholds.slowMs) {
    fire('requisicao_lenta', Math.round(requestMs), alertThresholds.slowMs);
  }
}

/**
 * Avalia o retrato de métricas do sistema (memória + taxa de erro) contra os
 * thresholds. É mais caro (monta o snapshot), então o chamador deve invocá-lo
 * de forma periódica, não a cada requisição.
 *
 * A taxa de erro usa a **janela recente** (`errorRateJanela`), não a acumulada:
 * num processo de vida longa a taxa acumulada nunca subiria diante de uma falha
 * nova. Exige um mínimo de amostras na janela para evitar falso positivo.
 *
 * @param snapshot retrato de métricas (de `getMetrics()`).
 */
export function checkAlerts(snapshot: MetricsSnapshot): void {
  if (snapshot.memoria.rssMb > alertThresholds.memMb) {
    fire('memoria_alta', snapshot.memoria.rssMb, alertThresholds.memMb);
  }

  if (
    snapshot.requests.amostrasJanela >= alertThresholds.errorRateMinSamples &&
    snapshot.requests.errorRateJanela > alertThresholds.errorRate
  ) {
    fire('taxa_erro_alta', snapshot.requests.errorRateJanela, alertThresholds.errorRate, {
      amostrasJanela: snapshot.requests.amostrasJanela,
      errosJanela: Math.round(snapshot.requests.errorRateJanela * snapshot.requests.amostrasJanela),
    });
  }
}
