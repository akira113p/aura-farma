import { Router, type Request } from 'express';
import { isValidObjectId } from 'mongoose';
import { readLimiter, writeLimiter } from '../middleware/rateLimit';
import { AppError, asyncHandler } from '../lib/http';
import {
  contagemSchema,
  productCreateSchema,
  productUpdateSchema,
  solicitacaoCreateSchema,
  solicitacaoUpdateSchema,
  vendaSchema,
} from '../lib/validation';
import {
  Activity,
  Count,
  Product,
  RequestModel,
  Sale,
  toApiActivity,
  toApiCount,
  toApiProduct,
  toApiRequest,
  toApiSale,
  toStoredProduct,
} from '../models/pharmacy';
import { SEED_PRODUCTS, SEED_REQUESTS, buildSeedSales } from '../services/seedData';

export const dadosRouter = Router();

// "Tickets": reads get the looser limiter, every mutation the stricter one.
dadosRouter.use((req, res, next) => (req.method === 'GET' ? readLimiter : writeLimiter)(req, res, next));

const T = 5000; // maxTimeMS — caps how long a single DB op can run
const uid = (req: Request): string => req.session.userId as string;
const today = () => new Date().toISOString().slice(0, 10);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Keep only the most recent 50 activities for the user. */
async function addActivity(u: string, kind: string, text: string): Promise<void> {
  await Activity.create({ u, k: kind, tx: text, ts: new Date() });
  const cutoff = await Activity.find({ u }).sort({ ts: -1 }).skip(50).limit(1).select('ts').lean();
  if (cutoff[0]) await Activity.deleteMany({ u, ts: { $lt: cutoff[0].ts } });
}

/** Build the full AppState payload for one user in a single shot. */
async function loadEstado(u: string) {
  const [products, sales, requests, counts, activity] = await Promise.all([
    Product.find({ u }).maxTimeMS(T).lean(),
    Sale.find({ u }).sort({ ts: -1 }).limit(2000).maxTimeMS(T).lean(),
    RequestModel.find({ u }).maxTimeMS(T).lean(),
    Count.find({ u }).sort({ ts: -1 }).limit(500).maxTimeMS(T).lean(),
    Activity.find({ u }).sort({ ts: -1 }).limit(50).maxTimeMS(T).lean(),
  ]);
  return {
    populated: products.length > 0,
    products: products.map(toApiProduct),
    sales: sales.map(toApiSale).reverse(), // oldest-first, like the client expects
    requests: requests.map(toApiRequest),
    counts: counts.map(toApiCount),
    activity: activity.map(toApiActivity),
  };
}

async function wipe(u: string): Promise<void> {
  await Promise.all([
    Product.deleteMany({ u }),
    Sale.deleteMany({ u }),
    RequestModel.deleteMany({ u }),
    Count.deleteMany({ u }),
    Activity.deleteMany({ u }),
  ]);
}

// GET /api/estado — one fast call that loads the whole AppState
dadosRouter.get(
  '/estado',
  asyncHandler(async (req, res) => {
    res.json(await loadEstado(uid(req)));
  }),
);

// POST /api/estado/seed — populate example data for this user
dadosRouter.post(
  '/estado/seed',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    await wipe(u);
    const inserted = await Product.insertMany(SEED_PRODUCTS.map((p) => toStoredProduct(u, p)));
    const refs = inserted.map((d) => {
      const o = d.toObject();
      return { id: String(o._id), name: o.n as string, price: o.p as number };
    });
    await Sale.insertMany(buildSeedSales(refs).map((s) => ({ u, ts: s.ts, it: s.it, tot: s.tot, pay: s.pay })));
    await RequestModel.insertMany(SEED_REQUESTS.map((r) => ({ u, nm: r.name, nt: r.note, c: r.count, d: r.date })));
    await Activity.create({ u, k: 'import', tx: 'Catálogo populado com 20 produtos de exemplo', ts: new Date() });
    res.status(201).json(await loadEstado(u));
  }),
);

// POST /api/estado/reset — delete all of this user's data
dadosRouter.post(
  '/estado/reset',
  asyncHandler(async (req, res) => {
    await wipe(uid(req));
    res.json({ populated: false, products: [], sales: [], requests: [], counts: [], activity: [] });
  }),
);

// POST /api/estoque — create product
dadosRouter.post(
  '/estoque',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    const data = productCreateSchema.parse(req.body);
    const doc = await Product.create(toStoredProduct(u, data));
    await addActivity(u, 'import', `Produto adicionado: ${data.name}`);
    res.status(201).json({ product: toApiProduct(doc.toObject()) });
  }),
);

// PATCH /api/estoque/:id — update product
dadosRouter.patch(
  '/estoque/:id',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new AppError(404, 'Produto nao encontrado');
    const data = productUpdateSchema.parse(req.body);
    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set.n = data.name;
    if (data.sku !== undefined) set.sku = data.sku;
    if (data.cat !== undefined) set.ct = data.cat;
    if (data.price !== undefined) set.p = data.price;
    if (data.cost !== undefined) set.co = data.cost;
    if (data.stock !== undefined) set.s = data.stock;
    if (data.min !== undefined) set.mn = data.min;
    if (data.validade !== undefined) set.v = data.validade ? new Date(data.validade) : null;
    if (data.principioAtivo !== undefined) set.pa = data.principioAtivo ?? null;
    if (data.tags !== undefined) set.tg = data.tags;
    const doc = await Product.findOneAndUpdate({ _id: id, u }, { $set: set }, { new: true }).maxTimeMS(T).lean();
    if (!doc) throw new AppError(404, 'Produto nao encontrado');
    res.json({ product: toApiProduct(doc) });
  }),
);

