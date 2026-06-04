import rateLimit from 'express-rate-limit';

/**
 * Rate limit for auth endpoints (register / login / google) to blunt brute-force
 * and account-enumeration attempts. In-memory store — fine for a single-server
 * MVP; move to a shared store (e.g. Redis) when running multiple instances.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});
