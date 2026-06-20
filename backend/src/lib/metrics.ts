/**
 * Coleta de métricas de performance do processo (regra 7 de observabilidade):
 * tempo de resposta (média + p95 simples numa janela), uso de memória/CPU,
 * uptime e contadores de requisições por faixa de status.
 *
 * Implementado só com a stdlib do Node — sem dependências externas.
 */

const startedAt = Date.now();

/** Janela deslizante das últimas N latências (ms) para média/p95. */
const WINDOW_SIZE = 500;
const latencies: number[] = [];

/**
 * Janela deslizante dos últimos N resultados (true = erro 5xx). A taxa de erro
 * de alerta é medida sobre esta janela, não sobre o total acumulado: num
 * processo de vida longa, a taxa acumulada fica permanentemente diluída e
 * nunca dispararia diante de uma falha nova.
 */
const recentErrors: boolean[] = [];

/** Contadores acumulados de requisições por faixa de status. */
const statusCounts: Record<string, number> = {
  '2xx': 0,
  '3xx': 0,
  '4xx': 0,
  '5xx': 0,
};

let totalRequests = 0;
let totalErrors = 0; // status >= 500

/** Registra uma requisição finalizada (chamado pelo requestContext). */
export function recordRequest(status: number, ms: number): void {
  totalRequests += 1;

  if (Number.isFinite(ms) && ms >= 0) {
    latencies.push(ms);
    if (latencies.length > WINDOW_SIZE) latencies.shift();
  }

  const bucket = `${Math.floor(status / 100)}xx`;
  if (bucket in statusCounts) statusCounts[bucket] += 1;

  const isError = status >= 500;
  if (isError) totalErrors += 1;
  recentErrors.push(isError);
  if (recentErrors.length > WINDOW_SIZE) recentErrors.shift();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, idx)]);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(sum / values.length);
}

export interface MetricsSnapshot {
  uptimeSec: number;
  requests: {
    total: number;
    errors: number;
    errorRate: number; // 0..1 — acumulado (exibição)
    errorRateJanela: number; // 0..1 — janela recente (usado para alerta)
    amostrasJanela: number; // nº de requisições na janela recente
    porStatus: Record<string, number>;
  };
  latenciaMs: {
    amostras: number;
    media: number;
    p95: number;
  };
  memoria: {
    rssMb: number;
    heapUsadoMb: number;
    heapTotalMb: number;
  };
  cpu: {
    userMs: number;
    systemMs: number;
  };
}

const bytesToMb = (b: number): number => Math.round((b / 1024 / 1024) * 10) / 10;

/** Retorna um retrato instantâneo das métricas atuais. */
export function getMetrics(): MetricsSnapshot {
  const sorted = [...latencies].sort((a, b) => a - b);
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();

  const janelaTotal = recentErrors.length;
  const janelaErros = recentErrors.reduce((n, isErr) => (isErr ? n + 1 : n), 0);

  return {
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    requests: {
      total: totalRequests,
      errors: totalErrors,
      errorRate: totalRequests === 0 ? 0 : Math.round((totalErrors / totalRequests) * 1000) / 1000,
      errorRateJanela: janelaTotal === 0 ? 0 : Math.round((janelaErros / janelaTotal) * 1000) / 1000,
      amostrasJanela: janelaTotal,
      porStatus: { ...statusCounts },
    },
    latenciaMs: {
      amostras: latencies.length,
      media: average(latencies),
      p95: percentile(sorted, 95),
    },
    memoria: {
      rssMb: bytesToMb(mem.rss),
      heapUsadoMb: bytesToMb(mem.heapUsed),
      heapTotalMb: bytesToMb(mem.heapTotal),
    },
    cpu: {
      // process.cpuUsage retorna microsegundos acumulados desde o início.
      userMs: Math.round(cpu.user / 1000),
      systemMs: Math.round(cpu.system / 1000),
    },
  };
}
