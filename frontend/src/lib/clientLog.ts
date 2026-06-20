/**
 * Logger leve do cliente — emite **JSON estruturado** no console.
 *
 * Cada linha é um objeto JSON com `ts` (ISO), `level`, `msg`, um `clientId`
 * gerado uma vez por carga da página (para correlacionar logs do mesmo
 * usuário/sessão) e o `context` adicional fornecido pelo chamador.
 *
 * Uso:
 *   clientLog.info('estado carregado', { count: 12 });
 *   clientLog.error('falha ao salvar', { requestId, status });
 *
 * Não logue dados sensíveis (senhas, tokens, PII) — o console é visível ao
 * usuário e tudo no bundle do cliente é público.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Contexto estruturado anexado a cada log. Valores devem ser serializáveis. */
export type LogContext = Record<string, unknown>;

/** ID gerado uma vez por carga da página, correlaciona logs da mesma sessão. */
const clientId: string = generateId();

function generateId(): string {
  // `crypto.randomUUID` existe em todos os browsers modernos (e no contexto seguro).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback simples caso o ambiente não exponha randomUUID.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emit(level: LogLevel, msg: string, context?: LogContext): void {
  // Campos reservados são aplicados por último para que uma chave do `context`
  // não sobrescreva `level`/`msg`/`clientId`/`ts` (que filtram/correlacionam logs).
  const entry = {
    ...context,
    ts: new Date().toISOString(),
    level,
    msg,
    clientId,
  };

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    // Contexto com referências circulares / não serializáveis: degrada com segurança.
    line = JSON.stringify({ ts: entry.ts, level, msg, clientId, ctxError: 'não serializável' });
  }

  // Mapeia o nível para o método de console apropriado (debug → console.debug, etc.).
  const sink =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'debug'
          ? console.debug
          : console.info;
  sink(line);
}

export const clientLog = {
  /** ID da sessão do cliente desta carga de página. */
  clientId,
  debug: (msg: string, context?: LogContext) => emit('debug', msg, context),
  info: (msg: string, context?: LogContext) => emit('info', msg, context),
  warn: (msg: string, context?: LogContext) => emit('warn', msg, context),
  error: (msg: string, context?: LogContext) => emit('error', msg, context),
};
