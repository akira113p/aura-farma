import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name} (veja backend/.env.example)`);
  }
  return v;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_PROD = NODE_ENV === 'production';

const sessionSecret = required('SESSION_SECRET');

const frontendOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Fail fast on weak/insecure production configuration instead of silently
// shipping a guessable session secret or an unusable/insecure CORS allowlist.
if (IS_PROD) {
  // A placeholder or short secret lets an attacker forge/guess session cookie
  // signatures and hijack sessions. Demand real entropy in production.
  const placeholder = /troque|change|placeholder|secret|example/i.test(sessionSecret);
  if (sessionSecret.length < 32 || placeholder) {
    throw new Error(
      'SESSION_SECRET deve ser um valor aleatório forte (>= 32 caracteres) em produção. ' +
        'Gere com: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }

  if (frontendOrigins.length === 0) {
    throw new Error('FRONTEND_ORIGIN é obrigatório em produção (origem(ns) do frontend para o CORS).');
  }
  // With credentials:true a non-HTTPS or wildcard origin is a real risk
  // (cross-site cookie exfiltration); reject anything that is not https://host.
  for (const origin of frontendOrigins) {
    if (origin === '*') {
      throw new Error('FRONTEND_ORIGIN não pode ser "*" com cookies de sessão; liste origens explícitas.');
    }
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`FRONTEND_ORIGIN inválido: ${origin}`);
    }
    if (url.protocol !== 'https:') {
      throw new Error(`FRONTEND_ORIGIN deve usar https em produção: ${origin}`);
    }
  }
}

export const env = {
  nodeEnv: NODE_ENV,
  isProd: IS_PROD,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI'),
  sessionSecret,
  /** Allowed CORS origins (comma-separated in env). */
  frontendOrigins,
  /** Public Google OAuth client id; empty string means "Google login disabled". */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  /**
   * OpenRouter (IA). Vazio = IA desativada (a rota /api/ia responde 503).
   * A chave NUNCA vai para o frontend — só o backend fala com o OpenRouter.
   */
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  /**
   * Modelo do OpenRouter usado nas análises/cálculos. Padrão é um modelo capaz e
   * GRATUITO (funciona sem créditos na conta). Com créditos, troque por um pago
   * (ex.: openai/gpt-4o) via OPENROUTER_MODEL.
   */
  openrouterModel: process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-120b:free',
  /** Headers recomendados pelo OpenRouter (ranking/limites por app). */
  openrouterReferer: process.env.OPENROUTER_REFERER ?? (frontendOrigins[0] ?? 'http://localhost:5173'),
  openrouterTitle: process.env.OPENROUTER_TITLE ?? 'auraFarma',
} as const;

export const isGoogleEnabled = (): boolean => env.googleClientId.trim() !== '';

export const isIaEnabled = (): boolean => env.openrouterApiKey.trim() !== '';
