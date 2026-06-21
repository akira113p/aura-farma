import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import type { Server } from 'node:http';
import { env, isPostgresEnabled } from './config/env';
import { connectDb, disconnectDb } from './db/mongoose';
import { connectPostgres, pingPostgres, closePostgres } from './db/postgres';
import { authLimiter, iaLimiter } from './middleware/rateLimit';
import { requireAuth } from './middleware/auth';
import { authRouter } from './routes/auth';
import { medicamentosRouter } from './routes/medicamentos';
import { dadosRouter } from './routes/dados';
import { iaRouter } from './routes/ia';
import { loadCatalog } from './services/catalog';
import { errorHandler, notFound } from './middleware/error';

const app = express();

// Behind a proxy in production so that Secure cookies and req.ip work correctly.
if (env.isProd) app.set('trust proxy', 1);

// This service only serves JSON (no HTML/scripts of its own), so we can lock the
// CSP down hard and enable HSTS in production. Helmet already sets
// X-Content-Type-Options, X-Frame-Options (frameguard), etc. by default.
app.use(
  helmet({
    // Disallow any resource loading from API responses (defense-in-depth for
    // accidentally-rendered error pages). Disables the default `upgrade-insecure-requests`.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    // Don't advertise referrers cross-origin.
    referrerPolicy: { policy: 'no-referrer' },
    // Force HTTPS for a year (incl. subdomains) once the app is live behind TLS.
    // Disabled in dev so localhost over HTTP keeps working.
    hsts: env.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    // Avoid leaking the served-from origin to unrelated resources.
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);
app.use(cors({ origin: env.frontendOrigins, credentials: true }));
app.use(express.json({ limit: '10kb' }));

app.use(
  session({
    name: 'sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: env.mongoUri, ttl: 14 * 24 * 60 * 60 }),
    cookie: {
      httpOnly: true, // invisible to JS — mitigates XSS token theft
      secure: env.isProd, // HTTPS-only in production
      // Cross-site in production (frontend on Vercel, API on Render = different
      // domains): the cookie must be SameSite=None+Secure or the browser won't
      // send it on cross-origin fetch. In dev (same localhost) Lax is fine.
      sameSite: env.isProd ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

app.get('/api/health', async (_req, res) => {
  // `ok` reflete a saúde operacional do app (MongoDB é o banco principal).
  // O Postgres é opcional nesta fase: reportamos seu estado sem derrubar o ok.
  const postgres = !isPostgresEnabled()
    ? 'desativado'
    : (await pingPostgres())
      ? 'conectado'
      : 'erro';
  res.json({ ok: true, postgres });
});

// Rate-limit all auth endpoints (login/register/google) against brute force.
app.use('/api/auth', authLimiter, authRouter);

// Real-medicine catalog search (read-only reference for building stock).
app.use('/api/medicamentos', requireAuth, medicamentosRouter);

// IA (experimental): proxy autenticado para o OpenRouter. Montado ANTES do
// `/api` genérico para não cair no dadosRouter. Limiter próprio (gasta créditos).
app.use('/api/ia', requireAuth, iaLimiter, iaRouter);

// Per-pharmacy data (stock, sales, requests, counts) — all require a session.
app.use('/api', requireAuth, dadosRouter);

app.use(notFound);
app.use(errorHandler);

/**
 * Encerramento gracioso: para de aceitar conexões e fecha os bancos antes de
 * sair, evitando conexões penduradas (importante no Render, que manda SIGTERM
 * a cada deploy). Idempotente; força a saída se travar.
 */
function setupGracefulShutdown(server: Server): void {
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[api] ${signal} recebido, encerrando...`);
    server.close(async () => {
      try {
        await closePostgres();
        await disconnectDb();
      } catch (err) {
        console.error('[api] erro ao fechar conexões:', err);
      }
      process.exit(0);
    });
    // Rede de segurança: se algo travar, sai mesmo assim.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function start() {
  try {
    await connectDb();
    if (isPostgresEnabled()) await connectPostgres();
    const medCount = loadCatalog();
    const server = app.listen(env.port, () => {
      console.log(`[api] auraFarma ouvindo em http://localhost:${env.port}`);
      console.log(`[api] CORS liberado para: ${env.frontendOrigins.join(', ')}`);
      console.log(`[api] Google login: ${env.googleClientId ? 'configurado' : 'desativado (defina GOOGLE_CLIENT_ID)'}`);
      console.log(`[api] PostgreSQL (Neon): ${isPostgresEnabled() ? 'configurado' : 'desativado (defina DATABASE_URL)'}`);
      console.log(`[catalog] ${medCount} medicamentos carregados`);
    });
    setupGracefulShutdown(server);
  } catch (err) {
    console.error('[api] Falha ao iniciar:', err);
    process.exit(1);
  }
}

start();
