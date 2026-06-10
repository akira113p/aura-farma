// Acumulador in-memory de métricas de performance/saúde do processo. ZERO
// dependência: tudo em memória, sem libs. Os contadores são globais ao processo
// (single-instance MVP); reiniciam a cada boot. Latências guardam uma janela
// circular (reservoir) das últimas N durações para calcular percentis sob demanda.

/** Tamanho da janela circular de latências (em número de requests). */
const WINDOW = 1000;

interface RouteStat {
  requests: number;
  errors: number;
}

const state = {
  requests: 0,
  /** Respostas com status >= 500. */
  errors5xx: 0,
  /** Respostas com status >= 400 (inclui 4xx e 5xx). */
  errors4xx: 0,
  /** Janela circular de latências em ms. */
  latencies: [] as number[],
  /** Próximo índice de escrita na janela circular. */
  latIdx: 0,
  /** Estatísticas agregadas por rota. */
  byRoute: new Map<string, RouteStat>(),
};

export interface RecordInput {
  route: string;
  status: number;
  ms: number;
}

/** Registra um request concluído (chamado pelo middleware no `finish`). */
export function recordRequest({ route, status, ms }: RecordInput): void {
  state.requests += 1;
  if (status >= 500) state.errors5xx += 1;
  if (status >= 400) state.errors4xx += 1;

  // Janela circular: sobrescreve a posição mais antiga quando cheia.
  if (state.latencies.length < WINDOW) {
    state.latencies.push(ms);
  } else {
    state.latencies[state.latIdx] = ms;
    state.latIdx = (state.latIdx + 1) % WINDOW;
  }

  const rs = state.byRoute.get(route) ?? { requests: 0, errors: 0 };
  rs.requests += 1;
  if (status >= 400) rs.errors += 1;
  state.byRoute.set(route, rs);
}

/** Percentil (0–100) sobre um array JÁ ordenado ascendentemente. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, idx))];
}

export interface Metrics {
  requests: number;
  errors: number;
  errorRate: number;
  latency: { p50: number; p95: number; p99: number };
  byRoute: Record<string, RouteStat & { errorRate: number }>;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  uptime: number;
}

/** Snapshot das métricas correntes. Calcula percentis ordenando a janela. */
export function getMetrics(): Metrics {
  const sorted = [...state.latencies].sort((a, b) => a - b);
  const errorRate = state.requests > 0 ? state.errors5xx / state.requests : 0;

  const byRoute: Metrics['byRoute'] = {};
  for (const [route, rs] of state.byRoute) {
    byRoute[route] = {
      ...rs,
      errorRate: rs.requests > 0 ? rs.errors / rs.requests : 0,
    };
  }

  // OPCIONAL: stats de cache viriam de lib/cache.ts (Unit 6), que não existe
  // neste branch. TODO: incluir `cache: getCacheStats()` de forma guardada
  // quando a Unit 6 estiver integrada (não criar dependência cruzada aqui).

  return {
    requests: state.requests,
    errors: state.errors5xx,
    errorRate,
    latency: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    },
    byRoute,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
  };
}
