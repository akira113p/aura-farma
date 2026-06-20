import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { connectDb } from './db/mongoose';
import { authLimiter } from './middleware/rateLimit';
import { requireAuth } from './middleware/auth';
import { authRouter } from './routes/auth';
import { medicamentosRouter } from './routes/medicamentos';
import { dadosRouter } from './routes/dados';
import { loadCatalog } from './services/catalog';
import { errorHandler, notFound } from './middleware/error';
import { requestContext } from './middleware/requestContext';
import { healthRouter } from './routes/health';
import { logger } from './lib/logger';

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

// Contexto de observabilidade o mais cedo possível (após body parser, antes
// das rotas): request ID, logs estruturados, latência, métricas e alertas.
app.use(requestContext);

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

app.use('/api/health', healthRouter);

// Rate-limit all auth endpoints (login/register/google) against brute force.
app.use('/api/auth', authLimiter, authRouter);

// Real-medicine catalog search (read-only reference for building stock).
app.use('/api/medicamentos', requireAuth, medicamentosRouter);

// Per-pharmacy data (stock, sales, requests, counts) — all require a session.
app.use('/api', requireAuth, dadosRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDb();
    const medCount = loadCatalog();
    app.listen(env.port, () => {
      logger.info('servidor iniciado', {
        url: `http://localhost:${env.port}`,
        cors: env.frontendOrigins,
        googleLogin: env.googleClientId ? 'configurado' : 'desativado',
        medicamentosCarregados: medCount,
      });
    });
  } catch (err) {
    logger.error('falha ao iniciar o servidor', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

start();
