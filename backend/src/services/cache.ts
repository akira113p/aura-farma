/**
 * Cache TTL genérico em memória (stdlib apenas — sem dependências externas).
 *
 * Cada cache nomeado guarda entradas com expiração por TTL e mantém contadores
 * de observabilidade (`hits`, `misses`, `sets`, `evictions`). Os contadores
 * agregados ficam disponíveis via `getCacheStats()` para futura exposição em
 * health/métricas.
 *
 * Cada hit/miss emite uma linha JSON estruturada no stdout. Hoje isso usa
 * `console.log` direto (independente do logger central); será unificado depois
 * quando houver um logger único no backend.
 */

export interface CacheCounters {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
}

interface CacheEntry<V> {
  value: V;
  /** epoch ms em que a entrada expira (Date.now() + ttlMs no momento do set). */
  expiresAt: number;
}

/** Log estruturado de um evento de cache. Nunca loga o valor, só a chave. */
function logCacheEvent(cache: string, event: 'hit' | 'miss', key: string): void {
  // TODO(observabilidade): unificar com o logger central quando existir.
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'debug',
      src: 'cache',
      cache,
      event,
      key,
    }),
  );
}

/**
 * Cache TTL em memória, nomeado, com contadores de hit/miss.
 *
 * `get` aplica expiração preguiçosa (lazy): uma entrada vencida é removida e
 * contabilizada como `eviction` + `miss` no momento da leitura.
 */
export class TtlCache<V> {
  readonly nome: string;
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly counters: CacheCounters = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  /** Teto de entradas residentes; protege contra crescimento ilimitado da memória. */
  private readonly maxEntries: number;

  constructor(nome: string, maxEntries = 500) {
    this.nome = nome;
    this.maxEntries = maxEntries;
    registry.set(nome, this);
  }

  /** Retorna o valor se presente e não-expirado; senão `undefined`. Loga hit/miss. */
  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) {
      this.counters.misses++;
      logCacheEvent(this.nome, 'miss', key);
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      // Expirou: remove (eviction) e trata como miss.
      this.store.delete(key);
      this.counters.evictions++;
      this.counters.misses++;
      logCacheEvent(this.nome, 'miss', key);
      return undefined;
    }
    this.counters.hits++;
    logCacheEvent(this.nome, 'hit', key);
    return entry.value;
  }

  /** Insere/atualiza `key` com expiração em `ttlMs` a partir de agora. */
  set(key: string, value: V, ttlMs: number): void {
    // Re-inserir move a chave para o fim da ordem de inserção (LRU aproximado).
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.counters.sets++;
    // Teto de memória: ao exceder, descarta a entrada mais antiga (FIFO/LRU
    // aproximado). Protege contra enxurrada de queries únicas que nunca repetem.
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
      this.counters.evictions++;
    }
  }

  /** Cópia dos contadores deste cache. */
  stats(): CacheCounters {
    return { ...this.counters };
  }

  /** Tamanho atual do cache (entradas residentes, podem incluir vencidas ainda não lidas). */
  size(): number {
    return this.store.size;
  }
}

/** Registro global de todos os caches nomeados, para agregar métricas. */
const registry = new Map<string, TtlCache<unknown>>();

/**
 * Snapshot dos contadores de todos os caches nomeados.
 * Formato: `{ [nome]: { hits, misses, sets, evictions, size } }`.
 */
export function getCacheStats(): Record<string, CacheCounters & { size: number }> {
  const out: Record<string, CacheCounters & { size: number }> = {};
  for (const [nome, cache] of registry) {
    out[nome] = { ...cache.stats(), size: cache.size() };
  }
  return out;
}
