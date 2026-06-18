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

/**
 * Snapshot rico da farmácia (números já calculados) que vai no system prompt
 * para a IA analisar/calcular. Quanto mais contexto aqui, melhores as respostas
 * — a mensagem do usuário pode ser simples.
 */
export function buildPharmaciaContexto(state: AppState, summary: Summary) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const periodo = (s: PeriodStats) => ({
    receita: round(s.revenue),
    custo: round(s.cost),
    lucro: round(s.revenue - s.cost),
    margem_pct: s.revenue > 0 ? round(((s.revenue - s.cost) / s.revenue) * 100) : 0,
    vendas: s.sales,
    itens: s.items,
    ticket_medio: round(s.sales > 0 ? s.revenue / s.sales : 0),
  });

  const products = state.products;
  const valorCusto = round(products.reduce((a, p) => a + p.cost * p.stock, 0));
  const valorVenda = round(products.reduce((a, p) => a + p.price * p.stock, 0));

  const catMap: Record<string, { itens: number; unidades: number; valor_custo: number }> = {};
  for (const p of products) {
    const c = (catMap[p.cat] ??= { itens: 0, unidades: 0, valor_custo: 0 });
    c.itens += 1;
    c.unidades += p.stock;
    c.valor_custo += p.cost * p.stock;
  }
  const por_categoria = Object.entries(catMap)
    .map(([categoria, v]) => ({ categoria, itens: v.itens, unidades: v.unidades, valor_custo: round(v.valor_custo) }))
    .sort((a, b) => b.valor_custo - a.valor_custo);

  return {
    data: new Date().toISOString().slice(0, 10),
    resumo_estoque: {
      produtos_cadastrados: products.length,
      esgotados: products.filter((p) => p.stock === 0).length,
      abaixo_do_minimo: products.filter((p) => p.stock <= p.min).length,
      valor_em_estoque_custo: valorCusto,
      valor_em_estoque_venda: valorVenda,
      margem_potencial_pct: valorVenda > 0 ? round(((valorVenda - valorCusto) / valorVenda) * 100) : 0,
    },
    por_categoria,
    desempenho: { dia: periodo(summary.day), semana: periodo(summary.week), mes: periodo(summary.month) },
    baixo_estoque: summary.lowStock.slice(0, 12).map((p) => ({
      nome: p.name,
      categoria: p.cat,
      estoque: p.stock,
      minimo: p.min,
      custo: round(p.cost),
      preco: round(p.price),
    })),
    mais_vendidos_semana: summary.topProducts.slice(0, 8).map((t) => ({
      nome: t.p.name,
      unidades: t.qty,
      preco: round(t.p.price),
      receita: round(t.qty * t.p.price),
    })),
    solicitacoes_de_clientes: [...state.requests]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((r) => ({ nome: r.name, pedidos: r.count })),
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
