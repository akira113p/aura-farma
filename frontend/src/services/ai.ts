/**
 * Camada de IA do frontend.
 *
 * Tudo passa pelo backend (`/api/ia/*`), que fala com o OpenRouter com a chave
 * guardada server-side — NUNCA expomos chave no bundle do cliente.
 *
 * - `generateAISummary` (via `chatWithAI`): o "texto pronto" (resumo do
 *   dia/semana/mês). Tenta a IA real e, em qualquer falha (IA desativada, rede,
 *   etc.), cai no `cannedSummary` determinístico — mesmo molde de antes.
 * - `perguntarIA`: pergunta avulsa (tela Assistente IA) no fluxo de 2 estágios
 *   (`/api/ia/ask`): IA pequena planeja → backend busca dados escopados → IA
 *   principal responde. Retorna resposta + título gerado por IA.
 */
import type { PeriodStats, Product, SummaryPeriod, TopProduct } from '../types';
import { apiClient } from '../lib/apiClient';
import { BRL } from '../lib/format';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/** Usado pelo resumo (texto pronto): contexto completo num único turno. */
export async function chatWithAI(messages: ChatMsg[], contexto: unknown): Promise<string> {
  const { reply } = await apiClient.post<{ reply: string }>('/ia/chat', { messages, contexto });
  return reply;
}

export interface RespostaIA {
  reply: string;
  /** Título curto da pergunta, gerado pela IA (estágio planejador). */
  titulo: string;
  /** Ferramentas de dados consultadas para responder. */
  consultou: string[];
}

/**
 * Pergunta avulsa (1 mensagem, sem histórico de conversa) — fluxo de 2 estágios:
 * o backend usa uma IA pequena para decidir quais dados buscar (escopados pelo
 * usuário) e só então a IA principal responde. Devolve a resposta + um título.
 */
export async function perguntarIA(pergunta: string): Promise<RespostaIA> {
  return apiClient.post<RespostaIA>('/ia/ask', { messages: [{ role: 'user', content: pergunta }] });
}

export async function generateAISummary(
  period: SummaryPeriod,
  stats: PeriodStats,
  lowStock: Product[],
  topProducts: TopProduct[],
  requestsCount: number,
): Promise<string> {
  const periodLabel = { day: 'do dia', week: 'da semana', month: 'do mês' }[period] || 'do dia';
  const ctx = {
    periodo: periodLabel,
    receita: BRL(stats.revenue),
    custo: BRL(stats.cost),
    lucro: BRL(stats.revenue - stats.cost),
    margem: stats.revenue > 0 ? (((stats.revenue - stats.cost) / stats.revenue) * 100).toFixed(1) + '%' : '0%',
    itens_vendidos: stats.items,
    num_vendas: stats.sales,
    produtos_em_baixa: lowStock.slice(0, 3).map((p) => `${p.name} (${p.stock} restantes, mín ${p.min})`).join('; '),
    mais_vendidos: topProducts.slice(0, 3).map((t) => `${t.p.name} (${t.qty} unidades)`).join('; '),
    pedidos_clientes: requestsCount,
  };
  // Mensagem do usuário simples: o contexto (ctx) vai pelo system (vide /api/ia/chat).
  const prompt = `Escreva o resumo de desempenho ${periodLabel} da farmácia em 3 parágrafos curtos, texto corrido (sem listas/markdown), no máximo 110 palavras, tom de colega contador. Pode usar 1–2 emojis. Cubra: (1) desempenho — receita, lucro e vendas; (2) o que repor com urgência; (3) recomendações — solicitações de clientes que valem virar produto e o que vende bem.`;

  try {
    const reply = await chatWithAI([{ role: 'user', content: prompt }], ctx);
    if (reply && reply.trim()) return reply.trim();
  } catch {
    /* IA indisponível/desativada — usa o resumo determinístico abaixo */
  }
  return cannedSummary(period, stats, lowStock, topProducts, requestsCount);
}

export function cannedSummary(
  period: SummaryPeriod,
  stats: PeriodStats,
  lowStock: Product[],
  topProducts: TopProduct[],
  requestsCount: number,
): string {
  const periodLabel = { day: 'Hoje', week: 'Nesta semana', month: 'Neste mês' }[period] || 'Hoje';
  const lucro = stats.revenue - stats.cost;
  const margem = stats.revenue > 0 ? Math.round((lucro / stats.revenue) * 100) : 0;
  const low = lowStock.slice(0, 2).map((p) => p.name).join(' e ');
  const top = topProducts.slice(0, 2).map((t) => t.p.name).join(' e ');
  return [
    `${periodLabel} sua farmácia faturou ${BRL(stats.revenue)} em ${stats.sales} vendas, totalizando ${stats.items} itens. Descontando custos de ${BRL(stats.cost)}, sobraram ${BRL(lucro)} de margem — cerca de ${margem}% sobre a receita. É um resultado consistente com o ritmo recente.`,
    lowStock.length
      ? `Atenção ao estoque: ${low} estão abaixo do mínimo configurado. Reponha estes itens antes do próximo final de semana para não perder vendas de alta rotação. No total, ${lowStock.length} produto(s) precisam de reposição.`
      : `O estoque está saudável: nenhum item está abaixo do mínimo configurado. Boa hora para revisar os mínimos e ajustar conforme a sazonalidade.`,
    `Os campeões de venda foram ${top || '—'}, vale garantir presença constante na gôndola. Você tem ${requestsCount} pedido(s) de clientes registrado(s) — considere avaliar se algum desses itens vale a pena incluir no catálogo, especialmente os que foram solicitados mais de uma vez.`,
  ].join('\n\n');
}
