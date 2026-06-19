/**
 * "Ferramentas" de dados da IA (cardápio fixo) — camada de defesa.
 *
 * O planejador (IA 1) só pode ESCOLHER nomes deste cardápio; nunca escreve query
 * crua. Toda consulta é executada aqui no backend FILTRADA por `userId` da
 * sessão, então a IA só enxerga os dados da conta logada. Retornos são compactos
 * (números já agregados) para gastar menos tokens na IA principal.
 */
import { Count, Product, RequestModel, Sale } from '../models/pharmacy';

const T = 5000; // maxTimeMS por consulta

export interface ToolCall {
  nome: string;
  params?: Record<string, unknown>;
}

type SaleItem = { pid: string; nm: string; q: number; pr: number };
const round = (n: number) => Math.round(n * 100) / 100;

/** Início do período (janelas rolantes). */
function inicioPeriodo(periodo: string): Date {
  const d = new Date();
  if (periodo === 'hoje') {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setDate(d.getDate() - (periodo === 'semana' ? 7 : 30));
  return d;
}

/** Descrição de cada ferramenta (para montar o cardápio do planejador). */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  vendas_por_produto: 'vendas_por_produto { periodo: "hoje"|"semana"|"mes" } — unidades e receita por produto (use para "mais/menos vendido").',
  resumo_financeiro: 'resumo_financeiro { periodo: "hoje"|"semana"|"mes" } — receita, custo, lucro, margem %, nº de vendas, ticket médio.',
  estoque: 'estoque { filtro: "baixo"|"esgotado"|"todos", categoria?: string } — produtos em estoque (reposição/valor).',
  buscar_produto: 'buscar_produto { termo: string } — procura um produto específico pelo nome.',
  solicitacoes: 'solicitacoes {} — produtos que clientes pediram e não existem no catálogo.',
  contagem: 'contagem {} — contagens de inventário recentes e seus ajustes/divergências.',
};

/** Nomes válidos — usados para validar o plano da IA 1. */
export const TOOL_NAMES = new Set(Object.keys(TOOL_DESCRIPTIONS));

/** Monta o texto do cardápio só com as ferramentas informadas. */
export function catalogText(names: string[]): string {
  return names
    .map((n) => TOOL_DESCRIPTIONS[n])
    .filter(Boolean)
    .map((d) => `- ${d}`)
    .join('\n');
}

export async function runTool(u: string, call: ToolCall): Promise<unknown> {
  const p = call.params ?? {};
  switch (call.nome) {
    case 'vendas_por_produto': {
      const periodo = ['hoje', 'semana', 'mes'].includes(String(p.periodo)) ? String(p.periodo) : 'hoje';
      const sales = await Sale.find({ u, ts: { $gte: inicioPeriodo(periodo) } }).limit(3000).maxTimeMS(T).lean();
      const agg: Record<string, { nome: string; unidades: number; receita: number }> = {};
      for (const s of sales) {
        for (const it of ((s.it as SaleItem[] | undefined) ?? [])) {
          const key = it.pid || it.nm;
          const e = (agg[key] ??= { nome: it.nm, unidades: 0, receita: 0 });
          e.unidades += it.q;
          e.receita += it.q * it.pr;
        }
      }
      const produtos = Object.values(agg)
        .map((e) => ({ ...e, receita: round(e.receita) }))
        .sort((a, b) => b.unidades - a.unidades);
      return { periodo, total_vendas: sales.length, produtos: produtos.slice(0, 40) };
    }

    case 'resumo_financeiro': {
      const periodo = ['hoje', 'semana', 'mes'].includes(String(p.periodo)) ? String(p.periodo) : 'mes';
      const [sales, products] = await Promise.all([
        Sale.find({ u, ts: { $gte: inicioPeriodo(periodo) } }).limit(5000).maxTimeMS(T).lean(),
        Product.find({ u }).select('co').maxTimeMS(T).lean(),
      ]);
      const custoPorId: Record<string, number> = {};
      for (const pr of products) custoPorId[String(pr._id)] = pr.co as number;
      let receita = 0;
      let custo = 0;
      let itens = 0;
      for (const s of sales) {
        for (const it of ((s.it as SaleItem[] | undefined) ?? [])) {
          receita += it.q * it.pr;
          itens += it.q;
          const c = custoPorId[it.pid];
          if (c != null) custo += it.q * c;
        }
      }
      const lucro = receita - custo;
      return {
        periodo,
        receita: round(receita),
        custo: round(custo),
        lucro: round(lucro),
        margem_pct: receita > 0 ? round((lucro / receita) * 100) : 0,
        vendas: sales.length,
        itens,
        ticket_medio: round(sales.length > 0 ? receita / sales.length : 0),
      };
    }

    case 'estoque': {
      const filtro = ['baixo', 'esgotado', 'todos'].includes(String(p.filtro)) ? String(p.filtro) : 'baixo';
      const categoria = p.categoria ? String(p.categoria) : null;
      const limite = Math.min(Number(p.limite) || 30, 60);
      const q: Record<string, unknown> = { u };
      if (categoria) q.ct = categoria;
      let docs = await Product.find(q).limit(300).maxTimeMS(T).lean();
      if (filtro === 'baixo') docs = docs.filter((d) => (d.s as number) <= (d.mn as number));
      else if (filtro === 'esgotado') docs = docs.filter((d) => (d.s as number) === 0);
      docs = docs
        .sort((a, b) => (a.s as number) / Math.max(a.mn as number, 1) - (b.s as number) / Math.max(b.mn as number, 1))
        .slice(0, limite);
      return {
        filtro,
        categoria,
        produtos: docs.map((d) => ({
          nome: d.n as string,
          categoria: d.ct as string,
          estoque: d.s as number,
          minimo: d.mn as number,
          custo: d.co as number,
          preco: d.p as number,
        })),
      };
    }

    case 'buscar_produto': {
      const termo = String(p.termo ?? p.nome ?? '').trim();
      if (!termo) return { termo, produtos: [] };
      const rx = new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const docs = await Product.find({ u, n: rx }).limit(10).maxTimeMS(T).lean();
      return {
        termo,
        produtos: docs.map((d) => ({
          nome: d.n as string,
          categoria: d.ct as string,
          estoque: d.s as number,
          minimo: d.mn as number,
          custo: d.co as number,
          preco: d.p as number,
        })),
      };
    }

    case 'solicitacoes': {
      const docs = await RequestModel.find({ u }).sort({ c: -1 }).limit(20).maxTimeMS(T).lean();
      return { solicitacoes: docs.map((d) => ({ nome: d.nm as string, pedidos: d.c as number, nota: (d.nt as string) ?? '' })) };
    }

    case 'contagem': {
      const [total, docs] = await Promise.all([
        Count.countDocuments({ u }).maxTimeMS(T),
        Count.find({ u }).sort({ ts: -1 }).limit(5).maxTimeMS(T).lean(),
      ]);
      return {
        contagens_realizadas: total,
        recentes: docs.map((d) => {
          const adj = (d.adj as { pid: string; ns: number; df: number }[] | undefined) ?? [];
          return {
            data: (d.ts as Date).toISOString().slice(0, 10),
            itens_ajustados: d.tot as number,
            diferenca_total: adj.reduce((a, x) => a + x.df, 0),
          };
        }),
      };
    }

    default:
      return { erro: `ferramenta desconhecida: ${call.nome}` };
  }
}
