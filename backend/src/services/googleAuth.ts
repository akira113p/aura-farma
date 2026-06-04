import { OAuth2Client } from 'google-auth-library';
import { env, isGoogleEnabled } from '../config/env';

const client = new OAuth2Client();

export interface GooglePayload {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super('Login com Google não está configurado (defina GOOGLE_CLIENT_ID).');
    this.name = 'GoogleNotConfiguredError';
  }
}

export class GoogleTokenError extends Error {
  constructor(message = 'Token do Google inválido') {
    super(message);
    this.name = 'GoogleTokenError';
  }
}

/**
 * Verify a Google Identity Services ID token (a JWT). `verifyIdToken` checks the
 * signature against Google's public keys, the audience (our client id) and the
 * expiry — equivalent to `jwt.verify`, never a bare decode.
 */
export async function verifyGoogleCredential(credential: string): Promise<GooglePayload> {
  if (!isGoogleEnabled()) throw new GoogleNotConfiguredError();

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken: credential, audience: env.googleClientId });
  } catch {
    throw new GoogleTokenError();
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new GoogleTokenError();
  if (!payload.email_verified) throw new GoogleTokenError('E-mail do Google não verificado');

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    name: payload.name,
  };
}
