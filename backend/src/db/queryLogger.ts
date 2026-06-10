import type { Schema } from 'mongoose';
import { env } from '../config/env';

/**
 * Plugin Mongoose que instrumenta os principais ops de query medindo a duração
 * de cada operação e emitindo um log estruturado (JSON por linha no stdout):
 *
 *   { ts, level, msg:'db.query', collection, op, ms, requestId? }
 *
 * ZERO-DEPENDÊNCIA: replicamos inline o shape do logger compartilhado (a Unit 1
 * criará `lib/logger.ts`, que NÃO existe neste branch — por isso NÃO importamos).
 *
 * `requestId` é omitido aqui: o request-context (AsyncLocalStorage da Unit 2)
 * não existe neste branch, e o plugin não tem acesso a `req`. Fica `undefined`.
 *
 * `ms > DB_SLOW_MS` (env.dbSlowMs) sobe o nível para `warn` (query lenta).
 */

type Level = 'debug' | 'info' | 'warn' | 'error';
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: number = LEVELS[(process.env.LOG_LEVEL as Level) in LEVELS ? (process.env.LOG_LEVEL as Level) : 'debug'];

/** Helper local de log estruturado (mesmo shape JSON da convenção compartilhada). */
function logQuery(entry: { level: Level; collection: string; op: string; ms: number; requestId?: string }): void {
  if (LEVELS[entry.level] < MIN_LEVEL) return;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: entry.level,
      msg: 'db.query',
      collection: entry.collection,
      op: entry.op,
      ms: entry.ms,
      requestId: entry.requestId,
    }),
  );
}

/** Resolve o nome da collection a partir do contexto do hook (query ou doc). */
function collectionName(ctx: any): string {
  // Query: ctx.mongooseCollection?.name. Document (save): ctx.collection?.name.
  // Aggregate: o model fica em ctx._model (com underscore). Vários fallbacks p/
  // cobrir os diferentes contextos de `this` sem depender de um único formato.
  return (
    ctx?.mongooseCollection?.name ??
    ctx?.collection?.name ??
    ctx?.model?.collection?.name ??
    ctx?._model?.collection?.name ??
    ctx?.constructor?.collection?.name ??
    'desconhecida'
  );
}

function emit(ctx: any, op: string): void {
  const start: number | undefined = ctx?.__startTime;
  if (typeof start !== 'number') return; // sem pre correspondente — nada a medir
  const ms = Date.now() - start;
  const level: Level = ms > env.dbSlowMs ? 'warn' : 'debug';
  logQuery({ level, collection: collectionName(ctx), op, ms });
}

// Ops de QUERY middleware (this = Query). `save` é DOCUMENT middleware (this = Document).
const QUERY_OPS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'count',
  'countDocuments',
] as const;

export function queryLoggerPlugin(schema: Schema): void {
  // `schema as any` na hora de registrar: as sobrecargas de `pre/post` do Mongoose
  // não aceitam uma variável de união de nomes de op (cada op tem assinatura de
  // `this` distinta). Iterar com tipo literal exato não compila; o cast remove o
  // atrito sem afetar o comportamento. `this: any` nos hooks pela mesma razão.
  const s = schema as any;

  // ---- Query middleware (find/update/delete/count...) ----
  for (const op of QUERY_OPS) {
    s.pre(op, function (this: any) {
      this.__startTime = Date.now();
    });
    s.post(op, function (this: any) {
      emit(this, op);
    });
  }

  // ---- aggregate (this = Aggregate) ----
  s.pre('aggregate', function (this: any) {
    this.__startTime = Date.now();
  });
  s.post('aggregate', function (this: any) {
    emit(this, 'aggregate');
  });

  // ---- save (document middleware; this = Document) ----
  s.pre('save', function (this: any) {
    this.__startTime = Date.now();
  });
  s.post('save', function (this: any) {
    emit(this, 'save');
  });
}
