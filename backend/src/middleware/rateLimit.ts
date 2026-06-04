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
