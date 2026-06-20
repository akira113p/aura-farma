import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Logger estruturado: cada log é uma única linha JSON
 * `{ ts, level, msg, ...context }`. Sem texto livre (regra 3 de observabilidade).
 *
 * - Respeita `LOG_LEVEL` (env, default `info`).
 * - Em dev, `LOG_PRETTY=true` imprime de forma legível; o default permanece JSON.
 * - Nunca loga segredos: campos sensíveis são redigidos antes de serializar.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').trim().toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

const MIN_LEVEL = resolveLevel();
const PRETTY = (process.env.LOG_PRETTY ?? '').trim().toLowerCase() === 'true';

/**
 * Contexto de requisição propagado sem prop-drilling (ex.: requestId).
 * O middleware `requestContext` roda os handlers dentro de `als.run(...)`,
 * e o logger lê esse contexto automaticamente em cada log.
 */
export const als = new AsyncLocalStorage<Record<string, unknown>>();

/** Campos cujo valor nunca deve aparecer nos logs. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'passwordHash',
  'senha',
  'token',
  'credential',
  'authorization',
  'cookie',
  'sessionsecret',
  'secret',
  'apikey',
  'api_key',
]);

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
    return '[redigido]';
  }
  return value;
}

/** Serializa com segurança: redige chaves sensíveis, trata ciclos e BigInt. */
function safeStringify(payload: Record<string, unknown>): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(payload, (key, value) => {
    if (key) {
      const redacted = redactValue(key, value);
      if (redacted === '[redigido]') return redacted;
    }
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value as object)) return '[circular]';
      seen.add(value as object);
    }
    return value;
  });
}

function emit(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const store = als.getStore();
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(store ?? {}),
    ...(context ?? {}),
  };

  const line = safeStringify(record);

  // Erros vão para stderr; o restante para stdout (facilita agregadores de log).
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;

  if (PRETTY) {
    stream.write(`${record.ts} ${level.toUpperCase().padEnd(5)} ${msg} ${prettyExtras(record)}\n`);
    return;
  }
  stream.write(`${line}\n`);
}

function prettyExtras(record: Record<string, unknown>): string {
  const { ts: _ts, level: _level, msg: _msg, ...rest } = record;
  const keys = Object.keys(rest);
  if (keys.length === 0) return '';
  return safeStringify(rest);
}

export const logger = {
  debug: (msg: string, context?: Record<string, unknown>) => emit('debug', msg, context),
  info: (msg: string, context?: Record<string, unknown>) => emit('info', msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => emit('warn', msg, context),
  error: (msg: string, context?: Record<string, unknown>) => emit('error', msg, context),
  /** Nível mínimo efetivo (útil para health/diagnóstico). */
  level: MIN_LEVEL,
};

export type Logger = typeof logger;
