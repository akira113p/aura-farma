import { Schema, model, type Types } from 'mongoose';

/**
 * Per-pharmacy data models (stock, sales, requests, counts, activity).
 *
 * Stored field names are SHORT (n, sku, ct, p ...) to keep documents compact in
 * the 500MB free cluster; the long names live as Mongoose aliases so writes can
 * use `{ name, price, ... }`. Reads use `.lean()` (fast, skips virtuals) and are
 * mapped back to the long-name API shape by the `toApi*` helpers below.
 *
 * Every document is scoped to a user (`u`) and indexed by it.
 */

const owner = { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true } as const;
const opts = { versionKey: false, minimize: false } as const;

// ---- Product (collection: products) ----
const productSchema = new Schema(
  {
    u: owner,
    n: { type: String, required: true, alias: 'name' },
    sku: { type: String, required: true },
    ct: { type: String, required: true, alias: 'cat' },
    p: { type: Number, required: true, alias: 'price' },
    co: { type: Number, required: true, alias: 'cost' },
    s: { type: Number, required: true, alias: 'stock' },
    mn: { type: Number, required: true, alias: 'min' },
    v: { type: Date, default: null, alias: 'validade' },
    pa: { type: String, default: null, alias: 'principioAtivo' },
    tg: { type: [String], default: undefined, alias: 'tags' },
  },
  opts,
);
productSchema.index({ u: 1, sku: 1 });

// ---- Sale (collection: sales) ----
const saleItemSchema = new Schema(
  { pid: String, nm: String, q: Number, pr: Number },
  { _id: false },
);
const saleSchema = new Schema(
  {
    u: owner,
    ts: { type: Date, required: true },
    it: { type: [saleItemSchema], default: [] },
    tot: { type: Number, required: true },
    pay: { type: String, default: '' },
  },
  opts,
);
saleSchema.index({ u: 1, ts: -1 });

// ---- Request / solicitados (collection: requests) ----
const requestSchema = new Schema(
  {
    u: owner,
    nm: { type: String, required: true, alias: 'name' },
    nt: { type: String, default: '', alias: 'note' },
    c: { type: Number, default: 1, alias: 'count' },
    d: { type: String, required: true, alias: 'date' },
  },
  opts,
);

// ---- Count / contagem (collection: counts) ----
const countAdjSchema = new Schema(
  { pid: String, ns: Number, df: Number },
  { _id: false },
);
const countSchema = new Schema(
  {
    u: owner,
    ts: { type: Date, required: true },
    adj: { type: [countAdjSchema], default: [] },
    tot: { type: Number, default: 0 },
  },
  opts,
);
countSchema.index({ u: 1, ts: -1 });

// ---- Activity (collection: activities) ----
const activitySchema = new Schema(
  {
    u: owner,
    k: { type: String, default: 'import', alias: 'kind' },
    tx: { type: String, required: true, alias: 'text' },
    ts: { type: Date, required: true },
  },
  opts,
);
activitySchema.index({ u: 1, ts: -1 });

export const Product = model('Product', productSchema);
export const Sale = model('Sale', saleSchema);
export const RequestModel = model('Request', requestSchema);
export const Count = model('Count', countSchema);
export const Activity = model('Activity', activitySchema);

/* ---------------- API mappers (short stored fields -> long API shape) -------- */

type Lean = Record<string, unknown> & { _id: Types.ObjectId };
const id = (d: Lean) => String(d._id);
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

/** Product API input (long names) -> stored short-field document. */
export interface ProductInput {
  name: string;
  sku: string;
  cat: string;
  price: number;
  cost: number;
  stock: number;
  min: number;
  validade?: string | null;
  principioAtivo?: string | null;
  tags?: string[];
}

export function toStoredProduct(u: Types.ObjectId | string, x: ProductInput) {
  return {
    u,
    n: x.name,
    sku: x.sku,
    ct: x.cat,
    p: x.price,
    co: x.cost,
    s: x.stock,
    mn: x.min,
    v: x.validade ? new Date(x.validade) : null,
    pa: x.principioAtivo ?? null,
    tg: x.tags && x.tags.length ? x.tags : undefined,
  };
}

export function toApiProduct(d: Lean) {
  return {
    id: id(d),
    sku: d.sku as string,
    name: d.n as string,
    cat: d.ct as string,
    price: d.p as number,
    cost: d.co as number,
    stock: d.s as number,
    min: d.mn as number,
    validade: d.v ? (d.v as Date).toISOString().slice(0, 10) : undefined,
    principioAtivo: (d.pa as string) ?? undefined,
    tags: (d.tg as string[]) ?? undefined,
  };
}

export function toApiSale(d: Lean) {
  const it = (d.it as { pid: string; nm: string; q: number; pr: number }[]) ?? [];
  return {
    id: id(d),
    ts: iso(d.ts),
    items: it.map((i) => ({ pid: i.pid, name: i.nm, qty: i.q, price: i.pr })),
    total: d.tot as number,
    payment: (d.pay as string) ?? '',
  };
}

export function toApiRequest(d: Lean) {
  return { id: id(d), name: d.nm as string, note: (d.nt as string) ?? '', count: d.c as number, date: d.d as string };
}

export function toApiCount(d: Lean) {
  const adj = (d.adj as { pid: string; ns: number; df: number }[]) ?? [];
  return {
    id: id(d),
    ts: iso(d.ts),
    adjustments: adj.map((a) => ({ pid: a.pid, newStock: a.ns, diff: a.df })),
    total: d.tot as number,
  };
}

export function toApiActivity(d: Lean) {
  return { id: id(d), kind: (d.k as string) ?? 'import', text: d.tx as string, ts: iso(d.ts) };
}
