import pg from 'pg';
import { env } from '../config/env';

/**
 * Conexão com o PostgreSQL (Neon) — banco de compliance/SNGPC.
 *
 * Driver `pg` (node-postgres) com pool sobre TCP: a escolha correta para um
 * servidor Express de longa duração (o `@neondatabase/serverless` é para
 * funções serverless/edge). Use a connection string do endpoint POOLED
 * (`-pooler`) do Neon, com `sslmode=require`.
 *
 * É OPCIONAL: sem `DATABASE_URL` o app sobe normalmente (MongoDB é o principal).
 * Nesta fase só estabelecemos a conexão — ainda não há tabelas nem queries.
 */

const { Pool } = pg;

let pool: pg.Pool | undefined;

/** Extrai só o host da URL para log seguro (nunca logar usuário/senha). */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(url invalida)';
  }
}

/**
 * Cria o pool e valida a conectividade com `SELECT 1`. No-op se o Postgres
 * estiver desativado (sem `DATABASE_URL`). Em caso de erro lança — mas o
 * bootstrap (`index.ts`) trata como não-fatal (Postgres é opcional), apenas
 * logando o aviso; o estado aparece em `/api/health` (`postgres:"erro"`).
 */
export async function connectPostgres(): Promise<void> {
  if (!env.databaseUrl) return;

  pool = new Pool({
    connectionString: env.databaseUrl,
    max: 10, // 1 instância no Render; o pooler do Neon multiplexa atrás
    idleTimeoutMillis: 30_000, // fecha conexões ociosas
    connectionTimeoutMillis: 5_000, // falha rápido se o pool esgotar
    maxUses: 7_500, // recicla conexões (evita vazamento de memória no backend)
    // Os certificados do Neon são publicamente confiáveis (ISRG/Let's Encrypt),
    // então validamos a cadeia. O `sslmode=require` da URL exige TLS.
    ssl: { rejectUnauthorized: true },
  });

  // Um erro num cliente ocioso do pool não deve derrubar o processo.
  pool.on('error', (err) => {
    console.error('[pg] erro em cliente ocioso do pool:', err.message);
  });

  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }

  console.log(`[pg] conectado ao PostgreSQL (Neon) em ${safeHost(env.databaseUrl)}`);
}

/** Pool ativo. Lança se o Postgres não foi inicializado (chame após connectPostgres). */
export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('PostgreSQL não inicializado (DATABASE_URL ausente ou connectPostgres() não chamado).');
  }
  return pool;
}

/** Teste leve de conectividade para o health check. `false` se desativado/indisponível. */
export async function pingPostgres(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Encerra o pool (graceful shutdown). Seguro chamar mesmo se desativado. */
export async function closePostgres(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
