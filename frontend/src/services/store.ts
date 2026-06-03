/**
 * Local persistence + aggregations (the MOCK data layer).
 *
 * Today the whole AppState is serialized to localStorage. When the Node +
 * MongoDB backend exists, these functions are the seam to replace: each one
 * becomes a call through `apiClient` (see `src/lib/apiClient.ts`), while the
 * component-facing shapes (AppState, Summary) stay identical.
 */
import type { AppState, Product, Summary, TopProduct } from '../types';
import { BRL } from '../lib/format';
import { SEED_PRODUCTS, SEED_REQUESTS, buildSeedSales } from '../data/seed';

const STORAGE_KEY = 'farmadimin.v1';

export function emptyState(): AppState {
  return { populated: false, products: [], sales: [], requests: [], counts: [], activity: [] };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    /* noop */
  }
  return emptyState();
}

export function saveState(s: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage full / unavailable — non-fatal for a prototype */
  }
}

export function seedState(): AppState {
  const s = emptyState();
  s.populated = true;
  s.products = SEED_PRODUCTS.map((p) => ({ ...p }));
  s.sales = buildSeedSales();
  s.requests = SEED_REQUESTS.map((r) => ({ ...r }));
  s.activity = [
    { id: 'a1', kind: 'import', text: 'Catálogo populado com 20 produtos de exemplo', ts: new Date().toISOString() },
  ];
  return s;
}

export function clearState(): AppState {
  return emptyState();
}

/** Aggregate revenue/cost/items across day/week/month + top/low lists. */
export function summarize(state: AppState): Summary {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevWeek = new Date(startOfWeek);
  startOfPrevWeek.setDate(startOfWeek.getDate() - 7);

  const todaySales = state.sales.filter((s) => new Date(s.ts) >= startOfDay);
  const weekSales = state.sales.filter((s) => new Date(s.ts) >= startOfWeek);
  const prevWeekSales = state.sales.filter((s) => {
    const d = new Date(s.ts);
    return d >= startOfPrevWeek && d < startOfWeek;
  });
  const monthSales = state.sales.filter((s) => new Date(s.ts) >= startOfMonth);

  const revenue = (arr: AppState['sales']) => arr.reduce((a, s) => a + s.total, 0);
  const itemsCount = (arr: AppState['sales']) =>
    arr.reduce((a, s) => a + s.items.reduce((b, it) => b + it.qty, 0), 0);
  const cost = (arr: AppState['sales']) => {
    let c = 0;
    for (const s of arr) {
      for (const it of s.items) {
        const p = state.products.find((p) => p.id === it.pid);
        if (p) c += p.cost * it.qty;
      }
    }
    return c;
  };

  const weekRev = revenue(weekSales);
  const prevWeekRev = revenue(prevWeekSales);
  const weekDelta = prevWeekRev > 0 ? ((weekRev - prevWeekRev) / prevWeekRev) * 100 : 0;

  const productSales: Record<string, number> = {};
  for (const s of weekSales) {
    for (const it of s.items) {
      productSales[it.pid] = (productSales[it.pid] || 0) + it.qty;
    }
  }
  const topProducts: TopProduct[] = Object.entries(productSales)
    .map(([pid, qty]) => ({ pid, qty, p: state.products.find((p) => p.id === pid) }))
    .filter((x): x is TopProduct => Boolean(x.p))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const lowStock: Product[] = state.products
    .filter((p) => p.stock <= p.min)
    .sort((a, b) => a.stock / a.min - b.stock / b.min)
    .slice(0, 6);

  return {
    day: { revenue: revenue(todaySales), items: itemsCount(todaySales), cost: cost(todaySales), sales: todaySales.length },
    week: { revenue: weekRev, items: itemsCount(weekSales), cost: cost(weekSales), sales: weekSales.length, delta: weekDelta },
    month: { revenue: revenue(monthSales), items: itemsCount(monthSales), cost: cost(monthSales), sales: monthSales.length },
    topProducts,
    lowStock,
  };
}

/** Apply a sale: record it and decrement stock. Returns the next state. */
export function applySale(
  state: AppState,
  cart: { pid: string; qty: number }[],
  payment: string,
): AppState {
  const items = cart.map(({ pid, qty }) => {
    const p = state.products.find((p) => p.id === pid)!;
    return { pid, name: p.name, qty, price: p.price };
  });
  const total = items.reduce((a, it) => a + it.qty * it.price, 0);
  const sale = { id: 's' + Date.now(), ts: new Date().toISOString(), items, total, payment };
  const products = state.products.map((p) => {
    const item = items.find((it) => it.pid === p.id);
    if (!item) return p;
    return { ...p, stock: Math.max(0, p.stock - item.qty) };
  });
  return {
    ...state,
    products,
    sales: [...state.sales, sale],
    activity: [
      { id: 'a' + Date.now(), kind: 'sale', text: `Venda finalizada — ${items.length} item(ns), ${BRL(total)}`, ts: sale.ts },
      ...state.activity,
    ].slice(0, 50),
  };
}
