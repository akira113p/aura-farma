import mongoose from 'mongoose';
import { env } from '../config/env';

/**
 * Query logging com tempo (regra 5 de observabilidade).
 *
 * Abordagem escolhida: `mongoose.set('debug', fn)` combinado com um patch leve
 * em `mongoose.Collection.prototype.<op>`. Por quê?
 *  - O callback de `mongoose.set('debug', fn)` é disparado no INÍCIO da query, então
 *    sozinho não dá o tempo real (`ms`) da operação — só serve para saber QUE uma
 *    query começou e em qual coleção/op.
 *  - Hooks `pre`/`post` de schema (`mongoose.plugin`) só cobrem operações de query/
 *    document middleware e exigem registro por-schema; deixariam de fora chamadas como
 *    `createCollection`, `createIndex`, etc., e variam conforme o helper usado.
 *  - Envolver os métodos de baixo nível de `Collection.prototype` (`find`, `findOne`,
 *    `insertOne`, `insertMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`,
 *    `aggregate`, `bulkWrite`, `countDocuments`, `distinct`, `findOneAndUpdate`,
 *    `findOneAndDelete`, `replaceOne`) é o ponto único e confiável onde TODA query
 *    realmente sai para o driver — medimos `process.hrtime.bigint()` antes/depois e
 *    obtemos o tempo real de ida-e-volta ao MongoDB.
 *
 * O log sai como JSON estruturado (uma linha) via `console.log(JSON.stringify(...))`
 * — atende também a regra 3 (logs JSON). NOTA: por ora emitimos direto no console
 * porque esta unidade é independente do logger central; futuramente isso será
 * unificado com o logger estruturado compartilhado do backend.
 */

// --- Configuração por env (lida direto de process.env: este arquivo não deve mexer em env.ts) ---

// Liga/desliga o log de queries. Valores aceitos:
//   'true'  (default) -> loga todas as queries
//   'false'           -> não loga nenhuma query
//   'slow'            -> loga apenas queries que ultrapassam o limiar (DB_SLOW_QUERY_MS)
const DB_QUERY_LOG = (process.env.DB_QUERY_LOG ?? 'true').trim().toLowerCase();
const LOG_DISABLED = DB_QUERY_LOG === 'false';
const LOG_ONLY_SLOW = DB_QUERY_LOG === 'slow';

// Limiar (ms) para marcar uma query como "lenta". Default 100ms.
const parsedSlowMs = Number(process.env.DB_SLOW_QUERY_MS);
const DB_SLOW_QUERY_MS = Number.isFinite(parsedSlowMs) && parsedSlowMs > 0 ? parsedSlowMs : 100;

/** Emite uma linha JSON estruturada para uma query do MongoDB. */
function logQuery(collection: string, op: string, ms: number): void {
  const slow = ms > DB_SLOW_QUERY_MS;
  // Em modo 'slow' só registramos as queries lentas (reduz ruído em produção).
  if (LOG_ONLY_SLOW && !slow) return;
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'debug',
      src: 'db',
      collection,
      op,
      ms: Math.round(ms * 1000) / 1000, // arredonda para 3 casas decimais
      slow,
    }),
  );
}

// Operações de baixo nível do driver que queremos instrumentar.
const INSTRUMENTED_OPS = [
  'find',
  'findOne',
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'replaceOne',
  'aggregate',
  'bulkWrite',
  'countDocuments',
  'estimatedDocumentCount',
  'distinct',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
] as const;

let instrumented = false;

/**
 * Faz o patch leve nos métodos de `mongoose.Collection.prototype`, medindo o
 * tempo real de cada operação. Idempotente: só aplica uma vez por processo.
 *
 * A medição usa `process.hrtime.bigint()` (relógio monotônico, em nanosegundos),
 * imune a ajustes do relógio do sistema — ideal para medir duração.
 */
function instrumentQueries(): void {
  if (instrumented || LOG_DISABLED) return;
  instrumented = true;

  const proto = mongoose.Collection.prototype as unknown as Record<string, unknown>;

  for (const op of INSTRUMENTED_OPS) {
    const original = proto[op];
    if (typeof original !== 'function') continue;

    const originalFn = original as (...args: unknown[]) => unknown;

    proto[op] = function patched(this: { collectionName?: string }, ...args: unknown[]): unknown {
      const start = process.hrtime.bigint();
      const collection = this?.collectionName ?? 'desconhecida';

      const finish = (): void => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        logQuery(collection, op, ms);
      };

      let result: unknown;
      try {
        result = originalFn.apply(this, args);
      } catch (err) {
        // Erro síncrono: ainda registramos o tempo até a falha.
        finish();
        throw err;
      }

      // Os métodos do driver moderno retornam Promise (ou cursor/thenable).
      // Quando há `.then`, medimos no settle; senão, medimos de imediato.
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        return (result as Promise<unknown>).then(
          (value) => {
            finish();
            return value;
          },
          (err) => {
            finish();
            throw err;
          },
        );
      }

      finish();
      return result;
    };
  }
}

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  instrumentQueries();
  await mongoose.connect(env.mongoUri);
  // Mensagem de "conectado" agora também em JSON estruturado (regra 3).
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      src: 'db',
      msg: 'conectado ao MongoDB',
    }),
  );
}
