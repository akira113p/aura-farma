/**
 * Rotas de IA (experimental) — proxy autenticado para o OpenRouter.
 *
 * `POST /api/ia/chat` recebe a conversa + um snapshot do contexto da farmácia
 * (enviado pelo client) e devolve a resposta do modelo. O backend injeta um
 * system prompt de "analista de farmácia" e nunca expõe a chave.
 *
 * Esta é uma feature de teste (chat). Para remover: tirar o mount em index.ts e
 * apagar este arquivo + services/openrouter.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { AppError, asyncHandler } from '../lib/http';
import { isIaEnabled } from '../config/env';
import { chatCompletion, type ChatMessage } from '../services/openrouter';

export const iaRouter = Router();

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  // Snapshot compacto da farmácia (números já calculados no client). Opcional.
  contexto: z.unknown().optional(),
});

/** Diz ao frontend se a IA está ligada (para habilitar/desabilitar o chat). */
iaRouter.get('/config', (_req, res) => {
  res.json({ enabled: isIaEnabled() });
});

iaRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    if (!isIaEnabled()) throw new AppError(503, 'IA desativada no servidor.');

    const { messages, contexto } = chatSchema.parse(req.body);
    const contextoStr = contexto !== undefined ? JSON.stringify(contexto).slice(0, 10000) : '';

    const system: ChatMessage = {
      role: 'system',
      content:
        'Você é o assistente de IA de uma pequena farmácia. Fale em português do Brasil, com tom prático e ' +
        'acolhedor — pode usar emojis com moderação quando ajudarem na leitura. 💊\n' +
        'Abaixo vem um retrato atual da farmácia em JSON (desempenho por período, margens, estoque, valor de ' +
        'estoque, categorias, mais vendidos e solicitações de clientes). Baseie TODAS as respostas nesses dados: ' +
        'faça análises e cálculos (margem, lucro, ticket médio, giro de estoque, reposição, valorização) e, quando ' +
        'fizer contas, mostre o número e a fórmula curta. Não invente dados fora do contexto — se faltar algo, diga ' +
        'o que falta e o que olhar no sistema.\n' +
        'Você pode se estender até ~300 palavras para montar um bom raciocínio, mas seja direto e organizado.' +
        (contextoStr ? `\n\nContexto atual da farmácia (JSON):\n${contextoStr}` : ''),
    };

    const reply = await chatCompletion([system, ...messages]);
    res.json({ reply });
  }),
);