// DELETE /api/estoque/:id — remove product
dadosRouter.delete(
  '/estoque/:id',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new AppError(404, 'Produto nao encontrado');
    const doc = await Product.findOneAndDelete({ _id: id, u }).maxTimeMS(T).lean();
    if (!doc) throw new AppError(404, 'Produto nao encontrado');
    res.status(204).end();
  }),
);

// POST /api/vendas — record a sale and decrement stock server-side
dadosRouter.post(
  '/vendas',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    const { items, payment } = vendaSchema.parse(req.body);
    const ids = items.map((i) => i.pid).filter(isValidObjectId);
    const prods = await Product.find({ u, _id: { $in: ids } }).maxTimeMS(T).lean();
    const byId = new Map(prods.map((p) => [String(p._id), p]));

    const saleItems: { pid: string; nm: string; q: number; pr: number }[] = [];
    const ops: Parameters<typeof Product.bulkWrite>[0] = [];
    let total = 0;
    for (const i of items) {
      const p = byId.get(i.pid);
      if (!p) throw new AppError(400, 'Produto inexistente na venda');
      if ((p.s as number) < i.qty) throw new AppError(409, `Estoque insuficiente: ${p.n}`);
      saleItems.push({ pid: i.pid, nm: p.n as string, q: i.qty, pr: p.p as number });
      total += i.qty * (p.p as number);
      ops.push({ updateOne: { filter: { _id: p._id, u, s: { $gte: i.qty } }, update: { $inc: { s: -i.qty } } } });
    }
    const bulk = await Product.bulkWrite(ops);
    if (bulk.modifiedCount !== items.length) throw new AppError(409, 'Estoque insuficiente; venda nao aplicada');

    const sale = await Sale.create({ u, ts: new Date(), it: saleItems, tot: total, pay: payment });
    const updated = await Product.find({ u, _id: { $in: ids } }).maxTimeMS(T).lean();
    await addActivity(u, 'sale', `Venda finalizada — ${saleItems.length} item(ns), R$ ${total.toFixed(2)}`);
    res.status(201).json({ sale: toApiSale(sale.toObject()), updatedProducts: updated.map(toApiProduct) });
  }),
);

// POST /api/solicitados — add a customer request (or bump an existing one)
dadosRouter.post(
  '/solicitados',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    const { name, note } = solicitacaoCreateSchema.parse(req.body);
    const existing = await RequestModel.findOne({ u, nm: new RegExp(`^${escapeRegex(name)}$`, 'i') }).maxTimeMS(T);
    if (existing) {
      existing.set('count', (existing.get('count') as number) + 1);
      existing.set('date', today());
      await existing.save();
      res.json({ request: toApiRequest(existing.toObject()) });
      return;
    }
    const doc = await RequestModel.create({ u, nm: name, nt: note, c: 1, d: today() });
    res.status(201).json({ request: toApiRequest(doc.toObject()) });
  }),
);

// PATCH /api/solicitados/:id — update count/note
dadosRouter.patch(
  '/solicitados/:id',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new AppError(404, 'Solicitacao nao encontrada');
    const data = solicitacaoUpdateSchema.parse(req.body);
    const set: Record<string, unknown> = { d: today() };
    if (data.count !== undefined) set.c = data.count;
    if (data.note !== undefined) set.nt = data.note;
    const doc = await RequestModel.findOneAndUpdate({ _id: id, u }, { $set: set }, { new: true }).maxTimeMS(T).lean();
    if (!doc) throw new AppError(404, 'Solicitacao nao encontrada');
    res.json({ request: toApiRequest(doc) });
  }),
);

// DELETE /api/solicitados/:id
dadosRouter.delete(
  '/solicitados/:id',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    const { id } = req.params;
    if (!isValidObjectId(id)) throw new AppError(404, 'Solicitacao nao encontrada');
    const doc = await RequestModel.findOneAndDelete({ _id: id, u }).maxTimeMS(T).lean();
    if (!doc) throw new AppError(404, 'Solicitacao nao encontrada');
    res.status(204).end();
  }),
);

// POST /api/contagem — apply a stock count, updating product stock
dadosRouter.post(
  '/contagem',
  asyncHandler(async (req, res) => {
    const u = uid(req);
    const { adjustments } = contagemSchema.parse(req.body);
    const ids = adjustments.map((a) => a.pid).filter(isValidObjectId);
    const prods = await Product.find({ u, _id: { $in: ids } }).maxTimeMS(T).lean();
    const byId = new Map(prods.map((p) => [String(p._id), p]));

    const adj: { pid: string; ns: number; df: number }[] = [];
    const ops: Parameters<typeof Product.bulkWrite>[0] = [];
    for (const a of adjustments) {
      const p = byId.get(a.pid);
      if (!p) continue;
      adj.push({ pid: a.pid, ns: a.newStock, df: a.newStock - (p.s as number) });
      ops.push({ updateOne: { filter: { _id: a.pid, u }, update: { $set: { s: a.newStock } } } });
    }
    if (adj.length === 0) throw new AppError(400, 'Nenhum ajuste valido');
    await Product.bulkWrite(ops);
    const count = await Count.create({ u, ts: new Date(), adj, tot: adj.length });
    const updated = await Product.find({ u, _id: { $in: ids } }).maxTimeMS(T).lean();
    const totalDiff = adj.reduce((s, x) => s + x.df, 0);
    await addActivity(u, 'count', `Contagem aplicada — ${adj.length} ajuste(s), diferença ${totalDiff > 0 ? '+' : ''}${totalDiff}`);
    res.status(201).json({ count: toApiCount(count.toObject()), updatedProducts: updated.map(toApiProduct) });
  }),
);
