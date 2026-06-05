/**
 * Data actions for the pharmacy AppState.
 *
 * Every action takes the current `AppState` and returns the NEXT `AppState`
 * (Promise), so screens just do `setState(await action(state, ...))`. Two
 * backends, chosen by `config.useMock`:
 *   - `false` (default in this build): real Node/MongoDB API via `apiClient`.
 *   - `true`: the in-memory localStorage mock (dev without a backend).
 */
import { config } from '../config';
import { apiClient } from '../lib/apiClient';
import type { AppState, CountAdjustment, Product, ProductRequest, Sale } from '../types';
import { applySale, clearState, loadState, saveState, seedState } from './store';
import { CATEGORIES } from '../data/seed';
import { todayISO } from '../lib/format';

/** Strip `id`/empty fields to the shape the API expects for a product. */
function productPayload(p: Product) {
  const body: Record<string, unknown> = {
    name: p.name,
    sku: p.sku,
    cat: p.cat,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    min: p.min,
  };
  if (p.validade) body.validade = p.validade;
  if (p.principioAtivo) body.principioAtivo = p.principioAtivo;
  if (p.tags && p.tags.length) body.tags = p.tags;
  return body;
}

const persistMock = (s: AppState): AppState => {
  saveState(s);
  return s;
};

/* ---------------- load / seed / reset ---------------- */

export async function loadAppState(): Promise<AppState> {
  if (config.useMock) return loadState();
  return apiClient.get<AppState>('/estado');
}

export async function seedData(): Promise<AppState> {
  if (config.useMock) return persistMock(seedState());
  return apiClient.post<AppState>('/estado/seed', {});
}

export async function resetData(): Promise<AppState> {
  if (config.useMock) return persistMock(clearState());
  return apiClient.post<AppState>('/estado/reset', {});
}

/* ---------------- products (estoque) ---------------- */

export async function createProduct(state: AppState, p: Product): Promise<AppState> {
  let product: Product;
  if (config.useMock) {
    product = { ...p, id: 'p' + Date.now() };
  } else {
    const r = await apiClient.post<{ product: Product }>('/estoque', productPayload(p));
    product = r.product;
  }
  const next = { ...state, populated: true, products: [...state.products, product] };
  return config.useMock ? persistMock(next) : next;
}

export async function updateProduct(state: AppState, p: Product): Promise<AppState> {
  let product = p;
  if (!config.useMock) {
    const r = await apiClient.patch<{ product: Product }>(`/estoque/${p.id}`, productPayload(p));
    product = r.product;
  }
  const next = { ...state, products: state.products.map((x) => (x.id === product.id ? product : x)) };
  return config.useMock ? persistMock(next) : next;
}

export async function removeProduct(state: AppState, id: string): Promise<AppState> {
  if (!config.useMock) await apiClient.delete(`/estoque/${id}`);
  const next = { ...state, products: state.products.filter((p) => p.id !== id) };
  return config.useMock ? persistMock(next) : next;
}

/* ---------------- sales (vendas) ---------------- */

export async function recordSale(
  state: AppState,
  cart: { pid: string; qty: number }[],
  payment: string,
): Promise<AppState> {
  if (config.useMock) return persistMock(applySale(state, cart, payment));
  const { sale, updatedProducts } = await apiClient.post<{ sale: Sale; updatedProducts: Product[] }>('/vendas', {
    items: cart,
    payment,
  });
  const byId = new Map(updatedProducts.map((p) => [p.id, p]));
  return {
    ...state,
    products: state.products.map((p) => byId.get(p.id) ?? p),
    sales: [...state.sales, sale],
  };
}

/* ---------------- requests (solicitados) ---------------- */

function mergeRequest(state: AppState, request: ProductRequest): AppState {
  const exists = state.requests.some((r) => r.id === request.id);
  return {
    ...state,
    requests: exists ? state.requests.map((r) => (r.id === request.id ? request : r)) : [request, ...state.requests],
  };
}

export async function addRequest(state: AppState, name: string, note: string): Promise<AppState> {
  if (config.useMock) {
    const existing = state.requests.find((r) => r.name.toLowerCase() === name.trim().toLowerCase());
    if (existing) {
      return persistMock(mergeRequest(state, { ...existing, count: existing.count + 1, date: todayISO() }));
    }
    const r: ProductRequest = { id: 'r' + Date.now(), name: name.trim(), note: note.trim(), count: 1, date: todayISO() };
    return persistMock(mergeRequest(state, r));
  }
  const { request } = await apiClient.post<{ request: ProductRequest }>('/solicitados', { name, note });
  return mergeRequest(state, request);
}

export async function bumpRequest(state: AppState, id: string): Promise<AppState> {
  const current = state.requests.find((r) => r.id === id);
  if (!current) return state;
  if (config.useMock) {
    return persistMock(mergeRequest(state, { ...current, count: current.count + 1, date: todayISO() }));
  }
  const { request } = await apiClient.patch<{ request: ProductRequest }>(`/solicitados/${id}`, {
    count: current.count + 1,
  });
  return mergeRequest(state, request);
}

export async function removeRequest(state: AppState, id: string): Promise<AppState> {
  if (!config.useMock) await apiClient.delete(`/solicitados/${id}`);
  const next = { ...state, requests: state.requests.filter((r) => r.id !== id) };
  return config.useMock ? persistMock(next) : next;
}

export async function promoteRequest(state: AppState, req: ProductRequest): Promise<AppState> {
  const draft: Product = {
    id: '',
    sku: 'novo-' + req.id.slice(-4),
    name: req.name,
    cat: CATEGORIES[0],
    price: 0,
    cost: 0,
    stock: 0,
    min: 3,
  };
  const withProduct = await createProduct(state, draft);
  return removeRequest(withProduct, req.id);
}

/* ---------------- counts (contagem) ---------------- */

export async function applyCount(state: AppState, adjustments: CountAdjustment[]): Promise<AppState> {
  if (config.useMock) {
    const adjMap = Object.fromEntries(adjustments.map((a) => [a.pid, a.newStock]));
    const products = state.products.map((p) => (adjMap[p.id] !== undefined ? { ...p, stock: adjMap[p.id] } : p));
    const count = { id: 'c' + Date.now(), ts: new Date().toISOString(), adjustments, total: adjustments.length };
    return persistMock({ ...state, products, counts: [count, ...state.counts] });
  }
  const { count, updatedProducts } = await apiClient.post<{
    count: AppState['counts'][number];
    updatedProducts: Product[];
  }>('/contagem', { adjustments: adjustments.map((a) => ({ pid: a.pid, newStock: a.newStock })) });
  const byId = new Map(updatedProducts.map((p) => [p.id, p]));
  return {
    ...state,
    products: state.products.map((p) => byId.get(p.id) ?? p),
    counts: [count, ...state.counts],
  };
}
