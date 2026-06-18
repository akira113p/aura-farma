/**
 * Cliente fino do OpenRouter (IA), server-side.
 *
 * A chave (`OPENROUTER_API_KEY`) vive só no backend — nunca no bundle do
 * cliente. O frontend fala com `/api/ia/*`, que chama isto aqui. Mesma costura
 * do resto do app: se a IA estiver desativada, lança 503.
 */
import { env } from '../config/env';
import { AppError } from '../lib/http';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 30_000;

export async function chatCompletion(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (!env.openrouterApiKey) {
    throw new AppError(503, 'IA não configurada no servidor (defina OPENROUTER_API_KEY).');
  }

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
        model: opts.model ?? env.openrouterModel,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 700,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Loga o status (sem a chave) para diagnóstico; resposta ao client é genérica.
      console.error('[ia] OpenRouter respondeu', res.status, (await res.text().catch(() => '')).slice(0, 300));
      throw new AppError(502, 'A IA está indisponível no momento. Tente novamente.');
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new AppError(502, 'A IA retornou uma resposta vazia.');
    return reply;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AppError(504, 'A IA demorou demais para responder.');
    }
    console.error('[ia] falha ao chamar OpenRouter:', err);
    throw new AppError(502, 'Não foi possível falar com a IA.');
  } finally {
    clearTimeout(timer);
  }
}
