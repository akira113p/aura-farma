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
import { env, isIaEnabled } from '../config/env';
import { chatCompletion, type ChatMessage } from '../services/openrouter';
import { runTool, TOOL_CATALOG, TOOL_NAMES, type ToolCall } from '../services/iaTools';

export const iaRouter = Router();

const messagesSchema = z
  .array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(4000),
    }),
  )
  .min(1)
  .max(20);

interface Plan {
  titulo: string | null;
  calls: ToolCall[];
}

/** Extrai o plano (JSON) da IA 1 — título + ferramentas —, tolerante a cercas ```json. */
function parsePlan(text: string): Plan {
  const extract = (s: string): Plan => {
    const obj = JSON.parse(s) as { titulo?: unknown; ferramentas?: { nome?: unknown; params?: unknown }[] };
    const arr = Array.isArray(obj.ferramentas) ? obj.ferramentas : [];
    const calls = arr
      .filter((f) => f && typeof f.nome === 'string' && TOOL_NAMES.has(f.nome))
      .map((f) => ({ nome: f.nome as string, params: (f.params as Record<string, unknown>) ?? {} }));
    const titulo = typeof obj.titulo === 'string' && obj.titulo.trim() ? obj.titulo.trim().slice(0, 60) : null;
    return { titulo, calls };
  };
  try {
    return extract(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return extract(m[0]);
      } catch {
        /* desiste */
      }
    }
    return { titulo: null, calls: [] };
  }
}

const chatSchema = z.object({
  messages: messagesSchema,
  // Snapshot compacto da farmácia (números já calculados no client). Opcional.
  contexto: z.unknown().optional(),
});

const askSchema = z.object({ messages: messagesSchema });

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

/**
 * Chat em 2 estágios (mais barato): IA 1 (pequena) decide quais dados buscar →
 * backend executa as consultas ESCOPADAS por userId → IA principal responde com
 * o JSON + histórico. Gasta menos tokens que mandar todo o contexto sempre.
 */
iaRouter.post(
  '/ask',
  asyncHandler(async (req, res) => {
    if (!isIaEnabled()) throw new AppError(503, 'IA desativada no servidor.');
    const u = req.session.userId as string;
    const { messages } = askSchema.parse(req.body);
    const ultimaPergunta = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    // --- Estágio 1: planejador (modelo barato) escolhe as consultas do cardápio ---
    const plannerSystem: ChatMessage = {
      role: 'system',
      content:
        'Você é um ROTEADOR de dados de uma farmácia. Dada a pergunta do usuário: (1) crie um TÍTULO curto (2 a 5 ' +
        'palavras) que resuma a pergunta; (2) escolha quais consultas são necessárias, SOMENTE a partir deste cardápio ' +
        'fixo:\n' +
        TOOL_CATALOG +
        '\n\nResponda APENAS com JSON válido, no formato: ' +
        '{"titulo":"<resumo curto>","ferramentas":[{"nome":"...","params":{...}}]}. ' +
        'Use só nomes do cardápio e o mínimo necessário (1 a 3). Se a pergunta não precisar de dados (saudação, ' +
        'agradecimento, conversa fiada), responda com "ferramentas":[].',
    };
    let titulo: string | null = null;
    let calls: ToolCall[] = [];
    try {
      const plan = await chatCompletion([plannerSystem, { role: 'user', content: ultimaPergunta }], {
        models: [env.openrouterPlannerModel, ...env.openrouterModels],
        temperature: 0,
        // Folga p/ modelos de reasoning (gpt-oss): o raciocínio consome tokens e o
        // JSON precisa caber depois. Com pouco, o content volta vazio.
        maxTokens: 800,
      });
      const parsed = parsePlan(plan);
      titulo = parsed.titulo;
      calls = parsed.calls;
    } catch (e) {
      console.error('[ia] planejador falhou; usando consultas padrão:', e instanceof Error ? e.message : e);
    }
    // Sem plano (ou falha): um conjunto padrão pequeno e útil para o dashboard.
    if (calls.length === 0) {
      calls = [
        { nome: 'resumo_financeiro', params: { periodo: 'mes' } },
        { nome: 'estoque', params: { filtro: 'baixo' } },
      ];
    }

    // Executa (escopado por userId; só nomes válidos chegam até aqui).
    const dados: Record<string, unknown> = {};
    for (const c of calls.slice(0, 4)) {
      const periodo = c.params?.periodo ? `_${String(c.params.periodo)}` : '';
      dados[`${c.nome}${periodo}`] = await runTool(u, c);
    }

    // --- Estágio 2: IA principal responde com os dados + histórico da conversa ---
    const dadosStr = JSON.stringify(dados).slice(0, 10000);
    const system: ChatMessage = {
      role: 'system',
      content:
        'Você é o assistente de IA de uma pequena farmácia. Português do Brasil, tom prático e acolhedor — pode usar ' +
        'emojis com moderação. 💊 Responda à última pergunta do usuário usando SOMENTE os dados consultados abaixo (e o ' +
        'histórico da conversa). Faça os cálculos necessários (margem, lucro, ticket médio, giro, reposição) mostrando o ' +
        'número e a fórmula curta. Não invente dados fora do que veio; se faltar, diga o que falta. Até ~300 palavras.' +
        `\n\nDados consultados agora (JSON):\n${dadosStr}`,
    };

    const reply = await chatCompletion([system, ...messages]);
    const tituloFinal = titulo ?? (ultimaPergunta.trim().slice(0, 48) || 'Pergunta');
    res.json({ reply, titulo: tituloFinal, consultou: calls.map((c) => c.nome) });
  }),
);
