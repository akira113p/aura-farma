/**
 * Cliente fino do OpenRouter (IA), server-side, com FALLBACK de modelos.
 *
 * A chave (`OPENROUTER_API_KEY`) vive só no backend — nunca no bundle do
 * cliente. Tenta os modelos da cadeia (`env.openrouterModels`) em ordem: se um
 * cair (erro, timeout, rate-limit), passa para o próximo com o MESMO contexto.
 */
import { env } from '../config/env';
import { AppError } from '../lib/http';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  /** Sobrescreve a cadeia de modelos (default: env.openrouterModels). */
  models?: string[];
  temperature?: number;
  maxTokens?: number;
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 30_000;

/** Uma tentativa contra um modelo específico. Lança em qualquer falha. */
async function callModel(messages: ChatMessage[], model: string, opts: ChatOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openrouterApiKey}`,
        'HTTP-Referer': env.openrouterReferer,
        'X-Title': env.openrouterTitle,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1000,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`HTTP ${res.status} ${detail}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error('resposta vazia');
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

export async function chatCompletion(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (!env.openrouterApiKey) {
    throw new AppError(503, 'IA não configurada no servidor (defina OPENROUTER_API_KEY).');
  }

  const models = opts.models?.length ? opts.models : env.openrouterModels;
  let lastError: unknown;

  for (const model of models) {
    try {
      return await callModel(messages, model, opts);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Loga o motivo (sem a chave) e tenta o próximo modelo com o mesmo contexto.
      console.error(`[ia] modelo "${model}" falhou (${msg}); tentando o próximo…`);
    }
  }

  console.error('[ia] todos os modelos falharam:', lastError instanceof Error ? lastError.message : lastError);
  throw new AppError(502, 'As IAs disponíveis estão indisponíveis agora. Tente novamente em instantes.');
}
