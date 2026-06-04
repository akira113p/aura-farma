import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { connectDb } from './db/mongoose';
import { authLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth';
import { errorHandler, notFound } from './middleware/error';

const app = express();

// Behind a proxy in production so that Secure cookies and req.ip work correctly.
if (env.isProd) app.set('trust proxy', 1);

app.use(helmet());
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
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Rate-limit all auth endpoints (login/register/google) against brute force.
app.use('/api/auth', authLimiter, authRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDb();
    app.listen(env.port, () => {
      console.log(`[api] farmaDimin ouvindo em http://localhost:${env.port}`);
      console.log(`[api] CORS liberado para: ${env.frontendOrigins.join(', ')}`);
      console.log(`[api] Google login: ${env.googleClientId ? 'configurado' : 'desativado (defina GOOGLE_CLIENT_ID)'}`);
    });
  } catch (err) {
    console.error('[api] Falha ao iniciar:', err);
    process.exit(1);
  }
}

start();
