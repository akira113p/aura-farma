/**
 * Camada de IA do frontend.
 *
 * Tudo passa pelo backend (`/api/ia/*`), que fala com o OpenRouter com a chave
 * guardada server-side — NUNCA expomos chave no bundle do cliente.
 *
 * - `generateAISummary`: o "texto pronto" (resumo do dia/semana/mês). Tenta a IA
 *   real e, em qualquer falha (IA desativada, rede, etc.), cai no `cannedSummary`
 *   determinístico — mesmo molde de antes.
 * - `chatWithAI` + `buildPharmaciaContexto`: usados pelo chat (experimental).
 */
import type { AppState, PeriodStats, Product, Summary, SummaryPeriod, TopProduct } from '../types';
import { apiClient } from '../lib/apiClient';
import { BRL } from '../lib/format';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/** Snapshot compacto (números já calculados) que a IA usa para analisar/calcular. */
export function buildPharmaciaContexto(state: AppState, summary: Summary) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const periodo = (s: PeriodStats) => ({
    receita: round(s.revenue),
    custo: round(s.cost),
    lucro: round(s.revenue - s.cost),
    margem_pct: s.revenue > 0 ? round(((s.revenue - s.cost) / s.revenue) * 100) : 0,
    vendas: s.sales,
    itens: s.items,
  });
  return {
    produtos_cadastrados: state.products.length,
    solicitacoes_de_clientes: state.requests.length,
    dia: periodo(summary.day),
    semana: periodo(summary.week),
    mes: periodo(summary.month),
    baixo_estoque: summary.lowStock
      .slice(0, 8)
      .map((p) => ({ nome: p.name, estoque: p.stock, minimo: p.min, categoria: p.cat, custo: p.cost, preco: p.price })),
    mais_vendidos_semana: summary.topProducts.slice(0, 6).map((t) => ({ nome: t.p.name, unidades: t.qty })),
  };
}

/** Conversa multi-turno com a IA (chat). Lança em caso de falha (sem fallback). */
export async function chatWithAI(messages: ChatMsg[], contexto: unknown): Promise<string> {
  const { reply } = await apiClient.post<{ reply: string }>('/ia/chat', { messages, contexto });
  return reply;
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
  const prompt = `Escreva um resumo curto e amigável (mas profissional) em português brasileiro sobre o desempenho ${periodLabel} da farmácia. Tom: como um colega contador conversando, sem firulas. Dados:
${JSON.stringify(ctx, null, 2)}

Estruture em 3 parágrafos curtos:
1) Resumo do desempenho (receita, lucro, vendas)
2) Atenção aos produtos em baixa e o que repor com urgência
3) Recomendação: produtos pedidos por clientes que poderiam entrar no catálogo e o que está vendendo bem

Sem markdown, sem listas. Texto corrido. Máximo 110 palavras.`;

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
