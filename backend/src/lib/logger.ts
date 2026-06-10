import { env } from '../config/env';

/** Contexto arbitrário anexado a uma linha de log (vira chaves no JSON). */
export type LogContext = Record<string, unknown>;

type Level = 'debug' | 'info' | 'warn' | 'error';

// Ordem dos níveis: debug < info < warn < error. Um log só é emitido se o seu
// nível for >= o nível configurado (env.logLevel / LOG_LEVEL, default 'info').
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Nível mínimo atual resolvido a partir de `env.logLevel`. */
export function currentLevel(): Level {
  return env.logLevel;
}

function emit(level: Level, msg: string, ctx?: LogContext): void {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  // NDJSON: um objeto JSON por linha no stdout (capturado pelo Render).
  const entry = { ts: new Date().toISOString(), level, msg, ...ctx };
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
};
