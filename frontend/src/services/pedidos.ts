/**
 * Pedidos de reposição ao distribuidor (Eurofarma) — camada de exemplo.
 *
 * Os pedidos são uma camada de "logística" client-side: vivem no localStorage,
 * separados do AppState do backend. A sugestão de reposição lê o estoque real
 * (`state.products`) e, ao RECEBER um pedido, o estoque é de fato atualizado
 * pelas ações normais de produto (`updateProduct`/`createProduct`).
 *
 * Quando a Euro Farma expuser uma API de pedidos, esta é a costura única a
 * trocar (como `services/dados.ts` faz para o estoque).
 */
import type { Order, OrderItem, Product } from '../types';

export interface OrderStage {
  key: string;
  label: string;
  tone: 'neutral' | 'info' | 'warning' | 'success';
  hint: string;
}

/** Estágios da logística, na ordem em que o pedido avança. */
export const ORDER_STAGES: OrderStage[] = [
  { key: 'aguardando', label: 'Aguardando', tone: 'neutral', hint: 'Enviado ao distribuidor' },
  { key: 'confirmado', label: 'Confirmado', tone: 'info', hint: 'Distribuidor aceitou o pedido' },
  { key: 'separacao', label: 'Em separação', tone: 'warning', hint: 'Itens sendo separados no CD' },
  { key: 'entregue', label: 'Entregue', tone: 'success', hint: 'Pronto para receber no balcão' },
];

export const SUPPLIER = 'Eurofarma';

/** Quantidade sugerida: repor até ~2× o mínimo (pelo menos 1). */
export function suggestQty(p: Product): number {
  return Math.max(p.min * 2 - p.stock, 1);
}

const STORAGE_KEY = 'aurafarma.pedidos.v1';

export function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Order[];
  } catch {
    /* localStorage indisponível ou JSON inválido — começa vazio */
  }
  return [];
}

export function saveOrders(orders: Order[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    /* ignore */
  }
}

function relTime(deltaDays: number, hour = 10, min = 25): string {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

/**
 * Gera 1 pedido recebido (histórico) + 1 em andamento a partir do catálogo
 * real, só para deixar a tela de logística visível como exemplo. Não mexe no
 * estoque — o pedido histórico já entra como `received`, e o em andamento só
 * soma ao estoque quando o usuário marcar como entregue.
 */
export function buildExampleOrders(products: Product[]): Order[] {
  if (products.length === 0) return [];
  const total = (items: OrderItem[]) => items.reduce((a, it) => a + it.qty * it.cost, 0);
  const toItems = (ps: Product[], qty: (p: Product) => number): OrderItem[] =>
    ps.map((p) => ({ pid: p.id, name: p.name, qty: qty(p), cost: p.cost, free: false }));

  const pastItems = toItems(products.slice(0, 3), (p) => Math.max(p.min, 10));
  const activeSource = products.slice(3, 6).length ? products.slice(3, 6) : products.slice(0, 2);
  const activeItems = toItems(activeSource, suggestQty);

  const orders: Order[] = [
    {
      id: 'o' + (Date.now() - 2),
      placedAt: relTime(-6, 11, 10),
      supplier: SUPPLIER,
      stage: 3,
      received: true,
      receivedAt: relTime(-4, 9, 30),
      items: pastItems,
      total: total(pastItems),
    },
  ];
  if (activeItems.length) {
    orders.push({
      id: 'o' + (Date.now() - 1),
      placedAt: relTime(-1, 15, 5),
      supplier: SUPPLIER,
      stage: 1,
      received: false,
      items: activeItems,
      total: total(activeItems),
    });
  }
  return orders;
}
