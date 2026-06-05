import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Baseline rate limit for all auth endpoints (register / google / config) to
 * blunt brute-force and account-enumeration attempts. In-memory store — fine for
 * a single-server MVP; move to a shared store (e.g. Redis) when running multiple
 * instances.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

/**
 * Stricter limiter applied specifically to credentialed login. Brute-forcing a
 * password is the highest-value attack on this surface, so it gets a tighter cap
 * than the shared `authLimiter`. We key on the client IP *and* the submitted
 * identifier so a single attacker cannot lock out a victim's account globally,
 * while still capping per-account guessing. Only failed logins count, so a
 * legitimate user signing in correctly is never throttled.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // per IP+identifier per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request): string => {
    // `req.ip` is trustworthy because `trust proxy` is configured in index.ts.
    const ip = req.ip ?? 'unknown';
    const body = req.body as { identifier?: unknown } | undefined;
    const identifier =
      typeof body?.identifier === 'string' ? body.identifier.trim().toLowerCase().slice(0, 120) : '';
    return `${ip}:${identifier}`;
  },
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});

/** Per-user key: the authenticated session id, falling back to IP. */
const perUser = (req: Request): string => req.session?.userId ?? req.ip ?? 'unknown';

/**
 * Write limiter ("tickets") for data-mutation endpoints (stock CRUD, sales,
 * requests, counts, seed/reset). Keyed per user so one account cannot flood the
 * cluster with millions of writes; generous enough for normal manual use.
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // writes per user per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: perUser,
  message: { error: 'Muitas operacoes em pouco tempo. Aguarde alguns segundos.' },
});

/** Looser limiter for the state-load read endpoint. */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: perUser,
  message: { error: 'Muitas requisicoes. Aguarde alguns segundos.' },
});
