/**
 * Domain models for farmaDimin.
 *
 * These mirror the shapes the future MongoDB collections / API responses will
 * return. They live in one place so components, hooks and the service layer all
 * share a single source of truth. `id` is a plain string today (generated
 * client-side) and maps directly to MongoDB's `_id` later.
 */

export type Category =
  | 'Analgésicos'
  | 'Antibióticos'
  | 'Vitaminas'
  | 'Higiene'
  | 'Dermocosméticos'
  | 'Infantil'
  | 'Genéricos'
  | 'Primeiros socorros';

export type Payment = 'pix' | 'cartão' | 'dinheiro';

/** A catalog product (future collection: `products`). */
export interface Product {
  id: string;
  sku: string;
  name: string;
  cat: string;
  price: number;
  cost: number;
  stock: number;
  min: number;
}

export interface SaleItem {
  pid: string;
  name: string;
  qty: number;
  price: number;
}

/** A completed sale (future collection: `sales`). */
export interface Sale {
  id: string;
  ts: string;
  items: SaleItem[];
  total: number;
  payment: Payment | string;
}

/** A product a customer asked for but isn't in the catalog (future: `requests`). */
export interface ProductRequest {
  id: string;
  name: string;
  note: string;
  count: number;
  date: string;
}

export interface CountAdjustment {
  pid: string;
  newStock: number;
  diff: number;
}

/** A physical stock count session result (future collection: `counts`). */
export interface CountRecord {
  id: string;
  ts: string;
  adjustments: CountAdjustment[];
  total: number;
}

export interface Activity {
  id: string;
  kind: 'import' | 'sale' | 'promote' | 'count' | string;
  text: string;
  ts: string;
}

/** The full application state — the unit persisted today (localStorage). */
export interface AppState {
  populated: boolean;
  products: Product[];
  sales: Sale[];
  requests: ProductRequest[];
  counts: CountRecord[];
  activity: Activity[];
}

/* --- Derived / aggregation shapes --- */

export interface PeriodStats {
  revenue: number;
  items: number;
  cost: number;
  sales: number;
  delta?: number;
}

export interface TopProduct {
  pid: string;
  qty: number;
  p: Product;
}

export interface Summary {
  day: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  topProducts: TopProduct[];
  lowStock: Product[];
}

export type Route =
  | 'dashboard'
  | 'produtos'
  | 'vendas'
  | 'solicitados'
  | 'historico'
  | 'contagem'
  | 'relatorios';

export type SummaryPeriod = 'day' | 'week' | 'month';
export type ChartPeriod = 'day' | 'week' | 'month' | 'year';

export interface SeriesPoint {
  label: string;
  value: number;
  date?: Date;
}
