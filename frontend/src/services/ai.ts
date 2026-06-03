/**
 * AI summary generation.
 *
 * In the original prototype this tried `window.claude.complete` and fell back
 * to a canned summary. In this app there is no such global, so it always uses
 * the deterministic fallback. When a backend exists, point `generateAISummary`
 * at an API endpoint (e.g. `apiClient.post('/ai/summary', ctx)`) that calls the
 * Claude API server-side — never expose an API key in the client bundle.
 */
import type { PeriodStats, Product, SummaryPeriod, TopProduct } from '../types';
import { BRL } from '../lib/format';

declare global {
  interface Window {
    claude?: { complete?: (prompt: string) => Promise<string> };
  }
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
  const prompt = `Você é um assistente para o dono de uma pequena farmácia. Escreva um resumo curto e amigável (mas profissional) em português brasileiro sobre o desempenho ${periodLabel}. Tom: como um colega contador conversando, sem firulas. Dados:
${JSON.stringify(ctx, null, 2)}

Estruture em 3 parágrafos curtos:
1) Resumo do desempenho (receita, lucro, vendas)
2) Atenção aos produtos em baixa e o que repor com urgência
3) Recomendação: produtos pedidos por clientes que poderiam entrar no catálogo e o que está vendendo bem

Sem markdown, sem listas. Texto corrido. Máximo 110 palavras.`;

  if (window.claude && typeof window.claude.complete === 'function') {
    try {
      const r = await window.claude.complete(prompt);
      if (r && typeof r === 'string') return r.trim();
    } catch {
      /* fall through to canned summary */
    }
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
