/**
 * Domain models for auraFarma.
 *
 * These mirror the shapes the future MongoDB collections / API responses will
 * return. They live in one place so components, hooks and the service layer all
 * share a single source of truth. `id` is a plain string today (generated
 * client-side) and maps directly to MongoDB's `_id` later.
 */

/** The authenticated account, as returned by the backend (never includes secrets). */
export interface AuthUser {
  id: string;
  username: string;
  pharmacyName: string;
  email: string;
  authProviders: string[];
}

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

/** A product in the pharmacy's own stock (future collection: `products`). */
export interface Product {
  id: string;
  sku: string;
  name: string;
  cat: string;
  price: number;
  cost: number;
  stock: number;
  min: number;
  /** Active ingredient, when added from the real-medicine catalog. */
  principioAtivo?: string;
  /** Free tags (e.g. therapeutic class), used by search and badges. */
  tags?: string[];
  /** Expiry date (ISO `YYYY-MM-DD`), optional. */
  validade?: string;
}

/** A real-medicine catalog hit (ANVISA), returned by the backend search. */
export interface CatalogMed {
  id: string;
  nome: string;
  principioAtivo: string;
  classeTerapeutica: string;
  empresa: string;
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
  kind: 'import' | 'sale' | 'promote' | 'count' | 'order' | string;
  text: string;
  ts: string;
}

/** A line in a replenishment order sent to the distributor. */
export interface OrderItem {
  /** Catalog product id, or `null` for a free/manual item not yet in the catalog. */
  pid: string | null;
  name: string;
  qty: number;
  cost: number;
  /** True when the item isn't (yet) a catalog product. */
  free?: boolean;
}

/**
 * A replenishment order placed with the distributor (Eurofarma).
 *
 * This is an example "logistics" layer: orders live client-side (localStorage),
 * separate from the backend AppState. Receiving an order DOES update the real
 * stock through the normal product actions.
 */
export interface Order {
  id: string;
  placedAt: string;
  supplier: string;
  /** Index into `ORDER_STAGES` (0..3). */
  stage: number;
  received: boolean;
  receivedAt?: string;
  items: OrderItem[];
  total: number;
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
  | 'estoque'
  | 'vendas'
  | 'solicitados'
  | 'pedidos'
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
