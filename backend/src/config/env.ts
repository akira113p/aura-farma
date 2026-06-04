import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name} (veja backend/.env.example)`);
  }
  return v;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const env = {
  nodeEnv: NODE_ENV,
  isProd: NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI'),
  sessionSecret: required('SESSION_SECRET'),
  /** Allowed CORS origins (comma-separated in env). */
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Public Google OAuth client id; empty string means "Google login disabled". */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
} as const;

export const isGoogleEnabled = (): boolean => env.googleClientId.trim() !== '';
