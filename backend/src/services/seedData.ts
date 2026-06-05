import type { ProductInput } from '../models/pharmacy';

/**
 * Example dataset for the "Popular exemplo" action, generated server-side so the
 * sales reference the real inserted product ids (referential integrity).
 */

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
function relDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const SEED_PRODUCTS: ProductInput[] = [
  { sku: '7891000100103', name: 'Dipirona 500mg c/10', cat: 'Analgésicos', price: 8.9, cost: 4.2, stock: 42, min: 15 },
  { sku: '7891000201205', name: 'Paracetamol 750mg c/20', cat: 'Analgésicos', price: 12.5, cost: 6.3, stock: 8, min: 12 },
  { sku: '7891000302307', name: 'Ibuprofeno 600mg c/10', cat: 'Analgésicos', price: 18.4, cost: 9.1, stock: 19, min: 10 },
  { sku: '7891000403409', name: 'Amoxicilina 500mg c/15', cat: 'Antibióticos', price: 32.0, cost: 18.0, stock: 6, min: 8 },
  { sku: '7891000504501', name: 'Azitromicina 500mg c/5', cat: 'Antibióticos', price: 28.7, cost: 16.4, stock: 4, min: 6 },
  { sku: '7891000605603', name: 'Vitamina C 1g efervescente', cat: 'Vitaminas', price: 14.9, cost: 7.5, stock: 28, min: 10 },
  { sku: '7891000706705', name: 'Vitamina D3 2.000UI c/30', cat: 'Vitaminas', price: 39.9, cost: 21.0, stock: 11, min: 8 },
  { sku: '7891000807807', name: 'Complexo B c/60', cat: 'Vitaminas', price: 22.4, cost: 11.2, stock: 14, min: 8 },
  { sku: '7891000908909', name: 'Álcool gel 70% 500ml', cat: 'Higiene', price: 11.2, cost: 5.4, stock: 56, min: 20 },
  { sku: '7891001000005', name: 'Sabonete líquido neutro', cat: 'Higiene', price: 9.8, cost: 4.8, stock: 33, min: 15 },
  { sku: '7891001100109', name: 'Protetor solar FPS 50', cat: 'Dermocosméticos', price: 64.9, cost: 36.0, stock: 9, min: 6 },
  { sku: '7891001200201', name: 'Hidratante facial 60g', cat: 'Dermocosméticos', price: 48.5, cost: 26.0, stock: 7, min: 5 },
  { sku: '7891001300303', name: 'Fralda infantil M c/30', cat: 'Infantil', price: 49.9, cost: 28.0, stock: 21, min: 10 },
  { sku: '7891001400405', name: 'Lenço umedecido c/100', cat: 'Infantil', price: 17.3, cost: 8.4, stock: 3, min: 10 },
  { sku: '7891001500507', name: 'Omeprazol 20mg c/14', cat: 'Genéricos', price: 14.2, cost: 6.1, stock: 25, min: 12 },
  { sku: '7891001600609', name: 'Losartana 50mg c/30', cat: 'Genéricos', price: 17.8, cost: 7.3, stock: 18, min: 10 },
  { sku: '7891001700701', name: 'Atenolol 25mg c/30', cat: 'Genéricos', price: 12.6, cost: 5.2, stock: 12, min: 10 },
  { sku: '7891001800803', name: 'Curativo adesivo c/40', cat: 'Primeiros socorros', price: 7.4, cost: 3.1, stock: 31, min: 15 },
  { sku: '7891001900905', name: 'Soro fisiológico 500ml', cat: 'Primeiros socorros', price: 6.3, cost: 2.8, stock: 44, min: 20 },
  { sku: '7891002001007', name: 'Termômetro digital', cat: 'Primeiros socorros', price: 34.5, cost: 18.0, stock: 5, min: 4 },
];

export const SEED_REQUESTS = [
  { name: 'Pomada cicatrizante Bepantol', note: 'Cliente perguntou ontem à tarde', count: 3, date: relDays(-2) },
  { name: 'Insulina NPH refrigerada', note: 'Idoso passa toda semana', count: 5, date: relDays(-5) },
  { name: 'Fralda geriátrica G', note: 'Filha cuida da mãe acamada', count: 2, date: relDays(-1) },
  { name: 'Glicosímetro fitas', note: 'Diabéticos pedem constantemente', count: 4, date: relDays(-3) },
];

export interface SeedSale {
  ts: Date;
  it: { pid: string; nm: string; q: number; pr: number }[];
  tot: number;
  pay: string;
}

/** Build ~35 days of believable sales referencing the inserted product ids. */
export function buildSeedSales(products: { id: string; name: string; price: number }[]): SeedSale[] {
  const sales: SeedSale[] = [];
  const now = new Date();
  const pays = ['pix', 'cartão', 'dinheiro'];
  for (let d = 34; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const numSales = weekend ? rand(8, 14) : rand(4, 10);
    for (let s = 0; s < numSales; s++) {
      const itemsCount = rand(1, 4);
      const seen = new Set<number>();
      const it: SeedSale['it'] = [];
      for (let i = 0; i < itemsCount; i++) {
        let idx: number;
        do {
          idx = rand(0, products.length - 1);
        } while (seen.has(idx));
        seen.add(idx);
        const p = products[idx];
        it.push({ pid: p.id, nm: p.name, q: rand(1, 3), pr: p.price });
      }
      const ts = new Date(day);
      ts.setHours(rand(8, 20), rand(0, 59), 0, 0);
      sales.push({ ts, it, tot: it.reduce((a, x) => a + x.q * x.pr, 0), pay: pays[rand(0, 2)] });
    }
  }
  return sales.sort((a, b) => a.ts.getTime() - b.ts.getTime());
}
