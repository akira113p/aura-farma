import { Router, type Request } from 'express';
import { env, isGoogleEnabled } from '../config/env';
import { AppError, asyncHandler } from '../lib/http';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../lib/password';
import { googleCompleteSchema, googleVerifySchema, loginSchema, registerSchema } from '../lib/validation';
import { toSafeUser, User, type UserDoc } from '../models/User';
import {
  GoogleNotConfiguredError,
  GoogleTokenError,
  verifyGoogleCredential,
} from '../services/googleAuth';

export const authRouter = Router();

/** Regenerate the session (prevents fixation) and bind it to the user. */
function startSession(req: Request, user: UserDoc): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user._id.toString();
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

/** Map a Mongo duplicate-key error to a friendly 409 on the offending field. */
function duplicateError(err: unknown): AppError | null {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  if (e?.code !== 11000) return null;
  if (e.keyPattern?.email) return new AppError(409, 'E-mail já cadastrado', { email: 'E-mail já cadastrado' });
  if (e.keyPattern?.usernameLower)
    return new AppError(409, 'Nome de usuário já em uso', { username: 'Nome de usuário já em uso' });
  return new AppError(409, 'Registro duplicado');
}

// POST /api/auth/register
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const usernameLower = data.username.toLowerCase();

    const existing = await User.findOne({
      $or: [{ email: data.email }, { usernameLower }],
    }).lean();
    if (existing) {
      const details: Record<string, string> = {};
      if (existing.email === data.email) details.email = 'E-mail já cadastrado';
      if (existing.usernameLower === usernameLower) details.username = 'Nome de usuário já em uso';
      throw new AppError(409, 'Conta já existente', details);
    }

    const passwordHash = await hashPassword(data.password);
    let user: UserDoc;
    try {
      user = await User.create({
        username: data.username,
        usernameLower,
        pharmacyName: data.pharmacyName,
        email: data.email,
        passwordHash,
        authProviders: ['password'],
      });
    } catch (err) {
      const dup = duplicateError(err);
      if (dup) throw dup;
      throw err;
    }

    await startSession(req, user);
    res.status(201).json({ user: toSafeUser(user) });
  }),
);

// POST /api/auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { identifier, password } = loginSchema.parse(req.body);
    const id = identifier.toLowerCase();

    const user = await User.findOne({ $or: [{ email: id }, { usernameLower: id }] });
    // Generic message + always run a hash compare path to avoid user enumeration / timing leaks.
    if (!user || !user.passwordHash) {
      await verifyPassword(password, DUMMY_HASH); // constant-work path, avoids enumeration/timing
      throw new AppError(401, 'Credenciais inválidas');
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new AppError(401, 'Credenciais inválidas');

    await startSession(req, user);
    res.json({ user: toSafeUser(user) });
  }),
);

// POST /api/auth/logout
authRouter.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');
    res.status(204).end();
  });
});

// GET /api/auth/me
authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.session.userId) throw new AppError(401, 'Não autenticado');
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => undefined);
      throw new AppError(401, 'Não autenticado');
    }
    res.json({ user: toSafeUser(user) });
  }),
);

// GET /api/auth/google/config  → frontend learns if Google is enabled + the public client id
authRouter.get('/google/config', (_req, res) => {
  res.json({ enabled: isGoogleEnabled(), clientId: env.googleClientId });
});

// POST /api/auth/google  → verify ID token; login if the account exists, else ask for profile
authRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    const { credential } = googleVerifySchema.parse(req.body);
    let payload;
    try {
      payload = await verifyGoogleCredential(credential);
    } catch (err) {
      if (err instanceof GoogleNotConfiguredError) throw new AppError(503, err.message);
      if (err instanceof GoogleTokenError) throw new AppError(401, err.message);
      throw err;
    }

    const user = await User.findOne({ email: payload.email });
    if (!user) {
      // New user: the frontend must collect username + pharmacy, then call /google/complete.
      res.json({ needsProfile: true, email: payload.email, name: payload.name ?? '' });
      return;
    }

    // Link the Google identity to the existing account if not linked yet.
    if (!user.googleId) {
      user.googleId = payload.googleId;
      if (!user.authProviders.includes('google')) user.authProviders.push('google');
      await user.save();
    }

    await startSession(req, user);
    res.json({ user: toSafeUser(user) });
  }),
);

// POST /api/auth/google/complete  → create the Google-linked account with the collected profile
authRouter.post(
  '/google/complete',
  asyncHandler(async (req, res) => {
    const data = googleCompleteSchema.parse(req.body);
    let payload;
    try {
      payload = await verifyGoogleCredential(data.credential);
    } catch (err) {
      if (err instanceof GoogleNotConfiguredError) throw new AppError(503, err.message);
      if (err instanceof GoogleTokenError) throw new AppError(401, err.message);
      throw err;
    }

    const usernameLower = data.username.toLowerCase();
    const existing = await User.findOne({ $or: [{ email: payload.email }, { usernameLower }] }).lean();
    if (existing) {
      // E-mail taken means the account already exists → caller should just sign in.
      if (existing.email === payload.email) throw new AppError(409, 'Conta já existe para este e-mail');
      throw new AppError(409, 'Nome de usuário já em uso', { username: 'Nome de usuário já em uso' });
    }

    let user: UserDoc;
    try {
      user = await User.create({
        username: data.username,
        usernameLower,
        pharmacyName: data.pharmacyName,
        email: payload.email,
        googleId: payload.googleId,
        passwordHash: null,
        authProviders: ['google'],
      });
    } catch (err) {
      const dup = duplicateError(err);
      if (dup) throw dup;
      throw err;
    }

    await startSession(req, user);
    res.status(201).json({ user: toSafeUser(user) });
  }),
);
