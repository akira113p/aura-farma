/**
 * Cache in-memory simples com TTL e contadores hit/miss por namespace.
 *
 * Zero-dependência: tudo vive no processo (um `Map` por namespace) e some no
 * restart. Pensado para caches curtos (segundos) que aliviam reads repetidos —
 * NÃO é um cache distribuído. Expiração é preguiçosa (lazy): entradas vencidas
 * só são removidas quando acessadas.
 *
 * Os contadores são expostos por `getCacheStats()` para a camada de métricas
 * (Unit 7) consumir no futuro.
 */

interface Entry<T> {
  value: T;
  expiresAt: number; // epoch ms
}

interface NsState {
  store: Map<string, Entry<unknown>>;
  hits: number;
  misses: number;
}

const namespaces = new Map<string, NsState>();

function nsState(ns: string): NsState {
  let s = namespaces.get(ns);
  if (!s) {
    s = { store: new Map(), hits: 0, misses: 0 };
    namespaces.set(ns, s);
  }
  return s;
}

// Log estruturado inline (mesmo shape que `lib/logger.ts` da Unit 1, que ainda
// não existe neste branch): { ts, level, msg, ...contexto } como JSON por linha.
function logCache(level: 'debug', msg: string, ns: string, key: string): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ns, key }));
}

/**
 * Lê uma entrada do cache. Conta hit/miss no namespace e, em MISS (ou entrada
 * vencida), emite log estruturado `cache.miss`. Retorna `undefined` quando não
 * há valor vigente.
 */
export function cacheGet<T>(ns: string, key: string): T | undefined {
  const s = nsState(ns);
  const entry = s.store.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    s.hits++;
    return entry.value as T;
  }
  if (entry) s.store.delete(key); // lazy expiry
  s.misses++;
  logCache('debug', 'cache.miss', ns, key);
  return undefined;
}

/** Grava (ou substitui) uma entrada com TTL em ms. */
export function cacheSet<T>(ns: string, key: string, value: T, ttlMs: number): void {
  nsState(ns).store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalida uma entrada (`key` informada) ou o namespace inteiro (`key`
 * omitida). Usada após mutações para não servir estado velho.
 */
export function cacheInvalidate(ns: string, key?: string): void {
  const s = namespaces.get(ns);
  if (!s) return;
  if (key === undefined) s.store.clear();
  else s.store.delete(key);
}

export interface CacheNsStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

/** Snapshot dos contadores por namespace (para métricas/observabilidade). */
export function getCacheStats(): Record<string, CacheNsStats> {
  const out: Record<string, CacheNsStats> = {};
  for (const [ns, s] of namespaces) {
    const total = s.hits + s.misses;
    out[ns] = {
      hits: s.hits,
      misses: s.misses,
      hitRate: total > 0 ? s.hits / total : 0,
      size: s.store.size,
    };
  }
  return out;
}
